package com.dev.backend.services.impl.multitable;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongBoSung;
import com.dev.backend.dto.response.TongQuanAdminResponse.HangCanBoSung;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanAdminRepository.HangCanBoSungDong;
import com.dev.backend.repository.TongQuanAdminRepository.KhoDong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Khối Đề xuất bổ sung ở Tổng quan: số Kho tổng có thể chuyển phải đúng mức mà tạo yêu cầu chuyển kho cho phép,
 * (tồn − đang giữ) − chờ xuất của đơn bán ở Kho tổng, để nút "Chuyển … từ Kho tổng" không điền sẵn số bị chặn.
 */
@ExtendWith(MockitoExtension.class)
class TongQuanHangCanBoSungTest {

    private static final int KHO_TONG = 1;
    private static final int CUA_HANG = 2;
    private static final int MA_A = 93;
    private static final int MA_B = 94;
    private static final int NGUONG = 10;

    @Mock
    private TongQuanAdminRepository repo;
    @Mock
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock
    private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;

    private TongQuanAdminServiceImpl service;

    @BeforeEach
    void setUp() {
        // Bản thật của hàm dùng chung với tạo yêu cầu chuyển kho, chỉ giả truy vấn
        service = new TongQuanAdminServiceImpl(repo, new KhaDungChuyenKhoService(
                tonKhoTheoLoRepository, chiTietDonBanHangRepository, chiTietPhieuXuatKhoRepository));
    }

    private static Map<Integer, KhoDong> khoCoKhoTong() {
        Map<Integer, KhoDong> m = new LinkedHashMap<>();
        m.put(KHO_TONG, new KhoDong(KHO_TONG, "KHO_TONG", "Kho tổng", true));
        m.put(CUA_HANG, new KhoDong(CUA_HANG, "CH_01", "Cửa hàng 1", false));
        return m;
    }

    private static HangCanBoSungDong dong(int bienTheId, int khoId, String khaDung) {
        return new HangCanBoSungDong(bienTheId, "SKU-" + bienTheId, "Áo", "Đen", "M", khoId, new BigDecimal(khaDung), NGUONG);
    }

    private void danhSach(HangCanBoSungDong... rows) {
        when(repo.hangCanBoSung(null, NGUONG, 7)).thenReturn(List.of(rows));
    }

    /** Số liệu ở Kho tổng: tồn − đang giữ, đặt và đã xuất thật của đơn bán (kèm một đơn ở cửa hàng để kiểm lọc kho). */
    private void khoTong(List<Integer> ids, List<Object[]> tonTruGiu, List<Object[]> dat, List<Object[]> daXuat) {
        when(tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(KHO_TONG, ids)).thenReturn(tonTruGiu);
        when(chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(ids, null, ITrangThaiDonBanHang.DANG_GIU_HANG)).thenReturn(dat);
        when(chiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho(ids, null, ITrangThaiDonBanHang.DANG_GIU_HANG)).thenReturn(daXuat);
    }

    private static Object[] r(Object... cot) {
        return cot;
    }

    private DongBoSung motDong(HangCanBoSung kq) {
        assertEquals(1, kq.dong().size());
        return kq.dong().get(0);
    }

    @Test
    void viDu_khoTongBiDonChoXuatChiem_deXuatNhapThayViChuyen() {
        danhSach(dong(MA_A, CUA_HANG, "2"));
        // Kho tổng: tồn − đang giữ 30, đơn sàn chờ xuất 25. Đơn 50 ở cửa hàng không được trừ vào Kho tổng.
        khoTong(List.of(MA_A),
                List.<Object[]>of(r(MA_A, new BigDecimal("30"))),
                List.of(r(MA_A, KHO_TONG, new BigDecimal("25")), r(MA_A, CUA_HANG, new BigDecimal("50"))),
                List.of());

        DongBoSung d = motDong(service.tinhHangCanBoSung(null, NGUONG, null, khoCoKhoTong()));

        assertEquals(18, d.soLuongDeXuat(), "N = 2 × 10 − 2");
        assertEquals("yeu_cau_nhap", d.deXuat(), "trước khi sửa ra chuyen_kho vì 30 ≥ 18");
        assertEquals(5L, d.khaDungKhoTong());
        assertEquals(25L, d.choXuatKhoTong());
    }

