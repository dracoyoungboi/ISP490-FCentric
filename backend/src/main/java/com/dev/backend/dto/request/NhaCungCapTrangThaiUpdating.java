package com.dev.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

/** Ngừng hoạt động (0) / cho phép hoạt động lại (1) một nhà cung cấp. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NhaCungCapTrangThaiUpdating {
    @NotNull(message = "Vui lòng chọn trạng thái")
    @Min(value = 0, message = "Trạng thái không hợp lệ")
    @Max(value = 1, message = "Trạng thái không hợp lệ")
    private Integer trangThai;
}
