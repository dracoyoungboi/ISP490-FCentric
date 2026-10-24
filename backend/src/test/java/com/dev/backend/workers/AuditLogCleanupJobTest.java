package com.dev.backend.workers;

import com.dev.backend.constant.variables.IHanhDong;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * JOB-04: dọn nhật ký quá 90 ngày theo đợt, KHÔNG xóa phiên bản mẫu in (cap_nhat_mau_in) và nhật ký bảo mật
 * (IHanhDong.KHONG_TU_DON).
 */
class AuditLogCleanupJobTest {

    /** Ghi lại từng lần gọi update(sql, tham số…) và trả số dòng xóa theo thứ tự cho trước. */
    static class JdbcGhiLai extends JdbcTemplate {
        final List<String> sqls = new ArrayList<>();
        final List<Object[]> thamSos = new ArrayList<>();
        final Deque<Integer> soDongXoa;

        JdbcGhiLai(Integer... soDongXoa) {
            this.soDongXoa = new ArrayDeque<>(Arrays.asList(soDongXoa));
        }

        @Override
        public int update(String sql, Object... args) {
            sqls.add(sql);
            thamSos.add(args);
            return soDongXoa.isEmpty() ? 0 : soDongXoa.poll();
        }
    }

    @Test
    void donNhatKy_giuMauInVaNhatKyBaoMat_xoaTheoDot() {
        JdbcGhiLai jdbc = new JdbcGhiLai(5000, 12);

        new AuditLogCleanupJob(jdbc).cleanUpOldAuditLogs();

        assertEquals(2, jdbc.sqls.size(), "đợt đầu đủ 5000 dòng thì xóa tiếp, đợt sau ít hơn thì dừng");
        int n = IHanhDong.KHONG_TU_DON.size();
        String dauHoi = String.join(", ", java.util.Collections.nCopies(n, "?"));
        assertEquals("DELETE FROM lich_su_thay_doi WHERE ngay_thuc_hien < ?"
                + " AND (hanh_dong IS NULL OR hanh_dong NOT IN (" + dauHoi + ")) LIMIT ?", jdbc.sqls.get(1));

        Object[] thamSo = jdbc.thamSos.get(1);
        assertEquals(n + 2, thamSo.length);
        long ngay = ChronoUnit.DAYS.between((Instant) thamSo[0], Instant.now());
        assertTrue(ngay >= 89 && ngay <= 90, String.valueOf(ngay));
        assertEquals(IHanhDong.KHONG_TU_DON, Arrays.asList(Arrays.copyOfRange(thamSo, 1, n + 1)));
        assertEquals(5000, thamSo[n + 1]);
    }

    @Test
    void danhSachGiuLai_coMauInVaHanhDongBaoMat_khongCoDongBoSan() {
        for (String hanhDong : List.of(IHanhDong.cap_nhat_mau_in, IHanhDong.dang_nhap, IHanhDong.dang_nhap_that_bai,
                IHanhDong.khoa_tai_khoan, IHanhDong.mo_khoa_tai_khoan, IHanhDong.doi_mat_khau, IHanhDong.dat_lai_mat_khau,
                IHanhDong.cap_nhat_khoa_thanh_toan, IHanhDong.cap_nhat_phan_quyen, IHanhDong.nang_cap_chuc_vu,
                IHanhDong.cap_quyen, IHanhDong.thu_hoi_quyen)) {
            assertTrue(IHanhDong.KHONG_TU_DON.contains(hanhDong), hanhDong);
        }
        // Ghi kết quả mỗi lần đồng bộ đơn từ sàn: giữ mãi thì bảng phình
        assertFalse(IHanhDong.KHONG_TU_DON.contains(IHanhDong.cap_nhat_kenh_ban));
        assertFalse(IHanhDong.KHONG_TU_DON.contains(IHanhDong.quet_barcode));
    }

    @Test
    void loiCsdl_khongNemRaNgoai() {
        JdbcTemplate loi = new JdbcTemplate() {
            @Override
            public int update(String sql, Object... args) {
                throw new IllegalStateException("mất kết nối");
            }
        };
        assertDoesNotThrow(() -> new AuditLogCleanupJob(loi).cleanUpOldAuditLogs());
    }
}
