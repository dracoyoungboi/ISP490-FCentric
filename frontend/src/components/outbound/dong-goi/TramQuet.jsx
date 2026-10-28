import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CircleCheckBig, Loader2, ScanBarcode, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";

/**
 * Trạm quét của màn Đóng gói: ô mã (máy quét gõ mã rồi Enter), ô số lượng mỗi lần quét, nút Ghi nhận; Enter xóa ô mã
 * NGAY (mã vào hàng đợi useScanQueue của màn, gửi lần lượt) nên quét liên tục được. Dưới ô: "Đang ghi nhận n mã…" khi
 * còn mã chờ, phản hồi của lần quét gần nhất (câu máy chủ nguyên văn + câu phụ), chưa quét lần nào thì câu hướng dẫn.
 *
 * - `onQuet(ma, soLuong)`: màn xếp mã vào hàng đợi (mã rỗng: màn báo "Chưa có mã để ghi nhận").
 * - `dangCho`: số mã đang chờ ghi nhận. `phanHoi`: `{ ok, chu, phu }` hoặc null.
 * - `ref`: phần tử ô mã (màn trả tiêu điểm về đây sau khi chụp bằng chứng, đóng hộp thoại — máy quét gõ tiếp vào ô).
 */
const TramQuet = forwardRef(function TramQuet({ onQuet, dangCho = 0, phanHoi = null }, ref) {
  const oMaRef = useRef(null);
  useImperativeHandle(ref, () => oMaRef.current, []);
  const [ma, setMa] = useState("");
  const [soLuong, setSoLuong] = useState("1");

  useEffect(() => {
    oMaRef.current?.focus();
  }, []);

  const ghiNhan = () => {
    const sl = Math.max(1, Number.parseInt(soLuong, 10) || 1);
    onQuet?.(ma.trim(), sl);
    setMa("");
    oMaRef.current?.focus();
  };
  const bamPhim = (suKien) => {
    if (suKien.key === "Enter") {
      suKien.preventDefault();
      ghiNhan();
    }
  };

  return (
    <div role="group" aria-label="Quét mã vạch đóng gói" className="mx-4 mt-4 grid gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 sm:mx-6 sm:p-4">
      <div className="flex flex-wrap items-stretch gap-2">
        <label className="relative block min-w-0 flex-[1_1_260px]">
          <span className="sr-only">Mã vạch hoặc SKU</span>
          <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-bo-primary" aria-hidden="true" />
          <input
            ref={oMaRef}
            type="text"
            value={ma}
            onChange={(suKien) => setMa(suKien.target.value)}
            onKeyDown={bamPhim}
            placeholder="Quét mã vạch hoặc nhập SKU rồi nhấn Enter"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-lg border-[1.5px] border-bo-primary bg-bo-surface pl-10 pr-3 font-mono text-[15px] text-bo-foreground outline-none ring-[3px] ring-bo-primary/12 placeholder:font-sans placeholder:text-sm placeholder:text-bo-muted"
          />
        </label>
        <label className="grid grid-cols-[auto_72px] items-center gap-2 text-[13px] text-bo-muted">
          <span>Số lượng</span>
          <input
            type="text"
            inputMode="numeric"
            value={soLuong}
            onChange={(suKien) => setSoLuong(suKien.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={bamPhim}
            aria-label="Số lượng mỗi lần quét"
            className="h-11 w-full rounded-lg border border-bo-input-border bg-bo-surface text-center text-[15px] tabular-nums text-bo-foreground outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15"
          />
        </label>
        <Button type="button" onClick={ghiNhan} className="h-11 bg-bo-primary px-5 text-white hover:bg-bo-primary-hover max-sm:flex-1">
          Ghi nhận
        </Button>
      </div>
      {dangCho > 0 ? (
        <span role="status" className="inline-flex items-center gap-1.5 text-xs leading-4 text-bo-muted">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Đang ghi nhận {soVN(dangCho)} mã…
        </span>
      ) : null}
      {phanHoi ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm leading-5",
            phanHoi.ok ? "border-green-200 bg-bo-success-soft text-green-900" : "border-red-200 bg-bo-danger-soft text-red-900",
          )}
        >
          {phanHoi.ok ? (
            <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-bo-success" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-bo-danger" aria-hidden="true" />
          )}
          <span className="min-w-0">
            <span className="block font-semibold">{phanHoi.chu}</span>
            {phanHoi.phu ? <span className="block text-xs opacity-80">{phanHoi.phu}</span> : null}
          </span>
        </div>
      ) : (
        <p className="m-0 text-xs leading-4 text-bo-muted">
          Máy quét tự gõ mã và Enter; quét liên tục được, các mã xếp hàng chờ ghi nhận. Mỗi lần quét cộng số lượng ở ô bên cạnh (mặc định 1).
        </p>
      )}
    </div>
  );
});

export default TramQuet;
