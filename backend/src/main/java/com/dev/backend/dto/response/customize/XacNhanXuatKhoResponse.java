package com.dev.backend.dto.response.customize;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(description = "Kết quả xác nhận xuất kho và điều phối giao vận (SRS 6.3.2)")
public class XacNhanXuatKhoResponse {

    @Schema(description = "ID phiếu xuất kho", example = "15")
    Integer phieuXuatKhoId;

    @Schema(description = "Mã số phiếu xuất", example = "PXK-20261009-001")
    String soPhieuXuat;

    @Schema(description = "ID đơn bán hàng liên kết", example = "42")
    Integer donBanHangId;

    @Schema(description = "Mã số đơn bán hàng", example = "SO-20261009-005")
    String soDonHang;

    @Schema(description = "Trạng thái phiếu xuất (3: Đã xuất)", example = "3")
    Integer trangThaiPhieu;

    @Schema(description = "Trạng thái đơn bán hàng (3: Đã xuất toàn bộ / Đang giao)", example = "3")
    Integer trangThaiDonHang;

    @Schema(description = "Đơn vị vận chuyển", example = "GHTK")
    String donViVanChuyen;

    @Schema(description = "Mã vận đơn", example = "GHTK-HN-8849201")
    String maVanDon;

    @Schema(description = "Cước vận chuyển thực tế", example = "35000.00")
    BigDecimal phiVanChuyenThucTe;

    @Schema(description = "Thời điểm xuất kho")
    Instant ngayXuat;

    @Schema(description = "Họ tên người xác nhận xuất kho")
    String nguoiXuatTen;

    @Schema(description = "Thông báo kết quả")
    String message;
}

