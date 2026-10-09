package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.LoHangDto;
import com.dev.backend.entities.LoHang;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import org.springframework.data.domain.Page;

import java.util.List;

// BienTheSanPhamMapper: biến thể trong lô có đủ tenSanPham / tenBienThe như các API khác.
// Đã bỏ toEntity(LoHangDto): không nơi nào gọi.
@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, uses = {BienTheSanPhamMapper.class})
public interface LoHangMapper {
    LoHangDto toDto(LoHang loHang);

    List<LoHangDto> toDtoList(List<LoHang> list);

    default Page<LoHangDto> toDtoPage(Page<LoHang> page){
        if(page.isEmpty()) return Page.empty();
        return page.map(this::toDto);
    }

}
