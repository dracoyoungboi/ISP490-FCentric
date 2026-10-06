package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CauHinhHeThongUpdateRequest {
    @NotBlank(message = "Giá trị cấu hình không được để trống")
    private String giaTri;
    private String moTa;
}