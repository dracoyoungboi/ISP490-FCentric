package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.BaoCaoKhachHangDTO;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.i18n.LoiThamSoException;

/**
 * Phần tính của Báo cáo khách hàng, không đọc cơ sở dữ liệu: chia kỳ, đếm khách mới / quay lại theo kỳ, tính phần tổng.
 * Khách mới của một kỳ là khách có lần mua đầu tiên (ở mọi kho) rơi vào kỳ đó.
 */
public final class TinhBaoCaoKhachHang {

    /** Khoảng ngày tối đa của kiểu Ngày (mỗi ngày một dòng). */
    static final int SO_NGAY_TOI_DA = 366;
    /** Số năm tối đa của kiểu Năm. */
    static final int SO_NAM_TOI_DA = 20;
    static final int NAM_NHO_NHAT = 2000;
    static final int NAM_LON_NHAT = 2100;

    private static final DateTimeFormatter NGAY_THANG = DateTimeFormatter.ofPattern("dd/MM");
    private static final DateTimeFormatter NGAY_DAY_DU = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private TinhBaoCaoKhachHang() {
    }

    /** Một kỳ báo cáo [tu, den] (cả hai đầu). */
    public record Ky(String nhan, LocalDate tu, LocalDate den) {
        boolean chua(LocalDate ngay) {
            return !ngay.isBefore(tu) && !ngay.isAfter(den);
        }
    }

    /** Một đơn đã giao. khachHangId null hoặc khachLe = true: đơn khách lẻ. */
    public record Don(Integer khachHangId, boolean khachLe, LocalDate ngay, BigDecimal tongCong) {
        boolean laKhach() {
            return !khachLe && khachHangId != null;
        }
    }

    /** Lịch sử mua (mọi kho) của một khách: ngày mua đầu tiên và số đơn đã giao tới hết khoảng tổng. */
    public record LichSu(LocalDate lanDau, long soDonDenCuoi) {
    }

    // ================= Chia kỳ =================

    /** Các kỳ của kiểu báo cáo, theo thứ tự thời gian. Tham số sai thì báo lỗi đọc được. */
    public static List<Ky> cacKy(String loai, LocalDate tuNgay, LocalDate denNgay, Integer nam, Integer thang,
                                 Integer tuNam, Integer denNam) {
        List<Ky> ds = new ArrayList<>();
        switch (loai == null ? "" : loai) {
            case "ngay" -> {
                if (tuNgay == null || denNgay == null) throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chonTuNgayDenNgay"));
                if (tuNgay.isAfter(denNgay)) throw new LoiThamSoException(ThongDiep.of("khoVanHanh.tuNgayTruocDenNgay"));
                if (ChronoUnit.DAYS.between(tuNgay, denNgay) + 1 > SO_NGAY_TOI_DA)
                    throw new LoiThamSoException(ThongDiep.of("khoVanHanh.khoangNgayToiDaMotNam"));
                DateTimeFormatter f = tuNgay.getYear() == denNgay.getYear() ? NGAY_THANG : NGAY_DAY_DU;
                for (LocalDate d = tuNgay; !d.isAfter(denNgay); d = d.plusDays(1)) ds.add(new Ky(d.format(f), d, d));
            }
            case "tuan" -> {
                int n = canNam(nam);
                // Tuần ISO (thứ Hai đến Chủ nhật) của năm n: tuần 1 là tuần có ngày 4/1, có năm 53 tuần
                LocalDate dau = LocalDate.of(n, 1, 4).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                long soTuan = IsoFields.WEEK_OF_WEEK_BASED_YEAR.rangeRefinedBy(LocalDate.of(n, 6, 1)).getMaximum();
                for (int i = 0; i < soTuan; i++) {
                    LocalDate tu = dau.plusWeeks(i);
                    ds.add(new Ky("Tuần " + (i + 1), tu, tu.plusDays(6)));
                }
            }
            case "thang" -> {
                int n = canNam(nam);
                for (int m = 1; m <= 12; m++) ds.add(thang(n, m));
            }
            case "nam" -> {
                if (tuNam == null || denNam == null) throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chonTuNamDenNam"));
                canNam(tuNam);
                canNam(denNam);
                if (tuNam > denNam) throw new LoiThamSoException(ThongDiep.of("khoVanHanh.tuNamTruocDenNam"));
                if (denNam - tuNam + 1 > SO_NAM_TOI_DA)
                    throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chiXemToiDaNam", SO_NAM_TOI_DA));
                for (int y = tuNam; y <= denNam; y++)
                    ds.add(new Ky(String.valueOf(y), LocalDate.of(y, 1, 1), LocalDate.of(y, 12, 31)));
            }
            case "so_sanh" -> {
                int n = canNam(nam);
                if (thang == null) throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chonNamThangSoSanh"));
                if (thang < 1 || thang > 12) throw new LoiThamSoException(ThongDiep.of("khoVanHanh.thangTu1Den12"));
                Ky dangChon = thang(n, thang);
                ds.add(kyTruoc("so_sanh", dangChon));
                ds.add(dangChon);
            }
            default -> throw new LoiThamSoException(ThongDiep.of("khoVanHanh.kieuBaoCaoKhongHopLe"));
        }
        return ds;
    }

