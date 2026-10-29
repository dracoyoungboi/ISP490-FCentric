package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.ThongBaoDto;
import com.dev.backend.services.impl.entities.ThongBaoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thông báo của người đang đăng nhập (chuông trên thanh trên cùng). Mọi vai trò nội bộ dùng được, không cần kho đang
 * chọn; chỉ đọc / đánh dấu được thông báo của chính mình (người nhận lấy từ token, không nhận từ frontend).
 */
@RestController
@RequestMapping("/api/v1/thong-bao")
@RequiredArgsConstructor
public class ThongBaoController {

    private final ThongBaoService thongBaoService;

    /** Một trang thông báo, mới nhất trước: { content, totalElements, totalPages, soChuaDoc }. chuaDoc = true: chỉ chưa đọc. */
    @GetMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang, IRoleType.nhan_vien_mua_hang})
    public ResponseEntity<ResponseData<ThongBaoDto.DanhSach>> danhSach(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @RequestParam(defaultValue = "false") boolean chuaDoc) {
        return ok(thongBaoService.danhSach(page, size, chuaDoc), "Lấy danh sách thông báo thành công");
    }

    /** Đánh dấu một thông báo đã đọc → { id, soChuaDoc }. Thông báo không phải của mình: 404. */
    @PutMapping("/{id}/da-doc")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang, IRoleType.nhan_vien_mua_hang})
    public ResponseEntity<ResponseData<Map<String, Object>>> danhDauDaDoc(@PathVariable Long id) {
        long soChuaDoc = thongBaoService.danhDauDaDoc(id);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", id);
        data.put("soChuaDoc", soChuaDoc);
        return ok(data, "Đã đánh dấu đã đọc");
    }

    /** Đánh dấu mọi thông báo của mình đã đọc → { soDaDanhDau, soChuaDoc: 0 }. */
    @PutMapping("/da-doc-tat-ca")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho,
            IRoleType.nhan_vien_ban_hang, IRoleType.nhan_vien_mua_hang})
    public ResponseEntity<ResponseData<Map<String, Object>>> danhDauTatCaDaDoc() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("soDaDanhDau", thongBaoService.danhDauTatCaDaDoc());
        data.put("soChuaDoc", 0);
        return ok(data, "Đã đánh dấu tất cả thông báo đã đọc");
    }

    private static <T> ResponseEntity<ResponseData<T>> ok(T data, String message) {
        return ResponseEntity.ok(ResponseData.<T>builder()
                .status(HttpStatus.OK.value())
                .data(data)
                .message(message)
                .error(null)
                .build());
    }
}
