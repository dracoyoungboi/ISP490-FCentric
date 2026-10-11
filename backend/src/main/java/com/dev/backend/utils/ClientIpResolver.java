package com.dev.backend.utils;

import jakarta.servlet.http.HttpServletRequest;

import java.net.InetAddress;
import java.util.regex.Pattern;

/**
 * Lấy IP thật của client phía sau reverse proxy (Nginx Proxy Manager -> nginx frontend -> backend).
 * Chỉ tin X-Forwarded-For khi request đến từ proxy nội bộ (loopback / mạng riêng), rồi lấy địa chỉ
 * public ngoài cùng bên PHẢI — phần do proxy của mình thêm vào; phần bên trái client tự gửi được nên
 * không tin. Request đi thẳng từ Internet thì dùng remoteAddr, bỏ qua header (tránh giả mạo IP).
 */
public final class ClientIpResolver {

    private static final Pattern IPV4 = Pattern.compile("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$");
    private static final Pattern IPV6 = Pattern.compile("^[0-9A-Fa-f:.]+(%[0-9A-Za-z]+)?$");

    private ClientIpResolver() {
    }

    public static String resolve(HttpServletRequest request) {
        String remote = request.getRemoteAddr();
        if (!isInternal(remote)) {
            return remote;
        }
        String xff = request.getHeader("X-Forwarded-For");
        if (xff == null || xff.isBlank()) {
            return remote;
        }
        String[] parts = xff.split(",");
        String leftmostValid = null;
        for (int i = parts.length - 1; i >= 0; i--) {
            String ip = parts[i].trim();
            if (!isIpLiteral(ip)) continue;
            if (!isInternal(ip)) return ip;
            leftmostValid = ip;
        }
        // toàn bộ chuỗi là địa chỉ nội bộ (vd. truy cập trong LAN) -> lấy địa chỉ gốc
        return leftmostValid != null ? leftmostValid : remote;
    }

    /** Địa chỉ loopback / mạng riêng / link-local (proxy nội bộ). Chuỗi không phải IP -> false. */
    static boolean isInternal(String ip) {
        InetAddress addr = parseLiteral(ip);
        if (addr == null) return false;
        if (addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isLinkLocalAddress()
                || addr.isAnyLocalAddress()) {
            return true;
        }
        byte[] b = addr.getAddress();
        return b.length == 16 && (b[0] & 0xFE) == 0xFC; // IPv6 unique-local fc00::/7
    }

    static boolean isIpLiteral(String ip) {
        return parseLiteral(ip) != null;
    }

    // Chỉ parse chuỗi IP dạng số — KHÔNG để InetAddress tra DNS với giá trị lấy từ header
    private static InetAddress parseLiteral(String ip) {
        if (ip == null || ip.isBlank()) return null;
        String s = ip.trim();
        try {
            var m = IPV4.matcher(s);
            if (m.matches()) {
                for (int g = 1; g <= 4; g++) {
                    if (Integer.parseInt(m.group(g)) > 255) return null;
                }
                return InetAddress.getByName(s);
            }
            // IPv6 literal: chỉ ký tự hex/':'/'.' (+ zone id sau '%') -> InetAddress coi là literal, không tra DNS
            if (s.indexOf(':') >= 0 && IPV6.matcher(s).matches()) {
                return InetAddress.getByName(s);
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }
}
