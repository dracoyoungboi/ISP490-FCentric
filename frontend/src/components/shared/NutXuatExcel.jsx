import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import useCoQuyenXuatBaoCao from "@/hooks/useCoQuyenXuatBaoCao";
import { t } from "@/i18n";

/** Lưu Blob về máy với tên tệp cho sẵn. */
function taiTepVeMay(blob, tenTep) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = tenTep;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lỗi của yêu cầu tải tệp trả về dạng Blob: đọc ra câu báo của máy chủ (không đọc được thì chuỗi rỗng). */
async function cauLoiTaiTep(e) {
  try {
    return JSON.parse(await e?.response?.data?.text?.())?.message ?? "";
  } catch {
    return "";
  }
}

/** Tên tệp trong header Content-Disposition của máy chủ (filename* hoặc filename), không có thì null. */
function tenTuHeader(cd) {
  if (!cd) return null;
  const sao = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (sao) {
    try { return decodeURIComponent(sao[1].trim()); } catch { /* bỏ qua, dùng filename= */ }
  }
  const thuong = /filename="?([^";]+)"?/i.exec(cd);
  return thuong ? thuong[1].trim() : null;
}

/** Biểu tượng tệp Excel: tờ giấy góc gấp, nhãn X xanh lá — nhìn là biết tải ra Excel. */
function BieuTuongExcel({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 2.75h8.2L19.25 7.8V20a1.25 1.25 0 0 1-1.25 1.25H6A1.25 1.25 0 0 1 4.75 20V4A1.25 1.25 0 0 1 6 2.75Z" fill="#fff" stroke="#9fb0c3" strokeWidth="1.5" />
      <path d="M14 2.75V7a1 1 0 0 0 1 1h4.25" stroke="#9fb0c3" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="2" y="10" width="11" height="10" rx="2" fill="#107c41" />
      <path d="m5.2 12.6 4.6 4.8M9.8 12.6l-4.6 4.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Thời gian giữ dấu "Đã tải" trên nút sau khi tải xong. */
const GIU_DA_TAI_MS = 1600;

/**
 * Nút "Xuất Excel" của các trang báo cáo. Ẩn khi người dùng không có quyền Xuất báo cáo ở kho làm việc.
 * - taiTep: hàm async trả phản hồi axios (responseType blob) hoặc Blob của tệp (.xlsx) do máy chủ dựng.
 * - tenTep: tên tệp dự phòng (chuỗi, hoặc hàm trả chuỗi lúc bấm) khi phản hồi không có Content-Disposition.
 * - disabled: chưa có số liệu để xuất (đang tải, lỗi).
 * Kiểu nút phụ trắng viền mảnh, biểu tượng tệp Excel; rê chuột nổi nhẹ. Đang tạo tệp: vòng quay; tải xong: dấu tích
 * "Đã tải" trong chốc lát kèm thông báo tên tệp. Điện thoại: chỉ hiện biểu tượng, vùng chạm 44px vô hình.
 */
export default function NutXuatExcel({ taiTep, tenTep, disabled = false, className }) {
  const coQuyen = useCoQuyenXuatBaoCao();
  // san | dang | xong
  const [trangThai, setTrangThai] = useState("san");
  const hen = useRef(null);
  useEffect(() => () => clearTimeout(hen.current), []);
  if (!coQuyen) return null;

  const dangXuat = trangThai === "dang";
  const xuat = async () => {
    if (dangXuat) return;
    clearTimeout(hen.current);
    setTrangThai("dang");
    try {
      const kq = await taiTep();
      const blob = kq instanceof Blob ? kq : kq?.data;
      const ten = tenTuHeader(kq?.headers?.["content-disposition"]) || (typeof tenTep === "function" ? tenTep() : tenTep);
      taiTepVeMay(blob, ten);
      setTrangThai("xong");
      toast.success(t("Đã tải {{ten}}", { ten }));
      hen.current = setTimeout(() => setTrangThai("san"), GIU_DA_TAI_MS);
    } catch (e) {
      setTrangThai("san");
      const cau = await cauLoiTaiTep(e);
      toast.error(cau || t("Không xuất được tệp Excel. Thử lại."));
    }
  };

  const nhan = dangXuat ? t("Đang xuất…") : trangThai === "xong" ? t("Đã tải") : t("Xuất Excel");
  return (
    <button
      type="button"
      onClick={xuat}
      disabled={disabled || dangXuat}
      aria-busy={dangXuat}
      title={t("Tải báo cáo về máy dạng Excel")}
      className={cn(
        // Cùng khung với nút đầu trang khác (Button mặc định: cao 36px, lề ngang 12px, bo 6px)
        "relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground",
        // Nổi nhẹ: bóng mảnh + viền đáy chìm; rê chuột viền đậm hơn, bóng sâu hơn; nhấn thì lún xuống
        "shadow-[0_1px_2px_rgba(16,24,40,0.06),inset_0_-1px_0_rgba(16,24,40,0.04)] transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
        "hover:enabled:border-[#b6c3d3] hover:enabled:bg-[#fbfcfe] hover:enabled:shadow-[0_2px_4px_rgba(16,24,40,0.08)] active:enabled:shadow-[inset_0_1px_2px_rgba(16,24,40,0.08)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
        // Điện thoại: nút vuông chỉ có biểu tượng, vùng chạm 44px vô hình quanh nút
        "max-sm:w-9 max-sm:justify-center max-sm:px-0 max-sm:after:absolute max-sm:after:-inset-1 max-sm:after:content-['']",
        className,
      )}
    >
      {dangXuat ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-bo-muted motion-reduce:animate-none" aria-hidden="true" />
      ) : trangThai === "xong" ? (
        <Check className="size-4 shrink-0 text-bo-success" strokeWidth={2.4} aria-hidden="true" />
      ) : (
        // Hình tệp chỉ chiếm phần dưới khung vẽ nên vẽ 18px để cân với chữ (biểu tượng khác vẫn 16px)
        <BieuTuongExcel className="size-[18px] shrink-0" />
      )}
      <span className="max-sm:sr-only">{nhan}</span>
    </button>
  );
}
