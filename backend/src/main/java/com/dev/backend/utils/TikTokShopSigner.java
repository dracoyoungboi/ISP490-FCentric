package com.dev.backend.utils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.TreeSet;

/**
 * Tiện ích hỗ trợ thuật toán ký số theo chuẩn TikTok Shop Open Platform (API v202309).
 * Quy tắc ký số v202309:
 * 1. Lọc bỏ các tham số "sign" và "access_token" khỏi danh sách tham số URL.
 * 2. Sắp xếp tất cả các khóa tham số còn lại theo thứ tự bảng chữ cái ASCII tăng dần.
 * 3. Nối chuỗi cơ sở bao bọc bằng app_secret.
 * 4. Băm HMAC-SHA256 và định dạng thành chuỗi hex viết thường (lowercase).
 */
public final class TikTokShopSigner {

    private TikTokShopSigner() {
    }

    /**
     * Trích xuất và sắp xếp các tham số truy vấn theo thứ tự từ điển ASCII.
     * Tự động loại trừ các khóa "sign" và "access_token" theo đặc tả TikTok Shop v202309.
     *
     * @param parameters Danh sách tham số query
     * @return Tập hợp các khóa hợp lệ đã được sắp xếp
     */
    public static TreeSet<String> extractSortedKeys(Map<String, String> parameters) {
        TreeSet<String> sortedKeys = new TreeSet<>();
        if (parameters == null || parameters.isEmpty()) {
            return sortedKeys;
        }

        for (Map.Entry<String, String> entry : parameters.entrySet()) {
            String key = entry.getKey();
            if (key != null && !key.isBlank() && !"sign".equalsIgnoreCase(key) && !"access_token".equalsIgnoreCase(key) && entry.getValue() != null) {
                sortedKeys.add(key);
            }
        }
        return sortedKeys;
    }

    /**
     * Xây dựng chuỗi cơ sở để băm HMAC-SHA256 theo quy chuẩn TikTok Shop Open Platform v202309:
     * Format: app_secret + api_path + [key1][val1][key2][val2]... + [body] + app_secret
     *
     * @param apiPath    Đường dẫn API (bắt đầu bằng /)
     * @param parameters Tham số query
     * @param body       Payload JSON body (nếu request GET hoặc không có body thì null hoặc rỗng)
     * @param appSecret  Khóa bí mật của ứng dụng TikTok Shop Partner
     * @return Chuỗi cơ sở hoàn chỉnh đã được bao bọc bởi appSecret
     */
    public static String buildBaseStringToSign(String apiPath, Map<String, String> parameters, String body, String appSecret) {
        if (appSecret == null || appSecret.isBlank()) {
            throw new IllegalArgumentException("App Secret của TikTok Shop không được để trống khi tạo chuỗi ký");
        }
        String path = (apiPath != null) ? apiPath : "";

        StringBuilder sb = new StringBuilder();
        // 1. Tiền tố app_secret
        sb.append(appSecret);

        // 2. Đường dẫn apiPath
        sb.append(path);

        // 3. Sắp xếp và nối các cặp tham số query (loại trừ sign và access_token)
        TreeSet<String> sortedKeys = extractSortedKeys(parameters);
        for (String key : sortedKeys) {
            String value = parameters.get(key);
            sb.append(key).append(value != null ? value : "");
        }

        // 4. Nếu có body, nối trực tiếp chuỗi raw body
        if (body != null && !body.isBlank()) {
            sb.append(body);
        }

        // 5. Hậu tố app_secret
        sb.append(appSecret);

        return sb.toString();
    }

    /**
     * Tính chữ ký số HMAC-SHA256 theo chuẩn TikTok Shop Open Platform v202309.
     * Kết quả trả về là chuỗi Hexadecimal viết thường (lowercase).
     *
     * @param apiPath    Đường dẫn API (vd: /authorization/202309/shops)
     * @param parameters Các tham số URL (app_key, timestamp, shop_cipher,...)
     * @param body       Payload JSON body (truyền null nếu request GET)
     * @param appSecret  Khóa bí mật của Partner App
     * @return Chuỗi chữ ký số HMAC-SHA256 viết thường (hex lowercase)
     */
    public static String calculateSignature(String apiPath, Map<String, String> parameters, String body, String appSecret) {
        String baseString = buildBaseStringToSign(apiPath, parameters, body, appSecret);
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(baseString.getBytes(StandardCharsets.UTF_8));

            // Chuyển sang định dạng hex viết thường (lowercase hex) theo chuẩn TikTok Shop
            StringBuilder hexString = new StringBuilder(2 * hmacBytes.length);
            for (byte b : hmacBytes) {
                hexString.append(String.format("%02x", b & 0xff));
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Lỗi khi tạo chữ ký số HMAC-SHA256 cho TikTok Shop API", e);
        }
    }
}