    /** Kỳ liền trước một kỳ, cùng độ dài (để tính khách mới so với kỳ trước cho cả kỳ đầu tiên đang xem). */
    public static Ky kyTruoc(String loai, Ky ky) {
        return switch (loai) {
            case "ngay" -> {
                LocalDate d = ky.tu().minusDays(1);
                yield new Ky(d.format(NGAY_DAY_DU), d, d);
            }
            case "tuan" -> new Ky("Tuần trước", ky.tu().minusWeeks(1), ky.tu().minusDays(1));
            case "nam" -> {
                int y = ky.tu().getYear() - 1;
                yield new Ky(String.valueOf(y), LocalDate.of(y, 1, 1), LocalDate.of(y, 12, 31));
            }
            default -> {
                LocalDate d = ky.tu().minusMonths(1);
                yield thang(d.getYear(), d.getMonthValue());
            }
        };
    }

    /** Khoảng của phần tổng: cả các kỳ đang xem; riêng So sánh là tháng đang chọn (kỳ sau). */
    public static Ky khoangTong(String loai, List<Ky> ky) {
        Ky cuoi = ky.get(ky.size() - 1);
        if ("so_sanh".equals(loai)) return cuoi;
        return new Ky("", ky.get(0).tu(), cuoi.den());
    }

    private static Ky thang(int nam, int thang) {
        LocalDate tu = LocalDate.of(nam, thang, 1);
        return new Ky("T" + thang + "/" + nam, tu, tu.plusMonths(1).minusDays(1));
    }

    private static int canNam(Integer nam) {
        if (nam == null) throw new LoiThamSoException(ThongDiep.of("khoVanHanh.chonNam"));
        if (nam < NAM_NHO_NHAT || nam > NAM_LON_NHAT) throw new LoiThamSoException(ThongDiep.of("khoVanHanh.namKhongHopLe"));
        return nam;
    }

    // ================= Đếm theo kỳ =================

