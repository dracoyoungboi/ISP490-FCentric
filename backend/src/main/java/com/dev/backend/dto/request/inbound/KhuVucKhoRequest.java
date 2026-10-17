package com.dev.backend.dto.request.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KhuVucKhoRequest {
    String maKhuVuc;
    String tenKhuVuc;
    String loaiKhu;
    String ghiChu;
}

