package com.dev.backend.dto.response.customize;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/**
 * DTO catalog POS (chỉ đọc) — một phần tử = một SKU đang bán được của kho được ủy quyền.
 * soLuongKhaDung là tổng (tồn - đã đặt) của SKU tại ĐÚNG kho truy vấn (SUM theo lô của kho đó),
 * không phải tồn toàn hệ thống. anhUrl đã chuẩn hóa qua PublicAssetUrl.toHttps; null hợp lệ
 * khi chưa có ảnh (client hiện ảnh rỗng, không fallback về dữ liệu mẫu).
 *
 * Constructor tường minh theo đúng thứ tự tham số của JPQL constructor expression
 * (convention TonKhoChiTietDTO) — không dùng constructor do Lombok sinh.
 */
@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PosCatalogItemDto {

    Integer bienTheSanPhamId;
    Integer sanPhamId;
    String tenSanPham;
    String maSku;
    String maVachSku;
    String tenMau;
    String maMauHex;
    String tenSize;
    String tenChatLieu;
    BigDecimal giaBan;
    BigDecimal soLuongKhaDung;
    Integer danhMucId;
    String danhMucTen;
    String anhUrl;

    public PosCatalogItemDto(
            Integer bienTheSanPhamId,
            Integer sanPhamId,
            String tenSanPham,
            String maSku,
            String maVachSku,
            String tenMau,
            String maMauHex,
            String tenSize,
            String tenChatLieu,
            BigDecimal giaBan,
            BigDecimal soLuongKhaDung,
            Integer danhMucId,
            String danhMucTen
    ) {
        this.bienTheSanPhamId = bienTheSanPhamId;
        this.sanPhamId = sanPhamId;
        this.tenSanPham = tenSanPham;
        this.maSku = maSku;
        this.maVachSku = maVachSku;
        this.tenMau = tenMau;
        this.maMauHex = maMauHex;
        this.tenSize = tenSize;
        this.tenChatLieu = tenChatLieu;
        this.giaBan = giaBan;
        this.soLuongKhaDung = soLuongKhaDung;
        this.danhMucId = danhMucId;
        this.danhMucTen = danhMucTen;
    }
}
