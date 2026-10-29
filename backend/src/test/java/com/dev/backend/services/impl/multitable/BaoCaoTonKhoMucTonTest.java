package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.TonKhoTongQuanDong;
import com.dev.backend.repository.TonKhoTongHopRepository;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanAdminRepository.KhoDong;
import com.dev.backend.services.impl.entities.TonKhoTheoLoService;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

/**
 * Báo cáo tồn kho xếp mức tồn và đề xuất bổ sung theo đúng quy tắc của Tổng quan, để "Xem tất cả" từ Tổng quan mở ra
 * đúng số mã: theo khả dụng (không theo tồn thực), ngưỡng mặc định khi sản phẩm chưa đặt mức, hệ số dư cấu hình,
 * không xếp mức cặp chưa từng có lô và kho trung chuyển.
 */
@ExtendWith(MockitoExtension.class)
class BaoCaoTonKhoMucTonTest {

    private static final int KHO_TONG = 1;
    private static final int CUA_HANG = 2;
    private static final int KHO_TRUNG_CHUYEN = 99;

    @Mock
    private TonKhoTongHopRepository tonKhoTongHopRepository;
    @Mock
    private TongQuanAdminRepository tongQuanAdminRepository;
    @Mock
    private KhaDungChuyenKhoService khaDungChuyenKhoService;
    @Mock
    private TonKhoTheoLoService tonKhoTheoLoService;

    @InjectMocks
    private ThongKeHeThongServiceImpl service;

    private static TonKhoProjection dong(int bienTheId, int khoId, Integer mucToiThieu, String tonThuc, String khaDung, long soDongTon) {
        return new TonKhoProjection() {
            public Integer getBienTheId() { return bienTheId; }
            public String getMaSku() { return "SKU-" + bienTheId; }
            public String getMaSanPham() { return "SP"; }
            public String getTenSanPham() { return "Áo"; }
            public String getTenMau() { return "Đen"; }
            public String getMaSize() { return "M"; }
            public String getTenChatLieu() { return "Cotton"; }
            public Integer getMucTonToiThieu() { return mucToiThieu; }
            public Integer getKhoId() { return khoId; }
            public String getTenKho() { return "Kho " + khoId; }
            public BigDecimal getOnHand() { return new BigDecimal(tonThuc); }
            public BigDecimal getIncoming() { return BigDecimal.ZERO; }
            public BigDecimal getOutgoing() { return BigDecimal.ZERO; }
            public BigDecimal getFreeToUse() { return new BigDecimal(tonThuc); }
            public BigDecimal getTongGiaTri() { return BigDecimal.ZERO; }
            public BigDecimal getKhaDung() { return new BigDecimal(khaDung); }
            public Long getSoDongTon() { return soDongTon; }
            public String getMaKho() { return khoId == KHO_TRUNG_CHUYEN ? "KHO_TRANSIT" : "K" + khoId; }
        };
    }

    private void kho(boolean coKhoTong) {
        when(tongQuanAdminRepository.danhSachKho()).thenReturn(coKhoTong
                ? List.of(new KhoDong(KHO_TONG, "KHO_TONG", "Kho tổng", true), new KhoDong(CUA_HANG, "CH_01", "Cửa hàng", false))
                : List.of(new KhoDong(CUA_HANG, "CH_01", "Cửa hàng", false)));
    }

    private void cauHinh(Integer nguong, Integer heSoDu) {
        when(tongQuanAdminRepository.cauHinhSo("DEFAULT_MIN_STOCK_ALERT")).thenReturn(nguong);
        when(tongQuanAdminRepository.cauHinhSo("SURPLUS_STOCK_RATIO")).thenReturn(heSoDu);
    }

    private static TonKhoTongQuanDong theoMa(List<TonKhoTongQuanDong> ds, int bienTheId, int khoId) {
        return ds.stream().filter(d -> d.bienTheId() == bienTheId && d.khoId() == khoId).findFirst().orElseThrow();
    }

