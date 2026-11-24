package com.dev.backend.services.impl.ketoan;

import com.dev.backend.i18n.LoiThamSoException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrowsExactly;

class TachThueVatReportTest {

    private static final String PROVISIONAL = "Provisional input - tax rate requires confirmation";
    private static final String CONFIRMED = "Source-confirmed fixture - repository test evidence";

    private static BigDecimal n(String value) {
        return new BigDecimal(value);
    }

    private static void assertDecimal(String field, BigDecimal expected, BigDecimal actual) {
        assertNotNull(actual, field);
        assertEquals(0, expected.compareTo(actual), field);
    }

    private static void assertDong(TachThue.Dong actual, TachThue.Dong expected) {
        assertNotNull(actual);
        assertAll("Dong numeric fields",
                () -> assertDecimal("donGia", expected.donGia(), actual.donGia()),
                () -> assertDecimal("thanhTien", expected.thanhTien(), actual.thanhTien()),
                () -> assertDecimal("chietKhau", expected.chietKhau(), actual.chietKhau()),
                () -> assertDecimal("tienThue", expected.tienThue(), actual.tienThue()));
    }

    private static void assertKey(LoiThamSoException actual, String expectedKey) {
        assertNotNull(actual);
        assertNotNull(actual.getThongDiep());
        assertEquals(expectedKey, actual.getThongDiep().khoa());
    }

