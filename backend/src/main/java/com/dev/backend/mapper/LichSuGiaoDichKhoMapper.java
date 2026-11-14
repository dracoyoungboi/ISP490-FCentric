package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.LichSuGiaoDichKhoDto;
import com.dev.backend.entities.LichSuGiaoDichKho;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.ReportingPolicy;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface LichSuGiaoDichKhoMapper {

    /**
     * Câu sổ của dòng chuyển kệ nội bộ, do ChuyenKeNoiBoService tự ghi: "MV-20261112-0003: 1-01-01 → B-03-03".
     * Đổi mẫu câu ở đó thì phải đổi biểu thức này (dòng cũ vẫn theo mẫu cũ).
     */
    Pattern LO_TRINH_KE = Pattern.compile("^(\\S+): (.+?) → (.+)$");
    @Mapping(target = "tenSanPham",      source = "bienTheSanPham.sanPham.tenSanPham")
    @Mapping(target = "maSku",           source = "bienTheSanPham.maSku")
    @Mapping(target = "maLo",            source = "loHang.maLo")
    @Mapping(target = "khoId",           source = "kho.id")
    @Mapping(target = "tenKho",          source = "kho.tenKho")
    @Mapping(target = "khoChuyenDenId",  source = "khoChuyenDen.id")
    @Mapping(target = "tenKhoChuyenDen", source = "khoChuyenDen.tenKho")
    @Mapping(target = "nguoiDungTen",    source = "nguoiDung.tenDangNhap")
    LichSuGiaoDichKhoDto toDto(LichSuGiaoDichKho entity);

    /** Dòng chuyển kệ: tách mã phiếu, kệ nguồn, kệ đích từ câu sổ. Câu không đúng mẫu thì để trống (giao diện hiện ghi chú như cũ). */
    @AfterMapping
    default void tachLoTrinhKe(LichSuGiaoDichKho entity, @MappingTarget LichSuGiaoDichKhoDto dto) {
        if (!"chuyen_ke_noi_bo".equals(entity.getLoaiGiaoDich()) || entity.getGhiChu() == null) return;
        Matcher m = LO_TRINH_KE.matcher(entity.getGhiChu().trim());
        if (!m.matches()) return;
        dto.setMaChungTu(m.group(1));
        dto.setKeNguon(LichSuGiaoDichKhoDto.KeGiaoDich.chiMa(m.group(2).trim()));
        dto.setKeDich(LichSuGiaoDichKhoDto.KeGiaoDich.chiMa(m.group(3).trim()));
    }
}