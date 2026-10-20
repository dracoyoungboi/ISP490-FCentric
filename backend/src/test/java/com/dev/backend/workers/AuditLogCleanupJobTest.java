package com.dev.backend.workers;

import com.dev.backend.constant.variables.IHanhDong;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** JOB-04: dọn nhật ký quá 90 ngày theo đợt, KHÔNG xóa phiên bản mẫu in (cap_nhat_mau_in). */
class AuditLogCleanupJobTest {

    @Test
    void donNhatKy_giuPhienBanMauIn_xoaTheoDot() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(), any(), any())).thenReturn(5000, 12);

        new AuditLogCleanupJob(jdbc).cleanUpOldAuditLogs();

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object> moc = ArgumentCaptor.forClass(Object.class);
        ArgumentCaptor<Object> hanhDong = ArgumentCaptor.forClass(Object.class);
        ArgumentCaptor<Object> soDong = ArgumentCaptor.forClass(Object.class);
        verify(jdbc, times(2)).update(sql.capture(), moc.capture(), hanhDong.capture(), soDong.capture());
        assertEquals("DELETE FROM lich_su_thay_doi WHERE ngay_thuc_hien < ?"
                + " AND (hanh_dong IS NULL OR hanh_dong <> ?) LIMIT ?", sql.getValue());
        Instant mocXoa = (Instant) moc.getValue();
        long ngay = ChronoUnit.DAYS.between(mocXoa, Instant.now());
        assertTrue(ngay >= 89 && ngay <= 90, String.valueOf(ngay));
        assertEquals(IHanhDong.cap_nhat_mau_in, hanhDong.getValue());
        assertEquals(5000, soDong.getValue());
    }
}
