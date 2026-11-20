package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LoHangKhaiBaoDto {
    Integer chiTietPhieuNhapKhoId; // để update / delete
    Integer loHangId;
    String maLo;
    Instant ngaySanXuat;
    // Số trên DÒNG phiếu nhập này của lô (số vào tồn khi nhập kho), không phải số nhập ban đầu ghi trên lô: phiếu chuyển
    // kho / khách trả dùng lô thật của kho gửi. Phiếu đơn mua: bằng số Đạt của lô (khóa lô ghi hai số bằng nhau).
    BigDecimal soLuongNhap;
    BigDecimal soLuongLoi;  // số lượng lỗi (chỉ phiếu đơn mua; phiếu khác luôn 0)
    /** Kệ của lô; lô xếp nhiều kệ thì đây là kệ chính (kệ đầu tiên của {@link #phanKe}). */
    Integer viTriKhoId;
    String maViTri;
    String trangThai;
    String ghiChu;
    /** Hàng không đạt theo lý do, tổng = soLuongLoi (lô khai báo trước khi có bảng chi tiết thì rỗng). */
    List<ChiTietLoiLoHangDto> chiTietLoi;
    /** Hàng đạt theo từng kệ khi lô xếp từ hai kệ trở lên, theo thứ tự quét; lô một kệ thì rỗng. */
    List<PhanKeDto> phanKe;

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PhanKeDto {
        Integer viTriKhoId;
        String maViTri;
        Integer soLuong;
    }
}
