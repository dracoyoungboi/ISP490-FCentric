import { createElement } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, ClipboardCheck, Download, History, ShoppingCart, Store, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, LE, MoreLink } from "./ui";
import { formatSo, formatTien, thoiGianNgan } from "../tong-quan/tongQuanFormat";

const SO_DONG = 5;

const LOAI = {
  nhap_kho: { ten: "Nhập kho", icon: Download, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.tenKho], to: (x) => `/goods-receipts/${x.id}` },
  nhap_chuyen_kho: { ten: "Nhận hàng chuyển kho", icon: ArrowLeftRight, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.tenKho], to: (x) => `/goods-receipts/${x.id}` },
  xuat_kho: { ten: "Xuất kho", icon: Upload, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.tenKho], to: (x) => `/goods-issues/${x.id}/view` },
  xuat_chuyen_kho: { ten: "Xuất chuyển kho", icon: ArrowLeftRight, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.doiTac ? `đến ${x.doiTac}` : x.tenKho], to: (x) => `/goods-issues/${x.id}/view` },
  don_ban: { ten: "Đơn bán mới", icon: ShoppingCart, mo: (x) => [x.soTien != null && formatTien(x.soTien), x.doiTac ?? "Đơn bán trực tiếp"], to: (x) => `/sales-orders/${x.id}` },
  ban_tai_quay: { ten: "Bán tại quầy", icon: Store, mo: (x) => [x.soTien != null && formatTien(x.soTien), x.tenKho], to: (x) => `/sales-orders/${x.id}` },
  // Tên đợt kiểm kê tự đặt thường đã chứa tên kho ("Kiểm kê kho Kho tổng") nên chỉ ghi khi khác
  kiem_ke: { ten: "Kiểm kê xong", icon: ClipboardCheck, mo: (x) => [x.doiTac && !(x.tenKho && x.doiTac.includes(x.tenKho)) ? x.doiTac : null, x.tenKho], to: (x) => `/stock-take/${x.id}` },
};

/** Chứng từ vừa hoàn tất: tên việc và mã chứng từ, giờ ở bên phải; dòng phụ gồm số lượng hoặc số tiền, kho và người làm. */
export default function HoatDongGanDay({ data, loading, error, onRetry, className }) {
  const ds = (data?.hoatDongGanDay ?? []).slice(0, SO_DONG);
  return (
    <Card
      className={className}
      title="Hoạt động gần đây"
      right={<MoreLink to="/inventory-transactions">Lịch sử kho</MoreLink>}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!error && ds.length === 0}
      emptyIcon={History}
      emptyText="Chưa có chứng từ nào hoàn tất."
    >
      <ol>
        {ds.map((x) => {
          const l = LOAI[x.loai] ?? { ten: "Chứng từ", icon: History, mo: () => [x.tenKho], to: () => "/inventory-transactions" };
          const phu = [...l.mo(x), x.nguoiThucHien].filter(Boolean).join(" · ");
          return (
            <li key={`${x.loai}-${x.id}`} className="border-t border-[#eef1f5] first:border-t-0">
              <Link
                to={l.to(x)}
                title={`${l.ten} ${x.maChungTu}${phu ? ` – ${phu}` : ""}`}
                className={cn(LE, "flex items-start gap-3 py-2.5 hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30")}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
                  {createElement(l.icon, { className: "size-4", "aria-hidden": true })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-bo-foreground">
                      {l.ten} <span className="text-bo-muted">{x.maChungTu}</span>
                    </span>
                    <time dateTime={x.thoiGian} className="shrink-0 text-xs tabular-nums text-bo-muted">
                      {thoiGianNgan(x.thoiGian, data.thoiDiem)}
                    </time>
                  </span>
                  <span className="line-clamp-2 text-xs text-bo-muted">{phu}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
