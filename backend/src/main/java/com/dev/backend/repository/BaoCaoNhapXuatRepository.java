package com.dev.backend.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * Số liệu của Báo cáo nhập xuất (/reports/stock-movements), đọc sổ lich_su_giao_dich_kho:
 * - Số lượng quy dấu theo loại giao dịch: nhập +, xuất −, điều chỉnh giữ dấu chênh lệch.
 * - Bỏ dòng của Kho Trung Chuyển (hàng đi đường khi chuyển kho) để hàng chuyển kho không bị cộng nhập hai lần.
 * - Nhóm (nhập từ đâu, xuất đi đâu) lấy theo chứng từ gốc: phiếu nhập của đơn mua, của phiếu chuyển kho, phiếu nhập hoàn
 *   (PN-RET không gắn phiếu chuyển là hàng của đơn bị hoàn); phiếu xuất chuyển kho, bán tại quầy (kênh POS như Báo cáo
 *   doanh thu), giao đơn; điều chỉnh tăng, giảm.
 * - Giá trị = số lượng × giá vốn ghi trên sổ (thiếu thì giá vốn của lô).
 * - Phạm vi kho: :tatCaKho = TRUE hoặc kho thuộc :khoIds (danh sách không rỗng, không có kho nào thì -1).
 * Kỳ tính theo thời điểm giao dịch trong [tu, denSau) với denSau = ngày sau ngày cuối kỳ.
 */
@Repository
public class BaoCaoNhapXuatRepository {

    /** Dòng sổ đã quy dấu (không nhóm), dùng cho tồn đầu, tồn cuối, cùng kỳ. Còn thiếu điều kiện thời gian. */
    private static final String SO_GON = """
            SELECT x.id, x.ngay_giao_dich, x.kho_id, x.bien_the_san_pham_id,
                   COALESCE(x.gia_von, lh.gia_von, 0) AS gia_von,
                   CASE WHEN x.loai_giao_dich = 'xuat_kho' THEN -ABS(x.so_luong)
                        WHEN x.loai_giao_dich = 'nhap_kho' THEN ABS(x.so_luong)
                        ELSE x.so_luong END AS so_luong
            FROM lich_su_giao_dich_kho x
            JOIN kho k0 ON k0.id = x.kho_id AND k0.ma_kho <> 'KHO_TRANSIT'
            LEFT JOIN lo_hang lh ON lh.id = x.lo_hang_id
            WHERE (:tatCaKho = TRUE OR x.kho_id IN (:khoIds))
              AND x.loai_giao_dich <> 'chuyen_ke_noi_bo'
            """;

    /** Dòng sổ đã quy dấu kèm nhóm và chứng từ. Còn thiếu điều kiện thời gian. */
    private static final String SO_NHOM = """
            SELECT x.id, x.ngay_giao_dich, x.loai_giao_dich, x.loai_tham_chieu, x.id_tham_chieu, x.kho_id,
                   x.kho_chuyen_den_id, x.bien_the_san_pham_id, x.lo_hang_id, x.ghi_chu,
                   COALESCE(x.gia_von, lh.gia_von, 0) AS gia_von,
                   CASE WHEN x.loai_giao_dich = 'xuat_kho' THEN -ABS(x.so_luong)
                        WHEN x.loai_giao_dich = 'nhap_kho' THEN ABS(x.so_luong)
                        ELSE x.so_luong END AS so_luong,
                   CASE
                     WHEN x.loai_giao_dich = 'dieu_chinh' THEN IF(x.so_luong >= 0, 'DC_TANG', 'DC_GIAM')
                     WHEN x.loai_giao_dich = 'chuyen_kho' THEN IF(x.so_luong >= 0, 'N_CHUYEN', 'X_CHUYEN')
                     WHEN x.loai_giao_dich = 'nhap_kho' THEN
                       CASE WHEN pn.phieu_chuyen_kho_id IS NOT NULL OR pn.so_phieu_nhap LIKE 'PN-TRF-%' THEN 'N_CHUYEN'
                            WHEN pn.don_mua_hang_id IS NOT NULL THEN 'N_MUA'
                            WHEN pn.so_phieu_nhap LIKE 'PN-RET-%' THEN 'N_HOAN'
                            ELSE 'N_KHAC' END
                     ELSE
                       CASE WHEN px.loai_xuat = 'chuyen_kho' OR px.phieu_chuyen_kho_id IS NOT NULL THEN 'X_CHUYEN'
                            WHEN px.loai_xuat = 'ban_hang' AND kb.id IS NOT NULL AND COALESCE(kb.ma_kenh, '') <> 'POS' THEN 'X_DON'
                            WHEN px.loai_xuat = 'ban_hang' AND (kb.id IS NOT NULL OR EXISTS (
                                SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = px.don_ban_hang_id)) THEN 'X_QUAY'
                            WHEN px.loai_xuat = 'ban_hang' THEN 'X_DON'
                            WHEN px.loai_xuat = 'tra_hang' THEN 'X_TRA_NCC'
                            ELSE 'X_KHAC' END
                   END AS nhom
            FROM lich_su_giao_dich_kho x
            JOIN kho k0 ON k0.id = x.kho_id AND k0.ma_kho <> 'KHO_TRANSIT'
            LEFT JOIN lo_hang lh ON lh.id = x.lo_hang_id
            LEFT JOIN phieu_nhap_kho pn ON x.loai_tham_chieu = 'phieu_nhap_kho' AND pn.id = x.id_tham_chieu
            LEFT JOIN phieu_xuat_kho px ON x.loai_tham_chieu = 'phieu_xuat_kho' AND px.id = x.id_tham_chieu
            LEFT JOIN don_ban_hang dbh ON dbh.id = px.don_ban_hang_id
            LEFT JOIN kenh_ban_hang kb ON kb.id = dbh.kenh_ban_id
            WHERE (:tatCaKho = TRUE OR x.kho_id IN (:khoIds))
              AND x.loai_giao_dich <> 'chuyen_ke_noi_bo'
            """;

