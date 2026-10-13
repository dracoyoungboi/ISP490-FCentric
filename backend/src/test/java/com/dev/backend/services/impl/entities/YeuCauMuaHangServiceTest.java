package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.dto.request.ChiTietYeuCauMuaHangCreating;
import com.dev.backend.dto.request.YeuCauMuaHangCreating;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.dto.response.entities.YeuCauMuaHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.YeuCauMuaHangMapper;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.repository.YeuCauMuaHangRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.repository.query.parser.PartTree;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Yêu cầu nhập hàng: sinh mã phiếu, lưu ghi chú, duyệt / từ chối (trạng thái,
 * quyền theo kho, lý do từ chối, ghi lịch sử) và đọc lại lý do từ chối.
 */
@ExtendWith(MockitoExtension.class)
class YeuCauMuaHangServiceTest {

    @Mock
    private YeuCauMuaHangRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private NguoiDungService nguoiDungService;
    @Mock
    private KhoService khoService;
    @Mock
    private BienTheSanPhamService bienTheSanPhamService;
    @Mock
    private ChiTietYeuCauMuaHangService chiTietYeuCauMuaHangService;
    @Mock
    private LichSuThayDoiService lichSuThayDoiService;
    @Mock
    private LichSuThayDoiRepository lichSuThayDoiRepository;
    @Mock
    private YeuCauMuaHangMapper yeuCauMuaHangMapper;

    private YeuCauMuaHangService service;

    private final Kho khoTong = Kho.builder().id(1).maKho("KHO01").tenKho("Kho tổng").build();
    private final Kho khoCuaHang = Kho.builder().id(2).maKho("CH01").tenKho("Cửa hàng 1").build();
    private final NguoiDung nguoiDuyet = NguoiDung.builder().id(7).hoTen("Quản lý A").build();

    @BeforeEach
    void setUp() {
        service = new YeuCauMuaHangService(repository);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "nguoiDungService", nguoiDungService);
        ReflectionTestUtils.setField(service, "khoService", khoService);
        ReflectionTestUtils.setField(service, "bienTheSanPhamService", bienTheSanPhamService);
        ReflectionTestUtils.setField(service, "chiTietYeuCauMuaHangService", chiTietYeuCauMuaHangService);
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
        ReflectionTestUtils.setField(service, "lichSuThayDoiRepository", lichSuThayDoiRepository);
        ReflectionTestUtils.setField(service, "yeuCauMuaHangMapper", yeuCauMuaHangMapper);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private static NguoiDungAuthInfo nguoiDung(int id, String vaiTro, Integer... khoIds) {
        List<PhanQuyenNguoiDungKhoDto> phanQuyen = java.util.Arrays.stream(khoIds)
                .map(khoId -> PhanQuyenNguoiDungKhoDto.builder()
                        .kho(KhoDto.builder().id(khoId).build())
                        .trangThai(1)
                        .build())
                .toList();
        return NguoiDungAuthInfo.builder()
                .id(id)
                .vaiTro(Set.of(vaiTro))
                .phanQuyenNguoiDungKhos(phanQuyen)
                .build();
    }

    private YeuCauMuaHang yeuCauChoDuyet(Kho kho) {
        YeuCauMuaHang yc = YeuCauMuaHang.builder()
                .id(12)
                .soYeuCauMuaHang("PR202610010012")
                .khoNhap(kho)
                .trangThai(YeuCauMuaHangService.TRANG_THAI_CHO_DUYET)
                .ngayTao(Instant.parse("2026-10-01T03:00:00Z"))
                .build();
        when(entityManager.find(YeuCauMuaHang.class, 12, LockModeType.PESSIMISTIC_WRITE)).thenReturn(yc);
        return yc;
    }

    private void choPhepLuu() {
        when(repository.save(any(YeuCauMuaHang.class))).thenAnswer(inv -> inv.getArgument(0));
        when(nguoiDungService.getOne(7)).thenReturn(Optional.of(nguoiDuyet));
    }