    @Test
    void UT_VAT_001() {
        BigDecimal soLuong = n("1");
        BigDecimal tienGomThue = n("120000");
        BigDecimal giamGiaGomThue = n("0");
        BigDecimal thueSuat = n("8");
        TachThue.Dong expected = new TachThue.Dong(n("111111"), n("111111"), n("0"), n("8889"));

        try (VatReportWalkthrough walkthrough = VatReportWalkthrough.value(
                "UT_VAT_001", getClass().getName(), soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                PROVISIONAL, "Inferred from the supplied expected fields; no exact repository fixture confirms this case rate.", expected)) {
            TachThue.Dong actual = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat)));

            assertDong(actual, expected);
            walkthrough.passed();
        }
    }

    @Test
    void UT_VAT_002() {
        BigDecimal soLuong = n("2");
        BigDecimal tienGomThue = n("220000");
        BigDecimal giamGiaGomThue = n("22000");
        BigDecimal thueSuat = n("10");
        TachThue.Dong expected = new TachThue.Dong(n("100000"), n("200000"), n("20000"), n("18000"));

        try (VatReportWalkthrough walkthrough = VatReportWalkthrough.value(
                "UT_VAT_002", getClass().getName(), soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                CONFIRMED, "Report51TAXTest.UT_TAX_002 uses the same input, expected fields and thueSuat=10.", expected)) {
            TachThue.Dong actual = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat)));

            assertDong(actual, expected);
            walkthrough.passed();
        }
    }

    @Test
    void UT_VAT_003() {
        BigDecimal soLuong = n("1");
        BigDecimal tienGomThue = n("120000");
        BigDecimal giamGiaGomThue = n("0");
        BigDecimal thueSuat = n("0");
        TachThue.Dong expected = new TachThue.Dong(n("120000"), n("120000"), n("0"), n("0"));

        try (VatReportWalkthrough walkthrough = VatReportWalkthrough.value(
                "UT_VAT_003", getClass().getName(), soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                PROVISIONAL, "Inferred from the supplied expected fields; no exact repository fixture confirms this case rate.", expected)) {
            TachThue.Dong actual = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat)));

            assertDong(actual, expected);
            walkthrough.passed();
        }
    }

    @Test
    void UT_VAT_004() {
        BigDecimal soLuong = n("1");
        BigDecimal tienGomThue = n("120000");
        BigDecimal giamGiaGomThue = n("120000");
        BigDecimal thueSuat = n("8");
        TachThue.Dong expected = new TachThue.Dong(n("111111"), n("111111"), n("111111"), n("0"));

        try (VatReportWalkthrough walkthrough = VatReportWalkthrough.value(
                "UT_VAT_004", getClass().getName(), soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                PROVISIONAL, "Inferred from the supplied expected fields; no exact repository fixture confirms this case rate.", expected)) {
            TachThue.Dong actual = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat)));

            assertDong(actual, expected);
            walkthrough.passed();
        }
    }

    @Test
    void UT_VAT_005() {
        BigDecimal soLuong = n("3");
        BigDecimal tienGomThue = n("100");
        BigDecimal giamGiaGomThue = n("0");
        BigDecimal thueSuat = n("8");
        TachThue.Dong expected = new TachThue.Dong(n("31"), n("93"), n("0"), n("7"));

        try (VatReportWalkthrough walkthrough = VatReportWalkthrough.value(
                "UT_VAT_005", getClass().getName(), soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                PROVISIONAL, "Inferred from the supplied expected fields; no exact repository fixture confirms this case rate.", expected)) {
            TachThue.Dong actual = assertDoesNotThrow(
                    () -> walkthrough.execute(() -> TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat)));

            assertDong(actual, expected);
            walkthrough.passed();
        }
    }

    @Test
    void UT_VAT_006() {
        BigDecimal soLuong = n("0");
        BigDecimal tienGomThue = n("120000");
        BigDecimal giamGiaGomThue = n("0");
        BigDecimal thueSuat = n("8");
        String expectedKey = "keToanDuLieuVao.soLuongPhaiLonHon0";

        try (VatReportWalkthrough walkthrough = VatReportWalkthrough.error(
                "UT_VAT_006", getClass().getName(), soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                PROVISIONAL, "Proposed 8% to isolate the invalid input, as requested; no exact repository fixture confirms this rate.", LoiThamSoException.class, expectedKey)) {
            LoiThamSoException actual = assertThrowsExactly(LoiThamSoException.class,
                    () -> walkthrough.execute(() -> TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat)));

            assertKey(actual, expectedKey);
            walkthrough.passed();
        }
    }

    @Test
    void UT_VAT_007() {
        BigDecimal soLuong = n("1");
        BigDecimal tienGomThue = n("-120000");
        BigDecimal giamGiaGomThue = n("0");
        BigDecimal thueSuat = n("8");
        String expectedKey = "keToanDuLieuVao.tienHoacGiamGiaSai";

        try (VatReportWalkthrough walkthrough = VatReportWalkthrough.error(
                "UT_VAT_007", getClass().getName(), soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                PROVISIONAL, "Proposed 8% to isolate the invalid input, as requested; no exact repository fixture confirms this rate.", LoiThamSoException.class, expectedKey)) {
            LoiThamSoException actual = assertThrowsExactly(LoiThamSoException.class,
                    () -> walkthrough.execute(() -> TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat)));

            assertKey(actual, expectedKey);
            walkthrough.passed();
        }
    }

    @Test
    void UT_VAT_008() {
        BigDecimal soLuong = n("1");
        BigDecimal tienGomThue = n("120000");
        BigDecimal giamGiaGomThue = n("-10000");
        BigDecimal thueSuat = n("8");
        String expectedKey = "keToanDuLieuVao.tienHoacGiamGiaSai";

        try (VatReportWalkthrough walkthrough = VatReportWalkthrough.error(
                "UT_VAT_008", getClass().getName(), soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                PROVISIONAL, "Proposed 8% to isolate the invalid input, as requested; no exact repository fixture confirms this rate.", LoiThamSoException.class, expectedKey)) {
            LoiThamSoException actual = assertThrowsExactly(LoiThamSoException.class,
                    () -> walkthrough.execute(() -> TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat)));

            assertKey(actual, expectedKey);
            walkthrough.passed();
        }
    }

    @Test
    void UT_VAT_009() {
        BigDecimal soLuong = n("1");
        BigDecimal tienGomThue = n("120000");
        BigDecimal giamGiaGomThue = n("130000");
        BigDecimal thueSuat = n("8");
        String expectedKey = "keToanDuLieuVao.tienHoacGiamGiaSai";

        try (VatReportWalkthrough walkthrough = VatReportWalkthrough.error(
                "UT_VAT_009", getClass().getName(), soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                PROVISIONAL, "Proposed 8% to isolate the invalid input, as requested; no exact repository fixture confirms this rate.", LoiThamSoException.class, expectedKey)) {
            LoiThamSoException actual = assertThrowsExactly(LoiThamSoException.class,
                    () -> walkthrough.execute(() -> TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat)));

            assertKey(actual, expectedKey);
            walkthrough.passed();
        }
    }
}
