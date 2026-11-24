package com.dev.backend.services.impl.utils;

import com.dev.backend.services.impl.utils.PasswordResetRateLimiter.Decision;
import com.dev.backend.services.impl.utils.PasswordResetRateLimiter.Reason;
import com.dev.backend.testsupport.MutableClock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/** Report 5.1: supplied RESETLIMIT specification; isolated public-API scenarios. */
class PasswordResetRateLimiterReportTest {
    private static final Instant T0 = Instant.parse("2026-11-19T00:00:00Z");

    private static final class Scenario implements AutoCloseable {
        private final MutableClock clock = new MutableClock(T0);
        private final PasswordResetRateLimiter limiter = new PasswordResetRateLimiter(clock);
        private boolean passed;
        private int order;

        Scenario(String id, String expected) {
            System.out.println("==================================================");
            System.out.println("Test Case ID: " + id);
            System.out.println("Test class: com.dev.backend.services.impl.utils.PasswordResetRateLimiterReportTest");
            System.out.println("Test method: " + id);
            System.out.println("Function: PasswordResetRateLimiter.tryAcquire(identifier, clientIp, accountId)");
            System.out.println("Step 1 - Prepare input: new limiter and new MutableClock; T0=" + T0
                    + "; exact arguments are recorded before each call below.");
            System.out.println("Step 2 - Execute: advance the injected Clock and execute each listed request once.");
            System.out.println("Expected action result: " + expected);
        }

        void at(long offset) {
            clock.advance(Duration.between(clock.instant(), T0.plusSeconds(offset)));
            System.out.println("Clock advanced: offsetSeconds=" + offset + "; instant=" + clock.instant());
        }

        // This is the only production invocation; logging and assertions reuse its returned Decision.
        void check(String stage, String identifier, String clientIp, Integer accountId,
                   boolean allowed, Reason reason, Long wait) {
            int current = ++order;
            long offset = Duration.between(T0, clock.instant()).getSeconds();
            System.out.println("Input: request=" + current + "; offsetSeconds=" + offset
                    + "; identifier=" + identifier + "; clientIp=" + clientIp + "; accountId=" + accountId);
            Decision actual = assertDoesNotThrow(() -> {
                try {
                    return limiter.tryAcquire(identifier, clientIp, accountId);
                } catch (RuntimeException | Error ex) {
                    System.out.println("Unexpected exception: request=" + current + "; " + ex);
                    throw ex;
                }
            });
            System.out.println("Timeline: {\"order\":" + current + ",\"offset\":" + offset
                    + ",\"clock\":\"" + clock.instant() + "\",\"stage\":\"" + stage
                    + "\",\"identifier\":\"" + identifier + "\",\"clientIp\":\"" + clientIp
                    + "\",\"accountId\":" + accountId + ",\"allowed\":"
                    + (actual == null ? "null" : actual.allowed()) + ",\"reason\":"
                    + (actual == null || actual.reason() == null ? "null" : "\"" + actual.reason() + "\"")
                    + ",\"retryAfterSeconds\":" + (actual == null ? "null" : actual.retryAfterSeconds()) + "}");
            System.out.println("Verify request " + current + ": expected allowed=" + allowed + "; reason=" + reason
                    + "; retryAfterSeconds=" + (wait == null ? "not specified for this blocked setup" : wait));
            assertNotNull(actual, "Decision for request " + current);
            assertAll("Decision for request " + current,
                    () -> assertEquals(allowed, actual.allowed(), "allowed"),
                    () -> { if (reason == null) assertNull(actual.reason(), "reason");
                            else assertEquals(reason, actual.reason(), "reason"); },
                    () -> { if (wait != null) assertEquals(wait.longValue(), actual.retryAfterSeconds(), "retryAfterSeconds"); });
            System.out.println("Request assertions: PASSED; request=" + current);
        }

        void allowSetup(String identifier, String clientIp, Integer accountId) {
            check("setup", identifier, clientIp, accountId, true, null, 0L);
        }

        void passed() { passed = true; }

        @Override public void close() {
            System.out.println("Step 3 - Actual result: exact returned Decision fields are recorded in Timeline entries.");
            System.out.println("Step 4 - Verify expected result: every allowed setup checks non-null, true, null reason and zero wait;"
                    + " actions check all three fields. Case 009 blocked setup checks false and COOLDOWN as specified.");
            System.out.println("Assertion result: " + (passed ? "PASSED" : "FAILED"));
            System.out.println("==================================================");
        }
    }

