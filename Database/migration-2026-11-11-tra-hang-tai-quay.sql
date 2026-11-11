-- =====================================================================
-- Trả hàng tại quầy POS (đặc tả BA "Trả hàng / Đổi hàng tại POS") – 2026-11-11
--
-- Thu ngân ở bất kỳ cửa hàng nào (cửa hàng B) nhận lại hàng của một hóa đơn POS đã thanh toán (bán ở cửa hàng A):
--   * phieu_tra_hang (RET-YYYYMMDD-XXXX): chứng từ trả, tham chiếu đơn gốc, cửa hàng bán / cửa hàng nhận, tiền hoàn,
--     cách hoàn (tiền mặt / chuyển khoản kèm thông tin tài khoản và mã giao dịch), duyệt quá hạn.
--   * chi_tiet_phieu_tra_hang: từng dòng hàng trả — số lượng, đơn giá hoàn, hiện trạng QC (dat / loi), kệ cất, lý do.
--   * chi_tiet_phieu_tra_hang_lo: phần lô của mỗi dòng (lô lấy từ phiếu xuất của đơn gốc) để biết lô nào đã trả,
--     giá vốn hàng trả.
--   * yeu_cau_duyet_tra_hang (+ _ma): yêu cầu quản lý duyệt khi đơn quá 03 ngày; mỗi quản lý nhận một mã PIN riêng qua
--     email, mã lưu dạng băm.
--   * don_ban_hang.trang_thai_tra_hang: NULL | tra_mot_phan (PARTIALLY_RETURNED) | da_tra_het (RETURNED).
--     KHÔNG đổi don_ban_hang.trang_thai (đơn POS vẫn 5): báo cáo doanh thu bỏ hẳn đơn trạng thái 6, đổi sang 6 sẽ vừa
--     mất doanh thu cả đơn vừa trừ thêm phần trả lại.
-- Phiếu nhập hàng bán trả lại PN-RET-YYYYMMDD-XXXX dùng bảng phieu_nhap_kho sẵn có (trạng thái 3 Hoàn tất), nối qua
-- phieu_tra_hang.phieu_nhap_kho_id. Phiếu chỉ có hàng Đạt; hàng lỗi để riêng, không vào tồn.
--
-- THỨ TỰ KHI TRIỂN KHAI: tệp này → backend mới → frontend mới. Chỉ thêm bảng và một cột NULL (MySQL 8 thêm tức thì),
-- backend cũ vẫn chạy bình thường.
-- CHẠY MỘT LẦN. Chạy lại sẽ dừng ở bước kiểm tra và không đổi gì.
-- Cách chạy: mysql --default-character-set=utf8mb4 fashion_system < tệp này; Workbench: chạy cả tệp (có DELIMITER).
-- =====================================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS migrate_tra_hang_tai_quay_20261111;

