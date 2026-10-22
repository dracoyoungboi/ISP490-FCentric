import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Info, Loader2, Play, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import StatusBadge from "@/components/shared/StatusBadge";
import CameraCaptureModal from "./CameraCaptureModal";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import {
  CAU_KHONG_DOC_THOI_LUONG,
  LOAI_BANG_CHUNG as LOAI,
  cauThoiLuongVideo,
  resolveProofMediaUrl,
  chuThongTinTep,
  oBangChung,
  thoiLuongHopLe,
} from "./dong-goi/tinhDongGoi";
import { THOI_LUONG_VIDEO_DONG_GOI } from "@/config/bangChungTu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { dongGoiService } from "@/services/dongGoiService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";

const pad2 = (n) => String(n).padStart(2, "0");
const dinhGio = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const dinhNgay = (value) => formatDate(value).slice(0, 5); // "20/11"
const dongHo = (giay) => `${pad2(Math.floor(giay / 60))}:${pad2(giay % 60)}`;
const urlCua = (bc) => resolveProofMediaUrl(bc?.urlPublic || bc?.duongDanMinio);

/** Câu báo khi không mở được camera hoặc không bắt đầu quay được, theo loại lỗi của trình duyệt. */
function cauLoiCamera(err) {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Trình duyệt chưa được phép dùng camera. Hãy cho phép dùng camera rồi thử lại.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Không tìm thấy camera hoặc micro trên thiết bị này.";
    case "NotReadableError":
      return "Camera đang được ứng dụng khác dùng. Hãy tắt ứng dụng đó rồi thử lại.";
    case "NotSupportedError":
      return "Trình duyệt này không quay được video. Hãy dùng Chrome hoặc Edge, hoặc chọn tệp video từ thiết bị.";
    default:
      return "Không mở được camera để quay video. Vui lòng thử lại.";
  }
}

// Chờ trình duyệt đọc thời lượng tệp tối đa ngần này (ms) rồi coi là không đọc được (tệp lỗi, định dạng lạ)
const CHO_DOC_THOI_LUONG_MS = 10000;

/**
 * Đọc thời lượng (giây, làm tròn) của tệp video bằng thẻ <video>; không đọc được thì null. Tệp webm do trình duyệt quay
 * thường báo thời lượng Infinity: tua tới cuối để trình duyệt tính lại rồi mới đọc.
 */
function docThoiLuong(file) {
  return new Promise((xong) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const url = URL.createObjectURL(file);
    let daXong = false;
    const ket = (giay) => {
      if (daXong) return;
      daXong = true;
      clearTimeout(henGio);
      URL.revokeObjectURL(url);
      xong(giay);
    };
    const henGio = setTimeout(() => ket(null), CHO_DOC_THOI_LUONG_MS);
    const doc = () => (Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration) : null);
    v.onloadedmetadata = () => {
      if (doc() != null) {
        ket(doc());
        return;
      }
      v.ondurationchange = () => {
        if (doc() != null) ket(doc());
      };
      v.currentTime = Number.MAX_SAFE_INTEGER;
    };
    v.onerror = () => ket(null);
    v.src = url;
  });
}

/**
 * Quay video bằng camera (MediaRecorder, video/webm): đếm giây, tự dừng ở `toiDa`. Dừng tay dưới `toiThieu` bị khóa ở
 * nút; máy tự dừng sớm (mất camera) thì báo lỗi thời lượng. Rời màn khi đang quay: tắt camera, không tải video dở.
 */
