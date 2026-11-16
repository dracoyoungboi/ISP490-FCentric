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
        const detail = await donBanHangService.getDetail(id);
        if (!detail) return null;
        return {
          phieu: {
            donBanHang: detail,
            soPhieuXuat: detail.soDonHang,
            ngayXuat: detail.ngayTao,
            maVanDon: detail.maVanDon,
            maKienHang: detail.maKienHang,
            tongKhoiLuongKg: detail.tongKhoiLuongKg,
            nhanThanhToan: detail.nhanThanhToan,
            chiDanDongKiem: detail.chiDanDongKiem,
            donViPickup: detail.donViPickup,
            donViDelivery: detail.donViDelivery,
            loaiDichVu: detail.loaiDichVu,
            maDinhTuyen: detail.maDinhTuyen,
            maTramPhat: detail.maTramPhat,
            tagGiaoNhan: detail.tagGiaoNhan,
            chuoiQrCode: detail.chuoiQrCode,
            shippingDocUrl: detail.shippingDocUrl,
          },
          chiTiet: (detail.chiTietDonHang || []).map((ct) => ({
            tenSanPham: ct.tenSanPham || ct.tenBienThe,
            tenBienThe: ct.tenBienThe,
            tenMau: ct.tenMau,
            kichCo: ct.kichCo,
            sku: ct.sku || ct.maSku,
            soLuongCanXuat: ct.soLuong,
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

