import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

const CO = {
  md: { khung: "size-9", icon: "size-[18px]" },
  sm: { khung: "size-7", icon: "size-4" },
};

/**
 * Ảnh nhỏ của biến thể / sản phẩm trong bảng chứng từ: 36px (`co="md"`) hoặc 28px (`co="sm"`).
 * Đường dẫn lấy như màn cũ: `src`, hoặc `bienThe.anhBienThe.tepTin.duongDan`. Không có ảnh hay ảnh lỗi → biểu tượng hộp.
 * Ảnh chỉ để nhìn (tên sản phẩm luôn nằm ngay cạnh) nên không có chữ thay thế.
 */
export default function AnhBienThe({ src, bienThe, co = "md", className }) {
  const kichThuoc = CO[co] ?? CO.md;
  const duongDan = src || bienThe?.anhBienThe?.tepTin?.duongDan || null;
  // Nhớ đường dẫn đã lỗi: đổi sang ảnh khác thì thử tải lại (không cần effect)
  const [loiCua, setLoiCua] = useState(null);
  const hienAnh = Boolean(duongDan) && loiCua !== duongDan;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-100",
        kichThuoc.khung,
        className,
      )}
    >
      {hienAnh ? (
        <img
          src={duongDan}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setLoiCua(duongDan)}
          className="size-full object-cover"
        />
      ) : (
        <Package className={cn("text-slate-400", kichThuoc.icon)} aria-hidden="true" />
      )}
    </span>
  );
}
