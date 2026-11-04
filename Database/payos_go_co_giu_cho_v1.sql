-- =====================================================================================================================
-- Gỡ cờ "đang giữ hàng" (pos_payos_payment.dang_giu_cho) còn sót trên giao dịch QR ĐÃ THANH TOÁN.
--
-- Vì sao có: payos_xu_ly_loi_v1.sql (25/10/2026) lúc tạo cột đã bật cờ cho mọi giao dịch đang PENDING. Vài giao dịch
-- PENDING lúc đó sau được backend bản cũ (chưa biết cờ này) ghi nhận tiền về -> thành PAID, có đơn bán, nhưng cờ vẫn 1.
-- Ví dụ ở Cửa hàng Hà Nội: QR 1792862249445 (SO202610241), 1792866301879 (SO202610243), 1792867038855 (SO202610244).
-- Màn Tạo đợt kiểm kê đọc cờ này nên báo nhầm "Đơn bán tại quầy đang chờ khách chuyển khoản giữ hàng".
-- (Backend mới đã chỉ xét giao dịch PENDING / PAID_ERROR; script này dọn dữ liệu cho sạch.)
--
-- Chỉ đụng giao dịch PAID: lúc tạo đơn, hệ thống đã trừ kho theo phần giữ chỗ, nên cờ chỉ còn là nhãn sai.
-- KHÔNG đụng PENDING / PAID_ERROR (còn giữ hàng thật) và CANCELLED / EXPIRED / REFUNDED (nếu có dòng nào còn cờ thì
-- phần giữ chỗ trên lô có thể chưa trả — soát tay bằng truy vấn 3, đừng tắt cờ suông).
-- Chạy lại nhiều lần không sao.
-- =====================================================================================================================

-- 1. Xem trước các dòng sẽ sửa
SELECT id, order_code, kho_id, trang_thai, so_tien, ngay_tao
FROM pos_payos_payment
WHERE trang_thai = 'PAID' AND dang_giu_cho = 1
ORDER BY id;

-- 2. Sửa (Workbench bật Safe Updates thì cần dòng SET đầu; điều kiện không theo khóa chính)
SET SQL_SAFE_UPDATES = 0;
UPDATE pos_payos_payment
SET dang_giu_cho = 0
WHERE trang_thai = 'PAID' AND dang_giu_cho = 1;
SET SQL_SAFE_UPDATES = 1;

-- 3. Kiểm tra sau khi chạy
--   a) Không còn giao dịch đã đóng mà cờ còn bật (mong đợi: 0 dòng; có dòng CANCELLED/EXPIRED/REFUNDED thì soát tay)
SELECT id, order_code, kho_id, trang_thai, giu_cho_json
FROM pos_payos_payment
WHERE dang_giu_cho = 1 AND trang_thai NOT IN ('PENDING', 'PAID_ERROR');
--   b) Lô còn "đã đặt" (so_luong_da_dat > 0): so với giữ chỗ còn hiệu lực (QR PENDING/PAID_ERROR, phiếu nhặt, đơn chờ
--      xuất). Lô nào không có lý do giữ thì báo lại để xử lý riêng — script này không sửa tồn kho.
SELECT t.id AS ton_kho_theo_lo_id, t.kho_id, l.ma_lo, t.so_luong_ton, t.so_luong_da_dat
FROM ton_kho_theo_lo t
JOIN lo_hang l ON l.id = t.lo_hang_id
WHERE t.so_luong_da_dat > 0
ORDER BY t.kho_id, t.id;
