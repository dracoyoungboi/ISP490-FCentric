package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.inbound.MaVachLienKetRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.inbound.MaVachNhaCungCapDto;
import com.dev.backend.dto.response.inbound.TraCuuMaVachResponse;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.MaVachNhaCungCapService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ma-vach-nha-cung-cap")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MaVachNhaCungCapController {

    MaVachNhaCungCapService maVachNhaCungCapService;

    // Nhân viên mua hàng có trang Mã vạch NCC trong menu (chỉ xem, không gỡ liên kết)
    @GetMapping
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<MaVachNhaCungCapDto>>> timKiem(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer nhaCungCapId,
            @PageableDefault(size = 20, sort = "ngayTao", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<MaVachNhaCungCapDto> page = maVachNhaCungCapService.timKiem(q, nhaCungCapId, pageable);
        return ResponseEntity.ok(ResponseData.<Page<MaVachNhaCungCapDto>>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(page)
                .build());
    }

    @GetMapping("/tra")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<TraCuuMaVachResponse>> tra(
            @RequestParam String maVach,
            @RequestParam(required = false) Integer nhaCungCapId
    ) {
        TraCuuMaVachResponse res = maVachNhaCungCapService.traCuu(maVach, nhaCungCapId);
        return ResponseEntity.ok(ResponseData.<TraCuuMaVachResponse>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(res)
                .build());
    }

    @PostMapping("/tra-cuu")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<TraCuuMaVachResponse>> traCuuPost(
            @RequestBody Map<String, Object> body
    ) {
        // Mã vạch toàn số có thể được gửi dạng số JSON: đọc thành chuỗi; mã NCC phải là số
        Object giaTriMa = body != null ? body.get("maVach") : null;
        if (giaTriMa != null && !(giaTriMa instanceof String) && !(giaTriMa instanceof Number)) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Mã vạch không hợp lệ");
        }
        String maVach = giaTriMa != null ? String.valueOf(giaTriMa) : null;
        Object giaTriNcc = body != null ? body.get("nhaCungCapId") : null;
        Integer nhaCungCapId;
        if (giaTriNcc == null) {
            nhaCungCapId = null;
        } else if (giaTriNcc instanceof Integer so) {
            nhaCungCapId = so;
        } else {
            // Chuỗi số ("5") hoặc số JSON lớn: đọc qua chuỗi; số lẻ (5.5), chữ, mảng đều là 400
            try {
                nhaCungCapId = Integer.valueOf(String.valueOf(giaTriNcc).trim());
            } catch (NumberFormatException e) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Mã nhà cung cấp không hợp lệ");
            }
        }
        TraCuuMaVachResponse res = maVachNhaCungCapService.traCuu(maVach, nhaCungCapId);
        return ResponseEntity.ok(ResponseData.<TraCuuMaVachResponse>builder()
                .status(HttpStatus.OK.value())
                .message("Thành công")
                .data(res)
                .build());
    }

    @PostMapping
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<MaVachNhaCungCapDto>> lienKet(@RequestBody MaVachLienKetRequest request) {
        MaVachNhaCungCapDto dto = maVachNhaCungCapService.lienKet(request);
        return ResponseEntity.ok(ResponseData.<MaVachNhaCungCapDto>builder()
                .status(HttpStatus.OK.value())
                .message("Liên kết mã vạch NCC thành công")
                .data(dto)
                .build());
    }

    @DeleteMapping("/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> huyLienKet(@PathVariable Integer id) {
        maVachNhaCungCapService.huyLienKet(id);
        return ResponseEntity.ok(ResponseData.<String>builder()
                .status(HttpStatus.OK.value())
                .message("Hủy liên kết mã vạch thành công")
                .data("SUCCESS")
                .build());
    }
}

