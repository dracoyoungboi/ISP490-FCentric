package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.NhapXuatTongHopDTO;
import com.dev.backend.dto.response.NhapXuatTongHopDTO.Dong;
import com.dev.backend.dto.response.NhapXuatTongHopDTO.Ky;
import com.dev.backend.dto.response.NhapXuatTongHopDTO.Loai;
import com.dev.backend.dto.response.NhapXuatTongHopDTO.So;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BaoCaoNhapXuatRepository;
import com.dev.backend.repository.BaoCaoNhapXuatRepository.ChungTu;
import com.dev.backend.repository.BaoCaoNhapXuatRepository.PhatSinh;
import com.dev.backend.repository.BaoCaoNhapXuatRepository.SauMoc;
import com.dev.backend.repository.BaoCaoNhapXuatRepository.SoKhoSanPham;
import com.dev.backend.repository.BaoCaoSanPhamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Báo cáo nhập xuất (màn /reports/stock-movements) và tệp Excel của màn: Tồn đầu kỳ + Nhập − Xuất = Tồn cuối kỳ, nhập từ
 * đâu, xuất đi đâu, theo kỳ, theo kho, theo sản phẩm.
 * Tồn đầu, tồn cuối neo vào tồn thật hiện tại (ton_kho_theo_lo) rồi lùi theo sổ giao dịch, nên tồn cuối khớp Báo cáo tồn
 * kho kể cả khi sổ thiếu dòng (phần thiếu dồn vào tồn đầu kỳ).
 * Quản trị viên xem mọi kho; quản lý kho chỉ các kho mình phụ trách (chọn kho khác thì 403), như Báo cáo doanh thu.
 */
@Service
@RequiredArgsConstructor
public class BaoCaoNhapXuatService {

    /** Số dòng tối đa của trang Chi tiết giao dịch (tệp quá lớn mở rất chậm). */
    static final int TOI_DA_DONG_CHI_TIET = 100_000;
    /** Xem theo năm: tối đa số năm này. */
    static final int TOI_DA_SO_NAM = 20;
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter NGAY_THANG = DateTimeFormatter.ofPattern("dd/MM");
    private static final DateTimeFormatter NGAY_DAY_DU = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Một nhóm nhập / xuất. chinh: luôn có dòng (kể cả khi 0); nhóm phụ chỉ có dòng khi có số. */
    record Nhom(String ma, String chieu, String ten, boolean chinh) {
        boolean laNhap() {
            return "nhap".equals(chieu);
        }
    }

    /** Thứ tự hiện của các nhóm; mã trùng với cột nhom của BaoCaoNhapXuatRepository. */
    static final List<Nhom> NHOM = List.of(
            new Nhom("N_MUA", "nhap", "Mua hàng từ nhà cung cấp", true),
            new Nhom("N_CHUYEN", "nhap", "Nhận chuyển kho", true),
            new Nhom("N_HOAN", "nhap", "Hàng hoàn, khách trả", true),
            new Nhom("DC_TANG", "nhap", "Điều chỉnh tăng", true),
            new Nhom("N_KHAC", "nhap", "Nhập khác", false),
            new Nhom("X_QUAY", "xuat", "Bán tại quầy", true),
            new Nhom("X_DON", "xuat", "Giao đơn online, sàn", true),
            new Nhom("X_CHUYEN", "xuat", "Chuyển kho đi", true),
            new Nhom("DC_GIAM", "xuat", "Điều chỉnh giảm", true),
            new Nhom("X_TRA_NCC", "xuat", "Trả nhà cung cấp", false),
            new Nhom("X_KHAC", "xuat", "Xuất khác", false));
    static final Map<String, Nhom> THEO_MA = NHOM.stream().collect(Collectors.toMap(Nhom::ma, Function.identity()));

    private final BaoCaoNhapXuatRepository repo;
    private final BaoCaoSanPhamRepository sanPhamRepo;
    private final XuatBaoCaoService xuatBaoCaoService;
    private final PlatformTransactionManager transactionManager;

