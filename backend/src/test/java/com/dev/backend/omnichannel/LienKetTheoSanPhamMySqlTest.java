package com.dev.backend.omnichannel;

import com.dev.backend.dto.response.customize.NhomLienKetDto;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.entities.KenhBanHangDongBoServiceImpl;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Kiểm thử trên MySQL thật cho danh sách liên kết phân trang theo sản phẩm (màn Sản phẩm Shopify):
 * chạy đúng các truy vấn JPQL qua Spring Data + Hibernate (MySQL bật ONLY_FULL_GROUP_BY), không dựng cả ứng dụng.
 *
 * Yêu cầu schema MySQL DÙNG RIÊNG CHO TEST (tên phải chứa "test"):
 *   import Database/MyDB_v1.3.sql + size_thu_tu_v1.sql + ton_da_day_kenh_v1.sql (và các script khác như các test tích hợp còn lại).
 *   Bảng kenh_ban_hang phải có đủ cột như entity KenhBanHang (client_id, refresh_token, token_expires_at) giống DB dev.
 * Test tự thêm dữ liệu mẫu có mã bắt đầu bằng "ITLK" vào kênh SHOPIFY rồi tự xóa khi xong.
 * Mặc định: jdbc:mysql://127.0.0.1:3307/fcentric_pick_test (root, mật khẩu rỗng).
 * Chạy: mvn test -Dtest=LienKetTheoSanPhamMySqlTest -Dlienket.it=true
 *   (đổi DB bằng -Dlienket.it.db.url=..., -Dlienket.it.db.user=..., -Dlienket.it.db.pass=...)
 */
@EnabledIfSystemProperty(named = "lienket.it", matches = "true")
class LienKetTheoSanPhamMySqlTest {

    private static final String MA = "ITLK";
    private static final List<String> MAU = List.of("Nâu", "Đen", "Kem", "Xanh than");
    /** Kích cỡ theo thứ tự hiển thị đúng (size_thu_tu_v1.sql): id không theo thứ tự này (XL tạo trước L). */
    private static final List<String> KICH_CO = List.of("XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL");

    private static LocalContainerEntityManagerFactoryBean emfBean;
    private static JdbcTemplate jdbc;
    private static SingleConnectionDataSource ketNoiMau;
    private static TransactionTemplate giaoDich;
    private static KenhBanHangDongBoServiceImpl service;
    private static int kenhShopifyId;
    /** Mã sản phẩm → số SKU đã liên kết */
    private static final Map<String, Integer> SO_SKU = new LinkedHashMap<>();
    private static final Map<String, Integer> ID_SAN_PHAM = new HashMap<>();
    private static String skuMotPhanLoaiCuaB;

    @BeforeAll
    static void khoiTao() {
        String url = System.getProperty("lienket.it.db.url",
                "jdbc:mysql://127.0.0.1:3307/fcentric_pick_test?useSSL=false&serverTimezone=UTC"
                        + "&characterEncoding=UTF-8&allowPublicKeyRetrieval=true");
        String user = System.getProperty("lienket.it.db.user", "root");
        String pass = System.getProperty("lienket.it.db.pass", "");
        DriverManagerDataSource ds = new DriverManagerDataSource(url, user, pass);
        // Dữ liệu mẫu dùng LAST_INSERT_ID() nên phải đi trên cùng một kết nối
        ketNoiMau = new SingleConnectionDataSource(url, user, pass, true);
        jdbc = new JdbcTemplate(ketNoiMau);
        String db = jdbc.queryForObject("SELECT DATABASE()", String.class);
        assertTrue(db != null && db.toLowerCase().contains("test"),
                "Từ chối chạy: schema '" + db + "' không phải schema test (tên phải chứa 'test')");

        emfBean = new LocalContainerEntityManagerFactoryBean();
        emfBean.setDataSource(ds);
        emfBean.setPackagesToScan("com.dev.backend.entities");
        emfBean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        Properties p = new Properties();
        p.put("hibernate.hbm2ddl.auto", "none");
        p.put("hibernate.type.preferred_instant_jdbc_type", "TIMESTAMP");
        emfBean.setJpaProperties(p);
        emfBean.afterPropertiesSet();
        EntityManagerFactory emf = emfBean.getObject();
        giaoDich = new TransactionTemplate(new JpaTransactionManager(emf));
        giaoDich.setReadOnly(true);

        // Như Spring: EntityManager theo giao dịch, repository tạo từ đúng interface của ứng dụng (kiểm tra luôn @Query)
        EntityManager em = SharedEntityManagerCreator.createSharedEntityManager(emf);
        JpaRepositoryFactory factory = new JpaRepositoryFactory(em);
        service = new KenhBanHangDongBoServiceImpl(
                factory.getRepository(KenhBanHangRepository.class),
                factory.getRepository(TrangThaiDongBoSanPhamRepository.class),
                mock(BienTheSanPhamRepository.class),
                mock(TonKhoTheoLoRepository.class),
                mock(KenhBanHangService.class),
                mock(LichSuThayDoiService.class),
                mock(NguoiDungRepository.class),
                factory.getRepository(AnhQuanAoRepository.class),
                mock(AnhBienTheRepository.class),
                mock(MinioService.class),
                mock(KhoRepository.class),
                factory.getRepository(TonKhoTongHopRepository.class),
                mock(OmnichannelOrderSyncJob.class),
                mock(DieuHanhHeThongService.class));

        kenhShopifyId = jdbc.queryForObject("SELECT id FROM kenh_ban_hang WHERE ma_kenh = 'SHOPIFY'", Integer.class);
        xoaDuLieuMau();
        themDuLieuMau();
    }

