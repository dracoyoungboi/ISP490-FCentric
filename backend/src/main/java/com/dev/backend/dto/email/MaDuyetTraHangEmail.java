package com.dev.backend.dto.email;

/**
 * E6 · Mã duyệt trả hàng quá hạn. {@link #toString()} che mã.
 *
 * @param soNgay số ngày từ lúc thanh toán đơn gốc tới lúc yêu cầu (đã quá 3)
 */
public record MaDuyetTraHangEmail(String hoTen, String tenCuaHang, String nguoiYeuCau, String soDonHang,
                                  String ngayThanhToan, long soNgay, String lyDo, String ma, String hetHanLuc,
                                  String thoiHan) {
    @Override
    public String toString() {
        return "MaDuyetTraHangEmail[soDonHang=" + soDonHang + ", ma=***]";
    }
}
