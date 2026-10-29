package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.PosCatalogBienTheDto;
import com.dev.backend.dto.PosCatalogNhomDto;
import com.dev.backend.dto.response.customize.PosCatalogItemDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.services.impl.multitable.BanDuocTaiQuayService;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test PosCatalogService (Phase 02 — chỉ đọc):
 * - Quyền kho server-side: admin bỏ qua; nhân viên phải có phân quyền active + chưa hết hạn.
 * - Tham số phân trang/search được chuẩn hóa (size clamp, q blank -> null).
 * - Ảnh: anh_bien_the ưu tiên -> fallback anh_quan_ao (ảnh chính trước) -> null; URL qua PublicAssetUrl.
 * - Số bán được: mã đang bị giữ dùng số BanDuocTaiQuayService tính lại (danh mục gộp TRƯỚC khi lọc / phân trang,
 *   tra tồn giỏ, tra cứu mã); mock không cấu hình trả map rỗng = mọi mã giữ số SQL.
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
    @Mock
    private BanDuocTaiQuayService banDuocTaiQuayService;

    private PosCatalogService service;

    @BeforeEach
    void setUp() {
        service = new PosCatalogService();
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "bienTheSanPhamRepository", bienTheSanPhamRepository);
        ReflectionTestUtils.setField(service, "anhBienTheRepository", anhBienTheRepository);
        ReflectionTestUtils.setField(service, "anhQuanAoRepository", anhQuanAoRepository);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungKhoRepository", phanQuyenNguoiDungKhoRepository);
        ReflectionTestUtils.setField(service, "banDuocTaiQuayService", banDuocTaiQuayService);
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
        // Kho bán hàng đang hoạt động — POS chặn kho ngừng hoạt động, kho ảo và Kho tổng (KhoService.kiemTraKhoBanTaiQuay)
        return Kho.builder().id(id).tenKho("Kho " + id).maKho("KHO0" + id).loaiKho("cua_hang").trangThai(1).build();
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

    private PosCatalogBienTheDto bienThe(Integer variantId, Integer productId, Integer mauSacId, int thuTuSize, String ton) {
        return new PosCatalogBienTheDto(variantId, productId, "Áo " + productId, "SKU" + variantId, null,
                mauSacId, "Màu " + mauSacId, "#000000", "S" + thuTuSize, thuTuSize, 1, "Cotton",
                new BigDecimal("120000"), new BigDecimal(ton), 28, "Áo khoác");
    }

    // ===== Quyền kho =====

    @Test
    void getCatalogNhom_admin_khongCanPhanQuyenKho() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalogBienThe(eq(1), any())).thenReturn(List.of());

        service.getCatalogNhom(1, "áo", null, 0, 60);

        verify(phanQuyenNguoiDungKhoRepository, never()).findByNguoiDungIdAndKhoId(anyInt(), anyInt());
        verify(bienTheSanPhamRepository).findPosCatalogBienThe(eq(1), eq("áo"));
    }

    @Test
    void getCatalogNhom_khoKhongTonTai_loi() {
        setUser(true);
        when(entityManager.find(Kho.class, 99)).thenReturn(null);

        CommonException ex = assertThrows(CommonException.class, () -> service.getCatalogNhom(99, null, null, 0, 60));
        assertTrue(ex.getMessage().contains("không tồn tại"));
    }

    @Test
    void getCatalogNhom_thieuKhoId_loi() {
        setUser(true);
        CommonException ex = assertThrows(CommonException.class, () -> service.getCatalogNhom(null, null, null, 0, 60));
        assertTrue(ex.getMessage().contains("chọn kho"));
    }

    @Test
    void getCatalogNhom_nhanVien_khongDuocPhanQuyenKho_loi() {
        setUser(false);
        when(entityManager.find(Kho.class, 2)).thenReturn(kho(2));
        when(phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndKhoId(7, 2)).thenReturn(java.util.Optional.empty());

        CommonException ex = assertThrows(CommonException.class, () -> service.getCatalogNhom(2, null, null, 0, 60));
        assertTrue(ex.getMessage().contains("không phụ trách kho"));
        verify(bienTheSanPhamRepository, never()).findPosCatalogBienThe(anyInt(), any());
    }

    @Test
    void getCatalogNhom_nhanVien_quyenHetHan_loi() {
        setUser(false);
        when(entityManager.find(Kho.class, 2)).thenReturn(kho(2));
        PhanQuyenNguoiDungKho pq = PhanQuyenNguoiDungKho.builder()
                .nguoiDung(NguoiDung.builder().id(7).build())
                .kho(kho(2))
                .trangThai(1)
                .ngayKetThuc(Instant.now().minusSeconds(60))
                .build();
        when(phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndKhoId(7, 2)).thenReturn(java.util.Optional.of(pq));

        CommonException ex = assertThrows(CommonException.class, () -> service.getCatalogNhom(2, null, null, 0, 60));
        assertTrue(ex.getMessage().contains("hết hạn"));
    }

    @Test
    void getCatalogNhom_nhanVien_duocPhanQuyenActive_thanhCong() {
        setUser(false);
        when(entityManager.find(Kho.class, 2)).thenReturn(kho(2));
        PhanQuyenNguoiDungKho pq = PhanQuyenNguoiDungKho.builder()
                .nguoiDung(NguoiDung.builder().id(7).build())
                .kho(kho(2))
                .trangThai(1)
                .ngayKetThuc(null)
                .build();
        when(phanQuyenNguoiDungKhoRepository.findByNguoiDungIdAndKhoId(7, 2)).thenReturn(java.util.Optional.of(pq));
        when(bienTheSanPhamRepository.findPosCatalogBienThe(eq(2), any())).thenReturn(List.of());

        service.getCatalogNhom(2, null, null, 0, 60);

        verify(bienTheSanPhamRepository).findPosCatalogBienThe(eq(2), isNull());
    }

    // ===== Chuẩn hóa tham số =====

    @Test
    void getCatalogNhom_sizeLonHon120_biClamp() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalogBienThe(eq(1), any())).thenReturn(List.of());

        Page<PosCatalogNhomDto> result = service.getCatalogNhom(1, null, null, 0, 999);

        assertEquals(120, result.getSize());
    }

    @Test
    void getCatalogNhom_qTrang_thanhNull() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalogBienThe(eq(1), any())).thenReturn(List.of());

        service.getCatalogNhom(1, "   ", null, 0, 60);

        verify(bienTheSanPhamRepository).findPosCatalogBienThe(eq(1), isNull());
    }

    // ===== Ảnh (tra cứu mã) =====

    @Test
    void lookup_anhBienThe_duocUuTien() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        PosCatalogItemDto item = item(93, 59);
        when(bienTheSanPhamRepository.findPosCatalogByBarcode(eq(1), eq("VACH01"), any()))
                .thenReturn(new PageImpl<>(List.of(item)));
        when(anhBienTheRepository.findActiveByBienTheIds(List.of(93)))
                .thenReturn(List.of(variantImage(93, "http://171.244.142.43:9000/fashion/variant-93.png")));
        when(anhQuanAoRepository.findActiveByQuanAoIds(List.of(59)))
                .thenReturn(List.of(productImage(59, 1, "http://171.244.142.43:9000/fashion/product-59.png")));

        List<PosCatalogItemDto> result = service.lookup(1, null, "VACH01");

        assertEquals("https://minio.slmglobal.vn/fashion/variant-93.png", result.get(0).getAnhUrl());
    }

    @Test
    void lookup_khongCoAnhBienThe_fallbackAnhSanPhamAnhChinh() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        PosCatalogItemDto item = item(93, 59);
        when(bienTheSanPhamRepository.findPosCatalogByBarcode(eq(1), eq("VACH01"), any()))
                .thenReturn(new PageImpl<>(List.of(item)));
        when(anhBienTheRepository.findActiveByBienTheIds(List.of(93))).thenReturn(List.of());
        // Query đã sort anhChinh DESC: ảnh chính gặp trước (putIfAbsent giữ nó)
        when(anhQuanAoRepository.findActiveByQuanAoIds(List.of(59)))
                .thenReturn(List.of(
                        productImage(59, 1, "http://171.244.142.43:9000/fashion/main.png"),
                        productImage(59, 0, "http://171.244.142.43:9000/fashion/secondary.png")));

        List<PosCatalogItemDto> result = service.lookup(1, null, "VACH01");

        assertEquals("https://minio.slmglobal.vn/fashion/main.png", result.get(0).getAnhUrl());
    }

    @Test
    void lookup_khongCoAnhNao_anhUrlNull() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        PosCatalogItemDto item = item(93, 59);
        when(bienTheSanPhamRepository.findPosCatalogByBarcode(eq(1), eq("VACH01"), any()))
                .thenReturn(new PageImpl<>(List.of(item)));
        when(anhBienTheRepository.findActiveByBienTheIds(List.of(93))).thenReturn(List.of());
        when(anhQuanAoRepository.findActiveByQuanAoIds(List.of(59))).thenReturn(List.of());

        List<PosCatalogItemDto> result = service.lookup(1, null, "VACH01");

        assertNull(result.get(0).getAnhUrl());
    }

    // ===== Số bán được tại quầy (mã đang bị giữ tính lại theo lô) =====

    @Test
    void getCatalogNhom_maDangBiGiu_dungSoTinhLai_maKhacGiuSoSql() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalogBienThe(eq(1), isNull()))
                .thenReturn(List.of(bienThe(93, 59, 1, 1, "5"), bienThe(94, 59, 1, 2, "4")));
        // 93: phiếu nhặt / phiếu chuyển giữ 3 → bán được 2; 94 không bị giữ nên không có trong kết quả
        when(banDuocTaiQuayService.banDuocCuaMaDangGiu(eq(1), argThat(ids -> ids.containsAll(List.of(93, 94)))))
                .thenReturn(new HashMap<>(Map.of(93, new BigDecimal("2"))));

        Page<PosCatalogNhomDto> result = service.getCatalogNhom(1, null, null, 0, 60);

        PosCatalogNhomDto nhom = result.getContent().get(0);
        assertEquals(0, new BigDecimal("2").compareTo(nhom.getBienThes().get(0).getSoLuongKhaDung()));
        assertEquals(0, new BigDecimal("4").compareTo(nhom.getBienThes().get(1).getSoLuongKhaDung()));
        assertEquals(0, new BigDecimal("6").compareTo(nhom.getTongTonKhaDung()), "tổng nhóm cộng số đã tính lại");
    }

    @Test
    void getCatalogNhom_conHang_nhomBiGiuHet_biLoaiTruocKhiPhanTrang() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        // Nhóm 59-1 chỉ còn hàng theo SQL nhưng phiếu chuyển giữ hết; nhóm 60-2 còn hàng thật
        when(bienTheSanPhamRepository.findPosCatalogBienThe(eq(1), isNull()))
                .thenReturn(List.of(bienThe(93, 59, 1, 1, "3"), bienThe(95, 60, 2, 1, "1")));
        when(banDuocTaiQuayService.banDuocCuaMaDangGiu(eq(1), any()))
                .thenReturn(new HashMap<>(Map.of(93, BigDecimal.ZERO)));

        Page<PosCatalogNhomDto> conHang = service.getCatalogNhom(1, null, "con_hang", 0, 1);

        assertEquals(1, conHang.getTotalElements(), "nhóm bị giữ hết không còn được đếm vào Còn hàng");
        assertEquals(60, conHang.getContent().get(0).getSanPhamId());

        Page<PosCatalogNhomDto> hetHang = service.getCatalogNhom(1, null, "het_hang", 0, 60);
        assertEquals(1, hetHang.getTotalElements());
        assertEquals(59, hetHang.getContent().get(0).getSanPhamId());
    }

    @Test
    void getCatalogNhom_coTuKhoa_tinhLaiCaDanhSachKhopVaDanhSachDuKichCo() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalogBienThe(eq(1), eq("SKU93")))
                .thenReturn(List.of(bienThe(93, 59, 1, 1, "5")));
        when(bienTheSanPhamRepository.findPosCatalogBienTheTheoSanPham(eq(1), eq(List.of(59))))
                .thenReturn(List.of(bienThe(93, 59, 1, 1, "5"), bienThe(94, 59, 1, 2, "0")));
        when(banDuocTaiQuayService.banDuocCuaMaDangGiu(eq(1), any()))
                .thenReturn(new HashMap<>(Map.of(93, BigDecimal.ZERO)));

        Page<PosCatalogNhomDto> conHang = service.getCatalogNhom(1, "SKU93", "con_hang", 0, 60);

        assertEquals(0, conHang.getTotalElements(), "kích cỡ khớp từ khóa đã bị giữ hết, cỡ còn lại đã hết");
    }

    @Test
    void getAvailableStock_maDangBiGiu_dungSoTinhLai() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosAvailableStock(eq(1), eq(List.of(93, 94))))
                .thenReturn(List.of(new Object[]{93, new BigDecimal("5")}, new Object[]{94, new BigDecimal("4")}));
        when(banDuocTaiQuayService.banDuocCuaMaDangGiu(eq(1), argThat(ids -> ids.size() == 2 && ids.containsAll(List.of(93, 94)))))
                .thenReturn(new HashMap<>(Map.of(93, new BigDecimal("2"))));

        Map<Integer, BigDecimal> result = service.getAvailableStock(1, List.of(93, 94, 93));

        assertEquals(0, new BigDecimal("2").compareTo(result.get(93)));
        assertEquals(0, new BigDecimal("4").compareTo(result.get(94)));
        assertEquals(2, result.size());
    }

    @Test
    void lookup_maDangBiGiu_dungSoTinhLai() {
        setUser(true);
        when(entityManager.find(Kho.class, 1)).thenReturn(kho(1));
        when(bienTheSanPhamRepository.findPosCatalogByBarcode(eq(1), eq("VACH01"), any()))
                .thenReturn(new PageImpl<>(List.of(item(93, 59))));
        when(banDuocTaiQuayService.banDuocCuaMaDangGiu(1, List.of(93)))
                .thenReturn(new HashMap<>(Map.of(93, BigDecimal.ZERO)));

        List<PosCatalogItemDto> result = service.lookup(1, null, "VACH01");

        assertEquals(0, BigDecimal.ZERO.compareTo(result.get(0).getSoLuongKhaDung()));
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
