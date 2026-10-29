import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Info, Loader2, Play, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import StatusBadge from "@/components/shared/StatusBadge";
import CameraCaptureModal from "./CameraCaptureModal";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import {
  CAU_KHONG_DOC_THOI_LUONG,
  LOAI_BANG_CHUNG as LOAI,
  cauThoiLuongVideo,
  cauVideoQuaLon,
  giayTuDung,
  gioiHanVideo,
  phanTramTaiLen,
  chuThongTinTep,
  oBangChung,
  TEN_TEP_LOAI,
  thoiLuongGuiLen,
  thoiLuongHopLe,
  videoQuaLon,
} from "./dong-goi/tinhDongGoi";
import { ghiThoiLuongWebm } from "./dong-goi/thoiLuongWebm";
import { AnhThuNho, HopXemBangChung } from "./dong-goi/XemBangChung";
import { dinhGio, dinhNgay, dongHo } from "./dong-goi/dinhDangBangChung";
import { CHAT_LUONG_QUAY_VIDEO } from "@/config/bangChungTu";
import useHoiKhiRoiTrang from "@/hooks/useHoiKhiRoiTrang";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { dongGoiService } from "@/services/dongGoiService";
import { getApiErrorMessage } from "@/utils/apiError";

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
 * Đọc thời lượng (giây, số thực — nơi gọi quy ra số gửi máy chủ bằng thoiLuongGuiLen) của tệp video bằng thẻ <video>;
 * không đọc được thì null. Tệp webm do trình duyệt quay thường báo thời lượng Infinity: tua tới cuối để trình duyệt tính
 * lại rồi mới đọc.
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
    const doc = () => (Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null);
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

// Phần đầu tệp WebM đủ chứa EBML, Segment và Info (vài trăm byte); chỉ đọc phần này để không chép cả video trong bộ nhớ
const DAU_TEP_WEBM = 64 * 1024;

/**
 * Tệp video gửi lên: ghi thời lượng (ms) vào phần đầu WebM để xem lại tua được (trình duyệt cũ quay ra tệp không có
 * thời lượng); không ghi được (Chrome mới đã tự ghi, cấu trúc lạ…) thì gửi nguyên tệp gốc.
 */
async function taoTepVideo(goc, thoiLuongMs) {
  const ten = `video_dong_goi_${Date.now()}.webm`;
  try {
    const dau = new Uint8Array(await goc.slice(0, DAU_TEP_WEBM).arrayBuffer());
    const daSua = ghiThoiLuongWebm(dau, thoiLuongMs);
    if (daSua) return new File([daSua, goc.slice(DAU_TEP_WEBM)], ten, { type: "video/webm" });
  } catch {
    // Dùng tệp gốc
  }
  return new File([goc], ten, { type: "video/webm" });
}

/**
 * Quay video bằng camera (MediaRecorder, video/webm, chất lượng theo CHAT_LUONG_QUAY_VIDEO): đếm giây, tự dừng ở
 * `gioiHan.toiDa`. Dừng tay dưới `gioiHan.toiThieu` bị khóa ở nút; máy tự dừng sớm (mất camera) thì báo lỗi thời lượng.
 * Rời màn khi đang quay: tắt camera, không tải video dở.
 */
