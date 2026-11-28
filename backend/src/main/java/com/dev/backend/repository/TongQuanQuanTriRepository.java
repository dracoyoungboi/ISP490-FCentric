package com.dev.backend.repository;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.utils.PublicAssetUrl;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Truy vấn của màn Tổng quan quản trị (làm lại 28/11/2026, đặc tả bản 2). Các truy vấn dùng chung với Tổng quan theo vai
 * trò vẫn ở {@link TongQuanAdminRepository}; lớp này mượn của nó cách đổi giờ (độ lệch giữa giờ Việt Nam và giờ CSDL).
 *
 * <p>Quy ước:
 * <ul>
 *   <li>Mốc vào là GIỜ VIỆT NAM. Bảng sự kiện doanh thu đổi mọi cột thời gian sang giờ Việt Nam (cột {@code tg}) rồi mới
 *       so, vì có cột do ứng dụng ghi (ngày giao, ngày lập phiếu trả, ngày nhập) lẫn cột MySQL tự điền (ngày cập nhật đơn).
 *       Mốc truyền cho {@code tg} là chuỗi giờ Việt Nam; mốc truyền cho cột gốc (lọc sớm) đổi qua {@code mocUngDung}.</li>
 *   <li>Doanh thu = tiền hàng của đơn không gồm phí vận chuyển và thuế GTGT: tong_cong − phi_van_chuyen − tien_thue_gtgt.
 *       Đơn sàn không lưu thuế GTGT nên giữ nguyên tiền hàng.</li>
 *   <li>Ghi nhận lúc XUẤT ĐỦ HÀNG: đơn trạng thái 3, 5, 6 theo ngày giao (POS: lúc bán); chưa có ngày giao thì lấy ngày phiếu
 *       xuất hoàn tất cuối. Đơn bị hoàn (6) vẫn là doanh thu ở ngày xuất; phần hoàn trừ ở ngày hoàn.</li>
 *   <li>Đơn sàn hoàn: ngày hoàn = ngày nhập phiếu PN-RET đã hoàn tất của phiếu xuất của đơn; chưa có phiếu thì lấy ngày cập
 *       nhật đơn. Trừ cả đơn, cộng lại toàn bộ giá vốn (hàng hoàn sàn không ghi lỗi).</li>
 *   <li>Khách trả tại quầy: trừ ở ngày lập phiếu trả, ở kho bán; tiền trả bỏ phần GTGT theo tỷ lệ của đơn gốc; giá vốn cộng lại
 *       chỉ phần hàng còn bán được (dòng tinh_trang = 'dat').</li>
 *   <li>Kho ảo KHO_TRANSIT không là kho bán; hàng nằm ở đó là hàng đang chuyển.</li>
 * </ul>
 */
@Repository
public class TongQuanQuanTriRepository {

    private static final DateTimeFormatter DINH_DANG_GIO = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public static final String DINH_DANG_GIO_SQL = "%Y-%m-%d %H";
    public static final String DINH_DANG_NGAY_SQL = "%Y-%m-%d";
    public static final String DINH_DANG_THANG_SQL = "%Y-%m";

    static final String CO_YEU_CAU_HUY = "[KHÁCH YÊU CẦU HỦY]";
    static final String CO_SHOPEE_CHO_XAC_NHAN = "[SHOPEE_CHO_XAC_NHAN]";

    private final NamedParameterJdbcTemplate jdbc;
    private final TongQuanAdminRepository goc;

    public TongQuanQuanTriRepository(NamedParameterJdbcTemplate jdbc, TongQuanAdminRepository goc) {
        this.jdbc = jdbc;
        this.goc = goc;
    }

    /* ======================================================================
     * BẢN GHI TRẢ VỀ
     * ====================================================================== */

    /** Tổng của một nhóm (kho, kênh, người lập) trong một khoảng. Tiền hàng trả dương; giá vốn hàng trả dương. */
    public record TongNhom(Integer khoId, String maKenh, String tenKenh, Integer nguoiId, String hoTen, boolean laPos,
                           BigDecimal doanhThu, BigDecimal tienHangXuat, BigDecimal tienHangTra, BigDecimal thueGtgt,
                           BigDecimal giaVonXuat, BigDecimal giaVonTraTot, BigDecimal giaVonTraLoi,
                           long donXuat, long donTra, long donBiHoan) {}

    /** Một điểm biểu đồ: mốc dạng chuỗi theo DINH_DANG_*_SQL (giờ Việt Nam). */
    public record DiemChuoi(String moc, BigDecimal doanhThu, BigDecimal giaVonXuat, BigDecimal giaVonTraTot,
                            long donXuat, long donTra) {}

    public record SanPhamDong(Integer sanPhamId, String maSanPham, String tenSanPham, BigDecimal soLuong, BigDecimal doanhThu) {}

    public record NhomHangDong(Integer danhMucId, String tenDanhMuc, BigDecimal doanhThu, BigDecimal doanhThuTruoc) {}

    public record ChoXuatDong(long soDon, BigDecimal tien) {}

    public record KhoMoDong(Integer khoId, LocalDateTime ngayTao) {}

    public record TonTongDong(BigDecimal ton, BigDecimal daDat, BigDecimal giuDon, BigDecimal giuChuyen, BigDecimal coTheBan,
                              BigDecimal giaTri, long soBienThe, long soDong, long het, long sap, long binhThuong, long du,
                              BigDecimal giaTriDu, long duChamBan) {}

    public record TonTheoKhoDong(Integer khoId, BigDecimal giaTri, BigDecimal coTheBan, long het, long sap) {}

    public record BoSungDong(Integer bienTheId, Integer sanPhamId, String maSku, String tenSanPham, String tenMau,
                             String tenKichCo, BigDecimal coTheBan, int nguong, BigDecimal khoTongCon, BigDecimal dangVe,
                             long tong) {}

    public record DangChuyenDong(BigDecimal di, BigDecimal den) {}

    /**
     * Một loại việc: tổng số và chứng từ mẫu (cũ nhất / gấp nhất) để ghi dòng phụ. moc là giờ Việt Nam (đã đổi).
     * soPhu, soPhu2: số kèm theo tùy loại (số cái, số kệ khóa…). thamChieuId: id để mở đúng trang xử lý (traNcc: nhà
     * cung cấp của biên bản chờ lâu nhất), loại khác null.
     */
    public record ViecDong(String loai, long so, String ma, String ten, String kho, String kho2, LocalDateTime moc,
                           long soPhu, long soPhu2, Integer khoId, Integer thamChieuId) {}

    /** Một sự kiện của Hoạt động gần đây (giờ Việt Nam). */
    public record SuKienDong(String loai, Integer id, String ma, LocalDateTime thoiGian, Integer khoId, String tenKho,
                             Integer khoId2, String tenKho2, String nguoi, String maKenh, String tenKenh,
                             BigDecimal soTien, BigDecimal soLuong, Long soMa, boolean coYeuCauHuy, boolean coHangLoi,
                             BigDecimal soNhan, String trangThai) {}

    /* ======================================================================
     * BẢNG SỰ KIỆN DOANH THU
     * ====================================================================== */

    /** 1 nếu đơn (cột {COT}) tạo từ quầy POS. */
    private String laPos(String cotDonId) {
        if (!goc.coBang("pos_checkout_request")) return "0";
        return "(CASE WHEN EXISTS (SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = " + cotDonId
                + ") THEN 1 ELSE 0 END)";
    }

    private boolean coTraQuay() {
        return goc.coBang("phieu_tra_hang") && goc.coBang("chi_tiet_phieu_tra_hang_lo");
    }

    private boolean coCotTraHet() {
        return goc.coCot("don_ban_hang", "trang_thai_tra_hang");
    }

    /** Giá vốn theo lô của các phiếu xuất hoàn tất của đơn (cột {COT}). */
    private static String giaVonDon(String cotDonId) {
        return "(SELECT COALESCE(SUM(ct.so_luong_xuat * ct.gia_von), 0) FROM phieu_xuat_kho p "
                + "JOIN chi_tiet_phieu_xuat_kho ct ON ct.phieu_xuat_kho_id = p.id AND ct.lo_hang_id IS NOT NULL "
                + "WHERE p.don_ban_hang_id = " + cotDonId + " AND p.trang_thai = 3)";
    }

