package com.dev.backend.config;

import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.services.impl.multitable.BangChungDongGoiServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.security.SecurityProperties;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Chặn sớm yêu cầu tải bằng chứng đóng gói (POST /api/v1/dong-goi/don/{id}/bang-chung) quá lớn: so Content-Length với
 * giới hạn video (BangChungDongGoiServiceImpl.MAX_VIDEO_SIZE, cộng phần dư cho ranh giới và các trường multipart) TRƯỚC
 * khi Spring đọc multipart — không phải nhận hết hàng trăm MB vào ổ tạm rồi mới báo lỗi ở service (giới hạn multipart
 * chung của ứng dụng là 500 MB). Không biết độ dài (gửi chunked) thì để tầng sau kiểm như cũ.
 * Chạy ngay sau chuỗi lọc của Spring Security (đã gắn header CORS, chưa đọc tham số nên chưa đọc multipart).
 */
@Component
@Order(SecurityProperties.DEFAULT_FILTER_ORDER + 1)
public class GioiHanTaiBangChungFilter extends OncePerRequestFilter {

    /** Phần dư cho ranh giới multipart, tiêu đề từng phần, loaiBangChung, thoiLuongGiay. */
    static final long PHAN_DU_MULTIPART = 1024L * 1024;
    static final long GIOI_HAN_YEU_CAU = BangChungDongGoiServiceImpl.MAX_VIDEO_SIZE + PHAN_DU_MULTIPART;
    static final String THONG_BAO = "Dung lượng tệp tải lên vượt quá 100MB cho phép!";

    private static final Pattern DUONG_DAN_TAI_BANG_CHUNG = Pattern.compile("^/api/v1/dong-goi/don/[^/]+/bang-chung/?$");

    private final ObjectMapper objectMapper;

    public GioiHanTaiBangChungFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return true;
        // Đường dẫn đã giải mã và chuẩn hóa (servletPath + pathInfo), như Spring MVC dùng để chọn controller —
        // không dùng getRequestURI() thô: "/bang%2Dchung" vẫn vào DongGoiController mà regex trên chuỗi thô không khớp
        String pathInfo = request.getPathInfo();
        String duongDan = request.getServletPath() + (pathInfo != null ? pathInfo : "");
        return !DUONG_DAN_TAI_BANG_CHUNG.matcher(duongDan).matches();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > GIOI_HAN_YEU_CAU) {
            ResponseData<Void> body = ResponseData.<Void>builder()
                    .status(HttpStatus.PAYLOAD_TOO_LARGE.value())
                    .error(HttpStatus.PAYLOAD_TOO_LARGE.getReasonPhrase())
                    .message(THONG_BAO)
                    .path(request.getRequestURI())
                    .build();
            response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getOutputStream(), body);
            return;
        }
        chain.doFilter(request, response);
    }
}
