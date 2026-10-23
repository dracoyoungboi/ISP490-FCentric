package com.dev.backend.controller;

import com.dev.backend.customizeanotation.RequireAuth;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Hai API trước đây gọi được không cần đăng nhập (M-1): danh sách kho kèm quản lý (tên đăng nhập, email, SĐT) và chi
 * tiết sản phẩm kèm giá vốn, người tạo. SecurityConfig để permitAll, nên chỉ @RequireAuth trên method mới chặn.
 */
class EndpointCanDangNhapTest {

    private static Method theoDuongDan(Class<?> controller, String duongDan) {
        return Arrays.stream(controller.getDeclaredMethods())
                .filter(m -> m.isAnnotationPresent(GetMapping.class))
                .filter(m -> Arrays.asList(m.getAnnotation(GetMapping.class).value()).contains(duongDan))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Không thấy GET " + duongDan + " trong " + controller.getSimpleName()));
    }

    @Test
    void danhSachKho_batBuocDangNhap() {
        assertNotNull(theoDuongDan(KhoController.class, "/all").getAnnotation(RequireAuth.class));
    }

    @Test
    void chiTietSanPham_batBuocDangNhap() {
        RequireAuth yeuCau = theoDuongDan(SanPhamQuanAoController.class, "/get-by-id/{id}").getAnnotation(RequireAuth.class);
        assertNotNull(yeuCau);
        assertTrue(yeuCau.roles().length > 0);
    }
}
