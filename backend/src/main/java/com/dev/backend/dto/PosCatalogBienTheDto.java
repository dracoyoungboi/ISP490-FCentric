package com.dev.backend.dto;

import java.math.BigDecimal;

/**
 * Một biến thể (SKU) trong danh mục POS dạng gộp theo mẫu + màu.
 * Vừa là dòng kết quả JPQL (constructor expression trong BienTheSanPhamRepository) vừa là phần tử
 * trả về cho màn POS. Tên trường JSON trùng PosCatalogItemDto (bienTheSanPhamId, tenSanPham, tenMau,
 * tenSize, maSku, giaBan, soLuongKhaDung, anhUrl...) để frontend dùng chung cách đọc một SKU;
 * thêm mauSacId, chatLieuId (khóa nhóm) và thuTuSize (thứ tự kích cỡ).
 */
public class PosCatalogBienTheDto {

    private final Integer bienTheSanPhamId;
    private final Integer sanPhamId;
    private final String tenSanPham;
    private final String maSku;
    private final String maVachSku;
    private final Integer mauSacId;
    private final String tenMau;
    private final String maMauHex;
    private final String tenSize;
    private final Integer thuTuSize;
    private final Integer chatLieuId;
    private final String tenChatLieu;
    private final BigDecimal giaBan;
    /**
     * Số bán được tại quầy của ĐÚNG kho đang bán (BanDuocTaiQuayService, cùng công thức với thanh toán); chưa có lô
     * nào -> 0. Truy vấn trả Σ theo lô max(0, tồn − đã đặt), service ghi đè cho các mã đang bị giữ.
     */
    private BigDecimal soLuongKhaDung;
    private final Integer danhMucId;
    private final String tenDanhMuc;
    private String anhUrl;

    public PosCatalogBienTheDto(Integer bienTheSanPhamId, Integer sanPhamId, String tenSanPham,
                                String maSku, String maVachSku,
                                Integer mauSacId, String tenMau, String maMauHex,
                                String tenSize, Integer thuTuSize,
                                Integer chatLieuId, String tenChatLieu,
                                BigDecimal giaBan, BigDecimal soLuongKhaDung,
                                Integer danhMucId, String tenDanhMuc) {
        this.bienTheSanPhamId = bienTheSanPhamId;
        this.sanPhamId = sanPhamId;
        this.tenSanPham = tenSanPham;
        this.maSku = maSku;
        this.maVachSku = maVachSku;
        this.mauSacId = mauSacId;
        this.tenMau = tenMau;
        this.maMauHex = maMauHex;
        this.tenSize = tenSize;
        this.thuTuSize = thuTuSize;
        this.chatLieuId = chatLieuId;
        this.tenChatLieu = tenChatLieu;
        this.giaBan = giaBan;
        this.soLuongKhaDung = soLuongKhaDung;
        this.danhMucId = danhMucId;
        this.tenDanhMuc = tenDanhMuc;
    }

    public Integer getBienTheSanPhamId() { return bienTheSanPhamId; }
    public Integer getSanPhamId() { return sanPhamId; }
    public String getTenSanPham() { return tenSanPham; }
    public String getMaSku() { return maSku; }
    public String getMaVachSku() { return maVachSku; }
    public Integer getMauSacId() { return mauSacId; }
    public String getTenMau() { return tenMau; }
    public String getMaMauHex() { return maMauHex; }
    public String getTenSize() { return tenSize; }
    public Integer getThuTuSize() { return thuTuSize; }
    public Integer getChatLieuId() { return chatLieuId; }
    public String getTenChatLieu() { return tenChatLieu; }
    public BigDecimal getGiaBan() { return giaBan; }
    public BigDecimal getSoLuongKhaDung() { return soLuongKhaDung; }
    public Integer getDanhMucId() { return danhMucId; }
    public String getTenDanhMuc() { return tenDanhMuc; }
    public String getAnhUrl() { return anhUrl; }

    public void setAnhUrl(String anhUrl) { this.anhUrl = anhUrl; }
    public void setSoLuongKhaDung(BigDecimal soLuongKhaDung) { this.soLuongKhaDung = soLuongKhaDung; }
}
