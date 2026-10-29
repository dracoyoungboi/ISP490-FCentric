package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CauHinhHeThongBulkUpdateRequest {
    @NotBlank(message = "Mã cấu hình không được để trống")
    private String maCauHinh;

    // Chuỗi rỗng chỉ hợp lệ với cấu hình cho phép để trống (ký hiệu XKNB): DieuHanhHeThongServiceImpl.bulkUpdateCauHinh kiểm
    @NotNull(message = "Giá trị cấu hình không được để trống")
    private String giaTri;
}