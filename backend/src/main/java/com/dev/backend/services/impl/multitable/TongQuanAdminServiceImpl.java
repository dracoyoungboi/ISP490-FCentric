package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.TongQuanAdminResponse;
import com.dev.backend.dto.response.TongQuanAdminResponse.ChiSo;
import com.dev.backend.dto.response.TongQuanAdminResponse.Diem;
import com.dev.backend.dto.response.TongQuanAdminResponse.DiemNhapXuat;
import com.dev.backend.dto.response.TongQuanAdminResponse.DoanhThu;
import com.dev.backend.dto.response.TongQuanAdminResponse.DoanhThuKho;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongBoSung;
import com.dev.backend.dto.response.TongQuanAdminResponse.HangCanBoSung;
import com.dev.backend.dto.response.TongQuanAdminResponse.HoatDong;
import com.dev.backend.dto.response.TongQuanAdminResponse.Kenh;
import com.dev.backend.dto.response.TongQuanAdminResponse.Kho;
import com.dev.backend.dto.response.TongQuanAdminResponse.LoiDongBoKenh;
import com.dev.backend.dto.response.TongQuanAdminResponse.NhapXuat;
import com.dev.backend.dto.response.TongQuanAdminResponse.NhomBoSung;
import com.dev.backend.dto.response.TongQuanAdminResponse.SanPhamBanChay;
import com.dev.backend.dto.response.TongQuanAdminResponse.SoDonNgay;
import com.dev.backend.dto.response.TongQuanAdminResponse.TonKho;
import com.dev.backend.dto.response.TongQuanAdminResponse.TonKhoKho;
import com.dev.backend.dto.response.TongQuanAdminResponse.ViecCanXuLy;
import com.dev.backend.dto.response.TongQuanAdminResponse.ViecTheoKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanAdminRepository.DoanhThuKhoDong;
import com.dev.backend.repository.TongQuanAdminRepository.DoanhThuNgay;
import com.dev.backend.repository.TongQuanAdminRepository.HangCanBoSungNhomDong;
import com.dev.backend.repository.TongQuanAdminRepository.HomNayDong;
import com.dev.backend.repository.TongQuanAdminRepository.KhoDong;
import com.dev.backend.repository.TongQuanAdminRepository.NhapXuatNgay;
import com.dev.backend.repository.TongQuanAdminRepository.SanPhamBanChayDong;
import com.dev.backend.repository.TongQuanAdminRepository.TonKhoTheoKhoDong;
import com.dev.backend.repository.TongQuanAdminRepository.TonKhoTongHopDong;
import com.dev.backend.services.impl.multitable.KhaDungChuyenKhoService.KhaDungChuyen;
import com.dev.backend.services.multitable.TongQuanAdminService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Màn Tổng quan của quản trị viên (UC 11.1): mỗi khối tính độc lập, khối lỗi không làm hỏng các khối khác.
 */
@Service
public class TongQuanAdminServiceImpl implements TongQuanAdminService {

    private static final Logger log = LoggerFactory.getLogger(TongQuanAdminServiceImpl.class);

    public static final String KY_7_NGAY = "7_ngay";
    public static final String KY_30_NGAY = "30_ngay";
    public static final String KY_12_THANG = "12_thang";

    /** Dùng khi chưa cấu hình DEFAULT_MIN_STOCK_ALERT. */
    public static final int NGUONG_TON_MAC_DINH = 10;
    /** Dư hàng khi khả dụng vượt ngưỡng × hệ số này (có thể ghi đè bằng cấu hình SURPLUS_STOCK_RATIO). */
    public static final int HE_SO_DU_MAC_DINH = 3;
    /** Số ngày xét hàng dư "chưa bán được" (có thể ghi đè bằng cấu hình SLOW_MOVING_DAYS). */
    public static final int SO_NGAY_CHAM_BAN_MAC_DINH = 60;

    private static final int SO_SAN_PHAM_BAN_CHAY = 5;
    /** Số nhóm (sản phẩm, kho) cần bổ sung hiện ở Tổng quan; xem hết ở Báo cáo tồn kho. */
    static final int SO_NHOM_BO_SUNG = 3;
    private static final int SO_HOAT_DONG = 8;
    private static final int SO_NGAY_DON_MOI = 14;

    private static final DateTimeFormatter DINH_DANG_THOI_DIEM = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    /** Giữ kết quả 60 giây cho mỗi (kỳ, kho): mở lại màn hoặc đổi qua lại bộ lọc không phải tính lại. */
    static final long THOI_GIAN_GIU_MS = 60_000;

    private record BanDaTinh(long luc, TongQuanAdminResponse duLieu) {}

