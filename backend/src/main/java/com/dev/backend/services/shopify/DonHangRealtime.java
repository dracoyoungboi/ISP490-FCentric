package com.dev.backend.services.shopify;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Broadcast invalidation only; clients must re-fetch through the authorized order API. */
@Service
public class DonHangRealtime {
    private final Set<SseEmitter> listeners = ConcurrentHashMap.newKeySet();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(120_000L);
        listeners.add(emitter);
        emitter.onCompletion(() -> listeners.remove(emitter));
        emitter.onTimeout(() -> { listeners.remove(emitter); emitter.complete(); });
        emitter.onError(e -> listeners.remove(emitter));
        send(emitter, "ready");
        return emitter;
    }

    public void changed() { listeners.forEach(e -> send(e, "orders-changed")); }

    @Scheduled(fixedDelay = 20_000)
    public void heartbeat() { listeners.forEach(e -> send(e, "heartbeat")); }

    private void send(SseEmitter emitter, String event) {
        try { emitter.send(SseEmitter.event().name(event).data("refresh")); }
        catch (Exception error) { listeners.remove(emitter); emitter.complete(); }
    }
}
