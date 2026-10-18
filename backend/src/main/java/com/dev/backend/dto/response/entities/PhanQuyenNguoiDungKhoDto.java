package com.dev.backend.dto.response.entities;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * DTO for {@link com.dev.backend.entities.PhanQuyenNguoiDungKho}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class PhanQuyenNguoiDungKhoDto implements Serializable {
    Integer id;
    NguoiDungDto nguoiDung;
    KhoDto kho;
    Integer laQuanLyKho;
    Integer trangThai;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant ngayBatDau;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant ngayKetThuc;
    NguoiDungDto nguoiCapQuyen;
    // Họ tên người cấp phân quyền kho (nguoiCapQuyen không được map để token gọn)
    String tenNguoiCapQuyen;
    String ghiChu;
    Instant ngayTao;
    Instant ngayCapNhat;
    Set<ChiTietQuyenKhoDto> chiTietQuyenKhos;
    @JsonProperty("stringListPermission")
    public List<String> getStringListPermission() {
        if (chiTietQuyenKhos == null) {
            return new ArrayList<>();
        }

        return chiTietQuyenKhos.stream()
                .map(ChiTietQuyenKhoDto::getMaQuyenHan)
                .collect(Collectors.toList());
    }
}