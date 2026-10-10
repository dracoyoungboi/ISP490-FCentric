package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.utils.MaskingUtils;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;

// NguoiDungMapper: nguoiTao, nguoiDuyet, khoXuat.quanLy được map đúng avatarUrl.
@Mapper(componentModel = "spring", uses = {NguoiDungMapper.class})
public interface DonBanHangMapper {

    DonBanHangDto toDto(DonBanHang entity);

    @AfterMapping
    default void maskSensitiveInfo(@MappingTarget DonBanHangDto dto) {
        if (dto != null && dto.getKhachHang() != null && dto.getKhachHang().getSoDienThoai() != null) {
            dto.getKhachHang().setSoDienThoai(MaskingUtils.maskPhone(dto.getKhachHang().getSoDienThoai()));
        }
    }
}