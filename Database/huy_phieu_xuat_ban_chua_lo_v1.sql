-- =====================================================================
-- DỌN PHIẾU XUẤT BÁN HÀNG CHƯA CÓ LÔ (Log 2 / Log 4 — câu A2: hủy hết, nhặt lại)
--   Từ bản nhặt hàng theo lô, phiếu xuất bán hàng sinh ra đã có sẵn lô và không còn bước chọn lô, nên phiếu
--   Nháp / Chờ xuất tạo trước đó mà CHƯA ĐỦ LÔ không xuất được nữa:
--     1. Hủy các phiếu đó (trang_thai = 4) — KHÔNG xóa dòng, giữ lịch sử.
--     2. Đơn của chúng về 1 Chờ nhặt hàng (hoặc 2 nếu đã xuất một phần) và bỏ liên kết phiếu nhặt cũ, để hiện lại
--        ở màn Đơn chờ xuất và gom vào phiếu nhặt mới.
--     3. Đơn 1 / 2 còn gắn phiếu nhặt đã hủy ('da_huy') và không có phiếu xuất mở: bỏ liên kết (không thì không
--        nhặt lại được, cũng không "Tạo lại phiếu xuất" được — việc đó chỉ dành cho phiếu nhặt 'da_nhat').
--   Phiếu đã chọn đủ lô ở bản trước giữ nguyên, xuất kho bình thường.
--   Hàng đã nhặt / đóng gói của các đơn bị hủy phiếu phải trả về kệ (đơn sẽ được nhặt lại).
--
-- THỨ TỰ TRIỂN KHAI: dừng backend → phan_bo_lo_nhat_hang_v1.sql → xem phần 0 của script này → chạy cả script
--   → bật backend mới. Chạy lại nhiều lần an toàn (lần sau không còn phiếu nào khớp).
-- =====================================================================
SET NAMES utf8mb4;
-- MySQL Workbench bật "Safe Updates" sẽ chặn UPDATE không theo khóa chính
SET SQL_SAFE_UPDATES = 0;

-- ---------------------------------------------------------------------
-- 0) Xem trước (chỉ đọc): phiếu xuất bán hàng Nháp / Chờ xuất còn thiếu lô ở ít nhất một dòng
-- ---------------------------------------------------------------------
SELECT p.id, p.so_phieu_xuat, p.trang_thai AS trang_thai_phieu, d.so_don_hang, d.trang_thai AS trang_thai_don
FROM phieu_xuat_kho p
JOIN don_ban_hang d ON d.id = p.don_ban_hang_id
WHERE p.loai_xuat = 'ban_hang'
  AND p.trang_thai IN (0, 6)
  AND EXISTS (
      SELECT 1 FROM chi_tiet_phieu_xuat_kho g
      WHERE g.phieu_xuat_kho_id = p.id
        AND g.lo_hang_id IS NULL
        AND g.so_luong_xuat > (
            SELECT COALESCE(SUM(l.so_luong_xuat), 0) FROM chi_tiet_phieu_xuat_kho l
            WHERE l.phieu_xuat_kho_id = p.id
              AND l.lo_hang_id IS NOT NULL
              AND l.bien_the_san_pham_id = g.bien_the_san_pham_id))
ORDER BY p.id;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_phieu_ban_chua_lo;
CREATE TEMPORARY TABLE tmp_phieu_ban_chua_lo (
    id INT NOT NULL PRIMARY KEY,
    don_ban_hang_id INT NOT NULL
);
INSERT INTO tmp_phieu_ban_chua_lo (id, don_ban_hang_id)
SELECT p.id, p.don_ban_hang_id
FROM phieu_xuat_kho p
WHERE p.loai_xuat = 'ban_hang'
  AND p.trang_thai IN (0, 6)
  AND p.don_ban_hang_id IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM chi_tiet_phieu_xuat_kho g
      WHERE g.phieu_xuat_kho_id = p.id
        AND g.lo_hang_id IS NULL
        AND g.so_luong_xuat > (
            SELECT COALESCE(SUM(l.so_luong_xuat), 0) FROM chi_tiet_phieu_xuat_kho l
            WHERE l.phieu_xuat_kho_id = p.id
              AND l.lo_hang_id IS NOT NULL
              AND l.bien_the_san_pham_id = g.bien_the_san_pham_id));

