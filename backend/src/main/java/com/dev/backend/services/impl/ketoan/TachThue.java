package com.dev.backend.services.impl.ketoan;

import com.dev.backend.i18n.LoiThamSoException;
import com.dev.backend.i18n.ThongDiep;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Tách thuế GTGT khỏi tiền đã gồm thuế, theo từng dòng, làm tròn đến đồng.
 *
 * <p>Thành tiền trước thuế = làm tròn(tiền gồm thuế ÷ (1 + thuế suất)); tiền thuế lấy phần còn lại (trừ lùi), nên
 * trước thuế + thuế luôn bằng đúng số khách trả. Có giảm giá (tiền gồm thuế) thì chiết khấu là phần chênh giữa trước
 * thuế của giá gốc và trước thuế của giá sau giảm — AMIS tính thuế trên (thành tiền − chiết khấu).</p>
 *
 * <p>Đơn giá trước thuế = thành tiền ÷ số lượng, giữ 4 số lẻ (AMIS nhận đơn giá lẻ; thành tiền gửi kèm nên không phụ
 * thuộc cách AMIS làm tròn đơn giá).</p>
 */
public final class TachThue {

    private static final BigDecimal TRAM = BigDecimal.valueOf(100);
    static final int SO_LE_DON_GIA = 4;

    private TachThue() {
    }

    /**
     * Kết quả một dòng. thanhTien, chietKhau, tienThue đều là số nguyên đồng.
     * thanhTien − chietKhau + tienThue = tiền khách trả của dòng (gồm thuế, sau giảm giá).
     */
    public record Dong(BigDecimal donGia, BigDecimal thanhTien, BigDecimal chietKhau, BigDecimal tienThue) {
        public BigDecimal sauChietKhau() {
            return thanhTien.subtract(chietKhau);
        }

        public BigDecimal tongCong() {
            return sauChietKhau().add(tienThue);
        }
    }

    /**
     * @param soLuong   số lượng (&gt; 0)
     * @param tienGomThue thành tiền của dòng trước giảm giá, đã gồm thuế (số lượng × đơn giá bán)
     * @param giamGiaGomThue giảm giá của dòng, đã gồm thuế (0 nếu không có); không được lớn hơn tienGomThue
     * @param thueSuat  thuế suất % (0, 5, 8, 10); 0 thì không tách
     */
    public static Dong tach(BigDecimal soLuong, BigDecimal tienGomThue, BigDecimal giamGiaGomThue, BigDecimal thueSuat) {
        if (soLuong == null || soLuong.signum() <= 0) {
            throw new LoiThamSoException(ThongDiep.of("keToanDuLieuVao.soLuongPhaiLonHon0"));
        }
        BigDecimal gop = dong(tienGomThue);
        BigDecimal giam = giamGiaGomThue == null ? BigDecimal.ZERO : dong(giamGiaGomThue);
        if (gop.signum() < 0 || giam.signum() < 0 || giam.compareTo(gop) > 0) {
            throw new LoiThamSoException(ThongDiep.of("keToanDuLieuVao.tienHoacGiamGiaSai"));
        }
        BigDecimal heSo = BigDecimal.ONE.add(thueSuat.divide(TRAM, 6, RoundingMode.HALF_UP));
        BigDecimal thanhTien = gop.divide(heSo, 0, RoundingMode.HALF_UP);
        BigDecimal sauGiamGomThue = gop.subtract(giam);
        BigDecimal sauGiamTruocThue = sauGiamGomThue.divide(heSo, 0, RoundingMode.HALF_UP);
        BigDecimal chietKhau = thanhTien.subtract(sauGiamTruocThue);
        BigDecimal tienThue = sauGiamGomThue.subtract(sauGiamTruocThue);
        BigDecimal donGia = thanhTien.divide(soLuong, SO_LE_DON_GIA, RoundingMode.HALF_UP).stripTrailingZeros();
        if (donGia.scale() < 0) {
            donGia = donGia.setScale(0);
        }
        return new Dong(donGia, thanhTien, chietKhau, tienThue);
    }

    /**
     * Chia một khoản (đồng) cho các dòng theo tỷ lệ trọng số, phần dư chia cho dòng có phần lẻ lớn nhất, nên tổng các
     * phần luôn bằng đúng khoản cần chia. Dùng để suy giảm giá của đơn Shopify cũ chưa lưu giảm giá từng dòng.
     */
    public static List<BigDecimal> chiaTheoTyLe(BigDecimal tong, List<BigDecimal> trongSo) {
        BigDecimal canChia = dong(tong);
        BigDecimal tongTrongSo = trongSo.stream().map(TachThue::dong).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<BigDecimal> ketQua = new ArrayList<>();
        if (trongSo.isEmpty()) {
            return ketQua;
        }
        if (tongTrongSo.signum() == 0) {
            for (int i = 0; i < trongSo.size(); i++) {
                ketQua.add(i == 0 ? canChia : BigDecimal.ZERO);
            }
            return ketQua;
        }
        BigDecimal[] phanLe = new BigDecimal[trongSo.size()];
        BigDecimal daChia = BigDecimal.ZERO;
        for (int i = 0; i < trongSo.size(); i++) {
            BigDecimal chinhXac = canChia.multiply(dong(trongSo.get(i))).divide(tongTrongSo, 10, RoundingMode.HALF_UP);
            BigDecimal phanNguyen = chinhXac.setScale(0, RoundingMode.FLOOR);
            ketQua.add(phanNguyen);
            phanLe[i] = chinhXac.subtract(phanNguyen);
            daChia = daChia.add(phanNguyen);
        }
        int conLai = canChia.subtract(daChia).intValueExact();
        for (int k = 0; k < conLai; k++) {
            int lonNhat = 0;
            for (int i = 1; i < phanLe.length; i++) {
                if (phanLe[i].compareTo(phanLe[lonNhat]) > 0) {
                    lonNhat = i;
                }
            }
            ketQua.set(lonNhat, ketQua.get(lonNhat).add(BigDecimal.ONE));
            phanLe[lonNhat] = BigDecimal.valueOf(-1);
        }
        return ketQua;
    }

    /** Làm tròn đến đồng. */
    public static BigDecimal dong(BigDecimal tien) {
        return tien == null ? BigDecimal.ZERO : tien.setScale(0, RoundingMode.HALF_UP);
    }
}
