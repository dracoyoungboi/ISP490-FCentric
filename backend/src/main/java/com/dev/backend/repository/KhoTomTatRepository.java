package com.dev.backend.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/**
 * Số liệu tóm tắt một kho cho popup Chi tiết kho.
 * Quy tắc phân loại giống khối Tồn kho của Tổng quan (TongQuanAdminRepository.CTE_TON_THEO_CAP):
 * - gộp tồn theo biến thể của kho; biến thể đã từng có lô ở kho mới được đếm, nên kho chưa bao giờ nhập
 *   một mã không bị báo "hết hàng" mã đó;
 * - chỉ biến thể đang bán (trạng thái 1) của sản phẩm đang kinh doanh (Còn hàng 1, hoặc Hết hàng 0 do hệ thống tự
 *   đặt khi mọi biến thể hết hàng) được đếm vào mã hàng / hết / sắp hết;
 *   tồn và giá trị vẫn cộng mọi lô.
 * Khác Tổng quan: không lọc trạng thái kho và không bỏ Kho Trung Chuyển, vì popup xem cả kho ngừng hoạt động
 * (tồn vẫn còn) và kho ảo (hàng đang chuyển).
 */
@Repository
public class KhoTomTatRepository {

    /** Một dòng tóm tắt tồn của kho; số lượng / tiền giữ BigDecimal, nơi gọi tự làm tròn. */
    public record TonKhoDong(BigDecimal ton, BigDecimal dangGiu, BigDecimal khaDung, BigDecimal giaTri,
                             long soMaHang, long soMaHetHang, long soMaSapHet) {}

    static final String SQL_TON_KHO = """
            WITH cap AS (
                SELECT lh.bien_the_san_pham_id                 AS bien_the_id,
                       SUM(tk.so_luong_ton)                   AS ton,
                       SUM(COALESCE(tk.so_luong_da_dat, 0))   AS giu,
                       SUM(tk.so_luong_kha_dung)              AS kha_dung,
                       SUM(tk.so_luong_ton * lh.gia_von)      AS gia_tri
                FROM ton_kho_theo_lo tk
                JOIN lo_hang lh ON lh.id = tk.lo_hang_id
                WHERE tk.kho_id = :khoId
                GROUP BY lh.bien_the_san_pham_id
            ),
            loai AS (
                SELECT cap.*,
                       COALESCE(NULLIF(sp.muc_ton_toi_thieu, 0), :nguongMacDinh)                 AS nguong,
                       CASE WHEN bt.trang_thai = 1 AND sp.trang_thai IN (0, 1) THEN 1 ELSE 0 END  AS dang_ban
                FROM cap
                JOIN bien_the_san_pham bt ON bt.id = cap.bien_the_id
                JOIN san_pham_quan_ao sp  ON sp.id = bt.san_pham_id
            )
            SELECT COALESCE(SUM(ton), 0)        AS ton,
                   COALESCE(SUM(giu), 0)        AS giu,
                   COALESCE(SUM(kha_dung), 0)   AS kha_dung,
                   COALESCE(SUM(gia_tri), 0)    AS gia_tri,
                   COALESCE(SUM(dang_ban), 0)   AS so_ma,
                   COALESCE(SUM(CASE WHEN dang_ban = 1 AND kha_dung <= 0 THEN 1 ELSE 0 END), 0)                     AS het,
                   COALESCE(SUM(CASE WHEN dang_ban = 1 AND kha_dung > 0 AND kha_dung <= nguong THEN 1 ELSE 0 END), 0) AS sap_het
            FROM loai
            """;

    /**
     * Người được phân quyền ở kho: quyền đang bật, đã tới ngày bắt đầu và chưa hết hạn (cùng điều kiện với
     * PhanQuyenNguoiDungKhoRepository.findActiveKhoInfoByNguoiDungId), tài khoản đang hoạt động,
     * không tính người quản lý chính ghi trên kho.
     */
    static final String SQL_SO_NGUOI_PHAN_QUYEN = """
            SELECT COUNT(DISTINCT pq.nguoi_dung_id)
            FROM phan_quyen_nguoi_dung_kho pq
            JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
            JOIN kho k         ON k.id = pq.kho_id
            WHERE pq.kho_id = :khoId
              AND pq.trang_thai = 1
              AND (pq.ngay_bat_dau IS NULL OR pq.ngay_bat_dau <= CURRENT_TIMESTAMP)
              AND (pq.ngay_ket_thuc IS NULL OR pq.ngay_ket_thuc > CURRENT_TIMESTAMP)
              AND nd.trang_thai = 1
              AND (k.quan_ly_id IS NULL OR pq.nguoi_dung_id <> k.quan_ly_id)
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public KhoTomTatRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public TonKhoDong tonKho(Integer khoId, int nguongMacDinh) {
        MapSqlParameterSource p = new MapSqlParameterSource("khoId", khoId).addValue("nguongMacDinh", nguongMacDinh);
        return jdbc.queryForObject(SQL_TON_KHO, p, (rs, i) -> new TonKhoDong(
                bd(rs, "ton"), bd(rs, "giu"), bd(rs, "kha_dung"), bd(rs, "gia_tri"),
                rs.getLong("so_ma"), rs.getLong("het"), rs.getLong("sap_het")));
    }

    public long soNguoiPhanQuyen(Integer khoId) {
        Long n = jdbc.queryForObject(SQL_SO_NGUOI_PHAN_QUYEN, new MapSqlParameterSource("khoId", khoId), Long.class);
        return n == null ? 0L : n;
    }

    /** Giá trị số nguyên dương của một cấu hình hệ thống, null nếu chưa có hoặc không hợp lệ. */
    public Integer cauHinhSoDuong(String maCauHinh) {
        List<String> giaTri = jdbc.queryForList(
                "SELECT gia_tri FROM cau_hinh_he_thong WHERE ma_cau_hinh = :ma",
                new MapSqlParameterSource("ma", maCauHinh), String.class);
        if (giaTri.isEmpty() || giaTri.get(0) == null) return null;
        try {
            int v = Integer.parseInt(giaTri.get(0).trim());
            return v > 0 ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static BigDecimal bd(ResultSet rs, String cot) throws SQLException {
        BigDecimal v = rs.getBigDecimal(cot);
        return v == null ? BigDecimal.ZERO : v;
    }
}
