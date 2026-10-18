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
    // Chỉ lấy họ tên người cấp (hiện ở trang chi tiết người dùng), không nhúng cả hồ sơ vào token
    @Mapping(target = "tenNguoiCapQuyen", source = "nguoiCapQuyen.hoTen")
    @Mapping(target = "kho.quanLy", ignore = true)
    PhanQuyenNguoiDungKhoDto toDto(PhanQuyenNguoiDungKho phanQuyenNguoiDungKho);

    // Danh sách này đi vào token đăng nhập (mỗi quyền một phần tử): bỏ người cấp để token không phình to.
    // Ai cấp, lúc nào đã có trong lịch sử phân quyền.
    @Mapping(target = "nguoiCap", ignore = true)
    ChiTietQuyenKhoDto toChiTietQuyenKhoDto(ChiTietQuyenKho chiTietQuyenKho);


    List<PhanQuyenNguoiDungKhoDto> toDtoList(List<PhanQuyenNguoiDungKho> list);


    default Page<PhanQuyenNguoiDungKhoDto> toDtoPage(Page<PhanQuyenNguoiDungKho> page) {
        return page.map(this::toDto);
    }
}
