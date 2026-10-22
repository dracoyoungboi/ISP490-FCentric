package com.dev.backend.constant;

import com.dev.backend.dto.ApplicationRequestObj;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.dto.PhienBaoGia;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public interface GlobalCache {
    //Lưu danh sách OTP của người dùng
    // thread-safe: được ghi/đọc đồng thời từ request và job dọn OTP hết hạn (SchedulingJob)
    Set<OtpScheduleObj> OTP_SCHEDULE_OBJS = ConcurrentHashMap.newKeySet();
    Set<ApplicationRequestObj> APPLICATION_REQUEST_OBJS = new HashSet<>();

    // ---- Cổng nhà cung cấp (chỉ trong bộ nhớ: khởi động lại máy chủ thì mất, chạy một máy chủ) ----

    /** Phiên báo giá: token (header X-Phien-Bao-Gia) -> phiên. SchedulingJob dọn phiên hết hạn. */
    Map<String, PhienBaoGia> PHIEN_BAO_GIA = new ConcurrentHashMap<>();
    /**
     * Mốc các lần gửi mã xác nhận báo giá trong 1 giờ gần nhất, khóa "email|donMuaHangId" (giới hạn số mã mỗi giờ).
     * Chỉ đọc/ghi trong synchronized (OTP_SCHEDULE_OBJS); giá trị là danh sách không đổi, thay cả danh sách khi ghi.
     */
    Map<String, List<Instant>> LUOT_GUI_MA_NCC = new ConcurrentHashMap<>();
    /** Lần gần nhất đưa email yêu cầu báo giá gửi lại vào hàng đợi, theo id đơn mua (chặn bấm lại liên tục). */
    Map<Integer, Instant> GUI_LAI_YEU_CAU = new ConcurrentHashMap<>();
}
