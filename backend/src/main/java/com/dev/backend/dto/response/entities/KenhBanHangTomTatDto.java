package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/**
 * Kênh bán gắn trên đơn bán: chỉ mã và tên để hiện thẻ kênh.
 * Không dùng KenhBanHangDto/entity ở đây để danh sách đơn không kéo theo cấu hình kết nối của kênh.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class KenhBanHangTomTatDto implements Serializable {
    Integer id;
    String maKenh;
    String tenKenh;
}
