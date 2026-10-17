package com.dev.backend.dto.response.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ViTriKhoDto {
    Integer id;
    String maViTri;
    Integer khuVucId;
    String tenKhuVuc;
    String day;
    String hang;
    String tang;
    Integer sucChua;
    Integer dangChua;
    String trangThai;
}

