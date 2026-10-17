package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.TongQuanVaiTroResponse;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TraTonSanPham;
import com.dev.backend.services.multitable.TongQuanVaiTroService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Màn Tổng quan của quản lý kho, nhân viên kho, nhân viên mua hàng và nhân viên bán hàng.
 * Quản trị viên dùng /api/v1/admin/dashboard/tong-quan.
 */
@RestController
@RequestMapping("/api/v1/tong-quan")
public class TongQuanVaiTroController {

    private final TongQuanVaiTroService tongQuanVaiTroService;

    public TongQuanVaiTroController(TongQuanVaiTroService tongQuanVaiTroService) {
        this.tongQuanVaiTroService = tongQuanVaiTroService;
    }

    /**
     * Tổng quan của người đang đăng nhập. Quản lý kho, nhân viên kho, nhân viên bán hàng xem theo kho làm việc
     * (header kho_id, phải là kho được phân quyền); nhân viên mua hàng xem mọi kho.
     *
     * @param vaiTro vai trò giao diện đang hiển thị (tài khoản nhiều vai trò); bỏ trống thì tự chọn
     * @param lamMoi true khi bấm "Tải lại": tính lại ngay, không dùng bản đã tính trong 60 giây
     */
    @GetMapping("/cua-toi")
    @RequireAuth(roles = {
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<TongQuanVaiTroResponse>> cuaToi(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String vaiTro,
            @RequestParam(defaultValue = "false") boolean lamMoi
    ) {
        return ResponseEntity.ok(
                ResponseData.<TongQuanVaiTroResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(tongQuanVaiTroService.layTongQuanCuaToi(vaiTro, lamMoi))
                        .message("Lấy tổng quan thành công")
                        .error(null)
                        .build()
        );
    }

    /**
     * Tra còn hàng ở kho làm việc: tối đa 6 sản phẩm đang bán khớp tên, mã sản phẩm hoặc mã SKU (từ 2 ký tự,
     * không phân biệt hoa thường, có dấu hay không dấu).
     */
    @GetMapping("/cua-toi/tra-ton")
    @RequireAuth(roles = {
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang
    })
    public ResponseEntity<ResponseData<List<TraTonSanPham>>> traTon(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(name = "q", required = false) String q
    ) {
        return ResponseEntity.ok(
                ResponseData.<List<TraTonSanPham>>builder()
                        .status(HttpStatus.OK.value())
                        .data(tongQuanVaiTroService.traTon(q))
                        .message("Tra tồn thành công")
                        .error(null)
                        .build()
        );
    }
}