    @AfterAll
    static void donDep() {
        if (jdbc != null) xoaDuLieuMau();
        if (emfBean != null) emfBean.destroy();
        if (ketNoiMau != null) ketNoiMau.destroy();
    }

    private static void xoaDuLieuMau() {
        jdbc.update("DELETE t FROM trang_thai_dong_bo_san_pham t JOIN bien_the_san_pham bt ON bt.id = t.bien_the_san_pham_id "
                + "WHERE bt.ma_sku LIKE ?", MA + "%");
        jdbc.update("DELETE FROM bien_the_san_pham WHERE ma_sku LIKE ?", MA + "%");
        jdbc.update("DELETE FROM san_pham_quan_ao WHERE ma_san_pham LIKE ?", MA + "%");
        jdbc.update("DELETE FROM mau_sac WHERE ma_mau LIKE ?", MA + "%");
        jdbc.update("DELETE FROM chat_lieu WHERE ma_chat_lieu LIKE ?", MA + "%");
    }

    /**
     * Ba sản phẩm, tổng 49 SKU như ảnh lỗi: A 16 (4 màu × S, M, L, XL), B 20 (4 màu × S…XXL), C 13 (8 cỡ Nâu + 5 cỡ Đen).
     * Liên kết thêm theo thứ tự A, B, C nên sản phẩm mới nhất là C.
     */
    private static void themDuLieuMau() {
        Integer danhMucId = jdbc.queryForObject("SELECT MIN(id) FROM danh_muc_quan_ao", Integer.class);
        Map<String, Integer> mauId = new HashMap<>();
        for (int i = 0; i < MAU.size(); i++) {
            jdbc.update("INSERT INTO mau_sac (ma_mau, ten_mau) VALUES (?, ?)", MA + "-M" + i, MAU.get(i));
            mauId.put(MAU.get(i), jdbc.queryForObject("SELECT LAST_INSERT_ID()", Integer.class));
        }
        jdbc.update("INSERT INTO chat_lieu (ma_chat_lieu, ten_chat_lieu) VALUES (?, 'Nylon')", MA + "-CL");
        int chatLieuId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
        Map<String, Integer> sizeId = new HashMap<>();
        for (String kc : KICH_CO) {
            sizeId.put(kc, jdbc.queryForObject("SELECT id FROM size WHERE ma_size = ?", Integer.class, kc));
        }

        themSanPham("A", "Áo Khoác Blouson Cản Gió Cổ Đứng ITLK", danhMucId, chatLieuId, mauId, sizeId,
                Map.of("Nâu", List.of("S", "M", "L", "XL"), "Đen", List.of("S", "M", "L", "XL"),
                        "Kem", List.of("S", "M", "L", "XL"), "Xanh than", List.of("S", "M", "L", "XL")));
        themSanPham("B", "Áo Polo tennis ITLK", danhMucId, chatLieuId, mauId, sizeId,
                Map.of("Nâu", List.of("S", "M", "L", "XL", "XXL"), "Đen", List.of("S", "M", "L", "XL", "XXL"),
                        "Kem", List.of("S", "M", "L", "XL", "XXL"), "Xanh than", List.of("S", "M", "L", "XL", "XXL")));
        themSanPham("C", "Quần jean ống suông ITLK", danhMucId, chatLieuId, mauId, sizeId,
                Map.of("Nâu", KICH_CO, "Đen", List.of("XS", "S", "M", "L", "XL")));

        // A: 3 SKU lỗi, 2 SKU ngừng đồng bộ
        jdbc.update("UPDATE trang_thai_dong_bo_san_pham t JOIN bien_the_san_pham bt ON bt.id = t.bien_the_san_pham_id "
                + "SET t.trang_thai_dong_bo = 'that_bai' WHERE bt.ma_sku IN (?, ?, ?)", MA + "-A-Đen-XL", MA + "-A-Đen-L", MA + "-A-Kem-S");
        jdbc.update("UPDATE trang_thai_dong_bo_san_pham t JOIN bien_the_san_pham bt ON bt.id = t.bien_the_san_pham_id "
                + "SET t.trang_thai_dong_bo = 'chua_dong_bo' WHERE bt.ma_sku IN (?, ?)", MA + "-A-Nâu-S", MA + "-A-Nâu-M");
        skuMotPhanLoaiCuaB = MA + "-B-Kem-XXL";
    }