DELIMITER $$
CREATE PROCEDURE migrate_tra_hang_tai_quay_20261111()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = DATABASE() AND table_name = 'pos_payment') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chua chay pos_checkout_v1.sql (thieu bang pos_payment)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = 'phieu_tra_hang') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bang phieu_tra_hang da co: migration nay da chay';
  END IF;

  ALTER TABLE don_ban_hang
    ADD COLUMN trang_thai_tra_hang VARCHAR(20) NULL DEFAULT NULL
      COMMENT 'Tra hang tai quay: NULL chua tra | tra_mot_phan | da_tra_het (khong doi trang_thai cua don)';

  CREATE TABLE yeu_cau_duyet_tra_hang (
    id               INT          NOT NULL AUTO_INCREMENT,
    don_ban_hang_id  INT          NOT NULL,
    kho_id           INT          NOT NULL COMMENT 'Cua hang nhan tra (quan ly cua kho nay nhan ma)',
    nguoi_yeu_cau_id INT          NOT NULL,
    ly_do            VARCHAR(255) NOT NULL,
    trang_thai       VARCHAR(20)  NOT NULL DEFAULT 'cho_nhap'
                     COMMENT 'cho_nhap | da_duyet | da_dung | het_luot | da_thay',
    so_lan_sai       INT          NOT NULL DEFAULT 0,
    het_han_luc      DATETIME     NOT NULL COMMENT 'Han nhap ma',
    nguoi_duyet_id   INT          NULL COMMENT 'Quan ly co ma vua nhap dung',
    duyet_luc        DATETIME     NULL,
    ngay_tao         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ycdth_don (don_ban_hang_id),
    CONSTRAINT fk_ycdth_don FOREIGN KEY (don_ban_hang_id) REFERENCES don_ban_hang (id),
    CONSTRAINT fk_ycdth_kho FOREIGN KEY (kho_id) REFERENCES kho (id),
    CONSTRAINT fk_ycdth_nguoi_yeu_cau FOREIGN KEY (nguoi_yeu_cau_id) REFERENCES nguoi_dung (id),
    CONSTRAINT fk_ycdth_nguoi_duyet FOREIGN KEY (nguoi_duyet_id) REFERENCES nguoi_dung (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE yeu_cau_duyet_tra_hang_ma (
    id                        INT          NOT NULL AUTO_INCREMENT,
    yeu_cau_duyet_tra_hang_id INT          NOT NULL,
    nguoi_dung_id             INT          NOT NULL COMMENT 'Quan ly nhan ma',
    ma_bam                    VARCHAR(100) NOT NULL COMMENT 'BCrypt cua ma PIN 6 so',
    PRIMARY KEY (id),
    UNIQUE KEY uk_ycdth_ma_nguoi (yeu_cau_duyet_tra_hang_id, nguoi_dung_id),
    CONSTRAINT fk_ycdth_ma_yeu_cau FOREIGN KEY (yeu_cau_duyet_tra_hang_id) REFERENCES yeu_cau_duyet_tra_hang (id)
      ON DELETE CASCADE,
    CONSTRAINT fk_ycdth_ma_nguoi FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE phieu_tra_hang (
    id                INT           NOT NULL AUTO_INCREMENT,
    so_phieu          VARCHAR(30)   NOT NULL COMMENT 'RET-YYYYMMDD-XXXX',
    request_id        VARCHAR(64)   NOT NULL COMMENT 'Khoa chong ghi hai lan (quay sinh, giu nguyen khi gui lai)',
    don_ban_hang_id   INT           NOT NULL COMMENT 'Don goc',
    kho_ban_id        INT           NOT NULL COMMENT 'Cua hang ban (A)',
    kho_nhan_id       INT           NOT NULL COMMENT 'Cua hang nhan tra (B)',
    phieu_nhap_kho_id INT           NULL COMMENT 'PN-RET (NULL khi chi co hang loi)',
    hinh_thuc         VARCHAR(20)   NOT NULL DEFAULT 'tra_hang' COMMENT 'tra_hang (doi_hang de dot sau)',
    tong_so_luong     DECIMAL(15,3) NOT NULL,
    so_luong_dat      DECIMAL(15,3) NOT NULL DEFAULT 0,
    so_luong_loi      DECIMAL(15,3) NOT NULL DEFAULT 0,
    tong_tien_hoan    DECIMAL(15,2) NOT NULL,
    phuong_thuc_hoan  VARCHAR(20)   NOT NULL COMMENT 'tien_mat | chuyen_khoan',
    ngan_hang         VARCHAR(100)  NULL,
    so_tai_khoan      VARCHAR(30)   NULL,
    ten_chu_tai_khoan VARCHAR(100)  NULL,
    ma_giao_dich      VARCHAR(100)  NULL COMMENT 'Ma giao dich ngan hang khi hoan chuyen khoan',
    qua_han           TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '1 = qua 03 ngay, da co quan ly duyet',
    yeu_cau_duyet_id  INT           NULL,
    nguoi_duyet_id    INT           NULL,
    ly_do_duyet       VARCHAR(255)  NULL,
    ghi_chu           VARCHAR(500)  NULL,
    nguoi_lap_id      INT           NOT NULL,
    ngay_tao          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_phieu_tra_hang_so_phieu (so_phieu),
    UNIQUE KEY uk_phieu_tra_hang_request (request_id),
    KEY idx_pth_don (don_ban_hang_id),
    KEY idx_pth_kho_ban_ngay (kho_ban_id, ngay_tao),
    KEY idx_pth_kho_nhan_ngay (kho_nhan_id, ngay_tao),
    CONSTRAINT fk_pth_don FOREIGN KEY (don_ban_hang_id) REFERENCES don_ban_hang (id),
    CONSTRAINT fk_pth_kho_ban FOREIGN KEY (kho_ban_id) REFERENCES kho (id),
    CONSTRAINT fk_pth_kho_nhan FOREIGN KEY (kho_nhan_id) REFERENCES kho (id),
    CONSTRAINT fk_pth_phieu_nhap FOREIGN KEY (phieu_nhap_kho_id) REFERENCES phieu_nhap_kho (id),
    CONSTRAINT fk_pth_yeu_cau FOREIGN KEY (yeu_cau_duyet_id) REFERENCES yeu_cau_duyet_tra_hang (id),
    CONSTRAINT fk_pth_nguoi_duyet FOREIGN KEY (nguoi_duyet_id) REFERENCES nguoi_dung (id),
    CONSTRAINT fk_pth_nguoi_lap FOREIGN KEY (nguoi_lap_id) REFERENCES nguoi_dung (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE chi_tiet_phieu_tra_hang (
    id                       INT           NOT NULL AUTO_INCREMENT,
    phieu_tra_hang_id        INT           NOT NULL,
    chi_tiet_don_ban_hang_id INT           NOT NULL COMMENT 'Dong cua don goc',
    bien_the_san_pham_id     INT           NOT NULL,
    so_luong                 DECIMAL(15,3) NOT NULL,
    don_gia_hoan             DECIMAL(15,2) NOT NULL COMMENT 'Gia thuc tra / 1 cai (sau giam gia dong)',
    thanh_tien_hoan          DECIMAL(15,2) NOT NULL,
    tinh_trang               VARCHAR(10)   NOT NULL COMMENT 'dat (ban lai duoc) | loi (de rieng)',
    vi_tri_kho_id            INT           NULL COMMENT 'Ke cat hang khi dat (NULL = hang chua co ke)',
    ly_do                    VARCHAR(30)   NOT NULL,
    nhom_loi                 VARCHAR(30)   NULL,
    ghi_chu                  VARCHAR(255)  NULL,
    PRIMARY KEY (id),
    KEY idx_ctpth_dong_don (chi_tiet_don_ban_hang_id),
    CONSTRAINT fk_ctpth_phieu FOREIGN KEY (phieu_tra_hang_id) REFERENCES phieu_tra_hang (id) ON DELETE CASCADE,
    CONSTRAINT fk_ctpth_dong_don FOREIGN KEY (chi_tiet_don_ban_hang_id) REFERENCES chi_tiet_don_ban_hang (id),
    CONSTRAINT fk_ctpth_bien_the FOREIGN KEY (bien_the_san_pham_id) REFERENCES bien_the_san_pham (id),
    CONSTRAINT fk_ctpth_vi_tri FOREIGN KEY (vi_tri_kho_id) REFERENCES vi_tri_kho (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE chi_tiet_phieu_tra_hang_lo (
    id                         INT           NOT NULL AUTO_INCREMENT,
    chi_tiet_phieu_tra_hang_id INT           NOT NULL,
    lo_hang_id                 INT           NOT NULL,
    so_luong                   DECIMAL(15,3) NOT NULL,
    gia_von                    DECIMAL(15,2) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_ctpthl_lo (lo_hang_id),
    CONSTRAINT fk_ctpthl_dong FOREIGN KEY (chi_tiet_phieu_tra_hang_id) REFERENCES chi_tiet_phieu_tra_hang (id)
      ON DELETE CASCADE,
    CONSTRAINT fk_ctpthl_lo FOREIGN KEY (lo_hang_id) REFERENCES lo_hang (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
END$$
DELIMITER ;

CALL migrate_tra_hang_tai_quay_20261111();
DROP PROCEDURE migrate_tra_hang_tai_quay_20261111;

-- Kiểm tra: một dòng trang_thai_tra_hang varchar(20) NULL, và đủ 5 bảng mới
SHOW COLUMNS FROM don_ban_hang LIKE 'trang_thai_tra_hang';
SELECT table_name FROM information_schema.tables
 WHERE table_schema = DATABASE()
   AND table_name IN ('phieu_tra_hang', 'chi_tiet_phieu_tra_hang', 'chi_tiet_phieu_tra_hang_lo',
                      'yeu_cau_duyet_tra_hang', 'yeu_cau_duyet_tra_hang_ma');
