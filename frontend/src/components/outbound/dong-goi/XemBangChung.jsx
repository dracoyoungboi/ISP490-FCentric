import { useRef, useState } from "react";
import { Camera, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dinhGio, dinhNgay, urlCua } from "./dinhDangBangChung";
import { chuThongTinTep } from "./tinhDongGoi";

/*
 * Phần XEM bằng chứng đóng gói, dùng chung cho màn Đóng gói (PackingProofSection, có chụp / quay / xóa) và khối chỉ xem ở
 * chi tiết đơn bán (KhoiBangChungDongGoi): ảnh thu nhỏ, hộp xem lớn (video tua được, ảnh phóng to). Định dạng giờ / ngày ở
 * dinhDangBangChung.js.
 */

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
  return <video src={src} controls autoPlay onLoadedMetadata={khiCoThongTin} className="max-h-[70vh] max-w-full" />;
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
 * Hộp xem lớn một ô bằng chứng (`o`: { ten, laVideo, bangChung } của oBangChung); `o` null là đóng.
 * `onCloseAutoFocus`: nơi gọi tự trả tiêu điểm (vd. ô quét mã) thay cho nút đã mở hộp.
 */
export function HopXemBangChung({ o, onDong, onCloseAutoFocus }) {
  return (
    <Dialog open={Boolean(o)} onOpenChange={(mo) => !mo && onDong()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] border-bo-border bg-white p-4 sm:max-w-3xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle className="pr-6 text-base font-semibold text-bo-heading">{o?.ten}</DialogTitle>
          <DialogDescription className="sr-only">
            {o?.bangChung ? chuThongTinTep(o.bangChung, { dinhGio, dinhNgay }) : ""}
          </DialogDescription>
        </DialogHeader>
        {o?.bangChung ? (
          <div className="grid place-items-center overflow-hidden rounded-md bg-black">
            {o.laVideo ? (
              <XemVideo src={urlCua(o.bangChung)} />
            ) : (
              <img src={urlCua(o.bangChung)} alt={o.ten} className="max-h-[70vh] max-w-full object-contain" />
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
