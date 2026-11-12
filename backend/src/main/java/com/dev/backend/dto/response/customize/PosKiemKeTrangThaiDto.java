package com.dev.backend.dto.response.customize;

import java.util.List;

/**
 * Kho đang bán có đợt kiểm kê nào đang giữ khóa (đang kiểm / chờ duyệt) — quầy hiện dải báo và tắt thanh toán khi cả kho
 * đang kiểm. {@code toanKho}: có đợt kiểm toàn bộ kho (không bán được mã nào); ngược lại chỉ các mã thuộc phạm vi đợt
 * không bán được (danh mục, khu vực, kệ).
 */
public record PosKiemKeTrangThaiDto(boolean dangKiemKe, boolean toanKho, List<Dot> dots) {

    /** {@code loai}: toan_bo | theo_khu_vuc | theo_ke | theo_danh_muc; {@code trangThai}: 1 đang kiểm, 2 chờ duyệt. */
    public record Dot(String maDot, String loai, Integer trangThai) {
    }
}
