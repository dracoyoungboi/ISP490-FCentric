package com.dev.backend.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FullNameValidationReportTest {
    @Test
    void UT_NAME_001() {
        String chuoi = " Nguyễn Văn An ";
        String inputExpression = "\" Nguyễn Văn An \"";
        String expected = "Nguyễn Văn An";
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_001", "chuanHoa", chuoi, inputExpression, expected, "literal")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.chuanHoa(chuoi)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_002() {
        String chuoi = "Nguye\u0302\u0303n\u200B An";
        String inputExpression = "\"Nguye\\u0302\\u0303n\\u200B An\"";
        String expected = "Nguyễn An";
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_002", "chuanHoa", chuoi, inputExpression, expected, "literal")) {
            assertTrue(chuoi.contains("\u0302"));
            assertTrue(chuoi.contains("\u0303"));
            assertTrue(chuoi.contains("\u200B"));
            assertFalse(chuoi.contains("\\u0302"));
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.chuanHoa(chuoi)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_003() {
        String chuoi = "Nguyễn Văn An";
        String inputExpression = "\"Nguyễn Văn An\"";
        String expected = null;
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_003", "loi", chuoi, inputExpression, expected, "null")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.loi(chuoi)));
            assertNull(actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_004() {
        String chuoi = "Anne-Marie O’Neil";
        String inputExpression = "\"Anne-Marie O’Neil\"";
        String expected = null;
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_004", "loi", chuoi, inputExpression, expected, "null")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.loi(chuoi)));
            assertNull(actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_005() {
        String chuoi = " ";
        String inputExpression = "\" \"";
        String expected = HoTen.LOI_TRONG;
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_005", "loi", chuoi, inputExpression, expected, "HoTen.LOI_TRONG")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.loi(chuoi)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_006() {
        String chuoi = "A";
        String inputExpression = "\"A\"";
        String expected = HoTen.LOI_NGAN;
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_006", "loi", chuoi, inputExpression, expected, "HoTen.LOI_NGAN")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.loi(chuoi)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_007() {
        String chuoi = "An";
        String inputExpression = "\"An\"";
        String expected = null;
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_007", "loi", chuoi, inputExpression, expected, "null")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.loi(chuoi)));
            assertNull(actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_008() {
        String chuoi = "A".repeat(100);
        String inputExpression = "\"A\".repeat(100)";
        String expected = null;
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_008", "loi", chuoi, inputExpression, expected, "null")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.loi(chuoi)));
            assertNull(actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_009() {
        String chuoi = "A".repeat(101);
        String inputExpression = "\"A\".repeat(101)";
        String expected = HoTen.LOI_DAI;
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_009", "loi", chuoi, inputExpression, expected, "HoTen.LOI_DAI")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.loi(chuoi)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_010() {
        String chuoi = "1Nguyễn Văn An";
        String inputExpression = "\"1Nguyễn Văn An\"";
        String expected = HoTen.LOI_KY_TU;
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_010", "loi", chuoi, inputExpression, expected, "HoTen.LOI_KY_TU")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.loi(chuoi)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_NAME_011() {
        String chuoi = "Nguyễn @ An";
        String inputExpression = "\"Nguyễn @ An\"";
        String expected = HoTen.LOI_KY_TU;
        try (var walkthrough = new FullNameReportWalkthrough("UT_NAME_011", "loi", chuoi, inputExpression, expected, "HoTen.LOI_KY_TU")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> HoTen.loi(chuoi)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }
}
