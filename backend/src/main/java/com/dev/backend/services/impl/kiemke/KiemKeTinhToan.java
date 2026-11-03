package com.dev.backend.services.impl.kiemke;

import com.dev.backend.entities.ChiTietKiemKe;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Công thức chênh lệch của đặc tả BA mục 6.2 (máy chủ tự tính, không tin số client gửi — BR-STK-06).
 * <pre>
 *   Q = T − H                                  (chênh lệch số lượng)
 *   P = ROUND(|Q| / H × 100, 2)  khi H &gt; 0     (tỷ lệ); H = 0: T &gt; 0 → 100.00, T = 0 → 0.00
 *   V = ROUND(Q × C, 2)                        (giá trị, âm khi thiếu)
 *   loại: Q &lt; 0 thieu · Q &gt; 0 thua · Q = 0 khop;  T NULL (chưa đếm) → Q, P, V, loại đều NULL
 * </pre>
 */
public final class KiemKeTinhToan {

    private static final BigDecimal TRAM = BigDecimal.valueOf(100);

    private KiemKeTinhToan() {
    }

    public record ChenhLech(BigDecimal soLuong, BigDecimal tiLe, BigDecimal giaTri, ChiTietKiemKe.LoaiChenhLech loai) {
    }

    public static ChenhLech tinh(BigDecimal heThong, BigDecimal thucTe, BigDecimal giaVon) {
        if (thucTe == null) return new ChenhLech(null, null, null, null);
        BigDecimal h = heThong == null ? BigDecimal.ZERO : heThong;
        BigDecimal c = giaVon == null ? BigDecimal.ZERO : giaVon;
        BigDecimal q = thucTe.subtract(h);
        BigDecimal p;
        if (h.signum() > 0) {
            p = q.abs().multiply(TRAM).divide(h, 2, RoundingMode.HALF_UP);
        } else {
            p = (thucTe.signum() > 0 ? TRAM : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal v = q.multiply(c).setScale(2, RoundingMode.HALF_UP);
        ChiTietKiemKe.LoaiChenhLech loai = q.signum() < 0 ? ChiTietKiemKe.LoaiChenhLech.thieu
                : q.signum() > 0 ? ChiTietKiemKe.LoaiChenhLech.thua : ChiTietKiemKe.LoaiChenhLech.khop;
        return new ChenhLech(q, p, v, loai);
    }

    /** Ghi Q, P, V, loại vào dòng theo số chốt và số đếm hiện có của dòng. */
    public static void apDung(ChiTietKiemKe dong) {
        ChenhLech cl = tinh(dong.getSoLuongHeThong(), dong.getSoLuongThucTe(), dong.getGiaVonHeThong());
        dong.setChenhLechSoLuong(cl.soLuong());
        dong.setTiLeChenhLech(cl.tiLe());
        dong.setGiaTriChenhLech(cl.giaTri());
        dong.setLoaiChenhLech(cl.loai());
    }

    /** Dòng đã đếm có lệch (Q ≠ 0). */
    public static boolean lech(ChiTietKiemKe dong) {
        return dong.getSoLuongThucTe() != null && dong.getChenhLechSoLuong() != null && dong.getChenhLechSoLuong().signum() != 0;
    }

    static boolean coChu(String s) {
        return s != null && !s.isBlank();
    }
}
