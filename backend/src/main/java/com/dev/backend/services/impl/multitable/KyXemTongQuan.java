package com.dev.backend.services.impl.multitable;

import com.dev.backend.i18n.LoiThamSoException;
import com.dev.backend.i18n.ThongDiep;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;

/**
 * Kỳ xem của màn Tổng quan quản trị. Mọi mốc tính theo lịch (giờ Việt Nam), không cộng trừ số ngày cố định.
 * <ul>
 *   <li>[tu, den): khoảng đang xem; kỳ chạm hôm nay thì den là giờ số liệu.</li>
 *   <li>[tuTruoc, denTruoc): khoảng đem so ở dải số, dài đúng bằng khoảng đang xem (cắt cùng giờ khi kỳ đang chạy).</li>
 *   <li>[bieuDoTruocTu, bieuDoTruocDen): đường kỳ trước trên biểu đồ. Hôm nay vẽ trọn ngày cùng thứ tuần trước, tháng
 *       này vẽ trọn tháng trước, để thấy cả phần còn lại của ngày / tháng; các kỳ khác trùng khoảng đem so.</li>
 *   <li>nhom: "gio" (kỳ 1 ngày), "ngay" (≤ 62 ngày), "thang"; soDiem: số điểm trên trục ngang.</li>
 *   <li>kieuSoSanh: "tuan_truoc" (cùng thứ tuần trước), "lien_truoc" (số ngày liền trước), "thang_truoc",
 *       "nam_truoc" (cùng kỳ năm trước).</li>
 * </ul>
 */
