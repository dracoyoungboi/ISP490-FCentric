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

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.begin(
                "UT_FIFO_001", "tong", getClass().getName(), danhSach, null,
                BigDecimal.ZERO,
                "Result is not null; numeric value equals expected using BigDecimal.compareTo.")) {
            BigDecimal ketQua = assertDoesNotThrow(() -> walkthrough.execute(() -> PhanBoLoFifo.tong(danhSach)));

            assertNotNull(ketQua);
            assertEquals(0, BigDecimal.ZERO.compareTo(ketQua));
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_002() {
        List<Lo> danhSach = List.of(
                new Lo(1, new BigDecimal("2")),
                new Lo(2, new BigDecimal("3")),
                new Lo(3, new BigDecimal("4"))
        );

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.begin(
                "UT_FIFO_002", "tong", getClass().getName(), danhSach, null,
                new BigDecimal("9"),
                "Result is not null; numeric value equals expected using BigDecimal.compareTo.")) {
            BigDecimal ketQua = assertDoesNotThrow(() -> walkthrough.execute(() -> PhanBoLoFifo.tong(danhSach)));

            assertNotNull(ketQua);
            assertEquals(0, new BigDecimal("9").compareTo(ketQua));
            walkthrough.passed();
        }
    }
}
