package com.dev.backend.dto.response.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Danh sách biên bản trả hàng nhà cung cấp, đã lọc theo kho người dùng xem được. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DanhSachTraHangNccDto {
    List<BienBanTraHangDto> items;
}
