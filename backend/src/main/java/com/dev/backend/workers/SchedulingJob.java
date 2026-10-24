package com.dev.backend.workers;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import com.dev.backend.services.impl.entities.NguoiDungService;
import com.dev.backend.services.impl.utils.LoginRateLimiter;
import com.dev.backend.services.impl.utils.PasswordResetRateLimiter;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@Component
@Slf4j
@Getter
public class SchedulingJob {
    @Autowired
    private NguoiDungService nguoiDungService;


    /**
     * Dọn mã hết hạn theo thời hạn của từng loại ({@link OtpType#thoiHan()}: nguồn chung với hetHanGiay của cổng và
     * hết hạn trong email mã). Không dùng bean nào (test gọi new SchedulingJob()).
     */
    @Transactional
    @Scheduled(fixedDelay = 60000)
    public void cleanOutOfDateOtp() {
        Instant now = Instant.now();
        GlobalCache.OTP_SCHEDULE_OBJS.removeIf(otpScheduleObj ->
                now.isAfter(otpScheduleObj.getCreatedAt().plus(thoiHan(otpScheduleObj)))
        );
    }

    /** Mã không rõ loại (dữ liệu cũ): dùng thời hạn dài nhất trong các loại để không xóa sớm. */
    static Duration thoiHan(OtpScheduleObj ma) {
        if (ma.getType() != null) return ma.getType().thoiHan();
        Duration dai = Duration.ZERO;
        for (OtpType loai : OtpType.values()) {
            if (loai.thoiHan().compareTo(dai) > 0) dai = loai.thoiHan();
        }
        return dai;
    }

    /**
     * Cổng nhà cung cấp: dọn phiên báo giá hết hạn, mốc gửi mã quá 1 giờ, mốc gửi lại email yêu cầu báo giá quá thời
     * gian chặn (tránh phình bộ nhớ). Không dùng bean nào.
     */
    @Scheduled(fixedDelay = 60000)
    public void donBoNhoCongNhaCungCap() {
        donBoNhoCongNhaCungCap(Instant.now());
    }

    static void donBoNhoCongNhaCungCap(Instant now) {
        GlobalCache.PHIEN_BAO_GIA.values().removeIf(phien -> phien.daHetHan(now));
        Instant motGioTruoc = now.minus(1, ChronoUnit.HOURS);
        synchronized (GlobalCache.OTP_SCHEDULE_OBJS) {
            GlobalCache.LUOT_GUI_MA_NCC.replaceAll((khoa, ds) -> ds.stream().filter(t -> t.isAfter(motGioTruoc)).toList());
            GlobalCache.LUOT_GUI_MA_NCC.values().removeIf(List::isEmpty);
        }
        GlobalCache.GUI_LAI_YEU_CAU.values().removeIf(
                luc -> !now.isBefore(luc.plusSeconds(DonMuaHangService.GUI_LAI_E4_CHAN_LAP_GIAY)));
    }

    @Autowired
    private PasswordResetRateLimiter passwordResetRateLimiter;

    @Autowired
    private LoginRateLimiter loginRateLimiter;

    // dọn bộ đếm đăng nhập sai đã hết hạn (tránh phình bộ nhớ)
    @Scheduled(fixedDelay = 60000 * 10)
    public void cleanLoginRateLimiter() {
        loginRateLimiter.purgeExpired();
    }

    // dọn mốc thời gian đã quá hạn của bộ giới hạn gửi OTP quên mật khẩu (tránh phình bộ nhớ)
    @Scheduled(fixedDelay = 60000 * 10)
    public void cleanPasswordResetRateLimiter() {
        passwordResetRateLimiter.purgeExpired();
    }

    // 30 phút một lần
    @Scheduled(fixedDelay = 60000 * 30)
    public void cleanOutOfDateApplication() {
        GlobalCache.APPLICATION_REQUEST_OBJS.removeIf(applicationRequestObj -> applicationRequestObj.getTaoLuc().isBefore(Instant.now().minusSeconds(60000 * 60 * 24)));
    }


    public void add(OtpScheduleObj otpScheduleObj) {
        GlobalCache.OTP_SCHEDULE_OBJS.add(otpScheduleObj);
    }
}
