package com.dev.backend.dto.response.entities;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTO for {@link com.dev.backend.entities.BienTheSanPham}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class BienTheSanPhamDto implements Serializable {
    Integer id;
    // Tên ghép: "TênSảnPhẩm - TênMàu / TênSize" — dùng cho kiểm kê và các màn hình cần hiển thị nhanh
    String tenBienThe;
    MauSacDto mauSac;
    SizeDto size;
    ChatLieuDto chatLieu;
    String maSku;
    String maVachSku;
    BigDecimal giaVon;
    BigDecimal giaBan;
    Integer trangThai;
    Instant ngayTao;
    Instant ngayCapNhat;
    AnhBienTheDto anhBienThe;
    String tenSanPham;
    // true = đã có lô/tồn kho, chứng từ hoặc đồng bộ sàn -> không được đổi màu/size.
    // Chỉ được set ở API chi tiết sản phẩm (getDetail); các API khác để null.
    Boolean daPhatSinhGiaoDich;
}