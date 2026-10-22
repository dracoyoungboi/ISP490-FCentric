package com.dev.backend.controller;

import com.dev.backend.config.AuthInterceptor;
import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.variables.ConstantVariables;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.RestControllerGlobalExceptionHandler;
import com.dev.backend.mapper.NguoiDungMapperImpl;
import com.dev.backend.mapper.PhanQuyenNguoiDungKhoMapper;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.entities.NguoiDungService;
import com.dev.backend.services.impl.entities.PhanQuyenNguoiDungKhoService;
import com.dev.backend.services.impl.utils.CalcServiceImpl;
import com.dev.backend.services.impl.utils.JwtServiceImpl;
import com.dev.backend.services.impl.utils.PasswordResetRateLimiter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Thu hồi phiên qua HTTP (controller + AuthInterceptor + service thật, DB/email mock):
 * đặt lại mật khẩu bằng OTP hoặc tự đổi mật khẩu -> token cũ nhận 401 SESSION_REVOKED;
 * tự đổi mật khẩu thì nhận token mới dùng tiếp được.
 */
@ExtendWith(MockitoExtension.class)
class NguoiDungSessionRevokeFlowTest {

    private static final String TEST_SIGNER_KEY = "test-signer-key-0123456789-0123456789-0123456789-abcdef";
    private static final String BASE = "/api/v1/nguoi-dung";

    @Mock
    private NguoiDungRepository repository;
    @Mock
    private EmailNghiepVuService emailService;
    @Mock
    private PhanQuyenNguoiDungKhoService phanQuyenNguoiDungKhoService;
    @Mock
    private PhanQuyenNguoiDungKhoMapper pqndkMapper;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private MockMvc mockMvc;
    private NguoiDung user;
    private String originalKey;

    @BeforeEach
    void setUp() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
        originalKey = ConstantVariables.SIGNER_KEY;
        ConstantVariables.SIGNER_KEY = TEST_SIGNER_KEY;
        JwtServiceImpl jwtService = new JwtServiceImpl();
        ReflectionTestUtils.setField(jwtService, "objectMapper", new ObjectMapper().findAndRegisterModules());

        NguoiDungMapperImpl mapper = new NguoiDungMapperImpl();
        ReflectionTestUtils.setField(mapper, "phanQuyenNguoiDungKhoMapper", pqndkMapper);
        lenient().when(pqndkMapper.toDtoList(any())).thenReturn(List.of());
        lenient().when(phanQuyenNguoiDungKhoService.findByNguoiDungIdAndActive(any())).thenReturn(List.of());

        NguoiDungService service = new NguoiDungService(repository);
        ReflectionTestUtils.setField(service, "passwordEncoder", encoder);
        ReflectionTestUtils.setField(service, "calcService", new CalcServiceImpl());
        ReflectionTestUtils.setField(service, "emailNghiepVuService", emailService);
        ReflectionTestUtils.setField(service, "passwordResetRateLimiter", new PasswordResetRateLimiter());
        ReflectionTestUtils.setField(service, "jwtService", jwtService);
        ReflectionTestUtils.setField(service, "nguoiDungMapper", mapper);
        ReflectionTestUtils.setField(service, "pqndkMapper", pqndkMapper);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungKhoService", phanQuyenNguoiDungKhoService);

        AuthInterceptor interceptor = new AuthInterceptor();
        ReflectionTestUtils.setField(interceptor, "jwtService", jwtService);
        ReflectionTestUtils.setField(interceptor, "nguoiDungRepository", repository);

        NguoiDungController controller = new NguoiDungController();
        ReflectionTestUtils.setField(controller, "nguoiDungService", service);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .addInterceptors(interceptor)
                .setControllerAdvice(new RestControllerGlobalExceptionHandler())
                .build();

