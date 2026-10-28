import { Link } from "react-router-dom";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/formatters";

const pad2 = (n) => String(n).padStart(2, "0");

function ngayNgan(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/** Ô "Còn thiếu": còn thiếu (cam), đủ (xanh lá), hoặc nhận vượt số đặt (đỏ, dữ liệu bất thường). */
function ConThieu({ conThieu, vuot }) {
  if (vuot > 0) {
    return <span className="font-semibold text-bo-danger">Vượt {formatNumber(vuot)}</span>;
  }
  if (conThieu > 0) {
    return <span className="font-semibold text-bo-warning">{formatNumber(conThieu)}</span>;
  }
  return <span className="font-medium text-bo-success">Đủ</span>;
}

const O_DOT = "border-x border-slate-100 bg-bo-surface-subtle";
// Cột Sản phẩm dính trái: rộng tối thiểu để tên không bị bẻ từng chữ khi có nhiều đợt, có vạch ngăn khi cuộn
const COT_DINH = "sticky left-0 z-[1] min-w-[220px] shadow-[1px_0_0_var(--color-bo-border)]";

/**
 * Bảng "Sản phẩm và các đợt nhận" (dữ liệu từ `dungBangDotNhan`): mỗi phiếu nhập là một cột.
 * - Phiếu đã nhập kho: số đã nhập theo lô. Phiếu đang chờ nhập: số dự kiến, chữ mờ, không trừ vào Còn thiếu.
 * - Cột Sản phẩm dính bên trái khi bảng cuộn ngang (nhiều đợt nhận).
 * - Tải phiếu lỗi: bảng vẫn hiện từ dữ liệu đơn, kèm dòng báo (lời nhắn của máy chủ nếu có) và nút Thử lại.
 * - `xemDot = false` (vai trò không xem được phiếu nhập): không có cột theo đợt, chỉ số đặt và còn thiếu của đơn.
 * - `loiDot`: `null` khi không lỗi; chuỗi (có thể rỗng) khi lỗi.
 */
export default function BangDotNhan({ bang, tongTien, xemDot = true, dangTaiDot, loiDot, onThuLai }) {
  const { cot, dong, tong } = bang;
  const coCot = cot.length > 0;

  return (
    <section aria-labelledby="bang-dot-nhan-title" className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
        <h2 id="bang-dot-nhan-title" className="text-base font-semibold leading-6 text-bo-foreground">
          Sản phẩm và các đợt nhận
        </h2>
        <span className="text-[13px] text-bo-muted">
          {!xemDot ? (
            "Từng đợt nhận chỉ hiện với vai trò kho"
          ) : dangTaiDot ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Đang tải các đợt nhận
            </span>
          ) : coCot ? (
            "Mỗi cột phiếu nhập là một đợt hàng về"
          ) : loiDot != null ? null : (
            "Chưa có đợt nhận nào"
          )}
        </span>
      </div>

      {xemDot && loiDot != null ? (
        <div
          role="alert"
          className="mx-4 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2 text-sm text-bo-danger sm:mx-6"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            Không tải được các đợt nhận{loiDot ? `: ${loiDot.replace(/\.$/, "")}` : ""}. Số đặt và còn thiếu bên dưới vẫn đúng.
          </span>
          <button type="button" onClick={onThuLai} className="font-medium underline underline-offset-2 hover:no-underline">
            Thử lại
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="whitespace-nowrap border-b border-bo-border bg-bo-surface-subtle text-xs font-medium leading-4 text-bo-muted">
              <th scope="col" className={cn(COT_DINH, "bg-bo-surface-subtle py-2.5 pl-4 pr-3 text-left font-medium sm:pl-6")}>
                Sản phẩm
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Đơn giá</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Đặt</th>
              {cot.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn("min-w-[104px] px-3 py-1.5 text-right font-medium", "border-x border-bo-border bg-slate-100")}
                  title={c.choNhap ? "Phiếu đang chờ nhập kho: số dự kiến, chưa cộng vào số đã nhận" : c.nguoiNhap ? `Người nhập: ${c.nguoiNhap}` : undefined}
                >
                  <Link to={`/goods-receipts/${c.id}`} className="block font-semibold text-bo-primary hover:text-bo-primary-hover hover:underline">
                    {c.soPhieu}
                  </Link>
                  <span className={cn("tabular-nums", c.choNhap ? "italic" : "")}>
                    {c.choNhap ? "chờ nhập" : ngayNgan(c.ngay) || "—"}
                  </span>
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Còn thiếu</th>
              <th scope="col" className="py-2.5 pl-3 pr-4 text-right font-medium sm:pr-6">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {dong.map((d) => (
              <tr key={d.khoa} className="group border-b border-slate-100 tabular-nums hover:bg-bo-surface-subtle">
                <th scope="row" className={cn(COT_DINH, "bg-white py-3 pl-4 pr-3 text-left font-normal group-hover:bg-bo-surface-subtle sm:pl-6")}>
                  <div className="font-medium text-bo-foreground">{d.ten}</div>
                  <div className="mt-0.5 text-xs leading-4 text-bo-muted">
                    {d.tenMau || d.kichCo ? (
                      <>
                        <MauKichCo dong={d} className="max-w-full align-bottom" />
                        {d.sku ? " · " : null}
                      </>
                    ) : null}
                    {d.sku ? <span className="whitespace-nowrap font-mono">{d.sku}</span> : null}
                  </div>
                </th>
                <td className="px-3 py-3 text-right text-slate-600">{d.donGia != null ? formatCurrency(d.donGia) : "—"}</td>
                <td className="px-3 py-3 text-right text-bo-foreground">{formatNumber(d.dat)}</td>
                {cot.map((c, i) => (
                  <td key={c.id} className={cn("px-3 py-3 text-right", O_DOT, c.choNhap ? "italic text-slate-400" : "text-bo-foreground")}>
                    {d.theoDot[i] == null ? <span className="text-slate-300">—</span> : formatNumber(d.theoDot[i])}
                  </td>
                ))}
                <td className="px-3 py-3 text-right">
                  <ConThieu conThieu={d.conThieu} vuot={d.vuot} />
                </td>
                <td className="py-3 pl-3 pr-4 text-right font-medium text-bo-foreground sm:pr-6">
                  {d.thanhTien != null ? formatCurrency(d.thanhTien) : "—"}
                </td>
              </tr>
            ))}
            {dong.length === 0 ? (
              <tr>
                <td colSpan={5 + cot.length} className="px-6 py-10 text-center text-sm text-bo-muted">
                  Đơn mua hàng chưa có sản phẩm nào.
                </td>
              </tr>
            ) : null}
          </tbody>
          {dong.length > 0 ? (
            <tfoot>
              <tr className="tabular-nums">
                <th scope="row" className={cn(COT_DINH, "bg-white py-3.5 pl-4 pr-3 text-left font-semibold text-bo-foreground sm:pl-6")}>
                  Tổng
                </th>
                <td className="px-3 py-3.5" />
                <td className="px-3 py-3.5 text-right font-semibold text-bo-foreground">{formatNumber(tong.dat)}</td>
                {cot.map((c, i) => (
                  <td key={c.id} className={cn("px-3 py-3.5 text-right font-semibold", O_DOT, c.choNhap ? "italic text-slate-400" : "text-bo-foreground")}>
                    {formatNumber(tong.theoDot[i])}
                  </td>
                ))}
                <td className="px-3 py-3.5 text-right">
                  <ConThieu conThieu={tong.conThieu} vuot={tong.conThieu > 0 ? 0 : tong.vuot} />
                </td>
                <td className="py-3.5 pl-3 pr-4 text-right text-base font-bold text-bo-foreground sm:pr-6">
                  {formatCurrency(tongTien ?? tong.thanhTien)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <p className="mt-auto flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-[13px] leading-5 text-bo-muted sm:px-6">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        Kế toán thanh toán cho nhà cung cấp ngoài FCentric.
      </p>
    </section>
  );
}
