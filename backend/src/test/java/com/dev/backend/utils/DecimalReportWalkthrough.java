package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import org.junit.jupiter.api.function.ThrowingSupplier;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/** Records one real invocation without implementing decimal-limit rules. */
final class DecimalReportWalkthrough implements AutoCloseable {
    private static final String SEPARATOR = "==================================================";
    private final BigDecimal input;
    private final String expected;
    private final String assertions;
    private final boolean checkIdentity;
    private boolean passed;

    DecimalReportWalkthrough(String id, String function, String literal, BigDecimal so,
                             ThongDiep tenTruong, Object expected, String assertions) {
        this.input = so;
        this.expected = format(expected);
        this.assertions = assertions;
        this.checkIdentity = id.equals("UT_DECIMAL_007");
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("so", Map.of("literal", literal, "decimalString", so.toString(),
                "precision", so.precision(), "scale", so.scale()));
        if (tenTruong != null) parameters.put("tenTruong", tenTruong);
        String snapshot = format(parameters);
        System.out.println(SEPARATOR);
        System.out.println("Test Case ID: " + id);
        System.out.println("Function: GioiHanSoThapPhan." + function);
        System.out.println("Test class: " + DecimalLimitsReportTest.class.getName());
        System.out.println("Test method: " + id);
        System.out.println("Step 1 - Prepare input: " + snapshot);
        System.out.println("Step 2 - Execute: GioiHanSoThapPhan." + function + "("
                + String.join(", ", parameters.keySet()) + "); parameters=" + snapshot);
    }

    <T> T execute(ThrowingSupplier<T> call) throws Throwable {
        T actual;
        try {
            actual = call.get();
        } catch (Throwable error) {
            Map<String, Object> observed = new LinkedHashMap<>();
            observed.put("exceptionClass", error.getClass().getName());
            if (error instanceof CommonException exception && exception.getThongDiep() != null) {
                observed.put("messageKey", exception.getThongDiep().khoa());
                observed.put("arguments", Arrays.asList(exception.getThongDiep().thamSo()));
            }
            System.out.println("Step 3 - Actual result: " + format(observed));
            printExpected();
            throw error;
        }
        Object observed = actual;
        if (checkIdentity) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("value", actual);
            result.put("sameInstance", input == actual);
            observed = result;
        }
        System.out.println("Step 3 - Actual result: " + format(observed));
        printExpected();
        return actual;
    }

    private void printExpected() {
        System.out.println("Step 4 - Verify expected result: expected=" + expected + "; assertions=" + assertions);
    }

    void passed() { passed = true; }

    @Override
    public void close() {
        System.out.println("Assertion result: " + (passed ? "PASSED" : "FAILED"));
        System.out.println(SEPARATOR);
    }

    private static String format(Object value) {
        if (value == null) return "null";
        if (value instanceof BigDecimal decimal) {
            return format(Map.of("decimalString", decimal.toString(), "precision", decimal.precision(), "scale", decimal.scale()));
        }
        if (value instanceof ThongDiep label) {
            return format(Map.of("type", ThongDiep.class.getName(), "key", label.khoa(), "arguments", Arrays.asList(label.thamSo())));
        }
        if (value instanceof Boolean || value instanceof Integer) return value.toString();
        if (value instanceof String string) return quote(string);
        if (value instanceof Map<?, ?> map) {
            return map.entrySet().stream().map(entry -> quote((String) entry.getKey()) + ":" + format(entry.getValue()))
                    .collect(Collectors.joining(",", "{", "}"));
        }
        if (value instanceof Iterable<?> items) {
            StringBuilder result = new StringBuilder("[");
            for (Object item : items) {
                if (result.length() > 1) result.append(',');
                result.append(format(item));
            }
            return result.append(']').toString();
        }
        throw new IllegalArgumentException("Unsupported evidence value: " + value.getClass().getName());
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\r", "\\r").replace("\n", "\\n").replace("\t", "\\t") + "\"";
    }
}
