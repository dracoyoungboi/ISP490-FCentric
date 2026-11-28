package com.dev.backend.services.impl.multitable;

import com.dev.backend.i18n.LoiThamSoException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Kỳ xem của Tổng quan quản trị (đặc tả bản 2, mục 1): mọi mốc theo lịch, kỳ chạm hôm nay cắt ở giờ số liệu và kỳ so sánh
 * cắt cùng giờ. Giờ số liệu mẫu: 21:13 thứ Sáu 27/11/2026.
 */
class KyXemTongQuanTest {

    private static final LocalDateTime BAY_GIO = LocalDateTime.of(2026, 11, 27, 21, 13);

    private static KyXemTongQuan ky(String ma) {
        return KyXemTongQuan.tao(ma, null, null, BAY_GIO, LocalDate.of(2024, 11, 1));
    }

    private static KyXemTongQuan tuyChon(String tu, String den) {
        return KyXemTongQuan.tao(KyXemTongQuan.TUY_CHON, LocalDate.parse(tu), LocalDate.parse(den), BAY_GIO, LocalDate.of(2024, 11, 1));
    }

    private static LocalDateTime t(String s) {
        return LocalDateTime.parse(s);
    }

    @Test
    void homNay_tu0GioToiGioSoLieu_soCungThuTuanTruocCatCungGio_bieuDoVeTronNgayTuanTruoc() {
        KyXemTongQuan k = ky(KyXemTongQuan.HOM_NAY);
        assertEquals(t("2026-11-27T00:00"), k.tu());
        assertEquals(BAY_GIO, k.den());
        assertEquals(t("2026-11-20T00:00"), k.tuTruoc());
        assertEquals(t("2026-11-20T21:13"), k.denTruoc());
        assertEquals(t("2026-11-21T00:00"), k.bieuDoTruocDen(), "đường tuần trước vẽ trọn ngày");
        assertEquals("gio", k.nhom());
        assertEquals(24, k.soDiem());
        assertEquals("tuan_truoc", k.kieuSoSanh());
        assertTrue(k.dangChay());
    }

    @Test
    void homQua_tronNgay_soCungThuTuanTruoc() {
        KyXemTongQuan k = ky(KyXemTongQuan.HOM_QUA);
        assertEquals(t("2026-11-26T00:00"), k.tu());
        assertEquals(t("2026-11-27T00:00"), k.den());
        assertEquals(t("2026-11-19T00:00"), k.tuTruoc());
        assertEquals(t("2026-11-20T00:00"), k.denTruoc());
        assertFalse(k.dangChay());
    }

    @Test
    void baMuoiNgay_gomHomNay_soBaMuoiNgayLienTruocCatCungGio() {
        KyXemTongQuan k = ky(KyXemTongQuan.BA_MUOI_NGAY);
        assertEquals(t("2026-10-29T00:00"), k.tu(), "29/10 – 27/11 là 30 ngày tính cả hôm nay");
        assertEquals(BAY_GIO, k.den());
        assertEquals(t("2026-09-29T00:00"), k.tuTruoc());
        assertEquals(t("2026-10-28T21:13"), k.denTruoc());
        assertEquals(30, k.soDiem());
        assertEquals(30, k.soNgay());
        assertEquals("ngay", k.nhom());
    }

    @Test
    void bayNgay_gomHomNay() {
        KyXemTongQuan k = ky(KyXemTongQuan.BAY_NGAY);
        assertEquals(t("2026-11-21T00:00"), k.tu());
        assertEquals(t("2026-11-14T00:00"), k.tuTruoc());
        assertEquals(t("2026-11-20T21:13"), k.denTruoc());
    }

    @Test
    void thangNay_soThangTruocToiCungNgayCungGio_bieuDoVeTronThangTruoc() {
        KyXemTongQuan k = ky(KyXemTongQuan.THANG_NAY);
        assertEquals(t("2026-11-01T00:00"), k.tu());
        assertEquals(t("2026-10-01T00:00"), k.tuTruoc());
        assertEquals(t("2026-10-27T21:13"), k.denTruoc());
        assertEquals(t("2026-11-01T00:00"), k.bieuDoTruocDen());
        assertEquals(30, k.soDiem(), "tháng 11 có 30 ngày");
        assertEquals("thang_truoc", k.kieuSoSanh());
    }

