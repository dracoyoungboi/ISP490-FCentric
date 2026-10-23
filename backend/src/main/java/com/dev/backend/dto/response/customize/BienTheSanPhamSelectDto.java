package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class BienTheSanPhamSelectDto {
    private Integer id;
    private String maBienThe;
    private String tenSanPham;
    private BigDecimal giaBan;
    String tenMau;
    // Mã màu hex (#RRGGBB) để màn tạo chứng từ vẽ chấm màu như bảng chi tiết
    String maMauHex;
    String tenSize;
    String tenChatLieu;
    // Mã vạch in trên tem (quét ở màn tạo phiếu) và id sản phẩm (gom biến thể theo sản phẩm)
    String maVachSku;
    Integer sanPhamId;
}
