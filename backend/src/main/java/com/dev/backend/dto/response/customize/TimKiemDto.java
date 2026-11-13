package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Kết quả ô tìm kiếm toàn hệ thống (GET /api/v1/tim-kiem). Mỗi nhóm (sản phẩm, đơn bán, khách hàng, nhà cung cấp,
 * chứng từ) chỉ có khi người dùng được vào trang danh sách tương ứng. Nhãn trạng thái và câu hiển thị do giao diện dịch.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TimKiemDto {

    List<Nhom> nhom;

    /** Một nhóm kết quả. {@code trangThai}: "xong" hoặc "loi" (nhóm này lỗi, các nhóm khác vẫn trả). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Nhom {
        String key;
        String trangThai;
        long tong;
        List<Muc> muc;
    }

    /**
     * Một dòng kết quả. {@code loai}: sanPham | donBan | khachHang | nhaCungCap | chungTu; với chứng từ thì
     * {@code loaiChungTu}: phieuXuat | phieuNhap | phieuChuyen | donMua | yeuCauNhap | kiemKe | baoGia.
     * {@code truongKhop}: trường mã đã khớp (sku, maVachSku, maVach, maVachNcc, maSanPham, maDonSan, sdt, maSoThue,
     * email, ma) để giao diện ghi "Khớp SKU …"; khớp theo tên thì để trống.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Muc {
        String loai;
        String loaiChungTu;
        Integer id;
        String ma;
        String ten;
        String phu;
        Object trangThai;
        BigDecimal giaTri;
        Instant ngay;
        String anh;
        String kenh;
        String khach;
        String soDienThoai;
        String maDonSan;
        boolean khopChinhXac;
        String truongKhop;
        String giaTriKhop;
        String bienThe;
        Boolean tuChoi;
        Boolean coChenhLech;
        String khoXuat;
        String khoNhap;
    }
}
