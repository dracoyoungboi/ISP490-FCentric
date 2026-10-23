package com.dev.backend.services.email;

/**
 * Chín loại email: tên mẫu (templates/email/{mau}.html và .txt), có thử lại khi SMTP lỗi tạm thời không,
 * gửi nhà cung cấp hay nhân sự (quyết định chân email, Trả lời tới).
 */
public enum LoaiEmail {
    /** Không thử lại: người dùng đang chờ ở trang Quên mật khẩu, bấm gửi lại là có mã mới. */
    E1("e1-ma-dat-lai-mat-khau", false, false),
    E2("e2-tai-khoan-moi", true, false),
    E3("e3-cap-lai-mat-khau", true, false),
    M4("m4-da-doi-mat-khau", true, false),
    E4("e4-yeu-cau-bao-gia", true, true),
    /** Gửi thẳng trong request (không qua hàng đợi), lỗi thì báo nhà cung cấp thử lại. */
    E5("e5-ma-xac-nhan-bao-gia", false, true),
    M3("m3-da-nhan-bao-gia", true, true),
    M1("m1-xac-nhan-dat-hang", true, true),
    M2("m2-ket-qua-bao-gia", true, true);

    private final String mau;
    private final boolean thuLai;
    private final boolean nhaCungCap;

    LoaiEmail(String mau, boolean thuLai, boolean nhaCungCap) {
        this.mau = mau;
        this.thuLai = thuLai;
        this.nhaCungCap = nhaCungCap;
    }

    /** Tên mẫu HTML (resolver tự thêm ".html"). */
    public String mauHtml() {
        return mau;
    }

    /** Tên mẫu chữ thường. */
    public String mauText() {
        return mau + ".txt";
    }

    public boolean thuLai() {
        return thuLai;
    }

    public boolean nhaCungCap() {
        return nhaCungCap;
    }
}
