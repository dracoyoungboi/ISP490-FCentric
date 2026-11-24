package com.dev.backend.utils;

import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.function.ThrowingSupplier;

import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import static org.mockito.Mockito.mockingDetails;

/** Describes configured stubs and recorded invocations without calling the mock for logging. */
final class ChannelConfigurationWalkthrough implements AutoCloseable {
    private static final String SEPARATOR = "==================================================";
    private final Object service;
    private final String expected;
    private boolean serviceVerified;
    private boolean passed;

    ChannelConfigurationWalkthrough(String id, String function, Map<String, Object> input, Object expected,
                                     DieuHanhHeThongService service, String stubKey, String stubValue) {
        this.service = service;
        this.expected = describe(expected);
        String setup = "null";
        if (service != null) {
            var details = mockingDetails(service);
            setup = "{\"serviceParameter\":\"cauHinh\",\"serviceClass\":" + quote(details.getMockCreationSettings().getTypeToMock().getName())
                    + ",\"isMock\":" + details.isMock() + ",\"method\":\"getCauHinhString\",\"arguments\":["
                    + describe(stubKey) + "," + describe(null) + "],\"returnValue\":" + describe(stubValue) + "}";
        }
        String snapshot = "{\"parameters\":" + describe(input) + ",\"mockSetup\":" + setup + "}";
        System.out.println(SEPARATOR);
        System.out.println("Test Case ID: " + id);
        System.out.println("Function: KenhCauHinhDongBo." + function);
        System.out.println("Test class: " + ChannelConfigurationReportTest.class.getName());
        System.out.println("Test method: " + id);
        System.out.println("Step 1 - Prepare input: " + snapshot);
        System.out.println("Step 2 - Execute: KenhCauHinhDongBo." + function + "("
                + (service == null ? "" : "cauHinh, ") + String.join(", ", input.keySet()) + "); input=" + snapshot);
    }

    <T> T execute(ThrowingSupplier<T> call) throws Throwable {
        T actual;
        try {
            actual = call.get();
        } catch (Throwable error) {
            System.out.println("Step 3 - Actual result: {\"exceptionClass\":" + quote(error.getClass().getName()) + "}");
            recordInvocations();
            printExpected();
            throw error;
        }
        System.out.println("Step 3 - Actual result: " + describe(actual));
        recordInvocations();
        printExpected();
        return actual;
    }

    private void recordInvocations() {
        String observed = service == null ? "[]" : mockingDetails(service).getInvocations().stream()
                .map(invocation -> "{\"method\":" + quote(invocation.getMethod().getName()) + ",\"arguments\":"
                        + Arrays.stream(invocation.getArguments()).map(ChannelConfigurationWalkthrough::describe)
                        .collect(Collectors.joining(",", "[", "]")) + "}")
                .collect(Collectors.joining(",", "[", "]"));
        System.out.println("Service invocations: " + observed);
    }

    private void printExpected() {
        System.out.println("Step 4 - Verify expected result: expected=" + expected
                + "; assertions=No exception; non-null result; exact assertEquals(expected, actual). "
                + (service == null ? "No service mock or service verification required."
                : "verify(service, times(1)).getCauHinhString(expectedKey, null); verifyNoMoreInteractions(service)."));
    }

    void serviceVerified() { serviceVerified = true; }

    void passed() {
        if (service != null && !serviceVerified) throw new IllegalStateException("Service verification has not completed.");
        passed = true;
    }

    @Override
    public void close() {
        System.out.println("Service verification: " + (service == null ? "NOT_APPLICABLE" : serviceVerified ? "PASSED" : "FAILED_OR_NOT_COMPLETED"));
        System.out.println("Assertion result: " + (passed ? "PASSED" : "FAILED"));
        System.out.println(SEPARATOR);
    }

    private static String describe(Object value) {
        if (value == null) return "{\"type\":\"null\",\"text\":null,\"length\":null}";
        if (value instanceof Boolean || value instanceof Integer) return value.toString();
        if (value instanceof String text) return "{\"type\":\"string\",\"text\":" + quote(text) + ",\"length\":" + text.length() + "}";
        if (value instanceof Map<?, ?> map) {
            return map.entrySet().stream().map(entry -> quote((String) entry.getKey()) + ":" + describe(entry.getValue()))
                    .collect(Collectors.joining(",", "{", "}"));
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
