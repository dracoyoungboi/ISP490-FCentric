-- =====================================================================
-- Một lô xếp vào nhiều kệ khi kiểm đếm phiếu nhập – 2026-11-20
--
-- Trước đây lô chỉ gắn một kệ (lo_hang.vi_tri_kho_id), nên lô có số đạt lớn hơn chỗ trống của mọi kệ (lô 151 cái, kệ
-- tối đa 150) không khóa được. Tệp này thêm bảng lo_hang_ke_nhap: phần hàng đạt của lô xếp vào từng kệ.
--   - Bảng chỉ có dòng khi lô xếp vào từ HAI kệ trở lên. Lô một kệ giữ cách cũ (lo_hang.vi_tri_kho_id, số đạt của lô),
--     nên dữ liệu đang có không phải chép sang, và backend cũ ghi lô một kệ vẫn đúng.
--   - Lô nhiều kệ: lo_hang.vi_tri_kho_id là kệ chính (kệ quét đầu tiên), tổng so_luong các dòng bằng số đạt của lô.
--   - Dòng giữ lại sau khi nhập kho để xem lô đã xếp vào đâu. Sổ tồn kệ (ton_kho_vi_tri) vẫn là nơi tính tồn.
--   - Xóa theo lô (ON DELETE CASCADE) và theo kệ (kệ chỉ xóa được khi không còn lô chờ nhập trỏ tới).
--
-- THỨ TỰ KHI TRIỂN KHAI: tệp này → backend mới → frontend mới. Backend cũ không đọc bảng này: chạy tệp này xong vẫn
-- chạy được, chỉ chưa khóa được lô nhiều kệ. Backend mới mà chưa chạy tệp này thì khóa lô và danh sách kệ báo lỗi.
--
-- CHẠY MỘT LẦN. Chạy lại sẽ dừng ở bước kiểm tra và không đổi gì.
-- Cách chạy: mysql --default-character-set=utf8mb4 fashion_system < tệp này; Workbench: chạy cả tệp (có DELIMITER).
-- Gỡ (khi quay về bản cũ, chỉ khi chưa có lô nhiều kệ cần giữ): DROP TABLE lo_hang_ke_nhap;
-- =====================================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS migrate_lo_nhieu_ke_20261120;

DELIMITER $$
CREATE PROCEDURE migrate_lo_nhieu_ke_20261120()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = 'lo_hang_ke_nhap') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bang lo_hang_ke_nhap da co: migration nay da chay';
  END IF;

  CREATE TABLE lo_hang_ke_nhap (
    id INT NOT NULL AUTO_INCREMENT,
    lo_hang_id INT NOT NULL,
    vi_tri_kho_id INT NOT NULL,
    so_luong INT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_lo_hang_ke_nhap (lo_hang_id, vi_tri_kho_id),
    KEY idx_lo_hang_ke_nhap_ke (vi_tri_kho_id),
    CONSTRAINT chk_lo_hang_ke_nhap_so CHECK (so_luong > 0),
    CONSTRAINT fk_lo_hang_ke_nhap_lo FOREIGN KEY (lo_hang_id) REFERENCES lo_hang(id) ON DELETE CASCADE,
    CONSTRAINT fk_lo_hang_ke_nhap_ke FOREIGN KEY (vi_tri_kho_id) REFERENCES vi_tri_kho(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    COMMENT='Phan hang dat cua lo xep vao tung ke khi lo xep tu hai ke tro len';
END$$
DELIMITER ;

CALL migrate_lo_nhieu_ke_20261120();
DROP PROCEDURE migrate_lo_nhieu_ke_20261120;

-- Kiểm tra: phải ra bảng có 4 cột id, lo_hang_id, vi_tri_kho_id, so_luong
SHOW CREATE TABLE lo_hang_ke_nhap;
