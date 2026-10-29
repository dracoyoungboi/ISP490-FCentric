package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.response.TongQuanVaiTroResponse;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.BanChayDong;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.BanHang;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.BoSung;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.CanMua;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.CauHinh;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.ChiSoBan;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.ChiSoKho;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.ChiSoMua;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DangVe;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DatMua;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.Diem;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DiemNhapXuat;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DonHomNay;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DongBoSung;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.DongCanMua;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.GiaoDungHan;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.HangSapVe;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.MuaHang;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.NhaCungCapDong;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.NhanVienKho;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.NhomViec;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.QuanLyKho;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.SapVe;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.SoHomNay;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TheoGio;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TonKho;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TraTonBienThe;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TraTonSanPham;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TrungBinhDon;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.Viec;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.ViecChung;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanAdminRepository.DoanhThuGio;
import com.dev.backend.repository.TongQuanAdminRepository.DoanhThuNgay;
import com.dev.backend.repository.TongQuanAdminRepository.HangCanBoSungDong;
import com.dev.backend.repository.TongQuanAdminRepository.HomNayDong;
import com.dev.backend.repository.TongQuanAdminRepository.KhoDong;
import com.dev.backend.repository.TongQuanAdminRepository.NhapXuatNgay;
import com.dev.backend.repository.TongQuanAdminRepository.SanPhamBanChayDong;
import com.dev.backend.repository.TongQuanAdminRepository.SoDonNgay;
import com.dev.backend.repository.TongQuanAdminRepository.TonKhoTongHopDong;
import com.dev.backend.repository.TongQuanVaiTroRepository;
import com.dev.backend.repository.TongQuanVaiTroRepository.BienTheTim;
import com.dev.backend.repository.TongQuanVaiTroRepository.GiaoHanNcc;
import com.dev.backend.repository.TongQuanVaiTroRepository.NhaCungCapGiaTri;
import com.dev.backend.repository.TongQuanVaiTroRepository.SanPhamTim;
import com.dev.backend.repository.TongQuanVaiTroRepository.ViecQuanLyKho;
import com.dev.backend.repository.TongQuanVaiTroRepository.YeuCauMo;
import com.dev.backend.services.JwtService;
import com.dev.backend.services.impl.multitable.KhaDungChuyenKhoService.KhaDungChuyen;
import com.dev.backend.services.multitable.TongQuanVaiTroService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.text.Normalizer;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_BAN_CHAY;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_BAO_GIA;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_BO_SUNG;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_CAN_MUA;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_CHI_SO;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_CUA_BAN;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_DON;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_HOM_NAY;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_LICH;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_NGHIEP_VU;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_NHAP_XUAT;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_NHA_CUNG_CAP;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_QUY_TRINH;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_SAP_VE;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_THEO_GIO;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_TON_KHO;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_VIEC;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.KHOI_VIEC_CHUNG;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.VAI_TRO_BAN_HANG;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.VAI_TRO_MUA_HANG;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.VAI_TRO_NHAN_VIEN_KHO;
import static com.dev.backend.dto.response.TongQuanVaiTroResponse.VAI_TRO_QUAN_LY_KHO;
import static com.dev.backend.services.impl.multitable.TongQuanAdminServiceImpl.HE_SO_DU_MAC_DINH;
import static com.dev.backend.services.impl.multitable.TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH;
import static com.dev.backend.services.impl.multitable.TongQuanAdminServiceImpl.so;

/**
 * Tổng quan theo vai trò. Mỗi khối tính riêng (lỗi một khối không làm hỏng cả màn), giữ kết quả 60 giây cho mỗi
 * (vai trò, người dùng, kho). Số liệu dùng chung cách tính với Tổng quan quản trị (TongQuanAdminRepository) để
 * cùng một số ở hai màn luôn bằng nhau.
 */
@Service
public class TongQuanVaiTroServiceImpl implements TongQuanVaiTroService {

    private static final Logger log = LoggerFactory.getLogger(TongQuanVaiTroServiceImpl.class);

    /** Thứ tự chọn vai trò khi tài khoản có nhiều vai trò (cùng thứ tự với Dashboard.jsx). */
    static final List<String> THU_TU_VAI_TRO = List.of(VAI_TRO_QUAN_LY_KHO, VAI_TRO_NHAN_VIEN_KHO, VAI_TRO_BAN_HANG,
            VAI_TRO_MUA_HANG);

    /* Cấu hình hệ thống (cau_hinh_he_thong) và giá trị dùng khi chưa cấu hình */
    static final String CH_GIO_CHO_LAU = "PICK_WAIT_WARN_HOURS";
    static final String CH_NGAY_CHO_BAO_GIA = "RFQ_WAIT_WARN_DAYS";
    static final String CH_NGAY_THEO_DOI_BAO_GIA = "QUOTE_FOLLOWUP_DAYS";
    static final int GIO_CHO_LAU_MAC_DINH = 2;
    static final int NGAY_CHO_BAO_GIA_MAC_DINH = 2;
    static final int NGAY_THEO_DOI_BAO_GIA_MAC_DINH = 3;

