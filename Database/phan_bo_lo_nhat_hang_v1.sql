-- =====================================================================
-- NHẶT HÀNG THEO LÔ (Log 2 / Log 4)
--   Lô được phân bổ ngay trên phiếu nhặt (gợi ý FIFO theo ngày lô nhập kho, người nhặt sửa tay được).
--   Hoàn tất nhặt chia lô cho từng đơn và sinh phiếu xuất bán hàng có sẵn dòng lô; phiếu xuất bán hàng
--   không còn bước chọn lô (trừ quản lý kho sửa lô nhầm).
--   Phân bổ của phiếu nhặt đang mở (cho_nhat / dang_nhat) GIỮ lô: phiếu nhặt khác, chuyển kho và POS
--   chỉ thấy phần còn lại. Không cộng vào ton_kho_theo_lo.so_luong_da_dat (tồn đẩy lên sàn đã trừ theo
--   đơn đang giữ hàng, cộng thêm là trừ hai lần).
--
-- THỨ TỰ TRIỂN KHAI: dừng backend cũ → chạy script này → chạy huy_phieu_xuat_ban_chua_lo_v1.sql
--   → chạy backend mới. Chạy lại nhiều lần an toàn.
-- =====================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `phan_bo_lo_nhat_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `chi_tiet_nhat_hang_id` int NOT NULL COMMENT 'Dòng sản phẩm của phiếu nhặt',
  `lo_hang_id` int NOT NULL COMMENT 'Lô lấy hàng',
  `so_luong` decimal(15,3) NOT NULL COMMENT 'Số lượng lấy từ lô này; tổng các lô của một dòng = so_luong_can_nhat',
  `nguoi_cap_nhat_id` int DEFAULT NULL COMMENT 'Người lưu phân bổ gần nhất (NULL = hệ thống gợi ý FIFO)',
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phan_bo_dong_lo` (`chi_tiet_nhat_hang_id`, `lo_hang_id`),
  KEY `fk_phan_bo_lo_hang` (`lo_hang_id`),
  KEY `fk_phan_bo_nguoi_cap_nhat` (`nguoi_cap_nhat_id`),
  CONSTRAINT `fk_phan_bo_chi_tiet_nhat_hang` FOREIGN KEY (`chi_tiet_nhat_hang_id`)
      REFERENCES `chi_tiet_nhat_hang` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_phan_bo_lo_hang` FOREIGN KEY (`lo_hang_id`) REFERENCES `lo_hang` (`id`),
  CONSTRAINT `fk_phan_bo_nguoi_cap_nhat` FOREIGN KEY (`nguoi_cap_nhat_id`) REFERENCES `nguoi_dung` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Phân bổ lô cho từng dòng phiếu nhặt (giữ lô khi phiếu nhặt đang mở)';

-- Kiểm tra
SELECT COUNT(*) AS so_dong_phan_bo FROM phan_bo_lo_nhat_hang;