    /**
     * Dòng theo kỳ. truoc: kỳ liền trước kỳ đầu (chỉ dùng để tính tỷ lệ của kỳ đầu, không trả về).
     * lanDau: ngày mua đầu tiên (mọi kho) của từng khách; thiếu thì lấy đơn sớm nhất trong danh sách đơn.
     */
    public static List<BaoCaoKhachHangDTO.Ky> theoKy(List<Ky> ky, Ky truoc, List<Don> don,
                                                     Map<Integer, LocalDate> lanDau, LocalDate homNay) {
        List<Ky> tat = new ArrayList<>(ky.size() + 1);
        tat.add(truoc);
        tat.addAll(ky);

        // Kỳ liền nhau, tăng dần: tìm kỳ của một ngày theo ngày bắt đầu
        TreeMap<LocalDate, Integer> theoNgayDau = new TreeMap<>();
        for (int i = 0; i < tat.size(); i++) theoNgayDau.putIfAbsent(tat.get(i).tu(), i);

        List<Set<Integer>> khachTheoKy = new ArrayList<>(tat.size());
        for (int i = 0; i < tat.size(); i++) khachTheoKy.add(new HashSet<>());
        Map<Integer, LocalDate> somNhat = new HashMap<>();
        for (Don d : don) {
            if (!d.laKhach() || d.ngay() == null) continue;
            somNhat.merge(d.khachHangId(), d.ngay(), (a, b) -> a.isBefore(b) ? a : b);
            Map.Entry<LocalDate, Integer> e = theoNgayDau.floorEntry(d.ngay());
            if (e == null) continue;
            int i = e.getValue();
            // Ngày nằm giữa hai kỳ không liền nhau (So sánh luôn liền nhau, phòng xa) thì bỏ qua
            if (!tat.get(i).chua(d.ngay())) continue;
            khachTheoKy.get(i).add(d.khachHangId());
        }

        List<BaoCaoKhachHangDTO.Ky> kq = new ArrayList<>(ky.size());
        long moiTruoc = 0;
        long tichLuy = 0;
        for (int i = 0; i < tat.size(); i++) {
            Ky k = tat.get(i);
            Set<Integer> khach = khachTheoKy.get(i);
            long moi = 0;
            for (Integer id : khach) {
                LocalDate dau = lanDau.getOrDefault(id, somNhat.get(id));
                if (dau == null || !dau.isBefore(k.tu())) moi++;
            }
            if (i > 0) {
                tichLuy += moi;
                kq.add(new BaoCaoKhachHangDTO.Ky(k.nhan(), k.tu(), k.den(), moi, khach.size() - moi, khach.size(),
                        tichLuy, tyLe(moi, moiTruoc), k.tu().isAfter(homNay)));
            }
            moiTruoc = moi;
        }
        return kq;
    }

    /** % thay đổi so với kỳ trước, một chữ số thập phân; null khi kỳ trước bằng 0. */
    static BigDecimal tyLe(long nay, long truoc) {
        if (truoc == 0) return null;
        return BigDecimal.valueOf((nay - truoc) * 100.0 / truoc).setScale(1, RoundingMode.HALF_UP);
    }

    // ================= Tổng cả kỳ =================

    /** Phần tổng trên khoảng [khoang.tu, khoang.den]; lichSu: theo từng khách có đơn trong khoảng. */
    public static BaoCaoKhachHangDTO.Tong tong(Ky khoang, List<Don> don, Map<Integer, LichSu> lichSu) {
        Set<Integer> khach = new HashSet<>();
        long soDon = 0;
        long donLe = 0;
        BigDecimal doanhThu = BigDecimal.ZERO;
        Map<Integer, LocalDate> somNhat = new HashMap<>();
        Map<Integer, Long> demDon = new HashMap<>();
        for (Don d : don) {
            if (d.ngay() == null || !khoang.chua(d.ngay())) continue;
            if (!d.laKhach()) {
                donLe++;
                continue;
            }
            khach.add(d.khachHangId());
            soDon++;
            if (d.tongCong() != null) doanhThu = doanhThu.add(d.tongCong());
            somNhat.merge(d.khachHangId(), d.ngay(), (a, b) -> a.isBefore(b) ? a : b);
            demDon.merge(d.khachHangId(), 1L, Long::sum);
        }
        long moi = 0;
        long muaLai = 0;
        for (Integer id : khach) {
            LichSu ls = lichSu.get(id);
            LocalDate dau = ls != null && ls.lanDau() != null ? ls.lanDau() : somNhat.get(id);
            if (!dau.isBefore(khoang.tu())) moi++;
            long soDonDenCuoi = ls != null ? ls.soDonDenCuoi() : demDon.get(id);
            if (soDonDenCuoi >= 2) muaLai++;
        }
        return new BaoCaoKhachHangDTO.Tong(khoang.tu(), khoang.den(), khach.size(), moi, muaLai, soDon, doanhThu, donLe);
    }
}
