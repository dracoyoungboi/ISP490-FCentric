package com.dev.backend.dto.response.customize;

import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.dto.response.entities.ChiTietDonBanHangDto;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class DonBanHangDetailResponse {
    private DonBanHangDto donBanHang;
    private List<ChiTietDonBanHangDto> chiTiet;
    private List<PhieuXuatKhoSummaryDto> phieuXuatKhoList;
    /** Phiếu nhặt mà đơn đang thuộc (nếu có) — màn đơn ẩn Hủy / Tạo phiếu xuất khi phiếu nhặt còn chạy. */
    private Integer phieuNhatHangId;
    private String maPickList;
    private String trangThaiPhieuNhat;
    /** Lần thu tiền tại quầy (đơn POS); null với đơn bán thường / đơn sàn. */
    private ThanhToanTaiQuayDto thanhToanTaiQuay;
    /** ID kho được Shopify gợi ý định tuyến theo Location (đơn vẫn giữ tại Kho Tổng ở trạng thái Nháp). */
    private Integer khoDeXuatId;
    /** Tên kho được Shopify gợi ý điều tiết. */
    private String tenKhoDeXuat;
    /** Phương thức giao hàng từ Shopify FulfillmentOrder (SHIPPING, PICKUP, LOCAL...). */
    private String phuongThucGiaoSan;
    /** true nếu đơn Shopify đang tách từ 2 FulfillmentOrders/Locations trở lên. */
    private Boolean tachNhieuKhoSan;
    /** true nếu người dùng hiện tại được phép điều tiết gửi đơn sang kho (tính theo @RequireAuth + Quản lý Kho Tổng Shopify). */
    private Boolean coTheGuiSangKho;
    /** true nếu đơn Shopee đang chờ xác nhận (UNPAID) — chỉ cho phép xem, chưa gửi kho/in vận đơn. */
    private Boolean choXacNhanSan;
}
