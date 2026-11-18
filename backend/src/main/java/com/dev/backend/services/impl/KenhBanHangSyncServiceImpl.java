package com.dev.backend.services.impl;

import com.dev.backend.entities.DonBanHang;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.KenhBanHangSyncService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class KenhBanHangSyncServiceImpl implements KenhBanHangSyncService {

    private final DonBanHangRepository donBanHangRepository;
    private final KenhBanHangService kenhBanHangService;
    private final KenhBanHangDongBoService kenhBanHangDongBoService;

    public KenhBanHangSyncServiceImpl(
            DonBanHangRepository donBanHangRepository,
            KenhBanHangService kenhBanHangService,
            @Lazy KenhBanHangDongBoService kenhBanHangDongBoService) {
        this.donBanHangRepository = donBanHangRepository;
        this.kenhBanHangService = kenhBanHangService;
        this.kenhBanHangDongBoService = kenhBanHangDongBoService;
    }

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
                    log.info("KenhBanHangSync: Đã nạp thành công Credential Shopify (API: {}), bắt đầu đồng bộ xuất kho đơn {}", apiUrl, don.getSoDonHang());
                    if (don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank() && kenhBanHangDongBoService != null) {
                        kenhBanHangDongBoService.dongBoTrangThaiFulfilledShopify(don.getId(), don.getMaDonHangKenh());
                    }
                }
            } else if ("LAZADA".equalsIgnoreCase(maKenh) || "LAZADA_SANDBOX".equalsIgnoreCase(maKenh)) {
                String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
                String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
                if (token == null || token.isBlank()) {
                    log.warn("KenhBanHangSync: Kênh bán {} chưa cấu hình Access Token trong DB, bỏ qua gọi API ngoài.", maKenh);
                } else {
                    log.info("KenhBanHangSync: Đã nạp thành công Credential {} (AppKey: {}), sẵn sàng đồng bộ trạng thái đơn {} sang {}", maKenh, appKey, don.getSoDonHang(), maKenh);
                    if (don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank() && kenhBanHangDongBoService != null) {
                        kenhBanHangDongBoService.dongBoTrangThaiReadyToShipLazada(don.getMaDonHangKenh());
                    }
                }
            } else if ("TIKTOK".equalsIgnoreCase(maKenh) || "TIKTOK_SHOP".equalsIgnoreCase(maKenh)) {
                String appKey = kenhBanHangService.getTikTokAppKey();
                String token = kenhBanHangService.getDecryptedTikTokAccessToken();
                if (token == null || token.isBlank()) {
                    log.warn("KenhBanHangSync: Kênh bán TikTok Shop chưa cấu hình Access Token trong DB, bỏ qua gọi API ngoài.");
                } else {
                    log.info("KenhBanHangSync: Đã nạp thành công Credential TikTok Shop (AppKey: {}), sẵn sàng xác nhận xuất kho cho đơn {}", appKey, don.getSoDonHang());
                    if (don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank() && kenhBanHangDongBoService != null) {
                        kenhBanHangDongBoService.dongBoTrangThaiReadyToShipTikTok(don.getMaDonHangKenh());
                    }
                }
            } else if (OmnichannelOrderSyncJob.isShopee(maKenh)) {
                log.info("KenhBanHangSync: Bắt đầu đồng bộ xuất kho đơn {} sang Shopee", don.getSoDonHang());
                if (don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank() && kenhBanHangDongBoService != null) {
                    kenhBanHangDongBoService.dongBoTrangThaiXuatKhoShopee(don.getId(), don.getMaDonHangKenh());
                }
            }

            // Ghi nhận trạng thái push thành công vào log
            log.info("KenhBanHangSync: Đã hoàn tất push trạng thái đơn hàng {} sang kênh {}", don.getSoDonHang(), tenKenh);
        } catch (LoiCoMaException e) {
            // Lỗi đã biết (vd. Shopify từ chối khóa làm mới): một dòng cảnh báo, không in stack trace sau mỗi lần xuất kho
            log.warn("KenhBanHangSync: Không đồng bộ trạng thái đơn hàng ID {} sang kênh bán: {}", donBanHangId, e.getMessage());
        } catch (Exception e) {
            log.error("KenhBanHangSync: Lỗi khi đồng bộ trạng thái đơn hàng ID {} sang kênh bán: {}",
                    donBanHangId, e.getMessage(), e);
        }
    }
}

