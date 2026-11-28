package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.kiemke.KiemKeDto;
import com.dev.backend.dto.response.TongQuanAdminResponse;
import com.dev.backend.dto.response.TongQuanAdminResponse.BieuDo;
import com.dev.backend.dto.response.TongQuanAdminResponse.CanBoSung;
import com.dev.backend.dto.response.TongQuanAdminResponse.Diem;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongBoSung;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongKenh;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongKho;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongNhanVien;
import com.dev.backend.dto.response.TongQuanAdminResponse.DongNhom;
import com.dev.backend.dto.response.TongQuanAdminResponse.HoatDong;
import com.dev.backend.dto.response.TongQuanAdminResponse.KetQua;
import com.dev.backend.dto.response.TongQuanAdminResponse.Kho;
import com.dev.backend.dto.response.TongQuanAdminResponse.Ky;
import com.dev.backend.dto.response.TongQuanAdminResponse.PhanBo;
import com.dev.backend.dto.response.TongQuanAdminResponse.SanPhamBanChay;
import com.dev.backend.dto.response.TongQuanAdminResponse.SuKien;
import com.dev.backend.dto.response.TongQuanAdminResponse.TonKho;
import com.dev.backend.dto.response.TongQuanAdminResponse.TonKhoKho;
import com.dev.backend.dto.response.TongQuanAdminResponse.TongSo;
import com.dev.backend.dto.response.TongQuanAdminResponse.Viec;
import com.dev.backend.dto.response.TongQuanAdminResponse.ViecKenh;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.i18n.LoiThamSoException;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanAdminRepository.KhoDong;
import com.dev.backend.repository.TongQuanQuanTriRepository;
import com.dev.backend.repository.TongQuanQuanTriRepository.BoSungDong;
import com.dev.backend.repository.TongQuanQuanTriRepository.DiemChuoi;
import com.dev.backend.repository.TongQuanQuanTriRepository.TongNhom;
import com.dev.backend.repository.TongQuanQuanTriRepository.TonTongDong;
import com.dev.backend.repository.TongQuanQuanTriRepository.ViecDong;
import com.dev.backend.services.impl.kiemke.HangChuaCoKeService;
import com.dev.backend.services.multitable.TongQuanAdminService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Màn Tổng quan của quản trị viên (UC 11.1), làm lại 28/11/2026 theo đặc tả bản 2: mỗi khối tính độc lập, khối lỗi không
 * làm hỏng các khối khác. Truy vấn ở {@link TongQuanQuanTriRepository}; kỳ xem ở {@link KyXemTongQuan}.
 */
@Service
public class TongQuanAdminServiceImpl implements TongQuanAdminService {

    private static final Logger log = LoggerFactory.getLogger(TongQuanAdminServiceImpl.class);

    /** Dùng khi chưa cấu hình DEFAULT_MIN_STOCK_ALERT. */
    public static final int NGUONG_TON_MAC_DINH = 10;
    /** Hệ số Dư hàng của Tổng quan theo vai trò và API /admin/dashboard cũ (khả dụng > ngưỡng × hệ số). */
    public static final int HE_SO_DU_MAC_DINH = 3;
    /** Số ngày xét hàng dư "chưa bán được" (ghi đè bằng cấu hình SLOW_MOVING_DAYS). */
    public static final int SO_NGAY_CHAM_BAN_MAC_DINH = 60;

    static final int SO_SAN_PHAM_BAN_CHAY = 5;
    static final int SO_DONG_BO_SUNG = 4;
    /** Trần số sự kiện Hoạt động đọc một lần (2 ngày). */
    static final int SO_SU_KIEN_TOI_DA = 800;

    private static final DateTimeFormatter DINH_DANG_THOI_DIEM = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    /** Giữ kết quả 60 giây cho mỗi (kỳ, khoảng, kho): mở lại màn hoặc đổi qua lại bộ lọc không phải tính lại. */
    static final long THOI_GIAN_GIU_MS = 60_000;

    private record BanDaTinh(long luc, TongQuanAdminResponse duLieu) {}

