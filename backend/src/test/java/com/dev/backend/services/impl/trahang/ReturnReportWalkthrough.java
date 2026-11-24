package com.dev.backend.services.impl.trahang;

import org.junit.jupiter.api.function.ThrowingSupplier;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/** Records a real call and its returned object; it contains no return/refund rules. */
final class ReturnReportWalkthrough implements AutoCloseable {

    private static final String SEPARATOR = "==================================================";
    private final String expected;
    private boolean passed;

    private ReturnReportWalkthrough(String id, String function, String testClass,
                                    LinkedHashMap<String, Object> input, Object expected) {
        this.expected = format(expected);
        String parameters = format(input);
        System.out.println(SEPARATOR);
        System.out.println("Test Case ID: " + id);
        System.out.println("Function: TraHangQuyTac." + function);
        System.out.println("Test class: " + testClass);
        System.out.println("Test method: " + id);
        System.out.println("Step 1 - Prepare input: " + parameters);
        System.out.println("Step 2 - Execute: TraHangQuyTac." + function + "("
                + String.join(", ", input.keySet()) + "); parameters=" + parameters);
    }

    static ReturnReportWalkthrough begin(String id, String function, String testClass,
                                         LinkedHashMap<String, Object> input, Object expected) {
        return new ReturnReportWalkthrough(id, function, testClass, input, expected);
    }

    <T> T execute(ThrowingSupplier<T> call) throws Throwable {
        T actual;
        try {
            actual = call.get();
        } catch (Throwable error) {
            System.out.println("Step 3 - Actual result: {\"unexpectedException\":" + quote(error.getClass().getName()) + "}");
            printExpected();
            throw error;
        }
        System.out.println("Step 3 - Actual result: " + format(actual));
        printExpected();
        return actual;
    }

    private void printExpected() {
        System.out.println("Step 4 - Verify expected result: expected=" + expected
                + "; assertions=No unexpected exception; result is not null; Boolean matches exactly or BigDecimal matches numerically using compareTo. BigDecimal scale is logged only, not asserted.");
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
        if (value == null) return "null";
        if (value instanceof BigDecimal number) {
            return "{\"value\":" + number.toPlainString() + ",\"scale\":" + number.scale() + "}";
        }
        if (value instanceof Boolean flag) return flag.toString();
        if (value instanceof Instant instant) return quote(instant.toString());
        if (value instanceof String text) return quote(text);
        if (value instanceof Map<?, ?> map) {
            return map.entrySet().stream().map(entry -> quote(String.valueOf(entry.getKey()))
                    + ":" + format(entry.getValue())).collect(Collectors.joining(",", "{", "}"));
        }
        throw new IllegalArgumentException("Unsupported walkthrough value: " + value.getClass().getName());
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
