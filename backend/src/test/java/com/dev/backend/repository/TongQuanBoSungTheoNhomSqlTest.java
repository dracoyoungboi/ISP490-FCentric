package com.dev.backend.repository;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Khối Cần bổ sung ở Tổng quan lấy theo nhóm (sản phẩm, kho): cùng điều kiện với SQL_HANG_CAN_BO_SUNG, chọn các nhóm
 * tệ nhất rồi trả đủ mã của từng nhóm.
 */
class TongQuanBoSungTheoNhomSqlTest {

    @Test
    void sqlTheoNhom_cungDieuKien_chonNhomRoiLayDuMa() {
        String sql = TongQuanAdminRepository.SQL_HANG_CAN_BO_SUNG_THEO_NHOM;
        assertTrue(sql.strip().startsWith(", can AS ("), "nối tiếp danh sách WITH của CTE_TON_THEO_CAP");
        assertTrue(sql.contains("WHERE l.dang_ban = 1 AND l.kha_dung <= l.nguong"), "cùng điều kiện Hết hàng + Thiếu hàng");
        assertTrue(sql.contains("(:khoId IS NULL OR l.kho_id = :khoId)"));
        assertTrue(sql.contains("GROUP BY san_pham_id, kho_id"));
        assertTrue(sql.contains("LIMIT :soNhom"), "giới hạn số nhóm, không giới hạn số mã");
        assertTrue(sql.contains("JOIN nhom n               ON n.san_pham_id = c.san_pham_id AND n.kho_id = c.kho_id"));
        assertTrue(sql.contains("ORDER BY n.ti_le, n.kha_dung_min, n.kho_id, n.san_pham_id, c.kha_dung / c.nguong"),
                "nhóm tệ nhất trước, các mã của một nhóm liền nhau, mã tệ nhất trước");
        String day = TongQuanAdminRepository.CTE_TON_THEO_CAP + sql;
        assertEquals(1, day.split("WITH ", -1).length - 1, "chỉ một từ khóa WITH");
    }
}
