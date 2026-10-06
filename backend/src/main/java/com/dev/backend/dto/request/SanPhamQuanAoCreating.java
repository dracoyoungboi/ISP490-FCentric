package com.dev.backend.dto.request;

import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.exception.customize.CommonException;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.apache.commons.lang3.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class SanPhamQuanAoCreating {

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
    List<BienTheSanPhamCreating> bienTheSanPhams;

    public static SanPhamQuanAo toEntity(SanPhamQuanAoCreating creating) {
        return SanPhamQuanAo.builder()
                .maSanPham(creating.getMaSanPham() == null ? genMaSanPham(creating.getTenSanPham()) : creating.getMaSanPham())
                .tenSanPham(creating.getTenSanPham())
                .moTa(creating.getMoTa())
                .maVach(creating.getMaVach())
                .giaVonMacDinh(creating.getGiaVonMacDinh())
                .giaBanMacDinh(creating.getGiaBanMacDinh())
                .mucTonToiThieu(creating.getMucTonToiThieu())
                .trangThai(creating.getTrangThai())
                .build();
    }


    public static String genMaSanPham(String tenString) {
        // Bỏ dấu tiếng Việt (bao gồm cả đ)
        String khongDau = StringUtils.stripAccents(tenString);

        // Chuyển về chữ thường
        khongDau = khongDau.toLowerCase();

        // Thay thế khoảng trắng bằng dấu gạch dưới
        String ma = khongDau.replaceAll("\\s+", "_");

        // Giữ lại chỉ các ký tự a-z, số và gạch dưới
        ma = ma.replaceAll("[^a-z0-9_]", "");

        return ma;
    }


}
