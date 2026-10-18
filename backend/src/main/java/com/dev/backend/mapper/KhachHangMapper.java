package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.dto.request.KhachHangUpdating;
import org.mapstruct.*;
import org.springframework.data.domain.Page;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
//@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface KhachHangMapper {
    KhachHang toEntity(KhachHangDto khachHangDto);

    KhachHangDto toDto(KhachHang khachHang);

    default Page<KhachHangDto> toDtoPage(Page<KhachHang> page){
        return page.map(this::toDto);
    }
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void partialUpdate(KhachHangUpdating dto, @MappingTarget KhachHang entity);


}