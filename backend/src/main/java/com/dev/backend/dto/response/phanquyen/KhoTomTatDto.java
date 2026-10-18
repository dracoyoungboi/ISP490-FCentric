package com.dev.backend.dto.response.phanquyen;

import com.dev.backend.entities.Kho;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/** Thông tin kho tối thiểu để hiển thị: id, mã, tên, loại. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KhoTomTatDto {
    Integer id;
    String maKho;
    String tenKho;
    String loaiKho;

    public static KhoTomTatDto tu(Kho kho) {
        if (kho == null) return null;
        return KhoTomTatDto.builder()
                .id(kho.getId())
                .maKho(kho.getMaKho())
                .tenKho(kho.getTenKho())
                .loaiKho(kho.getLoaiKho())
                .build();
    }
}
