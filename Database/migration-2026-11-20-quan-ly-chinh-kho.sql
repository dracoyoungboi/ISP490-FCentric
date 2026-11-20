-- =====================================================================
-- Người quản lý chính của kho lấy từ phân quyền – 2026-11-20
--
-- Trước đây "Người quản lý" của kho lưu ở cột kho.quan_ly_id, chọn tự do trên form kho, không khớp với phân quyền:
-- một người đứng tên nhiều kho (quanlykho1 ở Cửa hàng Hà Nội và Cửa hàng Nghệ An), kho ảo Kho Trung Chuyển có người
-- quản lý, người hết hạn phân quyền vẫn đứng tên. Từ bản này:
--   - Người quản lý chính = quản lý kho có dấu la_quan_ly_kho = 1 trên dòng phân quyền CỦA CHÍNH KHO ĐÓ, phân quyền
--     còn hiệu lực, tài khoản đang hoạt động. Máy chủ tính lúc đọc (Kho.quanLy), không còn đọc hay ghi kho.quan_ly_id.
--   - Mỗi người tối đa một kho đang giữ chỗ (đúng SRS), nên không thể đứng tên hai kho.
--
-- Tệp này:
--   1. Thu hồi phân quyền thừa của người đang giữ chỗ ở nhiều kho (dữ liệu cũ từ trước khi có quy tắc một kho):
--      giữ kho người đó đang làm hôm nay (đã tới ngày bắt đầu), nhiều kho như vậy thì giữ dòng cấp sớm nhất (id nhỏ nhất,
--      như danh sách Người dùng). Dump 19/11: nhanvienmuahang2 mất KHO02, giữ KHO01.
--   2. Đặt lại dấu: bỏ hết dấu cũ (bản cũ gắn dấu cho mọi quản lý kho), rồi gắn dấu cho người đang đứng tên trên kho
--      nếu người đó hợp lệ (vai trò quản lý kho, đang hoạt động, có phân quyền hiệu lực ở chính kho đó, không phải kho
--      ảo). Dump 19/11: gắn quanlykho1 (KHO01), quanlykho2 (KHO02), quanlykhotong (KHO_TONG); Cửa hàng Nghệ An và
--      Kho Trung Chuyển thành "Chưa có quản lý".
--   3. Ghi lịch sử kho cho kho đổi người quản lý.
-- Cột kho.quan_ly_id giữ nguyên (để quay lại bản cũ được), chỉ thêm chú thích "ngừng dùng".
--
-- THỨ TỰ KHI TRIỂN KHAI: dừng backend cũ -> chạy tệp này -> chạy backend mới -> frontend mới.
--   Backend cũ còn chạy thì mỗi lần lưu phân quyền lại gắn dấu cho mọi quản lý kho.
-- Chạy lại được: bước 2 và 3 chỉ chạy lần đầu (nhận biết qua chú thích của cột kho.quan_ly_id), để lần chạy sau
--   không đè người quản lý chính quản trị viên đã chọn trên bản mới. Bước 1 chạy lại chỉ còn dọn dữ liệu nhiều kho mới
--   phát sinh (nếu có). Chạy lỗi giữa chừng thì sửa nguyên nhân rồi chạy lại cả tệp.
-- Lần thu hồi ở bước 1 không ghi vào "Lịch sử phân quyền" của người dùng (chạy bằng SQL, không qua máy chủ).
-- Cách chạy: mysql --default-character-set=utf8mb4 fashion_system < tệp này
--            hoặc mở trong MySQL Workbench rồi chạy cả tệp (tệp tự tắt "safe update" trong phiên).
-- =====================================================================

SET NAMES utf8mb4;
USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

-- Phân quyền đang giữ chỗ (hoạt động, chưa hết hạn), đánh số theo người: dòng số 1 được giữ — ưu tiên dòng đã tới ngày
-- bắt đầu (kho người đó đang làm hôm nay), rồi dòng cấp sớm nhất (id nhỏ, như danh sách Người dùng). Các dòng còn lại bị thu hồi.
DROP TEMPORARY TABLE IF EXISTS pq_giu_cho;
CREATE TEMPORARY TABLE pq_giu_cho AS
SELECT pq.id, pq.nguoi_dung_id, pq.kho_id,
       ROW_NUMBER() OVER (PARTITION BY pq.nguoi_dung_id
                          ORDER BY (pq.ngay_bat_dau IS NOT NULL AND pq.ngay_bat_dau > NOW()), pq.id) AS thu_tu,
       COUNT(*) OVER (PARTITION BY pq.nguoi_dung_id) AS so_kho
