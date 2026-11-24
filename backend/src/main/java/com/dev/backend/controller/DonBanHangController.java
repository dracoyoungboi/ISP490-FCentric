package com.dev.backend.controller;

import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.LyDoHuyRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.BienTheSanPhamSelectDto;
import com.dev.backend.dto.response.customize.DonBanHangDetailResponse;
import com.dev.backend.dto.response.customize.DonBanHangKpiHomNayDto;
import com.dev.backend.dto.response.customize.KhoKhaDungDto;
import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.mapper.DonBanHangMapper;
import com.dev.backend.services.impl.entities.DonBanHangService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import com.dev.backend.dto.response.customize.VanDonSanDto;
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

    // Có doanh thu hôm nay toàn hệ thống: chỉ quản trị viên, nhân viên bán hàng (UC 11.3); giao diện hiện không gọi
    @GetMapping("/kpi-hom-nay")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.nhan_vien_ban_hang})
    public ResponseEntity<ResponseData<DonBanHangKpiHomNayDto>> getKpiHomNay() {
        return ResponseEntity.ok(
                ResponseData.<DonBanHangKpiHomNayDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(donBanHangService.getKpiHomNay())
                        .message(ThongDiep.dich("banHang.layKpiHomNayThanhCong"))
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

    @GetMapping("/{id}/kho-kha-dung")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<List<KhoKhaDungDto>>> getKhoKhaDung(
            @PathVariable Integer id
    ) {
        return ResponseEntity.ok(
                ResponseData.<List<KhoKhaDungDto>>builder()
                        .status(200)
                        .data(donBanHangService.getKhoKhaDungChoDonHang(id))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    // Quản lý kho chỉ qua cổng với đơn Shopify ở Kho Tổng (DonBanHangService.duocDieuTietDonSan kiểm chặt); QTV/NVBH giữ nguyên.
    @PutMapping("/{id}/send-to-warehouse")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.quan_ly_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> sendToWarehouse(
            @PathVariable Integer id,
            @RequestBody(required = false) com.dev.backend.dto.request.SendToWarehouseRequest request
    ) {
        Integer khoId = request != null ? request.getKhoId() : null;
        boolean thuCongKhiLoi = request != null && Boolean.TRUE.equals(request.getThuCongKhiLoi());
        String canhBaoThieuTon = donBanHangService.sendToWarehouse(id, khoId, thuCongKhiLoi);
        boolean coCanhBaoThieuTon = canhBaoThieuTon != null && !canhBaoThieuTon.isBlank();

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(200)
                        .data(coCanhBaoThieuTon ? "CANH_BAO_THIEU_TON" : "Success")
                        .message(coCanhBaoThieuTon ? canhBaoThieuTon : ThongDiep.dich("banHang.daGuiDonSangKho"))
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
            @PathVariable Integer id,
            @RequestBody(required = false) LyDoHuyRequest body
    ) {
        donBanHangService.cancel(id, LyDoHuyRequest.batBuoc(body));

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(200)
                        .data("Success")
                        .message(ThongDiep.dich("banHang.daHuyDonBan"))
                        .error(null)
                        .build()
        );
    }
    @GetMapping("/variants-for-create")
    @RequireAuth(
            // nhan_vien_kho: màn Tạo phiếu chuyển kho (POST /phieu-chuyen-kho/create mở cho nhân viên kho) cần danh sách này
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.nhan_vien_kho
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
                        .message(ThongDiep.dich("banHang.daXacNhanGiaoHang"))
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
                        .message(ThongDiep.dich("banHang.daChuyenBiHoanTra"))
                        .error(null)
                        .build()
        );
    }

    @GetMapping("/{id}/van-don-san")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<byte[]> inVanDonSan(@PathVariable Integer id) {
        VanDonSanDto dto = donBanHangService.layVanDonSan(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(dto.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + dto.tenTep() + "\"")
                .body(dto.duLieu());
    }
}