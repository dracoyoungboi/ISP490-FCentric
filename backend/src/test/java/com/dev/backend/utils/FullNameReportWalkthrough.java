package com.dev.backend.utils;

import org.junit.jupiter.api.function.ThrowingSupplier;

import java.util.Locale;
import java.util.stream.Collectors;

/** Describes unchanged Unicode strings and one real call; contains no name rules. */
final class FullNameReportWalkthrough implements AutoCloseable {
    private static final String SEPARATOR = "==================================================";
    private final String expected;
    private final String assertions;
    private boolean passed;

    FullNameReportWalkthrough(String id, String function, String chuoi, String inputExpression,
                              String expected, String expectedReference) {
        this.expected = "{\"reference\":" + quote(expectedReference) + ",\"value\":" + describe(expected) + "}";
        String resultAssertions = expected == null ? "No exception; assertNull(actual); null means no name validation error."
                : "No exception; assertNotNull(actual); exact assertEquals(expected, actual); no trimming or Unicode normalization of actual.";
        this.assertions = resultAssertions + (id.equals("UT_NAME_002")
                ? " Input also checked for real U+0302, U+0303 and U+200B, not literal backslash-u text." : "");
        String parameters = "{\"chuoi\":" + describe(chuoi) + "}";
        System.out.println(SEPARATOR);
        System.out.println("Test Case ID: " + id);
        System.out.println("Function: HoTen." + function);
        System.out.println("Test class: " + FullNameValidationReportTest.class.getName());
        System.out.println("Test method: " + id);
        System.out.println("Step 1 - Prepare input: {\"chuoi\":" + describe(chuoi)
                + ",\"inputExpression\":" + quote(inputExpression) + "}");
        System.out.println("Step 2 - Execute: HoTen." + function + "(chuoi); parameters=" + parameters);
    }

    String execute(ThrowingSupplier<String> call) throws Throwable {
        String actual;
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
    }

    void passed() { passed = true; }

    @Override
    public void close() {
        System.out.println("Assertion result: " + (passed ? "PASSED" : "FAILED"));
        System.out.println(SEPARATOR);
    }

    private static String describe(String value) {
        if (value == null) return "{\"type\":\"null\",\"text\":null,\"length\":null,\"codePointCount\":null,\"codePoints\":null}";
        String codePoints = value.codePoints().mapToObj(point -> quote(String.format(Locale.ROOT, "U+%04X", point)))
                .collect(Collectors.joining(",", "[", "]"));
        return "{\"type\":\"string\",\"text\":" + quote(value) + ",\"length\":" + value.length()
                + ",\"codePointCount\":" + value.codePointCount(0, value.length()) + ",\"codePoints\":" + codePoints + "}";
    }

    /** JSON escapes keep console evidence lossless even on a non-UTF-8 Windows terminal. */
    private static String quote(String value) {
        StringBuilder result = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            switch (character) {
                case '"' -> result.append("\\\"");
                case '\\' -> result.append("\\\\");
                default -> {
                    if (character < 32 || character > 126) result.append(String.format(Locale.ROOT, "\\u%04x", (int) character));
                    else result.append(character);
                }
            }
        }
        return result.append('"').toString();
    }
}
