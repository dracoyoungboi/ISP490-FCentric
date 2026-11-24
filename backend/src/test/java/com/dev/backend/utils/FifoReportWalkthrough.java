package com.dev.backend.utils;

import com.dev.backend.utils.PhanBoLoFifo.Lo;
import org.junit.jupiter.api.function.ThrowingSupplier;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Prints observed unit-test steps without calculating or changing the business result. */
final class FifoReportWalkthrough implements AutoCloseable {

    private static final String SEPARATOR = "==================================================";

    private final String expected;
    private final String assertions;
    private boolean passed;

    private FifoReportWalkthrough(String id, String function, String testClass, List<Lo> input,
                                 BigDecimal quantity, Object expected, String assertions) {
        this.expected = format(expected);
        this.assertions = assertions;
        String inputName = switch (function) {
            case "tong" -> "danhSach";
            case "layFifo" -> "conLaiTheoFifo";
            case "catTuLoMoiNhat" -> "phanBoTheoFifo";
            default -> throw new IllegalArgumentException("Unsupported walkthrough function: " + function);
        };
        String quantityName = "layFifo".equals(function) ? "can" : "moi";
        // Snapshot strings before the call, even if a future implementation mutates the input list.
        String parameters = "{\"" + inputName + "\":" + format(input)
                + (quantity == null ? "" : ",\"" + quantityName + "\":" + format(quantity)) + "}";
        String arguments = inputName + (quantity == null ? "" : ", " + quantityName);
        printStart(id, function, testClass, parameters, arguments);
    }

    private FifoReportWalkthrough(String id, String testClass, List<Lo> input,
                                 Map<String, BigDecimal> demands, Map<String, List<Lo>> expected,
                                 String assertions) {
        this.expected = format(expected);
        this.assertions = assertions;
        // Map formatting follows entrySet iteration order; it never sorts the orders.
        String parameters = "{\"phanBoTheoFifo\":" + format(input)
                + ",\"canTheoDon\":" + format(demands) + "}";
        printStart(id, "chiaChoDon", testClass, parameters, "phanBoTheoFifo, canTheoDon");
    }

    private static void printStart(String id, String function, String testClass,
                                   String parameters, String arguments) {
        System.out.println(SEPARATOR);
        System.out.println("Test Case ID: " + id);
        System.out.println("Function: " + function);
        System.out.println("Test class: " + testClass);
        System.out.println("Step 1 - Prepare input: " + parameters);
        System.out.println("Step 2 - Execute: PhanBoLoFifo." + function + "(" + arguments
                + "); parameters=" + parameters);
    }

    static FifoReportWalkthrough begin(String id, String function, String testClass, List<Lo> input,
                                       BigDecimal quantity, Object expected, String assertions) {
        return new FifoReportWalkthrough(id, function, testClass, input, quantity, expected, assertions);
    }

    static FifoReportWalkthrough beginOrders(String id, String testClass, List<Lo> input,
                                             Map<String, BigDecimal> demands,
                                             Map<String, List<Lo>> expected, String assertions) {
        return new FifoReportWalkthrough(id, testClass, input, demands, expected, assertions);
    }

    <T> T execute(ThrowingSupplier<T> call) throws Throwable {
        T actual;
        try {
            actual = call.get();
        } catch (Throwable error) {
            System.out.println("Step 3 - Actual result: No return value. Unexpected exception: "
                    + error.getClass().getName() + ": " + String.valueOf(error.getMessage())
                    .replace("\r", "\\r").replace("\n", "\\n"));
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

    private static String format(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof BigDecimal number) {
            return number.toPlainString();
        }
        if (value instanceof Lo lot) {
            return "{\"loHangId\":" + lot.loHangId() + ",\"soLuong\":" + format(lot.soLuong()) + "}";
        }
        if (value instanceof List<?> list) {
            return list.stream().map(FifoReportWalkthrough::format).collect(Collectors.joining(",", "[", "]"));
        }
        if (value instanceof Map<?, ?> map) {
            return map.entrySet().stream().map(entry -> "\""
                    + String.valueOf(entry.getKey()).replace("\\", "\\\\").replace("\"", "\\\"")
                    + "\":" + format(entry.getValue())).collect(Collectors.joining(",", "{", "}"));
        }
        throw new IllegalArgumentException("Unsupported walkthrough value type: " + value.getClass().getName());
    }
}
