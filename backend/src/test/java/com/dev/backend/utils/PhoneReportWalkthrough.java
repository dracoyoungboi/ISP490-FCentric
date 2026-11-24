package com.dev.backend.utils;

import org.junit.jupiter.api.function.ThrowingSupplier;

/** Records original strings and one real call; contains no phone-normalization rules. */
final class PhoneReportWalkthrough implements AutoCloseable {
    private static final String SEPARATOR = "==================================================";
    private final String expected;
    private boolean passed;

    PhoneReportWalkthrough(String id, String function, String parameterName, String input, String expected) {
        this.expected = describe(expected);
        String snapshot = "{" + quote(parameterName) + ":" + describe(input) + "}";
        System.out.println(SEPARATOR);
        System.out.println("Test Case ID: " + id);
        System.out.println("Function: SoDienThoai." + function);
        System.out.println("Test class: " + PhoneNormalizationReportTest.class.getName());
        System.out.println("Test method: " + id);
        System.out.println("Step 1 - Prepare input: " + snapshot);
        System.out.println("Step 2 - Execute: SoDienThoai." + function + "(" + parameterName + "); parameters=" + snapshot);
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
        System.out.println("Step 4 - Verify expected result: expected=" + expected
                + "; assertions=No exception; assertNull for expected null, otherwise assertNotNull and exact assertEquals; no trimming or normalization of actual.");
    }

    void passed() { passed = true; }

    @Override
    public void close() {
        System.out.println("Assertion result: " + (passed ? "PASSED" : "FAILED"));
        System.out.println(SEPARATOR);
    }

    private static String describe(String value) {
        if (value == null) return "{\"type\":\"null\",\"text\":null,\"length\":null}";
        return "{\"type\":\"string\",\"text\":" + quote(value) + ",\"length\":" + value.length() + "}";
    }

    private static String quote(String value) {
        StringBuilder result = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            switch (character) {
                case '"' -> result.append("\\\"");
                case '\\' -> result.append("\\\\");
                case '\n' -> result.append("\\n");
                case '\r' -> result.append("\\r");
                case '\t' -> result.append("\\t");
                default -> {
                    if (character < 32) result.append(String.format("\\u%04x", (int) character));
                    else result.append(character);
                }
            }
        }
        return result.append('"').toString();
    }
}
