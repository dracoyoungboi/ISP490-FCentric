package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.ChiTietDonBanHangDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.ChiTietDonBanHang;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ChiTietDonBanHangMapper {
    @Mapping(source = "bienTheSanPham.id", target = "bienTheSanPhamId")
    @Mapping(source = "bienTheSanPham.maSku", target = "sku")
    @Mapping(expression = "java(tenHienThi(entity))", target = "tenSanPham")
    @Mapping(source = "bienTheSanPham.sanPham.donViTinh", target = "donViTinh")
    @Mapping(expression = "java(com.dev.backend.utils.HienThiBienThe.tenSanPham(entity.getBienTheSanPham()))", target = "tenSanPhamGoc")
    @Mapping(expression = "java(com.dev.backend.utils.HienThiBienThe.sanPhamId(entity.getBienTheSanPham()))", target = "sanPhamId")
    @Mapping(expression = "java(com.dev.backend.utils.HienThiBienThe.tenMau(entity.getBienTheSanPham()))", target = "tenMau")
    @Mapping(expression = "java(com.dev.backend.utils.HienThiBienThe.maMauHex(entity.getBienTheSanPham()))", target = "maMauHex")
    @Mapping(expression = "java(com.dev.backend.utils.HienThiBienThe.kichCo(entity.getBienTheSanPham()))", target = "kichCo")
    @Mapping(expression = "java(com.dev.backend.utils.HienThiBienThe.anh(entity.getBienTheSanPham()))", target = "anh")
    ChiTietDonBanHangDto toDto(ChiTietDonBanHang entity);

    /**
     * "Áo thun nam cổ tròn / Trắng / L" — đủ màu và cỡ như tên biến thể ở phiếu xuất kho, để hóa đơn
     * (nhất là khổ K80 không in SKU) phân biệt được hai cỡ của cùng một mẫu. Thiếu phần nào thì bỏ phần đó.
     */
    default String tenHienThi(ChiTietDonBanHang entity) {
        BienTheSanPham bienThe = entity.getBienTheSanPham();
        if (bienThe == null) return null;
        StringBuilder ten = new StringBuilder(bienThe.getSanPham() != null ? bienThe.getSanPham().getTenSanPham() : "");
        if (bienThe.getMauSac() != null && bienThe.getMauSac().getTenMau() != null) {
            ten.append(" / ").append(bienThe.getMauSac().getTenMau());
        }
        if (bienThe.getSize() != null && bienThe.getSize().getTenSize() != null) {
            ten.append(" / ").append(bienThe.getSize().getTenSize());
        }
        return ten.toString();
    }
}