    /**
     * Các CTE (không gồm chữ WITH): don (đơn đã ghi nhận, lọc sớm theo :tuLoc / :denLoc), hoan (đơn sàn bị hoàn kèm ngày
     * hoàn), su_kien (bán, hoàn, trả tại quầy; tg giờ Việt Nam).
     */
    String cteSuKien() {
        String traHet = coCotTraHet() ? " OR don.trang_thai_tra_hang = 'da_tra_het'" : "";
        String cotTraHet = coCotTraHet() ? "d.trang_thai_tra_hang" : "NULL";
        StringBuilder sb = new StringBuilder();
        sb.append("""
                don AS (
                    SELECT d.id, d.kho_xuat_id, d.kenh_ban_id, d.trang_thai, d.nguoi_tao_id, {TRA_HET} AS trang_thai_tra_hang,
                           COALESCE(d.ngay_giao_hang,
                                    (SELECT MAX(p.ngay_xuat) FROM phieu_xuat_kho p
                                      WHERE p.don_ban_hang_id = d.id AND p.trang_thai = 3))      AS ngay_gn,
                           d.tong_cong - COALESCE(d.phi_van_chuyen, 0)                            AS gross,
                           COALESCE(d.tien_thue_gtgt, 0)                                          AS vat,
                           {LA_POS_D}                                                             AS la_pos
                    FROM don_ban_hang d
                    WHERE d.loai_chung_tu = 'don_ban_hang'
                      AND d.trang_thai IN (3, 5, 6)
                      AND (d.ngay_giao_hang IS NULL OR (d.ngay_giao_hang >= :tuLoc AND d.ngay_giao_hang < :denLoc))
                      AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
                ),
                hoan AS (
                    SELECT d.id, d.kho_xuat_id, d.kenh_ban_id, d.nguoi_tao_id,
                           d.tong_cong - COALESCE(d.phi_van_chuyen, 0) AS gross,
                           COALESCE(d.tien_thue_gtgt, 0)               AS vat,
                           {GIA_VON_D}                                 AS von,
                           COALESCE(
                             (SELECT DATE_ADD(MAX(pn.ngay_nhap), INTERVAL :lech MINUTE)
                                FROM phieu_xuat_kho px
                                JOIN phieu_nhap_kho pn ON pn.so_phieu_nhap LIKE 'PN-RET%' AND pn.trang_thai = 3
                                                      AND pn.phieu_chuyen_kho_id IS NULL
                                                      AND {KHOP_PN_RET}
                               WHERE px.don_ban_hang_id = d.id AND px.trang_thai = 3),
                             DATE_ADD(d.ngay_cap_nhat, INTERVAL :lechCsdl MINUTE))   AS tg
                    FROM don_ban_hang d
                    WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 6
                      AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
                      -- chỉ đơn đã ghi nhận bán (như CTE don): sàn đổi sang 6 cả khi đơn còn chờ đóng gói, chưa xuất
                      AND (d.ngay_giao_hang IS NOT NULL
                           OR EXISTS (SELECT 1 FROM phieu_xuat_kho p WHERE p.don_ban_hang_id = d.id AND p.trang_thai = 3))
                      -- lọc sớm: ngày hoàn >= :tu thì hoặc đơn cập nhật từ :tu, hoặc có phiếu nhập hoàn hoàn tất từ :tu
                      AND (d.ngay_cap_nhat >= :tuCsdl
                           OR d.id IN (SELECT px.don_ban_hang_id FROM phieu_nhap_kho pn
                                         JOIN phieu_xuat_kho px ON px.so_phieu_xuat = {SO_PX_PN_RET} AND px.trang_thai = 3
                                        WHERE pn.so_phieu_nhap LIKE 'PN-RET%' AND pn.trang_thai = 3
                                          AND pn.phieu_chuyen_kho_id IS NULL
                                          AND pn.ghi_chu LIKE 'Nhập hoàn trả từ phiếu xuất: %' AND pn.ngay_nhap >= :tuLoc))
                ),
                su_kien AS (
                    SELECT 'ban' AS loai, don.id AS don_id, DATE_ADD(don.ngay_gn, INTERVAL :lech MINUTE) AS tg,
                           don.kho_xuat_id AS kho_id, don.kenh_ban_id, don.la_pos, don.nguoi_tao_id,
                           don.gross AS gross, don.vat AS vat, don.gross - don.vat AS dt,
                           {GIA_VON_DON} AS von, 0 AS von_tra_tot, 0 AS von_tra_loi,
                           1 AS don_xuat, 0 AS don_tra,
                           CASE WHEN don.trang_thai = 6{TRA_HET_DON} THEN 1 ELSE 0 END AS bi_hoan
                    FROM don
                    WHERE don.ngay_gn >= :tuLoc AND don.ngay_gn < :denLoc
                    UNION ALL
                    SELECT 'hoan', hoan.id, hoan.tg, hoan.kho_xuat_id, hoan.kenh_ban_id, 0, hoan.nguoi_tao_id,
                           -hoan.gross, -hoan.vat, -(hoan.gross - hoan.vat), 0, hoan.von, 0, 0, 1, 0
                    FROM hoan
                    WHERE hoan.tg >= :tuVn AND hoan.tg < :denVn
                """);
        if (coTraQuay()) {
            sb.append("""
                        UNION ALL
                        SELECT 'tra', d.id, DATE_ADD(pth.ngay_tao, INTERVAL :lech MINUTE), pth.kho_ban_id, d.kenh_ban_id,
                               {LA_POS_D}, d.nguoi_tao_id,
                               -pth.tong_tien_hoan,
                               -pth.tong_tien_hoan * {TY_LE_VAT},
                               -pth.tong_tien_hoan * (1 - {TY_LE_VAT}),
                               0,
                               (SELECT COALESCE(SUM(l.so_luong * l.gia_von), 0) FROM chi_tiet_phieu_tra_hang c
                                  JOIN chi_tiet_phieu_tra_hang_lo l ON l.chi_tiet_phieu_tra_hang_id = c.id
                                 WHERE c.phieu_tra_hang_id = pth.id AND c.tinh_trang = 'dat'),
                               (SELECT COALESCE(SUM(l.so_luong * l.gia_von), 0) FROM chi_tiet_phieu_tra_hang c
                                  JOIN chi_tiet_phieu_tra_hang_lo l ON l.chi_tiet_phieu_tra_hang_id = c.id
                                 WHERE c.phieu_tra_hang_id = pth.id AND c.tinh_trang = 'loi'),
                               0,
                               CASE WHEN {TRA_HET} = 'da_tra_het'
                                     AND pth.id = (SELECT MAX(p2.id) FROM phieu_tra_hang p2 WHERE p2.don_ban_hang_id = d.id)
                                    THEN 1 ELSE 0 END,
                               0
                        FROM phieu_tra_hang pth
                        JOIN don_ban_hang d ON d.id = pth.don_ban_hang_id
                        WHERE pth.ngay_tao >= :tuLoc AND pth.ngay_tao < :denLoc
                          AND (:khoId IS NULL OR pth.kho_ban_id = :khoId)
                    """);
        }
        sb.append("\n)\n");
        return sb.toString()
                .replace("{TRA_HET_DON}", traHet)
                .replace("{TRA_HET}", cotTraHet)
                .replace("{LA_POS_D}", laPos("d.id"))
                .replace("{GIA_VON_D}", giaVonDon("d.id"))
                .replace("{GIA_VON_DON}", giaVonDon("don.id"))
                .replace("{TY_LE_VAT}", TY_LE_VAT)
                .replace("{KHOP_PN_RET}", KHOP_PN_RET)
                .replace("{SO_PX_PN_RET}", SO_PX_PN_RET);
    }

    /** Phần thuế GTGT trong tiền hàng của đơn gốc (0 khi đơn không ghi thuế). */
    /**
     * Số phiếu xuất trong ghi chú phiếu nhập hàng hoàn PN-RET (bí danh pn): "Nhập hoàn trả từ phiếu xuất: PX… (Đơn: …)".
     * Lấy đúng số phiếu (tới dấu cách, "(" hoặc xuống dòng) rồi so bằng: so theo phần đầu thì PX1 khớp cả phiếu của PX12.
     * Báo cáo doanh thu và Báo cáo sản phẩm dùng cùng cách ghép.
     */
    static final String SO_PX_PN_RET = "SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING(pn.ghi_chu, CHAR_LENGTH('Nhập hoàn trả từ phiếu xuất: ') + 1), ' ', 1), '(', 1), CHAR(10 USING utf8mb4), 1), CHAR(13 USING utf8mb4), 1)";

    /** Phiếu nhập hàng hoàn pn thuộc phiếu xuất px. */
    static final String KHOP_PN_RET = "pn.ghi_chu LIKE 'Nhập hoàn trả từ phiếu xuất: %' AND " + SO_PX_PN_RET + " = px.so_phieu_xuat";

    static final String TY_LE_VAT =
            "COALESCE(COALESCE(d.tien_thue_gtgt, 0) / NULLIF(d.tong_cong - COALESCE(d.phi_van_chuyen, 0), 0), 0)";

    /** Mã kênh của một sự kiện: kênh sàn theo bảng kênh, đơn quầy 'POS', còn lại 'TRUC_TIEP'. */
    static final String MA_KENH = "CASE WHEN kb.ma_kenh IS NOT NULL THEN kb.ma_kenh WHEN s.la_pos = 1 THEN 'POS' ELSE 'TRUC_TIEP' END";

    /** Tham số chung của bảng sự kiện: [tu, den) giờ Việt Nam bao trọn mọi khoảng cần đọc trong một lần gọi. */
    private MapSqlParameterSource thamSoSuKien(Integer khoId, LocalDateTime tu, LocalDateTime den) {
        return new MapSqlParameterSource()
                .addValue("khoId", khoId, Types.INTEGER)
                .addValue("tuLoc", goc.mocUngDung(tu))
                .addValue("denLoc", goc.mocUngDung(den))
                .addValue("tuCsdl", goc.mocTuDien(tu))
                .addValue("tuVn", chuoi(tu))
                .addValue("denVn", chuoi(den))
                .addValue("lech", goc.lechUngDung())
                .addValue("lechCsdl", goc.lechTuDien());
    }

    static final String SQL_TONG_THEO_NHOM = """
            SELECT s.kho_id, {MA_KENH} AS ma_kenh, MAX(kb.ten_kenh) AS ten_kenh, s.nguoi_tao_id AS nguoi_id,
                   MAX(u.ho_ten) AS ho_ten, MAX(s.la_pos) AS la_pos,
                   COALESCE(SUM(s.dt), 0)                                               AS doanh_thu,
                   COALESCE(SUM(CASE WHEN s.loai = 'ban' THEN s.gross ELSE 0 END), 0)   AS gross_xuat,
                   COALESCE(SUM(CASE WHEN s.loai <> 'ban' THEN -s.gross ELSE 0 END), 0) AS gross_tra,
                   COALESCE(SUM(s.vat), 0)                                              AS vat,
                   COALESCE(SUM(s.von), 0)                                              AS von,
                   COALESCE(SUM(s.von_tra_tot), 0)                                      AS von_tra_tot,
                   COALESCE(SUM(s.von_tra_loi), 0)                                      AS von_tra_loi,
                   COALESCE(SUM(s.don_xuat), 0)                                         AS don_xuat,
                   COALESCE(SUM(s.don_tra), 0)                                          AS don_tra,
                   COALESCE(SUM(s.bi_hoan), 0)                                          AS bi_hoan
            FROM su_kien s
            LEFT JOIN kenh_ban_hang kb ON kb.id = s.kenh_ban_id
            LEFT JOIN nguoi_dung u     ON u.id = s.nguoi_tao_id
            WHERE s.tg >= :tu AND s.tg < :den
            GROUP BY s.kho_id, {MA_KENH}, s.nguoi_tao_id
            """;

    /** Tổng theo (kho, kênh, người lập) trong [tu, den) giờ Việt Nam. */
    public List<TongNhom> tongTheoNhom(Integer khoId, LocalDateTime tu, LocalDateTime den) {
        String sql = "WITH " + cteSuKien() + SQL_TONG_THEO_NHOM.replace("{MA_KENH}", MA_KENH);
        MapSqlParameterSource p = thamSoSuKien(khoId, tu, den).addValue("tu", chuoi(tu)).addValue("den", chuoi(den));
        return jdbc.query(sql, p, (rs, i) -> new TongNhom((Integer) rs.getObject("kho_id", Integer.class),
                rs.getString("ma_kenh"), rs.getString("ten_kenh"), (Integer) rs.getObject("nguoi_id", Integer.class),
                rs.getString("ho_ten"), rs.getInt("la_pos") == 1,
                bd(rs, "doanh_thu"), bd(rs, "gross_xuat"), bd(rs, "gross_tra"), bd(rs, "vat"),
                bd(rs, "von"), bd(rs, "von_tra_tot"), bd(rs, "von_tra_loi"),
                rs.getLong("don_xuat"), rs.getLong("don_tra"), rs.getLong("bi_hoan")));
    }

    static final String SQL_CHUOI = """
            SELECT DATE_FORMAT(s.tg, :dinhDang)       AS moc,
                   COALESCE(SUM(s.dt), 0)            AS doanh_thu,
                   COALESCE(SUM(s.von), 0)           AS von,
                   COALESCE(SUM(s.von_tra_tot), 0)   AS von_tra_tot,
                   COALESCE(SUM(s.don_xuat), 0)      AS don_xuat,
                   COALESCE(SUM(s.don_tra), 0)       AS don_tra
            FROM su_kien s
            WHERE s.tg >= :tu AND s.tg < :den
            GROUP BY 1
            ORDER BY 1
            """;

    /** Chuỗi biểu đồ: gom theo giờ, ngày hoặc tháng (dinhDang là DINH_DANG_*_SQL) trong [tu, den). */
    public List<DiemChuoi> chuoi(Integer khoId, LocalDateTime tu, LocalDateTime den, String dinhDang) {
        String sql = "WITH " + cteSuKien() + SQL_CHUOI;
        MapSqlParameterSource p = thamSoSuKien(khoId, tu, den).addValue("tu", chuoi(tu)).addValue("den", chuoi(den))
                .addValue("dinhDang", dinhDang);
        return jdbc.query(sql, p, (rs, i) -> new DiemChuoi(rs.getString("moc"), bd(rs, "doanh_thu"), bd(rs, "von"),
                bd(rs, "von_tra_tot"), rs.getLong("don_xuat"), rs.getLong("don_tra")));
    }

