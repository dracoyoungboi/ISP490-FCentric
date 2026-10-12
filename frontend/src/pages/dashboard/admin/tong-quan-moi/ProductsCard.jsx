import { createElement, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, ChevronRight, PackageCheck, PackagePlus, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, MoreLink, Segmented, StatusChip } from "./ui";
import { MAU2 } from "./mau";
import { formatSo, formatTienGon } from "../tong-quan/tongQuanFormat";
import { dsKhoDayDu } from "./boLoc";
import { duongDanKemThamSo } from "@/utils/thamSoDuongDan";

const nf1 = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Sản phẩm: 2 tab trong một thẻ – "Cần bổ sung" (việc phải làm) và "Bán chạy".
 * Luôn mở sẵn tab "Cần bổ sung" để vị trí tab cố định mỗi lần tải trang; không có mã nào thì hiện trạng thái trống
 * kèm nút chuyển sang "Bán chạy".
 */
export default function ProductsCard({ data, loading, loiBanChay, loiBoSung, onRetry }) {
  const bs = data?.hangCanBoSung;
  const khoTongId = timKhoTongId(data);
  const soBoSung = bs?.tongSo ?? 0;
  const [tabChon, setTab] = useState(null);
  const tab = tabChon ?? "boSung";

  return (
    <Card
      title="Sản phẩm"
      right={
        <Segmented
          label="Danh sách sản phẩm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "boSung", label: "Cần bổ sung", badge: bs ? formatSo(soBoSung) : null, badgeTone: soBoSung > 0 ? "bad" : null },
            { value: "banChay", label: "Bán chạy" },
          ]}
        />
      }
      loading={loading}
      bodyClassName="px-0 pb-2 pt-1"
    >
      {tab === "banChay" ? (
        <BanChay rows={data?.sanPhamBanChay} error={loiBanChay} onRetry={onRetry} />
      ) : (
        <BoSung bs={bs} khoTongId={khoTongId} error={loiBoSung} onRetry={onRetry} onXemBanChay={data?.sanPhamBanChay?.length ? () => setTab("banChay") : null} />
      )}
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

function Loi({ onRetry }) {
  return (
    <p role="alert" className="px-5 py-6 text-center text-[13px] text-bo-warning">
      Không tải được danh sách. <button type="button" onClick={onRetry} className="font-medium text-bo-primary hover:underline">Thử lại</button>
    </p>
  );
}

function Rong({ icon, children }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center text-[13px] text-bo-muted">
      {createElement(icon, { className: "size-5 text-slate-400", "aria-hidden": true })}
      {children}
    </div>
  );
}

const TH = "py-2 text-xs font-medium text-bo-muted";

