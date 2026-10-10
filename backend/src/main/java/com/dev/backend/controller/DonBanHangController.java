package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.DonBanHangCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.BienTheSanPhamSelectDto;
import com.dev.backend.dto.response.customize.DonBanHangDetailResponse;
import com.dev.backend.dto.response.customize.DonBanHangKpiHomNayDto;
import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.mapper.DonBanHangMapper;
import com.dev.backend.services.impl.entities.DonBanHangService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/don-ban-hang")
public class DonBanHangController {

    @Autowired
    private DonBanHangService donBanHangService;

    @Autowired
    private DonBanHangMapper donBanHangMapper;

    @PostMapping("/filter")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<DonBanHangDto>>> filter(
            @RequestBody BaseFilterRequest request
    ) {

        Page<DonBanHang> pageEntity =
                donBanHangService.filter(request);

        return ResponseEntity.ok(
                ResponseData.<Page<DonBanHangDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(pageEntity.map(donBanHangMapper::toDto))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    @GetMapping("/kpi-hom-nay")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<DonBanHangKpiHomNayDto>> getKpiHomNay() {
        return ResponseEntity.ok(
                ResponseData.<DonBanHangKpiHomNayDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(donBanHangService.getKpiHomNay())
                        .message("Lấy chỉ số KPI bán hàng hôm nay thành công")
                        .build()
        );
    }

    @GetMapping("/{id}/detail")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<DonBanHangDetailResponse>> getDetail(
            @PathVariable Integer id
    ) {
        return ResponseEntity.ok(
                ResponseData.<DonBanHangDetailResponse>builder()
                        .status(200)
                        .data(donBanHangService.getDetail(id))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }
    @PutMapping("/{id}/send-to-warehouse")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> sendToWarehouse(
            @PathVariable Integer id
    ) {
        donBanHangService.sendToWarehouse(id);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(200)
                        .data("Success")
                        .message("Đã gửi đơn sang kho")
                        .error(null)
                        .build()
        );
    }
    @PutMapping("/{id}/cancel")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> cancel(
            @PathVariable Integer id
    ) {
        donBanHangService.cancel(id);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(200)
                        .data("Success")
                        .message("Đã hủy đơn bán")
                        .error(null)
                        .build()
        );
    }
    @PostMapping("/create")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<DonBanHangDto>> create(
            @RequestBody DonBanHangCreating request
    ) {

        DonBanHang don = donBanHangService.create(request);
        return ResponseEntity.ok(
                ResponseData.<DonBanHangDto>builder()
                        .status(200)
                        .data(donBanHangMapper.toDto(don))
                        .message("Tạo đơn bán thành công")
                        .build()
        );
    }
    @GetMapping("/variants-for-create")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<BienTheSanPhamSelectDto>>> getVariantsForCreate() {

        return ResponseEntity.ok(
                ResponseData.<List<BienTheSanPhamSelectDto>>builder()
                        .status(200)
                        .data(donBanHangService.getActiveVariantsForSale())
                        .message("Success")
                        .error(null)
                        .build()
        );
    }
    @PutMapping("/{id}/mark-delivered")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> markAsDelivered(
            @PathVariable Integer id
    ) {
        donBanHangService.markAsDelivered(id);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(200)
                        .data("Success")
                        .message("Đã xác nhận giao hàng thành công")
                        .error(null)
                        .build()
        );
    }
    @PutMapping("/{id}/convert-to-order")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> convertToOrder(
            @PathVariable Integer id,
            @RequestBody java.util.Map<String, Object> body
    ) {
        Integer khoXuatId = body.get("khoXuatId") != null ? Integer.valueOf(body.get("khoXuatId").toString()) : null;
        String ghiChu = body.get("ghiChu") != null ? body.get("ghiChu").toString() : null;
        String diaChi = body.get("diaChiGiaoHang") != null ? body.get("diaChiGiaoHang").toString() : null;
        java.math.BigDecimal phiVanChuyen = body.get("phiVanChuyen") != null ? new java.math.BigDecimal(body.get("phiVanChuyen").toString()) : null;

        donBanHangService.convertToOrder(id, khoXuatId, ghiChu, diaChi, phiVanChuyen);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(200)
                        .data("Success")
                        .message("Đã chấp nhận báo giá và chuyển thành đơn bán hàng")
                        .error(null)
                        .build()
        );
    }

    @PutMapping("/{id}/reject-quote")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> rejectQuote(
            @PathVariable Integer id,
            @RequestBody java.util.Map<String, String> body
    ) {
        String reason = body.get("reason");
        donBanHangService.rejectQuote(id, reason);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(200)
                        .data("Success")
                        .message("Đã từ chối báo giá thành công")
                        .error(null)
                        .build()
        );
    }

    @PutMapping("/{id}/return")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> returnOrder(
            @PathVariable Integer id
    ) {
        donBanHangService.returnOrder(id);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(200)
                        .data("Success")
                        .message("Đã chuyển trạng thái đơn hàng thành Bị hoàn trả")
                        .error(null)
                        .build()
        );
    }
}