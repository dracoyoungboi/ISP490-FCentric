package com.dev.backend.services.impl.multitable;

import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.LoHang;
import com.dev.backend.entities.TonKhoTheoLo;
import com.dev.backend.repository.ChiTietPhieuChuyenKhoRepository;
import com.dev.backend.repository.TonKhoTongHopRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Giữ chỗ phiếu chuyển khi PX-CK có phiếu nhặt (đặc tả bước 8–9): chạy đúng câu SQL native của
 * ChiTietPhieuChuyenKhoRepository.giuChoTheoBienTheVaKho và TonKhoTongHopRepository.giuChoChuyenKhoToanChuoi trên H2
 * (chế độ MySQL, trong bộ nhớ, không nối CSDL thật), qua các bước Chờ duyệt → phiếu nhặt mở (chờ / đang nhặt, lô đủ hoặc
 * hụt) → đã nhặt (lô ghi vào PX-CK) → hủy, rồi ghép với công thức số bán tại quầy (trừ phân bổ phiếu nhặt theo lô) và
 * tồn đẩy sàn (không trừ phân bổ): hàng chuyển bị trừ ĐÚNG MỘT LẦN ở mọi bước — không trừ hai lần, không hụt.
 * Kho 1, phiếu chuyển 50 chuyển 10 cái mã 93; lô 5 tồn 6, lô 6 tồn 24 (tổng 30) → luôn còn bán được 20.
 */
class GiuChoChuyenKhoPhieuNhatSqlTest {

    private static final int KHO = 1, BT = 93;

    private Connection db;
    private final BienTheSanPham bienThe = BienTheSanPham.builder().id(BT).build();

