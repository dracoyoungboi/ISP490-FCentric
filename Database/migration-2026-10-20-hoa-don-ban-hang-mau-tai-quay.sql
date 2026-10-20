-- =====================================================================
-- Hóa đơn bán hàng – 2026-10-20 (phần 2/2: mục 4, mẫu in hóa đơn tại quầy)
--
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy nguyên tệp với @chay_that = 0 không đổi gì trong CSDL, chỉ in ra
-- việc sẽ làm. Xem kỹ rồi mới đổi @chay_that = 1 và chạy lại.
--
-- Khi chạy thật:
--   4. Mẫu in: hóa đơn in tại quầy tách thành loại "pos_invoice" (K80 / K57). Mẫu K80 đã chỉnh của
--      "sales_invoice" (nếu có) được CHÉP sang pos_invoice_default_K80; nếu hóa đơn đang dùng K80 thì
--      pos_invoice dùng K80 và sales_invoice về khổ tờ A4 / A5 (in từ trang đơn bán).
--
-- THỨ TỰ CHẠY KHI TRIỂN KHAI:
--   B1. migration-2026-10-20-hoa-don-ban-hang.sql (mục 1–3, cột mới) – TRƯỚC khi khởi động backend mới.
--   B2. Triển khai backend + frontend mới, rồi TẢI LẠI NGAY (F5 / mở lại tab bán tại quầy) MỌI máy quầy.
--   B3. Tệp NÀY – chạy NGAY sau B2, không cần chờ các quầy tải lại. Không chạy trước B2 (frontend cũ in
--       hóa đơn quầy bằng mẫu áp dụng của "sales_invoice", tệp này chuyển mẫu đó về khổ tờ).
--   Rủi ro in A4 ra máy in nhiệt bắt đầu TỪ B2, chạy B3 hay chưa cũng vậy: màn bán tại quầy CŨ (chưa tải
--   lại) mở tab in "/sales-orders/{id}/invoice" KHÔNG có "?mau=tai-quay"; tab mới tải frontend MỚI, in theo
--   mẫu "sales_invoice" và bỏ qua mẫu áp dụng K80 cũ -> ra A4 / A5. Chỉ tải lại máy quầy mới hết rủi ro
--   này (nên lên bản mới lúc quầy không bán). Hoãn B3 không bảo vệ quầy, chỉ kéo dài thời gian quầy (đã
--   tải lại) in mẫu K80 MẶC ĐỊNH (chưa có logo, lời chân… đã chỉnh ở mẫu K80 cũ).
--
-- Code mới chạy đúng khi CHƯA chạy tệp này (đã kiểm 20/10, đọc code):
--   - Frontend: resolveInUseTemplateId (components/print/cauHinhMauIn.js, dùng qua
--     services/printTemplateConfigService.js) chỉ xét mẫu có trong registry printSchemas.js. Registry
--     "sales_invoice" chỉ còn A4/A5 nên dòng áp dụng cũ "sales_invoice_default_K80" bị bỏ qua -> in từ
--     đơn bán dùng A4/A5 đã lưu, chưa lưu thì A4 mặc định. "pos_invoice" chưa có dòng nào -> mẫu mặc định
--     K80 của registry (màn bán tại quầy MỚI mở tab in có "?mau=tai-quay" vẫn ra K80).
--   - Backend: IPrintTemplateConfig.isFrontendTemplateId loại sales_invoice_default_K80 khỏi "mẫu đang in"
--     (ảnh chụp lịch sử); defaultTemplateId("pos_invoice") = pos_invoice_default_K80. Không có chỗ nào
--     bắt buộc phải có dòng pos_invoice.
--   - Nếu trong lúc chờ đã có người lưu mẫu "Hóa đơn bán hàng tại quầy": tệp này không chép đè
--     (chỉ chép khi chưa có pos_invoice_default_K80, chỉ đặt mẫu áp dụng khi pos_invoice chưa có).
--
-- Không làm gì:
--   - Không xóa dòng nào. Dòng sales_invoice_default_K80 cũ được giữ nguyên (frontend mới không dùng).
--
-- Chống treo hệ thống:
--   - Chỉ ghi vài dòng ở 2 bảng cấu hình nhỏ, trong một giao dịch. Chờ khóa tối đa 5 giây (quá thì lỗi 1205).
--   - Gặp lỗi bất kỳ: chạy ROLLBACK; rồi đóng tab / kết nối (tệp dừng trước dòng trả biến phiên về cũ),
--     mở tab mới chạy lại.
--   - Không tắt sql_safe_updates: lệnh UPDATE lọc theo khóa chính document_type, INSERT không bị ảnh hưởng.
--   - Chạy nhiều lần vẫn được: mẫu đã chép thì không chép lại, đã chọn mẫu tại quầy thì không đặt lại,
--     hóa đơn đã về khổ tờ thì không đổi nữa.
--   - Không cần DELIMITER, chạy được trong MySQL Workbench và mysql CLI (MySQL 8).
--
-- Trước khi chạy thật: SAO LƯU 2 bảng cau_hinh_mau_in, mau_in_dang_ap_dung
-- (vd. mysqldump fashion_system <bảng> > bk_20261020_mau_in.sql) và sau LẦN CHẠY THẬT ĐẦU TIÊN, GHI LẠI cột
-- hoa_don_dang_dung_truoc ở kết quả (cần cho khối hoàn tác; chạy lại lần sau cột này đã là giá trị mới).
-- =====================================================================

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác
SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 thì chữ tiếng Việt ở kết quả bị lỗi mã

SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT

