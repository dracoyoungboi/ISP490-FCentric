import { createElement } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, ClipboardCheck, Download, History, ShoppingCart, Store, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardEmpty, CardError, LE, MoreLink } from "./ui";
import { NHAN_KY } from "./boLoc";
import { formatSo, formatTien, thoiGianNgan } from "../tong-quan/tongQuanFormat";

const SO_DONG = 5;

const LOAI = {
  nhap_kho: { ten: "Nhập kho", icon: Download, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.tenKho], to: (x) => `/goods-receipts/${x.id}` },
  nhap_chuyen_kho: { ten: "Nhận hàng chuyển kho", icon: ArrowLeftRight, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.tenKho], to: (x) => `/goods-receipts/${x.id}` },
  xuat_kho: { ten: "Xuất kho", icon: Upload, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.tenKho], to: (x) => `/goods-issues/${x.id}/view` },
  xuat_chuyen_kho: { ten: "Xuất chuyển kho", icon: ArrowLeftRight, mo: (x) => [x.soLuong != null && `${formatSo(x.soLuong)} sản phẩm`, x.doiTac ? `đến ${x.doiTac}` : x.tenKho], to: (x) => `/goods-issues/${x.id}` }, // PX-CK không có đơn bán: mở chi tiết phiếu xuất, không mở màn xem của đơn bán
  don_ban: { ten: "Đơn bán mới", icon: ShoppingCart, mo: (x) => [x.soTien != null && formatTien(x.soTien), x.doiTac ?? "Đơn bán trực tiếp"], to: (x) => `/sales-orders/${x.id}` },
  ban_tai_quay: { ten: "Bán tại quầy", icon: Store, mo: (x) => [x.soTien != null && formatTien(x.soTien), x.tenKho], to: (x) => `/sales-orders/${x.id}` },
  // Tên đợt kiểm kê tự đặt thường đã chứa tên kho ("Kiểm kê kho Kho tổng") nên chỉ ghi khi khác
  kiem_ke: { ten: "Kiểm kê xong", icon: ClipboardCheck, mo: (x) => [x.doiTac && !(x.tenKho && x.doiTac.includes(x.tenKho)) ? x.doiTac : null, x.tenKho], to: (x) => `/stock-take/${x.id}` },
};

/**
 * Chứng từ vừa hoàn tất: tên việc và mã chứng từ, giờ ở bên phải; dòng phụ gồm số lượng hoặc số tiền, kho và người làm.
 * Chân thẻ: tổng nhập – xuất của kỳ đang xem (chuyển từ thẻ Tồn kho sang, PA A 29/10/2026, để thẻ Tồn kho chỉ chứa số
 * hiện tại) và liên kết Nhật ký nhập – xuất. Danh sách lỗi hoặc trống thì chân thẻ vẫn hiện.
 */
export default function HoatDongGanDay({ data, ky, loading, error, loiNhapXuat, onRetry, className }) {
  const ds = (data?.hoatDongGanDay ?? []).slice(0, SO_DONG);
  const io = data?.nhapXuat;
  return (
    <Card
      className={className}
      title="Hoạt động gần đây"
      right={<MoreLink to="/inventory-transactions">Lịch sử kho</MoreLink>}
      loading={loading}
    >
      {error ? (
        <div className={cn(LE, "flex flex-1 flex-col py-4")}>
          <CardError onRetry={onRetry} />
        </div>
      ) : ds.length === 0 ? (
        <div className={cn(LE, "flex flex-1 flex-col py-4")}>
          <CardEmpty icon={History} text="Chưa có chứng từ nào hoàn tất." />
        </div>
      ) : (
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
      )}

      <div className={cn(LE, "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#eef1f5] py-3 text-sm text-bo-muted")}>
        {loiNhapXuat || !io ? (
          <span role={loiNhapXuat ? "alert" : undefined}>{loiNhapXuat ? "Không tải được số liệu nhập – xuất." : ""}</span>
        ) : (
          <span title={io.boChuyenKhoNoiBo ? "Không tính chuyển kho nội bộ giữa các kho" : "Gồm hàng chuyển đến và chuyển đi của kho này"}>
            {NHAN_KY[ky] ?? "Trong kỳ"}: nhập <b className="font-semibold tabular-nums text-bo-foreground">{formatSo(io.tongNhap)}</b> · xuất{" "}
            <span className="whitespace-nowrap">
              <b className="font-semibold tabular-nums text-bo-foreground">{formatSo(io.tongXuat)}</b> sản phẩm
            </span>
          </span>
        )}
        <MoreLink to="/reports/stock-movements">Nhật ký nhập – xuất</MoreLink>
      </div>
    </Card>
  );
}
