package com.dev.backend.config;

import com.dev.backend.constant.variables.ConstantVariables;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.utils.JwtServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Ngữ cảnh người dùng nằm trong ThreadLocal, luồng Tomcat được dùng lại cho request sau. Request trước ném lỗi giữa
 * preHandle (vd. CSDL lỗi sau khi đã setUser) thì afterCompletion không chạy: request kế tiếp không gửi token trên cùng
 * luồng không được mang danh tính của người trước.
 */
class AuthInterceptorNguCanhTest {

    private static final String TEST_SIGNER_KEY = "test-signer-key-0123456789-0123456789-0123456789-abcdef";
    private String originalKey;

    private final NguoiDungRepository repository = mock(NguoiDungRepository.class);
    private JwtServiceImpl jwtService;
    private AuthInterceptor interceptor;

    @BeforeEach
    void setUp() {
        originalKey = ConstantVariables.SIGNER_KEY;
        ConstantVariables.SIGNER_KEY = TEST_SIGNER_KEY;
        jwtService = new JwtServiceImpl();
        ReflectionTestUtils.setField(jwtService, "objectMapper", new ObjectMapper().findAndRegisterModules());
        interceptor = new AuthInterceptor();
        ReflectionTestUtils.setField(interceptor, "jwtService", jwtService);
        ReflectionTestUtils.setField(interceptor, "nguoiDungRepository", repository);
    }

    @AfterEach
    void tearDown() {
        ConstantVariables.SIGNER_KEY = originalKey;
        SecurityContextHolder.clear();
    }

    private String tokenQuanTri() {
        return jwtService.generateTokenWithPermissions(7, "khang", "Khang", "khang@example.com", null,
                Set.of("quan_tri_vien"), 1, null, null, List.of(), "Google", null);
    }

    @Test
    void loiCsdlSauKhiSetUser_xoaNguCanh_requestSauKhongThuaHuongDanhTinh() {
        when(repository.findById(7)).thenThrow(new IllegalStateException("mất kết nối CSDL"));
        MockHttpServletRequest coToken = new MockHttpServletRequest("GET", "/api/v1/kho/all");
        coToken.addHeader("Authorization", "Bearer " + tokenQuanTri());
        coToken.addHeader("kho_id", "3");

        assertThrows(IllegalStateException.class,
                () -> interceptor.preHandle(coToken, new MockHttpServletResponse(), new Object()));
        assertNull(SecurityContextHolder.getUser(), "lỗi giữa preHandle phải xóa người dùng đã đặt");

        // Request kế tiếp trên cùng luồng, không gửi token
        assertTrue(interceptor.preHandle(new MockHttpServletRequest("GET", "/api/v1/san-pham-quan-ao/get-by-id/1"),
                new MockHttpServletResponse(), new Object()));
        assertNull(SecurityContextHolder.getUser());
        assertNull(SecurityContextHolder.getKhoId());
    }

    @Test
    void nguCanhConSotTuNoiKhac_preHandleXoaTruoc() {
        // Mô phỏng ngữ cảnh rò từ một luồng xử lý không qua afterCompletion
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(99).vaiTro(Set.of("quan_tri_vien")).build());
        SecurityContextHolder.setKhoId(5);

        assertTrue(interceptor.preHandle(new MockHttpServletRequest("GET", "/api/v1/kho/all"),
                new MockHttpServletResponse(), new Object()));
        assertNull(SecurityContextHolder.getUser());
        assertNull(SecurityContextHolder.getKhoId());
        assertEquals("/api/v1/kho/all", SecurityContextHolder.getPath());
    }
}