    private static final Set<String> MA_KY = Set.of(KyXemTongQuan.HOM_NAY, KyXemTongQuan.HOM_QUA, KyXemTongQuan.BAY_NGAY,
            KyXemTongQuan.BA_MUOI_NGAY, KyXemTongQuan.THANG_NAY, KyXemTongQuan.THANG_TRUOC, KyXemTongQuan.MUOI_HAI_THANG,
            KyXemTongQuan.TUY_CHON);

    private final TongQuanAdminRepository goc;
    private final TongQuanQuanTriRepository repo;
    private final HangChuaCoKeService hangChuaCoKeService;
    private final Map<String, BanDaTinh> banDaTinh = new ConcurrentHashMap<>();

    public TongQuanAdminServiceImpl(TongQuanAdminRepository goc, TongQuanQuanTriRepository repo,
                                    HangChuaCoKeService hangChuaCoKeService) {
        this.goc = goc;
        this.repo = repo;
        this.hangChuaCoKeService = hangChuaCoKeService;
    }

    /*
     * Không mở giao dịch ở đây: mỗi khối tự bắt lỗi (chay/phu). Nếu bọc cả hàm trong một giao dịch, lỗi trong bean có
     * @Transactional được gọi tới (HangChuaCoKeService.dem) sẽ đánh dấu cả giao dịch rollback-only và làm hỏng cả trang.
     */
    @Override
    public TongQuanAdminResponse layTongQuan(String ky, LocalDate tuNgay, LocalDate denNgay, Integer khoId, boolean lamMoi) {
        String kyXem = (ky == null || ky.isBlank()) ? KyXemTongQuan.BA_MUOI_NGAY : ky.trim();
        if (!MA_KY.contains(kyXem)) throw new LoiThamSoException(ThongDiep.of("hienThiBaoCao.tongQuanKyKhongHopLe"));
        boolean tuyChon = KyXemTongQuan.TUY_CHON.equals(kyXem);
        String khoa = kyXem + "|" + (tuyChon ? tuNgay + "|" + denNgay : "") + "|" + khoId;
        long bayGioMs = System.currentTimeMillis();
        BanDaTinh daTinh = banDaTinh.get(khoa);
        if (!lamMoi && daTinh != null && bayGioMs - daTinh.luc() < THOI_GIAN_GIU_MS) {
            return daTinh.duLieu();
        }
        TongQuanAdminResponse ketQua = tinhTongQuan(kyXem, tuyChon ? tuNgay : null, tuyChon ? denNgay : null, khoId);
        // Chỉ giữ bản đầy đủ; bản có khối lỗi sẽ được tính lại ở lần mở sau.
        if (ketQua.khoiLoi().isEmpty()) {
            // Dọn bản đã hết hạn để bộ nhớ không phình theo số khoảng tùy chọn đã xem.
            banDaTinh.values().removeIf(b -> bayGioMs - b.luc() >= THOI_GIAN_GIU_MS);
            banDaTinh.put(khoa, new BanDaTinh(bayGioMs, ketQua));
        }
        return ketQua;
    }

