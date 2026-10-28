package com.dev.backend.services.impl.entities;

import com.dev.backend.exception.customize.CommonException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Thuế GTGT trên hóa đơn bán hàng (hàm thuần, không đọc DB). Giá bán đã gồm thuế: tiền thuế tách ngược từ tổng thanh
 * toán (gồm phí vận chuyển) theo thuế suất có hiệu lực vào ngày chốt đơn, làm tròn tới đồng.
 * Lịch thuế suất lưu ở cấu hình VAT_LICH dạng JSON: [{"tuNgay":"2025-07-01","thueSuat":8}, ...] — mỗi mục có hiệu lực từ
 * tuNgay tới trước mục kế tiếp.
 */
public final class ThueGtgt {

    /** Mặc định: 8% (giảm 2% theo NQ 204/2025, NĐ 174/2025) tới hết 31/12/2026, 10% từ 01/01/2027. */
    public static final String LICH_MAC_DINH = "[{\"tuNgay\":\"2025-07-01\",\"thueSuat\":8},{\"tuNgay\":\"2027-01-01\",\"thueSuat\":10}]";
    static final int TOI_DA_MUC = 10;
    private static final BigDecimal TRAM = new BigDecimal("100");
    private static final ObjectMapper JSON = new ObjectMapper();

    private ThueGtgt() {
    }

    /** Một mốc của lịch thuế suất. */
    public record Muc(LocalDate tuNgay, BigDecimal thueSuat) {
    }

    /** Đọc và kiểm lịch thuế suất; sai thì báo lỗi tiếng Việt (dùng khi lưu cấu hình). Trả lịch đã xếp theo ngày. */
    public static List<Muc> docLich(String json) {
        if (json == null || json.isBlank()) throw new CommonException("Lịch thuế suất GTGT đang trống");
        JsonNode goc;
        try {
            goc = JSON.readTree(json);
        } catch (Exception e) {
            throw new CommonException("Lịch thuế suất GTGT không đúng định dạng");
        }
        if (goc == null || !goc.isArray() || goc.isEmpty()) throw new CommonException("Lịch thuế suất GTGT cần ít nhất một mốc");
        if (goc.size() > TOI_DA_MUC) throw new CommonException("Lịch thuế suất GTGT tối đa " + TOI_DA_MUC + " mốc");
        List<Muc> ds = new ArrayList<>();
        Set<LocalDate> ngay = new HashSet<>();
        for (JsonNode n : goc) {
            LocalDate tu;
            try {
                tu = LocalDate.parse(n.path("tuNgay").asText(""));
            } catch (DateTimeParseException e) {
                throw new CommonException("Ngày bắt đầu của mốc thuế suất không hợp lệ (dạng yyyy-MM-dd)");
            }
            JsonNode s = n.path("thueSuat");
            if (!s.isNumber()) throw new CommonException("Thuế suất của mốc " + tu + " phải là số");
            BigDecimal ts = s.decimalValue();
            if (ts.signum() < 0 || ts.compareTo(TRAM) > 0) throw new CommonException("Thuế suất phải từ 0 đến 100%");
            if (ts.stripTrailingZeros().scale() > 2) throw new CommonException("Thuế suất tối đa 2 chữ số thập phân");
            if (!ngay.add(tu)) throw new CommonException("Hai mốc thuế suất trùng ngày " + tu);
            ds.add(new Muc(tu, ts.stripTrailingZeros()));
        }
        ds.sort(Comparator.comparing(Muc::tuNgay));
        return ds;
    }

    /** Thuế suất có hiệu lực vào ngày cho trước; trước mốc đầu tiên thì null (không tính thuế). */
    public static BigDecimal thueSuatTai(List<Muc> lich, LocalDate ngay) {
        BigDecimal kq = null;
        for (Muc m : lich) {
            if (m.tuNgay().isAfter(ngay)) break;
            kq = m.thueSuat();
        }
        return kq;
    }

    /** Tiền thuế tách ngược từ tổng đã gồm thuế: tong × ts / (100 + ts), làm tròn tới đồng. */
    public static BigDecimal tienThue(BigDecimal tongDaGomThue, BigDecimal thueSuat) {
        if (tongDaGomThue == null || thueSuat == null || thueSuat.signum() == 0) return BigDecimal.ZERO;
        return tongDaGomThue.multiply(thueSuat).divide(TRAM.add(thueSuat), 0, RoundingMode.HALF_UP);
    }
}
