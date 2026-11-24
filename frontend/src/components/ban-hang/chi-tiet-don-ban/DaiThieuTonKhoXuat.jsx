import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

// Hẹp (màn < 640px, hoặc khối chứng từ < 768px như máy tính bảng có thanh bên): nút xuống cuối dải, "Cần · Còn" xuống dưới tên
const HEP_KHUNG = "max-sm:grid-cols-1 @max-3xl/khoi:grid-cols-1";
const HEP_NUT = "max-sm:order-last max-sm:mt-2 max-sm:justify-start @max-3xl/khoi:order-last @max-3xl/khoi:mt-2 @max-3xl/khoi:justify-start";
const HEP_DONG = "max-sm:grid-cols-[minmax(0,1fr)_auto] @max-3xl/khoi:grid-cols-[minmax(0,1fr)_auto]";
const HEP_CAN_CON = "max-sm:col-start-1 max-sm:row-start-2 @max-3xl/khoi:col-start-1 @max-3xl/khoi:row-start-2";
const HEP_THIEU = "max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1 max-sm:self-center @max-3xl/khoi:col-start-2 @max-3xl/khoi:row-span-2 @max-3xl/khoi:row-start-1 @max-3xl/khoi:self-center";

/**
 * Dải cảnh báo kho xuất thiếu hàng cho đơn Chờ nhặt hàng (theo bản demo đã chốt, PA B): tiêu đề + nút chữ cùng hàng,
 * câu hướng dẫn, rồi bảng gọn từng biến thể thiếu (Cần · Còn · Thiếu). Kho đang kiểm kê toàn kho thì chỉ báo kiểm kê.
 * `thieu`: tinhDonBan.thieuTonDonBan. Nút Lập phiếu chuyển kho và Mở Đơn chờ nhặt hàng chỉ cho vai trò kho (`laKho`).
 */
export default function DaiThieuTonKhoXuat({ thieu, laKho = false, onLapPhieuChuyenKho, onMoDonChoNhat }) {
  if (!thieu) return null;
  const { tenKho, dotKiemKe, dong } = thieu;
  const tieuDe = dotKiemKe
    ? t("{{tenKho}} đang kiểm kê toàn kho ({{dot}})", { tenKho, dot: dotKiemKe })
    : t("{{tenKho}} đang thiếu hàng cho {{so}} sản phẩm", { tenKho, so: soVN(dong.length), count: dong.length });
  const moTa = dotKiemKe
    ? t("Đơn đã vào Đơn chờ nhặt hàng nhưng kho chưa nhặt được cho tới khi xong đợt kiểm kê.")
    : laKho
      ? t("Đơn đã vào Đơn chờ nhặt hàng nhưng kho chưa nhặt được. Chuyển thêm hàng về kho này để tiếp tục.")
      : t("Đơn đã vào Đơn chờ nhặt hàng nhưng kho chưa nhặt được. Kho cần chuyển thêm hàng về kho này để tiếp tục.");
  const nut = laKho
    ? [
      !dotKiemKe && onLapPhieuChuyenKho ? (
        <NutChu key="lap" onClick={onLapPhieuChuyenKho}>{t("Lập phiếu chuyển kho")}</NutChu>
      ) : null,
      onMoDonChoNhat ? <NutChu key="mo" onClick={onMoDonChoNhat}>{t("Mở Đơn chờ nhặt hàng")}</NutChu> : null,
    ].filter(Boolean)
    : [];

  return (
    <DongThongBao tone="warn">
      <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-4", HEP_KHUNG)}>
        <p className="min-w-0 font-semibold text-bo-foreground">{tieuDe}</p>
        {nut.length ? (
          <div className={cn("flex flex-wrap items-start justify-end gap-x-4 gap-y-1", HEP_NUT)}>{nut}</div>
        ) : null}
        <p className="col-span-full text-bo-muted">{moTa}</p>
        {dong.length ? (
          <ul className="col-span-full mt-2 border-t border-bo-border" aria-label={t("Sản phẩm thiếu tại kho")}>
            {dong.map((d) => (
              <li
                key={d.bienTheId}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 border-b border-dashed border-bo-border py-1.5 tabular-nums last:border-b-0 last:pb-0",
                  HEP_DONG,
                )}
              >
                <span className="min-w-0 break-words text-bo-foreground">
                  {d.tenSanPham || d.sku || "—"}
                  {d.nhanBienThe ? <span className="text-xs text-bo-muted"> · {d.nhanBienThe}</span> : null}
                </span>
                <span className={cn("whitespace-nowrap text-xs text-bo-muted", HEP_CAN_CON)}>
                  {t("Cần {{can}} · Còn {{con}}", { can: soVN(d.can), con: soVN(d.con) })}
                </span>
                <span className={cn("min-w-[52px] whitespace-nowrap text-right font-semibold text-amber-700 dark:text-amber-400", HEP_THIEU)}>
                  {t("Thiếu {{so}}", { so: soVN(d.thieu) })}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </DongThongBao>
  );
}
