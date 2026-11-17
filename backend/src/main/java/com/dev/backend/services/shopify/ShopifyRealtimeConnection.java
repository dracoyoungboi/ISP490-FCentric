package com.dev.backend.services.shopify;

import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.utils.PaymentSecretCipher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ShopifyRealtimeConnection {
    private final KenhBanHangRepository channels;
    private final PaymentSecretCipher cipher;
    public ShopifyRealtimeConnection(KenhBanHangRepository channels, PaymentSecretCipher cipher) {
        this.channels = channels;
        this.cipher = cipher;
    }

    @Transactional(readOnly = true)
    public KenhBanHang current() {
        return channels.findByMaKenh("SHOPIFY").filter(c -> Integer.valueOf(1).equals(c.getTrangThai())).orElse(null);
    }

    public String domain(KenhBanHang channel) {
        if (channel == null || channel.getApiUrl() == null) return "";
        String domain = channel.getApiUrl().trim().toLowerCase(java.util.Locale.ROOT)
                .replaceFirst("^https?://", "").split("/")[0];
        return domain.matches("[a-z0-9][a-z0-9-]*\\.myshopify\\.com") ? domain : "";
    }

    public String signingSecret(KenhBanHang channel) {
        return channel == null || channel.getApiSecret() == null || channel.getApiSecret().isBlank()
                ? null : cipher.decrypt(channel.getApiSecret());
    }
}