    static final int SO_DONG_BO_SUNG = 3;
    static final int SO_DONG_VIEC = 8;
    static final int SO_PHIEU_NHAT_CUA_BAN = 10;
    static final int SO_DONG_SAP_VE = 8;
    static final int SO_DONG_LICH = 100;
    static final int SO_NHA_CUNG_CAP = 5;
    static final int SO_DONG_CAN_MUA = 5;
    static final int SO_MA_XET_CAN_MUA = 500;
    static final int SO_DON_CUA_TOI = 50;
    static final int SO_BAO_GIA = 50;
    static final int SO_BAN_CHAY = 5;
    static final int SO_SAN_PHAM_TRA_TON = 6;
    static final int DO_DAI_TU_KHOA_TOI_DA = 100;

    static final long THOI_GIAN_GIU_MS = 60_000;
    private static final DateTimeFormatter DINH_DANG_THOI_DIEM = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private record BanDaTinh(long luc, TongQuanVaiTroResponse duLieu) {}

    private final TongQuanAdminRepository admin;
    private final TongQuanVaiTroRepository repo;
    private final KhaDungChuyenKhoService khaDungChuyenKhoService;
    private final BanDuocTaiQuayService banDuocTaiQuayService;
    private final JwtService jwtService;
    private final Map<String, BanDaTinh> banDaTinh = new ConcurrentHashMap<>();

    public TongQuanVaiTroServiceImpl(TongQuanAdminRepository admin, TongQuanVaiTroRepository repo,
                                     KhaDungChuyenKhoService khaDungChuyenKhoService,
                                     BanDuocTaiQuayService banDuocTaiQuayService, JwtService jwtService) {
        this.admin = admin;
        this.repo = repo;
        this.khaDungChuyenKhoService = khaDungChuyenKhoService;
        this.banDuocTaiQuayService = banDuocTaiQuayService;
        this.jwtService = jwtService;
    }

    /* ======================================================================
     * VÀO
     * ====================================================================== */