    @Test
    void xepMucTheoKhaDung_nguongMacDinh_khongXepCapChuaNhapVaKhoTrungChuyen() {
        cauHinh(10, null);
        kho(true);
        when(tonKhoTongHopRepository.findTonKhoTongHop(null, null)).thenReturn(List.of(
                dong(11, CUA_HANG, null, "50", "5", 1),          // tồn thực 50 nhưng khả dụng 5 ≤ ngưỡng mặc định 10
                dong(12, CUA_HANG, 80, "0", "0", 0),            // chưa từng nhập về cửa hàng
                dong(13, KHO_TRUNG_CHUYEN, 80, "0", "0", 2),    // kho trung chuyển
                dong(14, KHO_TONG, 0, "40", "40", 1),            // mức 0 coi như chưa đặt: 40 > 10 × 3
                dong(15, KHO_TONG, 10, "0", "0", 1)));           // Kho tổng hết hàng
        when(khaDungChuyenKhoService.theoBienThe(KHO_TONG, List.of(11))).thenReturn(Map.of(
                11, new KhaDungChuyen(new BigDecimal("50"), new BigDecimal("5"), new BigDecimal("45.7"))));

        List<TonKhoTongQuanDong> ds = service.getTonKhoTongHop(null, null);

        TonKhoTongQuanDong a = theoMa(ds, 11, CUA_HANG);
        assertEquals("thieu_hang", a.tinhTrang(), "theo khả dụng, không theo tồn thực 50");
        assertEquals(10, a.nguong());
        assertTrue(a.nguongMacDinh());
        assertEquals("chuyen_kho", a.deXuat(), "Kho tổng có thể chuyển 45 ≥ 15");
        assertEquals(15L, a.soLuongDeXuat(), "2 × 10 − 5");
        assertEquals(45L, a.khaDungKhoTong(), "làm tròn xuống như Tổng quan");
        assertEquals(5L, a.choXuatKhoTong());

        TonKhoTongQuanDong b = theoMa(ds, 12, CUA_HANG);
        assertNull(b.tinhTrang(), "cặp chưa có lô không xếp mức (báo cáo cũ xếp là Hết hàng)");
        assertNull(b.deXuat());
        assertEquals(80, b.nguong());
        assertFalse(b.nguongMacDinh());

        assertNull(theoMa(ds, 13, KHO_TRUNG_CHUYEN).tinhTrang(), "kho trung chuyển không xếp mức");

        TonKhoTongQuanDong d = theoMa(ds, 14, KHO_TONG);
        assertEquals("du_hang", d.tinhTrang());
        assertNull(d.deXuat(), "chỉ dòng hết / sắp hết có đề xuất");

        TonKhoTongQuanDong e = theoMa(ds, 15, KHO_TONG);
        assertEquals("het_hang", e.tinhTrang());
        assertTrue(e.laKhoTong());
        assertEquals("yeu_cau_nhap", e.deXuat(), "Kho tổng nhập từ nhà cung cấp");
        assertEquals(20L, e.soLuongDeXuat());
        assertNull(e.khaDungKhoTong());

        verify(khaDungChuyenKhoService, times(1)).theoBienThe(KHO_TONG, List.of(11));
        assertEquals(5, ds.size(), "không bớt dòng nào của báo cáo");
    }

    @Test
    void heSoDuTheoCauHinh() {
        cauHinh(10, 5);
        kho(true);
        when(tonKhoTongHopRepository.findTonKhoTongHop(CUA_HANG, "ao")).thenReturn(List.of(dong(21, CUA_HANG, 10, "40", "40", 1)));

        TonKhoTongQuanDong d = service.getTonKhoTongHop(CUA_HANG, "ao").get(0);

        assertEquals("binh_thuong", d.tinhTrang(), "40 ≤ 10 × 5");
        verifyNoInteractions(khaDungChuyenKhoService);
    }

    @Test
    void khongCoKhoTong_deXuatNhap_khongTinhSoKhoTong() {
        cauHinh(null, null);
        kho(false);
        when(tonKhoTongHopRepository.findTonKhoTongHop(null, null)).thenReturn(List.of(dong(31, CUA_HANG, 10, "1", "1", 1)));

        TonKhoTongQuanDong d = service.getTonKhoTongHop(null, null).get(0);

        assertEquals("thieu_hang", d.tinhTrang());
        assertEquals("yeu_cau_nhap", d.deXuat());
        assertEquals(19L, d.soLuongDeXuat());
        assertNull(d.khaDungKhoTong());
        verifyNoInteractions(khaDungChuyenKhoService);
    }

