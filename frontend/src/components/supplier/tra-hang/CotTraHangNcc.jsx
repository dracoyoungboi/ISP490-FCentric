import { TEN_CACH_BU, TRANG_THAI_HANG_LOI } from "@/constants/nhapKho";
import { formatCurrency } from "@/utils/formatters";
import { soNgayHangOKho } from "./soNgayHangOKho";
import { t } from "@/i18n";

/*
 * Ô của danh sách biên bản trả hàng ở tab Trả hàng (chi tiết nhà cung cấp). Cùng kiểu ô hai dòng của Đơn mua / Phiếu
 * nhập: dòng chính đậm, dòng phụ chữ nhỏ nhạt; chỉ cột Trạng thái có thẻ màu.
 */

/** Ô "Hàng lỗi": số sản phẩm lỗi (dòng chính) + hàng đang ở đâu (dòng phụ); ở kho quá lâu thì số ngày tô cam. */
export function OHangLoi({ bienBan, luc }) {
  const ngay = soNgayHangOKho(bienBan, luc);
  const tt = TRANG_THAI_HANG_LOI[bienBan.trangThaiHang];
  return (
    <>
      <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-bo-foreground">
        {t("{{count}} sản phẩm", { count: Number(bienBan.tongSoLuongLoi) || 0 })}
      </p>
      <p className="mt-0.5 text-xs text-bo-muted">
        {tt ? t(tt.label) : "—"}
        {ngay != null ? (
          <span className="whitespace-nowrap font-medium text-bo-warning"> · {t("{{count}} ngày", { count: ngay })}</span>
        ) : null}
      </p>
    </>
  );
}

/**
 * Ô "Bù": cách nhà cung cấp chọn trên cổng (dòng chính) + số tiền trừ / đã nhận đủ hàng bù (dòng phụ). Nhà cung cấp
 * chọn được ngay khi nhận email biên bản, kể cả trước nhập kho. Biên bản đã hủy không có bù.
 */
export function OBu({ bienBan }) {
  const ma = bienBan?.phuongAn;
  if (!ma || bienBan.trangThaiHienThi === "DA_HUY") return <span className="text-bo-muted">—</span>;
  // Đã trừ vào đơn mua; chưa nhập kho thì giá trị các dòng trừ tiền (dự kiến)
  const tien = Number(bienBan.tienTruTien) > 0 ? Number(bienBan.tienTruTien) : Number(bienBan.giaTriTruTien) || 0;
  const coTru = ma === "TRU_CONG_NO" || ma === "HON_HOP";
  return (
    <>
      <p className={ma === "CHO_CHOT" ? "whitespace-nowrap text-sm text-bo-muted" : "whitespace-nowrap text-sm font-medium text-bo-foreground"}>
        {t(TEN_CACH_BU[ma] ?? ma)}
      </p>
      {coTru && (tien > 0 || ma === "TRU_CONG_NO") ? (
        <p className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-bo-muted">−{formatCurrency(tien)}</p>
      ) : null}
      {(ma === "DOI_HANG" || ma === "HON_HOP") && bienBan.buXong ? (
        <p className="mt-0.5 whitespace-nowrap text-xs text-bo-success">{t("đã nhận đủ hàng bù")}</p>
      ) : null}
    </>
  );
}
