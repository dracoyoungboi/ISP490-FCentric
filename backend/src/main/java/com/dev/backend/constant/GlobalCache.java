package com.dev.backend.constant;

import com.dev.backend.dto.ApplicationRequestObj;
import com.dev.backend.dto.OtpScheduleObj;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public interface GlobalCache {
    //Lưu danh sách OTP của người dùng
    // thread-safe: được ghi/đọc đồng thời từ request và job dọn OTP hết hạn (SchedulingJob)
    Set<OtpScheduleObj> OTP_SCHEDULE_OBJS = ConcurrentHashMap.newKeySet();
    Set<ApplicationRequestObj> APPLICATION_REQUEST_OBJS = new HashSet<>();
}
