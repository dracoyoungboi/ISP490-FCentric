package com.dev.backend.services.impl.payos;

/** Bộ khóa payOS đã giải mã — chỉ sống trong bộ nhớ, không log, không trả về client. */
public record PayosCredentials(String clientId, String apiKey, String checksumKey) {
    @Override
    public String toString() {
        return "PayosCredentials[***]";
    }
}
