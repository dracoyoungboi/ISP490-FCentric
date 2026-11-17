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
    // Mẫu nhân viên kho nằm trong trần quyền (IPermissionType.TRAN_THEO_VAI_TRO): không còn xem_bao_cao_ton_kho (15)
    private static final List<Integer> MAU_NHAN_VIEN_KHO = List.of(1, 2, 4, 7, 12);

    private static final String QLK = IRoleType.quan_ly_kho;
    private static final String NVK = IRoleType.nhan_vien_kho;
    private static final String NVMH = IRoleType.nhan_vien_mua_hang;
    private static final String NVBH = IRoleType.nhan_vien_ban_hang;
    /** Trần quyền theo id của MA_QUYEN (ma trận SRS 4.4), viết tay để đối chiếu với IPermissionType.TRAN_THEO_VAI_TRO. */
    private static final Map<String, List<Integer>> TRAN_ID = Map.of(
            QLK, List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 18),
            NVK, List.of(1, 2, 4, 7, 8, 9, 12, 13, 16, 18),
            NVMH, List.of(1, 5, 6, 18, 22),
            NVBH, List.of(1, 10, 11, 17, 18, 23));

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

    /** Yêu cầu của API gán quyền cũ (POST /quyen-han/gan-quyen): mọi quyền gửi lên đều bật. */
    private PhanQuyenNguoiDungKhoCreating ganQuyen(int nguoiDungId, int khoId, Integer... quyenIds) {
        Set<ChiTietQuyenKhoCreating> ct = new java.util.LinkedHashSet<>();
        for (Integer id : quyenIds) ct.add(ChiTietQuyenKhoCreating.builder().quyenHanId(id).trangThai(1).build());
        return PhanQuyenNguoiDungKhoCreating.builder().nguoiDungId(nguoiDungId).khoId(khoId).laQuanLyKho(0)
                .chiTietQuyenKhos(ct).build();
    }

    @Test
    @DisplayName("Làm việc theo kho: quản lý kho và 3 vai trò nhân viên; không gồm quản trị viên và vai trò lạ")
    void lamViecTheoKho() {
        for (String v : List.of(IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho,
                IRoleType.nhan_vien_ban_hang, IRoleType.nhan_vien_mua_hang)) {
            assertTrue(PhanQuyenNguoiDungServiceImpl.lamViecTheoKho(v), v);
        }
        for (String v : new String[]{IRoleType.quan_tri_vien, "khach_hang", IRoleType.all, "", null}) {
            assertFalse(PhanQuyenNguoiDungServiceImpl.lamViecTheoKho(v), String.valueOf(v));
        }
    }

    // ───────── Lưu phân quyền ─────────

    @Nested
    @DisplayName("Lưu phân quyền một lần")
    class LuuPhanQuyen {

        @Test
        @DisplayName("Bỏ 18 quyền ngoài mẫu: chỉ còn 5 quyền, ghi đúng một dòng lịch sử có 18 quyền bị thu hồi")
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
        @DisplayName("Trần quyền theo vai trò (SRS 4.4): quyền ngoài trần bị từ chối, không đổi gì")
        void quyenNgoaiTran_biTuChoi() {
            PhanQuyenNguoiDungKho p = phanKhoSan(nhanVien, khoTong, List.of(1));
            // Nhân viên bán hàng không được cấp "tạo phiếu nhập" (7); nhân viên kho không được "xem báo cáo tồn kho" (15)
            CommonException loi = assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_ban_hang, 22, List.of(1, 7))));
            assertTrue(loi.getMessage().contains("Tên tao_phieu_nhap"), loi.getMessage());
            assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, List.of(1, 15))));
            assertEquals(IRoleType.nhan_vien_kho, nhanVien.getVaiTro());
            assertEquals(List.of(1), quyenDangBat(p));
            assertTrue(lichSu.isEmpty());
            // Trong trần thì lưu được
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 22, List.of(1, 7, 16)));
            assertEquals(List.of(1, 7, 16), quyenDangBat(p));
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

            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 23, List.of(1, 16)));

            assertEquals(0, cu.getTrangThai());
            assertEquals(BAY_GIO, cu.getNgayKetThuc());
            assertTrue(quyenDangBat(cu).isEmpty());
            PhanQuyenNguoiDungKho moi = phanQuyen.stream().filter(x -> x.getKho() == khoHaNoi).findFirst().orElseThrow();
            assertEquals(1, moi.getTrangThai());
            assertEquals(List.of(1, 16), quyenDangBat(moi));
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
            assertEquals("Vai trò không hợp lệ", assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau("all", null, null))).getMessage());
            // Khách hàng không phải người dùng hệ thống: không còn là vai trò gán được
            assertEquals("Vai trò không hợp lệ", assertThrows(CommonException.class,
                    () -> service.luuPhanQuyen(52, yeuCau("khach_hang", null, null))).getMessage());
            assertEquals(IRoleType.nhan_vien_kho, nhanVien.getVaiTro());
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
            service.luuPhanQuyen(52, yeuCau(IRoleType.nhan_vien_kho, 23, List.of(1, 16)));
            LichSuPhanQuyenDto d = service.layLichSuPhanQuyen(52).get(0);
            assertEquals("KHO_TONG", d.getKhoCu().getMaKho());
            assertEquals("KHO_HN", d.getKhoMoi().getMaKho());
            assertEquals(List.of("Tên xem_ton_kho", "Tên xem_bao_cao_nhap_xuat"), d.getQuyenThem());
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
            // Trần quyền nhân viên kho theo id của danh sách quyền giả (MA_QUYEN đánh số từ 1)
            assertEquals(List.of(1, 2, 4, 7, 8, 9, 12, 13, 16, 18), c.getTranQuyen().get(IRoleType.nhan_vien_kho));
            assertFalse(c.getTranQuyen().get(IRoleType.quan_ly_kho).contains(20), "quản lý kho không cấp quyền nhân viên");
            assertEquals(List.of(IPermissionType.dieu_chinh_ton_kho, IPermissionType.huy_phieu_nhap,
                    IPermissionType.tao_dot_kiem_ke, IPermissionType.tao_phieu_nhap), c.getQuyenDaApDung());

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
            assertEquals(List.of(IPermissionType.dieu_chinh_ton_kho, IPermissionType.huy_phieu_nhap,
                    IPermissionType.tao_dot_kiem_ke, IPermissionType.tao_phieu_nhap),
                    service.layCauHinhPhanQuyen().getQuyenDaApDung(), "lần lỗi không được giữ lại");
        }

        @Test
        @DisplayName("Cập nhật mẫu: kiểm vai trò, kiểm id quyền, ghi lịch sử")
        void capNhatMau() {
            assertThrows(CommonException.class, () -> service.capNhatMauQuyen(IRoleType.quan_tri_vien, List.of(1)));
            assertThrows(CommonException.class, () -> service.capNhatMauQuyen(IRoleType.nhan_vien_kho, List.of(1, 99)));
            // Mẫu chỉ gồm quyền trong trần của vai trò: nhân viên kho không có "xem báo cáo tồn kho" (15)
            assertThrows(CommonException.class, () -> service.capNhatMauQuyen(IRoleType.nhan_vien_kho, List.of(1, 15)));
            verify(mauRepository, never()).thayMau(any(), any());

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
        @DisplayName("B2: admin gọi gan-quyen: vẫn chặn kho ảo, kho ngừng hoạt động, quản trị viên và vai trò không còn dùng")
        void ganQuyenCu_admin() {
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(null, ganQuyen(52, 25, 1)), "kho ảo");
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(null, ganQuyen(52, 24, 1)), "kho ngừng");
            nhanVien.setVaiTro(IRoleType.quan_tri_vien);
            assertEquals("Chỉ phân kho cho quản lý kho và nhân viên", assertThrows(CommonException.class,
                    () -> service.kiemTraGanQuyenCu(null, ganQuyen(52, 22, 1)), "quản trị viên").getMessage());
            nhanVien.setVaiTro("khach_hang"); // dữ liệu cũ trước khi bỏ vai trò khách hàng
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(null, ganQuyen(52, 22, 1)), "vai trò cũ");
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
        @DisplayName("B2: gan-vai-tro giữ kho và quyền; sang quản trị viên thì thu hồi kho; khách hàng không còn là vai trò")
        void ganVaiTroCu() {
            PhanQuyenNguoiDungKho p = phanKhoSan(nhanVien, khoTong, List.of(1, 7));
            service.doiVaiTro(52, IRoleType.nhan_vien_mua_hang);
            assertEquals(IRoleType.nhan_vien_mua_hang, nhanVien.getVaiTro());
            // tao_phieu_nhap (7) ngoài trần quyền của nhân viên mua hàng: tự bỏ khi đổi vai trò
            assertEquals(List.of(1), quyenDangBat(p));
            assertEquals("Vai trò không hợp lệ", assertThrows(CommonException.class,
                    () -> service.doiVaiTro(52, "khach_hang")).getMessage());
            assertEquals(IRoleType.nhan_vien_mua_hang, nhanVien.getVaiTro(), "vai trò không hợp lệ thì không đổi gì");
            assertEquals(List.of(1), quyenDangBat(p));
            service.doiVaiTro(52, IRoleType.quan_tri_vien);
            assertEquals(0, p.getTrangThai());
            assertEquals(2, lichSu.size());
            dangNhap(nhanVien);
            assertThrows(CommonException.class, () -> service.doiVaiTro(52, IRoleType.nhan_vien_kho), "tự đổi");
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
            assertEquals(List.of(IPermissionType.dieu_chinh_ton_kho, IPermissionType.huy_phieu_nhap,
                    IPermissionType.tao_dot_kiem_ke, IPermissionType.tao_phieu_nhap),
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
            assertEquals(List.of(IPermissionType.dieu_chinh_ton_kho, IPermissionType.huy_phieu_nhap,
                    IPermissionType.tao_dot_kiem_ke, IPermissionType.tao_phieu_nhap),
                    service.layQuyenCuaToi().getQuyenDaApDung());
        }
    }

    // ───────── Trần quyền theo vai trò (SRS 4.4) ─────────

    @Nested
    @DisplayName("Trần quyền theo vai trò ở mọi đường ghi quyền")
    class TranQuyenTheoVaiTro {

        private List<Integer> ngoaiTran(String vaiTro) {
            return tatCa().stream().filter(id -> !TRAN_ID.get(vaiTro).contains(id)).toList();
        }

        private NguoiDung nguoiMoi(int id, String vaiTro) {
            return them(NguoiDung.builder().id(id).tenDangNhap("nv" + id).hoTen("Nhân viên " + id).vaiTro(vaiTro)
                    .trangThai(1).build());
        }

        @Test
        @DisplayName("Bảng id trần trong test khớp IPermissionType.trongTran theo mã quyền")
        void bangIdKhopMa() {
            for (String vt : TRAN_ID.keySet()) {
                for (int id = 1; id <= MA_QUYEN.length; id++) {
                    assertEquals(TRAN_ID.get(vt).contains(id), IPermissionType.trongTran(vt, MA_QUYEN[id - 1]),
                            vt + " / " + MA_QUYEN[id - 1]);
                }
            }
        }

        @Test
        @DisplayName("Lưu phân quyền: mỗi vai trò lưu được đủ trần của mình, cùng kho thì giữ một phân quyền")
        void luu_duTran() {
            for (String vt : List.of(QLK, NVK, NVMH, NVBH)) {
                service.luuPhanQuyen(52, yeuCau(vt, 22, TRAN_ID.get(vt)));
                assertEquals(vt, nhanVien.getVaiTro());
                assertEquals(TRAN_ID.get(vt), quyenDangBat(phanQuyen.get(0)), vt);
                assertEquals(QLK.equals(vt) ? 1 : 0, phanQuyen.get(0).getLaQuanLyKho(), vt);
            }
            assertEquals(1, phanQuyen.size());
            assertEquals(4, lichSu.size());
        }

        @Test
        @DisplayName("Lưu phân quyền: từng quyền ngoài trần của từng vai trò đều bị từ chối, nêu tên quyền, không đổi gì")
        void luu_tungQuyenNgoaiTran() {
            PhanQuyenNguoiDungKho p = phanKhoSan(nhanVien, khoTong, List.of(1));
            int dem = 0;
            for (String vt : TRAN_ID.keySet()) {
                for (Integer id : ngoaiTran(vt)) {
                    CommonException loi = assertThrows(CommonException.class,
                            () -> service.luuPhanQuyen(52, yeuCau(vt, 22, List.of(1, id))), vt + " / " + MA_QUYEN[id - 1]);
                    assertTrue(loi.getMessage().contains("\"Tên " + MA_QUYEN[id - 1] + "\""), loi.getMessage());
                    dem++;
                }
            }
            assertEquals(8 + 13 + 18 + 17, dem, "23 quyền trừ trần 15 / 10 / 5 / 6");
            assertEquals(NVK, nhanVien.getVaiTro());
            assertEquals(List.of(1), quyenDangBat(p));
            assertTrue(lichSu.isEmpty());
        }

        @Test
        @DisplayName("Không vai trò nào được cấp quản lý nhân viên kho, cấp quyền nhân viên, quản lý sản phẩm")
        void quyenChiQuanTriVien() {
            phanKhoSan(nhanVien, khoTong, List.of(1));
            for (String vt : TRAN_ID.keySet()) {
                for (Integer id : List.of(19, 20, 21)) {
                    assertThrows(CommonException.class, () -> service.luuPhanQuyen(52, yeuCau(vt, 22, List.of(id))),
                            vt + " / " + MA_QUYEN[id - 1]);
                    assertThrows(CommonException.class, () -> service.capNhatMauQuyen(vt, List.of(id)),
                            "mẫu " + vt + " / " + MA_QUYEN[id - 1]);
                }
            }
            verify(mauRepository, never()).thayMau(any(), any());
        }

        @Test
        @DisplayName("Dữ liệu cũ ngoài trần: lưu lại trong trần thì thu hồi quyền cũ và ghi lịch sử")
        void duLieuCu_luuLaiThuHoi() {
            nguoiMoi(70, NVBH);
            PhanQuyenNguoiDungKho p = phanKhoSan(nguoiDung.get(70), khoHaNoi, List.of(1, 7, 10, 12));
            service.luuPhanQuyen(70, yeuCau(NVBH, 23, List.of(1, 10)));
            assertEquals(List.of(1, 10), quyenDangBat(p));
            assertEquals(1, lichSu.size());
            assertTrue(lichSu.get(0).getGiaTriCu().contains("tao_phieu_nhap"), lichSu.get(0).getGiaTriCu());
            assertFalse(lichSu.get(0).getGiaTriMoi().contains("tao_phieu_nhap"), lichSu.get(0).getGiaTriMoi());
        }

        @Test
        @DisplayName("Quản trị viên không dùng quyền chi tiết: quyền gửi kèm bị bỏ qua, không báo ngoài trần")
        void quanTriVien_khongXetTran() {
            PhanQuyenNguoiDungKho p = phanKhoSan(nhanVien, khoTong, List.of(1, 7));
            service.luuPhanQuyen(52, yeuCau(IRoleType.quan_tri_vien, null, List.of(19, 20, 21)));
            assertEquals(IRoleType.quan_tri_vien, nhanVien.getVaiTro());
            assertEquals(0, p.getTrangThai());
            assertTrue(quyenDangBat(p).isEmpty());
        }

        @Test
        @DisplayName("Tạo tài khoản: điền mẫu của vai trò, bỏ quyền ngoài trần còn sót trong mẫu cũ thay vì chặn tạo")
        void taiKhoanMoi_locMauCu() {
            when(mauRepository.layTatCa()).thenReturn(Map.of(NVBH, List.of(1, 7, 10, 23), NVK, MAU_NHAN_VIEN_KHO));
            nguoiMoi(70, NVBH);
            service.phanKhoTaiKhoanMoi(70, NVBH, 23);
            assertEquals(1, phanQuyen.size());
            assertSame(khoHaNoi, phanQuyen.get(0).getKho());
            assertEquals(List.of(1, 10, 23), quyenDangBat(phanQuyen.get(0)));
        }

        @Test
        @DisplayName("Tạo tài khoản: vai trò chưa có mẫu thì phân kho không quyền; quản trị viên không phân kho; thiếu kho thì báo lỗi")
        void taiKhoanMoi_bien() {
            nguoiMoi(71, NVMH);
            service.phanKhoTaiKhoanMoi(71, NVMH, 22);
            assertEquals(1, phanQuyen.size());
            assertTrue(quyenDangBat(phanQuyen.get(0)).isEmpty());

            nguoiMoi(72, IRoleType.quan_tri_vien);
            service.phanKhoTaiKhoanMoi(72, IRoleType.quan_tri_vien, 22);
            assertEquals(1, phanQuyen.size(), "quản trị viên không làm việc theo kho");

            assertThrows(CommonException.class, () -> service.phanKhoTaiKhoanMoi(52, NVK, null));
        }

        @Test
        @DisplayName("Mẫu quyền: mỗi vai trò lưu được đủ trần; một quyền ngoài trần thì cả mẫu bị từ chối")
        void mau_moiVaiTro() {
            Map<String, Integer> ngoai = Map.of(QLK, 17, NVK, 3, NVMH, 7, NVBH, 12);
            for (String vt : List.of(QLK, NVK, NVMH, NVBH)) {
                CommonException loi = assertThrows(CommonException.class,
                        () -> service.capNhatMauQuyen(vt, List.of(1, ngoai.get(vt))), vt);
                assertTrue(loi.getMessage().contains("Tên " + MA_QUYEN[ngoai.get(vt) - 1]), loi.getMessage());
                verify(mauRepository, never()).thayMau(eq(vt), any());

                service.capNhatMauQuyen(vt, TRAN_ID.get(vt));
                verify(mauRepository).thayMau(eq(vt),
                        argThat(ids -> new java.util.TreeSet<>(ids).equals(new java.util.TreeSet<>(TRAN_ID.get(vt)))));
            }
            assertEquals(4, lichSu.size());
        }

        @Test
        @DisplayName("Mẫu quyền rỗng lưu được (tài khoản mới chưa có quyền nào)")
        void mau_rong() {
            service.capNhatMauQuyen(NVBH, List.of());
            verify(mauRepository).thayMau(eq(NVBH), argThat(Collection::isEmpty));
        }

        @Test
        @DisplayName("API gán quyền cũ: kể cả quản trị viên cũng không cấp được quyền ngoài trần của người nhận")
        void ganQuyenCu_admin_ngoaiTran() {
            CommonException loi = assertThrows(CommonException.class,
                    () -> service.kiemTraGanQuyenCu(null, ganQuyen(52, 22, 1, 15)));
            assertTrue(loi.getMessage().contains("Tên xem_bao_cao_ton_kho"), loi.getMessage());

            nguoiMoi(70, NVBH);
            assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(null, ganQuyen(70, 23, 1, 12)));
            assertDoesNotThrow(() -> service.kiemTraGanQuyenCu(null, ganQuyen(70, 23, 1, 10, 17)));

            // Quyền gửi kèm trạng thái tắt không tính là cấp
            PhanQuyenNguoiDungKhoCreating coQuyenTat = ganQuyen(52, 22, 1);
            coQuyenTat.getChiTietQuyenKhos().add(ChiTietQuyenKhoCreating.builder().quyenHanId(15).trangThai(0).build());
            assertDoesNotThrow(() -> service.kiemTraGanQuyenCu(null, coQuyenTat));
        }

        @Test
        @DisplayName("API gán quyền cũ: quản lý kho đang giữ quyền vẫn không cấp được cho nhân viên nếu ngoài trần nhân viên")
        void ganQuyenCu_quanLy_ngoaiTranNhanVien() {
            NguoiDung quanLy = nguoiMoi(60, QLK);
            phanKhoSan(quanLy, khoTong, List.of(1, 3, 14));
            dangNhap(quanLy);
            CommonException loi = assertThrows(CommonException.class,
                    () -> service.kiemTraGanQuyenCu(22, ganQuyen(52, 22, 1, 3)));
            assertTrue(loi.getMessage().contains("Tên dieu_chinh_ton_kho"), loi.getMessage());
            loi = assertThrows(CommonException.class, () -> service.kiemTraGanQuyenCu(22, ganQuyen(52, 22, 14)));
            assertTrue(loi.getMessage().contains("Tên huy_phieu_xuat"), loi.getMessage());
            assertDoesNotThrow(() -> service.kiemTraGanQuyenCu(22, ganQuyen(52, 22, 1)));
        }

        @Test
        @DisplayName("Đổi vai trò (API cũ): giữ kho, chỉ giữ quyền nằm trong trần của vai trò mới")
        void doiVaiTro_chuoi() {
            PhanQuyenNguoiDungKho p = phanKhoSan(nhanVien, khoTong, TRAN_ID.get(NVK));
            service.doiVaiTro(52, QLK);
            assertEquals(TRAN_ID.get(NVK), quyenDangBat(p), "trần nhân viên kho nằm gọn trong trần quản lý kho");
            assertEquals(1, p.getLaQuanLyKho());

            service.doiVaiTro(52, NVBH);
            assertEquals(List.of(1, 18), quyenDangBat(p), "chỉ còn xem tồn kho, xuất báo cáo");
            assertEquals(0, p.getLaQuanLyKho());

            service.doiVaiTro(52, NVMH);
            assertEquals(List.of(1, 18), quyenDangBat(p));
            assertSame(khoTong, p.getKho());
            assertEquals(1, p.getTrangThai());
            assertEquals(3, lichSu.size());
        }

        @Test
        @DisplayName("Cấu hình gửi giao diện: trần theo id cho đủ 4 vai trò, không có quản trị viên; mẫu đang lưu nằm trong trần")
        void cauHinh_tranMoiVaiTro() {
            CauHinhPhanQuyenDto c = service.layCauHinhPhanQuyen();
            assertEquals(List.of(QLK, NVK, NVMH, NVBH), new ArrayList<>(c.getTranQuyen().keySet()));
            TRAN_ID.forEach((vt, ids) -> assertEquals(ids, c.getTranQuyen().get(vt), vt));
            assertFalse(c.getTranQuyen().containsKey(IRoleType.quan_tri_vien));
            c.getMauQuyen().forEach((vt, ids) -> assertTrue(c.getTranQuyen().get(vt).containsAll(ids), vt));
        }
    }
}
