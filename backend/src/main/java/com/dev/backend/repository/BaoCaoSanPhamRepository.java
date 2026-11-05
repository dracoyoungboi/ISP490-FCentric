package com.dev.backend.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Số liệu của Báo cáo sản phẩm (/reports/products). Lọc đơn như Báo cáo doanh thu (DoanhThuReportRepository) để tổng
 * khớp nhau:
 * - Chỉ đơn bán (loai_chung_tu = 'don_ban_hang', không lấy báo giá), trạng thái 3 (đã xuất toàn bộ) và 5 (hoàn thành);
 *   đơn 6 (bị hoàn trả) chỉ đếm vào số hoàn. Ngày tính là ngay_giao_hang, khoảng [tu, den + 1 ngày).
 * - Doanh thu hàng của dòng = thành tiền − giảm giá dòng (đơn Shopify), gồm thuế GTGT, không gồm phí vận chuyển.
 * - Giá vốn chỉ cộng dòng phiếu xuất hoàn tất CÓ LÔ (dòng gốc không lô của phiếu qua nhặt hàng là số cần xuất).
 * - Khả dụng: tồn khả dụng các lô ở kho đang hoạt động, bỏ Kho Trung Chuyển (như thẻ Bán chạy ở Tổng quan).
 * - Đang về: số chờ nhận của đơn mua đã chấp nhận (3) / đã nhận (5) còn thiếu (như cột Incoming của Báo cáo tồn kho).
 * Phạm vi kho: tatCa = 1 thì mọi kho, không thì chỉ các kho trong :khoIds. Kênh: null mọi kênh, POS (đơn từ quầy),
 * TRUC_TIEP (không kênh, không từ quầy), hoặc id kênh bán.
 */
