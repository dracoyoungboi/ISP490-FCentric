package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

/**
 * Một SKU trong hộp "In tem sản phẩm": đủ thông tin in lên tem (tên, màu, kích cỡ, mã vạch, giá) và để quyết định
 * bỏ qua (ngừng hoạt động, chưa có giá, thiếu mã vạch). Không có giá vốn.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DongInTemDto {
    Integer bienTheId;
    Integer sanPhamId;
    String tenSanPham;
    String maSku;
    String maVachSku;
    String tenMau;
    String maMauHex;
    String kichCo;
    Integer trangThai;
    BigDecimal giaBan;
    /** Giá trước lần đổi giá bán gần nhất trong 7 ngày qua; null nếu không đổi giá gần đây. */
    BigDecimal giaBanCu;
    /** Số tem theo phiếu nhập (số lượng thực nhận); null khi không lấy theo phiếu. */
    Integer soLuong;
}
