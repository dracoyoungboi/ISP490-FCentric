import { cn } from "@/lib/utils";
import { KHONG_MAU_KICH_CO, nhanMauKichCo } from "./bangChungTu.js";

const MA_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Màu và kích cỡ của biến thể: chấm màu (`maMauHex`) + "Màu / Kích cỡ". Thiếu cả hai → "Không có màu, kích cỡ" (chữ mờ).
 * Nhận từng trường (`tenMau`, `maMauHex`, `kichCo`) hoặc cả dòng chứng từ (`dong`). Có tên màu mà thiếu mã màu: chấm xám.
 */
export default function MauKichCo({ dong, tenMau, maMauHex, kichCo, className }) {
  const mau = tenMau ?? dong?.tenMau;
  const hex = maMauHex ?? dong?.maMauHex;
  const nhan = nhanMauKichCo({ tenMau: mau, kichCo: kichCo ?? dong?.kichCo });
  const coMau = Boolean(String(mau ?? "").trim());

  if (nhan === KHONG_MAU_KICH_CO) {
    return <span className={cn("whitespace-nowrap text-bo-muted", className)}>{nhan}</span>;
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap", className)}>
      {coMau ? (
        <span
          aria-hidden="true"
          className="inline-block size-2.5 shrink-0 rounded-full border border-slate-900/20 bg-slate-200"
          // data-viz: màu động theo maMauHex
          style={MA_HEX.test(String(hex ?? "")) ? { backgroundColor: hex } : undefined}
        />
      ) : null}
      <span className="min-w-0 truncate">{nhan}</span>
    </span>
  );
}
