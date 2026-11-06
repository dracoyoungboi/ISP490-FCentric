package com.dev.backend.repository;

import com.dev.backend.entities.KhachHang;
import com.dev.backend.services.impl.multitable.TinhBaoCaoKhachHang;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Dữ liệu của Báo cáo khách hàng (màn /reports/customers và tệp Excel của màn).
 * Chỉ tính đơn bán đã giao (trạng thái 3 Đã xuất toàn bộ, 5 Hoàn thành) theo ngày giao hàng, lọc kho theo kho xuất.
 * Lần mua đầu tiên và số đơn tích lũy của khách tính ở mọi kho. Khách lẻ là đơn không gắn khách hoặc gắn khách mã KHLE
 * (khách vãng lai của POS): không tính vào số khách.
 */
@Repository
public class BaoCaoKhachHangRepository {

    /** Mã khách lẻ mặc định của POS (posService.js WALKIN_CUSTOMER_CODE). */
    public static final String MA_KHACH_LE = KhachHang.MA_KHACH_LE;

    private final NamedParameterJdbcTemplate jdbc;

    public BaoCaoKhachHangRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Một khách mua trong kỳ. lanDauMua: đơn đã giao đầu tiên của khách (mọi thời điểm, mọi kho).
     * khachMoi: lần đầu mua không trước ngày đầu kỳ. muaLai: có từ 2 đơn đã giao (mọi kho) tính tới hết kỳ.
     */
    public record KhachMua(int id, String ma, String ten, String soDienThoai, String email, long soDon,
                           BigDecimal doanhThu, LocalDateTime lanDauMua, LocalDateTime muaGanNhat, boolean khachMoi,
                           boolean muaLai) {
    }

    /** Khách (không gồm khách lẻ) có đơn đã giao trong [tuNgay, denNgay], doanh thu lớn trước. */
    public List<KhachMua> khachMuaTrongKy(LocalDate tuNgay, LocalDate denNgay, List<Integer> khoIds) {
        String sql = """
                SELECT kh.id, kh.ma_khach_hang, kh.ten_khach_hang, kh.so_dien_thoai, kh.email,
                       d.so_don, d.doanh_thu, d.mua_gan_nhat, ls.lan_dau, ls.so_don_den_cuoi,
                       CASE WHEN ls.lan_dau < :tuNgay THEN 0 ELSE 1 END AS khach_moi
                FROM (
                    SELECT dbh.khach_hang_id, COUNT(*) AS so_don, COALESCE(SUM(dbh.tong_cong), 0) AS doanh_thu,
                           MAX(dbh.ngay_giao_hang) AS mua_gan_nhat
                    FROM don_ban_hang dbh
                    WHERE dbh.trang_thai IN (3, 5)
                      AND dbh.ngay_giao_hang >= :tuNgay
                      AND dbh.ngay_giao_hang < DATE_ADD(:denNgay, INTERVAL 1 DAY)
                      AND (:tatCaKho = 1 OR dbh.kho_xuat_id IN (:khoIds))
                      AND dbh.khach_hang_id IS NOT NULL
                    GROUP BY dbh.khach_hang_id
                ) d
                JOIN khach_hang kh ON kh.id = d.khach_hang_id
                LEFT JOIN (
                    SELECT khach_hang_id, MIN(ngay_giao_hang) AS lan_dau,
                           SUM(CASE WHEN ngay_giao_hang < DATE_ADD(:denNgay, INTERVAL 1 DAY) THEN 1 ELSE 0 END) AS so_don_den_cuoi
                    FROM don_ban_hang
                    WHERE trang_thai IN (3, 5) AND ngay_giao_hang IS NOT NULL
                    GROUP BY khach_hang_id
                ) ls ON ls.khach_hang_id = d.khach_hang_id
                WHERE kh.ma_khach_hang IS NULL OR kh.ma_khach_hang <> :maKhachLe
                ORDER BY d.doanh_thu DESC, d.so_don DESC, kh.ma_khach_hang
                """;
        MapSqlParameterSource p = thamSo(tuNgay, denNgay, khoIds);
        return jdbc.query(sql, p, (rs, i) -> {
            long soDon = rs.getLong("so_don");
            long soDonDenCuoi = rs.getObject("so_don_den_cuoi") == null ? soDon : rs.getLong("so_don_den_cuoi");
            return new KhachMua(rs.getInt("id"), rs.getString("ma_khach_hang"), rs.getString("ten_khach_hang"),
                    rs.getString("so_dien_thoai"), rs.getString("email"), soDon, rs.getBigDecimal("doanh_thu"),
                    gio(rs.getTimestamp("lan_dau")), gio(rs.getTimestamp("mua_gan_nhat")),
                    // So trong câu SQL như phần tổng trên màn: không có đơn đã giao nào trước ngày đầu kỳ
                    rs.getInt("khach_moi") == 1, soDonDenCuoi >= 2);
        });
    }

