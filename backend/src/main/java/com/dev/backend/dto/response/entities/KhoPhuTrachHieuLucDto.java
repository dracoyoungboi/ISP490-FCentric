package com.dev.backend.dto.response.entities;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

/**
 * Kho phụ trách đang hiệu lực của một người dùng, hiện ở cột "Kho phụ trách" của danh sách Người dùng
 * (POST /api/v1/admin/filter): phân quyền kho đang hoạt động, đã tới ngày bắt đầu, chưa hết hạn. Mỗi người tối đa một kho.
 * Chỉ gồm tên kho và ngày hết hiệu lực để danh sách nhẹ, không kèm quyền chi tiết (đã có ở trang chi tiết).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode
public class KhoPhuTrachHieuLucDto implements Serializable {
    String maKho;
    String tenKho;
    // Ngày hết hiệu lực của phân quyền; null = không thời hạn
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant ngayKetThuc;
}