    private TongQuanAdminResponse tinhTongQuan(String kyXem, LocalDate tuNgay, LocalDate denNgay, Integer khoId) {
        LocalDateTime bayGio = goc.thoiDiemHienTai();
        List<KhoDong> dsKho = goc.danhSachKho();
        if (khoId != null && dsKho.stream().noneMatch(k -> k.id().equals(khoId))) {
            throw new LoiThamSoException(ThongDiep.of("khoVanHanh.khoKhongTonTaiHoacNgung"));
        }
        List<String> khoiLoi = Collections.synchronizedList(new ArrayList<>());
        Map<Integer, LocalDateTime> ngayMo = new HashMap<>();
        List<TongQuanQuanTriRepository.KhoMoDong> mo = phu("ngayMoKho", repo::ngayMoKho);
        if (mo != null) mo.forEach(m -> { if (m.ngayTao() != null) ngayMo.put(m.khoId(), m.ngayTao()); });
        LocalDateTime dauDuLieu = phu("ngayDauDuLieu", repo::ngayDauDuLieu);

        // Kỳ không hợp lệ (tùy chọn sai) là lỗi của yêu cầu, báo cả trang
        KyXemTongQuan k = KyXemTongQuan.tao(kyXem, tuNgay, denNgay, bayGio, dauDuLieu == null ? null : dauDuLieu.toLocalDate());

        int nguong = cauHinh("DEFAULT_MIN_STOCK_ALERT", NGUONG_TON_MAC_DINH);
        int soNgayCham = cauHinh("SLOW_MOVING_DAYS", SO_NGAY_CHAM_BAN_MAC_DINH);

        Map<Integer, KhoDong> khoTheoId = new LinkedHashMap<>();
        dsKho.forEach(x -> khoTheoId.put(x.id(), x));
        KhoDong khoXem = khoId == null ? null : khoTheoId.get(khoId);

        // Một lần đọc cho kỳ này và kỳ so sánh, dùng chung cho dải số và Phân bổ
        List<TongNhom> nay = chay(TongQuanAdminResponse.KHOI_KET_QUA, khoiLoi, () -> repo.tongTheoNhom(khoId, k.tu(), k.den()));
        List<TongNhom> truoc = nay == null ? null
                : chay(TongQuanAdminResponse.KHOI_KET_QUA, khoiLoi, () -> repo.tongTheoNhom(khoId, k.tuTruoc(), k.denTruoc()));

        KetQua ketQua = nay == null || truoc == null ? null
                : chay(TongQuanAdminResponse.KHOI_KET_QUA, khoiLoi, () -> tinhKetQua(k, khoId, nay, truoc, ngayMo, dsKho));
        if (ketQua == null && !khoiLoi.contains(TongQuanAdminResponse.KHOI_PHAN_BO)) {
            khoiLoi.add(TongQuanAdminResponse.KHOI_PHAN_BO);
        }
        BieuDo bieuDo = chay(TongQuanAdminResponse.KHOI_BIEU_DO, khoiLoi, () -> tinhBieuDo(k, khoId));
        PhanBo phanBo = ketQua == null ? null
                : chay(TongQuanAdminResponse.KHOI_PHAN_BO, khoiLoi, () -> tinhPhanBo(k, khoXem, nay, truoc, khoTheoId, ngayMo));
        List<SanPhamBanChay> banChay = chay(TongQuanAdminResponse.KHOI_BAN_CHAY, khoiLoi, () -> tinhBanChay(k, khoId));
        TonKho tonKho = chay(TongQuanAdminResponse.KHOI_TON_KHO, khoiLoi,
                () -> tinhTonKho(khoXem, khoTheoId, nguong, soNgayCham, bayGio));
        List<Viec> viec = chay(TongQuanAdminResponse.KHOI_VIEC, khoiLoi, () -> tinhViec(khoXem, dsKho, bayGio));
        HoatDong hoatDong = chay(TongQuanAdminResponse.KHOI_HOAT_DONG, khoiLoi, () -> tinhHoatDong(khoId, bayGio));

        List<Kho> danhSachKho = dsKho.stream()
                .map(x -> new Kho(x.id(), x.maKho(), x.tenKho(), x.laKhoTong(), ngay(ngayMo.get(x.id()))))
                .toList();
        Ky ky = new Ky(k.ky(), thoiDiem(k.tu()), thoiDiem(k.den()), thoiDiem(k.tuTruoc()), thoiDiem(k.denTruoc()),
                thoiDiem(k.bieuDoTruocTu()), thoiDiem(k.bieuDoTruocDen()), k.nhom(), k.soDiem(), k.kieuSoSanh(), k.dangChay());
        return new TongQuanAdminResponse(thoiDiem(bayGio), ky, khoId, danhSachKho,
                dauDuLieu == null ? null : dauDuLieu.toLocalDate().toString(), List.copyOf(khoiLoi),
                ketQua, bieuDo, phanBo, banChay, tonKho, viec, hoatDong);
    }

    /* ======================================================================
     * DẢI SỐ
     * ====================================================================== */

