package com.dev.backend.repository;

import com.dev.backend.dto.response.DoanhThuChartDTO;
import com.dev.backend.entities.DonBanHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface DoanhThuReportRepository extends JpaRepository<DonBanHang, Integer> {
    // --------------------------------------------------
    // 1. THEO NGÀY  (truyền khoảng ngày, group by ngày)
    // --------------------------------------------------
    /**
     * Ví dụ: từ 2024-06-01 đến 2024-06-30 → 30 điểm dữ liệu
     * Nhãn trục X: "01/06", "02/06", ...
     */
    @Query(value = """
        SELECT
            ANY_VALUE(DATE_FORMAT(dbh.ngay_giao_hang, '%d/%m'))   AS nhanThoiGian,
            SUM(dbh.tien_hang)                                     AS tienHang,
            SUM(dbh.phi_van_chuyen)                                AS phiVanChuyen,
            SUM(dbh.tong_cong)                                     AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                      AS giaVon,
            SUM(dbh.tong_cong) - COALESCE(SUM(gv.tong_gia_von), 0) AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                 AS soLuongDon,
            ANY_VALUE(DAY(dbh.ngay_giao_hang))                     AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT
                pxk.don_ban_hang_id,
                SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho      pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.trang_thai IN (3, 5)
          AND dbh.ngay_giao_hang >= :tuNgay
          AND dbh.ngay_giao_hang < DATE_ADD(:denNgay, INTERVAL 1 DAY)
          AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
        GROUP BY YEAR(dbh.ngay_giao_hang), MONTH(dbh.ngay_giao_hang), DAY(dbh.ngay_giao_hang)
        ORDER BY sortKey
        """,
            nativeQuery = true)
    List<DoanhThuChartDTO> baoCaoTheoNgay(
            @Param("tuNgay") LocalDate tuNgay,
            @Param("denNgay") LocalDate denNgay,
            @Param("khoId")   Integer   khoId
    );


    // --------------------------------------------------
    // 2. THEO TUẦN  (truyền năm, group by tuần ISO)
    // --------------------------------------------------
    /**
     * Ví dụ: năm 2024 → tối đa 53 điểm dữ liệu
     * Nhãn trục X: "Tuần 1", "Tuần 2", ...
     */
    @Query(value = """
        SELECT
            CONCAT('Tuần ', ANY_VALUE(WEEK(dbh.ngay_giao_hang, 3))) AS nhanThoiGian,
            SUM(dbh.tien_hang)                                       AS tienHang,
            SUM(dbh.phi_van_chuyen)                                  AS phiVanChuyen,
            SUM(dbh.tong_cong)                                       AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                        AS giaVon,
            SUM(dbh.tong_cong) - COALESCE(SUM(gv.tong_gia_von), 0)  AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                   AS soLuongDon,
            ANY_VALUE(WEEK(dbh.ngay_giao_hang, 3))                   AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT
                pxk.don_ban_hang_id,
                SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho      pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.trang_thai IN (3, 5)
          AND YEAR(dbh.ngay_giao_hang) = :nam
          AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
        GROUP BY YEAR(dbh.ngay_giao_hang), WEEK(dbh.ngay_giao_hang, 3)
        ORDER BY sortKey
        """,
            nativeQuery = true)
    List<DoanhThuChartDTO> baoCaoTheoTuan(
            @Param("nam")   Integer nam,
            @Param("khoId") Integer khoId
    );


    // --------------------------------------------------
    // 3. THEO THÁNG  (truyền năm, group by tháng)
    // --------------------------------------------------
    /**
     * Ví dụ: năm 2024 → 12 điểm dữ liệu
     * Nhãn trục X: "T1/2024", "T2/2024", ...
     */
    @Query(value = """
        SELECT
            CONCAT('T', ANY_VALUE(MONTH(dbh.ngay_giao_hang)), '/', ANY_VALUE(YEAR(dbh.ngay_giao_hang))) AS nhanThoiGian,
            SUM(dbh.tien_hang)                                       AS tienHang,
            SUM(dbh.phi_van_chuyen)                                  AS phiVanChuyen,
            SUM(dbh.tong_cong)                                       AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                        AS giaVon,
            SUM(dbh.tong_cong) - COALESCE(SUM(gv.tong_gia_von), 0)  AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                   AS soLuongDon,
            ANY_VALUE(MONTH(dbh.ngay_giao_hang))                     AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT
                pxk.don_ban_hang_id,
                SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho      pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.trang_thai IN (3, 5)
          AND YEAR(dbh.ngay_giao_hang) = :nam
          AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
        GROUP BY YEAR(dbh.ngay_giao_hang), MONTH(dbh.ngay_giao_hang)
        ORDER BY sortKey
        """,
            nativeQuery = true)
    List<DoanhThuChartDTO> baoCaoTheoThang(
            @Param("nam")   Integer nam,
            @Param("khoId") Integer khoId
    );


    // --------------------------------------------------
    // 4. THEO NĂM  (truyền khoảng năm, group by năm)
    // --------------------------------------------------
    /**
     * Ví dụ: 2020 → 2024 → 5 điểm dữ liệu
     * Nhãn trục X: "2020", "2021", ...
     */
    @Query(value = """
        SELECT
            CAST(ANY_VALUE(YEAR(dbh.ngay_giao_hang)) AS CHAR)       AS nhanThoiGian,
            SUM(dbh.tien_hang)                                       AS tienHang,
            SUM(dbh.phi_van_chuyen)                                  AS phiVanChuyen,
            SUM(dbh.tong_cong)                                       AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                        AS giaVon,
            SUM(dbh.tong_cong) - COALESCE(SUM(gv.tong_gia_von), 0)  AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                   AS soLuongDon,
            ANY_VALUE(YEAR(dbh.ngay_giao_hang))                      AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT
                pxk.don_ban_hang_id,
                SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho      pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.trang_thai IN (3, 5)
          AND YEAR(dbh.ngay_giao_hang) BETWEEN :tuNam AND :denNam
          AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
        GROUP BY YEAR(dbh.ngay_giao_hang)
        ORDER BY sortKey
        """,
            nativeQuery = true)
    List<DoanhThuChartDTO> baoCaoTheoNam(
            @Param("tuNam")  Integer tuNam,
            @Param("denNam") Integer denNam,
            @Param("khoId")  Integer khoId
    );


    // --------------------------------------------------
    // 5. SO SÁNH CÙNG KỲ (tháng hiện tại vs tháng trước)
    // --------------------------------------------------
    /**
     * Trả về 2 dòng: tháng hiện tại và tháng trước
     * Dùng để vẽ 2 đường trên cùng 1 biểu đồ so sánh
     */
    @Query(value = """
        SELECT
            CASE
                WHEN (ANY_VALUE(YEAR(dbh.ngay_giao_hang)) = :nam AND ANY_VALUE(MONTH(dbh.ngay_giao_hang)) = :thang)
                     THEN CONCAT('T', :thang, '/', :nam)
                ELSE CONCAT('T', :thangTruoc, '/', :namTruoc)
            END                                                      AS nhanThoiGian,
            SUM(dbh.tien_hang)                                       AS tienHang,
            SUM(dbh.phi_van_chuyen)                                  AS phiVanChuyen,
            SUM(dbh.tong_cong)                                       AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                        AS giaVon,
            SUM(dbh.tong_cong) - COALESCE(SUM(gv.tong_gia_von), 0)  AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                   AS soLuongDon,
            ANY_VALUE(MONTH(dbh.ngay_giao_hang))                     AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT pxk.don_ban_hang_id,
                   SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.trang_thai IN (3, 5)
          AND (
              (YEAR(dbh.ngay_giao_hang) = :nam      AND MONTH(dbh.ngay_giao_hang) = :thang)
           OR (YEAR(dbh.ngay_giao_hang) = :namTruoc AND MONTH(dbh.ngay_giao_hang) = :thangTruoc)
          )
          AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
        GROUP BY YEAR(dbh.ngay_giao_hang), MONTH(dbh.ngay_giao_hang)
        ORDER BY sortKey
        """,
            nativeQuery = true)
    List<DoanhThuChartDTO> soSanhCungKy(
            @Param("nam")        Integer nam,
            @Param("thang")      Integer thang,
            @Param("namTruoc")   Integer namTruoc,
            @Param("thangTruoc") Integer thangTruoc,
            @Param("khoId")      Integer khoId
    );

    // --------------------------------------------------
    // 6. TIỀN THU TRONG KỲ (theo ngày thu tiền)
    // --------------------------------------------------
    /**
     * Tiền vào theo ngày thu, gom theo [ngày yyyy-MM-dd, tuần ISO (WEEK mode 3), nguồn POS | DT]: tiền mặt, QR payOS,
     * chuyển khoản ghi tay, hoàn, số phiếu hoàn. POS = sổ thu tại quầy (dòng PAYOS trả kết hợp tách phần tiền mặt);
     * DT = phiếu thu / hoàn còn hiệu lực của đơn bán thường. Khoảng [tu, den). khoIds bỏ qua khi tatCaKho = true.
     */
    @Query(value = """
        SELECT DATE_FORMAT(x.luc, '%Y-%m-%d') AS ngay,
               WEEK(x.luc, 3)                 AS tuan,
               x.nguon                        AS nguon,
               SUM(x.tien_mat)                AS tienMat,
               SUM(x.qr)                      AS qr,
               SUM(x.ck_tay)                  AS ckTay,
               SUM(x.hoan)                    AS hoan,
               SUM(x.so_hoan)                 AS soHoan
        FROM (
            SELECT p.ngay_tao AS luc, d.kho_xuat_id AS kho_id, 'POS' AS nguon,
                   CASE WHEN p.phuong_thuc = 'PAYOS' THEN COALESCE(p.tien_mat_truoc, 0) ELSE p.so_tien_hang END AS tien_mat,
                   CASE WHEN p.phuong_thuc = 'PAYOS' THEN p.so_tien_hang - COALESCE(p.tien_mat_truoc, 0) ELSE 0 END AS qr,
                   0 AS ck_tay, 0 AS hoan, 0 AS so_hoan
            FROM pos_payment p
            JOIN don_ban_hang d ON d.id = p.don_ban_hang_id
            WHERE p.ngay_tao >= :tu AND p.ngay_tao < :den
            UNION ALL
            SELECT t.thoi_diem_thu, COALESCE(t.kho_id, d.kho_xuat_id), 'DT',
                   CASE WHEN t.loai = 'THU' AND t.phuong_thuc = 'TIEN_MAT' THEN t.so_tien ELSE 0 END,
                   0,
                   CASE WHEN t.loai = 'THU' AND t.phuong_thuc = 'CHUYEN_KHOAN' THEN t.so_tien ELSE 0 END,
                   CASE WHEN t.loai = 'HOAN' THEN t.so_tien ELSE 0 END,
                   CASE WHEN t.loai = 'HOAN' THEN 1 ELSE 0 END
            FROM thanh_toan_don_ban t
            JOIN don_ban_hang d ON d.id = t.don_ban_hang_id
            WHERE t.trang_thai = 'HIEU_LUC' AND t.thoi_diem_thu >= :tu AND t.thoi_diem_thu < :den
        ) x
        WHERE (:tatCaKho = TRUE OR x.kho_id IN (:khoIds))
        GROUP BY ngay, tuan, nguon
        """,
            nativeQuery = true)
    List<Object[]> tienThuTheoNgay(@Param("tu") LocalDate tu, @Param("den") LocalDate den,
                                   @Param("tatCaKho") boolean tatCaKho, @Param("khoIds") Collection<Integer> khoIds);

    /** Đơn sàn đã giao trong khoảng [tu, den) theo ngày giao (như doanh thu): [số đơn, tổng cộng]. */
    @Query(value = """
        SELECT COUNT(*), COALESCE(SUM(dbh.tong_cong), 0)
        FROM don_ban_hang dbh
        WHERE dbh.trang_thai IN (3, 5)
          AND dbh.kenh_ban_id IS NOT NULL
          AND dbh.ngay_giao_hang >= :tu AND dbh.ngay_giao_hang < :den
          AND (:tatCaKho = TRUE OR dbh.kho_xuat_id IN (:khoIds))
        """,
            nativeQuery = true)
    List<Object[]> sanThuHo(@Param("tu") LocalDate tu, @Param("den") LocalDate den,
                            @Param("tatCaKho") boolean tatCaKho, @Param("khoIds") Collection<Integer> khoIds);

    /**
     * Còn phải thu tới hiện tại: đơn bán thường đã chốt (không nháp / hủy / hoàn trả, không phải đơn sàn) đang Chưa thanh
     * toán hoặc Thanh toán một phần — [số đơn, tổng phần còn thiếu]. Đơn cũ chưa theo dõi (trạng thái trống) không tính.
     */
    @Query(value = """
        SELECT COUNT(*), COALESCE(SUM(dbh.tong_cong - COALESCE(t.da_thu, 0)), 0)
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT don_ban_hang_id, SUM(CASE WHEN loai = 'THU' THEN so_tien ELSE -so_tien END) AS da_thu
            FROM thanh_toan_don_ban
            WHERE trang_thai = 'HIEU_LUC'
            GROUP BY don_ban_hang_id
        ) t ON t.don_ban_hang_id = dbh.id
        WHERE dbh.loai_chung_tu = 'don_ban_hang'
          AND dbh.kenh_ban_id IS NULL
          AND dbh.trang_thai_thanh_toan IN ('chua_thanh_toan', 'thanh_toan_mot_phan')
          AND dbh.trang_thai NOT IN (0, 4, 6)
          AND dbh.tong_cong - COALESCE(t.da_thu, 0) > 0
          AND (:tatCaKho = TRUE OR dbh.kho_xuat_id IN (:khoIds))
        """,
            nativeQuery = true)
    List<Object[]> conPhaiThu(@Param("tatCaKho") boolean tatCaKho, @Param("khoIds") Collection<Integer> khoIds);

    /** Phiếu chuyển khoản còn hiệu lực chưa đối chiếu sao kê (lọc theo kho của phiếu). */
    @Query(value = """
        SELECT COUNT(*) FROM thanh_toan_don_ban t
        WHERE t.phuong_thuc = 'CHUYEN_KHOAN' AND t.trang_thai = 'HIEU_LUC' AND t.doi_chieu_luc IS NULL
          AND (:tatCaKho = TRUE OR t.kho_id IN (:khoIds))
        """,
            nativeQuery = true)
    long chuaDoiChieu(@Param("tatCaKho") boolean tatCaKho, @Param("khoIds") Collection<Integer> khoIds);
}