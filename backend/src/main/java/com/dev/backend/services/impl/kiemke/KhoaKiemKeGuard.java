package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import com.dev.backend.i18n.ThongDiep;

/**
 * Chốt chặn kiểm kê dùng chung cho mọi luồng đổi tồn, đổi chỗ hàng hoặc đổi dữ liệu chủ (BR-STK-13, đặc tả BA 8.1–8.2).
 * <ol>
 *   <li>Đầu giao dịch, TRƯỚC khi khóa dòng tồn: {@link #giuKho} lấy khóa chia sẻ dòng kiem_ke_mutex_kho của kho (luồng
 *   kiểm kê lấy khóa ghi ở {@link #giuKhoGhi}). Bắt đầu / duyệt / hủy kiểm kê và các luồng thường vì vậy không chạy
 *   xen nhau trên một kho, nhưng hai luồng thường (hai quầy bán) vẫn chạy song song (chốt Đ5).</li>
 *   <li>Sau đó gọi hàm kiểm phù hợp: {@link #kiemTraXuat}, {@link #kiemTraNhapKe}, {@link #kiemTraNhapKho},
 *   {@link #kiemTraKe}, {@link #kiemTraKhuVuc}, {@link #kiemTraDanhMuc}, {@link #kiemTraKho}.</li>
 * </ol>
 * Khóa toàn kệ chặn mọi lô ở kệ; khóa mịn chỉ chặn cặp kệ–lô; đợt toàn kho chặn cả kho; đợt danh mục chặn mọi lô thuộc
 * tập danh mục ở kho đó, kể cả lô mới nhập. Lỗi trả 409 {@link MaLoi#STK_LOCKED}, câu không có chữ "bị khóa" (giao diện
 * coi cụm đó là tài khoản bị khóa). CSDL chưa nâng cấp ({@link KiemKeSanSang}) thì không làm gì.
 */
@Service
public class KhoaKiemKeGuard {

    @PersistenceContext
    private EntityManager em;

    private final KiemKeSanSang sanSang;

    public KhoaKiemKeGuard(KiemKeSanSang sanSang) {
        this.sanSang = sanSang;
    }

    // ───────────────────────────── Mutex kho ─────────────────────────────

    /** Khóa chia sẻ mutex các kho (luồng thường). Gọi trong giao dịch của luồng, trước khi khóa dòng tồn. */
    @Transactional
    public void giuKho(Collection<Integer> khoIds) {
        if (!sanSang.sanSang()) return;
        khoaMutex(khoIds, false);
    }

    @Transactional
    public void giuKho(Integer khoId) {
        giuKho(khoId == null ? List.of() : List.of(khoId));
    }

    /** Khóa chia sẻ mutex mọi kho: đổi dữ liệu chủ dùng chung (danh mục, sản phẩm). */
    @Transactional
    public void giuTatCaKho() {
        if (!sanSang.sanSang()) return;
        @SuppressWarnings("unchecked")
        List<Object> ids = em.createNativeQuery("SELECT id FROM kho ORDER BY id").getResultList();
        khoaMutex(ids.stream().map(o -> ((Number) o).intValue()).toList(), false);
    }

    /** Dòng mutex cho kho vừa tạo (migration chỉ tạo cho các kho có lúc chạy). */
    @Transactional
    public void taoMutex(Integer khoId) {
        if (khoId == null || !sanSang.sanSang()) return;
        em.createNativeQuery("INSERT IGNORE INTO kiem_ke_mutex_kho (kho_id) VALUES (:id)").setParameter("id", khoId).executeUpdate();
    }

    /** Khóa ghi mutex kho: Bắt đầu, Lô phát sinh, Phê duyệt, Hủy kiểm kê. */
    @Transactional
    public void giuKhoGhi(Integer khoId) {
        sanSang.batBuoc();
        khoaMutex(List.of(khoId), true);
    }

    private void khoaMutex(Collection<Integer> khoIds, boolean ghi) {
        List<Integer> ids = khoIds == null ? List.of()
                : khoIds.stream().filter(Objects::nonNull).distinct().sorted().toList();
        if (ids.isEmpty()) return;
        // Khóa ngay, không đọc thường trước: ở REPEATABLE READ lần đọc thường đầu tiên chốt ảnh dữ liệu, các câu đọc sau
        // lúc chờ mutex sẽ không thấy thay đổi của đợt vừa commit
        String khoa = "SELECT kho_id FROM kiem_ke_mutex_kho WHERE kho_id IN (:ids) ORDER BY kho_id "
                + (ghi ? "FOR UPDATE" : "FOR SHARE");
        @SuppressWarnings("unchecked")
        List<Object> co = em.createNativeQuery(khoa).setParameter("ids", ids).getResultList();
        if (co.size() < ids.size()) {
            // Kho tạo sau migration mà chưa có dòng mutex (KhoService tạo kèm; đây là lưới an toàn)
            em.createNativeQuery("INSERT IGNORE INTO kiem_ke_mutex_kho (kho_id) SELECT id FROM kho WHERE id IN (:ids)")
                    .setParameter("ids", ids).executeUpdate();
            em.createNativeQuery(khoa).setParameter("ids", ids).getResultList();
        }
    }

