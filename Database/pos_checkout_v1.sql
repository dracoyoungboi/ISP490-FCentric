-- ============================================================================
-- POS CHECKOUT — Migration additive v1 (Phase 03)
-- Chỉ tạo bảng mới + sửa COMMENT cột (không đổi kiểu/dữ liệu).
-- KHÔNG có DROP TABLE, không sửa bảng nghiệp vụ cũ, dữ liệu cũ được bảo toàn.
-- Chạy thủ công trên DB mục tiêu (ddl-auto=none), sau khi backup.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Bảng lưu yêu cầu thanh toán POS (neo idempotency — không chỉ là cờ paid)
--    request_id UNIQUE là chốt chặn race tại DB: cùng key + cùng payload trả
--    kết quả đã lưu; cùng key + khác payload báo xung đột (409).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_checkout_request (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    request_id       VARCHAR(64)  NOT NULL,
    request_hash     VARCHAR(64)  NOT NULL,
    kho_id           INT          NOT NULL,
    don_ban_hang_id  INT          NULL,
    trang_thai       VARCHAR(20)  NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING | SUCCESS | FAILED',
    result_json      LONGTEXT     NULL COMMENT 'Response checkout đã lưu để phục hồi sau timeout',
    error_message    VARCHAR(500) NULL COMMENT 'Lỗi nghiệp vụ xác định (FAILED)',
    nguoi_thu_ngan_id INT        NULL,
    ngay_tao         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pos_checkout_request_request_id (request_id),
    KEY idx_pos_checkout_request_trang_thai (trang_thai),
    CONSTRAINT fk_pos_checkout_request_don FOREIGN KEY (don_ban_hang_id)
        REFERENCES don_ban_hang (id),
    CONSTRAINT fk_pos_checkout_request_kho FOREIGN KEY (kho_id)
        REFERENCES kho (id),
    CONSTRAINT fk_pos_checkout_request_nguoi FOREIGN KEY (nguoi_thu_ngan_id)
        REFERENCES nguoi_dung (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Sổ thu tiền mặt POS (chứng từ thanh toán có thể đối soát)
--    request_id UNIQUE: mỗi yêu cầu thanh toán có đúng một phiếu thu.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_payment (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    request_id       VARCHAR(64)   NOT NULL,
    don_ban_hang_id  INT           NOT NULL,
    phuong_thuc      VARCHAR(20)   NOT NULL DEFAULT 'CASH',
    so_tien_hang     DECIMAL(15,2) NOT NULL COMMENT 'Tổng tiền hàng server tính (doanh thu ghi nhận)',
    so_tien_thu      DECIMAL(15,2) NOT NULL COMMENT 'Tiền khách đưa',
    so_tien_thua     DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Tiền thừa trả khách (KHÔNG phải doanh thu)',
    nguoi_thu_id     INT           NOT NULL,
    ngay_tao         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pos_payment_request_id (request_id),
    KEY idx_pos_payment_don (don_ban_hang_id),
    CONSTRAINT fk_pos_payment_request FOREIGN KEY (request_id)
        REFERENCES pos_checkout_request (request_id),
    CONSTRAINT fk_pos_payment_don FOREIGN KEY (don_ban_hang_id)
        REFERENCES don_ban_hang (id),
    CONSTRAINT fk_pos_payment_nguoi FOREIGN KEY (nguoi_thu_id)
        REFERENCES nguoi_dung (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. Chuẩn hóa COMMENT trạng thái cho khớp giá trị code đang chạy
--    (chỉ sửa comment, KHÔNG đổi giá trị/kiểu — dữ liệu giữ nguyên).
--    Code hiện hành: đơn 0 Nháp, 1 Chờ xuất kho, 2 Đang xuất kho, 3 Đã xuất
--    toàn bộ, 4 Đã hủy, 5 Hoàn thành, 6 Bị hoàn trả.
-- ---------------------------------------------------------------------------
ALTER TABLE don_ban_hang
    MODIFY COLUMN trang_thai tinyint(1) DEFAULT '0'
    COMMENT '0: Nháp, 1: Chờ xuất kho, 2: Đang xuất kho (một phần), 3: Đã xuất toàn bộ, 4: Đã hủy, 5: Hoàn thành, 6: Bị hoàn trả';

-- Phiếu xuất kho: 0 Nháp, 1 Chờ duyệt, 2 Đã duyệt, 3 Đã xuất, 4 Đã hủy, 5 Hoàn tất.
ALTER TABLE phieu_xuat_kho
    MODIFY COLUMN trang_thai tinyint(1) DEFAULT '0'
    COMMENT '0: Nháp, 1: Chờ duyệt, 2: Đã duyệt, 3: Đã xuất, 4: Đã hủy, 5: Hoàn tất';
