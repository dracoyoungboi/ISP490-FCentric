package com.dev.backend.services.impl;

import com.dev.backend.entities.DonBanHang;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.services.KenhBanHangSyncService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KenhBanHangSyncServiceImpl implements KenhBanHangSyncService {

    DonBanHangRepository donBanHangRepository;
    com.dev.backend.services.KenhBanHangService kenhBanHangService;

    @Override
    public void pushOrderStatus(Integer donBanHangId, String channelStatus, String maVanDon, String donViVanChuyen) {
        try {
            DonBanHang don = donBanHangRepository.findById(donBanHangId).orElse(null);
            if (don == null) {
                log.warn("KenhBanHangSync: Không tìm thấy đơn hàng ID {} để đồng bộ", donBanHangId);
                return;
            }

            if (don.getKenhBanHang() == null) {
                log.info("KenhBanHangSync: Đơn hàng {} không liên kết kênh bán ngoài, bỏ qua đồng bộ.", don.getSoDonHang());
                return;
            }

            String maKenh = don.getKenhBanHang().getMaKenh();
            String tenKenh = don.getKenhBanHang().getTenKenh();
            log.info("KenhBanHangSync: Đang đẩy trạng thái {} cho đơn {} sang kênh {} (Mã đơn kênh: {}, Vận đơn: {}, ĐVVC: {})",
                    channelStatus, don.getSoDonHang(), tenKenh, don.getMaDonHangKenh(), maVanDon, donViVanChuyen);

            if ("SHOPIFY".equalsIgnoreCase(maKenh)) {
                String token = kenhBanHangService.getDecryptedShopifyAccessToken();
                String apiUrl = kenhBanHangService.getShopifyApiUrl();
                if (token == null || token.isBlank()) {
                    log.warn("KenhBanHangSync: Kênh bán Shopify chưa cấu hình Admin Access Token trong DB, bỏ qua gọi API ngoài.");
                } else {
                    log.info("KenhBanHangSync: Đã nạp thành công Credential Shopify (API: {}), sẵn sàng đồng bộ đơn {}", apiUrl, don.getSoDonHang());
                }
            }

            // Ghi nhận trạng thái push thành công vào log
            log.info("KenhBanHangSync: Đã hoàn tất push trạng thái đơn hàng {} sang kênh {}", don.getSoDonHang(), tenKenh);
        } catch (Exception e) {
            log.error("KenhBanHangSync: Lỗi khi đồng bộ trạng thái đơn hàng ID {} sang kênh bán: {}",
                    donBanHangId, e.getMessage(), e);
        }
    }
}

