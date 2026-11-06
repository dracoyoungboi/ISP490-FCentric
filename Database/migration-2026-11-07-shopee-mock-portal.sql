-- ==============================================================================
-- MIGRATION: KHỞI TẠO CƠ SỞ DỮ LIỆU CỔNG GIẢ LẬP SHOPEE SANDBOX INTERACTIVE PORTAL
-- Kiến trúc: Dual-Facing Isolated Mock State Engine chuẩn Shopee Open Platform API v2
-- Tương thích 100% MySQL 8.x và kiến trúc đa kênh Omnichannel của FCentric
-- ==============================================================================

-- 1. Bảng lưu trữ sản phẩm & tồn kho hiện hành trên sàn Shopee Mock
CREATE TABLE IF NOT EXISTS `shopee_mock_product` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `item_id` BIGINT NOT NULL COMMENT 'Mã sản phẩm trên Shopee (Shopee Item ID)',
  `model_id` BIGINT NOT NULL COMMENT 'Mã biến thể/phân loại hàng trên Shopee (Shopee Model ID)',
  `item_sku` VARCHAR(100) NOT NULL COMMENT 'Mã SKU cha của sản phẩm',
  `model_sku` VARCHAR(100) NOT NULL COMMENT 'Mã SKU biến thể (khớp với ma_sku của BienTheSanPham trong FCentric)',
  `item_name` VARCHAR(255) NOT NULL COMMENT 'Tên sản phẩm hiển thị trên Shopee Mall',
  `tier_variation` VARCHAR(100) COMMENT 'Tên biến thể, ví dụ: Màu Đen - Size M',
  `price` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Giá niêm yết trên Shopee',
  `stock_quantity` INT NOT NULL DEFAULT 0 COMMENT 'Số tồn sàn hiện hành (cập nhật từ FCentric đẩy sang)',
  `image_url` TEXT COMMENT 'Ảnh sản phẩm hiển thị trên sàn',
  `trang_thai` VARCHAR(50) DEFAULT 'NORMAL' COMMENT 'Trạng thái hiển thị: NORMAL, BANNED, UNLIST',
  `ngay_cap_nhat` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_shopee_item_model` (`item_id`, `model_id`),
  INDEX `idx_shopee_model_sku` (`model_sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng lưu trữ đơn hàng do Buyer đặt hoặc Seller thao tác trên Shopee Mock
CREATE TABLE IF NOT EXISTS `shopee_mock_order` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_sn` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã đơn Shopee duy nhất (VD: 241107SHP10294A)',
  `order_status` VARCHAR(50) NOT NULL DEFAULT 'READY_TO_SHIP' COMMENT 'Mã trạng thái chuẩn v2: UNPAID, READY_TO_SHIP, PROCESSED, SHIPPED, CANCELLED, COMPLETED',
  `buyer_name` VARCHAR(100) NOT NULL COMMENT 'Họ tên người mua hàng',
  `buyer_phone` VARCHAR(30) COMMENT 'Số điện thoại người mua',
  `shipping_address` TEXT NOT NULL COMMENT 'Địa chỉ nhận hàng chi tiết',
  `payment_method` VARCHAR(50) DEFAULT 'CASH_ON_DELIVERY' COMMENT 'Phương thức thanh toán: CASH_ON_DELIVERY, SHOPEE_PAY',
  `tracking_number` VARCHAR(50) COMMENT 'Mã vận đơn bưu cục (VD: SPXVN091823746B)',
  `shipping_carrier` VARCHAR(50) DEFAULT 'Shopee Xpress' COMMENT 'Đơn vị vận chuyển',
  `total_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng giá trị thanh toán đơn hàng',
  `shipping_fee` DECIMAL(15,2) DEFAULT 25000.00 COMMENT 'Cước phí vận chuyển',
  `items_json` JSON NOT NULL COMMENT 'Chi tiết các mặt hàng trong đơn định dạng JSON',
  `cancel_reason` VARCHAR(255) COMMENT 'Lý do hủy đơn',
  `cancel_user` VARCHAR(50) COMMENT 'Đối tượng yêu cầu hủy: BUYER hoặc SELLER',
  `create_time` BIGINT NOT NULL COMMENT 'Thời điểm đặt đơn (Unix timestamp giây)',
  `update_time` BIGINT NOT NULL COMMENT 'Thời điểm cập nhật trạng thái đơn (Unix timestamp giây)',
  INDEX `idx_shopee_order_status` (`order_status`),
  INDEX `idx_shopee_order_create` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

