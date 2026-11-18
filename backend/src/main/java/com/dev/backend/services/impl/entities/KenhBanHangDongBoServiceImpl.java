package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.channel.warehouse.KenhKhoMappingConfigDto;
import com.dev.backend.dto.channel.warehouse.KenhKhoMappingItemDto;
import com.dev.backend.dto.channel.warehouse.KenhKhoMappingUpdateRequest;
import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.request.TikTokInventoryUpdateRequest;
import com.dev.backend.constants.TikTokShopConstants;
import com.dev.backend.services.tiktok.TikTokShopClient;
import com.dev.backend.dto.request.KenhBanHangCaiDatRequest;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.AnhBienThe;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.i18n.DichCauDaLuu;
import com.dev.backend.i18n.LoiTrangThaiException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.TepTinRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TonKhoTongHopRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.shopify.ShopifyOrderProgressClient;
import com.dev.backend.services.MinioService;
import java.time.temporal.ChronoUnit;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.lazada.LazadaClient;
import com.dev.backend.dto.response.customize.TikTokWarehouseDto;
import com.dev.backend.dto.response.customize.TikTokWarehousesResponse;
import com.dev.backend.dto.response.customize.TikTokProductDto;
import com.dev.backend.dto.response.customize.TikTokProductSearchResponse;
import com.dev.backend.dto.request.TikTokProductCreateRequest;
import com.dev.backend.dto.response.customize.TikTokProductCreateResponse;
import com.dev.backend.dto.response.customize.TikTokSkuDto;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
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
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

@Service
@Slf4j

@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KenhBanHangDongBoServiceImpl implements KenhBanHangDongBoService {

    public static final String MA_KENH_SHOPIFY = "SHOPIFY";
    public static final String DEFAULT_API_VERSION = "2024-01";

    ShopifyOrderProgressClient shopifyOrderProgressClient = new ShopifyOrderProgressClient();
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    com.dev.backend.services.shopify.ShopifyWebhookInbox shopifyWebhookInbox;

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
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    TepTinRepository tepTinRepository;
    LazadaClient lazadaClient;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    TikTokShopClient tiktokShopClient;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    DonBanHangRepository donBanHangRepository;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    ChiTietDonBanHangRepository chiTietDonBanHangRepository;

    public TikTokShopClient getTikTokShopClient() {
        if (tiktokShopClient == null) {
            tiktokShopClient = new TikTokShopClient();
        }
        return tiktokShopClient;
    }
    ObjectMapper objectMapper = new ObjectMapper();
    // Lần đẩy tồn lên sàn gần nhất (đã kết nối được Shopify), theo id kênh (màn Theo dõi đồng bộ)
    Map<Integer, Instant> lanDayTonCuoi = new java.util.concurrent.ConcurrentHashMap<>();
    // Khóa đẩy tồn theo id kênh: một kênh chỉ một đợt đẩy tồn cùng lúc (trong một máy chủ)
    Map<Integer, ReentrantLock> khoaDayTon = new java.util.concurrent.ConcurrentHashMap<>();

    private record DongCanCapNhat(TrangThaiDongBoSanPham dong, int soDay, String skuSan, String sellerSku) {
        public String skuId() {
            return skuSan;
        }
    }

    private record TikTokCatalogCache(
            Map<String, String> skuToProductId,
            Map<String, String> skuToSkuId,
            Map<String, String> productTitles,
            Map<String, String> productStatuses,
            Instant expiresAt,
            Instant createdAt) {}
    private final java.util.concurrent.atomic.AtomicReference<TikTokCatalogCache> tikTokCatalogCacheRef = new java.util.concurrent.atomic.AtomicReference<>();

    @org.springframework.beans.factory.annotation.Autowired
    public KenhBanHangDongBoServiceImpl(
            KenhBanHangRepository kenhBanHangRepository,
            TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository,
            BienTheSanPhamRepository bienTheSanPhamRepository,
            TonKhoTheoLoRepository tonKhoTheoLoRepository,
            KenhBanHangService kenhBanHangService,
            LichSuThayDoiService lichSuThayDoiService,
            NguoiDungRepository nguoiDungRepository,
            AnhQuanAoRepository anhQuanAoRepository,
            AnhBienTheRepository anhBienTheRepository,
            MinioService minioService,
            KhoRepository khoRepository,
            TonKhoTongHopRepository tonKhoTongHopRepository,
            OmnichannelOrderSyncJob omnichannelOrderSyncJob,
            DieuHanhHeThongService dieuHanhHeThongService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) LazadaClient lazadaClient) {
        this.kenhBanHangRepository = kenhBanHangRepository;
        this.trangThaiDongBoSanPhamRepository = trangThaiDongBoSanPhamRepository;
        this.bienTheSanPhamRepository = bienTheSanPhamRepository;
        this.tonKhoTheoLoRepository = tonKhoTheoLoRepository;
        this.kenhBanHangService = kenhBanHangService;
        this.lichSuThayDoiService = lichSuThayDoiService;
        this.nguoiDungRepository = nguoiDungRepository;
        this.anhQuanAoRepository = anhQuanAoRepository;
        this.anhBienTheRepository = anhBienTheRepository;
        this.minioService = minioService;
        this.khoRepository = khoRepository;
        this.tonKhoTongHopRepository = tonKhoTongHopRepository;
        this.omnichannelOrderSyncJob = omnichannelOrderSyncJob;
        this.dieuHanhHeThongService = dieuHanhHeThongService;
        this.lazadaClient = lazadaClient != null ? lazadaClient : new LazadaClient();
    }

    public KenhBanHangDongBoServiceImpl(
            KenhBanHangRepository kenhBanHangRepository,
            TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository,
            BienTheSanPhamRepository bienTheSanPhamRepository,
            TonKhoTheoLoRepository tonKhoTheoLoRepository,
            KenhBanHangService kenhBanHangService,
            LichSuThayDoiService lichSuThayDoiService,
            NguoiDungRepository nguoiDungRepository,
            AnhQuanAoRepository anhQuanAoRepository,
            AnhBienTheRepository anhBienTheRepository,
            MinioService minioService,
            KhoRepository khoRepository,
            TonKhoTongHopRepository tonKhoTongHopRepository,
            OmnichannelOrderSyncJob omnichannelOrderSyncJob,
            DieuHanhHeThongService dieuHanhHeThongService) {
        this(kenhBanHangRepository, trangThaiDongBoSanPhamRepository, bienTheSanPhamRepository,
                tonKhoTheoLoRepository, kenhBanHangService, lichSuThayDoiService, nguoiDungRepository,
                anhQuanAoRepository, anhBienTheRepository, minioService, khoRepository,
                tonKhoTongHopRepository, omnichannelOrderSyncJob, dieuHanhHeThongService, null);
    }

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
        if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            return taiSanPhamLazada(kenh);
        }
        if ("TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
            return taiSanPhamTikTok(kenh);
        }
        if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            return taiSanPhamShopee(kenh);
        }
        kiemTraDaKetNoi(kenh);
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            throw kenhChuaKetNoi(kenh.getMaKenh());
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhShopDomain", maKenh), HttpStatus.BAD_REQUEST, null);
        }

        int soSku = 0;
        int soMoi = 0;
        int soCapNhat = 0;
        Set<String> aliveVariantIds = new HashSet<>();

        String currentUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json?limit=250";
        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(8000);
            factory.setReadTimeout(15000);
            RestTemplate restTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Shopify-Access-Token", token);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

            int maxPages = 50;
            int page = 0;

            while (currentUrl != null && page < maxPages) {
                page++;
                HttpEntity<Void> entity = new HttpEntity<>(headers);
                ResponseEntity<String> response = restTemplate.exchange(currentUrl, HttpMethod.GET, entity, String.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    kiemTraLeakyBucket(response.getHeaders().getFirst("X-Shopify-Shop-Api-Call-Limit"));
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
                                    if (!variantId.isBlank()) aliveVariantIds.add(variantId.trim().toLowerCase(Locale.ROOT));
                                    if (!sku.isBlank()) aliveVariantIds.add(sku.trim().toLowerCase(Locale.ROOT));

                                    BigDecimal priceOnChannel = null;
                                    if (varNode.hasNonNull("price")) {
                                        try {
                                            priceOnChannel = new BigDecimal(varNode.path("price").asText("0"));
                                        } catch (Exception ignored) {}
                                    }

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
                                            record.setGiaBanSan(priceOnChannel);
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
                                                    .giaBanSan(priceOnChannel)
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
                currentUrl = trichXuatUrlTrangSau(response.getHeaders().getFirst("Link"));
            }

            // Tự động nhận diện các sản phẩm đã bị xóa hoặc ngừng bán trên Shopify (chuẩn WHM/Sapo)
            List<TrangThaiDongBoSanPham> existingList = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
            for (TrangThaiDongBoSanPham item : existingList) {
                String mspk = item.getMaSanPhamKenh();
                if (mspk != null && !mspk.isBlank() && !aliveVariantIds.contains(mspk.trim().toLowerCase(Locale.ROOT))) {
                    item.setMaSanPhamKenh(null);
                    item.setTrangThaiDongBo("chua_dong_bo");
                    item.setChiTietLoi("Sản phẩm đã bị xóa hoặc ngừng bán trên Shopify");
                    item.setNgayDongBoCuoi(Instant.now());
                    trangThaiDongBoSanPhamRepository.save(item);
                }
            }
        } catch (Exception e) {
            log.error("Lỗi khi tải sản phẩm từ Shopify [{}]: {}", maKenh, e.getMessage());
            throw new CommonException(ThongDiep.of("kenhBan.khongTheTaiSanPhamTu", "Shopify", e.getMessage()), HttpStatus.BAD_GATEWAY, null);
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham, "Tải sản phẩm từ " + maKenh + ": " + soSku + " SKU (" + soMoi + " mới, " + soCapNhat + " cập nhật)");
        return TaiSanPhamResultDto.builder()
                .soSku(soSku)
                .soMoi(soMoi)
                .soCapNhat(soCapNhat)
                .build();
    }

    /**
     * Tải toàn bộ danh mục sản phẩm từ TikTok Shop sử dụng cơ chế phân trang page_token (cursor-based).
     * Tự động giới hạn tối đa 500 sản phẩm / lượt để tránh quá tải bộ nhớ và cháy hạn mức gọi API.
     */
    private List<TikTokProductDto> taiDanhSachSanPhamTikTokTheoToken(String appKey, String appSecret, String token, String cipher) {
        List<TikTokProductDto> ketQua = new ArrayList<>();
        String pageToken = null;
        int maxProducts = 500;
        int pageSize = 50;

        for (int i = 0; i < 10; i++) {
            TikTokProductSearchResponse res = getTikTokShopClient().searchProducts(appKey, appSecret, token, cipher, pageSize, pageToken);
            if (res.getProducts() != null && !res.getProducts().isEmpty()) {
                ketQua.addAll(res.getProducts());
            }
            pageToken = res.getNextPageToken();
            if (pageToken == null || pageToken.isBlank() || ketQua.size() >= maxProducts) {
                break;
            }
        }
        return ketQua;
    }

    /**
     * Tra cứu và cache ánh xạ SKU -> Product ID và Sku ID từ danh mục TikTok Shop (TTL 30 phút).
     * Giúp ngăn chặn việc spam gọi API tìm kiếm sản phẩm lặp đi lặp lại ở mỗi đợt đẩy tồn (tránh lỗi ngốn quota như Shopee).
     */
    private TikTokCatalogCache layHoacCapNhatTikTokCatalog(String appKey, String appSecret, String token, String cipher, boolean forceRefresh) {
        TikTokCatalogCache cached = tikTokCatalogCacheRef.get();
        Instant now = Instant.now();
        if (!forceRefresh && cached != null && cached.expiresAt() != null && cached.expiresAt().isAfter(now)) {
            return cached;
        }
        // Bảo vệ quota: Ngăn chặn bão API quét phân trang nếu cache vừa được nạp cách đây chưa quá 2 phút
        if (forceRefresh && cached != null && cached.createdAt() != null
                && java.time.Duration.between(cached.createdAt(), now).toMinutes() < 2) {
            log.info("[TIKTOK-CATALOG] Bỏ qua forceRefresh vì cache danh mục vừa được cập nhật cách đây < 2 phút (bảo vệ quota API)");
            return cached;
        }
        synchronized (this) {
            cached = tikTokCatalogCacheRef.get();
            if (!forceRefresh && cached != null && cached.expiresAt() != null && cached.expiresAt().isAfter(now)) {
                return cached;
            }
            if (forceRefresh && cached != null && cached.createdAt() != null
                    && java.time.Duration.between(cached.createdAt(), now).toMinutes() < 2) {
                return cached;
            }
            try {
                List<TikTokProductDto> prods = taiDanhSachSanPhamTikTokTheoToken(appKey, appSecret, token, cipher);
                return capNhatTikTokCatalogTuDanhSach(prods);
            } catch (Exception ex) {
                log.warn("[TIKTOK-SYNC] Không làm mới được cache danh mục TikTok Shop: {}", ex.getMessage());
                if (cached != null) return cached;
                return new TikTokCatalogCache(Map.of(), Map.of(), Map.of(), Map.of(), now.plus(java.time.Duration.ofMinutes(5)), now);
            }
        }
    }

    /**
     * Nạp lại bộ nhớ đệm danh mục TikTok Shop từ danh sách sản phẩm, loại bỏ 100% các sản phẩm đã xóa (DELETED).
     */
    private TikTokCatalogCache capNhatTikTokCatalogTuDanhSach(List<TikTokProductDto> prods) {
        Map<String, String> skuToProduct = new java.util.concurrent.ConcurrentHashMap<>();
        Map<String, String> skuToSku = new java.util.concurrent.ConcurrentHashMap<>();
        Map<String, String> productTitles = new java.util.concurrent.ConcurrentHashMap<>();
        Map<String, String> productStatuses = new java.util.concurrent.ConcurrentHashMap<>();
        Instant now = Instant.now();

        if (prods != null) {
            for (TikTokProductDto prod : prods) {
                // LOẠI BỎ 100% SẢN PHẨM ĐÃ BỊ XÓA TRÊN SÀN TIKTOK SHOP (STATUS = "DELETED")
                if (prod.getStatus() != null && "DELETED".equalsIgnoreCase(prod.getStatus().trim())) {
                    log.info("[TIKTOK-CATALOG] Bỏ qua sản phẩm đã xóa khỏi sàn TikTok Shop: id={}, title={}", prod.getId(), prod.getTitle());
                    continue;
                }
                if (prod.getId() != null && !prod.getId().isBlank()) {
                    String pId = prod.getId().trim();
                    if (prod.getTitle() != null && !prod.getTitle().isBlank()) {
                        productTitles.put(pId, prod.getTitle().trim());
                    }
                    if (prod.getStatus() != null && !prod.getStatus().isBlank()) {
                        productStatuses.put(pId, prod.getStatus().trim());
                    }
                }
                if (prod.getSkus() == null) continue;
                for (TikTokSkuDto sku : prod.getSkus()) {
                    if (sku.getSellerSku() != null && !sku.getSellerSku().isBlank()) {
                        String sSku = sku.getSellerSku().trim();
                        skuToProduct.put(sSku.toLowerCase(), prod.getId());
                        skuToSku.put(sSku.toLowerCase(), sku.getId());
                        skuToProduct.put(sSku, prod.getId());
                        skuToSku.put(sSku, sku.getId());
                    }
                    if (sku.getId() != null && !sku.getId().isBlank()) {
                        String sId = sku.getId().trim();
                        skuToProduct.put(sId.toLowerCase(), prod.getId());
                        skuToSku.put(sId.toLowerCase(), sku.getId());
                        skuToProduct.put(sId, prod.getId());
                        skuToSku.put(sId, sku.getId());
                    }
                }
            }
        }
        TikTokCatalogCache newCache = new TikTokCatalogCache(
                skuToProduct, skuToSku, productTitles, productStatuses, now.plus(java.time.Duration.ofMinutes(30)), now);
        tikTokCatalogCacheRef.set(newCache);
        return newCache;
    }

    private TaiSanPhamResultDto taiSanPhamTikTok(KenhBanHang kenh) {
        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();

        if (appKey == null || appSecret == null || token == null || cipher == null || cipher.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhXacThucShopCipher", kenh.getMaKenh()), HttpStatus.BAD_REQUEST, null);
        }

        int soSku = 0;
        int soMoi = 0;
        int soCapNhat = 0;

        try {
            List<TikTokProductDto> products = taiDanhSachSanPhamTikTokTheoToken(appKey, appSecret, token, cipher);
            if (products.isEmpty()) {
                return TaiSanPhamResultDto.builder().soSku(0).soMoi(0).soCapNhat(0).build();
            }

            List<TrangThaiDongBoSanPham> existingList = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
            Map<Integer, TrangThaiDongBoSanPham> mappingByBtId = new HashMap<>();
            Map<String, TrangThaiDongBoSanPham> mappingByMaKenh = new HashMap<>();
            for (TrangThaiDongBoSanPham item : existingList) {
                if (item.getBienTheSanPham() != null && item.getBienTheSanPham().getId() != null) {
                    mappingByBtId.put(item.getBienTheSanPham().getId(), item);
                }
                if (item.getMaSanPhamKenh() != null && !item.getMaSanPhamKenh().isBlank()) {
                    mappingByMaKenh.put(item.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), item);
                }
            }

            for (TikTokProductDto prod : products) {
                // Bỏ qua các sản phẩm đã bị xóa trên TikTok Shop
                if (prod.getStatus() != null && "DELETED".equalsIgnoreCase(prod.getStatus().trim())) {
                    continue;
                }
                if (prod.getSkus() == null) continue;
                for (TikTokSkuDto sku : prod.getSkus()) {
                    String sellerSku = sku.getSellerSku();
                    String skuId = sku.getId();
                    if (sellerSku == null || sellerSku.isBlank()) {
                        sellerSku = skuId;
                    }
                    if (sellerSku == null || sellerSku.isBlank()) continue;

                    String normSellerSku = sellerSku.trim().toLowerCase(Locale.ROOT);
                    String normSkuId = (skuId != null && !skuId.isBlank()) ? skuId.trim().toLowerCase(Locale.ROOT) : null;

                    BienTheSanPham bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sellerSku.trim()).orElse(null);

                    TrangThaiDongBoSanPham tt = null;
                    // Ưu tiên 1: Đã có liên kết cho chính biến thể FCentric này -> Tái sử dụng để chống lỗi Duplicate uk_bien_the_kenh
                    if (bt != null && mappingByBtId.containsKey(bt.getId())) {
                        tt = mappingByBtId.get(bt.getId());
                    }
                    // Ưu tiên 2: Khớp theo mã định danh số SKU của sàn TikTok Shop (skuId)
                    if (tt == null && normSkuId != null && mappingByMaKenh.containsKey(normSkuId)) {
                        tt = mappingByMaKenh.get(normSkuId);
                    }
                    // Ưu tiên 3: Khớp theo sellerSku người bán đặt
                    if (tt == null && mappingByMaKenh.containsKey(normSellerSku)) {
                        tt = mappingByMaKenh.get(normSellerSku);
                    }

                    if (tt != null) {
                        soCapNhat++;
                    } else {
                        tt = new TrangThaiDongBoSanPham();
                        tt.setKenhBanHang(kenh);
                        soMoi++;
                    }
                    soSku++;

                    if (normSkuId != null && normSkuId.matches("\\d+")) {
                        tt.setMaSanPhamKenh(skuId.trim());
                    } else if (tt.getMaSanPhamKenh() == null || tt.getMaSanPhamKenh().isBlank()) {
                        tt.setMaSanPhamKenh(sellerSku.trim());
                    }

                    if (bt != null) {
                        tt.setBienTheSanPham(bt);
                        tt.setTrangThaiDongBo("thanh_cong");
                        tt.setChiTietLoi(null);
                        mappingByBtId.put(bt.getId(), tt);
                    } else if (tt.getBienTheSanPham() == null) {
                        tt.setTrangThaiDongBo("chua_dong_bo");
                    }

                    if (tt.getMaSanPhamKenh() != null) {
                        mappingByMaKenh.put(tt.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), tt);
                    }
                    tt.setNgayDongBoCuoi(Instant.now());
                    trangThaiDongBoSanPhamRepository.save(tt);
                }
            }

            // Tự động nhận diện các sản phẩm đã bị xóa hoặc ngừng bán trên sàn TikTok Shop (chuẩn WHM/Sapo)
            Set<String> aliveSkuIds = new HashSet<>();
            for (TikTokProductDto prod : products) {
                if (prod.getStatus() != null && "DELETED".equalsIgnoreCase(prod.getStatus().trim())) continue;
                if (prod.getSkus() != null) {
                    for (TikTokSkuDto s : prod.getSkus()) {
                        if (s.getId() != null) aliveSkuIds.add(s.getId().trim().toLowerCase(Locale.ROOT));
                        if (s.getSellerSku() != null) aliveSkuIds.add(s.getSellerSku().trim().toLowerCase(Locale.ROOT));
                    }
                }
            }
            for (TrangThaiDongBoSanPham item : existingList) {
                String mspk = item.getMaSanPhamKenh();
                if (mspk != null && !mspk.isBlank() && !aliveSkuIds.contains(mspk.trim().toLowerCase(Locale.ROOT))) {
                    item.setMaSanPhamKenh(null);
                    item.setTrangThaiDongBo("chua_dong_bo");
                    item.setChiTietLoi("Sản phẩm đã bị xóa hoặc ngừng bán trên TikTok Shop");
                    item.setNgayDongBoCuoi(Instant.now());
                    trangThaiDongBoSanPhamRepository.save(item);
                }
            }

            ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban,
                    String.format("Tải sản phẩm từ TikTok Shop: %s SKU (%s mới, %s cập nhật)", soSku, soMoi, soCapNhat));

            try {
                capNhatTikTokCatalogTuDanhSach(products);
            } catch (Exception cacheEx) {
                log.warn("[TIKTOK-SYNC] Không thể làm mới cache sau khi tải sản phẩm: {}", cacheEx.getMessage());
            }

            return TaiSanPhamResultDto.builder()
                    .soSku(soSku)
                    .soMoi(soMoi)
                    .soCapNhat(soCapNhat)
                    .build();
        } catch (Exception e) {
            log.error("Lỗi khi tải sản phẩm từ TikTok Shop: {}", e.getMessage());
            throw new CommonException(ThongDiep.of("kenhBan.khongTheTaiSanPhamTu", "TikTok Shop", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }
    }

    private TaiSanPhamResultDto taiSanPhamLazada(KenhBanHang kenh) {
        String maKenh = kenh != null ? kenh.getMaKenh() : "LAZADA";
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCoAppKeySecretToken", kenh.getMaKenh()), HttpStatus.BAD_REQUEST, null);
        }

        int soSku = 0;
        int soMoi = 0;
        int soCapNhat = 0;

        List<TrangThaiDongBoSanPham> existingList = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        Map<Integer, TrangThaiDongBoSanPham> mappingByBtId = new HashMap<>();
        Map<String, TrangThaiDongBoSanPham> mappingByMaKenh = new HashMap<>();
        for (TrangThaiDongBoSanPham item : existingList) {
            if (item.getBienTheSanPham() != null && item.getBienTheSanPham().getId() != null) {
                mappingByBtId.put(item.getBienTheSanPham().getId(), item);
            }
            if (item.getMaSanPhamKenh() != null && !item.getMaSanPhamKenh().isBlank()) {
                mappingByMaKenh.put(item.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), item);
            }
        }

        // Mã SKU còn sống trên Lazada, dùng để nhận diện SKU đã bị xóa ở cuối hàm.
        // Chỉ tin danh sách này khi đã tải hết mọi trang mà không lỗi (taiDuHet = true):
        // nếu sàn báo lỗi giữa chừng mà vẫn dọn thì mọi liên kết sẽ bị coi là đã xóa.
        Set<String> aliveSkuIds = new HashSet<>();
        boolean taiDuHet = false;

        try {
            int offset = 0;
            int limit = 50;
            boolean hasMore = true;

            while (hasMore && offset < 500) {
                JsonNode res = lazadaClient.getProducts(appKey, appSecret, token, "all", limit, offset);
                String code = res.path("code").asText("");
                if (!"0".equals(code)) {
                    log.warn("[LAZADA-PRODUCTS] Lazada báo lỗi lấy sản phẩm: {} - {}", code, res.path("message").asText());
                    break;
                }

                JsonNode dataNode = res.path("data");
                JsonNode products = dataNode.path("products");
                if (!products.isArray() || products.isEmpty()) {
                    // Trang rỗng = đã hết sản phẩm, không phải lỗi.
                    hasMore = false;
                    break;
                }

                for (JsonNode prodNode : products) {
                    String productName = prodNode.path("attributes").path("name").asText("Sản phẩm Lazada");
                    JsonNode skus = prodNode.path("skus");
                    if (skus.isArray()) {
                        for (JsonNode skuNode : skus) {
                            String sellerSku = skuNode.path("SellerSku").asText("").trim();
                            if (sellerSku.isBlank()) {
                                sellerSku = skuNode.path("ShopSku").asText("").trim();
                            }
                            if (sellerSku.isBlank()) continue;

                            String shopSku = skuNode.path("ShopSku").asText("").trim();
                            String skuId = skuNode.path("SkuId").asText("").trim();
                            if (skuId.isBlank()) skuId = skuNode.path("sku_id").asText("").trim();

                            String normSellerSku = sellerSku.toLowerCase(Locale.ROOT);
                            String normShopSku = !shopSku.isBlank() ? shopSku.toLowerCase(Locale.ROOT) : null;
                            String normSkuId = !skuId.isBlank() ? skuId.toLowerCase(Locale.ROOT) : null;

                            aliveSkuIds.add(normSellerSku);
                            if (normShopSku != null) aliveSkuIds.add(normShopSku);
                            if (normSkuId != null) aliveSkuIds.add(normSkuId);

                            BigDecimal price = null;
                            try {
                                if (skuNode.hasNonNull("price")) {
                                    price = new BigDecimal(skuNode.path("price").asText("0"));
                                }
                            } catch (Exception ignored) {}

                            BienTheSanPham bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sellerSku).orElse(null);

                            TrangThaiDongBoSanPham tt = null;
                            if (bt != null && mappingByBtId.containsKey(bt.getId())) {
                                tt = mappingByBtId.get(bt.getId());
                            }
                            if (tt == null && normSkuId != null && mappingByMaKenh.containsKey(normSkuId)) {
                                tt = mappingByMaKenh.get(normSkuId);
                            }
                            if (tt == null && mappingByMaKenh.containsKey(normSellerSku)) {
                                tt = mappingByMaKenh.get(normSellerSku);
                            }
                            if (tt == null && normShopSku != null && mappingByMaKenh.containsKey(normShopSku)) {
                                tt = mappingByMaKenh.get(normShopSku);
                            }

                            String effectiveSkuId = (normSkuId != null && normSkuId.matches("\\d+")) ? skuId.trim() : null;

                            if (tt != null) {
                                soCapNhat++;
                                if (effectiveSkuId != null && (tt.getMaSanPhamKenh() == null || !tt.getMaSanPhamKenh().matches("\\d+"))) {
                                    tt.setMaSanPhamKenh(effectiveSkuId);
                                }
                            } else {
                                tt = new TrangThaiDongBoSanPham();
                                tt.setKenhBanHang(kenh);
                                tt.setMaSanPhamKenh(effectiveSkuId != null ? effectiveSkuId : sellerSku);
                                soMoi++;
                            }
                            soSku++;

                            if (bt != null) {
                                tt.setBienTheSanPham(bt);
                                tt.setTrangThaiDongBo("thanh_cong");
                                tt.setChiTietLoi(null);
                                mappingByBtId.put(bt.getId(), tt);
                            } else if (tt.getBienTheSanPham() == null) {
                                tt.setTrangThaiDongBo("chua_dong_bo");
                            }
                            if (tt.getMaSanPhamKenh() != null) {
                                mappingByMaKenh.put(tt.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), tt);
                            }
                            mappingByMaKenh.put(normSellerSku, tt);
                            tt.setGiaBanSan(price);
                            tt.setNgayDongBoCuoi(Instant.now());
                            trangThaiDongBoSanPhamRepository.save(tt);
                        }
                    }
                }

                int totalInLazada = dataNode.path("total_products").asInt(0);
                offset += limit;
                if (offset >= totalInLazada) {
                    hasMore = false;
                }
            }
            // Thoát vòng vì hết trang (không phải vì sàn báo lỗi hay chạm trần 500 sản phẩm).
            taiDuHet = !hasMore;
        } catch (Exception e) {
            log.error("[LAZADA-PRODUCTS] Lỗi khi tải sản phẩm từ Lazada: {}", e.getMessage(), e);
        }

        if (soSku == 0) {
            List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findActiveVariantsWithDetails();
            if (activeVariants == null || activeVariants.isEmpty()) {
                activeVariants = bienTheSanPhamRepository.findByTrangThai(1);
            }
            if (activeVariants != null) {
                for (BienTheSanPham bt : activeVariants) {
                    if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
                    TrangThaiDongBoSanPham tt = mappingByBtId.get(bt.getId());
                    if (tt == null) {
                        String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                        tt = mappingByMaKenh.get(norm);
                    }
                    if (tt == null) {
                        tt = new TrangThaiDongBoSanPham();
                        tt.setKenhBanHang(kenh);
                        tt.setBienTheSanPham(bt);
                        tt.setMaSanPhamKenh(bt.getMaSku().trim());
                        tt.setTrangThaiDongBo("thanh_cong");
                        tt.setNgayDongBoCuoi(Instant.now());
                        trangThaiDongBoSanPhamRepository.save(tt);
                        mappingByBtId.put(bt.getId(), tt);
                        mappingByMaKenh.put(bt.getMaSku().trim().toLowerCase(Locale.ROOT), tt);
                        soMoi++;
                        soSku++;
                    }
                }
            }
        }

        // Tự động nhận diện các sản phẩm đã bị xóa hoặc ngừng bán trên sàn Lazada (chuẩn WHM/Sapo).
        // Bỏ qua khi chưa tải đủ danh sách, tránh gỡ nhầm liên kết lúc sàn lỗi.
        if (taiDuHet) {
            for (TrangThaiDongBoSanPham item : existingList) {
                String mspk = item.getMaSanPhamKenh();
                if (mspk != null && !mspk.isBlank() && !aliveSkuIds.contains(mspk.trim().toLowerCase(Locale.ROOT))) {
                    item.setMaSanPhamKenh(null);
                    item.setTrangThaiDongBo("chua_dong_bo");
                    item.setChiTietLoi("Sản phẩm đã bị xóa hoặc ngừng bán trên Lazada");
                    item.setNgayDongBoCuoi(Instant.now());
                    trangThaiDongBoSanPhamRepository.save(item);
                }
            }
        } else {
            log.warn("[LAZADA-PRODUCTS] Chưa tải đủ danh sách sản phẩm từ kênh {}, bỏ qua bước dọn SKU đã xóa", kenh.getId());
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham, "Tải sản phẩm từ Lazada: " + soSku + " SKU (" + soMoi + " mới, " + soCapNhat + " cập nhật)");
        return TaiSanPhamResultDto.builder()
                .soSku(soSku)
                .soMoi(soMoi)
                .soCapNhat(soCapNhat)
                .build();
    }

    public static int xacDinhLazadaCategoryId(SanPhamQuanAo sp) {
        if (sp == null) return 7930;
        String tenSp = sp.getTenSanPham() != null ? sp.getTenSanPham().toLowerCase(Locale.ROOT) : "";
        String tenDm = (sp.getDanhMuc() != null && sp.getDanhMuc().getTenDanhMuc() != null)
                ? sp.getDanhMuc().getTenDanhMuc().toLowerCase(Locale.ROOT) : "";
        String combined = (tenDm + " " + tenSp).trim();

        // 0. Đồ bảo hộ lao động / Đồng phục bảo hộ (Lazada bắt buộc Category 8017 theo Policy R_6049911)
        if (combined.contains("bảo hộ") || combined.contains("lao động") || combined.contains("workwear")
                || combined.contains("bao ho") || combined.contains("lao dong")) {
            return 8017; // Quần áo nam > Đồ bảo hộ lao động
        }

        // 1. Quần Jeans / Bò / Denim
        if (combined.contains("jean") || combined.contains("bò") || combined.contains("denim")) {
            return 6414; // Quần áo nam > Quần > Quần jeans
        }
        // 2. Quần short / Quần đùi / Quần ngắn (chú ý: không dùng 'ngắn' đơn độc tránh nhầm với 'ngắn tay' của áo)
        if (combined.contains("short") || combined.contains("quần short") || combined.contains("quần đùi")
                || combined.contains("quần ngắn") || (combined.contains("quần") && combined.contains("ngắn"))) {
            return 10100765; // Quần áo nam > Quần > Quần ngắn
        }
        // 3. Quần dài / Quần tây / Kaki / Jogger / Trouser
        if (combined.contains("quần") || combined.contains("quan") || combined.contains("pant") || combined.contains("trouser")
                || combined.contains("kaki") || combined.contains("jogger")) {
            return 7991; // Quần áo nam > Quần > Quần
        }
        // 4. Áo khoác / Jacket / Blouson / Bomber / Blazer / Cardigan / Vest
        if (combined.contains("khoác") || combined.contains("jacket") || combined.contains("blouson")
                || combined.contains("bomber") || combined.contains("blazer") || combined.contains("cardigan") || combined.contains("vest")) {
            return 7953; // Quần áo nam > Áo > Áo khoác nhẹ & Áo vest
        }
        // 5. Áo hoodie / Áo nỉ / Sweater
        if (combined.contains("hoodie") || combined.contains("sweater") || combined.contains("áo nỉ")) {
            return 6424; // Quần áo nam > Áo > Áo hoodies & sweater nam
        }
        // 6. Áo Polo / Có cổ
        if (combined.contains("polo") || combined.contains("có cổ")) {
            return 14275; // Quần áo nam > Áo > Áo thun có cổ nam
        }
        // 7. Áo sơ mi / Shirt
        if (combined.contains("sơ mi") || combined.contains("so mi") || combined.contains("shirt")) {
            return 7940; // Quần áo nam > Áo > Áo sơ mi
        }
        // 8. Áo thun / Áo phông / T-shirt / Mặc định Tops
        return 7930; // Quần áo nam > Áo > Áo thun & Áo phông
    }

    public static String mapLazadaColorFamily(String vietnameseColor) {
        if (vietnameseColor == null || vietnameseColor.isBlank()) return "Black";
        String lower = vietnameseColor.trim().toLowerCase(Locale.ROOT);
        if (lower.contains("đen") || lower.contains("black")) return "Black";
        if (lower.contains("trắng") || lower.contains("white")) return "White";
        if (lower.contains("xám") || lower.contains("ghi") || lower.contains("grey") || lower.contains("gray")) return "Grey";
        if (lower.contains("navy") || lower.contains("than") || lower.contains("xanh đen")) return "Dark Blue";
        if (lower.contains("dương") || lower.contains("biển") || lower.contains("blue") || lower.contains("xanh nước")) return "Blue";
        if (lower.contains("lá") || lower.contains("rêu") || lower.contains("green") || lower.contains("cốm")) return "Green";
        if (lower.contains("đỏ") || lower.contains("red") || lower.contains("huyết")) return "Red";
        if (lower.contains("vàng") || lower.contains("yellow")) return "Yellow";
        if (lower.contains("cam") || lower.contains("orange")) return "Orange";
        if (lower.contains("hồng") || lower.contains("pink")) return "Pink";
        if (lower.contains("tím") || lower.contains("purple")) return "Purple";
        if (lower.contains("nâu") || lower.contains("brown") || lower.contains("bò")) return "Brown";
        if (lower.contains("be") || lower.contains("kem") || lower.contains("beige")) return "Beige";
        return "Multicolor";
    }

    private static byte[] convertToLazadaCompliantJpeg(byte[] rawBytes, String productName) {
        if (rawBytes == null || rawBytes.length == 0) {
            return taoLazadaDefaultImage(productName);
        }
        try {
            java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(rawBytes);
            java.awt.image.BufferedImage original = javax.imageio.ImageIO.read(bais);
            if (original != null) {
                int maxDim = 1200;
                int w = original.getWidth();
                int h = original.getHeight();
                if (w > maxDim || h > maxDim) {
                    if (w >= h) {
                        h = (int) Math.round(((double) h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = (int) Math.round(((double) w * maxDim) / h);
                        h = maxDim;
                    }
                }
                w = Math.max(w, 330);
                h = Math.max(h, 330);

                java.awt.image.BufferedImage rgbImg = new java.awt.image.BufferedImage(w, h, java.awt.image.BufferedImage.TYPE_INT_RGB);
                java.awt.Graphics2D g = rgbImg.createGraphics();
                g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setRenderingHint(java.awt.RenderingHints.KEY_RENDERING, java.awt.RenderingHints.VALUE_RENDER_QUALITY);
                g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
                g.setColor(java.awt.Color.WHITE);
                g.fillRect(0, 0, w, h);
                g.drawImage(original, 0, 0, w, h, null);
                g.dispose();

                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                java.util.Iterator<javax.imageio.ImageWriter> writers = javax.imageio.ImageIO.getImageWritersByFormatName("jpg");
                if (writers.hasNext()) {
                    javax.imageio.ImageWriter writer = writers.next();
                    javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
                    param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
                    param.setCompressionQuality(0.85f);
                    try (javax.imageio.stream.ImageOutputStream ios = javax.imageio.ImageIO.createImageOutputStream(baos)) {
                        writer.setOutput(ios);
                        writer.write(null, new javax.imageio.IIOImage(rgbImg, null, null), param);
                    } finally {
                        writer.dispose();
                    }
                } else {
                    javax.imageio.ImageIO.write(rgbImg, "jpg", baos);
                }
                return baos.toByteArray();
            }
        } catch (Throwable ex) {
            log.warn("[LAZADA-IMAGE-CONVERT] Không thể chuyển đổi ảnh sang JPEG cho [{}]: {}", productName, ex.getMessage());
        }
        return taoLazadaDefaultImage(productName);
    }

    private static byte[] taoLazadaDefaultImage(String tenSp) {
        try {
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(600, 600, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = img.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g.setColor(new java.awt.Color(245, 245, 247));
            g.fillRect(0, 0, 600, 600);

            g.setColor(new java.awt.Color(37, 99, 235));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 36));
            g.drawString("FCENTRIC", 200, 260);

            g.setColor(new java.awt.Color(75, 85, 99));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
            String title = (tenSp != null && !tenSp.isBlank()) ? tenSp : "Fashion Collection";
            if (title.length() > 30) title = title.substring(0, 27) + "...";
            g.drawString(title, 150, 320);

            g.dispose();
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            return new byte[0];
        }
    }

    private record LazadaImagePreparationResult(
            List<String> productImages,
            Map<Integer, String> variantImages
    ) {}

    private LazadaImagePreparationResult chuanBiVaUploadAnhLazada(
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String appKey,
            String appSecret,
            String token,
            Map<String, String> cdnCache) {
        String productName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";
        List<String> uploadedImageUrls = new ArrayList<>();

        try {
            List<AnhQuanAo> prodImages = anhQuanAoRepository.findActiveByQuanAoIds(List.of(sp.getId()));
            if (prodImages != null && !prodImages.isEmpty()) {
                List<AnhQuanAo> sortedImages = new ArrayList<>(prodImages);
                sortedImages.sort((a, b) -> {
                    int aMain = Integer.valueOf(1).equals(a.getAnhChinh()) ? 1 : 0;
                    int bMain = Integer.valueOf(1).equals(b.getAnhChinh()) ? 1 : 0;
                    return Integer.compare(bMain, aMain);
                });

                int imgLimit = Math.min(sortedImages.size(), 8);
                for (int i = 0; i < imgLimit; i++) {
                    AnhQuanAo curImg = sortedImages.get(i);
                    if (curImg.getTepTin() != null && curImg.getTepTin().getTenLuuTru() != null) {
                        TepTin tep = curImg.getTepTin();
                        String fileKey = tep.getTenLuuTru();
                        try {
                            if (cdnCache.containsKey(fileKey)) {
                                uploadedImageUrls.add(cdnCache.get(fileKey));
                            } else if (tep.getMoTa() != null && tep.getMoTa().startsWith("LZD_CDN:")) {
                                String cachedUrl = tep.getMoTa().substring("LZD_CDN:".length()).trim();
                                if (!cachedUrl.isBlank()) {
                                    cdnCache.put(fileKey, cachedUrl);
                                    uploadedImageUrls.add(cachedUrl);
                                }
                            } else {
                                byte[] bytes = minioService.download(fileKey);
                                byte[] cleanJpeg = convertToLazadaCompliantJpeg(bytes, productName);
                                if (cleanJpeg != null && cleanJpeg.length > 0) {
                                    JsonNode imgRes = lazadaClient.uploadImage(appKey, appSecret, token, cleanJpeg, "sp_" + sp.getId() + "_" + i + ".jpg");
                                    if ("0".equals(imgRes.path("code").asText(""))) {
                                        String cdnUrl = imgRes.path("data").path("image").path("url").asText("");
                                        if (!cdnUrl.isBlank()) {
                                            cdnCache.put(fileKey, cdnUrl);
                                            uploadedImageUrls.add(cdnUrl);
                                            if (tepTinRepository != null) {
                                                try {
                                                    tep.setMoTa("LZD_CDN:" + cdnUrl);
                                                    tepTinRepository.save(tep);
                                                } catch (Exception saveEx) {
                                                    log.warn("[LAZADA-CDN-CACHE] Không thể lưu cache CDN cho tệp {}: {}", tep.getId(), saveEx.getMessage());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (Exception downEx) {
                            log.warn("[LAZADA-UPLOAD-IMAGE] Lỗi tải/upload ảnh thứ {} của sản phẩm {}: {}", i, productName, downEx.getMessage());
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[LAZADA-UPLOAD-IMAGE] Không thể tải/upload ảnh cho sản phẩm {}: {}", productName, ex.getMessage());
        }

        Map<Integer, String> variantImageUrlMap = new HashMap<>();
        List<Integer> btIds = variants.stream()
                .map(BienTheSanPham::getId)
                .filter(Objects::nonNull)
                .toList();
        if (!btIds.isEmpty()) {
            try {
                List<AnhBienThe> anhBienTheList = anhBienTheRepository.findActiveByBienTheIds(btIds);
                for (AnhBienThe ab : anhBienTheList) {
                    if (ab.getBienThe() != null && ab.getTepTin() != null && ab.getTepTin().getTenLuuTru() != null) {
                        TepTin vTep = ab.getTepTin();
                        String vFileKey = vTep.getTenLuuTru();
                        Integer btId = ab.getBienThe().getId();
                        if (cdnCache.containsKey(vFileKey)) {
                            variantImageUrlMap.put(btId, cdnCache.get(vFileKey));
                        } else if (vTep.getMoTa() != null && vTep.getMoTa().startsWith("LZD_CDN:")) {
                            String cachedUrl = vTep.getMoTa().substring("LZD_CDN:".length()).trim();
                            if (!cachedUrl.isBlank()) {
                                cdnCache.put(vFileKey, cachedUrl);
                                variantImageUrlMap.put(btId, cachedUrl);
                            }
                        } else {
                            try {
                                byte[] vBytes = minioService.download(vFileKey);
                                byte[] vJpeg = convertToLazadaCompliantJpeg(vBytes, productName);
                                if (vJpeg != null && vJpeg.length > 0) {
                                    JsonNode vImgRes = lazadaClient.uploadImage(appKey, appSecret, token, vJpeg, "var_" + btId + ".jpg");
                                    if ("0".equals(vImgRes.path("code").asText(""))) {
                                        String vCdnUrl = vImgRes.path("data").path("image").path("url").asText("");
                                        if (!vCdnUrl.isBlank()) {
                                            cdnCache.put(vFileKey, vCdnUrl);
                                            variantImageUrlMap.put(btId, vCdnUrl);
                                            if (tepTinRepository != null) {
                                                try {
                                                    vTep.setMoTa("LZD_CDN:" + vCdnUrl);
                                                    tepTinRepository.save(vTep);
                                                } catch (Exception saveEx) {
                                                    log.warn("[LAZADA-CDN-CACHE] Không thể lưu cache CDN biến thể cho tệp {}: {}", vTep.getId(), saveEx.getMessage());
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (Exception vEx) {
                                log.warn("[LAZADA-UPLOAD-IMAGE] Lỗi upload ảnh biến thể {} của sản phẩm {}: {}", btId, productName, vEx.getMessage());
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                log.warn("[LAZADA-UPLOAD-IMAGE] Lỗi đọc danh sách ảnh biến thể cho sản phẩm {}: {}", productName, ex.getMessage());
            }
        }

        if (uploadedImageUrls.isEmpty()) {
            try {
                byte[] defaultImg = taoLazadaDefaultImage(productName);
                if (defaultImg.length > 0) {
                    JsonNode imgRes = lazadaClient.uploadImage(appKey, appSecret, token, defaultImg, "fcentric_product.jpg");
                    if ("0".equals(imgRes.path("code").asText(""))) {
                        String cdnUrl = imgRes.path("data").path("image").path("url").asText("");
                        if (!cdnUrl.isBlank()) {
                            uploadedImageUrls.add(cdnUrl);
                        }
                    }
                }
            } catch (Exception imgEx) {
                log.warn("[LAZADA-UPLOAD-IMAGE] Không thể tạo và upload ảnh mặc định cho {}: {}", productName, imgEx.getMessage());
            }
        }

        return new LazadaImagePreparationResult(uploadedImageUrls, variantImageUrlMap);
    }

    private Map<String, String> taoSanPhamLenLazada(
            KenhBanHang kenh,
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String appKey,
            String appSecret,
            String token,
            Map<String, String> cdnCache) {
        Map<String, String> createdSkuMap = new HashMap<>();
        if (sp == null || variants == null || variants.isEmpty()) {
            return createdSkuMap;
        }

        int categoryId = xacDinhLazadaCategoryId(sp);
        String productName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";
        String brandName = (sp.getThuongHieu() != null && sp.getThuongHieu().getTenThuongHieu() != null
                && !sp.getThuongHieu().getTenThuongHieu().isBlank())
                ? sp.getThuongHieu().getTenThuongHieu().trim() : "No Brand";
        String desc = (sp.getMoTa() != null && !sp.getMoTa().isBlank())
                ? sp.getMoTa().trim() : productName;

        LazadaImagePreparationResult imgResult = chuanBiVaUploadAnhLazada(sp, variants, appKey, appSecret, token, cdnCache);

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        xml.append("<Request><Product>");
        xml.append("<PrimaryCategory>").append(categoryId).append("</PrimaryCategory>");

        if (!imgResult.productImages().isEmpty()) {
            xml.append("<Images>");
            for (String url : imgResult.productImages()) {
                xml.append("<Image>").append(escapeXml(url)).append("</Image>");
            }
            xml.append("</Images>");
        }

        xml.append("<Attributes>");
        xml.append("<name>").append(escapeXml(productName)).append("</name>");
        xml.append("<brand>").append(escapeXml(brandName)).append("</brand>");
        xml.append("<description><![CDATA[<p>").append(desc).append("</p>]]></description>");
        xml.append("<short_description><![CDATA[<ul><li>").append(desc).append("</li></ul>]]></short_description>");
        xml.append("<warranty_type>No Warranty</warranty_type>");
        xml.append("<fa_pattern>Trơn</fa_pattern>");

        // Ánh xạ thuộc tính bắt buộc của từng danh mục lá theo chuẩn Lazada Open Platform API
        String tenSp = sp.getTenSanPham() != null ? sp.getTenSanPham() : "";
        String tenSpLower = tenSp.toLowerCase(Locale.ROOT);
        boolean laPoly = tenSpLower.contains("poly")
                || tenSpLower.contains("gió")
                || tenSpLower.contains("dù")
                || variants.stream().anyMatch(v -> v.getChatLieu() != null && v.getChatLieu().getTenChatLieu() != null
                        && v.getChatLieu().getTenChatLieu().toLowerCase(Locale.ROOT).contains("poly"));

        if (categoryId == 8017) {
            // Đồ bảo hộ lao động (8017): Lazada MTEE Risk Policy R_6049911 bắt buộc clothing_material, Fit_Type, Neckline
            String material = laPoly ? "Polyester" : "100% Cotton";
            xml.append("<clothing_material>").append(material).append("</clothing_material>");
            xml.append("<Fit_Type>Slim Fit</Fit_Type>");
            String neckline = (tenSpLower.contains("polo") || tenSpLower.contains("có cổ")) ? "Polo" : "Round Neck";
            xml.append("<Neckline>").append(neckline).append("</Neckline>");
        } else if (categoryId == 7953) {
            // Áo khoác nhẹ & Áo vest nam (7953): Bắt buộc jacket_coat_styles
            String materialKhoac = laPoly ? "Polyester" : "100% Cotton";
            xml.append("<clothing_material>").append(materialKhoac).append("</clothing_material>");
            String style = "Windbreaker";
            if (tenSpLower.contains("bomber")) style = "Bomber Jacket";
            else if (tenSpLower.contains("blazer")) style = "Blazer";
            else if (tenSpLower.contains("vest")) style = "Vest";
            else if (tenSpLower.contains("parka")) style = "Parka";
            else if (tenSpLower.contains("puffer") || tenSpLower.contains("phao")) style = "Puffer Coat";
            xml.append("<jacket_coat_styles>").append(style).append("</jacket_coat_styles>");
        } else if (categoryId == 6424) {
            // Áo hoodies & sweater nam (6424): Bắt buộc hoodie_style_type và Fit_Type
            xml.append("<clothing_material>100% Cotton</clothing_material>");
            String hoodieStyle = (tenSpLower.contains("zip") || tenSpLower.contains("khóa")) ? "Zip Up" : "Pullover";
            xml.append("<hoodie_style_type>").append(hoodieStyle).append("</hoodie_style_type>");
            xml.append("<Fit_Type>Slim Fit</Fit_Type>");
        } else if (categoryId == 14275 || categoryId == 7930) {
            // Áo thun có cổ / Áo polo (14275) hoặc Áo thun cổ tròn (7930): Bắt buộc Fit_Type
            String materialAo = laPoly ? "Polyester" : "100% Cotton";
            xml.append("<clothing_material>").append(materialAo).append("</clothing_material>");
            xml.append("<Fit_Type>Slim Fit</Fit_Type>");
        } else if (categoryId == 7940) {
            // Áo sơ mi nam (7940): Bắt buộc Neckline
            String materialAo = laPoly ? "Polyester" : "100% Cotton";
            xml.append("<clothing_material>").append(materialAo).append("</clothing_material>");
            xml.append("<Neckline>Shirt Collar</Neckline>");
        } else if (categoryId == 6414) {
            // Quần jeans nam (6414): Bắt buộc jeans_fit_type, Denim_Wash, waist_type
            xml.append("<clothing_material>Denim</clothing_material>");
            xml.append("<jeans_fit_type>Straight</jeans_fit_type>");
            xml.append("<Denim_Wash>Light</Denim_Wash>");
            xml.append("<waist_type>Natural Waist</waist_type>");
        } else if (categoryId == 7991) {
            // Quần dài nam (7991): Bắt buộc pants_length, pants_fit_type
            String materialQuan = laPoly ? "Polyester" : "100% Cotton";
            xml.append("<clothing_material>").append(materialQuan).append("</clothing_material>");
            xml.append("<pants_length>Full Length</pants_length>");
            xml.append("<pants_fit_type>Straight</pants_fit_type>");
        } else if (categoryId == 10100765) {
            // Quần ngắn / short nam (10100765): Bắt buộc shorts_style, waist_type
            String materialQuan = laPoly ? "Polyester" : "100% Cotton";
            xml.append("<clothing_material>").append(materialQuan).append("</clothing_material>");
            xml.append("<shorts_style>Straight Cut Shorts</shorts_style>");
            xml.append("<waist_type>Natural Waist</waist_type>");
        } else {
            // Danh mục Tops khác mặc định
            String materialAo = laPoly ? "Polyester" : "100% Cotton";
            xml.append("<clothing_material>").append(materialAo).append("</clothing_material>");
            xml.append("<Fit_Type>Slim Fit</Fit_Type>");
        }
        xml.append("</Attributes>");

        xml.append("<Skus>");
        for (BienTheSanPham bt : variants) {
            String sku = bt.getMaSku() != null ? bt.getMaSku().trim() : "";
            if (sku.isBlank()) continue;

            BigDecimal price = bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0
                    ? bt.getGiaBan() : BigDecimal.valueOf(100000);
            int qty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));

            xml.append("<Sku>");
            xml.append("<SellerSku>").append(escapeXml(sku)).append("</SellerSku>");
            xml.append("<quantity>").append(Math.max(0, qty)).append("</quantity>");
            xml.append("<price>").append(price.setScale(2, RoundingMode.HALF_UP)).append("</price>");
            xml.append("<package_length>25</package_length>");
            xml.append("<package_width>15</package_width>");
            xml.append("<package_height>5</package_height>");
            xml.append("<package_weight>0.3</package_weight>");
            xml.append("<package_content>1 x ").append(escapeXml(productName)).append("</package_content>");

            List<String> skuImages = new ArrayList<>();
            String varImgUrl = imgResult.variantImages().get(bt.getId());
            if (varImgUrl != null && !varImgUrl.isBlank()) {
                skuImages.add(varImgUrl);
                for (String pUrl : imgResult.productImages()) {
                    if (!skuImages.contains(pUrl) && skuImages.size() < 8) {
                        skuImages.add(pUrl);
                    }
                }
            } else if (!imgResult.productImages().isEmpty()) {
                skuImages.addAll(imgResult.productImages());
            }

            if (!skuImages.isEmpty()) {
                xml.append("<Images>");
                for (String url : skuImages) {
                    xml.append("<Image>").append(escapeXml(url)).append("</Image>");
                }
                xml.append("</Images>");
            }

            String mappedColor = mapLazadaColorFamily(bt.getMauSac() != null ? bt.getMauSac().getTenMau() : null);
            String sizeVal = (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank())
                    ? bt.getSize().getTenSize().trim() : "Free Size";

            xml.append("<saleProp>");
            xml.append("<color_family>").append(escapeXml(mappedColor)).append("</color_family>");
            xml.append("<size>").append(escapeXml(sizeVal)).append("</size>");
            xml.append("</saleProp>");

            xml.append("</Sku>");
        }
        xml.append("</Skus>");
        xml.append("</Product></Request>");

        try {
            log.info("[LAZADA-CREATE] Đang gửi yêu cầu tạo sản phẩm [{}] lên Lazada (Category: {})...", productName, categoryId);
            JsonNode createRes = lazadaClient.createProduct(appKey, appSecret, token, xml.toString());
            String code = createRes.path("code").asText("");
            if ("0".equals(code)) {
                log.info("[LAZADA-CREATE] Tạo sản phẩm [{}] lên Lazada thành công: itemId={}",
                        productName, createRes.path("data").path("item_id").asText(""));
                JsonNode skuList = createRes.path("data").path("sku_list");
                if (skuList.isArray() && !skuList.isEmpty()) {
                    for (JsonNode itemNode : skuList) {
                        String sSku = itemNode.path("seller_sku").asText("").trim();
                        if (sSku.isBlank()) sSku = itemNode.path("SellerSku").asText("").trim();
                        if (sSku.isBlank()) sSku = itemNode.path("sellerSku").asText("").trim();

                        String sId = itemNode.path("sku_id").asText("").trim();
                        if (sId.isBlank()) sId = itemNode.path("SkuId").asText("").trim();
                        if (sId.isBlank()) sId = itemNode.path("skuId").asText("").trim();
                        if (sId.isBlank() || !sId.matches("\\d+")) {
                            String shopSku = itemNode.path("shop_sku").asText("").trim();
                            if (shopSku.isBlank()) shopSku = itemNode.path("ShopSku").asText("").trim();
                            if (shopSku.contains("-")) {
                                String tail = shopSku.substring(shopSku.lastIndexOf('-') + 1).trim();
                                if (tail.matches("\\d+")) {
                                    sId = tail;
                                }
                            }
                        }

                        if (!sSku.isBlank() && !sId.isBlank() && sId.matches("\\d+")) {
                            createdSkuMap.put(sSku.toLowerCase(Locale.ROOT), sId);
                        }
                    }
                }
                if (createdSkuMap.isEmpty()) {
                    Map<String, String> recoveredMap = layMapSellerSkuToSkuIdLazada(appKey, appSecret, token);
                    for (BienTheSanPham bt : variants) {
                        if (bt.getMaSku() != null) {
                            String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                            String recSkuId = recoveredMap.get(norm);
                            if (recSkuId != null && recSkuId.matches("\\d+")) {
                                createdSkuMap.put(norm, recSkuId);
                            }
                        }
                    }
                }
                if (createdSkuMap.isEmpty()) {
                    ghiNhanLoiTaoSanPhamLazada(kenh, variants, "Sản phẩm đã tạo trên Lazada nhưng chưa tra cứu được SkuId số. Vui lòng bấm 'Thử lại' sau ít phút.");
                }
            } else {
                String errorMsg = createRes.path("message").asText(createRes.path("sub_message").asText("Lazada từ chối"));
                if (createRes.has("detail") && createRes.path("detail").isArray() && !createRes.path("detail").isEmpty()) {
                    errorMsg += " - " + createRes.path("detail").get(0).path("message").asText("");
                }
                log.warn("[LAZADA-CREATE] Lazada từ chối tạo sản phẩm [{}]: code={} - {}", productName, code, errorMsg);

                boolean alreadyExists = errorMsg.toLowerCase(Locale.ROOT).contains("duplicate")
                        || errorMsg.toLowerCase(Locale.ROOT).contains("exist")
                        || code.toLowerCase(Locale.ROOT).contains("duplicate");
                if (alreadyExists) {
                    Map<String, String> recoveredMap = layMapSellerSkuToSkuIdLazada(appKey, appSecret, token);
                    for (BienTheSanPham bt : variants) {
                        if (bt.getMaSku() != null) {
                            String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                            String recSkuId = recoveredMap.get(norm);
                            if (recSkuId != null && recSkuId.matches("\\d+")) {
                                createdSkuMap.put(norm, recSkuId);
                            }
                        }
                    }
                }
                if (createdSkuMap.isEmpty()) {
                    ghiNhanLoiTaoSanPhamLazada(kenh, variants, "Lazada từ chối tạo: " + dichLoiLazada(code, errorMsg));
                }
            }
        } catch (Exception e) {
            log.error("[LAZADA-CREATE] Lỗi khi tạo sản phẩm [{}] lên Lazada: {}", productName, e.getMessage());
        }

        return createdSkuMap;
    }

    private boolean capNhatSanPhamLenLazada(
            KenhBanHang kenh,
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String itemId,
            Map<String, String> lazadaSkuToSkuIdMap,
            String appKey,
            String appSecret,
            String token,
            Map<String, String> cdnCache) {
        if (sp == null || variants == null || variants.isEmpty() || itemId == null || itemId.isBlank()) {
            return false;
        }

        String productName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";

        LazadaImagePreparationResult imgResult = chuanBiVaUploadAnhLazada(sp, variants, appKey, appSecret, token, cdnCache);

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        xml.append("<Request><Product>");
        xml.append("<ItemId>").append(escapeXml(itemId)).append("</ItemId>");

        if (!imgResult.productImages().isEmpty()) {
            xml.append("<Images>");
            for (String url : imgResult.productImages()) {
                xml.append("<Image>").append(escapeXml(url)).append("</Image>");
            }
            xml.append("</Images>");
        }

        xml.append("<Attributes>");
        xml.append("<name>").append(escapeXml(productName)).append("</name>");
        xml.append("</Attributes>");

        xml.append("<Skus>");
        for (BienTheSanPham bt : variants) {
            String sku = bt.getMaSku() != null ? bt.getMaSku().trim() : "";
            if (sku.isBlank()) continue;

            String skuId = lazadaSkuToSkuIdMap.get(sku.toLowerCase(Locale.ROOT));
            if (skuId == null || !skuId.matches("\\d+")) {
                log.warn("[LAZADA-UPDATE] Biến thể SKU [{}] chưa có SkuId số trên Lazada, bỏ qua cập nhật SKU này để tránh lỗi 501 (SellerSku deprecated)", sku);
                continue;
            }

            xml.append("<Sku>");
            xml.append("<SkuId>").append(escapeXml(skuId)).append("</SkuId>");

            List<String> skuImages = new ArrayList<>();
            String varImgUrl = imgResult.variantImages().get(bt.getId());
            if (varImgUrl != null && !varImgUrl.isBlank()) {
                skuImages.add(varImgUrl);
                for (String pUrl : imgResult.productImages()) {
                    if (!skuImages.contains(pUrl) && skuImages.size() < 8) {
                        skuImages.add(pUrl);
                    }
                }
            } else if (!imgResult.productImages().isEmpty()) {
                skuImages.addAll(imgResult.productImages());
            }

            if (!skuImages.isEmpty()) {
                xml.append("<Images>");
                for (String url : skuImages) {
                    xml.append("<Image>").append(escapeXml(url)).append("</Image>");
                }
                xml.append("</Images>");
            }

            xml.append("</Sku>");
        }
        xml.append("</Skus>");
        xml.append("</Product></Request>");

        try {
            log.info("[LAZADA-UPDATE] Đang cập nhật ảnh và thông tin sản phẩm [{}] (ItemId: {}) lên Lazada...", productName, itemId);
            JsonNode updateRes = lazadaClient.updateProduct(appKey, appSecret, token, xml.toString());
            String code = updateRes.path("code").asText("");
            if ("0".equals(code)) {
                log.info("[LAZADA-UPDATE] Cập nhật sản phẩm [{}] (ItemId: {}) lên Lazada thành công!", productName, itemId);
                return true;
            } else {
                String errorMsg = updateRes.path("message").asText(updateRes.path("sub_message").asText("Lazada từ chối"));
                if (updateRes.has("detail") && updateRes.path("detail").isArray() && !updateRes.path("detail").isEmpty()) {
                    errorMsg += " - " + updateRes.path("detail").get(0).path("message").asText("");
                }
                log.warn("[LAZADA-UPDATE] Lazada từ chối cập nhật sản phẩm [{}] (ItemId: {}): code={} - {}", productName, itemId, code, errorMsg);
                return false;
            }
        } catch (Exception e) {
            log.error("[LAZADA-UPDATE] Lỗi khi cập nhật sản phẩm [{}] lên Lazada: {}", productName, e.getMessage());
            return false;
        }
    }

    private Map<String, String> taoSanPhamLenTikTok(
            KenhBanHang kenh,
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String appKey,
            String appSecret,
            String token,
            String cipher,
            String warehouseId,
            Map<String, String> cdnCache) {
        Map<String, String> createdSkuMap = new HashMap<>();
        if (sp == null || variants == null || variants.isEmpty()) {
            return createdSkuMap;
        }

        String rawName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";
        // TikTok Shop quy định tiêu đề tối thiểu 25 ký tự
        String title = rawName;
        if (title.length() < 25) {
            title = title + " - Thời trang FCentric chính hãng";
        }
        if (title.length() > 255) {
            title = title.substring(0, 255);
        }

        String desc = (sp.getMoTa() != null && !sp.getMoTa().isBlank())
                ? sp.getMoTa().trim() : title;
        String descHtml = "<p>" + desc + "</p>";

        // Upload ảnh sản phẩm lên TikTok Shop CDN để lấy Image URI hợp lệ (TikTok Shop bắt buộc uri nội bộ thật)
        List<TikTokProductCreateRequest.ImageUri> mainImages = chuanBiVaUploadAnhTikTok(
                sp, variants, appKey, appSecret, token, cipher, cdnCache);

        if (mainImages.isEmpty()) {
            log.warn("[TIKTOK-CREATE] Không thể chuẩn bị ảnh hợp lệ cho sản phẩm [{}]. Dừng tạo sản phẩm để tránh lỗi sàn.", title);
            return createdSkuMap;
        }

        List<TikTokProductCreateRequest.CreateSku> skuList = new ArrayList<>();
        boolean isMultiSku = variants.size() > 1;

        // Nạp trước bản đồ ảnh của từng biến thể (tránh N+1 query)
        Map<Integer, TepTin> anhBienTheMap = chuanBiBanDoAnhBienThe(variants);

        // Phân tích các chiều biến thể của sản phẩm để đảm bảo tính đồng nhất giữa tất cả SKU
        boolean hasSizeDimension = isMultiSku && variants.stream()
                .anyMatch(bt -> bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank());
        boolean hasColorDimension = isMultiSku && variants.stream()
                .anyMatch(bt -> bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank());

        Set<String> seenAttributeCombinations = new HashSet<>();

        for (BienTheSanPham bt : variants) {
            String sku = bt.getMaSku() != null ? bt.getMaSku().trim() : "";
            if (sku.isBlank()) continue;

            BigDecimal price = bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0
                    ? bt.getGiaBan() : BigDecimal.valueOf(100000);
            int qty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));

            // Chuẩn bị ảnh biến thể riêng (sku_img) nếu biến thể có ảnh trong FCentric
            TikTokProductCreateRequest.ImageUri skuImg = null;
            TepTin vTep = anhBienTheMap.get(bt.getId());
            if (vTep != null && vTep.getTenLuuTru() != null && !vTep.getTenLuuTru().isBlank()) {
                String uri = layHoacUploadAnhTikTok(vTep, vTep.getTenLuuTru(), sp.getId(), sp.getTenSanPham(),
                        appKey, appSecret, token, cipher, cdnCache);
                if (uri != null && !uri.isBlank()) {
                    skuImg = new TikTokProductCreateRequest.ImageUri(uri);
                }
            }

            List<TikTokProductCreateRequest.SalesAttribute> salesAttrs = null;
            // Theo chuẩn TikTok Shop API v202309: Chỉ khai báo sales_attributes khi sản phẩm có từ 2 SKU trở lên
            if (isMultiSku) {
                salesAttrs = new ArrayList<>();

                String sizeVal = (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank())
                        ? bt.getSize().getTenSize().trim() : (hasSizeDimension ? "Tiêu chuẩn" : null);

                String colorVal = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank())
                        ? bt.getMauSac().getTenMau().trim() : (hasColorDimension ? "Mặc định" : null);

                // Nếu sản phẩm không có cả size lẫn màu, dùng thuộc tính Phân loại
                if (!hasSizeDimension && !hasColorDimension) {
                    String specVal = sku;
                    salesAttrs.add(TikTokProductCreateRequest.SalesAttribute.builder()
                            .name("Phân loại")
                            .valueName(specVal)
                            .customValue(specVal)
                            .skuImg(skuImg)
                            .build());
                } else {
                    // Kiểm tra và chống trùng lặp tổ hợp thuộc tính giữa các SKU (ngăn lỗi 12052251 Resource Already Exists)
                    String comboKey = (sizeVal != null ? sizeVal : "") + "|" + (colorVal != null ? colorVal : "");
                    if (seenAttributeCombinations.contains(comboKey)) {
                        // Nếu trùng lặp tổ hợp với SKU trước đó, bổ sung mã SKU để đảm bảo tính duy nhất
                        if (sizeVal != null) {
                            sizeVal = sizeVal + " (" + sku + ")";
                        } else if (colorVal != null) {
                            colorVal = colorVal + " (" + sku + ")";
                        }
                        comboKey = (sizeVal != null ? sizeVal : "") + "|" + (colorVal != null ? colorVal : "");
                    }
                    seenAttributeCombinations.add(comboKey);

                    // Bắt buộc gửi CẢ valueName VÀ customValue theo chuẩn v202309 để TikTok Shop hiển thị giá trị trong ngoặc
                    if (hasSizeDimension && sizeVal != null) {
                        salesAttrs.add(TikTokProductCreateRequest.SalesAttribute.builder()
                                .name("Kích cỡ")
                                .valueName(sizeVal)
                                .customValue(sizeVal)
                                .build());
                    }
                    if (hasColorDimension && colorVal != null) {
                        salesAttrs.add(TikTokProductCreateRequest.SalesAttribute.builder()
                                .name("Màu sắc")
                                .valueName(colorVal)
                                .customValue(colorVal)
                                .skuImg(skuImg)
                                .build());
                    }
                }
            }

            skuList.add(TikTokProductCreateRequest.CreateSku.builder()
                    .sellerSku(sku)
                    .price(TikTokProductCreateRequest.SkuPrice.builder()
                            .amount(String.valueOf(price.setScale(0, RoundingMode.HALF_UP).intValue()))
                            .currency("VND")
                            .build())
                    .inventory(List.of(TikTokProductCreateRequest.SkuInventoryQuantity.builder()
                            .warehouseId(warehouseId)
                            .quantity(Math.max(0, qty))
                            .build()))
                    .salesAttributes(salesAttrs)
                    .skuImg(skuImg)
                    .build());
        }

        if (skuList.isEmpty()) {
            return createdSkuMap;
        }

        // Xác định Leaf Category ID phiên bản V2 bắt buộc theo quy định TikTok Shop API v202309
        String v2CategoryId = xacDinhTikTokV2CategoryId(appKey, appSecret, token, cipher, title, desc, sp);

        // Chuẩn bị thuộc tính sản phẩm bắt buộc (Quốc gia xuất xứ ID: 100149, v.v.)
        List<TikTokProductCreateRequest.ProductAttribute> productAttributes =
                chuanBiProductAttributesTikTok(appKey, appSecret, token, cipher, v2CategoryId, sp);

        // Chuẩn bị bảng size (size_chart) bắt buộc cho ngành hàng thời trang theo quy định listing TikTok Shop
        TikTokProductCreateRequest.SizeChart sizeChart =
                chuanBiSizeChartTikTok(sp, appKey, appSecret, token, cipher);

        TikTokProductCreateRequest req = TikTokProductCreateRequest.builder()
                .title(title)
                .description(descHtml)
                .categoryId(v2CategoryId)
                .categoryVersion(TikTokShopConstants.CATEGORY_VERSION_V2)
                .brandId("0") // No Brand theo quy định sàn để tránh kiểm duyệt ủy quyền thương hiệu
                .mainImages(mainImages)
                .sizeChart(sizeChart)
                .packageWeight(TikTokProductCreateRequest.PackageWeight.builder()
                        .value("0.3")
                        .unit("KILOGRAM")
                        .build())
                .packageDimensions(TikTokProductCreateRequest.PackageDimensions.builder()
                        .length("25")
                        .width("15")
                        .height("5")
                        .unit("CENTIMETER")
                        .build())
                .productAttributes(productAttributes.isEmpty() ? null : productAttributes)
                .skus(skuList)
                .build();

        try {
            log.info("[TIKTOK-CREATE] Đang đẩy sản phẩm [{}] lên TikTok Shop...", title);
            TikTokProductCreateResponse res = getTikTokShopClient().createProduct(appKey, appSecret, token, cipher, req);
            if (res != null && res.getCode() == 0 && res.getData() != null) {
                String prodId = res.getData().getProductId();
                log.info("[TIKTOK-CREATE] Tạo sản phẩm [{}] thành công trên TikTok Shop! ProductId: {}", title, prodId);
                TikTokCatalogCache curCache = tikTokCatalogCacheRef.get();
                if (curCache == null) {
                    curCache = new TikTokCatalogCache(
                            new java.util.concurrent.ConcurrentHashMap<>(),
                            new java.util.concurrent.ConcurrentHashMap<>(),
                            new java.util.concurrent.ConcurrentHashMap<>(),
                            new java.util.concurrent.ConcurrentHashMap<>(),
                            Instant.now().plus(java.time.Duration.ofMinutes(30)),
                            Instant.now()
                    );
                    tikTokCatalogCacheRef.set(curCache);
                }
                if (prodId != null && !prodId.isBlank()) {
                    curCache.productTitles().put(prodId, title);
                    curCache.productStatuses().put(prodId, "ACTIVATE");
                    String mainImagesSig = mainImages.stream()
                            .map(TikTokProductCreateRequest.ImageUri::getUri)
                            .filter(Objects::nonNull)
                            .collect(Collectors.joining(","));
                    String variantImagesSig = variants.stream()
                            .map(bt -> {
                                TepTin t = anhBienTheMap.get(bt.getId());
                                return bt.getMaSku() + ":" + (t != null && t.getTenLuuTru() != null ? t.getTenLuuTru() : "none");
                            })
                            .collect(Collectors.joining(","));
                    CACHED_TIKTOK_PRODUCT_SIGNATURES.put(prodId, title.trim() + "||" + v2CategoryId + "||" + mainImagesSig + "||" + variantImagesSig);
                }
                if (res.getData().getSkus() != null) {
                    for (TikTokProductCreateResponse.CreatedSku cSku : res.getData().getSkus()) {
                        if (cSku.getSellerSku() != null && cSku.getId() != null) {
                            String sSku = cSku.getSellerSku().trim();
                            String sId = cSku.getId().trim();
                            createdSkuMap.put(sSku.toLowerCase(Locale.ROOT), sId);
                            if (prodId != null && !prodId.isBlank()) {
                                curCache.skuToProductId().put(sSku.toLowerCase(Locale.ROOT), prodId);
                                curCache.skuToProductId().put(sSku, prodId);
                                curCache.skuToProductId().put(sId.toLowerCase(Locale.ROOT), prodId);
                                curCache.skuToProductId().put(sId, prodId);
                            }
                            curCache.skuToSkuId().put(sSku.toLowerCase(Locale.ROOT), sId);
                            curCache.skuToSkuId().put(sSku, sId);
                            curCache.skuToSkuId().put(sId.toLowerCase(Locale.ROOT), sId);
                            curCache.skuToSkuId().put(sId, sId);
                        }
                    }
                }
            } else {
                String errMsg = res != null ? res.getMessage() : "Phản hồi rỗng";
                int errCode = res != null ? res.getCode() : -1;
                log.warn("[TIKTOK-CREATE] TikTok Shop từ chối tạo sản phẩm [{}]: code={} - {}", title, errCode, errMsg);
                KetQuaGuiTon kqLoi = phanLoaiLoiTikTok(errCode, errMsg, null);
                ghiNhanLoiTaoSanPhamTikTok(kenh, variants, kqLoi.lyDo());
            }
        } catch (Exception e) {
            log.error("[TIKTOK-CREATE] Lỗi khi tạo sản phẩm [{}] lên TikTok Shop: {}", title, e.getMessage());
            KetQuaGuiTon kqLoi = phanLoaiLoiTikTok(-1, e.getMessage(), null);
            ghiNhanLoiTaoSanPhamTikTok(kenh, variants, kqLoi.lyDo());
        }

        return createdSkuMap;
    }

    private void ghiNhanLoiTaoSanPhamTikTok(KenhBanHang kenh, List<BienTheSanPham> variants, String lyDoLoi) {
        if (kenh == null || variants == null || variants.isEmpty()) return;
        Instant now = Instant.now();
        List<TrangThaiDongBoSanPham> listCanLuu = new ArrayList<>();
        for (BienTheSanPham bt : variants) {
            if (bt.getId() == null) continue;
            var opt = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());
            TrangThaiDongBoSanPham tt = opt.orElseGet(() -> {
                TrangThaiDongBoSanPham moi = new TrangThaiDongBoSanPham();
                moi.setKenhBanHang(kenh);
                moi.setBienTheSanPham(bt);
                return moi;
            });
            tt.setTrangThaiDongBo("that_bai");
            tt.setChiTietLoi(lyDoLoi);
            tt.setNgayDongBoCuoi(now);
            listCanLuu.add(tt);
        }
        if (!listCanLuu.isEmpty()) {
            trangThaiDongBoSanPhamRepository.saveAll(listCanLuu);
        }
    }

    /**
     * Cập nhật / Đồng bộ thông tin sản phẩm FCentric đã tồn tại trên TikTok Shop (API v202309).
     * Cho phép đồng bộ tiêu đề mới, mô tả, danh mục lá V2, thuộc tính pháp lý và biến thể để tránh bị bot quét nhãn hiệu.
     * Endpoint: PUT /product/202309/products/{product_id}?category_version=v2
     */
    private boolean capNhatSanPhamLenTikTok(
            KenhBanHang kenh,
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String appKey,
            String appSecret,
            String token,
            String cipher,
            String warehouseId,
            Map<String, String> cdnCache,
            TikTokCatalogCache catalog,
            Map<Integer, TrangThaiDongBoSanPham> existingByBtId) {
        if (sp == null || variants == null || variants.isEmpty()) {
            return false;
        }

        // Tìm Product ID trên sàn TikTok Shop
        String prodId = null;
        for (BienTheSanPham bt : variants) {
            if (bt.getMaSku() != null && !bt.getMaSku().isBlank()) {
                String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                prodId = catalog.skuToProductId().get(norm);
                if (prodId != null && !prodId.isBlank()) break;
            }
            if (existingByBtId != null && existingByBtId.containsKey(bt.getId())) {
                TrangThaiDongBoSanPham rec = existingByBtId.get(bt.getId());
                if (rec.getMaSanPhamKenh() != null && !rec.getMaSanPhamKenh().isBlank()) {
                    prodId = catalog.skuToProductId().get(rec.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT));
                    if (prodId != null && !prodId.isBlank()) break;
                }
            }
        }

        if (prodId == null || prodId.isBlank()) {
            log.warn("[TIKTOK-UPDATE] Không tìm thấy TikTok Product ID cho sản phẩm [{}]. Bỏ qua cập nhật.", sp.getTenSanPham());
            return false;
        }

        String rawName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";
        String title = rawName;
        if (title.length() < 25) {
            title = title + " - Thời trang FCentric chính hãng";
        }
        if (title.length() > 255) {
            title = title.substring(0, 255);
        }

        // 1. Kiểm tra trạng thái sản phẩm trên sàn TikTok Shop để phòng tránh lỗi 12052901 Precondition Required
        String currentStatus = catalog.productStatuses() != null ? catalog.productStatuses().get(prodId) : null;
        if (currentStatus != null) {
            String upper = currentStatus.toUpperCase(Locale.ROOT);
            if (upper.contains("FREEZE") || upper.contains("SUSPENDED") || upper.contains("UNDER_REVIEW")
                    || upper.contains("AUDITING") || upper.contains("FAILED") || upper.contains("DELETED")) {
                log.warn("[TIKTOK-UPDATE] Sản phẩm [{}] (ID: {}) đang ở trạng thái [{}] trên TikTok Shop (không thể cập nhật qua API). Bỏ qua để tránh lỗi 12052901.",
                        title, prodId, currentStatus);
                String lyDo = ThongDiep.vi("hienThiKenhPos.tiktokTrangThaiKhongHopLe");
                ghiNhanLoiTaoSanPhamTikTok(kenh, variants, lyDo);
                return false;
            }
        }

        String desc = (sp.getMoTa() != null && !sp.getMoTa().isBlank())
                ? sp.getMoTa().trim() : title;
        String descHtml = "<p>" + desc + "</p>";

        List<TikTokProductCreateRequest.ImageUri> mainImages = chuanBiVaUploadAnhTikTok(
                sp, variants, appKey, appSecret, token, cipher, cdnCache);
        if (mainImages.isEmpty()) {
            log.warn("[TIKTOK-UPDATE] Không thể chuẩn bị ảnh hợp lệ cho sản phẩm [{}]. Dừng cập nhật.", title);
            return false;
        }

        // Nạp trước bản đồ ảnh của từng biến thể (tránh N+1 query)
        Map<Integer, TepTin> anhBienTheMap = chuanBiBanDoAnhBienThe(variants);

        // 2. Smart Content Signature Check: Phát hiện thay đổi cả Tiêu đề, Ảnh chính và Ảnh biến thể (sku_img)
        String mainImagesSig = mainImages.stream()
                .map(TikTokProductCreateRequest.ImageUri::getUri)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(","));

        String variantImagesSig = variants.stream()
                .map(bt -> {
                    TepTin t = anhBienTheMap.get(bt.getId());
                    return bt.getMaSku() + ":" + (t != null && t.getTenLuuTru() != null ? t.getTenLuuTru() : "none");
                })
                .collect(Collectors.joining(","));

        String v2CategoryId = xacDinhTikTokV2CategoryId(appKey, appSecret, token, cipher, title, desc, sp);
        String productSignature = title.trim() + "||" + v2CategoryId + "||" + mainImagesSig + "||" + variantImagesSig;
        String lastSignature = CACHED_TIKTOK_PRODUCT_SIGNATURES.get(prodId);
        if (lastSignature != null && lastSignature.equals(productSignature)) {
            log.info("[TIKTOK-UPDATE] Sản phẩm [{}] (ID: {}) không có thay đổi về tiêu đề, danh mục và hình ảnh. Bỏ qua gọi API PUT để tránh kích hoạt kiểm duyệt sàn và bảo vệ Quota.",
                    title, prodId);
            return false;
        }

        List<TikTokProductCreateRequest.CreateSku> skuList = new ArrayList<>();
        boolean isMultiSku = variants.size() > 1;

        boolean hasSizeDimension = isMultiSku && variants.stream()
                .anyMatch(bt -> bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank());
        boolean hasColorDimension = isMultiSku && variants.stream()
                .anyMatch(bt -> bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank());

        Set<String> seenAttributeCombinations = new HashSet<>();

        for (BienTheSanPham bt : variants) {
            String sku = bt.getMaSku() != null ? bt.getMaSku().trim() : "";
            if (sku.isBlank()) continue;

            String norm = sku.toLowerCase(Locale.ROOT);
            String tiktokSkuId = catalog.skuToSkuId().get(norm);
            if (tiktokSkuId == null && existingByBtId != null && existingByBtId.containsKey(bt.getId())) {
                TrangThaiDongBoSanPham rec = existingByBtId.get(bt.getId());
                if (rec.getMaSanPhamKenh() != null && rec.getMaSanPhamKenh().matches("\\d+")) {
                    tiktokSkuId = rec.getMaSanPhamKenh().trim();
                }
            }

            BigDecimal price = bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0
                    ? bt.getGiaBan() : BigDecimal.valueOf(100000);
            int qty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));

            // Chuẩn bị ảnh biến thể riêng (sku_img) nếu biến thể có ảnh trong FCentric
            TikTokProductCreateRequest.ImageUri skuImg = null;
            TepTin vTep = anhBienTheMap.get(bt.getId());
            if (vTep != null && vTep.getTenLuuTru() != null && !vTep.getTenLuuTru().isBlank()) {
                String uri = layHoacUploadAnhTikTok(vTep, vTep.getTenLuuTru(), sp.getId(), sp.getTenSanPham(),
                        appKey, appSecret, token, cipher, cdnCache);
                if (uri != null && !uri.isBlank()) {
                    skuImg = new TikTokProductCreateRequest.ImageUri(uri);
                }
            }

            List<TikTokProductCreateRequest.SalesAttribute> salesAttrs = null;
            if (isMultiSku) {
                salesAttrs = new ArrayList<>();
                String sizeVal = (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank())
                        ? bt.getSize().getTenSize().trim() : (hasSizeDimension ? "Tiêu chuẩn" : null);

                String colorVal = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank())
                        ? bt.getMauSac().getTenMau().trim() : (hasColorDimension ? "Mặc định" : null);

                if (!hasSizeDimension && !hasColorDimension) {
                    String specVal = sku;
                    salesAttrs.add(TikTokProductCreateRequest.SalesAttribute.builder()
                            .name("Phân loại")
                            .valueName(specVal)
                            .customValue(specVal)
                            .skuImg(skuImg)
                            .build());
                } else {
                    String comboKey = (sizeVal != null ? sizeVal : "") + "|" + (colorVal != null ? colorVal : "");
                    if (seenAttributeCombinations.contains(comboKey)) {
                        if (sizeVal != null) {
                            sizeVal = sizeVal + " (" + sku + ")";
                        } else if (colorVal != null) {
                            colorVal = colorVal + " (" + sku + ")";
                        }
                        comboKey = (sizeVal != null ? sizeVal : "") + "|" + (colorVal != null ? colorVal : "");
                    }
                    seenAttributeCombinations.add(comboKey);

                    if (hasSizeDimension && sizeVal != null) {
                        salesAttrs.add(TikTokProductCreateRequest.SalesAttribute.builder()
                                .name("Kích cỡ")
                                .valueName(sizeVal)
                                .customValue(sizeVal)
                                .build());
                    }
                    if (hasColorDimension && colorVal != null) {
                        salesAttrs.add(TikTokProductCreateRequest.SalesAttribute.builder()
                                .name("Màu sắc")
                                .valueName(colorVal)
                                .customValue(colorVal)
                                .skuImg(skuImg)
                                .build());
                    }
                }
            }

            skuList.add(TikTokProductCreateRequest.CreateSku.builder()
                    .id(tiktokSkuId)
                    .sellerSku(sku)
                    .price(TikTokProductCreateRequest.SkuPrice.builder()
                            .amount(String.valueOf(price.setScale(0, RoundingMode.HALF_UP).intValue()))
                            .currency("VND")
                            .build())
                    .inventory(List.of(TikTokProductCreateRequest.SkuInventoryQuantity.builder()
                            .warehouseId(warehouseId)
                            .quantity(Math.max(0, qty))
                            .build()))
                    .salesAttributes(salesAttrs)
                    .skuImg(skuImg)
                    .build());
        }

        if (skuList.isEmpty()) {
            return false;
        }

        List<TikTokProductCreateRequest.ProductAttribute> productAttributes =
                chuanBiProductAttributesTikTok(appKey, appSecret, token, cipher, v2CategoryId, sp);
        TikTokProductCreateRequest.SizeChart sizeChart =
                chuanBiSizeChartTikTok(sp, appKey, appSecret, token, cipher);

        TikTokProductCreateRequest req = TikTokProductCreateRequest.builder()
                .title(title)
                .description(descHtml)
                .categoryId(v2CategoryId)
                .categoryVersion(TikTokShopConstants.CATEGORY_VERSION_V2)
                .brandId("0")
                .mainImages(mainImages)
                .sizeChart(sizeChart)
                .packageWeight(TikTokProductCreateRequest.PackageWeight.builder()
                        .value("0.3")
                        .unit("KILOGRAM")
                        .build())
                .packageDimensions(TikTokProductCreateRequest.PackageDimensions.builder()
                        .length("25")
                        .width("15")
                        .height("5")
                        .unit("CENTIMETER")
                        .build())
                .productAttributes(productAttributes.isEmpty() ? null : productAttributes)
                .skus(skuList)
                .build();

        try {
            log.info("[TIKTOK-UPDATE] Đang cập nhật sản phẩm [{}] (ID: {}) lên TikTok Shop...", title, prodId);
            TikTokProductCreateResponse res = getTikTokShopClient().editProduct(appKey, appSecret, token, cipher, prodId, req);
            if (res != null && res.getCode() == 0) {
                log.info("[TIKTOK-UPDATE] Cập nhật thành công sản phẩm [{}] (ProductId: {}) trên TikTok Shop!", title, prodId);
                CACHED_TIKTOK_PRODUCT_SIGNATURES.put(prodId, productSignature);
                TikTokCatalogCache curCache = tikTokCatalogCacheRef.get();
                if (curCache != null) {
                    curCache.productTitles().put(prodId, title);
                    curCache.productStatuses().put(prodId, "ACTIVATE");
                    if (res.getData() != null && res.getData().getSkus() != null) {
                        for (TikTokProductCreateResponse.CreatedSku cSku : res.getData().getSkus()) {
                            if (cSku.getSellerSku() != null && cSku.getId() != null) {
                                String sSku = cSku.getSellerSku().trim();
                                String sId = cSku.getId().trim();
                                curCache.skuToProductId().put(sSku.toLowerCase(Locale.ROOT), prodId);
                                curCache.skuToProductId().put(sSku, prodId);
                                curCache.skuToProductId().put(sId.toLowerCase(Locale.ROOT), prodId);
                                curCache.skuToProductId().put(sId, prodId);
                                curCache.skuToSkuId().put(sSku.toLowerCase(Locale.ROOT), sId);
                                curCache.skuToSkuId().put(sSku, sId);
                                curCache.skuToSkuId().put(sId.toLowerCase(Locale.ROOT), sId);
                                curCache.skuToSkuId().put(sId, sId);
                            }
                        }
                    }
                }
                return true;
            } else {
                String errMsg = res != null ? res.getMessage() : "Phản hồi rỗng";
                int errCode = res != null ? res.getCode() : -1;
                log.warn("[TIKTOK-UPDATE] TikTok Shop từ chối cập nhật sản phẩm [{}]: code={} - {}", title, errCode, errMsg);
                KetQuaGuiTon kqLoi = phanLoaiLoiTikTok(errCode, errMsg, null);
                ghiNhanLoiTaoSanPhamTikTok(kenh, variants, kqLoi.lyDo());
                return false;
            }
        } catch (Exception e) {
            log.error("[TIKTOK-UPDATE] Lỗi khi cập nhật sản phẩm [{}] lên TikTok Shop: {}", title, e.getMessage());
            KetQuaGuiTon kqLoi = phanLoaiLoiTikTok(-1, e.getMessage(), null);
            ghiNhanLoiTaoSanPhamTikTok(kenh, variants, kqLoi.lyDo());
            return false;
        }
    }

    /**
     * Tự động xác định Leaf Category ID phiên bản V2 cho sản phẩm đăng lên TikTok Shop (v202309).
     * Quy trình chuẩn hóa:
     * 1. Gọi TikTok Shop AI Category Recommendation (POST /product/202309/categories/recommend?category_version=v2).
     * 2. Nếu AI chưa trả về, ánh xạ trực tiếp sang bảng danh mục lá V2 chuẩn ngành thời trang nam của TikTok Shop.
     * 3. Tuyệt đối không dùng mã giả lập cũ "601234" và không ép Quần sang danh mục Áo.
     */
    public String xacDinhTikTokV2CategoryId(String appKey, String appSecret, String token, String cipher,
                                             String title, String desc, SanPhamQuanAo sp) {
        // 1. Thử gợi ý danh mục V2 bằng AI của TikTok Shop
        try {
            String aiCategoryId = getTikTokShopClient().recommendCategoryV2(appKey, appSecret, token, cipher, title, desc);
            if (aiCategoryId != null && !aiCategoryId.isBlank()
                    && com.dev.backend.services.tiktok.TikTokShopClient.isPhuHopThoiTrangNamVaUnisex(aiCategoryId, null)) {
                log.info("[TIKTOK-CAT-V2] AI gợi ý thành công Leaf Category ID [{}] cho sản phẩm [{}]", aiCategoryId, title);
                return aiCategoryId;
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-CAT-V2] Lỗi khi gọi TikTok AI recommend category cho [{}]: {}", title, ex.getMessage());
        }

        // 2. Tra cứu từ điển danh mục lá V2 chuẩn thời trang nam TikTok Shop theo tên danh mục FCentric và tiêu đề
        String tenSp = (title != null ? title : (sp != null && sp.getTenSanPham() != null ? sp.getTenSanPham() : "")).toLowerCase(Locale.ROOT);
        String tenDm = (sp != null && sp.getDanhMuc() != null && sp.getDanhMuc().getTenDanhMuc() != null)
                ? sp.getDanhMuc().getTenDanhMuc().toLowerCase(Locale.ROOT) : "";
        String combined = (tenDm + " " + tenSp).trim();

        // 2.1 Quần Jeans / Bò / Denim
        if (combined.contains("jean") || combined.contains("bò") || combined.contains("denim")) {
            return "603713"; // Men's Clothing > Bottoms > Jeans
        }
        // 2.2 Quần short / Quần đùi / Ngắn
        if (combined.contains("short") || combined.contains("đùi") || combined.contains("ngắn")) {
            return "603715"; // Men's Clothing > Bottoms > Shorts
        }
        // 2.3 Quần dài / Quần tây / Kaki / Jogger / Casual Pants
        if (combined.contains("quần") || combined.contains("pant") || combined.contains("trouser")
                || combined.contains("kaki") || combined.contains("jogger")) {
            return "603716"; // Men's Clothing > Bottoms > Casual Pants
        }
        // 2.4 Áo khoác / Jacket / Blouson / Bomber / Blazer / Cardigan / Vest
        if (combined.contains("khoác") || combined.contains("jacket") || combined.contains("blouson")
                || combined.contains("bomber") || combined.contains("blazer") || combined.contains("cardigan") || combined.contains("vest")) {
            return "603706"; // Men's Clothing > Outerwear & Jackets > Jackets & Coats
        }
        // 2.5 Áo hoodie / Áo nỉ / Sweater
        if (combined.contains("hoodie") || combined.contains("sweater") || combined.contains("nỉ")) {
            return "603726"; // Men's Clothing > Hoodies & Sweatshirts
        }
        // 2.6 Áo Polo / Có cổ
        if (combined.contains("polo") || combined.contains("có cổ")) {
            return "960776"; // Men's Clothing > Tops > Polo Shirts
        }
        // 2.7 Áo sơ mi / Shirt
        if (combined.contains("sơ mi") || combined.contains("so mi") || combined.contains("shirt")) {
            return "1203984"; // Men's Clothing > Tops > Shirts
        }
        // 2.8 Quần áo thể thao / Sportswear (TUYỆT ĐỐI KHÔNG DÙNG 603729 - Áo ngực thể thao!)
        if (combined.contains("thể thao") || combined.contains("sportware") || combined.contains("sportswear")) {
            if (combined.contains("quần") || combined.contains("pant") || combined.contains("short") || combined.contains("đùi")) {
                return "603715"; // Men's Clothing > Bottoms > Shorts
            }
            if (combined.contains("khoác") || combined.contains("jacket") || combined.contains("gió")) {
                return "603706"; // Men's Clothing > Outerwear & Jackets > Jackets & Coats
            }
            if (combined.contains("polo")) {
                return "960776"; // Men's Clothing > Tops > Polo Shirts
            }
            return "603720"; // Men's Clothing > Tops > T-Shirts (Áo thun / Áo phông thể thao nam)
        }
        // 2.9 Áo thun / Áo phông / T-shirt
        if (combined.contains("thun") || combined.contains("t-shirt") || combined.contains("tee") || combined.contains("phông")) {
            return "603720"; // Men's Clothing > Tops > T-Shirts
        }

        // 3. Fallback phân nhánh an toàn theo loại trang phục
        boolean laQuan = combined.contains("quần") || combined.contains("pant") || combined.contains("short");
        String fallbackId = laQuan ? "603713" : "960776";
        log.info("[TIKTOK-CAT-V2] Áp dụng fallback danh mục V2 cho [{}]: id={}", title, fallbackId);
        return fallbackId;
    }

    /**
     * Chuẩn bị danh sách thuộc tính sản phẩm (product_attributes) cho TikTok Shop (v202309).
     * Bắt buộc cung cấp các thuộc tính bắt buộc từ danh mục V2 theo quy định pháp luật Việt Nam (Nghị định 85):
     * - Quốc gia xuất xứ (ID: 100149 = "Việt Nam", ID giá trị: 1000854)
     * - Tên tổ chức chịu trách nhiệm hàng hóa (ID: 101489)
     * - Địa chỉ tổ chức chịu trách nhiệm hàng hóa (nếu danh mục yêu cầu)
     */
    private List<TikTokProductCreateRequest.ProductAttribute> chuanBiProductAttributesTikTok(
            String appKey, String appSecret, String token, String cipher,
            String categoryId, SanPhamQuanAo sp) {
        List<TikTokProductCreateRequest.ProductAttribute> attributes = new ArrayList<>();
        boolean hasCountryOfOrigin = false;
        boolean hasResponsibleEntity = false;

        if (categoryId != null && !categoryId.isBlank()) {
            try {
                JsonNode attrRes = getTikTokShopClient().getCategoryAttributes(appKey, appSecret, token, cipher, categoryId, "vi-VN");
                if (attrRes != null && attrRes.path("code").asInt(-1) == 0) {
                    JsonNode attrList = attrRes.path("data").path("attributes");
                    if (attrList.isArray()) {
                        for (JsonNode attr : attrList) {
                            String attrId = attr.path("id").asText(attr.path("attribute_id").asText(null));
                            if (attrId == null || attrId.isBlank()) continue;

                            String attrType = attr.path("type").asText("PRODUCT_PROPERTY");
                            // Bỏ qua các thuộc tính biến thể SALES_PROPERTY (được cấu hình ở sales_attributes của SKU)
                            if ("SALES_PROPERTY".equalsIgnoreCase(attrType)) {
                                continue;
                            }

                            String attrName = attr.path("name").asText(attr.path("local_display_name").asText(""));
                            String attrNameLower = attrName.toLowerCase(Locale.ROOT);

                            // Nhận diện trạng thái bắt buộc từ mọi biến thể định dạng của TikTok Shop API
                            boolean isMandatory = attr.path("is_mandatory").asBoolean(false)
                                    || attr.path("is_required").asBoolean(false)
                                    || attr.path("is_requried").asBoolean(false)
                                    || attr.path("required").asBoolean(false)
                                    || "MANDATORY".equalsIgnoreCase(attr.path("requirement").asText(""))
                                    || "REQUIRED".equalsIgnoreCase(attr.path("requirement").asText(""))
                                    || "MANDATORY".equalsIgnoreCase(attr.path("requirement_level").asText(""))
                                    || "REQUIRED".equalsIgnoreCase(attr.path("requirement_level").asText(""))
                                    || (attr.hasNonNull("requirement_conditions") && !attr.path("requirement_conditions").isEmpty());

                            boolean isOrigin = "100149".equals(attrId)
                                    || attrNameLower.contains("xuất xứ")
                                    || attrNameLower.contains("origin");

                            boolean isResponsible = "101489".equals(attrId)
                                    || (attrNameLower.contains("chịu trách nhiệm") && !attrNameLower.contains("địa chỉ"));

                            boolean isResponsibleAddr = attrNameLower.contains("chịu trách nhiệm") && attrNameLower.contains("địa chỉ");

                            JsonNode valuesNode = attr.path("values");

                            if (isOrigin) {
                                hasCountryOfOrigin = true;
                                String valId = null;
                                String valName = "Việt Nam";

                                if (valuesNode.isArray() && !valuesNode.isEmpty()) {
                                    for (JsonNode val : valuesNode) {
                                        String vName = val.path("name").asText(val.path("local_display_name").asText(""));
                                        String vLower = vName.toLowerCase(Locale.ROOT);
                                        if (vLower.contains("việt nam") || vLower.contains("vietnam") || vLower.equals("vn")) {
                                            valId = val.path("id").asText(null);
                                            valName = vName;
                                            break;
                                        }
                                    }
                                    if (valId == null && valuesNode.size() > 0) {
                                        JsonNode firstVal = valuesNode.get(0);
                                        valId = firstVal.path("id").asText("1000854");
                                        valName = firstVal.path("name").asText("Việt Nam");
                                    }
                                } else {
                                    valId = "1000854";
                                }

                                attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                                        .id(attrId)
                                        .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                                .id(valId)
                                                .name(valName)
                                                .build()))
                                        .build());
                                log.info("[TIKTOK-ATTR] Đã gắn thuộc tính Quốc gia xuất xứ ID [{}]: id={}, name={}", attrId, valId, valName);

                            } else if (isResponsible) {
                                hasResponsibleEntity = true;
                                String valId = null;
                                String valName = "Công ty Cổ phần Thời trang FCentric";

                                if (valuesNode.isArray() && !valuesNode.isEmpty()) {
                                    JsonNode firstVal = valuesNode.get(0);
                                    valId = firstVal.path("id").asText(null);
                                    valName = firstVal.path("name").asText(valName);
                                }

                                attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                                        .id(attrId)
                                        .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                                .id((valId != null && !valId.isBlank()) ? valId : null)
                                                .name(valName)
                                                .build()))
                                        .build());
                                log.info("[TIKTOK-ATTR] Đã gắn thuộc tính Tên tổ chức chịu trách nhiệm [{}]: id={}, name={}", attrId, valId, valName);

                            } else if (isResponsibleAddr) {
                                String valId = null;
                                String valName = "Số 1 Trịnh Văn Bô, Phường Phương Canh, Quận Nam Từ Liêm, Hà Nội, Việt Nam";

                                if (valuesNode.isArray() && !valuesNode.isEmpty()) {
                                    JsonNode firstVal = valuesNode.get(0);
                                    valId = firstVal.path("id").asText(null);
                                    valName = firstVal.path("name").asText(valName);
                                }

                                attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                                        .id(attrId)
                                        .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                                .id((valId != null && !valId.isBlank()) ? valId : null)
                                                .name(valName)
                                                .build()))
                                        .build());
                                log.info("[TIKTOK-ATTR] Đã gắn thuộc tính Địa chỉ tổ chức chịu trách nhiệm [{}]: id={}, name={}", attrId, valId, valName);

                            } else if (isMandatory) {
                                String valId = null;
                                String valName = null;

                                if (valuesNode.isArray() && !valuesNode.isEmpty()) {
                                    JsonNode firstVal = valuesNode.get(0);
                                    valId = firstVal.path("id").asText(null);
                                    valName = firstVal.path("name").asText(null);
                                } else {
                                    valName = "Tiêu chuẩn FCentric";
                                }

                                if (valName != null || valId != null) {
                                    attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                                            .id(attrId)
                                            .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                                    .id((valId != null && !valId.isBlank()) ? valId : null)
                                                    .name(valName)
                                                    .build()))
                                            .build());
                                    log.info("[TIKTOK-ATTR] Đã gắn thuộc tính bắt buộc [{} - {}]: id={}, name={}", attrId, attrName, valId, valName);
                                }
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                log.warn("[TIKTOK-ATTR] Không thể tải thuộc tính danh mục V2 [{}] từ TikTok Shop: {}", categoryId, ex.getMessage());
            }
        }

        // Bắt buộc luôn bổ sung thuộc tính Quốc gia xuất xứ ID '100149' nếu chưa có trong danh sách
        if (!hasCountryOfOrigin) {
            log.info("[TIKTOK-ATTR] Bổ sung fallback thuộc tính bắt buộc Quốc gia xuất xứ (ID: 100149 = 'Việt Nam')");
            attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                    .id("100149")
                    .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                            .id("1000854")
                            .name("Việt Nam")
                            .build()))
                    .build());
        }

        // Bắt buộc luôn bổ sung thuộc tính Tên tổ chức chịu trách nhiệm hàng hóa ID '101489' nếu chưa có
        if (!hasResponsibleEntity) {
            log.info("[TIKTOK-ATTR] Bổ sung fallback thuộc tính bắt buộc Tên tổ chức chịu trách nhiệm hàng hóa (ID: 101489 = 'Công ty Cổ phần Thời trang FCentric')");
            attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                    .id("101489")
                    .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                            .id(null)
                            .name("Công ty Cổ phần Thời trang FCentric")
                            .build()))
                    .build());
        }

        return attributes;
    }

    private static final Map<String, String> CACHED_TIKTOK_DEFAULT_URI_BY_CIPHER = new ConcurrentHashMap<>();
    private static final Map<String, String> CACHED_TIKTOK_SIZE_CHART_URI_BY_CIPHER = new ConcurrentHashMap<>();
    private static final Map<String, String> CACHED_TIKTOK_PRODUCT_SIGNATURES = new ConcurrentHashMap<>();

    /**
     * Nạp trước bản đồ ánh xạ biến thể sang TepTin ảnh tương ứng (tránh N+1 query).
     */
    private Map<Integer, TepTin> chuanBiBanDoAnhBienThe(List<BienTheSanPham> variants) {
        Map<Integer, TepTin> map = new HashMap<>();
        if (variants == null || variants.isEmpty() || anhBienTheRepository == null) {
            return map;
        }
        List<Integer> btIds = variants.stream()
                .map(BienTheSanPham::getId)
                .filter(Objects::nonNull)
                .toList();
        if (btIds.isEmpty()) {
            return map;
        }
        try {
            List<AnhBienThe> abList = anhBienTheRepository.findActiveByBienTheIds(btIds);
            if (abList != null) {
                for (AnhBienThe ab : abList) {
                    if (ab.getBienThe() != null && ab.getBienThe().getId() != null && ab.getTepTin() != null) {
                        map.putIfAbsent(ab.getBienThe().getId(), ab.getTepTin());
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-IMG] Lỗi nạp ảnh biến thể trước: {}", ex.getMessage());
        }
        return map;
    }

    /**
     * Chuẩn bị và upload ảnh sản phẩm lên TikTok Shop CDN để lấy Image URI nội bộ.
     * Thứ tự ưu tiên thu thập ảnh:
     * 1. Ảnh sản phẩm từ bảng AnhQuanAo (findActiveByQuanAoIds).
     * 2. Nếu chưa có, thu thập ảnh biến thể từ bảng AnhBienThe (findActiveByBienTheIds).
     * 3. Nếu vẫn không có ảnh hoặc không tải được từ MinIO, tự động sinh ảnh JPEG 800x800 tiêu chuẩn
     *    (thương hiệu FCENTRIC + tên sản phẩm) và upload lên TikTok CDN để lấy URI thật.
     * Tuyệt đối không dùng URI chuỗi giả lập để tránh lỗi TikTok 12052300 (Invalid product image URI).
     */
    private List<TikTokProductCreateRequest.ImageUri> chuanBiVaUploadAnhTikTok(
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String appKey,
            String appSecret,
            String token,
            String cipher,
            Map<String, String> cdnCache) {

        List<TikTokProductCreateRequest.ImageUri> mainImages = new ArrayList<>();
        Set<String> processedFileKeys = new HashSet<>();

        // 1. Thu thập ảnh cấp sản phẩm (AnhQuanAo)
        try {
            List<AnhQuanAo> prodImages = anhQuanAoRepository.findActiveByQuanAoIds(List.of(sp.getId()));
            if (prodImages != null && !prodImages.isEmpty()) {
                for (AnhQuanAo curImg : prodImages) {
                    if (mainImages.size() >= 5) break;
                    if (curImg.getTepTin() != null && curImg.getTepTin().getTenLuuTru() != null) {
                        TepTin tep = curImg.getTepTin();
                        String fileKey = tep.getTenLuuTru();
                        if (processedFileKeys.add(fileKey)) {
                            String uri = layHoacUploadAnhTikTok(tep, fileKey, sp.getId(), sp.getTenSanPham(),
                                    appKey, appSecret, token, cipher, cdnCache);
                            if (uri != null && !uri.isBlank()) {
                                mainImages.add(new TikTokProductCreateRequest.ImageUri(uri));
                            }
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-IMG] Lỗi đọc ảnh sản phẩm {}: {}", sp.getId(), ex.getMessage());
        }

        // 2. Nếu chưa đủ ảnh, thu thập tiếp từ ảnh cấp biến thể (AnhBienThe)
        if (mainImages.isEmpty() && variants != null && !variants.isEmpty()) {
            List<Integer> btIds = variants.stream()
                    .map(BienTheSanPham::getId)
                    .filter(Objects::nonNull)
                    .toList();
            if (!btIds.isEmpty() && anhBienTheRepository != null) {
                try {
                    List<AnhBienThe> anhBienTheList = anhBienTheRepository.findActiveByBienTheIds(btIds);
                    if (anhBienTheList != null && !anhBienTheList.isEmpty()) {
                        for (AnhBienThe ab : anhBienTheList) {
                            if (mainImages.size() >= 5) break;
                            if (ab.getTepTin() != null && ab.getTepTin().getTenLuuTru() != null) {
                                TepTin vTep = ab.getTepTin();
                                String vFileKey = vTep.getTenLuuTru();
                                if (processedFileKeys.add(vFileKey)) {
                                    String uri = layHoacUploadAnhTikTok(vTep, vFileKey, sp.getId(), sp.getTenSanPham(),
                                            appKey, appSecret, token, cipher, cdnCache);
                                    if (uri != null && !uri.isBlank()) {
                                        mainImages.add(new TikTokProductCreateRequest.ImageUri(uri));
                                    }
                                }
                            }
                        }
                    }
                } catch (Exception ex) {
                    log.warn("[TIKTOK-IMG] Lỗi đọc ảnh biến thể cho sản phẩm {}: {}", sp.getId(), ex.getMessage());
                }
            }
        }

        // 3. Fallback: Nếu không có ảnh nào trong DB hoặc MinIO không tải được, sinh ảnh mặc định chuẩn e-commerce
        // và upload thật lên TikTok Shop CDN để lấy URI hợp lệ (tuyệt đối không dùng URI giả lập để tránh lỗi 12052300)
        if (mainImages.isEmpty()) {
            try {
                String fallbackUri = layHoacUploadAnhMacDinhTikTok(sp.getTenSanPham(), appKey, appSecret, token, cipher);
                if (fallbackUri != null && !fallbackUri.isBlank()) {
                    mainImages.add(new TikTokProductCreateRequest.ImageUri(fallbackUri));
                }
            } catch (Exception ex) {
                log.error("[TIKTOK-IMG] Không thể upload ảnh mặc định cho sản phẩm [{}]: {}", sp.getTenSanPham(), ex.getMessage());
            }
        }

        return mainImages;
    }

    private String layHoacUploadAnhTikTok(
            TepTin tep, String fileKey, Integer spId, String spName,
            String appKey, String appSecret, String token, String cipher,
            Map<String, String> cdnCache) {

        if (fileKey == null || fileKey.isBlank()) {
            return null;
        }

        // 1. Kiểm tra cache RAM
        String uri = cdnCache.get(fileKey);
        if (uri != null && !uri.isBlank()) {
            return uri;
        }

        // 2. Kiểm tra cache DB (cột moTa)
        if (tep != null && tep.getMoTa() != null && tep.getMoTa().startsWith("TTS_URI:")) {
            uri = tep.getMoTa().substring("TTS_URI:".length()).trim();
            if (!uri.isBlank()) {
                cdnCache.put(fileKey, uri);
                return uri;
            }
        }

        // 3. Tải từ MinIO và upload lên TikTok Shop CDN
        try {
            byte[] bytes = minioService.download(fileKey);
            if (bytes != null && bytes.length > 0) {
                byte[] cleanJpeg = convertToTikTokCompliantJpeg(bytes, spName);
                if (cleanJpeg != null && cleanJpeg.length > 0) {
                    uri = getTikTokShopClient().uploadImage(appKey, appSecret, token, cipher, cleanJpeg, "sp_" + spId + "_" + System.currentTimeMillis() + ".jpg");
                    if (uri != null && !uri.isBlank()) {
                        cdnCache.put(fileKey, uri);
                        if (tepTinRepository != null && tep != null) {
                            try {
                                tep.setMoTa("TTS_URI:" + uri);
                                tepTinRepository.save(tep);
                            } catch (Exception saveEx) {
                                log.warn("[TIKTOK-CDN-CACHE] Không thể lưu TTS_URI cho tệp {}: {}", tep.getId(), saveEx.getMessage());
                            }
                        }
                        return uri;
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-UPLOAD-IMG] Lỗi tải/upload ảnh tệp {} cho sản phẩm {}: {}", fileKey, spId, ex.getMessage());
        }

        return null;
    }

    private String layHoacUploadAnhMacDinhTikTok(
            String spName, String appKey, String appSecret, String token, String cipher) {

        String key = (cipher != null && !cipher.isBlank()) ? cipher.trim() : "DEFAULT";
        String cached = CACHED_TIKTOK_DEFAULT_URI_BY_CIPHER.get(key);
        if (cached != null && !cached.isBlank()) {
            return cached;
        }

        byte[] defaultBytes = taoTikTokDefaultImage(spName);
        if (defaultBytes == null || defaultBytes.length == 0) {
            return null;
        }

        try {
            log.info("[TIKTOK-IMG] Đang upload ảnh mặc định cho [{}] lên TikTok Shop CDN...", spName);
            String uri = getTikTokShopClient().uploadImage(appKey, appSecret, token, cipher, defaultBytes, "fcentric_default_product.jpg");
            if (uri != null && !uri.isBlank()) {
                log.info("[TIKTOK-IMG] Upload ảnh mặc định lên TikTok CDN thành công! URI: {}", uri);
                CACHED_TIKTOK_DEFAULT_URI_BY_CIPHER.put(key, uri);
                return uri;
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-IMG] Gặp lỗi khi upload ảnh mặc định lên TikTok: {}", ex.getMessage());
        }
        return null;
    }

    private static byte[] taoTikTokDefaultImage(String tenSp) {
        try {
            int size = 800;
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(size, size, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = img.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(java.awt.RenderingHints.KEY_TEXT_ANTIALIASING, java.awt.RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            g.setColor(new java.awt.Color(248, 250, 252));
            g.fillRect(0, 0, size, size);

            g.setColor(new java.awt.Color(226, 232, 240));
            g.drawRect(20, 20, size - 40, size - 40);

            g.setColor(new java.awt.Color(239, 246, 255));
            g.fillRect(21, 21, size - 42, 100);

            g.setColor(new java.awt.Color(37, 99, 235));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 46));
            g.drawString("FCENTRIC", 270, 85);

            g.setColor(new java.awt.Color(219, 234, 254));
            g.fillRoundRect(300, 220, 200, 200, 30, 30);
            g.setColor(new java.awt.Color(59, 130, 246));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 72));
            g.drawString("FC", 350, 345);

            g.setColor(new java.awt.Color(30, 41, 59));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 26));
            String title = (tenSp != null && !tenSp.isBlank()) ? tenSp : "Thời Trang FCentric";
            if (title.length() > 36) title = title.substring(0, 33) + "...";
            java.awt.FontMetrics fm = g.getFontMetrics();
            int titleWidth = fm.stringWidth(title);
            int x = Math.max(30, (size - titleWidth) / 2);
            g.drawString(title, x, 500);

            g.setColor(new java.awt.Color(100, 116, 139));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
            g.drawString("Chính Hãng • Chất Lượng Đảm Bảo", 260, 545);

            g.dispose();
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            log.warn("Không thể sinh ảnh mặc định cho TikTok Shop: {}", e.getMessage());
            return new byte[0];
        }
    }

    /**
     * Chuẩn bị bảng quy đổi kích cỡ (size_chart) cho sản phẩm thời trang theo quy định listing của TikTok Shop.
     * Đối với các danh mục may mặc, thời trang thể thao (như Áo Polo, Áo khoác...), size_chart_image là tham số bắt buộc.
     * Ảnh size chart được sinh tự động chuẩn e-commerce 800x800 và upload lên TikTok CDN với use_case="SIZE_CHART_IMAGE".
     */
    private TikTokProductCreateRequest.SizeChart chuanBiSizeChartTikTok(
            SanPhamQuanAo sp, String appKey, String appSecret, String token, String cipher) {

        String key = (cipher != null && !cipher.isBlank()) ? cipher.trim() : "DEFAULT";
        String cachedUri = CACHED_TIKTOK_SIZE_CHART_URI_BY_CIPHER.get(key);

        if (cachedUri == null || cachedUri.isBlank()) {
            byte[] sizeChartBytes = taoTikTokSizeChartImage(sp != null ? sp.getTenSanPham() : null);
            if (sizeChartBytes != null && sizeChartBytes.length > 0) {
                try {
                    log.info("[TIKTOK-SIZE-CHART] Đang upload bảng quy đổi kích cỡ (use_case=SIZE_CHART_IMAGE) lên TikTok CDN...");
                    String uri = getTikTokShopClient().uploadImageWithUseCase(
                            appKey, appSecret, token, cipher, sizeChartBytes, "fcentric_size_chart.jpg", "SIZE_CHART_IMAGE");
                    if (uri != null && !uri.isBlank()) {
                        log.info("[TIKTOK-SIZE-CHART] Upload size chart image thành công! URI: {}", uri);
                        CACHED_TIKTOK_SIZE_CHART_URI_BY_CIPHER.put(key, uri);
                        cachedUri = uri;
                    }
                } catch (Exception ex) {
                    log.warn("[TIKTOK-SIZE-CHART] Gặp lỗi khi upload size chart image lên TikTok: {}", ex.getMessage());
                }
            }
        }

        if (cachedUri != null && !cachedUri.isBlank()) {
            return TikTokProductCreateRequest.SizeChart.builder()
                    .image(TikTokProductCreateRequest.SizeChartImage.builder()
                            .uri(cachedUri)
                            .build())
                    .build();
        }

        return null;
    }

    /**
     * Tự động sinh ảnh đồ họa bảng quy đổi kích cỡ thời trang chuẩn 800x800 cho thương hiệu FCentric.
     * Thỏa mãn 100% chính sách listing hình ảnh của TikTok Shop và Shopee (Open Platform v2).
     */
    private static byte[] taoTikTokSizeChartImage(String tenSp) {
        return taoFCentricSizeChartImage(tenSp);
    }

    /**
     * Tự động sinh ảnh đồ họa bảng quy đổi kích cỡ thời trang chuẩn 800x800 cho thương hiệu FCentric.
     * Hỗ trợ tự động phân nhánh bảng kích cỡ theo chủng loại sản phẩm:
     * - Quần / Đáy (Pants / Jeans / Kaki / Shorts / Trousers): Vòng eo, Vòng mông, Dài quần, Cân nặng.
     * - Áo / Thân trên (Tops / Polo / T-shirt / Jackets / Outerwear): Chiều cao, Cân nặng, Vòng ngực, Dài áo.
     */
    public static byte[] taoFCentricSizeChartImage(String tenSp) {
        try {
            int width = 800;
            int height = 800;
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(width, height, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = img.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(java.awt.RenderingHints.KEY_TEXT_ANTIALIASING, java.awt.RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            // Nền trắng
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, width, height);

            // Viền ngoài
            g.setColor(new java.awt.Color(226, 232, 240));
            g.drawRect(20, 20, width - 40, height - 40);

            // Khối Header
            g.setColor(new java.awt.Color(30, 58, 138));
            g.fillRect(20, 20, width - 40, 110);

            g.setColor(java.awt.Color.WHITE);
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 30));
            g.drawString("FCENTRIC - BẢNG QUY ĐỔI KÍCH CỠ", 90, 70);

            String nameNorm = (tenSp != null ? tenSp : "").toLowerCase(Locale.ROOT);
            boolean isPants = nameNorm.contains("quần") || nameNorm.contains("jean") || nameNorm.contains("pant")
                    || nameNorm.contains("short") || nameNorm.contains("kaki") || nameNorm.contains("trouser") || nameNorm.contains("jogger");

            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
            g.setColor(new java.awt.Color(219, 234, 254));
            if (isPants) {
                g.drawString("BẢNG THÔNG SỐ CHỌN SIZE QUẦN CHUẨN FORM CHÍNH HÃNG", 125, 105);
            } else {
                g.drawString("BẢNG THÔNG SỐ CHỌN SIZE QUẦN ÁO CHUẨN FORM CHÍNH HÃNG", 120, 105);
            }

            // Tên sản phẩm phụ đề
            g.setColor(new java.awt.Color(51, 65, 85));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 18));
            String title = (tenSp != null && !tenSp.isBlank()) ? tenSp : "Sản phẩm thời trang FCentric";
            if (title.length() > 45) title = title.substring(0, 42) + "...";
            g.drawString("Sản phẩm: " + title, 40, 160);

            // Bảng kích cỡ chuẩn
            int tableX = 40;
            int tableY = 185;
            int tableW = 720;
            int rowH = 58;

            String[] headers;
            String[][] data;
            if (isPants) {
                headers = new String[]{"Size", "Vòng eo (cm)", "Vòng mông (cm)", "Dài quần (cm)", "Cân nặng (kg)"};
                data = new String[][]{
                    {"28 / S", "70 - 74", "88 - 92", "96", "48 - 55"},
                    {"29 / M", "74 - 78", "92 - 96", "98", "56 - 63"},
                    {"30 / L", "78 - 82", "96 - 100", "100", "64 - 70"},
                    {"31 / XL", "82 - 86", "100 - 104", "102", "71 - 78"},
                    {"32 / XXL", "86 - 92", "104 - 110", "104", "79 - 88"}
                };
            } else {
                headers = new String[]{"Size", "Chiều cao (cm)", "Cân nặng (kg)", "Vòng ngực (cm)", "Dài áo (cm)"};
                data = new String[][]{
                    {"S", "155 - 165", "48 - 55", "88 - 92", "65"},
                    {"M", "165 - 170", "56 - 65", "92 - 96", "67"},
                    {"L", "170 - 175", "66 - 72", "96 - 100", "69"},
                    {"XL", "175 - 180", "73 - 80", "100 - 104", "71"},
                    {"XXL", "180 - 188", "81 - 90", "104 - 110", "73"}
                };
            }

            int colW = tableW / headers.length; // 144px mỗi cột

            // Vẽ tiêu đề cột bảng
            g.setColor(new java.awt.Color(239, 246, 255));
            g.fillRect(tableX, tableY, tableW, rowH);
            g.setColor(new java.awt.Color(30, 64, 175));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 17));

            for (int col = 0; col < headers.length; col++) {
                java.awt.FontMetrics fm = g.getFontMetrics();
                int txtW = fm.stringWidth(headers[col]);
                int cellX = tableX + col * colW;
                g.drawString(headers[col], cellX + (colW - txtW) / 2, tableY + 36);
            }

            // Vẽ các dòng dữ liệu
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
            for (int r = 0; r < data.length; r++) {
                int curY = tableY + (r + 1) * rowH;
                if (r % 2 == 1) {
                    g.setColor(new java.awt.Color(248, 250, 252));
                    g.fillRect(tableX, curY, tableW, rowH);
                }

                for (int col = 0; col < headers.length; col++) {
                    String val = data[r][col];
                    if (col == 0) {
                        g.setColor(new java.awt.Color(37, 99, 235));
                        g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 20));
                    } else {
                        g.setColor(new java.awt.Color(51, 65, 85));
                        g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
                    }
                    java.awt.FontMetrics fm = g.getFontMetrics();
                    int txtW = fm.stringWidth(val);
                    int cellX = tableX + col * colW;
                    g.drawString(val, cellX + (colW - txtW) / 2, curY + 36);
                }

                // Đường kẻ ngang dòng
                g.setColor(new java.awt.Color(226, 232, 240));
                g.drawLine(tableX, curY + rowH, tableX + tableW, curY + rowH);
            }

            // Kẻ viền bảng và các đường kẻ dọc
            g.setColor(new java.awt.Color(203, 213, 225));
            g.drawRect(tableX, tableY, tableW, rowH * (data.length + 1));
            for (int col = 1; col < headers.length; col++) {
                g.drawLine(tableX + col * colW, tableY, tableX + col * colW, tableY + rowH * (data.length + 1));
            }

            // Hộp lưu ý / hướng dẫn chân trang
            int noteY = tableY + rowH * (data.length + 1) + 30;
            g.setColor(new java.awt.Color(254, 243, 199));
            g.fillRoundRect(tableX, noteY, tableW, 110, 16, 16);
            g.setColor(new java.awt.Color(217, 119, 6));
            g.drawRoundRect(tableX, noteY, tableW, 110, 16, 16);

            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 17));
            g.setColor(new java.awt.Color(180, 83, 9));
            g.drawString("LƯU Ý CHỌN SIZE TỪ FCENTRIC:", tableX + 20, noteY + 32);

            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 15));
            g.setColor(new java.awt.Color(120, 53, 15));
            g.drawString("• Bảng size dựa trên vóc dáng chuẩn của người Việt Nam.", tableX + 20, noteY + 60);
            g.drawString("• Nếu phân vân giữa 2 size hoặc thích mặc rộng thoải mái, quý khách vui lòng chọn tăng 1 size.", tableX + 20, noteY + 86);

            // Chân trang thương hiệu
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.ITALIC, 14));
            g.setColor(new java.awt.Color(148, 163, 184));
            g.drawString("FCentric Fashion Co., Ltd • Official Size Guide", tableX + 210, height - 35);

            g.dispose();
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            log.warn("Không thể sinh ảnh size chart cho thương hiệu FCentric: {}", e.getMessage());
            return new byte[0];
        }
    }

    private static byte[] convertToTikTokCompliantJpeg(byte[] rawBytes, String productName) {
        if (rawBytes == null || rawBytes.length == 0) {
            return taoTikTokDefaultImage(productName);
        }
        try {
            java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(rawBytes);
            java.awt.image.BufferedImage original = javax.imageio.ImageIO.read(bais);
            if (original != null) {
                int maxDim = 1200;
                int w = original.getWidth();
                int h = original.getHeight();
                if (w > maxDim || h > maxDim) {
                    if (w >= h) {
                        h = (int) Math.round(((double) h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = (int) Math.round(((double) w * maxDim) / h);
                        h = maxDim;
                    }
                }
                w = Math.max(w, 600);
                h = Math.max(h, 600);

                java.awt.image.BufferedImage rgbImg = new java.awt.image.BufferedImage(w, h, java.awt.image.BufferedImage.TYPE_INT_RGB);
                java.awt.Graphics2D g = rgbImg.createGraphics();
                g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setRenderingHint(java.awt.RenderingHints.KEY_RENDERING, java.awt.RenderingHints.VALUE_RENDER_QUALITY);
                g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
                g.setColor(java.awt.Color.WHITE);
                g.fillRect(0, 0, w, h);
                g.drawImage(original, 0, 0, w, h, null);
                g.dispose();

                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                javax.imageio.ImageIO.write(rgbImg, "jpg", baos);
                return baos.toByteArray();
            }
        } catch (Throwable ex) {
            log.warn("[TIKTOK-IMAGE-CONVERT] Không thể chuyển đổi ảnh sang JPEG cho [{}]: {}", productName, ex.getMessage());
        }
        return taoTikTokDefaultImage(productName);
    }

    /**
     * Xác định chính xác warehouse bán hàng (SALES_WAREHOUSE) duy nhất của TikTok Shop.
     * Quy tắc bắt buộc:
     * 1. Tuyệt đối loại bỏ RETURN_WAREHOUSE (kho trả hàng bưu cục, không nhận tồn bán hàng).
     * 2. Lọc kho có type == "SALES_WAREHOUSE".
     * 3. Ưu tiên kho có is_default == true.
     * 4. Tự động lưu warehouseId hợp lệ vào cấu hình hệ thống (MA_KHO_SAN) để các luồng sau tái sử dụng.
     */
    private String xacDinhTikTokSalesWarehouseId(String appKey, String appSecret, String token, String cipher, String maKenh) {
        String saved = dieuHanhHeThongService.getCauHinhString(KenhCauHinhDongBo.khoa(maKenh, "MA_KHO_SAN"), null);
        if (saved != null && !saved.isBlank() && !"default".equalsIgnoreCase(saved) && !"tiktok-default-warehouse".equalsIgnoreCase(saved)) {
            return saved.trim();
        }

        try {
            TikTokWarehousesResponse whRes = getTikTokShopClient().getWarehouses(appKey, appSecret, token, cipher);
            if (whRes != null && whRes.getWarehouses() != null && !whRes.getWarehouses().isEmpty()) {
                // Lọc bỏ 100% kho trả hàng (RETURN_WAREHOUSE)
                List<TikTokWarehouseDto> salesWarehouses = whRes.getWarehouses().stream()
                        .filter(w -> !"RETURN_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType())
                                && !"RETURN".equalsIgnoreCase(w.getWarehouseType()))
                        .toList();

                // 1. Ưu tiên kho SALES_WAREHOUSE có isDefault = true
                // 2. Tiếp theo là kho SALES_WAREHOUSE bất kỳ
                // 3. Cuối cùng mới lấy kho đầu tiên không phải RETURN
                TikTokWarehouseDto chosen = salesWarehouses.stream()
                        .filter(w -> "SALES_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType()) && Boolean.TRUE.equals(w.getIsDefault()))
                        .findFirst()
                        .or(() -> salesWarehouses.stream()
                                .filter(w -> "SALES_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType()))
                                .findFirst())
                        .or(() -> salesWarehouses.stream().findFirst())
                        .orElse(null);

                if (chosen != null) {
                    String chosenId = chosen.getWarehouseId() != null ? chosen.getWarehouseId() : chosen.getId();
                    if (chosenId != null && !chosenId.isBlank()) {
                        log.info("[TIKTOK-WAREHOUSE] Đã xác định SALES_WAREHOUSE hợp lệ: id={} (tên={}, type={}, isDefault={})",
                                chosenId, chosen.getName(), chosen.getType(), chosen.getIsDefault());
                        dieuHanhHeThongService.setCauHinhString(KenhCauHinhDongBo.khoa(maKenh, "MA_KHO_SAN"), chosenId);
                        return chosenId;
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-WAREHOUSE] Lỗi khi tra cứu danh sách kho TikTok Shop: {}", ex.getMessage());
        }

        return (saved != null && !saved.isBlank()) ? saved : "default";
    }

    private TuDongLienKetResultDto tuDongLienKetTikTok(KenhBanHang kenh) {
        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();

        if (appKey == null || appSecret == null || token == null || cipher == null || cipher.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhXacThucShopCipher", kenh.getMaKenh()), HttpStatus.BAD_REQUEST, null);
        }

        // Lấy warehouse bán hàng (chỉ nhận SALES_WAREHOUSE, loại trừ hoàn toàn RETURN_WAREHOUSE)
        String warehouseId = xacDinhTikTokSalesWarehouseId(appKey, appSecret, token, cipher, kenh.getMaKenh());

        // 1. Tải sản phẩm từ sàn để cập nhật danh mục hiện có
        try {
            taiSanPhamTikTok(kenh);
        } catch (Exception ex) {
            log.warn("Lỗi khi quét sản phẩm từ sàn TikTok Shop: {}", ex.getMessage());
        }

        List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findActiveVariantsWithDetails();
        if (activeVariants == null || activeVariants.isEmpty()) {
            activeVariants = bienTheSanPhamRepository.findByTrangThai(1);
        }

        // 2. Tra cứu danh mục TikTok Shop hiện có trong cache RAM
        TikTokCatalogCache catalog = layHoacCapNhatTikTokCatalog(appKey, appSecret, token, cipher, false);
        Map<String, String> tiktokSkuMap = new HashMap<>(catalog.skuToSkuId());

        // Chuẩn bị ánh xạ liên kết hiện tại từ DB để tra cứu Product ID và chống lỗi trùng lặp liên kết
        List<TrangThaiDongBoSanPham> danhSach = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        Map<String, TrangThaiDongBoSanPham> existingBySkuSan = new HashMap<>();
        Map<Integer, TrangThaiDongBoSanPham> existingByBtId = new HashMap<>();
        for (TrangThaiDongBoSanPham tt : danhSach) {
            if (tt.getMaSanPhamKenh() != null) {
                existingBySkuSan.put(tt.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), tt);
            }
            if (tt.getBienTheSanPham() != null && tt.getBienTheSanPham().getId() != null) {
                existingByBtId.put(tt.getBienTheSanPham().getId(), tt);
            }
        }

        // 3. Gom nhóm theo SanPhamQuanAo để tạo mới hoặc cập nhật thông tin sản phẩm trên TikTok Shop
        int soTaoMoiTrenTikTok = 0;
        int soCapNhatTrenTikTok = 0;
        Map<String, String> cdnCache = new HashMap<>();

        if (activeVariants != null && !activeVariants.isEmpty()) {
            Map<SanPhamQuanAo, List<BienTheSanPham>> spGroupMap = activeVariants.stream()
                    .filter(bt -> bt.getSanPham() != null)
                    .collect(Collectors.groupingBy(BienTheSanPham::getSanPham));

            for (Map.Entry<SanPhamQuanAo, List<BienTheSanPham>> entry : spGroupMap.entrySet()) {
                SanPhamQuanAo sp = entry.getKey();
                List<BienTheSanPham> spVariants = entry.getValue();

                List<BienTheSanPham> variantsCanTao = new ArrayList<>();
                List<BienTheSanPham> variantsDaCo = new ArrayList<>();
                for (BienTheSanPham bt : spVariants) {
                    if (bt.getMaSku() != null && !bt.getMaSku().isBlank()) {
                        TrangThaiDongBoSanPham exM = existingByBtId.get(bt.getId());
                        if (exM != null && Boolean.FALSE.equals(exM.getChoPhepDongBo())) {
                            continue; // Người dùng đã tắt đồng bộ biến thể này, không đẩy tạo mới lên TikTok Shop
                        }
                        String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                        if (!tiktokSkuMap.containsKey(norm)) {
                            variantsCanTao.add(bt);
                        } else {
                            variantsDaCo.add(bt);
                        }
                    }
                }

                if (!variantsCanTao.isEmpty()) {
                    Map<String, String> createdMap = taoSanPhamLenTikTok(
                            kenh, sp, variantsCanTao, appKey, appSecret, token, cipher, warehouseId, cdnCache);
                    if (!createdMap.isEmpty()) {
                        soTaoMoiTrenTikTok++;
                        tiktokSkuMap.putAll(createdMap);
                    }
                } else if (!variantsDaCo.isEmpty()) {
                    // Sản phẩm đã có mặt trên TikTok Shop -> Đồng bộ cập nhật thông tin mới nhất (tiêu đề, mô tả, phân loại)
                    boolean updated = capNhatSanPhamLenTikTok(
                            kenh, sp, variantsDaCo, appKey, appSecret, token, cipher, warehouseId, cdnCache, catalog, existingByBtId);
                    if (updated) {
                        soCapNhatTrenTikTok++;
                    }
                }
            }
        }

        // 4. Ghép SKU và đồng bộ trạng thái
        int soDaGhep = 0;
        int soKhongKhop = 0;
        Instant now = Instant.now();

        if (activeVariants != null) {
            for (BienTheSanPham bt : activeVariants) {
                if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
                String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                String tiktokSkuId = tiktokSkuMap.get(norm);

                // Ưu tiên 1: Tra cứu theo biến thể FCentric đã tồn tại để tránh vi phạm uk_bien_the_kenh
                TrangThaiDongBoSanPham record = existingByBtId.get(bt.getId());
                // Ưu tiên 2: Tra cứu theo SKU người bán
                if (record == null) {
                    record = existingBySkuSan.get(norm);
                }
                // Ưu tiên 3: Tra cứu theo mã số TikTok SKU
                if (record == null && tiktokSkuId != null) {
                    record = existingBySkuSan.get(tiktokSkuId.toLowerCase(Locale.ROOT));
                }

                if (record != null) {
                    boolean dangNgung = Boolean.FALSE.equals(record.getChoPhepDongBo()) || TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo());
                    record.setBienTheSanPham(bt);
                    // Bảo toàn lý do lỗi từ bước 3 (tạo mới/cập nhật) nếu sản phẩm vừa gặp lỗi kiểm duyệt hoặc bị khóa trên sàn
                    if (!dangNgung && (!"that_bai".equalsIgnoreCase(record.getTrangThaiDongBo()) || record.getChiTietLoi() == null)) {
                        record.setTrangThaiDongBo("thanh_cong");
                        record.setChiTietLoi(null);
                    }
                    record.setNgayDongBoCuoi(now);
                    if (tiktokSkuId != null && tiktokSkuId.matches("\\d+")) {
                        record.setMaSanPhamKenh(tiktokSkuId);
                    }
                    trangThaiDongBoSanPhamRepository.save(record);
                    existingByBtId.put(bt.getId(), record);
                    if (record.getMaSanPhamKenh() != null) {
                        existingBySkuSan.put(record.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), record);
                    }
                    if ("thanh_cong".equalsIgnoreCase(record.getTrangThaiDongBo())) {
                        soDaGhep++;
                    }
                } else if (tiktokSkuId != null) {
                    TrangThaiDongBoSanPham moi = new TrangThaiDongBoSanPham();
                    moi.setKenhBanHang(kenh);
                    moi.setBienTheSanPham(bt);
                    moi.setMaSanPhamKenh(tiktokSkuId);
                    moi.setTrangThaiDongBo("thanh_cong");
                    moi.setChiTietLoi(null);
                    moi.setNgayDongBoCuoi(now);
                    trangThaiDongBoSanPhamRepository.save(moi);
                    existingByBtId.put(bt.getId(), moi);
                    existingBySkuSan.put(tiktokSkuId.toLowerCase(Locale.ROOT), moi);
                    soDaGhep++;
                } else {
                    soKhongKhop++;
                }
            }
        }

        // 5. Đẩy tồn ban đầu cho các SKU đã ghép (có Delta Sync bảo vệ quota)
        int soTonKhoDaDay = 0;
        List<TrangThaiDongBoSanPham> canLuu = new ArrayList<>();
        List<TrangThaiDongBoSanPham> updatedList = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        for (TrangThaiDongBoSanPham tt : updatedList) {
            if (tt.getBienTheSanPham() != null && "thanh_cong".equalsIgnoreCase(tt.getTrangThaiDongBo())) {
                try {
                    int soDay = tinhSoTonDay(khaDungToanChuoi(tt.getBienTheSanPham().getId()), BigDecimal.valueOf(100), 0, 0);
                    // Delta Sync: Bỏ qua nếu số tồn khả dụng không đổi và đã đẩy thành công trước đó (bảo vệ quota)
                    if (tt.getSoLuongDaDay() != null && tt.getSoLuongDaDay().equals(soDay)) {
                        continue;
                    }
                    KetQuaGuiTon kq = guiTonLenTikTok(tt, soDay);
                    if (kq != null && kq.thanhCong()) {
                        soTonKhoDaDay++;
                        tt.setSoLuongDaDay(soDay);
                        tt.setNgayDayTonCuoi(now);
                        tt.setChiTietLoi(null);
                        canLuu.add(tt);
                    } else if (kq != null && !kq.thanhCong()) {
                        tt.setTrangThaiDongBo("that_bai");
                        tt.setChiTietLoi(kq.lyDo());
                        tt.setNgayDongBoCuoi(now);
                        canLuu.add(tt);
                    }
                } catch (Exception ex) {
                    log.warn("Không đẩy được tồn ban đầu cho SKU TikTok Shop {}: {}", tt.getMaSanPhamKenh(), ex.getMessage());
                }
            }
        }
        if (!canLuu.isEmpty()) {
            trangThaiDongBoSanPhamRepository.saveAll(canLuu);
        }

        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban,
                String.format("Tự động liên kết SKU TikTok Shop: %s đã ghép, %s chưa khớp, tạo mới %s sản phẩm, cập nhật %s sản phẩm, đã đẩy tồn %s SKU",
                        soDaGhep, soKhongKhop, soTaoMoiTrenTikTok, soCapNhatTrenTikTok, soTonKhoDaDay));

        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(soKhongKhop)
                .soNhieuKhop(0)
                .soTaoMoiTrenShopify(soTaoMoiTrenTikTok)
                .soCapNhatTrenShopify(soCapNhatTrenTikTok)
                .soTonKhoDaDay(soTonKhoDaDay)
                .soThatBai(0)
                .build();
    }

    private TuDongLienKetResultDto tuDongLienKetLazada(KenhBanHang kenh) {
        String maKenh = kenh != null ? kenh.getMaKenh() : "LAZADA";
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCoCauHinhAccessToken", kenh.getMaKenh()), HttpStatus.BAD_REQUEST, null);
        }

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
                    .soCapNhatTrenShopify(0)
                    .soTonKhoDaDay(0)
                    .soThatBai(0)
                    .build();
        }

        Map<String, BienTheSanPham> variantBySku = new HashMap<>();
        for (BienTheSanPham bt : activeVariants) {
            if (bt.getMaSku() != null && !bt.getMaSku().isBlank()) {
                variantBySku.put(bt.getMaSku().trim().toLowerCase(Locale.ROOT), bt);
            }
        }

        // 2. Tải danh sách sản phẩm hiện có từ Lazada để xây dựng ánh xạ SellerSku -> SkuId và SellerSku -> ItemId
        int offset = 0;
        int limit = 50;
        Map<String, String> lazadaSkuToSkuIdMap = new HashMap<>();
        Map<String, String> lazadaSkuToItemIdMap = new HashMap<>();
        try {
            while (true) {
                JsonNode res = lazadaClient.getProducts(appKey, appSecret, token, "all", limit, offset);
                if (!"0".equals(res.path("code").asText(""))) break;
                JsonNode products = res.path("data").path("products");
                if (!products.isArray() || products.isEmpty()) break;
                for (JsonNode prodNode : products) {
                    String itemId = prodNode.path("item_id").asText("").trim();
                    if (itemId.isBlank()) itemId = prodNode.path("ItemId").asText("").trim();
                    if (itemId.isBlank()) itemId = prodNode.path("itemId").asText("").trim();

                    JsonNode skus = prodNode.path("skus");
                    if (skus.isArray()) {
                        for (JsonNode skuNode : skus) {
                            String sSku = skuNode.path("SellerSku").asText("").trim();
                            if (sSku.isBlank()) sSku = skuNode.path("ShopSku").asText("").trim();
                            String sId = skuNode.path("SkuId").asText("").trim();
                            if (sId.isBlank()) sId = skuNode.path("sku_id").asText("").trim();
                            String skuItemId = skuNode.path("item_id").asText("").trim();
                            if (skuItemId.isBlank()) skuItemId = skuNode.path("ItemId").asText("").trim();
                            String effectiveItemId = !itemId.isBlank() ? itemId : skuItemId;

                            if (!sSku.isBlank()) {
                                String normSku = sSku.toLowerCase(Locale.ROOT);
                                if (!sId.isBlank()) {
                                    lazadaSkuToSkuIdMap.put(normSku, sId);
                                }
                                if (!effectiveItemId.isBlank()) {
                                    lazadaSkuToItemIdMap.put(normSku, effectiveItemId);
                                }
                            }
                        }
                    }
                }
                if (products.size() < limit) break;
                offset += limit;
            }
        } catch (Exception e) {
            log.warn("[LAZADA-AUTOLINK] Không thể lấy danh sách sản phẩm hiện có từ Lazada: {}", e.getMessage());
        }

        // Gom nhóm biến thể theo sản phẩm cha SanPhamQuanAo để tạo sản phẩm mới hoặc cập nhật ảnh trên Lazada
        Map<SanPhamQuanAo, List<BienTheSanPham>> spGroupMap = activeVariants.stream()
                .filter(bt -> bt.getSanPham() != null)
                .collect(Collectors.groupingBy(BienTheSanPham::getSanPham));

        int soTaoMoiTrenLazada = 0;
        int soCapNhatTrenLazada = 0;
        Map<String, String> cdnCache = new HashMap<>();

        List<TrangThaiDongBoSanPham> existingMappings = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        Map<Integer, TrangThaiDongBoSanPham> mappingByBtId = new HashMap<>();
        for (TrangThaiDongBoSanPham m : existingMappings) {
            if (m.getBienTheSanPham() != null) {
                mappingByBtId.put(m.getBienTheSanPham().getId(), m);
            }
        }

        for (Map.Entry<SanPhamQuanAo, List<BienTheSanPham>> entry : spGroupMap.entrySet()) {
            SanPhamQuanAo sp = entry.getKey();
            List<BienTheSanPham> spVariants = entry.getValue();

            List<BienTheSanPham> variantsCanTao = new ArrayList<>();
            List<BienTheSanPham> variantsDaCo = new ArrayList<>();
            String lazadaItemId = null;

            for (BienTheSanPham bt : spVariants) {
                if (bt.getMaSku() != null && !bt.getMaSku().isBlank()) {
                    TrangThaiDongBoSanPham existingM = mappingByBtId.get(bt.getId());
                    if (existingM != null && Boolean.FALSE.equals(existingM.getChoPhepDongBo())) {
                        continue; // Người dùng đã chủ động tắt đồng bộ biến thể này, không đẩy tạo mới lên sàn
                    }
                    String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                    if (!lazadaSkuToSkuIdMap.containsKey(norm)) {
                        variantsCanTao.add(bt);
                    } else {
                        variantsDaCo.add(bt);
                        if (lazadaItemId == null && lazadaSkuToItemIdMap.containsKey(norm)) {
                            lazadaItemId = lazadaSkuToItemIdMap.get(norm);
                        }
                    }
                }
            }

            if (!variantsCanTao.isEmpty()) {
                Map<String, String> createdMap = taoSanPhamLenLazada(kenh, sp, variantsCanTao, appKey, appSecret, token, cdnCache);
                soTaoMoiTrenLazada += createdMap.size();
                lazadaSkuToSkuIdMap.putAll(createdMap);
            }

            if (!variantsDaCo.isEmpty() && lazadaItemId != null) {
                boolean updated = capNhatSanPhamLenLazada(kenh, sp, variantsDaCo, lazadaItemId, lazadaSkuToSkuIdMap, appKey, appSecret, token, cdnCache);
                if (updated) {
                    soCapNhatTrenLazada += variantsDaCo.size();
                }
            }
        }

        int soDaGhep = 0;
        int soKhongKhop = 0;
        int soTonKhoDaDay = 0;

        for (BienTheSanPham bt : activeVariants) {
            if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
            String normSku = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
            String targetSkuId = lazadaSkuToSkuIdMap.get(normSku);
            boolean hasNumericSkuId = targetSkuId != null && targetSkuId.matches("\\d+");
            if (!hasNumericSkuId) {
                targetSkuId = null;
            }

            TrangThaiDongBoSanPham record = mappingByBtId.get(bt.getId());
            boolean dangNgung = record != null && (Boolean.FALSE.equals(record.getChoPhepDongBo()) || TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo()));
            if (record != null) {
                record.setMaSanPhamKenh(targetSkuId);
                if (!dangNgung) {
                    if (hasNumericSkuId) {
                        record.setTrangThaiDongBo("thanh_cong");
                        record.setChiTietLoi(null);
                    } else {
                        record.setTrangThaiDongBo("that_bai");
                        if (record.getChiTietLoi() == null || record.getChiTietLoi().isBlank()
                                || record.getChiTietLoi().contains("Tự động liên kết")) {
                            record.setChiTietLoi("Sản phẩm chưa được tạo thành công trên Lazada. Vui lòng bấm 'Đưa sản phẩm FCentric lên Lazada' để tạo lại.");
                        }
                    }
                }
                record.setNgayDongBoCuoi(Instant.now());
            } else {
                record = TrangThaiDongBoSanPham.builder()
                        .kenhBanHang(kenh)
                        .bienTheSanPham(bt)
                        .maSanPhamKenh(targetSkuId)
                        .trangThaiDongBo(hasNumericSkuId ? "thanh_cong" : "that_bai")
                        .chiTietLoi(hasNumericSkuId ? null : "Sản phẩm chưa được tạo thành công trên Lazada. Vui lòng bấm 'Đưa sản phẩm FCentric lên Lazada' để tạo lại.")
                        .ngayDongBoCuoi(Instant.now())
                        .build();
            }
            trangThaiDongBoSanPhamRepository.save(record);
            if (hasNumericSkuId) {
                soDaGhep++;
            } else {
                soKhongKhop++;
            }
        }

        KetNoiDayTon ketNoi = moKetNoiDayTon(kenh);
        if (ketNoi.lyDoLoi() == null) {
            List<TrangThaiDongBoSanPham> dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                    .stream()
                    .filter(KenhBanHangDongBoServiceImpl::duocDayTon)
                    .filter(d -> d.getMaSanPhamKenh() != null && d.getMaSanPhamKenh().matches("\\d+"))
                    .toList();
            for (TrangThaiDongBoSanPham dong : dongCanDay) {
                BienTheSanPham bt = dong.getBienTheSanPham();
                if (bt == null) continue;
                int availableQty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));
                KetQuaGuiTon kq = dayTonChoDong(dong, ketNoi, availableQty);
                if (kq.thanhCong()) {
                    soTonKhoDaDay++;
                }
                if (!kq.loiKenh()) {
                    trangThaiDongBoSanPhamRepository.save(dong);
                }
            }
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham, "Tự động liên kết Lazada: đã ghép " + soDaGhep + " SKU, tạo mới trên Lazada " + soTaoMoiTrenLazada + " SKU, cập nhật ảnh " + soCapNhatTrenLazada + " SKU, đã đẩy tồn " + soTonKhoDaDay + " SKU");
        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(soKhongKhop)
                .soNhieuKhop(0)
                .soTaoMoiTrenShopify(soTaoMoiTrenLazada)
                .soCapNhatTrenShopify(soCapNhatTrenLazada)
                .soTonKhoDaDay(soTonKhoDaDay)
                .soThatBai(0)
                .build();
    }

    @Override
    public TuDongLienKetResultDto tuDongLienKet(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        ReentrantLock khoa = khoaDayTon.computeIfAbsent(kenh.getId(), id -> new ReentrantLock());
        boolean daKhoa = false;
        try {
            daKhoa = khoa.tryLock(5, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {}
        if (!daKhoa) {
            throw new CommonException(ThongDiep.of("kenhBan.dangCoTienTrinhDongBo", kenh.getTenKenh()), HttpStatus.CONFLICT, null);
        }
        try {
            if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
                return tuDongLienKetLazada(kenh);
            }
            if (OmnichannelOrderSyncJob.isTikTok(kenh.getMaKenh())) {
                return tuDongLienKetTikTok(kenh);
            }
            if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
                return tuDongLienKetShopee(kenh);
            }
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
                        Optional<TrangThaiDongBoSanPham> mapCheck = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());
                        if (mapCheck.isPresent() && Boolean.FALSE.equals(mapCheck.get().getChoPhepDongBo())) {
                            continue; // Người dùng đã tắt đồng bộ biến thể này, không đẩy tạo mới lên Shopify
                        }
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
                        dangNgung = Boolean.FALSE.equals(record.getChoPhepDongBo()) || TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo());
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
                                .choPhepDongBo(true)
                                .ngayDongBoCuoi(Instant.now())
                                .build();
                    }

                    // Cập nhật giá biến thể lên Shopify nếu phát hiện lệch giá hoặc chưa đồng bộ giá
                    if (!dangNgung && variantInfo != null && variantInfo.getVariantId() != null && bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0) {
                        boolean lechGia = variantInfo.getPrice() == null || variantInfo.getPrice().compareTo(bt.getGiaBan()) != 0;
                        if (lechGia) {
                            boolean ok = capNhatGiaBienTheShopify(domain, token, variantInfo.getVariantId(), bt.getGiaBan(), null);
                            if (ok) {
                                variantInfo.setPrice(bt.getGiaBan());
                                record.setGiaBanSan(bt.getGiaBan());
                            }
                        } else {
                            record.setGiaBanSan(variantInfo.getPrice());
                        }
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
        } finally {
            if (daKhoa) {
                khoa.unlock();
            }
        }
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
        List<Integer> btIds = page.getContent().stream()
                .map(TrangThaiDongBoSanPham::getBienTheSanPham)
                .filter(Objects::nonNull)
                .map(BienTheSanPham::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Integer, String> anhTheoBienThe = anhDaiDienTheoBienThe(btIds);
        Map<Integer, BigDecimal> khaDung = khaDungTheoBienThe(page.getContent());

        return page.map(item -> toLienKetDto(item, khaDung, anhTheoSanPham, anhTheoBienThe));
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
        List<Integer> btIds = dong.stream()
                .map(TrangThaiDongBoSanPham::getBienTheSanPham)
                .filter(Objects::nonNull)
                .map(BienTheSanPham::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Integer, String> anhTheoBienThe = anhDaiDienTheoBienThe(btIds);
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
                    .map(item -> toLienKetDto(item, khaDung, anhTheoSanPham, anhTheoBienThe))
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

    /** Một dòng liên kết cho giao diện; ưu tiên ảnh biến thể riêng, nếu không có thì lấy ảnh sản phẩm cha. */
    private LienKetSanPhamDto toLienKetDto(TrangThaiDongBoSanPham item, Map<Integer, BigDecimal> khaDungTheoBienThe,
                                           Map<Integer, String> anhTheoSanPham, Map<Integer, String> anhTheoBienThe) {
        BienTheSanPham bt = item.getBienTheSanPham();
        Integer sanPhamId = bt != null && bt.getSanPham() != null ? bt.getSanPham().getId() : null;
        Integer bienTheId = bt != null ? bt.getId() : null;
        String tenSanPham = bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null;
        String tenBienThe = bt != null ? buildVariantName(bt) : null;
        BigDecimal soLuongKhaDung = bienTheId != null
                ? khaDungTheoBienThe.getOrDefault(bienTheId, BigDecimal.ZERO)
                : BigDecimal.ZERO;

        BigDecimal giaBanSan = item.getGiaBanSan() != null ? item.getGiaBanSan() : (bt != null ? bt.getGiaBan() : null);
        BigDecimal giaBan = bt != null ? bt.getGiaBan() : null;
        Boolean lechGia = (item.getGiaBanSan() != null && giaBan != null) ? item.getGiaBanSan().compareTo(giaBan) != 0 : Boolean.FALSE;

        String anhBienThe = (bienTheId != null && anhTheoBienThe != null) ? anhTheoBienThe.get(bienTheId) : null;
        String anhHienThi = (anhBienThe != null) ? anhBienThe : (sanPhamId != null && anhTheoSanPham != null ? anhTheoSanPham.get(sanPhamId) : null);

        return LienKetSanPhamDto.builder()
                .id(item.getId())
                .skuSan(item.getMaSanPhamKenh())
                .tenSanPhamSan(tenSanPham)
                .tenBienTheSan(tenBienThe)
                .giaBanSan(giaBanSan)
                .lechGia(lechGia)
                .bienTheSanPhamId(bienTheId)
                .sanPhamId(sanPhamId)
                .anhDaiDien(anhHienThi)
                .maSku(bt != null ? bt.getMaSku() : null)
                .tenSanPham(tenSanPham)
                .tenBienThe(tenBienThe)
                .giaBan(bt != null ? bt.getGiaBan() : null)
                .soLuongKhaDung(soLuongKhaDung)
                .soLuongDaDay(soDaDay(item))
                .ngayDayTonCuoi(item.getNgayDayTonCuoi())
                .choPhepDongBo(item.getChoPhepDongBo() == null || item.getChoPhepDongBo())
                .trangThaiLienKet(mapStatusToFrontend(item.getTrangThaiDongBo(), item.getChoPhepDongBo()))
                .ngayDongBoCuoi(item.getNgayDongBoCuoi())
                .chiTietLoi(item.getChiTietLoi())
                .build();
    }

    private LienKetSanPhamDto toLienKetDto(TrangThaiDongBoSanPham item, Map<Integer, BigDecimal> khaDungTheoBienThe,
                                           Map<Integer, String> anhTheoSanPham) {
        return toLienKetDto(item, khaDungTheoBienThe, anhTheoSanPham, null);
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
                .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThayLienKet", lienKetId), HttpStatus.NOT_FOUND, null));

        if (request.getChoPhepDongBo() != null) {
            record.setChoPhepDongBo(request.getChoPhepDongBo());
        }
        if (request.getBienTheSanPhamId() != null) {
            BienTheSanPham bt = bienTheSanPhamRepository.findById(request.getBienTheSanPhamId())
                    .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThayBienThe", request.getBienTheSanPhamId()), HttpStatus.BAD_REQUEST, null));
            Integer kenhId = record.getKenhBanHang() != null ? record.getKenhBanHang().getId() : null;
            if (kenhId != null && trangThaiDongBoSanPhamRepository
                    .existsByKenhBanHangIdAndBienTheSanPhamIdAndIdNot(kenhId, bt.getId(), record.getId())) {
                throw new CommonException(ThongDiep.of("kenhBan.bienTheDaGhep", bt.getMaSku()),
                        HttpStatus.BAD_REQUEST, null);
            }
            record.setBienTheSanPham(bt);
            record.setTrangThaiDongBo(Boolean.FALSE.equals(record.getChoPhepDongBo()) ? "chua_dong_bo" : "thanh_cong");
            record.setChiTietLoi(null);
        } else {
            record.setTrangThaiDongBo("chua_dong_bo");
        }
        record.setNgayDongBoCuoi(Instant.now());
        TrangThaiDongBoSanPham saved = trangThaiDongBoSanPhamRepository.save(record);

        BienTheSanPham bt = saved.getBienTheSanPham();
        Integer sanPhamId = bt != null && bt.getSanPham() != null ? bt.getSanPham().getId() : null;
        BigDecimal giaBanSanSaved = saved.getGiaBanSan() != null ? saved.getGiaBanSan() : (bt != null ? bt.getGiaBan() : null);
        BigDecimal giaBanSaved = bt != null ? bt.getGiaBan() : null;
        Boolean lechGiaSaved = (saved.getGiaBanSan() != null && giaBanSaved != null) ? saved.getGiaBanSan().compareTo(giaBanSaved) != 0 : Boolean.FALSE;

        return LienKetSanPhamDto.builder()
                .id(saved.getId())
                .skuSan(saved.getMaSanPhamKenh())
                .tenSanPhamSan(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienTheSan(bt != null ? buildVariantName(bt) : null)
                .giaBanSan(giaBanSanSaved)
                .lechGia(lechGiaSaved)
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
                .choPhepDongBo(saved.getChoPhepDongBo() == null || saved.getChoPhepDongBo())
                .trangThaiLienKet(mapStatusToFrontend(saved.getTrangThaiDongBo(), saved.getChoPhepDongBo()))
                .ngayDongBoCuoi(saved.getNgayDongBoCuoi())
                .chiTietLoi(saved.getChiTietLoi())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xoaLienKet(Integer lienKetId) {
        TrangThaiDongBoSanPham record = trangThaiDongBoSanPhamRepository.findById(lienKetId)
                .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThayLienKet", lienKetId), HttpStatus.NOT_FOUND, null));
        Integer kenhId = record.getKenhBanHang() != null ? record.getKenhBanHang().getId() : null;
        String maSku = (record.getBienTheSanPham() != null && record.getBienTheSanPham().getMaSku() != null)
                ? record.getBienTheSanPham().getMaSku() : record.getMaSanPhamKenh();
        trangThaiDongBoSanPhamRepository.delete(record);
        if (kenhId != null) {
            ghiNhatKy(kenhId, IHanhDong.cap_nhat_kenh_ban, "Hủy liên kết SKU " + maSku + " khỏi gian hàng");
        }
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


    private DayTonResultDto dayTonTikTokToiUu(
            KenhBanHang kenh,
            String maKenh,
            List<TrangThaiDongBoSanPham> dongCanDay,
            BigDecimal tyLe,
            int tonDem,
            int nguongVe0,
            TheoDoiDayTon theoDoi) {

        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();

        if (appKey == null || appSecret == null || token == null || cipher == null || cipher.isBlank()) {
            String msg = "Chưa có đủ thông tin xác thực hoặc Shop Cipher cho kênh TikTok Shop";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, "TikTok Shop: " + msg);
            return DayTonResultDto.builder().soDong(0).soLoi(dongCanDay.size()).soChuaDay(0).loiKenh(msg).build();
        }

        // Lấy warehouse bán hàng (chỉ nhận SALES_WAREHOUSE, loại trừ hoàn toàn RETURN_WAREHOUSE)
        String warehouseId = xacDinhTikTokSalesWarehouseId(appKey, appSecret, token, cipher, maKenh);

        List<DongCanCapNhat> dirtyList = new ArrayList<>();
        int soBoQuaKhongDoi = 0;

        for (TrangThaiDongBoSanPham dong : dongCanDay) {
            BienTheSanPham bt = dong.getBienTheSanPham();
            if (bt == null || bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
            int soDay = tinhSoTonDay(khaDungToanChuoi(bt.getId()), tyLe, tonDem, nguongVe0);

            boolean daThanhCong = "thanh_cong".equalsIgnoreCase(dong.getTrangThaiDongBo());
            boolean soTonKhongDoi = dong.getSoLuongDaDay() != null && dong.getSoLuongDaDay().equals(soDay);
            if (daThanhCong && soTonKhongDoi) {
                soBoQuaKhongDoi++;
                continue;
            }
            // Chống spam lặp lỗi (Delta Sync bảo vệ quota): nếu lần trước thất bại nhưng số tồn không đổi và lần thử gần nhất chưa quá 60 phút -> bỏ qua
            if (!daThanhCong && soTonKhongDoi && dong.getNgayDongBoCuoi() != null
                    && java.time.Duration.between(dong.getNgayDongBoCuoi(), Instant.now()).toMinutes() < 60) {
                soBoQuaKhongDoi++;
                continue;
            }

            String skuSan = dong.getMaSanPhamKenh() != null ? dong.getMaSanPhamKenh().trim() : bt.getMaSku().trim();
            dirtyList.add(new DongCanCapNhat(dong, soDay, skuSan, bt.getMaSku().trim()));
        }

        log.info("[TIKTOK-SYNC-DELTA] Tổng số SKU: {}, Bỏ qua không đổi: {}, Cần đẩy (dirty): {}",
                dongCanDay.size(), soBoQuaKhongDoi, dirtyList.size());

        if (dirtyList.isEmpty()) {
            theoDoi.batDauDay(0);
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
            String moTa = "TikTok Shop: Tất cả " + dongCanDay.size() + " SKU tồn kho không đổi, bỏ qua đẩy tồn (tiết kiệm 100% quota API)";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);
            return DayTonResultDto.builder().soDong(0).soLoi(0).soChuaDay(0).loiKenh(null).build();
        }

        TikTokCatalogCache catalog = layHoacCapNhatTikTokCatalog(appKey, appSecret, token, cipher, false);
        Map<String, String> skuToProductId = catalog.skuToProductId();
        Map<String, String> skuToSkuId = catalog.skuToSkuId();

        Map<String, List<DongCanCapNhat>> groupedByProduct = new LinkedHashMap<>();
        for (DongCanCapNhat item : dirtyList) {
            String prodId = skuToProductId.get(item.sellerSku().toLowerCase());
            if (prodId == null) {
                prodId = skuToProductId.get(item.sellerSku());
            }
            if (prodId == null) {
                prodId = skuToProductId.get(item.skuSan().toLowerCase());
            }
            if (prodId == null) {
                prodId = skuToProductId.get(item.skuSan());
            }
            if (prodId == null && item.skuSan().contains(":")) {
                prodId = item.skuSan().substring(0, item.skuSan().indexOf(':')).trim();
            }
            if (prodId == null && item.dong().getBienTheSanPham() != null && item.dong().getBienTheSanPham().getSanPham() != null) {
                List<BienTheSanPham> siblings = bienTheSanPhamRepository.findBySanPham_Id(item.dong().getBienTheSanPham().getSanPham().getId());
                if (siblings != null) {
                    for (BienTheSanPham sib : siblings) {
                        if (sib.getMaSku() != null) {
                            String sibPid = skuToProductId.get(sib.getMaSku().trim().toLowerCase());
                            if (sibPid != null && sibPid.matches("\\d+")) {
                                prodId = sibPid;
                                break;
                            }
                        }
                    }
                }
            }
            if (prodId == null) {
                prodId = "UNKNOWN";
            }
            groupedByProduct.computeIfAbsent(prodId, k -> new ArrayList<>()).add(item);
        }

        int soThanhCong = 0;
        int soLoi = 0;
        String loiKenh = null;
        boolean dungTheoYeuCau = false;
        Instant now = Instant.now();

        theoDoi.batDauDay(dirtyList.size());

        for (Map.Entry<String, List<DongCanCapNhat>> entry : groupedByProduct.entrySet()) {
            if (theoDoi.canDung()) {
                dungTheoYeuCau = true;
                break;
            }

            String prodId = entry.getKey();
            List<DongCanCapNhat> batch = entry.getValue();

            boolean isNumericProdId = prodId != null && prodId.matches("\\d+");
            if (!isNumericProdId) {
                String errorMsg = ThongDiep.vi("hienThiKenhPos.tiktokChuaLienKetProductId");
                log.warn("[TIKTOK-SYNC] Bỏ qua gọi API sàn vì Product ID không hợp lệ ({}) cho {} SKU: {}",
                        prodId, batch.size(), batch.stream().map(DongCanCapNhat::sellerSku).toList());
                for (DongCanCapNhat item : batch) {
                    item.dong().setTrangThaiDongBo("that_bai");
                    item.dong().setChiTietLoi(errorMsg);
                    item.dong().setNgayDongBoCuoi(now);
                    soLoi++;
                    theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, errorMsg);
                }
                List<TrangThaiDongBoSanPham> batchEntities = batch.stream().map(DongCanCapNhat::dong).toList();
                trangThaiDongBoSanPhamRepository.saveAll(batchEntities);
                continue;
            }

            for (DongCanCapNhat item : batch) {
                theoDoi.dangDay(item.sellerSku());
            }

            List<TikTokInventoryUpdateRequest.SkuInventory> skuList = new ArrayList<>();
            List<DongCanCapNhat> validItems = new ArrayList<>();
            for (DongCanCapNhat item : batch) {
                String actualSkuId = skuToSkuId.getOrDefault(item.sellerSku(),
                        skuToSkuId.getOrDefault(item.skuSan(), item.skuSan()));
                boolean isValidSkuId = actualSkuId != null && actualSkuId.matches("\\d+");
                if (!isValidSkuId) {
                    String errorMsg = ThongDiep.vi("hienThiKenhPos.tiktokKhongTimThaySkuIdChung");
                    item.dong().setTrangThaiDongBo("that_bai");
                    item.dong().setChiTietLoi(errorMsg);
                    item.dong().setNgayDongBoCuoi(now);
                    soLoi++;
                    theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, errorMsg);
                    continue;
                }
                validItems.add(item);
                skuList.add(TikTokInventoryUpdateRequest.SkuInventory.builder()
                        .id(actualSkuId)
                        .inventory(List.of(TikTokInventoryUpdateRequest.WarehouseQuantity.builder()
                                .warehouseId(warehouseId)
                                .quantity(Math.max(0, item.soDay()))
                                .build()))
                        .build());
            }

            if (skuList.isEmpty()) {
                List<TrangThaiDongBoSanPham> batchEntities = batch.stream().map(DongCanCapNhat::dong).toList();
                trangThaiDongBoSanPhamRepository.saveAll(batchEntities);
                continue;
            }

            TikTokInventoryUpdateRequest updateReq = TikTokInventoryUpdateRequest.builder()
                    .skus(skuList)
                    .build();

            boolean capNhatThanhCong = false;
            int retries = 0;
            final int MAX_RETRIES = 3;

            while (!capNhatThanhCong && retries < MAX_RETRIES) {
                try {
                    TikTokInventoryUpdateResponse res = getTikTokShopClient()
                            .updateProductInventory(appKey, appSecret, token, cipher, prodId, updateReq);
                    if (res != null && res.getCode() == 0) {
                        capNhatThanhCong = true;
                    } else {
                        int errCode = res != null && res.getCode() != null ? res.getCode() : -1;
                        String errMsg = res != null ? res.getMessage() : "";
                        loiKenh = phanLoaiLoiTikTok(errCode, errMsg, null).lyDo();
                        log.warn("[TIKTOK-SYNC] Cập nhật tồn thất bại cho sản phẩm {}: code={} - {}", prodId, errCode, errMsg);
                        break;
                    }
                } catch (LoiCoMaException e) {
                    if (MaLoi.TIKTOK_RATE_LIMIT.equals(e.getMa())) {
                        retries++;
                        long waitTime = (long) Math.pow(2, retries) * 1000L;
                        log.warn("[TIKTOK-SYNC] Chạm giới hạn HTTP 429 rate limit khi cập nhật sản phẩm {}, backoff lần {} chờ {}ms...",
                                prodId, retries, waitTime);
                        try {
                            Thread.sleep(waitTime);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            dungTheoYeuCau = true;
                            break;
                        }
                    } else {
                        loiKenh = phanLoaiLoiTikTok(-1, e.getMessage(), null).lyDo();
                        break;
                    }
                } catch (org.springframework.web.client.HttpStatusCodeException e) {
                    loiKenh = phanLoaiLoiTikTok(e.getStatusCode().value(), e.getStatusText(), e.getResponseBodyAsString()).lyDo();
                    break;
                } catch (Exception e) {
                    log.warn("[TIKTOK-SYNC] Lỗi kết nối khi cập nhật sản phẩm {}: {}", prodId, e.getMessage());
                    loiKenh = phanLoaiLoiTikTok(-1, e.getMessage(), null).lyDo();
                    break;
                }
            }

            if (capNhatThanhCong) {
                for (DongCanCapNhat item : validItems) {
                    item.dong().setTrangThaiDongBo("thanh_cong");
                    item.dong().setChiTietLoi(null);
                    item.dong().setSoLuongDaDay(item.soDay());
                    item.dong().setNgayDayTonCuoi(now);
                    soThanhCong++;
                    theoDoi.daDay(item.sellerSku(), null, true, null);
                }
            } else {
                String errorMsg = loiKenh != null ? loiKenh : "Cập nhật tồn thất bại trên TikTok Shop";
                String errLower = errorMsg.toLowerCase(Locale.ROOT);
                boolean biXoaTrenSan = errLower.contains("not found") || errLower.contains("không tìm thấy")
                        || errLower.contains("12052001") || errLower.contains("deleted")
                        || errLower.contains("12052557") || errLower.contains("not belong to the product");
                if (biXoaTrenSan) {
                    tikTokCatalogCacheRef.set(null); // Giải phóng RAM cache để ép nạp lại mới
                }
                for (DongCanCapNhat item : validItems) {
                    if (biXoaTrenSan) {
                        item.dong().setMaSanPhamKenh(null);
                        item.dong().setTrangThaiDongBo("chua_dong_bo");
                        item.dong().setChiTietLoi("Phân loại SKU hoặc bài đăng trên TikTok Shop không còn khớp (do tạo lại hoặc xóa bài). Hệ thống đã tự động hủy liên kết cũ.");
                    } else {
                        item.dong().setTrangThaiDongBo("that_bai");
                        item.dong().setChiTietLoi(errorMsg);
                    }
                    soLoi++;
                    theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, item.dong().getChiTietLoi());
                }
            }

            List<TrangThaiDongBoSanPham> batchEntities = batch.stream().map(DongCanCapNhat::dong).toList();
            trangThaiDongBoSanPhamRepository.saveAll(batchEntities);
        }

        int soChuaDay = dirtyList.size() - (soThanhCong + soLoi);
        if (soThanhCong > 0) {
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
        }

        String moTa = "TikTok Shop: Đẩy tồn theo nhóm sản phẩm cha (" + dirtyList.size() + " SKU dirty, gom thành "
                + groupedByProduct.size() + " sản phẩm cha, bỏ qua " + soBoQuaKhongDoi + " SKU không đổi): "
                + soThanhCong + " thành công, " + soLoi + " lỗi, " + soChuaDay + " chưa đẩy"
                + (loiKenh != null ? " (" + loiKenh + ")" : "");
        if (dungTheoYeuCau) {
            moTa += "; dừng theo yêu cầu";
        }
        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);

        return DayTonResultDto.builder()
                .soDong(dirtyList.size())
                .soLoi(soLoi)
                .soChuaDay(soChuaDay)
                .loiKenh(loiKenh)
                .build();
    }

    private DayTonResultDto dayTonLazadaToiUu(
            KenhBanHang kenh,
            String maKenh,
            List<TrangThaiDongBoSanPham> dongCanDay,
            BigDecimal tyLe,
            int tonDem,
            int nguongVe0,
            TheoDoiDayTon theoDoi) {
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            String msg = "Chưa có cấu hình hoặc Access Token cho kênh Lazada";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, "Lazada: " + msg);
            return DayTonResultDto.builder().soDong(0).soLoi(dongCanDay.size()).soChuaDay(0).loiKenh(msg).build();
        }

        List<DongCanCapNhat> dirtyList = new ArrayList<>();
        int soBoQuaKhongDoi = 0;

        for (TrangThaiDongBoSanPham dong : dongCanDay) {
            BienTheSanPham bt = dong.getBienTheSanPham();
            if (bt == null || bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
            int soDay = tinhSoTonDay(khaDungToanChuoi(bt.getId()), tyLe, tonDem, nguongVe0);

            boolean daThanhCong = "thanh_cong".equalsIgnoreCase(dong.getTrangThaiDongBo());
            boolean soTonKhongDoi = dong.getSoLuongDaDay() != null && dong.getSoLuongDaDay().equals(soDay);
            if (daThanhCong && soTonKhongDoi) {
                soBoQuaKhongDoi++;
                continue;
            }

            String skuId = dong.getMaSanPhamKenh() != null ? dong.getMaSanPhamKenh().trim() : "";
            dirtyList.add(new DongCanCapNhat(dong, soDay, skuId, bt.getMaSku().trim()));
        }

        log.info("[LAZADA-SYNC-DELTA] Tổng số SKU: {}, Bỏ qua không đổi: {}, Cần đẩy (dirty): {}",
                dongCanDay.size(), soBoQuaKhongDoi, dirtyList.size());

        if (dirtyList.isEmpty()) {
            theoDoi.batDauDay(0);
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
            String moTa = "Lazada: Tất cả " + dongCanDay.size() + " SKU tồn kho không đổi, bỏ qua đẩy tồn (tiết kiệm 100% quota API)";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);
            return DayTonResultDto.builder()
                    .soDong(0)
                    .soLoi(0)
                    .soChuaDay(0)
                    .loiKenh(null)
                    .build();
        }

        boolean coItemThieuSkuId = dirtyList.stream().anyMatch(it -> it.skuId() == null || !it.skuId().matches("\\d+"));
        if (coItemThieuSkuId) {
            log.info("[LAZADA-RESOLVE-SKU] Phát hiện biến thể chưa có SkuId số, tự động tra cứu danh sách sản phẩm từ Lazada...");
            Map<String, String> lazadaSellerSkuToSkuId = layMapSellerSkuToSkuIdLazada(appKey, appSecret, token);
            List<DongCanCapNhat> updatedDirtyList = new ArrayList<>();
            for (DongCanCapNhat item : dirtyList) {
                if (item.skuId() == null || !item.skuId().matches("\\d+")) {
                    String resolvedId = lazadaSellerSkuToSkuId.get(item.sellerSku().toLowerCase(Locale.ROOT));
                    if (resolvedId != null && resolvedId.matches("\\d+")) {
                        item.dong().setMaSanPhamKenh(resolvedId);
                        trangThaiDongBoSanPhamRepository.save(item.dong());
                        updatedDirtyList.add(new DongCanCapNhat(item.dong(), item.soDay(), resolvedId, item.sellerSku()));
                    } else {
                        updatedDirtyList.add(item);
                    }
                } else {
                    updatedDirtyList.add(item);
                }
            }
            dirtyList = updatedDirtyList;
        }

        final int BATCH_SIZE = 25;
        int soThanhCong = 0;
        int soLoi = 0;
        String loiKenh = null;
        boolean dungTheoYeuCau = false;
        Instant now = Instant.now();

        theoDoi.batDauDay(dirtyList.size());

        for (int i = 0; i < dirtyList.size(); i += BATCH_SIZE) {
            if (theoDoi.canDung()) {
                dungTheoYeuCau = true;
                break;
            }

            int end = Math.min(i + BATCH_SIZE, dirtyList.size());
            List<DongCanCapNhat> batch = dirtyList.subList(i, end);

            for (DongCanCapNhat item : batch) {
                theoDoi.dangDay(item.sellerSku());
            }

            List<DongCanCapNhat> validBatch = batch.stream()
                    .filter(it -> it.skuId() != null && it.skuId().matches("\\d+"))
                    .toList();
            List<DongCanCapNhat> invalidBatch = batch.stream()
                    .filter(it -> it.skuId() == null || !it.skuId().matches("\\d+"))
                    .toList();

            for (DongCanCapNhat invalidItem : invalidBatch) {
                invalidItem.dong().setTrangThaiDongBo("that_bai");
                if (invalidItem.dong().getChiTietLoi() == null || invalidItem.dong().getChiTietLoi().isBlank()
                        || invalidItem.dong().getChiTietLoi().contains("Tự động liên kết")) {
                    invalidItem.dong().setChiTietLoi("Sản phẩm chưa được tạo thành công trên Lazada. Vui lòng bấm 'Đưa sản phẩm FCentric lên Lazada' để tạo lại.");
                }
                soLoi++;
                theoDoi.daDay(invalidItem.sellerSku(), tenHienThi(invalidItem.dong().getBienTheSanPham()), false, invalidItem.dong().getChiTietLoi());
            }

            if (validBatch.isEmpty()) {
                continue;
            }

            StringBuilder batchXml = buildLazadaBatchXml(validBatch);

            try {
                JsonNode res = lazadaClient.updatePriceQuantity(appKey, appSecret, token, batchXml.toString());
                String code = res.path("code").asText("");
                if ("0".equals(code)) {
                    for (DongCanCapNhat item : validBatch) {
                        item.dong().setTrangThaiDongBo("thanh_cong");
                        item.dong().setChiTietLoi(null);
                        item.dong().setSoLuongDaDay(item.soDay());
                        item.dong().setNgayDayTonCuoi(now);
                        soThanhCong++;
                        theoDoi.daDay(item.sellerSku(), null, true, null);
                    }
                } else {
                    String msg = res.path("message").asText(res.path("sub_message").asText("Lỗi từ Lazada"));
                    String detailMsg = "";
                    if (res.has("detail") && res.path("detail").isArray() && !res.path("detail").isEmpty()) {
                        detailMsg = res.path("detail").get(0).path("message").asText("");
                        msg += " - " + detailMsg;
                    }
                    if (code.contains("AppCallLimit") || msg.contains("exceeds the limit")) {
                        loiKenh = "Lazada giới hạn tần suất gọi API: " + msg;
                    }

                    // [BATCH FALLBACK ISOLATION] Tự động tách lô khi 1 SKU bị lỗi sàn tạm giữ (501 negative sellable)
                    boolean isNegativeSellable = msg.toLowerCase(Locale.ROOT).contains("negative sellable");
                    if (isNegativeSellable && validBatch.size() > 1) {
                        DongCanCapNhat culprit = timSkuViPhamNegativeSellable(validBatch, res, detailMsg);
                        if (culprit != null) {
                            culprit.dong().setTrangThaiDongBo("that_bai");
                            culprit.dong().setChiTietLoi("Lazada đang tạm giữ tồn cho đơn chờ thanh toán hoặc chiến dịch (Mã sàn: "
                                    + (culprit.skuId() != null && !culprit.skuId().isBlank() ? culprit.skuId() : culprit.sellerSku())
                                    + "). Hệ thống sẽ tự động bù tồn khi sàn mở khóa.");
                            soLoi++;
                            theoDoi.daDay(culprit.sellerSku(), tenHienThi(culprit.dong().getBienTheSanPham()), false, "Sàn đang tạm giữ tồn");

                            List<DongCanCapNhat> remaining = validBatch.stream().filter(it -> it != culprit).toList();
                            StringBuilder subXml = buildLazadaBatchXml(remaining);
                            try {
                                JsonNode subRes = lazadaClient.updatePriceQuantity(appKey, appSecret, token, subXml.toString());
                                String subCode = subRes != null ? subRes.path("code").asText("") : "";
                                if ("0".equals(subCode)) {
                                    for (DongCanCapNhat remItem : remaining) {
                                        remItem.dong().setTrangThaiDongBo("thanh_cong");
                                        remItem.dong().setChiTietLoi(null);
                                        remItem.dong().setSoLuongDaDay(remItem.soDay());
                                        remItem.dong().setNgayDayTonCuoi(now);
                                        soThanhCong++;
                                        theoDoi.daDay(remItem.sellerSku(), null, true, null);
                                    }
                                    log.info("[LAZADA-FALLBACK] Tự động tách lô thành công: 1 SKU tạm khóa sàn, {} SKU còn lại đẩy thành công 100%!",
                                            remaining.size());
                                    continue;
                                }
                            } catch (Exception subEx) {
                                log.warn("[LAZADA-FALLBACK] Lỗi gửi sub-batch: {}", subEx.getMessage());
                            }
                        }
                    }

                    // [BATCH FALLBACK SKU MISMATCH] Tự động tra cứu lại SkuId từ sàn khi SkuId cũ bị Lazada từ chối
                    boolean isSkuMismatch = msg.toLowerCase(Locale.ROOT).contains("doesn't exist")
                            || msg.toLowerCase(Locale.ROOT).contains("does not match")
                            || msg.toLowerCase(Locale.ROOT).contains("invalid skuid");
                    if (isSkuMismatch) {
                        log.info("[LAZADA-FALLBACK-SKU] Phát hiện SkuId không khớp với gian hàng hiện tại, tự động tải lại SkuId từ sàn Lazada...");
                        Map<String, String> freshMap = layMapSellerSkuToSkuIdLazada(appKey, appSecret, token);
                        List<DongCanCapNhat> refreshedBatch = new ArrayList<>();
                        for (DongCanCapNhat item : validBatch) {
                            String freshId = freshMap.get(item.sellerSku().toLowerCase(Locale.ROOT));
                            if (freshId != null && freshId.matches("\\d+")) {
                                item.dong().setMaSanPhamKenh(freshId);
                                trangThaiDongBoSanPhamRepository.save(item.dong());
                                refreshedBatch.add(new DongCanCapNhat(item.dong(), item.soDay(), freshId, item.sellerSku()));
                            }
                        }
                        if (!refreshedBatch.isEmpty()) {
                            StringBuilder retryXml = buildLazadaBatchXml(refreshedBatch);
                            try {
                                JsonNode retryRes = lazadaClient.updatePriceQuantity(appKey, appSecret, token, retryXml.toString());
                                String retryCode = retryRes != null ? retryRes.path("code").asText("") : "";
                                if ("0".equals(retryCode)) {
                                    for (DongCanCapNhat item : refreshedBatch) {
                                        item.dong().setTrangThaiDongBo("thanh_cong");
                                        item.dong().setChiTietLoi(null);
                                        item.dong().setSoLuongDaDay(item.soDay());
                                        item.dong().setNgayDayTonCuoi(now);
                                        soThanhCong++;
                                        theoDoi.daDay(item.sellerSku(), null, true, null);
                                    }
                                    log.info("[LAZADA-FALLBACK-SKU] Đẩy tồn tự chữa lành thành công cho {} SKU bằng SkuId mới!", refreshedBatch.size());
                                    continue;
                                }
                            } catch (Exception retryEx) {
                                log.warn("[LAZADA-FALLBACK-SKU] Thử lại bằng SkuId mới thất bại: {}", retryEx.getMessage());
                            }
                        }
                    }

                    String friendlyMsg = dichLoiLazada(code, msg);
                    boolean biXoaTrenSan = "ERR_ITEM_NOT_FOUND".equalsIgnoreCase(code)
                            || (msg != null && (msg.toLowerCase(Locale.ROOT).contains("not found") || msg.toLowerCase(Locale.ROOT).contains("does not exist") || msg.toLowerCase(Locale.ROOT).contains("deleted")));
                    for (DongCanCapNhat item : batch) {
                        if (biXoaTrenSan) {
                            item.dong().setMaSanPhamKenh(null);
                            item.dong().setTrangThaiDongBo("chua_dong_bo");
                            item.dong().setChiTietLoi("Sản phẩm đã bị xóa hoặc ngừng bán trên Lazada. Hệ thống đã tự động hủy liên kết.");
                        } else {
                            item.dong().setTrangThaiDongBo("that_bai");
                            item.dong().setChiTietLoi(friendlyMsg);
                        }
                        soLoi++;
                        theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, item.dong().getChiTietLoi());
                    }
                }
            } catch (Exception ex) {
                log.warn("[LAZADA-SYNC-BATCH] Lỗi mạng khi gọi updatePriceQuantity cho batch {}: {}", i / BATCH_SIZE, ex.getMessage());
                loiKenh = "Lỗi kết nối tới sàn Lazada. Hệ thống sẽ tự động thử lại sau.";
                for (DongCanCapNhat item : batch) {
                    item.dong().setTrangThaiDongBo("that_bai");
                    item.dong().setChiTietLoi("Lỗi kết nối tới sàn Lazada. Hệ thống sẽ tự động thử lại sau.");
                    soLoi++;
                    theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, "Lỗi kết nối tới sàn Lazada");
                }
            }

            List<TrangThaiDongBoSanPham> batchEntities = batch.stream().map(DongCanCapNhat::dong).toList();
            trangThaiDongBoSanPhamRepository.saveAll(batchEntities);

            if (loiKenh != null && (loiKenh.contains("giới hạn tần suất") || loiKenh.contains("AppCallLimit"))) {
                break;
            }
        }

        int soChuaDay = dirtyList.size() - (soThanhCong + soLoi);
        if (soThanhCong > 0) {
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
        }

        String moTa = "Lazada: Đẩy tồn theo batch (" + dirtyList.size() + " SKU dirty, bỏ qua " + soBoQuaKhongDoi + " SKU không đổi): "
                + soThanhCong + " thành công, " + soLoi + " lỗi, " + soChuaDay + " chưa đẩy"
                + (loiKenh != null ? " (" + loiKenh + ")" : "");
        if (dungTheoYeuCau) {
            moTa += "; dừng theo yêu cầu";
        }
        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);

        return DayTonResultDto.builder()
                .soDong(soThanhCong + soBoQuaKhongDoi)
                .soLoi(soLoi)
                .soChuaDay(soChuaDay)
                .loiKenh(loiKenh)
                .build();
    }

    private DayTonResultDto dayTonKhiDaGiuKhoa(KenhBanHang kenh, String maKenh, DayTonKenhRequest request, TheoDoiDayTon theoDoi) {
        BigDecimal tyLe = request.getTyLeDayTon() != null ? request.getTyLeDayTon() : BigDecimal.valueOf(100);
        int tonDem = request.getTonDem() != null ? request.getTonDem() : 0;
        int nguongVe0 = request.getNguongVe0() != null ? request.getNguongVe0() : 0;

        List<TrangThaiDongBoSanPham> dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();

        if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            boolean canLienKetLai = dongCanDay.isEmpty()
                    || dongCanDay.stream().anyMatch(d -> d.getMaSanPhamKenh() == null || !d.getMaSanPhamKenh().trim().matches("\\d+"));
            if (canLienKetLai) {
                log.info("[LAZADA-SYNC] Phát hiện danh sách SKU Lazada chưa liên kết hoặc chưa có SkuId số, tự động kích hoạt liên kết & tạo sản phẩm...");
                try {
                    tuDongLienKet(kenh.getMaKenh());
                    dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                            .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();
                } catch (Exception ex) {
                    log.warn("[LAZADA-SYNC] Tự động liên kết Lazada trước khi đẩy tồn gặp lỗi: {}", ex.getMessage());
                
}
            }
            return dayTonLazadaToiUu(kenh, maKenh, dongCanDay, tyLe, tonDem, nguongVe0, theoDoi);
        } else if (OmnichannelOrderSyncJob.MA_KENH_TIKTOK.equalsIgnoreCase(kenh.getMaKenh()) || "TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
            return dayTonTikTokToiUu(kenh, maKenh, dongCanDay, tyLe, tonDem, nguongVe0, theoDoi);
        } else if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            if (dongCanDay.isEmpty()) {
                try {
                    tuDongLienKetShopee(kenh);
                    dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                            .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();
                } catch (Exception ex) {
                    log.warn("[SHOPEE-SYNC] Tự động liên kết Shopee trước khi đẩy tồn gặp lỗi: {}", ex.getMessage());
                }
            }
            return dayTonShopeeToiUu(kenh, maKenh, dongCanDay, tyLe, tonDem, nguongVe0, theoDoi);
        } else if (dongCanDay.isEmpty() && trangThaiDongBoSanPhamRepository.countByKenhBanHangId(kenh.getId()) == 0) {
            log.info("Kênh {} chưa có SKU liên kết nào, tự động kích hoạt liên kết & tạo sản phẩm trước khi đẩy tồn...", kenh.getMaKenh());
            try {
                tuDongLienKet(kenh.getMaKenh());
                dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                        .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();
            } catch (Exception ex) {
                log.warn("Tự động liên kết trước khi đẩy tồn gặp lỗi: {}", ex.getMessage());
            }
        }

        // Không ném lỗi: các dòng Shopify đã nhận trước khi gặp lỗi cả gian hàng vẫn phải được lưu
        KetNoiDayTon ketNoi = moKetNoiDayTon(kenh);
        String loiKenh = ketNoi.lyDoLoi();
        int soThanhCong = 0;
        int soLoi = 0;
        int daXuLy = 0;
        int soBoQuaKhongDoi = 0;
        boolean dungTheoYeuCau = false;
        if (loiKenh == null) {
            // Delta Sync: Lọc danh sách SKU cần đẩy (số tồn thay đổi hoặc trạng thái chưa thành công)
            List<DongCanCapNhat> dirtyList = new ArrayList<>();
            for (TrangThaiDongBoSanPham dong : dongCanDay) {
                BienTheSanPham bt = dong.getBienTheSanPham();
                if (bt == null) continue;
                int soDay = tinhSoTonDay(khaDungToanChuoi(bt.getId()), tyLe, tonDem, nguongVe0);
                boolean khongDoi = dong.getSoLuongDaDay() != null
                        && dong.getSoLuongDaDay().equals(soDay)
                        && "thanh_cong".equalsIgnoreCase(dong.getTrangThaiDongBo());
                if (khongDoi) {
                    soBoQuaKhongDoi++;
                } else {
                    dirtyList.add(new DongCanCapNhat(dong, soDay, dong.getMaSanPhamKenh(), bt.getMaSku()));
                }
            }

            log.info("[SHOPIFY-SYNC] Đẩy tồn Shopify {}: tổng {} SKU, cần đẩy {} SKU dirty, bỏ qua {} SKU không đổi số tồn.",
                    maKenh, dongCanDay.size(), dirtyList.size(), soBoQuaKhongDoi);

            theoDoi.batDauDay(dirtyList.size());
            for (DongCanCapNhat item : dirtyList) {
                // Throttling 250ms bảo vệ Shopify leaky bucket rate limit khi đẩy danh sách SKU thực tế
                if (daXuLy > 0) {
                    try {
                        Thread.sleep(250);
                    } catch (InterruptedException ignored) {}
                }
                if (theoDoi.canDung()) {
                    dungTheoYeuCau = true;
                    break;
                }
                TrangThaiDongBoSanPham dong = item.dong();
                BienTheSanPham bt = dong.getBienTheSanPham();
                theoDoi.dangDay(item.sellerSku());
                KetQuaGuiTon kq = dayTonChoDong(dong, ketNoi, item.soDay());
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
                theoDoi.daDay(item.sellerSku(), kq.thanhCong() ? null : tenHienThi(bt), kq.thanhCong(), kq.lyDo());
            }
        }
        int soChuaDay = (dongCanDay.size() - soBoQuaKhongDoi) - daXuLy;

        if (soThanhCong > 0) {
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
        }
        String moTa = moTaKetQuaDayTon(maKenh, ketNoi.tenDiaDiem(), soThanhCong, soLoi, soChuaDay, loiKenh);
        if (soBoQuaKhongDoi > 0) {
            moTa += " (bỏ qua " + soBoQuaKhongDoi + " SKU không đổi)";
        }
        if (dungTheoYeuCau) {
            moTa += "; dừng theo yêu cầu, còn " + soChuaDay + " SKU chưa đẩy";
        }
        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);
        return DayTonResultDto.builder()
                .soDong(soThanhCong + soBoQuaKhongDoi)
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

        Long soYeuCauHuy = null;
        if (OmnichannelOrderSyncJob.MA_KENH_TIKTOK.equalsIgnoreCase(kenh.getMaKenh()) && donBanHangRepository != null) {
            soYeuCauHuy = donBanHangRepository.countByKenhIdAndGhiChuTagAndTrangThaiIn(
                    kenh.getId(), "[KHÁCH YÊU CẦU HỦY]", List.of(0, 1, 7, 8));
        }

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
                .soYeuCauHuy(soYeuCauHuy)
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
        if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            return List.of(
                    ShopifyLocationDto.builder()
                            .maKhoSan("lazada-default-warehouse")
                            .tenKhoSan("Kho mặc định Lazada")
                            .loai("fulfillment")
                            .macDinh(true)
                            .build()
            );
        }
        if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            return List.of(
                    ShopifyLocationDto.builder()
                            .maKhoSan("shopee-default-warehouse")
                            .tenKhoSan("Kho mặc định Shopee" + (OmnichannelOrderSyncJob.isShopeeSandbox(kenh.getMaKenh()) ? " Sandbox" : ""))
                            .loai("fulfillment")
                            .macDinh(true)
                            .build()
            );
        }
        if ("TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
            String token = kenhBanHangService.getDecryptedTikTokAccessToken();
            String appKey = kenhBanHangService.getTikTokAppKey();
            String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
            String cipher = kenhBanHangService.getTikTokShopCipher();

            if (token != null && !token.isBlank() && appKey != null && appSecret != null && cipher != null && !cipher.isBlank()) {
                try {
                    TikTokWarehousesResponse res = getTikTokShopClient().getWarehouses(appKey, appSecret, token, cipher);
                    List<TikTokWarehouseDto> warehouses = res.getWarehouses();
                    if (warehouses != null && !warehouses.isEmpty()) {
                        List<ShopifyLocationDto> list = new ArrayList<>();
                        for (TikTokWarehouseDto w : warehouses) {
                            boolean isSales = "SALES_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType())
                                    || "DOMESTIC_WAREHOUSE".equalsIgnoreCase(w.getWarehouseSubType());
                            boolean isReturn = "RETURN_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType());
                            // Bỏ qua kho trả hàng (chỉ là địa chỉ bưu phẩm hoàn, không nhận tồn kho bán)
                            if (isReturn) {
                                continue;
                            }
                            String warehouseId = (w.getWarehouseId() != null && !w.getWarehouseId().isBlank())
                                    ? w.getWarehouseId() : w.getId();
                            String baseName = (w.getWarehouseName() != null && !w.getWarehouseName().isBlank())
                                    ? w.getWarehouseName()
                                    : (w.getName() != null && !w.getName().isBlank() ? w.getName() : "Kho TikTok " + (warehouseId != null ? warehouseId : ""));
                            String warehouseName = baseName;
                            if (isSales && !baseName.toLowerCase().contains("bán hàng")) {
                                warehouseName += " (Kho bán hàng mặc định)";
                            }
                            list.add(ShopifyLocationDto.builder()
                                    .maKhoSan(warehouseId)
                                    .tenKhoSan(warehouseName)
                                    .loai("sales")
                                    .macDinh(Boolean.TRUE.equals(w.getIsDefault()) || list.isEmpty())
                                    .build());
                        }
                        // Nếu chỉ có 1 kho bán hàng duy nhất, tự động gán mặc định và ghi nhận cấu hình nếu trống
                        if (list.size() == 1) {
                            list.get(0).setMacDinh(true);
                            String curSaved = dieuHanhHeThongService.getCauHinhString(KenhCauHinhDongBo.khoa("TIKTOK", "MA_KHO_SAN"), null);
                            if (curSaved == null || curSaved.isBlank()) {
                                dieuHanhHeThongService.setCauHinhString(KenhCauHinhDongBo.khoa("TIKTOK", "MA_KHO_SAN"), list.get(0).getMaKhoSan());
                            }
                        }
                        if (!list.isEmpty()) {
                            return list;
                        }
                    }
                } catch (Exception e) {
                    log.warn("Không lấy được danh sách kho logistics từ TikTok Shop: {}", e.getMessage());
                }
            }

            return List.of(
                    ShopifyLocationDto.builder()
                            .maKhoSan("tiktok-default-warehouse")
                            .tenKhoSan("Kho bán hàng TikTok Shop")
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
            throw new CommonException(ThongDiep.of("kenhBan.khoKhongTonTai", request.getKhoId()), HttpStatus.BAD_REQUEST, null);
        }

        if (request.getMaKhoSan() != null && !request.getMaKhoSan().isBlank()) {
            dieuHanhHeThongService.setCauHinhString(KenhCauHinhDongBo.khoa(maKenh, "MA_KHO_SAN"), request.getMaKhoSan().trim());
        }
        if (request.getTenKhoSan() != null && !request.getTenKhoSan().isBlank()) {
            dieuHanhHeThongService.setCauHinhString(KenhCauHinhDongBo.khoa(maKenh, "TEN_KHO_SAN"), request.getTenKhoSan().trim());
        }

        kenh.setNgayCapNhat(Instant.now());
        kenhBanHangRepository.save(kenh);

        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban,
                String.format("Lưu cấu hình đồng bộ: Kho %s, Kho sàn %s, Tỷ lệ %s%%, Tồn đệm %s, Ngưỡng về 0: %s",
                        request.getKhoId(), request.getMaKhoSan(), request.getTyLeDayTon(), request.getTonDem(), request.getNguongVe0()));

        return getTongQuan(maKenh);
    }

    public KenhKhoMappingConfigDto layCauHinhKhoMappingDaLuu(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) return null;
        String json = dieuHanhHeThongService.getCauHinhString("KENH_" + maKenh.trim().toUpperCase() + "_KHO_MAPPING", null);
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, KenhKhoMappingConfigDto.class);
        } catch (Exception e) {
            log.warn("[KHO-MAPPING] Lỗi parse cấu hình ánh xạ kho cho kênh {}: {}", maKenh, e.getMessage());
            return null;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public KenhKhoMappingConfigDto layCauHinhKhoMapping(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        List<ShopifyLocationDto> dsKhoSan = getLocations(maKenh);
        int soKhoSanHopLe = (dsKhoSan != null) ? dsKhoSan.size() : 0;

        // Lấy danh sách kho nội bộ FCentric đang hoạt động, loại trừ KHO_TRANSIT
        List<Kho> khoHoatDong = khoRepository.findByTrangThai(1).stream()
                .filter(k -> k.getMaKho() == null || !"KHO_TRANSIT".equalsIgnoreCase(k.getMaKho()))
                .filter(k -> k.getTenKho() == null || !k.getTenKho().toLowerCase(Locale.ROOT).contains("transit"))
                .toList();

        List<KenhKhoMappingConfigDto.KhoOptionDto> dsKhoFCentricOpt = khoHoatDong.stream()
                .map(k -> KenhKhoMappingConfigDto.KhoOptionDto.builder()
                        .id(k.getId())
                        .maKho(k.getMaKho())
                        .tenKho(k.getTenKho())
                        .diaChi(k.getDiaChi())
                        .build())
                .toList();

        // Xác định kho mặc định hiện tại
        Integer khoIdMacDinh = null;
        String savedKhoId = (dieuHanhHeThongService != null) ? dieuHanhHeThongService.getCauHinhString("KENH_" + maKenh.toUpperCase(Locale.ROOT) + "_KHO_ID", null) : null;
        if (savedKhoId != null && !savedKhoId.isBlank()) {
            try {
                khoIdMacDinh = Integer.parseInt(savedKhoId.trim());
            } catch (Exception ignored) {}
        }
        if (khoIdMacDinh == null || khoIdMacDinh <= 0) {
            khoIdMacDinh = khoHoatDong.stream().filter(KhoService::laKhoTong).map(Kho::getId).findFirst()
                    .orElse(khoHoatDong.isEmpty() ? 1 : khoHoatDong.get(0).getId());
        }
        final Integer defaultKhoId = khoIdMacDinh;
        String tenKhoMacDinh = khoHoatDong.stream().filter(k -> k.getId().equals(defaultKhoId)).map(Kho::getTenKho).findFirst().orElse("Kho Tổng");

        // Đọc cấu hình đã lưu trong DB (nếu có)
        KenhKhoMappingConfigDto savedCfg = layCauHinhKhoMappingDaLuu(maKenh);
        KenhKhoMappingConfigDto result = KenhKhoMappingConfigDto.builder()
                .maKenh(maKenh.toUpperCase(Locale.ROOT))
                .soKhoSanHopLe(soKhoSanHopLe)
                .khoIdMacDinh(defaultKhoId)
                .tenKhoMacDinh(tenKhoMacDinh)
                .dsKhoFCentricKhaDung(dsKhoFCentricOpt)
                .build();

        // Quy tắc kích hoạt Đa kho tự động:
        // - Khi sàn chỉ có 1 kho (hoặc <= 1): BẮT BUỘC cheDoDaKho = false
        // - Khi sàn có từ 2 kho trở lên: cheDoDaKho theo cấu hình người dùng bật, mặc định bật nếu chưa lưu
        if (soKhoSanHopLe <= 1) {
            result.setCheDoDaKho(false);
            if (dsKhoSan != null && !dsKhoSan.isEmpty()) {
                ShopifyLocationDto single = dsKhoSan.get(0);
                result.setDanhSachKho(List.of(KenhKhoMappingItemDto.builder()
                        .maKhoSan(single.getMaKhoSan())
                        .tenKhoSan(single.getTenKhoSan())
                        .loaiKhoSan(single.getLoai() != null ? single.getLoai() : "fulfillment")
                        .khoIdFCentric(defaultKhoId)
                        .tenKhoFCentric(tenKhoMacDinh)
                        .kichHoat(true)
                        .laMacDinh(true)
                        .build()));
            }
            return result;
        }

        // Sàn có từ 2 kho trở lên: nếu đã lưu thì lấy giá trị đã lưu, nếu lần đầu phát hiện >= 2 kho thì mặc định bật
        boolean daKho = savedCfg != null ? Boolean.TRUE.equals(savedCfg.getCheDoDaKho()) : true;
        result.setCheDoDaKho(daKho);

        Map<String, KenhKhoMappingItemDto> savedMap = new HashMap<>();
        if (savedCfg != null && savedCfg.getDanhSachKho() != null) {
            for (KenhKhoMappingItemDto item : savedCfg.getDanhSachKho()) {
                if (item.getMaKhoSan() != null) {
                    savedMap.put(item.getMaKhoSan().trim(), item);
                }
            }
        }

        List<KenhKhoMappingItemDto> mergedList = new ArrayList<>();
        if (dsKhoSan != null) {
            for (int i = 0; i < dsKhoSan.size(); i++) {
                ShopifyLocationDto sLoc = dsKhoSan.get(i);
                String maSan = sLoc.getMaKhoSan() != null ? sLoc.getMaKhoSan().trim() : "";
                KenhKhoMappingItemDto existing = savedMap.get(maSan);
                if (existing != null) {
                    if (existing.getKhoIdFCentric() != null) {
                        khoHoatDong.stream().filter(k -> k.getId().equals(existing.getKhoIdFCentric())).findFirst()
                                .ifPresent(k -> existing.setTenKhoFCentric(k.getTenKho()));
                    }
                    mergedList.add(existing);
                } else {
                    Integer assignedKhoId = defaultKhoId;
                    if (i < khoHoatDong.size()) {
                        assignedKhoId = khoHoatDong.get(i).getId();
                    }
                    final Integer aId = assignedKhoId;
                    String assignedName = khoHoatDong.stream().filter(k -> k.getId().equals(aId)).map(Kho::getTenKho).findFirst().orElse(tenKhoMacDinh);
                    mergedList.add(KenhKhoMappingItemDto.builder()
                            .maKhoSan(maSan)
                            .tenKhoSan(sLoc.getTenKhoSan())
                            .loaiKhoSan(sLoc.getLoai() != null ? sLoc.getLoai() : "sales")
                            .khoIdFCentric(assignedKhoId)
                            .tenKhoFCentric(assignedName)
                            .kichHoat(true)
                            .laMacDinh(sLoc.isMacDinh() || i == 0)
                            .build());
                }
            }
        }
        result.setDanhSachKho(mergedList);

        if (savedCfg != null && savedCfg.getKhoTraHang() != null) {
            result.setKhoTraHang(savedCfg.getKhoTraHang());
        }

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KenhKhoMappingConfigDto luuCauHinhKhoMapping(String maKenh, KenhKhoMappingUpdateRequest request) {
        KenhBanHang kenh = getKenhActive(maKenh);
        if (request == null) {
            throw new CommonException(ThongDiep.of("kenhBan.cauHinhKhongHopLe"), HttpStatus.BAD_REQUEST, null);
        }

        List<Kho> khoHoatDong = khoRepository.findByTrangThai(1);
        Set<Integer> validKhoIds = khoHoatDong.stream().map(Kho::getId).collect(Collectors.toSet());

        if (request.getDanhSachKho() != null) {
            for (KenhKhoMappingItemDto item : request.getDanhSachKho()) {
                if (item.getKhoIdFCentric() != null && !validKhoIds.contains(item.getKhoIdFCentric())) {
                    throw new CommonException(ThongDiep.of("kenhBan.khoKhongTonTai", item.getKhoIdFCentric()), HttpStatus.BAD_REQUEST, null);
                }
            }
        }

        // Đảm bảo nếu bật đa kho thì có ít nhất 1 kho mặc định
        if (Boolean.TRUE.equals(request.getCheDoDaKho()) && request.getDanhSachKho() != null && !request.getDanhSachKho().isEmpty()) {
            boolean hasDefault = request.getDanhSachKho().stream().anyMatch(item -> Boolean.TRUE.equals(item.getLaMacDinh()));
            if (!hasDefault) {
                request.getDanhSachKho().get(0).setLaMacDinh(true);
            }
        }

        // Lưu vào cấu hình hệ thống
        try {
            String json = objectMapper.writeValueAsString(request);
            dieuHanhHeThongService.setCauHinhString("KENH_" + maKenh.trim().toUpperCase(Locale.ROOT) + "_KHO_MAPPING", json);
        } catch (Exception e) {
            log.error("[KHO-MAPPING] Lỗi lưu cấu hình ánh xạ kho cho kênh {}: {}", maKenh, e.getMessage());
            throw new CommonException(ThongDiep.of("kenhBan.loiLuuCauHinhKho"), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }

        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban,
                String.format("Lưu cấu hình ánh xạ kho kênh %s: Đa kho = %s, Số kho = %d",
                        maKenh, request.getCheDoDaKho(), request.getDanhSachKho() != null ? request.getDanhSachKho().size() : 0));

        return layCauHinhKhoMapping(maKenh);
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
                .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThaySuKienNhatKy", id), HttpStatus.NOT_FOUND, null));
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
        if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            synced = omnichannelOrderSyncJob.syncLazadaOrders(kenh, tu, den);
        } else if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            synced = omnichannelOrderSyncJob.syncShopeeOrders(kenh, tu, den);
        } else if (OmnichannelOrderSyncJob.MA_KENH_TIKTOK.equalsIgnoreCase(kenh.getMaKenh()) || "TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
            synced = omnichannelOrderSyncJob.syncTikTokOrders(kenh, tu, den);
        } else {
            synced = omnichannelOrderSyncJob.syncShopifyOrders(kenh, tu, den);
        }
        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban, "Lấy đơn hàng từ sàn " + maKenh + ": thành công " + synced + " đơn");

        return LayDonResultDto.builder()
                .soDonMoi(synced)
                .soDonCapNhat(0)
                .thongDiep(ThongDiep.dich("kenhBan.nhanDonMoiTuSan", synced, maKenh))
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
            } else if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
                DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
                if (dayTonRes != null) {
                    totalSku += dayTonRes.getSoDong();
                }
                omnichannelOrderSyncJob.syncLazadaOrders(kenh);
            } else if (OmnichannelOrderSyncJob.MA_KENH_TIKTOK.equalsIgnoreCase(kenh.getMaKenh()) || "TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
                DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
                if (dayTonRes != null) {
                    totalSku += dayTonRes.getSoDong();
                }
                omnichannelOrderSyncJob.syncTikTokOrders(kenh);
            } else if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
                DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
                if (dayTonRes != null) {
                    totalSku += dayTonRes.getSoDong();
                }
                omnichannelOrderSyncJob.syncShopeeOrders(kenh, 30);
            }
        }
        return DayTonResultDto.builder()
                .soDong(totalSku)
                .build();
    }

    @Override
    public LienKetSanPhamDto thuLai(Integer lienKetId) {
        TrangThaiDongBoSanPham tt = trangThaiDongBoSanPhamRepository.findById(lienKetId)
                .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThayLienKet", lienKetId), HttpStatus.NOT_FOUND, null));
        kiemTraDaKetNoi(tt.getKenhBanHang());

        KenhBanHang kenhCuaDong = tt.getKenhBanHang();
        ReentrantLock khoa = kenhCuaDong != null ? khoaDayTon.computeIfAbsent(kenhCuaDong.getId(), id -> new ReentrantLock()) : null;
        boolean daKhoa = false;
        if (khoa != null) {
            try {
                daKhoa = khoa.tryLock(5, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {}
            if (!daKhoa) {
                throw new CommonException(ThongDiep.of("kenhBan.dangCoTienTrinhDongBo", kenhCuaDong.getTenKenh()), HttpStatus.CONFLICT, null);
            }
        }
        try {
            BienTheSanPham bt = tt.getBienTheSanPham();
            BigDecimal soLuongKhaDung = BigDecimal.ZERO;
            if (bt != null) {
                // Nếu biến thể chưa có mã sản phẩm trên sàn (do lần tạo trước bị sàn từ chối):
                // Tự động gọi tạo/liên kết lại sản phẩm trên sàn thay vì cố đẩy tồn làm xuất hiện lỗi kỹ thuật Item ID
                if (tt.getMaSanPhamKenh() == null || tt.getMaSanPhamKenh().isBlank()) {
                    if (kenhCuaDong != null && OmnichannelOrderSyncJob.isShopee(kenhCuaDong.getMaKenh())) {
                        log.info("[SHOPEE-RETRY] Biến thể SKU {} chưa có Item ID trên Shopee, tự động tạo/liên kết lại sản phẩm...", bt.getMaSku());
                        tuDongLienKetShopee(kenhCuaDong);
                        tt = trangThaiDongBoSanPhamRepository.findById(lienKetId).orElse(tt);
                    } else if (kenhCuaDong != null && OmnichannelOrderSyncJob.isTikTok(kenhCuaDong.getMaKenh())) {
                        log.info("[TIKTOK-RETRY] Biến thể SKU {} chưa có Product ID trên TikTok Shop, tự động tạo/liên kết lại...", bt.getMaSku());
                        tuDongLienKetTikTok(kenhCuaDong);
                        tt = trangThaiDongBoSanPhamRepository.findById(lienKetId).orElse(tt);
                    } else if (kenhCuaDong != null && OmnichannelOrderSyncJob.isLazada(kenhCuaDong.getMaKenh())) {
                        log.info("[LAZADA-RETRY] Biến thể SKU {} chưa có Item ID trên Lazada, tự động tạo/liên kết lại...", bt.getMaSku());
                        tuDongLienKetLazada(kenhCuaDong);
                        tt = trangThaiDongBoSanPhamRepository.findById(lienKetId).orElse(tt);
                    }
                }

                soLuongKhaDung = khaDungToanChuoi(bt.getId());

                // Nếu sau khi thử liên kết vẫn chưa có mã sản phẩm kênh (sàn tiếp tục từ chối tạo):
                // Giữ nguyên lý do lỗi từ chối tạo của sàn, không gọi đẩy tồn để tránh ghi đè lỗi kỹ thuật
                if (tt.getMaSanPhamKenh() != null && !tt.getMaSanPhamKenh().isBlank()) {
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
                    .trangThaiLienKet(mapStatusToFrontend(tt.getTrangThaiDongBo(), true))
                    .ngayDongBoCuoi(tt.getNgayDongBoCuoi())
                    .chiTietLoi(tt.getChiTietLoi())
                    .build();
        } finally {
            if (daKhoa && khoa != null) {
                khoa.unlock();
            }
        }
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

    /**
     * Ảnh đại diện của từng biến thể theo danh sách ID biến thể, một truy vấn cho cả trang.
     * Biến thể nào chưa có ảnh riêng sẽ để trống để tự động fallback về ảnh sản phẩm cha.
     */
    private Map<Integer, String> anhDaiDienTheoBienThe(Collection<Integer> bienTheIds) {
        if (bienTheIds == null || bienTheIds.isEmpty()) return Map.of();
        Map<Integer, String> ketQua = new HashMap<>();
        try {
            for (AnhBienThe ab : anhBienTheRepository.findActiveByBienTheIds(bienTheIds)) {
                if (ab.getBienThe() == null || ab.getTepTin() == null) continue;
                String url = duongDanAnh(ab.getTepTin());
                if (url != null) ketQua.putIfAbsent(ab.getBienThe().getId(), url);
            }
        } catch (Exception ex) {
            log.warn("Không lấy được ảnh biến thể cho danh sách liên kết: {}", ex.getMessage());
        }
        return ketQua;
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
            errorMsg = tt.getChiTietLoi() != null ? DichCauDaLuu.dich(tt.getChiTietLoi()) : ThongDiep.dich("kenhBan.loiDongBoTonKhoSangSan");
        }

        String skuRef = bt != null ? bt.getMaSku() : tt.getMaSanPhamKenh();
        String message = statusStr.equals("THANH_CONG")
                ? ThongDiep.dich("kenhBan.dongBoTonKhoSkuThanhCong", skuRef)
                : (errorMsg != null ? errorMsg : ThongDiep.dich("kenhBan.choDongBoTonKhoSku", skuRef));

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
        ThongDiep thongDiep = maKenh == null || maKenh.isBlank()
                ? ThongDiep.of("kenhBan.sanNayChuaKetNoi")
                : ThongDiep.of("kenhBan.sanChuaKetNoi", KenhBanHangServiceImpl.tenSanTrongCau(maKenh));
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.KENH_CHUA_KET_NOI, thongDiep);
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
            throw new CommonException(ThongDiep.of("kenhBan.maKenhTrong"), HttpStatus.BAD_REQUEST, null);
        }
        return timKenh(maKenh.trim())
                .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThayKenhBanHang", maKenh), HttpStatus.NOT_FOUND, null));
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

    private String mapStatusToFrontend(String trangThaiDongBo, Boolean choPhepDongBo) {
        if (Boolean.FALSE.equals(choPhepDongBo)) return "chua_lien_ket";
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
                lichSuThayDoiService.createGiaoDichRieng(
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
            throw new LoiTrangThaiException(ThongDiep.of("kenhBan.shopifyTraMaKhiDoc", response.getStatusCode().value(), duongDan));
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
        String currentUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json?limit=250";
        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        int maxPages = 50;
        int page = 0;

        while (currentUrl != null && page < maxPages) {
            page++;
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(currentUrl, HttpMethod.GET, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new LoiTrangThaiException(ThongDiep.of("kenhBan.shopifyTraMaKhiTaiSanPham", response.getStatusCode().value()));
            }
            kiemTraLeakyBucket(response.getHeaders().getFirst("X-Shopify-Shop-Api-Call-Limit"));

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
                                BigDecimal price = null;
                                if (v.hasNonNull("price")) {
                                    try { price = new BigDecimal(v.path("price").asText("0")); } catch (Exception ignored) {}
                                }
                                BigDecimal compareAt = null;
                                if (v.hasNonNull("compare_at_price")) {
                                    try { compareAt = new BigDecimal(v.path("compare_at_price").asText("0")); } catch (Exception ignored) {}
                                }
                                String barcode = v.path("barcode").asText(null);

                                result.put(sku, new ShopifyVariantInfo(
                                        v.path("id").asLong(),
                                        v.path("inventory_item_id").asLong(),
                                        prodId,
                                        imgId,
                                        price,
                                        compareAt,
                                        barcode
                                ));
                            }
                        }
                    }
                }
            }
            currentUrl = trichXuatUrlTrangSau(response.getHeaders().getFirst("Link"));
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

            // Tính giá bán: Phải dùng đúng giá của biến thể đó hoặc giá mặc định của sản phẩm cha, tuyệt đối không gán chéo
            BigDecimal price = bt.getGiaBan();
            if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                if (sp != null && sp.getGiaBanMacDinh() != null && sp.getGiaBanMacDinh().compareTo(BigDecimal.ZERO) > 0) {
                    price = sp.getGiaBanMacDinh();
                } else {
                    throw new CommonException(ThongDiep.of("kenhBan.bienTheChuaCoGiaBan", bt.getMaSku()), HttpStatus.BAD_REQUEST, null);
                }
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

                // Tính giá bán: Phải dùng đúng giá của biến thể đó hoặc giá mặc định của sản phẩm cha, tuyệt đối không gán chéo
                BigDecimal price = bt.getGiaBan();
                if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                    if (sp != null && sp.getGiaBanMacDinh() != null && sp.getGiaBanMacDinh().compareTo(BigDecimal.ZERO) > 0) {
                        price = sp.getGiaBanMacDinh();
                    } else {
                        throw new CommonException(ThongDiep.of("kenhBan.bienTheChuaCoGiaBan", bt.getMaSku()), HttpStatus.BAD_REQUEST, null);
                    }
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
    public record KetQuaGuiTon(boolean thanhCong, boolean loiKenh, String lyDo) {
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
        if (kenh != null && OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            String appKey = kenhBanHangService.getLazadaAppKey(kenh.getMaKenh());
            String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(kenh.getMaKenh());
            String token = kenhBanHangService.getDecryptedLazadaAccessToken(kenh.getMaKenh());
            if (appKey == null || appSecret == null || token == null) {
                return KetNoiDayTon.loi("Chưa có App Key, App Secret hoặc Access Token cho kênh Lazada");
            }
            return new KetNoiDayTon("api.lazada.vn", token, 0L, "Gian hàng Lazada", Map.of(), null);
        }
        if (kenh != null && OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            return new KetNoiDayTon("partner.shopeemobile.com", "shopee_mock_token", 0L, "Gian hàng Shopee", Map.of(), null);
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
        if (dong == null || dong.getBienTheSanPham() == null) return false;
        if (Boolean.FALSE.equals(dong.getChoPhepDongBo())) return false;
        if ("chua_dong_bo".equals(dong.getTrangThaiDongBo()) || "ngung_dong_bo".equals(dong.getTrangThaiDongBo())) return false;
        return "thanh_cong".equals(dong.getTrangThaiDongBo()) || "that_bai".equals(dong.getTrangThaiDongBo());
    }

    /**
     * Gửi số tồn của một dòng liên kết lên Shopify rồi ghi kết quả vào dòng (nơi gọi tự save).
     * Thành công: lưu số và giờ Shopify đã nhận, dòng đang lỗi trở lại "thanh_cong".
     * Lỗi SKU: dòng sang "that_bai" kèm lý do. Lỗi cả gian hàng: không đổi dòng.
     */
    KetQuaGuiTon dayTonChoDong(TrangThaiDongBoSanPham dong, KetNoiDayTon ketNoi, int soDay) {
        KetQuaGuiTon kq;
        if (dong.getKenhBanHang() != null && OmnichannelOrderSyncJob.isLazada(dong.getKenhBanHang().getMaKenh())) {
            kq = guiTonLenLazada(dong, soDay);
        } else if (dong.getKenhBanHang() != null && OmnichannelOrderSyncJob.isShopee(dong.getKenhBanHang().getMaKenh())) {
            kq = guiTonLenShopee(dong, soDay);
        } else if (dong.getKenhBanHang() != null && OmnichannelOrderSyncJob.isTikTok(dong.getKenhBanHang().getMaKenh())) {
            kq = guiTonLenTikTok(dong, soDay);
        } else {
            BienTheSanPham bt = dong.getBienTheSanPham();
            String maSku = bt != null ? bt.getMaSku() : null;
            ShopifyVariantInfo vInfo = maSku == null ? null : ketNoi.skuMap().get(maSku.trim().toLowerCase());
            if (vInfo == null || vInfo.getInventoryItemId() == null || vInfo.getInventoryItemId() <= 0) {
                kq = KetQuaGuiTon.loiSku("Không tìm thấy SKU " + maSku + " trên Shopify");
            } else {
                KenhKhoMappingConfigDto mappingCfg = layCauHinhKhoMappingDaLuu("SHOPIFY");
                if (mappingCfg != null && Boolean.TRUE.equals(mappingCfg.getCheDoDaKho())
                        && mappingCfg.getDanhSachKho() != null && mappingCfg.getDanhSachKho().size() >= 2) {
                    kq = dayTonShopifyDaKho(dong, ketNoi, vInfo, mappingCfg);
                } else {
                    kq = guiTonLenShopify(ketNoi.domain(), ketNoi.token(), ketNoi.locationId(), vInfo.getInventoryItemId(), soDay);
                }
            }
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

    /**
     * Thuật toán phân bổ tồn đệm tỷ lệ (Proportional Buffer Allocation) & Safeguard chống giam tồn.
     */
    public static int tinhSoTonDayPhanBo(
            BigDecimal kdKho,
            BigDecimal tongKhaDung,
            BigDecimal tyLe,
            int tonDemTong,
            int nguongVe0) {
        if (kdKho == null || kdKho.compareTo(BigDecimal.ZERO) <= 0) return 0;
        BigDecimal tl = tyLe != null ? tyLe : BigDecimal.valueOf(100);

        // 1. Tính tồn đệm phân bổ tỷ lệ cho kho này
        int tonDemKho = 0;
        if (tonDemTong > 0 && tongKhaDung != null && tongKhaDung.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal tiTrong = kdKho.divide(tongKhaDung, 4, RoundingMode.HALF_UP);
            tonDemKho = BigDecimal.valueOf(tonDemTong).multiply(tiTrong).setScale(0, RoundingMode.HALF_UP).intValue();
        }

        // 2. Co giãn tồn đệm an toàn khi hàng ít (Dynamic Low-Stock Safeguard)
        // Nếu kho có dưới 5 cái, tồn đệm tối đa không vượt quá floor(kdKho / 2) để không chặn hàng bán
        if (kdKho.compareTo(BigDecimal.valueOf(5)) < 0) {
            int maxDem = kdKho.divide(BigDecimal.valueOf(2), 0, RoundingMode.FLOOR).intValue();
            tonDemKho = Math.min(tonDemKho, Math.max(0, maxDem));
        }

        // 3. Số tồn đẩy = floor(kdKho * tyLe / 100) - tonDemKho
        BigDecimal so = kdKho.multiply(tl).divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR)
                .subtract(BigDecimal.valueOf(tonDemKho));

        if (so.compareTo(BigDecimal.valueOf(nguongVe0)) <= 0 || so.signum() < 0) {
            return 0;
        }
        return so.min(BigDecimal.valueOf(Integer.MAX_VALUE)).intValue();
    }

    KetQuaGuiTon dayTonShopifyDaKho(
            TrangThaiDongBoSanPham dong,
            KetNoiDayTon ketNoi,
            ShopifyVariantInfo vInfo,
            KenhKhoMappingConfigDto mappingCfg) {
        BienTheSanPham bt = dong.getBienTheSanPham();
        if (bt == null || bt.getId() == null) {
            return KetQuaGuiTon.loiSku("Biến thể không hợp lệ");
        }

        List<KenhKhoMappingItemDto> activeMappings = mappingCfg.getDanhSachKho().stream()
                .filter(m -> Boolean.TRUE.equals(m.getKichHoat()) && m.getKhoIdFCentric() != null && m.getMaKhoSan() != null)
                .toList();

        if (activeMappings.isEmpty()) {
            return guiTonLenShopify(ketNoi.domain(), ketNoi.token(), ketNoi.locationId(), vInfo.getInventoryItemId(), 0);
        }

        // 1. Lấy tồn khả dụng thực tế của từng kho FCentric được ánh xạ
        Map<Integer, BigDecimal> tonKhaDungTheoKhoMap = new HashMap<>();
        BigDecimal tongKhaDungCacKho = BigDecimal.ZERO;

        for (KenhKhoMappingItemDto m : activeMappings) {
            Integer khoId = m.getKhoIdFCentric();
            if (!tonKhaDungTheoKhoMap.containsKey(khoId)) {
                List<Object[]> stocks = tonKhoTongHopRepository.sumFreeToUseTheoKhoVaBienTheIds(khoId, List.of(bt.getId()));
                BigDecimal kd = (!stocks.isEmpty() && stocks.get(0)[1] != null) ? (BigDecimal) stocks.get(0)[1] : BigDecimal.ZERO;
                tonKhaDungTheoKhoMap.put(khoId, kd);
            }
            tongKhaDungCacKho = tongKhaDungCacKho.add(tonKhaDungTheoKhoMap.get(khoId));
        }

        // 2. Đọc quy tắc tồn của kênh
        DayTonKenhRequest q = quyTacDaLuu("SHOPIFY");
        BigDecimal tyLe = q.getTyLeDayTon() != null ? q.getTyLeDayTon() : BigDecimal.valueOf(100);
        int tonDemTong = q.getTonDem();
        int nguongVe0 = q.getNguongVe0();

        // 3. Phân bổ tồn đệm và đẩy lên từng Location Shopify
        boolean coItNhatMotKhoThanhCong = false;
        String loiCuoiCung = null;
        int tongSoDayThucTe = 0;

        for (KenhKhoMappingItemDto m : activeMappings) {
            Long locationId;
            try {
                String maSanStr = m.getMaKhoSan().trim();
                if (maSanStr.contains("/")) {
                    maSanStr = maSanStr.substring(maSanStr.lastIndexOf('/') + 1);
                }
                locationId = Long.parseLong(maSanStr);
            } catch (Exception ex) {
                log.warn("[SHOPIFY-MULTI-WH] Mã kho sàn không hợp lệ: {}", m.getMaKhoSan());
                continue;
            }

            BigDecimal kdKho = tonKhaDungTheoKhoMap.getOrDefault(m.getKhoIdFCentric(), BigDecimal.ZERO);
            int soDayKho = tinhSoTonDayPhanBo(kdKho, tongKhaDungCacKho, tyLe, tonDemTong, nguongVe0);

            KetQuaGuiTon subKq = guiTonLenShopify(ketNoi.domain(), ketNoi.token(), locationId, vInfo.getInventoryItemId(), soDayKho);
            if (subKq.thanhCong()) {
                coItNhatMotKhoThanhCong = true;
                tongSoDayThucTe += soDayKho;
                log.info("[SHOPIFY-MULTI-WH] Đẩy tồn thành công cho SKU {} lên Location {} (Kho FCentric {}): {} sp",
                        bt.getMaSku(), locationId, m.getKhoIdFCentric(), soDayKho);
            } else {
                loiCuoiCung = subKq.lyDo();
                log.warn("[SHOPIFY-MULTI-WH] Lỗi đẩy tồn SKU {} lên Location {}: {}",
                        bt.getMaSku(), locationId, subKq.lyDo());
            }
        }

        if (coItNhatMotKhoThanhCong) {
            dong.setSoLuongDaDay(tongSoDayThucTe);
            return KetQuaGuiTon.THANH_CONG;
        } else {
            return KetQuaGuiTon.loiSku(loiCuoiCung != null ? loiCuoiCung : "Không thể cập nhật tồn lên các địa điểm Shopify");
        }
    }

    KetQuaGuiTon guiTonLenShopee(TrangThaiDongBoSanPham dong, int soDay) {
        BienTheSanPham bt = dong.getBienTheSanPham();
        String maSku = bt != null ? bt.getMaSku() : null;
        if (maSku == null || maSku.isBlank()) {
            return KetQuaGuiTon.loiSku("Biến thể chưa có mã SKU");
        }
        KenhBanHang kenh = dong.getKenhBanHang();
        if (kenh == null) {
            kenh = getKenhActive("SHOPEE_SANDBOX");
        }
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClient(kenh);
        String mspk = dong.getMaSanPhamKenh() != null ? dong.getMaSanPhamKenh().trim() : "";
        Long itemId = null;
        Long modelId = 0L;
        if (mspk.contains(":")) {
            String[] parts = mspk.split(":");
            try {
                itemId = Long.parseLong(parts[0]);
                modelId = Long.parseLong(parts[1]);
            } catch (Exception ignored) {}
        } else if (mspk.matches("\\d+")) {
            try {
                itemId = Long.parseLong(mspk);
                modelId = 0L;
            } catch (Exception ignored) {}
        }
        if (itemId == null || itemId <= 0) {
            return KetQuaGuiTon.loiSku("Biến thể chưa liên kết với Item ID hợp lệ trên Shopee");
        }
        try {
            JsonNode res = client.updateStock(itemId, modelId, soDay);
            if (res != null && (res.path("error").asText("").isEmpty() || "0".equals(res.path("error").asText("")))) {
                return KetQuaGuiTon.THANH_CONG;
            } else {
                String rawErr = res != null ? res.path("error").asText("") : "";
                String rawMsg = res != null ? res.path("message").asText("Lỗi cập nhật tồn Shopee") : "";
                String combined = (rawErr + " " + rawMsg).toLowerCase(Locale.ROOT);
                if (combined.contains("status is abnormal") || combined.contains("abnormal")
                        || combined.contains("not exist") || combined.contains("deleted") || combined.contains("not_found")) {
                    xuLySanPhamBiXoaHoacBatThuongShopee(kenh, itemId, null);
                }
                String err = phanLoaiLoiShopee(rawErr, rawMsg);
                return KetQuaGuiTon.loiSku(err);
            }
        } catch (Exception ex) {
            if (ex.getMessage() != null && (ex.getMessage().toLowerCase(Locale.ROOT).contains("abnormal") || ex.getMessage().toLowerCase(Locale.ROOT).contains("not found"))) {
                xuLySanPhamBiXoaHoacBatThuongShopee(kenh, itemId, null);
            }
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.shopeeLoiDayTon", ex.getMessage()));
        }
    }

    KetQuaGuiTon guiTonLenLazada(TrangThaiDongBoSanPham dong, int soDay) {
        BienTheSanPham bt = dong.getBienTheSanPham();
        String maSku = bt != null ? bt.getMaSku() : null;
        if (maSku == null || maSku.isBlank()) {
            return KetQuaGuiTon.loiSku("Biến thể chưa có mã SKU");
        }
        String maKenhBan = (dong.getKenhBanHang() != null && dong.getKenhBanHang().getMaKenh() != null)
                ? dong.getKenhBanHang().getMaKenh() : "LAZADA";
        String appKey = kenhBanHangService.getLazadaAppKey(maKenhBan);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenhBan);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenhBan);
        if (appKey == null || appSecret == null || token == null) {
            return KetQuaGuiTon.loiCaKenh("Chưa có cấu hình hoặc Access Token cho kênh Lazada");
        }

        String skuIdKenh = dong.getMaSanPhamKenh() != null ? dong.getMaSanPhamKenh().trim() : "";
        if (skuIdKenh.isBlank() || !skuIdKenh.matches("\\d+")) {
            String resolvedSkuId = traCuuLazadaSkuId(appKey, appSecret, token, maSku);
            if (resolvedSkuId != null && !resolvedSkuId.isBlank() && resolvedSkuId.matches("\\d+")) {
                skuIdKenh = resolvedSkuId;
                dong.setMaSanPhamKenh(skuIdKenh);
                trangThaiDongBoSanPhamRepository.save(dong);
            } else {
                SanPhamQuanAo sp = bt.getSanPham();
                KenhBanHang kenh = dong.getKenhBanHang();
                if (sp != null && kenh != null) {
                    log.info("[LAZADA-AUTO-HEAL] Biến thể [{}] chưa có SkuId số. Tự động gọi tạo sản phẩm [{}] lên Lazada...", maSku, sp.getTenSanPham());
                    List<BienTheSanPham> spVars = bienTheSanPhamRepository.findBySanPham_Id(sp.getId()).stream()
                            .filter(v -> v != null && v.getTrangThai() != null && v.getTrangThai() == 1)
                            .toList();
                    if (spVars == null || spVars.isEmpty()) {
                        spVars = List.of(bt);
                    }
                    Map<String, String> created = taoSanPhamLenLazada(kenh, sp, spVars, appKey, appSecret, token, new HashMap<>());
                    String createdId = created.get(maSku.toLowerCase(Locale.ROOT));
                    if (createdId != null && createdId.matches("\\d+")) {
                        skuIdKenh = createdId;
                        dong.setMaSanPhamKenh(skuIdKenh);
                        trangThaiDongBoSanPhamRepository.save(dong);
                        for (BienTheSanPham otherBt : spVars) {
                            if (otherBt.getId() != null && !otherBt.getId().equals(bt.getId()) && otherBt.getMaSku() != null) {
                                String oId = created.get(otherBt.getMaSku().toLowerCase(Locale.ROOT));
                                if (oId != null && oId.matches("\\d+")) {
                                    trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), otherBt.getId())
                                            .ifPresent(oDong -> {
                                                oDong.setMaSanPhamKenh(oId);
                                                trangThaiDongBoSanPhamRepository.save(oDong);
                                            });
                                }
                            }
                        }
                    }
                }
            }
        }
        if (skuIdKenh.isBlank() || !skuIdKenh.matches("\\d+")) {
            String lyDoHienTai = dong.getChiTietLoi();
            if (lyDoHienTai != null && !lyDoHienTai.isBlank() && !lyDoHienTai.contains("Tự động liên kết")) {
                return KetQuaGuiTon.loiSku(lyDoHienTai);
            }
            return KetQuaGuiTon.loiSku("Sản phẩm chưa được tạo thành công trên Lazada. Vui lòng bấm 'Đưa sản phẩm FCentric lên Lazada' để tạo lại.");
        }

        StringBuilder skuXml = new StringBuilder();
        skuXml.append("<Request><Product><Skus><Sku>");
        skuXml.append("<SkuId>").append(escapeXml(skuIdKenh)).append("</SkuId>");
        skuXml.append("<Quantity>").append(Math.max(0, soDay)).append("</Quantity>");
        if (bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0) {
            skuXml.append("<Price>").append(bt.getGiaBan().setScale(2, RoundingMode.HALF_UP)).append("</Price>");
        }
        skuXml.append("</Sku></Skus></Product></Request>");

        try {
            JsonNode res = lazadaClient.updatePriceQuantity(appKey, appSecret, token, skuXml.toString());
            String code = res.path("code").asText("");
            if ("0".equals(code)) {
                return KetQuaGuiTon.THANH_CONG;
            } else {
                String msg = res.path("message").asText(res.path("sub_message").asText("Lỗi từ Lazada"));
                if (res.has("detail") && res.path("detail").isArray() && !res.path("detail").isEmpty()) {
                    msg += " - " + res.path("detail").get(0).path("message").asText("");
                }
                return KetQuaGuiTon.loiSku(dichLoiLazada(code, msg));
            }
        } catch (Exception ex) {
            log.warn("Lỗi khi đẩy tồn Lazada cho SkuId [{}]: {}", skuIdKenh, ex.getMessage());
            return KetQuaGuiTon.loiCaKenh("Lỗi kết nối tới Lazada: " + ex.getMessage());
        }
    }

    KetQuaGuiTon guiTonLenTikTok(TrangThaiDongBoSanPham dong, int soDay) {
        BienTheSanPham bt = dong.getBienTheSanPham();
        String maSku = bt != null ? bt.getMaSku() : null;
        if (maSku == null || maSku.isBlank()) {
            return KetQuaGuiTon.loiSku("Biến thể chưa có mã SKU");
        }
        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();
        if (appKey == null || appSecret == null || token == null || cipher == null || cipher.isBlank()) {
            return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokThieuUyQuyenShopCipher"));
        }

        // Lấy warehouse bán hàng (chỉ nhận SALES_WAREHOUSE, loại trừ hoàn toàn RETURN_WAREHOUSE)
        String warehouseId = xacDinhTikTokSalesWarehouseId(appKey, appSecret, token, cipher, "TIKTOK");

        // Tra cứu Product ID và Sku ID từ cache danh mục TikTok (tiết kiệm quota API sàn)
        TikTokCatalogCache catalog = layHoacCapNhatTikTokCatalog(appKey, appSecret, token, cipher, false);
        String prodId = catalog.skuToProductId().get(maSku.trim().toLowerCase());
        if (prodId == null) {
            prodId = catalog.skuToProductId().get(maSku.trim());
        }
        if (prodId == null && dong.getMaSanPhamKenh() != null) {
            prodId = catalog.skuToProductId().get(dong.getMaSanPhamKenh().trim().toLowerCase());
            if (prodId == null) {
                prodId = catalog.skuToProductId().get(dong.getMaSanPhamKenh().trim());
            }
        }

        String actualSkuId = catalog.skuToSkuId().get(maSku.trim().toLowerCase());
        if (actualSkuId == null) {
            actualSkuId = catalog.skuToSkuId().get(maSku.trim());
        }
        if (actualSkuId == null && dong.getMaSanPhamKenh() != null) {
            actualSkuId = catalog.skuToSkuId().get(dong.getMaSanPhamKenh().trim().toLowerCase());
            if (actualSkuId == null) {
                actualSkuId = catalog.skuToSkuId().get(dong.getMaSanPhamKenh().trim());
            }
        }
        if ((actualSkuId == null || !actualSkuId.matches("\\d+"))
                && dong.getMaSanPhamKenh() != null && dong.getMaSanPhamKenh().matches("\\d+")) {
            actualSkuId = dong.getMaSanPhamKenh().trim();
        }

        // Nếu chưa tìm thấy prodId, thử tìm từ các biến thể anh em cùng sản phẩm cha (vì cùng 1 sản phẩm trên TikTok Shop)
        if ((prodId == null || !prodId.matches("\\d+"))
                && dong.getBienTheSanPham() != null && dong.getBienTheSanPham().getSanPham() != null
                && dong.getBienTheSanPham().getSanPham().getId() != null) {
            List<BienTheSanPham> siblings = bienTheSanPhamRepository.findBySanPham_Id(dong.getBienTheSanPham().getSanPham().getId());
            if (siblings != null) {
                for (BienTheSanPham sibling : siblings) {
                    if (sibling.getMaSku() != null) {
                        String sibProdId = catalog.skuToProductId().get(sibling.getMaSku().trim().toLowerCase());
                        if (sibProdId != null && sibProdId.matches("\\d+")) {
                            prodId = sibProdId;
                            catalog.skuToProductId().put(maSku.trim().toLowerCase(), prodId);
                            catalog.skuToProductId().put(maSku.trim(), prodId);
                            break;
                        }
                    }
                }
            }
        }

        if (prodId == null || !prodId.matches("\\d+")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokKhongTimThayProductId", maSku));
        }
        if (actualSkuId == null || !actualSkuId.matches("\\d+")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokKhongTimThaySkuId", maSku));
        }

        TikTokInventoryUpdateRequest updateReq = TikTokInventoryUpdateRequest.builder()
                .skus(List.of(TikTokInventoryUpdateRequest.SkuInventory.builder()
                        .id(actualSkuId)
                        .inventory(List.of(TikTokInventoryUpdateRequest.WarehouseQuantity.builder()
                                .warehouseId(warehouseId)
                                .quantity(Math.max(0, soDay))
                                .build()))
                        .build()))
                .build();

        try {
            TikTokInventoryUpdateResponse res = getTikTokShopClient()
                    .updateProductInventory(appKey, appSecret, token, cipher, prodId, updateReq);
            if (res != null && res.getCode() == 0) {
                return KetQuaGuiTon.THANH_CONG;
            } else {
                int errCode = res != null && res.getCode() != null ? res.getCode() : -1;
                String errMsg = res != null ? res.getMessage() : "";
                if (errCode == 12052557 || errMsg.toLowerCase(Locale.ROOT).contains("not belong to the product")) {
                    log.warn("[TIKTOK-HEALING] SKU {} không thuộc sản phẩm {} trên TikTok Shop. Tự động xóa liên kết trong DB và giải phóng RAM cache...", actualSkuId, prodId);
                    dong.setMaSanPhamKenh(null);
                    dong.setTrangThaiDongBo("chua_dong_bo");
                    trangThaiDongBoSanPhamRepository.save(dong);
                    tikTokCatalogCacheRef.set(null);
                }
                return phanLoaiLoiTikTok(errCode, errMsg, null);
            }
        } catch (LoiCoMaException e) {
            if (MaLoi.TIKTOK_RATE_LIMIT.equals(e.getMa())) {
                return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokVuotTanSuat429"));
            }
            return phanLoaiLoiTikTok(-1, e.getMessage(), null);
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            return phanLoaiLoiTikTok(e.getStatusCode().value(), e.getStatusText(), e.getResponseBodyAsString());
        } catch (org.springframework.web.client.ResourceAccessException e) {
            return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokLoiKetNoi", e.getMessage()));
        } catch (Exception ex) {
            log.warn("Lỗi khi đẩy tồn TikTok cho SkuId [{}]: {}", actualSkuId, ex.getMessage());
            return phanLoaiLoiTikTok(-1, ex.getMessage(), null);
        }
    }

    private static StringBuilder buildLazadaBatchXml(List<DongCanCapNhat> list) {
        StringBuilder sb = new StringBuilder("<Request><Product><Skus>");
        for (DongCanCapNhat item : list) {
            if (item.skuId() == null || !item.skuId().matches("\\d+")) {
                continue;
            }
            sb.append("<Sku>");
            sb.append("<SkuId>").append(escapeXml(item.skuId())).append("</SkuId>");
            sb.append("<Quantity>").append(Math.max(0, item.soDay())).append("</Quantity>");
            BienTheSanPham bt = item.dong().getBienTheSanPham();
            if (bt != null && bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0) {
                sb.append("<Price>").append(bt.getGiaBan().setScale(2, RoundingMode.HALF_UP)).append("</Price>");
            }
            sb.append("</Sku>");
        }
        sb.append("</Skus></Product></Request>");
        return sb;
    }

    private static DongCanCapNhat timSkuViPhamNegativeSellable(List<DongCanCapNhat> batch, JsonNode res, String detailMsg) {
        String failingId = null;
        String failingEntityId = null;
        String failingSellerSku = null;

        if (res.has("detail") && res.path("detail").isArray()) {
            for (JsonNode d : res.path("detail")) {
                String dMsg = d.path("message").asText("");
                String sSku = d.path("seller_sku").asText("");
                if (!sSku.isBlank()) failingSellerSku = sSku.trim();
                java.util.regex.Matcher mId = java.util.regex.Pattern.compile("id=(\\d+)").matcher(dMsg);
                if (mId.find()) failingId = mId.group(1);
                java.util.regex.Matcher mEnt = java.util.regex.Pattern.compile("entityId=(\\d+)").matcher(dMsg);
                if (mEnt.find()) failingEntityId = mEnt.group(1);
            }
        }
        if (failingId == null && detailMsg != null) {
            java.util.regex.Matcher mId = java.util.regex.Pattern.compile("id=(\\d+)").matcher(detailMsg);
            if (mId.find()) failingId = mId.group(1);
            java.util.regex.Matcher mEnt = java.util.regex.Pattern.compile("entityId=(\\d+)").matcher(detailMsg);
            if (mEnt.find()) failingEntityId = mEnt.group(1);
        }

        for (DongCanCapNhat item : batch) {
            if (failingSellerSku != null && failingSellerSku.equalsIgnoreCase(item.sellerSku())) return item;
            if (failingId != null && failingId.equals(item.skuId())) return item;
            if (failingEntityId != null && failingEntityId.equals(item.skuId())) return item;
        }

        return batch.stream().filter(it -> it.soDay() == 0).findFirst().orElse(null);
    }

    public static String dichLoiLazada(String code, String rawMsg) {
        if (rawMsg == null) rawMsg = "";
        String lower = rawMsg.toLowerCase(Locale.ROOT);
        if (lower.contains("negative sellable")) {
            return "Lazada đang tạm giữ tồn cho đơn chờ thanh toán hoặc chiến dịch khuyến mãi. Hệ thống sẽ tự động đồng bộ khi sàn giải phóng tồn.";
        }
        if (code.contains("AppCallLimit") || lower.contains("exceeds the limit") || lower.contains("call limit") || lower.contains("429")) {
            return "Sàn Lazada tạm thời quá tải tần suất gọi API. Hệ thống sẽ tự động thử lại sau ít phút.";
        }
        if (lower.contains("incomplete sku") || lower.contains("package") || lower.contains("missing required")) {
            return "Biến thể thiếu thông tin bắt buộc (cân nặng/kích thước đóng gói) trên Lazada Seller Center.";
        }
        if (lower.contains("invalid access token") || lower.contains("token expired") || lower.contains("illegal access token")) {
            return "Ủy quyền kết nối Lazada đã hết hạn. Vui lòng bấm 'Ủy quyền lại' ở đầu trang.";
        }
        if (code.contains("501") || lower.contains("sellersku parameter is no longer supported") || lower.contains("use skuid")) {
            return "Lazada yêu cầu sử dụng mã SkuId số. Hệ thống đang tự động tra cứu SkuId từ sàn để đồng bộ lại.";
        }
        if (lower.contains("saleprop_and_old_param_repeat") || lower.contains("old way")
                || (lower.contains("saleprop") && lower.contains("repeat"))) {
            return "Cấu hình thuộc tính phân loại bán hàng của Lazada chưa hợp lệ. Vui lòng bấm 'Thử lại' để hệ thống đồng bộ lại.";
        }
        if (lower.contains("mandatory") || lower.contains("is require")) {
            return "Lazada yêu cầu bổ sung thuộc tính bắt buộc: " + rawMsg;
        }
        if (lower.contains("timeout") || lower.contains("connect") || lower.contains("connection")) {
            return "Lỗi kết nối tới sàn Lazada. Hệ thống sẽ tự động thử lại sau.";
        }
        return rawMsg.startsWith("E") || rawMsg.startsWith("Lazada") ? rawMsg : ("Lazada từ chối (" + code + "): " + rawMsg);
    }

    private Map<String, String> layMapSellerSkuToSkuIdLazada(String appKey, String appSecret, String token) {
        Map<String, String> map = new HashMap<>();
        try {
            int offset = 0;
            int limit = 50;
            while (offset < 500) {
                JsonNode res = lazadaClient.getProducts(appKey, appSecret, token, "all", limit, offset);
                if (!"0".equals(res.path("code").asText(""))) break;
                JsonNode products = res.path("data").path("products");
                if (!products.isArray() || products.isEmpty()) break;
                for (JsonNode prodNode : products) {
                    JsonNode skus = prodNode.path("skus");
                    if (skus.isArray()) {
                        for (JsonNode skuNode : skus) {
                            String sSku = skuNode.path("SellerSku").asText("").trim();
                            if (sSku.isBlank()) sSku = skuNode.path("seller_sku").asText("").trim();
                            if (sSku.isBlank()) sSku = skuNode.path("ShopSku").asText("").trim();

                            String skuId = skuNode.path("SkuId").asText("").trim();
                            if (skuId.isBlank()) skuId = skuNode.path("sku_id").asText("").trim();
                            if ((skuId.isBlank() || !skuId.matches("\\d+")) && skuNode.hasNonNull("ShopSku")) {
                                String shopSku = skuNode.path("ShopSku").asText("").trim();
                                if (shopSku.contains("-")) {
                                    String tail = shopSku.substring(shopSku.lastIndexOf('-') + 1).trim();
                                    if (tail.matches("\\d+")) skuId = tail;
                                }
                            }

                            if (!sSku.isBlank() && !skuId.isBlank() && skuId.matches("\\d+")) {
                                map.put(sSku.toLowerCase(Locale.ROOT), skuId);
                            }
                        }
                    }
                }
                if (products.size() < limit) break;
                offset += limit;
            }
        } catch (Exception e) {
            log.warn("[LAZADA-LOOKUP-MAP] Lỗi tra cứu danh sách SkuId từ Lazada: {}", e.getMessage());
        }
        return map;
    }

    private String traCuuLazadaSkuId(String appKey, String appSecret, String token, String sellerSku) {
        if (sellerSku == null || sellerSku.isBlank()) return null;
        String target = sellerSku.trim().toLowerCase(Locale.ROOT);
        try {
            // 1. Thử tra cứu nhanh trực tiếp qua API /products/get với sku_seller_list
            JsonNode quickRes = lazadaClient.getProductsBySellerSkus(appKey, appSecret, token, List.of(sellerSku.trim()));
            if (quickRes != null && "0".equals(quickRes.path("code").asText(""))) {
                JsonNode products = quickRes.path("data").path("products");
                if (products.isArray() && !products.isEmpty()) {
                    for (JsonNode prodNode : products) {
                        JsonNode skus = prodNode.path("skus");
                        if (skus.isArray()) {
                            for (JsonNode skuNode : skus) {
                                String sSku = skuNode.path("SellerSku").asText("").trim();
                                if (sSku.isBlank()) sSku = skuNode.path("seller_sku").asText("").trim();
                                if (sSku.isBlank()) sSku = skuNode.path("ShopSku").asText("").trim();
                                if (target.equalsIgnoreCase(sSku)) {
                                    String skuId = skuNode.path("SkuId").asText("").trim();
                                    if (skuId.isBlank()) skuId = skuNode.path("sku_id").asText("").trim();
                                    if ((skuId.isBlank() || !skuId.matches("\\d+")) && skuNode.hasNonNull("ShopSku")) {
                                        String shopSku = skuNode.path("ShopSku").asText("").trim();
                                        if (shopSku.contains("-")) {
                                            String tail = shopSku.substring(shopSku.lastIndexOf('-') + 1).trim();
                                            if (tail.matches("\\d+")) skuId = tail;
                                        }
                                    }
                                    if (!skuId.isBlank() && skuId.matches("\\d+")) return skuId;
                                }
                            }
                        }
                    }
                }
            }

            // 2. Fallback duyệt phân trang danh sách sản phẩm
            int offset = 0;
            int limit = 50;
            while (offset < 500) {
                JsonNode res = lazadaClient.getProducts(appKey, appSecret, token, "all", limit, offset);
                if (!"0".equals(res.path("code").asText(""))) break;
                JsonNode products = res.path("data").path("products");
                if (!products.isArray() || products.isEmpty()) break;
                for (JsonNode prodNode : products) {
                    JsonNode skus = prodNode.path("skus");
                    if (skus.isArray()) {
                        for (JsonNode skuNode : skus) {
                            String sSku = skuNode.path("SellerSku").asText("").trim();
                            if (sSku.isBlank()) sSku = skuNode.path("seller_sku").asText("").trim();
                            if (sSku.isBlank()) sSku = skuNode.path("ShopSku").asText("").trim();
                            if (target.equalsIgnoreCase(sSku)) {
                                String skuId = skuNode.path("SkuId").asText("").trim();
                                if (skuId.isBlank()) skuId = skuNode.path("sku_id").asText("").trim();
                                if ((skuId.isBlank() || !skuId.matches("\\d+")) && skuNode.hasNonNull("ShopSku")) {
                                    String shopSku = skuNode.path("ShopSku").asText("").trim();
                                    if (shopSku.contains("-")) {
                                        String tail = shopSku.substring(shopSku.lastIndexOf('-') + 1).trim();
                                        if (tail.matches("\\d+")) skuId = tail;
                                    }
                                }
                                if (!skuId.isBlank() && skuId.matches("\\d+")) return skuId;
                            }
                        }
                    }
                }
                if (products.size() < limit) break;
                offset += limit;
            }
        } catch (Exception e) {
            log.warn("[LAZADA-LOOKUP-SKUID] Lỗi tra cứu SkuId cho {}: {}", sellerSku, e.getMessage());
        }
        return null;
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
                return KetQuaGuiTon.loiSku("Shopify không nhận số tồn kho.");
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
                return KetQuaGuiTon.loiSku("Lỗi kết nối tới sàn Shopify. Hệ thống sẽ tự động thử lại.");
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
            return KetQuaGuiTon.loiCaKenh("Shopify đang gặp sự cố kết nối, vui lòng thử lại sau");
        }
        String chiTiet = loiTuShopify(body);
        if (chiTiet != null) {
            String lower = chiTiet.toLowerCase(Locale.ROOT);
            if (lower.contains("cannot be tracked") || lower.contains("not tracked")) {
                chiTiet = "Sản phẩm đang tắt tính năng theo dõi tồn kho (Track quantity) trên Shopify.";
            } else if (lower.contains("does not exist at location") || lower.contains("location")) {
                chiTiet = "Biến thể chưa được kích hoạt theo dõi tại vị trí kho mặc định trên Shopify.";
            }
        }
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

    /**
     * Phân loại mã lỗi nghiệp vụ và thông điệp từ sàn TikTok Shop thành thông điệp tiếng Việt trực quan,
     * hướng dẫn người dùng hành động thay vì hiển thị thuật ngữ kỹ thuật thô.
     */
    public KetQuaGuiTon phanLoaiLoiTikTok(int code, String message, String rawBody) {
        String combined = ((message != null ? message : "") + " " + (rawBody != null ? rawBody : "")).toLowerCase(Locale.ROOT);

        // 1. Lỗi xác thực và ủy quyền (Token hết hạn / Shop Cipher)
        if (code == 105001 || code == 105002 || combined.contains("token expired") || combined.contains("access_token")
                || combined.contains("shop_cipher is invalid") || code == 401 || code == 403) {
            return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokUyQuyenHetHan"));
        }

        // 2. Lỗi tần suất gọi API (Rate limit)
        if (code == 429 || code == 105003 || combined.contains("too many requests") || combined.contains("rate limit")
                || combined.contains("frequency limit")) {
            return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokVuotTanSuat429"));
        }

        // 3. Lỗi kho hàng (Chọn nhầm kho trả hàng hoặc kho không khả dụng)
        if (code == 12052532 || combined.contains("warehouse_id") || combined.contains("get warehouse list")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiKhoHang"));
        }

        // 4. Lỗi vi phạm thương hiệu / nhãn hiệu bảo hộ
        if (code == 12052106 || code == 12052107 || combined.contains("thương hiệu khác") || combined.contains("brand")
                || combined.contains("trademark") || combined.contains("infringement") || combined.contains("vi phạm")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokViPhamThuongHieu"));
        }

        // 5. Lỗi thuộc tính Nghị định 85 (Đơn vị chịu trách nhiệm hàng hóa ID 101489, 101490)
        if (combined.contains("101489") || combined.contains("101490") || combined.contains("tổ chức chịu trách nhiệm")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokThieuNghiDinh85"));
        }

        // 6. Lỗi thuộc tính Quốc gia xuất xứ (ID 100149)
        if (combined.contains("100149") || combined.contains("quốc gia xuất xứ") || combined.contains("country of origin")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokThieuXuatXu"));
        }

        // 7. Lỗi thuộc tính bắt buộc khác
        if (code == 12052104 || combined.contains("missing product attribute")) {
            String attrName = trichXuatTenThuocTinh(message != null ? message : rawBody);
            return KetQuaGuiTon.loiSku(attrName != null && !attrName.isBlank()
                    ? ThongDiep.vi("hienThiKenhPos.tiktokThieuThuocTinh", attrName)
                    : ThongDiep.vi("hienThiKenhPos.tiktokThieuThuocTinh", "Cơ bản"));
        }

        // 8. Lỗi bảng quy đổi kích cỡ (Size Chart)
        if (code == 12052673 || combined.contains("size_chart_image is required") || combined.contains("size_chart")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokThieuSizeChart"));
        }
        if (code == 12052670 || combined.contains("invalid size chart image")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiSizeChart"));
        }

        // 9. Lỗi trùng lặp tổ hợp biến thể (Sales Attribute)
        if (code == 12052251 || combined.contains("sale attribute") || combined.contains("already in use")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokTrungBienThe"));
        }

        // 10. Lỗi trạng thái phê duyệt sản phẩm trên sàn
        if (code == 12052528 || combined.contains("under_review") || combined.contains("rejected") || combined.contains("status is not active")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokChoPheDuyet"));
        }

        // 11. Lỗi trạng thái sản phẩm không hợp lệ để thao tác (Precondition Required / Suspended / Freeze mã 12052901)
        if (code == 12052901 || combined.contains("frozen") || combined.contains("suspended")
                || combined.contains("precondition required") || combined.contains("valid product status")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokTrangThaiKhongHopLe"));
        }

        // 12. Lỗi chưa tìm thấy Product ID hoặc SKU ID
        if (code == 12052529 || code == 12052530 || combined.contains("product not found") || combined.contains("sku not found")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokChuaTimThaySanPham"));
        }

        // 12. Lỗi ảnh sản phẩm
        if (code == 12052300 || combined.contains("image uri") || combined.contains("upload image")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiAnh"));
        }

        // 13. Lỗi tồn kho và giá bán
        if (code == 12052533 || code == 12052400 || combined.contains("stock must be") || combined.contains("price is invalid")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiTonGia"));
        }

        // 14. Lỗi mã SKU không thuộc về sản phẩm (12052557)
        if (code == 12052557 || combined.contains("12052557") || combined.contains("not belong to the product")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokSkuKhongThuocSanPham"));
        }

        // Fallback: Nếu có message chi tiết
        if (message != null && !message.isBlank()) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokTuChoiSoTonChiTiet", message));
        }
        return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiKhongXacDinh"));
    }

    private static String trichXuatTenThuocTinh(String text) {
        if (text == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("['\"]([^'\"]+)['\"]").matcher(text);
        if (m.find()) {
            return m.group(1);
        }
        return null;
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

    @Override
    public boolean dongBoTrangThaiDangThucHienShopify(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY)
                .or(() -> kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY.toLowerCase()))
                .orElse(null);
        if (kenh == null) return false;

        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            log.warn("[SHOPIFY-IN_PROGRESS] Không có Access Token hợp lệ cho đơn {}", maDonHangKenh);
            return false;
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            return false;
        }

        // 1. Cố gắng cập nhật trạng thái fulfillment order gốc IN_PROGRESS qua GraphQL
        boolean graphQlOk = shopifyOrderProgressClient.reportProgress(domain, token, maDonHangKenh);
        if (graphQlOk) {
            log.info("[SHOPIFY-IN_PROGRESS] Shopify xác nhận IN_PROGRESS qua GraphQL cho đơn {}", maDonHangKenh);
        } else {
            if (shopifyWebhookInbox != null) shopifyWebhookInbox.retryProgress(domain, maDonHangKenh);
            log.warn("[SHOPIFY-IN_PROGRESS] GraphQL progress chưa được xác nhận trên đơn {}, kích hoạt cập nhật Tag và Timeline Note theo chuẩn Sapo/Haravan", maDonHangKenh);
        }

        // 2. BẮT BUỘC cập nhật Order Tag và Timeline Note để hiển thị rõ ràng trên Shopify Admin
        capNhatTagVaNoteShopify(domain, token, maDonHangKenh, "Đang thực hiện",
                List.of("Đã hủy", "Đã giao"),
                "FCentric: Đơn hàng đang được chuẩn bị và nhặt tại kho FCentric");
        return graphQlOk;
    }

    @Override
    public boolean dongBoTrangThaiFulfilledShopify(Integer donId, String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY)
                .or(() -> kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY.toLowerCase()))
                .orElse(null);
        if (kenh == null) return false;

        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            log.warn("[SHOPIFY-FULFILL] Không có Access Token hợp lệ cho đơn {}", maDonHangKenh);
            return false;
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            return false;
        }

        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        try {
            // 1. Lấy danh sách fulfillment orders có thể hoàn tất kèm chi tiết line_items
            String foUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + maDonHangKenh + "/fulfillment_orders.json";
            ResponseEntity<String> foRes = restTemplate.exchange(foUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            List<Map<String, Object>> lineItemsByFo = new ArrayList<>();
            if (foRes.getStatusCode().is2xxSuccessful() && foRes.getBody() != null) {
                JsonNode root = objectMapper.readTree(foRes.getBody());
                JsonNode foList = root.path("fulfillment_orders");
                if (foList.isArray()) {
                    for (JsonNode fo : foList) {
                        String st = fo.path("status").asText("").trim().toLowerCase(Locale.ROOT);
                        long foId = fo.path("id").asLong();
                        if (("open".equalsIgnoreCase(st) || "in_progress".equalsIgnoreCase(st)) && foId > 0) {
                            List<Map<String, Object>> foLineItems = new ArrayList<>();
                            JsonNode itemsNode = fo.path("line_items");
                            if (itemsNode.isArray()) {
                                for (JsonNode it : itemsNode) {
                                    long itemId = it.path("id").asLong();
                                    int fulfillableQty = it.path("fulfillable_quantity").asInt(it.path("quantity").asInt(1));
                                    if (itemId > 0 && fulfillableQty > 0) {
                                        foLineItems.add(Map.of("id", itemId, "quantity", fulfillableQty));
                                    }
                                }
                            }
                            if (foLineItems.isEmpty()) continue;
                            Map<String, Object> foEntry = new LinkedHashMap<>();
                            foEntry.put("fulfillment_order_id", foId);
                            if (!foLineItems.isEmpty()) {
                                foEntry.put("fulfillment_order_line_items", foLineItems);
                            }
                            lineItemsByFo.add(foEntry);
                        }
                    }
                }
            }

            if (lineItemsByFo.isEmpty()) {
                // Không có dòng đủ điều kiện cũng có thể do thiếu quyền hoặc đơn đang bị giữ.
                // Chỉ nhận đã hoàn tất khi trạng thái gốc của đơn xác nhận điều đó.
                if (!shopifyDaHoanTatDon(restTemplate, domain, headers, maDonHangKenh)) return false;
                capNhatTagVaNoteShopify(domain, token, maDonHangKenh, "Đã hoàn tất",
                        List.of("Đang thực hiện", "Chờ đóng gói", "Chờ xuất kho"),
                        "FCentric: Đã xác nhận hoàn tất đơn hàng");
                return true;
            }

            // 2. Tìm thông tin vận đơn
            DonBanHang don = donId != null ? donBanHangRepository.findById(donId).orElse(null) : null;
            String trackingNumber = null;
            String trackingCompany = "FCentric Logistics";
            if (don != null && don.getGhiChu() != null) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\[VẬN ĐƠN:\\s*([^\\-\\]]+)(?:\\s*-\\s*([^\\]]+))?\\]").matcher(don.getGhiChu());
                if (m.find()) {
                    trackingNumber = m.group(1).trim();
                    if (m.group(2) != null && !m.group(2).isBlank()) {
                        trackingCompany = m.group(2).trim();
                    }
                }
            }
            if (trackingNumber == null || trackingNumber.isBlank()) {
                trackingNumber = "FCX-" + (don != null ? don.getSoDonHang() : maDonHangKenh);
            }

            // 3. Tạo fulfillment trên Shopify
            String fulfillUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/fulfillments.json";
            Map<String, Object> fulfillmentObj = new LinkedHashMap<>();
            fulfillmentObj.put("message", "Đã xuất kho toàn bộ từ kho FCentric");
            fulfillmentObj.put("notify_customer", false);
            fulfillmentObj.put("tracking_info", Map.of(
                    "company", trackingCompany,
                    "number", trackingNumber
            ));
            fulfillmentObj.put("line_items_by_fulfillment_order", lineItemsByFo);

            Map<String, Object> reqBody = Map.of("fulfillment", fulfillmentObj);
            ResponseEntity<String> res = restTemplate.exchange(fulfillUrl, HttpMethod.POST, new HttpEntity<>(reqBody, headers), String.class);
            boolean fulfillSuccess = false;
            if (res.getStatusCode().is2xxSuccessful() && res.getBody() != null) {
                JsonNode resRoot = objectMapper.readTree(res.getBody());
                long fId = resRoot.path("fulfillment").path("id").asLong();
                if (fId > 0) {
                    fulfillSuccess = true;
                }
            }
            if (fulfillSuccess) {
                log.info("[SHOPIFY-FULFILL] Tạo fulfillment thành công cho đơn {} trên Shopify (tracking: {}, carrier: {})",
                        maDonHangKenh, trackingNumber, trackingCompany);
                capNhatTagVaNoteShopify(domain, token, maDonHangKenh, "Đã hoàn tất",
                        List.of("Đang thực hiện", "Chờ đóng gói", "Chờ xuất kho"),
                        "FCentric: Đã xuất kho thành công (Vận đơn: " + trackingNumber + " - " + trackingCompany + ")");
                return true;
            }
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            if (e.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY && e.getResponseBodyAsString().contains("already")) {
                if (!shopifyDaHoanTatDon(restTemplate, domain, headers, maDonHangKenh)) return false;
                log.info("[SHOPIFY-FULFILL] Đơn hàng {} đã được fulfilled trước đó trên Shopify", maDonHangKenh);
                capNhatTagVaNoteShopify(domain, token, maDonHangKenh, "Đã hoàn tất",
                        List.of("Đang thực hiện", "Chờ đóng gói", "Chờ xuất kho"),
                        "FCentric: Đơn hàng đã hoàn tất trước đó");
                return true;
            }
            log.warn("[SHOPIFY-FULFILL] Lỗi HTTP khi tạo fulfillment đơn {}: {} - {}", maDonHangKenh, e.getStatusCode(), e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("[SHOPIFY-FULFILL] Lỗi kết nối khi tạo fulfillment đơn {}: {}", maDonHangKenh, e.getMessage());
        }
        return false;
    }

    private boolean shopifyDaHoanTatDon(RestTemplate restTemplate, String domain, HttpHeaders headers, String orderId) {
        try {
            String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION
                    + "/orders/" + orderId + ".json?fields=id,fulfillment_status";
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            return response.getStatusCode().is2xxSuccessful() && response.getBody() != null
                    && "fulfilled".equals(objectMapper.readTree(response.getBody()).path("order").path("fulfillment_status").asText());
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public boolean dongBoTrangThaiDeliveredShopify(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY)
                .or(() -> kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY.toLowerCase()))
                .orElse(null);
        if (kenh == null) return false;

        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            log.warn("[SHOPIFY-DELIVERED] Không có Access Token hợp lệ cho đơn {}", maDonHangKenh);
            return false;
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            return false;
        }

        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        try {
            // 1. Lấy danh sách fulfillment của đơn hàng
            String getFulfillmentsUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + maDonHangKenh + "/fulfillments.json";
            ResponseEntity<String> res = restTemplate.exchange(getFulfillmentsUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            List<Long> fulfillmentIds = new ArrayList<>();
            if (res.getStatusCode().is2xxSuccessful() && res.getBody() != null) {
                JsonNode root = objectMapper.readTree(res.getBody());
                JsonNode fulfillments = root.path("fulfillments");
                if (fulfillments.isArray()) {
                    for (JsonNode f : fulfillments) {
                        long fId = f.path("id").asLong();
                        if (fId > 0) fulfillmentIds.add(fId);
                    }
                }
            }

            // Nếu đơn chưa từng được fulfill trên sàn, tự động gọi fulfill trước rồi mới tạo event delivered
            if (fulfillmentIds.isEmpty()) {
                log.info("[SHOPIFY-DELIVERED] Đơn hàng {} chưa có fulfillment trên Shopify, tự động fulfill trước", maDonHangKenh);
                if (!dongBoTrangThaiFulfilledShopify(null, maDonHangKenh)) return false;
                try {
                    Thread.sleep(300);
                } catch (InterruptedException ignored) {}

                // Truy vấn lại danh sách fulfillment
                ResponseEntity<String> retryRes = restTemplate.exchange(getFulfillmentsUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
                if (retryRes.getStatusCode().is2xxSuccessful() && retryRes.getBody() != null) {
                    JsonNode retryFulfillments = objectMapper.readTree(retryRes.getBody()).path("fulfillments");
                    if (retryFulfillments.isArray()) {
                        for (JsonNode f : retryFulfillments) {
                            long fId = f.path("id").asLong();
                            if (fId > 0) fulfillmentIds.add(fId);
                        }
                    }
                }
            }

            if (fulfillmentIds.isEmpty()) return false;

            // 2. Gửi sự kiện delivered cho từng fulfillment
            for (Long fId : fulfillmentIds) {
                String eventUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + maDonHangKenh + "/fulfillments/" + fId + "/events.json";
                Map<String, Object> eventObj = Map.of(
                        "status", "delivered",
                        "happened_at", Instant.now().toString(),
                        "message", "Đã giao thành công tới khách hàng (FCentric)"
                );
                Map<String, Object> body = Map.of("event", eventObj);
                try {
                    ResponseEntity<String> eventResponse = restTemplate.exchange(eventUrl, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
                    if (!eventResponse.getStatusCode().is2xxSuccessful() || eventResponse.getBody() == null
                            || !"delivered".equals(objectMapper.readTree(eventResponse.getBody()).path("fulfillment_event").path("status").asText())) return false;
                    log.info("[SHOPIFY-DELIVERED] Gửi sự kiện delivered cho fulfillment {} đơn {}", fId, maDonHangKenh);
                } catch (Exception ex) {
                    log.warn("[SHOPIFY-DELIVERED] Không tạo được event delivered cho fulfillment {}: {}", fId, ex.getMessage());
                    return false;
                }
            }

            capNhatTagVaNoteShopify(domain, token, maDonHangKenh, "Đã giao",
                    List.of("Đang thực hiện", "Chờ xuất kho"),
                    "FCentric: Giao hàng thành công tới người nhận");
            log.info("[SHOPIFY-DELIVERED] Cập nhật thành công trạng thái Đã giao cho đơn hàng {} trên Shopify", maDonHangKenh);
            return true;
        } catch (Exception e) {
            log.warn("[SHOPIFY-DELIVERED] Lỗi khi cập nhật trạng thái Đã giao đơn {}: {}", maDonHangKenh, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean dongBoTrangThaiReturnedShopify(String maDonHangKenh) {
        return dongBoHoanTraVaHoanTienShopify(null, maDonHangKenh);
    }

    @Override
    public boolean dongBoHoanTraVaHoanTienShopify(Integer donBanHangId, String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY)
                .or(() -> kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY.toLowerCase()))
                .orElse(null);
        if (kenh == null) return false;

        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            log.warn("[SHOPIFY-REFUND] Không có Access Token hợp lệ cho đơn {}", maDonHangKenh);
            return false;
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            return false;
        }

        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        try {
            // 1. Kiểm tra trạng thái đơn trên Shopify
            String orderUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + maDonHangKenh + ".json";
            ResponseEntity<String> orderRes = restTemplate.exchange(orderUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            if (!orderRes.getStatusCode().is2xxSuccessful() || orderRes.getBody() == null) {
                log.warn("[SHOPIFY-REFUND] Không tìm thấy đơn hàng {} trên Shopify", maDonHangKenh);
                return false;
            }

            JsonNode root = objectMapper.readTree(orderRes.getBody());
            JsonNode orderNode = root.path("order");
            String fulfillmentStatus = orderNode.path("fulfillment_status").asText("").trim().toLowerCase(Locale.ROOT);

            // Theo chuẩn vận hành Sapo: Nếu đơn chưa fulfill trên sàn thì tự fulfill trước rồi mới hoàn tiền/trả hàng
            if (!"fulfilled".equalsIgnoreCase(fulfillmentStatus)) {
                log.info("[SHOPIFY-REFUND] Đơn {} chưa fulfilled trên Shopify (status: {}), tự động fulfill trước khi hoàn trả",
                        maDonHangKenh, fulfillmentStatus);
                dongBoTrangThaiFulfilledShopify(donBanHangId, maDonHangKenh);
                try {
                    Thread.sleep(400); // Đợi Shopify cập nhật fulfillment state
                } catch (InterruptedException ignored) {}

                // Tải lại order sau khi fulfill
                try {
                    ResponseEntity<String> reRes = restTemplate.exchange(orderUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
                    if (reRes.getStatusCode().is2xxSuccessful() && reRes.getBody() != null) {
                        orderNode = objectMapper.readTree(reRes.getBody()).path("order");
                    }
                } catch (Exception ignored) {}
            }

            // 2. Trích xuất danh sách sản phẩm để hoàn trả (BẮT BUỘC restock_type = "no_restock")
            List<Map<String, Object>> refundLineItems = new ArrayList<>();
            JsonNode lineItems = orderNode.path("line_items");
            if (lineItems.isArray()) {
                for (JsonNode item : lineItems) {
                    long lineItemId = item.path("id").asLong();
                    int qty = item.path("quantity").asInt(1);
                    if (lineItemId > 0 && qty > 0) {
                        Map<String, Object> rli = new LinkedHashMap<>();
                        rli.put("line_item_id", lineItemId);
                        rli.put("quantity", qty);
                        rli.put("restock_type", "no_restock"); // Quy chuẩn FCentric: không tự động cộng tồn kho ảo
                        refundLineItems.add(rli);
                    }
                }
            }

            if (refundLineItems.isEmpty()) {
                log.warn("[SHOPIFY-REFUND] Đơn hàng {} không có line_items để hoàn trả", maDonHangKenh);
                capNhatTagVaNoteShopify(domain, token, maDonHangKenh, "Bị hoàn trả",
                        List.of("Đã xuất kho", "Đã giao"), "FCentric: Đơn hàng bị hoàn trả");
                return true;
            }

            // 3. Tính toán giao dịch hoàn tiền qua Calculate Refund API nếu có thể
            List<Map<String, Object>> transactionsToRefund = new ArrayList<>();
            try {
                String calcUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + maDonHangKenh + "/refunds/calculate.json";
                Map<String, Object> calcPayload = Map.of("refund", Map.of(
                        "shipping", Map.of("full_refund", false),
                        "refund_line_items", refundLineItems
                ));
                ResponseEntity<String> calcRes = restTemplate.exchange(calcUrl, HttpMethod.POST, new HttpEntity<>(calcPayload, headers), String.class);
                if (calcRes.getStatusCode().is2xxSuccessful() && calcRes.getBody() != null) {
                    JsonNode calcRoot = objectMapper.readTree(calcRes.getBody());
                    JsonNode suggestedTx = calcRoot.path("refund").path("suggested_transactions");
                    if (suggestedTx.isArray()) {
                        for (JsonNode stx : suggestedTx) {
                            Map<String, Object> tx = new LinkedHashMap<>();
                            tx.put("parent_id", stx.path("parent_id").asLong());
                            tx.put("amount", stx.path("amount").asText("0.00"));
                            tx.put("kind", "refund");
                            tx.put("gateway", stx.path("gateway").asText("manual"));
                            transactionsToRefund.add(tx);
                        }
                    }
                }
            } catch (Exception ex) {
                log.debug("[SHOPIFY-REFUND] Không tính toán được suggested_transactions qua API calculate: {}", ex.getMessage());
            }

            // 4. Gọi POST /orders/{id}/refunds.json để tạo Refund chính thức
            String refundUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + maDonHangKenh + "/refunds.json";
            Map<String, Object> refundObj = new LinkedHashMap<>();
            refundObj.put("currency", orderNode.path("currency").asText("VND"));
            refundObj.put("notify", false);
            refundObj.put("note", "Hoàn trả hàng từ kho FCentric WMS (restock_type: no_restock)");
            refundObj.put("refund_line_items", refundLineItems);
            if (!transactionsToRefund.isEmpty()) {
                refundObj.put("transactions", transactionsToRefund);
            }

            Map<String, Object> reqBody = Map.of("refund", refundObj);
            try {
                ResponseEntity<String> refRes = restTemplate.exchange(refundUrl, HttpMethod.POST, new HttpEntity<>(reqBody, headers), String.class);
                if (refRes.getStatusCode().is2xxSuccessful()) {
                    log.info("[SHOPIFY-REFUND] Tạo refund thành công cho đơn {} trên Shopify (items: {}, tx: {})",
                            maDonHangKenh, refundLineItems.size(), transactionsToRefund.size());
                    capNhatTagVaNoteShopify(domain, token, maDonHangKenh, "Bị hoàn trả",
                            List.of("Đã xuất kho", "Đã giao", "Đang thực hiện"),
                            "FCentric: Đã tiếp nhận và hoàn tất hoàn trả / hoàn tiền");
                    return true;
                }
            } catch (org.springframework.web.client.HttpStatusCodeException e) {
                log.warn("[SHOPIFY-REFUND] Lỗi HTTP khi tạo refund đơn {}: {} - {}", maDonHangKenh, e.getStatusCode(), e.getResponseBodyAsString());
                // Thử fallback tạo refund không kèm transactions (chỉ refund line items) nếu gateway báo lỗi
                if (!transactionsToRefund.isEmpty()) {
                    try {
                        refundObj.remove("transactions");
                        ResponseEntity<String> retryRes = restTemplate.exchange(refundUrl, HttpMethod.POST, new HttpEntity<>(Map.of("refund", refundObj), headers), String.class);
                        if (retryRes.getStatusCode().is2xxSuccessful()) {
                            log.info("[SHOPIFY-REFUND] Tạo refund (chỉ line items) thành công cho đơn {} trên Shopify", maDonHangKenh);
                            capNhatTagVaNoteShopify(domain, token, maDonHangKenh, "Bị hoàn trả",
                                    List.of("Đã xuất kho", "Đã giao", "Đang thực hiện"),
                                    "FCentric: Đã tiếp nhận hoàn trả hàng");
                            return true;
                        }
                    } catch (Exception retryEx) {
                        log.warn("[SHOPIFY-REFUND] Retry refund không kèm transactions cũng thất bại: {}", retryEx.getMessage());
                    }
                }
            }

            // Fallback: Nếu Shopify từ chối Refund API, vẫn cập nhật Tag và Note đầy đủ
            capNhatTagVaNoteShopify(domain, token, maDonHangKenh, "Bị hoàn trả",
                    List.of("Đã xuất kho", "Đã giao", "Đang thực hiện"),
                    "FCentric: Đơn hàng bị hoàn trả");
            return true;
        } catch (Exception e) {
            log.warn("[SHOPIFY-REFUND] Lỗi ngoại lệ khi hoàn trả đơn {}: {}", maDonHangKenh, e.getMessage());
            return false;
        }
    }

    private void capNhatTagShopify(String domain, String token, String orderId, String tagToAdd, List<String> tagsToRemove) {
        capNhatTagVaNoteShopify(domain, token, orderId, tagToAdd, tagsToRemove, null);
    }

    private void capNhatTagVaNoteShopify(String domain, String token, String orderId, String tagToAdd, List<String> tagsToRemove, String noteToAppend) {
        if (orderId == null || orderId.isBlank()) return;
        long parsedOrderId;
        try {
            parsedOrderId = Long.parseLong(orderId.trim());
        } catch (Exception ex) {
            return;
        }

        try {
            RestTemplate restTemplate = createRestTemplate();
            HttpHeaders headers = createHeaders(token);
            String orderUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + parsedOrderId + ".json?fields=id,tags,note";
            ResponseEntity<String> getRes = restTemplate.exchange(orderUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            if (!getRes.getStatusCode().is2xxSuccessful() || getRes.getBody() == null) return;

            JsonNode root = objectMapper.readTree(getRes.getBody());
            JsonNode orderNode = root.path("order");
            String existingTags = orderNode.path("tags").asText("");
            String existingNote = orderNode.path("note").asText("");
            Set<String> tagSet = new LinkedHashSet<>();
            if (!existingTags.isBlank()) {
                for (String t : existingTags.split(",")) {
                    if (!t.trim().isBlank()) tagSet.add(t.trim());
                }
            }
            if (tagsToRemove != null) {
                for (String tr : tagsToRemove) {
                    tagSet.remove(tr);
                }
            }
            if (tagToAdd != null && !tagToAdd.isBlank()) {
                tagSet.add(tagToAdd.trim());
            }

            String newTags = String.join(", ", tagSet);
            boolean tagsChanged = !newTags.equals(existingTags);

            String newNote = existingNote;
            boolean noteChanged = false;
            if (noteToAppend != null && !noteToAppend.isBlank()) {
                if (existingNote.isBlank()) {
                    newNote = noteToAppend.trim();
                    noteChanged = true;
                } else if (!existingNote.contains(noteToAppend.trim())) {
                    newNote = existingNote + "\n" + noteToAppend.trim();
                    noteChanged = true;
                }
            }

            if (tagsChanged || noteChanged) {
                String putUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + parsedOrderId + ".json";
                Map<String, Object> updateFields = new LinkedHashMap<>();
                updateFields.put("id", parsedOrderId);
                if (tagsChanged) updateFields.put("tags", newTags);
                if (noteChanged) updateFields.put("note", newNote);
                Map<String, Object> orderPayload = Map.of("order", updateFields);
                restTemplate.exchange(putUrl, HttpMethod.PUT, new HttpEntity<>(orderPayload, headers), String.class);
                log.info("[SHOPIFY-ORDER-UPDATE] Cập nhật thành công đơn {}: tags={}, note={}",
                        parsedOrderId, tagsChanged ? newTags : "giữ nguyên", noteChanged ? "đã thêm ghi chú" : "giữ nguyên");
            }
        } catch (Exception e) {
            log.debug("[SHOPIFY-TAGS] Không thể cập nhật tag/note đơn {}: {}", orderId, e.getMessage());
        }
    }

    private String xacDinhMaKenhLazada(String maDonHangKenh) {
        if (maDonHangKenh != null && donBanHangRepository != null) {
            DonBanHang don = donBanHangRepository.findByMaDonHangKenh(maDonHangKenh).orElse(null);
            if (don != null && don.getKenhBanHang() != null && don.getKenhBanHang().getMaKenh() != null) {
                return don.getKenhBanHang().getMaKenh();
            }
        }
        return OmnichannelOrderSyncJob.MA_KENH_LAZADA;
    }

    @Override
    public boolean huyDonHangTrenLazada(String maDonHangKenh, String lyDoHuy) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }

        String maKenh = xacDinhMaKenhLazada(maDonHangKenh);
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            log.warn("[LAZADA-CANCEL] Chưa có cấu hình hoặc Access Token để hủy đơn {}", maDonHangKenh);
            return false;
        }

        try {
            List<String> orderItemIds = new ArrayList<>();
            JsonNode itemsRes = lazadaClient.getOrderItems(appKey, appSecret, token, maDonHangKenh);
            if (itemsRes != null && "0".equals(itemsRes.path("code").asText(""))) {
                JsonNode data = itemsRes.path("data");
                if (data.isArray()) {
                    for (JsonNode it : data) {
                        String itemId = it.path("order_item_id").asText("");
                        if (!itemId.isBlank()) {
                            orderItemIds.add(itemId);
                        }
                    }
                }
            }

            JsonNode cancelRes = lazadaClient.cancelOrder(appKey, appSecret, token, maDonHangKenh, orderItemIds, "15", lyDoHuy);
            String code = cancelRes != null ? cancelRes.path("code").asText("") : "";
            if ("0".equals(code)) {
                log.info("[LAZADA-CANCEL] Hủy thành công đơn hàng {} trên Lazada", maDonHangKenh);
                return true;
            } else {
                String msg = cancelRes != null ? cancelRes.path("message").asText(cancelRes.path("sub_message").asText("")) : "Unknown";
                if (msg.toLowerCase().contains("already") || msg.toLowerCase().contains("cancel")) {
                    log.info("[LAZADA-CANCEL] Đơn hàng {} đã ở trạng thái hủy trên Lazada", maDonHangKenh);
                    return true;
                }
                log.warn("[LAZADA-CANCEL] Lazada từ chối hủy đơn {}: code={}, msg={}", maDonHangKenh, code, msg);
                return false;
            }
        } catch (Exception e) {
            log.error("[LAZADA-CANCEL] Lỗi khi gọi Lazada cancel order {}: {}", maDonHangKenh, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean dongBoTrangThaiPackedLazada(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }
        String maKenh = xacDinhMaKenhLazada(maDonHangKenh);
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            log.warn("[LAZADA-PACK] Chưa có cấu hình hoặc Access Token để pack đơn {}", maDonHangKenh);
            return false;
        }
        try {
            List<String> orderItemIds = new ArrayList<>();
            JsonNode itemsRes = lazadaClient.getOrderItems(appKey, appSecret, token, maDonHangKenh);
            if (itemsRes != null && "0".equals(itemsRes.path("code").asText(""))) {
                JsonNode data = itemsRes.path("data");
                if (data.isArray()) {
                    for (JsonNode it : data) {
                        String itemId = it.path("order_item_id").asText("");
                        if (!itemId.isBlank()) {
                            orderItemIds.add(itemId);
                        }
                    }
                }
            }
            JsonNode packRes = lazadaClient.packOrder(appKey, appSecret, token, maDonHangKenh, orderItemIds);
            String code = packRes != null ? packRes.path("code").asText("") : "";
            if ("0".equals(code)) {
                log.info("[LAZADA-PACK] Đã đồng bộ trạng thái packed cho đơn hàng {} sang Lazada", maDonHangKenh);
                return true;
            } else {
                String msg = packRes != null ? packRes.path("message").asText(packRes.path("sub_message").asText("")) : "Unknown";
                if (msg.toLowerCase().contains("already") || msg.toLowerCase().contains("packed")) {
                    log.info("[LAZADA-PACK] Đơn hàng {} đã ở trạng thái packed trên Lazada", maDonHangKenh);
                    return true;
                }
                log.warn("[LAZADA-PACK] Lazada từ chối pack đơn {}: code={}, msg={}", maDonHangKenh, code, msg);
                return false;
            }
        } catch (Exception e) {
            log.error("[LAZADA-PACK] Lỗi khi gọi Lazada pack order {}: {}", maDonHangKenh, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean dongBoTrangThaiReadyToShipLazada(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }
        String maKenh = xacDinhMaKenhLazada(maDonHangKenh);
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            log.warn("[LAZADA-RTS] Chưa có cấu hình hoặc Access Token để RTS đơn {}", maDonHangKenh);
            return false;
        }
        try {
            List<String> orderItemIds = new ArrayList<>();
            String packageId = null;
            JsonNode itemsRes = lazadaClient.getOrderItems(appKey, appSecret, token, maDonHangKenh);
            if (itemsRes != null && "0".equals(itemsRes.path("code").asText(""))) {
                JsonNode data = itemsRes.path("data");
                if (data.isArray()) {
                    for (JsonNode it : data) {
                        String itemId = it.path("order_item_id").asText("");
                        if (!itemId.isBlank()) {
                            orderItemIds.add(itemId);
                        }
                        String pkg = it.path("package_id").asText("");
                        if (!pkg.isBlank() && packageId == null) {
                            packageId = pkg;
                        }
                    }
                }
            }

            // Self-Healing: Nếu chưa có packageId hợp lệ, tự động gọi packOrder để tạo kiện trên sàn và lấy package_id
            if ((packageId == null || packageId.isBlank()) && !orderItemIds.isEmpty()) {
                log.info("[LAZADA-RTS] Đơn hàng {} chưa có package_id, kích hoạt tự động packOrder...", maDonHangKenh);
                JsonNode packRes = lazadaClient.packOrder(appKey, appSecret, token, maDonHangKenh, orderItemIds);
                if (packRes != null) {
                    JsonNode packData = packRes.path("data");
                    if (packData.path("order_item_list").isArray()) {
                        for (JsonNode oi : packData.path("order_item_list")) {
                            String pkg = oi.path("package_id").asText("");
                            if (!pkg.isBlank()) {
                                packageId = pkg;
                                break;
                            }
                        }
                    }
                    if (packageId == null && packData.path("pack_order_list").isArray()) {
                        for (JsonNode po : packData.path("pack_order_list")) {
                            String pkg = po.path("package_id").asText("");
                            if (!pkg.isBlank()) {
                                packageId = pkg;
                                break;
                            }
                        }
                    }
                    if (packageId == null && packData.path("packages").isArray()) {
                        for (JsonNode pkgNode : packData.path("packages")) {
                            String pkg = pkgNode.path("package_id").asText("");
                            if (!pkg.isBlank()) {
                                packageId = pkg;
                                break;
                            }
                        }
                    }
                }

                if (packageId == null || packageId.isBlank()) {
                    JsonNode refreshedItems = lazadaClient.getOrderItems(appKey, appSecret, token, maDonHangKenh);
                    if (refreshedItems != null && "0".equals(refreshedItems.path("code").asText(""))) {
                        JsonNode data = refreshedItems.path("data");
                        if (data.isArray()) {
                            for (JsonNode it : data) {
                                String pkg = it.path("package_id").asText("");
                                if (!pkg.isBlank()) {
                                    packageId = pkg;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            JsonNode rtsRes = lazadaClient.readyToShip(appKey, appSecret, token, packageId, orderItemIds);
            String code = rtsRes != null ? rtsRes.path("code").asText("") : "";
            if ("0".equals(code)) {
                log.info("[LAZADA-RTS] Đã đồng bộ trạng thái ready_to_ship cho đơn hàng {} sang Lazada (package_id: {})",
                        maDonHangKenh, packageId != null ? packageId : "N/A");
                return true;
            } else {
                String msg = rtsRes != null ? rtsRes.path("message").asText(rtsRes.path("sub_message").asText("")) : "Unknown";
                if (msg.toLowerCase().contains("already") || msg.toLowerCase().contains("ready_to_ship") || msg.toLowerCase().contains("rts")) {
                    log.info("[LAZADA-RTS] Đơn hàng {} đã ở trạng thái ready_to_ship trên Lazada", maDonHangKenh);
                    return true;
                }
                log.warn("[LAZADA-RTS] Lazada từ chối RTS đơn {}: code={}, msg={}", maDonHangKenh, code, msg);
                return false;
            }
        } catch (Exception e) {
            log.error("[LAZADA-RTS] Lỗi khi gọi Lazada RTS order {}: {}", maDonHangKenh, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean dongBoTrangThaiReadyToShipTikTok(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }
        String maKenh = OmnichannelOrderSyncJob.MA_KENH_TIKTOK;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(maKenh)
                .or(() -> kenhBanHangRepository.findByMaKenh(maKenh.toLowerCase()))
                .orElse(null);
        if (kenh == null || !Integer.valueOf(1).equals(kenh.getTrangThai())) {
            log.warn("[TIKTOK-RTS] Kênh TikTok Shop chưa kích hoạt hoặc không tìm thấy");
            return false;
        }

        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();

        if (appKey == null || appSecret == null || token == null) {
            log.warn("[TIKTOK-RTS] Chưa cấu hình đủ thông tin xác thực TikTok Shop để ship package đơn {}", maDonHangKenh);
            return false;
        }

        try {
            DonBanHang don = donBanHangRepository.findByMaDonHangKenh(maDonHangKenh)
                    .or(() -> donBanHangRepository.findBySoDonHang("TTS-" + maDonHangKenh))
                    .orElse(null);

            String packageId = null;
            if (don != null && don.getGhiChu() != null) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\[KIỆN:\\s*([^\\]]+)\\]").matcher(don.getGhiChu());
                if (m.find()) {
                    packageId = m.group(1).trim();
                }
            }

            // 1. Tra cứu tracking đơn qua endpoint Fulfillment Order Tracking chuyên dụng
            if (packageId == null || packageId.isBlank()) {
                try {
                    JsonNode trackRes = getTikTokShopClient().getOrderTracking(appKey, appSecret, token, cipher, maDonHangKenh.trim());
                    packageId = trichXuatPackageIdTuTikTokJson(trackRes);
                    if (trackRes != null && don != null) {
                        dongBoThongTinTrackingTuJson(don, trackRes);
                    }
                } catch (Exception ex) {
                    log.warn("[TIKTOK-RTS] Không thể lấy tracking đơn {}: {}", maDonHangKenh, ex.getMessage());
                }
            }

            // 2. Tra cứu chi tiết đơn qua GET /order/202309/orders?ids=...
            if (packageId == null || packageId.isBlank()) {
                try {
                    JsonNode detailRes = getTikTokShopClient().getOrderDetails(appKey, appSecret, token, cipher, maDonHangKenh.trim());
                    packageId = trichXuatPackageIdTuTikTokJson(detailRes);
                } catch (Exception ex) {
                    log.warn("[TIKTOK-RTS] Không thể lấy chi tiết đơn {}: {}", maDonHangKenh, ex.getMessage());
                }
            }

            // 3. Fallback: tìm qua searchOrders
            if (packageId == null || packageId.isBlank()) {
                com.dev.backend.dto.request.TikTokOrderSearchRequest req =
                        com.dev.backend.dto.request.TikTokOrderSearchRequest.builder()
                                .pageSize(10)
                                .build();
                var searchRes = getTikTokShopClient().searchOrders(appKey, appSecret, token, cipher, req);
                if (searchRes != null && searchRes.getOrders() != null) {
                    for (TikTokOrderDto o : searchRes.getOrders()) {
                        if (maDonHangKenh.equalsIgnoreCase(o.getId())) {
                            packageId = o.getFirstPackageId();
                            break;
                        }
                    }
                }
            }

            if (packageId == null || packageId.isBlank()) {
                log.warn("[TIKTOK-RTS] Không tìm thấy package_id của đơn hàng {} để ship trên TikTok Shop", maDonHangKenh);
                return false;
            }

            // Cập nhật package_id vào đơn hàng nếu chưa có
            if (don != null) {
                String currentNote = don.getGhiChu() != null ? don.getGhiChu() : "";
                if (!currentNote.contains("[KIỆN:")) {
                    don.setGhiChu((currentNote.isBlank() ? "" : currentNote + " | ") + "[KIỆN: " + packageId + "]");
                    don.setNgayCapNhat(Instant.now());
                    donBanHangRepository.save(don);
                }
            }

            JsonNode shipRes = getTikTokShopClient().shipPackage(appKey, appSecret, token, cipher, packageId);
            int code = shipRes != null ? shipRes.path("code").asInt(-1) : -1;
            String msg = shipRes != null ? shipRes.path("message").asText("") : "";

            if (code == 0) {
                log.info("[TIKTOK-RTS] Đã ship thành công package {} đơn {} sang TikTok Shop (chuyển sang AWAITING_COLLECTION)",
                        packageId, maDonHangKenh);

                if (don != null) {
                    String docUrl = getTikTokShopClient().getPackageShippingDocumentUrl(appKey, appSecret, token, cipher, packageId);
                    String currentNote = don.getGhiChu() != null ? don.getGhiChu() : "";
                    StringBuilder sb = new StringBuilder(currentNote);
                    if (!currentNote.contains("[RTS]")) {
                        if (!sb.isEmpty()) sb.append(" | ");
                        sb.append("[RTS: Đã xác nhận chuẩn bị hàng]");
                    }
                    if (docUrl != null && !docUrl.isBlank() && !currentNote.contains("[PDF_AWB:")) {
                        if (!sb.isEmpty()) sb.append(" | ");
                        sb.append("[PDF_AWB: ").append(docUrl).append("]");
                    }
                    don.setGhiChu(sb.toString());
                    don.setNgayCapNhat(Instant.now());
                    donBanHangRepository.save(don);
                }
                return true;
            } else {
                if (msg.toLowerCase().contains("already") || msg.toLowerCase().contains("shipped")
                        || msg.toLowerCase().contains("awaiting_collection") || code == 12051000) {
                    log.info("[TIKTOK-RTS] Kiện hàng {} đơn {} đã ở trạng thái chờ lấy hàng trên TikTok Shop", packageId, maDonHangKenh);
                    // Lấy luôn PDF AWB nếu kiện đã ở trạng thái sẵn sàng giao
                    if (don != null) {
                        String docUrl = getTikTokShopClient().getPackageShippingDocumentUrl(appKey, appSecret, token, cipher, packageId);
                        if (docUrl != null && !docUrl.isBlank()) {
                            String currentNote = don.getGhiChu() != null ? don.getGhiChu() : "";
                            if (!currentNote.contains("[PDF_AWB:")) {
                                don.setGhiChu((currentNote.isBlank() ? "" : currentNote + " | ") + "[PDF_AWB: " + docUrl.trim() + "]");
                                don.setNgayCapNhat(Instant.now());
                                donBanHangRepository.save(don);
                            }
                        }
                    }
                    return true;
                }
                log.warn("[TIKTOK-RTS] TikTok Shop từ chối ship package {} đơn {}: code={}, msg={}", packageId, maDonHangKenh, code, msg);
                return false;
            }
        } catch (Exception ex) {
            log.error("[TIKTOK-RTS] Lỗi ngoại lệ khi ship package cho đơn {}: {}", maDonHangKenh, ex.getMessage());
            return false;
        }
    }

    @Override
    public String layShippingDocumentUrlTikTok(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) return null;
        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();

        if (appKey == null || appSecret == null || token == null) return null;

        DonBanHang don = donBanHangRepository.findByMaDonHangKenh(maDonHangKenh)
                .or(() -> donBanHangRepository.findBySoDonHang("TTS-" + maDonHangKenh))
                .orElse(null);

        // 1. Kiểm tra cache trong ghi chú đơn hàng
        if (don != null && don.getGhiChu() != null) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\[PDF_AWB:\\s*([^\\]]+)\\]").matcher(don.getGhiChu());
            if (m.find()) {
                String cachedUrl = m.group(1).trim();
                if (!cachedUrl.isBlank()) {
                    return cachedUrl;
                }
            }
        }

        String packageId = null;
        if (don != null && don.getGhiChu() != null) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\[KIỆN:\\s*([^\\]]+)\\]").matcher(don.getGhiChu());
            if (m.find()) {
                packageId = m.group(1).trim();
            }
        }

        // 2. Tra cứu qua Fulfillment Order Tracking API
        if ((packageId == null || packageId.isBlank()) && maDonHangKenh != null) {
            try {
                JsonNode trackRes = getTikTokShopClient().getOrderTracking(appKey, appSecret, token, cipher, maDonHangKenh.trim());
                packageId = trichXuatPackageIdTuTikTokJson(trackRes);
                if (trackRes != null && don != null) {
                    dongBoThongTinTrackingTuJson(don, trackRes);
                }
            } catch (Exception ex) {
                log.warn("[TIKTOK-FULFILLMENT] Không thể tra cứu tracking đơn {} để lấy package_id: {}", maDonHangKenh, ex.getMessage());
            }
        }

        // 3. Fallback qua GET /order/202309/orders?ids=...
        if ((packageId == null || packageId.isBlank()) && maDonHangKenh != null) {
            try {
                JsonNode orderDetailRes =
                        getTikTokShopClient().getOrderDetails(appKey, appSecret, token, cipher, maDonHangKenh.trim());
                packageId = trichXuatPackageIdTuTikTokJson(orderDetailRes);
            } catch (Exception ex) {
                log.warn("[TIKTOK-FULFILLMENT] Không thể tra cứu chi tiết đơn {} để lấy package_id: {}", maDonHangKenh, ex.getMessage());
            }
        }

        // 4. Cập nhật package_id vào ghi chú nếu mới lấy được
        if (packageId != null && !packageId.isBlank() && don != null) {
            String currentNote = don.getGhiChu() != null ? don.getGhiChu() : "";
            if (!currentNote.contains("[KIỆN:")) {
                don.setGhiChu((currentNote.isBlank() ? "" : currentNote + " | ") + "[KIỆN: " + packageId + "]");
                don.setNgayCapNhat(Instant.now());
                donBanHangRepository.save(don);
                log.info("[TIKTOK-FULFILLMENT] Tự động cập nhật package_id {} cho đơn {}", packageId, maDonHangKenh);
            }
        }

        // 5. Gọi API lấy link PDF AWB chính thức
        if (packageId != null && !packageId.isBlank()) {
            String docUrl = getTikTokShopClient().getPackageShippingDocumentUrl(appKey, appSecret, token, cipher, packageId);
            if (docUrl != null && !docUrl.isBlank() && don != null) {
                String currentNote = don.getGhiChu() != null ? don.getGhiChu() : "";
                if (!currentNote.contains("[PDF_AWB:")) {
                    don.setGhiChu((currentNote.isBlank() ? "" : currentNote + " | ") + "[PDF_AWB: " + docUrl.trim() + "]");
                    don.setNgayCapNhat(Instant.now());
                    donBanHangRepository.save(don);
                    log.info("[TIKTOK-FULFILLMENT] Đã lưu cache URL PDF vận đơn gốc TikTok Shop cho đơn {}", don.getSoDonHang());
                }
            }
            return docUrl;
        }
        return null;
    }

    private String trichXuatPackageIdTuTikTokJson(JsonNode res) {
        if (res == null || res.path("code").asInt(-1) != 0) return null;
        JsonNode data = res.path("data");
        JsonNode pkgList = data.path("package_list");
        if (!pkgList.isArray() || pkgList.isEmpty()) {
            pkgList = data.path("packages");
        }
        if (pkgList.isArray() && !pkgList.isEmpty()) {
            JsonNode firstPkg = pkgList.get(0);
            String pId = firstPkg.path("package_id").asText(null);
            if (pId == null || pId.isBlank()) {
                pId = firstPkg.path("id").asText(null);
            }
            if (pId != null && !pId.isBlank()) return pId.trim();
        }
        JsonNode orders = data.path("orders");
        if (!orders.isArray() || orders.isEmpty()) {
            orders = data.path("order_list");
        }
        if (orders.isArray() && !orders.isEmpty()) {
            JsonNode firstOrder = orders.get(0);
            JsonNode innerPkgs = firstOrder.path("packages");
            if (!innerPkgs.isArray() || innerPkgs.isEmpty()) {
                innerPkgs = firstOrder.path("package_list");
            }
            if (innerPkgs.isArray() && !innerPkgs.isEmpty()) {
                JsonNode firstPkg = innerPkgs.get(0);
                String pId = firstPkg.path("package_id").asText(null);
                if (pId == null || pId.isBlank()) {
                    pId = firstPkg.path("id").asText(null);
                }
                if (pId != null && !pId.isBlank()) return pId.trim();
            }
        }
        return null;
    }

    private void dongBoThongTinTrackingTuJson(DonBanHang don, JsonNode trackRes) {
        if (don == null || trackRes == null) return;
        JsonNode pkgList = trackRes.path("data").path("package_list");
        if (!pkgList.isArray() || pkgList.isEmpty()) {
            pkgList = trackRes.path("data").path("packages");
        }
        if (pkgList.isArray() && !pkgList.isEmpty()) {
            JsonNode firstPkg = pkgList.get(0);
            String trackingNum = firstPkg.path("tracking_number").asText(null);
            String carrierName = firstPkg.path("shipping_provider_name").asText(null);
            String currentNote = don.getGhiChu() != null ? don.getGhiChu() : "";
            if (trackingNum != null && !trackingNum.isBlank() && !currentNote.contains("[VẬN ĐƠN:")) {
                String trackingInfo = "[VẬN ĐƠN: " + trackingNum.trim() +
                        (carrierName != null && !carrierName.isBlank() ? " - " + carrierName.trim() : "") + "]";
                don.setGhiChu((currentNote.isBlank() ? "" : currentNote + " | ") + trackingInfo);
                don.setNgayCapNhat(Instant.now());
                donBanHangRepository.save(don);
                log.info("[TIKTOK-FULFILLMENT] Tự động cập nhật tracking {} ({}) cho đơn {}", trackingNum, carrierName, don.getSoDonHang());
            }
        }
    }

    /** Trích xuất URL trang tiếp theo từ Header Link của Shopify (RFC 5988 cursor pagination) */
    public static String trichXuatUrlTrangSau(String linkHeader) {
        if (linkHeader == null || linkHeader.isBlank()) return null;
        for (String part : linkHeader.split(",")) {
            if (part.contains("rel=\"next\"") || part.contains("rel=next")) {
                int start = part.indexOf('<');
                int end = part.indexOf('>');
                if (start >= 0 && end > start) {
                    return part.substring(start + 1, end).trim();
                }
            }
        }
        return null;
    }

    /** Kiểm tra Leaky Bucket rate limit của Shopify (Header X-Shopify-Shop-Api-Call-Limit: 38/40) */
    public static void kiemTraLeakyBucket(String callLimitHeader) {
        if (callLimitHeader == null || !callLimitHeader.contains("/")) return;
        try {
            String[] parts = callLimitHeader.split("/");
            int current = Integer.parseInt(parts[0].trim());
            int max = Integer.parseInt(parts[1].trim());
            if (current >= max - 3) {
                Thread.sleep(500);
            }
        } catch (Exception ignored) {}
    }

    /** Cập nhật giá biến thể trực tiếp lên Shopify qua PUT /admin/api/{version}/variants/{id}.json */
    public boolean capNhatGiaBienTheShopify(String domain, String token, Long shopifyVariantId, BigDecimal giaBan, BigDecimal compareAtPrice) {
        if (shopifyVariantId == null || giaBan == null || giaBan.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/variants/" + shopifyVariantId + ".json";
        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        Map<String, Object> variantObj = new LinkedHashMap<>();
        variantObj.put("id", shopifyVariantId);
        variantObj.put("price", giaBan.setScale(2, RoundingMode.HALF_UP).toPlainString());
        if (compareAtPrice != null && compareAtPrice.compareTo(BigDecimal.ZERO) > 0) {
            variantObj.put("compare_at_price", compareAtPrice.setScale(2, RoundingMode.HALF_UP).toPlainString());
        }

        Map<String, Object> body = Map.of("variant", variantObj);
        try {
            String jsonBody = objectMapper.writeValueAsString(body);
            HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                kiemTraLeakyBucket(response.getHeaders().getFirst("X-Shopify-Shop-Api-Call-Limit"));
                log.info("Cập nhật thành công giá biến thể Shopify ID {}: {} (compare_at: {})", shopifyVariantId, giaBan, compareAtPrice);
                return true;
            }
        } catch (Exception e) {
            log.warn("Lỗi khi cập nhật giá biến thể Shopify ID {}: {}", shopifyVariantId, e.getMessage());
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
        BigDecimal price;
        BigDecimal compareAtPrice;
        String barcode;

        public ShopifyVariantInfo(Long variantId, Long inventoryItemId, Long productId, Long imageId) {
            this(variantId, inventoryItemId, productId, imageId, null, null, null);
        }
    }

    // ── Shopee Catalog & Stock Synchronization ──

    public com.dev.backend.services.shopee.ShopeeClient getShopeeClient(KenhBanHang kenh) {
        String maKenh = kenh != null ? kenh.getMaKenh() : "SHOPEE";
        Long partnerId = kenhBanHangService.getShopeePartnerId(maKenh);
        String partnerKey = kenhBanHangService.getDecryptedShopeePartnerKey(maKenh);
        String accessToken = kenhBanHangService.getDecryptedShopeeAccessToken(maKenh);
        Long shopId = kenhBanHangService.getShopeeShopId(maKenh);
        boolean isSandbox = OmnichannelOrderSyncJob.isShopeeSandbox(maKenh);

        return new com.dev.backend.services.shopee.ShopeeClient(
                partnerId != null ? partnerId : 0L,
                partnerKey != null ? partnerKey : "",
                shopId != null ? shopId : 0L,
                accessToken != null ? accessToken : "",
                isSandbox
        );
    }

    private TaiSanPhamResultDto taiSanPhamShopee(KenhBanHang kenh) {
        Long shopId = kenhBanHangService.getShopeeShopId(kenh != null ? kenh.getMaKenh() : "SHOPEE");
        if (shopId == null || shopId <= 0) {
            log.warn("[SHOPEE-SYNC] Kênh {} chưa có Shop ID định danh gian hàng hợp lệ, bỏ qua tải sản phẩm.", kenh != null ? kenh.getMaKenh() : "SHOPEE");
            return TaiSanPhamResultDto.builder().soSku(0).soMoi(0).soCapNhat(0).build();
        }
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClient(kenh);
        boolean isSandbox = "SHOPEE_SANDBOX".equalsIgnoreCase(kenh.getMaKenh());

        int soSku = 0;
        int soMoi = 0;
        int soCapNhat = 0;

        List<TrangThaiDongBoSanPham> existingList = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        Map<Integer, TrangThaiDongBoSanPham> mappingByBtId = new HashMap<>();
        Map<String, TrangThaiDongBoSanPham> mappingByMaKenh = new HashMap<>();
        for (TrangThaiDongBoSanPham item : existingList) {
            if (item.getBienTheSanPham() != null && item.getBienTheSanPham().getId() != null) {
                mappingByBtId.put(item.getBienTheSanPham().getId(), item);
            }
            if (item.getMaSanPhamKenh() != null && !item.getMaSanPhamKenh().isBlank()) {
                mappingByMaKenh.put(item.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), item);
            }
        }

        try {
            JsonNode listRes = client.getItemList(0, 100, "NORMAL");
            JsonNode items = listRes.path("response").path("item");
            if (!items.isArray() || items.isEmpty()) {
                items = listRes.path("response").path("item_list");
            }
            List<Long> itemIds = new ArrayList<>();
            if (items.isArray()) {
                for (JsonNode it : items) {
                    itemIds.add(it.path("item_id").asLong());
                }
            }

            if (itemIds.isEmpty()) {
                return TaiSanPhamResultDto.builder().soSku(0).soMoi(0).soCapNhat(0).build();
            }

            JsonNode detailRes = client.getItemBaseInfo(itemIds);
            JsonNode itemList = detailRes.path("response").path("item_list");
            if (itemList.isArray()) {
                for (JsonNode itemNode : itemList) {
                    long itemId = itemNode.path("item_id").asLong();
                    String itemName = itemNode.path("item_name").asText("Sản phẩm Shopee");
                    boolean hasModel = itemNode.path("has_model").asBoolean(false);
                    JsonNode models = null;
                    if (hasModel) {
                        try {
                            JsonNode modelRes = client.getModelList(itemId);
                            models = modelRes.path("response").path("model");
                            if (!models.isArray() || models.isEmpty()) {
                                models = modelRes.path("response").path("model_list");
                            }
                        } catch (Exception mEx) {
                            log.warn("[SHOPEE-SYNC] Lỗi lấy model_list cho item {}: {}", itemId, mEx.getMessage());
                        }
                    }
                    if (models == null || !models.isArray() || models.isEmpty()) {
                        models = itemNode.path("model");
                    }

                    if (models.isArray() && !models.isEmpty()) {
                        for (JsonNode modelNode : models) {
                            long modelId = modelNode.path("model_id").asLong();
                            String modelSku = modelNode.path("model_sku").asText("").trim();
                            if (modelSku.isBlank()) {
                                modelSku = "SHP-SKU-" + itemId + "-" + modelId;
                            }
                            BigDecimal price = null;
                            JsonNode priceInfo = modelNode.path("price_info");
                            if (priceInfo.isArray() && !priceInfo.isEmpty()) {
                                price = BigDecimal.valueOf(priceInfo.get(0).path("original_price").asDouble(0.0));
                            }

                            String maSanPhamKenh = itemId + ":" + modelId;
                            BienTheSanPham bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(modelSku).orElse(null);

                            TrangThaiDongBoSanPham tt = null;
                            if (bt != null && mappingByBtId.containsKey(bt.getId())) {
                                tt = mappingByBtId.get(bt.getId());
                            }
                            if (tt == null && mappingByMaKenh.containsKey(maSanPhamKenh.toLowerCase(Locale.ROOT))) {
                                tt = mappingByMaKenh.get(maSanPhamKenh.toLowerCase(Locale.ROOT));
                            }
                            if (tt == null && mappingByMaKenh.containsKey(String.valueOf(modelId))) {
                                tt = mappingByMaKenh.get(String.valueOf(modelId));
                            }
                            if (tt != null) {
                                soCapNhat++;
                            } else {
                                tt = new TrangThaiDongBoSanPham();
                                tt.setKenhBanHang(kenh);
                                soMoi++;
                            }
                            tt.setMaSanPhamKenh(maSanPhamKenh);
                            if (bt != null) {
                                tt.setBienTheSanPham(bt);
                                tt.setTrangThaiDongBo("thanh_cong");
                                tt.setChiTietLoi(null);
                                mappingByBtId.put(bt.getId(), tt);
                            } else if (tt.getBienTheSanPham() == null) {
                                tt.setTrangThaiDongBo("chua_dong_bo");
                            }
                            if (tt.getMaSanPhamKenh() != null) {
                                mappingByMaKenh.put(tt.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), tt);
                            }
                            if (price != null) tt.setGiaBanSan(price);
                            trangThaiDongBoSanPhamRepository.save(tt);
                            soSku++;
                        }
                    } else {
                        String maSanPhamKenh = String.valueOf(itemId);
                        String sku = itemNode.path("item_sku").asText("SHP-ITEM-" + itemId).trim();
                        BigDecimal price = null;
                        JsonNode priceInfo = itemNode.path("price_info");
                        if (priceInfo.isArray() && !priceInfo.isEmpty()) {
                            price = BigDecimal.valueOf(priceInfo.get(0).path("original_price").asDouble(0.0));
                        }

                        BienTheSanPham bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sku).orElse(null);
                        TrangThaiDongBoSanPham tt = null;
                        if (bt != null && mappingByBtId.containsKey(bt.getId())) {
                            tt = mappingByBtId.get(bt.getId());
                        }
                        if (tt == null && mappingByMaKenh.containsKey(maSanPhamKenh.toLowerCase(Locale.ROOT))) {
                            tt = mappingByMaKenh.get(maSanPhamKenh.toLowerCase(Locale.ROOT));
                        }
                        if (tt != null) {
                            soCapNhat++;
                        } else {
                            tt = new TrangThaiDongBoSanPham();
                            tt.setKenhBanHang(kenh);
                            soMoi++;
                        }
                        tt.setMaSanPhamKenh(maSanPhamKenh);
                        if (bt != null) {
                            tt.setBienTheSanPham(bt);
                            tt.setTrangThaiDongBo("thanh_cong");
                            tt.setChiTietLoi(null);
                            mappingByBtId.put(bt.getId(), tt);
                        } else if (tt.getBienTheSanPham() == null) {
                            tt.setTrangThaiDongBo("chua_dong_bo");
                        }
                        if (tt.getMaSanPhamKenh() != null) {
                            mappingByMaKenh.put(tt.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), tt);
                        }
                        if (price != null) tt.setGiaBanSan(price);
                        trangThaiDongBoSanPhamRepository.save(tt);
                        soSku++;
                    }
                }
            }

            // Tự động nhận diện các sản phẩm đã bị xóa hoặc ngừng bán trên sàn Shopee (chuẩn WHM/Sapo)
            Set<Long> aliveItemIds = new HashSet<>(itemIds);
            for (TrangThaiDongBoSanPham item : existingList) {
                String mspk = item.getMaSanPhamKenh();
                if (mspk != null && !mspk.isBlank()) {
                    Long oldItemId = null;
                    if (mspk.contains(":")) {
                        try { oldItemId = Long.parseLong(mspk.split(":")[0]); } catch (Exception ignored) {}
                    } else if (mspk.matches("\\d+")) {
                        try { oldItemId = Long.parseLong(mspk); } catch (Exception ignored) {}
                    }
                    if (oldItemId != null && !aliveItemIds.contains(oldItemId)) {
                        xuLySanPhamBiXoaHoacBatThuongShopee(kenh, oldItemId, String.valueOf(shopId) + (OmnichannelOrderSyncJob.isShopeeSandbox(kenh.getMaKenh()) ? "_SANDBOX" : "_OFFICIAL"));
                    }
                }
            }
        } catch (Exception e) {
            log.error("[SHOPEE-SYNC] Lỗi tải sản phẩm Shopee: {}", e.getMessage(), e);
            throw new CommonException(ThongDiep.of("kenhBan.loiTaiSanPhamShopee", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }

        return TaiSanPhamResultDto.builder().soSku(soSku).soMoi(soMoi).soCapNhat(soCapNhat).build();
    }

    public record ShopeeCatalogCache(
            Map<String, String> skuToTargetId,
            Map<String, Long> titleToItemId,
            Map<String, Long> parentSkuToItemId,
            Map<Long, List<Map<String, Object>>> itemModels,
            Instant expiresAt,
            Instant createdAt
    ) {
        public boolean isValid() {
            return expiresAt != null && Instant.now().isBefore(expiresAt);
        }
    }

    private static final Map<String, ShopeeCatalogCache> SHOPEE_CATALOG_CACHE_BY_SHOP = new ConcurrentHashMap<>();

    /**
     * Tự động xử lý khi phát hiện sản phẩm trên Shopee bị xóa hoặc ở trạng thái bất thường (abnormal/banned/deleted).
     * 1. Xóa sản phẩm khỏi bộ nhớ đệm ShopeeCatalogCache trong RAM.
     * 2. Gỡ bỏ maSanPhamKenh (= null) và chuyển về trạng thái chua_dong_bo cho toàn bộ các biến thể thuộc itemId đó.
     * 3. Giúp người dùng hoặc tester có thể ngay lập tức đẩy lại từ đầu mà không bị kẹt lỗi 'status is abnormal'.
     */
    public void xuLySanPhamBiXoaHoacBatThuongShopee(KenhBanHang kenh, Long itemId, String shopKey) {
        if (itemId == null || itemId <= 0) return;
        log.warn("[SHOPEE-HEALING] Phát hiện sản phẩm Item ID {} trên Shopee bị xóa hoặc ở trạng thái bất thường. Tự động hủy liên kết trong DB và xóa RAM cache...", itemId);

        // 1. Evict khỏi RAM Cache
        if (shopKey != null) {
            SHOPEE_CATALOG_CACHE_BY_SHOP.remove(shopKey);
        } else {
            SHOPEE_CATALOG_CACHE_BY_SHOP.clear();
        }

        // 2. Gỡ bỏ liên kết trong DB cho toàn bộ biến thể của sản phẩm cha này
        if (kenh != null) {
            List<TrangThaiDongBoSanPham> list = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
            Instant now = Instant.now();
            String prefix = itemId + ":";
            String idStr = String.valueOf(itemId);
            for (TrangThaiDongBoSanPham m : list) {
                String mspk = m.getMaSanPhamKenh();
                if (mspk != null && (mspk.startsWith(prefix) || mspk.equals(idStr))) {
                    m.setMaSanPhamKenh(null);
                    m.setTrangThaiDongBo("chua_dong_bo");
                    m.setChiTietLoi("Sản phẩm trên Shopee đã bị xóa hoặc tạm khóa (trạng thái bất thường). Hệ thống đã tự động gỡ liên kết cũ để sẵn sàng tạo mới.");
                    m.setNgayDongBoCuoi(now);
                    trangThaiDongBoSanPhamRepository.save(m);
                }
            }
        }
    }

    private String chuanHoaTieuDeShopee(String title) {
        if (title == null) return "";
        String s = title.toLowerCase(Locale.ROOT).trim();
        s = s.replaceAll("(?i)\\s*-\\s*thời trang fcentric.*", "");
        s = s.replaceAll("[^a-z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ\\s]", " ");
        return s.replaceAll("\\s+", " ").trim();
    }

    public ShopeeCatalogCache layHoacCapNhatShopeeCatalog(
            com.dev.backend.services.shopee.ShopeeClient client,
            String shopKey,
            boolean forceRefresh) {
        if (!forceRefresh && shopKey != null) {
            ShopeeCatalogCache cached = SHOPEE_CATALOG_CACHE_BY_SHOP.get(shopKey);
            if (cached != null && cached.isValid()) {
                log.info("[SHOPEE-CATALOG] Sử dụng ShopeeCatalogCache từ RAM (shopKey={}, SKU count={}, item count={})",
                        shopKey, cached.skuToTargetId().size(), cached.titleToItemId().size());
                return cached;
            }
        }

        Map<String, String> skuToTargetId = new HashMap<>();
        Map<String, Long> titleToItemId = new HashMap<>();
        Map<String, Long> parentSkuToItemId = new HashMap<>();
        Map<Long, List<Map<String, Object>>> itemModels = new HashMap<>();

        if (client == null) {
            return new ShopeeCatalogCache(skuToTargetId, titleToItemId, parentSkuToItemId, itemModels, Instant.now().plus(30, ChronoUnit.MINUTES), Instant.now());
        }

        try {
            int offset = 0;
            int pageSize = 100;
            boolean hasNext = true;
            List<Long> allItemIds = new ArrayList<>();

            while (hasNext && offset < 1000) {
                JsonNode listRes = client.getItemList(offset, pageSize, "NORMAL");
                JsonNode items = listRes.path("response").path("item");
                if (!items.isArray() || items.isEmpty()) {
                    items = listRes.path("response").path("item_list");
                }
                if (items.isArray()) {
                    for (JsonNode it : items) {
                        long itId = it.path("item_id").asLong();
                        if (itId > 0 && !allItemIds.contains(itId)) {
                            allItemIds.add(itId);
                        }
                    }
                }
                hasNext = listRes.path("response").path("has_next_page").asBoolean(false);
                int nextOffset = listRes.path("response").path("next_offset").asInt(offset + pageSize);
                if (nextOffset <= offset) {
                    break;
                }
                offset = nextOffset;
            }

            // Quét thêm cả trạng thái UNLIST
            try {
                JsonNode unlistRes = client.getItemList(0, 100, "UNLIST");
                JsonNode unlistItems = unlistRes.path("response").path("item");
                if (!unlistItems.isArray() || unlistItems.isEmpty()) {
                    unlistItems = unlistRes.path("response").path("item_list");
                }
                if (unlistItems.isArray()) {
                    for (JsonNode it : unlistItems) {
                        long itId = it.path("item_id").asLong();
                        if (itId > 0 && !allItemIds.contains(itId)) {
                            allItemIds.add(itId);
                        }
                    }
                }
            } catch (Exception unlistEx) {
                log.debug("[SHOPEE-CATALOG] Không thể lấy item UNLIST: {}", unlistEx.getMessage());
            }

            // Gọi chi tiết getItemBaseInfo theo batch tối đa 50 itemIds
            if (!allItemIds.isEmpty()) {
                int batchSize = 50;
                for (int i = 0; i < allItemIds.size(); i += batchSize) {
                    List<Long> batchIds = allItemIds.subList(i, Math.min(i + batchSize, allItemIds.size()));
                    JsonNode detailRes = client.getItemBaseInfo(batchIds);
                    JsonNode itemList = detailRes.path("response").path("item_list");
                    if (itemList.isArray()) {
                        for (JsonNode itemNode : itemList) {
                            long itemId = itemNode.path("item_id").asLong();
                            String itemName = itemNode.path("item_name").asText("").trim();
                            String itemSku = itemNode.path("item_sku").asText("").trim();
                            if (!itemName.isBlank()) {
                                String normTitle = chuanHoaTieuDeShopee(itemName);
                                titleToItemId.put(normTitle, itemId);
                            }
                            if (!itemSku.isBlank()) {
                                parentSkuToItemId.put(itemSku.toLowerCase(Locale.ROOT), itemId);
                            }

                            boolean hasModel = itemNode.path("has_model").asBoolean(false);
                            JsonNode models = null;
                            if (hasModel) {
                                try {
                                    JsonNode modelRes = client.getModelList(itemId);
                                    models = modelRes.path("response").path("model");
                                    if (!models.isArray() || models.isEmpty()) {
                                        models = modelRes.path("response").path("model_list");
                                    }
                                } catch (Exception mEx) {
                                    log.warn("[SHOPEE-CATALOG] Lỗi lấy model_list cho item {}: {}", itemId, mEx.getMessage());
                                }
                            }
                            if (models == null || !models.isArray() || models.isEmpty()) {
                                models = itemNode.path("model");
                            }
                            if (models.isArray() && !models.isEmpty()) {
                                List<Map<String, Object>> mList = new ArrayList<>();
                                for (JsonNode modelNode : models) {
                                    long modelId = modelNode.path("model_id").asLong();
                                    String modelSku = modelNode.path("model_sku").asText("").trim();
                                    if (!modelSku.isBlank()) {
                                        skuToTargetId.put(modelSku.toLowerCase(Locale.ROOT), itemId + ":" + modelId);
                                    }
                                    mList.add(Map.of(
                                            "model_id", modelId,
                                            "model_sku", modelSku
                                    ));
                                }
                                itemModels.put(itemId, mList);
                            } else {
                                if (!itemSku.isBlank()) {
                                    skuToTargetId.put(itemSku.toLowerCase(Locale.ROOT), String.valueOf(itemId));
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-CATALOG] Lỗi nạp danh mục Shopee: {}", ex.getMessage());
        }

        ShopeeCatalogCache catalog = new ShopeeCatalogCache(
                skuToTargetId,
                titleToItemId,
                parentSkuToItemId,
                itemModels,
                Instant.now().plus(30, ChronoUnit.MINUTES),
                Instant.now()
        );
        if (shopKey != null) {
            SHOPEE_CATALOG_CACHE_BY_SHOP.put(shopKey, catalog);
        }
        return catalog;
    }

    private TuDongLienKetResultDto tuDongLienKetShopee(KenhBanHang kenh) {
        Long shopId = kenhBanHangService.getShopeeShopId(kenh != null ? kenh.getMaKenh() : "SHOPEE");
        if (shopId == null || shopId <= 0) {
            log.warn("[SHOPEE-SYNC] Kênh {} chưa có Shop ID định danh gian hàng hợp lệ, bỏ qua tự động liên kết.", kenh != null ? kenh.getMaKenh() : "SHOPEE");
            return TuDongLienKetResultDto.builder()
                    .soDaGhep(0).soKhongKhop(0).soNhieuKhop(0).soTaoMoiTrenShopify(0).soTonKhoDaDay(0).soThatBai(0)
                    .build();
        }
        List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findActiveVariantsWithDetails();
        if (activeVariants == null || activeVariants.isEmpty()) {
            activeVariants = bienTheSanPhamRepository.findByTrangThai(1);
        }
        if (activeVariants == null || activeVariants.isEmpty()) {
            return TuDongLienKetResultDto.builder()
                    .soDaGhep(0).soKhongKhop(0).soNhieuKhop(0).soTaoMoiTrenShopify(0).soTonKhoDaDay(0).soThatBai(0)
                    .build();
        }

        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClient(kenh);
        String shopKey = String.valueOf(shopId) + (OmnichannelOrderSyncJob.isShopeeSandbox(kenh.getMaKenh()) ? "_SANDBOX" : "_OFFICIAL");
        ShopeeCatalogCache catalog = layHoacCapNhatShopeeCatalog(client, shopKey, false);
        Map<String, String> skuToTargetId = new HashMap<>(catalog.skuToTargetId());

        // 1. Xác định toàn bộ danh sách kênh vận chuyển Shopee đang kích hoạt trên gian hàng
        List<Map<String, Object>> logisticInfoList = layDanhSachKenhVanChuyenShopee(client);

        // 2. Gom nhóm các biến thể FCentric theo sản phẩm cha (SanPhamQuanAo)
        // Đồng thời đối soát với bảng liên kết hiện có để không bỏ sót biến thể nào
        List<TrangThaiDongBoSanPham> existingMappings = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        Set<Integer> activeBtIds = activeVariants.stream().map(BienTheSanPham::getId).collect(Collectors.toSet());
        List<BienTheSanPham> mergedVariants = new ArrayList<>(activeVariants);
        for (TrangThaiDongBoSanPham m : existingMappings) {
            if (m.getBienTheSanPham() != null && !activeBtIds.contains(m.getBienTheSanPham().getId())
                    && !TRANG_THAI_NGUNG.equals(m.getTrangThaiDongBo())) {
                mergedVariants.add(m.getBienTheSanPham());
                activeBtIds.add(m.getBienTheSanPham().getId());
            }
        }

        Map<Integer, TrangThaiDongBoSanPham> mappingByBtId = new HashMap<>();
        for (TrangThaiDongBoSanPham m : existingMappings) {
            if (m.getBienTheSanPham() != null) {
                mappingByBtId.put(m.getBienTheSanPham().getId(), m);
            }
        }

        Map<SanPhamQuanAo, List<BienTheSanPham>> spGroupMap = mergedVariants.stream()
                .filter(bt -> bt.getSanPham() != null)
                .collect(Collectors.groupingBy(BienTheSanPham::getSanPham, LinkedHashMap::new, Collectors.toList()));

        int soTaoMoiTrenShopee = 0;
        int soThatBai = 0;
        Map<String, String> cdnCache = new HashMap<>();

        // 3. Cơ chế UPSERT: Nếu sản phẩm đã tồn tại trên Shopee -> chỉ đối soát và cập nhật tồn kho, KHÔNG gọi addItem
        for (Map.Entry<SanPhamQuanAo, List<BienTheSanPham>> entry : spGroupMap.entrySet()) {
            SanPhamQuanAo sp = entry.getKey();
            List<BienTheSanPham> spVariants = entry.getValue();

            Long existingItemId = null;

            // 3.1 Kiểm tra qua mapping đã lưu trong DB của các biến thể
            for (BienTheSanPham bt : spVariants) {
                TrangThaiDongBoSanPham tt = mappingByBtId.get(bt.getId());
                if (tt != null && tt.getMaSanPhamKenh() != null && !tt.getMaSanPhamKenh().isBlank()) {
                    String raw = tt.getMaSanPhamKenh().trim();
                    try {
                        long parsedId = Long.parseLong(raw.contains(":") ? raw.substring(0, raw.indexOf(":")) : raw);
                        if (parsedId > 0) {
                            existingItemId = parsedId;
                            break;
                        }
                    } catch (Exception ignored) {}
                }
            }

            // 3.2 Kiểm tra qua SKU trong catalog
            if (existingItemId == null) {
                for (BienTheSanPham bt : spVariants) {
                    if (bt.getMaSku() != null) {
                        String target = skuToTargetId.get(bt.getMaSku().trim().toLowerCase(Locale.ROOT));
                        if (target != null) {
                            try {
                                long parsedId = Long.parseLong(target.contains(":") ? target.substring(0, target.indexOf(":")) : target);
                                if (parsedId > 0) {
                                    existingItemId = parsedId;
                                    break;
                                }
                            } catch (Exception ignored) {}
                        }
                    }
                }
            }

            // 3.3 Kiểm tra qua tiêu đề sản phẩm (chống tạo trùng bài đăng)
            if (existingItemId == null && sp.getTenSanPham() != null) {
                String normTitle = chuanHoaTieuDeShopee(sp.getTenSanPham());
                if (!normTitle.isBlank() && catalog.titleToItemId().containsKey(normTitle)) {
                    existingItemId = catalog.titleToItemId().get(normTitle);
                }
            }

            // 3.4 Kiểm tra qua mã sản phẩm cha (parent item_sku)
            if (existingItemId == null && sp.getMaSanPham() != null) {
                String normParentSku = sp.getMaSanPham().trim().toLowerCase(Locale.ROOT);
                if (catalog.parentSkuToItemId().containsKey(normParentSku)) {
                    existingItemId = catalog.parentSkuToItemId().get(normParentSku);
                }
            }

            if (existingItemId != null) {
                // Kiểm tra xem sản phẩm Item ID này còn hoạt động trên Shopee hay không trước khi tin tưởng UPSERT
                boolean isAlive = true;
                String errorStr = "";
                JsonNode modelRes = null;
                try {
                    modelRes = client.getModelList(existingItemId);
                    String err = modelRes != null ? modelRes.path("error").asText("") : "";
                    String msg = modelRes != null ? modelRes.path("message").asText("") : "";
                    String combined = (err + " " + msg).toLowerCase(Locale.ROOT);
                    if (combined.contains("status is abnormal") || combined.contains("abnormal")
                            || combined.contains("not exist") || combined.contains("not found")
                            || combined.contains("does not exist") || combined.contains("deleted")
                            || combined.contains("100010041")) {
                        isAlive = false;
                        errorStr = msg.isBlank() ? err : msg;
                    }
                } catch (Exception mEx) {
                    if (mEx.getMessage() != null && (mEx.getMessage().toLowerCase(Locale.ROOT).contains("abnormal")
                            || mEx.getMessage().toLowerCase(Locale.ROOT).contains("not found"))) {
                        isAlive = false;
                        errorStr = mEx.getMessage();
                    }
                }

                if (isAlive) {
                    try {
                        JsonNode baseRes = client.getItemBaseInfo(List.of(existingItemId));
                        JsonNode itList = baseRes != null ? baseRes.path("response").path("item_list") : null;
                        if (itList == null || !itList.isArray() || itList.isEmpty()) {
                            isAlive = false;
                            errorStr = "Không tìm thấy thông tin sản phẩm trên Shopee (đã bị xóa)";
                        } else {
                            String itemStatus = itList.get(0).path("item_status").asText("");
                            if (!itemStatus.isBlank() && !"NORMAL".equalsIgnoreCase(itemStatus)) {
                                isAlive = false;
                                errorStr = "Sản phẩm trên Shopee ở trạng thái: " + itemStatus + " (không hoạt động)";
                            }
                        }
                    } catch (Exception bEx) {
                        log.warn("[SHOPEE-BASE-INFO] Lỗi kiểm tra item_status cho Item ID {}: {}", existingItemId, bEx.getMessage());
                    }
                }

                if (!isAlive) {
                    log.warn("[SHOPEE-UPSERT] Sản phẩm Item ID {} trên Shopee đã bị xóa hoặc ở trạng thái bất thường ({}). Tự động hủy liên kết cũ và chuyển sang tạo mới...",
                            existingItemId, errorStr);
                    xuLySanPhamBiXoaHoacBatThuongShopee(kenh, existingItemId, shopKey);
                    existingItemId = null; // Chuyển sang luồng tạo mới hoàn toàn
                } else {
                    // SẢN PHẨM ĐÃ CÓ TRÊN SHOPEE VÀ CÒN HOẠT ĐỘNG -> SMART UPSERT (CẬP NHẬT GIÁ + TỒN KHO)
                    log.info("[SHOPEE-UPSERT] Sản phẩm [{}] đã tồn tại và hoạt động trên Shopee (ItemId: {}). Tiến hành đối soát SKU, giá bán và tồn kho.",
                            sp.getTenSanPham(), existingItemId);

                    List<Map<String, Object>> models = new ArrayList<>();
                    if (modelRes != null) {
                        JsonNode mNode = modelRes.path("response").path("model");
                        if (!mNode.isArray() || mNode.isEmpty()) {
                            mNode = modelRes.path("response").path("model_list");
                        }
                        if (mNode.isArray() && !mNode.isEmpty()) {
                            for (JsonNode mn : mNode) {
                                BigDecimal curPrice = null;
                                JsonNode pInfo = mn.path("price_info");
                                if (pInfo.isArray() && !pInfo.isEmpty()) {
                                    curPrice = BigDecimal.valueOf(pInfo.get(0).path("original_price").asDouble(0.0));
                                }
                                models.add(Map.of(
                                        "model_id", mn.path("model_id").asLong(),
                                        "model_sku", mn.path("model_sku").asText("").trim(),
                                        "current_price", curPrice != null ? curPrice : BigDecimal.ZERO
                                ));
                            }
                        }
                    }

                    List<Map<String, Object>> stockUpdateList = new ArrayList<>();
                    boolean isSandbox = OmnichannelOrderSyncJob.isShopeeSandbox(kenh != null ? kenh.getMaKenh() : "");

                    for (BienTheSanPham bt : spVariants) {
                        if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
                        String normSku = bt.getMaSku().trim().toLowerCase(Locale.ROOT);

                        if (!models.isEmpty()) {
                            for (Map<String, Object> m : models) {
                                String mSku = String.valueOf(m.getOrDefault("model_sku", "")).trim().toLowerCase(Locale.ROOT);
                                if (normSku.equals(mSku)) {
                                    long mId = Long.parseLong(String.valueOf(m.get("model_id")));
                                    String targetVal = existingItemId + ":" + mId;
                                    skuToTargetId.put(normSku, targetVal);

                                    // 1. SMART DIFF GIÁ BÁN: Nếu giá FCentric thay đổi, cập nhật lên Shopee
                                    if (bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0) {
                                        BigDecimal newTargetPrice = chuanHoaGiaShopee(bt.getGiaBan(), isSandbox);
                                        BigDecimal curShopeePrice = (BigDecimal) m.getOrDefault("current_price", BigDecimal.ZERO);
                                        if (curShopeePrice == null || curShopeePrice.compareTo(BigDecimal.ZERO) == 0 || curShopeePrice.compareTo(newTargetPrice) != 0) {
                                            try {
                                                JsonNode pRes = client.updatePrice(existingItemId, mId, newTargetPrice);
                                                String pErr = pRes != null ? pRes.path("error").asText("") : "";
                                                String pMsg = pRes != null ? pRes.path("message").asText("") : "";
                                                String combinedErr = (pErr + " " + pMsg).toLowerCase(Locale.ROOT);
                                                if (combinedErr.contains("status is abnormal") || combinedErr.contains("abnormal")) {
                                                    xuLySanPhamBiXoaHoacBatThuongShopee(kenh, existingItemId, shopKey);
                                                    existingItemId = null;
                                                    break;
                                                }
                                                log.info("[SHOPEE-UPSERT] Cập nhật giá mới cho Item {} Model {}: {} VND", existingItemId, mId, newTargetPrice);
                                            } catch (Exception pEx) {
                                                log.warn("[SHOPEE-UPSERT] Lỗi cập nhật giá cho Item {}: {}", existingItemId, pEx.getMessage());
                                            }
                                        }
                                    }

                                    // 2. SMART DIFF TỒN KHO:
                                    int qty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));
                                    stockUpdateList.add(Map.of(
                                            "model_id", mId,
                                            "seller_stock", List.of(Map.of("stock", Math.max(0, qty)))
                                    ));
                                    break;
                                }
                            }
                        } else {
                            skuToTargetId.put(normSku, String.valueOf(existingItemId));
                            int qty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));
                            stockUpdateList.add(Map.of(
                                    "model_id", 0L,
                                    "seller_stock", List.of(Map.of("stock", Math.max(0, qty)))
                            ));
                        }
                    }

                    if (!stockUpdateList.isEmpty()) {
                        try {
                            JsonNode sRes = client.updateStockBatch(existingItemId, stockUpdateList);
                            String sErr = sRes != null ? sRes.path("error").asText("") : "";
                            String sMsg = sRes != null ? sRes.path("message").asText("") : "";
                            String combinedErr = (sErr + " " + sMsg).toLowerCase(Locale.ROOT);
                            if (combinedErr.contains("status is abnormal") || combinedErr.contains("abnormal")) {
                                xuLySanPhamBiXoaHoacBatThuongShopee(kenh, existingItemId, shopKey);
                            } else {
                                log.info("[SHOPEE-UPSERT] Cập nhật tồn kho thành công cho Item {} với {} biến thể",
                                        existingItemId, stockUpdateList.size());
                            }
                        } catch (Exception stEx) {
                            log.warn("[SHOPEE-UPSERT] Lỗi cập nhật tồn kho cho Item {}: {}", existingItemId, stEx.getMessage());
                        }
                    }
                }
            }

            if (existingItemId == null) {
                // SẢN PHẨM CHƯA CÓ TRÊN SHOPEE (hoặc vừa được phát hiện bị xóa trên sàn) -> Tạo mới hoàn chỉnh toàn bộ biến thể
                log.info("[SHOPEE-CREATE] Sản phẩm [{}] chưa có trên Shopee. Tiến hành tạo mới bài đăng với {} biến thể...",
                        sp.getTenSanPham(), spVariants.size());
                Map<String, String> createdMap = taoSanPhamLenShopee(
                        kenh, sp, spVariants, client, logisticInfoList, cdnCache);
                if (!createdMap.isEmpty()) {
                    soTaoMoiTrenShopee++;
                    skuToTargetId.putAll(createdMap);
                    SHOPEE_CATALOG_CACHE_BY_SHOP.remove(shopKey);
                } else {
                    soThatBai += spVariants.size();
                }
            }
        }

        int soDaGhep = 0;
        int soKhongKhop = 0;
        Instant now = Instant.now();

        for (BienTheSanPham bt : mergedVariants) {
            if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
            String normSku = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
            String targetSkuId = skuToTargetId.get(normSku);

            TrangThaiDongBoSanPham record = mappingByBtId.get(bt.getId());
            if (targetSkuId != null) {
                boolean dangNgung = false;
                if (record != null) {
                    dangNgung = Boolean.FALSE.equals(record.getChoPhepDongBo()) || TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo());
                    record.setMaSanPhamKenh(targetSkuId);
                    if (!dangNgung) {
                        record.setTrangThaiDongBo("thanh_cong");
                        record.setChiTietLoi(null);
                    }
                    record.setNgayDongBoCuoi(now);
                } else {
                    record = TrangThaiDongBoSanPham.builder()
                            .kenhBanHang(kenh)
                            .bienTheSanPham(bt)
                            .maSanPhamKenh(targetSkuId)
                            .trangThaiDongBo("thanh_cong")
                            .chiTietLoi(null)
                            .choPhepDongBo(true)
                            .ngayDongBoCuoi(now)
                            .build();
                }
                trangThaiDongBoSanPhamRepository.save(record);
                soDaGhep++;
            } else {
                if (record == null) {
                    record = TrangThaiDongBoSanPham.builder()
                            .kenhBanHang(kenh)
                            .bienTheSanPham(bt)
                            .trangThaiDongBo("chua_dong_bo")
                            .chiTietLoi("Chưa tìm thấy SKU tương ứng trên Shopee")
                            .ngayDongBoCuoi(now)
                            .build();
                    trangThaiDongBoSanPhamRepository.save(record);
                }
                soKhongKhop++;
            }
        }

        // Tự động đẩy tồn khả dụng cho các SKU vừa liên kết
        int soTonKhoDaDay = 0;
        try {
            DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
            if (dayTonRes != null) {
                soTonKhoDaDay = dayTonRes.getSoDong();
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-SYNC] Tự động đẩy tồn sau khi liên kết gặp lỗi: {}", ex.getMessage());
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham, "Tự động liên kết Shopee: tạo mới " + soTaoMoiTrenShopee + " sản phẩm, đã ghép " + soDaGhep + " SKU, không khớp " + soKhongKhop + " SKU, đã đẩy tồn " + soTonKhoDaDay + " SKU");

        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(soKhongKhop)
                .soNhieuKhop(0)
                .soTaoMoiTrenShopify(soTaoMoiTrenShopee)
                .soCapNhatTrenShopify(0)
                .soTonKhoDaDay(soTonKhoDaDay)
                .soThatBai(soThatBai)
                .build();
    }

    private String uploadAnhLenShopee(
            TepTin tep,
            String tenTep,
            String fallbackName,
            com.dev.backend.services.shopee.ShopeeClient client,
            Map<String, String> cdnCache) {
        if (tep == null || tep.getTenLuuTru() == null || tep.getTenLuuTru().isBlank() || client == null) {
            return null;
        }
        String fileKey = tep.getTenLuuTru();
        if (cdnCache != null && cdnCache.containsKey(fileKey)) {
            return cdnCache.get(fileKey);
        }
        if (tep.getMoTa() != null && tep.getMoTa().startsWith("SHP_IMG:")) {
            String cachedId = tep.getMoTa().substring("SHP_IMG:".length()).trim();
            if (!cachedId.isBlank()) {
                if (cdnCache != null) cdnCache.put(fileKey, cachedId);
                return cachedId;
            }
        }
        try {
            byte[] bytes = minioService.download(fileKey);
            byte[] cleanJpeg = convertToLazadaCompliantJpeg(bytes, fallbackName);
            if (cleanJpeg != null && cleanJpeg.length > 0) {
                JsonNode imgRes = client.uploadImage(cleanJpeg, tenTep != null ? tenTep : "shopee_img.jpg");
                String imgId = imgRes.path("response").path("image_info").path("image_id").asText("");
                if (!imgId.isBlank()) {
                    if (cdnCache != null) cdnCache.put(fileKey, imgId);
                    if (tepTinRepository != null) {
                        try {
                            tep.setMoTa("SHP_IMG:" + imgId);
                            tepTinRepository.save(tep);
                        } catch (Exception saveEx) {
                            log.warn("[SHOPEE-CDN-CACHE] Không thể lưu cache ảnh Shopee cho tệp {}: {}", tep.getId(), saveEx.getMessage());
                        }
                    }
                    return imgId;
                }
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-UPLOAD-IMAGE] Lỗi tải/upload ảnh {} lên Shopee: {}", fileKey, ex.getMessage());
        }
        return null;
    }

    private static final Map<String, String> CACHED_SHOPEE_SIZE_CHART_ID_BY_SHOP = new ConcurrentHashMap<>();
    private static final Map<String, List<Map<String, Object>>> CACHED_LOGISTICS_BY_SHOP = new ConcurrentHashMap<>();
    private static final Map<String, List<Map<String, Object>>> CACHED_MANDATORY_ATTRIBUTES = new ConcurrentHashMap<>();

    /**
     * Xác định toàn bộ danh sách kênh vận chuyển Shopee đang kích hoạt trên gian hàng.
     * Quy định Shopee Open Platform API v2: Bất kỳ kênh vận chuyển nào không được truyền trong
     * logistic_info sẽ bị Shopee coi là TẮT. Nếu shop có kênh force-enabled (như SPX Express, Điểm nhận hàng),
     * việc thiếu kênh sẽ làm sàn từ chối với lỗi "cannot disable a force-enabled channel" (mã 1326),
     * dẫn đến thông báo "Invalid product setting. Please verify."
     */
    public List<Map<String, Object>> layDanhSachKenhVanChuyenShopee(com.dev.backend.services.shopee.ShopeeClient client) {
        if (client == null) return List.of(Map.of("logistic_id", 5001L, "enabled", true));
        String shopKey = (client.getShopId() != null ? client.getShopId().toString() : "DEFAULT")
                + (client.isSandbox() ? "_SANDBOX" : "_OFFICIAL");
        List<Map<String, Object>> cached = CACHED_LOGISTICS_BY_SHOP.get(shopKey);
        if (cached != null && !cached.isEmpty()) {
            return cached;
        }

        List<Map<String, Object>> logisticInfoList = new ArrayList<>();
        try {
            JsonNode lRes = client.getLogisticsChannelList();
            JsonNode channels = lRes.path("response").path("logistics_channel_list");
            if (channels.isArray() && !channels.isEmpty()) {
                for (JsonNode cNode : channels) {
                    if (cNode.path("enabled").asBoolean(false)) {
                        logisticInfoList.add(Map.of(
                                "logistic_id", cNode.path("logistics_channel_id").asLong(),
                                "enabled", true
                        ));
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-LOGISTICS] Không thể lấy danh sách kênh vận chuyển từ Shopee: {}", ex.getMessage());
        }

        if (logisticInfoList.isEmpty()) {
            logisticInfoList.add(Map.of("logistic_id", 5001L, "enabled", true));
        }
        CACHED_LOGISTICS_BY_SHOP.put(shopKey, logisticInfoList);
        log.info("[SHOPEE-LOGISTICS] Đã nạp {} kênh vận chuyển kích hoạt cho shop {}", logisticInfoList.size(), shopKey);
        return logisticInfoList;
    }

    /**
     * Tự động tra cứu và thiết lập các thuộc tính bắt buộc (Mandatory Attributes) theo ngành hàng Shopee.
     * Tránh lỗi classification.attribute.mandatory (mã 100010237), đồng thời tuyệt đối không gửi thuộc tính
     * không thuộc ngành hàng (chống lỗi The attribute Gender is not mapped with the category).
     */
    public List<Map<String, Object>> layThuocTinhBatBuocShopee(com.dev.backend.services.shopee.ShopeeClient client, Long categoryId) {
        if (client == null || categoryId == null || categoryId <= 0) return Collections.emptyList();
        String cacheKey = (client.isSandbox() ? "SB_" : "PROD_") + categoryId;
        List<Map<String, Object>> cached = CACHED_MANDATORY_ATTRIBUTES.get(cacheKey);
        if (cached != null) return cached;

        List<Map<String, Object>> result = new ArrayList<>();
        try {
            JsonNode treeRes = client.getAttributeTree(categoryId);
            List<JsonNode> attrNodeList = new ArrayList<>();

            // 1. Cấu trúc chuẩn Shopee API v2 /api/v2/product/get_attribute_tree:
            // response.list[].attribute_tree[]
            JsonNode responseNode = treeRes.path("response");
            JsonNode listNode = responseNode.path("list");
            if (listNode.isArray() && !listNode.isEmpty()) {
                for (JsonNode item : listNode) {
                    JsonNode attrTree = item.path("attribute_tree");
                    if (attrTree.isArray()) {
                        for (JsonNode a : attrTree) {
                            attrNodeList.add(a);
                        }
                    }
                }
            }

            // 2. Cấu trúc thay thế: attribute_tree_list hoặc attribute_list trực tiếp dưới response
            if (attrNodeList.isEmpty()) {
                JsonNode treeList = responseNode.path("attribute_tree_list");
                if (!treeList.isArray() || treeList.isEmpty()) {
                    treeList = responseNode.path("attribute_list");
                }
                if (treeList.isArray()) {
                    for (JsonNode a : treeList) {
                        attrNodeList.add(a);
                    }
                }
            }

            for (JsonNode attr : attrNodeList) {
                boolean isMandatory = attr.path("mandatory").asBoolean(false) || attr.path("is_mandatory").asBoolean(false);
                if (isMandatory) {
                    long attrId = attr.path("attribute_id").asLong();
                    JsonNode valList = attr.path("attribute_value_list");
                    if (valList.isArray() && !valList.isEmpty()) {
                        JsonNode selectedVal = valList.get(0);
                        for (JsonNode v : valList) {
                            String vName = v.path("original_value_name").asText("").toLowerCase(Locale.ROOT);
                            String vDisplay = v.path("display_value_name").asText("").toLowerCase(Locale.ROOT);
                            if (vName.contains("unisex") || vDisplay.contains("unisex")
                                    || vName.contains("men") || vDisplay.contains("nam")
                                    || vName.contains("việt nam") || vDisplay.contains("vietnam")) {
                                selectedVal = v;
                                break;
                            }
                        }
                        long valId = selectedVal.path("value_id").asLong();
                        String origValName = selectedVal.path("original_value_name").asText("");
                        if (valId > 0 && attrId > 0) {
                            result.add(Map.of(
                                    "attribute_id", attrId,
                                    "attribute_value_list", List.of(Map.of(
                                            "value_id", valId,
                                            "original_value_name", origValName
                                    ))
                            ));
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-ATTR] Không thể lấy thuộc tính bắt buộc cho category {}: {}", categoryId, ex.getMessage());
        }

        CACHED_MANDATORY_ATTRIBUTES.put(cacheKey, result);
        return result;
    }

    /**
     * Chuẩn bị và tải bảng quy đổi kích cỡ (Size Chart) lên Shopee Media Space theo quy định của Shopee Open Platform v2.
     * Đối với ngành hàng thời trang may mặc (như Áo Polo, Quần Jeans, Áo khoác...), sàn bắt buộc cung cấp size_chart.
     * Tự động cache image_id theo shopId + loại sản phẩm (Tops / Pants) để tối ưu lượt upload ảnh lên sàn.
     */
    private String chuanBiSizeChartShopee(
            SanPhamQuanAo sp,
            com.dev.backend.services.shopee.ShopeeClient client,
            Map<String, String> cdnCache) {
        if (client == null) return null;
        String name = (sp != null && sp.getTenSanPham() != null) ? sp.getTenSanPham().toLowerCase(Locale.ROOT) : "";
        boolean isPants = name.contains("quần") || name.contains("jean") || name.contains("pant")
                || name.contains("short") || name.contains("kaki") || name.contains("trouser") || name.contains("jogger");
        String typeSuffix = isPants ? "_PANTS" : "_TOPS";

        String shopKey = (client.getShopId() != null ? client.getShopId().toString() : "DEFAULT")
                + (client.isSandbox() ? "_SANDBOX" : "_OFFICIAL") + typeSuffix;
        String cachedId = CACHED_SHOPEE_SIZE_CHART_ID_BY_SHOP.get(shopKey);
        if (cachedId != null && !cachedId.isBlank()) {
            return cachedId;
        }

        try {
            byte[] sizeChartBytes = taoFCentricSizeChartImage(sp != null ? sp.getTenSanPham() : null);
            if (sizeChartBytes != null && sizeChartBytes.length > 0) {
                String fileName = "fcentric_size_chart" + typeSuffix.toLowerCase(Locale.ROOT) + ".jpg";
                log.info("[SHOPEE-SIZE-CHART] Đang upload bảng quy đổi kích cỡ chuẩn FCentric ({}) lên Shopee Media Space...", fileName);
                JsonNode imgRes = client.uploadImage(sizeChartBytes, fileName);
                String imgId = imgRes.path("response").path("image_info").path("image_id").asText("");
                if (!imgId.isBlank()) {
                    log.info("[SHOPEE-SIZE-CHART] Upload size chart thành công lên Shopee! ImageId: {}", imgId);
                    CACHED_SHOPEE_SIZE_CHART_ID_BY_SHOP.put(shopKey, imgId);
                    if (cdnCache != null) {
                        cdnCache.put("SHOPEE_SIZE_CHART_" + shopKey, imgId);
                    }
                    return imgId;
                } else {
                    log.warn("[SHOPEE-SIZE-CHART] Không nhận được image_id từ Shopee: {}", imgRes);
                }
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-SIZE-CHART] Lỗi upload bảng kích cỡ lên Shopee: {}", ex.getMessage());
        }
        return null;
    }

    private List<String> chuanBiVaUploadAnhShopee(
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            com.dev.backend.services.shopee.ShopeeClient client,
            Map<String, String> cdnCache) {
        List<String> imageIds = new ArrayList<>();
        String productName = sp.getTenSanPham() != null ? sp.getTenSanPham().trim() : "FCentric";

        try {
            List<AnhQuanAo> prodImages = anhQuanAoRepository.findActiveByQuanAoIds(List.of(sp.getId()));
            if (prodImages != null && !prodImages.isEmpty()) {
                List<AnhQuanAo> sortedImages = new ArrayList<>(prodImages);
                sortedImages.sort((a, b) -> {
                    int aMain = Integer.valueOf(1).equals(a.getAnhChinh()) ? 1 : 0;
                    int bMain = Integer.valueOf(1).equals(b.getAnhChinh()) ? 1 : 0;
                    return Integer.compare(bMain, aMain);
                });

                int imgLimit = Math.min(sortedImages.size(), 8);
                for (int i = 0; i < imgLimit; i++) {
                    AnhQuanAo curImg = sortedImages.get(i);
                    if (curImg.getTepTin() != null) {
                        String imgId = uploadAnhLenShopee(curImg.getTepTin(), "sp_" + sp.getId() + "_" + i + ".jpg", productName, client, cdnCache);
                        if (imgId != null && !imgId.isBlank()) {
                            imageIds.add(imgId);
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-UPLOAD-IMAGE] Lỗi đọc ảnh sản phẩm {}: {}", productName, ex.getMessage());
        }

        // Bổ sung ảnh từ cấp biến thể (AnhBienThe) vào album sản phẩm nếu còn chỗ (Shopee tối đa 9 ảnh)
        if (imageIds.size() < 9 && variants != null && !variants.isEmpty()) {
            try {
                List<Integer> btIds = variants.stream().map(BienTheSanPham::getId).filter(Objects::nonNull).toList();
                if (!btIds.isEmpty()) {
                    List<AnhBienThe> abList = anhBienTheRepository.findActiveByBienTheIds(btIds);
                    if (abList != null) {
                        for (AnhBienThe ab : abList) {
                            if (imageIds.size() >= 9) break;
                            if (ab.getTepTin() != null) {
                                String imgId = uploadAnhLenShopee(ab.getTepTin(), "bt_" + (ab.getBienThe() != null ? ab.getBienThe().getId() : ab.getId()) + ".jpg", productName, client, cdnCache);
                                if (imgId != null && !imgId.isBlank() && !imageIds.contains(imgId)) {
                                    imageIds.add(imgId);
                                }
                            }
                        }
                    }
                }
            } catch (Exception abEx) {
                log.warn("[SHOPEE-UPLOAD-IMAGE] Lỗi nạp ảnh biến thể cho album sản phẩm {}: {}", productName, abEx.getMessage());
            }
        }

        // Nếu sản phẩm không có ảnh trong DB hoặc tải lỗi -> sinh ảnh mặc định chuẩn 800x800
        if (imageIds.isEmpty()) {
            try {
                byte[] defaultImg = taoLazadaDefaultImage(productName);
                if (defaultImg != null && defaultImg.length > 0) {
                    JsonNode imgRes = client.uploadImage(defaultImg, "fcentric_product.jpg");
                    String imgId = imgRes.path("response").path("image_info").path("image_id").asText("");
                    if (!imgId.isBlank()) {
                        imageIds.add(imgId);
                    }
                }
            } catch (Exception imgEx) {
                log.warn("[SHOPEE-UPLOAD-IMAGE] Không thể tạo/upload ảnh mặc định cho {}: {}", productName, imgEx.getMessage());
            }
        }

        return imageIds;
    }

    /**
     * Chuẩn hóa và phân loại lỗi từ Shopee Open Platform sang thông điệp hướng dẫn trực quan bằng tiếng Việt.
     * Chuyển đổi toàn bộ các mã lỗi kỹ thuật (size_chart, description length, category, token, rate limit...)
     * thành câu thông báo thân thiện với người dùng.
     */
    public String phanLoaiLoiShopee(String error, String rawMessage) {
        if (rawMessage == null) rawMessage = "";
        String msgLower = rawMessage.toLowerCase(Locale.ROOT);
        String errLower = (error != null ? error : "").toLowerCase(Locale.ROOT);
        String combined = (errLower + " " + msgLower).trim();

        if (combined.contains("still being created") || combined.contains("wait 5 seconds") || combined.contains("creating variation")) {
            return "Sản phẩm đang được Shopee khởi tạo ngầm. Vui lòng bấm Thử lại sau giây lát.";
        }
        if (combined.contains("invalid product setting") || combined.contains("logistics.channel") || combined.contains("force_enable") || combined.contains("1326")) {
            return "Cấu hình kênh vận chuyển hoặc kích thước sản phẩm chưa tương thích với Shopee. Hệ thống đã tự động bật đầy đủ kênh vận chuyển gian hàng.";
        }
        if (combined.contains("attribute is mandatory") || combined.contains("mandatory: id:") || combined.contains("100010237") || combined.contains("gender")) {
            return "Danh mục Shopee yêu cầu thuộc tính bắt buộc (Giới tính, Xuất xứ...). Hệ thống đã tự động bổ sung thuộc tính chuẩn.";
        }
        if (combined.contains("not mapped with the category") || combined.contains("remove it")) {
            return "Thuộc tính sản phẩm không tương thích với danh mục Shopee. Hệ thống đã tự động lọc bỏ thuộc tính không phù hợp.";
        }
        if (combined.contains("size_chart") || combined.contains("size chart")) {
            return "Danh mục yêu cầu bảng quy đổi kích cỡ (Size Chart). Hệ thống đã tự động tạo và tải bảng kích cỡ FCentric.";
        }
        if (combined.contains("description length") || combined.contains("description")) {
            return "Mô tả sản phẩm trên Shopee phải từ 100 đến 3000 ký tự. Hệ thống đã tự động bổ sung thông tin chi tiết.";
        }
        if (combined.contains("category") || combined.contains("invalid category")) {
            return "Mã ngành hàng Shopee không phù hợp hoặc đã thay đổi. Hệ thống đã tự động chuyển sang danh mục an toàn.";
        }
        if (combined.contains("access_token") || combined.contains("token") || combined.contains("expired") || combined.contains("authorize")) {
            return "Phiên kết nối Shopee đã hết hạn hoặc không hợp lệ. Vui lòng ủy quyền lại gian hàng.";
        }
        if (combined.contains("rate limit") || combined.contains("too many") || combined.contains("429")) {
            return "Shopee đang giới hạn tần suất gọi API. Hệ thống sẽ tự động thử lại sau.";
        }
        if (combined.contains("brand")) {
            return "Thương hiệu sản phẩm chưa được phê duyệt hoặc cần kiểm tra trên Shopee.";
        }
        if (combined.contains("image")) {
            return "Hình ảnh sản phẩm không đáp ứng quy chuẩn của Shopee (tối thiểu 1 ảnh, độ phân giải đạt chuẩn).";
        }
        if (combined.contains("weight") || combined.contains("dimension")) {
            return "Kích thước hoặc trọng lượng sản phẩm không hợp lệ theo quy định của Shopee.";
        }
        if (combined.contains("price_ratio") || combined.contains("price ratio") || combined.contains("exceeds 5")) {
            return "Tỷ lệ giá giữa các biến thể chênh lệch quá 5 lần theo quy định Shopee. Hệ thống đã tự động điều chỉnh giá sàn an toàn.";
        }
        if (combined.contains("duplicate") || combined.contains("trùng lặp")) {
            return "Sản phẩm bị trùng lặp với bài đăng đã có trên Shopee. Hệ thống đã tự động đổi tên phân biệt.";
        }
        if (combined.contains("price")) {
            return "Giá bán sản phẩm không nằm trong khoảng giá hợp lệ trên sàn Shopee.";
        }
        if (combined.contains("stock") || combined.contains("seller_stock")) {
            return "Số lượng tồn kho đẩy lên sàn Shopee không hợp lệ.";
        }
        if (combined.contains("status is abnormal") || combined.contains("abnormal")) {
            return "Sản phẩm trên Shopee đã bị xóa hoặc tạm khóa (trạng thái bất thường). Hệ thống đã tự động gỡ liên kết cũ, vui lòng bấm 'Đưa sản phẩm lên sàn' để đăng bán lại.";
        }
        if (combined.contains("not exist") || combined.contains("not_found") || combined.contains("does not exist") || combined.contains("deleted") || combined.contains("item_status_deleted") || combined.contains("100010041")) {
            return "Sản phẩm không tồn tại trên Shopee (đã bị xóa). Hệ thống đã tự động gỡ liên kết.";
        }
        return rawMessage.isBlank() ? ("Shopee từ chối thao tác (" + error + ")") : ("Shopee: " + rawMessage);
    }

    private void ghiNhanLoiTaoSanPhamShopee(KenhBanHang kenh, List<BienTheSanPham> variants, String error, String rawMessage) {
        String lyDoLoi = phanLoaiLoiShopee(error, rawMessage);
        ghiNhanLoiTaoSanPhamShopee(kenh, variants, lyDoLoi);
    }

    private void ghiNhanLoiTaoSanPhamShopee(KenhBanHang kenh, List<BienTheSanPham> variants, String lyDoLoi) {
        if (kenh == null || variants == null || variants.isEmpty()) return;
        Instant now = Instant.now();
        for (BienTheSanPham bt : variants) {
            if (bt == null || bt.getId() == null) continue;
            try {
                TrangThaiDongBoSanPham record = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId()).orElse(null);
                if (record == null) {
                    record = TrangThaiDongBoSanPham.builder()
                            .kenhBanHang(kenh)
                            .bienTheSanPham(bt)
                            .trangThaiDongBo("that_bai")
                            .chiTietLoi(lyDoLoi)
                            .ngayDongBoCuoi(now)
                            .build();
                } else {
                    record.setTrangThaiDongBo("that_bai");
                    record.setChiTietLoi(lyDoLoi);
                    record.setNgayDongBoCuoi(now);
                }
                trangThaiDongBoSanPhamRepository.save(record);
            } catch (Exception ex) {
                log.warn("[SHOPEE-SYNC] Không thể lưu trạng thái lỗi tạo sản phẩm cho SKU {}: {}", bt.getMaSku(), ex.getMessage());
            }
        }
    }

    private void ghiNhanLoiTaoSanPhamLazada(KenhBanHang kenh, List<BienTheSanPham> variants, String lyDoLoi) {
        if (kenh == null || variants == null || variants.isEmpty()) return;
        Instant now = Instant.now();
        for (BienTheSanPham bt : variants) {
            if (bt == null || bt.getId() == null) continue;
            try {
                TrangThaiDongBoSanPham record = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId()).orElse(null);
                if (record == null) {
                    record = TrangThaiDongBoSanPham.builder()
                            .kenhBanHang(kenh)
                            .bienTheSanPham(bt)
                            .trangThaiDongBo("that_bai")
                            .chiTietLoi(lyDoLoi)
                            .ngayDongBoCuoi(now)
                            .build();
                } else {
                    record.setTrangThaiDongBo("that_bai");
                    record.setChiTietLoi(lyDoLoi);
                    record.setNgayDongBoCuoi(now);
                }
                trangThaiDongBoSanPhamRepository.save(record);
            } catch (Exception ex) {
                log.warn("[LAZADA-SYNC] Không thể lưu trạng thái lỗi tạo sản phẩm cho SKU {}: {}", bt.getMaSku(), ex.getMessage());
            }
        }
    }

    private BigDecimal chuanHoaGiaShopee(BigDecimal giaGoc, boolean isSandbox) {
        if (giaGoc == null || giaGoc.compareTo(BigDecimal.ZERO) <= 0) {
            giaGoc = BigDecimal.valueOf(100000);
        }
        if (isSandbox) {
            // Shopee Sandbox SPX Express áp dụng trần giá tối đa <= 50.000 VND
            if (giaGoc.compareTo(BigDecimal.valueOf(45000)) > 0) {
                return BigDecimal.valueOf(45000);
            }
        }
        return giaGoc;
    }

    private record ShopeeCategoryNode(long id, long parentId, String name, String origName, boolean hasChildren) {}

    private record ShopeeCategoryLeaf(long id, String originalName, String displayName, long parentId, String fullPath, boolean isMenOrUnisex) {
        boolean matches(String keyword) {
            String kw = keyword.toLowerCase(Locale.ROOT);
            return (!displayName.isBlank() && displayName.contains(kw))
                    || (!originalName.isBlank() && originalName.contains(kw))
                    || (!fullPath.isBlank() && fullPath.contains(kw));
        }
    }
    private static final Map<Boolean, List<ShopeeCategoryLeaf>> SHOPEE_LEAF_CATEGORIES_BY_ENV = new java.util.concurrent.ConcurrentHashMap<>();

    private synchronized void taiDanhSachDanhMucShopee(com.dev.backend.services.shopee.ShopeeClient client, boolean isSandbox) {
        if (client == null) return;
        List<ShopeeCategoryLeaf> existing = SHOPEE_LEAF_CATEGORIES_BY_ENV.get(isSandbox);
        if (existing != null && !existing.isEmpty()) return;
        try {
            JsonNode catRes = client.getCategoryList("vi");
            JsonNode catList = catRes.path("response").path("category_list");
            if (!catList.isArray() || catList.isEmpty()) {
                catRes = client.getCategoryList("en");
                catList = catRes.path("response").path("category_list");
            }
            if (catList.isArray() && !catList.isEmpty()) {
                Map<Long, ShopeeCategoryNode> nodeMap = new HashMap<>();
                for (JsonNode c : catList) {
                    long catId = c.path("category_id").asLong();
                    long pId = c.path("parent_category_id").asLong();
                    String origName = c.path("original_category_name").asText("").trim();
                    String dispName = c.path("display_category_name").asText("").trim();
                    boolean hasChildren = c.path("has_children").asBoolean(true);
                    if (catId > 0) {
                        nodeMap.put(catId, new ShopeeCategoryNode(catId, pId, dispName, origName, hasChildren));
                    }
                }

                List<ShopeeCategoryLeaf> leaves = new ArrayList<>();
                for (ShopeeCategoryNode node : nodeMap.values()) {
                    if (!node.hasChildren()) {
                        long catId = node.id();
                        String origName = node.origName().toLowerCase(Locale.ROOT);
                        String dispName = node.name().toLowerCase(Locale.ROOT);
                        long pId = node.parentId();

                        // Truy ngược toàn bộ cây danh mục cha để xây dựng fullPath phân cấp
                        StringBuilder pathBuilder = new StringBuilder();
                        Long currId = catId;
                        Set<Long> visited = new HashSet<>();
                        while (currId != null && currId > 0 && !visited.contains(currId)) {
                            visited.add(currId);
                            ShopeeCategoryNode currNode = nodeMap.get(currId);
                            if (currNode == null) break;
                            if (pathBuilder.length() > 0) pathBuilder.insert(0, " > ");
                            pathBuilder.insert(0, currNode.name() + " " + currNode.origName());
                            currId = currNode.parentId();
                        }
                        String fullPath = pathBuilder.toString().toLowerCase(Locale.ROOT);

                        // Lọc chính xác các danh mục thuộc Thời Trang Nam hoặc Unisex, loại trừ thời trang nữ, trẻ em, thú cưng, bảo hộ xe máy
                        boolean isMenOrUnisex = (fullPath.contains("thời trang nam") || fullPath.contains("men clothes") || fullPath.contains("unisex"))
                                && !fullPath.contains("thời trang nữ") && !fullPath.contains("women")
                                && !fullPath.contains("bé") && !fullPath.contains("trẻ em") && !fullPath.contains("kids")
                                && !fullPath.contains("thú cưng") && !fullPath.contains("pet")
                                && !fullPath.contains("mô tô") && !fullPath.contains("xe máy");

                        leaves.add(new ShopeeCategoryLeaf(catId, origName, dispName, pId, fullPath, isMenOrUnisex));
                    }
                }
                SHOPEE_LEAF_CATEGORIES_BY_ENV.put(isSandbox, leaves);
                log.info("[SHOPEE-CAT] Đã nạp {} danh mục lá hợp lệ từ sàn Shopee (isSandbox={}, {} thuộc ngành Thời Trang Nam/Unisex)",
                        leaves.size(), isSandbox, leaves.stream().filter(ShopeeCategoryLeaf::isMenOrUnisex).count());
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-CAT] Không thể nạp danh mục từ Shopee (isSandbox={}): {}", isSandbox, ex.getMessage());
        }
    }

    private synchronized void taiDanhSachDanhMucShopee(com.dev.backend.services.shopee.ShopeeClient client) {
        taiDanhSachDanhMucShopee(client, client != null && client.isSandbox());
    }

    private Long timFallbackCategoryIdShopee(com.dev.backend.services.shopee.ShopeeClient client, boolean isSandbox, SanPhamQuanAo sp) {
        if (isSandbox) {
            return 106705L; // Leaf category an toàn tuyệt đối cho Shopee Sandbox (Áo Polo)
        }
        String tenSp = (sp != null && sp.getTenSanPham() != null ? sp.getTenSanPham().toLowerCase(Locale.ROOT) : "");
        String tenDm = (sp != null && sp.getDanhMuc() != null && sp.getDanhMuc().getTenDanhMuc() != null)
                ? sp.getDanhMuc().getTenDanhMuc().toLowerCase(Locale.ROOT) : "";
        String combined = (tenDm + " " + tenSp).trim();
        boolean laQuan = combined.contains("quần") || combined.contains("jean") || combined.contains("short") || combined.contains("pant");

        // Cho Shopee Official / Production:
        List<ShopeeCategoryLeaf> leafList = SHOPEE_LEAF_CATEGORIES_BY_ENV.get(false);
        if (leafList == null || leafList.isEmpty()) {
            taiDanhSachDanhMucShopee(client, false);
            leafList = SHOPEE_LEAF_CATEGORIES_BY_ENV.get(false);
        }
        if (leafList != null && !leafList.isEmpty()) {
            List<ShopeeCategoryLeaf> menLeaves = leafList.stream().filter(ShopeeCategoryLeaf::isMenOrUnisex).toList();
            List<ShopeeCategoryLeaf> searchList = menLeaves.isEmpty() ? leafList : menLeaves;
            if (laQuan) {
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("jean") || cat.matches("quần")) {
                        return cat.id();
                    }
                }
            } else {
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("polo") || cat.matches("thun") || cat.matches("áo")) {
                        return cat.id();
                    }
                }
            }
            return searchList.get(0).id();
        }
        // Fallback cứng chuẩn ngành thời trang nam Shopee VN (thuộc nhánh gốc Thời Trang Nam ID 100011)
        return laQuan ? 100047L : 100243L; // 100047 = Quần jean nam, 100243 = Áo polo nam (thuộc Thời Trang Nam 100011)
    }

    private Long timFallbackCategoryIdShopee(com.dev.backend.services.shopee.ShopeeClient client, boolean isSandbox) {
        return timFallbackCategoryIdShopee(client, isSandbox, null);
    }

    public Long timCategoryIdShopee(SanPhamQuanAo sp, com.dev.backend.services.shopee.ShopeeClient client, boolean isSandbox) {
        if (client != null) {
            taiDanhSachDanhMucShopee(client, isSandbox);
        }
        if (isSandbox) {
            return 106705L; // Leaf category an toàn tuyệt đối cho Shopee Sandbox (Áo Polo)
        }

        List<ShopeeCategoryLeaf> allLeaves = SHOPEE_LEAF_CATEGORIES_BY_ENV.get(false);
        if (sp != null && allLeaves != null && !allLeaves.isEmpty()) {
            String tenSp = (sp.getTenSanPham() != null ? sp.getTenSanPham().toLowerCase(Locale.ROOT) : "");
            String tenDm = (sp.getDanhMuc() != null && sp.getDanhMuc().getTenDanhMuc() != null)
                    ? sp.getDanhMuc().getTenDanhMuc().toLowerCase(Locale.ROOT) : "";
            String combined = (tenDm + " " + tenSp).trim();

            // Ưu tiên danh mục lá thuộc Thời Trang Nam / Unisex
            List<ShopeeCategoryLeaf> menLeaves = allLeaves.stream()
                    .filter(ShopeeCategoryLeaf::isMenOrUnisex)
                    .toList();
            List<ShopeeCategoryLeaf> searchList = menLeaves.isEmpty() ? allLeaves : menLeaves;

            // 1. Áo khoác / Outerwear / Blouson / Jacket / Gió / Bomber / Vest / Cardigan / Mùa đông
            if (combined.contains("khoác") || combined.contains("jacket") || combined.contains("blouson")
                    || combined.contains("bomber") || combined.contains("cardigan") || combined.contains("vest")
                    || combined.contains("gió") || combined.contains("blazer")) {
                // 1.1 Áo khoác gió (Windbreaker) - cực kỳ chuẩn cho Blouson cản gió
                if (combined.contains("gió") || combined.contains("blouson") || combined.contains("wind")) {
                    for (ShopeeCategoryLeaf cat : searchList) {
                        if (cat.matches("gió") || cat.matches("windbreaker")) {
                            return cat.id();
                        }
                    }
                }
                // 1.2 Áo khoác bomber / bóng chày
                if (combined.contains("bomber") || combined.contains("bóng chày") || combined.contains("varsity")) {
                    for (ShopeeCategoryLeaf cat : searchList) {
                        if (cat.matches("bomber") || cat.matches("bóng chày")) {
                            return cat.id();
                        }
                    }
                }
                // 1.3 Áo khoác mùa đông / nỉ / lót lông
                if (combined.contains("mùa đông") || combined.contains("lông") || combined.contains("nỉ") || combined.contains("fleece")) {
                    for (ShopeeCategoryLeaf cat : searchList) {
                        if (cat.matches("mùa đông") || cat.matches("lông") || cat.matches("nỉ")) {
                            return cat.id();
                        }
                    }
                }
                // 1.4 Áo khoác ngoài nói chung
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("khoác ngoài") || cat.matches("jackets") || cat.matches("áo khoác")) {
                        return cat.id();
                    }
                }
            }

            // 2. Quần Jeans / Bò / Denim
            if (combined.contains("jean") || combined.contains("bò") || combined.contains("denim")) {
                if (combined.contains("baggy") || combined.contains("rộng") || combined.contains("barrel")) {
                    for (ShopeeCategoryLeaf cat : searchList) {
                        if (cat.matches("baggy") || cat.matches("rộng")) {
                            return cat.id();
                        }
                    }
                }
                if (combined.contains("suông") || combined.contains("straight")) {
                    for (ShopeeCategoryLeaf cat : searchList) {
                        if (cat.matches("suông") || cat.matches("straight")) {
                            return cat.id();
                        }
                    }
                }
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("jean") || cat.matches("bò") || cat.matches("denim")) {
                        return cat.id();
                    }
                }
            }

            // 3. Quần short / Quần đùi / Ngắn
            if (combined.contains("short") || combined.contains("đùi") || combined.contains("ngắn")) {
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("short") || cat.matches("đùi") || cat.matches("ngắn")) {
                        return cat.id();
                    }
                }
            }

            // 4. Quần dài / Quần tây / Kaki / Pant / Trouser / Jogger
            if (combined.contains("quần") || combined.contains("pant") || combined.contains("trouser")
                    || combined.contains("kaki") || combined.contains("jogger")) {
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("tây") || cat.matches("dài") || cat.matches("kaki") || cat.matches("jogger")
                            || cat.matches("pant") || cat.matches("quần")) {
                        return cat.id();
                    }
                }
            }

            // 5. Áo Polo / Có cổ
            if (combined.contains("polo") || combined.contains("có cổ")) {
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("polo") || cat.matches("có cổ")) {
                        return cat.id();
                    }
                }
            }

            // 6. Áo sơ mi / Shirt
            if (combined.contains("sơ mi") || combined.contains("shirt")) {
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("sơ mi") || cat.matches("shirt")) {
                        return cat.id();
                    }
                }
            }

            // 7. Áo hoodie / Áo nỉ / Sweater
            if (combined.contains("hoodie") || combined.contains("sweater") || combined.contains("nỉ")) {
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("hoodie") || cat.matches("sweater") || cat.matches("nỉ")) {
                        return cat.id();
                    }
                }
            }

            // 8. Áo thun / Áo phông / T-shirt / Tee
            if (combined.contains("thun") || combined.contains("t-shirt") || combined.contains("tee") || combined.contains("phông")
                    || combined.contains("sportware") || combined.contains("thể thao")) {
                for (ShopeeCategoryLeaf cat : searchList) {
                    if (cat.matches("thun") || cat.matches("phông") || cat.matches("t-shirt") || cat.matches("tee")) {
                        return cat.id();
                    }
                }
            }

            // 9. So khớp lỏng lẻo trong nhóm Thời Trang Nam
            for (ShopeeCategoryLeaf cat : searchList) {
                if (combined.contains("áo") && (cat.matches("áo") || cat.matches("top") || cat.matches("shirt"))) {
                    return cat.id();
                }
            }
        }
        return timFallbackCategoryIdShopee(client, isSandbox, sp);
    }

    public Long timCategoryIdShopee(SanPhamQuanAo sp, com.dev.backend.services.shopee.ShopeeClient client) {
        return timCategoryIdShopee(sp, client, client != null && client.isSandbox());
    }

    public Long timCategoryIdShopee(SanPhamQuanAo sp) {
        return timCategoryIdShopee(sp, null, true);
    }

    public record KetQuaKiemTraTruocKhiTaoShopee(
            boolean hopLe,
            String lyDoLoi,
            String tieuDeChuan,
            String moTaChuan,
            Long categoryId,
            String sizeChartId,
            List<String> imageIds,
            List<Map<String, Object>> mandatoryAttrs
    ) {}

    /**
     * Tiền kiểm tra nghiêm ngặt (Pre-validation Guard) trước khi gọi Shopee addItem.
     * Chặn đứng 100% các request vi phạm định dạng tiêu chuẩn Shopee để bảo vệ tỷ lệ thành công API >= 98%.
     */
    public KetQuaKiemTraTruocKhiTaoShopee kiemTraHopLeTruocKhiTaoShopee(
            KenhBanHang kenh,
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            com.dev.backend.services.shopee.ShopeeClient client,
            Map<String, String> cdnCache) {

        if (sp == null || variants == null || variants.isEmpty()) {
            return new KetQuaKiemTraTruocKhiTaoShopee(false, "Sản phẩm không có biến thể để tạo trên Shopee", null, null, null, null, Collections.emptyList(), Collections.emptyList());
        }

        // 1. Tiêu đề: Khử từ khóa cấm/hàng giả, đảm bảo độ dài 20-120 ký tự
        String rawName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";
        rawName = rawName.replaceAll("(?i)\\bnick\\b", "Active");
        rawName = rawName.replaceAll("(?i)giả\\s+lông\\s+cừu", "Lông Cừu Nhân Tạo");
        rawName = rawName.replaceAll("(?i)\\bgiả\\b", "Nhân Tạo");
        rawName = rawName.replaceAll("(?i)\\bclimawarm\\b", "ClimaWarm FCentric");
        rawName = rawName.replaceAll("(?i)\\bclot\\b", "Streetwear");

        String title = rawName;
        if (title.length() < 20) {
            title = title + " - Thời trang FCentric chính hãng";
        }
        if (title.length() > 120) {
            title = title.substring(0, 120);
        }

        // 2. Mô tả: Đảm bảo độ dài 100-3000 ký tự theo quy chuẩn Shopee Official
        String rawDesc = (sp.getMoTa() != null && !sp.getMoTa().isBlank())
                ? sp.getMoTa().trim() : title;
        String desc = rawDesc;
        if (desc.length() < 100) {
            StringBuilder sb = new StringBuilder(desc);
            if (!desc.contains("Chất liệu")) {
                sb.append("\n\n- Chất liệu: Vải cao cấp mềm mại, co giãn, thoáng khí và thấm hút mồ hôi tối ưu.");
            }
            if (!desc.contains("Kiểu dáng") && !desc.contains("Thiết kế")) {
                sb.append("\n- Kiểu dáng: Thiết kế hiện đại, tôn dáng, chuẩn form thương hiệu thời trang FCentric.");
            }
            if (!desc.contains("Xuất xứ")) {
                sb.append("\n- Xuất xứ: Sản xuất tại Việt Nam bởi Công ty Cổ phần Thời trang FCentric.");
            }
            if (!desc.contains("Hướng dẫn")) {
                sb.append("\n- Hướng dẫn bảo quản: Giặt máy nhẹ nhàng, phơi nơi khô thoáng, tránh dùng chất tẩy mạnh.");
            }
            desc = sb.toString().trim();
            if (desc.length() < 100) {
                desc = desc + "\nCam kết sản phẩm FCentric chính hãng 100%, hỗ trợ đổi trả theo chính sách sàn Shopee.";
            }
        }
        if (desc.length() > 3000) {
            desc = desc.substring(0, 3000);
        }

        // 3. Ảnh sản phẩm
        List<String> imageIdList = chuanBiVaUploadAnhShopee(sp, variants, client, cdnCache);
        if (imageIdList == null || imageIdList.isEmpty()) {
            return new KetQuaKiemTraTruocKhiTaoShopee(false, "Thiếu ảnh sản phẩm hợp lệ theo quy chuẩn Shopee (tối thiểu 1 ảnh)", title, desc, null, null, Collections.emptyList(), Collections.emptyList());
        }

        // 4. Ngành hàng lá Shopee
        boolean isSandbox = OmnichannelOrderSyncJob.isShopeeSandbox(kenh != null ? kenh.getMaKenh() : "");
        Long categoryId = timCategoryIdShopee(sp, client, isSandbox);
        if (categoryId == null || categoryId <= 0) {
            return new KetQuaKiemTraTruocKhiTaoShopee(false, "Không xác định được danh mục phù hợp trên Shopee cho ngành hàng này", title, desc, null, null, imageIdList, Collections.emptyList());
        }

        // 5. Bảng size chart
        String sizeChartId = chuanBiSizeChartShopee(sp, client, cdnCache);

        // 6. Thuộc tính bắt buộc
        List<Map<String, Object>> mandatoryAttrs = layThuocTinhBatBuocShopee(client, categoryId);

        return new KetQuaKiemTraTruocKhiTaoShopee(true, null, title, desc, categoryId, sizeChartId, imageIdList, mandatoryAttrs);
    }

    public Map<String, String> taoSanPhamLenShopee(
            KenhBanHang kenh,
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            com.dev.backend.services.shopee.ShopeeClient client,
            List<Map<String, Object>> logisticInfoList,
            Map<String, String> cdnCache) {
        Map<String, String> createdSkuMap = new HashMap<>();
        if (sp == null || variants == null || variants.isEmpty()) {
            return createdSkuMap;
        }

        // Tiền kiểm tra nghiêm ngặt trước khi gửi bất kỳ request nào lên Shopee
        KetQuaKiemTraTruocKhiTaoShopee check = kiemTraHopLeTruocKhiTaoShopee(kenh, sp, variants, client, cdnCache);
        if (!check.hopLe()) {
            log.warn("[SHOPEE-PRE-VALIDATE] Tiền kiểm tra thất bại cho sản phẩm [{}]: {}. Ngừng gọi API Shopee để bảo toàn SLA.",
                    sp.getTenSanPham(), check.lyDoLoi());
            ghiNhanLoiTaoSanPhamShopee(kenh, variants, check.lyDoLoi());
            return createdSkuMap;
        }

        String title = check.tieuDeChuan();
        String desc = check.moTaChuan();
        Long categoryId = check.categoryId();
        String sizeChartId = check.sizeChartId();
        List<String> imageIdList = check.imageIds();
        List<Map<String, Object>> mandatoryAttrs = check.mandatoryAttrs();
        boolean isSandbox = OmnichannelOrderSyncJob.isShopeeSandbox(kenh != null ? kenh.getMaKenh() : "");

        // Trường hợp sản phẩm chỉ có 1 biến thể (Single SKU)
        if (variants.size() == 1) {
            BienTheSanPham bt = variants.get(0);
            String sku = bt.getMaSku() != null ? bt.getMaSku().trim() : ("SKU-" + bt.getId());
            BigDecimal price = bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0
                    ? bt.getGiaBan() : BigDecimal.valueOf(100000);
            price = chuanHoaGiaShopee(price, isSandbox);
            int qty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("original_price", price.doubleValue());
            body.put("description", desc);
            body.put("weight", 0.3);
            body.put("dimension", Map.of("package_length", 25, "package_width", 20, "package_height", 5));
            body.put("item_name", title);
            body.put("category_id", categoryId);
            body.put("image", Map.of("image_id_list", imageIdList));
            body.put("logistic_info", logisticInfoList);
            body.put("brand", Map.of("brand_id", 0, "original_brand_name", "No Brand"));
            body.put("item_status", "NORMAL");
            body.put("seller_stock", List.of(Map.of("stock", Math.max(0, qty))));
            body.put("item_sku", sku);
            if (sizeChartId != null && !sizeChartId.isBlank()) {
                body.put("size_chart_info", Map.of("size_chart", sizeChartId));
                body.put("size_chart", sizeChartId);
            }
            if (mandatoryAttrs != null && !mandatoryAttrs.isEmpty()) {
                body.put("attribute_list", mandatoryAttrs);
            }

            log.info("[SHOPEE-CREATE] Đang tạo sản phẩm đơn SKU [{}] lên Shopee...", title);
            JsonNode addRes = client.addItem(body);
            String error = addRes.path("error").asText("");
            if (!error.isBlank() && !"0".equals(error)) {
                String errMsg = addRes.path("message").asText(error);
                if (errMsg.toLowerCase(Locale.ROOT).contains("duplicate") || error.toLowerCase(Locale.ROOT).contains("duplicate")) {
                    log.warn("[SHOPEE-CREATE] Single SKU [{}] đã tồn tại trên Shopee (trùng lặp). Ngừng tạo mới để chống vi phạm chính sách Duplicate Listing.", title);
                    ghiNhanLoiTaoSanPhamShopee(kenh, variants, "Sản phẩm đã tồn tại trên Shopee (trùng lặp bài đăng)");
                    return createdSkuMap;
                }
                Long fallbackCatId = timFallbackCategoryIdShopee(client, isSandbox);
                if (!error.isBlank() && !"0".equals(error) && (errMsg.toLowerCase(Locale.ROOT).contains("category") || error.toLowerCase(Locale.ROOT).contains("category"))
                        && !fallbackCatId.equals(body.get("category_id"))) {
                    log.warn("[SHOPEE-CREATE] Single SKU CategoryId {} bị sàn từ chối ({}), tự động đổi sang danh mục an toàn {} và thử lại...", body.get("category_id"), errMsg, fallbackCatId);
                    body.put("category_id", fallbackCatId);
                    List<Map<String, Object>> retryAttrs = layThuocTinhBatBuocShopee(client, fallbackCatId);
                    if (!retryAttrs.isEmpty()) {
                        body.put("attribute_list", retryAttrs);
                    } else {
                        body.remove("attribute_list");
                    }
                    addRes = client.addItem(body);
                    error = addRes.path("error").asText("");
                    errMsg = addRes.path("message").asText(error);
                } else if (!error.isBlank() && !"0".equals(error) && (errMsg.toLowerCase(Locale.ROOT).contains("size_chart") || error.toLowerCase(Locale.ROOT).contains("size_chart"))
                        && !body.containsKey("size_chart_info")) {
                    String retrySizeChart = chuanBiSizeChartShopee(sp, client, cdnCache);
                    if (retrySizeChart != null && !retrySizeChart.isBlank()) {
                        body.put("size_chart_info", Map.of("size_chart", retrySizeChart));
                        body.put("size_chart", retrySizeChart);
                        addRes = client.addItem(body);
                        error = addRes.path("error").asText("");
                    }
                }
            }
            if (error.isBlank() || "0".equals(error)) {
                long itemId = addRes.path("response").path("item_id").asLong();
                if (itemId > 0) {
                    log.info("[SHOPEE-CREATE] Tạo sản phẩm đơn thành công trên Shopee! ItemId: {}", itemId);
                    createdSkuMap.put(sku.toLowerCase(Locale.ROOT), String.valueOf(itemId));
                    return createdSkuMap;
                }
            }
            String errMsg = addRes.path("message").asText(error);
            log.warn("[SHOPEE-CREATE] Shopee từ chối tạo sản phẩm đơn [{}]: error={} - message={}", title, error, errMsg);
            ghiNhanLoiTaoSanPhamShopee(kenh, variants, error, errMsg);
            return createdSkuMap;
        }

        // Trường hợp sản phẩm có nhiều biến thể (Multi-variant)
        List<String> colors = new ArrayList<>();
        List<String> sizes = new ArrayList<>();

        for (BienTheSanPham bt : variants) {
            String c = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank())
                    ? bt.getMauSac().getTenMau().trim() : null;
            if (c != null && !colors.contains(c)) colors.add(c);

            String s = (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank())
                    ? bt.getSize().getTenSize().trim() : null;
            if (s != null && !sizes.contains(s)) sizes.add(s);
        }

        boolean hasColor = !colors.isEmpty();
        boolean hasSize = !sizes.isEmpty();
        if (!hasColor && !hasSize) {
            for (BienTheSanPham bt : variants) {
                String label = bt.getMaSku() != null ? bt.getMaSku().trim() : ("BT-" + bt.getId());
                colors.add(label);
            }
            hasColor = true;
        }

        BigDecimal minPrice = variants.stream()
                .map(bt -> bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0 ? bt.getGiaBan() : BigDecimal.valueOf(100000))
                .min(BigDecimal::compareTo).orElse(BigDecimal.valueOf(100000));
        BigDecimal maxPrice = variants.stream()
                .map(bt -> bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0 ? bt.getGiaBan() : BigDecimal.valueOf(100000))
                .max(BigDecimal::compareTo).orElse(BigDecimal.valueOf(100000));

        minPrice = chuanHoaGiaShopee(minPrice, isSandbox);
        maxPrice = chuanHoaGiaShopee(maxPrice, isSandbox);

        // Quy định Shopee Open Platform v2: Tỷ lệ giá max / min giữa các biến thể không được vượt quá 5.0
        BigDecimal minFloorRatioPrice = maxPrice.divide(BigDecimal.valueOf(4.5), 0, RoundingMode.CEILING);
        if (minPrice.compareTo(minFloorRatioPrice) < 0) {
            log.info("[SHOPEE-PRICE-RATIO] Giá thấp nhất {} VND vi phạm tỷ lệ 5x so với giá cao nhất {} VND. Nâng giá sàn lên {} VND.",
                    minPrice, maxPrice, minFloorRatioPrice);
            minPrice = minFloorRatioPrice;
        }
        String parentSku = (sp.getMaSanPham() != null && !sp.getMaSanPham().isBlank()) ? sp.getMaSanPham().trim() : ("SP-" + sp.getId());

        // 1. Tạo sản phẩm cha trên Shopee
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("original_price", minPrice.doubleValue());
        body.put("description", desc);
        body.put("weight", 0.3);
        body.put("dimension", Map.of("package_length", 25, "package_width", 20, "package_height", 5));
        body.put("item_name", title);
        body.put("category_id", categoryId);
        body.put("image", Map.of("image_id_list", imageIdList));
        body.put("logistic_info", logisticInfoList);
        body.put("brand", Map.of("brand_id", 0, "original_brand_name", "No Brand"));
        body.put("item_status", "NORMAL");
        body.put("seller_stock", List.of(Map.of("stock", 0))); // Tồn kho sẽ do Tier Variation quản lý
        body.put("item_sku", parentSku);
        if (sizeChartId != null && !sizeChartId.isBlank()) {
            body.put("size_chart_info", Map.of("size_chart", sizeChartId));
            body.put("size_chart", sizeChartId);
        }
        if (mandatoryAttrs != null && !mandatoryAttrs.isEmpty()) {
            body.put("attribute_list", mandatoryAttrs);
        }

        log.info("[SHOPEE-CREATE] Đang tạo sản phẩm cha [{}] với {} biến thể lên Shopee...", title, variants.size());
        JsonNode addRes = client.addItem(body);
        String error = addRes.path("error").asText("");
        if (!error.isBlank() && !"0".equals(error)) {
            String errMsg = addRes.path("message").asText(error);
            if (errMsg.toLowerCase(Locale.ROOT).contains("duplicate") || error.toLowerCase(Locale.ROOT).contains("duplicate")) {
                log.warn("[SHOPEE-CREATE] Multi-variant [{}] đã tồn tại trên Shopee (trùng lặp). Ngừng tạo mới để chống vi phạm chính sách Duplicate Listing.", title);
                ghiNhanLoiTaoSanPhamShopee(kenh, variants, "Sản phẩm đã tồn tại trên Shopee (trùng lặp bài đăng)");
                return createdSkuMap;
            }
            Long fallbackCatId = timFallbackCategoryIdShopee(client, isSandbox);
            if (!error.isBlank() && !"0".equals(error) && (errMsg.toLowerCase(Locale.ROOT).contains("category") || error.toLowerCase(Locale.ROOT).contains("category"))
                    && !fallbackCatId.equals(body.get("category_id"))) {
                log.warn("[SHOPEE-CREATE] Multi-variant CategoryId {} bị sàn từ chối ({}), tự động đổi sang danh mục an toàn {} và thử lại...", body.get("category_id"), errMsg, fallbackCatId);
                body.put("category_id", fallbackCatId);
                List<Map<String, Object>> retryAttrs = layThuocTinhBatBuocShopee(client, fallbackCatId);
                if (!retryAttrs.isEmpty()) {
                    body.put("attribute_list", retryAttrs);
                } else {
                    body.remove("attribute_list");
                }
                addRes = client.addItem(body);
                error = addRes.path("error").asText("");
                errMsg = addRes.path("message").asText(error);
            } else if (!error.isBlank() && !"0".equals(error) && (errMsg.toLowerCase(Locale.ROOT).contains("size_chart") || error.toLowerCase(Locale.ROOT).contains("size_chart"))
                    && !body.containsKey("size_chart_info")) {
                String retrySizeChart = chuanBiSizeChartShopee(sp, client, cdnCache);
                if (retrySizeChart != null && !retrySizeChart.isBlank()) {
                    body.put("size_chart_info", Map.of("size_chart", retrySizeChart));
                    body.put("size_chart", retrySizeChart);
                    addRes = client.addItem(body);
                    error = addRes.path("error").asText("");
                }
            }
        }
        if (!error.isBlank() && !"0".equals(error)) {
            String errMsg = addRes.path("message").asText(error);
            log.warn("[SHOPEE-CREATE] Shopee từ chối tạo sản phẩm cha [{}]: error={} - message={}", title, error, errMsg);
            ghiNhanLoiTaoSanPhamShopee(kenh, variants, error, errMsg);
            return createdSkuMap;
        }

        long itemId = addRes.path("response").path("item_id").asLong();
        if (itemId <= 0) {
            log.warn("[SHOPEE-CREATE] Không nhận được item_id hợp lệ từ Shopee cho [{}]", title);
            ghiNhanLoiTaoSanPhamShopee(kenh, variants, "Không nhận được item_id hợp lệ từ Shopee");
            return createdSkuMap;
        }

        log.info("[SHOPEE-CREATE] Tạo sản phẩm cha thành công trên Shopee (ItemId: {}). Đang khởi tạo bảng phân loại...", itemId);

        // Chuẩn bị ảnh cho từng màu sắc phân loại (Tier 1 variation)
        Map<String, String> colorToImageId = new HashMap<>();
        try {
            List<Integer> btIds = variants.stream().map(BienTheSanPham::getId).filter(Objects::nonNull).toList();
            if (!btIds.isEmpty()) {
                List<AnhBienThe> abList = anhBienTheRepository.findActiveByBienTheIds(btIds);
                if (abList != null) {
                    for (AnhBienThe ab : abList) {
                        if (ab.getBienThe() != null && ab.getTepTin() != null) {
                            String colorName = (ab.getBienThe().getMauSac() != null && ab.getBienThe().getMauSac().getTenMau() != null)
                                    ? ab.getBienThe().getMauSac().getTenMau().trim() : null;
                            if (colorName != null && !colorName.isBlank() && !colorToImageId.containsKey(colorName)) {
                                String imgId = uploadAnhLenShopee(ab.getTepTin(), "tier_" + ab.getBienThe().getId() + ".jpg", title, client, cdnCache);
                                if (imgId != null && !imgId.isBlank()) {
                                    colorToImageId.put(colorName, imgId);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-TIER-IMAGE] Lỗi nạp ảnh phân loại biến thể Shopee: {}", ex.getMessage());
        }

        // 2. Chuẩn bị bảng phân loại tier_variation kèm ảnh option cho Tier 1
        List<Map<String, Object>> tierVariationList = new ArrayList<>();
        List<Map<String, Object>> colorOptionList = new ArrayList<>();
        for (String c : colors) {
            Map<String, Object> opt = new LinkedHashMap<>();
            opt.put("option", c);
            String imgId = colorToImageId.get(c);
            if (imgId != null && !imgId.isBlank()) {
                opt.put("image", Map.of("image_id", imgId));
            }
            colorOptionList.add(opt);
        }

        if (hasColor && hasSize) {
            tierVariationList.add(Map.of("name", "Màu sắc", "option_list", colorOptionList));
            tierVariationList.add(Map.of("name", "Kích cỡ", "option_list", sizes.stream().map(s -> Map.of("option", s)).toList()));
        } else if (hasColor) {
            tierVariationList.add(Map.of("name", "Màu sắc", "option_list", colorOptionList));
        } else {
            tierVariationList.add(Map.of("name", "Kích cỡ", "option_list", sizes.stream().map(s -> Map.of("option", s)).toList()));
        }

        // 3. Chuẩn bị danh sách model
        List<Map<String, Object>> modelList = new ArrayList<>();
        Map<String, BienTheSanPham> tierIndexToVariant = new HashMap<>();

        for (BienTheSanPham bt : variants) {
            String sku = bt.getMaSku() != null ? bt.getMaSku().trim() : ("SKU-" + bt.getId());
            BigDecimal price = bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0
                    ? bt.getGiaBan() : minPrice;
            price = chuanHoaGiaShopee(price, isSandbox);
            if (price.compareTo(minFloorRatioPrice) < 0) {
                log.info("[SHOPEE-PRICE-RATIO] Giá biến thể SKU {} ({} VND) vi phạm tỷ lệ 5x so với giá cao nhất ({} VND). Tự động nâng giá lên {} VND để thỏa mãn Shopee.",
                        sku, price, maxPrice, minFloorRatioPrice);
                price = minFloorRatioPrice;
            }
            int qty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));

            List<Integer> tierIndex = new ArrayList<>();
            if (hasColor && hasSize) {
                String c = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null) ? bt.getMauSac().getTenMau().trim() : "";
                String s = (bt.getSize() != null && bt.getSize().getTenSize() != null) ? bt.getSize().getTenSize().trim() : "";
                int cIdx = Math.max(0, colors.indexOf(c));
                int sIdx = Math.max(0, sizes.indexOf(s));
                tierIndex.add(cIdx);
                tierIndex.add(sIdx);
            } else if (hasColor) {
                String c = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null) ? bt.getMauSac().getTenMau().trim() : "";
                int cIdx = Math.max(0, colors.indexOf(c));
                tierIndex.add(cIdx);
            } else {
                String s = (bt.getSize() != null && bt.getSize().getTenSize() != null) ? bt.getSize().getTenSize().trim() : "";
                int sIdx = Math.max(0, sizes.indexOf(s));
                tierIndex.add(sIdx);
            }

            String keyIdx = tierIndex.stream().map(String::valueOf).collect(Collectors.joining(","));
            tierIndexToVariant.put(keyIdx, bt);

            Map<String, Object> modelMap = new LinkedHashMap<>();
            modelMap.put("tier_index", tierIndex);
            modelMap.put("original_price", price.doubleValue());
            modelMap.put("seller_stock", List.of(Map.of("stock", Math.max(0, qty))));
            modelMap.put("model_sku", sku);
            modelList.add(modelMap);
        }

        Map<String, Object> tierBody = new LinkedHashMap<>();
        tierBody.put("item_id", itemId);
        tierBody.put("tier_variation", tierVariationList);
        tierBody.put("model", modelList);

        // Shopee Open Platform API v2: Shopee cần 3-5 giây để hoàn tất đồng bộ nội bộ item_id trước khi cho phép gắn biến thể.
        // Chờ 5.5s trước khi gọi lần đầu để hạn chế tối đa lỗi "The item is still being created. Please wait 5 seconds before creating variation."
        try {
            log.info("[SHOPEE-CREATE] Chờ 6000ms để Shopee hoàn tất tạo ngầm item_id {}...", itemId);
            Thread.sleep(6000L);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }

        JsonNode tierRes = client.initTierVariation(tierBody);
        String tError = tierRes.path("error").asText("");
        String tErrMsg = tierRes.path("message").asText(tError);

        int maxRetries = 4;
        int retryCount = 0;
        while (!tError.isBlank() && !"0".equals(tError) && retryCount < maxRetries) {
            String combinedErr = (tError + " " + tErrMsg).toLowerCase(Locale.ROOT);
            if (combinedErr.contains("still being created") || combinedErr.contains("wait 5 seconds") || combinedErr.contains("creating variation")) {
                retryCount++;
                long sleepMs = (retryCount == 1 ? 6000L : (retryCount == 2 ? 8000L : 12000L));
                log.info("[SHOPEE-CREATE] Shopee đang khởi tạo ngầm sản phẩm {} (lần thử {}/{}). Chờ {}ms trước khi gọi lại initTierVariation...",
                        itemId, retryCount, maxRetries, sleepMs);
                try {
                    Thread.sleep(sleepMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
                tierRes = client.initTierVariation(tierBody);
                tError = tierRes.path("error").asText("");
                tErrMsg = tierRes.path("message").asText(tError);
            } else {
                break;
            }
        }

        if (!tError.isBlank() && !"0".equals(tError)) {
            log.warn("[SHOPEE-CREATE] Lỗi khi tạo bảng phân loại cho item_id {}: error={} - message={}. Giữ nguyên sản phẩm cha để retry ngầm mà không xóa rác.",
                    itemId, tError, tErrMsg);
            // TUYỆT ĐỐI KHÔNG GỌI deleteItem(itemId)!
            // Lưu itemId để người dùng có thể bấm 'Thử lại' hoặc đợt sync sau gắn tiếp variation
            for (BienTheSanPham bt : variants) {
                if (bt.getMaSku() != null) {
                    createdSkuMap.put(bt.getMaSku().trim().toLowerCase(Locale.ROOT), String.valueOf(itemId));
                }
            }
            ghiNhanLoiTaoSanPhamShopee(kenh, variants, "Shopee đang khởi tạo ngầm phân loại sản phẩm. Vui lòng bấm 'Thử lại' sau ít phút để hoàn tất.");
            return createdSkuMap;
        }

        JsonNode modelIdList = tierRes.path("response").path("model");
        if (!modelIdList.isArray() || modelIdList.isEmpty()) {
            modelIdList = tierRes.path("response").path("model_id_list");
        }
        if (modelIdList.isArray()) {
            for (JsonNode mNode : modelIdList) {
                long modelId = mNode.path("model_id").asLong();
                String modelSku = mNode.path("model_sku").asText("").trim();
                if (!modelSku.isBlank()) {
                    createdSkuMap.put(modelSku.toLowerCase(Locale.ROOT), itemId + ":" + modelId);
                }
                JsonNode idxArr = mNode.path("tier_index");
                List<String> idxList = new ArrayList<>();
                if (idxArr.isArray()) {
                    for (JsonNode idx : idxArr) {
                        idxList.add(String.valueOf(idx.asInt()));
                    }
                }
                String keyIdx = String.join(",", idxList);
                BienTheSanPham matchedBt = tierIndexToVariant.get(keyIdx);
                if (matchedBt != null && matchedBt.getMaSku() != null) {
                    String skuNorm = matchedBt.getMaSku().trim().toLowerCase(Locale.ROOT);
                    createdSkuMap.put(skuNorm, itemId + ":" + modelId);
                }
            }
        }
        log.info("[SHOPEE-CREATE] Khởi tạo phân loại thành công! Đã ghép {} model Shopee cho item_id {}", createdSkuMap.size(), itemId);
        return createdSkuMap;
    }

    record DongCanCapNhatShopee(TrangThaiDongBoSanPham dong, int soDay) {}

    private DayTonResultDto dayTonShopeeToiUu(
            KenhBanHang kenh,
            String maKenh,
            List<TrangThaiDongBoSanPham> dongCanDay,
            BigDecimal tyLe,
            int tonDem,
            int nguongVe0,
            TheoDoiDayTon theoDoi) {

        Long shopId = kenhBanHangService.getShopeeShopId(maKenh);
        if (shopId == null || shopId <= 0) {
            log.warn("[SHOPEE-SYNC] Kênh {} chưa có Shop ID định danh gian hàng hợp lệ, bỏ qua đẩy tồn.", maKenh);
            return DayTonResultDto.builder().soDong(0).soLoi(0).soChuaDay(0).loiKenh("Chưa cấu hình Shop ID gian hàng").build();
        }

        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClient(kenh);
        Instant now = Instant.now();

        // ═══════════════════════════════════════════════════════════════════
        // [DELTA SYNC SHOPEE] Lọc chỉ những biến thể có số tồn thay đổi
        // Bỏ qua các SKU đã đẩy thành công và số tồn giữ nguyên -> Tiết kiệm 100% quota API
        // ═══════════════════════════════════════════════════════════════════
        int soBoQuaKhongDoi = 0;
        List<DongCanCapNhatShopee> dirtyList = new ArrayList<>();

        for (TrangThaiDongBoSanPham dong : dongCanDay) {
            BienTheSanPham bt = dong.getBienTheSanPham();
            if (bt == null || bt.getId() == null) continue;
            int soDay = tinhSoTonDay(khaDungToanChuoi(bt.getId()), tyLe, tonDem, nguongVe0);

            boolean daThanhCong = "thanh_cong".equalsIgnoreCase(dong.getTrangThaiDongBo());
            boolean soTonKhongDoi = dong.getSoLuongDaDay() != null && dong.getSoLuongDaDay().equals(soDay);
            if (daThanhCong && soTonKhongDoi) {
                soBoQuaKhongDoi++;
                continue;
            }
            dirtyList.add(new DongCanCapNhatShopee(dong, soDay));
        }

        log.info("[SHOPEE-SYNC-DELTA] Tổng số SKU: {}, Bỏ qua không đổi: {}, Cần đẩy (dirty): {}",
                dongCanDay.size(), soBoQuaKhongDoi, dirtyList.size());

        if (dirtyList.isEmpty()) {
            theoDoi.batDauDay(0);
            lanDayTonCuoi.put(kenh.getId(), now);
            String moTa = "Shopee: Tất cả " + dongCanDay.size() + " SKU tồn kho không đổi, bỏ qua đẩy tồn (tiết kiệm 100% quota API)";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);
            return DayTonResultDto.builder().soDong(0).soLoi(0).soChuaDay(0).loiKenh(null).build();
        }

        theoDoi.batDauDay(dirtyList.size());

        int soThanhCong = 0;
        int soLoi = 0;

        // Gom nhóm biến thể theo itemId thực tế của Shopee
        Map<Long, List<DongCanCapNhatShopee>> gomNhomTheoItemId = new LinkedHashMap<>();
        for (DongCanCapNhatShopee item : dirtyList) {
            TrangThaiDongBoSanPham dong = item.dong();
            String mspk = dong.getMaSanPhamKenh() != null ? dong.getMaSanPhamKenh().trim() : "";
            Long itemId = null;
            if (mspk.contains(":")) {
                try {
                    itemId = Long.parseLong(mspk.split(":")[0]);
                } catch (Exception ignored) {}
            } else if (mspk.matches("\\d+")) {
                try {
                    itemId = Long.parseLong(mspk);
                } catch (Exception ignored) {}
            }

            if (itemId == null || itemId <= 0) {
                if (dong.getChiTietLoi() == null || dong.getChiTietLoi().isBlank()) {
                    dong.setChiTietLoi("Chưa liên kết với Item ID Shopee");
                }
                dong.setTrangThaiDongBo("that_bai");
                trangThaiDongBoSanPhamRepository.save(dong);
                soLoi++;
                theoDoi.daDay(dong.getMaSanPhamKenh(), dong.getMaSanPhamKenh(), false, dong.getChiTietLoi());
                continue;
            }
            gomNhomTheoItemId.computeIfAbsent(itemId, k -> new ArrayList<>()).add(item);
        }

        for (Map.Entry<Long, List<DongCanCapNhatShopee>> entry : gomNhomTheoItemId.entrySet()) {
            if (theoDoi.canDung()) {
                break;
            }

            Long itemId = entry.getKey();
            List<DongCanCapNhatShopee> nhomDong = entry.getValue();

            List<Map<String, Object>> stockList = new ArrayList<>();

            for (DongCanCapNhatShopee item : nhomDong) {
                TrangThaiDongBoSanPham dong = item.dong();
                int soDay = item.soDay();

                Long modelId = 0L;
                String mspk = dong.getMaSanPhamKenh() != null ? dong.getMaSanPhamKenh().trim() : "";
                if (mspk.contains(":")) {
                    try {
                        modelId = Long.parseLong(mspk.split(":")[1]);
                    } catch (Exception ignored) {}
                }

                Map<String, Object> stockItem = new HashMap<>();
                stockItem.put("model_id", modelId != null ? modelId : 0L);
                stockItem.put("seller_stock", List.of(Map.of("stock", soDay)));
                stockList.add(stockItem);
            }

            try {
                // Gọi API cập nhật tồn kho theo lô (Batching) cho sản phẩm cha
                JsonNode res = client.updateStockBatch(itemId, stockList);
                boolean ok = res != null && res.path("error").asText("").isEmpty();

                for (DongCanCapNhatShopee item : nhomDong) {
                    TrangThaiDongBoSanPham dong = item.dong();
                    int soDay = item.soDay();
                    if (ok) {
                        dong.setNgayDayTonCuoi(now);
                        dong.setSoLuongDaDay(soDay);
                        dong.setTrangThaiDongBo("thanh_cong");
                        dong.setChiTietLoi(null);
                        trangThaiDongBoSanPhamRepository.save(dong);
                        soThanhCong++;
                        theoDoi.daDay(dong.getMaSanPhamKenh(), null, true, null);
                    } else {
                        String rawErr = res != null ? res.path("error").asText("") : "";
                        String rawMsg = res != null ? res.path("message").asText("Lỗi cập nhật tồn Shopee") : "";
                        String combined = (rawErr + " " + rawMsg).toLowerCase(Locale.ROOT);
                        boolean biXoaTrenSan = combined.contains("not_found") || combined.contains("not exist")
                                || combined.contains("does not exist") || combined.contains("deleted")
                                || combined.contains("item_status_deleted") || combined.contains("100010041")
                                || combined.contains("status is abnormal") || combined.contains("abnormal");

                        String err = phanLoaiLoiShopee(rawErr, rawMsg);
                        dong.setChiTietLoi(err);
                        if (biXoaTrenSan) {
                            dong.setMaSanPhamKenh(null);
                            dong.setTrangThaiDongBo("chua_dong_bo");
                            dong.setChiTietLoi("Sản phẩm đã bị xóa hoặc ở trạng thái bất thường trên Shopee. Hệ thống đã tự động gỡ liên kết để sẵn sàng tạo mới.");
                            xuLySanPhamBiXoaHoacBatThuongShopee(kenh, itemId, String.valueOf(shopId) + (OmnichannelOrderSyncJob.isShopeeSandbox(kenh.getMaKenh()) ? "_SANDBOX" : "_OFFICIAL"));
                        } else {
                            dong.setTrangThaiDongBo("that_bai");
                        }
                        trangThaiDongBoSanPhamRepository.save(dong);
                        soLoi++;
                        theoDoi.daDay(dong.getMaSanPhamKenh(), dong.getMaSanPhamKenh(), false, dong.getChiTietLoi());
                    }
                }
            } catch (Exception ex) {
                log.error("[SHOPEE-STOCK-BATCH] Lỗi đẩy tồn theo lô cho Item ID {}: {}", itemId, ex.getMessage());
                String err = phanLoaiLoiShopee("EXCEPTION", ex.getMessage());
                boolean biXoaTrenSan = ex.getMessage() != null && (ex.getMessage().toLowerCase(Locale.ROOT).contains("not found")
                        || ex.getMessage().toLowerCase(Locale.ROOT).contains("404")
                        || ex.getMessage().toLowerCase(Locale.ROOT).contains("abnormal"));
                if (biXoaTrenSan) {
                    xuLySanPhamBiXoaHoacBatThuongShopee(kenh, itemId, String.valueOf(shopId) + (OmnichannelOrderSyncJob.isShopeeSandbox(kenh.getMaKenh()) ? "_SANDBOX" : "_OFFICIAL"));
                }
                for (DongCanCapNhatShopee item : nhomDong) {
                    TrangThaiDongBoSanPham dong = item.dong();
                    if (biXoaTrenSan) {
                        dong.setMaSanPhamKenh(null);
                        dong.setTrangThaiDongBo("chua_dong_bo");
                        dong.setChiTietLoi("Sản phẩm không tìm thấy trên Shopee (đã bị xóa). Hệ thống đã tự động hủy liên kết.");
                    } else {
                        dong.setChiTietLoi(err);
                        dong.setTrangThaiDongBo("that_bai");
                    }
                    trangThaiDongBoSanPhamRepository.save(dong);
                    soLoi++;
                    theoDoi.daDay(dong.getMaSanPhamKenh(), dong.getMaSanPhamKenh(), false, dong.getChiTietLoi());
                }
            }
        }

        lanDayTonCuoi.put(kenh.getId(), now);
        return DayTonResultDto.builder()
                .soDong(soThanhCong)
                .soLoi(soLoi)
                .soChuaDay(dirtyList.size() - soThanhCong - soLoi)
                .loiKenh(null)
                .build();
    }
}
