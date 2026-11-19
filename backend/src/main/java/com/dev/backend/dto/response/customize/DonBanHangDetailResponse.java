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
    /** Phiếu nhặt mà đơn đang thuộc (nếu có) — màn đơn ẩn Hủy / Tạo phiếu xuất khi phiếu nhặt còn chạy. */
    private Integer phieuNhatHangId;
    private String maPickList;
    private String trangThaiPhieuNhat;
    /** Lần thu tiền tại quầy (đơn POS); null với đơn bán thường / đơn sàn. */
    private ThanhToanTaiQuayDto thanhToanTaiQuay;
}
