package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.TimKiemDto;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.services.impl.multitable.TimKiemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Ô tìm kiếm toàn hệ thống trên thanh trên cùng của backoffice (Ctrl + K). */
@RestController
@RequestMapping("/api/v1/tim-kiem")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class TimKiemController {

    private final TimKiemService timKiemService;

    /**
     * Tìm sản phẩm, đơn bán, khách hàng, nhà cung cấp, chứng từ theo một từ khóa. Mỗi nhóm chỉ có khi vai trò được vào
     * trang danh sách tương ứng, và chỉ gồm các bản ghi trang danh sách đó cho xem.
     *
     * @param q    từ khóa (từ 2 ký tự)
     * @param nhom chỉ tìm một nhóm: sanPham | donBan | khachHang | nhaCungCap | chungTu
     * @param size số dòng mỗi nhóm, 1–10 (mặc định 3)
     */
    @GetMapping
    @RequireAuth(roles = {
            IRoleType.quan_tri_vien,
            IRoleType.quan_ly_kho,
            IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_mua_hang,
            IRoleType.nhan_vien_ban_hang
    })
    public ResponseEntity<ResponseData<TimKiemDto>> tim(@RequestParam(required = false) String q,
                                                        @RequestParam(required = false) String nhom,
                                                        @RequestParam(required = false) Integer size) {
        return ResponseEntity.ok(ResponseData.<TimKiemDto>builder()
                .status(200)
                .data(timKiemService.tim(q, nhom, size))
                .message(ThongDiep.dich("heThong.timKiemXong"))
                .build());
    }
}
