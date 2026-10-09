package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.PickLoHangRequest;
import com.dev.backend.dto.response.entities.ChiTietPhieuNhapKhoResponse;
import com.dev.backend.dto.response.entities.ChiTietPhieuXuatKhoDto;
import com.dev.backend.entities.*;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

/**
 * Danh sách sản phẩm trong chi tiết phiếu xuất (GET /api/v1/phieu-xuat-kho/{id}).
 * Dòng gốc (lo_hang null) là nguồn chính; biến thể chỉ có dòng đã pick (phiếu POS)
 * được gộp thành 1 dòng hiển thị, và dòng đó không dùng được để pick lô.
 */
@ExtendWith(MockitoExtension.class)
class PhieuXuatKhoServiceDetailTest {

    private static final int PHIEU_ID = 10;

    @Mock
    private PhieuXuatKhoRepository repository;
    @Mock
    private ChiTietPhieuXuatKhoRepository chiTietRepo;

    private PhieuXuatKhoService service;

    @BeforeEach
    void setUp() {
        service = new PhieuXuatKhoService(repository);
        ReflectionTestUtils.setField(service, "chiTietPhieuXuatKhoRepository", chiTietRepo);
    }

    // ── Dữ liệu mẫu ──

    private PhieuXuatKho phieu(String loaiXuat, int trangThai) {
        return PhieuXuatKho.builder()
                .id(PHIEU_ID).soPhieuXuat("PX-TEST").loaiXuat(loaiXuat)
                .trangThai(trangThai).ngayTao(Instant.now())
                .build();
    }

    private BienTheSanPham bienThe(int id, String sku) {
        return BienTheSanPham.builder()
                .id(id).maSku(sku)
                .sanPham(SanPhamQuanAo.builder().tenSanPham("Áo " + sku).build())
                .mauSac(MauSac.builder().tenMau("Đen").build())
                .build();
    }

    private ChiTietPhieuXuatKho dongGoc(int id, PhieuXuatKho p, BienTheSanPham bt, String sl) {
        return ChiTietPhieuXuatKho.builder()
                .id(id).phieuXuatKho(p).bienTheSanPham(bt).soLuongXuat(new BigDecimal(sl))
                .build();
    }

    private ChiTietPhieuXuatKho dongPick(int id, PhieuXuatKho p, BienTheSanPham bt, int loId, String sl) {
        return ChiTietPhieuXuatKho.builder()
                .id(id).phieuXuatKho(p).bienTheSanPham(bt)
                .loHang(LoHang.builder().id(loId).maLo("LO-" + loId).bienTheSanPham(bt).build())
                .soLuongXuat(new BigDecimal(sl))
                .build();
    }

