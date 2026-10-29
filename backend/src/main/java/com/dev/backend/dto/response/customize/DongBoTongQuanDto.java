package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DongBoTongQuanDto {
    long tongSkuSan;
    long daLienKet;
    long chuaLienKet;
    long loiDongBo;
    Instant lanDongBoCuoi;
    /** Chu kỳ đẩy tồn định kỳ (phút), theo OMNI_SYNC_INTERVAL_MINS */
    Integer chuKyDongBoTonPhut;
    /** Chu kỳ lấy đơn định kỳ (phút), theo OMNI_SYNC_INTERVAL_MINS */
    Integer chuKyLayDonPhut;
    /** Lần đẩy tồn lên sàn gần nhất; null nếu chưa đẩy được lần nào từ khi máy chủ khởi động */
    Instant lanDayTonCuoi;
    /** Lần lấy đơn từ sàn thành công gần nhất; null nếu chưa lấy được lần nào từ khi máy chủ khởi động */
    Instant lanLayDonCuoi;
    /** Số đơn khách yêu cầu hủy chưa xuất kho (đặc thù TikTok Shop) */
    Long soYeuCauHuy;
}

