// src/main/java/com/dev/backend/dto/request/KhachHangUpdating.java
package com.dev.backend.dto.request;

import lombok.*;

/**
 * Sửa khách hàng (PUT /api/v1/khach-hang/{id}). Trường chuỗi: null = giữ nguyên, "" = xóa.
 * Độ dài, định dạng, trùng… do KhachHangService kiểm (câu báo lỗi theo khóa i18n, chỉ kiểm ô thực sự đổi).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KhachHangUpdating {
    private String tenKhachHang;

    private String maSoThue;

    private String nguoiLienHe;

    private String soDienThoai;

    private String email;

    private String diaChi;

    // "le" | "si" | "doanh_nghiep" — service chuẩn hóa/kiểm tra trước khi ghi
    private String loaiKhachHang;

    private Integer trangThai;
}
