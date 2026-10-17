import { Link } from "react-router-dom";
import { Shirt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, LE, MoreLink } from "./ui";
import { NHAN_KY } from "./boLoc";
import { formatSo, formatTienNgan } from "../tong-quan/tongQuanFormat";

/**
 * Bán chạy trong kỳ: 5 sản phẩm bán nhiều nhất (theo số lượng), mỗi dòng: hạng, tên, đã bán · còn khả dụng, doanh thu.
 * Còn khả dụng là 0 thì ghi đỏ "hết hàng" để thấy ngay mã bán chạy đang thiếu. Mã sản phẩm ở chú thích khi rê chuột.
 */
export default function ProductsCard({ data, ky, loading, error, onRetry, className }) {
  const rows = data?.sanPhamBanChay ?? [];
  return (
    <Card
      className={className}
      title="Bán chạy"
      scope={NHAN_KY[ky]}
      right={<MoreLink to="/products">Xem tất cả</MoreLink>}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!error && rows.length === 0}
      emptyIcon={Shirt}
      emptyText="Chưa có sản phẩm nào được bán trong kỳ."
    >
      <ol>
        {rows.map((r, i) => (
          <li key={r.sanPhamId} className="border-t border-[#eef1f5] first:border-t-0">
            <Link
              to={`/products/${r.sanPhamId}`}
              title={`${r.maSanPham} · ${r.tenSanPham}`}
              className={cn(LE, "flex items-center gap-3 py-2.5 hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30")}
            >
              <span className="w-4 shrink-0 text-sm tabular-nums text-bo-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-bo-foreground">{r.tenSanPham}</span>
                <span className="block truncate text-xs text-bo-muted">
                  Đã bán {formatSo(r.soLuongBan)} ·{" "}
                  {r.khaDung > 0 ? `còn ${formatSo(r.khaDung)}` : <span className="font-medium text-[#b42318]">hết hàng</span>}
                </span>
              </span>
              <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-bo-foreground">{formatTienNgan(r.doanhThu)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