    private LichSuThayDoi lichSuDaGhi() {
        ArgumentCaptor<LichSuThayDoi> captor = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService).create(captor.capture());
        return captor.getValue();
    }

    // ── mã phiếu ──────────────────────────────────────────────────────────

    @Test
    void taoMaYeuCau_theoNgayGioVietNam_vaIdDuBonChuSo() {
        // 17:30 UTC ngày 07 = 00:30 ngày 08 giờ Việt Nam
        assertEquals("PR202610080012", YeuCauMuaHangService.taoMaYeuCau(12, Instant.parse("2026-10-07T17:30:00Z")));
        assertEquals("PR2026100812345", YeuCauMuaHangService.taoMaYeuCau(12345, Instant.parse("2026-10-08T01:00:00Z")));
    }

    @Test
    void create_sinhMaPhieu_vaLuuGhiChu() {
        SecurityContextHolder.setUser(nguoiDung(3, "nhan_vien_kho", 1));
        when(khoService.getOne(1)).thenReturn(Optional.of(khoTong));
        when(nguoiDungService.getOne(3)).thenReturn(Optional.of(NguoiDung.builder().id(3).build()));
        when(bienTheSanPhamService.getOne(5)).thenReturn(Optional.of(BienTheSanPham.builder().id(5).build()));
        when(chiTietYeuCauMuaHangService.create(anyList())).thenAnswer(inv -> inv.getArgument(0));
        when(repository.save(any(YeuCauMuaHang.class))).thenAnswer(inv -> {
            YeuCauMuaHang yc = inv.getArgument(0);
            if (yc.getId() == null) yc.setId(12);
            return yc;
        });

        service.create(YeuCauMuaHangCreating.builder()
                .khoNhapId(1)
                .ghiChu("  Ưu tiên nhập trước 20/10  ")
                .chiTietYeuCauMuaHangs(List.of(ChiTietYeuCauMuaHangCreating.builder()
                        .bienTheSanPhamId(5).soLuongDat(BigDecimal.TEN).build()))
                .build());

        ArgumentCaptor<YeuCauMuaHang> captor = ArgumentCaptor.forClass(YeuCauMuaHang.class);
        verify(repository, atLeastOnce()).save(captor.capture());
        YeuCauMuaHang saved = captor.getValue();
        assertEquals("Ưu tiên nhập trước 20/10", saved.getGhiChu());
        assertNotNull(saved.getSoYeuCauMuaHang());
        assertTrue(saved.getSoYeuCauMuaHang().matches("PR\\d{8}0012"), saved.getSoYeuCauMuaHang());
        assertEquals(YeuCauMuaHangService.TRANG_THAI_CHO_DUYET, saved.getTrangThai());
    }

    @Test
    void create_chanSoLuongKhongDuong() {
        SecurityContextHolder.setUser(nguoiDung(3, "nhan_vien_kho", 1));
        when(khoService.getOne(1)).thenReturn(Optional.of(khoTong));
        when(nguoiDungService.getOne(3)).thenReturn(Optional.of(NguoiDung.builder().id(3).build()));

        CommonException ex = assertThrows(CommonException.class, () -> service.create(YeuCauMuaHangCreating.builder()
                .khoNhapId(1)
                .chiTietYeuCauMuaHangs(List.of(ChiTietYeuCauMuaHangCreating.builder()
                        .bienTheSanPhamId(5).soLuongDat(BigDecimal.ZERO).build()))
                .build()));
        assertEquals("Số lượng yêu cầu phải lớn hơn 0", ex.getMessage());
        verify(repository, never()).save(any());
    }

    // ── duyệt / từ chối ───────────────────────────────────────────────────

    @Test
    void duyet_quanTriVien_luuNguoiDuyet_vaGhiLichSu() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_tri_vien"));
        YeuCauMuaHang yc = yeuCauChoDuyet(khoTong);
        choPhepLuu();

        service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_DA_DUYET, null);

        assertEquals(YeuCauMuaHangService.TRANG_THAI_DA_DUYET, yc.getTrangThai());
        assertSame(nguoiDuyet, yc.getNguoiDuyet());
        LichSuThayDoi ls = lichSuDaGhi();
        assertEquals(IHanhDong.duyet_yeu_cau_mua_hang, ls.getHanhDong());
        assertEquals(YeuCauMuaHangService.LOAI_THAM_CHIEU, ls.getLoaiThamChieu());
        assertEquals(12, ls.getIdThamChieu());
        assertEquals("1", ls.getGiaTriCu());
        assertEquals("2", ls.getGiaTriMoi());
        assertNull(ls.getGhiChu());
    }

    @Test
    void tuChoi_batBuocLyDo() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_tri_vien"));
        YeuCauMuaHang yc = yeuCauChoDuyet(khoTong);

        CommonException ex = assertThrows(CommonException.class,
                () -> service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_TU_CHOI, "   "));
        assertEquals("Vui lòng nhập lý do từ chối", ex.getMessage());
        assertEquals(YeuCauMuaHangService.TRANG_THAI_CHO_DUYET, yc.getTrangThai());
        verify(repository, never()).save(any());
        verifyNoInteractions(lichSuThayDoiService);
    }

    @Test
    void tuChoi_lyDoQuaDai() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_tri_vien"));
        yeuCauChoDuyet(khoTong);
        assertThrows(CommonException.class,
                () -> service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_TU_CHOI, "x".repeat(501)));
    }

    @Test
    void tuChoi_coLyDo_luuTrangThai4_vaLyDoVaoLichSu() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_tri_vien"));
        YeuCauMuaHang yc = yeuCauChoDuyet(khoTong);
        choPhepLuu();

        service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_TU_CHOI, "  Tồn kho còn đủ  ");

        assertEquals(YeuCauMuaHangService.TRANG_THAI_TU_CHOI, yc.getTrangThai());
        assertSame(nguoiDuyet, yc.getNguoiDuyet());
        LichSuThayDoi ls = lichSuDaGhi();
        assertEquals(IHanhDong.tu_choi_yeu_cau_mua_hang, ls.getHanhDong());
        assertEquals("Tồn kho còn đủ", ls.getGhiChu());
        assertEquals("4", ls.getGiaTriMoi());
    }

    @Test
    void trangThaiKhongHopLe_biChan() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_tri_vien"));
        for (Integer trangThai : new Integer[]{null, 0, 1, 3, 5}) {
            assertThrows(CommonException.class, () -> service.duyetTuChoi(12, trangThai, "lý do"),
                    "trạng thái " + trangThai + " phải bị chặn");
        }
        verifyNoInteractions(repository, lichSuThayDoiService);
    }

    @Test
    void khongDuyetLai_yeuCauKhongConChoDuyet() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_tri_vien"));
        YeuCauMuaHang yc = yeuCauChoDuyet(khoTong);
        yc.setTrangThai(YeuCauMuaHangService.TRANG_THAI_TU_CHOI);

        CommonException ex = assertThrows(CommonException.class,
                () -> service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_DA_DUYET, null));
        assertTrue(ex.getMessage().contains("Chờ duyệt"));
        assertEquals(YeuCauMuaHangService.TRANG_THAI_TU_CHOI, yc.getTrangThai());
        verify(repository, never()).save(any());
    }

    @Test
    void quanLyKho_khacKho_biTuChoiQuyen() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_ly_kho", 2));
        yeuCauChoDuyet(khoTong);

        assertThrows(AccessDeniedException.class,
                () -> service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_DA_DUYET, null));
        verify(repository, never()).save(any());
    }

    @Test
    void quanLyKho_dungKhoDuocPhanQuyen_duocDuyet() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_ly_kho", 2, 1));
        YeuCauMuaHang yc = yeuCauChoDuyet(khoTong);
        choPhepLuu();

        service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_DA_DUYET, null);
        assertEquals(YeuCauMuaHangService.TRANG_THAI_DA_DUYET, yc.getTrangThai());
    }

    @Test
    void quanLyKho_laQuanLyGhiTrenKho_duocDuyet() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_ly_kho"));
        Kho kho = Kho.builder().id(2).tenKho("Cửa hàng 1").quanLy(NguoiDung.builder().id(7).build()).build();
        YeuCauMuaHang yc = yeuCauChoDuyet(kho);
        choPhepLuu();

        service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_DA_DUYET, null);
        assertEquals(YeuCauMuaHangService.TRANG_THAI_DA_DUYET, yc.getTrangThai());
    }

    @Test
    void nhanVienKho_khongDuocDuyet() {
        SecurityContextHolder.setUser(nguoiDung(9, "nhan_vien_kho", 1));
        yeuCauChoDuyet(khoTong);
        assertThrows(AccessDeniedException.class,
                () -> service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_DA_DUYET, null));
    }

    @Test
    void duyet_yeuCauCuChuaCoMa_duocBoSungMa() {
        SecurityContextHolder.setUser(nguoiDung(7, "quan_tri_vien"));
        YeuCauMuaHang yc = yeuCauChoDuyet(khoCuaHang);
        yc.setSoYeuCauMuaHang(null);
        choPhepLuu();

        service.duyetTuChoi(12, YeuCauMuaHangService.TRANG_THAI_DA_DUYET, null);
        assertEquals("PR202610010012", yc.getSoYeuCauMuaHang());
    }

    // ── đọc lý do từ chối ─────────────────────────────────────────────────

    @Test
    void boSungThongTinDuyet_tuChoi_traLyDoVaNgay() {
        Instant luc = Instant.parse("2026-10-02T02:00:00Z");
        when(lichSuThayDoiRepository.findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                eq(YeuCauMuaHangService.LOAI_THAM_CHIEU), eq(12), anyList()))
                .thenReturn(Optional.of(LichSuThayDoi.builder()
                        .hanhDong(IHanhDong.tu_choi_yeu_cau_mua_hang).ghiChu("Tồn kho còn đủ").ngayThucHien(luc).build()));

        YeuCauMuaHangDto dto = service.boSungThongTinDuyet(YeuCauMuaHangDto.builder().id(12).build());
        assertEquals("Tồn kho còn đủ", dto.getLyDoTuChoi());
        assertEquals(luc, dto.getNgayDuyet());
    }

    @Test
    void boSungThongTinDuyet_duyet_khongCoLyDo() {
        when(lichSuThayDoiRepository.findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                any(), any(), anyList()))
                .thenReturn(Optional.of(LichSuThayDoi.builder()
                        .hanhDong(IHanhDong.duyet_yeu_cau_mua_hang).ngayThucHien(Instant.now()).build()));

        YeuCauMuaHangDto dto = service.boSungThongTinDuyet(YeuCauMuaHangDto.builder().id(12).build());
        assertNull(dto.getLyDoTuChoi());
        assertNotNull(dto.getNgayDuyet());
    }

    @Test
    void tenPhuongThucRepository_hopLeVoiSpringData() {
        // Spring Data dựng truy vấn từ tên phương thức lúc khởi động — tên sai là app không chạy
        assertDoesNotThrow(() -> new PartTree(
                "findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc",
                LichSuThayDoi.class));
    }

    private static <T> T eq(T value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }
}