    // ───────────────────────────── Trạng thái khóa của một kho ─────────────────────────────

    /** Đợt đang giữ khóa (1, 2) của một kho cùng các khóa của chúng. Rỗng khi kho không có đợt nào. */
    public static final class TrangThaiKhoa {
        final Map<Integer, String> maDot = new HashMap<>();
        Integer dotToanKho;
        final Map<Integer, Integer> keToanKe = new HashMap<>();
        final Set<Integer> keKhoaMin = new HashSet<>();
        final Map<Long, Integer> capKhoaMin = new HashMap<>();
        final Map<Integer, Integer> danhMuc = new HashMap<>();
        final Map<Integer, Integer> khuVuc = new HashMap<>();

        public boolean trong() {
            return maDot.isEmpty();
        }

        public boolean keDangKhoaToan(Integer viTriId) {
            return dotToanKho != null || keToanKe.containsKey(viTriId);
        }

        public boolean capDangKhoa(Integer viTriId, Integer loId) {
            return keDangKhoaToan(viTriId) || capKhoaMin.containsKey(khoa(viTriId, loId));
        }

        Integer dotCuaCap(Integer viTriId, Integer loId) {
            if (dotToanKho != null) return dotToanKho;
            Integer d = keToanKe.get(viTriId);
            return d != null ? d : capKhoaMin.get(khoa(viTriId, loId));
        }
    }

    static long khoa(Integer viTriId, Integer loId) {
        return ((long) viTriId << 32) | (loId & 0xffffffffL);
    }

    /**
     * Đọc trạng thái khóa bằng câu đọc có khóa chia sẻ: luôn thấy bản đã commit mới nhất dù luồng gọi chạy REPEATABLE READ.
     * Các bảng này chỉ đổi khi giữ mutex kho dạng ghi (hoặc khóa dòng đợt), nên khóa chia sẻ không tạo vòng chờ.
     */
    private static final String DOC_MOI = " FOR SHARE";

    public TrangThaiKhoa trangThai(Integer khoId) {
        TrangThaiKhoa tt = new TrangThaiKhoa();
        if (khoId == null || !sanSang.sanSang()) return tt;
        @SuppressWarnings("unchecked")
        List<Object[]> dots = em.createNativeQuery(
                        "SELECT id, ma_dot_kiem_ke, loai_kiem_ke FROM dot_kiem_ke WHERE kho_id = :kho AND trang_thai IN (1, 2)"
                                + DOC_MOI)
                .setParameter("kho", khoId).getResultList();
        if (dots.isEmpty()) return tt;
        List<Integer> ids = new ArrayList<>();
        for (Object[] r : dots) {
            Integer id = ((Number) r[0]).intValue();
            ids.add(id);
            tt.maDot.put(id, (String) r[1]);
            if (IKiemKe.TOAN_BO.equals(r[2])) tt.dotToanKho = id;
        }
        @SuppressWarnings("unchecked")
        List<Object[]> ke = em.createNativeQuery("SELECT vi_tri_kho_id, dot_kiem_ke_id, che_do_khoa FROM dot_kiem_ke_vi_tri "
                        + "WHERE dot_kiem_ke_id IN (:ids) AND trang_thai_khoa = 1" + DOC_MOI)
                .setParameter("ids", ids).getResultList();
        for (Object[] r : ke) {
            Integer viTri = ((Number) r[0]).intValue();
            if (IKiemKe.TOAN_KE.equals(r[2])) tt.keToanKe.put(viTri, ((Number) r[1]).intValue());
            else tt.keKhoaMin.add(viTri);
        }
        @SuppressWarnings("unchecked")
        List<Object[]> cap = em.createNativeQuery("SELECT vi_tri_kho_id, lo_hang_id, dot_kiem_ke_id FROM dot_kiem_ke_khoa_lo "
                        + "WHERE dot_kiem_ke_id IN (:ids) AND trang_thai_khoa = 1" + DOC_MOI)
                .setParameter("ids", ids).getResultList();
        for (Object[] r : cap) {
            tt.capKhoaMin.put(khoa(((Number) r[0]).intValue(), ((Number) r[1]).intValue()), ((Number) r[2]).intValue());
        }
        @SuppressWarnings("unchecked")
        List<Object[]> dm = em.createNativeQuery("SELECT danh_muc_id, dot_kiem_ke_id FROM dot_kiem_ke_danh_muc "
                        + "WHERE dot_kiem_ke_id IN (:ids)" + DOC_MOI)
                .setParameter("ids", ids).getResultList();
        for (Object[] r : dm) tt.danhMuc.put(((Number) r[0]).intValue(), ((Number) r[1]).intValue());
        @SuppressWarnings("unchecked")
        List<Object[]> kv = em.createNativeQuery("SELECT khu_vuc_kho_id, dot_kiem_ke_id FROM dot_kiem_ke_khu_vuc "
                        + "WHERE dot_kiem_ke_id IN (:ids)" + DOC_MOI)
                .setParameter("ids", ids).getResultList();
        for (Object[] r : kv) tt.khuVuc.put(((Number) r[0]).intValue(), ((Number) r[1]).intValue());
        return tt;
    }

