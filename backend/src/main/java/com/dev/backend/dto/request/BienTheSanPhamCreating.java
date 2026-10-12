package com.dev.backend.dto.request;

import com.dev.backend.entities.BienTheSanPham;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.Objects;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class BienTheSanPhamCreating {
    Integer mauSacId;
    Integer sizeId;
    Integer chatLieuId;
    String maSku;
    String maVachSku;
    BigDecimal giaVon;
    BigDecimal giaBan;
    Integer trangThai;
    // Chỉ số tệp trong phần anhBienThes của request. Các biến thể cùng màu trỏ cùng một chỉ số
    // để dùng chung một tệp ảnh. null = cách cũ: tệp thứ i ứng với biến thể thứ i.
    Integer viTriAnh;

    public static BienTheSanPham toEntity(BienTheSanPhamCreating creating) {
        return BienTheSanPham.builder()
                .maVachSku(creating.getMaVachSku())
                .maSku(creating.getMaSku())
                .giaVon(creating.getGiaVon())
                .giaBan(creating.getGiaBan())
                .trangThai(creating.getTrangThai())
                .build();
    }


    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BienTheSanPhamCreating that = (BienTheSanPhamCreating) o;
        return Objects.equals(mauSacId, that.mauSacId) &&
                Objects.equals(sizeId, that.sizeId) &&
                Objects.equals(chatLieuId, that.chatLieuId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(mauSacId, sizeId, chatLieuId);
    }
}
