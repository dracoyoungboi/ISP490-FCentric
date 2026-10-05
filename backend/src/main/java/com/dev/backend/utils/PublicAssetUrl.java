package com.dev.backend.utils;

/**
 * Chuẩn hoá URL công khai của asset (ảnh sản phẩm, logo thương hiệu, logo công ty)
 * trước khi trả về cho client.
 *
 * MinIO lưu đường dẫn công khai theo IP nội bộ {@code http://171.244.142.43:9000}.
 * Trên website HTTPS, trình duyệt chặn mọi request HTTP tới địa chỉ IP này
 * (Mixed Content) nên ảnh/logo không tải được. Utility đổi ĐÚNG origin legacy
 * sang tên miền công khai {@code https://minio.slmglobal.vn}, giữ nguyên
 * object path và query string phía sau.
 */
public final class PublicAssetUrl {

    /** Origin legacy do MinIO trả về khi lưu đường dẫn công khai. */
    private static final String LEGACY_ORIGIN = "http://171.244.142.43:9000";

    /** Origin công khai HTTPS tương ứng. */
    private static final String HTTPS_ORIGIN = "https://minio.slmglobal.vn";

    private PublicAssetUrl() {
        // Utility class — không khởi tạo
    }

    /**
     * Trả URL đã chuẩn hoá; {@code null} vào -> {@code null} ra.
     * Chỉ đổi khi URL bắt đầu đúng origin legacy và ký tự ngay sau origin
     * là ranh giới hợp lệ ({@code '/'}, {@code '?'} hoặc hết chuỗi) — host/port
     * na ná (ví dụ {@code 171.244.142.43:90000}, {@code ...:9000.evil.com})
     * không bị đổi. URL HTTPS, asset tương đối, localhost và URL không liên
     * quan được giữ nguyên.
     */
    public static String toHttps(String url) {
        if (url == null) {
            return null;
        }
        if (url.startsWith(LEGACY_ORIGIN) && isOriginBoundary(url, LEGACY_ORIGIN.length())) {
            return HTTPS_ORIGIN + url.substring(LEGACY_ORIGIN.length());
        }
        return url;
    }

    /** Ký tự ngay sau origin phải là ranh giới hợp lệ ('/' hoặc '?' hoặc hết chuỗi). */
    private static boolean isOriginBoundary(String url, int originLength) {
        if (url.length() == originLength) {
            return true;
        }
        char next = url.charAt(originLength);
        return next == '/' || next == '?';
    }
}