    @Test
    void thangNay_ngay31_thangTruocKhongCoNgayDo_soToiHetThangTruoc() {
        KyXemTongQuan k = KyXemTongQuan.tao(KyXemTongQuan.THANG_NAY, null, null,
                LocalDateTime.of(2026, 3, 31, 10, 0), null);
        assertEquals(t("2026-02-01T00:00"), k.tuTruoc());
        assertEquals(t("2026-03-01T00:00"), k.denTruoc(), "tháng 2 không có ngày 31: so trọn tháng 2");
    }

    @Test
    void thangTruoc_tronThang_soTronThangTruocNua() {
        KyXemTongQuan k = ky(KyXemTongQuan.THANG_TRUOC);
        assertEquals(t("2026-10-01T00:00"), k.tu());
        assertEquals(t("2026-11-01T00:00"), k.den());
        assertEquals(t("2026-09-01T00:00"), k.tuTruoc());
        assertEquals(t("2026-10-01T00:00"), k.denTruoc());
        assertEquals(31, k.soDiem());
        assertFalse(k.dangChay());
    }

    @Test
    void muoiHaiThang_tuDauThangCach11Thang_soCungKyNamTruocCatCungGio() {
        KyXemTongQuan k = ky(KyXemTongQuan.MUOI_HAI_THANG);
        assertEquals(t("2025-12-01T00:00"), k.tu());
        assertEquals(t("2024-12-01T00:00"), k.tuTruoc());
        assertEquals(t("2025-11-27T21:13"), k.denTruoc());
        assertEquals("thang", k.nhom());
        assertEquals(12, k.soDiem());
        assertEquals(11, k.viTri(k.tu(), BAY_GIO));
    }

    @Test
    void tuyChonMotNgay_theoGio_soCungThuTuanTruoc() {
        KyXemTongQuan k = tuyChon("2026-11-10", "2026-11-10");
        assertEquals("gio", k.nhom());
        assertEquals(t("2026-11-03T00:00"), k.tuTruoc());
        assertEquals(t("2026-11-04T00:00"), k.denTruoc());
    }

    @Test
    void tuyChonNhieuNgay_soSoNgayLienTruoc_chamHomNayThiCatGioSoLieu() {
        KyXemTongQuan k = tuyChon("2026-11-20", "2026-11-27");
        assertEquals(BAY_GIO, k.den());
        assertEquals(8, k.soDiem());
        assertEquals(t("2026-11-12T00:00"), k.tuTruoc());
        assertEquals(t("2026-11-19T21:13"), k.denTruoc());
        assertTrue(k.dangChay());
    }

    @Test
    void tuyChonDai_theoThang() {
        KyXemTongQuan k = tuyChon("2026-01-15", "2026-06-10");
        assertEquals("thang", k.nhom());
        assertEquals(6, k.soDiem());
    }

    @Test
    void tuyChonSai_baoLoi() {
        assertThrows(LoiThamSoException.class, () -> tuyChon("2026-11-10", "2026-11-01"));
        assertThrows(LoiThamSoException.class, () -> tuyChon("2026-11-10", "2026-11-28"));
        assertThrows(LoiThamSoException.class, () -> tuyChon("2025-11-01", "2026-11-27"), "quá 366 ngày");
        assertThrows(LoiThamSoException.class, () -> tuyChon("2024-01-01", "2024-02-01"), "trước ngày có dữ liệu");
        assertThrows(LoiThamSoException.class, () -> KyXemTongQuan.tao(KyXemTongQuan.TUY_CHON, null, null, BAY_GIO, null));
        assertThrows(LoiThamSoException.class, () -> ky("90_ngay"));
    }

    @Test
    void viTri_theoGio_theoNgay() {
        KyXemTongQuan h = ky(KyXemTongQuan.HOM_NAY);
        assertEquals(21, h.viTri(h.tu(), BAY_GIO));
        KyXemTongQuan n = ky(KyXemTongQuan.BA_MUOI_NGAY);
        assertEquals(29, n.viTri(n.tu(), BAY_GIO));
        assertEquals(0, n.viTri(n.tuTruoc(), t("2026-09-29T08:00")));
    }
}
