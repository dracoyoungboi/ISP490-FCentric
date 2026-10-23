package com.dev.backend.controller;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.RestControllerGlobalExceptionHandler;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.entities.NguoiDungService;
import com.dev.backend.services.impl.utils.CalcServiceImpl;
import com.dev.backend.services.impl.utils.LoginRateLimiter;
import com.dev.backend.services.impl.utils.PasswordResetRateLimiter;
import com.dev.backend.testsupport.MutableClock;
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

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Test toàn luồng quên mật khẩu qua HTTP đúng như màn ForgotPassword gọi:
 * forgot-password -> verify-reset-otp (bước "Xác thực OTP") -> reset-password.
 * Controller + service + exception handler thật, sinh OTP thật (CalcServiceImpl);
 * chỉ mock repository và EmailNghiepVuService (OTP lấy từ tham số của email E1 bị chặn lại).
 */
@ExtendWith(MockitoExtension.class)
class NguoiDungPasswordResetFlowTest {

    private static final String BASE = "/api/v1/nguoi-dung";
    private static final String USERNAME = "khang";
    private static final String EMAIL = "khang@example.com";
    private static final String OLD_HASH = "$2a$10$hash.cu";

    @Mock
    private NguoiDungRepository repository;
    @Mock
    private EmailNghiepVuService emailService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    // bộ giới hạn gửi OTP thật, tua thời gian để gửi lại mã mà không phải chờ 60 giây
    private final MutableClock clock = new MutableClock(Instant.now());
    private MockMvc mockMvc;
    private NguoiDung user;

    @BeforeEach
    void setUp() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
        NguoiDungService service = new NguoiDungService(repository);
        ReflectionTestUtils.setField(service, "passwordEncoder", passwordEncoder);
        ReflectionTestUtils.setField(service, "calcService", new CalcServiceImpl());
        ReflectionTestUtils.setField(service, "emailNghiepVuService", emailService);
        ReflectionTestUtils.setField(service, "passwordResetRateLimiter", new PasswordResetRateLimiter(clock));
        ReflectionTestUtils.setField(service, "loginRateLimiter", new LoginRateLimiter(clock));
        ReflectionTestUtils.setField(service, "nhatKyBaoMatService",
                org.mockito.Mockito.mock(com.dev.backend.services.impl.utils.NhatKyBaoMatService.class));

