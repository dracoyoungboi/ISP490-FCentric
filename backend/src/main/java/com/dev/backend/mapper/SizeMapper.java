package com.dev.backend.mapper;

import com.dev.backend.dto.request.SizeCreating;
import com.dev.backend.dto.request.SizeUpdating;
import com.dev.backend.dto.response.entities.SizeDto;
import com.dev.backend.entities.Size;
import org.mapstruct.*;
import org.springframework.data.domain.Page;

import java.util.List;

@Mapper(unmappedTargetPolicy = ReportingPolicy.IGNORE, componentModel = MappingConstants.ComponentModel.SPRING)
public interface SizeMapper {

    Size toEntity(SizeDto dto);

    // Thêm 2 dòng này để nhận diện SizeCreating và SizeUpdating
    Size toEntity(SizeCreating creating);

    Size toEntity(SizeUpdating updating);

    SizeDto toDto(Size entity);

    List<SizeDto> toDtoList(List<Size> list);

    default Page<SizeDto> toDtoPage(Page<Size> page) {
        return page.map(this::toDto);
    }

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    Size partialUpdate(SizeDto dto, @MappingTarget Size entity);
}
