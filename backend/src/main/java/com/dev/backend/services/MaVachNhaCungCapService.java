package com.dev.backend.services;

import com.dev.backend.dto.request.inbound.MaVachLienKetRequest;
import com.dev.backend.dto.response.inbound.MaVachNhaCungCapDto;
import com.dev.backend.dto.response.inbound.TraCuuMaVachResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface MaVachNhaCungCapService {
    Page<MaVachNhaCungCapDto> timKiem(String q, Integer nhaCungCapId, Pageable pageable);
    TraCuuMaVachResponse traCuu(String maVach, Integer nhaCungCapId);
    MaVachNhaCungCapDto lienKet(MaVachLienKetRequest request);
    void huyLienKet(Integer id);
}

