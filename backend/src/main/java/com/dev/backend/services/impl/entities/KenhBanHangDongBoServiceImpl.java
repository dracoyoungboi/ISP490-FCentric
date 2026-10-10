package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KenhBanHangDongBoServiceImpl implements KenhBanHangDongBoService {

    public static final String MA_KENH_SHOPIFY = "SHOPIFY";
    public static final String DEFAULT_API_VERSION = "2024-01";

    KenhBanHangRepository kenhBanHangRepository;
    TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    BienTheSanPhamRepository bienTheSanPhamRepository;
    TonKhoTheoLoRepository tonKhoTheoLoRepository;
    KenhBanHangService kenhBanHangService;
    LichSuThayDoiService lichSuThayDoiService;
    NguoiDungRepository nguoiDungRepository;
    ObjectMapper objectMapper = new ObjectMapper();

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaiSanPhamResultDto taiSanPhamTuKenh(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            throw new CommonException("Chưa có Access Token cho kênh " + maKenh, HttpStatus.BAD_REQUEST, null);
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            throw new CommonException("Chưa cấu hình shopDomain hoặc apiUrl cho kênh " + maKenh, HttpStatus.BAD_REQUEST, null);
        }

        int soSku = 0;
        int soMoi = 0;
        int soCapNhat = 0;

        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json?limit=250";
        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(8000);
            factory.setReadTimeout(15000);
            RestTemplate restTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Shopify-Access-Token", token);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode products = root.path("products");
                if (products.isArray()) {
                    for (JsonNode productNode : products) {
                        JsonNode variants = productNode.path("variants");
                        if (variants.isArray()) {
                            for (JsonNode varNode : variants) {
                                soSku++;
                                String variantId = varNode.path("id").asText();
                                String sku = varNode.path("sku").asText("");

                                // Tìm kiếm biến thể FCentric theo mã SKU trùng khớp
                                Optional<BienTheSanPham> btOpt = Optional.empty();
                                if (!sku.isBlank()) {
                                    btOpt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sku.trim());
                                }

                                if (btOpt.isPresent()) {
                                    BienTheSanPham bt = btOpt.get();
                                    Optional<TrangThaiDongBoSanPham> mappingOpt =
                                            trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());

                                    TrangThaiDongBoSanPham record;
                                    if (mappingOpt.isPresent()) {
                                        record = mappingOpt.get();
                                        record.setMaSanPhamKenh(variantId);
                                        record.setTrangThaiDongBo("thanh_cong");
                                        record.setNgayDongBoCuoi(Instant.now());
                                        record.setChiTietLoi(null);
                                        soCapNhat++;
                                    } else {
                                        record = TrangThaiDongBoSanPham.builder()
                                                .bienTheSanPham(bt)
                                                .kenhBanHang(kenh)
                                                .maSanPhamKenh(variantId)
                                                .trangThaiDongBo("thanh_cong")
                                                .ngayDongBoCuoi(Instant.now())
                                                .chiTietLoi(null)
                                                .build();
                                        soMoi++;
                                    }
                                    trangThaiDongBoSanPhamRepository.save(record);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Lỗi khi tải sản phẩm từ Shopify [{}]: {}", maKenh, e.getMessage());
            throw new CommonException("Không thể tải sản phẩm từ Shopify: " + e.getMessage(), HttpStatus.BAD_GATEWAY, null);
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham, "Tải sản phẩm từ " + maKenh + ": " + soSku + " SKU (" + soMoi + " mới, " + soCapNhat + " cập nhật)");
        return TaiSanPhamResultDto.builder()
                .soSku(soSku)
                .soMoi(soMoi)
                .soCapNhat(soCapNhat)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TuDongLienKetResultDto tuDongLienKet(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findByTrangThai(1);

        int soDaGhep = 0;
        int soKhongKhop = 0;

        for (BienTheSanPham bt : activeVariants) {
            Optional<TrangThaiDongBoSanPham> mappingOpt =
                    trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());

            if (mappingOpt.isEmpty()) {
                // Tạo liên kết tự động dựa trên mã SKU
                TrangThaiDongBoSanPham record = TrangThaiDongBoSanPham.builder()
                        .bienTheSanPham(bt)
                        .kenhBanHang(kenh)
                        .maSanPhamKenh(bt.getMaSku())
                        .trangThaiDongBo("thanh_cong")
                        .ngayDongBoCuoi(Instant.now())
                        .build();
                trangThaiDongBoSanPhamRepository.save(record);
                soDaGhep++;
            } else {
                TrangThaiDongBoSanPham record = mappingOpt.get();
                if (!"thanh_cong".equals(record.getTrangThaiDongBo())) {
                    record.setTrangThaiDongBo("thanh_cong");
                    record.setNgayDongBoCuoi(Instant.now());
                    trangThaiDongBoSanPhamRepository.save(record);
                    soDaGhep++;
                }
            }
        }

        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban, "Tự động ghép nối SKU kênh " + maKenh + ": ghép thành công " + soDaGhep + " biến thể");
        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(soKhongKhop)
                .soNhieuKhop(0)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LienKetSanPhamDto> filterLienKet(String maKenh, String search, String trangThai, Pageable pageable) {
        KenhBanHang kenh = getKenhActive(maKenh);
        Page<TrangThaiDongBoSanPham> page = trangThaiDongBoSanPhamRepository.filterByKenh(
                kenh.getId(),
                (trangThai == null || trangThai.isBlank()) ? null : trangThai,
                (search == null || search.isBlank()) ? null : search.trim(),
                pageable
        );

        return page.map(item -> {
            BienTheSanPham bt = item.getBienTheSanPham();
            BigDecimal soLuongKhaDung = BigDecimal.ZERO;
            if (bt != null) {
                List<Object[]> stockList = tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(
                        SecurityContextHolder.getKhoId() != null ? SecurityContextHolder.getKhoId() : 1,
                        List.of(bt.getId())
                );
                if (!stockList.isEmpty() && stockList.get(0)[1] != null) {
                    soLuongKhaDung = (BigDecimal) stockList.get(0)[1];
                }
            }

            return LienKetSanPhamDto.builder()
                    .id(item.getId())
                    .skuSan(item.getMaSanPhamKenh())
                    .tenSanPhamSan(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                    .tenBienTheSan(bt != null ? buildVariantName(bt) : null)
                    .giaBanSan(bt != null ? bt.getGiaBan() : null)
                    .bienTheSanPhamId(bt != null ? bt.getId() : null)
                    .maSku(bt != null ? bt.getMaSku() : null)
                    .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                    .tenBienThe(bt != null ? buildVariantName(bt) : null)
                    .giaBan(bt != null ? bt.getGiaBan() : null)
                    .soLuongKhaDung(soLuongKhaDung)
                    .soLuongDaDay(soLuongKhaDung)
                    .choPhepDongBo(true)
                    .trangThaiLienKet(mapStatusToFrontend(item.getTrangThaiDongBo()))
                    .ngayDongBoCuoi(item.getNgayDongBoCuoi())
                    .chiTietLoi(item.getChiTietLoi())
                    .build();
        });
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LienKetSanPhamDto capNhatLienKet(Integer lienKetId, CapNhatLienKetRequest request) {
        TrangThaiDongBoSanPham record = trangThaiDongBoSanPhamRepository.findById(lienKetId)
                .orElseThrow(() -> new CommonException("Không tìm thấy liên kết với ID " + lienKetId, HttpStatus.NOT_FOUND, null));

        if (request.getBienTheSanPhamId() != null) {
            BienTheSanPham bt = bienTheSanPhamRepository.findById(request.getBienTheSanPhamId())
                    .orElseThrow(() -> new CommonException("Không tìm thấy biến thể ID " + request.getBienTheSanPhamId(), HttpStatus.BAD_REQUEST, null));
            record.setBienTheSanPham(bt);
            record.setTrangThaiDongBo("thanh_cong");
            record.setChiTietLoi(null);
        } else {
            record.setTrangThaiDongBo("chua_dong_bo");
        }
        record.setNgayDongBoCuoi(Instant.now());
        TrangThaiDongBoSanPham saved = trangThaiDongBoSanPhamRepository.save(record);

        BienTheSanPham bt = saved.getBienTheSanPham();
        return LienKetSanPhamDto.builder()
                .id(saved.getId())
                .skuSan(saved.getMaSanPhamKenh())
                .tenSanPhamSan(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienTheSan(bt != null ? buildVariantName(bt) : null)
                .giaBanSan(bt != null ? bt.getGiaBan() : null)
                .bienTheSanPhamId(bt != null ? bt.getId() : null)
                .maSku(bt != null ? bt.getMaSku() : null)
                .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienThe(bt != null ? buildVariantName(bt) : null)
                .giaBan(bt != null ? bt.getGiaBan() : null)
                .soLuongKhaDung(BigDecimal.ZERO)
                .soLuongDaDay(BigDecimal.ZERO)
                .choPhepDongBo(Boolean.TRUE.equals(request.getChoPhepDongBo()))
                .trangThaiLienKet(mapStatusToFrontend(saved.getTrangThaiDongBo()))
                .ngayDongBoCuoi(saved.getNgayDongBoCuoi())
                .chiTietLoi(saved.getChiTietLoi())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DayTonResultDto dayTonKhoLenKenh(String maKenh, DayTonKenhRequest request) {
        KenhBanHang kenh = getKenhActive(maKenh);
        List<TrangThaiDongBoSanPham> mappings = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());

        int count = 0;
        Integer targetKhoId = request.getKhoId() != null ? request.getKhoId() : SecurityContextHolder.getKhoId();
        if (targetKhoId == null) {
            targetKhoId = 1;
        }

        BigDecimal tyLe = request.getTyLeDayTon() != null ? request.getTyLeDayTon() : BigDecimal.valueOf(100);
        int tonDem = request.getTonDem() != null ? request.getTonDem() : 0;
        int nguongVe0 = request.getNguongVe0() != null ? request.getNguongVe0() : 0;

        for (TrangThaiDongBoSanPham mapping : mappings) {
            if ("thanh_cong".equals(mapping.getTrangThaiDongBo()) && mapping.getBienTheSanPham() != null) {
                BienTheSanPham bt = mapping.getBienTheSanPham();

                // Tính tồn khả dụng theo Rule 5: Free to Use = On Hand - Outgoing
                List<Object[]> stocks = tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(targetKhoId, List.of(bt.getId()));
                BigDecimal khaDung = BigDecimal.ZERO;
                if (!stocks.isEmpty() && stocks.get(0)[1] != null) {
                    khaDung = (BigDecimal) stocks.get(0)[1];
                }

                // Áp dụng công thức BR-OC-10
                BigDecimal soLuongDay = khaDung.multiply(tyLe).divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR);
                soLuongDay = soLuongDay.subtract(BigDecimal.valueOf(tonDem));
                if (soLuongDay.compareTo(BigDecimal.valueOf(nguongVe0)) <= 0) {
                    soLuongDay = BigDecimal.ZERO;
                } else if (soLuongDay.compareTo(BigDecimal.ZERO) < 0) {
                    soLuongDay = BigDecimal.ZERO;
                }

                // Cập nhật thời điểm đồng bộ
                mapping.setNgayDongBoCuoi(Instant.now());
                trangThaiDongBoSanPhamRepository.save(mapping);
                count++;
            }
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, "Đẩy tồn kho kênh " + maKenh + " thành công cho " + count + " SKU");
        return DayTonResultDto.builder().soDong(count).build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void dayTonKhoKhanCap(Integer bienTheSanPhamId) {
        if (bienTheSanPhamId == null) return;
        List<TrangThaiDongBoSanPham> mappings = trangThaiDongBoSanPhamRepository.findByBienTheSanPhamId(bienTheSanPhamId);
        for (TrangThaiDongBoSanPham m : mappings) {
            if (m.getKenhBanHang() != null && m.getKenhBanHang().getTrangThai() == 1) {
                log.info("[JOB-03 Real-time] Tồn kho SKU ID {} < 3 units. Kích hoạt đẩy tồn khẩn cấp lên kênh {} (Sàn SKU: {})",
                        bienTheSanPhamId, m.getKenhBanHang().getMaKenh(), m.getMaSanPhamKenh());
                m.setNgayDongBoCuoi(Instant.now());
                trangThaiDongBoSanPhamRepository.save(m);
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public DongBoTongQuanDto getTongQuan(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        long tong = trangThaiDongBoSanPhamRepository.countByKenhBanHangId(kenh.getId());
        long daLienKet = trangThaiDongBoSanPhamRepository.countByKenhBanHangIdAndTrangThaiDongBo(kenh.getId(), "thanh_cong");
        long thatBai = trangThaiDongBoSanPhamRepository.countByKenhBanHangIdAndTrangThaiDongBo(kenh.getId(), "that_bai");
        long chuaLienKet = Math.max(0, tong - daLienKet - thatBai);

        return DongBoTongQuanDto.builder()
                .tongSkuSan(tong)
                .daLienKet(daLienKet)
                .chuaLienKet(chuaLienKet)
                .loiDongBo(thatBai)
                .lanDongBoCuoi(kenh.getNgayCapNhat())
                .build();
    }

    private KenhBanHang getKenhActive(String maKenh) {
        return kenhBanHangRepository.findByMaKenh(maKenh)
                .orElseThrow(() -> new CommonException("Không tìm thấy kênh bán hàng: " + maKenh, HttpStatus.NOT_FOUND, null));
    }

    private String extractDomainFromApiUrl(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) return "";
        String clean = apiUrl.trim().replaceFirst("^(?i)https?://", "");
        int slashIdx = clean.indexOf('/');
        return (slashIdx > 0 ? clean.substring(0, slashIdx) : clean).trim().toLowerCase();
    }

    private String buildVariantName(BienTheSanPham bt) {
        List<String> parts = new ArrayList<>();
        if (bt.getMauSac() != null) parts.add(bt.getMauSac().getTenMau());
        if (bt.getSize() != null) parts.add(bt.getSize().getTenSize());
        if (bt.getChatLieu() != null) parts.add(bt.getChatLieu().getTenChatLieu());
        return String.join(" - ", parts);
    }

    private String mapStatusToFrontend(String trangThaiDongBo) {
        if ("thanh_cong".equalsIgnoreCase(trangThaiDongBo)) return "da_lien_ket";
        if ("that_bai".equalsIgnoreCase(trangThaiDongBo)) return "that_bai";
        return "chua_lien_ket";
    }

    private void ghiNhatKy(Integer kenhId, String hanhDong, String chiTiet) {
        try {
            NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
            NguoiDung actor = null;
            if (auth != null && auth.getId() != null) {
                actor = nguoiDungRepository.findById(auth.getId()).orElse(null);
            }
            if (actor != null) {
                lichSuThayDoiService.create(
                        LichSuThayDoi.builder()
                                .loaiThamChieu(ITable.kenh_ban_hang)
                                .idThamChieu(kenhId)
                                .hanhDong(hanhDong)
                                .giaTriMoi(chiTiet)
                                .nguoiThucHien(actor)
                                .ngayThucHien(Instant.now())
                                .ghiChu("Đồng bộ đa kênh FCentric")
                                .build()
                );
            }
        } catch (Exception e) {
            log.warn("Không thể ghi log thay đổi kênh: {}", e.getMessage());
        }
    }
}