    @Test
    void choXuatNho_vanChuyenKho_dungSoTaoPhieuChoPhep() {
        danhSach(dong(MA_A, CUA_HANG, "2"));
        khoTong(List.of(MA_A),
                List.<Object[]>of(r(MA_A, new BigDecimal("30"))),
                List.<Object[]>of(r(MA_A, KHO_TONG, new BigDecimal("12"))),
                List.<Object[]>of(r(MA_A, KHO_TONG, new BigDecimal("2"))));

        DongBoSung d = motDong(service.tinhHangCanBoSung(null, NGUONG, null, khoCoKhoTong()));

        assertEquals("chuyen_kho", d.deXuat());
        assertEquals(18, d.soLuongDeXuat());
        assertEquals(20L, d.khaDungKhoTong());
        assertEquals(10L, d.choXuatKhoTong());
    }

    @Test
    void bienDungBangN_chuyen_soLeKhongLamTronLen_motLanTruyVanChoCaDanhSach() {
        danhSach(dong(MA_A, CUA_HANG, "2"), dong(MA_B, CUA_HANG, "2"));
        khoTong(List.of(MA_A, MA_B),
                List.of(r(MA_A, new BigDecimal("18")), r(MA_B, new BigDecimal("17.6"))),
                List.of(), List.of());

        HangCanBoSung kq = service.tinhHangCanBoSung(null, NGUONG, null, khoCoKhoTong());

        DongBoSung a = kq.dong().get(0);
        DongBoSung b = kq.dong().get(1);
        assertEquals("chuyen_kho", a.deXuat(), "có thể chuyển đúng bằng N");
        assertEquals(18L, a.khaDungKhoTong());
        assertEquals(0L, a.choXuatKhoTong());
        // 17,6 < 18: tạo phiếu sẽ chặn, nên không được hiện 18 rồi đề xuất chuyển
        assertEquals("yeu_cau_nhap", b.deXuat());
        assertEquals(17L, b.khaDungKhoTong());
        verify(tonKhoTheoLoRepository, times(1)).sumSoLuongKhaDungByKhoAndBienTheIds(KHO_TONG, List.of(MA_A, MA_B));
    }

    @Test
    void khongCoKhoTong_khongTruyVan_soKhoTongNull() {
        danhSach(dong(MA_A, CUA_HANG, "2"));
        Map<Integer, KhoDong> kho = Map.of(CUA_HANG, new KhoDong(CUA_HANG, "CH_01", "Cửa hàng 1", false));

        HangCanBoSung kq = service.tinhHangCanBoSung(null, NGUONG, null, kho);

        DongBoSung d = motDong(kq);
        assertFalse(kq.coKhoTong());
        assertEquals("yeu_cau_nhap", d.deXuat());
        assertNull(d.khaDungKhoTong());
        assertNull(d.choXuatKhoTong());
        verifyNoInteractions(tonKhoTheoLoRepository, chiTietDonBanHangRepository, chiTietPhieuXuatKhoRepository);
    }

    @Test
    void moiDongLaKhoTong_khongTruyVan_luonDeXuatNhap() {
        danhSach(dong(MA_A, KHO_TONG, "0"));

        HangCanBoSung kq = service.tinhHangCanBoSung(null, NGUONG, null, khoCoKhoTong());

        DongBoSung d = motDong(kq);
        assertTrue(kq.coKhoTong());
        assertTrue(d.laKhoTong());
        assertEquals("yeu_cau_nhap", d.deXuat());
        assertNull(d.khaDungKhoTong());
        assertEquals(20, d.soLuongDeXuat());
        verifyNoInteractions(tonKhoTheoLoRepository, chiTietDonBanHangRepository, chiTietPhieuXuatKhoRepository);
    }
}
