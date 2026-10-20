package com.dev.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.Map;

/**
 * Một phiên bản trong "Lịch sử chỉnh sửa" của trình sửa mẫu in (một lần bấm Lưu).
 * cauHinh = ảnh chụp cấu hình sau khi lưu (templateId, name, paperSize, orientation, margin,
 * accentColor, branding, sections, columns); cauHinhTruoc = cấu hình đang dùng cho in thật ngay
 * trước lần lưu đó (null nếu trước đó loại chứng từ chưa lưu lần nào). Câu "đã đổi gì" do giao
 * diện so hai ảnh chụp theo schema của loại chứng từ.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LichSuMauInDto {
    Integer id;
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant luc;
    String nguoiThucHien;
    String vaiTro;
    String templateId;
    Map<String, Object> cauHinh;
    Map<String, Object> cauHinhTruoc;
}