    private static final String TRONG_KY = " AND x.ngay_giao_dich >= :tu AND x.ngay_giao_dich < :denSau";

    /** Phát sinh trong kỳ cộng theo ngày, nhóm, kho, sản phẩm (số nhập, xuất đều dương). */
    public record PhatSinh(LocalDate ngay, String nhom, int khoId, int sanPhamId, BigDecimal slNhap, BigDecimal slXuat,
                           BigDecimal gtNhap, BigDecimal gtXuat) {
    }

    /** Một chứng từ có phát sinh trong một ngày: chieu > 0 phía nhập, < 0 phía xuất. */
    public record ChungTu(LocalDate ngay, String nhom, String khoa, int chieu) {
    }

    /** Số lượng, giá trị theo kho và sản phẩm. */
    public record SoKhoSanPham(int khoId, int sanPhamId, BigDecimal soLuong, BigDecimal giaTri) {
    }

    /** Phát sinh từ đầu kỳ tới nay (tuDau*) và sau cuối kỳ tới nay (sau*), theo kho và sản phẩm. */
    public record SauMoc(int khoId, int sanPhamId, BigDecimal slTuDau, BigDecimal gtTuDau, BigDecimal slSau, BigDecimal gtSau) {
    }

    public record SanPham(int id, String ma, String ten, String danhMuc, int soSku) {
    }

    public record Kho(int id, String ten) {
    }

    /** Một dòng sổ cho trang Chi tiết của tệp Excel. soLuong > 0 là nhập, < 0 là xuất. */
    public record GiaoDich(long id, LocalDateTime ngay, String nhom, String soChungTu, String kho, String khoDen,
                           String maSanPham, String tenSanPham, String maSku, String maLo, BigDecimal soLuong,
                           BigDecimal giaVon, String ghiChu) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public BaoCaoNhapXuatRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static MapSqlParameterSource thamSo(boolean tatCaKho, Collection<Integer> khoIds) {
        return new MapSqlParameterSource()
                .addValue("tatCaKho", tatCaKho)
                .addValue("khoIds", khoIds == null || khoIds.isEmpty() ? List.of(-1) : khoIds);
    }

    private static MapSqlParameterSource thamSo(boolean tatCaKho, Collection<Integer> khoIds, LocalDate tu, LocalDate den) {
        return thamSo(tatCaKho, khoIds).addValue("tu", tu).addValue("denSau", den.plusDays(1));
    }

    private static BigDecimal bd(ResultSet rs, String cot) throws SQLException {
        BigDecimal v = rs.getBigDecimal(cot);
        return v == null ? BigDecimal.ZERO : v;
    }

    /** Phát sinh trong [tu, den] theo ngày, nhóm, kho, sản phẩm. */
    public List<PhatSinh> phatSinh(boolean tatCaKho, Collection<Integer> khoIds, LocalDate tu, LocalDate den) {
        String sql = """
                SELECT DATE(s.ngay_giao_dich) AS ngay, s.nhom, s.kho_id, bt.san_pham_id AS sp_id,
                       SUM(GREATEST(s.so_luong, 0))              AS sl_nhap,
                       SUM(GREATEST(-s.so_luong, 0))             AS sl_xuat,
                       SUM(GREATEST(s.so_luong, 0) * s.gia_von)  AS gt_nhap,
                       SUM(GREATEST(-s.so_luong, 0) * s.gia_von) AS gt_xuat
                FROM (""" + SO_NHOM + TRONG_KY + """
                ) s
                JOIN bien_the_san_pham bt ON bt.id = s.bien_the_san_pham_id
                GROUP BY DATE(s.ngay_giao_dich), s.nhom, s.kho_id, bt.san_pham_id
                """;
        return jdbc.query(sql, thamSo(tatCaKho, khoIds, tu, den), (rs, i) -> new PhatSinh(
                rs.getDate("ngay").toLocalDate(), rs.getString("nhom"), rs.getInt("kho_id"), rs.getInt("sp_id"),
                bd(rs, "sl_nhap"), bd(rs, "sl_xuat"), bd(rs, "gt_nhap"), bd(rs, "gt_xuat")));
    }

