package com.dev.backend.config;


import com.dev.backend.constant.variables.ConstantVariables;
import com.dev.backend.dto.response.ResponseData;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JWSAlgorithm;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.access.BearerTokenAccessDeniedHandler;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig implements WebMvcConfigurer {

    private static final String TOKEN_INVALID_MESSAGE =
            "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.";
    private static final String ACCESS_DENIED_MESSAGE = "Bạn không có quyền truy cập tài nguyên này.";

    @Autowired
    private AuthInterceptor authInterceptor;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor);
    }

    //Security Config==================================================================================================>
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                        .requestMatchers("/**").permitAll()
//                        .requestMatchers("/private/**").hasAnyAuthority("SCOPE_ROLE_ADMIN", "SCOPE_ROLE_CUSTOMER")
                        .anyRequest().authenticated())
                // Cú pháp lambda thay cho csrf().disable() (deprecated, sẽ bị xoá ở Spring Security 7). Hành vi giữ nguyên.
                .csrf(AbstractHttpConfigurer::disable)
                // CORS ở tầng filter (bean corsConfigurationSource): phản hồi lỗi của chính Spring Security
                // (401 token hết hạn/sai) cũng có Access-Control-Allow-Origin, FE đọc được thay vì Network Error
                .cors(Customizer.withDefaults());
        http.oauth2ResourceServer(oauth2 -> {
            oauth2.jwt(jwtConfigurer -> {
                jwtConfigurer.decoder(jwtDecoder());
            });
            oauth2.authenticationEntryPoint(tokenInvalidEntryPoint());
            oauth2.accessDeniedHandler(jsonAccessDeniedHandler());
        });
        return http.build();
    }

    // Token hết hạn/sai bị chặn ở BearerTokenAuthenticationFilter (trước DispatcherServlet, nên không qua
    // RestControllerGlobalExceptionHandler). Giữ status + WWW-Authenticate của entry point mặc định, thêm body JSON.
    private AuthenticationEntryPoint tokenInvalidEntryPoint() {
        BearerTokenAuthenticationEntryPoint delegate = new BearerTokenAuthenticationEntryPoint();
        return (request, response, authException) -> {
            delegate.commence(request, response, authException);
            writeJson(request, response, response.getStatus(), "TOKEN_INVALID", TOKEN_INVALID_MESSAGE);
        };
    }

    private AccessDeniedHandler jsonAccessDeniedHandler() {
        BearerTokenAccessDeniedHandler delegate = new BearerTokenAccessDeniedHandler();
        return (request, response, accessDeniedException) -> {
            delegate.handle(request, response, accessDeniedException);
            writeJson(request, response, HttpStatus.FORBIDDEN.value(), "Forbidden", ACCESS_DENIED_MESSAGE);
        };
    }

    // Cùng cấu trúc ResponseData với RestControllerGlobalExceptionHandler. path lấy từ request vì ở tầng filter
    // AuthInterceptor chưa chạy, ThreadLocal path (mặc định của ResponseData) chưa được set.
    private void writeJson(HttpServletRequest request, HttpServletResponse response,
                           int status, String error, String message) throws IOException {
        ResponseData<Void> body = ResponseData.<Void>builder()
                .status(status)
                .error(error)
                .message(message)
                .path(request.getRequestURI())
                .build();
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), body);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        SecretKeySpec secretKeySpec = new SecretKeySpec(ConstantVariables.SIGNER_KEY.getBytes(), JWSAlgorithm.HS256.toString());
        return NimbusJwtDecoder.withSecretKey(secretKeySpec)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*")); // Cho phép mọi origin
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*")); // Cho phép mọi header
        config.setAllowCredentials(false); // QUAN TRỌNG: phải false khi dùng "*"
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }


    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                // allow all origins, methods, and headers
                .allowedOrigins("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*");
    }
}
