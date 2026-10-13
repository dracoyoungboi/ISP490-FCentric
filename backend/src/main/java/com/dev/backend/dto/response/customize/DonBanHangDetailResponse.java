package com.dev.backend.dto.response.customize;

import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.dto.response.entities.ChiTietDonBanHangDto;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class DonBanHangDetailResponse {
    private DonBanHangDto donBanHang;
    private List<ChiTietDonBanHangDto> chiTiet;
    private List<PhieuXuatKhoSummaryDto> phieuXuatKhoList;
}
