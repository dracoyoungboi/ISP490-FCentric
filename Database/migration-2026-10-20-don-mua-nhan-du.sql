-- =====================================================================
-- Đơn mua đã nhận đủ: trạng thái 4 -> 5 – 2026-10-20
--
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy nguyên tệp với @chay_that = 0 không đổi gì trong CSDL, chỉ in ra
-- danh sách đơn sẽ đổi. Xem kỹ rồi mới đổi @chay_that = 1 và chạy lại.
--
-- Vì sao: trước đây hoàn tất phiếu nhập kho (PhieuNhapKhoService.completePhieuNhap) đặt đơn mua đã nhận đủ về
-- trạng thái 4 ("Hoàn thành"); nay đặt 5. Frontend (constants/donMuaHang.js) gọi 4 = "Không chấp nhận báo giá",
-- 5 = "Đã nhận đủ", và trang Đơn mua hàng chỉ lấy 3, 5: đơn nhận đủ cũ còn ở 4 nên hiện sai tên và mất khỏi bộ lọc.
--
-- Khi chạy thật: đổi don_mua_hang.trang_thai 4 -> 5 CHỈ cho đơn thỏa đủ:
--   a. có ít nhất một phiếu nhập kho hoàn tất (phieu_nhap_kho.trang_thai = 3 — TrangThaiPhieuNhap.COMPLETED;
--      chú thích cột trong MyDB "1: Hoàn thành" đã cũ, mã nguồn ghi 3);
--   b. có dòng chi tiết, và MỌI dòng chi_tiet_don_mua_hang có so_luong_da_nhan >= so_luong_dat.
-- Báo giá bị từ chối (4 thật) không bao giờ có phiếu nhập nên không bị đổi.
-- Giữ nguyên ngay_cap_nhat (cột tự cập nhật ON UPDATE): đây là sửa mã trạng thái, không phải thao tác nghiệp vụ mới.
--
-- Không làm gì:
--   - Không xóa dòng nào, không đổi số lượng, không đụng phiếu nhập.
--   - Không đổi đơn ở trạng thái khác 4. Đơn 4 có phiếu nhập hoàn tất mà CHƯA nhận đủ được đếm riêng ở phần
--     Kết quả để xem tay (không tự đổi).
--
-- Chống treo hệ thống:
--   - Chỉ chờ khóa tối đa 5 giây (lock_wait_timeout = 5, innodb_lock_wait_timeout = 5): quá 5 giây thì báo lỗi
--     1205, KHÔNG đổi gì.
--   - Chạy nhiều lần vẫn được: đơn đã sang 5 không còn khớp điều kiện trang_thai = 4.
--   - Không cần DELIMITER, chạy được trong MySQL Workbench và mysql CLI (MySQL 8).
--   - Tắt sql_safe_updates trong phiên: lệnh UPDATE lọc theo trang_thai + điều kiện phiếu nhập / chi tiết, không lọc
--     theo khóa chính, Workbench bật chế độ an toàn sẽ từ chối (lỗi 1175). Các SET SESSION chỉ có hiệu lực trong kết
--     nối đang chạy và được trả lại ở cuối tệp.
--   - GẶP LỖI giữa chừng (vd. 1205 hết giờ chờ khóa): Workbench dừng tại lệnh lỗi, giao dịch còn mở và các SET SESSION
--     chưa được trả lại → chạy ROLLBACK; rồi chạy 3 lệnh SET SESSION khôi phục ở cuối tệp (hoặc Query › Reconnect to
--     Server / đóng hẳn kết nối). Chỉ đóng tab truy vấn là CHƯA đủ: các tab truy vấn của cùng một kết nối Workbench dùng
--     chung một phiên MySQL, phiên vẫn để sql_safe_updates = 0 và thời gian chờ khóa 5 giây.
--
-- Trước khi chạy thật: SAO LƯU bảng don_mua_hang (vd. mysqldump fashion_system don_mua_hang > bk_don_mua_20261020.sql)
-- và GIỮ LẠI cột id của danh sách in ra (dùng để hoàn tác).
-- =====================================================================
SET NAMES utf8mb4;

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT

SET @cho_khoa_cu = @@SESSION.lock_wait_timeout;
SET @cho_khoa_dong_cu = @@SESSION.innodb_lock_wait_timeout;
SET @safe_updates_cu = @@SESSION.sql_safe_updates;
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;
SET SESSION sql_safe_updates = 0;

-- ---------------------------------------------------------------------
-- 1. Danh sách đơn sẽ đổi 4 -> 5 (in ra ở cả hai chế độ, TRƯỚC khi đổi)
-- ---------------------------------------------------------------------
SELECT dm.id,
       dm.so_don_mua,
       dm.trang_thai AS trang_thai_hien_tai,
       5 AS trang_thai_sau,
       dm.ngay_cap_nhat,
       (SELECT COUNT(*) FROM phieu_nhap_kho pn
         WHERE pn.don_mua_hang_id = dm.id AND pn.trang_thai = 3) AS so_phieu_nhap_hoan_tat,
       (SELECT SUM(ct.so_luong_dat) FROM chi_tiet_don_mua_hang ct WHERE ct.don_mua_hang_id = dm.id) AS tong_so_dat,
       (SELECT SUM(ct.so_luong_da_nhan) FROM chi_tiet_don_mua_hang ct WHERE ct.don_mua_hang_id = dm.id) AS tong_da_nhan
