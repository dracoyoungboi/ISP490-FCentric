package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.request.KenhBanHangCaiDatRequest;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
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
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TonKhoTongHopRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.lazada.LazadaClient;
import com.dev.backend.utils.KenhCauHinhDongBo;
import com.dev.backend.utils.PublicAssetUrl;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import com.dev.backend.event.InventoryRestockedEvent;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
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
    KhoRepository khoRepository;
    TonKhoTongHopRepository tonKhoTongHopRepository;
    OmnichannelOrderSyncJob omnichannelOrderSyncJob;
    // Đọc quy tắc đẩy tồn đã lưu theo kênh (màn Cấu hình kênh)
    DieuHanhHeThongService dieuHanhHeThongService;
    LazadaClient lazadaClient;
    ObjectMapper objectMapper = new ObjectMapper();
    // Lần đẩy tồn lên sàn gần nhất (đã kết nối được Shopify), theo id kênh (màn Theo dõi đồng bộ)
    Map<Integer, Instant> lanDayTonCuoi = new java.util.concurrent.ConcurrentHashMap<>();
    // Khóa đẩy tồn theo id kênh: một kênh chỉ một đợt đẩy tồn cùng lúc (trong một máy chủ)
    Map<Integer, ReentrantLock> khoaDayTon = new java.util.concurrent.ConcurrentHashMap<>();

    static final String LOI_KENH_DANG_DAY_TON =
            "Kênh đang có một đợt đẩy tồn khác (tự động hoặc người khác bấm), vui lòng thử lại sau ít phút";
    /** Khi chờ khóa đẩy tồn, cứ bấy lâu xem lại có yêu cầu dừng không */
    static final long CHU_KY_CHO_KHOA_MS = 500;
    /**
     * Số sản phẩm tối đa mỗi trang của danh sách liên kết theo sản phẩm (giao diện chọn 10/20/50/100); xin nhiều hơn
     * thì hạ về số này. API luôn có phân trang (@PageableDefault); Pageable.unpaged() chỉ dành cho lời gọi nội bộ.
     */
    static final int SO_SAN_PHAM_TOI_DA_MOI_TRANG = 100;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaiSanPhamResultDto taiSanPhamTuKenh(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        if (OmnichannelOrderSyncJob.MA_KENH_LAZADA.equalsIgnoreCase(kenh.getMaKenh())) {
            String appKey = kenhBanHangService.getLazadaAppKey();
            String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret();
            String token = kenhBanHangService.getDecryptedLazadaAccessToken();
            if (appKey == null || appSecret == null || token == null) {
                throw new CommonException("Chưa có App Key, App Secret hoặc Access Token cho kênh " + maKenh, HttpStatus.BAD_REQUEST, null);
            }
            return TaiSanPhamResultDto.builder()
                    .soSku(0)
                    .soMoi(0)
                    .soCapNhat(0)
                    .build();
        }
        kiemTraDaKetNoi(kenh);
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            throw kenhChuaKetNoi(kenh.getMaKenh());
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
                                        // Dòng người dùng đã ngừng đồng bộ thì giữ nguyên trạng thái ngừng
                                        if (!TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo())) {
                                            record.setTrangThaiDongBo("thanh_cong");
                                            record.setChiTietLoi(null);
                                        }
                                        record.setNgayDongBoCuoi(Instant.now());
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
        kiemTraDaKetNoi(kenh);
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        // Không còn ghép "nội bộ" khi thiếu khóa: nhánh đó tạo dòng đã đồng bộ cho mọi biến thể mà không hỏi Shopify
        if (token == null || token.isBlank() || domain.isBlank()) {
            throw kenhChuaKetNoi(kenh.getMaKenh());
        }

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
        int soCapNhatTrenShopify = 0;
        int soTonKhoDaDay = 0;
        int soAnhDaDay = 0;
        int soThatBai = 0;

        // Nếu có cấu hình Shopify API hợp lệ, thực hiện đồng bộ trực tiếp với Shopify
        if (token != null && !token.isBlank() && !domain.isBlank()) {
            try {
                // Tồn ghi vào địa điểm mặc định của cửa hàng; không xác định được thì chỉ liên kết, không đẩy tồn
                DiaDiemShopify diaDiem = layDiaDiemMacDinh(domain, token);
                Long locationId = diaDiem != null ? diaDiem.id() : null;
                String tenDiaDiem = diaDiem != null ? diaDiem.ten() : null;

                // Lấy danh sách SKU và Tên sản phẩm hiện có trên Shopify để chống tạo trùng lặp (Idempotent)
                Map<String, Long> shopifyTitleMap = new HashMap<>();
                Map<String, ShopifyVariantInfo> shopifySkuMap = layDanhSachSkuHienCoTrenShopify(domain, token, shopifyTitleMap);

                // Gom nhóm biến thể theo sản phẩm cha (SanPhamQuanAo)
                Map<SanPhamQuanAo, List<BienTheSanPham>> spGroupMap = activeVariants.stream()
                        .filter(bt -> bt.getSanPham() != null)
                        .collect(Collectors.groupingBy(BienTheSanPham::getSanPham));

                for (Map.Entry<SanPhamQuanAo, List<BienTheSanPham>> entry : spGroupMap.entrySet()) {
                    SanPhamQuanAo sp = entry.getKey();
                    List<BienTheSanPham> spVariants = entry.getValue();

                    // Kiểm tra xem các biến thể của sản phẩm này đã có trên Shopify chưa
                    List<BienTheSanPham> variantsCanTaoMoi = new ArrayList<>();
                    Long existingShopifyProdId = null;
                    for (BienTheSanPham bt : spVariants) {
                        String skuKey = bt.getMaSku().trim().toLowerCase();
                        if (!shopifySkuMap.containsKey(skuKey)) {
                            variantsCanTaoMoi.add(bt);
                        } else if (existingShopifyProdId == null && shopifySkuMap.get(skuKey).getProductId() != null) {
                            existingShopifyProdId = shopifySkuMap.get(skuKey).getProductId();
                        }
                    }

                    // Nếu chưa tìm thấy ID qua SKU, đối soát qua Tên sản phẩm cha trên Shopify để chống tạo trùng
                    if (existingShopifyProdId == null && sp.getTenSanPham() != null) {
                        existingShopifyProdId = shopifyTitleMap.get(sp.getTenSanPham().trim().toLowerCase());
                    }

                    // Nếu có biến thể chưa có trên Shopify -> Đẩy lên Shopify
                    if (!variantsCanTaoMoi.isEmpty()) {
                        try {
                            if (existingShopifyProdId != null) {
                                // [CHỐNG XÉ ĐÔI SẢN PHẨM]: Sản phẩm cha ĐÃ CÓ trên Shopify -> Thêm biến thể mới vào đúng sản phẩm này
                                Map<String, ShopifyVariantInfo> addedMap = themVariantsVaoSanPhamShopify(domain, token, existingShopifyProdId, sp, variantsCanTaoMoi, spVariants);
                                shopifySkuMap.putAll(addedMap);
                                soTaoMoiTrenShopify += addedMap.size();
                            } else {
                                // Sản phẩm cha CHƯA CÓ trên Shopify -> Tạo mới sản phẩm cha cùng danh sách biến thể
                                Map<String, ShopifyVariantInfo> createdMap = taoSanPhamLenShopify(domain, token, sp, variantsCanTaoMoi, spVariants);
                                shopifySkuMap.putAll(createdMap);
                                soTaoMoiTrenShopify += createdMap.size();
                                if (!createdMap.isEmpty()) {
                                    existingShopifyProdId = createdMap.values().iterator().next().getProductId();
                                    if (sp.getTenSanPham() != null) {
                                        shopifyTitleMap.put(sp.getTenSanPham().trim().toLowerCase(), existingShopifyProdId);
                                    }
                                }
                            }
                        } catch (Exception e) {
                            log.error("Lỗi khi đồng bộ sản phẩm [{}] lên Shopify: {}", sp.getTenSanPham(), e.getMessage());
                            soThatBai += variantsCanTaoMoi.size();
                        }
                    } else if (existingShopifyProdId != null) {
                        // [Cơ chế Update Tự Động]: Sản phẩm đã có trên Shopify -> Tự động CẬP NHẬT đè Thương hiệu, Loại và Tags
                        try {
                            boolean updated = capNhatSanPhamLenShopify(domain, token, existingShopifyProdId, sp);
                            if (updated) {
                                soCapNhatTrenShopify++;
                            }
                        } catch (Exception e) {
                            log.warn("Lỗi khi cập nhật sản phẩm [{}] (ID: {}) lên Shopify: {}", sp.getTenSanPham(), existingShopifyProdId, e.getMessage());
                        }
                    }

                    // [Ưu tiên 2 - Hybrid Smart Sync]: Đẩy ảnh riêng của các biến thể lên Shopify
                    Long shopifyProdId = existingShopifyProdId;
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
                    boolean dangNgung = false;
                    if (mappingOpt.isPresent()) {
                        record = mappingOpt.get();
                        record.setMaSanPhamKenh(maVariantKenh);
                        // Dòng người dùng đã ngừng đồng bộ thì giữ nguyên trạng thái ngừng và không đẩy tồn
                        dangNgung = TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo());
                        if (!dangNgung) {
                            record.setTrangThaiDongBo(trangThaiDongBo);
                        }
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

                    // Nếu có inventoryItemId và locationId -> Đẩy tồn kho lên Shopify ngay theo quy tắc đã lưu của kênh
                    if (!dangNgung && variantInfo != null && variantInfo.getInventoryItemId() != null && locationId != null) {
                        try {
                            // Free to Use toàn chuỗi theo quy tắc đã lưu; ghi số Shopify đã nhận hoặc lý do lỗi vào dòng
                            int availableQty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));
                            KetQuaGuiTon kq = dayTonChoDong(record, new KetNoiDayTon(domain, token, locationId, tenDiaDiem, shopifySkuMap, null), availableQty);
                            if (kq.thanhCong()) {
                                soTonKhoDaDay++;
                            } else {
                                log.warn("Không thể cập nhật tồn kho cho SKU [{}] lên Shopify: {}", bt.getMaSku(), kq.lyDo());
                            }
                            if (!kq.loiKenh()) {
                                trangThaiDongBoSanPhamRepository.save(record);
                            }
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
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham,
                "Tự động liên kết và đẩy sản phẩm kênh " + maKenh + ": " + soDaGhep + " ghép nối, "
                        + soTaoMoiTrenShopify + " tạo mới Shopify, " + soCapNhatTrenShopify + " cập nhật Shopify, "
                        + soTonKhoDaDay + " cập nhật tồn kho, " + soAnhDaDay + " ảnh đã đồng bộ");

        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(0)
                .soNhieuKhop(0)
                .soTaoMoiTrenShopify(soTaoMoiTrenShopify)
                .soCapNhatTrenShopify(soCapNhatTrenShopify)
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
        Map<Integer, String> anhTheoSanPham = anhDaiDienTheoSanPham(page.getContent().stream()
                .map(TrangThaiDongBoSanPham::getBienTheSanPham)
                .filter(Objects::nonNull)
                .map(BienTheSanPham::getSanPham)
                .filter(Objects::nonNull)
                .map(SanPhamQuanAo::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        Map<Integer, BigDecimal> khaDung = khaDungTheoBienThe(page.getContent());

        return page.map(item -> toLienKetDto(item, khaDung, anhTheoSanPham));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NhomLienKetDto> filterLienKetTheoSanPham(String maKenh, String search, String trangThai, Pageable pageable) {
        KenhBanHang kenh = getKenhActive(maKenh);
        String trangThaiLoc = (trangThai == null || trangThai.isBlank()) ? null : trangThai.trim();
        String tuKhoa = (search == null || search.isBlank()) ? null : search.trim();
        // Thứ tự sản phẩm đã cố định trong truy vấn (GROUP BY), nên chỉ giữ số trang và số dòng của yêu cầu.
        // Mỗi sản phẩm kéo theo đủ SKU, ảnh và tồn: số sản phẩm mỗi trang không vượt SO_SAN_PHAM_TOI_DA_MOI_TRANG
        Pageable trangSanPham = pageable.isPaged()
                ? PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), SO_SAN_PHAM_TOI_DA_MOI_TRANG))
                : Pageable.unpaged();

        Page<Integer> trangId = trangThaiDongBoSanPhamRepository.pageSanPhamIdTheoKenh(
                kenh.getId(), trangThaiLoc, tuKhoa, trangSanPham);
        List<Integer> sanPhamIds = trangId.getContent();
        // Tổng SKU khớp lọc trên mọi trang (chân bảng "N sản phẩm · M SKU"); không có sản phẩm nào thì khỏi đếm
        long tongSku = trangId.getTotalElements() == 0
                ? 0
                : trangThaiDongBoSanPhamRepository.demLienKetKhopLoc(kenh.getId(), trangThaiLoc, tuKhoa);
        if (sanPhamIds.isEmpty()) {
            return new TrangNhomLienKet(List.of(), trangSanPham, trangId.getTotalElements(), tongSku);
        }

        List<TrangThaiDongBoSanPham> dong = trangThaiDongBoSanPhamRepository.findTheoKenhVaSanPham(
                kenh.getId(), sanPhamIds, trangThaiLoc, tuKhoa);
        Map<Integer, BigDecimal> khaDung = khaDungTheoBienThe(dong);
        Map<Integer, String> anhTheoSanPham = anhDaiDienTheoSanPham(sanPhamIds);
        // Đang lọc thì nhóm chỉ còn các SKU khớp: đếm riêng tổng SKU để giao diện ghi "x/y phân loại"
        Map<Integer, Integer> tongLienKet = (trangThaiLoc == null && tuKhoa == null)
                ? Map.of()
                : demLienKetTheoSanPham(kenh.getId(), sanPhamIds);

        // Truy vấn đã xếp sẵn thứ tự phân loại, gom lại vẫn giữ thứ tự đó
        Map<Integer, List<TrangThaiDongBoSanPham>> theoSanPham = new HashMap<>();
        for (TrangThaiDongBoSanPham item : dong) {
            BienTheSanPham bt = item.getBienTheSanPham();
            if (bt == null || bt.getSanPham() == null || bt.getSanPham().getId() == null) continue;
            theoSanPham.computeIfAbsent(bt.getSanPham().getId(), k -> new ArrayList<>()).add(item);
        }

        List<NhomLienKetDto> nhom = new ArrayList<>(sanPhamIds.size());
        for (Integer sanPhamId : sanPhamIds) {
            List<TrangThaiDongBoSanPham> dsDong = theoSanPham.get(sanPhamId);
            // Liên kết vừa bị xóa giữa hai truy vấn: bỏ qua thay vì trả nhóm rỗng
            if (dsDong == null || dsDong.isEmpty()) continue;
            List<LienKetSanPhamDto> bienThe = dsDong.stream()
                    .map(item -> toLienKetDto(item, khaDung, anhTheoSanPham))
                    .toList();
            nhom.add(NhomLienKetDto.builder()
                    .sanPhamId(sanPhamId)
                    .tenSanPham(dsDong.get(0).getBienTheSanPham().getSanPham().getTenSanPham())
                    .anhDaiDien(anhTheoSanPham.get(sanPhamId))
                    .tongPhanLoai(Math.max(bienThe.size(), tongLienKet.getOrDefault(sanPhamId, 0)))
                    .bienThe(bienThe)
                    .build());
        }
        return new TrangNhomLienKet(nhom, trangSanPham, trangId.getTotalElements(), tongSku);
    }

    /** Một dòng liên kết cho giao diện; số khả dụng và ảnh lấy từ bảng đã tra sẵn cho cả trang (không truy vấn thêm). */
    private LienKetSanPhamDto toLienKetDto(TrangThaiDongBoSanPham item, Map<Integer, BigDecimal> khaDungTheoBienThe,
                                           Map<Integer, String> anhTheoSanPham) {
        BienTheSanPham bt = item.getBienTheSanPham();
        Integer sanPhamId = bt != null && bt.getSanPham() != null ? bt.getSanPham().getId() : null;
        String tenSanPham = bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null;
        String tenBienThe = bt != null ? buildVariantName(bt) : null;
        BigDecimal soLuongKhaDung = bt != null && bt.getId() != null
                ? khaDungTheoBienThe.getOrDefault(bt.getId(), BigDecimal.ZERO)
                : BigDecimal.ZERO;

        return LienKetSanPhamDto.builder()
                .id(item.getId())
                .skuSan(item.getMaSanPhamKenh())
                .tenSanPhamSan(tenSanPham)
                .tenBienTheSan(tenBienThe)
                .giaBanSan(bt != null ? bt.getGiaBan() : null)
                .bienTheSanPhamId(bt != null ? bt.getId() : null)
                .sanPhamId(sanPhamId)
                .anhDaiDien(sanPhamId != null ? anhTheoSanPham.get(sanPhamId) : null)
                .maSku(bt != null ? bt.getMaSku() : null)
                .tenSanPham(tenSanPham)
                .tenBienThe(tenBienThe)
                .giaBan(bt != null ? bt.getGiaBan() : null)
                .soLuongKhaDung(soLuongKhaDung)
                .soLuongDaDay(soDaDay(item))
                .ngayDayTonCuoi(item.getNgayDayTonCuoi())
                .choPhepDongBo(true)
                .trangThaiLienKet(mapStatusToFrontend(item.getTrangThaiDongBo()))
                .ngayDongBoCuoi(item.getNgayDongBoCuoi())
                .chiTietLoi(item.getChiTietLoi())
                .build();
    }

    /**
     * Tồn khả dụng toàn chuỗi của các biến thể trong danh sách, một truy vấn cho cả trang.
     * Biến thể không có trong kết quả hiểu là khả dụng 0.
     */
    private Map<Integer, BigDecimal> khaDungTheoBienThe(Collection<TrangThaiDongBoSanPham> dong) {
        List<Integer> bienTheIds = dong.stream()
                .map(TrangThaiDongBoSanPham::getBienTheSanPham)
                .filter(Objects::nonNull)
                .map(BienTheSanPham::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (bienTheIds.isEmpty()) return Map.of();
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        for (Object[] row : tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(bienTheIds)) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) continue;
            BigDecimal soLuong = row[1] instanceof BigDecimal bd ? bd : new BigDecimal(row[1].toString());
            ketQua.put(((Number) row[0]).intValue(), soLuong);
        }
        return ketQua;
    }

    /** Số liên kết của từng sản phẩm với kênh (mọi trạng thái), để biết nhóm đang lọc còn bao nhiêu SKU khác. */
    private Map<Integer, Integer> demLienKetTheoSanPham(Integer kenhId, Collection<Integer> sanPhamIds) {
        Map<Integer, Integer> ketQua = new HashMap<>();
        for (Object[] row : trangThaiDongBoSanPhamRepository.demLienKetTheoSanPham(kenhId, sanPhamIds)) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) continue;
            ketQua.put(((Number) row[0]).intValue(), ((Number) row[1]).intValue());
        }
        return ketQua;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LienKetSanPhamDto capNhatLienKet(Integer lienKetId, CapNhatLienKetRequest request) {
        TrangThaiDongBoSanPham record = trangThaiDongBoSanPhamRepository.findById(lienKetId)
                .orElseThrow(() -> new CommonException("Không tìm thấy liên kết với ID " + lienKetId, HttpStatus.NOT_FOUND, null));

        if (request.getBienTheSanPhamId() != null) {
            BienTheSanPham bt = bienTheSanPhamRepository.findById(request.getBienTheSanPhamId())
                    .orElseThrow(() -> new CommonException("Không tìm thấy biến thể ID " + request.getBienTheSanPhamId(), HttpStatus.BAD_REQUEST, null));
            Integer kenhId = record.getKenhBanHang() != null ? record.getKenhBanHang().getId() : null;
            if (kenhId != null && trangThaiDongBoSanPhamRepository
                    .existsByKenhBanHangIdAndBienTheSanPhamIdAndIdNot(kenhId, bt.getId(), record.getId())) {
                throw new CommonException("Biến thể " + bt.getMaSku() + " đã được ghép với một sản phẩm khác của gian hàng này",
                        HttpStatus.BAD_REQUEST, null);
            }
            record.setBienTheSanPham(bt);
            record.setTrangThaiDongBo("thanh_cong");
            record.setChiTietLoi(null);
        } else {
            record.setTrangThaiDongBo("chua_dong_bo");
        }
        record.setNgayDongBoCuoi(Instant.now());
        TrangThaiDongBoSanPham saved = trangThaiDongBoSanPhamRepository.save(record);

        BienTheSanPham bt = saved.getBienTheSanPham();
        Integer sanPhamId = bt != null && bt.getSanPham() != null ? bt.getSanPham().getId() : null;
        return LienKetSanPhamDto.builder()
                .id(saved.getId())
                .skuSan(saved.getMaSanPhamKenh())
                .tenSanPhamSan(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienTheSan(bt != null ? buildVariantName(bt) : null)
                .giaBanSan(bt != null ? bt.getGiaBan() : null)
                .bienTheSanPhamId(bt != null ? bt.getId() : null)
                .sanPhamId(sanPhamId)
                .anhDaiDien(anhDaiDienCuaSanPham(sanPhamId))
                .maSku(bt != null ? bt.getMaSku() : null)
                .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienThe(bt != null ? buildVariantName(bt) : null)
                .giaBan(bt != null ? bt.getGiaBan() : null)
                .soLuongKhaDung(BigDecimal.ZERO)
                .soLuongDaDay(soDaDay(saved))
                .ngayDayTonCuoi(saved.getNgayDayTonCuoi())
                .choPhepDongBo(Boolean.TRUE.equals(request.getChoPhepDongBo()))
                .trangThaiLienKet(mapStatusToFrontend(saved.getTrangThaiDongBo()))
                .ngayDongBoCuoi(saved.getNgayDongBoCuoi())
                .chiTietLoi(saved.getChiTietLoi())
                .build();
    }

    @Override
    public DayTonResultDto dayTonKhoLenKenh(String maKenh, DayTonKenhRequest request) {
        return dayTonKhoLenKenh(maKenh, request, TheoDoiDayTon.KHONG_THEO_DOI);
    }

    @Override
    public DayTonResultDto dayTonTheoQuyTacDaLuu(String maKenh, TheoDoiDayTon theoDoi) {
        return dayTonKhoLenKenh(maKenh, quyTacDaLuu(maKenh), theoDoi != null ? theoDoi : TheoDoiDayTon.KHONG_THEO_DOI);
    }

    DayTonResultDto dayTonKhoLenKenh(String maKenh, DayTonKenhRequest request, TheoDoiDayTon theoDoi) {
        KenhBanHang kenh = getKenhActive(maKenh);
        // Mỗi kênh chỉ một đợt đẩy tồn cùng lúc (JOB-03, Đồng bộ ngay, nút Đẩy tồn, Đồng bộ tất cả):
        // hai đợt chồng nhau gấp đôi số lần gọi Shopify, dễ chạm giới hạn rồi dừng giữa chừng
        ReentrantLock khoa = khoaDayTon.computeIfAbsent(kenh.getId(), id -> new ReentrantLock());
        if (!giuKhoaDayTon(khoa, theoDoi)) {
            // Dừng theo yêu cầu khi còn đang chờ thì không phải lỗi; nơi gọi tự kết thúc đợt là đã dừng
            return DayTonResultDto.builder().loiKenh(theoDoi.canDung() ? null : LOI_KENH_DANG_DAY_TON).build();
        }
        try {
            return dayTonKhiDaGiuKhoa(kenh, maKenh, request, theoDoi);
        } finally {
            khoa.unlock();
        }
    }

    /**
     * Giữ khóa đẩy tồn của kênh. Kênh đang có đợt khác thì chờ tối đa {@code theoDoi.choKenhRanhToiDa()}
     * (mặc định không chờ); có yêu cầu dừng thì thôi chờ.
     */
    static boolean giuKhoaDayTon(ReentrantLock khoa, TheoDoiDayTon theoDoi) {
        long han = System.nanoTime() + theoDoi.choKenhRanhToiDa().toNanos();
        try {
            while (true) {
                long conLaiMs = TimeUnit.NANOSECONDS.toMillis(han - System.nanoTime());
                if (khoa.tryLock(Math.max(0, Math.min(CHU_KY_CHO_KHOA_MS, conLaiMs)), TimeUnit.MILLISECONDS)) {
                    return true;
                }
                if (theoDoi.canDung() || System.nanoTime() - han >= 0) {
                    return false;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private DayTonResultDto dayTonKhiDaGiuKhoa(KenhBanHang kenh, String maKenh, DayTonKenhRequest request, TheoDoiDayTon theoDoi) {
        BigDecimal tyLe = request.getTyLeDayTon() != null ? request.getTyLeDayTon() : BigDecimal.valueOf(100);
        int tonDem = request.getTonDem() != null ? request.getTonDem() : 0;
        int nguongVe0 = request.getNguongVe0() != null ? request.getNguongVe0() : 0;

        List<TrangThaiDongBoSanPham> dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();

        // Không ném lỗi: các dòng Shopify đã nhận trước khi gặp lỗi cả gian hàng vẫn phải được lưu
        KetNoiDayTon ketNoi = moKetNoiDayTon(kenh);
        String loiKenh = ketNoi.lyDoLoi();
        int soThanhCong = 0;
        int soLoi = 0;
        int daXuLy = 0;
        boolean dungTheoYeuCau = false;
        if (loiKenh == null) {
            theoDoi.batDauDay(dongCanDay.size());
            for (TrangThaiDongBoSanPham dong : dongCanDay) {
                // Throttling 250ms bảo vệ Shopify leaky bucket rate limit khi đẩy danh sách SKU
                if (daXuLy > 0) {
                    try {
                        Thread.sleep(250);
                    } catch (InterruptedException ignored) {}
                }
                if (theoDoi.canDung()) {
                    dungTheoYeuCau = true;
                    break;
                }
                BienTheSanPham bt = dong.getBienTheSanPham();
                theoDoi.dangDay(bt.getMaSku());
                // Free to Use toàn chuỗi rồi áp công thức BR-OC-10
                int soDay = tinhSoTonDay(khaDungToanChuoi(bt.getId()), tyLe, tonDem, nguongVe0);
                KetQuaGuiTon kq = dayTonChoDong(dong, ketNoi, soDay);
                if (kq.loiKenh()) {
                    loiKenh = kq.lyDo();
                    break;
                }
                daXuLy++;
                if (kq.thanhCong()) {
                    soThanhCong++;
                } else {
                    soLoi++;
                }
                trangThaiDongBoSanPhamRepository.save(dong);
                theoDoi.daDay(bt.getMaSku(), kq.thanhCong() ? null : tenHienThi(bt), kq.thanhCong(), kq.lyDo());
            }
        }
        int soChuaDay = dongCanDay.size() - daXuLy;

        if (soThanhCong > 0) {
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
        }
        String moTa = moTaKetQuaDayTon(maKenh, ketNoi.tenDiaDiem(), soThanhCong, soLoi, soChuaDay, loiKenh);
        if (dungTheoYeuCau) {
            moTa += "; dừng theo yêu cầu, còn " + soChuaDay + " SKU chưa đẩy";
        }
        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);
        return DayTonResultDto.builder()
                .soDong(soThanhCong)
                .soLoi(soLoi)
                .soChuaDay(soChuaDay)
                .loiKenh(loiKenh)
                .build();
    }

    /** Câu nhật ký của một đợt đẩy tồn; {@code tenDiaDiem}: địa điểm Shopify nhận số (null nếu chưa xác định được). */
    static String moTaKetQuaDayTon(String maKenh, String tenDiaDiem, int soThanhCong, int soLoi, int soChuaDay, String loiKenh) {
        String dau = "Đẩy tồn kho kênh " + maKenh + (tenDiaDiem != null ? " vào " + tenDiaDiem : "");
        if (loiKenh != null && soThanhCong == 0 && soLoi == 0) {
            return dau + " thất bại: " + loiKenh;
        }
        StringBuilder sb = new StringBuilder(dau).append(": ")
                .append(soThanhCong).append(" SKU thành công");
        if (soLoi > 0) {
            sb.append(", ").append(soLoi).append(" SKU lỗi");
        }
        if (loiKenh != null) {
            sb.append("; dừng giữa chừng, còn ").append(soChuaDay).append(" SKU chưa đẩy: ").append(loiKenh);
        }
        return sb.toString();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void dayTonKhoKhanCap(Integer bienTheSanPhamId) {
        if (bienTheSanPhamId == null) return;
        List<TrangThaiDongBoSanPham> mappings = trangThaiDongBoSanPhamRepository.findByBienTheSanPhamId(bienTheSanPhamId);
        for (TrangThaiDongBoSanPham m : mappings) {
            if (m.getKenhBanHang() == null || !Integer.valueOf(1).equals(m.getKenhBanHang().getTrangThai()) || !duocDayTon(m)) {
                continue;
            }
            String maKenhCuaDong = m.getKenhBanHang().getMaKenh();
            if (!KenhCauHinhDongBo.tuDongDayTon(dieuHanhHeThongService, maKenhCuaDong)) {
                log.info("[JOB-03 Real-time] Kênh {} đang tắt tự động đẩy tồn, bỏ qua SKU ID {}", maKenhCuaDong, bienTheSanPhamId);
                continue;
            }
            log.info("[JOB-03 Real-time] Tồn kho SKU ID {} < 3 units. Kích hoạt đẩy tồn khẩn cấp lên kênh {} (Sàn SKU: {})",
                    bienTheSanPhamId, maKenhCuaDong, m.getMaSanPhamKenh());
            try {
                KetNoiDayTon ketNoi = moKetNoiDayTon(m.getKenhBanHang());
                if (ketNoi.lyDoLoi() != null) {
                    log.warn("[JOB-03 Real-time] Không đẩy tồn khẩn cấp SKU ID {} lên kênh {}: {}", bienTheSanPhamId, maKenhCuaDong, ketNoi.lyDoLoi());
                    continue;
                }
                int soDay = soTonDayTheoQuyTacDaLuu(maKenhCuaDong, khaDungToanChuoi(bienTheSanPhamId));
                KetQuaGuiTon kq = dayTonChoDong(m, ketNoi, soDay);
                if (kq.loiKenh()) {
                    log.warn("[JOB-03 Real-time] Không đẩy tồn khẩn cấp SKU ID {} lên kênh {}: {}", bienTheSanPhamId, maKenhCuaDong, kq.lyDo());
                    continue;
                }
                if (kq.thanhCong()) {
                    lanDayTonCuoi.put(m.getKenhBanHang().getId(), Instant.now());
                } else {
                    log.warn("[JOB-03 Real-time] Shopify không nhận tồn khẩn cấp SKU ID {}: {}", bienTheSanPhamId, kq.lyDo());
                }
                trangThaiDongBoSanPhamRepository.save(m);
            } catch (Exception e) {
                log.warn("Lỗi khi đẩy tồn khẩn cấp cho SKU {}: {}", bienTheSanPhamId, e.getMessage());
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
        // Job đẩy tồn (JOB-03) và lấy đơn (JOB-01) cùng chạy theo OMNI_SYNC_INTERVAL_MINS
        int chuKyPhut = omnichannelOrderSyncJob.getChuKyPhut();

        return DongBoTongQuanDto.builder()
                .tongSkuSan(tong)
                .daLienKet(daLienKet)
                .chuaLienKet(chuaLienKet)
                .loiDongBo(thatBai)
                .lanDongBoCuoi(kenh.getNgayCapNhat())
                .chuKyDongBoTonPhut(chuKyPhut)
                .chuKyLayDonPhut(chuKyPhut)
                .lanDayTonCuoi(lanDayTonCuoi.get(kenh.getId()))
                .lanLayDonCuoi(omnichannelOrderSyncJob.getLanLayDonCuoi(kenh.getId()))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BienTheOptionDto> timBienThe(String q, int limit) {
        int max = limit > 0 ? Math.min(limit, 50) : 20;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, max);
        String keyword = q != null ? q.trim() : "";
        List<BienTheSanPham> list = bienTheSanPhamRepository.searchVariantsForMapping(keyword, pageable);
        return list.stream().map(bt -> BienTheOptionDto.builder()
                .id(bt.getId())
                .maSku(bt.getMaSku())
                .tenBienThe(buildVariantName(bt))
                .tenSanPham(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .giaBan(bt.getGiaBan())
                .build()
        ).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShopifyLocationDto> getLocations(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        if (OmnichannelOrderSyncJob.MA_KENH_LAZADA.equalsIgnoreCase(kenh.getMaKenh())) {
            return List.of(
                    ShopifyLocationDto.builder()
                            .maKhoSan("lazada-default-warehouse")
                            .tenKhoSan("Kho mặc định Lazada")
                            .loai("fulfillment")
                            .macDinh(true)
                            .build()
            );
        }
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (token == null || token.isBlank() || domain.isBlank()) {
            return List.of(
                    ShopifyLocationDto.builder()
                            .maKhoSan("gid://shopify/Location/default")
                            .tenKhoSan("Kho mặc định Shopify")
                            .loai("fulfillment")
                            .macDinh(true)
                            .build()
            );
        }

        JsonNode locations;
        try {
            locations = docShopify(domain, token, "locations.json");
        } catch (Exception e) {
            // Rỗng thay vì một "kho mặc định" giả: giao diện báo không đọc được, không hiện tên sai
            log.warn("Không lấy được danh sách location từ Shopify: {}", e.getMessage());
            return List.of();
        }
        Long primaryId = null;
        try {
            long id = docShopify(domain, token, "shop.json?fields=primary_location_id").path("shop").path("primary_location_id").asLong(0);
            primaryId = id > 0 ? id : null;
        } catch (Exception e) {
            log.warn("Không đọc được địa điểm mặc định của cửa hàng Shopify: {}", e.getMessage());
        }
        return dsDiaDiem(locations, primaryId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DongBoTongQuanDto luuCaiDat(String maKenh, KenhBanHangCaiDatRequest request) {
        KenhBanHang kenh = getKenhActive(maKenh);
        if (request.getKhoId() != null && !khoRepository.existsById(request.getKhoId())) {
            throw new CommonException("Kho FCentric không tồn tại: " + request.getKhoId(), HttpStatus.BAD_REQUEST, null);
        }

        kenh.setNgayCapNhat(Instant.now());
        kenhBanHangRepository.save(kenh);

        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban,
                String.format("Lưu cấu hình đồng bộ: Kho %s, Kho sàn %s, Tỷ lệ %s%%, Tồn đệm %s, Ngưỡng về 0: %s",
                        request.getKhoId(), request.getMaKhoSan(), request.getTyLeDayTon(), request.getTonDem(), request.getNguongVe0()));

        return getTongQuan(maKenh);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NhatKyDongBoDto> filterNhatKy(String maKenh, String loai, String trangThai, String search, Pageable pageable) {
        KenhBanHang kenh = getKenhActive(maKenh);
        String dbTrangThai = null;
        if ("THANH_CONG".equalsIgnoreCase(trangThai)) {
            dbTrangThai = "thanh_cong";
        } else if ("LOI".equalsIgnoreCase(trangThai)) {
            dbTrangThai = "that_bai";
        } else if ("CHO".equalsIgnoreCase(trangThai)) {
            dbTrangThai = "chua_dong_bo";
        }

        Page<TrangThaiDongBoSanPham> page = trangThaiDongBoSanPhamRepository.filterByKenh(
                kenh.getId(),
                dbTrangThai,
                (search == null || search.isBlank()) ? null : search.trim(),
                pageable
        );

        return page.map(this::mapToNhatKyDto);
    }

    @Override
    @Transactional(readOnly = true)
    public NhatKyDongBoDto getNhatKyDetail(Integer id) {
        TrangThaiDongBoSanPham tt = trangThaiDongBoSanPhamRepository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy sự kiện nhật ký với ID " + id, HttpStatus.NOT_FOUND, null));
        return mapToNhatKyDto(tt);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LayDonResultDto layDonHang(String maKenh, LayDonHangKenhRequest request) {
        KenhBanHang kenh = getKenhActive(maKenh);
        kiemTraDaKetNoi(kenh);
        Instant tu = Instant.now().minusSeconds(86400);
        Instant den = Instant.now();
        if (request != null) {
            if (request.getTu() != null && !request.getTu().isBlank()) {
                try {
                    tu = Instant.parse(request.getTu());
                } catch (Exception ignored) {}
            }
            if (request.getDen() != null && !request.getDen().isBlank()) {
                try {
                    den = Instant.parse(request.getDen());
                } catch (Exception ignored) {}
            }
        }

        int synced = 0;
        if (OmnichannelOrderSyncJob.MA_KENH_LAZADA.equalsIgnoreCase(kenh.getMaKenh())) {
            synced = omnichannelOrderSyncJob.syncLazadaOrders(kenh, tu, den);
        } else {
            synced = omnichannelOrderSyncJob.syncShopifyOrders(kenh, tu, den);
        }
        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban, "Lấy đơn hàng từ sàn " + maKenh + ": thành công " + synced + " đơn");

        return LayDonResultDto.builder()
                .soDonMoi(synced)
                .soDonCapNhat(0)
                .thongDiep("Nhận " + synced + " đơn hàng mới từ sàn " + maKenh)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DayTonResultDto dongBoTatCa() {
        List<KenhBanHang> activeKenh = kenhBanHangRepository.findByTrangThai(1);
        int totalSku = 0;
        for (KenhBanHang kenh : activeKenh) {
            if (MA_KENH_SHOPIFY.equalsIgnoreCase(kenh.getMaKenh())) {
                DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
                if (dayTonRes != null) {
                    totalSku += dayTonRes.getSoDong();
                }
                omnichannelOrderSyncJob.syncShopifyOrders(kenh);
            } else if (OmnichannelOrderSyncJob.MA_KENH_LAZADA.equalsIgnoreCase(kenh.getMaKenh())) {
                DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
                if (dayTonRes != null) {
                    totalSku += dayTonRes.getSoDong();
                }
                omnichannelOrderSyncJob.syncLazadaOrders(kenh);
            }
        }
        return DayTonResultDto.builder()
                .soDong(totalSku)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LienKetSanPhamDto thuLai(Integer lienKetId) {
        TrangThaiDongBoSanPham tt = trangThaiDongBoSanPhamRepository.findById(lienKetId)
                .orElseThrow(() -> new CommonException("Không tìm thấy liên kết với ID " + lienKetId, HttpStatus.NOT_FOUND, null));
        kiemTraDaKetNoi(tt.getKenhBanHang());

        BienTheSanPham bt = tt.getBienTheSanPham();
        BigDecimal soLuongKhaDung = BigDecimal.ZERO;
        if (bt != null) {
            soLuongKhaDung = khaDungToanChuoi(bt.getId());

            // Lỗi cả gian hàng: báo lỗi, giữ nguyên dòng. Lỗi riêng SKU: dòng sang Lỗi kèm lý do Shopify trả về
            KenhBanHang kenhCuaDong = tt.getKenhBanHang();
            KetNoiDayTon ketNoi = moKetNoiDayTon(kenhCuaDong);
            if (ketNoi.lyDoLoi() != null) {
                throw new CommonException(ketNoi.lyDoLoi(), HttpStatus.BAD_REQUEST, null);
            }
            int soDay = soTonDayTheoQuyTacDaLuu(kenhCuaDong.getMaKenh(), soLuongKhaDung);
            KetQuaGuiTon kq = dayTonChoDong(tt, ketNoi, soDay);
            if (kq.loiKenh()) {
                throw new CommonException(kq.lyDo(), HttpStatus.BAD_REQUEST, null);
            }
            if (kq.thanhCong()) {
                lanDayTonCuoi.put(kenhCuaDong.getId(), Instant.now());
            } else {
                log.warn("Thử lại đồng bộ SKU {} thất bại: {}", bt.getMaSku(), kq.lyDo());
            }
            trangThaiDongBoSanPhamRepository.save(tt);
        }

        Integer sanPhamIdCuaDong = bt != null && bt.getSanPham() != null ? bt.getSanPham().getId() : null;
        return LienKetSanPhamDto.builder()
                .id(tt.getId())
                .skuSan(tt.getMaSanPhamKenh())
                .tenSanPhamSan(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienTheSan(bt != null ? buildVariantName(bt) : null)
                .giaBanSan(bt != null ? bt.getGiaBan() : null)
                .bienTheSanPhamId(bt != null ? bt.getId() : null)
                .sanPhamId(sanPhamIdCuaDong)
                .anhDaiDien(anhDaiDienCuaSanPham(sanPhamIdCuaDong))
                .maSku(bt != null ? bt.getMaSku() : null)
                .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienThe(bt != null ? buildVariantName(bt) : null)
                .giaBan(bt != null ? bt.getGiaBan() : null)
                .soLuongKhaDung(soLuongKhaDung)
                .soLuongDaDay(soDaDay(tt))
                .ngayDayTonCuoi(tt.getNgayDayTonCuoi())
                .choPhepDongBo(true)
                .trangThaiLienKet(mapStatusToFrontend(tt.getTrangThaiDongBo()))
                .ngayDongBoCuoi(tt.getNgayDongBoCuoi())
                .chiTietLoi(tt.getChiTietLoi())
                .build();
    }

    /**
     * Ảnh đại diện của từng sản phẩm (ảnh chính, không có thì ảnh đầu), một truy vấn cho cả danh sách.
     * Chỉ để hiển thị: lỗi đọc ảnh thì trả rỗng, không làm hỏng danh sách liên kết.
     */
    private Map<Integer, String> anhDaiDienTheoSanPham(Collection<Integer> sanPhamIds) {
        if (sanPhamIds == null || sanPhamIds.isEmpty()) return Map.of();
        Map<Integer, String> ketQua = new HashMap<>();
        try {
            // Truy vấn đã sắp ảnh chính lên trước trong từng sản phẩm, nên giữ ảnh gặp đầu tiên
            for (AnhQuanAo anh : anhQuanAoRepository.findActiveByQuanAoIds(sanPhamIds)) {
                if (anh.getQuanAo() == null || anh.getTepTin() == null) continue;
                String url = duongDanAnh(anh.getTepTin());
                if (url != null) ketQua.putIfAbsent(anh.getQuanAo().getId(), url);
            }
        } catch (Exception ex) {
            log.warn("Không lấy được ảnh sản phẩm cho danh sách liên kết: {}", ex.getMessage());
        }
        return ketQua;
    }

    private String anhDaiDienCuaSanPham(Integer sanPhamId) {
        return sanPhamId == null ? null : anhDaiDienTheoSanPham(List.of(sanPhamId)).get(sanPhamId);
    }

    /** URL ảnh đã đổi sang tên miền HTTPS, nếu không web HTTPS chặn ảnh từ IP MinIO (Mixed Content). */
    private String duongDanAnh(TepTin tep) {
        if (tep.getDuongDan() != null && !tep.getDuongDan().isBlank()) return PublicAssetUrl.toHttps(tep.getDuongDan());
        if (tep.getTenLuuTru() == null || tep.getTenLuuTru().isBlank()) return null;
        try {
            return PublicAssetUrl.toHttps(minioService.getPublicUrl(tep.getTenLuuTru()));
        } catch (Exception ex) {
            return null;
        }
    }

    private NhatKyDongBoDto mapToNhatKyDto(TrangThaiDongBoSanPham tt) {
        KenhBanHang kenh = tt.getKenhBanHang();
        BienTheSanPham bt = tt.getBienTheSanPham();

        String statusStr = "CHO";
        boolean canRetry = false;
        String errorMsg = null;
        String errCode = null;

        if ("thanh_cong".equalsIgnoreCase(tt.getTrangThaiDongBo())) {
            statusStr = "THANH_CONG";
        } else if ("that_bai".equalsIgnoreCase(tt.getTrangThaiDongBo())) {
            statusStr = "LOI";
            canRetry = true;
            errCode = "SYNC_FAILED";
            errorMsg = tt.getChiTietLoi() != null ? tt.getChiTietLoi() : "Lỗi đồng bộ tồn kho sang sàn";
        }

        String skuRef = bt != null ? bt.getMaSku() : tt.getMaSanPhamKenh();
        String message = statusStr.equals("THANH_CONG")
                ? ("Đồng bộ tồn kho SKU " + skuRef + " thành công")
                : (errorMsg != null ? errorMsg : "Chờ đồng bộ tồn kho cho SKU " + skuRef);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("skuSan", tt.getMaSanPhamKenh());
        if (bt != null) {
            summary.put("maSku", bt.getMaSku());
            if (bt.getSanPham() != null) {
                summary.put("tenSanPham", bt.getSanPham().getTenSanPham());
            }
        }
        summary.put("trangThai", tt.getTrangThaiDongBo());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("lienKetId", tt.getId());
        payload.put("kenhBanId", kenh != null ? kenh.getId() : null);
        payload.put("maSanPhamKenh", tt.getMaSanPhamKenh());
        payload.put("ngayDongBoCuoi", tt.getNgayDongBoCuoi() != null ? tt.getNgayDongBoCuoi().toString() : null);
        payload.put("chiTietLoi", tt.getChiTietLoi());

        return NhatKyDongBoDto.builder()
                .id(tt.getId())
                .ketNoiKenhId(kenh != null ? kenh.getId() : null)
                .maKenh(kenh != null ? kenh.getMaKenh() : "SHOPIFY")
                .tenHienThi(kenh != null ? kenh.getTenKenh() : "Shopify Official")
                .loai("TON_KHO")
                .nguon("FCENTRIC")
                .trangThai(statusStr)
                .maThamChieu(skuRef)
                .thongDiep(message)
                .maLoi(errCode)
                .chiTietLoi(tt.getChiTietLoi())
                .ngayTao(tt.getNgayDongBoCuoi() != null ? tt.getNgayDongBoCuoi() : Instant.now())
                .coTheThuLai(canRetry)
                .duLieuTomTat(summary)
                .payload(payload)
                .build();
    }

    @Override
    public boolean coKenh(String maKenh) {
        return maKenh != null && !maKenh.isBlank() && timKenh(maKenh.trim()).isPresent();
    }

    @Override
    public void kiemTraDaKetNoi(String maKenh) {
        kiemTraDaKetNoi(getKenhActive(maKenh));
    }

    /** Thao tác cần khóa truy cập: kênh chưa có khóa (chưa kết nối hoặc đã ngắt) thì báo để giao diện đọc lại kết nối. */
    private void kiemTraDaKetNoi(KenhBanHang kenh) {
        if (kenh == null || kenh.getApiKey() == null || kenh.getApiKey().isBlank()) {
            throw kenhChuaKetNoi(kenh != null ? kenh.getMaKenh() : null);
        }
    }

    private static LoiCoMaException kenhChuaKetNoi(String maKenh) {
        String ten = KenhBanHangServiceImpl.tenSan(maKenh);
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.KENH_CHUA_KET_NOI,
                ten + " chưa kết nối. Kết nối lại ở trình thiết lập rồi thử lại.");
    }

    @Override
    public boolean chayKhiKenhRanh(String maKenh, Runnable viec) {
        KenhBanHang kenh = getKenhActive(maKenh);
        ReentrantLock khoa = khoaDayTon.computeIfAbsent(kenh.getId(), id -> new ReentrantLock());
        if (!khoa.tryLock()) {
            return false;
        }
        try {
            viec.run();
            return true;
        } finally {
            khoa.unlock();
        }
    }

    @Override
    public void xoaMocLanChay(String maKenh) {
        timKenh(maKenh == null ? "" : maKenh.trim()).ifPresent(kenh -> {
            lanDayTonCuoi.remove(kenh.getId());
            omnichannelOrderSyncJob.xoaLanLayDonCuoi(kenh.getId());
        });
    }

    private KenhBanHang getKenhActive(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) {
            throw new CommonException("Mã kênh không được để trống", HttpStatus.BAD_REQUEST, null);
        }
        return timKenh(maKenh.trim())
                .orElseThrow(() -> new CommonException("Không tìm thấy kênh bán hàng: " + maKenh, HttpStatus.NOT_FOUND, null));
    }

    /** Tìm kênh theo id (chuỗi số) hoặc mã kênh (nguyên văn, rồi in hoa). */
    private Optional<KenhBanHang> timKenh(String trimmed) {
        try {
            Integer id = Integer.parseInt(trimmed);
            Optional<KenhBanHang> byId = kenhBanHangRepository.findById(id);
            if (byId.isPresent()) return byId;
        } catch (NumberFormatException ignored) {
        }
        return kenhBanHangRepository.findByMaKenh(trimmed)
                .or(() -> kenhBanHangRepository.findByMaKenh(trimmed.toUpperCase()));
    }

    private String extractDomainFromApiUrl(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) return "";
        String clean = apiUrl.trim().replaceFirst("^(?i)https?://", "");
        int slashIdx = clean.indexOf('/');
        return (slashIdx > 0 ? clean.substring(0, slashIdx) : clean).trim().toLowerCase();
    }

    /** "Tên sản phẩm - Màu - Size" cho danh sách SKU lỗi; đọc không được thì null (không làm hỏng đợt đẩy). */
    private String tenHienThi(BienTheSanPham bt) {
        try {
            String tenSp = bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null;
            String bienThe = buildVariantName(bt);
            if (tenSp == null) return bienThe.isBlank() ? null : bienThe;
            return bienThe.isBlank() ? tenSp : tenSp + " - " + bienThe;
        } catch (Exception e) {
            return null;
        }
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

    /** Địa điểm Shopify nhận số tồn: địa điểm mặc định của cửa hàng (Settings › Locations › Default location). */
    record DiaDiemShopify(Long id, String ten) {}

    /** GET một tài nguyên Admin API của Shopify; lỗi HTTP hoặc kết nối thì ném ra. */
    private JsonNode docShopify(String domain, String token, String duongDan) throws Exception {
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/" + duongDan;
        ResponseEntity<String> response = createRestTemplate()
                .exchange(url, HttpMethod.GET, new HttpEntity<Void>(createHeaders(token)), String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException("Shopify trả mã " + response.getStatusCode().value() + " khi đọc " + duongDan);
        }
        return objectMapper.readTree(response.getBody());
    }

    /**
     * Địa điểm mặc định của cửa hàng (shop.primary_location_id) kèm tên; null nếu không xác định được.
     * Không lấy địa điểm đầu danh sách: Shopify không trả địa điểm mặc định lên đầu.
     */
    DiaDiemShopify layDiaDiemMacDinh(String domain, String token) {
        JsonNode shop = null;
        try {
            shop = docShopify(domain, token, "shop.json?fields=primary_location_id");
        } catch (Exception e) {
            log.warn("Không đọc được shop.json trên Shopify: {}", e.getMessage());
        }

        JsonNode locations = null;
        try {
            locations = docShopify(domain, token, "locations.json");
        } catch (Exception e) {
            log.warn("Không đọc được locations.json trên Shopify: {}", e.getMessage());
            return null;
        }

        return chonDiaDiemMacDinh(shop, locations);
    }

    /**
     * Tìm địa điểm có id = shop.primary_location_id trong danh sách locations.
     * Fallback an toàn: nếu chỉ có đúng 1 địa điểm duy nhất trong cửa hàng thì chọn địa điểm đó.
     * Null nếu không có địa điểm nào hoặc có nhiều địa điểm mà không xác định được địa điểm mặc định.
     */
    static DiaDiemShopify chonDiaDiemMacDinh(JsonNode shop, JsonNode locations) {
        if (locations == null || !locations.has("locations")) return null;
        JsonNode locList = locations.path("locations");
        if (!locList.isArray() || locList.isEmpty()) return null;

        if (shop != null) {
            long id = shop.path("shop").path("primary_location_id").asLong(0);
            if (id > 0) {
                for (JsonNode loc : locList) {
                    if (loc.path("id").asLong() == id) {
                        return new DiaDiemShopify(id, loc.path("name").asText("Địa điểm " + id));
                    }
                }
            }
        }

        // Fallback an toàn cho store chỉ có đúng 1 địa điểm duy nhất
        if (locList.size() == 1) {
            JsonNode single = locList.get(0);
            long id = single.path("id").asLong(0);
            if (id > 0) {
                return new DiaDiemShopify(id, single.path("name").asText("Địa điểm " + id));
            }
        }

        return null;
    }

    /** Danh sách địa điểm cho giao diện: đánh dấu và xếp địa điểm mặc định lên đầu, giữ thứ tự các địa điểm còn lại. */
    static List<ShopifyLocationDto> dsDiaDiem(JsonNode locations, Long primaryId) {
        List<ShopifyLocationDto> list = new ArrayList<>();
        for (JsonNode loc : locations.path("locations")) {
            long id = loc.path("id").asLong();
            list.add(ShopifyLocationDto.builder()
                    .maKhoSan(String.valueOf(id))
                    .tenKhoSan(loc.path("name").asText("Kho Shopify " + id))
                    .loai(loc.path("legacy").asBoolean(false) ? "legacy" : "fulfillment")
                    .macDinh(primaryId != null && primaryId == id)
                    .build());
        }
        list.sort(Comparator.comparing(ShopifyLocationDto::isMacDinh).reversed());
        return list;
    }

    private Map<String, ShopifyVariantInfo> layDanhSachSkuHienCoTrenShopify(String domain, String token, Map<String, Long> titleToProductIdMap) {
        try {
            return taiDanhSachSkuShopify(domain, token, titleToProductIdMap);
        } catch (Exception e) {
            log.warn("Lỗi khi quét danh sách sản phẩm hiện có trên Shopify: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    /** Như trên nhưng báo lỗi ra ngoài, để luồng đẩy tồn phân biệt "gian hàng không có SKU" với "không tải được danh sách". */
    private Map<String, ShopifyVariantInfo> taiDanhSachSkuShopify(String domain, String token, Map<String, Long> titleToProductIdMap) throws Exception {
        Map<String, ShopifyVariantInfo> result = new HashMap<>();
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json?limit=250";
        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException("Shopify trả mã " + response.getStatusCode().value() + " khi tải danh sách sản phẩm");
        }
        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode products = root.path("products");
        if (products.isArray()) {
            for (JsonNode prod : products) {
                Long prodId = prod.path("id").asLong();
                String prodTitle = prod.path("title").asText("").trim().toLowerCase();
                if (!prodTitle.isBlank() && titleToProductIdMap != null) {
                    titleToProductIdMap.put(prodTitle, prodId);
                }
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
        return result;
    }

    private Map<String, ShopifyVariantInfo> taoSanPhamLenShopify(String domain, String token, SanPhamQuanAo sp, List<BienTheSanPham> variants) throws Exception {
        return taoSanPhamLenShopify(domain, token, sp, variants, variants);
    }

    private Map<String, ShopifyVariantInfo> taoSanPhamLenShopify(String domain, String token, SanPhamQuanAo sp, List<BienTheSanPham> variants, List<BienTheSanPham> allSpVariants) throws Exception {
        Map<String, ShopifyVariantInfo> result = new HashMap<>();
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json";

        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        String vendorName = "FCentric";
        if (sp != null && sp.getThuongHieu() != null && sp.getThuongHieu().getTenThuongHieu() != null && !sp.getThuongHieu().getTenThuongHieu().isBlank()) {
            vendorName = sp.getThuongHieu().getTenThuongHieu().trim();
        }

        String categoryName = "Thời trang";
        if (sp != null && sp.getDanhMuc() != null && sp.getDanhMuc().getTenDanhMuc() != null && !sp.getDanhMuc().getTenDanhMuc().isBlank()) {
            categoryName = sp.getDanhMuc().getTenDanhMuc().trim();
        }

        Map<String, Object> productObj = new LinkedHashMap<>();
        productObj.put("title", sp != null && sp.getTenSanPham() != null ? sp.getTenSanPham() : "Sản phẩm FCentric");
        productObj.put("body_html", "<p>" + (sp != null && sp.getMoTa() != null && !sp.getMoTa().isBlank() ? sp.getMoTa() : (sp != null ? sp.getTenSanPham() : "")) + "</p>");
        productObj.put("vendor", vendorName);
        productObj.put("product_type", categoryName);
        productObj.put("tags", categoryName.equalsIgnoreCase(vendorName) ? categoryName : categoryName + ", " + vendorName);
        productObj.put("status", "active");

        // [Ưu tiên 1 - Hybrid Smart Sync]: Đính kèm ảnh chính sản phẩm cha vào payload khởi tạo (tiết kiệm request, 0 latency)
        if (sp != null && sp.getId() != null) {
            try {
                List<AnhQuanAo> prodImages = anhQuanAoRepository.findActiveByQuanAoIds(List.of(sp.getId()));
                if (!prodImages.isEmpty()) {
                    AnhQuanAo mainImg = prodImages.stream()
                            .filter(a -> Integer.valueOf(1).equals(a.getAnhChinh()))
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

            // Tính giá bán an toàn, tuyệt đối không để 0đ
            BigDecimal price = bt.getGiaBan();
            if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                price = allSpVariants != null ? allSpVariants.stream()
                        .map(BienTheSanPham::getGiaBan)
                        .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
                        .findFirst()
                        .orElse(sp != null && sp.getGiaBanMacDinh() != null ? sp.getGiaBanMacDinh() : BigDecimal.valueOf(100000))
                        : (sp != null && sp.getGiaBanMacDinh() != null ? sp.getGiaBanMacDinh() : BigDecimal.valueOf(100000));
            }
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

    private Map<String, ShopifyVariantInfo> themVariantsVaoSanPhamShopify(String domain, String token, Long shopifyProductId, SanPhamQuanAo sp, List<BienTheSanPham> variants, List<BienTheSanPham> allSpVariants) {
        Map<String, ShopifyVariantInfo> result = new HashMap<>();
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products/" + shopifyProductId + "/variants.json";
        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        for (BienTheSanPham bt : variants) {
            try {
                Map<String, Object> varMap = new LinkedHashMap<>();
                String opt1 = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank())
                        ? bt.getMauSac().getTenMau().trim() : "Mặc định";
                String opt2 = (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank())
                        ? bt.getSize().getTenSize().trim() : "Tiêu chuẩn";
                String opt3 = (bt.getChatLieu() != null && bt.getChatLieu().getTenChatLieu() != null && !bt.getChatLieu().getTenChatLieu().isBlank())
                        ? bt.getChatLieu().getTenChatLieu().trim() : "Cotton";

                varMap.put("option1", opt1);
                varMap.put("option2", opt2);
                varMap.put("option3", opt3);
                varMap.put("sku", bt.getMaSku());

                // Tính giá bán an toàn, tuyệt đối không để 0đ
                BigDecimal price = bt.getGiaBan();
                if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                    price = allSpVariants != null ? allSpVariants.stream()
                            .map(BienTheSanPham::getGiaBan)
                            .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
                            .findFirst()
                            .orElse(sp != null && sp.getGiaBanMacDinh() != null ? sp.getGiaBanMacDinh() : BigDecimal.valueOf(100000))
                            : (sp != null && sp.getGiaBanMacDinh() != null ? sp.getGiaBanMacDinh() : BigDecimal.valueOf(100000));
                }
                varMap.put("price", price.setScale(2, RoundingMode.HALF_UP).toPlainString());

                if (bt.getMaVachSku() != null && !bt.getMaVachSku().isBlank()) {
                    varMap.put("barcode", bt.getMaVachSku().trim());
                }
                varMap.put("inventory_management", "shopify");

                Map<String, Object> body = Map.of("variant", varMap);
                String jsonBody = objectMapper.writeValueAsString(body);
                HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    JsonNode v = root.path("variant");
                    String sku = v.path("sku").asText("").trim().toLowerCase();
                    Long imgId = v.path("image_id").isNull() || v.path("image_id").asLong() == 0 ? null : v.path("image_id").asLong();
                    result.put(sku, new ShopifyVariantInfo(
                            v.path("id").asLong(),
                            v.path("inventory_item_id").asLong(),
                            shopifyProductId,
                            imgId
                    ));
                    log.info("Thêm thành công biến thể [{}] vào sản phẩm Shopify ID {}", bt.getMaSku(), shopifyProductId);
                }
                try { Thread.sleep(200); } catch (InterruptedException ignored) {}
            } catch (Exception e) {
                log.warn("Lỗi khi thêm biến thể [{}] vào sản phẩm Shopify {}: {}", bt.getMaSku(), shopifyProductId, e.getMessage());
            }
        }
        return result;
    }

    private boolean capNhatSanPhamLenShopify(String domain, String token, Long shopifyProductId, SanPhamQuanAo sp) {
        if (shopifyProductId == null || sp == null) return false;
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products/" + shopifyProductId + ".json";

        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        String vendorName = "FCentric";
        if (sp.getThuongHieu() != null && sp.getThuongHieu().getTenThuongHieu() != null && !sp.getThuongHieu().getTenThuongHieu().isBlank()) {
            vendorName = sp.getThuongHieu().getTenThuongHieu().trim();
        }

        String categoryName = "Thời trang";
        if (sp.getDanhMuc() != null && sp.getDanhMuc().getTenDanhMuc() != null && !sp.getDanhMuc().getTenDanhMuc().isBlank()) {
            categoryName = sp.getDanhMuc().getTenDanhMuc().trim();
        }

        Map<String, Object> productObj = new LinkedHashMap<>();
        productObj.put("id", shopifyProductId);
        if (sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()) {
            productObj.put("title", sp.getTenSanPham().trim());
        }
        productObj.put("vendor", vendorName);
        productObj.put("product_type", categoryName);
        productObj.put("tags", categoryName.equalsIgnoreCase(vendorName) ? categoryName : categoryName + ", " + vendorName);

        Map<String, Object> body = Map.of("product", productObj);
        try {
            String jsonBody = objectMapper.writeValueAsString(body);
            HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Cập nhật thành công sản phẩm [{}] (Shopify ID: {}) - Vendor: {}, Type: {}, Tags: {}",
                        sp.getTenSanPham(), shopifyProductId, vendorName, categoryName, productObj.get("tags"));
                return true;
            }
        } catch (Exception e) {
            log.warn("Lỗi khi gọi PUT cập nhật sản phẩm Shopify ID {}: {}", shopifyProductId, e.getMessage());
        }
        return false;
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

            // Gom nhóm: Mỗi file ảnh (TepTin) chỉ upload 1 lần duy nhất, gán cho TẤT CẢ các variants cùng dùng ảnh này
            Map<Integer, List<BienTheSanPham>> variantsByTepTinId = new HashMap<>();
            Map<Integer, TepTin> tepTinById = new HashMap<>();

            for (AnhBienThe ab : anhBienTheList) {
                if (ab.getBienThe() != null && ab.getTepTin() != null && ab.getTepTin().getId() != null) {
                    Integer tepId = ab.getTepTin().getId();
                    tepTinById.putIfAbsent(tepId, ab.getTepTin());
                    variantsByTepTinId.computeIfAbsent(tepId, k -> new ArrayList<>()).add(ab.getBienThe());
                }
            }

            for (Map.Entry<Integer, List<BienTheSanPham>> entry : variantsByTepTinId.entrySet()) {
                TepTin tep = tepTinById.get(entry.getKey());
                List<BienTheSanPham> btsInGroup = entry.getValue();

                // Lấy danh sách Shopify Variant IDs của các biến thể trong nhóm mà CHƯA có ảnh
                List<Long> variantIdsCanGanAnh = new ArrayList<>();
                List<ShopifyVariantInfo> vInfoList = new ArrayList<>();

                for (BienTheSanPham bt : btsInGroup) {
                    String skuKey = bt.getMaSku().trim().toLowerCase();
                    ShopifyVariantInfo vInfo = shopifySkuMap.get(skuKey);
                    if (vInfo != null && vInfo.getVariantId() != null && vInfo.getImageId() == null) {
                        variantIdsCanGanAnh.add(vInfo.getVariantId());
                        vInfoList.add(vInfo);
                    }
                }

                if (variantIdsCanGanAnh.isEmpty()) {
                    continue; // Tất cả variants của nhóm ảnh này đã có ảnh, bỏ qua
                }

                if (tep.getTenLuuTru() != null && (tep.getKichCo() == null || tep.getKichCo() <= 3 * 1024 * 1024)) {
                    try {
                        byte[] bytes = minioService.download(tep.getTenLuuTru());
                        if (bytes != null && bytes.length > 0) {
                            String base64 = Base64.getEncoder().encodeToString(bytes);
                            Long newImgId = uploadAnhBienTheLenShopify(domain, token, shopifyProductId, variantIdsCanGanAnh, base64, tep.getTenTaiLen());
                            if (newImgId != null) {
                                for (ShopifyVariantInfo vi : vInfoList) {
                                    vi.setImageId(newImgId);
                                }
                                count += variantIdsCanGanAnh.size();
                            }
                            // Throttle 250ms bảo vệ Shopify leaky bucket rate limit
                            try {
                                Thread.sleep(250);
                            } catch (InterruptedException ignored) {}
                        }
                    } catch (Exception e) {
                        log.warn("Lỗi khi tải hoặc upload ảnh nhóm biến thể sang Shopify: {}", e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Lỗi khi đồng bộ ảnh biến thể cho sản phẩm Shopify [{}]: {}", shopifyProductId, e.getMessage());
        }
        return count;
    }

    private Long uploadAnhBienTheLenShopify(String domain, String token, Long shopifyProductId, List<Long> shopifyVariantIds, String base64Attachment, String filename) {
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products/" + shopifyProductId + "/images.json";
        try {
            RestTemplate restTemplate = createRestTemplate();
            HttpHeaders headers = createHeaders(token);

            Map<String, Object> imgMap = new LinkedHashMap<>();
            imgMap.put("attachment", base64Attachment);
            String safeFilename = filename != null && !filename.isBlank() ? filename : "product_variant_image.jpg";
            imgMap.put("filename", safeFilename);
            imgMap.put("variant_ids", shopifyVariantIds);

            Map<String, Object> body = Map.of("image", imgMap);
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                return root.path("image").path("id").asLong();
            }
        } catch (Exception e) {
            log.warn("Lỗi khi gọi API upload ảnh cho danh sách biến thể {} lên Shopify: {}", shopifyVariantIds, e.getMessage());
        }
        return null;
    }

    /**
     * Kết quả gửi số tồn của một SKU lên Shopify.
     * {@code loiKenh}: lỗi của cả gian hàng (khóa sai, bị giới hạn, Shopify không phản hồi) — đợt đẩy phải dừng
     * và không đổi trạng thái dòng nào; ngược lại là lỗi riêng SKU này.
     */
    record KetQuaGuiTon(boolean thanhCong, boolean loiKenh, String lyDo) {
        static final KetQuaGuiTon THANH_CONG = new KetQuaGuiTon(true, false, null);

        static KetQuaGuiTon loiSku(String lyDo) {
            return new KetQuaGuiTon(false, false, lyDo);
        }

        static KetQuaGuiTon loiCaKenh(String lyDo) {
            return new KetQuaGuiTon(false, true, lyDo);
        }
    }

    /**
     * Kết nối Shopify cho một đợt đẩy tồn; {@code lyDoLoi} khác null là lỗi cả gian hàng, không đẩy được SKU nào.
     * {@code locationId}/{@code tenDiaDiem}: địa điểm mặc định của cửa hàng, nơi nhận số tồn.
     */
    record KetNoiDayTon(String domain, String token, Long locationId, String tenDiaDiem,
                        Map<String, ShopifyVariantInfo> skuMap, String lyDoLoi) {
        static KetNoiDayTon loi(String lyDo) {
            return new KetNoiDayTon(null, null, null, null, Map.of(), lyDo);
        }
    }

    /** Lấy khóa, địa điểm mặc định và danh sách SKU trên sàn của kênh; thiếu bước nào thì trả lý do lỗi cả gian hàng. */
    KetNoiDayTon moKetNoiDayTon(KenhBanHang kenh) {
        if (kenh != null && OmnichannelOrderSyncJob.MA_KENH_LAZADA.equalsIgnoreCase(kenh.getMaKenh())) {
            String appKey = kenhBanHangService.getLazadaAppKey();
            String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret();
            String token = kenhBanHangService.getDecryptedLazadaAccessToken();
            if (appKey == null || appSecret == null || token == null) {
                return KetNoiDayTon.loi("Chưa có App Key, App Secret hoặc Access Token cho kênh Lazada");
            }
            return new KetNoiDayTon("api.lazada.vn", token, 0L, "Gian hàng Lazada", Map.of(), null);
        }
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        String domain = kenh != null ? extractDomainFromApiUrl(kenh.getApiUrl()) : "";
        if (token == null || token.isBlank() || domain.isBlank()) {
            return KetNoiDayTon.loi("Chưa có khóa truy cập hoặc tên miền gian hàng");
        }
        // Không đoán địa điểm khác: ghi nhầm chỗ thì Shopify vẫn báo thành công mà không ai biết
        DiaDiemShopify diaDiem = layDiaDiemMacDinh(domain, token);
        if (diaDiem == null) {
            return KetNoiDayTon.loi("Không xác định được địa điểm mặc định trên Shopify");
        }
        try {
            return new KetNoiDayTon(domain, token, diaDiem.id(), diaDiem.ten(), taiDanhSachSkuShopify(domain, token, null), null);
        } catch (Exception e) {
            log.warn("Không tải được danh sách sản phẩm trên Shopify để đẩy tồn: {}", e.getMessage());
            return KetNoiDayTon.loi("Không tải được danh sách sản phẩm trên Shopify");
        }
    }

    /** Dòng được đưa vào đợt đẩy tồn: đang đồng bộ, hoặc đang lỗi (đẩy lại để tự hết lỗi). Dòng ngừng thì bỏ qua. */
    static boolean duocDayTon(TrangThaiDongBoSanPham dong) {
        return dong.getBienTheSanPham() != null
                && ("thanh_cong".equals(dong.getTrangThaiDongBo()) || "that_bai".equals(dong.getTrangThaiDongBo()));
    }

    /**
     * Gửi số tồn của một dòng liên kết lên Shopify rồi ghi kết quả vào dòng (nơi gọi tự save).
     * Thành công: lưu số và giờ Shopify đã nhận, dòng đang lỗi trở lại "thanh_cong".
     * Lỗi SKU: dòng sang "that_bai" kèm lý do. Lỗi cả gian hàng: không đổi dòng.
     */
    KetQuaGuiTon dayTonChoDong(TrangThaiDongBoSanPham dong, KetNoiDayTon ketNoi, int soDay) {
        KetQuaGuiTon kq;
        if (dong.getKenhBanHang() != null && OmnichannelOrderSyncJob.MA_KENH_LAZADA.equalsIgnoreCase(dong.getKenhBanHang().getMaKenh())) {
            kq = guiTonLenLazada(dong, soDay);
        } else {
            BienTheSanPham bt = dong.getBienTheSanPham();
            String maSku = bt != null ? bt.getMaSku() : null;
            ShopifyVariantInfo vInfo = maSku == null ? null : ketNoi.skuMap().get(maSku.trim().toLowerCase());
            kq = (vInfo == null || vInfo.getInventoryItemId() == null || vInfo.getInventoryItemId() <= 0)
                    ? KetQuaGuiTon.loiSku("Không tìm thấy SKU " + maSku + " trên Shopify")
                    : guiTonLenShopify(ketNoi.domain(), ketNoi.token(), ketNoi.locationId(), vInfo.getInventoryItemId(), soDay);
        }
        Instant now = Instant.now();
        if (kq.thanhCong()) {
            dong.setTrangThaiDongBo("thanh_cong");
            dong.setChiTietLoi(null);
            dong.setSoLuongDaDay(soDay);
            dong.setNgayDayTonCuoi(now);
            dong.setNgayDongBoCuoi(now);
        } else if (!kq.loiKenh()) {
            dong.setTrangThaiDongBo("that_bai");
            dong.setChiTietLoi(kq.lyDo());
            dong.setNgayDongBoCuoi(now);
        }
        return kq;
    }

    KetQuaGuiTon guiTonLenLazada(TrangThaiDongBoSanPham dong, int soDay) {
        BienTheSanPham bt = dong.getBienTheSanPham();
        String maSku = bt != null ? bt.getMaSku() : null;
        if (maSku == null || maSku.isBlank()) {
            return KetQuaGuiTon.loiSku("Biến thể chưa có mã SKU");
        }
        String appKey = kenhBanHangService.getLazadaAppKey();
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret();
        String token = kenhBanHangService.getDecryptedLazadaAccessToken();
        if (appKey == null || appSecret == null || token == null) {
            return KetQuaGuiTon.loiCaKenh("Chưa có cấu hình hoặc Access Token cho kênh Lazada");
        }

        String payloadXml = "<Request><Product><Skus><Sku><SellerSku>" + escapeXml(maSku.trim())
                + "</SellerSku><Quantity>" + Math.max(0, soDay) + "</Quantity></Sku></Skus></Product></Request>";
        try {
            JsonNode res = lazadaClient.updatePriceQuantity(appKey, appSecret, token, payloadXml);
            String code = res.path("code").asText("");
            if ("0".equals(code)) {
                return KetQuaGuiTon.THANH_CONG;
            } else {
                String msg = res.path("message").asText(res.path("sub_message").asText("Lỗi từ Lazada"));
                return KetQuaGuiTon.loiSku("Lazada từ chối: " + msg);
            }
        } catch (Exception ex) {
            log.warn("Lỗi khi đẩy tồn Lazada cho SKU [{}]: {}", maSku, ex.getMessage());
            return KetQuaGuiTon.loiCaKenh("Lỗi kết nối tới Lazada: " + ex.getMessage());
        }
    }

    private static String escapeXml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    /**
     * Ghi số tồn của một inventory item vào địa điểm kho chính trên Shopify.
     * 401/403, 429, 5xx và lỗi kết nối là lỗi cả gian hàng; 4xx còn lại là Shopify từ chối riêng SKU này.
     */
    KetQuaGuiTon guiTonLenShopify(String domain, String token, Long locationId, Long inventoryItemId, int available) {
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/inventory_levels/set.json";
        int retryCount = 0;
        int maxRetries = 2;
        while (true) {
            try {
                RestTemplate restTemplate = createRestTemplate();
                HttpHeaders headers = createHeaders(token);

                Map<String, Object> body = Map.of(
                        "location_id", locationId,
                        "inventory_item_id", inventoryItemId,
                        "available", available
                );
                HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
                ResponseEntity<String> res = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
                if (res != null && res.getStatusCode().is2xxSuccessful()) {
                    return KetQuaGuiTon.THANH_CONG;
                }
                return KetQuaGuiTon.loiSku("Shopify không nhận số tồn (mã " + (res != null ? res.getStatusCode().value() : "?") + ")");
            } catch (HttpStatusCodeException e) {
                if (e.getStatusCode().value() == 429 && retryCount < maxRetries) {
                    retryCount++;
                    long waitMs = 2000L;
                    String retryAfter = e.getResponseHeaders() != null ? e.getResponseHeaders().getFirst("Retry-After") : null;
                    if (retryAfter != null) {
                        try {
                            waitMs = (long) (Double.parseDouble(retryAfter.trim()) * 1000);
                        } catch (Exception ignored) {}
                    }
                    log.warn("Shopify trả lỗi 429 (Too Many Requests) cho item [{}], đợi {}ms rồi thử lại lần {}/{}",
                            inventoryItemId, waitMs, retryCount, maxRetries);
                    try {
                        Thread.sleep(Math.max(1000L, Math.min(waitMs, 5000L)));
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return KetQuaGuiTon.loiCaKenh("Tiến trình bị gián đoạn khi đang chờ giới hạn tốc độ");
                    }
                    continue;
                }
                log.warn("Shopify trả lỗi {} khi set inventory level cho item [{}]: {}",
                        e.getStatusCode().value(), inventoryItemId, e.getResponseBodyAsString());
                return phanLoaiLoiShopify(e.getStatusCode().value(), e.getResponseBodyAsString());
            } catch (ResourceAccessException e) {
                log.warn("Không kết nối được Shopify khi set inventory level cho item [{}]: {}", inventoryItemId, e.getMessage());
                return KetQuaGuiTon.loiCaKenh("Không kết nối được Shopify, vui lòng thử lại sau");
            } catch (Exception e) {
                log.warn("Lỗi khi set inventory level cho item [{}]: {}", inventoryItemId, e.getMessage());
                return KetQuaGuiTon.loiSku(e.getMessage() != null ? e.getMessage() : "Lỗi không xác định khi đẩy tồn");
            }
        }
    }

    /** Phân loại mã lỗi HTTP Shopify trả về khi ghi số tồn. */
    KetQuaGuiTon phanLoaiLoiShopify(int ma, String body) {
        if (ma == 401 || ma == 403) {
            return KetQuaGuiTon.loiCaKenh("Khóa truy cập Shopify không hợp lệ hoặc thiếu quyền ghi tồn kho");
        }
        if (ma == 429) {
            return KetQuaGuiTon.loiCaKenh("Shopify đang giới hạn số lần gọi, vui lòng thử lại sau ít phút");
        }
        if (ma >= 500) {
            return KetQuaGuiTon.loiCaKenh("Shopify đang gặp sự cố (mã " + ma + "), vui lòng thử lại sau");
        }
        String chiTiet = loiTuShopify(body);
        return KetQuaGuiTon.loiSku("Shopify từ chối số tồn" + (chiTiet != null ? ": " + chiTiet : " (mã " + ma + ")"));
    }

    /** Câu lỗi trong body JSON của Shopify: {"errors": "..."}, {"errors": [...]} hoặc {"errors": {"truong": [...]}}. */
    String loiTuShopify(String body) {
        if (body == null || body.isBlank()) return null;
        try {
            List<String> cau = new ArrayList<>();
            gomCauLoi(objectMapper.readTree(body).path("errors"), cau);
            if (cau.isEmpty()) return null;
            String ketQua = String.join("; ", cau);
            return ketQua.length() > 300 ? ketQua.substring(0, 300) + "…" : ketQua;
        } catch (Exception ex) {
            return null;
        }
    }

    private static void gomCauLoi(JsonNode node, List<String> cau) {
        if (node == null || node.isMissingNode() || node.isNull()) return;
        if (node.isTextual()) {
            if (!node.asText().isBlank()) cau.add(node.asText().trim());
            return;
        }
        node.forEach(con -> gomCauLoi(con, cau));
    }

    private BigDecimal khaDungToanChuoi(Integer bienTheId) {
        List<Object[]> stocks = tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(List.of(bienTheId));
        return !stocks.isEmpty() && stocks.get(0)[1] != null ? (BigDecimal) stocks.get(0)[1] : BigDecimal.ZERO;
    }

    /** Số tồn Shopify đã nhận ở lần đẩy thành công gần nhất; null nếu chưa đẩy. */
    private static BigDecimal soDaDay(TrangThaiDongBoSanPham dong) {
        return dong.getSoLuongDaDay() != null ? BigDecimal.valueOf(dong.getSoLuongDaDay()) : null;
    }

    /** Trạng thái dòng liên kết mà người dùng đã bấm "Ngừng đồng bộ". */
    static final String TRANG_THAI_NGUNG = "chua_dong_bo";

    /**
     * Số tồn đẩy lên sàn (BR-OC-10): floor(khả dụng × tỷ lệ / 100) − tồn đệm; kết quả ≤ ngưỡng về 0 thì đẩy 0.
     */
    static int tinhSoTonDay(BigDecimal khaDung, BigDecimal tyLe, int tonDem, int nguongVe0) {
        BigDecimal kd = khaDung != null ? khaDung : BigDecimal.ZERO;
        BigDecimal tl = tyLe != null ? tyLe : BigDecimal.valueOf(100);
        BigDecimal so = kd.multiply(tl).divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR)
                .subtract(BigDecimal.valueOf(tonDem));
        if (so.compareTo(BigDecimal.valueOf(nguongVe0)) <= 0 || so.signum() < 0) {
            return 0;
        }
        return so.min(BigDecimal.valueOf(Integer.MAX_VALUE)).intValue();
    }

    /** Quy tắc đẩy tồn đã lưu của kênh (chưa lưu thì 100%, tồn đệm 0, ngưỡng 0). */
    private DayTonKenhRequest quyTacDaLuu(String maKenh) {
        Integer khoId = SecurityContextHolder.getKhoId();
        if (khoId == null || khoId <= 0) {
            khoId = 1;
        }
        return DayTonKenhRequest.builder()
                .khoId(khoId)
                .tyLeDayTon(BigDecimal.valueOf(KenhCauHinhDongBo.tyLeDayTon(dieuHanhHeThongService, maKenh)))
                .tonDem(KenhCauHinhDongBo.tonDem(dieuHanhHeThongService, maKenh))
                .nguongVe0(KenhCauHinhDongBo.nguongVe0(dieuHanhHeThongService, maKenh))
                .build();
    }

    private int soTonDayTheoQuyTacDaLuu(String maKenh, BigDecimal khaDung) {
        DayTonKenhRequest q = quyTacDaLuu(maKenh);
        return tinhSoTonDay(khaDung, q.getTyLeDayTon(), q.getTonDem(), q.getNguongVe0());
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

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleInventoryRestockedEvent(InventoryRestockedEvent event) {
        if (event == null || event.getBienTheSanPhamId() == null) return;
        log.info("[REALTIME-SYNC] Đơn hàng hủy đã hoàn lại {} units cho SKU ID {}. Kích hoạt đẩy tồn kho cập nhật tức thì lên các sàn!",
                event.getSoLuongHoanLai(), event.getBienTheSanPhamId());
        try {
            dayTonKhoKhanCap(event.getBienTheSanPhamId());
        } catch (Exception e) {
            log.warn("[REALTIME-SYNC] Lỗi khi đẩy tồn kho khẩn cấp cho SKU {}: {}", event.getBienTheSanPhamId(), e.getMessage());
        }
    }

    @Override
    public boolean huyDonHangTrenShopify(String maDonHangKenh, String lyDoHuy) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY)
                .or(() -> kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY.toLowerCase()))
                .orElse(null);
        if (kenh == null) return false;

        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            log.warn("[SHOPIFY-CANCEL] Không có Access Token hợp lệ để hủy đơn {}", maDonHangKenh);
            return false;
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            return false;
        }

        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + maDonHangKenh + "/cancel.json";
        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(8000);
            factory.setReadTimeout(15000);
            RestTemplate restTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Shopify-Access-Token", token);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

            java.util.Map<String, Object> body = new java.util.HashMap<>();
            body.put("reason", "customer");
            body.put("email", false);
            body.put("refund", false);
            body.put("restock", true);

            HttpEntity<java.util.Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("[SHOPIFY-CANCEL] Hủy thành công đơn hàng {} trên Shopify", maDonHangKenh);
                return true;
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY && e.getResponseBodyAsString().contains("already")) {
                log.info("[SHOPIFY-CANCEL] Đơn hàng {} đã ở trạng thái hủy trên Shopify", maDonHangKenh);
                return true;
            }
            log.warn("[SHOPIFY-CANCEL] Lỗi khi gọi Shopify cancel order {}: {}", maDonHangKenh, e.getMessage());
        } catch (Exception e) {
            log.error("[SHOPIFY-CANCEL] Lỗi kết nối khi hủy đơn {}: {}", maDonHangKenh, e.getMessage());
        }
        return false;
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