package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CauHinhHeThongBulkUpdateRequest {
    @NotBlank(message = "Mã cấu hình không được để trống")
    private String maCauHinh;

    @NotBlank(message = "Giá trị cấu hình không được để trống")
    private String giaTri;
}