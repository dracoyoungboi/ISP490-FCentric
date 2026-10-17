import { Link } from "react-router-dom";
import { Boxes, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { duongDanKemThamSo } from "@/utils/thamSoDuongDan";
import { Card, LE, MoreLink, StackBar } from "./ui";
import { MAU2 } from "./mau";
import { NHAN_KY, dsKhoDayDu } from "./boLoc";
import { formatPhanTram, formatSo, formatTienNgan, tachTien, tyLe } from "../tong-quan/tongQuanFormat";

const MUC = [
  { key: "hetHang", ten: "Hết hàng", tab: "het-hang" },
  { key: "thieuHang", ten: "Sắp hết hàng", tab: "thieu-hang" },
  { key: "binhThuong", ten: "Bình thường", tab: "binh-thuong" },
  { key: "duHang", ten: "Dư hàng", tab: "du-hang" },
];

/* Bảng Cần bổ sung: thẻ rộng (≥ 860px) 4 cột; hẹp hơn thì tên kho vào dòng phụ để cột Sản phẩm đủ rộng (tên không bị cắt);
   điện thoại (≤ 440px) chỉ còn một cột, khả dụng vào dòng phụ và đề xuất xuống dưới tên. Ô đầu và ô cuối mang lề thẻ.
   Tên dài thì xuống dòng (tối đa 2 dòng), nhãn trạng thái tự xuống theo. */
const O_DAU = "pl-5 pr-4 @max-[520px]:pl-4";
const O_CUOI = "pr-5 @max-[520px]:pr-4";

/**
 * Tồn kho hiện tại: 5 con số (giá trị, khả dụng, giữ cho đơn, đang về, đang chuyển), mức tồn so với ngưỡng
 * (bấm từng mức mở Báo cáo tồn kho đúng tab), cảnh báo hàng dư, danh sách cần bổ sung kèm đề xuất mở sẵn form,
 * và một dòng nhập – xuất của kỳ. Phần không cần làm gì thì không chiếm chỗ: không có mã cần bổ sung thì bỏ hẳn
 * mục đó (chú thích Hết hàng 0 · Sắp hết hàng 0 đã nói), giải thích cách tính để ở chú thích khi rê chuột.
 */
export default function StockFlow({ data, ky, khoId, loading, loiTonKho, loiBoSung, loiNhapXuat, onRetry, className }) {
  const t = data?.tonKho;
  const io = data?.nhapXuat;
  const bs = data?.hangCanBoSung;
  const kho = khoId == null ? "tat-ca" : khoId;
  const theoKho = t?.theoKho ?? [];
  const tongHeThong = theoKho.reduce((s, k) => s + k.giaTri, 0);
  const khoTong = theoKho.filter((k) => k.laKhoTong).reduce((s, k) => s + k.giaTri, 0);
  const gt = tachTien(t?.giaTri ?? 0);

  const so = t
    ? [
        {
          ten: "Giá trị tồn",
          so: gt.so,
          donVi: gt.donVi,
          phu:
            khoId != null
              ? `${formatPhanTram(tyLe(t.giaTri, tongHeThong), 0)} toàn hệ thống`
              : theoKho.some((k) => k.laKhoTong)
                ? `${formatPhanTram(tyLe(khoTong, tongHeThong), 0)} ở Kho tổng`
                : "theo giá vốn lô",
        },
        { ten: "Khả dụng", so: formatSo(t.khaDung), phu: "sản phẩm" },
        { ten: "Giữ cho đơn", so: formatSo(t.dangGiu), phu: "sản phẩm" },
        { ten: "Đang về", so: formatSo(t.dangVe), phu: "từ đơn mua" },
        { ten: "Đang chuyển", so: formatSo(t.dangChuyen), phu: khoId == null ? "giữa các kho" : "đi hoặc đến kho này" },
      ]
    : [];

  return (
    <Card
      className={className}
      title="Tồn kho"
      scope="Hiện tại"
      right={
        <MoreLink to={`/reports/inventory?kho=${kho}`}>
          <span className="@max-[520px]:sr-only">Báo cáo tồn kho</span>
        </MoreLink>
      }
      loading={loading}
      error={loiTonKho}
      onRetry={onRetry}
      empty={t ? t.tonThucTe === 0 && t.soDong === 0 : false}
      emptyIcon={Boxes}
      emptyText="Tồn kho sẽ hiện sau khi xác nhận phiếu nhập đầu tiên."
    >
      {t ? (
        <>
          <dl className="grid grid-cols-5 border-b border-[#eef1f5] @max-[600px]:grid-cols-2">
            {so.map((f, i) => (
              <div
                key={f.ten}
                className={cn(
                  "min-w-0 border-[#eef1f5] px-5 py-3.5 @max-[860px]:px-4",
                  i < 4 && "border-r",
                  // Thẻ hẹp: ô đầu chiếm cả hàng, 4 ô còn lại 2 × 2
                  "@max-[600px]:border-r-0",
                  i === 0 && "@max-[600px]:col-span-2 @max-[600px]:border-b",
                  (i === 1 || i === 3) && "@max-[600px]:border-r",
                  (i === 1 || i === 2) && "@max-[600px]:border-b",
                )}
              >
                <dt className="truncate text-sm text-bo-muted">{f.ten}</dt>
                <dd className="mt-0.5 whitespace-nowrap text-xl font-semibold leading-7 tracking-[-0.01em] text-bo-foreground">
                  {f.so}
                  {f.donVi ? <span className="ml-1 text-sm font-medium tracking-normal text-bo-muted">{f.donVi}</span> : null}
                </dd>
                <dd className="text-pretty text-xs text-bo-muted">{f.phu}</dd>
              </div>
            ))}
          </dl>

          <div className={cn(LE, "border-b border-[#eef1f5] py-4")}>
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h3 className="whitespace-nowrap text-sm font-semibold text-bo-foreground">Mức tồn so với ngưỡng</h3>
              <span
                className="whitespace-nowrap text-xs tabular-nums text-bo-muted"
                title={`Mỗi mã hàng đang kinh doanh tại mỗi kho là một dòng. Ngưỡng là mức tồn tối thiểu của sản phẩm (chưa đặt thì dùng ${formatSo(t.nguongMacDinh)}); dư hàng khi khả dụng vượt ${formatSo(t.heSoDu)} lần ngưỡng.`}
              >
                {formatSo(t.soDong)} mã hàng tại các kho
              </span>
            </div>
            <StackBar
              label={`Mức tồn: ${MUC.map((m) => `${m.ten} ${formatSo(t[m.key])}`).join(", ")}`}
              segments={MUC.map((m) => ({ key: m.key, value: t[m.key], color: MAU2.tinhTrang[m.key] }))}
            />
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {MUC.map((m) => (
                <li key={m.key}>
                  <Link
                    to={`/reports/inventory?kho=${kho}&tinhTrang=${m.tab}`}
                    className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded text-sm text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                  >
                    <i className="inline-block size-2 rounded-[2px]" style={{ background: MAU2.tinhTrang[m.key] }} aria-hidden="true" />
                    <span className="group-hover:underline">{m.ten}</span>
                    <b className="font-semibold tabular-nums">{formatSo(t[m.key])}</b>
                    <span className="tabular-nums text-bo-muted">{formatPhanTram(tyLe(t[m.key], t.soDong), 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {t.giaTriDu > 0 ? (
              <p className="mt-3 text-xs leading-4 text-bo-muted">
                Hàng dư đang giữ <b className="font-semibold text-bo-foreground">{formatTienNgan(t.giaTriDu)}</b>, bằng{" "}
                {formatPhanTram(tyLe(t.giaTriDu, t.giaTri), 0)} giá trị tồn.
                {t.duChamBan > 0 ? ` Trong đó ${formatSo(t.duChamBan)} mã chưa bán được trong ${formatSo(t.soNgayChamBan)} ngày.` : ""}
              </p>
            ) : null}
          </div>

          {loiBoSung || bs?.dong?.length ? <CanBoSung bs={bs} data={data} kho={kho} error={loiBoSung} onRetry={onRetry} /> : null}

          <div className={cn(LE, "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#eef1f5] py-3 text-sm text-bo-muted")}>
            {loiNhapXuat || !io ? (
              <span role={loiNhapXuat ? "alert" : undefined}>{loiNhapXuat ? "Không tải được số liệu nhập – xuất." : ""}</span>
            ) : (
              <span title={io.boChuyenKhoNoiBo ? "Không tính chuyển kho nội bộ giữa các kho" : "Gồm hàng chuyển đến và chuyển đi của kho này"}>
                {NHAN_KY[ky]}: nhập <b className="font-semibold tabular-nums text-bo-foreground">{formatSo(io.tongNhap)}</b> · xuất{" "}
                <span className="whitespace-nowrap">
                  <b className="font-semibold tabular-nums text-bo-foreground">{formatSo(io.tongXuat)}</b> sản phẩm
                </span>
              </span>
            )}
            <MoreLink to="/reports/stock-movements">Nhật ký nhập – xuất</MoreLink>
          </div>
        </>
      ) : null}
    </Card>
  );
}

/** Id Kho tổng trong danh sách kho của Tổng quan; không xác định được thì null (form chuyển kho tự chọn Kho tổng). */
function timKhoTongId(data) {
  const ds = data?.danhSachKho ?? [];
  return ds.find((k) => k.laKhoTong)?.id ?? dsKhoDayDu(data, ds).find((k) => k.laKhoTong)?.id ?? null;
}

/**
 * Đường dẫn mở sẵn form theo đề xuất của một dòng:
 * - chuyển kho: Kho tổng → kho cần hàng, đúng mã hàng, số lượng đề xuất;
 * - yêu cầu nhập: mã hàng, số lượng đề xuất (kho nhận luôn là Kho tổng, trang tự giải thích nếu dòng là kho bán hàng).
 */
function duongDanDeXuat(d, khoTongId) {
  if (d.deXuat === "chuyen_kho") {
    return duongDanKemThamSo("/transfer-tickets/create", {
      khoXuatId: khoTongId,
      khoNhapId: d.khoId,
      bienTheId: d.bienTheId,
      soLuong: d.soLuongDeXuat,
    });
  }
  return duongDanKemThamSo("/purchase-requests/create", {
    khoId: d.khoId,
    bienTheId: d.bienTheId,
    soLuong: d.soLuongDeXuat,
    ten: d.tenSanPham,
  });
}

/** Chỉ hiện khi có mã cần bổ sung hoặc khi tải danh sách lỗi. */
function CanBoSung({ bs, data, kho, error, onRetry }) {
  const rows = bs?.dong ?? [];
  const khoTongId = timKhoTongId(data);
  return (
    <div>
      <div className={cn(LE, "flex items-center gap-2 pb-2.5 pt-3.5")}>
        <h3 className="text-sm font-semibold text-bo-foreground">Cần bổ sung</h3>
        {rows.length ? (
          <MoreLink to={`/reports/inventory?kho=${kho}&tinhTrang=het-hang`} className="ml-auto">
            {bs.tongSo > rows.length ? `Xem tất cả ${formatSo(bs.tongSo)}` : "Xem tất cả"}
          </MoreLink>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className={cn(LE, "pb-4 text-[13px] text-bo-warning")}>
          Không tải được danh sách.{" "}
          <button type="button" onClick={onRetry} className="cursor-pointer font-medium text-bo-primary hover:underline">
            Thử lại
          </button>
        </p>
      ) : (
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Mã hàng cần bổ sung và đề xuất</caption>
          <thead>
            <tr className="border-y border-[#eef1f5] bg-bo-surface-subtle text-left text-xs text-bo-muted">
              <th scope="col" className={cn(O_DAU, "py-2 font-medium")}>Sản phẩm</th>
              <th scope="col" className="w-[26%] py-2 pr-4 font-medium @max-[860px]:hidden">Kho</th>
              <th scope="col" className="w-[88px] py-2 pr-4 text-right font-medium @max-[440px]:hidden">Khả dụng</th>
              <th scope="col" className={cn(O_CUOI, "w-[212px] py-2 text-right font-medium @max-[440px]:hidden")}>Đề xuất</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const chuyen = d.deXuat === "chuyen_kho";
              // "Có thể chuyển" (đã trừ đơn bán đang chờ xuất ở Kho tổng), khác cột Khả dụng; khớp mức tạo phiếu chuyển cho phép
              const daTru = d.choXuatKhoTong > 0 ? ` (đã trừ ${formatSo(d.choXuatKhoTong)} đơn bán đang chờ xuất)` : "";
              const ghiChu = chuyen
                ? `Kho tổng còn ${formatSo(d.khaDungKhoTong)} có thể chuyển${daTru}`
                : d.laKhoTong
                  ? "Kho tổng nhập từ nhà cung cấp"
                  : !bs.coKhoTong
                    ? "Chưa đánh dấu Kho tổng"
                    : `Kho tổng chỉ còn ${formatSo(d.khaDungKhoTong ?? 0)} có thể chuyển${daTru}, không đủ chuyển`;
              const bien = [d.tenMau, d.tenKichCo].filter(Boolean).join(" / ");
              const kd = `${formatSo(d.khaDung)} / ${formatSo(d.nguong)}`;
              const deXuat = (
                <Link
                  to={duongDanDeXuat(d, khoTongId)}
                  title={ghiChu}
                  className="inline-flex max-w-full items-center gap-0.5 rounded text-left font-medium text-bo-primary hover:text-bo-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                >
                  <span className="text-pretty">{chuyen ? `Chuyển ${formatSo(d.soLuongDeXuat)} từ Kho tổng` : `Yêu cầu nhập ${formatSo(d.soLuongDeXuat)}`}</span>
                  <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                </Link>
              );
              return (
                <tr key={`${d.khoId}-${d.bienTheId}`} className="border-b border-[#eef1f5] last:border-b-0 hover:bg-bo-surface-subtle">
                  <td className={cn(O_DAU, "py-2.5 align-middle")}>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5" title={d.tenSanPham}>
                      <span className="line-clamp-2 min-w-0 font-medium text-bo-foreground">{d.tenSanPham}</span>
                      <StatusBadge label={d.khaDung <= 0 ? "Hết hàng" : "Sắp hết hàng"} />
                    </span>
                    <span className="mt-0.5 block text-xs text-bo-muted">
                      {bien}
                      {d.maSku ? <span className="@max-[440px]:hidden">{`${bien ? " · " : ""}${d.maSku}`}</span> : null}
                      <span className="hidden @max-[860px]:inline">{` · ${d.tenKho}`}</span>
                      <span className="hidden whitespace-nowrap @max-[440px]:inline">{` · khả dụng ${kd}`}</span>
                    </span>
                    {/* Điện thoại: cột Đề xuất ẩn, đề xuất xuống dưới tên */}
                    <span className="mt-1 hidden @max-[440px]:block">{deXuat}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-bo-foreground @max-[860px]:hidden">
                    <span className="line-clamp-2" title={d.tenKho}>{d.tenKho}</span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums text-bo-foreground @max-[440px]:hidden">{kd}</td>
                  <td className={cn(O_CUOI, "py-2.5 text-right @max-[440px]:hidden")}>{deXuat}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
