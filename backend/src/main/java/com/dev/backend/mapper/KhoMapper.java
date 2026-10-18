package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.entities.Kho;
import org.mapstruct.*;
import org.springframework.data.domain.Page;

import java.util.List;

@Mapper(unmappedTargetPolicy = ReportingPolicy.IGNORE, componentModel = MappingConstants.ComponentModel.SPRING)
public interface KhoMapper {
    Kho toEntity(KhoDto khoDto);

    /*
     * Ghi rõ loaiKho: mapper này bỏ qua trường không khớp (IGNORE) nên nếu bản sinh mã thiếu trường,
     * API sẽ âm thầm trả loaiKho = null và mọi kho hiện là "Kho bán hàng". Khai báo rõ thì biên dịch
     * báo lỗi ngay khi entity hoặc DTO thiếu trường, và mapper được sinh lại khi kéo bản cập nhật này.
     */
    @Mapping(target = "loaiKho", source = "loaiKho")
    KhoDto toDto(Kho kho);
    List<KhoDto> toDtoList(List<Kho> list);
    default Page<KhoDto> toDtoPage(Page<Kho> page){
        return page.map(this::toDto);
    }

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    Kho partialUpdate(KhoDto khoDto, @MappingTarget Kho kho);
}

