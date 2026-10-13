package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.response.customize.PosCatalogItemDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test PosCatalogService (Phase 02 — chỉ đọc):
 * - Quyền kho server-side: admin bỏ qua; nhân viên phải có phân quyền active + chưa hết hạn.
 * - Tham số phân trang/search được chuẩn hóa (size clamp, q blank -> null).
 * - Ảnh: anh_bien_the ưu tiên -> fallback anh_quan_ao (ảnh chính trước) -> null; URL qua PublicAssetUrl.
 */
@ExtendWith(MockitoExtension.class)
class PosCatalogServiceTest {

    @Mock
    private EntityManager entityManager;
    @Mock
    private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock
    private AnhBienTheRepository anhBienTheRepository;
    @Mock
    private AnhQuanAoRepository anhQuanAoRepository;
    @Mock
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;

    private PosCatalogService service;

    @BeforeEach
    void setUp() {
        service = new PosCatalogService();
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "bienTheSanPhamRepository", bienTheSanPhamRepository);
        ReflectionTestUtils.setField(service, "anhBienTheRepository", anhBienTheRepository);
        ReflectionTestUtils.setField(service, "anhQuanAoRepository", anhQuanAoRepository);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungKhoRepository", phanQuyenNguoiDungKhoRepository);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private void setUser(boolean admin) {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder()
                .id(7)
                .vaiTro(admin ? Set.of("quan_tri_vien") : Set.of("nhan_vien_ban_hang"))
                .build());
    }

    private Kho kho(Integer id) {
        return Kho.builder().id(id).tenKho("Kho " + id).maKho("KHO0" + id).build();
    }

    private PosCatalogItemDto item(Integer variantId, Integer productId) {
        return new PosCatalogItemDto(
                variantId, productId, "Áo test", "AK0001", null,
                "Đỏ", "#ff0000", "M", "Cotton",
                new BigDecimal("120000"), new BigDecimal("5"), 28, "Áo khoác");
    }

    private AnhBienThe variantImage(Integer variantId, String duongDan) {
        return AnhBienThe.builder()
                .bienThe(BienTheSanPham.builder().id(variantId).build())
                .tepTin(TepTin.builder().duongDan(duongDan).build())
                .trangThai(1)
                .build();
    }

    private AnhQuanAo productImage(Integer productId, int anhChinh, String duongDan) {
        return AnhQuanAo.builder()
                .quanAo(SanPhamQuanAo.builder().id(productId).build())
                .tepTin(TepTin.builder().duongDan(duongDan).build())
                .anhChinh(anhChinh)
                .trangThai(1)
                .build();
    }

    // ===== Quyền kho =====

    @Test
    void getCatalog_admin_khongCanPhanQuyenKho() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalog(eq(1), any(), any())).thenReturn(Page.empty());

        service.getCatalog(1, "áo", 0, 120);

        verify(phanQuyenNguoiDungKhoRepository, never()).findByNguoiDungIdAndKhoId(anyInt(), anyInt());
        verify(bienTheSanPhamRepository).findPosCatalog(eq(1), eq("áo"), any());
    }

    @Test
    void getCatalog_khoKhongTonTai_loi() {
        setUser(true);
        when(entityManager.find(Kho.class, 99)).thenReturn(null);

        CommonException ex = assertThrows(CommonException.class, () -> service.getCatalog(99, null, 0, 120));
        assertTrue(ex.getMessage().contains("không tồn tại"));
    }

    @Test
    void getCatalog_thieuKhoId_loi() {
        setUser(true);
        CommonException ex = assertThrows(CommonException.class, () -> service.getCatalog(null, null, 0, 120));
        assertTrue(ex.getMessage().contains("chọn kho"));
    }

    @Test
    void getCatalog_nhanVien_khongDuocPhanQuyenKho_loi() {
        setUser(false);
        when(entityManager.find(Kho.class, 2)).thenReturn(kho(2));
        when(phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndKhoId(7, 2)).thenReturn(java.util.Optional.empty());

        CommonException ex = assertThrows(CommonException.class, () -> service.getCatalog(2, null, 0, 120));
        assertTrue(ex.getMessage().contains("không phụ trách kho"));
        verify(bienTheSanPhamRepository, never()).findPosCatalog(anyInt(), any(), any());
    }

    @Test
    void getCatalog_nhanVien_quyenHetHan_loi() {
        setUser(false);
        when(entityManager.find(Kho.class, 2)).thenReturn(kho(2));
        PhanQuyenNguoiDungKho pq = PhanQuyenNguoiDungKho.builder()
                .nguoiDung(NguoiDung.builder().id(7).build())
                .kho(kho(2))
                .trangThai(1)
                .ngayKetThuc(Instant.now().minusSeconds(60))
                .build();
        when(phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndKhoId(7, 2)).thenReturn(java.util.Optional.of(pq));

        CommonException ex = assertThrows(CommonException.class, () -> service.getCatalog(2, null, 0, 120));
        assertTrue(ex.getMessage().contains("hết hạn"));
    }

    @Test
    void getCatalog_nhanVien_duocPhanQuyenActive_thanhCong() {
        setUser(false);
        when(entityManager.find(Kho.class, 2)).thenReturn(kho(2));
        PhanQuyenNguoiDungKho pq = PhanQuyenNguoiDungKho.builder()
                .nguoiDung(NguoiDung.builder().id(7).build())
                .kho(kho(2))
                .trangThai(1)
                .ngayKetThuc(null)
                .build();
        when(phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndKhoId(7, 2)).thenReturn(java.util.Optional.of(pq));
        when(bienTheSanPhamRepository.findPosCatalog(eq(2), any(), any())).thenReturn(Page.empty());

        service.getCatalog(2, null, 0, 120);

        verify(bienTheSanPhamRepository).findPosCatalog(eq(2), isNull(), any());
    }

    // ===== Chuẩn hóa tham số =====

    @Test
    void getCatalog_sizeLonHon120_biClamp() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalog(eq(1), any(), any())).thenReturn(Page.empty());

        service.getCatalog(1, null, 0, 999);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(bienTheSanPhamRepository).findPosCatalog(eq(1), isNull(), captor.capture());
        assertEquals(120, captor.getValue().getPageSize());
    }

    @Test
    void getCatalog_qTrang_thanhNull() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalog(eq(1), any(), any())).thenReturn(Page.empty());

        service.getCatalog(1, "   ", 0, 120);

        verify(bienTheSanPhamRepository).findPosCatalog(eq(1), isNull(), any());
    }

    // ===== Ảnh =====

    @Test
    void getCatalog_anhBienThe_duocUuTien() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        PosCatalogItemDto item = item(93, 59);
        when(bienTheSanPhamRepository.findPosCatalog(eq(1), any(), any()))
                .thenReturn(new PageImpl<>(List.of(item)));
        when(anhBienTheRepository.findActiveByBienTheIds(List.of(93)))
                .thenReturn(List.of(variantImage(93, "http://171.244.142.43:9000/fashion/variant-93.png")));
        when(anhQuanAoRepository.findActiveByQuanAoIds(List.of(59)))
                .thenReturn(List.of(productImage(59, 1, "http://171.244.142.43:9000/fashion/product-59.png")));

        Page<PosCatalogItemDto> result = service.getCatalog(1, null, 0, 120);

        assertEquals("https://minio.slmglobal.vn/fashion/variant-93.png", result.getContent().get(0).getAnhUrl());
    }

    @Test
    void getCatalog_khongCoAnhBienThe_fallbackAnhSanPhamAnhChinh() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        PosCatalogItemDto item = item(93, 59);
        when(bienTheSanPhamRepository.findPosCatalog(eq(1), any(), any()))
                .thenReturn(new PageImpl<>(List.of(item)));
        when(anhBienTheRepository.findActiveByBienTheIds(List.of(93))).thenReturn(List.of());
        // Query đã sort anhChinh DESC: ảnh chính gặp trước (putIfAbsent giữ nó)
        when(anhQuanAoRepository.findActiveByQuanAoIds(List.of(59)))
                .thenReturn(List.of(
                        productImage(59, 1, "http://171.244.142.43:9000/fashion/main.png"),
                        productImage(59, 0, "http://171.244.142.43:9000/fashion/secondary.png")));

        Page<PosCatalogItemDto> result = service.getCatalog(1, null, 0, 120);

        assertEquals("https://minio.slmglobal.vn/fashion/main.png", result.getContent().get(0).getAnhUrl());
    }

    @Test
    void getCatalog_khongCoAnhNao_anhUrlNull() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        PosCatalogItemDto item = item(93, 59);
        when(bienTheSanPhamRepository.findPosCatalog(eq(1), any(), any()))
                .thenReturn(new PageImpl<>(List.of(item)));
        when(anhBienTheRepository.findActiveByBienTheIds(List.of(93))).thenReturn(List.of());
        when(anhQuanAoRepository.findActiveByQuanAoIds(List.of(59))).thenReturn(List.of());

        Page<PosCatalogItemDto> result = service.getCatalog(1, null, 0, 120);

        assertNull(result.getContent().get(0).getAnhUrl());
    }

    // ===== Lookup =====

    @Test
    void lookup_skuPrefix_traKetQuaDauTienServer() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        PosCatalogItemDto first = item(93, 59);
        when(bienTheSanPhamRepository.findPosCatalogBySkuPrefix(eq(1), eq("AK0001"), any()))
                .thenReturn(new PageImpl<>(List.of(first)));

        List<PosCatalogItemDto> result = service.lookup(1, "AK0001", null);

        assertEquals(1, result.size());
        assertEquals(93, result.get(0).getBienTheSanPhamId());
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(bienTheSanPhamRepository).findPosCatalogBySkuPrefix(eq(1), eq("AK0001"), captor.capture());
        assertEquals(1, captor.getValue().getPageSize());
    }

    @Test
    void lookup_barcode_traDanhSachChinhXac() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalogByBarcode(eq(1), eq("VACH01"), any()))
                .thenReturn(new PageImpl<>(List.of(item(93, 59), item(94, 59))));

        List<PosCatalogItemDto> result = service.lookup(1, null, "VACH01");

        assertEquals(2, result.size());
    }

    @Test
    void lookup_thieuCaHaiThamSo_loi() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));

        assertThrows(CommonException.class, () -> service.lookup(1, null, null));
    }
}
