package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.*;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.ketoan.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.impl.ketoan.CauHinhKeToanService;
import com.dev.backend.services.impl.ketoan.HoaDonDauVaoService;
import com.dev.backend.services.impl.ketoan.ThueSuatService;
import com.dev.backend.services.impl.ketoan.XuatKeToanService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * API xuất dữ liệu kế toán (AMIS Kế toán doanh nghiệp).
 * - Cấu hình, thuế suất, xem trước, tạo lô, tải tệp, mở khóa: chỉ quan_tri_vien (chốt 25/10/2026; chưa có vai trò kế toán).
 * - Hóa đơn nhà cung cấp của phiếu nhập: xem với người xem được phiếu nhập; nhập / sửa với quản trị viên, quản lý kho,
 *   nhân viên mua hàng (service kiểm thêm kho đang chọn).
 */
@RestController
@RequestMapping("/api/v1/ke-toan")
public class KeToanController {

    private final CauHinhKeToanService cauHinhKeToanService;
    private final ThueSuatService thueSuatService;
    private final XuatKeToanService xuatKeToanService;
    private final HoaDonDauVaoService hoaDonDauVaoService;

    public KeToanController(CauHinhKeToanService cauHinhKeToanService,
                            ThueSuatService thueSuatService,
                            XuatKeToanService xuatKeToanService,
                            HoaDonDauVaoService hoaDonDauVaoService) {
        this.cauHinhKeToanService = cauHinhKeToanService;
        this.thueSuatService = thueSuatService;
        this.xuatKeToanService = xuatKeToanService;
        this.hoaDonDauVaoService = hoaDonDauVaoService;
    }

    // ── Cấu hình ───────────────────────────────────────────────────────────

    @GetMapping("/cau-hinh")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<CauHinhKeToanDto>> layCauHinh() {
        return ok(cauHinhKeToanService.layDto());
    }

    @PutMapping("/cau-hinh")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<CauHinhKeToanDto>> luuCauHinh(@RequestBody CauHinhKeToanRequest request) {
        return ok(cauHinhKeToanService.capNhat(request));
    }

    // ── Thuế suất ──────────────────────────────────────────────────────────

    @GetMapping("/thue-suat")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<List<ThueSuatGtgtDto>>> danhSachThueSuat() {
        return ok(thueSuatService.danhSach());
    }

    @PostMapping("/thue-suat")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<ThueSuatGtgtDto>> themThueSuat(@RequestBody ThueSuatGtgtRequest request) {
        return ok(thueSuatService.them(request));
    }

    @PutMapping("/thue-suat/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<ThueSuatGtgtDto>> suaThueSuat(@PathVariable Integer id,
                                                                     @RequestBody ThueSuatGtgtRequest request) {
        return ok(thueSuatService.sua(id, request));
    }

    @DeleteMapping("/thue-suat/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<Void>> xoaThueSuat(@PathVariable Integer id) {
        thueSuatService.xoa(id);
        return ok(null);
    }

    // ── Xuất theo lô ───────────────────────────────────────────────────────

    /** Kiểm tra trước khi tạo lô: denNgay dạng yyyy-MM-dd. */
    @GetMapping("/xem-truoc")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<XemTruocXuatKeToanDto>> xemTruoc(@RequestParam String denNgay) {
        return ok(xuatKeToanService.xemTruoc(ngay(denNgay)));
    }

    @PostMapping("/lo-xuat")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<LoXuatKeToanDto>> taoLo(@RequestBody TaoLoXuatKeToanRequest request) {
        return ok(xuatKeToanService.taoLo(request));
    }

    @GetMapping("/lo-xuat")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<List<LoXuatKeToanDto>>> danhSachLo() {
        return ok(xuatKeToanService.danhSachLo());
    }

    @GetMapping("/lo-xuat/{id}/chung-tu")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<List<ChungTuXuatKeToanDto>>> chungTuCuaLo(@PathVariable Integer id) {
        return ok(xuatKeToanService.chungTuCuaLo(id));
    }

    /** Tệp nén của lô (đúng bản đã giao); header X-Ma-Bam là SHA-256 của tệp. */
    @GetMapping("/lo-xuat/{id}/tep")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<byte[]> taiTep(@PathVariable Integer id) {
        XuatKeToanService.TepTai tep = xuatKeToanService.taiTep(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                // Tên tệp là số lô (KT-yyyyMMdd-n.zip, toàn ký tự ASCII): ghi filename thường cho mọi trình duyệt đọc được
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(tep.ten()).build().toString())
                .header("X-Ma-Bam", tep.maBam())
                .contentLength(tep.noiDung().length)
                .body(tep.noiDung());
    }

    @PostMapping("/chung-tu-xuat/{id}/mo-khoa")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<ChungTuXuatKeToanDto>> moKhoa(@PathVariable Integer id,
                                                                     @RequestBody MoKhoaChungTuRequest request) {
        return ok(xuatKeToanService.moKhoa(id, request == null ? null : request.getLyDo()));
    }

    // ── Hóa đơn nhà cung cấp của phiếu nhập ───────────────────────────────

    @GetMapping("/hoa-don-dau-vao/{phieuNhapKhoId}")
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_mua_hang
    })
    public ResponseEntity<ResponseData<HoaDonDauVaoDto>> layHoaDon(@PathVariable Integer phieuNhapKhoId) {
        return ok(hoaDonDauVaoService.lay(phieuNhapKhoId));
    }

    @PutMapping("/hoa-don-dau-vao/{phieuNhapKhoId}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_mua_hang})
    public ResponseEntity<ResponseData<HoaDonDauVaoDto>> luuHoaDon(@PathVariable Integer phieuNhapKhoId,
                                                                    @RequestBody HoaDonDauVaoRequest request) {
        return ok(hoaDonDauVaoService.luu(phieuNhapKhoId, request));
    }

    // ── Tiện ích ───────────────────────────────────────────────────────────

    private static LocalDate ngay(String chu) {
        try {
            return LocalDate.parse(chu);
        } catch (DateTimeParseException | NullPointerException e) {
            throw new CommonException("Ngày không hợp lệ (định dạng yyyy-MM-dd)");
        }
    }

    private static <T> ResponseEntity<ResponseData<T>> ok(T data) {
        return ResponseEntity.ok(ResponseData.<T>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(data)
                .build());
    }
}
