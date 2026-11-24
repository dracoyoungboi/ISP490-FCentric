package com.dev.backend.controller;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.services.impl.payos.PosPayosService;
import com.dev.backend.services.multitable.NhatHangService;
import com.dev.backend.websocket.VeKetNoiRealtime;
import com.dev.backend.websocket.VeKetNoiRealtime.DangKy;
import com.dev.backend.websocket.VeKetNoiRealtime.Kenh;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Cấp vé mở kênh realtime (xem {@link VeKetNoiRealtime}). Mỗi API dùng đúng vai trò và luật xem của màn tương ứng,
 * nên ai mở được màn thì nghe được, người khác không xin được vé.
 */
@RestController
@RequestMapping("/api/v1/realtime/ve")
@RequiredArgsConstructor
public class RealtimeController {

    private final VeKetNoiRealtime veKetNoi;
    private final PosPayosService posPayosService;
    private final NhatHangService nhatHangService;

    @PostMapping("/thanh-toan/{orderCode}")
    @Operation(summary = "Vé nghe kết quả chuyển khoản của một đơn POS qua /ws-pos (cùng quyền với hỏi trạng thái)")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.nhan_vien_ban_hang})
    public ResponseEntity<ResponseData<Map<String, String>>> veThanhToan(@PathVariable Long orderCode) {
        posPayosService.kiemTraXemGiaoDich(orderCode);
        return capVe(new DangKy(Kenh.THANH_TOAN_POS, orderCode));
    }

    @PostMapping("/phieu-nhat/{pickListId}")
    @Operation(summary = "Vé nghe sự kiện hủy đơn của một phiếu nhặt qua /ws-outbound (cùng quyền với xem phiếu)")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho},
            inWarehouse = true
    )
    public ResponseEntity<ResponseData<Map<String, String>>> vePhieuNhat(@PathVariable Integer pickListId) {
        nhatHangService.kiemTraXemPhieuNhat(pickListId);
        return capVe(new DangKy(Kenh.PHIEU_NHAT, pickListId));
    }

    private ResponseEntity<ResponseData<Map<String, String>>> capVe(DangKy dangKy) {
        String ve = veKetNoi.cap(dangKy, SecurityContextHolder.getUser().getId()).orElseThrow(() ->
                new CommonException(HttpStatus.TOO_MANY_REQUESTS, ThongDiep.of("heThong.realtimeDangBan")));
        return ResponseEntity.ok(ResponseData.<Map<String, String>>builder()
                .status(HttpStatus.OK.value())
                .data(Map.of("ve", ve))
                .message("Success")
                .build());
    }
}