    /** Các chứng từ có phát sinh trong [tu, den], mỗi ngày, nhóm, chiều một lần (để đếm số phiếu). */
    public List<ChungTu> chungTu(boolean tatCaKho, Collection<Integer> khoIds, LocalDate tu, LocalDate den) {
        String sql = """
                SELECT DISTINCT DATE(s.ngay_giao_dich) AS ngay, s.nhom, s.loai_tham_chieu, s.id_tham_chieu,
                       SIGN(s.so_luong) AS chieu
                FROM (""" + SO_NHOM + TRONG_KY + """
                ) s
                WHERE s.id_tham_chieu IS NOT NULL AND s.so_luong <> 0
                """;
        return jdbc.query(sql, thamSo(tatCaKho, khoIds, tu, den), (rs, i) -> new ChungTu(
                rs.getDate("ngay").toLocalDate(), rs.getString("nhom"),
                rs.getString("loai_tham_chieu") + ":" + rs.getLong("id_tham_chieu"), rs.getInt("chieu")));
    }

    /** Tồn hiện tại (số lượng, giá trị theo giá vốn của lô) theo kho và sản phẩm, bỏ Kho Trung Chuyển. */
    public List<SoKhoSanPham> tonHienTai(boolean tatCaKho, Collection<Integer> khoIds) {
        String sql = """
                SELECT t.kho_id, bt.san_pham_id AS sp_id,
                       SUM(t.so_luong_ton) AS sl, SUM(t.so_luong_ton * lh.gia_von) AS gt
                FROM ton_kho_theo_lo t
                JOIN kho k0 ON k0.id = t.kho_id AND k0.ma_kho <> 'KHO_TRANSIT'
                JOIN lo_hang lh ON lh.id = t.lo_hang_id
                JOIN bien_the_san_pham bt ON bt.id = lh.bien_the_san_pham_id
                WHERE (:tatCaKho = TRUE OR t.kho_id IN (:khoIds)) AND t.so_luong_ton <> 0
                GROUP BY t.kho_id, bt.san_pham_id
                """;
        return jdbc.query(sql, thamSo(tatCaKho, khoIds), (rs, i) -> new SoKhoSanPham(
                rs.getInt("kho_id"), rs.getInt("sp_id"), bd(rs, "sl"), bd(rs, "gt")));
    }

    /**
     * Phát sinh (có dấu) từ ngày tu tới nay và từ ngày sau den tới nay, theo kho và sản phẩm: tồn đầu kỳ = tồn hiện tại −
     * phát sinh từ đầu kỳ; tồn cuối kỳ = tồn hiện tại − phát sinh sau cuối kỳ.
     */
    public List<SauMoc> sauMoc(boolean tatCaKho, Collection<Integer> khoIds, LocalDate tu, LocalDate den) {
        String sql = """
                SELECT s.kho_id, bt.san_pham_id AS sp_id,
                       SUM(s.so_luong)                AS sl_tu,
                       SUM(s.so_luong * s.gia_von)    AS gt_tu,
                       SUM(CASE WHEN s.ngay_giao_dich >= :denSau THEN s.so_luong ELSE 0 END)             AS sl_sau,
                       SUM(CASE WHEN s.ngay_giao_dich >= :denSau THEN s.so_luong * s.gia_von ELSE 0 END) AS gt_sau
                FROM (""" + SO_GON + " AND x.ngay_giao_dich >= :tu" + """
                ) s
                JOIN bien_the_san_pham bt ON bt.id = s.bien_the_san_pham_id
                GROUP BY s.kho_id, bt.san_pham_id
                """;
        return jdbc.query(sql, thamSo(tatCaKho, khoIds, tu, den), (rs, i) -> new SauMoc(
                rs.getInt("kho_id"), rs.getInt("sp_id"), bd(rs, "sl_tu"), bd(rs, "gt_tu"), bd(rs, "sl_sau"), bd(rs, "gt_sau")));
    }

