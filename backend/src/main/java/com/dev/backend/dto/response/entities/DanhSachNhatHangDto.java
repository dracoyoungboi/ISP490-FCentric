package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class DanhSachNhatHangDto implements Serializable {
    Integer id;
    String maPickList;
    Integer khoXuatId;
    String tenKhoXuat;
    Integer nguoiNhatId;
    String tenNguoiNhat;
    String trangThai;
    String ghiChu;
    Instant ngayTao;
    Instant ngayHoanTat;

    Integer tongDonHang;
    Integer tongSku;
    BigDecimal tongSoLuongCanNhat;
    BigDecimal tongSoLuongDaQuet;
    Double phanTramHoanThanh;
    Boolean coTheHoanTat;

    List<String> danhSachMaDonHang;
    /**
     * Danh sách đơn hàng chi tiết tham chiếu trong đợt nhặt kèm trạng thái hủy/đang xử lý (SRS 6.3.1)
     */
    List<DonThamChieuDto> danhSachDonHang;
    /**
     * Chỉ có trong kết quả "Hoàn tất nhặt": mã các đơn KHÔNG được tạo phiếu xuất vì đã hủy
     * hoặc đã xuất trước đó (lý do chi tiết ghi trong nhật ký). Hàng đã nhặt cho các đơn này cần trả về kệ.
     */
    List<String> donChuaTaoPhieuXuat;
    List<ChiTietNhatHangDto> chiTietNhatHangs;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    public static class DonThamChieuDto implements Serializable {
        Integer id;
        String soDonHang;
        Integer trangThai;
        String tenTrangThai;
        Boolean biHuy;
    }
}

