package com.dev.backend.mapper;

import com.dev.backend.dto.request.MauSacCreating;
import com.dev.backend.dto.request.MauSacUpdating;
import com.dev.backend.dto.response.entities.MauSacDto;
import com.dev.backend.entities.MauSac;
import org.mapstruct.*;
import org.springframework.data.domain.Page;

import java.util.List;

@Mapper(unmappedTargetPolicy = ReportingPolicy.IGNORE, componentModel = MappingConstants.ComponentModel.SPRING)
public interface MauSacMapper {

    MauSac toEntity(MauSacDto dto);

    // Bổ sung mapping cho Request Create và Update
    MauSac toEntity(MauSacCreating creating);

    MauSac toEntity(MauSacUpdating updating);

    MauSacDto toDto(MauSac entity);

    List<MauSacDto> toDtoList(List<MauSac> list);

    default Page<MauSacDto> toDtoPage(Page<MauSac> page) {
        return page.map(this::toDto);
    }

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    MauSac partialUpdate(MauSacDto dto, @MappingTarget MauSac entity);
}
