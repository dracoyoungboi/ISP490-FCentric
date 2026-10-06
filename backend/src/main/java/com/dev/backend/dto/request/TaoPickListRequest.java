package com.dev.backend.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaoPickListRequest {
    @NotEmpty(message = "Danh sách ID đơn hàng không được để trống")
    List<Integer> donBanHangIds;

    String ghiChu;

    Integer nguoiNhatId;     // Phân công nhân viên nhặt hàng (tùy chọn lúc tạo)
}
