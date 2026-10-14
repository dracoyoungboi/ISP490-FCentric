package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * Sửa thông tin nhà cung cấp: gửi đủ toàn bộ form (trường tùy chọn để trống = xóa giá trị cũ).
 * Không có mã (mã cố định sau khi tạo) và không có trạng thái (đổi bằng PUT /{id}/trang-thai).
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

    @Pattern(regexp = NhaCungCapCreating.NGAN_HANG_PATTERN, message = "Ngân hàng không hợp lệ")
    private String nganHang;

    @Pattern(regexp = NhaCungCapCreating.SO_TAI_KHOAN_PATTERN, message = "Số tài khoản chỉ gồm chữ và số (4–30 ký tự)")
    private String soNganHang;
}
