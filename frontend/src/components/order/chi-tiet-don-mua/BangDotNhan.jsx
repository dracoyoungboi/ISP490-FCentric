import { Link } from "react-router-dom";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { t } from "@/i18n";

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
    return <span className="font-semibold text-bo-danger">{t("Vượt {{vuot}}", { vuot: formatNumber(vuot) })}</span>;
  }
  if (conThieu > 0) {
    return <span className="font-semibold text-bo-warning">{formatNumber(conThieu)}</span>;
  }
  return <span className="font-medium text-bo-success">{t("Đủ")}</span>;
}

/**
 * Số lỗi của đợt nằm ở DÒNG PHỤ dưới số hàng đạt (chữ nhỏ cam), không còn chip đỏ "+1 lỗi" cạnh số —
 * đọc rõ "9 đạt, 1 lỗi" thay vì tưởng "9 cộng thêm 1".
 */
function DongLoi({ soLoi }) {
  if (!(soLoi > 0)) return null;
  return (
    <span
      title={t("{{soLoi}} sản phẩm lỗi ở đợt này, không tính vào số đã nhận. Xem biên bản trả hàng ở phiếu nhập.", { soLoi: formatNumber(soLoi) })}
      className="block whitespace-nowrap text-[11px] font-medium not-italic leading-4 text-bo-warning"
    >
      {t("{{n}} lỗi", { n: formatNumber(soLoi) })}
    </span>
  );
}

/** Nhãn phụ dưới ô Còn thiếu theo việc bù của biên bản trả hàng. */
const NHAN_BU = {
  choChot: t("lỗi chờ nhà cung cấp chọn"),
  choHangBu: t("chờ hàng bù"),
};

const O_DOT = "border-x border-slate-100 bg-bo-surface-subtle";
// Cột Sản phẩm dính trái: rộng tối thiểu để tên không bị bẻ từng chữ khi có nhiều đợt, có vạch ngăn khi cuộn
const COT_DINH = "sticky left-0 z-[1] min-w-[220px] shadow-[1px_0_0_var(--color-bo-border)]";

/**
 * Bảng "Sản phẩm và các đợt nhận" (dữ liệu từ `dungBangDotNhan`): mỗi phiếu nhập là một cột.
 * - Phiếu đã nhập kho: số hàng đạt đã nhập theo lô, dòng phụ "n lỗi" (cam) khi đợt có hàng lỗi. Phiếu đang chờ nhập:
 *   số dự kiến, chữ mờ, không trừ vào Còn thiếu.
 * - Cột "Đã nhận" (tổng hàng đạt các đợt) khi có đợt; cột "Lỗi trừ tiền" (hàng lỗi nhà cung cấp chọn trừ tiền)
 *   chỉ hiện khi đơn có trừ tiền — mỗi dòng: Đặt = Đã nhận + Lỗi trừ tiền + Còn thiếu. Thành tiền theo số đã giảm trừ;
 *   khối tiền dưới bảng: tiền theo số đặt, giảm trừ, phải trả nhà cung cấp (và giá trị hàng đạt khi mới nhận một phần).
 * - `nhanBu`: `{ [bienTheSanPhamId]: "choChot" | "choHangBu" }` từ các biên bản trả hàng của đơn — dòng phụ dưới ô
 *   Còn thiếu ("lỗi chờ nhà cung cấp chọn" / "chờ hàng bù").
 * - Cột Sản phẩm dính bên trái khi bảng cuộn ngang (nhiều đợt nhận).
 * - Tải phiếu lỗi: bảng vẫn hiện từ dữ liệu đơn, kèm dòng báo (lời nhắn của máy chủ nếu có) và nút Thử lại.
 * - `xemDot = false` (vai trò không xem được phiếu nhập): không có cột theo đợt, chỉ số đặt và còn thiếu của đơn.
 * - `loiDot`: `null` khi không lỗi; chuỗi (có thể rỗng) khi lỗi.
 */
