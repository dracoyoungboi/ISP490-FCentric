package com.dev.backend.services.impl.utils;

import com.dev.backend.dto.response.CassoResponse;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.CassoService;
import com.google.gson.Gson;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@Slf4j
@Service
public class CassoServiceImpl implements CassoService {

    private final HttpClient httpClient = HttpClient.newHttpClient();
    // Dùng Gson chính thức (dependency com.google.code.gson trong pom) thay cho bản shaded nội bộ của nimbus-jose-jwt
    private final Gson gson = new Gson();

    private static final String BASE_URL = "https://oauth.casso.vn/v2/transactions";

    // API key đọc từ cấu hình (casso.api-key trong application.properties, ghi đè bằng biến môi trường CASSO_API_KEY)
    // thay vì hard-code trong mã nguồn.
    private final String apiKey;

    public CassoServiceImpl(@Value("${casso.api-key:}") String apiKey) {
        this.apiKey = apiKey;
    }

    @Override
    public CassoResponse getListTransactionCasso(String fromDate, int page, int pageSize, String sort) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new CommonException("Chưa cấu hình API key Casso (casso.api-key / biến môi trường CASSO_API_KEY)");
        }
        if(sort == null) sort = "ASC";

        String url = String.format("%s?fromDate=%s&page=%d&pageSize=%d&sort=%s",
                BASE_URL, fromDate, page, pageSize, sort);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Apikey " + apiKey)
                .header("Content-Type", "application/json")
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            // Không in toàn bộ lịch sử giao dịch ngân hàng ra console; chỉ ghi ở mức debug khi cần soi lỗi
            log.debug("Casso response status={}, body={}", response.statusCode(), response.body());
            //Kiểm tra status code có thành công hay không
            if(!(response.statusCode()+"").startsWith("2")) {
                throw new CommonException("Lỗi trong khi check lịch sử giao dịch");
            }

            return gson.fromJson(response.body(), CassoResponse.class);
        } catch (Exception e) {
            log.error("Error fetching data from Casso API: {}", e.getMessage());
            throw new CommonException("Lỗi trong khi check lịch sử giao dịch: "+e.getMessage());
        }
    }
}
