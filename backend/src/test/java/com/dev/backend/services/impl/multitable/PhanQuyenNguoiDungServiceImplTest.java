package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.ChiTietQuyenKhoCreating;
import com.dev.backend.dto.request.LuuPhanQuyenRequest;
import com.dev.backend.dto.request.PhanQuyenNguoiDungKhoCreating;
import com.dev.backend.dto.response.entities.ChiTietQuyenKhoDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.dto.response.entities.QuyenHanDto;
import com.dev.backend.dto.response.phanquyen.CauHinhPhanQuyenDto;
import com.dev.backend.dto.response.phanquyen.LichSuPhanQuyenDto;
import com.dev.backend.dto.response.phanquyen.QuyenCuaToiDto;
import com.dev.backend.entities.ChiTietQuyenKho;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import com.dev.backend.entities.QuyenHan;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ChiTietQuyenKhoRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.repository.MauQuyenVaiTroRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.repository.QuyenHanRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.NoSuchBeanDefinitionException;
import org.springframework.context.ApplicationContext;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Lưu phân quyền một lần, lịch sử phân quyền, cấu hình phân quyền và quyền của tôi.
 * CSDL được thay bằng danh sách trong bộ nhớ (repository giả bằng Mockito).
 */
class PhanQuyenNguoiDungServiceImplTest {

    private static final Instant BAY_GIO = Instant.parse("2026-10-18T03:00:00Z");
    private static final String[] MA_QUYEN = {
            "xem_ton_kho", "xem_chi_tiet_lo", "dieu_chinh_ton_kho", "chuyen_kho",
            "tao_don_mua_hang", "duyet_don_mua_hang", "tao_phieu_nhap", "duyet_phieu_nhap", "huy_phieu_nhap",
            "tao_don_ban_hang", "duyet_don_ban_hang", "tao_phieu_xuat", "duyet_phieu_xuat", "huy_phieu_xuat",
            "xem_bao_cao_ton_kho", "xem_bao_cao_nhap_xuat", "xem_bao_cao_doanh_thu", "xuat_bao_cao",
            "quan_ly_nhan_vien_kho", "cap_quyen_nhan_vien", "quan_ly_san_pham", "quan_ly_nha_cung_cap",
            "quan_ly_khach_hang"};
    private static final List<Integer> MAU_NHAN_VIEN_KHO = List.of(1, 2, 4, 7, 12, 15);

    private final Map<Integer, NguoiDung> nguoiDung = new LinkedHashMap<>();
    private final Map<Integer, Kho> kho = new LinkedHashMap<>();
    private final Map<Integer, QuyenHan> quyen = new LinkedHashMap<>();
    private final List<PhanQuyenNguoiDungKho> phanQuyen = new ArrayList<>();
    private final List<ChiTietQuyenKho> chiTiet = new ArrayList<>();
    private final List<LichSuThayDoi> lichSu = new ArrayList<>();

    private NguoiDungRepository nguoiDungRepository;
    private KhoRepository khoRepository;
    private PhanQuyenNguoiDungKhoRepository phanQuyenRepository;
    private ChiTietQuyenKhoRepository chiTietRepository;
    private LichSuThayDoiRepository lichSuRepository;
    private MauQuyenVaiTroRepository mauRepository;
    private ApplicationContext applicationContext;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private PhanQuyenNguoiDungServiceImpl service;
    private NguoiDung admin;
    private NguoiDung nhanVien;
    private Kho khoTong;
    private Kho khoHaNoi;

