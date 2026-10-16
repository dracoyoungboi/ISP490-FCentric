package com.dev.backend.services.impl.multitable;

import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.LoHang;
import com.dev.backend.entities.TonKhoTheoLo;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.PhanBoLoNhatHangRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Còn lại theo biến thể ở một kho (cờ "Đủ hàng / Thiếu hàng" ở màn Đơn chờ xuất):
 * Σ theo lô max(0, tồn − so_luong_da_dat − phân bổ phiếu nhặt đang mở − dòng lô phiếu xuất bán chưa xuất).
 */
@ExtendWith(MockitoExtension.class)
class LoDangGiuServiceTest {

    private static final int KHO = 1;

    @Mock
    private PhanBoLoNhatHangRepository phanBoLoNhatHangRepository;
    @Mock
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @Mock
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;

    @InjectMocks
    private LoDangGiuService service;

    private static TonKhoTheoLo ton(int loId, int bienTheId, String soLuongTon, String daDat) {
        return TonKhoTheoLo.builder()
                .loHang(LoHang.builder().id(loId).bienTheSanPham(BienTheSanPham.builder().id(bienTheId).build()).build())
                .soLuongTon(new BigDecimal(soLuongTon))
                .soLuongDaDat(new BigDecimal(daDat))
                .build();
    }

    private static List<Object[]> dong(Object[]... rows) {
        return List.of(rows);
    }

    private static void assertQty(String expected, BigDecimal actual) {
        assertNotNull(actual);
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    @Test
    void truDaDat_phanBoPhieuNhat_vaDongLoPhieuXuatBan_theoTungBienThe() {
        when(tonKhoTheoLoRepository.findByKhoAndBienTheIds(KHO, Set.of(1, 2))).thenReturn(List.of(
                ton(11, 1, "3", "0"),   // phiếu nhặt đang mở giữ 3 → còn 0
                ton(12, 1, "2", "1"),   // đã đặt 1 (chuyển kho / POS payOS) → còn 1
                ton(21, 2, "5", "0"))); // phiếu xuất bán Chờ xuất giữ 2 → còn 3
        when(phanBoLoNhatHangRepository.sumDangGiuTheoLo(eq(KHO), anyCollection(), isNull()))
                .thenReturn(dong(new Object[]{11, new BigDecimal("3")}));
        when(chiTietPhieuXuatKhoRepository.sumDangGiuPhieuBanChuaXuat(eq(KHO), anyCollection(), isNull()))
                .thenReturn(dong(new Object[]{21, new BigDecimal("2")}));

        Map<Integer, BigDecimal> conLai = service.conLaiTheoBienThe(KHO, Set.of(1, 2));

        assertQty("1", conLai.get(1));
        assertQty("3", conLai.get(2));
    }

    @Test
    void loAm_tinh0_khongBuChoLoKhac() {
        when(tonKhoTheoLoRepository.findByKhoAndBienTheIds(KHO, List.of(1))).thenReturn(List.of(
                ton(11, 1, "2", "0"),
                ton(12, 1, "4", "0")));
        // Dữ liệu lệch: phân bổ lô 11 nhiều hơn tồn
        when(phanBoLoNhatHangRepository.sumDangGiuTheoLo(eq(KHO), anyCollection(), isNull()))
                .thenReturn(dong(new Object[]{11, new BigDecimal("5")}));
        when(chiTietPhieuXuatKhoRepository.sumDangGiuPhieuBanChuaXuat(eq(KHO), anyCollection(), isNull()))
                .thenReturn(List.of());

        Map<Integer, BigDecimal> conLai = service.conLaiTheoBienThe(KHO, List.of(1));

        assertQty("4", conLai.get(1));
    }

    @Test
    void khongTinhPhanDangGiuCuaKhoKhac_vaTruyDungKhoChoTruyVanGiu() {
        when(tonKhoTheoLoRepository.findByKhoAndBienTheIds(KHO, List.of(1))).thenReturn(List.of(ton(11, 1, "4", "0")));
        when(phanBoLoNhatHangRepository.sumDangGiuTheoLo(eq(KHO), eq(List.of(11)), isNull())).thenReturn(List.of());
        when(chiTietPhieuXuatKhoRepository.sumDangGiuPhieuBanChuaXuat(eq(KHO), eq(List.of(11)), isNull())).thenReturn(List.of());

        assertQty("4", service.conLaiTheoBienThe(KHO, List.of(1)).get(1));
    }

    @Test
    void bienTheKhongCoDongTon_khongCoTrongKetQua() {
        when(tonKhoTheoLoRepository.findByKhoAndBienTheIds(KHO, List.of(9))).thenReturn(List.of());

        Map<Integer, BigDecimal> conLai = service.conLaiTheoBienThe(KHO, List.of(9));

        assertTrue(conLai.isEmpty());
        verifyNoInteractions(phanBoLoNhatHangRepository, chiTietPhieuXuatKhoRepository);
    }

    @Test
    void thieuKhoHoacDanhSachRong_traRong_khongTruyVan() {
        assertTrue(service.conLaiTheoBienThe(null, List.of(1)).isEmpty());
        assertTrue(service.conLaiTheoBienThe(KHO, List.of()).isEmpty());
        assertTrue(service.conLaiTheoBienThe(KHO, null).isEmpty());
        verifyNoInteractions(tonKhoTheoLoRepository, phanBoLoNhatHangRepository, chiTietPhieuXuatKhoRepository);
    }
}
