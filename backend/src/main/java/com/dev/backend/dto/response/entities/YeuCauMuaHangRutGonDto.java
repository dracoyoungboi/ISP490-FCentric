package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

/**
 * Yêu cầu nhập hàng gốc đi kèm đơn mua hàng: chỉ mã, số và ngày tạo.
 * Không dùng YeuCauMuaHangDto đầy đủ để đơn mua không kéo theo cả danh sách chi tiết yêu cầu.
 * Frontend đọc `donMuaHang.yeuCauMuaHang.soYeuCauMuaHang` (danh sách, chi tiết đơn mua, tạo đơn từ báo giá).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class YeuCauMuaHangRutGonDto implements Serializable {
    Integer id;
    String soYeuCauMuaHang;
    Instant ngayTao;
}
