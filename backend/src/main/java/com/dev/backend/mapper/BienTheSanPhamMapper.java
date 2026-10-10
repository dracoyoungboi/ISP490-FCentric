package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.BienTheSanPhamDto;
import com.dev.backend.entities.BienTheSanPham;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, uses = {AnhBienTheMapper.class})
public interface BienTheSanPhamMapper {
    @Mapping(source = "sanPham.tenSanPham", target = "tenSanPham")
    @Mapping(target = "tenBienThe", expression = "java(buildTenBienThe(entity))")
    @Mapping(target = "daPhatSinhGiaoDich", ignore = true)
    BienTheSanPhamDto toDto(BienTheSanPham entity);
    List<BienTheSanPhamDto> toDtoList(List<BienTheSanPham> entities);

    /**
     * Tên ghép "TênSảnPhẩm - TênMàu / TênSize", cùng định dạng với PhieuKiemKeService.buildTenBienThe.
     * Không có thông tin nào -> trả về mã SKU.
     */
    default String buildTenBienThe(BienTheSanPham bt) {
        if (bt == null) return null;
        StringBuilder sb = new StringBuilder();
        if (bt.getSanPham() != null) {
            sb.append(bt.getSanPham().getTenSanPham());
        }
        if (bt.getMauSac() != null) {
            sb.append(" - ").append(bt.getMauSac().getTenMau());
        }
        if (bt.getSize() != null) {
            sb.append(" / ").append(bt.getSize().getTenSize());
        }
        String result = sb.toString().trim();
        return result.isEmpty() ? bt.getMaSku() : result;
    }
}
