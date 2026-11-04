package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/**
 * Một kệ trong phân bổ nhặt theo kệ (kiểm kê khoanh vùng 8.2): ở dòng phiếu nhặt là phần lấy ở kệ này; ở hộp Chọn lô là
 * phần của lô còn lấy được trên kệ. {@code dangKiemKe}: kệ đang bị giữ cho kiểm kê, không lấy được.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KeNhatDto {
    Integer viTriKhoId;
    String maViTri;
    BigDecimal soLuong;
    Boolean dangKiemKe;
}
