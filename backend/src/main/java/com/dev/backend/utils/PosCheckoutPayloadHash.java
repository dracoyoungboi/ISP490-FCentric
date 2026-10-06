package com.dev.backend.utils;

import com.dev.backend.dto.request.PosCheckoutCreating;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.stream.Collectors;

/**
 * Hash chuẩn hóa payload checkout (SHA-256 hex) để so khớp idempotency:
 * items sắp theo bienTheSanPhamId, số tiền dùng toPlainString, ghi chú trim —
 * cùng payload dù thứ tự items khác nhau vẫn cùng hash.
 */
public final class PosCheckoutPayloadHash {

    private PosCheckoutPayloadHash() {
        // Utility class
    }

    public static String of(PosCheckoutCreating request) {
        String items = request.getItems() == null
                ? ""
                : request.getItems().stream()
                        .sorted(Comparator.comparing(
                                PosCheckoutCreating.PosCheckoutItemCreating::getBienTheSanPhamId,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .map(item -> (item.getBienTheSanPhamId() == null ? "" : item.getBienTheSanPhamId())
                                + ":" + (item.getQuantity() == null ? "" : item.getQuantity().toPlainString())
                                + ":" + (item.getUnitPriceClient() == null ? "" : item.getUnitPriceClient().toPlainString()))
                        .collect(Collectors.joining(";"));

        String payment = request.getPayment() == null
                ? "::"
                : (request.getPayment().getMethod() == null ? "" : request.getPayment().getMethod().toUpperCase())
                        + ":" + (request.getPayment().getTenderedAmount() == null
                                ? "" : request.getPayment().getTenderedAmount().toPlainString());

        String note = request.getNote() == null ? "" : request.getNote().trim();

        String canonical = (request.getRequestId() == null ? "" : request.getRequestId())
                + "|" + (request.getKhoId() == null ? "" : request.getKhoId())
                + "|" + (request.getKhachHangId() == null ? "" : request.getKhachHangId())
                + "|" + payment
                + "|" + note
                + "|" + items;

        return sha256(canonical);
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 không khả dụng", e);
        }
    }
}
