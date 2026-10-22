package com.dev.backend.utils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.TreeSet;

/**
 * Tiện ích tạo chữ ký số HMAC-SHA256 theo chuẩn Lazada Open Platform (LazOP).
 * Quy tắc:
 * 1. Thu thập tất cả các tham số (hệ thống và nghiệp vụ), loại trừ tham số "sign".
 * 2. Sắp xếp các tham số theo thứ tự tăng dần của bảng mã ASCII (a-z).
 * 3. Ghép chuỗi: apiPath + key1 + val1 + key2 + val2 + ...
 * 4. Băm bằng HMAC-SHA256 với appSecret của ứng dụng.
 * 5. Định dạng kết quả thành chuỗi Hexadecimal viết HOA.
 */
public final class LazadaSignatureHelper {

    public static final String SIGN_METHOD_SHA256 = "sha256";

    private LazadaSignatureHelper() {
    }

    public static String calculateSignature(String apiPath, Map<String, String> parameters, String appSecret) {
        if (appSecret == null || appSecret.isBlank()) {
            throw new IllegalArgumentException("App Secret của Lazada không được để trống khi tính chữ ký số");
        }
        if (apiPath == null) {
            apiPath = "";
        }

        try {
            // 1 & 2. Sắp xếp các khóa theo thứ tự bảng mã ASCII (loại trừ "sign")
            TreeSet<String> sortedKeys = new TreeSet<>();
            if (parameters != null) {
                for (String key : parameters.keySet()) {
                    if (key != null && !"sign".equalsIgnoreCase(key) && parameters.get(key) != null) {
                        sortedKeys.add(key);
                    }
                }
            }

            // 3. Ghép chuỗi ký: apiPath + key1 + val1 + ...
            StringBuilder sb = new StringBuilder(apiPath);
            for (String key : sortedKeys) {
                sb.append(key).append(parameters.get(key));
            }

            // 4. Băm HMAC-SHA256
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(sb.toString().getBytes(StandardCharsets.UTF_8));

            // 5. Chuyển thành Hex in HOA
            StringBuilder hexString = new StringBuilder(2 * hmacBytes.length);
            for (byte b : hmacBytes) {
                hexString.append(String.format("%02X", b & 0xff));
            }

            return hexString.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Lỗi khi tạo chữ ký HMAC-SHA256 cho Lazada API", e);
        }
    }
}
