package com.dev.backend.utils;

import com.dev.backend.utils.PhanBoLoFifo.Lo;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class PhanBoLoFifoCatReportTest {

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
    void UT_FIFO_010() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal moi = new BigDecimal("6");

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.begin(
                "UT_FIFO_010", "catTuLoMoiNhat", getClass().getName(), phanBoTheoFifo, moi,
                List.of(lo(1, "3"), lo(2, "3")),
                "Result is not null; exact list size; lot IDs match in order; each quantity matches using BigDecimal.compareTo.")) {
            List<Lo> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.catTuLoMoiNhat(phanBoTheoFifo, moi)));

            assertLos(ketQua, lo(1, "3"), lo(2, "3"));
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_011() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal moi = new BigDecimal("2");

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.begin(
                "UT_FIFO_011", "catTuLoMoiNhat", getClass().getName(), phanBoTheoFifo, moi,
                List.of(lo(1, "2")),
                "Result is not null; exact list size; lot IDs match in order; each quantity matches using BigDecimal.compareTo.")) {
            List<Lo> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.catTuLoMoiNhat(phanBoTheoFifo, moi)));

            assertLos(ketQua, lo(1, "2"));
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_012() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal moi = new BigDecimal("0");

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.begin(
                "UT_FIFO_012", "catTuLoMoiNhat", getClass().getName(), phanBoTheoFifo, moi,
                List.of(),
                "Result is not null; exact list size; lot IDs match in order; each quantity matches using BigDecimal.compareTo.")) {
            List<Lo> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.catTuLoMoiNhat(phanBoTheoFifo, moi)));

            assertLos(ketQua);
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_013() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal moi = new BigDecimal("8");

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.begin(
                "UT_FIFO_013", "catTuLoMoiNhat", getClass().getName(), phanBoTheoFifo, moi,
                List.of(lo(1, "3"), lo(2, "5")),
                "Result is not null; exact list size; lot IDs match in order; each quantity matches using BigDecimal.compareTo.")) {
            List<Lo> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.catTuLoMoiNhat(phanBoTheoFifo, moi)));

            assertLos(ketQua, lo(1, "3"), lo(2, "5"));
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_014() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "3"), lo(2, "5"));
        BigDecimal moi = new BigDecimal("9");

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.begin(
                "UT_FIFO_014", "catTuLoMoiNhat", getClass().getName(), phanBoTheoFifo, moi,
                List.of(lo(1, "3"), lo(2, "5")),
                "Result is not null; exact list size; lot IDs match in order; each quantity matches using BigDecimal.compareTo. The existing allocation remains 8 and is not increased to 9.")) {
            List<Lo> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.catTuLoMoiNhat(phanBoTheoFifo, moi)));

            assertLos(ketQua, lo(1, "3"), lo(2, "5"));
            walkthrough.passed();
        }
    }
}
