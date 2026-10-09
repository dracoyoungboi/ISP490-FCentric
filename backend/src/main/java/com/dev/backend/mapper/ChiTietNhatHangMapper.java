package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.ChiTietNhatHangDto;
import com.dev.backend.entities.ChiTietNhatHang;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ChiTietNhatHangMapper {

    @Mapping(target = "bienTheSanPhamId", source = "bienTheSanPham.id")
    @Mapping(target = "maSku", source = "bienTheSanPham.maSku")
    @Mapping(target = "maVachSku", source = "bienTheSanPham.maVachSku")
    @Mapping(target = "tenSanPham", source = "bienTheSanPham.sanPham.tenSanPham")
    @Mapping(target = "tenMau", source = "bienTheSanPham.mauSac.tenMau")
    @Mapping(target = "maMauHex", source = "bienTheSanPham.mauSac.maMauHex")
    @Mapping(target = "tenSize", source = "bienTheSanPham.size.tenSize")
    @Mapping(target = "tenChatLieu", source = "bienTheSanPham.chatLieu.tenChatLieu")
    @Mapping(target = "anhBienTheUrl", source = "bienTheSanPham.anhBienThe.tepTin.duongDan")
    @Mapping(target = "viTriKho", ignore = true) // NhatHangServiceImpl tự điền vị trí kệ
    ChiTietNhatHangDto toDto(ChiTietNhatHang entity);
}
