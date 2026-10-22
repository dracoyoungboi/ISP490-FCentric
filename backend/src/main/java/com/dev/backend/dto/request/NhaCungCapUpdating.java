package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * Sửa thông tin nhà cung cấp: gửi đủ toàn bộ form (trường tùy chọn để trống = xóa giá trị cũ).
 * Không có mã (mã cố định sau khi tạo) và không có trạng thái (đổi bằng PUT /{id}/trang-thai).
 * Không có ngân hàng / số tài khoản: không quản lý thanh toán nhà cung cấp (bỏ khỏi API sửa 22/10/2026). Client cũ gửi
 * kèm hai trường này thì bị bỏ qua (Jackson không báo lỗi trường lạ), dữ liệu ngân hàng đang lưu giữ nguyên — kể cả
 * dữ liệu cũ sai định dạng không còn chặn việc sửa các trường khác.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NhaCungCapUpdating {
    @NotBlank(message = "Vui lòng nhập tên nhà cung cấp")
    @Size(max = 200, message = "Tên nhà cung cấp tối đa 200 ký tự")
    private String tenNhaCungCap;

    @Size(max = 100, message = "Người liên hệ tối đa 100 ký tự")
    private String nguoiLienHe;

    @NotBlank(message = "Vui lòng nhập số điện thoại")
    @Pattern(regexp = NhaCungCapCreating.SO_DIEN_THOAI_PATTERN, message = NhaCungCapCreating.SO_DIEN_THOAI_MESSAGE)
    private String soDienThoai;

    @NotBlank(message = "Vui lòng nhập email")
    @Size(max = 100, message = "Email tối đa 100 ký tự")
    @Pattern(regexp = NhaCungCapCreating.EMAIL_PATTERN, message = "Email không hợp lệ")
    private String email;

    @Size(max = 500, message = "Địa chỉ tối đa 500 ký tự")
    private String diaChi;
}