    @BeforeEach
    void taoBang() throws SQLException {
        db = DriverManager.getConnection("jdbc:h2:mem:giu_cho_" + System.nanoTime() + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
        chay("""
            CREATE TABLE kho (id INT PRIMARY KEY, trang_thai INT, ma_kho VARCHAR(50));
            CREATE TABLE phieu_chuyen_kho (id INT PRIMARY KEY, kho_xuat_id INT, trang_thai VARCHAR(30));
            CREATE TABLE chi_tiet_phieu_chuyen_kho (id INT PRIMARY KEY, phieu_chuyen_kho_id INT, bien_the_san_pham_id INT,
                                                    so_luong_chuyen INT);
            CREATE TABLE phieu_xuat_kho (id INT PRIMARY KEY, phieu_chuyen_kho_id INT, loai_xuat VARCHAR(30), trang_thai INT);
            CREATE TABLE chi_tiet_phieu_xuat_kho (id INT AUTO_INCREMENT PRIMARY KEY, phieu_xuat_kho_id INT,
                                                  bien_the_san_pham_id INT, lo_hang_id INT, so_luong_xuat DECIMAL(15, 3));
            CREATE TABLE danh_sach_nhat_hang (id INT PRIMARY KEY, phieu_xuat_kho_id INT, trang_thai VARCHAR(30));
            CREATE TABLE chi_tiet_nhat_hang (id INT PRIMARY KEY, danh_sach_nhat_hang_id INT, bien_the_san_pham_id INT);
            CREATE TABLE phan_bo_lo_nhat_hang (id INT AUTO_INCREMENT PRIMARY KEY, chi_tiet_nhat_hang_id INT, lo_hang_id INT,
                                               so_luong DECIMAL(15, 3));
            INSERT INTO kho VALUES (1, 1, 'KHO_TONG');
            INSERT INTO phieu_chuyen_kho VALUES (50, 1, 'CHO_DUYET');
            INSERT INTO chi_tiet_phieu_chuyen_kho VALUES (1, 50, 93, 10);
            """);
    }

    @AfterEach
    void dong() throws SQLException {
        db.close();
    }

    // ── Các bước của phiếu chuyển ──

    /** Duyệt: PX-CK nháp (dòng gốc chưa chọn lô) + phiếu nhặt chờ nhặt, phân bổ lô theo {@code phanBo} [lô, số]. */
    private void duyet(int[]... phanBo) throws SQLException {
        chay("""
            UPDATE phieu_chuyen_kho SET trang_thai = 'DA_DUYET' WHERE id = 50;
            INSERT INTO phieu_xuat_kho VALUES (60, 50, 'chuyen_kho', 0);
            INSERT INTO chi_tiet_phieu_xuat_kho (phieu_xuat_kho_id, bien_the_san_pham_id, lo_hang_id, so_luong_xuat)
                VALUES (60, 93, NULL, 10);
            INSERT INTO danh_sach_nhat_hang VALUES (80, 60, 'cho_nhat');
            INSERT INTO chi_tiet_nhat_hang VALUES (1, 80, 93);
            """);
        for (int[] pb : phanBo) {
            chay("INSERT INTO phan_bo_lo_nhat_hang (chi_tiet_nhat_hang_id, lo_hang_id, so_luong) VALUES (1, "
                    + pb[0] + ", " + pb[1] + ")");
        }
    }

    /** Hoàn tất nhặt: lô đã nhặt ghi vào PX-CK (cộng đã đặt ở tồn), phiếu nhặt Đã nhặt; phân bổ cũ còn nguyên. */
    private void hoanTatNhat() throws SQLException {
        chay("""
            UPDATE danh_sach_nhat_hang SET trang_thai = 'da_nhat' WHERE id = 80;
            INSERT INTO chi_tiet_phieu_xuat_kho (phieu_xuat_kho_id, bien_the_san_pham_id, lo_hang_id, so_luong_xuat)
                SELECT 60, 93, lo_hang_id, so_luong FROM phan_bo_lo_nhat_hang WHERE chi_tiet_nhat_hang_id = 1;
            """);
    }

    // ── Số giữ chỗ theo đúng câu SQL của repository ──

    /** giuChoTheoBienTheVaKho ở kho 1: {@code truPhanBoNhat} = false là giữ đủ, true là phần ngoài phiếu nhặt mở. */
    private BigDecimal giuChoTaiKho(boolean truPhanBoNhat) throws Exception {
        String sql = sqlCua(ChiTietPhieuChuyenKhoRepository.class.getMethod("giuChoTheoBienTheVaKho",
                Collection.class, Integer.class, Integer.class, boolean.class))
                .replace(":truPhanBoNhat", truPhanBoNhat ? "TRUE" : "FALSE")
                .replace(":boQua", "NULL").replace(":khoId", String.valueOf(KHO)).replace(":ids", String.valueOf(BT));
        return tongCot(sql, 3);
    }

    /** giuChoChuyenKhoToanChuoi (tồn đẩy sàn): giữ đủ. */
    private BigDecimal giuChoToanChuoi() throws Exception {
        String sql = sqlCua(TonKhoTongHopRepository.class.getMethod("giuChoChuyenKhoToanChuoi", List.class))
                .replace(":bienTheIds", String.valueOf(BT));
        return tongCot(sql, 2);
    }

    // ── Hai nơi tính khả dụng ──

    /**
     * Số bán tại quầy (BanDuocTaiQuayService.banDuoc): trừ phân bổ phiếu nhặt mở theo lô nên giữ chỗ chỉ lấy phần ngoài
     * phiếu nhặt. Tồn: lô 5 = 6, lô 6 = 24; đã đặt theo lô = dòng lô của PX-CK nháp.
     */
    private BigDecimal banTaiQuay() throws Exception {
        Map<Integer, BigDecimal> daDat = theoLo("""
            SELECT c.lo_hang_id, SUM(c.so_luong_xuat) FROM chi_tiet_phieu_xuat_kho c
            JOIN phieu_xuat_kho px ON px.id = c.phieu_xuat_kho_id AND px.trang_thai = 0
            WHERE c.lo_hang_id IS NOT NULL GROUP BY c.lo_hang_id""");
        Map<Integer, BigDecimal> phanBoMo = theoLo("""
            SELECT pb.lo_hang_id, SUM(pb.so_luong) FROM phan_bo_lo_nhat_hang pb
            JOIN chi_tiet_nhat_hang cn ON cn.id = pb.chi_tiet_nhat_hang_id
            JOIN danh_sach_nhat_hang ds ON ds.id = cn.danh_sach_nhat_hang_id AND ds.trang_thai IN ('cho_nhat', 'dang_nhat')
            GROUP BY pb.lo_hang_id""");
        List<TonKhoTheoLo> lo = List.of(ton(5, "6", daDat), ton(6, "24", daDat));
        return BanDuocTaiQuayService.banDuoc(lo, phanBoMo, giuChoTaiKho(true));
    }

    /** Tồn đẩy sàn của kho (TonKhoTongHopRepository): Σ (tồn − đã đặt), không trừ phân bổ phiếu nhặt, trừ giữ chỗ đủ. */
    private BigDecimal dayLenSan() throws Exception {
        BigDecimal daDat = tongCot("""
            SELECT 0, COALESCE(SUM(c.so_luong_xuat), 0) FROM chi_tiet_phieu_xuat_kho c
            JOIN phieu_xuat_kho px ON px.id = c.phieu_xuat_kho_id AND px.trang_thai = 0
            WHERE c.lo_hang_id IS NOT NULL""", 2);
        return new BigDecimal("30").subtract(daDat).subtract(giuChoToanChuoi()).max(BigDecimal.ZERO);
    }

    // ══════════════════════════ Các bước ══════════════════════════

    @Test
    @DisplayName("Chờ duyệt: giữ chỗ đủ 10 ở cả hai biến thể (chưa có phiếu nhặt); bán được 20, đẩy sàn 20")
    void choDuyet() throws Exception {
        assertSo("10", giuChoTaiKho(false));
        assertSo("10", giuChoTaiKho(true));
        assertSo("10", giuChoToanChuoi());
        assertSo("20", banTaiQuay());
        assertSo("20", dayLenSan());
    }

    @Test
    @DisplayName("Phiếu nhặt chờ nhặt / đang nhặt, phân bổ đủ: giữ đủ 10, ngoài phiếu nhặt 0 (lô đã giữ qua phân bổ); vẫn 20 / 20")
    void phieuNhatMo_phanBoDu() throws Exception {
        duyet(new int[]{5, 6}, new int[]{6, 4});
        for (String tt : List.of("cho_nhat", "dang_nhat")) {
            chay("UPDATE danh_sach_nhat_hang SET trang_thai = '" + tt + "' WHERE id = 80");
            assertSo("10", giuChoTaiKho(false));
            assertSo("0", giuChoTaiKho(true));
            assertSo("10", giuChoToanChuoi());
            assertSo("20", banTaiQuay());
            assertSo("20", dayLenSan());
        }
    }

    @Test
    @DisplayName("Phiếu nhặt mở nhưng lô hụt lúc duyệt (phân bổ 6/10): ngoài phiếu nhặt còn giữ 4 — không hụt chỗ giữ")
    void phieuNhatMo_phanBoHut() throws Exception {
        duyet(new int[]{5, 6});
        assertSo("10", giuChoTaiKho(false));
        assertSo("4", giuChoTaiKho(true));
        assertSo("20", banTaiQuay());
        assertSo("20", dayLenSan());
    }

    @Test
    @DisplayName("Đã nhặt: lô nằm trên PX-CK (đã đặt), phân bổ không còn mở → giữ chỗ 0 ở cả hai biến thể; vẫn 20 / 20")
    void daNhat_loTrenPhieuXuat() throws Exception {
        duyet(new int[]{5, 6}, new int[]{6, 4});
        hoanTatNhat();
        assertSo("0", giuChoTaiKho(false));
        assertSo("0", giuChoTaiKho(true));
        assertSo("0", giuChoToanChuoi());
        assertSo("20", banTaiQuay());
        assertSo("20", dayLenSan());
    }

    @Test
    @DisplayName("Hủy phiếu chuyển (phiếu nhặt, PX-CK hủy theo): hết giữ chỗ, trả đủ 30 / 30")
    void huy_traHet() throws Exception {
        duyet(new int[]{5, 6}, new int[]{6, 4});
        hoanTatNhat();
        chay("""
            UPDATE phieu_chuyen_kho SET trang_thai = 'DA_HUY' WHERE id = 50;
            UPDATE danh_sach_nhat_hang SET trang_thai = 'da_huy' WHERE id = 80;
            UPDATE phieu_xuat_kho SET trang_thai = 4 WHERE id = 60;
            """);
        assertSo("0", giuChoTaiKho(false));
        assertSo("0", giuChoToanChuoi());
        assertSo("30", banTaiQuay());
        assertSo("30", dayLenSan());
    }

    @Test
    @DisplayName("Phiếu nhặt của phiếu chuyển KHÁC không được trừ vào giữ chỗ phiếu này")
    void phanBoCuaPhieuKhac_khongTru() throws Exception {
        duyet(new int[]{5, 6}, new int[]{6, 4});
        chay("""
            INSERT INTO phieu_chuyen_kho VALUES (51, 1, 'CHO_DUYET');
            INSERT INTO chi_tiet_phieu_chuyen_kho VALUES (2, 51, 93, 5);
            """);
        assertSo("15", giuChoTaiKho(false));
        assertSo("5", giuChoTaiKho(true), "phiếu 51 chưa có phiếu nhặt: giữ đủ 5; phiếu 50 đã nằm trong phân bổ");
    }

    // ── Tiện ích ──

    private void chay(String sql) throws SQLException {
        try (Statement st = db.createStatement()) {
            for (String cau : sql.split(";")) {
                if (!cau.isBlank()) st.execute(cau);
            }
        }
    }

    private static String sqlCua(java.lang.reflect.Method m) {
        Query q = m.getAnnotation(Query.class);
        assertNotNull(q, m.getName());
        assertTrue(q.nativeQuery(), m.getName());
        return q.value();
    }

    /** Tổng cột {@code cot} (bắt đầu 1) của mọi dòng; không có dòng → 0. */
    private BigDecimal tongCot(String sql, int cot) throws SQLException {
        BigDecimal tong = BigDecimal.ZERO;
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                BigDecimal v = rs.getBigDecimal(cot);
                if (v != null) tong = tong.add(v);
            }
        }
        return tong;
    }

    private Map<Integer, BigDecimal> theoLo(String sql) throws SQLException {
        Map<Integer, BigDecimal> kq = new HashMap<>();
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) kq.put(rs.getInt(1), rs.getBigDecimal(2));
        }
        return kq;
    }

    private TonKhoTheoLo ton(int loId, String tonKho, Map<Integer, BigDecimal> daDat) {
        return TonKhoTheoLo.builder().loHang(LoHang.builder().id(loId).bienTheSanPham(bienThe).build())
                .soLuongTon(new BigDecimal(tonKho)).soLuongDaDat(daDat.getOrDefault(loId, BigDecimal.ZERO)).build();
    }

    private static void assertSo(String expected, BigDecimal actual) {
        assertSo(expected, actual, null);
    }

    private static void assertSo(String expected, BigDecimal actual, String moTa) {
        assertNotNull(actual);
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
                (moTa == null ? "" : moTa + ": ") + "expected " + expected + " but was " + actual);
    }
}
