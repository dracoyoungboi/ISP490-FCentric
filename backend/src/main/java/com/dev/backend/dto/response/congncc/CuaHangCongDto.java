package com.dev.backend.dto.response.congncc;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/** Tên và logo cửa hàng hiện trên cổng sau khi xác nhận mã. Cả hai có thể null (cửa hàng chưa nhập). */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CuaHangCongDto implements Serializable {
    String ten;
    String logoUrl;
}
