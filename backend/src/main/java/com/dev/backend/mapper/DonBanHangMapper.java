package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.entities.DonBanHang;
import org.mapstruct.Mapper;

// NguoiDungMapper: nguoiTao, nguoiDuyet, khoXuat.quanLy được map đúng avatarUrl.
@Mapper(componentModel = "spring", uses = {NguoiDungMapper.class})
public interface DonBanHangMapper {

    DonBanHangDto toDto(DonBanHang entity);
}