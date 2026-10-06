package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class KenhBanHangDto implements Serializable {
    Integer id;
    String maKenh;
    String tenKenh;
    String loaiKenh;
    String apiUrl;
    Integer trangThai;
    Instant ngayTao;
    Instant ngayCapNhat;
}