    KetQua tinhKetQua(KyXemTongQuan k, Integer khoId, List<TongNhom> nay, List<TongNhom> truoc,
                      Map<Integer, LocalDateTime> ngayMo, List<KhoDong> dsKho) {
        TongSo homQua = null;
        if (KyXemTongQuan.HOM_NAY.equals(k.ky())) {
            homQua = tong(repo.tongTheoNhom(khoId, k.tu().minusDays(1), k.den().minusDays(1)));
        }
        long soDon = 0;
        long tien = 0;
        if (k.dangChay()) {
            TongQuanQuanTriRepository.ChoXuatDong c = phu("choXuat", () -> repo.choXuat(khoId, k.tu(), k.den()));
            if (c != null) {
                soDon = c.soDon();
                tien = so(c.tien());
            }
        }
        List<Integer> khoMoi = dsKho.stream()
                .filter(x -> khoId == null || x.id().equals(khoId))
                .filter(x -> { LocalDateTime m = ngayMo.get(x.id()); return m != null && m.isAfter(k.tuTruoc()) && m.isBefore(k.den()); })
                .map(KhoDong::id)
                .toList();
        return new KetQua(tong(nay), tong(truoc), homQua, soDon, tien, khoMoi);
    }

    /** Cộng các nhóm thành tổng của khoảng. */
    static TongSo tong(List<TongNhom> ds) {
        BigDecimal dt = BigDecimal.ZERO, xuat = BigDecimal.ZERO, tra = BigDecimal.ZERO, vat = BigDecimal.ZERO;
        BigDecimal von = BigDecimal.ZERO, tot = BigDecimal.ZERO, loi = BigDecimal.ZERO;
        long donXuat = 0, donTra = 0;
        for (TongNhom n : ds) {
            dt = dt.add(n.doanhThu());
            xuat = xuat.add(n.tienHangXuat());
            tra = tra.add(n.tienHangTra());
            vat = vat.add(n.thueGtgt());
            von = von.add(n.giaVonXuat());
            tot = tot.add(n.giaVonTraTot());
            loi = loi.add(n.giaVonTraLoi());
            donXuat += n.donXuat();
            donTra += n.donTra();
        }
        return new TongSo(so(dt), so(xuat), so(tra), so(vat), so(von), so(tot), so(loi),
                so(dt.subtract(von).add(tot)), donXuat, donTra, donXuat - donTra);
    }

    /* ======================================================================
     * BIỂU ĐỒ
     * ====================================================================== */

    BieuDo tinhBieuDo(KyXemTongQuan k, Integer khoId) {
        String dinhDang = switch (k.nhom()) {
            case KyXemTongQuan.NHOM_GIO -> TongQuanQuanTriRepository.DINH_DANG_GIO_SQL;
            case KyXemTongQuan.NHOM_NGAY -> TongQuanQuanTriRepository.DINH_DANG_NGAY_SQL;
            default -> TongQuanQuanTriRepository.DINH_DANG_THANG_SQL;
        };
        List<Diem> nay = diem(k, k.tu(), repo.chuoi(khoId, k.tu(), k.den(), dinhDang));
        List<Diem> truoc = diem(k, k.bieuDoTruocTu(), repo.chuoi(khoId, k.bieuDoTruocTu(), k.bieuDoTruocDen(), dinhDang));
        return new BieuDo(nay, truoc);
    }

    static List<Diem> diem(KyXemTongQuan k, LocalDateTime goc, List<DiemChuoi> ds) {
        List<Diem> kq = new ArrayList<>();
        for (DiemChuoi d : ds) {
            int viTri = k.viTri(goc, docMoc(d.moc(), k.nhom()));
            if (viTri < 0 || viTri >= k.soDiem()) continue;
            kq.add(new Diem(viTri, so(d.doanhThu()), so(d.doanhThu().subtract(d.giaVonXuat()).add(d.giaVonTraTot())),
                    d.donXuat() - d.donTra()));
        }
        kq.sort(Comparator.comparingInt(Diem::viTri));
        return kq;
    }

    static LocalDateTime docMoc(String moc, String nhom) {
        return switch (nhom) {
            case KyXemTongQuan.NHOM_GIO -> LocalDate.parse(moc.substring(0, 10)).atTime(Integer.parseInt(moc.substring(11, 13)), 0);
            case KyXemTongQuan.NHOM_NGAY -> LocalDate.parse(moc).atStartOfDay();
            default -> LocalDate.parse(moc + "-01").atStartOfDay();
        };
    }

