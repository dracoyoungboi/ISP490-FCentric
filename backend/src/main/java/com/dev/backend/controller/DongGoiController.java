package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.QuetBarcodeRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.PhienDongGoiDto;
import com.dev.backend.services.multitable.BangChungDongGoiService;
import com.dev.backend.services.multitable.DongGoiService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Đóng gói đơn bán (Scan-to-Pack) — bước giữa hoàn tất nhặt hàng và xác nhận xuất kho. */
@RestController
@RequestMapping("/api/v1/dong-goi")
public class DongGoiController {

    @Autowired
    private DongGoiService dongGoiService;

    @Autowired
    private BangChungDongGoiService bangChungDongGoiService;

    @GetMapping("/don/{donBanHangId}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Phiên đóng gói của đơn bán: phiếu xuất và tiến độ quét từng sản phẩm")
    public ResponseEntity<ResponseData<PhienDongGoiDto>> layPhien(@PathVariable Integer donBanHangId) {
        return ResponseEntity.ok(new ResponseData<>(HttpStatus.OK.value(),
                dongGoiService.layPhienTheoDon(donBanHangId), null, "Success"));
    }

    // Chỉ đọc: người mở được chi tiết đơn (cùng phạm vi DonBanHangService.trongPhamVi) xem được bằng chứng của đơn đó,
    // kể cả nhân viên bán hàng xử lý khiếu nại — không bắt kho đang chọn như các thao tác ghi bên dưới
    @GetMapping("/don/{donBanHangId}/bang-chung")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_ban_hang},
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Lấy thông tin và danh sách bằng chứng đóng gói của đơn hàng")
    public ResponseEntity<ResponseData<com.dev.backend.dto.response.customize.ThongTinBangChungDonDto>> layBangChung(
            @PathVariable Integer donBanHangId) {
        return ResponseEntity.ok(new ResponseData<>(HttpStatus.OK.value(),
                bangChungDongGoiService.layThongTinBangChung(donBanHangId), null, "Lấy thông tin bằng chứng thành công"));
    }

    @PostMapping(value = "/don/{donBanHangId}/bang-chung", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Tải lên tệp bằng chứng đóng gói (ảnh hoặc video)")
    public ResponseEntity<ResponseData<com.dev.backend.dto.response.customize.BangChungDongGoiDto>> uploadBangChung(
            @PathVariable Integer donBanHangId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam("loaiBangChung") String loaiBangChung,
            @RequestParam(value = "thoiLuongGiay", required = false) Integer thoiLuongGiay) {
        return ResponseEntity.ok(new ResponseData<>(HttpStatus.OK.value(),
                bangChungDongGoiService.uploadBangChung(donBanHangId, file, loaiBangChung, thoiLuongGiay),
                null, "Tải lên bằng chứng đóng gói thành công"));
    }

    @DeleteMapping("/bang-chung/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Xóa tệp bằng chứng đóng gói vừa tải lên")
    public ResponseEntity<ResponseData<Void>> xoaBangChung(@PathVariable Integer id) {
        bangChungDongGoiService.xoaBangChung(id);
        return ResponseEntity.ok(new ResponseData<>(HttpStatus.OK.value(), null, null, "Xóa bằng chứng thành công"));
    }

    @PostMapping("/phieu/{phieuXuatKhoId}/quet")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Quét SKU / mã vạch để đối chiếu hàng khi đóng gói")
    public ResponseEntity<ResponseData<PhienDongGoiDto>> quet(@PathVariable Integer phieuXuatKhoId,
                                                              @Valid @RequestBody QuetBarcodeRequest request) {
        return ResponseEntity.ok(new ResponseData<>(HttpStatus.OK.value(),
                dongGoiService.quet(phieuXuatKhoId, request), null, "Quét mã đóng gói thành công"));
    }

    @PostMapping("/phieu/{phieuXuatKhoId}/hoan-tat")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Hoàn tất đóng gói: phiếu xuất sang Chờ xuất (6), đơn sang Chờ xuất kho (8)")
    public ResponseEntity<ResponseData<PhienDongGoiDto>> hoanTat(@PathVariable Integer phieuXuatKhoId) {
        return ResponseEntity.ok(new ResponseData<>(HttpStatus.OK.value(),
                dongGoiService.hoanTat(phieuXuatKhoId), null, "Hoàn tất đóng gói thành công"));
    }
}
