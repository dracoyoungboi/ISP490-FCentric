package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DayTonResultDto {
    /** Số SKU sàn đã nhận số tồn */
    int soDong;
    /** Số SKU bị sàn từ chối hoặc không có trên sàn (dòng chuyển sang Lỗi kèm lý do) */
    int soLoi;
    /** Số SKU chưa kịp đẩy vì lỗi cả gian hàng giữa chừng (giữ nguyên trạng thái, lần sau đẩy lại) */
    int soChuaDay;
    /** Lỗi cả gian hàng (thiếu khóa, sai tên miền, sàn không phản hồi...); null nếu không có */
    String loiKenh;
}