    @Test
    void haiKhoTong_khoThuHaiVanLaKhoTong_deXuatNhap_khongChuyenTuKhoKia() {
        cauHinh(10, null);
        // Thứ tự như Tổng quan: Kho tổng trước, rồi theo id
        when(tongQuanAdminRepository.danhSachKho()).thenReturn(List.of(
                new KhoDong(KHO_TONG, "KHO_TONG", "Kho tổng", true),
                new KhoDong(17, "KHO_TONG_2", "Kho tổng miền Nam", true),
                new KhoDong(CUA_HANG, "CH_01", "Cửa hàng", false)));
        when(tonKhoTongHopRepository.findTonKhoTongHop(null, null)).thenReturn(List.of(dong(51, 17, 10, "2", "2", 1)));

        TonKhoTongQuanDong d = service.getTonKhoTongHop(null, null).get(0);

        assertTrue(d.laKhoTong(), "như Tổng quan: lấy cờ Kho tổng của chính kho đó");
        assertEquals("yeu_cau_nhap", d.deXuat());
        verifyNoInteractions(khaDungChuyenKhoService);
    }

    @Test
    void khongTraDuocDanhSachKho_vanXepMuc_boDeXuat() {
        cauHinh(10, null);
        when(tongQuanAdminRepository.danhSachKho()).thenThrow(new RuntimeException("mất kết nối"));
        when(tonKhoTongHopRepository.findTonKhoTongHop(null, null)).thenReturn(List.of(
                dong(61, CUA_HANG, 10, "1", "1", 1), dong(62, KHO_TRUNG_CHUYEN, 10, "0", "0", 1)));

        List<TonKhoTongQuanDong> ds = service.getTonKhoTongHop(null, null);

        assertEquals("thieu_hang", ds.get(0).tinhTrang(), "mức tồn không cần danh sách kho");
        assertNull(ds.get(0).deXuat(), "không biết Kho tổng thì không đoán đề xuất");
        assertNull(ds.get(1).tinhTrang(), "kho trung chuyển nhận ra bằng mã kho");
        verifyNoInteractions(khaDungChuyenKhoService);
    }

    @Test
    void khongTraDuocSoKhoTong_vanTraBaoCao_dongKhoTongVanDeXuatNhap() {
        cauHinh(10, null);
        kho(true);
        when(tonKhoTongHopRepository.findTonKhoTongHop(null, null)).thenReturn(List.of(
                dong(71, CUA_HANG, 10, "1", "1", 1), dong(72, KHO_TONG, 10, "0", "0", 1)));
        when(khaDungChuyenKhoService.theoBienThe(KHO_TONG, List.of(71))).thenThrow(new RuntimeException("thiếu bảng phiếu chuyển"));

        List<TonKhoTongQuanDong> ds = service.getTonKhoTongHop(null, null);

        assertEquals("thieu_hang", ds.get(0).tinhTrang());
        assertNull(ds.get(0).deXuat(), "không đề xuất Yêu cầu nhập sai khi lẽ ra có thể chuyển");
        assertEquals("yeu_cau_nhap", ds.get(1).deXuat(), "Kho tổng không cần số chuyển");
    }

    @Test
    void docCauHinhLoi_vanTraBaoCao_dungMacDinh() {
        when(tongQuanAdminRepository.cauHinhSo(any())).thenThrow(new RuntimeException("mất kết nối"));
        kho(false);
        when(tonKhoTongHopRepository.findTonKhoTongHop(null, null)).thenReturn(List.of(dong(41, CUA_HANG, null, "10", "10", 1)));

        TonKhoTongQuanDong d = service.getTonKhoTongHop(null, null).get(0);

        assertEquals(TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH, d.nguong());
        assertEquals("thieu_hang", d.tinhTrang(), "10 ≤ ngưỡng mặc định 10");
        verify(khaDungChuyenKhoService, never()).theoBienThe(anyInt(), any());
    }
}
