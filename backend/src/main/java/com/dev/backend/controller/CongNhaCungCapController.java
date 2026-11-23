package com.dev.backend.controller;

import com.dev.backend.dto.request.congncc.CongNccRequest;
import com.dev.backend.dto.request.DonMuaHangBaoGia;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.congncc.BaoGiaDaNhanDto;
import com.dev.backend.dto.response.congncc.CongNcc;
import com.dev.backend.dto.response.congncc.MaXacNhanNccDto;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.services.impl.congncc.CongNhaCungCapService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * Cổng nhà cung cấp: API công khai (không đăng nhập nội bộ, không @RequireAuth). Đăng nhập bằng email + mã gửi về email;
 * các API còn lại cần header {@value #HEADER_PHIEN} (token nhận ở bước xác nhận mã). Lỗi trả mã ở error (LoiCoMaException):
 * PHIEN_HET_HAN (403) thì cổng về trang đăng nhập.
 */
@RestController
@RequestMapping("/api/v1/cong-ncc")
public class CongNhaCungCapController {

    public static final String HEADER_PHIEN = "X-Phien-Cong-Ncc";

    private final CongNhaCungCapService congNhaCungCapService;

    public CongNhaCungCapController(CongNhaCungCapService congNhaCungCapService) {
        this.congNhaCungCapService = congNhaCungCapService;
    }

    // Nhận mã đăng nhập (gửi email ngay). 400 EMAIL_KHONG_CO; 429 MA_CU_CON_HIEU_LUC; 503 CHUA_GUI_DUOC_MA
    @PostMapping("/dang-nhap/lay-ma")
    public ResponseEntity<ResponseData<MaXacNhanNccDto>> layMa(@RequestBody CongNccRequest.LayMa body) {
        return ok(congNhaCungCapService.layMa(body == null ? null : body.email()), ThongDiep.dich("sanPhamMuaHang.donMuaDaGuiMa"));
    }

    // Xác nhận mã, mở phiên 60 phút. 400 MA_SAI / MA_HET_HAN / EMAIL_KHONG_CO
    @PostMapping("/dang-nhap/xac-nhan")
    public ResponseEntity<ResponseData<CongNcc.DangNhap>> xacNhan(@RequestBody CongNccRequest.XacNhanMa body) {
        return ok(congNhaCungCapService.xacNhanMa(body == null ? null : body.email(), body == null ? null : body.ma()), null);
    }

    @PostMapping("/dang-xuat")
    public ResponseEntity<ResponseData<Void>> dangXuat(@RequestHeader(value = HEADER_PHIEN, required = false) String phien) {
        congNhaCungCapService.dangXuat(phien);
        return ok(null, null);
    }

    @GetMapping("/viec-can-lam")
    public ResponseEntity<ResponseData<CongNcc.ViecCanLam>> viecCanLam(
            @RequestHeader(value = HEADER_PHIEN, required = false) String phien) {
        return ok(congNhaCungCapService.viecCanLam(phien), null);
    }

    // 404 KHONG_TIM_THAY: đơn không thuộc nhà cung cấp của phiên
    @GetMapping("/don-mua/{id}")
    public ResponseEntity<ResponseData<CongNhaCungCapService.DonMuaCong>> donMua(
            @RequestHeader(value = HEADER_PHIEN, required = false) String phien, @PathVariable Integer id) {
        return ok(congNhaCungCapService.layDonMua(phien, id), null);
    }

    // 409 DON_KHONG_CON_NHAN; 400 BAO_GIA_KHONG_HOP_LE
    @PostMapping("/don-mua/{id}/bao-gia")
    public ResponseEntity<ResponseData<BaoGiaDaNhanDto>> baoGia(
            @RequestHeader(value = HEADER_PHIEN, required = false) String phien, @PathVariable Integer id,
            @RequestBody DonMuaHangBaoGia body) {
        return ok(congNhaCungCapService.baoGia(phien, id, body), null);
    }

    @GetMapping("/bien-ban/{id}")
    public ResponseEntity<ResponseData<CongNcc.BienBan>> bienBan(
            @RequestHeader(value = HEADER_PHIEN, required = false) String phien, @PathVariable Integer id) {
        return ok(congNhaCungCapService.bienBan(phien, id), null);
    }

    // Nhà cung cấp chọn cách bù và hàng lỗi. 400 TRA_LOI_KHONG_HOP_LE (error.duLieu.o); 409 BIEN_BAN_KHONG_CON_NHAN
    @PostMapping("/bien-ban/{id}/xac-nhan")
    public ResponseEntity<ResponseData<CongNcc.BienBan>> xacNhanBienBan(
            @RequestHeader(value = HEADER_PHIEN, required = false) String phien, @PathVariable Integer id,
            @RequestBody(required = false) CongNccRequest.TraLoiBienBan body) {
        CongNccRequest.TraLoiBienBan b = body == null ? new CongNccRequest.TraLoiBienBan(null, null, null, null, null) : body;
        return ok(congNhaCungCapService.traLoiBienBan(phien, id, b), null);
    }

    @GetMapping("/lich-su/bao-gia")
    public ResponseEntity<ResponseData<CongNcc.LichSuBaoGia>> lichSuBaoGia(
            @RequestHeader(value = HEADER_PHIEN, required = false) String phien,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate tuNgay,
            @RequestParam(required = false) String tuKhoa) {
        return ok(congNhaCungCapService.lichSuBaoGia(phien, tuNgay, tuKhoa), null);
    }

    @GetMapping("/lich-su/tra-hang")
    public ResponseEntity<ResponseData<CongNcc.LichSuTraHang>> lichSuTraHang(
            @RequestHeader(value = HEADER_PHIEN, required = false) String phien,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate tuNgay,
            @RequestParam(required = false) String tuKhoa) {
        return ok(congNhaCungCapService.lichSuTraHang(phien, tuNgay, tuKhoa), null);
    }

    private static <T> ResponseEntity<ResponseData<T>> ok(T data, String message) {
        return ResponseEntity.ok(ResponseData.<T>builder()
                .status(HttpStatus.OK.value())
                .data(data)
                .message(message == null ? "Success" : message)
                .error(null)
                .build());
    }
}
