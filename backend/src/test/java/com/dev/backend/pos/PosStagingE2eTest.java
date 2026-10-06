package com.dev.backend.pos;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSObject;
import com.nimbusds.jose.Payload;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * E2E STAGING (Phase 06) — chống lại BACKEND STAGING ĐANG CHẠY (http://localhost:8090,
 * gate đã bật bằng env) bằng HTTP thật với tài khoản demo posdemo / Posdemo@123
 * (seed ngoài repo) + đối chiếu DB staging qua JDBC. Không mock API.
 * Yêu cầu: backend staging + MySQL staging (127.0.0.1:3307) đang chạy.
 */
class PosStagingE2eTest {

    private static final String BASE = "http://localhost:8090";
    private static final String DB_URL = "jdbc:mysql://127.0.0.1:3307/fcentric_pos_test?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
    private static final String DB_USER = "posstage";
    private static final String DB_PASS = "PosStage@123";

    private static String token;
    private static Integer khachLeId;
    private final RestTemplate rest = new RestTemplate();
    private final JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(DB_URL, DB_USER, DB_PASS));

    {
        // Không ném ngoại lệ ở 4xx — test tự assert status code + body.
        rest.setErrorHandler(new org.springframework.web.client.DefaultResponseErrorHandler() {
            @Override
            protected boolean hasError(HttpStatusCode statusCode) {
                return false;
            }
        });
    }

    @BeforeAll
    static void login() {
        RestTemplate r = new RestTemplate();
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> res = r.postForEntity(BASE + "/api/v1/nguoi-dung/login",
                new HttpEntity<>(Map.of("username", "posdemo", "password", "Posdemo@123"), h), Map.class);
        assertEquals(HttpStatus.OK, res.getStatusCode(), "đăng nhập posdemo phải OK: " + res.getBody());
        Map<String, Object> data = (Map<String, Object>) res.getBody().get("data");
        token = (String) data.get("token");
        assertNotNull(token);
        // KHLE qua API khách hàng (walk-in policy)
        HttpHeaders hk = new HttpHeaders();
        hk.setBearerAuth(token);
        ResponseEntity<Map> customers = r.exchange(BASE + "/api/v1/khach-hang/for-sales-order",
                HttpMethod.GET, new HttpEntity<>(hk), Map.class);
        List<Map<String, Object>> list = (List<Map<String, Object>>) customers.getBody().get("data");
        khachLeId = list.stream().filter(c -> "KHLE".equals(c.get("maKhachHang")))
                .map(c -> ((Number) c.get("id")).intValue()).findFirst().orElseThrow();
    }

    @BeforeEach
    void resetStagingData() {
        // KHÔNG xóa posdemo / KHLE — chỉ dọn dữ liệu giao dịch để mỗi kịch bản độc lập.
        jdbc.execute("DELETE FROM pos_payment");
        jdbc.execute("DELETE FROM pos_checkout_request");
        jdbc.execute("DELETE FROM chi_tiet_phieu_xuat_kho");
        jdbc.execute("DELETE FROM phieu_xuat_kho");
        jdbc.execute("DELETE FROM chi_tiet_don_ban_hang");
        jdbc.execute("DELETE FROM don_ban_hang");
        jdbc.execute("DELETE FROM lich_su_giao_dich_kho");
        jdbc.execute("UPDATE ton_kho_theo_lo SET so_luong_ton = CASE lo_hang_id "
                + "WHEN 69 THEN 3.000 WHEN 70 THEN 1.000 WHEN 71 THEN 1.000 ELSE so_luong_ton END, "
                + "so_luong_da_dat = 0.000, ngay_xuat_gan_nhat = NULL");
        jdbc.execute("UPDATE bien_the_san_pham SET trang_thai = CASE id WHEN 93 THEN 1 ELSE 0 END");
        jdbc.execute("UPDATE san_pham_quan_ao SET trang_thai = CASE id WHEN 59 THEN 1 ELSE trang_thai END");
    }

    private ResponseEntity<Map> post(String path, Object body) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(token);
        return rest.exchange(BASE + path, HttpMethod.POST, new HttpEntity<>(body, h), Map.class);
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

    /** Chuẩn hóa giá trị cột tinyint(1) đọc qua JDBC (Boolean theo connector cũ / Number theo connector mới). */
    private static int intVal(Object value) {
        if (value instanceof Number number) return number.intValue();
        if (value instanceof Boolean bool) return bool ? 1 : 0;
        throw new IllegalArgumentException("không đọc được giá trị số: " + value);
    }

    /** Token admin ký bằng đúng signer key của app (cấu trúc claim y hệt generateTokenWithPermissions). */
    private String adminToken() throws Exception {
        Integer adminId = jdbc.queryForObject(
                "SELECT id FROM nguoi_dung WHERE vai_tro = 'quan_tri_vien' AND trang_thai = 1 ORDER BY id LIMIT 1",
                Integer.class);
        Properties p = new Properties();
        try (InputStream in = Files.newInputStream(Paths.get("src/main/resources/application.properties"))) {
            p.load(in);
        }
        String key = p.getProperty("constant.key.signer-key");
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("admin-staging@local")
                .issuer("FashionSystem")
                .issueTime(new Date())
                .expirationTime(new Date(System.currentTimeMillis() + 24 * 60 * 60 * 1000L))
                .claim("id", adminId)
                .claim("scope", "quan_tri_vien")
                .claim("warehousePermissions", "[]")
                .claim("userAgent", "pos-staging-e2e")
                .build();
        JWSObject jws = new JWSObject(new JWSHeader(JWSAlgorithm.HS256), new Payload(claims.toJSONObject()));
        jws.sign(new MACSigner(key.getBytes(StandardCharsets.UTF_8)));
        return jws.serialize();
    }

    @Test
    void e2e_thanhToanThanhCong_doiChieuDuDonPhieuThuTonNhatKy() {
        String requestId = "e2e-" + UUID.randomUUID();
        ResponseEntity<Map> res = post("/api/v1/pos/checkout",
                checkoutBody(requestId, 93, 1, 120000, 200000, khachLeId));

        assertEquals(HttpStatus.OK, res.getStatusCode(), "checkout phải thành công: " + res.getBody());
        Map<String, Object> data = (Map<String, Object>) res.getBody().get("data");
        int donId = ((Number) data.get("donBanHangId")).intValue();
        assertEquals(0, new BigDecimal("120000").compareTo(new BigDecimal(String.valueOf(data.get("tongCong")))));
        assertEquals(0, new BigDecimal("80000").compareTo(new BigDecimal(String.valueOf(data.get("soTienThua")))));

        // đối chiếu DB staging
        assertEquals("don_ban_hang", jdbc.queryForObject(
                "SELECT loai_chung_tu FROM don_ban_hang WHERE id = ?", String.class, donId));
        // đọc cột tinyint(1) bằng getInt (số thật, không bị ép Boolean bởi connector cũ của test)
        assertEquals(5, jdbc.queryForObject("SELECT trang_thai FROM don_ban_hang WHERE id = ?", Integer.class, donId));
        assertEquals("da_thanh_toan", jdbc.queryForObject(
                "SELECT trang_thai_thanh_toan FROM don_ban_hang WHERE id = ?", String.class, donId));
        assertEquals(0, new BigDecimal("120000").compareTo(jdbc.queryForObject(
                "SELECT tong_cong FROM don_ban_hang WHERE id = ?", BigDecimal.class, donId)));

        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class));
        assertEquals(69, jdbc.queryForObject("SELECT lo_hang_id FROM chi_tiet_phieu_xuat_kho", Integer.class));
        assertEquals(3, jdbc.queryForObject("SELECT trang_thai FROM phieu_xuat_kho", Integer.class));
        assertEquals(0, new BigDecimal("2").compareTo(jdbc.queryForObject(
                "SELECT so_luong_ton FROM ton_kho_theo_lo WHERE id = 72", BigDecimal.class)));
        assertEquals(0, new BigDecimal("4").compareTo(available93()));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM lich_su_giao_dich_kho", Integer.class));
        assertEquals(0, new BigDecimal("120000").compareTo(jdbc.queryForObject(
                "SELECT so_tien_hang FROM pos_payment", BigDecimal.class)));
        assertEquals(0, new BigDecimal("80000").compareTo(jdbc.queryForObject(
                "SELECT so_tien_thua FROM pos_payment", BigDecimal.class)));
        assertEquals("SUCCESS", jdbc.queryForObject("SELECT trang_thai FROM pos_checkout_request", String.class));
    }

    @Test
    void e2e_thieuTien_tuChoi_khongSideEffect() {
        ResponseEntity<Map> res = post("/api/v1/pos/checkout",
                checkoutBody("e2e-" + UUID.randomUUID(), 93, 1, 120000, 100000, khachLeId));
        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode(), res.getBody().toString());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
        assertEquals(0, new BigDecimal("5").compareTo(available93()));
    }

    @Test
    void e2e_giaCu_409PriceChange() {
        ResponseEntity<Map> res = post("/api/v1/pos/checkout",
                checkoutBody("e2e-" + UUID.randomUUID(), 93, 1, 100000, 120000, khachLeId));
        assertEquals(HttpStatus.CONFLICT, res.getStatusCode(), res.getBody().toString());
        assertEquals(Boolean.TRUE, ((Map<String, Object>) res.getBody().get("data")).get("priceChanged"));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
    }

    @Test
    void e2e_clickDup_cungRequestId_motDon() {
        String requestId = "e2e-" + UUID.randomUUID();
        Map<String, Object> body = checkoutBody(requestId, 93, 1, 120000, 120000, khachLeId);
        ResponseEntity<Map> first = post("/api/v1/pos/checkout", body);
        ResponseEntity<Map> second = post("/api/v1/pos/checkout", body);
        assertEquals(HttpStatus.OK, first.getStatusCode());
        assertEquals(HttpStatus.OK, second.getStatusCode());
        int id1 = ((Number) ((Map<String, Object>) first.getBody().get("data")).get("donBanHangId")).intValue();
        int id2 = ((Number) ((Map<String, Object>) second.getBody().get("data")).get("donBanHangId")).intValue();
        assertEquals(id1, id2, "click đúp phải trả cùng đơn");
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM pos_payment", Integer.class));
        assertEquals(0, new BigDecimal("4").compareTo(available93()));
    }

    @Test
    void e2e_cungKey_khacPayload_409() {
        String requestId = "e2e-" + UUID.randomUUID();
        post("/api/v1/pos/checkout", checkoutBody(requestId, 93, 1, 120000, 120000, khachLeId));
        ResponseEntity<Map> second = post("/api/v1/pos/checkout",
                checkoutBody(requestId, 93, 2, 120000, 240000, khachLeId));
        assertEquals(HttpStatus.CONFLICT, second.getStatusCode());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM don_ban_hang", Integer.class));
    }

    @Test
    void e2e_recovery_ownerDocKetQua() {
        String requestId = "e2e-" + UUID.randomUUID();
        post("/api/v1/pos/checkout", checkoutBody(requestId, 93, 1, 120000, 120000, khachLeId));
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        ResponseEntity<Map> res = rest.exchange(BASE + "/api/v1/pos/checkout-requests/" + requestId,
                HttpMethod.GET, new HttpEntity<>(h), Map.class);
        assertEquals(HttpStatus.OK, res.getStatusCode(), res.getBody().toString());
        Map<String, Object> data = (Map<String, Object>) res.getBody().get("data");
        assertEquals("SUCCESS", data.get("trangThai"));
        assertNotNull(data.get("result"));
    }

    @Test
    void e2e_khachLe_KHLE_tonTaiVaDuocChon() {
        assertEquals("Khách lẻ", jdbc.queryForObject(
                "SELECT ten_khach_hang FROM khach_hang WHERE ma_khach_hang = 'KHLE'", String.class));
        // checkout bằng KHLE (walk-in) thành công
        ResponseEntity<Map> res = post("/api/v1/pos/checkout",
                checkoutBody("e2e-" + UUID.randomUUID(), 93, 1, 120000, 120000, khachLeId));
        assertEquals(HttpStatus.OK, res.getStatusCode(), res.getBody().toString());
    }

    @Test
    void e2e_bao_cao_doanhThu_ngayHomNay_chuaDonPOS() throws Exception {
        post("/api/v1/pos/checkout", checkoutBody("e2e-" + UUID.randomUUID(), 93, 1, 120000, 200000, khachLeId));
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(adminToken()); // báo cáo admin chỉ dành cho quan_tri_vien
        String today = LocalDate.now().toString();
        ResponseEntity<Map> res = rest.exchange(
                BASE + "/api/v1/admin/dashboard/bao-cao/doanh-thu?loai=ngay&tuNgay=" + today + "&denNgay=" + today + "&khoId=1",
                HttpMethod.GET, new HttpEntity<>(h), Map.class);
        assertEquals(HttpStatus.OK, res.getStatusCode(), res.getBody().toString());
        List<Map<String, Object>> rows = (List<Map<String, Object>>) res.getBody().get("data");
        Map<String, Object> row = rows.stream()
                .filter(r -> DateTimeFormatter.ofPattern("dd/MM").format(LocalDate.now()).equals(r.get("nhanThoiGian")))
                .findFirst().orElseThrow(() -> new AssertionError("báo cáo không có dòng hôm nay: " + rows));
        assertEquals(0, new BigDecimal("120000").compareTo(new BigDecimal(String.valueOf(row.get("doanhThu")))));
        assertEquals(0, new BigDecimal("100000").compareTo(new BigDecimal(String.valueOf(row.get("giaVon")))));
    }
}
