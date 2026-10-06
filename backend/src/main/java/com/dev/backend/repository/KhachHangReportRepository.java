package com.dev.backend.repository;

import com.dev.backend.dto.response.KhachHangTangTruongDTO;
import com.dev.backend.entities.KhachHang;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface KhachHangReportRepository extends JpaRepository<KhachHang, Integer> {

    // --------------------------------------------------
    // 1. THEO NGÀY
    // --------------------------------------------------
    @Query(value = """
        SELECT
            ANY_VALUE(DATE_FORMAT(k.ngay, '%d/%m'))              AS nhanThoiGian,
            COUNT(DISTINCT k.khach_moi_id)                       AS soKhachMoi,
            COUNT(DISTINCT k.khach_quay_lai_id)                  AS soKhachQuayLai,
            COUNT(DISTINCT k.tat_ca_id)                          AS tongKhachMua,
            SUM(COUNT(DISTINCT k.khach_moi_id))
                OVER (ORDER BY MIN(k.ngay))                      AS tichLuyKhachMoi,
            ROUND(
                (COUNT(DISTINCT k.khach_moi_id) - LAG(COUNT(DISTINCT k.khach_moi_id))
                    OVER (ORDER BY MIN(k.ngay)))
                / NULLIF(LAG(COUNT(DISTINCT k.khach_moi_id))
                    OVER (ORDER BY MIN(k.ngay)), 0) * 100
            , 2)                                                  AS tyLeTangTruong,
            ANY_VALUE(DAY(k.ngay))                                AS sortKey
        FROM (
            SELECT
                dbh.ngay_giao_hang                               AS ngay,
                CASE WHEN prev.khach_hang_id IS NULL
                     THEN dbh.khach_hang_id END                  AS khach_moi_id,
                CASE WHEN prev.khach_hang_id IS NOT NULL
                     THEN dbh.khach_hang_id END                  AS khach_quay_lai_id,
                dbh.khach_hang_id                                AS tat_ca_id
            FROM don_ban_hang dbh
            LEFT JOIN (
                SELECT DISTINCT khach_hang_id
                FROM don_ban_hang
                WHERE trang_thai IN (3, 5)
                  AND ngay_giao_hang < :tuNgay
            ) prev ON prev.khach_hang_id = dbh.khach_hang_id
            WHERE dbh.trang_thai IN (3, 5)
              AND dbh.ngay_giao_hang >= :tuNgay
              AND dbh.ngay_giao_hang < DATE_ADD(:denNgay, INTERVAL 1 DAY)
              AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
        ) k
        GROUP BY YEAR(k.ngay), MONTH(k.ngay), DAY(k.ngay)
        ORDER BY MIN(k.ngay)
        """, nativeQuery = true)
    List<KhachHangTangTruongDTO> baoCaoTheoNgay(
            @Param("tuNgay") LocalDate tuNgay,
            @Param("denNgay") LocalDate denNgay,
            @Param("khoId")   Integer   khoId
    );

    // --------------------------------------------------
    // 2. THEO TUẦN
    // --------------------------------------------------
    @Query(value = """
        SELECT
            CONCAT('Tuần ', ANY_VALUE(WEEK(k.ngay, 3)))          AS nhanThoiGian,
            COUNT(DISTINCT k.khach_moi_id)                       AS soKhachMoi,
            COUNT(DISTINCT k.khach_quay_lai_id)                  AS soKhachQuayLai,
            COUNT(DISTINCT k.tat_ca_id)                          AS tongKhachMua,
            SUM(COUNT(DISTINCT k.khach_moi_id))
                OVER (ORDER BY WEEK(k.ngay, 3))                  AS tichLuyKhachMoi,
            ROUND(
                (COUNT(DISTINCT k.khach_moi_id) - LAG(COUNT(DISTINCT k.khach_moi_id))
                    OVER (ORDER BY WEEK(k.ngay, 3)))
                / NULLIF(LAG(COUNT(DISTINCT k.khach_moi_id))
                    OVER (ORDER BY WEEK(k.ngay, 3)), 0) * 100
            , 2)                                                  AS tyLeTangTruong,
            WEEK(k.ngay, 3)                                       AS sortKey
        FROM (
            SELECT
                dbh.ngay_giao_hang                               AS ngay,
                CASE WHEN prev.khach_hang_id IS NULL
                     THEN dbh.khach_hang_id END                  AS khach_moi_id,
                CASE WHEN prev.khach_hang_id IS NOT NULL
                     THEN dbh.khach_hang_id END                  AS khach_quay_lai_id,
                dbh.khach_hang_id                                AS tat_ca_id
            FROM don_ban_hang dbh
            LEFT JOIN (
                SELECT DISTINCT khach_hang_id
                FROM don_ban_hang
                WHERE trang_thai IN (3, 5)
                  AND YEAR(ngay_giao_hang) < :nam
            ) prev ON prev.khach_hang_id = dbh.khach_hang_id
            WHERE dbh.trang_thai IN (3, 5)
              AND YEAR(dbh.ngay_giao_hang) = :nam
              AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
        ) k
        GROUP BY YEAR(k.ngay), WEEK(k.ngay, 3)
        ORDER BY sortKey
        """, nativeQuery = true)
    List<KhachHangTangTruongDTO> baoCaoTheoTuan(
            @Param("nam")   Integer nam,
            @Param("khoId") Integer khoId
    );

    // --------------------------------------------------
    // 3. THEO THÁNG
    // --------------------------------------------------
    @Query(value = """
        SELECT
            CONCAT('T', ANY_VALUE(MONTH(k.ngay)), '/', ANY_VALUE(YEAR(k.ngay))) AS nhanThoiGian,
            COUNT(DISTINCT k.khach_moi_id)                       AS soKhachMoi,
            COUNT(DISTINCT k.khach_quay_lai_id)                  AS soKhachQuayLai,
            COUNT(DISTINCT k.tat_ca_id)                          AS tongKhachMua,
            SUM(COUNT(DISTINCT k.khach_moi_id))
                OVER (ORDER BY MONTH(k.ngay))                    AS tichLuyKhachMoi,
            ROUND(
                (COUNT(DISTINCT k.khach_moi_id) - LAG(COUNT(DISTINCT k.khach_moi_id))
                    OVER (ORDER BY MONTH(k.ngay)))
                / NULLIF(LAG(COUNT(DISTINCT k.khach_moi_id))
                    OVER (ORDER BY MONTH(k.ngay)), 0) * 100
            , 2)                                                  AS tyLeTangTruong,
            MONTH(k.ngay)                                         AS sortKey
        FROM (
            SELECT
                dbh.ngay_giao_hang                               AS ngay,
                CASE WHEN prev.khach_hang_id IS NULL
                     THEN dbh.khach_hang_id END                  AS khach_moi_id,
                CASE WHEN prev.khach_hang_id IS NOT NULL
                     THEN dbh.khach_hang_id END                  AS khach_quay_lai_id,
                dbh.khach_hang_id                                AS tat_ca_id
            FROM don_ban_hang dbh
            LEFT JOIN (
                SELECT DISTINCT khach_hang_id
                FROM don_ban_hang
                WHERE trang_thai IN (3, 5)
                  AND YEAR(ngay_giao_hang) < :nam
            ) prev ON prev.khach_hang_id = dbh.khach_hang_id
            WHERE dbh.trang_thai IN (3, 5)
              AND YEAR(dbh.ngay_giao_hang) = :nam
              AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
        ) k
        GROUP BY YEAR(k.ngay), MONTH(k.ngay)
        ORDER BY sortKey
        """, nativeQuery = true)
    List<KhachHangTangTruongDTO> baoCaoTheoThang(
            @Param("nam")   Integer nam,
            @Param("khoId") Integer khoId
    );

    // --------------------------------------------------
    // 4. THEO NĂM
    // --------------------------------------------------
    @Query(value = """
        SELECT
            CAST(ANY_VALUE(YEAR(k.ngay)) AS CHAR)                AS nhanThoiGian,
            COUNT(DISTINCT k.khach_moi_id)                       AS soKhachMoi,
            COUNT(DISTINCT k.khach_quay_lai_id)                  AS soKhachQuayLai,
            COUNT(DISTINCT k.tat_ca_id)                          AS tongKhachMua,
            SUM(COUNT(DISTINCT k.khach_moi_id))
                OVER (ORDER BY YEAR(k.ngay))                     AS tichLuyKhachMoi,
            ROUND(
                (COUNT(DISTINCT k.khach_moi_id) - LAG(COUNT(DISTINCT k.khach_moi_id))
                    OVER (ORDER BY YEAR(k.ngay)))
                / NULLIF(LAG(COUNT(DISTINCT k.khach_moi_id))
                    OVER (ORDER BY YEAR(k.ngay)), 0) * 100
            , 2)                                                  AS tyLeTangTruong,
            YEAR(k.ngay)                                          AS sortKey
        FROM (
            SELECT
                dbh.ngay_giao_hang                               AS ngay,
                CASE WHEN prev.khach_hang_id IS NULL
                     THEN dbh.khach_hang_id END                  AS khach_moi_id,
                CASE WHEN prev.khach_hang_id IS NOT NULL
                     THEN dbh.khach_hang_id END                  AS khach_quay_lai_id,
                dbh.khach_hang_id                                AS tat_ca_id
            FROM don_ban_hang dbh
            LEFT JOIN (
                SELECT DISTINCT khach_hang_id
                FROM don_ban_hang
                WHERE trang_thai IN (3, 5)
                  AND YEAR(ngay_giao_hang) < :tuNam
            ) prev ON prev.khach_hang_id = dbh.khach_hang_id
            WHERE dbh.trang_thai IN (3, 5)
              AND YEAR(dbh.ngay_giao_hang) BETWEEN :tuNam AND :denNam
              AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
        ) k
        GROUP BY YEAR(k.ngay)
        ORDER BY sortKey
        """, nativeQuery = true)
    List<KhachHangTangTruongDTO> baoCaoTheoNam(
            @Param("tuNam")  Integer tuNam,
            @Param("denNam") Integer denNam,
            @Param("khoId")  Integer khoId
    );

    // --------------------------------------------------
    // 5. SO SÁNH CÙNG KỲ
    // --------------------------------------------------
    @Query(value = """
    SELECT
        CASE
            WHEN (ANY_VALUE(YEAR(k.ngay)) = :nam AND ANY_VALUE(MONTH(k.ngay)) = :thang)
                 THEN CONCAT('T', :thang, '/', :nam)
            ELSE CONCAT('T', :thangTruoc, '/', :namTruoc)
        END                                                   AS nhanThoiGian,
        COUNT(DISTINCT k.khach_moi_id)                        AS soKhachMoi,
        COUNT(DISTINCT k.khach_quay_lai_id)                   AS soKhachQuayLai,
        COUNT(DISTINCT k.tat_ca_id)                           AS tongKhachMua,
        COUNT(DISTINCT k.khach_moi_id)                        AS tichLuyKhachMoi,
        NULL                                                  AS tyLeTangTruong,
        ANY_VALUE(MONTH(k.ngay))                              AS sortKey
    FROM (
        SELECT
            dbh.ngay_giao_hang                               AS ngay,
            CASE WHEN prev.khach_hang_id IS NULL
                 THEN dbh.khach_hang_id END                  AS khach_moi_id,
            CASE WHEN prev.khach_hang_id IS NOT NULL
                 THEN dbh.khach_hang_id END                  AS khach_quay_lai_id,
            dbh.khach_hang_id                                AS tat_ca_id
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT DISTINCT khach_hang_id
            FROM don_ban_hang
            WHERE trang_thai IN (3, 5)
              AND ngay_giao_hang < STR_TO_DATE(
                      CONCAT(:namTruoc, '-', :thangTruoc, '-01'), '%Y-%m-%d'
                  )
        ) prev ON prev.khach_hang_id = dbh.khach_hang_id
        WHERE dbh.trang_thai IN (3, 5)
          AND (
              (YEAR(dbh.ngay_giao_hang) = :nam      AND MONTH(dbh.ngay_giao_hang) = :thang)
           OR (YEAR(dbh.ngay_giao_hang) = :namTruoc AND MONTH(dbh.ngay_giao_hang) = :thangTruoc)
          )
          AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
    ) k
    GROUP BY YEAR(k.ngay), MONTH(k.ngay)
    ORDER BY sortKey
    """, nativeQuery = true)
    List<KhachHangTangTruongDTO> soSanhCungKy(
            @Param("nam")        Integer nam,
            @Param("thang")      Integer thang,
            @Param("namTruoc")   Integer namTruoc,
            @Param("thangTruoc") Integer thangTruoc,
            @Param("khoId")      Integer khoId
    );
}