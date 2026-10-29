package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Thông báo của một người nhận (chuông trên thanh trên cùng). Bảng thong_bao có sẵn trong lược đồ gốc (MyDB_v1.3.sql);
 * Database/migration-2026-10-28-thong-bao.sql chỉ thêm các cột tone, duong_dan, kho_id, khoa_su_kien.
 * Ghi qua ThongBaoService (sau khi giao dịch nghiệp vụ commit; người đã có cùng khóa sự kiện thì bỏ qua, khóa duy nhất
 * (nguoi_dung_id, khoa_su_kien) chặn trùng lần cuối), job ThongBaoCleanupJob xóa dòng cũ hơn 90 ngày.
 * Dòng có sẵn từ trước (khoa_su_kien trống, gồm thông báo gửi chung nguoi_dung_id = NULL) không hiện ở chuông.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "thong_bao")
public class ThongBao {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Long id;

    @NotNull
    @Column(name = "nguoi_dung_id")
    Integer nguoiNhanId;

    /** Nhóm theo lược đồ gốc: don_hang | ton_kho | he_thong | phe_duyet | khac. */
    @Size(max = 20)
    @NotNull
    @Column(name = "loai_thong_bao", length = 20)
    String loai;

    /** Màu ô biểu tượng: info | warning | danger | success. */
    @Size(max = 20)
    @Column(name = "tone", length = 20)
    String tone;

    @Size(max = 255)
    @NotNull
    @Column(name = "tieu_de", nullable = false)
    String tieuDe;

    @Size(max = 500)
    @NotNull
    @Column(name = "noi_dung", nullable = false, columnDefinition = "TEXT")
    String moTa;

    @Size(max = 255)
    @Column(name = "duong_dan")
    String duongDan;

    /** Chứng từ gây ra thông báo; giao diện chọn biểu tượng theo mã này (vd. phieu_chuyen_kho). */
    @Size(max = 50)
    @Column(name = "loai_tham_chieu", length = 50)
    String loaiThamChieu;

    @Column(name = "id_tham_chieu")
    Integer idThamChieu;

    @Column(name = "kho_id")
    Integer khoId;

    /** Khóa sự kiện (vd. PCK:12:DUYET): mỗi người nhận chỉ một dòng cho một khóa. */
    @Size(max = 100)
    @NotNull
    @Column(name = "khoa_su_kien", length = 100)
    String khoaSuKien;

    @Builder.Default
    @Column(name = "da_doc")
    Boolean daDoc = false;

    @Column(name = "ngay_tao")
    Instant ngayTao;
}