export default function BangDotNhan({ bang, tongTien, phaiTra = null, khongGiao = 0, soKhongGiao = 0, nhanBu, xemDot = true, dangTaiDot, loiDot, onThuLai }) {
  const { cot, dong, tong } = bang;
  const coCot = cot.length > 0;
  const coTruTien = tong.truTien > 0;
  const coGiamTru = tong.giamTru > 0;
  // Cột "Đã nhận" (tổng hàng đạt các đợt) khi có đợt, để thấy ngay Đặt = Đã nhận + Lỗi trừ tiền + Còn thiếu
  const coDaNhan = coCot;
  // Sản phẩm, Đơn giá, Đặt, các đợt, [Đã nhận], [Lỗi trừ tiền], Còn thiếu, Thành tiền
  const soCot = 5 + cot.length + (coDaNhan ? 1 : 0) + (coTruTien ? 1 : 0);
  const tongThanhTien = coGiamTru ? tong.thanhTien : tongTien ?? tong.thanhTien;
  // Đơn đóng thiếu: phần không giao không trả (máy chủ tính); khối tiền kể thêm dòng này
  const coKhongGiao = khongGiao > 0;
  const coDieuChinh = coGiamTru || coKhongGiao;
  const soPhaiTra = phaiTra != null ? Number(phaiTra) : tong.thanhTien - khongGiao;

  return (
    <section aria-labelledby="bang-dot-nhan-title" className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-4 sm:px-6">
        <h2 id="bang-dot-nhan-title" className="text-base font-semibold leading-6 text-bo-foreground">
          {t("Sản phẩm và các đợt nhận")}
        </h2>
        <span className="text-[13px] text-bo-muted">
          {!xemDot ? (
            t("Từng đợt nhận chỉ hiện với vai trò kho")
          ) : dangTaiDot ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {t("Đang tải các đợt nhận")}
            </span>
          ) : coCot ? (
            t("Mỗi cột phiếu nhập là một đợt hàng về")
          ) : loiDot != null ? null : (
            t("Chưa có đợt nhận nào")
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
            {t("Không tải được các đợt nhận{{chiTiet}}. Số đặt và còn thiếu bên dưới vẫn đúng.", { chiTiet: loiDot ? `: ${loiDot.replace(/\.$/, "")}` : "" })}
          </span>
          <button type="button" onClick={onThuLai} className="font-medium underline underline-offset-2 hover:no-underline">
            {t("Thử lại")}
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="whitespace-nowrap border-b border-bo-border bg-bo-surface-subtle text-xs font-medium leading-4 text-bo-muted">
              <th scope="col" className={cn(COT_DINH, "bg-bo-surface-subtle py-2.5 pl-4 pr-3 text-left font-medium sm:pl-6")}>
                {t("Sản phẩm")}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("Đơn giá")}</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("Đặt")}</th>
              {cot.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn("min-w-[104px] px-3 py-1.5 text-right font-medium", "border-x border-bo-border bg-slate-100")}
                  title={c.choNhap ? t("Phiếu đang chờ nhập kho: số dự kiến, chưa cộng vào số đã nhận") : c.nguoiNhap ? t("Người nhập: {{nguoiNhap}}", { nguoiNhap: c.nguoiNhap }) : undefined}
                >
                  <Link to={`/goods-receipts/${c.id}`} className="block font-semibold text-bo-primary hover:text-bo-primary-hover hover:underline">
                    {c.soPhieu}
                  </Link>
                  <span className={cn("tabular-nums", c.choNhap ? "italic" : "")}>
                    {c.choNhap ? t("chờ nhập") : ngayNgan(c.ngay) || "—"}
                  </span>
                </th>
              ))}
              {coDaNhan ? (
                <th scope="col" className="px-3 py-2.5 text-right font-medium" title={t("Tổng hàng đạt đã nhập kho của các đợt")}>
                  {t("Đã nhận")}
                </th>
              ) : null}
              {coTruTien ? (
                <th scope="col" className="px-3 py-2.5 text-right font-medium" title={t("Hàng lỗi đã chốt trừ tiền với nhà cung cấp, không giao lại")}>
                  {t("Lỗi trừ tiền")}
                </th>
              ) : null}
              <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("Còn thiếu")}</th>
              <th scope="col" className="py-2.5 pl-3 pr-4 text-right font-medium sm:pr-6">{t("Thành tiền")}</th>
            </tr>
          </thead>
          <tbody>
            {dong.map((d) => (
              <tr key={d.khoa} className="group border-b border-slate-100 tabular-nums hover:bg-bo-surface-subtle">
                <th scope="row" className={cn(COT_DINH, "bg-bo-surface py-3 pl-4 pr-3 text-left font-normal group-hover:bg-bo-surface-subtle sm:pl-6")}>
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
                    {d.theoDot[i] == null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <>
                        {formatNumber(d.theoDot[i])}
                        <DongLoi soLoi={d.theoDotLoi?.[i]} />
                      </>
                    )}
                  </td>
                ))}
                {coDaNhan ? (
                  <td className="px-3 py-3 text-right font-semibold text-bo-foreground">{formatNumber(d.daNhan)}</td>
                ) : null}
                {coTruTien ? (
                  <td className="px-3 py-3 text-right">
                    {d.truTien > 0 ? (
                      <span className="text-bo-foreground">{formatNumber(d.truTien)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                ) : null}
                <td className="px-3 py-3 text-right">
                  <ConThieu conThieu={d.conThieu} vuot={d.vuot} />
                  {d.conThieu > 0 && nhanBu?.[d.bienTheId] ? (
                    <span className="block whitespace-nowrap text-[11px] leading-4 text-bo-muted">{NHAN_BU[nhanBu[d.bienTheId]]}</span>
                  ) : null}
                </td>
                <td className="py-3 pl-3 pr-4 text-right font-medium text-bo-foreground sm:pr-6">
                  {d.thanhTien != null ? formatCurrency(d.thanhTien) : "—"}
                </td>
              </tr>
            ))}
            {dong.length === 0 ? (
              <tr>
                <td colSpan={soCot} className="px-6 py-10 text-center text-sm text-bo-muted">
                  {t("Đơn mua hàng chưa có sản phẩm nào.")}
                </td>
              </tr>
            ) : null}
          </tbody>
          {dong.length > 0 ? (
            <tfoot>
              <tr className="tabular-nums">
                <th scope="row" className={cn(COT_DINH, "bg-bo-surface py-3.5 pl-4 pr-3 text-left font-semibold text-bo-foreground sm:pl-6")}>
                  {t("Tổng")}
                </th>
                <td className="px-3 py-3.5" />
                <td className="px-3 py-3.5 text-right font-semibold text-bo-foreground">{formatNumber(tong.dat)}</td>
                {cot.map((c, i) => (
                  <td key={c.id} className={cn("px-3 py-3.5 text-right font-semibold", O_DOT, c.choNhap ? "italic text-slate-400" : "text-bo-foreground")}>
                    {formatNumber(tong.theoDot[i])}
                    <DongLoi soLoi={tong.theoDotLoi?.[i]} />
                  </td>
                ))}
                {coDaNhan ? (
                  <td className="px-3 py-3.5 text-right font-semibold text-bo-foreground">{formatNumber(tong.daNhan)}</td>
                ) : null}
                {coTruTien ? (
                  <td className="px-3 py-3.5 text-right font-semibold text-bo-foreground">{formatNumber(tong.truTien)}</td>
                ) : null}
                <td className="px-3 py-3.5 text-right">
                  <ConThieu conThieu={tong.conThieu} vuot={tong.conThieu > 0 ? 0 : tong.vuot} />
                </td>
                <td className="py-3.5 pl-3 pr-4 text-right text-base font-bold text-bo-foreground sm:pr-6">
                  {formatCurrency(tongThanhTien)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {/* Khối tiền như hóa đơn: tiền theo số đặt, giảm trừ hàng lỗi, phải trả; giá trị hàng đạt khi mới nhận một phần */}
      {dong.length > 0 && (coDieuChinh || (tong.conThieu > 0 && tong.daNhan > 0)) ? (
        <dl className="ml-auto grid w-full max-w-[380px] grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 px-4 py-3.5 text-[13px] leading-5 tabular-nums sm:px-6">
          {coDieuChinh ? (
            <>
              <dt className="text-bo-muted">{t("Tiền theo số đặt")}</dt>
              <dd className="text-right text-bo-foreground">{formatCurrency(tong.thanhTienTheoDat)}</dd>
              {coGiamTru ? (
                <>
                  <dt className="text-bo-muted">{t("Giảm trừ {{n}} sản phẩm lỗi", { n: formatNumber(tong.truTien) })}</dt>
                  <dd className="text-right text-bo-foreground">−{formatCurrency(tong.giamTru)}</dd>
                </>
              ) : null}
              {coKhongGiao ? (
                <>
                  <dt className="text-bo-muted">{t("Không giao, đã đóng đơn ({{count}} sản phẩm)", { count: soKhongGiao })}</dt>
                  <dd className="text-right text-bo-foreground">−{formatCurrency(khongGiao)}</dd>
                </>
              ) : null}
              <dt className="border-t border-bo-border pt-1.5 font-semibold text-bo-foreground">{t("Phải trả nhà cung cấp")}</dt>
              <dd className="border-t border-bo-border pt-1.5 text-right font-semibold text-bo-foreground">{formatCurrency(soPhaiTra)}</dd>
            </>
          ) : null}
          {/* Đơn đóng thiếu đã kể phần không giao ở trên: không lặp giá trị hàng đạt */}
          {tong.conThieu > 0 && tong.daNhan > 0 && !coKhongGiao ? (
            <>
              <dt className="text-bo-muted">{t("Giá trị hàng đạt đã nhận")}</dt>
              <dd className="text-right text-bo-foreground">{formatCurrency(tong.giaTriDaNhan)}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      <p className="mt-auto flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-[13px] leading-5 text-bo-muted sm:px-6">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        {t("Kế toán thanh toán cho nhà cung cấp ngoài FCentric.")}
      </p>
    </section>
  );
}
