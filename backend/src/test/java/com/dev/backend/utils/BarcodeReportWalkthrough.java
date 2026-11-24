package com.dev.backend.utils;

import com.dev.backend.i18n.CoThongDiep;
import org.junit.jupiter.api.function.ThrowingSupplier;

import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/** Captures one real call and unchanged values, without implementing barcode rules. */
final class BarcodeReportWalkthrough implements AutoCloseable {
    record ExpectedException(String exceptionClass, String messageKey) { }

    private static final String SEPARATOR = "==================================================";
    private final String expected;
    private final String assertions;
    private boolean passed;

    BarcodeReportWalkthrough(String id, String function, Map<String, Object> input, Object expected, String assertions) {
        this.expected = describe(expected);
        this.assertions = assertions;
        String snapshot = describe(input);
        System.out.println(SEPARATOR);
        System.out.println("Test Case ID: " + id);
        System.out.println("Function: MaVachSku." + function);
        System.out.println("Test class: " + VariantBarcodeReportTest.class.getName());
        System.out.println("Test method: " + id);
        System.out.println("Step 1 - Prepare input: " + snapshot);
        System.out.println("Step 2 - Execute: MaVachSku." + function + "("
                + String.join(", ", input.keySet()) + "); parameters=" + snapshot);
    }

    <T> T execute(ThrowingSupplier<T> call) throws Throwable {
        T actual;
        try {
            actual = call.get();
        } catch (Throwable error) {
            String details = "{\"exceptionClass\":" + quote(error.getClass().getName());
            if (error instanceof CoThongDiep keyed && keyed.getThongDiep() != null) {
                details += ",\"messageKey\":" + quote(keyed.getThongDiep().khoa())
                        + ",\"arguments\":" + describe(keyed.getThongDiep().thamSo());
            }
            System.out.println("Step 3 - Actual result: " + details + "}");
            printExpected();
            throw error;
        }
        System.out.println("Step 3 - Actual result: " + describe(actual));
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

    private static String describe(Object value) {
        if (value == null) return "{\"type\":\"null\",\"text\":null,\"length\":null}";
        if (value instanceof Boolean || value instanceof Integer) return value.toString();
        if (value instanceof String text) return "{\"type\":\"string\",\"text\":" + quote(text) + ",\"length\":" + text.length() + "}";
        if (value instanceof ExpectedException error) {
            return "{\"exceptionClass\":" + quote(error.exceptionClass()) + ",\"messageKey\":" + quote(error.messageKey()) + "}";
        }
        if (value instanceof Map<?, ?> map) {
            return map.entrySet().stream().map(entry -> quote((String) entry.getKey()) + ":" + describe(entry.getValue()))
                    .collect(Collectors.joining(",", "{", "}"));
        }
        if (value instanceof Object[] arguments) {
            return Arrays.stream(arguments).map(BarcodeReportWalkthrough::describe).collect(Collectors.joining(",", "[", "]"));
        }
        throw new IllegalArgumentException("Unsupported evidence value: " + value.getClass().getName());
    }

    private static String quote(String value) {
        StringBuilder result = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '"') result.append("\\\"");
            else if (c == '\\') result.append("\\\\");
            else if (c < 32 || c > 126) result.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
            else result.append(c);
        }
        return result.append('"').toString();
    }
}