-- 1) Hủy phiếu (giữ dòng, ghi lý do vào ghi chú)
UPDATE phieu_xuat_kho p
JOIN tmp_phieu_ban_chua_lo t ON t.id = p.id
SET p.trang_thai = 4,
    p.ghi_chu = CONCAT_WS(' | ', NULLIF(p.ghi_chu, ''), 'Hủy khi chuyển sang nhặt hàng theo lô (phiếu chưa có lô) - nhặt lại đơn');

-- 2) Đơn của phiếu vừa hủy: không còn phiếu xuất mở → về chờ nhặt (2 nếu đã xuất một phần), bỏ liên kết phiếu nhặt cũ
UPDATE don_ban_hang d
JOIN (SELECT DISTINCT don_ban_hang_id FROM tmp_phieu_ban_chua_lo) x ON x.don_ban_hang_id = d.id
SET d.trang_thai = CASE
        WHEN EXISTS (SELECT 1 FROM phieu_xuat_kho p3 WHERE p3.don_ban_hang_id = d.id AND p3.trang_thai = 3) THEN 2
        ELSE 1
    END,
    d.danh_sach_nhat_hang_id = NULL,
    d.ngay_cap_nhat = NOW()
WHERE d.loai_chung_tu = 'don_ban_hang'
  AND d.trang_thai IN (1, 2, 7, 8)
  AND NOT EXISTS (SELECT 1 FROM phieu_xuat_kho p2 WHERE p2.don_ban_hang_id = d.id AND p2.trang_thai IN (0, 6));

-- 3) Đơn 1 / 2 còn gắn phiếu nhặt đã hủy, không có phiếu xuất mở → bỏ liên kết để nhặt lại
UPDATE don_ban_hang d
JOIN danh_sach_nhat_hang n ON n.id = d.danh_sach_nhat_hang_id
SET d.danh_sach_nhat_hang_id = NULL,
    d.ngay_cap_nhat = NOW()
WHERE d.loai_chung_tu = 'don_ban_hang'
  AND d.trang_thai IN (1, 2)
  AND n.trang_thai = 'da_huy'
  AND NOT EXISTS (SELECT 1 FROM phieu_xuat_kho p2 WHERE p2.don_ban_hang_id = d.id AND p2.trang_thai IN (0, 6));

SELECT COUNT(*) AS so_phieu_da_huy FROM tmp_phieu_ban_chua_lo;
DROP TEMPORARY TABLE IF EXISTS tmp_phieu_ban_chua_lo;

COMMIT;

-- Kiểm tra sau khi chạy (phải bằng 0): phiếu xuất bán hàng mở còn thiếu lô
SELECT COUNT(*) AS phieu_ban_mo_con_thieu_lo
FROM phieu_xuat_kho p
WHERE p.loai_xuat = 'ban_hang'
  AND p.trang_thai IN (0, 6)
  AND EXISTS (
      SELECT 1 FROM chi_tiet_phieu_xuat_kho g
      WHERE g.phieu_xuat_kho_id = p.id
        AND g.lo_hang_id IS NULL
        AND g.so_luong_xuat > (
            SELECT COALESCE(SUM(l.so_luong_xuat), 0) FROM chi_tiet_phieu_xuat_kho l
            WHERE l.phieu_xuat_kho_id = p.id
              AND l.lo_hang_id IS NOT NULL
              AND l.bien_the_san_pham_id = g.bien_the_san_pham_id));
