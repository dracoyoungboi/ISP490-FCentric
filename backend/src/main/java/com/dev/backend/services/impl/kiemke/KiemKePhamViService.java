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

    /** Một vướng mắc: mã lỗi STK_* và câu cho người dùng. */
    public record VanDe(String ma, String noiDung) {
    }

    /** Kết quả xác định phạm vi. {@code dong}: dòng sổ kệ sẽ chốt (sắp theo kệ rồi lô). */
    public record PhamVi(Kho kho, String loai, List<ViTriKho> ke, Set<Integer> danhMuc, List<TonKhoViTri> dong,
                         List<VanDe> vanDe) {
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

    static LoiCoMaException phamViSai(String cau) {
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.STK_INVALID_SCOPE, cau);
    }

    /** Kho vật lý đang hoạt động (BR-STK-01, BR-STK-03: kho ảo không kiểm kê). */
    public Kho khoHopLe(Integer khoId) {
        if (khoId == null) throw phamViSai("Chọn kho cần kiểm kê");
        Kho kho = khoRepository.findById(khoId).orElseThrow(() -> phamViSai("Không tìm thấy kho đã chọn"));
        if (IKiemKe.MA_KHO_AO.equals(kho.getMaKho())) {
            throw phamViSai("Kho Trung Chuyển là kho ảo chứa hàng đang chuyển, không kiểm kê được");
        }
        if (!Integer.valueOf(1).equals(kho.getTrangThai())) {
            throw phamViSai("Kho " + kho.getTenKho() + " đang ngừng hoạt động");
        }
        return kho;
    }

    /** Loại phạm vi và các lựa chọn thuộc đúng kho. */
    public void kiemTraLuaChon(Kho kho, LuaChon lc) {
        String loai = lc.loai();
        if (!List.of(IKiemKe.TOAN_BO, IKiemKe.THEO_KHU_VUC, IKiemKe.THEO_KE, IKiemKe.THEO_DANH_MUC).contains(loai)) {
            throw phamViSai("Chọn phạm vi kiểm kê: toàn bộ kho, theo khu vực, theo kệ hoặc theo danh mục");
        }
        if (IKiemKe.THEO_KHU_VUC.equals(loai)) {
            if (lc.khuVucIds().isEmpty()) throw phamViSai("Chọn ít nhất một khu vực");
            List<KhuVucKho> kv = khuVucKhoRepository.findAllById(lc.khuVucIds());
            if (kv.size() != lc.khuVucIds().size() || kv.stream().anyMatch(k -> k.getKho() == null || !kho.getId().equals(k.getKho().getId()))) {
                throw phamViSai("Có khu vực không thuộc kho " + kho.getTenKho());
            }
        }
        if (IKiemKe.THEO_KE.equals(loai)) {
            if (lc.viTriIds().isEmpty()) throw phamViSai("Chọn ít nhất một kệ");
            @SuppressWarnings("unchecked")
            List<Object> khoCuaKe = em.createNativeQuery("SELECT kho_id FROM vi_tri_kho WHERE id IN (:ids)")
                    .setParameter("ids", lc.viTriIds()).getResultList();
            if (khoCuaKe.size() != lc.viTriIds().size() || khoCuaKe.stream().anyMatch(k -> ((Number) k).intValue() != kho.getId())) {
                throw phamViSai("Có kệ không thuộc kho " + kho.getTenKho());
            }
        }
        if (IKiemKe.THEO_DANH_MUC.equals(loai)) {
            if (lc.danhMucId() == null || !danhMucQuanAoRepository.existsById(lc.danhMucId())) {
                throw phamViSai("Chọn danh mục cần kiểm kê");
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
                throw phamViSai("Cây danh mục có vòng lặp ở danh mục id " + x[0] + ". Sửa cây danh mục rồi thử lại");
            }
            if (x[1] > IKiemKe.DO_SAU_DANH_MUC_TOI_DA) {
                throw phamViSai("Cây danh mục sâu quá " + IKiemKe.DO_SAU_DANH_MUC_TOI_DA + " cấp, không chốt được phạm vi");
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
                    ? "Kho chưa có kệ nào để kiểm kê. Khai báo vị trí kệ ở màn Vị trí kho trước"
                    : "Phạm vi đã chọn không có kệ nào"));
        }
        vanDe.addAll(keKhongKiemDuoc(ke));
        vanDe.addAll(giaoThoa(kho, loai, ke, danhMuc, dong, boQuaDotId));
        Set<Integer> loTrongPhamVi = dong.stream().map(t -> t.getLoHang().getId()).collect(Collectors.toSet());
        Set<Integer> keTrongPhamVi = ke.stream().map(ViTriKho::getId).collect(Collectors.toSet());
        vanDe.addAll(viecDo(kho, loai, keTrongPhamVi, loTrongPhamVi, danhMuc));
        vanDe.addAll(tonChuaCoKe(kho, loai, danhMuc, loTrongPhamVi));
        return new PhamVi(kho, loai, ke, danhMuc, dong, vanDe);
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
        return List.of(new VanDe(MaLoi.STK_INVALID_SCOPE, "Kệ đang bảo trì, không kiểm đếm được: " + gon(baoTri)
                + ". Đưa kệ về hoạt động hoặc bỏ khỏi phạm vi"));
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
        Map<Integer, Set<String>> theoDot = new TreeMap<>();
        if (IKiemKe.TOAN_BO.equals(loai)) {
            maDot.keySet().forEach(d -> theoDot.computeIfAbsent(d, k -> new TreeSet<>()).add("toàn kho"));
        } else if (tt.dotToanKho != null && maDot.containsKey(tt.dotToanKho)) {
            theoDot.computeIfAbsent(tt.dotToanKho, k -> new TreeSet<>()).add("đợt đó kiểm toàn kho");
        } else if (IKiemKe.laKhoaToanKe(loai)) {
            for (ViTriKho v : ke) {
                Integer d = tt.keToanKe.get(v.getId());
                if (d != null && maDot.containsKey(d)) theoDot.computeIfAbsent(d, k -> new TreeSet<>()).add("kệ " + v.getMaViTri());
                if (tt.keKhoaMin.contains(v.getId())) {
                    tt.capKhoaMin.forEach((cap, dot) -> {
                        if ((int) (cap >> 32) == v.getId() && maDot.containsKey(dot)) {
                            theoDot.computeIfAbsent(dot, k -> new TreeSet<>()).add("kệ " + v.getMaViTri() + " (khóa theo danh mục)");
                        }
                    });
                }
            }
        } else {
            tt.danhMuc.forEach((dm, dot) -> {
                if (danhMuc.contains(dm) && maDot.containsKey(dot)) {
                    theoDot.computeIfAbsent(dot, k -> new TreeSet<>()).add("danh mục giao nhau");
                }
            });
            for (TonKhoViTri t : dong) {
                Integer d = tt.keToanKe.get(t.getViTriKho().getId());
                if (d != null && maDot.containsKey(d)) theoDot.computeIfAbsent(d, k -> new TreeSet<>()).add("kệ " + t.getViTriKho().getMaViTri());
            }
        }
        List<VanDe> kq = new ArrayList<>();
        theoDot.forEach((dot, chiTiet) -> kq.add(new VanDe(MaLoi.STK_SCOPE_CONFLICT,
                "Giao thoa với đợt " + maDot.get(dot) + " đang giữ khóa: " + gon(new ArrayList<>(chiTiet)))));
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
        List<String> vuongNhat = new ArrayList<>();
        for (Object[] r : nhat) {
            Integer lo = ((Number) r[3]).intValue();
            boolean vuong;
            if (toanKho) vuong = true;
            else if (theoDanhMuc) vuong = loDanhMuc.contains(lo);
            else if ((r[4] != null && !((String) r[4]).isBlank()) || daChia(r[5])) vuong = keTrongPhamVi((String) r[4], keIds);
            else vuong = loTrongPhamVi.contains(lo);
            if (vuong) vuongNhat.add(r[0] + " (lô " + r[1] + ", " + so((BigDecimal) r[2]) + " sp)");
        }
        if (!vuongNhat.isEmpty()) {
            kq.add(new VanDe(MaLoi.STK_PENDING_PICK, "Phiếu nhặt đang mở có hàng trong phạm vi: " + gon(vuongNhat)
                    + ". Hoàn tất hoặc hủy phiếu nhặt trước"));
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
        List<String> vuongXuat = new ArrayList<>();
        for (Object[] r : xuat) {
            Integer lo = ((Number) r[3]).intValue();
            Map<Integer, String> cuaPhieu = r[4] == null ? null : keChoXuat.get(((Number) r[4]).intValue());
            boolean vuong;
            if (toanKho || theoDanhMuc) vuong = toanKho || loTrongPhamVi.contains(lo) || loDanhMuc.contains(lo);
            else if (cuaPhieu != null && cuaPhieu.containsKey(lo)) vuong = keTrongPhamVi(cuaPhieu.get(lo), keIds);
            else vuong = loTrongPhamVi.contains(lo);
            if (vuong) vuongXuat.add(r[0] + " (lô " + r[1] + ", " + so((BigDecimal) r[2]) + " sp)");
        }
        if (!vuongXuat.isEmpty()) {
            kq.add(new VanDe(MaLoi.STK_PENDING_PICK, "Phiếu xuất đã nhặt hàng nhưng chưa xuất kho: " + gon(vuongXuat)
                    + ". Xuất kho hoặc hủy phiếu trước"));
        }

        // Hàng chờ hoàn kệ (đơn hủy sau khi đã nhặt): hàng đã rời kệ nhưng sổ kệ vẫn tính, đếm lúc này sẽ ra thiếu giả
        @SuppressWarnings("unchecked")
        List<Object[]> hoanKe = em.createNativeQuery("""
                SELECT l.ma_lo, cb.so_luong_hien_tai, cb.lo_hang_id FROM canh_bao cb JOIN lo_hang l ON l.id = cb.lo_hang_id
                 WHERE cb.kho_id = :kho AND cb.loai_canh_bao = 'HOAN_KE_CHO_CAT' AND cb.trang_thai = 0
                """).setParameter("kho", kho.getId()).getResultList();
        List<String> vuongHoanKe = new ArrayList<>();
        for (Object[] r : hoanKe) {
            Integer lo = ((Number) r[2]).intValue();
            if (toanKho || loTrongPhamVi.contains(lo) || loDanhMuc.contains(lo)) {
                vuongHoanKe.add("lô " + r[0] + " (" + so((BigDecimal) r[1]) + " sp)");
            }
        }
        if (!vuongHoanKe.isEmpty()) {
            kq.add(new VanDe(MaLoi.STK_PENDING_PICK, "Còn hàng chờ hoàn kệ trong phạm vi: " + gon(vuongHoanKe)
                    + ". Cất hàng về kệ và xác nhận hoàn kệ trước"));
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
                kq.add(new VanDe(MaLoi.STK_PENDING_PICK, "Đơn bán tại quầy đang chờ khách chuyển khoản giữ hàng trong phạm vi: "
                        + gon(vuongQr) + ". Chờ khách trả xong hoặc hủy QR ở màn Bán hàng trước"));
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
            List<String> chua = new ArrayList<>();
            for (Object[] r : rows) {
                Integer lo = ((Number) r[0]).intValue();
                if (loXet != null && !loXet.contains(lo)) continue;
                long ton = ((Number) r[2]).longValue();
                long trenKe = ((Number) r[3]).longValue();
                if (ton > trenKe) chua.add(r[1] + " (" + (ton - trenKe) + " sp)");
            }
            if (!chua.isEmpty()) {
                kq.add(new VanDe(MaLoi.STK_INVALID_SCOPE, "Còn hàng chưa có kệ trong phạm vi: " + gon(chua)
                        + ". Xếp các lô này lên kệ (Kho hàng › Hàng chưa có kệ) rồi bắt đầu lại"));
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
                kq.add(new VanDe(MaLoi.STK_INVALID_SCOPE, "Số trên kệ của lô lớn hơn tồn lô: " + gon(ma)
                        + ". Báo quản trị viên chạy đối soát sổ kệ trước khi kiểm kê"));
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
