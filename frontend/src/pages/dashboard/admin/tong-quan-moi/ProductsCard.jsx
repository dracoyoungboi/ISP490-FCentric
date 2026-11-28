import { useState } from "react";
import { Link } from "react-router-dom";
import { Shirt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, LE, MoreLink } from "./ui";
import GiaiThich from "./GiaiThich";
import { formatSo, formatTienNgan } from "../tong-quan/tongQuanFormat";
import { ngayCuaKy } from "../tong-quan/kyXem";
import { duongDanBaoCaoSanPham } from "@/pages/bao-cao/tinhBaoCaoSanPham";
import { t, tDuLieu } from "@/i18n";

/* Mỗi dòng cao 52px: ảnh 40px có số hạng ở góc | tên một dòng (dài thì cắt, rê chuột hiện đủ) | số cái đã bán, doanh thu
   chữ nhỏ bên dưới. Không hiện tồn (đã có khối Tồn kho). Số hạng nằm trên ảnh thay cho cột riêng để tên rộng thêm. */
const LUOI = "grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-2.5";

/**
 * Ảnh đại diện của sản phẩm; chưa có ảnh hoặc ảnh lỗi thì hình áo xám. Số hạng là tab kính mờ dính góc trên trái ảnh
 * (trắng mờ, bo góc dưới phải), cùng màu cột số cũ: hạng 1 màu chữ chính, còn lại xám. Không nền màu, không bóng đổ.
 */
function AnhSanPham({ src, hang }) {
  const [loi, setLoi] = useState(null);
  const hien = Boolean(src) && loi !== src;
  return (
    <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100">
      {hien ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setLoi(src)} className="size-full object-cover" />
      ) : (
        <Shirt className="size-5 text-slate-400" aria-hidden="true" />
      )}
      <span
        className={cn(
          "absolute left-0 top-0 grid h-4 min-w-4 place-items-center rounded-br-md bg-white/80 px-[3px] text-[10.5px] font-bold leading-none tabular-nums backdrop-blur-md",
          hang === 1 ? "text-bo-foreground" : "text-bo-muted",
        )}
      >
        {hang}
      </span>
    </span>
  );
}

/**
 * Bán chạy trong kỳ (đặc tả bản 2, mục 5): 5 sản phẩm bán nhiều cái nhất, đã trừ hàng khách trả, khớp Báo cáo sản phẩm.
 * "Xem tất cả" mở Báo cáo sản phẩm đúng khoảng ngày và kho đang xem.
 */
export default function ProductsCard({ data, k, khoId, loading, error, onRetry, className }) {
  const rows = data?.banChay ?? [];
  const xemTatCa = duongDanBaoCaoSanPham({ nhom: "co-ban", ...ngayCuaKy(k), khoId });
  return (
    <Card
      className={className}
      title={t("Sản phẩm bán chạy")}
      right={<MoreLink to={xemTatCa}>{t("Xem tất cả")}</MoreLink>}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!error && !loading && rows.length === 0}
      emptyIcon={Shirt}
      emptyText={t("Chưa có sản phẩm nào xuất bán trong kỳ.")}
    >
      <div className={cn(LUOI, LE, "border-b border-[#eef1f5] py-2 text-xs text-bo-muted")}>
        <span className="col-span-2">{t("Sản phẩm")}</span>
        <span className="text-right">
          <GiaiThich align="end" tieuDe={t("Sản phẩm bán chạy")} moTa={t("Xếp theo số cái xuất bán trong kỳ, đã trừ hàng khách trả, khớp Báo cáo sản phẩm. Số tiền nhỏ là doanh thu của sản phẩm, không gồm thuế GTGT và phí vận chuyển.")}>
            {t("Đã bán")}
          </GiaiThich>
        </span>
      </div>
      <ol>
        {rows.map((r, i) => (
          <li key={r.sanPhamId} className="border-t border-[#eef1f5] first:border-t-0">
            <Link
              to={`/products/${r.sanPhamId}`}
              title={`${r.maSanPham} · ${r.tenSanPham}`}
              className={cn(LUOI, LE, "h-[52px] hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30")}
            >
              <AnhSanPham src={r.anh} hang={i + 1} />
              <span className="min-w-0 truncate text-sm font-medium text-bo-foreground">{tDuLieu(r.tenSanPham)}</span>
              <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-bo-foreground">
                {t("{{so}} cái", { so: formatSo(r.soLuong) })}
                <small className="block text-xs font-normal text-bo-muted">{formatTienNgan(r.doanhThu)}</small>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
