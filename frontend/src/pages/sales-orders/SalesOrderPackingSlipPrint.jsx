import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toEcommercePrintModel } from "@/components/print/adapters/ecommercePrintAdapter";
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
        const laShopee = ["SHOPEE", "SHOPEE_OFFICIAL", "SHOPEE_SANDBOX"].includes(maKenh) || maKenh.includes("SHOPEE");
        const dsChiTiet = payload?.chiTiet ?? don?.chiTietDonHang ?? [];
        const pxDau = Array.isArray(payload?.phieuXuatKhoList) ? payload.phieuXuatKhoList[0] : null;
        return {
          phieu: {
            donBanHang: don,
            soPhieuXuat: pxDau?.soPhieuXuat || don.soDonHang,
            ngayXuat: don.ngayDatHang || don.ngayTao,
            maVanDon: don.maVanDon,
            maKienHang: don.maKienHang,
            tongKhoiLuongKg: don.tongKhoiLuongKg,
            nhanThanhToan: don.nhanThanhToan,
            chiDanDongKiem: don.chiDanDongKiem,
            donViPickup: don.donViPickup,
            donViDelivery: don.donViDelivery,
            loaiDichVu: don.loaiDichVu,
            maDinhTuyen: don.maDinhTuyen,
            maTramPhat: don.maTramPhat,
            tagGiaoNhan: don.tagGiaoNhan,
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

