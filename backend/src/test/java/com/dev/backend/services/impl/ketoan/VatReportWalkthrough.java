package com.dev.backend.services.impl.ketoan;

import com.dev.backend.i18n.CoThongDiep;
import org.junit.jupiter.api.function.ThrowingSupplier;

import java.math.BigDecimal;

/** Observes a single real call; it does not calculate VAT or replace assertions. */
final class VatReportWalkthrough implements AutoCloseable {

    private static final String SEPARATOR = "==================================================";
    private final String expected;
    private final String assertions;
    private boolean passed;

    private VatReportWalkthrough(String id, String testClass, BigDecimal soLuong, BigDecimal tienGomThue,
                                 BigDecimal giamGiaGomThue, BigDecimal thueSuat, String inputStatus,
                                 String rateSource, String expected, String assertions) {
        this.expected = expected;
        this.assertions = assertions;
        // The four actual arguments are captured before the production call.
        String input = "{\"soLuong\":" + soLuong.toPlainString()
                + ",\"tienGomThue\":" + tienGomThue.toPlainString()
                + ",\"giamGiaGomThue\":" + giamGiaGomThue.toPlainString()
                + ",\"thueSuat\":" + thueSuat.toPlainString() + "}";
        System.out.println(SEPARATOR);
        System.out.println("Test Case ID: " + id);
        System.out.println("Function: TachThue.tach");
        System.out.println("Test class: " + testClass);
        System.out.println("Test method: " + id);
        System.out.println("Input status: " + inputStatus);
        System.out.println("Tax rate provenance: " + rateSource);
        System.out.println("Tax rate representation: percent points; 8 means 8%, 10 means 10%.");
        System.out.println("Step 1 - Prepare input: " + input);
        System.out.println("Step 2 - Execute: TachThue.tach(soLuong, tienGomThue, giamGiaGomThue, thueSuat); parameters=" + input);
    }

    static VatReportWalkthrough value(String id, String testClass, BigDecimal soLuong, BigDecimal tienGomThue,
                                      BigDecimal giamGiaGomThue, BigDecimal thueSuat, String inputStatus,
                                      String rateSource, TachThue.Dong expected) {
        return new VatReportWalkthrough(id, testClass, soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                inputStatus, rateSource, format(expected),
                "No unexpected exception; result and all four fields are not null; donGia, thanhTien, chietKhau and tienThue match numerically using BigDecimal.compareTo.");
    }

    static VatReportWalkthrough error(String id, String testClass, BigDecimal soLuong, BigDecimal tienGomThue,
                                      BigDecimal giamGiaGomThue, BigDecimal thueSuat, String inputStatus,
                                      String rateSource, Class<? extends Throwable> expectedClass, String expectedKey) {
        return new VatReportWalkthrough(id, testClass, soLuong, tienGomThue, giamGiaGomThue, thueSuat,
                inputStatus, rateSource, exceptionValue(expectedClass.getName(), expectedKey),
                "assertThrowsExactly checks the expected exception class; getThongDiep() is not null and getThongDiep().khoa() equals the expected message key. An expected exception is not a JUnit execution error.");
    }

    TachThue.Dong execute(ThrowingSupplier<TachThue.Dong> call) throws Throwable {
        TachThue.Dong actual;
        try {
            actual = call.get();
        } catch (Throwable error) {
            String key = error instanceof CoThongDiep co && co.getThongDiep() != null
                    ? co.getThongDiep().khoa() : null;
            System.out.println("Step 3 - Actual result: " + exceptionValue(error.getClass().getName(), key));
            printExpected();
            throw error;
        }
        System.out.println("Step 3 - Actual result: " + format(actual));
        printExpected();
        return actual;
    }

    private void printExpected() {
        System.out.println("Step 4 - Verify expected result: expected=" + expected + "; assertions=" + assertions);
    }

    void passed() {
        passed = true;
    }

    @Override
    public void close() {
        System.out.println("Assertion result: " + (passed ? "PASSED" : "FAILED"));
        System.out.println(SEPARATOR);
    }

    private static String format(TachThue.Dong value) {
        if (value == null) return "null";
        return "{\"donGia\":" + decimal(value.donGia()) + ",\"thanhTien\":" + decimal(value.thanhTien())
                + ",\"chietKhau\":" + decimal(value.chietKhau()) + ",\"tienThue\":" + decimal(value.tienThue()) + "}";
    }

    private static String decimal(BigDecimal value) {
        return value == null ? "null" : value.toPlainString();
    }

    private static String exceptionValue(String className, String key) {
        return "{\"exceptionClass\":" + quote(className) + ",\"messageKey\":" + quote(key) + "}";
    }

    private static String quote(String value) {
        return value == null ? "null" : "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
