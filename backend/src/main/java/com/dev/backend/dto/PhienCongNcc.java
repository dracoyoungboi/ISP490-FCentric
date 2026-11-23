package com.dev.backend.dto;

import java.time.Instant;

/**
 * Phiên Cổng nhà cung cấp, tạo khi xác nhận mã đúng: sống 60 phút, chỉ trong bộ nhớ (khởi động lại máy chủ thì nhà cung
 * cấp nhận mã mới). Gắn với email đã xác thực: mỗi lần dùng, các nhà cung cấp được xem tra lại theo email này, nên đổi
 * email nhà cung cấp là phiên của email cũ hết xem được ngay.
 *
 * @param email email đã chuẩn hóa (trim, chữ thường)
 */
public record PhienCongNcc(String email, Instant hetHan) {

    public boolean daHetHan(Instant luc) {
        return hetHan == null || !luc.isBefore(hetHan);
    }
}
