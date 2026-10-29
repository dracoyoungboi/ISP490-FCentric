package com.dev.backend.workers;

import org.junit.jupiter.api.Test;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Dọn thông báo cũ hơn 90 ngày theo đợt; chạy lặp (localhost + production cùng CSDL) vô hại; lỗi chỉ ghi log. */
class ThongBaoCleanupJobTest {

    /** Ghi lại từng lần gọi update(sql, tham số…) và trả số dòng xóa theo thứ tự cho trước. */
    static class JdbcGhiLai extends JdbcTemplate {
        final List<String> sqls = new ArrayList<>();
        final List<Object[]> thamSos = new ArrayList<>();
        final Deque<Integer> soDongXoa;
        RuntimeException loi;

        JdbcGhiLai(Integer... soDongXoa) {
            this.soDongXoa = new ArrayDeque<>(Arrays.asList(soDongXoa));
        }

        @Override
        public int update(String sql, Object... args) {
            sqls.add(sql);
            thamSos.add(args);
            if (loi != null) throw loi;
            return soDongXoa.isEmpty() ? 0 : soDongXoa.poll();
        }
    }

    @Test
    void xoaTheoDot_moc90Ngay() {
        JdbcGhiLai jdbc = new JdbcGhiLai(5000, 5000, 7);

        new ThongBaoCleanupJob(jdbc).donThongBaoCu();

        assertEquals(3, jdbc.sqls.size(), "đợt đủ 5000 dòng thì xóa tiếp, đợt ít hơn thì dừng");
        assertEquals("DELETE FROM thong_bao WHERE ngay_tao < ? AND khoa_su_kien IS NOT NULL LIMIT ?", jdbc.sqls.get(0));
        Object[] thamSo = jdbc.thamSos.get(0);
        long ngay = ChronoUnit.DAYS.between((Instant) thamSo[0], Instant.now());
        assertTrue(ngay >= 89 && ngay <= 90, String.valueOf(ngay));
        assertEquals(5000, thamSo[1]);
    }

    @Test
    void chayLanHai_khongConGiXoa_motCauVoHai() {
        JdbcGhiLai jdbc = new JdbcGhiLai(12);
        ThongBaoCleanupJob job = new ThongBaoCleanupJob(jdbc);
        job.donThongBaoCu();
        job.donThongBaoCu();
        assertEquals(2, jdbc.sqls.size(), "mỗi lần chạy chỉ một câu DELETE theo mốc ngày khi còn ít hơn một đợt");
    }

    @Test
    void bangChuaTao_chiGhiLog() {
        JdbcGhiLai jdbc = new JdbcGhiLai();
        jdbc.loi = new InvalidDataAccessResourceUsageException("Table 'fashion_system.thong_bao' doesn't exist");
        assertDoesNotThrow(() -> new ThongBaoCleanupJob(jdbc).donThongBaoCu());
    }
}
