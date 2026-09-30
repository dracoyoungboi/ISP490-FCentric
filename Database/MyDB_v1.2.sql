-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: fashion_system
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `anh_bien_the`
--

DROP TABLE IF EXISTS `anh_bien_the`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anh_bien_the` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bien_the_id` int NOT NULL,
  `tep_tin_id` int NOT NULL,
  `trang_thai` tinyint(1) DEFAULT '1' COMMENT '0: Ngừng hoạt động, 1: Hoạt động',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bien_the_id` (`bien_the_id`),
  KEY `tep_tin_id` (`tep_tin_id`),
  CONSTRAINT `anh_bien_the_ibfk_1` FOREIGN KEY (`bien_the_id`) REFERENCES `bien_the_san_pham` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `anh_bien_the_ibfk_2` FOREIGN KEY (`tep_tin_id`) REFERENCES `tep_tin` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anh_bien_the`
--

LOCK TABLES `anh_bien_the` WRITE;
/*!40000 ALTER TABLE `anh_bien_the` DISABLE KEYS */;
/*!40000 ALTER TABLE `anh_bien_the` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `anh_kiem_ke`
--

DROP TABLE IF EXISTS `anh_kiem_ke`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anh_kiem_ke` (
  `id` int NOT NULL AUTO_INCREMENT,
  `chi_tiet_kiem_ke_id` int NOT NULL,
  `tep_tin_id` int NOT NULL,
  `loai_anh` enum('tong_quan','chi_tiet','van_de') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'chi_tiet',
  `mo_ta` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ngay_chup` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `nguoi_chup_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tep_tin_id` (`tep_tin_id`),
  KEY `nguoi_chup_id` (`nguoi_chup_id`),
  KEY `idx_chi_tiet` (`chi_tiet_kiem_ke_id`),
  CONSTRAINT `anh_kiem_ke_ibfk_1` FOREIGN KEY (`chi_tiet_kiem_ke_id`) REFERENCES `chi_tiet_kiem_ke` (`id`) ON DELETE CASCADE,
  CONSTRAINT `anh_kiem_ke_ibfk_2` FOREIGN KEY (`tep_tin_id`) REFERENCES `tep_tin` (`id`),
  CONSTRAINT `anh_kiem_ke_ibfk_3` FOREIGN KEY (`nguoi_chup_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anh_kiem_ke`
--

LOCK TABLES `anh_kiem_ke` WRITE;
/*!40000 ALTER TABLE `anh_kiem_ke` DISABLE KEYS */;
/*!40000 ALTER TABLE `anh_kiem_ke` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `anh_quan_ao`
--

DROP TABLE IF EXISTS `anh_quan_ao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anh_quan_ao` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quan_ao_id` int NOT NULL,
  `tep_tin_id` int NOT NULL,
  `anh_chinh` tinyint(1) DEFAULT '0' COMMENT '0: Ảnh phụ, 1: Ảnh chính',
  `trang_thai` tinyint(1) DEFAULT '1' COMMENT '0: Ngừng hoạt động, 1: Hoạt động',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `quan_ao_id` (`quan_ao_id`),
  KEY `tep_tin_id` (`tep_tin_id`),
  CONSTRAINT `anh_quan_ao_ibfk_1` FOREIGN KEY (`quan_ao_id`) REFERENCES `san_pham_quan_ao` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `anh_quan_ao_ibfk_2` FOREIGN KEY (`tep_tin_id`) REFERENCES `tep_tin` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `anh_quan_ao`
--

LOCK TABLES `anh_quan_ao` WRITE;
/*!40000 ALTER TABLE `anh_quan_ao` DISABLE KEYS */;
/*!40000 ALTER TABLE `anh_quan_ao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bien_the_san_pham`
--

DROP TABLE IF EXISTS `bien_the_san_pham`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bien_the_san_pham` (
  `id` int NOT NULL AUTO_INCREMENT,
  `san_pham_id` int NOT NULL,
  `mau_sac_id` int NOT NULL,
  `size_id` int NOT NULL,
  `chat_lieu_id` int NOT NULL,
  `ma_sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã SKU: VD AT001-DEN-L-COTTON',
  `ma_vach_sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã vạch riêng cho SKU',
  `gia_von` decimal(15,2) DEFAULT '0.00',
  `gia_ban` decimal(15,2) DEFAULT '0.00',
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Ngừng kinh doanh, 1: Hoạt động',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_sku` (`ma_sku`),
  UNIQUE KEY `unique_bien_the` (`san_pham_id`,`mau_sac_id`,`size_id`,`chat_lieu_id`),
  KEY `mau_sac_id` (`mau_sac_id`),
  KEY `size_id` (`size_id`),
  KEY `chat_lieu_id` (`chat_lieu_id`),
  KEY `idx_ma_sku` (`ma_sku`),
  KEY `idx_san_pham_mau` (`san_pham_id`,`mau_sac_id`),
  KEY `idx_san_pham_size` (`san_pham_id`,`size_id`),
  CONSTRAINT `bien_the_san_pham_ibfk_1` FOREIGN KEY (`san_pham_id`) REFERENCES `san_pham_quan_ao` (`id`),
  CONSTRAINT `bien_the_san_pham_ibfk_2` FOREIGN KEY (`mau_sac_id`) REFERENCES `mau_sac` (`id`),
  CONSTRAINT `bien_the_san_pham_ibfk_3` FOREIGN KEY (`size_id`) REFERENCES `size` (`id`),
  CONSTRAINT `bien_the_san_pham_ibfk_4` FOREIGN KEY (`chat_lieu_id`) REFERENCES `chat_lieu` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bien_the_san_pham`
--

LOCK TABLES `bien_the_san_pham` WRITE;
/*!40000 ALTER TABLE `bien_the_san_pham` DISABLE KEYS */;
/*!40000 ALTER TABLE `bien_the_san_pham` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `canh_bao`
--

DROP TABLE IF EXISTS `canh_bao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `canh_bao` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loai_canh_bao` enum('ton_kho_thap','ton_kho_qua_muc') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `bien_the_san_pham_id` int NOT NULL,
  `kho_id` int NOT NULL,
  `lo_hang_id` int DEFAULT NULL COMMENT 'Null nếu cảnh báo chung, có giá trị nếu cảnh báo lô cụ thể',
  `so_luong_hien_tai` decimal(15,3) DEFAULT NULL,
  `nguong_canh_bao` decimal(15,3) DEFAULT NULL,
  `ngay_canh_bao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Chờ xử lý, 1: Đã xử lý, 2: Bỏ qua',
  `ngay_xu_ly` timestamp NULL DEFAULT NULL,
  `nguoi_xu_ly_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `bien_the_san_pham_id` (`bien_the_san_pham_id`),
  KEY `kho_id` (`kho_id`),
  KEY `lo_hang_id` (`lo_hang_id`),
  KEY `nguoi_xu_ly_id` (`nguoi_xu_ly_id`),
  KEY `idx_trang_thai` (`trang_thai`,`ngay_canh_bao`),
  KEY `idx_loai` (`loai_canh_bao`),
  CONSTRAINT `canh_bao_ibfk_1` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`),
  CONSTRAINT `canh_bao_ibfk_2` FOREIGN KEY (`kho_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `canh_bao_ibfk_3` FOREIGN KEY (`lo_hang_id`) REFERENCES `lo_hang` (`id`),
  CONSTRAINT `canh_bao_ibfk_4` FOREIGN KEY (`nguoi_xu_ly_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `canh_bao`
--

LOCK TABLES `canh_bao` WRITE;
/*!40000 ALTER TABLE `canh_bao` DISABLE KEYS */;
/*!40000 ALTER TABLE `canh_bao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cau_hinh_he_thong`
--

DROP TABLE IF EXISTS `cau_hinh_he_thong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cau_hinh_he_thong` (
  `ma_cau_hinh` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Key định danh cấu hình (VD: OMNI_SYNC_INTERVAL)',
  `gia_tri` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Giá trị cấu hình',
  `kieu_du_lieu` enum('INT','DECIMAL','STRING','BOOLEAN') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'STRING' COMMENT 'Định dạng để FE/BE parse dữ liệu',
  `mo_ta` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mô tả ý nghĩa cấu hình',
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `nguoi_cap_nhat_id` int DEFAULT NULL,
  PRIMARY KEY (`ma_cau_hinh`),
  KEY `fk_cau_hinh_nguoi_dung` (`nguoi_cap_nhat_id`),
  CONSTRAINT `fk_cau_hinh_nguoi_dung` FOREIGN KEY (`nguoi_cap_nhat_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cau_hinh_he_thong`
--

LOCK TABLES `cau_hinh_he_thong` WRITE;
/*!40000 ALTER TABLE `cau_hinh_he_thong` DISABLE KEYS */;
INSERT INTO `cau_hinh_he_thong` VALUES ('DEFAULT_MIN_STOCK_ALERT','10','INT','Ngưỡng cảnh báo tồn kho tối thiểu mặc định (nếu SKU không cài đặt riêng)','2026-09-30 09:13:43',NULL),('OMNI_SYNC_INTERVAL_MINS','15','INT','Thời gian (phút) chạy Job đồng bộ đơn hàng đa kênh định kỳ','2026-09-30 09:13:43',NULL),('REALTIME_SYNC_THRESHOLD','3','INT','Số lượng tồn kho tối thiểu để kích hoạt đồng bộ Hybrid Real-time','2026-09-30 09:13:43',NULL);
/*!40000 ALTER TABLE `cau_hinh_he_thong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_lieu`
--

DROP TABLE IF EXISTS `chat_lieu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_lieu` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_chat_lieu` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_chat_lieu` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Cotton, Vải jean, Kaki, Polyester, Lụa...',
  `mo_ta` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_chat_lieu` (`ma_chat_lieu`),
  KEY `idx_ma_chat_lieu` (`ma_chat_lieu`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_lieu`
--

LOCK TABLES `chat_lieu` WRITE;
/*!40000 ALTER TABLE `chat_lieu` DISABLE KEYS */;
INSERT INTO `chat_lieu` VALUES (1,'CL001','Cotton 100%','Vải cotton tự nhiên 100%, thấm hút tốt','2026-01-21 13:53:09'),(2,'CL002','Cotton pha (65/35)','Cotton 65% pha Polyester 35%, bền đẹp','2026-01-21 13:53:09'),(3,'CL003','Vải jean','Vải denim dày dặn, bền màu','2026-01-21 13:53:09'),(4,'CL004','Kaki','Vải kaki cao cấp, không nhăn','2026-01-21 13:53:09'),(5,'CL005','Polyester','Vải polyester, không nhăn, dễ giặt','2026-01-21 13:53:09'),(6,'CL006','Lụa','Lụa tơ tằm cao cấp','2026-01-21 13:53:09'),(7,'CL007','Vải thun','Vải thun co giãn 4 chiều','2026-01-21 13:53:09'),(8,'CL008','Kate','Vải kate mịn, phù hợp công sở','2026-01-21 13:53:09'),(9,'CL009','Len','Vải len ấm áp mùa đông','2026-01-21 13:53:09'),(10,'CL010','Nỉ','Vải nỉ dày, giữ nhiệt tốt','2026-01-21 13:53:09'),(30,'CL0012','Cotton 98% thường','123caafasf123','2026-01-25 20:29:29');
/*!40000 ALTER TABLE `chat_lieu` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chi_tiet_don_ban_hang`
--

DROP TABLE IF EXISTS `chi_tiet_don_ban_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chi_tiet_don_ban_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `don_ban_hang_id` int NOT NULL,
  `bien_the_san_pham_id` int NOT NULL,
  `so_luong_dat` decimal(15,3) NOT NULL,
  `so_luong_da_giao` decimal(15,3) DEFAULT '0.000',
  `don_gia` decimal(15,2) NOT NULL,
  `thanh_tien` decimal(15,2) GENERATED ALWAYS AS ((`so_luong_dat` * `don_gia`)) STORED,
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `bien_the_san_pham_id` (`bien_the_san_pham_id`),
  KEY `idx_don_bien_the` (`don_ban_hang_id`,`bien_the_san_pham_id`),
  CONSTRAINT `chi_tiet_don_ban_hang_ibfk_1` FOREIGN KEY (`don_ban_hang_id`) REFERENCES `don_ban_hang` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chi_tiet_don_ban_hang_ibfk_2` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chi_tiet_don_ban_hang`
--

LOCK TABLES `chi_tiet_don_ban_hang` WRITE;
/*!40000 ALTER TABLE `chi_tiet_don_ban_hang` DISABLE KEYS */;
/*!40000 ALTER TABLE `chi_tiet_don_ban_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chi_tiet_don_mua_hang`
--

DROP TABLE IF EXISTS `chi_tiet_don_mua_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chi_tiet_don_mua_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `don_mua_hang_id` int NOT NULL,
  `bien_the_san_pham_id` int NOT NULL,
  `so_luong_dat` decimal(15,3) NOT NULL,
  `so_luong_da_nhan` decimal(15,3) DEFAULT '0.000',
  `don_gia` decimal(15,2) NOT NULL,
  `thanh_tien` decimal(15,2) GENERATED ALWAYS AS ((`so_luong_dat` * `don_gia`)) STORED,
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `bien_the_san_pham_id` (`bien_the_san_pham_id`),
  KEY `idx_don_bien_the` (`don_mua_hang_id`,`bien_the_san_pham_id`),
  CONSTRAINT `chi_tiet_don_mua_hang_ibfk_1` FOREIGN KEY (`don_mua_hang_id`) REFERENCES `don_mua_hang` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chi_tiet_don_mua_hang_ibfk_2` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chi_tiet_don_mua_hang`
--

LOCK TABLES `chi_tiet_don_mua_hang` WRITE;
/*!40000 ALTER TABLE `chi_tiet_don_mua_hang` DISABLE KEYS */;
/*!40000 ALTER TABLE `chi_tiet_don_mua_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chi_tiet_kiem_ke`
--

DROP TABLE IF EXISTS `chi_tiet_kiem_ke`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chi_tiet_kiem_ke` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dot_kiem_ke_id` int NOT NULL,
  `bien_the_san_pham_id` int NOT NULL,
  `lo_hang_id` int NOT NULL,
  `so_luong_he_thong` decimal(15,3) NOT NULL DEFAULT '0.000' COMMENT 'Số lượng theo sổ sách',
  `gia_von_he_thong` decimal(15,2) DEFAULT NULL COMMENT 'Giá vốn theo hệ thống',
  `so_luong_thuc_te` decimal(15,3) DEFAULT '0.000' COMMENT 'Số lượng kiểm đếm thực tế',
  `gia_von_thuc_te` decimal(15,2) DEFAULT NULL COMMENT 'Giá vốn thực tế (nếu có điều chỉnh)',
  `chenh_lech_so_luong` decimal(15,3) DEFAULT '0.000' COMMENT 'so_luong_thuc_te - so_luong_he_thong',
  `ti_le_chenh_lech` decimal(10,2) DEFAULT '0.00' COMMENT '% chênh lệch',
  `gia_tri_chenh_lech` decimal(15,2) DEFAULT '0.00' COMMENT 'Giá trị tiền chênh lệch',
  `loai_chenh_lech` enum('thieu','thua','khop') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Phân loại chênh lệch',
  `vi_tri_kho` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Vị trí cụ thể trong kho: kệ, ngăn, tầng',
  `lan_kiem_dem` tinyint DEFAULT '1' COMMENT 'Lần kiểm đếm thứ mấy',
  `nguoi_kiem_dem_id` int DEFAULT NULL COMMENT 'Người thực hiện kiểm đếm',
  `ngay_kiem_dem` timestamp NULL DEFAULT NULL,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Chưa kiểm, 1: Đã kiểm, 2: Cần kiểm lại, 3: Đã xác nhận',
  `ly_do_chenh_lech` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Giải trình nguyên nhân chênh lệch',
  `bien_phap_xu_ly` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Biện pháp xử lý đối với chênh lệch',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_dot_bien_the_lo` (`dot_kiem_ke_id`,`bien_the_san_pham_id`,`lo_hang_id`),
  KEY `bien_the_san_pham_id` (`bien_the_san_pham_id`),
  KEY `lo_hang_id` (`lo_hang_id`),
  KEY `nguoi_kiem_dem_id` (`nguoi_kiem_dem_id`),
  KEY `idx_dot_kiem_ke` (`dot_kiem_ke_id`),
  KEY `idx_loai_chenh_lech` (`loai_chenh_lech`),
  KEY `idx_trang_thai` (`trang_thai`),
  KEY `idx_chenh_lech` (`chenh_lech_so_luong`),
  CONSTRAINT `chi_tiet_kiem_ke_ibfk_1` FOREIGN KEY (`dot_kiem_ke_id`) REFERENCES `dot_kiem_ke` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chi_tiet_kiem_ke_ibfk_2` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`),
  CONSTRAINT `chi_tiet_kiem_ke_ibfk_3` FOREIGN KEY (`lo_hang_id`) REFERENCES `lo_hang` (`id`),
  CONSTRAINT `chi_tiet_kiem_ke_ibfk_4` FOREIGN KEY (`nguoi_kiem_dem_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chi_tiet_kiem_ke`
--

LOCK TABLES `chi_tiet_kiem_ke` WRITE;
/*!40000 ALTER TABLE `chi_tiet_kiem_ke` DISABLE KEYS */;
/*!40000 ALTER TABLE `chi_tiet_kiem_ke` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chi_tiet_nhat_hang`
--

DROP TABLE IF EXISTS `chi_tiet_nhat_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chi_tiet_nhat_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `danh_sach_nhat_hang_id` int NOT NULL,
  `bien_the_san_pham_id` int NOT NULL,
  `so_luong_can_nhat` decimal(15,3) NOT NULL COMMENT 'Tổng số lượng SKU này cần lấy cho tất cả đơn trong Pick List',
  `so_luong_da_quet` decimal(15,3) DEFAULT '0.000' COMMENT 'Tăng lên 1 mỗi khi súng quét mã vạch thành công',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_picklist_bienthe` (`danh_sach_nhat_hang_id`,`bien_the_san_pham_id`),
  KEY `fk_chitiet_bienthe` (`bien_the_san_pham_id`),
  CONSTRAINT `fk_chitiet_bienthe` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`),
  CONSTRAINT `fk_chitiet_picklist` FOREIGN KEY (`danh_sach_nhat_hang_id`) REFERENCES `danh_sach_nhat_hang` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chi_tiet_nhat_hang`
--

LOCK TABLES `chi_tiet_nhat_hang` WRITE;
/*!40000 ALTER TABLE `chi_tiet_nhat_hang` DISABLE KEYS */;
/*!40000 ALTER TABLE `chi_tiet_nhat_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chi_tiet_phieu_dieu_chinh`
--

DROP TABLE IF EXISTS `chi_tiet_phieu_dieu_chinh`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chi_tiet_phieu_dieu_chinh` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phieu_dieu_chinh_kho_id` int NOT NULL,
  `chi_tiet_kiem_ke_id` int NOT NULL COMMENT 'Tham chiếu đến chi tiết kiểm kê',
  `bien_the_san_pham_id` int NOT NULL,
  `lo_hang_id` int NOT NULL,
  `so_luong_dieu_chinh` decimal(15,3) NOT NULL COMMENT 'Số dương = tăng, số âm = giảm',
  `gia_von` decimal(15,2) NOT NULL,
  `thanh_tien` decimal(15,2) DEFAULT '0.00',
  `loai_dieu_chinh` enum('tang','giam') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `chi_tiet_kiem_ke_id` (`chi_tiet_kiem_ke_id`),
  KEY `bien_the_san_pham_id` (`bien_the_san_pham_id`),
  KEY `lo_hang_id` (`lo_hang_id`),
  KEY `idx_phieu` (`phieu_dieu_chinh_kho_id`),
  KEY `idx_loai` (`loai_dieu_chinh`),
  CONSTRAINT `chi_tiet_phieu_dieu_chinh_ibfk_1` FOREIGN KEY (`phieu_dieu_chinh_kho_id`) REFERENCES `phieu_dieu_chinh_kho` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chi_tiet_phieu_dieu_chinh_ibfk_2` FOREIGN KEY (`chi_tiet_kiem_ke_id`) REFERENCES `chi_tiet_kiem_ke` (`id`),
  CONSTRAINT `chi_tiet_phieu_dieu_chinh_ibfk_3` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`),
  CONSTRAINT `chi_tiet_phieu_dieu_chinh_ibfk_4` FOREIGN KEY (`lo_hang_id`) REFERENCES `lo_hang` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chi_tiet_phieu_dieu_chinh`
--

LOCK TABLES `chi_tiet_phieu_dieu_chinh` WRITE;
/*!40000 ALTER TABLE `chi_tiet_phieu_dieu_chinh` DISABLE KEYS */;
/*!40000 ALTER TABLE `chi_tiet_phieu_dieu_chinh` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chi_tiet_phieu_nhap_kho`
--

DROP TABLE IF EXISTS `chi_tiet_phieu_nhap_kho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chi_tiet_phieu_nhap_kho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phieu_nhap_kho_id` int NOT NULL,
  `bien_the_san_pham_id` int NOT NULL,
  `lo_hang_id` int DEFAULT NULL,
  `so_luong_nhap` decimal(15,3) NOT NULL,
  `don_gia` decimal(15,2) NOT NULL,
  `thanh_tien` decimal(15,2) GENERATED ALWAYS AS ((`so_luong_nhap` * `don_gia`)) STORED,
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bien_the_san_pham_id` (`bien_the_san_pham_id`),
  KEY `lo_hang_id` (`lo_hang_id`),
  KEY `idx_phieu_bien_the` (`phieu_nhap_kho_id`,`bien_the_san_pham_id`),
  CONSTRAINT `chi_tiet_phieu_nhap_kho_ibfk_1` FOREIGN KEY (`phieu_nhap_kho_id`) REFERENCES `phieu_nhap_kho` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chi_tiet_phieu_nhap_kho_ibfk_2` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`),
  CONSTRAINT `chi_tiet_phieu_nhap_kho_ibfk_3` FOREIGN KEY (`lo_hang_id`) REFERENCES `lo_hang` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chi_tiet_phieu_nhap_kho`
--

LOCK TABLES `chi_tiet_phieu_nhap_kho` WRITE;
/*!40000 ALTER TABLE `chi_tiet_phieu_nhap_kho` DISABLE KEYS */;
/*!40000 ALTER TABLE `chi_tiet_phieu_nhap_kho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chi_tiet_phieu_xuat_kho`
--

DROP TABLE IF EXISTS `chi_tiet_phieu_xuat_kho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chi_tiet_phieu_xuat_kho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phieu_xuat_kho_id` int NOT NULL,
  `bien_the_san_pham_id` int NOT NULL,
  `lo_hang_id` int DEFAULT NULL,
  `so_luong_xuat` decimal(15,3) NOT NULL,
  `gia_von` decimal(15,2) DEFAULT NULL COMMENT 'Giá vốn tại thời điểm xuất',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bien_the_san_pham_id` (`bien_the_san_pham_id`),
  KEY `lo_hang_id` (`lo_hang_id`),
  KEY `idx_phieu_bien_the` (`phieu_xuat_kho_id`,`bien_the_san_pham_id`),
  CONSTRAINT `chi_tiet_phieu_xuat_kho_ibfk_1` FOREIGN KEY (`phieu_xuat_kho_id`) REFERENCES `phieu_xuat_kho` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chi_tiet_phieu_xuat_kho_ibfk_2` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`),
  CONSTRAINT `chi_tiet_phieu_xuat_kho_ibfk_3` FOREIGN KEY (`lo_hang_id`) REFERENCES `lo_hang` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=220 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chi_tiet_phieu_xuat_kho`
--

LOCK TABLES `chi_tiet_phieu_xuat_kho` WRITE;
/*!40000 ALTER TABLE `chi_tiet_phieu_xuat_kho` DISABLE KEYS */;
/*!40000 ALTER TABLE `chi_tiet_phieu_xuat_kho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chi_tiet_quyen_kho`
--

DROP TABLE IF EXISTS `chi_tiet_quyen_kho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chi_tiet_quyen_kho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phan_quyen_nguoi_dung_kho_id` int NOT NULL,
  `quyen_han_id` int NOT NULL,
  `trang_thai` tinyint(1) DEFAULT '1' COMMENT '1 = được phép, 0 = bị từ chối',
  `ngay_cap` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `nguoi_cap_id` int DEFAULT NULL COMMENT 'Người cấp quyền này',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_phan_quyen_quyen_han` (`phan_quyen_nguoi_dung_kho_id`,`quyen_han_id`),
  KEY `nguoi_cap_id` (`nguoi_cap_id`),
  KEY `idx_phan_quyen` (`phan_quyen_nguoi_dung_kho_id`),
  KEY `idx_quyen_han` (`quyen_han_id`),
  CONSTRAINT `chi_tiet_quyen_kho_ibfk_1` FOREIGN KEY (`phan_quyen_nguoi_dung_kho_id`) REFERENCES `phan_quyen_nguoi_dung_kho` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chi_tiet_quyen_kho_ibfk_2` FOREIGN KEY (`quyen_han_id`) REFERENCES `quyen_han` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chi_tiet_quyen_kho_ibfk_3` FOREIGN KEY (`nguoi_cap_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=566 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chi_tiet_quyen_kho`
--

LOCK TABLES `chi_tiet_quyen_kho` WRITE;
/*!40000 ALTER TABLE `chi_tiet_quyen_kho` DISABLE KEYS */;
INSERT INTO `chi_tiet_quyen_kho` VALUES (404,57,9,1,'2026-03-16 11:28:52',NULL),(405,57,14,1,'2026-03-16 11:28:53',NULL),(406,57,16,1,'2026-03-16 11:28:53',NULL),(407,57,15,1,'2026-03-16 11:28:53',NULL),(408,57,4,1,'2026-03-16 11:28:53',NULL),(409,57,12,1,'2026-03-16 11:28:53',NULL),(410,57,21,1,'2026-03-16 11:28:53',NULL),(411,57,2,1,'2026-03-16 11:28:53',NULL),(412,57,7,1,'2026-03-16 11:28:53',NULL),(413,57,18,1,'2026-03-16 11:28:53',NULL),(414,57,1,1,'2026-03-16 11:28:53',NULL),(415,58,1,1,'2026-03-16 11:30:24',NULL),(416,58,18,1,'2026-03-16 11:30:25',NULL),(417,58,16,1,'2026-03-16 11:30:25',NULL),(418,58,9,1,'2026-03-16 11:30:25',NULL),(419,58,14,1,'2026-03-16 11:30:25',NULL),(420,58,15,1,'2026-03-16 11:30:25',NULL),(421,58,21,1,'2026-03-16 11:30:25',NULL),(422,58,2,1,'2026-03-16 11:30:25',NULL),(423,58,12,1,'2026-03-16 11:30:25',NULL),(424,58,7,1,'2026-03-16 11:30:25',NULL),(425,58,4,1,'2026-03-16 11:31:01',NULL),(426,59,9,1,'2026-03-16 11:32:21',NULL),(427,59,16,1,'2026-03-16 11:32:21',NULL),(428,59,13,1,'2026-03-16 11:32:21',NULL),(429,59,7,1,'2026-03-16 11:32:22',NULL),(430,59,14,1,'2026-03-16 11:32:22',NULL),(431,59,12,1,'2026-03-16 11:32:22',NULL),(432,59,3,1,'2026-03-16 11:32:22',NULL),(433,59,8,1,'2026-03-16 11:32:22',NULL),(434,59,18,1,'2026-03-16 11:32:22',NULL),(435,59,22,1,'2026-03-16 11:32:22',NULL),(436,59,2,1,'2026-03-16 11:32:22',NULL),(437,59,4,1,'2026-03-16 11:32:22',NULL),(438,59,21,1,'2026-03-16 11:32:22',NULL),(439,59,15,1,'2026-03-16 11:32:22',NULL),(440,59,19,1,'2026-03-16 11:32:23',NULL),(441,59,1,1,'2026-03-16 11:32:23',NULL),(442,60,2,1,'2026-03-16 11:32:50',NULL),(443,60,18,1,'2026-03-16 11:32:50',NULL),(444,60,3,1,'2026-03-16 11:32:50',NULL),(445,60,4,1,'2026-03-16 11:32:50',NULL),(446,60,1,1,'2026-03-16 11:32:50',NULL),(447,60,13,1,'2026-03-16 11:32:50',NULL),(448,60,19,1,'2026-03-16 11:32:50',NULL),(449,60,21,1,'2026-03-16 11:32:50',NULL),(450,60,9,1,'2026-03-16 11:32:50',NULL),(451,60,16,1,'2026-03-16 11:32:50',NULL),(452,60,8,1,'2026-03-16 11:32:51',NULL),(453,60,7,1,'2026-03-16 11:32:51',NULL),(454,60,12,1,'2026-03-16 11:32:51',NULL),(455,60,22,1,'2026-03-16 11:32:51',NULL),(456,60,15,1,'2026-03-16 11:32:51',NULL),(457,60,14,1,'2026-03-16 11:32:51',NULL),(458,61,3,1,'2026-03-16 12:30:33',NULL),(459,61,4,1,'2026-03-16 12:30:33',NULL),(460,61,2,1,'2026-03-16 12:30:33',NULL),(461,61,7,1,'2026-03-16 12:30:33',NULL),(462,61,1,1,'2026-03-16 12:30:33',NULL),(463,61,5,1,'2026-03-16 12:30:34',NULL),(464,62,5,1,'2026-03-16 12:56:43',NULL),(465,62,1,1,'2026-03-16 12:56:43',NULL),(466,62,2,1,'2026-03-16 12:56:44',NULL),(467,62,7,1,'2026-03-16 12:56:44',NULL),(468,62,3,1,'2026-03-16 12:56:44',NULL),(469,63,12,1,'2026-03-16 18:04:55',NULL),(470,63,1,1,'2026-03-16 18:04:55',NULL),(471,63,5,1,'2026-03-16 18:04:56',NULL),(472,63,2,1,'2026-03-16 18:04:56',NULL),(473,63,3,1,'2026-03-16 18:04:56',NULL),(474,63,10,1,'2026-03-16 18:04:56',NULL),(501,66,1,1,'2026-03-18 09:37:36',NULL),(502,66,2,1,'2026-03-18 09:37:36',NULL),(503,66,11,1,'2026-03-18 09:37:36',NULL),(504,66,15,1,'2026-03-18 09:37:36',NULL),(548,71,2,1,'2026-03-18 21:46:27',NULL),(549,71,5,1,'2026-03-18 21:46:27',NULL),(550,71,7,1,'2026-03-18 21:46:27',NULL),(551,71,1,1,'2026-03-18 21:46:27',NULL),(552,72,5,1,'2026-03-18 21:47:47',NULL),(553,72,1,1,'2026-03-18 21:47:47',NULL),(554,72,2,1,'2026-03-18 21:47:47',NULL),(555,72,15,1,'2026-03-18 21:47:47',NULL),(560,57,5,1,'2026-03-20 12:20:54',NULL),(561,59,6,1,'2026-03-20 12:39:12',NULL);
/*!40000 ALTER TABLE `chi_tiet_quyen_kho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chi_tiet_yeu_cau_mua_hang`
--

DROP TABLE IF EXISTS `chi_tiet_yeu_cau_mua_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chi_tiet_yeu_cau_mua_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `yeu_cau_mua_hang_id` int NOT NULL,
  `bien_the_san_pham_id` int NOT NULL,
  `so_luong_dat` decimal(15,3) NOT NULL,
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `bien_the_san_pham_id` (`bien_the_san_pham_id`),
  KEY `idx_yeu_cau_bien_the` (`yeu_cau_mua_hang_id`,`bien_the_san_pham_id`),
  CONSTRAINT `chi_tiet_yeu_cau_mua_hang_ibfk_1` FOREIGN KEY (`yeu_cau_mua_hang_id`) REFERENCES `yeu_cau_mua_hang` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chi_tiet_yeu_cau_mua_hang_ibfk_2` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chi_tiet_yeu_cau_mua_hang`
--

LOCK TABLES `chi_tiet_yeu_cau_mua_hang` WRITE;
/*!40000 ALTER TABLE `chi_tiet_yeu_cau_mua_hang` DISABLE KEYS */;
/*!40000 ALTER TABLE `chi_tiet_yeu_cau_mua_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `danh_muc_quan_ao`
--

DROP TABLE IF EXISTS `danh_muc_quan_ao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `danh_muc_quan_ao` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_danh_muc` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_danh_muc` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Áo thun, Quần jean, Váy, Áo khoác...',
  `danh_muc_cha_id` int DEFAULT NULL,
  `mo_ta` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Ngừng kinh doanh, 1: Hoạt động',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_danh_muc` (`ma_danh_muc`),
  KEY `danh_muc_cha_id` (`danh_muc_cha_id`),
  KEY `idx_ma_danh_muc` (`ma_danh_muc`),
  CONSTRAINT `danh_muc_quan_ao_ibfk_1` FOREIGN KEY (`danh_muc_cha_id`) REFERENCES `danh_muc_quan_ao` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `danh_muc_quan_ao`
--

LOCK TABLES `danh_muc_quan_ao` WRITE;
/*!40000 ALTER TABLE `danh_muc_quan_ao` DISABLE KEYS */;
/*!40000 ALTER TABLE `danh_muc_quan_ao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `danh_sach_nhat_hang`
--

DROP TABLE IF EXISTS `danh_sach_nhat_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `danh_sach_nhat_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_pick_list` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã gộp tự sinh, VD: PL-20260921-001',
  `kho_xuat_id` int NOT NULL COMMENT 'Lấy hàng từ kho nào',
  `nguoi_nhat_id` int DEFAULT NULL COMMENT 'Nhân viên kho được phân công cầm súng quét',
  `trang_thai` enum('cho_nhat','dang_nhat','hoan_tat','huy') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'cho_nhat',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_hoan_tat` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ma_pick_list` (`ma_pick_list`),
  KEY `fk_picklist_kho` (`kho_xuat_id`),
  KEY `fk_picklist_nguoi_dung` (`nguoi_nhat_id`),
  CONSTRAINT `fk_picklist_kho` FOREIGN KEY (`kho_xuat_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `fk_picklist_nguoi_dung` FOREIGN KEY (`nguoi_nhat_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `danh_sach_nhat_hang`
--

LOCK TABLES `danh_sach_nhat_hang` WRITE;
/*!40000 ALTER TABLE `danh_sach_nhat_hang` DISABLE KEYS */;
/*!40000 ALTER TABLE `danh_sach_nhat_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `don_ban_hang`
--

DROP TABLE IF EXISTS `don_ban_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `don_ban_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `so_don_hang` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `loai_chung_tu` enum('bao_gia','don_ban_hang') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'don_ban_hang',
  `khach_hang_id` int NOT NULL,
  `kho_xuat_id` int DEFAULT NULL,
  `ngay_dat_hang` timestamp NOT NULL,
  `ngay_giao_hang` timestamp NULL DEFAULT NULL,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Pending (Chờ duyệt), 1: Reserved (Đã giữ chỗ tồn kho), 2: Picking (Đang nhặt hàng), 3: Shipped (Đã giao ĐVVC), 4: Completed (Hoàn tất), 5: Cancelled (Đã hủy)',
  `tien_hang` decimal(15,2) DEFAULT '0.00',
  `phi_van_chuyen` decimal(15,2) DEFAULT '0.00',
  `tong_cong` decimal(15,2) DEFAULT '0.00',
  `trang_thai_thanh_toan` enum('chua_thanh_toan','da_thanh_toan') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'chua_thanh_toan',
  `dia_chi_giao_hang` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ly_do_tu_choi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `nguoi_tao_id` int DEFAULT NULL,
  `nguoi_duyet_id` int DEFAULT NULL,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `kenh_ban_id` int DEFAULT NULL COMMENT 'Đơn hàng đổ về từ kênh nào',
  `ma_don_hang_kenh` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã Order ID gốc trên Shopify/Lazada để đối soát',
  `danh_sach_nhat_hang_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `so_don_hang` (`so_don_hang`),
  UNIQUE KEY `uk_don_ban_hang_so_don_hang` (`so_don_hang`),
  KEY `khach_hang_id` (`khach_hang_id`),
  KEY `kho_xuat_id` (`kho_xuat_id`),
  KEY `nguoi_tao_id` (`nguoi_tao_id`),
  KEY `nguoi_duyet_id` (`nguoi_duyet_id`),
  KEY `idx_so_don_hang` (`so_don_hang`),
  KEY `idx_trang_thai` (`trang_thai`),
  KEY `fk_don_ban_kenh` (`kenh_ban_id`),
  KEY `fk_don_ban_picklist` (`danh_sach_nhat_hang_id`),
  CONSTRAINT `don_ban_hang_ibfk_1` FOREIGN KEY (`khach_hang_id`) REFERENCES `khach_hang` (`id`),
  CONSTRAINT `don_ban_hang_ibfk_2` FOREIGN KEY (`kho_xuat_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `don_ban_hang_ibfk_3` FOREIGN KEY (`nguoi_tao_id`) REFERENCES `nguoi_dung` (`id`),
  CONSTRAINT `don_ban_hang_ibfk_4` FOREIGN KEY (`nguoi_duyet_id`) REFERENCES `nguoi_dung` (`id`),
  CONSTRAINT `fk_don_ban_kenh` FOREIGN KEY (`kenh_ban_id`) REFERENCES `kenh_ban_hang` (`id`),
  CONSTRAINT `fk_don_ban_picklist` FOREIGN KEY (`danh_sach_nhat_hang_id`) REFERENCES `danh_sach_nhat_hang` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `don_ban_hang`
--

LOCK TABLES `don_ban_hang` WRITE;
/*!40000 ALTER TABLE `don_ban_hang` DISABLE KEYS */;
/*!40000 ALTER TABLE `don_ban_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `don_mua_hang`
--

DROP TABLE IF EXISTS `don_mua_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `don_mua_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `yeu_cau_mua_hang_id` int DEFAULT NULL,
  `so_don_mua` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nha_cung_cap_id` int DEFAULT NULL,
  `kho_nhap_id` int NOT NULL,
  `ngay_dat_hang` timestamp NOT NULL,
  `ngay_giao_du_kien` timestamp NULL DEFAULT NULL,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Nháp, 1: Đã gửi, 2: Đã duyệt, 3: Nhận một phần, 4: Đã nhận, 5: Đã hủy',
  `tong_tien` decimal(15,2) DEFAULT '0.00',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `nguoi_tao_id` int DEFAULT NULL,
  `nguoi_duyet_id` int DEFAULT NULL,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `so_don_mua` (`so_don_mua`),
  KEY `nha_cung_cap_id` (`nha_cung_cap_id`),
  KEY `kho_nhap_id` (`kho_nhap_id`),
  KEY `nguoi_tao_id` (`nguoi_tao_id`),
  KEY `nguoi_duyet_id` (`nguoi_duyet_id`),
  KEY `idx_so_don_mua` (`so_don_mua`),
  KEY `idx_trang_thai` (`trang_thai`),
  CONSTRAINT `don_mua_hang_ibfk_1` FOREIGN KEY (`nha_cung_cap_id`) REFERENCES `nha_cung_cap` (`id`),
  CONSTRAINT `don_mua_hang_ibfk_2` FOREIGN KEY (`kho_nhap_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `don_mua_hang_ibfk_3` FOREIGN KEY (`nguoi_tao_id`) REFERENCES `nguoi_dung` (`id`),
  CONSTRAINT `don_mua_hang_ibfk_4` FOREIGN KEY (`nguoi_duyet_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=144 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `don_mua_hang`
--

LOCK TABLES `don_mua_hang` WRITE;
/*!40000 ALTER TABLE `don_mua_hang` DISABLE KEYS */;
/*!40000 ALTER TABLE `don_mua_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dot_kiem_ke`
--

DROP TABLE IF EXISTS `dot_kiem_ke`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dot_kiem_ke` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_dot_kiem_ke` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'VD: KK2024001',
  `ten_dot_kiem_ke` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `kho_id` int NOT NULL,
  `loai_kiem_ke` enum('toan_bo','theo_danh_muc','theo_khu_vuc','dot_xuat') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'toan_bo',
  `ngay_bat_dau` timestamp NOT NULL,
  `ngay_ket_thuc` timestamp NULL DEFAULT NULL,
  `ngay_hoan_thanh` timestamp NULL DEFAULT NULL COMMENT 'Ngày thực tế hoàn thành kiểm kê',
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Nháp, 1: Đang kiểm kê, 2: Hoàn thành, 3: Đã duyệt, 4: Đã hủy',
  `nguoi_chu_tri_id` int NOT NULL COMMENT 'Người chịu trách nhiệm chính',
  `nguoi_duyet_id` int DEFAULT NULL COMMENT 'Người phê duyệt kết quả kiểm kê',
  `ngay_duyet` timestamp NULL DEFAULT NULL,
  `mo_ta` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ly_do` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Lý do tổ chức kiểm kê',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_dot_kiem_ke` (`ma_dot_kiem_ke`),
  KEY `nguoi_chu_tri_id` (`nguoi_chu_tri_id`),
  KEY `nguoi_duyet_id` (`nguoi_duyet_id`),
  KEY `idx_ma_dot` (`ma_dot_kiem_ke`),
  KEY `idx_kho_trang_thai` (`kho_id`,`trang_thai`),
  KEY `idx_ngay_bat_dau` (`ngay_bat_dau`),
  CONSTRAINT `dot_kiem_ke_ibfk_1` FOREIGN KEY (`kho_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `dot_kiem_ke_ibfk_2` FOREIGN KEY (`nguoi_chu_tri_id`) REFERENCES `nguoi_dung` (`id`),
  CONSTRAINT `dot_kiem_ke_ibfk_3` FOREIGN KEY (`nguoi_duyet_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dot_kiem_ke`
--

LOCK TABLES `dot_kiem_ke` WRITE;
/*!40000 ALTER TABLE `dot_kiem_ke` DISABLE KEYS */;
/*!40000 ALTER TABLE `dot_kiem_ke` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kenh_ban_hang`
--

DROP TABLE IF EXISTS `kenh_ban_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kenh_ban_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_kenh` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'VD: SHOPIFY, LAZADA, SHOPEE, TIKTOK, POS',
  `ten_kenh` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `loai_kenh` enum('online','offline') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'online',
  `api_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Endpoint API của sàn',
  `api_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `api_secret` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trang_thai` tinyint(1) DEFAULT '1' COMMENT '0: Ngắt kết nối, 1: Đang kết nối',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ma_kenh` (`ma_kenh`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kenh_ban_hang`
--

LOCK TABLES `kenh_ban_hang` WRITE;
/*!40000 ALTER TABLE `kenh_ban_hang` DISABLE KEYS */;
INSERT INTO `kenh_ban_hang` VALUES (1,'POS','Bán hàng tại quầy','offline',NULL,NULL,NULL,1,'2026-09-21 01:33:25','2026-09-21 01:33:25'),(2,'SHOPIFY','Website Shopify','online',NULL,NULL,NULL,1,'2026-09-21 01:33:25','2026-09-21 01:33:25'),(3,'LAZADA','Lazada Mall','online',NULL,NULL,NULL,1,'2026-09-21 01:33:25','2026-09-21 01:33:25'),(4,'SHOPEE','Shopee Mall','online',NULL,NULL,NULL,1,'2026-09-21 01:33:25','2026-09-21 01:33:25'),(5,'TIKTOK','Tiktok Shop','online',NULL,NULL,NULL,1,'2026-09-30 09:29:36','2026-09-30 09:29:36');
/*!40000 ALTER TABLE `kenh_ban_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `khach_hang`
--

DROP TABLE IF EXISTS `khach_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `khach_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_khach_hang` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_khach_hang` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nguoi_lien_he` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `so_dien_thoai` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dia_chi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `loai_khach_hang` enum('le','si','doanh_nghiep') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'le',
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Không hoạt động, 1: Hoạt động',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_khach_hang` (`ma_khach_hang`),
  KEY `idx_ma_kh` (`ma_khach_hang`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `khach_hang`
--

LOCK TABLES `khach_hang` WRITE;
/*!40000 ALTER TABLE `khach_hang` DISABLE KEYS */;
INSERT INTO `khach_hang` VALUES (1,'KH001','Công ty TNHH Thời Trang Việt','Nguyễn Văn A','0965678901','thannhhhe186899@fpt.edu.vn','123 Nguyễn Trãi, Quận 1, TP.HCM','doanh_nghiep',0,'2026-02-02 16:05:29','2026-02-12 16:42:29'),(2,'KH002','Cửa hàng May Mặc Hòa Bình','Trần Thị B','0982345678','hoabinh@gmail.com','45 Lê Lợi, Hà Nội','si',0,'2026-02-02 16:05:29','2026-02-11 18:32:22'),(3,'KH003','Nguyễn Thị Lan Anh','Nguyễn Thị Lan Anh','0983456789','lananh@gmail.com','67 Trần Hưng Đạo, Đà Nẵng','le',1,'2026-02-02 16:05:29','2026-02-02 16:05:29'),(4,'KH004','Lê Văn Minh','Lê Văn Minh','0984567890','minh.le@gmail.com','89 Hai Bà Trưng, Hà Nội','le',1,'2026-02-02 16:05:29','2026-02-02 16:05:29'),(5,'KH005','Phạm Thị Hoa','Phạm Thị Hoa','0985678901','hoa.pham@gmail.com','12 Lý Thường Kiệt, TP.HCM','le',1,'2026-02-02 16:05:29','2026-02-02 16:05:29'),(6,'KH006','Cửa hàng Thời Trang Thanh Hương','Hoàng Văn C','0986789012','thanhuong@gmail.com','34 Nguyễn Huệ, Đà Nẵng','si',1,'2026-02-02 16:05:29','2026-02-02 16:05:29'),(7,'KH007','Trần Văn Đức','Trần Văn Đức','0987890123','duc.tran@gmail.com','56 Điện Biên Phủ, Hà Nội','le',1,'2026-02-02 16:05:29','2026-02-02 16:05:29'),(8,'KH008','Công ty CP Thương Mại Miền Nam','Võ Thị D','0988901234','sales@miennam.vn','78 Võ Văn Tần, Quận 3, TP.HCM','doanh_nghiep',1,'2026-02-02 16:05:29','2026-02-02 16:05:29'),(9,'KH009','Vũ Thị Mai','Vũ Thị Mai','0989012345','mai.vu@gmail.com','90 Trường Chinh, Hà Nội','le',0,'2026-02-02 16:05:29','2026-02-11 18:56:09'),(10,'KH010','Đỗ Văn Nam','Đỗ Văn Nam','0990123456','nam.do@gmail.com','11 Cách Mạng Tháng 8, TP.HCM','le',1,'2026-02-02 16:05:29','2026-02-02 16:05:29'),(21,'KH011','Trần Bảo Phúc','Trần Thị B','0395903205','phuctb0302@gmail.com','Hà Nội','le',0,'2026-02-12 14:00:43','2026-02-12 14:00:51'),(22,'KH012','Nguyễn Văn Test','Trần Thị B','0987654321','test@gmail.com','bắc ninh','le',1,'2026-02-12 18:52:11','2026-02-12 18:52:11'),(23,'KH013','Nguyễn Văn Test A','Trần Thị B','0123456789','testa@gmail.com','Hà Nội','le',1,'2026-02-12 19:31:34','2026-02-12 19:31:34'),(24,'KH015','Nguyễn Văn Test C','Trần Thị B','0246813579','testc@gmail.com','Hà Nội','le',0,'2026-02-13 02:52:42','2026-02-13 02:53:15'),(25,'KH016','Nguyễn Văn Test D','Trần Thị B','','testd@gmail.com','Hải Phòng','le',0,'2026-02-13 03:21:32','2026-02-13 03:47:23');
/*!40000 ALTER TABLE `khach_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kho`
--

DROP TABLE IF EXISTS `kho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_kho` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_kho` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `loai_kho` enum('kho_tong','cua_hang') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'cua_hang' COMMENT 'Phân loại kho tổng và cửa hàng nhánh',
  `dia_chi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `quan_ly_id` int DEFAULT NULL,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Không hoạt động, 1: Hoạt động',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_kho` (`ma_kho`),
  KEY `quan_ly_id` (`quan_ly_id`),
  KEY `idx_ma_kho` (`ma_kho`),
  CONSTRAINT `kho_ibfk_1` FOREIGN KEY (`quan_ly_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kho`
--

LOCK TABLES `kho` WRITE;
/*!40000 ALTER TABLE `kho` DISABLE KEYS */;
INSERT INTO `kho` VALUES (1,'KHO01','Kho Hà Nội','kho_tong','Hà Nội',41,1,'2026-01-21 13:53:10'),(2,'KHO02','Kho Hồ Chí Minh','cua_hang','Hồ Chí Minh',42,1,'2026-01-21 13:53:10'),(20,'KHO_TRANSIT','Kho Trung Chuyển','cua_hang','Kho ảo phục vụ luân chuyển hàng hóa giữa các kho',42,1,'2026-03-04 11:17:07');
/*!40000 ALTER TABLE `kho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lich_su_giao_dich_kho`
--

DROP TABLE IF EXISTS `lich_su_giao_dich_kho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lich_su_giao_dich_kho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ngay_giao_dich` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `loai_giao_dich` enum('nhap_kho','xuat_kho','chuyen_kho','dieu_chinh') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `loai_tham_chieu` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tên bảng: phieu_nhap_kho, phieu_xuat_kho, etc',
  `id_tham_chieu` int DEFAULT NULL COMMENT 'ID của phiếu',
  `bien_the_san_pham_id` int NOT NULL,
  `lo_hang_id` int NOT NULL,
  `kho_id` int NOT NULL COMMENT 'Kho nguồn (nhập vào hoặc xuất ra)',
  `kho_chuyen_den_id` int DEFAULT NULL COMMENT 'Kho đích (chỉ dùng khi chuyển kho)',
  `so_luong` decimal(15,3) NOT NULL COMMENT 'Số dương = nhập, số âm = xuất',
  `so_luong_truoc` decimal(15,3) DEFAULT NULL,
  `so_luong_sau` decimal(15,3) DEFAULT NULL,
  `gia_von` decimal(15,2) DEFAULT NULL,
  `nguoi_dung_id` int DEFAULT NULL,
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `lo_hang_id` (`lo_hang_id`),
  KEY `kho_id` (`kho_id`),
  KEY `kho_chuyen_den_id` (`kho_chuyen_den_id`),
  KEY `nguoi_dung_id` (`nguoi_dung_id`),
  KEY `idx_ngay_giao_dich` (`ngay_giao_dich`),
  KEY `idx_bien_the_lo_kho` (`bien_the_san_pham_id`,`lo_hang_id`,`kho_id`),
  KEY `idx_tham_chieu` (`loai_tham_chieu`,`id_tham_chieu`),
  CONSTRAINT `lich_su_giao_dich_kho_ibfk_1` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`),
  CONSTRAINT `lich_su_giao_dich_kho_ibfk_2` FOREIGN KEY (`lo_hang_id`) REFERENCES `lo_hang` (`id`),
  CONSTRAINT `lich_su_giao_dich_kho_ibfk_3` FOREIGN KEY (`kho_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `lich_su_giao_dich_kho_ibfk_4` FOREIGN KEY (`kho_chuyen_den_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `lich_su_giao_dich_kho_ibfk_5` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=207 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lich_su_giao_dich_kho`
--

LOCK TABLES `lich_su_giao_dich_kho` WRITE;
/*!40000 ALTER TABLE `lich_su_giao_dich_kho` DISABLE KEYS */;
/*!40000 ALTER TABLE `lich_su_giao_dich_kho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lich_su_kiem_ke`
--

DROP TABLE IF EXISTS `lich_su_kiem_ke`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lich_su_kiem_ke` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dot_kiem_ke_id` int NOT NULL,
  `hanh_dong` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tạo mới, Bắt đầu kiểm kê, Hoàn thành, Phê duyệt, Hủy, etc',
  `noi_dung` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `nguoi_thuc_hien_id` int NOT NULL,
  `ngay_thuc_hien` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nguoi_thuc_hien_id` (`nguoi_thuc_hien_id`),
  KEY `idx_dot_kiem_ke` (`dot_kiem_ke_id`),
  KEY `idx_ngay` (`ngay_thuc_hien`),
  CONSTRAINT `lich_su_kiem_ke_ibfk_1` FOREIGN KEY (`dot_kiem_ke_id`) REFERENCES `dot_kiem_ke` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lich_su_kiem_ke_ibfk_2` FOREIGN KEY (`nguoi_thuc_hien_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lich_su_kiem_ke`
--

LOCK TABLES `lich_su_kiem_ke` WRITE;
/*!40000 ALTER TABLE `lich_su_kiem_ke` DISABLE KEYS */;
/*!40000 ALTER TABLE `lich_su_kiem_ke` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lich_su_thay_doi`
--

DROP TABLE IF EXISTS `lich_su_thay_doi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lich_su_thay_doi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loai_tham_chieu` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_tham_chieu` int DEFAULT NULL,
  `kho_id` int DEFAULT NULL,
  `hanh_dong` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gia_tri_cu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'JSON lưu giá trị cũ',
  `gia_tri_moi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'JSON lưu giá trị mới',
  `nguoi_thuc_hien_id` int NOT NULL,
  `ngay_thuc_hien` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `kho_id` (`kho_id`),
  KEY `nguoi_thuc_hien_id` (`nguoi_thuc_hien_id`),
  KEY `idx_ngay_thuc_hien` (`ngay_thuc_hien`),
  KEY `idx_hanh_dong` (`hanh_dong`),
  CONSTRAINT `lich_su_thay_doi_ibfk_1` FOREIGN KEY (`kho_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `lich_su_thay_doi_ibfk_2` FOREIGN KEY (`nguoi_thuc_hien_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lich_su_thay_doi`
--

LOCK TABLES `lich_su_thay_doi` WRITE;
/*!40000 ALTER TABLE `lich_su_thay_doi` DISABLE KEYS */;
/*!40000 ALTER TABLE `lich_su_thay_doi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lo_hang`
--

DROP TABLE IF EXISTS `lo_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lo_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bien_the_san_pham_id` int NOT NULL,
  `ma_lo` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã lô nhập hàng',
  `ngay_san_xuat` timestamp NULL DEFAULT NULL COMMENT 'Ngày sản xuất',
  `nha_cung_cap_id` int DEFAULT NULL COMMENT 'Nhà cung cấp của lô hàng này',
  `gia_von` decimal(15,2) NOT NULL COMMENT 'Giá vốn của lô này',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_bien_the_lo` (`bien_the_san_pham_id`,`ma_lo`,`ngay_san_xuat`),
  KEY `nha_cung_cap_id` (`nha_cung_cap_id`),
  KEY `idx_ma_lo` (`ma_lo`),
  CONSTRAINT `lo_hang_ibfk_1` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`),
  CONSTRAINT `lo_hang_ibfk_2` FOREIGN KEY (`nha_cung_cap_id`) REFERENCES `nha_cung_cap` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lo_hang`
--

LOCK TABLES `lo_hang` WRITE;
/*!40000 ALTER TABLE `lo_hang` DISABLE KEYS */;
/*!40000 ALTER TABLE `lo_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mau_sac`
--

DROP TABLE IF EXISTS `mau_sac`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mau_sac` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_mau` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_mau` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Đen, Trắng, Xanh navy, Đỏ đô...',
  `ma_mau_hex` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã màu hex (#000000)',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_mau` (`ma_mau`),
  KEY `idx_ma_mau` (`ma_mau`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mau_sac`
--

LOCK TABLES `mau_sac` WRITE;
/*!40000 ALTER TABLE `mau_sac` DISABLE KEYS */;
/*!40000 ALTER TABLE `mau_sac` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nguoi_dung`
--

DROP TABLE IF EXISTS `nguoi_dung`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nguoi_dung` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ten_dang_nhap` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mat_khau_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ho_ten` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `so_dien_thoai` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vai_tro` enum('quan_tri_vien','quan_ly_kho','nhan_vien_kho','nhan_vien_ban_hang','nhan_vien_mua_hang','khach_hang') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Không hoạt động, 1: Hoạt động',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ten_dang_nhap` (`ten_dang_nhap`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_vai_tro` (`vai_tro`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nguoi_dung`
--

LOCK TABLES `nguoi_dung` WRITE;
/*!40000 ALTER TABLE `nguoi_dung` DISABLE KEYS */;
INSERT INTO `nguoi_dung` VALUES (1,'admin','$2a$10$sI2L3w9FJVDws0Hk.Ak1u./TSs4O0P1odowjDRr4WGz3G56PFqPhy','admin','ducdoanminh2005@gmail.com','0901234567','quan_tri_vien',1,'2026-01-21 13:53:09','2026-09-30 09:58:45',0),(37,'nhanvienbanhang1','$2a$10$nlnmEIG29EyzzHLUAvlm1ucVKJE.6YYP09yvEfIvLrqDhmPk0gHfS','nhanvienbanhang1','nvbh1@fcentric.net','0901234545','nhan_vien_ban_hang',1,'2026-03-16 18:05:52','2026-09-30 09:31:29',0),(38,'nhanvienbanhang2','$2a$10$CTFys37AlYQc8uOwN8WzteUkVozSP.yuca1fBRysArhaNJr.7ADvm','nhanvienbanhang2','nvbh2@fcentric.net','0971234567','nhan_vien_mua_hang',1,'2026-03-16 18:06:54','2026-09-30 09:31:29',0),(39,'nhanvienkho1','$2a$10$tn/peSYoczDx0zSi4JItY.lrRE9DNZ2idWGOLDTLVKQSEqTAN4M2i','nhanvienkho1','nvk1@fcentric.net','0932123456','nhan_vien_kho',1,'2026-03-16 18:07:17','2026-09-30 09:31:29',0),(40,'nhanvienkho2','$2a$10$GNr9/ueoaURwROEDdONp/.NjbdN1xhSXgkLNbpJfeNeDal2U.GWJm','nhanvienkho2','nvk2@fcentric.net','0946312345','nhan_vien_kho',1,'2026-03-16 18:08:12','2026-09-30 09:31:29',0),(41,'quanlykho1','$2a$10$ZGJmC/MdiM2g1YBgc6QEUuuapuFYGlrOrEGNihZ255.sotAqSpuUi','quanlykho1','qlk1@fcentric.net','0954234569','quan_ly_kho',1,'2026-03-16 18:08:35','2026-09-30 09:31:29',0),(42,'quanlykho2','$2a$10$v9yKV7BJ9uCAGu0WMwedNOs0/AM7Mpw3CRGqEUa5kPbuNvaI769MG','quanlykho2','qlk2@fcentric.net','0911234543','quan_ly_kho',1,'2026-03-16 18:08:48','2026-09-30 09:31:29',0),(43,'nhanvienmuahang1','$2a$10$I74ZCf.1BWapvp.HPPKbYe30BoaETYIfRBmDunogvw/0iTqgPuRPG','nhanvienmuahang1','nvmh1@fcentric.net','0912099999','nhan_vien_mua_hang',1,'2026-03-16 18:52:34','2026-09-30 09:31:29',0),(44,'nhanvienmuahang2','$2a$10$bt8pCod6F/MXhhRokR5Bqexqu2KUoHafrUNyV/C65PbA4I2VA5PiK','nhanvienmuahang2','nvmh2@fcentric.net','0967745999','nhan_vien_mua_hang',1,'2026-03-16 18:53:15','2026-09-30 09:31:29',0),(46,'nhanvienmuahang4','$2a$10$KAVD8qhXLrZ8ly1i4uoXQOgv05zpVZoS/cbWWSYIiO0u/bnFsok7W','nhanvienmuahang4','nvmh3@fcentric.net',NULL,'nhan_vien_mua_hang',1,'2026-03-19 04:45:47','2026-09-30 09:31:29',0),(47,'nhanvienmuahang3','$2a$10$lz.k8j13IrXBxElVGGAuceFTTL5aAnh3a9nAVu0C1LgoQpqtxp.sW','nhanvienmuahang3','nvmh4@fcentric.net',NULL,'nhan_vien_mua_hang',1,'2026-03-19 04:47:28','2026-09-30 09:31:29',0);
/*!40000 ALTER TABLE `nguoi_dung` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nha_cung_cap`
--

DROP TABLE IF EXISTS `nha_cung_cap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nha_cung_cap` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_nha_cung_cap` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_nha_cung_cap` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ngan_hang` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `so_ngan_hang` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nguoi_lien_he` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `so_dien_thoai` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dia_chi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Không hoạt động, 1: Hoạt động',
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_nha_cung_cap` (`ma_nha_cung_cap`),
  KEY `idx_ma_ncc` (`ma_nha_cung_cap`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nha_cung_cap`
--

LOCK TABLES `nha_cung_cap` WRITE;
/*!40000 ALTER TABLE `nha_cung_cap` DISABLE KEYS */;
/*!40000 ALTER TABLE `nha_cung_cap` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phan_quyen_nguoi_dung_kho`
--

DROP TABLE IF EXISTS `phan_quyen_nguoi_dung_kho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phan_quyen_nguoi_dung_kho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nguoi_dung_id` int NOT NULL,
  `kho_id` int NOT NULL,
  `la_quan_ly_kho` tinyint(1) DEFAULT '0' COMMENT 'Có phải là quản lý chính của kho này không',
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Không hoạt động, 1: Hoạt động',
  `ngay_bat_dau` timestamp NULL DEFAULT NULL COMMENT 'Ngày bắt đầu có quyền',
  `ngay_ket_thuc` timestamp NULL DEFAULT NULL COMMENT 'Ngày hết quyền (NULL = vô thời hạn)',
  `nguoi_cap_quyen_id` int DEFAULT NULL COMMENT 'Admin cấp quyền',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_nguoi_dung_kho` (`nguoi_dung_id`,`kho_id`),
  KEY `nguoi_cap_quyen_id` (`nguoi_cap_quyen_id`),
  KEY `idx_nguoi_dung` (`nguoi_dung_id`),
  KEY `idx_kho` (`kho_id`),
  KEY `idx_trang_thai` (`trang_thai`),
  CONSTRAINT `phan_quyen_nguoi_dung_kho_ibfk_1` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung` (`id`) ON DELETE CASCADE,
  CONSTRAINT `phan_quyen_nguoi_dung_kho_ibfk_2` FOREIGN KEY (`kho_id`) REFERENCES `kho` (`id`) ON DELETE CASCADE,
  CONSTRAINT `phan_quyen_nguoi_dung_kho_ibfk_3` FOREIGN KEY (`nguoi_cap_quyen_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phan_quyen_nguoi_dung_kho`
--

LOCK TABLES `phan_quyen_nguoi_dung_kho` WRITE;
/*!40000 ALTER TABLE `phan_quyen_nguoi_dung_kho` DISABLE KEYS */;
INSERT INTO `phan_quyen_nguoi_dung_kho` VALUES (57,39,1,0,1,'2026-03-20 12:20:50',NULL,1,'','2026-03-16 11:28:52','2026-03-20 12:20:54'),(58,40,2,0,1,'2026-03-16 11:31:00',NULL,1,'','2026-03-16 11:30:24','2026-03-16 11:31:00'),(59,41,1,0,1,'2026-03-20 12:39:08',NULL,1,'','2026-03-16 11:32:21','2026-03-20 12:39:12'),(60,42,2,1,1,'2026-03-16 11:32:49',NULL,1,'','2026-03-16 11:32:49','2026-03-18 08:33:13'),(61,44,1,0,1,'2026-03-16 12:30:32',NULL,1,'','2026-03-16 12:30:33','2026-03-16 12:30:33'),(62,44,2,0,1,'2026-03-16 12:56:43',NULL,1,'','2026-03-16 12:56:43','2026-03-16 12:56:43'),(63,43,1,0,1,'2026-03-16 18:04:53',NULL,1,'','2026-03-16 18:04:55','2026-03-16 18:04:55'),(66,37,1,1,1,'2026-03-18 09:37:35',NULL,1,'','2026-03-18 09:37:35','2026-03-18 09:39:01'),(71,46,1,0,1,'2026-03-18 21:46:27',NULL,1,'','2026-03-18 21:46:27','2026-03-18 21:46:27'),(72,47,1,0,1,'2026-03-18 21:47:47',NULL,1,'','2026-03-18 21:47:47','2026-03-18 21:47:47');
/*!40000 ALTER TABLE `phan_quyen_nguoi_dung_kho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phieu_dieu_chinh_kho`
--

DROP TABLE IF EXISTS `phieu_dieu_chinh_kho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phieu_dieu_chinh_kho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `so_phieu` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `dot_kiem_ke_id` int NOT NULL,
  `kho_id` int NOT NULL,
  `loai_dieu_chinh` enum('tang','giam','ca_hai') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ca_hai',
  `ngay_dieu_chinh` timestamp NOT NULL,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Nháp, 1: Đã duyệt, 2: Đã áp dụng, 3: Đã hủy',
  `tong_gia_tri_tang` decimal(15,2) DEFAULT '0.00' COMMENT 'Tổng giá trị hàng thừa',
  `tong_gia_tri_giam` decimal(15,2) DEFAULT '0.00' COMMENT 'Tổng giá trị hàng thiếu',
  `gia_tri_chenh_lech_thuan` decimal(15,2) DEFAULT '0.00' COMMENT 'tang - giam',
  `ly_do` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `nguoi_lap_id` int NOT NULL,
  `nguoi_duyet_id` int DEFAULT NULL,
  `ngay_duyet` timestamp NULL DEFAULT NULL,
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `so_phieu` (`so_phieu`),
  KEY `kho_id` (`kho_id`),
  KEY `nguoi_lap_id` (`nguoi_lap_id`),
  KEY `nguoi_duyet_id` (`nguoi_duyet_id`),
  KEY `idx_so_phieu` (`so_phieu`),
  KEY `idx_dot_kiem_ke` (`dot_kiem_ke_id`),
  KEY `idx_trang_thai` (`trang_thai`),
  CONSTRAINT `phieu_dieu_chinh_kho_ibfk_1` FOREIGN KEY (`dot_kiem_ke_id`) REFERENCES `dot_kiem_ke` (`id`),
  CONSTRAINT `phieu_dieu_chinh_kho_ibfk_2` FOREIGN KEY (`kho_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `phieu_dieu_chinh_kho_ibfk_3` FOREIGN KEY (`nguoi_lap_id`) REFERENCES `nguoi_dung` (`id`),
  CONSTRAINT `phieu_dieu_chinh_kho_ibfk_4` FOREIGN KEY (`nguoi_duyet_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phieu_dieu_chinh_kho`
--

LOCK TABLES `phieu_dieu_chinh_kho` WRITE;
/*!40000 ALTER TABLE `phieu_dieu_chinh_kho` DISABLE KEYS */;
/*!40000 ALTER TABLE `phieu_dieu_chinh_kho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phieu_nhap_kho`
--

DROP TABLE IF EXISTS `phieu_nhap_kho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phieu_nhap_kho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `so_phieu_nhap` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `don_mua_hang_id` int DEFAULT NULL,
  `phieu_chuyen_id` int DEFAULT NULL,
  `nha_cung_cap_id` int DEFAULT NULL,
  `kho_id` int NOT NULL,
  `ngay_nhap` timestamp NULL DEFAULT NULL,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Nháp, 1: Hoàn thành, 2: Đã hủy',
  `tong_tien` decimal(15,2) DEFAULT '0.00',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `nguoi_nhap_id` int DEFAULT NULL,
  `nguoi_duyet_id` int DEFAULT NULL,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `so_phieu_nhap` (`so_phieu_nhap`),
  UNIQUE KEY `uk_phieu_nhap_kho_so_phieu` (`so_phieu_nhap`),
  KEY `don_mua_hang_id` (`don_mua_hang_id`),
  KEY `nha_cung_cap_id` (`nha_cung_cap_id`),
  KEY `kho_id` (`kho_id`),
  KEY `nguoi_nhap_id` (`nguoi_nhap_id`),
  KEY `nguoi_duyet_id` (`nguoi_duyet_id`),
  KEY `idx_so_phieu` (`so_phieu_nhap`),
  KEY `idx_ngay_nhap` (`ngay_nhap`),
  KEY `fk_pn_transfer` (`phieu_chuyen_id`),
  CONSTRAINT `fk_pn_transfer` FOREIGN KEY (`phieu_chuyen_id`) REFERENCES `phieu_xuat_kho` (`id`),
  CONSTRAINT `phieu_nhap_kho_ibfk_1` FOREIGN KEY (`don_mua_hang_id`) REFERENCES `don_mua_hang` (`id`),
  CONSTRAINT `phieu_nhap_kho_ibfk_2` FOREIGN KEY (`nha_cung_cap_id`) REFERENCES `nha_cung_cap` (`id`),
  CONSTRAINT `phieu_nhap_kho_ibfk_3` FOREIGN KEY (`kho_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `phieu_nhap_kho_ibfk_4` FOREIGN KEY (`nguoi_nhap_id`) REFERENCES `nguoi_dung` (`id`),
  CONSTRAINT `phieu_nhap_kho_ibfk_5` FOREIGN KEY (`nguoi_duyet_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phieu_nhap_kho`
--

LOCK TABLES `phieu_nhap_kho` WRITE;
/*!40000 ALTER TABLE `phieu_nhap_kho` DISABLE KEYS */;
/*!40000 ALTER TABLE `phieu_nhap_kho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phieu_xuat_kho`
--

DROP TABLE IF EXISTS `phieu_xuat_kho`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phieu_xuat_kho` (
  `id` int NOT NULL AUTO_INCREMENT,
  `so_phieu_xuat` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `don_ban_hang_id` int DEFAULT NULL,
  `parent_id` int DEFAULT NULL,
  `kho_id` int NOT NULL,
  `ngay_xuat` timestamp NULL DEFAULT NULL,
  `loai_xuat` enum('ban_hang','chuyen_kho','tra_hang','dieu_chinh','khac') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ban_hang',
  `kho_chuyen_den_id` int DEFAULT NULL COMMENT 'Chỉ dùng khi loai_xuat = chuyen_kho',
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Nháp, 1: Hoàn thành, 2: Đã hủy',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `nguoi_xuat_id` int DEFAULT NULL,
  `nguoi_duyet_id` int DEFAULT NULL,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `so_phieu_xuat` (`so_phieu_xuat`),
  UNIQUE KEY `uk_phieu_xuat_kho_so_phieu` (`so_phieu_xuat`),
  KEY `don_ban_hang_id` (`don_ban_hang_id`),
  KEY `kho_id` (`kho_id`),
  KEY `kho_chuyen_den_id` (`kho_chuyen_den_id`),
  KEY `nguoi_xuat_id` (`nguoi_xuat_id`),
  KEY `nguoi_duyet_id` (`nguoi_duyet_id`),
  KEY `idx_so_phieu` (`so_phieu_xuat`),
  KEY `idx_ngay_xuat` (`ngay_xuat`),
  KEY `idx_loai_xuat` (`loai_xuat`),
  KEY `fk_px_parent` (`parent_id`),
  CONSTRAINT `fk_px_parent` FOREIGN KEY (`parent_id`) REFERENCES `phieu_xuat_kho` (`id`),
  CONSTRAINT `phieu_xuat_kho_ibfk_1` FOREIGN KEY (`don_ban_hang_id`) REFERENCES `don_ban_hang` (`id`),
  CONSTRAINT `phieu_xuat_kho_ibfk_2` FOREIGN KEY (`kho_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `phieu_xuat_kho_ibfk_3` FOREIGN KEY (`kho_chuyen_den_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `phieu_xuat_kho_ibfk_4` FOREIGN KEY (`nguoi_xuat_id`) REFERENCES `nguoi_dung` (`id`),
  CONSTRAINT `phieu_xuat_kho_ibfk_5` FOREIGN KEY (`nguoi_duyet_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phieu_xuat_kho`
--

LOCK TABLES `phieu_xuat_kho` WRITE;
/*!40000 ALTER TABLE `phieu_xuat_kho` DISABLE KEYS */;
/*!40000 ALTER TABLE `phieu_xuat_kho` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quyen_han`
--

DROP TABLE IF EXISTS `quyen_han`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quyen_han` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_quyen` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_quyen` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mo_ta` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `nhom_quyen` enum('quan_ly_kho','nhap_kho','xuat_kho','bao_cao','cai_dat') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_quyen` (`ma_quyen`),
  KEY `idx_ma_quyen` (`ma_quyen`),
  KEY `idx_nhom_quyen` (`nhom_quyen`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quyen_han`
--

LOCK TABLES `quyen_han` WRITE;
/*!40000 ALTER TABLE `quyen_han` DISABLE KEYS */;
INSERT INTO `quyen_han` VALUES (1,'xem_ton_kho','Xem tồn kho','Xem thông tin tồn kho tại kho được phân quyền','quan_ly_kho','2026-01-21 13:53:08'),(2,'xem_chi_tiet_lo','Xem chi tiết lô hàng','Xem thông tin chi tiết các lô hàng','quan_ly_kho','2026-01-21 13:53:08'),(3,'dieu_chinh_ton_kho','Điều chỉnh tồn kho','Điều chỉnh số lượng tồn kho','quan_ly_kho','2026-01-21 13:53:08'),(4,'chuyen_kho','Chuyển kho','Thực hiện chuyển hàng giữa các kho','quan_ly_kho','2026-01-21 13:53:08'),(5,'tao_don_mua_hang','Tạo đơn mua hàng','Tạo đơn đặt hàng với nhà cung cấp','nhap_kho','2026-01-21 13:53:08'),(6,'duyet_don_mua_hang','Duyệt đơn mua hàng','Phê duyệt đơn mua hàng','nhap_kho','2026-01-21 13:53:08'),(7,'tao_phieu_nhap','Tạo phiếu nhập kho','Tạo phiếu nhập hàng vào kho','nhap_kho','2026-01-21 13:53:08'),(8,'duyet_phieu_nhap','Duyệt phiếu nhập kho','Phê duyệt phiếu nhập kho','nhap_kho','2026-01-21 13:53:08'),(9,'huy_phieu_nhap','Hủy phiếu nhập kho','Hủy phiếu nhập kho đã tạo','nhap_kho','2026-01-21 13:53:08'),(10,'tao_don_ban_hang','Tạo đơn bán hàng','Tạo đơn bán hàng cho khách','xuat_kho','2026-01-21 13:53:08'),(11,'duyet_don_ban_hang','Duyệt đơn bán hàng','Phê duyệt đơn bán hàng','xuat_kho','2026-01-21 13:53:08'),(12,'tao_phieu_xuat','Tạo phiếu xuất kho','Tạo phiếu xuất hàng khỏi kho','xuat_kho','2026-01-21 13:53:08'),(13,'duyet_phieu_xuat','Duyệt phiếu xuất kho','Phê duyệt phiếu xuất kho','xuat_kho','2026-01-21 13:53:08'),(14,'huy_phieu_xuat','Hủy phiếu xuất kho','Hủy phiếu xuất kho đã tạo','xuat_kho','2026-01-21 13:53:08'),(15,'xem_bao_cao_ton_kho','Xem báo cáo tồn kho','Xem các báo cáo về tồn kho','bao_cao','2026-01-21 13:53:08'),(16,'xem_bao_cao_nhap_xuat','Xem báo cáo nhập xuất','Xem báo cáo nhập xuất tồn','bao_cao','2026-01-21 13:53:08'),(17,'xem_bao_cao_doanh_thu','Xem báo cáo doanh thu','Xem báo cáo doanh thu bán hàng','bao_cao','2026-01-21 13:53:08'),(18,'xuat_bao_cao','Xuất báo cáo','Xuất báo cáo ra file Excel/PDF','bao_cao','2026-01-21 13:53:08'),(19,'quan_ly_nhan_vien_kho','Quản lý nhân viên kho','Thêm/xóa nhân viên khỏi kho','cai_dat','2026-01-21 13:53:08'),(20,'cap_quyen_nhan_vien','Cấp quyền nhân viên','Cấp/thu hồi quyền cho nhân viên','cai_dat','2026-01-21 13:53:08'),(21,'quan_ly_san_pham','Quản lý sản phẩm','Thêm/sửa/xóa sản phẩm và biến thể','cai_dat','2026-01-21 13:53:08'),(22,'quan_ly_nha_cung_cap','Quản lý nhà cung cấp','Thêm/sửa/xóa nhà cung cấp','cai_dat','2026-01-21 13:53:08'),(23,'quan_ly_khach_hang','Quản lý khách hàng','Thêm/sửa/xóa khách hàng','cai_dat','2026-01-21 13:53:08');
/*!40000 ALTER TABLE `quyen_han` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `san_pham_quan_ao`
--

DROP TABLE IF EXISTS `san_pham_quan_ao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `san_pham_quan_ao` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_san_pham` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã gốc: VD AT001, QJ002',
  `ten_san_pham` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `danh_muc_id` int NOT NULL,
  `mo_ta` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ma_vach` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gia_von_mac_dinh` decimal(15,2) DEFAULT '0.00' COMMENT 'Giá vốn tham khảo',
  `gia_ban_mac_dinh` decimal(15,2) DEFAULT '0.00' COMMENT 'Giá bán tham khảo',
  `muc_ton_toi_thieu` int DEFAULT '0',
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Ngừng kinh doanh, 1: Hoạt động',
  `nguoi_tao_id` int DEFAULT NULL,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_san_pham` (`ma_san_pham`),
  KEY `danh_muc_id` (`danh_muc_id`),
  KEY `nguoi_tao_id` (`nguoi_tao_id`),
  KEY `idx_ma_san_pham` (`ma_san_pham`),
  KEY `idx_ma_vach` (`ma_vach`),
  CONSTRAINT `san_pham_quan_ao_ibfk_1` FOREIGN KEY (`danh_muc_id`) REFERENCES `danh_muc_quan_ao` (`id`),
  CONSTRAINT `san_pham_quan_ao_ibfk_2` FOREIGN KEY (`nguoi_tao_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `san_pham_quan_ao`
--

LOCK TABLES `san_pham_quan_ao` WRITE;
/*!40000 ALTER TABLE `san_pham_quan_ao` DISABLE KEYS */;
/*!40000 ALTER TABLE `san_pham_quan_ao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `size`
--

DROP TABLE IF EXISTS `size`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `size` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_size` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'S, M, L, XL, XXL, 38, 39, 40...',
  `ten_size` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `loai_size` enum('chu','so','khac') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'chu' COMMENT 'Phân loại: chữ (S/M/L) hoặc số (38/39/40)',
  `thu_tu_sap_xep` int DEFAULT '0' COMMENT 'Để sắp xếp size theo thứ tự',
  `mo_ta` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_size` (`ma_size`),
  KEY `idx_ma_size` (`ma_size`),
  KEY `idx_loai_size` (`loai_size`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `size`
--

LOCK TABLES `size` WRITE;
/*!40000 ALTER TABLE `size` DISABLE KEYS */;
/*!40000 ALTER TABLE `size` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tep_tin`
--

DROP TABLE IF EXISTS `tep_tin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tep_tin` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ten_tep_goc` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ten_tai_len` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ten_luu_tru` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `duong_dan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `loai_tep_tin` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duoi_tep` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kich_co` int DEFAULT NULL,
  `mo_ta` varchar(400) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `trang_thai` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ten_luu_tru` (`ten_luu_tru`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tep_tin`
--

LOCK TABLES `tep_tin` WRITE;
/*!40000 ALTER TABLE `tep_tin` DISABLE KEYS */;
/*!40000 ALTER TABLE `tep_tin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `thanh_vien_kiem_ke`
--

DROP TABLE IF EXISTS `thanh_vien_kiem_ke`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `thanh_vien_kiem_ke` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dot_kiem_ke_id` int NOT NULL,
  `nguoi_dung_id` int NOT NULL,
  `vai_tro` enum('chu_tri','thanh_vien','ghi_chep','kiem_dem') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'thanh_vien',
  `phan_khu_vuc` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Khu vực được phân công',
  `ngay_tham_gia` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `trang_thai` tinyint(1) DEFAULT '1' COMMENT '0: Không hoạt động, 1: Đang hoạt động',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_dot_nguoi_dung` (`dot_kiem_ke_id`,`nguoi_dung_id`),
  KEY `idx_dot_kiem_ke` (`dot_kiem_ke_id`),
  KEY `idx_nguoi_dung` (`nguoi_dung_id`),
  CONSTRAINT `thanh_vien_kiem_ke_ibfk_1` FOREIGN KEY (`dot_kiem_ke_id`) REFERENCES `dot_kiem_ke` (`id`) ON DELETE CASCADE,
  CONSTRAINT `thanh_vien_kiem_ke_ibfk_2` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `thanh_vien_kiem_ke`
--

LOCK TABLES `thanh_vien_kiem_ke` WRITE;
/*!40000 ALTER TABLE `thanh_vien_kiem_ke` DISABLE KEYS */;
/*!40000 ALTER TABLE `thanh_vien_kiem_ke` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ton_kho_theo_lo`
--

DROP TABLE IF EXISTS `ton_kho_theo_lo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ton_kho_theo_lo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lo_hang_id` int NOT NULL,
  `kho_id` int NOT NULL,
  `so_luong_ton` decimal(15,3) DEFAULT '0.000',
  `so_luong_da_dat` decimal(15,3) DEFAULT '0.000' COMMENT 'Số lượng đã được đặt hàng nhưng chưa xuất',
  `so_luong_kha_dung` decimal(15,3) GENERATED ALWAYS AS ((`so_luong_ton` - `so_luong_da_dat`)) STORED,
  `ngay_nhap_gan_nhat` timestamp NULL DEFAULT NULL,
  `ngay_xuat_gan_nhat` timestamp NULL DEFAULT NULL,
  `lan_cap_nhat_cuoi` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_lo_kho` (`lo_hang_id`,`kho_id`),
  KEY `idx_kho_lo` (`kho_id`,`lo_hang_id`),
  KEY `idx_so_luong_kha_dung` (`so_luong_kha_dung`),
  CONSTRAINT `ton_kho_theo_lo_ibfk_1` FOREIGN KEY (`lo_hang_id`) REFERENCES `lo_hang` (`id`),
  CONSTRAINT `ton_kho_theo_lo_ibfk_2` FOREIGN KEY (`kho_id`) REFERENCES `kho` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=72 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ton_kho_theo_lo`
--

LOCK TABLES `ton_kho_theo_lo` WRITE;
/*!40000 ALTER TABLE `ton_kho_theo_lo` DISABLE KEYS */;
/*!40000 ALTER TABLE `ton_kho_theo_lo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trang_thai_dong_bo_san_pham`
--

DROP TABLE IF EXISTS `trang_thai_dong_bo_san_pham`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trang_thai_dong_bo_san_pham` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bien_the_san_pham_id` int NOT NULL,
  `kenh_ban_id` int NOT NULL,
  `ma_san_pham_kenh` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID của SKU được sinh ra trên hệ thống của sàn',
  `trang_thai_dong_bo` enum('chua_dong_bo','thanh_cong','that_bai') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'chua_dong_bo',
  `chi_tiet_loi` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Lưu response lỗi từ API (VD: Ảnh quá dung lượng, Thiếu Category)',
  `ngay_dong_bo_cuoi` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bien_the_kenh` (`bien_the_san_pham_id`,`kenh_ban_id`),
  KEY `fk_dong_bo_kenh` (`kenh_ban_id`),
  CONSTRAINT `fk_dong_bo_bien_the` FOREIGN KEY (`bien_the_san_pham_id`) REFERENCES `bien_the_san_pham` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dong_bo_kenh` FOREIGN KEY (`kenh_ban_id`) REFERENCES `kenh_ban_hang` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trang_thai_dong_bo_san_pham`
--

LOCK TABLES `trang_thai_dong_bo_san_pham` WRITE;
/*!40000 ALTER TABLE `trang_thai_dong_bo_san_pham` DISABLE KEYS */;
/*!40000 ALTER TABLE `trang_thai_dong_bo_san_pham` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `yeu_cau_mua_hang`
--

DROP TABLE IF EXISTS `yeu_cau_mua_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `yeu_cau_mua_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `so_yeu_cau_mua_hang` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kho_nhap_id` int NOT NULL,
  `ngay_giao_du_kien` timestamp NULL DEFAULT NULL,
  `trang_thai` tinyint(1) DEFAULT '0' COMMENT '0: Nháp, 1: Đã gửi, 2: Đã duyệt, 3: Từ chối',
  `ghi_chu` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `nguoi_tao_id` int DEFAULT NULL,
  `nguoi_duyet_id` int DEFAULT NULL,
  `ngay_tao` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ngay_cap_nhat` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `so_yeu_cau_mua_hang` (`so_yeu_cau_mua_hang`),
  KEY `kho_nhap_id` (`kho_nhap_id`),
  KEY `nguoi_tao_id` (`nguoi_tao_id`),
  KEY `nguoi_duyet_id` (`nguoi_duyet_id`),
  KEY `idx_trang_thai` (`trang_thai`),
  CONSTRAINT `yeu_cau_mua_hang_ibfk_1` FOREIGN KEY (`kho_nhap_id`) REFERENCES `kho` (`id`),
  CONSTRAINT `yeu_cau_mua_hang_ibfk_2` FOREIGN KEY (`nguoi_tao_id`) REFERENCES `nguoi_dung` (`id`),
  CONSTRAINT `yeu_cau_mua_hang_ibfk_3` FOREIGN KEY (`nguoi_duyet_id`) REFERENCES `nguoi_dung` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `yeu_cau_mua_hang`
--

LOCK TABLES `yeu_cau_mua_hang` WRITE;
/*!40000 ALTER TABLE `yeu_cau_mua_hang` DISABLE KEYS */;
/*!40000 ALTER TABLE `yeu_cau_mua_hang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'fashion_system'
--

--
-- Dumping routines for database 'fashion_system'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-30 16:59:31
