-- =====================================================================
-- Dọn phiếu chuyển kho CŨ trong phieu_xuat_kho (loai_xuat = 'khac') – chạy SAU migration-2026-10-28-chuyen-kho-noi-bo.sql
-- và sau khi backend mới đã chạy ổn định (đã thử tạo, duyệt, xuất, nhận trên phiếu mới, phiếu cũ mở đúng ở màn mới).
--
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: @chay_that = 0 chỉ ĐỌC (không tạo bảng, không khóa dòng), in số dòng sẽ dọn và các phiếu không
-- dọn. Đổi @chay_that = 1 để chạy thật (dùng bảng phụ tmp_phieu_cu_don, xóa ở cuối tệp). Chạy lại không lỗi.
--
-- Việc tệp làm, chỉ với phiếu cũ đủ 3 điều kiện: ĐÃ chép sang phieu_chuyen_kho (cùng id và cùng số phiếu), không còn dòng
-- đã chọn lô, và mọi phiếu xuất con / phiếu nhập của nó đã nối sang phiếu mới (cột phieu_chuyen_kho_id):
--   1. Bỏ nối cũ: phieu_xuat_kho.parent_id (phiếu xuất con) và phieu_nhap_kho.phieu_chuyen_id → NULL, chỉ ở chứng từ đã
--      nối qua phieu_chuyen_kho_id; giữ nguyên ngày cập nhật của chứng từ.
--   2. Xóa đầu phiếu cũ trong phieu_xuat_kho bằng MỘT câu: dòng hàng trong chi_tiet_phieu_xuat_kho tự xóa theo (khóa ngoại
--      ON DELETE CASCADE có sẵn), nên lỗi giữa chừng không để lại phiếu mất dòng hàng.
-- Phiếu cũ không đủ điều kiện: KHÔNG đụng, được liệt kê kèm lý do để xử lý tay.
-- Không xóa cột parent_id / phieu_chuyen_id (để dành một bản phát hành rồi mới bỏ).
--
-- Lỗi giữa chừng (vd. 1205 vì còn kết nối giữ bảng): tắt kết nối đó rồi chạy lại cả tệp trong cùng tab (bước đã làm tự bỏ
-- qua, cuối tệp trả lại cài đặt phiên), hoặc đóng tab và mở kết nối mới.
-- =====================================================================

SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 / cp850 thì chữ tiếng Việt trong COMMENT bị lỗi mã

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác
SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT

-- Chống treo hệ thống: chỉ chờ khóa tối đa 5 giây. Còn kết nối giữ bảng (backend cũ, máy localhost) thì lệnh đó báo lỗi
-- 1205 và KHÔNG đổi gì, thay vì đứng chờ kéo cả hệ thống đứng theo. Giá trị gốc chỉ lưu khi chưa có, nên lần chạy lại sau
-- lỗi giữa chừng vẫn trả về đúng giá trị ban đầu.
SET @cho_khoa_cu = IFNULL(@cho_khoa_cu, @@SESSION.lock_wait_timeout);
SET @cho_khoa_dong_cu = IFNULL(@cho_khoa_dong_cu, @@SESSION.innodb_lock_wait_timeout);
SET @an_toan_cu = IFNULL(@an_toan_cu, @@SESSION.sql_safe_updates);
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;
-- Workbench mặc định bật Safe Updates: UPDATE không lọc theo cột khóa bị chặn (lỗi 1175) — tắt trong lúc chạy
SET SESSION sql_safe_updates = 0;

-- Phiếu cũ sẽ dọn: định nghĩa một chỗ, dùng cho cả xem trước lẫn chạy thật
SET @chon = 'SELECT p.id FROM phieu_xuat_kho p
   JOIN phieu_chuyen_kho pck ON pck.id = p.id AND pck.so_phieu_chuyen = p.so_phieu_xuat
  WHERE p.loai_xuat = ''khac''
    AND NOT EXISTS (SELECT 1 FROM chi_tiet_phieu_xuat_kho c WHERE c.phieu_xuat_kho_id = p.id AND c.lo_hang_id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM phieu_xuat_kho con WHERE con.parent_id = p.id AND con.phieu_chuyen_kho_id IS NULL)
    AND NOT EXISTS (SELECT 1 FROM phieu_nhap_kho n WHERE n.phieu_chuyen_id = p.id AND n.phieu_chuyen_kho_id IS NULL)';

