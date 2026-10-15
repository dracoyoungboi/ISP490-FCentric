package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Kết quả "Tạo lại phiếu xuất": phiếu mới và các SKU chưa có đủ lô (quản lý kho cần sửa lô trước khi xuất). */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaoLaiPhieuXuatDto {
    Integer phieuXuatKhoId;
    String soPhieuXuat;
    List<String> canSuaLo;
}
