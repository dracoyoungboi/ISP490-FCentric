package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KhoKhaDungDto {
    Integer khoId;
    String maKho;
    String tenKho;
    String diaChi;
    Boolean laKhoTong;
    Boolean duHang;
    Integer soLuongMatHangDu;
    Integer tongSoMatHang;
    List<ChiTietTonKhoKhaDungDto> chiTietTonKho;
    /** Mã đợt kiểm kê đang mở ở kho (đang kiểm / chờ duyệt) làm giảm tồn khả dụng của đơn; null khi không có. */
    String maDotKiemKe;
    /** Đợt kiểm toàn bộ kho: kho tạm không xuất được mã nào. */
    Boolean kiemToanKho;
}
