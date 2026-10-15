package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * Thêm nhà cung cấp. Nhà cung cấp mới luôn ở trạng thái Hoạt động (service tự đặt),
 * nên request không có trường trạng thái; ngừng / cho phép hoạt động là thao tác riêng.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NhaCungCapCreating {
    /** Mã: chữ không dấu, số và . _ - (mã còn xuất hiện trên email, bản in, cổng nhà cung cấp). */
    public static final String MA_PATTERN = "^[A-Za-z0-9._-]+$";
    /** Trùng regex email của NguoiDungService để mọi màn báo lỗi email giống nhau. */
    public static final String EMAIL_PATTERN = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$";
    /**
     * Số điện thoại của doanh nghiệp: di động 10 số (03/05/07/08/09), số cố định 11 số (02…)
     * hoặc tổng đài 1800/1900 (8–10 số).
     */
    public static final String SO_DIEN_THOAI_PATTERN = "^(0[35789][0-9]{8}|02[0-9]{9}|1[89]00[0-9]{4,6})$";
    public static final String SO_DIEN_THOAI_MESSAGE =
            "Số điện thoại không hợp lệ (di động 10 số, số bàn 11 số bắt đầu bằng 02, hoặc tổng đài 1800/1900)";
    /** Mã ngân hàng theo VietQR (thường là mã BIN 6 số); để trống được. */
    public static final String NGAN_HANG_PATTERN = "^$|^[A-Za-z0-9]{2,20}$";
    /** Số tài khoản: chữ và số, 4–30 ký tự; để trống được. */
    public static final String SO_TAI_KHOAN_PATTERN = "^$|^[A-Za-z0-9]{4,30}$";

    @NotBlank(message = "Vui lòng nhập mã nhà cung cấp")
    @Size(max = 50, message = "Mã nhà cung cấp tối đa 50 ký tự")
    @Pattern(regexp = MA_PATTERN, message = "Mã nhà cung cấp chỉ gồm chữ không dấu, số và các ký tự . _ -")
    private String maNhaCungCap;

    @NotBlank(message = "Vui lòng nhập tên nhà cung cấp")
    @Size(max = 200, message = "Tên nhà cung cấp tối đa 200 ký tự")
    private String tenNhaCungCap;

    @Size(max = 100, message = "Người liên hệ tối đa 100 ký tự")
    private String nguoiLienHe;

    @NotBlank(message = "Vui lòng nhập số điện thoại")
    @Pattern(regexp = SO_DIEN_THOAI_PATTERN, message = SO_DIEN_THOAI_MESSAGE)
    private String soDienThoai;

    /** Bắt buộc: yêu cầu báo giá gửi qua email này và nhà cung cấp đăng nhập cổng bằng email này. */
    @NotBlank(message = "Vui lòng nhập email")
    @Size(max = 100, message = "Email tối đa 100 ký tự")
    @Pattern(regexp = EMAIL_PATTERN, message = "Email không hợp lệ")
    private String email;

    @Size(max = 500, message = "Địa chỉ tối đa 500 ký tự")
    private String diaChi;

    @Pattern(regexp = NGAN_HANG_PATTERN, message = "Ngân hàng không hợp lệ")
    private String nganHang;

    @Pattern(regexp = SO_TAI_KHOAN_PATTERN, message = "Số tài khoản chỉ gồm chữ và số (4–30 ký tự)")
    private String soNganHang;
}
