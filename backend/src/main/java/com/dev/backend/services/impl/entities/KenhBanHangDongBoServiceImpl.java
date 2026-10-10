package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.AnhBienThe;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.MinioService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.*;
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
import java.util.*;
import java.util.stream.Collectors;

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
    AnhQuanAoRepository anhQuanAoRepository;
    AnhBienTheRepository anhBienTheRepository;
    MinioService minioService;
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
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        String domain = extractDomainFromApiUrl(kenh.getApiUrl());

        // Sử dụng query tối ưu JOIN FETCH chống N+1 queries (hunt-springboot)
        List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findActiveVariantsWithDetails();
        if (activeVariants == null || activeVariants.isEmpty()) {
            activeVariants = bienTheSanPhamRepository.findByTrangThai(1);
        }
        if (activeVariants == null || activeVariants.isEmpty()) {
            return TuDongLienKetResultDto.builder()
                    .soDaGhep(0)
                    .soKhongKhop(0)
                    .soNhieuKhop(0)
                    .soTaoMoiTrenShopify(0)
                    .soTonKhoDaDay(0)
                    .soThatBai(0)
                    .build();
        }

        Integer targetKhoId = SecurityContextHolder.getKhoId() != null ? SecurityContextHolder.getKhoId() : 1;

        int soDaGhep = 0;
        int soTaoMoiTrenShopify = 0;
        int soTonKhoDaDay = 0;
        int soAnhDaDay = 0;
        int soThatBai = 0;

        // Nếu có cấu hình Shopify API hợp lệ, thực hiện đồng bộ trực tiếp với Shopify
        if (token != null && !token.isBlank() && !domain.isBlank()) {
            try {
                Long locationId = layPrimaryLocationId(domain, token);

                // Lấy danh sách SKU hiện có trên Shopify để chống tạo trùng lặp (Idempotent)
                Map<String, ShopifyVariantInfo> shopifySkuMap = layDanhSachSkuHienCoTrenShopify(domain, token);

                // Gom nhóm biến thể theo sản phẩm cha (SanPhamQuanAo)
                Map<SanPhamQuanAo, List<BienTheSanPham>> spGroupMap = activeVariants.stream()
                        .filter(bt -> bt.getSanPham() != null)
                        .collect(Collectors.groupingBy(BienTheSanPham::getSanPham));

                for (Map.Entry<SanPhamQuanAo, List<BienTheSanPham>> entry : spGroupMap.entrySet()) {
                    SanPhamQuanAo sp = entry.getKey();
                    List<BienTheSanPham> spVariants = entry.getValue();

                    // Kiểm tra xem các biến thể của sản phẩm này đã có trên Shopify chưa
                    List<BienTheSanPham> variantsCanTaoMoi = new ArrayList<>();
                    for (BienTheSanPham bt : spVariants) {
                        String skuKey = bt.getMaSku().trim().toLowerCase();
                        if (!shopifySkuMap.containsKey(skuKey)) {
                            variantsCanTaoMoi.add(bt);
                        }
                    }

                    // Nếu có biến thể chưa có trên Shopify -> Đẩy tạo mới sản phẩm lên Shopify
                    if (!variantsCanTaoMoi.isEmpty()) {
                        try {
                            Map<String, ShopifyVariantInfo> createdMap = taoSanPhamLenShopify(domain, token, sp, variantsCanTaoMoi);
                            shopifySkuMap.putAll(createdMap);
                            soTaoMoiTrenShopify += createdMap.size();
                        } catch (Exception e) {
                            log.error("Lỗi khi tạo sản phẩm [{}] lên Shopify: {}", sp.getTenSanPham(), e.getMessage());
                            soThatBai += variantsCanTaoMoi.size();
                        }
                    }

                    // [Ưu tiên 2 - Hybrid Smart Sync]: Đẩy ảnh riêng của các biến thể lên Shopify
                    Long shopifyProdId = null;
                    for (BienTheSanPham bt : spVariants) {
                        ShopifyVariantInfo vi = shopifySkuMap.get(bt.getMaSku().trim().toLowerCase());
                        if (vi != null && vi.getProductId() != null) {
                            shopifyProdId = vi.getProductId();
                            break;
                        }
                    }
                    if (shopifyProdId != null) {
                        soAnhDaDay += dongBoAnhBienThe(domain, token, shopifyProdId, spVariants, shopifySkuMap);
                    }
                }

                // Tiến hành liên kết và đẩy tồn kho cho từng biến thể
                for (BienTheSanPham bt : activeVariants) {
                    String skuKey = bt.getMaSku().trim().toLowerCase();
                    ShopifyVariantInfo variantInfo = shopifySkuMap.get(skuKey);

                    String maVariantKenh = variantInfo != null ? String.valueOf(variantInfo.getVariantId()) : bt.getMaSku();
                    String trangThaiDongBo = variantInfo != null ? "thanh_cong" : "that_bai";

                    Optional<TrangThaiDongBoSanPham> mappingOpt =
                            trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());

                    TrangThaiDongBoSanPham record;
                    if (mappingOpt.isPresent()) {
                        record = mappingOpt.get();
                        record.setMaSanPhamKenh(maVariantKenh);
                        record.setTrangThaiDongBo(trangThaiDongBo);
                        record.setNgayDongBoCuoi(Instant.now());
                    } else {
                        record = TrangThaiDongBoSanPham.builder()
                                .bienTheSanPham(bt)
                                .kenhBanHang(kenh)
                                .maSanPhamKenh(maVariantKenh)
                                .trangThaiDongBo(trangThaiDongBo)
                                .ngayDongBoCuoi(Instant.now())
                                .build();
                    }
                    trangThaiDongBoSanPhamRepository.save(record);
                    soDaGhep++;

                    // Nếu có inventoryItemId và locationId -> Đẩy tồn kho khả dụng lên Shopify ngay lập tức
                    if (variantInfo != null && variantInfo.getInventoryItemId() != null && locationId != null) {
                        try {
                            // Tính tồn khả dụng theo Rule 5: Free to Use = On Hand - Outgoing
                            List<Object[]> stocks = tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(targetKhoId, List.of(bt.getId()));
                            BigDecimal khaDung = BigDecimal.ZERO;
                            if (!stocks.isEmpty() && stocks.get(0)[1] != null) {
                                khaDung = (BigDecimal) stocks.get(0)[1];
                            }
                            int availableQty = Math.max(0, khaDung.intValue());

                            dayTonKhoChoInventoryItem(domain, token, locationId, variantInfo.getInventoryItemId(), availableQty);
                            soTonKhoDaDay++;
                        } catch (Exception e) {
                            log.warn("Không thể cập nhật tồn kho cho SKU [{}] lên Shopify: {}", bt.getMaSku(), e.getMessage());
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Lỗi trong quá trình đồng bộ trực tiếp với Shopify: {}", e.getMessage(), e);
                // Fallback nếu Shopify API lỗi kết nối: vẫn lưu liên kết nội bộ
                for (BienTheSanPham bt : activeVariants) {
                    Optional<TrangThaiDongBoSanPham> mappingOpt =
                            trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());
                    if (mappingOpt.isEmpty()) {
                        TrangThaiDongBoSanPham record = TrangThaiDongBoSanPham.builder()
                                .bienTheSanPham(bt)
                                .kenhBanHang(kenh)
                                .maSanPhamKenh(bt.getMaSku())
                                .trangThaiDongBo("thanh_cong")
                                .ngayDongBoCuoi(Instant.now())
                                .build();
                        trangThaiDongBoSanPhamRepository.save(record);
                        soDaGhep++;
                    }
                }
            }
        } else {
            // Không có cấu hình token: fallback tạo mapping nội bộ
            for (BienTheSanPham bt : activeVariants) {
                Optional<TrangThaiDongBoSanPham> mappingOpt =
                        trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());
                if (mappingOpt.isEmpty()) {
                    TrangThaiDongBoSanPham record = TrangThaiDongBoSanPham.builder()
                            .bienTheSanPham(bt)
                            .kenhBanHang(kenh)
                            .maSanPhamKenh(bt.getMaSku())
                            .trangThaiDongBo("thanh_cong")
                            .ngayDongBoCuoi(Instant.now())
                            .build();
                    trangThaiDongBoSanPhamRepository.save(record);
                    soDaGhep++;
                }
            }
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham,
                "Tự động liên kết và đẩy sản phẩm kênh " + maKenh + ": " + soDaGhep + " ghép nối, "
                        + soTaoMoiTrenShopify + " tạo mới Shopify, " + soTonKhoDaDay + " cập nhật tồn kho, "
                        + soAnhDaDay + " ảnh đã đồng bộ");

        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(0)
                .soNhieuKhop(0)
                .soTaoMoiTrenShopify(soTaoMoiTrenShopify)
                .soTonKhoDaDay(soTonKhoDaDay)
                .soAnhDaDay(soAnhDaDay)
                .soThatBai(soThatBai)
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
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        Long locationId = (token != null && !token.isBlank() && !domain.isBlank()) ? layPrimaryLocationId(domain, token) : null;
        Map<String, ShopifyVariantInfo> shopifySkuMap = (token != null && !token.isBlank() && !domain.isBlank())
                ? layDanhSachSkuHienCoTrenShopify(domain, token) : Collections.emptyMap();

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

                // Đẩy sang Shopify nếu có thông tin inventory_item_id
                if (locationId != null && !shopifySkuMap.isEmpty()) {
                    String skuKey = bt.getMaSku().trim().toLowerCase();
                    ShopifyVariantInfo vInfo = shopifySkuMap.get(skuKey);
                    if (vInfo != null && vInfo.getInventoryItemId() != null) {
                        dayTonKhoChoInventoryItem(domain, token, locationId, vInfo.getInventoryItemId(), soLuongDay.intValue());
                    }
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
                try {
                    String token = kenhBanHangService.getDecryptedShopifyAccessToken();
                    String domain = extractDomainFromApiUrl(m.getKenhBanHang().getApiUrl());
                    if (token != null && !token.isBlank() && !domain.isBlank()) {
                        Long locationId = layPrimaryLocationId(domain, token);
                        Map<String, ShopifyVariantInfo> shopifySkuMap = layDanhSachSkuHienCoTrenShopify(domain, token);
                        if (m.getBienTheSanPham() != null) {
                            String skuKey = m.getBienTheSanPham().getMaSku().trim().toLowerCase();
                            ShopifyVariantInfo vInfo = shopifySkuMap.get(skuKey);
                            if (vInfo != null && vInfo.getInventoryItemId() != null && locationId != null) {
                                List<Object[]> stocks = tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(1, List.of(bienTheSanPhamId));
                                BigDecimal khaDung = BigDecimal.ZERO;
                                if (!stocks.isEmpty() && stocks.get(0)[1] != null) {
                                    khaDung = (BigDecimal) stocks.get(0)[1];
                                }
                                dayTonKhoChoInventoryItem(domain, token, locationId, vInfo.getInventoryItemId(), Math.max(0, khaDung.intValue()));
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("Lỗi khi đẩy tồn khẩn cấp cho SKU {}: {}", bienTheSanPhamId, e.getMessage());
                }
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

    private Long layPrimaryLocationId(String domain, String token) {
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/locations.json";
        try {
            RestTemplate restTemplate = createRestTemplate();
            HttpHeaders headers = createHeaders(token);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode locations = root.path("locations");
                if (locations.isArray() && !locations.isEmpty()) {
                    return locations.get(0).path("id").asLong();
                }
            }
        } catch (Exception e) {
            log.warn("Không thể lấy Location ID từ Shopify: {}", e.getMessage());
        }
        return null;
    }

    private Map<String, ShopifyVariantInfo> layDanhSachSkuHienCoTrenShopify(String domain, String token) {
        Map<String, ShopifyVariantInfo> result = new HashMap<>();
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json?limit=250";
        try {
            RestTemplate restTemplate = createRestTemplate();
            HttpHeaders headers = createHeaders(token);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode products = root.path("products");
                if (products.isArray()) {
                    for (JsonNode prod : products) {
                        Long prodId = prod.path("id").asLong();
                        JsonNode vars = prod.path("variants");
                        if (vars.isArray()) {
                            for (JsonNode v : vars) {
                                String sku = v.path("sku").asText("").trim().toLowerCase();
                                if (!sku.isBlank()) {
                                    Long imgId = v.path("image_id").isNull() || v.path("image_id").asLong() == 0 ? null : v.path("image_id").asLong();
                                    result.put(sku, new ShopifyVariantInfo(
                                            v.path("id").asLong(),
                                            v.path("inventory_item_id").asLong(),
                                            prodId,
                                            imgId
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Lỗi khi quét danh sách sản phẩm hiện có trên Shopify: {}", e.getMessage());
        }
        return result;
    }

    private Map<String, ShopifyVariantInfo> taoSanPhamLenShopify(String domain, String token, SanPhamQuanAo sp, List<BienTheSanPham> variants) throws Exception {
        Map<String, ShopifyVariantInfo> result = new HashMap<>();
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json";

        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        Map<String, Object> productObj = new LinkedHashMap<>();
        productObj.put("title", sp.getTenSanPham());
        productObj.put("body_html", "<p>" + (sp.getMoTa() != null && !sp.getMoTa().isBlank() ? sp.getMoTa() : sp.getTenSanPham()) + "</p>");
        productObj.put("vendor", "FCentric");
        productObj.put("product_type", sp.getDanhMuc() != null ? sp.getDanhMuc().getTenDanhMuc() : "Thời trang");
        productObj.put("status", "active");

        // [Ưu tiên 1 - Hybrid Smart Sync]: Đính kèm ảnh chính sản phẩm cha vào payload khởi tạo (tiết kiệm request, 0 latency)
        if (sp != null && sp.getId() != null) {
            try {
                List<AnhQuanAo> prodImages = anhQuanAoRepository.findActiveByQuanAoIds(List.of(sp.getId()));
                if (!prodImages.isEmpty()) {
                    AnhQuanAo mainImg = prodImages.stream()
                            .filter(a -> Boolean.TRUE.equals(a.getAnhChinh()))
                            .findFirst()
                            .orElse(prodImages.get(0));

                    if (mainImg.getTepTin() != null && mainImg.getTepTin().getTenLuuTru() != null) {
                        TepTin tep = mainImg.getTepTin();
                        if (tep.getKichCo() == null || tep.getKichCo() <= 3 * 1024 * 1024) {
                            byte[] imgBytes = minioService.download(tep.getTenLuuTru());
                            if (imgBytes != null && imgBytes.length > 0) {
                                String base64Img = Base64.getEncoder().encodeToString(imgBytes);
                                Map<String, Object> imgMap = new LinkedHashMap<>();
                                imgMap.put("attachment", base64Img);
                                imgMap.put("filename", tep.getTenTaiLen() != null && !tep.getTenTaiLen().isBlank()
                                        ? tep.getTenTaiLen() : "main_product.jpg");
                                productObj.put("images", List.of(imgMap));
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Không thể tải ảnh chính sản phẩm [{}] từ MinIO: {}", sp.getTenSanPham(), e.getMessage());
            }
        }

        List<Map<String, String>> options = List.of(
                Map.of("name", "Màu sắc"),
                Map.of("name", "Kích cỡ"),
                Map.of("name", "Chất liệu")
        );
        productObj.put("options", options);

        List<Map<String, Object>> variantList = new ArrayList<>();
        Set<String> usedOptions = new HashSet<>();

        for (BienTheSanPham bt : variants) {
            Map<String, Object> varMap = new LinkedHashMap<>();
            String opt1 = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank())
                    ? bt.getMauSac().getTenMau().trim() : "Mặc định";
            String opt2 = (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank())
                    ? bt.getSize().getTenSize().trim() : "Tiêu chuẩn";
            String opt3 = (bt.getChatLieu() != null && bt.getChatLieu().getTenChatLieu() != null && !bt.getChatLieu().getTenChatLieu().isBlank())
                    ? bt.getChatLieu().getTenChatLieu().trim() : "Cotton";

            String optKey = opt1 + "|" + opt2 + "|" + opt3;
            if (usedOptions.contains(optKey)) {
                opt3 = opt3 + " (" + bt.getMaSku() + ")";
            }
            usedOptions.add(opt1 + "|" + opt2 + "|" + opt3);

            varMap.put("option1", opt1);
            varMap.put("option2", opt2);
            varMap.put("option3", opt3);
            varMap.put("sku", bt.getMaSku());

            BigDecimal price = bt.getGiaBan() != null ? bt.getGiaBan() :
                    (sp.getGiaBanMacDinh() != null ? sp.getGiaBanMacDinh() : BigDecimal.ZERO);
            varMap.put("price", price.setScale(2, RoundingMode.HALF_UP).toPlainString());

            if (bt.getMaVachSku() != null && !bt.getMaVachSku().isBlank()) {
                varMap.put("barcode", bt.getMaVachSku().trim());
            }
            varMap.put("inventory_management", "shopify");

            variantList.add(varMap);
        }
        productObj.put("variants", variantList);

        Map<String, Object> body = Map.of("product", productObj);
        String jsonBody = objectMapper.writeValueAsString(body);

        HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode productNode = root.path("product");
            Long prodId = productNode.path("id").asLong();
            JsonNode createdVars = productNode.path("variants");
            if (createdVars.isArray()) {
                for (JsonNode v : createdVars) {
                    String sku = v.path("sku").asText("").trim().toLowerCase();
                    if (!sku.isBlank()) {
                        Long imgId = v.path("image_id").isNull() || v.path("image_id").asLong() == 0 ? null : v.path("image_id").asLong();
                        result.put(sku, new ShopifyVariantInfo(
                                v.path("id").asLong(),
                                v.path("inventory_item_id").asLong(),
                                prodId,
                                imgId
                        ));
                    }
                }
            }
        }
        return result;
    }

    private int dongBoAnhBienThe(String domain, String token, Long shopifyProductId, List<BienTheSanPham> variants, Map<String, ShopifyVariantInfo> shopifySkuMap) {
        if (shopifyProductId == null || variants == null || variants.isEmpty()) {
            return 0;
        }

        int count = 0;
        try {
            List<Integer> btIds = variants.stream().map(BienTheSanPham::getId).filter(Objects::nonNull).toList();
            if (btIds.isEmpty()) return 0;

            // 1 query batch chống N+1 queries (hunt-springboot)
            List<AnhBienThe> anhBienTheList = anhBienTheRepository.findActiveByBienTheIds(btIds);
            if (anhBienTheList.isEmpty()) return 0;

            Map<Integer, AnhBienThe> anhByBtId = anhBienTheList.stream()
                    .collect(Collectors.toMap(ab -> ab.getBienThe().getId(), ab -> ab, (a, b) -> a));

            for (BienTheSanPham bt : variants) {
                AnhBienThe ab = anhByBtId.get(bt.getId());
                if (ab != null && ab.getTepTin() != null) {
                    String skuKey = bt.getMaSku().trim().toLowerCase();
                    ShopifyVariantInfo vInfo = shopifySkuMap.get(skuKey);

                    // Idempotency: Chỉ upload nếu variant đã có trên Shopify và CHƯA có ảnh gắn kèm
                    if (vInfo != null && vInfo.getVariantId() != null && vInfo.getImageId() == null) {
                        TepTin tep = ab.getTepTin();
                        if (tep.getTenLuuTru() != null && (tep.getKichCo() == null || tep.getKichCo() <= 3 * 1024 * 1024)) {
                            try {
                                byte[] bytes = minioService.download(tep.getTenLuuTru());
                                if (bytes != null && bytes.length > 0) {
                                    String base64 = Base64.getEncoder().encodeToString(bytes);
                                    Long newImgId = uploadAnhBienTheLenShopify(domain, token, shopifyProductId, vInfo.getVariantId(), base64, tep.getTenTaiLen());
                                    if (newImgId != null) {
                                        vInfo.setImageId(newImgId);
                                        count++;
                                    }
                                    // Throttle 250ms bảo vệ Shopify leaky bucket rate limit
                                    try {
                                        Thread.sleep(250);
                                    } catch (InterruptedException ignored) {}
                                }
                            } catch (Exception e) {
                                log.warn("Lỗi khi tải hoặc upload ảnh biến thể SKU [{}] sang Shopify: {}", bt.getMaSku(), e.getMessage());
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Lỗi khi đồng bộ ảnh biến thể cho sản phẩm Shopify [{}]: {}", shopifyProductId, e.getMessage());
        }
        return count;
    }

    private Long uploadAnhBienTheLenShopify(String domain, String token, Long shopifyProductId, Long shopifyVariantId, String base64Attachment, String filename) {
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products/" + shopifyProductId + "/images.json";
        try {
            RestTemplate restTemplate = createRestTemplate();
            HttpHeaders headers = createHeaders(token);

            Map<String, Object> imgMap = new LinkedHashMap<>();
            imgMap.put("attachment", base64Attachment);
            imgMap.put("filename", filename != null && !filename.isBlank() ? filename : "variant_" + shopifyVariantId + ".jpg");
            imgMap.put("variant_ids", List.of(shopifyVariantId));

            Map<String, Object> body = Map.of("image", imgMap);
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                return root.path("image").path("id").asLong();
            }
        } catch (Exception e) {
            log.warn("Lỗi khi gọi API upload ảnh biến thể [{}] lên Shopify: {}", shopifyVariantId, e.getMessage());
        }
        return null;
    }

    private void dayTonKhoChoInventoryItem(String domain, String token, Long locationId, Long inventoryItemId, int available) {
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/inventory_levels/set.json";
        try {
            RestTemplate restTemplate = createRestTemplate();
            HttpHeaders headers = createHeaders(token);

            Map<String, Object> body = Map.of(
                    "location_id", locationId,
                    "inventory_item_id", inventoryItemId,
                    "available", available
            );
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
        } catch (Exception e) {
            log.warn("Lỗi khi set inventory level cho item [{}]: {}", inventoryItemId, e.getMessage());
        }
    }

    private RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8000);
        factory.setReadTimeout(15000);
        return new RestTemplate(factory);
    }

    private HttpHeaders createHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Shopify-Access-Token", token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        return headers;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    static class ShopifyVariantInfo {
        Long variantId;
        Long inventoryItemId;
        Long productId;
        Long imageId;
    }
}
