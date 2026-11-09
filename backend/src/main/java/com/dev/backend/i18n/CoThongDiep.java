package com.dev.backend.i18n;

/** Exception mang câu thông báo theo khóa: bộ xử lý lỗi chung dịch theo ngôn ngữ của request. */
public interface CoThongDiep {

    /** {@code null} nếu exception được tạo bằng câu chữ thường (chưa chuyển khóa). */
    ThongDiep getThongDiep();
}