    /** Danh mục của từng lô: [loId → danhMucId]. */
    Map<Integer, Integer> danhMucCuaLo(Collection<Integer> loIds) {
        Map<Integer, Integer> kq = new HashMap<>();
        if (loIds == null || loIds.isEmpty()) return kq;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("SELECT l.id, sp.danh_muc_id FROM lo_hang l "
                        + "JOIN bien_the_san_pham bt ON bt.id = l.bien_the_san_pham_id "
                        + "JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id WHERE l.id IN (:ids)")
                .setParameter("ids", new ArrayList<>(new HashSet<>(loIds))).getResultList();
        for (Object[] r : rows) {
            if (r[1] != null) kq.put(((Number) r[0]).intValue(), ((Number) r[1]).intValue());
        }
        return kq;
    }

    /** Số của lô trên các kệ của kho: [loId → (viTriId → số)]. */
    private Map<Integer, Map<Integer, Integer>> soTrenKe(Integer khoId, Collection<Integer> loIds) {
        Map<Integer, Map<Integer, Integer>> kq = new HashMap<>();
        if (loIds == null || loIds.isEmpty()) return kq;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("SELECT t.lo_hang_id, t.vi_tri_kho_id, t.so_luong FROM ton_kho_vi_tri t "
                        + "JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id "
                        + "WHERE v.kho_id = :kho AND t.lo_hang_id IN (:ids) AND t.so_luong > 0")
                .setParameter("kho", khoId).setParameter("ids", new ArrayList<>(new HashSet<>(loIds))).getResultList();
        for (Object[] r : rows) {
            kq.computeIfAbsent(((Number) r[0]).intValue(), k -> new TreeMap<>())
                    .put(((Number) r[1]).intValue(), ((Number) r[2]).intValue());
        }
        return kq;
    }

    // ───────────────────────────── Số đang được giữ cho kiểm kê ─────────────────────────────

    /**
     * Lượng của từng lô ở kho đang thuộc phạm vi kiểm kê (không được lấy): cả tồn của lô khi kho kiểm toàn bộ hoặc lô
     * thuộc danh mục đang kiểm; còn lại là số trên các kệ đang khóa. {@code tonTheoLo}: tồn hiện tại của lô ở kho.
     * {@link com.dev.backend.services.impl.multitable.LoDangGiuService} cộng phần này vào "đang giữ" nên POS, phân bổ
     * nhặt FIFO và chọn lô tự lấy ở kệ tự do (AC-22).
     */
    public Map<Integer, BigDecimal> luongDangKiemKe(Integer khoId, Map<Integer, BigDecimal> tonTheoLo) {
        if (khoId == null || tonTheoLo == null || tonTheoLo.isEmpty() || !sanSang.sanSang()) return new HashMap<>();
        TrangThaiKhoa tt = trangThai(khoId);
        return tt.trong() ? new HashMap<>() : luongDangKiemKe(tt, khoId, tonTheoLo);
    }

    /** Như trên, tự đọc tồn lô ở kho (chỉ khi kho đang có đợt giữ khóa). */
    public Map<Integer, BigDecimal> luongDangKiemKe(Integer khoId, Collection<Integer> loIds) {
        if (khoId == null || loIds == null || loIds.isEmpty() || !sanSang.sanSang()) return new HashMap<>();
        TrangThaiKhoa tt = trangThai(khoId);
        if (tt.trong()) return new HashMap<>();
        return luongDangKiemKe(tt, khoId, tonCuaLo(khoId, loIds));
    }

    private Map<Integer, BigDecimal> tonCuaLo(Integer khoId, Collection<Integer> loIds) {
        Map<Integer, BigDecimal> ton = new HashMap<>();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("SELECT lo_hang_id, so_luong_ton FROM ton_kho_theo_lo "
                        + "WHERE kho_id = :kho AND lo_hang_id IN (:ids)")
                .setParameter("kho", khoId).setParameter("ids", new ArrayList<>(new HashSet<>(loIds))).getResultList();
        for (Object[] r : rows) ton.put(((Number) r[0]).intValue(), r[1] == null ? BigDecimal.ZERO : (BigDecimal) r[1]);
        return ton;
    }

    // ───────────────────────────── Thiếu hàng do kiểm kê ─────────────────────────────

