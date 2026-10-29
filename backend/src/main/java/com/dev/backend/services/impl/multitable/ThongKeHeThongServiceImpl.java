package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.TonKhoProjection;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.TonKhoChiTietDTO;
import com.dev.backend.repository.TonKhoTongHopRepository;
import com.dev.backend.services.impl.entities.TonKhoTheoLoService;
import com.dev.backend.services.multitable.ThongKeHeThongService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class ThongKeHeThongServiceImpl implements ThongKeHeThongService {

    @Autowired
    private TonKhoTheoLoService tonKhoTheoLoService;
    @Autowired
    private TonKhoTongHopRepository tonKhoTongHopRepository;


    @Override
    public ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> findTonKhoChiTietByKho(Integer khoId) {
        return ResponseEntity.ok(
                ResponseData.<List<TonKhoChiTietDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .data(tonKhoTheoLoService.findTonKhoChiTietByKho(khoId))
                        .message("Success")
                        .build()
        );
    }

    @Override
    public ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> findTonKhoChiTietByBienThe(Integer bienTheId) {
        return ResponseEntity.ok(
                ResponseData.<List<TonKhoChiTietDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .data(tonKhoTheoLoService.findTonKhoChiTietByBienThe(bienTheId))
                        .message("Success")
                        .build()
        );
    }

    @Override
    public ResponseEntity<ResponseData<List<TonKhoChiTietDTO>>> findTonKhoChiTietByBienTheAndKho(Integer bienTheId, Integer khoId) {
        return ResponseEntity.ok(
                ResponseData.<List<TonKhoChiTietDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .data(tonKhoTheoLoService.findTonKhoChiTietByBienTheAndKho(bienTheId, khoId))
                        .message("Success")
                        .build()
        );
    }

    //dùng dể search theo SKU, mã SP, tên sản phẩm (truyền ID kho vào)
    @Override
    public ResponseEntity<ResponseData<List<TonKhoProjection>>> tonKhoTongHop(Integer khoId, String keyword) {
        return ResponseEntity.ok(
                ResponseData.<List<TonKhoProjection>>builder()
                        .status(HttpStatus.OK.value())
                        .data(getTonKhoTongHop(khoId, keyword))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    // lấy toàn bộ danh sách các biến thể để show ra tồn kho tổng hợp
    @Override
    public List<TonKhoProjection> getTonKhoTongHop(Integer khoId, String keyword) {
        return tonKhoTongHopRepository.findTonKhoTongHop(khoId, keyword);
    }
}
