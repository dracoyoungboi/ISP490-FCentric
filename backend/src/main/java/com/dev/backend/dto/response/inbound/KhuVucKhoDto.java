package com.dev.backend.dto.response.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KhuVucKhoDto {
    Integer id;
    String maKhuVuc;
    String tenKhuVuc;
    String loaiKhu;
    String ghiChu;
    Integer soViTri;
}

