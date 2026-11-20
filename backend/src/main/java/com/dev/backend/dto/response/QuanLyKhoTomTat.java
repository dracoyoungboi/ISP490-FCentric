package com.dev.backend.dto.response;

import com.dev.backend.entities.NguoiDung;

/**
 * Một quản lý kho rút gọn (chỉ tên, không liên hệ): ứng viên người quản lý chính ở form Sửa kho
 * (GET /api/v1/kho/{id}/ung-vien-quan-ly) và các quản lý kho cùng làm việc tại kho (KhoDto.quanLyKhac).
 */
public record QuanLyKhoTomTat(Integer id, String hoTen, String tenDangNhap) {

    public static QuanLyKhoTomTat tu(NguoiDung nguoiDung) {
        return new QuanLyKhoTomTat(nguoiDung.getId(), nguoiDung.getHoTen(), nguoiDung.getTenDangNhap());
    }
}