        user = NguoiDung.builder().id(7).tenDangNhap("khang").hoTen("Nguyễn Đăng Khang").email("khang@example.com")
                .vaiTro("quan_tri_vien").trangThai(1).matKhauHash(encoder.encode("matkhaucu")).build();
        lenient().when(repository.findByTenDangNhap("khang")).thenReturn(Optional.of(user));
        lenient().when(repository.findById(7)).thenReturn(Optional.of(user));
        lenient().when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
        ConstantVariables.SIGNER_KEY = originalKey;
    }

    private ResultActions postJson(String path, String body, String token) throws Exception {
        var req = post(BASE + path).contentType(MediaType.APPLICATION_JSON).content(body);
        if (token != null) req.header("Authorization", "Bearer " + token);
        return mockMvc.perform(req);
    }

    private ResultActions me(String token) throws Exception {
        return mockMvc.perform(get(BASE + "/me").header("Authorization", "Bearer " + token));
    }

    private String login(String password) throws Exception {
        String body = postJson("/login", "{\"username\":\"khang\",\"password\":\"" + password + "\"}", null)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.data.token");
    }

    @SuppressWarnings("unchecked")
    private String lastOtp() {
        ArgumentCaptor<String> ma = ArgumentCaptor.forClass(String.class);
        verify(emailService, atLeastOnce()).guiMaDatLaiMatKhau(any(), ma.capture(), any(), any());
        return ma.getValue();
    }

    @Test
    void datLaiMatKhauBangOtp_tokenCuBiThuHoi_dangNhapLaiDuoc() throws Exception {
        String oldToken = login("matkhaucu");
        me(oldToken).andExpect(status().isOk());

        // ở thiết bị khác: quên mật khẩu -> OTP -> đặt lại
        postJson("/forgot-password", "{\"username\":\"khang\"}", null).andExpect(status().isOk());
        String otp = lastOtp();
        postJson("/verify-reset-otp", "{\"username\":\"khang\",\"otp\":\"" + otp + "\"}", null).andExpect(status().isOk());
        postJson("/reset-password", "{\"username\":\"khang\",\"otp\":\"" + otp + "\",\"password\":\"matkhaumoi\"}", null)
                .andExpect(status().isOk());

        me(oldToken).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.data.code").value("SESSION_REVOKED"))
                .andExpect(jsonPath("$.message").value("Mật khẩu tài khoản đã được thay đổi. Vui lòng đăng nhập lại."));

        postJson("/login", "{\"username\":\"khang\",\"password\":\"matkhaucu\"}", null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Tên đăng nhập hoặc mật khẩu không chính xác"));
        me(login("matkhaumoi")).andExpect(status().isOk());
    }

    @Test
    void tuDoiMatKhau_nhanTokenMoiDungTiep_tokenCuTrenThietBiKhacBiThuHoi() throws Exception {
        String deviceA = login("matkhaucu");
        String deviceB = login("matkhaucu");

        String body = postJson("/change-password", "{\"currentPassword\":\"matkhaucu\",\"newPassword\":\"matkhaumoi\"}", deviceA)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String newTokenA = JsonPath.read(body, "$.data");

        assertEquals(3, newTokenA.split("\\.").length, "data phải là JWT mới");
        me(newTokenA).andExpect(status().isOk());
        me(deviceA).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.data.code").value("SESSION_REVOKED"));
        me(deviceB).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.data.code").value("SESSION_REVOKED"));
    }

    @Test
    void dangNhapSaiTen_vaSaiMatKhau_phanHoiGiongHet() throws Exception {
        String a = postJson("/login", "{\"username\":\"khongtontai\",\"password\":\"x\"}", null)
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        String b = postJson("/login", "{\"username\":\"khang\",\"password\":\"x\"}", null)
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        assertEquals(a.replaceAll("\"timestamp\":(\"[^\"]*\"|[0-9]+)", ""), b.replaceAll("\"timestamp\":(\"[^\"]*\"|[0-9]+)", ""));
    }
}
