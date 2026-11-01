package com.dev.backend.config;

import com.dev.backend.constant.variables.ConstantVariables;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.AccountDisabledException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.exception.customize.SessionRevokedException;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.utils.JwtServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Tài khoản còn mật khẩu tạm (must_change_password): backend chỉ cho Xem thông tin của tôi, Đổi mật khẩu, Đăng xuất,
 * danh sách kho của tôi; mọi API khác 403 PASSWORD_CHANGE_REQUIRED (trước đây chỉ giao diện chặn).
 */
class AuthInterceptorPhaiDoiMatKhauTest {

    private static final String TEST_SIGNER_KEY = "test-signer-key-0123456789-0123456789-0123456789-abcdef";
    private String originalKey;

    private final NguoiDungRepository repository = mock(NguoiDungRepository.class);
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
                .matKhauHash("$2a$04$bam.mat.khau.tam").trangThai(1).vaiTro("quan_tri_vien")
                .mustChangePassword(true).build();
        when(repository.findById(7)).thenReturn(Optional.of(user));
    }

    @AfterEach
    void tearDown() {
        ConstantVariables.SIGNER_KEY = originalKey;
        SecurityContextHolder.clear();
    }

    private String token() {
        return jwtService.generateTokenWithPermissions(7, "khang", "Khang", "khang@example.com", null,
                Set.of("quan_tri_vien"), 1, null, null, List.of(), "Google",
                jwtService.credentialVersion(user.getMatKhauHash()), null);
    }

    private boolean goi(String method, String uri) {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        req.addHeader("Authorization", "Bearer " + token());
        return interceptor.preHandle(req, new MockHttpServletResponse(), new Object());
    }

    @Test
    void conMatKhauTam_apiThuong_bi403CoMa_vaXoaNguCanh() {
        LoiCoMaException ex = assertThrows(LoiCoMaException.class, () -> goi("POST", "/api/v1/san-pham/filter"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals(MaLoi.PASSWORD_CHANGE_REQUIRED, ex.getMa());
        assertEquals(AuthInterceptor.LOI_PHAI_DOI_MAT_KHAU, ex.getMessage());
        assertFalse(ex.getMessage().contains("khóa"), "apiClient coi chữ \"khóa\" là tài khoản bị khóa");
        assertNull(SecurityContextHolder.getUser(), "bị chặn thì không để lại người dùng trong ngữ cảnh");

        assertThrows(LoiCoMaException.class, () -> goi("GET", "/api/v1/admin/users"));
        assertThrows(LoiCoMaException.class, () -> goi("PUT", "/api/v1/nguoi-dung/me"), "sửa hồ sơ cũng bị chặn");
        assertThrows(LoiCoMaException.class, () -> goi("POST", "/api/v1/nguoi-dung/me"), "đúng đường dẫn, sai phương thức");
    }

    @Test
    void conMatKhauTam_bonApiDeDoiMatKhau_choQua() {
        assertTrue(goi("GET", "/api/v1/nguoi-dung/me"));
        assertEquals(7, SecurityContextHolder.getUser().getId());
        assertTrue(goi("POST", "/api/v1/nguoi-dung/change-password"));
        assertTrue(goi("POST", "/api/v1/nguoi-dung/logout"));
        assertTrue(goi("POST", "/api/v1/kho/mine"));
        assertTrue(goi("GET", "/api/v1/nguoi-dung/me/"), "dấu / cuối vẫn là cùng API");
    }

    @Test
    void daDoiMatKhau_moiApiNhuCu() {
        user.setMustChangePassword(false);
        assertTrue(goi("POST", "/api/v1/san-pham/filter"));
        user.setMustChangePassword(null);
        assertTrue(goi("GET", "/api/v1/admin/users"), "cột null (dữ liệu cũ) coi như không phải đổi");
    }

    @Test
    void khongGuiToken_khongXetCo() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/nguoi-dung/lien-ket-mat-khau/dat");
        assertTrue(interceptor.preHandle(req, new MockHttpServletResponse(), new Object()));
        verifyNoInteractions(repository);
    }

    @Test
    void taiKhoanBiKhoaHoacTokenCu_baoTruocKhiXetCo() {
        user.setTrangThai(0);
        assertThrows(AccountDisabledException.class, () -> goi("POST", "/api/v1/san-pham/filter"));

        user.setTrangThai(1);
        String tokenCu = token();
        user.setMatKhauHash("$2a$04$mat.khau.da.doi");
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/san-pham/filter");
        req.addHeader("Authorization", "Bearer " + tokenCu);
        assertThrows(SessionRevokedException.class,
                () -> interceptor.preHandle(req, new MockHttpServletResponse(), new Object()),
                "mật khẩu đã bị cấp lại: 401 đăng nhập lại, không phải 403 đổi mật khẩu");
    }

    @Test
    void duocGoiKhiPhaiDoiMatKhau_soKhopChinhXac() {
        assertTrue(AuthInterceptor.duocGoiKhiPhaiDoiMatKhau("GET", "/api/v1/nguoi-dung/me"));
        assertFalse(AuthInterceptor.duocGoiKhiPhaiDoiMatKhau("GET", "/api/v1/nguoi-dung/me/quyen"));
        assertFalse(AuthInterceptor.duocGoiKhiPhaiDoiMatKhau("GET", "/api/v1/nguoi-dung/meX"));
        assertFalse(AuthInterceptor.duocGoiKhiPhaiDoiMatKhau("GET", null));
        assertFalse(AuthInterceptor.duocGoiKhiPhaiDoiMatKhau(null, "/"));
    }
}
