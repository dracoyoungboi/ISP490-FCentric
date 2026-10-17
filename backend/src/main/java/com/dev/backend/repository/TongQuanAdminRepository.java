package com.dev.backend.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Truy vấn tổng hợp cho màn Tổng quan của quản trị viên (UC 11.1).
 *
 * Quy ước dùng chung cho mọi truy vấn:
 * - Mọi mốc thời gian vào/ra của lớp này là GIỜ VIỆT NAM (ngày bắt đầu lúc 0 giờ ở Việt Nam).
 *   CSDL có thể lưu theo múi giờ khác (hiện kết nối dùng serverTimezone=UTC), nên trước khi so sánh
 *   mốc được đổi sang giờ của CSDL, còn khi gom theo ngày/giờ thì cột được cộng thêm độ lệch.
 *   Độ lệch đo lại ở mỗi lần gọi {@link #thoiDiemHienTai()}, không phụ thuộc cấu hình múi giờ.
 * - Kho ảo KHO_TRANSIT (hàng đang đi đường khi chuyển kho) không tính vào bất kỳ số liệu nào.
 * - Doanh thu: đơn bán trạng thái 3 (Đã xuất toàn bộ) hoặc 5 (Hoàn thành), ghi nhận theo ngày giao;
 *   đơn chưa có ngày giao thì lấy ngày của phiếu xuất hoàn tất cuối cùng; đơn chưa có cả hai
 *   (mới nhặt xong, chưa xuất kho thật) chưa được tính.
 * - Giá vốn: phiếu xuất trạng thái 3 của đơn, theo từng lô (giống Báo cáo doanh thu).
 */
@Repository
public class TongQuanAdminRepository {

    public static final String MA_KHO_TRUNG_CHUYEN = "KHO_TRANSIT";
    public static final String MA_KENH_POS = "POS";
    public static final String MA_KENH_TRUC_TIEP = "TRUC_TIEP";

    private static final DateTimeFormatter DINH_DANG_GIO = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** Múi giờ nghiệp vụ: "hôm nay", "tháng này" và giờ hiển thị đều tính theo giờ Việt Nam. */
    public static final ZoneId MUI_GIO_NGHIEP_VU = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Giờ Việt Nam − giờ mà CSDL trả về, tính bằng phút.
     * lechPhut: cột do ứng dụng ghi (Instant đi qua driver, theo serverTimezone của kết nối).
     * lechPhutCsdl: cột do MySQL tự điền (DEFAULT CURRENT_TIMESTAMP, theo time_zone của phiên),
     * hiện chỉ có lich_su_giao_dich_kho.ngay_giao_dich.
     */
    private volatile int lechPhut;
    private volatile int lechPhutCsdl;
    private volatile boolean daDoLech;

    private final NamedParameterJdbcTemplate jdbc;
    /** Ghi nhớ kết quả dò cấu trúc CSDL (bảng/cột có thể chưa có ở một số máy). */
    private final Map<String, Boolean> cauTrucDaDo = new ConcurrentHashMap<>();

    public TongQuanAdminRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /* ======================================================================
     * BẢN GHI TRẢ VỀ
     * ====================================================================== */

    public record KhoDong(Integer id, String maKho, String tenKho, boolean laKhoTong) {}

    public record DoanhThuNgay(LocalDate ngay, BigDecimal doanhThu, long soDon) {}

    public record GiaVonNgay(LocalDate ngay, BigDecimal giaVon) {}

    public record DoanhThuGio(int gio, BigDecimal doanhThu) {}

    public record SoDonNgay(LocalDate ngay, long soDon) {}

    public record HomNayDong(BigDecimal doanhThu, long soDonGiao,
                             BigDecimal doanhThuCungGioTuanTruoc,
                             long soDonMoi, long soDonMoiCungGioTuanTruoc) {}

    public record DoanhThuKhoDong(Integer khoId, BigDecimal doanhThu, long soDon, BigDecimal doanhThuKyTruoc) {}

    public record KenhDong(String maKenh, String tenKenh, BigDecimal doanhThu, long soDon, long soDonHoan) {}

    public record SanPhamBanChayDong(Integer sanPhamId, String maSanPham, String tenSanPham,
                                     BigDecimal soLuong, BigDecimal doanhThu) {}

    public record TonKhoTongHopDong(BigDecimal tonThucTe, BigDecimal dangGiu, BigDecimal khaDung, BigDecimal giaTri,
                                    long soBienThe, long soDong, long hetHang, long thieuHang,
                                    long binhThuong, long duHang, BigDecimal giaTriDu) {}

    public record TonKhoTheoKhoDong(Integer khoId, BigDecimal tonThucTe, BigDecimal khaDung, BigDecimal giaTri) {}

    public record NhapXuatNgay(LocalDate ngay, BigDecimal nhap, BigDecimal xuat) {}

    public record ViecCanXuLyDong(long donNhapChuaGuiKho, long donChoXuatKho, long phieuNhatChuaPhanCong,
                                  long phieuXuatChoXuatKho, long yeuCauNhapChoDuyet, long phieuNhapChoNhapKho,
                                  long phieuChuyenChoDuyet, long phieuChuyenChoXuatHang, long dotKiemKeDangMo,
                                  long taiKhoanBiKhoa, long donMuaQuaHan) {}

    public record LoiDongBoDong(Integer kenhId, String maKenh, String tenKenh, long soLoi) {}

    public record ViecTheoKhoDong(Integer khoId, String tenKho, long donChoXuatKho, long phieuNhatChuaPhanCong,
                                  long phieuChuyenChoDuyet, long phieuChuyenChoXuatHang) {}

    public record HangCanBoSungDong(Integer bienTheId, String maSku, String tenSanPham, String tenMau,
                                    String tenKichCo, Integer khoId, BigDecimal khaDung, int nguong) {}

    public record HoatDongDong(String loai, Integer id, String maChungTu, LocalDateTime thoiGian, String tenKho,
                               String nguoiThucHien, BigDecimal soLuong, String doiTac, BigDecimal soTien) {}

    /* ======================================================================
     * MỐC THỜI GIAN VÀ CẤU TRÚC CSDL
     * ====================================================================== */

    /**
     * Thời điểm hiện tại theo giờ Việt Nam, đồng thời đo độ lệch giữa giờ Việt Nam và giờ của CSDL:
     * - Instant hiện tại đi qua driver như khi Hibernate ghi cột timestamp, đọc lại dạng chuỗi → giờ của
     *   dữ liệu do ứng dụng ghi.
     * - NOW() của MySQL → giờ của cột do MySQL tự điền.
     */
    public LocalDateTime thoiDiemHienTai() {
        Instant bayGio = bayGio();
        Map<String, Object> r = jdbc.queryForMap(
                "SELECT DATE_FORMAT(:bayGio, '%Y-%m-%d %H:%i:%s') AS ung_dung, "
                        + "DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS csdl",
                new MapSqlParameterSource("bayGio", Timestamp.from(bayGio)));
        LocalDateTime gioViet = LocalDateTime.ofInstant(bayGio, MUI_GIO_NGHIEP_VU).withNano(0);
        lechPhut = doLech(gioViet, String.valueOf(r.get("ung_dung")));
        lechPhutCsdl = doLech(gioViet, String.valueOf(r.get("csdl")));
        daDoLech = true;
        return gioViet;
    }

    /** Thời điểm hiện tại; tách riêng để kiểm thử có thể cố định "bây giờ". */
    protected Instant bayGio() {
        return Instant.now();
    }

    /** Độ lệch (phút) làm tròn tới 15 phút gần nhất, vì múi giờ luôn lệch nhau bội số của 15 phút. */
    private static int doLech(LocalDateTime gioViet, String gioCsdl) {
        long giay = Duration.between(LocalDateTime.parse(gioCsdl, DINH_DANG_GIO), gioViet).getSeconds();
        return (int) (Math.round(giay / 900.0) * 15);
    }

    public boolean coBang(String tenBang) {
        return cauTrucDaDo.computeIfAbsent("bang:" + tenBang, k -> {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t",
                    new MapSqlParameterSource("t", tenBang), Integer.class);
            return n != null && n > 0;
        });
    }

    public boolean coCot(String tenBang, String tenCot) {
        return cauTrucDaDo.computeIfAbsent("cot:" + tenBang + "." + tenCot, k -> {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c",
                    new MapSqlParameterSource("t", tenBang).addValue("c", tenCot), Integer.class);
            return n != null && n > 0;
        });
    }

    /** Giá trị số nguyên của một cấu hình hệ thống (vd. DEFAULT_MIN_STOCK_ALERT), null nếu chưa có hoặc không hợp lệ. */
    public Integer cauHinhSo(String maCauHinh) {
        List<String> giaTri = jdbc.queryForList(
                "SELECT gia_tri FROM cau_hinh_he_thong WHERE ma_cau_hinh = :ma",
                new MapSqlParameterSource("ma", maCauHinh), String.class);
        if (giaTri.isEmpty() || giaTri.get(0) == null) return null;
        try {
            return Integer.parseInt(giaTri.get(0).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /* ======================================================================
     * KHO
     * ====================================================================== */

    static final String SQL_DANH_SACH_KHO = """
            SELECT k.id, k.ma_kho, k.ten_kho, %s AS la_kho_tong
            FROM kho k
            WHERE k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
            ORDER BY la_kho_tong DESC, k.id
            """;

    public List<KhoDong> danhSachKho() {
        String sql = SQL_DANH_SACH_KHO.formatted(bieuThucLaKhoTong("k"));
        return jdbc.query(sql, new MapSqlParameterSource(), (rs, i) -> new KhoDong(
                rs.getInt("id"), rs.getString("ma_kho"), rs.getString("ten_kho"), rs.getInt("la_kho_tong") == 1));
    }

    /* ======================================================================
     * DOANH THU
     * ====================================================================== */

    /**
     * Đơn bán đã ghi nhận doanh thu và ngày ghi nhận (ngay_gn).
     * :tuLoc lọc sớm theo ngày giao (có chỉ mục) để chỉ xét đơn trong khoảng cần xem; đơn có ngày giao
     * trước :tuLoc chắc chắn nằm ngoài khoảng, đơn chưa có ngày giao thì lấy ngày phiếu xuất hoàn tất cuối cùng.
     */
    static final String CTE_DON_GHI_NHAN = """
            WITH don AS (
                SELECT d.id, d.kho_xuat_id, d.kenh_ban_id, d.trang_thai, d.tong_cong,
                       COALESCE(d.ngay_giao_hang,
                                (SELECT MAX(p.ngay_xuat) FROM phieu_xuat_kho p
                                  WHERE p.don_ban_hang_id = d.id AND p.trang_thai = 3))      AS ngay_gn,
                       %s                                                                    AS la_pos
                FROM don_ban_hang d
                WHERE d.loai_chung_tu = 'don_ban_hang'
                  AND d.trang_thai IN (%s)
                  AND (d.ngay_giao_hang IS NULL OR d.ngay_giao_hang >= :tuLoc)
                  AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
            )
            """;

    static final String SQL_DOANH_THU_THEO_NGAY = """
            SELECT DATE_FORMAT(DATE_ADD(ngay_gn, INTERVAL :lech MINUTE), '%Y-%m-%d') AS ngay,
                   SUM(tong_cong)              AS doanh_thu,
                   COUNT(*)                    AS so_don
            FROM don
            WHERE ngay_gn >= :tu AND ngay_gn < :den
            GROUP BY 1
            ORDER BY 1
            """;

    /** Doanh thu và số đơn theo từng ngày ghi nhận trong [tu, den). */
    public List<DoanhThuNgay> doanhThuTheoNgay(LocalDateTime tu, LocalDateTime den, Integer khoId) {
        String sql = cteDon("3, 5") + SQL_DOANH_THU_THEO_NGAY;
        return jdbc.query(sql, thamSo(khoId, tu).addValue("tu", moc(tu)).addValue("den", moc(den)),
                (rs, i) -> new DoanhThuNgay(LocalDate.parse(rs.getString("ngay")),
                        bd(rs, "doanh_thu"), rs.getLong("so_don")));
    }

    /** Giá vốn (theo lô của phiếu xuất hoàn tất) của các đơn, gộp theo ngày ghi nhận doanh thu của đơn. */
    static final String SQL_GIA_VON_THEO_NGAY = """
            SELECT DATE_FORMAT(DATE_ADD(don.ngay_gn, INTERVAL :lech MINUTE), '%Y-%m-%d') AS ngay,
                   COALESCE(SUM(ct.so_luong_xuat * ct.gia_von), 0) AS gia_von
            FROM don
            JOIN phieu_xuat_kho p           ON p.don_ban_hang_id = don.id AND p.trang_thai = 3
            JOIN chi_tiet_phieu_xuat_kho ct ON ct.phieu_xuat_kho_id = p.id AND ct.lo_hang_id IS NOT NULL
            WHERE don.ngay_gn >= :tu AND don.ngay_gn < :den
            GROUP BY 1
            ORDER BY 1
            """;

    /** Giá vốn theo từng ngày ghi nhận trong [tu, den); lợi nhuận gộp = doanh thu − giá vốn. */
    public List<GiaVonNgay> giaVonTheoNgay(LocalDateTime tu, LocalDateTime den, Integer khoId) {
        String sql = cteDon("3, 5") + SQL_GIA_VON_THEO_NGAY;
        return jdbc.query(sql, thamSo(khoId, tu).addValue("tu", moc(tu)).addValue("den", moc(den)),
                (rs, i) -> new GiaVonNgay(LocalDate.parse(rs.getString("ngay")), bd(rs, "gia_von")));
    }

    static final String SQL_DOANH_THU_THEO_GIO = """
            SELECT HOUR(DATE_ADD(ngay_gn, INTERVAL :lech MINUTE)) AS gio, SUM(tong_cong) AS doanh_thu
            FROM don
            WHERE ngay_gn >= :tu AND ngay_gn <= :den
            GROUP BY 1
            ORDER BY 1
            """;

    /** Doanh thu theo giờ trong [tu, den] (dùng cho hôm nay, tính đến hiện tại). */
    public List<DoanhThuGio> doanhThuTheoGio(LocalDateTime tu, LocalDateTime den, Integer khoId) {
        String sql = cteDon("3, 5") + SQL_DOANH_THU_THEO_GIO;
        return jdbc.query(sql, thamSo(khoId, tu).addValue("tu", moc(tu)).addValue("den", moc(den)),
                (rs, i) -> new DoanhThuGio(rs.getInt("gio"), bd(rs, "doanh_thu")));
    }

    static final String SQL_HOM_NAY = """
            SELECT
              (SELECT COALESCE(SUM(tong_cong), 0) FROM don WHERE ngay_gn >= :homNay AND ngay_gn <= :bayGio)   AS doanh_thu,
              (SELECT COUNT(*) FROM don WHERE ngay_gn >= :homNay AND ngay_gn <= :bayGio)                       AS so_don_giao,
              (SELECT COALESCE(SUM(tong_cong), 0) FROM don WHERE ngay_gn >= :tuanTruoc AND ngay_gn <= :bayGioTuanTruoc)
                                                                                                                AS doanh_thu_tuan_truoc,
              (SELECT COUNT(*) FROM don_ban_hang d
                WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai NOT IN (0, 4)
                  AND d.ngay_dat_hang >= :homNay AND d.ngay_dat_hang <= :bayGio
                  AND (:khoId IS NULL OR d.kho_xuat_id = :khoId))                                            AS so_don_moi,
              (SELECT COUNT(*) FROM don_ban_hang d
                WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai NOT IN (0, 4)
                  AND d.ngay_dat_hang >= :tuanTruoc AND d.ngay_dat_hang <= :bayGioTuanTruoc
                  AND (:khoId IS NULL OR d.kho_xuat_id = :khoId))                                            AS so_don_moi_tuan_truoc
            """;

    /** Số liệu hôm nay (đến thời điểm hiện tại) và cùng giờ, cùng thứ tuần trước. */
    public HomNayDong homNay(LocalDateTime bayGio, Integer khoId) {
        LocalDateTime homNay = bayGio.toLocalDate().atStartOfDay();
        String sql = cteDon("3, 5") + SQL_HOM_NAY;
        MapSqlParameterSource p = thamSo(khoId, homNay.minusDays(7))
                .addValue("homNay", moc(homNay))
                .addValue("bayGio", moc(bayGio))
                .addValue("tuanTruoc", moc(homNay.minusDays(7)))
                .addValue("bayGioTuanTruoc", moc(bayGio.minusDays(7)));
        return jdbc.queryForObject(sql, p, (rs, i) -> new HomNayDong(
                bd(rs, "doanh_thu"), rs.getLong("so_don_giao"), bd(rs, "doanh_thu_tuan_truoc"),
                rs.getLong("so_don_moi"), rs.getLong("so_don_moi_tuan_truoc")));
    }

    static final String SQL_SO_DON_MOI_THEO_NGAY = """
            SELECT DATE_FORMAT(DATE_ADD(d.ngay_dat_hang, INTERVAL :lech MINUTE), '%Y-%m-%d') AS ngay, COUNT(*) AS so_don
            FROM don_ban_hang d
            WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai NOT IN (0, 4)
              AND d.ngay_dat_hang >= :tu AND d.ngay_dat_hang < :den
              AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
            GROUP BY 1
            ORDER BY 1
            """;

    /** Số đơn bán mới (trừ nháp và đã hủy) theo ngày đặt trong [tu, den). */
    public List<SoDonNgay> soDonMoiTheoNgay(LocalDateTime tu, LocalDateTime den, Integer khoId) {
        return jdbc.query(SQL_SO_DON_MOI_THEO_NGAY,
                thamSo(khoId).addValue("tu", moc(tu)).addValue("den", moc(den)).addValue("lech", lechPhut),
                (rs, i) -> new SoDonNgay(LocalDate.parse(rs.getString("ngay")), rs.getLong("so_don")));
    }

    static final String SQL_DOANH_THU_THEO_KHO = """
            SELECT kho_xuat_id AS kho_id,
                   SUM(CASE WHEN ngay_gn >= :tu AND ngay_gn < :den THEN tong_cong ELSE 0 END)           AS doanh_thu,
                   SUM(CASE WHEN ngay_gn >= :tu AND ngay_gn < :den THEN 1 ELSE 0 END)                   AS so_don,
                   SUM(CASE WHEN ngay_gn >= :tuTruoc AND ngay_gn < :denTruoc THEN tong_cong ELSE 0 END) AS doanh_thu_truoc
            FROM don
            WHERE kho_xuat_id IS NOT NULL
              AND ((ngay_gn >= :tu AND ngay_gn < :den) OR (ngay_gn >= :tuTruoc AND ngay_gn < :denTruoc))
            GROUP BY kho_xuat_id
            """;

    /** Doanh thu từng kho (luôn đủ mọi kho để so sánh, không lọc theo kho). */
    public List<DoanhThuKhoDong> doanhThuTheoKho(LocalDateTime tu, LocalDateTime den,
                                                 LocalDateTime tuTruoc, LocalDateTime denTruoc) {
        String sql = cteDon("3, 5") + SQL_DOANH_THU_THEO_KHO;
        MapSqlParameterSource p = thamSo(null, tu.isBefore(tuTruoc) ? tu : tuTruoc)
                .addValue("tu", moc(tu)).addValue("den", moc(den))
                .addValue("tuTruoc", moc(tuTruoc)).addValue("denTruoc", moc(denTruoc));
        return jdbc.query(sql, p, (rs, i) -> new DoanhThuKhoDong(rs.getInt("kho_id"),
                bd(rs, "doanh_thu"), rs.getLong("so_don"), bd(rs, "doanh_thu_truoc")));
    }

    static final String SQL_DOANH_THU_THEO_KENH = """
            SELECT CASE WHEN kb.ma_kenh IS NOT NULL THEN kb.ma_kenh
                        WHEN don.la_pos = 1 THEN 'POS'
                        ELSE 'TRUC_TIEP' END                                          AS ma_kenh,
                   MAX(kb.ten_kenh)                                                   AS ten_kenh,
                   SUM(CASE WHEN don.trang_thai IN (3, 5) THEN don.tong_cong ELSE 0 END) AS doanh_thu,
                   SUM(CASE WHEN don.trang_thai IN (3, 5) THEN 1 ELSE 0 END)          AS so_don,
                   SUM(CASE WHEN don.trang_thai = 6 THEN 1 ELSE 0 END)                AS so_don_hoan
            FROM don
            LEFT JOIN kenh_ban_hang kb ON kb.id = don.kenh_ban_id
            WHERE don.ngay_gn >= :tu AND don.ngay_gn < :den
            GROUP BY 1
            ORDER BY doanh_thu DESC
            """;

    /** Doanh thu, số đơn, số đơn bị hoàn trả theo kênh bán trong [tu, den). */
    public List<KenhDong> doanhThuTheoKenh(LocalDateTime tu, LocalDateTime den, Integer khoId) {
        String sql = cteDon("3, 5, 6") + SQL_DOANH_THU_THEO_KENH;
        return jdbc.query(sql, thamSo(khoId, tu).addValue("tu", moc(tu)).addValue("den", moc(den)),
                (rs, i) -> new KenhDong(rs.getString("ma_kenh"), rs.getString("ten_kenh"),
                        bd(rs, "doanh_thu"), rs.getLong("so_don"), rs.getLong("so_don_hoan")));
    }

    static final String SQL_SAN_PHAM_BAN_CHAY = """
            SELECT sp.id AS san_pham_id, sp.ma_san_pham, sp.ten_san_pham,
                   SUM(ct.so_luong_dat)                                         AS so_luong,
                   SUM(COALESCE(ct.thanh_tien, ct.so_luong_dat * ct.don_gia))   AS doanh_thu
            FROM don
            JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = don.id
            JOIN bien_the_san_pham bt     ON bt.id = ct.bien_the_san_pham_id
            JOIN san_pham_quan_ao sp      ON sp.id = bt.san_pham_id
            WHERE don.ngay_gn >= :tu AND don.ngay_gn < :den
            GROUP BY sp.id, sp.ma_san_pham, sp.ten_san_pham
            ORDER BY so_luong DESC, doanh_thu DESC, sp.id
            LIMIT :soDong
            """;

    public List<SanPhamBanChayDong> sanPhamBanChay(LocalDateTime tu, LocalDateTime den, Integer khoId, int soDong) {
        String sql = cteDon("3, 5") + SQL_SAN_PHAM_BAN_CHAY;
        MapSqlParameterSource p = thamSo(khoId, tu).addValue("tu", moc(tu)).addValue("den", moc(den))
                .addValue("soDong", soDong);
        return jdbc.query(sql, p, (rs, i) -> new SanPhamBanChayDong(rs.getInt("san_pham_id"),
                rs.getString("ma_san_pham"), rs.getString("ten_san_pham"), bd(rs, "so_luong"), bd(rs, "doanh_thu")));
    }

    static final String SQL_KHA_DUNG_THEO_SAN_PHAM = """
            SELECT bt.san_pham_id, COALESCE(SUM(tk.so_luong_kha_dung), 0) AS kha_dung
            FROM ton_kho_theo_lo tk
            JOIN lo_hang lh           ON lh.id = tk.lo_hang_id
            JOIN bien_the_san_pham bt ON bt.id = lh.bien_the_san_pham_id
            JOIN kho k                ON k.id = tk.kho_id AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
            WHERE bt.san_pham_id IN (:sanPhamIds)
              AND (:khoId IS NULL OR tk.kho_id = :khoId)
            GROUP BY bt.san_pham_id
            """;

    /** Tồn khả dụng theo sản phẩm (cộng mọi biến thể, mọi lô). */
    public Map<Integer, BigDecimal> khaDungTheoSanPham(Collection<Integer> sanPhamIds, Integer khoId) {
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        if (sanPhamIds == null || sanPhamIds.isEmpty()) return ketQua;
        jdbc.query(SQL_KHA_DUNG_THEO_SAN_PHAM, thamSo(khoId).addValue("sanPhamIds", sanPhamIds),
                rs -> { ketQua.put(rs.getInt("san_pham_id"), bd(rs, "kha_dung")); });
        return ketQua;
    }

    /* ======================================================================
     * TỒN KHO
     * ====================================================================== */

    /**
     * Gộp tồn theo cặp (kho, biến thể); mỗi cặp đã từng có lô mới được tính, nên cửa hàng
     * chưa bao giờ nhập một mã sẽ không bị báo "hết hàng" mã đó.
     * dang_ban = biến thể và sản phẩm đang kinh doanh: chỉ những cặp này được phân loại tình trạng.
     */
    static final String CTE_TON_THEO_CAP = """
            WITH cap AS (
                SELECT tk.kho_id, lh.bien_the_san_pham_id AS bien_the_id,
                       SUM(tk.so_luong_ton)                   AS ton,
                       SUM(COALESCE(tk.so_luong_da_dat, 0))   AS giu,
                       SUM(tk.so_luong_kha_dung)              AS kha_dung,
                       SUM(tk.so_luong_ton * lh.gia_von)      AS gia_tri
                FROM ton_kho_theo_lo tk
                JOIN lo_hang lh ON lh.id = tk.lo_hang_id
                JOIN kho k      ON k.id = tk.kho_id AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
                GROUP BY tk.kho_id, lh.bien_the_san_pham_id
            ),
            loai AS (
                SELECT cap.*,
                       COALESCE(NULLIF(sp.muc_ton_toi_thieu, 0), :nguongMacDinh)                 AS nguong,
                       CASE WHEN bt.trang_thai = 1 AND sp.trang_thai = 1 THEN 1 ELSE 0 END        AS dang_ban
                FROM cap
                JOIN bien_the_san_pham bt ON bt.id = cap.bien_the_id
                JOIN san_pham_quan_ao sp  ON sp.id = bt.san_pham_id
            )
            """;

    static final String SQL_TON_KHO_TONG_HOP = """
            SELECT COALESCE(SUM(ton), 0)        AS ton,
                   COALESCE(SUM(giu), 0)        AS giu,
                   COALESCE(SUM(kha_dung), 0)   AS kha_dung,
                   COALESCE(SUM(gia_tri), 0)    AS gia_tri,
                   COUNT(DISTINCT bien_the_id)  AS so_bien_the,
                   COALESCE(SUM(dang_ban), 0)   AS so_dong,
                   COALESCE(SUM(CASE WHEN dang_ban = 1 AND kha_dung <= 0 THEN 1 ELSE 0 END), 0)            AS het,
                   COALESCE(SUM(CASE WHEN dang_ban = 1 AND kha_dung > 0 AND kha_dung <= nguong THEN 1 ELSE 0 END), 0) AS thieu,
                   COALESCE(SUM(CASE WHEN dang_ban = 1 AND kha_dung > nguong
                                      AND kha_dung <= nguong * :heSoDu THEN 1 ELSE 0 END), 0)            AS binh_thuong,
                   COALESCE(SUM(CASE WHEN dang_ban = 1 AND kha_dung > nguong * :heSoDu THEN 1 ELSE 0 END), 0) AS du,
                   COALESCE(SUM(CASE WHEN dang_ban = 1 AND kha_dung > nguong * :heSoDu THEN gia_tri ELSE 0 END), 0) AS gia_tri_du
            FROM loai
            WHERE (:khoId IS NULL OR kho_id = :khoId)
            """;

    public TonKhoTongHopDong tonKhoTongHop(Integer khoId, int nguongMacDinh, int heSoDu) {
        String sql = CTE_TON_THEO_CAP + SQL_TON_KHO_TONG_HOP;
        MapSqlParameterSource p = thamSo(khoId).addValue("nguongMacDinh", nguongMacDinh).addValue("heSoDu", heSoDu);
        return jdbc.queryForObject(sql, p, (rs, i) -> new TonKhoTongHopDong(
                bd(rs, "ton"), bd(rs, "giu"), bd(rs, "kha_dung"), bd(rs, "gia_tri"),
                rs.getLong("so_bien_the"), rs.getLong("so_dong"), rs.getLong("het"), rs.getLong("thieu"),
                rs.getLong("binh_thuong"), rs.getLong("du"), bd(rs, "gia_tri_du")));
    }

    /**
     * Dòng Dư hàng (cùng phân loại với SQL_TON_KHO_TONG_HOP) mà kho đó không có đơn bán đã giao nào của mã này từ :tu.
     * Ngày bán lấy ngày giao; đơn cũ chưa ghi ngày giao thì lấy ngày đặt (đủ để biết "có bán gần đây hay không").
     */
    static final String SQL_DU_CHAM_BAN = """
            SELECT COUNT(*) AS so_dong
            FROM loai l
            WHERE l.dang_ban = 1 AND l.kha_dung > l.nguong * :heSoDu
              AND (:khoId IS NULL OR l.kho_id = :khoId)
              AND NOT EXISTS (
                  SELECT 1
                  FROM chi_tiet_don_ban_hang ct
                  JOIN don_ban_hang d ON d.id = ct.don_ban_hang_id
                  WHERE ct.bien_the_san_pham_id = l.bien_the_id
                    AND d.kho_xuat_id = l.kho_id
                    AND d.loai_chung_tu = 'don_ban_hang'
                    AND d.trang_thai IN (3, 5)
                    AND COALESCE(d.ngay_giao_hang, d.ngay_dat_hang) >= :tu)
            """;

    /** Số dòng Dư hàng chưa bán được kể từ :tu (giờ Việt Nam). */
    public long demDuChamBan(Integer khoId, int nguongMacDinh, int heSoDu, LocalDateTime tu) {
        String sql = CTE_TON_THEO_CAP + SQL_DU_CHAM_BAN;
        MapSqlParameterSource p = thamSo(khoId).addValue("nguongMacDinh", nguongMacDinh).addValue("heSoDu", heSoDu)
                .addValue("tu", moc(tu));
        Long n = jdbc.queryForObject(sql, p, Long.class);
        return n == null ? 0 : n;
    }

    static final String SQL_TON_KHO_THEO_KHO = """
            SELECT tk.kho_id,
                   COALESCE(SUM(tk.so_luong_ton), 0)               AS ton,
                   COALESCE(SUM(tk.so_luong_kha_dung), 0)          AS kha_dung,
                   COALESCE(SUM(tk.so_luong_ton * lh.gia_von), 0)  AS gia_tri
            FROM ton_kho_theo_lo tk
            JOIN lo_hang lh ON lh.id = tk.lo_hang_id
            JOIN kho k      ON k.id = tk.kho_id AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
            GROUP BY tk.kho_id
            """;

    /** Tồn và giá trị tồn của từng kho (không lọc, để so sánh các kho). */
    public List<TonKhoTheoKhoDong> tonKhoTheoKho() {
        return jdbc.query(SQL_TON_KHO_THEO_KHO, new MapSqlParameterSource(), (rs, i) -> new TonKhoTheoKhoDong(
                rs.getInt("kho_id"), bd(rs, "ton"), bd(rs, "kha_dung"), bd(rs, "gia_tri")));
    }

    static final String SQL_DANG_VE = """
            SELECT COALESCE(SUM(ct.so_luong_dat - COALESCE(ct.so_luong_da_nhan, 0)), 0) AS dang_ve
            FROM chi_tiet_don_mua_hang ct
            JOIN don_mua_hang dm ON dm.id = ct.don_mua_hang_id
            WHERE dm.trang_thai IN (3, 5)
              AND ct.so_luong_dat > COALESCE(ct.so_luong_da_nhan, 0)
              AND (:khoId IS NULL OR dm.kho_nhap_id = :khoId)
            """;

    /** Hàng đang về từ nhà cung cấp: phần chưa nhận của đơn mua đã chốt (cùng cách tính với Báo cáo tồn kho). */
    public BigDecimal hangDangVe(Integer khoId) {
        BigDecimal v = jdbc.queryForObject(SQL_DANG_VE, thamSo(khoId), BigDecimal.class);
        return v == null ? BigDecimal.ZERO : v;
    }

    static final String SQL_DANG_CHUYEN = """
            SELECT COALESCE(SUM(ct.so_luong_xuat), 0) AS dang_chuyen
            FROM phieu_xuat_kho px
            JOIN phieu_xuat_kho pck         ON pck.id = px.parent_id
            JOIN chi_tiet_phieu_xuat_kho ct ON ct.phieu_xuat_kho_id = px.id AND ct.lo_hang_id IS NOT NULL
            WHERE px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 3 AND pck.trang_thai = 3
              AND (:khoId IS NULL OR pck.kho_id = :khoId OR pck.kho_chuyen_den_id = :khoId)
            """;

    /** Hàng đang đi đường giữa các kho: phiếu chuyển đã xuất nhưng kho nhận chưa nhập. */
    public BigDecimal hangDangChuyen(Integer khoId) {
        BigDecimal v = jdbc.queryForObject(SQL_DANG_CHUYEN, thamSo(khoId), BigDecimal.class);
        return v == null ? BigDecimal.ZERO : v;
    }

    static final String SQL_HANG_CAN_BO_SUNG = """
            SELECT l.bien_the_id, bt.ma_sku, sp.ten_san_pham, ms.ten_mau, sz.ten_size,
                   l.kho_id, l.kha_dung, l.nguong
            FROM loai l
            JOIN bien_the_san_pham bt ON bt.id = l.bien_the_id
            JOIN san_pham_quan_ao sp  ON sp.id = bt.san_pham_id
            LEFT JOIN mau_sac ms      ON ms.id = bt.mau_sac_id
            LEFT JOIN size sz         ON sz.id = bt.size_id
            WHERE l.dang_ban = 1 AND l.kha_dung <= l.nguong
              AND (:khoId IS NULL OR l.kho_id = :khoId)
            ORDER BY l.kha_dung / l.nguong, l.kha_dung, l.kho_id, l.bien_the_id
            LIMIT :soDong
            """;

    /**
     * Các cặp (kho, biến thể) đang Hết hàng hoặc Thiếu hàng, tệ nhất trước. Số Kho tổng có thể chuyển không tính ở đây
     * mà ở KhaDungChuyenKhoService, cùng phép kiểm khi tạo yêu cầu chuyển kho.
     */
    public List<HangCanBoSungDong> hangCanBoSung(Integer khoId, int nguongMacDinh, int soDong) {
        String sql = CTE_TON_THEO_CAP + SQL_HANG_CAN_BO_SUNG;
        MapSqlParameterSource p = thamSo(khoId).addValue("nguongMacDinh", nguongMacDinh).addValue("soDong", soDong);
        return jdbc.query(sql, p, (rs, i) -> new HangCanBoSungDong(rs.getInt("bien_the_id"), rs.getString("ma_sku"),
                rs.getString("ten_san_pham"), rs.getString("ten_mau"), rs.getString("ten_size"), rs.getInt("kho_id"),
                bd(rs, "kha_dung"), rs.getInt("nguong")));
    }

    /* ======================================================================
     * NHẬP – XUẤT
     * ====================================================================== */

    /**
     * Phân loại theo loai_giao_dich (phiếu xuất ghi số lượng dương nên không dựa vào dấu).
     * Khi xem tất cả kho, bỏ hai chặng của chuyển kho nội bộ (phiếu xuất loại chuyen_kho và
     * phiếu nhập có phieu_chuyen_id) vì đó không phải nhập hay xuất thật của công ty.
     */
    static final String SQL_NHAP_XUAT_THEO_NGAY = """
            SELECT DATE_FORMAT(DATE_ADD(lg.ngay_giao_dich, INTERVAL :lechCsdl MINUTE), '%Y-%m-%d') AS ngay,
                   COALESCE(SUM(CASE WHEN lg.loai_giao_dich = 'nhap_kho' THEN ABS(lg.so_luong) ELSE 0 END), 0) AS nhap,
                   COALESCE(SUM(CASE WHEN lg.loai_giao_dich = 'xuat_kho' THEN ABS(lg.so_luong) ELSE 0 END), 0) AS xuat
            FROM lich_su_giao_dich_kho lg
            JOIN kho k ON k.id = lg.kho_id AND k.ma_kho <> 'KHO_TRANSIT'
            LEFT JOIN phieu_xuat_kho px ON lg.loai_tham_chieu = 'phieu_xuat_kho' AND px.id = lg.id_tham_chieu
            LEFT JOIN phieu_nhap_kho pn ON lg.loai_tham_chieu = 'phieu_nhap_kho' AND pn.id = lg.id_tham_chieu
            WHERE lg.loai_giao_dich IN ('nhap_kho', 'xuat_kho')
              AND lg.ngay_giao_dich >= :tu AND lg.ngay_giao_dich < :den
              AND (:khoId IS NULL OR lg.kho_id = :khoId)
              AND (:khoId IS NOT NULL OR (COALESCE(px.loai_xuat, '') <> 'chuyen_kho' AND pn.phieu_chuyen_id IS NULL))
            GROUP BY 1
            ORDER BY 1
            """;

    public List<NhapXuatNgay> nhapXuatTheoNgay(LocalDateTime tu, LocalDateTime den, Integer khoId) {
        return jdbc.query(SQL_NHAP_XUAT_THEO_NGAY, thamSo(khoId).addValue("tu", mocCsdl(tu)).addValue("den", mocCsdl(den))
                        .addValue("lechCsdl", lechPhutCsdl),
                (rs, i) -> new NhapXuatNgay(LocalDate.parse(rs.getString("ngay")), bd(rs, "nhap"), bd(rs, "xuat")));
    }

    /* ======================================================================
     * VIỆC CẦN XỬ LÝ
     * ====================================================================== */

    static final String SQL_VIEC_CAN_XU_LY = """
            SELECT
              (SELECT COUNT(*) FROM don_ban_hang d
                WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 0
                  AND (:khoId IS NULL OR d.kho_xuat_id = :khoId))                          AS don_nhap,
              (SELECT COUNT(*) FROM don_ban_hang d
                WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 1
                  AND d.danh_sach_nhat_hang_id IS NULL
                  AND (:khoId IS NULL OR d.kho_xuat_id = :khoId))                          AS don_cho_xuat,
              (SELECT COUNT(*) FROM danh_sach_nhat_hang n
                WHERE n.trang_thai IN ('cho_nhat', 'dang_nhat') AND n.nguoi_nhat_id IS NULL
                  AND (:khoId IS NULL OR n.kho_xuat_id = :khoId))                          AS nhat_chua_giao,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE p.loai_xuat = 'ban_hang' AND p.trang_thai IN (0, 6)
                  AND (:khoId IS NULL OR p.kho_id = :khoId))                               AS px_cho_xuat,
              (SELECT COUNT(*) FROM yeu_cau_mua_hang y
                WHERE y.trang_thai = 1 AND (:khoId IS NULL OR y.kho_nhap_id = :khoId))     AS yc_cho_duyet,
              (SELECT COUNT(*) FROM phieu_nhap_kho p
                WHERE p.trang_thai = 0 AND (:khoId IS NULL OR p.kho_id = :khoId))          AS pn_cho_nhap,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE p.loai_xuat = 'khac' AND p.kho_chuyen_den_id IS NOT NULL AND p.trang_thai = 1
                  AND (:khoId IS NULL OR p.kho_id = :khoId))                               AS pck_cho_duyet,
              (SELECT COUNT(*) FROM phieu_xuat_kho p
                WHERE p.loai_xuat = 'khac' AND p.kho_chuyen_den_id IS NOT NULL AND p.trang_thai = 2
                  AND (:khoId IS NULL OR p.kho_id = :khoId))                               AS pck_cho_xuat,
              (SELECT COUNT(*) FROM dot_kiem_ke dk
                WHERE dk.trang_thai = 0 AND (:khoId IS NULL OR dk.kho_id = :khoId))        AS kiem_ke_mo,
              (SELECT COUNT(*) FROM nguoi_dung u WHERE u.trang_thai = 0)                   AS tk_khoa,
              (SELECT COUNT(*) FROM don_mua_hang dm
                WHERE dm.trang_thai = 3
                  AND dm.ngay_giao_du_kien IS NOT NULL AND dm.ngay_giao_du_kien < :homNay
                  AND (:khoId IS NULL OR dm.kho_nhap_id = :khoId)
                  AND EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct
                               WHERE ct.don_mua_hang_id = dm.id
                                 AND ct.so_luong_dat > COALESCE(ct.so_luong_da_nhan, 0)))     AS dm_qua_han
            """;

    /**
     * Đếm các việc đang chờ. Đơn mua quá hạn: đang vận chuyển (3), ngày giao dự kiến trước :homNay (0 giờ hôm nay,
     * giờ Việt Nam) và còn dòng chưa nhận đủ, cùng cách tính phần "đang về" với SQL_DANG_VE.
     */
    public ViecCanXuLyDong viecCanXuLy(Integer khoId, LocalDateTime homNay) {
        return jdbc.queryForObject(SQL_VIEC_CAN_XU_LY, thamSo(khoId).addValue("homNay", moc(homNay)),
                (rs, i) -> new ViecCanXuLyDong(
                        rs.getLong("don_nhap"), rs.getLong("don_cho_xuat"), rs.getLong("nhat_chua_giao"),
                        rs.getLong("px_cho_xuat"), rs.getLong("yc_cho_duyet"), rs.getLong("pn_cho_nhap"),
                        rs.getLong("pck_cho_duyet"), rs.getLong("pck_cho_xuat"), rs.getLong("kiem_ke_mo"),
                        rs.getLong("tk_khoa"), rs.getLong("dm_qua_han")));
    }

    /** Như trên, "hôm nay" lấy theo thời điểm hiện tại. */
    public ViecCanXuLyDong viecCanXuLy(Integer khoId) {
        return viecCanXuLy(khoId, thoiDiemHienTai().toLocalDate().atStartOfDay());
    }

    static final String SQL_LOI_DONG_BO = """
            SELECT kb.id AS kenh_id, kb.ma_kenh, kb.ten_kenh, COUNT(*) AS so_loi
            FROM trang_thai_dong_bo_san_pham t
            JOIN kenh_ban_hang kb ON kb.id = t.kenh_ban_id AND kb.trang_thai = 1
            WHERE t.trang_thai_dong_bo = 'that_bai'
            GROUP BY kb.id, kb.ma_kenh, kb.ten_kenh
            ORDER BY so_loi DESC, kb.id
            """;

    /**
     * Sản phẩm đồng bộ lỗi của từng kênh đang hoạt động, đếm như ô "Lỗi" ở trang Sản phẩm của kênh
     * (KenhBanHangDongBoServiceImpl.getTongQuan). Máy chưa có bảng đồng bộ thì trả danh sách rỗng.
     */
    public List<LoiDongBoDong> loiDongBoTheoKenh() {
        if (!coBang("trang_thai_dong_bo_san_pham") || !coBang("kenh_ban_hang")) return List.of();
        return jdbc.query(SQL_LOI_DONG_BO, new MapSqlParameterSource(), (rs, i) -> new LoiDongBoDong(
                rs.getInt("kenh_id"), rs.getString("ma_kenh"), rs.getString("ten_kenh"), rs.getLong("so_loi")));
    }

    /**
     * Bốn việc mà trang danh sách chỉ xem kho làm việc (Đơn chờ xuất, Phiếu nhặt hàng, Chuyển kho nội bộ),
     * đếm riêng từng kho: Tổng quan "Tất cả kho" tách dòng theo kho để bấm vào mở đúng kho và số khớp
     * số dòng. Cùng điều kiện với SQL_VIEC_CAN_XU_LY; chuyển kho tính theo kho đi. Chỉ trả kho có việc.
     */
    static final String SQL_VIEC_THEO_KHO = """
            SELECT x.kho_id, x.ten_kho, x.don_cho_xuat, x.nhat_chua_giao, x.pck_cho_duyet, x.pck_cho_xuat
            FROM (
              SELECT k.id AS kho_id, k.ten_kho,
                (SELECT COUNT(*) FROM don_ban_hang d
                  WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 1
                    AND d.danh_sach_nhat_hang_id IS NULL AND d.kho_xuat_id = k.id)            AS don_cho_xuat,
                (SELECT COUNT(*) FROM danh_sach_nhat_hang n
                  WHERE n.trang_thai IN ('cho_nhat', 'dang_nhat') AND n.nguoi_nhat_id IS NULL
                    AND n.kho_xuat_id = k.id)                                                   AS nhat_chua_giao,
                (SELECT COUNT(*) FROM phieu_xuat_kho p
                  WHERE p.loai_xuat = 'khac' AND p.kho_chuyen_den_id IS NOT NULL AND p.trang_thai = 1
                    AND p.kho_id = k.id)                                                        AS pck_cho_duyet,
                (SELECT COUNT(*) FROM phieu_xuat_kho p
                  WHERE p.loai_xuat = 'khac' AND p.kho_chuyen_den_id IS NOT NULL AND p.trang_thai = 2
                    AND p.kho_id = k.id)                                                        AS pck_cho_xuat
              FROM kho k
            ) x
            WHERE x.don_cho_xuat + x.nhat_chua_giao + x.pck_cho_duyet + x.pck_cho_xuat > 0
            ORDER BY x.kho_id
            """;

    public List<ViecTheoKhoDong> viecTheoKho() {
        return jdbc.query(SQL_VIEC_THEO_KHO, new MapSqlParameterSource(), (rs, i) -> new ViecTheoKhoDong(
                rs.getInt("kho_id"), rs.getString("ten_kho"), rs.getLong("don_cho_xuat"),
                rs.getLong("nhat_chua_giao"), rs.getLong("pck_cho_duyet"), rs.getLong("pck_cho_xuat")));
    }

    /* ======================================================================
     * HOẠT ĐỘNG GẦN ĐÂY
     * ====================================================================== */

    /**
     * Mỗi nhánh lấy :soDong chứng từ mới nhất (dùng chỉ mục thời gian), gộp lại rồi lấy :soDong dòng;
     * số lượng chỉ tính cho các dòng cuối cùng.
     */
    static final String SQL_HOAT_DONG = """
            SELECT x.loai, x.id, x.ma,
                   DATE_FORMAT(x.thoi_gian_goc, '%%Y-%%m-%%d %%H:%%i:%%s') AS thoi_gian,
                   x.ten_kho, x.nguoi,
                   CASE
                     WHEN x.loai IN ('nhap_kho', 'nhap_chuyen_kho') THEN
                       (SELECT COALESCE(SUM(ct.so_luong_nhap), 0) FROM chi_tiet_phieu_nhap_kho ct
                         WHERE ct.phieu_nhap_kho_id = x.id)
                     WHEN x.loai IN ('xuat_kho', 'xuat_chuyen_kho') THEN
                       (SELECT COALESCE(SUM(ct.so_luong_xuat), 0) FROM chi_tiet_phieu_xuat_kho ct
                         WHERE ct.phieu_xuat_kho_id = x.id AND ct.lo_hang_id IS NOT NULL)
                     WHEN x.loai IN ('don_ban', 'ban_tai_quay') THEN
                       (SELECT COALESCE(SUM(ct.so_luong_dat), 0) FROM chi_tiet_don_ban_hang ct
                         WHERE ct.don_ban_hang_id = x.id)
                   END AS so_luong,
                   x.doi_tac, x.so_tien
            FROM (
              (SELECT CASE WHEN p.phieu_chuyen_id IS NOT NULL THEN 'nhap_chuyen_kho' ELSE 'nhap_kho' END AS loai,
                      p.id, p.so_phieu_nhap AS ma, p.ngay_nhap AS thoi_gian_goc, k.ten_kho, u.ho_ten AS nguoi,
                      COALESCE(ncc.ten_nha_cung_cap, kn.ten_kho) AS doi_tac, NULL AS so_tien
               FROM phieu_nhap_kho p
               JOIN kho k                   ON k.id = p.kho_id
               LEFT JOIN nguoi_dung u       ON u.id = p.nguoi_nhap_id
               LEFT JOIN nha_cung_cap ncc   ON ncc.id = p.nha_cung_cap_id
               LEFT JOIN phieu_xuat_kho pck ON pck.id = p.phieu_chuyen_id
               LEFT JOIN kho kn             ON kn.id = pck.kho_id
               WHERE p.trang_thai = 3 AND p.ngay_nhap IS NOT NULL AND (:khoId IS NULL OR p.kho_id = :khoId)
               ORDER BY p.ngay_nhap DESC, p.id DESC LIMIT :soDong)
              UNION ALL
              (SELECT CASE WHEN p.loai_xuat = 'chuyen_kho' THEN 'xuat_chuyen_kho' ELSE 'xuat_kho' END,
                      p.id, p.so_phieu_xuat, p.ngay_xuat, k.ten_kho, u.ho_ten,
                      COALESCE(d.so_don_hang, kd.ten_kho), NULL
               FROM phieu_xuat_kho p
               JOIN kho k               ON k.id = p.kho_id
               LEFT JOIN nguoi_dung u   ON u.id = p.nguoi_xuat_id
               LEFT JOIN don_ban_hang d ON d.id = p.don_ban_hang_id
               LEFT JOIN kho kd         ON kd.id = p.kho_chuyen_den_id
               WHERE p.trang_thai = 3 AND p.loai_xuat IN ('ban_hang', 'chuyen_kho') AND p.ngay_xuat IS NOT NULL
                 AND NOT (%1$s)
                 AND (:khoId IS NULL OR p.kho_id = :khoId)
               ORDER BY p.ngay_xuat DESC, p.id DESC LIMIT :soDong)
              UNION ALL
              (SELECT CASE WHEN %2$s THEN 'ban_tai_quay' ELSE 'don_ban' END,
                      d.id, d.so_don_hang, d.ngay_dat_hang, k.ten_kho, u.ho_ten, kb.ten_kenh, d.tong_cong
               FROM don_ban_hang d
               LEFT JOIN kho k            ON k.id = d.kho_xuat_id
               LEFT JOIN nguoi_dung u     ON u.id = d.nguoi_tao_id
               LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
               WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai NOT IN (0, 4)
                 AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
               ORDER BY d.ngay_dat_hang DESC, d.id DESC LIMIT :soDong)
              UNION ALL
              (SELECT 'kiem_ke', dk.id, dk.ma_dot_kiem_ke, dk.ngay_hoan_thanh, k.ten_kho, u.ho_ten,
                      dk.ten_dot_kiem_ke, NULL
               FROM dot_kiem_ke dk
               JOIN kho k             ON k.id = dk.kho_id
               LEFT JOIN nguoi_dung u ON u.id = dk.nguoi_chu_tri_id
               WHERE dk.trang_thai = 1 AND dk.ngay_hoan_thanh IS NOT NULL
                 AND (:khoId IS NULL OR dk.kho_id = :khoId)
               ORDER BY dk.ngay_hoan_thanh DESC, dk.id DESC LIMIT :soDong)
            ) x
            ORDER BY x.thoi_gian_goc DESC, x.id DESC
            LIMIT :soDong
            """;

    /** Chứng từ vừa hoàn tất: phiếu nhập, phiếu xuất (trừ phiếu tự sinh khi bán tại quầy), đơn bán, kiểm kê. */
    public List<HoatDongDong> hoatDongGanDay(Integer khoId, int soDong) {
        String sql = SQL_HOAT_DONG.formatted(bieuThucLaDonPos("p.don_ban_hang_id"), bieuThucLaDonPos("d.id"));
        MapSqlParameterSource p = thamSo(khoId).addValue("soDong", soDong);
        return jdbc.query(sql, p, (rs, i) -> new HoatDongDong(rs.getString("loai"), rs.getInt("id"),
                rs.getString("ma"), LocalDateTime.parse(rs.getString("thoi_gian"), DINH_DANG_GIO).plusMinutes(lechPhut),
                rs.getString("ten_kho"), rs.getString("nguoi"), rs.getBigDecimal("so_luong"),
                rs.getString("doi_tac"), rs.getBigDecimal("so_tien")));
    }

    /* ======================================================================
     * CHỈ SỐ CHO API /admin/dashboard CŨ (giữ tên trường, sửa cách đếm)
     * ====================================================================== */

    static final String SQL_DON_MOI_TRONG_NGAY = """
            SELECT COUNT(*) FROM don_ban_hang d
            WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai NOT IN (0, 4)
              AND d.ngay_dat_hang >= :tu AND d.ngay_dat_hang < :den
            """;

    /** Số đơn bán đặt trong ngày, trừ đơn nháp và đơn đã hủy. */
    public long demDonMoiTrongNgay(LocalDate ngay) {
        Long n = jdbc.queryForObject(SQL_DON_MOI_TRONG_NGAY, new MapSqlParameterSource()
                .addValue("tu", moc(ngay.atStartOfDay()))
                .addValue("den", moc(ngay.plusDays(1).atStartOfDay())), Long.class);
        return n == null ? 0 : n;
    }

    /** Yêu cầu nhập hàng đang chờ duyệt (trạng thái 1). */
    public long demYeuCauNhapChoDuyet() {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM yeu_cau_mua_hang WHERE trang_thai = 1",
                new MapSqlParameterSource(), Long.class);
        return n == null ? 0 : n;
    }

    /* ======================================================================
     * TIỆN ÍCH
     * ====================================================================== */

    private String cteDon(String trangThai) {
        return CTE_DON_GHI_NHAN.formatted(bieuThucLaDonPos("d.id"), trangThai);
    }

    /** Biểu thức SQL trả 1 nếu đơn được tạo từ quầy POS (bảng pos_checkout_request có thể chưa có). */
    private String bieuThucLaDonPos(String cotDonId) {
        if (!coBang("pos_checkout_request")) return "0";
        return "(CASE WHEN EXISTS (SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = "
                + cotDonId + ") THEN 1 ELSE 0 END)";
    }

    /** Biểu thức SQL trả 1 nếu kho là Kho tổng (cột kho.loai_kho có thể chưa có). */
    private String bieuThucLaKhoTong(String bang) {
        if (!coCot("kho", "loai_kho")) return "0";
        return "(CASE WHEN " + bang + ".loai_kho = 'kho_tong' THEN 1 ELSE 0 END)";
    }

    private static MapSqlParameterSource thamSo(Integer khoId) {
        return new MapSqlParameterSource().addValue("khoId", khoId, Types.INTEGER);
    }

    /** Tham số cho truy vấn dùng CTE đơn ghi nhận: kho, mốc lọc sớm theo ngày giao và độ lệch giờ. */
    private MapSqlParameterSource thamSo(Integer khoId, LocalDateTime tuLoc) {
        return thamSo(khoId).addValue("tuLoc", moc(tuLoc)).addValue("lech", lechPhut);
    }

    /** Mốc giờ Việt Nam → chuỗi giờ của cột do ứng dụng ghi. */
    private String moc(LocalDateTime gioViet) {
        if (!daDoLech) thoiDiemHienTai();
        return chuoi(gioViet.minusMinutes(lechPhut));
    }

    /** Mốc giờ Việt Nam → chuỗi giờ của cột do MySQL tự điền. */
    private String mocCsdl(LocalDateTime gioViet) {
        if (!daDoLech) thoiDiemHienTai();
        return chuoi(gioViet.minusMinutes(lechPhutCsdl));
    }

    private static String chuoi(LocalDateTime t) {
        return t.format(DINH_DANG_GIO);
    }

    private static BigDecimal bd(ResultSet rs, String cot) throws SQLException {
        BigDecimal v = rs.getBigDecimal(cot);
        return v == null ? BigDecimal.ZERO : v;
    }
}
