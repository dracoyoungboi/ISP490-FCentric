package com.dev.backend.mapper;


import com.dev.backend.dto.response.entities.ChiTietQuyenKhoDto;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.ChiTietQuyenKho;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.springframework.data.domain.Page;


import java.util.List;


// Đã bỏ toEntity(PhanQuyenNguoiDungKhoDto): không nơi nào gọi.
// Không dùng NguoiDungMapper ở đây vì NguoiDungMapper đã uses mapper này -> tránh vòng phụ thuộc Spring.
@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface PhanQuyenNguoiDungKhoMapper {
    @Mapping(target = "nguoiDung", ignore = true)
    @Mapping(target = "nguoiCapQuyen", ignore = true)
    @Mapping(target = "kho.quanLy", ignore = true)
    PhanQuyenNguoiDungKhoDto toDto(PhanQuyenNguoiDungKho phanQuyenNguoiDungKho);

    // Người cấp quyền chỉ cần thông tin cơ bản: avatar và kho đang phụ trách không áp dụng ở ngữ cảnh này.
    @Mapping(target = "nguoiCap.avatarUrl", ignore = true)
    @Mapping(target = "nguoiCap.khoPhuTrachActive", ignore = true)
    ChiTietQuyenKhoDto toChiTietQuyenKhoDto(ChiTietQuyenKho chiTietQuyenKho);


    List<PhanQuyenNguoiDungKhoDto> toDtoList(List<PhanQuyenNguoiDungKho> list);


    default Page<PhanQuyenNguoiDungKhoDto> toDtoPage(Page<PhanQuyenNguoiDungKho> page) {
        if (page.isEmpty()) return Page.empty();
        return page.map(this::toDto);
    }
}
