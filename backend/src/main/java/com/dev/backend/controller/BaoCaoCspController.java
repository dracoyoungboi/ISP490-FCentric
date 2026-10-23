package com.dev.backend.controller;

import com.dev.backend.dto.response.ResponseData;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Nhận báo cáo vi phạm CSP từ trình duyệt. nginx gửi CSP ở chế độ Report-Only: theo dõi một thời gian xem giao diện còn
 * tải gì ngoài danh sách cho phép, rồi mới chuyển sang chặn thật.
 * <p>
 * Công khai (trình duyệt gửi không kèm token) nên chỉ đọc tối đa {@link #TOI_DA_BYTE} byte, chỉ ghi log vài trường đã
 * cắt ngắn và bỏ phần query (link đặt lại mật khẩu mang mã trong query), tối đa {@link #TOI_DA_LOG_MOI_PHUT} dòng mỗi
 * phút. Báo cáo hỏng thì bỏ qua, luôn trả 200.
 */
@RestController
@RequestMapping("/api/v1/bao-cao-csp")
@Slf4j
public class BaoCaoCspController {

    static final int TOI_DA_BYTE = 8 * 1024;
    static final int TOI_DA_LOG_MOI_PHUT = 30;
    private static final int TOI_DA_KY_TU = 200;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicLong phutDangDem = new AtomicLong();
    private final AtomicInteger soDongTrongPhut = new AtomicInteger();

    @PostMapping
    public ResponseEntity<ResponseData<Void>> nhanBaoCao(HttpServletRequest request) {
        try (InputStream in = request.getInputStream()) {
            byte[] noiDung = in.readNBytes(TOI_DA_BYTE);
            String dong = tomTat(objectMapper.readTree(noiDung));
            if (dong != null && duocGhiLog(System.currentTimeMillis())) {
                log.warn("CSP (theo dõi): {}", dong);
            }
        } catch (IOException | RuntimeException e) {
            // Báo cáo hỏng / bị cắt: bỏ qua
        }
        return ResponseEntity.ok(ResponseData.<Void>builder()
                .status(HttpStatus.OK.value())
                .message("OK")
                .build());
    }

    /**
     * Một dòng tóm tắt từ báo cáo dạng report-uri ({"csp-report": {...}}) hoặc Reporting API ([{"body": {...}}]);
     * null nếu không phải báo cáo CSP.
     */
    static String tomTat(JsonNode goc) {
        if (goc == null) return null;
        JsonNode bc = goc.path("csp-report");
        if (bc.isObject()) {
            return dong(bc.path("effective-directive").asText(bc.path("violated-directive").asText(null)),
                    bc.path("blocked-uri").asText(null), bc.path("document-uri").asText(null),
                    bc.path("source-file").asText(null), bc.path("line-number").asText(null));
        }
        JsonNode body = goc.isArray() ? goc.path(0).path("body") : goc.path("body");
        if (body.isObject()) {
            return dong(body.path("effectiveDirective").asText(null), body.path("blockedURL").asText(null),
                    body.path("documentURL").asText(null), body.path("sourceFile").asText(null),
                    body.path("lineNumber").asText(null));
        }
        return null;
    }

    private static String dong(String chiThi, String biChan, String trang, String nguon, String dongSo) {
        if (chiThi == null && biChan == null) return null;
        return gon(chiThi) + " chặn " + gon(biChan) + " trên " + gon(trang)
                + (nguon == null ? "" : " (nguồn " + gon(nguon) + (dongSo == null ? "" : ":" + gon(dongSo)) + ")");
    }

    /** Bỏ query / fragment (có thể mang mã đặt lại mật khẩu), ký tự điều khiển (chèn dòng log giả), cắt ngắn. */
    static String gon(String giaTri) {
        if (giaTri == null || giaTri.isBlank()) return "-";
        String s = giaTri;
        int q = s.indexOf('?');
        if (q >= 0) s = s.substring(0, q);
        int h = s.indexOf('#');
        if (h >= 0) s = s.substring(0, h);
        // Cc: điều khiển ASCII + C1 (U+0085); Cf: định dạng (U+202E đảo chiều); Zl/Zp: U+2028/U+2029 xuống dòng
        s = s.replaceAll("[\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}]", " ").trim();
        return s.length() > TOI_DA_KY_TU ? s.substring(0, TOI_DA_KY_TU) + "…" : s;
    }

    /** Đếm theo từng phút đồng hồ: quá {@link #TOI_DA_LOG_MOI_PHUT} dòng thì bỏ (chống làm đầy log). */
    boolean duocGhiLog(long bayGioMs) {
        long phut = bayGioMs / 60_000;
        long cu = phutDangDem.get();
        if (cu != phut && phutDangDem.compareAndSet(cu, phut)) {
            soDongTrongPhut.set(0);
        }
        return soDongTrongPhut.incrementAndGet() <= TOI_DA_LOG_MOI_PHUT;
    }
}
