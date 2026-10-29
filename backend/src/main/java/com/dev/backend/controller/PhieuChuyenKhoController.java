package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.PhieuChuyenKhoCreating;
import com.dev.backend.dto.request.PhieuChuyenKhoYeuCau;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.PhieuChuyenKhoDto;
import com.dev.backend.entities.BienBanGiaoNhan;
import com.dev.backend.entities.PhieuChuyenKho;
import com.dev.backend.entities.PhieuDieuChinhKho;
import com.dev.backend.entities.PhieuNhapKho;
import com.dev.backend.entities.PhieuXuatKho;
import com.dev.backend.services.impl.entities.AnhBienBanGiaoNhanService;
import com.dev.backend.services.impl.entities.PhieuChuyenKhoService;
import com.dev.backend.utils.ThuLaiKhiTrungSo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Chuyển kho nội bộ theo đặc tả BA (UC-7.1). Quyền chi tiết theo vai trò và kho kiểm ở PhieuChuyenKhoService;
 * chi tiết phiếu trả về {@code quyen} để giao diện chỉ hiện nút người đang xem được bấm.
 */
@RestController
@RequestMapping("/api/v1/phieu-chuyen-kho")
@RequiredArgsConstructor
public class PhieuChuyenKhoController {

    private final PhieuChuyenKhoService phieuChuyenKhoService;
    private final AnhBienBanGiaoNhanService anhBienBanGiaoNhanService;

    /** Danh sách (B.6): tab TAT_CA | CHO_DUYET | DANG_VAN_CHUYEN | TRE_HEN | CHO_XU_LY_LECH | THIEU_XKNB, kèm số theo tab. */
    @GetMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<PhieuChuyenKhoDto.DanhSach>> danhSach(
            @RequestParam(required = false) String tab,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer khoXuatId,
            @RequestParam(required = false) Integer khoNhapId,
            @RequestParam(required = false) String trangThai,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ok(phieuChuyenKhoService.danhSach(tab, q, khoXuatId, khoNhapId, trangThai, page, size), "Lấy danh sách phiếu chuyển kho thành công");
    }

