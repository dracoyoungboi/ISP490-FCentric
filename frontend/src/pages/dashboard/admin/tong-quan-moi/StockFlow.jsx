import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, ChevronDown, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { duongDanKemThamSo } from "@/utils/thamSoDuongDan";
import { Card, LE, MoreLink, StackBar } from "./ui";
import { MAU2 } from "./mau";
import { dsKhoDayDu } from "./boLoc";
import DauTichDong from "./DauTichDong";
import { formatPhanTram, formatSo, formatTienNgan, tachTien, tyLe } from "../tong-quan/tongQuanFormat";
import { demMaNhom, khaDungNhom, nhomCanBoSung, tomTatBienThe } from "../tong-quan/canBoSung";

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
const LINK =
  "inline-flex max-w-full items-center gap-0.5 rounded text-left font-medium text-bo-primary hover:text-bo-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30";

/**
 * Tồn kho hiện tại (PA A, chốt 29/10/2026): 4 con số (giá trị, khả dụng đã trừ hàng giữ cho đơn, đang về, đang chuyển),
 * mức tồn so với ngưỡng (bấm từng mức mở Báo cáo tồn kho đúng tab), cảnh báo hàng dư, và tối đa 3 nhóm cần bổ sung gom
 * theo sản phẩm tại từng kho (mở nhóm thấy từng mã kèm đề xuất). "Xem tất cả" mở tab Cần bổ sung của Báo cáo tồn kho.
 * Số nhập – xuất của kỳ nằm ở chân thẻ Hoạt động gần đây để thẻ này chỉ chứa số hiện tại.
 */
