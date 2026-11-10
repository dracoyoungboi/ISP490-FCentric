-- =====================================================================
-- Quyền "Lập đợt kiểm kê" (tao_dot_kiem_ke) – 2026-11-10
--
-- Đặc tả BA Kiểm kê khoanh vùng, mục 3: "Tạo / sửa nháp, xem trước phạm vi" do Quản lý kho hoặc Nhân viên được cấp
-- quyền tạo. Quản trị viên và quản lý kho lập đợt sẵn, không cần quyền này; nhân viên kho cần được cấp quyền tại từng
-- kho ở ngăn Phân quyền (Người dùng → Phân quyền). Quyền KHÔNG thêm vào mẫu quyền của vai trò: mặc định chưa ai có.
-- Không nhạy cảm (nhay_cam = 0): chỉ lập nháp; bắt đầu, khóa kệ và phê duyệt vẫn là việc của quản lý kho.
--
-- THỨ TỰ KHI TRIỂN KHAI: tệp này → backend mới → frontend mới. Chạy trước backend cũng không sao (backend cũ không đọc
-- quyền này). Chạy lại nhiều lần được: đã có quyền thì chỉ cập nhật tên, mô tả.
-- Cách chạy: mysql --default-character-set=utf8mb4 fashion_system < tệp này
-- =====================================================================

SET NAMES utf8mb4;
USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

-- Không ghi cột nhay_cam (do backend tự thêm lúc khởi động, mặc định 0): tệp chạy được cả trên CSDL chưa có cột đó.
INSERT INTO quyen_han (ma_quyen, ten_quyen, mo_ta, nhom_quyen, ngay_tao)
VALUES ('tao_dot_kiem_ke', 'Lập đợt kiểm kê',
        'Lập và sửa đợt kiểm kê nháp do mình tạo; quản lý kho của kho bắt đầu đợt', 'quan_ly_kho', NOW())
ON DUPLICATE KEY UPDATE
    ten_quyen = VALUES(ten_quyen),
    mo_ta = VALUES(mo_ta),
    nhom_quyen = VALUES(nhom_quyen);

-- Đối chiếu (chỉ đọc)
SELECT id, ma_quyen, ten_quyen, nhom_quyen FROM quyen_han WHERE ma_quyen = 'tao_dot_kiem_ke';
