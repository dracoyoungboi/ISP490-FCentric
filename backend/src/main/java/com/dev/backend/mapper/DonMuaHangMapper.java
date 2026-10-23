package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.dto.response.entities.YeuCauMuaHangRutGonDto;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.YeuCauMuaHang;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import jakarta.persistence.EntityNotFoundException;
import org.hibernate.LazyInitializationException;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;
import org.springframework.data.domain.Page;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

// NguoiDungMapper: người dùng lồng nhau (nguoiTao, nguoiDuyet, khoNhap.quanLy) được map đúng avatarUrl.
// Đã bỏ toEntity(DonMuaHangDto): không nơi nào gọi và map ngược DTO -> entity làm rơi dữ liệu (matKhauHash, quan hệ ngược...).
// YeuCauMuaHangMapper dùng mapper này cho YeuCauMuaHangDto.donMuaHangs, nên cờ máy chủ tính có ở cả hai nơi.
@Mapper(
        componentModel = MappingConstants.ComponentModel.SPRING,
        uses = {BienTheSanPhamMapper.class, NguoiDungMapper.class}
)
public interface DonMuaHangMapper {

    @Mapping(target = "khongDuocChon", ignore = true)
    @Mapping(target = "chuaGuiDuocYeuCau", ignore = true)
    DonMuaHangDto toDto(DonMuaHang donMuaHang);

    /**
     * Yêu cầu nhập hàng gốc: chỉ id, số, ngày tạo, trạng thái (không kéo chi tiết yêu cầu theo đơn mua).
     * Đơn cũ trỏ tới yêu cầu không còn (không có khóa ngoại): trả null thay vì làm hỏng cả trang danh sách.
     */
    default YeuCauMuaHangRutGonDto toYeuCauMuaHangRutGon(YeuCauMuaHang yeuCauMuaHang) {
        if (yeuCauMuaHang == null) return null;
        try {
            return YeuCauMuaHangRutGonDto.builder()
                    .id(yeuCauMuaHang.getId())
                    .soYeuCauMuaHang(yeuCauMuaHang.getSoYeuCauMuaHang())
                    .ngayTao(yeuCauMuaHang.getNgayTao())
                    .trangThai(yeuCauMuaHang.getTrangThai())
                    .build();
        } catch (EntityNotFoundException e) {
            return null;
        }
    }

    List<DonMuaHangDto> toDtoList(List<DonMuaHang> list);

    default Page<DonMuaHangDto> toDtoPage(Page<DonMuaHang> page){
        return page.map(this::toDto);
    }

    /** Cờ do máy chủ tính (K1 khongDuocChon, K11 chuaGuiDuocYeuCau) và số báo giá khác đang chờ của cùng yêu cầu. */
    @AfterMapping
    default void boSungCoMayChuTinh(DonMuaHang don, @MappingTarget DonMuaHangDto dto) {
        if (don == null || dto == null) return;
        Integer trangThaiYeuCau = dto.getYeuCauMuaHang() == null ? null : dto.getYeuCauMuaHang().getTrangThai();
        dto.setKhongDuocChon(DonMuaHangService.khongDuocChon(don, trangThaiYeuCau));
        dto.setChuaGuiDuocYeuCau(DonMuaHangService.chuaGuiDuocYeuCau(don, trangThaiYeuCau, Instant.now()));
        if (dto.getYeuCauMuaHang() != null) {
            dto.getYeuCauMuaHang().setSoBaoGiaDangCho(soBaoGiaKhacDangCho(don));
        }
    }

    /** Số đơn khác cùng yêu cầu đang ở 2 (không tính đơn này); null nếu không đọc được danh sách đơn của yêu cầu. */
    static Integer soBaoGiaKhacDangCho(DonMuaHang don) {
        try {
            YeuCauMuaHang yeuCau = don.getYeuCauMuaHang();
            List<DonMuaHang> cacDon = yeuCau == null ? null : yeuCau.getDonMuaHangs();
            if (cacDon == null) return null;
            return (int) cacDon.stream()
                    .filter(d -> d != null && !Objects.equals(d.getId(), don.getId())
                            && Objects.equals(d.getTrangThai(), DonMuaHangService.TRANG_THAI_CHO_BAO_GIA))
                    .count();
        } catch (EntityNotFoundException | LazyInitializationException e) {
            return null;
        }
    }
}
