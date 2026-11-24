package com.dev.backend.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PhoneNormalizationReportTest {
    @Test
    void UT_PHONE_001() {
        String value = "0912345678";
        String expected = "0912345678";
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_001", "chuanHoa", "value", value, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.chuanHoa(value)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_PHONE_002() {
        String value = " (091) 234-5.678 ";
        String expected = "0912345678";
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_002", "chuanHoa", "value", value, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.chuanHoa(value)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_PHONE_003() {
        String value = "+84912345678";
        String expected = "0912345678";
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_003", "chuanHoa", "value", value, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.chuanHoa(value)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_PHONE_004() {
        String value = " ";
        String expected = null;
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_004", "chuanHoa", "value", value, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.chuanHoa(value)));
            assertNull(actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_PHONE_005() {
        String value = null;
        String expected = null;
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_005", "chuanHoa", "value", value, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.chuanHoa(value)));
            assertNull(actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_PHONE_006() {
        String tuKhoa = "+84 912 345 678";
        String expected = "0912345678";
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_006", "choTimKiem", "tuKhoa", tuKhoa, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.choTimKiem(tuKhoa)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_PHONE_007() {
        String tuKhoa = "84912345678";
        String expected = "0912345678";
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_007", "choTimKiem", "tuKhoa", tuKhoa, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.choTimKiem(tuKhoa)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_PHONE_008() {
        String tuKhoa = "0912";
        String expected = "0912";
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_008", "choTimKiem", "tuKhoa", tuKhoa, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.choTimKiem(tuKhoa)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_PHONE_009() {
        String tuKhoa = "091";
        String expected = null;
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_009", "choTimKiem", "tuKhoa", tuKhoa, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.choTimKiem(tuKhoa)));
            assertNull(actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_PHONE_010() {
        String tuKhoa = "0912ABC678";
        String expected = null;
        try (var walkthrough = new PhoneReportWalkthrough("UT_PHONE_010", "choTimKiem", "tuKhoa", tuKhoa, expected)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> SoDienThoai.choTimKiem(tuKhoa)));
            assertNull(actual);
            walkthrough.passed();
        }
    }
}
