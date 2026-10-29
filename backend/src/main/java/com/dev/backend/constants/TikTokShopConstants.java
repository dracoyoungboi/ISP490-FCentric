package com.dev.backend.constants;

/**
 * Hằng số cấu hình và endpoint cho TikTok Shop Open API (Partner Platform v202309).
 */
public final class TikTokShopConstants {

    private TikTokShopConstants() {
    }

    /** Mã kênh bán hàng TikTok Shop trong hệ thống FCentric */
    public static final String MA_KENH_TIKTOK = "TIKTOK";

    /** Tiền tố số đơn hàng tạo từ TikTok Shop */
    public static final String TIEN_TO_DON_HANG = "TTS";

    /** URL cơ sở gọi API nghiệp vụ của TikTok Shop (Khu vực Đông Nam Á / Toàn cầu) */
    public static final String BASE_URL = "https://open-api.tiktokglobalshop.com";

    /** URL người bán đăng nhập Seller Center ủy quyền ứng dụng Partner */
    public static final String AUTH_URL_PARTNER = "https://services.tiktokshop.com/open/authorize";

    /** URL ủy quyền ứng dụng tùy biến (Custom App) */
    public static final String AUTH_URL_CUSTOM = "https://auth.tiktok-shops.com/oauth/authorize";

    /** Endpoint trao đổi authorization code lấy access token và refresh token */
    public static final String TOKEN_GET_URL = "https://auth.tiktok-shops.com/api/v2/token/get";

    /** Endpoint làm mới access token bằng refresh token */
    public static final String TOKEN_REFRESH_URL = "https://auth.tiktok-shops.com/api/v2/token/refresh";

    /** Đường dẫn API lấy danh sách gian hàng ủy quyền và trích xuất shop_cipher */
    public static final String PATH_AUTHORIZED_SHOPS = "/authorization/202309/shops";

    /** Đường dẫn API lấy danh sách kho hàng logistics (warehouses) */
    public static final String PATH_WAREHOUSES = "/logistics/202309/warehouses";

    /** Đường dẫn API tìm kiếm sản phẩm và SKU phân loại */
    public static final String PATH_PRODUCTS_SEARCH = "/product/202309/products/search";

    /** Đường dẫn mẫu cập nhật tồn kho biến thể theo sản phẩm cha */
    public static final String PATH_INVENTORY_UPDATE = "/product/202309/products/%s/inventory/update";

    /** Đường dẫn API tìm kiếm danh sách đơn hàng */
    public static final String PATH_ORDERS_SEARCH = "/order/202309/orders/search";

    /** Đường dẫn API lấy chi tiết đơn hàng theo danh sách ID */
    public static final String PATH_ORDERS_DETAIL = "/order/202309/orders";

    /** Tên HTTP Header mang Access Token cho các request gọi tới TikTok Open API v202309 */
    public static final String HEADER_ACCESS_TOKEN = "x-tts-access-token";

    /** Thuật toán ký số HMAC-SHA256 theo chuẩn TikTok Shop */
    public static final String SIGN_ALGORITHM = "HmacSHA256";

    /** Thời hạn ủy quyền mặc định cảnh báo sắp hết hạn (7 ngày) */
    public static final int SO_NGAY_NHAC_UY_QUYEN = 7;
}
