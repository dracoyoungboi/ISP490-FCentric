package com.dev.backend.repository;

import com.dev.backend.dto.response.DoanhThuChartDTO;
import com.dev.backend.entities.DonBanHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
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
        WHERE dbh.trang_thai = 3
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
}