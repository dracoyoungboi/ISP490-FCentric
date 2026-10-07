-- ============================================================================
-- PAYOS — Migration additive v1
-- Thêm 2 bảng mới, KHÔNG sửa/xóa bảng hay dữ liệu cũ. Chạy lại nhiều lần an toàn.
-- Chạy SAU pos_checkout_v1.sql.
-- ============================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. Cấu hình cổng thanh toán (mỗi nhà cung cấp 1 dòng).
--    Client ID / API Key / Checksum Key lưu ĐÃ MÃ HÓA (AES-GCM, khóa lấy từ biến
--    môi trường PAYMENT_CONFIG_SECRET) — không bao giờ lưu dạng chữ thường.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cau_hinh_thanh_toan (
    id                      INT           NOT NULL AUTO_INCREMENT,
    nha_cung_cap            VARCHAR(20)   NOT NULL COMMENT 'PAYOS',
    kich_hoat               TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '1: đang dùng ở POS',
    client_id_ma_hoa        TEXT          NULL,
    api_key_ma_hoa          TEXT          NULL,
    checksum_key_ma_hoa     TEXT          NULL,
    thoi_gian_het_han_phut  INT           NOT NULL DEFAULT 15 COMMENT 'Mã QR hết hạn sau N phút',
    webhook_url             VARCHAR(500)  NULL,
    webhook_xac_nhan_luc    DATETIME      NULL COMMENT 'Lần đăng ký webhook thành công gần nhất',
    nguoi_cap_nhat_id       INT           NULL,
    ngay_tao                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_cau_hinh_thanh_toan_ncc (nha_cung_cap),
    CONSTRAINT fk_cau_hinh_thanh_toan_nguoi FOREIGN KEY (nguoi_cap_nhat_id)
        REFERENCES nguoi_dung (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Giao dịch chuyển khoản payOS tại quầy.
--    Vòng đời: PENDING (đã giữ chỗ hàng, chờ khách quét QR)
--      -> PAID       (đã nhận tiền, đã tạo đơn + trừ kho)
--      -> CANCELLED  (thu ngân hủy, đã trả hàng giữ chỗ)
--      -> EXPIRED    (quá hạn, đã trả hàng giữ chỗ)
--      -> FAILED     (không tạo được mã QR, đã trả hàng giữ chỗ)
--      -> PAID_ERROR (đã nhận tiền nhưng không tạo được đơn — cần quản lý xử lý)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_payos_payment (
    id                  BIGINT        NOT NULL AUTO_INCREMENT,
    order_code          BIGINT        NOT NULL COMMENT 'Mã đơn gửi payOS (duy nhất)',
    request_id          VARCHAR(64)   NOT NULL COMMENT 'requestId checkout POS (idempotency)',
    kho_id              INT           NOT NULL,
    nguoi_thu_ngan_id   INT           NOT NULL,
    so_tien             DECIMAL(15,2) NOT NULL,
    trang_thai          VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    payment_link_id     VARCHAR(64)   NULL,
    checkout_url        VARCHAR(500)  NULL,
    qr_code             TEXT          NULL,
    bin                 VARCHAR(20)   NULL,
    so_tai_khoan        VARCHAR(50)   NULL,
    ten_tai_khoan       VARCHAR(200)  NULL,
    noi_dung_ck         VARCHAR(50)   NULL,
    payload_json        LONGTEXT      NOT NULL COMMENT 'Giỏ hàng + giá đã chốt lúc tạo QR',
    giu_cho_json        LONGTEXT      NULL COMMENT 'Các lô đang giữ chỗ (so_luong_da_dat)',
    don_ban_hang_id     INT           NULL,
    result_json         LONGTEXT      NULL,
    ma_giao_dich_ngan_hang VARCHAR(100) NULL COMMENT 'reference từ webhook payOS',
    error_message       VARCHAR(500)  NULL,
    het_han_luc         DATETIME      NOT NULL,
    thanh_toan_luc      DATETIME      NULL,
    ngay_tao            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pos_payos_payment_order_code (order_code),
    KEY idx_pos_payos_payment_request (request_id),
    KEY idx_pos_payos_payment_trang_thai (trang_thai, het_han_luc),
    CONSTRAINT fk_pos_payos_payment_kho FOREIGN KEY (kho_id) REFERENCES kho (id),
    CONSTRAINT fk_pos_payos_payment_nguoi FOREIGN KEY (nguoi_thu_ngan_id) REFERENCES nguoi_dung (id),
    CONSTRAINT fk_pos_payos_payment_don FOREIGN KEY (don_ban_hang_id) REFERENCES don_ban_hang (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Dòng cấu hình payOS mặc định (tắt, chưa có khóa) — admin nhập khóa ở trang Cài đặt.
INSERT INTO cau_hinh_thanh_toan (nha_cung_cap, kich_hoat)
SELECT 'PAYOS', 0
WHERE NOT EXISTS (SELECT 1 FROM cau_hinh_thanh_toan WHERE nha_cung_cap = 'PAYOS');
