package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LienKetSanPhamDto {
    Integer id;
    String skuSan;
    String tenSanPhamSan;
    String tenBienTheSan;
    BigDecimal giaBanSan;
    Integer bienTheSanPhamId;
    /** Sản phẩm FCentric của biến thể (chỉ đọc, để giao diện gom các SKU cùng sản phẩm). */
    Integer sanPhamId;
    /** Đường dẫn ảnh đại diện của sản phẩm (ảnh chính, không có thì ảnh đầu); null nếu chưa có ảnh. */
    String anhDaiDien;
    String maSku;
    String tenSanPham;
    String tenBienThe;
    BigDecimal giaBan;
    BigDecimal soLuongKhaDung;
    BigDecimal soLuongDaDay;
    Boolean choPhepDongBo;
    String trangThaiLienKet; // "da_lien_ket", "chua_lien_ket", "that_bai"
    Instant ngayDongBoCuoi;
    String chiTietLoi;
}

