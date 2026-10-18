package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.TonKhoTheoLoDto;
import com.dev.backend.entities.TonKhoTheoLo;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import org.mapstruct.ReportingPolicy;
import org.springframework.data.domain.Page;

import java.util.List;

@Mapper(unmappedTargetPolicy = ReportingPolicy.IGNORE, componentModel = MappingConstants.ComponentModel.SPRING)
public interface TonKhoTheoLoMapper {
    TonKhoTheoLoDto toDto(TonKhoTheoLo tonKhoTheoLo);
    List<TonKhoTheoLoDto> toDtoList(List<TonKhoTheoLo> list);

    default Page<TonKhoTheoLoDto> toDtoPage(Page<TonKhoTheoLo> page){
        return page.map(this::toDto);
    }
}