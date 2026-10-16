package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.dto.response.entities.YeuCauMuaHangRutGonDto;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.YeuCauMuaHang;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import org.springframework.data.domain.Page;

import java.util.List;

// NguoiDungMapper: người dùng lồng nhau (nguoiTao, nguoiDuyet, khoNhap.quanLy) được map đúng avatarUrl.
// Đã bỏ toEntity(DonMuaHangDto): không nơi nào gọi và map ngược DTO -> entity làm rơi dữ liệu (matKhauHash, quan hệ ngược...).
@Mapper(
        componentModel = MappingConstants.ComponentModel.SPRING,
        uses = {BienTheSanPhamMapper.class, NguoiDungMapper.class}
)
public interface DonMuaHangMapper {
    DonMuaHangDto toDto(DonMuaHang donMuaHang);

    // Yêu cầu nhập hàng gốc: chỉ lấy id, số và ngày tạo (không kéo chi tiết yêu cầu theo đơn mua).
    YeuCauMuaHangRutGonDto toYeuCauMuaHangRutGon(YeuCauMuaHang yeuCauMuaHang);

    List<DonMuaHangDto> toDtoList(List<DonMuaHang> list);

    default Page<DonMuaHangDto> toDtoPage(Page<DonMuaHang> page){
        if(page.isEmpty()) return Page.empty();
        return page.map(this::toDto);
    }
}
