package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/** Cấu hình payOS trả về trang Cài đặt — khóa luôn ở dạng che, không bao giờ trả khóa thật. */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PayosConfigDto {
    Boolean kichHoat;
    Boolean daCauHinhDu;
    Boolean mayChuCoKhoaMaHoa;
    String clientIdMasked;
    String apiKeyMasked;
    String checksumKeyMasked;
    Integer thoiGianHetHanPhut;
    String webhookUrl;
    String webhookUrlGoiY;
    Instant webhookXacNhanLuc;
    Instant ngayCapNhat;
}
