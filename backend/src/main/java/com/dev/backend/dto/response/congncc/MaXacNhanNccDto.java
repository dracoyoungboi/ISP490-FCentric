package com.dev.backend.dto.response.congncc;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/** Kết quả POST /api/v1/cong-ncc/dang-nhap/lay-ma: cổng đếm ngược theo máy chủ, không viết cứng thời hạn. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MaXacNhanNccDto implements Serializable {
    /** Mã có hiệu lực bao nhiêu giây kể từ lúc gửi. */
    int hetHanGiay;
    /** Sau bao nhiêu giây mới xin được mã mới. */
    int guiLaiSauGiay;
}
