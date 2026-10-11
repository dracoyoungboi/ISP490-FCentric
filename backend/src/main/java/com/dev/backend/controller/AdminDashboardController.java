package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.AdminDashboardResponse;
import com.dev.backend.dto.response.DoanhThuChartDTO;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.services.impl.multitable.DoanhThuReportService;
import com.dev.backend.services.multitable.AdminDashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    @Autowired
    private DoanhThuReportService doanhThuReportService;

    public AdminDashboardController(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    @GetMapping
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<AdminDashboardResponse>> getDashboardByAdmin(
            @RequestHeader("Authorization") String authHeader
    ) {

        return ResponseEntity.ok(
                ResponseData.<AdminDashboardResponse>builder()
                        .status(HttpStatus.OK.value())
                        .data(adminDashboardService.getDashboard())
                        .message("Lấy dashboard admin thành công")
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
                    throw new IllegalArgumentException("Vui lòng chọn từ ngày và đến ngày");
                yield doanhThuReportService.layBaoCaoTheoNgay(
                        LocalDate.parse(tuNgay), LocalDate.parse(denNgay), khoId);
            }

            case "tuan" -> {
                if (nam == null)
                    throw new IllegalArgumentException("Vui lòng chọn năm");
                yield doanhThuReportService.layBaoCaoTheoTuan(nam, khoId);
            }

            case "thang" -> {
                if (nam == null)
                    throw new IllegalArgumentException("Vui lòng chọn năm");
                yield doanhThuReportService.layBaoCaoTheoThang(nam, khoId);
            }

            case "nam" -> {
                if (tuNam == null || denNam == null)
                    throw new IllegalArgumentException("Vui lòng chọn từ năm và đến năm");
                yield doanhThuReportService.layBaoCaoTheoNam(tuNam, denNam, khoId);
            }

            case "so_sanh" -> {
                if (nam == null || thang == null)
                    throw new IllegalArgumentException("Vui lòng chọn năm và tháng cần so sánh");
                yield doanhThuReportService.laySoSanhCungKy(nam, thang, khoId);
            }

            default -> throw new IllegalArgumentException(
                    "Kiểu báo cáo không hợp lệ");
        };

        return ResponseEntity.ok(
                ResponseData.<List<DoanhThuChartDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .message("Success")
                        .data(data)
                        .build()
        );
    }
}