    @Override
    @Transactional(readOnly = true)
    public TongQuanVaiTroResponse layTongQuanCuaToi(String vaiTro, boolean lamMoi) {
        NguoiDungAuthInfo nguoiDung = nguoiDungHienTai();
        String vaiTroXem = chonVaiTro(nguoiDung.getVaiTro(), vaiTro);
        KhoDong kho = VAI_TRO_MUA_HANG.equals(vaiTroXem) ? null : khoLamViec(nguoiDung);

        String khoa = vaiTroXem + "|" + nguoiDung.getId() + "|" + (kho == null ? "-" : kho.id());
        long bayGioMs = System.currentTimeMillis();
        BanDaTinh daTinh = banDaTinh.get(khoa);
        if (!lamMoi && daTinh != null && bayGioMs - daTinh.luc() < THOI_GIAN_GIU_MS) {
            return daTinh.duLieu();
        }
        TongQuanVaiTroResponse ketQua = tinh(vaiTroXem, nguoiDung.getId(), kho);
        // Bỏ các bản đã hết hạn để bộ nhớ không lớn dần theo số người dùng
        banDaTinh.entrySet().removeIf(e -> bayGioMs - e.getValue().luc() >= THOI_GIAN_GIU_MS);
        if (ketQua.khoiLoi().isEmpty()) {
            banDaTinh.put(khoa, new BanDaTinh(bayGioMs, ketQua));
        }
        return ketQua;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TraTonSanPham> traTon(String tuKhoa) {
        NguoiDungAuthInfo nguoiDung = nguoiDungHienTai();
        KhoDong kho = khoLamViec(nguoiDung);
        return traTon(kho.id(), tuKhoa);
    }

    private static NguoiDungAuthInfo nguoiDungHienTai() {
        NguoiDungAuthInfo nguoiDung = SecurityContextHolder.getUser();
        if (nguoiDung == null || nguoiDung.getId() == null) {
            throw new CommonException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn", HttpStatus.UNAUTHORIZED, null);
        }
        return nguoiDung;
    }

    /**
     * Vai trò để dựng màn: vai trò giao diện yêu cầu nếu người dùng có vai trò đó, nếu không thì vai trò đầu tiên
     * người dùng có theo THU_TU_VAI_TRO. Quản trị viên (không có vai trò nào khác) xem Tổng quan quản trị.
     */
    static String chonVaiTro(Set<String> cuaNguoiDung, String yeuCau) {
        Set<String> co = cuaNguoiDung == null ? Set.of() : cuaNguoiDung;
        if (yeuCau != null && THU_TU_VAI_TRO.contains(yeuCau.trim()) && co.contains(yeuCau.trim())) {
            return yeuCau.trim();
        }
        return THU_TU_VAI_TRO.stream().filter(co::contains).findFirst().orElseThrow(() -> new CommonException(
                "Màn này dành cho quản lý kho và nhân viên. Quản trị viên xem ở Tổng quan quản trị."));
    }

    /** Kho làm việc (header kho_id): phải được phân quyền cho người dùng và đang hoạt động. */
    private KhoDong khoLamViec(NguoiDungAuthInfo nguoiDung) {
        Integer khoId = SecurityContextHolder.getKhoId();
        if (khoId == null) {
            throw new CommonException("Bạn chưa chọn kho làm việc, vui lòng chọn kho");
        }
        if (nguoiDung.getPhanQuyenNguoiDungKhos() == null || !jwtService.inWorkspace(khoId, nguoiDung)) {
            throw new CommonException("Bạn không thuộc kho đang chọn, vui lòng chọn lại kho", HttpStatus.FORBIDDEN, null);
        }
        return admin.danhSachKho().stream().filter(k -> k.id().equals(khoId)).findFirst()
                .orElseThrow(() -> new CommonException("Kho làm việc không hợp lệ hoặc đã ngừng hoạt động, vui lòng chọn kho khác"));
    }

    /* ======================================================================
     * TÍNH
     * ====================================================================== */

    /** Bối cảnh của một lần tính: thời điểm, ngưỡng cấu hình, danh sách khối lỗi. */
    private final class BoiCanh {
        final LocalDateTime bayGio = admin.thoiDiemHienTai();
        final LocalDate homNay = bayGio.toLocalDate();
        final LocalDateTime dauNgay = homNay.atStartOfDay();
        final List<String> khoiLoi = Collections.synchronizedList(new ArrayList<>());
        final CauHinh cauHinh = new CauHinh(
                cauHinh(CH_GIO_CHO_LAU, GIO_CHO_LAU_MAC_DINH),
                cauHinh(CH_NGAY_CHO_BAO_GIA, NGAY_CHO_BAO_GIA_MAC_DINH),
                cauHinh(CH_NGAY_THEO_DOI_BAO_GIA, NGAY_THEO_DOI_BAO_GIA_MAC_DINH));
        final int nguong = cauHinh("DEFAULT_MIN_STOCK_ALERT", NGUONG_TON_MAC_DINH);
        final int heSoDu = cauHinh("SURPLUS_STOCK_RATIO", HE_SO_DU_MAC_DINH);
        final LocalDateTime mocChoLau = bayGio.minusHours(cauHinh.gioChoLau());

        LocalDateTime ngay(int lech) {
            return homNay.plusDays(lech).atStartOfDay();
        }

        <T> T chay(String khoi, Supplier<T> viec) {
            try {
                return viec.get();
            } catch (RuntimeException e) {
                log.error("Tổng quan theo vai trò: không tải được khối {}", khoi, e);
                if (!khoiLoi.contains(khoi)) khoiLoi.add(khoi);
                return null;
            }
        }
    }

    TongQuanVaiTroResponse tinh(String vaiTro, Integer nguoiDungId, KhoDong kho) {
        BoiCanh bc = new BoiCanh();
        List<KhoDong> dsKho = admin.danhSachKho();
        KhoDong khoTong = dsKho.stream().filter(KhoDong::laKhoTong).findFirst().orElse(null);
        QuanLyKho qlk = null;
        TongQuanVaiTroResponse.NhanVienKho nvk = null;
        MuaHang mh = null;
        BanHang bh = null;
        switch (vaiTro) {
            case VAI_TRO_QUAN_LY_KHO -> qlk = tinhQuanLyKho(bc, kho, khoTong);
            case VAI_TRO_NHAN_VIEN_KHO -> nvk = tinhNhanVienKho(bc, kho.id(), nguoiDungId);
            case VAI_TRO_MUA_HANG -> mh = tinhMuaHang(bc, khoTong);
            case VAI_TRO_BAN_HANG -> bh = tinhBanHang(bc, kho.id(), nguoiDungId);
            default -> throw new CommonException("Vai trò không hợp lệ");
        }
        TongQuanVaiTroResponse.Kho khoTraVe = kho == null ? null : new TongQuanVaiTroResponse.Kho(kho.id(),
                kho.tenKho(), kho.laKhoTong(), khoTong == null ? null : khoTong.id());
        return new TongQuanVaiTroResponse(vaiTro, bc.bayGio.format(DINH_DANG_THOI_DIEM), khoTraVe, bc.cauHinh,
                List.copyOf(bc.khoiLoi), qlk, nvk, mh, bh);
    }

    /* ---------------------------- Quản lý kho ---------------------------- */

    private QuanLyKho tinhQuanLyKho(BoiCanh bc, KhoDong kho, KhoDong khoTong) {
        Integer k = kho.id();
        ChiSoKho chiSo = bc.chay(KHOI_CHI_SO, () -> {
            Map<LocalDate, NhapXuatNgay> nx = theoNgay(admin.nhapXuatTheoNgay(bc.ngay(-6), bc.ngay(1), k));
            List<Diem> nhap7 = new ArrayList<>();
            List<Diem> xuat7 = new ArrayList<>();
            for (int i = 6; i >= 0; i--) {
                LocalDate d = bc.homNay.minusDays(i);
                NhapXuatNgay r = nx.get(d);
                nhap7.add(new Diem(d.toString(), r == null ? 0 : so(r.nhap())));
                xuat7.add(new Diem(d.toString(), r == null ? 0 : so(r.xuat())));
            }
            long[] homQua = repo.nhapXuatKhoang(k, bc.ngay(-1), bc.bayGio.minusDays(1));
            long[] soPhieu = repo.soPhieuNhapXuat(k, bc.dauNgay, bc.bayGio);
            SoHomNay nhap = new SoHomNay(cuoi(nhap7), homQua[0], nhap7, soPhieu[0]);
            SoHomNay xuat = new SoHomNay(cuoi(xuat7), homQua[1], xuat7, soPhieu[1]);
            SoHomNay doanhThu = null;
            if (!kho.laKhoTong()) {
                HomNayDong h = admin.homNay(bc.bayGio, k);
                List<Diem> dt7 = bayNgayDoanhThu(bc, admin.doanhThuTheoNgay(bc.ngay(-6), bc.ngay(1), k), so(h.doanhThu()));
                doanhThu = new SoHomNay(so(h.doanhThu()), so(h.doanhThuCungGioTuanTruoc()), dt7, h.soDonGiao());
            }
            return new ChiSoKho(nhap, xuat, doanhThu, repo.donChoXuat(k, bc.mocChoLau));
        });

        TonKhoTongHopDong tongHop = bc.chay(KHOI_TON_KHO, () -> admin.tonKhoTongHop(k, bc.nguong, bc.heSoDu));
        TonKho tonKho = tongHop == null ? null : new TonKho(so(tongHop.khaDung()), so(tongHop.giaTri()),
                tongHop.soDong(), tongHop.hetHang(), tongHop.thieuHang(), tongHop.binhThuong(), tongHop.duHang());

        var nghiepVu = bc.chay(KHOI_NGHIEP_VU, () -> repo.nghiepVu(k, bc.dauNgay, bc.mocChoLau));
        List<Viec> viec = bc.chay(KHOI_VIEC, () -> danhSachViec(repo.viecQuanLyKho(k), bc.mocChoLau));

        List<DiemNhapXuat> nhapXuat = bc.chay(KHOI_NHAP_XUAT, () -> {
            Map<LocalDate, NhapXuatNgay> nx = theoNgay(admin.nhapXuatTheoNgay(bc.ngay(-29), bc.ngay(1), k));
            List<DiemNhapXuat> ds = new ArrayList<>();
            for (int i = 29; i >= 0; i--) {
                LocalDate d = bc.homNay.minusDays(i);
                NhapXuatNgay r = nx.get(d);
                ds.add(new DiemNhapXuat(d.toString(), r == null ? 0 : so(r.nhap()), r == null ? 0 : so(r.xuat())));
            }
            return ds;
        });

        BoSung boSung = bc.chay(KHOI_BO_SUNG, () -> tinhBoSung(bc, kho, khoTong, tongHop));
        return new QuanLyKho(chiSo, tonKho, nghiepVu, viec, nhapXuat, boSung);
    }

    /** Việc chờ quản lý kho, chỉ dòng có số; gấp lên trước (giữ thứ tự gốc trong cùng mức). */
    static List<Viec> danhSachViec(ViecQuanLyKho v, LocalDateTime mocChoLau) {
        List<Viec> ds = new ArrayList<>();
        if (v.yeuCauChoDuyet() > 0) {
            ds.add(new Viec("duyet_yeu_cau_nhap", v.yeuCauChoDuyet(), v.yeuCauCuNhat(), null, true));
        }
        if (v.phieuChuyenChoDuyet() > 0) {
            ds.add(new Viec("duyet_phieu_chuyen", v.phieuChuyenChoDuyet(), v.phieuChuyenCuNhat(), null, true));
        }
        if (v.phieuChuyenChoXuLyLech() > 0) {
            ds.add(new Viec("xu_ly_chenh_lech_chuyen", v.phieuChuyenChoXuLyLech(), v.phieuChuyenLechCuNhat(), null, true));
        }
        if (v.donChoGomPhieu() > 0) {
            ds.add(new Viec("gom_phieu_nhat", v.donChoGomPhieu(), v.donChoGomCuNhat(), null,
                    truocMoc(v.donChoGomCuNhat(), mocChoLau)));
        }
        if (v.phieuNhatChuaPhanCong() > 0) {
            ds.add(new Viec("phan_cong_nhat", v.phieuNhatChuaPhanCong(), v.phieuNhatCuNhat(), null,
                    truocMoc(v.phieuNhatCuNhat(), mocChoLau)));
        }
        if (v.dotKiemKeMo() > 0) {
            ds.add(new Viec("hoan_tat_kiem_ke", v.dotKiemKeMo(), v.dotKiemKeCuNhat(), v.tenDotKiemKeCuNhat(), false));
        }
        ds.sort(Comparator.comparing((Viec x) -> !x.gap()));
        return ds;
    }

    private static boolean truocMoc(String thoiDiem, LocalDateTime moc) {
        return thoiDiem != null && LocalDateTime.parse(thoiDiem, DINH_DANG_THOI_DIEM).isBefore(moc);
    }

    /**
     * Mã Hết / Sắp hết của kho, tệ nhất trước. Cửa hàng: chuyển từ Kho tổng khi Kho tổng còn đủ (cùng phép kiểm khi
     * tạo yêu cầu chuyển kho), nếu không thì cần nhập về Kho tổng. Kho tổng: cần nhập từ nhà cung cấp.
     */
    private BoSung tinhBoSung(BoiCanh bc, KhoDong kho, KhoDong khoTong, TonKhoTongHopDong tongHop) {
        List<HangCanBoSungDong> dong = admin.hangCanBoSung(kho.id(), bc.nguong, SO_DONG_BO_SUNG);
        List<Integer> ids = dong.stream().map(HangCanBoSungDong::bienTheId).toList();
        Map<Integer, KhaDungChuyen> khoTongChuyen = (kho.laKhoTong() || khoTong == null) ? Map.of()
                : khaDungChuyenKhoService.theoBienThe(khoTong.id(), ids);
        Map<Integer, YeuCauMo> yeuCau = repo.yeuCauMoTheoBienThe(ids);
        List<DongBoSung> ketQua = new ArrayList<>();
        for (HangCanBoSungDong r : dong) {
            long khaDung = so(r.khaDung());
            KhaDungChuyen kt = khoTongChuyen.get(r.bienTheId());
            // Làm tròn xuống như Tổng quan quản trị: số điền sẵn ở nút "Chuyển" luôn tạo được phiếu
            Long khaDungKhoTong = kt == null ? null : kt.khaDung().setScale(0, RoundingMode.FLOOR).longValue();
            long canBoSung = TongQuanAdminServiceImpl.soLuongDeXuat(khaDung, r.nguong());
            String deXuat = TongQuanAdminServiceImpl.deXuat(kho.laKhoTong(), khaDungKhoTong, canBoSung);
            YeuCauMo yc = yeuCau.get(r.bienTheId());
            ketQua.add(new DongBoSung(r.bienTheId(), r.maSku(), r.tenSanPham(), r.tenMau(), r.tenKichCo(), khaDung,
                    r.nguong(), khaDungKhoTong, deXuat, canBoSung, yc == null ? null : yc.id(),
                    yc == null ? null : yc.ma()));
        }
        long tongSo = tongHop != null ? tongHop.hetHang() + tongHop.thieuHang() : ketQua.size();
        return new BoSung(tongSo, ketQua);
    }

    /* ---------------------------- Nhân viên kho ---------------------------- */

    private NhanVienKho tinhNhanVienKho(BoiCanh bc, Integer k, Integer nguoiDungId) {
        var cuaBan = bc.chay(KHOI_CUA_BAN, () -> repo.phieuNhatCuaBan(k, nguoiDungId, SO_PHIEU_NHAT_CUA_BAN));
        var homNay = bc.chay(KHOI_HOM_NAY, () -> repo.homNayCuaBan(k, nguoiDungId, bc.dauNgay, bc.bayGio));
        ViecChung viecChung = bc.chay(KHOI_VIEC_CHUNG, () -> new ViecChung(
                new NhomViec(repo.demNhanHang(k), repo.viecNhanHang(k, bc.mocChoLau, SO_DONG_VIEC)),
                new NhomViec(repo.demNhatHang(k), repo.viecNhatHang(k, bc.mocChoLau, SO_DONG_VIEC)),
                new NhomViec(repo.demDongGoi(k), repo.viecDongGoi(k, bc.mocChoLau, SO_DONG_VIEC)),
                new NhomViec(repo.demXuatKho(k), repo.viecXuatKho(k, bc.mocChoLau, SO_DONG_VIEC)),
                new NhomViec(repo.demKiemKe(k), repo.viecKiemKe(k, SO_DONG_VIEC))));
        SapVe sapVe = bc.chay(KHOI_SAP_VE, () -> {
            List<HangSapVe> ds = new ArrayList<>(repo.hangSapVe(k, bc.dauNgay, bc.ngay(7), SO_DONG_SAP_VE));
            ds.sort(THU_TU_SAP_VE);
            return new SapVe(repo.demHangSapVe(k, bc.ngay(7)),
                    List.copyOf(ds.subList(0, Math.min(SO_DONG_SAP_VE, ds.size()))));
        });
        return new NhanVienKho(cuaBan, homNay, viecChung, sapVe);
    }

    /** Đơn mua đã trễ trước, rồi phiếu chuyển đang trên đường, rồi đơn mua theo ngày giao dự kiến. */
    static final Comparator<HangSapVe> THU_TU_SAP_VE = Comparator
            .comparingInt((HangSapVe h) -> h.tre() ? 0 : "phieu_chuyen".equals(h.loai()) ? 1 : 2)
            .thenComparing(h -> h.ngay() == null ? "" : h.ngay())
            .thenComparing(HangSapVe::id);

    /* ---------------------------- Nhân viên mua hàng ---------------------------- */

    private MuaHang tinhMuaHang(BoiCanh bc, KhoDong khoTong) {
        // Đến hạn giao 30 ngày qua (không gồm hôm nay), dùng cho thẻ và cho từng nhà cung cấp
        List<GiaoHanNcc> hanKyNay = bc.chay(KHOI_NHA_CUNG_CAP, () -> repo.giaoDungHan(bc.ngay(-30), bc.dauNgay));

        ChiSoMua chiSo = bc.chay(KHOI_CHI_SO, () -> {
            Map<LocalDate, BigDecimal> theoNgay = repo.datMuaTheoNgay(bc.ngay(-59), bc.ngay(1));
            long tong = congTien(theoNgay, bc.homNay.minusDays(29), bc.homNay);
            long truoc = congTien(theoNgay, bc.homNay.minusDays(59), bc.homNay.minusDays(30));
            List<Diem> tamTuan = new ArrayList<>();
            for (int w = 7; w >= 0; w--) {
                LocalDate cuoiTuan = bc.homNay.minusDays(7L * w);
                LocalDate dauTuan = cuoiTuan.minusDays(6);
                tamTuan.add(new Diem(dauTuan.toString(), congTien(theoNgay, dauTuan, cuoiTuan)));
            }
            List<GiaoHanNcc> nay = hanKyNay != null ? hanKyNay : repo.giaoDungHan(bc.ngay(-30), bc.dauNgay);
            List<GiaoHanNcc> truocDo = repo.giaoDungHan(bc.ngay(-60), bc.ngay(-30));
            GiaoDungHan giao = new GiaoDungHan(
                    nay.stream().mapToLong(GiaoHanNcc::dungHan).sum(), nay.stream().mapToLong(GiaoHanNcc::denHan).sum(),
                    truocDo.stream().mapToLong(GiaoHanNcc::dungHan).sum(),
                    truocDo.stream().mapToLong(GiaoHanNcc::denHan).sum());
            return new ChiSoMua(new DatMua(tong, truoc, tamTuan),
                    new DangVe(so(admin.hangDangVe(null)), repo.demDonDangVe()), giao,
                    repo.choBaoGia(bc.bayGio.minusDays(bc.cauHinh.ngayChoBaoGia())));
        });

        var quyTrinh = bc.chay(KHOI_QUY_TRINH,
                () -> repo.quyTrinh(bc.dauNgay, bc.bayGio.minusDays(bc.cauHinh.ngayChoBaoGia())));
        var lich = bc.chay(KHOI_LICH, () -> repo.lichHangVe(bc.dauNgay, bc.ngay(7), SO_DONG_LICH));

        List<NhaCungCapDong> nhaCungCap = hanKyNay == null ? null : bc.chay(KHOI_NHA_CUNG_CAP, () -> {
            Map<Integer, GiaoHanNcc> han = new HashMap<>();
            hanKyNay.forEach(h -> han.put(h.nccId(), h));
            List<NhaCungCapDong> ds = new ArrayList<>();
            for (NhaCungCapGiaTri n : repo.nhaCungCapNhieuNhat(bc.ngay(-29), bc.ngay(1), SO_NHA_CUNG_CAP)) {
                GiaoHanNcc h = han.get(n.id());
                ds.add(new NhaCungCapDong(n.id(), n.ten(), so(n.giaTri()), h == null ? 0 : h.dungHan(),
                        h == null ? 0 : h.denHan()));
            }
            return ds;
        });

        CanMua canMua = bc.chay(KHOI_CAN_MUA, () -> tinhCanMua(bc, khoTong));
        return new MuaHang(chiSo, quyTrinh, lich, nhaCungCap, canMua);
    }

    /**
     * Mã Hết / Sắp hết ở Kho tổng mà cả phần đang về từ nhà cung cấp cũng chưa đưa lên quá ngưỡng.
     * Đề xuất đưa (khả dụng + đang về) lên gấp đôi ngưỡng, cùng quy tắc với Tổng quan quản trị.
     */
    private CanMua tinhCanMua(BoiCanh bc, KhoDong khoTong) {
        if (khoTong == null) return new CanMua(0, null, List.of());
        List<HangCanBoSungDong> dong = admin.hangCanBoSung(khoTong.id(), bc.nguong, SO_MA_XET_CAN_MUA);
        Map<Integer, Long> dangVe = repo.dangVeTheoBienThe(khoTong.id(),
                dong.stream().map(HangCanBoSungDong::bienTheId).toList());
        List<HangCanBoSungDong> conThieu = dong.stream()
                .filter(r -> so(r.khaDung()) + dangVe.getOrDefault(r.bienTheId(), 0L) <= r.nguong())
                .toList();
        List<HangCanBoSungDong> hien = conThieu.subList(0, Math.min(SO_DONG_CAN_MUA, conThieu.size()));
        Map<Integer, YeuCauMo> yeuCau = repo.yeuCauMoTheoBienThe(hien.stream().map(HangCanBoSungDong::bienTheId).toList());
        List<DongCanMua> ketQua = new ArrayList<>();
        for (HangCanBoSungDong r : hien) {
            long kd = so(r.khaDung());
            long dv = dangVe.getOrDefault(r.bienTheId(), 0L);
            YeuCauMo yc = yeuCau.get(r.bienTheId());
            ketQua.add(new DongCanMua(r.bienTheId(), r.maSku(), r.tenSanPham(), r.tenMau(), r.tenKichCo(), kd, dv,
                    r.nguong(), TongQuanAdminServiceImpl.soLuongDeXuat(kd + dv, r.nguong()),
                    yc == null ? null : yc.id(), yc == null ? null : yc.ma()));
        }
        return new CanMua(conThieu.size(), khoTong.id(), ketQua);
    }

    /* ---------------------------- Nhân viên bán hàng ---------------------------- */

    private BanHang tinhBanHang(BoiCanh bc, Integer k, Integer nguoiDungId) {
        ChiSoBan chiSo = bc.chay(KHOI_CHI_SO, () -> {
            HomNayDong h = admin.homNay(bc.bayGio, k);
            List<DoanhThuNgay> muoiBonNgay = admin.doanhThuTheoNgay(bc.ngay(-13), bc.ngay(1), k);
            List<Diem> dt7 = bayNgayDoanhThu(bc, muoiBonNgay, so(h.doanhThu()));
            SoHomNay doanhThu = new SoHomNay(so(h.doanhThu()), so(h.doanhThuCungGioTuanTruoc()), dt7, h.soDonGiao());

            Map<LocalDate, SoDonNgay> donNgay = new HashMap<>();
            admin.soDonMoiTheoNgay(bc.ngay(-6), bc.ngay(1), k).forEach(r -> donNgay.put(r.ngay(), r));
            List<Diem> don7 = new ArrayList<>();
            for (int i = 6; i >= 0; i--) {
                LocalDate d = bc.homNay.minusDays(i);
                don7.add(new Diem(d.toString(), i == 0 ? h.soDonMoi() : donNgay.containsKey(d) ? donNgay.get(d).soDon() : 0));
            }
            DonHomNay donHomNay = new DonHomNay(h.soDonMoi(), repo.demDonTaiQuay(k, bc.dauNgay, bc.bayGio),
                    h.soDonMoiCungGioTuanTruoc(), don7);

            return new ChiSoBan(doanhThu, donHomNay, trungBinhDon(bc, muoiBonNgay, h),
                    repo.donCuaToiTom(nguoiDungId, bc.mocChoLau));
        });

        TheoGio theoGio = bc.chay(KHOI_THEO_GIO, () -> {
            int gio = bc.bayGio.getHour();
            long[] nay = new long[gio + 1];
            for (DoanhThuGio r : admin.doanhThuTheoGio(bc.dauNgay, bc.bayGio, k)) {
                if (r.gio() >= 0 && r.gio() <= gio) nay[r.gio()] += so(r.doanhThu());
            }
            long[] truoc = new long[24];
            for (DoanhThuGio r : admin.doanhThuTheoGio(bc.ngay(-7), bc.ngay(-6).minusSeconds(1), k)) {
                if (r.gio() >= 0 && r.gio() < 24) truoc[r.gio()] += so(r.doanhThu());
            }
            return new TheoGio(gio, danhSach(nay), danhSach(truoc));
        });

        var don = bc.chay(KHOI_DON, () -> repo.donCuaToi(nguoiDungId, bc.mocChoLau, SO_DON_CUA_TOI));
        var baoGia = bc.chay(KHOI_BAO_GIA, () -> repo.baoGiaCuaToi(nguoiDungId,
                bc.bayGio.minusDays(bc.cauHinh.ngayTheoDoiBaoGia()), SO_BAO_GIA));

        List<BanChayDong> banChay = bc.chay(KHOI_BAN_CHAY, () -> {
            List<SanPhamBanChayDong> dong = admin.sanPhamBanChay(bc.ngay(-6), bc.ngay(1), k, SO_BAN_CHAY);
            Map<Integer, BigDecimal> con = admin.khaDungTheoSanPham(
                    dong.stream().map(SanPhamBanChayDong::sanPhamId).toList(), k);
            return dong.stream().map(r -> new BanChayDong(r.sanPhamId(), r.maSanPham(), r.tenSanPham(),
                    so(r.soLuong()), Math.max(0, so(con.get(r.sanPhamId()))))).toList();
        });
        return new BanHang(chiSo, theoGio, don, baoGia, banChay);
    }

    /**
     * Giá trị trung bình mỗi đơn đã giao: hôm nay (đến bây giờ), 7 ngày trước hôm nay và từng ngày của 7 ngày gần nhất
     * (ngày không có đơn = 0).
     */
    static TrungBinhDon trungBinhDonTu(LocalDate homNay, List<DoanhThuNgay> muoiBonNgay, long doanhThuHomNay,
                                       long soDonHomNay) {
        Map<LocalDate, DoanhThuNgay> m = new HashMap<>();
        muoiBonNgay.forEach(r -> m.put(r.ngay(), r));
        long dtTruoc = 0;
        long donTruoc = 0;
        for (int i = 7; i >= 1; i--) {
            DoanhThuNgay r = m.get(homNay.minusDays(i));
            if (r != null) {
                dtTruoc += so(r.doanhThu());
                donTruoc += r.soDon();
            }
        }
        List<Diem> bayNgay = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = homNay.minusDays(i);
            long dt;
            long sd;
            if (i == 0) {
                dt = doanhThuHomNay;
                sd = soDonHomNay;
            } else {
                DoanhThuNgay r = m.get(d);
                dt = r == null ? 0 : so(r.doanhThu());
                sd = r == null ? 0 : r.soDon();
            }
            bayNgay.add(new Diem(d.toString(), sd > 0 ? chia(dt, sd) : 0));
        }
        return new TrungBinhDon(soDonHomNay > 0 ? chia(doanhThuHomNay, soDonHomNay) : null,
                donTruoc > 0 ? chia(dtTruoc, donTruoc) : null, bayNgay);
    }

