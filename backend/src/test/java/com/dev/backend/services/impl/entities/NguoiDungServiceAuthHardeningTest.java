package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.variables.ConstantVariables;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.ChangePasswordRequest;
import com.dev.backend.dto.request.ForgotPasswordRequest;
import com.dev.backend.dto.request.LoginRequest;
import com.dev.backend.dto.request.NguoiDungCreating;
import com.dev.backend.dto.request.ResetPasswordRequest;
import com.dev.backend.dto.request.VerifyResetOtpRequest;
import com.dev.backend.dto.response.LoginResponse;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.AccountDisabledException;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.NguoiDungMapperImpl;
import com.dev.backend.mapper.PhanQuyenNguoiDungKhoMapper;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.EmailService;
import com.dev.backend.services.impl.utils.CalcServiceImpl;
import com.dev.backend.services.impl.utils.JwtServiceImpl;
import com.dev.backend.services.impl.utils.OtpMailDispatcher;
import com.dev.backend.services.impl.utils.PasswordResetRateLimiter;
import com.dev.backend.testsupport.MutableClock;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Các lỗi bảo mật đã sửa quanh đăng nhập / quên mật khẩu:
 * giới hạn gửi OTP (thật, có tua thời gian), không lộ tài khoản tồn tại, tài khoản khoá không nhận OTP,
 * SĐT trùng không gây 500, lỗi SMTP không lộ email, đổi mật khẩu cấp token mới + thu hồi token cũ.
 */
@ExtendWith(MockitoExtension.class)
class NguoiDungServiceAuthHardeningTest {

    private static final String TEST_SIGNER_KEY = "test-signer-key-0123456789-0123456789-0123456789-abcdef";
    private static final String EMAIL = "khang@example.com";

    @Mock
    private NguoiDungRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private EmailService emailService;
    @Mock
    private PhanQuyenNguoiDungKhoService phanQuyenNguoiDungKhoService;
    @Mock
    private PhanQuyenNguoiDungKhoMapper pqndkMapper;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private MutableClock clock;
    private JwtServiceImpl jwtService;
    private NguoiDungService service;
    private NguoiDung user;
    private String originalKey;

    @BeforeEach
    void setUp() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
        originalKey = ConstantVariables.SIGNER_KEY;
        ConstantVariables.SIGNER_KEY = TEST_SIGNER_KEY;
        jwtService = new JwtServiceImpl();
        ReflectionTestUtils.setField(jwtService, "objectMapper", new ObjectMapper().findAndRegisterModules());

        clock = new MutableClock(Instant.now());
        NguoiDungMapperImpl mapper = new NguoiDungMapperImpl();
        ReflectionTestUtils.setField(mapper, "phanQuyenNguoiDungKhoMapper", pqndkMapper);

        service = new NguoiDungService(repository);
        ReflectionTestUtils.setField(service, "passwordEncoder", encoder);
        ReflectionTestUtils.setField(service, "calcService", new CalcServiceImpl());
        ReflectionTestUtils.setField(service, "emailService", emailService);
        ReflectionTestUtils.setField(service, "otpMailDispatcher", new OtpMailDispatcher(emailService, Runnable::run));
        ReflectionTestUtils.setField(service, "passwordResetRateLimiter", new PasswordResetRateLimiter(clock));
        ReflectionTestUtils.setField(service, "jwtService", jwtService);
        ReflectionTestUtils.setField(service, "nguoiDungMapper", mapper);
        ReflectionTestUtils.setField(service, "pqndkMapper", pqndkMapper);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungKhoService", phanQuyenNguoiDungKhoService);
        lenient().when(phanQuyenNguoiDungKhoService.findByNguoiDungIdAndActive(any())).thenReturn(List.of());
        lenient().when(pqndkMapper.toDtoList(any())).thenReturn(List.of());

        user = NguoiDung.builder().id(7).tenDangNhap("khang").hoTen("Nguyễn Đăng Khang").email(EMAIL)
                .soDienThoai("0912345678").vaiTro("quan_tri_vien").trangThai(1)
                .matKhauHash(encoder.encode("matkhaucu")).build();
        lenient().when(repository.findByTenDangNhap("khang")).thenReturn(Optional.of(user));
        lenient().when(repository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        lenient().when(repository.findAllBySoDienThoai("0912345678")).thenReturn(List.of(user));
    }

