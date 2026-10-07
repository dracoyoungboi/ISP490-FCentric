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

- **Backend:** đặt biến môi trường `POS_CHECKOUT_ENABLED=false` rồi chạy lại. API thanh toán sẽ trả 503.
- **Frontend:** chạy hoặc build với biến `VITE_POS_CHECKOUT=false`.

## 5. Production

POS **bật sẵn** ở cả localhost và bản deploy, không cần đặt thêm biến nào. Khi deploy lần đầu:

1. Chạy `pos_checkout_v1.sql` và `payos_v1.sql` lên **DB production**.
2. Nên đặt biến môi trường `PAYMENT_CONFIG_SECRET` (chuỗi dài, bí mật, không đổi về sau) để mã hóa khóa payOS. Chưa đặt thì hệ thống tạm dùng JWT signer key.
3. Frontend tự gọi API cùng tên miền với trang web (`https://fcentric.net/api/...`), không cần sửa `.env`.