    private static void themSanPham(String ma, String ten, int danhMucId, int chatLieuId, Map<String, Integer> mauId,
                                    Map<String, Integer> sizeId, Map<String, List<String>> phanLoai) {
        jdbc.update("INSERT INTO san_pham_quan_ao (ma_san_pham, ten_san_pham, danh_muc_id, trang_thai) VALUES (?, ?, ?, 1)",
                MA + "-" + ma, ten, danhMucId);
        int spId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
        ID_SAN_PHAM.put(ma, spId);
        int dem = 0;
        // Thêm theo thứ tự màu, rồi cỡ từ lớn đến nhỏ: thứ tự thêm (id) khác hẳn thứ tự hiển thị mong muốn
        for (String mau : MAU) {
            List<String> coCuaMau = new ArrayList<>(phanLoai.getOrDefault(mau, List.of()));
            Collections.reverse(coCuaMau);
            for (String kc : coCuaMau) {
                String sku = MA + "-" + ma + "-" + mau + "-" + kc;
                jdbc.update("INSERT INTO bien_the_san_pham (san_pham_id, mau_sac_id, size_id, chat_lieu_id, ma_sku, trang_thai) "
                        + "VALUES (?, ?, ?, ?, ?, 1)", spId, mauId.get(mau), sizeId.get(kc), chatLieuId, sku);
                int btId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
                jdbc.update("INSERT INTO trang_thai_dong_bo_san_pham (bien_the_san_pham_id, kenh_ban_id, ma_san_pham_kenh, "
                        + "trang_thai_dong_bo) VALUES (?, ?, ?, 'thanh_cong')", btId, kenhShopifyId, "ITLK" + btId);
                dem++;
            }
        }
        SO_SKU.put(ma, dem);
    }

    private static <T> T trongGiaoDich(Supplier<T> viec) {
        return giaoDich.execute(status -> viec.get());
    }

    /** Chỉ giữ nhóm của dữ liệu mẫu (schema test có thể còn liên kết khác). */
    private static Page<NhomLienKetDto> trang(String search, String trangThai, int page, int size) {
        return trongGiaoDich(() -> service.filterLienKetTheoSanPham("SHOPIFY", search, trangThai, PageRequest.of(page, size)));
    }

    private static String maCua(NhomLienKetDto nhom) {
        return ID_SAN_PHAM.entrySet().stream().filter(e -> e.getValue().equals(nhom.getSanPhamId()))
                .map(Map.Entry::getKey).findFirst().orElse(null);
    }

    @Test
    void moiCoTrang_moiSanPhamXuatHienMotLanVaDuPhanLoai() {
        for (int size : List.of(1, 2, 3, 20, 100)) {
            Map<String, Integer> gap = new HashMap<>();
            Page<NhomLienKetDto> dau = trang(MA, null, 0, size);
            for (int p = 0; p < dau.getTotalPages(); p++) {
                for (NhomLienKetDto nhom : trang(MA, null, p, size).getContent()) {
                    String ma = maCua(nhom);
                    assertNotNull(ma, "Nhóm lạ khi lọc theo mã ITLK");
                    assertNull(gap.put(ma, nhom.getBienThe().size()), "Sản phẩm " + ma + " bị lặp ở trang khác (size " + size + ")");
                    assertEquals(SO_SKU.get(ma), nhom.getBienThe().size(), "Sản phẩm " + ma + " thiếu phân loại (size " + size + ")");
                    assertEquals(SO_SKU.get(ma), nhom.getTongPhanLoai());
                }
            }
            assertEquals(new TreeMap<>(SO_SKU), new TreeMap<>(gap), "Đủ cả 3 sản phẩm, đủ SKU (size " + size + ")");
            assertEquals(3, dau.getTotalElements(), "totalElements là số sản phẩm");
        }
    }

