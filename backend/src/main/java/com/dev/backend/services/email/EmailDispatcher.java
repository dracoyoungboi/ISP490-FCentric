package com.dev.backend.services.email;

import com.dev.backend.dto.email.CuaHangEmail;
import com.dev.backend.utils.SauCommit;
import jakarta.annotation.PreDestroy;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Gửi email ở luồng riêng, SAU KHI transaction của nghiệp vụ commit (thay OtpMailDispatcher).
 *
 * <ul>
 *   <li>{@link #guiSauCommit}: đang có transaction thì đăng ký afterCommit (rollback thì không gửi); không có thì
 *       đưa vào hàng đợi ngay. Không bao giờ ném lỗi ra nơi gọi.</li>
 *   <li>{@link #guiNgay}: gửi đồng bộ ngay trong request (E5), lỗi thì ném {@link EmailKhongGuiDuocException}.</li>
 *   <li>Hàng đợi có giới hạn ({@value #SUC_CHUA_HANG_DOI}). Đầy thì ghi ERROR và bỏ, KHÔNG chạy trên luồng request
 *       (Quên mật khẩu giữ thời gian phản hồi như nhau để không dò được tài khoản).</li>
 *   <li>Thử lại chỉ với {@link MailSendException} (SMTP lỗi tạm thời / mất kết nối): tối đa {@value #SO_LAN_GUI_TOI_DA}
 *       lần, chờ 30 giây rồi 120 giây, hẹn giờ bằng ScheduledExecutorService (không ngủ trong luồng gửi). Lỗi xác
 *       thực SMTP, lỗi dựng mẫu, lỗi địa chỉ thì không thử lại.</li>
 *   <li>Log có loại email, người nhận, mã đơn, lần thử. Không ghi nội dung thư, mã hay mật khẩu.</li>
 * </ul>
 *
 * Lưu ý: không gọi {@link #guiSauCommit} từ bên trong một afterCommit khác (đồng bộ đăng ký lúc đó không bao giờ
 * chạy). Callback {@code khiGuiDuoc} chạy trên luồng gửi, không có transaction.
 * Pool tự quản lý, KHÔNG đăng ký thành bean Executor (tránh làm Spring Boot bỏ applicationTaskExecutor mặc định).
 */
@Slf4j
@Component
public class EmailDispatcher {

    static final int SUC_CHUA_HANG_DOI = 500;
    static final int SO_LAN_GUI_TOI_DA = 3;
    /** Chờ trước lần gửi thứ 2, thứ 3. */
    static final List<Duration> LICH_THU_LAI = List.of(Duration.ofSeconds(30), Duration.ofSeconds(120));

    private final JavaMailSender mailSender;
    private final DungMauEmail dungMau;
    private final CuaHangEmailFactory cuaHangFactory;
    private final String diaChiGui;
    private final Executor guiExecutor;
    private final ScheduledExecutorService henGio;
    private final ExecutorService poolTuQuanLy;

    @Autowired
    public EmailDispatcher(JavaMailSender mailSender, DungMauEmail dungMau, CuaHangEmailFactory cuaHangFactory,
                           @Value("${app.mail.from:}") String diaChiGui,
                           @Value("${spring.mail.username:}") String taiKhoanGui) {
        this(mailSender, dungMau, cuaHangFactory, chonDiaChiGui(diaChiGui, taiKhoanGui, mailSender), taoPoolGui(),
                taoHenGio(), true);
    }

    /**
     * Như {@link #chonDiaChiGui(String, String)}; MAIL_FROM và MAIL_USERNAME đều trống thì dùng tài khoản của bean
     * JavaMailSender (MailConfig viết sẵn tài khoản Gmail): email vẫn gửi được khi máy chưa đặt biến môi trường.
     */
    static String chonDiaChiGui(String diaChiGui, String taiKhoanGui, JavaMailSender mailSender) {
        String chon = chonDiaChiGui(diaChiGui, taiKhoanGui);
        if (chon.isEmpty() && mailSender instanceof JavaMailSenderImpl impl && impl.getUsername() != null) {
            return impl.getUsername().trim();
        }
        return chon;
    }

    /**
     * Địa chỉ gửi: MAIL_FROM; trống thì tài khoản SMTP (MAIL_USERNAME). docker-compose luôn đặt biến MAIL_FROM (có
     * thể rỗng), nên giá trị mặc định trong application.properties không đủ: phải xét chuỗi rỗng ở đây.
     */
    static String chonDiaChiGui(String diaChiGui, String taiKhoanGui) {
        if (diaChiGui != null && !diaChiGui.isBlank()) {
            return diaChiGui.trim();
        }
        return taiKhoanGui == null ? "" : taiKhoanGui.trim();
    }

    /** Cho test: truyền executor đồng bộ và bộ hẹn giờ giả. */
    EmailDispatcher(JavaMailSender mailSender, DungMauEmail dungMau, CuaHangEmailFactory cuaHangFactory,
                    String diaChiGui, Executor guiExecutor, ScheduledExecutorService henGio) {
        this(mailSender, dungMau, cuaHangFactory, diaChiGui, guiExecutor, henGio, false);
    }

    private EmailDispatcher(JavaMailSender mailSender, DungMauEmail dungMau, CuaHangEmailFactory cuaHangFactory,
                            String diaChiGui, Executor guiExecutor, ScheduledExecutorService henGio, boolean tuQuanLy) {
        this.mailSender = mailSender;
        this.dungMau = dungMau;
        this.cuaHangFactory = cuaHangFactory;
        this.diaChiGui = diaChiGui == null ? "" : diaChiGui.trim();
        this.guiExecutor = guiExecutor;
        this.henGio = henGio;
        this.poolTuQuanLy = tuQuanLy && guiExecutor instanceof ExecutorService es ? es : null;
    }

    private static ThreadPoolExecutor taoPoolGui() {
        AtomicInteger stt = new AtomicInteger();
        ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 2, 60, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(SUC_CHUA_HANG_DOI),
                r -> {
                    Thread t = new Thread(r, "email-gui-" + stt.incrementAndGet());
                    t.setDaemon(true);
                    return t;
                },
                new ThreadPoolExecutor.AbortPolicy());
        pool.allowCoreThreadTimeOut(true);
        return pool;
    }

    private static ScheduledExecutorService taoHenGio() {
        ScheduledThreadPoolExecutor s = new ScheduledThreadPoolExecutor(1, r -> {
            Thread t = new Thread(r, "email-hen-gio");
            t.setDaemon(true);
            return t;
        });
        s.setRemoveOnCancelPolicy(true);
        return s;
    }

    // ---------------- API ----------------

    /** Gửi sau khi transaction hiện tại commit (không có transaction thì đưa vào hàng đợi ngay). Không ném lỗi. */
    public void guiSauCommit(EmailGui g) {
        SauCommit.chay("Gửi email " + g.loai(), () -> xepHang(g, 1));
    }

    /**
     * Gửi đồng bộ ngay (E5). Không thử lại: nơi gọi xóa mã và báo nhà cung cấp thử lại.
     *
     * @throws EmailKhongGuiDuocException khi không dựng hoặc không gửi được
     */
    public void guiNgay(EmailGui g) {
        try {
            if (!conHieuLuc(g)) {
                throw new IllegalStateException("Email không còn hiệu lực");
            }
            MimeMessage msg = taoThu(g);
            mailSender.send(msg);
            log.info("[EMAIL] Đã gửi {} tới {}{}", g.loai(), g.den(), donLog(g));
            chayKhiGuiDuoc(g);
        } catch (Exception e) {
            log.error("[EMAIL] Không gửi được {} tới {}{}: {}", g.loai(), g.den(), donLog(g), e.toString());
            throw new EmailKhongGuiDuocException("Không gửi được email " + g.loai(), e);
        }
    }

    // ---------------- Hàng đợi, thử lại ----------------

    private void xepHang(EmailGui g, int lan) {
        try {
            guiExecutor.execute(() -> guiMotLan(g, lan));
        } catch (RejectedExecutionException e) {
            log.error("[EMAIL] Hàng đợi gửi email đầy hoặc đã dừng, bỏ {} tới {}{} (lần {})",
                    g.loai(), g.den(), donLog(g), lan);
            thatBai(g, e);
        }
    }

    private void guiMotLan(EmailGui g, int lan) {
        if (!conHieuLuc(g)) {
            log.info("[EMAIL] Bỏ {} tới {}{}: không còn hiệu lực (đã có thao tác mới hơn)", g.loai(), g.den(), donLog(g));
            return;
        }
        MimeMessage msg;
        try {
            msg = taoThu(g);
        } catch (Exception e) {
            // lỗi dựng mẫu / địa chỉ / đọc thông tin cửa hàng: thử lại cũng không qua
            log.error("[EMAIL] Không dựng được {} tới {}{}", g.loai(), g.den(), donLog(g), e);
            thatBai(g, e);
            return;
        }
        try {
            mailSender.send(msg);
        } catch (MailSendException e) {
            if (g.loai().thuLai() && lan < SO_LAN_GUI_TOI_DA) {
                Duration cho = LICH_THU_LAI.get(lan - 1);
                log.warn("[EMAIL] Gửi {} tới {}{} lỗi (lần {}), thử lại sau {} giây: {}",
                        g.loai(), g.den(), donLog(g), lan, cho.toSeconds(), e.getMessage());
                henGioThuLai(g, lan + 1, cho);
            } else {
                log.error("[EMAIL] Gửi {} tới {}{} thất bại sau {} lần: {}",
                        g.loai(), g.den(), donLog(g), lan, e.getMessage());
                thatBai(g, e);
            }
            return;
        } catch (Exception e) {
            // MailAuthenticationException, MailParseException, MailPreparationException…: không thử lại
            log.error("[EMAIL] Gửi {} tới {}{} thất bại, không thử lại: {}", g.loai(), g.den(), donLog(g), e.toString());
            thatBai(g, e);
            return;
        }
        log.info("[EMAIL] Đã gửi {} tới {}{} (lần {})", g.loai(), g.den(), donLog(g), lan);
        chayKhiGuiDuoc(g);
    }

    private void henGioThuLai(EmailGui g, int lan, Duration cho) {
        try {
            henGio.schedule(() -> xepHang(g, lan), cho.toMillis(), TimeUnit.MILLISECONDS);
        } catch (RejectedExecutionException e) {
            log.error("[EMAIL] Không hẹn được lần thử lại {} tới {}{}", g.loai(), g.den(), donLog(g));
            thatBai(g, e);
        }
    }

    // ---------------- Dựng thư ----------------

    MimeMessage taoThu(EmailGui g) throws Exception {
        if (diaChiGui.isEmpty()) {
            throw new IllegalStateException("Chưa cấu hình địa chỉ gửi email (MAIL_FROM)");
        }
        CuaHangEmail cuaHang = cuaHangFactory.hienTai();
        if (g.loai().nhaCungCap() && !cuaHang.thieuChoEmailNhaCungCap().isEmpty()) {
            // khu mua hàng đã chặn gửi yêu cầu khi thiếu; tới đây là hồ sơ bị xóa sau đó: vẫn gửi, chân bỏ dòng thiếu
            log.warn("[EMAIL] {} tới {}{}: thông tin cửa hàng còn thiếu {}", g.loai(), g.den(), donLog(g),
                    String.join(" và ", cuaHang.thieuChoEmailNhaCungCap()));
        }
        BanThu thu = dungMau.dung(g, cuaHang);

        MimeMessage msg = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(msg, true, StandardCharsets.UTF_8.name());
        helper.setFrom(new InternetAddress(diaChiGui, DungMauEmail.motDong(cuaHang.tenNguoiGui()),
                StandardCharsets.UTF_8.name()));
        helper.setTo(new InternetAddress(g.den().trim(), true));
        if (thu.traLoiToi() != null) {
            helper.setReplyTo(new InternetAddress(thu.traLoiToi().email(), thu.traLoiToi().ten(),
                    StandardCharsets.UTF_8.name()));
        }
        helper.setSubject(thu.tieuDe());
        helper.setText(thu.text(), thu.html());
        // email tự động: tránh thư trả lời tự động (vắng mặt, chuyển tiếp…) dội về địa chỉ no-reply
        msg.setHeader("Auto-Submitted", "auto-generated");
        msg.setHeader("X-Auto-Response-Suppress", "All");
        return msg;
    }

    // ---------------- Tiện ích ----------------

    private static boolean conHieuLuc(EmailGui g) {
        try {
            return g.conHieuLuc() == null || g.conHieuLuc().getAsBoolean();
        } catch (RuntimeException e) {
            log.error("[EMAIL] Không kiểm được hiệu lực của {} tới {}{}", g.loai(), g.den(), donLog(g), e);
            return false;
        }
    }

    private static void chayKhiGuiDuoc(EmailGui g) {
        if (g.khiGuiDuoc() == null) {
            return;
        }
        try {
            g.khiGuiDuoc().run();
        } catch (RuntimeException e) {
            log.error("[EMAIL] Đã gửi {} tới {}{} nhưng không ghi nhận được", g.loai(), g.den(), donLog(g), e);
        }
    }

    private static void thatBai(EmailGui g, Exception e) {
        if (g.khiThatBai() == null) {
            return;
        }
        try {
            g.khiThatBai().accept(e);
        } catch (RuntimeException ex) {
            log.error("[EMAIL] Lỗi khi xử lý {} gửi thất bại tới {}{}", g.loai(), g.den(), donLog(g), ex);
        }
    }

    private static String donLog(EmailGui g) {
        return g.maDon() == null ? "" : ", đơn " + g.maDon();
    }

    @PreDestroy
    void dung() throws InterruptedException {
        if (poolTuQuanLy == null) {
            return;
        }
        int conCho = poolTuQuanLy instanceof ThreadPoolExecutor tpe ? tpe.getQueue().size() : 0;
        List<Runnable> henChuaChay = henGio.shutdownNow();
        if (conCho > 0 || !henChuaChay.isEmpty()) {
            log.warn("[EMAIL] Dừng máy chủ khi còn {} email chờ gửi và {} lần thử lại chưa tới giờ: các email này sẽ mất",
                    conCho, henChuaChay.size());
        }
        poolTuQuanLy.shutdown();
        poolTuQuanLy.awaitTermination(30, TimeUnit.SECONDS);
    }
}