        NguoiDungController controller = new NguoiDungController();
        ReflectionTestUtils.setField(controller, "nguoiDungService", service);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new RestControllerGlobalExceptionHandler())
                .build();

        user = NguoiDung.builder().id(7).tenDangNhap(USERNAME).hoTen("Nguyễn Đăng Khang")
                .email(EMAIL).matKhauHash(OLD_HASH).vaiTro("nhan_vien_kho").trangThai(1).build();
        lenient().when(repository.findByTenDangNhap(USERNAME)).thenReturn(Optional.of(user));
    }

    @AfterEach
    void tearDown() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
    }

    // ===== helpers gọi API giống FE =====

    private ResultActions postJson(String path, String body) throws Exception {
        return mockMvc.perform(post(BASE + path).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    /** Gọi forgot-password và trả về OTP trong email vừa gửi (email gần nhất). */
    @SuppressWarnings("unchecked")
    private String requestOtp() throws Exception {
        clock.advance(Duration.ofSeconds(61)); // qua cooldown gửi lại 60 giây
        postJson("/forgot-password", "{\"username\":\"" + USERNAME + "\"}").andExpect(status().isOk());
        ArgumentCaptor<String> ma = ArgumentCaptor.forClass(String.class);
        verify(emailService, atLeastOnce()).guiMaDatLaiMatKhau(argThat(nd -> EMAIL.equals(nd.getEmail())), ma.capture(),
                any(), any());
        return ma.getValue();
    }

    private ResultActions verifyOtp(String otp) throws Exception {
        return postJson("/verify-reset-otp", "{\"username\":\"" + USERNAME + "\",\"otp\":\"" + otp + "\"}");
    }

    private ResultActions resetPassword(String otp, String password) throws Exception {
        return postJson("/reset-password",
                "{\"username\":\"" + USERNAME + "\",\"otp\":\"" + otp + "\",\"password\":\"" + password + "\"}");
    }

    private static String wrongOf(String otp) {
        // mã sai chắc chắn khác mã thật
        return otp.equals("000000") ? "111111" : "000000";
    }

    // ===== Các kịch bản =====

    @Test
    void luongChuan_guiMa_xacThucDung_doiMatKhau_thanhCong() throws Exception {
        String otp = requestOtp();
        assertTrue(otp.matches("\\d{6}"));

        verifyOtp(otp).andExpect(status().isOk()).andExpect(jsonPath("$.status").value(200));
        assertEquals(OLD_HASH, user.getMatKhauHash(), "bước xác thực chưa được đổi mật khẩu");

        resetPassword(otp, "matkhaumoi").andExpect(status().isOk());
        assertTrue(passwordEncoder.matches("matkhaumoi", user.getMatKhauHash()));

        // dùng lại mã đã dùng -> hết hiệu lực
        verifyOtp(otp).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.code").value("RESET_OTP_EXPIRED"));
    }

    @Test
    void maSai_biChanNgayOBuocXacThuc_khongSangDuocBuocDoiMatKhau() throws Exception {
        String otp = requestOtp();

        // đây là lỗi user báo: trước đây mã sai vẫn qua được bước 2
        verifyOtp(wrongOf(otp))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Mã xác nhận không đúng, bạn còn 4 lần thử"))
                .andExpect(jsonPath("$.data.code").value("RESET_OTP_WRONG"))
                .andExpect(jsonPath("$.data.remainingAttempts").value(4));

        // nhập lại đúng thì qua và đổi được mật khẩu
        verifyOtp(otp).andExpect(status().isOk());
        resetPassword(otp, "matkhaumoi").andExpect(status().isOk());
        assertTrue(passwordEncoder.matches("matkhaumoi", user.getMatKhauHash()));
    }

    @Test
    void sai5Lan_maBiHuy_phaiGuiLaiMa_maMoiDungDuoc() throws Exception {
        String otp = requestOtp();
        for (int remaining = 4; remaining >= 1; remaining--) {
            verifyOtp(wrongOf(otp)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.remainingAttempts").value(remaining));
        }
        verifyOtp(wrongOf(otp)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Bạn đã nhập sai mã xác nhận quá 5 lần, vui lòng yêu cầu mã mới"))
                .andExpect(jsonPath("$.data.code").value("RESET_OTP_EXPIRED"));

        // mã cũ (kể cả đúng) đã bị huỷ
        verifyOtp(otp).andExpect(status().isBadRequest()).andExpect(jsonPath("$.data.code").value("RESET_OTP_EXPIRED"));

        // gửi lại -> mã mới, bộ đếm mới
        String newOtp = requestOtp();
        verifyOtp(newOtp).andExpect(status().isOk());
        resetPassword(newOtp, "matkhaumoi").andExpect(status().isOk());
        assertTrue(passwordEncoder.matches("matkhaumoi", user.getMatKhauHash()));
    }

    @Test
    void guiLaiOtp_maCuBiTuChoi_maMoiDungDuoc() throws Exception {
        String first = requestOtp();
        String second = requestOtp();
        // (hiếm) 2 mã ngẫu nhiên trùng nhau thì kịch bản "mã cũ bị từ chối" không áp dụng
        if (!first.equals(second)) {
            verifyOtp(first).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.code").value("RESET_OTP_WRONG"));
        }
        verifyOtp(second).andExpect(status().isOk());
        resetPassword(second, "matkhaumoi").andExpect(status().isOk());
    }

    @Test
    void maHetHanTrongLucNhapMatKhau_resetTraCodeExpired() throws Exception {
        String otp = requestOtp();
        verifyOtp(otp).andExpect(status().isOk());
        // người dùng ở bước nhập mật khẩu quá 5 phút
        for (OtpScheduleObj o : GlobalCache.OTP_SCHEDULE_OBJS) o.setCreatedAt(Instant.now().minusSeconds(301));

        resetPassword(otp, "matkhaumoi").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Mã xác nhận không tồn tại hoặc đã hết hạn"))
                .andExpect(jsonPath("$.data.code").value("RESET_OTP_EXPIRED"));
        assertEquals(OLD_HASH, user.getMatKhauHash());
    }

    @Test
    void xacThucKhiChuaGuiMa_codeExpired() throws Exception {
        verifyOtp("123456").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.code").value("RESET_OTP_EXPIRED"));
    }

    @Test
    void verifyOtp_sai_dinhDang_bi_validate_khongTinhLanSai() throws Exception {
        String otp = requestOtp();
        verifyOtp("12ab").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.otp").value("Mã xác nhận gồm 6 chữ số"));
        postJson("/verify-reset-otp", "{\"otp\":\"" + otp + "\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.username").value("Tên đăng nhập / email không được để trống"));

        assertEquals(0, GlobalCache.OTP_SCHEDULE_OBJS.iterator().next().getFailedAttempts().get());
    }

    @Test
    void guiLaiNgayLapTuc_bi429_kemSoGiayCho_FEdemNguocDuoc() throws Exception {
        requestOtp();
        clock.advance(Duration.ofSeconds(10));

        postJson("/forgot-password", "{\"username\":\"" + USERNAME + "\"}")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Vui lòng đợi 50 giây trước khi yêu cầu mã mới"))
                .andExpect(jsonPath("$.data.code").value("OTP_RATE_LIMITED"))
                .andExpect(jsonPath("$.data.retryAfterSeconds").value(50));
        verify(emailService, times(1)).guiMaDatLaiMatKhau(any(), anyString(), any(), any());
    }

    @Test
    void forgotPassword_taiKhoanKhongTonTai_phanHoiGiongHet() throws Exception {
        String existing = postJson("/forgot-password", "{\"username\":\"" + USERNAME + "\"}")
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String missing = postJson("/forgot-password", "{\"username\":\"khongtontai\"}")
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertEquals(existing.replaceAll("\"timestamp\":(\"[^\"]*\"|[0-9]+)", ""),
                missing.replaceAll("\"timestamp\":(\"[^\"]*\"|[0-9]+)", ""),
                "body phải giống hệt nhau (trừ timestamp)");
        // verify/reset với tài khoản không tồn tại cũng giống hệt "mã hết hạn"
        postJson("/verify-reset-otp", "{\"username\":\"khongtontai\",\"otp\":\"123456\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Mã xác nhận không tồn tại hoặc đã hết hạn"))
                .andExpect(jsonPath("$.data.code").value("RESET_OTP_EXPIRED"));
    }

    @Test
    void resetMatKhauQuaDai_khongMatMa_sauDoDoiDuoc() throws Exception {
        String otp = requestOtp();
        verifyOtp(otp).andExpect(status().isOk());

        resetPassword(otp, "a".repeat(73)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Mật khẩu quá dài (tối đa 72 ký tự không dấu, ít hơn nếu có dấu tiếng Việt)"));

        resetPassword(otp, "matkhaumoi").andExpect(status().isOk());
        assertTrue(passwordEncoder.matches("matkhaumoi", user.getMatKhauHash()));
    }
}