function useQuayVideo({ onXong, onLoi }) {
  const [giay, setGiay] = useState(null); // null = không quay
  const [dangMo, setDangMo] = useState(false); // đang chờ trình duyệt mở camera
  const [stream, setStream] = useState(null);
  const recRef = useRef(null);
  const henRef = useRef(null);
  const batDauRef = useRef(0);
  const huyRef = useRef(false);
  const xongRef = useRef(onXong);
  const loiRef = useRef(onLoi);
  useEffect(() => {
    xongRef.current = onXong;
    loiRef.current = onLoi;
  });

  const dung = useCallback(() => {
    clearInterval(henRef.current);
    if (recRef.current?.state === "recording") recRef.current.stop();
  }, []);

  // Đặt lại cờ khi gắn: StrictMode (dev) giả lập gỡ rồi gắn lại, ref vẫn giữ giá trị của lần gỡ giả
  useEffect(() => {
    huyRef.current = false;
    return () => {
      huyRef.current = true;
      clearInterval(henRef.current);
      if (recRef.current?.state === "recording") recRef.current.stop();
    };
  }, []);

  const dangMoRef = useRef(false);
  const batDau = useCallback(async () => {
    // Bấm hai lần lúc đang mở camera / đang quay: bỏ qua (không mở luồng camera thứ hai)
    if (dangMoRef.current || recRef.current?.state === "recording") return;
    dangMoRef.current = true;
    setDangMo(true);
    let s = null;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
      if (huyRef.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      const rec = new MediaRecorder(s, { mimeType: "video/webm" });
      const manh = [];
      rec.ondataavailable = (e) => {
        if (e.data?.size > 0) manh.push(e.data);
      };
      rec.onstop = () => {
        clearInterval(henRef.current);
        s.getTracks().forEach((t) => t.stop());
        setStream(null);
        setGiay(null);
        if (huyRef.current) return;
        const thoiLuong = Math.min(THOI_LUONG_VIDEO_DONG_GOI.toiDa, Math.round((Date.now() - batDauRef.current) / 1000));
        if (!thoiLuongHopLe(thoiLuong)) {
          loiRef.current?.(cauThoiLuongVideo(thoiLuong));
          return;
        }
        const file = new File([new Blob(manh, { type: "video/webm" })], `video_dong_goi_${Date.now()}.webm`, { type: "video/webm" });
        xongRef.current?.(file, thoiLuong);
      };
      recRef.current = rec;
      setStream(s);
      rec.start();
      batDauRef.current = Date.now();
      setGiay(0);
      henRef.current = setInterval(() => {
        const daQua = Math.floor((Date.now() - batDauRef.current) / 1000);
        setGiay(daQua);
        if (daQua >= THOI_LUONG_VIDEO_DONG_GOI.toiDa) dung();
      }, 250);
    } catch (err) {
      s?.getTracks().forEach((t) => t.stop());
      setStream(null);
      setGiay(null);
      loiRef.current?.(cauLoiCamera(err));
    } finally {
      dangMoRef.current = false;
      if (!huyRef.current) setDangMo(false);
    }
  }, [dung]);

  return { dangQuay: giay != null, dangMo, giay: giay ?? 0, stream, batDau, dung };
}

