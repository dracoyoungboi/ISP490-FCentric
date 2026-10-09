package com.dev.backend.services.impl.payos;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.PayosConfigUpdating;
import com.dev.backend.dto.response.customize.PayosConfigDto;
import com.dev.backend.dto.response.customize.PayosTestResult;
import com.dev.backend.entities.CauHinhThanhToan;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.CauHinhThanhToanRepository;
import com.dev.backend.utils.PaymentSecretCipher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.regex.Pattern;

/** Đọc / ghi cấu hình payOS. Chỉ service này được giải mã khóa. */
@Service
public class PaymentConfigService {

    public static final String WEBHOOK_PATH = "/api/v1/payos/webhook";
    private static final Pattern UUID = Pattern.compile("^[0-9a-fA-F-]{36}$");
    private static final Pattern HEX64 = Pattern.compile("^[0-9a-fA-F]{64}$");

    private final CauHinhThanhToanRepository repository;
    private final PaymentSecretCipher cipher;
    private final PayosClient payosClient;
    private final PayosCredentialVerifier verifier;
    private final String backendPublicUrl;

    public PaymentConfigService(CauHinhThanhToanRepository repository, PaymentSecretCipher cipher,
            PayosClient payosClient, PayosCredentialVerifier verifier,
            @Value("${app.backend-public-url:}") String backendPublicUrl) {
        this.repository = repository;
        this.cipher = cipher;
        this.payosClient = payosClient;
        this.verifier = verifier;
        this.backendPublicUrl = backendPublicUrl == null ? "" : backendPublicUrl.trim();
    }

    @Transactional(readOnly = true)
    public PayosConfigDto getPayos() {
        return toDto(load());
    }

    /**
     * Lưu cấu hình. Nếu có khóa mới: kiểm định dạng → ghép với khóa đang lưu → xác minh
     * thật với payOS → đạt mới lưu. Khóa sai không bao giờ được ghi vào DB.
     * Thứ tự cố ý: mọi kiểm tra không cần mạng chạy trước, để không tạo link payOS vô ích.
     */
    @Transactional
    public PayosConfigDto updatePayos(PayosConfigUpdating req) {
        CauHinhThanhToan cfg = load();

        // 1. Kiểm tra đầu vào (không gọi mạng, chưa sửa entity)
        String newClientId = uuidOrNull(req.getClientId(), "Client ID");
        String newApiKey = uuidOrNull(req.getApiKey(), "API Key");
        String newChecksum = checksumOrNull(req.getChecksumKey());
        if (req.getThoiGianHetHanPhut() != null) {
            int m = req.getThoiGianHetHanPhut();
            if (m < 3 || m > 60)
                throw new CommonException("Thời gian hết hạn mã QR phải từ 3 đến 60 phút");
        }
        String newWebhookUrl = req.getWebhookUrl() == null ? null : req.getWebhookUrl().trim();
        if (newWebhookUrl != null && !newWebhookUrl.isEmpty() && !newWebhookUrl.startsWith("https://")) {
            throw new CommonException("Webhook URL phải bắt đầu bằng https://");
        }
        boolean keysChanged = newClientId != null || newApiKey != null || newChecksum != null;

        // 2. Xác minh bộ khóa sau khi ghép với khóa đang lưu
        if (keysChanged) {
            if (!cipher.isConfigured()) {
                throw new CommonException(
                        "Máy chủ chưa đặt biến môi trường PAYMENT_CONFIG_SECRET nên không thể lưu khóa thanh toán",
                        HttpStatus.SERVICE_UNAVAILABLE, null);
            }
            String oldClientId = decryptOrNull(cfg.getClientIdMaHoa());
            PayosCredentials candidate = new PayosCredentials(
                    newClientId != null ? newClientId : oldClientId,
                    newApiKey != null ? newApiKey : decryptOrNull(cfg.getApiKeyMaHoa()),
                    newChecksum != null ? newChecksum : decryptOrNull(cfg.getChecksumKeyMaHoa()));
            if (candidate.clientId() == null || candidate.apiKey() == null || candidate.checksumKey() == null) {
                throw new CommonException("Cần nhập đủ Client ID, API Key và Checksum Key");
            }
            PayosCredentialVerifier.Result check = verifier.verify(candidate);
            if (!check.ok()) {
                throw new CommonException(check.message(),
                        check.unreachable() ? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_REQUEST, null);
            }
            // Webhook được xác nhận cho kênh cũ -> đổi kênh thì phải đăng ký lại
            if (newClientId != null && !newClientId.equals(oldClientId)) {
                cfg.setWebhookXacNhanLuc(null);
            }
            if (newClientId != null) cfg.setClientIdMaHoa(cipher.encrypt(newClientId));
            if (newApiKey != null) cfg.setApiKeyMaHoa(cipher.encrypt(newApiKey));
            if (newChecksum != null) cfg.setChecksumKeyMaHoa(cipher.encrypt(newChecksum));
        }

        // 3. Các thiết lập còn lại
        if (req.getThoiGianHetHanPhut() != null) {
            cfg.setThoiGianHetHanPhut(req.getThoiGianHetHanPhut());
        }
        if (newWebhookUrl != null) {
            if (!newWebhookUrl.equals(cfg.getWebhookUrl() == null ? "" : cfg.getWebhookUrl())) {
                cfg.setWebhookXacNhanLuc(null);
            }
            cfg.setWebhookUrl(newWebhookUrl.isEmpty() ? null : newWebhookUrl);
        }
        if (req.getKichHoat() != null) {
            if (req.getKichHoat() && !isComplete(cfg)) {
                throw new CommonException("Cần nhập đủ Client ID, API Key và Checksum Key trước khi bật payOS");
            }
            cfg.setKichHoat(req.getKichHoat());
        }
        cfg.setNguoiCapNhatId(SecurityContextHolder.getUser() == null ? null : SecurityContextHolder.getUser().getId());
        cfg.setNgayCapNhat(Instant.now());
        return toDto(repository.save(cfg));
    }

