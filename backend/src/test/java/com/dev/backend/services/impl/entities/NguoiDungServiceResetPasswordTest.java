package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.dto.request.ForgotPasswordRequest;
import com.dev.backend.dto.request.ResetPasswordRequest;
import com.dev.backend.dto.request.VerifyResetOtpRequest;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.CalcService;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.utils.LoginRateLimiter;
import com.dev.backend.services.impl.utils.PasswordResetRateLimiter;
import com.dev.backend.workers.SchedulingJob;
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

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test luồng quên mật khẩu / đặt lại mật khẩu bằng OTP lưu trong GlobalCache:
 * gửi lại OTP thay mã cũ, không đụng OTP loại khác cùng email, OTP hết hạn,
 * giới hạn 5 lần nhập sai, mỗi mã chỉ dùng 1 lần, an toàn khi gọi đồng thời.
 * Repository/email mock — không đụng DB, không gửi mail thật.
 */
@ExtendWith(MockitoExtension.class)
class NguoiDungServiceResetPasswordTest {

    private static final String USERNAME = "khang";
    private static final String EMAIL = "khang@example.com";
    private static final String OLD_HASH = "$2a$10$hash.cu";

    @Mock
    private NguoiDungRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private CalcService calcService;
    @Mock
    private EmailNghiepVuService emailService;
    @Mock
    private PasswordResetRateLimiter rateLimiter;


    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private NguoiDungService service;
    private NguoiDung user;

    @BeforeEach
    void setUp() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
        service = new NguoiDungService(repository);
        ReflectionTestUtils.setField(service, "passwordEncoder", passwordEncoder);
        ReflectionTestUtils.setField(service, "calcService", calcService);
        ReflectionTestUtils.setField(service, "emailNghiepVuService", emailService);
        // bộ giới hạn mặc định cho qua (test riêng ở PasswordResetRateLimiterTest)
        ReflectionTestUtils.setField(service, "passwordResetRateLimiter", rateLimiter);
        ReflectionTestUtils.setField(service, "loginRateLimiter", new LoginRateLimiter());
        ReflectionTestUtils.setField(service, "nhatKyBaoMatService",
                org.mockito.Mockito.mock(com.dev.backend.services.impl.utils.NhatKyBaoMatService.class));
        lenient().when(rateLimiter.tryAcquire(anyString(), anyString(), any()))
                .thenReturn(PasswordResetRateLimiter.Decision.ALLOWED);

