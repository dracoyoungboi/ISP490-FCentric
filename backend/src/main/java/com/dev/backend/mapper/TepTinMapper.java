package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.TepTinDto;
import com.dev.backend.entities.TepTin;
import com.dev.backend.utils.PublicAssetUrl;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import org.springframework.data.domain.Page;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface TepTinMapper {
    default TepTinDto toDto(TepTin tepTin) {
        if (tepTin == null) {
            return null;
        }
        // ==============================================================
        // OPTION: CHẠY LOCAL (Chuyển tất cả link về localhost:9000)
        // ==============================================================
        String duongDan = tepTin.getDuongDan();
            if (duongDan != null) {
        if (duongDan.startsWith("http://171.244.142.43:9000")) {
            duongDan = "http://localhost:9000" + duongDan.substring(26);
        } else if (duongDan.startsWith("https://minio.slmglobal.vn")) {
           duongDan = "http://localhost:9000" + duongDan.substring(26);
       }
    }

    //     // nếu đường dẫn bắt đầu bằng http://171.244.142.43:9000 thay bằng https://minio.slmglobal.vn
    //     String duongDan = PublicAssetUrl.toHttps(tepTin.getDuongDan());
        
        return TepTinDto.builder()
                .id(tepTin.getId())
                .tenTepGoc(tepTin.getTenTepGoc())
                .tenTaiLen(tepTin.getTenTaiLen())
                .tenLuuTru(tepTin.getTenLuuTru())
                .duongDan(duongDan)
                .loaiTepTin(tepTin.getLoaiTepTin())
                .duoiTep(tepTin.getDuoiTep())
                .kichCo(tepTin.getKichCo())
                .moTa(tepTin.getMoTa())
                .ngayTao(tepTin.getNgayTao())
                .ngayCapNhat(tepTin.getNgayCapNhat())
                .trangThai(tepTin.getTrangThai())
                .build();
    }

    default Page<TepTinDto> toDtoPage(Page<TepTin> tepTinPage) {
        if (tepTinPage == null) {
            return Page.empty();
        }
        return tepTinPage.map(this::toDto);
    }
}