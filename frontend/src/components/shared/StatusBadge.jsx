import { cn } from "@/lib/utils";
import { NHOM_TRANG_THAI, layNhomTrangThai, nhomCuaNhan } from "@/constants/trangThai";

/**
 * Thẻ trạng thái kiểu R8 (lozenge): ô bo 3px, chữ 12px đậm 600, viết thường như câu; nền nhạt, chữ đậm cùng màu;
 * không viền, không chấm, không icon. Màu tra theo TÊN nhãn ở constants/trangThai.js để một nhãn một màu ở mọi màn.
 *
 * - `nhom`: ép nhóm màu (cho, dang, canChuY, xong, dong, loi, thuong). Thường không cần truyền.
 * - `tone`: chỉ dùng cho giá trị không phải trạng thái (vd. tỷ lệ %), khi nhãn không có trong bảng.
 * - `size`: "md" (20px, trong bảng) hoặc "lg" (24px, đầu trang chi tiết).
 * Nhóm `thuong` ("Còn hàng", "Bình thường"…) hiện chữ xám thường, không thẻ.
 */
const KICH_THUOC = {
  md: "h-5 px-1 text-xs leading-4",
  lg: "h-6 px-1.5 text-[13px] leading-4",
};

const CHU_THUONG = {
  md: "text-[13px] leading-5",
  lg: "text-sm leading-6",
};

export default function StatusBadge({ label, nhom, tone, size = "md", className }) {
  const nhomMau = layNhomTrangThai(label, { nhom, tone });

  if (import.meta.env?.DEV && typeof label === "string" && !nhom && !tone && !nhomCuaNhan(label)) {
    console.warn(`[StatusBadge] Nhãn "${label}" chưa có trong constants/trangThai.js — đang tô Xám.`);
  }

  if (nhomMau === "thuong") {
    return (
      <span className={cn("inline-flex items-center whitespace-nowrap text-bo-muted", CHU_THUONG[size] ?? CHU_THUONG.md, className)}>
        {label}
      </span>
    );
  }

  return (
    <span
      data-nhom={nhomMau}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-[3px] font-semibold",
        KICH_THUOC[size] ?? KICH_THUOC.md,
        NHOM_TRANG_THAI[nhomMau].lop,
        className,
      )}
    >
      {label}
    </span>
  );
}
