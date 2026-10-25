package com.dev.backend.controller;


import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.*;
import com.dev.backend.dto.response.GuiLaiYeuCauDto;
import com.dev.backend.dto.response.HangNhapKhoTongResponse;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.congncc.BaoGiaDaNhanDto;
import com.dev.backend.dto.response.congncc.MaXacNhanNccDto;
import com.dev.backend.dto.response.congncc.XacNhanMaNccDto;
import com.dev.backend.dto.response.entities.YeuCauMuaHangDto;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import com.dev.backend.services.impl.entities.YeuCauMuaHangService;
import com.dev.backend.services.impl.multitable.HangNhapKhoTongService;
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

    // Tạo yêu cầu nhập hàng để cho quản lý duyệt
    @PostMapping("/yeu-cau-mua-hang/create")
    @RequireAuth(
        roles = {
                IRoleType.quan_tri_vien,
                IRoleType.nhan_vien_ban_hang,
                IRoleType.nhan_vien_mua_hang,
                IRoleType.nhan_vien_kho

        },
                permissions = {
                        IPermissionType.tao_don_mua_hang
                },
                inWarehouse = true,
                rolesLogic = RequireAuth.LogicType.OR,
                permissionsLogic = RequireAuth.LogicType.AND
    )
    public ResponseEntity<ResponseData<YeuCauMuaHangDto>> createYeuCauMuaHang(@RequestBody YeuCauMuaHangCreating creating) {
        return yeuCauMuaHangService.create(creating);
    }

    // Màn Tạo yêu cầu nhập hàng: mọi mã nhập được kèm khả dụng, đang về, số đề xuất, cờ còn dư và yêu cầu đang mở
    // ở Kho tổng (khoId trống: Kho tổng đầu tiên). Cùng quyền với tạo yêu cầu.
    @GetMapping("/yeu-cau-mua-hang/hang-kho-tong")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_kho
            },
            permissions = {
                    IPermissionType.tao_don_mua_hang
            },
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR,
            permissionsLogic = RequireAuth.LogicType.AND
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

    /** Header mang phiên báo giá của nhà cung cấp (trả về ở xác nhận mã). */
    public static final String HEADER_PHIEN_BAO_GIA = "X-Phien-Bao-Gia";

    // Gửi yêu cầu báo giá đến nhiều nhà cung cấp khác nhau.
    // Danh sách vai trò phải trùng IRoleType.GUI_YEU_CAU_BAO_GIA (annotation không nhận Set; có test đối chiếu).
    // 409 THIEU_THONG_TIN_CUA_HANG khi thiếu tên đăng ký kinh doanh / địa chỉ đăng ký; 409 YEU_CAU_DA_GUI khi bấm 2 lần.
    @PostMapping("/don-mua-hang/gui-yeu-cau-bao-gia")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> guiYeuCauDenNhaCungCap(@RequestBody YeuCauDenNhaCungCapCreating yeuCau){
        return donMuaHangService.guiYeuCauBaoGiaDenNhaCungCap(yeuCau);
    }

    // K11: gửi lại email yêu cầu báo giá (đúng mã đơn cũ) khi lần đầu chưa gửi được. Cùng 4 vai trò với API gửi
    // (phải trùng IRoleType.GUI_YEU_CAU_BAO_GIA, có test đối chiếu). 409 KHONG_GUI_LAI_DUOC khi không đủ điều kiện.
    @PostMapping("/don-mua-hang/{id}/gui-lai-yeu-cau")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_kho
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<GuiLaiYeuCauDto>> guiLaiYeuCauBaoGia(@PathVariable Integer id) {
        return ResponseEntity.ok(
                ResponseData.<GuiLaiYeuCauDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(donMuaHangService.guiLaiYeuCauBaoGia(id))
                        .message("Đã đưa email vào hàng đợi gửi.")
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


    // ---- Cổng nhà cung cấp: không cần đăng nhập nội bộ, lỗi trả mã ở error / data.code, không dùng 401 ----

    // Nhận mã xác nhận báo giá (gửi email ngay). 200 {hetHanGiay, guiLaiSauGiay}; 429 MA_CU_CON_HIEU_LUC; 503 CHUA_GUI_DUOC_MA
    @PostMapping("/don-mua-hang/lay-otp")
    public ResponseEntity<ResponseData<MaXacNhanNccDto>> layOtpDonMuaHang(@RequestBody OtpDonMuaHangGetting getting) {
        return donMuaHangService.getOtpForSupplier(getting);
    }

    // Xác nhận mã. 200 {donMua, phienBaoGia, hetHanPhien, cuaHang}; 400 MA_SAI / MA_HET_HAN
    @PostMapping("/don-mua-hang/xac-nhan-otp")
    public ResponseEntity<ResponseData<XacNhanMaNccDto>> xacNhanOtpDonMuaHang(@RequestBody OtpDonMuaHangConfirming confirming) {
        return donMuaHangService.confirmOtpForSupplier(confirming);
    }

    // Nhà cung cấp gửi (lại) báo giá, cần header X-Phien-Bao-Gia. 200 {ngayBaoGia, tongTien, daGuiEmailXacNhan};
    // 403 PHIEN_HET_HAN; 409 DON_KHONG_CON_NHAN; 400 BAO_GIA_KHONG_HOP_LE
    @PostMapping("/don-mua-hang/bao-gia")
    public ResponseEntity<ResponseData<BaoGiaDaNhanDto>> baoGiaDonMuaHang(
            @RequestHeader(value = HEADER_PHIEN_BAO_GIA, required = false) String phienBaoGia,
            @RequestBody DonMuaHangBaoGia baoGia) {
        return donMuaHangService.baoGiaDonMuaHang(phienBaoGia, baoGia);
    }

    // K8: đã gỡ luồng thanh toán đơn mua cũ (thanh-toan/{id}, kiem-tra-thanh-toan/{id}); thanh toán làm ngoài hệ thống.
}
