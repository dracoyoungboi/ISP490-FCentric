package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class SanPhamQuanAoUpdating {

    Integer id;
    String maSanPham;
    String tenSanPham;
    Integer danhMucId;
    Integer thuongHieuId;
    String moTa;
    String maVach;
    BigDecimal giaVonMacDinh;
    BigDecimal giaBanMacDinh;
    Integer mucTonToiThieu;
    Integer trangThai;
    boolean isImageUpdated;
    // Thứ tự ảnh sản phẩm sau khi sửa (ảnh giữ lại + ảnh mới), ô đầu là ảnh chính. Chỉ dùng khi isImageUpdated.
    // null = cách gửi cũ: thay toàn bộ ảnh bằng các tệp trong anhSanPhams.
    List<AnhSanPhamSapXep> anhSanPhamSapXep;
    // true = áp dụng thay đổi thương hiệu (null thuongHieuId = gỡ liên kết); false = giữ nguyên
    boolean capNhatThuongHieu;
    List<BienTheSanPhamUpdating> bienTheSanPhams;
}