function useQuayVideo({ gioiHan, onXong, onLoi }) {
  const [giay, setGiay] = useState(null); // null = không quay
  const [dangMo, setDangMo] = useState(false); // đang chờ trình duyệt mở camera
  const [stream, setStream] = useState(null);
  const recRef = useRef(null);
  const henRef = useRef(null);
  const batDauRef = useRef(0);
  // Lúc bấm dừng / tự dừng: thời lượng tính tới đây, không tính độ trễ của onstop
  const dungLucRef = useRef(0);
  const huyRef = useRef(false);
  const xongRef = useRef(onXong);
  const loiRef = useRef(onLoi);
  const gioiHanRef = useRef(gioiHan);
  useEffect(() => {
    xongRef.current = onXong;
    loiRef.current = onLoi;
    gioiHanRef.current = gioiHan;
  });

  const dung = useCallback(() => {
    clearInterval(henRef.current);
    if (recRef.current?.state === "recording") {
      dungLucRef.current = Date.now();
      recRef.current.stop();
    }
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
      s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: CHAT_LUONG_QUAY_VIDEO.rong }, height: { ideal: CHAT_LUONG_QUAY_VIDEO.cao } },
        audio: true,
      });
      if (huyRef.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      const rec = new MediaRecorder(s, { mimeType: "video/webm", videoBitsPerSecond: CHAT_LUONG_QUAY_VIDEO.bitGiay });
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
        const gh = gioiHanRef.current;
        // Máy tự dừng (mất camera) thì không có lúc bấm dừng. Bộ đếm bị trình duyệt hãm (khóa màn, chuyển ứng dụng)
        // làm video dài hơn hẳn mốc tối đa thì báo lỗi, không kẹp số — máy chủ tin số này.
        const thoiLuong = thoiLuongGuiLen(((dungLucRef.current || Date.now()) - batDauRef.current) / 1000, gh);
        if (!thoiLuongHopLe(thoiLuong, gh)) {
          loiRef.current?.(cauThoiLuongVideo(thoiLuong, gh));
          return;
        }
        const goc = new Blob(manh, { type: "video/webm" });
        if (videoQuaLon(goc.size)) {
          loiRef.current?.(cauVideoQuaLon(goc.size, { daQuay: true }));
          return;
        }
        // Gửi lời hứa của tệp: nơi nhận đặt "đang tải" ngay (không hở khoảng không có trạng thái lúc đang tạo tệp)
        xongRef.current?.(taoTepVideo(goc, (dungLucRef.current || Date.now()) - batDauRef.current), thoiLuong);
      };
      recRef.current = rec;
      setStream(s);
      rec.start();
      batDauRef.current = Date.now();
      dungLucRef.current = 0;
      setGiay(0);
      henRef.current = setInterval(() => {
        const daQua = Math.floor((Date.now() - batDauRef.current) / 1000);
        setGiay(daQua);
        if (daQua >= gioiHanRef.current.toiDa) dung();
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

  return { dangQuay: giay != null, dangMo, giay: giay ?? 0, gioiHan, stream, batDau, dung };
}

function XemTruocTrucTiep({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream ?? null;
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className="absolute inset-0 size-full object-cover" />;
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
  const khoaDung = dangQuay && quay.giay < quay.gioiHan.toiThieu;
  const tuDungSau = dangQuay ? giayTuDung(quay.giay, quay.gioiHan) : null;
  const phanTram = dangTai ? trangThai?.phanTram ?? null : null;
  const chuTai = phanTram != null && phanTram >= 100 ? "Đang lưu…" : "Đang tải lên…";
  // Vùng thông báo luôn có sẵn trong DOM (gắn cùng lúc với nội dung thì trình đọc màn hình hay bỏ qua); câu sắp tự dừng
  // giữ nguyên suốt khoảng báo trước để chỉ đọc một lần
  const thongBaoDoc = dangTai ? chuTai : tuDungSau != null ? `Sắp tự dừng quay ở ${dongHo(quay.gioiHan.toiDa)}` : "";
  const meta = bc
    ? chuThongTinTep(bc, { dinhGio, dinhNgay })
    : hetHan
      ? "Tệp đã tự xóa sau hạn lưu"
      : loi
        ? "Chưa lưu"
        : o.laVideo ? "Chưa có video" : "Chưa có ảnh";

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-bo-surface", o.laVideo && "md:col-span-2", loi ? "border-bo-danger/40" : "border-bo-border")}>
      <div className={cn("relative grid aspect-video place-items-center bg-bo-surface-subtle", o.laVideo && "max-h-72 w-full")}>
        {trong ? (
          <span className="grid justify-items-center gap-2 px-4 text-center">
            <span className="grid size-12 place-items-center rounded-full border border-bo-border bg-bo-surface text-slate-400">
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
              Đang quay {dongHo(quay.giay)} / {dongHo(quay.gioiHan.toiDa)}
            </span>
            <span
              className={cn(
                "absolute inset-x-2 bottom-2 rounded px-2 py-1 text-center text-xs text-white",
                tuDungSau == null ? "bg-black/60" : "bg-bo-warning font-semibold",
              )}
            >
              {tuDungSau == null
                ? "Quay từ lúc cho hàng vào hộp đến khi dán niêm phong"
                : tuDungSau > 0 ? `Tự dừng sau ${tuDungSau} giây` : "Đang dừng quay…"}
            </span>
          </>
        ) : null}
        {dangTai ? (
          <span className="grid w-full max-w-[240px] justify-items-center gap-2 px-4 text-[13px] text-bo-muted">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            <span aria-hidden="true">{chuTai}</span>
            {phanTram != null && phanTram < 100 ? (
              <span
                role="progressbar"
                aria-label={`Tải lên: ${o.ten}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={phanTram}
                className="grid w-full gap-1"
              >
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <span className="block h-full rounded-full bg-bo-primary transition-[width]" style={{ width: `${phanTram}%` }} />
                </span>
                <span className="text-center font-mono text-xs tabular-nums text-bo-foreground">{phanTram}%</span>
              </span>
            ) : null}
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
        <span role="status" className="sr-only">{thongBaoDoc}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-bo-border px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-5 text-bo-foreground">{o.ten}</span>
          <span className="block text-xs leading-4 text-bo-muted">{meta}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {(trong || loi) && suaDuoc ? (
            <>
              {/* Giữ "Quay video" cả khi ô đang báo lỗi: câu báo tệp quá lớn nhắc đúng tên nút này */}
              <Button type="button" size="sm" disabled={khoaThem} onClick={onChup} aria-label={`${o.laVideo ? "Quay video" : "Chụp ảnh"}: ${o.ten}`} className="h-8 bg-bo-primary px-2.5 text-[13px] text-white hover:bg-bo-primary-hover">
                {o.laVideo ? "Quay video" : "Chụp ảnh"}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={khoaThem} onClick={onChonTep} aria-label={`Chọn tệp: ${o.ten}`} className="h-8 border-bo-border bg-bo-surface px-2.5 text-[13px] shadow-none hover:bg-bo-surface-subtle">
                Chọn tệp
              </Button>
            </>
          ) : null}
          {dangQuay ? (
            <Button type="button" size="sm" disabled={khoaDung} onClick={quay.dung} className="h-8 bg-bo-danger px-2.5 text-[13px] text-white hover:bg-bo-danger-strong disabled:opacity-60">
              {khoaDung ? `Dừng được sau ${quay.gioiHan.toiThieu - quay.giay} giây` : "Dừng quay"}
            </Button>
          ) : null}
          {bc && !dangQuay && !dangTai ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={onXem} aria-label={`Xem: ${o.ten}`} className="h-8 border-bo-border bg-bo-surface px-2.5 text-[13px] shadow-none hover:bg-bo-surface-subtle">
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
 * (khóa Dừng dưới thời lượng tối thiểu, báo trước rồi tự dừng ở tối đa) hoặc chọn tệp; video quá dung lượng bị chặn
 * trước khi tải; tải video hiện phần trăm; câu lỗi tải lên của máy chủ hiện nguyên văn trong ô. Bằng chứng gắn theo ĐƠN
 * (`donId`); máy chủ thay tệp cũ khi tải lại cùng loại.
 *
 * - `thoiLuongVideoToiThieu`, `thoiLuongVideoToiDa`: khoảng thời lượng video (giây) máy chủ gửi; thiếu thì dùng config.
 * - `readOnly`: không thêm / xóa (phiếu đã hoàn tất, đơn hoặc phiếu bị hủy); `lyDoKhoaXoa`: lý do khi rê vào nút Xóa.
 * - `hetHan`: phiếu đã đóng gói xong mà không còn tệp → ô ghi "Tệp đã tự xóa sau hạn lưu", không báo "Chưa đủ".
 * - `coTieuDe = false`: không vẽ tiêu đề (nơi gọi đã có tiêu đề, vd. hộp bằng chứng của màn Phiếu nhặt hàng).
 * - `loiYeuCau` + `onThuLaiYeuCau`: không tải được yêu cầu bằng chứng (GET …/bang-chung) → dòng lỗi có "Thử lại".
 * - `traTieuDiem()`: gọi sau khi lưu / xóa / đóng camera, hộp xem, hộp xóa — nơi gọi trả tiêu điểm về chỗ cần (ô quét).
 * - `traTieuDiemVe` (ref, vd. ô quét): đóng hộp hỏi rời trang thì tiêu điểm về đây, không về link đã mở hộp (Enter của
 *   máy quét sẽ bấm lại link đó).
 * - `onRefresh()`: tải lại sau khi lưu / xóa. `soDonHang`: đặt tên tệp khi tải bằng chứng xuống (thiếu thì theo
 *   `donId`). `tongTienDonHang`: giữ cho nơi gọi cũ, không dùng.
 * - Đang mở camera / quay / tệp chưa gửi hết: rời trang (link, Back, đóng thẻ…) phải xác nhận (useHoiKhiRoiTrang); gỡ
 *   phần này thì dừng tải. `onBanDoi(true | false)`: báo nơi gọi để hỏi trước khi đóng hộp chứa phần này.
 */
export default function PackingProofSection({
  donId,
  soDonHang,
  yeuCauVideo = false,
  huongDan,
  thoiLuongVideoToiThieu,
  thoiLuongVideoToiDa,
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
  traTieuDiemVe,
  onBanDoi,
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
  // loai → { dieuKhien: AbortController, daGuiHet } của lần tải đang chạy: rời màn / đóng hộp thì dừng tải (đã hỏi
  // trước khi rời) — trừ lần đã gửi hết tệp (máy chủ đang lưu: dừng lúc này chỉ có thể làm mất tệp)
  const huyTaiRef = useRef({});
  useEffect(() => {
    daGoRef.current = false;
    const dangTai = huyTaiRef.current;
    return () => {
      daGoRef.current = true;
      Object.values(dangTai).forEach((t) => {
        if (!t.daGuiHet) t.dieuKhien.abort();
      });
    };
  }, []);

  const gioiHan = useMemo(
    () => gioiHanVideo({ thoiLuongVideoToiThieu, thoiLuongVideoToiDa }),
    [thoiLuongVideoToiThieu, thoiLuongVideoToiDa],
  );

  const datO = (loai, giaTri) => setTrangThai((cu) => ({ ...cu, [loai]: giaTri }));

  /** `file`: tệp, hoặc lời hứa trả tệp (video vừa quay đang được ghi thời lượng) — "đang tải" được đặt ngay. */
  const taiLen = async (loai, file, thoiLuongGiay = null) => {
    if (!file || !donId) return;
    datO(loai, { dangTai: true, loi: "" });
    const dieuKhien = new AbortController();
    const lanTai = { dieuKhien, daGuiHet: false };
    huyTaiRef.current[loai]?.dieuKhien.abort();
    huyTaiRef.current[loai] = lanTai;
    // Phần trăm chỉ cập nhật khi đổi số (axios báo tiến độ rất dày)
    const khiTienDo = (suKien) => {
      const phanTram = phanTramTaiLen(suKien);
      if (phanTram == null || daGoRef.current) return;
      if (phanTram >= 100) lanTai.daGuiHet = true;
      setTrangThai((cu) => (!cu[loai]?.dangTai || cu[loai].phanTram === phanTram ? cu : { ...cu, [loai]: { ...cu[loai], phanTram } }));
    };
    try {
      const tep = await file;
      if (daGoRef.current || dieuKhien.signal.aborted) return;
      const fd = new FormData();
      fd.append("file", tep);
      fd.append("loaiBangChung", loai);
      if (thoiLuongGiay != null) fd.append("thoiLuongGiay", thoiLuongGiay);
      const bc = await dongGoiService.uploadBangChung(donId, fd, {
        onUploadProgress: loai === LOAI.VIDEO_DONG_GOI ? khiTienDo : undefined,
        signal: dieuKhien.signal,
      });
      if (daGoRef.current) {
        // Đã rời màn / đóng hộp lúc máy chủ đang lưu: vẫn báo nơi gọi tải lại (vd. phiếu nhặt cập nhật bằng chứng)
        onRefresh?.();
        return;
      }
      datO(loai, null);
      toast.success(loai === LOAI.VIDEO_DONG_GOI ? "Đã lưu video đóng gói" : "Đã lưu ảnh đóng gói", {
        description: bc?.ngayHetHan ? `Lưu đến ${dinhNgay(bc.ngayHetHan)} rồi tự xóa` : undefined,
      });
      onRefresh?.();
    } catch (error) {
      // Rời màn, hoặc lần tải này bị lần tải mới cùng loại thay: không ghi đè trạng thái của lần mới
      if (daGoRef.current || dieuKhien.signal.aborted) return;
      // Câu của máy chủ (định dạng, dung lượng, thời lượng, đơn đã hủy…) hiện nguyên văn trong ô
      datO(loai, { dangTai: false, loi: getApiErrorMessage(error, "Không tải được tệp lên") });
    }
    if (huyTaiRef.current[loai] === lanTai) delete huyTaiRef.current[loai];
    // Nút vừa bấm có thể đã bị gỡ (ô đổi trạng thái): trả tiêu điểm cho nơi gọi (vd. ô quét mã)
    traTieuDiem?.();
  };

  const quay = useQuayVideo({
    gioiHan,
    onXong: (file, giay) => taiLen(LOAI.VIDEO_DONG_GOI, file, giay),
    onLoi: (cau) => datO(LOAI.VIDEO_DONG_GOI, { dangTai: false, loi: cau }),
  });
  const ban = quay.dangQuay || quay.dangMo || Object.values(trangThai).some((t) => t?.dangTai);
  // Hỏi trước khi rời trang / đóng hộp: đang mở camera, đang quay, hoặc tệp chưa gửi hết (gửi xong 100% thì máy chủ
  // vẫn lưu dù rời trang)
  const canHoi =
    quay.dangQuay || quay.dangMo || Object.values(trangThai).some((t) => t?.dangTai && !(t.phanTram >= 100));
  const [hoiRoi, setHoiRoi] = useState(null); // hàm đi tiếp khi người dùng đồng ý rời
  useHoiKhiRoiTrang(canHoi, (tiepTuc) => setHoiRoi(() => tiepTuc));
  useEffect(() => {
    onBanDoi?.(canHoi);
  }, [canHoi, onBanDoi]);

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
    // Quá dung lượng máy chủ nhận: báo ngay, không tải hết tệp rồi mới bị từ chối
    if (videoQuaLon(file.size)) {
      datO(oChon.loai, { dangTai: false, loi: cauVideoQuaLon(file.size) });
      return;
    }
    const giay = thoiLuongGuiLen(await docThoiLuong(file), gioiHan);
    if (daGoRef.current) return;
    if (giay == null || !thoiLuongHopLe(giay, gioiHan)) {
      datO(oChon.loai, { dangTai: false, loi: giay == null ? CAU_KHONG_DOC_THOI_LUONG : cauThoiLuongVideo(giay, gioiHan) });
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
            onXem={() => setXem({ ...x, tenTep: [soDonHang || `don-${donId}`, TEN_TEP_LOAI[x.loai]] })}
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

      <HopXemBangChung
        o={xem}
        onDong={() => setXem(null)}
        onCloseAutoFocus={(suKien) => {
          if (!traTieuDiem) return;
          suKien.preventDefault();
          traTieuDiem();
        }}
      />

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

      <HopXacNhanChungTu
        mo={Boolean(hoiRoi)}
        traTieuDiemVe={traTieuDiemVe}
        onDoiMo={(mo) => {
          if (mo) return;
          setHoiRoi(null);
          // Ở lại: tiêu điểm về ô quét (không để trên link vừa bấm — Enter của máy quét sẽ bấm lại link)
          traTieuDiem?.();
        }}
        tieuDe="Rời trang khi bằng chứng chưa lưu xong?"
        moTa={
          quay.dangQuay
            ? "Video đang quay sẽ bị bỏ, phải quay lại từ đầu."
            : quay.dangMo
              ? "Camera đang mở để quay sẽ bị tắt."
              : "Tệp đang tải lên sẽ bị dừng, phải chụp, quay hoặc chọn tệp lại."
        }
        nhanXacNhan="Rời trang"
        kieu="nguyHiem"
        onXacNhan={() => {
          const tiepTuc = hoiRoi;
          setHoiRoi(null);
          tiepTuc?.();
        }}
      />
    </section>
  );
}
