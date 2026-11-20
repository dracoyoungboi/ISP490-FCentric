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
    /** Người quản lý chính muốn đặt (null = bỏ trống). Chỉ được xét khi khác {@link #quanLyIdBanDau}. */
    Integer quanLyId;
    /**
     * Người quản lý chính lúc mở form. Ô không đổi (quanLyId == quanLyIdBanDau) thì giữ người hiện tại; có đổi mà người hiện
     * tại đã khác lúc mở form (người khác vừa đổi) thì trả 409.
     */
    Integer quanLyIdBanDau;
    /** Bị bỏ qua khi sửa kho; đổi trạng thái qua PUT /api/v1/kho/{id}/trang-thai. Giữ để giao diện cũ gửi lên không lỗi. */
    Integer trangThai;
    String loaiKho;
}
