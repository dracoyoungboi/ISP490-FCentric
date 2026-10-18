import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nhanCapNhat, thoiDiemDayDu } from "@/lib/tinhTaiLai";
import { cn } from "@/lib/utils";

/**
 * "Cập nhật lúc HH:mm" + nút ⟳ ở chân bảng (PA1). Nhận thẳng kết quả của useTaiLaiDanhSach.
 * Đang tải: icon xoay, nút khóa. Tải lại lỗi: chữ đỏ "Không tải lại được", nút ⟳ thành "Thử lại".
 * Khóa bằng aria-disabled (không dùng disabled) để người dùng bàn phím không bị mất focus khi vừa bấm.
 */
export default function CapNhatLuc({ thoiDiem, dangTai, loi, taiLai, className }) {
  const nhan = dangTai ? "Đang tải…" : loi ? "Không tải lại được" : nhanCapNhat(thoiDiem);
  const tenNut = loi && !dangTai ? "Thử lại" : "Tải lại danh sách";

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <span
        role="status"
        title={loi || dangTai ? undefined : thoiDiemDayDu(thoiDiem) || undefined}
        className={cn("whitespace-nowrap text-xs tabular-nums", loi && !dangTai ? "text-bo-danger" : "text-bo-muted")}
      >
        {nhan}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          if (!dangTai) taiLai();
        }}
        aria-disabled={dangTai}
        aria-label={tenNut}
        title={tenNut}
        className="size-8 text-bo-muted hover:bg-slate-100 hover:text-bo-foreground aria-disabled:cursor-default"
      >
        <RefreshCw className={cn("size-3.5", dangTai && "animate-spin")} aria-hidden="true" />
      </Button>
    </span>
  );
}
