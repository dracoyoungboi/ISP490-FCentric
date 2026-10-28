package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.ThanhToanRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.thanhtoan.ThanhToanDonBanDto;
import com.dev.backend.services.impl.entities.ThanhToanDonBanService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Ghi nhận thanh toán đơn bán thường: thu tiền (quản trị viên, nhân viên bán hàng với đơn mình tạo), hoàn tiền thu
 * thừa và hủy phiếu (quản trị viên), đối chiếu chuyển khoản với sao kê (quản trị viên).
 */
@RestController
@RequestMapping("/api/v1/thanh-toan")
public class ThanhToanController {

    private final ThanhToanDonBanService thanhToanService;

    public ThanhToanController(ThanhToanDonBanService thanhToanService) {
        this.thanhToanService = thanhToanService;
    }

    /**
     * Ghi nhận khách trả tiền cho đơn bán thường. Body: {"phuongThuc": "TIEN_MAT" | "CHUYEN_KHOAN", "soTien": 2000000,
     * "ngayThu": "2026-10-26", "maThamChieu": "FT26300...", "ghiChu": "...", "choThuThua": false, "choMaDaDung": false,
     * "khoaChongTrung": "..."}. 409 THU_THUA: số vượt phần còn phải thu, gửi lại với choThuThua = true nếu khách thật sự
     * trả dư. 409 MA_GD_DA_DUNG: mã giao dịch đã ghi cho đơn khác (data.don), gửi lại với choMaDaDung = true nếu là bảng
     * kê nhiều đơn.
     */
    @PostMapping("/don/{donId}/thu")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.nhan_vien_ban_hang})
    public ResponseEntity<ResponseData<ThanhToanDonBanDto.TheoDon>> thuTien(@PathVariable Integer donId,
                                                                           @RequestBody ThanhToanRequest.ThuTien request) {
        return ok(thanhToanService.thuTien(donId, request), "Đã ghi nhận thanh toán");
    }

    /** Hoàn phần thu thừa của đơn. Body: {"phuongThuc", "soTien", "maThamChieu" (chuyển khoản), "ghiChu", "khoaChongTrung"}. */
    @PostMapping("/don/{donId}/hoan-tien")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<ThanhToanDonBanDto.TheoDon>> hoanTien(@PathVariable Integer donId,
                                                                            @RequestBody ThanhToanRequest.HoanTien request) {
        return ok(thanhToanService.hoanTien(donId, request), "Đã ghi nhận hoàn tiền");
    }

    /** Hủy phiếu ghi nhầm. Body: {"lyDo": "..."} (bắt buộc). */
    @PutMapping("/{id}/huy")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<ThanhToanDonBanDto.TheoDon>> huyPhieu(@PathVariable Long id,
                                                                            @RequestBody(required = false) ThanhToanRequest.HuyPhieu request) {
        return ok(thanhToanService.huyPhieu(id, request == null ? null : request.getLyDo()), "Đã hủy phiếu");
    }

    /**
     * Phiếu chuyển khoản chưa đối chiếu sao kê (cũ trước) — quản trị viên hậu kiểm: thấy tiền thì đánh dấu, không thấy
     * thì hủy phiếu. khoId: lọc theo cửa hàng (trống = mọi cửa hàng).
     */
    @GetMapping("/chuyen-khoan/cho-doi-chieu")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<Page<ThanhToanDonBanDto>>> choDoiChieu(@RequestParam(required = false) Integer khoId,
                                                                         @RequestParam(defaultValue = "0") int page,
                                                                         @RequestParam(defaultValue = "20") int size) {
        return ok(thanhToanService.choDoiChieu(khoId, page, size), "Success");
    }

    /** Đánh dấu các phiếu chuyển khoản đã thấy trên sao kê. Body: {"ids": [1, 2]}. Trả số phiếu đã đánh dấu. */
    @PostMapping("/chuyen-khoan/doi-chieu")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<Integer>> doiChieu(@RequestBody ThanhToanRequest.DoiChieu request) {
        return ok(thanhToanService.doiChieu(request == null ? null : request.getIds()), "Đã đánh dấu đối chiếu");
    }

    private static <T> ResponseEntity<ResponseData<T>> ok(T data, String message) {
        return ResponseEntity.ok(ResponseData.<T>builder().status(200).data(data).message(message).error(null).build());
    }
}
