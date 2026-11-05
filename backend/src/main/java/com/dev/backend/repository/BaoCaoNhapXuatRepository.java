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
 * Truy vấn cho tệp Excel của Nhật ký nhập xuất, đọc sổ lich_su_giao_dich_kho như NhatKyNhapXuatRepository: số lượng quy dấu
 * theo loại giao dịch (nhập +, xuất −, điều chỉnh giữ dấu chênh lệch), bỏ dòng của Kho Trung Chuyển (hàng đi đường khi
 * chuyển kho) để không cộng trùng nhập. Kỳ tính theo ngày giao dịch [tuNgay, denNgay], cùng điều kiện ngày với màn.
 */
@Repository
public class BaoCaoNhapXuatRepository {

    /** Bảng con "lg": sổ giao dịch đã quy dấu, không có Kho Trung Chuyển. */
    private static final String SO_DA_QUY_DAU = """
            SELECT x.id, x.ngay_giao_dich, x.loai_giao_dich, x.loai_tham_chieu, x.id_tham_chieu,
                   x.bien_the_san_pham_id, x.lo_hang_id, x.kho_id, x.kho_chuyen_den_id, x.gia_von, x.ghi_chu,
                   CASE WHEN x.loai_giao_dich = 'xuat_kho' THEN -ABS(x.so_luong)
                        WHEN x.loai_giao_dich = 'nhap_kho' THEN ABS(x.so_luong)
                        ELSE x.so_luong END AS so_luong
            FROM lich_su_giao_dich_kho x
            WHERE x.kho_id NOT IN (SELECT k0.id FROM kho k0 WHERE k0.ma_kho = 'KHO_TRANSIT')
            """;

    private static final String DIEU_KIEN = """
            WHERE DATE(lg.ngay_giao_dich) BETWEEN :tuNgay AND :denNgay
              AND (:khoId IS NULL OR lg.kho_id = :khoId)
              AND (:loai IS NULL OR lg.loai_giao_dich = :loai)
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public BaoCaoNhapXuatRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Một dòng sổ giao dịch kèm số chứng từ, kho, sản phẩm, lô. soLuong > 0 là nhập, < 0 là xuất. */
    public record GiaoDich(long id, LocalDateTime ngay, String loai, String soChungTu, String kho, String khoDen,
                           String maSanPham, String tenSanPham, String maSku, String maLo, BigDecimal soLuong,
                           BigDecimal giaVon, String ghiChu) {
    }

    /** Cộng theo loại giao dịch. soChungTu: số chứng từ khác nhau. */
    public record TheoLoai(String loai, long soChungTu, BigDecimal tongNhap, BigDecimal tongXuat,
                           BigDecimal giaTriNhap, BigDecimal giaTriXuat) {
    }

    private static MapSqlParameterSource thamSo(LocalDate tuNgay, LocalDate denNgay, Integer khoId, String loai) {
        return new MapSqlParameterSource()
                .addValue("tuNgay", tuNgay)
                .addValue("denNgay", denNgay)
                .addValue("khoId", khoId)
                .addValue("loai", loai);
    }

    /** Các dòng giao dịch trong kỳ, cũ trước; lấy tối đa gioiHan dòng. */
    public List<GiaoDich> chiTiet(LocalDate tuNgay, LocalDate denNgay, Integer khoId, String loai, int gioiHan) {
        String sql = "SELECT lg.id, lg.ngay_giao_dich, lg.loai_giao_dich, lg.so_luong, lg.gia_von, lg.ghi_chu,"
                + " CASE lg.loai_tham_chieu WHEN 'phieu_nhap_kho' THEN pn.so_phieu_nhap"
                + "   WHEN 'phieu_xuat_kho' THEN px.so_phieu_xuat WHEN 'phieu_dieu_chinh_kho' THEN pdc.so_phieu END AS so_chung_tu,"
                + " k.ten_kho, kd.ten_kho AS ten_kho_den, sp.ma_san_pham, sp.ten_san_pham, bt.ma_sku, lh.ma_lo"
                + " FROM (" + SO_DA_QUY_DAU + ") lg"
                + " JOIN kho k ON k.id = lg.kho_id"
                + " LEFT JOIN kho kd ON kd.id = lg.kho_chuyen_den_id"
                + " LEFT JOIN bien_the_san_pham bt ON bt.id = lg.bien_the_san_pham_id"
                + " LEFT JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id"
                + " LEFT JOIN lo_hang lh ON lh.id = lg.lo_hang_id"
                + " LEFT JOIN phieu_nhap_kho pn ON lg.loai_tham_chieu = 'phieu_nhap_kho' AND pn.id = lg.id_tham_chieu"
                + " LEFT JOIN phieu_xuat_kho px ON lg.loai_tham_chieu = 'phieu_xuat_kho' AND px.id = lg.id_tham_chieu"
                + " LEFT JOIN phieu_dieu_chinh_kho pdc ON lg.loai_tham_chieu = 'phieu_dieu_chinh_kho' AND pdc.id = lg.id_tham_chieu "
                + DIEU_KIEN
                + " ORDER BY lg.ngay_giao_dich, lg.id LIMIT :gioiHan";
        return jdbc.query(sql, thamSo(tuNgay, denNgay, khoId, loai).addValue("gioiHan", gioiHan), (rs, i) -> {
            Timestamp t = rs.getTimestamp("ngay_giao_dich");
            return new GiaoDich(rs.getLong("id"), t == null ? null : t.toLocalDateTime(), rs.getString("loai_giao_dich"),
                    rs.getString("so_chung_tu"), rs.getString("ten_kho"), rs.getString("ten_kho_den"),
                    rs.getString("ma_san_pham"), rs.getString("ten_san_pham"), rs.getString("ma_sku"), rs.getString("ma_lo"),
                    rs.getBigDecimal("so_luong"), rs.getBigDecimal("gia_von"), rs.getString("ghi_chu"));
        });
    }

    /** Cộng số lượng, giá trị theo loại giao dịch trong kỳ. */
    public List<TheoLoai> theoLoai(LocalDate tuNgay, LocalDate denNgay, Integer khoId, String loai) {
        String sql = "SELECT lg.loai_giao_dich,"
                + " COUNT(DISTINCT lg.loai_tham_chieu, lg.id_tham_chieu) AS so_chung_tu,"
                + " COALESCE(SUM(CASE WHEN lg.so_luong > 0 THEN lg.so_luong ELSE 0 END), 0) AS tong_nhap,"
                + " COALESCE(SUM(CASE WHEN lg.so_luong < 0 THEN -lg.so_luong ELSE 0 END), 0) AS tong_xuat,"
                + " COALESCE(SUM(CASE WHEN lg.so_luong > 0 THEN lg.so_luong * lg.gia_von ELSE 0 END), 0) AS gia_tri_nhap,"
                + " COALESCE(SUM(CASE WHEN lg.so_luong < 0 THEN -lg.so_luong * lg.gia_von ELSE 0 END), 0) AS gia_tri_xuat"
                + " FROM (" + SO_DA_QUY_DAU + ") lg "
                + DIEU_KIEN
                + " GROUP BY lg.loai_giao_dich ORDER BY lg.loai_giao_dich";
        return jdbc.query(sql, thamSo(tuNgay, denNgay, khoId, loai), (rs, i) -> new TheoLoai(rs.getString("loai_giao_dich"),
                rs.getLong("so_chung_tu"), rs.getBigDecimal("tong_nhap"), rs.getBigDecimal("tong_xuat"),
                rs.getBigDecimal("gia_tri_nhap"), rs.getBigDecimal("gia_tri_xuat")));
    }
}
