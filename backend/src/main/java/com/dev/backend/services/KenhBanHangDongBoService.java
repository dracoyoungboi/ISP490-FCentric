package com.dev.backend.services;

import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface KenhBanHangDongBoService {

    TaiSanPhamResultDto taiSanPhamTuKenh(String maKenh);

    TuDongLienKetResultDto tuDongLienKet(String maKenh);

    Page<LienKetSanPhamDto> filterLienKet(String maKenh, String search, String trangThai, Pageable pageable);

    LienKetSanPhamDto capNhatLienKet(Integer lienKetId, CapNhatLienKetRequest request);

    DayTonResultDto dayTonKhoLenKenh(String maKenh, DayTonKenhRequest request);

    void dayTonKhoKhanCap(Integer bienTheSanPhamId);

    DongBoTongQuanDto getTongQuan(String maKenh);
}

