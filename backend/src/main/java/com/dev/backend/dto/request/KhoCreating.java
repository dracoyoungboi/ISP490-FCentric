package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class KhoCreating {
    String maKho;
    String tenKho;
    String diaChi;
    Integer quanLyId;
    Integer trangThai;
    String loaiKho;
}
