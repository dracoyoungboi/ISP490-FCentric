package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

/**
 * DTO for {@link com.dev.backend.entities.ThuongHieu}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class ThuongHieuDto implements Serializable {
    Integer id;
    String maThuongHieu;
    String tenThuongHieu;
    String moTa;
    String logoUrl;
    Integer trangThai;
    Instant ngayTao;
    Instant ngayCapNhat;
}