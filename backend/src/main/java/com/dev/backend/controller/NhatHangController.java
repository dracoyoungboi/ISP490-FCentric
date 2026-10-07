package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.DonChoXuatFilterRequest;
import com.dev.backend.dto.request.PhanCongNguoiNhatRequest;
import com.dev.backend.dto.request.QuetBarcodeRequest;
import com.dev.backend.dto.request.TaoPickListRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.DonChoXuatDto;
import com.dev.backend.dto.response.customize.KetQuaQuetBarcodeDto;
import com.dev.backend.dto.response.entities.DanhSachNhatHangDto;
import com.dev.backend.services.multitable.NhatHangService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/nhat-hang")
public class NhatHangController {

    @Autowired
    private NhatHangService nhatHangService;

    @PostMapping("/don-cho-xuat")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(
            summary = "Lọc danh sách đơn hàng chờ gom nhặt ",
            description = "Truy xuất danh sách đơn hàng ở trạng thái Chờ nhặt"
    )
    public ResponseEntity<ResponseData<Page<DonChoXuatDto>>> getDonChoXuat(
            @RequestBody(required = false) DonChoXuatFilterRequest filterRequest) {
        if (filterRequest == null) {
            filterRequest = new DonChoXuatFilterRequest();
        }
        Page<DonChoXuatDto> pageResult = nhatHangService.getDonChoXuat(filterRequest);
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                pageResult,
                null,
                "Lấy danh sách đơn chờ xuất thành công"
        ));
    }

    @PostMapping("/tao-pick-list")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(
            summary = "Tạo consolidated Pick List từ các đơn hàng đã chọn",
            description = "Gom một hoặc nhiều đơn hàng đang chờ nhặt thành một đợt nhặt hàng tổng hợp (Pick List)."
    )
    public ResponseEntity<ResponseData<DanhSachNhatHangDto>> taoPickList(
            @Valid @RequestBody TaoPickListRequest request) {
        DanhSachNhatHangDto pickListDto = nhatHangService.taoPickList(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new ResponseData<>(
                HttpStatus.CREATED.value(),
                pickListDto,
                null,
                "Tạo Pick List gom đơn thành công"
        ));
    }

    @GetMapping("/pick-list")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(
            summary = "Danh sách đợt nhặt hàng",
            description = "Lấy danh sách các đợt nhặt hàng Pick List đã tạo trong kho, hỗ trợ phân trang, lọc theo trạng thái và tìm kiếm."
    )
    public ResponseEntity<ResponseData<Page<DanhSachNhatHangDto>>> getDanhSachPickList(
            @RequestParam(required = false) Integer khoId,
            @RequestParam(required = false) String trangThai,
            @RequestParam(required = false) String searchText,
            @PageableDefault(size = 20, sort = "ngayTao", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<DanhSachNhatHangDto> pageResult = nhatHangService.getDanhSachPickList(khoId, trangThai, searchText, pageable);
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                pageResult,
                null,
                "Lấy danh sách Pick List thành công"
        ));
    }

    @GetMapping("/pick-list/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(
            summary = "Chi tiết đợt nhặt hàng Pick List",
            description = "Xem chi tiết một đợt nhặt hàng Pick List kèm thông tin các SKU tổng hợp cần nhặt và danh sách các mã đơn hàng tham chiếu."
    )
    public ResponseEntity<ResponseData<DanhSachNhatHangDto>> getChiTietPickList(@PathVariable Integer id) {
        DanhSachNhatHangDto dto = nhatHangService.getChiTietPickList(id);
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                dto,
                null,
                "Lấy chi tiết Pick List thành công"
        ));
    }

    @PutMapping("/pick-list/{id}/phan-cong")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(
            summary = "Phân công nhân viên nhặt hàng cho Pick List (SRS 6.2.1 Action 'Phân công')",
            description = "Gán nhân viên kho phụ trách đợt nhặt hàng. Quản lý kho có thể phân công bất kỳ nhân viên nào trong kho; Nhân viên kho có thể tự nhận việc (Self-assignment)."
    )
    public ResponseEntity<ResponseData<DanhSachNhatHangDto>> phanCongNguoiNhat(
            @PathVariable Integer id,
            @Valid @RequestBody PhanCongNguoiNhatRequest request) {
        DanhSachNhatHangDto dto = nhatHangService.phanCongNguoiNhat(id, request);
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                dto,
                null,
                "Phân công nhân viên nhặt hàng thành công"
        ));
    }

    @PostMapping("/pick-list/{id}/quet-barcode")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(
            summary = "Quét Barcode / SKU đối soát và cập nhật số lượng nhặt (SRS 6.3.1 Execute Picking)",
            description = "Nhận barcode (từ app Barcode to PC hoặc máy quét) hoặc SKU, đối soát với danh sách cần nhặt của Pick List. Tự động tăng số lượng đã quét, cập nhật tiến độ % và kiểm tra điều kiện hoàn tất."
    )
    public ResponseEntity<ResponseData<KetQuaQuetBarcodeDto>> quetBarcode(
            @PathVariable Integer id,
            @Valid @RequestBody QuetBarcodeRequest request) {
        KetQuaQuetBarcodeDto result = nhatHangService.quetBarcode(id, request);
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                result,
                null,
                "Quét mã vạch thành công"
        ));
    }

    @PostMapping("/pick-list/{id}/hoan-tat")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(
            summary = "Hoàn tất đợt nhặt hàng và sinh Phiếu xuất kho (SRS 6.3.1 -> 6.3.2)",
            description = "Kích hoạt hành động Complete Picking khi 100% các dòng đã nhặt đủ. Chuyển trạng thái Pick List sang 'da_nhat', cập nhật đơn bán hàng sang 'Chờ xuất', và tự động khởi tạo Phiếu xuất kho ở trạng thái Chờ xuất."
    )
    public ResponseEntity<ResponseData<DanhSachNhatHangDto>> hoanTatNhatHang(
            @PathVariable Integer id) {
        DanhSachNhatHangDto result = nhatHangService.hoanTatNhatHang(id);
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                result,
                null,
                "Hoàn tất đợt nhặt hàng thành công"
        ));
    }
}


