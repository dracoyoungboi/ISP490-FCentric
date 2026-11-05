import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import useCoQuyenXuatBaoCao from "@/hooks/useCoQuyenXuatBaoCao";

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

/**
 * Nút "Xuất Excel" của các trang báo cáo. Ẩn khi người dùng không có quyền Xuất báo cáo ở kho làm việc.
 * - taiTep: hàm async trả phản hồi axios (responseType blob) hoặc Blob của tệp (.xlsx) do máy chủ dựng.
 * - tenTep: tên tệp dự phòng (chuỗi, hoặc hàm trả chuỗi lúc bấm) khi phản hồi không có Content-Disposition.
 * - disabled: chưa có số liệu để xuất (đang tải, lỗi).
 * Điện thoại: chỉ hiện biểu tượng, vùng chạm 44px.
 */
export default function NutXuatExcel({ taiTep, tenTep, disabled = false, className }) {
  const coQuyen = useCoQuyenXuatBaoCao();
  const [dangXuat, setDangXuat] = useState(false);
  if (!coQuyen) return null;

  const xuat = async () => {
    if (dangXuat) return;
    setDangXuat(true);
    try {
      const kq = await taiTep();
      const blob = kq instanceof Blob ? kq : kq?.data;
      const ten = tenTuHeader(kq?.headers?.["content-disposition"]) || (typeof tenTep === "function" ? tenTep() : tenTep);
      taiTepVeMay(blob, ten);
    } catch (e) {
      const cau = await cauLoiTaiTep(e);
      toast.error(cau || "Không xuất được tệp Excel. Thử lại.");
    } finally {
      setDangXuat(false);
    }
  };

  const nhan = dangXuat ? "Đang xuất…" : "Xuất Excel";
  return (
    <button
      type="button"
      onClick={xuat}
      disabled={disabled || dangXuat}
      aria-busy={dangXuat}
      title="Tải báo cáo về máy dạng Excel"
      className={cn(
        "relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-bo-input-border bg-bo-surface px-3.5 text-sm font-medium text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
        // Điện thoại: nút vuông chỉ có biểu tượng, vùng chạm 44px vô hình quanh nút
        "max-sm:w-9 max-sm:justify-center max-sm:px-0 max-sm:after:absolute max-sm:after:-inset-1 max-sm:after:content-['']",
        className,
      )}
    >
      <Download className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
      <span className="max-sm:sr-only">{nhan}</span>
    </button>
  );
}