public record KyXemTongQuan(
        String ky,
        LocalDateTime tu,
        LocalDateTime den,
        LocalDateTime tuTruoc,
        LocalDateTime denTruoc,
        LocalDateTime bieuDoTruocTu,
        LocalDateTime bieuDoTruocDen,
        String nhom,
        int soDiem,
        String kieuSoSanh,
        boolean dangChay
) {

    public static final String HOM_NAY = "hom_nay";
    public static final String HOM_QUA = "hom_qua";
    public static final String BAY_NGAY = "7_ngay";
    public static final String BA_MUOI_NGAY = "30_ngay";
    public static final String THANG_NAY = "thang_nay";
    public static final String THANG_TRUOC = "thang_truoc";
    public static final String MUOI_HAI_THANG = "12_thang";
    public static final String TUY_CHON = "tuy_chon";

    public static final String NHOM_GIO = "gio";
    public static final String NHOM_NGAY = "ngay";
    public static final String NHOM_THANG = "thang";

    /** Khoảng tùy chọn dài tối đa (ngày, tính cả hai đầu). */
    public static final int SO_NGAY_TOI_DA = 366;
    /** Khoảng dài hơn số ngày này thì biểu đồ gom theo tháng. */
    static final int SO_NGAY_VE_THEO_NGAY = 62;

    /** Số ngày lịch của khoảng xem (kỳ đang chạy tính cả hôm nay). */
    public long soNgay() {
        return ChronoUnit.DAYS.between(tu.toLocalDate(), den.minusNanos(1).toLocalDate()) + 1;
    }

    /**
     * Dựng kỳ từ mã kỳ. {@code tuNgay}, {@code denNgay} chỉ dùng cho kỳ tùy chọn (tính cả hai đầu).
     *
     * @param bayGio giờ số liệu (giờ Việt Nam)
     */
    public static KyXemTongQuan tao(String ky, LocalDate tuNgay, LocalDate denNgay, LocalDateTime bayGio, LocalDate ngayDauDuLieu) {
        LocalDateTime homNay = bayGio.toLocalDate().atStartOfDay();
        switch (ky) {
            case HOM_NAY:
                return motNgay(ky, homNay, bayGio, bayGio);
            case HOM_QUA:
                return motNgay(ky, homNay.minusDays(1), homNay, bayGio);
            case BAY_NGAY:
            case BA_MUOI_NGAY: {
                int n = BAY_NGAY.equals(ky) ? 7 : 30;
                LocalDateTime tu = homNay.minusDays(n - 1L);
                LocalDateTime tuTruoc = tu.minusDays(n);
                LocalDateTime denTruoc = bayGio.minusDays(n);
                return new KyXemTongQuan(ky, tu, bayGio, tuTruoc, denTruoc, tuTruoc, denTruoc, NHOM_NGAY, n, "lien_truoc", true);
            }
            case THANG_NAY: {
                YearMonth thang = YearMonth.from(bayGio);
                LocalDateTime tu = thang.atDay(1).atStartOfDay();
                LocalDateTime tuTruoc = thang.minusMonths(1).atDay(1).atStartOfDay();
                return new KyXemTongQuan(ky, tu, bayGio, tuTruoc, cungLucThangTruoc(bayGio), tuTruoc, tu,
                        NHOM_NGAY, thang.lengthOfMonth(), "thang_truoc", true);
            }
            case THANG_TRUOC: {
                YearMonth thang = YearMonth.from(bayGio).minusMonths(1);
                LocalDateTime tu = thang.atDay(1).atStartOfDay();
                LocalDateTime den = thang.plusMonths(1).atDay(1).atStartOfDay();
                LocalDateTime tuTruoc = thang.minusMonths(1).atDay(1).atStartOfDay();
                return new KyXemTongQuan(ky, tu, den, tuTruoc, tu, tuTruoc, tu, NHOM_NGAY, thang.lengthOfMonth(),
                        "thang_truoc", false);
            }
            case MUOI_HAI_THANG: {
                LocalDateTime tu = YearMonth.from(bayGio).minusMonths(11).atDay(1).atStartOfDay();
                LocalDateTime tuTruoc = tu.minusYears(1);
                LocalDateTime denTruoc = luiMotNam(bayGio);
                return new KyXemTongQuan(ky, tu, bayGio, tuTruoc, denTruoc, tuTruoc, denTruoc, NHOM_THANG, 12, "nam_truoc", true);
            }
            case TUY_CHON:
                return tuyChon(tuNgay, denNgay, bayGio, ngayDauDuLieu);
            default:
                throw new LoiThamSoException(ThongDiep.of("hienThiBaoCao.tongQuanKyKhongHopLe"));
        }
    }

    /** Kỳ một ngày [tu, den): theo giờ, so với cùng thứ tuần trước (cắt cùng giờ khi đang chạy). */
    private static KyXemTongQuan motNgay(String ky, LocalDateTime tu, LocalDateTime den, LocalDateTime bayGio) {
        boolean dangChay = !den.isBefore(bayGio);
        LocalDateTime denThat = dangChay ? bayGio : den;
        LocalDateTime tuTruoc = tu.minusDays(7);
        return new KyXemTongQuan(ky, tu, denThat, tuTruoc, denThat.minusDays(7), tuTruoc, tuTruoc.plusDays(1),
                NHOM_GIO, 24, "tuan_truoc", dangChay);
    }

    private static KyXemTongQuan tuyChon(LocalDate tuNgay, LocalDate denNgay, LocalDateTime bayGio, LocalDate ngayDauDuLieu) {
        LocalDate homNay = bayGio.toLocalDate();
        if (tuNgay == null || denNgay == null) {
            throw new LoiThamSoException(ThongDiep.of("hienThiBaoCao.tongQuanTuyChonThieuNgay"));
        }
        if (denNgay.isBefore(tuNgay)) {
            throw new LoiThamSoException(ThongDiep.of("hienThiBaoCao.tongQuanTuyChonDaoNgay"));
        }
        if (denNgay.isAfter(homNay)) {
            throw new LoiThamSoException(ThongDiep.of("hienThiBaoCao.tongQuanTuyChonTuongLai"));
        }
        long soNgay = ChronoUnit.DAYS.between(tuNgay, denNgay) + 1;
        if (soNgay > SO_NGAY_TOI_DA) {
            throw new LoiThamSoException(ThongDiep.of("hienThiBaoCao.tongQuanTuyChonQuaDai", SO_NGAY_TOI_DA));
        }
        if (ngayDauDuLieu != null && denNgay.isBefore(ngayDauDuLieu)) {
            throw new LoiThamSoException(ThongDiep.of("hienThiBaoCao.tongQuanTuyChonTruocDuLieu"));
        }
        LocalDateTime tu = tuNgay.atStartOfDay();
        LocalDateTime cuoiNgay = denNgay.plusDays(1).atStartOfDay();
        if (soNgay == 1) {
            return motNgay(TUY_CHON, tu, cuoiNgay, bayGio);
        }
        boolean dangChay = !cuoiNgay.isBefore(bayGio);
        LocalDateTime den = dangChay ? bayGio : cuoiNgay;
        LocalDateTime tuTruoc = tu.minusDays(soNgay);
        LocalDateTime denTruoc = tuTruoc.plusSeconds(ChronoUnit.SECONDS.between(tu, den));
        if (soNgay <= SO_NGAY_VE_THEO_NGAY) {
            return new KyXemTongQuan(TUY_CHON, tu, den, tuTruoc, denTruoc, tuTruoc, denTruoc, NHOM_NGAY, (int) soNgay,
                    "lien_truoc", dangChay);
        }
        int soThang = (int) ChronoUnit.MONTHS.between(YearMonth.from(tuNgay), YearMonth.from(denNgay)) + 1;
        // Đường kỳ trước vẽ theo tháng: lùi đúng soThang tháng để mỗi điểm rơi đúng một tháng (lùi theo số ngày thì khoảng
        // trước có thể trải soThang + 1 tháng và tháng cuối bị cắt khỏi biểu đồ). Dải số vẫn so với khoảng liền trước.
        return new KyXemTongQuan(TUY_CHON, tu, den, tuTruoc, denTruoc, tu.minusMonths(soThang), den.minusMonths(soThang),
                NHOM_THANG, soThang, "lien_truoc", dangChay);
    }

    /** Cùng ngày, cùng giờ của tháng trước; tháng trước không có ngày đó thì lấy hết tháng trước. */
    static LocalDateTime cungLucThangTruoc(LocalDateTime t) {
        YearMonth truoc = YearMonth.from(t).minusMonths(1);
        if (t.getDayOfMonth() > truoc.lengthOfMonth()) {
            return YearMonth.from(t).atDay(1).atStartOfDay();
        }
        return t.minusMonths(1);
    }

    /** Lùi một năm theo lịch (29/02 → 28/02), giữ giờ. */
    static LocalDateTime luiMotNam(LocalDateTime t) {
        return t.minusYears(1);
    }

    /**
     * Vị trí của một thời điểm trên trục ngang tính từ mốc {@code goc} (đầu khoảng đang xem hoặc đầu đường kỳ trước):
     * giờ thứ mấy, ngày thứ mấy hoặc tháng thứ mấy kể từ mốc.
     */
    public int viTri(LocalDateTime goc, LocalDateTime t) {
        return switch (nhom) {
            case NHOM_GIO -> (int) ChronoUnit.HOURS.between(goc, t.withMinute(0).withSecond(0).withNano(0));
            case NHOM_NGAY -> (int) ChronoUnit.DAYS.between(goc.toLocalDate(), t.toLocalDate());
            default -> (int) ChronoUnit.MONTHS.between(YearMonth.from(goc), YearMonth.from(t));
        };
    }
}
