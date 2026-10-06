package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.DonChoXuatFilterRequest;
import com.dev.backend.dto.request.TaoPickListRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.DonChoXuatDto;
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
}

