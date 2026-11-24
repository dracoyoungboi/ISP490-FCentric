package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DecimalLimitsReportTest {
    private static final String BOOLEAN_ASSERTIONS = "No exception; result is not null; Boolean equals expected exactly.";

    @Test
    void UT_DECIMAL_001() {
        String literal = "10000.01999999999";
        BigDecimal so = new BigDecimal(literal);
        Boolean expected = Boolean.TRUE;
        try (var walkthrough = new DecimalReportWalkthrough("UT_DECIMAL_001", "hopLe", literal, so, null, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> GioiHanSoThapPhan.hopLe(so)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_DECIMAL_002() {
        String literal = "99999999999999999999";
        BigDecimal so = new BigDecimal(literal);
        Boolean expected = Boolean.TRUE;
        try (var walkthrough = new DecimalReportWalkthrough("UT_DECIMAL_002", "hopLe", literal, so, null, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> GioiHanSoThapPhan.hopLe(so)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_DECIMAL_003() {
        String literal = "100000000000000000000";
        BigDecimal so = new BigDecimal(literal);
        Boolean expected = Boolean.FALSE;
        try (var walkthrough = new DecimalReportWalkthrough("UT_DECIMAL_003", "hopLe", literal, so, null, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> GioiHanSoThapPhan.hopLe(so)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_DECIMAL_004() {
        String literal = "1E-30";
        BigDecimal so = new BigDecimal(literal);
        Boolean expected = Boolean.TRUE;
        try (var walkthrough = new DecimalReportWalkthrough("UT_DECIMAL_004", "hopLe", literal, so, null, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> GioiHanSoThapPhan.hopLe(so)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_DECIMAL_005() {
        String literal = "1E-31";
        BigDecimal so = new BigDecimal(literal);
        Boolean expected = Boolean.FALSE;
        try (var walkthrough = new DecimalReportWalkthrough("UT_DECIMAL_005", "hopLe", literal, so, null, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> GioiHanSoThapPhan.hopLe(so)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_DECIMAL_006() {
        String literal = "1E900000000";
        BigDecimal so = new BigDecimal(literal);
        Boolean expected = Boolean.FALSE;
        try (var walkthrough = new DecimalReportWalkthrough("UT_DECIMAL_006", "hopLe", literal, so, null, expected, BOOLEAN_ASSERTIONS)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> GioiHanSoThapPhan.hopLe(so)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_DECIMAL_007() {
        String literal = "30000";
        BigDecimal so = new BigDecimal(literal);
        ThongDiep tenTruong = ThongDiep.of("nhan.phiVanChuyen");
        BigDecimal expected = new BigDecimal("30000");
        try (var walkthrough = new DecimalReportWalkthrough("UT_DECIMAL_007", "kiemTra", literal, so, tenTruong,
                Map.of("value", expected, "sameInstance", true),
                "No exception; result is not null; assertSame(input, actual); expected.compareTo(actual) == 0.")) {
            BigDecimal actual = assertDoesNotThrow(() -> walkthrough.execute(() -> GioiHanSoThapPhan.kiemTra(so, tenTruong)));
            assertNotNull(actual);
            assertSame(so, actual);
            assertEquals(0, expected.compareTo(actual));
            walkthrough.passed();
        }
    }

    @Test
    void UT_DECIMAL_008() {
        String literal = "1E900000000";
        BigDecimal so = new BigDecimal(literal);
        ThongDiep tenTruong = ThongDiep.of("nhan.phiVanChuyen");
        String expectedKey = "sanPhamMuaHang.truongVuotGioiHan";
        try (var walkthrough = new DecimalReportWalkthrough("UT_DECIMAL_008", "kiemTra", literal, so, tenTruong,
                Map.of("exceptionClass", CommonException.class.getName(), "messageKey", expectedKey, "arguments", List.of(tenTruong)),
                "assertThrowsExactly(CommonException); non-null ThongDiep; exact message key; one argument; argument is the supplied ThongDiep instance with key nhan.phiVanChuyen and no label arguments.")) {
            CommonException actual = assertThrowsExactly(CommonException.class,
                    () -> walkthrough.execute(() -> GioiHanSoThapPhan.kiemTra(so, tenTruong)));
            assertNotNull(actual);
            assertNotNull(actual.getThongDiep());
            assertEquals(expectedKey, actual.getThongDiep().khoa());
            Object[] arguments = actual.getThongDiep().thamSo();
            assertNotNull(arguments);
            assertEquals(1, arguments.length);
            ThongDiep actualLabel = assertInstanceOf(ThongDiep.class, arguments[0]);
            assertSame(tenTruong, actualLabel);
            assertEquals("nhan.phiVanChuyen", actualLabel.khoa());
            assertEquals(0, actualLabel.thamSo().length);
            walkthrough.passed();
        }
    }
}
