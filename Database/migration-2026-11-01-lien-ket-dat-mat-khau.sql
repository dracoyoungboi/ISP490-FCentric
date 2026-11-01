-- =====================================================================
-- Liên kết đặt mật khẩu dùng một lần (bảng lien_ket_dat_mat_khau) – 2026-11-01
--
-- Sửa lỗi L4 (rà soát email 23/10): email tạo tài khoản (E2) và cấp lại mật khẩu (E3) không còn chứa mật khẩu tạm,
-- thay bằng liên kết tới trang /set-password, dùng một lần, hết hạn sau 24 giờ. Bảng chỉ giữ SHA-256 của mã trong
-- liên kết (mã gốc chỉ nằm trong email). Chỉ TẠO BẢNG MỚI, không đụng bảng/dữ liệu nào khác.
--
-- THỨ TỰ KHI TRIỂN KHAI: tệp này → backend mới → frontend mới. Backend mới cần bảng này để tạo tài khoản và
-- cấp lại mật khẩu (thiếu bảng thì hai thao tác đó báo lỗi, các chức năng khác vẫn chạy).
-- Liên kết trong email trỏ https://fcentric.net/set-password: trước khi fcentric.net chạy bản mới (có trang và API
-- đặt mật khẩu), KHÔNG tạo tài khoản / cấp lại mật khẩu từ backend máy cá nhân dùng chung CSDL (người nhận sẽ
-- không đặt được mật khẩu vì không còn mật khẩu tạm).
-- Tài khoản đang có mật khẩu tạm từ trước giữ nguyên (chốt 01/11/2026, Đ3): backend chặn mọi API trừ đổi mật khẩu
-- cho tới khi họ đổi.
--
-- Chạy lại nhiều lần không lỗi (đã có bảng thì bỏ qua), không cần chế độ xem trước.
-- Lỗi giữa chừng (vd. 1205 vì còn kết nối giữ bảng): tắt kết nối đó rồi chạy lại cả tệp trong cùng tab.
-- =====================================================================

SET NAMES utf8mb4;           -- tránh lỗi mã chữ tiếng Việt trong COMMENT

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

-- Chống treo: chỉ chờ khóa tối đa 5 giây; còn kết nối giữ bảng thì báo 1205 và KHÔNG đổi gì (tắt kết nối rồi chạy lại).
SET @cho_khoa_cu = IFNULL(@cho_khoa_cu, @@SESSION.lock_wait_timeout);
SET @cho_khoa_dong_cu = IFNULL(@cho_khoa_dong_cu, @@SESSION.innodb_lock_wait_timeout);
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;

CREATE TABLE IF NOT EXISTS lien_ket_dat_mat_khau (
    id             INT          NOT NULL AUTO_INCREMENT,
    nguoi_dung_id  INT          NOT NULL COMMENT 'Tài khoản được đặt mật khẩu',
    ma_bam         CHAR(64)     NOT NULL COMMENT 'SHA-256 (hex) của mã trong liên kết; mã gốc chỉ nằm trong email',
    muc_dich       VARCHAR(20)  NOT NULL COMMENT 'TAO_TAI_KHOAN (email E2) | CAP_LAI (email E3)',
    tao_luc        DATETIME     NOT NULL COMMENT 'Thời điểm tạo liên kết',
    het_han_luc    DATETIME     NOT NULL COMMENT 'Hết hạn (= tạo lúc + 24 giờ)',
    da_dung_luc    DATETIME     DEFAULT NULL COMMENT 'NULL = chưa dùng; có giá trị = đã dùng để đặt mật khẩu',
    huy_luc        DATETIME     DEFAULT NULL COMMENT 'NULL = còn hiệu lực; có giá trị = đã hủy (liên kết mới hơn, hoặc mật khẩu đổi cách khác)',
    tao_boi        INT          DEFAULT NULL COMMENT 'Quản trị viên tạo liên kết',
    PRIMARY KEY (id),
    UNIQUE KEY uq_lien_ket_ma_bam (ma_bam),
    KEY idx_lien_ket_nguoi_dung (nguoi_dung_id, da_dung_luc, huy_luc),
    CONSTRAINT fk_lien_ket_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kiểm sau khi chạy: bảng đã tồn tại
SELECT COUNT(*) AS co_bang_lien_ket_dat_mat_khau FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lien_ket_dat_mat_khau';

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET @cho_khoa_cu = NULL, @cho_khoa_dong_cu = NULL;
