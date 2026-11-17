package com.dev.backend.dto.request;

import lombok.*;

/** Kiểm trùng khách (POST /api/v1/khach-hang/kiem-trung): truong = soDienThoai | email | maSoThue; boQuaId = khách đang sửa. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KhachHangKiemTrung {
    private String truong;
    private String giaTri;
    private Integer boQuaId;
}
