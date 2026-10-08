package com.dev.backend.pos;

import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.services.impl.entities.PhieuXuatKhoService;
import com.dev.backend.services.impl.utils.JwtServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TEST TÍCH HỢP THẬT cho checkout POS (Phase 05) — backend khởi động đầy đủ
 * (webEnvironment=RANDOM_PORT), HTTP thật với TestRestTemplate (kết nối độc lập),
 * transaction/lock THẬT trên MySQL — KHÔNG dùng mock, KHÔNG dùng H2 thay thế.
 *
 * Yêu cầu schema MySQL DÙNG MỘT LẦN (xem docs/pos/05-test-report.md):
 *   jdbc:mysql://127.0.0.1:3307/fcentric_pos_test (root, mật khẩu rỗng)
 * — do chính quy trình test khởi tạo bằng mysqld --initialize-insecure trong thư mục
 * tạm; KHÔNG đụng MySQL đang chạy của máy, KHÔNG đụng dev/production.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PosCheckoutIntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String base = System.getProperty("pos.it.db.url",
                "jdbc:mysql://127.0.0.1:3307/fcentric_pos_test?allowMultiQueries=true&useSSL=false&serverTimezone=UTC&characterEncoding=UTF-8&tinyInt1isBit=false");
        registry.add("spring.datasource.url", () -> base);
        registry.add("spring.datasource.username", () -> System.getProperty("pos.it.db.user", "root"));
        registry.add("spring.datasource.password", () -> System.getProperty("pos.it.db.pass", ""));
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        registry.add("pos.checkout-enabled", () -> "true"); // chỉ bật trong test
        registry.add("spring.jpa.show-sql", () -> System.getProperty("pos.it.showsql", "false"));
        registry.add("logging.level.org.hibernate.SQL", () -> "DEBUG");
        registry.add("logging.level.org.hibernate.orm.jdbc.bind", () -> "TRACE");
    }

    @Autowired
    private TestRestTemplate rest;
    @Autowired
    private JwtServiceImpl jwtService;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private PhieuXuatKhoService phieuXuatKhoService;
    @Autowired
    private ObjectMapper objectMapper;

    private Integer adminId;
    private String adminToken;

    private static int cashierSeq = 0;

    // ================= fixtures =================

    @BeforeEach
    void resetDb() {
        jdbc.execute("DELETE FROM pos_payment");
        jdbc.execute("DELETE FROM pos_checkout_request");
        jdbc.execute("DELETE FROM chi_tiet_phieu_xuat_kho");
        jdbc.execute("DELETE FROM phieu_xuat_kho");
        jdbc.execute("DELETE FROM chi_tiet_don_ban_hang");
        jdbc.execute("DELETE FROM don_ban_hang");
        jdbc.execute("DELETE FROM lich_su_giao_dich_kho");
        // dọn thu ngân do test tạo ở các lần chạy trước (phan_quyen cascade theo)
        jdbc.execute("DELETE FROM nguoi_dung WHERE ten_dang_nhap LIKE 'poscashier%'");
        jdbc.execute("UPDATE ton_kho_theo_lo SET so_luong_ton = CASE lo_hang_id "
                + "WHEN 69 THEN 3.000 WHEN 70 THEN 1.000 WHEN 71 THEN 1.000 ELSE so_luong_ton END, "
                + "so_luong_da_dat = 0.000, ngay_xuat_gan_nhat = NULL");
        // khôi phục trạng thái baseline của fixture (phòng luồng recalculatePriceAndStatus
        // của legacy thay đổi trạng thái sản phẩm/biến thể khi có tồn kho thay đổi)
        jdbc.execute("UPDATE bien_the_san_pham SET trang_thai = CASE id WHEN 93 THEN 1 ELSE 0 END");
        jdbc.execute("UPDATE san_pham_quan_ao SET trang_thai = CASE id WHEN 59 THEN 1 ELSE trang_thai END");
    }

    private String tokenFor(Integer userId, String login, String name, String role, Integer khoId, String permissionMaQuyen) {
        List<PhanQuyenNguoiDungKhoDto> permissions = new ArrayList<>();
        if (khoId != null) {
            PhanQuyenNguoiDungKhoDto dto = PhanQuyenNguoiDungKhoDto.builder()
                    .nguoiDung(NguoiDungDto.builder().id(userId).tenDangNhap(login).hoTen(name).build())
                    .kho(KhoDto.builder().id(khoId).maKho("KHO0" + khoId).tenKho("Kho test").build())
                    .laQuanLyKho(0)
                    .trangThai(1)
                    .ngayBatDau(null)
                    .ngayKetThuc(null)
                    .build();
            permissions.add(dto);
        }
        return "Bearer " + jwtService.generateTokenWithPermissions(
                userId, login, name, login + "@pos.test", "",
                Set.of(role), 1, Instant.now(), Instant.now(), permissions, "pos-it");
    }

    private String adminToken() {
        if (adminId == null) {
            adminId = jdbc.queryForObject(
                    "SELECT id FROM nguoi_dung WHERE vai_tro = 'quan_tri_vien' AND trang_thai = 1 ORDER BY id LIMIT 1",
                    Integer.class);
        }
        return "Bearer " + jwtService.generateTokenWithPermissions(
                adminId, "admin-it", "Admin IT", "admin-it@pos.test", "",
                Set.of("quan_tri_vien"), 1, Instant.now(), Instant.now(), List.of(), "pos-it");
    }

    /** Tạo thu ngân thật trong DB test + phân quyền kho (nếu khoId != null) + token. */
    private String createCashier(String role, Integer khoId) {
        int seq = ++cashierSeq;
        String login = "poscashier" + System.currentTimeMillis() + "_" + seq;
        jdbc.update("INSERT INTO nguoi_dung (ten_dang_nhap, mat_khau_hash, ho_ten, email, vai_tro, trang_thai) "
                + "VALUES (?, 'x', ?, ?, ?, 1)", login, "Thu ngân " + seq, login + "@pos.test", role);
        Integer userId = jdbc.queryForObject("SELECT id FROM nguoi_dung WHERE ten_dang_nhap = ?", Integer.class, login);
        if (khoId != null) {
            jdbc.update("INSERT INTO phan_quyen_nguoi_dung_kho (nguoi_dung_id, kho_id, la_quan_ly_kho, trang_thai, ghi_chu) "
                    + "VALUES (?, ?, 0, 1, 'pos-it')", userId, khoId);
        }
        return tokenFor(userId, login, "Thu ngân " + seq, role, khoId, null);
    }

    private Integer khachHangId() {
        return jdbc.queryForObject(
                "SELECT id FROM khach_hang WHERE trang_thai = 1 ORDER BY id LIMIT 1", Integer.class);
    }

    private ResponseEntity<Map> postCheckout(String token, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token.replace("Bearer ", ""));
        return rest.exchange("/api/v1/pos/checkout", HttpMethod.POST,
                new HttpEntity<>(body, headers), Map.class);
    }

    private Map<String, Object> checkoutBody(String requestId, int variantId, int qty, long unitPrice,
                                             long tendered, Integer khachId) {
        return Map.of(
                "requestId", requestId,
                "khoId", 1,
                "khachHangId", khachId,
                "items", List.of(Map.of("bienTheSanPhamId", variantId, "quantity", qty, "unitPriceClient", unitPrice)),
                "payment", Map.of("method", "CASH", "tenderedAmount", tendered),
                "note", "");
    }

    private BigDecimal available93() {
        return jdbc.queryForObject(
                "SELECT COALESCE(SUM(so_luong_ton - so_luong_da_dat), 0) FROM ton_kho_theo_lo t "
                        + "JOIN lo_hang l ON l.id = t.lo_hang_id WHERE t.kho_id = 1 AND l.bien_the_san_pham_id = 93",
                BigDecimal.class);
    }

    private BigDecimal catalogStock93(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.replace("Bearer ", ""));
        ResponseEntity<Map> res = rest.exchange("/api/v1/pos/catalog?khoId=1&q=&page=0&size=120",
                HttpMethod.GET, new HttpEntity<>(headers), Map.class);
        Map<String, Object> data = (Map<String, Object>) res.getBody().get("data");
        List<Map<String, Object>> content = (List<Map<String, Object>>) data.get("content");
        Map<String, Object> item = content.stream()
                .filter(i -> ((Number) i.get("bienTheSanPhamId")).intValue() == 93)
                .findFirst().orElse(null);
        return item == null ? null : new BigDecimal(String.valueOf(item.get("soLuongKhaDung")));
    }

    // ================= TESTS =================

    @Test
    void t01_fixture_kho1_sku93_gia120000_ton5() {
        assertEquals(0, new BigDecimal("5").compareTo(available93()));
        assertEquals(0, new BigDecimal("5").compareTo(catalogStock93(adminToken())));
        Integer price = jdbc.queryForObject("SELECT gia_ban FROM bien_the_san_pham WHERE id = 93", Integer.class);
        assertEquals(120000, price);
    }


    @Test
    void t02_thanhCong_ban1_thu200000_ghiDuChungTu() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        Integer khach = khachHangId();
        ResponseEntity<Map> res = postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 200000, khach));

        assertEquals(HttpStatus.OK, res.getStatusCode(), "body: " + res.getBody());
        Map<String, Object> data = (Map<String, Object>) res.getBody().get("data");
        int donId = ((Number) data.get("donBanHangId")).intValue();
        assertEquals(0, new BigDecimal("120000").compareTo(new BigDecimal(String.valueOf(data.get("tongCong")))));
        assertEquals(0, new BigDecimal("80000").compareTo(new BigDecimal(String.valueOf(data.get("soTienThua")))));

        // 1 đơn, trạng thái 5, thanh toán rồi, ngày giao, loai don_ban_hang
        Map<String, Object> don = jdbc.queryForMap("SELECT * FROM don_ban_hang WHERE id = ?", donId);
        assertEquals("don_ban_hang", don.get("loai_chung_tu"));
        assertEquals(5, ((Number) don.get("trang_thai")).intValue());
        assertEquals("da_thanh_toan", don.get("trang_thai_thanh_toan"));
        assertNotNull(don.get("ngay_giao_hang"));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));

        // 1 phiếu xuất hoàn thành + dòng lô đúng (FIFO: lô 69 nhập sớm nhất)
        Map<String, Object> px = jdbc.queryForMap("SELECT * FROM phieu_xuat_kho");
        assertEquals("ban_hang", px.get("loai_xuat"));
        assertEquals(3, ((Number) px.get("trang_thai")).intValue());
        Integer pickCount = jdbc.queryForObject("SELECT COUNT(*) FROM chi_tiet_phieu_xuat_kho", Integer.class);
        assertEquals(1, pickCount);
        Integer lotId = jdbc.queryForObject("SELECT lo_hang_id FROM chi_tiet_phieu_xuat_kho", Integer.class);
        assertEquals(69, lotId);

        // tồn 69: 3 -> 2, khả dụng tổng 4
        assertEquals(0, new BigDecimal("4").compareTo(available93()));
        assertEquals(0, new BigDecimal("2.000").compareTo(jdbc.queryForObject(
                "SELECT so_luong_ton FROM ton_kho_theo_lo WHERE id = 72", BigDecimal.class)));
        assertEquals(0, new BigDecimal("4").compareTo(catalogStock93(adminToken())));

        // nhật ký kho 1 dòng xuat_kho truoc3 sau2
        Map<String, Object> journal = jdbc.queryForMap("SELECT * FROM lich_su_giao_dich_kho");
        assertEquals("xuat_kho", journal.get("loai_giao_dich"));
        assertEquals("phieu_xuat_kho", journal.get("loai_tham_chieu"));
        assertEquals(0, new BigDecimal("3").compareTo((BigDecimal) journal.get("so_luong_truoc")));
        assertEquals(0, new BigDecimal("2").compareTo((BigDecimal) journal.get("so_luong_sau")));

        // phiếu thu: doanh thu 120000, thu 200000, thừa 80000
        Map<String, Object> pay = jdbc.queryForMap("SELECT * FROM pos_payment");
        assertEquals("CASH", pay.get("phuong_thuc"));
        assertEquals(0, new BigDecimal("120000").compareTo((BigDecimal) pay.get("so_tien_hang")));
        assertEquals(0, new BigDecimal("80000").compareTo((BigDecimal) pay.get("so_tien_thua")));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM pos_payment", Integer.class));
        assertEquals("SUCCESS", jdbc.queryForObject("SELECT trang_thai FROM pos_checkout_request", String.class));
    }

    @Test
    void t03_mua6_khiTon5_tuChoi_khongSideEffect() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        Integer khach = khachHangId();
        ResponseEntity<Map> res = postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 93, 6, 120000, 720000, khach));

        // Thiếu hàng: 409 có cấu trúc {insufficient: [{bienTheSanPhamId, conLai}]}
        assertEquals(HttpStatus.CONFLICT, res.getStatusCode());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("không đủ"));
        List<Map<String, Object>> insufficient = (List<Map<String, Object>>) ((Map<String, Object>) res.getBody().get("data")).get("insufficient");
        assertEquals(93, ((Number) insufficient.get(0).get("bienTheSanPhamId")).intValue());
        assertEquals(0, new BigDecimal("5").compareTo(new BigDecimal(String.valueOf(insufficient.get(0).get("conLai")))));
        assertEquals(0, new BigDecimal("5").compareTo(available93()));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM pos_payment", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM lich_su_giao_dich_kho", Integer.class));
        // lỗi nghiệp vụ XÁC ĐỊNH được ghi FAILED (phục hồi trả lỗi đã lưu)
        assertEquals("FAILED", jdbc.queryForObject("SELECT trang_thai FROM pos_checkout_request", String.class));
    }

    @Test
    void t04_thieuTien_tuChoi_khongSideEffect() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        ResponseEntity<Map> res = postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 100000, khachHangId()));

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("không đủ"));
        assertEquals(0, new BigDecimal("5").compareTo(available93()));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
    }

    @Test
    void t05_giaDaThayDoi_409CoCauTruc() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        ResponseEntity<Map> res = postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 100000, 120000, khachHangId()));

        assertEquals(HttpStatus.CONFLICT, res.getStatusCode());
        Map<String, Object> data = (Map<String, Object>) res.getBody().get("data");
        assertEquals(Boolean.TRUE, data.get("priceChanged"));
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertEquals(93, ((Number) items.get(0).get("bienTheSanPhamId")).intValue());
        assertEquals(0, new BigDecimal("120000").compareTo(new BigDecimal(String.valueOf(items.get(0).get("giaMoi")))));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
    }

    @Test
    void t06_trungRequestId_cungPayload_motDon() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        String requestId = "it-" + UUID.randomUUID();
        Map<String, Object> body = checkoutBody(requestId, 93, 1, 120000, 120000, khachHangId());

        ResponseEntity<Map> first = postCheckout(cashier, body);
        ResponseEntity<Map> second = postCheckout(cashier, body);

        assertEquals(HttpStatus.OK, first.getStatusCode());
        assertEquals(HttpStatus.OK, second.getStatusCode());
        Map<String, Object> d1 = (Map<String, Object>) first.getBody().get("data");
        Map<String, Object> d2 = (Map<String, Object>) second.getBody().get("data");
        assertEquals(((Number) d1.get("donBanHangId")).intValue(), ((Number) d2.get("donBanHangId")).intValue());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM pos_payment", Integer.class));
        assertEquals(0, new BigDecimal("4").compareTo(available93()));
    }

    @Test
    void t07_trungRequestId_khacPayload_409() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        String requestId = "it-" + UUID.randomUUID();
        postCheckout(cashier, checkoutBody(requestId, 93, 1, 120000, 120000, khachHangId()));
        ResponseEntity<Map> second = postCheckout(cashier, checkoutBody(requestId, 93, 2, 120000, 240000, khachHangId()));

        assertEquals(HttpStatus.CONFLICT, second.getStatusCode());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
    }

    @Test
    void t08_recovery_phanQuyenDung() {
        String owner = createCashier("nhan_vien_ban_hang", 1);
        String stranger = createCashier("nhan_vien_ban_hang", 2); // có kho 2, không có kho 1
        String requestId = "it-" + UUID.randomUUID();
        ResponseEntity<Map> res = postCheckout(owner, checkoutBody(requestId, 93, 1, 120000, 120000, khachHangId()));
        assertEquals(HttpStatus.OK, res.getStatusCode());

        // chủ sở hữu xem được
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(owner.replace("Bearer ", ""));
        ResponseEntity<Map> own = rest.exchange("/api/v1/pos/checkout-requests/" + requestId,
                HttpMethod.GET, new HttpEntity<>(h), Map.class);
        assertEquals(HttpStatus.OK, own.getStatusCode());
        Map<String, Object> ownData = (Map<String, Object>) own.getBody().get("data");
        assertEquals("SUCCESS", ownData.get("trangThai"));
        assertNotNull(ownData.get("result"));

        // admin xem được
        HttpHeaders ha = new HttpHeaders();
        ha.setBearerAuth(adminToken().replace("Bearer ", ""));
        assertEquals(HttpStatus.OK, rest.exchange("/api/v1/pos/checkout-requests/" + requestId,
                HttpMethod.GET, new HttpEntity<>(ha), Map.class).getStatusCode());

        // thu ngân khác (không quyền kho 1, không phải chủ) bị chặn
        HttpHeaders hs = new HttpHeaders();
        hs.setBearerAuth(stranger.replace("Bearer ", ""));
        ResponseEntity<Map> blocked = rest.exchange("/api/v1/pos/checkout-requests/" + requestId,
                HttpMethod.GET, new HttpEntity<>(hs), Map.class);
        assertEquals(HttpStatus.BAD_REQUEST, blocked.getStatusCode());

        // id không tồn tại -> 404
        HttpHeaders h404 = new HttpHeaders();
        h404.setBearerAuth(adminToken().replace("Bearer ", ""));
        assertEquals(HttpStatus.NOT_FOUND, rest.exchange("/api/v1/pos/checkout-requests/nope",
                HttpMethod.GET, new HttpEntity<>(h404), Map.class).getStatusCode());
    }

    @Test
    void t09_haiCashier_muaChiecCuoi_dongThoi_dungMotThanhCong() throws Exception {
        jdbc.execute("UPDATE ton_kho_theo_lo SET so_luong_ton = CASE lo_hang_id "
                + "WHEN 69 THEN 1.000 WHEN 70 THEN 0.000 WHEN 71 THEN 0.000 END, so_luong_da_dat = 0.000");
        String cashierA = createCashier("nhan_vien_ban_hang", 1);
        String cashierB = createCashier("nhan_vien_ban_hang", 1);
        Integer khach = khachHangId();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        Future<ResponseEntity<Map>> f1 = pool.submit(() -> {
            start.await();
            return postCheckout(cashierA, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 120000, khach));
        });
        Future<ResponseEntity<Map>> f2 = pool.submit(() -> {
            start.await();
            return postCheckout(cashierB, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 120000, khach));
        });
        start.countDown();
        ResponseEntity<Map> r1 = f1.get();
        ResponseEntity<Map> r2 = f2.get();
        pool.shutdown();

        int okCount = (r1.getStatusCode() == HttpStatus.OK ? 1 : 0) + (r2.getStatusCode() == HttpStatus.OK ? 1 : 0);
        assertEquals(1, okCount, "Đúng một giao dịch phải thành công khi hai quầy mua chiếc cuối");
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM pos_payment", Integer.class));
        assertEquals(0, new BigDecimal("0").compareTo(available93()));
        // không bao giờ âm kho
        assertTrue(jdbc.queryForObject("SELECT MIN(so_luong_ton - so_luong_da_dat) FROM ton_kho_theo_lo", BigDecimal.class)
                .compareTo(BigDecimal.ZERO) >= 0);
    }

    @Test
    void t09b_haiCashier_dongThoi_duHangCaHai_caHaiThanhCong_soChungTuKhongTrung() throws Exception {
        // Tồn 5: hai quầy cùng mua 1 -> cả hai phải thành công (trước đây quầy sau nhận 409 trùng số SO).
        String cashierA = createCashier("nhan_vien_ban_hang", 1);
        String cashierB = createCashier("nhan_vien_ban_hang", 1);
        Integer khach = khachHangId();
        for (int round = 0; round < 5; round++) {
            CountDownLatch start = new CountDownLatch(1);
            ExecutorService pool = Executors.newFixedThreadPool(2);
            Future<ResponseEntity<Map>> f1 = pool.submit(() -> {
                start.await();
                return postCheckout(cashierA, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 120000, khach));
            });
            Future<ResponseEntity<Map>> f2 = pool.submit(() -> {
                start.await();
                return postCheckout(cashierB, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 120000, khach));
            });
            start.countDown();
            assertEquals(HttpStatus.OK, f1.get().getStatusCode(), "vòng " + round + ": " + f1.get().getBody());
            assertEquals(HttpStatus.OK, f2.get().getStatusCode(), "vòng " + round + ": " + f2.get().getBody());
            pool.shutdown();
            jdbc.execute("UPDATE ton_kho_theo_lo SET so_luong_ton = CASE lo_hang_id "
                    + "WHEN 69 THEN 3.000 WHEN 70 THEN 1.000 WHEN 71 THEN 1.000 END, so_luong_da_dat = 0.000");
        }
        assertEquals(10, jdbc.queryForObject("SELECT COUNT(DISTINCT so_don_hang) FROM don_ban_hang", Integer.class));
        assertEquals(10, jdbc.queryForObject("SELECT COUNT(DISTINCT so_phieu_xuat) FROM phieu_xuat_kho", Integer.class));
    }

    @Test
    void t10_posVsXuatKhoLegacy_dongThoi_dungMotThang() throws Exception {
        jdbc.execute("UPDATE ton_kho_theo_lo SET so_luong_ton = CASE lo_hang_id "
                + "WHEN 69 THEN 1.000 WHEN 70 THEN 0.000 WHEN 71 THEN 0.000 END, so_luong_da_dat = 0.000");
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        Integer khach = khachHangId();
        Integer nguoiXuatId = jdbc.queryForObject(
                "SELECT id FROM nguoi_dung WHERE ten_dang_nhap LIKE 'poscashier%' ORDER BY id DESC LIMIT 1", Integer.class);

        // Chuẩn bị luồng xuất kho legacy (như production tạo): đơn -> phiếu xuất đã pick lô 69
        jdbc.update("INSERT INTO don_ban_hang (so_don_hang, loai_chung_tu, khach_hang_id, kho_xuat_id, ngay_dat_hang, trang_thai, tien_hang, phi_van_chuyen, tong_cong, trang_thai_thanh_toan, nguoi_tao_id) "
                + "VALUES ('SO-LEGACY-1', 'don_ban_hang', ?, 1, NOW(), 0, 120000, 0, 120000, 'chua_thanh_toan', ?)", khach, nguoiXuatId);
        Integer soId = jdbc.queryForObject("SELECT id FROM don_ban_hang WHERE so_don_hang = 'SO-LEGACY-1'", Integer.class);
        // thanh_tien là cột GENERATED của MySQL — không insert
        jdbc.update("INSERT INTO chi_tiet_don_ban_hang (don_ban_hang_id, bien_the_san_pham_id, so_luong_dat, so_luong_da_giao, don_gia) VALUES (?, 93, 1, 0, 120000)", soId);
        jdbc.update("INSERT INTO phieu_xuat_kho (so_phieu_xuat, don_ban_hang_id, kho_id, loai_xuat, trang_thai, ngay_tao) VALUES ('PX-LEGACY-1', ?, 1, 'ban_hang', 0, NOW())", soId);
        Integer pxId = jdbc.queryForObject("SELECT id FROM phieu_xuat_kho WHERE so_phieu_xuat = 'PX-LEGACY-1'", Integer.class);
        jdbc.update("INSERT INTO chi_tiet_phieu_xuat_kho (phieu_xuat_kho_id, bien_the_san_pham_id, lo_hang_id, so_luong_xuat, gia_von) VALUES (?, 93, 69, 1, 100000)", pxId);

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        Future<ResponseEntity<Map>> posFuture = pool.submit(() -> {
            start.await();
            return postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 120000, khach));
        });
        Future<Boolean> legacyFuture = pool.submit(() -> {
            start.await();
            try {
                phieuXuatKhoService.complete(pxId, nguoiXuatId);
                return true;
            } catch (RuntimeException e) {
                return false;
            }
        });
        start.countDown();
        boolean posOk = posFuture.get().getStatusCode() == HttpStatus.OK;
        boolean legacyOk = legacyFuture.get();
        pool.shutdown();

        assertNotEquals(posOk, legacyOk, "POS và xuất kho legacy tranh chiếc cuối: đúng một bên phải thắng");
        assertEquals(0, new BigDecimal("0").compareTo(available93()));
        assertTrue(jdbc.queryForObject("SELECT MIN(so_luong_ton - so_luong_da_dat) FROM ton_kho_theo_lo", BigDecimal.class)
                .compareTo(BigDecimal.ZERO) >= 0);
    }

    @Test
    void t11_loiGhiGiuaChung_rollbackToanBo() {
        jdbc.execute("CREATE TRIGGER pos_fail_journal BEFORE INSERT ON lich_su_giao_dich_kho "
                + "FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced journal failure'");
        try {
            String cashier = createCashier("nhan_vien_ban_hang", 1);
            ResponseEntity<Map> res = postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 120000, khachHangId()));

            assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, res.getStatusCode());
            // rollback toàn bộ: không đơn, không phiếu, không thu, không neo, tồn không đổi
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM pos_payment", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM pos_checkout_request", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM chi_tiet_don_ban_hang", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM chi_tiet_phieu_xuat_kho", Integer.class));
            assertEquals(0, new BigDecimal("5").compareTo(available93()));
        } finally {
            jdbc.execute("DROP TRIGGER IF EXISTS pos_fail_journal");
        }
    }

    @Test
    void t12_nhieuLo_FIFO_vaTruDatHang() {
        // lot69: ton 3 dat 2 -> khả dụng 1; lot70: ton 1 -> khả dụng 1. Bán 2.
        jdbc.execute("UPDATE ton_kho_theo_lo SET so_luong_ton = CASE lo_hang_id WHEN 69 THEN 3.000 WHEN 70 THEN 1.000 WHEN 71 THEN 0.000 END, "
                + "so_luong_da_dat = CASE lo_hang_id WHEN 69 THEN 2.000 ELSE 0.000 END");
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        ResponseEntity<Map> res = postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 93, 2, 120000, 240000, khachHangId()));

        assertEquals(HttpStatus.OK, res.getStatusCode());
        // FIFO: lô 69 (nhập sớm hơn) lấy đúng phần khả dụng 1, lô 70 lấy 1
        List<Map<String, Object>> picks = jdbc.queryForList(
                "SELECT lo_hang_id, so_luong_xuat FROM chi_tiet_phieu_xuat_kho ORDER BY id");
        assertEquals(2, picks.size());
        assertEquals(69, ((Number) picks.get(0).get("lo_hang_id")).intValue());
        assertEquals(0, new BigDecimal("1").compareTo((BigDecimal) picks.get(0).get("so_luong_xuat")));
        assertEquals(70, ((Number) picks.get(1).get("lo_hang_id")).intValue());
        assertEquals(0, new BigDecimal("1").compareTo((BigDecimal) picks.get(1).get("so_luong_xuat")));
        // ton: 69 -> 2, 70 -> 0; đặt hàng giữ nguyên
        assertEquals(0, new BigDecimal("2").compareTo(jdbc.queryForObject("SELECT so_luong_ton FROM ton_kho_theo_lo WHERE id = 72", BigDecimal.class)));
        assertEquals(0, new BigDecimal("0").compareTo(jdbc.queryForObject("SELECT so_luong_ton FROM ton_kho_theo_lo WHERE id = 73", BigDecimal.class)));
        assertEquals(0, new BigDecimal("2").compareTo(jdbc.queryForObject("SELECT so_luong_da_dat FROM ton_kho_theo_lo WHERE id = 72", BigDecimal.class)));
        // nhật ký 2 dòng
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM lich_su_giao_dich_kho", Integer.class));
    }

    @Test
    void t13_bienTheNgungBan_biChan() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        ResponseEntity<Map> res = postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 94, 1, 0, 100000, khachHangId()));

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("hoạt động"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
    }

    @Test
    void t14_sanPhamChaNgungBan_biChan() {
        jdbc.execute("UPDATE san_pham_quan_ao SET trang_thai = 0 WHERE id = 59");
        try {
            String cashier = createCashier("nhan_vien_ban_hang", 1);
            ResponseEntity<Map> res = postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 120000, khachHangId()));
            assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
        } finally {
            jdbc.execute("UPDATE san_pham_quan_ao SET trang_thai = 1 WHERE id = 59");
        }
    }

    @Test
    void t15_khoKhongPhanQuyen_biChan() {
        String cashierNoKho1 = createCashier("nhan_vien_ban_hang", 2); // chỉ có kho 2
        ResponseEntity<Map> res = postCheckout(cashierNoKho1, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 120000, khachHangId()));

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("kho"));
    }

    @Test
    void t16_bao_cao_doanhThu_chuaDonPOS_doanhThuVaGiaVon() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        assertEquals(HttpStatus.OK, postCheckout(cashier,
                checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 200000, khachHangId())).getStatusCode());

        String today = java.time.LocalDate.now().toString();
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(adminToken().replace("Bearer ", ""));
        ResponseEntity<Map> res = rest.exchange(
                "/api/v1/admin/dashboard/bao-cao/doanh-thu?loai=ngay&tuNgay=" + today + "&denNgay=" + today + "&khoId=1",
                HttpMethod.GET, new HttpEntity<>(h), Map.class);
        assertEquals(HttpStatus.OK, res.getStatusCode(), "body: " + res.getBody());
        List<Map<String, Object>> rows = (List<Map<String, Object>>) res.getBody().get("data");
        Map<String, Object> row = rows.stream()
                .filter(r -> String.valueOf(r.get("nhanThoiGian")).equals(
                        java.time.format.DateTimeFormatter.ofPattern("dd/MM").format(java.time.LocalDate.now())))
                .findFirst().orElseThrow(() -> new AssertionError("khong co dong hom nay trong bao cao: " + rows));
        // doanh thu 120000, giá vốn 100000 (đơn POS hoàn thành được tính)
        assertEquals(0, new BigDecimal("120000").compareTo(new BigDecimal(String.valueOf(row.get("doanhThu")))));
        assertEquals(0, new BigDecimal("100000").compareTo(new BigDecimal(String.valueOf(row.get("giaVon")))));
    }

    @Test
    void t17_chiTietDonPOS_traVeTrangThaiHoanThanh() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        ResponseEntity<Map> res = postCheckout(cashier, checkoutBody("it-" + UUID.randomUUID(), 93, 1, 120000, 120000, khachHangId()));
        int donId = ((Number) ((Map<String, Object>) res.getBody().get("data")).get("donBanHangId")).intValue();

        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(adminToken().replace("Bearer ", ""));
        ResponseEntity<Map> detail = rest.exchange("/api/v1/don-ban-hang/" + donId + "/detail",
                HttpMethod.GET, new HttpEntity<>(h), Map.class);
        assertEquals(HttpStatus.OK, detail.getStatusCode());
        Map<String, Object> donBanHang = (Map<String, Object>) ((Map<String, Object>) detail.getBody().get("data")).get("donBanHang");
        assertEquals(5, ((Number) donBanHang.get("trangThai")).intValue());
        assertEquals("da_thanh_toan", donBanHang.get("trangThaiThanhToan"));
    }

    @Test
    void t18_hoiQuy_taoDonBanHangTrucTiep_vanBiChan_baoGiaVanChay() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        Integer khach = khachHangId();
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(cashier.replace("Bearer ", ""));

        // tạo trực tiếp don_ban_hang vẫn bị chặn (giữ nguyên điều kiện cũ)
        Map<String, Object> direct = Map.of(
                "loaiChungTu", "don_ban_hang",
                "khachHangId", khach,
                "khoXuatId", 1,
                "chiTiet", List.of(Map.of("bienTheSanPhamId", 93, "soLuongDat", 1, "donGia", 120000)));
        ResponseEntity<Map> blocked = rest.exchange("/api/v1/don-ban-hang/create", HttpMethod.POST,
                new HttpEntity<>(direct, h), Map.class);
        // Hành vi legacy GIỮ NGUYÊN: service ném RuntimeException -> handler trả 500
        // (không sửa code cũ trong phase POS; message chặn vẫn đúng)
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, blocked.getStatusCode());
        assertTrue(String.valueOf(blocked.getBody().get("message")).contains("không cho phép"));

        // báo giá vẫn tạo được -> convert-to-order vẫn chạy
        Map<String, Object> quote = Map.of(
                "loaiChungTu", "bao_gia",
                "khachHangId", khach,
                "khoXuatId", 1,
                "chiTiet", List.of(Map.of("bienTheSanPhamId", 93, "soLuongDat", 1, "donGia", 120000)));
        ResponseEntity<Map> quoteRes = rest.exchange("/api/v1/don-ban-hang/create", HttpMethod.POST,
                new HttpEntity<>(quote, h), Map.class);
        assertEquals(HttpStatus.OK, quoteRes.getStatusCode());
        int bgId = ((Number) ((Map<String, Object>) quoteRes.getBody().get("data")).get("id")).intValue();

        ResponseEntity<Map> converted = rest.exchange("/api/v1/don-ban-hang/" + bgId + "/convert-to-order",
                HttpMethod.PUT, new HttpEntity<>(Map.of("khoXuatId", 1), h), Map.class);
        assertEquals(HttpStatus.OK, converted.getStatusCode());
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM don_ban_hang WHERE loai_chung_tu = 'don_ban_hang' AND so_don_hang LIKE 'SO%'", Integer.class));
    }

    @Test
    void t19_timKhachPos_serverSide_khachLeDauTien_boKhachNgungHoatDong() {
        String cashier = createCashier("nhan_vien_ban_hang", 1);
        String suffix = String.format("%08d", System.nanoTime() % 100_000_000L);
        String active = "09" + suffix;
        String inactive = "08" + suffix;
        jdbc.update("DELETE FROM khach_hang WHERE ma_khach_hang LIKE 'KHIT%'");
        jdbc.update("INSERT INTO khach_hang (ma_khach_hang, ten_khach_hang, so_dien_thoai, loai_khach_hang, trang_thai) VALUES (?, ?, ?, 'le', 1)",
                "KHIT" + active, "Khách IT " + active, active);
        jdbc.update("INSERT INTO khach_hang (ma_khach_hang, ten_khach_hang, so_dien_thoai, loai_khach_hang, trang_thai) VALUES (?, ?, ?, 'le', 0)",
                "KHIT" + inactive, "Khách IT ngừng " + inactive, inactive);
        try {
            HttpHeaders h = new HttpHeaders();
            h.setBearerAuth(cashier.replace("Bearer ", ""));
            HttpEntity<Void> auth = new HttpEntity<>(h);

            // Khách vừa thêm (sau khi màn POS đã mở) tìm được theo SĐT
            List<Map<String, Object>> byPhone = customerContent(rest.exchange("/api/v1/pos/customers?q={q}",
                    HttpMethod.GET, auth, Map.class, active));
            assertEquals(1, byPhone.size());
            assertEquals(active, byPhone.get(0).get("soDienThoai"));

            // Ô tìm trống: Khách lẻ đứng đầu
            List<Map<String, Object>> all = customerContent(rest.exchange("/api/v1/pos/customers",
                    HttpMethod.GET, auth, Map.class));
            assertEquals("KHLE", all.get(0).get("maKhachHang"));

            // Khách ngừng hoạt động không xuất hiện
            assertEquals(0, customerContent(rest.exchange("/api/v1/pos/customers?q={q}",
                    HttpMethod.GET, auth, Map.class, inactive)).size());

            // "%" là ký tự thường, không phải ký tự đại diện (không trả về mọi khách)
            assertEquals(0, customerContent(rest.exchange("/api/v1/pos/customers?q={q}",
                    HttpMethod.GET, auth, Map.class, "%")).size());

            // Vai trò không bán hàng bị chặn
            HttpHeaders hk = new HttpHeaders();
            hk.setBearerAuth(createCashier("nhan_vien_kho", 1).replace("Bearer ", ""));
            assertNotEquals(HttpStatus.OK, rest.exchange("/api/v1/pos/customers", HttpMethod.GET,
                    new HttpEntity<>(hk), Map.class).getStatusCode());
        } finally {
            jdbc.update("DELETE FROM khach_hang WHERE ma_khach_hang LIKE 'KHIT%'");
        }
    }

    private List<Map<String, Object>> customerContent(ResponseEntity<Map> res) {
        assertEquals(HttpStatus.OK, res.getStatusCode(), String.valueOf(res.getBody()));
        Map<String, Object> data = (Map<String, Object>) res.getBody().get("data");
        return (List<Map<String, Object>>) data.get("content");
    }

    @AfterAll
    static void note() {
        // Schema dùng-một-lần do quy trình bên ngoài dọn (kill instance mysqld tạm).
        // KHÔNG có thao tác nào trên DB dev/production.
    }
}