    /** Mọi đơn đã giao trong [tuNgay, denNgay] (gồm đơn khách lẻ), lọc theo kho xuất. */
    public List<TinhBaoCaoKhachHang.Don> donDaGiao(LocalDate tuNgay, LocalDate denNgay, List<Integer> khoIds) {
        String sql = """
                SELECT dbh.khach_hang_id, DATE(dbh.ngay_giao_hang) AS ngay, dbh.tong_cong,
                       CASE WHEN dbh.khach_hang_id IS NULL OR kh.ma_khach_hang = :maKhachLe THEN 1 ELSE 0 END AS khach_le
                FROM don_ban_hang dbh
                LEFT JOIN khach_hang kh ON kh.id = dbh.khach_hang_id
                WHERE dbh.trang_thai IN (3, 5)
                  AND dbh.ngay_giao_hang >= :tuNgay
                  AND dbh.ngay_giao_hang < DATE_ADD(:denNgay, INTERVAL 1 DAY)
                  AND (:tatCaKho = 1 OR dbh.kho_xuat_id IN (:khoIds))
                """;
        return jdbc.query(sql, thamSo(tuNgay, denNgay, khoIds), (rs, i) -> {
            int id = rs.getInt("khach_hang_id");
            Integer khachHangId = rs.wasNull() ? null : id;
            return new TinhBaoCaoKhachHang.Don(khachHangId, rs.getInt("khach_le") == 1, ngay(rs.getDate("ngay")),
                    rs.getBigDecimal("tong_cong"));
        });
    }

    /**
     * Lịch sử mua ở mọi kho của các khách có đơn đã giao trong [tuNgay, denNgay] (lọc kho): ngày mua đầu tiên và số
     * đơn đã giao tới hết ngày cuoiTong.
     */
    public Map<Integer, TinhBaoCaoKhachHang.LichSu> lichSuKhach(LocalDate tuNgay, LocalDate denNgay, List<Integer> khoIds,
                                                               LocalDate cuoiTong) {
        String sql = """
                SELECT d.khach_hang_id, DATE(MIN(d.ngay_giao_hang)) AS lan_dau,
                       SUM(CASE WHEN d.ngay_giao_hang < DATE_ADD(:cuoiTong, INTERVAL 1 DAY) THEN 1 ELSE 0 END) AS so_don
                FROM don_ban_hang d
                WHERE d.trang_thai IN (3, 5) AND d.ngay_giao_hang IS NOT NULL
                  AND d.khach_hang_id IN (
                      SELECT x.khach_hang_id FROM don_ban_hang x
                      WHERE x.trang_thai IN (3, 5)
                        AND x.ngay_giao_hang >= :tuNgay
                        AND x.ngay_giao_hang < DATE_ADD(:denNgay, INTERVAL 1 DAY)
                        AND (:tatCaKho = 1 OR x.kho_xuat_id IN (:khoIds))
                        AND x.khach_hang_id IS NOT NULL
                  )
                GROUP BY d.khach_hang_id
                """;
        MapSqlParameterSource p = thamSo(tuNgay, denNgay, khoIds).addValue("cuoiTong", cuoiTong);
        Map<Integer, TinhBaoCaoKhachHang.LichSu> kq = new HashMap<>();
        jdbc.query(sql, p, rs -> {
            kq.put(rs.getInt("khach_hang_id"), new TinhBaoCaoKhachHang.LichSu(ngay(rs.getDate("lan_dau")), rs.getLong("so_don")));
        });
        return kq;
    }

    /** khoIds null: mọi kho; khác null: chỉ các kho xuất trong danh sách (danh sách rỗng thì không khớp đơn nào). */
    private static MapSqlParameterSource thamSo(LocalDate tuNgay, LocalDate denNgay, List<Integer> khoIds) {
        // Tham số "in" không được rỗng: -1 không khớp kho nào
        List<Integer> ds = khoIds == null || khoIds.isEmpty() ? List.of(-1) : khoIds;
        return new MapSqlParameterSource()
                .addValue("tuNgay", tuNgay).addValue("denNgay", denNgay)
                .addValue("tatCaKho", khoIds == null ? 1 : 0).addValue("khoIds", ds)
                .addValue("maKhachLe", MA_KHACH_LE);
    }

    private static LocalDateTime gio(Timestamp t) {
        return t == null ? null : t.toLocalDateTime();
    }

    private static LocalDate ngay(Date d) {
        return d == null ? null : d.toLocalDate();
    }
}
