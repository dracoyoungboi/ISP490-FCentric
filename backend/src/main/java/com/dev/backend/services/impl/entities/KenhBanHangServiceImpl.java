package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.ShopifyConfigUpdating;
import com.dev.backend.dto.request.LazadaConfigUpdating;
import com.dev.backend.dto.request.LazadaOAuthCallbackRequest;
import com.dev.backend.dto.request.LazadaTestConnectionRequest;
import com.dev.backend.dto.response.customize.LazadaTestConnectionResponse;
import com.dev.backend.dto.response.entities.LazadaConfigResponse;
import com.dev.backend.services.lazada.LazadaClient;
import com.dev.backend.dto.request.ShopifyTestConnectionRequest;
import com.dev.backend.dto.response.customize.ShopifyTestConnectionResponse;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.KenhBanHangRepository.KhoaKenh;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.utils.PaymentSecretCipher;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

@Service
@Slf4j

@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KenhBanHangServiceImpl implements KenhBanHangService {

    public static final String MA_KENH_SHOPIFY = "SHOPIFY";
    public static final String DEFAULT_API_VERSION = "2024-01";
    public static final String MA_KENH_LAZADA = "LAZADA";
    public static final String DEFAULT_LAZADA_API_URL = "https://api.lazada.vn/rest";

    /** Kiểu kết nối trả về giao diện: Shopify dán khóa, Lazada / TikTok Shop ủy quyền. */
    public static final String KIEU_KHOA = "khoa";
    public static final String KIEU_UY_QUYEN = "uy_quyen";
    public static final String CHUA_KET_NOI = "chua_ket_noi";
    public static final String HET_HAN = "het_han";
    public static final String DANG_HOAT_DONG = "dang_hoat_dong";
    /** Lý do ghi vào dòng liên kết khi kênh vừa kết nối sang cửa hàng khác. */
    static final String LY_DO_CHUA_GHEP = "Chưa ghép với cửa hàng mới. Bấm Tải sản phẩm từ Shopify để ghép lại theo mã SKU.";
    /**
     * Cấp lại khóa không được: 424 (phụ thuộc bên ngoài lỗi), không dùng 502/504 vì Cloudflare thay phản hồi 502/504 của
     * máy gốc bằng trang lỗi của nó (mất mã và câu báo), không dùng 401 vì giao diện coi 401 là hết phiên.
     */
    static final HttpStatus HTTP_LAM_MOI_KHOA_LOI = HttpStatus.FAILED_DEPENDENCY;
    /**
     * Mã Shopify trả khi làm mới mà coi là "bị từ chối": khóa làm mới hoặc thông tin ứng dụng không dùng được nữa, cần
     * người sửa khóa. 402, 423 (cửa hàng bị đóng băng / bị khóa), 429, 5xx, lỗi mạng thì tự khỏi, không ghi.
     */
    static final java.util.Set<Integer> MA_TU_CHOI_LAM_MOI = java.util.Set.of(400, 401, 403);
    /** Làm mới khi khóa truy cập còn dưới từng này giây. */
    static final long GIAY_LAM_MOI_TRUOC_HAN = 300;
    /**
     * Tên miền cửa hàng MỚI phải là *.myshopify.com (khớp DOMAIN_PATTERN ở giao diện): máy chủ gửi khóa truy cập tới tên
     * miền này, tên miền tùy ý là gửi khóa cho người khác hoặc dò mạng nội bộ. Tên miền đang lưu thì giữ nguyên.
     */
    static final java.util.regex.Pattern MIEN_SHOPIFY = java.util.regex.Pattern.compile("^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$");
    static final String LOI_MIEN_SHOPIFY = "Tên miền phải có dạng ten-cua-hang.myshopify.com.";

    KenhBanHangRepository kenhBanHangRepository;
    PaymentSecretCipher paymentSecretCipher;
    LichSuThayDoiService lichSuThayDoiService;
    NguoiDungRepository nguoiDungRepository;
    TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    LazadaClient lazadaClient;
    private LazadaClient getLazadaClient() {
        if (lazadaClient == null) lazadaClient = new LazadaClient();
        return lazadaClient;
    }

    @lombok.experimental.NonFinal
    java.util.concurrent.locks.ReentrantLock lazadaTokenRefreshLock = new java.util.concurrent.locks.ReentrantLock();
    ObjectMapper objectMapper = new ObjectMapper();
    java.util.concurrent.locks.ReentrantLock tokenRefreshLock = new java.util.concurrent.locks.ReentrantLock();
    /**
     * Lần gần nhất Shopify từ chối khóa làm mới (MA_TU_CHOI_LAM_MOI). Nằm trong bộ nhớ: khởi động lại thì mất, lần dùng
     * khóa đầu tiên sau đó thử làm mới một lần và ghi lại.
     */
    java.util.concurrent.atomic.AtomicReference<TuChoiLamMoi> tuChoiLamMoi = new java.util.concurrent.atomic.AtomicReference<>();

    /**
     * Shopify từ chối khóa làm mới, kèm bộ khóa đang lưu lúc đó (chuỗi đã mã hóa như trong CSDL). Chỉ có hiệu lực khi bộ
     * khóa còn y nguyên: lưu khóa, làm mới thành công (ở bất kỳ máy nào dùng chung CSDL) hay ngắt kết nối đều đổi chuỗi
     * (mã hóa có IV ngẫu nhiên), nên không phải xóa bằng tay.
     */
    record TuChoiLamMoi(Integer kenhId, int maHttp, Instant luc,
                        String apiKey, String refreshToken, String apiSecret, String clientId) {
        boolean khop(Integer id, String apiKey, String refreshToken, String apiSecret, String clientId) {
            return java.util.Objects.equals(kenhId, id) && java.util.Objects.equals(this.apiKey, apiKey)
                    && java.util.Objects.equals(this.refreshToken, refreshToken)
                    && java.util.Objects.equals(this.apiSecret, apiSecret) && java.util.Objects.equals(this.clientId, clientId);
        }
    }
    /**
     * Giao dịch riêng, ngắn (REQUIRES_NEW, READ COMMITTED) cho mọi lần đọc / ghi cột khóa: không dính giao dịch của nơi
     * gọi (có thể chỉ đọc, đã commit, hoặc rollback sau đó làm mất khóa Shopify vừa cấp) và luôn thấy khóa mới nhất
     * đã commit. Ghi xong là commit ngay, không giữ khóa dòng kenh_ban_hang tới hết giao dịch dài. Null trong unit test.
     */
    @NonFinal
    TransactionTemplate giaoDichRieng;

    @Autowired
    void setTransactionManager(PlatformTransactionManager transactionManager) {
        TransactionTemplate t = new TransactionTemplate(transactionManager);
        t.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        t.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.giaoDichRieng = t;
    }

    private <T> T trongGiaoDichRieng(java.util.function.Supplier<T> viec) {
        return giaoDichRieng != null ? giaoDichRieng.execute(trangThaiGiaoDich -> viec.get()) : viec.get();
    }

    /** Khóa đang lưu của Shopify, đọc trong giao dịch riêng: luôn là giá trị mới nhất đã commit. */
    private KhoaKenh docKhoaMoiNhat() {
        return trongGiaoDichRieng(() -> kenhBanHangRepository.docKhoaTheoMaKenh(MA_KENH_SHOPIFY).orElse(null));
    }

    /**
     * Trạng thái kết nối suy từ khóa đã lưu (bảng chưa có cột riêng). Có khóa làm mới thì máy chủ tự làm mới khi dùng,
     * nên khóa quá hạn vẫn tính là đang hoạt động, trừ khi Shopify đã từ chối khóa làm mới và khóa truy cập đã tới lúc
     * phải làm mới (còn dưới 5 phút hoặc đã quá hạn). "Tạm dừng" do giao diện suy từ công tắc trangThai.
     */
    static String trangThaiKetNoi(boolean coKhoa, String domain, Instant hetHan, boolean coKhoaLamMoi,
                                  boolean khoaLamMoiBiTuChoi, Instant bayGio) {
        if (!coKhoa || domain == null || domain.isBlank()) {
            return CHUA_KET_NOI;
        }
        if (hetHan != null && bayGio.isAfter(hetHan) && !coKhoaLamMoi) {
            return HET_HAN;
        }
        if (hetHan != null && coKhoaLamMoi && khoaLamMoiBiTuChoi && sapHetHan(hetHan, bayGio)) {
            return HET_HAN;
        }
        return DANG_HOAT_DONG;
    }

    /** Khóa truy cập còn dưới 5 phút hoặc đã quá hạn: lúc máy chủ tự làm mới. */
    static boolean sapHetHan(Instant hetHan, Instant bayGio) {
        return bayGio.plusSeconds(GIAY_LAM_MOI_TRUOC_HAN).isAfter(hetHan);
    }

    /** Bộ khóa đang lưu là bộ đã bị Shopify từ chối làm mới. */
    private boolean biTuChoi(Integer kenhId, String apiKey, String refreshToken, String apiSecret, String clientId) {
        TuChoiLamMoi t = tuChoiLamMoi.get();
        return t != null && t.khop(kenhId, apiKey, refreshToken, apiSecret, clientId);
    }

    private boolean biTuChoi(KhoaKenh khoa) {
        return khoa != null && biTuChoi(khoa.getId(), khoa.getApiKey(), khoa.getRefreshToken(), khoa.getApiSecret(), khoa.getClientId());
    }

    private boolean biTuChoi(KenhBanHang kenh) {
        return kenh != null && biTuChoi(kenh.getId(), kenh.getApiKey(), kenh.getRefreshToken(), kenh.getApiSecret(), kenh.getClientId());
    }

    /** Câu chỉ cách sửa khi Shopify từ chối khóa làm mới; không có chữ "bị khóa" (giao diện coi là tài khoản bị khóa). */
    private static LoiCoMaException loiTuChoiLamMoi(int maHttp) {
        return new LoiCoMaException(HTTP_LAM_MOI_KHOA_LOI, MaLoi.LAM_MOI_KHOA_LOI,
                "Shopify đã từ chối khóa làm mới (HTTP " + maHttp + "). Cập nhật khóa truy cập ở Cấu hình Shopify rồi thử lại.");
    }

    /** Tên sàn hiện trong câu báo lỗi. */
    public static String tenSan(String maKenh) {
        String ma = maKenh == null ? "" : maKenh.trim().toUpperCase(Locale.ROOT);
        return switch (ma) {
            case MA_KENH_SHOPIFY -> "Shopify";
            case "LAZADA" -> "Lazada";
            case "TIKTOK" -> "TikTok Shop";
            default -> maKenh == null || maKenh.isBlank() ? "sàn này" : maKenh.trim();
        };
    }

            public KenhBanHangServiceImpl(
            KenhBanHangRepository kenhBanHangRepository,
            PaymentSecretCipher paymentSecretCipher,
            LichSuThayDoiService lichSuThayDoiService,
            NguoiDungRepository nguoiDungRepository,
            TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository) {
        this.kenhBanHangRepository = kenhBanHangRepository;
        this.paymentSecretCipher = paymentSecretCipher;
        this.lichSuThayDoiService = lichSuThayDoiService;
        this.nguoiDungRepository = nguoiDungRepository;
        this.trangThaiDongBoSanPhamRepository = trangThaiDongBoSanPhamRepository;
    }

    public KenhBanHangServiceImpl(
            KenhBanHangRepository kenhBanHangRepository,
            PaymentSecretCipher paymentSecretCipher,
            LichSuThayDoiService lichSuThayDoiService,
            NguoiDungRepository nguoiDungRepository) {
        this(kenhBanHangRepository, paymentSecretCipher, lichSuThayDoiService, nguoiDungRepository, null);
    }

    @Override
    @Transactional(readOnly = true)
    public ShopifyConfigResponse getShopifyConfig() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
        if (kenh == null) {
            return ShopifyConfigResponse.builder()
                    .maKenh(MA_KENH_SHOPIFY)
                    .tenKenh("Cửa hàng Shopify")
                    .loaiKenh("online")
                    .shopDomain("")
                    .apiUrl("")
                    .accessTokenMasked(null)
                    .hasAccessToken(false)
                    .hasApiSecret(false)
                    .clientId(null)
                    .hasRefreshToken(false)
                    .refreshTokenMasked(null)
                    .tokenExpiresAt(null)
                    .isTokenExpired(false)
                    .secondsUntilExpiration(null)
                    .trangThai(0)
                    .kieuKetNoi(KIEU_KHOA)
                    .trangThaiKetNoi(CHUA_KET_NOI)
                    .build();
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        boolean hasToken = kenh.getApiKey() != null && !kenh.getApiKey().isBlank();
        boolean hasSecret = kenh.getApiSecret() != null && !kenh.getApiSecret().isBlank();
        String masked = hasToken ? cheKhoa(kenh.getApiKey(), this::maskToken) : null;

        boolean hasRefresh = kenh.getRefreshToken() != null && !kenh.getRefreshToken().isBlank();
        String maskedRefresh = hasRefresh ? cheKhoa(kenh.getRefreshToken(), this::maskRefreshToken) : null;
        boolean isExpired = false;
        Long secondsUntilExpiration = null;
        Instant now = Instant.now();
        if (kenh.getTokenExpiresAt() != null) {
            isExpired = now.isAfter(kenh.getTokenExpiresAt());
            secondsUntilExpiration = java.time.Duration.between(now, kenh.getTokenExpiresAt()).getSeconds();
        }

        return ShopifyConfigResponse.builder()
                .id(kenh.getId())
                .maKenh(kenh.getMaKenh())
                .tenKenh(kenh.getTenKenh())
                .loaiKenh(kenh.getLoaiKenh())
                .shopDomain(domain)
                .apiUrl(kenh.getApiUrl())
                .accessTokenMasked(masked)
                .hasAccessToken(hasToken)
                .hasApiSecret(hasSecret)
                .clientId(kenh.getClientId())
                .hasRefreshToken(hasRefresh)
                .refreshTokenMasked(maskedRefresh)
                .tokenExpiresAt(kenh.getTokenExpiresAt())
                .isTokenExpired(isExpired)
                .secondsUntilExpiration(secondsUntilExpiration)
                .trangThai(kenh.getTrangThai())
                .ngayCapNhat(kenh.getNgayCapNhat())
                .kieuKetNoi(KIEU_KHOA)
                .trangThaiKetNoi(trangThaiKetNoi(hasToken, domain, kenh.getTokenExpiresAt(), hasRefresh, biTuChoi(kenh), now))
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShopifyConfigResponse updateShopifyConfig(ShopifyConfigUpdating request) {
        // Cùng khóa với ngắt kết nối và làm mới khóa: đọc dòng kênh sau khi giữ khóa nên thấy khóa đã xóa (nếu vừa ngắt),
        // không lưu đè trạng thái của một entity nạp trước lúc ngắt
        tokenRefreshLock.lock();
        try {
            return luuCauHinhShopify(request);
        } finally {
            tokenRefreshLock.unlock();
        }
    }

    private ShopifyConfigResponse luuCauHinhShopify(ShopifyConfigUpdating request) {
        if (request.getShopDomain() == null || request.getShopDomain().isBlank()) {
            throw new CommonException("Shopify Store Domain không được để trống", HttpStatus.BAD_REQUEST, null);
        }

        String cleanDomain = sanitizeShopDomain(request.getShopDomain());
        String apiUrl = "https://" + cleanDomain + "/admin/api/" + DEFAULT_API_VERSION;

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY)
                .orElseGet(() -> KenhBanHang.builder()
                        .maKenh(MA_KENH_SHOPIFY)
                        .tenKenh("Cửa hàng Shopify")
                        .loaiKenh("online")
                        .trangThai(1)
                        .build());

        // Đổi sang cửa hàng khác phải ngắt kết nối trước: liên kết, số đã đẩy, đơn đang theo cửa hàng đang kết nối
        boolean dangKetNoi = coGiaTri(kenh.getApiKey());
        String mienCu = extractDomainFromApiUrl(kenh.getApiUrl());
        if (!cleanDomain.equals(mienCu) && !MIEN_SHOPIFY.matcher(cleanDomain).matches()) {
            throw new CommonException(LOI_MIEN_SHOPIFY, HttpStatus.BAD_REQUEST, null);
        }
        boolean doiCuaHang = !mienCu.isBlank() && !mienCu.equals(cleanDomain);
        if (dangKetNoi && doiCuaHang) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.GIAN_HANG_KHAC,
                    "FCentric đang kết nối với " + mienCu + ". Muốn đổi sang cửa hàng khác, hãy ngắt kết nối ở Cấu hình rồi kết nối lại.");
        }
        boolean coKhoaMoi = coGiaTri(request.getAccessToken());
        if (!dangKetNoi && !coKhoaMoi && kenh.getId() != null) {
            // Kênh đã ngắt (vd. tab cũ lưu công tắc đồng bộ): không lưu, kẻo bật lại trạng thái khi chưa có khóa
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.KENH_CHUA_KET_NOI,
                    "Shopify chưa kết nối. Nhập khóa truy cập ở trình thiết lập để kết nối lại.");
        }

        // Chỉ dán khóa truy cập mới khi Shopify đã từ chối khóa làm mới (thẻ "Hết hạn khóa") hoặc khóa truy cập đã quá
        // hạn: bỏ khóa làm mới cũ, dùng khóa mới như khóa tĩnh. Giữ lại thì lần đọc khóa sau sẽ làm mới và bị từ chối lại,
        // hoặc ghi đè mất khóa vừa dán. Xét trước khi ghi gì (dấu bị từ chối so theo bộ khóa đang lưu); khớp seBoKhoaLamMoi
        // ở giao diện
        Instant bayGio = Instant.now();
        Instant hanCu = kenh.getTokenExpiresAt();
        boolean boKhoaLamMoi = coKhoaMoi && !coGiaTri(request.getRefreshToken()) && request.getTokenExpiresAt() == null
                && coGiaTri(kenh.getRefreshToken()) && hanCu != null
                && (bayGio.isAfter(hanCu) || (biTuChoi(kenh) && sapHetHan(hanCu, bayGio)));

        kenh.setTenKenh("Cửa hàng Shopify");
        kenh.setLoaiKenh("online");
        kenh.setApiUrl(apiUrl);
        if (request.getTrangThai() != null) {
            kenh.setTrangThai(request.getTrangThai());
        } else if (!dangKetNoi && coKhoaMoi) {
            // Kết nối lại sau khi ngắt (ngắt đặt trạng thái 0): bật lại đồng bộ
            kenh.setTrangThai(1);
        }

        // Mã hóa và lưu Access Token nếu được truyền mới
        if (coKhoaMoi) {
            String encryptedToken = paymentSecretCipher.encrypt(request.getAccessToken().trim());
            kenh.setApiKey(encryptedToken);
        }

        // Mã hóa và lưu API Secret / Webhook Secret nếu được truyền mới
        if (request.getApiSecret() != null && !request.getApiSecret().isBlank()) {
            String encryptedSecret = paymentSecretCipher.encrypt(request.getApiSecret().trim());
            kenh.setApiSecret(encryptedSecret);
        }

        // Lưu Client ID nếu được truyền
        if (request.getClientId() != null) {
            kenh.setClientId(request.getClientId().trim().isBlank() ? null : request.getClientId().trim());
        }

        // Mã hóa và lưu Refresh Token nếu được truyền mới
        if (request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            String encryptedRefresh = paymentSecretCipher.encrypt(request.getRefreshToken().trim());
            kenh.setRefreshToken(encryptedRefresh);
        } else if (boKhoaLamMoi) {
            // Hạn khóa cũng bỏ ngay dưới (khóa tĩnh mới)
            kenh.setRefreshToken(null);
        }

        // Lưu thời điểm hết hạn nếu được truyền
        if (request.getTokenExpiresAt() != null) {
            kenh.setTokenExpiresAt(request.getTokenExpiresAt());
        } else if (coKhoaMoi && !coGiaTri(kenh.getRefreshToken())) {
            // Khóa tĩnh mới (không có khóa làm mới, không kèm hạn): bỏ hạn của khóa cũ, nếu không kênh bị coi là hết hạn mãi
            kenh.setTokenExpiresAt(null);
        }

        KenhBanHang saved = kenhBanHangRepository.save(kenh);

        // Kết nối lại sau khi ngắt, sang cửa hàng khác: dòng liên kết giữ lại (đẩy tồn ghép theo mã SKU),
        // xóa dữ liệu của cửa hàng cũ và đánh dấu chờ ghép lại; dòng đang ngừng đồng bộ giữ nguyên
        if (doiCuaHang && saved.getId() != null) {
            trangThaiDongBoSanPhamRepository.xoaDuLieuCuaHangCu(saved.getId());
            trangThaiDongBoSanPhamRepository.danhDauChuaGhep(saved.getId(), LY_DO_CHUA_GHEP);
            ghiLichSuThayDoi(saved.getId(), "Kết nối Shopify sang cửa hàng khác: " + mienCu + " → " + cleanDomain,
                    "Giữ liên kết sản phẩm, chờ ghép lại theo mã SKU");
        } else {
            ghiLichSuThayDoi(saved.getId(), "Cập nhật kết nối Shopify domain: " + cleanDomain
                    + (boKhoaLamMoi ? "; bỏ khóa làm mới, dùng khóa truy cập như khóa tĩnh" : ""), GHI_CHU_MA_HOA);
        }

        return getShopifyConfig();
    }

    @Override
    public ShopifyTestConnectionResponse testShopifyConnection(ShopifyTestConnectionRequest request) {
        KenhBanHang kenhDaLuu = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
        String mienDaLuu = kenhDaLuu != null ? extractDomainFromApiUrl(kenhDaLuu.getApiUrl()) : "";
        String domain = request.getShopDomain() != null && !request.getShopDomain().isBlank()
                ? sanitizeShopDomain(request.getShopDomain())
                : mienDaLuu;

        if (domain == null || domain.isBlank()) {
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message("Chưa có Shopify Store Domain để kiểm tra kết nối")
                    .build();
        }
        boolean mienMoi = !domain.equals(mienDaLuu);
        if (mienMoi && !MIEN_SHOPIFY.matcher(domain).matches()) {
            return ShopifyTestConnectionResponse.builder().connected(false).message(LOI_MIEN_SHOPIFY).build();
        }

        boolean coKhoaMoi = request.getAccessToken() != null && !request.getAccessToken().isBlank();
        if (mienMoi && !coKhoaMoi && kenhDaLuu != null && coGiaTri(kenhDaLuu.getApiKey())) {
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message("Nhập khóa truy cập của cửa hàng " + domain + " để kiểm tra kết nối")
                    .build();
        }
        // Khóa đã lưu chỉ dùng cho tên miền đã lưu: không bao giờ gửi sang tên miền khác
        String tokenToTest = coKhoaMoi ? request.getAccessToken().trim()
                : mienMoi ? null : getDecryptedShopifyAccessToken();

        if (tokenToTest == null || tokenToTest.isBlank()) {
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message("Chưa có Admin Access Token để kiểm tra kết nối")
                    .build();
        }

        String testUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/shop.json";

        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory() {
                @Override
                protected void prepareConnection(java.net.HttpURLConnection connection, String httpMethod)
                        throws java.io.IOException {
                    super.prepareConnection(connection, httpMethod);
                    // Không theo chuyển hướng: HttpURLConnection gửi lại cả header khóa truy cập tới địa chỉ mới
                    connection.setInstanceFollowRedirects(false);
                }
            };
            factory.setConnectTimeout(3000);
            factory.setReadTimeout(5000);
            RestTemplate restTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Shopify-Access-Token", tokenToTest);
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(testUrl, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode shopNode = root.path("shop");
                String name = shopNode.path("name").asText(domain);
                String email = shopNode.path("email").asText("");
                String myshopifyDomain = shopNode.path("myshopify_domain").asText(domain);

                return ShopifyTestConnectionResponse.builder()
                        .connected(true)
                        .shopName(name)
                        .shopEmail(email)
                        .myshopifyDomain(myshopifyDomain)
                        .message("Kết nối thành công tới cửa hàng Shopify: " + name)
                        .build();
            } else {
                return ShopifyTestConnectionResponse.builder()
                        .connected(false)
                        .message("Shopify trả về mã trạng thái: " + response.getStatusCode())
                        .build();
            }
        } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden e) {
            log.warn("Shopify test connection failed (auth error): {}", e.getMessage());
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message("Access Token không hợp lệ hoặc không có quyền truy cập Shopify Admin API")
                    .build();
        } catch (Exception e) {
            log.error("Shopify test connection failed: {}", e.getMessage());
            // Câu cố định: chi tiết lỗi kết nối (từ chối, hết giờ, lỗi chứng chỉ…) để dò được cổng / máy trong mạng
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message("Không thể kết nối tới Shopify. Kiểm tra tên miền và khóa truy cập rồi thử lại.")
                    .build();
        }
    }

    @Override
    public String getDecryptedShopifyAccessToken() {
        // Đọc cột trong giao dịch riêng, không đọc entity hay ảnh chụp của giao dịch nơi gọi: entity đã nạp trong phiên
        // (vd. đầu một đợt Đồng bộ ngay đã chờ khóa đẩy tồn vài phút) có thể vẫn giữ khóa mà ngắt kết nối vừa xóa
        KhoaKenh khoa = docKhoaMoiNhat();
        if (khoa == null || !coGiaTri(khoa.getApiKey())) {
            return null;
        }

        // Proactive Refresh: nếu là OAuth 2.0 token sắp hết hạn và có refresh token. Shopify đã từ chối khóa làm mới này
        // thì không gọi lại (400/401/403 không tự khỏi); chỉ "Cấp lại khóa" hoặc lưu khóa mới mới thử lại
        if (isOAuthTokenExpiringSoon(khoa) && !biTuChoi(khoa)) {
            tokenRefreshLock.lock();
            try {
                // Đọc lại sau khi giữ khóa: luồng khác có thể vừa làm mới hoặc vừa ngắt kết nối
                khoa = docKhoaMoiNhat();
                if (khoa != null && isOAuthTokenExpiringSoon(khoa) && !biTuChoi(khoa)) {
                    doRefreshShopifyOAuthToken(khoa);
                    // Thành công, bị bỏ (khóa vừa đổi / vừa ngắt) hay lỗi: đều đọc lại giá trị đang lưu
                    khoa = docKhoaMoiNhat();
                }
            } finally {
                tokenRefreshLock.unlock();
            }
        }

        if (khoa == null || !coGiaTri(khoa.getApiKey())) {
            return null;
        }
        // Khóa làm mới đã bị từ chối và khóa truy cập đã quá hạn: báo ngay cách sửa, không gọi Shopify bằng khóa chết.
        // Chưa quá hạn thì khóa vẫn dùng được tới hết hạn
        TuChoiLamMoi tuChoi = tuChoiLamMoi.get();
        if (tuChoi != null && tuChoi.khop(khoa.getId(), khoa.getApiKey(), khoa.getRefreshToken(), khoa.getApiSecret(), khoa.getClientId())
                && khoa.getTokenExpiresAt() != null && Instant.now().isAfter(khoa.getTokenExpiresAt())) {
            throw loiTuChoiLamMoi(tuChoi.maHttp());
        }
        try {
            return paymentSecretCipher.decrypt(khoa.getApiKey());
        } catch (Exception e) {
            log.error("Lỗi giải mã token Shopify: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public boolean refreshShopifyAccessToken() {
        tokenRefreshLock.lock();
        try {
            KhoaKenh khoa = docKhoaMoiNhat();
            if (khoa == null) {
                throw new CommonException("Chưa cấu hình kênh bán hàng Shopify", HttpStatus.BAD_REQUEST, null);
            }
            if (!coGiaTri(khoa.getRefreshToken())) {
                throw new CommonException("Kênh Shopify đang sử dụng Static Token hoặc chưa cấu hình Refresh Token OAuth 2.0", HttpStatus.BAD_REQUEST, null);
            }
            return doRefreshShopifyOAuthToken(khoa);
        } finally {
            tokenRefreshLock.unlock();
        }
    }

    /**
     * Gọi Shopify đổi khóa làm mới lấy khóa truy cập mới rồi ghi lại, chỉ khi khóa làm mới trong CSDL vẫn là khóa đã
     * dùng để xin. Shopify từ chối thì báo 424 LAM_MOI_KHOA_LOI: không trả 401, vì giao diện coi 401 là hết phiên.
     */
    private boolean doRefreshShopifyOAuthToken(KhoaKenh khoa) {
        String domain = extractDomainFromApiUrl(khoa.getApiUrl());
        if (domain.isBlank()) {
            log.error("Không thể refresh token: domain Shopify rỗng");
            return false;
        }

        // Khóa làm mới (dạng mã hóa) dùng để xin: điều kiện ghi và để biết lúc bị từ chối CSDL đã đổi khóa chưa
        String refreshDaDung = khoa.getRefreshToken();
        String decryptedRefreshToken = null;
        try {
            decryptedRefreshToken = paymentSecretCipher.decrypt(refreshDaDung);
        } catch (Exception e) {
            log.error("Không thể giải mã Refresh Token: {}", e.getMessage());
            return false;
        }

        String decryptedClientSecret = null;
        if (coGiaTri(khoa.getApiSecret())) {
            try {
                decryptedClientSecret = paymentSecretCipher.decrypt(khoa.getApiSecret());
            } catch (Exception e) {
                log.warn("Không thể giải mã apiSecret làm client_secret: {}", e.getMessage());
            }
        }

        String clientId = khoa.getClientId();

        try {
            java.util.Map<String, String> body = new java.util.HashMap<>();
            body.put("client_id", clientId != null ? clientId : "");
            body.put("client_secret", decryptedClientSecret != null ? decryptedClientSecret : "");
            body.put("grant_type", "refresh_token");
            body.put("refresh_token", decryptedRefreshToken);

            JsonNode root = xinKhoaMoiTuShopify(domain, body);
            if (root != null) {
                String newAccessToken = root.path("access_token").asText(null);
                String newRefreshToken = root.path("refresh_token").asText(null);
                long expiresIn = root.path("expires_in").asLong(3600);

                if (newAccessToken != null && !newAccessToken.isBlank()) {
                    String refreshMoi = newRefreshToken != null && !newRefreshToken.isBlank()
                            ? paymentSecretCipher.encrypt(newRefreshToken)
                            : refreshDaDung;
                    String accessMoi = paymentSecretCipher.encrypt(newAccessToken);
                    Instant hetHanMoi = Instant.now().plusSeconds(expiresIn);
                    // Giao dịch riêng, commit ngay: nơi gọi rollback (hoặc chỉ đọc) không làm mất khóa Shopify vừa cấp
                    int soDong = trongGiaoDichRieng(() -> kenhBanHangRepository.ghiKhoaSauLamMoi(khoa.getId(),
                            accessMoi, refreshMoi, hetHanMoi, refreshDaDung));
                    if (soDong == 0) {
                        // Kênh vừa bị ngắt kết nối (hoặc vừa đổi khóa) trong lúc chờ Shopify: không ghi khóa trở lại
                        log.warn("Bỏ kết quả làm mới khóa Shopify: khóa đã đổi hoặc kênh đã ngắt kết nối trong lúc làm mới");
                        return false;
                    }
                    ghiLichSuThayDoi(khoa.getId(), "Làm mới khóa truy cập Shopify domain: " + domain, GHI_CHU_MA_HOA);
                    log.info("Làm mới thành công Access Token Shopify cho domain: {}, thời hạn mới: {}s", domain, expiresIn);
                    // Bộ khóa đã đổi nên dấu cũ (nếu có) hết hiệu lực; bỏ luôn cho gọn
                    tuChoiLamMoi.set(null);
                    return true;
                }
            }
            return false;
        } catch (HttpClientErrorException e) {
            int maHttp = e.getStatusCode().value();
            log.error("Shopify OAuth refresh error [{}]", e.getStatusCode());
            if (!MA_TU_CHOI_LAM_MOI.contains(maHttp)) {
                throw new LoiCoMaException(HTTP_LAM_MOI_KHOA_LOI, MaLoi.LAM_MOI_KHOA_LOI,
                        "Shopify chưa cấp lại khóa truy cập (HTTP " + maHttp + "). Thử lại sau ít phút.");
            }
            // Đọc lại: máy khác dùng chung CSDL vừa làm mới, hoặc người dùng vừa lưu khóa, thì lỗi này là của khóa làm mới
            // cũ; không ghi dấu, nơi gọi dùng khóa đang lưu
            KhoaKenh hienTai = docKhoaMoiNhat();
            if (hienTai == null || !java.util.Objects.equals(hienTai.getRefreshToken(), refreshDaDung)) {
                return hienTai != null && coGiaTri(hienTai.getApiKey());
            }
            tuChoiLamMoi.set(new TuChoiLamMoi(hienTai.getId(), maHttp, Instant.now(), hienTai.getApiKey(),
                    hienTai.getRefreshToken(), hienTai.getApiSecret(), hienTai.getClientId()));
            log.warn("Shopify từ chối khóa làm mới [{}]: thôi tự làm mới tới khi khóa được cập nhật", maHttp);
            throw loiTuChoiLamMoi(maHttp);
        } catch (Exception e) {
            log.error("Lỗi ngoại lệ khi làm mới Shopify OAuth Token: {}", e.getMessage());
            return false;
        }
    }

    /** POST /admin/oauth/access_token của cửa hàng; null khi Shopify không trả nội dung. Tách riêng để test thay được. */
    JsonNode xinKhoaMoiTuShopify(String domain, java.util.Map<String, String> body) throws java.io.IOException {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        RestTemplate restTemplate = new RestTemplate(factory);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

        HttpEntity<java.util.Map<String, String>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                "https://" + domain + "/admin/oauth/access_token", HttpMethod.POST, entity, String.class);
        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            return objectMapper.readTree(response.getBody());
        }
        return null;
    }

    private boolean isOAuthTokenExpiringSoon(KhoaKenh khoa) {
        if (!coGiaTri(khoa.getRefreshToken()) || khoa.getTokenExpiresAt() == null) {
            return false;
        }
        // Chủ động làm mới nếu token sẽ hết hạn trong vòng 5 phút (300 giây)
        return sapHetHan(khoa.getTokenExpiresAt(), Instant.now());
    }

    @Override
    @Transactional(readOnly = true)
    public ShopifyConfigResponse getKetNoi(String maKenh) {
        String ma = chuanHoaMaKenh(maKenh);
        if (MA_KENH_SHOPIFY.equals(ma)) {
            return getShopifyConfig();
        }
        if ("LAZADA".equals(ma)) {
            KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
            if (kenh == null) {
                return ShopifyConfigResponse.builder()
                        .maKenh(ma)
                        .tenKenh("Lazada")
                        .loaiKenh("online")
                        .kieuKetNoi(KIEU_UY_QUYEN)
                        .trangThaiKetNoi(CHUA_KET_NOI)
                        .trangThai(1)
                        .build();
            }
            boolean hasSecret = kenh.getApiSecret() != null && !kenh.getApiSecret().isBlank();
            boolean hasToken = kenh.getApiKey() != null && !kenh.getApiKey().isBlank();
            boolean isExpired = hasToken && kenh.getTokenExpiresAt() != null && Instant.now().isAfter(kenh.getTokenExpiresAt());
            String trangThaiKetNoi = CHUA_KET_NOI;
            if (hasToken) {
                trangThaiKetNoi = isExpired ? HET_HAN : (Integer.valueOf(1).equals(kenh.getTrangThai()) ? DANG_HOAT_DONG : "tam_dung");
            }
            Long soNgayCon = null;
            if (kenh.getTokenExpiresAt() != null) {
                long seconds = Duration.between(Instant.now(), kenh.getTokenExpiresAt()).getSeconds();
                soNgayCon = Math.max(0L, seconds / 86400L);
            }
            String maskedToken = hasToken ? cheKhoa(kenh.getApiKey(), this::maskToken) : null;
            return ShopifyConfigResponse.builder()
                    .id(kenh.getId())
                    .maKenh(ma)
                    .tenKenh(kenh.getTenKenh() != null ? kenh.getTenKenh() : "Gian hàng Lazada")
                    .loaiKenh("online")
                    .appKey(kenh.getClientId())
                    .hasAppSecret(hasSecret)
                    .hasAccessToken(hasToken)
                    .accessTokenMasked(maskedToken)
                    .tokenExpiresAt(kenh.getTokenExpiresAt())
                    .hanUyQuyen(kenh.getTokenExpiresAt())
                    .soNgayConUyQuyen(soNgayCon)
                    .ngayUyQuyen(kenh.getNgayCapNhat())
                    .tenGianHang(kenh.getTenKenh())
                    .shopIdSan(kenh.getApiUrl())
                    .trangThai(kenh.getTrangThai() != null ? kenh.getTrangThai() : 1)
                    .kieuKetNoi(KIEU_UY_QUYEN)
                    .trangThaiKetNoi(trangThaiKetNoi)
                    .ngayCapNhat(kenh.getNgayCapNhat())
                    .build();
        }
        if (!"TIKTOK".equals(ma)) {
            throw sanKhongHoTro(ma);
        }
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        return ShopifyConfigResponse.builder()
                .id(kenh != null ? kenh.getId() : null)
                .maKenh(ma)
                .tenKenh(kenh != null ? kenh.getTenKenh() : "Gian hàng " + tenSan(ma))
                .loaiKenh("online")
                .trangThai(kenh != null && kenh.getTrangThai() != null ? kenh.getTrangThai() : 1)
                .kieuKetNoi(KIEU_UY_QUYEN)
                .trangThaiKetNoi(CHUA_KET_NOI)
                .build();
    }

    @Override
    public void kiemTraSanShopify(String maKenh) {
        String ma = chuanHoaMaKenh(maKenh);
        if (!MA_KENH_SHOPIFY.equals(ma)) {
            throw sanKhongHoTro(ma);
        }
    }

    @Override
    public ShopifyConfigResponse lamMoiKhoaShopify() {
        if (!coKhoaShopify()) {
            // Tab cũ bấm "Cấp lại khóa" sau khi kênh đã ngắt: giao diện đọc lại kết nối theo mã này
            throw shopifyChuaKetNoi();
        }
        boolean daLamMoi;
        try {
            daLamMoi = refreshShopifyAccessToken();
        } catch (RuntimeException e) {
            // Tab khác ngắt kết nối trong lúc chờ khóa: lỗi khóa làm mới (đã bị xóa) không phải lý do thật
            if (!coKhoaShopify()) {
                throw shopifyChuaKetNoi();
            }
            throw e;
        }
        if (!daLamMoi) {
            if (!coKhoaShopify()) {
                throw shopifyChuaKetNoi();
            }
            throw new LoiCoMaException(HTTP_LAM_MOI_KHOA_LOI, MaLoi.LAM_MOI_KHOA_LOI,
                    "Chưa cấp lại được khóa truy cập. Kiểm tra khóa làm mới ở trình thiết lập rồi thử lại.");
        }
        return getShopifyConfig();
    }

    private static LoiCoMaException shopifyChuaKetNoi() {
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.KENH_CHUA_KET_NOI,
                "Shopify chưa kết nối. Kết nối lại ở trình thiết lập rồi thử lại.");
    }

    @Override
    public boolean coKhoaShopify() {
        KhoaKenh khoa = docKhoaMoiNhat();
        return khoa != null && coGiaTri(khoa.getApiKey());
    }

    @Override
    public void xoaKhoaShopify() {
        KhoaKenh daXoa;
        tokenRefreshLock.lock();
        try {
            // Giao dịch riêng, commit trong khi còn giữ khóa: luồng làm mới vào khóa ngay sau đó phải thấy khóa đã xóa
            daXoa = trongGiaoDichRieng(() -> {
                KhoaKenh khoa = kenhBanHangRepository.docKhoaTheoMaKenh(MA_KENH_SHOPIFY).orElse(null);
                if (khoa == null || !coGiaTri(khoa.getApiKey())) {
                    return null;
                }
                kenhBanHangRepository.xoaKhoaVaNgatKetNoi(khoa.getId());
                return khoa;
            });
        } finally {
            tokenRefreshLock.unlock();
        }
        if (daXoa != null) {
            String domain = extractDomainFromApiUrl(daXoa.getApiUrl());
            // Ghi sau khi đã commit: ghi lịch sử lỗi không được làm hỏng việc ngắt kết nối
            ghiLichSuThayDoi(daXoa.getId(), "Ngắt kết nối Shopify: " + domain,
                    "Xóa khóa đã lưu, giữ tên miền, liên kết sản phẩm và đơn đã nhận");
            log.info("Đã ngắt kết nối Shopify domain: {}", domain);
        }
    }

    private static String chuanHoaMaKenh(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) {
            throw new CommonException("Mã kênh không được để trống", HttpStatus.BAD_REQUEST, null);
        }
        return maKenh.trim().toUpperCase(Locale.ROOT);
    }

    private static LoiCoMaException sanKhongHoTro(String ma) {
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.SAN_KHONG_HO_TRO,
                "Máy chủ chưa hỗ trợ kết nối " + tenSan(ma) + ".");
    }

    private static boolean coGiaTri(String s) {
        return s != null && !s.isBlank();
    }

    /**
     * Dạng che của khóa đã mã hóa; không giải mã được (đổi khóa mã hóa của máy chủ) thì null, để trang Cấu hình vẫn mở
     * được và người dùng ngắt kết nối hoặc nhập khóa mới.
     */
    private String cheKhoa(String maHoa, java.util.function.UnaryOperator<String> che) {
        try {
            return che.apply(paymentSecretCipher.decrypt(maHoa));
        } catch (RuntimeException e) {
            log.warn("Không giải mã được khóa Shopify đã lưu: {}", e.getMessage());
            return null;
        }
    }

    private String maskRefreshToken(String plain) {
        if (plain == null || plain.isBlank()) return "";
        if (plain.length() <= 8) {
            return "••••••••";
        }
        String prefix = plain.startsWith("shprt_") ? "shprt_" : "";
        String suffix = plain.substring(plain.length() - 4);
        return prefix + "••••••••" + suffix;
    }

    @Override
    @Transactional(readOnly = true)
    public String getShopifyApiUrl() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY).orElse(null);
        return kenh != null ? kenh.getApiUrl() : null;
    }

    private String sanitizeShopDomain(String rawDomain) {
        if (rawDomain == null) return "";
        // Locale.ROOT: máy chủ chạy locale Thổ Nhĩ Kỳ thì "I" thành "ı", tên miền lệch với tên đã lưu
        String domain = rawDomain.trim().toLowerCase(Locale.ROOT);
        domain = domain.replace("https://", "").replace("http://", "");
        if (domain.contains("/")) {
            domain = domain.substring(0, domain.indexOf("/"));
        }
        return domain;
    }

    private String extractDomainFromApiUrl(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) return "";
        return sanitizeShopDomain(apiUrl);
    }

    private String maskToken(String plain) {
        if (plain == null || plain.isBlank()) return "";
        if (plain.length() <= 8) {
            return "••••••••";
        }
        String prefix = plain.startsWith("shpat_") ? "shpat_" : "";
        String suffix = plain.substring(plain.length() - 4);
        return prefix + "••••••••" + suffix;
    }

    private static final String GHI_CHU_MA_HOA = "Mã hóa AES-256-GCM credential kênh bán";

    /** Ghi lịch sử thay đổi kết nối kênh (bỏ qua khi không có người thực hiện, vd. job nền). Không ghi khóa. */
    private void ghiLichSuThayDoi(Integer kenhId, String giaTriMoi, String ghiChu) {
        try {
            NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
            NguoiDung nguoiThucHien = null;
            if (auth != null && auth.getId() != null) {
                nguoiThucHien = nguoiDungRepository.findById(auth.getId()).orElse(null);
            }
            if (nguoiThucHien != null) {
                lichSuThayDoiService.create(
                        LichSuThayDoi.builder()
                                .loaiThamChieu(ITable.kenh_ban_hang)
                                .idThamChieu(kenhId)
                                .hanhDong(IHanhDong.cap_nhat_kenh_ban)

                                .giaTriMoi(giaTriMoi)

                                .nguoiThucHien(nguoiThucHien)
                                .ngayThucHien(Instant.now())
                                .ghiChu(ghiChu)
                                .build()
                );
            }
        } catch (Exception e) {
            log.warn("Không thể ghi log lịch sử thay đổi cho kênh bán: {}", e.getMessage());
        }
    }

    private void ghiLichSuThayDoi(KenhBanHang kenh, String giaTriMoi) {
        if (kenh != null) {
            ghiLichSuThayDoi(kenh.getId(), giaTriMoi, GHI_CHU_MA_HOA);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // LAZADA OPEN PLATFORM INTEGRATION
    // ═══════════════════════════════════════════════════════════════════

    @Override
    @Transactional(readOnly = true)
    public LazadaConfigResponse getLazadaConfig() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
        if (kenh == null) {
            return LazadaConfigResponse.builder()
                    .maKenh(MA_KENH_LAZADA)
                    .tenKenh("Gian hàng Lazada")
                    .loaiKenh("online")
                    .apiUrl(DEFAULT_LAZADA_API_URL)
                    .appKey("")
                    .hasAppSecret(false)
                    .hasAccessToken(false)
                    .accessTokenMasked(null)
                    .hasRefreshToken(false)
                    .refreshTokenMasked(null)
                    .tokenExpiresAt(null)
                    .isTokenExpired(false)
                    .secondsUntilExpiration(null)
                    .trangThai(0)
                    .build();
        }

        boolean hasSecret = kenh.getApiSecret() != null && !kenh.getApiSecret().isBlank();
        boolean hasToken = kenh.getApiKey() != null && !kenh.getApiKey().isBlank();
        String maskedToken = hasToken ? maskToken(paymentSecretCipher.decrypt(kenh.getApiKey())) : null;

        boolean hasRefresh = kenh.getRefreshToken() != null && !kenh.getRefreshToken().isBlank();
        String maskedRefresh = hasRefresh ? maskRefreshToken(paymentSecretCipher.decrypt(kenh.getRefreshToken())) : null;

        boolean isExpired = false;
        Long secondsUntilExpiration = null;
        if (kenh.getTokenExpiresAt() != null) {
            Instant now = Instant.now();
            isExpired = now.isAfter(kenh.getTokenExpiresAt());
            secondsUntilExpiration = java.time.Duration.between(now, kenh.getTokenExpiresAt()).getSeconds();
        }

        return LazadaConfigResponse.builder()
                .id(kenh.getId())
                .maKenh(kenh.getMaKenh())
                .tenKenh(kenh.getTenKenh())
                .loaiKenh(kenh.getLoaiKenh())
                .apiUrl(kenh.getApiUrl() != null ? kenh.getApiUrl() : DEFAULT_LAZADA_API_URL)
                .appKey(kenh.getClientId())
                .hasAppSecret(hasSecret)
                .hasAccessToken(hasToken)
                .accessTokenMasked(maskedToken)
                .hasRefreshToken(hasRefresh)
                .refreshTokenMasked(maskedRefresh)
                .tokenExpiresAt(kenh.getTokenExpiresAt())
                .isTokenExpired(isExpired)
                .secondsUntilExpiration(secondsUntilExpiration)
                .trangThai(kenh.getTrangThai())
                .ngayCapNhat(kenh.getNgayCapNhat())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LazadaConfigResponse updateLazadaConfig(LazadaConfigUpdating request) {
        if (request.getAppKey() == null || request.getAppKey().isBlank()) {
            throw new CommonException("Lazada App Key không được để trống", HttpStatus.BAD_REQUEST, null);
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA)
                .orElseGet(() -> KenhBanHang.builder()
                        .maKenh(MA_KENH_LAZADA)
                        .tenKenh("Gian hàng Lazada")
                        .loaiKenh("online")
                        .apiUrl(DEFAULT_LAZADA_API_URL)
                        .trangThai(1)
                        .build());

        kenh.setTenKenh("Gian hàng Lazada");
        kenh.setLoaiKenh("online");
        if (kenh.getApiUrl() == null || kenh.getApiUrl().isBlank()) {
            kenh.setApiUrl(DEFAULT_LAZADA_API_URL);
        }
        kenh.setClientId(request.getAppKey().trim());

        if (request.getTrangThai() != null) {
            kenh.setTrangThai(request.getTrangThai());
        }

        if (request.getAppSecret() != null && !request.getAppSecret().isBlank()) {
            kenh.setApiSecret(paymentSecretCipher.encrypt(request.getAppSecret().trim()));
        }

        if (request.getAccessToken() != null && !request.getAccessToken().isBlank()) {
            kenh.setApiKey(paymentSecretCipher.encrypt(request.getAccessToken().trim()));
        }

        if (request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            kenh.setRefreshToken(paymentSecretCipher.encrypt(request.getRefreshToken().trim()));
        }

        if (request.getTokenExpiresAt() != null) {
            kenh.setTokenExpiresAt(request.getTokenExpiresAt());
        }

        KenhBanHang saved = kenhBanHangRepository.save(kenh);
        ghiLichSuThayDoi(saved, "Lazada AppKey: " + request.getAppKey());

        return getLazadaConfig();
    }

    @Override
    public LazadaTestConnectionResponse testLazadaConnection(LazadaTestConnectionRequest request) {
        String appKey = request.getAppKey() != null && !request.getAppKey().isBlank()
                ? request.getAppKey().trim()
                : getLazadaAppKey();

        String appSecret = request.getAppSecret() != null && !request.getAppSecret().isBlank()
                ? request.getAppSecret().trim()
                : getDecryptedLazadaAppSecret();

        String accessToken = request.getAccessToken() != null && !request.getAccessToken().isBlank()
                ? request.getAccessToken().trim()
                : getDecryptedLazadaAccessToken();

        return getLazadaClient().testConnection(appKey, appSecret, accessToken);
    }

    @Override
    public String getLazadaAuthUrl(String redirectUri) {
        String appKey = getLazadaAppKey();
        if (appKey == null || appKey.isBlank()) {
            throw new CommonException("Chưa cấu hình App Key cho kênh Lazada", HttpStatus.BAD_REQUEST, null);
        }
        return getLazadaClient().generateAuthUrl(appKey, redirectUri);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LazadaConfigResponse exchangeLazadaToken(LazadaOAuthCallbackRequest request) {
        if (request.getCode() == null || request.getCode().isBlank()) {
            throw new CommonException("Mã authorization code không được để trống", HttpStatus.BAD_REQUEST, null);
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
        if (kenh == null) {
            throw new CommonException("Chưa thiết lập kênh Lazada trong hệ thống", HttpStatus.BAD_REQUEST, null);
        }

        String appKey = request.getAppKey() != null && !request.getAppKey().isBlank()
                ? request.getAppKey().trim()
                : kenh.getClientId();

        String appSecret = getDecryptedLazadaAppSecret();

        if (appKey == null || appKey.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new CommonException("Chưa cấu hình đủ App Key và App Secret cho kênh Lazada", HttpStatus.BAD_REQUEST, null);
        }

        try {
            JsonNode res = getLazadaClient().exchangeToken(appKey, appSecret, request.getCode());
            String accessToken = res.path("access_token").asText(null);
            String refreshToken = res.path("refresh_token").asText(null);
            long expiresIn = res.path("expires_in").asLong(2592000L); // 30 ngày mặc định

            if (accessToken == null || accessToken.isBlank()) {
                String errorMsg = res.path("message").asText(res.path("sub_message").asText("Lazada từ chối mã ủy quyền code"));
                throw new CommonException("Lỗi xác thực OAuth2 Lazada: " + errorMsg, HttpStatus.BAD_REQUEST, null);
            }

            String account = res.path("account").asText(null);
            String sellerId = res.path("country_user_info").path(0).path("seller_id").asText(null);
            if (sellerId == null || sellerId.isBlank()) {
                sellerId = res.path("seller_id").asText(null);
            }
            if (sellerId != null && !sellerId.isBlank()) {
                kenh.setApiUrl(sellerId);
            } else if (account != null && !account.isBlank()) {
                kenh.setApiUrl(account);
            }
            kenh.setApiKey(paymentSecretCipher.encrypt(accessToken));
            if (refreshToken != null && !refreshToken.isBlank()) {
                kenh.setRefreshToken(paymentSecretCipher.encrypt(refreshToken));
            }
            kenh.setTokenExpiresAt(Instant.now().plusSeconds(expiresIn));
            kenh.setTrangThai(1);
            kenhBanHangRepository.save(kenh);

            ghiLichSuThayDoi(kenh, "Ủy quyền OAuth2 Lazada thành công (Token hiệu lực " + (expiresIn / 86400) + " ngày)");

            return getLazadaConfig();
        } catch (CommonException ce) {
            throw ce;
        } catch (Exception e) {
            log.error("Lỗi khi trao đổi token OAuth Lazada: {}", e.getMessage());
            throw new CommonException("Không thể hoàn tất ủy quyền Lazada: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }
    }

    @Override
        @Override
    @Transactional(rollbackFor = Exception.class)
    public void xoaKhoaLazada() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
        if (kenh != null) {
            kenh.setApiKey(null);
            kenh.setRefreshToken(null);
            kenh.setTokenExpiresAt(null);
            kenh.setTrangThai(0);
            kenhBanHangRepository.save(kenh);
            ghiLichSuThayDoi(kenh, "Ngắt kết nối gian hàng Lazada (xóa Access Token)");
        }
    }

    @Override
    public boolean refreshLazadaAccessToken() {
        lazadaTokenRefreshLock.lock();
        try {
            KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
            if (kenh == null || kenh.getRefreshToken() == null || kenh.getRefreshToken().isBlank()) {
                log.warn("Không thể refresh token Lazada: thiếu Refresh Token");
                return false;
            }

            String appKey = kenh.getClientId();
            String appSecret = getDecryptedLazadaAppSecret();
            String decryptedRefresh = paymentSecretCipher.decrypt(kenh.getRefreshToken());

            if (appKey == null || appSecret == null || decryptedRefresh == null) {
                log.warn("Thiếu thông tin credential để refresh token Lazada");
                return false;
            }

            JsonNode res = getLazadaClient().refreshToken(appKey, appSecret, decryptedRefresh);
            String newAccessToken = res.path("access_token").asText(null);
            String newRefreshToken = res.path("refresh_token").asText(null);
            long expiresIn = res.path("expires_in").asLong(2592000L);

            if (newAccessToken != null && !newAccessToken.isBlank()) {
                kenh.setApiKey(paymentSecretCipher.encrypt(newAccessToken));
                if (newRefreshToken != null && !newRefreshToken.isBlank()) {
                    kenh.setRefreshToken(paymentSecretCipher.encrypt(newRefreshToken));
                }
                kenh.setTokenExpiresAt(Instant.now().plusSeconds(expiresIn));
                kenhBanHangRepository.save(kenh);
                log.info("Làm mới Access Token Lazada thành công qua Refresh Token!");
                return true;
            } else {
                log.error("Lazada từ chối Refresh Token: {}", res.path("message").asText());
                return false;
            }
        } catch (Exception e) {
            log.error("Lỗi làm mới token Lazada: {}", e.getMessage());
            return false;
        } finally {
            lazadaTokenRefreshLock.unlock();
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String getDecryptedLazadaAccessToken() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
        if (kenh == null || kenh.getApiKey() == null || kenh.getApiKey().isBlank()) {
            return null;
        }

        // Proactive Refresh: nếu token sắp hết hạn trong vòng 48h
        if (kenh.getTokenExpiresAt() != null && kenh.getRefreshToken() != null) {
            long secondsLeft = java.time.Duration.between(Instant.now(), kenh.getTokenExpiresAt()).getSeconds();
            if (secondsLeft < 172_800) { // < 48 giờ
                refreshLazadaAccessToken();
                kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
            }
        }

        if (kenh == null || kenh.getApiKey() == null) {
            return null;
        }

        try {
            return paymentSecretCipher.decrypt(kenh.getApiKey());
        } catch (Exception e) {
            log.error("Lỗi giải mã Access Token Lazada: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public String getDecryptedLazadaAppSecret() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
        if (kenh == null || kenh.getApiSecret() == null || kenh.getApiSecret().isBlank()) {
            return null;
        }
        try {
            return paymentSecretCipher.decrypt(kenh.getApiSecret());
        } catch (Exception e) {
            log.error("Lỗi giải mã App Secret Lazada: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public String getLazadaAppKey() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
        return kenh != null ? kenh.getClientId() : null;
    }
}