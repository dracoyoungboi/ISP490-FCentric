# Bật POS (bán hàng tại quầy) trên môi trường dev

POS đã bật sẵn cho dev sau khi merge nhánh này. Production vẫn **tắt** cho đến khi nghiệm thu.

## 1. Chạy migration một lần trên DB dev

`application.properties` đang trỏ dev vào DB dùng chung, nên **chỉ một người** chạy là đủ. Nhớ backup trước.

```bash
mysql -h <host> -u <user> -p --default-character-set=utf8mb4 fashion_system < Database/pos_checkout_v1.sql
```

Script chạy lại nhiều lần vẫn an toàn. Nó làm 3 việc:

- Tạo 2 bảng `pos_checkout_request` và `pos_payment`.
- Cập nhật comment trạng thái.
- Seed khách lẻ `KHLE`.

Kiểm tra lại:

```sql
SHOW TABLES LIKE 'pos_%';                                   -- 2 bảng
SELECT id, ten_khach_hang, trang_thai FROM khach_hang WHERE ma_khach_hang = 'KHLE';  -- 1 dòng, trang_thai = 1
```

## 2. Tài khoản thu ngân

| Việc | Yêu cầu |
|---|---|
| Xem catalog, quét mã | `quan_tri_vien`, `quan_ly_kho`, `nhan_vien_kho`, `nhan_vien_ban_hang` |
| Thanh toán | Chỉ `quan_tri_vien` hoặc `nhan_vien_ban_hang` |
| Kho | Người không phải admin phải được phân quyền kho (`phan_quyen_nguoi_dung_kho`, trạng thái 1) |
| Hàng | Kho đó phải có tồn khả dụng > 0 |

## 3. Chạy

```bash
# backend
cd backend && ./mvnw spring-boot:run      # pos.checkout-enabled mặc định = true

# frontend
cd frontend && npm run dev                # chế độ dev: nút thanh toán bật sẵn
```

Vào menu **Bán hàng tại quầy** (`/pos`) và kiểm tra theo các bước sau:

1. Chọn kho rồi bấm vào sản phẩm.
2. Bấm F9, nhập số tiền khách đưa rồi **Xác nhận thanh toán**.
3. Kiểm tra kết quả:
    - Đơn bán hàng có trạng thái **Hoàn thành**.
    - Tồn kho giảm.
    - **Lịch sử giao dịch kho** có thêm một dòng xuất.

## 4. Tắt khi cần

- **Backend:** đặt biến môi trường `POS_CHECKOUT_ENABLED=false`. API sẽ trả 503.
- **Frontend:** chạy dev với biến `VITE_POS_CHECKOUT=false`.

## 5. Production (chưa bật)

Production được khóa ở 3 lớp:

- **Frontend:** bản `npm run build` tắt nút thanh toán, trừ khi build với `VITE_POS_CHECKOUT=true`.
- **Backend chạy bằng docker-compose:** compose đặt `SPRING_PROFILES_ACTIVE=prod`, nên `application-prod.properties` ghi đè cờ thành `false`.
- **Config production bên ngoài:** `production/Fashion-Management/application.properties` cũng đặt `pos.checkout-enabled=false`.

Khi muốn bật production:

1. Chạy migration lên DB production.
2. Đặt biến môi trường `POS_CHECKOUT_ENABLED=true` cho backend, và đổi dòng `pos.checkout-enabled` trong config production.
3. Build frontend với `VITE_POS_CHECKOUT=true`.