    /* ======================================================================
     * PHÂN BỔ
     * ====================================================================== */

    PhanBo tinhPhanBo(KyXemTongQuan k, KhoDong khoXem, List<TongNhom> nay, List<TongNhom> truoc,
                      Map<Integer, KhoDong> khoTheoId, Map<Integer, LocalDateTime> ngayMo) {
        List<DongKenh> theoKenh = theoKenh(nay, truoc);
        if (khoXem == null) {
            return new PhanBo(theoKho(nay, truoc, khoTheoId, ngayMo), theoKenh, null, null);
        }
        List<DongNhom> theoNhom = repo.theoNhomHang(khoXem.id(), k.tu(), k.den(), k.tuTruoc(), k.denTruoc()).stream()
                .map(r -> new DongNhom(r.danhMucId(), r.tenDanhMuc(), so(r.doanhThu()), so(r.doanhThuTruoc())))
                .filter(r -> r.doanhThu() != 0 || r.doanhThuTruoc() != 0)
                .sorted(Comparator.comparingLong(DongNhom::doanhThu).reversed())
                .toList();
        List<DongNhanVien> theoNhanVien = khoXem.laKhoTong() ? null : theoNhanVien(nay);
        return new PhanBo(null, theoKenh, theoNhom, theoNhanVien);
    }

