package com.dev.backend.services.email;

import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.dto.email.NguoiPhuTrachEmail;
import lombok.Builder;

import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Một email cần gửi. Dữ liệu ({@code duLieu}) đã dựng xong trong transaction của nơi gọi, chỉ gồm chuỗi / số /
 * boolean (không entity). Thông tin cửa hàng do dispatcher đọc lúc gửi.
 *
 * @param tieuDe        tiêu đề theo cửa hàng lúc gửi (E4, M1 có đuôi "– {tên cửa hàng}")
 * @param nguoiPhuTrach phần ký và Trả lời tới (email nhà cung cấp); null thì bỏ phần ký
 * @param maDon         chỉ để ghi log
 * @param khiGuiDuoc    chạy trên luồng gửi, KHÔNG có transaction (ví dụ ghi ngay_gui_yeu_cau qua repository riêng)
 * @param khiThatBai    khi bỏ hẳn (hết lượt thử, lỗi dựng mẫu, hàng đợi đầy)
 * @param conHieuLuc    kiểm trước mỗi lần gửi; false thì bỏ (ví dụ mã đã bị thay bằng mã mới)
 */
@Builder(toBuilder = true)
public record EmailGui(LoaiEmail loai, String den, Function<CuaHangEmail, String> tieuDe, Object duLieu,
                       NguoiPhuTrachEmail nguoiPhuTrach, String maDon, Runnable khiGuiDuoc,
                       Consumer<Exception> khiThatBai, BooleanSupplier conHieuLuc) {

    public EmailGui {
        Objects.requireNonNull(loai, "loai");
        Objects.requireNonNull(den, "den");
        Objects.requireNonNull(tieuDe, "tieuDe");
        Objects.requireNonNull(duLieu, "duLieu");
    }

    /** Không in dữ liệu thư (có thể chứa mã, mật khẩu). */
    @Override
    public String toString() {
        return "EmailGui[" + loai + ", den=" + den + (maDon == null ? "" : ", don=" + maDon) + "]";
    }
}
