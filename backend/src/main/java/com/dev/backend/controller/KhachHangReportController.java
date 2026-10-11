package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.KhachHangTangTruongDTO;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.repository.KhachHangReportRepository;
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
    private KhachHangReportRepository khachHangReportRepository;
    // test
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
        List<KhachHangTangTruongDTO> data = switch (loai) {

            case "ngay" -> {
                if (tuNgay == null || denNgay == null)
                    throw new IllegalArgumentException("Vui lòng chọn từ ngày và đến ngày");
                yield khachHangReportRepository.baoCaoTheoNgay(
                        LocalDate.parse(tuNgay), LocalDate.parse(denNgay), khoId);
            }

            case "tuan" -> {
                if (nam == null)
                    throw new IllegalArgumentException("Vui lòng chọn năm");
                yield khachHangReportRepository.baoCaoTheoTuan(nam, khoId);
            }

            case "thang" -> {
                if (nam == null)
                    throw new IllegalArgumentException("Vui lòng chọn năm");
                yield khachHangReportRepository.baoCaoTheoThang(nam, khoId);
            }

            case "nam" -> {
                if (tuNam == null || denNam == null)
                    throw new IllegalArgumentException("Vui lòng chọn từ năm và đến năm");
                yield khachHangReportRepository.baoCaoTheoNam(tuNam, denNam, khoId);
            }

            case "so_sanh" -> {
                if (nam == null || thang == null)
                    throw new IllegalArgumentException("Vui lòng chọn năm và tháng cần so sánh");
                // Tính tháng trước
                int thangTruoc = (thang == 1) ? 12 : thang - 1;
                int namTruoc   = (thang == 1) ? nam - 1 : nam;
                yield khachHangReportRepository.soSanhCungKy(nam, thang, namTruoc, thangTruoc, khoId);
            }

            default -> throw new IllegalArgumentException(
                    "Kiểu báo cáo không hợp lệ");
        };

        return ResponseEntity.ok(
                ResponseData.<List<KhachHangTangTruongDTO>>builder()
                        .status(HttpStatus.OK.value())
                        .message("Lấy báo cáo tăng trưởng khách hàng thành công")
                        .data(data)
                        .build()
        );
    }
}