    static List<DongKho> theoKho(List<TongNhom> nay, List<TongNhom> truoc, Map<Integer, KhoDong> khoTheoId,
                                 Map<Integer, LocalDateTime> ngayMo) {
        Map<Integer, long[]> m = new LinkedHashMap<>();
        khoTheoId.keySet().forEach(id -> m.put(id, new long[3]));
        Map<Integer, BigDecimal[]> tien = new HashMap<>();
        for (TongNhom n : nay) {
            if (n.khoId() == null) continue;
            BigDecimal[] t = tien.computeIfAbsent(n.khoId(), x -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            t[0] = t[0].add(n.doanhThu());
            m.computeIfAbsent(n.khoId(), x -> new long[3])[1] += n.donXuat() - n.donTra();
        }
        for (TongNhom n : truoc) {
            if (n.khoId() == null) continue;
            BigDecimal[] t = tien.computeIfAbsent(n.khoId(), x -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            t[1] = t[1].add(n.doanhThu());
            m.computeIfAbsent(n.khoId(), x -> new long[3]);
        }
        List<DongKho> kq = new ArrayList<>();
        m.forEach((id, v) -> {
            BigDecimal[] t = tien.getOrDefault(id, new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            KhoDong kho = khoTheoId.get(id);
            long dt = so(t[0]);
            long dtTruoc = so(t[1]);
            // Kho đã ngừng hoạt động không có doanh thu thì không hiện
            if (kho == null && dt == 0 && dtTruoc == 0) return;
            kq.add(new DongKho(id, kho == null ? null : kho.tenKho(), kho != null && kho.laKhoTong(), ngay(ngayMo.get(id)),
                    dt, v[1], dtTruoc));
        });
        kq.sort(Comparator.comparingLong(DongKho::doanhThu).reversed().thenComparing(DongKho::khoId));
        return kq;
    }

    static List<DongKenh> theoKenh(List<TongNhom> nay, List<TongNhom> truoc) {
        Map<String, Object[]> m = new LinkedHashMap<>();
        for (TongNhom n : nay) {
            Object[] v = m.computeIfAbsent(n.maKenh(), x -> new Object[]{n.tenKenh(), BigDecimal.ZERO, 0L, 0L, BigDecimal.ZERO});
            if (v[0] == null) v[0] = n.tenKenh();
            v[1] = ((BigDecimal) v[1]).add(n.doanhThu());
            v[2] = (Long) v[2] + n.donXuat();
            v[3] = (Long) v[3] + n.donBiHoan();
        }
        for (TongNhom n : truoc) {
            Object[] v = m.computeIfAbsent(n.maKenh(), x -> new Object[]{n.tenKenh(), BigDecimal.ZERO, 0L, 0L, BigDecimal.ZERO});
            if (v[0] == null) v[0] = n.tenKenh();
            v[4] = ((BigDecimal) v[4]).add(n.doanhThu());
        }
        List<DongKenh> kq = new ArrayList<>();
        m.forEach((ma, v) -> kq.add(new DongKenh(ma, tenKenh(ma, (String) v[0]), so((BigDecimal) v[1]), (Long) v[2],
                (Long) v[3], so((BigDecimal) v[4]))));
        kq.sort(Comparator.comparingLong(DongKenh::doanhThu).reversed().thenComparing(DongKenh::maKenh));
        return kq;
    }

    static String tenKenh(String maKenh, String tenTrongCsdl) {
        if (TongQuanAdminRepository.MA_KENH_POS.equals(maKenh)) return "Bán tại quầy";
        if (TongQuanAdminRepository.MA_KENH_TRUC_TIEP.equals(maKenh)) return "Đơn bán trực tiếp";
        return tenTrongCsdl != null && !tenTrongCsdl.isBlank() ? tenTrongCsdl : maKenh;
    }

    /** Doanh thu bán tại quầy theo người lập đơn; số đơn = đơn bán trong kỳ (không trừ đơn trả). */
    static List<DongNhanVien> theoNhanVien(List<TongNhom> nay) {
        Map<Integer, Object[]> m = new LinkedHashMap<>();
        for (TongNhom n : nay) {
            if (!n.laPos() || n.nguoiId() == null) continue;
            Object[] v = m.computeIfAbsent(n.nguoiId(), x -> new Object[]{n.hoTen(), BigDecimal.ZERO, 0L});
            v[1] = ((BigDecimal) v[1]).add(n.doanhThu());
            v[2] = (Long) v[2] + n.donXuat();
        }
        List<DongNhanVien> kq = new ArrayList<>();
        m.forEach((id, v) -> {
            if ((Long) v[2] > 0) kq.add(new DongNhanVien(id, (String) v[0], so((BigDecimal) v[1]), (Long) v[2]));
        });
        kq.sort(Comparator.comparingLong(DongNhanVien::doanhThu).reversed().thenComparing(DongNhanVien::nguoiId));
        return kq;
    }

    /* ======================================================================
     * BÁN CHẠY
     * ====================================================================== */

    private List<SanPhamBanChay> tinhBanChay(KyXemTongQuan k, Integer khoId) {
        List<TongQuanQuanTriRepository.SanPhamDong> ds = repo.banChay(khoId, k.tu(), k.den(), SO_SAN_PHAM_BAN_CHAY);
        Map<Integer, String> anh = ds.isEmpty() ? Map.of()
                : Objects.requireNonNullElse(phu("anhSanPham",
                        () -> repo.anhSanPham(ds.stream().map(TongQuanQuanTriRepository.SanPhamDong::sanPhamId).toList())), Map.of());
        return ds.stream()
                .map(r -> new SanPhamBanChay(r.sanPhamId(), r.maSanPham(), r.tenSanPham(), anh.get(r.sanPhamId()),
                        so(r.soLuong()), so(r.doanhThu())))
                .toList();
    }

    /* ======================================================================
     * TỒN KHO
     * ====================================================================== */

    private TonKho tinhTonKho(KhoDong khoXem, Map<Integer, KhoDong> khoTheoId, int nguong, int soNgayCham,
                              LocalDateTime bayGio) {
        Integer khoId = khoXem == null ? null : khoXem.id();
        TonTongDong t = repo.tonTong(khoId, nguong, soNgayCham, bayGio);
        long giaTriChuyen = khoId == null ? Objects.requireNonNullElse(phu("giaTriDangChuyen", () -> so(repo.giaTriDangChuyen())), 0L) : 0;
        TongQuanQuanTriRepository.DangChuyenDong dc = repo.dangChuyen(khoId);
        long dangVe = so(goc.hangDangVe(khoId));
        Long hangLoi = phu("hangLoiChoTra", () -> so(repo.hangLoiChoTra(khoId)));

        List<TonKhoKho> theoKho = null;
        CanBoSung canBoSung = null;
        if (khoId == null) {
            Map<Integer, TongQuanQuanTriRepository.TonTheoKhoDong> m = new HashMap<>();
            repo.tonTheoKho(nguong).forEach(r -> m.put(r.khoId(), r));
            theoKho = new ArrayList<>();
            for (KhoDong kho : khoTheoId.values()) {
                TongQuanQuanTriRepository.TonTheoKhoDong r = m.get(kho.id());
                theoKho.add(r == null ? new TonKhoKho(kho.id(), kho.tenKho(), kho.laKhoTong(), 0, 0, 0, 0)
                        : new TonKhoKho(kho.id(), kho.tenKho(), kho.laKhoTong(), so(r.giaTri()), so(r.coTheBan()), r.het(), r.sap()));
            }
            theoKho.sort(Comparator.comparing(TonKhoKho::laKhoTong).reversed().thenComparing(Comparator.comparingLong(TonKhoKho::giaTri).reversed()));
        } else {
            List<BoSungDong> ds = repo.canBoSung(khoId, nguong, SO_DONG_BO_SUNG);
            canBoSung = new CanBoSung(ds.isEmpty() ? 0 : ds.get(0).tong(),
                    ds.stream().map(r -> dongBoSung(r, khoXem.laKhoTong())).toList());
        }
        long ton = so(t.ton());
        long giuDon = so(t.giuDon());
        long giuChuyen = so(t.giuChuyen());
        long giuKhac = so(t.daDat());
        return new TonKho(so(t.giaTri()) + giaTriChuyen, giaTriChuyen, ton, giuDon, giuChuyen, giuKhac, so(t.coTheBan()),
                dangVe, so(dc.di()), so(dc.den()), hangLoi == null ? 0 : hangLoi,
                t.soBienThe(), khoId == null ? khoTheoId.size() : 1, t.het(), t.sap(), t.binhThuong(), t.du(),
                so(t.giaTriDu()), t.duChamBan(), soNgayCham, nguong, theoKho, canBoSung);
    }

    static DongBoSung dongBoSung(BoSungDong r, boolean khoXemLaKhoTong) {
        long coTheBan = so(r.coTheBan());
        long can = soLuongDeXuat(coTheBan, r.nguong());
        Long khoTongCon = khoXemLaKhoTong || r.khoTongCon() == null ? null
                : r.khoTongCon().setScale(0, RoundingMode.FLOOR).longValue();
        String deXuat = deXuat(khoXemLaKhoTong, khoTongCon, can);
        return new DongBoSung(r.bienTheId(), r.sanPhamId(), r.maSku(), r.tenSanPham(), r.tenMau(), r.tenKichCo(), coTheBan,
                r.nguong(), khoTongCon, so(r.dangVe()), deXuat, can);
    }

    /**
     * Quy tắc nhập hàng (SRS 3.3): chỉ Kho tổng nhập từ nhà cung cấp; cửa hàng được bổ sung bằng chuyển kho từ Kho tổng khi
     * Kho tổng còn đủ, nếu không thì nhập về Kho tổng. Tổng quan theo vai trò dùng chung.
     */
    static String deXuat(boolean laKhoTong, Long khaDungKhoTong, long canBoSung) {
        if (!laKhoTong && khaDungKhoTong != null && khaDungKhoTong >= canBoSung) return "chuyen_kho";
        return "yeu_cau_nhap";
    }

    /** Đưa có thể bán về gấp đôi ngưỡng tối thiểu (tạm thời, khi chưa có mức tồn tối đa cho từng mã). */
    static long soLuongDeXuat(long coTheBan, int nguong) {
        return Math.max(1, 2L * nguong - coTheBan);
    }

    /* ======================================================================
     * CẦN XỬ LÝ
     * ====================================================================== */

    private List<Viec> tinhViec(KhoDong khoXem, List<KhoDong> dsKho, LocalDateTime bayGio) {
        Integer khoId = khoXem == null ? null : khoXem.id();
        // Việc cấp kênh (mất kết nối, lỗi đẩy tồn) thuộc kho xuất đơn sàn: hiện khi xem tất cả kho hoặc Kho tổng
        boolean coViecKenh = khoXem == null || khoXem.laKhoTong();
        List<Viec> kq = new ArrayList<>();
        for (ViecDong v : repo.viec(khoId, bayGio)) {
            if (v.so() <= 0) continue;
            if ("matKetNoi".equals(v.loai()) && !coViecKenh) continue;
            kq.add(new Viec(v.loai(), v.so(), v.ma(), v.ten(), v.kho(), v.kho2(), thoiDiem(v.moc()), v.soPhu(), v.soPhu2(),
                    v.khoId(), null));
        }
        if (coViecKenh) {
            List<TongQuanQuanTriRepository.LoiDongBoDong> loi = phu("loiDongBo", repo::loiDongBo);
            if (loi != null && !loi.isEmpty()) {
                long tongLoi = loi.stream().mapToLong(TongQuanQuanTriRepository.LoiDongBoDong::soLoi).sum();
                kq.add(new Viec("loiDongBo", tongLoi, null, null, null, null, null, 0, 0, null,
                        loi.stream().map(r -> new ViecKenh(r.kenhId(), r.maKenh(), tenKenh(r.maKenh(), r.tenKenh()), r.soLoi())).toList()));
            }
        }
        Viec chuaKe = phu("hangChuaCoKe", () -> hangChuaCoKe(khoXem, dsKho));
        if (chuaKe != null) kq.add(chuaKe);
        return kq;
    }

    /** Hàng chưa có kệ: số lô và số cái của kho đang xem, hoặc cộng mọi kho (kho mẫu là kho nhiều hàng nhất). */
    private Viec hangChuaCoKe(KhoDong khoXem, List<KhoDong> dsKho) {
        long soLo = 0, soLuong = 0, nhieuNhat = -1;
        KhoDong mau = null;
        for (KhoDong kho : khoXem == null ? dsKho : List.of(khoXem)) {
            KiemKeDto.DemChuaCoKe d = hangChuaCoKeService.dem(kho.id(), null, null);
            if (d == null || d.soLo() <= 0) continue;
            soLo += d.soLo();
            soLuong += d.soLuong();
            if (d.soLuong() > nhieuNhat) {
                nhieuNhat = d.soLuong();
                mau = kho;
            }
        }
        if (soLo <= 0) return null;
        return new Viec("hangChuaCoKe", soLo, null, null, mau == null ? null : mau.tenKho(), null, null, soLuong, 0,
                mau == null ? null : mau.id(), null);
    }

    /* ======================================================================
     * HOẠT ĐỘNG
     * ====================================================================== */

    private HoatDong tinhHoatDong(Integer khoId, LocalDateTime bayGio) {
        LocalDateTime homNay = bayGio.toLocalDate().atStartOfDay();
        List<TongQuanQuanTriRepository.SuKienDong> ds = repo.hoatDong(khoId, homNay.minusDays(1), bayGio, SO_SU_KIEN_TOI_DA);
        long soHomNay = ds.stream().filter(s -> s.thoiGian() != null && !s.thoiGian().isBefore(homNay)).count();
        return new HoatDong(soHomNay, ds.stream().map(s -> new SuKien(s.loai(), s.id(), s.ma(), thoiDiem(s.thoiGian()),
                s.khoId(), s.tenKho(), s.khoId2(), s.tenKho2(), s.nguoi(), s.maKenh(), s.tenKenh(),
                s.soTien() == null ? null : so(s.soTien()), s.soLuong() == null ? null : so(s.soLuong()), s.soMa(),
                s.coYeuCauHuy(), s.coHangLoi(), s.soNhan() == null ? null : so(s.soNhan()), s.trangThai())).toList());
    }

    /* ======================================================================
     * TIỆN ÍCH
     * ====================================================================== */

    private int cauHinh(String ma, int macDinh) {
        Integer v = phu("cauHinh " + ma, () -> goc.cauHinhSo(ma));
        return v != null && v > 0 ? v : macDinh;
    }

    static long so(BigDecimal v) {
        return v == null ? 0L : v.setScale(0, RoundingMode.HALF_UP).longValue();
    }

    private static String thoiDiem(LocalDateTime t) {
        return t == null ? null : t.format(DINH_DANG_THOI_DIEM);
    }

    private static String ngay(LocalDateTime t) {
        return t == null ? null : t.toLocalDate().toString();
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