    /**
     * Chạy các truy vấn của một lần xem trong cùng một giao dịch chỉ đọc: InnoDB cho mọi SELECT chung một ảnh chụp dữ
     * liệu, nên phiếu ghi xen giữa các truy vấn không làm Tồn đầu + Nhập − Xuất lệch Tồn cuối.
     */
    private <T> T docMotLan(Supplier<T> doc) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setReadOnly(true);
        return tx.execute(s -> doc.get());
    }

    /**
     * Bộ lọc của màn. loai: ngay (tuNgay, denNgay, tối đa 1 năm) | tuan, thang (nam) | nam (tuNam, denNam). khoId trống:
     * mọi kho được xem. nhom trống: mọi nhóm.
     */
    public record ThamSo(String loai, LocalDate tuNgay, LocalDate denNgay, Integer nam, Integer tuNam, Integer denNam,
                         Integer khoId, String nhom) {
    }

    /** Một kỳ con của biểu đồ, bảng: [tu, den] đầy đủ (kỳ con cuối có thể chưa qua hết). */
    record Moc(String nhan, String nhanDay, LocalDate tu, LocalDate den) {
    }

    /** Kỳ đang xem: [tu, denDayDu] theo bộ lọc, den = denDayDu cắt tới hôm nay. */
    record KyXem(String loai, String ten, LocalDate tu, LocalDate denDayDu, LocalDate den, List<Moc> moc) {
    }

    private record KhoSp(int kho, int sp) {
    }

    /** Cộng dồn số lượng, giá trị nhập, xuất (dương). */
    private static final class Cong {
        BigDecimal nSl = BigDecimal.ZERO, nGt = BigDecimal.ZERO, xSl = BigDecimal.ZERO, xGt = BigDecimal.ZERO;

        void them(PhatSinh p) {
            nSl = nSl.add(p.slNhap());
            nGt = nGt.add(p.gtNhap());
            xSl = xSl.add(p.slXuat());
            xGt = xGt.add(p.gtXuat());
        }

        boolean coSo() {
            return nSl.signum() != 0 || xSl.signum() != 0 || nGt.signum() != 0 || xGt.signum() != 0;
        }
    }

    // ================= Kỳ =================

    static KyXem kyXem(ThamSo t, LocalDate homNay) {
        String loai = t.loai() == null ? "" : t.loai();
        LocalDate tu;
        LocalDate denDayDu;
        String ten;
        List<Moc> moc = new ArrayList<>();
        switch (loai) {
            case "ngay" -> {
                DoanhThuReportService.kiemKhoangNgay(t.tuNgay(), t.denNgay());
                tu = t.tuNgay();
                denDayDu = t.denNgay();
                ten = "Theo ngày";
                for (LocalDate d = tu; !d.isAfter(denDayDu); d = d.plusDays(1)) {
                    moc.add(new Moc(d.format(NGAY_THANG), d.format(NGAY_DAY_DU), d, d));
                }
            }
            case "tuan", "thang" -> {
                int nam = canNam(t.nam());
                tu = LocalDate.of(nam, 1, 1);
                denDayDu = LocalDate.of(nam, 12, 31);
                if ("tuan".equals(loai)) {
                    ten = "Theo tuần năm " + nam;
                    int i = 1;
                    for (LocalDate d = tu; !d.isAfter(denDayDu); i++) {
                        LocalDate cn = d.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
                        if (cn.isAfter(denDayDu)) cn = denDayDu;
                        moc.add(new Moc("Tuần " + i, "Tuần " + i + " (" + d.format(NGAY_THANG) + " – " + cn.format(NGAY_THANG) + ")", d, cn));
                        d = cn.plusDays(1);
                    }
                } else {
                    ten = "Theo tháng năm " + nam;
                    for (int m = 1; m <= 12; m++) {
                        LocalDate dau = LocalDate.of(nam, m, 1);
                        moc.add(new Moc("T" + m, "Tháng " + m + "/" + nam, dau, dau.with(TemporalAdjusters.lastDayOfMonth())));
                    }
                }
            }
            case "nam" -> {
                if (t.tuNam() == null || t.denNam() == null) throw new CommonException("Vui lòng chọn từ năm và đến năm");
                if (t.tuNam() > t.denNam()) throw new CommonException("Từ năm phải trước hoặc bằng đến năm");
                canNam(t.tuNam());
                if (t.denNam() - t.tuNam() >= TOI_DA_SO_NAM) throw new CommonException("Xem theo năm tối đa " + TOI_DA_SO_NAM + " năm");
                tu = LocalDate.of(t.tuNam(), 1, 1);
                denDayDu = LocalDate.of(t.denNam(), 12, 31);
                ten = "Từ năm " + t.tuNam() + " đến năm " + t.denNam();
                for (int y = t.tuNam(); y <= t.denNam(); y++) {
                    moc.add(new Moc(String.valueOf(y), "Năm " + y, LocalDate.of(y, 1, 1), LocalDate.of(y, 12, 31)));
                }
            }
            default -> throw new CommonException("Cách xem không hợp lệ");
        }
        if (tu.isAfter(homNay)) throw new CommonException("Kỳ này chưa bắt đầu");
        LocalDate den = denDayDu.isAfter(homNay) ? homNay : denDayDu;
        return new KyXem(loai, ten, tu, denDayDu, den, moc);
    }

    private static int canNam(Integer nam) {
        if (nam == null) throw new CommonException("Vui lòng chọn năm");
        if (nam < DoanhThuReportService.NAM_NHO_NHAT || nam > 9999) {
            throw new CommonException("Năm phải từ " + DoanhThuReportService.NAM_NHO_NHAT + " đến 9999");
        }
        return nam;
    }

    static String chuanNhom(String nhom) {
        if (nhom == null || nhom.isBlank()) return null;
        if (!THEO_MA.containsKey(nhom)) throw new CommonException("Loại nhập xuất không hợp lệ");
        return nhom;
    }

    // ================= Tổng hợp =================

    public NhapXuatTongHopDTO tongHop(ThamSo t) {
        DoanhThuReportService.PhamVi pv = DoanhThuReportService.phamVi(t.khoId());
        KyXem ky = kyXem(t, LocalDate.now(VN));
        return docMotLan(() -> tongHop(t, pv, ky));
    }

    NhapXuatTongHopDTO tongHop(ThamSo t, DoanhThuReportService.PhamVi pv, KyXem ky) {
        String nhom = chuanNhom(t.nhom());
        boolean tc = pv.tatCaKho();
        List<Integer> ids = pv.khoIds();

        List<PhatSinh> ps = repo.phatSinh(tc, ids, ky.tu(), ky.den());
        List<ChungTu> ct = repo.chungTu(tc, ids, ky.tu(), ky.den());
        Map<KhoSp, BigDecimal[]> dau = new HashMap<>();
        Map<KhoSp, BigDecimal[]> cuoi = new HashMap<>();
        for (SoKhoSanPham s : repo.tonHienTai(tc, ids)) {
            KhoSp k = new KhoSp(s.khoId(), s.sanPhamId());
            dau.put(k, new BigDecimal[]{s.soLuong(), s.giaTri()});
            cuoi.put(k, new BigDecimal[]{s.soLuong(), s.giaTri()});
        }
        for (SauMoc m : repo.sauMoc(tc, ids, ky.tu(), ky.den())) {
            KhoSp k = new KhoSp(m.khoId(), m.sanPhamId());
            tru(dau, k, m.slTuDau(), m.gtTuDau());
            tru(cuoi, k, m.slSau(), m.gtSau());
        }
        So dauKy = new So(cong(dau.values(), 0), cong(dau.values(), 1));
        So cuoiKy = new So(cong(cuoi.values(), 0), cong(cuoi.values(), 1));

        // Tổng và theo nhóm: luôn đủ mọi nhóm
        Cong tong = new Cong();
        Map<String, Cong> theoNhom = new HashMap<>();
        for (PhatSinh p : ps) {
            tong.them(p);
            theoNhom.computeIfAbsent(p.nhom(), x -> new Cong()).them(p);
        }
        Set<String> ctNhap = new HashSet<>();
        Set<String> ctXuat = new HashSet<>();
        Map<String, Set<String>> ctNhom = new HashMap<>();
        for (ChungTu c : ct) {
            (c.chieu() > 0 ? ctNhap : ctXuat).add(c.khoa());
            ctNhom.computeIfAbsent(c.nhom(), x -> new HashSet<>()).add(c.khoa());
        }
        List<Loai> theoLoai = new ArrayList<>();
        for (Nhom n : NHOM) {
            Cong c = theoNhom.getOrDefault(n.ma(), new Cong());
            BigDecimal sl = n.laNhap() ? c.nSl : c.xSl;
            if (!n.chinh() && sl.signum() == 0) continue;
            theoLoai.add(new Loai(n.ma(), n.chieu(), n.ten(), sl, n.laNhap() ? c.nGt : c.xGt,
                    ctNhom.getOrDefault(n.ma(), Set.of()).size()));
        }

        List<Ky> theoKy = theoKy(ky, ps, ct, nhom, dauKy);

        // Theo kho, theo sản phẩm: nhập / xuất theo nhóm đang lọc, tồn đủ mọi nhóm
        Map<Integer, Cong> psKho = new HashMap<>();
        Map<Integer, Cong> psSp = new HashMap<>();
        for (PhatSinh p : ps) {
            if (nhom != null && !nhom.equals(p.nhom())) continue;
            psKho.computeIfAbsent(p.khoId(), x -> new Cong()).them(p);
            psSp.computeIfAbsent(p.sanPhamId(), x -> new Cong()).them(p);
        }
        Map<Integer, BigDecimal[]> dauKho = gomTheo(dau, KhoSp::kho);
        Map<Integer, BigDecimal[]> cuoiKho = gomTheo(cuoi, KhoSp::kho);
        Map<Integer, BigDecimal[]> dauSp = gomTheo(dau, KhoSp::sp);
        Map<Integer, BigDecimal[]> cuoiSp = gomTheo(cuoi, KhoSp::sp);

        Set<Integer> khoCo = coDong(psKho, dauKho, cuoiKho, nhom != null);
        Map<Integer, String> tenKho = new HashMap<>();
        repo.kho(khoCo).forEach(k -> tenKho.put(k.id(), k.ten()));
        List<Dong> theoKho = new ArrayList<>();
        for (Integer id : khoCo) {
            theoKho.add(dong(id, tenKho.getOrDefault(id, "Kho #" + id), null, null, null, null,
                    dauKho.get(id), psKho.get(id), cuoiKho.get(id)));
        }
        theoKho.sort(Comparator.comparing(Dong::cuoiSl).reversed().thenComparing(Dong::ten));

        Set<Integer> spCo = coDong(psSp, dauSp, cuoiSp, nhom != null);
        Map<Integer, BaoCaoNhapXuatRepository.SanPham> sp = new HashMap<>();
        repo.sanPham(spCo).forEach(s -> sp.put(s.id(), s));
        Map<Integer, String> anh = spCo.isEmpty() ? Map.of() : sanPhamRepo.anhTheoSanPham();
        List<Dong> theoSanPham = new ArrayList<>();
        for (Integer id : spCo) {
            BaoCaoNhapXuatRepository.SanPham s = sp.get(id);
            theoSanPham.add(dong(id, s == null ? "Sản phẩm #" + id : s.ten(), s == null ? null : s.ma(),
                    s == null ? null : s.danhMuc(), anh.get(id), s == null ? null : s.soSku(),
                    dauSp.get(id), psSp.get(id), cuoiSp.get(id)));
        }
        theoSanPham.sort(Comparator.comparing((Dong d) -> d.nhapSl().add(d.xuatSl())).reversed()
                .thenComparing(Comparator.comparing(Dong::cuoiSl).reversed())
                .thenComparing(Dong::ten));

        NhapXuatTongHopDTO.CungKy cungKy = null;
        LocalDate tuTruoc = null;
        LocalDate denTruoc = null;
        if (!"nam".equals(ky.loai())) {
            tuTruoc = ky.tu().minusYears(1);
            denTruoc = ky.den().minusYears(1);
            BigDecimal[] nx = repo.tongNhapXuat(tc, ids, tuTruoc, denTruoc);
            cungKy = new NhapXuatTongHopDTO.CungKy(nx[0], nx[1]);
        }

        return new NhapXuatTongHopDTO(ky.loai(), ky.tu(), ky.den(), nhom, pv.theoKhoPhuTrach(),
                dauKy, new NhapXuatTongHopDTO.PhatSinh(tong.nSl, tong.nGt, ctNhap.size()),
                new NhapXuatTongHopDTO.PhatSinh(tong.xSl, tong.xGt, ctXuat.size()), cuoiKy,
                cungKy, tuTruoc, denTruoc, theoLoai, theoKy, theoKho, theoSanPham);
    }

    /**
     * Theo kỳ con: nhập / xuất, số phiếu theo nhóm đang lọc; tồn đầu, tồn cuối mỗi kỳ con tính tiếp từ tồn đầu kỳ với
     * phát sinh đủ mọi nhóm. Kỳ con chưa tới: mọi số 0, chuaToi = true.
     */
    static List<Ky> theoKy(KyXem ky, List<PhatSinh> ps, List<ChungTu> ct, String nhom, So dauKy) {
        int n = ky.moc().size();
        TreeMap<LocalDate, Integer> viTri = new TreeMap<>();
        for (int i = 0; i < n; i++) viTri.put(ky.moc().get(i).tu(), i);
        Cong[] loc = new Cong[n];
        BigDecimal[] rongSl = new BigDecimal[n];
        BigDecimal[] rongGt = new BigDecimal[n];
        List<Set<String>> pN = new ArrayList<>();
        List<Set<String>> pX = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            loc[i] = new Cong();
            rongSl[i] = BigDecimal.ZERO;
            rongGt[i] = BigDecimal.ZERO;
            pN.add(new HashSet<>());
            pX.add(new HashSet<>());
        }
        for (PhatSinh p : ps) {
            Map.Entry<LocalDate, Integer> e = viTri.floorEntry(p.ngay());
            if (e == null) continue;
            int i = e.getValue();
            rongSl[i] = rongSl[i].add(p.slNhap()).subtract(p.slXuat());
            rongGt[i] = rongGt[i].add(p.gtNhap()).subtract(p.gtXuat());
            if (nhom == null || nhom.equals(p.nhom())) loc[i].them(p);
        }
        for (ChungTu c : ct) {
            if (nhom != null && !nhom.equals(c.nhom())) continue;
            Map.Entry<LocalDate, Integer> e = viTri.floorEntry(c.ngay());
            if (e == null) continue;
            (c.chieu() > 0 ? pN : pX).get(e.getValue()).add(c.khoa());
        }
        List<Ky> ds = new ArrayList<>(n);
        BigDecimal tonSl = dauKy.soLuong();
        BigDecimal tonGt = dauKy.giaTri();
        for (int i = 0; i < n; i++) {
            Moc m = ky.moc().get(i);
            boolean chuaToi = m.tu().isAfter(ky.den());
            if (chuaToi) {
                ds.add(new Ky(m.nhan(), m.nhanDay(), m.tu(), m.den(), true, BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0));
                continue;
            }
            BigDecimal dSl = tonSl;
            BigDecimal dGt = tonGt;
            tonSl = tonSl.add(rongSl[i]);
            tonGt = tonGt.add(rongGt[i]);
            ds.add(new Ky(m.nhan(), m.nhanDay(), m.tu(), m.den().isAfter(ky.den()) ? ky.den() : m.den(), false,
                    dSl, dGt, loc[i].nSl, loc[i].nGt, loc[i].xSl, loc[i].xGt, tonSl, tonGt, pN.get(i).size(), pX.get(i).size()));
        }
        return ds;
    }

    private static void tru(Map<KhoSp, BigDecimal[]> m, KhoSp k, BigDecimal sl, BigDecimal gt) {
        BigDecimal[] v = m.computeIfAbsent(k, x -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
        v[0] = v[0].subtract(sl);
        v[1] = v[1].subtract(gt);
    }

    private static BigDecimal cong(Iterable<BigDecimal[]> ds, int i) {
        BigDecimal t = BigDecimal.ZERO;
        for (BigDecimal[] v : ds) t = t.add(v[i]);
        return t;
    }

    private static Map<Integer, BigDecimal[]> gomTheo(Map<KhoSp, BigDecimal[]> m, Function<KhoSp, Integer> khoa) {
        Map<Integer, BigDecimal[]> kq = new HashMap<>();
        m.forEach((k, v) -> {
            BigDecimal[] t = kq.computeIfAbsent(khoa.apply(k), x -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            t[0] = t[0].add(v[0]);
            t[1] = t[1].add(v[1]);
        });
        return kq;
    }

    /** Các dòng cần hiện: có phát sinh, hoặc (không lọc nhóm) có tồn đầu / tồn cuối khác 0. */
    private static Set<Integer> coDong(Map<Integer, Cong> ps, Map<Integer, BigDecimal[]> dau, Map<Integer, BigDecimal[]> cuoi,
                                       boolean dangLoc) {
        Set<Integer> co = new HashSet<>();
        ps.forEach((id, c) -> { if (c.coSo()) co.add(id); });
        if (!dangLoc) {
            dau.forEach((id, v) -> { if (v[0].signum() != 0 || v[1].signum() != 0) co.add(id); });
            cuoi.forEach((id, v) -> { if (v[0].signum() != 0 || v[1].signum() != 0) co.add(id); });
        }
        return co;
    }

    private static Dong dong(int id, String ten, String ma, String danhMuc, String anh, Integer soSku,
                             BigDecimal[] dau, Cong ps, BigDecimal[] cuoi) {
        BigDecimal z = BigDecimal.ZERO;
        Cong c = ps == null ? new Cong() : ps;
        return new Dong(id, ten, ma, danhMuc, anh, soSku, dau == null ? z : dau[0], dau == null ? z : dau[1],
                c.nSl, c.nGt, c.xSl, c.xGt, cuoi == null ? z : cuoi[0], cuoi == null ? z : cuoi[1]);
    }

    // ================= Excel =================

    /** Tệp Excel đúng kỳ, kho, nhóm đang xem; ghi nhật ký mỗi lần tải. */
    public XuatBaoCaoService.TepExcel xuatExcel(ThamSo t) {
        DoanhThuReportService.PhamVi pv = DoanhThuReportService.phamVi(t.khoId());
        KyXem ky = kyXem(t, LocalDate.now(VN));
        // Chi tiết từng giao dịch (kỳ tối đa 1 năm) đọc cùng ảnh chụp với số tổng hợp
        boolean coChiTiet = ky.den().isBefore(ky.tu().plusYears(1));
        record SoLieu(NhapXuatTongHopDTO bc, List<BaoCaoNhapXuatRepository.GiaoDich> chiTiet) {
        }
        SoLieu sl = docMotLan(() -> {
            NhapXuatTongHopDTO b = tongHop(t, pv, ky);
            return new SoLieu(b, coChiTiet
                    ? repo.chiTiet(pv.tatCaKho(), pv.khoIds(), ky.tu(), ky.den(), b.nhom(), TOI_DA_DONG_CHI_TIET + 1) : null);
        });
        NhapXuatTongHopDTO bc = sl.bc();
        List<BaoCaoNhapXuatRepository.GiaoDich> chiTiet = sl.chiTiet();

        String phamVi = xuatBaoCaoService.phamViKho(t.khoId(), pv);
        String dongPhu = bc.nhom() == null ? "Mọi loại nhập, xuất" : "Chỉ " + THEO_MA.get(bc.nhom()).ten().toLowerCase();
        String tenTep = "Bao-cao-nhap-xuat_" + ky.tu() + "_" + ky.den() + ".xlsx";
        byte[] tep = BaoCaoNhapXuatExcel.tao(new BaoCaoNhapXuatExcel.DuLieu(bc, ky.ten(), dongPhu, chiTiet),
                xuatBaoCaoService.thongTin(phamVi));

        Map<String, Object> nhatKy = new LinkedHashMap<>();
        nhatKy.put("loai", ky.loai());
        nhatKy.put("tuNgay", String.valueOf(ky.tu()));
        nhatKy.put("denNgay", String.valueOf(ky.den()));
        nhatKy.put("phamVi", phamVi);
        nhatKy.put("nhom", bc.nhom());
        xuatBaoCaoService.ghiNhatKy("Báo cáo nhập xuất", tenTep, nhatKy);
        return new XuatBaoCaoService.TepExcel(tep, tenTep);
    }
}
