package com.dev.backend.services.impl.multitable;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.services.impl.multitable.KhaDungChuyenKhoService.KhaDungChuyen;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Lượng có thể chuyển ở kho gửi = max(0, (tồn − đang giữ) − max(0, chờ xuất)), chờ xuất = đặt − đã xuất thật của đơn bán
 * đang giữ hàng có kho xuất là kho gửi. Dùng chung cho tạo yêu cầu chuyển kho và đề xuất bổ sung ở Tổng quan.
 */
@ExtendWith(MockitoExtension.class)
class KhaDungChuyenKhoServiceTest {

    private static final int KHO_TONG = 1;
    private static final int CUA_HANG = 2;
    private static final int MA_A = 93;
    private static final int MA_B = 94;

    @Mock
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock
    private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @Mock
    private GiuChoChuyenKhoService giuChoChuyenKhoService;

    @InjectMocks
    private KhaDungChuyenKhoService service;

    private static Object[] dong(Object... cot) {
        return cot;
    }

    private static void assertQty(String expected, BigDecimal actual) {
        assertNotNull(actual);
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    private void tonTruGiu(List<Integer> ids, Object[]... rows) {
        when(tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(KHO_TONG, ids)).thenReturn(List.of(rows));
    }

    private void dat(List<Integer> ids, Object[]... rows) {
        when(chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(ids, null, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(List.of(rows));
    }

    private void daXuat(List<Integer> ids, Object[]... rows) {
        when(chiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho(ids, null, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(List.of(rows));
    }

    @Test
    void truChoXuatCuaKhoGui_khongTinhDonKhoKhac() {
        tonTruGiu(List.of(MA_A), dong(MA_A, new BigDecimal("10")));
        dat(List.of(MA_A),
                dong(MA_A, KHO_TONG, new BigDecimal("9")),
                dong(MA_A, CUA_HANG, new BigDecimal("50")));
        daXuat(List.of(MA_A), dong(MA_A, KHO_TONG, new BigDecimal("2")));

        KhaDungChuyen kd = service.theoBienThe(KHO_TONG, List.of(MA_A)).get(MA_A);

        assertQty("10", kd.tonTruGiu());
        assertQty("7", kd.choXuat());
        assertQty("3", kd.khaDung());
    }

    @Test
    void truHangPhieuChuyenDangGiuCho_boQuaPhieuDangXet() {
        tonTruGiu(List.of(MA_A), dong(MA_A, new BigDecimal("10")));
        dat(List.of(MA_A), dong(MA_A, KHO_TONG, new BigDecimal("2")));
        daXuat(List.of(MA_A));
        when(giuChoChuyenKhoService.taiKho(KHO_TONG, List.of(MA_A), 7)).thenReturn(Map.of(MA_A, new BigDecimal("5")));

        KhaDungChuyen kd = service.theoBienThe(KHO_TONG, List.of(MA_A), 7).get(MA_A);

        assertQty("2", kd.choXuat());
        assertQty("5", kd.giuChoChuyen());
        assertQty("3", kd.khaDung());
    }

    @Test
    void giuChoVuotTon_khaDung0() {
        tonTruGiu(List.of(MA_A), dong(MA_A, new BigDecimal("4")));
        dat(List.of(MA_A));
        daXuat(List.of(MA_A));
        when(giuChoChuyenKhoService.taiKho(KHO_TONG, List.of(MA_A), null)).thenReturn(Map.of(MA_A, new BigDecimal("6")));

        assertQty("0", service.theoBienThe(KHO_TONG, List.of(MA_A)).get(MA_A).khaDung());
    }

    @Test
    void choXuatAm_tinh0_tonTruGiuAm_khaDung0() {
        tonTruGiu(List.of(MA_A, MA_B),
                dong(MA_A, new BigDecimal("4")),
                dong(MA_B, new BigDecimal("-2")));
        // Mã A: đã xuất nhiều hơn đặt (dữ liệu lệch) → chờ xuất 0, không cộng ngược vào khả dụng
        dat(List.of(MA_A, MA_B), dong(MA_A, KHO_TONG, new BigDecimal("1")));
        daXuat(List.of(MA_A, MA_B), dong(MA_A, KHO_TONG, new BigDecimal("3")));

        Map<Integer, KhaDungChuyen> kq = service.theoBienThe(KHO_TONG, List.of(MA_A, MA_B));

        assertQty("0", kq.get(MA_A).choXuat());
        assertQty("4", kq.get(MA_A).khaDung());
        assertQty("-2", kq.get(MA_B).tonTruGiu());
        assertQty("0", kq.get(MA_B).khaDung());
    }

    @Test
    void maChuaCoDongTon_ra0_vaMaTrungChiHoiMotLan() {
        tonTruGiu(List.of(MA_A, MA_B), dong(MA_A, new BigDecimal("5")));
        dat(List.of(MA_A, MA_B));
        daXuat(List.of(MA_A, MA_B));

        Map<Integer, KhaDungChuyen> kq = service.theoBienThe(KHO_TONG, List.of(MA_A, MA_B, MA_A));

        assertEquals(List.of(MA_A, MA_B), List.copyOf(kq.keySet()));
        assertQty("5", kq.get(MA_A).khaDung());
        assertQty("0", kq.get(MA_B).tonTruGiu());
        assertQty("0", kq.get(MA_B).khaDung());
        verify(tonKhoTheoLoRepository, times(1)).sumSoLuongKhaDungByKhoAndBienTheIds(KHO_TONG, List.of(MA_A, MA_B));
    }

    @Test
    void danhSachRongHoacKhongCoKho_khongTruyVan() {
        assertTrue(service.theoBienThe(KHO_TONG, List.of()).isEmpty());
        assertTrue(service.theoBienThe(null, List.of(MA_A)).isEmpty());
        verifyNoInteractions(tonKhoTheoLoRepository, chiTietDonBanHangRepository, chiTietPhieuXuatKhoRepository);
    }
}
