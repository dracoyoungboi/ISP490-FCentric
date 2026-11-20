package com.dev.backend.mapper;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;

// NguoiDungMapper: nguoiTao, nguoiDuyet, khoXuat.quanLy được map đúng avatarUrl.
@Mapper(componentModel = "spring", uses = {NguoiDungMapper.class})
public interface DonBanHangMapper {

    DonBanHangDto toDto(DonBanHang entity);

    @AfterMapping
    default void maskSensitiveInfo(@MappingTarget DonBanHangDto dto) {
        if (dto == null || dto.getGhiChu() == null) return;
        if (dto.getGhiChu().contains("[KHÁCH YÊU CẦU HỦY]")) {
            dto.setYeuCauHuy(true);
        }
        boolean laShopee = dto.getKenhBanHang() != null && OmnichannelOrderSyncJob.isShopee(dto.getKenhBanHang().getMaKenh());
        boolean dangNhap = dto.getTrangThai() == null || Integer.valueOf(ITrangThaiDonBanHang.NHAP).equals(dto.getTrangThai());
        if (laShopee && dangNhap && dto.getGhiChu().contains(OmnichannelOrderSyncJob.TAG_SHOPEE_CHO_XAC_NHAN)) {
            dto.setChoXacNhanSan(true);
        }
    }
}
