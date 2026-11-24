package com.dev.backend.utils;

import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.dto.request.FilterCriteria;
import org.junit.jupiter.api.function.ThrowingSupplier;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/** Describes real values before/after one call; does not implement search or filtering rules. */
final class SearchReportWalkthrough implements AutoCloseable {
    record ExpectedFilter(String fieldName, FilterOperation operation, Object value) { }

    private static final String SEPARATOR = "==================================================";
    private final String expected;
    private final String assertions;
    private final String expectedSource;
    private boolean passed;

    SearchReportWalkthrough(String id, String function, Map<String, Object> input, Object expected,
                            String assertions, String expectedSource) {
        this.expected = describe(expected);
        this.assertions = assertions;
        this.expectedSource = expectedSource;
        String snapshot = describe(input);
        System.out.println(SEPARATOR);
        System.out.println("Test Case ID: " + id);
        System.out.println("Function: TuKhoaTimKiem." + function);
        System.out.println("Test class: " + SearchUtilitiesReportTest.class.getName());
        System.out.println("Test method: " + id);
        System.out.println("Step 1 - Prepare input: " + snapshot);
        System.out.println("Step 2 - Execute: TuKhoaTimKiem." + function + "("
                + String.join(", ", input.keySet()) + "); parameters=" + snapshot);
    }

    <T> T execute(ThrowingSupplier<T> call) throws Throwable {
        T actual;
        try {
            actual = call.get();
        } catch (Throwable error) {
            System.out.println("Step 3 - Actual result: {\"exceptionClass\":" + quote(error.getClass().getName())
                    + ",\"message\":" + describe(error.getMessage()) + "}");
            printExpected();
            throw error;
        }
        System.out.println("Step 3 - Actual result: " + describe(actual));
        printExpected();
        return actual;
    }

    private void printExpected() {
        System.out.println("Step 4 - Verify expected result: expected=" + expected + "; assertions=" + assertions);
        System.out.println("Expected source: " + expectedSource);
        System.out.println("Verification scope: FULL");
    }

    void passed() { passed = true; }

    @Override
    public void close() {
        System.out.println("Assertion result: " + (passed ? "PASSED" : "FAILED"));
        System.out.println(SEPARATOR);
    }

    private static String describe(Object value) {
        if (value == null) return "{\"type\":\"null\",\"text\":null,\"length\":null}";
        if (value instanceof String text) return "{\"type\":\"string\",\"text\":" + quote(text) + ",\"length\":" + text.length() + "}";
        if (value instanceof Boolean || value instanceof Integer) return value.toString();
        if (value instanceof TuKhoaTimKiem.Tach result) {
            return "{\"coTruong\":" + result.coTruong() + ",\"tuKhoa\":" + describe(result.tuKhoa())
                    + ",\"chinhXac\":" + result.chinhXac() + ",\"conLai\":" + describe(result.conLai()) + "}";
        }
        if (value instanceof FilterCriteria filter) {
            return filterFields(filter.getFieldName(), filter.getOperation(), filter.getValue())
                    + ",\"logicType\":" + nullableQuote(filter.getLogicType() == null ? null : filter.getLogicType().name()) + "}";
        }
        if (value instanceof ExpectedFilter filter) return filterFields(filter.fieldName(), filter.operation(), filter.value()) + "}";
        if (value instanceof List<?> items) return items.stream().map(SearchReportWalkthrough::describe).collect(Collectors.joining(",", "[", "]"));
        if (value instanceof Map<?, ?> map) {
            return map.entrySet().stream().map(entry -> quote((String) entry.getKey()) + ":" + describe(entry.getValue()))
                    .collect(Collectors.joining(",", "{", "}"));
        }
        throw new IllegalArgumentException("Unsupported evidence value: " + value.getClass().getName());
    }

    private static String filterFields(String fieldName, FilterOperation operation, Object value) {
        return "{\"fieldName\":" + nullableQuote(fieldName) + ",\"operation\":" + nullableQuote(operation == null ? null : operation.name())
                + ",\"value\":" + describe(value) + ",\"valueType\":" + nullableQuote(value == null ? null : value.getClass().getName());
    }

    private static String nullableQuote(String value) { return value == null ? "null" : quote(value); }

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
