package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.constant.enums.SortDirection;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.dto.request.SortCriteria;
import com.dev.backend.dto.response.customize.PhieuChuyenKhoDto;
import com.dev.backend.dto.response.customize.TimKiemDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.TuChoiTruyCapException;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.DotKiemKeRepository;
import com.dev.backend.services.JwtService;
import com.dev.backend.services.impl.entities.*;
import com.dev.backend.utils.HienThiBienThe;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.PublicAssetUrl;
import com.dev.backend.utils.SoDienThoai;
import com.dev.backend.utils.TuKhoaTimKiem;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * Ô tìm kiếm toàn hệ thống (Ctrl + K). Mỗi nhóm gọi đúng hàm lọc mà trang danh sách tương ứng dùng, nên phạm vi theo
 * vai trò giống hệt trang danh sách (BR-01); nhóm nào người dùng không được vào trang danh sách thì không tìm (BR-02).
 *
 * <p>Xếp hạng trong nhóm (BR-03, BR-06): khớp chính xác một mã, rồi bắt đầu bằng, rồi chứa; cùng mức giữ thứ tự mới
 * nhất. Mỗi nhóm lấy tối đa {@link #SO_DONG_XEP_HANG} dòng mới nhất khớp "chứa" cộng các dòng khớp chính xác để xếp.</p>
 *
 * <p>Mỗi nhóm (và mỗi loại chứng từ) chạy trong giao dịch chỉ đọc riêng: một nhóm lỗi không làm hỏng nhóm khác (E1).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TimKiemService {

    public static final String SAN_PHAM = "sanPham";
    public static final String DON_BAN = "donBan";
    public static final String KHACH_HANG = "khachHang";
    public static final String NHA_CUNG_CAP = "nhaCungCap";
    public static final String CHUNG_TU = "chungTu";

    static final int SO_DONG_MAC_DINH = 3;
    static final int SO_DONG_TOI_DA = 10;
    static final int SO_DONG_XEP_HANG = 50;
    /** Sản phẩm ngừng hoạt động (san_pham_quan_ao.trang_thai): xếp cuối nhóm (BR-14). */
    static final int SAN_PHAM_NGUNG = 2;
    /** Trạng thái của tab "Tất cả" ở trang Đơn mua hàng (frontend constants/donMuaHang.js). */
    static final List<Integer> TRANG_THAI_DON_MUA = List.of(3, 5, 6, 7);

    private static final Set<String> VAI_TRO_KHO = Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho);

    /** Vai trò được vào trang danh sách của từng nhóm (khớp sidebar.config.js / App.jsx RequireRole). */
    static final Map<String, Set<String>> VAI_TRO_NHOM = Map.of(
            SAN_PHAM, Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_mua_hang, IRoleType.nhan_vien_ban_hang),
            DON_BAN, Set.of(IRoleType.quan_tri_vien, IRoleType.nhan_vien_ban_hang, IRoleType.nhan_vien_kho, IRoleType.quan_ly_kho),
            KHACH_HANG, Set.of(IRoleType.quan_tri_vien, IRoleType.nhan_vien_ban_hang),
            NHA_CUNG_CAP, Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_mua_hang));

    /** Vai trò được vào trang danh sách của từng loại chứng từ. */
    static final Map<String, Set<String>> VAI_TRO_CHUNG_TU = new LinkedHashMap<>();

    static {
        VAI_TRO_CHUNG_TU.put("phieuXuat", VAI_TRO_KHO);
        VAI_TRO_CHUNG_TU.put("phieuNhap", VAI_TRO_KHO);
        VAI_TRO_CHUNG_TU.put("phieuChuyen", VAI_TRO_KHO);
        VAI_TRO_CHUNG_TU.put("donMua", Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_mua_hang, IRoleType.nhan_vien_kho));
        VAI_TRO_CHUNG_TU.put("yeuCauNhap", Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho, IRoleType.nhan_vien_mua_hang));
        VAI_TRO_CHUNG_TU.put("kiemKe", VAI_TRO_KHO);
        VAI_TRO_CHUNG_TU.put("baoGia", Set.of(IRoleType.quan_tri_vien, IRoleType.nhan_vien_ban_hang));
    }

    private static final List<String> THU_TU_NHOM = List.of(SAN_PHAM, DON_BAN, KHACH_HANG, NHA_CUNG_CAP, CHUNG_TU);

    private final SanPhamQuanAoService sanPhamQuanAoService;
    private final DonBanHangService donBanHangService;
    private final KhachHangService khachHangService;
    private final NhaCungCapService nhaCungCapService;
    private final PhieuXuatKhoService phieuXuatKhoService;
    private final PhieuNhapKhoService phieuNhapKhoService;
    private final PhieuChuyenKhoService phieuChuyenKhoService;
    private final DonMuaHangService donMuaHangService;
    private final YeuCauMuaHangService yeuCauMuaHangService;
    private final DotKiemKeRepository dotKiemKeRepository;
    private final AnhQuanAoRepository anhQuanAoRepository;
    private final JwtService jwtService;
    private final EntityManager entityManager;
    private final PlatformTransactionManager transactionManager;

    /**
     * @param q    từ khóa; dưới 2 ký tự trả rỗng
     * @param nhom chỉ tìm một nhóm (tab), bỏ trống = mọi nhóm được xem
     * @param size số dòng mỗi nhóm, 1–10, mặc định 3
     */
    public TimKiemDto tim(String q, String nhom, Integer size) {
        String tk = TuKhoaTimKiem.chuanHoa(q);
        if (tk == null) return new TimKiemDto(List.of());
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        Set<String> vaiTro = user == null || user.getVaiTro() == null ? Set.of() : user.getVaiTro();
        int soDong = size == null ? SO_DONG_MAC_DINH : Math.max(1, Math.min(SO_DONG_TOI_DA, size));

        List<TimKiemDto.Nhom> ketQua = new ArrayList<>();
        for (String key : THU_TU_NHOM) {
            if (nhom != null && !nhom.isBlank() && !nhom.equals(key)) continue;
            if (CHUNG_TU.equals(key)) {
                if (loaiChungTuDuocXem(vaiTro).isEmpty()) continue;
                ketQua.add(boc(key, () -> timChungTu(tk, user, vaiTro, soDong), false));
                continue;
            }
            if (!coVaiTro(vaiTro, VAI_TRO_NHOM.get(key))) continue;
            Supplier<TimKiemDto.Nhom> tim = switch (key) {
                case SAN_PHAM -> () -> timSanPham(tk, soDong);
                case DON_BAN -> () -> timDonBan(tk, soDong);
                case KHACH_HANG -> () -> timKhachHang(tk, soDong);
                default -> () -> timNhaCungCap(tk, soDong);
            };
            ketQua.add(boc(key, tim, true));
        }
        return new TimKiemDto(ketQua);
    }

    static boolean coVaiTro(Set<String> vaiTro, Set<String> duocPhep) {
        return duocPhep != null && vaiTro.stream().anyMatch(duocPhep::contains);
    }

    static List<String> loaiChungTuDuocXem(Set<String> vaiTro) {
        return VAI_TRO_CHUNG_TU.entrySet().stream().filter(e -> coVaiTro(vaiTro, e.getValue())).map(Map.Entry::getKey).toList();
    }

    /** Chạy một nhóm; lỗi thì nhóm đó mang trạng thái "loi", các nhóm khác vẫn trả (E1). */
    private TimKiemDto.Nhom boc(String key, Supplier<TimKiemDto.Nhom> tim, boolean trongGiaoDich) {
        try {
            return trongGiaoDich ? docChi().execute(s -> tim.get()) : tim.get();
        } catch (RuntimeException e) {
            log.warn("Tìm kiếm toàn hệ thống: nhóm {} lỗi: {}", key, e.toString());
            return TimKiemDto.Nhom.builder().key(key).trangThai("loi").tong(0).muc(List.of()).build();
        }
    }

    private TransactionTemplate docChi() {
        TransactionTemplate t = new TransactionTemplate(transactionManager);
        t.setReadOnly(true);
        return t;
    }

    private static TimKiemDto.Nhom xong(String key, long tong, List<TimKiemDto.Muc> muc) {
        return TimKiemDto.Nhom.builder().key(key).trangThai("xong").tong(tong).muc(muc).build();
    }

    private static FilterCriteria loc(String truong, FilterOperation phep, Object giaTri) {
        return FilterCriteria.builder().fieldName(truong).operation(phep).value(giaTri).build();
    }

    private static FilterCriteria tuKhoa(String tk, boolean chinhXac) {
        return loc(TuKhoaTimKiem.TRUONG, chinhXac ? FilterOperation.EQUALS : FilterOperation.LIKE, tk);
    }

    private static BaseFilterRequest yeuCau(List<FilterCriteria> filters, String sapXep, int soDong) {
        return BaseFilterRequest.builder()
                .filters(new ArrayList<>(filters))
                .sorts(new ArrayList<>(List.of(new SortCriteria(sapXep, SortDirection.DESC))))
                .page(0).size(soDong).build();
    }

    /** Gộp dòng khớp chính xác lên trước các dòng khớp "chứa", bỏ trùng theo id, giữ thứ tự. */
    private static <T> List<T> gop(List<T> dung, List<T> chua, Function<T, Integer> id) {
        Map<Integer, T> gop = new LinkedHashMap<>();
        dung.forEach(x -> gop.putIfAbsent(id.apply(x), x));
        chua.forEach(x -> gop.putIfAbsent(id.apply(x), x));
        return new ArrayList<>(gop.values());
    }

    /** Một ứng viên khớp của một dòng: trường, giá trị, nhãn biến thể (nếu có). */
    record UngVien(String truong, String giaTri, String bienThe) {
    }

    /** Mức khớp tốt nhất trong các ứng viên; số điện thoại so sau khi bỏ ký tự ngăn cách. */
    static UngVien totNhat(List<UngVien> ungVien, String tk, int[] muc) {
        String sdt = SoDienThoai.choTimKiem(tk);
        UngVien tot = null;
        int m = 3;
        for (UngVien u : ungVien) {
            if (u.giaTri() == null) continue;
            int x = "sdt".equals(u.truong())
                    ? (sdt == null ? 3 : TuKhoaTimKiem.mucKhop(SoDienThoai.chuanHoa(u.giaTri()), sdt))
                    : TuKhoaTimKiem.mucKhop(u.giaTri(), tk);
            if (x < m) {
                m = x;
                tot = u;
            }
        }
        muc[0] = m;
        return tot;
    }

    /** Gắn mức khớp lên dòng và trả hạng để xếp (0 khớp chính xác mã … 3). */
    private static int danhDau(TimKiemDto.Muc muc, List<UngVien> ungVien, String tk, String tenDeXep) {
        int[] m = new int[1];
        UngVien tot = totNhat(ungVien, tk, m);
        if (tot != null && m[0] <= 2) {
            muc.setKhopChinhXac(m[0] == 0);
            muc.setTruongKhop(tot.truong());
            muc.setGiaTriKhop(tot.giaTri());
            muc.setBienThe(tot.bienThe());
        }
        int hang = m[0];
        // Tên trùng hẳn từ khóa không tính là khớp chính xác (tên không phải mã), chỉ xếp ngang mức "bắt đầu bằng"
        int theoTen = TuKhoaTimKiem.mucKhop(tenDeXep, tk);
        return Math.min(hang, Math.max(theoTen, 1));
    }

    /* ───────────────────────────── Sản phẩm ───────────────────────────── */

    TimKiemDto.Nhom timSanPham(String tk, int soDong) {
        Page<SanPhamQuanAo> chua = sanPhamQuanAoService.filter(yeuCau(List.of(tuKhoa(tk, false)), "ngayTao", SO_DONG_XEP_HANG));
        List<SanPhamQuanAo> dung = sanPhamQuanAoService.filter(yeuCau(List.of(tuKhoa(tk, true)), "ngayTao", SO_DONG_TOI_DA)).getContent();
        List<SanPhamQuanAo> ds = gop(dung, chua.getContent(), SanPhamQuanAo::getId);
        if (ds.isEmpty()) return xong(SAN_PHAM, 0, List.of());

        List<Integer> ids = ds.stream().map(SanPhamQuanAo::getId).toList();
        String mau = TuKhoaTimKiem.mau(tk, false);
        Map<Integer, List<UngVien>> theoBienThe = new HashMap<>();
        for (BienTheSanPham bt : entityManager.createQuery(
                        "select bt from BienTheSanPham bt where bt.sanPham.id in :ids and "
                                + "(lower(bt.maSku) like :m escape '!' or lower(bt.maVachSku) like :m escape '!')", BienTheSanPham.class)
                .setParameter("ids", ids).setParameter("m", mau).getResultList()) {
            String nhan = nhanBienThe(bt);
            List<UngVien> u = theoBienThe.computeIfAbsent(bt.getSanPham().getId(), k -> new ArrayList<>());
            u.add(new UngVien("sku", bt.getMaSku(), nhan));
            u.add(new UngVien("maVachSku", bt.getMaVachSku(), nhan));
        }
        for (MaVachNhaCungCap mv : entityManager.createQuery(
                        "select mv from MaVachNhaCungCap mv join fetch mv.bienTheSanPham bt where bt.sanPham.id in :ids "
                                + "and lower(mv.barcodeNcc) like :m escape '!'", MaVachNhaCungCap.class)
                .setParameter("ids", ids).setParameter("m", mau).getResultList()) {
            theoBienThe.computeIfAbsent(mv.getBienTheSanPham().getSanPham().getId(), k -> new ArrayList<>())
                    .add(new UngVien("maVachNcc", mv.getBarcodeNcc(), nhanBienThe(mv.getBienTheSanPham())));
        }
        Map<Integer, String> anh = new HashMap<>();
        for (AnhQuanAo a : anhQuanAoRepository.findActiveByQuanAoIds(ids)) {
            if (a.getQuanAo() == null || a.getTepTin() == null || a.getTepTin().getDuongDan() == null) continue;
            anh.putIfAbsent(a.getQuanAo().getId(), PublicAssetUrl.toHttps(a.getTepTin().getDuongDan()));
        }

        List<Object[]> xep = new ArrayList<>();
        for (int i = 0; i < ds.size(); i++) {
            SanPhamQuanAo sp = ds.get(i);
            TimKiemDto.Muc muc = TimKiemDto.Muc.builder()
                    .loai(SAN_PHAM).id(sp.getId()).ma(sp.getMaSanPham()).ten(sp.getTenSanPham())
                    .phu(sp.getThuongHieu() == null ? null : sp.getThuongHieu().getTenThuongHieu())
                    .trangThai(sp.getTrangThai()).giaTri(sp.getGiaBanMacDinh()).anh(anh.get(sp.getId()))
                    .build();
            List<UngVien> ungVien = new ArrayList<>();
            ungVien.add(new UngVien("maSanPham", sp.getMaSanPham(), null));
            ungVien.add(new UngVien("maVach", sp.getMaVach(), null));
            ungVien.addAll(theoBienThe.getOrDefault(sp.getId(), List.of()));
            int hang = danhDau(muc, ungVien, tk, sp.getTenSanPham());
            // Đ10: sản phẩm ngừng hoạt động xếp sau mọi sản phẩm đang bán (dòng khớp chính xác vẫn lên khối riêng)
            int ngung = Objects.equals(sp.getTrangThai(), SAN_PHAM_NGUNG) ? 1 : 0;
            xep.add(new Object[]{muc.isKhopChinhXac() ? 0 : 1 + ngung * 10 + hang, 0, i, muc});
        }
        return xong(SAN_PHAM, Math.max(chua.getTotalElements(), dung.size()), xepVaCat(xep, soDong));
    }

    private static String nhanBienThe(BienTheSanPham bt) {
        String mau = HienThiBienThe.tenMau(bt);
        String co = HienThiBienThe.kichCo(bt);
        String nhan = String.join(" / ", Arrays.stream(new String[]{mau, co}).filter(s -> s != null && !s.isBlank()).toList());
        return nhan.isEmpty() ? null : nhan;
    }

    /** Xếp theo (hạng, cờ ngừng hoạt động, thứ tự mới nhất) rồi cắt số dòng. Mỗi phần tử: {hạng, ngừng, chỉ số, Muc}. */
    private static List<TimKiemDto.Muc> xepVaCat(List<Object[]> xep, int soDong) {
        xep.sort(Comparator.<Object[]>comparingInt(x -> (int) x[0])
                .thenComparingInt(x -> (int) x[1])
                .thenComparingInt(x -> (int) x[2]));
        return xep.stream().limit(soDong).map(x -> (TimKiemDto.Muc) x[3]).toList();
    }

    /* ───────────────────────────── Đơn bán ───────────────────────────── */

    TimKiemDto.Nhom timDonBan(String tk, int soDong) {
        FilterCriteria laDonBan = loc("loaiChungTu", FilterOperation.EQUALS, "don_ban_hang");
        Page<DonBanHang> chua = donBanHangService.filter(yeuCau(List.of(laDonBan, tuKhoa(tk, false)), "id", SO_DONG_XEP_HANG));
        List<DonBanHang> dung = donBanHangService.filter(yeuCau(List.of(laDonBan, tuKhoa(tk, true)), "id", SO_DONG_TOI_DA)).getContent();
        List<DonBanHang> ds = gop(dung, chua.getContent(), DonBanHang::getId);
        List<Object[]> xep = new ArrayList<>();
        for (int i = 0; i < ds.size(); i++) {
            DonBanHang d = ds.get(i);
            KhachHang kh = d.getKhachHang();
            TimKiemDto.Muc muc = TimKiemDto.Muc.builder()
                    .loai(DON_BAN).id(d.getId()).ma(d.getSoDonHang())
                    .khach(kh == null ? null : kh.getTenKhachHang())
                    .soDienThoai(kh == null ? null : kh.getSoDienThoai())
                    .kenh(d.getKenhBanHang() == null ? null : d.getKenhBanHang().getTenKenh())
                    .maDonSan(d.getMaDonHangKenh())
                    .ngay(d.getNgayDatHang() != null ? d.getNgayDatHang() : d.getNgayTao())
                    .giaTri(d.getTongCong()).trangThai(d.getTrangThai())
                    .build();
            List<UngVien> ungVien = List.of(
                    new UngVien("soDon", d.getSoDonHang(), null),
                    new UngVien("maDonSan", d.getMaDonHangKenh(), null),
                    new UngVien("sdt", kh == null ? null : kh.getSoDienThoai(), null));
            int hang = danhDau(muc, ungVien, tk, kh == null ? null : kh.getTenKhachHang());
            if ("sdt".equals(muc.getTruongKhop()) && muc.isKhopChinhXac()) {
                // SĐT là mã của khách, không phải của đơn: mọi đơn của khách cùng khớp nên không coi là khớp chính xác,
                // tránh khối "Khớp chính xác" dài và Enter mở nhầm một đơn
                muc.setKhopChinhXac(false);
                hang = 1;
            }
            xep.add(new Object[]{muc.isKhopChinhXac() ? 0 : hang, 0, i, muc});
        }
        return xong(DON_BAN, Math.max(chua.getTotalElements(), dung.size()), xepVaCat(xep, soDong));
    }

    /* ───────────────────────────── Khách hàng ───────────────────────────── */

    TimKiemDto.Nhom timKhachHang(String tk, int soDong) {
        // Như trang Khách hàng: bỏ khách lẻ hệ thống KHLE
        FilterCriteria boKhachLe = loc("maKhachHang", FilterOperation.NOT_IN, List.of(KhachHang.MA_KHACH_LE));
        Page<KhachHang> chua = khachHangService.filter(yeuCau(List.of(boKhachLe, tuKhoa(tk, false)), "ngayTao", SO_DONG_XEP_HANG));
        List<KhachHang> dung = khachHangService.filter(yeuCau(List.of(boKhachLe, tuKhoa(tk, true)), "ngayTao", SO_DONG_TOI_DA)).getContent();
        List<KhachHang> ds = gop(dung, chua.getContent(), KhachHang::getId);
        List<Object[]> xep = new ArrayList<>();
        for (int i = 0; i < ds.size(); i++) {
            KhachHang k = ds.get(i);
            TimKiemDto.Muc muc = TimKiemDto.Muc.builder()
                    .loai(KHACH_HANG).id(k.getId()).ma(k.getMaKhachHang()).ten(k.getTenKhachHang())
                    .soDienThoai(k.getSoDienThoai()).phu(k.getEmail())
                    .build();
            List<UngVien> ungVien = List.of(
                    new UngVien("ma", k.getMaKhachHang(), null),
                    new UngVien("sdt", k.getSoDienThoai(), null),
                    new UngVien("email", k.getEmail(), null));
            int hang = danhDau(muc, ungVien, tk, k.getTenKhachHang());
            xep.add(new Object[]{muc.isKhopChinhXac() ? 0 : hang, 0, i, muc});
        }
        return xong(KHACH_HANG, Math.max(chua.getTotalElements(), dung.size()), xepVaCat(xep, soDong));
    }

    /* ───────────────────────────── Nhà cung cấp ───────────────────────────── */

    TimKiemDto.Nhom timNhaCungCap(String tk, int soDong) {
        Page<NhaCungCap> chua = nhaCungCapService.filter(yeuCau(List.of(tuKhoa(tk, false)), "id", SO_DONG_XEP_HANG));
        List<NhaCungCap> dung = nhaCungCapService.filter(yeuCau(List.of(tuKhoa(tk, true)), "id", SO_DONG_TOI_DA)).getContent();
        List<NhaCungCap> ds = gop(dung, chua.getContent(), NhaCungCap::getId);
        List<Object[]> xep = new ArrayList<>();
        for (int i = 0; i < ds.size(); i++) {
            NhaCungCap n = ds.get(i);
            TimKiemDto.Muc muc = TimKiemDto.Muc.builder()
                    .loai(NHA_CUNG_CAP).id(n.getId()).ma(n.getMaNhaCungCap()).ten(n.getTenNhaCungCap())
                    .phu(n.getMaSoThue()).soDienThoai(n.getSoDienThoai()).trangThai(n.getTrangThai())
                    .build();
            List<UngVien> ungVien = List.of(
                    new UngVien("ma", n.getMaNhaCungCap(), null),
                    new UngVien("maSoThue", n.getMaSoThue(), null),
                    new UngVien("sdt", n.getSoDienThoai(), null),
                    new UngVien("email", n.getEmail(), null));
            int hang = danhDau(muc, ungVien, tk, n.getTenNhaCungCap());
            xep.add(new Object[]{muc.isKhopChinhXac() ? 0 : hang, 0, i, muc});
        }
        return xong(NHA_CUNG_CAP, Math.max(chua.getTotalElements(), dung.size()), xepVaCat(xep, soDong));
    }

    /* ───────────────────────────── Chứng từ ───────────────────────────── */

    /** Kết quả một loại chứng từ. */
    record LoaiKetQua(List<TimKiemDto.Muc> muc, long tong) {
    }

    /**
     * Chứng từ tìm theo mã, chỉ khi từ khóa có dáng mã. Mỗi loại chạy riêng: loại bị từ chối (chưa chọn kho, không
     * thuộc kho đang chọn…) thì bỏ qua; chỉ khi mọi loại đều lỗi và có lỗi khác "từ chối" mới báo lỗi cả nhóm.
     */
    TimKiemDto.Nhom timChungTu(String tk, NguoiDungAuthInfo user, Set<String> vaiTro, int soDong) {
        if (!TuKhoaTimKiem.giongMaChungTu(tk)) return xong(CHUNG_TU, 0, List.of());
        List<LoaiKetQua> daTim = new ArrayList<>();
        RuntimeException loiThat = null;
        for (String loai : loaiChungTuDuocXem(vaiTro)) {
            try {
                LoaiKetQua kq = docChi().execute(s -> timMotLoai(loai, tk, user, vaiTro));
                if (kq != null) daTim.add(kq);
            } catch (RuntimeException e) {
                if (laTuChoi(e)) {
                    log.debug("Tìm kiếm: bỏ qua {} ({})", loai, e.getMessage());
                } else {
                    log.warn("Tìm kiếm: loại chứng từ {} lỗi: {}", loai, e.toString());
                    if (loiThat == null) loiThat = e;
                }
            }
        }
        if (daTim.isEmpty() && loiThat != null) throw loiThat;

        List<Object[]> xep = new ArrayList<>();
        int i = 0;
        for (LoaiKetQua kq : daTim) {
            for (TimKiemDto.Muc m : kq.muc()) {
                int hang = TuKhoaTimKiem.mucKhop(m.getMa(), tk);
                if (hang == 0) m.setKhopChinhXac(true);
                if (hang <= 2) m.setTruongKhop("ma");
                xep.add(new Object[]{hang, 0, i++, m});
            }
        }
        long tong = daTim.stream().mapToLong(LoaiKetQua::tong).sum();
        return xong(CHUNG_TU, tong, xepVaCat(xep, soDong));
    }

    /** Chỉ lỗi từ chối truy cập (403) mới coi là "bỏ qua loại này"; lỗi khác ghi log mức warn. */
    private static boolean laTuChoi(RuntimeException e) {
        if (e instanceof TuChoiTruyCapException) return true;
        return e instanceof CommonException ce && ce.getHttpStatus() == HttpStatus.FORBIDDEN;
    }

    private LoaiKetQua timMotLoai(String loai, String tk, NguoiDungAuthInfo user, Set<String> vaiTro) {
        return switch (loai) {
            case "phieuXuat" -> timPhieuXuat(tk, user);
            case "phieuNhap" -> timPhieuNhap(tk, user);
            case "phieuChuyen" -> timPhieuChuyen(tk, user);
            case "donMua" -> timDonMua(tk);
            case "yeuCauNhap" -> timYeuCauNhap(tk, user, vaiTro);
            case "kiemKe" -> timKiemKe(tk);
            case "baoGia" -> timBaoGia(tk);
            default -> null;
        };
    }

    private static TimKiemDto.Muc.MucBuilder chungTu(String loaiChungTu, Integer id, String ma) {
        return TimKiemDto.Muc.builder().loai(CHUNG_TU).loaiChungTu(loaiChungTu).id(id).ma(ma);
    }

    /**
     * Như @RequireAuth(inWarehouse = true) của trang danh sách: quản trị viên đi qua (AuthorizationAspect cho qua trước bước
     * kiểm kho); người khác phải đứng ở một kho mình được phân (header kho_id).
     */
    private boolean dungOKhoDuocPhan(NguoiDungAuthInfo user) {
        if (user == null) return false;
        if (user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_tri_vien)) return true;
        Integer khoDangChon = SecurityContextHolder.getKhoId();
        return khoDangChon != null && jwtService.inWorkspace(khoDangChon, user);
    }

    /** Như danh sách phiếu xuất: phải đứng ở kho mình phụ trách (inWarehouse), phạm vi kho lấy chung hàm với danh sách. */
    private LoaiKetQua timPhieuXuat(String tk, NguoiDungAuthInfo user) {
        if (!dungOKhoDuocPhan(user)) return null;
        List<Integer> khoIds = phieuXuatKhoService.khoDuocXemDanhSach(user);
        if (khoIds != null && khoIds.isEmpty()) return null;
        Page<PhieuXuatKho> trang = phieuXuatKhoService.getDanhSachThucXuatCustom(khoIds, tk, null, null, null,
                PageRequest.of(0, SO_DONG_TOI_DA, Sort.by(Sort.Direction.DESC, "ngayTao")));
        return new LoaiKetQua(trang.getContent().stream().map(p -> chungTu("phieuXuat", p.getId(), p.getSoPhieuXuat())
                .phu(p.getKho() == null ? null : p.getKho().getTenKho()).trangThai(p.getTrangThai()).build()).toList(),
                trang.getTotalElements());
    }

    private LoaiKetQua timPhieuNhap(String tk, NguoiDungAuthInfo user) {
        // Trang danh sách phiếu nhập cũng đòi đứng ở kho được phân (inWarehouse = true)
        if (!dungOKhoDuocPhan(user)) return null;
        Page<PhieuNhapKho> trang = phieuNhapKhoService.filter(yeuCau(
                List.of(loc("soPhieuNhap", FilterOperation.LIKE, tk)), "ngayTao", SO_DONG_TOI_DA));
        return new LoaiKetQua(trang.getContent().stream().map(p -> chungTu("phieuNhap", p.getId(), p.getSoPhieuNhap())
                .phu(p.getKho() == null ? null : p.getKho().getTenKho()).trangThai(p.getTrangThai()).build()).toList(),
                trang.getTotalElements());
    }

    /** Trang danh sách phiếu chuyển đòi đứng ở kho được phân (inWarehouse); phạm vi kho và cách tính nhãn như danh sách. */
    private LoaiKetQua timPhieuChuyen(String tk, NguoiDungAuthInfo user) {
        if (!dungOKhoDuocPhan(user)) return null;
        PhieuChuyenKhoDto.DanhSach ds = phieuChuyenKhoService.timTheoSo(tk, SO_DONG_TOI_DA);
        return new LoaiKetQua(ds.getContent().stream().map(p -> chungTu("phieuChuyen", p.getId(), p.getSoPhieuChuyen())
                .khoXuat(p.getKhoXuatTen()).khoNhap(p.getKhoNhapTen()).trangThai(p.getTrangThai())
                .tuChoi(p.isTuChoi()).coChenhLech(p.isCoChenhLech()).build()).toList(), ds.getTotalElements());
    }

    private LoaiKetQua timDonMua(String tk) {
        Page<DonMuaHang> trang = donMuaHangService.filter(yeuCau(List.of(
                loc("trangThai", FilterOperation.IN, TRANG_THAI_DON_MUA),
                loc("soDonMua", FilterOperation.LIKE, tk)), "ngayCapNhat", SO_DONG_TOI_DA));
        return new LoaiKetQua(trang.getContent().stream().map(d -> chungTu("donMua", d.getId(), d.getSoDonMua())
                .phu(d.getNhaCungCap() == null ? null : d.getNhaCungCap().getTenNhaCungCap()).trangThai(d.getTrangThai()).build()).toList(),
                trang.getTotalElements());
    }

    /**
     * Như trang Yêu cầu nhập hàng: quản lý / nhân viên kho (không kiêm quản trị, mua hàng) chỉ thấy yêu cầu của kho mình.
     * Trang danh sách lọc điều này ở trình duyệt; ô tìm lọc ở máy chủ (K2).
     */
    private LoaiKetQua timYeuCauNhap(String tk, NguoiDungAuthInfo user, Set<String> vaiTro) {
        List<FilterCriteria> filters = new ArrayList<>(List.of(loc("soYeuCauMuaHang", FilterOperation.LIKE, tk)));
        boolean gioiHanKho = !vaiTro.contains(IRoleType.quan_tri_vien) && !vaiTro.contains(IRoleType.nhan_vien_mua_hang)
                && (vaiTro.contains(IRoleType.quan_ly_kho) || vaiTro.contains(IRoleType.nhan_vien_kho));
        if (gioiHanKho) {
            List<Integer> khoIds = user == null || user.getPhanQuyenNguoiDungKhos() == null ? List.of()
                    : user.getPhanQuyenNguoiDungKhos().stream()
                    .filter(pq -> pq != null && pq.getKho() != null && pq.getKho().getId() != null)
                    .map(pq -> pq.getKho().getId()).distinct().toList();
            if (khoIds.isEmpty()) return null;
            filters.add(loc("khoNhap.id", FilterOperation.IN, khoIds));
        }
        Page<YeuCauMuaHang> trang = yeuCauMuaHangService.filter(yeuCau(filters, "ngayTao", SO_DONG_TOI_DA));
        return new LoaiKetQua(trang.getContent().stream().map(y -> chungTu("yeuCauNhap", y.getId(), y.getSoYeuCauMuaHang())
                .phu(y.getKhoNhap() == null ? null : y.getKhoNhap().getTenKho()).trangThai(y.getTrangThai()).build()).toList(),
                trang.getTotalElements());
    }

    /** Như danh sách kiểm kê (KiemKeDocService.danhSach): chỉ đợt của kho người dùng được xem; tìm theo mã đợt. */
    private LoaiKetQua timKiemKe(String tk) {
        String t = tk.toLowerCase(Locale.ROOT);
        List<DotKiemKe> khop = dotKiemKeRepository.timKiem(null, null, null).stream()
                .filter(d -> d.getMaDotKiemKe() != null && d.getMaDotKiemKe().toLowerCase(Locale.ROOT).contains(t))
                .filter(d -> KhoDangChon.duocXem(d.getKho()))
                .toList();
        return new LoaiKetQua(khop.stream().limit(SO_DONG_TOI_DA).map(d -> chungTu("kiemKe", d.getId(), d.getMaDotKiemKe())
                .ten(d.getTenDotKiemKe()).phu(d.getKho() == null ? null : d.getKho().getTenKho())
                .trangThai(d.getTrangThai() == null ? null : d.getTrangThai().intValue()).build()).toList(), khop.size());
    }

    /** Báo giá bán: cùng hàm lọc và phạm vi vai trò với trang Báo giá. */
    private LoaiKetQua timBaoGia(String tk) {
        Page<DonBanHang> trang = donBanHangService.filter(yeuCau(List.of(
                loc("loaiChungTu", FilterOperation.EQUALS, "bao_gia"),
                loc("soDonHang", FilterOperation.LIKE, tk)), "id", SO_DONG_TOI_DA));
        return new LoaiKetQua(trang.getContent().stream().map(d -> chungTu("baoGia", d.getId(), d.getSoDonHang())
                .phu(d.getKhachHang() == null ? null : d.getKhachHang().getTenKhachHang()).trangThai(d.getTrangThai()).build()).toList(),
                trang.getTotalElements());
    }
}
