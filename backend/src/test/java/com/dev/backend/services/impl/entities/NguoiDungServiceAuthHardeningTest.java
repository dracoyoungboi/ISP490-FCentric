package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.variables.ConstantVariables;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.ChangePasswordRequest;
import com.dev.backend.dto.request.DatMatKhauQuaLienKetRequest;
import com.dev.backend.dto.request.ForgotPasswordRequest;
import com.dev.backend.dto.request.KiemTraLienKetMatKhauRequest;
import com.dev.backend.dto.request.LoginRequest;
import com.dev.backend.dto.request.NguoiDungCreating;
import com.dev.backend.dto.request.ResetPasswordRequest;
import com.dev.backend.dto.request.VerifyResetOtpRequest;
import com.dev.backend.dto.response.LoginResponse;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.LienKetMatKhauDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.LienKetDatMatKhau;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.AccountDisabledException;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.LienKetDatMatKhauRepository;
import com.dev.backend.mapper.NguoiDungMapperImpl;
import com.dev.backend.mapper.PhanQuyenNguoiDungKhoMapper;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.utils.CalcServiceImpl;
import com.dev.backend.services.impl.utils.JwtServiceImpl;
import com.dev.backend.services.impl.utils.LoginRateLimiter;
import com.dev.backend.services.impl.utils.PasswordResetRateLimiter;
import com.dev.backend.testsupport.MutableClock;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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
    private static final String IP = "203.0.113.10";
    private static final String UA = "JUnit";

    @Mock
    private NguoiDungRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private EmailNghiepVuService emailService;
    @Mock
    private PhanQuyenNguoiDungKhoService phanQuyenNguoiDungKhoService;
    @Mock
    private PhanQuyenNguoiDungKhoMapper pqndkMapper;
    @Mock
    private com.dev.backend.services.impl.utils.NhatKyBaoMatService nhatKyBaoMatService;
    @Mock
    private LienKetDatMatKhauRepository lienKetRepo;
    @Mock
    private PhienDangNhapService phienDangNhapService;
    @Mock
    private com.dev.backend.services.multitable.PhanQuyenNguoiDungService phanQuyenNguoiDungService;

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
        ReflectionTestUtils.setField(service, "emailNghiepVuService", emailService);
        ReflectionTestUtils.setField(service, "passwordResetRateLimiter", new PasswordResetRateLimiter(clock));
        ReflectionTestUtils.setField(service, "loginRateLimiter", new LoginRateLimiter(clock));
        ReflectionTestUtils.setField(service, "nhatKyBaoMatService", nhatKyBaoMatService);
        ReflectionTestUtils.setField(service, "jwtService", jwtService);
        ReflectionTestUtils.setField(service, "nguoiDungMapper", mapper);
        ReflectionTestUtils.setField(service, "pqndkMapper", pqndkMapper);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungKhoService", phanQuyenNguoiDungKhoService);
        ReflectionTestUtils.setField(service, "lienKetDatMatKhauService", new LienKetDatMatKhauService(lienKetRepo));
        ReflectionTestUtils.setField(service, "phienDangNhapService", phienDangNhapService);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungService", phanQuyenNguoiDungService);
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
        // chỉ đếm email mã đặt lại mật khẩu (E1); đổi mật khẩu thành công còn gửi M4
        return (int) mockingDetails(emailService).getInvocations().stream()
                .filter(i -> i.getMethod().getName().equals("guiMaDatLaiMatKhau")).count();
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
    void guiMaQuaLopEmail_tra200ThongBaoChung_khongLoEmail() {
        // Lỗi SMTP xảy ra ở luồng gửi sau commit (EmailDispatcherTest), không bao giờ tới được request này
        ResponseData<String> res = forgot("khang", "1.1.1.1");

        assertEquals(1, emailsSent());

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
                () -> service.login(new LoginRequest("0999999999", "x"), IP, UA));
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
                () -> service.login(new LoginRequest("khongtontai", "matkhaucu"), IP, UA));
        CommonException wrongPass = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", "saimatkhau"), IP, UA));
        CommonException nullPass = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", null), IP, UA));

        assertEquals(NguoiDungService.LOGIN_FAILED_MESSAGE, noUser.getMessage());
        assertEquals(noUser.getMessage(), wrongPass.getMessage());
        assertEquals(noUser.getMessage(), nullPass.getMessage(), "mật khẩu null không còn gây 500");
        assertEquals(noUser.getHttpStatus(), wrongPass.getHttpStatus());
    }

    @Test
    void dangNhap_khongTonTai_vanChayBcrypt_deThoiGianGiongNhau() {
        BCryptPasswordEncoder spyEncoder = spy(encoder);
        ReflectionTestUtils.setField(service, "passwordEncoder", spyEncoder);

        assertThrows(CommonException.class, () -> service.login(new LoginRequest("khongtontai", "abc"), IP, UA));

        verify(spyEncoder).matches(eq("abc"), startsWith("$2a$"));
    }

    @Test
    void dangNhap_thanhCong_tokenCoCvTheoMatKhauHienTai() {
        ResponseData<LoginResponse> res = service.login(new LoginRequest("khang", "matkhaucu"), IP, UA).getBody();

        NguoiDungAuthInfo info = jwtService.getNguoiDungAuthInfoFromToken(res.getData().getToken());
        assertEquals(jwtService.credentialVersion(user.getMatKhauHash()), info.getCredentialVersion());
    }

    @Test
    void dangNhap_dungMatKhauNhungBiKhoa_403() {
        user.setTrangThai(0);
        assertThrows(AccountDisabledException.class, () -> service.login(new LoginRequest("khang", "matkhaucu"), IP, UA));
    }

    @Test
    void dangNhap_vaiTroKhongPhaiNhanSu_403NhuTaiKhoanBiKhoa() {
        for (String vaiTro : new String[]{"khach_hang", "all", ""}) {
            user.setVaiTro(vaiTro);
            AccountDisabledException ex = assertThrows(AccountDisabledException.class,
                    () -> service.login(new LoginRequest("khang", "matkhaucu"), IP, UA), vaiTro);
            assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
        }
        // Sai mật khẩu thì vẫn báo lỗi chung trước, không lộ tài khoản có vai trò gì
        CommonException sai = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", "saimatkhau"), IP, UA));
        assertEquals(NguoiDungService.LOGIN_FAILED_MESSAGE, sai.getMessage());
    }

    @Test
    void dangNhap_moiVaiTroNhanSu_deuVaoDuoc() {
        for (String vaiTro : IRoleType.NOI_BO) {
            user.setVaiTro(vaiTro);
            assertNotNull(service.login(new LoginRequest("khang", "matkhaucu"), IP, UA).getBody().getData().getToken(), vaiTro);
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
        verify(emailService).guiDaDoiMatKhau(same(user),
                eq(com.dev.backend.services.email.CachDoiMatKhau.DOI_KHI_DA_DANG_NHAP), any());
        verify(lienKetRepo).huyConMo(eq(7), any(Instant.class));
    }

    @Test
    void doiMatKhau_qua72Byte_bao400_khongDoi() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).build());
        // kiểm độ dài mật khẩu mới chạy trước khi tra tài khoản nên stub này có thể không được dùng
        lenient().when(repository.findById(7)).thenReturn(Optional.of(user));
        String oldHash = user.getMatKhauHash();

        CommonException ex = assertThrows(CommonException.class,
                () -> service.changePassword(new ChangePasswordRequest("matkhaucu", "ệ".repeat(30))));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().startsWith("Mật khẩu quá dài"));
        assertEquals(oldHash, user.getMatKhauHash());
    }

    // ===== #6: tạo người dùng mới tự sinh mật khẩu tạm & gửi mail chào mừng =====

    @Test
    void createInternalUserByAdmin_khongCoMatKhauDungDuoc_guiLienKetDatMatKhau() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(1).build());
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
                .khoId(3)
                .build();

        NguoiDung created = service.createInternalUserByAdmin(req);

        assertNotNull(created);
        assertEquals("nhanvienmoi", created.getTenDangNhap());
        assertEquals("nhanvien@example.com", created.getEmail());
        assertTrue(created.getMustChangePassword(), "chưa đặt mật khẩu riêng");
        assertNotNull(created.getMatKhauHash());

        // E2 nhận mã liên kết (không phải mật khẩu): CSDL giữ băm của đúng mã đó, hạn 24 giờ, mục đích tạo tài khoản
        ArgumentCaptor<String> ma = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Instant> hetHan = ArgumentCaptor.forClass(Instant.class);
        verify(emailService).guiTaiKhoanMoi(same(created), ma.capture(), hetHan.capture());
        assertFalse(encoder.matches(ma.getValue(), created.getMatKhauHash()), "mã liên kết không phải mật khẩu");
        ArgumentCaptor<LienKetDatMatKhau> lk = ArgumentCaptor.forClass(LienKetDatMatKhau.class);
        verify(lienKetRepo).save(lk.capture());
        assertEquals(LienKetDatMatKhauService.bam(ma.getValue()), lk.getValue().getMaBam());
        assertEquals(99, lk.getValue().getNguoiDungId());
        assertEquals(1, lk.getValue().getTaoBoi());
        assertEquals(LienKetDatMatKhauService.TAO_TAI_KHOAN, lk.getValue().getMucDich());
        assertEquals(lk.getValue().getTaoLuc().plus(Duration.ofHours(24)), hetHan.getValue());
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
                .tenDangNhap("nv1").email("nv1@example.com").vaiTro(" ").khoId(3).build());
        NguoiDung quanLy = service.createInternalUserByAdmin(NguoiDungCreating.builder()
                .tenDangNhap("ql1").email("ql1@example.com").vaiTro(" quan_ly_kho ").khoId(3).build());

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

    // ===== H-1: giới hạn đăng nhập sai =====

    private CommonException dangNhapSai(String tenDangNhap) {
        return assertThrows(CommonException.class, () -> service.login(new LoginRequest(tenDangNhap, "saimatkhau"), IP, UA));
    }

    @Test
    void dangNhap_saiNamLan_khoaTam429_duMatKhauDung() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            assertEquals(NguoiDungService.LOGIN_FAILED_MESSAGE, dangNhapSai("khang").getMessage());
        }

        CommonException khoa = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", "matkhaucu"), IP, UA));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, khoa.getHttpStatus());
        assertEquals("LOGIN_RATE_LIMITED", ((Map<?, ?>) khoa.getData()).get("code"));
        assertEquals(60L, ((Map<?, ?>) khoa.getData()).get("retryAfterSeconds"));
        assertTrue(khoa.getMessage().contains("thử lại sau 1 phút"), khoa.getMessage());

        clock.advance(LoginRateLimiter.LOCK_STEPS[0]);
        assertNotNull(service.login(new LoginRequest("khang", "matkhaucu"), IP, UA).getBody().getData().getToken(),
                "hết thời gian khoá thì đăng nhập đúng được");
    }

    @Test
    void dangNhap_dangBiKhoa_khongChayBcrypt() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            dangNhapSai("khang");
        }
        BCryptPasswordEncoder spyEncoder = spy(encoder);
        ReflectionTestUtils.setField(service, "passwordEncoder", spyEncoder);

        CommonException khoa = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", "matkhaucu"), IP, UA));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, khoa.getHttpStatus());
        verify(spyEncoder, never()).matches(any(), any());
    }

    @Test
    void dangNhap_khoaChuoiKhongTonTai_cungPhanHoiNhuTaiKhoanThat() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            dangNhapSai("khongtontai");
            dangNhapSai("khang");
        }
        CommonException khongTonTai = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khongtontai", "x"), IP, UA));
        CommonException tonTai = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", "x"), IP, UA));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, tonTai.getHttpStatus());
        assertEquals(tonTai.getHttpStatus(), khongTonTai.getHttpStatus());
        assertEquals(tonTai.getMessage(), khongTonTai.getMessage(), "không lộ tài khoản có tồn tại");
        assertEquals(tonTai.getData(), khongTonTai.getData());
    }

    @Test
    void dangNhap_dungMatKhau_xoaBoDemSai() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS - 1; i++) {
            dangNhapSai("khang");
        }
        service.login(new LoginRequest("khang", "matkhaucu"), IP, UA);
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            assertEquals(NguoiDungService.LOGIN_FAILED_MESSAGE, dangNhapSai("khang").getMessage(),
                    "đếm lại từ đầu sau lần đúng");
        }
    }

    @Test
    void dangNhap_tenDangNhapEmailSdtVaBienTheDau_chungMotBoDem() {
        // CSDL dùng collation utf8mb4_unicode_ci: "khàng" cũng ra tài khoản "khang"
        lenient().when(repository.findByTenDangNhap("khàng")).thenReturn(Optional.of(user));
        String[] cungMotTaiKhoan = {"khang", EMAIL, "0912345678", "khàng", "khang"};
        for (String chuoi : cungMotTaiKhoan) {
            assertEquals(NguoiDungService.LOGIN_FAILED_MESSAGE, dangNhapSai(chuoi).getMessage(), chuoi);
        }

        for (String chuoi : new String[]{"khang", EMAIL, "0912345678", "khàng"}) {
            CommonException khoa = assertThrows(CommonException.class,
                    () -> service.login(new LoginRequest(chuoi, "matkhaucu"), IP, UA), chuoi);
            assertEquals(HttpStatus.TOO_MANY_REQUESTS, khoa.getHttpStatus(), chuoi);
        }
    }

    @Test
    void dangNhap_nhieuRequestSongSong_khongKiemQuaNguongMatKhau() throws Exception {
        BCryptPasswordEncoder spyEncoder = spy(encoder);
        ReflectionTestUtils.setField(service, "passwordEncoder", spyEncoder);
        ExecutorService pool = Executors.newFixedThreadPool(16);
        List<Future<?>> ketQua = new java.util.ArrayList<>();
        for (int i = 0; i < 32; i++) {
            ketQua.add(pool.submit(() -> assertThrows(CommonException.class,
                    () -> service.login(new LoginRequest("khang", "saimatkhau"), IP, UA))));
        }
        for (Future<?> f : ketQua) {
            f.get(30, TimeUnit.SECONDS);
        }
        pool.shutdown();

        verify(spyEncoder, times(LoginRateLimiter.MAX_FAILS)).matches(eq("saimatkhau"), eq(user.getMatKhauHash()));
    }

    @Test
    void dangNhap_taiKhoanBiKhoaTrangThai_khongTinhLaLanSai() {
        user.setTrangThai(0);
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS + 2; i++) {
            assertThrows(AccountDisabledException.class,
                    () -> service.login(new LoginRequest("khang", "matkhaucu"), IP, UA));
        }
    }

    @Test
    void doiMatKhau_saiMatKhauHienTaiNhieuLan_khoaCaDoiMatKhauVaDangNhap() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).build());
        when(repository.findById(7)).thenReturn(Optional.of(user));
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            CommonException sai = assertThrows(CommonException.class,
                    () -> service.changePassword(new ChangePasswordRequest("doan" , "matkhaumoi")));
            assertEquals("Mật khẩu hiện tại không đúng", sai.getMessage());
        }

        CommonException khoa = assertThrows(CommonException.class,
                () -> service.changePassword(new ChangePasswordRequest("matkhaucu", "matkhaumoi")));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, khoa.getHttpStatus());
        assertTrue(khoa.getMessage().startsWith(NguoiDungService.CHANGE_PASSWORD_LOCKED_MESSAGE), khoa.getMessage());
        CommonException dangNhap = assertThrows(CommonException.class,
                () -> service.login(new LoginRequest("khang", "matkhaucu"), IP, UA));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, dangNhap.getHttpStatus(), "cùng một mật khẩu bị dò");
        assertTrue(encoder.matches("matkhaucu", user.getMatKhauHash()), "mật khẩu chưa bị đổi");
    }

    @Test
    void datLaiMatKhauBangOtp_goKhoaDangNhap() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            dangNhapSai("khang");
        }
        forgot("khang", "1.1.1.1");
        String otp = (String) GlobalCache.OTP_SCHEDULE_OBJS.iterator().next().getOtp();
        service.resetPassword(new ResetPasswordRequest("khang", otp, "matkhaumoi"));

        assertNotNull(service.login(new LoginRequest("khang", "matkhaumoi"), IP, UA).getBody().getData().getToken(),
                "quên mật khẩu xong đăng nhập được ngay, không phải chờ hết khoá");
    }

    @Test
    void quanTriVienCapLaiMatKhau_goKhoaDangNhap() {
        when(repository.findById(7)).thenReturn(Optional.of(user));
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            dangNhapSai("khang");
        }
        service.resetPasswordRandomByAdmin(7);

        assertEquals(NguoiDungService.LOGIN_FAILED_MESSAGE, dangNhapSai("khang").getMessage(),
                "đã gỡ khoá: sai mật khẩu chỉ báo lỗi thường, không còn 429");
    }

    @Test
    void doiMatKhau_matKhauMoiQuaDai_khongLoMatKhauHienTaiDungHaySai() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).build());
        lenient().when(repository.findById(7)).thenReturn(Optional.of(user));
        CommonException saiHienTai = assertThrows(CommonException.class,
                () -> service.changePassword(new ChangePasswordRequest("doan", "ệ".repeat(30))));
        CommonException dungHienTai = assertThrows(CommonException.class,
                () -> service.changePassword(new ChangePasswordRequest("matkhaucu", "ệ".repeat(30))));

        assertEquals(dungHienTai.getMessage(), saiHienTai.getMessage());
        assertTrue(dungHienTai.getMessage().startsWith("Mật khẩu quá dài"), dungHienTai.getMessage());
    }

    // ---------- Nhật ký bảo mật (lich_su_thay_doi) ----------

    @Test
    void nhatKy_dangNhapThanhCong_ghiSauCommitKemIp() {
        service.login(new LoginRequest("khang", "matkhaucu"), IP, UA);

        verify(nhatKyBaoMatService).ghiSauCommit(com.dev.backend.constant.variables.IHanhDong.dang_nhap,
                com.dev.backend.constant.variables.ITable.nguoi_dung, 7, 7, "IP " + IP);
        verify(nhatKyBaoMatService, never()).ghiNgay(any(), any(), any(), any(), any());
    }

    @Test
    void nhatKy_saiMatKhau_ghiNgayVi_giaoDichSeRollback_khongGhiMatKhau() {
        dangNhapSai("khang");

        org.mockito.ArgumentCaptor<String> ghiChu = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(nhatKyBaoMatService).ghiNgay(eq(com.dev.backend.constant.variables.IHanhDong.dang_nhap_that_bai),
                eq(com.dev.backend.constant.variables.ITable.nguoi_dung), eq(7), eq(7), ghiChu.capture());
        assertEquals("Sai mật khẩu, IP " + IP, ghiChu.getValue());
        assertFalse(ghiChu.getValue().contains("saimatkhau"));
        verify(nhatKyBaoMatService, never()).ghiSauCommit(any(), any(), any(), any(), any());
    }

    @Test
    void nhatKy_tenKhongTonTai_khongGhi_dangBiKhoaTam_khongGhiThem() {
        assertThrows(CommonException.class, () -> service.login(new LoginRequest("khongtontai", "x"), IP, UA));
        verifyNoInteractions(nhatKyBaoMatService);

        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            dangNhapSai("khang");
        }
        clearInvocations(nhatKyBaoMatService);
        // Đang khóa tạm: bị chặn trước khi kiểm mật khẩu, không ghi (kẻ dò mật khẩu không làm phình bảng)
        assertThrows(CommonException.class, () -> service.login(new LoginRequest("khang", "saimatkhau"), IP, UA));
        verifyNoInteractions(nhatKyBaoMatService);
    }

    @Test
    void nhatKy_dungMatKhauNhungTaiKhoanBiKhoa_ghiThatBaiCoGioiHan() {
        // Không tính là lần sai (xem dangNhap_taiKhoanBiKhoaTrangThai_khongTinhLaLanSai) nên nhật ký phải tự giới hạn
        user.setTrangThai(0);
        assertThrows(AccountDisabledException.class, () -> service.login(new LoginRequest("khang", "matkhaucu"), IP, UA));

        verify(nhatKyBaoMatService).ghiNgayGioiHan(eq(com.dev.backend.constant.variables.IHanhDong.dang_nhap_that_bai),
                eq(com.dev.backend.constant.variables.ITable.nguoi_dung), eq(7), eq(7),
                eq("Đúng mật khẩu nhưng tài khoản không được phép đăng nhập, IP " + IP),
                eq(NguoiDungService.KHOANG_GHI_TAI_KHOAN_BI_KHOA));
        verify(nhatKyBaoMatService, never()).ghiNgay(any(), any(), any(), any(), any());
    }

    @Test
    void nhatKy_quanTriKhoaTaiKhoan_nguoiThucHienLaQuanTri() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(1).build());
        when(repository.findById(7)).thenReturn(Optional.of(user));
        when(repository.save(any(NguoiDung.class))).thenAnswer(inv -> inv.getArgument(0));

        service.toggleStatusByAdmin(7);
        verify(nhatKyBaoMatService).ghiSauCommit(com.dev.backend.constant.variables.IHanhDong.khoa_tai_khoan,
                com.dev.backend.constant.variables.ITable.nguoi_dung, 7, 1, null);

        service.toggleStatusByAdmin(7);
        verify(nhatKyBaoMatService).ghiSauCommit(com.dev.backend.constant.variables.IHanhDong.mo_khoa_tai_khoan,
                com.dev.backend.constant.variables.ITable.nguoi_dung, 7, 1, null);
    }

    @Test
    void nhatKy_quanTriCapLaiMatKhau_nguoiThucHienLaQuanTri() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(1).build());
        when(repository.findById(7)).thenReturn(Optional.of(user));
        service.resetPasswordRandomByAdmin(7);
        verify(nhatKyBaoMatService).ghiSauCommit(com.dev.backend.constant.variables.IHanhDong.dat_lai_mat_khau,
                com.dev.backend.constant.variables.ITable.nguoi_dung, 7, 1,
                "Quản trị viên gửi liên kết đặt lại mật khẩu qua email");
    }

    // ---------- Cấp lại mật khẩu bằng liên kết (chốt 01/11/2026) ----------

    @Test
    void quanTriVienCapLai_matKhauCuHetHieuLucNgay_thuHoiPhien_guiLienKet() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(1).build());
        when(repository.findById(7)).thenReturn(Optional.of(user));

        service.resetPasswordRandomByAdmin(7);

        assertFalse(encoder.matches("matkhaucu", user.getMatKhauHash()), "mật khẩu cũ không dùng được nữa");
        assertTrue(user.getMustChangePassword());
        verify(repository).save(user);
        verify(phienDangNhapService).thuHoiTatCa(7);
        ArgumentCaptor<String> ma = ArgumentCaptor.forClass(String.class);
        verify(emailService).guiCapLaiMatKhau(same(user), ma.capture(), any(Instant.class), any(Instant.class));
        assertFalse(encoder.matches(ma.getValue(), user.getMatKhauHash()), "mã liên kết không phải mật khẩu");
        ArgumentCaptor<LienKetDatMatKhau> lk = ArgumentCaptor.forClass(LienKetDatMatKhau.class);
        verify(lienKetRepo).save(lk.capture());
        assertEquals(LienKetDatMatKhauService.CAP_LAI, lk.getValue().getMucDich());
        verify(lienKetRepo).huyConMo(eq(7), any(Instant.class));
    }

    @Test
    void quanTriVien_khongTuCapLaiChoChinhMinh() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).build());
        when(repository.findById(7)).thenReturn(Optional.of(user));
        String cu = user.getMatKhauHash();

        CommonException ex = assertThrows(CommonException.class, () -> service.resetPasswordRandomByAdmin(7));
        assertTrue(ex.getMessage().contains("chính tài khoản của bạn"), ex.getMessage());
        assertEquals(cu, user.getMatKhauHash());
        verify(repository, never()).save(any());
        verifyNoInteractions(emailService, lienKetRepo);
    }

    @Test
    void datLaiMatKhauBangOtp_goCoPhaiDoiMatKhau_luuRoRang() {
        user.setMustChangePassword(true);
        forgot("khang", "1.1.1.1");
        String otp = (String) GlobalCache.OTP_SCHEDULE_OBJS.iterator().next().getOtp();

        service.resetPassword(new ResetPasswordRequest("khang", otp, "matkhaumoi"));

        assertFalse(user.getMustChangePassword(), "tự đặt bằng mã email thì không bắt đổi lần nữa");
        assertTrue(encoder.matches("matkhaumoi", user.getMatKhauHash()));
        verify(repository).save(user);
        verify(phienDangNhapService).thuHoiTatCa(7);
        verify(lienKetRepo).huyConMo(eq(7), any(Instant.class));
    }

    @Test
    void quanTriVien_khongCapLaiChoTaiKhoanKhongPhaiNhanSu() {
        com.dev.backend.config.SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(1).build());
        user.setVaiTro("khach_hang");
        when(repository.findById(7)).thenReturn(Optional.of(user));

        assertThrows(CommonException.class, () -> service.resetPasswordRandomByAdmin(7));
        assertTrue(encoder.matches("matkhaucu", user.getMatKhauHash()));
        verifyNoInteractions(emailService, lienKetRepo);
    }

    // ---------- Đặt mật khẩu qua liên kết ----------

    private static final String MA = "Zx9_-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ab";

    private LienKetDatMatKhau lienKetCua(NguoiDung nd) {
        Instant bayGio = Instant.now();
        LienKetDatMatKhau lk = LienKetDatMatKhau.builder().id(5).nguoiDungId(nd.getId())
                .maBam(LienKetDatMatKhauService.bam(MA)).mucDich(LienKetDatMatKhauService.CAP_LAI)
                .taoLuc(bayGio.minus(Duration.ofHours(1))).hetHanLuc(bayGio.plus(Duration.ofHours(23))).build();
        lenient().when(lienKetRepo.findByMaBam(lk.getMaBam())).thenReturn(Optional.of(lk));
        lenient().when(lienKetRepo.khoaTheoMaBam(lk.getMaBam())).thenReturn(Optional.of(lk));
        lenient().when(repository.findById(nd.getId())).thenReturn(Optional.of(nd));
        return lk;
    }

    private static String maLoi(Runnable r) {
        return assertThrows(LoiCoMaException.class, r::run).getMa();
    }

    @Test
    void kiemTraLienKet_traTaiKhoanVaHan_khongTieuMa() {
        user.setTrangThai(0);
        LienKetDatMatKhau lk = lienKetCua(user);

        LienKetMatKhauDto dto = service.kiemTraLienKetMatKhau(new KiemTraLienKetMatKhauRequest(MA)).getBody().getData();

        assertEquals("khang", dto.getTenDangNhap());
        assertEquals(EMAIL, dto.getEmail());
        assertEquals(lk.getHetHanLuc(), dto.getHetHanLuc());
        assertEquals(LienKetDatMatKhauService.CAP_LAI, dto.getMucDich());
        assertTrue(dto.isDangKhoa());
        assertNull(lk.getDaDungLuc(), "mở trang không tiêu mã");
        verify(lienKetRepo, never()).khoaTheoMaBam(any());
    }

    @Test
    void datQuaLienKet_datMatKhau_goCo_dangXuatMoiNoi_guiM4_dangNhapDuoc() {
        user.setMustChangePassword(true);
        LienKetDatMatKhau lk = lienKetCua(user);

        ResponseData<String> kq = service.datMatKhauQuaLienKet(new DatMatKhauQuaLienKetRequest(MA, " mật khẩu mới ")).getBody();

        assertEquals("khang", kq.getData());
        assertNotNull(lk.getDaDungLuc(), "liên kết đã dùng");
        verify(lienKetRepo).khoaTheoMaBam(LienKetDatMatKhauService.bam(MA));
        assertTrue(encoder.matches(" mật khẩu mới ", user.getMatKhauHash()), "giữ nguyên khoảng trắng như người dùng gõ");
        assertFalse(user.getMustChangePassword());
        verify(repository).save(user);
        verify(lienKetRepo).huyConMo(eq(7), any(Instant.class));
        verify(phienDangNhapService).thuHoiTatCa(7);
        verify(emailService).guiDaDoiMatKhau(same(user), eq(com.dev.backend.services.email.CachDoiMatKhau.DAT_QUA_LIEN_KET),
                any(Instant.class));
        assertNotNull(service.login(new LoginRequest("khang", " mật khẩu mới "), IP, UA).getBody().getData().getToken());
    }

    @Test
    void datQuaLienKet_lanDauCuaTaiKhoanMoi_khongGuiM4() {
        user.setMustChangePassword(true);
        LienKetDatMatKhau lk = lienKetCua(user);
        lk.setMucDich(LienKetDatMatKhauService.TAO_TAI_KHOAN);

        service.datMatKhauQuaLienKet(new DatMatKhauQuaLienKetRequest(MA, "mat-khau-moi"));

        assertNotNull(lk.getDaDungLuc(), "liên kết đã dùng");
        assertFalse(user.getMustChangePassword());
        verify(phienDangNhapService).thuHoiTatCa(7);
        verify(emailService, never()).guiDaDoiMatKhau(any(), any(), any());
    }

    @Test
    void datQuaLienKet_matKhauKhongHopLe_khongDungToiLienKet() {
        lienKetCua(user);
        assertEquals("Nhập mật khẩu mới", assertThrows(CommonException.class,
                () -> service.datMatKhauQuaLienKet(new DatMatKhauQuaLienKetRequest(MA, ""))).getMessage());
        assertEquals("Nhập mật khẩu mới", assertThrows(CommonException.class,
                () -> service.datMatKhauQuaLienKet(new DatMatKhauQuaLienKetRequest(MA, "      "))).getMessage(),
                "toàn dấu cách");
        assertTrue(assertThrows(CommonException.class,
                () -> service.datMatKhauQuaLienKet(new DatMatKhauQuaLienKetRequest(MA, "12345"))).getMessage()
                .contains("ít nhất 6 ký tự"));
        assertTrue(assertThrows(CommonException.class,
                () -> service.datMatKhauQuaLienKet(new DatMatKhauQuaLienKetRequest(MA, "ệ".repeat(30)))).getMessage()
                .startsWith("Mật khẩu quá dài"));
        verifyNoInteractions(lienKetRepo);
        assertTrue(encoder.matches("matkhaucu", user.getMatKhauHash()));
    }

    @Test
    void datQuaLienKet_lienKetKhongDungDuoc_khongDoiMatKhau() {
        LienKetDatMatKhau lk = lienKetCua(user);
        DatMatKhauQuaLienKetRequest req = new DatMatKhauQuaLienKetRequest(MA, "matkhaumoi");

        lk.setDaDungLuc(Instant.now());
        assertEquals(MaLoi.LIEN_KET_DA_DUNG, maLoi(() -> service.datMatKhauQuaLienKet(req)));
        lk.setDaDungLuc(null);
        lk.setHuyLuc(Instant.now());
        assertEquals(MaLoi.LIEN_KET_DA_THAY, maLoi(() -> service.datMatKhauQuaLienKet(req)));
        lk.setHuyLuc(null);
        lk.setHetHanLuc(Instant.now().minusSeconds(1));
        assertEquals(MaLoi.LIEN_KET_HET_HAN, maLoi(() -> service.datMatKhauQuaLienKet(req)));
        assertEquals(MaLoi.LIEN_KET_KHONG_HOP_LE,
                maLoi(() -> service.datMatKhauQuaLienKet(new DatMatKhauQuaLienKetRequest("sai", "matkhaumoi"))));

        assertTrue(encoder.matches("matkhaucu", user.getMatKhauHash()));
        verify(repository, never()).save(any());
        verifyNoInteractions(emailService);
    }

    @Test
    void datQuaLienKet_requestSau_docDongDaKhoa_thayDaDungHoacDaThay() {
        LienKetDatMatKhau lk = lienKetCua(user);
        DatMatKhauQuaLienKetRequest req = new DatMatKhauQuaLienKetRequest(MA, "matkhaumoi");
        // request trước giữ khóa dòng rồi commit; request sau đọc dòng mới nhất (FOR UPDATE)
        LienKetDatMatKhau sauKhiDung = LienKetDatMatKhau.builder().id(5).nguoiDungId(7).maBam(lk.getMaBam())
                .mucDich(lk.getMucDich()).taoLuc(lk.getTaoLuc()).hetHanLuc(lk.getHetHanLuc()).daDungLuc(Instant.now())
                .build();
        when(lienKetRepo.khoaTheoMaBam(lk.getMaBam())).thenReturn(Optional.of(sauKhiDung));
        assertEquals(MaLoi.LIEN_KET_DA_DUNG, maLoi(() -> service.datMatKhauQuaLienKet(req)));

        sauKhiDung.setDaDungLuc(null);
        sauKhiDung.setHuyLuc(Instant.now());
        assertEquals(MaLoi.LIEN_KET_DA_THAY, maLoi(() -> service.datMatKhauQuaLienKet(req)),
                "quản trị viên vừa gửi liên kết mới");

        assertTrue(encoder.matches("matkhaucu", user.getMatKhauHash()), "request thua không đổi mật khẩu");
        verify(repository, never()).save(any());
    }

    @Test
    void lienKet_taiKhoanKhongPhaiNhanSu_coiNhuKhongHopLe() {
        user.setVaiTro("khach_hang");
        lienKetCua(user);
        assertEquals(MaLoi.LIEN_KET_KHONG_HOP_LE,
                maLoi(() -> service.kiemTraLienKetMatKhau(new KiemTraLienKetMatKhauRequest(MA))));
    }
}
