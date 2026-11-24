package com.dev.backend.websocket;

import com.dev.backend.websocket.VeKetNoiRealtime.DangKy;
import com.dev.backend.websocket.VeKetNoiRealtime.Kenh;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vé kết nối realtime: dùng một lần, có hạn, gắn đúng kênh; bắt tay không có vé hợp lệ bị từ chối. */
class VeKetNoiRealtimeTest {

    private static final DangKy DON_POS = new DangKy(Kenh.THANH_TOAN_POS, 123456L);
    private static final int NGUOI = 7;
    private static final Instant GOC = Instant.parse("2026-11-25T03:00:00Z");

    private VeKetNoiRealtime veKetNoi;

    @BeforeEach
    void setUp() {
        veKetNoi = new VeKetNoiRealtime();
        veKetNoi.setDongHo(Clock.fixed(GOC, ZoneOffset.UTC));
    }

    @Test
    void ve_dungMotLan() {
        String ve = veKetNoi.cap(DON_POS, NGUOI).orElseThrow();

        assertEquals(DON_POS, veKetNoi.dung(ve).orElseThrow());
        assertTrue(veKetNoi.dung(ve).isEmpty(), "vé đã dùng không mở được kết nối thứ hai");
    }

    @Test
    void ve_hetHan() {
        String ve = veKetNoi.cap(DON_POS, NGUOI).orElseThrow();
        veKetNoi.setDongHo(Clock.fixed(GOC.plus(VeKetNoiRealtime.THOI_HAN).plusSeconds(1), ZoneOffset.UTC));

        assertTrue(veKetNoi.dung(ve).isEmpty());
    }

    @Test
    void ve_laHoacRong_khongDungDuoc() {
        assertTrue(veKetNoi.dung(null).isEmpty());
        assertTrue(veKetNoi.dung("").isEmpty());
        assertTrue(veKetNoi.dung("doan-bua").isEmpty());
    }

    @Test
    void ve_ngauNhienKhongTrung() {
        Set<String> dsVe = new HashSet<>();
        for (int i = 0; i < 1000; i++) dsVe.add(veKetNoi.cap(DON_POS, i).orElseThrow());
        assertEquals(1000, dsVe.size());
        assertTrue(dsVe.iterator().next().length() >= 43, "32 byte ngẫu nhiên");
    }

    @Test
    void quaTranChung_tuChoi_veHetHanDuocDonDeCapTiep() {
        for (int i = 0; i < VeKetNoiRealtime.TOI_DA_VE; i++) veKetNoi.cap(DON_POS, i);
        assertTrue(veKetNoi.cap(DON_POS, -1).isEmpty(), "đủ trần chung mà chưa vé nào hết hạn thì từ chối");

        veKetNoi.setDongHo(Clock.fixed(GOC.plus(VeKetNoiRealtime.THOI_HAN).plusSeconds(1), ZoneOffset.UTC));
        assertTrue(veKetNoi.cap(DON_POS, -1).isPresent(), "vé hết hạn được dọn để cấp tiếp");
    }

    /** Một tài khoản xin dồn chỉ chạm trần của mình, người khác vẫn xin được. */
    @Test
    void quaTranMotNguoi_chiChanNguoiDo() {
        for (int i = 0; i < VeKetNoiRealtime.TOI_DA_VE_MOI_NGUOI; i++) assertTrue(veKetNoi.cap(DON_POS, NGUOI).isPresent());

        assertTrue(veKetNoi.cap(DON_POS, NGUOI).isEmpty());
        assertTrue(veKetNoi.cap(DON_POS, NGUOI + 1).isPresent());
    }

    @Test
    void dungVe_traLaiLuotChoNguoiDo() {
        String ve = null;
        for (int i = 0; i < VeKetNoiRealtime.TOI_DA_VE_MOI_NGUOI; i++) ve = veKetNoi.cap(DON_POS, NGUOI).orElseThrow();
        veKetNoi.dung(ve);

        assertTrue(veKetNoi.cap(DON_POS, NGUOI).isPresent());
    }

    // ===== Bắt tay =====

    private boolean batTay(KiemVeKetNoi kiem, String duongDan, ServerHttpResponse phanHoi, Map<String, Object> thuocTinh) {
        ServerHttpRequest yeuCau = mock(ServerHttpRequest.class);
        when(yeuCau.getURI()).thenReturn(URI.create(duongDan));
        return kiem.beforeHandshake(yeuCau, phanHoi, null, thuocTinh);
    }

    @Test
    void batTay_coVeDungKenh_ganDangKy() {
        KiemVeKetNoi kiem = new KiemVeKetNoi(veKetNoi, Kenh.THANH_TOAN_POS);
        String ve = veKetNoi.cap(DON_POS, NGUOI).orElseThrow();
        Map<String, Object> thuocTinh = new HashMap<>();

        assertTrue(batTay(kiem, "ws://may/ws-pos?ve=" + ve + "&lang=en", mock(ServerHttpResponse.class), thuocTinh));
        assertEquals(DON_POS, thuocTinh.get(KiemVeKetNoi.DANG_KY));
    }

    @Test
    void batTay_khongVe_hoacVeSai_bi403() {
        KiemVeKetNoi kiem = new KiemVeKetNoi(veKetNoi, Kenh.THANH_TOAN_POS);
        for (String duongDan : new String[]{"ws://may/ws-pos", "ws://may/ws-pos?orderCode=123456", "ws://may/ws-pos?ve=sai"}) {
            ServerHttpResponse phanHoi = mock(ServerHttpResponse.class);
            Map<String, Object> thuocTinh = new HashMap<>();

            assertFalse(batTay(kiem, duongDan, phanHoi, thuocTinh), duongDan);
            verify(phanHoi).setStatusCode(HttpStatus.FORBIDDEN);
            assertTrue(thuocTinh.isEmpty());
        }
    }

    @Test
    void batTay_veCuaKenhKhac_bi403() {
        KiemVeKetNoi kiemPhieuNhat = new KiemVeKetNoi(veKetNoi, Kenh.PHIEU_NHAT);
        String vePos = veKetNoi.cap(DON_POS, NGUOI).orElseThrow();
        ServerHttpResponse phanHoi = mock(ServerHttpResponse.class);

        assertFalse(batTay(kiemPhieuNhat, "ws://may/ws-outbound?ve=" + vePos, phanHoi, new HashMap<>()));
        verify(phanHoi).setStatusCode(HttpStatus.FORBIDDEN);
    }
}
