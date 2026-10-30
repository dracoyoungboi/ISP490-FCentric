package com.dev.backend.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Một phiên đăng nhập (một thiết bị / trình duyệt). Mỗi lần đăng nhập ghi một dòng; JWT mang mã phiên qua claim "sid".
 * AuthInterceptor đối chiếu mỗi request: thu_hoi_luc có giá trị (đã đăng xuất / bị thu hồi) hoặc het_han_luc đã qua
 * thì phiên không còn hiệu lực. Lưu nguoi_dung_id dạng số (không map quan hệ) để đọc nhẹ ở tầng filter mỗi request.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "phien_dang_nhap")
public class PhienDangNhap {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    // Mã phiên ngẫu nhiên (UUID), nhúng vào JWT dưới claim "sid" để đối chiếu khi mỗi request đến
    @Column(name = "phien_id", nullable = false, length = 36, unique = true)
    String phienId;

    @Column(name = "nguoi_dung_id", nullable = false)
    Integer nguoiDungId;

    @Column(name = "user_agent", length = 512)
    String userAgent;

    @Column(name = "dia_chi_ip", length = 64)
    String diaChiIp;

    // Vị trí suy ra từ IP — để đợt sau (GeoIP offline); hiện để trống
    @Column(name = "vi_tri", length = 128)
    String viTri;

    @Column(name = "tao_luc", nullable = false)
    Instant taoLuc;

    @Column(name = "truy_cap_cuoi", nullable = false)
    Instant truyCapCuoi;

    @Column(name = "het_han_luc", nullable = false)
    Instant hetHanLuc;

    // null = phiên còn hiệu lực; có giá trị = đã đăng xuất / bị thu hồi
    @Column(name = "thu_hoi_luc")
    Instant thuHoiLuc;
}
