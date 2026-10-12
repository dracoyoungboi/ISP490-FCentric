package com.dev.backend.dto.response.entities;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

/**
 * DTO for {@link com.dev.backend.entities.Kho}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class KhoDto implements Serializable {
    Integer id;
    String maKho;
    String tenKho;
    String loaiKho;
    String diaChi;
    NguoiDungDto quanLy;
    Integer trangThai;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant ngayTao;
}