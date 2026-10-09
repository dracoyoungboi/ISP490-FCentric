package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.utils.PublicAssetUrl;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Mapper(componentModel = "spring", uses = {PhanQuyenNguoiDungKhoMapper.class})

// từ domain entities chuyển thành dto
public interface NguoiDungMapper {
    /**
     * avatarUrl lấy từ avatarTepTin.duongDan, chuẩn hoá origin legacy MinIO ->
     * HTTPS để trình duyệt không chặn Mixed Content. Không có tep_tin -> null.
     */
    @Mapping(target = "avatarUrl", source = "avatarTepTin.duongDan", qualifiedByName = "publicAssetUrl")
    @Mapping(target = "khoPhuTrachActive", ignore = true) // NguoiDungService.fillKhoPhuTrachActive tự điền cho /me
    NguoiDungDto toDto(NguoiDung entity);
    List<NguoiDungDto> toDtoList(List<NguoiDung> list);

    @Named("publicAssetUrl")
    default String mapPublicAssetUrl(String duongDan) {
        return PublicAssetUrl.toHttps(duongDan);
    }

    default Page<NguoiDungDto> toDtoPage(Page<NguoiDung> page){
        if(page.isEmpty()) return Page.empty();
        return page.map(this::toDto);
    }
}