    /**
     * Kiểm tra lại bộ khóa đang lưu với payOS (tạo link 2.000đ rồi huỷ ngay — xem
     * {@link PayosCredentialVerifier}). Dùng khi muốn chắc khóa vẫn còn hiệu lực.
     */
    @Transactional(readOnly = true)
    public PayosTestResult testConnection() {
        PayosCredentials cred = credentials(load());
        PayosCredentialVerifier.Result r = verifier.verify(cred);
        return PayosTestResult.builder().ok(r.ok()).code(r.code()).message(r.message()).build();
    }

    /**
     * Đăng ký webhook URL với payOS. payOS sẽ gửi thử một webhook mẫu tới URL này.
     */
    @Transactional
    public PayosConfigDto confirmWebhook(String webhookUrl) {
        CauHinhThanhToan cfg = load();
        String url = webhookUrl == null || webhookUrl.isBlank() ? cfg.getWebhookUrl() : webhookUrl.trim();
        if (url == null || !url.startsWith("https://")) {
            throw new CommonException(
                    "Webhook URL phải là địa chỉ công khai bắt đầu bằng https:// (máy dev dùng ngrok/cloudflared)");
        }
        PayosClient.PayosResult r = payosClient.confirmWebhook(credentials(cfg), url);
        if (!r.ok()) {
            throw new CommonException(
                    "payOS chưa xác nhận webhook: " + (r.desc() == null ? "HTTP " + r.httpStatus() : r.desc())
                            + ". Hãy chắc chắn backend đang chạy và URL truy cập được từ Internet.",
                    HttpStatus.BAD_GATEWAY, null);
        }
        cfg.setWebhookUrl(url);
        cfg.setWebhookXacNhanLuc(Instant.now());
        cfg.setNgayCapNhat(Instant.now());
        return toDto(repository.save(cfg));
    }

    /**
     * Khóa payOS đang bật để POS dùng. Ném lỗi rõ ràng nếu chưa bật/chưa đủ khóa.
     */
    @Transactional(readOnly = true)
    public ActivePayos activePayos() {
        CauHinhThanhToan cfg = load();
        if (!Boolean.TRUE.equals(cfg.getKichHoat())) {
            throw new CommonException("Thanh toán chuyển khoản payOS đang tắt. Bật ở Cài đặt → Thanh toán.",
                    HttpStatus.SERVICE_UNAVAILABLE, null);
        }
        return new ActivePayos(credentials(cfg),
                cfg.getThoiGianHetHanPhut() == null ? 15 : cfg.getThoiGianHetHanPhut());
    }

    /**
     * Khóa checksum để kiểm webhook — dùng được cả khi payOS đang tắt (giao dịch cũ
     * vẫn phải xác nhận được).
     */
    @Transactional(readOnly = true)
    public String checksumKeyOrNull() {
        CauHinhThanhToan cfg = repository.findByNhaCungCap(CauHinhThanhToan.NCC_PAYOS).orElse(null);
        if (cfg == null || cfg.getChecksumKeyMaHoa() == null || !cipher.isConfigured())
            return null;
        return cipher.decrypt(cfg.getChecksumKeyMaHoa());
    }

