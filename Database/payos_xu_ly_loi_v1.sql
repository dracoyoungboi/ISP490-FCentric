-- ============================================================================
-- PAYOS — Xử lý giao dịch chuyển khoản lỗi (PAID_ERROR) v1
-- Thêm cột vào pos_payos_payment, KHÔNG xóa dữ liệu. Chạy lại nhiều lần an toàn.
-- Chạy SAU payos_v1.sql và TRƯỚC khi lên backend mới (ddl-auto=none: thiếu cột là
-- mọi API chuyển khoản tại quầy lỗi Unknown column).
--
-- Trạng thái mới: REFUNDED — quản lý đã tự hoàn tiền cho khách qua ngân hàng (từ PAID_ERROR).
-- PAID_ERROR -> PAID nếu quản lý bấm "Tạo đơn bán" (đủ tiền, còn hàng).
-- ============================================================================
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS payos_xu_ly_loi_v1;
DELIMITER //
CREATE PROCEDURE payos_xu_ly_loi_v1()
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'pos_payos_payment' AND column_name = 'so_tien_da_nhan') = 0 THEN
        ALTER TABLE pos_payos_payment
            ADD COLUMN so_tien_da_nhan DECIMAL(15,2) NULL COMMENT 'Số tiền payOS báo đã nhận (webhook/hỏi trạng thái)' AFTER so_tien;
    END IF;

    -- Cờ "hàng còn đang giữ chỗ" (so_luong_da_dat). Mọi đường trả chỗ đọc cờ này để không trả 2 lần:
    -- PAID_ERROR có thể đến từ PENDING (còn giữ) hoặc từ CANCELLED/EXPIRED (đã trả).
    -- Chỉ điền giá trị ban đầu NGAY LÚC tạo cột, chạy lại không ghi đè. PAID_ERROR cũ để 0 vì không biết
    -- đi từ trạng thái nào: đánh nhầm 1 thì lúc xử lý sẽ trừ giữ chỗ của giao dịch khác (bán quá tồn), còn
    -- để 0 thì tệ nhất là phần giữ chỗ còn treo, soát tay được (xem truy vấn kiểm tra cuối file).
    IF (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'pos_payos_payment' AND column_name = 'dang_giu_cho') = 0 THEN
        ALTER TABLE pos_payos_payment
            ADD COLUMN dang_giu_cho TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1: hàng của giao dịch còn đang giữ chỗ' AFTER giu_cho_json;
        UPDATE pos_payos_payment SET dang_giu_cho = 1 WHERE trang_thai = 'PENDING';
    END IF;

    IF (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'pos_payos_payment' AND column_name = 'nguoi_xu_ly_id') = 0 THEN
        ALTER TABLE pos_payos_payment
            ADD COLUMN nguoi_xu_ly_id INT NULL COMMENT 'Quản lý xử lý giao dịch lỗi' AFTER error_message,
            ADD COLUMN xu_ly_luc DATETIME NULL AFTER nguoi_xu_ly_id,
            ADD COLUMN ghi_chu_xu_ly VARCHAR(500) NULL AFTER xu_ly_luc,
            ADD CONSTRAINT fk_pos_payos_payment_nguoi_xu_ly FOREIGN KEY (nguoi_xu_ly_id) REFERENCES nguoi_dung (id);
    END IF;

    -- Tài khoản khách đã chuyển (payOS gửi kèm thông báo tiền về): để quản lý trả lại tiền đúng chỗ.
    -- Thông tin cá nhân — API chỉ trả cho quản trị viên.
    IF (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'pos_payos_payment' AND column_name = 'ten_nguoi_chuyen') = 0 THEN
        ALTER TABLE pos_payos_payment
            ADD COLUMN ten_nguoi_chuyen VARCHAR(200) NULL COMMENT 'Tên chủ tài khoản đã chuyển (payOS counterAccountName)' AFTER ma_giao_dich_ngan_hang,
            ADD COLUMN ngan_hang_nguoi_chuyen VARCHAR(100) NULL COMMENT 'Ngân hàng người chuyển (tên hoặc mã BIN)' AFTER ten_nguoi_chuyen,
            ADD COLUMN so_tk_nguoi_chuyen VARCHAR(50) NULL COMMENT 'Số tài khoản người chuyển' AFTER ngan_hang_nguoi_chuyen;
    END IF;

    -- Tiền về khi mã QR đã bị hủy/hết hạn (chốt lúc thành PAID_ERROR): thu ngân có thể đã bán món đó bằng
    -- cách khác -> màn đối soát bắt quản lý xác nhận trước khi tạo đơn. Không suy ngược được sau khi xử lý.
    IF (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'pos_payos_payment' AND column_name = 'tien_ve_sau_huy') = 0 THEN
        ALTER TABLE pos_payos_payment
            ADD COLUMN tien_ve_sau_huy TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1: tiền về khi mã QR đã hủy/hết hạn' AFTER dang_giu_cho;
    END IF;
END //
DELIMITER ;

CALL payos_xu_ly_loi_v1();
DROP PROCEDURE IF EXISTS payos_xu_ly_loi_v1;

-- Kiểm tra:
-- SHOW COLUMNS FROM pos_payos_payment LIKE 'so_tien_da_nhan';   -- 1 dòng
-- SELECT trang_thai, dang_giu_cho, COUNT(*) FROM pos_payos_payment GROUP BY trang_thai, dang_giu_cho;
--   PENDING -> 1, các trạng thái khác -> 0
-- PAID_ERROR có từ trước (bản DB 24/10/2026: 0 dòng) cần soát tay trước khi quản lý xử lý:
-- SELECT order_code, so_tien, error_message, giu_cho_json FROM pos_payos_payment WHERE trang_thai = 'PAID_ERROR';
--   Dòng nào chắc chắn đi từ PENDING (lỗi khi tiền về, mã QR chưa hủy/hết hạn) mới đặt dang_giu_cho = 1.
