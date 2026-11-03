-- =====================================================================
-- Kho gửi xác nhận biên bản giao nhận trên F Centric – 2026-11-03
--
-- Theo BA (03/11): kho nhận lập biên bản giao nhận (BBGN) khi nhận thiếu / hỏng → quản lý kho gửi nhận thông báo, vào
-- phiếu bấm "Xác nhận biên bản" → lúc đó người được xử lý chênh lệch mới thấy nút Xử lý chênh lệch. Ô "Đại diện kho
-- gửi" trên bản in ghi "Xác nhận trên hệ thống" kèm người và giờ xác nhận thay cho chữ ký tay.
-- Tệp này chỉ THÊM 3 CỘT vào bien_ban_giao_nhan (đều cho phép NULL), không thêm / sửa / xóa dòng nào:
--   nguoi_xac_nhan_gui_id  đại diện kho gửi đã xác nhận (khóa ngoại tới nguoi_dung)
--   ngay_xac_nhan_gui      lúc xác nhận; NULL = kho gửi chưa xác nhận
--   ghi_chu_kho_gui        ý kiến của kho gửi khi xác nhận (không bắt buộc, tối đa 255 ký tự)
-- Biên bản đang chờ xử lý lúc chạy tệp này cũng phải chờ kho gửi xác nhận như biên bản mới (chốt 03/11, Đ7): không tự
-- đánh dấu đã xác nhận vì không có người thật để ghi. Biên bản đã xử lý từ trước giữ nguyên, cột để trống.
--
-- THỨ TỰ KHI TRIỂN KHAI: tệp này → backend mới → frontend mới. Backend mới đọc 3 cột này ở mọi màn có biên bản (danh
-- sách, chi tiết phiếu chuyển): chạy backend mới trước tệp này thì các màn đó lỗi "Unknown column".
-- Lưu ý: máy cá nhân chạy backend mới (IntelliJ) trên CSDL dùng chung cũng cần tệp này đã chạy.
--
-- Chạy lại nhiều lần không lỗi (cột / khóa ngoại nào đã có thì bỏ qua), không cần chế độ xem trước.
-- Lỗi giữa chừng (vd. 1205 vì còn kết nối giữ bảng): tắt kết nối đó rồi chạy lại cả tệp trong cùng tab.
-- =====================================================================

SET NAMES utf8mb4;           -- tránh lỗi mã chữ tiếng Việt trong COMMENT

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

-- Chống treo: chỉ chờ khóa tối đa 5 giây; còn kết nối giữ bảng thì báo 1205 và KHÔNG đổi gì (tắt kết nối rồi chạy lại).
SET @cho_khoa_cu = IFNULL(@cho_khoa_cu, @@SESSION.lock_wait_timeout);
SET @cho_khoa_dong_cu = IFNULL(@cho_khoa_dong_cu, @@SESSION.innodb_lock_wait_timeout);
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;

-- 1. Cột mới (thêm khi chưa có)
SET @co = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bien_ban_giao_nhan' AND COLUMN_NAME = 'nguoi_xac_nhan_gui_id');
SET @sql = IF(@co = 0,
  'ALTER TABLE bien_ban_giao_nhan ADD COLUMN nguoi_xac_nhan_gui_id INT NULL DEFAULT NULL COMMENT ''Đại diện kho gửi xác nhận biên bản trên F Centric'' AFTER ghi_chu',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @co = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bien_ban_giao_nhan' AND COLUMN_NAME = 'ngay_xac_nhan_gui');
SET @sql = IF(@co = 0,
  'ALTER TABLE bien_ban_giao_nhan ADD COLUMN ngay_xac_nhan_gui DATETIME NULL DEFAULT NULL COMMENT ''Lúc kho gửi xác nhận; NULL = chưa xác nhận'' AFTER nguoi_xac_nhan_gui_id',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @co = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bien_ban_giao_nhan' AND COLUMN_NAME = 'ghi_chu_kho_gui');
SET @sql = IF(@co = 0,
  'ALTER TABLE bien_ban_giao_nhan ADD COLUMN ghi_chu_kho_gui VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT ''Ý kiến của kho gửi khi xác nhận (không bắt buộc)'' AFTER ngay_xac_nhan_gui',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 2. Khóa ngoại người xác nhận
SET @co = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bien_ban_giao_nhan'
              AND CONSTRAINT_NAME = 'fk_bbgn_nguoi_xac_nhan_gui' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql = IF(@co = 0,
  'ALTER TABLE bien_ban_giao_nhan ADD CONSTRAINT fk_bbgn_nguoi_xac_nhan_gui FOREIGN KEY (nguoi_xac_nhan_gui_id) REFERENCES nguoi_dung (id)',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Kiểm sau khi chạy: 3 cột + 1 khóa ngoại; số biên bản đang chờ kho gửi xác nhận
SELECT
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bien_ban_giao_nhan'
      AND COLUMN_NAME IN ('nguoi_xac_nhan_gui_id', 'ngay_xac_nhan_gui', 'ghi_chu_kho_gui'))      AS so_cot_moi_phai_bang_3,
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bien_ban_giao_nhan'
      AND CONSTRAINT_NAME = 'fk_bbgn_nguoi_xac_nhan_gui')                                       AS co_khoa_ngoai_phai_bang_1,
  (SELECT COUNT(*) FROM bien_ban_giao_nhan
    WHERE phuong_an_xu_ly = 'CHUA_XU_LY' AND ngay_xac_nhan_gui IS NULL)                         AS bien_ban_cho_kho_gui_xac_nhan;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET @cho_khoa_cu = NULL, @cho_khoa_dong_cu = NULL;
