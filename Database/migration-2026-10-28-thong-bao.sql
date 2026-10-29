-- =====================================================================
-- Thông báo trong ứng dụng (chuông trên thanh trên cùng) – 2026-10-28
--
-- Bảng thong_bao CÓ SẴN trong lược đồ gốc (Database/MyDB_v1.3.sql): nguoi_dung_id, loai_thong_bao, tieu_de, noi_dung,
-- loai_tham_chieu, id_tham_chieu, da_doc, ngay_tao. Tệp này GIỮ NGUYÊN các cột và dữ liệu đó, chỉ thêm:
--   tone           màu ô biểu tượng: 'info' | 'warning' | 'danger' | 'success'
--   duong_dan      đường dẫn trong ứng dụng mở khi bấm (vd. '/transfer-tickets/12')
--   kho_id         kho liên quan (để trống được; xóa kho thì về NULL)
--   khoa_su_kien   khóa của sự kiện (vd. 'PCK:12:DUYET'): cùng người nhận + cùng khóa chỉ có một dòng, gọi lặp không
--                  tạo trùng (UNIQUE uk_thong_bao_nguoi_su_kien). Dòng có sẵn từ trước để trống cột này và KHÔNG hiện ở
--                  chuông; job dọn 90 ngày cũng chỉ xóa dòng có khoa_su_kien.
-- CSDL nào chưa có bảng (lược đồ cũ hơn) thì tạo theo đúng cột của lược đồ gốc trước rồi mới thêm cột.
-- Không thêm, sửa, xóa dòng nào. Chạy lại nhiều lần không lỗi (bước nào đã có thì bỏ qua), không cần chế độ xem trước.
--
-- THỨ TỰ KHI TRIỂN KHAI: tệp này → backend mới → frontend mới. Backend mới vẫn chạy khi CHƯA chạy tệp này (ghi thông
-- báo lỗi chỉ ghi log, thao tác chuyển kho vẫn thành công; API thông báo báo lỗi, chuông hiện "Không thể tải thông
-- báo"), nhưng chuông chỉ có dữ liệu sau khi đã chạy.
--
-- Lỗi giữa chừng (vd. 1205 vì còn kết nối giữ bảng): tắt kết nối đó rồi chạy lại cả tệp trong cùng tab (bước đã làm tự bỏ
-- qua, cuối tệp trả lại cài đặt phiên), hoặc đóng tab và mở kết nối mới.
-- =====================================================================

SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 / cp850 thì chữ tiếng Việt trong COMMENT bị lỗi mã

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

-- Chống treo hệ thống: chỉ chờ khóa tối đa 5 giây. Còn kết nối giữ bảng (backend cũ, máy localhost) thì lệnh đó báo lỗi
-- 1205 và KHÔNG đổi gì, thay vì đứng chờ kéo cả hệ thống đứng theo: tắt kết nối rồi chạy lại cả tệp (bước đã làm tự bỏ
-- qua).
-- Giá trị gốc chỉ lưu khi chưa có, nên lần chạy lại sau lỗi giữa chừng vẫn trả về đúng giá trị ban đầu.
SET @cho_khoa_cu = IFNULL(@cho_khoa_cu, @@SESSION.lock_wait_timeout);
SET @cho_khoa_dong_cu = IFNULL(@cho_khoa_dong_cu, @@SESSION.innodb_lock_wait_timeout);
SET @an_toan_cu = IFNULL(@an_toan_cu, @@SESSION.sql_safe_updates);
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;
-- Workbench mặc định bật Safe Updates: UPDATE không lọc theo cột khóa bị chặn (lỗi 1175) — tắt trong lúc chạy
SET SESSION sql_safe_updates = 0;

-- 1. Bảng theo lược đồ gốc (chỉ tạo khi chưa có)
CREATE TABLE IF NOT EXISTS thong_bao (
    id              INT          NOT NULL AUTO_INCREMENT,
    nguoi_dung_id   INT          DEFAULT NULL COMMENT 'ID người nhận. Nếu NULL thì là thông báo hệ thống gửi chung (Broadcast)',
    loai_thong_bao  ENUM('don_hang','ton_kho','he_thong','phe_duyet','khac') DEFAULT 'khac',
    tieu_de         VARCHAR(255) NOT NULL,
    noi_dung        TEXT         NOT NULL,
    loai_tham_chieu VARCHAR(50)  DEFAULT NULL,
    id_tham_chieu   INT          DEFAULT NULL,
    da_doc          TINYINT(1)   DEFAULT '0' COMMENT '0: Chưa đọc, 1: Đã đọc',
    ngay_tao        TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_thong_bao_nguoi_dung (nguoi_dung_id),
    KEY idx_nguoi_dung_da_doc (nguoi_dung_id, da_doc),
    KEY idx_ngay_tao (ngay_tao),
    CONSTRAINT fk_thong_bao_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Cột mới (thêm khi chưa có)
SET @co = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao' AND COLUMN_NAME = 'tone');
SET @sql = IF(@co = 0,
  'ALTER TABLE thong_bao ADD COLUMN tone VARCHAR(20) NULL DEFAULT NULL COMMENT ''Màu ô biểu tượng: info | warning | danger | success'' AFTER loai_thong_bao',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @co = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao' AND COLUMN_NAME = 'duong_dan');
SET @sql = IF(@co = 0,
  'ALTER TABLE thong_bao ADD COLUMN duong_dan VARCHAR(255) NULL DEFAULT NULL COMMENT ''Đường dẫn trong ứng dụng mở khi bấm'' AFTER noi_dung',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @co = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao' AND COLUMN_NAME = 'kho_id');
SET @sql = IF(@co = 0,
  'ALTER TABLE thong_bao ADD COLUMN kho_id INT NULL DEFAULT NULL COMMENT ''Kho liên quan'' AFTER id_tham_chieu',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @co = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao' AND COLUMN_NAME = 'khoa_su_kien');
SET @sql = IF(@co = 0,
  'ALTER TABLE thong_bao ADD COLUMN khoa_su_kien VARCHAR(100) NULL DEFAULT NULL COMMENT ''Khóa sự kiện, vd. PCK:12:DUYET; trống = dòng có sẵn từ trước, không hiện ở chuông'' AFTER kho_id',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 3. Khóa duy nhất, chỉ mục, khóa ngoại tới kho
SET @co = (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao' AND INDEX_NAME = 'uk_thong_bao_nguoi_su_kien');
SET @sql = IF(@co = 0,
  'ALTER TABLE thong_bao ADD UNIQUE KEY uk_thong_bao_nguoi_su_kien (nguoi_dung_id, khoa_su_kien)',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @co = (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao' AND INDEX_NAME = 'idx_thong_bao_nguoi_doc_tao');
SET @sql = IF(@co = 0,
  'ALTER TABLE thong_bao ADD KEY idx_thong_bao_nguoi_doc_tao (nguoi_dung_id, da_doc, ngay_tao)',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @co = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao' AND CONSTRAINT_NAME = 'fk_thong_bao_kho');
SET @sql = IF(@co = 0,
  'ALTER TABLE thong_bao ADD CONSTRAINT fk_thong_bao_kho FOREIGN KEY (kho_id) REFERENCES kho (id) ON DELETE SET NULL',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Kiểm sau khi chạy: đủ 4 cột mới (co_du_cot = 4), có khóa duy nhất và khóa ngoại tới kho
SELECT COUNT(*) AS co_du_cot FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao'
   AND COLUMN_NAME IN ('tone', 'duong_dan', 'kho_id', 'khoa_su_kien');
SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_bao';
SELECT COUNT(*) AS dong_co_san_khong_hien_o_chuong FROM thong_bao WHERE khoa_su_kien IS NULL;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION sql_safe_updates = @an_toan_cu;
SET @cho_khoa_cu = NULL, @cho_khoa_dong_cu = NULL, @an_toan_cu = NULL;
