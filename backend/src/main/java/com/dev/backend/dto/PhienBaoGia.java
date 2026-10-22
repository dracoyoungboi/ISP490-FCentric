package com.dev.backend.dto;

import java.time.Instant;

/**
 * Phiên báo giá của nhà cung cấp, tạo khi xác nhận mã đúng (K10: sống 60 phút, chỉ trong bộ nhớ; khởi động lại
 * máy chủ thì nhà cung cấp nhận mã mới). Chỉ dùng được cho đúng đơn và đúng email đã xác nhận.
 *
 * @param email email đã chuẩn hóa (trim, chữ thường)
 */
public record PhienBaoGia(Integer donMuaHangId, String email, Instant hetHan) {

    public boolean daHetHan(Instant luc) {
        return hetHan == null || !luc.isBefore(hetHan);
    }
}
