package com.dev.backend.utils;

import com.dev.backend.entities.AnhBienThe;
import com.dev.backend.entities.BienTheSanPham;

/**
 * Đọc an toàn (null-safe) các thông tin hiển thị của một biến thể cho bảng hàng của chứng từ:
 * tên sản phẩm, id sản phẩm (gom nhóm), tên màu, mã màu hex (chấm màu), kích cỡ, đường dẫn ảnh.
 * Dùng chung để mọi DTO dòng hàng trả cùng một bộ trường, màn hình vẽ giống nhau.
 */
public final class HienThiBienThe {
    private HienThiBienThe() {
    }

    public static String tenSanPham(BienTheSanPham bt) {
        return bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null;
    }

    public static Integer sanPhamId(BienTheSanPham bt) {
        return bt != null && bt.getSanPham() != null ? bt.getSanPham().getId() : null;
    }

    public static String tenMau(BienTheSanPham bt) {
        return bt != null && bt.getMauSac() != null ? bt.getMauSac().getTenMau() : null;
    }

    public static String maMauHex(BienTheSanPham bt) {
        return bt != null && bt.getMauSac() != null ? bt.getMauSac().getMaMauHex() : null;
    }

    public static String kichCo(BienTheSanPham bt) {
        return bt != null && bt.getSize() != null ? bt.getSize().getTenSize() : null;
    }

    public static String anh(BienTheSanPham bt) {
        if (bt == null) return null;
        AnhBienThe anh = bt.getAnhBienThe();
        // Đường dẫn MinIO lưu trong CSDL là http theo IP: đổi sang tên miền https như mọi chỗ trả ảnh khác
        return anh != null && anh.getTepTin() != null ? PublicAssetUrl.toHttps(anh.getTepTin().getDuongDan()) : null;
    }
}