    /* ======================================================================
     * THEO DÒNG HÀNG: BÁN CHẠY, NHÓM HÀNG
     * ====================================================================== */

    /**
     * Dòng hàng của mỗi sự kiện: số cái và doanh thu chia từ doanh thu đơn theo tiền dòng (sau giảm giá dòng), để tổng các
     * dòng bằng doanh thu đơn. Hoàn sàn: mọi dòng của đơn, âm. Trả tại quầy: dòng phiếu trả, tiền trả bỏ phần GTGT.
     */
    String cteDong() {
        StringBuilder sb = new StringBuilder("""
                , dong AS (
                    SELECT DATE_ADD(don.ngay_gn, INTERVAL :lech MINUTE) AS tg, ct.bien_the_san_pham_id AS bt,
                           ct.so_luong_dat AS sl,
                           COALESCE((ct.so_luong_dat * ct.don_gia - COALESCE(ct.tien_giam_gia, 0)) * (don.gross - don.vat)
                             / NULLIF(SUM(ct.so_luong_dat * ct.don_gia - COALESCE(ct.tien_giam_gia, 0)) OVER (PARTITION BY don.id), 0), 0) AS dt
                    FROM don
                    JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = don.id
                    WHERE don.ngay_gn >= :tuLoc AND don.ngay_gn < :denLoc
                    UNION ALL
                    SELECT hoan.tg, ct.bien_the_san_pham_id, -ct.so_luong_dat,
                           -COALESCE((ct.so_luong_dat * ct.don_gia - COALESCE(ct.tien_giam_gia, 0)) * (hoan.gross - hoan.vat)
                             / NULLIF(SUM(ct.so_luong_dat * ct.don_gia - COALESCE(ct.tien_giam_gia, 0)) OVER (PARTITION BY hoan.id), 0), 0)
                    FROM hoan
                    JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = hoan.id
                    WHERE hoan.tg >= :tuVn AND hoan.tg < :denVn
                """);
        if (coTraQuay()) {
            sb.append("""
                        UNION ALL
                        SELECT DATE_ADD(pth.ngay_tao, INTERVAL :lech MINUTE), c.bien_the_san_pham_id, -c.so_luong,
                               -c.thanh_tien_hoan * (1 - {TY_LE_VAT})
                        FROM phieu_tra_hang pth
                        JOIN chi_tiet_phieu_tra_hang c ON c.phieu_tra_hang_id = pth.id
                        JOIN don_ban_hang d            ON d.id = pth.don_ban_hang_id
                        WHERE pth.ngay_tao >= :tuLoc AND pth.ngay_tao < :denLoc
                          AND (:khoId IS NULL OR pth.kho_ban_id = :khoId)
                    """);
        }
        sb.append("\n)\n");
        return sb.toString().replace("{TY_LE_VAT}", TY_LE_VAT);
    }

    static final String SQL_SAN_PHAM = """
            SELECT sp.id AS san_pham_id, sp.ma_san_pham, sp.ten_san_pham,
                   SUM(x.sl) AS so_luong, SUM(x.dt) AS doanh_thu
            FROM dong x
            JOIN bien_the_san_pham bt ON bt.id = x.bt
            JOIN san_pham_quan_ao sp  ON sp.id = bt.san_pham_id
            WHERE x.tg >= :tu AND x.tg < :den
            GROUP BY sp.id, sp.ma_san_pham, sp.ten_san_pham
            HAVING SUM(x.sl) > 0
            ORDER BY so_luong DESC, doanh_thu DESC, CAST(sp.ma_san_pham AS BINARY), sp.id
            LIMIT :soDong
            """;

    /** Sản phẩm bán nhiều cái nhất trong [tu, den), đã trừ hàng trả. */
    public List<SanPhamDong> banChay(Integer khoId, LocalDateTime tu, LocalDateTime den, int soDong) {
        String sql = "WITH " + cteSuKien() + cteDong() + SQL_SAN_PHAM;
        MapSqlParameterSource p = thamSoSuKien(khoId, tu, den).addValue("tu", chuoi(tu)).addValue("den", chuoi(den))
                .addValue("soDong", soDong);
        return jdbc.query(sql, p, (rs, i) -> new SanPhamDong(rs.getInt("san_pham_id"), rs.getString("ma_san_pham"),
                rs.getString("ten_san_pham"), bd(rs, "so_luong"), bd(rs, "doanh_thu")));
    }

    /** Ảnh chính (hoặc ảnh đầu) của các sản phẩm, đường dẫn đã đổi sang https. */
    public Map<Integer, String> anhSanPham(Collection<Integer> sanPhamIds) {
        Map<Integer, String> m = new HashMap<>();
        if (sanPhamIds == null || sanPhamIds.isEmpty() || !goc.coBang("anh_quan_ao")) return m;
        jdbc.query("""
                SELECT a.quan_ao_id AS sp_id, tt.duong_dan
                FROM anh_quan_ao a JOIN tep_tin tt ON tt.id = a.tep_tin_id
                WHERE a.quan_ao_id IN (:ids) AND tt.duong_dan IS NOT NULL
                ORDER BY a.quan_ao_id, a.anh_chinh DESC, a.id""",
                new MapSqlParameterSource("ids", sanPhamIds),
                rs -> { m.putIfAbsent(rs.getInt("sp_id"), PublicAssetUrl.toHttps(rs.getString("duong_dan"))); });
        return m;
    }

    /** Danh mục gốc của mọi danh mục (danh mục không có cha là gốc của chính nó). Đặt đầu danh sách WITH RECURSIVE. */
    static final String CTE_DANH_MUC_GOC = """
            goc (id, goc_id) AS (
                SELECT id, id FROM danh_muc_quan_ao WHERE danh_muc_cha_id IS NULL
                UNION ALL
                SELECT c.id, g.goc_id FROM danh_muc_quan_ao c JOIN goc g ON c.danh_muc_cha_id = g.id
            ),
            """;

    static final String SQL_NHOM_HANG = """
            SELECT g.goc_id AS danh_muc_id, MAX(dm.ten_danh_muc) AS ten_danh_muc,
                   SUM(CASE WHEN x.tg >= :tu AND x.tg < :den THEN x.dt ELSE 0 END)           AS doanh_thu,
                   SUM(CASE WHEN x.tg >= :tuTruoc AND x.tg < :denTruoc THEN x.dt ELSE 0 END) AS doanh_thu_truoc
            FROM dong x
            JOIN bien_the_san_pham bt ON bt.id = x.bt
            JOIN san_pham_quan_ao sp  ON sp.id = bt.san_pham_id
            LEFT JOIN goc g           ON g.id = sp.danh_muc_id
            LEFT JOIN danh_muc_quan_ao dm ON dm.id = g.goc_id
            WHERE (x.tg >= :tu AND x.tg < :den) OR (x.tg >= :tuTruoc AND x.tg < :denTruoc)
            GROUP BY g.goc_id
            """;

    /** Doanh thu theo danh mục gốc trong kỳ xem và kỳ so sánh (danh_muc_id null: sản phẩm chưa có danh mục). */
    public List<NhomHangDong> theoNhomHang(Integer khoId, LocalDateTime tu, LocalDateTime den,
                                           LocalDateTime tuTruoc, LocalDateTime denTruoc) {
        LocalDateTime dau = tu.isBefore(tuTruoc) ? tu : tuTruoc;
        LocalDateTime cuoi = den.isAfter(denTruoc) ? den : denTruoc;
        String sql = "WITH RECURSIVE " + CTE_DANH_MUC_GOC + cteSuKien() + cteDong() + SQL_NHOM_HANG;
        MapSqlParameterSource p = thamSoSuKien(khoId, dau, cuoi)
                .addValue("tu", chuoi(tu)).addValue("den", chuoi(den))
                .addValue("tuTruoc", chuoi(tuTruoc)).addValue("denTruoc", chuoi(denTruoc));
        return jdbc.query(sql, p, (rs, i) -> new NhomHangDong((Integer) rs.getObject("danh_muc_id", Integer.class),
                rs.getString("ten_danh_muc"), bd(rs, "doanh_thu"), bd(rs, "doanh_thu_truoc")));
    }

    /* ======================================================================
     * CHỜ XUẤT, KHO, NGÀY ĐẦU DỮ LIỆU
     * ====================================================================== */

    static final String SQL_CHO_XUAT = """
            SELECT COUNT(*) AS so_don,
                   COALESCE(SUM(d.tong_cong - COALESCE(d.phi_van_chuyen, 0) - COALESCE(d.tien_thue_gtgt, 0)), 0) AS tien
            FROM don_ban_hang d
            WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (0, 1, 2, 7, 8)
              AND d.ngay_dat_hang >= :tu AND d.ngay_dat_hang < :den
              AND COALESCE(d.ghi_chu, '') NOT LIKE :coShopee
              AND COALESCE(d.ghi_chu, '') NOT LIKE :coHuy
              AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
            """;

