package com.dev.backend.mapper;

import com.dev.backend.dto.response.customize.PhieuXuatKhoSummaryDto;
import com.dev.backend.dto.response.entities.PhieuXuatKhoDto;
import com.dev.backend.entities.PhieuXuatKho;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.springframework.data.domain.Page;

// NguoiDungMapper: người dùng lồng nhau (nguoiXuat, nguoiDuyet, kho.quanLy...) được map đúng avatarUrl.
@Mapper(componentModel = "spring", uses = {NguoiDungMapper.class})
public interface PhieuXuatKhoMapper {
    // Tên trường DTO giữ như cũ cho frontend; nay lấy từ phiếu chuyển kho (bảng phieu_chuyen_kho)
    @Mapping(source = "phieuChuyenKho.id", target = "phieuChuyenKhoGocId")
    @Mapping(source = "phieuChuyenKho.soPhieuChuyen", target = "soPhieuChuyenKhoGoc")
    // Phiếu nhặt của PX-CK chỉ điền ở chi tiết (PhieuXuatKhoService.getDetail), cần tra bảng phiếu nhặt
    @Mapping(target = "phieuNhatId", ignore = true)
    @Mapping(target = "maPhieuNhat", ignore = true)
    @Mapping(target = "trangThaiPhieuNhat", ignore = true)
    PhieuXuatKhoDto toDto(PhieuXuatKho entity);

    default Page<PhieuXuatKhoDto> toDtoPage(Page<PhieuXuatKho> page){
        return page.map(this::toDto);
    }
    @Mapping(source = "id", target = "id")
    @Mapping(source = "soPhieuXuat", target = "soPhieuXuat")
    @Mapping(source = "ngayXuat", target = "ngayXuat")
    @Mapping(source = "trangThai", target = "trangThai")
    @Mapping(source = "ghiChu", target = "ghiChu")
    PhieuXuatKhoSummaryDto toSummaryDto(PhieuXuatKho entity);
}