FROM don_mua_hang dm
WHERE dm.trang_thai = 4
  AND EXISTS (SELECT 1 FROM phieu_nhap_kho pn
               WHERE pn.don_mua_hang_id = dm.id AND pn.trang_thai = 3)
  AND EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct WHERE ct.don_mua_hang_id = dm.id)
  AND NOT EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct
                   WHERE ct.don_mua_hang_id = dm.id
                     AND (ct.so_luong_da_nhan IS NULL OR ct.so_luong_da_nhan < ct.so_luong_dat))
ORDER BY dm.id;

SET @so_se_doi = (SELECT COUNT(*) FROM don_mua_hang dm
  WHERE dm.trang_thai = 4
    AND EXISTS (SELECT 1 FROM phieu_nhap_kho pn
                 WHERE pn.don_mua_hang_id = dm.id AND pn.trang_thai = 3)
    AND EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct WHERE ct.don_mua_hang_id = dm.id)
    AND NOT EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct
                     WHERE ct.don_mua_hang_id = dm.id
                       AND (ct.so_luong_da_nhan IS NULL OR ct.so_luong_da_nhan < ct.so_luong_dat)));

-- Đơn 4 đã có phiếu nhập hoàn tất nhưng chưa nhận đủ: không đổi, chỉ đếm để xem tay
SET @so_can_xem_tay = (SELECT COUNT(*) FROM don_mua_hang dm
  WHERE dm.trang_thai = 4
    AND EXISTS (SELECT 1 FROM phieu_nhap_kho pn
                 WHERE pn.don_mua_hang_id = dm.id AND pn.trang_thai = 3)
    AND (NOT EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct WHERE ct.don_mua_hang_id = dm.id)
         OR EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct
                     WHERE ct.don_mua_hang_id = dm.id
                       AND (ct.so_luong_da_nhan IS NULL OR ct.so_luong_da_nhan < ct.so_luong_dat))));

-- ---------------------------------------------------------------------
-- 2. Đổi trạng thái (chỉ khi @chay_that = 1)
--    GẶP LỖI ở lệnh UPDATE (vd. 1205 hết giờ chờ khóa — InnoDB chỉ hủy lệnh đó, giao dịch vẫn mở): chạy ROLLBACK;
--    rồi CHỈ chạy 3 lệnh SET SESSION khôi phục ở cuối tệp (hoặc Query › Reconnect to Server / đóng hẳn kết nối) để trả
--    lại sql_safe_updates và thời gian chờ khóa, không chạy COMMIT và các lệnh khác bên dưới. Đóng tab truy vấn không
--    trả lại được (các tab cùng kết nối dùng chung một phiên MySQL).
-- ---------------------------------------------------------------------
START TRANSACTION;

UPDATE don_mua_hang dm
SET dm.trang_thai = 5,
    dm.ngay_cap_nhat = dm.ngay_cap_nhat      -- gán lại giá trị cũ: MySQL không tự đặt NOW() cho cột ON UPDATE
WHERE @chay_that = 1
  AND dm.trang_thai = 4
  AND EXISTS (SELECT 1 FROM phieu_nhap_kho pn
               WHERE pn.don_mua_hang_id = dm.id AND pn.trang_thai = 3)
  AND EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct WHERE ct.don_mua_hang_id = dm.id)
  AND NOT EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct
                   WHERE ct.don_mua_hang_id = dm.id
                     AND (ct.so_luong_da_nhan IS NULL OR ct.so_luong_da_nhan < ct.so_luong_dat));
SET @da_doi = ROW_COUNT();

COMMIT;

-- ---------------------------------------------------------------------
-- Kết quả
-- ---------------------------------------------------------------------
SELECT IF(@chay_that = 1, 'ĐÃ CHẠY THẬT', 'CHỈ XEM TRƯỚC — chưa đổi gì') AS che_do,
       @so_se_doi AS so_don_nhan_du_dang_o_4,
       IF(@chay_that = 1, @da_doi, 0) AS so_don_da_doi_sang_5,
       @so_can_xem_tay AS so_don_4_co_phieu_nhap_chua_nhan_du_khong_doi;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION sql_safe_updates = @safe_updates_cu;

-- ---------------------------------------------------------------------
-- Hoàn tác (chạy tay nếu cần; thay <id...> bằng cột id của danh sách đã in ra lúc CHẠY THẬT):
--   UPDATE don_mua_hang
--   SET trang_thai = 4, ngay_cap_nhat = ngay_cap_nhat
--   WHERE trang_thai = 5 AND id IN (<id...>);
-- hoặc nạp lại bản sao lưu bk_don_mua_20261020.sql.
-- Lưu ý: hoàn tác thì đơn lại hiện "Không chấp nhận báo giá" và mất khỏi trang Đơn mua hàng như trước.
-- ---------------------------------------------------------------------
