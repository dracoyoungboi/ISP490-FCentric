package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.BaoCaoSanPhamDTO;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BaoCaoSanPhamRepository;
import com.dev.backend.repository.BaoCaoSanPhamRepository.PhamVi;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.dev.backend.i18n.ThongDiep;

/**
 * Báo cáo sản phẩm (màn /reports/products và tệp Excel). Quyền xem như Báo cáo doanh thu: quản trị viên mọi kho, quản lý
 * kho chỉ các kho mình phụ trách (DoanhThuReportService.phamVi).
 * Quy ước:
 * - Kỳ: [tuNgay, denNgay], tối đa 1 năm, cắt tới hôm nay. Kỳ trước = khoảng liền trước, cùng số ngày.
 * - Hạng: theo số lượng bán (bằng nhau thì doanh thu, rồi mã sản phẩm). Nhóm A/B/C theo doanh thu cộng dồn: A tới 80%,
 *   B tới 95%, C phần còn lại.
 * - Đủ bán (ngày) = khả dụng / (số bán / số ngày của kỳ).
 * - Tình trạng: HET_HANG (khả dụng 0), BAN_CHAY_SAP_HET (có bán, đủ bán < 14 ngày), DU_HANG (có bán, đủ bán > 90 ngày),
 *   KHONG_BAN (còn hàng, không bán, hàng về kho lần đầu trước kỳ), BINH_THUONG (còn lại). Đủ bán và tình trạng tính trên
 *   số bán mọi kênh (lọc kênh chỉ đổi cột số bán, doanh thu).
 */
@Service
@RequiredArgsConstructor
public class BaoCaoSanPhamService {

    static final int SAP_HET_DUOI_NGAY = 14;
    static final int DU_HANG_TREN_NGAY = 90;
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final BaoCaoSanPhamRepository repo;
    private final XuatBaoCaoService xuatBaoCaoService;

    /** Ngày đầu, ngày cuối (đã cắt tới hôm nay), kỳ trước và số ngày của kỳ. */
    record Ky(LocalDate tu, LocalDate den, LocalDate tuTruoc, LocalDate denTruoc, int soNgay) {
    }

    static Ky ky(LocalDate tuNgay, LocalDate denNgay, LocalDate homNay) {
        // Báo cáo này không có chế độ xem theo tháng: báo riêng giới hạn 1 năm (câu của Báo cáo doanh thu nhắc "xem theo tháng")
        if (tuNgay != null && denNgay != null && !tuNgay.isAfter(denNgay) && !denNgay.isBefore(tuNgay.plusYears(1))) {
            throw new CommonException(ThongDiep.of("khoVanHanh.moiLanXemToiDaMotNam"));
        }
        DoanhThuReportService.kiemKhoangNgay(tuNgay, denNgay);
        if (tuNgay.isAfter(homNay)) throw new CommonException(ThongDiep.of("khoVanHanh.kyBaoCaoChuaBatDau"));
        LocalDate den = denNgay.isAfter(homNay) ? homNay : denNgay;
        int soNgay = (int) ChronoUnit.DAYS.between(tuNgay, den) + 1;
        LocalDate denTruoc = tuNgay.minusDays(1);
        return new Ky(tuNgay, den, denTruoc.minusDays(soNgay - 1L), denTruoc, soNgay);
    }

    static String chuanKenh(String kenh) {
        if (kenh == null || kenh.isBlank() || "tat-ca".equalsIgnoreCase(kenh)) return null;
        String k = kenh.trim().toUpperCase();
        if (k.equals("POS") || k.equals("TRUC_TIEP")) return k;
        // Id kênh bán: chỉ chữ số, nằm trong khoảng int (số quá dài báo lỗi rõ thay vì lỗi 500)
        if (!k.isEmpty() && k.length() <= 9 && k.chars().allMatch(Character::isDigit)) return k;
        throw new CommonException(ThongDiep.of("khoVanHanh.kenhBanKhongHopLe"));
    }

