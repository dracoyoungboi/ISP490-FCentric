package com.dev.backend.mapper;

import com.dev.backend.dto.request.ChatLieuCreating;
import com.dev.backend.dto.request.ChatLieuUpdating;
import com.dev.backend.dto.response.entities.ChatLieuDto;
import com.dev.backend.entities.ChatLieu;
import org.mapstruct.*;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Mapper cho entity ChatLieu
 */
@Mapper(componentModel = MappingConstants.ComponentModel.SPRING,
        unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface ChatLieuMapper {

    /**
     * Chuyển entity → DTO response
     */
    ChatLieuDto toDto(ChatLieu entity);

    /**
     * Chuyển list entity → list DTO
     */
    List<ChatLieuDto> toDtoList(List<ChatLieu> entities);

    /**
     * Hỗ trợ phân trang
     */
    default Page<ChatLieuDto> toDtoPage(Page<ChatLieu> page) {
        return page.map(this::toDto);
    }

    /**
     * Chuyển DTO create → entity
     * Bỏ qua id và ngayTao (database tự sinh)
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "ngayTao", ignore = true)
    ChatLieu toEntity(ChatLieuCreating creating);

    /**
     * Update entity từ DTO update
     * Bỏ qua id và ngayTao, ignore null fields
     */
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "ngayTao", ignore = true)
    void partialUpdate(ChatLieuUpdating updating, @MappingTarget ChatLieu entity);
}