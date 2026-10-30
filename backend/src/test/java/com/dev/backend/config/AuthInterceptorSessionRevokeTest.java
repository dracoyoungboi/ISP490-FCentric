package com.dev.backend.config;

import com.dev.backend.constant.variables.ConstantVariables;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.AccountDisabledException;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.SessionRevokedException;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.services.impl.utils.JwtServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Thu hồi phiên sau khi đổi/đặt lại mật khẩu: token mang claim "cv" (dấu vân tay mật khẩu);
 * mật khẩu trong DB đổi -> token cũ bị từ chối 401 SESSION_REVOKED. Token cũ chưa có "cv" vẫn dùng được.
 */
class AuthInterceptorSessionRevokeTest {

    private static final String TEST_SIGNER_KEY = "test-signer-key-0123456789-0123456789-0123456789-abcdef";
    private String originalKey;

    private final NguoiDungRepository repository = mock(NguoiDungRepository.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private JwtServiceImpl jwtService;
    private AuthInterceptor interceptor;
    private NguoiDung user;

    @BeforeEach
    void setUp() {
        originalKey = ConstantVariables.SIGNER_KEY;
        ConstantVariables.SIGNER_KEY = TEST_SIGNER_KEY;
        jwtService = new JwtServiceImpl();
        ReflectionTestUtils.setField(jwtService, "objectMapper", new ObjectMapper().findAndRegisterModules());
        interceptor = new AuthInterceptor();
        ReflectionTestUtils.setField(interceptor, "jwtService", jwtService);
        ReflectionTestUtils.setField(interceptor, "nguoiDungRepository", repository);

        user = NguoiDung.builder().id(7).tenDangNhap("khang").email("khang@example.com")
                .matKhauHash(encoder.encode("matkhaucu")).trangThai(1).vaiTro("quan_tri_vien").build();
        when(repository.findById(7)).thenReturn(Optional.of(user));
    }

    @AfterEach
    void tearDown() {
        ConstantVariables.SIGNER_KEY = originalKey;
        SecurityContextHolder.clear();
    }

    private String tokenFor(String credentialVersion) {
        return jwtService.generateTokenWithPermissions(7, "khang", "Khang", "khang@example.com", null,
                Set.of("quan_tri_vien"), 1, null, null, List.of(), "Google", credentialVersion, null);
    }

    private boolean preHandle(String token) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/v1/nguoi-dung/me");
        req.addHeader("Authorization", "Bearer " + token);
        return interceptor.preHandle(req, new MockHttpServletResponse(), new Object());
    }

    // ===== JwtServiceImpl =====

    @Test
    void credentialVersion_onDinhVoiCungHash_khacKhiDoiMatKhau() {
        String hash = user.getMatKhauHash();
        assertEquals(jwtService.credentialVersion(hash), jwtService.credentialVersion(hash));
        // cùng mật khẩu nhưng encode lại (salt mới) cũng ra giá trị khác -> đặt lại trùng mật khẩu cũ vẫn thu hồi
        assertNotEquals(jwtService.credentialVersion(hash), jwtService.credentialVersion(encoder.encode("matkhaucu")));
        assertNull(jwtService.credentialVersion(null));
        assertFalse(jwtService.credentialVersion(hash).contains(hash), "không để lộ hash mật khẩu trong token");
    }

    @Test
    void token_coClaimCv_doc_lai_duoc() {
        String cv = jwtService.credentialVersion(user.getMatKhauHash());
        NguoiDungAuthInfo info = jwtService.getNguoiDungAuthInfoFromToken(tokenFor(cv));
        assertEquals(cv, info.getCredentialVersion());
        assertEquals(7, info.getId());
    }

    @Test
    void token_khongTruyenCv_khongCoClaim() {
        assertNull(jwtService.getNguoiDungAuthInfoFromToken(tokenFor(null)).getCredentialVersion());
        // overload cũ (test POS dùng) vẫn hoạt động và không có claim
        String legacy = jwtService.generateTokenWithPermissions(7, "khang", "Khang", "khang@example.com", null,
                Set.of("quan_tri_vien"), 1, null, null, List.of(), "Google");
        assertNull(jwtService.getNguoiDungAuthInfoFromToken(legacy).getCredentialVersion());
    }

    // ===== AuthInterceptor =====

    @Test
    void tokenHopLe_cvKhop_choQua() {
        assertTrue(preHandle(tokenFor(jwtService.credentialVersion(user.getMatKhauHash()))));
        assertEquals(7, SecurityContextHolder.getUser().getId());
    }

    @Test
    void doiMatKhau_tokenCu_biThuHoi401() {
        String oldToken = tokenFor(jwtService.credentialVersion(user.getMatKhauHash()));
        user.setMatKhauHash(encoder.encode("matkhaumoi")); // đặt lại mật khẩu ở nơi khác

        SessionRevokedException ex = assertThrows(SessionRevokedException.class, () -> preHandle(oldToken));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getHttpStatus());
        assertEquals(Map.of("code", "SESSION_REVOKED"), ex.getData());
        assertNull(SecurityContextHolder.getUser(), "phải xoá context trước khi ném lỗi");
        // token mới phát hành theo mật khẩu mới thì dùng được
        assertTrue(preHandle(tokenFor(jwtService.credentialVersion(user.getMatKhauHash()))));
    }

    @Test
    void tokenCuChuaCoCv_vanDungDuoc_tuongThichNguoc() {
        assertTrue(preHandle(tokenFor(null)));
    }

    @Test
    void taiKhoanBiKhoa_van403_uuTienTruocThuHoi() {
        String token = tokenFor(jwtService.credentialVersion(user.getMatKhauHash()));
        user.setTrangThai(0);
        CommonException ex = assertThrows(AccountDisabledException.class, () -> preHandle(token));
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void vaiTroKhongPhaiNhanSu_phienDangMoCungBi403() {
        // Tài khoản cũ mang vai trò khach_hang (đã bỏ khỏi hệ thống), token còn hạn và khớp CSDL:
        // vẫn bị chặn ngay ở request kế tiếp, không chờ hết hạn token
        user.setVaiTro("khach_hang");
        ReflectionTestUtils.setField(interceptor, "phanQuyenNguoiDungKhoRepository",
                mock(PhanQuyenNguoiDungKhoRepository.class));
        String token = jwtService.generateTokenWithPermissions(7, "khang", "Khang", "khang@example.com", null,
                Set.of("khach_hang"), 1, null, null, List.of(), "Google",
                jwtService.credentialVersion(user.getMatKhauHash()), null);

        CommonException ex = assertThrows(AccountDisabledException.class, () -> preHandle(token));

        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
        assertNull(SecurityContextHolder.getUser(), "phải xoá context trước khi ném lỗi");
    }

    @Test
    void khongCoHeaderAuthorization_khongDungDB() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/nguoi-dung/login");
        assertTrue(interceptor.preHandle(req, new MockHttpServletResponse(), new Object()));
        verifyNoInteractions(repository);
    }
}
