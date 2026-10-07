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
import java.util.concurrent.ThreadLocalRandom;
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
    private final String backendPublicUrl;

    public PaymentConfigService(CauHinhThanhToanRepository repository, PaymentSecretCipher cipher,
                                PayosClient payosClient,
                                @Value("${app.backend-public-url:}") String backendPublicUrl) {
        this.repository = repository;
        this.cipher = cipher;
        this.payosClient = payosClient;
        this.backendPublicUrl = backendPublicUrl == null ? "" : backendPublicUrl.trim();
    }

    @Transactional(readOnly = true)
    public PayosConfigDto getPayos() {
        return toDto(load());
    }

    @Transactional
    public PayosConfigDto updatePayos(PayosConfigUpdating req) {
        CauHinhThanhToan cfg = load();
        if (notBlank(req.getClientId())) {
            String v = req.getClientId().trim();
            if (!UUID.matcher(v).matches()) throw new CommonException("Client ID không đúng định dạng (dạng xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)");
            cfg.setClientIdMaHoa(cipher.encrypt(v));
        }
        if (notBlank(req.getApiKey())) {
            String v = req.getApiKey().trim();
            if (!UUID.matcher(v).matches()) throw new CommonException("API Key không đúng định dạng (dạng xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)");
            cfg.setApiKeyMaHoa(cipher.encrypt(v));
        }
        if (notBlank(req.getChecksumKey())) {
            String v = req.getChecksumKey().trim();
            if (!HEX64.matcher(v).matches()) throw new CommonException("Checksum Key phải gồm 64 ký tự 0-9, a-f");
            cfg.setChecksumKeyMaHoa(cipher.encrypt(v));
        }
        if (req.getThoiGianHetHanPhut() != null) {
            int m = req.getThoiGianHetHanPhut();
            if (m < 3 || m > 60) throw new CommonException("Thời gian hết hạn mã QR phải từ 3 đến 60 phút");
            cfg.setThoiGianHetHanPhut(m);
        }
        if (req.getWebhookUrl() != null) {
            String url = req.getWebhookUrl().trim();
            if (!url.isEmpty() && !url.startsWith("https://")) {
                throw new CommonException("Webhook URL phải bắt đầu bằng https://");
            }
            if (!url.equals(cfg.getWebhookUrl() == null ? "" : cfg.getWebhookUrl())) {
                cfg.setWebhookXacNhanLuc(null);
            }
            cfg.setWebhookUrl(url.isEmpty() ? null : url);
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

    /** Gọi thử payOS bằng khóa đang lưu: tra một mã đơn ngẫu nhiên (không tạo giao dịch nào). */
    @Transactional(readOnly = true)
    public PayosTestResult testConnection() {
        PayosCredentials cred = credentials(load());
        long probe = 9_000_000_000L + ThreadLocalRandom.current().nextLong(1_000_000_000L);
        PayosClient.PayosResult r = payosClient.getPaymentLink(cred, probe);
        boolean authFailed = r.httpStatus() == 401 || r.httpStatus() == 403;
        boolean ok = !authFailed && r.httpStatus() < 500 && r.code() != null;
        String msg = ok
                ? "Kết nối payOS thành công (payOS phản hồi: " + r.code() + (r.desc() == null ? "" : " - " + r.desc()) + ")"
                : "payOS từ chối khóa hoặc không phản hồi hợp lệ (HTTP " + r.httpStatus()
                  + (r.desc() == null ? "" : ", " + r.desc()) + "). Kiểm tra lại Client ID và API Key.";
        return PayosTestResult.builder().ok(ok).code(r.code()).message(msg).build();
    }

    /** Đăng ký webhook URL với payOS. payOS sẽ gửi thử một webhook mẫu tới URL này. */
    @Transactional
    public PayosConfigDto confirmWebhook(String webhookUrl) {
        CauHinhThanhToan cfg = load();
        String url = webhookUrl == null || webhookUrl.isBlank() ? cfg.getWebhookUrl() : webhookUrl.trim();
        if (url == null || !url.startsWith("https://")) {
            throw new CommonException("Webhook URL phải là địa chỉ công khai bắt đầu bằng https:// (máy dev dùng ngrok/cloudflared)");
        }
        PayosClient.PayosResult r = payosClient.confirmWebhook(credentials(cfg), url);
        if (!r.ok()) {
            throw new CommonException("payOS chưa xác nhận webhook: " + (r.desc() == null ? "HTTP " + r.httpStatus() : r.desc())
                    + ". Hãy chắc chắn backend đang chạy và URL truy cập được từ Internet.",
                    HttpStatus.BAD_GATEWAY, null);
        }
        cfg.setWebhookUrl(url);
        cfg.setWebhookXacNhanLuc(Instant.now());
        cfg.setNgayCapNhat(Instant.now());
        return toDto(repository.save(cfg));
    }

    /** Khóa payOS đang bật để POS dùng. Ném lỗi rõ ràng nếu chưa bật/chưa đủ khóa. */
    @Transactional(readOnly = true)
    public ActivePayos activePayos() {
        CauHinhThanhToan cfg = load();
        if (!Boolean.TRUE.equals(cfg.getKichHoat())) {
            throw new CommonException("Thanh toán chuyển khoản payOS đang tắt. Bật ở Cài đặt → Thanh toán.",
                    HttpStatus.SERVICE_UNAVAILABLE, null);
        }
        return new ActivePayos(credentials(cfg), cfg.getThoiGianHetHanPhut() == null ? 15 : cfg.getThoiGianHetHanPhut());
    }

    /** Khóa checksum để kiểm webhook — dùng được cả khi payOS đang tắt (giao dịch cũ vẫn phải xác nhận được). */
    @Transactional(readOnly = true)
    public String checksumKeyOrNull() {
        CauHinhThanhToan cfg = repository.findByNhaCungCap(CauHinhThanhToan.NCC_PAYOS).orElse(null);
        if (cfg == null || cfg.getChecksumKeyMaHoa() == null || !cipher.isConfigured()) return null;
        return cipher.decrypt(cfg.getChecksumKeyMaHoa());
    }

    @Transactional(readOnly = true)
    public PayosCredentials credentialsForBackgroundJob() {
        CauHinhThanhToan cfg = repository.findByNhaCungCap(CauHinhThanhToan.NCC_PAYOS).orElse(null);
        if (cfg == null || !isComplete(cfg) || !cipher.isConfigured()) return null;
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
                        : (backendPublicUrl.endsWith("/") ? backendPublicUrl.substring(0, backendPublicUrl.length() - 1) : backendPublicUrl) + WEBHOOK_PATH)
                .webhookXacNhanLuc(cfg.getWebhookXacNhanLuc())
                .ngayCapNhat(cfg.getNgayCapNhat())
                .build();
    }

    /** "ed71••••••••0ec63" — đủ để nhận ra khóa nào đang lưu, không đủ để dùng. */
    private String masked(String encrypted) {
        if (encrypted == null) return null;
        try {
            String plain = cipher.decrypt(encrypted);
            if (plain == null || plain.length() < 10) return "••••••••";
            return plain.substring(0, 4) + "••••••••" + plain.substring(plain.length() - 4);
        } catch (CommonException e) {
            return "(không giải mã được — nhập lại)";
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
