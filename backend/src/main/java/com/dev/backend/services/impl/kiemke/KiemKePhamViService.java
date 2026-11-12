package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.DanhMucQuanAoRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.KhuVucKhoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import com.dev.backend.i18n.ThongDiep;

/**
 * Xác định phạm vi của một đợt kiểm kê và các vướng mắc trước khi bắt đầu (đặc tả BA 4.1–4.2, UC-STK-01/02):
 * <ul>
 *   <li>Kệ trong phạm vi: toàn kho (mọi kệ, gồm kệ trống), các khu vực đã chọn, các kệ đã chọn; theo danh mục là các kệ có
 *   lô thuộc tập danh mục (gốc + mọi hậu duệ).</li>
 *   <li>Dòng chốt: mỗi cặp kệ–lô có số trên sổ kệ &gt; 0.</li>
 *   <li>Vướng mắc: kệ bảo trì, giao thoa với đợt đang giữ khóa (ma trận 4.2), phiếu nhặt đang mở / phiếu xuất đã nhặt chưa
 *   xuất / QR payOS đang giữ hàng (BR-STK-03, Đ13), tồn chưa có kệ (Đ4), sổ kệ lệch tồn lô.</li>
 * </ul>
 * Xem trước gọi không khóa; Bắt đầu gọi lại trong giao dịch đã giữ mutex kho (khóa ghi) và khóa các dòng sổ kệ.
 */
@Slf4j
@Service
public class KiemKePhamViService {

    /** Số dòng chi tiết tối đa trong một vướng mắc (câu báo không dài vô hạn). */
    static final int TOI_DA_CHI_TIET = 8;

    @PersistenceContext
    private EntityManager em;

    private final KhoRepository khoRepository;
    private final KhuVucKhoRepository khuVucKhoRepository;
    private final DanhMucQuanAoRepository danhMucQuanAoRepository;
    private final KhoaKiemKeGuard guard;
    private final ObjectMapper objectMapper;

    /** Phân bổ nhặt theo kệ: biết phân bổ nào đã chia kệ để xét phiếu nhặt / phiếu xuất theo kệ thay vì theo lô. */
    @Autowired(required = false)
    private PhanBoKeService phanBoKeService;

    public KiemKePhamViService(KhoRepository khoRepository, KhuVucKhoRepository khuVucKhoRepository,
                               DanhMucQuanAoRepository danhMucQuanAoRepository, KhoaKiemKeGuard guard,
                               ObjectMapper objectMapper) {
        this.khoRepository = khoRepository;
        this.khuVucKhoRepository = khuVucKhoRepository;
        this.danhMucQuanAoRepository = danhMucQuanAoRepository;
        this.guard = guard;
        this.objectMapper = objectMapper;
    }

    /** Lựa chọn phạm vi (từ form tạo đợt hoặc từ đợt nháp đã lưu). */
    public record LuaChon(Integer khoId, String loai, List<Integer> khuVucIds, List<Integer> viTriIds, Integer danhMucId) {
        public LuaChon {
            khuVucIds = khuVucIds == null ? List.of() : khuVucIds.stream().filter(Objects::nonNull).distinct().sorted().toList();
            viTriIds = viTriIds == null ? List.of() : viTriIds.stream().filter(Objects::nonNull).distinct().sorted().toList();
        }
    }

    /** Một vướng mắc: mã lỗi STK_* và câu cho người dùng (theo khóa; {@link #noiDung()} là câu tiếng Việt). */
    public record VanDe(String ma, ThongDiep cau) {
        public String noiDung() {
            return cau.tiengViet();
        }
    }

    /**
     * Kết quả xác định phạm vi. {@code dong}: dòng sổ kệ sẽ chốt (sắp theo kệ rồi lô). {@code vanDe} chặn Bắt đầu;
     * {@code canhBao} chỉ để người lập đợt biết (không chặn).
     */
    public record PhamVi(Kho kho, String loai, List<ViTriKho> ke, Set<Integer> danhMuc, List<TonKhoViTri> dong,
                         List<VanDe> vanDe, List<VanDe> canhBao) {
        public int soLo() {
            return (int) dong.stream().map(t -> t.getLoHang().getId()).distinct().count();
        }

        public long tongSoLuong() {
            return dong.stream().mapToLong(t -> t.getSoLuong() == null ? 0 : t.getSoLuong()).sum();
        }

        /** Kệ có trong phạm vi: toàn kệ là danh sách kệ, theo danh mục là các kệ của dòng chốt. */
        public List<Integer> keIds() {
            if (IKiemKe.THEO_DANH_MUC.equals(loai)) {
                return dong.stream().map(t -> t.getViTriKho().getId()).distinct().sorted().toList();
            }
            return ke.stream().map(ViTriKho::getId).toList();
        }
    }

    // ───────────────────────────── Kiểm lựa chọn ─────────────────────────────