export default function StockFlow({ data, khoId, loading, loiTonKho, loiBoSung, onRetry, className }) {
  const t = data?.tonKho;
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
        // Giữ cho đơn không còn ô riêng: khả dụng đã trừ phần đó, ghi ở dòng phụ
        {
          ten: "Khả dụng",
          so: formatSo(t.khaDung),
          phu: t.dangGiu > 0 ? `đã trừ ${formatSo(t.dangGiu)} giữ cho đơn` : "sản phẩm",
          chu: `Tồn thực tế ${formatSo(t.tonThucTe)} − đang giữ cho đơn ${formatSo(t.dangGiu)}`,
        },
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
          <dl className="grid grid-cols-4 border-b border-[#eef1f5] @max-[600px]:grid-cols-2">
            {so.map((f, i) => (
              <div
                key={f.ten}
                title={f.chu}
                className={cn(
                  "min-w-0 border-[#eef1f5] px-5 py-3.5 @max-[860px]:px-4",
                  i < 3 && "border-r",
                  // Thẻ hẹp: 2 × 2
                  "@max-[600px]:border-r-0",
                  i % 2 === 0 && "@max-[600px]:border-r",
                  i < 2 && "@max-[600px]:border-b",
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

          <CanBoSung bs={bs} data={data} kho={kho} error={loiBoSung} onRetry={onRetry} />
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
 * Đường dẫn mở sẵn form theo đề xuất của một mã:
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

/** Nút đề xuất của một mã; chú thích ghi số Kho tổng có thể chuyển (đã trừ đơn bán chờ xuất) như bảng cũ. */
function DeXuat({ d, coKhoTong, khoTongId }) {
  const chuyen = d.deXuat === "chuyen_kho";
  const daTru = d.choXuatKhoTong > 0 ? ` (đã trừ ${formatSo(d.choXuatKhoTong)} đơn bán đang chờ xuất)` : "";
  const ghiChu = chuyen
    ? `Kho tổng còn ${formatSo(d.khaDungKhoTong)} có thể chuyển${daTru}`
    : d.laKhoTong
      ? "Kho tổng nhập từ nhà cung cấp"
      : !coKhoTong
        ? "Chưa đánh dấu Kho tổng"
        : `Kho tổng chỉ còn ${formatSo(d.khaDungKhoTong ?? 0)} có thể chuyển${daTru}, không đủ chuyển`;
  return (
    <Link to={duongDanDeXuat(d, khoTongId)} title={ghiChu} className={LINK}>
      <span className="text-pretty">{chuyen ? `Chuyển ${formatSo(d.soLuongDeXuat)} từ Kho tổng` : `Yêu cầu nhập ${formatSo(d.soLuongDeXuat)}`}</span>
      <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );
}

/** Nhãn trạng thái của nhóm: một nhãn; nhóm lẫn hai mức thì hai nhãn. */
function NhanNhom({ n }) {
  return (
    <>
      {n.soHet > 0 ? <StatusBadge label="Hết hàng" /> : null}
      {n.soSapHet > 0 ? <StatusBadge label="Sắp hết hàng" /> : null}
    </>
  );
}

/**
 * Cần bổ sung: tối đa 3 nhóm (sản phẩm, kho) tệ nhất do máy chủ chọn, mỗi nhóm đủ các mã. Nhóm một mã giữ nút đề xuất
 * như bảng cũ; nhóm nhiều mã ghi tóm tắt màu – cỡ và mở ra từng mã. Không có mã nào thì một dòng xác nhận.
 */
function CanBoSung({ bs, data, kho, error, onRetry }) {
  const [mo, setMo] = useState(() => new Set());
  const idGoc = useId();
  // Máy chủ trả tối đa 3 nhóm, mỗi nhóm có ít nhất một mã; máy chủ cũ gom từ danh sách phẳng nên cắt lại cho chắc
  const nhom = nhomCanBoSung(bs).filter((n) => n.dong?.length).slice(0, 3);
  const tongSo = bs?.tongSo ?? 0;
  const khoTongId = timKhoTongId(data);
  const coKhoTong = bs?.coKhoTong ?? khoTongId != null;
  const doiMo = (khoa) =>
    setMo((cu) => {
      const moi = new Set(cu);
      if (moi.has(khoa)) moi.delete(khoa);
      else moi.add(khoa);
      return moi;
    });

  return (
    <div>
      <div className={cn(LE, "flex items-center gap-2 pb-2.5 pt-3.5")}>
        <h3 className="text-sm font-semibold text-bo-foreground">Cần bổ sung</h3>
        {tongSo > 0 ? (
          <MoreLink to={`/reports/inventory?kho=${kho}&tinhTrang=can-bo-sung`} className="ml-auto">
            {`Xem tất cả ${formatSo(tongSo)}`}
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
      ) : nhom.length === 0 ? (
        // Còn mã cần bổ sung mà không có nhóm để hiện (hiếm): chỉ để liên kết Xem tất cả, không báo "không có mã nào"
        tongSo > 0 ? null : (
          <div className={cn(LE, "flex items-center gap-3 pb-4")}>
            <DauTichDong key={data?.thoiDiem} className="size-9" />
            <div>
              <p className="text-sm font-medium text-bo-foreground">Không có mã nào hết hoặc sắp hết hàng</p>
              <p className="text-xs text-bo-muted">Mã chạm ngưỡng tối thiểu sẽ hiện ở đây.</p>
            </div>
          </div>
        )
      ) : (
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Mã hàng cần bổ sung, gom theo sản phẩm tại từng kho, kèm đề xuất</caption>
          {/* Điện thoại chỉ còn một cột: bỏ dòng tiêu đề cột như bản thiết kế */}
          <thead className="@max-[440px]:hidden">
            <tr className="border-y border-[#eef1f5] bg-bo-surface-subtle text-left text-xs text-bo-muted">
              <th scope="col" className={cn(O_DAU, "py-2 font-medium")}>Sản phẩm</th>
              <th scope="col" className="w-[26%] py-2 pr-4 font-medium @max-[860px]:hidden">Kho</th>
              <th scope="col" className="w-[88px] py-2 pr-4 text-right font-medium @max-[440px]:hidden">Khả dụng</th>
              <th scope="col" className={cn(O_CUOI, "w-[212px] py-2 text-right font-medium @max-[440px]:hidden")}>Đề xuất</th>
            </tr>
          </thead>
          {nhom.map((n, i) => {
            const khoa = `${n.khoId}-${n.sanPhamId ?? n.tenSanPham}`;
            return (
              <Nhom
                key={khoa}
                n={n}
                mo={mo.has(khoa)}
                onDoi={() => doiMo(khoa)}
                idMa={`${idGoc}-${i}`}
                coKhoTong={coKhoTong}
                khoTongId={khoTongId}
              />
            );
          })}
        </table>
      )}
    </div>
  );
}

function Nhom({ n, mo, onDoi, idMa, coKhoTong, khoTongId }) {
  const ds = n.dong ?? [];
  const nhieu = ds.length > 1;
  const d0 = ds[0];
  const kd = khaDungNhom(ds);
  const soKd = `${formatSo(kd.khaDung)} / ${formatSo(kd.nguong)}`;
  const nutMo = (
    <button
      type="button"
      onClick={onDoi}
      aria-expanded={mo}
      aria-controls={idMa}
      className={cn(LINK, "cursor-pointer whitespace-nowrap")}
    >
      {mo ? "Thu gọn" : `Xem ${formatSo(ds.length)} mã`}
      <span className="sr-only">{mo ? ` các mã của ${n.tenSanPham}` : ` của ${n.tenSanPham}`}</span>
      <ChevronDown className={cn("size-3.5 shrink-0 transition-transform motion-reduce:transition-none", mo && "rotate-180")} aria-hidden="true" />
    </button>
  );
  const hanhDong = nhieu ? nutMo : <DeXuat d={d0} coKhoTong={coKhoTong} khoTongId={khoTongId} />;
  const bien0 = d0 ? [d0.tenMau, d0.tenKichCo].filter(Boolean).join(" / ") : "";

  return (
    <>
      <tbody className="border-t border-[#eef1f5]">
        <tr className="hover:bg-bo-surface-subtle">
          <td className={cn(O_DAU, "py-2.5 align-middle")}>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5" title={n.tenSanPham}>
              <span className="line-clamp-2 min-w-0 font-medium text-bo-foreground">{n.tenSanPham}</span>
              <NhanNhom n={n} />
            </span>
            <span className="mt-0.5 block text-xs text-bo-muted">
              {nhieu ? demMaNhom(n) : bien0}
              {!nhieu && d0?.maSku ? <span className="@max-[440px]:hidden">{`${bien0 ? " · " : ""}${d0.maSku}`}</span> : null}
              <span className="hidden @max-[860px]:inline">{` · ${n.tenKho}`}</span>
              <span className="hidden whitespace-nowrap @max-[440px]:inline">{` · khả dụng ${soKd}${nhieu ? (kd.deu ? " mỗi mã" : " thấp nhất") : ""}`}</span>
            </span>
            {nhieu ? <span className="block text-xs text-bo-muted">{tomTatBienThe(ds)}</span> : null}
            {/* Điện thoại: cột Đề xuất ẩn, nút xuống dưới tên */}
            <span className="mt-1 hidden @max-[440px]:block">{hanhDong}</span>
          </td>
          <td className="py-2.5 pr-4 text-bo-foreground @max-[860px]:hidden">
            <span className="line-clamp-2" title={n.tenKho}>{n.tenKho}</span>
          </td>
          <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums text-bo-foreground @max-[440px]:hidden">
            {soKd}
            {nhieu ? <span className="block text-xs text-bo-muted">{kd.deu ? "mỗi mã" : "thấp nhất"}</span> : null}
          </td>
          <td className={cn(O_CUOI, "py-2.5 text-right @max-[440px]:hidden")}>{hanhDong}</td>
        </tr>
      </tbody>
      {/* Các mã của nhóm: luôn có trong trang (ẩn khi thu gọn) để aria-controls của nút mở nhóm luôn trỏ đúng chỗ */}
      {nhieu ? (
        <tbody id={idMa} hidden={!mo}>
          {ds.map((d) => (
            <tr key={d.bienTheId} className="border-t border-[#eef1f5] bg-bo-surface-subtle">
              <td className={cn(O_DAU, "py-2 align-middle")}>
                <span className="block border-l-2 border-bo-border pl-3">
                  <span className="block text-bo-foreground">{[d.tenMau, d.tenKichCo].filter(Boolean).join(" / ")}</span>
                  <span className="block text-xs text-bo-muted">
                    {d.maSku}
                    <span className="hidden whitespace-nowrap @max-[440px]:inline">{` · khả dụng ${formatSo(d.khaDung)} / ${formatSo(d.nguong)}`}</span>
                  </span>
                  <span className="mt-1 hidden @max-[440px]:block">
                    <DeXuat d={d} coKhoTong={coKhoTong} khoTongId={khoTongId} />
                  </span>
                </span>
              </td>
              <td className="@max-[860px]:hidden" />
              <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-bo-foreground @max-[440px]:hidden">
                {formatSo(d.khaDung)} / {formatSo(d.nguong)}
              </td>
              <td className={cn(O_CUOI, "py-2 text-right @max-[440px]:hidden")}>
                <DeXuat d={d} coKhoTong={coKhoTong} khoTongId={khoTongId} />
              </td>
            </tr>
          ))}
        </tbody>
      ) : null}
    </>
  );
}
