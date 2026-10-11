package com.dev.backend.services;

import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.request.KenhBanHangCaiDatRequest;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface KenhBanHangDongBoService {

    TaiSanPhamResultDto taiSanPhamTuKenh(String maKenh);

    TuDongLienKetResultDto tuDongLienKet(String maKenh);

    Page<LienKetSanPhamDto> filterLienKet(String maKenh, String search, String trangThai, Pageable pageable);

    LienKetSanPhamDto capNhatLienKet(Integer lienKetId, CapNhatLienKetRequest request);

    DayTonResultDto dayTonKhoLenKenh(String maKenh, DayTonKenhRequest request);

    void dayTonKhoKhanCap(Integer bienTheSanPhamId);

    DongBoTongQuanDto getTongQuan(String maKenh);

    List<BienTheOptionDto> timBienThe(String q, int limit);

    List<ShopifyLocationDto> getLocations(String maKenh);

    DongBoTongQuanDto luuCaiDat(String maKenh, KenhBanHangCaiDatRequest request);

    Page<NhatKyDongBoDto> filterNhatKy(String maKenh, String loai, String trangThai, String search, Pageable pageable);

    NhatKyDongBoDto getNhatKyDetail(Integer id);

    LayDonResultDto layDonHang(String maKenh, LayDonHangKenhRequest request);

    DayTonResultDto dongBoTatCa();

    LienKetSanPhamDto thuLai(Integer lienKetId);
}

