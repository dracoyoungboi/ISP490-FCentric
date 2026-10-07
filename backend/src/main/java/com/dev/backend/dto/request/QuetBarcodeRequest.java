package com.dev.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(description = "Yêu cầu quét mã vạch sản phẩm đối soát kệ kho (SRS 6.3.1 Execute Picking)")
public class QuetBarcodeRequest {

    @NotBlank(message = "Mã barcode hoặc SKU không được để trống")
    @Schema(description = "Mã vạch (ma_vach_sku) hoặc mã định danh SKU (ma_sku) được quét từ app Barcode to PC hoặc máy quét", example = "893500123456")
    String barcode;

    @Schema(description = "Số lượng quét trong 1 lần (mặc định 1.000 nếu không truyền)", example = "1.000")
    BigDecimal soLuong;
}

