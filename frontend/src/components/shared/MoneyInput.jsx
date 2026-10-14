import { cn } from "@/lib/utils";
import { hienTien, viTriSauChuSo, xuLyNhapTien } from "@/pages/product/components/product/logicBienThe";

/**
 * Ô nhập số tiền luôn hiện dạng 1.250.000 (căn phải, chữ số thẳng cột).
 * - value: số hoặc "" (để trống); onChange nhận lại số hoặc "".
 * - Khi gõ, con trỏ giữ đúng vị trí theo số chữ số đứng trước nó (cùng cách với form Thêm/Sửa sản phẩm).
 */
export default function MoneyInput({ value, onChange, className, ...props }) {
  const handleChange = (e) => {
    const o = e.target;
    const { giaTri, soChuSoTruocConTro } = xuLyNhapTien({
      chuoiMoi: o.value,
      conTro: o.selectionStart,
      kieuNhap: e.nativeEvent?.inputType,
      giaTriCu: value,
    });
    onChange?.(giaTri);
    requestAnimationFrame(() => {
      if (document.activeElement !== o) return;
      const viTri = viTriSauChuSo(hienTien(giaTri), soChuSoTruocConTro);
      o.setSelectionRange(viTri, viTri);
    });
  };

  return (
    <input
      {...props}
      inputMode="numeric"
      autoComplete="off"
      value={hienTien(value)}
      onChange={handleChange}
      className={cn(
        "h-8 w-full rounded-md border border-bo-border bg-white px-2 text-right text-sm tabular-nums text-bo-foreground placeholder:text-bo-muted/70 focus-visible:border-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle disabled:text-bo-muted",
        className,
      )}
    />
  );
}
