package com.dev.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Nơi nhận báo cáo CSP (chế độ theo dõi): công khai nên không được thành chỗ ghi mã đặt lại mật khẩu vào log, chèn dòng
 * log giả, hay làm đầy log / bộ nhớ.
 */
class BaoCaoCspControllerTest {

    private final ObjectMapper om = new ObjectMapper();

    @Test
    void tomTat_dangReportUri_boQueryVaMa() throws Exception {
        String bc = "{\"csp-report\":{\"document-uri\":\"https://fcentric.net/reset-password?token=bi-mat-123#x\","
                + "\"violated-directive\":\"img-src 'self'\",\"effective-directive\":\"img-src\","
                + "\"blocked-uri\":\"https://cdn.shopify.com/a.png?v=1\",\"source-file\":\"https://fcentric.net/assets/index.js\","
                + "\"line-number\":12}}";
        String dong = BaoCaoCspController.tomTat(om.readTree(bc));
        assertEquals("img-src chặn https://cdn.shopify.com/a.png trên https://fcentric.net/reset-password"
                + " (nguồn https://fcentric.net/assets/index.js:12)", dong);
        assertFalse(dong.contains("bi-mat-123"));
    }

    @Test
    void tomTat_dangReportingApi() throws Exception {
        String bc = "[{\"type\":\"csp-violation\",\"body\":{\"documentURL\":\"https://fcentric.net/orders\","
                + "\"effectiveDirective\":\"script-src-elem\",\"blockedURL\":\"inline\"}}]";
        assertEquals("script-src-elem chặn inline trên https://fcentric.net/orders",
                BaoCaoCspController.tomTat(om.readTree(bc)));
    }

    @Test
    void tomTat_khongPhaiBaoCaoCsp_traNull() throws Exception {
        assertNull(BaoCaoCspController.tomTat(om.readTree("{\"a\":1}")));
        assertNull(BaoCaoCspController.tomTat(om.readTree("[]")));
        assertNull(BaoCaoCspController.tomTat(null));
    }

    @Test
    void gon_boKyTuXuongDongVaCatNgan() {
        assertEquals("a  GIẢ: admin đăng nhập", BaoCaoCspController.gon("a\r\nGIẢ: admin đăng nhập"));
        assertEquals("a b c d", BaoCaoCspController.gon("a\u0085b c‮d"), "xuống dòng / đảo chiều Unicode");
        String dai = BaoCaoCspController.gon("x".repeat(5000));
        assertEquals(201, dai.length());
        assertEquals("-", BaoCaoCspController.gon(null));
    }

    @Test
    void duocGhiLog_gioiHanMoiPhut_sangPhutMoiDemLai() {
        BaoCaoCspController c = new BaoCaoCspController();
        long phut1 = 10 * 60_000L;
        for (int i = 0; i < BaoCaoCspController.TOI_DA_LOG_MOI_PHUT; i++) {
            assertTrue(c.duocGhiLog(phut1 + i));
        }
        assertFalse(c.duocGhiLog(phut1 + 500));
        assertTrue(c.duocGhiLog(phut1 + 60_000), "phút mới đếm lại");
    }

    @Test
    void nhanBaoCao_noiDungHongHoacQuaLon_van200() {
        BaoCaoCspController c = new BaoCaoCspController();
        for (byte[] noiDung : new byte[][]{
                "khong phai json".getBytes(StandardCharsets.UTF_8),
                new byte[0],
                ("{\"csp-report\":{\"blocked-uri\":\"" + "y".repeat(100_000) + "\"}}").getBytes(StandardCharsets.UTF_8)}) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/bao-cao-csp");
            req.setContentType("application/csp-report");
            req.setContent(noiDung);
            assertEquals(200, c.nhanBaoCao(req).getStatusCode().value());
        }
    }
}
