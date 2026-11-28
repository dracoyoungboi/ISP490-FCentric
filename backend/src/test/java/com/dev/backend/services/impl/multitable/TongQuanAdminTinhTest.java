package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.TongQuanAdminResponse.Diem;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongBoSung;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongKenh;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongKho;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongNhanVien;
import com.dev.backend.dto.response.TongQuanAdminResponse.TongSo;
import com.dev.backend.repository.TongQuanAdminRepository.KhoDong;
import com.dev.backend.repository.TongQuanQuanTriRepository.BoSungDong;
import com.dev.backend.repository.TongQuanQuanTriRepository.DiemChuoi;
import com.dev.backend.repository.TongQuanQuanTriRepository.TongNhom;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Phép ghép số của Tổng quan quản trị: tổng, lợi nhuận gộp, phân bổ, điểm biểu đồ, đề xuất bổ sung. */
class TongQuanAdminTinhTest {

    private static BigDecimal b(long v) {
        return BigDecimal.valueOf(v);
    }

    private static TongNhom nhom(Integer kho, String kenh, Integer nguoi, boolean pos, long dt, long xuat, long tra, long vat,
                                 long von, long traTot, long traLoi, long donXuat, long donTra, long biHoan) {
        return new TongNhom(kho, kenh, kenh, nguoi, nguoi == null ? null : "NV" + nguoi, pos, b(dt), b(xuat), b(tra), b(vat),
                b(von), b(traTot), b(traLoi), donXuat, donTra, biHoan);
    }

    @Test
    void tong_loiNhuanCongLaiGiaVonHangTraTot_khongCongHangLoi_soDonTruDonTra() {
        TongSo t = TongQuanAdminServiceImpl.tong(List.of(
                nhom(1, "POS", 7, true, 900, 1080, 0, 80, 500, 0, 0, 10, 0, 1),
                nhom(1, "POS", 7, true, -100, 0, 108, -8, 0, 40, 15, 0, 1, 0)));
        assertEquals(800, t.doanhThu());
        assertEquals(1080, t.tienHangXuat());
        assertEquals(108, t.tienHangTra());
        assertEquals(800 - 500 + 40, t.loiNhuan(), "hàng trả lỗi (15) không cộng lại giá vốn");
        assertEquals(15, t.giaVonTraLoi());
        assertEquals(9, t.soDon());
    }

    @Test
    void theoKho_duMoiKho_khoNgungKhongDoanhThuThiBo_xepGiam() {
        Map<Integer, KhoDong> kho = new LinkedHashMap<>();
        kho.put(1, new KhoDong(1, "KT", "Kho tổng", true));
        kho.put(2, new KhoDong(2, "HN", "Cửa hàng Hà Nội", false));
        kho.put(3, new KhoDong(3, "NA", "Cửa hàng Nghệ An", false));
        List<DongKho> ds = TongQuanAdminServiceImpl.theoKho(
                List.of(nhom(1, "SHOPEE", null, false, 500, 0, 0, 0, 0, 0, 0, 5, 1, 0),
                        nhom(2, "POS", 7, true, 900, 0, 0, 0, 0, 0, 0, 9, 0, 0)),
                List.of(nhom(2, "POS", 7, true, 600, 0, 0, 0, 0, 0, 0, 6, 0, 0),
                        nhom(9, "POS", 8, true, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)),
                kho, Map.of(3, LocalDateTime.of(2026, 3, 1, 0, 0)));
        assertEquals(List.of(2, 1, 3), ds.stream().map(DongKho::khoId).toList());
        assertEquals(600, ds.get(0).doanhThuTruoc());
        assertEquals(4, ds.get(1).soDon());
        assertEquals("2026-03-01", ds.get(2).ngayMo());
    }

