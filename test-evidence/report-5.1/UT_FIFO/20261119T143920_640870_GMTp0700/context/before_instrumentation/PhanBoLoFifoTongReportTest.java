package com.dev.backend.utils;

import com.dev.backend.utils.PhanBoLoFifo.Lo;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class PhanBoLoFifoTongReportTest {

    @Test
    void UT_FIFO_001() {
        List<Lo> danhSach = List.of();

        BigDecimal ketQua = assertDoesNotThrow(() -> PhanBoLoFifo.tong(danhSach));

        assertNotNull(ketQua);
        assertEquals(0, BigDecimal.ZERO.compareTo(ketQua));
    }

    @Test
    void UT_FIFO_002() {
        List<Lo> danhSach = List.of(
                new Lo(1, new BigDecimal("2")),
                new Lo(2, new BigDecimal("3")),
                new Lo(3, new BigDecimal("4"))
        );

        BigDecimal ketQua = assertDoesNotThrow(() -> PhanBoLoFifo.tong(danhSach));

        assertNotNull(ketQua);
        assertEquals(0, new BigDecimal("9").compareTo(ketQua));
    }
}
