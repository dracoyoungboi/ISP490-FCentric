package com.dev.backend.utils;

import com.dev.backend.utils.PhanBoLoFifo.Lo;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class PhanBoLoFifoLayFifoReportTest {

    private static Lo lo(int id, String soLuong) {
        return new Lo(id, new BigDecimal(soLuong));
    }

    private static void assertLos(List<Lo> ketQua, Lo... mongDoi) {
        assertNotNull(ketQua);
        assertEquals(mongDoi.length, ketQua.size());
        for (int i = 0; i < mongDoi.length; i++) {
            Lo lo = ketQua.get(i);
            assertNotNull(lo);
            assertEquals(mongDoi[i].loHangId(), lo.loHangId());
            assertNotNull(lo.soLuong());
            assertEquals(0, mongDoi[i].soLuong().compareTo(lo.soLuong()));
        }
    }

    @Test
    void UT_FIFO_003() {
        List<Lo> danhSach = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal can = new BigDecimal("2");

        List<Lo> ketQua = assertDoesNotThrow(() -> PhanBoLoFifo.layFifo(danhSach, can));

        assertLos(ketQua, lo(1, "2"));
    }

    @Test
    void UT_FIFO_004() {
        List<Lo> danhSach = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal can = new BigDecimal("4");

        List<Lo> ketQua = assertDoesNotThrow(() -> PhanBoLoFifo.layFifo(danhSach, can));

        assertLos(ketQua, lo(1, "3"), lo(2, "1"));
    }

    @Test
    void UT_FIFO_005() {
        List<Lo> danhSach = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal can = new BigDecimal("3");

        List<Lo> ketQua = assertDoesNotThrow(() -> PhanBoLoFifo.layFifo(danhSach, can));

        assertLos(ketQua, lo(1, "3"));
    }

    @Test
    void UT_FIFO_006() {
        List<Lo> danhSach = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal can = new BigDecimal("0");

        List<Lo> ketQua = assertDoesNotThrow(() -> PhanBoLoFifo.layFifo(danhSach, can));

        assertLos(ketQua);
    }

    @Test
    void UT_FIFO_007() {
        List<Lo> danhSach = List.of();
        BigDecimal can = new BigDecimal("3");

        List<Lo> ketQua = assertDoesNotThrow(() -> PhanBoLoFifo.layFifo(danhSach, can));

        assertLos(ketQua);
    }

    @Test
    void UT_FIFO_008() {
        List<Lo> danhSach = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal can = new BigDecimal("9");

        List<Lo> ketQua = assertDoesNotThrow(() -> PhanBoLoFifo.layFifo(danhSach, can));

        assertLos(ketQua, lo(1, "3"), lo(2, "5"));
        BigDecimal tong = ketQua.stream().map(Lo::soLuong).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(0, new BigDecimal("8").compareTo(tong));
    }

    @Test
    void UT_FIFO_009() {
        List<Lo> danhSach = List.of(
                new Lo(1, new BigDecimal("0")),
                new Lo(2, new BigDecimal("-2")),
                new Lo(3, new BigDecimal("4"))
        );
        BigDecimal can = new BigDecimal("2");

        List<Lo> ketQua = assertDoesNotThrow(() -> PhanBoLoFifo.layFifo(danhSach, can));

        assertNotNull(ketQua);
        assertEquals(1, ketQua.size());
        Lo lo = ketQua.get(0);
        assertNotNull(lo);
        assertEquals(Integer.valueOf(3), lo.loHangId());
        assertNotNull(lo.soLuong());
        assertEquals(0, new BigDecimal("2").compareTo(lo.soLuong()));
    }
}
