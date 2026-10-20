package com.dev.backend.services;

import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;

import com.dev.backend.entities.BienBanTraHangNcc;

import java.util.List;

public interface BienBanTraHangService {
    BienBanTraHangDto layTheoPhieuNhap(Integer phieuNhapKhoId);
    BienBanTraHangDto phatHanh(Integer phieuNhapKhoId, PhatHanhBienBanRequest request, Integer nguoiTaoId);
    List<BienBanTraHangDto> dsTheoNhaCungCap(Integer nhaCungCapId);
    BienBanTraHangDto chiTiet(Integer id);

    /**
     * Biên bản còn khớp hàng không đạt đang lưu theo lô của phiếu (cùng lô, cùng lý do, cùng số lượng).
     * Lập biên bản rồi xóa / khóa lại lô lỗi thì không còn khớp: phải lập lại trước khi nhập kho.
     */
    boolean khopHangLoiHienTai(BienBanTraHangNcc bienBan);
}

