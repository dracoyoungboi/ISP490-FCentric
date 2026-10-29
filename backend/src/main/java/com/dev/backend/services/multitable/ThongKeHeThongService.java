package com.dev.backend.services.multitable;

import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.TonKhoChiTietDTO;
import org.springframework.http.ResponseEntity;

import java.util.List;

public interface ThongKeHeThongService {

    ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> findTonKhoChiTietByKho(Integer khoId);
    ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> findTonKhoChiTietByBienThe(Integer bienTheId);

    ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> findTonKhoChiTietByBienTheAndKho(Integer bienTheId, Integer khoId);

    ResponseEntity<ResponseData<List<TonKhoProjection>>> tonKhoTongHop(Integer khoId, String keyword);
    List<TonKhoProjection> getTonKhoTongHop(Integer khoId, String keyword);
}
