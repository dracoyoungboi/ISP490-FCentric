package com.dev.backend.controller;

import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.AdminDashboardResponse;
import com.dev.backend.dto.response.BaoCaoSanPhamDTO;
import com.dev.backend.dto.response.DoanhThuChartDTO;
import com.dev.backend.dto.response.DoanhThuTongHopDTO;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.TienThuDTO;
import com.dev.backend.dto.response.TongQuanAdminResponse;
import com.dev.backend.services.impl.multitable.BaoCaoSanPhamService;
import com.dev.backend.services.impl.multitable.DoanhThuReportService;
import com.dev.backend.services.multitable.AdminDashboardService;
import com.dev.backend.services.multitable.TongQuanAdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.i18n.LoiThamSoException;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    @Autowired
    private DoanhThuReportService doanhThuReportService;

    @Autowired
    private TongQuanAdminService tongQuanAdminService;

    @Autowired
    private BaoCaoSanPhamService baoCaoSanPhamService;

    public AdminDashboardController(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    /**
     * Số liệu toàn chuỗi (doanh thu không lọc kho, số tài khoản, tài khoản bị khóa): chỉ quản trị viên như
     * Tổng quan (ma trận phân quyền SRS); các vai trò khác dùng Tổng quan theo vai trò.
     */
    @GetMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<AdminDashboardResponse>> getDashboardByAdmin(
            @RequestHeader("Authorization") String authHeader
    ) {

        return ResponseEntity.ok(
                ResponseData.<AdminDashboardResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(adminDashboardService.getDashboard())
                        .message(ThongDiep.dich("khoVanHanh.layDashboardAdminThanhCong"))
                        .error(null)
                        .build()
        );
    }

    /**
     * Màn Tổng quan của quản trị viên (UC 11.1): doanh thu, việc cần xử lý, tồn kho, nhập – xuất,
     * bán chạy, hàng cần bổ sung, hoạt động gần đây. Chỉ quản trị viên (ma trận phân quyền SRS).
     *
     * @param ky     7_ngay | 30_ngay (mặc định) | 12_thang
     * @param khoId  bỏ trống = tất cả kho
     * @param lamMoi true khi bấm "Cập nhật": tính lại ngay, không dùng bản đã tính trong 60 giây
     */
    @GetMapping("/tong-quan")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<TongQuanAdminResponse>> getTongQuan(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "30_ngay") String ky,
            @RequestParam(required = false) Integer khoId,
            @RequestParam(defaultValue = "false") boolean lamMoi
    ) {
        return ResponseEntity.ok(
                ResponseData.<TongQuanAdminResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(tongQuanAdminService.layTongQuan(ky, khoId, lamMoi))
                        .message(ThongDiep.dich("khoVanHanh.layTongQuanThanhCong"))
                        .error(null)
                        .build()
        );
    }

    @GetMapping("/bao-cao/doanh-thu")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<List<DoanhThuChartDTO>>> getBaoCaoDoanhThu(
            @RequestParam String    loai,       // ngay | tuan | thang | nam | so_sanh
            @RequestParam(required = false)  String    tuNgay,     // yyyy-MM-dd  (dùng cho loai=ngay)
            @RequestParam(required = false)  String    denNgay,    // yyyy-MM-dd  (dùng cho loai=ngay)
            @RequestParam(required = false)  Integer   nam,        // (tuan | thang | so_sanh)
            @RequestParam(required = false)  Integer   thang,      // (so_sanh)
            @RequestParam(required = false)  Integer   tuNam,      // (nam)
            @RequestParam(required = false)  Integer   denNam,     // (nam)
            @RequestParam(required = false)  Integer   khoId       // null = tất cả kho
    ) {
        List<DoanhThuChartDTO> data = switch (loai) {

            case "ngay" -> {
                if (tuNgay == null || denNgay == null)
                    throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chonTuNgayDenNgay"));
                yield doanhThuReportService.layBaoCaoTheoNgay(
                        LocalDate.parse(tuNgay), LocalDate.parse(denNgay), khoId);
            }

            case "tuan" -> {
                if (nam == null)
                    throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chonNam"));
                yield doanhThuReportService.layBaoCaoTheoTuan(nam, khoId);
            }

            case "thang" -> {
                if (nam == null)
                    throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chonNam"));
                yield doanhThuReportService.layBaoCaoTheoThang(nam, khoId);
            }

            case "nam" -> {
                if (tuNam == null || denNam == null)
                    throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chonTuNamDenNam"));
                yield doanhThuReportService.layBaoCaoTheoNam(tuNam, denNam, khoId);
            }

            case "so_sanh" -> {
                if (nam == null || thang == null)
                    throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chonNamThangSoSanh"));
                yield doanhThuReportService.laySoSanhCungKy(nam, thang, khoId);
            }

            default -> throw new LoiThamSoException(
                    ThongDiep.of("khoVanHanh.kieuBaoCaoKhongHopLe"));
        };

        return ResponseEntity.ok(
                ResponseData.<List<DoanhThuChartDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(data)
                        .build()
        );
    }

    /**
     * Doanh thu kèm cùng kỳ năm trước (màn Báo cáo doanh thu). loai: ngay (tuNgay, denNgay) | thang (nam) | nam (tuNam,
     * denNam). Kỳ này cắt tới hôm nay; kèm theo kênh và theo nhân viên của cả kỳ. Quản lý kho, nhân viên bán hàng chỉ xem
     * các cửa hàng mình được phân công; nhân viên bán hàng không nhận số giá vốn, lợi nhuận gộp.
     */
    @GetMapping("/bao-cao/doanh-thu/tong-hop")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang})
    public ResponseEntity<ResponseData<DoanhThuTongHopDTO>> getDoanhThuTongHop(
            @RequestParam String loai,
            @RequestParam(required = false) String tuNgay,
            @RequestParam(required = false) String denNgay,
            @RequestParam(required = false) Integer nam,
            @RequestParam(required = false) Integer tuNam,
            @RequestParam(required = false) Integer denNam,
            @RequestParam(required = false) Integer khoId
    ) {
        DoanhThuTongHopDTO data = doanhThuReportService.layTongHop(loai,
                tuNgay == null ? null : LocalDate.parse(tuNgay), denNgay == null ? null : LocalDate.parse(denNgay),
                nam, tuNam, denNam, khoId);
        return ResponseEntity.ok(ResponseData.<DoanhThuTongHopDTO>builder()
                .status(HttpStatus.OK.value()).message("Success").data(data).build());
    }

    /** Tệp Excel (.xlsx) của Báo cáo doanh thu, cùng tham số với /bao-cao/doanh-thu/tong-hop. Cần quyền Xuất báo cáo. */
    @GetMapping("/bao-cao/doanh-thu/xuat-excel")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.xuat_bao_cao}, inWarehouse = true)
    public ResponseEntity<byte[]> xuatExcelDoanhThu(
            @RequestParam String loai,
            @RequestParam(required = false) String tuNgay,
            @RequestParam(required = false) String denNgay,
            @RequestParam(required = false) Integer nam,
            @RequestParam(required = false) Integer tuNam,
            @RequestParam(required = false) Integer denNam,
            @RequestParam(required = false) Integer khoId
    ) {
        return doanhThuReportService.xuatExcel(loai,
                tuNgay == null ? null : LocalDate.parse(tuNgay), denNgay == null ? null : LocalDate.parse(denNgay),
                nam, tuNam, denNam, khoId).phanHoi();
    }

    /**
     * Báo cáo sản phẩm (màn /reports/products): số bán, doanh thu hàng, giá vốn, hoàn theo sản phẩm và mã SKU trong
     * [tuNgay, denNgay] (tối đa 1 năm, cắt tới hôm nay) so với kỳ liền trước, kèm khả dụng và đang về hiện tại.
     * kenh: trống = mọi kênh, POS, TRUC_TIEP hoặc id kênh bán. Quản lý kho, nhân viên bán hàng chỉ xem các cửa hàng mình
     * được phân công; nhân viên bán hàng không nhận số giá vốn, lợi nhuận gộp, giá trị tồn.
     */
    @GetMapping("/bao-cao/san-pham")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang})
    public ResponseEntity<ResponseData<BaoCaoSanPhamDTO>> getBaoCaoSanPham(
            @RequestParam String tuNgay,
            @RequestParam String denNgay,
            @RequestParam(required = false) Integer khoId,
            @RequestParam(required = false) String kenh
    ) {
        BaoCaoSanPhamDTO data = baoCaoSanPhamService.layBaoCao(LocalDate.parse(tuNgay), LocalDate.parse(denNgay), khoId, kenh);
        return ResponseEntity.ok(ResponseData.<BaoCaoSanPhamDTO>builder()
                .status(HttpStatus.OK.value()).message("Success").data(data).build());
    }

    /** Tệp Excel (.xlsx) của Báo cáo sản phẩm, cùng tham số với /bao-cao/san-pham. Cần quyền Xuất báo cáo. */
    @GetMapping("/bao-cao/san-pham/xuat-excel")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            permissions = {IPermissionType.xuat_bao_cao}, inWarehouse = true)
    public ResponseEntity<byte[]> xuatExcelSanPham(
            @RequestParam String tuNgay,
            @RequestParam String denNgay,
            @RequestParam(required = false) Integer khoId,
            @RequestParam(required = false) String kenh
    ) {
        return baoCaoSanPhamService.xuatExcel(LocalDate.parse(tuNgay), LocalDate.parse(denNgay), khoId, kenh).phanHoi();
    }

    /**
     * Tiền thu trong kỳ của Báo cáo doanh thu (theo ngày thu tiền): tiền mặt, chuyển khoản, hoàn, sàn thu hộ, còn phải
     * thu. Cùng tham số với /bao-cao/doanh-thu; quản lý kho, nhân viên bán hàng chỉ xem các cửa hàng mình được phân công.
     */
    @GetMapping("/bao-cao/tien-thu")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang})
    public ResponseEntity<ResponseData<TienThuDTO>> getTienThu(
            @RequestParam String loai,
            @RequestParam(required = false) String tuNgay,
            @RequestParam(required = false) String denNgay,
            @RequestParam(required = false) Integer nam,
            @RequestParam(required = false) Integer thang,
            @RequestParam(required = false) Integer tuNam,
            @RequestParam(required = false) Integer denNam,
            @RequestParam(required = false) Integer khoId
    ) {
        TienThuDTO data = doanhThuReportService.layTienThu(loai,
                tuNgay == null ? null : LocalDate.parse(tuNgay), denNgay == null ? null : LocalDate.parse(denNgay),
                nam, thang, tuNam, denNam, khoId);
        return ResponseEntity.ok(ResponseData.<TienThuDTO>builder()
                .status(HttpStatus.OK.value()).message("Success").data(data).build());
    }
}