FROM phan_quyen_nguoi_dung_kho pq
WHERE pq.trang_thai = 1 AND (pq.ngay_ket_thuc IS NULL OR pq.ngay_ket_thuc > NOW());

-- Xem trước (chỉ đọc) 1: người đang giữ chỗ ở nhiều kho, dòng nào sẽ bị thu hồi
SELECT nd.ten_dang_nhap, nd.vai_tro, k.ma_kho, g.id AS phan_quyen_id,
       IF(g.thu_tu = 1, 'giữ', 'THU HỒI') AS xu_ly
FROM pq_giu_cho g
JOIN nguoi_dung nd ON nd.id = g.nguoi_dung_id
JOIN kho k ON k.id = g.kho_id
WHERE g.so_kho > 1
ORDER BY nd.id, g.thu_tu;

-- Xem trước (chỉ đọc) 2: người đứng tên trên kho hiện nay và có còn hợp lệ không, tính cả phần thu hồi ở bước 1
--   (chỉ có nghĩa ở lần chạy đầu; sau đó cột kho.quan_ly_id ngừng dùng, xem "Đối chiếu 1" ở cuối tệp)
SELECT k.ma_kho, k.ten_kho, nd.ten_dang_nhap AS dang_dung_ten,
       CASE
           WHEN nd.id IS NULL THEN '(trống)'
           WHEN k.ma_kho = 'KHO_TRANSIT' THEN 'BỎ: kho ảo'
           WHEN nd.vai_tro <> 'quan_ly_kho' THEN 'BỎ: không phải quản lý kho'
           WHEN nd.trang_thai <> 1 THEN 'BỎ: tài khoản bị khóa'
           WHEN NOT EXISTS (SELECT 1 FROM pq_giu_cho g
                            WHERE g.nguoi_dung_id = nd.id AND g.kho_id = k.id AND g.thu_tu = 1)
               THEN 'BỎ: không làm việc ở kho này'
           ELSE 'giữ'
       END AS xu_ly
FROM kho k
LEFT JOIN nguoi_dung nd ON nd.id = k.quan_ly_id
ORDER BY k.id;

-- MySQL Workbench mặc định bật "safe update", chặn UPDATE nối bảng dưới đây (lỗi 1175).
-- Tắt riêng trong phiên này, cuối tệp bật lại như cũ.
SET @safe_updates_cu = @@SESSION.sql_safe_updates;
SET SESSION sql_safe_updates = 0;

-- 1. Thu hồi phân quyền thừa (giữ dòng để còn dấu vết), cùng các quyền chi tiết đang bật của dòng đó
DROP TEMPORARY TABLE IF EXISTS pq_thua;
CREATE TEMPORARY TABLE pq_thua AS
SELECT id FROM pq_giu_cho WHERE thu_tu > 1;

UPDATE phan_quyen_nguoi_dung_kho pq
JOIN pq_thua t ON t.id = pq.id
SET pq.trang_thai = 0, pq.la_quan_ly_kho = 0, pq.ngay_ket_thuc = NOW();

UPDATE chi_tiet_quyen_kho ct
JOIN pq_thua t ON t.id = ct.phan_quyen_nguoi_dung_kho_id
SET ct.trang_thai = 0
WHERE ct.trang_thai = 1;

DROP TEMPORARY TABLE IF EXISTS pq_thua;
DROP TEMPORARY TABLE IF EXISTS pq_giu_cho;

