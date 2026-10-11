package com.dev.backend.utils;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

/** Lấy IP thật phía sau reverse proxy, không tin header khi request đi thẳng từ Internet. */
class ClientIpResolverTest {

    private static String resolve(String remoteAddr, String xff) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr(remoteAddr);
        if (xff != null) req.addHeader("X-Forwarded-For", xff);
        return ClientIpResolver.resolve(req);
    }

    @Test
    void khongQuaProxy_dungRemoteAddr() {
        assertEquals("127.0.0.1", resolve("127.0.0.1", null));
        assertEquals("0:0:0:0:0:0:0:1", resolve("0:0:0:0:0:0:0:1", null));
    }

    @Test
    void requestTuInternet_boQuaXForwardedFor_chongGiaMao() {
        assertEquals("203.0.113.9", resolve("203.0.113.9", "1.2.3.4"));
    }

    @Test
    void quaProxyNoiBo_layIpPublicNgoaiCungBenPhai() {
        // NPM ghi IP client, nginx frontend nối thêm IP của NPM (mạng docker)
        assertEquals("198.51.100.7", resolve("172.18.0.3", "198.51.100.7, 172.18.0.2"));
    }

    @Test
    void clientTuGuiXForwardedFor_khongDoiDuocIp() {
        // client gửi sẵn "1.2.3.4" -> proxy nối IP thật vào bên phải -> lấy IP thật
        assertEquals("198.51.100.7", resolve("172.18.0.3", "1.2.3.4, 198.51.100.7, 172.18.0.2"));
    }

    @Test
    void toanDiaChiNoiBo_layDiaChiGoc() {
        assertEquals("192.168.1.20", resolve("172.18.0.3", "192.168.1.20, 172.18.0.2"));
    }

    @Test
    void giaTriKhongPhaiIp_biBoQua_vaKhongTraDns() {
        assertEquals("198.51.100.7", resolve("10.0.0.5", "198.51.100.7, unknown, evil.example.com"));
        assertEquals("10.0.0.5", resolve("10.0.0.5", "unknown, , not-an-ip"));
        assertFalse(ClientIpResolver.isIpLiteral("localhost"));
        assertFalse(ClientIpResolver.isIpLiteral("evil.example.com"));
        assertFalse(ClientIpResolver.isIpLiteral("999.1.1.1"));
        assertFalse(ClientIpResolver.isIpLiteral("zz::1"));
    }

    @Test
    void phanLoaiDiaChiNoiBo() {
        assertTrue(ClientIpResolver.isInternal("10.1.2.3"));
        assertTrue(ClientIpResolver.isInternal("172.16.0.1"));
        assertTrue(ClientIpResolver.isInternal("192.168.0.1"));
        assertTrue(ClientIpResolver.isInternal("127.0.0.1"));
        assertTrue(ClientIpResolver.isInternal("::1"));
        assertTrue(ClientIpResolver.isInternal("fd00::1"));
        assertFalse(ClientIpResolver.isInternal("172.32.0.1"));
        assertFalse(ClientIpResolver.isInternal("8.8.8.8"));
        assertFalse(ClientIpResolver.isInternal("2001:db8::1"));
    }

    @Test
    void ipv6PublicQuaProxy() {
        assertEquals("2001:db8::1", resolve("172.18.0.3", "2001:db8::1, 172.18.0.2"));
    }
}
