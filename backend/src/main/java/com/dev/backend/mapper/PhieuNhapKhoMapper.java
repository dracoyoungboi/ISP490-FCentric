package com.dev.backend.mapper;
import com.dev.backend.dto.response.entities.PhieuNhapKhoDto;
import com.dev.backend.entities.PhieuNhapKho;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import java.util.List;

@Mapper(componentModel = "spring")
public interface PhieuNhapKhoMapper {

    // Trước đây thiếu 3 mapping id -> API trả donMuaHangId/nhaCungCapId/khoId = null
    @Mapping(source = "donMuaHang.id", target = "donMuaHangId")
    @Mapping(source = "donMuaHang.soDonMua", target = "soDonMua")
    @Mapping(source = "nhaCungCap.id", target = "nhaCungCapId")
    @Mapping(source = "nhaCungCap.tenNhaCungCap", target = "tenNhaCungCap")
    @Mapping(source = "kho.id", target = "khoId")
    @Mapping(source = "kho.tenKho", target = "tenKho")
    @Mapping(source = "phieuChuyenKhoGoc.id", target = "phieuXuatGocId")
    @Mapping(source = "phieuChuyenKhoGoc.soPhieuXuat", target = "soPhieuXuatGoc")
    PhieuNhapKhoDto toDto(PhieuNhapKho entity);

    List<PhieuNhapKhoDto> toDtoList(List<PhieuNhapKho> entities);
}