    static LoiCoMaException phamViSai(ThongDiep cau) {
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.STK_INVALID_SCOPE, cau);
    }

    /** Kho vật lý đang hoạt động (BR-STK-01, BR-STK-03: kho ảo không kiểm kê). */
    public Kho khoHopLe(Integer khoId) {
        if (khoId == null) throw phamViSai(ThongDiep.of("khoVanHanh.chonKhoCanKiemKe"));
        Kho kho = khoRepository.findById(khoId).orElseThrow(() -> phamViSai(ThongDiep.of("khoVanHanh.khoDaChonKhongTimThay")));
        if (IKiemKe.MA_KHO_AO.equals(kho.getMaKho())) {
            throw phamViSai(ThongDiep.of("khoVanHanh.khoTrungChuyenKhongKiemKe"));
        }
        if (!Integer.valueOf(1).equals(kho.getTrangThai())) {
            throw phamViSai(ThongDiep.of("khoVanHanh.khoDangNgungHoatDong", kho.getTenKho()));
        }
        return kho;
    }

    /** Loại phạm vi và các lựa chọn thuộc đúng kho. */
    public void kiemTraLuaChon(Kho kho, LuaChon lc) {
        String loai = lc.loai();
        if (!List.of(IKiemKe.TOAN_BO, IKiemKe.THEO_KHU_VUC, IKiemKe.THEO_KE, IKiemKe.THEO_DANH_MUC).contains(loai)) {
            throw phamViSai(ThongDiep.of("khoVanHanh.chonPhamViKiemKeDayDu"));
        }
        if (IKiemKe.THEO_KHU_VUC.equals(loai)) {
            if (lc.khuVucIds().isEmpty()) throw phamViSai(ThongDiep.of("khoVanHanh.chonItNhatMotKhuVuc"));
            List<KhuVucKho> kv = khuVucKhoRepository.findAllById(lc.khuVucIds());
            if (kv.size() != lc.khuVucIds().size() || kv.stream().anyMatch(k -> k.getKho() == null || !kho.getId().equals(k.getKho().getId()))) {
                throw phamViSai(ThongDiep.of("khoVanHanh.coKhuVucKhongThuocKho", kho.getTenKho()));
            }
        }
        if (IKiemKe.THEO_KE.equals(loai)) {
            if (lc.viTriIds().isEmpty()) throw phamViSai(ThongDiep.of("khoVanHanh.chonItNhatMotKe"));
            @SuppressWarnings("unchecked")
            List<Object> khoCuaKe = em.createNativeQuery("SELECT kho_id FROM vi_tri_kho WHERE id IN (:ids)")
                    .setParameter("ids", lc.viTriIds()).getResultList();
            if (khoCuaKe.size() != lc.viTriIds().size() || khoCuaKe.stream().anyMatch(k -> ((Number) k).intValue() != kho.getId())) {
                throw phamViSai(ThongDiep.of("khoVanHanh.coKeKhongThuocKho", kho.getTenKho()));
            }
        }
        if (IKiemKe.THEO_DANH_MUC.equals(loai)) {
            if (lc.danhMucId() == null || !danhMucQuanAoRepository.existsById(lc.danhMucId())) {
                throw phamViSai(ThongDiep.of("khoVanHanh.chonDanhMucCanKiemKe"));
            }
        }
    }

    // ───────────────────────────── Tập danh mục ─────────────────────────────

    /**
     * Danh mục gốc + mọi hậu duệ (mục 2, BR-STK-05). Cây có vòng lặp hoặc sâu quá {@link IKiemKe#DO_SAU_DANH_MUC_TOI_DA}
     * thì báo lỗi, không chốt tập bị cắt ngầm.
     */
    public Set<Integer> tapDanhMuc(Integer goc) {
        Map<Integer, List<Integer>> con = new HashMap<>();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("SELECT id, danh_muc_cha_id FROM danh_muc_quan_ao").getResultList();
        for (Object[] r : rows) {
            if (r[1] != null) con.computeIfAbsent(((Number) r[1]).intValue(), k -> new ArrayList<>()).add(((Number) r[0]).intValue());
        }
        Set<Integer> tap = new LinkedHashSet<>();
        Deque<int[]> cho = new ArrayDeque<>();
        cho.add(new int[]{goc, 0});
        while (!cho.isEmpty()) {
            int[] x = cho.poll();
            if (!tap.add(x[0])) {
                throw phamViSai(ThongDiep.of("khoVanHanh.cayDanhMucVongLap", x[0]));
            }
            if (x[1] > IKiemKe.DO_SAU_DANH_MUC_TOI_DA) {
                throw phamViSai(ThongDiep.of("khoVanHanh.cayDanhMucQuaSau", IKiemKe.DO_SAU_DANH_MUC_TOI_DA));
            }
            for (Integer c : con.getOrDefault(x[0], List.of())) cho.add(new int[]{c, x[1] + 1});
        }
        return tap;
    }

    // ───────────────────────────── Xác định phạm vi ─────────────────────────────

    /**
     * @param boQuaDotId đợt đang xét (không tự giao thoa với chính nó), có thể null
     * @param khoa       true khi Bắt đầu: khóa các dòng kệ và sổ kệ theo id tăng dần (đã giữ mutex kho)
     */
    public PhamVi xacDinh(LuaChon lc, Integer boQuaDotId, boolean khoa) {
        Kho kho = khoHopLe(lc.khoId());
        kiemTraLuaChon(kho, lc);
        String loai = lc.loai();
        Set<Integer> danhMuc = IKiemKe.THEO_DANH_MUC.equals(loai) ? tapDanhMuc(lc.danhMucId()) : Set.of();
        List<ViTriKho> ke = keTrongPhamVi(kho, lc, khoa);
        List<TonKhoViTri> dong = dongChot(kho, loai, ke, danhMuc, khoa);
        List<VanDe> vanDe = new ArrayList<>();
        if (IKiemKe.laKhoaToanKe(loai) && ke.isEmpty()) {
            vanDe.add(new VanDe(MaLoi.STK_INVALID_SCOPE, IKiemKe.TOAN_BO.equals(loai)
                    ? ThongDiep.of("khoVanHanh.khoChuaCoKe")
                    : ThongDiep.of("khoVanHanh.phamViKhongCoKe")));
        }
        vanDe.addAll(keKhongKiemDuoc(ke));
        vanDe.addAll(giaoThoa(kho, loai, ke, danhMuc, dong, boQuaDotId));
        Set<Integer> loTrongPhamVi = dong.stream().map(t -> t.getLoHang().getId()).collect(Collectors.toSet());
        Set<Integer> bienTheTrongPhamVi = dong.stream().map(t -> t.getLoHang().getBienTheSanPham().getId())
                .collect(Collectors.toSet());
        Set<Integer> keTrongPhamVi = ke.stream().map(ViTriKho::getId).collect(Collectors.toSet());
        vanDe.addAll(viecDo(kho, loai, keTrongPhamVi, loTrongPhamVi, danhMuc));
        vanDe.addAll(hangRoiKe(kho, loai, loTrongPhamVi, bienTheTrongPhamVi, danhMuc));
        vanDe.addAll(tonChuaCoKe(kho, loai, danhMuc, loTrongPhamVi));
        List<VanDe> canhBao = canhBao(kho, loai, keTrongPhamVi, danhMuc);
        return new PhamVi(kho, loai, ke, danhMuc, dong, vanDe, canhBao);
    }

    private List<ViTriKho> keTrongPhamVi(Kho kho, LuaChon lc, boolean khoa) {
        String jpql;
        switch (lc.loai()) {
            case IKiemKe.TOAN_BO -> jpql = "SELECT v FROM ViTriKho v WHERE v.kho.id = :kho ORDER BY v.id";
            case IKiemKe.THEO_KHU_VUC -> jpql = "SELECT v FROM ViTriKho v WHERE v.kho.id = :kho AND v.khuVucKho.id IN :ids ORDER BY v.id";
            case IKiemKe.THEO_KE -> jpql = "SELECT v FROM ViTriKho v WHERE v.kho.id = :kho AND v.id IN :ids ORDER BY v.id";
            default -> {
                return List.of();
            }
        }
        TypedQuery<ViTriKho> q = em.createQuery(jpql, ViTriKho.class).setParameter("kho", kho.getId());
        if (IKiemKe.THEO_KHU_VUC.equals(lc.loai())) q.setParameter("ids", lc.khuVucIds());
        if (IKiemKe.THEO_KE.equals(lc.loai())) q.setParameter("ids", lc.viTriIds());
        if (khoa) q.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        List<ViTriKho> ke = q.getResultList();
        if (khoa) for (ViTriKho v : ke) em.refresh(v, LockModeType.PESSIMISTIC_WRITE);
        return ke;
    }

    private List<TonKhoViTri> dongChot(Kho kho, String loai, List<ViTriKho> ke, Set<Integer> danhMuc, boolean khoa) {
        List<Integer> ids;
        if (IKiemKe.THEO_DANH_MUC.equals(loai)) {
            if (danhMuc.isEmpty()) return List.of();
            ids = em.createQuery("SELECT t.id FROM TonKhoViTri t WHERE t.viTriKho.kho.id = :kho AND t.soLuong > 0 "
                            + "AND t.loHang.bienTheSanPham.sanPham.danhMuc.id IN :dm ORDER BY t.id", Integer.class)
                    .setParameter("kho", kho.getId()).setParameter("dm", danhMuc).getResultList();
        } else {
            if (ke.isEmpty()) return List.of();
            ids = em.createQuery("SELECT t.id FROM TonKhoViTri t WHERE t.viTriKho.id IN :ke AND t.soLuong > 0 ORDER BY t.id", Integer.class)
                    .setParameter("ke", ke.stream().map(ViTriKho::getId).toList()).getResultList();
        }
        if (ids.isEmpty()) return List.of();
        TypedQuery<TonKhoViTri> q = em.createQuery("SELECT t FROM TonKhoViTri t JOIN FETCH t.loHang JOIN FETCH t.viTriKho "
                + "WHERE t.id IN :ids ORDER BY t.id", TonKhoViTri.class).setParameter("ids", ids);
        List<TonKhoViTri> dong;
        if (khoa) {
            // Khóa theo PK một bảng (không JOIN) rồi nạp lại: JOIN FETCH + FOR UPDATE sẽ khóa cả dòng lô và kệ
            em.createQuery("SELECT t FROM TonKhoViTri t WHERE t.id IN :ids ORDER BY t.id", TonKhoViTri.class)
                    .setParameter("ids", ids).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
            dong = q.getResultList();
            for (TonKhoViTri t : dong) em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
        } else {
            dong = q.getResultList();
        }
        dong = new ArrayList<>(dong);
        dong.sort(Comparator.comparing((TonKhoViTri t) -> t.getViTriKho().getMaViTri())
                .thenComparing(t -> t.getLoHang().getMaLo()).thenComparing(TonKhoViTri::getId));
        return dong;
    }

    // ───────────────────────────── Vướng mắc ─────────────────────────────

    private List<VanDe> keKhongKiemDuoc(List<ViTriKho> ke) {
        List<String> baoTri = ke.stream().filter(v -> v.getTrangThai() != null
                        && !IKiemKe.KE_HOAT_DONG.equals(v.getTrangThai()) && !IKiemKe.KE_DAY_HANG.equals(v.getTrangThai())
                        && !IKiemKe.KE_KHOA_KIEM_KE.equals(v.getTrangThai()))
                .map(ViTriKho::getMaViTri).toList();
        if (baoTri.isEmpty()) return List.of();
        return List.of(new VanDe(MaLoi.STK_INVALID_SCOPE, ThongDiep.of("khoVanHanh.keBaoTriKhongKiemDuoc", gonTheoKhoa(baoTri))));
    }

    /** Ma trận giao thoa mục 4.2 với các đợt đang kiểm kê / chờ duyệt của cùng kho. */
    private List<VanDe> giaoThoa(Kho kho, String loai, List<ViTriKho> ke, Set<Integer> danhMuc, List<TonKhoViTri> dong,
                                 Integer boQuaDotId) {
        KhoaKiemKeGuard.TrangThaiKhoa tt = guard.trangThai(kho.getId());
        Map<Integer, String> maDot = new HashMap<>(tt.maDot);
        if (boQuaDotId != null) maDot.remove(boQuaDotId);
        if (maDot.isEmpty()) return List.of();
        Map<Integer, String> tenKe = new HashMap<>();
        ke.forEach(v -> tenKe.put(v.getId(), v.getMaViTri()));
        dong.forEach(t -> tenKe.put(t.getViTriKho().getId(), t.getViTriKho().getMaViTri()));
        // Mỗi đợt: các mục giao thoa, sắp và bỏ trùng theo câu tiếng Việt như trước; giữ câu theo khóa để dịch
        Map<Integer, Map<String, ThongDiep>> theoDot = new TreeMap<>();
        java.util.function.BiConsumer<Integer, ThongDiep> them = (d, muc) ->
                theoDot.computeIfAbsent(d, k -> new TreeMap<>()).putIfAbsent(muc.tiengViet(), muc);
        if (IKiemKe.TOAN_BO.equals(loai)) {
            maDot.keySet().forEach(d -> them.accept(d, ThongDiep.of("khoVanHanh.giaoThoaToanKho")));
        } else if (tt.dotToanKho != null && maDot.containsKey(tt.dotToanKho)) {
            them.accept(tt.dotToanKho, ThongDiep.of("khoVanHanh.giaoThoaDotKiemToanKho"));
        } else if (IKiemKe.laKhoaToanKe(loai)) {
            for (ViTriKho v : ke) {
                Integer d = tt.keToanKe.get(v.getId());
                if (d != null && maDot.containsKey(d)) them.accept(d, ThongDiep.of("khoVanHanh.giaoThoaKe", v.getMaViTri()));
                if (tt.keKhoaMin.contains(v.getId())) {
                    tt.capKhoaMin.forEach((cap, dot) -> {
                        if ((int) (cap >> 32) == v.getId() && maDot.containsKey(dot)) {
                            them.accept(dot, ThongDiep.of("khoVanHanh.giaoThoaKeTheoDanhMuc", v.getMaViTri()));
                        }
                    });
                }
            }
        } else {
            tt.danhMuc.forEach((dm, dot) -> {
                if (danhMuc.contains(dm) && maDot.containsKey(dot)) {
                    them.accept(dot, ThongDiep.of("khoVanHanh.giaoThoaDanhMuc"));
                }
            });
            for (TonKhoViTri t : dong) {
                Integer d = tt.keToanKe.get(t.getViTriKho().getId());
                if (d != null && maDot.containsKey(d)) them.accept(d, ThongDiep.of("khoVanHanh.giaoThoaKe", t.getViTriKho().getMaViTri()));
            }
        }
        List<VanDe> kq = new ArrayList<>();
        theoDot.forEach((dot, chiTiet) -> kq.add(new VanDe(MaLoi.STK_SCOPE_CONFLICT,
                ThongDiep.of("khoVanHanh.giaoThoaVoiDot", maDot.get(dot), gonTheoKhoa(new ArrayList<>(chiTiet.values()))))));
        return kq;
    }

    /** Phiếu nhặt đang mở, phiếu xuất đã có lô chưa xuất, QR payOS đang giữ hàng (BR-STK-03, Đ13). */
    private List<VanDe> viecDo(Kho kho, String loai, Set<Integer> keIds, Set<Integer> loTrongPhamVi, Set<Integer> danhMuc) {
        boolean toanKho = IKiemKe.TOAN_BO.equals(loai);
        boolean theoDanhMuc = IKiemKe.THEO_DANH_MUC.equals(loai);
        Set<Integer> loDanhMuc = theoDanhMuc ? loThuocDanhMuc(kho.getId(), danhMuc) : Set.of();
        if (!toanKho && loTrongPhamVi.isEmpty() && loDanhMuc.isEmpty()) return List.of();
        List<VanDe> kq = new ArrayList<>();

        // Phiếu nhặt đang mở: phân bổ đã chia kệ thì xét kệ (không có dòng kệ = lấy ở hàng chưa có kệ, ngoài phạm vi kệ),
        // chưa biết kệ thì chặn theo lô (bảo thủ, BA mục 9 bước 4)
        boolean coChiaKe = phanBoKeService != null && phanBoKeService.batDuoc();
        @SuppressWarnings("unchecked")
        List<Object[]> nhat = em.createNativeQuery("""
                SELECT ds.ma_pick_list, l.ma_lo, pb.so_luong, pb.lo_hang_id,
                       (SELECT GROUP_CONCAT(pv.vi_tri_kho_id) FROM phan_bo_lo_nhat_hang_vi_tri pv
                         WHERE pv.phan_bo_lo_nhat_hang_id = pb.id) AS ke_ids,
                """ + (coChiaKe ? "pb.chia_ke" : "0") + """
                 AS chia_ke
                  FROM phan_bo_lo_nhat_hang pb
                  JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                  JOIN danh_sach_nhat_hang ds ON ds.id = ct.danh_sach_nhat_hang_id
                  JOIN lo_hang l ON l.id = pb.lo_hang_id
                 WHERE ds.kho_xuat_id = :kho AND ds.trang_thai IN ('cho_nhat', 'dang_nhat')
                 ORDER BY ds.id, pb.id
                """).setParameter("kho", kho.getId()).getResultList();
        List<ThongDiep> vuongNhat = new ArrayList<>();
        for (Object[] r : nhat) {
            Integer lo = ((Number) r[3]).intValue();
            boolean vuong;
            if (toanKho) vuong = true;
            else if (theoDanhMuc) vuong = loDanhMuc.contains(lo);
            else if ((r[4] != null && !((String) r[4]).isBlank()) || daChia(r[5])) vuong = keTrongPhamVi((String) r[4], keIds);
            else vuong = loTrongPhamVi.contains(lo);
            if (vuong) vuongNhat.add(ThongDiep.of("khoVanHanh.mucPhieuLoSp", r[0], r[1], so((BigDecimal) r[2])));
        }
        if (!vuongNhat.isEmpty()) {
            kq.add(new VanDe(MaLoi.STK_PENDING_PICK, ThongDiep.of("khoVanHanh.vuongPhieuNhat", gonTheoKhoa(vuongNhat))));
        }

        // Phiếu xuất chưa xuất: hàng đã rời kệ nhưng sổ kệ còn tính. Phiếu tạo từ phiếu nhặt đã chia kệ thì xét các kệ còn
        // chờ xuất của lô (dòng kệ giảm dần khi xuất); còn lại chặn theo lô như trước
        @SuppressWarnings("unchecked")
        List<Object[]> xuat = em.createNativeQuery("""
                SELECT p.so_phieu_xuat, l.ma_lo, ct.so_luong_xuat, ct.lo_hang_id,
                       (SELECT ds.id FROM danh_sach_nhat_hang ds
                         WHERE ds.trang_thai = 'da_nhat' AND ds.kho_xuat_id = p.kho_id
                           AND (ds.phieu_xuat_kho_id = p.id
                                OR ds.id = (SELECT d.danh_sach_nhat_hang_id FROM don_ban_hang d WHERE d.id = p.don_ban_hang_id))
                         ORDER BY ds.id DESC LIMIT 1) AS phieu_nhat
                  FROM chi_tiet_phieu_xuat_kho ct
                  JOIN phieu_xuat_kho p ON p.id = ct.phieu_xuat_kho_id
                  JOIN lo_hang l ON l.id = ct.lo_hang_id
                 WHERE p.kho_id = :kho AND p.trang_thai IN (0, 1, 2, 6) AND ct.lo_hang_id IS NOT NULL
                 ORDER BY p.id, ct.id
                """).setParameter("kho", kho.getId()).getResultList();
        // [phiếu nhặt → [lô → kệ còn chờ xuất]] của các phân bổ đã chia kệ (lô có phân bổ chưa biết kệ thì không có ở đây)
        Map<Integer, Map<Integer, String>> keChoXuat = new HashMap<>();
        Set<Integer> phieuNhat = xuat.stream().filter(r -> r[4] != null).map(r -> ((Number) r[4]).intValue())
                .collect(Collectors.toSet());
        if (coChiaKe && !phieuNhat.isEmpty() && !toanKho && !theoDanhMuc) {
            @SuppressWarnings("unchecked")
            List<Object[]> ke = em.createNativeQuery("""
                    SELECT ct.danh_sach_nhat_hang_id, pb.lo_hang_id,
                           GROUP_CONCAT(pv.vi_tri_kho_id) AS ke_ids
                      FROM phan_bo_lo_nhat_hang pb
                      JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                      LEFT JOIN phan_bo_lo_nhat_hang_vi_tri pv ON pv.phan_bo_lo_nhat_hang_id = pb.id
                     WHERE ct.danh_sach_nhat_hang_id IN (:ids)
                     GROUP BY ct.danh_sach_nhat_hang_id, pb.lo_hang_id
                    HAVING MIN(pb.chia_ke) = 1
                    """).setParameter("ids", phieuNhat).getResultList();
            for (Object[] r : ke) {
                keChoXuat.computeIfAbsent(((Number) r[0]).intValue(), k -> new HashMap<>())
                        .put(((Number) r[1]).intValue(), r[2] == null ? "" : (String) r[2]);
            }
        }
        List<ThongDiep> vuongXuat = new ArrayList<>();
        for (Object[] r : xuat) {
            Integer lo = ((Number) r[3]).intValue();
            Map<Integer, String> cuaPhieu = r[4] == null ? null : keChoXuat.get(((Number) r[4]).intValue());
            boolean vuong;
            if (toanKho || theoDanhMuc) vuong = toanKho || loTrongPhamVi.contains(lo) || loDanhMuc.contains(lo);
            else if (cuaPhieu != null && cuaPhieu.containsKey(lo)) vuong = keTrongPhamVi(cuaPhieu.get(lo), keIds);
            else vuong = loTrongPhamVi.contains(lo);
            if (vuong) vuongXuat.add(ThongDiep.of("khoVanHanh.mucPhieuLoSp", r[0], r[1], so((BigDecimal) r[2])));
        }
        if (!vuongXuat.isEmpty()) {
            kq.add(new VanDe(MaLoi.STK_PENDING_PICK, ThongDiep.of("khoVanHanh.vuongPhieuXuat", gonTheoKhoa(vuongXuat))));
        }

        // Chỉ giao dịch còn có thể giữ hàng: chờ khách trả (PENDING) hoặc tiền về lỗi chờ quản lý xử lý (PAID_ERROR).
        // Giao dịch đã thanh toán / đã đóng mà cờ còn bật là dữ liệu cũ (trước khi có cờ) — không chặn kiểm kê vì nó
        @SuppressWarnings("unchecked")
        List<Object[]> qr = em.createNativeQuery("SELECT order_code, giu_cho_json FROM pos_payos_payment "
                        + "WHERE kho_id = :kho AND dang_giu_cho = 1 AND trang_thai IN (:conGiu)")
                .setParameter("kho", kho.getId())
                .setParameter("conGiu", List.of(PosPayosPayment.PENDING, PosPayosPayment.PAID_ERROR))
                .getResultList();
        if (!qr.isEmpty()) {
            Map<Integer, Integer> loCuaTon = new HashMap<>();
            Map<Long, Set<Integer>> tonTheoQr = new LinkedHashMap<>();
            for (Object[] r : qr) {
                Set<Integer> tonIds = new HashSet<>();
                try {
                    JsonNode arr = r[1] == null ? null : objectMapper.readTree((String) r[1]);
                    if (arr != null && arr.isArray()) {
                        for (JsonNode n : arr) if (n.hasNonNull("tonKhoTheoLoId")) tonIds.add(n.get("tonKhoTheoLoId").asInt());
                    }
                } catch (Exception e) {
                    log.warn("[KIEM-KE] Không đọc được phần giữ chỗ của QR payOS {}: {}", r[0], e.getMessage());
                }
                tonTheoQr.put(((Number) r[0]).longValue(), tonIds);
            }
            Set<Integer> tatCaTon = tonTheoQr.values().stream().flatMap(Set::stream).collect(Collectors.toSet());
            if (!tatCaTon.isEmpty()) {
                @SuppressWarnings("unchecked")
                List<Object[]> m = em.createNativeQuery("SELECT id, lo_hang_id FROM ton_kho_theo_lo WHERE id IN (:ids)")
                        .setParameter("ids", tatCaTon).getResultList();
                m.forEach(x -> loCuaTon.put(((Number) x[0]).intValue(), ((Number) x[1]).intValue()));
            }
            List<String> vuongQr = new ArrayList<>();
            tonTheoQr.forEach((ma, tonIds) -> {
                boolean vuong = toanKho || tonIds.stream().map(loCuaTon::get).filter(Objects::nonNull)
                        .anyMatch(lo -> loTrongPhamVi.contains(lo) || loDanhMuc.contains(lo));
                if (vuong) vuongQr.add("QR " + ma);
            });
            if (!vuongQr.isEmpty()) {
                kq.add(new VanDe(MaLoi.STK_PENDING_PICK, ThongDiep.of("khoVanHanh.vuongQrPos", gonTheoKhoa(vuongQr))));
            }
        }
        return kq;
    }

    /**
     * Hàng đã rời kệ nhưng sổ kệ vẫn tính (đếm lúc này ra thiếu giả, duyệt ghi giảm tồn sai):
     * <ol>
     *   <li>Lệnh hoàn kệ chờ cất (đơn / phiếu chuyển hủy sau khi đã nhặt). Lệnh chỉ ghi mã hàng (lô thường trống) nên xét
     *   theo mã: kiểm toàn kho, mã thuộc danh mục đang kiểm, hoặc mã có lô trên kệ trong phạm vi (chặn bảo thủ).</li>
     *   <li>Đơn bán đã nhặt xong mà phiếu xuất bị hủy tay, chưa tạo lại: hàng nằm ở khu đóng gói, tạo lại phiếu rồi xuất
     *   kho sẽ trừ tồn thêm lần nữa sau khi duyệt đã ghi giảm.</li>
     * </ol>
     */
    private List<VanDe> hangRoiKe(Kho kho, String loai, Set<Integer> loTrongPhamVi, Set<Integer> bienTheTrongPhamVi,
                                  Set<Integer> danhMuc) {
        boolean toanKho = IKiemKe.TOAN_BO.equals(loai);
        boolean theoDanhMuc = IKiemKe.THEO_DANH_MUC.equals(loai);
        if (!toanKho && !theoDanhMuc && loTrongPhamVi.isEmpty()) return List.of();
        List<VanDe> kq = new ArrayList<>();

        @SuppressWarnings("unchecked")
        List<Object[]> hoanKe = em.createNativeQuery("""
                SELECT l.ma_lo, cb.so_luong_hien_tai, cb.lo_hang_id, bt.ma_sku, bt.id, sp.danh_muc_id
                  FROM canh_bao cb
                  JOIN bien_the_san_pham bt ON bt.id = cb.bien_the_san_pham_id
                  JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                  LEFT JOIN lo_hang l ON l.id = cb.lo_hang_id
                 WHERE cb.kho_id = :kho AND cb.loai_canh_bao = 'HOAN_KE_CHO_CAT' AND cb.trang_thai = 0
                 ORDER BY cb.id
                """).setParameter("kho", kho.getId()).getResultList();
        List<ThongDiep> vuongHoanKe = new ArrayList<>();
        for (Object[] r : hoanKe) {
            Integer lo = r[2] == null ? null : ((Number) r[2]).intValue();
            Integer bienThe = ((Number) r[4]).intValue();
            Integer dm = r[5] == null ? null : ((Number) r[5]).intValue();
            boolean vuong = toanKho || (theoDanhMuc && dm != null && danhMuc.contains(dm))
                    || (lo != null ? loTrongPhamVi.contains(lo) : bienTheTrongPhamVi.contains(bienThe));
            if (!vuong) continue;
            vuongHoanKe.add(lo != null ? ThongDiep.of("khoVanHanh.mucLoSp", r[0], so((BigDecimal) r[1]))
                    : ThongDiep.of("khoVanHanh.mucMaSp", r[3], so((BigDecimal) r[1])));
        }
        if (!vuongHoanKe.isEmpty()) {
            kq.add(new VanDe(MaLoi.STK_PENDING_PICK, ThongDiep.of("khoVanHanh.vuongHoanKe", gonTheoKhoa(vuongHoanKe))));
        }

        // Đơn đã nhặt xong (phiếu nhặt da_nhat), không còn phiếu xuất mở, còn hàng chưa xuất: phần còn lại đang ở khu đóng gói
        @SuppressWarnings("unchecked")
        List<Object[]> donNhat = em.createNativeQuery("""
                SELECT d.so_don_hang, bt.ma_sku, bt.id, sp.danh_muc_id,
                       SUM(ct.so_luong_dat) - COALESCE((SELECT SUM(cx.so_luong_xuat) FROM chi_tiet_phieu_xuat_kho cx
                                                         JOIN phieu_xuat_kho px ON px.id = cx.phieu_xuat_kho_id
                                                        WHERE px.don_ban_hang_id = d.id AND px.trang_thai = 3
                                                          AND cx.bien_the_san_pham_id = bt.id AND cx.lo_hang_id IS NOT NULL), 0) AS con
                  FROM don_ban_hang d
                  JOIN danh_sach_nhat_hang ds ON ds.id = d.danh_sach_nhat_hang_id AND ds.trang_thai = 'da_nhat'
                  JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = d.id
                  JOIN bien_the_san_pham bt ON bt.id = ct.bien_the_san_pham_id
                  JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                 WHERE d.kho_xuat_id = :kho AND d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (1, 2)
                   AND NOT EXISTS (SELECT 1 FROM phieu_xuat_kho p WHERE p.don_ban_hang_id = d.id AND p.trang_thai IN (0, 1, 2, 6))
                 GROUP BY d.id, d.so_don_hang, bt.id, bt.ma_sku, sp.danh_muc_id
                HAVING con > 0
                 ORDER BY d.id, bt.id
                """).setParameter("kho", kho.getId()).getResultList();
        List<ThongDiep> vuongDon = new ArrayList<>();
        for (Object[] r : donNhat) {
            Integer bienThe = ((Number) r[2]).intValue();
            Integer dm = r[3] == null ? null : ((Number) r[3]).intValue();
            if (toanKho || (theoDanhMuc && dm != null && danhMuc.contains(dm)) || bienTheTrongPhamVi.contains(bienThe)) {
                vuongDon.add(ThongDiep.of("khoVanHanh.mucDonMaSp", r[0], r[1], so(new BigDecimal(r[4].toString()))));
            }
        }
        if (!vuongDon.isEmpty()) {
            kq.add(new VanDe(MaLoi.STK_PENDING_PICK, ThongDiep.of("khoVanHanh.vuongDonDaNhatChuaCoPhieuXuat", gonTheoKhoa(vuongDon))));
        }
        return kq;
    }

    /**
     * Cảnh báo không chặn: (1) phiếu chuyển đã duyệt / đang vận chuyển về kho — kiểm toàn kho hoặc theo danh mục thì kho
     * không nhận được hàng của phiếu tới khi đợt xong; (2) phiếu nhập chưa hoàn tất đã gán lô vào kệ trong phạm vi — nếu
     * hàng đã đặt lên kệ thì sẽ bị đếm thành hàng thừa, rồi hoàn tất nhập lại cộng thêm lần nữa.
     */
    private List<VanDe> canhBao(Kho kho, String loai, Set<Integer> keIds, Set<Integer> danhMuc) {
        boolean toanKho = IKiemKe.TOAN_BO.equals(loai);
        boolean theoDanhMuc = IKiemKe.THEO_DANH_MUC.equals(loai);
        List<VanDe> kq = new ArrayList<>();
        if (toanKho || theoDanhMuc) {
            @SuppressWarnings("unchecked")
            List<Object[]> chuyen = em.createNativeQuery("""
                    SELECT DISTINCT p.so_phieu_chuyen, sp.danh_muc_id, p.id
                      FROM phieu_chuyen_kho p
                      JOIN chi_tiet_phieu_chuyen_kho ct ON ct.phieu_chuyen_kho_id = p.id
                      JOIN bien_the_san_pham bt ON bt.id = ct.bien_the_san_pham_id
                      JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                     WHERE p.kho_nhap_id = :kho AND p.trang_thai IN ('DA_DUYET', 'DANG_VAN_CHUYEN')
                     ORDER BY p.id
                    """).setParameter("kho", kho.getId()).getResultList();
            Set<String> phieu = new LinkedHashSet<>();
            for (Object[] r : chuyen) {
                Integer dm = r[1] == null ? null : ((Number) r[1]).intValue();
                if (toanKho || (dm != null && danhMuc.contains(dm))) phieu.add((String) r[0]);
            }
            if (!phieu.isEmpty()) {
                kq.add(new VanDe(MaLoi.STK_SCOPE_WARNING,
                        ThongDiep.of("khoVanHanh.canhBaoPhieuChuyenDangVe", gonTheoKhoa(new ArrayList<>(phieu)))));
            }
        }
        if (toanKho || theoDanhMuc || !keIds.isEmpty()) {
            @SuppressWarnings("unchecked")
            List<Object[]> nhap = em.createNativeQuery("""
                    SELECT p.so_phieu_nhap, l.vi_tri_kho_id, sp.danh_muc_id, p.id
                      FROM phieu_nhap_kho p
                      JOIN chi_tiet_phieu_nhap_kho ct ON ct.phieu_nhap_kho_id = p.id
                      JOIN lo_hang l ON l.id = ct.lo_hang_id
                      JOIN bien_the_san_pham bt ON bt.id = ct.bien_the_san_pham_id
                      JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                     WHERE p.kho_id = :kho AND p.trang_thai IN (0, 1, 2) AND l.vi_tri_kho_id IS NOT NULL
                     ORDER BY p.id
                    """).setParameter("kho", kho.getId()).getResultList();
            Set<String> phieu = new LinkedHashSet<>();
            for (Object[] r : nhap) {
                Integer ke = ((Number) r[1]).intValue();
                Integer dm = r[2] == null ? null : ((Number) r[2]).intValue();
                boolean vuong = toanKho ? (keIds.isEmpty() || keIds.contains(ke))
                        : theoDanhMuc ? dm != null && danhMuc.contains(dm) : keIds.contains(ke);
                if (vuong) phieu.add((String) r[0]);
            }
            if (!phieu.isEmpty()) {
                kq.add(new VanDe(MaLoi.STK_SCOPE_WARNING,
                        ThongDiep.of("khoVanHanh.canhBaoPhieuNhapDaGanKe", gonTheoKhoa(new ArrayList<>(phieu)))));
            }
        }
        return kq;
    }

    /** Tồn chưa có kệ (Đ4) và sổ kệ lệch tồn lô. Chỉ xét kiểm toàn kho và theo danh mục. */
    private List<VanDe> tonChuaCoKe(Kho kho, String loai, Set<Integer> danhMuc, Set<Integer> loTrongPhamVi) {
        List<VanDe> kq = new ArrayList<>();
        boolean toanKho = IKiemKe.TOAN_BO.equals(loai);
        boolean theoDanhMuc = IKiemKe.THEO_DANH_MUC.equals(loai);
        if (toanKho || theoDanhMuc) {
            Set<Integer> loXet = theoDanhMuc ? loThuocDanhMuc(kho.getId(), danhMuc) : null;
            if (theoDanhMuc && loXet.isEmpty()) return kq;
            @SuppressWarnings("unchecked")
            List<Object[]> rows = em.createNativeQuery("""
                    SELECT k.lo_hang_id, l.ma_lo, FLOOR(k.so_luong_ton) AS ton,
                           COALESCE((SELECT SUM(GREATEST(t.so_luong, 0)) FROM ton_kho_vi_tri t JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
                                      WHERE t.lo_hang_id = k.lo_hang_id AND v.kho_id = k.kho_id), 0) AS tren_ke
                      FROM ton_kho_theo_lo k JOIN lo_hang l ON l.id = k.lo_hang_id
                     WHERE k.kho_id = :kho AND k.so_luong_ton >= 1
                     ORDER BY l.ma_lo
                    """).setParameter("kho", kho.getId()).getResultList();
            List<ThongDiep> chua = new ArrayList<>();
            for (Object[] r : rows) {
                Integer lo = ((Number) r[0]).intValue();
                if (loXet != null && !loXet.contains(lo)) continue;
                long ton = ((Number) r[2]).longValue();
                long trenKe = ((Number) r[3]).longValue();
                if (ton > trenKe) chua.add(ThongDiep.of("khoVanHanh.mucMaSp", r[1], ton - trenKe));
            }
            if (!chua.isEmpty()) {
                kq.add(new VanDe(MaLoi.STK_INVALID_SCOPE, ThongDiep.of("khoVanHanh.conHangChuaCoKe", gonTheoKhoa(chua))));
            }
        }
        if (!loTrongPhamVi.isEmpty()) {
            @SuppressWarnings("unchecked")
            List<Object> lech = em.createNativeQuery("""
                    SELECT l.ma_lo FROM lo_hang l
                      LEFT JOIN ton_kho_theo_lo k ON k.lo_hang_id = l.id AND k.kho_id = :kho
                     WHERE l.id IN (:lo)
                       AND COALESCE(FLOOR(k.so_luong_ton), 0) < (SELECT COALESCE(SUM(GREATEST(t.so_luong, 0)), 0) FROM ton_kho_vi_tri t
                             JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id WHERE t.lo_hang_id = l.id AND v.kho_id = :kho)
                    """).setParameter("kho", kho.getId()).setParameter("lo", loTrongPhamVi).getResultList();
            if (!lech.isEmpty()) {
                List<String> ma = lech.stream().map(String::valueOf).toList();
                kq.add(new VanDe(MaLoi.STK_INVALID_SCOPE, ThongDiep.of("khoVanHanh.soTrenKeLonHonTonLo", gonTheoKhoa(ma))));
            }
        }
        return kq;
    }

    /** Lô có tồn ở kho thuộc tập danh mục. */
    Set<Integer> loThuocDanhMuc(Integer khoId, Set<Integer> danhMuc) {
        if (danhMuc == null || danhMuc.isEmpty()) return Set.of();
        @SuppressWarnings("unchecked")
        List<Object> rows = em.createNativeQuery("""
                SELECT k.lo_hang_id FROM ton_kho_theo_lo k
                  JOIN lo_hang l ON l.id = k.lo_hang_id
                  JOIN bien_the_san_pham bt ON bt.id = l.bien_the_san_pham_id
                  JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                 WHERE k.kho_id = :kho AND sp.danh_muc_id IN (:dm) AND k.so_luong_ton > 0
                """).setParameter("kho", khoId).setParameter("dm", danhMuc).getResultList();
        return rows.stream().map(o -> ((Number) o).intValue()).collect(Collectors.toSet());
    }

    static String gon(List<String> ds) {
        if (ds.size() <= TOI_DA_CHI_TIET) return String.join(", ", ds);
        return String.join(", ", ds.subList(0, TOI_DA_CHI_TIET)) + " và " + (ds.size() - TOI_DA_CHI_TIET) + " mục khác";
    }

    /**
     * Như {@link #gon} cho câu trả về giao diện: mục là chuỗi (mã kệ, mã lô) hoặc {@link ThongDiep}; kết quả dịch được
     * theo ngôn ngữ request, câu tiếng Việt giống hệt {@link #gon}.
     */
    static Object gonTheoKhoa(List<?> ds) {
        if (ds.size() <= TOI_DA_CHI_TIET) return ghep(ds);
        return ThongDiep.of("khoVanHanh.vaMucKhac", ghep(ds.subList(0, TOI_DA_CHI_TIET)), ds.size() - TOI_DA_CHI_TIET);
    }

    /** Nối các mục bằng ", " như String.join, mục có thể là {@link ThongDiep}. Danh sách rỗng: chuỗi rỗng. */
    static Object ghep(List<?> ds) {
        if (ds.isEmpty()) return "";
        Object kq = ds.get(0);
        for (int i = 1; i < ds.size(); i++) kq = ThongDiep.of("khoVanHanh.ghepPhay", kq, ds.get(i));
        return kq;
    }

    static String so(BigDecimal v) {
        return v == null ? "0" : v.stripTrailingZeros().toPlainString();
    }

    /** Danh sách id kệ dạng "3,7" (GROUP_CONCAT) có kệ nào trong phạm vi không. Rỗng: không. */
    static boolean keTrongPhamVi(String keIdsCsv, Set<Integer> keIds) {
        if (keIdsCsv == null || keIdsCsv.isBlank()) return false;
        return Arrays.stream(keIdsCsv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).map(Integer::valueOf)
                .anyMatch(keIds::contains);
    }

    /** Cột TINYINT(1) đọc qua native query ra Boolean (hoặc số khi là hằng). */
    static boolean daChia(Object v) {
        if (v instanceof Boolean b) return b;
        return v instanceof Number n && n.intValue() == 1;
    }
}
