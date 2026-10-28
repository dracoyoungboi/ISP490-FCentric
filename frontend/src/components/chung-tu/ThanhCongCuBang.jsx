import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/shared/SearchInput";
import { cn } from "@/lib/utils";

/**
 * Thanh công cụ của bảng hàng (chứng từ quá NGUONG_CONG_CU dòng): ô tìm (SearchInput), chữ "Tìm thấy …",
 * chỗ đặt bộ lọc nhanh (`boLoc`), chỗ đặt nút đổi cách xem (`nutXem`) và nút "Mở tất cả / Thu gọn tất cả".
 *
 * - `onDoiTuKhoa(chu)` nhận chuỗi (không phải sự kiện). `onXoaTuKhoa`: nút × trong ô tìm.
 * - `ketQua`: chữ kết quả (useBangChungTu → chuKetQua), đọc tự động bằng trình đọc màn hình. `khongKetQua`: chữ chỉ
 *   còn cho trình đọc màn hình vì dòng KhongKetQua dưới bảng đã nói (mỗi thông tin một chỗ).
 * - `onDoiMoHet` có thì hiện nút; `moHet`: mọi nhóm đang mở → nút ghi "Thu gọn tất cả".
 * - `propsTim`: props thêm cho ô tìm (vd. onKeyDown khi quét bằng máy quét vào ô tìm).
 */
export default function ThanhCongCuBang({
  tuKhoa,
  onDoiTuKhoa,
  onXoaTuKhoa,
  goiYTim = "Tìm theo tên, SKU, màu hoặc kích cỡ",
  nhanTim = "Tìm trong chứng từ",
  ketQua,
  khongKetQua = false,
  boLoc,
  nutXem,
  moHet = false,
  onDoiMoHet,
  propsTim,
  className,
}) {
  const coNhomPhai = Boolean(boLoc || nutXem || onDoiMoHet);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 sm:px-6", className)}>
      <SearchInput
        value={tuKhoa ?? ""}
        onChange={(suKien) => onDoiTuKhoa?.(suKien.target.value)}
        onClear={onXoaTuKhoa}
        placeholder={goiYTim}
        label={nhanTim}
        className="min-w-[220px] flex-1 sm:max-w-sm"
        {...propsTim}
      />
      <span
        role="status"
        aria-live="polite"
        className={cn("text-[13px] leading-5 text-bo-muted tabular-nums", (!ketQua || khongKetQua) && "sr-only")}
      >
        {ketQua || ""}
      </span>
      {coNhomPhai ? (
        // Nhóm bên phải: hết chỗ thì cả nhóm xuống hàng dưới, vẫn canh phải (điện thoại: canh trái). Không rộng quá khối
        // (min-w-0 max-w-full) để ô lọc nhiều lựa chọn (vd. Kiểm kê) cuộn ngang được thay vì bị khối cắt mất
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
          {boLoc}
          {nutXem}
          {onDoiMoHet ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDoiMoHet}
              className="h-8 gap-1.5 border-bo-border bg-bo-surface px-2.5 text-[13px] font-medium text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
            >
              {moHet ? (
                <ChevronsDownUp className="size-3.5" aria-hidden="true" />
              ) : (
                <ChevronsUpDown className="size-3.5" aria-hidden="true" />
              )}
              {moHet ? "Thu gọn tất cả" : "Mở tất cả"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
