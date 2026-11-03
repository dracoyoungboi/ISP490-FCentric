package com.dev.backend.services.impl.kiemke;

import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * CSDL đã chạy migration-2026-11-03-kiem-ke-khoanh-vung.sql chưa. Chưa chạy thì chốt chặn ở các luồng nhập / xuất / bán
 * không làm gì (chưa có đợt khoanh vùng nào để chặn) và màn Kiểm kê trả 503 có mã, để backend mới lên trước migration
 * không làm hỏng các luồng đang chạy. Đã thấy bảng thì nhớ luôn; chưa thấy thì kiểm lại tối đa mỗi 30 giây.
 */
@Slf4j
@Component
public class KiemKeSanSang {

    private static final long KIEM_LAI_SAU_MS = 30_000;

    private static final String SQL_KIEM = """
            SELECT (SELECT COUNT(*) FROM information_schema.tables
                     WHERE table_schema = DATABASE()
                       AND table_name IN ('kiem_ke_mutex_kho', 'dot_kiem_ke_vi_tri', 'dot_kiem_ke_khoa_lo',
                                          'dot_kiem_ke_danh_muc', 'dot_kiem_ke_khu_vuc', 'kiem_ke_lenh',
                                          'kiem_ke_lan_dem', 'kiem_ke_outbox', 'phan_bo_lo_nhat_hang_vi_tri'))
                 + (SELECT COUNT(*) FROM information_schema.columns
                     WHERE table_schema = DATABASE() AND table_name = 'ton_kho_vi_tri' AND column_name = 'dang_kiem_ke')
            """;

    private final JdbcTemplate jdbc;

    private volatile boolean sanSang;
    private volatile long lanKiemCuoi;

    public KiemKeSanSang(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean sanSang() {
        if (sanSang) return true;
        long bayGio = System.currentTimeMillis();
        if (lanKiemCuoi != 0 && bayGio - lanKiemCuoi < KIEM_LAI_SAU_MS) return false;
        lanKiemCuoi = bayGio;
        try {
            Integer n = jdbc.queryForObject(SQL_KIEM, Integer.class);
            sanSang = n != null && n == 10;
            if (!sanSang) {
                log.warn("[KIEM-KE] CSDL chưa chạy migration-2026-11-03-kiem-ke-khoanh-vung.sql: chốt chặn kiểm kê đang tắt");
            }
        } catch (RuntimeException e) {
            log.warn("[KIEM-KE] Không kiểm được bảng kiểm kê khoanh vùng: {}", e.getMessage());
        }
        return sanSang;
    }

    /** Màn Kiểm kê: chưa nâng cấp CSDL thì báo rõ thay vì lỗi "Unknown column". */
    public void batBuoc() {
        if (!sanSang()) {
            throw new LoiCoMaException(HttpStatus.SERVICE_UNAVAILABLE, MaLoi.STK_NOT_READY,
                    "Máy chủ chưa nâng cấp cơ sở dữ liệu cho kiểm kê khoanh vùng. Báo quản trị viên chạy tệp "
                            + "migration-2026-11-03-kiem-ke-khoanh-vung.sql rồi tải lại trang.");
        }
    }
}