-- 2 + 3. Chỉ chạy lần đầu
DROP PROCEDURE IF EXISTS dat_quan_ly_chinh_kho;
DELIMITER //
CREATE PROCEDURE dat_quan_ly_chinh_kho()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = DATABASE() AND table_name = 'kho' AND column_name = 'quan_ly_id'
                     AND column_comment LIKE 'NGỪNG DÙNG%') THEN

        -- Người quản lý đang hiện trên màn Kho trước khi đổi (để ghi lịch sử)
        DROP TEMPORARY TABLE IF EXISTS kho_truoc;
        CREATE TEMPORARY TABLE kho_truoc AS
        SELECT k.id, k.ma_kho, nd.ho_ten AS quan_ly
        FROM kho k LEFT JOIN nguoi_dung nd ON nd.id = k.quan_ly_id;

        -- 2a. Bỏ hết dấu cũ
        UPDATE phan_quyen_nguoi_dung_kho SET la_quan_ly_kho = 0 WHERE la_quan_ly_kho IS NULL OR la_quan_ly_kho <> 0;

        -- 2b. Gắn dấu cho người đứng tên hợp lệ. Phân quyền hẹn ngày bắt đầu ở tương lai vẫn gắn: máy chủ chỉ hiện người
        --     quản lý từ ngày bắt đầu (Kho.quanLy), không phải chọn lại.
        UPDATE phan_quyen_nguoi_dung_kho pq
        JOIN kho k ON k.id = pq.kho_id AND k.quan_ly_id = pq.nguoi_dung_id
        JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
        SET pq.la_quan_ly_kho = 1
        WHERE k.ma_kho <> 'KHO_TRANSIT'
          AND nd.vai_tro = 'quan_ly_kho' AND nd.trang_thai = 1
          AND pq.trang_thai = 1
          AND (pq.ngay_ket_thuc IS NULL OR pq.ngay_ket_thuc > NOW());

        -- 3. Lịch sử kho (cùng dạng máy chủ ghi khi sửa kho: khóa "quanLy" là họ tên)
        INSERT INTO lich_su_thay_doi (loai_tham_chieu, id_tham_chieu, ma_doi_tuong, kho_id, hanh_dong,
                                      gia_tri_cu, gia_tri_moi, nguoi_thuc_hien_id, nguon, ngay_thuc_hien, ghi_chu)
        SELECT 'kho', t.id, t.ma_kho, t.id, 'sua_kho',
               JSON_OBJECT('quanLy', t.quan_ly), JSON_OBJECT('quanLy', moi.ho_ten),
               NULL, 'he_thong', NOW(),
               'Người quản lý lấy theo phân quyền: chỉ quản lý kho đang làm việc tại kho này mới đứng tên'
        FROM kho_truoc t
        LEFT JOIN (SELECT pq.kho_id, MIN(nd.ho_ten) AS ho_ten
                   FROM phan_quyen_nguoi_dung_kho pq
                   JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
                   WHERE pq.la_quan_ly_kho = 1
                   GROUP BY pq.kho_id) moi ON moi.kho_id = t.id
        WHERE NOT (t.quan_ly <=> moi.ho_ten);

        DROP TEMPORARY TABLE IF EXISTS kho_truoc;

        ALTER TABLE kho MODIFY quan_ly_id INT NULL
            COMMENT 'NGỪNG DÙNG từ 2026-11-20: người quản lý chính là dấu la_quan_ly_kho trên phan_quyen_nguoi_dung_kho';
    END IF;
END //
DELIMITER ;
CALL dat_quan_ly_chinh_kho();
DROP PROCEDURE IF EXISTS dat_quan_ly_chinh_kho;

SET SESSION sql_safe_updates = @safe_updates_cu;

-- Đối chiếu (chỉ đọc) 1: người quản lý chính của từng kho theo cách máy chủ mới tính
SELECT k.ma_kho, k.ten_kho,
       (SELECT nd.ten_dang_nhap FROM phan_quyen_nguoi_dung_kho pq JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
        WHERE pq.kho_id = k.id AND pq.la_quan_ly_kho = 1 AND pq.trang_thai = 1
          AND (pq.ngay_bat_dau IS NULL OR pq.ngay_bat_dau <= NOW())
          AND (pq.ngay_ket_thuc IS NULL OR pq.ngay_ket_thuc > NOW())
          AND nd.trang_thai = 1 AND nd.vai_tro = 'quan_ly_kho'
        ORDER BY pq.id LIMIT 1) AS quan_ly_chinh
FROM kho k ORDER BY k.id;

-- Đối chiếu (chỉ đọc) 2: phải ra 0 — người còn giữ chỗ ở nhiều kho
SELECT COUNT(*) AS nguoi_nhieu_kho FROM (
    SELECT nguoi_dung_id FROM phan_quyen_nguoi_dung_kho
    WHERE trang_thai = 1 AND (ngay_ket_thuc IS NULL OR ngay_ket_thuc > NOW())
    GROUP BY nguoi_dung_id HAVING COUNT(*) > 1) x;

-- Đối chiếu (chỉ đọc) 3: phải ra 0 — kho có nhiều hơn một dấu người quản lý chính
SELECT COUNT(*) AS kho_nhieu_dau FROM (
    SELECT kho_id FROM phan_quyen_nguoi_dung_kho WHERE la_quan_ly_kho = 1
    GROUP BY kho_id HAVING COUNT(*) > 1) x;
