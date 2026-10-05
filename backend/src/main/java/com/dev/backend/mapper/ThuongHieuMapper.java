package com.dev.backend.mapper;

import com.dev.backend.dto.request.ThuongHieuCreating;
import com.dev.backend.dto.request.ThuongHieuUpdating;
import com.dev.backend.dto.response.entities.ThuongHieuDto;
import com.dev.backend.entities.ThuongHieu;
import org.mapstruct.*;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Mapper cho entity ThuongHieu
 */
@Mapper(componentModel = MappingConstants.ComponentModel.SPRING,
        unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface ThuongHieuMapper {

    /**
     * Chuyển entity → DTO response
     */
    ThuongHieuDto toDto(ThuongHieu entity);

    /**
     * Chuyển list entity → list DTO
     */
    List<ThuongHieuDto> toDtoList(List<ThuongHieu> entities);

    /**
     * Hỗ trợ phân trang
     */
    default Page<ThuongHieuDto> toDtoPage(Page<ThuongHieu> page) {
        if (page.isEmpty()) return Page.empty();
        return page.map(this::toDto);
    }

    /**
     * Chuyển DTO create → entity
     * Bỏ qua id, logoUrl và ngày (database tự sinh / logo upload qua endpoint riêng)
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "logoUrl", ignore = true)
    @Mapping(target = "ngayTao", ignore = true)
    @Mapping(target = "ngayCapNhat", ignore = true)
    ThuongHieu toEntity(ThuongHieuCreating creating);

    /**
     * Update entity từ DTO update
     * Bỏ qua id, logoUrl và ngày, ignore null fields
     */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "logoUrl", ignore = true)
    @Mapping(target = "ngayTao", ignore = true)
    @Mapping(target = "ngayCapNhat", ignore = true)
    void partialUpdate(ThuongHieuUpdating updating, @MappingTarget ThuongHieu entity);
}