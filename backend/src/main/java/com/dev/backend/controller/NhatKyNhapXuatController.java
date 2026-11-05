package com.dev.backend.controller;

import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.NhatKyNhapXuatDTO;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.services.impl.multitable.BaoCaoNhapXuatService;
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
@RequestMapping("/api/v1/admin/dashboard/bao-cao/nhat-ky-nhap-xuat")
public class NhatKyNhapXuatController {

    @Autowired
    private BaoCaoNhapXuatService baoCaoNhapXuatService;

    /**
     * GET /api/v1/admin/dashboard/bao-cao/nhat-ky-nhap-xuat
     *
     * @param loai           ngay | tuan | thang | nam | so_sanh | chi_tiet | theo_kho
     * @param tuNgay         yyyy-MM-dd  (bắt buộc khi loai = ngay | chi_tiet | theo_kho)
     * @param denNgay        yyyy-MM-dd  (bắt buộc khi loai = ngay | chi_tiet | theo_kho)
     * @param nam            (bắt buộc khi loai = tuan | thang | so_sanh)
     * @param thang          (bắt buộc khi loai = so_sanh)
     * @param tuNam          (bắt buộc khi loai = nam)
     * @param denNam         (bắt buộc khi loai = nam)
     * @param khoId          null = tất cả kho
     * @param loaiGiaoDich   null = tất cả | nhap_kho | xuat_kho | chuyen_kho | dieu_chinh
     * @param bienTheSanPhamId  null = tất cả SKU (chỉ dùng khi loai = chi_tiet)
     */
    @GetMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<List<NhatKyNhapXuatDTO>>> getBaoCaoNhatKy(
            @RequestParam                   String  loai,
            @RequestParam(required = false) String  tuNgay,
            @RequestParam(required = false) String  denNgay,
            @RequestParam(required = false) Integer nam,
            @RequestParam(required = false) Integer thang,
            @RequestParam(required = false) Integer tuNam,
            @RequestParam(required = false) Integer denNam,
            @RequestParam(required = false) Integer khoId,
            @RequestParam(required = false) String  loaiGiaoDich,
            @RequestParam(required = false) Integer bienTheSanPhamId
    ) {
        List<NhatKyNhapXuatDTO> data = baoCaoNhapXuatService.lay(new BaoCaoNhapXuatService.ThamSo(loai, ngay(tuNgay),
                ngay(denNgay), nam, thang, tuNam, denNam, khoId, loaiGiaoDich, bienTheSanPhamId));
        return ResponseEntity.ok(
                ResponseData.<List<NhatKyNhapXuatDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .message("Lấy báo cáo nhật ký nhập xuất thành công")
                        .data(data)
                        .build()
        );
    }

    /**
     * Tệp Excel (.xlsx) của Nhật ký nhập xuất, cùng tham số với GET ở trên: trang Tổng hợp, bảng theo kỳ / theo kho và
     * chi tiết từng giao dịch (kỳ tối đa 1 năm). Cần quyền Xuất báo cáo ở kho làm việc.
     */
    @GetMapping("/xuat-excel")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.xuat_bao_cao}, inWarehouse = true)
    public ResponseEntity<byte[]> xuatExcel(
            @RequestParam                   String  loai,
            @RequestParam(required = false) String  tuNgay,
            @RequestParam(required = false) String  denNgay,
            @RequestParam(required = false) Integer nam,
            @RequestParam(required = false) Integer thang,
            @RequestParam(required = false) Integer tuNam,
            @RequestParam(required = false) Integer denNam,
            @RequestParam(required = false) Integer khoId,
            @RequestParam(required = false) String  loaiGiaoDich
    ) {
        return baoCaoNhapXuatService.xuatExcel(new BaoCaoNhapXuatService.ThamSo(loai, ngay(tuNgay), ngay(denNgay), nam,
                thang, tuNam, denNam, khoId, loaiGiaoDich, null)).phanHoi();
    }

    private static LocalDate ngay(String s) {
        return s == null || s.isBlank() ? null : LocalDate.parse(s);
    }
}
