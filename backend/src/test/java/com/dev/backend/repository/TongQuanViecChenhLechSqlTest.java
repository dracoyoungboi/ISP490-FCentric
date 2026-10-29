package com.dev.backend.repository;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * "Chờ xử lý chênh lệch" ở danh sách việc của quản lý kho (Tổng quan) đếm theo cùng cấu hình với
 * PhieuChuyenKhoService.duocXuLyChenhLech (CHUYEN_KHO_QUYEN_XU_LY_LECH); ở Tổng quan quản trị luôn đếm.
 */
class TongQuanViecChenhLechSqlTest {

    @Test
    void sqlViecQuanLyKho_choXuLyLech_theoCauHinh() {
        String sql = TongQuanVaiTroRepository.SQL_VIEC_QUAN_LY_KHO;
        assertTrue(sql.contains("c.trang_thai = 'CHO_XU_LY_LECH'"), sql);
        assertTrue(sql.contains("ma_cau_hinh = 'CHUYEN_KHO_QUYEN_XU_LY_LECH'"), "đọc cùng cấu hình với PhieuChuyenKhoService");
        assertTrue(sql.contains("'QL_KHO_TONG')"), "chưa đặt cấu hình thì mặc định Quản lý Kho tổng");
        assertTrue(sql.contains("<> 'CHI_QUAN_TRI' AND EXISTS (SELECT 1 FROM kho kt WHERE kt.id = :khoId AND kt.loai_kho = 'kho_tong')"),
                "Kho tổng có việc này trừ chế độ chỉ quản trị viên");
        assertTrue(sql.contains("= 'QL_KHO_TONG_VA_KHO_XUAT' AND c.kho_xuat_id = :khoId"), "chế độ thêm kho xuất");
        assertTrue(sql.contains("MIN(c.ngay_thuc_te_den), INTERVAL :lech MINUTE"), "cũ nhất theo lúc nhận lệch (cột ứng dụng ghi)");
        assertTrue(sql.contains("AS lech_so") && sql.contains("AS lech_cu"));
        assertFalse(sql.contains("$s"), "đã thay hết chỗ %…$s");
    }

    @Test
    void sqlViecQuanTri_choXuLyLech_moiCheDo_khoXuatHoacKhoNhan() {
        String sql = TongQuanAdminRepository.SQL_VIEC_CAN_XU_LY;
        assertTrue(sql.contains("p.trang_thai = 'CHO_XU_LY_LECH'"), sql);
        assertTrue(sql.contains("(:khoId IS NULL OR p.kho_xuat_id = :khoId OR p.kho_nhap_id = :khoId)) AS pck_cho_xu_ly_lech"),
                "xem tất cả kho thì đếm hết; xem một kho thì phiếu có kho đó là kho xuất hoặc kho nhận");
        assertFalse(sql.contains("CHUYEN_KHO_QUYEN_XU_LY_LECH"), "quản trị viên luôn xử lý được, không phụ thuộc cấu hình");
    }
}
