package com.dev.backend.services;

import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;

import java.util.List;

public interface BienBanTraHangService {
    BienBanTraHangDto layTheoPhieuNhap(Integer phieuNhapKhoId);
    BienBanTraHangDto phatHanh(Integer phieuNhapKhoId, PhatHanhBienBanRequest request, Integer nguoiTaoId);
    List<BienBanTraHangDto> dsTheoNhaCungCap(Integer nhaCungCapId);
    BienBanTraHangDto chiTiet(Integer id);
}

