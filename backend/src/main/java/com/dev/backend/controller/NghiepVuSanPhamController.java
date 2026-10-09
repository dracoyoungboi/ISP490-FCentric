package com.dev.backend.controller;


import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.*;
import com.dev.backend.dto.response.GiaoDichDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.dto.response.entities.YeuCauMuaHangDto;
import com.dev.backend.entities.ChiTietDonMuaHang;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.YeuCauMuaHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.EmailService;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import com.dev.backend.services.impl.entities.PhieuXuatKhoService;
import com.dev.backend.services.impl.entities.YeuCauMuaHangService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Date;
import java.util.HashMap;

@RestController
@RequestMapping("/api/v1/nghiep-vu")
public class NghiepVuSanPhamController {

    @Autowired
    private DonMuaHangService donMuaHangService;


    @Autowired
    private EmailService emailService;

    @Autowired
    private YeuCauMuaHangService yeuCauMuaHangService;

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

    // Nhân viên kho gửi yêu cầu báo giá đến nhiều nhà cung cấp khác nhau
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




    // Nhân viên kho duyệt báo giá nào phù hợp và từ chối báo giá không phù hợp trạng thái 3 là duyệt 4 là từ chối
    @PutMapping("/don-mua-hang/duyet-don/{id}/{trangThai}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang
            }
    )
    public ResponseEntity<ResponseData<String>> duyetDon(@PathVariable Integer id, @PathVariable Integer trangThai) {

        DonMuaHang donMuaHang = donMuaHangService.getOne(id).orElseThrow(
                () -> new CommonException("Không tìm thấy đơn mua hàng id: " + id)
        );
        if(trangThai == 3){
            YeuCauMuaHang yeuCauMuaHang = donMuaHang.getYeuCauMuaHang();
            yeuCauMuaHangService.changeStatus(yeuCauMuaHang.getId(), 5);
        }
        if (trangThai == 4) {
            Date now = new Date();
            // LocalDate thay cho Date.getDate()/getMonth()/getYear() (deprecated). Giá trị gửi vào template giữ nguyên.
            LocalDate today = LocalDate.now();
            HashMap<String, Object> params = new HashMap<>();
            params.put("ngay", today.getDayOfMonth());
            params.put("thang", today.getMonthValue());
            params.put("year", today.getYear());
            params.put("soDonHang", donMuaHang.getSoDonMua());
            params.put("tenNhaCungCap", donMuaHang.getNhaCungCap().getTenNhaCungCap());
            params.put("ngayGui", now);
            params.put("nguoiPhuTrach", donMuaHang.getNguoiTao().getHoTen());
            params.put("ngayDatHang", donMuaHang.getNgayDatHang());
            params.put("lyDoHuy", "Giá cả chưa phù hợp");
            emailService.sendHtmlEmailFromTemplate(
                    donMuaHang.getNhaCungCap().getEmail(),
                    "Phiếu huỷ hàng",
                    "don_huy_mua.html",
                    params
            );
        }

        donMuaHang.setTrangThai(trangThai);
        donMuaHangService.update(donMuaHang.getId(), donMuaHang);

        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .error(null)
                        .build()
        );
    }


    // Lấy otp để đăng nhập cho nhà cung cấp
    @PostMapping("/don-mua-hang/lay-otp")
    public ResponseEntity<ResponseData<String>> layOtpDonMuaHang(@RequestBody OtpDonMuaHangGetting getting) {
        return donMuaHangService.getOtpForSupplier(getting);
    }

    // Xác nhận otp của nhà cung cấp
    @PostMapping("/don-mua-hang/xac-nhan-otp")
    public ResponseEntity<ResponseData<DonMuaHangDto>> xacNhanOtpDonMuaHang(@RequestBody OtpDonMuaHangConfirming confirming) {
        return donMuaHangService.confirmOtpForSupplier(confirming);
    }

    //Nhà cung cấp báo giá cho đơn mua hàng
    @PostMapping("/don-mua-hang/bao-gia")
    public ResponseEntity<ResponseData<String>> baoGiaDonMuaHang(@RequestBody DonMuaHangBaoGia baoGia) {
        return donMuaHangService.baoGiaDonMuaHang(baoGia);
    }

    // Nhân viên mua hàng lấy mã giao dịch cho thanh toán
    @GetMapping("/don-mua-hang/thanh-toan/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<GiaoDichDto>> layGiaoDich(@PathVariable Integer id) {
        return donMuaHangService.layGiaoDich(id);
    }

    // Api kiểm tra trạng thái giao dịch
    @GetMapping("/don-mua-hang/kiem-tra-thanh-toan/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang
            },
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<String>> kiemTraThanhToan(@PathVariable Integer id) {
        return donMuaHangService.kiemTraThanhToan(id);
    }

}