SET @cho_khoa_cu = @@SESSION.lock_wait_timeout;
SET @cho_khoa_dong_cu = @@SESSION.innodb_lock_wait_timeout;
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;

-- ---------------------------------------------------------------------
-- 4. Mẫu in hóa đơn tại quầy
-- ---------------------------------------------------------------------
SET @co_k80_cu = (SELECT COUNT(*) FROM cau_hinh_mau_in
  WHERE document_type = 'sales_invoice' AND template_id = 'sales_invoice_default_K80');
SET @co_k80_moi = (SELECT COUNT(*) FROM cau_hinh_mau_in
  WHERE document_type = 'pos_invoice' AND template_id = 'pos_invoice_default_K80');
SET @hd_dang_dung = (SELECT template_id FROM mau_in_dang_ap_dung WHERE document_type = 'sales_invoice');
SET @pos_dang_dung = (SELECT template_id FROM mau_in_dang_ap_dung WHERE document_type = 'pos_invoice');
-- Mẫu khổ tờ đã lưu SỚM NHẤT của hóa đơn (id nhỏ nhất – đúng mẫu frontend mới đang in khi mẫu áp dụng
-- còn là K80 cũ, xem resolveInUseTemplateId); chưa lưu thì dùng mẫu mặc định A4
SET @hd_kho_to = IFNULL((SELECT template_id FROM cau_hinh_mau_in
  WHERE document_type = 'sales_invoice' AND template_id IN ('sales_invoice_default_A4', 'sales_invoice_default_A5')
  ORDER BY id LIMIT 1), 'sales_invoice_default_A4');

START TRANSACTION;

INSERT INTO cau_hinh_mau_in (document_type, template_id, name, paper_size, orientation, margin, accent_color,
                             branding_json, sections_json, columns_json, version, ngay_cap_nhat, nguoi_cap_nhat_id)
SELECT 'pos_invoice', 'pos_invoice_default_K80', c.name, 'K80', 'portrait', c.margin, c.accent_color,
       c.branding_json, c.sections_json, c.columns_json, c.version, NOW(), c.nguoi_cap_nhat_id
FROM cau_hinh_mau_in c
WHERE @chay_that = 1 AND @co_k80_moi = 0
  AND c.document_type = 'sales_invoice' AND c.template_id = 'sales_invoice_default_K80';

-- Quầy đang in hóa đơn K80 -> pos_invoice dùng K80 (chưa có dòng áp dụng nào của pos_invoice)
INSERT INTO mau_in_dang_ap_dung (document_type, template_id, ngay_cap_nhat)
SELECT 'pos_invoice', 'pos_invoice_default_K80', NOW()
FROM DUAL
WHERE @chay_that = 1 AND @pos_dang_dung IS NULL AND @hd_dang_dung = 'sales_invoice_default_K80';

-- In từ trang đơn bán về khổ tờ
UPDATE mau_in_dang_ap_dung
SET template_id = @hd_kho_to, ngay_cap_nhat = NOW()
WHERE @chay_that = 1 AND document_type = 'sales_invoice' AND template_id = 'sales_invoice_default_K80';

COMMIT;

-- ---------------------------------------------------------------------
-- Kết quả
-- ---------------------------------------------------------------------
SELECT IF(@chay_that = 1, 'ĐÃ CHẠY THẬT', 'CHỈ XEM TRƯỚC — chưa đổi gì') AS che_do,
       IF(@co_k80_cu > 0 AND @co_k80_moi = 0, 'chép mẫu K80 đã chỉnh sang pos_invoice', 'không cần chép') AS mau_k80,
       IFNULL(@hd_dang_dung, '(chưa chọn — mặc định A4)') AS hoa_don_dang_dung_truoc,
       IF(@hd_dang_dung = 'sales_invoice_default_K80', @hd_kho_to, IFNULL(@hd_dang_dung, 'sales_invoice_default_A4')) AS hoa_don_dang_dung_sau,
       IFNULL(@pos_dang_dung, '(chưa chọn — mặc định K80)') AS tai_quay_dang_dung_truoc,
       IF(@pos_dang_dung IS NULL AND @hd_dang_dung = 'sales_invoice_default_K80', 'pos_invoice_default_K80',
          IFNULL(@pos_dang_dung, '(chưa chọn — mặc định K80)')) AS tai_quay_dang_dung_sau;

SELECT document_type, template_id FROM mau_in_dang_ap_dung
WHERE document_type IN ('sales_invoice', 'pos_invoice');

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;

-- ---------------------------------------------------------------------
-- Hoàn tác (chạy tay nếu cần, vd. trước khi trả frontend về bản cũ):
--   -- Trả mẫu hóa đơn đang áp dụng về giá trị trước khi chạy. CHỈ chạy khi cột hoa_don_dang_dung_truoc
--   -- đã ghi ở lần chạy thật đầu tiên là 'sales_invoice_default_K80' (giá trị khác thì tệp này không đổi
--   -- dòng sales_invoice):
--   UPDATE mau_in_dang_ap_dung SET template_id = 'sales_invoice_default_K80', ngay_cap_nhat = NOW()
--   WHERE document_type = 'sales_invoice';
--   -- Xóa MỌI mẫu tại quầy: cả mẫu tệp này chép sang lẫn mọi chỉnh sửa mẫu "Hóa đơn bán hàng tại quầy"
--   -- đã lưu trên frontend mới (từ B2, trước hay sau khi chạy tệp này). Cần giữ thì sao lưu trước:
--   DELETE FROM cau_hinh_mau_in WHERE document_type = 'pos_invoice';
--   DELETE FROM mau_in_dang_ap_dung WHERE document_type = 'pos_invoice';
-- ---------------------------------------------------------------------
