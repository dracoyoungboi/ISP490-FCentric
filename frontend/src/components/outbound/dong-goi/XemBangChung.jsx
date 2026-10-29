import { useEffect, useRef, useState } from "react";
import { Camera, Download, Loader2, Video, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/thongBaoNhanh";
import { dinhGio, dinhNgay, urlCua } from "./dinhDangBangChung";
import { chuThongTinTep, tenTepTaiXuong } from "./tinhDongGoi";

/*
 * Phần XEM bằng chứng, dùng chung cho màn Đóng gói (PackingProofSection, có chụp / quay / xóa), khối chỉ xem ở chi tiết
 * đơn bán (KhoiBangChungDongGoi) và ảnh biên bản giao nhận chuyển kho (AnhBienBanGiaoNhan): ảnh thu nhỏ, hộp xem lớn
 * (video tua được, ảnh phóng to, nút Tải xuống). Định dạng giờ / ngày ở dinhDangBangChung.js.
 */

const NUT_DAU_HOP =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed disabled:opacity-60";
// Ảnh / video cao tối đa 75% màn hình, chừa chỗ cho đầu hộp và dòng thông tin khi màn thấp
const CO_TEP = "mx-auto block max-h-[min(75vh,calc(100dvh-9rem))] max-w-full rounded-md";

/**
 * Tải tệp về máy với tên dễ đọc (`phanTen` → tenTepTaiXuong): thẻ <a download> bỏ qua tên tệp khi khác nguồn (MinIO),
 * nên lấy nội dung bằng fetch (MinIO cho phép CORS, CSP connect-src đã có MinIO) rồi lưu từ blob.
 */
async function taiVeMay(url, phanTen, signal) {
  // Không lấy từ bộ nhớ đệm: ảnh đã tải bằng thẻ <img> (không gửi Origin) có thể được đệm mà thiếu header CORS
  const phanHoi = await fetch(url, { cache: "no-store", signal });
  if (!phanHoi.ok) throw new Error(`HTTP ${phanHoi.status}`);
  const blob = await phanHoi.blob();
  const link = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = link;
  a.download = tenTepTaiXuong(phanTen, { loaiNoiDung: blob.type, url });
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Video lớn: chờ trình duyệt nhận xong tệp rồi mới thu hồi
  setTimeout(() => URL.revokeObjectURL(link), 30000);
}

/**
 * Xem video bằng chứng. Video quay trước khi có bước ghi thời lượng báo thời lượng Infinity (thanh tua không dùng
 * được): tua tới cuối để trình duyệt tính thời lượng rồi quay về đầu, một lần.
 */
function XemVideo({ src }) {
  const daSuaRef = useRef(false);
  const khiCoThongTin = (suKien) => {
    const v = suKien.currentTarget;
    if (Number.isFinite(v.duration) || daSuaRef.current) return;
    daSuaRef.current = true;
    const veDau = () => {
      if (!Number.isFinite(v.duration)) return;
      v.removeEventListener("durationchange", veDau);
      v.currentTime = 0;
      // Tua tới cuối có thể làm video dừng (ended): phát lại như autoPlay
      v.play().catch(() => {});
    };
    v.addEventListener("durationchange", veDau);
    v.currentTime = Number.MAX_SAFE_INTEGER;
  };
  return <video src={src} controls autoPlay onLoadedMetadata={khiCoThongTin} className={`${CO_TEP} bg-black`} />;
}

/**
 * Ảnh trong hộp xem lớn: đúng tỉ lệ, không khung nền. Chưa tải xong thì khung chờ (ảnh chưa có cỡ, hộp chưa biết rộng
 * bao nhiêu); tải hỏng thì một dòng báo thay cho biểu tượng ảnh vỡ.
 */
function XemAnh({ src, ten }) {
  const [trangThai, setTrangThai] = useState("dangTai"); // dangTai | xong | hong
  if (trangThai === "hong") {
    return (
      <p className="m-0 grid min-h-40 place-items-center rounded-md border border-bo-border bg-bo-surface-subtle px-4 text-center text-[13px] text-bo-muted">
        Không tải được ảnh.
      </p>
    );
  }
  return (
    <>
      {trangThai === "dangTai" ? (
        <div className="grid h-48 place-items-center rounded-md bg-bo-surface-subtle text-bo-muted">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          <span className="sr-only">Đang tải ảnh…</span>
        </div>
      ) : null}
      <img
        src={src}
        alt={ten}
        onLoad={() => setTrangThai("xong")}
        onError={() => setTrangThai("hong")}
        className={trangThai === "xong" ? `${CO_TEP} border border-bo-border` : "hidden"}
      />
    </>
  );
}

/** Ảnh thu nhỏ của tệp đã lưu (ảnh hoặc khung đầu của video); tải hỏng thì biểu tượng. */
export function AnhThuNho({ bc, laVideo, ten }) {
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
 * Hộp xem lớn một ô bằng chứng (`o`: { ten, laVideo, bangChung } của oBangChung, thêm `tenTep`: các phần tên tệp khi tải
 * xuống, vd. [mã đơn, TEN_TEP_LOAI[loai]]); `o` null là đóng. Hộp co theo cỡ ảnh / video (không khung nền đen), dưới
 * tệp là người tải lên, giờ, dung lượng, hạn lưu.
 * `onCloseAutoFocus`: nơi gọi tự trả tiêu điểm (vd. ô quét mã) thay cho nút đã mở hộp.
 */
export function HopXemBangChung({ o, onDong, onCloseAutoFocus }) {
  // Nơi gọi đặt `o` = null ngay khi đóng: giữ ô vừa xem để vẽ trong lúc hộp chạy hiệu ứng đóng (không co về khung trống)
  const [oCuoi, setOCuoi] = useState(o);
  // URL vừa tải xuống lỗi: báo ngay trong hộp (nút trên thông báo nổi không bấm được khi hộp modal đang mở)
  const [loiTai, setLoiTai] = useState(null);
  if (o && o !== oCuoi) {
    setOCuoi(o);
    setLoiTai(null);
  }
  const hien = o ?? oCuoi;
  // Các URL đang tải xuống: đóng hộp vẫn tải tiếp, rời màn (gỡ hộp) thì hủy
  const [dangTai, setDangTai] = useState(() => new Set());
  const dieuKhienRef = useRef(new Map()); // url → AbortController
  const urlDangMoRef = useRef("");
  const nutDongRef = useRef(null);
  const url = hien?.bangChung ? urlCua(hien.bangChung) : "";
  const thongTin = hien?.bangChung
    ? chuThongTinTep(hien.bangChung, { dinhGio: (v) => `${dinhGio(v)} ${dinhNgay(v)}`.trim(), dinhNgay })
    : "";

  useEffect(() => {
    urlDangMoRef.current = o?.bangChung ? urlCua(o.bangChung) : "";
  }, [o]);
  useEffect(() => {
    const dsDieuKhien = dieuKhienRef.current;
    return () => dsDieuKhien.forEach((dieuKhien) => dieuKhien.abort());
  }, []);

  async function taiXuong() {
    const urlTai = url;
    const ten = hien.ten;
    const dieuKhien = new AbortController();
    dieuKhienRef.current.set(urlTai, dieuKhien);
    setDangTai((ds) => new Set(ds).add(urlTai));
    setLoiTai(null);
    try {
      await taiVeMay(urlTai, hien.tenTep ?? [ten], dieuKhien.signal);
    } catch {
      if (dieuKhien.signal.aborted) return;
      if (urlDangMoRef.current === urlTai) {
        setLoiTai(urlTai);
        return;
      }
      // Hộp đã đóng hoặc đang xem tệp khác
      toast.error(`Không tải xuống được "${ten}"`, {
        description: "Kiểm tra mạng rồi thử lại, hoặc mở tệp ở thẻ mới để lưu.",
        action: { label: "Mở thẻ mới", onClick: () => window.open(urlTai, "_blank", "noopener,noreferrer") },
      });
    } finally {
      dieuKhienRef.current.delete(urlTai);
      setDangTai((ds) => {
        const moi = new Set(ds);
        moi.delete(urlTai);
        return moi;
      });
    }
  }

  const dangTaiNay = dangTai.has(url);
  return (
    <Dialog open={Boolean(o)} onOpenChange={(mo) => !mo && onDong()}>
      <DialogContent
        showCloseButton={false}
        // Rộng theo tệp (w-max), không quá 64rem / màn hình; đầu hộp và dòng thông tin không đẩy hộp rộng ra (contain)
        className="w-max min-w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] gap-3 border-bo-border bg-bo-surface p-4 sm:max-w-[min(64rem,calc(100vw-4rem))]"
        // Tiêu điểm đầu vào nút Đóng, không vào Tải xuống: Enter của máy quét (màn Đóng gói) chỉ đóng hộp
        onOpenAutoFocus={(suKien) => {
          suKien.preventDefault();
          nutDongRef.current?.focus();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="flex-row items-center gap-2 text-left [contain:inline-size]">
          {/* Tên ô đóng gói dài ("Ảnh hộp dán băng keo niêm phong…"): xuống tối đa 2 dòng thay vì cắt khi hộp hẹp */}
          <DialogTitle className="line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold leading-5 text-bo-heading">{hien?.ten}</DialogTitle>
          {url ? (
            <button
              type="button"
              onClick={taiXuong}
              disabled={dangTaiNay}
              title="Tải xuống"
              // Màn hẹp chỉ còn biểu tượng để tiêu đề đủ chỗ
              className={`${NUT_DAU_HOP} border border-bo-border bg-bo-surface max-sm:w-8 sm:px-2.5`}
            >
              {dangTaiNay ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
              <span className="max-sm:sr-only">{dangTaiNay ? "Đang tải…" : "Tải xuống"}</span>
            </button>
          ) : null}
          <DialogClose ref={nutDongRef} className={`${NUT_DAU_HOP} size-8 text-bo-muted hover:text-bo-foreground`} aria-label="Đóng" title="Đóng">
            <X className="size-4" aria-hidden="true" />
          </DialogClose>
        </DialogHeader>
        {url && hien.laVideo ? <XemVideo src={url} /> : null}
        {url && !hien.laVideo ? <XemAnh key={url} src={url} ten={hien.ten} /> : null}
        {loiTai && loiTai === url ? (
          <p role="alert" className="m-0 text-[13px] leading-5 text-bo-danger-strong [contain:inline-size]">
            Không tải xuống được tệp. Kiểm tra mạng rồi bấm Tải xuống lại, hoặc{" "}
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
              mở ở thẻ mới
            </a>{" "}
            để lưu.
          </p>
        ) : null}
        <DialogDescription className={thongTin ? "text-xs leading-4 text-bo-muted [contain:inline-size]" : "sr-only"}>
          {thongTin}
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
