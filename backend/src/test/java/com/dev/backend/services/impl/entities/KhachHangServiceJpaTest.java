package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhachHangRepository;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Thêm / sửa khách hàng chạy thật trên H2 (không cần MySQL): mã tự tạo theo id sau khi ghi,
 * tránh trùng mã đã nhập tay, mã nhập tay trùng báo 409, sửa ghi ngay (saveAndFlush) với số điện thoại đã chuẩn hóa.
 * Dựng Hibernate trực tiếp (không nạp Spring context) vì một số repository khác dùng truy vấn riêng của MySQL.
 */
class KhachHangServiceJpaTest {

    private static SessionFactory sessionFactory;

    private EntityManager em;
    private KhachHangRepository repository;
    private KhachHangService service;

    @BeforeAll
    static void khoiTaoHibernate() throws ClassNotFoundException {
        Configuration cfg = new Configuration()
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:khachhangjpa;MODE=MySQL;DB_CLOSE_DELAY=-1")
                .setProperty("hibernate.connection.username", "sa")
                .setProperty("hibernate.connection.password", "")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("hibernate.type.preferred_instant_jdbc_type", "TIMESTAMP")
                .setProperty("hibernate.show_sql", "false");
        ClassPathScanningCandidateComponentProvider quet = new ClassPathScanningCandidateComponentProvider(false);
        quet.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        quet.addIncludeFilter(new AnnotationTypeFilter(Embeddable.class));
        for (BeanDefinition bd : quet.findCandidateComponents("com.dev.backend.entities")) {
            cfg.addAnnotatedClass(Class.forName(bd.getBeanClassName()));
        }
        sessionFactory = cfg.buildSessionFactory();
    }

    @AfterAll
    static void dongHibernate() {
        if (sessionFactory != null) {
            sessionFactory.close();
        }
    }