    @Test void UT_RESETLIMIT_001() {
        try (var s = new Scenario("UT_RESETLIMIT_001", "allowed=true; reason=null; retryAfterSeconds=0")) {
            s.check("action", "user01", "192.0.2.1", 10, true, null, 0L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_002() {
        try (var s = new Scenario("UT_RESETLIMIT_002", "allowed=false; reason=COOLDOWN; retryAfterSeconds=50")) {
            s.allowSetup("user01", "192.0.2.1", 10);
            s.at(10);
            s.check("action", "user01", "192.0.2.1", 10, false, Reason.COOLDOWN, 50L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_003() {
        try (var s = new Scenario("UT_RESETLIMIT_003", "allowed=true; reason=null; retryAfterSeconds=0")) {
            s.allowSetup("user01", "192.0.2.1", 10);
            s.at(60);
            s.check("action", "user01", "192.0.2.1", 10, true, null, 0L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_004() {
        try (var s = new Scenario("UT_RESETLIMIT_004", "allowed=false; reason=COOLDOWN; retryAfterSeconds=50")) {
            s.allowSetup("user01", "192.0.2.1", 10);
            s.at(10);
            s.check("action", "user01@example.test", "192.0.2.2", 10, false, Reason.COOLDOWN, 50L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_005() {
        try (var s = new Scenario("UT_RESETLIMIT_005", "allowed=false; reason=TOO_MANY; retryAfterSeconds=3300")) {
            for (int i = 0; i < 5; i++) {
                s.at(i * 60L);
                s.allowSetup("unknown01", "192.0.2." + (i + 1), null);
            }
            s.at(300);
            s.check("action", "unknown01", "192.0.2.100", null, false, Reason.TOO_MANY, 3300L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_006() {
        try (var s = new Scenario("UT_RESETLIMIT_006", "allowed=false; reason=TOO_MANY; retryAfterSeconds=3300")) {
            for (int i = 0; i < 5; i++) {
                s.at(i * 60L);
                s.allowSetup("setup-alias-" + (i + 1), "192.0.2." + (i + 1), 10);
            }
            s.at(300);
            s.check("action", "new-alias", "192.0.2.100", 10, false, Reason.TOO_MANY, 3300L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_007() {
        try (var s = new Scenario("UT_RESETLIMIT_007", "allowed=false; reason=TOO_MANY; retryAfterSeconds=3600")) {
            for (int i = 1; i <= 20; i++) s.allowSetup("setup-user-" + i, "192.0.2.1", null);
            s.check("action", "new-identifier", "192.0.2.1", null, false, Reason.TOO_MANY, 3600L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_008() {
        try (var s = new Scenario("UT_RESETLIMIT_008", "allowed=false; reason=GLOBAL_LIMIT; retryAfterSeconds=86400")) {
            // Registered-account setup: every accountId is distinct and non-null.
            for (int i = 1; i <= 100; i++) s.allowSetup("setup-user-" + i, "192.0.2." + i, i);
            s.check("action", "unknown-new", "192.0.2.200", null, false, Reason.GLOBAL_LIMIT, 86400L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_009() {
        try (var s = new Scenario("UT_RESETLIMIT_009", "allowed=true; reason=null; retryAfterSeconds=0")) {
            s.allowSetup("user01", "192.0.2.1", 10);
            s.at(30);
            s.check("setup-blocked", "user01", "192.0.2.1", 10, false, Reason.COOLDOWN, null);
            s.at(60);
            s.check("action", "user01", "192.0.2.1", 10, true, null, 0L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_010() {
        try (var s = new Scenario("UT_RESETLIMIT_010", "allowed=true; reason=null; retryAfterSeconds=0")) {
            for (int i = 0; i < 5; i++) {
                s.at(i * 60L);
                s.allowSetup("unknown01", "192.0.2." + (i + 1), null);
            }
            s.at(3600);
            s.check("action", "unknown01", "192.0.2.100", null, true, null, 0L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_011() {
        try (var s = new Scenario("UT_RESETLIMIT_011", "allowed=true; reason=null; retryAfterSeconds=0")) {
            // Registered-account setup, matching case 008; all 100 Decisions are asserted.
            for (int i = 1; i <= 100; i++) s.allowSetup("setup-user-" + i, "192.0.2." + i, i);
            s.at(86400);
            s.check("action", "new-user", "192.0.2.200", 200, true, null, 0L);
            s.passed();
        }
    }

    @Test void UT_RESETLIMIT_012() {
        try (var s = new Scenario("UT_RESETLIMIT_012", "allowed=true; reason=null; retryAfterSeconds=0")) {
            // Deliberately different from 008/011: every setup accountId is null.
            for (int i = 1; i <= 100; i++) s.allowSetup("setup-user-" + i, "192.0.2." + i, null);
            s.check("action", "registered-user", "192.0.2.200", 200, true, null, 0L);
            s.passed();
        }
    }
}
