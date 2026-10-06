package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.CauHinhHeThongDto;
import com.dev.backend.entities.CauHinhHeThong;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface CauHinhHeThongMapper {

    @Mapping(target = "nguoiCapNhatId", source = "nguoiCapNhat.id")
    @Mapping(target = "nguoiCapNhatTen", source = "nguoiCapNhat.hoTen")
    CauHinhHeThongDto toDto(CauHinhHeThong entity);

    List<CauHinhHeThongDto> toDtoList(List<CauHinhHeThong> entities);
}