    private static TrungBinhDon trungBinhDon(BoiCanh bc, List<DoanhThuNgay> muoiBonNgay, HomNayDong h) {
        return trungBinhDonTu(bc.homNay, muoiBonNgay, so(h.doanhThu()), h.soDonGiao());
    }

    /* ======================================================================
     * TRA TỒN
     * ====================================================================== */

    List<TraTonSanPham> traTon(Integer khoId, String tuKhoa) {
        String goc = chuanHoaTuKhoa(tuKhoa);
        if (goc.length() < 2) return List.of();
        String mau = thoatLike(goc.replace('đ', 'd'));
        List<SanPhamTim> sanPham = repo.timSanPham(mau, goc, SO_SAN_PHAM_TRA_TON);
        if (sanPham.isEmpty()) return List.of();
        List<BienTheTim> bienThes = repo.tonBienThe(khoId, sanPham.stream().map(SanPhamTim::id).toList());
        // "Tại kho" = số bán được tại quầy: mã đang bị phiếu nhặt / phiếu xuất bán / phiếu chuyển giữ ở kho tính lại theo
        // lô, cùng công thức với danh mục POS và bước thanh toán
        Map<Integer, BigDecimal> banDuoc = banDuocTaiQuayService.banDuocCuaMaDangGiu(khoId,
                bienThes.stream().map(b -> b.bienThe().id()).toList());
        Map<Integer, List<BienTheTim>> theoSanPham = new LinkedHashMap<>();
        for (BienTheTim b : bienThes) {
            theoSanPham.computeIfAbsent(b.sanPhamId(), x -> new ArrayList<>())
                    .add(voiTaiKho(b, banDuoc.get(b.bienThe().id())));
        }
        List<TraTonSanPham> ketQua = new ArrayList<>();
        for (SanPhamTim sp : sanPham) {
            List<BienTheTim> bt = theoSanPham.getOrDefault(sp.id(), List.of());
            Long thap = null;
            Long cao = null;
            for (BienTheTim b : bt) {
                if (b.giaBan() == null) continue;
                long g = so(b.giaBan());
                thap = thap == null ? g : Math.min(thap, g);
                cao = cao == null ? g : Math.max(cao, g);
            }
            List<TraTonBienThe> bien = bt.stream().map(BienTheTim::bienThe).toList();
            ketQua.add(new TraTonSanPham(sp.id(), sp.ma(), sp.ten(), thap, cao, bien));
        }
        return ketQua;
    }

