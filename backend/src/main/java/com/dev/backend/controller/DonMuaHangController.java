package com.dev.backend.controller;


import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.LyDoHuyRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.mapper.DonMuaHangMapper;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import com.dev.backend.i18n.ThongDiep;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/don-mua-hang")
public class DonMuaHangController {

    @Autowired
    private DonMuaHangService donMuaHangService;

    @Autowired
    private DonMuaHangMapper donMuaHangMapper;

    @GetMapping("/get-by-id/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<DonMuaHangDto>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<DonMuaHangDto>builder()
                        .status(HttpStatus.OK.value())
                        // Kiểm phạm vi kho nhập theo vai trò (quản lý kho, nhân viên kho chỉ thấy kho mình); đơn đã đóng /
                        // đã hủy kèm lý do, lúc, người thao tác
                        .data(donMuaHangService.boSungHanBaoGia(donMuaHangService.boSungKetThuc(
                                donMuaHangMapper.toDto(donMuaHangService.layDuocXem(id)))))
                        .build()
        );
    }

    @PostMapping("/filter")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<Page<DonMuaHangDto>>> filter(@RequestBody BaseFilterRequest filter) {
        Page<com.dev.backend.entities.DonMuaHang> trangGoc = donMuaHangService.filter(filter);
        Page<DonMuaHangDto> trang = donMuaHangMapper.toDtoPage(trangGoc);
        // Số phải trả (trừ hàng lỗi, đóng thiếu) cho cả trang: danh sách đơn mua và tab Đơn mua của nhà cung cấp
        donMuaHangService.boSungPhaiTra(trang.getContent());
        // Hạn báo giá (đơn đã gửi yêu cầu): cột trạng thái hiện Hết hạn theo giờ
        donMuaHangService.boSungHanBaoGia(trang.getContent(), trangGoc.getContent());
        return ResponseEntity.ok(
                ResponseData.<Page<DonMuaHangDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(trang)
                        .error(null)
                        .message("Success")
                        .build()
        );
    }

    // Đóng đơn đang vận chuyển khi nhà cung cấp giao thiếu (đã nhận ít nhất một đợt). Body {"lyDo": "..."} bắt buộc,
    // tối đa DonMuaHangService.LY_DO_KET_THUC_TOI_DA ký tự. Không gửi email cho nhà cung cấp.
    @PutMapping("/dong-don/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_mua_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> dongDon(@PathVariable Integer id,
                                                       @RequestBody(required = false) LyDoHuyRequest body) {
        donMuaHangService.dongDon(id, body != null ? body.getLyDo() : null);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message(ThongDiep.dich("sanPhamMuaHang.donMuaDaDong"))
                        .build()
        );
    }

    // Hủy đơn đang vận chuyển khi nhà cung cấp không giao (chưa nhận đợt nào). Body {"lyDo": "..."} bắt buộc.
    // Không gửi email cho nhà cung cấp.
    @PutMapping("/huy-don/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_mua_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> huyDon(@PathVariable Integer id,
                                                      @RequestBody(required = false) LyDoHuyRequest body) {
        donMuaHangService.huyDon(id, body != null ? body.getLyDo() : null);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message(ThongDiep.dich("sanPhamMuaHang.donMuaDaHuy"))
                        .build()
        );
    }
}
