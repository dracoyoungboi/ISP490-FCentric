package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.inbound.GiaoTraHangLoiRequest;
import com.dev.backend.dto.request.inbound.PhatHanhBienBanRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.dto.response.inbound.DanhSachTraHangNccDto;
import com.dev.backend.services.BienBanTraHangService;
import com.dev.backend.services.impl.entities.NhatKyTraHangNcc;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.dev.backend.i18n.ThongDiep;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BienBanTraHangController {

    BienBanTraHangService bienBanTraHangService;

    // Xem biên bản trả hàng của phiếu nhập: nhân viên mua hàng chỉ xem (SRS 4.4 "Goods Receipt")
    @GetMapping("/api/v1/phieu-nhap-kho/{phieuNhapKhoId}/bien-ban-tra-hang")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> layTheoPhieuNhap(@PathVariable Integer phieuNhapKhoId) {
        BienBanTraHangDto dto = bienBanTraHangService.layTheoPhieuNhap(phieuNhapKhoId);
        return ResponseEntity.ok(ResponseData.<BienBanTraHangDto>builder()
                .status(HttpStatus.OK.value())
                .message(ThongDiep.dich("chungTuKho.thanhCong"))
                .data(dto)
                .build());
    }

    @PostMapping("/api/v1/phieu-nhap-kho/{phieuNhapKhoId}/bien-ban-tra-hang")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> phatHanh(
            @PathVariable Integer phieuNhapKhoId,
            @RequestBody PhatHanhBienBanRequest request
    ) {
        Integer nguoiTaoId = SecurityContextHolder.getUser().getId();
        BienBanTraHangDto dto = bienBanTraHangService.phatHanh(phieuNhapKhoId, request, nguoiTaoId);
        return ResponseEntity.ok(ResponseData.<BienBanTraHangDto>builder()
                .status(HttpStatus.OK.value())
                // Lập lại khi phiếu không còn hàng lỗi thì biên bản bị hủy (data null): câu báo nói đúng việc đã làm
                .message(dto == null ? ThongDiep.dich("chungTuKho.daHuyBienBanTraHangHetHangLoi")
                        : NhatKyTraHangNcc.KY_CHO.equals(dto.getKyBienBan()) ? ThongDiep.dich("chungTuKho.lapBienBanChoKy")
                        : ThongDiep.dich("chungTuKho.phatHanhBienBanTraHangThanhCong"))
                .data(dto)
                .build());
    }

    /** Tab Trả hàng ở chi tiết nhà cung cấp, khối hàng lỗi ở chi tiết đơn mua, dòng chú ý hàng lỗi còn treo. Bộ lọc không bắt buộc. */
    @GetMapping("/api/v1/bien-ban-tra-hang-ncc")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<DanhSachTraHangNccDto>> danhSach(
            @RequestParam(required = false) Integer nhaCungCapId,
            @RequestParam(required = false) Integer donMuaHangId,
            @RequestParam(required = false) String trangThai,
            @RequestParam(required = false) String tuKhoa) {
        return ok(bienBanTraHangService.danhSach(nhaCungCapId, donMuaHangId, trangThai, tuKhoa), "chungTuKho.thanhCong");
    }

    @GetMapping("/api/v1/bien-ban-tra-hang-ncc/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> chiTiet(@PathVariable Integer id) {
        return ok(bienBanTraHangService.chiTiet(id), "chungTuKho.thanhCong");
    }

    /** Kho ghi người giao hàng đã ký biên bản giấy; biên bản gửi email cho nhà cung cấp sau bước này. */
    @PostMapping("/api/v1/bien-ban-tra-hang-ncc/{id}/ky")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> ghiKy(@PathVariable Integer id) {
        BienBanTraHangDto dto = bienBanTraHangService.ghiKy(id);
        // Nhà cung cấp chưa có email: biên bản chưa gửi được, báo để mua hàng thêm email rồi gửi lại
        boolean coEmail = dto.getEmailNcc() != null && !dto.getEmailNcc().isBlank();
        return ok(dto, coEmail ? "chungTuKho.daGhiNguoiGiaoKy" : "chungTuKho.daGhiNguoiGiaoKyChuaCoEmail");
    }

    /** Mua hàng gửi lại email biên bản cho nhà cung cấp (lần trước chưa gửi được, hoặc nhà cung cấp mới thêm email). */
    @PostMapping("/api/v1/bien-ban-tra-hang-ncc/{id}/gui-lai-email")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.nhan_vien_mua_hang},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> guiLaiEmail(@PathVariable Integer id) {
        return ok(bienBanTraHangService.guiLaiEmail(id), "chungTuKho.daGuiLaiEmailBienBan");
    }

    /** Kho ghi đã giao trả hàng lỗi cho nhà cung cấp. */
    @PostMapping("/api/v1/bien-ban-tra-hang-ncc/{id}/giao-tra")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> giaoTra(@PathVariable Integer id, @RequestBody GiaoTraHangLoiRequest request) {
        return ok(bienBanTraHangService.ghiDaGiaoTra(id, request), "chungTuKho.daGhiGiaoTraHangLoi");
    }

    /** Quản lý kho ghi tiêu hủy hàng lỗi khi nhà cung cấp đồng ý không lấy lại. */
    @PostMapping("/api/v1/bien-ban-tra-hang-ncc/{id}/tieu-huy")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho},
            inWarehouse = true,
            rolesLogic = RequireAuth.LogicType.OR
    )
    public ResponseEntity<ResponseData<BienBanTraHangDto>> tieuHuy(@PathVariable Integer id, @RequestBody GiaoTraHangLoiRequest request) {
        return ok(bienBanTraHangService.ghiTieuHuy(id, request), "chungTuKho.daGhiTieuHuyHangLoi");
    }

    private static <T> ResponseEntity<ResponseData<T>> ok(T data, String khoaThongDiep) {
        return ResponseEntity.ok(ResponseData.<T>builder()
                .status(HttpStatus.OK.value())
                .message(ThongDiep.dich(khoaThongDiep))
                .data(data)
                .build());
    }
}

