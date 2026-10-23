package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.YeuCauMuaHangDto;
import com.dev.backend.entities.YeuCauMuaHang;
import org.mapstruct.*;
import org.springframework.data.domain.Page;

import java.util.List;

// DonMuaHangMapper: đơn mua trong donMuaHangs map giống API đơn mua (cờ khongDuocChon, chuaGuiDuocYeuCau, yêu cầu rút gọn).
@Mapper(componentModel = MappingConstants.ComponentModel.SPRING,
        uses = {BienTheSanPhamMapper.class, NguoiDungMapper.class, DonMuaHangMapper.class})
public interface YeuCauMuaHangMapper {
    @Mapping(target = "lyDoTuChoi", ignore = true)
    @Mapping(target = "ngayDuyet", ignore = true)
    YeuCauMuaHangDto toDto(YeuCauMuaHang yeuCauMuaHang);
    List<YeuCauMuaHangDto> toDtoList(List<YeuCauMuaHang> list);
    default Page<YeuCauMuaHangDto> toDtoPage(Page<YeuCauMuaHang> page){
        return page.map(this::toDto);
    }

}