    @AfterEach
    void tearDown() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
        ConstantVariables.SIGNER_KEY = originalKey;
        com.dev.backend.config.SecurityContextHolder.clear();
    }

    private ResponseData<String> forgot(String identifier, String ip) {
        return service.forgotPassword(new ForgotPasswordRequest(identifier), ip).getBody();
    }

    private int emailsSent() {
        return mockingDetails(emailService).getInvocations().size();
    }

    @SuppressWarnings("unchecked")
    private static Object data(CommonException ex, String key) {
        return ((Map<String, Object>) ex.getData()).get(key);
    }

    // ===== #1-3: giới hạn gửi OTP =====

    @Test
    void guiLaiTrong60Giay_bi429_kemSoGiayCho_khongGuiEmailThem() {
        forgot("khang", "1.1.1.1");
        clock.advance(Duration.ofSeconds(20));

        CommonException ex = assertThrows(CommonException.class, () -> forgot("khang", "1.1.1.1"));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getHttpStatus());
        assertEquals("Vui lòng đợi 40 giây trước khi yêu cầu mã mới", ex.getMessage());
        assertEquals("OTP_RATE_LIMITED", data(ex, "code"));
        assertEquals(40L, data(ex, "retryAfterSeconds"));
        assertEquals(1, emailsSent());

        clock.advance(Duration.ofSeconds(40));
        assertEquals(200, forgot("khang", "1.1.1.1").getStatus());
        assertEquals(2, emailsSent());
    }

    @Test
    void sai5LanRoiGuiLaiLienTuc_toiDa5EmailMoiGio() {
        for (int i = 0; i < 5; i++) {
            forgot("khang", "1.1.1.1");
            clock.advance(Duration.ofSeconds(61));
        }
        CommonException ex = assertThrows(CommonException.class, () -> forgot("khang", "1.1.1.1"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getHttpStatus());
        assertTrue(ex.getMessage().startsWith("Bạn đã yêu cầu mã quá nhiều lần, vui lòng thử lại sau"), ex.getMessage());
        assertEquals(5, emailsSent(), "tối đa 5 email/giờ cho 1 tài khoản");
    }

    @Test
    void doiQuaLaiUsernameEmailSdt_khongVuotGioiHanTheoTaiKhoan_vaBao429RoRang() {
        assertEquals(200, forgot("khang", "1.1.1.1").getStatus());
        clock.advance(Duration.ofSeconds(15));
        // chuỗi nhập khác (email, SĐT) của cùng tài khoản trong 60s: KHÔNG gửi thêm và báo rõ phải chờ
        // (trước đây bỏ qua im lặng -> người dùng tưởng đã gửi mà không thấy mail)
        for (String sameAccount : List.of(EMAIL, "0912345678")) {
            CommonException ex = assertThrows(CommonException.class, () -> forgot(sameAccount, "1.1.1.1"));
            assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getHttpStatus());
            assertEquals("Vui lòng đợi 45 giây trước khi yêu cầu mã mới", ex.getMessage());
        }
        assertEquals(200, forgot("khongtontai", "1.1.1.1").getStatus());
        assertEquals(1, emailsSent());

        clock.advance(Duration.ofSeconds(45));
        assertEquals(200, forgot(EMAIL, "1.1.1.1").getStatus());
        assertEquals(2, emailsSent(), "hết 60 giây thì gửi được bằng email");
    }

    @Test
    void taiKhoanKhongTonTai_cungBiGioiHanNhuTaiKhoanThat() {
        forgot("khongtontai", "1.1.1.1");
        CommonException ex = assertThrows(CommonException.class, () -> forgot("khongtontai", "1.1.1.1"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getHttpStatus());
        assertEquals("Vui lòng đợi 60 giây trước khi yêu cầu mã mới", ex.getMessage());
    }

    @Test
    void mot_IP_spam_nhieu_tai_khoan_bi_chan_sau_20_lan() {
        for (int i = 0; i < PasswordResetRateLimiter.MAX_PER_IP_PER_HOUR; i++) {
            forgot("user" + i, "5.5.5.5");
        }
        CommonException ex = assertThrows(CommonException.class, () -> forgot("khang", "5.5.5.5"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getHttpStatus());
        assertEquals(0, emailsSent());
        assertEquals(200, forgot("khang", "6.6.6.6").getStatus(), "IP khác vẫn dùng được");
    }

    @Test
    void hetQuotaNgay_tra503ChoMoiYeuCau() {
        PasswordResetRateLimiter limiter = new PasswordResetRateLimiter(clock);
        for (int i = 0; i < PasswordResetRateLimiter.MAX_GLOBAL_PER_DAY; i++) limiter.tryAcquire("fill" + i, "ip" + i, 1000 + i);
        ReflectionTestUtils.setField(service, "passwordResetRateLimiter", limiter);

        for (String id : List.of("khang", "khongtontai")) {
            CommonException ex = assertThrows(CommonException.class, () -> forgot(id, "1.1.1.1"));
            assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getHttpStatus());
            assertEquals("OTP_SERVICE_BUSY", data(ex, "code"));
        }
        assertEquals(0, emailsSent());
    }

    @Test
    void chuoiNhapRong_bao400() {
        CommonException ex = assertThrows(CommonException.class, () -> forgot("   ", "1.1.1.1"));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertEquals("Vui lòng nhập email / tên đăng nhập", ex.getMessage());
    }

    // ===== #4: lỗi gửi email không lộ ra client =====

    @Test
    void loiSmtp_vanTra200ThongBaoChung_khongLoEmail() {
        doThrow(new CommonException("Error sending email from template activation.html to: " + EMAIL, new RuntimeException("smtp")))
                .when(emailService).sendHtmlEmailFromTemplate(anyString(), anyString(), anyString(), anyMap());

        ResponseData<String> res = forgot("khang", "1.1.1.1");

        assertEquals(200, res.getStatus());
        assertFalse(res.getMessage().contains(EMAIL));
        assertEquals(NguoiDungService.FORGOT_PASSWORD_GENERIC_MESSAGE, res.getMessage());
    }

    // ===== #7: tài khoản bị khoá =====

    @Test
    void taiKhoanBiKhoa_khongNhanOtp_vaKhongDatLaiDuoc() {
        user.setTrangThai(0);
        assertEquals(NguoiDungService.FORGOT_PASSWORD_GENERIC_MESSAGE, forgot("khang", "1.1.1.1").getMessage());
        assertEquals(0, emailsSent());
        assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.isEmpty());
    }

    @Test
    void taiKhoanBiKhoaSauKhiDaNhanOtp_khongDatLaiDuoc() {
        forgot("khang", "1.1.1.1");
        String otp = (String) GlobalCache.OTP_SCHEDULE_OBJS.iterator().next().getOtp();
        user.setTrangThai(0); // admin khoá trong lúc người dùng đang nhập mã
        String oldHash = user.getMatKhauHash();

        CommonException v = assertThrows(CommonException.class,
                () -> service.verifyResetOtp(new VerifyResetOtpRequest("khang", otp)));
        CommonException r = assertThrows(CommonException.class,
                () -> service.resetPassword(new ResetPasswordRequest("khang", otp, "matkhaumoi")));

        assertEquals("RESET_OTP_EXPIRED", data(v, "code"));
        assertEquals("RESET_OTP_EXPIRED", data(r, "code"));
        assertEquals(oldHash, user.getMatKhauHash());
    }

    // ===== #7b: vai trò không phải nhân sự (khách hàng đã bỏ khỏi hệ thống) =====

    @Test
    void vaiTroKhongPhaiNhanSu_khongNhanOtp() {
        user.setVaiTro("khach_hang");
        assertEquals(NguoiDungService.FORGOT_PASSWORD_GENERIC_MESSAGE, forgot("khang", "1.1.1.1").getMessage());
        assertEquals(0, emailsSent());
        assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.isEmpty());
    }

    @Test
    void vaiTroDoiSangKhongPhaiNhanSuSauKhiNhanOtp_khongDatLaiDuoc() {
        forgot("khang", "1.1.1.1");
        String otp = (String) GlobalCache.OTP_SCHEDULE_OBJS.iterator().next().getOtp();
        user.setVaiTro("khach_hang");
        String oldHash = user.getMatKhauHash();

        CommonException r = assertThrows(CommonException.class,
                () -> service.resetPassword(new ResetPasswordRequest("khang", otp, "matkhaumoi")));

        assertEquals("RESET_OTP_EXPIRED", data(r, "code"));
        assertEquals(oldHash, user.getMatKhauHash());
    }

    // ===== #8: SĐT trùng nhiều tài khoản =====

    @Test
    void sdtTrungNhieuTaiKhoan_khongLoi500() {
        NguoiDung other = NguoiDung.builder().id(8).tenDangNhap("lan").soDienThoai("0999999999").trangThai(1)
                .email("lan@example.com").matKhauHash(encoder.encode("x")).build();
        NguoiDung other2 = NguoiDung.builder().id(9).tenDangNhap("minh").soDienThoai("0999999999").trangThai(1)
                .email("minh@example.com").matKhauHash(encoder.encode("x")).build();
        when(repository.findAllBySoDienThoai("0999999999")).thenReturn(List.of(other, other2));

        assertEquals(200, forgot("0999999999", "1.1.1.1").getStatus());
        assertEquals(0, emailsSent(), "không đoán bừa tài khoản nào");
        CommonException login = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("0999999999", "x")));
        assertEquals(NguoiDungService.LOGIN_FAILED_MESSAGE, login.getMessage());
    }

    @Test
    void resolveAccount_uuTienUsername_roiEmail_roiSdt() {
        NguoiDung byPhone = NguoiDung.builder().id(9).tenDangNhap("other").build();
        when(repository.findAllBySoDienThoai("0911111111")).thenReturn(List.of(byPhone));

        assertSame(user, service.resolveAccount("  khang  ").orElseThrow(), "tự trim");
        assertSame(user, service.resolveAccount(EMAIL).orElseThrow());
        assertSame(byPhone, service.resolveAccount("0911111111").orElseThrow());
        assertTrue(service.resolveAccount(null).isEmpty());
        assertTrue(service.resolveAccount(" ").isEmpty());
        verify(repository, never()).findByTenDangNhapOrEmailOrSoDienThoai(any(), any(), any());
    }

    // ===== #9: đăng nhập không lộ tài khoản tồn tại =====

    @Test
    void dangNhap_saiTenHoacSaiMatKhau_cungThongBao() {
        CommonException noUser = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khongtontai", "matkhaucu")));
        CommonException wrongPass = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", "saimatkhau")));
        CommonException nullPass = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", null)));

        assertEquals(NguoiDungService.LOGIN_FAILED_MESSAGE, noUser.getMessage());
        assertEquals(noUser.getMessage(), wrongPass.getMessage());
        assertEquals(noUser.getMessage(), nullPass.getMessage(), "mật khẩu null không còn gây 500");
        assertEquals(noUser.getHttpStatus(), wrongPass.getHttpStatus());
    }

    @Test
    void dangNhap_khongTonTai_vanChayBcrypt_deThoiGianGiongNhau() {
        BCryptPasswordEncoder spyEncoder = spy(encoder);
        ReflectionTestUtils.setField(service, "passwordEncoder", spyEncoder);

        assertThrows(CommonException.class, () -> service.login(new LoginRequest("khongtontai", "abc")));

        verify(spyEncoder).matches(eq("abc"), startsWith("$2a$"));
    }

    @Test
    void dangNhap_thanhCong_tokenCoCvTheoMatKhauHienTai() {
        ResponseData<LoginResponse> res = service.login(new LoginRequest("khang", "matkhaucu")).getBody();

        NguoiDungAuthInfo info = jwtService.getNguoiDungAuthInfoFromToken(res.getData().getToken());
        assertEquals(jwtService.credentialVersion(user.getMatKhauHash()), info.getCredentialVersion());
    }

    @Test
    void dangNhap_dungMatKhauNhungBiKhoa_403() {
        user.setTrangThai(0);
        assertThrows(AccountDisabledException.class, () -> service.login(new LoginRequest("khang", "matkhaucu")));
    }

    @Test
    void dangNhap_vaiTroKhongPhaiNhanSu_403NhuTaiKhoanBiKhoa() {
        for (String vaiTro : new String[]{"khach_hang", "all", ""}) {
            user.setVaiTro(vaiTro);
            AccountDisabledException ex = assertThrows(AccountDisabledException.class,
                    () -> service.login(new LoginRequest("khang", "matkhaucu")), vaiTro);
            assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
        }
        // Sai mật khẩu thì vẫn báo lỗi chung trước, không lộ tài khoản có vai trò gì
        CommonException sai = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", "saimatkhau")));
        assertEquals(NguoiDungService.LOGIN_FAILED_MESSAGE, sai.getMessage());
    }

    @Test
    void dangNhap_moiVaiTroNhanSu_deuVaoDuoc() {
        for (String vaiTro : IRoleType.NOI_BO) {
            user.setVaiTro(vaiTro);
            assertNotNull(service.login(new LoginRequest("khang", "matkhaucu")).getBody().getData().getToken(), vaiTro);
        }
    }

    // ===== #5: đổi mật khẩu -> token mới, token cũ bị thu hồi =====

    @Test
    void doiMatKhau_traTokenMoi_theoMatKhauMoi() {
        String oldCv = jwtService.credentialVersion(user.getMatKhauHash());
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).build());
        when(repository.findById(7)).thenReturn(Optional.of(user));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ResponseData<String> res = service.changePassword(new ChangePasswordRequest("matkhaucu", "matkhaumoi")).getBody();

        assertTrue(encoder.matches("matkhaumoi", user.getMatKhauHash()));
        String newCv = jwtService.getNguoiDungAuthInfoFromToken(res.getData()).getCredentialVersion();
        assertEquals(jwtService.credentialVersion(user.getMatKhauHash()), newCv);
        assertNotEquals(oldCv, newCv, "token cũ (cv cũ) sẽ bị AuthInterceptor từ chối");
    }

    @Test
    void doiMatKhau_qua72Byte_bao400_khongDoi() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).build());
        when(repository.findById(7)).thenReturn(Optional.of(user));
        String oldHash = user.getMatKhauHash();

        CommonException ex = assertThrows(CommonException.class,
                () -> service.changePassword(new ChangePasswordRequest("matkhaucu", "ệ".repeat(30))));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().startsWith("Mật khẩu quá dài"));
        assertEquals(oldHash, user.getMatKhauHash());
    }

    // ===== #6: tạo người dùng mới tự sinh mật khẩu tạm & gửi mail chào mừng =====

    @Test
    void createInternalUserByAdmin_tuSinhMatKhauTam_batMustChangePassword_guiEmailChaoMung() {
        when(repository.existsByTenDangNhap("nhanvienmoi")).thenReturn(false);
        when(repository.existsByEmail("nhanvien@example.com")).thenReturn(false);
        when(repository.save(any(NguoiDung.class))).thenAnswer(inv -> {
            NguoiDung nd = inv.getArgument(0);
            nd.setId(99);
            return nd;
        });

        NguoiDungCreating req = NguoiDungCreating.builder()
                .tenDangNhap("nhanvienmoi")
                .email("nhanvien@example.com")
                .hoTen("Nhân Viên Mới")
                .vaiTro(IRoleType.nhan_vien_kho)
                .build();

        NguoiDung created = service.createInternalUserByAdmin(req);

        assertNotNull(created);
        assertEquals("nhanvienmoi", created.getTenDangNhap());
        assertEquals("nhanvien@example.com", created.getEmail());
        assertTrue(created.getMustChangePassword(), "Tài khoản mới bắt buộc có mustChangePassword = true");
        assertNotNull(created.getMatKhauHash(), "Phải có mật khẩu tạm được mã hóa BCrypt");

        // Xác thực email chào mừng gửi qua OtpMailDispatcher với template new_user_welcome.html
        verify(emailService).sendHtmlEmailFromTemplate(
                eq("nhanvien@example.com"),
                eq("Thông báo cấp tài khoản mới - FCentric"),
                eq("new_user_welcome.html"),
                argThat(params -> params.containsKey("loginName")
                        && "nhanvienmoi".equals(params.get("loginName"))
                        && params.containsKey("temporaryPassword")
                        && params.get("temporaryPassword") != null)
        );
    }

    @Test
    void createInternalUserByAdmin_vaiTroKhongPhaiNhanSu_baoLoi_khongTaoKhongGuiMail() {
        for (String vaiTro : new String[]{"khach_hang", "all", "admin"}) {
            NguoiDungCreating req = NguoiDungCreating.builder()
                    .tenDangNhap("khachmoi").email("khach@example.com").hoTen("Khách").vaiTro(vaiTro).build();
            CommonException ex = assertThrows(CommonException.class, () -> service.createInternalUserByAdmin(req), vaiTro);
            assertEquals("Vai trò không hợp lệ", ex.getMessage());
        }
        verify(repository, never()).save(any());
        verifyNoInteractions(emailService);
    }

    @Test
    void createInternalUserByAdmin_vaiTroTrong_laNhanVienKho_coKhoangTrangThiCatBo() {
        when(repository.save(any(NguoiDung.class))).thenAnswer(inv -> inv.getArgument(0));

        NguoiDung macDinh = service.createInternalUserByAdmin(NguoiDungCreating.builder()
                .tenDangNhap("nv1").email("nv1@example.com").vaiTro(" ").build());
        NguoiDung quanLy = service.createInternalUserByAdmin(NguoiDungCreating.builder()
                .tenDangNhap("ql1").email("ql1@example.com").vaiTro(" quan_ly_kho ").build());

        assertEquals(IRoleType.nhan_vien_kho, macDinh.getVaiTro());
        assertEquals(IRoleType.quan_ly_kho, quanLy.getVaiTro());
    }

    @Test
    void createInternalUserByAdmin_emailKhongHopLe_baoLoi() {
        NguoiDungCreating req = NguoiDungCreating.builder()
                .tenDangNhap("userloi")
                .email("email-khong-hop-le")
                .build();

        CommonException ex = assertThrows(CommonException.class,
                () -> service.createInternalUserByAdmin(req));
        assertTrue(ex.getMessage().contains("Vui lòng nhập đúng định dạng email"));
        verifyNoInteractions(emailService);
    }
}
