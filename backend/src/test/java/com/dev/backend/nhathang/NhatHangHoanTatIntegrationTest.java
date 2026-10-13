package com.dev.backend.nhathang;

import com.dev.backend.services.impl.utils.JwtServiceImpl;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Kiểm thử tích hợp luồng nhặt hàng → phiếu xuất kho trên MySQL thật (qua HTTP, như màn hình gọi).
 *
 * Yêu cầu schema MySQL DÙNG RIÊNG CHO TEST (test sẽ XÓA dữ liệu đơn bán / phiếu nhặt / phiếu xuất):
 *   import Database/MyDB_v1.3.sql + pos_checkout_v1.sql + payos_v1.sql + tong_quan_v1.sql
 *   + pick_list_trang_thai_v1.sql vào schema có tên chứa "test".
 * Mặc định: jdbc:mysql://127.0.0.1:3307/fcentric_pick_test (root, mật khẩu rỗng).
 * Chạy: mvn test -Dtest=NhatHangHoanTatIntegrationTest -Dnhathang.it=true -DargLine=-Duser.timezone=UTC
 *   (đổi DB bằng -Dnhathang.it.db.url=..., -Dnhathang.it.db.user=..., -Dnhathang.it.db.pass=...)
 * Dữ liệu mẫu dùng biến thể 93 (AK2610051-CL005-1-MS-2691) ở kho 1, tồn 5 trên 3 lô 69/70/71.
 */
@EnabledIfSystemProperty(named = "nhathang.it", matches = "true")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.MethodName.class)
class NhatHangHoanTatIntegrationTest {

