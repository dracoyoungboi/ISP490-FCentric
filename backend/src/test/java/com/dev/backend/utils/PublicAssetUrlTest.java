package com.dev.backend.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Test chuẩn hoá URL công khai: chỉ đổi đúng origin legacy MinIO, giữ nguyên
 * object path + query string, không đụng các URL khác.
 */
class PublicAssetUrlTest {

    private static final String LEGACY = "http://171.244.142.43:9000";
    private static final String HTTPS = "https://minio.slmglobal.vn";

    @Test
    void urlLegacy_doiSangHttps_giuNguyenObjectPath() {
        assertEquals(HTTPS + "/fashion/brands/logo-nike.png",
                PublicAssetUrl.toHttps(LEGACY + "/fashion/brands/logo-nike.png"));
    }

    @Test
    void urlLegacy_giuNguyenQueryString() {
        assertEquals(HTTPS + "/fashion/a.png?v=1&x=2",
                PublicAssetUrl.toHttps(LEGACY + "/fashion/a.png?v=1&x=2"));
    }

    @Test
    void urlLegacy_khongPath() {
        assertEquals(HTTPS, PublicAssetUrl.toHttps(LEGACY));
    }

    @Test
    void urlLegacy_chiCoQueryString() {
        assertEquals(HTTPS + "?v=1", PublicAssetUrl.toHttps(LEGACY + "?v=1"));
    }

    @Test
    void nullVao_traNull() {
        assertNull(PublicAssetUrl.toHttps(null));
    }

    @Test
    void chuoiRong_giuNguyen() {
        assertEquals("", PublicAssetUrl.toHttps(""));
    }

    @Test
    void urlHttpsSan_giuNguyen() {
        assertEquals(HTTPS + "/fashion/a.png",
                PublicAssetUrl.toHttps(HTTPS + "/fashion/a.png"));
        assertEquals("https://other.example.com/x.png",
                PublicAssetUrl.toHttps("https://other.example.com/x.png"));
    }

    @Test
    void assetTuongDoi_giuNguyen() {
        assertEquals("/branding/f-centric-icon.svg",
                PublicAssetUrl.toHttps("/branding/f-centric-icon.svg"));
        assertEquals("assets/logo.png", PublicAssetUrl.toHttps("assets/logo.png"));
    }

    @Test
    void localhost_giuNguyen() {
        assertEquals("http://localhost:9000/fashion/a.png",
                PublicAssetUrl.toHttps("http://localhost:9000/fashion/a.png"));
        assertEquals("http://127.0.0.1:9000/fashion/a.png",
                PublicAssetUrl.toHttps("http://127.0.0.1:9000/fashion/a.png"));
    }

    @Test
    void urlKhongLienQuan_giuNguyen() {
        assertEquals("http://example.com/fashion/a.png",
                PublicAssetUrl.toHttps("http://example.com/fashion/a.png"));
        assertEquals("https://cdn.example.com/x.jpg",
                PublicAssetUrl.toHttps("https://cdn.example.com/x.jpg"));
    }

    @Test
    void originNhinGiong_butKhacRanhGioi_khongBiDoi() {
        // port 90000 (thừa một số 0), port 9000x, subdomain đuôi dài, host khác cùng port
        assertEquals("http://171.244.142.43:90000/fashion/a.png",
                PublicAssetUrl.toHttps("http://171.244.142.43:90000/fashion/a.png"));
        assertEquals("http://171.244.142.43:9000abc/fashion/a.png",
                PublicAssetUrl.toHttps("http://171.244.142.43:9000abc/fashion/a.png"));
        assertEquals("http://171.244.142.43:9000.evil.com/fashion/a.png",
                PublicAssetUrl.toHttps("http://171.244.142.43:9000.evil.com/fashion/a.png"));
        assertEquals("http://171.244.142.431:9000/fashion/a.png",
                PublicAssetUrl.toHttps("http://171.244.142.431:9000/fashion/a.png"));
        assertEquals("http://x171.244.142.43:9000/fashion/a.png",
                PublicAssetUrl.toHttps("http://x171.244.142.43:9000/fashion/a.png"));
    }

    @Test
    void urlLegacy_giuNguyenObjectPathDayDu() {
        assertEquals(HTTPS + "/fashion/brands/2026/10/logo-abc_123.png",
                PublicAssetUrl.toHttps(LEGACY + "/fashion/brands/2026/10/logo-abc_123.png"));
    }
}