    /** Đơn đặt trong [tu, den), chưa xuất, chưa hủy (bỏ đơn Shopee chờ xác nhận và đơn khách đã yêu cầu hủy). */
    public ChoXuatDong choXuat(Integer khoId, LocalDateTime tu, LocalDateTime den) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("khoId", khoId, Types.INTEGER)
                .addValue("tu", goc.mocUngDung(tu)).addValue("den", goc.mocUngDung(den))
                .addValue("coShopee", "%" + CO_SHOPEE_CHO_XAC_NHAN + "%").addValue("coHuy", "%" + CO_YEU_CAU_HUY + "%");
        return jdbc.queryForObject(SQL_CHO_XUAT, p, (rs, i) -> new ChoXuatDong(rs.getLong("so_don"), bd(rs, "tien")));
    }

    /**
     * Ngày kho bắt đầu hoạt động (mốc "kho mới mở"): sớm nhất giữa ngày tạo kho, đơn bán đầu tiên và phiếu nhập đầu tiên của
     * kho. Kho tạo lại trên hệ thống sau khi đã bán từ trước (ngày tạo muộn hơn chứng từ) không bị coi là kho mới.
     * Mọi cột đã đổi sang giờ Việt Nam trước khi so.
     */
    public List<KhoMoDong> ngayMoKho() {
        return jdbc.query("""
                SELECT k.id,
                       LEAST(COALESCE(DATE_ADD(k.ngay_tao, INTERVAL :lechCsdl MINUTE), '9999-12-31'),
                             COALESCE((SELECT DATE_ADD(MIN(d.ngay_dat_hang), INTERVAL :lech MINUTE) FROM don_ban_hang d
                                        WHERE d.kho_xuat_id = k.id AND d.loai_chung_tu = 'don_ban_hang'), '9999-12-31'),
                             COALESCE((SELECT DATE_ADD(MIN(pn.ngay_nhap), INTERVAL :lech MINUTE) FROM phieu_nhap_kho pn
                                        WHERE pn.kho_id = k.id AND pn.trang_thai = 3), '9999-12-31')) AS ngay_mo
                FROM kho k""",
                new MapSqlParameterSource().addValue("lech", goc.lechUngDung()).addValue("lechCsdl", goc.lechTuDien()),
                (rs, i) -> {
                    LocalDateTime t = rs.getObject("ngay_mo", LocalDateTime.class);
                    return new KhoMoDong(rs.getInt("id"), t == null || t.getYear() >= 9999 ? null : t);
                });
    }

    /** Ngày đặt đơn bán sớm nhất (giờ Việt Nam): lịch chọn khoảng không cho chọn trước ngày này. */
    public LocalDateTime ngayDauDuLieu() {
        List<LocalDateTime> ds = jdbc.query(
                "SELECT MIN(ngay_dat_hang) AS t FROM don_ban_hang WHERE loai_chung_tu = 'don_ban_hang'",
                new MapSqlParameterSource(), (rs, i) -> rs.getObject("t", LocalDateTime.class));
        LocalDateTime t = ds.isEmpty() ? null : ds.get(0);
        return t == null ? null : t.plusMinutes(goc.lechUngDung());
    }

    /* ======================================================================
     * TỒN KHO (hiện tại)
     * ====================================================================== */

    /**
     * Tồn theo cặp (kho, biến thể) từng có lô, kèm:
     * - giu_don / giu_chuyen: hàng giữ cho đơn bán chưa xuất và phiếu chuyển chưa xuất ở kho đó (cùng luật với
     *   BaoCaoSanPhamRepository.GIU_HANG_DONG, thêm cột kho);
     * - co_the_ban = max(0, khả dụng của lô − giu_don − giu_chuyen). Khả dụng của lô đã trừ hàng giữ ở lô (thanh toán chờ,
     *   nhặt cho phiếu chuyển, hàng trả chờ cất kệ);
     * - nguong theo chuỗi: riêng biến thể × kho (canh_bao) → của sản phẩm → mặc định.
     * Mức: Hết (co_the_ban ≤ 0), Sắp hết (≤ ngưỡng), Dư (> 1,5 lần ngưỡng, cùng mức với Báo cáo tồn kho), còn lại
     * Bình thường. Chỉ phân loại biến thể và sản phẩm đang kinh doanh.
     */
    String cteTon() {
        return """
                cap AS (
                    SELECT tk.kho_id, lh.bien_the_san_pham_id AS bien_the_id,
                           SUM(tk.so_luong_ton)                 AS ton,
                           SUM(COALESCE(tk.so_luong_da_dat, 0)) AS da_dat,
                           SUM(tk.so_luong_kha_dung)            AS kha_dung,
                           SUM(tk.so_luong_ton * lh.gia_von)    AS gia_tri
                    FROM ton_kho_theo_lo tk
                    JOIN lo_hang lh ON lh.id = tk.lo_hang_id
                    JOIN kho k      ON k.id = tk.kho_id AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
                    GROUP BY tk.kho_id, lh.bien_the_san_pham_id
                ),
                giu AS (
                    SELECT x.kho_id, x.bt_id, SUM(x.don) AS giu_don, SUM(x.chuyen) AS giu_chuyen FROM (
                        SELECT d.kho_xuat_id AS kho_id, ct.bien_the_san_pham_id AS bt_id, ct.so_luong_dat AS don, 0 AS chuyen
                        FROM chi_tiet_don_ban_hang ct
                        JOIN don_ban_hang d ON d.id = ct.don_ban_hang_id
                        WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (:giuHang) AND d.kho_xuat_id IS NOT NULL
                        UNION ALL
                        SELECT d.kho_xuat_id, ctpx.bien_the_san_pham_id, -ctpx.so_luong_xuat, 0
                        FROM chi_tiet_phieu_xuat_kho ctpx
                        JOIN phieu_xuat_kho px ON px.id = ctpx.phieu_xuat_kho_id AND px.trang_thai = 3
                        JOIN don_ban_hang d    ON d.id = px.don_ban_hang_id
                        WHERE ctpx.lo_hang_id IS NOT NULL
                          AND d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (:giuHang) AND d.kho_xuat_id IS NOT NULL
                        UNION ALL
                        SELECT p.kho_xuat_id, ct.bien_the_san_pham_id, 0,
                               GREATEST(ct.so_luong_chuyen - COALESCE((
                                   SELECT SUM(c.so_luong_xuat)
                                   FROM phieu_xuat_kho px
                                   JOIN chi_tiet_phieu_xuat_kho c ON c.phieu_xuat_kho_id = px.id AND c.lo_hang_id IS NOT NULL
                                   WHERE px.phieu_chuyen_kho_id = p.id AND px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 0
                                     AND c.bien_the_san_pham_id = ct.bien_the_san_pham_id), 0), 0)
                        FROM chi_tiet_phieu_chuyen_kho ct
                        JOIN phieu_chuyen_kho p ON p.id = ct.phieu_chuyen_kho_id
                        WHERE p.trang_thai IN ('CHO_DUYET', 'DA_DUYET')
                    ) x
                    GROUP BY x.kho_id, x.bt_id
                ),
                loai AS (
                    SELECT cap.kho_id, cap.bien_the_id, bt.san_pham_id, cap.ton, cap.da_dat, cap.gia_tri,
                           GREATEST(COALESCE(g.giu_don, 0), 0)    AS giu_don,
                           GREATEST(COALESCE(g.giu_chuyen, 0), 0) AS giu_chuyen,
                           GREATEST(cap.kha_dung - GREATEST(COALESCE(g.giu_don, 0), 0) - GREATEST(COALESCE(g.giu_chuyen, 0), 0), 0) AS co_the_ban,
                           {NGUONG} AS nguong,
                           CASE WHEN bt.trang_thai = 1 AND sp.trang_thai IN (0, 1) THEN 1 ELSE 0 END AS dang_ban
                    FROM cap
                    JOIN bien_the_san_pham bt ON bt.id = cap.bien_the_id
                    JOIN san_pham_quan_ao sp  ON sp.id = bt.san_pham_id
                    LEFT JOIN giu g   ON g.kho_id = cap.kho_id AND g.bt_id = cap.bien_the_id
                ),
                muc AS (
                    SELECT loai.*,
                           CASE WHEN dang_ban = 0 THEN NULL
                                WHEN co_the_ban <= 0 THEN 'het'
                                WHEN co_the_ban <= nguong THEN 'sap'
                                WHEN co_the_ban > nguong * 1.5 THEN 'du'
                                ELSE 'thuong' END AS muc
                    FROM loai
                )
                """.replace("{NGUONG}", bieuThucNguong());
    }

    private String bieuThucNguong() {
        if (!goc.coBang("canh_bao")) {
            return "COALESCE(NULLIF(sp.muc_ton_toi_thieu, 0), :nguongMacDinh)";
        }
        return "COALESCE(NULLIF((SELECT cb.nguong_canh_bao FROM canh_bao cb "
                + "WHERE cb.kho_id = cap.kho_id AND cb.bien_the_san_pham_id = cap.bien_the_id "
                + "AND cb.loai_canh_bao = 'ton_kho_thap' AND cb.lo_hang_id IS NULL AND cb.nguong_canh_bao > 0 "
                + "ORDER BY cb.ngay_canh_bao DESC, cb.id DESC LIMIT 1), 0), "
                + "NULLIF(sp.muc_ton_toi_thieu, 0), :nguongMacDinh)";
    }

    private MapSqlParameterSource thamSoTon(Integer khoId, int nguongMacDinh) {
        return new MapSqlParameterSource().addValue("khoId", khoId, Types.INTEGER)
                .addValue("giuHang", ITrangThaiDonBanHang.DANG_GIU_HANG)
                .addValue("nguongMacDinh", nguongMacDinh);
    }

    static final String SQL_TON_TONG = """
            SELECT COALESCE(SUM(ton), 0)         AS ton,
                   COALESCE(SUM(da_dat), 0)      AS da_dat,
                   COALESCE(SUM(giu_don), 0)     AS giu_don,
                   COALESCE(SUM(giu_chuyen), 0)  AS giu_chuyen,
                   COALESCE(SUM(co_the_ban), 0)  AS co_the_ban,
                   COALESCE(SUM(gia_tri), 0)     AS gia_tri,
                   COUNT(DISTINCT CASE WHEN dang_ban = 1 THEN bien_the_id END) AS so_bien_the,
                   COALESCE(SUM(dang_ban), 0)    AS so_dong,
                   COALESCE(SUM(muc = 'het'), 0)    AS het,
                   COALESCE(SUM(muc = 'sap'), 0)    AS sap,
                   COALESCE(SUM(muc = 'thuong'), 0) AS thuong,
                   COALESCE(SUM(muc = 'du'), 0)     AS du,
                   COALESCE(SUM(CASE WHEN muc = 'du' THEN gia_tri ELSE 0 END), 0) AS gia_tri_du,
                   COALESCE(SUM(CASE WHEN muc = 'du'
                        AND NOT EXISTS (SELECT 1 FROM chi_tiet_don_ban_hang ct JOIN don_ban_hang d ON d.id = ct.don_ban_hang_id
                                         WHERE ct.bien_the_san_pham_id = m.bien_the_id AND d.kho_xuat_id = m.kho_id
                                           AND d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (3, 5, 6)
                                           AND COALESCE(d.ngay_giao_hang, d.ngay_dat_hang) >= :tuCham)
                        AND NOT EXISTS (SELECT 1 FROM chi_tiet_phieu_nhap_kho cn JOIN phieu_nhap_kho pn ON pn.id = cn.phieu_nhap_kho_id
                                         WHERE cn.bien_the_san_pham_id = m.bien_the_id AND pn.kho_id = m.kho_id
                                           AND pn.trang_thai = 3 AND pn.ngay_nhap >= :tuCham)
                        THEN 1 ELSE 0 END), 0) AS du_cham
            FROM muc m
            WHERE (:khoId IS NULL OR kho_id = :khoId)
            """;

    /** Tổng tồn hiện tại của kho đang xem (khoId null: mọi kho bán, không gồm hàng đang chuyển). */
    public TonTongDong tonTong(Integer khoId, int nguongMacDinh, int soNgayCham, LocalDateTime bayGio) {
        String sql = "WITH " + cteTon() + SQL_TON_TONG;
        MapSqlParameterSource p = thamSoTon(khoId, nguongMacDinh)
                .addValue("tuCham", goc.mocUngDung(bayGio.minusDays(soNgayCham)));
        return jdbc.queryForObject(sql, p, (rs, i) -> new TonTongDong(bd(rs, "ton"), bd(rs, "da_dat"), bd(rs, "giu_don"),
                bd(rs, "giu_chuyen"), bd(rs, "co_the_ban"), bd(rs, "gia_tri"), rs.getLong("so_bien_the"),
                rs.getLong("so_dong"), rs.getLong("het"), rs.getLong("sap"), rs.getLong("thuong"), rs.getLong("du"),
                bd(rs, "gia_tri_du"), rs.getLong("du_cham")));
    }

    static final String SQL_TON_THEO_KHO = """
            SELECT kho_id, COALESCE(SUM(gia_tri), 0) AS gia_tri, COALESCE(SUM(co_the_ban), 0) AS co_the_ban,
                   COALESCE(SUM(muc = 'het'), 0) AS het, COALESCE(SUM(muc = 'sap'), 0) AS sap
            FROM muc
            GROUP BY kho_id
            """;

    /** Giá trị tồn, có thể bán, số mã hết / sắp hết của từng kho bán. */
    public List<TonTheoKhoDong> tonTheoKho(int nguongMacDinh) {
        String sql = "WITH " + cteTon() + SQL_TON_THEO_KHO;
        return jdbc.query(sql, thamSoTon(null, nguongMacDinh), (rs, i) -> new TonTheoKhoDong(
                rs.getInt("kho_id"), bd(rs, "gia_tri"), bd(rs, "co_the_ban"), rs.getLong("het"), rs.getLong("sap")));
    }

    static final String SQL_BO_SUNG = """
            , kt AS (SELECT k.id FROM kho k WHERE k.loai_kho = 'kho_tong' AND k.trang_thai = 1 ORDER BY k.id LIMIT 1)
            SELECT m.bien_the_id, m.san_pham_id, bt.ma_sku, sp.ten_san_pham, ms.ten_mau, sz.ten_size,
                   m.co_the_ban, m.nguong,
                   (SELECT SUM(m2.co_the_ban) FROM muc m2 JOIN kt ON kt.id = m2.kho_id
                     WHERE m2.bien_the_id = m.bien_the_id AND m2.kho_id <> m.kho_id) AS kho_tong_con,
                   (SELECT COALESCE(SUM(ctm.so_luong_dat - COALESCE(ctm.so_luong_da_nhan, 0)), 0)
                      FROM chi_tiet_don_mua_hang ctm JOIN don_mua_hang dm ON dm.id = ctm.don_mua_hang_id
                     WHERE dm.trang_thai IN (3, 5) AND dm.kho_nhap_id = m.kho_id
                       AND ctm.bien_the_san_pham_id = m.bien_the_id
                       AND ctm.so_luong_dat > COALESCE(ctm.so_luong_da_nhan, 0)) AS dang_ve,
                   COUNT(*) OVER () AS tong
            FROM muc m
            JOIN bien_the_san_pham bt ON bt.id = m.bien_the_id
            JOIN san_pham_quan_ao sp  ON sp.id = m.san_pham_id
            LEFT JOIN mau_sac ms      ON ms.id = bt.mau_sac_id
            LEFT JOIN size sz         ON sz.id = bt.size_id
            WHERE m.kho_id = :khoId AND m.muc IN ('het', 'sap')
            ORDER BY m.co_the_ban / m.nguong, m.co_the_ban, m.bien_the_id
            LIMIT :soDong
            """;

    /** Mã hết / sắp hết ở một kho, tệ nhất trước, kèm Kho tổng còn và đang về (đơn mua) của mã ở kho đó. */
    public List<BoSungDong> canBoSung(int khoId, int nguongMacDinh, int soDong) {
        String sql = "WITH " + cteTon() + SQL_BO_SUNG;
        MapSqlParameterSource p = thamSoTon(khoId, nguongMacDinh).addValue("soDong", soDong);
        return jdbc.query(sql, p, (rs, i) -> new BoSungDong(rs.getInt("bien_the_id"), rs.getInt("san_pham_id"),
                rs.getString("ma_sku"), rs.getString("ten_san_pham"), rs.getString("ten_mau"), rs.getString("ten_size"),
                bd(rs, "co_the_ban"), rs.getInt("nguong"), rs.getBigDecimal("kho_tong_con"), bd(rs, "dang_ve"),
                rs.getLong("tong")));
    }

    /** Giá trị hàng đang nằm ở kho trung chuyển (đã xuất khỏi kho gửi, kho nhận chưa nhận xong). */
    public BigDecimal giaTriDangChuyen() {
        BigDecimal v = jdbc.queryForObject("""
                SELECT COALESCE(SUM(tk.so_luong_ton * lh.gia_von), 0)
                FROM ton_kho_theo_lo tk
                JOIN lo_hang lh ON lh.id = tk.lo_hang_id
                JOIN kho k      ON k.id = tk.kho_id AND k.ma_kho = 'KHO_TRANSIT'""",
                new MapSqlParameterSource(), BigDecimal.class);
        return v == null ? BigDecimal.ZERO : v;
    }

    static final String SQL_DANG_CHUYEN_DI_DEN = """
            SELECT
              (SELECT COALESCE(SUM(ct.so_luong_xuat), 0)
               FROM phieu_xuat_kho px
               JOIN phieu_chuyen_kho pck       ON pck.id = px.phieu_chuyen_kho_id
               JOIN chi_tiet_phieu_xuat_kho ct ON ct.phieu_xuat_kho_id = px.id AND ct.lo_hang_id IS NOT NULL
               WHERE px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 3 AND pck.trang_thai = 'DANG_VAN_CHUYEN'
                 AND (:khoId IS NULL OR pck.kho_xuat_id = :khoId)) AS di,
              (SELECT COALESCE(SUM(ct.so_luong_xuat), 0)
               FROM phieu_xuat_kho px
               JOIN phieu_chuyen_kho pck       ON pck.id = px.phieu_chuyen_kho_id
               JOIN chi_tiet_phieu_xuat_kho ct ON ct.phieu_xuat_kho_id = px.id AND ct.lo_hang_id IS NOT NULL
               WHERE px.loai_xuat = 'chuyen_kho' AND px.trang_thai = 3 AND pck.trang_thai = 'DANG_VAN_CHUYEN'
                 AND (:khoId IS NULL OR pck.kho_nhap_id = :khoId)) AS den
            """;

    /** Hàng đang trên đường của phiếu chuyển Đang vận chuyển: kho đang xem gửi đi / sắp nhận (null: mọi phiếu). */
    public DangChuyenDong dangChuyen(Integer khoId) {
        return jdbc.queryForObject(SQL_DANG_CHUYEN_DI_DEN, new MapSqlParameterSource().addValue("khoId", khoId, Types.INTEGER),
                (rs, i) -> new DangChuyenDong(bd(rs, "di"), bd(rs, "den")));
    }

    /** Số cái hàng lỗi trên biên bản trả nhà cung cấp còn chờ trả (không nằm trong tồn bán được). */
    public BigDecimal hangLoiChoTra(Integer khoId) {
        if (!goc.coBang("bien_ban_tra_hang_ncc")) return BigDecimal.ZERO;
        BigDecimal v = jdbc.queryForObject("""
                SELECT COALESCE(SUM(bb.tong_so_luong_loi), 0)
                FROM bien_ban_tra_hang_ncc bb
                JOIN phieu_nhap_kho pn ON pn.id = bb.phieu_nhap_kho_id
                WHERE bb.trang_thai = 'CHO_TRA_HANG' AND (:khoId IS NULL OR pn.kho_id = :khoId)""",
                new MapSqlParameterSource().addValue("khoId", khoId, Types.INTEGER), BigDecimal.class);
        return v == null ? BigDecimal.ZERO : v;
    }

    /* ======================================================================
     * CẦN XỬ LÝ
     * ====================================================================== */

    /**
     * Mỗi truy vấn trả một dòng cho một loại việc: tong (COUNT(*) OVER ()) và chứng từ đứng đầu theo thứ tự của truy vấn.
     * Cột: tong, ma, ten, kho, kho2, moc (cột gốc, đổi giờ theo loại cột), so_phu, so_phu2, kho_id, và tham_chieu_id
     * nếu loại việc có. Không có việc thì không có dòng.
     */
    private ViecDong mot(String loai, String sql, MapSqlParameterSource p, boolean mocTuDien) {
        List<ViecDong> ds = jdbc.query(sql, p, (rs, i) -> {
            LocalDateTime t = rs.getObject("moc", LocalDateTime.class);
            LocalDateTime moc = t == null ? null : t.plusMinutes(mocTuDien ? goc.lechTuDien() : goc.lechUngDung());
            return new ViecDong(loai, rs.getLong("tong"), rs.getString("ma"), rs.getString("ten"),
                    rs.getString("kho"), rs.getString("kho2"), moc, rs.getLong("so_phu"), rs.getLong("so_phu2"),
                    (Integer) rs.getObject("kho_id", Integer.class), soNguyenNeuCo(rs, "tham_chieu_id"));
        });
        return ds.isEmpty() ? new ViecDong(loai, 0, null, null, null, null, null, 0, 0, null, null) : ds.get(0);
    }

    private MapSqlParameterSource thamSoViec(Integer khoId, LocalDateTime bayGio) {
        return new MapSqlParameterSource().addValue("khoId", khoId, Types.INTEGER)
                .addValue("bayGio", goc.mocUngDung(bayGio))
                .addValue("homNay", goc.mocUngDung(bayGio.toLocalDate().atStartOfDay()))
                .addValue("khoa24", goc.mocUngDung(bayGio.minusHours(24)))
                .addValue("coHuy", "%" + CO_YEU_CAU_HUY + "%")
                .addValue("coShopee", "%" + CO_SHOPEE_CHO_XAC_NHAN + "%");
    }

    /** Đơn sàn chưa xuất mà khách đã yêu cầu hủy (cờ trong ghi chú). */
    static final String SQL_VIEC_HUY = """
            SELECT COUNT(*) OVER () AS tong, d.so_don_hang AS ma, kb.ten_kenh AS ten, k.ten_kho AS kho, NULL AS kho2,
                   d.ngay_dat_hang AS moc, 0 AS so_phu, 0 AS so_phu2, d.kho_xuat_id AS kho_id
            FROM don_ban_hang d
            LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
            LEFT JOIN kho k            ON k.id = d.kho_xuat_id
            WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (0, 1, 2, 7, 8)
              AND d.ghi_chu LIKE :coHuy
              AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
            ORDER BY d.ngay_dat_hang, d.id
            LIMIT 1
            """;

    /** Đơn chờ nhặt (1 và 2), chờ đóng gói (7), chờ giao vận chuyển (8); bỏ đơn khách đã yêu cầu hủy. :tt là danh sách trạng thái. */
    static final String SQL_VIEC_DON_KHO = """
            SELECT COUNT(*) OVER () AS tong, d.so_don_hang AS ma, kb.ten_kenh AS ten, k.ten_kho AS kho, NULL AS kho2,
                   d.ngay_dat_hang AS moc, 0 AS so_phu, 0 AS so_phu2, d.kho_xuat_id AS kho_id
            FROM don_ban_hang d
            LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
            LEFT JOIN kho k            ON k.id = d.kho_xuat_id
            WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (:tt)
              AND COALESCE(d.ghi_chu, '') NOT LIKE :coHuy
              AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
            ORDER BY d.ngay_dat_hang, d.id
            LIMIT 1
            """;

    /** Đơn nháp chưa gửi kho: bỏ đơn Shopee chờ sàn xác nhận / thanh toán và đơn khách đã yêu cầu hủy. */
    static final String SQL_VIEC_NHAP = """
            SELECT COUNT(*) OVER () AS tong, d.so_don_hang AS ma, kb.ten_kenh AS ten, k.ten_kho AS kho, NULL AS kho2,
                   d.ngay_dat_hang AS moc, 0 AS so_phu, 0 AS so_phu2, d.kho_xuat_id AS kho_id
            FROM don_ban_hang d
            LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
            LEFT JOIN kho k            ON k.id = d.kho_xuat_id
            WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 0
              AND COALESCE(d.ghi_chu, '') NOT LIKE :coShopee
              AND COALESCE(d.ghi_chu, '') NOT LIKE :coHuy
              AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
            ORDER BY d.ngay_dat_hang, d.id
            LIMIT 1
            """;

    /** Sàn báo đã giao (thông báo lệch trạng thái) mà đơn vẫn chưa xuất đủ, chưa hủy. */
    static final String SQL_VIEC_SAN_GIAO = """
            SELECT COUNT(*) OVER () AS tong, d.so_don_hang AS ma, kb.ten_kenh AS ten, k.ten_kho AS kho, NULL AS kho2,
                   d.ngay_dat_hang AS moc, 0 AS so_phu, 0 AS so_phu2, d.kho_xuat_id AS kho_id
            FROM don_ban_hang d
            LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
            LEFT JOIN kho k            ON k.id = d.kho_xuat_id
            WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (0, 1, 2, 7, 8)
              AND EXISTS (SELECT 1 FROM thong_bao tb
                           WHERE tb.loai_tham_chieu = 'don_ban_hang' AND tb.id_tham_chieu = d.id
                             AND tb.khoa_su_kien LIKE CONCAT('DBH:', d.id, ':LECH_SAN:%'))
              AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
            ORDER BY d.ngay_dat_hang, d.id
            LIMIT 1
            """;

    /** Phiếu chuyển đang vận chuyển đã qua giờ dự kiến đến (kho gửi hoặc kho nhận là kho đang xem). */
    static final String SQL_VIEC_TRE_HEN = """
            SELECT COUNT(*) OVER () AS tong, p.so_phieu_chuyen AS ma, NULL AS ten, kx.ten_kho AS kho, kn.ten_kho AS kho2,
                   p.ngay_du_kien_den AS moc, 0 AS so_phu, 0 AS so_phu2, p.kho_xuat_id AS kho_id
            FROM phieu_chuyen_kho p
            JOIN kho kx ON kx.id = p.kho_xuat_id
            JOIN kho kn ON kn.id = p.kho_nhap_id
            WHERE p.trang_thai = 'DANG_VAN_CHUYEN' AND p.ngay_du_kien_den IS NOT NULL AND p.ngay_du_kien_den < :bayGio
              AND (:khoId IS NULL OR p.kho_xuat_id = :khoId OR p.kho_nhap_id = :khoId)
            ORDER BY p.ngay_du_kien_den, p.id
            LIMIT 1
            """;

    /** Phiếu chuyển chờ duyệt (so_phu) và đã duyệt chờ xuất (so_phu2). */
    static final String SQL_VIEC_CHO_CHUYEN = """
            SELECT COUNT(*) OVER () AS tong, p.so_phieu_chuyen AS ma, NULL AS ten, kx.ten_kho AS kho, kn.ten_kho AS kho2,
                   p.ngay_tao AS moc,
                   SUM(p.trang_thai = 'CHO_DUYET') OVER () AS so_phu, SUM(p.trang_thai = 'DA_DUYET') OVER () AS so_phu2,
                   p.kho_xuat_id AS kho_id
            FROM phieu_chuyen_kho p
            JOIN kho kx ON kx.id = p.kho_xuat_id
            JOIN kho kn ON kn.id = p.kho_nhap_id
            WHERE p.trang_thai IN ('CHO_DUYET', 'DA_DUYET')
              AND (:khoId IS NULL OR p.kho_xuat_id = :khoId OR p.kho_nhap_id = :khoId)
            ORDER BY p.ngay_tao, p.id
            LIMIT 1
            """;

    /** Phiếu chuyển chờ xử lý chênh lệch: so_phu = số nhận, so_phu2 = số gửi (theo biên bản giao nhận). */
    static final String SQL_VIEC_LECH = """
            SELECT COUNT(*) OVER () AS tong, p.so_phieu_chuyen AS ma, NULL AS ten, kx.ten_kho AS kho, kn.ten_kho AS kho2,
                   p.ngay_thuc_te_den AS moc,
                   (SELECT COALESCE(SUM(c.so_luong_nhan), 0) FROM chi_tiet_bien_ban_giao_nhan c
                      JOIN bien_ban_giao_nhan b ON b.id = c.bien_ban_id WHERE b.phieu_chuyen_kho_id = p.id) AS so_phu,
                   (SELECT COALESCE(SUM(c.so_luong_gui), 0) FROM chi_tiet_bien_ban_giao_nhan c
                      JOIN bien_ban_giao_nhan b ON b.id = c.bien_ban_id WHERE b.phieu_chuyen_kho_id = p.id) AS so_phu2,
                   p.kho_nhap_id AS kho_id
            FROM phieu_chuyen_kho p
            JOIN kho kx ON kx.id = p.kho_xuat_id
            JOIN kho kn ON kn.id = p.kho_nhap_id
            WHERE p.trang_thai = 'CHO_XU_LY_LECH'
              AND (:khoId IS NULL OR p.kho_xuat_id = :khoId OR p.kho_nhap_id = :khoId)
            ORDER BY p.ngay_thuc_te_den, p.id
            LIMIT 1
            """;

    /** Phiếu nhập nháp: hàng đã về chờ kiểm đếm, nhập kho (so_phu = số cái dự kiến). */
    static final String SQL_VIEC_NHAP_KHO = """
            SELECT COUNT(*) OVER () AS tong, p.so_phieu_nhap AS ma, ncc.ten_nha_cung_cap AS ten, k.ten_kho AS kho, NULL AS kho2,
                   p.ngay_tao AS moc,
                   (SELECT COALESCE(SUM(COALESCE(ct.so_luong_yeu_cau, ct.so_luong_nhap)), 0)
                      FROM chi_tiet_phieu_nhap_kho ct WHERE ct.phieu_nhap_kho_id = p.id AND ct.lo_hang_id IS NULL) AS so_phu,
                   0 AS so_phu2, p.kho_id AS kho_id
            FROM phieu_nhap_kho p
            JOIN kho k                 ON k.id = p.kho_id
            LEFT JOIN nha_cung_cap ncc ON ncc.id = p.nha_cung_cap_id
            WHERE p.trang_thai = 0 AND (:khoId IS NULL OR p.kho_id = :khoId)
            ORDER BY p.ngay_tao, p.id
            LIMIT 1
            """;

    /** Đợt kiểm kê đang đếm còn khóa kệ quá 24 giờ kể từ lúc bắt đầu (so_phu = số kệ đang khóa). */
    static final String SQL_VIEC_KIEM_KE_KHOA = """
            SELECT COUNT(*) OVER () AS tong, dk.ma_dot_kiem_ke AS ma, dk.ten_dot_kiem_ke AS ten, k.ten_kho AS kho, NULL AS kho2,
                   dk.ngay_bat_dau AS moc,
                   (SELECT COUNT(*) FROM dot_kiem_ke_vi_tri v WHERE v.dot_kiem_ke_id = dk.id AND v.trang_thai_khoa = 1) AS so_phu,
                   0 AS so_phu2, dk.kho_id AS kho_id
            FROM dot_kiem_ke dk
            JOIN kho k ON k.id = dk.kho_id
            WHERE dk.trang_thai = 1 AND dk.ngay_bat_dau IS NOT NULL AND dk.ngay_bat_dau < :khoa24
              AND EXISTS (SELECT 1 FROM dot_kiem_ke_vi_tri v WHERE v.dot_kiem_ke_id = dk.id AND v.trang_thai_khoa = 1)
              AND (:khoId IS NULL OR dk.kho_id = :khoId)
            ORDER BY dk.ngay_bat_dau, dk.id
            LIMIT 1
            """;

    /** Đợt kiểm kê đã đếm xong, chờ duyệt chênh lệch. */
    static final String SQL_VIEC_KIEM_KE_DUYET = """
            SELECT COUNT(*) OVER () AS tong, dk.ma_dot_kiem_ke AS ma, dk.ten_dot_kiem_ke AS ten, k.ten_kho AS kho, NULL AS kho2,
                   COALESCE(dk.ngay_hoan_thanh, dk.ngay_cap_nhat) AS moc, 0 AS so_phu, 0 AS so_phu2, dk.kho_id AS kho_id
            FROM dot_kiem_ke dk
            JOIN kho k ON k.id = dk.kho_id
            WHERE dk.trang_thai = 2 AND (:khoId IS NULL OR dk.kho_id = :khoId)
            ORDER BY COALESCE(dk.ngay_hoan_thanh, dk.ngay_cap_nhat), dk.id
            LIMIT 1
            """;

    /** Lệnh hoàn kệ đang chờ cất (so_phu = tổng số cái chưa cất, chưa bán được). */
    static final String SQL_VIEC_HOAN_KE = """
            SELECT COUNT(*) OVER () AS tong, NULL AS ma, NULL AS ten, k.ten_kho AS kho, NULL AS kho2,
                   cb.ngay_canh_bao AS moc, SUM(cb.so_luong_hien_tai) OVER () AS so_phu, 0 AS so_phu2, cb.kho_id AS kho_id
            FROM canh_bao cb
            JOIN kho k ON k.id = cb.kho_id
            WHERE cb.loai_canh_bao = 'HOAN_KE_CHO_CAT' AND cb.trang_thai = 0
              AND (:khoId IS NULL OR cb.kho_id = :khoId)
            ORDER BY cb.ngay_canh_bao, cb.id
            LIMIT 1
            """;

    /**
     * Biên bản hàng lỗi chờ trả nhà cung cấp (bước kho làm): so_phu = tổng số cái lỗi; tham_chieu_id = nhà cung cấp của
     * biên bản chờ lâu nhất, để mở thẻ Trả hàng của nhà cung cấp đó (app nội bộ không có màn danh sách biên bản).
     */
    static final String SQL_VIEC_TRA_NCC = """
            SELECT COUNT(*) OVER () AS tong, bb.ma_bien_ban AS ma, ncc.ten_nha_cung_cap AS ten, k.ten_kho AS kho, NULL AS kho2,
                   bb.ngay_tao AS moc, SUM(bb.tong_so_luong_loi) OVER () AS so_phu, 0 AS so_phu2, pn.kho_id AS kho_id,
                   bb.nha_cung_cap_id AS tham_chieu_id
            FROM bien_ban_tra_hang_ncc bb
            JOIN phieu_nhap_kho pn     ON pn.id = bb.phieu_nhap_kho_id
            JOIN kho k                 ON k.id = pn.kho_id
            LEFT JOIN nha_cung_cap ncc ON ncc.id = bb.nha_cung_cap_id
            WHERE bb.trang_thai = 'CHO_TRA_HANG' AND (:khoId IS NULL OR pn.kho_id = :khoId)
            ORDER BY bb.ngay_tao, bb.id
            LIMIT 1
            """;

    /**
     * Đơn mua quá hạn giao: đã chốt (3, 5), ngày giao dự kiến trước hôm nay, còn dòng chưa nhận đủ, và chưa có phiếu nhập
     * nháp (hàng đã về đang kiểm đếm thì không còn là trễ).
     */
    static final String SQL_VIEC_MUA_QUA_HAN = """
            SELECT COUNT(*) OVER () AS tong, dm.so_don_mua AS ma, ncc.ten_nha_cung_cap AS ten, k.ten_kho AS kho, NULL AS kho2,
                   dm.ngay_giao_du_kien AS moc, 0 AS so_phu, 0 AS so_phu2, dm.kho_nhap_id AS kho_id
            FROM don_mua_hang dm
            LEFT JOIN nha_cung_cap ncc ON ncc.id = dm.nha_cung_cap_id
            LEFT JOIN kho k            ON k.id = dm.kho_nhap_id
            WHERE dm.trang_thai IN (3, 5)
              AND dm.ngay_giao_du_kien IS NOT NULL AND dm.ngay_giao_du_kien < :homNay
              AND (:khoId IS NULL OR dm.kho_nhap_id = :khoId)
              AND EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct
                           WHERE ct.don_mua_hang_id = dm.id AND ct.so_luong_dat > COALESCE(ct.so_luong_da_nhan, 0))
              AND NOT EXISTS (SELECT 1 FROM phieu_nhap_kho pn WHERE pn.don_mua_hang_id = dm.id AND pn.trang_thai = 0)
            ORDER BY dm.ngay_giao_du_kien, dm.id
            LIMIT 1
            """;

    /** Yêu cầu nhập hàng chờ duyệt (kho mẫu là kho của yêu cầu đầu). */
    static final String SQL_VIEC_YEU_CAU = """
            SELECT COUNT(*) OVER () AS tong, y.so_yeu_cau_mua_hang AS ma, NULL AS ten, k.ten_kho AS kho, NULL AS kho2,
                   y.ngay_tao AS moc, 0 AS so_phu, 0 AS so_phu2, y.kho_nhap_id AS kho_id
            FROM yeu_cau_mua_hang y
            LEFT JOIN kho k ON k.id = y.kho_nhap_id
            WHERE y.trang_thai = 1 AND (:khoId IS NULL OR y.kho_nhap_id = :khoId)
            ORDER BY y.ngay_tao, y.id
            LIMIT 1
            """;

    /** Kênh đang bật mà ủy quyền đã hết hạn (ten = tên kênh đầu, moc = lúc hết hạn). Kênh dùng mã cố định không có hạn. */
    static final String SQL_VIEC_KET_NOI = """
            SELECT COUNT(*) OVER () AS tong, kb.ma_kenh AS ma, kb.ten_kenh AS ten, NULL AS kho, NULL AS kho2,
                   kb.token_expires_at AS moc, 0 AS so_phu, 0 AS so_phu2, NULL AS kho_id
            FROM kenh_ban_hang kb
            WHERE kb.trang_thai = 1 AND kb.token_expires_at IS NOT NULL AND kb.token_expires_at < :bayGio
            ORDER BY kb.token_expires_at, kb.id
            LIMIT 1
            """;

    /**
     * Lỗi đẩy tồn lên kênh: mã đã có trên sàn (ma_san_pham_kenh) mà lần đồng bộ gần nhất thất bại; bỏ kênh đã tắt tự động
     * đẩy tồn và mã đã tắt đồng bộ. Lỗi khi tạo sản phẩm trên sàn (chưa có mã sàn) không tính.
     */
    static final String SQL_LOI_DONG_BO = """
            SELECT kb.id AS kenh_id, kb.ma_kenh, kb.ten_kenh, COUNT(*) AS so_loi
            FROM trang_thai_dong_bo_san_pham t
            JOIN kenh_ban_hang kb ON kb.id = t.kenh_ban_id AND kb.trang_thai = 1
            WHERE t.trang_thai_dong_bo = 'that_bai'
              AND t.ma_san_pham_kenh IS NOT NULL AND t.ma_san_pham_kenh <> ''
              {CHO_PHEP}
              AND NOT EXISTS (SELECT 1 FROM cau_hinh_he_thong ch
                               WHERE ch.ma_cau_hinh = CONCAT('KENH_', UPPER(REGEXP_REPLACE(kb.ma_kenh, '[^A-Za-z0-9]', '_')), '_TU_DONG_DAY_TON')
                                 AND LOWER(TRIM(ch.gia_tri)) IN ('false', '0'))
            GROUP BY kb.id, kb.ma_kenh, kb.ten_kenh
            ORDER BY so_loi DESC, kb.id
            """;

    public record LoiDongBoDong(Integer kenhId, String maKenh, String tenKenh, long soLoi) {}

    /** Lỗi đẩy tồn theo kênh (danh sách rỗng khi máy chưa có bảng đồng bộ). Kênh dùng chung cho mọi kho. */
    public List<LoiDongBoDong> loiDongBo() {
        if (!goc.coBang("trang_thai_dong_bo_san_pham") || !goc.coBang("kenh_ban_hang")) return List.of();
        String choPhep = goc.coCot("trang_thai_dong_bo_san_pham", "cho_phep_dong_bo")
                ? "AND COALESCE(t.cho_phep_dong_bo, 1) = 1" : "";
        return jdbc.query(SQL_LOI_DONG_BO.replace("{CHO_PHEP}", choPhep), new MapSqlParameterSource(),
                (rs, i) -> new LoiDongBoDong(rs.getInt("kenh_id"), rs.getString("ma_kenh"), rs.getString("ten_kenh"),
                        rs.getLong("so_loi")));
    }

    /** Các loại việc (trừ lỗi đồng bộ và hàng chưa có kệ, tính riêng), kho đang xem lọc theo kho của chứng từ. */
    public List<ViecDong> viec(Integer khoId, LocalDateTime bayGio) {
        MapSqlParameterSource p = thamSoViec(khoId, bayGio);
        List<ViecDong> ds = new ArrayList<>();
        ds.add(mot("khachYeuCauHuy", SQL_VIEC_HUY, p, false));
        if (goc.coCot("kenh_ban_hang", "token_expires_at")) ds.add(mot("matKetNoi", SQL_VIEC_KET_NOI, p, false));
        if (goc.coBang("thong_bao") && goc.coCot("thong_bao", "khoa_su_kien")) {
            ds.add(mot("sanBaoDaGiao", SQL_VIEC_SAN_GIAO, p, false));
        }
        ds.add(mot("donNhap", SQL_VIEC_NHAP, p, false));
        ds.add(mot("treHen", SQL_VIEC_TRE_HEN, p, false));
        if (goc.coBang("dot_kiem_ke_vi_tri")) ds.add(mot("kiemKeKhoaKe", SQL_VIEC_KIEM_KE_KHOA, p, false));
        ds.add(mot("choNhat", SQL_VIEC_DON_KHO, new MapSqlParameterSource(p.getValues()).addValue("tt", List.of(1, 2)), false));
        ds.add(mot("choDongGoi", SQL_VIEC_DON_KHO, new MapSqlParameterSource(p.getValues()).addValue("tt", List.of(7)), false));
        ds.add(mot("choGiao", SQL_VIEC_DON_KHO, new MapSqlParameterSource(p.getValues()).addValue("tt", List.of(8)), false));
        ds.add(mot("hangVeChoNhap", SQL_VIEC_NHAP_KHO, p, false));
        ds.add(mot("choChuyen", SQL_VIEC_CHO_CHUYEN, p, false));
        ds.add(mot("chenhLech", SQL_VIEC_LECH, p, false));
        if (goc.coBang("canh_bao")) ds.add(mot("hoanKe", SQL_VIEC_HOAN_KE, p, false));
        ds.add(mot("kiemKeChoDuyet", SQL_VIEC_KIEM_KE_DUYET, p, false));
        if (goc.coBang("bien_ban_tra_hang_ncc")) ds.add(mot("traNcc", SQL_VIEC_TRA_NCC, p, false));
        ds.add(mot("muaQuaHan", SQL_VIEC_MUA_QUA_HAN, p, false));
        ds.add(mot("yeuCauNhap", SQL_VIEC_YEU_CAU, p, false));
        return ds;
    }

    /* ======================================================================
     * HOẠT ĐỘNG GẦN ĐÂY
     * ====================================================================== */

    /**
     * Sự kiện trong [tu, now] (giờ Việt Nam, :tuVn), mỗi nhánh lọc sớm theo cột gốc rồi đổi giờ. Lọc kho: sự kiện chuyển kho
     * hiện ở cả kho gửi và kho nhận; khách trả hiện ở kho nhận hàng trả.
     */
    String sqlHoatDong() {
        StringBuilder sb = new StringBuilder("""
                SELECT * FROM (
                  SELECT CASE WHEN {LA_POS_D} = 1 THEN 'ban_quay' ELSE 'don_moi' END AS loai,
                         d.id, d.so_don_hang AS ma, DATE_ADD(d.ngay_dat_hang, INTERVAL :lech MINUTE) AS tg,
                         d.kho_xuat_id AS kho_id, k.ten_kho, NULL AS kho_id2, NULL AS ten_kho2, u.ho_ten AS nguoi,
                         kb.ma_kenh, kb.ten_kenh, d.tong_cong AS so_tien,
                         (SELECT COALESCE(SUM(ct.so_luong_dat), 0) FROM chi_tiet_don_ban_hang ct WHERE ct.don_ban_hang_id = d.id) AS so_luong,
                         NULL AS so_ma, CASE WHEN d.ghi_chu LIKE :coHuy THEN 1 ELSE 0 END AS co_huy, 0 AS co_loi,
                         NULL AS so_nhan, NULL AS trang_thai
                  FROM don_ban_hang d
                  LEFT JOIN kho k            ON k.id = d.kho_xuat_id
                  LEFT JOIN nguoi_dung u     ON u.id = d.nguoi_tao_id
                  LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
                  WHERE d.loai_chung_tu = 'don_ban_hang' AND d.ngay_dat_hang >= :tuLoc
                    AND (d.trang_thai <> 4 OR {LA_POS_D} = 0)
                    AND COALESCE(d.ghi_chu, '') NOT LIKE :coShopee
                    AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
                  UNION ALL
                  SELECT 'xuat', p.id, d.so_don_hang, DATE_ADD(p.ngay_xuat, INTERVAL :lech MINUTE), p.kho_id, k.ten_kho,
                         NULL, NULL, u.ho_ten, kb.ma_kenh, kb.ten_kenh, d.tong_cong,
                         (SELECT COALESCE(SUM(ct.so_luong_xuat), 0) FROM chi_tiet_phieu_xuat_kho ct
                           WHERE ct.phieu_xuat_kho_id = p.id AND ct.lo_hang_id IS NOT NULL),
                         NULL, 0, 0, NULL, NULL
                  FROM phieu_xuat_kho p
                  JOIN kho k                 ON k.id = p.kho_id
                  JOIN don_ban_hang d        ON d.id = p.don_ban_hang_id
                  LEFT JOIN nguoi_dung u     ON u.id = p.nguoi_xuat_id
                  LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
                  WHERE p.trang_thai = 3 AND p.loai_xuat = 'ban_hang' AND p.ngay_xuat >= :tuLoc
                    AND {LA_POS_P} = 0
                    AND (:khoId IS NULL OR p.kho_id = :khoId)
                  UNION ALL
                  SELECT 'huy', d.id, d.so_don_hang, DATE_ADD(d.ngay_cap_nhat, INTERVAL :lechCsdl MINUTE), d.kho_xuat_id, k.ten_kho,
                         NULL, NULL, NULL, kb.ma_kenh, kb.ten_kenh, d.tong_cong, NULL, NULL, 0, 0, NULL, NULL
                  FROM don_ban_hang d
                  LEFT JOIN kho k            ON k.id = d.kho_xuat_id
                  LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
                  WHERE d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 4 AND d.ngay_cap_nhat >= :tuCsdl
                    AND (:khoId IS NULL OR d.kho_xuat_id = :khoId)
                  UNION ALL
                  SELECT 'hoan', hoan.id, d.so_don_hang, hoan.tg, d.kho_xuat_id, k.ten_kho, NULL, NULL, NULL,
                         kb.ma_kenh, kb.ten_kenh, d.tong_cong,
                         (SELECT COALESCE(SUM(ct.so_luong_dat), 0) FROM chi_tiet_don_ban_hang ct WHERE ct.don_ban_hang_id = d.id),
                         NULL, 0, 0, NULL, NULL
                  FROM hoan
                  JOIN don_ban_hang d        ON d.id = hoan.id
                  LEFT JOIN kho k            ON k.id = d.kho_xuat_id
                  LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
                  WHERE hoan.tg >= :tuVn
                  UNION ALL
                  SELECT 'nhap_kho', p.id, p.so_phieu_nhap, DATE_ADD(p.ngay_nhap, INTERVAL :lech MINUTE), p.kho_id, k.ten_kho,
                         NULL, NULL, u.ho_ten, NULL, ncc.ten_nha_cung_cap, NULL,
                         (SELECT CASE WHEN SUM(ct.lo_hang_id IS NOT NULL) > 0
                                      THEN SUM(CASE WHEN ct.lo_hang_id IS NOT NULL THEN ct.so_luong_nhap ELSE 0 END)
                                      ELSE COALESCE(SUM(ct.so_luong_nhap), 0) END
                            FROM chi_tiet_phieu_nhap_kho ct WHERE ct.phieu_nhap_kho_id = p.id),
                         (SELECT COUNT(DISTINCT ct.bien_the_san_pham_id) FROM chi_tiet_phieu_nhap_kho ct WHERE ct.phieu_nhap_kho_id = p.id),
                         0, 0, NULL, NULL
                  FROM phieu_nhap_kho p
                  JOIN kho k                 ON k.id = p.kho_id
                  LEFT JOIN nguoi_dung u     ON u.id = p.nguoi_nhap_id
                  LEFT JOIN nha_cung_cap ncc ON ncc.id = p.nha_cung_cap_id
                  WHERE p.trang_thai = 3 AND p.ngay_nhap >= :tuLoc AND p.phieu_chuyen_kho_id IS NULL
                    AND p.so_phieu_nhap NOT LIKE 'PN-RET%'
                    AND (:khoId IS NULL OR p.kho_id = :khoId)
                  UNION ALL
                  SELECT 'chuyen', pck.id, pck.so_phieu_chuyen, DATE_ADD(p.ngay_xuat, INTERVAL :lech MINUTE),
                         pck.kho_xuat_id, kx.ten_kho, pck.kho_nhap_id, kn.ten_kho, u.ho_ten, NULL, NULL, NULL,
                         (SELECT COALESCE(SUM(ct.so_luong_xuat), 0) FROM chi_tiet_phieu_xuat_kho ct
                           WHERE ct.phieu_xuat_kho_id = p.id AND ct.lo_hang_id IS NOT NULL),
                         NULL, 0, 0, NULL, NULL
                  FROM phieu_xuat_kho p
                  JOIN phieu_chuyen_kho pck ON pck.id = p.phieu_chuyen_kho_id
                  JOIN kho kx               ON kx.id = pck.kho_xuat_id
                  JOIN kho kn               ON kn.id = pck.kho_nhap_id
                  LEFT JOIN nguoi_dung u    ON u.id = p.nguoi_xuat_id
                  WHERE p.trang_thai = 3 AND p.loai_xuat = 'chuyen_kho' AND p.ngay_xuat >= :tuLoc
                    AND (:khoId IS NULL OR pck.kho_xuat_id = :khoId OR pck.kho_nhap_id = :khoId)
                  UNION ALL
                  SELECT CASE WHEN pck.trang_thai = 'CHO_XU_LY_LECH' THEN 'nhan_thieu' ELSE 'nhan_du' END,
                         pck.id, pck.so_phieu_chuyen, DATE_ADD(pck.ngay_thuc_te_den, INTERVAL :lech MINUTE),
                         pck.kho_nhap_id, kn.ten_kho, pck.kho_xuat_id, kx.ten_kho,
                         (SELECT u.ho_ten FROM phieu_nhap_kho pn JOIN nguoi_dung u ON u.id = pn.nguoi_nhap_id
                           WHERE pn.phieu_chuyen_kho_id = pck.id ORDER BY pn.id DESC LIMIT 1),
                         NULL, NULL, NULL,
                         COALESCE((SELECT SUM(c.so_luong_gui) FROM chi_tiet_bien_ban_giao_nhan c JOIN bien_ban_giao_nhan b ON b.id = c.bien_ban_id
                                    WHERE b.phieu_chuyen_kho_id = pck.id),
                                  (SELECT SUM(ct.so_luong_chuyen) FROM chi_tiet_phieu_chuyen_kho ct WHERE ct.phieu_chuyen_kho_id = pck.id)),
                         NULL, 0, 0,
                         COALESCE((SELECT SUM(c.so_luong_nhan) FROM chi_tiet_bien_ban_giao_nhan c JOIN bien_ban_giao_nhan b ON b.id = c.bien_ban_id
                                    WHERE b.phieu_chuyen_kho_id = pck.id),
                                  (SELECT SUM(ct.so_luong_chuyen) FROM chi_tiet_phieu_chuyen_kho ct WHERE ct.phieu_chuyen_kho_id = pck.id)),
                         NULL
                  FROM phieu_chuyen_kho pck
                  JOIN kho kx ON kx.id = pck.kho_xuat_id
                  JOIN kho kn ON kn.id = pck.kho_nhap_id
                  WHERE pck.trang_thai IN ('HOAN_TAT', 'CHO_XU_LY_LECH') AND pck.ngay_thuc_te_den >= :tuLoc
                    AND (:khoId IS NULL OR pck.kho_xuat_id = :khoId OR pck.kho_nhap_id = :khoId)
                  UNION ALL
                  SELECT 'kiem_ke', dk.id, dk.ma_dot_kiem_ke, DATE_ADD(dk.ngay_hoan_thanh, INTERVAL :lech MINUTE),
                         dk.kho_id, k.ten_kho, NULL, NULL, u.ho_ten, NULL, dk.ten_dot_kiem_ke, NULL, NULL, NULL, 0, 0, NULL,
                         CAST(dk.trang_thai AS CHAR)
                  FROM dot_kiem_ke dk
                  JOIN kho k             ON k.id = dk.kho_id
                  LEFT JOIN nguoi_dung u ON u.id = dk.nguoi_chu_tri_id
                  WHERE dk.trang_thai IN (2, 3) AND dk.ngay_hoan_thanh >= :tuLoc
                    AND (:khoId IS NULL OR dk.kho_id = :khoId)
                """);
        if (coTraQuay()) {
            sb.append("""
                      UNION ALL
                      SELECT 'tra_quay', pth.id, d.so_don_hang, DATE_ADD(pth.ngay_tao, INTERVAL :lech MINUTE),
                             pth.kho_nhan_id, k.ten_kho, NULL, NULL, u.ho_ten, NULL, NULL, pth.tong_tien_hoan, pth.tong_so_luong,
                             NULL, 0, CASE WHEN pth.so_luong_loi > 0 THEN 1 ELSE 0 END, NULL, NULL
                      FROM phieu_tra_hang pth
                      JOIN don_ban_hang d    ON d.id = pth.don_ban_hang_id
                      JOIN kho k             ON k.id = pth.kho_nhan_id
                      LEFT JOIN nguoi_dung u ON u.id = pth.nguoi_lap_id
                      WHERE pth.ngay_tao >= :tuLoc AND (:khoId IS NULL OR pth.kho_nhan_id = :khoId)
                    """);
        }
        sb.append("""
                ) x
                WHERE x.tg >= :tuVn AND x.tg <= :bayGioVn
                ORDER BY x.tg DESC, x.id DESC
                LIMIT :soDong
                """);
        return sb.toString().replace("{LA_POS_D}", laPos("d.id")).replace("{LA_POS_P}", laPos("p.don_ban_hang_id"));
    }

    /** Sự kiện từ :tu tới :bayGio (giờ Việt Nam), mới nhất trước, tối đa soDong. */
    public List<SuKienDong> hoatDong(Integer khoId, LocalDateTime tu, LocalDateTime bayGio, int soDong) {
        // Bảng "hoan" cần bảng sự kiện doanh thu với khoảng [tu, bayGio]
        String sql = "WITH " + cteSuKien() + sqlHoatDong();
        MapSqlParameterSource p = thamSoSuKien(khoId, tu, bayGio.plusSeconds(1))
                .addValue("bayGioVn", chuoi(bayGio))
                .addValue("coHuy", "%" + CO_YEU_CAU_HUY + "%")
                .addValue("coShopee", "%" + CO_SHOPEE_CHO_XAC_NHAN + "%")
                .addValue("soDong", soDong);
        return jdbc.query(sql, p, (rs, i) -> {
            LocalDateTime t = rs.getObject("tg", LocalDateTime.class);
            Object soMa = rs.getObject("so_ma");
            return new SuKienDong(rs.getString("loai"), rs.getInt("id"), rs.getString("ma"),
                    t,
                    (Integer) rs.getObject("kho_id", Integer.class), rs.getString("ten_kho"),
                    (Integer) rs.getObject("kho_id2", Integer.class), rs.getString("ten_kho2"),
                    rs.getString("nguoi"), rs.getString("ma_kenh"), rs.getString("ten_kenh"),
                    rs.getBigDecimal("so_tien"), rs.getBigDecimal("so_luong"),
                    soMa == null ? null : ((Number) soMa).longValue(),
                    rs.getInt("co_huy") == 1, rs.getInt("co_loi") == 1, rs.getBigDecimal("so_nhan"),
                    rs.getString("trang_thai"));
        });
    }

    /* ======================================================================
     * TIỆN ÍCH
     * ====================================================================== */

    static String chuoi(LocalDateTime t) {
        return t.format(DINH_DANG_GIO);
    }

    /** Cột số nguyên chỉ một vài truy vấn có: không có cột thì null. */
    private static Integer soNguyenNeuCo(ResultSet rs, String cot) throws SQLException {
        java.sql.ResultSetMetaData md = rs.getMetaData();
        for (int i = 1; i <= md.getColumnCount(); i++) {
            if (cot.equalsIgnoreCase(md.getColumnLabel(i))) return (Integer) rs.getObject(i, Integer.class);
        }
        return null;
    }

    private static BigDecimal bd(ResultSet rs, String cot) throws SQLException {
        BigDecimal v = rs.getBigDecimal(cot);
        return v == null ? BigDecimal.ZERO : v;
    }
}