    @Test
    void theoKenh_donHoanLaDonXuatTrongKyDaBiHoan() {
        List<DongKenh> ds = TongQuanAdminServiceImpl.theoKenh(
                List.of(nhom(1, "SHOPEE", null, false, 300, 0, 0, 0, 0, 0, 0, 14, 0, 2),
                        nhom(2, "POS", 7, true, 900, 0, 0, 0, 0, 0, 0, 9, 0, 0)),
                List.of(nhom(1, "SHOPEE", null, false, 200, 0, 0, 0, 0, 0, 0, 10, 0, 0)));
        assertEquals("POS", ds.get(0).maKenh());
        assertEquals("Bán tại quầy", ds.get(0).tenKenh());
        DongKenh s = ds.get(1);
        assertEquals(14, s.soDonXuat());
        assertEquals(2, s.soDonHoan());
        assertEquals(200, s.doanhThuTruoc());
    }

    @Test
    void theoNhanVien_chiDonQuay() {
        List<DongNhanVien> ds = TongQuanAdminServiceImpl.theoNhanVien(List.of(
                nhom(2, "POS", 7, true, 900, 0, 0, 0, 0, 0, 0, 9, 0, 0),
                nhom(2, "POS", 8, true, 1200, 0, 0, 0, 0, 0, 0, 11, 0, 0),
                nhom(2, "SHOPEE", 9, false, 500, 0, 0, 0, 0, 0, 0, 5, 0, 0)));
        assertEquals(List.of(8, 7), ds.stream().map(DongNhanVien::nguoiId).toList());
    }

    @Test
    void diem_theoViTriTuDauKy_boDiemNgoaiKhoang_loiNhuanTheoDiem() {
        KyXemTongQuan k = KyXemTongQuan.tao(KyXemTongQuan.HOM_NAY, null, null, LocalDateTime.of(2026, 11, 27, 21, 13), null);
        List<Diem> ds = TongQuanAdminServiceImpl.diem(k, k.tu(), List.of(
                new DiemChuoi("2026-11-27 09", b(1000), b(600), b(0), 3, 0),
                new DiemChuoi("2026-11-27 15", b(-200), b(0), b(100), 0, 1),
                new DiemChuoi("2026-11-26 23", b(5), b(0), b(0), 1, 0)));
        assertEquals(2, ds.size());
        assertEquals(9, ds.get(0).viTri());
        assertEquals(400, ds.get(0).loiNhuan());
        assertEquals(-1, ds.get(1).soDon(), "khách trả nhiều hơn số bán trong khung giờ");
        assertEquals(-100, ds.get(1).loiNhuan());

        KyXemTongQuan th = KyXemTongQuan.tao(KyXemTongQuan.MUOI_HAI_THANG, null, null, LocalDateTime.of(2026, 11, 27, 21, 13), null);
        assertEquals(11, TongQuanAdminServiceImpl.diem(th, th.tu(), List.of(new DiemChuoi("2026-11", b(1), b(0), b(0), 1, 0))).get(0).viTri());
        assertEquals(LocalDate.of(2026, 11, 1).atStartOfDay(), TongQuanAdminServiceImpl.docMoc("2026-11", "thang"));
    }

    @Test
    void boSung_cuaHang_khoTongDuThiChuyen_khongDuThiNhap_khoTongLuonNhap() {
        BoSungDong r = new BoSungDong(5, 1, "SKU", "Áo", "Đen", "M", b(2), 6, b(30), b(0), 3);
        DongBoSung d = TongQuanAdminServiceImpl.dongBoSung(r, false);
        assertEquals(10, d.soLuongDeXuat(), "đưa về gấp đôi ngưỡng: 12 − 2");
        assertEquals("chuyen_kho", d.deXuat());
        assertEquals("yeu_cau_nhap", TongQuanAdminServiceImpl.dongBoSung(
                new BoSungDong(5, 1, "SKU", "Áo", null, null, b(2), 6, b(4), b(0), 3), false).deXuat());
        DongBoSung kt = TongQuanAdminServiceImpl.dongBoSung(r, true);
        assertNull(kt.khoTongCon());
        assertEquals("yeu_cau_nhap", kt.deXuat());
    }
}