-- Số sẽ dọn (chỉ đọc)
SET @sql = CONCAT('SELECT (SELECT COUNT(*) FROM (', @chon, ') d)                                           AS phieu_cu_se_xoa,
   (SELECT COUNT(*) FROM chi_tiet_phieu_xuat_kho ct WHERE ct.phieu_xuat_kho_id IN (', @chon, '))     AS dong_hang_se_xoa,
   (SELECT COUNT(*) FROM phieu_xuat_kho px WHERE px.parent_id IN (', @chon, '))                      AS phieu_xuat_con_bo_noi_cu,
   (SELECT COUNT(*) FROM phieu_nhap_kho pn WHERE pn.phieu_chuyen_id IN (', @chon, '))                AS phieu_nhap_bo_noi_cu');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Phiếu chuyển cũ KHÔNG dọn, kèm lý do: xử lý tay (chỉ đọc)
SET @sql = CONCAT('SELECT p.id, p.so_phieu_xuat, p.trang_thai,
       CASE WHEN pck.id IS NULL THEN ''Chưa chép sang phieu_chuyen_kho''
            WHEN EXISTS (SELECT 1 FROM chi_tiet_phieu_xuat_kho c WHERE c.phieu_xuat_kho_id = p.id AND c.lo_hang_id IS NOT NULL)
                 THEN ''Còn dòng đã chọn lô''
            ELSE ''Còn phiếu xuất con / phiếu nhập chưa nối sang phiếu mới'' END AS ly_do
  FROM phieu_xuat_kho p
  LEFT JOIN phieu_chuyen_kho pck ON pck.id = p.id AND pck.so_phieu_chuyen = p.so_phieu_xuat
 WHERE p.loai_xuat = ''khac'' AND p.parent_id IS NULL AND p.kho_chuyen_den_id IS NOT NULL
   AND p.id NOT IN (', @chon, ')
 ORDER BY p.id');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Chạy thật. Bảng phụ thường (UPDATE / DELETE không đọc lại được chính bảng đang sửa trong truy vấn con)
SET @sql = IF(@chay_that = 1, 'DROP TABLE IF EXISTS tmp_phieu_cu_don', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;
SET @sql = IF(@chay_that = 1, 'CREATE TABLE tmp_phieu_cu_don (id INT PRIMARY KEY)', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;
SET @sql = IF(@chay_that = 1, CONCAT('INSERT INTO tmp_phieu_cu_don (id) ', @chon), 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- 1. Bỏ nối cũ ở chứng từ đã nối sang phiếu mới; tự gán lại ngay_cap_nhat để cột ON UPDATE không nhảy về giờ chạy tệp
SET @sql = IF(@chay_that = 1,
  'UPDATE phieu_xuat_kho c JOIN tmp_phieu_cu_don t ON t.id = c.parent_id
      SET c.parent_id = NULL, c.ngay_cap_nhat = c.ngay_cap_nhat
    WHERE c.phieu_chuyen_kho_id IS NOT NULL', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chay_that = 1,
  'UPDATE phieu_nhap_kho n JOIN tmp_phieu_cu_don t ON t.id = n.phieu_chuyen_id
      SET n.phieu_chuyen_id = NULL, n.ngay_cap_nhat = n.ngay_cap_nhat
    WHERE n.phieu_chuyen_kho_id IS NOT NULL', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- 2. Xóa đầu phiếu cũ, MỘT câu: dòng hàng tự xóa theo (chi_tiet_phieu_xuat_kho ON DELETE CASCADE). Còn khóa ngoại nào khác
--    trỏ tới phiếu thì cả câu báo lỗi 1451 và không xóa gì.
SET @sql = IF(@chay_that = 1,
  'DELETE p FROM phieu_xuat_kho p JOIN tmp_phieu_cu_don t ON t.id = p.id WHERE p.loai_xuat = ''khac''', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chay_that = 1, 'DROP TABLE IF EXISTS tmp_phieu_cu_don', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Kiểm sau khi chạy: phiếu chuyển cũ còn lại trong phieu_xuat_kho (phải bằng số dòng ở bảng "không dọn" phía trên)
SET @sql = IF(@chay_that = 1,
  'SELECT COUNT(*) AS phieu_chuyen_cu_con_lai FROM phieu_xuat_kho
    WHERE loai_xuat = ''khac'' AND parent_id IS NULL AND kho_chuyen_den_id IS NOT NULL', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SELECT IF(@chay_that = 1, 'ĐÃ CHẠY THẬT', 'CHỈ XEM TRƯỚC: chưa đổi gì. Đổi @chay_that = 1 để chạy thật.') AS ket_qua;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION sql_safe_updates = @an_toan_cu;
SET @cho_khoa_cu = NULL, @cho_khoa_dong_cu = NULL, @an_toan_cu = NULL;
