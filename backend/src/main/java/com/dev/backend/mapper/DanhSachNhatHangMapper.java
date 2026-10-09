package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.DanhSachNhatHangDto;
import com.dev.backend.entities.DanhSachNhatHang;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = {ChiTietNhatHangMapper.class})
public interface DanhSachNhatHangMapper {

    @Mapping(target = "khoXuatId", source = "khoXuat.id")
    @Mapping(target = "tenKhoXuat", source = "khoXuat.tenKho")
    @Mapping(target = "nguoiNhatId", source = "nguoiNhat.id")
    @Mapping(target = "tenNguoiNhat", source = "nguoiNhat.hoTen")
    @Mapping(target = "tongDonHang", ignore = true)
    @Mapping(target = "tongSku", ignore = true)
    @Mapping(target = "tongSoLuongCanNhat", ignore = true)
    @Mapping(target = "tongSoLuongDaQuet", ignore = true)
    @Mapping(target = "danhSachMaDonHang", ignore = true)
    @Mapping(target = "phanTramHoanThanh", ignore = true) // NhatHangServiceImpl tự tính
    @Mapping(target = "coTheHoanTat", ignore = true)      // NhatHangServiceImpl tự tính
    DanhSachNhatHangDto toDto(DanhSachNhatHang entity);
}