    /**
     * Phần thiếu của một lần lấy hàng là do kiểm kê: câu báo (có mã đợt) và dữ liệu kèm lỗi STK_LOCKED.
     * {@link #loi()} dựng lỗi 409 để ném.
     */
    public record ThieuDoKiemKe(ThongDiep cau, Map<String, Object> duLieu, boolean toanKho) {
        public LoiCoMaException loi() {
            return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_LOCKED, cau, duLieu);
        }
    }

    /**
     * Lấy {@code can} từ các lô {@code loIds} của kho chỉ được {@code coTheLay}: số còn lại của lô theo
     * LoDangGiuService.conLai (đã trừ phần đang kiểm kê, CÓ THỂ ÂM — không cắt về 0, để phần phiếu khác giữ không bị bỏ
     * qua). Nếu cộng lại phần đang kiểm kê của các lô mà đủ {@code can} thì lý do thiếu là kiểm kê: trả câu báo nêu đợt
     * (đợt toàn kho → câu cấp kho). Null khi kho không có đợt, các lô không thuộc phạm vi, hoặc vẫn thiếu khi bỏ kiểm kê
     * ra (phiếu khác giữ / hàng thật sự không đủ) — nơi gọi giữ câu cũ. {@code maSku} khác null: câu theo mã hàng (quầy).
     */
    public ThieuDoKiemKe thieuDoKiemKe(Integer khoId, Collection<Integer> loIds, BigDecimal coTheLay, BigDecimal can,
                                       String thaoTac, String maSku) {
        BigDecimal lay = coTheLay == null ? BigDecimal.ZERO : coTheLay;
        return thieuDoKiemKe(khoId, loIds, lay,
                kk -> lay.add(kk.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)), can, thaoTac, maSku);
    }

    /**
     * Như trên khi số lấy được không cộng thẳng theo lô (quầy: Σ theo lô cắt 0 rồi trừ giữ chỗ phiếu chuyển; hoàn tất
     * nhặt: FIFO trừ phân bổ sẵn): {@code layNeuBoKiemKe} tính lại số lấy được khi bỏ phần đang kiểm kê (lô → số) ra.
     */
    public ThieuDoKiemKe thieuDoKiemKe(Integer khoId, Collection<Integer> loIds, BigDecimal coTheLay,
                                       java.util.function.Function<Map<Integer, BigDecimal>, BigDecimal> layNeuBoKiemKe,
                                       BigDecimal can, String thaoTac, String maSku) {
        if (khoId == null || loIds == null || loIds.isEmpty() || can == null || can.signum() <= 0 || !sanSang.sanSang()) {
            return null;
        }
        TrangThaiKhoa tt = trangThai(khoId);
        if (tt.trong()) return null;
        Map<Integer, BigDecimal> kk = luongDangKiemKe(tt, khoId, tonCuaLo(khoId, loIds));
        BigDecimal tong = kk.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (tong.signum() <= 0) return null;
        BigDecimal boKiemKe = layNeuBoKiemKe.apply(kk);
        if (boKiemKe == null || boKiemKe.compareTo(can) < 0) return null;
        BigDecimal lay = coTheLay == null ? BigDecimal.ZERO : coTheLay.max(BigDecimal.ZERO);
        Integer lo = loIds.stream().filter(l -> kk.getOrDefault(l, BigDecimal.ZERO).signum() > 0).findFirst().orElse(null);
        if (lo == null) return null;

        Integer dot;
        Integer ke = null;
        if (tt.dotToanKho != null) {
            dot = tt.dotToanKho;
        } else {
            Integer dm = tt.danhMuc.isEmpty() ? null : danhMucCuaLo(List.of(lo)).get(lo);
            if (dm != null && tt.danhMuc.containsKey(dm)) {
                dot = tt.danhMuc.get(dm);
            } else {
                dot = null;
                for (Integer viTri : soTrenKe(khoId, List.of(lo)).getOrDefault(lo, Map.of()).keySet()) {
                    if (tt.capDangKhoa(viTri, lo)) {
                        ke = viTri;
                        dot = tt.dotCuaCap(viTri, lo);
                        break;
                    }
                }
                if (dot == null) dot = tt.maDot.keySet().stream().sorted().findFirst().orElse(null);
            }
        }
        boolean toanKho = dot != null && dot.equals(tt.dotToanKho);
        if (maSku == null || toanKho) {
            LoiCoMaException e = loi(tt, dot, ke, lo, thaoTac);
            return new ThieuDoKiemKe(e.getThongDiep(), e.getDuLieu(), toanKho);
        }
        String ma = dot == null ? null : tt.maDot.get(dot);
        Object thaoTacDich = thaoTacTheoNgonNgu(thaoTac);
        ThongDiep cau = lay.signum() > 0
                ? ThongDiep.of("khoVanHanh.maChiConNgoaiKiemKe", maSku, so(lay), ma, so(can))
                : ThongDiep.of("khoVanHanh.maDangKiemKe", maSku, ma, thaoTacDich);
        Map<String, Object> duLieu = new LinkedHashMap<>();
        if (dot != null) duLieu.put("dotKiemKeId", dot);
        if (ma != null) duLieu.put("maDotKiemKe", ma);
        return new ThieuDoKiemKe(cau, duLieu, false);
    }

    private static String so(BigDecimal v) {
        return v.stripTrailingZeros().toPlainString();
    }

    // ───────────────────────────── Tóm tắt cho màn hình ─────────────────────────────

    /** Một đợt đang giữ khóa của kho: đang kiểm (1) hoặc chờ duyệt (2). */
    public record DotDangKiem(Integer id, String maDot, String loai, Integer trangThai) {
    }

    /**
     * Các đợt đang giữ khóa của kho, đợt cũ trước. Chỉ để hiển thị (dải báo ở quầy bán…), đọc thường không khóa.
     * CSDL chưa nâng cấp cho kiểm kê thì rỗng.
     */
    public List<DotDangKiem> dotDangKiem(Integer khoId) {
        if (khoId == null || !sanSang.sanSang()) return List.of();
        @SuppressWarnings("unchecked")
        // trang_thai là tinyint(1): bộ nối MySQL đọc thành Boolean (2 thành true) — ép về số nguyên ngay trong câu
        List<Object[]> rows = em.createNativeQuery("SELECT id, ma_dot_kiem_ke, loai_kiem_ke, CAST(trang_thai AS SIGNED) FROM dot_kiem_ke "
                        + "WHERE kho_id = :kho AND trang_thai IN (1, 2) ORDER BY id")
                .setParameter("kho", khoId).getResultList();
        List<DotDangKiem> kq = new ArrayList<>();
        for (Object[] r : rows) {
            kq.add(new DotDangKiem(((Number) r[0]).intValue(), (String) r[1], (String) r[2], ((Number) r[3]).intValue()));
        }
        return kq;
    }

    private Map<Integer, BigDecimal> luongDangKiemKe(TrangThaiKhoa tt, Integer khoId, Map<Integer, BigDecimal> tonTheoLo) {
        Map<Integer, BigDecimal> kq = new HashMap<>();
        Map<Integer, Integer> dm = tt.danhMuc.isEmpty() ? Map.of() : danhMucCuaLo(tonTheoLo.keySet());
        Map<Integer, Map<Integer, Integer>> ke = soTrenKe(khoId, tonTheoLo.keySet());
        for (Map.Entry<Integer, BigDecimal> e : tonTheoLo.entrySet()) {
            Integer lo = e.getKey();
            BigDecimal ton = e.getValue() == null ? BigDecimal.ZERO : e.getValue().max(BigDecimal.ZERO);
            if (tt.dotToanKho != null || (dm.get(lo) != null && tt.danhMuc.containsKey(dm.get(lo)))) {
                kq.put(lo, ton);
                continue;
            }
            int khoa = 0;
            for (Map.Entry<Integer, Integer> k : ke.getOrDefault(lo, Map.of()).entrySet()) {
                if (tt.capDangKhoa(k.getKey(), lo)) khoa += k.getValue();
            }
            if (khoa > 0) kq.put(lo, BigDecimal.valueOf(khoa).min(ton));
        }
        return kq;
    }

    /** Các kệ của lô ở kho đang khóa cho kiểm kê (sổ kệ bỏ qua khi trừ). */
    public Set<Integer> keDangKiemCuaLo(Integer khoId, Integer loId) {
        if (!sanSang.sanSang()) return Set.of();
        TrangThaiKhoa tt = trangThai(khoId);
        if (tt.trong()) return Set.of();
        Set<Integer> kq = new HashSet<>();
        for (Integer viTri : soTrenKe(khoId, List.of(loId)).getOrDefault(loId, Map.of()).keySet()) {
            if (tt.capDangKhoa(viTri, loId)) kq.add(viTri);
        }
        return kq;
    }

    // ───────────────────────────── Kiểm theo luồng ─────────────────────────────

    /**
     * Xuất / bán / trừ tồn lô ở kho mà không chỉ rõ kệ. {@code canTheoLo}: lượng cần lấy; {@code tonTheoLo}: tồn hiện tại
     * (dòng đã khóa). Chặn khi kho kiểm toàn bộ, lô thuộc danh mục đang kiểm, hoặc phần ngoài các kệ đang khóa không đủ.
     */
    public void kiemTraXuat(Integer khoId, Map<Integer, BigDecimal> canTheoLo, Map<Integer, BigDecimal> tonTheoLo,
                            String thaoTac) {
        if (khoId == null || canTheoLo == null || canTheoLo.isEmpty() || !sanSang.sanSang()) return;
        TrangThaiKhoa tt = trangThai(khoId);
        if (tt.trong()) return;
        Map<Integer, Integer> dm = tt.danhMuc.isEmpty() ? Map.of() : danhMucCuaLo(canTheoLo.keySet());
        Map<Integer, Map<Integer, Integer>> ke = soTrenKe(khoId, canTheoLo.keySet());
        for (Map.Entry<Integer, BigDecimal> e : canTheoLo.entrySet()) {
            Integer lo = e.getKey();
            BigDecimal can = e.getValue() == null ? BigDecimal.ZERO : e.getValue();
            if (can.signum() <= 0) continue;
            if (tt.dotToanKho != null) throw loi(tt, tt.dotToanKho, null, lo, thaoTac);
            Integer dmLo = dm.get(lo);
            if (dmLo != null && tt.danhMuc.containsKey(dmLo)) throw loi(tt, tt.danhMuc.get(dmLo), null, lo, thaoTac);
            int khoa = 0;
            Integer keDau = null;
            for (Map.Entry<Integer, Integer> k : ke.getOrDefault(lo, Map.of()).entrySet()) {
                if (tt.capDangKhoa(k.getKey(), lo)) {
                    khoa += k.getValue();
                    if (keDau == null) keDau = k.getKey();
                }
            }
            if (khoa == 0) continue;
            BigDecimal ton = tonTheoLo == null || tonTheoLo.get(lo) == null ? BigDecimal.ZERO : tonTheoLo.get(lo);
            if (can.compareTo(ton.subtract(BigDecimal.valueOf(khoa))) > 0) {
                throw loi(tt, tt.dotCuaCap(keDau, lo), keDau, lo, thaoTac);
            }
        }
    }

    /** Cất hàng lên một kệ (nhập, xếp kệ, chuyển kệ đến, hoàn kệ). */
    public void kiemTraNhapKe(Integer khoId, Integer viTriId, Collection<Integer> loIds, String thaoTac) {
        if (khoId == null || !sanSang.sanSang()) return;
        TrangThaiKhoa tt = trangThai(khoId);
        if (tt.trong()) return;
        if (viTriId != null && tt.keDangKhoaToan(viTriId)) {
            Integer dot = tt.dotToanKho != null ? tt.dotToanKho : tt.keToanKe.get(viTriId);
            throw loi(tt, dot, viTriId, loIds == null || loIds.isEmpty() ? null : loIds.iterator().next(), thaoTac);
        }
        kiemTraLoTheoDanhMuc(tt, loIds, thaoTac);
        if (viTriId != null && loIds != null) {
            for (Integer lo : loIds) {
                Integer dot = tt.capKhoaMin.get(khoa(viTriId, lo));
                if (dot != null) throw loi(tt, dot, viTriId, lo, thaoTac);
            }
        }
    }

    /** Hàng vào kho mà chưa lên kệ (nhận chuyển kho, nhập hoàn trả không kệ). */
    public void kiemTraNhapKho(Integer khoId, Collection<Integer> loIds, String thaoTac) {
        if (khoId == null || !sanSang.sanSang()) return;
        TrangThaiKhoa tt = trangThai(khoId);
        if (tt.trong()) return;
        if (tt.dotToanKho != null) {
            throw loi(tt, tt.dotToanKho, null, loIds == null || loIds.isEmpty() ? null : loIds.iterator().next(), thaoTac);
        }
        kiemTraLoTheoDanhMuc(tt, loIds, thaoTac);
    }

    private void kiemTraLoTheoDanhMuc(TrangThaiKhoa tt, Collection<Integer> loIds, String thaoTac) {
        if (tt.danhMuc.isEmpty() || loIds == null || loIds.isEmpty()) return;
        Map<Integer, Integer> dm = danhMucCuaLo(loIds);
        for (Integer lo : loIds) {
            Integer d = dm.get(lo);
            if (d != null && tt.danhMuc.containsKey(d)) throw loi(tt, tt.danhMuc.get(d), null, lo, thaoTac);
        }
    }

    /** Sửa / xóa kệ, đổi khu hoặc trạng thái của kệ khi kệ đang thuộc phạm vi một đợt (Master Data Guard). */
    /**
     * Mã các đợt kiểm kê từng dùng kệ (phạm vi, dòng kiểm kê): khóa ngoại giữ lịch sử nên kệ này không xóa được. Tối đa 3
     * mã. Phân bổ nhặt theo kệ kiểm riêng ({@link PhanBoKeService#phieuDangGiuKe}).
     */
    @SuppressWarnings("unchecked")
    public List<String> dotTungDungKe(Integer viTriId) {
        if (viTriId == null || !sanSang.sanSang()) return List.of();
        List<Object> r = em.createNativeQuery("SELECT DISTINCT d.ma_dot_kiem_ke FROM dot_kiem_ke d WHERE d.id IN ("
                        + "SELECT v.dot_kiem_ke_id FROM dot_kiem_ke_vi_tri v WHERE v.vi_tri_kho_id = :id "
                        + "UNION SELECT c.dot_kiem_ke_id FROM chi_tiet_kiem_ke c WHERE c.vi_tri_kho_id = :id) "
                        + "ORDER BY d.ma_dot_kiem_ke DESC LIMIT 3")
                .setParameter("id", viTriId).getResultList();
        return r.stream().map(String::valueOf).toList();
    }

    public void kiemTraKe(Integer viTriId, String thaoTac) {
        if (viTriId == null || !sanSang.sanSang()) return;
        @SuppressWarnings("unchecked")
        List<Object[]> r = em.createNativeQuery("SELECT kho_id, khu_vuc_kho_id FROM vi_tri_kho WHERE id = :id")
                .setParameter("id", viTriId).getResultList();
        if (r.isEmpty()) return;
        Integer khoId = ((Number) r.get(0)[0]).intValue();
        Integer khuVuc = r.get(0)[1] == null ? null : ((Number) r.get(0)[1]).intValue();
        TrangThaiKhoa tt = trangThai(khoId);
        if (tt.trong()) return;
        Integer dot = tt.dotToanKho != null ? tt.dotToanKho
                : tt.keToanKe.containsKey(viTriId) ? tt.keToanKe.get(viTriId)
                : khuVuc != null && tt.khuVuc.containsKey(khuVuc) ? tt.khuVuc.get(khuVuc) : null;
        if (dot == null && tt.keKhoaMin.contains(viTriId)) {
            dot = tt.capKhoaMin.entrySet().stream().filter(e -> (int) (e.getKey() >> 32) == viTriId)
                    .map(Map.Entry::getValue).findFirst().orElse(tt.maDot.keySet().iterator().next());
        }
        if (dot != null) throw loi(tt, dot, viTriId, null, thaoTac);
    }

    /** Thêm kệ vào khu vực / sửa khu vực đang thuộc đợt theo khu vực hoặc toàn kho. */
    public void kiemTraKhuVuc(Integer khuVucId, String thaoTac) {
        if (khuVucId == null || !sanSang.sanSang()) return;
        @SuppressWarnings("unchecked")
        List<Object> r = em.createNativeQuery("SELECT kho_id FROM khu_vuc_kho WHERE id = :id")
                .setParameter("id", khuVucId).getResultList();
        if (r.isEmpty()) return;
        TrangThaiKhoa tt = trangThai(((Number) r.get(0)).intValue());
        if (tt.trong()) return;
        Integer dot = tt.dotToanKho != null ? tt.dotToanKho : tt.khuVuc.get(khuVucId);
        if (dot != null) throw loi(tt, dot, null, null, thaoTac);
    }

    /** Đổi danh mục của sản phẩm / đổi cha của danh mục thuộc tập đang kiểm ở bất kỳ kho nào. */
    public void kiemTraDanhMuc(Collection<Integer> danhMucIds, String thaoTac) {
        List<Integer> ids = danhMucIds == null ? List.of() : danhMucIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty() || !sanSang.sanSang()) return;
        @SuppressWarnings("unchecked")
        List<Object[]> r = em.createNativeQuery("SELECT d.id, d.ma_dot_kiem_ke FROM dot_kiem_ke_danh_muc dm "
                        + "JOIN dot_kiem_ke d ON d.id = dm.dot_kiem_ke_id "
                        + "WHERE d.trang_thai IN (1, 2) AND dm.danh_muc_id IN (:ids) ORDER BY d.id LIMIT 1")
                .setParameter("ids", ids).getResultList();
        if (r.isEmpty()) return;
        String ma = (String) r.get(0)[1];
        throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_LOCKED,
                ThongDiep.of("khoVanHanh.danhMucDangKiemKe", ma, thaoTacTheoNgonNgu(thaoTac)),
                Map.of("dotKiemKeId", ((Number) r.get(0)[0]).intValue(), "maDotKiemKe", ma));
    }

    /** Ngừng / đổi loại kho khi kho đang có đợt kiểm kê. */
    public void kiemTraKho(Integer khoId, String thaoTac) {
        if (khoId == null || !sanSang.sanSang()) return;
        TrangThaiKhoa tt = trangThai(khoId);
        if (tt.trong()) return;
        throw loi(tt, tt.maDot.keySet().iterator().next(), null, null, thaoTac);
    }

    // ───────────────────────────── Câu báo ─────────────────────────────

    LoiCoMaException loi(TrangThaiKhoa tt, Integer dotId, Integer viTriId, Integer loId, String thaoTac) {
        String ma = dotId == null ? null : tt.maDot.get(dotId);
        // Đợt toàn kho: cả kho dừng, câu nói theo kho — không nêu mã lô / kệ (người bán hàng không biết mã lô)
        if (dotId != null && dotId.equals(tt.dotToanKho)) {
            viTriId = null;
            loId = null;
        }
        String maKe = null;
        String maLo = null;
        if (viTriId != null) {
            @SuppressWarnings("unchecked")
            List<Object> r = em.createNativeQuery("SELECT ma_vi_tri FROM vi_tri_kho WHERE id = :id")
                    .setParameter("id", viTriId).getResultList();
            if (!r.isEmpty()) maKe = (String) r.get(0);
        }
        if (loId != null) {
            @SuppressWarnings("unchecked")
            List<Object> r = em.createNativeQuery("SELECT ma_lo FROM lo_hang WHERE id = :id")
                    .setParameter("id", loId).getResultList();
            if (!r.isEmpty()) maLo = (String) r.get(0);
        }
        // Câu: "<Lô X ở kệ Y | Kệ Y | Lô X | Kho này> đang được kiểm kê[ (đợt M)]. Tạm dừng <thao tác> tới khi …"
        Object thaoTacDich = thaoTacTheoNgonNgu(thaoTac);
        ThongDiep cau;
        if (maLo != null && maKe != null) {
            cau = ma != null ? ThongDiep.of("khoVanHanh.loOKeDangKiemKeCoDot", maLo, maKe, ma, thaoTacDich)
                    : ThongDiep.of("khoVanHanh.loOKeDangKiemKe", maLo, maKe, thaoTacDich);
        } else if (maKe != null) {
            cau = ma != null ? ThongDiep.of("khoVanHanh.keDangKiemKeCoDot", maKe, ma, thaoTacDich)
                    : ThongDiep.of("khoVanHanh.keDangKiemKeTamDung", maKe, thaoTacDich);
        } else if (maLo != null) {
            cau = ma != null ? ThongDiep.of("khoVanHanh.loDangKiemKeCoDot", maLo, ma, thaoTacDich)
                    : ThongDiep.of("khoVanHanh.loDangKiemKe", maLo, thaoTacDich);
        } else {
            cau = ma != null ? ThongDiep.of("khoVanHanh.khoDangKiemKeCoDot", ma, thaoTacDich)
                    : ThongDiep.of("khoVanHanh.khoDangKiemKe", thaoTacDich);
        }
        Map<String, Object> duLieu = new LinkedHashMap<>();
        if (dotId != null) duLieu.put("dotKiemKeId", dotId);
        if (ma != null) duLieu.put("maDotKiemKe", ma);
        if (maKe != null) duLieu.put("viTri", maKe);
        if (maLo != null) duLieu.put("maLo", maLo);
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_LOCKED, cau, duLieu);
    }

    /**
     * Thao tác bị tạm dừng: nơi gọi truyền cụm tiếng Việt ("sửa kệ", "xuất kho"…). Cụm đã biết đổi sang câu theo khóa để
     * câu lỗi dịch được trọn; cụm lạ giữ nguyên chữ (câu tiếng Việt không đổi).
     */
    private static final Map<String, String> KHOA_THAO_TAC = Map.ofEntries(
            Map.entry("đổi danh mục cha", "khoVanHanh.thaoTacDoiDanhMucCha"),
            Map.entry("đổi danh mục sản phẩm", "khoVanHanh.thaoTacDoiDanhMucSanPham"),
            Map.entry("việc ngừng kinh doanh sản phẩm", "khoVanHanh.thaoTacNgungKinhDoanhSanPham"),
            Map.entry("ngừng hoạt động kho", "khoVanHanh.thaoTacNgungHoatDongKho"),
            Map.entry("nhận hàng chuyển kho (hàng vẫn ở kho trung chuyển)", "khoVanHanh.thaoTacNhanHangChuyenKho"),
            Map.entry("nhập hàng lên kệ", "khoVanHanh.thaoTacNhapHangLenKe"),
            Map.entry("nhập hàng vào kho", "khoVanHanh.thaoTacNhapHangVaoKho"),
            Map.entry("xuất kho", "khoVanHanh.thaoTacXuatKho"),
            Map.entry("bán tại quầy", "khoVanHanh.thaoTacBanTaiQuay"),
            Map.entry("nhận hàng khách trả", "khoVanHanh.thaoTacNhanHangKhachTra"),
            Map.entry("thêm kệ vào khu vực", "khoVanHanh.thaoTacThemKeVaoKhuVuc"),
            Map.entry("chuyển kệ vào khu vực", "khoVanHanh.thaoTacChuyenKeVaoKhuVuc"),
            Map.entry("sửa kệ", "khoVanHanh.thaoTacSuaKe"),
            Map.entry("xóa kệ", "khoVanHanh.thaoTacXoaKe"),
            Map.entry("xếp hàng lên kệ", "khoVanHanh.thaoTacXepHangLenKe"),
            Map.entry("chuyển hàng khỏi kệ", "khoVanHanh.thaoTacChuyenHangKhoiKe"),
            Map.entry("chuyển hàng lên kệ", "khoVanHanh.thaoTacChuyenHangLenKe"),
            Map.entry("hoàn kệ", "khoVanHanh.thaoTacHoanKe"),
            Map.entry("nhặt ở kệ này", "khoVanHanh.thaoTacNhatOKeNay"));

    static Object thaoTacTheoNgonNgu(String thaoTac) {
        String khoa = thaoTac == null ? null : KHOA_THAO_TAC.get(thaoTac);
        return khoa == null ? thaoTac : ThongDiep.of(khoa);
    }
}