function BanChay({ rows = [], error, onRetry }) {
  if (error) return <Loi onRetry={onRetry} />;
  if (!rows?.length) return <Rong icon={Shirt}>Chưa có sản phẩm nào được bán trong kỳ.</Rong>;
  const max = Math.max(...rows.map((r) => r.soLuongBan), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm tabular-nums">
        <thead>
          <tr className="border-b border-[#eef1f5] text-left">
            <th className={cn(TH, "w-10 pl-5")}>#</th>
            <th className={TH}>Sản phẩm</th>
            <th className={cn(TH, "w-[34%]")}>Đã bán</th>
            <th className={cn(TH, "text-right")}>Doanh thu</th>
            <th className={cn(TH, "pr-5 text-right")}>Còn đủ bán</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const moiNgay = r.soNgay > 0 ? r.soLuongBan / r.soNgay : 0;
            const ngay = moiNgay > 0 ? r.khaDung / moiNgay : null;
            return (
              <tr key={r.sanPhamId} className="border-b border-[#f3f5f8] last:border-b-0 hover:bg-slate-50/70">
                <td className="py-2.5 pl-5 text-[13px] text-bo-muted">{i + 1}</td>
                <td className="max-w-[260px] py-2.5 pr-3">
                  <span className="block truncate text-bo-foreground">{r.tenSanPham}</span>
                  <span className="block truncate text-xs text-bo-muted">{r.maSanPham}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="flex items-center gap-3">
                    <span className="h-1.5 flex-1 rounded-full bg-[#f1f4f8]" aria-hidden="true">
                      <span className="block h-full rounded-full" style={{ width: `${(r.soLuongBan / max) * 100}%`, background: MAU2.chinh }} />
                    </span>
                    <span className="w-24 text-right">
                      <b className="font-semibold text-bo-foreground">{formatSo(r.soLuongBan)}</b>
                      <span className="block text-xs text-bo-muted">{nf1.format(moiNgay)}/ngày</span>
                    </span>
                  </span>
                </td>
                <td className="py-2.5 text-right text-bo-foreground">{formatTienGon(r.doanhThu)}</td>
                <td className="py-2.5 pr-5 text-right">
                  {r.khaDung <= 0 ? (
                    <StatusChip tone="danger">Hết hàng</StatusChip>
                  ) : ngay != null && ngay < 7 ? (
                    <StatusChip tone="warning">~{formatSo(Math.max(1, Math.round(ngay)))} ngày</StatusChip>
                  ) : (
                    <span className="text-[13px] text-bo-muted">{ngay == null ? "—" : `~${formatSo(Math.round(ngay))} ngày`}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex justify-end px-5 pt-2">
        <MoreLink to="/products">Tất cả sản phẩm</MoreLink>
      </div>
    </div>
  );
}

function BoSung({ bs, khoTongId, error, onRetry, onXemBanChay }) {
  if (error) return <Loi onRetry={onRetry} />;
  const rows = bs?.dong ?? [];
  if (!rows.length)
    return (
      <Rong icon={PackageCheck}>
        Mọi mã đang kinh doanh đều còn trên mức tối thiểu.
        {onXemBanChay ? (
          <button
            type="button"
            onClick={onXemBanChay}
            className="inline-flex items-center gap-1 rounded font-medium text-bo-primary hover:text-bo-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          >
            Xem sản phẩm bán chạy
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </Rong>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm tabular-nums">
        <thead>
          <tr className="border-b border-[#eef1f5] text-left">
            <th className={cn(TH, "pl-5")}>Sản phẩm</th>
            <th className={TH}>Kho</th>
            <th className={cn(TH, "w-40")}>Khả dụng / tối thiểu</th>
            <th className={cn(TH, "pr-5 text-right")}>Đề xuất</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const chuyen = d.deXuat === "chuyen_kho";
            const ghiChu = chuyen
              ? `Kho tổng còn ${formatSo(d.khaDungKhoTong)} khả dụng`
              : d.laKhoTong
                ? "Kho tổng nhập từ nhà cung cấp"
                : !bs.coKhoTong
                  ? "Chưa đánh dấu Kho tổng"
                  : `Kho tổng chỉ còn ${formatSo(d.khaDungKhoTong ?? 0)}, không đủ chuyển`;
            const pct = d.nguong > 0 ? Math.min(100, (d.khaDung / d.nguong) * 100) : 0;
            return (
              <tr key={`${d.khoId}-${d.bienTheId}`} className="border-b border-[#f3f5f8] last:border-b-0 hover:bg-slate-50/70">
                <td className="max-w-[240px] py-2.5 pl-5 pr-3">
                  <span className="block truncate text-bo-foreground">{d.tenSanPham}</span>
                  <span className="block truncate text-xs text-bo-muted">{[d.tenMau, d.tenKichCo, d.maSku].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-[13px] text-bo-foreground">{d.tenKho}</td>
                <td className="py-2.5 pr-4">
                  <span className="flex items-center gap-2.5">
                    <span className="h-1.5 w-16 rounded-full bg-[#f1f4f8]" aria-hidden="true">
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(pct, d.khaDung > 0 ? 6 : 0)}%`, background: d.khaDung <= 0 ? MAU2.tinhTrang.hetHang : MAU2.tinhTrang.thieuHang }} />
                    </span>
                    <span className="text-[13px]">
                      <b className={cn("font-semibold", d.khaDung <= 0 ? "text-red-600" : "text-bo-foreground")}>{formatSo(d.khaDung)}</b>
                      <span className="text-bo-muted"> / {formatSo(d.nguong)}</span>
                    </span>
                  </span>
                </td>
                <td className="py-2 pr-5 text-right">
                  <Link
                    to={duongDanDeXuat(d, khoTongId)}
                    title={ghiChu}
                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-[#e6e9ef] bg-white px-2.5 text-[13px] font-medium text-bo-foreground hover:border-bo-primary/40 hover:text-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                  >
                    {chuyen ? <ArrowLeftRight className="size-3.5" aria-hidden="true" /> : <PackagePlus className="size-3.5" aria-hidden="true" />}
                    {chuyen ? `Chuyển ${formatSo(d.soLuongDeXuat)} từ Kho tổng` : `Yêu cầu nhập ${formatSo(d.soLuongDeXuat)}`}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-3 px-5 pt-2 text-xs text-bo-muted">
        <span>Đề xuất đưa khả dụng về gấp đôi mức tối thiểu; kho bán hàng ưu tiên nhận từ Kho tổng.</span>
        <MoreLink to="/reports/inventory">{`Xem tất cả ${formatSo(bs.tongSo)}`}</MoreLink>
      </div>
    </div>
  );
}
