package com.dev.backend.utils;

import com.dev.backend.i18n.LoiThamSoException;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;

import static org.junit.jupiter.api.Assertions.*;

class VariantBarcodeReportTest {
    private static final String BOOLEAN_ASSERTIONS = "No exception; non-null Boolean; exact assertEquals(expected, actual).";
    private static final String STRING_ASSERTIONS = "No exception; non-null String; exact assertEquals(expected, actual); no actual postprocessing or numeric conversion.";

    @Test
    void UT_BARCODE_001() {
        String tienTo = "20";
        Boolean expected = Boolean.TRUE;
        var input = new LinkedHashMap<String, Object>();
        input.put("tienTo", tienTo);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_001", "laTienToHopLe", input, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.laTienToHopLe(tienTo)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_002() {
        String tienTo = "2";
        Boolean expected = Boolean.FALSE;
        var input = new LinkedHashMap<String, Object>();
        input.put("tienTo", tienTo);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_002", "laTienToHopLe", input, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.laTienToHopLe(tienTo)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_003() {
        String tienTo = "200";
        Boolean expected = Boolean.FALSE;
        var input = new LinkedHashMap<String, Object>();
        input.put("tienTo", tienTo);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_003", "laTienToHopLe", input, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.laTienToHopLe(tienTo)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_004() {
        String tienTo = "2A";
        Boolean expected = Boolean.FALSE;
        var input = new LinkedHashMap<String, Object>();
        input.put("tienTo", tienTo);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_004", "laTienToHopLe", input, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.laTienToHopLe(tienTo)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_005() {
        String giaTriCauHinh = " 29 ";
        String expected = "29";
        var input = new LinkedHashMap<String, Object>();
        input.put("giaTriCauHinh", giaTriCauHinh);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_005", "tienToDung", input, expected, STRING_ASSERTIONS)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.tienToDung(giaTriCauHinh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_006() {
        String giaTriCauHinh = null;
        String expected = "20";
        var input = new LinkedHashMap<String, Object>();
        input.put("giaTriCauHinh", giaTriCauHinh);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_006", "tienToDung", input, expected, STRING_ASSERTIONS)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.tienToDung(giaTriCauHinh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_007() {
        String giaTriCauHinh = "2A";
        String expected = "20";
        var input = new LinkedHashMap<String, Object>();
        input.put("giaTriCauHinh", giaTriCauHinh);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_007", "tienToDung", input, expected, STRING_ASSERTIONS)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.tienToDung(giaTriCauHinh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_008() {
        String tienTo = "29";
        int bienTheId = 150;
        String expected = "2900000150";
        var input = new LinkedHashMap<String, Object>();
        input.put("tienTo", tienTo);
        input.put("bienTheId", bienTheId);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_008", "sinh", input, expected, STRING_ASSERTIONS + " Length must equal 10.")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.sinh(tienTo, bienTheId)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            assertEquals(10, actual.length());
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_009() {
        String tienTo = "20";
        int bienTheId = 0;
        // Expected recovered by exact function/input from Report51BARCODETest.UT_BARCODE_015.
        String expectedKey = "sanPhamMuaHang.maVachChiSinhChoBienTheCoId";
        var input = new LinkedHashMap<String, Object>();
        input.put("tienTo", tienTo);
        input.put("bienTheId", bienTheId);
        var expected = new BarcodeReportWalkthrough.ExpectedException(LoiThamSoException.class.getName(), expectedKey);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_009", "sinh", input, expected,
                "Expected recovered from exact repository fixture Report51BARCODETest#UT_BARCODE_015; assertThrowsExactly(LoiThamSoException); non-null ThongDiep; exact message key via getThongDiep().khoa(). Original uncropped report image not available.")) {
            LoiThamSoException actual = assertThrowsExactly(LoiThamSoException.class,
                    () -> walkthrough.execute(() -> MaVachSku.sinh(tienTo, bienTheId)));
            assertNotNull(actual);
            assertNotNull(actual.getThongDiep());
            assertEquals(expectedKey, actual.getThongDiep().khoa());
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_010() {
        String tienTo = "20";
        int bienTheId = 123456789;
        String expected = "20123456789";
        var input = new LinkedHashMap<String, Object>();
        input.put("tienTo", tienTo);
        input.put("bienTheId", bienTheId);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_010", "sinh", input, expected, STRING_ASSERTIONS + " Length must equal 11; retain all ID digits.")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.sinh(tienTo, bienTheId)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            assertEquals(11, actual.length());
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_011() {
        String ma = " 2000000150 ";
        String expected = "2000000150";
        var input = new LinkedHashMap<String, Object>();
        input.put("ma", ma);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_011", "chuanHoa", input, expected, STRING_ASSERTIONS)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.chuanHoa(ma)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_BARCODE_012() {
        String ma = " ";
        String expected = null;
        var input = new LinkedHashMap<String, Object>();
        input.put("ma", ma);
        try (var walkthrough = new BarcodeReportWalkthrough("UT_BARCODE_012", "chuanHoa", input, expected,
                "No exception; assertNull(actual); real null differs from empty string and the literal string null.")) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> MaVachSku.chuanHoa(ma)));
            assertNull(actual);
            walkthrough.passed();
        }
    }
}