        user = NguoiDung.builder().id(7).tenDangNhap(USERNAME).hoTen("Nguyễn Đăng Khang")
                .email(EMAIL).matKhauHash(OLD_HASH).vaiTro("nhan_vien_kho").trangThai(1).build();
        lenient().when(repository.findByTenDangNhap(USERNAME)).thenReturn(Optional.of(user));
    }

    @AfterEach
    void tearDown() {
        GlobalCache.OTP_SCHEDULE_OBJS.clear();
    }

    private ResponseData<String> forgot() {
        return service.forgotPassword(new ForgotPasswordRequest(USERNAME), "1.1.1.1").getBody();
    }

    private ResponseData<String> reset(String otp, String password) {
        return service.resetPassword(new ResetPasswordRequest(USERNAME, otp, password)).getBody();
    }

    private List<OtpScheduleObj> resetOtpsInCache() {
        return GlobalCache.OTP_SCHEDULE_OBJS.stream()
                .filter(o -> o.getType() == OtpType.RESET_PASSWORD && EMAIL.equals(o.getEmail()))
                .toList();
    }

    // ===== Lỗi gốc: gửi lại OTP =====

    @Test
    void guiLaiOtp_chiGiuMaMoiNhat_maMoiDungDuoc_maCuBiTuChoi() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111", "222222");

        forgot();
        forgot(); // bấm "Gửi lại OTP"

        List<OtpScheduleObj> otps = resetOtpsInCache();
        assertEquals(1, otps.size(), "chỉ được còn 1 mã RESET_PASSWORD cho email");
        assertEquals("222222", otps.get(0).getOtp(), "mã còn hiệu lực phải là mã trong email mới nhất");
        verify(emailService).guiMaDatLaiMatKhau(same(user), eq("111111"), any(Instant.class), any(Instant.class));
        verify(emailService).guiMaDatLaiMatKhau(same(user), eq("222222"), any(Instant.class), any(Instant.class));

        CommonException oldCode = assertThrows(CommonException.class, () -> reset("111111", "matkhaumoi"));
        assertEquals(HttpStatus.BAD_REQUEST, oldCode.getHttpStatus());
        assertEquals(OLD_HASH, user.getMatKhauHash());

        ResponseData<String> ok = reset("222222", "matkhaumoi");
        assertEquals(200, ok.getStatus());
        assertTrue(passwordEncoder.matches("matkhaumoi", user.getMatKhauHash()));
        assertTrue(resetOtpsInCache().isEmpty(), "dùng xong phải xoá OTP");
    }

    @Test
    void guiLaiOtp_resetBoDemNhapSai() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111", "222222");
        forgot();
        for (int i = 0; i < 4; i++) {
            assertThrows(CommonException.class, () -> reset("999999", "matkhaumoi"));
        }
        forgot(); // mã mới -> bộ đếm mới

        assertEquals(0, resetOtpsInCache().get(0).getFailedAttempts().get());
        assertEquals(200, reset("222222", "matkhaumoi").getStatus());
    }

    @Test
    void forgotPassword_khongXoaOtpLoaiKhacCungEmail() {
        OtpScheduleObj supplierOtp = OtpScheduleObj.builder()
                .email(EMAIL).otp("555555").type(OtpType.SUPPLIER_MAIL_SIGN_KEY).build();
        GlobalCache.OTP_SCHEDULE_OBJS.add(supplierOtp);
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");

        forgot();

        // trước đây equals theo email -> OTP đặt lại MK bị set bỏ qua vì đã có OTP NCC cùng email
        assertEquals(2, GlobalCache.OTP_SCHEDULE_OBJS.size());
        assertEquals(200, reset("111111", "matkhaumoi").getStatus());
        assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.contains(supplierOtp), "OTP nhà cung cấp phải được giữ nguyên");
    }

    @Test
    void forgotPassword_khongXoaOtpDatLaiMkCuaEmailKhac() {
        OtpScheduleObj other = OtpScheduleObj.builder()
                .email("nguoikhac@example.com").otp("333333").type(OtpType.RESET_PASSWORD).build();
        GlobalCache.OTP_SCHEDULE_OBJS.add(other);
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");

        forgot();

        assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.contains(other));
        assertEquals(1, resetOtpsInCache().size());
    }

    @Test
    void forgotPassword_thanhCong_traThongBaoChung() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        ResponseData<String> res = forgot();
        assertEquals(200, res.getStatus());
        assertEquals(NguoiDungService.FORGOT_PASSWORD_GENERIC_MESSAGE, res.getMessage());
    }

    @Test
    void guiMa_hetHan_bangLucTaoCongTTL_khopMaTrongBoNho() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("333333");

        forgot();

        OtpScheduleObj otp = resetOtpsInCache().get(0);
        org.mockito.ArgumentCaptor<Instant> taoLuc = org.mockito.ArgumentCaptor.forClass(Instant.class);
        org.mockito.ArgumentCaptor<Instant> hetHan = org.mockito.ArgumentCaptor.forClass(Instant.class);
        verify(emailService).guiMaDatLaiMatKhau(same(user), eq("333333"), taoLuc.capture(), hetHan.capture());
        assertEquals(otp.getCreatedAt(), taoLuc.getValue(), "E1 kiểm mã còn hiệu lực theo createdAt");
        assertEquals(otp.getCreatedAt().plusSeconds(NguoiDungService.RESET_OTP_TTL_SECONDS), hetHan.getValue());
        // câu phản hồi dựng từ hằng thời hạn, không còn chữ OTP
        assertTrue(NguoiDungService.FORGOT_PASSWORD_GENERIC_MESSAGE.contains("5 phút"));
        assertFalse(NguoiDungService.FORGOT_PASSWORD_GENERIC_MESSAGE.contains("OTP"));
    }

    @Test
    void datLaiThanhCong_guiM4DatLaiBangMa_saiMaThiKhongGui() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("444444");
        forgot();

        assertThrows(CommonException.class, () -> reset("000000", "matkhaumoi"));
        verify(emailService, never()).guiDaDoiMatKhau(any(), any(), any());

        reset("444444", "matkhaumoi");
        verify(emailService).guiDaDoiMatKhau(same(user),
                eq(com.dev.backend.services.email.CachDoiMatKhau.DAT_LAI_BANG_MA), any(Instant.class));
    }

    @Test
    void forgotPassword_taiKhoanKhongCoEmail_phanHoiChung_khongTaoOtp() {
        user.setEmail("  ");

        ResponseData<String> res = forgot();

        assertEquals(200, res.getStatus());
        assertEquals(NguoiDungService.FORGOT_PASSWORD_GENERIC_MESSAGE, res.getMessage());
        assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.isEmpty());
        verifyNoInteractions(emailService);
        // không gửi email -> không tính giới hạn theo tài khoản / quota hệ thống
        verify(rateLimiter).tryAcquire("khang", "1.1.1.1", null);
    }

    @Test
    void forgotPassword_khongTimThayTaiKhoan_phanHoiGiongHetTaiKhoanCoThat() {
        // Mockito mặc định: Optional.empty() / danh sách rỗng cho mọi truy vấn "x"
        ResponseData<String> res = service.forgotPassword(new ForgotPasswordRequest("x"), "1.1.1.1").getBody();

        assertEquals(200, res.getStatus());
        assertEquals(NguoiDungService.FORGOT_PASSWORD_GENERIC_MESSAGE, res.getMessage());
        assertEquals("Success", res.getData());
        assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.isEmpty());
        verifyNoInteractions(emailService);
        // vẫn bị tính giới hạn theo chuỗi nhập + IP như tài khoản có thật
        verify(rateLimiter).tryAcquire("x", "1.1.1.1", null);
    }

    // ===== resetPassword =====

    @Test
    void resetPassword_chuaYeuCauOtp_baoMaKhongTonTai() {
        CommonException ex = assertThrows(CommonException.class, () -> reset("123456", "matkhaumoi"));
        assertEquals("Mã xác nhận không tồn tại hoặc đã hết hạn", ex.getMessage());
        assertEquals(OLD_HASH, user.getMatKhauHash());
    }

    @Test
    void resetPassword_maHetHan_tuChoiVaXoaMa_keCaKhiNhapDung() {
        GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder()
                .email(EMAIL).otp("111111").type(OtpType.RESET_PASSWORD)
                .createdAt(Instant.now().minusSeconds(NguoiDungService.RESET_OTP_TTL_SECONDS + 1)).build());

        CommonException ex = assertThrows(CommonException.class, () -> reset("111111", "matkhaumoi"));

        assertEquals("Mã xác nhận không tồn tại hoặc đã hết hạn", ex.getMessage());
        assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.isEmpty());
        assertEquals(OLD_HASH, user.getMatKhauHash());
    }

    @Test
    void resetPassword_maConHanSatNguong_vanDung() {
        GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder()
                .email(EMAIL).otp("111111").type(OtpType.RESET_PASSWORD)
                .createdAt(Instant.now().minusSeconds(NguoiDungService.RESET_OTP_TTL_SECONDS - 5)).build());

        assertEquals(200, reset("111111", "matkhaumoi").getStatus());
    }

    @Test
    void resetPassword_nhapSai_baoSoLanConLai_quaNamLanThiHuyMa() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();

        for (int i = 1; i <= 4; i++) {
            CommonException ex = assertThrows(CommonException.class, () -> reset("999999", "matkhaumoi"));
            assertEquals("Mã xác nhận không đúng, bạn còn " + (5 - i) + " lần thử", ex.getMessage());
            assertEquals(1, resetOtpsInCache().size(), "chưa đủ 5 lần thì mã vẫn còn");
        }

        CommonException fifth = assertThrows(CommonException.class, () -> reset("999999", "matkhaumoi"));
        assertEquals("Bạn đã nhập sai mã xác nhận quá 5 lần, vui lòng yêu cầu mã mới", fifth.getMessage());
        assertTrue(resetOtpsInCache().isEmpty(), "sai lần thứ 5 phải huỷ mã");

        // mã đúng cũng không dùng được nữa
        CommonException afterLock = assertThrows(CommonException.class, () -> reset("111111", "matkhaumoi"));
        assertEquals("Mã xác nhận không tồn tại hoặc đã hết hạn", afterLock.getMessage());
        assertEquals(OLD_HASH, user.getMatKhauHash());
    }

    @Test
    void resetPassword_nhapSaiVaiLanRoiDung_thanhCong() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();
        assertThrows(CommonException.class, () -> reset("999999", "matkhaumoi"));
        assertThrows(CommonException.class, () -> reset("000000", "matkhaumoi"));

        assertEquals(200, reset("111111", "matkhaumoi").getStatus());
        assertTrue(passwordEncoder.matches("matkhaumoi", user.getMatKhauHash()));
    }

    @Test
    void resetPassword_maChiDungDuocMotLan() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();
        assertEquals(200, reset("111111", "matkhaumoi").getStatus());
        String hashAfterFirst = user.getMatKhauHash();

        CommonException ex = assertThrows(CommonException.class, () -> reset("111111", "matkhaukhac"));

        assertEquals("Mã xác nhận không tồn tại hoặc đã hết hạn", ex.getMessage());
        assertEquals(hashAfterFirst, user.getMatKhauHash());
    }

    @Test
    void resetPassword_matKhauQua72Byte_bao400_giuNguyenOtp() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();

        // 30 ký tự có dấu = 90 byte UTF-8: BCrypt sẽ ném IllegalArgumentException (500) nếu không chặn trước
        for (String tooLong : new String[]{"a".repeat(73), "ệ".repeat(30)}) {
            CommonException ex = assertThrows(CommonException.class, () -> reset("111111", tooLong));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
            assertTrue(ex.getMessage().startsWith("Mật khẩu quá dài"));
        }

        // mã chưa bị dùng và không bị tính là nhập sai
        assertEquals(1, resetOtpsInCache().size());
        assertEquals(0, resetOtpsInCache().get(0).getFailedAttempts().get());
        assertEquals(OLD_HASH, user.getMatKhauHash());

        // đúng 72 byte vẫn hợp lệ
        assertEquals(200, reset("111111", "a".repeat(72)).getStatus());
        assertTrue(passwordEncoder.matches("a".repeat(72), user.getMatKhauHash()));
    }

    @Test
    void resetPassword_khongDungOtpLoaiKhacCungEmail() {
        GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder()
                .email(EMAIL).otp("555555").type(OtpType.SUPPLIER_MAIL_SIGN_KEY).build());

        assertThrows(CommonException.class, () -> reset("555555", "matkhaumoi"));
        assertEquals(OLD_HASH, user.getMatKhauHash());
    }

    @Test
    void resetPassword_otpTrongCacheCoEmailNull_khongNem500() {
        // OTP email null (dữ liệu cũ) trước đây làm getEmail().equals(...) ném NPE -> 500
        GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder()
                .email(null).otp("444444").type(OtpType.RESET_PASSWORD).build());
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();

        assertEquals(200, reset("111111", "matkhaumoi").getStatus());
    }

    @Test
    void otpScheduleObj_khoiTaoMacDinh_coBoDem() {
        assertNotNull(new OtpScheduleObj().getFailedAttempts());
        assertNotNull(OtpScheduleObj.builder().build().getFailedAttempts());
        // so sánh theo đối tượng: 2 OTP cùng email cùng tồn tại được trong set
        OtpScheduleObj a = OtpScheduleObj.builder().email(EMAIL).otp("1").build();
        OtpScheduleObj b = OtpScheduleObj.builder().email(EMAIL).otp("2").build();
        assertNotEquals(a, b);
    }

    // ===== verifyResetOtp (bước "Xác thực OTP") =====

    private void verifyOtp(String otp) {
        service.verifyResetOtp(new VerifyResetOtpRequest(USERNAME, otp));
    }

    @SuppressWarnings("unchecked")
    private static Object dataField(CommonException ex, String key) {
        assertInstanceOf(Map.class, ex.getData(), "lỗi OTP phải kèm data có code cho FE");
        return ((Map<String, Object>) ex.getData()).get(key);
    }

    @Test
    void verifyResetOtp_maDung_khongTieuThuMa_doiMatKhauSauDoThanhCong() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();

        verifyOtp("111111");
        verifyOtp("111111"); // xác thực lại (vd. bấm Quay lại rồi Tiếp tục) vẫn hợp lệ

        assertEquals(1, resetOtpsInCache().size(), "xác thực không được xoá mã");
        assertEquals(0, resetOtpsInCache().get(0).getFailedAttempts().get());
        assertEquals(OLD_HASH, user.getMatKhauHash(), "xác thực không được đổi mật khẩu");
        assertEquals(200, reset("111111", "matkhaumoi").getStatus());
        assertTrue(passwordEncoder.matches("matkhaumoi", user.getMatKhauHash()));
    }

    @Test
    void verifyResetOtp_maSai_bao400_codeWrong_kemSoLanConLai() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();

        CommonException ex = assertThrows(CommonException.class, () -> verifyOtp("999999"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertEquals("Mã xác nhận không đúng, bạn còn 4 lần thử", ex.getMessage());
        assertEquals(NguoiDungService.RESET_OTP_WRONG_CODE, dataField(ex, "code"));
        assertEquals(4, dataField(ex, "remainingAttempts"));
        assertEquals(1, resetOtpsInCache().size(), "sai chưa đủ 5 lần thì mã vẫn còn");
    }

    @Test
    void verifyVaReset_dungChungBoDemNhapSai() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();
        for (int i = 0; i < 3; i++) assertThrows(CommonException.class, () -> verifyOtp("999999"));
        assertThrows(CommonException.class, () -> reset("999999", "matkhaumoi"));

        CommonException fifth = assertThrows(CommonException.class, () -> verifyOtp("999999"));

        assertEquals("Bạn đã nhập sai mã xác nhận quá 5 lần, vui lòng yêu cầu mã mới", fifth.getMessage());
        assertEquals(NguoiDungService.RESET_OTP_EXPIRED_CODE, dataField(fifth, "code"));
        assertTrue(resetOtpsInCache().isEmpty());
        CommonException after = assertThrows(CommonException.class, () -> verifyOtp("111111"));
        assertEquals(NguoiDungService.RESET_OTP_EXPIRED_CODE, dataField(after, "code"));
    }

    @Test
    void verifyResetOtp_chuaGuiMa_hoacHetHan_codeExpired() {
        CommonException none = assertThrows(CommonException.class, () -> verifyOtp("111111"));
        assertEquals(NguoiDungService.RESET_OTP_EXPIRED_CODE, dataField(none, "code"));

        GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder()
                .email(EMAIL).otp("111111").type(OtpType.RESET_PASSWORD)
                .createdAt(Instant.now().minusSeconds(NguoiDungService.RESET_OTP_TTL_SECONDS + 1)).build());
        CommonException expired = assertThrows(CommonException.class, () -> verifyOtp("111111"));
        assertEquals("Mã xác nhận không tồn tại hoặc đã hết hạn", expired.getMessage());
        assertEquals(NguoiDungService.RESET_OTP_EXPIRED_CODE, dataField(expired, "code"));
        assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.isEmpty());
    }

    @Test
    void resetPassword_maHetHanSauKhiDaXacThuc_codeExpired() {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();
        verifyOtp("111111");
        // người dùng ngồi ở bước nhập mật khẩu quá 5 phút
        resetOtpsInCache().get(0).setCreatedAt(Instant.now().minusSeconds(NguoiDungService.RESET_OTP_TTL_SECONDS + 1));

        CommonException ex = assertThrows(CommonException.class, () -> reset("111111", "matkhaumoi"));

        assertEquals(NguoiDungService.RESET_OTP_EXPIRED_CODE, dataField(ex, "code"));
        assertEquals(OLD_HASH, user.getMatKhauHash());
    }

    @Test
    void verifyResetOtp_khongTimThayTaiKhoan_baoGiongMaHetHan() {
        CommonException ex = assertThrows(CommonException.class,
                () -> service.verifyResetOtp(new VerifyResetOtpRequest("x", "111111")));

        assertEquals("Mã xác nhận không tồn tại hoặc đã hết hạn", ex.getMessage());
        assertEquals(NguoiDungService.RESET_OTP_EXPIRED_CODE, dataField(ex, "code"));
    }

    // ===== Đồng thời =====

    @Test
    void forgotPassword_goiDongThoi_chiConMotMa() throws Exception {
        AtomicInteger seq = new AtomicInteger(100000);
        when(calcService.getRandomActiveCode(6L)).thenAnswer(inv -> String.valueOf(seq.incrementAndGet()));
        // nhiều OTP khác -> removeIf quét lâu hơn, nới rộng khoảng giữa "xoá mã cũ" và "thêm mã mới"
        for (int i = 0; i < 200_000; i++) {
            GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder()
                    .email("filler" + i + "@x.com").otp("1").type(OtpType.RESET_PASSWORD).build());
        }

        runConcurrently(32, this::forgot);

        assertEquals(1, resetOtpsInCache().size());
    }

    @Test
    void resetPassword_goiDongThoiCungMaDung_chiMotRequestThanhCong() throws Exception {
        when(calcService.getRandomActiveCode(6L)).thenReturn("111111");
        forgot();
        // thêm nhiều OTP khác để bước tìm mã chạy lâu hơn -> các luồng cùng thấy mã rồi mới tranh nhau xoá
        for (int i = 0; i < 200_000; i++) {
            GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder()
                    .email("filler" + i + "@x.com").otp("1").type(OtpType.RESET_PASSWORD).build());
        }
        AtomicInteger success = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();

        runConcurrently(16, () -> {
            try {
                reset("111111", "matkhaumoi");
                success.incrementAndGet();
            } catch (CommonException e) {
                rejected.incrementAndGet();
            }
        });

        assertEquals(1, success.get());
        assertEquals(15, rejected.get());
    }

    @Test
    void cacheOtp_ghiDongThoiVoiJobDonMa_khongLoi() throws Exception {
        SchedulingJob job = new SchedulingJob();
        AtomicInteger seq = new AtomicInteger(100000);
        when(calcService.getRandomActiveCode(6L)).thenAnswer(inv -> String.valueOf(seq.incrementAndGet()));
        for (int i = 0; i < 500; i++) {
            GlobalCache.OTP_SCHEDULE_OBJS.add(OtpScheduleObj.builder().email("e" + i + "@x.com").otp("1")
                    .type(OtpType.RESET_PASSWORD).createdAt(Instant.now().minusSeconds(i % 2 == 0 ? 0 : 1000)).build());
        }

        // HashSet cũ có thể ném ConcurrentModificationException khi job removeIf chạy song song với add/removeIf
        runConcurrently(16, () -> {
            for (int i = 0; i < 50; i++) {
                if (i % 2 == 0) job.cleanOutOfDateOtp();
                else forgot();
            }
        });

        assertEquals(1, resetOtpsInCache().size());
        assertTrue(GlobalCache.OTP_SCHEDULE_OBJS.stream()
                .noneMatch(o -> o.getCreatedAt().isBefore(Instant.now().minusSeconds(900))));
    }

    private static void runConcurrently(int threads, ThrowingRunnable task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<?>> futures = new java.util.ArrayList<>();
            for (int i = 0; i < threads; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    task.run();
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> f : futures) {
                f.get(30, TimeUnit.SECONDS); // ném lại exception (nếu có) của từng luồng
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
