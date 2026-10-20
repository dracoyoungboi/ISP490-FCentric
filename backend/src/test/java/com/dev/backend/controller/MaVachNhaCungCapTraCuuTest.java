package com.dev.backend.controller;

import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.exception.RestControllerGlobalExceptionHandler;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.MaVachNhaCungCapService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * POST /tra-cuu nhận body tự do từ máy quét: mã toàn số có thể đi dạng số JSON, mã NCC có thể là chuỗi.
 * Body sai kiểu phải là 400 có câu tiếng Việt, không phải 500.
 * Kèm: lỗi khóa khi hai máy thao tác cùng lúc (deadlock / chờ khóa quá lâu) trả 409 "thử lại".
 */
class MaVachNhaCungCapTraCuuTest {

    private MaVachNhaCungCapService service;
    private MaVachNhaCungCapController controller;

    @BeforeEach
    void setUp() {
        service = mock(MaVachNhaCungCapService.class);
        controller = new MaVachNhaCungCapController(service);
    }

    private static Map<String, Object> body(Object maVach, Object ncc) {
        Map<String, Object> b = new HashMap<>();
        b.put("maVach", maVach);
        b.put("nhaCungCapId", ncc);
        return b;
    }

    @Test
    @DisplayName("Mã vạch gửi dạng số JSON (Long) được đọc thành chuỗi đủ chữ số")
    void maVachDangSo() {
        controller.traCuuPost(body(8935001200406L, 5));
        verify(service).traCuu("8935001200406", 5);
    }

    @Test
    @DisplayName("Mã NCC dạng chuỗi số được nhận; thiếu mã NCC thì tra chung")
    void maNccDangChuoi() {
        controller.traCuuPost(body("8935001200406", " 7 "));
        verify(service).traCuu("8935001200406", 7);
        controller.traCuuPost(body("ABC", null));
        verify(service).traCuu("ABC", null);
    }

    @Test
    @DisplayName("Mã NCC là chữ, số lẻ hoặc mảng: 400 có câu tiếng Việt, không gọi tra cứu")
    void maNccSaiKieu() {
        for (Object sai : List.of("abc", 5.5, List.of(1))) {
            CommonException ex = assertThrows(CommonException.class, () -> controller.traCuuPost(body("ABC", sai)), String.valueOf(sai));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertTrue(ex.getMessage().contains("nhà cung cấp"), ex.getMessage());
        }
        verify(service, never()).traCuu(any(), any());
    }

    @Test
    @DisplayName("Mã vạch là mảng / object / true: 400, không tra chuỗi \"[…]\"")
    void maVachSaiKieu() {
        for (Object sai : List.of(List.of("A"), Map.of("a", 1), true)) {
            CommonException ex = assertThrows(CommonException.class, () -> controller.traCuuPost(body(sai, 5)), String.valueOf(sai));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        }
        verify(service, never()).traCuu(any(), any());
    }

    @Test
    @DisplayName("Body rỗng: tra cứu với mã trống (trả 'mã lạ'), không lỗi")
    void bodyRong() {
        controller.traCuuPost(null);
        verify(service).traCuu(null, null);
    }

    @Test
    @DisplayName("Lỗi khóa do thao tác đồng thời (deadlock): 409 kèm câu hướng dẫn, không lộ chi tiết kỹ thuật")
    void loiKhoaDongThoi409() {
        RestControllerGlobalExceptionHandler handler = new RestControllerGlobalExceptionHandler();
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/phieu-nhap-kho/1/khai-bao-lo");
        ResponseEntity<ResponseData<?>> res = handler.handleThaoTacDongThoi(
                new CannotAcquireLockException("Deadlock found when trying to get lock; try restarting transaction"),
                new ServletWebRequest(req));
        assertEquals(HttpStatus.CONFLICT, res.getStatusCode());
        String cau = res.getBody().getMessage();
        assertTrue(cau.contains("thử lại"), cau);
        assertFalse(cau.toLowerCase().contains("deadlock"), cau);
        assertEquals("/api/v1/phieu-nhap-kho/1/khai-bao-lo", res.getBody().getPath());
    }
}
