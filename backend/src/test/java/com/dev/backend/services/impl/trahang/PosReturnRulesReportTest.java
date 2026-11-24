package com.dev.backend.services.impl.trahang;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class PosReturnRulesReportTest {

    @Test
    void UT_RETURN_001() {
        Instant thanhToanLuc = Instant.parse("2026-11-01T03:00:00Z");
        Instant bayGio = Instant.parse("2026-11-03T03:00:00Z");
        Boolean expected = Boolean.FALSE;
        LinkedHashMap<String, Object> input = new LinkedHashMap<>();
        input.put("thanhToanLuc", thanhToanLuc);
        input.put("bayGio", bayGio);

        try (ReturnReportWalkthrough walkthrough = ReturnReportWalkthrough.begin(
                "UT_RETURN_001", "quaHan", getClass().getName(), input, expected)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(
                    () -> TraHangQuyTac.quaHan(thanhToanLuc, bayGio)));

            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_RETURN_002() {
        Instant thanhToanLuc = Instant.parse("2026-11-01T03:00:00Z");
        Instant bayGio = Instant.parse("2026-11-04T03:00:00Z");
        Boolean expected = Boolean.FALSE;
        LinkedHashMap<String, Object> input = new LinkedHashMap<>();
        input.put("thanhToanLuc", thanhToanLuc);
        input.put("bayGio", bayGio);

        try (ReturnReportWalkthrough walkthrough = ReturnReportWalkthrough.begin(
                "UT_RETURN_002", "quaHan", getClass().getName(), input, expected)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(
                    () -> TraHangQuyTac.quaHan(thanhToanLuc, bayGio)));

            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_RETURN_003() {
        Instant thanhToanLuc = Instant.parse("2026-11-01T03:00:00Z");
        Instant bayGio = Instant.parse("2026-11-04T03:00:01Z");
        Boolean expected = Boolean.TRUE;
        LinkedHashMap<String, Object> input = new LinkedHashMap<>();
        input.put("thanhToanLuc", thanhToanLuc);
        input.put("bayGio", bayGio);

        try (ReturnReportWalkthrough walkthrough = ReturnReportWalkthrough.begin(
                "UT_RETURN_003", "quaHan", getClass().getName(), input, expected)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(
                    () -> TraHangQuyTac.quaHan(thanhToanLuc, bayGio)));

            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_RETURN_004() {
        BigDecimal thanhTien = new BigDecimal("240000");
        BigDecimal giamGia = new BigDecimal("40000");
        BigDecimal soLuongMua = new BigDecimal("2");
        BigDecimal expected = new BigDecimal("100000");
        LinkedHashMap<String, Object> input = new LinkedHashMap<>();
        input.put("thanhTien", thanhTien);
        input.put("giamGia", giamGia);
        input.put("soLuongMua", soLuongMua);

        try (ReturnReportWalkthrough walkthrough = ReturnReportWalkthrough.begin(
                "UT_RETURN_004", "donGiaThucTra", getClass().getName(), input, expected)) {
            BigDecimal actual = assertDoesNotThrow(() -> walkthrough.execute(
                    () -> TraHangQuyTac.donGiaThucTra(thanhTien, giamGia, soLuongMua)));

            assertNotNull(actual);
            assertEquals(0, expected.compareTo(actual));
            walkthrough.passed();
        }
    }

    @Test
    void UT_RETURN_005() {
        BigDecimal thanhTien = new BigDecimal("100000");
        BigDecimal giamGia = new BigDecimal("0");
        BigDecimal soLuongMua = new BigDecimal("3");
        BigDecimal expected = new BigDecimal("33333");
        LinkedHashMap<String, Object> input = new LinkedHashMap<>();
        input.put("thanhTien", thanhTien);
        input.put("giamGia", giamGia);
        input.put("soLuongMua", soLuongMua);

        try (ReturnReportWalkthrough walkthrough = ReturnReportWalkthrough.begin(
                "UT_RETURN_005", "donGiaThucTra", getClass().getName(), input, expected)) {
            BigDecimal actual = assertDoesNotThrow(() -> walkthrough.execute(
                    () -> TraHangQuyTac.donGiaThucTra(thanhTien, giamGia, soLuongMua)));

            assertNotNull(actual);
            assertEquals(0, expected.compareTo(actual));
            walkthrough.passed();
        }
    }

    @Test
    void UT_RETURN_009() {
        String stk = "1234567890";
        Boolean expected = Boolean.TRUE;
        LinkedHashMap<String, Object> input = new LinkedHashMap<>();
        input.put("stk", stk);

        try (ReturnReportWalkthrough walkthrough = ReturnReportWalkthrough.begin(
                "UT_RETURN_009", "soTaiKhoanHopLe", getClass().getName(), input, expected)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(
                    () -> TraHangQuyTac.soTaiKhoanHopLe(stk)));

            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_RETURN_010() {
        String stk = "12345";
        Boolean expected = Boolean.FALSE;
        LinkedHashMap<String, Object> input = new LinkedHashMap<>();
        input.put("stk", stk);

        try (ReturnReportWalkthrough walkthrough = ReturnReportWalkthrough.begin(
                "UT_RETURN_010", "soTaiKhoanHopLe", getClass().getName(), input, expected)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(
                    () -> TraHangQuyTac.soTaiKhoanHopLe(stk)));

            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_RETURN_011() {
        String stk = "12345A";
        Boolean expected = Boolean.FALSE;
        LinkedHashMap<String, Object> input = new LinkedHashMap<>();
        input.put("stk", stk);

        try (ReturnReportWalkthrough walkthrough = ReturnReportWalkthrough.begin(
                "UT_RETURN_011", "soTaiKhoanHopLe", getClass().getName(), input, expected)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(
                    () -> TraHangQuyTac.soTaiKhoanHopLe(stk)));

            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }
}
