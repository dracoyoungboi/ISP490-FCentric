package com.dev.backend.utils;

import com.dev.backend.utils.PhanBoLoFifo.Lo;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PhanBoLoFifoChiaChoDonReportTest {

    private static final String ASSERTIONS = "Result is not null; exact key count and key set; key iteration order matches; "
            + "each order list is not null; exact list size; lot IDs match in order; quantities match using BigDecimal.compareTo.";

    private static Lo lo(int id, String soLuong) {
        return new Lo(id, new BigDecimal(soLuong));
    }

    private static void assertPhanBo(Map<String, List<Lo>> ketQua, LinkedHashMap<String, List<Lo>> mongDoi) {
        assertNotNull(ketQua);
        assertEquals(mongDoi.size(), ketQua.size());
        assertEquals(mongDoi.keySet(), ketQua.keySet());
        assertEquals(new ArrayList<>(mongDoi.keySet()), new ArrayList<>(ketQua.keySet()));
        for (Map.Entry<String, List<Lo>> don : mongDoi.entrySet()) {
            List<Lo> thucTe = ketQua.get(don.getKey());
            assertNotNull(thucTe);
            assertEquals(don.getValue().size(), thucTe.size());
            for (int i = 0; i < don.getValue().size(); i++) {
                Lo lo = thucTe.get(i);
                assertNotNull(lo);
                assertEquals(don.getValue().get(i).loHangId(), lo.loHangId());
                assertNotNull(lo.soLuong());
                assertEquals(0, don.getValue().get(i).soLuong().compareTo(lo.soLuong()));
            }
        }
    }

    private static BigDecimal tongTheoLo(Map<String, List<Lo>> ketQua, int loHangId) {
        return ketQua.values().stream().flatMap(List::stream)
                .filter(lo -> lo.loHangId().equals(loHangId))
                .map(Lo::soLuong).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Test
    void UT_FIFO_015() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "3"), lo(2, "5"));
        LinkedHashMap<String, BigDecimal> canTheoDon = new LinkedHashMap<>();
        canTheoDon.put("A", new BigDecimal("2"));
        canTheoDon.put("B", new BigDecimal("4"));
        LinkedHashMap<String, List<Lo>> mongDoi = new LinkedHashMap<>();
        mongDoi.put("A", List.of(lo(1, "2")));
        mongDoi.put("B", List.of(lo(1, "1"), lo(2, "3")));

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.beginOrders(
                "UT_FIFO_015", getClass().getName(), phanBoTheoFifo, canTheoDon, mongDoi, ASSERTIONS)) {
            Map<String, List<Lo>> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.chiaChoDon(phanBoTheoFifo, canTheoDon)));

            assertPhanBo(ketQua, mongDoi);
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_016() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "3"), lo(2, "5"));
        LinkedHashMap<String, BigDecimal> canTheoDon = new LinkedHashMap<>();
        canTheoDon.put("A", new BigDecimal("0"));
        canTheoDon.put("B", new BigDecimal("2"));
        LinkedHashMap<String, List<Lo>> mongDoi = new LinkedHashMap<>();
        mongDoi.put("A", List.of());
        mongDoi.put("B", List.of(lo(1, "2")));

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.beginOrders(
                "UT_FIFO_016", getClass().getName(), phanBoTheoFifo, canTheoDon, mongDoi,
                ASSERTIONS + " Key A exists and its allocation is empty.")) {
            Map<String, List<Lo>> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.chiaChoDon(phanBoTheoFifo, canTheoDon)));

            assertPhanBo(ketQua, mongDoi);
            assertTrue(ketQua.containsKey("A"));
            assertTrue(ketQua.get("A").isEmpty());
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_017() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "3"));
        LinkedHashMap<String, BigDecimal> canTheoDon = new LinkedHashMap<>();
        LinkedHashMap<String, List<Lo>> mongDoi = new LinkedHashMap<>();

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.beginOrders(
                "UT_FIFO_017", getClass().getName(), phanBoTheoFifo, canTheoDon, mongDoi, ASSERTIONS)) {
            Map<String, List<Lo>> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.chiaChoDon(phanBoTheoFifo, canTheoDon)));

            assertPhanBo(ketQua, mongDoi);
            assertTrue(ketQua.isEmpty());
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_018() {
        List<Lo> phanBoTheoFifo = List.of();
        LinkedHashMap<String, BigDecimal> canTheoDon = new LinkedHashMap<>();
        canTheoDon.put("A", new BigDecimal("2"));
        LinkedHashMap<String, List<Lo>> mongDoi = new LinkedHashMap<>();
        mongDoi.put("A", List.of());

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.beginOrders(
                "UT_FIFO_018", getClass().getName(), phanBoTheoFifo, canTheoDon, mongDoi,
                ASSERTIONS + " Key A exists even when no lots are available.")) {
            Map<String, List<Lo>> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.chiaChoDon(phanBoTheoFifo, canTheoDon)));

            assertPhanBo(ketQua, mongDoi);
            assertTrue(ketQua.containsKey("A"));
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_019() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "3"), lo(2, "5"));
        LinkedHashMap<String, BigDecimal> canTheoDon = new LinkedHashMap<>();
        canTheoDon.put("A", new BigDecimal("6"));
        canTheoDon.put("B", new BigDecimal("6"));
        LinkedHashMap<String, List<Lo>> mongDoi = new LinkedHashMap<>();
        mongDoi.put("A", List.of(lo(1, "3"), lo(2, "3")));
        mongDoi.put("B", List.of(lo(2, "2")));

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.beginOrders(
                "UT_FIFO_019", getClass().getName(), phanBoTheoFifo, canTheoDon, mongDoi,
                ASSERTIONS + " Total allocation is 8; lot 1 total is 3; lot 2 total is 5. Insufficient allocation does not throw.")) {
            Map<String, List<Lo>> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.chiaChoDon(phanBoTheoFifo, canTheoDon)));

            assertPhanBo(ketQua, mongDoi);
            BigDecimal tong = ketQua.values().stream().flatMap(List::stream)
                    .map(Lo::soLuong).reduce(BigDecimal.ZERO, BigDecimal::add);
            assertEquals(0, new BigDecimal("8").compareTo(tong));
            assertEquals(0, new BigDecimal("3").compareTo(tongTheoLo(ketQua, 1)));
            assertEquals(0, new BigDecimal("5").compareTo(tongTheoLo(ketQua, 2)));
            walkthrough.passed();
        }
    }

    @Test
    void UT_FIFO_020() {
        List<Lo> phanBoTheoFifo = List.of(lo(1, "2"), lo(1, "3"));
        LinkedHashMap<String, BigDecimal> canTheoDon = new LinkedHashMap<>();
        canTheoDon.put("A", new BigDecimal("5"));
        LinkedHashMap<String, List<Lo>> mongDoi = new LinkedHashMap<>();
        mongDoi.put("A", List.of(lo(1, "5")));

        try (FifoReportWalkthrough walkthrough = FifoReportWalkthrough.beginOrders(
                "UT_FIFO_020", getClass().getName(), phanBoTheoFifo, canTheoDon, mongDoi,
                ASSERTIONS + " A has exactly one allocation entry; consecutive entries for lot 1 are merged.")) {
            Map<String, List<Lo>> ketQua = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> PhanBoLoFifo.chiaChoDon(phanBoTheoFifo, canTheoDon)));

            assertPhanBo(ketQua, mongDoi);
            assertEquals(1, ketQua.get("A").size());
            walkthrough.passed();
        }
    }
}
