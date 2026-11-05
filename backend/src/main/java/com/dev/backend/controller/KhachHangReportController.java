package com.dev.backend.controller;

import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.KhachHangTangTruongDTO;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.services.impl.multitable.BaoCaoKhachHangService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/dashboard/bao-cao/khach-hang")
public class KhachHangReportController {

    @Autowired
    private BaoCaoKhachHangService baoCaoKhachHangService;

    /**
     * GET /api/v1/admin/dashboard/bao-cao/khach-hang
     *
     * @param loai     ngay | tuan | thang | nam | so_sanh
     * @param tuNgay   yyyy-MM-dd  (bắt buộc khi loai=ngay)
     * @param denNgay  yyyy-MM-dd  (bắt buộc khi loai=ngay)
     * @param nam      (bắt buộc khi loai=tuan | thang | so_sanh)
     * @param thang    (bắt buộc khi loai=so_sanh)
     * @param tuNam    (bắt buộc khi loai=nam)
     * @param denNam   (bắt buộc khi loai=nam)
     * @param khoId    null = tất cả kho
     */
    @GetMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<List<KhachHangTangTruongDTO>>> getBaoCaoKhachHang(
            @RequestParam String loai,
            @RequestParam(required = false) String  tuNgay,
            @RequestParam(required = false) String  denNgay,
            @RequestParam(required = false) Integer nam,
            @RequestParam(required = false) Integer thang,
            @RequestParam(required = false) Integer tuNam,
            @RequestParam(required = false) Integer denNam,
            @RequestParam(required = false) Integer khoId
    ) {
        List<KhachHangTangTruongDTO> data = baoCaoKhachHangService.lay(new BaoCaoKhachHangService.ThamSo(loai,
                ngay(tuNgay), ngay(denNgay), nam, thang, tuNam, denNam, khoId));

        return ResponseEntity.ok(
                ResponseData.<List<KhachHangTangTruongDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .message("Lấy báo cáo tăng trưởng khách hàng thành công")
                        .data(data)
                        .build()
        );
    }

    /**
     * Tệp Excel (.xlsx) của Báo cáo khách hàng, cùng tham số với GET ở trên: trang Tổng hợp, bảng theo kỳ và danh sách
     * khách mua trong kỳ. Cần quyền Xuất báo cáo ở kho làm việc.
     */
    @GetMapping("/xuat-excel")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.xuat_bao_cao}, inWarehouse = true)
    public ResponseEntity<byte[]> xuatExcel(
            @RequestParam String loai,
            @RequestParam(required = false) String  tuNgay,
            @RequestParam(required = false) String  denNgay,
            @RequestParam(required = false) Integer nam,
            @RequestParam(required = false) Integer thang,
            @RequestParam(required = false) Integer tuNam,
            @RequestParam(required = false) Integer denNam,
            @RequestParam(required = false) Integer khoId
    ) {
        return baoCaoKhachHangService.xuatExcel(new BaoCaoKhachHangService.ThamSo(loai, ngay(tuNgay), ngay(denNgay), nam,
                thang, tuNam, denNam, khoId)).phanHoi();
    }

    private static LocalDate ngay(String s) {
        return s == null || s.isBlank() ? null : LocalDate.parse(s);
    }
}
