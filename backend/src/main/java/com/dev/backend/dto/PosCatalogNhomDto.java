package com.dev.backend.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Một dòng của danh mục POS dạng gộp: mọi kích cỡ của cùng một mẫu + màu + chất liệu.
 * Khóa nhóm = sanPhamId-mauSacId-chatLieuId (sản phẩm cũ có thể có nhiều chất liệu).
 * bienThes xếp theo thứ tự kích cỡ (size.thu_tu_sap_xep). Giá bán đặt theo từng biến thể nên
 * nhóm trả cả giá thấp nhất và cao nhất; tongTonKhaDung chỉ cộng phần tồn dương.
 */
public class PosCatalogNhomDto {

    private String khoaNhom;
    private Integer sanPhamId;
    private String tenSanPham;
    private Integer mauSacId;
    private String tenMau;
    private String maMauHex;
    private Integer chatLieuId;
    private String tenChatLieu;
    private Integer danhMucId;
    private String tenDanhMuc;
    private String anhUrl;
    private BigDecimal giaThapNhat;
    private BigDecimal giaCaoNhat;
    private BigDecimal tongTonKhaDung;
    private List<PosCatalogBienTheDto> bienThes;

    public String getKhoaNhom() { return khoaNhom; }
    public void setKhoaNhom(String khoaNhom) { this.khoaNhom = khoaNhom; }

    public Integer getSanPhamId() { return sanPhamId; }
    public void setSanPhamId(Integer sanPhamId) { this.sanPhamId = sanPhamId; }

    public String getTenSanPham() { return tenSanPham; }
    public void setTenSanPham(String tenSanPham) { this.tenSanPham = tenSanPham; }

    public Integer getMauSacId() { return mauSacId; }
    public void setMauSacId(Integer mauSacId) { this.mauSacId = mauSacId; }

    public String getTenMau() { return tenMau; }
    public void setTenMau(String tenMau) { this.tenMau = tenMau; }

    public String getMaMauHex() { return maMauHex; }
    public void setMaMauHex(String maMauHex) { this.maMauHex = maMauHex; }

    public Integer getChatLieuId() { return chatLieuId; }
    public void setChatLieuId(Integer chatLieuId) { this.chatLieuId = chatLieuId; }

    public String getTenChatLieu() { return tenChatLieu; }
    public void setTenChatLieu(String tenChatLieu) { this.tenChatLieu = tenChatLieu; }

    public Integer getDanhMucId() { return danhMucId; }
    public void setDanhMucId(Integer danhMucId) { this.danhMucId = danhMucId; }

    public String getTenDanhMuc() { return tenDanhMuc; }
    public void setTenDanhMuc(String tenDanhMuc) { this.tenDanhMuc = tenDanhMuc; }

    public String getAnhUrl() { return anhUrl; }
    public void setAnhUrl(String anhUrl) { this.anhUrl = anhUrl; }

    public BigDecimal getGiaThapNhat() { return giaThapNhat; }
    public void setGiaThapNhat(BigDecimal giaThapNhat) { this.giaThapNhat = giaThapNhat; }

    public BigDecimal getGiaCaoNhat() { return giaCaoNhat; }
    public void setGiaCaoNhat(BigDecimal giaCaoNhat) { this.giaCaoNhat = giaCaoNhat; }

    public BigDecimal getTongTonKhaDung() { return tongTonKhaDung; }
    public void setTongTonKhaDung(BigDecimal tongTonKhaDung) { this.tongTonKhaDung = tongTonKhaDung; }

    public List<PosCatalogBienTheDto> getBienThes() { return bienThes; }
    public void setBienThes(List<PosCatalogBienTheDto> bienThes) { this.bienThes = bienThes; }
}
