package com.dev.backend.controller;


import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.*;
import com.dev.backend.dto.response.GuiLaiYeuCauDto;
import com.dev.backend.dto.response.HangNhapKhoTongResponse;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.YeuCauMuaHangDto;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import com.dev.backend.services.impl.entities.YeuCauMuaHangService;
import com.dev.backend.services.impl.multitable.HangNhapKhoTongService;
import com.dev.backend.i18n.ThongDiep;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/nghiep-vu")
public class NghiepVuSanPhamController {

    @Autowired
    private DonMuaHangService donMuaHangService;


    @Autowired
    private YeuCauMuaHangService yeuCauMuaHangService;

    @Autowired
    private HangNhapKhoTongService hangNhapKhoTongService;

    // Tạo yêu cầu nhập hàng để cho quản lý duyệt. SRS 4.4 "Purchase Request – Create / Edit / Submit": quản lý kho và
    // nhân viên kho tại kho của mình (nhân viên mua hàng chỉ xem, nhân viên bán hàng không có). Không đòi quyền
    // tao_don_mua_hang: mã quyền đó là "tạo đơn mua" của nhân viên mua hàng, không phải lập yêu cầu nhập.
    @PostMapping("/yeu-cau-mua-hang/create")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true
    )
    public ResponseEntity<ResponseData<YeuCauMuaHangDto>> createYeuCauMuaHang(@RequestBody YeuCauMuaHangCreating creating) {
        return yeuCauMuaHangService.create(creating);
    }

    // Màn Tạo yêu cầu nhập hàng: mọi mã nhập được kèm khả dụng, đang về, số đề xuất, cờ còn dư và yêu cầu đang mở
    // ở Kho tổng (khoId trống: Kho tổng đầu tiên). Cùng quyền với tạo yêu cầu.
    @GetMapping("/yeu-cau-mua-hang/hang-kho-tong")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true
    )
    public ResponseEntity<ResponseData<HangNhapKhoTongResponse>> hangKhoTong(
            @RequestParam(required = false) Integer khoId) {
        return ResponseEntity.ok(
                ResponseData.<HangNhapKhoTongResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(hangNhapKhoTongService.hangKhoTong(khoId))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    // Duyệt (trangThai = 2) / từ chối (trangThai = 4) yêu cầu nhập hàng đang Chờ duyệt.
    // Chỉ quản trị viên hoặc quản lý kho của ĐÚNG kho nhập (kiểm tra trong service).
    // Từ chối bắt buộc gửi body { "lyDoTuChoi": "..." }.
    @PutMapping("/yeu-cau-mua-hang/duyet-tu-choi/{id}/{trangThai}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho
            }
    )
    public ResponseEntity<ResponseData<String>> duyetYeuCauMuaHang(
            @PathVariable Integer id,
            @PathVariable Integer trangThai,
            @RequestBody(required = false) DuyetYeuCauMuaHangRequest body) {
        yeuCauMuaHangService.duyetTuChoi(id, trangThai, body != null ? body.getLyDoTuChoi() : null);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    // Gửi yêu cầu báo giá đến nhiều nhà cung cấp khác nhau.
    // Danh sách vai trò phải trùng IRoleType.GUI_YEU_CAU_BAO_GIA (annotation không nhận Set; có test đối chiếu).
    // SRS 4.4 "RFQ – Create / View / Process": chỉ nhân viên mua hàng.
    // 409 THIEU_THONG_TIN_CUA_HANG khi thiếu tên đăng ký kinh doanh / địa chỉ đăng ký; 409 YEU_CAU_DA_GUI khi bấm 2 lần.
    @PostMapping("/don-mua-hang/gui-yeu-cau-bao-gia")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.nhan_vien_mua_hang})
    public ResponseEntity<ResponseData<String>> guiYeuCauDenNhaCungCap(@RequestBody YeuCauDenNhaCungCapCreating yeuCau){
        return donMuaHangService.guiYeuCauBaoGiaDenNhaCungCap(yeuCau);
    }

    // K11: gửi lại email yêu cầu báo giá (đúng mã đơn cũ) khi lần đầu chưa gửi được. Cùng vai trò với API gửi
    // (phải trùng IRoleType.GUI_YEU_CAU_BAO_GIA, có test đối chiếu). 409 KHONG_GUI_LAI_DUOC khi không đủ điều kiện.
    @PostMapping("/don-mua-hang/{id}/gui-lai-yeu-cau")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.nhan_vien_mua_hang})
    public ResponseEntity<ResponseData<GuiLaiYeuCauDto>> guiLaiYeuCauBaoGia(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<GuiLaiYeuCauDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(donMuaHangService.guiLaiYeuCauBaoGia(id))
                        .message(ThongDiep.dich("sanPhamMuaHang.emailDaVaoHangDoi"))
                        .error(null)
                        .build()
        );
    }

    // Chấp nhận (3) / không chấp nhận (4) báo giá của một nhà cung cấp. Body {lyDo?, ngayBaoGiaDaXem}.
    // Toàn bộ nghiệp vụ (khóa, điều kiện, K1, email) ở DonMuaHangService.xetBaoGia.
    @PutMapping("/don-mua-hang/duyet-don/{id}/{trangThai}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang
            }
    )
    public ResponseEntity<ResponseData<String>> duyetDon(@PathVariable Integer id, @PathVariable Integer trangThai,
                                                        @RequestBody(required = false) XetBaoGiaRequest body) {
        donMuaHangService.xetBaoGia(id, trangThai,
                body != null ? body.getLyDo() : null,
                body != null ? body.getNgayBaoGiaDaXem() : null);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .error(null)
                        .build()
        );
    }


    // Cổng nhà cung cấp (nhận mã, báo giá, biên bản trả hàng, lịch sử): CongNhaCungCapController (/api/v1/cong-ncc).

    // K8: đã gỡ luồng thanh toán đơn mua cũ (thanh-toan/{id}, kiem-tra-thanh-toan/{id}); thanh toán làm ngoài hệ thống.
}
