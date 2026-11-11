package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.chuyenke.ChuyenKeDto;
import com.dev.backend.dto.chuyenke.ChuyenKeYeuCau;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.entities.Kho;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.services.impl.kiemke.ChuyenKeNoiBoService;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.ThuLaiKhiTrungSo;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * Chuyển kệ nội bộ (UC-7.4, đặc tả BA 11/11): Scan-to-Move trong một kho, sinh phiếu MV-YYYYMMDD-XXXX.
 * Người làm (BA "Primary Actor"): nhân viên kho, nhân viên bán hàng kiêm kho cửa hàng, quản lý kho, quản trị viên — tại
 * kho được phân công. Cất vượt sức chứa kệ (Manager Override) chỉ quản lý kho / quản trị viên (service kiểm).
 */
@RestController
@RequestMapping("/api/v1/chuyen-ke")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class ChuyenKeNoiBoController {

    private final ChuyenKeNoiBoService service;

    private static <T> ResponseEntity<ResponseData<T>> ok(T data, String message) {
        return ResponseEntity.ok(ResponseData.<T>builder().status(200).data(data).message(message).build());
    }

    private static void kiemTraKho(Integer khoId) {
        KhoDangChon.kiemTra(Kho.builder().id(khoId).build(), "Kho đang chọn");
    }

    @GetMapping("/ke")
    @Operation(summary = "Tra kệ theo mã quét: thông tin, sức chứa, hàng trên kệ theo lô và số khả dụng chuyển")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_ban_hang},
            inWarehouse = true)
    public ResponseEntity<ResponseData<ChuyenKeDto.Ke>> traKe(@RequestParam Integer khoId, @RequestParam String ma) {
        kiemTraKho(khoId);
        return ok(service.traKe(khoId, ma), ThongDiep.dich("khoVanHanh.chuyenKeLayKeThanhCong"));
    }

    @GetMapping("/ds-ke")
    @Operation(summary = "Danh sách kệ của kho để gợi ý khi gõ mã kệ")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_ban_hang},
            inWarehouse = true)
    public ResponseEntity<ResponseData<java.util.List<ChuyenKeDto.KeGon>>> dsKe(@RequestParam Integer khoId) {
        kiemTraKho(khoId);
        return ok(service.dsKe(khoId), ThongDiep.dich("khoVanHanh.chuyenKeLayKeThanhCong"));
    }

    @PostMapping
    @Operation(summary = "Xác nhận chuyển kệ: giao dịch nguyên tử trừ kệ nguồn, cộng các kệ đích, sinh phiếu MV")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_ban_hang},
            inWarehouse = true)
    public ResponseEntity<ResponseData<ChuyenKeDto.KetQua>> thucHien(@RequestParam Integer khoId, @RequestBody ChuyenKeYeuCau yc) {
        kiemTraKho(khoId);
        ChuyenKeDto.KetQua kq = ThuLaiKhiTrungSo.chay(() -> service.thucHien(khoId, yc));
        return ok(kq, ThongDiep.dich("khoVanHanh.chuyenKeDaChuyen", kq.tongSoLuong(), kq.maPhieu()));
    }

    @GetMapping
    @Operation(summary = "Lịch sử phiếu chuyển kệ của kho, mới nhất trước")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_ban_hang},
            inWarehouse = true)
    public ResponseEntity<ResponseData<ChuyenKeDto.Trang>> danhSach(
            @RequestParam Integer khoId, @RequestParam(required = false) String tim,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate tuNgay,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate denNgay,
            @RequestParam(defaultValue = "0") int trang, @RequestParam(defaultValue = "20") int kichThuoc) {
        KhoDangChon.kiemTraXem(Kho.builder().id(khoId).build(), "Kho đang chọn");
        return ok(service.danhSach(khoId, tim, tuNgay, denNgay, trang, kichThuoc),
                ThongDiep.dich("khoVanHanh.chuyenKeLayDanhSachThanhCong"));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết một phiếu chuyển kệ")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_ban_hang})
    public ResponseEntity<ResponseData<ChuyenKeDto.Phieu>> chiTiet(@PathVariable Integer id) {
        return ok(service.chiTiet(id), ThongDiep.dich("khoVanHanh.chuyenKeLayPhieuThanhCong"));
    }
}