    private final TongQuanAdminRepository repo;
    private final KhaDungChuyenKhoService khaDungChuyenKhoService;
    private final Map<String, BanDaTinh> banDaTinh = new ConcurrentHashMap<>();

    public TongQuanAdminServiceImpl(TongQuanAdminRepository repo, KhaDungChuyenKhoService khaDungChuyenKhoService) {
        this.repo = repo;
        this.khaDungChuyenKhoService = khaDungChuyenKhoService;
    }

    /**
     * Khung thời gian của kỳ xem.
     * [tu, den) là phần đã trọn (không gồm ngày/tháng đang chạy); [tuTruoc, denTruoc) là kỳ so sánh.
     * Biểu đồ vẽ từ tu đến hết ngày/tháng hiện tại (điểm cuối đang chạy, vẽ nét đứt).
     */
    record KhungKy(boolean theoThang, LocalDate tu, LocalDate den, LocalDate tuTruoc, LocalDate denTruoc) {
        int soNgay() {
            return (int) ChronoUnit.DAYS.between(tu, den);
        }
    }

    static KhungKy khungKy(String ky, LocalDate homNay) {
        switch (ky) {
            case KY_7_NGAY:
            case KY_30_NGAY: {
                int n = KY_7_NGAY.equals(ky) ? 7 : 30;
                LocalDate tu = homNay.minusDays(n);
                return new KhungKy(false, tu, homNay, homNay.minusDays(2L * n), tu);
            }
            case KY_12_THANG: {
                // 12 tháng đã trọn trước tháng này; so với cùng 12 tháng của năm trước.
                YearMonth thangNay = YearMonth.from(homNay);
                return new KhungKy(true,
                        thangNay.minusMonths(12).atDay(1), thangNay.atDay(1),
                        thangNay.minusMonths(24).atDay(1), thangNay.minusMonths(12).atDay(1));
            }
            default:
                throw new CommonException("Kỳ xem không hợp lệ, chỉ nhận 7_ngay, 30_ngay hoặc 12_thang");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public TongQuanAdminResponse layTongQuan(String ky, Integer khoId, boolean lamMoi) {
        String kyXem = (ky == null || ky.isBlank()) ? KY_30_NGAY : ky.trim();
        khungKy(kyXem, LocalDate.now()); // kiểm tra kỳ xem hợp lệ trước khi tra bản đã tính
        String khoa = kyXem + "|" + khoId;
        long bayGioMs = System.currentTimeMillis();
        BanDaTinh daTinh = banDaTinh.get(khoa);
        if (!lamMoi && daTinh != null && bayGioMs - daTinh.luc() < THOI_GIAN_GIU_MS) {
            return daTinh.duLieu();
        }
        TongQuanAdminResponse ketQua = tinhTongQuan(kyXem, khoId);
        // Chỉ giữ bản đầy đủ; bản có khối lỗi sẽ được tính lại ở lần mở sau.
        if (ketQua.khoiLoi().isEmpty()) {
            banDaTinh.put(khoa, new BanDaTinh(bayGioMs, ketQua));
        }
        return ketQua;
    }

    private TongQuanAdminResponse tinhTongQuan(String kyXem, Integer khoId) {
        LocalDateTime bayGio = repo.thoiDiemHienTai();
        LocalDate homNay = bayGio.toLocalDate();
        KhungKy khung = khungKy(kyXem, homNay);

        List<KhoDong> dsKho = repo.danhSachKho();
        if (khoId != null && dsKho.stream().noneMatch(k -> k.id().equals(khoId))) {
            throw new CommonException("Kho không tồn tại hoặc đã ngừng hoạt động");
        }
        Map<Integer, KhoDong> khoTheoId = new LinkedHashMap<>();
        dsKho.forEach(k -> khoTheoId.put(k.id(), k));

        List<String> khoiLoi = Collections.synchronizedList(new ArrayList<>());
        int nguong = macDinhNeuKhongHopLe(chay("cauHinh", khoiLoi, () -> repo.cauHinhSo("DEFAULT_MIN_STOCK_ALERT")),
                NGUONG_TON_MAC_DINH);
        int heSoDu = macDinhNeuKhongHopLe(chay("cauHinh", khoiLoi, () -> repo.cauHinhSo("SURPLUS_STOCK_RATIO")),
                HE_SO_DU_MAC_DINH);
        int soNgayChamBan = macDinhNeuKhongHopLe(chay("cauHinh", khoiLoi, () -> repo.cauHinhSo("SLOW_MOVING_DAYS")),
                SO_NGAY_CHAM_BAN_MAC_DINH);
        khoiLoi.remove("cauHinh");

        /*
         * Doanh thu theo ngày: đủ rộng cho kỳ xem, kỳ so sánh, lũy kế năm, năm trước và tháng trước.
         * Giá vốn (tốn kém hơn) chỉ lấy cho phần cần lợi nhuận: kỳ xem và kỳ so sánh (lợi nhuận của biểu đồ
         * kỳ trước), tháng này và tháng trước.
         */
        YearMonth thangNay = YearMonth.from(homNay);
        LocalDate tuTruyVan = minNgay(khung.tuTruoc(), LocalDate.of(homNay.getYear() - 1, 1, 1),
                thangNay.minusMonths(1).atDay(1));
        LocalDate tuGiaVon = minNgay(khung.tuTruoc(), thangNay.minusMonths(1).atDay(1));
        DuLieuNgay theoNgay = chay(TongQuanAdminResponse.KHOI_DOANH_THU, khoiLoi, () -> {
            DuLieuNgay m = new DuLieuNgay();
            repo.doanhThuTheoNgay(tuTruyVan.atStartOfDay(), homNay.plusDays(1).atStartOfDay(), khoId)
                    .forEach(r -> m.doanhThu.put(r.ngay(), r));
            repo.giaVonTheoNgay(tuGiaVon.atStartOfDay(), homNay.plusDays(1).atStartOfDay(), khoId)
                    .forEach(r -> m.giaVon.put(r.ngay(), r.giaVon()));
            return m;
        });

        ChiSo chiSo = chay(TongQuanAdminResponse.KHOI_CHI_SO, khoiLoi,
                () -> tinhChiSo(bayGio, khoId, batBuoc(theoNgay)));
        DoanhThu doanhThu = theoNgay == null ? null
                : chay(TongQuanAdminResponse.KHOI_DOANH_THU, khoiLoi, () -> tinhDoanhThu(khung, homNay, theoNgay));
        List<DoanhThuKho> theoKho = chay(TongQuanAdminResponse.KHOI_DOANH_THU_THEO_KHO, khoiLoi,
                () -> tinhDoanhThuTheoKho(khung, khoTheoId));
        List<Kenh> theoKenh = chay(TongQuanAdminResponse.KHOI_THEO_KENH, khoiLoi,
                () -> tinhTheoKenh(khung, khoId));
        TonKhoTongHopDong tongHopTon = chay(TongQuanAdminResponse.KHOI_TON_KHO, khoiLoi,
                () -> repo.tonKhoTongHop(khoId, nguong, heSoDu));
        TonKho tonKho = tongHopTon == null ? null
                : chay(TongQuanAdminResponse.KHOI_TON_KHO, khoiLoi,
                        () -> tinhTonKho(tongHopTon, khoId, khoTheoId, nguong, heSoDu, soNgayChamBan, homNay));
        ViecCanXuLy viec = chay(TongQuanAdminResponse.KHOI_VIEC_CAN_XU_LY, khoiLoi,
                () -> tinhViecCanXuLy(khoId, tongHopTon, homNay));
        NhapXuat nhapXuat = chay(TongQuanAdminResponse.KHOI_NHAP_XUAT, khoiLoi,
                () -> tinhNhapXuat(khung, homNay, khoId));
        List<SanPhamBanChay> banChay = chay(TongQuanAdminResponse.KHOI_SAN_PHAM_BAN_CHAY, khoiLoi,
                () -> tinhSanPhamBanChay(khung, khoId));
        HangCanBoSung boSung = chay(TongQuanAdminResponse.KHOI_HANG_CAN_BO_SUNG, khoiLoi,
                () -> tinhHangCanBoSung(khoId, nguong, tongHopTon, khoTheoId));
        List<HoatDong> hoatDong = chay(TongQuanAdminResponse.KHOI_HOAT_DONG, khoiLoi,
                () -> tinhHoatDong(khoId));

        List<Kho> danhSachKho = dsKho.stream()
                .map(k -> new Kho(k.id(), k.maKho(), k.tenKho(), k.laKhoTong()))
                .toList();
        return new TongQuanAdminResponse(
                bayGio.format(DINH_DANG_THOI_DIEM), kyXem, khoId, danhSachKho, List.copyOf(khoiLoi),
                chiSo, doanhThu, theoKho, theoKenh, viec, tonKho, nhapXuat, banChay, boSung, hoatDong);
    }

    /* ======================================================================
     * TỪNG KHỐI
     * ====================================================================== */

    private ChiSo tinhChiSo(LocalDateTime bayGio, Integer khoId, DuLieuNgay theoNgay) {
        LocalDate homNay = bayGio.toLocalDate();
        HomNayDong h = repo.homNay(bayGio, khoId);

        long[] theoGio = new long[bayGio.getHour() + 1];
        repo.doanhThuTheoGio(homNay.atStartOfDay(), bayGio, khoId).forEach(r -> {
            if (r.gio() >= 0 && r.gio() < theoGio.length) theoGio[r.gio()] = so(r.doanhThu());
        });
        List<Long> doanhThuTheoGio = new ArrayList<>();
        for (long v : theoGio) doanhThuTheoGio.add(v);

        LocalDate tu14 = homNay.minusDays(SO_NGAY_DON_MOI - 1L);
        Map<LocalDate, Long> donMoi = new HashMap<>();
        repo.soDonMoiTheoNgay(tu14.atStartOfDay(), homNay.plusDays(1).atStartOfDay(), khoId)
                .forEach(r -> donMoi.put(r.ngay(), r.soDon()));
        List<SoDonNgay> soDonMoiTheoNgay = new ArrayList<>();
        for (LocalDate d = tu14; !d.isAfter(homNay); d = d.plusDays(1)) {
            soDonMoiTheoNgay.add(new SoDonNgay(d.toString(), donMoi.getOrDefault(d, 0L)));
        }

        YearMonth thangNay = YearMonth.from(homNay);
        YearMonth thangTruoc = thangNay.minusMonths(1);
        TongKy thang = cong(theoNgay, thangNay.atDay(1), homNay.plusDays(1));
        TongKy truoc = cong(theoNgay, thangTruoc.atDay(1), thangNay.atDay(1));

        return new ChiSo(
                so(h.doanhThu()), so(h.doanhThuCungGioTuanTruoc()), h.soDonGiao(), doanhThuTheoGio,
                h.soDonMoi(), h.soDonMoiCungGioTuanTruoc(), soDonMoiTheoNgay,
                thangNay.getMonthValue(), thang.doanhThu, thang.loiNhuan, truoc.doanhThu, truoc.loiNhuan);
    }

    DoanhThu tinhDoanhThu(KhungKy khung, LocalDate homNay, DuLieuNgay theoNgay) {
        List<Diem> diem = new ArrayList<>();
        if (khung.theoThang()) {
            YearMonth thangNay = YearMonth.from(homNay);
            for (YearMonth ym = YearMonth.from(khung.tu()); !ym.isAfter(thangNay); ym = ym.plusMonths(1)) {
                TongKy t = cong(theoNgay, ym.atDay(1), ym.plusMonths(1).atDay(1));
                diem.add(new Diem(ym.atDay(1).toString(), t.doanhThu, t.loiNhuan, t.soDon, ym.equals(thangNay)));
            }
        } else {
            for (LocalDate d = khung.tu(); !d.isAfter(homNay); d = d.plusDays(1)) {
                TongKy t = cong(theoNgay, d, d.plusDays(1));
                diem.add(new Diem(d.toString(), t.doanhThu, t.loiNhuan, t.soDon, d.equals(homNay)));
            }
        }
        TongKy ky = cong(theoNgay, khung.tu(), khung.den());
        TongKy kyTruoc = cong(theoNgay, khung.tuTruoc(), khung.denTruoc());
        int nam = homNay.getYear();
        TongKy luyKe = cong(theoNgay, LocalDate.of(nam, 1, 1), homNay.plusDays(1));
        TongKy namTruoc = cong(theoNgay, LocalDate.of(nam - 1, 1, 1), LocalDate.of(nam, 1, 1));
        return new DoanhThu(
                khung.theoThang() ? "thang" : "ngay",
                khung.tu().toString(), khung.den().minusDays(1).toString(),
                diem, ky.doanhThu, ky.loiNhuan, ky.soDon, kyTruoc.doanhThu,
                khung.theoThang() ? "cung_ky_nam_truoc" : "ky_truoc",
                nam, luyKe.doanhThu, namTruoc.doanhThu, diemKyTruoc(khung, theoNgay));
    }

    /**
     * Kỳ so sánh [tuTruoc, denTruoc) chia cùng cách với kỳ xem: 7/30 ngày liền trước theo từng ngày, cùng 12 tháng năm
     * trước theo từng tháng. Mọi điểm đều đã trọn; số điểm bằng số điểm đã trọn của kỳ xem.
     */
    static List<Diem> diemKyTruoc(KhungKy khung, DuLieuNgay theoNgay) {
        List<Diem> diem = new ArrayList<>();
        if (khung.theoThang()) {
            YearMonth den = YearMonth.from(khung.denTruoc());
            for (YearMonth ym = YearMonth.from(khung.tuTruoc()); ym.isBefore(den); ym = ym.plusMonths(1)) {
                TongKy t = cong(theoNgay, ym.atDay(1), ym.plusMonths(1).atDay(1));
                diem.add(new Diem(ym.atDay(1).toString(), t.doanhThu, t.loiNhuan, t.soDon, false));
            }
        } else {
            for (LocalDate d = khung.tuTruoc(); d.isBefore(khung.denTruoc()); d = d.plusDays(1)) {
                TongKy t = cong(theoNgay, d, d.plusDays(1));
                diem.add(new Diem(d.toString(), t.doanhThu, t.loiNhuan, t.soDon, false));
            }
        }
        return diem;
    }

    private List<DoanhThuKho> tinhDoanhThuTheoKho(KhungKy khung, Map<Integer, KhoDong> khoTheoId) {
        Map<Integer, DoanhThuKhoDong> theoKho = new HashMap<>();
        repo.doanhThuTheoKho(khung.tu().atStartOfDay(), khung.den().atStartOfDay(),
                        khung.tuTruoc().atStartOfDay(), khung.denTruoc().atStartOfDay())
                .forEach(r -> theoKho.put(r.khoId(), r));
        List<DoanhThuKho> ketQua = new ArrayList<>();
        for (KhoDong k : khoTheoId.values()) {
            DoanhThuKhoDong r = theoKho.remove(k.id());
            ketQua.add(r == null
                    ? new DoanhThuKho(k.id(), k.tenKho(), k.laKhoTong(), 0, 0, 0)
                    : new DoanhThuKho(k.id(), k.tenKho(), k.laKhoTong(), so(r.doanhThu()), r.soDon(), so(r.doanhThuKyTruoc())));
        }
        // Đơn của kho đã ngừng hoạt động vẫn là doanh thu thật: giữ để tổng các dòng khớp tổng doanh thu.
        theoKho.values().forEach(r -> ketQua.add(new DoanhThuKho(r.khoId(), "Kho đã ngừng hoạt động", false,
                so(r.doanhThu()), r.soDon(), so(r.doanhThuKyTruoc()))));
        ketQua.sort(Comparator.comparingLong(DoanhThuKho::doanhThu).reversed()
                .thenComparing(DoanhThuKho::laKhoTong, Comparator.reverseOrder())
                .thenComparing(DoanhThuKho::khoId));
        return ketQua;
    }

    private List<Kenh> tinhTheoKenh(KhungKy khung, Integer khoId) {
        return repo.doanhThuTheoKenh(khung.tu().atStartOfDay(), khung.den().atStartOfDay(), khoId).stream()
                .map(r -> new Kenh(r.maKenh(), tenKenh(r.maKenh(), r.tenKenh()),
                        so(r.doanhThu()), r.soDon(), r.soDonHoan()))
                .toList();
    }

    static String tenKenh(String maKenh, String tenTrongCsdl) {
        if (TongQuanAdminRepository.MA_KENH_POS.equals(maKenh)) return "Bán tại quầy";
        if (TongQuanAdminRepository.MA_KENH_TRUC_TIEP.equals(maKenh)) return "Đơn bán trực tiếp";
        return tenTrongCsdl != null && !tenTrongCsdl.isBlank() ? tenTrongCsdl : maKenh;
    }

    private TonKho tinhTonKho(TonKhoTongHopDong t, Integer khoId, Map<Integer, KhoDong> khoTheoId,
                              int nguong, int heSoDu, int soNgayChamBan, LocalDate homNay) {
        Map<Integer, TonKhoTheoKhoDong> theoKhoDong = new HashMap<>();
        repo.tonKhoTheoKho().forEach(r -> theoKhoDong.put(r.khoId(), r));
        List<TonKhoKho> theoKho = new ArrayList<>();
        for (KhoDong k : khoTheoId.values()) {
            TonKhoTheoKhoDong r = theoKhoDong.get(k.id());
            theoKho.add(r == null
                    ? new TonKhoKho(k.id(), k.tenKho(), k.laKhoTong(), 0, 0, 0)
                    : new TonKhoKho(k.id(), k.tenKho(), k.laKhoTong(), so(r.tonThucTe()), so(r.khaDung()), so(r.giaTri())));
        }
        theoKho.sort(Comparator.comparingLong(TonKhoKho::giaTri).reversed().thenComparing(TonKhoKho::khoId));
        // Số phụ: lỗi thì để null, không làm hỏng cả khối Tồn kho
        Long duChamBan = t.duHang() == 0 ? Long.valueOf(0) : phu("duChamBan",
                () -> repo.demDuChamBan(khoId, nguong, heSoDu, homNay.minusDays(soNgayChamBan).atStartOfDay()));
        return new TonKho(
                so(t.tonThucTe()), so(t.dangGiu()), so(t.khaDung()), so(t.giaTri()),
                t.soBienThe(), t.soDong(), t.hetHang(), t.thieuHang(), t.binhThuong(), t.duHang(),
                so(repo.hangDangVe(khoId)), so(repo.hangDangChuyen(khoId)), nguong, heSoDu, theoKho,
                so(t.giaTriDu()), duChamBan, soNgayChamBan);
    }

    private ViecCanXuLy tinhViecCanXuLy(Integer khoId, TonKhoTongHopDong ton, LocalDate homNay) {
        TongQuanAdminRepository.ViecCanXuLyDong v = repo.viecCanXuLy(khoId, homNay.atStartOfDay());
        List<ViecTheoKho> theoKho = khoId != null ? null : repo.viecTheoKho().stream()
                .map(r -> new ViecTheoKho(r.khoId(), r.tenKho(), r.donChoXuatKho(), r.phieuNhatChuaPhanCong(),
                        r.phieuChuyenChoDuyet(), r.phieuChuyenChoXuatHang()))
                .toList();
        return new ViecCanXuLy(
                v.donNhapChuaGuiKho(), v.donChoXuatKho(), v.phieuNhatChuaPhanCong(), v.phieuXuatChoXuatKho(),
                v.yeuCauNhapChoDuyet(), v.phieuNhapChoNhapKho(), v.phieuChuyenChoDuyet(), v.phieuChuyenChoXuatHang(),
                v.dotKiemKeDangMo(),
                ton == null ? null : ton.hetHang(),
                ton == null ? null : ton.thieuHang(),
                v.taiKhoanBiKhoa(),
                theoKho,
                v.donMuaQuaHan(),
                phu("loiDongBo", () -> repo.loiDongBoTheoKenh().stream()
                        .map(r -> new LoiDongBoKenh(r.kenhId(), r.maKenh(), tenKenh(r.maKenh(), r.tenKenh()), r.soLoi()))
                        .toList()),
                v.phieuChuyenChoXuLyLech());
    }

    private NhapXuat tinhNhapXuat(KhungKy khung, LocalDate homNay, Integer khoId) {
        Map<LocalDate, NhapXuatNgay> theoNgay = new HashMap<>();
        repo.nhapXuatTheoNgay(khung.tu().atStartOfDay(), homNay.plusDays(1).atStartOfDay(), khoId)
                .forEach(r -> theoNgay.put(r.ngay(), r));
        List<DiemNhapXuat> diem = new ArrayList<>();
        if (khung.theoThang()) {
            YearMonth thangNay = YearMonth.from(homNay);
            for (YearMonth ym = YearMonth.from(khung.tu()); !ym.isAfter(thangNay); ym = ym.plusMonths(1)) {
                long[] t = congNhapXuat(theoNgay, ym.atDay(1), ym.plusMonths(1).atDay(1));
                diem.add(new DiemNhapXuat(ym.atDay(1).toString(), t[0], t[1], ym.equals(thangNay)));
            }
        } else {
            for (LocalDate d = khung.tu(); !d.isAfter(homNay); d = d.plusDays(1)) {
                NhapXuatNgay r = theoNgay.get(d);
                diem.add(new DiemNhapXuat(d.toString(), r == null ? 0 : so(r.nhap()), r == null ? 0 : so(r.xuat()),
                        d.equals(homNay)));
            }
        }
        long[] tong = congNhapXuat(theoNgay, khung.tu(), khung.den());
        return new NhapXuat(khung.theoThang() ? "thang" : "ngay", diem, tong[0], tong[1], khoId == null);
    }

    private List<SanPhamBanChay> tinhSanPhamBanChay(KhungKy khung, Integer khoId) {
        List<SanPhamBanChayDong> dong = repo.sanPhamBanChay(khung.tu().atStartOfDay(), khung.den().atStartOfDay(),
                khoId, SO_SAN_PHAM_BAN_CHAY);
        Map<Integer, BigDecimal> khaDung = repo.khaDungTheoSanPham(
                dong.stream().map(SanPhamBanChayDong::sanPhamId).toList(), khoId);
        int soNgay = khung.soNgay();
        return dong.stream()
                .map(r -> new SanPhamBanChay(r.sanPhamId(), r.maSanPham(), r.tenSanPham(), so(r.soLuong()),
                        so(r.doanhThu()), so(khaDung.get(r.sanPhamId())), soNgay))
                .toList();
    }

    /**
     * Số Kho tổng có thể chuyển lấy từ KhaDungChuyenKhoService, cùng phép kiểm khi tạo yêu cầu chuyển kho, nên số điền
     * sẵn ở nút "Chuyển … từ Kho tổng" luôn tạo được phiếu (trừ khi số liệu đổi giữa lúc xem và lúc bấm).
     */
    HangCanBoSung tinhHangCanBoSung(Integer khoId, int nguong, TonKhoTongHopDong ton,
                                    Map<Integer, KhoDong> khoTheoId) {
        KhoDong khoTong = khoTheoId.values().stream().filter(KhoDong::laKhoTong).findFirst().orElse(null);
        List<HangCanBoSungNhomDong> dong = repo.hangCanBoSungTheoNhom(khoId, nguong, SO_NHOM_BO_SUNG);
        Map<Integer, KhaDungChuyen> khoTongCoTheChuyen = khoTong == null ? Map.of()
                : khaDungChuyenKhoService.theoBienThe(khoTong.id(), dong.stream()
                        .filter(r -> !r.khoId().equals(khoTong.id()))
                        .map(HangCanBoSungNhomDong::bienTheId)
                        .distinct()
                        .toList());
        List<DongBoSung> ketQua = new ArrayList<>();
        // Truy vấn đã xếp các mã của một nhóm liền nhau, nhóm tệ nhất trước: gom theo thứ tự gặp
        Map<String, List<DongBoSung>> theoNhom = new LinkedHashMap<>();
        Map<String, HangCanBoSungNhomDong> dauNhom = new HashMap<>();
        // Đếm Hết hàng trên số thập phân gốc như SQL (khả dụng 0,4 là Thiếu hàng), không trên số đã làm tròn
        Map<String, Integer> soHetTheoNhom = new HashMap<>();
        for (HangCanBoSungNhomDong r : dong) {
            KhoDong kho = khoTheoId.get(r.khoId());
            boolean laKhoTong = kho != null && kho.laKhoTong();
            long khaDung = so(r.khaDung());
            KhaDungChuyen kt = laKhoTong ? null : khoTongCoTheChuyen.get(r.bienTheId());
            // Làm tròn xuống: với N nguyên, so sánh phần nguyên khớp phép so số thập phân khi tạo phiếu
            Long khaDungKhoTong = kt == null ? null : kt.khaDung().setScale(0, RoundingMode.FLOOR).longValue();
            Long choXuatKhoTong = kt == null ? null : so(kt.choXuat());
            long canBoSung = soLuongDeXuat(khaDung, r.nguong());
            String deXuat = deXuat(laKhoTong, khaDungKhoTong, canBoSung);
            DongBoSung d = new DongBoSung(r.bienTheId(), r.maSku(), r.tenSanPham(), r.tenMau(), r.tenKichCo(),
                    r.khoId(), kho != null ? kho.tenKho() : null, laKhoTong, khaDung, r.nguong(),
                    khaDungKhoTong, choXuatKhoTong, deXuat, canBoSung);
            ketQua.add(d);
            String khoa = r.sanPhamId() + "-" + r.khoId();
            theoNhom.computeIfAbsent(khoa, k -> new ArrayList<>()).add(d);
            dauNhom.putIfAbsent(khoa, r);
            if (r.khaDung() == null || r.khaDung().signum() <= 0) soHetTheoNhom.merge(khoa, 1, Integer::sum);
        }
        List<NhomBoSung> nhom = new ArrayList<>();
        theoNhom.forEach((khoa, ds) -> {
            HangCanBoSungNhomDong r = dauNhom.get(khoa);
            DongBoSung dau = ds.get(0);
            int soHet = soHetTheoNhom.getOrDefault(khoa, 0);
            nhom.add(new NhomBoSung(r.sanPhamId(), r.tenSanPham(), r.khoId(), dau.tenKho(), dau.laKhoTong(),
                    soHet, ds.size() - soHet, List.copyOf(ds)));
        });
        long tongSo = ton != null ? ton.hetHang() + ton.thieuHang() : ketQua.size();
        return new HangCanBoSung(tongSo, khoTong != null, ketQua, nhom);
    }

    /** Đưa khả dụng về gấp đôi ngưỡng tối thiểu (tạm thời, khi chưa có mức tồn tối đa cho từng mã). */
    static long soLuongDeXuat(long khaDung, int nguong) {
        return Math.max(1, 2L * nguong - khaDung);
    }

    /**
     * Quy tắc nhập hàng (SRS 3.3): chỉ Kho tổng nhập từ nhà cung cấp; cửa hàng được bổ sung bằng chuyển kho
     * từ Kho tổng khi Kho tổng còn đủ khả dụng, nếu không thì nhập về Kho tổng.
     */
    static String deXuat(boolean laKhoTong, Long khaDungKhoTong, long canBoSung) {
        if (!laKhoTong && khaDungKhoTong != null && khaDungKhoTong >= canBoSung) return "chuyen_kho";
        return "yeu_cau_nhap";
    }

    private List<HoatDong> tinhHoatDong(Integer khoId) {
        return repo.hoatDongGanDay(khoId, SO_HOAT_DONG).stream()
                .map(r -> new HoatDong(r.loai(), r.id(), r.maChungTu(), r.thoiGian().format(DINH_DANG_THOI_DIEM),
                        r.tenKho(), r.nguoiThucHien(),
                        r.soLuong() == null ? null : so(r.soLuong()),
                        r.doiTac(),
                        r.soTien() == null ? null : so(r.soTien())))
                .toList();
    }

    /* ======================================================================
     * TIỆN ÍCH
     * ====================================================================== */

    /** Doanh thu và giá vốn theo ngày ghi nhận. */
    static final class DuLieuNgay {
        final Map<LocalDate, DoanhThuNgay> doanhThu = new HashMap<>();
        final Map<LocalDate, BigDecimal> giaVon = new HashMap<>();
    }

    private static final class TongKy {
        long doanhThu;
        long loiNhuan;
        long soDon;
    }

    /** Cộng các ngày trong [tu, den); lợi nhuận gộp = doanh thu − giá vốn. */
    static TongKy cong(DuLieuNgay theoNgay, LocalDate tu, LocalDate den) {
        BigDecimal dt = BigDecimal.ZERO;
        BigDecimal gv = BigDecimal.ZERO;
        long sd = 0;
        for (Map.Entry<LocalDate, DoanhThuNgay> e : theoNgay.doanhThu.entrySet()) {
            LocalDate d = e.getKey();
            if (!d.isBefore(tu) && d.isBefore(den)) {
                dt = dt.add(e.getValue().doanhThu());
                sd += e.getValue().soDon();
            }
        }
        for (Map.Entry<LocalDate, BigDecimal> e : theoNgay.giaVon.entrySet()) {
            LocalDate d = e.getKey();
            if (!d.isBefore(tu) && d.isBefore(den)) gv = gv.add(e.getValue());
        }
        TongKy t = new TongKy();
        t.doanhThu = so(dt);
        t.loiNhuan = so(dt.subtract(gv));
        t.soDon = sd;
        return t;
    }

    private static long[] congNhapXuat(Map<LocalDate, NhapXuatNgay> theoNgay, LocalDate tu, LocalDate den) {
        BigDecimal nhap = BigDecimal.ZERO;
        BigDecimal xuat = BigDecimal.ZERO;
        for (Map.Entry<LocalDate, NhapXuatNgay> e : theoNgay.entrySet()) {
            if (!e.getKey().isBefore(tu) && e.getKey().isBefore(den)) {
                nhap = nhap.add(e.getValue().nhap());
                xuat = xuat.add(e.getValue().xuat());
            }
        }
        return new long[]{so(nhap), so(xuat)};
    }

    static long so(BigDecimal v) {
        return v == null ? 0L : v.setScale(0, RoundingMode.HALF_UP).longValue();
    }

    private static int macDinhNeuKhongHopLe(Integer giaTri, int macDinh) {
        return giaTri != null && giaTri > 0 ? giaTri : macDinh;
    }

    private static LocalDate minNgay(LocalDate... ngay) {
        LocalDate min = ngay[0];
        for (LocalDate d : ngay) if (d.isBefore(min)) min = d;
        return min;
    }

    private static <T> T batBuoc(T giaTri) {
        if (giaTri == null) throw new IllegalStateException("Thiếu dữ liệu doanh thu theo ngày");
        return giaTri;
    }

    /** Số phụ trong một khối: lỗi thì ghi log và trả null, khối vẫn hiển thị phần còn lại. */
    private <T> T phu(String ten, Supplier<T> viec) {
        try {
            return viec.get();
        } catch (RuntimeException e) {
            log.warn("Tổng quan quản trị: không tính được {}", ten, e);
            return null;
        }
    }

    /** Chạy một khối; lỗi thì ghi log, đánh dấu khối lỗi và trả null để các khối khác vẫn hiển thị. */
    private <T> T chay(String khoi, List<String> khoiLoi, Supplier<T> viec) {
        try {
            return viec.get();
        } catch (RuntimeException e) {
            log.error("Tổng quan quản trị: không tải được khối {}", khoi, e);
            if (!khoiLoi.contains(khoi)) khoiLoi.add(khoi);
            return null;
        }
    }
}
