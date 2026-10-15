package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Cấu hình đồng bộ đang áp dụng cho một kênh bán (đã tính giá trị mặc định nếu chưa lưu).
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KenhCauHinhDongBoDto {
    String maKenh;
    boolean tuDongDayTon;
    boolean tuDongLayDon;
    int tyLeDayTon;
    int tonDem;
    int nguongVe0;
    /** Chu kỳ chạy tự động (phút) theo OMNI_SYNC_INTERVAL_MINS, dùng chung cho đẩy tồn và lấy đơn */
    int chuKyPhut;
    /** Tồn còn lại dưới ngưỡng này thì đẩy tồn ngay, theo REALTIME_SYNC_THRESHOLD */
    int nguongDayNgay;
    /** true nếu kênh đã từng lưu cấu hình; false nghĩa là đang chạy theo giá trị mặc định */
    boolean daLuu;
    /** Đã lưu phần tồn kho (bước 2 của màn Thiết lập) */
    boolean daLuuTonKho;
    /** Đã lưu phần đơn hàng (bước 3 của màn Thiết lập) */
    boolean daLuuDonHang;
}