    private List<ChiTietPhieuXuatKhoDto> chiTiet(PhieuXuatKho p,
                                                List<ChiTietPhieuXuatKho> goc,
                                                List<ChiTietPhieuXuatKho> picks) {
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(chiTietRepo.findByPhieuXuatKhoIdAndLoHangIsNull(PHIEU_ID)).thenReturn(goc);
        when(chiTietRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PHIEU_ID)).thenReturn(picks);
        ChiTietPhieuNhapKhoResponse res = service.getDetail(PHIEU_ID);
        return res.getChiTiet();
    }

    private static void assertQty(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    // ── KB1–2: phiếu bán hàng thường (có dòng gốc) — giữ nguyên hành vi cũ ──

    @Test
    void kb1_phieuBanHangNhap_chuaPick_hienDongGoc() {
        PhieuXuatKho p = phieu("ban_hang", 0);
        BienTheSanPham a = bienThe(1, "SKU-A");
        when(chiTietRepo.sumSoLuongDaPick(PHIEU_ID, 1)).thenReturn(BigDecimal.ZERO);

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p, List.of(dongGoc(100, p, a, "5")), List.of());

        assertEquals(1, rows.size());
        assertEquals(100, rows.get(0).getId());
        assertQty("5", rows.get(0).getSoLuongCanXuat());
        assertQty("0", rows.get(0).getSoLuongDaPick());
        assertFalse(rows.get(0).getDuSoLuong());
    }

    @Test
    void kb2_phieuBanHangDaPickDu_khongNhanDoiDongTheoLo() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");
        when(chiTietRepo.sumSoLuongDaPick(PHIEU_ID, 1)).thenReturn(new BigDecimal("5"));

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p,
                List.of(dongGoc(100, p, a, "5")),
                List.of(dongPick(101, p, a, 7, "3"), dongPick(102, p, a, 8, "2")));

        assertEquals(1, rows.size(), "dòng pick của biến thể đã có dòng gốc không được hiện thêm");
        assertEquals(100, rows.get(0).getId(), "vẫn trỏ về dòng gốc để Pick lot hoạt động");
        assertQty("5", rows.get(0).getSoLuongDaPick());
        assertTrue(rows.get(0).getDuSoLuong());
    }

    // ── KB3–5: phiếu POS (chỉ có dòng theo lô) — trước đây trả về rỗng ──

    @Test
    void kb3_phieuPos_motBienTheMotLo() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p, List.of(), List.of(dongPick(200, p, a, 7, "2")));

        assertEquals(1, rows.size());
        ChiTietPhieuXuatKhoDto r = rows.get(0);
        assertEquals(200, r.getId());
        assertEquals(1, r.getBienTheSanPhamId());
        assertEquals("SKU-A", r.getSku());
        assertEquals("Áo SKU-A / Đen", r.getTenBienThe());
        assertQty("2", r.getSoLuongCanXuat());
        assertQty("2", r.getSoLuongDaPick());
        assertTrue(r.getDuSoLuong());
        verify(chiTietRepo, never()).sumSoLuongDaPick(anyInt(), anyInt());
    }

    @Test
    void kb4_phieuPos_motBienTheTachNhieuLo_gopThanhMotDong() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");

        // Thứ tự trả về từ DB không đảm bảo — id nhỏ nhất phải được chọn
        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p, List.of(),
                List.of(dongPick(202, p, a, 8, "1"), dongPick(201, p, a, 7, "3")));

        assertEquals(1, rows.size());
        assertEquals(201, rows.get(0).getId());
        assertQty("4", rows.get(0).getSoLuongCanXuat());
        assertQty("4", rows.get(0).getSoLuongDaPick());
    }

    @Test
    void kb5_phieuPos_nhieuBienThe_thuTuTheoDongDauTien() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");
        BienTheSanPham b = bienThe(2, "SKU-B");

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p, List.of(), List.of(
                dongPick(303, p, a, 9, "1"),
                dongPick(301, p, b, 7, "2"),
                dongPick(302, p, a, 8, "1.5")));

        assertEquals(2, rows.size());
        assertEquals("SKU-B", rows.get(0).getSku());
        assertEquals(301, rows.get(0).getId());
        assertQty("2", rows.get(0).getSoLuongCanXuat());
        assertEquals("SKU-A", rows.get(1).getSku());
        assertEquals(302, rows.get(1).getId());
        assertQty("2.5", rows.get(1).getSoLuongCanXuat());
    }

    // ── KB6: dữ liệu lẫn (có gốc cho A, chỉ có pick cho B) — không được giấu B ──

    @Test
    void kb6_phieuTron_dongGocTruoc_bienTheMoCoiSau() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");
        BienTheSanPham b = bienThe(2, "SKU-B");
        when(chiTietRepo.sumSoLuongDaPick(PHIEU_ID, 1)).thenReturn(new BigDecimal("5"));

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p,
                List.of(dongGoc(100, p, a, "5")),
                List.of(dongPick(101, p, a, 7, "5"), dongPick(102, p, b, 8, "1")));

        assertEquals(2, rows.size());
        assertEquals(100, rows.get(0).getId());
        assertEquals(102, rows.get(1).getId());
        assertQty("1", rows.get(1).getSoLuongCanXuat());
    }

    // ── KB7: phiếu không có dòng nào ──

    @Test
    void kb7_phieuRong_traVeDanhSachRong() {
        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(phieu("ban_hang", 0), List.of(), List.of());
        assertTrue(rows.isEmpty());
    }

    // ── KB8–9: dòng gộp không được dùng để pick lô ──

    @Test
    void kb8_pickLoTrenPhieuPosDaXuat_biChan() {
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(phieu("ban_hang", 3)));
        PickLoHangRequest req = PickLoHangRequest.builder()
                .chiTietPhieuXuatKhoId(200).loHangPicks(List.of()).build();

        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.pickLoHang(PHIEU_ID, req));
        assertTrue(ex.getMessage().contains("trạng thái Mới tạo"));
        verify(chiTietRepo, never()).deletePickedByPhieuAndBienThe(anyInt(), anyInt());
    }

    @Test
    void kb9_pickLoBangIdDongTheoLo_trenPhieuNhap_biChan() {
        PhieuXuatKho p = phieu("ban_hang", 0);
        BienTheSanPham a = bienThe(1, "SKU-A");
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(chiTietRepo.findById(200)).thenReturn(Optional.of(dongPick(200, p, a, 7, "2")));
        PickLoHangRequest req = PickLoHangRequest.builder()
                .chiTietPhieuXuatKhoId(200).loHangPicks(List.of()).build();

        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.pickLoHang(PHIEU_ID, req));
        assertTrue(ex.getMessage().contains("dòng sản phẩm gốc"));
        verify(chiTietRepo, never()).deletePickedByPhieuAndBienThe(anyInt(), anyInt());
    }

    // ── KB10: "Xem lô" / in phiếu dùng id dòng gộp → tra lô theo đúng biến thể ──

    @Test
    void kb10_xemLoBangIdDongGop_traTheoBienThe() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");
        when(chiTietRepo.findById(201)).thenReturn(Optional.of(dongPick(201, p, a, 7, "3")));

        service.getPickedLots(PHIEU_ID, 201);

        verify(chiTietRepo).findPickedLots(PHIEU_ID, 1);
    }
}
