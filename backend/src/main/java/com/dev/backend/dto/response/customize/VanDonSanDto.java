package com.dev.backend.dto.response.customize;

/**
 * DTO chứa dữ liệu nhị phân hoặc chuỗi văn bản của tem vận đơn sàn (AWB) kèm kiểu MIME.
 */
public record VanDonSanDto(
        byte[] duLieu,
        String mimeType,
        String tenTep
) {}
