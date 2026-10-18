package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.QuyenHanDto;
import com.dev.backend.entities.QuyenHan;
import org.mapstruct.*;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Mapper(unmappedTargetPolicy = ReportingPolicy.IGNORE, componentModel = MappingConstants.ComponentModel.SPRING)
public interface QuyenHanMapper {
    QuyenHan toEntity(QuyenHanDto quyenHanDto);

    QuyenHanDto toDto(QuyenHan quyenHan);

    List<QuyenHanDto> toDtoList(List<QuyenHan> list);

    default Page<QuyenHanDto> toDtoPage(Page<QuyenHan> page){
        return page.map(this::toDto);
    }

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    QuyenHan partialUpdate(QuyenHanDto quyenHanDto, @MappingTarget QuyenHan quyenHan);
}
