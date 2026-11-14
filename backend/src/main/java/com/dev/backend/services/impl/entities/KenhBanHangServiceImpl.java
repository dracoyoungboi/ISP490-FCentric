package com.dev.backend.services.impl.entities;

import com.dev.backend.i18n.ThongDiep;
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
import com.dev.backend.services.tiktok.TikTokShopClient;
import com.dev.backend.constants.TikTokShopConstants;
import com.dev.backend.dto.request.TikTokConfigUpdating;
import com.dev.backend.dto.request.TikTokOAuthCallbackRequest;
import com.dev.backend.dto.request.TikTokTestConnectionRequest;
import com.dev.backend.dto.response.customize.TikTokAuthorizedShopsResponse;
import com.dev.backend.dto.response.customize.TikTokShopDto;
import com.dev.backend.dto.response.customize.TikTokTestConnectionResponse;
import com.dev.backend.dto.response.entities.TikTokConfigResponse;
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
    public static final String MA_KENH_LAZADA_SANDBOX = "LAZADA_SANDBOX";
    public static final String DEFAULT_LAZADA_API_URL = "https://api.lazada.vn/rest";
    public static final String MA_KENH_SHOPEE = "SHOPEE";
    public static final String MA_KENH_SHOPEE_OFFICIAL = "SHOPEE_OFFICIAL";
    public static final String MA_KENH_SHOPEE_SANDBOX = "SHOPEE_SANDBOX";

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
    static final String LOI_MIEN_SHOPIFY = ThongDiep.vi("kenhBan.loiMienShopify");

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
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    TikTokShopClient tiktokShopClient;

    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    com.dev.backend.repository.CauHinhHeThongRepository cauHinhHeThongRepository;
    /** Báo quản trị viên kênh cần ủy quyền lại / đánh dấu đã xử lý khi làm mới được; null khi test dựng tay. */
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    ThongBaoHeThongService thongBaoHeThongService;
    private void uyQuyenDaOn(String maKenh) {
        if (thongBaoHeThongService != null) thongBaoHeThongService.uyQuyenDaOn(maKenh);
    }
    private TikTokShopClient getTikTokShopClient() {
        if (tiktokShopClient == null) tiktokShopClient = new TikTokShopClient();
        return tiktokShopClient;
    }

    @lombok.experimental.NonFinal
    java.util.concurrent.locks.ReentrantLock tikTokTokenRefreshLock = new java.util.concurrent.locks.ReentrantLock();

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
                ThongDiep.of("kenhBan.shopifyTuChoiKhoaLamMoi", maHttp));
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

    /**
     * Tên sàn làm tham số của câu theo khóa: thiếu mã thì "sàn này" theo đúng ngôn ngữ của câu (câu tiếng Anh không lẫn
     * chữ Việt); có mã thì như {@link #tenSan}.
     */
    public static Object tenSanTrongCau(String maKenh) {
        return maKenh == null || maKenh.isBlank() ? ThongDiep.of("hienThiKenhPos.sanNay") : tenSan(maKenh);
    }

    @Autowired
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
            throw new CommonException(ThongDiep.of("kenhBan.shopifyDomainTrong"), HttpStatus.BAD_REQUEST, null);
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
            throw new CommonException(ThongDiep.of("kenhBan.loiMienShopify"), HttpStatus.BAD_REQUEST, null);
        }
        boolean doiCuaHang = !mienCu.isBlank() && !mienCu.equals(cleanDomain);
        if (dangKetNoi && doiCuaHang) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.GIAN_HANG_KHAC,
                    ThongDiep.of("kenhBan.dangKetNoiCuaHangKhac", mienCu));
        }
        boolean coKhoaMoi = coGiaTri(request.getAccessToken());
        if (!dangKetNoi && !coKhoaMoi && kenh.getId() != null) {
            // Kênh đã ngắt (vd. tab cũ lưu công tắc đồng bộ): không lưu, kẻo bật lại trạng thái khi chưa có khóa
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.KENH_CHUA_KET_NOI,
                    ThongDiep.of("kenhBan.shopifyChuaKetNoiNhapKhoa"));
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
        // Đã dán khóa truy cập mới (việc thông báo H1 nhắc làm): thông báo cũ coi như xong
        if (coKhoaMoi) uyQuyenDaOn(MA_KENH_SHOPIFY);

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
                    .message(ThongDiep.dich("kenhBan.chuaCoShopifyDomainKiemTra"))
                    .build();
        }
        boolean mienMoi = !domain.equals(mienDaLuu);
        if (mienMoi && !MIEN_SHOPIFY.matcher(domain).matches()) {
            return ShopifyTestConnectionResponse.builder().connected(false).message(ThongDiep.dich("kenhBan.loiMienShopify")).build();
        }

        boolean coKhoaMoi = request.getAccessToken() != null && !request.getAccessToken().isBlank();
        if (mienMoi && !coKhoaMoi && kenhDaLuu != null && coGiaTri(kenhDaLuu.getApiKey())) {
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message(ThongDiep.dich("kenhBan.nhapKhoaTruyCapCuaHang", domain))
                    .build();
        }
        // Khóa đã lưu chỉ dùng cho tên miền đã lưu: không bao giờ gửi sang tên miền khác
        String tokenToTest = coKhoaMoi ? request.getAccessToken().trim()
                : mienMoi ? null : getDecryptedShopifyAccessToken();

        if (tokenToTest == null || tokenToTest.isBlank()) {
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message(ThongDiep.dich("kenhBan.chuaCoAdminAccessToken"))
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
                        .message(ThongDiep.dich("kenhBan.ketNoiCuaHangShopifyThanhCong", name))
                        .build();
            } else {
                return ShopifyTestConnectionResponse.builder()
                        .connected(false)
                        .message(ThongDiep.dich("kenhBan.shopifyTraMaTrangThai", response.getStatusCode()))
                        .build();
            }
        } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden e) {
            log.warn("Shopify test connection failed (auth error): {}", e.getMessage());
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message(ThongDiep.dich("kenhBan.accessTokenShopifyKhongHopLe"))
                    .build();
        } catch (Exception e) {
            log.error("Shopify test connection failed: {}", e.getMessage());
            // Câu cố định: chi tiết lỗi kết nối (từ chối, hết giờ, lỗi chứng chỉ…) để dò được cổng / máy trong mạng
            return ShopifyTestConnectionResponse.builder()
                    .connected(false)
                    .message(ThongDiep.dich("kenhBan.khongTheKetNoiShopify"))
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
                throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhKenhShopify"), HttpStatus.BAD_REQUEST, null);
            }
            if (!coGiaTri(khoa.getRefreshToken())) {
                throw new CommonException(ThongDiep.of("kenhBan.shopifyDungStaticToken"), HttpStatus.BAD_REQUEST, null);
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
                    uyQuyenDaOn(MA_KENH_SHOPIFY);
                    return true;
                }
            }
            return false;
        } catch (HttpClientErrorException e) {
            int maHttp = e.getStatusCode().value();
            log.error("Shopify OAuth refresh error [{}]", e.getStatusCode());
            if (!MA_TU_CHOI_LAM_MOI.contains(maHttp)) {
                throw new LoiCoMaException(HTTP_LAM_MOI_KHOA_LOI, MaLoi.LAM_MOI_KHOA_LOI,
                        ThongDiep.of("kenhBan.shopifyChuaCapLaiKhoa", maHttp));
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
            // Ghi dấu một lần mỗi máy (lần sau dùng dấu, không gọi lại Shopify): báo quản trị viên ủy quyền lại
            if (thongBaoHeThongService != null) {
                thongBaoHeThongService.kenhCanUyQuyenLai(MA_KENH_SHOPIFY, null, hienTai.getId(), hienTai.getTokenExpiresAt());
            }
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
        if (MA_KENH_LAZADA.equals(ma) || MA_KENH_LAZADA_SANDBOX.equals(ma)) {
            KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
            boolean isSandbox = MA_KENH_LAZADA_SANDBOX.equals(ma);
            String defaultTenKenh = isSandbox ? "Lazada Sandbox" : "Gian hàng Lazada";
            if (kenh == null) {
                return ShopifyConfigResponse.builder()
                        .maKenh(ma)
                        .tenKenh(defaultTenKenh)
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
                    .tenKenh(kenh.getTenKenh() != null ? kenh.getTenKenh() : defaultTenKenh)
                    .loaiKenh("online")
                    .appKey(kenh.getClientId())
                    .serviceId(kenh.getServiceId())
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
        if (MA_KENH_SHOPEE.equals(ma) || MA_KENH_SHOPEE_OFFICIAL.equals(ma) || MA_KENH_SHOPEE_SANDBOX.equals(ma)) {
            KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
            boolean isSandbox = MA_KENH_SHOPEE_SANDBOX.equals(ma);
            boolean isOfficial = MA_KENH_SHOPEE_OFFICIAL.equals(ma);
            String defaultTenKenh = isOfficial ? "Shopee Chính Thống" : (isSandbox ? "Shopee Sandbox" : "Gian hàng Shopee");
            if (kenh == null) {
                return ShopifyConfigResponse.builder()
                        .maKenh(ma)
                        .tenKenh(defaultTenKenh)
                        .loaiKenh("online")
                        .kieuKetNoi(isOfficial || isSandbox ? KIEU_UY_QUYEN : "ben_thu_ba")
                        .trangThaiKetNoi(CHUA_KET_NOI)
                        .trangThai(1)
                        .build();
            }
            boolean hasSecret = kenh.getApiSecret() != null && !kenh.getApiSecret().isBlank();
            boolean hasToken = kenh.getApiKey() != null && !kenh.getApiKey().isBlank();
            boolean hasShopId = kenh.getClientId() != null && !kenh.getClientId().isBlank();
            boolean isExpired = hasToken && kenh.getTokenExpiresAt() != null && Instant.now().isAfter(kenh.getTokenExpiresAt());

            String trangThaiKetNoi = CHUA_KET_NOI;
            if (!isOfficial && !isSandbox && hasShopId) {
                // Kênh Shopee Shop ID kết nối trực tiếp chỉ cần có Shop ID hợp lệ
                trangThaiKetNoi = Integer.valueOf(1).equals(kenh.getTrangThai()) ? DANG_HOAT_DONG : "tam_dung";
            } else if (hasToken) {
                trangThaiKetNoi = isExpired ? HET_HAN : (Integer.valueOf(1).equals(kenh.getTrangThai()) ? DANG_HOAT_DONG : "tam_dung");
            }

            Long soNgayCon = null;
            if (kenh.getTokenExpiresAt() != null) {
                long seconds = Duration.between(Instant.now(), kenh.getTokenExpiresAt()).getSeconds();
                soNgayCon = Math.max(0L, seconds / 86400L);
            } else if (!isOfficial && !isSandbox && hasShopId) {
                soNgayCon = 365L;
            }
            String maskedToken = hasToken ? cheKhoa(kenh.getApiKey(), this::maskToken) : null;
            String numericShopId = null;
            if (kenh.getShopCipher() != null && kenh.getShopCipher().matches("^\\d+$")) {
                numericShopId = kenh.getShopCipher().trim();
            } else if (kenh.getShopDomain() != null && kenh.getShopDomain().matches("^\\d+$")) {
                numericShopId = kenh.getShopDomain().trim();
            }

            return ShopifyConfigResponse.builder()
                    .id(kenh.getId())
                    .maKenh(ma)
                    .tenKenh(kenh.getTenKenh() != null ? kenh.getTenKenh() : defaultTenKenh)
                    .loaiKenh("online")
                    .appKey(kenh.getClientId())
                    .serviceId(kenh.getServiceId())
                    .hasAppSecret(hasSecret)
                    .hasAccessToken(hasToken)
                    .accessTokenMasked(maskedToken)
                    .tokenExpiresAt(kenh.getTokenExpiresAt())
                    .hanUyQuyen(kenh.getTokenExpiresAt())
                    .soNgayConUyQuyen(soNgayCon)
                    .ngayUyQuyen(kenh.getNgayCapNhat())
                    .tenGianHang(kenh.getTenKenh())
                    .shopIdSan(numericShopId)
                    .shopDomain(numericShopId)
                    .trangThai(kenh.getTrangThai() != null ? kenh.getTrangThai() : 1)
                    .kieuKetNoi(isOfficial || isSandbox ? KIEU_UY_QUYEN : "ben_thu_ba")
                    .trangThaiKetNoi(trangThaiKetNoi)
                    .ngayCapNhat(kenh.getNgayCapNhat())
                    .build();
        }
        if ("TIKTOK".equals(ma)) {
            KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
            if (kenh == null) {
                return ShopifyConfigResponse.builder()
                        .maKenh(ma)
                        .tenKenh("TikTok Shop")
                        .loaiKenh("online")
                        .kieuKetNoi(KIEU_UY_QUYEN)
                        .trangThaiKetNoi(CHUA_KET_NOI)
                        .trangThai(1)
                        .build();
            }
            boolean hasSecret = kenh.getApiSecret() != null && !kenh.getApiSecret().isBlank();
            boolean hasToken = kenh.getApiKey() != null && !kenh.getApiKey().isBlank();
            // Tự động chuẩn hóa hạn token nếu còn tàn dư lỗi năm 2083
            if (kenh.getTokenExpiresAt() != null && kenh.getTokenExpiresAt().isAfter(Instant.now().plus(Duration.ofDays(60)))) {
                kenh.setTokenExpiresAt(Instant.now().plus(Duration.ofDays(7)));
                kenhBanHangRepository.save(kenh);
            }

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
            String maKhoSan = null;
            String tenKhoSan = null;
            if (cauHinhHeThongRepository != null) {
                maKhoSan = cauHinhHeThongRepository.findById("KENH_" + ma + "_MA_KHO_SAN")
                        .map(com.dev.backend.entities.CauHinhHeThong::getGiaTri).orElse(null);
                tenKhoSan = cauHinhHeThongRepository.findById("KENH_" + ma + "_TEN_KHO_SAN")
                        .map(com.dev.backend.entities.CauHinhHeThong::getGiaTri).orElse(null);
            }

            // Tự động phục hồi Shop Cipher nếu bị thiếu hoặc bị ghi đè
            String cipherThucTe = ensureValidTikTokShopCipher(kenh);
            String tenGianHang = (kenh.getApiUrl() != null && !kenh.getApiUrl().isBlank() && !kenh.getApiUrl().contains("::"))
                    ? kenh.getApiUrl().trim()
                    : (kenh.getTenKenh() != null ? kenh.getTenKenh() : "Gian hàng TikTok Shop");

            return ShopifyConfigResponse.builder()
                    .id(kenh.getId())
                    .maKenh(ma)
                    .tenKenh(kenh.getTenKenh() != null ? kenh.getTenKenh() : "Gian hàng TikTok Shop")
                    .loaiKenh("online")
                    .appKey(kenh.getClientId())
                    .serviceId(kenh.getServiceId())
                    .hasAppSecret(hasSecret)
                    .hasAccessToken(hasToken)
                    .accessTokenMasked(maskedToken)
                    .tokenExpiresAt(kenh.getTokenExpiresAt())
                    .hanUyQuyen(kenh.getTokenExpiresAt())
                    .soNgayConUyQuyen(soNgayCon)
                    .ngayUyQuyen(kenh.getNgayCapNhat())
                    .tenGianHang(tenGianHang)
                    .shopIdSan(cipherThucTe)
                    .trangThai(kenh.getTrangThai() != null ? kenh.getTrangThai() : 1)
                    .kieuKetNoi(KIEU_UY_QUYEN)
                    .trangThaiKetNoi(trangThaiKetNoi)
                    .maKhoSan(maKhoSan)
                    .tenKhoSan(tenKhoSan)
                    .ngayCapNhat(kenh.getNgayCapNhat())
                    .build();
        }
        throw sanKhongHoTro(ma);
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
                    ThongDiep.of("kenhBan.chuaCapLaiDuocKhoa"));
        }
        return getShopifyConfig();
    }

    private static LoiCoMaException shopifyChuaKetNoi() {
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.KENH_CHUA_KET_NOI,
                ThongDiep.of("kenhBan.shopifyChuaKetNoi"));
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
                // Làm sạch mã sản phẩm trên sàn cũ, bảo toàn 100% đơn hàng và tồn kho
                trangThaiDongBoSanPhamRepository.xoaDuLieuCuaHangCu(khoa.getId());
                trangThaiDongBoSanPhamRepository.danhDauChuaGhep(khoa.getId(), "Gian hàng đã ngắt kết nối. Vui lòng kết nối lại để tiếp tục đồng bộ.");
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
            if (thongBaoHeThongService != null) thongBaoHeThongService.kenhDaNgat(MA_KENH_SHOPIFY);
        }
    }

    private static String chuanHoaMaKenh(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.maKenhTrong"), HttpStatus.BAD_REQUEST, null);
        }
        return maKenh.trim().toUpperCase(Locale.ROOT);
    }

    private static LoiCoMaException sanKhongHoTro(String ma) {
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.SAN_KHONG_HO_TRO,
                ThongDiep.of("kenhBan.sanKhongHoTroKetNoi", tenSanTrongCau(ma)));
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

    // Che khóa / mã định danh trước khi hiện hoặc ghi nhật ký kênh: giữ 4 ký tự cuối
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
    // LAZADA OPEN PLATFORM INTEGRATION (Hỗ trợ song song Production & Sandbox)
    // ═══════════════════════════════════════════════════════════════════

    @Override
    @Transactional(readOnly = true)
    public LazadaConfigResponse getLazadaConfig() {
        return getLazadaConfig(MA_KENH_LAZADA);
    }

    @Override
    @Transactional(readOnly = true)
    public LazadaConfigResponse getLazadaConfig(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        boolean isSandbox = MA_KENH_LAZADA_SANDBOX.equals(ma);
        String defaultTenKenh = isSandbox ? "Lazada Sandbox (Môi trường Thử nghiệm)" : "Gian hàng Lazada";

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh == null) {
            return LazadaConfigResponse.builder()
                    .maKenh(ma)
                    .tenKenh(defaultTenKenh)
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
        return updateLazadaConfig(MA_KENH_LAZADA, request);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LazadaConfigResponse updateLazadaConfig(String maKenh, LazadaConfigUpdating request) {
        if (request.getAppKey() == null || request.getAppKey().isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.lazadaAppKeyTrong"), HttpStatus.BAD_REQUEST, null);
        }

        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        boolean isSandbox = MA_KENH_LAZADA_SANDBOX.equals(ma);
        String defaultTenKenh = isSandbox ? "Lazada Sandbox (Môi trường Thử nghiệm)" : "Gian hàng Lazada";

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma)
                .orElseGet(() -> KenhBanHang.builder()
                        .maKenh(ma)
                        .tenKenh(defaultTenKenh)
                        .loaiKenh("online")
                        .apiUrl(DEFAULT_LAZADA_API_URL)
                        .trangThai(1)
                        .build());

        kenh.setTenKenh(defaultTenKenh);
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
        ghiLichSuThayDoi(saved, (isSandbox ? "Lazada Sandbox" : "Lazada") + " AppKey: " + maskToken(request.getAppKey()));

        return getLazadaConfig(ma);
    }

    @Override
    public LazadaTestConnectionResponse testLazadaConnection(LazadaTestConnectionRequest request) {
        return testLazadaConnection(MA_KENH_LAZADA, request);
    }

    @Override
    public LazadaTestConnectionResponse testLazadaConnection(String maKenh, LazadaTestConnectionRequest request) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        String appKey = request.getAppKey() != null && !request.getAppKey().isBlank()
                ? request.getAppKey().trim()
                : getLazadaAppKey(ma);

        String appSecret = request.getAppSecret() != null && !request.getAppSecret().isBlank()
                ? request.getAppSecret().trim()
                : getDecryptedLazadaAppSecret(ma);

        String accessToken = request.getAccessToken() != null && !request.getAccessToken().isBlank()
                ? request.getAccessToken().trim()
                : getDecryptedLazadaAccessToken(ma);

        return getLazadaClient().testConnection(appKey, appSecret, accessToken);
    }

    @Override
    public String getLazadaAuthUrl(String redirectUri) {
        return getLazadaAuthUrl(MA_KENH_LAZADA, redirectUri, null);
    }

    @Override
    public String getLazadaAuthUrl(String redirectUri, String state) {
        return getLazadaAuthUrl(MA_KENH_LAZADA, redirectUri, state);
    }

    @Override
    public String getLazadaAuthUrl(String maKenh, String redirectUri, String state) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        boolean isSandbox = MA_KENH_LAZADA_SANDBOX.equals(ma);

        String appKey = getLazadaAppKey(ma);
        if (appKey == null || appKey.isBlank()) {
            if (isSandbox) {
                appKey = getLazadaAppKey(MA_KENH_LAZADA);
            }
            if (appKey == null || appKey.isBlank()) {
                throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhAppKeyKenh", (isSandbox ? "Lazada Sandbox" : "Lazada")), HttpStatus.BAD_REQUEST, null);
            }
        }
        return getLazadaClient().generateAuthUrl(appKey, redirectUri, state, !isSandbox);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LazadaConfigResponse exchangeLazadaToken(LazadaOAuthCallbackRequest request) {
        return exchangeLazadaToken(MA_KENH_LAZADA, request);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LazadaConfigResponse exchangeLazadaToken(String maKenh, LazadaOAuthCallbackRequest request) {
        if (request.getCode() == null || request.getCode().isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.authorizationCodeTrong"), HttpStatus.BAD_REQUEST, null);
        }

        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        boolean isSandbox = MA_KENH_LAZADA_SANDBOX.equals(ma);

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh == null) {
            kenh = KenhBanHang.builder()
                    .maKenh(ma)
                    .tenKenh(isSandbox ? "Lazada Sandbox (Môi trường Thử nghiệm)" : "Gian hàng Lazada")
                    .loaiKenh("online")
                    .apiUrl(DEFAULT_LAZADA_API_URL)
                    .trangThai(1)
                    .build();
        }

        String appKey = request.getAppKey() != null && !request.getAppKey().isBlank()
                ? request.getAppKey().trim()
                : kenh.getClientId();
        if ((appKey == null || appKey.isBlank()) && isSandbox) {
            appKey = getLazadaAppKey(MA_KENH_LAZADA);
            kenh.setClientId(appKey);
        }

        String appSecret = getDecryptedLazadaAppSecret(ma);
        if ((appSecret == null || appSecret.isBlank()) && isSandbox) {
            appSecret = getDecryptedLazadaAppSecret(MA_KENH_LAZADA);
            KenhBanHang prodKenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
            if (prodKenh != null && prodKenh.getApiSecret() != null) {
                kenh.setApiSecret(prodKenh.getApiSecret());
            }
        }

        if (appKey == null || appKey.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhAppKeySecretKenh", (isSandbox ? "Lazada Sandbox" : "Lazada")), HttpStatus.BAD_REQUEST, null);
        }

        try {
            JsonNode res = getLazadaClient().exchangeToken(appKey, appSecret, request.getCode());
            String accessToken = res.path("access_token").asText(null);
            String refreshToken = res.path("refresh_token").asText(null);
            long expiresIn = res.path("expires_in").asLong(2592000L); // 30 ngày mặc định

            if (accessToken == null || accessToken.isBlank()) {
                String errorMsg = res.path("message").asText(res.path("sub_message").asText(null));
                throw new CommonException(errorMsg != null
                        ? ThongDiep.of("kenhBan.loiXacThucOAuth2", "Lazada", errorMsg)
                        : ThongDiep.of("kenhBan.loiXacThucOAuth2LazadaMacDinh"), HttpStatus.BAD_REQUEST, null);
            }

            String oldSellerId = kenh.getApiUrl();
            String account = res.path("account").asText(null);
            String sellerId = res.path("country_user_info").path(0).path("seller_id").asText(null);
            if (sellerId == null || sellerId.isBlank()) {
                sellerId = res.path("seller_id").asText(null);
            }
            String newIdentifier = (sellerId != null && !sellerId.isBlank()) ? sellerId : account;
            boolean doiCuaHang = oldSellerId != null && !oldSellerId.isBlank()
                    && newIdentifier != null && !newIdentifier.isBlank()
                    && !oldSellerId.trim().equalsIgnoreCase(newIdentifier.trim());

            if (newIdentifier != null && !newIdentifier.isBlank()) {
                kenh.setApiUrl(newIdentifier);
            }
            kenh.setApiKey(paymentSecretCipher.encrypt(accessToken));
            if (refreshToken != null && !refreshToken.isBlank()) {
                kenh.setRefreshToken(paymentSecretCipher.encrypt(refreshToken));
            }
            kenh.setTokenExpiresAt(Instant.now().plusSeconds(expiresIn));
            kenh.setTrangThai(1);
            KenhBanHang saved = kenhBanHangRepository.save(kenh);

            // Khi kết nối sang gian hàng khác: làm sạch mã SKU sàn cũ để ghép lại, bảo toàn đơn hàng
            if (doiCuaHang && saved.getId() != null) {
                trangThaiDongBoSanPhamRepository.xoaDuLieuCuaHangCu(saved.getId());
                trangThaiDongBoSanPhamRepository.danhDauChuaGhep(saved.getId(), LY_DO_CHUA_GHEP);
                ghiLichSuThayDoi(saved.getId(), "Kết nối " + (isSandbox ? "Lazada Sandbox" : "Lazada") + " sang gian hàng khác: " + oldSellerId + " → " + newIdentifier,
                        "Làm sạch mã SKU sàn cũ để ghép lại, bảo toàn 100% đơn hàng");
            }

            ghiLichSuThayDoi(kenh, "Ủy quyền OAuth2 " + (isSandbox ? "Lazada Sandbox" : "Lazada") + " thành công (Token hiệu lực " + (expiresIn / 86400) + " ngày)");
            uyQuyenDaOn(ma);

            return getLazadaConfig(ma);
        } catch (CommonException ce) {
            throw ce;
        } catch (Exception e) {
            log.error("Lỗi khi trao đổi token OAuth Lazada: {}", e.getMessage());
            throw new CommonException(ThongDiep.of("kenhBan.khongTheHoanTatUyQuyen", "Lazada", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xoaKhoaLazada() {
        xoaKhoaLazada(MA_KENH_LAZADA);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xoaKhoaLazada(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh != null) {
            kenh.setApiKey(null);
            kenh.setRefreshToken(null);
            kenh.setTokenExpiresAt(null);
            kenh.setShopCipher(null);
            kenh.setTrangThai(0);
            kenhBanHangRepository.save(kenh);

            // Tự động làm sạch mã sản phẩm trên sàn cũ trong bảng trạng thái đồng bộ, bảo toàn 100% đơn hàng
            if (kenh.getId() != null) {
                trangThaiDongBoSanPhamRepository.xoaDuLieuCuaHangCu(kenh.getId());
                trangThaiDongBoSanPhamRepository.danhDauChuaGhep(kenh.getId(), "Gian hàng đã ngắt kết nối. Vui lòng kết nối lại để tiếp tục đồng bộ.");
            }

            ghiLichSuThayDoi(kenh, "Ngắt kết nối gian hàng " + (ma.contains("SANDBOX") ? "Lazada Sandbox" : "Lazada") + " (xóa Access Token, làm sạch mã SKU sàn cũ, bảo toàn đơn hàng)");
            if (thongBaoHeThongService != null) thongBaoHeThongService.kenhDaNgat(ma);
        }
    }

    @Override
    public boolean refreshLazadaAccessToken() {
        return refreshLazadaAccessToken(MA_KENH_LAZADA);
    }

    @Override
    public boolean refreshLazadaAccessToken(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        lazadaTokenRefreshLock.lock();
        try {
            KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
            if (kenh == null || kenh.getRefreshToken() == null || kenh.getRefreshToken().isBlank()) {
                log.warn("Không thể refresh token {}: thiếu Refresh Token", ma);
                return false;
            }

            String appKey = kenh.getClientId();
            if (appKey == null || appKey.isBlank()) {
                appKey = getLazadaAppKey(ma);
            }
            String appSecret = getDecryptedLazadaAppSecret(ma);
            String decryptedRefresh = paymentSecretCipher.decrypt(kenh.getRefreshToken());

            if (appKey == null || appSecret == null || decryptedRefresh == null) {
                log.warn("Thiếu thông tin credential để refresh token {}", ma);
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
                log.info("Làm mới thành công Access Token {} qua LazOP API", ma);
                return true;
            } else {
                log.error("Lazada từ chối làm mới token {}: {}", ma, res);
                return false;
            }
        } catch (Exception e) {
            log.error("Ngoại lệ khi làm mới token {}: {}", ma, e.getMessage());
            return false;
        } finally {
            lazadaTokenRefreshLock.unlock();
        }
    }

    @Override
    public String getDecryptedLazadaAccessToken() {
        return getDecryptedLazadaAccessToken(MA_KENH_LAZADA);
    }

    @Override
    public String getDecryptedLazadaAccessToken(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh != null && kenh.getTokenExpiresAt() != null) {
            long secondsLeft = Duration.between(Instant.now(), kenh.getTokenExpiresAt()).getSeconds();
            if (secondsLeft < 172_800) { // < 48 giờ
                refreshLazadaAccessToken(ma);
                kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
            }
        }

        if (kenh == null || kenh.getApiKey() == null) {
            return null;
        }
        try {
            return paymentSecretCipher.decrypt(kenh.getApiKey());
        } catch (Exception e) {
            log.error("Lỗi giải mã Access Token {}: {}", ma, e.getMessage());
            return null;
        }
    }

    @Override
    public String getDecryptedLazadaAppSecret() {
        return getDecryptedLazadaAppSecret(MA_KENH_LAZADA);
    }

    @Override
    public String getDecryptedLazadaAppSecret(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if ((kenh == null || kenh.getApiSecret() == null || kenh.getApiSecret().isBlank()) && MA_KENH_LAZADA_SANDBOX.equals(ma)) {
            kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
        }
        if (kenh == null || kenh.getApiSecret() == null || kenh.getApiSecret().isBlank()) {
            return null;
        }
        try {
            return paymentSecretCipher.decrypt(kenh.getApiSecret());
        } catch (Exception e) {
            log.error("Lỗi giải mã App Secret {}: {}", ma, e.getMessage());
            return null;
        }
    }

    @Override
    public String getLazadaAppKey() {
        return getLazadaAppKey(MA_KENH_LAZADA);
    }

    @Override
    public String getLazadaAppKey(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_LAZADA;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if ((kenh == null || kenh.getClientId() == null || kenh.getClientId().isBlank()) && MA_KENH_LAZADA_SANDBOX.equals(ma)) {
            kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_LAZADA).orElse(null);
        }
        return kenh != null ? kenh.getClientId() : null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // TIKTOK SHOP OPEN PLATFORM (v202309) INTEGRATION
    // ═══════════════════════════════════════════════════════════════════

    public static final String MA_KENH_TIKTOK = "TIKTOK";
    public static final String DEFAULT_TIKTOK_API_URL = TikTokShopConstants.BASE_URL;

    @Override
    @Transactional(readOnly = true)
    public TikTokConfigResponse getTikTokConfig() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
        if (kenh == null) {
            return TikTokConfigResponse.builder()
                    .maKenh(MA_KENH_TIKTOK)
                    .tenKenh("TikTok Shop")
                    .loaiKenh("online")
                    .apiUrl(DEFAULT_TIKTOK_API_URL)
                    .appKey("")
                    .hasAppSecret(false)
                    .hasAccessToken(false)
                    .accessTokenMasked(null)
                    .hasRefreshToken(false)
                    .refreshTokenMasked(null)
                    .tokenExpiresAt(null)
                    .isTokenExpired(false)
                    .secondsUntilExpiration(null)
                    .shopCipher(null)
                    .maKhoSan(null)
                    .tenKhoSan(null)
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

        return TikTokConfigResponse.builder()
                .id(kenh.getId())
                .maKenh(kenh.getMaKenh())
                .tenKenh(kenh.getTenKenh())
                .loaiKenh(kenh.getLoaiKenh())
                .apiUrl(kenh.getApiUrl() != null ? kenh.getApiUrl() : DEFAULT_TIKTOK_API_URL)
                .appKey(kenh.getClientId())
                .serviceId(kenh.getServiceId())
                .hasAppSecret(hasSecret)
                .hasAccessToken(hasToken)
                .accessTokenMasked(maskedToken)
                .hasRefreshToken(hasRefresh)
                .refreshTokenMasked(maskedRefresh)
                .tokenExpiresAt(kenh.getTokenExpiresAt())
                .isTokenExpired(isExpired)
                .secondsUntilExpiration(secondsUntilExpiration)
                .shopCipher(kenh.getShopCipher())
                .maKhoSan(null)
                .tenKhoSan(null)
                .trangThai(kenh.getTrangThai())
                .ngayCapNhat(kenh.getNgayCapNhat())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TikTokConfigResponse updateTikTokConfig(TikTokConfigUpdating request) {
        if (request.getAppKey() == null || request.getAppKey().isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.tiktokAppKeyTrong"), HttpStatus.BAD_REQUEST, null);
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK)
                .orElseGet(() -> KenhBanHang.builder()
                        .maKenh(MA_KENH_TIKTOK)
                        .tenKenh("TikTok Shop")
                        .loaiKenh("online")
                        .apiUrl(DEFAULT_TIKTOK_API_URL)
                        .trangThai(1)
                        .build());

        kenh.setTenKenh("TikTok Shop");
        kenh.setLoaiKenh("online");
        if (kenh.getApiUrl() == null || kenh.getApiUrl().isBlank()) {
            kenh.setApiUrl(DEFAULT_TIKTOK_API_URL);
        }
        kenh.setClientId(request.getAppKey().trim());

        if (request.getTrangThai() != null) {
            kenh.setTrangThai(request.getTrangThai());
        }

        if (request.getShopCipher() != null && !request.getShopCipher().isBlank()) {
            kenh.setShopCipher(request.getShopCipher().trim());
        }

        if (request.getServiceId() != null) {
            kenh.setServiceId(request.getServiceId().trim());
        }

        // Thông tin kho đồng bộ TikTok Shop được lưu trữ trong cấu hình đồng bộ kênh (cau_hinh_dong_bo_kenh)

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
        ghiLichSuThayDoi(saved, "Cập nhật cấu hình TikTok Shop (AppKey: " + maskToken(request.getAppKey()) + ")");

        return getTikTokConfig();
    }

    @Override
    public TikTokTestConnectionResponse testTikTokConnection(TikTokTestConnectionRequest request) {
        String appKey = request.getAppKey() != null && !request.getAppKey().isBlank()
                ? request.getAppKey().trim()
                : getTikTokAppKey();

        String appSecret = request.getAppSecret() != null && !request.getAppSecret().isBlank()
                ? request.getAppSecret().trim()
                : getDecryptedTikTokAppSecret();

        String accessToken = request.getAccessToken() != null && !request.getAccessToken().isBlank()
                ? request.getAccessToken().trim()
                : getDecryptedTikTokAccessToken();

        // =========================================================================
        // [PRODUCTION FLOW] - Gọi trực tiếp TikTok Shop Open API qua TikTokShopClient
        // =========================================================================
        if (appKey == null || appKey.isBlank() || appSecret == null || appSecret.isBlank() || accessToken == null || accessToken.isBlank()) {
            return TikTokTestConnectionResponse.builder()
                    .connected(false)
                    .message(ThongDiep.dich("kenhBan.thieuThongTinKetNoi"))
                    .build();
        }

        try {
            TikTokAuthorizedShopsResponse res = getTikTokShopClient().getAuthorizedShops(appKey, appSecret, accessToken);
            if (res.getShops() != null && !res.getShops().isEmpty()) {
                TikTokShopDto shop = res.getShops().get(0);

                // Tự động lưu và đồng bộ Shop Cipher thật cùng tên gian hàng vào CSDL
                try {
                    KenhBanHang kenhDb = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
                    if (kenhDb != null) {
                        boolean coDoi = false;
                        if (shop.getCipher() != null && !shop.getCipher().equals(kenhDb.getShopCipher())) {
                            kenhDb.setShopCipher(shop.getCipher());
                            coDoi = true;
                        }
                        if (shop.getName() != null && !shop.getName().isBlank() && !shop.getName().equals(kenhDb.getApiUrl())) {
                            kenhDb.setApiUrl(shop.getName());
                            coDoi = true;
                        }
                        if (coDoi) {
                            kenhBanHangRepository.save(kenhDb);
                            log.info("[TIKTOK-TEST-CONN] Đã tự động cập nhật Shop Cipher ({}) và tên gian hàng ({})",
                                    maskToken(shop.getCipher()), shop.getName());
                        }
                    }
                } catch (Exception syncEx) {
                    log.warn("Không thể tự động cập nhật shop cipher khi test kết nối: {}", syncEx.getMessage());
                }

                int soKho = 0;
                try {
                    com.dev.backend.dto.response.customize.TikTokWarehousesResponse whRes =
                            getTikTokShopClient().getWarehouses(appKey, appSecret, accessToken, shop.getCipher());
                    if (whRes.getWarehouses() != null) {
                        soKho = whRes.getWarehouses().size();
                    }
                } catch (Exception whEx) {
                    log.warn("Không kiểm tra được kho logistics khi test kết nối TikTok Shop: {}", whEx.getMessage());
                }

                String msg = soKho > 0
                        ? ThongDiep.dich("kenhBan.ketNoiGianHangSoKho", shop.getName(), soKho)
                        : ThongDiep.dich("kenhBan.ketNoiTikTokGianHang", shop.getName());

                return TikTokTestConnectionResponse.builder()
                        .connected(true)
                        .message(msg)
                        .shopName(shop.getName())
                        .tenGianHang(shop.getName())
                        .shopId(shop.getId())
                        .shopIdSan(shop.getCode())
                        .cipher(shop.getCipher())
                        .region(shop.getRegion())
                        .sellerType(shop.getSellerType())
                        .build();
            } else {
                return TikTokTestConnectionResponse.builder()
                        .connected(false)
                        .message(ThongDiep.dich("kenhBan.khongTimThayGianHangUyQuyen"))
                        .build();
            }
        } catch (Exception e) {
            log.error("Kiểm tra kết nối TikTok Shop thất bại: {}", e.getMessage());
            return TikTokTestConnectionResponse.builder()
                    .connected(false)
                    .message(ThongDiep.dich("kenhBan.ketNoiThatBai", e.getMessage()))
                    .build();
        }
    }

    @Override
    public String getTikTokAuthUrl(String redirectUri) {
        return getTikTokAuthUrl(redirectUri, java.util.UUID.randomUUID().toString());
    }

    @Override
    public String getTikTokAuthUrl(String redirectUri, String state) {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
        String serviceId = kenh != null ? kenh.getServiceId() : null;
        String appKey = getTikTokAppKey();

        // Chuẩn OAuth2 TikTok Shop: Ưu tiên Service ID (Partner App), nếu chưa cấu hình thì dùng App Key (Custom App)
        String authIdentifier = (serviceId != null && !serviceId.isBlank()) ? serviceId.trim() : appKey;
        if (authIdentifier == null || authIdentifier.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.tiktokAppKeyTrong"), HttpStatus.BAD_REQUEST, null);
        }
        String cleanState = (state != null && !state.isBlank()) ? state : ("tiktok_" + java.util.UUID.randomUUID().toString().replace("-", ""));
        return getTikTokShopClient().generateAuthUrl(authIdentifier, redirectUri, cleanState);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TikTokConfigResponse exchangeTikTokToken(TikTokOAuthCallbackRequest request) {
        if (request.getCode() == null || request.getCode().isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.authorizationCodeTikTokTrong"), HttpStatus.BAD_REQUEST, null);
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
        if (kenh == null) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaThietLapKenhTikTok"), HttpStatus.BAD_REQUEST, null);
        }

        // =========================================================================
        // [PRODUCTION FLOW] - Trao đổi OAuth2 Authorization Code thật với TikTok Shop
        // Gọi POST https://auth.tiktok-shops.com/api/v2/token/get và lấy shop_cipher
        // =========================================================================
        String appKey = request.getAppKey() != null && !request.getAppKey().isBlank()
                ? request.getAppKey().trim()
                : kenh.getClientId();

        String appSecret = getDecryptedTikTokAppSecret();

        if (appKey == null || appKey.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhAppKeySecretKenh", "TikTok Shop"), HttpStatus.BAD_REQUEST, null);
        }

        try {
            JsonNode res = getTikTokShopClient().exchangeToken(appKey, appSecret, request.getCode());
            JsonNode dataNode = res.path("data");
            String accessToken = dataNode.path("access_token").asText(null);
            String refreshToken = dataNode.path("refresh_token").asText(null);
            long rawExpire = dataNode.path("access_token_expire_in").asLong(0L);
            String sellerName = dataNode.path("seller_name").asText(null);

            if (accessToken == null || accessToken.isBlank()) {
                String errorMsg = res.path("message").asText(null);
                throw new CommonException(errorMsg != null
                        ? ThongDiep.of("kenhBan.loiXacThucOAuth2", "TikTok Shop", errorMsg)
                        : ThongDiep.of("kenhBan.loiXacThucOAuth2TikTokMacDinh"), HttpStatus.BAD_REQUEST, null);
            }

            kenh.setApiKey(paymentSecretCipher.encrypt(accessToken));
            if (refreshToken != null && !refreshToken.isBlank()) {
                kenh.setRefreshToken(paymentSecretCipher.encrypt(refreshToken));
            }
            kenh.setTokenExpiresAt(tinhHanTokenTikTok(rawExpire, 7));

            // Tự động gọi API lấy danh sách gian hàng để trích xuất shop_cipher
            try {
                TikTokAuthorizedShopsResponse shopsRes = getTikTokShopClient().getAuthorizedShops(appKey, appSecret, accessToken);
                if (shopsRes.getShops() != null && !shopsRes.getShops().isEmpty()) {
                    TikTokShopDto firstShop = shopsRes.getShops().get(0);
                    kenh.setShopCipher(firstShop.getCipher());
                    if (firstShop.getName() != null && !firstShop.getName().isBlank()) {
                        kenh.setApiUrl(firstShop.getName());
                    } else if (sellerName != null && !sellerName.isBlank()) {
                        kenh.setApiUrl(sellerName);
                    }
                }
            } catch (Exception shopEx) {
                log.warn("Không thể tự động trích xuất shop_cipher sau khi đổi token TikTok: {}", shopEx.getMessage());
            }

            kenh.setTrangThai(1);
            kenhBanHangRepository.save(kenh);

            ghiLichSuThayDoi(kenh, "Ủy quyền OAuth2 TikTok Shop thành công (Shop Cipher: " + maskToken(kenh.getShopCipher()) + ")");
            uyQuyenDaOn(MA_KENH_TIKTOK);

            return getTikTokConfig();
        } catch (CommonException ce) {
            throw ce;
        } catch (Exception e) {
            log.error("Lỗi khi trao đổi token OAuth TikTok Shop: {}", e.getMessage());
            throw new CommonException(ThongDiep.of("kenhBan.khongTheHoanTatUyQuyen", "TikTok Shop", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xoaKhoaTikTok() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
        if (kenh != null) {
            kenh.setApiKey(null);
            kenh.setRefreshToken(null);
            kenh.setTokenExpiresAt(null);
            kenh.setShopCipher(null);
            kenh.setTrangThai(0);
            kenhBanHangRepository.save(kenh);

            // Làm sạch mã sản phẩm trên sàn cũ, bảo toàn 100% đơn hàng
            if (kenh.getId() != null) {
                trangThaiDongBoSanPhamRepository.xoaDuLieuCuaHangCu(kenh.getId());
                trangThaiDongBoSanPhamRepository.danhDauChuaGhep(kenh.getId(), "Gian hàng đã ngắt kết nối. Vui lòng kết nối lại để tiếp tục đồng bộ.");
            }

            ghiLichSuThayDoi(kenh, "Ngắt kết nối gian hàng TikTok Shop (xóa Access Token, làm sạch mã SKU sàn cũ, bảo toàn đơn hàng)");
            if (thongBaoHeThongService != null) thongBaoHeThongService.kenhDaNgat(MA_KENH_TIKTOK);
        }
    }

    @Override
    public boolean refreshTikTokAccessToken() {
        tikTokTokenRefreshLock.lock();
        try {
            KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
            if (kenh == null || kenh.getRefreshToken() == null || kenh.getRefreshToken().isBlank()) {
                return false;
            }
            String appKey = kenh.getClientId();
            String appSecret = getDecryptedTikTokAppSecret();
            String decryptedRefresh = paymentSecretCipher.decrypt(kenh.getRefreshToken());

            if (appKey == null || appSecret == null || decryptedRefresh == null) {
                return false;
            }

            JsonNode res = getTikTokShopClient().refreshToken(appKey, appSecret, decryptedRefresh);
            JsonNode dataNode = res.path("data");

            String newAccessToken = dataNode.path("access_token").asText(null);
            String newRefreshToken = dataNode.path("refresh_token").asText(null);
            long rawExpire = dataNode.path("access_token_expire_in").asLong(0L);

            if (newAccessToken != null && !newAccessToken.isBlank()) {
                kenh.setApiKey(paymentSecretCipher.encrypt(newAccessToken));
                if (newRefreshToken != null && !newRefreshToken.isBlank()) {
                    kenh.setRefreshToken(paymentSecretCipher.encrypt(newRefreshToken));
                }
                kenh.setTokenExpiresAt(tinhHanTokenTikTok(rawExpire, 7));
                kenhBanHangRepository.save(kenh);
                ghiLichSuThayDoi(kenh, "Làm mới Access Token TikTok Shop tự động thành công");
                uyQuyenDaOn(MA_KENH_TIKTOK);
                return true;
            }
            return false;
        } catch (Exception e) {
            log.error("Lỗi khi làm mới Access Token TikTok Shop: {}", e.getMessage());
            return false;
        } finally {
            tikTokTokenRefreshLock.unlock();
        }
    }

    /**
     * Chuẩn hóa thời gian hết hạn Access Token từ TikTok Shop Open Platform.
     * TikTok Shop trả về `access_token_expire_in` là Unix Epoch Timestamp (giây từ 1970).
     * Hàm này tự động phát hiện Unix timestamp (Epoch seconds/millis) hoặc delta seconds,
     * đồng thời chặn tràn giá trị (Safety Clamp) để không vượt quá giới hạn CSDL (MySQL 2038).
     */
    private Instant tinhHanTokenTikTok(long rawExpire, long macDinhNgay) {
        Instant now = Instant.now();
        Instant fallback = now.plus(Duration.ofDays(macDinhNgay > 0 ? macDinhNgay : 7));

        if (rawExpire <= 0) {
            return fallback;
        }

        Instant calculated;
        try {
            if (rawExpire > 100_000_000_000L) {
                // Định dạng Unix Timestamp tính bằng mili-giây (>= 11 chữ số)
                calculated = Instant.ofEpochMilli(rawExpire);
            } else if (rawExpire > 1_000_000_000L) {
                // Định dạng Unix Timestamp tính bằng giây (>= 10 chữ số, từ năm 2001 trở đi)
                calculated = Instant.ofEpochSecond(rawExpire);
            } else {
                // Định dạng Delta seconds (số giây còn lại, ví dụ 604800s = 7 ngày)
                calculated = now.plusSeconds(rawExpire);
            }
        } catch (Exception e) {
            log.warn("Lỗi khi chuyển đổi access_token_expire_in TikTok ({}): {}", rawExpire, e.getMessage());
            return fallback;
        }

        // Chốt chặn an toàn (Safety Clamp):
        // Token TikTok access token chuẩn chỉ có hạn tối đa 7 ngày, không thể ở quá khứ hoặc vượt quá 60 ngày.
        if (calculated.isBefore(now) || calculated.isAfter(now.plus(Duration.ofDays(60)))) {
            log.warn("Thời gian hết hạn token TikTok bất thường ({}), tự động áp dụng thời hạn chuẩn {} ngày", calculated, macDinhNgay);
            return fallback;
        }

        return calculated;
    }

    @Override
    public String getDecryptedTikTokAccessToken() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
        if (kenh == null || kenh.getApiKey() == null || kenh.getApiKey().isBlank()) {
            return null;
        }
        try {
            return paymentSecretCipher.decrypt(kenh.getApiKey());
        } catch (Exception e) {
            log.error("Lỗi giải mã Access Token TikTok Shop: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public String getDecryptedTikTokAppSecret() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
        if (kenh == null || kenh.getApiSecret() == null || kenh.getApiSecret().isBlank()) {
            return null;
        }
        try {
            return paymentSecretCipher.decrypt(kenh.getApiSecret());
        } catch (Exception e) {
            log.error("Lỗi giải mã App Secret TikTok Shop: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public String getTikTokAppKey() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
        return kenh != null ? kenh.getClientId() : null;
    }

    @Override
    public String getTikTokShopCipher() {
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_TIKTOK).orElse(null);
        return ensureValidTikTokShopCipher(kenh);
    }

    /**
     * Tự động kiểm tra và phục hồi mã Shop Cipher thật của TikTok Shop.
     * Cơ chế tự lành (Self-Healing): Nếu cipher bị null hoặc bị ghi đè bởi tên shop (chuỗi ngắn không chứa mã hợp lệ),
     * hệ thống sẽ tự động gọi endpoint /authorization/202309/shops từ TikTok Open API để lấy và lưu lại cipher thật.
     */
    public String ensureValidTikTokShopCipher(KenhBanHang kenh) {
        if (kenh == null) return null;
        String cipher = kenh.getShopCipher();
        String apiUrl = kenh.getApiUrl();

        // Kiểm tra xem cipher có bị ghi đè bởi tên shop (vd: "f-centric") không:
        // Cipher thật của TikTok Shop là một mã hash đặc biệt (thường dài >= 20 ký tự hoặc có prefix theo chuẩn TikTok).
        // Nếu cipher trùng với apiUrl và ngắn (< 25 ký tự) hoặc chứa ký tự tên thông thường không phải hash:
        boolean nghiNgoBiGhiDe = cipher != null && apiUrl != null && cipher.equalsIgnoreCase(apiUrl.trim()) && cipher.length() < 25;
        if (cipher != null && !cipher.isBlank() && !nghiNgoBiGhiDe) {
            return cipher;
        }

        String appKey = kenh.getClientId();
        String appSecret = getDecryptedTikTokAppSecret();
        String token = getDecryptedTikTokAccessToken();
        if (appKey != null && !appKey.isBlank() && appSecret != null && !appSecret.isBlank() && token != null && !token.isBlank()) {
            try {
                log.info("[TIKTOK-AUTO-RECOVER] Tự động truy vấn TikTok Open API để phục hồi Shop Cipher...");
                TikTokAuthorizedShopsResponse shopsRes = getTikTokShopClient().getAuthorizedShops(appKey, appSecret, token);
                if (shopsRes.getShops() != null && !shopsRes.getShops().isEmpty()) {
                    TikTokShopDto firstShop = shopsRes.getShops().get(0);
                    String realCipher = firstShop.getCipher();
                    if (realCipher != null && !realCipher.isBlank()) {
                        kenh.setShopCipher(realCipher);
                        if (firstShop.getName() != null && !firstShop.getName().isBlank()) {
                            kenh.setApiUrl(firstShop.getName());
                        }
                        kenhBanHangRepository.save(kenh);
                        log.info("[TIKTOK-AUTO-RECOVER] Đã phục hồi thành công Shop Cipher TikTok: {} (Tên shop: {})",
                                maskToken(realCipher), kenh.getApiUrl());
                        return realCipher;
                    }
                }
            } catch (Exception ex) {
                log.warn("[TIKTOK-AUTO-RECOVER] Không thể tự động phục hồi Shop Cipher từ TikTok: {}", ex.getMessage());
            }
        }
        return cipher;
    }

    // ── Shopee Open Platform Implementation ──

    @Override
    public com.dev.backend.dto.response.entities.ShopeeConfigResponse getShopeeConfig() {
        return getShopeeConfig(MA_KENH_SHOPEE);
    }

    @Override
    @Transactional(readOnly = true)
    public com.dev.backend.dto.response.entities.ShopeeConfigResponse getShopeeConfig(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        boolean isSandbox = MA_KENH_SHOPEE_SANDBOX.equals(ma);
        String defaultTen = isSandbox ? "Shopee Sandbox (Môi trường Thử nghiệm)" : "Gian hàng Shopee";

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh == null) {
            return com.dev.backend.dto.response.entities.ShopeeConfigResponse.builder()
                    .maKenh(ma)
                    .tenKenh(defaultTen)
                    .loaiKenh("online")
                    .partnerId(null)
                    .shopId(null)
                    .hasPartnerKey(false)
                    .hasAccessToken(false)
                    .accessTokenMasked(null)
                    .hasRefreshToken(false)
                    .refreshTokenMasked(null)
                    .tokenExpiresAt(null)
                    .isTokenExpired(false)
                    .secondsUntilExpiration(null)
                    .trangThai(0)
                    .isSandbox(isSandbox)
                    .build();
        }

        boolean hasKey = kenh.getApiSecret() != null && !kenh.getApiSecret().isBlank();
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

        Long partnerId = null;
        try {
            if (kenh.getClientId() != null && !kenh.getClientId().isBlank()) {
                partnerId = Long.parseLong(kenh.getClientId().trim());
            }
        } catch (Exception ignored) {}

        Long shopId = null;
        try {
            if (kenh.getShopCipher() != null && kenh.getShopCipher().matches("^\\d+$")) {
                shopId = Long.parseLong(kenh.getShopCipher().trim());
            } else if (kenh.getShopDomain() != null && kenh.getShopDomain().matches("^\\d+$")) {
                shopId = Long.parseLong(kenh.getShopDomain().trim());
            }
        } catch (Exception ignored) {}

        return com.dev.backend.dto.response.entities.ShopeeConfigResponse.builder()
                .id(kenh.getId())
                .maKenh(kenh.getMaKenh())
                .tenKenh(kenh.getTenKenh())
                .loaiKenh(kenh.getLoaiKenh())
                .partnerId(partnerId)
                .shopId(shopId)
                .hasPartnerKey(hasKey)
                .hasAccessToken(hasToken)
                .accessTokenMasked(maskedToken)
                .hasRefreshToken(hasRefresh)
                .refreshTokenMasked(maskedRefresh)
                .tokenExpiresAt(kenh.getTokenExpiresAt())
                .isTokenExpired(isExpired)
                .secondsUntilExpiration(secondsUntilExpiration)
                .trangThai(kenh.getTrangThai() != null ? kenh.getTrangThai() : 0)
                .isSandbox(isSandbox || (kenh.getApiUrl() != null && kenh.getApiUrl().contains("test-stable")))
                .build();
    }

    @Override
    @Transactional
    public com.dev.backend.dto.response.entities.ShopeeConfigResponse updateShopeeConfig(com.dev.backend.dto.request.ShopeeConfigUpdating request) {
        return updateShopeeConfig(MA_KENH_SHOPEE, request);
    }

    @Override
    @Transactional
    public com.dev.backend.dto.response.entities.ShopeeConfigResponse updateShopeeConfig(String maKenh, com.dev.backend.dto.request.ShopeeConfigUpdating request) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        boolean isSandbox = MA_KENH_SHOPEE_SANDBOX.equals(ma) || Boolean.TRUE.equals(request.getIsSandbox());

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElseGet(() -> {
            KenhBanHang newKenh = new KenhBanHang();
            newKenh.setMaKenh(ma);
            newKenh.setTenKenh(isSandbox ? "Shopee Sandbox (Môi trường Thử nghiệm)" : "Gian hàng Shopee");
            newKenh.setLoaiKenh("online");
            newKenh.setTrangThai(0);
            return newKenh;
        });

        if (request.getPartnerId() != null) {
            kenh.setClientId(String.valueOf(request.getPartnerId()));
        }
        if (request.getPartnerKey() != null && !request.getPartnerKey().isBlank()) {
            kenh.setApiSecret(paymentSecretCipher.encrypt(request.getPartnerKey().trim()));
        }
        if (request.getShopId() != null && !request.getShopId().isBlank() && request.getShopId().matches("^\\d+$")) {
            kenh.setShopCipher(request.getShopId().trim());
            kenh.setShopDomain(request.getShopId().trim());
        }
        if (request.getAccessToken() != null && !request.getAccessToken().isBlank()) {
            kenh.setApiKey(paymentSecretCipher.encrypt(request.getAccessToken().trim()));
        }
        if (request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            kenh.setRefreshToken(paymentSecretCipher.encrypt(request.getRefreshToken().trim()));
        }
        if (request.getTrangThai() != null) {
            kenh.setTrangThai(request.getTrangThai());
        }

        String apiUrl = isSandbox ? "https://openplatform.sandbox.test-stable.shopee.sg" : "https://partner.shopeemobile.com";
        kenh.setApiUrl(apiUrl);

        kenhBanHangRepository.save(kenh);
        log.info("Cập nhật cấu hình kênh Shopee thành công: maKenh={}", ma);
        return getShopeeConfig(ma);
    }

    @Override
    public boolean testShopeeConnection(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        Long partnerId = getShopeePartnerId(ma);
        String partnerKey = getDecryptedShopeePartnerKey(ma);
        String accessToken = getDecryptedShopeeAccessToken(ma);
        Long shopId = getShopeeShopId(ma);

        com.dev.backend.services.shopee.ShopeeClient client = new com.dev.backend.services.shopee.ShopeeClient(
                partnerId != null ? partnerId : 0L,
                partnerKey != null ? partnerKey : "",
                shopId != null ? shopId : 0L,
                accessToken != null ? accessToken : "",
                MA_KENH_SHOPEE_SANDBOX.equals(ma)
        );
        try {
            com.fasterxml.jackson.databind.JsonNode res = client.getShopInfo();
            return res != null && res.path("error").asText("").isEmpty();
        } catch (Exception e) {
            log.error("Test Shopee connection failed: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public String getShopeeAuthUrl(String redirectUri) {
        return getShopeeAuthUrl(MA_KENH_SHOPEE, redirectUri);
    }

    @Override
    public String getShopeeAuthUrl(String maKenh, String redirectUri) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        Long partnerId = getShopeePartnerId(ma);
        String partnerKey = getDecryptedShopeePartnerKey(ma);

        com.dev.backend.services.shopee.ShopeeClient client = new com.dev.backend.services.shopee.ShopeeClient(
                partnerId != null ? partnerId : 0L,
                partnerKey != null ? partnerKey : "",
                0L,
                "",
                MA_KENH_SHOPEE_SANDBOX.equals(ma)
        );
        return client.generateAuthUrl(redirectUri);
    }

    @Override
    @Transactional
    public com.dev.backend.dto.response.entities.ShopeeConfigResponse exchangeShopeeToken(String maKenh, String code, String shopIdStr) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        Long partnerId = getShopeePartnerId(ma);
        String partnerKey = getDecryptedShopeePartnerKey(ma);
        Long shopId = null;
        try {
            if (shopIdStr != null && !shopIdStr.isBlank()) {
                shopId = Long.parseLong(shopIdStr.trim());
            }
        } catch (Exception ignored) {}

        com.dev.backend.services.shopee.ShopeeClient client = new com.dev.backend.services.shopee.ShopeeClient(
                partnerId != null ? partnerId : 0L,
                partnerKey != null ? partnerKey : "",
                shopId != null ? shopId : 0L,
                "",
                MA_KENH_SHOPEE_SANDBOX.equals(ma)
        );

        com.fasterxml.jackson.databind.JsonNode tokenRes = client.getAccessToken(code, shopId != null ? shopId : 0L);
        if (tokenRes == null || !tokenRes.path("error").asText("").isEmpty()) {
            String err = tokenRes != null ? tokenRes.path("message").asText(null) : null;
            throw err != null ? new CommonException(err, HttpStatus.BAD_REQUEST, null)
                    : new CommonException(tokenRes != null ? ThongDiep.of("kenhBan.loiDoiTokenShopee")
                            : ThongDiep.of("kenhBan.khongNhanDuocPhanHoi"), HttpStatus.BAD_REQUEST, null);
        }

        String accessToken = tokenRes.path("access_token").asText();
        String refreshToken = tokenRes.path("refresh_token").asText();
        long expireIn = tokenRes.path("expire_in").asLong(14400);

        // Trích xuất shop_id từ phản hồi sàn nếu query params chưa truyền
        if (shopId == null || shopId == 0) {
            if (tokenRes.hasNonNull("shop_id") && tokenRes.path("shop_id").asLong(0) > 0) {
                shopId = tokenRes.path("shop_id").asLong();
            } else if (tokenRes.has("shop_id_list") && tokenRes.path("shop_id_list").isArray() && !tokenRes.path("shop_id_list").isEmpty()) {
                shopId = tokenRes.path("shop_id_list").get(0).asLong(0);
            } else {
                try {
                    com.fasterxml.jackson.databind.JsonNode shopsRes = client.getShopsByPartner(1, 50);
                    if (shopsRes != null && shopsRes.path("error").asText("").isEmpty()) {
                        com.fasterxml.jackson.databind.JsonNode sList = shopsRes.path("authed_shop_list");
                        if (sList.isArray() && !sList.isEmpty()) {
                            shopId = sList.get(0).path("shop_id").asLong(0);
                        }
                    }
                } catch (Exception ignored) {}
            }
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElseThrow(
                () -> new CommonException(ThongDiep.of("kenhBan.khongTimThayKenh", ma), HttpStatus.NOT_FOUND, null)
        );

        kenh.setApiKey(paymentSecretCipher.encrypt(accessToken));
        kenh.setRefreshToken(paymentSecretCipher.encrypt(refreshToken));
        kenh.setTokenExpiresAt(Instant.now().plusSeconds(expireIn));
        if (shopId != null && shopId > 0) {
            kenh.setShopCipher(String.valueOf(shopId));
            kenh.setShopDomain(String.valueOf(shopId));
            try {
                com.dev.backend.services.shopee.ShopeeClient authedClient = new com.dev.backend.services.shopee.ShopeeClient(
                        partnerId != null ? partnerId : 0L,
                        partnerKey != null ? partnerKey : "",
                        shopId,
                        accessToken,
                        MA_KENH_SHOPEE_SANDBOX.equals(ma)
                );
                com.fasterxml.jackson.databind.JsonNode shopInfo = authedClient.getShopInfo();
                if (shopInfo != null && shopInfo.hasNonNull("shop_name")) {
                    String realShopName = shopInfo.path("shop_name").asText("").trim();
                    if (!realShopName.isBlank()) {
                        kenh.setTenKenh(realShopName);
                    }
                }
            } catch (Exception ignored) {}
        }
        kenh.setTrangThai(1);
        kenhBanHangRepository.save(kenh);

        return getShopeeConfig(ma);
    }

    @Override
    @Transactional
    public boolean refreshShopeeAccessToken(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        Long partnerId = getShopeePartnerId(ma);
        String partnerKey = getDecryptedShopeePartnerKey(ma);
        Long shopId = getShopeeShopId(ma);

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh == null || kenh.getRefreshToken() == null || kenh.getRefreshToken().isBlank()) {
            return false;
        }

        String refreshToken = paymentSecretCipher.decrypt(kenh.getRefreshToken());
        com.dev.backend.services.shopee.ShopeeClient client = new com.dev.backend.services.shopee.ShopeeClient(
                partnerId != null ? partnerId : 0L,
                partnerKey != null ? partnerKey : "",
                shopId != null ? shopId : 0L,
                "",
                MA_KENH_SHOPEE_SANDBOX.equals(ma)
        );

        com.fasterxml.jackson.databind.JsonNode res = client.refreshAccessToken(refreshToken, shopId != null ? shopId : 0L);
        if (res != null && res.path("error").asText("").isEmpty()) {
            String newAccess = res.path("access_token").asText();
            String newRefresh = res.path("refresh_token").asText();
            long expireIn = res.path("expire_in").asLong(14400);

            kenh.setApiKey(paymentSecretCipher.encrypt(newAccess));
            kenh.setRefreshToken(paymentSecretCipher.encrypt(newRefresh));
            kenh.setTokenExpiresAt(Instant.now().plusSeconds(expireIn));
            kenhBanHangRepository.save(kenh);
            return true;
        }
        return false;
    }

    @Override
    @Transactional
    public void xoaKhoaShopee(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh != null) {
            kenh.setApiKey(null);
            kenh.setRefreshToken(null);
            kenh.setTokenExpiresAt(null);
            kenh.setShopCipher(null);
            kenh.setTrangThai(0);
            kenhBanHangRepository.save(kenh);

            // Làm sạch mã sản phẩm trên sàn cũ, bảo toàn 100% đơn hàng
            if (kenh.getId() != null) {
                trangThaiDongBoSanPhamRepository.xoaDuLieuCuaHangCu(kenh.getId());
                trangThaiDongBoSanPhamRepository.danhDauChuaGhep(kenh.getId(), "Gian hàng đã ngắt kết nối. Vui lòng kết nối lại để tiếp tục đồng bộ.");
            }

            log.info("Đã xóa khóa, làm sạch mã SKU sàn cũ và ngắt kết nối kênh Shopee: {}", ma);
            ghiLichSuThayDoi(kenh, "Ngắt kết nối gian hàng Shopee (xóa Access Token, làm sạch mã SKU sàn cũ, bảo toàn đơn hàng)");
            if (thongBaoHeThongService != null) thongBaoHeThongService.kenhDaNgat(ma);
        }
    }

    @Override
    public Long getShopeePartnerId(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh != null && kenh.getClientId() != null && !kenh.getClientId().isBlank()) {
            try {
                return Long.parseLong(kenh.getClientId().trim());
            } catch (Exception ignored) {}
        }
        return null;
    }

    @Override
    public String getDecryptedShopeePartnerKey(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh == null || kenh.getApiSecret() == null || kenh.getApiSecret().isBlank()) {
            return null;
        }
        try {
            return paymentSecretCipher.decrypt(kenh.getApiSecret());
        } catch (Exception e) {
            log.error("Lỗi giải mã Partner Key Shopee: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public String getDecryptedShopeeAccessToken(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh == null || kenh.getApiKey() == null || kenh.getApiKey().isBlank()) {
            return null;
        }
        try {
            return paymentSecretCipher.decrypt(kenh.getApiKey());
        } catch (Exception e) {
            log.error("Lỗi giải mã Access Token Shopee: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public Long getShopeeShopId(String maKenh) {
        String ma = (maKenh != null && !maKenh.isBlank()) ? maKenh.trim().toUpperCase() : MA_KENH_SHOPEE;
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma).orElse(null);
        if (kenh == null) {
            return null;
        }
        // 1. Kiểm tra shopCipher (nơi lưu shop_id định danh số của Shopee)
        if (kenh.getShopCipher() != null && kenh.getShopCipher().matches("^\\d+$")) {
            try {
                return Long.parseLong(kenh.getShopCipher().trim());
            } catch (Exception ignored) {}
        }
        // 2. Kiểm tra shopDomain (nếu là số)
        if (kenh.getShopDomain() != null && kenh.getShopDomain().matches("^\\d+$")) {
            try {
                return Long.parseLong(kenh.getShopDomain().trim());
            } catch (Exception ignored) {}
        }
        // TUYỆT ĐỐI KHÔNG fallback về clientId (partner_id) vì partner_id không phải là shop_id của người bán!
        return null;
    }

}
