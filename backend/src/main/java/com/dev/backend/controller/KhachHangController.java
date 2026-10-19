package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.KhachHangDetailDto;
import com.dev.backend.dto.response.customize.TongQuanMuaHangKhachDto;
import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.services.impl.entities.DonBanHangService;
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

    @Autowired
    private DonBanHangService donBanHangService;

    @PostMapping("/filter")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
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
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<KhachHangDto>>getById(@PathVariable Integer id){
        KhachHang khachHang = khachHangService.getOne(id).orElseThrow(
                () -> new CommonException("Không tìm thấy khách hàng id: " + id, HttpStatus.NOT_FOUND, null)
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
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> create(@RequestBody KhachHangCreating creating) {
        return khachHangService.create(creating);
    }

    @DeleteMapping("/soft-delete/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
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
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<KhachHangDetailDto>> getDetail(@PathVariable Integer id) {
        KhachHangDetailDto result = khachHangService.getKhachHangDetail(id);

        return ResponseEntity.ok(
                ResponseData.<KhachHangDetailDto>builder()
                        .status(200)
                        .data(result)
                        .message("Success")
                        .build()
        );
    }

    /**
     * Số tổng hợp đơn bán của khách cho trang chi tiết (tổng chi tiêu, số đơn, trung bình, đơn gần nhất).
     * Cùng phạm vi vai trò với danh sách đơn bán: NV bán hàng chỉ tính đơn mình tạo, vai trò kho chỉ tính đơn
     * của kho phụ trách — để số trên đầu trang khớp danh sách đơn bên dưới.
     */
    @GetMapping("/{id}/tong-quan-mua-hang")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<TongQuanMuaHangKhachDto>> getTongQuanMuaHang(@PathVariable Integer id) {
        if (!khachHangService.exists(id)) {
            throw new CommonException("Không tìm thấy khách hàng id: " + id, HttpStatus.NOT_FOUND, null);
        }
        return ResponseEntity.ok(
                ResponseData.<TongQuanMuaHangKhachDto>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(donBanHangService.tongQuanMuaHangCuaKhach(id))
                        .build()
        );
    }

    // Function Edit Customer
    @PutMapping("/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
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
                    IRoleType.quan_ly_kho,
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