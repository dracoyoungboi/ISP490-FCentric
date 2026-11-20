package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JoinFormula;
import org.hibernate.generator.EventType;

import java.time.Instant;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "kho")
public class Kho {
    /*
     * Người quản lý chính của kho = quản lý kho có dấu la_quan_ly_kho = 1 trên dòng phân quyền CỦA CHÍNH KHO ĐÓ, phân quyền
     * còn hiệu lực, tài khoản đang hoạt động. Tính lúc đọc nên hết hạn phân quyền, khóa tài khoản, đổi vai trò hay đổi kho
     * đều tự bỏ người đó khỏi vị trí, không cần đồng bộ; và vì mỗi người chỉ giữ chỗ ở một kho nên không ai đứng tên hai kho.
     * Hiệu lực so với NOW() của phiên MySQL (cột TIMESTAMP, phiên ép múi giờ +07:00 ở chuỗi kết nối), như KhoTomTatRepository.
     * Hai dấu cùng kho (hai quản trị viên lưu cùng lúc) thì lấy dòng phân quyền cấp trước.
     */
    private static final String SQL_QUAN_LY_CHINH_DAU = "(select pq_qlc.nguoi_dung_id from phan_quyen_nguoi_dung_kho pq_qlc"
            + " join nguoi_dung nd_qlc on nd_qlc.id = pq_qlc.nguoi_dung_id"
            + " where pq_qlc.kho_id = ";
    private static final String SQL_QUAN_LY_CHINH_CUOI = " and pq_qlc.la_quan_ly_kho = 1 and pq_qlc.trang_thai = 1"
            + " and (pq_qlc.ngay_bat_dau is null or pq_qlc.ngay_bat_dau <= now())"
            + " and (pq_qlc.ngay_ket_thuc is null or pq_qlc.ngay_ket_thuc > now())"
            + " and nd_qlc.trang_thai = 1 and nd_qlc.vai_tro = 'quan_ly_kho'"
            + " order by pq_qlc.id limit 1)";
    /** Công thức cho {@link #quanLy}: Hibernate tự gắn bí danh bảng kho vào "id". */
    public static final String SQL_QUAN_LY_CHINH = SQL_QUAN_LY_CHINH_DAU + "id" + SQL_QUAN_LY_CHINH_CUOI;

    /** Câu con trả id người quản lý chính, dùng trong SQL thô; {@code cotIdKho} vd. "k.id". */
    public static String sqlQuanLyChinh(String cotIdKho) {
        return SQL_QUAN_LY_CHINH_DAU + cotIdKho + SQL_QUAN_LY_CHINH_CUOI;
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_kho", nullable = false, length = 50)
    String maKho;

    @Size(max = 100)
    @NotNull
    @Column(name = "ten_kho", nullable = false, length = 100)
    String tenKho;

    /** kho_tong: Kho tổng phân phối hàng; cua_hang: kho bán hàng. */
    @Size(max = 20)
    @Column(name = "loai_kho", length = 20)
    String loaiKho;

    @Column(name = "dia_chi")
    String diaChi;

    /**
     * Người quản lý chính, CHỈ ĐỌC: tính lúc đọc từ phân quyền ({@link #SQL_QUAN_LY_CHINH}), không lưu ở kho.
     * Đổi người quản lý chính qua KhoService (gắn dấu la_quan_ly_kho trên dòng phân quyền), không qua setter này.
     * Cột kho.quan_ly_id cũ ngừng dùng (Database/migration-2026-11-20-quan-ly-chinh-kho.sql).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinFormula(SQL_QUAN_LY_CHINH)
    NguoiDung quanLy;

    @ColumnDefault("0")
    @Column(name = "trang_thai")
    Integer trangThai;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;


}