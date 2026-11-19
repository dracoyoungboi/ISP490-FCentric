package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.response.customize.TongQuanMuaHangKhachDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhieuTraHang;
import com.dev.backend.repository.DonBanHangRepository;
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
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Chạy thật truy vấn gom theo trạng thái của {@link DonBanHangService#tongQuanMuaHangCuaKhach} trên H2
 * (không cần MySQL): đúng khách, đúng phạm vi vai trò, đơn gần nhất bỏ đơn nháp.
 * Dựng Hibernate trực tiếp (không nạp Spring context) vì một số repository khác dùng truy vấn riêng của MySQL.
 */
class DonBanHangTongQuanKhachJpaTest {

    private static SessionFactory sessionFactory;

    private EntityManager em;
    private DonBanHangRepository donBanHangRepository;

    private DonBanHangService service;
    private KhachHang khach;
    private KhachHang khachKhac;
    private Kho khoHn;
    private Kho khoHcm;
    private NguoiDung nvbhA;
    private NguoiDung nvbhB;
    private KenhBanHang shopify;
    private int stt;

    @BeforeAll
    static void khoiTaoHibernate() throws ClassNotFoundException {
        Configuration cfg = new Configuration()
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:tongquankhach;MODE=MySQL;DB_CLOSE_DELAY=-1")
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
        donBanHangRepository = new JpaRepositoryFactory(em).getRepository(DonBanHangRepository.class);
        service = new DonBanHangService(donBanHangRepository);
        ReflectionTestUtils.setField(service, "entityManager", em);

        khach = luu(KhachHang.builder().maKhachHang("KH016").tenKhachHang("Minh Khôi").trangThai(1).build());
        khachKhac = luu(KhachHang.builder().maKhachHang("KH017").tenKhachHang("An Phát").trangThai(1).build());
        khoHn = luu(Kho.builder().maKho("KHO-HN").tenKho("Kho Hà Nội").trangThai(1).build());
        khoHcm = luu(Kho.builder().maKho("KHO-HCM").tenKho("Kho Hồ Chí Minh").trangThai(1).build());
        nvbhA = luu(NguoiDung.builder().tenDangNhap("ban_a").matKhauHash("x").hoTen("Bán A")
                .vaiTro(IRoleType.nhan_vien_ban_hang).trangThai(1).build());
        nvbhB = luu(NguoiDung.builder().tenDangNhap("ban_b").matKhauHash("x").hoTen("Bán B")
                .vaiTro(IRoleType.nhan_vien_ban_hang).trangThai(1).build());
        shopify = luu(KenhBanHang.builder().maKenh("SHOPIFY").tenKenh("Shopify").build());

        // Khách KH016: 1 nháp, 2 hoàn thành, 1 chờ nhặt, 1 hủy, 1 hoàn trả
        don(khach, "don_ban_hang", ITrangThaiDonBanHang.NHAP, "12600000", "2026-10-17T08:42:00Z", khoHn, nvbhA);
        don(khach, "don_ban_hang", ITrangThaiDonBanHang.CHO_NHAT_HANG, "18400000", "2026-10-16T03:15:00Z", khoHn, nvbhA);
        don(khach, "don_ban_hang", ITrangThaiDonBanHang.HOAN_THANH, "16200000", "2026-10-08T06:47:00Z", khoHcm, nvbhB, shopify);
        don(khach, "don_ban_hang", ITrangThaiDonBanHang.HOAN_THANH, "21300000", "2026-10-03T04:20:00Z", khoHn, nvbhA);
        don(khach, "don_ban_hang", ITrangThaiDonBanHang.DA_HUY, "9800000", "2026-09-27T09:05:00Z", khoHn, nvbhA);
        don(khach, "don_ban_hang", ITrangThaiDonBanHang.BI_HOAN_TRA, "1890000", "2026-10-06T14:10:00Z", khoHcm, nvbhB, shopify);
        // Khách khác: không được lẫn vào
        don(khachKhac, "don_ban_hang", ITrangThaiDonBanHang.HOAN_THANH, "99000000", "2026-10-18T01:00:00Z", khoHn, nvbhA);
        em.flush();
        em.clear();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
        em.getTransaction().rollback();
        em.close();
    }

    private <T> T luu(T entity) {
        em.persist(entity);
        return entity;
    }

    private DonBanHang don(KhachHang kh, String loai, int trangThai, String tongCong, String ngay, Kho kho, NguoiDung nguoiTao) {
        return don(kh, loai, trangThai, tongCong, ngay, kho, nguoiTao, null);
    }

    private DonBanHang don(KhachHang kh, String loai, int trangThai, String tongCong, String ngay, Kho kho, NguoiDung nguoiTao,
                     KenhBanHang kenh) {
        return luu(DonBanHang.builder()
                .kenhBanHang(kenh)
                .soDonHang("DH" + (++stt))
                .loaiChungTu(loai)
                .khachHang(kh)
                .khoXuat(kho)
                .nguoiTao(nguoiTao)
                .trangThai(trangThai)
                .tongCong(new BigDecimal(tongCong))
                .ngayDatHang(Instant.parse(ngay))
                .ngayTao(Instant.parse(ngay))
                .ngayCapNhat(Instant.parse(ngay))
                .build());
    }

    private static NguoiDungAuthInfo user(int id, Set<String> roles, Integer... khoIds) {
        return NguoiDungAuthInfo.builder().id(id).vaiTro(roles)
                .phanQuyenNguoiDungKhos(java.util.Arrays.stream(khoIds)
                        .map(k -> PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(k).build()).build())
                        .toList())
                .build();
    }

    @Test
    void quanTriVien_thayDuDonCuaKhach_khongLanKhachKhac() {
        SecurityContextHolder.setUser(user(1, Set.of(IRoleType.quan_tri_vien)));

        TongQuanMuaHangKhachDto kq = service.tongQuanMuaHangCuaKhach(khach.getId());

        assertEquals(5, kq.getSoDonDat());
        assertEquals(3, kq.getSoDonTinhChiTieu());
        assertEquals(1, kq.getSoDonNhap());
        assertEquals(1, kq.getSoDonHuy());
        assertEquals(1, kq.getSoDonHoanTra());
        assertEquals(2, kq.getSoDonDangXuLy(), "nháp + chờ nhặt hàng");
        assertEquals(0, new BigDecimal("55900000").compareTo(kq.getTongChiTieu()));
        assertEquals(0, new BigDecimal("18633333").compareTo(kq.getTrungBinhMoiDon()));
        assertNotNull(kq.getDonGanNhat());
        assertEquals("DH2", kq.getDonGanNhat().getSoDonHang(), "đơn nháp mới hơn nhưng chưa đặt");
        assertEquals(Instant.parse("2026-10-16T03:15:00Z"), kq.getDonGanNhat().getNgayDatHang());

        // Mua qua: bán thường 3 đơn đã đặt (bỏ nháp) rồi Shopify 2 đơn
        assertEquals(2, kq.getKenhMua().size());
        assertNull(kq.getKenhMua().get(0).getId());
        assertNull(kq.getKenhMua().get(0).getMaKenh());
        assertEquals(3, kq.getKenhMua().get(0).getSoDon());
        assertEquals("SHOPIFY", kq.getKenhMua().get(1).getMaKenh());
        assertEquals("Shopify", kq.getKenhMua().get(1).getTenKenh());
        assertEquals(2, kq.getKenhMua().get(1).getSoDon());
    }

    private long demDon(FilterOperation phepKenh) {
        BaseFilterRequest request = new BaseFilterRequest();
        request.setFilters(new java.util.ArrayList<>(List.of(
                FilterCriteria.builder().fieldName("khachHang.id").operation(FilterOperation.EQUALS).value(khach.getId()).build(),
                FilterCriteria.builder().fieldName("loaiChungTu").operation(FilterOperation.EQUALS).value("don_ban_hang").build(),
                FilterCriteria.builder().fieldName("kenhBanHang").operation(phepKenh).build())));
        request.setSorts(List.of());
        return service.filter(request).getTotalElements();
    }

    @Test
    void timTheoMaDonHoacMaDonSan_vanGiuPhamViNhanVienBanHang() {
        // DH3 của nhân viên B có mã đơn sàn #1016
        em.createQuery("update DonBanHang d set d.maDonHangKenh = '#1016' where d.soDonHang = 'DH3'").executeUpdate();
        em.clear();
        java.util.function.Function<String, Long> tim = (tuKhoa) -> {
            BaseFilterRequest request = new BaseFilterRequest();
            request.setFilters(new java.util.ArrayList<>(List.of(
                    FilterCriteria.builder().fieldName("khachHang.id").operation(FilterOperation.EQUALS).value(khach.getId()).build(),
                    FilterCriteria.builder().fieldName("soDonHang").operation(FilterOperation.LIKE).value(tuKhoa)
                            .logicType(com.dev.backend.constant.enums.FilterLogicType.OR).build(),
                    FilterCriteria.builder().fieldName("maDonHangKenh").operation(FilterOperation.LIKE).value(tuKhoa)
                            .logicType(com.dev.backend.constant.enums.FilterLogicType.OR).build())));
            request.setSorts(List.of());
            return service.filter(request).getTotalElements();
        };

        SecurityContextHolder.setUser(user(1, Set.of(IRoleType.quan_tri_vien)));
        assertEquals(1, tim.apply("1016"), "khớp mã đơn sàn");
        assertEquals(1, tim.apply("dh2"), "khớp mã đơn, không phân biệt hoa thường");

        SecurityContextHolder.setUser(user(nvbhA.getId(), Set.of(IRoleType.nhan_vien_ban_hang)));
        assertEquals(0, tim.apply("1016"), "đơn của nhân viên khác không lộ ra qua ô tìm");
    }

    @Test
    void locKenh_banThuongLaKhongGanKenh() {
        SecurityContextHolder.setUser(user(1, Set.of(IRoleType.quan_tri_vien)));

        assertEquals(4, demDon(FilterOperation.IS_NULL), "nháp + chờ nhặt + hoàn thành + hủy, không gắn kênh");
        assertEquals(2, demDon(FilterOperation.IS_NOT_NULL), "2 đơn Shopify");
    }

    @Test
    void nhanVienBanHang_chiTinhDonMinhTao() {
        SecurityContextHolder.setUser(user(nvbhB.getId(), Set.of(IRoleType.nhan_vien_ban_hang)));

        TongQuanMuaHangKhachDto kq = service.tongQuanMuaHangCuaKhach(khach.getId());

        assertEquals(2, kq.getSoDonDat());
        assertEquals(1, kq.getSoDonTinhChiTieu());
        assertEquals(1, kq.getSoDonHoanTra());
        assertEquals(0, new BigDecimal("16200000").compareTo(kq.getTongChiTieu()));
        assertEquals("DH3", kq.getDonGanNhat().getSoDonHang());
        assertEquals(1, kq.getKenhMua().size());
        assertEquals("SHOPIFY", kq.getKenhMua().get(0).getMaKenh());
    }

    @Test
    void vaiTroKho_chiTinhDonCuaKhoPhuTrach() {
        SecurityContextHolder.setUser(user(50, Set.of(IRoleType.nhan_vien_kho), khoHcm.getId()));

        TongQuanMuaHangKhachDto kq = service.tongQuanMuaHangCuaKhach(khach.getId());

        assertEquals(2, kq.getSoDonDat());
        assertEquals(0, new BigDecimal("16200000").compareTo(kq.getTongChiTieu()));
    }

    @Test
    void vaiTroKhoChuaGanKho_khongThayGi() {
        SecurityContextHolder.setUser(user(51, Set.of(IRoleType.quan_ly_kho)));

        TongQuanMuaHangKhachDto kq = service.tongQuanMuaHangCuaKhach(khach.getId());

        assertEquals(0, kq.getSoDonDat());
        assertEquals(0, kq.getSoDonNhap());
        assertEquals(0, BigDecimal.ZERO.compareTo(kq.getTongChiTieu()));
        assertNull(kq.getTrungBinhMoiDon());
        assertNull(kq.getDonGanNhat());
        assertTrue(kq.getKenhMua().isEmpty());
    }

    @Test
    void khachChuaCoDon() {
        SecurityContextHolder.setUser(user(1, Set.of(IRoleType.quan_tri_vien)));
        KhachHang moi = luu(KhachHang.builder().maKhachHang("KH0571").tenKhachHang("Lê Hoàng Phúc").trangThai(1).build());
        em.flush();

        TongQuanMuaHangKhachDto kq = service.tongQuanMuaHangCuaKhach(moi.getId());

        assertEquals(0, kq.getSoDonDat());
        assertNull(kq.getDonGanNhat());
        assertEquals(List.of(), donBanHangRepository.findByKhachHangIdOrderByNgayDatHangDesc(moi.getId()));
    }
    // ───────── Đơn sàn chờ xử lý, trả hàng tại quầy, danh sách nhiều khách (danh sách khách hàng 19/11) ─────────

    private void phieuTra(DonBanHang donGoc, String tienHoan) {
        luu(PhieuTraHang.builder()
                .soPhieu("RET-" + (++stt))
                .requestId("req-" + stt)
                .donBanHangId(donGoc.getId())
                .khoBanId(khoHn.getId())
                .khoNhanId(khoHn.getId())
                .hinhThuc(PhieuTraHang.HINH_THUC_TRA_HANG)
                .tongSoLuong(BigDecimal.ONE)
                .soLuongDat(BigDecimal.ONE)
                .soLuongLoi(BigDecimal.ZERO)
                .tongTienHoan(new BigDecimal(tienHoan))
                .phuongThucHoan(PhieuTraHang.HOAN_TIEN_MAT)
                .quaHan(false)
                .nguoiLapId(nvbhA.getId())
                .ngayTao(Instant.parse("2026-10-20T02:00:00Z"))
                .build());
    }

    @Test
    void donSanChoXuLy_tinhLaDaDat_vaLaDonGanNhat() {
        SecurityContextHolder.setUser(user(1, Set.of(IRoleType.quan_tri_vien)));
        KenhBanHang shopee = luu(KenhBanHang.builder().maKenh("SHOPEE").tenKenh("Shopee").build());
        KhachHang khachSan = luu(KhachHang.builder().maKhachHang("KH-SHP-261119PTYDU4S3").tenKhachHang("****").trangThai(1).build());
        don(khachSan, "don_ban_hang", ITrangThaiDonBanHang.NHAP, "289000", "2026-11-19T02:00:00Z", khoHn, null, shopee);
        em.flush();

        TongQuanMuaHangKhachDto kq = service.tongQuanMuaHangCuaKhach(khachSan.getId());

        assertEquals(1, kq.getSoDonDat());
        assertEquals(0, kq.getSoDonNhap());
        assertEquals(0, new BigDecimal("289000").compareTo(kq.getTongChiTieu()));
        assertNotNull(kq.getDonGanNhat(), "đơn sàn chờ xử lý là lần mua gần nhất");
        assertEquals(1, kq.getKenhMua().size());
        assertEquals("SHOPEE", kq.getKenhMua().get(0).getMaKenh());
    }

    @Test
    void traHangTaiQuay_truKhoiChiTieu_boQuaPhieuCuaDonDaHoanTra() {
        SecurityContextHolder.setUser(user(1, Set.of(IRoleType.quan_tri_vien)));
        KhachHang ngoc = luu(KhachHang.builder().maKhachHang("KH0987654321").tenKhachHang("Ngọc").trangThai(1).build());
        DonBanHang pos = don(ngoc, "don_ban_hang", ITrangThaiDonBanHang.HOAN_THANH, "1870000", "2026-11-12T03:00:00Z", khoHn, nvbhA);
        DonBanHang hoanTra = don(ngoc, "don_ban_hang", ITrangThaiDonBanHang.BI_HOAN_TRA, "500000", "2026-11-10T03:00:00Z", khoHn, nvbhA);
        em.flush();
        phieuTra(pos, "150000");
        phieuTra(pos, "100000");
        phieuTra(hoanTra, "500000");
        em.flush();

        TongQuanMuaHangKhachDto kq = service.tongQuanMuaHangCuaKhach(ngoc.getId());

        assertEquals(0, new BigDecimal("250000").compareTo(kq.getTienTraHang()), "không trừ phiếu của đơn bị hoàn trả");
        assertEquals(0, new BigDecimal("1620000").compareTo(kq.getTongChiTieu()));
        assertEquals(0, new BigDecimal("1620000").compareTo(kq.getTrungBinhMoiDon()));
    }

    @Test
    void danhSach_lanMuaGanNhat_khopTrangChiTiet_boNhapTaoTay() {
        SecurityContextHolder.setUser(user(1, Set.of(IRoleType.quan_tri_vien)));
        KhachHang chuaMua = luu(KhachHang.builder().maKhachHang("KH0903111222").tenKhachHang("Hà").trangThai(1).build());
        KenhBanHang shopee = luu(KenhBanHang.builder().maKenh("SHOPEE").tenKenh("Shopee").build());
        // Khách khác: thêm đơn sàn chờ xử lý (Nháp có kênh) mới hơn, vẫn là lần mua gần nhất
        don(khachKhac, "don_ban_hang", ITrangThaiDonBanHang.NHAP, "289000", "2026-10-19T01:00:00Z", khoHn, null, shopee);
        // Khách chưa mua: chỉ có đơn nháp tạo tay, không tính
        don(chuaMua, "don_ban_hang", ITrangThaiDonBanHang.NHAP, "500000", "2026-10-20T01:00:00Z", khoHn, nvbhA);
        em.flush();

        java.util.Map<Integer, Instant> lan = service.lanMuaGanNhatTheoKhach(
                List.of(khach.getId(), khachKhac.getId(), chuaMua.getId()));

        assertEquals(service.tongQuanMuaHangCuaKhach(khach.getId()).getDonGanNhat().getNgayDatHang(), lan.get(khach.getId()),
                "khớp lần mua gần nhất ở trang chi tiết (bỏ đơn nháp 17/10)");
        assertEquals(Instant.parse("2026-10-19T01:00:00Z"), lan.get(khachKhac.getId()));
        assertNull(lan.get(chuaMua.getId()), "chỉ có nháp tạo tay: chưa mua");
        assertTrue(service.lanMuaGanNhatTheoKhach(List.of()).isEmpty());
        assertTrue(service.lanMuaGanNhatTheoKhach(null).isEmpty());
    }

    @Test
    void danhSach_nhanVienBanHang_chiTinhDonMinhTao() {
        SecurityContextHolder.setUser(user(nvbhB.getId(), Set.of(IRoleType.nhan_vien_ban_hang)));

        java.util.Map<Integer, Instant> lan = service.lanMuaGanNhatTheoKhach(List.of(khach.getId(), khachKhac.getId()));

        assertEquals(Instant.parse("2026-10-08T06:47:00Z"), lan.get(khach.getId()), "đơn mới nhất của nhân viên B");
        assertNull(lan.get(khachKhac.getId()), "đơn của nhân viên A không tính");
    }
}
