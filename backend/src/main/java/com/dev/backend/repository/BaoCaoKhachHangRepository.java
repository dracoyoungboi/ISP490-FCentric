package com.dev.backend.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Danh sách khách mua trong kỳ cho tệp Excel của Báo cáo khách hàng, cùng cách đếm với KhachHangReportRepository:
 * đơn đã giao (trạng thái 3, 5) theo ngày giao hàng, lọc theo kho xuất; khách mới là khách chưa có đơn đã giao nào
 * trước ngày đầu kỳ (ở mọi kho).
 */
@Repository
public class BaoCaoKhachHangRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public BaoCaoKhachHangRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Một khách mua trong kỳ. lanDauMua: đơn đã giao đầu tiên của khách (mọi thời điểm, mọi kho). */
    public record KhachMua(int id, String ma, String ten, String soDienThoai, String email, long soDon,
                           BigDecimal doanhThu, LocalDateTime lanDauMua, LocalDateTime muaGanNhat, boolean khachMoi) {
    }

    /** Khách có đơn đã giao trong [tuNgay, denNgay], doanh thu lớn trước. */
    public List<KhachMua> khachMuaTrongKy(LocalDate tuNgay, LocalDate denNgay, Integer khoId) {
        String sql = """
                SELECT kh.id, kh.ma_khach_hang, kh.ten_khach_hang, kh.so_dien_thoai, kh.email,
                       d.so_don, d.doanh_thu, d.mua_gan_nhat, dau.lan_dau,
                       CASE WHEN dau.lan_dau < :tuNgay THEN 0 ELSE 1 END AS khach_moi
                FROM (
                    SELECT dbh.khach_hang_id, COUNT(*) AS so_don, COALESCE(SUM(dbh.tong_cong), 0) AS doanh_thu,
                           MAX(dbh.ngay_giao_hang) AS mua_gan_nhat
                    FROM don_ban_hang dbh
                    WHERE dbh.trang_thai IN (3, 5)
                      AND dbh.ngay_giao_hang >= :tuNgay
                      AND dbh.ngay_giao_hang < DATE_ADD(:denNgay, INTERVAL 1 DAY)
                      AND (:khoId IS NULL OR dbh.kho_xuat_id = :khoId)
                    GROUP BY dbh.khach_hang_id
                ) d
                JOIN khach_hang kh ON kh.id = d.khach_hang_id
                LEFT JOIN (
                    SELECT khach_hang_id, MIN(ngay_giao_hang) AS lan_dau
                    FROM don_ban_hang
                    WHERE trang_thai IN (3, 5)
                    GROUP BY khach_hang_id
                ) dau ON dau.khach_hang_id = d.khach_hang_id
                ORDER BY d.doanh_thu DESC, d.so_don DESC, kh.ma_khach_hang
                """;
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("tuNgay", tuNgay).addValue("denNgay", denNgay).addValue("khoId", khoId);
        return jdbc.query(sql, p, (rs, i) -> {
            LocalDateTime lanDau = gio(rs.getTimestamp("lan_dau"));
            return new KhachMua(rs.getInt("id"), rs.getString("ma_khach_hang"), rs.getString("ten_khach_hang"),
                    rs.getString("so_dien_thoai"), rs.getString("email"), rs.getLong("so_don"), rs.getBigDecimal("doanh_thu"),
                    lanDau, gio(rs.getTimestamp("mua_gan_nhat")),
                    // So trong câu SQL như câu đếm trên màn: không có đơn đã giao nào trước ngày đầu kỳ
                    rs.getInt("khach_moi") == 1);
        });
    }

    private static LocalDateTime gio(Timestamp t) {
        return t == null ? null : t.toLocalDateTime();
    }
}
