package com.dev.backend.services.omnichannel;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.function.Supplier;

/**
 * Ngữ cảnh {@link ThreadLocal} xác định kênh TMĐT và loại tác vụ (SCHEDULED_BATCH vs REALTIME_CRITICAL vs MANUAL)
 * cho các lời gọi API đối tác đi qua {@link OmnichannelTelemetryInterceptor}.
 */
public final class OmnichannelTelemetryContext {

    public static final String JOB_SCHEDULED_BATCH = "SCHEDULED_BATCH";
    public static final String JOB_REALTIME_CRITICAL = "REALTIME_CRITICAL";
    public static final String JOB_WEBHOOK_IN = "WEBHOOK_IN";
    public static final String JOB_MANUAL = "MANUAL";

    public record Frame(String channelCode, String jobType) {}

    private static final ThreadLocal<Deque<Frame>> HOLDER = ThreadLocal.withInitial(ArrayDeque::new);

    private OmnichannelTelemetryContext() {
    }

    public static void push(String channelCode, String jobType) {
        HOLDER.get().push(new Frame(channelCode, jobType));
    }

    public static void pop() {
        Deque<Frame> stack = HOLDER.get();
        if (!stack.isEmpty()) {
            stack.pop();
        }
        if (stack.isEmpty()) {
            HOLDER.remove();
        }
    }

    public static Frame current() {
        Deque<Frame> stack = HOLDER.get();
        return stack.isEmpty() ? null : stack.peek();
    }

    public static <T> T callWith(String channelCode, String jobType, Supplier<T> supplier) {
        push(channelCode, jobType);
        try {
            return supplier.get();
        } finally {
            pop();
        }
    }

    public static void runWith(String channelCode, String jobType, Runnable runnable) {
        push(channelCode, jobType);
        try {
            runnable.run();
        } finally {
            pop();
        }
    }
}

