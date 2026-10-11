package com.dev.backend.config;

import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.AccountDisabledException;
import com.dev.backend.exception.customize.SessionRevokedException;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Autowired
    private JwtService jwtService;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull Object handler) {
        String authHeader = request.getHeader("Authorization");
        String khoId = request.getHeader("kho_id");
        SecurityContextHolder.setPath(request.getRequestURI());
        if (authHeader != null) {
            String token = jwtService.getTokenFromAuthHeader(authHeader);
            NguoiDungAuthInfo nguoiDungAuthInfo = jwtService.getNguoiDungAuthInfoFromToken(token);
            SecurityContextHolder.setUser(nguoiDungAuthInfo);

            // Kiểm tra trangThai hiện tại từ DB — KHÔNG tin claim trong token (có thể đã cũ)
            if (nguoiDungAuthInfo != null && nguoiDungAuthInfo.getId() != null) {
                NguoiDung nguoiDung = nguoiDungRepository.findById(nguoiDungAuthInfo.getId()).orElse(null);
                Integer trangThai = nguoiDung == null ? null : nguoiDung.getTrangThai();
                if (trangThai == null || trangThai != 1) {
                    SecurityContextHolder.clear(); // preHandle throw → afterCompletion không chạy, phải tự clear
                    throw new AccountDisabledException();
                }
                // Token phát hành trước lần đổi/đặt lại mật khẩu gần nhất -> thu hồi (đăng xuất mọi phiên cũ).
                // Token cũ chưa có claim "cv" (phát hành trước bản này) vẫn dùng tới khi hết hạn 24h.
                String tokenCredential = nguoiDungAuthInfo.getCredentialVersion();
                if (tokenCredential != null
                        && !tokenCredential.equals(jwtService.credentialVersion(nguoiDung.getMatKhauHash()))) {
                    SecurityContextHolder.clear();
                    throw new SessionRevokedException();
                }
            }
        }
        if (khoId != null) {
            SecurityContextHolder.setKhoId(Integer.parseInt(khoId));
        }
        return true;
    }

    @Override
    public void afterCompletion(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull Object handler, Exception ex) {
        SecurityContextHolder.clear(); // Xóa sau khi xử lý xong
    }
}
