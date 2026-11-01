package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Liên kết đặt mật khẩu gửi qua email (tạo tài khoản, quản trị viên cấp lại). Mã gốc chỉ nằm trong email; bảng giữ
 * SHA-256 của mã nên lộ CSDL cũng không dùng được liên kết. Một liên kết dùng một lần: da_dung_luc có giá trị là hết;
 * huy_luc có giá trị là đã bị hủy (có liên kết mới hơn, hoặc mật khẩu vừa đổi bằng Quên mật khẩu / Đổi mật khẩu).
 * Lưu nguoi_dung_id dạng số (không map quan hệ) như phien_dang_nhap.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "lien_ket_dat_mat_khau")
public class LienKetDatMatKhau {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Column(name = "nguoi_dung_id", nullable = false)
    Integer nguoiDungId;

    // SHA-256 (hex thường) của mã trong liên kết
    @Column(name = "ma_bam", nullable = false, length = 64, unique = true)
    String maBam;

    // TAO_TAI_KHOAN | CAP_LAI
    @Column(name = "muc_dich", nullable = false, length = 20)
    String mucDich;

    @Column(name = "tao_luc", nullable = false)
    Instant taoLuc;

    @Column(name = "het_han_luc", nullable = false)
    Instant hetHanLuc;

    // null = chưa dùng
    @Column(name = "da_dung_luc")
    Instant daDungLuc;

    // null = chưa bị hủy (liên kết mới hơn thay thế, hoặc mật khẩu đổi bằng cách khác)
    @Column(name = "huy_luc")
    Instant huyLuc;

    // Quản trị viên tạo liên kết (null nếu không xác định)
    @Column(name = "tao_boi")
    Integer taoBoi;
}
