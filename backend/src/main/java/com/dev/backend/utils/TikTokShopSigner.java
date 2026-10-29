package com.dev.backend.utils;

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
}
