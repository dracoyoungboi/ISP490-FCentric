package com.dev.backend.controller;

import com.dev.backend.dto.request.ResetPasswordRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.exception.RestControllerGlobalExceptionHandler;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.impl.entities.NguoiDungService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Test tầng HTTP của POST /api/v1/nguoi-dung/reset-password: @Valid chặn request
 * thiếu/sai định dạng (400 + lỗi theo field, không gọi service), request hợp lệ đi
 * vào service, lỗi nghiệp vụ trả 400 kèm message. Service mock — không đụng DB.
 */
@ExtendWith(MockitoExtension.class)
class NguoiDungControllerResetPasswordTest {

    private static final String URL = "/api/v1/nguoi-dung/reset-password";

    @Mock
    private NguoiDungService nguoiDungService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        NguoiDungController controller = new NguoiDungController();
        ReflectionTestUtils.setField(controller, "nguoiDungService", nguoiDungService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new RestControllerGlobalExceptionHandler())
                .build();
    }

    private org.springframework.test.web.servlet.ResultActions postJson(String body) throws Exception {
        return mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void hopLe_goiService_tra200() throws Exception {
        when(nguoiDungService.resetPassword(any())).thenReturn(ResponseEntity.ok(
                ResponseData.<String>builder().status(200).data("Success").message("Success").build()));

        postJson("{\"username\":\"khang\",\"otp\":\"123456\",\"password\":\"abcdef\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200));

        ArgumentCaptor<ResetPasswordRequest> captor = ArgumentCaptor.forClass(ResetPasswordRequest.class);
        verify(nguoiDungService).resetPassword(captor.capture());
        assertEquals("khang", captor.getValue().getUsername());
        assertEquals("123456", captor.getValue().getOtp());
        assertEquals("abcdef", captor.getValue().getPassword());
    }

    @Test
    void matKhauDuoi6KyTu_tra400_khongGoiService() throws Exception {
        postJson("{\"username\":\"khang\",\"otp\":\"123456\",\"password\":\"12345\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.password").value("Mật khẩu tối thiểu 6 ký tự"));
        verifyNoInteractions(nguoiDungService);
    }

    @Test
    void thieuMatKhau_tra400_khongGoiService() throws Exception {
        // trước đây password null đi thẳng vào passwordEncoder.encode(null) -> 500
        postJson("{\"username\":\"khang\",\"otp\":\"123456\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.password").value("Mật khẩu mới không được để trống"));
        verifyNoInteractions(nguoiDungService);
    }

    @Test
    void matKhauToanKhoangTrang_tra400() throws Exception {
        postJson("{\"username\":\"khang\",\"otp\":\"123456\",\"password\":\"      \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.password").value("Mật khẩu mới không được để trống"));
        verifyNoInteractions(nguoiDungService);
    }

    @Test
    void usernameRong_tra400() throws Exception {
        postJson("{\"username\":\"  \",\"otp\":\"123456\",\"password\":\"abcdef\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.username").value("Tên đăng nhập / email không được để trống"));
        verifyNoInteractions(nguoiDungService);
    }

    @Test
    void otpSaiDinhDang_tra400() throws Exception {
        for (String otp : new String[]{"12345", "1234567", "abcdef", "12 456"}) {
            postJson("{\"username\":\"khang\",\"otp\":\"" + otp + "\",\"password\":\"abcdef\"}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.otp").value("Mã xác nhận gồm 6 chữ số"));
        }
        postJson("{\"username\":\"khang\",\"password\":\"abcdef\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.otp").value("Mã xác nhận không được để trống"));
        verifyNoInteractions(nguoiDungService);
    }

    @Test
    void loiNghiepVu_tra400KemMessage() throws Exception {
        when(nguoiDungService.resetPassword(any()))
                .thenThrow(new CommonException("Mã xác nhận không tồn tại hoặc đã hết hạn"));

        postJson("{\"username\":\"khang\",\"otp\":\"123456\",\"password\":\"abcdef\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Mã xác nhận không tồn tại hoặc đã hết hạn"));
    }
}
