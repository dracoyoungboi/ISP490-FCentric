package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.YeuCauMuaHangDto;
import com.dev.backend.entities.YeuCauMuaHang;
import org.mapstruct.*;
import org.springframework.data.domain.Page;

import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING,
        uses = {BienTheSanPhamMapper.class, NguoiDungMapper.class})
public interface YeuCauMuaHangMapper {
    @Mapping(target = "lyDoTuChoi", ignore = true)
    @Mapping(target = "ngayDuyet", ignore = true)
    YeuCauMuaHangDto toDto(YeuCauMuaHang yeuCauMuaHang);
    List<YeuCauMuaHangDto> toDtoList(List<YeuCauMuaHang> list);
    default Page<YeuCauMuaHangDto> toDtoPage(Page<YeuCauMuaHang> page){
        if(page.isEmpty()) return Page.empty();
        return page.map(this::toDto);
    }

}