function XemTruocTrucTiep({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream ?? null;
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className="absolute inset-0 size-full object-cover" />;
}

/** Ảnh thu nhỏ của tệp đã lưu (ảnh hoặc khung đầu của video); tải hỏng thì biểu tượng. */
function AnhThuNho({ bc, laVideo, ten }) {
  const [hong, setHong] = useState(false);
  const url = urlCua(bc);
  if (hong || !url) {
    return (
      <span className="grid size-full place-items-center bg-slate-100 text-slate-400">
        {laVideo ? <Video className="size-8" aria-hidden="true" /> : <Camera className="size-8" aria-hidden="true" />}
      </span>
    );
  }
  return laVideo ? (
    <video src={url} preload="metadata" muted playsInline onError={() => setHong(true)} className="size-full object-cover" aria-label={ten} />
  ) : (
    <img src={url} alt={ten} loading="lazy" onError={() => setHong(true)} className="size-full object-cover" />
  );
}

/**
 * Một ô bằng chứng: khung xem (trống · đang quay · đang tải · đã có · lỗi) và chân ô (tên, thông tin tệp, nút).
 */
function OBangChung({ o, suaDuoc, khoaThem, lyDoKhoaXoa, hetHan, trangThai, quay, onChup, onChonTep, onXem, onXoa }) {
  const bc = o.bangChung;
  const dangQuay = o.laVideo && quay.dangQuay;
  const dangTai = Boolean(trangThai?.dangTai);
  const loi = !bc && !dangQuay && !dangTai ? trangThai?.loi || "" : "";
  const trong = !bc && !dangQuay && !dangTai && !loi;
  const khoaDung = dangQuay && quay.giay < THOI_LUONG_VIDEO_DONG_GOI.toiThieu;
  const meta = bc
    ? chuThongTinTep(bc, { dinhGio, dinhNgay })
    : hetHan
      ? "Tệp đã tự xóa sau hạn lưu"
      : loi
        ? "Chưa lưu"
        : o.laVideo ? "Chưa có video" : "Chưa có ảnh";

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-white", o.laVideo && "md:col-span-2", loi ? "border-bo-danger/40" : "border-bo-border")}>
      <div className={cn("relative grid aspect-video place-items-center bg-bo-surface-subtle", o.laVideo && "max-h-72 w-full")}>
        {trong ? (
          <span className="grid justify-items-center gap-2 px-4 text-center">
            <span className="grid size-12 place-items-center rounded-full border border-bo-border bg-white text-slate-400">
              {o.laVideo ? <Video className="size-6" aria-hidden="true" /> : <Camera className="size-6" aria-hidden="true" />}
            </span>
            <span className="max-w-[280px] text-[13px] leading-5 text-bo-muted">{o.goiY}</span>
          </span>
        ) : null}
        {dangQuay ? (
          <>
            <XemTruocTrucTiep stream={quay.stream} />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 font-mono text-xs font-semibold text-red-300">
              <span className="size-2 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" aria-hidden="true" />
              Đang quay {dongHo(quay.giay)}
            </span>
            <span className="absolute inset-x-2 bottom-2 rounded bg-black/60 px-2 py-1 text-center text-xs text-white">
              Quay từ lúc cho hàng vào hộp đến khi dán niêm phong
            </span>
          </>
        ) : null}
        {dangTai ? (
          <span role="status" className="grid justify-items-center gap-2 text-[13px] text-bo-muted">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            Đang tải lên…
          </span>
        ) : null}
        {bc && !dangQuay && !dangTai ? (
          <>
            <AnhThuNho bc={bc} laVideo={o.laVideo} ten={o.ten} />
            {o.laVideo ? (
              <>
                <span className="absolute grid size-11 place-items-center rounded-full bg-black/55 text-white" aria-hidden="true">
                  <Play className="size-5 fill-current" />
                </span>
                {bc.thoiLuongGiay ? (
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-xs text-white">
                    {dongHo(Number(bc.thoiLuongGiay))}
                  </span>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
        {loi ? (
          <span role="alert" className="grid justify-items-center gap-2 px-4 text-center">
            <XCircle className="size-8 text-bo-danger" aria-hidden="true" />
            <span className="max-w-[300px] text-[13px] leading-5 text-bo-danger-strong">{loi}</span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-bo-border px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-5 text-bo-foreground">{o.ten}</span>
          <span className="block text-xs leading-4 text-bo-muted">{meta}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {(trong || loi) && suaDuoc ? (
            <>
              <Button type="button" size="sm" disabled={khoaThem} onClick={onChup} aria-label={`${o.laVideo ? (loi ? "Quay lại" : "Quay video") : "Chụp ảnh"}: ${o.ten}`} className="h-8 bg-bo-primary px-2.5 text-[13px] text-white hover:bg-bo-primary-hover">
                {o.laVideo ? (loi ? "Quay lại" : "Quay video") : "Chụp ảnh"}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={khoaThem} onClick={onChonTep} aria-label={`Chọn tệp: ${o.ten}`} className="h-8 border-bo-border bg-white px-2.5 text-[13px] shadow-none hover:bg-bo-surface-subtle">
                Chọn tệp
              </Button>
            </>
          ) : null}
          {dangQuay ? (
            <Button type="button" size="sm" disabled={khoaDung} onClick={quay.dung} className="h-8 bg-bo-danger px-2.5 text-[13px] text-white hover:bg-bo-danger-strong disabled:opacity-60">
              {khoaDung ? `Dừng được sau ${THOI_LUONG_VIDEO_DONG_GOI.toiThieu - quay.giay} giây` : "Dừng quay"}
            </Button>
          ) : null}
          {bc && !dangQuay && !dangTai ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={onXem} aria-label={`Xem: ${o.ten}`} className="h-8 border-bo-border bg-white px-2.5 text-[13px] shadow-none hover:bg-bo-surface-subtle">
                Xem
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!suaDuoc}
                title={!suaDuoc ? lyDoKhoaXoa : undefined}
                aria-label={`Xóa: ${o.ten}`}
                onClick={onXoa}
                className="h-8 px-2.5 text-[13px] text-bo-foreground"
              >
                Xóa
              </Button>
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/**
 * Phần "Bằng chứng đóng gói" (dùng ở màn Đóng gói và hộp bằng chứng của màn Phiếu nhặt hàng): yêu cầu lấy từ máy chủ
 * (`yeuCauVideo`, `huongDan` hiện nguyên văn), mỗi loại bằng chứng một ô; chụp ảnh (CameraCaptureModal), quay video
 * (khóa Dừng dưới THOI_LUONG_VIDEO_DONG_GOI.toiThieu, tự dừng ở toiDa) hoặc chọn tệp; câu lỗi tải lên của máy chủ hiện
 * nguyên văn trong ô. Bằng chứng gắn theo ĐƠN (`donId`); máy chủ thay tệp cũ khi tải lại cùng loại.
 *
 * - `readOnly`: không thêm / xóa (phiếu đã hoàn tất, đơn hoặc phiếu bị hủy); `lyDoKhoaXoa`: lý do khi rê vào nút Xóa.
 * - `hetHan`: phiếu đã đóng gói xong mà không còn tệp → ô ghi "Tệp đã tự xóa sau hạn lưu", không báo "Chưa đủ".
 * - `coTieuDe = false`: không vẽ tiêu đề (nơi gọi đã có tiêu đề, vd. hộp bằng chứng của màn Phiếu nhặt hàng).
 * - `loiYeuCau` + `onThuLaiYeuCau`: không tải được yêu cầu bằng chứng (GET …/bang-chung) → dòng lỗi có "Thử lại".
 * - `traTieuDiem()`: gọi sau khi lưu / xóa / đóng camera, hộp xem, hộp xóa — nơi gọi trả tiêu điểm về chỗ cần (ô quét).
 * - `onRefresh()`: tải lại sau khi lưu / xóa. `soDonHang`, `tongTienDonHang`: giữ cho nơi gọi cũ, không dùng.
 */
export default function PackingProofSection({
  donId,
  yeuCauVideo = false,
  huongDan,
  danhSachBangChung = [],
  daDuBangChung = false,
  onRefresh,
  readOnly = false,
  lyDoKhoaXoa = "",
  hetHan = false,
  coTieuDe = true,
  loiYeuCau = null,
  onThuLaiYeuCau,
  traTieuDiem,
  className,
}) {
  const o = oBangChung({ yeuCauVideo, danhSach: danhSachBangChung });
  const [trangThai, setTrangThai] = useState({}); // loai → { dangTai, loi }
  const [chupLoai, setChupLoai] = useState(null);
  const [xem, setXem] = useState(null); // ô đang xem lớn
  const [xoa, setXoa] = useState(null); // ô đang hỏi xóa
  const [dangXoa, setDangXoa] = useState(false);
  const [loiXoa, setLoiXoa] = useState(null);
  const inputRef = useRef(null);
  const chonChoRef = useRef(null);
  const daGoRef = useRef(false);
  useEffect(() => {
    daGoRef.current = false;
    return () => {
      daGoRef.current = true;
    };
  }, []);

  const datO = (loai, giaTri) => setTrangThai((cu) => ({ ...cu, [loai]: giaTri }));

  const taiLen = async (loai, file, thoiLuongGiay = null) => {
    if (!file || !donId) return;
    datO(loai, { dangTai: true, loi: "" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("loaiBangChung", loai);
      if (thoiLuongGiay != null) fd.append("thoiLuongGiay", thoiLuongGiay);
      const bc = await dongGoiService.uploadBangChung(donId, fd);
      if (daGoRef.current) return;
      datO(loai, null);
      toast.success(loai === LOAI.VIDEO_DONG_GOI ? "Đã lưu video đóng gói" : "Đã lưu ảnh đóng gói", {
        description: bc?.ngayHetHan ? `Lưu đến ${dinhNgay(bc.ngayHetHan)} rồi tự xóa` : undefined,
      });
      onRefresh?.();
    } catch (error) {
      if (daGoRef.current) return;
      // Câu của máy chủ (định dạng, dung lượng, thời lượng, đơn đã hủy…) hiện nguyên văn trong ô
      datO(loai, { dangTai: false, loi: getApiErrorMessage(error, "Không tải được tệp lên") });
    }
    // Nút vừa bấm có thể đã bị gỡ (ô đổi trạng thái): trả tiêu điểm cho nơi gọi (vd. ô quét mã)
    traTieuDiem?.();
  };

  const quay = useQuayVideo({
    onXong: (file, giay) => taiLen(LOAI.VIDEO_DONG_GOI, file, giay),
    onLoi: (cau) => datO(LOAI.VIDEO_DONG_GOI, { dangTai: false, loi: cau }),
  });
  const ban = quay.dangQuay || quay.dangMo || Object.values(trangThai).some((t) => t?.dangTai);

  const chonTep = (oChon) => {
    chonChoRef.current = oChon;
    if (inputRef.current) {
      inputRef.current.accept = oChon.laVideo ? "video/*" : "image/*";
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };
  const khiChonTep = async (suKien) => {
    const file = suKien.target.files?.[0];
    const oChon = chonChoRef.current;
    suKien.target.value = "";
    if (!file || !oChon) return;
    if (!oChon.laVideo) {
      taiLen(oChon.loai, file);
      return;
    }
    const giay = await docThoiLuong(file);
    if (daGoRef.current) return;
    if (giay == null || !thoiLuongHopLe(giay)) {
      datO(oChon.loai, { dangTai: false, loi: giay == null ? CAU_KHONG_DOC_THOI_LUONG : cauThoiLuongVideo(giay) });
      return;
    }
    taiLen(oChon.loai, file, giay);
  };

  const xacNhanXoa = async () => {
    const bc = xoa?.bangChung;
    if (!bc) return;
    setLoiXoa(null);
    setDangXoa(true);
    try {
      await dongGoiService.xoaBangChung(bc.id);
      if (daGoRef.current) return;
      setXoa(null);
      toast.success("Đã xóa bằng chứng", { description: "Chụp hoặc quay lại để hoàn tất" });
      traTieuDiem?.();
      onRefresh?.();
    } catch (error) {
      if (!daGoRef.current) setLoiXoa(getApiErrorMessage(error, "Không xóa được bằng chứng"));
    } finally {
      if (!daGoRef.current) setDangXoa(false);
    }
  };

  const tenXoa = xoa?.laVideo ? "video đóng gói" : xoa?.loai === LOAI.ANH_NIEM_PHONG_TEM_VC ? "ảnh niêm phong" : "ảnh hàng trong hộp";

  return (
    <section aria-labelledby={coTieuDe ? "bang-chung-dong-goi" : undefined} aria-label={coTieuDe ? undefined : "Bằng chứng đóng gói"} className={cn("border-t border-bo-border", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
        {coTieuDe ? (
          <h2 id="bang-chung-dong-goi" className="text-base font-semibold leading-6 text-bo-foreground">Bằng chứng đóng gói</h2>
        ) : null}
        {hetHan ? null : <StatusBadge label={daDuBangChung ? "Đã đủ bằng chứng" : "Chưa đủ bằng chứng"} />}
      </div>
      {loiYeuCau ? (
        <div className="mx-4 mb-3 sm:mx-6">
          <DongThongBao tone="bad" actions={onThuLaiYeuCau ? <NutChu onClick={onThuLaiYeuCau}>Thử lại</NutChu> : null}>
            Không tải được yêu cầu bằng chứng của đơn: {loiYeuCau}.
          </DongThongBao>
        </div>
      ) : null}
      {huongDan ? (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2 text-[13px] leading-5 text-slate-700 sm:mx-6">
          <Info className="mt-0.5 size-4 shrink-0 text-bo-primary" aria-hidden="true" />
          <span>{huongDan}</span>
        </p>
      ) : null}
      <div className="grid gap-3 px-4 pb-5 sm:px-6 md:grid-cols-2">
        {o.map((x) => (
          <OBangChung
            key={x.loai}
            o={x}
            suaDuoc={!readOnly}
            khoaThem={ban}
            lyDoKhoaXoa={lyDoKhoaXoa}
            hetHan={hetHan}
            trangThai={trangThai[x.loai]}
            quay={quay}
            onChup={() => {
              datO(x.loai, null);
              if (x.laVideo) quay.batDau();
              else setChupLoai(x.loai);
            }}
            onChonTep={() => chonTep(x)}
            onXem={() => setXem(x)}
            onXoa={() => {
              setLoiXoa(null);
              setXoa(x);
            }}
          />
        ))}
      </div>
      <input ref={inputRef} type="file" className="hidden" onChange={khiChonTep} tabIndex={-1} aria-hidden="true" />

      <CameraCaptureModal
        isOpen={Boolean(chupLoai)}
        onClose={() => {
          setChupLoai(null);
          traTieuDiem?.();
        }}
        onCapture={(file) => {
          const loai = chupLoai;
          setChupLoai(null);
          taiLen(loai, file);
        }}
        title={`Chụp: ${o.find((x) => x.loai === chupLoai)?.ten ?? ""}`}
        description={o.find((x) => x.loai === chupLoai)?.goiY}
      />

      <Dialog open={Boolean(xem)} onOpenChange={(mo) => !mo && setXem(null)}>
        <DialogContent
          className="max-w-[calc(100vw-2rem)] border-bo-border bg-white p-4 sm:max-w-3xl"
          onCloseAutoFocus={(suKien) => {
            if (!traTieuDiem) return;
            suKien.preventDefault();
            traTieuDiem();
          }}
        >
          <DialogHeader>
            <DialogTitle className="pr-6 text-base font-semibold text-bo-heading">{xem?.ten}</DialogTitle>
            <DialogDescription className="sr-only">{xem?.bangChung ? chuThongTinTep(xem.bangChung, { dinhGio, dinhNgay }) : ""}</DialogDescription>
          </DialogHeader>
          {xem?.bangChung ? (
            <div className="grid place-items-center overflow-hidden rounded-md bg-black">
              {xem.laVideo ? (
                <video src={urlCua(xem.bangChung)} controls autoPlay className="max-h-[70vh] max-w-full" />
              ) : (
                <img src={urlCua(xem.bangChung)} alt={xem.ten} className="max-h-[70vh] max-w-full object-contain" />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <HopXacNhanChungTu
        mo={Boolean(xoa)}
        onDoiMo={(mo) => {
          if (mo) return;
          setXoa(null);
          traTieuDiem?.();
        }}
        tieuDe={`Xóa ${tenXoa}?`}
        moTa="Xóa để chụp hoặc quay lại. Tệp đã xóa không khôi phục được."
        nhanXacNhan="Xóa"
        kieu="nguyHiem"
        dangChay={dangXoa}
        loi={loiXoa}
        onXacNhan={xacNhanXoa}
      />
    </section>
  );
}