@Repository
public class BaoCaoSanPhamRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public BaoCaoSanPhamRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record PhamVi(boolean tatCaKho, List<Integer> khoIds, String kenh) {
    }

    public record BanBienThe(int bienTheId, BigDecimal soLuong, BigDecimal doanhThu, BigDecimal soLuongHoan) {
    }

    public record GiaVonBienThe(int bienTheId, BigDecimal giaVon) {
    }

    public record SoDonSanPham(int sanPhamId, long soDon) {
    }

    public record BanNgay(int sanPhamId, LocalDate ngay, BigDecimal soLuong, BigDecimal doanhThu) {
    }

    public record BanKenh(int sanPhamId, String tenKenh, BigDecimal soLuong, BigDecimal doanhThu) {
    }

    public record TonBienThe(int bienTheId, BigDecimal khaDung, BigDecimal giaTri) {
    }

    public record DangVeBienThe(int bienTheId, BigDecimal dangVe) {
    }

    public record NgaySanPham(int sanPhamId, LocalDate ngay) {
    }

    public record BienTheDong(int bienTheId, String maSku, BigDecimal giaBan, Integer trangThaiBienThe,
                              String tenMau, String maMauHex, String tenSize, Integer thuTuSize,
                              int sanPhamId, String maSanPham, String tenSanPham, String donViTinh, Integer trangThai,
                              String danhMuc, String thuongHieu, String anh) {
    }

    public record KenhDong(int id, String ten) {
    }

    /** Ngày tính của đơn đã ghi nhận doanh thu: ngày giao hàng (như Báo cáo doanh thu). */
    private static final String NGAY_GIAO = "dbh.ngay_giao_hang";
    /** Ngày tính của đơn bị hoàn trả: ngày giao, chưa có (hoàn khi mới xuất một phần) thì ngày phiếu xuất hoàn tất cuối. */
    private static final String NGAY_HOAN = "COALESCE(dbh.ngay_giao_hang, (SELECT MAX(p2.ngay_xuat) FROM phieu_xuat_kho p2"
            + " WHERE p2.don_ban_hang_id = dbh.id AND p2.trang_thai = 3))";

    /**
     * Điều kiện chung của đơn: loại, kho, kênh, khoảng ngày ({NGAY}). :trangThai là danh sách trạng thái cần lấy.
     * Kênh POS: đơn từ quầy không gắn kênh khác (kênh sàn được ưu tiên như bảng theo kênh ở Tổng quan), hoặc gắn bản
     * ghi kênh mã POS.
     */
    private static final String DIEU_KIEN_DON_MAU = """
              dbh.loai_chung_tu = 'don_ban_hang'
              AND dbh.trang_thai IN (:trangThai)
              AND {NGAY} >= :tu AND {NGAY} < :den
              AND (:tatCa = 1 OR dbh.kho_xuat_id IN (:khoIds))
              AND (:kenh IS NULL
                   OR (:kenh = 'POS' AND ((dbh.kenh_ban_id IS NULL
                            AND EXISTS (SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = dbh.id))
                        OR dbh.kenh_ban_id IN (SELECT kp.id FROM kenh_ban_hang kp WHERE kp.ma_kenh = 'POS')))
                   OR (:kenh = 'TRUC_TIEP' AND dbh.kenh_ban_id IS NULL
                       AND NOT EXISTS (SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = dbh.id))
                   OR (:kenhId IS NOT NULL AND dbh.kenh_ban_id = :kenhId))
            """;
    private static final String DIEU_KIEN_DON = DIEU_KIEN_DON_MAU.replace("{NGAY}", NGAY_GIAO);
    private static final String DIEU_KIEN_HOAN = DIEU_KIEN_DON_MAU.replace("{NGAY}", NGAY_HOAN);

    private static MapSqlParameterSource thamSo(PhamVi pv, LocalDate tu, LocalDate den, List<Integer> trangThai) {
        Integer kenhId = null;
        String kenh = pv.kenh();
        if (kenh != null && kenh.chars().allMatch(Character::isDigit)) {
            kenhId = Integer.valueOf(kenh); // chuanKenh đã kiểm số nằm trong khoảng int
            kenh = "ID";
        }
        return new MapSqlParameterSource()
                .addValue("trangThai", trangThai)
                .addValue("tu", tu, Types.DATE)
                .addValue("den", den.plusDays(1), Types.DATE)
                .addValue("tatCa", pv.tatCaKho() ? 1 : 0)
                .addValue("khoIds", pv.khoIds().isEmpty() ? List.of(-1) : pv.khoIds())
                .addValue("kenh", kenh, Types.VARCHAR)
                .addValue("kenhId", kenhId, Types.INTEGER);
    }

    private static final String SQL_BAN_BIEN_THE = """
            SELECT ct.bien_the_san_pham_id AS bt_id,
                   SUM(ct.so_luong_dat)                                                                        AS so_luong,
                   SUM(COALESCE(ct.thanh_tien, ct.so_luong_dat * ct.don_gia) - COALESCE(ct.tien_giam_gia, 0)) AS doanh_thu
            FROM don_ban_hang dbh
            JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = dbh.id
            WHERE """ + DIEU_KIEN_DON + """
            GROUP BY ct.bien_the_san_pham_id
            """;

    /** Số bán và doanh thu hàng theo biến thể trong [tu, den] (soLuongHoan luôn 0, xem hoanTheoBienThe). */
    public List<BanBienThe> banTheoBienThe(PhamVi pv, LocalDate tu, LocalDate den) {
        return jdbc.query(SQL_BAN_BIEN_THE, thamSo(pv, tu, den, List.of(3, 5)), (rs, i) -> new BanBienThe(
                rs.getInt("bt_id"), bd(rs, "so_luong"), bd(rs, "doanh_thu"), BigDecimal.ZERO));
    }

    private static final String SQL_HOAN_BIEN_THE = """
            SELECT ctpx.bien_the_san_pham_id AS bt_id, SUM(ctpx.so_luong_xuat) AS so_luong
            FROM don_ban_hang dbh
            JOIN phieu_xuat_kho pxk           ON pxk.don_ban_hang_id = dbh.id AND pxk.trang_thai = 3
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
            WHERE """ + DIEU_KIEN_HOAN + """
            GROUP BY ctpx.bien_the_san_pham_id
            """;

    /** Số lượng bị hoàn trả theo biến thể: số đã xuất (dòng có lô) của đơn bị hoàn trả có ngày tính trong [tu, den]. */
    public List<GiaVonBienThe> hoanTheoBienThe(PhamVi pv, LocalDate tu, LocalDate den) {
        return jdbc.query(SQL_HOAN_BIEN_THE, thamSo(pv, tu, den, List.of(6)),
                (rs, i) -> new GiaVonBienThe(rs.getInt("bt_id"), bd(rs, "so_luong")));
    }

    private static final String SQL_GIA_VON_BIEN_THE = """
            SELECT ctpx.bien_the_san_pham_id AS bt_id, SUM(ctpx.so_luong_xuat * ctpx.gia_von) AS gia_von
            FROM don_ban_hang dbh
            JOIN phieu_xuat_kho pxk           ON pxk.don_ban_hang_id = dbh.id AND pxk.trang_thai = 3
            JOIN chi_tiet_phieu_xuat_kho ctpx ON ctpx.phieu_xuat_kho_id = pxk.id AND ctpx.lo_hang_id IS NOT NULL
            WHERE """ + DIEU_KIEN_DON + """
            GROUP BY ctpx.bien_the_san_pham_id
            """;

    /** Giá vốn theo biến thể của các đơn đã ghi nhận doanh thu trong [tu, den]. */
    public List<GiaVonBienThe> giaVonTheoBienThe(PhamVi pv, LocalDate tu, LocalDate den) {
        return jdbc.query(SQL_GIA_VON_BIEN_THE, thamSo(pv, tu, den, List.of(3, 5)),
                (rs, i) -> new GiaVonBienThe(rs.getInt("bt_id"), bd(rs, "gia_von")));
    }

    private static final String SQL_SO_DON = """
            SELECT bt.san_pham_id AS sp_id, COUNT(DISTINCT dbh.id) AS so_don
            FROM don_ban_hang dbh
            JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = dbh.id
            JOIN bien_the_san_pham bt     ON bt.id = ct.bien_the_san_pham_id
            WHERE """ + DIEU_KIEN_DON + """
            GROUP BY bt.san_pham_id
            """;

    public List<SoDonSanPham> soDonTheoSanPham(PhamVi pv, LocalDate tu, LocalDate den) {
        return jdbc.query(SQL_SO_DON, thamSo(pv, tu, den, List.of(3, 5)),
                (rs, i) -> new SoDonSanPham(rs.getInt("sp_id"), rs.getLong("so_don")));
    }

    private static final String SQL_TONG_SO_DON = """
            SELECT COUNT(DISTINCT dbh.id)
            FROM don_ban_hang dbh
            WHERE """ + DIEU_KIEN_DON;

    public long tongSoDon(PhamVi pv, LocalDate tu, LocalDate den) {
        Long n = jdbc.queryForObject(SQL_TONG_SO_DON, thamSo(pv, tu, den, List.of(3, 5)), Long.class);
        return n == null ? 0 : n;
    }

    private static final String SQL_BAN_NGAY = """
            SELECT bt.san_pham_id AS sp_id, DATE(dbh.ngay_giao_hang) AS ngay, SUM(ct.so_luong_dat) AS so_luong,
                   SUM(COALESCE(ct.thanh_tien, ct.so_luong_dat * ct.don_gia) - COALESCE(ct.tien_giam_gia, 0)) AS doanh_thu
            FROM don_ban_hang dbh
            JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = dbh.id
            JOIN bien_the_san_pham bt     ON bt.id = ct.bien_the_san_pham_id
            WHERE """ + DIEU_KIEN_DON + """
            GROUP BY bt.san_pham_id, DATE(dbh.ngay_giao_hang)
            """;

    public List<BanNgay> banTheoNgay(PhamVi pv, LocalDate tu, LocalDate den) {
        return jdbc.query(SQL_BAN_NGAY, thamSo(pv, tu, den, List.of(3, 5)), (rs, i) -> new BanNgay(
                rs.getInt("sp_id"), rs.getDate("ngay").toLocalDate(), bd(rs, "so_luong"), bd(rs, "doanh_thu")));
    }

    private static final String SQL_BAN_KENH = """
            SELECT x.sp_id, x.ten_kenh, SUM(x.so_luong) AS so_luong, SUM(x.doanh_thu) AS doanh_thu
            FROM (
                SELECT bt.san_pham_id AS sp_id,
                       CASE WHEN kb.id IS NOT NULL AND kb.ma_kenh <> 'POS' THEN kb.ten_kenh
                            WHEN kb.ma_kenh = 'POS'
                              OR EXISTS (SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = dbh.id) THEN 'Bán tại quầy'
                            ELSE 'Đơn bán trực tiếp' END                                         AS ten_kenh,
                       ct.so_luong_dat                                                             AS so_luong,
                       COALESCE(ct.thanh_tien, ct.so_luong_dat * ct.don_gia) - COALESCE(ct.tien_giam_gia, 0) AS doanh_thu
                FROM don_ban_hang dbh
                JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = dbh.id
                JOIN bien_the_san_pham bt     ON bt.id = ct.bien_the_san_pham_id
                LEFT JOIN kenh_ban_hang kb    ON kb.id = dbh.kenh_ban_id
                WHERE """ + DIEU_KIEN_DON + """
            ) x
            GROUP BY x.sp_id, x.ten_kenh
            """;

    public List<BanKenh> banTheoKenh(PhamVi pv, LocalDate tu, LocalDate den) {
        return jdbc.query(SQL_BAN_KENH, thamSo(pv, tu, den, List.of(3, 5)), (rs, i) -> new BanKenh(
                rs.getInt("sp_id"), rs.getString("ten_kenh"), bd(rs, "so_luong"), bd(rs, "doanh_thu")));
    }

    private static final String SQL_BAN_CUOI = """
            SELECT bt.san_pham_id AS sp_id, MAX(DATE(dbh.ngay_giao_hang)) AS ngay
            FROM don_ban_hang dbh
            JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = dbh.id
            JOIN bien_the_san_pham bt     ON bt.id = ct.bien_the_san_pham_id
            WHERE """ + DIEU_KIEN_DON + """
            GROUP BY bt.san_pham_id
            """;

    /** Ngày bán gần nhất của từng sản phẩm trong 2 năm tới hết ngày den (cũ hơn coi như chưa bán, đỡ quét cả lịch sử). */
    public List<NgaySanPham> ngayBanCuoi(PhamVi pv, LocalDate den) {
        return jdbc.query(SQL_BAN_CUOI, thamSo(pv, den.minusYears(2), den, List.of(3, 5)),
                (rs, i) -> new NgaySanPham(rs.getInt("sp_id"), rs.getDate("ngay").toLocalDate()));
    }

    private static final String SQL_TON = """
            SELECT lh.bien_the_san_pham_id AS bt_id,
                   COALESCE(SUM(tk.so_luong_kha_dung), 0)            AS kha_dung,
                   COALESCE(SUM(tk.so_luong_ton * lh.gia_von), 0)      AS gia_tri
            FROM ton_kho_theo_lo tk
            JOIN lo_hang lh ON lh.id = tk.lo_hang_id
            JOIN kho k      ON k.id = tk.kho_id AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
            WHERE (:tatCa = 1 OR tk.kho_id IN (:khoIds))
            GROUP BY lh.bien_the_san_pham_id
            """;

    /** Khả dụng hiện tại và giá trị tồn (tồn thực × giá vốn của lô, như Báo cáo tồn kho), theo biến thể. */
    public List<TonBienThe> tonTheoBienThe(PhamVi pv) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("tatCa", pv.tatCaKho() ? 1 : 0)
                .addValue("khoIds", pv.khoIds().isEmpty() ? List.of(-1) : pv.khoIds());
        return jdbc.query(SQL_TON, p, (rs, i) -> new TonBienThe(rs.getInt("bt_id"), bd(rs, "kha_dung"), bd(rs, "gia_tri")));
    }

    private static final String SQL_DANG_VE = """
            SELECT ct.bien_the_san_pham_id AS bt_id, SUM(ct.so_luong_dat - COALESCE(ct.so_luong_da_nhan, 0)) AS dang_ve
            FROM chi_tiet_don_mua_hang ct
            JOIN don_mua_hang dmh ON dmh.id = ct.don_mua_hang_id
            WHERE dmh.trang_thai IN (3, 5)
              AND ct.so_luong_dat - COALESCE(ct.so_luong_da_nhan, 0) > 0
              AND (:tatCa = 1 OR dmh.kho_nhap_id IN (:khoIds))
            GROUP BY ct.bien_the_san_pham_id
            """;

    public List<DangVeBienThe> dangVeTheoBienThe(PhamVi pv) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("tatCa", pv.tatCaKho() ? 1 : 0)
                .addValue("khoIds", pv.khoIds().isEmpty() ? List.of(-1) : pv.khoIds());
        return jdbc.query(SQL_DANG_VE, p, (rs, i) -> new DangVeBienThe(rs.getInt("bt_id"), bd(rs, "dang_ve")));
    }

    private static final String SQL_NHAP_DAU = """
            SELECT bt.san_pham_id AS sp_id, MIN(ls.ngay_giao_dich) AS ngay
            FROM lich_su_giao_dich_kho ls
            JOIN bien_the_san_pham bt ON bt.id = ls.bien_the_san_pham_id
            JOIN kho k                ON k.id = ls.kho_id AND k.ma_kho <> 'KHO_TRANSIT'
            WHERE COALESCE(ls.so_luong_sau, 0) > COALESCE(ls.so_luong_truoc, 0)
              AND (:tatCa = 1 OR ls.kho_id IN (:khoIds))
            GROUP BY bt.san_pham_id
            """;

    private static final String SQL_NHAP_DAU_LO = """
            SELECT bt.san_pham_id AS sp_id, MIN(lh.ngay_tao) AS ngay
            FROM lo_hang lh
            JOIN bien_the_san_pham bt ON bt.id = lh.bien_the_san_pham_id
            WHERE lh.ngay_tao IS NOT NULL
              AND (:tatCa = 1 OR EXISTS (SELECT 1 FROM ton_kho_theo_lo tk WHERE tk.lo_hang_id = lh.id AND tk.kho_id IN (:khoIds)))
            GROUP BY bt.san_pham_id
            """;

    /**
     * Ngày hàng của sản phẩm về kho (trong phạm vi) lần đầu, theo lịch sử giao dịch kho (gồm nhận chuyển kho: lô chuyển
     * giữ ngày tạo ở kho nguồn). Sản phẩm chưa có lịch sử thì lấy ngày tạo lô. Sản phẩm mới về trong kỳ không bị gọi là
     * "không bán". Đọc thẳng giờ CSDL (đã là giờ Việt Nam), không đổi theo múi giờ máy chủ.
     */
    public List<NgaySanPham> ngayNhapDau(PhamVi pv) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("tatCa", pv.tatCaKho() ? 1 : 0)
                .addValue("khoIds", pv.khoIds().isEmpty() ? List.of(-1) : pv.khoIds());
        List<NgaySanPham> ds = new ArrayList<>(jdbc.query(SQL_NHAP_DAU, p, (rs, i) -> new NgaySanPham(rs.getInt("sp_id"), ngay(rs))));
        Set<Integer> co = new HashSet<>();
        ds.forEach(n -> co.add(n.sanPhamId()));
        jdbc.query(SQL_NHAP_DAU_LO, p, (rs, i) -> new NgaySanPham(rs.getInt("sp_id"), ngay(rs)))
                .stream().filter(n -> !co.contains(n.sanPhamId())).forEach(ds::add);
        return ds;
    }

    private static LocalDate ngay(ResultSet rs) throws SQLException {
        LocalDateTime t = rs.getObject("ngay", LocalDateTime.class);
        return t == null ? null : t.toLocalDate();
    }

    private static final String SQL_BIEN_THE = """
            SELECT bt.id AS bt_id, bt.ma_sku, bt.gia_ban, bt.trang_thai AS tt_bt,
                   ms.ten_mau, ms.ma_mau_hex, sz.ten_size, sz.thu_tu_sap_xep,
                   sp.id AS sp_id, sp.ma_san_pham, sp.ten_san_pham, sp.don_vi_tinh, sp.trang_thai AS tt_sp,
                   dm.ten_danh_muc, th.ten_thuong_hieu
            FROM bien_the_san_pham bt
            JOIN san_pham_quan_ao sp      ON sp.id = bt.san_pham_id
            LEFT JOIN mau_sac ms          ON ms.id = bt.mau_sac_id
            LEFT JOIN `size` sz           ON sz.id = bt.size_id
            LEFT JOIN danh_muc_quan_ao dm ON dm.id = sp.danh_muc_id
            LEFT JOIN thuong_hieu th      ON th.id = sp.thuong_hieu_id
            ORDER BY sp.id, ms.ten_mau, sz.thu_tu_sap_xep, bt.id
            """;

    /** Mọi biến thể kèm sản phẩm, màu, size, danh mục, thương hiệu (service tự lọc sản phẩm cần hiện; ảnh ở anhTheoSanPham). */
    public List<BienTheDong> bienThe() {
        return jdbc.query(SQL_BIEN_THE, new MapSqlParameterSource(), (rs, i) -> new BienTheDong(
                rs.getInt("bt_id"), rs.getString("ma_sku"), rs.getBigDecimal("gia_ban"), (Integer) rs.getObject("tt_bt", Integer.class),
                rs.getString("ten_mau"), rs.getString("ma_mau_hex"), rs.getString("ten_size"), (Integer) rs.getObject("thu_tu_sap_xep", Integer.class),
                rs.getInt("sp_id"), rs.getString("ma_san_pham"), rs.getString("ten_san_pham"), rs.getString("don_vi_tinh"),
                (Integer) rs.getObject("tt_sp", Integer.class), rs.getString("ten_danh_muc"), rs.getString("ten_thuong_hieu"),
                null));
    }

    /** Ảnh đầu tiên của mỗi sản phẩm (ảnh chính trước). */
    public Map<Integer, String> anhTheoSanPham() {
        Map<Integer, String> m = new HashMap<>();
        jdbc.query("""
                SELECT a.quan_ao_id AS sp_id, tt.duong_dan
                FROM anh_quan_ao a JOIN tep_tin tt ON tt.id = a.tep_tin_id
                WHERE tt.duong_dan IS NOT NULL
                ORDER BY a.quan_ao_id, a.anh_chinh DESC, a.id""", new MapSqlParameterSource(),
                rs -> { m.putIfAbsent(rs.getInt("sp_id"), rs.getString("duong_dan")); });
        return m;
    }

    /** Kênh sàn / web đã từng có đơn (để lọc). Bản ghi kênh POS gộp vào "Bán tại quầy"; kênh chưa có đơn nào (sandbox) bỏ. */
    public List<KenhDong> kenhBan() {
        return jdbc.query("""
                SELECT kb.id, kb.ten_kenh FROM kenh_ban_hang kb
                WHERE kb.ma_kenh <> 'POS' AND EXISTS (SELECT 1 FROM don_ban_hang d WHERE d.kenh_ban_id = kb.id)
                ORDER BY kb.id""", new MapSqlParameterSource(),
                (rs, i) -> new KenhDong(rs.getInt("id"), rs.getString("ten_kenh")));
    }

    private static BigDecimal bd(ResultSet rs, String cot) throws SQLException {
        BigDecimal v = rs.getBigDecimal(cot);
        return v == null ? BigDecimal.ZERO : v;
    }
}