    /** Thay "Tại kho" bằng số bán được đã tính lại (null = mã không bị giữ, giữ số SQL). */
    private static BienTheTim voiTaiKho(BienTheTim b, BigDecimal banDuoc) {
        if (banDuoc == null) return b;
        TraTonBienThe t = b.bienThe();
        return new BienTheTim(b.sanPhamId(), b.giaBan(), new TraTonBienThe(t.id(), t.maSku(), t.tenMau(), t.tenKichCo(),
                Math.max(0, so(banDuoc)), t.khoKhac(), t.dangVe()));
    }

    /**
     * Dựng sẵn dấu (NFC: bộ gõ "tổ hợp" gửi chữ và dấu rời nhau, so khớp LIKE không gộp được), bỏ ký tự không độ rộng
     * (hay dính theo khi dán từ trang web), gộp mọi khoảng trắng (kể cả khoảng trắng không ngắt, khoảng trắng toàn
     * khổ), chữ thường, tối đa DO_DAI_TU_KHOA_TOI_DA ký tự.
     */
    static String chuanHoaTuKhoa(String tuKhoa) {
        if (tuKhoa == null) return "";
        // Bỏ ký tự không độ rộng trước khi dựng dấu: nằm giữa chữ và dấu thì nó chặn việc ghép thành một ký tự
        String s = Normalizer.normalize(tuKhoa.replaceAll("[\\u200B-\\u200D\\u2060\\uFEFF]", ""), Normalizer.Form.NFC)
                .replaceAll("[\\s\\p{Z}]+", " ").strip().toLowerCase(Locale.ROOT);
        return s.length() > DO_DAI_TU_KHOA_TOI_DA ? s.substring(0, DO_DAI_TU_KHOA_TOI_DA) : s;
    }