    public BaoCaoSanPhamDTO layBaoCao(LocalDate tuNgay, LocalDate denNgay, Integer khoId, String kenh) {
        DoanhThuReportService.PhamVi quyen = DoanhThuReportService.phamVi(khoId);
        PhamVi pv = new PhamVi(quyen.tatCaKho(), quyen.khoIds(), chuanKenh(kenh));
        Ky k = ky(tuNgay, denNgay, LocalDate.now(VN));

        Map<Integer, BaoCaoSanPhamRepository.BanBienThe> ban = theo(repo.banTheoBienThe(pv, k.tu(), k.den()), BaoCaoSanPhamRepository.BanBienThe::bienTheId);
        Map<Integer, BaoCaoSanPhamRepository.BanBienThe> banTruoc = theo(repo.banTheoBienThe(pv, k.tuTruoc(), k.denTruoc()), BaoCaoSanPhamRepository.BanBienThe::bienTheId);
        Map<Integer, BigDecimal> hoanBt = repo.hoanTheoBienThe(pv, k.tu(), k.den()).stream()
                .collect(Collectors.toMap(BaoCaoSanPhamRepository.GiaVonBienThe::bienTheId, BaoCaoSanPhamRepository.GiaVonBienThe::giaVon, BigDecimal::add));
        BigDecimal tongHoanTruoc = repo.hoanTheoBienThe(pv, k.tuTruoc(), k.denTruoc()).stream()
                .map(BaoCaoSanPhamRepository.GiaVonBienThe::giaVon).reduce(BigDecimal.ZERO, BigDecimal::add);
        // Đủ bán và tình trạng là chuyện tồn kho chung mọi kênh: đang lọc một kênh thì vẫn tính trên số bán của mọi kênh
        PhamVi pvMoiKenh = new PhamVi(pv.tatCaKho(), pv.khoIds(), null);
        Map<Integer, BaoCaoSanPhamRepository.BanBienThe> banMoiKenh = pv.kenh() == null ? ban
                : theo(repo.banTheoBienThe(pvMoiKenh, k.tu(), k.den()), BaoCaoSanPhamRepository.BanBienThe::bienTheId);
        Map<Integer, String> anh = repo.anhTheoSanPham();
        Map<Integer, BigDecimal> gv = repo.giaVonTheoBienThe(pv, k.tu(), k.den()).stream()
                .collect(Collectors.toMap(BaoCaoSanPhamRepository.GiaVonBienThe::bienTheId, BaoCaoSanPhamRepository.GiaVonBienThe::giaVon, BigDecimal::add));
        Map<Integer, BigDecimal> gvTruoc = repo.giaVonTheoBienThe(pv, k.tuTruoc(), k.denTruoc()).stream()
                .collect(Collectors.toMap(BaoCaoSanPhamRepository.GiaVonBienThe::bienTheId, BaoCaoSanPhamRepository.GiaVonBienThe::giaVon, BigDecimal::add));
        Map<Integer, BaoCaoSanPhamRepository.TonBienThe> ton = theo(repo.tonTheoBienThe(pv), BaoCaoSanPhamRepository.TonBienThe::bienTheId);
        Map<Integer, BigDecimal> dangVe = repo.dangVeTheoBienThe(pv).stream()
                .collect(Collectors.toMap(BaoCaoSanPhamRepository.DangVeBienThe::bienTheId, BaoCaoSanPhamRepository.DangVeBienThe::dangVe, BigDecimal::add));
        Map<Integer, Long> soDon = repo.soDonTheoSanPham(pv, k.tu(), k.den()).stream()
                .collect(Collectors.toMap(BaoCaoSanPhamRepository.SoDonSanPham::sanPhamId, BaoCaoSanPhamRepository.SoDonSanPham::soDon, Long::sum));
        Map<Integer, LocalDate> banCuoi = repo.ngayBanCuoi(pv, k.den()).stream()
                .collect(Collectors.toMap(BaoCaoSanPhamRepository.NgaySanPham::sanPhamId, BaoCaoSanPhamRepository.NgaySanPham::ngay, (a, b) -> a.isAfter(b) ? a : b));
        Map<Integer, LocalDate> nhapDau = new HashMap<>();
        repo.ngayNhapDau(pv).forEach(n -> { if (n.ngay() != null) nhapDau.merge(n.sanPhamId(), n.ngay(), (a, b) -> a.isBefore(b) ? a : b); });
        List<BaoCaoSanPhamRepository.BanNgay> dsNgay = repo.banTheoNgay(pv, k.tu(), k.den());
        Map<Integer, List<BaoCaoSanPhamRepository.BanNgay>> ngay = dsNgay.stream()
                .collect(Collectors.groupingBy(BaoCaoSanPhamRepository.BanNgay::sanPhamId));
        Map<Integer, List<BaoCaoSanPhamRepository.BanKenh>> kenhSp = repo.banTheoKenh(pv, k.tu(), k.den()).stream()
                .collect(Collectors.groupingBy(BaoCaoSanPhamRepository.BanKenh::sanPhamId));

        // Gom biến thể theo sản phẩm (giữ thứ tự màu, size của câu truy vấn)
        Map<Integer, List<BaoCaoSanPhamRepository.BienTheDong>> theoSp = new LinkedHashMap<>();
        for (BaoCaoSanPhamRepository.BienTheDong b : repo.bienThe()) theoSp.computeIfAbsent(b.sanPhamId(), x -> new ArrayList<>()).add(b);

        List<BaoCaoSanPhamDTO.SanPham> ds = new ArrayList<>();
        BigDecimal tongGvTruoc = BigDecimal.ZERO;
        BigDecimal soNgay = BigDecimal.valueOf(k.soNgay());
        for (List<BaoCaoSanPhamRepository.BienTheDong> dsBt : theoSp.values()) {
            BaoCaoSanPhamRepository.BienTheDong dau = dsBt.get(0);
            List<BaoCaoSanPhamDTO.BienThe> bts = new ArrayList<>();
            BigDecimal sl = BigDecimal.ZERO, slT = BigDecimal.ZERO, dt = BigDecimal.ZERO, dtT = BigDecimal.ZERO, g = BigDecimal.ZERO,
                    hoan = BigDecimal.ZERO, kd = BigDecimal.ZERO, ve = BigDecimal.ZERO, giaTri = BigDecimal.ZERO, slMoiKenh = BigDecimal.ZERO;
            for (BaoCaoSanPhamRepository.BienTheDong b : dsBt) {
                var x = ban.get(b.bienTheId());
                var xt = banTruoc.get(b.bienTheId());
                var t = ton.get(b.bienTheId());
                BigDecimal bSl = x == null ? BigDecimal.ZERO : x.soLuong();
                BigDecimal bDt = x == null ? BigDecimal.ZERO : x.doanhThu();
                BigDecimal bHoan = hoanBt.getOrDefault(b.bienTheId(), BigDecimal.ZERO);
                var xm = banMoiKenh.get(b.bienTheId());
                if (xm != null) slMoiKenh = slMoiKenh.add(xm.soLuong());
                BigDecimal bGv = gv.getOrDefault(b.bienTheId(), BigDecimal.ZERO);
                BigDecimal bKd = t == null ? BigDecimal.ZERO : t.khaDung().max(BigDecimal.ZERO);
                BigDecimal bVe = dangVe.getOrDefault(b.bienTheId(), BigDecimal.ZERO);
                sl = sl.add(bSl);
                dt = dt.add(bDt);
                hoan = hoan.add(bHoan);
                g = g.add(bGv);
                kd = kd.add(bKd);
                ve = ve.add(bVe);
                giaTri = giaTri.add(t == null ? BigDecimal.ZERO : t.giaTri().max(BigDecimal.ZERO));
                if (xt != null) {
                    slT = slT.add(xt.soLuong());
                    dtT = dtT.add(xt.doanhThu());
                }
                tongGvTruoc = tongGvTruoc.add(gvTruoc.getOrDefault(b.bienTheId(), BigDecimal.ZERO));
                // Biến thể đã ngừng mà không còn hàng, không phát sinh: bỏ khỏi ma trận cho gọn
                boolean coPhatSinh = bSl.signum() != 0 || bHoan.signum() != 0 || bKd.signum() != 0 || bVe.signum() != 0;
                if (coPhatSinh || !Integer.valueOf(0).equals(b.trangThaiBienThe())) {
                    bts.add(BaoCaoSanPhamDTO.BienThe.builder()
                            .id(b.bienTheId()).maSku(b.maSku()).mau(b.tenMau()).maMauHex(b.maMauHex()).size(b.tenSize())
                            .thuTuSize(b.thuTuSize()).giaBan(b.giaBan()).soLuong(bSl).doanhThu(bDt).giaVon(bGv)
                            .soLuongHoan(bHoan).khaDung(bKd).dangVe(bVe).build());
                }
            }
            boolean coBan = sl.signum() > 0 || slT.signum() > 0 || hoan.signum() > 0;
            // Ngừng hoạt động (2) mà không phát sinh trong hai kỳ thì không hiện
            if (Integer.valueOf(2).equals(dau.trangThai()) && !coBan) continue;
            int spId = dau.sanPhamId();
            List<BigDecimal> chuoi = new ArrayList<>();
            if (sl.signum() > 0) {
                Map<LocalDate, BigDecimal> m = new HashMap<>();
                ngay.getOrDefault(spId, List.of()).forEach(n -> m.merge(n.ngay(), n.soLuong(), BigDecimal::add));
                for (LocalDate d = k.tu(); !d.isAfter(k.den()); d = d.plusDays(1)) chuoi.add(m.getOrDefault(d, BigDecimal.ZERO));
            }
            List<BaoCaoSanPhamDTO.TyTrong> kenhDs = kenhSp.getOrDefault(spId, List.of()).stream()
                    .map(x -> BaoCaoSanPhamDTO.TyTrong.builder().ten(x.tenKenh()).soLuong(x.soLuong()).doanhThu(x.doanhThu()).build())
                    .sorted(Comparator.comparing(BaoCaoSanPhamDTO.TyTrong::getSoLuong).reversed()).toList();
            BigDecimal duBan = slMoiKenh.signum() > 0 ? kd.multiply(soNgay).divide(slMoiKenh, 1, RoundingMode.HALF_UP) : null;
            LocalDate nd = nhapDau.get(spId);
            ds.add(BaoCaoSanPhamDTO.SanPham.builder()
                    .id(spId).maSanPham(dau.maSanPham()).tenSanPham(dau.tenSanPham()).anh(anh.get(dau.sanPhamId()))
                    .danhMuc(rongThi(dau.danhMuc(), "Chưa phân loại")).thuongHieu(rongThi(dau.thuongHieu(), "Chưa gắn"))
                    .donViTinh(rongThi(dau.donViTinh(), "Cái")).trangThai(dau.trangThai())
                    .soLuong(sl).soLuongTruoc(slT).doanhThu(dt).doanhThuTruoc(dtT).giaVon(g).loiNhuan(dt.subtract(g))
                    .soLuongHoan(hoan).soDon(soDon.getOrDefault(spId, 0L))
                    .khaDung(kd).dangVe(ve).giaTriTon(giaTri.setScale(0, RoundingMode.HALF_UP)).duBanNgay(duBan)
                    .tinhTrang(tinhTrang(slMoiKenh, kd, duBan, nd, k.tu()))
                    .ngayBanCuoi(banCuoi.get(spId)).ngayNhapDau(nd)
                    .theoNgay(chuoi).theoKenh(kenhDs).bienThe(bts)
                    .build());
        }

        xepHang(ds);
        BaoCaoSanPhamDTO.Tong tong = tong(ds, tongGvTruoc, tongHoanTruoc, repo.tongSoDon(pv, k.tu(), k.den()));
        tong.setSoDonTruoc(repo.tongSoDon(pv, k.tuTruoc(), k.denTruoc()));
        tong.setSoSanPhamCoBanTruoc((int) ds.stream().filter(p -> p.getSoLuongTruoc().signum() > 0).count());
        Map<LocalDate, BigDecimal[]> moiNgay = new HashMap<>();
        dsNgay.forEach(n -> {
            BigDecimal[] a = moiNgay.computeIfAbsent(n.ngay(), d -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            a[0] = a[0].add(n.soLuong());
            a[1] = a[1].add(n.doanhThu());
        });
        List<BaoCaoSanPhamDTO.Ngay> theoNgay = new ArrayList<>();
        for (LocalDate d = k.tu(); !d.isAfter(k.den()); d = d.plusDays(1)) {
            BigDecimal[] a = moiNgay.get(d);
            theoNgay.add(new BaoCaoSanPhamDTO.Ngay(d, a == null ? BigDecimal.ZERO : a[0], a == null ? BigDecimal.ZERO : a[1]));
        }
        List<BaoCaoSanPhamDTO.Kenh> dsKenh = new ArrayList<>();
        dsKenh.add(new BaoCaoSanPhamDTO.Kenh("POS", "Bán tại quầy"));
        repo.kenhBan().forEach(x -> dsKenh.add(new BaoCaoSanPhamDTO.Kenh(String.valueOf(x.id()), x.ten())));
        dsKenh.add(new BaoCaoSanPhamDTO.Kenh("TRUC_TIEP", "Đơn bán trực tiếp"));
        BaoCaoSanPhamDTO kq = BaoCaoSanPhamDTO.builder()
                .tuNgay(k.tu()).denNgay(k.den()).tuNgayTruoc(k.tuTruoc()).denNgayTruoc(k.denTruoc()).soNgay(k.soNgay())
                .theoKhoPhuTrach(quyen.theoKhoPhuTrach()).tong(tong).dsKenh(dsKenh).sanPham(ds).theoNgay(theoNgay)
                .coGiaVon(true).build();
        if (!DoanhThuReportService.xemGiaVon()) anGiaVon(kq);
        return kq;
    }

    /** Nhân viên bán hàng: bỏ giá vốn, lợi nhuận gộp, giá trị tồn khỏi báo cáo (máy chủ không gửi). */
    static void anGiaVon(BaoCaoSanPhamDTO bc) {
        bc.setCoGiaVon(false);
        BaoCaoSanPhamDTO.Tong t = bc.getTong();
        if (t != null) {
            t.setGiaVon(null);
            t.setGiaVonTruoc(null);
            t.setLoiNhuan(null);
            t.setLoiNhuanTruoc(null);
        }
        if (bc.getSanPham() == null) return;
        for (BaoCaoSanPhamDTO.SanPham p : bc.getSanPham()) {
            p.setGiaVon(null);
            p.setLoiNhuan(null);
            p.setGiaTriTon(null);
            if (p.getBienThe() != null) p.getBienThe().forEach(b -> b.setGiaVon(null));
        }
    }

    static String tinhTrang(BigDecimal sl, BigDecimal kd, BigDecimal duBan, LocalDate nhapDau, LocalDate tuKy) {
        // Khả dụng 0: hết hàng, kể cả mã đang bán chạy (màn đưa mã có bán mà hết vào tab Sắp hết hàng)
        if (kd.signum() <= 0) return "HET_HANG";
        if (sl.signum() > 0) {
            if (duBan.compareTo(BigDecimal.valueOf(SAP_HET_DUOI_NGAY)) < 0) return "BAN_CHAY_SAP_HET";
            if (duBan.compareTo(BigDecimal.valueOf(DU_HANG_TREN_NGAY)) > 0) return "DU_HANG";
            return "BINH_THUONG";
        }
        // Hàng về kho lần đầu trong kỳ: chưa kịp bán, không gọi là không bán
        if (nhapDau != null && !nhapDau.isBefore(tuKy)) return "BINH_THUONG";
        return "KHONG_BAN";
    }

    /** Hạng kỳ này và kỳ trước theo số lượng; nhóm A/B/C theo doanh thu cộng dồn. Danh sách xếp theo hạng. */
    static void xepHang(List<BaoCaoSanPhamDTO.SanPham> ds) {
        Comparator<BaoCaoSanPhamDTO.SanPham> theoMa = Comparator.comparing(p -> String.valueOf(p.getMaSanPham()));
        List<BaoCaoSanPhamDTO.SanPham> coBan = ds.stream().filter(p -> p.getSoLuong().signum() > 0)
                .sorted(Comparator.comparing(BaoCaoSanPhamDTO.SanPham::getSoLuong).reversed()
                        .thenComparing(Comparator.comparing(BaoCaoSanPhamDTO.SanPham::getDoanhThu).reversed()).thenComparing(theoMa)).toList();
        for (int i = 0; i < coBan.size(); i++) coBan.get(i).setHang(i + 1);
        List<BaoCaoSanPhamDTO.SanPham> coBanTruoc = ds.stream().filter(p -> p.getSoLuongTruoc().signum() > 0)
                .sorted(Comparator.comparing(BaoCaoSanPhamDTO.SanPham::getSoLuongTruoc).reversed()
                        .thenComparing(Comparator.comparing(BaoCaoSanPhamDTO.SanPham::getDoanhThuTruoc).reversed()).thenComparing(theoMa)).toList();
        for (int i = 0; i < coBanTruoc.size(); i++) coBanTruoc.get(i).setHangTruoc(i + 1);

        BigDecimal tongDt = ds.stream().map(BaoCaoSanPhamDTO.SanPham::getDoanhThu).filter(x -> x.signum() > 0).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (tongDt.signum() > 0) {
            BigDecimal lk = BigDecimal.ZERO;
            List<BaoCaoSanPhamDTO.SanPham> theoDt = ds.stream().filter(p -> p.getDoanhThu().signum() > 0)
                    .sorted(Comparator.comparing(BaoCaoSanPhamDTO.SanPham::getDoanhThu).reversed().thenComparing(theoMa)).toList();
            for (BaoCaoSanPhamDTO.SanPham p : theoDt) {
                BigDecimal truoc = lk.divide(tongDt, 6, RoundingMode.HALF_UP);
                p.setNhomAbc(truoc.compareTo(new BigDecimal("0.8")) < 0 ? "A" : truoc.compareTo(new BigDecimal("0.95")) < 0 ? "B" : "C");
                lk = lk.add(p.getDoanhThu());
            }
        }
        ds.sort(Comparator.comparing((BaoCaoSanPhamDTO.SanPham p) -> p.getHang() == null ? Integer.MAX_VALUE : p.getHang())
                .thenComparing(Comparator.comparing(BaoCaoSanPhamDTO.SanPham::getGiaTriTon).reversed()).thenComparing(theoMa));
    }

    private static BaoCaoSanPhamDTO.Tong tong(List<BaoCaoSanPhamDTO.SanPham> ds, BigDecimal gvTruoc, BigDecimal hoanTruoc, long soDon) {
        Function<Function<BaoCaoSanPhamDTO.SanPham, BigDecimal>, BigDecimal> cong =
                f -> ds.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal dt = cong.apply(BaoCaoSanPhamDTO.SanPham::getDoanhThu);
        BigDecimal dtT = cong.apply(BaoCaoSanPhamDTO.SanPham::getDoanhThuTruoc);
        BigDecimal g = cong.apply(BaoCaoSanPhamDTO.SanPham::getGiaVon);
        return BaoCaoSanPhamDTO.Tong.builder()
                .soLuong(cong.apply(BaoCaoSanPhamDTO.SanPham::getSoLuong))
                .soLuongTruoc(cong.apply(BaoCaoSanPhamDTO.SanPham::getSoLuongTruoc))
                .doanhThu(dt).doanhThuTruoc(dtT).giaVon(g).giaVonTruoc(gvTruoc)
                .loiNhuan(dt.subtract(g)).loiNhuanTruoc(dtT.subtract(gvTruoc))
                .soLuongHoan(cong.apply(BaoCaoSanPhamDTO.SanPham::getSoLuongHoan))
                .soLuongHoanTruoc(hoanTruoc)
                .soDon(soDon)
                .soSanPhamCoBan((int) ds.stream().filter(p -> p.getSoLuong().signum() > 0).count())
                .soSanPhamDangKinhDoanh((int) ds.stream().filter(p -> !Integer.valueOf(2).equals(p.getTrangThai())).count())
                .build();
    }

    // ================= Excel =================

    /** Tệp Excel của Báo cáo sản phẩm, cùng số với màn; ghi nhật ký mỗi lần tải. */
    public XuatBaoCaoService.TepExcel xuatExcel(LocalDate tuNgay, LocalDate denNgay, Integer khoId, String kenh) {
        BaoCaoSanPhamDTO bc = layBaoCao(tuNgay, denNgay, khoId, kenh);
        String phamViKho = xuatBaoCaoService.phamViKho(khoId, DoanhThuReportService.phamVi(khoId));
        String k = chuanKenh(kenh);
        String tenKenh = k == null ? "Tất cả kênh" : bc.getDsKenh().stream().filter(x -> x.getMa().equals(k))
                .map(BaoCaoSanPhamDTO.Kenh::getTen).findFirst().orElse("Kênh #" + k);
        String phamVi = phamViKho + " · " + tenKenh;
        String tenTep = "Bao-cao-san-pham_" + bc.getTuNgay() + "_" + bc.getDenNgay() + ".xlsx";
        byte[] tep = BaoCaoSanPhamExcel.tao(bc, xuatBaoCaoService.thongTin(phamVi));
        xuatBaoCaoService.ghiNhatKy("Báo cáo sản phẩm", tenTep, Map.of(
                "tuNgay", String.valueOf(bc.getTuNgay()), "denNgay", String.valueOf(bc.getDenNgay()), "phamVi", phamVi));
        return new XuatBaoCaoService.TepExcel(tep, tenTep);
    }

    private static <T> Map<Integer, T> theo(List<T> ds, Function<T, Integer> khoa) {
        Map<Integer, T> m = new HashMap<>();
        ds.forEach(x -> m.put(khoa.apply(x), x));
        return m;
    }

    private static String rongThi(String s, String macDinh) {
        return s == null || s.isBlank() ? macDinh : s.trim();
    }
}