    @BeforeEach
    void setUp() {
        for (int i = 0; i < MA_QUYEN.length; i++) {
            quyen.put(i + 1, QuyenHan.builder().id(i + 1).maQuyen(MA_QUYEN[i]).tenQuyen("Tên " + MA_QUYEN[i])
                    .moTa("Mô tả " + MA_QUYEN[i]).nhomQuyen("nhom").build());
        }
        admin = them(NguoiDung.builder().id(1).tenDangNhap("admin").hoTen("Nguyễn Quản Trị").email("quantri@fcentric.net")
                .vaiTro(IRoleType.quan_tri_vien).trangThai(1).build());
        nhanVien = them(NguoiDung.builder().id(52).tenDangNhap("nhanvienkhotong").hoTen("Trần Văn Bình")
                .vaiTro(IRoleType.nhan_vien_kho).trangThai(1).build());
        khoTong = them(Kho.builder().id(22).maKho("KHO_TONG").tenKho("Kho tổng").loaiKho("kho_tong").trangThai(1).build());
        khoHaNoi = them(Kho.builder().id(23).maKho("KHO_HN").tenKho("Kho Hà Nội").loaiKho("cua_hang").trangThai(1).build());
        them(Kho.builder().id(24).maKho("KHO_CU").tenKho("Kho cũ").trangThai(0).build());
        them(Kho.builder().id(25).maKho("KHO_TRANSIT").tenKho("Kho trung chuyển").trangThai(1).build());

        nguoiDungRepository = mock(NguoiDungRepository.class);
        when(nguoiDungRepository.findById(anyInt())).thenAnswer(i -> Optional.ofNullable(nguoiDung.get(i.<Integer>getArgument(0))));
        when(nguoiDungRepository.existsById(anyInt())).thenAnswer(i -> nguoiDung.containsKey(i.<Integer>getArgument(0)));
        when(nguoiDungRepository.save(any(NguoiDung.class))).thenAnswer(i -> i.getArgument(0));

        khoRepository = mock(KhoRepository.class);
        when(khoRepository.findById(anyInt())).thenAnswer(i -> Optional.ofNullable(kho.get(i.<Integer>getArgument(0))));

        QuyenHanRepository quyenHanRepository = mock(QuyenHanRepository.class);
        when(quyenHanRepository.findAll()).thenAnswer(i -> new ArrayList<>(quyen.values()));
        when(quyenHanRepository.findAllById(any())).thenAnswer(i -> {
            Iterable<Integer> ids = i.getArgument(0);
            List<QuyenHan> ds = new ArrayList<>();
            ids.forEach(id -> { if (quyen.containsKey(id)) ds.add(quyen.get(id)); });
            return ds;
        });

        phanQuyenRepository = mock(PhanQuyenNguoiDungKhoRepository.class);
        when(phanQuyenRepository.findByNguoiDungIdAndActive(anyInt())).thenAnswer(i -> phanQuyen.stream()
                .filter(p -> p.getNguoiDung().getId().equals(i.getArgument(0)))
                .filter(p -> Integer.valueOf(1).equals(p.getTrangThai()))
                .filter(p -> p.getNgayKetThuc() == null || p.getNgayKetThuc().isAfter(BAY_GIO))
                .collect(Collectors.toList()));
        when(phanQuyenRepository.findHieuLucTai(anyInt(), any(Instant.class))).thenAnswer(i -> phanQuyen.stream()
                .filter(p -> p.getNguoiDung().getId().equals(i.getArgument(0)))
                .filter(p -> Integer.valueOf(1).equals(p.getTrangThai()))
                .filter(p -> p.getNgayBatDau() == null || !p.getNgayBatDau().isAfter(i.getArgument(1)))
                .filter(p -> p.getNgayKetThuc() == null || p.getNgayKetThuc().isAfter(i.getArgument(1)))
                .collect(Collectors.toList()));
        // Giữ chỗ: kể cả phân quyền chưa tới ngày bắt đầu
        when(phanQuyenRepository.findGiuChoByNguoiDungId(anyInt(), any(Instant.class))).thenAnswer(i -> phanQuyen.stream()
                .filter(p -> p.getNguoiDung().getId().equals(i.getArgument(0)))
                .filter(p -> Integer.valueOf(1).equals(p.getTrangThai()))
                .filter(p -> p.getNgayKetThuc() == null || p.getNgayKetThuc().isAfter(i.getArgument(1)))
                .collect(Collectors.toList()));
        when(phanQuyenRepository.findById(anyInt())).thenAnswer(i -> phanQuyen.stream()
                .filter(p -> p.getId().equals(i.getArgument(0))).findFirst());
        when(phanQuyenRepository.findByNguoiDungIdAndKhoId(anyInt(), anyInt())).thenAnswer(i -> phanQuyen.stream()
                .filter(p -> p.getNguoiDung().getId().equals(i.getArgument(0)) && p.getKho().getId().equals(i.getArgument(1)))
                .findFirst());
        when(phanQuyenRepository.save(any(PhanQuyenNguoiDungKho.class))).thenAnswer(i -> {
            PhanQuyenNguoiDungKho p = i.getArgument(0);
            if (p.getId() == null) {
                p.setId(100 + phanQuyen.size());
                phanQuyen.add(p);
            }
            return p;
        });

        chiTietRepository = mock(ChiTietQuyenKhoRepository.class);
        when(chiTietRepository.findByPhanQuyenNguoiDungKhoId(anyInt())).thenAnswer(i -> chiTiet.stream()
                .filter(c -> c.getPhanQuyenNguoiDungKho().getId().equals(i.getArgument(0)))
                .collect(Collectors.toList()));
        when(chiTietRepository.save(any(ChiTietQuyenKho.class))).thenAnswer(i -> {
            ChiTietQuyenKho c = i.getArgument(0);
            if (c.getId() == null) {
                c.setId(1000 + chiTiet.size());
                chiTiet.add(c);
            }
            return c;
        });

        lichSuRepository = mock(LichSuThayDoiRepository.class);
        when(lichSuRepository.save(any(LichSuThayDoi.class))).thenAnswer(i -> {
            LichSuThayDoi l = i.getArgument(0);
            l.setId(5000 + lichSu.size());
            lichSu.add(l);
            return l;
        });
        when(lichSuRepository.findByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                anyString(), anyInt(), anyCollection(), any(Pageable.class))).thenAnswer(i -> timLichSu(
                i.getArgument(0), i.getArgument(1), i.getArgument(2)));
        when(lichSuRepository.findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                anyString(), anyInt(), anyCollection())).thenAnswer(i -> timLichSu(
                i.getArgument(0), i.getArgument(1), i.getArgument(2)).stream().findFirst());

        mauRepository = mock(MauQuyenVaiTroRepository.class);
        when(mauRepository.layTatCa()).thenReturn(Map.of(IRoleType.nhan_vien_kho, MAU_NHAN_VIEN_KHO));
        when(mauRepository.layIdQuyenNhayCam()).thenReturn(List.of(3, 6, 8));

        applicationContext = mock(ApplicationContext.class);

        service = new PhanQuyenNguoiDungServiceImpl(nguoiDungRepository, khoRepository, quyenHanRepository,
                phanQuyenRepository, chiTietRepository, lichSuRepository, mauRepository, objectMapper, applicationContext);
        service.setClock(Clock.fixed(BAY_GIO, ZoneOffset.UTC));
        dangNhap(admin);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    // ───────── tiện ích ─────────

    private NguoiDung them(NguoiDung n) {
        nguoiDung.put(n.getId(), n);
        return n;
    }

    private Kho them(Kho k) {
        kho.put(k.getId(), k);
        return k;
    }

    private List<LichSuThayDoi> timLichSu(String loai, Integer id, Collection<String> hanhDong) {
        return lichSu.stream()
                .filter(l -> loai.equals(l.getLoaiThamChieu()) && id.equals(l.getIdThamChieu()) && hanhDong.contains(l.getHanhDong()))
                .sorted(Comparator.comparing(LichSuThayDoi::getNgayThucHien).reversed()
                        .thenComparing(Comparator.comparing(LichSuThayDoi::getId).reversed()))
                .collect(Collectors.toList());
    }

    private void dangNhap(NguoiDung n) {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(n.getId()).vaiTro(Set.of(n.getVaiTro())).build());
    }

    /** Dữ liệu sẵn có: nhân viên phụ trách Kho tổng với các quyền cho trước (trang_thai = 1). */
    private PhanQuyenNguoiDungKho phanKhoSan(NguoiDung n, Kho k, List<Integer> ids) {
        PhanQuyenNguoiDungKho p = PhanQuyenNguoiDungKho.builder().id(100 + phanQuyen.size()).nguoiDung(n).kho(k)
                .trangThai(1).laQuanLyKho(0).ngayBatDau(BAY_GIO.minusSeconds(86_400)).nguoiCapQuyen(admin).build();
        phanQuyen.add(p);
        for (Integer id : ids) {
            chiTiet.add(ChiTietQuyenKho.builder().id(1000 + chiTiet.size()).phanQuyenNguoiDungKho(p)
                    .quyenHan(quyen.get(id)).trangThai(1).build());
        }
        return p;
    }

    private List<Integer> quyenDangBat(PhanQuyenNguoiDungKho p) {
        return chiTiet.stream().filter(c -> c.getPhanQuyenNguoiDungKho() == p && Integer.valueOf(1).equals(c.getTrangThai()))
                .map(c -> c.getQuyenHan().getId()).sorted().collect(Collectors.toList());
    }

    private static List<Integer> tatCa() {
        return IntStream.rangeClosed(1, 23).boxed().collect(Collectors.toList());
    }

    private LuuPhanQuyenRequest yeuCau(String vaiTro, Integer khoId, List<Integer> quyenIds) {
        return LuuPhanQuyenRequest.builder().vaiTro(vaiTro).khoId(khoId).quyenHanIds(quyenIds).build();
    }

    // ───────── Lưu phân quyền ─────────

    @Nested
    @DisplayName("Lưu phân quyền một lần")
    class LuuPhanQuyen {

        @Test
        @DisplayName("Bỏ 17 quyền ngoài mẫu: chỉ còn 6 quyền, ghi đúng một dòng lịch sử có 17 quyền bị thu hồi")
        void apMau_thuHoiQuyenThua() {
            PhanQuyenNguoiDungKho p = phanKhoSan(nhanVien, khoTong, tatCa());

            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, MAU_NHAN_VIEN_KHO));

            assertEquals(MAU_NHAN_VIEN_KHO, quyenDangBat(p));
            assertEquals(1, lichSu.size());
            LichSuThayDoi l = lichSu.get(0);
            assertEquals(IHanhDong.cap_nhat_phan_quyen, l.getHanhDong());
            assertEquals(ITable.nguoi_dung, l.getLoaiThamChieu());
            assertEquals(52, l.getIdThamChieu());
            assertSame(admin, l.getNguoiThucHien());
            assertTrue(l.getGiaTriMoi().contains("\"quyen\":[\"chuyen_kho\""), l.getGiaTriMoi());
        }

        @Test
        @DisplayName("Lưu lại y nguyên thì không ghi lịch sử")
        void khongDoi_khongGhiLichSu() {
            phanKhoSan(nhanVien, khoTong, MAU_NHAN_VIEN_KHO);
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, MAU_NHAN_VIEN_KHO));
            assertTrue(lichSu.isEmpty());
        }

        @Test
        @DisplayName("Phân kho lần đầu: tạo phân quyền kho, quyền có người cấp và ngày cấp")
        void phanKhoLanDau() {
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, MAU_NHAN_VIEN_KHO));

            assertEquals(1, phanQuyen.size());
            PhanQuyenNguoiDungKho p = phanQuyen.get(0);
            assertEquals(1, p.getTrangThai());
            assertSame(khoTong, p.getKho());
            assertSame(admin, p.getNguoiCapQuyen());
            assertEquals(BAY_GIO.minusSeconds(60), p.getNgayBatDau());
            assertEquals(MAU_NHAN_VIEN_KHO, quyenDangBat(p));
            assertTrue(chiTiet.stream().allMatch(c -> c.getNguoiCap() == admin && BAY_GIO.equals(c.getNgayCap())));
            assertEquals(1, lichSu.size());
        }

        @Test
        @DisplayName("Đổi kho: kho cũ bị thu hồi (không xóa), kho mới có đúng tập quyền")
        void doiKho() {
            PhanQuyenNguoiDungKho cu = phanKhoSan(nhanVien, khoTong, MAU_NHAN_VIEN_KHO);

            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 23, List.of(1, 15)));

            assertEquals(0, cu.getTrangThai());
            assertEquals(BAY_GIO, cu.getNgayKetThuc());
            assertTrue(quyenDangBat(cu).isEmpty());
            PhanQuyenNguoiDungKho moi = phanQuyen.stream().filter(x -> x.getKho() == khoHaNoi).findFirst().orElseThrow();
            assertEquals(1, moi.getTrangThai());
            assertEquals(List.of(1, 15), quyenDangBat(moi));
            assertEquals(1, phanQuyenRepository.findByNguoiDungIdAndActive(52).size());
        }

        @Test
        @DisplayName("Chuyển sang Quản trị viên: thu hồi phân quyền kho, đổi vai trò")
        void sangQuanTriVien_thuHoiKho() {
            PhanQuyenNguoiDungKho cu = phanKhoSan(nhanVien, khoTong, tatCa());

            service.luuPhanQuyen(52, yeuCau(IRoleType.quan_tri_vien, null, List.of()));

            assertEquals(IRoleType.quan_tri_vien, nhanVien.getVaiTro());
            assertEquals(0, cu.getTrangThai());
            assertTrue(quyenDangBat(cu).isEmpty());
            assertTrue(lichSu.get(0).getGiaTriMoi().contains("\"kho\":null"));
        }

        @Test
        @DisplayName("Đổi vai trò Nhân viên kho → Quản lý kho: đánh dấu quản lý kho")
        void sangQuanLyKho() {
            PhanQuyenNguoiDungKho p = phanKhoSan(nhanVien, khoTong, MAU_NHAN_VIEN_KHO);
            service.luuPhanQuyen(52, yeuCau(IRoleType.quan_ly_kho, 22, List.of(1, 2, 8)));
            assertEquals(IRoleType.quan_ly_kho, nhanVien.getVaiTro());
            assertEquals(1, p.getLaQuanLyKho());
            assertEquals(List.of(1, 2, 8), quyenDangBat(p));
        }

        @Test
        @DisplayName("Kích hoạt lại kho từng phụ trách: quyền cũ không gửi lên thì vẫn tắt")
        void kichHoatLaiKhoCu() {
            PhanQuyenNguoiDungKho cu = phanKhoSan(nhanVien, khoTong, List.of(1, 3));
            cu.setTrangThai(0);
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, List.of(1, 7)));
            assertEquals(1, cu.getTrangThai());
            assertNull(cu.getNgayKetThuc());
            assertEquals(List.of(1, 7), quyenDangBat(cu));
            assertEquals(1, phanQuyen.size());
        }

        @Test
        @DisplayName("Không tự đổi vai trò của chính mình")
        void khongTuDoiVaiTro() {
            CommonException ex = assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(1, yeuCau(IRoleType.nhan_vien_kho, 22, List.of())));
            assertEquals("Bạn không thể tự đổi vai trò của chính mình", ex.getMessage());
            assertEquals(IRoleType.quan_tri_vien, admin.getVaiTro());
        }

        @Test
        @DisplayName("Vai trò không hợp lệ, quyền không tồn tại, kho ngừng hoạt động, kho ảo, hạn đã qua: báo lỗi")
        void kiemTraDauVao() {
            assertThrows(CommonException.class, () -> service.luuPhanQuyen(52, yeuCau("all", null, null)));
            assertEquals("Quyền không tồn tại: 99", assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, List.of(1, 99)))).getMessage());
            assertTrue(assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 24, List.of(1)))).getMessage()
                    .contains("ngừng hoạt động"));
            assertTrue(assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 25, List.of(1)))).getMessage()
                    .startsWith("Kho ảo"));
            LuuPhanQuyenRequest hanQua = yeuCau(IRoleType.nhan_vien_kho, 22, List.of(1));
            hanQua.setNgayKetThuc(BAY_GIO.minusSeconds(1));
            assertEquals("Ngày hết hiệu lực phải sau thời điểm hiện tại",
                    assertThrows(CommonException.class, () -> service.luuPhanQuyen(52, hanQua)).getMessage());
            CommonException khongCo = assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(999, yeuCau(IRoleType.nhan_vien_kho, 22, List.of())));
            assertEquals(HttpStatus.NOT_FOUND, khongCo.getStatus());
        }

        @Test
        @DisplayName("Vai trò cần kho: đang có kho mà không gửi kho, hoặc cấp quyền khi chưa có kho, đều báo lỗi")
        void canKho() {
            assertEquals("Hãy chọn kho phụ trách trước khi cấp quyền", assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, null, List.of(1)))).getMessage());
            phanKhoSan(nhanVien, khoTong, List.of(1));
            assertEquals("Hãy chọn kho phụ trách", assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, null, List.of()))).getMessage());
        }

        @Test
        @DisplayName("Chưa có kho, chỉ đổi vai trò: lưu được, không tạo phân quyền kho")
        void chiDoiVaiTroKhiChuaCoKho() {
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_mua_hang, null, List.of()));
            assertEquals(IRoleType.nhan_vien_mua_hang, nhanVien.getVaiTro());
            assertTrue(phanQuyen.isEmpty());
            assertEquals(1, lichSu.size());
        }

        @Test
        @DisplayName("Hạn hiệu lực bỏ phần lẻ giây để lần lưu sau không bị coi là thay đổi")
        void hanHieuLucCatGiay() {
            LuuPhanQuyenRequest r = yeuCau(IRoleType.nhan_vien_kho, 22, List.of(1));
            r.setNgayKetThuc(Instant.parse("2026-12-31T16:59:59.999Z"));
            service.luuPhanQuyen(52, r);
            assertEquals(Instant.parse("2026-12-31T16:59:59Z"), phanQuyen.get(0).getNgayKetThuc());
            service.luuPhanQuyen(52, r);
            assertEquals(1, lichSu.size());
        }

        @Test
        @DisplayName("Chưa đăng nhập: 401")
        void chuaDangNhap() {
            SecurityContextHolder.clear();
            CommonException ex = assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, List.of())));
            assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        }
    }

    // ───────── Lịch sử ─────────

    @Nested
    @DisplayName("Lịch sử phân quyền")
    class LichSu {

        @Test
        @DisplayName("Bản ghi mới: tách quyền thêm, quyền bỏ, đổi vai trò")
        void banGhiMoi() {
            phanKhoSan(nhanVien, khoTong, List.of(1, 2, 3));
            service.luuPhanQuyen(52, yeuCau(IRoleType.quan_ly_kho, 22, List.of(1, 2, 8)));

            List<LichSuPhanQuyenDto> ds = service.layLichSuPhanQuyen(52);

            assertEquals(1, ds.size());
            LichSuPhanQuyenDto d = ds.get(0);
            assertEquals(IRoleType.nhan_vien_kho, d.getVaiTroCu());
            assertEquals(IRoleType.quan_ly_kho, d.getVaiTroMoi());
            assertEquals(List.of("Tên duyet_phieu_nhap"), d.getQuyenThem());
            assertEquals(List.of("Tên dieu_chinh_ton_kho"), d.getQuyenBo());
            assertEquals("Nguyễn Quản Trị", d.getNguoiThucHien());
            assertEquals("KHO_TONG", d.getKhoMoi().getMaKho());
            assertFalse(d.isDoiHieuLuc());
        }

        @Test
        @DisplayName("Đổi kho: mọi quyền tại kho mới là cấp mới")
        void doiKho() {
            phanKhoSan(nhanVien, khoTong, List.of(1, 2));
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 23, List.of(1, 15)));
            LichSuPhanQuyenDto d = service.layLichSuPhanQuyen(52).get(0);
            assertEquals("KHO_TONG", d.getKhoCu().getMaKho());
            assertEquals("KHO_HN", d.getKhoMoi().getMaKho());
            assertEquals(List.of("Tên xem_ton_kho", "Tên xem_bao_cao_ton_kho"), d.getQuyenThem());
            assertTrue(d.getQuyenBo().isEmpty());
        }

        @Test
        @DisplayName("Bản ghi cũ từng quyền một: gộp theo cùng giây, người, kho; bỏ qua dòng hỏng")
        void banGhiCuDuocGop() {
            Instant luc = Instant.parse("2026-10-12T07:04:00Z");
            ghiCu(IHanhDong.cap_quyen, "", "{\"quyenHan\":{\"maQuyen\":\"xem_ton_kho\"},\"trangThai\":1}", luc);
            ghiCu(IHanhDong.cap_nhat_quyen, "{\"trangThai\":1}", "{\"quyenHan\":{\"maQuyen\":\"chuyen_kho\"},\"trangThai\":1}", luc);
            ghiCu(IHanhDong.cap_nhat_quyen, "{\"trangThai\":1}", "{\"quyenHanId\":20,\"trangThai\":0}", luc);
            ghiCu(IHanhDong.nang_cap_chuc_vu, "error when parse", "error when parse", luc);
            ghiCu(IHanhDong.cap_quyen, "", "{\"quyenHan\":{\"maQuyen\":\"tao_phieu_nhap\"},\"trangThai\":1}",
                    luc.minusSeconds(3600));

            List<LichSuPhanQuyenDto> ds = service.layLichSuPhanQuyen(52);

            assertEquals(2, ds.size());
            assertEquals(List.of("Tên xem_ton_kho"), ds.get(0).getQuyenThem(), "chuyen_kho 1→1 không phải cấp mới");
            assertEquals(List.of("Tên cap_quyen_nhan_vien"), ds.get(0).getQuyenBo());
            assertEquals(List.of("Tên tao_phieu_nhap"), ds.get(1).getQuyenThem());
        }

        @Test
        @DisplayName("Người dùng không tồn tại: 404")
        void khongTonTai() {
            assertEquals(HttpStatus.NOT_FOUND,
                    assertThrows(CommonException.class, () -> service.layLichSuPhanQuyen(999)).getStatus());
        }

        private void ghiCu(String hanhDong, String cu, String moi, Instant luc) {
            lichSu.add(LichSuThayDoi.builder().id(4000 + lichSu.size()).loaiThamChieu(ITable.nguoi_dung).idThamChieu(52)
                    .kho(khoTong).hanhDong(hanhDong).giaTriCu(cu).giaTriMoi(moi).nguoiThucHien(admin)
                    .ngayThucHien(luc).build());
        }
    }

    // ───────── Cấu hình ─────────

    @Nested
    @DisplayName("Cấu hình phân quyền")
    class CauHinh {

        @Test
        @DisplayName("Đủ 4 vai trò có mẫu; quyền đã áp dụng chỉ tính API có inWarehouse = true")
        void cauHinh() throws Exception {
            ganAnhXaGia();

            CauHinhPhanQuyenDto c = service.layCauHinhPhanQuyen();

            assertEquals(List.of(IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang), new ArrayList<>(c.getMauQuyen().keySet()));
            assertEquals(MAU_NHAN_VIEN_KHO, c.getMauQuyen().get(IRoleType.nhan_vien_kho));
            assertTrue(c.getMauQuyen().get(IRoleType.quan_ly_kho).isEmpty());
            assertEquals(List.of(3, 6, 8), c.getQuyenNhayCam());
            assertEquals(List.of(IPermissionType.huy_phieu_nhap, IPermissionType.tao_phieu_nhap), c.getQuyenDaApDung());

            service.layCauHinhPhanQuyen();
            verify(applicationContext, times(1)).getBean("requestMappingHandlerMapping", RequestMappingHandlerMapping.class);
        }

        @Test
        @DisplayName("Không quét được quyền đã áp dụng: trả null (không phải rỗng) và lần sau quét lại")
        void cauHinh_quetLoi() throws Exception {
            when(applicationContext.getBean("requestMappingHandlerMapping", RequestMappingHandlerMapping.class))
                    .thenThrow(new NoSuchBeanDefinitionException("requestMappingHandlerMapping"));
            assertNull(service.layCauHinhPhanQuyen().getQuyenDaApDung(), "bean lỗi");

            reset(applicationContext);
            assertNull(service.layCauHinhPhanQuyen().getQuyenDaApDung(), "getBean trả null");

            RequestMappingHandlerMapping hong = mock(RequestMappingHandlerMapping.class);
            when(hong.getHandlerMethods()).thenThrow(new IllegalStateException("lỗi khi đọc ánh xạ"));
            when(applicationContext.getBean("requestMappingHandlerMapping", RequestMappingHandlerMapping.class)).thenReturn(hong);
            CauHinhPhanQuyenDto c = service.layCauHinhPhanQuyen();
            assertNull(c.getQuyenDaApDung(), "lỗi không thuộc BeansException cũng chỉ mất phần này");
            assertEquals(MAU_NHAN_VIEN_KHO, c.getMauQuyen().get(IRoleType.nhan_vien_kho), "mẫu quyền vẫn trả về");

            reset(applicationContext);
            ganAnhXaGia();
            assertEquals(List.of(IPermissionType.huy_phieu_nhap, IPermissionType.tao_phieu_nhap),
                    service.layCauHinhPhanQuyen().getQuyenDaApDung(), "lần lỗi không được giữ lại");
        }

        @Test
        @DisplayName("Cập nhật mẫu: kiểm vai trò, kiểm id quyền, ghi lịch sử")
        void capNhatMau() {
            assertThrows(CommonException.class, () -> service.capNhatMauQuyen(IRoleType.quan_tri_vien, List.of(1)));
            assertThrows(CommonException.class, () -> service.capNhatMauQuyen(IRoleType.nhan_vien_kho, List.of(1, 99)));

            service.capNhatMauQuyen(IRoleType.nhan_vien_kho, List.of(7, 1, 7));

            verify(mauRepository).thayMau(eq(IRoleType.nhan_vien_kho), argThat(ids -> List.copyOf(ids).equals(List.of(1, 7))));
            LichSuThayDoi l = lichSu.get(0);
            assertEquals(IHanhDong.cap_nhat_mau_quyen, l.getHanhDong());
            assertTrue(l.getGiaTriMoi().contains("[\"xem_ton_kho\",\"tao_phieu_nhap\"]"), l.getGiaTriMoi());
        }
    }

    /** Cho applicationContext trả ánh xạ gồm ba phương thức của BoDieuKhienGia. */
    private void ganAnhXaGia() throws NoSuchMethodException {
        RequestMappingHandlerMapping anhXa = mock(RequestMappingHandlerMapping.class);
        BoDieuKhienGia gia = new BoDieuKhienGia();
        Map<RequestMappingInfo, HandlerMethod> ds = new LinkedHashMap<>();
        ds.put(RequestMappingInfo.paths("/a").build(), new HandlerMethod(gia, BoDieuKhienGia.class.getMethod("taoPhieuNhap")));
        ds.put(RequestMappingInfo.paths("/b").build(), new HandlerMethod(gia, BoDieuKhienGia.class.getMethod("khongTrongKho")));
        ds.put(RequestMappingInfo.paths("/c").build(), new HandlerMethod(gia, BoDieuKhienGia.class.getMethod("khongBaoVe")));
        when(anhXa.getHandlerMethods()).thenReturn(ds);
        when(applicationContext.getBean("requestMappingHandlerMapping", RequestMappingHandlerMapping.class)).thenReturn(anhXa);
    }

    /** Bộ điều khiển giả để kiểm việc quét @RequireAuth. */
    static class BoDieuKhienGia {
        @GetMapping("/a")
        @RequireAuth(roles = {IRoleType.nhan_vien_kho}, permissions = {IPermissionType.tao_phieu_nhap,
                IPermissionType.huy_phieu_nhap}, inWarehouse = true)
        public void taoPhieuNhap() {
        }

        @RequireAuth(roles = {IRoleType.nhan_vien_kho}, permissions = {IPermissionType.duyet_phieu_nhap})
        public void khongTrongKho() {
        }

        public void khongBaoVe() {
        }
    }

    // ───────── Quyền của tôi ─────────

    @Nested
    @DisplayName("Quyền của tôi")
    class QuyenCuaToi {

        private PhanQuyenNguoiDungKhoDto pqTrongToken(Kho k, Map<String, Integer> quyenVaTrangThai) {
            // ChiTietQuyenKhoDto so bằng theo id: mỗi dòng phải có id riêng như trong token thật
            int[] id = {9000};
            Set<ChiTietQuyenKhoDto> ct = quyenVaTrangThai.entrySet().stream().map(e -> ChiTietQuyenKhoDto.builder()
                    .id(id[0]++)
                    .quyenHan(QuyenHanDto.builder().maQuyen(e.getKey()).tenQuyen("Tên " + e.getKey()).build())
                    .trangThai(e.getValue()).build()).collect(Collectors.toSet());
            return PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(k.getId()).build()).chiTietQuyenKhos(ct).build();
        }

        @Test
        @DisplayName("Chỉ quyền đang bật tại kho đang hiệu lực; khớp phiên thì không cần đăng nhập lại")
        void khopPhien() {
            phanKhoSan(nhanVien, khoTong, List.of(7, 1));
            SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(52).vaiTro(Set.of(IRoleType.nhan_vien_kho))
                    .phanQuyenNguoiDungKhos(List.of(pqTrongToken(khoTong, Map.of("xem_ton_kho", 1, "tao_phieu_nhap", 1,
                            "cap_quyen_nhan_vien", 0)))).build());

            QuyenCuaToiDto q = service.layQuyenCuaToi();

            assertEquals(IRoleType.nhan_vien_kho, q.getVaiTro());
            assertFalse(q.isToanQuyen());
            assertEquals("KHO_TONG", q.getKho().getMaKho());
            assertEquals(List.of("xem_ton_kho", "tao_phieu_nhap"), q.getQuyen().stream().map(QuyenHanDto::getMaQuyen).toList());
            assertFalse(q.isCanDangNhapLai());
            assertEquals("Nguyễn Quản Trị", q.getCapNhatBoi());
        }

        @Test
        @DisplayName("Quyền vừa đổi sau khi đăng nhập: báo quyền mới, quyền đã thu hồi, cần đăng nhập lại")
        void quyenDaDoi() {
            phanKhoSan(nhanVien, khoTong, List.of(1, 3));
            SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(52).vaiTro(Set.of(IRoleType.nhan_vien_kho))
                    .phanQuyenNguoiDungKhos(List.of(pqTrongToken(khoTong, Map.of("xem_ton_kho", 1, "chuyen_kho", 1)))).build());

            QuyenCuaToiDto q = service.layQuyenCuaToi();

            assertTrue(q.isCanDangNhapLai());
            assertEquals(List.of("dieu_chinh_ton_kho"), q.getQuyenMoi());
            assertEquals(List.of("Tên chuyen_kho"), q.getQuyenDaThuHoi());
        }

        @Test
        @DisplayName("Lấy người cập nhật từ lịch sử phân quyền gần nhất")
        void capNhatTuLichSu() {
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, List.of(1)));
            dangNhap(nhanVien);
            QuyenCuaToiDto q = service.layQuyenCuaToi();
            assertEquals(BAY_GIO, q.getCapNhatLuc());
            assertEquals("Nguyễn Quản Trị", q.getCapNhatBoi());
            assertEquals("quantri@fcentric.net", q.getCapNhatBoiEmail());
            assertTrue(q.isCanDangNhapLai(), "token cũ chưa có kho");
        }

        @Test
        @DisplayName("Quản trị viên: toàn quyền, không danh sách quyền")
        void quanTriVien() {
            QuyenCuaToiDto q = service.layQuyenCuaToi();
            assertTrue(q.isToanQuyen());
            assertTrue(q.getQuyen().isEmpty());
            assertFalse(q.isCanDangNhapLai());
        }

        @Test
        @DisplayName("Chưa phân kho: không kho, không quyền")
        void chuaPhanKho() {
            dangNhap(nhanVien);
            QuyenCuaToiDto q = service.layQuyenCuaToi();
            assertNull(q.getKho());
            assertTrue(q.getQuyen().isEmpty());
            assertFalse(q.isCanDangNhapLai());
        }
    }

    // ───────── Các điểm sửa sau review 18/10/2026 ─────────

    @Nested
    @DisplayName("Sau review: phiên JPA, giữ chỗ kho, quản lý kho, API cũ, lịch sử cũ")
    class SauReview {

        private NguoiDung quanLy;

        @BeforeEach
        void them() {
            quanLy = PhanQuyenNguoiDungServiceImplTest.this.them(NguoiDung.builder().id(60).tenDangNhap("quanly").hoTen("Lê Quản Lý")
                    .vaiTro(IRoleType.quan_ly_kho).trangThai(1).build());
        }

        private PhanQuyenNguoiDungKhoCreating ganQuyen(int nguoiDungId, int khoId, Integer... quyenIds) {
            Set<ChiTietQuyenKhoCreating> ct = new java.util.LinkedHashSet<>();
            for (Integer id : quyenIds) ct.add(ChiTietQuyenKhoCreating.builder().quyenHanId(id).trangThai(1).build());
            return PhanQuyenNguoiDungKhoCreating.builder().nguoiDungId(nguoiDungId).khoId(khoId).laQuanLyKho(0)
                    .chiTietQuyenKhos(ct).build();
        }

        @Test
        @DisplayName("B1: lưu xong thì flush + clear phiên JPA để controller đọc lại đủ quyền")
        void flushVaClear() throws Exception {
            EntityManager em = mock(EntityManager.class);
            java.lang.reflect.Field f = PhanQuyenNguoiDungServiceImpl.class.getDeclaredField("entityManager");
            f.setAccessible(true);
            f.set(service, em);
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, MAU_NHAN_VIEN_KHO));
            org.mockito.InOrder thuTu = inOrder(em);
            thuTu.verify(em).flush();
            thuTu.verify(em).clear();
        }

        @Test
        @DisplayName("B4: phân quyền hẹn ngày bắt đầu ở kho khác vẫn bị thu hồi khi phân kho mới")
        void henNgay_vanBiThuHoi() {
            PhanQuyenNguoiDungKho hen = phanKhoSan(nhanVien, khoHaNoi, List.of(1));
            hen.setNgayBatDau(BAY_GIO.plusSeconds(86_400));
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, List.of(1)));
            assertEquals(0, hen.getTrangThai());
            assertEquals(1, phanQuyenRepository.findGiuChoByNguoiDungId(52, BAY_GIO).size());
        }

        @Test
        @DisplayName("B4: lưu đúng kho đang hẹn ngày thì kích hoạt ngay")
        void henNgay_kichHoat() {
            PhanQuyenNguoiDungKho hen = phanKhoSan(nhanVien, khoTong, List.of(1));
            hen.setNgayBatDau(BAY_GIO.plusSeconds(86_400));
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, List.of(1)));
            assertEquals(BAY_GIO.minusSeconds(60), hen.getNgayBatDau());
            assertEquals(1, phanQuyenRepository.findHieuLucTai(52, BAY_GIO).size());
        }

        @Test
        @DisplayName("B6: quản lý kho chuyển kho hoặc thôi làm quản lý thì bỏ khỏi kho.quan_ly_id")
        void boQuanLyKho() {
            phanKhoSan(quanLy, khoTong, List.of(1));
            khoTong.setQuanLy(quanLy);
            service.luuPhanQuyen(60, yeuCau(IRoleType.quan_ly_kho, 23, List.of(1)));
            assertNull(khoTong.getQuanLy(), "chuyển kho");
            verify(khoRepository).save(khoTong);

            khoHaNoi.setQuanLy(quanLy);
            service.luuPhanQuyen(60, yeuCau(IRoleType.nhan_vien_kho, 23, List.of(1)));
            assertNull(khoHaNoi.getQuanLy(), "thôi làm quản lý nhưng vẫn ở kho");
        }

        @Test
        @DisplayName("B6: quản lý kho vẫn ở kho cũ thì giữ nguyên quan_ly_id")
        void giuQuanLyKho() {
            phanKhoSan(quanLy, khoTong, List.of(1));
            khoTong.setQuanLy(quanLy);
            service.luuPhanQuyen(60, yeuCau(IRoleType.quan_ly_kho, 22, List.of(1, 2)));
            assertSame(quanLy, khoTong.getQuanLy());
        }

        @Test
        @DisplayName("B2: quản lý kho gọi gan-quyen: chặn tự cấp, khác kho đang chọn, vượt quyền, vai trò không phải nhân viên")
        void ganQuyenCu_quanLyKho() {
            phanKhoSan(quanLy, khoTong, List.of(1, 20));
            dangNhap(quanLy);
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(22, ganQuyen(60, 22, 1)), "tự cấp");
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(22, ganQuyen(52, 23, 1)), "khác kho đang chọn");
            CommonException vuot = assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(22, ganQuyen(52, 22, 1, 8)));
            assertTrue(vuot.getMessage().contains("Tên duyet_phieu_nhap"), vuot.getMessage());
            PhanQuyenNguoiDungKhoCreating datQuanLy = ganQuyen(52, 22, 1);
            datQuanLy.setLaQuanLyKho(1);
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(22, datQuanLy), "đặt quản lý kho");
            PhanQuyenNguoiDungServiceImplTest.this.them(NguoiDung.builder().id(61).vaiTro(IRoleType.quan_ly_kho).trangThai(1).build());
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(22, ganQuyen(61, 22, 1)), "quản lý kho khác");
            assertDoesNotThrow(() -> service.kiemTraGanQuyenCu(22, ganQuyen(52, 22, 1)));
        }

        @Test
        @DisplayName("B2: admin gọi gan-quyen: vẫn chặn kho ảo, kho ngừng hoạt động, khách hàng")
        void ganQuyenCu_admin() {
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(null, ganQuyen(52, 25, 1)), "kho ảo");
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(null, ganQuyen(52, 24, 1)), "kho ngừng");
            nhanVien.setVaiTro(IRoleType.khach_hang);
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(null, ganQuyen(52, 22, 1)), "khách hàng");
            nhanVien.setVaiTro(IRoleType.nhan_vien_kho);
            assertDoesNotThrow(() -> service.kiemTraGanQuyenCu(null, ganQuyen(52, 23, 8)));
        }

        @Test
        @DisplayName("B2: xoa-quyen thu hồi mềm và ghi lịch sử; quản lý kho không thu hồi của mình")
        void xoaQuyenCu() {
            PhanQuyenNguoiDungKho cuaQuanLy = phanKhoSan(quanLy, khoTong, List.of(1, 20));
            PhanQuyenNguoiDungKho cuaNhanVien = phanKhoSan(nhanVien, khoTong, List.of(1, 7));
            dangNhap(quanLy);
            assertThrows(CommonException.class, () -> service.thuHoiPhanQuyenKhoTheoId(cuaQuanLy.getId(), 22));
            assertThrows(CommonException.class, () -> service.thuHoiPhanQuyenKhoTheoId(cuaNhanVien.getId(), 23));
            service.thuHoiPhanQuyenKhoTheoId(cuaNhanVien.getId(), 22);
            assertEquals(0, cuaNhanVien.getTrangThai());
            assertTrue(quyenDangBat(cuaNhanVien).isEmpty());
            assertTrue(phanQuyen.contains(cuaNhanVien), "không xóa dòng");
            assertEquals(1, lichSu.size());
            assertTrue(lichSu.get(0).getGiaTriMoi().contains("\"kho\":null"), lichSu.get(0).getGiaTriMoi());
        }

        @Test
        @DisplayName("B2: gan-vai-tro giữ kho và quyền; sang khách hàng thì thu hồi kho")
        void ganVaiTroCu() {
            PhanQuyenNguoiDungKho p = phanKhoSan(nhanVien, khoTong, List.of(1, 7));
            service.doiVaiTro(52, IRoleType.nhan_vien_mua_hang);
            assertEquals(IRoleType.nhan_vien_mua_hang, nhanVien.getVaiTro());
            assertEquals(List.of(1, 7), quyenDangBat(p));
            service.doiVaiTro(52, IRoleType.khach_hang);
            assertEquals(0, p.getTrangThai());
            assertEquals(2, lichSu.size());
            dangNhap(nhanVien);
            assertThrows(CommonException.class, () -> service.doiVaiTro(52, IRoleType.quan_tri_vien), "tự đổi");
        }

        @Test
        @DisplayName("B7: lịch sử cũ: lần gán đầu hiện là được phân vào kho, lần lưu không đổi gì bị bỏ")
        void lichSuCu() {
            lichSu.add(LichSuThayDoi.builder().id(1).loaiThamChieu(ITable.nguoi_dung).idThamChieu(52).kho(khoTong)
                    .hanhDong(IHanhDong.nang_cap_chuc_vu).giaTriCu("{}").giaTriMoi("{}").nguoiThucHien(admin)
                    .ngayThucHien(BAY_GIO.minusSeconds(7200)).build());
            lichSu.add(LichSuThayDoi.builder().id(2).loaiThamChieu(ITable.nguoi_dung).idThamChieu(52).kho(khoTong)
                    .hanhDong(IHanhDong.cap_nhat_quyen).giaTriCu("{\"trangThai\":1}").giaTriMoi("{\"quyenHanId\":1,\"trangThai\":1}")
                    .nguoiThucHien(admin).ngayThucHien(BAY_GIO.minusSeconds(3600)).build());
            List<LichSuPhanQuyenDto> ds = service.layLichSuPhanQuyen(52);
            assertEquals(1, ds.size(), "nhóm không đổi gì bị bỏ");
            assertNull(ds.get(0).getKhoCu());
            assertEquals("KHO_TONG", ds.get(0).getKhoMoi().getMaKho());
        }

        @Test
        @DisplayName("Quyền của tôi kèm danh sách quyền có API kiểm (để ẩn quyền chưa có tác dụng)")
        void quyenCuaToi_quyenDaApDung() throws Exception {
            phanKhoSan(nhanVien, khoTong, List.of(1));
            dangNhap(nhanVien);
            ganAnhXaGia();
            assertEquals(List.of(IPermissionType.huy_phieu_nhap, IPermissionType.tao_phieu_nhap),
                    service.layQuyenCuaToi().getQuyenDaApDung());
        }

        @Test
        @DisplayName("Quyền của tôi khi không quét được: quyenDaApDung = null, phần còn lại vẫn trả về, lần sau quét lại")
        void quyenCuaToi_quetLoi() throws Exception {
            phanKhoSan(nhanVien, khoTong, List.of(1));
            dangNhap(nhanVien);
            when(applicationContext.getBean("requestMappingHandlerMapping", RequestMappingHandlerMapping.class))
                    .thenThrow(new NoSuchBeanDefinitionException("requestMappingHandlerMapping"));
            QuyenCuaToiDto q = service.layQuyenCuaToi();
            assertNull(q.getQuyenDaApDung());
            assertEquals(List.of(1), q.getQuyen().stream().map(QuyenHanDto::getId).toList());

            reset(applicationContext);
            ganAnhXaGia();
            assertEquals(List.of(IPermissionType.huy_phieu_nhap, IPermissionType.tao_phieu_nhap),
                    service.layQuyenCuaToi().getQuyenDaApDung());
        }
    }
}