    @BeforeEach
    void setUp() {
        em = sessionFactory.createEntityManager();
        em.getTransaction().begin();
        JpaRepositoryFactory factory = new JpaRepositoryFactory(em);
        repository = factory.getRepository(KhachHangRepository.class);
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(
                DieuHanhHeThongServiceImpl.CAU_HINH_MA_KHACH_HANG_TIEN_TO,
                DieuHanhHeThongServiceImpl.MA_KHACH_HANG_TIEN_TO_MAC_DINH)).thenReturn("KH");
        service = new KhachHangService(repository, Mappers.getMapper(KhachHangMapper.class), em,
                factory.getRepository(DonBanHangRepository.class), cauHinh);
    }

    @AfterEach
    void tearDown() {
        if (em.getTransaction().isActive()) {
            em.getTransaction().rollback();
        }
        em.close();
    }

    private KhachHangDto them(String ma, String ten, String sdt) {
        return service.create(KhachHangCreating.builder().maKhachHang(ma).tenKhachHang(ten).soDienThoai(sdt).build());
    }

    @Test
    void maTrong_tuTaoTheoId_vaTranhMaDaNhapTay() {
        KhachHangDto nhapTay = them("KH-CU-01", "Khách sổ cũ", "0901000001");
        int idTiep = nhapTay.getId() + 1;
        // Ai đó đã nhập tay đúng mã mà khách thứ hai sau sẽ được tự tạo
        them(String.format("KH%06d", idTiep + 2), "Khách nhập tay trùng dạng mã tự tạo", "0901000002");

        KhachHangDto tuTao = them(null, "Shop Hoa Mai", "0901000003");
        KhachHangDto trungDang = them("   ", "Shop Hoa Lan", "0901000004");
        em.flush();
        em.clear();

        assertEquals(String.format("KH%06d", tuTao.getId()), tuTao.getMaKhachHang());
        assertEquals(String.format("KH%06d", trungDang.getId()) + "-1", trungDang.getMaKhachHang());
        KhachHang daLuu = repository.findById(tuTao.getId()).orElseThrow();
        assertEquals(tuTao.getMaKhachHang(), daLuu.getMaKhachHang(), "mã tạm không được còn lại trong CSDL");
        assertEquals(1, daLuu.getTrangThai());
    }

    @Test
    void maNhapTayMangTienToSan_biTuChoi() {
        long truoc = repository.count();
        for (String ma : new String[] {"KH-SHP-001", "kh-tts-9", "KH-LZD-1", "KH-SP-77"}) {
            CommonException ex = assertThrows(CommonException.class, () -> them(ma, "Khách thử", null), ma);
            assertTrue(ex.getMessage().startsWith("Mã khách hàng không được bắt đầu bằng KH-"), ex.getMessage());
        }
        assertEquals(truoc, repository.count());
        // Giống nhưng không trùng tiền tố: vẫn nhận
        assertDoesNotThrow(() -> them("KH-SPX-01", "Khách sổ cũ", "0905000009"));
        assertDoesNotThrow(() -> them("KHSHP01", "Khách sổ cũ hai", "0905000008"));
    }

    @Test
    void locTheoNguon_theoTienToMa() {
        for (String[] k : new String[][] {
                {"KH-SHP-261119A", "****"}, {"KH-TTS-5872", "T***t N**"}, {"KH-LZD-11", "Lan"},
                {"KH-SP-821", "Quân"}, {"KH000777", "An"}, {"KH0912345678", "Ngọc"}}) {
            em.persist(KhachHang.builder().maKhachHang(k[0]).tenKhachHang(k[1]).trangThai(1).build());
        }
        em.flush();
        java.util.function.Function<String, java.util.List<String>> loc = nguon -> {
            com.dev.backend.dto.request.BaseFilterRequest req = new com.dev.backend.dto.request.BaseFilterRequest();
            req.setFilters(new java.util.ArrayList<>(java.util.List.of(
                    com.dev.backend.dto.request.FilterCriteria.builder().fieldName("nguon")
                            .operation(com.dev.backend.constant.enums.FilterOperation.EQUALS).value(nguon).build(),
                    com.dev.backend.dto.request.FilterCriteria.builder().fieldName("maKhachHang")
                            .operation(com.dev.backend.constant.enums.FilterOperation.LIKE).value("KH").build())));
            req.setSorts(java.util.List.of());
            req.setPage(0);
            req.setSize(50);
            return service.filter(req).getContent().stream().map(KhachHang::getMaKhachHang).sorted().toList();
        };

        assertEquals(java.util.List.of("KH-SHP-261119A"), loc.apply("shopee"));
        assertEquals(java.util.List.of("KH-TTS-5872"), loc.apply("tiktok"));
        assertEquals(java.util.List.of("KH-LZD-11"), loc.apply("lazada"));
        assertEquals(java.util.List.of("KH-SP-821"), loc.apply("shopify"));
        assertEquals(java.util.List.of("KH000777", "KH0912345678"), loc.apply("cua_hang"));
        assertEquals(java.util.List.of(), loc.apply("khong-co"), "giá trị lạ: không khách nào");
    }

    @Test
    void chiKhachCuaHang_oDanhSach_pos_chonKhach_vaKiemTrung() {
        // Người mua Shopify có số và email thật; khách Shopee bị che
        em.persist(KhachHang.builder().maKhachHang("KH-SP-9001").tenKhachHang("Lan Shopify")
                .soDienThoai("+84 912 345 678").email("lan@shop.vn").trangThai(1).build());
        em.persist(KhachHang.builder().maKhachHang("KH-SHP-9002").tenKhachHang("****").soDienThoai("****")
                .trangThai(1).build());
        em.flush();

        // Số và email chỉ trùng khách sàn: tạo được hồ sơ cửa hàng riêng
        assertNull(service.timKhachTrung("soDienThoai", "0912345678", null));
        assertNull(service.timKhachTrung("email", "lan@shop.vn", null));
        KhachHangDto cuaHang = service.create(KhachHangCreating.builder().maKhachHang("KH950")
                .tenKhachHang("Nguyễn Thị Lan").soDienThoai("0912345678").email("lan@shop.vn").build());
        em.flush();

        // Trùng khách cửa hàng thì vẫn chặn
        assertEquals("KH950", service.timKhachTrung("soDienThoai", "0912 345 678", null).getMaKhachHang());
        assertEquals("KH950", service.timKhachTrung("email", "lan@shop.vn", null).getMaKhachHang());
        assertNull(service.timKhachTrung("email", "lan@shop.vn", cuaHang.getId()), "bỏ qua chính khách đang sửa");
        CommonException trungEmail = assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH951").tenKhachHang("Lan Hai").email("lan@shop.vn").build()));
        assertEquals(HttpStatus.CONFLICT, trungEmail.getHttpStatus());

        // Danh sách trang Khách hàng, ô tìm POS, danh sách chọn khách: không có khách sàn
        java.util.List<String> danhSach = service.filterKhachCuaHang(
                com.dev.backend.dto.request.BaseFilterRequest.builder().size(100).build())
                .getContent().stream().map(KhachHang::getMaKhachHang).toList();
        assertTrue(danhSach.contains("KH950"));
        assertFalse(danhSach.contains("KH-SP-9001"));
        assertFalse(danhSach.contains("KH-SHP-9002"));
        assertEquals(java.util.List.of("KH950"), service.searchActiveForPos("lan", 0, 20).getContent().stream()
                .map(KhachHangDto::getMaKhachHang).toList());
        assertTrue(service.searchActiveForPos(null, 0, 100).getContent().stream()
                .noneMatch(k -> k.getMaKhachHang().startsWith("KH-S")));
        java.util.List<String> chon = service.getAllActiveForSales().stream().map(KhachHangDto::getMaKhachHang).toList();
        assertTrue(chon.contains("KH950"));
        assertTrue(chon.stream().noneMatch(ma -> ma.startsWith("KH-S")));
    }

    @Test
    void maNhapTayTrung_bao409_khongGhiThem() {
        them("KH900", "Khách A", "0902000001");
        long truoc = repository.count();

        CommonException ex = assertThrows(CommonException.class, () -> them("KH900", "Khách B", "0902000002"));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertEquals(truoc, repository.count());
    }

    @Test
    void suaSdt_chuanHoaVaGhiNgay() {
        KhachHangDto kh = them("KH901", "Khách C", "0903000001");

        KhachHangDto sau = service.update(kh.getId(), KhachHangUpdating.builder().soDienThoai("0236.3888.999").build());
        em.clear();

        assertEquals("02363888999", sau.getSoDienThoai());
        assertEquals("02363888999", repository.findById(kh.getId()).orElseThrow().getSoDienThoai());
    }

    @Test
    void suaSangSdtCuaKhachKhac_bao409() {
        them("KH902", "Khách D", "0904000001");
        KhachHangDto e = them("KH903", "Khách E", "0904000002");

        CommonException ex = assertThrows(CommonException.class,
                () -> service.update(e.getId(), KhachHangUpdating.builder().soDienThoai("0904 000 001").build()));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Khách D (KH902)"));
    }
}
