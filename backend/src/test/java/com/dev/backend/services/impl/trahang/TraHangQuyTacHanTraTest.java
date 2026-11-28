package com.dev.backend.services.impl.trahang;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/** Hạn trả hàng tại quầy tính theo ngày lịch giờ Việt Nam: tới hết ngày thứ 3 sau ngày thanh toán. */
class TraHangQuyTacHanTraTest {

    private static Instant vn(String gio) {
        return LocalDateTime.parse(gio).atZone(TraHangQuyTac.MUI_GIO_VN).toInstant();
    }

    @Test
    void hanTraLaNuaDemSauNgayThuBa() {
        assertEquals(vn("2026-12-02T00:00"), TraHangQuyTac.hanTraDen(vn("2026-11-28T18:42")));
        assertEquals(vn("2026-12-02T00:00"), TraHangQuyTac.hanTraDen(vn("2026-11-28T00:05")));
        assertNull(TraHangQuyTac.hanTraDen(null));
    }

    @Test
    void muaBuoiToiVanTraDuocTrongNgayCuoiSauGioMua() {
        Instant mua = vn("2026-11-28T18:42");
        assertFalse(TraHangQuyTac.quaHan(mua, vn("2026-12-01T20:00")));
        assertFalse(TraHangQuyTac.quaHan(mua, vn("2026-12-01T23:59:59")));
        assertTrue(TraHangQuyTac.quaHan(mua, vn("2026-12-02T00:00")));
    }

    @Test
    void khongRoLucThanhToanThiQuaHan() {
        assertTrue(TraHangQuyTac.quaHan(null, vn("2026-11-28T10:00")));
    }

    @Test
    void soNgayDaQuaDemTheoNgayLich() {
        Instant mua = vn("2026-11-28T23:50");
        assertEquals(0, TraHangQuyTac.soNgayDaQua(mua, vn("2026-11-28T23:59")));
        assertEquals(1, TraHangQuyTac.soNgayDaQua(mua, vn("2026-11-29T00:10")));
        assertEquals(3, TraHangQuyTac.soNgayDaQua(mua, vn("2026-12-01T12:00")));
        assertEquals(0, TraHangQuyTac.soNgayDaQua(null, vn("2026-12-01T12:00")));
    }

    @Test
    void danhSachConHanTuDauNgayHomNayTruBa() {
        assertEquals(vn("2026-11-28T00:00"), TraHangQuyTac.conHanTu(vn("2026-12-01T09:30")));
        // Mốc lọc danh sách khớp quaHan: hóa đơn đầu ngày 28/11 vẫn còn hạn ngày 01/12
        assertFalse(TraHangQuyTac.quaHan(vn("2026-11-28T00:00"), vn("2026-12-01T23:00")));
    }
}
