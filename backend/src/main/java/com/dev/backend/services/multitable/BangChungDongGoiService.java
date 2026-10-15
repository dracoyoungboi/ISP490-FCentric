package com.dev.backend.services.multitable;

import com.dev.backend.dto.response.customize.BangChungDongGoiDto;
import com.dev.backend.dto.response.customize.ThongTinBangChungDonDto;
import com.dev.backend.entities.DonBanHang;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collection;
import java.util.Map;

public interface BangChungDongGoiService {

    ThongTinBangChungDonDto layThongTinBangChung(Integer donBanHangId);

    BangChungDongGoiDto uploadBangChung(Integer donBanHangId, MultipartFile file, String loaiBangChung, Integer thoiLuongGiay);

    void xoaBangChung(Integer bangChungId);

    boolean kiemTraDaDuBangChung(DonBanHang don);

    Map<Integer, Boolean> kiemTraDaDuBangChungTheoDanhSachDon(Collection<Integer> donBanHangIds);

    Map<Integer, Integer> demSoLuongBangChungTheoDanhSachDon(Collection<Integer> donBanHangIds);
}
