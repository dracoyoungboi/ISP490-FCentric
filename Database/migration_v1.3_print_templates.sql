-- ============================================================================
-- Migration tăng dần v1.3 — Cấu hình mẫu in + Hồ sơ công ty dùng chung
-- ============================================================================
-- KHÔNG DROP bảng nào, chỉ CREATE TABLE IF NOT EXISTS — bảo toàn dữ liệu hiện có.
-- Chạy thủ công trên cả DB dev (160.25.81.94) và prod (171.244.142.43)
-- TRƯỚC khi deploy backend:
--   mysql -u <user> -p fashion_system < migration_v1.3_print_templates.sql
--
-- 1) cau_hinh_mau_in      : cấu hình đã lưu của từng biến thể mẫu
--                           (A4/A5/K80) của từng loại chứng từ.
-- 2) mau_in_dang_ap_dung  : mẫu đang áp dụng của mỗi loại chứng từ.
--                           PK = document_type -> đảm bảo ĐÚNG 1 template
--                           đang áp dụng cho mỗi loại (upsert theo PK).
-- 3) thong_tin_cong_ty    : hồ sơ công ty dùng chung toàn hệ thống
--                           (bảng một dòng duy nhất, id luôn = 1).
-- ============================================================================

USE fashion_system;

CREATE TABLE IF NOT EXISTS `cau_hinh_mau_in` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `document_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
        COMMENT 'Mã loại chứng từ: purchase_request, quotation_request, purchase_order, goods_receipt, goods_issue, sales_quotation, sales_invoice',
    `template_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
        COMMENT 'Định danh mẫu trong registry FE (vd: purchase_request_default_A4)',
    `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `paper_size` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
        COMMENT 'A4 / A5 / K80',
    `orientation` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
        COMMENT 'portrait / landscape',
    `margin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
        COMMENT 'narrow / default / wide',
    `accent_color` varchar(9) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
        COMMENT 'Mã màu hex #RRGGBB',
    `branding_json` json DEFAULT NULL
        COMMENT '{"showLogo":bool,"showCompanyName":bool,"showEmail":bool,"showPhone":bool,"showAddress":bool}',
    `sections_json` json DEFAULT NULL
        COMMENT 'Bật/tắt section/field theo schema của loại chứng từ',
    `columns_json` json DEFAULT NULL
        COMMENT 'Bật/tắt cột bảng theo schema',
    `version` int NOT NULL DEFAULT 2
        COMMENT 'Phiên bản cấu trúc config (khớp CONFIG_VERSION của FE)',
    `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `nguoi_cap_nhat_id` int DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_document_template` (`document_type`, `template_id`),
    KEY `fk_cau_hinh_mau_in_nguoi_dung` (`nguoi_cap_nhat_id`),
    CONSTRAINT `fk_cau_hinh_mau_in_nguoi_dung`
        FOREIGN KEY (`nguoi_cap_nhat_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mau_in_dang_ap_dung` (
    `document_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
        COMMENT 'Mã loại chứng từ',
    `template_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
        COMMENT 'Định danh mẫu đang áp dụng',
    `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `nguoi_cap_nhat_id` int DEFAULT NULL,
    PRIMARY KEY (`document_type`),
    KEY `fk_mau_in_dang_ap_dung_nguoi_dung` (`nguoi_cap_nhat_id`),
    CONSTRAINT `fk_mau_in_dang_ap_dung_nguoi_dung`
        FOREIGN KEY (`nguoi_cap_nhat_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `thong_tin_cong_ty` (
    `id` tinyint NOT NULL COMMENT 'Luôn bằng 1 — bảng một dòng duy nhất',
    `ten_cong_ty` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FCentric',
    `logo_duong_dan` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `so_dien_thoai` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `dia_chi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    `version` int NOT NULL DEFAULT 1,
    `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed dòng hồ sơ công ty mặc định (không ghi đè nếu đã có)
INSERT INTO `thong_tin_cong_ty` (`id`, `ten_cong_ty`, `logo_duong_dan`, `version`)
SELECT 1, 'FCentric', '/branding/f-centric-icon.svg', 1
WHERE NOT EXISTS (SELECT 1 FROM `thong_tin_cong_ty` WHERE `id` = 1);
