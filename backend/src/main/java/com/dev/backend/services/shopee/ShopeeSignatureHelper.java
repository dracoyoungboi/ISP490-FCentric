package com.dev.backend.services.shopee;

import com.dev.backend.i18n.LoiChungException;
import com.dev.backend.i18n.LoiThamSoException;
import com.dev.backend.i18n.ThongDiep;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;

/**
 * Tiện ích tạo và kiểm tra chữ ký số HMAC-SHA256 theo đặc tả Shopee Open Platform API v2.
 * Công thức chuỗi Base String:
 * - Public API: partner_id + path + timestamp
 * - Shop API: partner_id + path + timestamp + access_token + shop_id
 * - Merchant API: partner_id + path + timestamp + access_token + merchant_id
 */
@Slf4j
public class ShopeeSignatureHelper {

    private static final String HMAC_SHA256 = "HmacSHA256";

    /**
     * Tạo chữ ký số HMAC-SHA256 trả về chuỗi hex chữ thường (lowercase).
     */
    public static String sign(String partnerKey, String baseString) {
        if (partnerKey == null || partnerKey.isBlank() || baseString == null) {
            throw new LoiThamSoException(ThongDiep.of("kenhBan.partnerKeyBaseStringTrong"));
        }
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKeySpec = new SecretKeySpec(partnerKey.trim().getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
            mac.init(secretKeySpec);
            byte[] bytes = mac.doFinal(baseString.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            log.error("[SHOPEE-SIGN] Lỗi khi tạo chữ ký HMAC-SHA256: {}", e.getMessage());
            throw new LoiChungException(ThongDiep.of("kenhBan.khongTheTaoChuKyShopee", e.getMessage()), e);
        }
    }

    /**
     * Tạo chuỗi Base String cho Shop API (các API tương tác đơn hàng, tồn kho, bưu cục).
     */
    public static String buildShopBaseString(String partnerId, String apiPath, long timestamp, String accessToken, String shopId) {
        return (partnerId != null ? partnerId.trim() : "")
                + (apiPath != null ? apiPath.trim() : "")
                + timestamp
                + (accessToken != null ? accessToken.trim() : "")
                + (shopId != null ? shopId.trim() : "");
    }

    /**
     * Tạo chuỗi Base String cho Public API (lấy token, refresh token).
     */
    public static String buildPublicBaseString(String partnerId, String apiPath, long timestamp) {
        return (partnerId != null ? partnerId.trim() : "")
                + (apiPath != null ? apiPath.trim() : "")
                + timestamp;
    }
}

