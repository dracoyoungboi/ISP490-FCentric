package com.dev.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(description = "Thông tin vận đơn và giao vận khi xác nhận xuất kho (SRS 6.3.2)")
public class XacNhanXuatKhoRequest {

    @Schema(description = "Đơn vị vận chuyển (GHTK, GHN, ViettelPost, Ahamove...)", example = "GHTK")
    String donViVanChuyen;

    @Schema(description = "Mã vận đơn do đơn vị vận chuyển cung cấp", example = "GHTK-HN-8849201")
    String maVanDon;

    @Schema(description = "Cước vận chuyển thực tế", example = "35000.00")
    BigDecimal phiVanChuyenThucTe;

    @Schema(description = "Ghi chú giao nhận / bàn giao hàng", example = "Đã bàn giao cho shipper GHTK lấy hàng")
    String ghiChu;
}