    private static final int KHO = 1;
    private static final int BIEN_THE = 93;
    private static final String SKU = "AK2610051-CL005-1-MS-2691";
    private static final int KHACH_HANG = 3;

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String url = System.getProperty("nhathang.it.db.url",
                "jdbc:mysql://127.0.0.1:3307/fcentric_pick_test?useSSL=false&serverTimezone=UTC"
                        + "&characterEncoding=UTF-8&allowPublicKeyRetrieval=true");
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> System.getProperty("nhathang.it.db.user", "root"));
        registry.add("spring.datasource.password", () -> System.getProperty("nhathang.it.db.pass", ""));
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        registry.add("spring.jpa.show-sql", () -> "false");
        // Không gọi MinIO thật khi khởi động (bean được thay bằng mock bên dưới)
        registry.add("minio.endpoint", () -> "http://127.0.0.1:9");
    }

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private TestRestTemplate rest;
    @Autowired
    private JwtServiceImpl jwtService;
    @Autowired
    private JdbcTemplate jdbc;

    private String adminToken;
    private int soDonSeq = 0;

    @BeforeEach
    void datLaiDuLieu() {
        String db = jdbc.queryForObject("SELECT DATABASE()", String.class);
        assertTrue(db != null && db.toLowerCase().contains("test"),
                "Từ chối chạy: schema '" + db + "' không phải schema test (tên phải chứa 'test')");

        jdbc.execute("DELETE FROM chi_tiet_phieu_xuat_kho");
        jdbc.execute("DELETE FROM phieu_xuat_kho");
        jdbc.execute("UPDATE don_ban_hang SET danh_sach_nhat_hang_id = NULL");
        jdbc.execute("DELETE FROM chi_tiet_nhat_hang");
        jdbc.execute("DELETE FROM danh_sach_nhat_hang");
        jdbc.execute("DELETE FROM chi_tiet_don_ban_hang");
        jdbc.execute("DELETE FROM don_ban_hang");
        jdbc.execute("DELETE FROM lich_su_giao_dich_kho");
        jdbc.execute("UPDATE ton_kho_theo_lo SET so_luong_ton = CASE lo_hang_id "
                + "WHEN 69 THEN 3.000 WHEN 70 THEN 1.000 WHEN 71 THEN 1.000 ELSE so_luong_ton END, "
                + "so_luong_da_dat = 0.000, ngay_xuat_gan_nhat = NULL WHERE kho_id = 1");
        jdbc.execute("UPDATE bien_the_san_pham SET trang_thai = 1 WHERE id = 93");

        Integer adminId = jdbc.queryForObject(
                "SELECT id FROM nguoi_dung WHERE vai_tro = 'quan_tri_vien' AND trang_thai = 1 ORDER BY id LIMIT 1",
                Integer.class);
        adminToken = jwtService.generateTokenWithPermissions(adminId, "admin-it", "Admin IT",
                "admin-it@nhathang.test", "", Set.of("quan_tri_vien"), 1, Instant.now(), Instant.now(),
                List.of(), "nhathang-it");
    }

    // ===================== tiện ích =====================

    /** Tạo đơn bán ở trạng thái 1 (Chờ xuất kho) tại kho 1, 1 dòng biến thể 93. */
    private int taoDonChoXuat(int soLuong) {
        String so = "IT-NH-" + System.nanoTime() + "-" + (++soDonSeq);
        jdbc.update("INSERT INTO don_ban_hang (so_don_hang, loai_chung_tu, khach_hang_id, kho_xuat_id, ngay_dat_hang, "
                        + "trang_thai, tien_hang, tong_cong) VALUES (?, 'don_ban_hang', ?, ?, NOW(), 1, ?, ?)",
                so, KHACH_HANG, KHO, soLuong * 120000, soLuong * 120000);
        Integer id = jdbc.queryForObject("SELECT id FROM don_ban_hang WHERE so_don_hang = ?", Integer.class, so);
        jdbc.update("INSERT INTO chi_tiet_don_ban_hang (don_ban_hang_id, bien_the_san_pham_id, so_luong_dat, don_gia) "
                + "VALUES (?, ?, ?, 120000)", id, BIEN_THE, soLuong);
        return id;
    }

    private HttpHeaders headers() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(adminToken);
        h.set("kho_id", String.valueOf(KHO));
        return h;
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> goi(HttpMethod method, String path, Object body) {
        return rest.exchange(path, method, new HttpEntity<>(body, headers()), Map.class);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> data(ResponseEntity<Map> res) {
        return (Map<String, Object>) res.getBody().get("data");
    }

    private int taoPhieuNhat(Integer... donIds) {
        ResponseEntity<Map> res = goi(HttpMethod.POST, "/api/v1/nhat-hang/tao-pick-list",
                Map.of("donBanHangIds", List.of(donIds)));
        assertEquals(HttpStatus.CREATED, res.getStatusCode(), "tạo phiếu nhặt: " + res.getBody());
        return ((Number) data(res).get("id")).intValue();
    }

    private void quet(int phieuNhatId, int soLan) {
        for (int i = 0; i < soLan; i++) {
            ResponseEntity<Map> res = goi(HttpMethod.POST, "/api/v1/nhat-hang/pick-list/" + phieuNhatId + "/quet-barcode",
                    Map.of("barcode", SKU, "soLuong", 1));
            assertEquals(HttpStatus.OK, res.getStatusCode(), "quét lần " + (i + 1) + ": " + res.getBody());
        }
    }

    private ResponseEntity<Map> hoanTat(int phieuNhatId) {
        return goi(HttpMethod.POST, "/api/v1/nhat-hang/pick-list/" + phieuNhatId + "/hoan-tat", null);
    }

    private String trangThaiPhieuNhat(int id) {
        return jdbc.queryForObject("SELECT trang_thai FROM danh_sach_nhat_hang WHERE id = ?", String.class, id);
    }

    private int trangThaiDon(int id) {
        return jdbc.queryForObject("SELECT trang_thai FROM don_ban_hang WHERE id = ?", Integer.class, id);
    }

    private Integer phieuXuatNhapCuaDon(int donId) {
        List<Integer> ids = jdbc.queryForList(
                "SELECT id FROM phieu_xuat_kho WHERE don_ban_hang_id = ? AND trang_thai = 0", Integer.class, donId);
        return ids.isEmpty() ? null : ids.get(0);
    }

    private BigDecimal tonKho() {
        return jdbc.queryForObject("SELECT COALESCE(SUM(so_luong_ton),0) FROM ton_kho_theo_lo WHERE kho_id = 1 "
                + "AND lo_hang_id IN (69,70,71)", BigDecimal.class);
    }

    /** Chọn lô 69 cho dòng gốc của phiếu xuất rồi xác nhận xuất kho. */
    private ResponseEntity<Map> chonLoVaXuat(int phieuXuatId, int soLuong) {
        Integer dongGoc = jdbc.queryForObject("SELECT id FROM chi_tiet_phieu_xuat_kho WHERE phieu_xuat_kho_id = ? "
                + "AND lo_hang_id IS NULL", Integer.class, phieuXuatId);
        ResponseEntity<Map> pick = goi(HttpMethod.POST, "/api/v1/phieu-xuat-kho/" + phieuXuatId + "/pick-lo",
                Map.of("chiTietPhieuXuatKhoId", dongGoc,
                        "loHangPicks", List.of(Map.of("loHangId", 69, "soLuongXuat", soLuong))));
        assertEquals(HttpStatus.OK, pick.getStatusCode(), "chọn lô: " + pick.getBody());
        return goi(HttpMethod.POST, "/api/v1/phieu-xuat-kho/" + phieuXuatId + "/xac-nhan-xuat-kho",
                Map.of("donViVanChuyen", "GHTK", "maVanDon", "IT-001"));
    }

    // ===================== kiểm thử =====================

    @Test
    void t01_hoanTatNhat_thanhCong_donGiuDangXuLy_taoPhieuXuatNhap() {
        int don = taoDonChoXuat(2);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 2);

        ResponseEntity<Map> res = hoanTat(phieu);

        assertEquals(HttpStatus.OK, res.getStatusCode(), "hoàn tất nhặt: " + res.getBody());
        assertEquals("da_nhat", trangThaiPhieuNhat(phieu));
        assertNotNull(jdbc.queryForObject("SELECT ngay_hoan_tat FROM danh_sach_nhat_hang WHERE id = ?", Object.class, phieu));
        assertEquals(2, trangThaiDon(don), "đơn phải giữ 2 (Đang xử lý xuất kho), chưa được lên 3 khi chưa xuất");
        Integer pxk = phieuXuatNhapCuaDon(don);
        assertNotNull(pxk, "phải sinh phiếu xuất nháp cho đơn");
        assertEquals(0, new BigDecimal("2").compareTo(jdbc.queryForObject(
                "SELECT so_luong_xuat FROM chi_tiet_phieu_xuat_kho WHERE phieu_xuat_kho_id = ? AND lo_hang_id IS NULL",
                BigDecimal.class, pxk)));
        assertEquals(List.of(), data(res).get("donChuaTaoPhieuXuat"));
        assertEquals(Boolean.FALSE, data(res).get("coTheHoanTat"));
        assertEquals(0, new BigDecimal("5").compareTo(tonKho()), "hoàn tất nhặt chưa được trừ tồn");
    }

    @Test
    void t02_giaoThanhCong_biChan_khiPhieuXuatConNhap() {
        int don = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 1);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());

        ResponseEntity<Map> res = goi(HttpMethod.PUT, "/api/v1/don-ban-hang/" + don + "/mark-delivered", null);

        assertNotEquals(HttpStatus.OK, res.getStatusCode(), "không được Giao thành công khi kho chưa xuất: " + res.getBody());
        assertEquals(2, trangThaiDon(don));
    }

    @Test
    void t03_xuatKhoXong_donLen3_phieuNhatChuyenDaXuat() {
        int don = taoDonChoXuat(2);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 2);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());

        ResponseEntity<Map> xuat = chonLoVaXuat(phieuXuatNhapCuaDon(don), 2);

        assertEquals(HttpStatus.OK, xuat.getStatusCode(), "xuất kho: " + xuat.getBody());
        assertEquals(3, trangThaiDon(don));
        assertEquals("da_xuat", trangThaiPhieuNhat(phieu));
        assertEquals(0, new BigDecimal("3").compareTo(tonKho()), "tồn phải giảm 2 sau khi xuất");
    }

    @Test
    void t04_huyDon_dangTrongPhieuNhat_bi409() {
        int don = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don);

        ResponseEntity<Map> res = goi(HttpMethod.PUT, "/api/v1/don-ban-hang/" + don + "/cancel", null);

        assertEquals(HttpStatus.CONFLICT, res.getStatusCode(), "body: " + res.getBody());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("phiếu nhặt hàng"), "body: " + res.getBody());
        assertEquals(2, trangThaiDon(don));
        assertEquals("cho_nhat", trangThaiPhieuNhat(phieu));
    }

    @Test
    void t05_hoanTat_boQuaDonBiSanHuy_vaBaoLai() {
        int don1 = taoDonChoXuat(1);
        int don2 = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don1, don2);
        quet(phieu, 2);
        // Mô phỏng đồng bộ Shopify hủy đơn 2 trong lúc đang nhặt (OmnichannelOrderSyncJob đặt trạng thái 4)
        jdbc.update("UPDATE don_ban_hang SET trang_thai = 4 WHERE id = ?", don2);
        String soDon2 = jdbc.queryForObject("SELECT so_don_hang FROM don_ban_hang WHERE id = ?", String.class, don2);

        ResponseEntity<Map> res = hoanTat(phieu);

        assertEquals(HttpStatus.OK, res.getStatusCode(), "body: " + res.getBody());
        assertEquals("da_nhat", trangThaiPhieuNhat(phieu));
        assertEquals(2, trangThaiDon(don1));
        assertEquals(4, trangThaiDon(don2), "đơn đã hủy không được bị đưa lên lại");
        assertNotNull(phieuXuatNhapCuaDon(don1));
        assertNull(phieuXuatNhapCuaDon(don2), "không tạo phiếu xuất cho đơn đã hủy");
        assertEquals(List.of(soDon2), data(res).get("donChuaTaoPhieuXuat"));
    }

    @Test
    void t06_hoanTat_moiDonDaHuy_phieuNhatChuyenDaHuy() {
        int don = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 1);
        jdbc.update("UPDATE don_ban_hang SET trang_thai = 4 WHERE id = ?", don);

        ResponseEntity<Map> res = hoanTat(phieu);

        assertEquals(HttpStatus.OK, res.getStatusCode(), "body: " + res.getBody());
        assertEquals("da_huy", trangThaiPhieuNhat(phieu));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class));
    }

    @Test
    void t07_xuatKho_donDaHuySauKhiNhat_bi409_khongTruTon() {
        int don = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 1);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());
        Integer pxk = phieuXuatNhapCuaDon(don);
        jdbc.update("UPDATE don_ban_hang SET trang_thai = 4 WHERE id = ?", don); // sàn hủy sau khi đã có phiếu nháp

        ResponseEntity<Map> res = chonLoVaXuat(pxk, 1);

        assertEquals(HttpStatus.CONFLICT, res.getStatusCode(), "body: " + res.getBody());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("đã bị hủy"), "body: " + res.getBody());
        assertEquals(0, new BigDecimal("5").compareTo(tonKho()), "không được trừ tồn cho đơn đã hủy");
        assertEquals(4, trangThaiDon(don));
        assertEquals(0, jdbc.queryForObject("SELECT trang_thai FROM phieu_xuat_kho WHERE id = ?", Integer.class, pxk));
    }

    @Test
    void t08_chuaNhatDu_khongHoanTatDuoc() {
        int don = taoDonChoXuat(2);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 1);

        ResponseEntity<Map> res = hoanTat(phieu);

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode(), "body: " + res.getBody());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("Chưa nhặt đủ"), "body: " + res.getBody());
        assertEquals("dang_nhat", trangThaiPhieuNhat(phieu));
        assertEquals(2, trangThaiDon(don));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class));
    }

    @Test
    void t09_phieuNhatHaiDon_chiDongKhiXuatDuCaHai() {
        int don1 = taoDonChoXuat(1);
        int don2 = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don1, don2);
        quet(phieu, 2);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());

        assertEquals(HttpStatus.OK, chonLoVaXuat(phieuXuatNhapCuaDon(don1), 1).getStatusCode());
        assertEquals("da_nhat", trangThaiPhieuNhat(phieu), "còn đơn 2 chưa xuất thì phiếu nhặt chưa đóng");
        assertEquals(3, trangThaiDon(don1));
        assertEquals(2, trangThaiDon(don2));

        assertEquals(HttpStatus.OK, chonLoVaXuat(phieuXuatNhapCuaDon(don2), 1).getStatusCode());
        assertEquals("da_xuat", trangThaiPhieuNhat(phieu));
        assertEquals(0, new BigDecimal("3").compareTo(tonKho()));
    }

    @Test
    void t10_hoanTatLanHai_biChan() {
        int don = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 1);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());

        ResponseEntity<Map> res = hoanTat(phieu);

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode(), "body: " + res.getBody());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class),
                "bấm Hoàn tất lần hai không được sinh thêm phiếu xuất");
    }
}
