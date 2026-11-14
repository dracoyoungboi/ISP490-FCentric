package com.dev.backend.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.Instant;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "kenh_ban_hang")
// Chỉ ghi cột đã đổi: lưu cấu hình kênh từ một entity nạp trước lúc ngắt kết nối không được ghi lại khóa vừa xóa
@DynamicUpdate
public class KenhBanHang {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "ma_kenh", nullable = false, unique = true, length = 50)
    String maKenh;

    @Size(max = 100)
    @NotNull
    @Column(name = "ten_kenh", nullable = false, length = 100)
    String tenKenh;

    @ColumnDefault("'online'")
    @Column(name = "loai_kenh", length = 20)
    @Builder.Default
    String loaiKenh = "online";

    @Size(max = 2000)
    @Column(name = "api_url", columnDefinition = "TEXT")
    String apiUrl;

    @Size(max = 4000)
    @Column(name = "api_key", columnDefinition = "TEXT")
    String apiKey;

    @Size(max = 4000)
    @Column(name = "api_secret", columnDefinition = "TEXT")
    String apiSecret;

    @Size(max = 100)
    @Column(name = "client_id", length = 100)
    String clientId;

    @Size(max = 4000)
    @Column(name = "refresh_token", columnDefinition = "TEXT")
    String refreshToken;

    @Size(max = 255)
    @Column(name = "shop_cipher", length = 255)
    String shopCipher;

    @Column(name = "token_expires_at", columnDefinition = "DATETIME(6)")
    Instant tokenExpiresAt;

    @ColumnDefault("1")
    @Column(name = "trang_thai")
    @Builder.Default
    Integer trangThai = 1;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_tao")
    Instant ngayTao;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Generated(event = EventType.INSERT)
    @Column(name = "ngay_cap_nhat")
    Instant ngayCapNhat;

    /**
     * Tiện ích lấy mã Shop Cipher đối với kênh bán hàng TikTok Shop
     */
    public String getShopCipher() {
        if (this.shopCipher != null && !this.shopCipher.isBlank()) {
            return this.shopCipher.trim();
        }
        if (!"TIKTOK".equalsIgnoreCase(this.maKenh) || this.apiUrl == null) return null;
        if (this.apiUrl.contains("::")) {
            String[] parts = this.apiUrl.split("::", 2);
            return parts.length > 1 && !parts[1].isBlank() ? parts[1].trim() : null;
        }
        if (this.apiUrl.matches("^\\d+$")) {
            return null;
        }
        return this.apiUrl;
    }

    public void setShopCipher(String cipher) {
        this.shopCipher = (cipher != null && !cipher.isBlank()) ? cipher.trim() : null;
        if ("TIKTOK".equalsIgnoreCase(this.maKenh)) {
            String sid = getServiceId();
            if (sid != null && !sid.isBlank()) {
                this.apiUrl = sid + "::" + (cipher != null ? cipher.trim() : "");
            }
        }
    }

    /**
     * Tiện ích lấy Service ID đối với kênh bán hàng TikTok Shop (Partner Center)
     */
    public String getServiceId() {
        if (!"TIKTOK".equalsIgnoreCase(this.maKenh) || this.apiUrl == null) return null;
        if (this.apiUrl.contains("::")) {
            String sid = this.apiUrl.split("::", 2)[0].trim();
            return !sid.isBlank() ? sid : null;
        }
        if (this.apiUrl.matches("^\\d+$")) {
            return this.apiUrl.trim();
        }
        return null;
    }

    public void setServiceId(String serviceId) {
        if ("TIKTOK".equalsIgnoreCase(this.maKenh)) {
            String cipher = getShopCipher();
            if (cipher != null && !cipher.isBlank()) {
                this.apiUrl = (serviceId != null ? serviceId.trim() : "") + "::" + cipher;
            } else {
                this.apiUrl = serviceId != null ? serviceId.trim() : null;
            }
        }
    }

    /**
     * Tiện ích lấy / gán Shop Domain hoặc Shop ID định danh (Shopify / Shopee)
     */
    public String getShopDomain() {
        if (this.maKenh != null && this.maKenh.toUpperCase().contains("SHOPEE")) {
            if (this.shopCipher != null && !this.shopCipher.isBlank() && this.shopCipher.matches("^\\d+$")) {
                return this.shopCipher.trim();
            }
            if (this.apiUrl != null && this.apiUrl.matches("^\\d+$")) {
                return this.apiUrl.trim();
            }
            return null;
        }
        return this.apiUrl;
    }

    public void setShopDomain(String shopDomain) {
        if (this.maKenh != null && this.maKenh.toUpperCase().contains("SHOPEE")) {
            if (shopDomain != null && shopDomain.matches("^\\d+$")) {
                this.shopCipher = shopDomain.trim();
                return;
            } else if (shopDomain == null || shopDomain.isBlank()) {
                this.shopCipher = null;
                return;
            }
        }
        this.apiUrl = shopDomain != null ? shopDomain.trim() : null;
    }
}

