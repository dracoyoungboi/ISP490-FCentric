package com.dev.backend.workers;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.services.impl.entities.NguoiDungService;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Component
@Slf4j
@Getter
public class SchedulingJob {
    @Autowired
    private NguoiDungService nguoiDungService;


    @Transactional
    @Scheduled(fixedDelay = 60000)
    public void cleanOutOfDateOtp() {
        Instant now = Instant.now();
        GlobalCache.OTP_SCHEDULE_OBJS.removeIf(otpScheduleObj ->
                now.isAfter(otpScheduleObj.getCreatedAt().plusSeconds(300))
        );
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
