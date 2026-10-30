-- =====================================================================
-- Phiên đăng nhập theo thiết bị (bảng phien_dang_nhap) – 2026-10-30
--
-- Nền cho màn "Bảo mật & Thiết bị": mỗi lần đăng nhập ghi một dòng (thiết bị, IP, thời gian); JWT mang mã phiên
-- qua claim "sid"; AuthInterceptor đối chiếu mỗi request để biết phiên còn hiệu lực hay đã bị thu hồi (đăng xuất,
-- đổi/đặt lại mật khẩu). Chỉ TẠO BẢNG MỚI, không đụng bảng/dữ liệu nào khác.
--
-- THỨ TỰ KHI TRIỂN KHAI: tệp này → backend mới → frontend mới. Backend mới VẪN CHẠY khi CHƯA chạy tệp này:
--   không ghi được phiên thì token phát hành KHÔNG kèm sid và AuthInterceptor bỏ qua bước kiểm phiên (đăng nhập
--   vẫn bình thường, chỉ chưa có danh sách thiết bị / đăng xuất từ xa). Chạy tệp này xong thì các lần đăng nhập mới
--   bắt đầu được ghi phiên.
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

CREATE TABLE IF NOT EXISTS phien_dang_nhap (
    id             INT          NOT NULL AUTO_INCREMENT,
    phien_id       VARCHAR(36)  NOT NULL COMMENT 'Mã phiên ngẫu nhiên (UUID), nhúng vào JWT dưới claim sid',
    nguoi_dung_id  INT          NOT NULL COMMENT 'Chủ phiên',
    user_agent     VARCHAR(512) DEFAULT NULL COMMENT 'Chuỗi User-Agent của trình duyệt/thiết bị lúc đăng nhập',
    dia_chi_ip     VARCHAR(64)  DEFAULT NULL COMMENT 'IP thật của client lúc đăng nhập',
    vi_tri         VARCHAR(128) DEFAULT NULL COMMENT 'Vị trí suy ra từ IP — để đợt sau (GeoIP)',
    tao_luc        DATETIME     NOT NULL COMMENT 'Thời điểm đăng nhập',
    truy_cap_cuoi  DATETIME     NOT NULL COMMENT 'Lần hoạt động gần nhất (cập nhật ở đợt sau)',
    het_han_luc    DATETIME     NOT NULL COMMENT 'Thời điểm phiên hết hạn (= tạo lúc + 24 giờ, khớp hạn JWT)',
    thu_hoi_luc    DATETIME     DEFAULT NULL COMMENT 'NULL = còn hiệu lực; có giá trị = đã đăng xuất / bị thu hồi',
    PRIMARY KEY (id),
    UNIQUE KEY uq_phien_id (phien_id),
    KEY idx_phien_nguoi_dung (nguoi_dung_id, thu_hoi_luc),
    CONSTRAINT fk_phien_nguoi_dung FOREIGN KEY (nguoi_dung_id) REFERENCES nguoi_dung (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kiểm sau khi chạy: bảng đã tồn tại
SELECT COUNT(*) AS co_bang_phien_dang_nhap FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phien_dang_nhap';

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET @cho_khoa_cu = NULL, @cho_khoa_dong_cu = NULL;
