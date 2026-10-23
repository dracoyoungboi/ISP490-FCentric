package com.dev.backend.services.email;

/**
 * Thư đã dựng xong: tiêu đề, bản HTML, bản chữ thường, Trả lời tới (null: không đặt).
 * {@link #toString()} không in nội dung (có thể chứa mã, mật khẩu).
 */
public record BanThu(String tieuDe, String html, String text, DiaChiTraLoi traLoiToi) {

    /** Trả lời tới: email kèm tên hiển thị. */
    public record DiaChiTraLoi(String email, String ten) {
    }

    @Override
    public String toString() {
        return "BanThu[tieuDe=" + tieuDe + "]";
    }
}