    /** Số phiếu XKNB tiếp theo của ký hiệu (điền sẵn ở hộp Xác nhận xuất / Ghi số XKNB). */
    @GetMapping("/xknb/so-tiep-theo")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> soXknbTiepTheo(@RequestParam String kyHieu) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("kyHieuXknb", kyHieu.trim().toUpperCase(java.util.Locale.ROOT));
        data.put("soPhieuXknb", phieuChuyenKhoService.soXknbTiepTheo(kyHieu));
        return ok(data, "Số phiếu XKNB tiếp theo");
    }

    @GetMapping("/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<PhieuChuyenKhoDto.ChiTiet>> chiTiet(@PathVariable Integer id) {
        return ok(phieuChuyenKhoService.chiTiet(id), "Lấy chi tiết phiếu chuyển thành công");
    }

    @PostMapping("/create")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> tao(@RequestBody PhieuChuyenKhoCreating yeuCau) {
        return ok(tomTat(ThuLaiKhiTrungSo.chay(() -> phieuChuyenKhoService.tao(yeuCau))), "Đã tạo yêu cầu chuyển kho, đang chờ duyệt");
    }

    @PutMapping("/{id}/duyet")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> duyet(@PathVariable Integer id, @RequestBody PhieuChuyenKhoYeuCau.Duyet yeuCau) {
        PhieuChuyenKho p = ThuLaiKhiTrungSo.chay(() -> phieuChuyenKhoService.duyet(id, yeuCau));
        Map<String, Object> data = tomTat(p);
        data.put("soLenhDieuDong", p.getSoLenhDieuDong());
        return ok(data, "Đã duyệt và lập lệnh điều động " + p.getSoLenhDieuDong());
    }

    @PutMapping("/{id}/huy")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> huy(@PathVariable Integer id, @RequestBody(required = false) PhieuChuyenKhoYeuCau.Huy yeuCau) {
        return ok(tomTat(phieuChuyenKhoService.huy(id, yeuCau)), "Đã hủy phiếu chuyển kho");
    }

    /**
     * Mở phiếu nhặt (N7): đảm bảo phiếu Đã duyệt có PX-CK và phiếu nhặt (tạo nếu chưa có). Trả id / số PX-CK như trước,
     * kèm phieuNhatId / maPickList; phieuNhatId null = phiếu cũ đã chọn lô tay, mở màn phiếu xuất như cũ.
     */
    @PostMapping("/{id}/phieu-xuat")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> phieuXuat(@PathVariable Integer id) {
        PhieuChuyenKhoService.MoPhieuNhat kq = ThuLaiKhiTrungSo.chay(() -> phieuChuyenKhoService.damBaoPhieuXuat(id));
        PhieuXuatKho px = kq.phieuXuat();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", px.getId());
        data.put("soPhieuXuat", px.getSoPhieuXuat());
        data.put("phieuNhatId", kq.phieuNhat() == null ? null : kq.phieuNhat().getId());
        data.put("maPickList", kq.phieuNhat() == null ? null : kq.phieuNhat().getMaPickList());
        return ok(data, kq.phieuNhat() != null ? "Phiếu nhặt " + kq.phieuNhat().getMaPickList() : "Phiếu xuất " + px.getSoPhieuXuat());
    }

    @PutMapping("/{id}/xac-nhan-xuat")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> xacNhanXuat(@PathVariable Integer id, @RequestBody PhieuChuyenKhoYeuCau.XacNhanXuat yeuCau) {
        return ok(tomTat(phieuChuyenKhoService.xacNhanXuat(id, yeuCau)), "Đã xác nhận xuất, hàng đang trên đường");
    }

    @PutMapping("/{id}/ghi-so-xknb")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> ghiSoXknb(@PathVariable Integer id, @RequestBody PhieuChuyenKhoYeuCau.GhiSoXknb yeuCau) {
        return ok(tomTat(phieuChuyenKhoService.ghiSoXknb(id, yeuCau)), "Đã ghi số phiếu XKNB");
    }

    @PutMapping("/{id}/nhan-du")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> nhanDu(@PathVariable Integer id) {
        PhieuNhapKho pn = ThuLaiKhiTrungSo.chay(() -> phieuChuyenKhoService.nhanDu(id));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("phieuNhapId", pn.getId());
        data.put("soPhieuNhap", pn.getSoPhieuNhap());
        return ok(data, "Đã nhận đủ hàng, phiếu nhập " + pn.getSoPhieuNhap());
    }

    @PutMapping("/{id}/nhan-lech")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> nhanLech(@PathVariable Integer id, @RequestBody PhieuChuyenKhoYeuCau.NhanLech yeuCau) {
        BienBanGiaoNhan bb = ThuLaiKhiTrungSo.chay(() -> phieuChuyenKhoService.nhanLech(id, yeuCau));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("bienBanId", bb.getId());
        data.put("soBienBan", bb.getSoBienBan());
        return ok(data, "Đã nhận phần đạt và lập biên bản " + bb.getSoBienBan());
    }

    /**
     * Thêm một ảnh chụp vào biên bản giao nhận (mockup B.4, không bắt buộc): multipart `file` (JPEG / PNG / WebP, tới
     * 10 MB) và `moTa` (tùy chọn, tối đa 255 ký tự). Kho nhận thêm khi biên bản còn chờ xử lý, tối đa 6 ảnh.
     */
    @PostMapping("/{id}/bien-ban/anh")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<PhieuChuyenKhoDto.AnhBienBan>> themAnhBienBan(
            @PathVariable Integer id,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "moTa", required = false) String moTa) {
        return ok(anhBienBanGiaoNhanService.them(id, file, moTa), "Đã thêm ảnh vào biên bản giao nhận");
    }

    /** Xóa một ảnh của biên bản giao nhận: người tải lên, quản lý kho nhận hoặc quản trị viên, khi biên bản còn chờ xử lý. */
    @DeleteMapping("/{id}/bien-ban/anh/{anhId}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Void>> xoaAnhBienBan(@PathVariable Integer id, @PathVariable Integer anhId) {
        anhBienBanGiaoNhanService.xoa(id, anhId);
        return ok(null, "Đã xóa ảnh khỏi biên bản giao nhận");
    }

    @PutMapping("/{id}/xu-ly-chenh-lech")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> xuLyChenhLech(@PathVariable Integer id, @RequestBody PhieuChuyenKhoYeuCau.XuLyChenhLech yeuCau) {
        PhieuDieuChinhKho dck = ThuLaiKhiTrungSo.chay(() -> phieuChuyenKhoService.xuLyChenhLech(id, yeuCau));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("phieuDieuChinhId", dck.getId());
        data.put("soPhieuDieuChinh", dck.getSoPhieu());
        return ok(data, "Đã xử lý chênh lệch, phiếu điều chỉnh " + dck.getSoPhieu());
    }

    @PutMapping("/{id}/nhap-hoan-tra")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Map<String, Object>>> nhapHoanTra(@PathVariable Integer id) {
        PhieuNhapKho pn = ThuLaiKhiTrungSo.chay(() -> phieuChuyenKhoService.nhapHoanTra(id));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("phieuNhapId", pn.getId());
        data.put("soPhieuNhap", pn.getSoPhieuNhap());
        return ok(data, "Đã nhập hoàn trả, phiếu nhập " + pn.getSoPhieuNhap());
    }

    /** Phiếu điều chỉnh kho ghi giảm chênh lệch của phiếu chuyển. */
    @GetMapping("/dieu-chinh/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<PhieuChuyenKhoDto.PhieuDieuChinh>> phieuDieuChinh(@PathVariable Integer id) {
        return ok(phieuChuyenKhoService.phieuDieuChinh(id), "Lấy phiếu điều chỉnh kho thành công");
    }

    private static Map<String, Object> tomTat(PhieuChuyenKho p) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", p.getId());
        data.put("soPhieuChuyen", p.getSoPhieuChuyen());
        data.put("trangThai", p.getTrangThai());
        return data;
    }

    private static <T> ResponseEntity<ResponseData<T>> ok(T data, String message) {
        return ResponseEntity.ok(ResponseData.<T>builder().status(HttpStatus.OK.value()).data(data).message(message).build());
    }
}
