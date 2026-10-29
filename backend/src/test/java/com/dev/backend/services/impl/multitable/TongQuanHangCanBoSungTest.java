package com.dev.backend.services.impl.multitable;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongBoSung;
import com.dev.backend.dto.response.TongQuanAdminResponse.HangCanBoSung;
import com.dev.backend.dto.response.TongQuanAdminResponse.NhomBoSung;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanAdminRepository.HangCanBoSungNhomDong;
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
    @Mock
    private GiuChoChuyenKhoService giuChoChuyenKhoService;

    private TongQuanAdminServiceImpl service;

    @BeforeEach
    void setUp() {
        // Bản thật của hàm dùng chung với tạo yêu cầu chuyển kho, chỉ giả truy vấn
        service = new TongQuanAdminServiceImpl(repo, new KhaDungChuyenKhoService(
                tonKhoTheoLoRepository, chiTietDonBanHangRepository, chiTietPhieuXuatKhoRepository, giuChoChuyenKhoService));
    }

    private static Map<Integer, KhoDong> khoCoKhoTong() {
        Map<Integer, KhoDong> m = new LinkedHashMap<>();
        m.put(KHO_TONG, new KhoDong(KHO_TONG, "KHO_TONG", "Kho tổng", true));
        m.put(CUA_HANG, new KhoDong(CUA_HANG, "CH_01", "Cửa hàng 1", false));
        return m;
    }

    /** Mỗi mã một sản phẩm riêng (sản phẩm = mã): các test cũ về đề xuất giữ nguyên ý nghĩa. */
    private static HangCanBoSungNhomDong dong(int bienTheId, int khoId, String khaDung) {
        return dong(bienTheId, bienTheId, khoId, khaDung);
    }

    private static HangCanBoSungNhomDong dong(int sanPhamId, int bienTheId, int khoId, String khaDung) {
        return new HangCanBoSungNhomDong(sanPhamId, bienTheId, "SKU-" + bienTheId, "SP " + sanPhamId, "Đen", "M", khoId,
                new BigDecimal(khaDung), NGUONG);
    }

    private void danhSach(HangCanBoSungNhomDong... rows) {
        when(repo.hangCanBoSungTheoNhom(null, NGUONG, TongQuanAdminServiceImpl.SO_NHOM_BO_SUNG)).thenReturn(List.of(rows));
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

    @Test
    void gomTheoSanPhamVaKho_giuThuTuTruyVan_demHetVaSapHet() {
        // Truy vấn trả các mã của một nhóm liền nhau, nhóm tệ nhất trước
        danhSach(dong(7, 71, KHO_TONG, "0"), dong(7, 72, KHO_TONG, "1"), dong(7, 73, KHO_TONG, "1"),
                dong(8, 81, KHO_TONG, "2"));

        HangCanBoSung kq = service.tinhHangCanBoSung(null, NGUONG, null, khoCoKhoTong());

        assertEquals(2, kq.nhom().size());
        NhomBoSung a = kq.nhom().get(0);
        assertEquals(7, a.sanPhamId());
        assertEquals(KHO_TONG, a.khoId());
        assertEquals("Kho tổng", a.tenKho());
        assertTrue(a.laKhoTong());
        assertEquals(1, a.soHet());
        assertEquals(2, a.soSapHet());
        assertEquals(List.of(71, 72, 73), a.dong().stream().map(DongBoSung::bienTheId).toList(), "giữ thứ tự mã tệ nhất trước");
        assertEquals(8, kq.nhom().get(1).sanPhamId());
        assertEquals(List.of(71, 72, 73, 81), kq.dong().stream().map(DongBoSung::bienTheId).toList(),
                "danh sách phẳng giữ cho giao diện cũ");
    }

    @Test
    void cungSanPhamKhacKho_laHaiNhom() {
        danhSach(dong(7, 71, CUA_HANG, "0"), dong(7, 71, KHO_TONG, "3"));
        khoTong(List.of(71), List.<Object[]>of(r(71, new BigDecimal("3"))), List.of(), List.of());

        HangCanBoSung kq = service.tinhHangCanBoSung(null, NGUONG, null, khoCoKhoTong());

        assertEquals(2, kq.nhom().size(), "đề xuất của cửa hàng và Kho tổng khác nhau nên không gộp");
        assertEquals(CUA_HANG, kq.nhom().get(0).khoId());
        assertEquals("yeu_cau_nhap", kq.nhom().get(0).dong().get(0).deXuat(), "Kho tổng chỉ còn 3, không đủ 20");
        assertEquals(KHO_TONG, kq.nhom().get(1).khoId());
    }

    @Test
    void tongSo_layTuTongHopTon_khongPhaiSoMaTrongNhom() {
        danhSach(dong(MA_A, KHO_TONG, "0"));
        var ton = new TongQuanAdminRepository.TonKhoTongHopDong(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, 0, 43, 1, 20, 8, 14, BigDecimal.ZERO);

        HangCanBoSung kq = service.tinhHangCanBoSung(null, NGUONG, ton, khoCoKhoTong());

        assertEquals(21, kq.tongSo(), "Xem tất cả 21 = 1 hết + 20 sắp hết, kể cả mã ngoài 3 nhóm");
    }

    @Test
    void khaDungLe_duoiMot_vanLaSapHet_khongDemLaHet() {
        // 0,4 làm tròn hiển thị thành 0 nhưng SQL xếp là Thiếu hàng (khả dụng > 0)
        danhSach(dong(7, 71, KHO_TONG, "0.4"), dong(7, 72, KHO_TONG, "0"));

        NhomBoSung n = service.tinhHangCanBoSung(null, NGUONG, null, khoCoKhoTong()).nhom().get(0);

        assertEquals(1, n.soHet());
        assertEquals(1, n.soSapHet());
    }
}
