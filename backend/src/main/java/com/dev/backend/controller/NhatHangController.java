package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.DonChoXuatFilterRequest;
import com.dev.backend.dto.request.PhanBoLoNhatHangRequest;
import com.dev.backend.dto.request.PhanCongNguoiNhatRequest;
import com.dev.backend.dto.request.QuetBarcodeRequest;
import com.dev.backend.dto.request.TaoPickListRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.DonChoXuatDto;
import com.dev.backend.dto.response.customize.HangCanHoanKeDto;
import com.dev.backend.dto.response.customize.KetQuaQuetBarcodeDto;
import com.dev.backend.dto.response.customize.LoKhaDungNhatHangDto;
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

import java.util.List;

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
                "Tạo phiếu nhặt hàng thành công"
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
                "Lấy danh sách phiếu nhặt hàng thành công"
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
                "Lấy chi tiết phiếu nhặt hàng thành công"
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
            description = "Gán người phụ trách đợt nhặt hàng — BẮT BUỘC trước khi quét nhặt. Quản lý kho / quản trị viên phân công được cho bất kỳ ai (kể cả chính mình); nhân viên kho chỉ tự nhận phiếu chưa có người nhặt (Self-assignment)."
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
            description = "Nhận barcode (từ app Barcode to PC hoặc máy quét) hoặc SKU, đối soát với danh sách cần nhặt của Pick List. Tự động tăng số lượng đã quét, cập nhật tiến độ % và kiểm tra điều kiện hoàn tất. Chỉ người được phân công mới quét được (phiếu chưa phân công trả 409)."
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
            description = "Kích hoạt hành động Complete Picking khi 100% các dòng đã nhặt đủ. Chuyển trạng thái Pick List sang 'da_nhat', cập nhật đơn bán hàng sang 7 (Chờ đóng gói), và tự động khởi tạo Phiếu xuất kho Nháp (chờ đóng gói)."
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

    @GetMapping("/pick-list/{id}/chi-tiet/{chiTietId}/lo-kha-dung")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(
            summary = "Lô có thể phân bổ cho một dòng phiếu nhặt",
            description = "Sắp FIFO theo ngày lô nhập kho; conLai đã trừ phần phiếu nhặt / phiếu xuất khác đang giữ, daPhanBo là phần của chính dòng."
    )
    public ResponseEntity<ResponseData<List<LoKhaDungNhatHangDto>>> getLoKhaDungChoDong(
            @PathVariable Integer id, @PathVariable Integer chiTietId) {
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                nhatHangService.getLoKhaDungChoDong(id, chiTietId),
                null,
                "Lấy danh sách lô thành công"
        ));
    }

    @PutMapping("/pick-list/{id}/chi-tiet/{chiTietId}/phan-bo-lo")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(
            summary = "Lưu phân bổ lô cho một dòng phiếu nhặt",
            description = "Tổng số lượng phải bằng số cần nhặt, mỗi lô không vượt phần còn lại. Chỉ người được giao nhặt hoặc quản lý kho / quản trị viên; khóa sau Hoàn tất nhặt."
    )
    public ResponseEntity<ResponseData<DanhSachNhatHangDto>> luuPhanBoLo(
            @PathVariable Integer id, @PathVariable Integer chiTietId,
            @RequestBody PhanBoLoNhatHangRequest request) {
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                nhatHangService.luuPhanBoLo(id, chiTietId, request),
                null,
                "Đã lưu phân bổ lô"
        ));
    }

    @GetMapping("/hang-can-hoan-ke")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Danh sách hàng cần hoàn cất lại kệ sau khi đơn bị hủy (Put-away Task)")
    public ResponseEntity<ResponseData<List<HangCanHoanKeDto>>> getHangCanHoanKe(
            @RequestParam(required = false) Integer khoId) {
        List<HangCanHoanKeDto> list = nhatHangService.getDanhSachHangCanHoanKe(khoId);
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                list,
                null,
                "Lấy danh sách hàng cần hoàn kệ thành công"
        ));
    }

    @PostMapping("/xac-nhan-hoan-ke/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    @Operation(summary = "Xác nhận đã cất hàng hoàn trả về đúng vị trí kệ")
    public ResponseEntity<ResponseData<Void>> xacNhanHoanKe(@PathVariable Integer id) {
        nhatHangService.xacNhanHoanKe(id);
        return ResponseEntity.ok(new ResponseData<>(
                HttpStatus.OK.value(),
                null,
                null,
                "Xác nhận hoàn kệ thành công"
        ));
    }
}