    @Test
    void sanPhamMoiLienKetNhatLenTruoc() {
        List<String> thuTu = trang(MA, null, 0, 20).getContent().stream().map(LienKetTheoSanPhamMySqlTest::maCua).toList();
        assertEquals(List.of("C", "B", "A"), thuTu);
    }

    @Test
    void trongNhom_xepTheoMauRoiThuTuKichCo() {
        NhomLienKetDto a = trang(MA + "-A-", null, 0, 20).getContent().get(0);
        List<String> nau = a.getBienThe().stream().map(LienKetSanPhamDto::getTenBienThe)
                .filter(t -> t.startsWith("Nâu - ")).toList();
        assertEquals(List.of("Nâu - S - Nylon", "Nâu - M - Nylon", "Nâu - L - Nylon", "Nâu - XL - Nylon"), nau);
        // Các phân loại cùng màu đứng liền nhau
        List<String> mauTheoDong = a.getBienThe().stream().map(d -> d.getTenBienThe().split(" - ")[0]).toList();
        List<String> mauKhongLap = new ArrayList<>(new LinkedHashSet<>(mauTheoDong));
        int viTri = 0;
        for (String mau : mauKhongLap) {
            for (int i = 0; i < 4; i++) assertEquals(mau, mauTheoDong.get(viTri++));
        }
    }

    @Test
    void locTrangThaiLoi_chiConSanPhamCoLoi_tongPhanLoaiVanDu() {
        List<NhomLienKetDto> nhom = trang(MA, "that_bai", 0, 20).getContent();
        assertEquals(1, nhom.size());
        assertEquals("A", maCua(nhom.get(0)));
        assertEquals(3, nhom.get(0).getBienThe().size());
        assertEquals(16, nhom.get(0).getTongPhanLoai());
        assertTrue(nhom.get(0).getBienThe().stream().allMatch(d -> "that_bai".equals(d.getTrangThaiLienKet())));
    }

    @Test
    void locNgungDongBo_vaDangDongBo() {
        NhomLienKetDto ngung = trang(MA, "chua_dong_bo", 0, 20).getContent().get(0);
        assertEquals("A", maCua(ngung));
        assertEquals(2, ngung.getBienThe().size());

        Page<NhomLienKetDto> dangDongBo = trang(MA, "thanh_cong", 0, 20);
        assertEquals(3, dangDongBo.getTotalElements());
        NhomLienKetDto a = dangDongBo.getContent().stream().filter(n -> "A".equals(maCua(n))).findFirst().orElseThrow();
        assertEquals(11, a.getBienThe().size());
        assertEquals(16, a.getTongPhanLoai());
    }

    @Test
    void timTheoSku_chiConSkuKhop() {
        List<NhomLienKetDto> nhom = trang(skuMotPhanLoaiCuaB.toLowerCase(), null, 0, 20).getContent();
        assertEquals(1, nhom.size());
        assertEquals("B", maCua(nhom.get(0)));
        assertEquals(1, nhom.get(0).getBienThe().size());
        assertEquals(skuMotPhanLoaiCuaB, nhom.get(0).getBienThe().get(0).getMaSku());
        assertEquals(20, nhom.get(0).getTongPhanLoai());
    }

    @Test
    void timTheoTenSanPham_traDuPhanLoaiCuaSanPham() {
        List<NhomLienKetDto> nhom = trang("quần jean ống suông itlk", null, 0, 20).getContent();
        assertEquals(1, nhom.size());
        assertEquals("C", maCua(nhom.get(0)));
        assertEquals(13, nhom.get(0).getBienThe().size());
        assertEquals(13, nhom.get(0).getTongPhanLoai());
    }

    @Test
    void khongKhopGi_trangRong() {
        Page<NhomLienKetDto> rong = trang(MA + "-KHONG-CO", null, 0, 20);
        assertTrue(rong.getContent().isEmpty());
        assertEquals(0, rong.getTotalElements());
    }

    @Test
    void danhSachCuTheoSku_vanChayDung() {
        Page<LienKetSanPhamDto> cu = trongGiaoDich(() -> service.filterLienKet("SHOPIFY", MA, null,
                PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "id"))));
        assertEquals(49, cu.getTotalElements());
        assertEquals(20, cu.getContent().size());
        assertTrue(cu.getContent().stream().allMatch(d -> d.getSoLuongKhaDung() != null));
    }
}
