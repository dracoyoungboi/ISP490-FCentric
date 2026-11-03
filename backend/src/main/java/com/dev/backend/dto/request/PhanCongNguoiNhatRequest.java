package com.dev.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PhanCongNguoiNhatRequest {

    @Schema(description = "ID của nhân viên kho / quản lý kho được phân công nhặt hàng, phải có phân quyền ở kho của phiếu (quản trị viên chỉ tự nhận cho mình)", example = "39", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "ID nhân viên nhặt hàng không được để trống")
    Integer nguoiNhatId;

    @Schema(description = "Ghi chú phân công hoặc hướng dẫn ca làm việc", example = "Phân công nhặt ca sáng kho Hà Nội")
    String ghiChu;
}

