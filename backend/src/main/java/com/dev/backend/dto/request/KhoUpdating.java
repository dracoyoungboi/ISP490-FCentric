package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class KhoUpdating {
    Integer id;
    String maKho;
    String tenKho;
    String diaChi;
    Integer quanLyId;
    /** Bị bỏ qua khi sửa kho; đổi trạng thái qua PUT /api/v1/kho/{id}/trang-thai. Giữ để giao diện cũ gửi lên không lỗi. */
    Integer trangThai;
    String loaiKho;
}
