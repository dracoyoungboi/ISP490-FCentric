package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.KenhBanHangDto;
import com.dev.backend.entities.KenhBanHang;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface KenhBanHangMapper {
    KenhBanHangDto toDto(KenhBanHang entity);
    KenhBanHang toEntity(KenhBanHangDto dto);
}

