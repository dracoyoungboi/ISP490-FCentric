-- =====================================================================
-- Sửa dữ liệu: phiếu xuất của đơn đã hủy bị "thu hồi" nhầm sang trạng thái 2 (= Đã duyệt)
-- Nguyên nhân: trước bản sửa, hủy đơn / hủy đơn trong phiếu nhặt / đồng bộ Shopify hủy đơn
-- đặt phieu_xuat_kho.trang_thai = 2 (theo comment cũ của cột) thay vì 4 (Đã hủy) như code đang dùng:
--   0 Nháp, 1 Chờ duyệt, 2 Đã duyệt, 3 Đã xuất, 4 Đã hủy (PhieuXuatKhoService.cancel đặt 4).
-- Màn Phiếu xuất vì vậy hiện "Đã duyệt" kèm nút in cho phiếu của đơn đã hủy.
-- Phiếu xuất BÁN HÀNG không bao giờ hợp lệ ở trạng thái 2 (gửi duyệt / phê duyệt chỉ dành cho
-- phiếu chuyển kho nội bộ loai_xuat = 'khac'), nên chỉ sửa phiếu 'ban_hang', trạng thái 2, thuộc đơn đã hủy.
-- Kèm phiếu bán hàng còn mở (0 Nháp / 6 Chờ xuất - đã đóng gói) của đơn đã hủy: đơn bị hủy bằng backend cũ
-- (không biết trạng thái 6) nên phiếu không được thu hồi, vẫn hiện ở tab "Chờ xuất" và bị đếm vào việc cần xử lý.
-- Phiếu bán hàng không giữ chỗ tồn theo lô (so_luong_da_dat) nên chỉ cần đổi trạng thái.
-- Chạy SAU khi deploy backend bản sửa. Chạy lại vẫn an toàn.
-- =====================================================================

-- 0) Xem trước (chỉ đọc)
SELECT px.id, px.so_phieu_xuat, px.trang_thai, px.ghi_chu, d.so_don_hang, d.trang_thai AS trang_thai_don
FROM phieu_xuat_kho px
JOIN don_ban_hang d ON d.id = px.don_ban_hang_id
WHERE px.loai_xuat = 'ban_hang' AND px.trang_thai IN (0, 2, 6) AND d.trang_thai = 4;

-- MySQL Workbench bật "Safe Updates" sẽ chặn UPDATE không theo khóa chính
SET SQL_SAFE_UPDATES = 0;

-- 1) Đưa về 4 (Đã hủy)
UPDATE phieu_xuat_kho px
JOIN don_ban_hang d ON d.id = px.don_ban_hang_id
SET px.trang_thai = 4
WHERE px.loai_xuat = 'ban_hang' AND px.trang_thai IN (0, 2, 6) AND d.trang_thai = 4;

SET SQL_SAFE_UPDATES = 1;

-- 2) Sửa comment cột cho khớp code (comment cũ "2: Đã hủy" là nguồn gốc của lỗi)
ALTER TABLE phieu_xuat_kho
  MODIFY COLUMN trang_thai tinyint(1) DEFAULT '0'
  COMMENT '0: Nháp, 1: Chờ duyệt, 2: Đã duyệt, 3: Đã xuất, 4: Đã hủy, 5: Hoàn tất, 6: Chờ xuất (đã đóng gói)';

-- 3) Kiểm tra lại: phải ra 0
SELECT COUNT(*) AS con_sai
FROM phieu_xuat_kho px
JOIN don_ban_hang d ON d.id = px.don_ban_hang_id
WHERE px.loai_xuat = 'ban_hang' AND px.trang_thai IN (0, 2, 6) AND d.trang_thai = 4;
