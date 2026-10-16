package com.dev.backend.nhathang;

import com.dev.backend.repository.TonKhoTongHopRepository;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Kiểm thử tích hợp luồng nhặt hàng → đóng gói → phiếu xuất kho trên MySQL thật (qua HTTP, như màn hình gọi).
 * Đơn: 1 Chờ nhặt hàng → (hoàn tất nhặt) 7 Chờ đóng gói → (đóng gói) 8 Chờ xuất kho → (xuất kho) 3.
 *
 * Yêu cầu schema MySQL DÙNG RIÊNG CHO TEST (test sẽ XÓA dữ liệu đơn bán / phiếu nhặt / phiếu xuất):
 *   import Database/MyDB_v1.3.sql + pos_checkout_v1.sql + payos_v1.sql + tong_quan_v1.sql
 *   + pick_list_trang_thai_v1.sql + kho_tong_v1.sql + hoan_ke_canh_bao_v1.sql + dong_goi_v1.sql
 *   + phan_bo_lo_nhat_hang_v1.sql (bảng bang_chung_dong_goi do backend tự tạo lúc khởi động)
 *   vào schema có tên chứa "test".
 * Mặc định: jdbc:mysql://127.0.0.1:3307/fcentric_pick_test (root, mật khẩu rỗng).
 * Chạy: mvn test -Dtest=NhatHangHoanTatIntegrationTest -Dnhathang.it=true -DargLine=-Duser.timezone=UTC
 *   (đổi DB bằng -Dnhathang.it.db.url=..., -Dnhathang.it.db.user=..., -Dnhathang.it.db.pass=...)
 * Dữ liệu mẫu dùng biến thể 93 (AK2610051-CL005-1-MS-2691) ở kho 1, tồn 5 trên 3 lô 69/70/71
 * (test đặt lại: lô 69 nhập 01/10 còn 3, lô 70 nhập 05/10 còn 1, lô 71 nhập 08/10 còn 1 — thứ tự FIFO 69 → 70 → 71).
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
    @Autowired
    private TonKhoTongHopRepository tonKhoTongHopRepository;

    private String adminToken;
    private int adminId;
    private int soDonSeq = 0;

    @BeforeEach
    void datLaiDuLieu() {
        String db = jdbc.queryForObject("SELECT DATABASE()", String.class);
        assertTrue(db != null && db.toLowerCase().contains("test"),
                "Từ chối chạy: schema '" + db + "' không phải schema test (tên phải chứa 'test')");

        jdbc.execute("DELETE FROM bang_chung_dong_goi");
        jdbc.execute("DELETE FROM chi_tiet_phieu_xuat_kho");
        jdbc.execute("DELETE FROM phieu_xuat_kho");
        jdbc.execute("UPDATE don_ban_hang SET danh_sach_nhat_hang_id = NULL");
        jdbc.execute("DELETE FROM phan_bo_lo_nhat_hang");
        jdbc.execute("DELETE FROM chi_tiet_nhat_hang");
        jdbc.execute("DELETE FROM danh_sach_nhat_hang");
        jdbc.execute("DELETE FROM chi_tiet_don_ban_hang");
        jdbc.execute("DELETE FROM don_ban_hang");
        jdbc.execute("DELETE FROM lich_su_giao_dich_kho");
        jdbc.execute("UPDATE ton_kho_theo_lo SET so_luong_ton = CASE lo_hang_id "
                + "WHEN 69 THEN 3.000 WHEN 70 THEN 1.000 WHEN 71 THEN 1.000 ELSE so_luong_ton END, "
                + "so_luong_da_dat = 0.000, ngay_xuat_gan_nhat = NULL WHERE kho_id = 1");
        jdbc.execute("UPDATE ton_kho_theo_lo SET ngay_nhap_gan_nhat = CASE lo_hang_id "
                + "WHEN 69 THEN '2026-10-01 08:00:00' WHEN 70 THEN '2026-10-05 08:00:00' WHEN 71 THEN '2026-10-08 08:00:00' "
                + "ELSE ngay_nhap_gan_nhat END WHERE kho_id = 1 AND lo_hang_id IN (69, 70, 71)");
        jdbc.execute("UPDATE bien_the_san_pham SET trang_thai = 1 WHERE id = 93");

        adminId = jdbc.queryForObject(
                "SELECT id FROM nguoi_dung WHERE vai_tro = 'quan_tri_vien' AND trang_thai = 1 ORDER BY id LIMIT 1",
                Integer.class);
        adminToken = jwtService.generateTokenWithPermissions(adminId, "admin-it", "Admin IT",
                "admin-it@nhathang.test", "", Set.of("quan_tri_vien"), 1, Instant.now(), Instant.now(),
                List.of(), "nhathang-it");
    }

    // ===================== tiện ích =====================

    /** Tạo đơn bán ở trạng thái 1 (Chờ xuất kho) tại kho 1, 1 dòng biến thể 93. */
    private int taoDonChoXuat(int soLuong) {
        return taoDonChoXuat(KHO, soLuong);
    }

    /** Tạo đơn bán ở trạng thái 1 (Chờ xuất kho) xuất từ khoXuatId, 1 dòng biến thể 93. */
    private int taoDonChoXuat(int khoXuatId, int soLuong) {
        String so = "IT-NH-" + System.nanoTime() + "-" + (++soDonSeq);
        jdbc.update("INSERT INTO don_ban_hang (so_don_hang, loai_chung_tu, khach_hang_id, kho_xuat_id, ngay_dat_hang, "
                        + "trang_thai, tien_hang, tong_cong) VALUES (?, 'don_ban_hang', ?, ?, NOW(), 1, ?, ?)",
                so, KHACH_HANG, khoXuatId, soLuong * 120000, soLuong * 120000);
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

    private int taoPhieuNhatChuaPhanCong(Integer... donIds) {
        ResponseEntity<Map> res = goi(HttpMethod.POST, "/api/v1/nhat-hang/tao-pick-list",
                Map.of("donBanHangIds", List.of(donIds)));
        assertEquals(HttpStatus.CREATED, res.getStatusCode(), "tạo phiếu nhặt: " + res.getBody());
        return ((Number) data(res).get("id")).intValue();
    }

    /** Tạo phiếu nhặt rồi phân công cho chính quản trị viên đang chạy test (bắt buộc phân công trước khi nhặt). */
    private int taoPhieuNhat(Integer... donIds) {
        int id = taoPhieuNhatChuaPhanCong(donIds);
        ResponseEntity<Map> res = goi(HttpMethod.PUT, "/api/v1/nhat-hang/pick-list/" + id + "/phan-cong",
                Map.of("nguoiNhatId", adminId));
        assertEquals(HttpStatus.OK, res.getStatusCode(), "phân công: " + res.getBody());
        return id;
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

    /**
     * Đóng gói (Scan-to-Pack): quét đủ số lượng của phiếu xuất, nạp 2 ảnh bằng chứng (đơn dưới 1.000.000đ) rồi hoàn tất
     * → phiếu 6 Chờ xuất, đơn 8.
     */
    private void dongGoi(int phieuXuatId) {
        Integer donId = jdbc.queryForObject("SELECT don_ban_hang_id FROM phieu_xuat_kho WHERE id = ?", Integer.class, phieuXuatId);
        for (String loai : List.of("ANH_HANG_TRONG_HOP", "ANH_NIEM_PHONG_TEM_VC")) {
            jdbc.update("INSERT INTO bang_chung_dong_goi (don_ban_hang_id, tep_tin_id, loai_bang_chung, loai_tep, duong_dan_minio, "
                    + "ngay_het_han, trang_thai) VALUES (?, 1, ?, 'IMAGE', 'it/bang-chung.jpg', NOW() + INTERVAL 30 DAY, 1)", donId, loai);
        }
        BigDecimal can = jdbc.queryForObject("SELECT COALESCE(SUM(so_luong_xuat),0) FROM chi_tiet_phieu_xuat_kho "
                + "WHERE phieu_xuat_kho_id = ? AND lo_hang_id IS NULL", BigDecimal.class, phieuXuatId);
        for (int i = 0; i < can.intValue(); i++) {
            ResponseEntity<Map> res = goi(HttpMethod.POST, "/api/v1/dong-goi/phieu/" + phieuXuatId + "/quet", Map.of("barcode", SKU));
            assertEquals(HttpStatus.OK, res.getStatusCode(), "quét đóng gói: " + res.getBody());
        }
        ResponseEntity<Map> xong = goi(HttpMethod.POST, "/api/v1/dong-goi/phieu/" + phieuXuatId + "/hoan-tat", null);
        assertEquals(HttpStatus.OK, xong.getStatusCode(), "hoàn tất đóng gói: " + xong.getBody());
    }

    /** Xác nhận xuất kho: phiếu bán hàng đã có sẵn lô từ phiếu nhặt nên không còn bước chọn lô. */
    private ResponseEntity<Map> xuatKho(int phieuXuatId) {
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
        assertEquals(7, trangThaiDon(don), "đơn chuyển 7 (Chờ đóng gói), chưa được lên 3 khi chưa xuất");
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
        assertEquals(7, trangThaiDon(don));
    }

    @Test
    void t03_dongGoiRoiXuatKho_donLen3_phieuNhatGiuDaNhat() {
        int don = taoDonChoXuat(2);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 2);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());
        int pxk = phieuXuatNhapCuaDon(don);
        dongGoi(pxk);
        assertEquals(8, trangThaiDon(don), "đóng gói xong → Chờ xuất kho");

        assertEquals("69×2", loPhieuXuat(pxk), "phiếu xuất có sẵn lô FIFO từ phiếu nhặt");
        ResponseEntity<Map> xuat = xuatKho(pxk);

        assertEquals(HttpStatus.OK, xuat.getStatusCode(), "xuất kho: " + xuat.getBody());
        assertEquals(3, trangThaiDon(don));
        assertEquals("da_nhat", trangThaiPhieuNhat(phieu), "việc nhặt kết thúc ở Đã nhặt, không còn 'da_xuat'");
        assertEquals(0, new BigDecimal("3").compareTo(tonKho()), "tồn phải giảm 2 sau khi xuất");
    }

    @Test
    void t04_huyDon_dangTrongPhieuNhat_bi409() {
        int don = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don);

        ResponseEntity<Map> res = goi(HttpMethod.PUT, "/api/v1/don-ban-hang/" + don + "/cancel", null);

        assertEquals(HttpStatus.CONFLICT, res.getStatusCode(), "body: " + res.getBody());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("phiếu nhặt hàng"), "body: " + res.getBody());
        assertEquals(1, trangThaiDon(don), "đơn đang trong phiếu nhặt giữ 1 (Chờ nhặt hàng)");
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
        assertEquals(7, trangThaiDon(don1));
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
    void t07_xuatKho_donDaHuySauKhiDongGoi_bi409_khongTruTon() {
        int don = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 1);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());
        Integer pxk = phieuXuatNhapCuaDon(don);
        dongGoi(pxk);
        jdbc.update("UPDATE don_ban_hang SET trang_thai = 4 WHERE id = ?", don); // sàn hủy sau khi đã đóng gói

        ResponseEntity<Map> res = xuatKho(pxk);

        assertEquals(HttpStatus.CONFLICT, res.getStatusCode(), "body: " + res.getBody());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("đã bị hủy"), "body: " + res.getBody());
        assertEquals(0, new BigDecimal("5").compareTo(tonKho()), "không được trừ tồn cho đơn đã hủy");
        assertEquals(4, trangThaiDon(don));
        assertEquals(6, jdbc.queryForObject("SELECT trang_thai FROM phieu_xuat_kho WHERE id = ?", Integer.class, pxk));
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
        assertEquals(1, trangThaiDon(don), "đơn đang nhặt giữ 1 (Chờ nhặt hàng)");
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class));
    }

    @Test
    void t09_phieuNhatHaiDon_xuatTungDon_phieuNhatGiuDaNhat() {
        int don1 = taoDonChoXuat(1);
        int don2 = taoDonChoXuat(1);
        int phieu = taoPhieuNhat(don1, don2);
        quet(phieu, 2);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());

        int pxk1 = phieuXuatNhapCuaDon(don1);
        dongGoi(pxk1);
        assertEquals(HttpStatus.OK, xuatKho(pxk1).getStatusCode());
        assertEquals("da_nhat", trangThaiPhieuNhat(phieu));
        assertEquals(3, trangThaiDon(don1));
        assertEquals(7, trangThaiDon(don2), "đơn 2 vẫn chờ đóng gói");

        int pxk2 = phieuXuatNhapCuaDon(don2);
        dongGoi(pxk2);
        assertEquals(HttpStatus.OK, xuatKho(pxk2).getStatusCode());
        assertEquals("da_nhat", trangThaiPhieuNhat(phieu));
        assertEquals(3, trangThaiDon(don2));
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

    @Test
    void t11_quetKhiChuaPhanCong_bi409_phieuVanChoNhat() {
        int don = taoDonChoXuat(1);
        int phieuNhat = taoPhieuNhatChuaPhanCong(don);

        ResponseEntity<Map> res = goi(HttpMethod.POST, "/api/v1/nhat-hang/pick-list/" + phieuNhat + "/quet-barcode",
                Map.of("barcode", SKU, "soLuong", 1));

        assertEquals(HttpStatus.CONFLICT, res.getStatusCode(), "quét phiếu chưa phân công phải bị chặn: " + res.getBody());
        assertEquals("cho_nhat", trangThaiPhieuNhat(phieuNhat), "phiếu nhặt chưa phân công không được chuyển sang đang nhặt");
    }

    // ===================== nhặt hàng theo lô (Log 2 / Log 4) =====================

    private int dongNhat(int phieuNhatId) {
        return jdbc.queryForObject("SELECT id FROM chi_tiet_nhat_hang WHERE danh_sach_nhat_hang_id = ?", Integer.class, phieuNhatId);
    }

    /** Phân bổ đang lưu của phiếu nhặt, dạng "lô×số" sắp theo lô (vd. "69×3,70×1"). */
    private String phanBo(int phieuNhatId) {
        return String.join(",", jdbc.queryForList("SELECT CONCAT(pb.lo_hang_id, '×', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM pb.so_luong))) "
                + "FROM phan_bo_lo_nhat_hang pb JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id "
                + "WHERE ct.danh_sach_nhat_hang_id = ? ORDER BY pb.lo_hang_id", String.class, phieuNhatId));
    }

    /** Dòng lô của phiếu xuất, dạng "lô×số" sắp theo lô. */
    private String loPhieuXuat(int phieuXuatId) {
        return String.join(",", jdbc.queryForList("SELECT CONCAT(lo_hang_id, '×', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM so_luong_xuat))) "
                + "FROM chi_tiet_phieu_xuat_kho WHERE phieu_xuat_kho_id = ? AND lo_hang_id IS NOT NULL ORDER BY lo_hang_id",
                String.class, phieuXuatId));
    }

    private ResponseEntity<Map> luuPhanBo(int phieuNhatId, int dongId, Object... loVaSoLuong) {
        List<Map<String, Object>> phanBo = new java.util.ArrayList<>();
        for (int i = 0; i < loVaSoLuong.length; i += 2) {
            phanBo.add(Map.of("loHangId", loVaSoLuong[i], "soLuong", loVaSoLuong[i + 1]));
        }
        return goi(HttpMethod.PUT, "/api/v1/nhat-hang/pick-list/" + phieuNhatId + "/chi-tiet/" + dongId + "/phan-bo-lo",
                Map.of("phanBo", phanBo));
    }

    private BigDecimal tonLo(int loHangId) {
        return jdbc.queryForObject("SELECT so_luong_ton FROM ton_kho_theo_lo WHERE kho_id = 1 AND lo_hang_id = ?", BigDecimal.class, loHangId);
    }

    @Test
    void t12_taoPhieuNhat_phanBoFifo_giuLo_vaHienLoKhaDung() {
        int don = taoDonChoXuat(4);
        int phieu = taoPhieuNhat(don);

        assertEquals("69×3,70×1", phanBo(phieu), "FIFO: lô nhập sớm nhất (69, còn 3) trước, thiếu lấy tiếp lô 70");

        ResponseEntity<Map> lo = goi(HttpMethod.GET, "/api/v1/nhat-hang/pick-list/" + phieu + "/chi-tiet/" + dongNhat(phieu) + "/lo-kha-dung", null);
        assertEquals(HttpStatus.OK, lo.getStatusCode(), "lô khả dụng: " + lo.getBody());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> lots = (List<Map<String, Object>>) lo.getBody().get("data");
        assertEquals(List.of(69, 70, 71), lots.stream().map(m -> ((Number) m.get("loHangId")).intValue()).toList(), "sắp FIFO");
        assertEquals(0, new BigDecimal("3").compareTo(new BigDecimal(String.valueOf(lots.get(0).get("conLai")))),
                "phần của chính dòng không bị tính là đang giữ");
        assertEquals(0, new BigDecimal("3").compareTo(new BigDecimal(String.valueOf(lots.get(0).get("daPhanBo")))));

        ResponseEntity<Map> chiTiet = goi(HttpMethod.GET, "/api/v1/nhat-hang/pick-list/" + phieu, null);
        @SuppressWarnings("unchecked")
        Map<String, Object> dong = ((List<Map<String, Object>>) data(chiTiet).get("chiTietNhatHangs")).get(0);
        assertEquals(2, ((List<?>) dong.get("phanBoLo")).size());
        assertEquals(Boolean.FALSE, dong.get("phanBoThuCong"));
        assertNull(dong.get("viTriKho"), "không còn vị trí kệ gán cứng");
    }

    @Test
    void t13_haiDon_chiaLo_donDatTruocNhanLoCu_xuatKhongCanChonLo() {
        int donA = taoDonChoXuat(3);
        int donB = taoDonChoXuat(2);
        jdbc.update("UPDATE don_ban_hang SET ngay_dat_hang = NOW() - INTERVAL 1 HOUR WHERE id = ?", donA);
        int phieu = taoPhieuNhat(donA, donB);
        assertEquals("69×3,70×1,71×1", phanBo(phieu));
        quet(phieu, 5);

        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());

        int pxkA = phieuXuatNhapCuaDon(donA);
        int pxkB = phieuXuatNhapCuaDon(donB);
        assertEquals("69×3", loPhieuXuat(pxkA), "đơn đặt trước nhận lô cũ nhất");
        assertEquals("70×1,71×1", loPhieuXuat(pxkB), "một đơn nhận được nhiều lô");

        dongGoi(pxkA);
        assertEquals(HttpStatus.OK, xuatKho(pxkA).getStatusCode());
        dongGoi(pxkB);
        assertEquals(HttpStatus.OK, xuatKho(pxkB).getStatusCode());
        assertEquals(0, BigDecimal.ZERO.compareTo(tonKho()), "xuất hết 5 theo đúng lô");
        assertEquals(3, trangThaiDon(donA));
        assertEquals(3, trangThaiDon(donB));
    }

    @Test
    void t14_nguoiNhatSuaPhanBoTay_phieuXuatDungLoDaSua() {
        int don = taoDonChoXuat(2);
        int phieu = taoPhieuNhat(don);
        assertEquals("69×2", phanBo(phieu));

        ResponseEntity<Map> sua = luuPhanBo(phieu, dongNhat(phieu), 70, 1, 71, 1);
        assertEquals(HttpStatus.OK, sua.getStatusCode(), "lưu phân bổ: " + sua.getBody());
        assertEquals("70×1,71×1", phanBo(phieu));
        @SuppressWarnings("unchecked")
        Map<String, Object> dong = ((List<Map<String, Object>>) data(sua).get("chiTietNhatHangs")).get(0);
        assertEquals(Boolean.TRUE, dong.get("phanBoThuCong"));

        quet(phieu, 2);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());
        int pxk = phieuXuatNhapCuaDon(don);
        assertEquals("70×1,71×1", loPhieuXuat(pxk));

        ResponseEntity<Map> sauHoanTat = luuPhanBo(phieu, dongNhat(phieu), 69, 2);
        assertEquals(HttpStatus.CONFLICT, sauHoanTat.getStatusCode(), "khóa phân bổ sau hoàn tất: " + sauHoanTat.getBody());
    }

    @Test
    void t15_luuPhanBo_tuChoiDuLieuSai() {
        int don = taoDonChoXuat(2);
        int phieu = taoPhieuNhat(don);
        int dong = dongNhat(phieu);
        // Lô của một biến thể khác (dữ liệu mẫu chỉ có lô của biến thể 93)
        if (jdbc.queryForObject("SELECT COUNT(*) FROM lo_hang WHERE ma_lo = 'IT-LO-KHAC'", Integer.class) == 0) {
            jdbc.update("INSERT INTO lo_hang (bien_the_san_pham_id, ma_lo, gia_von) "
                    + "SELECT id, 'IT-LO-KHAC', 100000 FROM bien_the_san_pham WHERE id <> 93 ORDER BY id LIMIT 1");
        }
        Integer loKhacBienThe = jdbc.queryForObject("SELECT id FROM lo_hang WHERE ma_lo = 'IT-LO-KHAC'", Integer.class);

        ResponseEntity<Map> saiTong = luuPhanBo(phieu, dong, 69, 1);
        assertEquals(HttpStatus.BAD_REQUEST, saiTong.getStatusCode(), "tổng khác số cần nhặt: " + saiTong.getBody());

        ResponseEntity<Map> vuotLo = luuPhanBo(phieu, dong, 70, 2);
        assertEquals(HttpStatus.CONFLICT, vuotLo.getStatusCode(), "lô 70 chỉ còn 1: " + vuotLo.getBody());

        ResponseEntity<Map> loKhac = luuPhanBo(phieu, dong, loKhacBienThe, 2);
        assertEquals(HttpStatus.BAD_REQUEST, loKhac.getStatusCode(), "lô của sản phẩm khác: " + loKhac.getBody());

        ResponseEntity<Map> am = luuPhanBo(phieu, dong, 69, 3, 70, -1);
        assertEquals(HttpStatus.BAD_REQUEST, am.getStatusCode(), "số âm: " + am.getBody());

        assertEquals("69×2", phanBo(phieu), "lưu lỗi thì giữ nguyên phân bổ cũ");
    }

    @Test
    void t16_phanBoGiuLo_phieuNhatSauChiThayPhanConLai() {
        int donA = taoDonChoXuat(3);
        int phieuA = taoPhieuNhat(donA);
        assertEquals("69×3", phanBo(phieuA));

        int donB = taoDonChoXuat(2);
        int phieuB = taoPhieuNhat(donB);
        assertEquals("70×1,71×1", phanBo(phieuB), "lô 69 đang bị phiếu A giữ hết");

        ResponseEntity<Map> lo = goi(HttpMethod.GET, "/api/v1/nhat-hang/pick-list/" + phieuB + "/chi-tiet/" + dongNhat(phieuB) + "/lo-kha-dung", null);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> lots = (List<Map<String, Object>>) lo.getBody().get("data");
        assertEquals(0, BigDecimal.ZERO.compareTo(new BigDecimal(String.valueOf(lots.get(0).get("conLai")))),
                "phiếu B thấy lô 69 còn 0");

        ResponseEntity<Map> layLoDangGiu = luuPhanBo(phieuB, dongNhat(phieuB), 69, 1, 70, 1);
        assertEquals(HttpStatus.CONFLICT, layLoDangGiu.getStatusCode(), "body: " + layLoDangGiu.getBody());
    }

    @Test
    void t17_tonTheoLoKhongDu_chanHoanTat_khongTaoPhieuXuat() {
        // a) Phân bổ đã lưu không còn đủ (kiểm kê giảm tồn lô 71 sau khi tạo phiếu nhặt)
        int don = taoDonChoXuat(5);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 5);
        jdbc.update("UPDATE ton_kho_theo_lo SET so_luong_ton = 0 WHERE kho_id = 1 AND lo_hang_id = 71");

        ResponseEntity<Map> res = hoanTat(phieu);
        assertEquals(HttpStatus.CONFLICT, res.getStatusCode(), "body: " + res.getBody());
        assertTrue(String.valueOf(res.getBody().get("message")).contains("phân bổ lại"), "body: " + res.getBody());
        assertEquals("dang_nhat", trangThaiPhieuNhat(phieu));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class));

        // b) Cần nhiều hơn tổng tồn các lô: bù FIFO không đủ → chặn, báo kiểm kê
        jdbc.update("UPDATE ton_kho_theo_lo SET so_luong_ton = 1 WHERE kho_id = 1 AND lo_hang_id = 71");
        jdbc.update("UPDATE chi_tiet_don_ban_hang SET so_luong_dat = 6 WHERE don_ban_hang_id = ?", don);
        jdbc.update("UPDATE chi_tiet_nhat_hang SET so_luong_can_nhat = 6, so_luong_da_quet = 6 WHERE danh_sach_nhat_hang_id = ?", phieu);

        ResponseEntity<Map> thieu = hoanTat(phieu);
        assertEquals(HttpStatus.CONFLICT, thieu.getStatusCode(), "body: " + thieu.getBody());
        assertTrue(String.valueOf(thieu.getBody().get("message")).contains("Không đủ tồn theo lô"), "body: " + thieu.getBody());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class));
    }

    @Test
    void t18_xuatBan_khongAnPhanDangGiuCuaChuyenKho() {
        // Lô 69 có 1 chiếc phiếu chuyển kho đang giữ (so_luong_da_dat) → phiếu nhặt chỉ lấy 2 từ lô 69
        jdbc.update("UPDATE ton_kho_theo_lo SET so_luong_da_dat = 1 WHERE kho_id = 1 AND lo_hang_id = 69");
        int don = taoDonChoXuat(3);
        int phieu = taoPhieuNhat(don);
        assertEquals("69×2,70×1", phanBo(phieu));
        quet(phieu, 3);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());
        int pxk = phieuXuatNhapCuaDon(don);
        dongGoi(pxk);

        assertEquals(HttpStatus.OK, xuatKho(pxk).getStatusCode());

        assertEquals(0, BigDecimal.ONE.compareTo(tonLo(69)), "lô 69 còn đúng chiếc chuyển kho đang giữ");
        assertEquals(0, BigDecimal.ONE.compareTo(jdbc.queryForObject(
                "SELECT so_luong_da_dat FROM ton_kho_theo_lo WHERE kho_id = 1 AND lo_hang_id = 69", BigDecimal.class)),
                "xuất bán không được trừ so_luong_da_dat");
    }

    @Test
    void t19_taoPhieuXuatBanHangTay_biChan() {
        int don = taoDonChoXuat(1);

        ResponseEntity<Map> res = goi(HttpMethod.POST, "/api/v1/phieu-xuat-kho/create",
                Map.of("donBanHangId", don, "khoId", KHO, "chiTietXuat", List.of(Map.of("bienTheSanPhamId", BIEN_THE, "soLuongXuat", 1))));

        assertEquals(HttpStatus.CONFLICT, res.getStatusCode(), "body: " + res.getBody());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho", Integer.class));
        assertEquals(1, trangThaiDon(don));
    }

    @Test
    void t20_huyPhieuXuat_taoLai_chepLoCu_loHetThiQuanLySuaLo() {
        int don = taoDonChoXuat(2);
        int phieu = taoPhieuNhat(don);
        quet(phieu, 2);
        assertEquals(HttpStatus.OK, hoanTat(phieu).getStatusCode());
        int pxk1 = phieuXuatNhapCuaDon(don);
        assertEquals("69×2", loPhieuXuat(pxk1));

        // Lần 1: hủy rồi tạo lại → chép đúng lô cũ, đơn về Chờ đóng gói
        assertEquals(HttpStatus.OK, goi(HttpMethod.PUT, "/api/v1/phieu-xuat-kho/" + pxk1 + "/cancel", null).getStatusCode());
        assertEquals(1, trangThaiDon(don));
        ResponseEntity<Map> taoLai = goi(HttpMethod.POST, "/api/v1/phieu-xuat-kho/tao-lai-theo-don/" + don, null);
        assertEquals(HttpStatus.OK, taoLai.getStatusCode(), "tạo lại: " + taoLai.getBody());
        int pxk2 = ((Number) data(taoLai).get("phieuXuatKhoId")).intValue();
        assertEquals("69×2", loPhieuXuat(pxk2));
        assertEquals(List.of(), data(taoLai).get("canSuaLo"));
        assertEquals(7, trangThaiDon(don));

        // Lần 2: lô cũ đã bị nơi khác lấy hết → phiếu mới thiếu lô, quản lý kho sửa lô rồi xuất được
        assertEquals(HttpStatus.OK, goi(HttpMethod.PUT, "/api/v1/phieu-xuat-kho/" + pxk2 + "/cancel", null).getStatusCode());
        jdbc.update("UPDATE ton_kho_theo_lo SET so_luong_ton = 0 WHERE kho_id = 1 AND lo_hang_id = 69");
        ResponseEntity<Map> taoLai2 = goi(HttpMethod.POST, "/api/v1/phieu-xuat-kho/tao-lai-theo-don/" + don, null);
        assertEquals(HttpStatus.OK, taoLai2.getStatusCode(), "tạo lại lần 2: " + taoLai2.getBody());
        int pxk3 = ((Number) data(taoLai2).get("phieuXuatKhoId")).intValue();
        assertEquals(List.of(SKU), data(taoLai2).get("canSuaLo"));
        assertEquals("", loPhieuXuat(pxk3));

        Integer dongGoc = jdbc.queryForObject("SELECT id FROM chi_tiet_phieu_xuat_kho WHERE phieu_xuat_kho_id = ? "
                + "AND lo_hang_id IS NULL", Integer.class, pxk3);
        ResponseEntity<Map> suaLo = goi(HttpMethod.POST, "/api/v1/phieu-xuat-kho/" + pxk3 + "/pick-lo",
                Map.of("chiTietPhieuXuatKhoId", dongGoc, "loHangPicks", List.of(
                        Map.of("loHangId", 70, "soLuongXuat", 1), Map.of("loHangId", 71, "soLuongXuat", 1))));
        assertEquals(HttpStatus.OK, suaLo.getStatusCode(), "sửa lô: " + suaLo.getBody());
        dongGoi(pxk3);
        assertEquals(HttpStatus.OK, xuatKho(pxk3).getStatusCode());
        assertEquals(3, trangThaiDon(don));
    }

    // ===================== tồn khả dụng sau giữ lô =====================

    /** Cờ duHang của từng đơn ở màn Đơn chờ xuất (kho 1). */
    @SuppressWarnings("unchecked")
    private Map<Integer, Boolean> duHangDonCho() {
        ResponseEntity<Map> res = goi(HttpMethod.POST, "/api/v1/nhat-hang/don-cho-xuat", Map.of("size", 50));
        assertEquals(HttpStatus.OK, res.getStatusCode(), "đơn chờ xuất: " + res.getBody());
        Map<Integer, Boolean> ketQua = new HashMap<>();
        for (Map<String, Object> d : (List<Map<String, Object>>) data(res).get("content")) {
            ketQua.put(((Number) d.get("id")).intValue(), (Boolean) d.get("duHang"));
        }
        return ketQua;
    }

    /** Tồn đẩy lên sàn của biến thể 93 (toàn chuỗi). */
    private BigDecimal tonDayLenSan() {
        return (BigDecimal) tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(List.of(BIEN_THE)).get(0)[1];
    }

    @Test
    void t21_donChoXuat_coDuHang_truPhanLoDangGiu() {
        int donA = taoDonChoXuat(3);
        int donB = taoDonChoXuat(2);
        int donC = taoDonChoXuat(3);
        assertEquals(Boolean.TRUE, duHangDonCho().get(donC), "chưa ai giữ lô: tồn 5 đủ cho 3");

        // Phiếu nhặt của A giữ lô 69 × 3 → còn lô 70 + 71 = 2
        int phieuA = taoPhieuNhat(donA);
        assertEquals("69×3", phanBo(phieuA));
        BigDecimal sanTruoc = tonDayLenSan();
        Map<Integer, Boolean> co = duHangDonCho();
        assertEquals(Boolean.TRUE, co.get(donB), "B cần 2, còn 2");
        assertEquals(Boolean.FALSE, co.get(donC), "C cần 3, còn 2 (trước đây báo Đủ hàng vì chỉ trừ so_luong_da_dat)");
        assertNull(co.get(donA), "đơn đã vào phiếu nhặt không còn ở Đơn chờ xuất");
        assertEquals(0, sanTruoc.compareTo(tonDayLenSan()), "xem Đơn chờ xuất không đổi tồn đẩy sàn");

        // Hoàn tất nhặt: phần giữ chuyển sang dòng lô của phiếu xuất nháp → C vẫn thiếu
        quet(phieuA, 3);
        assertEquals(HttpStatus.OK, hoanTat(phieuA).getStatusCode());
        int pxkA = phieuXuatNhapCuaDon(donA);
        assertEquals(Boolean.FALSE, duHangDonCho().get(donC));

        // Hủy phiếu xuất của A → lô được trả, C đủ hàng
        assertEquals(HttpStatus.OK, goi(HttpMethod.PUT, "/api/v1/phieu-xuat-kho/" + pxkA + "/cancel", null).getStatusCode());
        assertEquals(Boolean.TRUE, duHangDonCho().get(donC));
    }

    @Test
    void t22_taoYeuCauChuyenKho_truDonDangChoXuat_khongTruLoHaiLan() {
        int khoNhan = jdbc.queryForObject("SELECT id FROM kho WHERE trang_thai = 1 AND UPPER(ma_kho) <> 'KHO_TRANSIT' "
                + "AND id <> ? ORDER BY id LIMIT 1", Integer.class, KHO);
        // Đơn A cần 3 đã vào phiếu nhặt (giữ lô 69 × 3), đơn B cần 1 đang chờ → chờ xuất 4, khả dụng 5 − 4 = 1
        int donA = taoDonChoXuat(3);
        taoPhieuNhat(donA);
        taoDonChoXuat(1);
        // Đơn đã hủy và báo giá không giữ hàng
        jdbc.update("UPDATE don_ban_hang SET trang_thai = 4 WHERE id = ?", taoDonChoXuat(3));
        jdbc.update("UPDATE don_ban_hang SET loai_chung_tu = 'bao_gia' WHERE id = ?", taoDonChoXuat(2));
        BigDecimal sanTruoc = tonDayLenSan();

        ResponseEntity<Map> qua = goi(HttpMethod.POST, "/api/v1/phieu-chuyen-kho/create", Map.of(
                "khoXuatId", KHO, "khoNhapId", khoNhan,
                "chiTietXuat", List.of(Map.of("bienTheSanPhamId", BIEN_THE, "soLuongXuat", 2))));
        assertEquals(HttpStatus.BAD_REQUEST, qua.getStatusCode(), "body: " + qua.getBody());
        String loi = String.valueOf(qua.getBody().get("message"));
        assertTrue(loi.contains("chỉ còn 1") && loi.contains("đơn bán đang chờ xuất 4") && loi.contains("Yêu cầu: 2."), loi);
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho WHERE loai_xuat = 'khac'", Integer.class));

        // Trừ thêm phần lô phiếu nhặt đang giữ (3) thì 1 cũng bị chặn — đúng là chỉ trừ một lần
        ResponseEntity<Map> du = goi(HttpMethod.POST, "/api/v1/phieu-chuyen-kho/create", Map.of(
                "khoXuatId", KHO, "khoNhapId", khoNhan,
                "chiTietXuat", List.of(Map.of("bienTheSanPhamId", BIEN_THE, "soLuongXuat", 1))));
        assertEquals(HttpStatus.OK, du.getStatusCode(), "body: " + du.getBody());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM phieu_xuat_kho WHERE loai_xuat = 'khac'", Integer.class));

        // Yêu cầu chuyển kho chỉ kiểm, không giữ hàng: so_luong_da_dat và tồn đẩy sàn giữ nguyên
        assertEquals(0, BigDecimal.ZERO.compareTo(jdbc.queryForObject("SELECT COALESCE(SUM(so_luong_da_dat),0) "
                + "FROM ton_kho_theo_lo WHERE kho_id = 1 AND lo_hang_id IN (69,70,71)", BigDecimal.class)));
        assertEquals(0, sanTruoc.compareTo(tonDayLenSan()), "tạo yêu cầu chuyển kho không đổi tồn đẩy sàn");
    }

    // ===================== đề xuất bổ sung ở Tổng quan =====================

    /** Dòng Đề xuất bổ sung của (kho, biến thể 93) ở Tổng quan, tính lại ngay (không dùng bản giữ 60 giây). */
    @SuppressWarnings("unchecked")
    private Map<String, Object> dongBoSung(int khoId) {
        ResponseEntity<Map> res = goi(HttpMethod.GET, "/api/v1/admin/dashboard/tong-quan?lamMoi=true", null);
        assertEquals(HttpStatus.OK, res.getStatusCode(), "tổng quan: " + res.getBody());
        Map<String, Object> boSung = (Map<String, Object>) data(res).get("hangCanBoSung");
        assertNotNull(boSung, "khối Đề xuất bổ sung lỗi: " + data(res).get("khoiLoi"));
        return ((List<Map<String, Object>>) boSung.get("dong")).stream()
                .filter(d -> ((Number) d.get("khoId")).intValue() == khoId && ((Number) d.get("bienTheId")).intValue() == BIEN_THE)
                .findFirst().orElseThrow(() -> new AssertionError("không có dòng kho " + khoId + ": " + boSung));
    }

    private static long so(Map<String, Object> d, String truong) {
        return ((Number) d.get(truong)).longValue();
    }

    @Test
    void t23_deXuatBoSung_soKhoTongTruDonChoXuat_nutChuyenTaoDuocPhieu() {
        int khoTong = jdbc.queryForObject("SELECT id FROM kho WHERE loai_kho = 'kho_tong' AND trang_thai = 1", Integer.class);
        assertNotEquals(KHO, khoTong, "kho 1 phải là kho bán hàng cần bổ sung");
        // Đề xuất bổ sung chỉ xét mã đang kinh doanh; ca trước xuất hết hàng có thể đã tự chuyển sản phẩm về 0
        jdbc.update("UPDATE san_pham_quan_ao SET trang_thai = 1 WHERE id = "
                + "(SELECT san_pham_id FROM bien_the_san_pham WHERE id = ?)", BIEN_THE);
        jdbc.update("DELETE FROM ton_kho_theo_lo WHERE kho_id = ? AND lo_hang_id = 69", khoTong);
        jdbc.update("INSERT INTO ton_kho_theo_lo (lo_hang_id, kho_id, so_luong_ton, so_luong_da_dat, ngay_nhap_gan_nhat) "
                + "VALUES (69, ?, 60, 0, '2026-10-01 08:00:00')", khoTong);
        try {
            // Kho 1 khả dụng 5, ngưỡng của sản phẩm 25 → cần 2 × 25 − 5 = 45. Kho tổng: tồn 60, đơn bán chờ xuất 20.
            assertEquals(25, jdbc.queryForObject("SELECT sp.muc_ton_toi_thieu FROM bien_the_san_pham bt "
                    + "JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id WHERE bt.id = ?", Integer.class, BIEN_THE),
                    "dữ liệu mẫu: ngưỡng tối thiểu của sản phẩm");
            int donLon = taoDonChoXuat(khoTong, 20);
            BigDecimal sanTruoc = tonDayLenSan();

            Map<String, Object> d = dongBoSung(KHO);
            assertEquals(45, so(d, "soLuongDeXuat"));
            assertEquals(40, so(d, "khaDungKhoTong"), "Kho tổng có thể chuyển = 60 − 20");
            assertEquals(20, so(d, "choXuatKhoTong"));
            assertEquals("yeu_cau_nhap", d.get("deXuat"), "trước khi sửa ra chuyen_kho vì 60 ≥ 45");
            assertEquals(0, sanTruoc.compareTo(tonDayLenSan()), "xem Tổng quan không đổi tồn đẩy sàn");

            // Số cũ (60) sẽ đề xuất chuyển 45; bước tạo phiếu chặn ở đúng con số mà Tổng quan nay hiện
            ResponseEntity<Map> chan = goi(HttpMethod.POST, "/api/v1/phieu-chuyen-kho/create", Map.of(
                    "khoXuatId", khoTong, "khoNhapId", KHO,
                    "chiTietXuat", List.of(Map.of("bienTheSanPhamId", BIEN_THE, "soLuongXuat", 45))));
            assertEquals(HttpStatus.BAD_REQUEST, chan.getStatusCode(), "body: " + chan.getBody());
            assertTrue(String.valueOf(chan.getBody().get("message")).contains("chỉ còn 40"), chan.getBody().toString());

            // Đơn lớn hủy, còn đơn chờ xuất 10 → có thể chuyển 50 ≥ 45: nút "Chuyển" điền sẵn đúng số, tạo được phiếu
            jdbc.update("UPDATE don_ban_hang SET trang_thai = 4 WHERE id = ?", donLon);
            taoDonChoXuat(khoTong, 10);
            d = dongBoSung(KHO);
            assertEquals("chuyen_kho", d.get("deXuat"));
            assertEquals(50, so(d, "khaDungKhoTong"));
            assertEquals(10, so(d, "choXuatKhoTong"));
            ResponseEntity<Map> tao = goi(HttpMethod.POST, "/api/v1/phieu-chuyen-kho/create", Map.of(
                    "khoXuatId", khoTong, "khoNhapId", KHO,
                    "chiTietXuat", List.of(Map.of("bienTheSanPhamId", BIEN_THE, "soLuongXuat", so(d, "soLuongDeXuat")))));
            assertEquals(HttpStatus.OK, tao.getStatusCode(), "body: " + tao.getBody());
        } finally {
            jdbc.update("DELETE FROM ton_kho_theo_lo WHERE kho_id = ? AND lo_hang_id = 69", khoTong);
        }
    }
}
