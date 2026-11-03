package com.dev.backend.services.impl.ketoan;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Tra thuế suất GTGT của một mặt hàng tại một ngày hạch toán: tìm dòng ghi đè của danh mục sản phẩm, không có thì lần
 * lên danh mục cha, hết thì dùng mức chung. Dựng một lần cho cả lô xuất (bảng thuế suất và cây danh mục đều nhỏ).
 */
public final class TraThueSuat {

    /** Một dòng của bảng thue_suat_gtgt; danhMucId null = mức chung; den null = chưa hết hiệu lực. */
    public record Muc(Integer danhMucId, BigDecimal tyLe, LocalDate tu, LocalDate den) {
        boolean apDung(LocalDate ngay) {
            return !ngay.isBefore(tu) && (den == null || !ngay.isAfter(den));
        }
    }

    private final Map<Integer, List<Muc>> theoDanhMuc = new HashMap<>();
    private final List<Muc> mucChung = new ArrayList<>();
    private final Map<Integer, Integer> danhMucCha;

    /**
     * @param muc       mọi dòng thuế suất
     * @param danhMucCha id danh mục → id danh mục cha (không có cha thì không có khóa hoặc giá trị null)
     */
    public TraThueSuat(Collection<Muc> muc, Map<Integer, Integer> danhMucCha) {
        for (Muc m : muc) {
            if (m.danhMucId() == null) {
                mucChung.add(m);
            } else {
                theoDanhMuc.computeIfAbsent(m.danhMucId(), k -> new ArrayList<>()).add(m);
            }
        }
        this.danhMucCha = danhMucCha == null ? Map.of() : danhMucCha;
    }

    /** Thuế suất % của danh mục tại ngày; null khi không có dòng nào áp dụng (kể cả mức chung). */
    public BigDecimal tra(Integer danhMucId, LocalDate ngay) {
        Set<Integer> daQua = new HashSet<>();
        Integer hienTai = danhMucId;
        while (hienTai != null && daQua.add(hienTai)) {
            BigDecimal tim = timTrong(theoDanhMuc.get(hienTai), ngay);
            if (tim != null) {
                return tim;
            }
            hienTai = danhMucCha.get(hienTai);
        }
        return mucChung(ngay);
    }

    /** Mức chung tại ngày (dòng dịch vụ phí vận chuyển, dòng không có danh mục); null khi không có. */
    public BigDecimal mucChung(LocalDate ngay) {
        return timTrong(mucChung, ngay);
    }

    private static BigDecimal timTrong(List<Muc> ds, LocalDate ngay) {
        if (ds == null) {
            return null;
        }
        // Nhiều dòng cùng áp dụng (dữ liệu nhập chồng): lấy dòng bắt đầu muộn nhất
        Muc chon = null;
        for (Muc m : ds) {
            if (m.apDung(ngay) && (chon == null || m.tu().isAfter(chon.tu()))) {
                chon = m;
            }
        }
        return chon == null ? null : chon.tyLe();
    }
}
