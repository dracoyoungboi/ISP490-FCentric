package com.dev.backend.services.impl.utils;

import com.dev.backend.services.impl.utils.LoginRateLimiter.Decision;
import com.dev.backend.testsupport.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Giới hạn nhập sai mật khẩu: đếm theo tài khoản, đếm trước khi kiểm mật khẩu, khoá tăng dần, xoá khi đúng. */
class LoginRateLimiterTest {

    private static final Integer ACC = 7;
    private MutableClock clock;
    private LoginRateLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-10-23T08:00:00Z"));
        limiter = new LoginRateLimiter(clock);
    }

    /** Thử n lần (chưa biết đúng sai), khẳng định cả n lần đều được phép kiểm mật khẩu. */
    private void thuDuocPhep(String identifier, Integer accountId, int soLan) {
        for (int i = 0; i < soLan; i++) {
            assertTrue(limiter.tryAcquire(identifier, accountId).allowed(), "lần thử " + (i + 1));
        }
    }

    private static void assertBiKhoa(Decision d, long giay) {
        assertFalse(d.allowed());
        assertEquals(giay, d.retryAfterSeconds());
    }

    // ===== ngưỡng và thời gian khoá =====

    @Test
    void lanThuThu5VanDuocKiem_lanThu6BiKhoa1Phut_hetGioThiMo() {
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        assertBiKhoa(limiter.tryAcquire("khang", ACC), 60);

        clock.advance(Duration.ofSeconds(59));
        assertBiKhoa(limiter.tryAcquire("khang", ACC), 1);
        clock.advance(Duration.ofSeconds(1));
        assertTrue(limiter.tryAcquire("khang", ACC).allowed());
    }

    @Test
    void khoaLapLai_thoiGianTangDan_roiGiuMucCuoi() {
        for (long giay : new long[]{60, 300, 900, 1800, 1800}) {
            thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
            assertBiKhoa(limiter.tryAcquire("khang", ACC), giay);
            clock.advance(Duration.ofSeconds(giay));
        }
    }

    @Test
    void dangKhoa_tuChoiMaKhongGhiNhan_khongKeoDaiHayTangMucKhoa() {
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        for (int i = 0; i < 100; i++) {
            assertFalse(limiter.tryAcquire("khang", ACC).allowed());
        }
        clock.advance(LoginRateLimiter.LOCK_STEPS[0]);

        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        assertBiKhoa(limiter.tryAcquire("khang", ACC), 300); // bậc 2, không nhảy lên 30 phút
    }

    @Test
    void dungMatKhau_xoaBoDemVaMucKhoa() {
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        clock.advance(LoginRateLimiter.LOCK_STEPS[0]);
        limiter.recordSuccess("khang", ACC);

        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        assertBiKhoa(limiter.tryAcquire("khang", ACC), 60);
    }

    @Test
    void lanThuDungNgayTruocNguong_xoaKhoaVuaDat() {
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS); // lần thứ 5 đặt khoá trước khi biết đúng sai
        limiter.recordSuccess("khang", ACC);                     // lần thứ 5 hoá ra đúng
        assertTrue(limiter.tryAcquire("khang", ACC).allowed());
    }

    @Test
    void yen24Gio_mucKhoaVeBacDau() {
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        clock.advance(LoginRateLimiter.LOCK_STEPS[0]);
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        assertBiKhoa(limiter.tryAcquire("khang", ACC), 300);

        clock.advance(LoginRateLimiter.RESET_AFTER);
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        assertBiKhoa(limiter.tryAcquire("khang", ACC), 60);
    }

    @Test
    void lanThuCuQuaCuaSo_khongCongDon() {
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS - 1);
        clock.advance(LoginRateLimiter.WINDOW);
        // 4 lần cũ đã ra khỏi cửa sổ: phải đủ 5 lần mới mới bị khoá
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        assertFalse(limiter.tryAcquire("khang", ACC).allowed());
    }

    // ===== khoá theo tài khoản / theo chuỗi =====

    @Test
    void cungTaiKhoan_moiChuoiNhapChungMotBoDem() {
        String[] chuoi = {"khang", "khang@example.com", "0912345678", "khàng", "KHANG"};
        for (String c : chuoi) {
            assertTrue(limiter.tryAcquire(c, ACC).allowed(), c);
        }
        for (String c : chuoi) {
            assertFalse(limiter.tryAcquire(c, ACC).allowed(), c);
        }
        assertTrue(limiter.tryAcquire("lan", 8).allowed(), "tài khoản khác không bị ảnh hưởng");
    }

    @Test
    void chuoiKhongUngTaiKhoan_bienTheDauVaKyTuVoHinh_chungMotBoDem() {
        // giống collation utf8mb4_unicode_ci: nếu khác bộ đếm thì dò được chuỗi nào ứng với tài khoản thật
        thuDuocPhep("bob", null, 1);
        thuDuocPhep("bób", null, 1);
        thuDuocPhep("BÔB", null, 1);
        thuDuocPhep("bo​b", null, 1);
        thuDuocPhep("ｂｏｂ", null, 1); // chữ full-width
        assertFalse(limiter.tryAcquire("bỏb", null).allowed());
        assertEquals(LoginRateLimiter.identifierKey("bob"), LoginRateLimiter.identifierKey(" BÓB "));
        assertEquals(24, LoginRateLimiter.identifierKey("a".repeat(255)).length(), "khoá băm có độ dài cố định");
    }

    @Test
    void dayTranBoDemTheoChuoi_chuoiMoiKhongDuocDem_chuoiCuVanBiKhoa() {
        LoginRateLimiter nho = new LoginRateLimiter(clock, 2);
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            nho.tryAcquire("cu1", null);
        }
        nho.tryAcquire("cu2", null);
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS * 3; i++) {
            assertTrue(nho.tryAcquire("moi", null).allowed(), "đầy trần: chuỗi mới không bị đếm");
        }
        assertFalse(nho.tryAcquire("cu1", null).allowed(), "chuỗi đã theo dõi vẫn bị khoá");
        assertEquals(4, nho.trackedKeys(), "2 chuỗi, mỗi chuỗi một bộ đếm riêng và một cặp không IP");
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            nho.tryAcquire("taikhoan", ACC);
        }
        assertFalse(nho.tryAcquire("taikhoan", ACC).allowed(), "trần không áp cho bộ đếm theo tài khoản");
    }

    @Test
    void chuoiKhongUngTaiKhoan_demTheoChuoi_khongPhanBietHoaThuongVaKhoangTrangHaiDau() {
        thuDuocPhep("Bob", null, 2);
        thuDuocPhep(" bob ", null, 2);
        thuDuocPhep("BOB", null, 1);
        assertFalse(limiter.tryAcquire("bob", null).allowed());
        assertTrue(limiter.tryAcquire("alice", null).allowed());
    }

    // ===== cặp (tài khoản, IP) và ngưỡng tài khoản =====

    private static final String IP_KE_DO = "203.0.113.10";
    private static final String IP_CHU = "198.51.100.7";

    @Test
    void keDoTuMotIp_khoaCapCuaMinh_chuTaiKhoanIpKhacVanDangNhapDuoc() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            assertTrue(limiter.tryAcquire("khang", ACC, IP_KE_DO).allowed());
        }
        assertBiKhoa(limiter.tryAcquire("khang", ACC, IP_KE_DO), 60);
        assertTrue(limiter.tryAcquire("khang", ACC, IP_CHU).allowed(), "chủ tài khoản ở IP khác không bị khoá");
    }

    @Test
    void doTuNhieuIp_duNguongTaiKhoan_khoaMoiIp() {
        // mỗi IP 4 lần (dưới ngưỡng cặp), 5 IP = 20 lần: chạm ngưỡng tài khoản
        for (int ip = 0; ip < 5; ip++) {
            for (int i = 0; i < LoginRateLimiter.MAX_FAILS - 1; i++) {
                assertTrue(limiter.tryAcquire("khang", ACC, "203.0.113." + ip).allowed());
            }
        }
        assertBiKhoa(limiter.tryAcquire("khang", ACC, IP_CHU), 60);
        assertBiKhoa(limiter.tryAcquire("khang", ACC, "203.0.113.0"), 60);
        assertTrue(limiter.tryAcquire("lan", 8, IP_CHU).allowed(), "tài khoản khác không bị ảnh hưởng");
    }

    @Test
    void chuoiKhongUngTaiKhoan_cungHaiNguongNhuTaiKhoanThat() {
        // phản hồi giống hệt tài khoản thật: khoá theo cặp sau 5 lần, IP khác vẫn thử được
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            assertTrue(limiter.tryAcquire("khongco", null, IP_KE_DO).allowed());
        }
        assertBiKhoa(limiter.tryAcquire("khongco", null, IP_KE_DO), 60);
        assertTrue(limiter.tryAcquire("khongco", null, IP_CHU).allowed());
    }

    @Test
    void dungMatKhau_xoaCaBoDemTaiKhoanVaMoiCap() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            limiter.tryAcquire("khang", ACC, IP_KE_DO);
        }
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS - 1; i++) {
            limiter.tryAcquire("khang", ACC, IP_CHU);
        }
        limiter.recordSuccess("khang", ACC);
        assertTrue(limiter.tryAcquire("khang", ACC, IP_KE_DO).allowed(), "cặp đang khoá được xoá");
        assertEquals(2, limiter.trackedKeys(), "chỉ còn bộ đếm của lần thử vừa rồi: tài khoản + cặp IP_KE_DO");
    }

    @Test
    void khongCoIp_demThangTheoTaiKhoan_namLanThiKhoaCaDangNhapCoIp() {
        // đổi mật khẩu khi đã đăng nhập (không có IP): người giữ phiên dò mật khẩu hiện tại thì khoá cả đăng nhập
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);
        assertBiKhoa(limiter.tryAcquire("khang", ACC, " "), 60);
        assertEquals(2, limiter.trackedKeys(), "tài khoản + cặp không IP");
        assertBiKhoa(limiter.tryAcquire("khang", ACC, IP_CHU), 60);
    }

    @Test
    void dangNhapSaiKhongCongVaoCapKhongIp_motLanGoSaiODoiMatKhauKhongKhoaChuTaiKhoan() {
        // người ngoài dò 4 lần từ một IP; chủ tài khoản gõ sai mật khẩu hiện tại một lần ở Đổi mật khẩu
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS - 1; i++) {
            assertTrue(limiter.tryAcquire("khang", ACC, IP_KE_DO).allowed());
        }
        assertTrue(limiter.tryAcquire(null, ACC).allowed());
        assertTrue(limiter.tryAcquire("khang", ACC, IP_CHU).allowed(), "chủ tài khoản vẫn đăng nhập được");
        assertTrue(limiter.tryAcquire(null, ACC).allowed(), "vẫn đổi mật khẩu được");
    }

    @Test
    void purge_giuMucKhoaCuaBoDemTaiKhoan_trong24Gio() {
        // 5 IP × 4 lần = 20: khoá ở ngưỡng tài khoản, không cặp nào bị khoá
        for (int ip = 0; ip < 5; ip++) {
            for (int i = 0; i < LoginRateLimiter.MAX_FAILS - 1; i++) {
                limiter.tryAcquire("khang", ACC, "203.0.113." + ip);
            }
        }
        clock.advance(LoginRateLimiter.WINDOW.plusSeconds(1));
        limiter.purgeExpired();
        assertEquals(1, limiter.trackedKeys(), "còn bộ đếm tài khoản (nhớ mức khoá); 5 cặp chưa khoá đã xoá");

        // lần khoá kế tiếp ở ngưỡng tài khoản lên bậc 2 (5 phút)
        for (int ip = 0; ip < 5; ip++) {
            for (int i = 0; i < LoginRateLimiter.MAX_FAILS - 1; i++) {
                limiter.tryAcquire("khang", ACC, "198.51.100." + ip);
            }
        }
        assertBiKhoa(limiter.tryAcquire("khang", ACC, IP_CHU), 300);

        clock.advance(LoginRateLimiter.RESET_AFTER);
        limiter.purgeExpired();
        assertEquals(0, limiter.trackedKeys());
    }

    @Test
    void purge_xoaCapHetHan_giuCapDangNhoMucKhoa() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILS; i++) {
            limiter.tryAcquire("khang", ACC, IP_KE_DO); // cặp bị khoá
        }
        limiter.tryAcquire("khang", ACC, IP_CHU);       // cặp một lần, chưa khoá
        assertEquals(3, limiter.trackedKeys());

        clock.advance(LoginRateLimiter.WINDOW.plusSeconds(1));
        limiter.purgeExpired();
        assertEquals(1, limiter.trackedKeys(), "còn cặp IP_KE_DO (nhớ mức khoá trong 24 giờ)");

        clock.advance(LoginRateLimiter.RESET_AFTER);
        limiter.purgeExpired();
        assertEquals(0, limiter.trackedKeys());
    }

    // ===== song song =====

    @Test
    void nhieuLuongCungLuc_dungNamLanDuocKiemMatKhau() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(16);
        CountDownLatch batDau = new CountDownLatch(1);
        List<Future<Boolean>> ketQua = new ArrayList<>();
        for (int i = 0; i < 64; i++) {
            ketQua.add(pool.submit(() -> {
                batDau.await();
                return limiter.tryAcquire("khang", ACC).allowed();
            }));
        }
        batDau.countDown();
        int duocPhep = 0;
        for (Future<Boolean> f : ketQua) {
            if (f.get(10, TimeUnit.SECONDS)) duocPhep++;
        }
        pool.shutdown();

        assertEquals(LoginRateLimiter.MAX_FAILS, duocPhep);
        assertBiKhoa(limiter.tryAcquire("khang", ACC), 60);
    }

    // ===== IP: chỉ cảnh báo =====

    @Test
    void ip_saiNhieu_chiCanhBao_khongKhoaAi() {
        for (int i = 0; i < LoginRateLimiter.CANH_BAO_IP * 3; i++) {
            limiter.recordFailureFromIp("203.0.113.10");
        }
        assertTrue(limiter.tryAcquire("bat-ky", null).allowed());
        assertTrue(limiter.tryAcquire("khang", ACC).allowed());
    }

    @Test
    void nullHoacRong_boQuaKhongLoi() {
        assertTrue(limiter.tryAcquire(null, null).allowed());
        assertTrue(limiter.tryAcquire("  ", null).allowed());
        limiter.recordSuccess(null, null);
        limiter.recordFailureFromIp(null);
        limiter.recordFailureFromIp(" ");
        assertEquals(0, limiter.trackedKeys());
    }

    // ===== dọn bộ nhớ =====

    @Test
    void purge_xoaBoDemHetHan_giuMucKhoaTrong24Gio() {
        limiter.tryAcquire("motlan", null);
        limiter.recordFailureFromIp("203.0.113.10");
        thuDuocPhep("khang", ACC, LoginRateLimiter.MAX_FAILS);

        clock.advance(LoginRateLimiter.WINDOW.plusSeconds(1));
        limiter.purgeExpired();
        // còn: cặp không IP của acc 7 (bị khoá, nhớ mức khoá). Đã xoá: bộ đếm tài khoản acc 7 (5/20, chưa khoá),
        // "motlan" và IP (không còn lần thử trong cửa sổ, chưa từng bị khoá)
        assertEquals(1, limiter.trackedKeys());

        clock.advance(LoginRateLimiter.RESET_AFTER);
        limiter.purgeExpired();
        assertEquals(0, limiter.trackedKeys());
    }
}