    @Transactional(readOnly = true)
    public PayosCredentials credentialsForBackgroundJob() {
        CauHinhThanhToan cfg = repository.findByNhaCungCap(CauHinhThanhToan.NCC_PAYOS).orElse(null);
        if (cfg == null || !isComplete(cfg) || !cipher.isConfigured())
            return null;
        return credentials(cfg);
    }

    @Transactional(readOnly = true)
    public boolean isPayosEnabled() {
        return repository.findByNhaCungCap(CauHinhThanhToan.NCC_PAYOS)
                .map(c -> Boolean.TRUE.equals(c.getKichHoat()) && isComplete(c))
                .orElse(false);
    }

    public record ActivePayos(PayosCredentials credentials, int expiryMinutes) {
    }

    // ================= helpers =================

    private CauHinhThanhToan load() {
        return repository.findByNhaCungCap(CauHinhThanhToan.NCC_PAYOS)
                .orElseGet(() -> repository.save(CauHinhThanhToan.builder()
                        .nhaCungCap(CauHinhThanhToan.NCC_PAYOS)
                        .kichHoat(false)
                        .thoiGianHetHanPhut(15)
                        .ngayCapNhat(Instant.now())
                        .build()));
    }

    private PayosCredentials credentials(CauHinhThanhToan cfg) {
        if (!isComplete(cfg)) {
            throw new CommonException("Chưa nhập đủ Client ID, API Key và Checksum Key của payOS");
        }
        return new PayosCredentials(
                cipher.decrypt(cfg.getClientIdMaHoa()),
                cipher.decrypt(cfg.getApiKeyMaHoa()),
                cipher.decrypt(cfg.getChecksumKeyMaHoa()));
    }

    private boolean isComplete(CauHinhThanhToan cfg) {
        return cfg.getClientIdMaHoa() != null && cfg.getApiKeyMaHoa() != null && cfg.getChecksumKeyMaHoa() != null;
    }

    private PayosConfigDto toDto(CauHinhThanhToan cfg) {
        return PayosConfigDto.builder()
                .kichHoat(Boolean.TRUE.equals(cfg.getKichHoat()))
                .daCauHinhDu(isComplete(cfg))
                .mayChuCoKhoaMaHoa(cipher.isConfigured())
                .clientIdMasked(masked(cfg.getClientIdMaHoa()))
                .apiKeyMasked(masked(cfg.getApiKeyMaHoa()))
                .checksumKeyMasked(masked(cfg.getChecksumKeyMaHoa()))
                .thoiGianHetHanPhut(cfg.getThoiGianHetHanPhut())
                .webhookUrl(cfg.getWebhookUrl())
                .webhookUrlGoiY(backendPublicUrl.isEmpty() ? null
                        : (backendPublicUrl.endsWith("/") ? backendPublicUrl.substring(0, backendPublicUrl.length() - 1)
                                : backendPublicUrl) + WEBHOOK_PATH)
                .webhookXacNhanLuc(cfg.getWebhookXacNhanLuc())
                .ngayCapNhat(cfg.getNgayCapNhat())
                .build();
    }

    /** "ed71••••••••0ec63" — đủ để nhận ra khóa nào đang lưu, không đủ để dùng. */
    private String masked(String encrypted) {
        if (encrypted == null)
            return null;
        try {
            String plain = cipher.decrypt(encrypted);
            if (plain == null || plain.length() < 10)
                return "••••••••";
            return plain.substring(0, 4) + "••••••••" + plain.substring(plain.length() - 4);
        } catch (CommonException e) {
            return "(không giải mã được — nhập lại)";
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    /** null/"" = giữ khóa đang lưu; có giá trị thì phải đúng dạng UUID. */
    private static String uuidOrNull(String raw, String label) {
        if (!notBlank(raw)) return null;
        String v = raw.trim();
        if (!UUID.matcher(v).matches())
            throw new CommonException(label + " không đúng định dạng (dạng xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)");
        return v;
    }

    private static String checksumOrNull(String raw) {
        if (!notBlank(raw)) return null;
        String v = raw.trim();
        if (!HEX64.matcher(v).matches())
            throw new CommonException("Checksum Key phải gồm 64 ký tự 0-9, a-f");
        return v;
    }

    /** Khóa đang lưu, hoặc null nếu chưa có / không giải mã được (khi đó buộc nhập lại đủ). */
    private String decryptOrNull(String encrypted) {
        if (encrypted == null) return null;
        try {
            return cipher.decrypt(encrypted);
        } catch (RuntimeException e) {
            return null;
        }
    }
}
