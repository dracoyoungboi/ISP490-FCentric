package com.dev.backend.services.impl.payos;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.utils.PayosSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Xác minh một bộ khóa payOS bằng cách gọi đúng API mà POS dùng: tạo link thanh toán
 * 2.000đ (hết hạn sau 2 phút) rồi huỷ ngay. Không có tiền nào được chuyển.
 *
 * <p>Đạt khi và chỉ khi: HTTP 2xx, {@code code == "00"}, có {@code data}, và chữ ký
 * response (nếu payOS gửi) khớp Checksum Key. Cách này kiểm đủ cả 3 khóa:
 * Client ID + API Key qua header, Checksum Key qua chữ ký của request lẫn response.
 */
@Component
public class PayosCredentialVerifier {

    private static final Logger log = LoggerFactory.getLogger(PayosCredentialVerifier.class);

    static final long TEST_AMOUNT = 2_000L;
    /** ≤ 9 ký tự: giới hạn nội dung chuyển khoản của payOS cho tài khoản chưa liên kết. */
    static final String TEST_DESCRIPTION = "KTKN";
    static final long LINK_TTL_SECONDS = 120L;
    /**
     * Dải orderCode riêng cho link kiểm tra: [9·10^12, 10^13). Mã đơn POS hiện ở mức
     * ~1,8·10^12 (giây × 1000), nên không trùng; vẫn &lt; 2^53 để JS đọc an toàn.
     */
    static final long TEST_ORDER_CODE_BASE = 9_000_000_000_000L;
    private static final String ITEM_NAME = "Kiem tra ket noi FCentric";
    private static final String SETTINGS_PATH = "/settings/payment";

    private final PayosClient payosClient;
    private final String settingsUrl;
    private final AtomicLong lastOrderCode = new AtomicLong();

    public PayosCredentialVerifier(PayosClient payosClient,
                                   @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.payosClient = payosClient;
        String base = frontendUrl == null ? "" : frontendUrl.trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        this.settingsUrl = base + SETTINGS_PATH;
    }

    /**
     * @param ok          bộ khóa dùng được
     * @param unreachable không gọi được payOS (lỗi mạng) — khác với "khóa sai"
     * @param code        mã payOS trả về (có thể null)
     * @param message     thông điệp tiếng Việt cho quản trị viên
     */
    public record Result(boolean ok, boolean unreachable, String code, String message) {
    }

    public Result verify(PayosCredentials cred) {
        long orderCode = nextOrderCode();
        long expiredAt = Instant.now().getEpochSecond() + LINK_TTL_SECONDS;

        PayosClient.PayosResult r;
        try {
            r = payosClient.createPaymentLink(cred, orderCode, TEST_AMOUNT, TEST_DESCRIPTION,
                    settingsUrl, settingsUrl, expiredAt,
                    List.of(new PayosClient.Item(ITEM_NAME, 1, TEST_AMOUNT)));
        } catch (CommonException e) {
            return new Result(false, true, null,
                    "Không kết nối được tới payOS nên chưa kiểm tra được khóa. Kiểm tra mạng của máy chủ rồi thử lại.");
        }
        if (r == null) {
            return new Result(false, false, null, "payOS không trả về kết quả. Vui lòng thử lại.");
        }

        if (r.httpStatus() == 401 || r.httpStatus() == 403) {
            return new Result(false, false, r.code(),
                    "payOS từ chối Client ID hoặc API Key (HTTP " + r.httpStatus() + "). Kiểm tra lại hai khóa này.");
        }
        if (r.httpStatus() >= 500) {
            return new Result(false, false, r.code(),
                    "payOS đang gặp sự cố (HTTP " + r.httpStatus() + "). Vui lòng thử lại sau.");
        }
        if (!r.ok()) {
            String reason = r.desc() == null || r.desc().isBlank() ? "phản hồi không hợp lệ" : r.desc();
            return new Result(false, false, r.code(),
                    "payOS từ chối bộ khóa: " + reason
                            + (r.code() == null ? " (HTTP " + r.httpStatus() + ")" : " (mã " + r.code() + ")")
                            + ". Kiểm tra lại Client ID, API Key và Checksum Key.");
        }

        // Từ đây link đã được tạo trên payOS -> luôn huỷ, dù kết quả thế nào.
        try {
            if (r.data() == null || r.data().isNull()) {
                return new Result(false, false, r.code(),
                        "payOS báo thành công nhưng không trả dữ liệu link. Vui lòng thử lại.");
            }
            if (r.signature() != null && !r.signature().isBlank()
                    && !PayosSignature.verifyData(r.data(), r.signature(), cred.checksumKey())) {
                return new Result(false, false, r.code(),
                        "Checksum Key không khớp: chữ ký payOS trả về không đúng với Checksum Key đã nhập.");
            }
            return new Result(true, false, r.code(),
                    "Kết nối payOS thành công. Đã xác minh Client ID, API Key và Checksum Key.");
        } finally {
            cancelQuietly(cred, orderCode);
        }
    }

    private void cancelQuietly(PayosCredentials cred, long orderCode) {
        try {
            PayosClient.PayosResult c = payosClient.cancelPaymentLink(cred, orderCode, "Kiem tra ket noi");
            if (c != null && !c.ok()) {
                log.warn("Chưa huỷ được link kiểm tra payOS {} (sẽ tự hết hạn sau {}s): {}",
                        orderCode, LINK_TTL_SECONDS, c.desc());
            }
        } catch (RuntimeException e) {
            log.warn("Chưa huỷ được link kiểm tra payOS {} (sẽ tự hết hạn sau {}s): {}",
                    orderCode, LINK_TTL_SECONDS, e.getMessage());
        }
    }

    /** Duy nhất trong tiến trình (tăng dần), nằm trong dải TEST_ORDER_CODE_BASE. */
    private long nextOrderCode() {
        long seconds = Instant.now().getEpochSecond() % 1_000_000_000L;
        long candidate = TEST_ORDER_CODE_BASE + seconds * 1_000L + ThreadLocalRandom.current().nextInt(1_000);
        return lastOrderCode.updateAndGet(prev -> Math.max(candidate, prev + 1));
    }
}
