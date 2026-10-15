package com.dev.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Cấu hình đồng bộ của một kênh bán. Trường để null thì giữ nguyên giá trị đang lưu.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KenhCauHinhDongBoRequest {
    /** Tự động đẩy tồn kho lên sàn theo chu kỳ và khi tồn xuống thấp */
    Boolean tuDongDayTon;
    /** Tự động lấy đơn mới từ sàn theo chu kỳ */
    Boolean tuDongLayDon;

    @Min(value = 1, message = "Tỷ lệ đẩy tồn tối thiểu 1%")
    @Max(value = 100, message = "Tỷ lệ đẩy tồn tối đa 100%")
    Integer tyLeDayTon;

    @Min(value = 0, message = "Tồn đệm phải từ 0 trở lên")
    @Max(value = 100000, message = "Tồn đệm tối đa 100.000")
    Integer tonDem;

    @Min(value = 0, message = "Ngưỡng về 0 phải từ 0 trở lên")
    @Max(value = 100000, message = "Ngưỡng về 0 tối đa 100.000")
    Integer nguongVe0;
}
