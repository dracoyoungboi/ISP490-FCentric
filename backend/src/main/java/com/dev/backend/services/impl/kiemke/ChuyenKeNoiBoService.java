package com.dev.backend.services.impl.kiemke;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.chuyenke.ChuyenKeDto;
import com.dev.backend.dto.chuyenke.ChuyenKeYeuCau;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.*;
import com.dev.backend.utils.HienThiBienThe;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Chuyển kệ nội bộ (UC-7.4 Internal Bin Relocation, đặc tả BA 11/11). Đổi chỗ hàng giữa các kệ của CÙNG một kho bằng
 * Scan-to-Move: quét kệ nguồn → chọn lô, nhập số → quét kệ đích (tách cất nhiều kệ khi kệ đích không đủ chỗ) → xác nhận.
 * <ul>
 *   <li>BR-BIN-01: chỉ sổ tồn theo kệ (ton_kho_vi_tri) đổi; tồn lô ở kho (ton_kho_theo_lo) không đổi. Dòng sổ kho loại
 *   {@code chuyen_ke_noi_bo} giữ số trước = số sau = tồn lô ở kho; báo cáo nhập xuất, xuất kế toán bỏ qua loại này.</li>
 *   <li>BR-BIN-02: số chuyển của một lô ≤ tồn ở kệ nguồn − phần phiếu nhặt đang giữ ở kệ đó.</li>
 *   <li>BR-BIN-03: kệ nguồn, kệ đích không đang kiểm kê; kệ đích không bảo trì. Kệ nguồn bảo trì VẪN chuyển đi được —
 *   mục đích "giải phóng kệ phục vụ bảo trì" (BA 1.1); luồng A1 của BA ghi chặn cả kệ nguồn bảo trì, mâu thuẫn với
 *   BR-BIN-03 và mục 1.1 nên làm theo quy tắc.</li>
 *   <li>BR-BIN-04: mỗi dòng gắn đúng [biến thể – lô – kệ].</li>
 *   <li>BR-BIN-05: tổng cất vào một kệ đích ≤ sức chứa còn trống; vượt chỉ khi quản lý kho / quản trị viên bật
 *   {@code vuotSucChua}. Kệ đích đầy 100% chuyển DAY_HANG; kệ nguồn đang DAY_HANG còn chỗ thì về HOAT_DONG.</li>
 * </ul>
 * Thứ tự khóa như {@link SoTonKeService#chuyenKe}: mutex kho (chia sẻ) → dòng tồn lô → kệ → dòng sổ kệ.
 */
@Slf4j
@Service
public class ChuyenKeNoiBoService {

    static final ZoneId MUI_GIO_VN = ZoneId.of("Asia/Ho_Chi_Minh");
    static final String LOAI_GIAO_DICH = "chuyen_ke_noi_bo";
    static final String LOAI_THAM_CHIEU = "phieu_chuyen_ke";
    static final int TOI_DA_DONG = 500;
    /** Trần số lượng một dòng: 500 dòng × trần vẫn nhỏ hơn Integer.MAX_VALUE nên cộng gộp không tràn số. */
    static final int TOI_DA_SO_LUONG = 1_000_000;
    static final int TOI_DA_GHI_CHU = 255;
    static final String KHOA_KIEM_KE = "KIEM_KE", KHOA_BAO_TRI = "BAO_TRI", KHOA_KHAC = "KHAC";
    private static final long KIEM_LAI_SAU_MS = 30_000;

    @PersistenceContext
    private EntityManager em;

    private final JdbcTemplate jdbc;
    private final KhoaKiemKeGuard guard;
    private final SoTonKeService soTonKe;
    private final PhanBoKeService phanBoKe;
    private final ViTriKhoRepository viTriRepo;
    private final TonKhoViTriRepository tonKeRepo;
    private final TonKhoTheoLoRepository tonLoRepo;
    private final LoHangRepository loRepo;
    private final NguoiDungRepository nguoiDungRepo;
    private final PhieuChuyenKeRepository phieuRepo;
    private final ChiTietPhieuChuyenKeRepository chiTietRepo;
    private final LichSuGiaoDichKhoRepository lichSuRepo;

    private volatile boolean sanSang;
    private volatile long lanKiemCuoi;

    public ChuyenKeNoiBoService(JdbcTemplate jdbc, KhoaKiemKeGuard guard, SoTonKeService soTonKe, PhanBoKeService phanBoKe,
                                ViTriKhoRepository viTriRepo, TonKhoViTriRepository tonKeRepo,
                                TonKhoTheoLoRepository tonLoRepo, LoHangRepository loRepo,
                                NguoiDungRepository nguoiDungRepo, PhieuChuyenKeRepository phieuRepo,
                                ChiTietPhieuChuyenKeRepository chiTietRepo, LichSuGiaoDichKhoRepository lichSuRepo) {
        this.jdbc = jdbc;
        this.guard = guard;
        this.soTonKe = soTonKe;
        this.phanBoKe = phanBoKe;
        this.viTriRepo = viTriRepo;
        this.tonKeRepo = tonKeRepo;
        this.tonLoRepo = tonLoRepo;
        this.loRepo = loRepo;
        this.nguoiDungRepo = nguoiDungRepo;
        this.phieuRepo = phieuRepo;
        this.chiTietRepo = chiTietRepo;
        this.lichSuRepo = lichSuRepo;
    }

    // ───────────────────────────── Sẵn sàng (đã chạy migration chưa) ─────────────────────────────

    /** CSDL đã chạy migration-2026-11-11-chuyen-ke-noi-bo.sql chưa (nhớ khi đã thấy; chưa thì kiểm lại mỗi 30 giây). */
    boolean sanSang() {
        if (sanSang) return true;
        // Một luồng kiểm một lúc: luồng đến cùng lúc chờ kết quả thay vì nhận "chưa sẵn sàng" (503) khi CSDL đã đủ bảng
        synchronized (this) {
            return kiemSanSang();
        }
    }

    private boolean kiemSanSang() {
        if (sanSang) return true;
        long bayGio = System.currentTimeMillis();
        if (lanKiemCuoi != 0 && bayGio - lanKiemCuoi < KIEM_LAI_SAU_MS) return false;
        lanKiemCuoi = bayGio;
        try {
            Integer n = jdbc.queryForObject("""
                    SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()
                               AND table_name IN ('phieu_chuyen_ke', 'chi_tiet_phieu_chuyen_ke'))
                         + (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
                               AND table_name = 'lich_su_giao_dich_kho' AND column_name = 'loai_giao_dich'
                               AND (data_type <> 'enum' OR column_type LIKE '%''chuyen_ke_noi_bo''%'))
                    """, Integer.class);
            sanSang = n != null && n == 3;
            if (!sanSang) log.warn("[CHUYEN-KE] CSDL chưa chạy migration-2026-11-11-chuyen-ke-noi-bo.sql");
        } catch (RuntimeException e) {
            log.warn("[CHUYEN-KE] Không kiểm được bảng chuyển kệ: {}", e.getMessage());
        }
        return sanSang;
    }

    private void batBuocSanSang() {
        if (!sanSang()) {
            throw new CommonException(HttpStatus.SERVICE_UNAVAILABLE, ThongDiep.of("khoVanHanh.chuyenKeChuaNangCap"));
        }
    }

    // ───────────────────────────── Quét kệ (bước 2, 6) ─────────────────────────────

    /** Tra kệ theo mã quét / gõ ở kho đang chọn, kèm hàng trên kệ theo lô và số khả dụng chuyển (BR-BIN-02). */
    @Transactional(readOnly = true)
    public ChuyenKeDto.Ke traKe(Integer khoId, String ma) {
        batBuocSanSang();
        String m = ma == null ? "" : ma.trim();
        if (m.isEmpty()) throw new CommonException(ThongDiep.of("khoVanHanh.chuyenKeNhapMaKe"));
        ViTriKho ke = viTriRepo.findByKho_IdAndMaViTri(khoId, m)
                .or(() -> viTriRepo.findFirstByKho_IdAndMaViTriIgnoreCase(khoId, m))
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("khoVanHanh.chuyenKeKhongTimThayKe", m)));
        return moTaKe(khoId, ke);
    }

    /** Các kệ của kho (gợi ý khi gõ mã kệ), theo mã. */
    @Transactional(readOnly = true)
    public List<ChuyenKeDto.KeGon> dsKe(Integer khoId) {
        batBuocSanSang();
        Map<Integer, Integer> dang = new HashMap<>();
        for (Object[] r : tonKeRepo.dangChuaDuongTheoKho(khoId)) {
            dang.put(((Number) r[0]).intValue(), ((Number) r[1]).intValue());
        }
        return viTriRepo.findByKho_IdOrderByMaViTriAsc(khoId).stream().map(v -> new ChuyenKeDto.KeGon(v.getId(), v.getMaViTri(),
                v.getKhuVucKho() == null ? null : v.getKhuVucKho().getTenKhuVuc(), v.getTrangThai(),
                v.getSucChuaToiDa() != null && v.getSucChuaToiDa() > 0 ? v.getSucChuaToiDa() : null,
                dang.getOrDefault(v.getId(), 0))).toList();
    }

    static final int SO_GOI_Y = 5;

    /**
     * Kệ đích gợi ý (màn Chuyển kệ, cột "Sang kệ"): kệ cùng kho nhận được hàng và còn chỗ. Thứ tự: kệ đang chứa cùng biến
     * thể (dồn kệ, BA 1.1) → còn đủ chỗ cho {@code can} sản phẩm → cùng khu vực với kệ nguồn → ít chỗ trống hơn trước (lấp
     * kệ dở trước kệ trống) → mã kệ. Tối đa {@link #SO_GOI_Y} kệ. Chỉ đọc; xác nhận vẫn kiểm lại sức chứa.
     */
    @Transactional(readOnly = true)
    public List<ChuyenKeDto.KeGoiY> goiYKe(Integer khoId, Integer keNguonId, Collection<Integer> bienTheIds, int can) {
        batBuocSanSang();
        ViTriKho nguon = keNguonId == null ? null : viTriRepo.findById(keNguonId).orElse(null);
        Integer khuNguon = nguon != null && nguon.getKhuVucKho() != null ? nguon.getKhuVucKho().getId() : null;
        Map<Integer, Integer> dang = new HashMap<>();
        for (Object[] r : tonKeRepo.dangChuaDuongTheoKho(khoId)) {
            dang.put(((Number) r[0]).intValue(), ((Number) r[1]).intValue());
        }
        Set<Integer> cungMa = new HashSet<>();
        List<Integer> bt = bienTheIds == null ? List.of() : bienTheIds.stream().filter(Objects::nonNull).distinct().toList();
        if (!bt.isEmpty()) {
            @SuppressWarnings("unchecked")
            List<Object> rows = em.createNativeQuery("""
                    SELECT DISTINCT t.vi_tri_kho_id FROM ton_kho_vi_tri t JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
                     WHERE v.kho_id = :kho AND t.so_luong > 0 AND t.bien_the_san_pham_id IN (:bt)
                    """).setParameter("kho", khoId).setParameter("bt", bt).getResultList();
            for (Object r : rows) cungMa.add(((Number) r).intValue());
        }
        KhoaKiemKeGuard.TrangThaiKhoa tt = guard.trangThai(khoId);
        int canCat = Math.max(0, can);
        List<ChuyenKeDto.KeGoiY> ds = new ArrayList<>();
        for (ViTriKho v : viTriRepo.findByKho_IdOrderByMaViTriAsc(khoId)) {
            if (Objects.equals(v.getId(), keNguonId) || khoaCuaKe(v, tt) != null) continue;
            Integer sucChua = v.getSucChuaToiDa() != null && v.getSucChuaToiDa() > 0 ? v.getSucChuaToiDa() : null;
            int dc = dang.getOrDefault(v.getId(), 0);
            Integer conTrong = sucChua == null ? null : Math.max(0, sucChua - dc);
            if (conTrong != null && conTrong == 0) continue;
            boolean cungKhuVuc = khuNguon != null && v.getKhuVucKho() != null && khuNguon.equals(v.getKhuVucKho().getId());
            ds.add(new ChuyenKeDto.KeGoiY(v.getId(), v.getMaViTri(), v.getKhuVucKho() == null ? null : v.getKhuVucKho().getTenKhuVuc(),
                    v.getDayKe(), v.getTangKe(), sucChua, dc, conTrong, cungMa.contains(v.getId()), cungKhuVuc,
                    conTrong == null || conTrong >= canCat));
        }
        ds.sort(Comparator.comparing((ChuyenKeDto.KeGoiY k) -> !k.cungMa())
                .thenComparing(k -> !k.duCho())
                .thenComparing(k -> !k.cungKhu())
                .thenComparing(k -> k.conTrong() == null ? Integer.MAX_VALUE : k.conTrong())
                .thenComparing(k -> k.maViTri() == null ? "" : k.maViTri()));
        return ds.size() > SO_GOI_Y ? List.copyOf(ds.subList(0, SO_GOI_Y)) : ds;
    }

    ChuyenKeDto.Ke moTaKe(Integer khoId, ViTriKho ke) {
        KhoaKiemKeGuard.TrangThaiKhoa tt = guard.trangThai(khoId);
        String khoa = khoaCuaKe(ke, tt);
        List<TonKhoViTri> tren = tonKeRepo.findActiveLotsByViTriId(ke.getId());
        Map<Integer, Integer> dmLo = tt.danhMuc.isEmpty() ? Map.of()
                : guard.danhMucCuaLo(tren.stream().map(t -> t.getLoHang().getId()).toList());
        List<ChuyenKeDto.DongTrenKe> dong = new ArrayList<>();
        int dangChua = 0;
        for (TonKhoViTri t : tren) {
            int ton = t.getSoLuong() == null ? 0 : t.getSoLuong();
            if (ton <= 0) continue;
            dangChua += ton;
            LoHang lo = t.getLoHang();
            BienTheSanPham bt = t.getBienTheSanPham() != null ? t.getBienTheSanPham() : lo.getBienTheSanPham();
            int giu = Math.min(ton, phanBoKe.giuTrenKeCuaLo(khoId, lo.getId()).getOrDefault(ke.getId(), 0));
            Integer dm = dmLo.get(lo.getId());
            boolean khoaLo = KHOA_KIEM_KE.equals(khoa) || tt.capDangKhoa(ke.getId(), lo.getId())
                    || (dm != null && tt.danhMuc.containsKey(dm));
            dong.add(new ChuyenKeDto.DongTrenKe(lo.getId(), lo.getMaLo(), bt == null ? null : bt.getId(),
                    bt == null ? null : bt.getMaSku(), bt == null ? null : bt.getMaVachSku(),
                    HienThiBienThe.tenSanPham(bt), HienThiBienThe.tenMau(bt), HienThiBienThe.maMauHex(bt),
                    HienThiBienThe.kichCo(bt), HienThiBienThe.anh(bt), lo.getNgayTao(), ton, giu,
                    khoaLo ? 0 : Math.max(0, ton - giu), khoaLo));
        }
        // FIFO: lô cũ trước (BR-BIN-04), cùng ngày thì theo mã lô
        dong.sort(Comparator.comparing((ChuyenKeDto.DongTrenKe d) -> d.ngayNhap() == null ? Instant.MAX : d.ngayNhap())
                .thenComparing(d -> d.maLo() == null ? "" : d.maLo()));
        Integer dang = tonKeRepo.dangChuaDuong(ke.getId());
        int dangChuaSo = dang == null ? dangChua : dang;
        Integer sucChua = ke.getSucChuaToiDa() != null && ke.getSucChuaToiDa() > 0 ? ke.getSucChuaToiDa() : null;
        return new ChuyenKeDto.Ke(ke.getId(), ke.getMaViTri(),
                ke.getKhuVucKho() == null ? null : ke.getKhuVucKho().getTenKhuVuc(),
                ke.getDayKe(), ke.getHangKe(), ke.getTangKe(), ke.getTrangThai(), sucChua, dangChuaSo,
                sucChua == null ? null : Math.max(0, sucChua - dangChuaSo), khoa,
                khoa == null ? null : dichLyDo(lyDoKhoa(khoa, ke)), dong);
    }

    /** Lý do kệ không dùng được, theo loại khóa (không gộp kiểm kê với bảo trì thành một câu mơ hồ). */
    static ThongDiep lyDoKhoa(String khoa, ViTriKho ke) {
        if (KHOA_KIEM_KE.equals(khoa)) return ThongDiep.of("khoVanHanh.keDangKiemKe", ke.getMaViTri());
        if (KHOA_BAO_TRI.equals(khoa)) return ThongDiep.of("khoVanHanh.chuyenKeKeBaoTri", ke.getMaViTri());
        return ThongDiep.of("khoVanHanh.chuyenKeKeKhongNhanHang", ke.getMaViTri());
    }

    private static String dichLyDo(ThongDiep cau) {
        return ThongDiep.dich(cau.khoa(), cau.thamSo());
    }

    /** Kệ đang kiểm kê: câu có mã đợt (đợt toàn kho → câu cấp kho) qua chốt chặn chung. */
    private LoiCoMaException loiKeKiemKe(KhoaKiemKeGuard.TrangThaiKhoa tt, ViTriKho ke, String thaoTac) {
        Integer dot = tt.dotToanKho != null ? tt.dotToanKho : tt.keToanKe.get(ke.getId());
        // Kệ mang trạng thái đang kiểm mà không thấy khóa toàn kệ (đợt khóa theo lô): nêu đợt đầu tiên của kho
        if (dot == null) dot = tt.maDot.keySet().stream().sorted().findFirst().orElse(null);
        return guard.loi(tt, dot, ke.getId(), null, thaoTac);
    }

    /** null = kệ dùng được; KIEM_KE (cả kệ / cả kho đang kiểm kê) · BAO_TRI · KHAC (trạng thái lạ). */
    static String khoaCuaKe(ViTriKho ke, KhoaKiemKeGuard.TrangThaiKhoa tt) {
        String trangThai = ke.getTrangThai();
        if (IKiemKe.KE_KHOA_KIEM_KE.equals(trangThai) || (tt != null && tt.keDangKhoaToan(ke.getId()))) return KHOA_KIEM_KE;
        if (IKiemKe.KE_BAO_TRI.equals(trangThai)) return KHOA_BAO_TRI;
        if (trangThai != null && !IKiemKe.KE_HOAT_DONG.equals(trangThai) && !IKiemKe.KE_DAY_HANG.equals(trangThai)) {
            return KHOA_KHAC;
        }
        return null;
    }

    // ───────────────────────────── Chốt chuyển kệ (bước 8–9) ─────────────────────────────

    /** Gộp số theo khóa (dòng gửi lên có thể lặp lô / kệ đích). */
    private static <K> Map<K, Integer> cong(Map<K, Integer> m, K k, int v) {
        m.merge(k, v, Integer::sum);
        return m;
    }

    /**
     * Giao dịch nguyên tử (BA bước 9): trừ sổ kệ nguồn, cộng sổ kệ đích (tạo dòng mới khi kệ chưa có lô), cập nhật trạng
     * thái đầy kệ, sinh phiếu MV-YYYYMMDD-XXXX cùng các dòng, ghi sổ kho loại chuyen_ke_noi_bo. Lỗi ở bất kỳ dòng nào thì
     * không ghi gì. Gọi qua {@link com.dev.backend.utils.ThuLaiKhiTrungSo} để cấp lại số khi trùng.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ChuyenKeDto.KetQua thucHien(Integer khoId, ChuyenKeYeuCau yc) {
        batBuocSanSang();
        if (khoId == null) throw new CommonException(ThongDiep.of("khoVanHanh.khoKhongCoLoDaChon"));
        if (yc == null || yc.keNguonId() == null || yc.dong() == null || yc.dong().isEmpty()) {
            throw new CommonException(ThongDiep.of("khoVanHanh.chuyenKeChuaChonHang"));
        }
        if (yc.dong().size() > TOI_DA_DONG) {
            throw new CommonException(ThongDiep.of("khoVanHanh.chuyenKeQuaNhieuDong", TOI_DA_DONG));
        }
        String ghiChu = yc.ghiChu() == null || yc.ghiChu().isBlank() ? null : yc.ghiChu().trim();
        if (ghiChu != null && ghiChu.length() > TOI_DA_GHI_CHU) {
            throw new CommonException(ThongDiep.of("khoVanHanh.chuyenKeGhiChuQuaDai", TOI_DA_GHI_CHU));
        }
        boolean vuot = Boolean.TRUE.equals(yc.vuotSucChua());
        NguoiDungAuthInfo u = SecurityContextHolder.getUser();
        if (vuot && !(KiemKeQuyen.laQuanTri(u) || KiemKeQuyen.co(u, IRoleType.quan_ly_kho))) {
            throw new CommonException(HttpStatus.FORBIDDEN, ThongDiep.of("khoVanHanh.chuyenKeChiQuanLyVuotSucChua"));
        }
        if (u == null || u.getId() == null) throw new CommonException(HttpStatus.UNAUTHORIZED, ThongDiep.of("khoVanHanh.phienKhongHopLe"));

        // Gộp dòng: [lô → (kệ đích → số)], giữ thứ tự gửi lên
        Integer nguonId = yc.keNguonId();
        Map<Integer, Map<Integer, Integer>> theoLo = new LinkedHashMap<>();
        for (ChuyenKeYeuCau.Dong d : yc.dong()) {
            if (d == null || d.loHangId() == null || d.keDichId() == null) {
                throw new CommonException(ThongDiep.of("khoVanHanh.chuyenKeChuaChonHang"));
            }
            // Nhận số thập phân rồi tự kiểm: Jackson cắt im lặng 1.5 thành 1 nếu khai báo Integer
            BigDecimal soGui = d.soLuong();
            if (soGui == null || soGui.signum() <= 0 || soGui.stripTrailingZeros().scale() > 0
                    || soGui.compareTo(BigDecimal.valueOf(TOI_DA_SO_LUONG)) > 0) {
                throw new CommonException(ThongDiep.of("khoVanHanh.chuyenKeSoLuongKhongHopLe"));
            }
            if (Objects.equals(d.keDichId(), nguonId)) throw new CommonException(ThongDiep.of("khoVanHanh.chuyenKeKeDichTrungNguon"));
            cong(theoLo.computeIfAbsent(d.loHangId(), k -> new LinkedHashMap<>()), d.keDichId(), soGui.intValueExact());
        }
        Map<Integer, Integer> canTheoLo = new LinkedHashMap<>();
        Map<Integer, Integer> vaoKeDich = new LinkedHashMap<>();
        theoLo.forEach((lo, ke) -> ke.forEach((keDich, sl) -> {
            cong(canTheoLo, lo, sl);
            cong(vaoKeDich, keDich, sl);
        }));

        // 1. Mutex kho (kiểm kê không bắt đầu / phê duyệt xen giữa) → 2. dòng tồn lô (thứ tự id)
        guard.giuKho(khoId);
        List<Integer> loIds = new ArrayList<>(canTheoLo.keySet());
        List<Integer> tonIds = tonLoRepo.findIdsByKhoAndLots(khoId, loIds);
        List<TonKhoTheoLo> tonLo = tonIds.isEmpty() ? List.of() : tonLoRepo.lockLotsForUpdateByIds(tonIds);
        Map<Integer, TonKhoTheoLo> tonTheoLo = new HashMap<>();
        for (TonKhoTheoLo t : tonLo) {
            em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
            tonTheoLo.put(t.getLoHang().getId(), t);
        }
        for (Integer lo : loIds) {
            if (!tonTheoLo.containsKey(lo)) throw new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("khoVanHanh.khoKhongCoLoDaChon"));
        }

        // 3. Kệ (thứ tự id): nguồn + các kệ đích, cùng kho, đúng trạng thái
        TreeSet<Integer> keIds = new TreeSet<>(vaoKeDich.keySet());
        keIds.add(nguonId);
        Map<Integer, ViTriKho> ke = new HashMap<>();
        for (Integer id : keIds) {
            ViTriKho v = viTriRepo.khoaTheoId(id)
                    .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("khoVanHanh.keDaChonKhongTimThay")));
            em.refresh(v);
            if (v.getKho() == null || !khoId.equals(v.getKho().getId())) {
                throw new CommonException(HttpStatus.FORBIDDEN, ThongDiep.of("khoVanHanh.keKhongThuocKho", v.getMaViTri()));
            }
            ke.put(id, v);
        }
        KhoaKiemKeGuard.TrangThaiKhoa tt = guard.trangThai(khoId);
        ViTriKho nguon = ke.get(nguonId);
        // BR-BIN-03: kệ nguồn không đang kiểm kê (bảo trì vẫn chuyển đi được)
        if (KHOA_KIEM_KE.equals(khoaCuaKe(nguon, tt))) {
            throw loiKeKiemKe(tt, nguon, "chuyển hàng khỏi kệ");
        }
        for (Integer id : vaoKeDich.keySet()) {
            ViTriKho dich = ke.get(id);
            String khoa = khoaCuaKe(dich, tt);
            if (KHOA_KIEM_KE.equals(khoa)) throw loiKeKiemKe(tt, dich, "chuyển hàng lên kệ");
            if (khoa != null) throw new CommonException(HttpStatus.CONFLICT, lyDoKhoa(khoa, dich));
        }
        // Chốt chặn kiểm kê theo lô (danh mục đang kiểm, cặp kệ–lô khóa tối thiểu) — cùng các bước của chuyenKe một lô
        Map<Integer, BigDecimal> canBd = new HashMap<>();
        Map<Integer, BigDecimal> tonBd = new HashMap<>();
        canTheoLo.forEach((lo, sl) -> {
            canBd.put(lo, BigDecimal.valueOf(sl));
            tonBd.put(lo, tonTheoLo.get(lo).getSoLuongTon());
        });
        guard.kiemTraXuat(khoId, canBd, tonBd, "chuyển hàng khỏi kệ");
        for (Integer lo : loIds) {
            if (tt.capDangKhoa(nguonId, lo)) {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.keDangKiemKeChuaChuyen", nguon.getMaViTri()));
            }
        }
        theoLo.forEach((lo, keDich) -> keDich.keySet().forEach(dich ->
                guard.kiemTraNhapKe(khoId, dich, List.of(lo), "chuyển hàng lên kệ")));

        // 4. Dòng sổ kệ của các lô (khóa) → BR-BIN-02: số chuyển ≤ tồn ở kệ nguồn − phần phiếu nhặt giữ ở kệ nguồn
        Map<Integer, TonKhoViTri> dongNguon = new HashMap<>();
        for (Integer lo : loIds) {
            for (TonKhoViTri t : tonKeRepo.khoaTheoKhoVaLo(khoId, lo)) em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
            LoHang loHang = tonTheoLo.get(lo).getLoHang();
            TonKhoViTri n = tonKeRepo.khoaTheoKeVaLo(nguonId, lo)
                    .orElseThrow(() -> new CommonException(HttpStatus.CONFLICT,
                            ThongDiep.of("khoVanHanh.chuyenKeLoKhongTrenKe", loHang.getMaLo(), nguon.getMaViTri())));
            int co = Math.max(0, n.getSoLuong() == null ? 0 : n.getSoLuong());
            if (co <= 0) {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.chuyenKeLoKhongTrenKe", loHang.getMaLo(), nguon.getMaViTri()));
            }
            int giu = Math.min(co, phanBoKe.giuTrenKeCuaLo(khoId, lo).getOrDefault(nguonId, 0));
            int khaDung = co - giu;
            if (canTheoLo.get(lo) > khaDung) {
                throw new CommonException(HttpStatus.CONFLICT,
                        ThongDiep.of("khoVanHanh.chuyenKeVuotKhaDung", loHang.getMaLo(), khaDung, giu));
            }
            dongNguon.put(lo, n);
        }

        // 5. BR-BIN-05: sức chứa còn trống của từng kệ đích (tổng mọi lô cất vào kệ đó)
        for (Map.Entry<Integer, Integer> e : vaoKeDich.entrySet()) {
            ViTriKho dich = ke.get(e.getKey());
            Integer sucChua = dich.getSucChuaToiDa();
            if (sucChua == null || sucChua <= 0 || vuot) continue;
            Integer dang = tonKeRepo.dangChuaDuong(dich.getId());
            int conTrong = Math.max(0, sucChua - (dang == null ? 0 : dang));
            if (e.getValue() > conTrong) {
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.chuyenKeKhongDuSucChua",
                        dich.getMaViTri(), e.getValue(), conTrong, e.getValue() - conTrong));
            }
        }

        // 6. Ghi: phiếu → sổ kệ → dòng chi tiết + sổ kho
        NguoiDung nguoi = nguoiDungRepo.findById(u.getId())
                .orElseThrow(() -> new CommonException(HttpStatus.UNAUTHORIZED, ThongDiep.of("khoVanHanh.khongTimThayNguoiDangNhap")));
        Instant bayGio = Instant.now();
        PhieuChuyenKe phieu = phieuRepo.saveAndFlush(PhieuChuyenKe.builder()
                .maPhieu(maMoi(bayGio)).kho(nguon.getKho()).loaiChuyen(PhieuChuyenKe.TRUC_TIEP)
                .nguoiThucHien(nguoi).ngayThucHien(bayGio).vuotSucChua(vuot).ghiChu(ghiChu).build());
        int tong = 0, soDong = 0;
        for (Map.Entry<Integer, Map<Integer, Integer>> e : theoLo.entrySet()) {
            Integer lo = e.getKey();
            TonKhoTheoLo ton = tonTheoLo.get(lo);
            LoHang loHang = ton.getLoHang();
            BienTheSanPham bt = loHang.getBienTheSanPham();
            TonKhoViTri n = dongNguon.get(lo);
            n.setSoLuong(n.getSoLuong() - canTheoLo.get(lo));
            tonKeRepo.save(n);
            Integer keNhieuNhat = null;
            int nhieuNhat = 0;
            for (Map.Entry<Integer, Integer> d : e.getValue().entrySet()) {
                ViTriKho dich = ke.get(d.getKey());
                int sl = d.getValue();
                soTonKe.cong(khoId, dich, loHang, bt, BigDecimal.valueOf(sl));
                chiTietRepo.save(ChiTietPhieuChuyenKe.builder().phieuChuyenKe(phieu).bienTheSanPham(bt).loHang(loHang)
                        .keNguon(nguon).keDich(dich).soLuong(BigDecimal.valueOf(sl)).build());
                lichSuRepo.save(LichSuGiaoDichKho.builder()
                        .loaiGiaoDich(LOAI_GIAO_DICH).loaiThamChieu(LOAI_THAM_CHIEU).idThamChieu(phieu.getId())
                        .bienTheSanPham(bt).loHang(loHang).kho(nguon.getKho())
                        .soLuong(BigDecimal.valueOf(sl)).soLuongTruoc(ton.getSoLuongTon()).soLuongSau(ton.getSoLuongTon())
                        .nguoiDung(nguoi)
                        // Dữ liệu sổ (không dịch): mã phiếu và đường đi
                        .ghiChu(phieu.getMaPhieu() + ": " + nguon.getMaViTri() + " → " + dich.getMaViTri())
                        .build());
                tong += sl;
                soDong++;
                if (sl > nhieuNhat) {
                    nhieuNhat = sl;
                    keNhieuNhat = dich.getId();
                }
            }
            // Kệ chính của lô (gợi ý xuất, FIFO): lô rời hẳn kệ chính thì nhận kệ đích nhận nhiều nhất
            if (loHang.getViTriKho() != null && nguonId.equals(loHang.getViTriKho().getId()) && n.getSoLuong() <= 0
                    && keNhieuNhat != null) {
                loHang.setViTriKho(ke.get(keNhieuNhat));
                loRepo.save(loHang);
            }
        }

        // 7. Trạng thái đầy kệ: kệ đích đạt sức chứa → DAY_HANG; kệ (nguồn) DAY_HANG còn chỗ → HOAT_DONG
        for (ViTriKho v : ke.values()) capNhatDayKe(v);
        log.info("[CHUYEN-KE] {} kho {}: {} dòng, {} sản phẩm từ {}{}", phieu.getMaPhieu(), khoId, soDong, tong,
                nguon.getMaViTri(), vuot ? " (vượt sức chứa)" : "");
        return new ChuyenKeDto.KetQua(phieu.getId(), phieu.getMaPhieu(), soDong, tong);
    }

    /** Kệ đang HOAT_DONG / DAY_HANG có giới hạn sức chứa: đặt lại theo số đang chứa. Kệ bảo trì, đang kiểm kê giữ nguyên. */
    private void capNhatDayKe(ViTriKho v) {
        String tt = v.getTrangThai();
        Integer sucChua = v.getSucChuaToiDa();
        if (sucChua == null || sucChua <= 0) return;
        if (tt != null && !IKiemKe.KE_HOAT_DONG.equals(tt) && !IKiemKe.KE_DAY_HANG.equals(tt)) return;
        Integer dang = tonKeRepo.dangChuaDuong(v.getId());
        String moi = dang != null && dang >= sucChua ? IKiemKe.KE_DAY_HANG : IKiemKe.KE_HOAT_DONG;
        if (!moi.equals(tt == null ? IKiemKe.KE_HOAT_DONG : tt)) {
            v.setTrangThai(moi);
            viTriRepo.save(v);
        }
    }

    /** MV-YYYYMMDD-XXXX theo ngày Việt Nam: số đuôi lớn nhất của ngày + 1 (trùng khi chạy song song → thử lại). */
    String maMoi(Instant luc) {
        String tienTo = "MV-" + LocalDate.ofInstant(luc, MUI_GIO_VN).format(DateTimeFormatter.BASIC_ISO_DATE) + "-";
        Long lonNhat = phieuRepo.soDuoiLonNhat(tienTo);
        return tienTo + String.format("%04d", (lonNhat == null ? 0 : lonNhat) + 1);
    }

    // ───────────────────────────── Lịch sử (quản lý kho thẩm định) ─────────────────────────────

    @Transactional(readOnly = true)
    public ChuyenKeDto.Trang danhSach(Integer khoId, String tim, LocalDate tuNgay, LocalDate denNgay, int trang, int kichThuoc) {
        batBuocSanSang();
        int size = Math.max(1, Math.min(kichThuoc, 100));
        int page = Math.max(0, trang);
        String mau = tim == null || tim.isBlank() ? null
                : "%" + tim.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Instant tu = tuNgay == null ? null : tuNgay.atStartOfDay(MUI_GIO_VN).toInstant();
        Instant den = denNgay == null ? null : denNgay.plusDays(1).atStartOfDay(MUI_GIO_VN).toInstant();
        Page<PhieuChuyenKe> p = phieuRepo.timTheoKho(khoId, mau, tu, den, PageRequest.of(page, size));
        return new ChuyenKeDto.Trang(moTaPhieu(p.getContent()), p.getTotalElements(), page, size);
    }

    @Transactional(readOnly = true)
    public ChuyenKeDto.Phieu chiTiet(Integer id) {
        batBuocSanSang();
        PhieuChuyenKe p = phieuRepo.findById(id)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("khoVanHanh.chuyenKePhieuKhongTimThay")));
        com.dev.backend.utils.KhoDangChon.kiemTraXem(p.getKho(), p.getMaPhieu());
        return moTaPhieu(List.of(p)).get(0);
    }

    private List<ChuyenKeDto.Phieu> moTaPhieu(List<PhieuChuyenKe> ds) {
        if (ds.isEmpty()) return List.of();
        Map<Integer, List<ChiTietPhieuChuyenKe>> dong = chiTietRepo.theoPhieu(ds.stream().map(PhieuChuyenKe::getId).toList())
                .stream().collect(Collectors.groupingBy(c -> c.getPhieuChuyenKe().getId(), LinkedHashMap::new, Collectors.toList()));
        List<ChuyenKeDto.Phieu> kq = new ArrayList<>();
        for (PhieuChuyenKe p : ds) {
            List<ChiTietPhieuChuyenKe> cs = dong.getOrDefault(p.getId(), List.of());
            List<ChuyenKeDto.DongPhieu> d = cs.stream().map(c -> {
                BienTheSanPham bt = c.getBienTheSanPham();
                return new ChuyenKeDto.DongPhieu(c.getId(), c.getLoHang().getId(), c.getLoHang().getMaLo(), bt.getId(),
                        bt.getMaSku(), HienThiBienThe.tenSanPham(bt), HienThiBienThe.tenMau(bt), HienThiBienThe.maMauHex(bt), HienThiBienThe.kichCo(bt),
                        c.getKeNguon().getMaViTri(), c.getKeDich().getMaViTri(), SoTonKeService.soNguyen(c.getSoLuong()));
            }).toList();
            NguoiDung n = p.getNguoiThucHien();
            kq.add(new ChuyenKeDto.Phieu(p.getId(), p.getMaPhieu(), p.getLoaiChuyen(), p.getNgayThucHien(),
                    n == null ? null : n.getId(), n == null ? null : (n.getHoTen() != null ? n.getHoTen() : n.getTenDangNhap()),
                    Boolean.TRUE.equals(p.getVuotSucChua()), p.getGhiChu(),
                    d.stream().mapToInt(ChuyenKeDto.DongPhieu::soLuong).sum(),
                    d.stream().map(ChuyenKeDto.DongPhieu::keNguon).distinct().toList(),
                    d.stream().map(ChuyenKeDto.DongPhieu::keDich).distinct().toList(), d));
        }
        return kq;
    }
}
