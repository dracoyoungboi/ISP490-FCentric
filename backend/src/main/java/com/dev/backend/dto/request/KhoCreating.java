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
    /** Phải để trống: kho mới chưa ai được phân quyền nên chưa có người quản lý chính (xem Kho.quanLy). */
    Integer quanLyId;
    Integer trangThai;
    String loaiKho;
}
