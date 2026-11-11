package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.trahang.TraHangDto;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.services.impl.trahang.DuyetTraHangService;
import com.dev.backend.services.impl.trahang.TraHangTaiQuayService;
import com.dev.backend.services.impl.trahang.TraHangXacNhanService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Trả hàng tại quầy POS (đặc tả BA "Trả hàng / Đổi hàng tại POS", màn /pos/returns). Cùng vai trò với thanh toán tại
 * quầy; quyền theo cửa hàng nhận trả kiểm ở dịch vụ (PosCatalogService.authorizeWarehouse). Ghi bị khóa cùng công tắc
 * pos.checkout-enabled với bán tại quầy.
 */
@RestController
@RequestMapping("/api/v1/pos/returns")
public class PosTraHangController {

    @Autowired
    private TraHangTaiQuayService traHangService;
    @Autowired
    private TraHangXacNhanService xacNhanService;
    @Autowired
    private DuyetTraHangService duyetService;

    @Value("${pos.checkout-enabled:false}")
    private boolean checkoutEnabled;

    @GetMapping("/search")
    @Operation(summary = "Tìm hóa đơn POS gốc theo mã hóa đơn hoặc số điện thoại khách")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang},
            rolesLogic = RequireAuth.LogicType.OR)
    public ResponseEntity<ResponseData<List<TraHangDto.DonTomTat>>> tim(@RequestParam Integer khoId,
                                                                       @RequestParam String q) {
        return ok(traHangService.tim(q, khoId), "Success");
    }

    @GetMapping("/orders/{donBanHangId}")
    @Operation(summary = "Thông tin đơn gốc và các dòng hàng còn trả được, tính cho cửa hàng nhận khoId")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang},
            rolesLogic = RequireAuth.LogicType.OR)
    public ResponseEntity<ResponseData<TraHangDto.DonGoc>> donGoc(@PathVariable Integer donBanHangId,
                                                                 @RequestParam Integer khoId) {
        return ok(traHangService.donGoc(donBanHangId, khoId), "Success");
    }

    @PostMapping("/approval-requests")
    @Operation(summary = "Yêu cầu quản lý cửa hàng duyệt trả hàng quá 03 ngày (gửi mã PIN qua email)")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang},
            rolesLogic = RequireAuth.LogicType.OR)
    public ResponseEntity<ResponseData<TraHangDto.YeuCauDuyetKetQua>> guiYeuCauDuyet(
            @RequestBody TraHangDto.YeuCauDuyetRequest req) {
        kiemCongTac();
        return ok(duyetService.guiYeuCau(req), ThongDiep.dich("traHang.daGuiMaDuyet"));
    }

    @PostMapping("/approval-requests/{id}/verify")
    @Operation(summary = "Nhập mã PIN quản lý để mở khóa trả hàng quá hạn")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang},
            rolesLogic = RequireAuth.LogicType.OR)
    public ResponseEntity<ResponseData<TraHangDto.DuyetHieuLuc>> nhapMa(@PathVariable Integer id,
                                                                       @RequestBody TraHangDto.NhapMaRequest req) {
        kiemCongTac();
        return ok(duyetService.nhapMa(id, req), ThongDiep.dich("traHang.daDuyet"));
    }

    @PostMapping
    @Operation(summary = "Xác nhận hoàn trả: lập RET, PN-RET, cộng tồn hàng Đạt, cập nhật đơn gốc")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang},
            rolesLogic = RequireAuth.LogicType.OR)
    public ResponseEntity<ResponseData<TraHangDto.KetQua>> xacNhan(@RequestBody TraHangDto.XacNhanRequest req) {
        kiemCongTac();
        TraHangDto.KetQua kq = xacNhanService.xacNhan(req);
        // MSG-RET-04
        return ok(kq, ThongDiep.dich("traHang.daTraHang", kq.soPhieu()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Biên bản trả hàng (in 02 liên)")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang},
            rolesLogic = RequireAuth.LogicType.OR)
    public ResponseEntity<ResponseData<TraHangDto.PhieuChiTiet>> phieu(@PathVariable Integer id) {
        return ok(traHangService.phieu(id), "Success");
    }

    private void kiemCongTac() {
        if (!checkoutEnabled) {
            throw new CommonException(ThongDiep.of("banHang.posChuaKichHoat"), HttpStatus.SERVICE_UNAVAILABLE, null);
        }
    }

    private static <T> ResponseEntity<ResponseData<T>> ok(T data, String message) {
        return ResponseEntity.ok(ResponseData.<T>builder().status(200).data(data).message(message).error(null).build());
    }
}
