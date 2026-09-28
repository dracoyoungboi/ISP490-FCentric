-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: fashion_system
-- ------------------------------------------------------
-- Server version	8.0.46
CREATE DATABASE IF NOT EXISTS fashion_system;
USE fashion_system;
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
INSERT INTO `anh_bien_the` VALUES (21,82,69,1,'2026-03-14 04:21:08',NULL),(22,83,71,1,'2026-03-18 21:40:48',NULL),(23,84,72,1,'2026-03-18 21:40:48',NULL),(24,85,73,1,'2026-03-18 21:40:48',NULL),(25,86,75,1,'2026-03-18 22:43:31',NULL),(26,87,76,1,'2026-03-18 22:43:31',NULL),(27,88,78,1,'2026-03-18 22:51:12',NULL),(28,89,79,1,'2026-03-18 22:51:12',NULL),(29,90,81,1,'2026-03-18 22:58:20',NULL);
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
INSERT INTO `anh_quan_ao` VALUES (46,53,62,1,1,'2026-03-14 04:21:08',NULL),(47,53,63,0,1,'2026-03-14 04:21:08',NULL),(48,53,64,0,1,'2026-03-14 04:21:08',NULL),(49,52,66,1,1,'2026-03-14 11:03:01',NULL),(50,54,70,1,1,'2026-03-18 21:40:48',NULL),(51,55,74,1,1,'2026-03-18 22:43:31',NULL),(52,56,77,1,1,'2026-03-18 22:51:12',NULL),(53,57,80,1,1,'2026-03-18 22:58:20',NULL);
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
INSERT INTO `bien_the_san_pham` VALUES (14,19,11,4,1,'HSQEQQ123','HSQEQQ123',26631.58,31958.00,1,NULL,'2026-03-25 17:55:46'),(15,20,11,4,1,'hsshashsa','hsshashsa',185030.30,222037.00,1,NULL,'2026-03-13 14:34:40'),(16,21,5,5,3,'','',0.00,0.00,0,NULL,'2026-03-11 03:07:50'),(73,48,16,1,1,'ATS25046','ATS25046',159000.00,159000.00,0,NULL,'2026-03-21 04:17:26'),(74,48,16,2,1,'ATS25049','ATS25049',15900.00,169000.00,0,NULL,'2026-03-21 04:17:27'),(75,48,16,3,1,'ATS25047','ATS25047',159000.00,178997.00,0,NULL,'2026-03-08 03:41:32'),(76,48,11,4,1,'ATS25048','ATS25048',159000.00,179000.00,0,NULL,'2026-03-21 04:17:26'),(77,48,11,5,1,'ATS25040','ATS25040',159000.00,198999.00,0,NULL,'2026-03-21 04:17:26'),(81,52,15,1,5,'ABC','ABC',150000.00,180000.00,1,NULL,'2026-03-25 03:48:39'),(82,53,6,5,1,'AT2603141-CL005-S-M002','',2222.00,22222.00,1,'2026-03-18 21:21:46','2026-03-18 21:51:23'),(83,54,2,1,1,'AT2603191-CL001-S-M002','',50000.00,60000.00,1,'2026-03-18 21:21:46','2026-03-18 21:51:23'),(84,54,4,2,1,'AT2603191-CL001-M-M004','',50000.00,60000.00,1,'2026-03-18 21:21:46','2026-03-18 21:51:23'),(85,54,3,4,1,'AT2603191-CL001-XL-M003','',50000.00,60000.00,1,'2026-03-18 21:21:46','2026-03-18 21:51:23'),(86,55,6,1,5,'QN2603191-CL005-S-M006','',100000.00,120000.00,1,'2026-03-18 22:43:31','2026-03-18 22:52:53'),(87,55,4,2,5,'QN2603191-CL005-M-M004','',100000.00,120000.00,1,'2026-03-18 22:43:31','2026-03-18 22:52:53'),(88,56,6,1,5,'QN2603192-CL005-S-M006','',0.00,0.00,1,'2026-03-18 22:51:12','2026-03-18 22:52:53'),(89,56,4,1,5,'QN2603192-CL005-S-M004','',0.00,0.00,1,'2026-03-18 22:51:12','2026-03-18 22:52:53'),(90,57,2,2,2,'QN2603193-CL002-M-M002','',2000.00,2400.00,1,'2026-03-18 22:58:20','2026-03-24 17:49:25');
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
INSERT INTO `chi_tiet_don_ban_hang` (`id`, `don_ban_hang_id`, `bien_the_san_pham_id`, `so_luong_dat`, `so_luong_da_giao`, `don_gia`, `ghi_chu`) VALUES (38,43,81,1.000,0.000,180000.00,NULL),(39,46,81,10.000,10.000,180000.00,NULL),(40,47,81,10.000,10.000,180000.00,NULL),(41,48,81,2.000,2.000,180000.00,NULL),(42,49,81,5.000,5.000,168081.00,NULL),(43,50,81,5.000,5.000,130000.00,NULL),(44,51,14,10.000,10.000,90000.00,NULL),(45,52,14,10.000,10.000,75000.00,NULL),(46,53,14,10.000,10.000,22000.00,NULL),(47,54,14,8.000,8.000,22000.00,NULL),(48,55,14,1.000,0.000,28746.00,NULL),(49,56,14,1.000,1.000,28000.00,NULL),(54,61,14,1.000,0.000,30000.00,NULL),(55,62,14,1.000,0.000,30000.00,NULL),(56,63,14,1.000,0.000,30000.00,NULL),(57,64,81,1.000,0.000,180000.00,NULL),(58,66,81,1.000,0.000,180000.00,NULL),(59,68,81,1.000,0.000,180000.00,NULL),(60,69,14,1.000,0.000,30000.00,NULL),(61,70,14,1.000,0.000,30000.00,NULL),(62,71,14,1.000,1.000,30000.00,NULL),(63,72,81,1.000,0.000,180000.00,NULL),(64,73,81,1.000,1.000,180000.00,NULL),(65,74,81,1.000,0.000,180000.00,NULL),(66,75,81,1.000,0.000,180000.00,NULL),(67,76,14,1.000,0.000,31958.00,NULL),(68,77,14,1.000,0.000,31958.00,NULL),(69,78,81,1.000,0.000,180000.00,NULL),(70,79,81,1.000,0.000,180000.00,NULL),(71,80,81,1.000,0.000,180000.00,NULL),(72,81,81,1.000,0.000,180000.00,NULL);
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
INSERT INTO `chi_tiet_don_mua_hang` (`id`, `don_mua_hang_id`, `bien_the_san_pham_id`, `so_luong_dat`, `so_luong_da_nhan`, `don_gia`, `ghi_chu`) VALUES (77,81,81,1.000,0.000,0.00,''),(78,82,81,1.000,0.000,0.00,''),(79,83,81,3.000,0.000,0.00,''),(80,84,81,2.000,0.000,50000.00,''),(81,85,81,1.000,0.000,100000.00,''),(82,86,81,1.000,0.000,0.00,''),(83,87,81,1.000,0.000,50000.00,''),(84,88,81,1.000,0.000,0.00,''),(85,89,81,1.000,0.000,0.00,''),(86,90,81,1.000,0.000,0.00,''),(87,91,81,5.000,0.000,2000.00,''),(88,92,81,3.000,3.000,1000.00,''),(89,93,81,5.000,0.000,1000.00,''),(90,94,81,2.000,2.000,1000.00,''),(91,95,81,3.000,0.000,0.00,''),(92,96,81,4.000,0.000,1000.00,''),(93,97,81,2.000,2.000,1000.00,''),(94,98,84,3.000,0.000,1000.00,''),(95,98,83,1.000,0.000,2000.00,''),(96,98,85,1.000,0.000,1000.00,''),(97,99,89,2.000,0.000,0.00,''),(98,100,89,20.000,0.000,0.00,''),(99,101,89,1.000,0.000,0.00,''),(100,102,88,1.000,0.000,0.00,''),(101,103,81,1.000,0.000,1000.00,''),(102,103,90,1.000,0.000,1000.00,''),(103,104,81,1.000,0.000,0.00,''),(104,104,89,2.000,0.000,0.00,''),(105,105,81,1.000,0.000,2000.00,''),(106,106,89,2.000,0.000,2000.00,''),(107,106,88,1.000,0.000,1000.00,''),(108,107,81,1.000,0.000,0.00,''),(109,108,81,1.000,0.000,2000.00,''),(110,109,90,4.000,0.000,1000.00,''),(111,110,90,10.000,0.000,1000.00,''),(112,111,81,4.000,0.000,1000.00,''),(113,112,81,4.000,0.000,1000.00,''),(114,113,81,4.000,0.000,1000.00,''),(115,114,89,2.000,0.000,1000.00,''),(116,114,88,1.000,0.000,1000.00,''),(117,115,88,1.000,0.000,0.00,''),(118,115,86,1.000,0.000,0.00,''),(119,116,89,1.000,0.000,1000.00,''),(121,118,15,10.000,0.000,0.00,''),(122,119,14,10.000,10.000,200.00,''),(123,120,14,10.000,10.000,100000.00,''),(124,121,14,15.000,15.000,100000.00,''),(125,122,14,15.000,15.000,1000.00,''),(126,123,14,10.000,10.000,10000.00,''),(127,124,14,1.000,0.000,0.00,''),(128,125,90,1.000,1.000,2000.00,''),(129,127,90,1.000,0.000,2000.00,NULL),(130,128,90,1.000,0.000,5000.00,NULL),(131,129,89,1.000,0.000,0.00,NULL),(132,130,90,1.000,0.000,5000.00,NULL),(133,131,90,1.000,0.000,10000.00,NULL),(134,132,81,1.000,0.000,5000.00,NULL),(135,133,81,1.000,0.000,2000.00,NULL),(136,134,81,1.000,0.000,0.00,NULL),(137,135,81,1.000,0.000,0.00,NULL),(138,136,81,1.000,0.000,3000.00,NULL),(139,137,81,1.000,0.000,10000.00,NULL),(140,138,81,1.000,0.000,2000.00,NULL),(141,139,81,1.000,0.000,0.00,NULL),(142,140,90,1.000,0.000,5000.00,NULL),(143,141,90,1.000,0.000,2000.00,NULL),(144,142,90,1.000,0.000,2000.00,NULL),(145,143,90,1.000,0.000,10000.00,NULL);
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
INSERT INTO `chi_tiet_kiem_ke` VALUES (2,1,14,40,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:49:08',1,NULL,NULL,NULL,'2026-03-09 17:48:59','2026-03-09 17:49:08'),(3,1,14,41,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:49:08',1,NULL,NULL,NULL,'2026-03-09 17:48:59','2026-03-09 17:49:08'),(4,1,15,42,10.000,NULL,10.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:49:08',1,NULL,NULL,NULL,'2026-03-09 17:48:59','2026-03-09 17:49:08'),(5,1,14,44,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:49:08',1,NULL,NULL,NULL,'2026-03-09 17:49:00','2026-03-09 17:49:08'),(6,1,81,45,20.000,NULL,20.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:49:08',1,NULL,NULL,NULL,'2026-03-09 17:49:00','2026-03-09 17:49:08'),(7,1,81,46,50.000,NULL,50.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:49:08',1,NULL,NULL,NULL,'2026-03-09 17:49:00','2026-03-09 17:49:08'),(8,1,81,47,100.000,NULL,100.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:49:08',1,NULL,NULL,NULL,'2026-03-09 17:49:00','2026-03-09 17:49:08'),(9,2,15,42,15.000,NULL,15.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:04:33',1,NULL,NULL,NULL,'2026-03-09 17:49:30','2026-03-09 18:04:33'),(11,4,14,40,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:50:48',1,NULL,NULL,NULL,'2026-03-09 17:50:17','2026-03-09 17:50:48'),(12,4,14,41,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:50:48',1,NULL,NULL,NULL,'2026-03-09 17:50:17','2026-03-09 17:50:48'),(13,4,15,42,10.000,NULL,10.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:50:48',1,NULL,NULL,NULL,'2026-03-09 17:50:17','2026-03-09 17:50:48'),(14,4,14,44,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:50:48',1,NULL,NULL,NULL,'2026-03-09 17:50:17','2026-03-09 17:50:48'),(15,4,81,45,20.000,NULL,20.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:50:48',1,NULL,NULL,NULL,'2026-03-09 17:50:17','2026-03-09 17:50:48'),(16,4,81,46,50.000,NULL,50.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:50:48',1,NULL,NULL,NULL,'2026-03-09 17:50:17','2026-03-09 17:50:48'),(17,4,81,47,100.000,NULL,100.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 17:50:48',1,NULL,NULL,NULL,'2026-03-09 17:50:17','2026-03-09 17:50:48'),(18,5,14,40,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:04:45',1,NULL,NULL,NULL,'2026-03-09 18:04:41','2026-03-09 18:04:45'),(19,5,14,41,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:04:45',1,NULL,NULL,NULL,'2026-03-09 18:04:41','2026-03-09 18:04:45'),(20,5,15,42,10.000,NULL,9.000,NULL,-1.000,NULL,NULL,'thieu',NULL,NULL,1,'2026-03-09 18:04:45',1,NULL,NULL,NULL,'2026-03-09 18:04:41','2026-03-09 18:04:45'),(21,5,14,44,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:04:45',1,NULL,NULL,NULL,'2026-03-09 18:04:41','2026-03-09 18:04:45'),(22,5,81,45,20.000,NULL,20.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:04:45',1,NULL,NULL,NULL,'2026-03-09 18:04:41','2026-03-09 18:04:45'),(23,5,81,46,50.000,NULL,50.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:04:46',1,NULL,NULL,NULL,'2026-03-09 18:04:41','2026-03-09 18:04:46'),(24,5,81,47,100.000,NULL,100.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:04:46',1,NULL,NULL,NULL,'2026-03-09 18:04:41','2026-03-09 18:04:46'),(25,7,14,40,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:05:54',1,NULL,NULL,NULL,'2026-03-09 18:05:49','2026-03-09 18:05:54'),(26,7,14,41,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:05:54',1,NULL,NULL,NULL,'2026-03-09 18:05:49','2026-03-09 18:05:54'),(27,7,15,42,9.000,NULL,9.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:05:54',1,NULL,NULL,NULL,'2026-03-09 18:05:49','2026-03-09 18:05:54'),(28,7,14,44,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:05:54',1,NULL,NULL,NULL,'2026-03-09 18:05:49','2026-03-09 18:05:54'),(29,7,81,45,20.000,NULL,20.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:05:54',1,NULL,NULL,NULL,'2026-03-09 18:05:49','2026-03-09 18:05:54'),(30,7,81,46,50.000,NULL,50.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:05:54',1,NULL,NULL,NULL,'2026-03-09 18:05:49','2026-03-09 18:05:54'),(31,7,81,47,100.000,NULL,95.000,NULL,-5.000,NULL,NULL,'thieu',NULL,NULL,1,'2026-03-09 18:05:54',1,NULL,NULL,NULL,'2026-03-09 18:05:49','2026-03-09 18:05:54'),(33,11,14,40,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:12:57',1,NULL,NULL,NULL,'2026-03-09 18:12:11','2026-03-09 18:12:57'),(34,11,14,41,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:12:57',1,NULL,NULL,NULL,'2026-03-09 18:12:12','2026-03-09 18:12:57'),(35,11,15,42,9.000,NULL,9.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:12:57',1,NULL,NULL,NULL,'2026-03-09 18:12:12','2026-03-09 18:12:57'),(36,11,14,44,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:12:57',1,NULL,NULL,NULL,'2026-03-09 18:12:12','2026-03-09 18:12:57'),(37,11,81,45,20.000,NULL,20.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:12:57',1,NULL,NULL,NULL,'2026-03-09 18:12:12','2026-03-09 18:12:57'),(38,11,81,46,50.000,NULL,50.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-09 18:12:57',1,NULL,NULL,NULL,'2026-03-09 18:12:12','2026-03-09 18:12:57'),(39,11,81,47,95.000,NULL,100.000,NULL,5.000,NULL,NULL,'thua',NULL,NULL,1,'2026-03-09 18:12:57',1,NULL,NULL,NULL,'2026-03-09 18:12:12','2026-03-09 18:12:57'),(40,12,14,40,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 03:22:43',1,NULL,NULL,NULL,'2026-03-12 03:22:06','2026-03-12 03:22:43'),(41,12,14,41,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 03:22:44',1,NULL,NULL,NULL,'2026-03-12 03:22:06','2026-03-12 03:22:44'),(42,12,15,42,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 03:22:44',1,NULL,NULL,NULL,'2026-03-12 03:22:07','2026-03-12 03:22:44'),(43,12,14,44,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 03:22:44',1,NULL,NULL,NULL,'2026-03-12 03:22:07','2026-03-12 03:22:44'),(44,12,81,45,20.000,NULL,20.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 03:22:45',1,NULL,NULL,NULL,'2026-03-12 03:22:07','2026-03-12 03:22:45'),(45,12,81,46,50.000,NULL,50.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 03:22:45',1,NULL,NULL,NULL,'2026-03-12 03:22:07','2026-03-12 03:22:45'),(46,12,81,47,100.000,NULL,111.000,NULL,11.000,NULL,NULL,'thua',NULL,NULL,1,'2026-03-12 03:22:45',1,NULL,NULL,NULL,'2026-03-12 03:22:07','2026-03-12 03:22:45'),(47,12,15,49,6.000,NULL,6.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 03:22:44',1,NULL,NULL,NULL,'2026-03-12 03:22:07','2026-03-12 03:22:44'),(48,12,15,50,10.000,NULL,10.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 03:22:45',1,NULL,NULL,NULL,'2026-03-12 03:22:08','2026-03-12 03:22:45'),(49,13,15,42,15.000,NULL,15.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 14:20:31',1,NULL,NULL,NULL,'2026-03-12 14:20:19','2026-03-12 14:20:31'),(54,19,15,42,15.000,NULL,15.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-12 15:23:51',1,NULL,NULL,NULL,'2026-03-12 15:13:32','2026-03-12 15:23:51'),(55,20,14,40,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-12 15:28:22',NULL),(56,20,14,41,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-12 15:28:22',NULL),(57,20,15,42,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-12 15:28:22',NULL),(58,20,14,44,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-12 15:28:22',NULL),(59,20,81,45,20.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-12 15:28:22',NULL),(60,20,81,46,50.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-12 15:28:22',NULL),(61,20,81,47,111.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-12 15:28:22',NULL),(62,20,15,49,6.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-12 15:28:22',NULL),(63,20,15,50,10.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-12 15:28:23',NULL),(64,21,81,51,50.000,NULL,50.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-14 08:32:32',1,NULL,NULL,NULL,'2026-03-14 08:27:47','2026-03-14 08:32:32'),(65,22,81,51,50.000,NULL,50.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-14 08:32:18',1,NULL,NULL,NULL,'2026-03-14 08:32:12','2026-03-14 08:32:18'),(66,24,81,51,50.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-14 09:39:05',NULL),(67,25,81,51,21.000,NULL,21.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-17 18:06:25',1,NULL,NULL,NULL,'2026-03-17 18:06:18','2026-03-17 18:06:25'),(68,26,81,51,29.000,NULL,28.000,NULL,-1.000,NULL,NULL,'thieu',NULL,NULL,1,'2026-03-17 18:06:48',1,NULL,NULL,NULL,'2026-03-17 18:06:42','2026-03-17 18:06:48'),(69,27,81,51,28.000,NULL,29.000,NULL,1.000,NULL,NULL,'thua',NULL,NULL,1,'2026-03-17 18:08:29',1,NULL,NULL,NULL,'2026-03-17 18:08:17','2026-03-17 18:08:29'),(70,28,81,51,11.000,NULL,13.000,NULL,2.000,NULL,NULL,'thua',NULL,NULL,1,'2026-03-26 01:40:54',1,NULL,NULL,NULL,'2026-03-26 01:40:15','2026-03-26 01:40:54'),(71,28,81,52,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:55',1,NULL,NULL,NULL,'2026-03-26 01:40:15','2026-03-26 01:40:55'),(72,28,81,53,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:56',1,NULL,NULL,NULL,'2026-03-26 01:40:16','2026-03-26 01:40:56'),(73,28,81,55,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:56',1,NULL,NULL,NULL,'2026-03-26 01:40:16','2026-03-26 01:40:56'),(74,28,81,56,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:56',1,NULL,NULL,NULL,'2026-03-26 01:40:16','2026-03-26 01:40:56'),(75,28,81,57,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:56',1,NULL,NULL,NULL,'2026-03-26 01:40:16','2026-03-26 01:40:56'),(76,28,14,58,10.000,NULL,15.000,NULL,5.000,NULL,NULL,'thua',NULL,NULL,1,'2026-03-26 01:40:52',1,NULL,NULL,NULL,'2026-03-26 01:40:16','2026-03-26 01:40:52'),(77,28,14,60,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:52',1,NULL,NULL,NULL,'2026-03-26 01:40:16','2026-03-26 01:40:52'),(78,28,14,61,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:53',1,NULL,NULL,NULL,'2026-03-26 01:40:16','2026-03-26 01:40:53'),(79,28,14,62,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:53',1,NULL,NULL,NULL,'2026-03-26 01:40:17','2026-03-26 01:40:53'),(80,28,14,63,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:53',1,NULL,NULL,NULL,'2026-03-26 01:40:17','2026-03-26 01:40:53'),(81,28,14,64,4.000,NULL,4.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:54',1,NULL,NULL,NULL,'2026-03-26 01:40:17','2026-03-26 01:40:54'),(82,28,14,65,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:54',1,NULL,NULL,NULL,'2026-03-26 01:40:17','2026-03-26 01:40:54'),(83,28,14,66,0.000,NULL,0.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:54',1,NULL,NULL,NULL,'2026-03-26 01:40:17','2026-03-26 01:40:54'),(84,28,90,68,1.000,NULL,1.000,NULL,0.000,NULL,NULL,'khop',NULL,NULL,1,'2026-03-26 01:40:56',1,NULL,NULL,NULL,'2026-03-26 01:40:17','2026-03-26 01:40:56'),(85,29,81,51,13.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:37',NULL),(86,29,81,52,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:37',NULL),(87,29,81,53,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:37',NULL),(88,29,81,55,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:38',NULL),(89,29,81,56,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:38',NULL),(90,29,81,57,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:38',NULL),(91,29,14,58,15.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:38',NULL),(92,29,14,60,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:38',NULL),(93,29,14,61,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:39',NULL),(94,29,14,62,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:39',NULL),(95,29,14,63,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:39',NULL),(96,29,14,64,4.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:39',NULL),(97,29,14,65,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:39',NULL),(98,29,14,66,0.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:39',NULL),(99,29,90,68,1.000,NULL,0.000,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'2026-03-26 01:42:40',NULL);
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
INSERT INTO `chi_tiet_phieu_nhap_kho` (`id`, `phieu_nhap_kho_id`, `bien_the_san_pham_id`, `lo_hang_id`, `so_luong_nhap`, `don_gia`, `ghi_chu`, `ngay_tao`) VALUES (87,58,81,51,10.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-16 14:44:43'),(88,59,81,51,10.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-16 18:55:27'),(89,60,81,51,1.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-16 19:02:10'),(90,61,81,NULL,1.000,100000.00,NULL,'2026-03-17 01:54:41'),(91,62,81,51,1.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-18 14:59:08'),(92,63,81,51,10.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-18 15:52:03'),(93,64,81,51,1.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-18 17:34:06'),(94,65,81,51,1.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-18 17:47:04'),(95,66,81,51,1.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-18 17:55:11'),(96,67,81,51,1.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-18 17:58:30'),(97,68,81,51,10.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-18 18:15:04'),(98,69,81,51,1.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-18 18:51:26'),(99,70,81,51,1.000,150000.00,'Kế thừa từ hàng đi đường','2026-03-18 19:27:41'),(100,71,81,NULL,2.000,1000.00,NULL,'2026-03-18 20:06:22'),(101,72,81,NULL,2.000,1000.00,NULL,'2026-03-18 20:09:48'),(102,72,81,52,1.000,1000.00,'1','2026-03-18 20:10:16'),(103,72,81,53,1.000,1000.00,'1','2026-03-18 20:10:36'),(104,73,81,NULL,3.000,1000.00,NULL,'2026-03-18 20:31:42'),(105,73,81,54,3.000,1000.00,'','2026-03-18 20:32:21'),(106,74,81,NULL,3.000,1000.00,NULL,'2026-03-18 20:51:10'),(107,74,81,55,3.000,1000.00,'','2026-03-18 20:51:25'),(108,75,81,NULL,2.000,1000.00,NULL,'2026-03-18 21:03:45'),(109,75,81,56,1.000,1000.00,'','2026-03-18 21:04:07'),(110,75,81,57,1.000,1000.00,'','2026-03-18 21:04:20'),(111,76,81,52,1.000,1000.00,'Kế thừa từ hàng đi đường','2026-03-18 21:22:55'),(112,76,81,53,1.000,1000.00,'Kế thừa từ hàng đi đường','2026-03-18 21:22:55'),(113,77,81,NULL,2.000,2000.00,NULL,'2026-03-18 22:15:34'),(114,78,81,53,1.000,1000.00,'Kế thừa từ hàng đi đường','2026-03-18 22:47:20'),(115,79,14,NULL,10.000,200.00,NULL,'2026-03-21 05:38:10'),(116,79,14,58,10.000,200.00,'','2026-03-21 05:38:24'),(117,80,14,NULL,10.000,100000.00,NULL,'2026-03-21 06:01:20'),(119,80,14,60,5.000,100000.00,'','2026-03-21 06:01:51'),(120,80,14,61,5.000,100000.00,'','2026-03-21 06:02:00'),(121,81,14,NULL,15.000,100000.00,NULL,'2026-03-21 06:49:35'),(122,81,14,62,10.000,100000.00,'','2026-03-21 06:49:59'),(123,81,14,63,5.000,100000.00,'','2026-03-21 06:50:13'),(124,82,14,62,5.000,100000.00,'Kế thừa từ hàng đi đường','2026-03-21 07:44:21'),(125,83,14,62,5.000,100000.00,'Kế thừa từ hàng đi đường','2026-03-21 07:46:14'),(126,84,14,NULL,15.000,1000.00,NULL,'2026-03-23 15:29:25'),(127,84,14,64,15.000,1000.00,'','2026-03-23 15:29:45'),(128,85,14,58,3.000,200.00,'Kế thừa từ hàng đi đường','2026-03-23 15:40:42'),(129,85,14,64,2.000,1000.00,'Kế thừa từ hàng đi đường','2026-03-23 15:40:42'),(130,86,14,NULL,10.000,10000.00,NULL,'2026-03-24 01:05:49'),(131,86,14,65,5.000,10000.00,'','2026-03-24 01:06:22'),(132,86,14,66,5.000,10000.00,'','2026-03-24 01:06:34'),(133,87,90,NULL,4.000,1000.00,NULL,'2026-03-24 02:08:57'),(134,88,81,NULL,2.000,1000.00,NULL,'2026-03-24 02:14:28'),(135,88,81,67,2.000,1000.00,'','2026-03-24 02:14:46'),(136,89,90,NULL,1.000,2000.00,NULL,'2026-03-24 17:48:43'),(137,89,90,68,1.000,2000.00,'','2026-03-24 17:49:20'),(138,90,81,NULL,4.000,1000.00,NULL,'2026-03-24 17:59:04'),(139,91,14,64,1.000,1000.00,'Kế thừa từ hàng đi đường','2026-03-25 02:54:28'),(142,94,81,51,1.000,150000.00,'Hoàn trả từ lô: ABC-X','2026-03-25 17:29:37'),(143,97,14,64,1.000,1000.00,'Hoàn trả từ lô: LOssss','2026-03-25 17:55:23'),(144,98,81,51,1.000,150000.00,'Hoàn trả từ lô: ABC-X','2026-03-25 17:57:43'),(145,99,81,51,1.000,150000.00,'Hoàn trả từ lô: ABC-X','2026-03-25 18:14:40');
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
INSERT INTO `chi_tiet_phieu_xuat_kho` VALUES (102,97,81,NULL,10.000,NULL,NULL,'2026-03-16 14:10:08'),(103,98,81,NULL,10.000,NULL,NULL,'2026-03-16 14:10:24'),(104,98,81,51,10.000,150000.00,NULL,'2026-03-16 14:44:07'),(106,101,81,NULL,10.000,NULL,NULL,'2026-03-16 18:36:51'),(107,102,81,NULL,10.000,NULL,NULL,'2026-03-16 18:54:07'),(108,102,81,51,10.000,150000.00,NULL,'2026-03-16 18:54:18'),(109,103,81,NULL,1.000,NULL,NULL,'2026-03-16 18:59:58'),(110,104,81,NULL,1.000,NULL,NULL,'2026-03-16 19:01:24'),(111,104,81,51,1.000,150000.00,NULL,'2026-03-16 19:01:33'),(112,105,81,NULL,10.000,NULL,NULL,'2026-03-18 13:24:19'),(113,106,81,NULL,5.000,NULL,NULL,'2026-03-18 13:24:41'),(114,106,81,51,5.000,150000.00,NULL,'2026-03-18 13:24:47'),(115,107,81,NULL,5.000,NULL,NULL,'2026-03-18 13:35:25'),(116,107,81,51,5.000,150000.00,NULL,'2026-03-18 13:35:29'),(117,108,81,NULL,10.000,NULL,NULL,'2026-03-18 13:37:42'),(118,108,81,51,10.000,150000.00,NULL,'2026-03-18 13:37:49'),(119,109,81,NULL,1.000,NULL,NULL,'2026-03-18 14:57:57'),(120,110,81,NULL,1.000,NULL,NULL,'2026-03-18 14:58:13'),(121,110,81,51,1.000,150000.00,NULL,'2026-03-18 14:58:23'),(122,111,81,NULL,10.000,NULL,NULL,'2026-03-18 15:49:29'),(123,112,81,NULL,10.000,NULL,NULL,'2026-03-18 15:51:04'),(124,112,81,51,10.000,150000.00,NULL,'2026-03-18 15:51:14'),(125,113,81,NULL,1.000,NULL,NULL,'2026-03-18 16:05:15'),(126,114,81,NULL,1.000,NULL,NULL,'2026-03-18 16:16:29'),(127,115,81,NULL,1.000,NULL,NULL,'2026-03-18 16:41:18'),(128,116,81,NULL,1.000,NULL,NULL,'2026-03-18 16:41:45'),(129,117,81,NULL,1.000,NULL,NULL,'2026-03-18 17:05:09'),(130,118,81,NULL,1.000,NULL,NULL,'2026-03-18 17:15:36'),(131,118,81,51,1.000,150000.00,NULL,'2026-03-18 17:15:46'),(132,119,81,NULL,1.000,NULL,NULL,'2026-03-18 17:56:02'),(133,120,81,NULL,1.000,NULL,NULL,'2026-03-18 17:57:35'),(134,120,81,51,1.000,150000.00,NULL,'2026-03-18 17:57:50'),(135,121,81,NULL,1.000,NULL,NULL,'2026-03-18 18:05:33'),(136,122,81,NULL,10.000,NULL,NULL,'2026-03-18 18:06:10'),(137,123,81,NULL,10.000,NULL,NULL,'2026-03-18 18:14:29'),(138,123,81,51,10.000,150000.00,NULL,'2026-03-18 18:14:37'),(141,126,81,NULL,1.000,NULL,NULL,'2026-03-18 18:33:48'),(142,127,81,NULL,1.000,NULL,NULL,'2026-03-18 18:40:05'),(143,127,81,51,1.000,150000.00,NULL,'2026-03-18 18:50:10'),(144,128,81,NULL,1.000,NULL,NULL,'2026-03-18 18:55:39'),(145,129,81,NULL,1.000,NULL,NULL,'2026-03-18 19:01:14'),(146,130,81,NULL,1.000,NULL,NULL,'2026-03-18 19:05:45'),(148,130,81,51,1.000,150000.00,NULL,'2026-03-18 19:27:09'),(149,132,81,NULL,1.000,NULL,NULL,'2026-03-18 19:46:38'),(150,132,81,51,1.000,150000.00,NULL,'2026-03-18 19:46:43'),(151,133,81,NULL,1.000,NULL,NULL,'2026-03-18 19:47:38'),(152,133,81,51,1.000,150000.00,NULL,'2026-03-18 19:47:44'),(153,134,81,NULL,3.000,NULL,NULL,'2026-03-18 20:23:37'),(154,134,81,51,3.000,150000.00,NULL,'2026-03-18 20:23:45'),(155,135,81,NULL,2.000,NULL,NULL,'2026-03-18 20:24:06'),(156,135,81,51,2.000,150000.00,NULL,'2026-03-18 20:24:28'),(157,136,81,NULL,2.000,NULL,NULL,'2026-03-18 21:07:49'),(158,136,81,56,1.000,1000.00,NULL,'2026-03-18 21:08:07'),(159,136,81,57,1.000,1000.00,NULL,'2026-03-18 21:08:07'),(160,137,81,NULL,3.000,NULL,NULL,'2026-03-18 21:09:51'),(161,137,81,55,3.000,1000.00,NULL,'2026-03-18 21:11:43'),(162,138,81,NULL,2.000,NULL,NULL,'2026-03-18 21:15:08'),(163,139,81,NULL,2.000,NULL,NULL,'2026-03-18 21:16:39'),(164,139,81,52,1.000,1000.00,NULL,'2026-03-18 21:17:07'),(165,139,81,53,1.000,1000.00,NULL,'2026-03-18 21:17:07'),(166,140,81,NULL,1.000,NULL,NULL,'2026-03-18 21:37:16'),(167,141,81,NULL,1.000,NULL,NULL,'2026-03-18 21:37:29'),(168,141,81,53,1.000,1000.00,NULL,'2026-03-18 21:37:38'),(169,142,14,NULL,10.000,NULL,NULL,'2026-03-21 07:12:53'),(170,142,14,60,5.000,100000.00,NULL,'2026-03-21 07:13:07'),(171,142,14,61,5.000,100000.00,NULL,'2026-03-21 07:13:08'),(172,143,14,NULL,10.000,NULL,NULL,'2026-03-21 07:33:47'),(173,143,14,62,5.000,100000.00,NULL,'2026-03-21 07:34:04'),(174,143,14,63,5.000,100000.00,NULL,'2026-03-21 07:34:04'),(175,144,14,NULL,5.000,NULL,NULL,'2026-03-21 07:40:51'),(176,145,14,NULL,5.000,NULL,NULL,'2026-03-21 07:41:51'),(177,145,14,62,5.000,100000.00,NULL,'2026-03-21 07:42:02'),(178,146,14,NULL,5.000,NULL,NULL,'2026-03-21 07:45:16'),(179,147,14,NULL,5.000,NULL,NULL,'2026-03-21 07:45:37'),(180,147,14,62,5.000,100000.00,NULL,'2026-03-21 07:45:45'),(181,148,14,NULL,10.000,NULL,NULL,'2026-03-23 15:31:25'),(182,148,14,64,10.000,1000.00,NULL,'2026-03-23 15:31:32'),(183,149,14,NULL,5.000,NULL,NULL,'2026-03-23 15:35:35'),(184,150,14,NULL,5.000,NULL,NULL,'2026-03-23 15:36:17'),(189,150,14,58,3.000,200.00,NULL,'2026-03-23 15:38:44'),(190,150,14,64,2.000,1000.00,NULL,'2026-03-23 15:38:44'),(191,151,14,NULL,8.000,NULL,NULL,'2026-03-24 01:20:34'),(192,151,14,65,5.000,10000.00,NULL,'2026-03-24 01:20:51'),(193,151,14,66,3.000,10000.00,NULL,'2026-03-24 01:20:52'),(194,152,14,NULL,1.000,NULL,NULL,'2026-03-24 19:13:34'),(195,153,14,NULL,1.000,NULL,NULL,'2026-03-25 02:38:14'),(196,154,14,NULL,1.000,NULL,NULL,'2026-03-25 02:45:23'),(197,154,14,64,1.000,1000.00,NULL,'2026-03-25 02:45:44'),(198,155,14,NULL,1.000,NULL,NULL,'2026-03-25 03:07:46'),(199,155,14,66,1.000,10000.00,NULL,'2026-03-25 03:07:53'),(208,160,14,NULL,1.000,NULL,NULL,'2026-03-25 14:56:16'),(209,160,14,64,1.000,1000.00,NULL,'2026-03-25 14:56:22'),(210,161,81,NULL,1.000,NULL,NULL,'2026-03-25 15:03:39'),(211,161,81,51,1.000,150000.00,NULL,'2026-03-25 15:03:44'),(212,162,81,NULL,1.000,NULL,NULL,'2026-03-25 16:31:39'),(213,162,81,51,1.000,150000.00,NULL,'2026-03-25 16:31:45'),(214,163,14,NULL,1.000,NULL,NULL,'2026-03-25 17:52:10'),(215,163,14,64,1.000,1000.00,NULL,'2026-03-25 17:52:13'),(216,164,81,NULL,1.000,NULL,NULL,'2026-03-25 17:56:48'),(217,164,81,51,1.000,150000.00,NULL,'2026-03-25 17:56:54'),(218,165,81,NULL,1.000,NULL,NULL,'2026-03-25 18:14:06'),(219,165,81,51,1.000,150000.00,NULL,'2026-03-25 18:14:10');
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
INSERT INTO `chi_tiet_quyen_kho` VALUES (404,57,9,1,'2026-03-16 18:28:52',NULL),(405,57,14,1,'2026-03-16 18:28:53',NULL),(406,57,16,1,'2026-03-16 18:28:53',NULL),(407,57,15,1,'2026-03-16 18:28:53',NULL),(408,57,4,1,'2026-03-16 18:28:53',NULL),(409,57,12,1,'2026-03-16 18:28:53',NULL),(410,57,21,1,'2026-03-16 18:28:53',NULL),(411,57,2,1,'2026-03-16 18:28:53',NULL),(412,57,7,1,'2026-03-16 18:28:53',NULL),(413,57,18,1,'2026-03-16 18:28:53',NULL),(414,57,1,1,'2026-03-16 18:28:53',NULL),(415,58,1,1,'2026-03-16 18:30:24',NULL),(416,58,18,1,'2026-03-16 18:30:25',NULL),(417,58,16,1,'2026-03-16 18:30:25',NULL),(418,58,9,1,'2026-03-16 18:30:25',NULL),(419,58,14,1,'2026-03-16 18:30:25',NULL),(420,58,15,1,'2026-03-16 18:30:25',NULL),(421,58,21,1,'2026-03-16 18:30:25',NULL),(422,58,2,1,'2026-03-16 18:30:25',NULL),(423,58,12,1,'2026-03-16 18:30:25',NULL),(424,58,7,1,'2026-03-16 18:30:25',NULL),(425,58,4,1,'2026-03-16 18:31:01',NULL),(426,59,9,1,'2026-03-16 18:32:21',NULL),(427,59,16,1,'2026-03-16 18:32:21',NULL),(428,59,13,1,'2026-03-16 18:32:21',NULL),(429,59,7,1,'2026-03-16 18:32:22',NULL),(430,59,14,1,'2026-03-16 18:32:22',NULL),(431,59,12,1,'2026-03-16 18:32:22',NULL),(432,59,3,1,'2026-03-16 18:32:22',NULL),(433,59,8,1,'2026-03-16 18:32:22',NULL),(434,59,18,1,'2026-03-16 18:32:22',NULL),(435,59,22,1,'2026-03-16 18:32:22',NULL),(436,59,2,1,'2026-03-16 18:32:22',NULL),(437,59,4,1,'2026-03-16 18:32:22',NULL),(438,59,21,1,'2026-03-16 18:32:22',NULL),(439,59,15,1,'2026-03-16 18:32:22',NULL),(440,59,19,1,'2026-03-16 18:32:23',NULL),(441,59,1,1,'2026-03-16 18:32:23',NULL),(442,60,2,1,'2026-03-16 18:32:50',NULL),(443,60,18,1,'2026-03-16 18:32:50',NULL),(444,60,3,1,'2026-03-16 18:32:50',NULL),(445,60,4,1,'2026-03-16 18:32:50',NULL),(446,60,1,1,'2026-03-16 18:32:50',NULL),(447,60,13,1,'2026-03-16 18:32:50',NULL),(448,60,19,1,'2026-03-16 18:32:50',NULL),(449,60,21,1,'2026-03-16 18:32:50',NULL),(450,60,9,1,'2026-03-16 18:32:50',NULL),(451,60,16,1,'2026-03-16 18:32:50',NULL),(452,60,8,1,'2026-03-16 18:32:51',NULL),(453,60,7,1,'2026-03-16 18:32:51',NULL),(454,60,12,1,'2026-03-16 18:32:51',NULL),(455,60,22,1,'2026-03-16 18:32:51',NULL),(456,60,15,1,'2026-03-16 18:32:51',NULL),(457,60,14,1,'2026-03-16 18:32:51',NULL),(458,61,3,1,'2026-03-16 19:30:33',NULL),(459,61,4,1,'2026-03-16 19:30:33',NULL),(460,61,2,1,'2026-03-16 19:30:33',NULL),(461,61,7,1,'2026-03-16 19:30:33',NULL),(462,61,1,1,'2026-03-16 19:30:33',NULL),(463,61,5,1,'2026-03-16 19:30:34',NULL),(464,62,5,1,'2026-03-16 19:56:43',NULL),(465,62,1,1,'2026-03-16 19:56:43',NULL),(466,62,2,1,'2026-03-16 19:56:44',NULL),(467,62,7,1,'2026-03-16 19:56:44',NULL),(468,62,3,1,'2026-03-16 19:56:44',NULL),(469,63,12,1,'2026-03-17 01:04:55',NULL),(470,63,1,1,'2026-03-17 01:04:55',NULL),(471,63,5,1,'2026-03-17 01:04:56',NULL),(472,63,2,1,'2026-03-17 01:04:56',NULL),(473,63,3,1,'2026-03-17 01:04:56',NULL),(474,63,10,1,'2026-03-17 01:04:56',NULL),(501,66,1,1,'2026-03-18 16:37:36',NULL),(502,66,2,1,'2026-03-18 16:37:36',NULL),(503,66,11,1,'2026-03-18 16:37:36',NULL),(504,66,15,1,'2026-03-18 16:37:36',NULL),(548,71,2,1,'2026-03-19 04:46:27',NULL),(549,71,5,1,'2026-03-19 04:46:27',NULL),(550,71,7,1,'2026-03-19 04:46:27',NULL),(551,71,1,1,'2026-03-19 04:46:27',NULL),(552,72,5,1,'2026-03-19 04:47:47',NULL),(553,72,1,1,'2026-03-19 04:47:47',NULL),(554,72,2,1,'2026-03-19 04:47:47',NULL),(555,72,15,1,'2026-03-19 04:47:47',NULL),(560,57,5,1,'2026-03-20 19:20:54',NULL),(561,59,6,1,'2026-03-20 19:39:12',NULL);
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
INSERT INTO `chi_tiet_yeu_cau_mua_hang` VALUES (2,2,89,1.000,NULL),(3,3,90,1.000,NULL),(4,4,81,1.000,NULL),(5,5,81,1.000,NULL),(6,6,81,1.000,NULL),(7,7,81,1.000,NULL),(8,8,81,1.000,NULL),(9,9,90,1.000,NULL),(10,10,90,1.000,NULL),(11,11,81,1.000,NULL);
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
INSERT INTO `danh_muc_quan_ao` VALUES (1,'DM001','Áo',NULL,'Tất cả các loại áo',1,'2026-01-21 13:53:09'),(2,'DM002','Quần',NULL,'Tất cả các loại quần',1,'2026-01-21 13:53:09'),(3,'DM003','Váy',NULL,'Tất cả các loại váy',1,'2026-01-21 13:53:09'),(4,'DM004','Áo thun ',1,'Áo thun các loại',1,'2026-01-21 13:53:09'),(5,'DM005','Áo sơ mi',1,'Áo sơ mi nam nữ',0,'2026-01-21 13:53:09'),(6,'DM006','Áo khoác',1,'Áo khoác, áo jacket',1,'2026-01-21 13:53:09'),(7,'DM007','Áo polo',1,'Áo polo nam nữ',0,'2026-01-21 13:53:09'),(8,'DM008','Quần jean',2,'Quần jean các kiểu',1,'2026-01-21 13:53:09'),(9,'DM009','Quần kaki',2,'Quần kaki công sở',1,'2026-01-21 13:53:09'),(10,'DM010','Quần tây',2,'Quần tây lịch sự',1,'2026-01-21 13:53:09'),(11,'DM011','Quần short',2,'Quần short thể thao',1,'2026-01-21 13:53:09'),(12,'DM012','Váy công sở',3,'Váy cho công sở',1,'2026-01-21 13:53:09'),(13,'DM013','Váy dạ hội',3,'Váy dự tiệc',1,'2026-01-21 13:53:09'),(14,'XXXX3','Quần Nỉ',2,'string',1,'2026-01-21 17:09:10'),(15,'XXXX4','Quần da',2,'string',1,'2026-01-22 03:33:31'),(16,'XXXX5','Quần Nỉ',2,'string',1,'2026-01-25 20:50:25'),(17,'DMM008','áo len',1,'Áo len các loại',0,'2026-02-24 03:28:31'),(18,'DMMM','túi',NULL,'',0,'2026-02-24 03:36:10'),(19,'DMMMMM','áo khoác gi',6,'',0,'2026-02-24 03:38:52'),(20,'DMtest','Phụ kiện',NULL,'các loại phụ kiện trang phụ',0,'2026-02-24 03:52:17'),(21,'DMtest1','Túi xách',20,'các loại túi xách',0,'2026-02-24 03:52:39'),(22,'DMtest2','Túi tote',21,'tote',1,'2026-02-24 03:53:19'),(23,'DMtestx','túi đeo chéo',21,'chéo',1,'2026-02-24 03:53:40'),(24,'DM014','Đầm',NULL,'các loại đầm',1,'2026-03-25 15:46:03');
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
INSERT INTO `don_ban_hang` VALUES (43,'SO202603161','don_ban_hang',6,1,'2026-03-16 13:49:24',NULL,4,180000.00,0.00,180000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,1,NULL,'2026-03-16 13:49:23','2026-03-16 13:53:41',NULL,NULL,NULL),(46,'SO202603181','don_ban_hang',7,1,'2026-03-18 13:23:27',NULL,5,1800000.00,0.00,1800000.00,'chua_thanh_toan','56 Điện Biên Phủ, Hà Nội','',NULL,1,NULL,'2026-03-18 13:23:27','2026-03-18 13:36:32',NULL,NULL,NULL),(47,'SO202603182','don_ban_hang',6,2,'2026-03-18 13:37:28',NULL,5,1800000.00,0.00,1800000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,1,NULL,'2026-03-18 13:37:28','2026-03-18 13:38:12',NULL,NULL,NULL),(48,'SO202603191','don_ban_hang',6,1,'2026-03-18 19:45:22',NULL,5,360000.00,0.00,360000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,1,NULL,'2026-03-18 19:45:22','2026-03-20 12:59:49',NULL,NULL,NULL),(49,'SO202603192','don_ban_hang',6,1,'2026-03-18 20:21:54',NULL,5,840405.00,0.00,840405.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-18 20:21:53','2026-03-20 12:59:43',NULL,NULL,NULL),(50,'SO202603193','don_ban_hang',6,1,'2026-03-18 21:06:44',NULL,5,650000.00,0.00,650000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-18 21:06:44','2026-03-18 21:12:58',NULL,NULL,NULL),(51,'SO202603211','don_ban_hang',7,1,'2026-03-21 07:12:18',NULL,5,900000.00,10000.00,910000.00,'chua_thanh_toan','56 Điện Biên Phủ, Hà Nội','',NULL,37,NULL,'2026-03-21 07:12:17','2026-03-21 07:14:32',NULL,NULL,NULL),(52,'SO202603212','don_ban_hang',7,1,'2026-03-21 07:32:48',NULL,5,750000.00,10000.00,760000.00,'chua_thanh_toan','56 Điện Biên Phủ, Hà Nội','',NULL,37,NULL,'2026-03-21 07:32:47','2026-03-21 07:34:58',NULL,NULL,NULL),(53,'SO202603231','don_ban_hang',3,1,'2026-03-23 15:31:10',NULL,5,220000.00,0.00,220000.00,'chua_thanh_toan','67 Trần Hưng Đạo, Đà Nẵng','',NULL,37,NULL,'2026-03-23 15:31:10','2026-03-23 15:32:55',NULL,NULL,NULL),(54,'SO202603241','don_ban_hang',6,1,'2026-03-24 01:18:08',NULL,5,176000.00,0.00,176000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-24 01:18:08','2026-03-24 01:22:51',NULL,NULL,NULL),(55,'SO202603251','don_ban_hang',6,1,'2026-03-24 18:34:39',NULL,4,28746.00,0.00,28746.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-24 18:34:38','2026-03-25 02:57:30',NULL,NULL,NULL),(56,'SO202603252','don_ban_hang',8,1,'2026-03-25 03:07:23',NULL,5,28000.00,0.00,28000.00,'chua_thanh_toan','78 Võ Văn Tần, Quận 3, TP.HCM','',NULL,37,NULL,'2026-03-25 03:07:22','2026-03-25 03:13:20',NULL,NULL,NULL),(61,'BG202603251','don_ban_hang',6,1,'2026-03-25 09:38:49',NULL,4,30000.00,10000.00,40000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 09:33:33','2026-03-25 09:49:20',NULL,NULL,NULL),(62,'BG202603252','bao_gia',6,NULL,'2026-03-25 09:48:20',NULL,2,30000.00,10000.00,40000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 09:48:20','2026-03-25 09:48:38',NULL,NULL,NULL),(63,'SO202603257','don_ban_hang',6,1,'2026-03-25 09:48:37',NULL,4,30000.00,10000.00,40000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 09:48:38','2026-03-25 09:49:14',NULL,NULL,NULL),(64,'BG202603253','bao_gia',7,NULL,'2026-03-25 10:04:37',NULL,4,180000.00,0.00,180000.00,'chua_thanh_toan','56 Điện Biên Phủ, Hà Nội','','Khách hàng chê đắt',37,NULL,'2026-03-25 10:04:37','2026-03-25 14:00:32',NULL,NULL,NULL),(66,'SO202603253','don_ban_hang',7,1,'2026-03-25 10:08:18',NULL,4,180000.00,0.00,180000.00,'chua_thanh_toan','56 Điện Biên Phủ, Hà Nội','',NULL,37,NULL,'2026-03-25 10:08:18','2026-03-25 10:08:29',NULL,NULL,NULL),(68,'SO202603253-1','don_ban_hang',7,1,'2026-03-25 10:14:12',NULL,4,180000.00,0.00,180000.00,'chua_thanh_toan','56 Điện Biên Phủ, Hà Nội','',NULL,37,NULL,'2026-03-25 10:14:13','2026-03-25 10:15:21',NULL,NULL,NULL),(69,'BG202603254','bao_gia',6,NULL,'2026-03-25 14:02:18',NULL,2,30000.00,0.00,30000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 14:02:18','2026-03-25 14:55:48',NULL,NULL,NULL),(70,'SO202603254','don_ban_hang',6,1,'2026-03-25 14:55:30',NULL,4,30000.00,0.00,30000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 14:55:30','2026-03-25 14:55:36',NULL,NULL,NULL),(71,'SO202603254-1','don_ban_hang',6,1,'2026-03-25 14:55:48',NULL,5,30000.00,0.00,30000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 14:55:48','2026-03-25 14:57:35',NULL,NULL,NULL),(72,'BG202603255','bao_gia',6,NULL,'2026-03-25 15:03:14',NULL,2,180000.00,0.00,180000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 15:03:15','2026-03-25 15:03:22',NULL,NULL,NULL),(73,'SO202603255','don_ban_hang',6,1,'2026-03-25 15:03:21',NULL,5,180000.00,0.00,180000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 15:03:22','2026-03-25 16:30:33',NULL,NULL,NULL),(74,'BG202603256','bao_gia',6,NULL,'2026-03-25 16:31:12',NULL,2,180000.00,0.00,180000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 16:31:12','2026-03-25 16:31:23',NULL,NULL,NULL),(75,'SO202603256','don_ban_hang',6,1,'2026-03-25 16:31:22',NULL,6,180000.00,0.00,180000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 16:31:23','2026-03-25 16:34:58',NULL,NULL,NULL),(76,'BG202603261','bao_gia',6,NULL,'2026-03-25 17:51:32',NULL,2,31958.00,0.00,31958.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 17:51:33','2026-03-25 17:51:42',NULL,NULL,NULL),(77,'SO202603261','don_ban_hang',6,1,'2026-03-25 17:51:42',NULL,6,31958.00,0.00,31958.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 17:51:42','2026-03-25 17:52:35',NULL,NULL,NULL),(78,'BG202603262','bao_gia',6,NULL,'2026-03-25 17:56:20',NULL,2,180000.00,0.00,180000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 17:56:20','2026-03-25 17:56:26',NULL,NULL,NULL),(79,'SO202603262','don_ban_hang',6,1,'2026-03-25 17:56:26',NULL,6,180000.00,0.00,180000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 17:56:26','2026-03-25 17:57:17',NULL,NULL,NULL),(80,'BG202603263','bao_gia',6,NULL,'2026-03-25 18:13:38',NULL,2,180000.00,0.00,180000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 18:13:38','2026-03-25 18:13:48',NULL,NULL,NULL),(81,'SO202603263','don_ban_hang',6,1,'2026-03-25 18:13:48',NULL,6,180000.00,0.00,180000.00,'chua_thanh_toan','34 Nguyễn Huệ, Đà Nẵng','',NULL,37,NULL,'2026-03-25 18:13:48','2026-03-25 18:14:21',NULL,NULL,NULL);
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
INSERT INTO `don_mua_hang` VALUES (81,NULL,'PO202603171062',1,1,'2026-03-16 00:00:00','2026-03-20 00:00:00',1,0.00,'',44,NULL,'2026-03-16 19:52:14','2026-03-16 19:52:14'),(82,NULL,'PO202603177720',2,2,'2026-03-16 00:00:00','2026-03-20 00:00:00',1,0.00,'ok',44,NULL,'2026-03-16 19:58:01','2026-03-16 19:58:01'),(83,NULL,'PO202603170603',1,1,'2026-03-16 00:00:00','2026-03-20 00:00:00',1,0.00,'',44,NULL,'2026-03-16 20:03:12','2026-03-16 20:03:12'),(84,NULL,'PO202603176912',1,1,'2026-03-16 00:00:00','2026-03-19 00:00:00',4,100000.00,'',44,NULL,'2026-03-16 20:09:09','2026-03-16 20:10:19'),(85,NULL,'PO202603173633',1,2,'2026-03-16 00:00:00','2026-03-20 00:00:00',4,100000.00,'',44,NULL,'2026-03-16 20:21:33','2026-03-16 20:22:25'),(86,NULL,'PO202603170424',1,1,'2026-03-17 00:00:00','2026-03-20 00:00:00',3,0.00,'',44,NULL,'2026-03-17 00:52:11','2026-03-17 00:52:18'),(87,NULL,'PO202603171331',1,1,'2026-03-17 00:00:00','2026-03-20 00:00:00',5,50000.00,'',44,NULL,'2026-03-17 14:18:18','2026-03-20 23:10:18'),(88,NULL,'PO202603175964',1,1,'2026-03-17 00:00:00','2026-03-30 00:00:00',6,0.00,'',44,NULL,'2026-03-17 14:24:48','2026-03-18 22:29:59'),(89,NULL,'PO202603175966',1,1,'2026-03-17 00:00:00','2026-03-30 00:00:00',3,0.00,'',44,NULL,'2026-03-17 15:16:55','2026-03-17 15:17:00'),(90,NULL,'PO202603175967',1,1,'2026-03-17 00:00:00','2026-03-30 00:00:00',3,0.00,'',44,NULL,'2026-03-17 15:24:05','2026-03-17 15:24:10'),(91,NULL,'PO202603193748',1,1,'2026-03-18 00:00:00','2026-03-20 00:00:00',4,10000.00,'',44,NULL,'2026-03-18 19:02:03','2026-03-18 19:03:43'),(92,NULL,'PO202603195599',1,1,'2026-03-18 00:00:00','2026-03-20 00:00:00',4,3000.00,'',44,NULL,'2026-03-18 19:14:18','2026-03-18 19:14:55'),(93,NULL,'PO202603194944',1,1,'2026-03-18 00:00:00','2026-03-20 00:00:00',5,5000.00,'',44,NULL,'2026-03-18 19:29:04','2026-03-18 19:44:25'),(94,NULL,'PO202603194066',2,1,'2026-03-18 00:00:00','2026-03-27 00:00:00',4,2000.00,'',44,NULL,'2026-03-18 19:59:55','2026-03-18 20:01:46'),(95,NULL,'PO202603194261',1,1,'2026-03-18 00:00:00','2026-03-20 00:00:00',6,0.00,'',44,NULL,'2026-03-18 20:38:38','2026-03-18 22:28:41'),(96,NULL,'PO202603195496',1,1,'2026-03-18 00:00:00','2026-03-20 00:00:00',5,4000.00,'',44,NULL,'2026-03-18 20:47:26','2026-03-18 20:50:15'),(97,NULL,'PO202603194102',1,1,'2026-03-18 00:00:00','2026-03-20 00:00:00',4,2000.00,'',44,NULL,'2026-03-18 21:01:04','2026-03-18 21:02:13'),(98,NULL,'PO202603190613',1,1,'2026-03-18 00:00:00','2026-03-28 00:00:00',5,6000.00,'',44,NULL,'2026-03-18 22:32:03','2026-03-18 22:34:16'),(99,NULL,'PO202603199425',1,1,'2026-03-18 00:00:00','2026-03-20 00:00:00',6,0.00,'',44,NULL,'2026-03-18 22:55:05','2026-03-18 22:55:37'),(100,NULL,'PO202603193297',1,1,'2026-03-19 00:00:00','2026-03-21 00:00:00',6,0.00,'',44,NULL,'2026-03-19 04:13:06','2026-03-19 04:26:15'),(101,NULL,'PO202603195049',1,1,'2026-03-19 00:00:00','2026-03-21 00:00:00',6,0.00,'',43,NULL,'2026-03-19 04:22:32','2026-03-19 04:26:13'),(102,NULL,'PO202603190110',1,1,'2026-03-19 00:00:00','2026-03-21 00:00:00',6,0.00,'',44,NULL,'2026-03-19 04:25:47','2026-03-19 04:26:10'),(103,NULL,'PO202603219838',3,1,'2026-03-20 00:00:00','2026-03-24 00:00:00',6,2000.00,'Thiếu 2 sản phẩm',39,NULL,'2026-03-20 19:21:41','2026-03-24 17:50:54'),(104,NULL,'PO202603217652',3,1,'2026-03-20 00:00:00','2026-03-23 00:00:00',3,0.00,'3 sp',39,NULL,'2026-03-20 20:06:07','2026-03-20 20:25:38'),(105,NULL,'PO202603212284',1,1,'2026-03-20 00:00:00','2026-03-27 00:00:00',6,2000.00,'',39,NULL,'2026-03-20 20:31:16','2026-03-20 20:59:48'),(106,NULL,'PO202603217943',3,1,'2026-03-20 00:00:00','2026-03-22 00:00:00',5,5000.00,'',39,NULL,'2026-03-20 20:45:33','2026-03-20 20:59:26'),(107,NULL,'PO202603210340',1,1,'2026-03-20 00:00:00','2026-03-27 00:00:00',2,0.00,'á',39,NULL,'2026-03-20 21:05:16','2026-03-20 21:11:28'),(108,NULL,'PO202603219995',1,1,'2026-03-20 00:00:00','2026-03-24 00:00:00',6,2000.00,'',43,NULL,'2026-03-20 22:32:08','2026-03-20 23:06:49'),(109,NULL,'PO202603218219',3,1,'2026-03-20 00:00:00','2026-03-23 00:00:00',6,4000.00,'4 sp',39,NULL,'2026-03-20 23:29:07','2026-03-20 23:44:09'),(110,NULL,'PO202603216195',2,1,'2026-03-20 00:00:00','2026-03-25 00:00:00',6,10000.00,'10 sản phẩm',39,NULL,'2026-03-20 23:57:03','2026-03-25 17:33:22'),(111,NULL,'PO202603219304',1,1,'2026-03-21 00:00:00','2026-03-22 00:00:00',6,4000.00,'',39,NULL,'2026-03-21 00:01:02','2026-03-24 17:52:05'),(112,NULL,'PO202603215409',3,1,'2026-03-21 00:00:00','2026-03-26 00:00:00',6,4000.00,'',39,NULL,'2026-03-21 00:04:44','2026-03-24 16:59:03'),(113,NULL,'PO202603214109',2,1,'2026-03-21 00:00:00','2026-03-22 00:00:00',6,4000.00,'',39,NULL,'2026-03-21 00:53:28','2026-03-21 00:56:52'),(114,NULL,'PO202603219446',3,1,'2026-03-21 00:00:00','2026-03-24 00:00:00',6,3000.00,'',39,NULL,'2026-03-21 01:33:38','2026-03-21 01:40:56'),(115,NULL,NULL,NULL,1,'2026-03-21 00:00:00','2026-03-23 00:00:00',1,0.00,'',39,NULL,'2026-03-21 01:50:28','2026-03-21 01:50:28'),(116,NULL,'PO202603215065',3,1,'2026-03-21 00:00:00','2026-03-23 00:00:00',6,1000.00,'',39,NULL,'2026-03-21 01:54:35','2026-03-21 01:57:48'),(118,NULL,NULL,NULL,1,'2026-03-21 00:00:00','2026-03-24 00:00:00',0,0.00,'',39,NULL,'2026-03-21 04:39:27','2026-03-21 04:40:07'),(119,NULL,'PO202603214881',3,1,'2026-03-21 00:00:00','2026-03-24 00:00:00',6,2000.00,'',39,NULL,'2026-03-21 04:43:59','2026-03-21 05:20:04'),(120,NULL,'PO202603216510',3,1,'2026-03-21 00:00:00','2026-03-26 00:00:00',6,1000000.00,'',39,NULL,'2026-03-21 05:53:22','2026-03-21 06:00:56'),(121,NULL,'PO202603210504',3,1,'2026-03-21 00:00:00','2026-03-25 00:00:00',6,1500000.00,'Cần bổ sung gấp',39,NULL,'2026-03-21 06:44:32','2026-03-21 06:48:15'),(122,NULL,'PO202603237405',3,1,'2026-03-23 00:00:00','2026-03-25 00:00:00',6,15000.00,'',39,NULL,'2026-03-23 15:21:07','2026-03-23 15:28:18'),(123,NULL,'PO202603242918',3,1,'2026-03-24 00:00:00','2026-03-27 00:00:00',6,100000.00,'',39,NULL,'2026-03-24 00:52:31','2026-03-24 01:00:43'),(124,NULL,NULL,NULL,1,'2026-03-24 00:00:00','2026-03-27 00:00:00',2,0.00,'',1,1,'2026-03-24 02:29:31','2026-03-24 03:24:32'),(125,NULL,'PO202603241092',3,1,'2026-03-24 00:00:00','2026-03-26 00:00:00',7,2000.00,'',39,NULL,'2026-03-24 15:46:06','2026-03-24 17:40:55'),(127,1,'PO20263266414',2,1,'2026-03-25 20:19:25','2026-04-03 00:00:00',3,2000.00,NULL,39,NULL,'2026-03-25 20:19:40','2026-03-25 22:05:10'),(128,1,'PO20263260635',1,1,'2026-03-25 20:19:25','2026-04-03 00:00:00',4,5000.00,NULL,39,NULL,'2026-03-25 20:19:46','2026-03-26 00:38:18'),(129,2,'PO20263267609',1,1,'2026-03-25 22:26:27','2026-03-28 00:00:00',3,NULL,NULL,43,NULL,'2026-03-25 22:26:42','2026-03-25 22:27:03'),(130,3,'PO20263269915',1,1,'2026-03-25 22:50:38','2026-03-28 00:00:00',4,5000.00,NULL,43,NULL,'2026-03-25 22:50:53','2026-03-25 23:00:43'),(131,3,'PO20263266032',3,1,'2026-03-25 22:50:38','2026-03-28 00:00:00',3,10000.00,NULL,43,NULL,'2026-03-25 22:50:58','2026-03-25 23:00:47'),(132,4,'PO20263266799',3,1,'2026-03-25 23:06:46','2026-03-27 00:00:00',4,5000.00,NULL,43,NULL,'2026-03-25 23:07:01','2026-03-25 23:11:49'),(133,4,'PO20263263883',2,1,'2026-03-25 23:06:46','2026-03-27 00:00:00',3,2000.00,NULL,43,NULL,'2026-03-25 23:07:06','2026-03-25 23:12:20'),(134,7,'PO20263268403',3,1,'2026-03-26 00:26:28','2026-03-30 00:00:00',3,NULL,NULL,43,NULL,'2026-03-26 00:26:30','2026-03-26 00:34:54'),(135,7,'PO20263260137',10,1,'2026-03-26 00:26:28','2026-03-30 00:00:00',4,NULL,NULL,43,NULL,'2026-03-26 00:26:35','2026-03-26 00:35:44'),(136,8,'PO20263262575',3,1,'2026-03-26 00:56:06','2026-03-30 00:00:00',5,3000.00,NULL,43,NULL,'2026-03-26 00:56:07','2026-03-26 01:27:21'),(137,8,'PO20263268097',10,1,'2026-03-26 00:56:06','2026-03-30 00:00:00',4,10000.00,NULL,43,NULL,'2026-03-26 00:56:12','2026-03-26 01:21:22'),(138,5,'PO20263265972',3,1,'2026-03-26 01:53:54','2026-03-29 00:00:00',3,2000.00,NULL,43,NULL,'2026-03-26 01:53:55','2026-03-26 02:31:13'),(139,5,'PO20263265191',10,1,'2026-03-26 01:53:54','2026-03-29 00:00:00',3,NULL,NULL,43,NULL,'2026-03-26 01:54:00','2026-03-26 02:50:12'),(140,9,'PO20263264457',1,1,'2026-03-26 02:58:14','2026-03-28 00:00:00',4,5000.00,NULL,43,NULL,'2026-03-26 02:58:30','2026-03-26 03:01:08'),(141,9,'PO20263266249',2,1,'2026-03-26 02:58:14','2026-03-28 00:00:00',3,2000.00,NULL,43,NULL,'2026-03-26 02:58:34','2026-03-26 03:01:14'),(142,10,'PO20263263378',1,1,'2026-03-26 03:25:01','2026-03-28 00:00:00',3,2000.00,NULL,43,NULL,'2026-03-26 03:25:18','2026-03-26 03:27:23'),(143,10,'PO20263265072',2,1,'2026-03-26 03:25:01','2026-03-28 00:00:00',2,10000.00,NULL,43,NULL,'2026-03-26 03:25:25','2026-03-26 03:26:37');
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
INSERT INTO `dot_kiem_ke` VALUES (1,'KK1773078539241','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-09 17:48:59',NULL,'2026-03-09 17:49:08',1,1,NULL,NULL,NULL,NULL,'','2026-03-09 17:48:59','2026-03-09 17:49:08'),(2,'KK1773078570112','Kiểm kê kho Kho Miền Nam',2,'toan_bo','2026-03-09 17:49:30',NULL,'2026-03-09 18:04:33',1,1,NULL,NULL,NULL,NULL,'','2026-03-09 17:49:30','2026-03-09 18:04:33'),(4,'KK1773078616697','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-09 17:50:17',NULL,'2026-03-09 17:50:49',1,1,NULL,NULL,NULL,NULL,'','2026-03-09 17:50:17','2026-03-09 17:50:49'),(5,'KK1773079480624','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-09 18:04:41',NULL,'2026-03-09 18:04:46',1,1,NULL,NULL,NULL,NULL,'','2026-03-09 18:04:41','2026-03-09 18:04:46'),(7,'KK1773079548526','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-09 18:05:49',NULL,'2026-03-09 18:05:54',1,1,NULL,NULL,NULL,NULL,'','2026-03-09 18:05:49','2026-03-09 18:05:54'),(11,'KK1773079931402','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-09 18:12:11',NULL,'2026-03-09 18:12:57',1,1,NULL,NULL,NULL,NULL,'','2026-03-09 18:12:11','2026-03-09 18:12:57'),(12,'KK1773285725785','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-12 03:22:06',NULL,'2026-03-12 03:22:46',1,1,NULL,NULL,NULL,NULL,'','2026-03-12 03:22:06','2026-03-12 03:22:46'),(13,'KK1773325219138','Kiểm kê kho Kho Miền Nam',2,'toan_bo','2026-03-12 14:20:19',NULL,'2026-03-12 14:20:31',1,1,NULL,NULL,NULL,NULL,'','2026-03-12 14:20:19','2026-03-12 14:20:31'),(19,'KK1773328411952','Kiểm kê kho Kho Miền Nam',2,'toan_bo','2026-03-12 15:13:32',NULL,'2026-03-12 15:23:51',1,1,NULL,NULL,NULL,NULL,'','2026-03-12 15:13:32','2026-03-12 15:23:51'),(20,'KK1773329301997','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-12 15:28:22',NULL,NULL,0,1,NULL,NULL,NULL,NULL,'','2026-03-12 15:28:22','2026-03-12 15:28:22'),(21,'KK1773476867184','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-14 08:27:47',NULL,'2026-03-14 08:32:32',1,1,NULL,NULL,NULL,NULL,'','2026-03-14 08:27:47','2026-03-14 08:32:32'),(22,'KK1773477131689','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-14 08:32:12',NULL,'2026-03-14 08:32:19',1,1,NULL,NULL,NULL,NULL,'','2026-03-14 08:32:12','2026-03-14 08:32:19'),(24,'KK1773481145238','Kiểm kê kho Kho Hà Nội - Updated',1,'toan_bo','2026-03-14 09:39:05',NULL,NULL,0,1,NULL,NULL,NULL,NULL,'','2026-03-14 09:39:05','2026-03-14 09:39:05'),(25,'KK1773770778118','Kiểm kê kho Kho Hồ Chí Minh',2,'toan_bo','2026-03-17 18:06:18',NULL,'2026-03-17 18:06:25',1,1,NULL,NULL,NULL,NULL,'','2026-03-17 18:06:18','2026-03-17 18:06:25'),(26,'KK1773770802185','Kiểm kê kho Kho Hà Nội',1,'toan_bo','2026-03-17 18:06:42',NULL,'2026-03-17 18:06:48',1,1,NULL,NULL,NULL,NULL,'','2026-03-17 18:06:42','2026-03-17 18:06:48'),(27,'KK1773770896628','Kiểm kê kho Kho Hà Nội',1,'toan_bo','2026-03-17 18:08:17',NULL,'2026-03-17 18:08:29',1,1,NULL,NULL,NULL,NULL,'','2026-03-17 18:08:17','2026-03-17 18:08:29'),(28,'KK1774489214929','Kiểm kê kho Kho Hà Nội',1,'toan_bo','2026-03-26 01:40:15',NULL,'2026-03-26 01:40:57',1,1,NULL,NULL,NULL,NULL,'','2026-03-26 01:40:15','2026-03-26 01:40:57'),(29,'KK1774489356690','Kiểm kê kho Kho Hà Nội',1,'toan_bo','2026-03-26 01:42:37',NULL,NULL,0,1,NULL,NULL,NULL,NULL,'','2026-03-26 01:42:37','2026-03-26 01:42:37');
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kenh_ban_hang`
--

LOCK TABLES `kenh_ban_hang` WRITE;
/*!40000 ALTER TABLE `kenh_ban_hang` DISABLE KEYS */;
INSERT INTO `kenh_ban_hang` VALUES (1,'POS','Bán hàng tại quầy','offline',NULL,NULL,NULL,1,'2026-09-21 01:33:25','2026-09-21 01:33:25'),(2,'SHOPIFY','Website Shopify','online',NULL,NULL,NULL,1,'2026-09-21 01:33:25','2026-09-21 01:33:25'),(3,'LAZADA','Lazada Mall','online',NULL,NULL,NULL,1,'2026-09-21 01:33:25','2026-09-21 01:33:25'),(4,'SHOPEE','Shopee Mall','online',NULL,NULL,NULL,1,'2026-09-21 01:33:25','2026-09-21 01:33:25');
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
INSERT INTO `kho` VALUES (1,'KHO01','Kho Hà Nội','Hà Nội',41,1,'2026-01-21 13:53:10'),(2,'KHO02','Kho Hồ Chí Minh','Hồ Chí Minh',42,1,'2026-01-21 13:53:10'),(20,'KHO_TRANSIT','Kho Trung Chuyển','Kho ảo phục vụ luân chuyển hàng hóa giữa các kho',42,1,'2026-03-04 11:17:07'),(21,'KHOTESST','testtt','áafsdafdsf',41,0,'2026-03-17 15:10:59');
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
INSERT INTO `lich_su_giao_dich_kho` VALUES (106,'2026-03-16 18:54:22','nhap_kho','phieu_xuat_kho',102,81,51,20,NULL,10.000,0.000,10.000,150000.00,39,'Hàng đang đi đường: PX202603171'),(107,'2026-03-16 18:54:22','xuat_kho','phieu_xuat_kho',102,81,51,1,NULL,10.000,40.000,30.000,150000.00,39,'Xuất chuyển kho: PX202603171'),(108,'2026-03-16 18:55:34','nhap_kho','phieu_nhap_kho',59,81,51,2,NULL,10.000,10.000,20.000,150000.00,40,'Nhập chuyển kho từ yêu cầu: PX-TRF-202603171'),(109,'2026-03-16 19:01:36','nhap_kho','phieu_xuat_kho',104,81,51,20,NULL,1.000,0.000,1.000,150000.00,41,'Hàng đang đi đường: PX202603172'),(110,'2026-03-16 19:01:36','xuat_kho','phieu_xuat_kho',104,81,51,1,NULL,1.000,30.000,29.000,150000.00,41,'Xuất chuyển kho: PX202603172'),(111,'2026-03-16 19:02:16','nhap_kho','phieu_nhap_kho',60,81,51,2,NULL,1.000,20.000,21.000,150000.00,40,'Nhập chuyển kho từ yêu cầu: PX-TRF-202603172'),(112,'2026-03-17 18:06:47','dieu_chinh','kiem_ke',26,81,51,1,NULL,-1.000,29.000,28.000,NULL,1,NULL),(113,'2026-03-17 18:08:28','dieu_chinh','kiem_ke',27,81,51,1,NULL,1.000,28.000,29.000,NULL,1,NULL),(114,'2026-03-18 13:24:50','xuat_kho','phieu_xuat_kho',106,81,51,1,NULL,5.000,29.000,24.000,150000.00,41,'Xuất kho cho phiếu: PX202603182'),(115,'2026-03-18 13:35:32','xuat_kho','phieu_xuat_kho',107,81,51,1,NULL,5.000,24.000,19.000,150000.00,1,'Xuất kho cho phiếu: PX202603183'),(116,'2026-03-18 13:37:54','xuat_kho','phieu_xuat_kho',108,81,51,2,NULL,10.000,21.000,11.000,150000.00,1,'Xuất kho cho phiếu: PX202603184'),(117,'2026-03-18 14:58:26','nhap_kho','phieu_xuat_kho',110,81,51,20,NULL,1.000,0.000,1.000,150000.00,1,'Hàng đang đi đường: PX202603185'),(118,'2026-03-18 14:58:26','xuat_kho','phieu_xuat_kho',110,81,51,1,NULL,1.000,19.000,18.000,150000.00,1,'Xuất chuyển kho: PX202603185'),(119,'2026-03-18 15:51:18','nhap_kho','phieu_xuat_kho',112,81,51,20,NULL,10.000,1.000,11.000,150000.00,41,'Hàng đang đi đường: PX202603186'),(120,'2026-03-18 15:51:18','xuat_kho','phieu_xuat_kho',112,81,51,1,NULL,10.000,18.000,8.000,150000.00,41,'Xuất chuyển kho: PX202603186'),(121,'2026-03-18 15:52:30','nhap_kho','phieu_nhap_kho',63,81,51,2,NULL,10.000,11.000,21.000,150000.00,40,'Nhập chuyển kho từ yêu cầu: PX-TRF-202603182'),(122,'2026-03-18 17:15:48','nhap_kho','phieu_xuat_kho',118,81,51,20,NULL,1.000,1.000,2.000,150000.00,41,'Hàng đang đi đường: PX202603192'),(123,'2026-03-18 17:15:49','xuat_kho','phieu_xuat_kho',118,81,51,1,NULL,1.000,8.000,7.000,150000.00,41,'Xuất chuyển kho: PX202603192'),(124,'2026-03-18 17:47:14','nhap_kho','phieu_nhap_kho',65,81,51,1,NULL,1.000,7.000,8.000,150000.00,41,'Hoàn trả nhập kho (Hủy yêu cầu): PX-TRF-202603181'),(125,'2026-03-18 17:55:17','nhap_kho','phieu_nhap_kho',66,81,51,1,NULL,1.000,8.000,9.000,150000.00,41,'Hoàn trả nhập kho (Hủy yêu cầu): PX-TRF-202603186'),(126,'2026-03-18 17:57:52','nhap_kho','phieu_xuat_kho',120,81,51,20,NULL,1.000,0.000,1.000,150000.00,39,'Hàng đang đi đường: PX202603193'),(127,'2026-03-18 17:57:52','xuat_kho','phieu_xuat_kho',120,81,51,1,NULL,1.000,9.000,8.000,150000.00,39,'Xuất chuyển kho: PX202603193'),(128,'2026-03-18 17:58:42','nhap_kho','phieu_nhap_kho',67,81,51,2,NULL,1.000,21.000,22.000,150000.00,40,'Nhập chuyển kho từ yêu cầu: PX-TRF-202603191'),(129,'2026-03-18 18:14:40','nhap_kho','phieu_xuat_kho',123,81,51,20,NULL,10.000,0.000,10.000,150000.00,40,'Hàng đang đi đường: PX202603194'),(130,'2026-03-18 18:14:40','xuat_kho','phieu_xuat_kho',123,81,51,2,NULL,10.000,22.000,12.000,150000.00,40,'Xuất chuyển kho: PX202603194'),(131,'2026-03-18 18:15:14','nhap_kho','phieu_nhap_kho',68,81,51,1,NULL,10.000,8.000,18.000,150000.00,41,'Nhập chuyển kho từ yêu cầu: PX-TRF-202603193'),(132,'2026-03-18 18:50:12','nhap_kho','phieu_xuat_kho',127,81,51,20,NULL,1.000,0.000,1.000,150000.00,40,'Hàng đang đi đường: PX202603195'),(133,'2026-03-18 18:50:12','xuat_kho','phieu_xuat_kho',127,81,51,2,NULL,1.000,12.000,11.000,150000.00,40,'Xuất chuyển kho: PX202603195'),(134,'2026-03-18 18:51:34','nhap_kho','phieu_nhap_kho',69,81,51,1,NULL,1.000,18.000,19.000,150000.00,41,'Nhập chuyển kho từ yêu cầu: PX-TRF-202603194'),(135,'2026-03-18 19:27:12','nhap_kho','phieu_xuat_kho',130,81,51,20,NULL,1.000,0.000,1.000,150000.00,40,'Hàng đang đi đường: PX202603196'),(136,'2026-03-18 19:27:12','xuat_kho','phieu_xuat_kho',130,81,51,2,NULL,1.000,11.000,10.000,150000.00,40,'Xuất chuyển kho: PX202603196'),(137,'2026-03-18 19:27:50','nhap_kho','phieu_nhap_kho',70,81,51,1,NULL,1.000,19.000,20.000,150000.00,39,'Nhập chuyển kho từ yêu cầu: PX-TRF-202603196'),(138,'2026-03-18 19:47:15','xuat_kho','phieu_xuat_kho',132,81,51,1,NULL,1.000,20.000,19.000,150000.00,1,'Xuất kho cho phiếu: PX202603197'),(139,'2026-03-18 19:47:47','xuat_kho','phieu_xuat_kho',133,81,51,1,NULL,1.000,19.000,18.000,150000.00,1,'Xuất kho cho phiếu: PX202603198'),(140,'2026-03-18 20:10:56','nhap_kho','phieu_nhap_kho',72,81,52,1,NULL,1.000,0.000,1.000,1000.00,42,'Nhập kho từ phiếu: PN202603192'),(141,'2026-03-18 20:10:56','nhap_kho','phieu_nhap_kho',72,81,53,1,NULL,1.000,0.000,1.000,1000.00,42,'Nhập kho từ phiếu: PN202603192'),(142,'2026-03-18 20:23:47','xuat_kho','phieu_xuat_kho',134,81,51,1,NULL,3.000,18.000,15.000,150000.00,39,'Xuất kho cho phiếu: PX202603199'),(143,'2026-03-18 20:24:35','xuat_kho','phieu_xuat_kho',135,81,51,1,NULL,2.000,15.000,13.000,150000.00,39,'Xuất kho cho phiếu: PX2026031910'),(144,'2026-03-18 20:52:21','nhap_kho','phieu_nhap_kho',74,81,55,1,NULL,3.000,0.000,3.000,1000.00,39,'Nhập kho từ phiếu: PN202603194'),(145,'2026-03-18 21:04:29','nhap_kho','phieu_nhap_kho',75,81,56,1,NULL,1.000,0.000,1.000,1000.00,39,'Nhập kho từ phiếu: PN202603195'),(146,'2026-03-18 21:04:29','nhap_kho','phieu_nhap_kho',75,81,57,1,NULL,1.000,0.000,1.000,1000.00,39,'Nhập kho từ phiếu: PN202603195'),(147,'2026-03-18 21:08:42','xuat_kho','phieu_xuat_kho',136,81,56,1,NULL,1.000,1.000,0.000,1000.00,39,'Xuất kho cho phiếu: PX2026031911'),(148,'2026-03-18 21:08:42','xuat_kho','phieu_xuat_kho',136,81,57,1,NULL,1.000,1.000,0.000,1000.00,39,'Xuất kho cho phiếu: PX2026031911'),(149,'2026-03-18 21:12:19','xuat_kho','phieu_xuat_kho',137,81,55,1,NULL,3.000,3.000,0.000,1000.00,39,'Xuất kho cho phiếu: PX2026031912'),(150,'2026-03-18 21:17:41','nhap_kho','phieu_xuat_kho',139,81,52,20,NULL,1.000,0.000,1.000,1000.00,39,'Hàng đang đi đường: PX2026031913'),(151,'2026-03-18 21:17:41','xuat_kho','phieu_xuat_kho',139,81,52,1,NULL,1.000,1.000,0.000,1000.00,39,'Xuất chuyển kho: PX2026031913'),(152,'2026-03-18 21:17:41','nhap_kho','phieu_xuat_kho',139,81,53,20,NULL,1.000,0.000,1.000,1000.00,39,'Hàng đang đi đường: PX2026031913'),(153,'2026-03-18 21:17:41','xuat_kho','phieu_xuat_kho',139,81,53,1,NULL,1.000,1.000,0.000,1000.00,39,'Xuất chuyển kho: PX2026031913'),(154,'2026-03-18 21:24:17','nhap_kho','phieu_nhap_kho',76,81,52,1,NULL,1.000,0.000,1.000,1000.00,39,'Hoàn trả nhập kho (Hủy yêu cầu): PX-TRF-202603197'),(155,'2026-03-18 21:24:17','nhap_kho','phieu_nhap_kho',76,81,53,1,NULL,1.000,0.000,1.000,1000.00,39,'Hoàn trả nhập kho (Hủy yêu cầu): PX-TRF-202603197'),(156,'2026-03-18 21:37:42','nhap_kho','phieu_xuat_kho',141,81,53,20,NULL,1.000,0.000,1.000,1000.00,1,'Hàng đang đi đường: PX2026031914'),(157,'2026-03-18 21:37:42','xuat_kho','phieu_xuat_kho',141,81,53,1,NULL,1.000,1.000,0.000,1000.00,1,'Xuất chuyển kho: PX2026031914'),(158,'2026-03-18 22:47:27','nhap_kho','phieu_nhap_kho',78,81,53,1,NULL,1.000,0.000,1.000,1000.00,41,'Hoàn trả nhập kho (Hủy yêu cầu): PX-TRF-202603198'),(159,'2026-03-21 05:38:54','nhap_kho','phieu_nhap_kho',79,14,58,1,NULL,10.000,0.000,10.000,200.00,39,'Nhập kho từ phiếu: PN202603211'),(160,'2026-03-21 06:02:17','nhap_kho','phieu_nhap_kho',80,14,60,1,NULL,5.000,0.000,5.000,100000.00,39,'Nhập kho từ phiếu: PN202603212'),(161,'2026-03-21 06:02:17','nhap_kho','phieu_nhap_kho',80,14,61,1,NULL,5.000,0.000,5.000,100000.00,39,'Nhập kho từ phiếu: PN202603212'),(162,'2026-03-21 06:50:34','nhap_kho','phieu_nhap_kho',81,14,62,1,NULL,10.000,0.000,10.000,100000.00,39,'Nhập kho từ phiếu: PN202603213'),(163,'2026-03-21 06:50:34','nhap_kho','phieu_nhap_kho',81,14,63,1,NULL,5.000,0.000,5.000,100000.00,39,'Nhập kho từ phiếu: PN202603213'),(164,'2026-03-21 07:13:52','xuat_kho','phieu_xuat_kho',142,14,60,1,NULL,5.000,5.000,0.000,100000.00,39,'Xuất kho cho phiếu: PX202603211'),(165,'2026-03-21 07:13:52','xuat_kho','phieu_xuat_kho',142,14,61,1,NULL,5.000,5.000,0.000,100000.00,39,'Xuất kho cho phiếu: PX202603211'),(166,'2026-03-21 07:34:18','xuat_kho','phieu_xuat_kho',143,14,62,1,NULL,5.000,10.000,5.000,100000.00,39,'Xuất kho cho phiếu: PX202603212'),(167,'2026-03-21 07:34:18','xuat_kho','phieu_xuat_kho',143,14,63,1,NULL,5.000,5.000,0.000,100000.00,39,'Xuất kho cho phiếu: PX202603212'),(168,'2026-03-21 07:42:11','nhap_kho','phieu_xuat_kho',145,14,62,20,NULL,5.000,0.000,5.000,100000.00,39,'Hàng đang đi đường: PX202603213'),(169,'2026-03-21 07:42:11','xuat_kho','phieu_xuat_kho',145,14,62,1,NULL,5.000,5.000,0.000,100000.00,39,'Xuất chuyển kho: PX202603213'),(170,'2026-03-21 07:44:42','nhap_kho','phieu_nhap_kho',82,14,62,1,NULL,5.000,0.000,5.000,100000.00,39,'Hoàn trả nhập kho (Hủy yêu cầu): PX-TRF-202603211'),(171,'2026-03-21 07:45:49','nhap_kho','phieu_xuat_kho',147,14,62,20,NULL,5.000,0.000,5.000,100000.00,39,'Hàng đang đi đường: PX202603214'),(172,'2026-03-21 07:45:49','xuat_kho','phieu_xuat_kho',147,14,62,1,NULL,5.000,5.000,0.000,100000.00,39,'Xuất chuyển kho: PX202603214'),(173,'2026-03-21 07:46:24','nhap_kho','phieu_nhap_kho',83,14,62,2,NULL,5.000,0.000,5.000,100000.00,40,'Nhập chuyển kho từ yêu cầu: PX-TRF-202603212'),(174,'2026-03-23 15:29:54','nhap_kho','phieu_nhap_kho',84,14,64,1,NULL,15.000,0.000,15.000,1000.00,39,'Nhập kho từ phiếu: PN202603231'),(175,'2026-03-23 15:32:11','xuat_kho','phieu_xuat_kho',148,14,64,1,NULL,10.000,15.000,5.000,1000.00,39,'Xuất kho cho phiếu: PX202603231'),(176,'2026-03-23 15:38:48','nhap_kho','phieu_xuat_kho',150,14,58,20,NULL,3.000,0.000,3.000,200.00,41,'Hàng đang đi đường: PX202603232'),(177,'2026-03-23 15:38:48','xuat_kho','phieu_xuat_kho',150,14,58,1,NULL,3.000,10.000,7.000,200.00,41,'Xuất chuyển kho: PX202603232'),(178,'2026-03-23 15:38:48','nhap_kho','phieu_xuat_kho',150,14,64,20,NULL,2.000,0.000,2.000,1000.00,41,'Hàng đang đi đường: PX202603232'),(179,'2026-03-23 15:38:48','xuat_kho','phieu_xuat_kho',150,14,64,1,NULL,2.000,5.000,3.000,1000.00,41,'Xuất chuyển kho: PX202603232'),(180,'2026-03-23 15:40:50','nhap_kho','phieu_nhap_kho',85,14,58,1,NULL,3.000,7.000,10.000,200.00,41,'Hoàn trả nhập kho (Hủy yêu cầu): PX-TRF-202603231'),(181,'2026-03-23 15:40:50','nhap_kho','phieu_nhap_kho',85,14,64,1,NULL,2.000,3.000,5.000,1000.00,41,'Hoàn trả nhập kho (Hủy yêu cầu): PX-TRF-202603231'),(182,'2026-03-24 01:08:00','nhap_kho','phieu_nhap_kho',86,14,65,1,NULL,5.000,0.000,5.000,10000.00,39,'Nhập kho từ phiếu: PN202603241'),(183,'2026-03-24 01:08:01','nhap_kho','phieu_nhap_kho',86,14,66,1,NULL,5.000,0.000,5.000,10000.00,39,'Nhập kho từ phiếu: PN202603241'),(184,'2026-03-24 01:21:01','xuat_kho','phieu_xuat_kho',151,14,65,1,NULL,5.000,5.000,0.000,10000.00,39,'Xuất kho cho phiếu: PX202603241'),(185,'2026-03-24 01:21:02','xuat_kho','phieu_xuat_kho',151,14,66,1,NULL,3.000,5.000,2.000,10000.00,39,'Xuất kho cho phiếu: PX202603241'),(186,'2026-03-24 17:49:25','nhap_kho','phieu_nhap_kho',89,90,68,1,NULL,1.000,0.000,1.000,2000.00,39,'Nhập kho từ phiếu: PN202603244'),(187,'2026-03-25 02:45:47','nhap_kho','phieu_xuat_kho',154,14,64,20,NULL,1.000,0.000,1.000,1000.00,39,'Hàng đang đi đường: PX202603251'),(188,'2026-03-25 02:45:47','xuat_kho','phieu_xuat_kho',154,14,64,1,NULL,1.000,5.000,4.000,1000.00,39,'Xuất chuyển kho: PX202603251'),(189,'2026-03-25 02:54:34','nhap_kho','phieu_nhap_kho',91,14,64,1,NULL,1.000,4.000,5.000,1000.00,41,'Hoàn trả nhập kho (Hủy yêu cầu): PX-TRF-202603252'),(190,'2026-03-25 03:08:10','xuat_kho','phieu_xuat_kho',155,14,66,1,NULL,1.000,2.000,1.000,10000.00,39,'Xuất kho cho phiếu: PX202603252'),(191,'2026-03-25 03:23:30','xuat_kho','phieu_xuat_kho',156,14,66,1,NULL,1.000,1.000,0.000,10000.00,39,'Xuất kho cho phiếu: PX202603253'),(192,'2026-03-25 03:25:10','xuat_kho','phieu_xuat_kho',157,81,53,1,NULL,1.000,1.000,0.000,1000.00,39,'Xuất kho cho phiếu: PX202603254'),(193,'2026-03-25 03:48:38','xuat_kho','phieu_xuat_kho',158,81,52,1,NULL,1.000,1.000,0.000,1000.00,39,'Xuất kho cho phiếu: PX202603255'),(194,'2026-03-25 04:08:21','xuat_kho','phieu_xuat_kho',159,81,51,1,NULL,1.000,13.000,12.000,150000.00,39,'Xuất kho cho phiếu: PX202603256'),(195,'2026-03-25 14:56:28','xuat_kho','phieu_xuat_kho',160,14,64,1,NULL,1.000,5.000,4.000,1000.00,39,'Xuất kho cho phiếu: PX202603253'),(196,'2026-03-25 15:03:47','xuat_kho','phieu_xuat_kho',161,81,51,1,NULL,1.000,12.000,11.000,150000.00,39,'Xuất kho cho phiếu: PX202603254'),(197,'2026-03-25 16:31:49','xuat_kho','phieu_xuat_kho',162,81,51,1,NULL,1.000,11.000,10.000,150000.00,39,'Xuất kho cho phiếu: PX202603255'),(198,'2026-03-25 17:50:48','nhap_kho','phieu_nhap_kho',94,81,51,1,NULL,1.000,10.000,11.000,150000.00,39,'Nhập hoàn trả (Return) từ phiếu: PN-RET-202603262'),(199,'2026-03-25 17:52:16','xuat_kho','phieu_xuat_kho',163,14,64,1,NULL,1.000,4.000,3.000,1000.00,39,'Xuất kho cho phiếu: PX202603261'),(200,'2026-03-25 17:55:46','nhap_kho','phieu_nhap_kho',97,14,64,1,NULL,1.000,3.000,4.000,1000.00,39,'Nhập hoàn trả (Return) từ phiếu: PN-RET-202603262'),(201,'2026-03-25 17:56:56','xuat_kho','phieu_xuat_kho',164,81,51,1,NULL,1.000,11.000,10.000,150000.00,39,'Xuất kho cho phiếu: PX202603262'),(202,'2026-03-25 17:57:53','nhap_kho','phieu_nhap_kho',98,81,51,1,NULL,1.000,10.000,11.000,150000.00,39,'Nhập hoàn trả (Return) từ phiếu: PN-RET-202603263'),(203,'2026-03-25 18:14:13','xuat_kho','phieu_xuat_kho',165,81,51,1,NULL,1.000,11.000,10.000,150000.00,39,'Xuất kho cho phiếu: PX202603263'),(204,'2026-03-25 18:15:01','nhap_kho','phieu_nhap_kho',99,81,51,1,NULL,1.000,10.000,11.000,150000.00,39,'Nhập hoàn trả (Return) từ phiếu: PN-RET-202603264'),(205,'2026-03-26 01:40:52','dieu_chinh','kiem_ke',28,14,58,1,NULL,5.000,10.000,15.000,NULL,1,NULL),(206,'2026-03-26 01:40:54','dieu_chinh','kiem_ke',28,81,51,1,NULL,2.000,11.000,13.000,NULL,1,NULL);
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
INSERT INTO `lich_su_thay_doi` VALUES (77,'nguoi_dung',33,1,'nang_cap_chuc_vu','{\"id\":33,\"tenDangNhap\":\"managertest\",\"hoTen\":\"manager1\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-02-13T08:34:57Z\",\"ngayCapNhat\":\"2026-02-13T08:34:57Z\",\"khoPhuTrach\":null}','{\"id\":33,\"tenDangNhap\":\"managertest\",\"hoTen\":\"manager1\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-02-13T08:34:57Z\",\"ngayCapNhat\":\"2026-02-13T08:34:57Z\",\"khoPhuTrach\":null}',1,'2026-03-16 15:17:15','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 33'),(78,'nguoi_dung',12,1,'nang_cap_chuc_vu','{\"id\":12,\"tenDangNhap\":\"hayluoncogang\",\"hoTen\":\"Trần Đức Tài\",\"email\":\"trantai171003@gmail.com\",\"soDienThoai\":\"0968095535\",\"vaiTro\":\"khach_hang\",\"trangThai\":1,\"ngayTao\":\"2026-01-24T10:16:24Z\",\"ngayCapNhat\":\"2026-01-24T10:17:42Z\",\"khoPhuTrach\":null}','{\"id\":12,\"tenDangNhap\":\"hayluoncogang\",\"hoTen\":\"Trần Đức Tài\",\"email\":\"trantai171003@gmail.com\",\"soDienThoai\":\"0968095535\",\"vaiTro\":\"khach_hang\",\"trangThai\":1,\"ngayTao\":\"2026-01-24T10:16:24Z\",\"ngayCapNhat\":\"2026-01-24T10:17:42Z\",\"khoPhuTrach\":null}',1,'2026-03-16 16:49:12','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 12'),(79,'nguoi_dung',39,1,'nang_cap_chuc_vu','{\"id\":39,\"tenDangNhap\":\"nvkho1\",\"hoTen\":\"nvkho1\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:07:17Z\",\"khoPhuTrach\":null}','{\"id\":39,\"tenDangNhap\":\"nvkho1\",\"hoTen\":\"nvkho1\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:07:17Z\",\"khoPhuTrach\":null}',1,'2026-03-16 18:28:52','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 39'),(80,'nguoi_dung',40,2,'nang_cap_chuc_vu','{\"id\":40,\"tenDangNhap\":\"nvkho2\",\"hoTen\":\"nvkho2\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:12Z\",\"ngayCapNhat\":\"2026-03-16T18:08:12Z\",\"khoPhuTrach\":null}','{\"id\":40,\"tenDangNhap\":\"nvkho2\",\"hoTen\":\"nvkho2\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:12Z\",\"ngayCapNhat\":\"2026-03-16T18:08:12Z\",\"khoPhuTrach\":null}',1,'2026-03-16 18:30:24','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 40'),(81,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":423,\"quyenHan\":{\"id\":12,\"maQuyen\":\"tao_phieu_xuat\",\"tenQuyen\":\"Tạo phiếu xuất kho\",\"moTa\":\"Tạo phiếu xuất hàng khỏi kho\",\"nhomQuyen\":\"xuat_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:25Z\",\"nguoiCap\":null,\"maQuyenHan\":\"tao_phieu_xuat\"}','{\"id\":423,\"quyenHan\":{\"id\":12,\"maQuyen\":\"tao_phieu_xuat\",\"tenQuyen\":\"Tạo phiếu xuất kho\",\"moTa\":\"Tạo phiếu xuất hàng khỏi kho\",\"nhomQuyen\":\"xuat_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"tao_phieu_xuat\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(82,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":415,\"quyenHan\":{\"id\":1,\"maQuyen\":\"xem_ton_kho\",\"tenQuyen\":\"Xem tồn kho\",\"moTa\":\"Xem thông tin tồn kho tại kho được phân quyền\",\"nhomQuyen\":\"quan_ly_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:24Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xem_ton_kho\"}','{\"id\":415,\"quyenHan\":{\"id\":1,\"maQuyen\":\"xem_ton_kho\",\"tenQuyen\":\"Xem tồn kho\",\"moTa\":\"Xem thông tin tồn kho tại kho được phân quyền\",\"nhomQuyen\":\"quan_ly_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xem_ton_kho\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(83,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":422,\"quyenHan\":{\"id\":2,\"maQuyen\":\"xem_chi_tiet_lo\",\"tenQuyen\":\"Xem chi tiết lô hàng\",\"moTa\":\"Xem thông tin chi tiết các lô hàng\",\"nhomQuyen\":\"quan_ly_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:25Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xem_chi_tiet_lo\"}','{\"id\":422,\"quyenHan\":{\"id\":2,\"maQuyen\":\"xem_chi_tiet_lo\",\"tenQuyen\":\"Xem chi tiết lô hàng\",\"moTa\":\"Xem thông tin chi tiết các lô hàng\",\"nhomQuyen\":\"quan_ly_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xem_chi_tiet_lo\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(84,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":419,\"quyenHan\":{\"id\":14,\"maQuyen\":\"huy_phieu_xuat\",\"tenQuyen\":\"Hủy phiếu xuất kho\",\"moTa\":\"Hủy phiếu xuất kho đã tạo\",\"nhomQuyen\":\"xuat_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:25Z\",\"nguoiCap\":null,\"maQuyenHan\":\"huy_phieu_xuat\"}','{\"id\":419,\"quyenHan\":{\"id\":14,\"maQuyen\":\"huy_phieu_xuat\",\"tenQuyen\":\"Hủy phiếu xuất kho\",\"moTa\":\"Hủy phiếu xuất kho đã tạo\",\"nhomQuyen\":\"xuat_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"huy_phieu_xuat\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(85,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":417,\"quyenHan\":{\"id\":16,\"maQuyen\":\"xem_bao_cao_nhap_xuat\",\"tenQuyen\":\"Xem báo cáo nhập xuất\",\"moTa\":\"Xem báo cáo nhập xuất tồn\",\"nhomQuyen\":\"bao_cao\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:25Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xem_bao_cao_nhap_xuat\"}','{\"id\":417,\"quyenHan\":{\"id\":16,\"maQuyen\":\"xem_bao_cao_nhap_xuat\",\"tenQuyen\":\"Xem báo cáo nhập xuất\",\"moTa\":\"Xem báo cáo nhập xuất tồn\",\"nhomQuyen\":\"bao_cao\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xem_bao_cao_nhap_xuat\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(86,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":421,\"quyenHan\":{\"id\":21,\"maQuyen\":\"quan_ly_san_pham\",\"tenQuyen\":\"Quản lý sản phẩm\",\"moTa\":\"Thêm/sửa/xóa sản phẩm và biến thể\",\"nhomQuyen\":\"cai_dat\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:25Z\",\"nguoiCap\":null,\"maQuyenHan\":\"quan_ly_san_pham\"}','{\"id\":421,\"quyenHan\":{\"id\":21,\"maQuyen\":\"quan_ly_san_pham\",\"tenQuyen\":\"Quản lý sản phẩm\",\"moTa\":\"Thêm/sửa/xóa sản phẩm và biến thể\",\"nhomQuyen\":\"cai_dat\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"quan_ly_san_pham\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(87,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":418,\"quyenHan\":{\"id\":9,\"maQuyen\":\"huy_phieu_nhap\",\"tenQuyen\":\"Hủy phiếu nhập kho\",\"moTa\":\"Hủy phiếu nhập kho đã tạo\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:25Z\",\"nguoiCap\":null,\"maQuyenHan\":\"huy_phieu_nhap\"}','{\"id\":418,\"quyenHan\":{\"id\":9,\"maQuyen\":\"huy_phieu_nhap\",\"tenQuyen\":\"Hủy phiếu nhập kho\",\"moTa\":\"Hủy phiếu nhập kho đã tạo\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"huy_phieu_nhap\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(88,'nguoi_dung',40,2,'cap_quyen','','{\"id\":425,\"quyenHan\":{\"id\":4,\"maQuyen\":\"chuyen_kho\",\"tenQuyen\":\"Chuyển kho\",\"moTa\":\"Thực hiện chuyển hàng giữa các kho\",\"nhomQuyen\":\"quan_ly_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:31:01Z\",\"nguoiCap\":null,\"maQuyenHan\":\"chuyen_kho\"}',1,'2026-03-16 18:31:00','Thực hiện cap_quyen cho nguoi_dung id: 40'),(89,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":424,\"quyenHan\":{\"id\":7,\"maQuyen\":\"tao_phieu_nhap\",\"tenQuyen\":\"Tạo phiếu nhập kho\",\"moTa\":\"Tạo phiếu nhập hàng vào kho\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:25Z\",\"nguoiCap\":null,\"maQuyenHan\":\"tao_phieu_nhap\"}','{\"id\":424,\"quyenHan\":{\"id\":7,\"maQuyen\":\"tao_phieu_nhap\",\"tenQuyen\":\"Tạo phiếu nhập kho\",\"moTa\":\"Tạo phiếu nhập hàng vào kho\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"tao_phieu_nhap\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(90,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":420,\"quyenHan\":{\"id\":15,\"maQuyen\":\"xem_bao_cao_ton_kho\",\"tenQuyen\":\"Xem báo cáo tồn kho\",\"moTa\":\"Xem các báo cáo về tồn kho\",\"nhomQuyen\":\"bao_cao\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:25Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xem_bao_cao_ton_kho\"}','{\"id\":420,\"quyenHan\":{\"id\":15,\"maQuyen\":\"xem_bao_cao_ton_kho\",\"tenQuyen\":\"Xem báo cáo tồn kho\",\"moTa\":\"Xem các báo cáo về tồn kho\",\"nhomQuyen\":\"bao_cao\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xem_bao_cao_ton_kho\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(91,'nguoi_dung',40,2,'cap_nhat_quyen','{\"id\":416,\"quyenHan\":{\"id\":18,\"maQuyen\":\"xuat_bao_cao\",\"tenQuyen\":\"Xuất báo cáo\",\"moTa\":\"Xuất báo cáo ra file Excel/PDF\",\"nhomQuyen\":\"bao_cao\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:25Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xuat_bao_cao\"}','{\"id\":416,\"quyenHan\":{\"id\":18,\"maQuyen\":\"xuat_bao_cao\",\"tenQuyen\":\"Xuất báo cáo\",\"moTa\":\"Xuất báo cáo ra file Excel/PDF\",\"nhomQuyen\":\"bao_cao\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:30:59.958Z\",\"nguoiCap\":null,\"maQuyenHan\":\"xuat_bao_cao\"}',1,'2026-03-16 18:31:00','Thực hiện cap_nhat_quyen cho nguoi_dung id: 40'),(92,'nguoi_dung',40,2,'nang_cap_chuc_vu','{\"id\":40,\"tenDangNhap\":\"nvkho2\",\"hoTen\":\"nvkho2\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:12Z\",\"ngayCapNhat\":\"2026-03-16T18:08:12Z\",\"khoPhuTrach\":null}','{\"id\":40,\"tenDangNhap\":\"nvkho2\",\"hoTen\":\"nvkho2\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:12Z\",\"ngayCapNhat\":\"2026-03-16T18:08:12Z\",\"khoPhuTrach\":null}',1,'2026-03-16 18:31:00','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 40'),(93,'nguoi_dung',41,1,'nang_cap_chuc_vu','{\"id\":41,\"tenDangNhap\":\"qlkho1\",\"hoTen\":\"qlkho1\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:35Z\",\"ngayCapNhat\":\"2026-03-16T18:08:35Z\",\"khoPhuTrach\":null}','{\"id\":41,\"tenDangNhap\":\"qlkho1\",\"hoTen\":\"qlkho1\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:35Z\",\"ngayCapNhat\":\"2026-03-16T18:08:35Z\",\"khoPhuTrach\":null}',1,'2026-03-16 18:32:21','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 41'),(94,'nguoi_dung',42,2,'nang_cap_chuc_vu','{\"id\":42,\"tenDangNhap\":\"qlkho2\",\"hoTen\":\"qlkho2\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:08:48Z\",\"khoPhuTrach\":null}','{\"id\":42,\"tenDangNhap\":\"qlkho2\",\"hoTen\":\"qlkho2\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:08:48Z\",\"khoPhuTrach\":null}',1,'2026-03-16 18:32:49','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 42'),(95,'nguoi_dung',44,1,'nang_cap_chuc_vu','{\"id\":44,\"tenDangNhap\":\"nhanvienmuahang2\",\"hoTen\":\"Nguyễn Văn Lợi\",\"email\":\"nvmh2@fs.wms.com\",\"soDienThoai\":\"0967745999\",\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:53:15Z\",\"ngayCapNhat\":\"2026-03-16T18:53:15Z\",\"khoPhuTrach\":null}','{\"id\":44,\"tenDangNhap\":\"nhanvienmuahang2\",\"hoTen\":\"Nguyễn Văn Lợi\",\"email\":\"nvmh2@fs.wms.com\",\"soDienThoai\":\"0967745999\",\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:53:15Z\",\"ngayCapNhat\":\"2026-03-16T18:53:15Z\",\"khoPhuTrach\":null}',1,'2026-03-16 19:30:33','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 44'),(96,'nguoi_dung',44,2,'nang_cap_chuc_vu','{\"id\":44,\"tenDangNhap\":\"nhanvienmuahang2\",\"hoTen\":\"Nguyễn Văn Lợi\",\"email\":\"nvmh2@fs.wms.com\",\"soDienThoai\":\"0967745999\",\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:53:15Z\",\"ngayCapNhat\":\"2026-03-16T18:53:15Z\",\"khoPhuTrach\":null}','{\"id\":44,\"tenDangNhap\":\"nhanvienmuahang2\",\"hoTen\":\"Nguyễn Văn Lợi\",\"email\":\"nvmh2@fs.wms.com\",\"soDienThoai\":\"0967745999\",\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:53:15Z\",\"ngayCapNhat\":\"2026-03-16T18:53:15Z\",\"khoPhuTrach\":null}',1,'2026-03-16 19:56:43','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 44'),(97,'nguoi_dung',43,1,'nang_cap_chuc_vu','{\"id\":43,\"tenDangNhap\":\"nhavienmuahang1\",\"hoTen\":\"Phạm Nguyễn Hồng Thuý\",\"email\":\"nvmh1@fs.wms.com\",\"soDienThoai\":\"0912099999\",\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:52:34Z\",\"ngayCapNhat\":\"2026-03-16T18:52:34Z\",\"khoPhuTrach\":null}','{\"id\":43,\"tenDangNhap\":\"nhavienmuahang1\",\"hoTen\":\"Phạm Nguyễn Hồng Thuý\",\"email\":\"nvmh1@fs.wms.com\",\"soDienThoai\":\"0912099999\",\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:52:34Z\",\"ngayCapNhat\":\"2026-03-16T18:52:34Z\",\"khoPhuTrach\":null}',1,'2026-03-17 01:04:56','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 43'),(98,'nguoi_dung',42,1,'nang_cap_chuc_vu','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-17 01:24:57','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 42'),(99,'nguoi_dung',42,1,'cap_quyen','','{\"id\":482,\"quyenHan\":{\"id\":7,\"maQuyen\":\"tao_phieu_nhap\",\"tenQuyen\":\"Tạo phiếu nhập kho\",\"moTa\":\"Tạo phiếu nhập hàng vào kho\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-18T15:26:47Z\",\"nguoiCap\":null,\"maQuyenHan\":\"tao_phieu_nhap\"}',1,'2026-03-18 15:26:46','Thực hiện cap_quyen cho nguoi_dung id: 42'),(100,'nguoi_dung',42,1,'cap_quyen','','{\"id\":483,\"quyenHan\":{\"id\":12,\"maQuyen\":\"tao_phieu_xuat\",\"tenQuyen\":\"Tạo phiếu xuất kho\",\"moTa\":\"Tạo phiếu xuất hàng khỏi kho\",\"nhomQuyen\":\"xuat_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-18T15:26:47Z\",\"nguoiCap\":null,\"maQuyenHan\":\"tao_phieu_xuat\"}',1,'2026-03-18 15:26:46','Thực hiện cap_quyen cho nguoi_dung id: 42'),(101,'nguoi_dung',42,1,'nang_cap_chuc_vu','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-18 15:26:46','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 42'),(102,'nguoi_dung',41,2,'nang_cap_chuc_vu','{\"id\":41,\"tenDangNhap\":\"quanlykho1\",\"hoTen\":\"Nguyễn Đức Anh\",\"email\":\"qlk1@fs.wms.com\",\"soDienThoai\":\"0954234569\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:35Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":41,\"tenDangNhap\":\"quanlykho1\",\"hoTen\":\"Nguyễn Đức Anh\",\"email\":\"qlk1@fs.wms.com\",\"soDienThoai\":\"0954234569\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:35Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-18 15:36:30','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 41'),(103,'nguoi_dung',37,1,'nang_cap_chuc_vu','{\"id\":37,\"tenDangNhap\":\"nhanvienbanhang1\",\"hoTen\":\"Đoàn Minh Đức\",\"email\":\"nvbh1@fs.wms.com\",\"soDienThoai\":\"0901234545\",\"vaiTro\":\"nhan_vien_ban_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:05:52Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":37,\"tenDangNhap\":\"nhanvienbanhang1\",\"hoTen\":\"Đoàn Minh Đức\",\"email\":\"nvbh1@fs.wms.com\",\"soDienThoai\":\"0901234545\",\"vaiTro\":\"nhan_vien_ban_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:05:52Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-18 16:37:35','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 37'),(104,'nguoi_dung',42,1,'nang_cap_chuc_vu','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-18 17:24:42','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 42'),(105,'nguoi_dung',42,1,'nang_cap_chuc_vu','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-18 18:41:40','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 42'),(106,'nguoi_dung',40,1,'nang_cap_chuc_vu','{\"id\":40,\"tenDangNhap\":\"nhanvienkho2\",\"hoTen\":\"Phạm Hữu Thân\",\"email\":\"nvk2@fs.wms.com\",\"soDienThoai\":\"0946312345\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:12Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":40,\"tenDangNhap\":\"nhanvienkho2\",\"hoTen\":\"Phạm Hữu Thân\",\"email\":\"nvk2@fs.wms.com\",\"soDienThoai\":\"0946312345\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:12Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-18 19:28:08','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 40'),(107,'nguoi_dung',39,1,'cap_nhat_quyen','{\"id\":404,\"quyenHan\":{\"id\":9,\"maQuyen\":\"huy_phieu_nhap\",\"tenQuyen\":\"Hủy phiếu nhập kho\",\"moTa\":\"Hủy phiếu nhập kho đã tạo\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:28:52Z\",\"nguoiCap\":null,\"maQuyenHan\":\"huy_phieu_nhap\"}','{\"id\":404,\"quyenHan\":{\"id\":9,\"maQuyen\":\"huy_phieu_nhap\",\"tenQuyen\":\"Hủy phiếu nhập kho\",\"moTa\":\"Hủy phiếu nhập kho đã tạo\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-18T20:07:19.449Z\",\"nguoiCap\":null,\"maQuyenHan\":\"huy_phieu_nhap\"}',1,'2026-03-18 20:07:20','Thực hiện cap_nhat_quyen cho nguoi_dung id: 39'),(108,'nguoi_dung',39,1,'nang_cap_chuc_vu','{\"id\":39,\"tenDangNhap\":\"nhanvienkho1\",\"hoTen\":\"Nguyễn Thanh Bình\",\"email\":\"nvk1@fs.wms.com\",\"soDienThoai\":\"0932123456\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":39,\"tenDangNhap\":\"nhanvienkho1\",\"hoTen\":\"Nguyễn Thanh Bình\",\"email\":\"nvk1@fs.wms.com\",\"soDienThoai\":\"0932123456\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-18 20:07:20','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 39'),(109,'nguoi_dung',42,1,'nang_cap_chuc_vu','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":42,\"tenDangNhap\":\"quanlykho2\",\"hoTen\":\"Nguyễn Trọng Quý\",\"email\":\"qlk2@fs.wms.com\",\"soDienThoai\":\"0911234543\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:48Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-18 20:09:11','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 42'),(110,'san_pham_quan_ao',54,NULL,'them_moi_san_pham',NULL,'{\"maSanPham\":\"\",\"tenSanPham\":\"Áo thun hè mới nhất\",\"danhMucId\":4,\"moTa\":\"Hàng mới nhất hè 2026\",\"maVach\":\"\",\"giaVonMacDinh\":50000,\"giaBanMacDinh\":60000,\"mucTonToiThieu\":100,\"trangThai\":1,\"bienTheSanPhams\":[{\"mauSacId\":2,\"sizeId\":1,\"chatLieuId\":1,\"maSku\":\"\",\"maVachSku\":\"\",\"giaVon\":50000,\"giaBan\":60000,\"trangThai\":1},{\"mauSacId\":4,\"sizeId\":2,\"chatLieuId\":1,\"maSku\":\"\",\"maVachSku\":\"\",\"giaVon\":50000,\"giaBan\":60000,\"trangThai\":1},{\"mauSacId\":3,\"sizeId\":4,\"chatLieuId\":1,\"maSku\":\"\",\"maVachSku\":\"\",\"giaVon\":50000,\"giaBan\":60000,\"trangThai\":1}]}',1,'2026-03-18 21:40:48','Tạo sản phẩm tự động mã: AT2603191'),(111,'san_pham_quan_ao',55,NULL,'them_moi_san_pham',NULL,'{\"maSanPham\":\"\",\"tenSanPham\":\"Quần dài nam Daily Pants\",\"danhMucId\":16,\"moTa\":\"\",\"maVach\":\"\",\"giaVonMacDinh\":100000,\"giaBanMacDinh\":120000,\"mucTonToiThieu\":20,\"trangThai\":1,\"bienTheSanPhams\":[{\"mauSacId\":6,\"sizeId\":1,\"chatLieuId\":5,\"maSku\":\"\",\"maVachSku\":\"\",\"giaVon\":100000,\"giaBan\":120000,\"trangThai\":1},{\"mauSacId\":4,\"sizeId\":2,\"chatLieuId\":5,\"maSku\":\"\",\"maVachSku\":\"\",\"giaVon\":100000,\"giaBan\":120000,\"trangThai\":1}]}',41,'2026-03-18 22:43:31','Tạo sản phẩm tự động mã: QN2603191'),(112,'san_pham_quan_ao',56,NULL,'them_moi_san_pham',NULL,'{\"maSanPham\":\"\",\"tenSanPham\":\"Quần Nỉ Đẹp\",\"danhMucId\":14,\"moTa\":\"\",\"maVach\":\"\",\"giaVonMacDinh\":0,\"giaBanMacDinh\":0,\"mucTonToiThieu\":0,\"trangThai\":1,\"bienTheSanPhams\":[{\"mauSacId\":6,\"sizeId\":1,\"chatLieuId\":5,\"maSku\":\"\",\"maVachSku\":\"\",\"giaVon\":0,\"giaBan\":0,\"trangThai\":1},{\"mauSacId\":4,\"sizeId\":1,\"chatLieuId\":5,\"maSku\":\"\",\"maVachSku\":\"\",\"giaVon\":0,\"giaBan\":0,\"trangThai\":1}]}',41,'2026-03-18 22:51:12','Tạo sản phẩm tự động mã: QN2603192'),(113,'san_pham_quan_ao',57,NULL,'them_moi_san_pham',NULL,'{\"maSanPham\":\"\",\"tenSanPham\":\"Quần nỉ new\",\"danhMucId\":14,\"moTa\":\"\",\"maVach\":\"\",\"giaVonMacDinh\":0,\"giaBanMacDinh\":0,\"mucTonToiThieu\":0,\"trangThai\":1,\"bienTheSanPhams\":[{\"mauSacId\":2,\"sizeId\":2,\"chatLieuId\":2,\"maSku\":\"\",\"maVachSku\":\"\",\"giaVon\":0,\"giaBan\":0,\"trangThai\":1}]}',41,'2026-03-18 22:58:20','Tạo sản phẩm tự động mã: QN2603193'),(114,'nguoi_dung',46,1,'nang_cap_chuc_vu','{\"id\":46,\"tenDangNhap\":\"nhanvienmuahang\",\"hoTen\":\"Nguyễn Văn A\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-19T04:45:47Z\",\"ngayCapNhat\":\"2026-03-19T04:45:47Z\",\"khoPhuTrach\":null}','{\"id\":46,\"tenDangNhap\":\"nhanvienmuahang\",\"hoTen\":\"Nguyễn Văn A\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-19T04:45:47Z\",\"ngayCapNhat\":\"2026-03-19T04:45:47Z\",\"khoPhuTrach\":null}',1,'2026-03-19 04:46:27','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 46'),(115,'nguoi_dung',47,1,'nang_cap_chuc_vu','{\"id\":47,\"tenDangNhap\":\"nhanvienmuahang3\",\"hoTen\":\"Nguyễn Văn B\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-19T04:47:28Z\",\"ngayCapNhat\":\"2026-03-19T04:47:28Z\",\"khoPhuTrach\":null}','{\"id\":47,\"tenDangNhap\":\"nhanvienmuahang3\",\"hoTen\":\"Nguyễn Văn B\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-19T04:47:28Z\",\"ngayCapNhat\":\"2026-03-19T04:47:28Z\",\"khoPhuTrach\":null}',1,'2026-03-19 04:47:47','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 47'),(116,'nguoi_dung',39,2,'nang_cap_chuc_vu','{\"id\":39,\"tenDangNhap\":\"nhanvienkho1\",\"hoTen\":\"Nguyễn Thanh Bình\",\"email\":\"nvk1@fs.wms.com\",\"soDienThoai\":\"0932123456\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":39,\"tenDangNhap\":\"nhanvienkho1\",\"hoTen\":\"Nguyễn Thanh Bình\",\"email\":\"nvk1@fs.wms.com\",\"soDienThoai\":\"0932123456\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-20 19:02:21','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 39'),(117,'nguoi_dung',39,1,'cap_nhat_quyen','{\"id\":412,\"quyenHan\":{\"id\":7,\"maQuyen\":\"tao_phieu_nhap\",\"tenQuyen\":\"Tạo phiếu nhập kho\",\"moTa\":\"Tạo phiếu nhập hàng vào kho\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-16T18:28:53Z\",\"nguoiCap\":null,\"maQuyenHan\":\"tao_phieu_nhap\"}','{\"id\":412,\"quyenHan\":{\"id\":7,\"maQuyen\":\"tao_phieu_nhap\",\"tenQuyen\":\"Tạo phiếu nhập kho\",\"moTa\":\"Tạo phiếu nhập hàng vào kho\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-20T19:20:37.134Z\",\"nguoiCap\":null,\"maQuyenHan\":\"tao_phieu_nhap\"}',1,'2026-03-20 19:20:37','Thực hiện cap_nhat_quyen cho nguoi_dung id: 39'),(118,'nguoi_dung',39,1,'nang_cap_chuc_vu','{\"id\":39,\"tenDangNhap\":\"nhanvienkho1\",\"hoTen\":\"Nguyễn Thanh Bình\",\"email\":\"nvk1@fs.wms.com\",\"soDienThoai\":\"0932123456\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":39,\"tenDangNhap\":\"nhanvienkho1\",\"hoTen\":\"Nguyễn Thanh Bình\",\"email\":\"nvk1@fs.wms.com\",\"soDienThoai\":\"0932123456\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-20 19:20:37','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 39'),(119,'nguoi_dung',39,1,'cap_quyen','','{\"id\":560,\"quyenHan\":{\"id\":5,\"maQuyen\":\"tao_don_mua_hang\",\"tenQuyen\":\"Tạo đơn mua hàng\",\"moTa\":\"Tạo đơn đặt hàng với nhà cung cấp\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-20T19:20:54Z\",\"nguoiCap\":null,\"maQuyenHan\":\"tao_don_mua_hang\"}',1,'2026-03-20 19:20:50','Thực hiện cap_quyen cho nguoi_dung id: 39'),(120,'nguoi_dung',39,1,'nang_cap_chuc_vu','{\"id\":39,\"tenDangNhap\":\"nhanvienkho1\",\"hoTen\":\"Nguyễn Thanh Bình\",\"email\":\"nvk1@fs.wms.com\",\"soDienThoai\":\"0932123456\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":39,\"tenDangNhap\":\"nhanvienkho1\",\"hoTen\":\"Nguyễn Thanh Bình\",\"email\":\"nvk1@fs.wms.com\",\"soDienThoai\":\"0932123456\",\"vaiTro\":\"nhan_vien_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:07:17Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-20 19:20:50','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 39'),(121,'nguoi_dung',41,1,'cap_quyen','','{\"id\":561,\"quyenHan\":{\"id\":6,\"maQuyen\":\"duyet_don_mua_hang\",\"tenQuyen\":\"Duyệt đơn mua hàng\",\"moTa\":\"Phê duyệt đơn mua hàng\",\"nhomQuyen\":\"nhap_kho\",\"ngayTao\":\"2026-01-21T13:53:08Z\"},\"trangThai\":1,\"ngayCap\":\"2026-03-20T19:39:12Z\",\"nguoiCap\":null,\"maQuyenHan\":\"duyet_don_mua_hang\"}',1,'2026-03-20 19:39:08','Thực hiện cap_quyen cho nguoi_dung id: 41'),(122,'nguoi_dung',41,1,'nang_cap_chuc_vu','{\"id\":41,\"tenDangNhap\":\"quanlykho1\",\"hoTen\":\"Nguyễn Đức Anh\",\"email\":\"qlk1@fs.wms.com\",\"soDienThoai\":\"0954234569\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:35Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}','{\"id\":41,\"tenDangNhap\":\"quanlykho1\",\"hoTen\":\"Nguyễn Đức Anh\",\"email\":\"qlk1@fs.wms.com\",\"soDienThoai\":\"0954234569\",\"vaiTro\":\"quan_ly_kho\",\"trangThai\":1,\"ngayTao\":\"2026-03-16T18:08:35Z\",\"ngayCapNhat\":\"2026-03-16T18:45:10Z\",\"khoPhuTrach\":null}',1,'2026-03-20 19:39:08','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 41'),(123,'nguoi_dung',47,2,'nang_cap_chuc_vu','{\"id\":47,\"tenDangNhap\":\"nhanvienmuahang3\",\"hoTen\":\"Nguyễn Văn B\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-19T04:47:28Z\",\"ngayCapNhat\":\"2026-03-19T04:47:28Z\",\"khoPhuTrach\":null}','{\"id\":47,\"tenDangNhap\":\"nhanvienmuahang3\",\"hoTen\":\"Nguyễn Văn B\",\"email\":null,\"soDienThoai\":null,\"vaiTro\":\"nhan_vien_mua_hang\",\"trangThai\":1,\"ngayTao\":\"2026-03-19T04:47:28Z\",\"ngayCapNhat\":\"2026-03-19T04:47:28Z\",\"khoPhuTrach\":null}',1,'2026-03-20 20:58:03','Thực hiện nang_cap_chuc_vu cho nguoi_dung id: 47');
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
INSERT INTO `lo_hang` VALUES (26,14,'Lô test',NULL,5,15000000.00,'không có j','2026-02-08 11:08:22'),(27,14,'LO-20260115-01',NULL,5,15000000.00,'Test','2026-02-08 11:23:01'),(40,14,'Lo1','2026-02-01 00:00:00',1,300000.00,'','2026-02-09 06:37:18'),(41,14,'Lo2','2026-02-01 00:00:00',1,300000.00,'','2026-02-09 07:46:28'),(42,15,'Lô 3','2026-02-01 00:00:00',5,300000.00,'','2026-02-09 09:01:54'),(44,14,'LO-003','2026-02-02 00:00:00',4,1000000.00,'','2026-02-11 08:30:51'),(45,81,'LO-ABC-01','2026-03-07 00:00:00',10,150000.00,'','2026-03-07 12:38:48'),(46,81,'LO-ABC-2',NULL,10,150000.00,'','2026-03-07 12:45:18'),(47,81,'LO-ABC-3',NULL,10,100000.00,'','2026-03-07 12:46:38'),(48,77,'LO 4','2026-03-09 00:00:00',1,3000.00,'','2026-03-10 01:51:20'),(49,15,'Lo test',NULL,1,1000.00,'','2026-03-10 02:25:07'),(50,15,'LO TEST 1','2026-03-11 00:00:00',10,100000.00,'','2026-03-11 02:37:50'),(51,81,'ABC-X','2026-03-12 00:00:00',10,150000.00,'','2026-03-14 02:43:43'),(52,81,'LO_Test1','2026-03-19 00:00:00',2,1000.00,'1','2026-03-18 20:10:16'),(53,81,'LO-Test2','2026-03-21 00:00:00',2,1000.00,'1','2026-03-18 20:10:36'),(54,81,'LOzzzz','2026-03-19 00:00:00',1,1000.00,'','2026-03-18 20:32:21'),(55,81,'LO-X','2026-03-20 00:00:00',1,1000.00,'','2026-03-18 20:51:25'),(56,81,'lozzzzz','2026-03-20 00:00:00',1,1000.00,'','2026-03-18 21:04:07'),(57,81,'lo2','2026-03-21 00:00:00',1,1000.00,'','2026-03-18 21:04:20'),(58,14,'LO-10','2026-03-22 00:00:00',3,200.00,'','2026-03-21 05:38:24'),(60,14,'LO888','2026-03-23 00:00:00',3,100000.00,'','2026-03-21 06:01:51'),(61,14,'LO999','2026-03-24 00:00:00',3,100000.00,'','2026-03-21 06:02:00'),(62,14,'LO111','2026-03-23 00:00:00',3,100000.00,'','2026-03-21 06:49:59'),(63,14,'LO333','2026-03-22 00:00:00',3,100000.00,'','2026-03-21 06:50:13'),(64,14,'LOssss','2026-03-26 00:00:00',3,1000.00,'','2026-03-23 15:29:45'),(65,14,'LO-A','2026-03-25 00:00:00',3,10000.00,'','2026-03-24 01:06:21'),(66,14,'LO-B','2026-03-26 00:00:00',3,10000.00,'','2026-03-24 01:06:34'),(67,81,'LO-T','2026-03-25 00:00:00',2,1000.00,'','2026-03-24 02:14:46'),(68,90,'LO-S','2026-03-25 00:00:00',3,2000.00,'','2026-03-24 17:49:20');
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
INSERT INTO `mau_sac` VALUES (2,'M002','Trắng','#FFFFFF','2026-01-21 13:53:09'),(3,'M003','Xám','#808080','2026-01-21 13:53:09'),(4,'M004','Xanh navy','#000080','2026-01-21 13:53:09'),(5,'M005','Xanh dương','#0000FF','2026-01-21 13:53:09'),(6,'M006','Xanh lá','#008000','2026-01-21 13:53:09'),(7,'M007','Đỏ','#FF0000','2026-01-21 13:53:09'),(8,'M008','Đỏ đô','#8B0000','2026-01-21 13:53:09'),(9,'M009','Vàng','#FFFF00','2026-01-21 13:53:09'),(10,'M010','Cam','#FFA500','2026-01-21 13:53:09'),(11,'M011','Hồng','#FFC0CB','2026-01-21 13:53:09'),(12,'M012','Nâu','#A52A2A','2026-01-21 13:53:09'),(13,'M013','Be','#F5F5DC','2026-01-21 13:53:09'),(14,'M014','Xanh ngọc','#40E0D0','2026-01-21 13:53:09'),(15,'M015','Tím','#800080','2026-01-21 13:53:09'),(16,'M016','Đen','#000000','2026-01-21 13:55:59');
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
INSERT INTO `nguoi_dung` VALUES (1,'admin','$2a$10$sI2L3w9FJVDws0Hk.Ak1u./TSs4O0P1odowjDRr4WGz3G56PFqPhy','Trần Đức Tài','trantai17102003@gmail.com','0901234567','quan_tri_vien',1,'2026-01-21 13:53:09','2026-03-13 19:13:07'),(37,'nhanvienbanhang1','$2a$10$nlnmEIG29EyzzHLUAvlm1ucVKJE.6YYP09yvEfIvLrqDhmPk0gHfS','Đoàn Minh Đức','nvbh1@fs.wms.com','0901234545','nhan_vien_ban_hang',1,'2026-03-16 18:05:52','2026-03-16 18:45:10'),(38,'nhanvienbanhang2','$2a$10$CTFys37AlYQc8uOwN8WzteUkVozSP.yuca1fBRysArhaNJr.7ADvm','Đoàn Hải Minh','nvbh2@fs.wms.com','0971234567','nhan_vien_mua_hang',1,'2026-03-16 18:06:54','2026-03-16 18:45:11'),(39,'nhanvienkho1','$2a$10$tn/peSYoczDx0zSi4JItY.lrRE9DNZ2idWGOLDTLVKQSEqTAN4M2i','Nguyễn Thanh Bình','nvk1@fs.wms.com','0932123456','nhan_vien_kho',1,'2026-03-16 18:07:17','2026-03-16 18:45:10'),(40,'nhanvienkho2','$2a$10$GNr9/ueoaURwROEDdONp/.NjbdN1xhSXgkLNbpJfeNeDal2U.GWJm','Phạm Hữu Thân','nvk2@fs.wms.com','0946312345','nhan_vien_kho',1,'2026-03-16 18:08:12','2026-03-16 18:45:10'),(41,'quanlykho1','$2a$10$ZGJmC/MdiM2g1YBgc6QEUuuapuFYGlrOrEGNihZ255.sotAqSpuUi','Nguyễn Đức Anh','qlk1@fs.wms.com','0954234569','quan_ly_kho',1,'2026-03-16 18:08:35','2026-03-16 18:45:10'),(42,'quanlykho2','$2a$10$v9yKV7BJ9uCAGu0WMwedNOs0/AM7Mpw3CRGqEUa5kPbuNvaI769MG','Nguyễn Trọng Quý','qlk2@fs.wms.com','0911234543','quan_ly_kho',1,'2026-03-16 18:08:48','2026-03-16 18:45:10'),(43,'nhanvienmuahang1','$2a$10$I74ZCf.1BWapvp.HPPKbYe30BoaETYIfRBmDunogvw/0iTqgPuRPG','Phạm Nguyễn Hồng Thuý','nvmh1@fs.wms.com','0912099999','nhan_vien_mua_hang',1,'2026-03-16 18:52:34','2026-03-20 20:04:10'),(44,'nhanvienmuahang2','$2a$10$bt8pCod6F/MXhhRokR5Bqexqu2KUoHafrUNyV/C65PbA4I2VA5PiK','Nguyễn Văn Lợi','nvmh2@fs.wms.com','0967745999','nhan_vien_mua_hang',1,'2026-03-16 18:53:15','2026-03-18 14:07:08'),(46,'nhanvienmuahang4','$2a$10$KAVD8qhXLrZ8ly1i4uoXQOgv05zpVZoS/cbWWSYIiO0u/bnFsok7W','Nguyễn Văn A',NULL,NULL,'nhan_vien_mua_hang',1,'2026-03-19 04:45:47','2026-03-20 20:04:19'),(47,'nhanvienmuahang3','$2a$10$lz.k8j13IrXBxElVGGAuceFTTL5aAnh3a9nAVu0C1LgoQpqtxp.sW','Nguyễn Văn B',NULL,NULL,'nhan_vien_mua_hang',1,'2026-03-19 04:47:28','2026-03-19 04:47:28');
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
INSERT INTO `nha_cung_cap` VALUES (1,'NCC001','Công ty Trung Quốc','ICB','999939055888','Nguyễn Văn Ba','0241234567','trantai171003@gmail.com','Số 10, Đường Lê Lợi, Quận Hoàn Kiếm, Hà Nộii',1,'2026-01-21 13:53:09','2026-03-20 19:05:59'),(2,'NCC002','Xưởng May Hoàng Anh','ICB','999939055888','Trần Thị Lan','0282345678','taitdhe186324@fpt.edu.vn','123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',1,'2026-01-21 13:53:09','2026-03-20 19:05:59'),(3,'NCC003','Công ty CP Dệt Kim Đông Phương','ICB','999939055888','Trần Đức Tài','0293456789','taitd.devmamnon@gmail.com','45 Lý Thường Kiệt, Hải Phòng',1,'2026-01-21 13:53:09','2026-03-20 19:05:59'),(4,'NCC004','Nhà máy Sợi Việt Tiến',NULL,NULL,'Phạm Thị D','0987654321','haiminh17052003@gmail.com','67 Trần Hưng Đạo, Đà Nẵng',1,'2026-01-21 13:53:09','2026-03-12 14:51:27'),(5,'NCC005','Công ty TNHH Thời Trang Quốc Tế',NULL,NULL,'Hoàng Văn E','0987654321','export@intlfashion.vn','89 Hai Bà Trưng, Quận 3, TP. Hồ Chí Minhh',0,'2026-01-21 13:53:09','2026-03-12 14:51:07'),(10,'NCC Test','Công Ty TNHH Minh Đức',NULL,NULL,'Đức Đoàn','0987654321','ducdoanminh2005@gmail.com','xxx Hà Nội',1,'2026-03-07 12:15:31','2026-03-26 02:58:08');
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
INSERT INTO `phan_quyen_nguoi_dung_kho` VALUES (57,39,1,0,1,'2026-03-20 19:20:50',NULL,1,'','2026-03-16 18:28:52','2026-03-20 19:20:54'),(58,40,2,0,1,'2026-03-16 18:31:00',NULL,1,'','2026-03-16 18:30:24','2026-03-16 18:31:00'),(59,41,1,0,1,'2026-03-20 19:39:08',NULL,1,'','2026-03-16 18:32:21','2026-03-20 19:39:12'),(60,42,2,1,1,'2026-03-16 18:32:49',NULL,1,'','2026-03-16 18:32:49','2026-03-18 15:33:13'),(61,44,1,0,1,'2026-03-16 19:30:32',NULL,1,'','2026-03-16 19:30:33','2026-03-16 19:30:33'),(62,44,2,0,1,'2026-03-16 19:56:43',NULL,1,'','2026-03-16 19:56:43','2026-03-16 19:56:43'),(63,43,1,0,1,'2026-03-17 01:04:53',NULL,1,'','2026-03-17 01:04:55','2026-03-17 01:04:55'),(66,37,1,1,1,'2026-03-18 16:37:35',NULL,1,'','2026-03-18 16:37:35','2026-03-18 16:39:01'),(71,46,1,0,1,'2026-03-19 04:46:27',NULL,1,'','2026-03-19 04:46:27','2026-03-19 04:46:27'),(72,47,1,0,1,'2026-03-19 04:47:47',NULL,1,'','2026-03-19 04:47:47','2026-03-19 04:47:47');
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
INSERT INTO `phieu_nhap_kho` VALUES (58,'PN-TRF-202603161',NULL,97,NULL,2,'2026-03-16 14:44:58',3,1500000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603161',1,NULL,'2026-03-16 14:44:43','2026-03-16 14:44:57'),(59,'PN-TRF-202603171',NULL,101,NULL,2,'2026-03-16 18:55:34',3,1500000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603171',40,NULL,'2026-03-16 18:55:26','2026-03-16 18:55:34'),(60,'PN-TRF-202603172',NULL,103,NULL,2,'2026-03-16 19:02:16',3,150000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603172',40,NULL,'2026-03-16 19:02:10','2026-03-16 19:02:16'),(61,'PN202603171',85,NULL,1,2,NULL,4,100000.00,'Tạo phiếu nhập kho từ PO PO202603173633',NULL,NULL,'2026-03-17 01:54:41','2026-03-18 14:16:34'),(62,'PN-TRF-202603181',NULL,109,NULL,2,NULL,4,150000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603181',NULL,NULL,'2026-03-18 14:59:08','2026-03-18 19:43:46'),(63,'PN-TRF-202603182',NULL,111,NULL,2,'2026-03-18 15:52:31',3,1500000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603182',40,NULL,'2026-03-18 15:52:03','2026-03-18 15:52:30'),(64,'PN-TRF-202603191',NULL,116,NULL,2,NULL,4,150000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603186',NULL,NULL,'2026-03-18 17:34:06','2026-03-18 17:35:14'),(65,'PN-RET-202603191',NULL,109,NULL,1,'2026-03-18 17:47:15',3,150000.00,'Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: PX-TRF-202603181',41,NULL,'2026-03-18 17:47:03','2026-03-18 17:47:14'),(66,'PN-RET-202603192',NULL,116,NULL,1,'2026-03-18 17:55:18',3,150000.00,'Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: PX-TRF-202603186',41,NULL,'2026-03-18 17:55:11','2026-03-18 17:55:17'),(67,'PN-TRF-202603192',NULL,119,NULL,2,'2026-03-18 17:58:42',3,150000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603191',40,NULL,'2026-03-18 17:58:30','2026-03-18 17:58:42'),(68,'PN-TRF-202603193',NULL,122,NULL,1,'2026-03-18 18:15:14',3,1500000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603193',41,NULL,'2026-03-18 18:15:04','2026-03-18 18:15:14'),(69,'PN-TRF-202603194',NULL,126,NULL,1,'2026-03-18 18:51:34',3,150000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603194',41,NULL,'2026-03-18 18:51:26','2026-03-18 18:51:34'),(70,'PN-TRF-202603195',NULL,129,NULL,1,'2026-03-18 19:27:51',3,150000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603196',39,NULL,'2026-03-18 19:27:41','2026-03-18 19:27:50'),(71,'PN202603191',94,NULL,2,1,NULL,4,2000.00,'Tạo phiếu nhập kho từ PO PO202603194066',NULL,NULL,'2026-03-18 20:06:22','2026-03-18 20:08:22'),(72,'PN202603192',94,NULL,2,1,'2026-03-18 20:10:55',3,2000.00,'Tạo phiếu nhập kho từ PO PO202603194066',42,NULL,'2026-03-18 20:09:48','2026-03-18 20:10:56'),(73,'PN202603193',92,NULL,1,1,NULL,4,3000.00,'Tạo phiếu nhập kho từ PO PO202603195599',NULL,NULL,'2026-03-18 20:31:42','2026-03-18 20:32:33'),(74,'PN202603194',92,NULL,1,1,'2026-03-18 20:52:21',3,3000.00,'Tạo phiếu nhập kho từ PO PO202603195599',39,NULL,'2026-03-18 20:51:10','2026-03-18 20:52:21'),(75,'PN202603195',97,NULL,1,1,'2026-03-18 21:04:29',3,2000.00,'Tạo phiếu nhập kho từ PO PO202603194102',39,NULL,'2026-03-18 21:03:45','2026-03-18 21:04:29'),(76,'PN-RET-202603193',NULL,138,NULL,1,'2026-03-18 21:24:17',3,2000.00,'Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: PX-TRF-202603197',39,NULL,'2026-03-18 21:22:54','2026-03-18 21:24:17'),(77,'PN202603196',91,NULL,1,1,NULL,4,4000.00,'Tạo phiếu nhập kho từ PO PO202603193748',NULL,NULL,'2026-03-18 22:15:34','2026-03-18 22:16:27'),(78,'PN-RET-202603194',NULL,140,NULL,1,'2026-03-18 22:47:27',3,1000.00,'Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: PX-TRF-202603198',41,NULL,'2026-03-18 22:47:20','2026-03-18 22:47:27'),(79,'PN202603211',119,NULL,3,1,'2026-03-21 05:38:55',3,2000.00,'Tạo phiếu nhập kho từ PO PO202603214881',39,NULL,'2026-03-21 05:38:10','2026-03-21 05:38:54'),(80,'PN202603212',120,NULL,3,1,'2026-03-21 06:02:19',3,1000000.00,'Tạo phiếu nhập kho từ PO PO202603216510',39,NULL,'2026-03-21 06:01:20','2026-03-21 06:02:17'),(81,'PN202603213',121,NULL,3,1,'2026-03-21 06:50:35',3,1500000.00,'Tạo phiếu nhập kho từ PO PO202603210504',39,NULL,'2026-03-21 06:49:35','2026-03-21 06:50:34'),(82,'PN-RET-202603211',NULL,144,NULL,1,'2026-03-21 07:44:43',3,500000.00,'Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: PX-TRF-202603211',39,NULL,'2026-03-21 07:44:21','2026-03-21 07:44:42'),(83,'PN-TRF-202603211',NULL,146,NULL,2,'2026-03-21 07:46:25',3,500000.00,'Nhập kho thủ công từ phiếu chuyển: PX-TRF-202603212',40,NULL,'2026-03-21 07:46:14','2026-03-21 07:46:24'),(84,'PN202603231',122,NULL,3,1,'2026-03-23 15:29:55',3,15000.00,'Tạo phiếu nhập kho từ PO PO202603237405',39,NULL,'2026-03-23 15:29:24','2026-03-23 15:29:54'),(85,'PN-RET-202603231',NULL,149,NULL,1,'2026-03-23 15:40:51',3,2600.00,'Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: PX-TRF-202603231',41,NULL,'2026-03-23 15:40:42','2026-03-23 15:40:50'),(86,'PN202603241',123,NULL,3,1,'2026-03-24 01:08:01',3,100000.00,'Tạo phiếu nhập kho từ PO PO202603242918',39,NULL,'2026-03-24 01:05:48','2026-03-24 01:08:01'),(87,'PN202603242',109,NULL,3,1,NULL,4,4000.00,'Tạo phiếu nhập kho từ PO PO202603218219',NULL,NULL,'2026-03-24 02:08:57','2026-03-24 17:21:13'),(88,'PN202603243',113,NULL,2,1,NULL,4,2000.00,'Tạo phiếu nhập kho từ PO PO202603214109',NULL,NULL,'2026-03-24 02:14:28','2026-03-24 17:21:09'),(89,'PN202603244',125,NULL,3,1,'2026-03-24 17:49:26',3,2000.00,'Tạo phiếu nhập kho từ PO PO202603241092',39,NULL,'2026-03-24 17:48:43','2026-03-24 17:49:25'),(90,'PN202603245',111,NULL,1,1,NULL,4,4000.00,'Tạo phiếu nhập kho từ PO PO202603219304',NULL,NULL,'2026-03-24 17:59:04','2026-03-24 18:01:36'),(91,'PN-RET-202603251',NULL,153,NULL,1,'2026-03-25 02:54:35',3,1000.00,'Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: PX-TRF-202603252',41,NULL,'2026-03-25 02:54:28','2026-03-25 02:54:34'),(94,'PN-RET-202603261',NULL,NULL,NULL,1,'2026-03-25 17:50:48',3,150000.00,'Nhập hoàn trả từ phiếu xuất: PX202603255 (Đơn: SO202603256)',39,NULL,'2026-03-25 17:29:37','2026-03-25 17:54:53'),(97,'PN-RET-202603262',NULL,NULL,NULL,1,'2026-03-25 17:55:45',3,1000.00,'Nhập hoàn trả từ phiếu xuất: PX202603261 (Đơn: SO202603261)',39,NULL,'2026-03-25 17:55:23','2026-03-25 17:55:46'),(98,'PN-RET-202603263',NULL,NULL,NULL,1,'2026-03-25 17:57:53',3,150000.00,'Nhập hoàn trả từ phiếu xuất: PX202603262 (Đơn: SO202603262)',39,NULL,'2026-03-25 17:57:43','2026-03-25 17:57:53'),(99,'PN-RET-202603264',NULL,NULL,NULL,1,'2026-03-25 18:15:01',3,150000.00,'Nhập hoàn trả từ phiếu xuất: PX202603263 (Đơn: SO202603263)',39,NULL,'2026-03-25 18:14:40','2026-03-25 18:15:01');
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
INSERT INTO `phieu_xuat_kho` VALUES (97,'PX-TRF-202603161',NULL,NULL,1,'2026-03-16 14:44:11','khac',2,5,'',NULL,1,'2026-03-16 14:10:08','2026-03-18 18:38:02'),(98,'PX202603161',NULL,97,1,'2026-03-16 14:44:11','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603161',1,NULL,'2026-03-16 14:10:24','2026-03-16 14:44:11'),(101,'PX-TRF-202603171',NULL,NULL,1,'2026-03-16 18:54:22','khac',2,5,'',NULL,41,'2026-03-16 18:36:51','2026-03-18 18:38:02'),(102,'PX202603171',NULL,101,1,'2026-03-16 18:54:22','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603171',39,NULL,'2026-03-16 18:54:07','2026-03-16 18:54:23'),(103,'PX-TRF-202603172',NULL,NULL,1,'2026-03-16 19:01:36','khac',2,5,'',NULL,41,'2026-03-16 18:59:58','2026-03-18 18:38:02'),(104,'PX202603172',NULL,103,1,'2026-03-16 19:01:36','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603172',41,NULL,'2026-03-16 19:01:24','2026-03-16 19:01:36'),(105,'PX202603181',46,NULL,1,NULL,'ban_hang',NULL,4,'',NULL,NULL,'2026-03-18 13:24:19','2026-03-18 13:24:32'),(106,'PX202603182',46,NULL,1,'2026-03-18 13:24:51','ban_hang',NULL,3,'',41,NULL,'2026-03-18 13:24:41','2026-03-18 13:24:50'),(107,'PX202603183',46,NULL,1,'2026-03-18 13:35:33','ban_hang',NULL,3,'',1,NULL,'2026-03-18 13:35:25','2026-03-18 13:35:32'),(108,'PX202603184',47,NULL,2,'2026-03-18 13:37:54','ban_hang',NULL,3,'',1,NULL,'2026-03-18 13:37:42','2026-03-18 13:37:54'),(109,'PX-TRF-202603181',NULL,NULL,1,'2026-03-18 14:58:27','khac',2,4,'',NULL,1,'2026-03-18 14:57:57','2026-03-18 18:38:02'),(110,'PX202603185',NULL,109,1,'2026-03-18 14:58:27','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603181',1,NULL,'2026-03-18 14:58:13','2026-03-18 14:58:26'),(111,'PX-TRF-202603182',NULL,NULL,1,'2026-03-18 15:51:19','khac',2,5,'',NULL,41,'2026-03-18 15:49:29','2026-03-18 18:38:02'),(112,'PX202603186',NULL,111,1,'2026-03-18 15:51:18','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603182',41,NULL,'2026-03-18 15:51:04','2026-03-18 15:51:18'),(113,'PX-TRF-202603183',NULL,NULL,2,NULL,'khac',1,4,'',NULL,NULL,'2026-03-18 16:05:14','2026-03-18 18:38:02'),(114,'PX-TRF-202603184',NULL,NULL,2,NULL,'khac',1,4,'',NULL,NULL,'2026-03-18 16:16:29','2026-03-18 18:38:02'),(115,'PX-TRF-202603185',NULL,NULL,1,NULL,'khac',2,4,'',NULL,NULL,'2026-03-18 16:41:18','2026-03-18 18:38:02'),(116,'PX-TRF-202603186',NULL,NULL,1,'2026-03-18 17:15:49','khac',2,4,'',NULL,41,'2026-03-18 16:41:45','2026-03-18 18:38:02'),(117,'PX202603191',NULL,116,1,NULL,'chuyen_kho',2,4,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603186',NULL,NULL,'2026-03-18 17:05:09','2026-03-18 17:15:19'),(118,'PX202603192',NULL,116,1,'2026-03-18 17:15:49','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603186',41,NULL,'2026-03-18 17:15:36','2026-03-18 17:15:49'),(119,'PX-TRF-202603191',NULL,NULL,1,'2026-03-18 17:57:53','khac',2,5,'',NULL,41,'2026-03-18 17:56:02','2026-03-18 18:38:02'),(120,'PX202603193',NULL,119,1,'2026-03-18 17:57:53','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603191',39,NULL,'2026-03-18 17:57:35','2026-03-18 17:57:52'),(121,'PX-TRF-202603192',NULL,NULL,2,NULL,'khac',1,4,'',NULL,NULL,'2026-03-18 18:05:33','2026-03-18 18:38:02'),(122,'PX-TRF-202603193',NULL,NULL,2,'2026-03-18 18:14:40','khac',1,5,'',NULL,42,'2026-03-18 18:06:10','2026-03-18 18:38:02'),(123,'PX202603194',NULL,122,2,'2026-03-18 18:14:40','chuyen_kho',1,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603193',40,NULL,'2026-03-18 18:14:29','2026-03-18 18:14:40'),(126,'PX-TRF-202603194',NULL,NULL,2,'2026-03-18 18:50:13','khac',1,5,'',NULL,42,'2026-03-18 18:33:48','2026-03-18 18:51:34'),(127,'PX202603195',NULL,126,2,'2026-03-18 18:50:13','chuyen_kho',1,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603194',40,NULL,'2026-03-18 18:40:05','2026-03-18 18:50:13'),(128,'PX-TRF-202603195',NULL,NULL,2,NULL,'khac',1,4,'',NULL,NULL,'2026-03-18 18:55:39','2026-03-18 19:00:54'),(129,'PX-TRF-202603196',NULL,NULL,2,'2026-03-18 19:27:12','khac',1,5,'',NULL,42,'2026-03-18 19:01:14','2026-03-18 19:27:51'),(130,'PX202603196',NULL,129,2,'2026-03-18 19:27:12','chuyen_kho',1,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603196',40,NULL,'2026-03-18 19:05:45','2026-03-18 19:27:12'),(132,'PX202603197',48,NULL,1,'2026-03-18 19:47:15','ban_hang',NULL,3,'',1,NULL,'2026-03-18 19:46:37','2026-03-18 19:47:15'),(133,'PX202603198',48,NULL,1,'2026-03-18 19:47:47','ban_hang',NULL,3,'',1,NULL,'2026-03-18 19:47:38','2026-03-18 19:47:47'),(134,'PX202603199',49,NULL,1,'2026-03-18 20:23:48','ban_hang',NULL,3,'',39,NULL,'2026-03-18 20:23:37','2026-03-18 20:23:48'),(135,'PX2026031910',49,NULL,1,'2026-03-18 20:24:35','ban_hang',NULL,3,'',39,NULL,'2026-03-18 20:24:06','2026-03-18 20:24:35'),(136,'PX2026031911',50,NULL,1,'2026-03-18 21:08:43','ban_hang',NULL,3,'',39,NULL,'2026-03-18 21:07:49','2026-03-18 21:08:42'),(137,'PX2026031912',50,NULL,1,'2026-03-18 21:12:19','ban_hang',NULL,3,'',39,NULL,'2026-03-18 21:09:51','2026-03-18 21:12:19'),(138,'PX-TRF-202603197',NULL,NULL,1,'2026-03-18 21:17:42','khac',2,4,'',NULL,41,'2026-03-18 21:15:08','2026-03-18 21:21:43'),(139,'PX2026031913',NULL,138,1,'2026-03-18 21:17:42','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603197',39,NULL,'2026-03-18 21:16:39','2026-03-18 21:17:41'),(140,'PX-TRF-202603198',NULL,NULL,1,'2026-03-18 21:37:42','khac',2,4,'',NULL,1,'2026-03-18 21:37:16','2026-03-18 22:47:09'),(141,'PX2026031914',NULL,140,1,'2026-03-18 21:37:42','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603198',1,NULL,'2026-03-18 21:37:29','2026-03-18 21:37:42'),(142,'PX202603211',51,NULL,1,'2026-03-21 07:13:54','ban_hang',NULL,3,'',39,NULL,'2026-03-21 07:12:53','2026-03-21 07:13:52'),(143,'PX202603212',52,NULL,1,'2026-03-21 07:34:19','ban_hang',NULL,3,'',39,NULL,'2026-03-21 07:33:47','2026-03-21 07:34:18'),(144,'PX-TRF-202603211',NULL,NULL,1,'2026-03-21 07:42:12','khac',2,4,'',NULL,41,'2026-03-21 07:40:50','2026-03-21 07:43:44'),(145,'PX202603213',NULL,144,1,'2026-03-21 07:42:12','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603211',39,NULL,'2026-03-21 07:41:51','2026-03-21 07:42:11'),(146,'PX-TRF-202603212',NULL,NULL,1,'2026-03-21 07:45:50','khac',2,5,'',NULL,41,'2026-03-21 07:45:16','2026-03-21 07:46:24'),(147,'PX202603214',NULL,146,1,'2026-03-21 07:45:50','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603212',39,NULL,'2026-03-21 07:45:37','2026-03-21 07:45:49'),(148,'PX202603231',53,NULL,1,'2026-03-23 15:32:12','ban_hang',NULL,3,'',39,NULL,'2026-03-23 15:31:25','2026-03-23 15:32:11'),(149,'PX-TRF-202603231',NULL,NULL,1,'2026-03-23 15:38:49','khac',2,4,'',NULL,41,'2026-03-23 15:35:35','2026-03-23 15:40:00'),(150,'PX202603232',NULL,149,1,'2026-03-23 15:38:49','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603231',41,NULL,'2026-03-23 15:36:17','2026-03-23 15:38:48'),(151,'PX202603241',54,NULL,1,'2026-03-24 01:21:03','ban_hang',NULL,3,'',39,NULL,'2026-03-24 01:20:34','2026-03-24 01:21:03'),(152,'PX-TRF-202603251',NULL,NULL,1,NULL,'khac',2,4,'',NULL,1,'2026-03-24 19:13:34','2026-03-25 02:10:33'),(153,'PX-TRF-202603252',NULL,NULL,1,'2026-03-25 02:45:48','khac',2,4,'',NULL,41,'2026-03-25 02:38:13','2026-03-25 02:54:06'),(154,'PX202603251',NULL,153,1,'2026-03-25 02:45:48','chuyen_kho',2,3,'Xuất thủ công cho phiếu chuyển: PX-TRF-202603252',39,NULL,'2026-03-25 02:45:23','2026-03-25 02:45:48'),(155,'PX202603252',56,NULL,1,'2026-03-25 03:08:11','ban_hang',NULL,3,'',39,NULL,'2026-03-25 03:07:46','2026-03-25 03:08:11'),(160,'PX202603253',71,NULL,1,'2026-03-25 14:56:27','ban_hang',NULL,3,'',39,NULL,'2026-03-25 14:56:16','2026-03-25 14:56:28'),(161,'PX202603254',73,NULL,1,'2026-03-25 15:03:47','ban_hang',NULL,3,'',39,NULL,'2026-03-25 15:03:39','2026-03-25 15:03:47'),(162,'PX202603255',75,NULL,1,'2026-03-25 16:31:49','ban_hang',NULL,3,'',39,NULL,'2026-03-25 16:31:39','2026-03-25 16:31:49'),(163,'PX202603261',77,NULL,1,'2026-03-25 17:52:16','ban_hang',NULL,3,'',39,NULL,'2026-03-25 17:52:10','2026-03-25 17:52:16'),(164,'PX202603262',79,NULL,1,'2026-03-25 17:56:56','ban_hang',NULL,3,'',39,NULL,'2026-03-25 17:56:48','2026-03-25 17:56:56'),(165,'PX202603263',81,NULL,1,'2026-03-25 18:14:13','ban_hang',NULL,3,'',39,NULL,'2026-03-25 18:14:06','2026-03-25 18:14:13');
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
INSERT INTO `san_pham_quan_ao` VALUES (19,'ao-hong','Áo hồng',4,'Áo hồn','213243123',26631.58,31958.00,20,1,1,'2026-01-25 16:29:46','2026-03-25 17:55:46'),(20,'ao-hong-xinh','Áo hồng xinh',1,'Áo hồng xinh','123421332',185030.30,222037.00,20,0,1,'2026-01-25 16:32:51','2026-03-21 04:12:06'),(21,'AKB12345','Áo khoác bò ',1,'Áo khoác bò siêu đẹp siêu ấm','AKB12345',0.00,0.00,12,2,1,'2026-01-25 20:24:12','2026-03-21 04:14:59'),(22,'AT001','Áo thun nam basic',4,'Áo thun nam form regular, chất liệu cotton thoáng mát','AT001',80000.00,150000.00,20,2,1,'2026-02-02 16:05:29','2026-03-21 04:16:58'),(23,'AT002','Áo thun nữ trơn',4,'Áo thun nữ form fitted, cotton 100%','AT002',75000.00,140000.00,20,2,1,'2026-02-02 16:05:29','2026-03-21 04:16:26'),(24,'AS001','Áo sơ mi nam công sở',5,'Áo sơ mi nam tay dài, vải kate cao cấp','AS001',120000.00,250000.00,15,2,1,'2026-02-02 16:05:29','2026-03-21 04:15:53'),(25,'AS002','Áo sơ mi nữ kiểu dáng Hàn Quốc',5,'Áo sơ mi nữ tay ngắn, phong cách trẻ trung','AS002',110000.00,230000.00,15,2,1,'2026-02-02 16:05:29','2026-03-10 01:55:49'),(26,'QJ001','Quần jean nam regular fit',8,'Quần jean nam dáng regular, vải denim cao cấp','QJ001',150000.00,350000.00,10,2,1,'2026-02-02 16:05:29','2026-03-10 01:55:57'),(27,'QJ002','Quần jean nữ skinny',8,'Quần jean nữ dáng skinny ôm body','QJ002',145000.00,330000.00,10,2,1,'2026-02-02 16:05:29','2026-03-08 04:19:40'),(28,'QK001','Quần kaki nam slim fit',9,'Quần kaki nam dáng slim, vải kaki không nhăn','QK001',130000.00,280000.00,12,2,1,'2026-02-02 16:05:29','2026-03-10 01:56:41'),(29,'QT001','Quần tây nam công sở',10,'Quần tây nam cao cấp, vải kate Hàn Quốc','QT001',160000.00,400000.00,10,2,1,'2026-02-02 16:05:29','2026-03-10 01:56:47'),(30,'AK001','Áo khoác nam bomber',6,'Áo khoác bomber jacket unisex','AK001',200000.00,500000.00,8,2,1,'2026-02-02 16:05:29','2026-03-09 16:24:40'),(31,'AK002','Áo khoác nữ dạ tweed',6,'Áo khoác dạ nữ kiểu dáng thanh lịch','AK002',250000.00,650000.00,5,2,1,'2026-02-02 16:05:29','2026-03-10 01:54:56'),(32,'AP001','Áo polo nam',7,'Áo polo nam cổ bẻ, vải cotton pha','AP001',95000.00,200000.00,15,2,1,'2026-02-02 16:05:29','2026-03-09 14:03:19'),(33,'VCS001','Váy công sở xòe',12,'Váy công sở dáng xòe thanh lịch','VCS001',120000.00,280000.00,10,2,1,'2026-02-02 16:05:29','2026-03-08 04:19:50'),(48,'ATS25045','Áo Thun Nam 5S Fashion SMART-COTTON Phom Slimfit ATS25045',1,'Đặc điểm nổi bật\nPHOM DÁNG SLIMFIT\nVừa vặn, gọn gàng, tôn dáng\nTHẤM HÚT VƯỢT TRỘI\nƯu điểm của sợi Cotton cao cấp\nCHẤT LIỆU SMART COTTON MỚI\nNhẹ, mát, thoáng khí\nTHIẾT KẾ TRƠN BASIC 9 MÀU\nDễ mặc, dễ phối đồ','ATS25045',0.00,0.00,50,2,1,'2026-02-25 15:00:34','2026-03-21 04:18:00'),(52,'ABC','Áo thun chạy bộ nam Luman Gradient',1,'Thoáng Khí Vượt Trội, Bứt Phá Tốc Độ','ABC',150000.00,180000.00,5,1,1,'2026-03-07 11:50:05','2026-03-25 03:48:39'),(53,'AT2603141','Áo thun nam Pickleball Essentials',4,'','ATXXX',0.00,0.00,0,0,1,'2026-03-14 04:21:08','2026-03-14 04:21:08'),(54,'AT2603191','Áo thun hè mới nhất',4,'Hàng mới nhất hè 2026','',0.00,0.00,100,0,1,'2026-03-18 21:40:48','2026-03-18 21:40:51'),(55,'QN2603191','Quần dài nam Daily Pants',16,'','',0.00,0.00,20,2,41,'2026-03-18 22:43:31','2026-03-18 22:50:01'),(56,'QN2603192','Quần Nỉ Đẹp',14,'','',0.00,0.00,0,0,41,'2026-03-18 22:51:12','2026-03-21 04:13:48'),(57,'QN2603193','Quần nỉ new',14,'','',2000.00,2400.00,0,1,41,'2026-03-18 22:58:20','2026-03-24 17:49:25');
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
INSERT INTO `size` VALUES (1,'S','Size S','chu',1,'Size nhỏ','2026-01-21 13:53:10'),(2,'M','Size M','chu',2,'Size trung bình','2026-01-21 13:53:10'),(3,'L','Size L','chu',3,'Size lớn','2026-01-21 13:53:10'),(4,'XL','Size XL','chu',4,'Size rất lớn','2026-01-21 13:53:10'),(5,'XXL','Size XXL','chu',5,'Size cực lớn','2026-01-21 13:53:10'),(6,'28','Size 28','so',10,'Quần size 28','2026-01-21 13:53:10'),(7,'29','Size 29','so',11,'Quần size 29','2026-01-21 13:53:10'),(8,'30','Size 30','so',12,'Quần size 30','2026-01-21 13:53:10'),(9,'31','Size 31','so',13,'Quần size 31','2026-01-21 13:53:10'),(10,'32','Size 32','so',14,'Quần size 32','2026-01-21 13:53:10'),(11,'33','Size 33','so',15,'Quần size 33','2026-01-21 13:53:10'),(12,'34','Size 34','so',16,'Quần size 34','2026-01-21 13:53:10'),(13,'38','Size 38','so',20,'Giày size 38','2026-01-21 13:53:10'),(14,'39','Size 39','so',21,'Giày size 39','2026-01-21 13:53:10'),(15,'40','Size 40','so',22,'Giày size 40','2026-01-21 13:53:10'),(16,'41','Size 41','so',23,'Giày size 41','2026-01-21 13:53:10'),(17,'42','Size 42','so',24,'Giày size 42','2026-01-21 13:53:10');
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
INSERT INTO `tep_tin` VALUES (62,'san_pham_quan_ao_AT2603141_1773462067682_0','san_pham_quan_ao_AT2603141_1773462067682_0','san_pham_quan_ao_AT2603141_1773462067682_0','http://171.244.142.43:9000/fashion/san_pham_quan_ao_AT2603141_1773462067682_0','IMAGE','.jpg',NULL,NULL,'2026-03-14 04:21:08',NULL,1),(63,'san_pham_quan_ao_AT2603141_1773462067682_1','san_pham_quan_ao_AT2603141_1773462067682_1','san_pham_quan_ao_AT2603141_1773462067682_1','http://171.244.142.43:9000/fashion/san_pham_quan_ao_AT2603141_1773462067682_1','IMAGE','.jpg',NULL,NULL,'2026-03-14 04:21:08',NULL,1),(64,'san_pham_quan_ao_AT2603141_1773462067682_2','san_pham_quan_ao_AT2603141_1773462067682_2','san_pham_quan_ao_AT2603141_1773462067682_2','http://171.244.142.43:9000/fashion/san_pham_quan_ao_AT2603141_1773462067682_2','IMAGE','.jpg',NULL,NULL,'2026-03-14 04:21:08',NULL,1),(66,'san_pham_quan_ao_ABC_1773486180309_0','san_pham_quan_ao_ABC_1773486180309_0','san_pham_quan_ao_ABC_1773486180309_0','http://171.244.142.43:9000/fashion/san_pham_quan_ao_ABC_1773486180309_0','IMAGE','.jpg',NULL,NULL,'2026-03-14 02:44:02',NULL,1),(67,'bien_the_san_pham_ABC_1773486180781_0','bien_the_san_pham_ABC_1773486180781_0','bien_the_san_pham_ABC_1773486180781_0','http://171.244.142.43:9000/fashion/bien_the_san_pham_ABC_1773486180781_0','IMAGE','.jpg',NULL,NULL,NULL,NULL,1),(69,'bien_the_san_pham_AT2603141_1773868906170_0','bien_the_san_pham_AT2603141_1773868906170_0','bien_the_san_pham_AT2603141_1773868906170_0','http://171.244.142.43:9000/fashion/bien_the_san_pham_AT2603141_1773868906170_0','IMAGE','.png',NULL,NULL,NULL,NULL,1),(70,'san_pham_quan_ao_AT2603191_1773870047917_0','san_pham_quan_ao_AT2603191_1773870047917_0','san_pham_quan_ao_AT2603191_1773870047917_0','http://171.244.142.43:9000/fashion/san_pham_quan_ao_AT2603191_1773870047917_0','IMAGE','.webp',NULL,NULL,'2026-03-18 21:40:48',NULL,1),(71,'bien_the_san_pham_AT2603191-CL001-S-M002_1773870047917','bien_the_san_pham_AT2603191-CL001-S-M002_1773870047917','bien_the_san_pham_AT2603191-CL001-S-M002_1773870047917','http://171.244.142.43:9000/fashion/bien_the_san_pham_AT2603191-CL001-S-M002_1773870047917','IMAGE','.jpg',NULL,NULL,'2026-03-18 21:40:48',NULL,1),(72,'bien_the_san_pham_AT2603191-CL001-M-M004_1773870047917','bien_the_san_pham_AT2603191-CL001-M-M004_1773870047917','bien_the_san_pham_AT2603191-CL001-M-M004_1773870047917','http://171.244.142.43:9000/fashion/bien_the_san_pham_AT2603191-CL001-M-M004_1773870047917','IMAGE','.jpg',NULL,NULL,'2026-03-18 21:40:48',NULL,1),(73,'bien_the_san_pham_AT2603191-CL001-XL-M003_1773870047917','bien_the_san_pham_AT2603191-CL001-XL-M003_1773870047917','bien_the_san_pham_AT2603191-CL001-XL-M003_1773870047917','http://171.244.142.43:9000/fashion/bien_the_san_pham_AT2603191-CL001-XL-M003_1773870047917','IMAGE','.jpg',NULL,NULL,'2026-03-18 21:40:48',NULL,1),(74,'san_pham_quan_ao_QN2603191_1773873811125_0','san_pham_quan_ao_QN2603191_1773873811125_0','san_pham_quan_ao_QN2603191_1773873811125_0','http://171.244.142.43:9000/fashion/san_pham_quan_ao_QN2603191_1773873811125_0','IMAGE','.avif',NULL,NULL,'2026-03-18 22:43:31',NULL,1),(75,'bien_the_san_pham_QN2603191-CL005-S-M006_1773873811125','bien_the_san_pham_QN2603191-CL005-S-M006_1773873811125','bien_the_san_pham_QN2603191-CL005-S-M006_1773873811125','http://171.244.142.43:9000/fashion/bien_the_san_pham_QN2603191-CL005-S-M006_1773873811125','IMAGE','.avif',NULL,NULL,'2026-03-18 22:43:31',NULL,1),(76,'bien_the_san_pham_QN2603191-CL005-M-M004_1773873811125','bien_the_san_pham_QN2603191-CL005-M-M004_1773873811125','bien_the_san_pham_QN2603191-CL005-M-M004_1773873811125','http://171.244.142.43:9000/fashion/bien_the_san_pham_QN2603191-CL005-M-M004_1773873811125','IMAGE','.avif',NULL,NULL,'2026-03-18 22:43:31',NULL,1),(77,'san_pham_quan_ao_QN2603192_1773874272294_0','san_pham_quan_ao_QN2603192_1773874272294_0','san_pham_quan_ao_QN2603192_1773874272294_0','http://171.244.142.43:9000/fashion/san_pham_quan_ao_QN2603192_1773874272294_0','IMAGE','.avif',NULL,NULL,'2026-03-18 22:51:12',NULL,1),(78,'bien_the_san_pham_QN2603192-CL005-S-M006_1773874272294','bien_the_san_pham_QN2603192-CL005-S-M006_1773874272294','bien_the_san_pham_QN2603192-CL005-S-M006_1773874272294','http://171.244.142.43:9000/fashion/bien_the_san_pham_QN2603192-CL005-S-M006_1773874272294','IMAGE','.avif',NULL,NULL,'2026-03-18 22:51:12',NULL,1),(79,'bien_the_san_pham_QN2603192-CL005-S-M004_1773874272294','bien_the_san_pham_QN2603192-CL005-S-M004_1773874272294','bien_the_san_pham_QN2603192-CL005-S-M004_1773874272294','http://171.244.142.43:9000/fashion/bien_the_san_pham_QN2603192-CL005-S-M004_1773874272294','IMAGE','.avif',NULL,NULL,'2026-03-18 22:51:12',NULL,1),(80,'san_pham_quan_ao_QN2603193_1773874699643_0','san_pham_quan_ao_QN2603193_1773874699643_0','san_pham_quan_ao_QN2603193_1773874699643_0','http://171.244.142.43:9000/fashion/san_pham_quan_ao_QN2603193_1773874699643_0','IMAGE','.webp',NULL,NULL,'2026-03-18 22:58:20',NULL,1),(81,'bien_the_san_pham_QN2603193-CL002-M-M002_1773874699643','bien_the_san_pham_QN2603193-CL002-M-M002_1773874699643','bien_the_san_pham_QN2603193-CL002-M-M002_1773874699643','http://171.244.142.43:9000/fashion/bien_the_san_pham_QN2603193-CL002-M-M002_1773874699643','IMAGE','.jpg',NULL,NULL,'2026-03-18 22:58:20',NULL,1);
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
INSERT INTO `ton_kho_theo_lo` (`id`, `lo_hang_id`, `kho_id`, `so_luong_ton`, `so_luong_da_dat`, `ngay_nhap_gan_nhat`, `ngay_xuat_gan_nhat`, `lan_cap_nhat_cuoi`) VALUES (49,51,1,13.000,0.000,'2026-03-25 18:15:01','2026-03-25 18:14:13','2026-03-26 01:40:55'),(50,51,20,0.000,0.000,'2026-03-18 19:27:12',NULL,'2026-03-18 19:27:50'),(51,51,2,10.000,0.000,'2026-03-18 17:58:42','2026-03-18 19:27:12','2026-03-18 19:27:12'),(52,52,1,0.000,0.000,'2026-03-18 21:24:17','2026-03-25 03:48:39','2026-03-25 03:48:39'),(53,53,1,0.000,0.000,'2026-03-18 22:47:27','2026-03-25 03:25:10','2026-03-25 03:25:10'),(54,55,1,0.000,0.000,'2026-03-18 20:52:21','2026-03-18 21:12:19','2026-03-18 21:12:19'),(55,56,1,0.000,0.000,'2026-03-18 21:04:29','2026-03-18 21:08:42','2026-03-18 21:08:42'),(56,57,1,0.000,0.000,'2026-03-18 21:04:29','2026-03-18 21:08:42','2026-03-18 21:08:42'),(57,52,20,0.000,0.000,'2026-03-18 21:17:41',NULL,'2026-03-18 21:24:17'),(58,53,20,0.000,0.000,'2026-03-18 21:37:42',NULL,'2026-03-18 22:47:27'),(59,58,1,15.000,0.000,'2026-03-23 15:40:51','2026-03-23 15:38:49','2026-03-26 01:40:52'),(60,60,1,0.000,0.000,'2026-03-21 06:02:18','2026-03-21 07:13:53','2026-03-21 07:13:52'),(61,61,1,0.000,0.000,'2026-03-21 06:02:18','2026-03-21 07:13:53','2026-03-21 07:13:52'),(62,62,1,0.000,0.000,'2026-03-21 07:44:43','2026-03-21 07:45:50','2026-03-21 07:45:49'),(63,63,1,0.000,0.000,'2026-03-21 06:50:35','2026-03-21 07:34:19','2026-03-21 07:34:18'),(64,62,20,0.000,0.000,'2026-03-21 07:45:50',NULL,'2026-03-21 07:46:24'),(65,62,2,5.000,0.000,'2026-03-21 07:46:25',NULL,'2026-03-21 07:46:24'),(66,64,1,4.000,0.000,'2026-03-25 17:55:45','2026-03-25 17:52:16','2026-03-25 17:55:46'),(67,58,20,0.000,0.000,'2026-03-23 15:38:49',NULL,'2026-03-23 15:40:50'),(68,64,20,0.000,0.000,'2026-03-25 02:45:48',NULL,'2026-03-25 02:54:34'),(69,65,1,0.000,0.000,'2026-03-24 01:08:00','2026-03-24 01:21:01','2026-03-24 01:21:02'),(70,66,1,0.000,0.000,'2026-03-24 01:08:01','2026-03-25 03:23:31','2026-03-25 03:23:30'),(71,68,1,1.000,0.000,'2026-03-24 17:49:26',NULL,'2026-03-24 17:49:25');
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
INSERT INTO `yeu_cau_mua_hang` VALUES (2,'RFQ20263267049',1,'2026-03-28 00:00:00',3,NULL,39,NULL,'2026-03-25 22:23:21',NULL),(3,'RFQ20263265458',1,'2026-03-28 00:00:00',3,NULL,39,NULL,'2026-03-25 22:49:25',NULL),(4,'RFQ20263269693',1,'2026-03-27 00:00:00',3,NULL,39,NULL,'2026-03-25 23:05:49',NULL),(5,'RFQ20263269246',1,'2026-03-29 00:00:00',3,NULL,43,NULL,'2026-03-25 23:29:11',NULL),(6,NULL,1,'2026-03-26 00:00:00',4,NULL,43,NULL,'2026-03-25 23:31:33',NULL),(7,'RFQ20263267150',1,'2026-03-30 00:00:00',3,NULL,39,NULL,'2026-03-25 23:45:23',NULL),(8,'RFQ20263268945',1,'2026-03-30 00:00:00',3,NULL,43,NULL,'2026-03-26 00:55:19',NULL),(9,'RFQ20263268270',1,'2026-03-28 00:00:00',3,NULL,39,NULL,'2026-03-26 02:55:58',NULL),(10,'RFQ20263266306',1,'2026-03-28 00:00:00',3,NULL,39,NULL,'2026-03-26 03:22:55',NULL),(11,NULL,1,'2026-03-28 00:00:00',2,NULL,43,NULL,'2026-03-26 04:39:19',NULL);
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

-- Dump completed on 2026-09-21  8:46:59
