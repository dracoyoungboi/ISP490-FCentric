package com.dev.backend.utils;

import com.fasterxml.jackson.databind.JsonNode;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Chữ ký HMAC-SHA256 theo tài liệu payOS.
 * - Tạo link: "amount=..&cancelUrl=..&description=..&orderCode=..&returnUrl=.."
 * - Webhook/response: sắp xếp khóa của object data theo a→z, nối "key=value&...",
 *   null -> "", object/array -> chuỗi JSON.
 */
public final class PayosSignature {

    private PayosSignature() {
    }

    public static String forCreatePaymentLink(long amount, String cancelUrl, String description,
                                              long orderCode, String returnUrl, String checksumKey) {
        String data = "amount=" + amount
                + "&cancelUrl=" + cancelUrl
                + "&description=" + description
                + "&orderCode=" + orderCode
                + "&returnUrl=" + returnUrl;
        return hmacSha256Hex(data, checksumKey);
    }

    /** Chuỗi dữ liệu đã chuẩn hóa của object data (dùng cho webhook). */
    public static String canonicalData(JsonNode data) {
        List<String> keys = new ArrayList<>();
        Iterator<String> it = data.fieldNames();
        while (it.hasNext()) keys.add(it.next());
        keys.sort(String::compareTo);
        return keys.stream()
                .map(k -> k + "=" + valueOf(data.get(k)))
                .collect(Collectors.joining("&"));
    }

    public static String forData(JsonNode data, String checksumKey) {
        return hmacSha256Hex(canonicalData(data), checksumKey);
    }

    /** So sánh hằng thời gian để tránh lộ chữ ký qua thời gian phản hồi. */
    public static boolean verifyData(JsonNode data, String signature, String checksumKey) {
        if (data == null || signature == null || checksumKey == null) return false;
        byte[] expected = forData(data, checksumKey).getBytes(StandardCharsets.UTF_8);
        byte[] actual = signature.trim().toLowerCase().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }

    private static String valueOf(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) return "";
        if (node.isContainerNode()) return node.toString();
        String text = node.asText();
        return "null".equals(text) || "undefined".equals(text) ? "" : text;
    }

    static String hmacSha256Hex(String data, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Không thể tính chữ ký payOS", e);
        }
    }
}
