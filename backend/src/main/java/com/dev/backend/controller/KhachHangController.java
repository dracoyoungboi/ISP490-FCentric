package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.services.impl.entities.KhachHangService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import com.dev.backend.dto.request.KhachHangUpdating;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/khach-hang")
public class KhachHangController {

    @Autowired
    private KhachHangService khachHangService;

    @Autowired
    private KhachHangMapper khachHangMapper;

    @PostMapping("/filter")
    @RequireAuth(
            roles = {
                    IRoleType.nhan_vien_ban_hang
            }
    )
    public ResponseEntity<ResponseData<Page<KhachHangDto>>> filter(@RequestBody BaseFilterRequest filter) {
        return ResponseEntity.ok(
                ResponseData.<Page<KhachHangDto>>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(
                                khachHangMapper.toDtoPage(khachHangService.filter(filter))
                        )
                        .build()
        );
    }

    @GetMapping("/get-by-id/{id}")
    public ResponseEntity<ResponseData<KhachHangDto>>getById(@PathVariable Integer id){
        KhachHang khachHang = khachHangService.getOne(id).orElseThrow(
                () -> new CommonException("Không tìm thấy khách hàng id: " + id)
        );

        return ResponseEntity.ok(
                ResponseData.<KhachHangDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(
                                khachHangMapper.toDto(khachHang)
                        )
                        .build()
        );
    }

    @PostMapping("/create")
    public ResponseEntity<ResponseData<String>> create(@RequestBody KhachHangCreating creating) {
        return khachHangService.create(creating);
    }

    @DeleteMapping("/soft-delete/{id}")
    public ResponseEntity<ResponseData<String>> softDelete(@PathVariable Integer id) {
        KhachHang khachHang = khachHangService.getOne(id).orElseThrow(
                () -> new CommonException("Không tìm thấy khách hàng id: " + id)
        );

        khachHang.setTrangThai(0);
        khachHangService.update(khachHang.getId(), khachHang);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data("Success")
                        .build()
        );
    }
    // Function Customer Details
    @GetMapping("/{id}")
    public ResponseEntity<ResponseData> getId(@PathVariable Integer id) {
        KhachHangDto dto = khachHangService.findByIdDto(id);
        return ResponseEntity.ok(ResponseData.builder()
                .status(200)
                .data(dto)
                .message("Lấy chi tiết khách hàng thành công")
                .build());
    }

    // Function Edit Customer
    @PutMapping("/{id}")
    public ResponseEntity<ResponseData> update(@PathVariable Integer id, @RequestBody KhachHangUpdating updating) {
        KhachHangDto dto = khachHangService.update(id, updating);
        return ResponseEntity.ok(ResponseData.builder()
                .status(200)
                .data(dto)
                .message("Cập nhật khách hàng thành công")
                .build());
    }
    @GetMapping("/for-sales-order")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<KhachHangDto>>> getForSalesOrder() {

        List<KhachHangDto> list = khachHangService.getAllActiveForSales();

        return ResponseEntity.ok(
                ResponseData.<List<KhachHangDto>>builder()
                        .status(200)
                        .data(list)
                        .message("Success")
                        .error(null)
                        .build()
        );
    }
}