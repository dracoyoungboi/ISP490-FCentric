package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/** Một lô trong phân bổ của dòng phiếu nhặt (cột "Lô phân bổ" ở màn nhặt hàng). */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PhanBoLoDto {
    Integer loHangId;
    String maLo;
    BigDecimal soLuong;
    /** Ngày lô nhập vào kho xuất (căn cứ FIFO). */
    Instant ngayNhapGanNhat;
    /**
     * Lấy ở kệ nào (thứ tự lấy), chỉ khi phiếu đang mở. Rỗng: không lấy ở kệ nào, hoặc phân bổ chưa ghi kệ (xem chuaCoKe).
     * Null: phiếu đã kết thúc nhặt hoặc CSDL chưa nâng cấp — không hiện chỗ lấy.
     */
    java.util.List<KeNhatDto> viTri;
    /** Phần lấy ở hàng chưa có kệ = soLuong − tổng các kệ. Null khi phân bổ chưa ghi kệ. */
    BigDecimal chuaCoKe;
}
