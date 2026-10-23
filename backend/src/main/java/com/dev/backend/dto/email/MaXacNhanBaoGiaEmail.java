package com.dev.backend.dto.email;

/** E5 · Mã xác nhận báo giá. {@link #toString()} che mã. */
public record MaXacNhanBaoGiaEmail(String tenNhaCungCap, String maDon, String ma, String hetHanLuc,
                                   String thoiHan) {
    @Override
    public String toString() {
        return "MaXacNhanBaoGiaEmail[maDon=" + maDon + ", ma=***]";
    }
}
