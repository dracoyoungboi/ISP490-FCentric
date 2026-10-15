package com.dev.backend.dto.response.entities;

import com.dev.backend.dto.response.customize.PhanBoLoDto;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class ChiTietNhatHangDto implements Serializable {
    Integer id;
    Integer bienTheSanPhamId;
    String maSku;
    String maVachSku;
    String viTriKho;
    String tenSanPham;
    String tenMau;
    String maMauHex;
    String tenSize;
    String tenChatLieu;
    String anhBienTheUrl;
    BigDecimal soLuongCanNhat;
    BigDecimal soLuongDaQuet;
    /** Lô đang phân bổ cho dòng, sắp FIFO (tổng = soLuongDaPhanBo). */
    List<PhanBoLoDto> phanBoLo;
    BigDecimal soLuongDaPhanBo;
    /** true khi người nhặt / quản lý đã sửa tay; false khi đang là phân bổ FIFO hệ thống gợi ý. */
    Boolean phanBoThuCong;
}

