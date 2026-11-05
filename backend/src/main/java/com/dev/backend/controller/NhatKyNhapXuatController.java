package com.dev.backend.controller;

import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.NhapXuatTongHopDTO;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.impl.multitable.BaoCaoNhapXuatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * Báo cáo nhập xuất (màn /reports/stock-movements). Tham số chung:
 * loai = ngay (tuNgay, denNgay yyyy-MM-dd, tối đa 1 năm) | tuan, thang (nam) | nam (tuNam, denNam);
 * khoId trống = mọi kho được xem (quản lý kho: các kho mình phụ trách; chọn kho khác thì 403);
 * nhom trống = mọi loại, hoặc một mã như N_MUA, X_QUAY (xem BaoCaoNhapXuatService.NHOM).
 */
@RestController
@RequestMapping("/api/v1/admin/dashboard/bao-cao/nhat-ky-nhap-xuat")
public class NhatKyNhapXuatController {

    @Autowired
    private BaoCaoNhapXuatService baoCaoNhapXuatService;

    /** Tồn đầu kỳ + Nhập − Xuất = Tồn cuối kỳ, nhập từ đâu, xuất đi đâu, theo kỳ, theo kho, theo sản phẩm. */
    @GetMapping("/tong-hop")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<NhapXuatTongHopDTO>> tongHop(
            @RequestParam                   String  loai,
            @RequestParam(required = false) String  tuNgay,
            @RequestParam(required = false) String  denNgay,
            @RequestParam(required = false) Integer nam,
            @RequestParam(required = false) Integer tuNam,
            @RequestParam(required = false) Integer denNam,
            @RequestParam(required = false) Integer khoId,
            @RequestParam(required = false) String  nhom
    ) {
        NhapXuatTongHopDTO data = baoCaoNhapXuatService.tongHop(new BaoCaoNhapXuatService.ThamSo(loai, ngay(tuNgay),
                ngay(denNgay), nam, tuNam, denNam, khoId, nhom));
        return ResponseEntity.ok(
                ResponseData.<NhapXuatTongHopDTO>builder()
                        .status(HttpStatus.OK.value())
                        .message("Lấy báo cáo nhập xuất thành công")
                        .data(data)
                        .build()
        );
    }

    /**
     * Tệp Excel (.xlsx), cùng tham số với /tong-hop: trang Tổng hợp, Theo kỳ, Theo sản phẩm và Chi tiết giao dịch (kỳ tối
     * đa 1 năm). Cần quyền Xuất báo cáo ở kho làm việc.
     */
    @GetMapping("/xuat-excel")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.xuat_bao_cao}, inWarehouse = true)
    public ResponseEntity<byte[]> xuatExcel(
            @RequestParam                   String  loai,
            @RequestParam(required = false) String  tuNgay,
            @RequestParam(required = false) String  denNgay,
            @RequestParam(required = false) Integer nam,
            @RequestParam(required = false) Integer tuNam,
            @RequestParam(required = false) Integer denNam,
            @RequestParam(required = false) Integer khoId,
            @RequestParam(required = false) String  nhom
    ) {
        return baoCaoNhapXuatService.xuatExcel(new BaoCaoNhapXuatService.ThamSo(loai, ngay(tuNgay), ngay(denNgay), nam,
                tuNam, denNam, khoId, nhom)).phanHoi();
    }

    private static LocalDate ngay(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            throw new CommonException("Ngày không hợp lệ: " + s);
        }
    }
}
