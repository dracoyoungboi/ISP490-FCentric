// src/main/java/com/dev/backend/dto/request/KhachHangUpdating.java
package com.dev.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KhachHangUpdating {
    @Size(max = 200, message = "Tên khách hàng tối đa 200 ký tự")
    private String tenKhachHang;

    // null = giữ nguyên, "" = xóa; service kiểm tra định dạng
    @Size(max = 14, message = "Mã số thuế tối đa 14 ký tự")
    private String maSoThue;

    @Size(max = 100, message = "Người liên hệ tối đa 100 ký tự")
    private String nguoiLienHe;

    @Size(max = 20, message = "Số điện thoại tối đa 20 ký tự")
    private String soDienThoai;

    @Email(message = "Email không hợp lệ")
    @Size(max = 100, message = "Email tối đa 100 ký tự")
    private String email;

    @Size(max = 500, message = "Địa chỉ tối đa 500 ký tự")  // Giả định Lob max 500
    private String diaChi;

    // "le" | "si" | "doanh_nghiep" — service chuẩn hóa/kiểm tra trước khi ghi
    private String loaiKhachHang;

    private Integer trangThai;
}