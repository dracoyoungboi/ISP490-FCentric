import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toEcommercePrintModel } from "@/components/print/adapters/ecommercePrintAdapter";
import { chuanHoaDonViVanChuyen, trichTheGhiChu } from "@/components/print/shopeeAwbHelpers";
import { donBanHangService } from "@/services/donBanHangService";
import { t } from "@/i18n";

/**
 * Trang in tem vận đơn sàn (A6) trực tiếp từ đơn bán hàng (Lazada, Shopee, TikTok Shop).
 * Sử dụng mẫu in `ecommerce_packing_slip` chuẩn sàn của Khang.
 */
export default function SalesOrderPackingSlipPrint() {
  return (
    <PrintRoutePage
      documentType="ecommerce_packing_slip"
      fetcher={async (id) => {
        const res = await donBanHangService.getDetail(id);
        const payload = res?.data ?? res;
        const don = payload?.donBanHang ?? payload;
        if (!don || !don.id) return null;
        const maKenh = String(don?.kenhBanHang?.maKenh ?? "").trim().toUpperCase();
        const laShopee = ["SHOPEE", "SHOPEE_OFFICIAL", "SHOPEE_SANDBOX"].includes(maKenh)
          || maKenh.includes("SHOPEE")
          || String(don.soDonHang || "").startsWith("SHP-");
        const dsChiTiet = payload?.chiTiet ?? don?.chiTietDonHang ?? [];
        const pxDau = Array.isArray(payload?.phieuXuatKhoList) ? payload.phieuXuatKhoList[0] : null;
        // i18n-giu-nguyen: tên thẻ metadata lưu trong ghi chú đơn hàng từ backend
        const rawMaVanDonGhiChu = trichTheGhiChu(don.ghiChu, "VẬN ĐƠN");
        const maSanGoc = String(don.maDonHangKenh || "").replace(/^SHP-/i, "").trim();
        const maVanDonGhiChu = rawMaVanDonGhiChu && maSanGoc && rawMaVanDonGhiChu.toUpperCase() === `SPXVN${maSanGoc}`.toUpperCase()
          ? null : rawMaVanDonGhiChu;
        // i18n-giu-nguyen: tên thẻ metadata đơn vị vận chuyển và mã chia chọn tuyến lưu trong ghi chú
        const donViGhiChu = trichTheGhiChu(don.ghiChu, "ĐƠN VỊ");
        const maTuyenGhiChu = trichTheGhiChu(don.ghiChu, "TUYẾN"); // i18n-giu-nguyen: khóa thẻ metadata TUYẾN
        const maTramGhiChu = trichTheGhiChu(don.ghiChu, "TRẠM"); // i18n-giu-nguyen: khóa thẻ metadata TRẠM
        const ptttGhiChu = trichTheGhiChu(don.ghiChu, "PTTT");
        const donViChuan = chuanHoaDonViVanChuyen(don.donViVanChuyen || donViGhiChu);
        const tongSl = dsChiTiet.reduce((sum, ct) => sum + Number(ct.soLuongDat ?? ct.soLuong ?? 1), 0);
        const tongKhoiLuongKg = don.tongKhoiLuongKg
          ?? (tongSl > 0 ? Number((tongSl * 0.25 + 0.05).toFixed(2)) : 0.3);
        const laCod = ptttGhiChu
          ? ptttGhiChu.toUpperCase() === "COD"
          : String(don.trangThaiThanhToan || "").toLowerCase() === "chua_thanh_toan";
        // i18n-giu-nguyen: nhãn in tiền thu hộ trên tem nhiệt vận đơn
        const nhanThanhToan = don.nhanThanhToan
          || (laCod && Number(don.tongCong) > 0
            ? `THU HỘ(COD): ${Number(don.tongCong).toLocaleString("vi-VN")} VNĐ` // i18n-giu-nguyen: nhãn in chứng từ vận đơn
            : "ĐÃ THANH TOÁN (COD: 0 đ)"); // i18n-giu-nguyen: nhãn in chứng từ vận đơn
        const maVanDonThat = don.maVanDon && !(maSanGoc && String(don.maVanDon).trim().toUpperCase() === `SPXVN${maSanGoc}`.toUpperCase())
          ? don.maVanDon : maVanDonGhiChu;
        return {
          phieu: {
            donBanHang: don,
            soPhieuXuat: pxDau?.soPhieuXuat || don.soDonHang,
            ngayXuat: don.ngayDatHang || don.ngayTao,
            maVanDon: maVanDonThat,
            donViVanChuyen: don.donViVanChuyen || donViGhiChu,
            maKienHang: don.maKienHang,
            tongKhoiLuongKg,
            nhanThanhToan,
            chiDanDongKiem: don.chiDanDongKiem,
            donViPickup: don.donViPickup || donViChuan || (laShopee ? "SPX EXPRESS" : undefined),
            donViDelivery: don.donViDelivery || donViChuan || (laShopee ? "SPX EXPRESS" : undefined),
            loaiDichVu: don.loaiDichVu || (laShopee ? (maKenh.includes("SANDBOX") ? "Sandbox SPX Express" : "SPX Express") : undefined),
            maDinhTuyen: don.maDinhTuyen || maTuyenGhiChu || undefined,
            maTramPhat: don.maTramPhat || maTramGhiChu || undefined,
            tagGiaoNhan: don.tagGiaoNhan || (laShopee && (don.maDinhTuyen || maTuyenGhiChu) ? "WKD" : undefined),
            chuoiQrCode: don.chuoiQrCode,
            shippingDocUrl: don.shippingDocUrl || payload?.shippingDocUrl || (laShopee ? `/api/v1/don-ban-hang/${don.id}/van-don-san` : null),
          },
          chiTiet: dsChiTiet.map((ct) => ({
            tenSanPham: ct.tenSanPhamGoc || ct.tenSanPham || ct.tenBienThe,
            tenBienThe: ct.tenBienThe,
            tenMau: ct.tenMau,
            kichCo: ct.kichCo,
            sku: ct.sku || ct.maSku,
            soLuongCanXuat: ct.soLuongDat ?? ct.soLuong,
            ghiChu: ct.ghiChu,
          })),
        };
      }}
      adapter={toEcommercePrintModel}
      backPath="/sales-orders/:id"
      loadingLabel={t("Đang tải dữ liệu phiếu đóng gói đơn sàn")}
      titleFallback={t("In phiếu vận đơn / đóng gói đơn sàn (A6)")}
      notFoundTitle={t("Không tìm thấy đơn hàng")}
      notFoundDescription={t("Đơn hàng có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
    />
  );
}

