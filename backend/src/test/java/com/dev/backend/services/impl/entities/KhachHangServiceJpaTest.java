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
        assertEquals("le", daLuu.getLoaiKhachHang());
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