    /** Tổng số lượng nhập, xuất trong [tu, den] (cùng kỳ năm trước): [nhập, xuất]. */
    public BigDecimal[] tongNhapXuat(boolean tatCaKho, Collection<Integer> khoIds, LocalDate tu, LocalDate den) {
        String sql = "SELECT SUM(GREATEST(s.so_luong, 0)) AS n, SUM(GREATEST(-s.so_luong, 0)) AS x FROM ("
                + SO_GON + TRONG_KY + ") s JOIN bien_the_san_pham bt ON bt.id = s.bien_the_san_pham_id";
        return jdbc.query(sql, thamSo(tatCaKho, khoIds, tu, den), rs -> {
            rs.next();
            return new BigDecimal[]{bd(rs, "n"), bd(rs, "x")};
        });
    }

    /** Tên, mã, danh mục, số mã SKU của các sản phẩm. */
    public List<SanPham> sanPham(Collection<Integer> ids) {
        if (ids.isEmpty()) return List.of();
        return jdbc.query("""
                SELECT sp.id, sp.ma_san_pham, sp.ten_san_pham, dm.ten_danh_muc,
                       (SELECT COUNT(*) FROM bien_the_san_pham b WHERE b.san_pham_id = sp.id) AS so_sku
                FROM san_pham_quan_ao sp
                LEFT JOIN danh_muc_quan_ao dm ON dm.id = sp.danh_muc_id
                WHERE sp.id IN (:ids)
                """, new MapSqlParameterSource("ids", ids), (rs, i) -> new SanPham(rs.getInt("id"),
                rs.getString("ma_san_pham"), rs.getString("ten_san_pham"), rs.getString("ten_danh_muc"), rs.getInt("so_sku")));
    }

    public List<Kho> kho(Collection<Integer> ids) {
        if (ids.isEmpty()) return List.of();
        return jdbc.query("SELECT id, ten_kho FROM kho WHERE id IN (:ids)", new MapSqlParameterSource("ids", ids),
                (rs, i) -> new Kho(rs.getInt("id"), rs.getString("ten_kho")));
    }

    /**
     * Các dòng sổ trong [tu, den] kèm số chứng từ, kho, sản phẩm, lô, cũ trước; nhom khác null thì chỉ nhóm đó; lấy tối
     * đa gioiHan dòng.
     */
    public List<GiaoDich> chiTiet(boolean tatCaKho, Collection<Integer> khoIds, LocalDate tu, LocalDate den, String nhom,
                                  int gioiHan) {
        String sql = "SELECT s.id, s.ngay_giao_dich, s.nhom, s.so_luong, s.gia_von, s.ghi_chu,"
                + " CASE s.loai_tham_chieu WHEN 'phieu_nhap_kho' THEN pn.so_phieu_nhap"
                + "   WHEN 'phieu_xuat_kho' THEN px.so_phieu_xuat WHEN 'phieu_dieu_chinh_kho' THEN pdc.so_phieu END AS so_chung_tu,"
                + " k.ten_kho, kd.ten_kho AS ten_kho_den, sp.ma_san_pham, sp.ten_san_pham, bt.ma_sku, lh.ma_lo"
                + " FROM (" + SO_NHOM + TRONG_KY + ") s"
                + " JOIN kho k ON k.id = s.kho_id"
                + " LEFT JOIN kho kd ON kd.id = s.kho_chuyen_den_id"
                + " LEFT JOIN bien_the_san_pham bt ON bt.id = s.bien_the_san_pham_id"
                + " LEFT JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id"
                + " LEFT JOIN lo_hang lh ON lh.id = s.lo_hang_id"
                + " LEFT JOIN phieu_nhap_kho pn ON s.loai_tham_chieu = 'phieu_nhap_kho' AND pn.id = s.id_tham_chieu"
                + " LEFT JOIN phieu_xuat_kho px ON s.loai_tham_chieu = 'phieu_xuat_kho' AND px.id = s.id_tham_chieu"
                + " LEFT JOIN phieu_dieu_chinh_kho pdc ON s.loai_tham_chieu = 'phieu_dieu_chinh_kho' AND pdc.id = s.id_tham_chieu"
                + " WHERE (:nhom IS NULL OR s.nhom = :nhom)"
                + " ORDER BY s.ngay_giao_dich, s.id LIMIT :gioiHan";
        return jdbc.query(sql, thamSo(tatCaKho, khoIds, tu, den).addValue("nhom", nhom).addValue("gioiHan", gioiHan), (rs, i) -> {
            Timestamp t = rs.getTimestamp("ngay_giao_dich");
            return new GiaoDich(rs.getLong("id"), t == null ? null : t.toLocalDateTime(), rs.getString("nhom"),
                    rs.getString("so_chung_tu"), rs.getString("ten_kho"), rs.getString("ten_kho_den"),
                    rs.getString("ma_san_pham"), rs.getString("ten_san_pham"), rs.getString("ma_sku"), rs.getString("ma_lo"),
                    rs.getBigDecimal("so_luong"), rs.getBigDecimal("gia_von"), rs.getString("ghi_chu"));
        });
    }
}