    /** Thoát ký tự đặc biệt của LIKE (ký tự thoát mặc định là "\"). */
    static String thoatLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /* ======================================================================
     * TIỆN ÍCH
     * ====================================================================== */

    private int cauHinh(String ma, int macDinh) {
        try {
            Integer v = admin.cauHinhSo(ma);
            return v != null && v > 0 ? v : macDinh;
        } catch (RuntimeException e) {
            log.warn("Tổng quan theo vai trò: không đọc được cấu hình {}, dùng {}", ma, macDinh, e);
            return macDinh;
        }
    }

    private static Map<LocalDate, NhapXuatNgay> theoNgay(List<NhapXuatNgay> ds) {
        Map<LocalDate, NhapXuatNgay> m = new HashMap<>();
        ds.forEach(r -> m.put(r.ngay(), r));
        return m;
    }

    /** 7 ngày doanh thu đến hôm nay; điểm hôm nay lấy đúng số của thẻ. */
    private static List<Diem> bayNgayDoanhThu(BoiCanh bc, List<DoanhThuNgay> ds, long homNay) {
        Map<LocalDate, DoanhThuNgay> m = new HashMap<>();
        ds.forEach(r -> m.put(r.ngay(), r));
        List<Diem> kq = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = bc.homNay.minusDays(i);
            DoanhThuNgay r = m.get(d);
            kq.add(new Diem(d.toString(), i == 0 ? homNay : r == null ? 0 : so(r.doanhThu())));
        }
        return kq;
    }

    private static long cuoi(List<Diem> ds) {
        return ds.isEmpty() ? 0 : ds.get(ds.size() - 1).giaTri();
    }

    /** Cộng tiền các ngày trong [tu, den] (cả hai đầu). */
    private static long congTien(Map<LocalDate, BigDecimal> theoNgay, LocalDate tu, LocalDate den) {
        BigDecimal t = BigDecimal.ZERO;
        for (Map.Entry<LocalDate, BigDecimal> e : theoNgay.entrySet()) {
            if (!e.getKey().isBefore(tu) && !e.getKey().isAfter(den)) t = t.add(e.getValue());
        }
        return so(t);
    }

    private static long chia(long tu, long mau) {
        return BigDecimal.valueOf(tu).divide(BigDecimal.valueOf(mau), 0, RoundingMode.HALF_UP).longValue();
    }

    private static List<Long> danhSach(long[] a) {
        List<Long> ds = new ArrayList<>(a.length);
        for (long v : a) ds.add(v);
        return ds;
    }
}
