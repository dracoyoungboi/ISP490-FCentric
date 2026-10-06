package com.dev.backend.pos;

import com.dev.backend.entities.*;
import com.dev.backend.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Xác minh rủi ro tinyint(1) trên cấu hình STAGING (Phase 06) — CHỈ ĐỌC:
 * so sánh giá trị RAW (getInt qua JdbcTemplate = chính driver 9.4.0 của app,
 * URL giống dev — KHÔNG có tinyInt1isBit) với giá trị nạp qua Hibernate entity.
 * Không sửa gì; nếu fail -> cần cấu hình staging riêng (xem 06-staging-report.md).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PosStagingDataVerificationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        String base = System.getProperty("pos.it.db.url",
                "jdbc:mysql://127.0.0.1:3307/fcentric_pos05?allowMultiQueries=true&useSSL=false&serverTimezone=UTC&characterEncoding=UTF-8");
        registry.add("spring.datasource.url", () -> base);
        registry.add("spring.datasource.username", () -> System.getProperty("pos.it.db.user", "root"));
        registry.add("spring.datasource.password", () -> System.getProperty("pos.it.db.pass", ""));
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
    }

    @Autowired private JdbcTemplate jdbc;
    @Autowired private DonBanHangRepository donBanHangRepository;
    @Autowired private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Autowired private SanPhamQuanAoRepository sanPhamQuanAoRepository;
    @Autowired private KhachHangRepository khachHangRepository;
    @Autowired private NguoiDungRepository nguoiDungRepository;
    @Autowired private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;
    @Autowired private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Autowired private AnhQuanAoRepository anhQuanAoRepository;

    @Test
    @Transactional
    void bienThe93_trangThai_rawSoVoiEntity() {
        Integer raw = jdbc.queryForObject("SELECT trang_thai FROM bien_the_san_pham WHERE id = 93", Integer.class);
        BienTheSanPham e = bienTheSanPhamRepository.findById(93).orElseThrow();
        assertEquals(raw, e.getTrangThai(), "bien_the_san_pham.trang_thai entity phải bằng giá trị raw");
        assertEquals(1, e.getTrangThai());
    }

    @Test
    @Transactional
    void sanPham59_trangThai_rawSoVoiEntity() {
        Integer raw = jdbc.queryForObject("SELECT trang_thai FROM san_pham_quan_ao WHERE id = 59", Integer.class);
        SanPhamQuanAo e = sanPhamQuanAoRepository.findById(59).orElseThrow();
        assertEquals(raw, e.getTrangThai(), "san_pham_quan_ao.trang_thai entity phải bằng giá trị raw");
    }

    @Test
    @Transactional
    void khachHangKHLE_trangThai_rawSoVoiEntity() {
        Integer id = jdbc.queryForObject("SELECT id FROM khach_hang WHERE ma_khach_hang = 'KHLE'", Integer.class);
        Integer raw = jdbc.queryForObject("SELECT trang_thai FROM khach_hang WHERE id = ?", Integer.class, id);
        KhachHang e = khachHangRepository.findById(id).orElseThrow();
        assertEquals(raw, e.getTrangThai(), "khach_hang.trang_thai entity phải bằng giá trị raw");
        assertEquals(1, e.getTrangThai());
    }

    @Test
    @Transactional
    void nguoiDungPosdemo_trangThai_rawSoVoiEntity() {
        Integer id = jdbc.queryForObject("SELECT id FROM nguoi_dung WHERE ten_dang_nhap = 'posdemo'", Integer.class);
        Integer raw = jdbc.queryForObject("SELECT trang_thai FROM nguoi_dung WHERE id = ?", Integer.class, id);
        NguoiDung e = nguoiDungRepository.findById(id).orElseThrow();
        assertEquals(raw, e.getTrangThai(), "nguoi_dung.trang_thai entity phải bằng giá trị raw");
    }

    @Test
    @Transactional
    void phanQuyenKho_trangThai_rawSoVoiEntity() {
        Integer id = jdbc.queryForObject(
                "SELECT p.id FROM phan_quyen_nguoi_dung_kho p JOIN nguoi_dung n ON n.id = p.nguoi_dung_id "
                        + "WHERE n.ten_dang_nhap = 'posdemo' AND p.kho_id = 1", Integer.class);
        Integer raw = jdbc.queryForObject("SELECT trang_thai FROM phan_quyen_nguoi_dung_kho WHERE id = ?", Integer.class, id);
        PhanQuyenNguoiDungKho e = phanQuyenNguoiDungKhoRepository.findById(id).orElseThrow();
        assertEquals(raw, e.getTrangThai(), "phan_quyen_nguoi_dung_kho.trang_thai entity phải bằng giá trị raw");
    }

    @Test
    @Transactional
    void tonKho_theoLo_rawSoVoiEntity() {
        for (int id : new int[]{72, 73, 74}) {
            BigDecimal rawTon = jdbc.queryForObject("SELECT so_luong_ton FROM ton_kho_theo_lo WHERE id = ?", BigDecimal.class, id);
            BigDecimal rawDat = jdbc.queryForObject("SELECT so_luong_da_dat FROM ton_kho_theo_lo WHERE id = ?", BigDecimal.class, id);
            TonKhoTheoLo e = tonKhoTheoLoRepository.findById(id).orElseThrow();
            assertEquals(0, rawTon.compareTo(e.getSoLuongTon()), "ton row " + id + " so_luong_ton phải bằng raw");
            assertEquals(0, rawDat.compareTo(e.getSoLuongDaDat()), "ton row " + id + " so_luong_da_dat phải bằng raw");
        }
    }

    @Test
    @Transactional
    void donBanHang_trangThai5_quaEntity() {
        // Test QUYẾT ĐỊNH: tinyint(1) chứa giá trị KHÔNG nhị phân (5 = Hoàn thành).
        // Ghi test row bằng SQL rồi đọc qua Hibernate entity (driver 9.4.0 của app, URL giống dev).
        jdbc.update("INSERT INTO don_ban_hang (so_don_hang, loai_chung_tu, khach_hang_id, kho_xuat_id, ngay_dat_hang, ngay_giao_hang, trang_thai, tien_hang, phi_van_chuyen, tong_cong, trang_thai_thanh_toan, nguoi_tao_id) "
                + "VALUES ('VERIFY-5', 'don_ban_hang', (SELECT MIN(id) FROM khach_hang), 1, NOW(), NOW(), 5, 120000, 0, 120000, 'da_thanh_toan', (SELECT MIN(id) FROM nguoi_dung))");
        Integer id = jdbc.queryForObject("SELECT id FROM don_ban_hang WHERE so_don_hang = 'VERIFY-5'", Integer.class);
        DonBanHang e = donBanHangRepository.findById(id).orElseThrow();
        System.out.println("VERIFY don.trangThai qua entity = " + e.getTrangThai());
        assertEquals(5, e.getTrangThai(), "entity PHẢI đọc đúng 5 (không bị ép Boolean)");
        assertEquals("da_thanh_toan", e.getTrangThaiThanhToan());
        jdbc.update("DELETE FROM don_ban_hang WHERE so_don_hang = 'VERIFY-5'");
    }
}
