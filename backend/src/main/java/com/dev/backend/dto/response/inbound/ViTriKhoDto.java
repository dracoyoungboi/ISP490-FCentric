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
    /** Hàng đạt của lô đã khóa nhưng phiếu nhập chưa xác nhận, sẽ lên kệ này (còn trống = sucChua - dangChua - choNhap). */
    Integer choNhap;
    String trangThai;
}

