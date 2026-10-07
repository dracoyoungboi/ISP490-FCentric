package com.dev.backend.dto.response.customize;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(description = "Kết quả phản hồi sau khi quét mã vạch thành công (SRS 6.3.1)")
public class KetQuaQuetBarcodeDto implements Serializable {

    @Schema(description = "ID dòng chi tiết nhặt hàng")
    Integer chiTietId;

    @Schema(description = "ID biến thể sản phẩm")
    Integer bienTheId;

    @Schema(description = "Mã SKU")
    String maSku;

    @Schema(description = "Mã vạch SKU")
    String maVachSku;

    @Schema(description = "Tên sản phẩm")
    String tenSanPham;

    @Schema(description = "Tên màu sắc")
    String tenMau;

    @Schema(description = "Tên size")
    String tenSize;

    @Schema(description = "Vị trí kệ kho (Location)", example = "A-01-02")
    String viTriKho;

    @Schema(description = "Số lượng yêu cầu cần nhặt")
    BigDecimal soLuongCanNhat;

    @Schema(description = "Số lượng đã quét nhặt tích lũy")
    BigDecimal soLuongDaQuet;

    @Schema(description = "Số lượng còn lại cần nhặt của dòng này")
    BigDecimal soLuongConLai;

    @Schema(description = "Trạng thái dòng mặt hàng (dang_nhat, da_xong)", example = "dang_nhat")
    String trangThaiDong;

    @Schema(description = "Tổng số lượng cần nhặt toàn bộ đợt")
    BigDecimal tongSoLuongCanNhat;

    @Schema(description = "Tổng số lượng đã quét toàn bộ đợt")
    BigDecimal tongSoLuongDaQuet;

    @Schema(description = "Tổng số lượng còn lại toàn bộ đợt")
    BigDecimal tongSoLuongConLai;

    @Schema(description = "Tỷ lệ phần trăm hoàn thành (%)", example = "41.67")
    Double phanTramHoanThanh;

    @Schema(description = "Cờ cho phép bật nút Complete Picking (true khi 100% các dòng đã nhặt đủ)", example = "false")
    Boolean coTheHoanTat;

    @Schema(description = "Thông báo kết quả quét hiển thị trên màn hình", example = "Đã quét 1x Áo Thun Oversize (2/3)")
    String thongBao;
}

