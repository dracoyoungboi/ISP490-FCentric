package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.LichSuGiaoDichKhoDto;
import com.dev.backend.services.impl.entities.LichSuGiaoDichKhoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import com.dev.backend.i18n.ThongDiep;

@RestController
@RequestMapping("/api/lich-su-giao-dich-kho")
@RequiredArgsConstructor
public class LichSuGiaoDichKhoController {

    private final LichSuGiaoDichKhoService service;

    @GetMapping
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData> getList() {
        List<LichSuGiaoDichKhoDto> list = service.getAll();
        return ResponseEntity.ok(ResponseData.builder()
                .status(200)
                .data(list)
                .message(ThongDiep.dich("chungTuKho.layLichSuGiaoDichThanhCong"))
                .build());
    }

    @GetMapping("/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData> getChiTiet(@PathVariable Integer id) {
        LichSuGiaoDichKhoDto dto = service.getChiTiet(id);
        return ResponseEntity.ok(ResponseData.builder()
                .status(200)
                .data(dto)
                .message(ThongDiep.dich("chungTuKho.layChiTietLichSuThanhCong"))
                .build());
    }
}