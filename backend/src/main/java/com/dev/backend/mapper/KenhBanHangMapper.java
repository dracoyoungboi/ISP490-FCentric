package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.KenhBanHangDto;
import com.dev.backend.entities.KenhBanHang;
import org.mapstruct.Mapper;

// Đã bỏ toEntity(KenhBanHangDto): không nơi nào gọi, và DTO không chứa apiKey/apiSecret
// nên map ngược sẽ tạo entity thiếu thông tin bí mật.
@Mapper(componentModel = "spring")
public interface KenhBanHangMapper {
    KenhBanHangDto toDto(KenhBanHang entity);
}
