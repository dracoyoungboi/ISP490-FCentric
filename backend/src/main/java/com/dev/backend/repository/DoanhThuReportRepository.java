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

/**
 * Báo cáo doanh thu (màn /reports/revenue). Cùng luật doanh thu với màn Tổng quan (TongQuanQuanTriRepository) và Báo
 * cáo sản phẩm, để ba màn ra một số:
 * - Chỉ đơn bán (loai_chung_tu = 'don_ban_hang') đã xuất đủ hàng (trạng thái 3, 5, và 6: đơn bị hoàn vẫn là bán ở ngày
 *   xuất). Doanh thu = tổng cộng − phí vận chuyển − thuế GTGT (đơn sàn không ghi thuế). tienHang = tổng cộng − phí vận
 *   chuyển (còn gồm thuế), phiVanChuyen chỉ để xem.
 * - Hàng khách trả tại quầy và đơn sàn bị hoàn trừ vào kỳ chứa ngày trả / ngày hoàn (hangTraTheoNgay); giá vốn cộng lại
 *   phần hàng còn bán được.
 * - Giá vốn chỉ cộng dòng phiếu xuất CÓ LÔ (số thực xuất, giá vốn của lô). Phiếu xuất của đơn qua nhặt hàng
 *   còn có dòng gốc không lô (số cần xuất); cộng cả hai thì giá vốn bị nhân đôi.
 * Còn khác Tổng quan: chỉ lấy đơn có ngay_giao_hang (Tổng quan lấy ngày phiếu xuất cuối khi thiếu) và nhóm ngày theo
 * giờ CSDL trả về (Tổng quan bù lệch múi giờ).
 */
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
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0))  AS tienHang,
            SUM(dbh.phi_van_chuyen)                                AS phiVanChuyen,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                      AS giaVon,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) - COALESCE(SUM(gv.tong_gia_von), 0) AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                 AS soLuongDon,
            ANY_VALUE(DAY(dbh.ngay_giao_hang))                     AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT
                pxk.don_ban_hang_id,
                SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho      pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.loai_chung_tu = 'don_ban_hang'
          AND dbh.trang_thai IN (3, 5, 6)
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
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0))    AS tienHang,
            SUM(dbh.phi_van_chuyen)                                  AS phiVanChuyen,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                        AS giaVon,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) - COALESCE(SUM(gv.tong_gia_von), 0) AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                   AS soLuongDon,
            ANY_VALUE(WEEK(dbh.ngay_giao_hang, 3))                   AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT
                pxk.don_ban_hang_id,
                SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho      pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.loai_chung_tu = 'don_ban_hang'
          AND dbh.trang_thai IN (3, 5, 6)
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
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0))    AS tienHang,
            SUM(dbh.phi_van_chuyen)                                  AS phiVanChuyen,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                        AS giaVon,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) - COALESCE(SUM(gv.tong_gia_von), 0) AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                   AS soLuongDon,
            ANY_VALUE(MONTH(dbh.ngay_giao_hang))                     AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT
                pxk.don_ban_hang_id,
                SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho      pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.loai_chung_tu = 'don_ban_hang'
          AND dbh.trang_thai IN (3, 5, 6)
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
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0))    AS tienHang,
            SUM(dbh.phi_van_chuyen)                                  AS phiVanChuyen,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                        AS giaVon,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) - COALESCE(SUM(gv.tong_gia_von), 0) AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                   AS soLuongDon,
            ANY_VALUE(YEAR(dbh.ngay_giao_hang))                      AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT
                pxk.don_ban_hang_id,
                SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho      pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.loai_chung_tu = 'don_ban_hang'
          AND dbh.trang_thai IN (3, 5, 6)
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
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0))    AS tienHang,
            SUM(dbh.phi_van_chuyen)                                  AS phiVanChuyen,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) AS doanhThu,
            COALESCE(SUM(gv.tong_gia_von), 0)                        AS giaVon,
            SUM(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) - COALESCE(SUM(gv.tong_gia_von), 0) AS loiNhuan,
            COUNT(DISTINCT dbh.id)                                   AS soLuongDon,
            ANY_VALUE(MONTH(dbh.ngay_giao_hang))                     AS sortKey
        FROM don_ban_hang dbh
        LEFT JOIN (
            SELECT pxk.don_ban_hang_id,
                   SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS tong_gia_von
            FROM phieu_xuat_kho pxk
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
            WHERE pxk.trang_thai = 3
            GROUP BY pxk.don_ban_hang_id
        ) gv ON gv.don_ban_hang_id = dbh.id
        WHERE dbh.loai_chung_tu = 'don_ban_hang'
          AND dbh.trang_thai IN (3, 5, 6)
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
     * Tiền vào tại quầy theo ngày thu, gom theo [ngày yyyy-MM-dd, tuần ISO (WEEK mode 3)]: tiền mặt, QR payOS, tiền hoàn
     * trả hàng, số phiếu trả hàng. Tiền thu lấy từ sổ thu POS (dòng PAYOS trả kết hợp tách phần tiền mặt). Khoảng
     * [tu, den). khoIds bỏ qua khi tatCaKho = true.
     */
    @Query(value = """
        SELECT DATE_FORMAT(x.luc, '%Y-%m-%d') AS ngay,
               WEEK(x.luc, 3)                 AS tuan,
               SUM(x.tien_mat)                AS tienMat,
               SUM(x.qr)                      AS qr,
               SUM(x.hoan)                    AS hoan,
               SUM(x.so_hoan)                 AS soHoan
        FROM (
            SELECT p.ngay_tao AS luc, d.kho_xuat_id AS kho_id,
                   CASE WHEN p.phuong_thuc = 'PAYOS' THEN COALESCE(p.tien_mat_truoc, 0) ELSE p.so_tien_hang END AS tien_mat,
                   CASE WHEN p.phuong_thuc = 'PAYOS' THEN p.so_tien_hang - COALESCE(p.tien_mat_truoc, 0) ELSE 0 END AS qr,
                   0 AS hoan, 0 AS so_hoan
            FROM pos_payment p
            JOIN don_ban_hang d ON d.id = p.don_ban_hang_id
            WHERE p.ngay_tao >= :tu AND p.ngay_tao < :den
            UNION ALL
            -- Trả hàng tại quầy: cửa hàng nhận trả (B) chi tiền hoàn (GBR-RET-06)
            SELECT r.ngay_tao, r.kho_nhan_id, 0, 0, r.tong_tien_hoan, 1
            FROM phieu_tra_hang r
            WHERE r.ngay_tao >= :tu AND r.ngay_tao < :den
        ) x
        WHERE (:tatCaKho = TRUE OR x.kho_id IN (:khoIds))
        GROUP BY ngay, tuan
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

    // --------------------------------------------------
    // 7. THEO KÊNH, THEO NHÂN VIÊN (cả kỳ)
    // --------------------------------------------------
    /**
     * Doanh thu cả kỳ [tu, den) theo kênh bán, cùng điều kiện đơn với các câu theo ngày ở trên (tổng các kênh = doanh thu
     * kỳ): [mã kênh, tên kênh, doanh thu, giá vốn, số đơn, số đơn bị hoàn]. Mã kênh: K + id kênh bán (sàn, web); POS = đơn
     * từ quầy hoặc gắn bản ghi kênh mã POS; TRUC_TIEP = còn lại (như bộ lọc kênh của Báo cáo sản phẩm). Số đơn hoàn: đơn
     * bán trong kỳ mà tới nay đã bị hoàn / trả hết. Đơn sàn bị hoàn trừ doanh thu ở ngày hoàn, trả tại quầy ở ngày trả.
     */
    @Query(value = """
        SELECT x.kenh, MAX(x.ten_kenh), SUM(x.doanh_thu), SUM(x.gia_von), SUM(x.so_don), SUM(x.so_hoan)
        FROM (
            SELECT CASE WHEN kb.id IS NOT NULL AND COALESCE(kb.ma_kenh, '') <> 'POS' THEN CONCAT('K', kb.id)
                        WHEN kb.id IS NOT NULL
                          OR EXISTS (SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = dbh.id) THEN 'POS'
                        ELSE 'TRUC_TIEP' END                                        AS kenh,
                   CASE WHEN COALESCE(kb.ma_kenh, '') <> 'POS' THEN kb.ten_kenh END  AS ten_kenh,
                   (dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) AS doanh_thu,
                   COALESCE((
                        SELECT SUM(ctpx.so_luong_xuat * ctpx.gia_von)
                        FROM phieu_xuat_kho pxk
                        JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
                        WHERE pxk.don_ban_hang_id = dbh.id AND pxk.trang_thai = 3), 0) AS gia_von,
                   1                                                                 AS so_don,
                   CASE WHEN dbh.trang_thai = 6 OR dbh.trang_thai_tra_hang = 'da_tra_het' THEN 1 ELSE 0 END AS so_hoan
            FROM don_ban_hang dbh
            LEFT JOIN kenh_ban_hang kb ON kb.id = dbh.kenh_ban_id
            WHERE dbh.loai_chung_tu = 'don_ban_hang'
              AND (:tatCaKho = TRUE OR dbh.kho_xuat_id IN (:khoIds))
              AND dbh.trang_thai IN (3, 5, 6) AND dbh.ngay_giao_hang >= :tu AND dbh.ngay_giao_hang < :den
            UNION ALL
            -- Đơn sàn bị hoàn: trừ doanh thu và giá vốn của kênh ở ngày hoàn (giá vốn cộng lại cả, hàng hoàn không ghi lỗi)
            SELECT CASE WHEN kb.id IS NOT NULL AND COALESCE(kb.ma_kenh, '') <> 'POS' THEN CONCAT('K', kb.id)
                        WHEN kb.id IS NOT NULL
                          OR EXISTS (SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = dbh.id) THEN 'POS'
                        ELSE 'TRUC_TIEP' END,
                   CASE WHEN COALESCE(kb.ma_kenh, '') <> 'POS' THEN kb.ten_kenh END,
                   -(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)),
                   -COALESCE((SELECT SUM(ctpx.so_luong_xuat * ctpx.gia_von) FROM phieu_xuat_kho pxk
                               JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
                              WHERE pxk.don_ban_hang_id = dbh.id AND pxk.trang_thai = 3), 0), -1, 0
            FROM don_ban_hang dbh
            LEFT JOIN kenh_ban_hang kb ON kb.id = dbh.kenh_ban_id
            WHERE dbh.loai_chung_tu = 'don_ban_hang' AND dbh.trang_thai = 6 AND dbh.ngay_giao_hang IS NOT NULL
              AND (:tatCaKho = TRUE OR dbh.kho_xuat_id IN (:khoIds))
              AND COALESCE((SELECT MAX(pn.ngay_nhap) FROM phieu_xuat_kho px JOIN phieu_nhap_kho pn ON pn.so_phieu_nhap LIKE 'PN-RET%' AND pn.trang_thai = 3 AND pn.phieu_chuyen_kho_id IS NULL AND pn.ghi_chu LIKE 'Nhập hoàn trả từ phiếu xuất: %' AND SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING(pn.ghi_chu, CHAR_LENGTH('Nhập hoàn trả từ phiếu xuất: ') + 1), ' ', 1), '(', 1), CHAR(10 USING utf8mb4), 1), CHAR(13 USING utf8mb4), 1) = px.so_phieu_xuat WHERE px.don_ban_hang_id = dbh.id AND px.trang_thai = 3), dbh.ngay_cap_nhat) >= :tu AND COALESCE((SELECT MAX(pn.ngay_nhap) FROM phieu_xuat_kho px JOIN phieu_nhap_kho pn ON pn.so_phieu_nhap LIKE 'PN-RET%' AND pn.trang_thai = 3 AND pn.phieu_chuyen_kho_id IS NULL AND pn.ghi_chu LIKE 'Nhập hoàn trả từ phiếu xuất: %' AND SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING(pn.ghi_chu, CHAR_LENGTH('Nhập hoàn trả từ phiếu xuất: ') + 1), ' ', 1), '(', 1), CHAR(10 USING utf8mb4), 1), CHAR(13 USING utf8mb4), 1) = px.so_phieu_xuat WHERE px.don_ban_hang_id = dbh.id AND px.trang_thai = 3), dbh.ngay_cap_nhat) < :den
            UNION ALL
            -- Trả hàng tại quầy: giảm doanh thu kênh quầy của cửa hàng bán (A) theo ngày trả (bỏ phần thuế GTGT); giá vốn
            -- giảm phần hàng Đạt (quay lại kho), hàng Lỗi vẫn tính giá vốn (tổn thất)
            SELECT 'POS', NULL, -r.tong_tien_hoan * (1 - COALESCE(COALESCE(dr.tien_thue_gtgt, 0) / NULLIF(dr.tong_cong - COALESCE(dr.phi_van_chuyen, 0), 0), 0)), -COALESCE((
                        SELECT SUM(l.so_luong * l.gia_von)
                        FROM chi_tiet_phieu_tra_hang c
                        JOIN chi_tiet_phieu_tra_hang_lo l ON l.chi_tiet_phieu_tra_hang_id = c.id
                        WHERE c.phieu_tra_hang_id = r.id AND c.tinh_trang = 'dat'), 0),
                   CASE WHEN dr.trang_thai_tra_hang = 'da_tra_het'
                         AND r.id = (SELECT MAX(r2.id) FROM phieu_tra_hang r2 WHERE r2.don_ban_hang_id = dr.id)
                        THEN -1 ELSE 0 END, 0
            FROM phieu_tra_hang r
            JOIN don_ban_hang dr ON dr.id = r.don_ban_hang_id
            WHERE r.ngay_tao >= :tu AND r.ngay_tao < :den
              AND (:tatCaKho = TRUE OR r.kho_ban_id IN (:khoIds))
        ) x
        GROUP BY x.kenh
        """,
            nativeQuery = true)
    List<Object[]> theoKenh(@Param("tu") LocalDate tu, @Param("den") LocalDate den,
                            @Param("tatCaKho") boolean tatCaKho, @Param("khoIds") Collection<Integer> khoIds);

    /**
     * Doanh thu cả kỳ [tu, den) theo người lập đơn, cùng điều kiện đơn với các câu theo ngày: [mã người, họ tên, doanh
     * thu, giá vốn, số đơn]. Mã người: -1 = đơn sàn (đồng bộ từ kênh bán khác POS, không có người lập), 0 = đơn không ghi
     * người lập, còn lại = id người dùng (đơn tại quầy: thu ngân; đơn bán thường: người lập đơn).
     */
    @Query(value = """
        SELECT x.nguoi, MAX(x.ho_ten), SUM(x.doanh_thu), SUM(x.gia_von), SUM(x.so_don)
        FROM (
            SELECT CASE WHEN kb.id IS NOT NULL AND COALESCE(kb.ma_kenh, '') <> 'POS' THEN -1
                        ELSE COALESCE(dbh.nguoi_tao_id, 0) END AS nguoi,
                   nd.ho_ten                                   AS ho_ten,
                   (dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)) AS doanh_thu,
                   COALESCE((
                        SELECT SUM(ctpx.so_luong_xuat * ctpx.gia_von)
                        FROM phieu_xuat_kho pxk
                        JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
                        WHERE pxk.don_ban_hang_id = dbh.id AND pxk.trang_thai = 3), 0) AS gia_von,
                   1                                           AS so_don
            FROM don_ban_hang dbh
            LEFT JOIN kenh_ban_hang kb ON kb.id = dbh.kenh_ban_id
            LEFT JOIN nguoi_dung nd    ON nd.id = dbh.nguoi_tao_id
            WHERE dbh.loai_chung_tu = 'don_ban_hang'
              AND dbh.trang_thai IN (3, 5, 6)
              AND dbh.ngay_giao_hang >= :tu AND dbh.ngay_giao_hang < :den
              AND (:tatCaKho = TRUE OR dbh.kho_xuat_id IN (:khoIds))
            UNION ALL
            -- Đơn sàn bị hoàn: trừ ở ngày hoàn (đơn sàn không có người lập)
            SELECT CASE WHEN kb.id IS NOT NULL AND COALESCE(kb.ma_kenh, '') <> 'POS' THEN -1
                        ELSE COALESCE(dbh.nguoi_tao_id, 0) END, nd.ho_ten, -(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)),
                   -COALESCE((SELECT SUM(ctpx.so_luong_xuat * ctpx.gia_von) FROM phieu_xuat_kho pxk
                               JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
                              WHERE pxk.don_ban_hang_id = dbh.id AND pxk.trang_thai = 3), 0), -1
            FROM don_ban_hang dbh
            LEFT JOIN kenh_ban_hang kb ON kb.id = dbh.kenh_ban_id
            LEFT JOIN nguoi_dung nd    ON nd.id = dbh.nguoi_tao_id
            WHERE dbh.loai_chung_tu = 'don_ban_hang' AND dbh.trang_thai = 6 AND dbh.ngay_giao_hang IS NOT NULL
              AND (:tatCaKho = TRUE OR dbh.kho_xuat_id IN (:khoIds))
              AND COALESCE((SELECT MAX(pn.ngay_nhap) FROM phieu_xuat_kho px JOIN phieu_nhap_kho pn ON pn.so_phieu_nhap LIKE 'PN-RET%' AND pn.trang_thai = 3 AND pn.phieu_chuyen_kho_id IS NULL AND pn.ghi_chu LIKE 'Nhập hoàn trả từ phiếu xuất: %' AND SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING(pn.ghi_chu, CHAR_LENGTH('Nhập hoàn trả từ phiếu xuất: ') + 1), ' ', 1), '(', 1), CHAR(10 USING utf8mb4), 1), CHAR(13 USING utf8mb4), 1) = px.so_phieu_xuat WHERE px.don_ban_hang_id = dbh.id AND px.trang_thai = 3), dbh.ngay_cap_nhat) >= :tu AND COALESCE((SELECT MAX(pn.ngay_nhap) FROM phieu_xuat_kho px JOIN phieu_nhap_kho pn ON pn.so_phieu_nhap LIKE 'PN-RET%' AND pn.trang_thai = 3 AND pn.phieu_chuyen_kho_id IS NULL AND pn.ghi_chu LIKE 'Nhập hoàn trả từ phiếu xuất: %' AND SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING(pn.ghi_chu, CHAR_LENGTH('Nhập hoàn trả từ phiếu xuất: ') + 1), ' ', 1), '(', 1), CHAR(10 USING utf8mb4), 1), CHAR(13 USING utf8mb4), 1) = px.so_phieu_xuat WHERE px.don_ban_hang_id = dbh.id AND px.trang_thai = 3), dbh.ngay_cap_nhat) < :den
            UNION ALL
            -- Trả hàng tại quầy: trừ vào thu ngân đã bán đơn gốc, theo ngày trả, bỏ phần thuế GTGT (như theoKenh)
            SELECT COALESCE(dbh.nguoi_tao_id, 0), nd.ho_ten, -r.tong_tien_hoan * (1 - COALESCE(COALESCE(dbh.tien_thue_gtgt, 0) / NULLIF(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0), 0), 0)), -COALESCE((
                        SELECT SUM(l.so_luong * l.gia_von)
                        FROM chi_tiet_phieu_tra_hang c
                        JOIN chi_tiet_phieu_tra_hang_lo l ON l.chi_tiet_phieu_tra_hang_id = c.id
                        WHERE c.phieu_tra_hang_id = r.id AND c.tinh_trang = 'dat'), 0),
                   CASE WHEN dbh.trang_thai_tra_hang = 'da_tra_het'
                         AND r.id = (SELECT MAX(r2.id) FROM phieu_tra_hang r2 WHERE r2.don_ban_hang_id = dbh.id)
                        THEN -1 ELSE 0 END
            FROM phieu_tra_hang r
            JOIN don_ban_hang dbh   ON dbh.id = r.don_ban_hang_id
            LEFT JOIN nguoi_dung nd ON nd.id = dbh.nguoi_tao_id
            WHERE r.ngay_tao >= :tu AND r.ngay_tao < :den
              AND (:tatCaKho = TRUE OR r.kho_ban_id IN (:khoIds))
        ) x
        GROUP BY x.nguoi
        """,
            nativeQuery = true)
    List<Object[]> theoNhanVien(@Param("tu") LocalDate tu, @Param("den") LocalDate den,
                                @Param("tatCaKho") boolean tatCaKho, @Param("khoIds") Collection<Integer> khoIds);

    /**
     * Hàng trả về theo ngày trả trong [tu, den] (khoId null = mọi kho): [ngày yyyy-MM-dd, doanh thu trả (bỏ thuế GTGT),
     * giá vốn cộng lại, số đơn trả hết, tiền hàng trả (còn gồm thuế)]. Dịch vụ báo cáo trừ các số này khỏi kỳ chứa ngày trả.
     * - Trả tại quầy theo ngày lập phiếu, tính cho cửa hàng BÁN (kho_ban_id — GBR-RET-06); giá vốn cộng lại phần hàng Đạt;
     *   đơn tính là trả hết ở phiếu trả cuối khi đơn đã trả hết.
     * - Đơn sàn bị hoàn (6) theo ngày hoàn, tính cho kho xuất: trừ cả đơn, cộng lại toàn bộ giá vốn, trừ 1 đơn.
     */
    @Query(value = """
        SELECT x.ngay, SUM(x.tien) AS tienHoan, SUM(x.gia_von) AS giaVonDat, SUM(x.so_don) AS soDon, SUM(x.tien_hang) AS tienHang
        FROM (
            SELECT DATE_FORMAT(r.ngay_tao, '%Y-%m-%d') AS ngay,
                   r.tong_tien_hoan * (1 - COALESCE(COALESCE(dbh.tien_thue_gtgt, 0) / NULLIF(dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0), 0), 0)) AS tien,
                   COALESCE((SELECT SUM(l.so_luong * l.gia_von)
                               FROM chi_tiet_phieu_tra_hang c
                               JOIN chi_tiet_phieu_tra_hang_lo l ON l.chi_tiet_phieu_tra_hang_id = c.id
                              WHERE c.phieu_tra_hang_id = r.id AND c.tinh_trang = 'dat'), 0) AS gia_von,
                   CASE WHEN dbh.trang_thai_tra_hang = 'da_tra_het'
                         AND r.id = (SELECT MAX(r2.id) FROM phieu_tra_hang r2 WHERE r2.don_ban_hang_id = dbh.id)
                        THEN 1 ELSE 0 END AS so_don,
                   r.tong_tien_hoan AS tien_hang
            FROM phieu_tra_hang r
            JOIN don_ban_hang dbh ON dbh.id = r.don_ban_hang_id
            WHERE r.ngay_tao >= :tuNgay
              AND r.ngay_tao < DATE_ADD(:denNgay, INTERVAL 1 DAY)
              AND (:khoId IS NULL OR r.kho_ban_id = :khoId)
            UNION ALL
            SELECT DATE_FORMAT(COALESCE((SELECT MAX(pn.ngay_nhap) FROM phieu_xuat_kho px JOIN phieu_nhap_kho pn ON pn.so_phieu_nhap LIKE 'PN-RET%' AND pn.trang_thai = 3 AND pn.phieu_chuyen_kho_id IS NULL AND pn.ghi_chu LIKE 'Nhập hoàn trả từ phiếu xuất: %' AND SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING(pn.ghi_chu, CHAR_LENGTH('Nhập hoàn trả từ phiếu xuất: ') + 1), ' ', 1), '(', 1), CHAR(10 USING utf8mb4), 1), CHAR(13 USING utf8mb4), 1) = px.so_phieu_xuat WHERE px.don_ban_hang_id = dbh.id AND px.trang_thai = 3), dbh.ngay_cap_nhat), '%Y-%m-%d'),
                   (dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0) - COALESCE(dbh.tien_thue_gtgt, 0)),
                   COALESCE((SELECT SUM(ctpx.so_luong_xuat * ctpx.gia_von) FROM phieu_xuat_kho pxk
                              JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
                             WHERE pxk.don_ban_hang_id = dbh.id AND pxk.trang_thai = 3), 0),
                   1,
                   dbh.tong_cong - COALESCE(dbh.phi_van_chuyen, 0)
            FROM don_ban_hang dbh
            WHERE dbh.loai_chung_tu = 'don_ban_hang' AND dbh.trang_thai = 6 AND dbh.ngay_giao_hang IS NOT NULL
              AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
              AND COALESCE((SELECT MAX(pn.ngay_nhap) FROM phieu_xuat_kho px JOIN phieu_nhap_kho pn ON pn.so_phieu_nhap LIKE 'PN-RET%' AND pn.trang_thai = 3 AND pn.phieu_chuyen_kho_id IS NULL AND pn.ghi_chu LIKE 'Nhập hoàn trả từ phiếu xuất: %' AND SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING(pn.ghi_chu, CHAR_LENGTH('Nhập hoàn trả từ phiếu xuất: ') + 1), ' ', 1), '(', 1), CHAR(10 USING utf8mb4), 1), CHAR(13 USING utf8mb4), 1) = px.so_phieu_xuat WHERE px.don_ban_hang_id = dbh.id AND px.trang_thai = 3), dbh.ngay_cap_nhat) >= :tuNgay
              AND COALESCE((SELECT MAX(pn.ngay_nhap) FROM phieu_xuat_kho px JOIN phieu_nhap_kho pn ON pn.so_phieu_nhap LIKE 'PN-RET%' AND pn.trang_thai = 3 AND pn.phieu_chuyen_kho_id IS NULL AND pn.ghi_chu LIKE 'Nhập hoàn trả từ phiếu xuất: %' AND SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING(pn.ghi_chu, CHAR_LENGTH('Nhập hoàn trả từ phiếu xuất: ') + 1), ' ', 1), '(', 1), CHAR(10 USING utf8mb4), 1), CHAR(13 USING utf8mb4), 1) = px.so_phieu_xuat WHERE px.don_ban_hang_id = dbh.id AND px.trang_thai = 3), dbh.ngay_cap_nhat) < DATE_ADD(:denNgay, INTERVAL 1 DAY)
        ) x
        GROUP BY x.ngay
        """,
            nativeQuery = true)
    List<Object[]> hangTraTheoNgay(@Param("tuNgay") LocalDate tuNgay,
                                   @Param("denNgay") LocalDate denNgay,
                                   @Param("khoId") Integer khoId);
}