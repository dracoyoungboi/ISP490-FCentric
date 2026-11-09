package com.dev.backend.services.impl.kiemke;

import com.dev.backend.entities.LoHang;
import com.dev.backend.entities.PhanBoLoNhatHang;
import com.dev.backend.entities.PhanBoLoNhatHangViTri;
import com.dev.backend.entities.PhieuXuatKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.repository.PhanBoLoNhatHangViTriRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import com.dev.backend.i18n.ThongDiep;

/**
 * Phân bổ nhặt theo kệ (đặc tả kiểm kê khoanh vùng mục 8.2, đề xuất "Nhặt hàng theo kệ" 04/11/2026).
 *
 * <p>Mỗi phần phân bổ lô của phiếu nhặt được chia ra kệ theo thứ tự đã chốt Đ3: kệ của lô → kệ khác cùng kho (theo mã) →
 * hàng chưa có kệ. Bỏ kệ đang kiểm kê và phần của kệ đã giữ cho phiếu nhặt khác. Phần trên kệ ghi vào
 * {@code phan_bo_lo_nhat_hang_vi_tri}; phần còn lại lấy ở hàng chưa có kệ, không ghi dòng (đúng ghi chú của BA).
 *
 * <p>Sau khi phiếu nhặt hoàn tất, các dòng kệ còn lại nghĩa là "hàng đã nhặt ở kệ này, chờ xuất": hàng đã rời kệ nhưng sổ
 * kệ vẫn tính tới lúc xuất. Xuất kho trừ sổ kệ theo đúng các dòng đó rồi giảm dần ({@link #layKeDaNhat}). Dòng của phiếu đã
 * nhặt chỉ còn được tính khi phiếu còn phiếu xuất chưa xuất, nên đơn hủy sau khi nhặt không làm kệ bị giữ mãi.
 *
 * <p>Phân bổ đã chia kệ được đánh dấu {@code phan_bo_lo_nhat_hang.chia_ke = 1} (migration-2026-11-04-nhat-hang-theo-ke.sql):
 * với phân bổ đó, không có dòng kệ nghĩa là lấy ở hàng chưa có kệ — kể cả khi các dòng kệ khác của phiếu đã được xuất hết.
 * Phân bổ {@code chia_ke = 0} (ghi trước bản này, hoặc do backend cũ ghi) là chưa biết kệ: xuất kho trừ theo thứ tự Đ3 như
 * trước, Bắt đầu kiểm kê chặn theo lô (Đ4, Đ7).
 *
 * <p>Số lượng sổ kệ là số nguyên (sản phẩm), làm tròn như sổ kệ. CSDL chưa chạy migration kiểm kê ({@link KiemKeSanSang}) hoặc
 * chưa có cột {@code chia_ke}: mọi hàm không làm gì, phiếu nhặt chạy như trước.
 */
@Slf4j
@Service
public class PhanBoKeService {

    /** Phiếu nhặt còn giữ dòng kệ: đang mở, hoặc đã nhặt mà còn phiếu xuất chưa xuất (nháp, chờ duyệt, đã duyệt, chờ xuất). */
    static final String PHIEU_CON_GIU = """
            (ds.trang_thai IN ('cho_nhat', 'dang_nhat')
             OR (ds.trang_thai = 'da_nhat' AND EXISTS (SELECT 1 FROM phieu_xuat_kho p
                  WHERE p.trang_thai IN (0, 1, 2, 6)
                    AND (p.id = ds.phieu_xuat_kho_id
                         OR p.don_ban_hang_id IN (SELECT d.id FROM don_ban_hang d WHERE d.danh_sach_nhat_hang_id = ds.id)))))
            """;

    @PersistenceContext
    private EntityManager em;

    private final PhanBoLoNhatHangViTriRepository repo;
    private final KhoaKiemKeGuard guard;
    private final KiemKeSanSang sanSang;
    private final JdbcTemplate jdbc;

    private static final long KIEM_LAI_SAU_MS = 30_000;
    private volatile boolean coCot;
    private volatile long lanKiemCuoi;

    public PhanBoKeService(PhanBoLoNhatHangViTriRepository repo, KhoaKiemKeGuard guard, KiemKeSanSang sanSang,
                           JdbcTemplate jdbc) {
        this.repo = repo;
        this.guard = guard;
        this.sanSang = sanSang;
        this.jdbc = jdbc;
    }

    /** Một phần lấy ở kệ: {@code viTriId} null = hàng chưa có kệ. {@code dangKiemKe}: kệ đang bị giữ cho kiểm kê. */
    public record KeLay(Integer viTriId, String maViTri, BigDecimal soLuong, boolean dangKiemKe) {
    }

    /** Lựa chọn kệ của người dùng cho một lô (hộp Chọn lô): {@code viTriId} null = hàng chưa có kệ. */
    public record KeChon(Integer viTriId, BigDecimal soLuong) {
    }

    /** CSDL đã có bảng kiểm kê và cột đánh dấu {@code chia_ke}. Đã thấy thì nhớ luôn; chưa thì kiểm lại tối đa mỗi 30 giây. */
    public boolean batDuoc() {
        if (!sanSang.sanSang()) return false;
        if (coCot) return true;
        long bayGio = System.currentTimeMillis();
        if (lanKiemCuoi != 0 && bayGio - lanKiemCuoi < KIEM_LAI_SAU_MS) return false;
        lanKiemCuoi = bayGio;
        try {
            Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() "
                    + "AND table_name = 'phan_bo_lo_nhat_hang' AND column_name = 'chia_ke'", Integer.class);
            coCot = n != null && n == 1;
            if (!coCot) {
                log.warn("[NHAT-KE] CSDL chưa chạy migration-2026-11-04-nhat-hang-theo-ke.sql: phiếu nhặt chưa chia theo kệ");
            }
        } catch (RuntimeException e) {
            log.warn("[NHAT-KE] Không kiểm được cột chia_ke: {}", e.getMessage());
        }
        return coCot;
    }

    /** Phân bổ vừa được chia kệ bằng bản này: không có dòng kệ = lấy ở hàng chưa có kệ. */
    private void danhDauDaChia(Integer phanBoId) {
        em.createNativeQuery("UPDATE phan_bo_lo_nhat_hang SET chia_ke = 1 WHERE id = :id").setParameter("id", phanBoId)
                .executeUpdate();
    }

    private boolean daChia(Integer phanBoId) {
        Object v = em.createNativeQuery("SELECT chia_ke FROM phan_bo_lo_nhat_hang WHERE id = :id")
                .setParameter("id", phanBoId).getResultStream().findFirst().orElse(null);
        return KiemKePhamViService.daChia(v);
    }

    /** Trong {@code phanBoIds}, các phân bổ đã chia kệ ({@code chia_ke = 1}). */
    public Set<Integer> daChia(Collection<Integer> phanBoIds) {
        if (!batDuoc() || phanBoIds == null || phanBoIds.isEmpty()) return Collections.emptySet();
        @SuppressWarnings("unchecked")
        List<Object> r = em.createNativeQuery("SELECT id FROM phan_bo_lo_nhat_hang WHERE chia_ke = 1 AND id IN (:ids)")
                .setParameter("ids", phanBoIds).getResultList();
        Set<Integer> kq = new HashSet<>();
        r.forEach(x -> kq.add(((Number) x).intValue()));
        return kq;
    }

    /** Cùng cách làm tròn với sổ kệ ({@link SoTonKeService#tru}). */
    private static int soNguyen(BigDecimal v) {
        return SoTonKeService.soNguyen(v);
    }

    // ───────────────────────────── Kệ còn lấy được ─────────────────────────────

    /** Sổ kệ của lô ở kho: [viTriId → (mã, số)], chỉ dòng dương. */
    private LinkedHashMap<Integer, Object[]> soKe(Integer khoId, Integer loId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT t.vi_tri_kho_id, v.ma_vi_tri, t.so_luong FROM ton_kho_vi_tri t
                  JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
                 WHERE v.kho_id = :kho AND t.lo_hang_id = :lo AND t.so_luong > 0
                 ORDER BY v.ma_vi_tri, v.id
                """).setParameter("kho", khoId).setParameter("lo", loId).getResultList();
        LinkedHashMap<Integer, Object[]> kq = new LinkedHashMap<>();
        for (Object[] r : rows) kq.put(((Number) r[0]).intValue(), new Object[]{r[1], ((Number) r[2]).intValue()});
        return kq;
    }

    /** Phần trên từng kệ của lô đang được phiếu nhặt khác giữ (đang mở, hoặc đã nhặt chờ xuất). */
    private Map<Integer, Integer> giuTrenKe(Integer khoId, Integer loId, Integer boQuaPhieuNhatId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT pv.vi_tri_kho_id, SUM(pv.so_luong)
                  FROM phan_bo_lo_nhat_hang_vi_tri pv
                  JOIN phan_bo_lo_nhat_hang pb ON pb.id = pv.phan_bo_lo_nhat_hang_id
                  JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                  JOIN danh_sach_nhat_hang ds ON ds.id = ct.danh_sach_nhat_hang_id
                 WHERE ds.kho_xuat_id = :kho AND pb.lo_hang_id = :lo AND ds.id <> :bo AND
                """ + PHIEU_CON_GIU + " GROUP BY pv.vi_tri_kho_id")
                .setParameter("kho", khoId).setParameter("lo", loId)
                .setParameter("bo", boQuaPhieuNhatId == null ? -1 : boQuaPhieuNhatId).getResultList();
        Map<Integer, Integer> kq = new HashMap<>();
        for (Object[] r : rows) kq.put(((Number) r[0]).intValue(), soNguyen((BigDecimal) r[1]));
        return kq;
    }

    /** Phần trên từng kệ của lô mà mọi phiếu nhặt đang giữ (sổ kệ trừ phần này trước khi đụng tới). */
    public Map<Integer, Integer> giuTrenKeCuaLo(Integer khoId, Integer loId) {
        if (!batDuoc() || khoId == null || loId == null) return Map.of();
        return giuTrenKe(khoId, loId, null);
    }

    /**
     * Các lô của kho có thể đang bị phiếu nhặt giữ (tập bao của những lô {@link #giuChuaCoKe} có thể &gt; 0): lô có phân bổ
     * trong phiếu nhặt đang mở, hoặc nằm trên phiếu xuất chưa hoàn tất của kho. Dùng để chỉ gọi {@link #giuChuaCoKe} cho
     * các lô này khi duyệt cả danh sách (màn Hàng chưa có kệ), thay vì mỗi lô vài câu truy vấn.
     */
    public Set<Integer> loCoTheDangGiu(Integer khoId) {
        if (!batDuoc() || khoId == null) return Set.of();
        @SuppressWarnings("unchecked")
        List<Object> rows = em.createNativeQuery("""
                SELECT pb.lo_hang_id
                  FROM phan_bo_lo_nhat_hang pb
                  JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                  JOIN danh_sach_nhat_hang ds ON ds.id = ct.danh_sach_nhat_hang_id
                 WHERE ds.kho_xuat_id = :kho AND ds.trang_thai IN ('cho_nhat', 'dang_nhat')
                UNION
                SELECT c.lo_hang_id
                  FROM chi_tiet_phieu_xuat_kho c JOIN phieu_xuat_kho p ON p.id = c.phieu_xuat_kho_id
                 WHERE p.kho_id = :kho AND p.trang_thai IN (0, 1, 2, 6) AND c.lo_hang_id IS NOT NULL
                """).setParameter("kho", khoId).getResultList();
        Set<Integer> kq = new HashSet<>();
        for (Object r : rows) {
            if (r != null) kq.add(((Number) r).intValue());
        }
        return kq;
    }

    /**
     * Phần hàng chưa có kệ của lô ở kho mà phiếu nhặt khác (phân bổ đã chia kệ) đang giữ: phiếu đang mở = phân bổ − phần trên
     * kệ; phiếu đã nhặt = số chờ xuất của lô − dòng kệ còn lại (xuất kho trừ dòng kệ trước). Phân bổ chưa biết kệ không
     * tính (chỉ giữ theo lô). {@code boQuaPhieuNhatId}: phiếu đang phân bổ.
     */
    public int giuChuaCoKe(Integer khoId, Integer loId, Integer boQuaPhieuNhatId) {
        if (!batDuoc() || khoId == null || loId == null) return 0;
        int bo = boQuaPhieuNhatId == null ? -1 : boQuaPhieuNhatId;
        Number mo = (Number) em.createNativeQuery("""
                SELECT COALESCE(SUM(GREATEST(0, pb.so_luong - COALESCE((SELECT SUM(pv.so_luong)
                         FROM phan_bo_lo_nhat_hang_vi_tri pv WHERE pv.phan_bo_lo_nhat_hang_id = pb.id), 0))), 0)
                  FROM phan_bo_lo_nhat_hang pb
                  JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                  JOIN danh_sach_nhat_hang ds ON ds.id = ct.danh_sach_nhat_hang_id
                 WHERE ds.kho_xuat_id = :kho AND pb.lo_hang_id = :lo AND ds.id <> :bo AND pb.chia_ke = 1
                   AND ds.trang_thai IN ('cho_nhat', 'dang_nhat')
                """).setParameter("kho", khoId).setParameter("lo", loId).setParameter("bo", bo).getSingleResult();
        int kq = soNguyen(new BigDecimal(String.valueOf(mo)));
        @SuppressWarnings("unchecked")
        List<Object[]> choXuat = em.createNativeQuery("""
                SELECT x.ds_id, SUM(x.so) FROM (
                  SELECT (SELECT ds.id FROM danh_sach_nhat_hang ds
                           WHERE ds.trang_thai = 'da_nhat' AND ds.kho_xuat_id = p.kho_id
                             AND (ds.phieu_xuat_kho_id = p.id
                                  OR ds.id = (SELECT d.danh_sach_nhat_hang_id FROM don_ban_hang d WHERE d.id = p.don_ban_hang_id))
                           ORDER BY ds.id DESC LIMIT 1) AS ds_id, c.so_luong_xuat AS so
                    FROM chi_tiet_phieu_xuat_kho c JOIN phieu_xuat_kho p ON p.id = c.phieu_xuat_kho_id
                   WHERE p.kho_id = :kho AND p.trang_thai IN (0, 1, 2, 6) AND c.lo_hang_id = :lo) x
                 WHERE x.ds_id IS NOT NULL AND x.ds_id <> :bo
                 GROUP BY x.ds_id
                """).setParameter("kho", khoId).setParameter("lo", loId).setParameter("bo", bo).getResultList();
        for (Object[] r : choXuat) {
            Object[] pb = (Object[]) em.createNativeQuery("""
                    SELECT COUNT(*), COALESCE(SUM(pb.chia_ke = 0), 0),
                           COALESCE((SELECT SUM(pv.so_luong) FROM phan_bo_lo_nhat_hang_vi_tri pv
                                      JOIN phan_bo_lo_nhat_hang b ON b.id = pv.phan_bo_lo_nhat_hang_id
                                      JOIN chi_tiet_nhat_hang c ON c.id = b.chi_tiet_nhat_hang_id
                                     WHERE c.danh_sach_nhat_hang_id = :ds AND b.lo_hang_id = :lo), 0)
                      FROM phan_bo_lo_nhat_hang pb JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                     WHERE ct.danh_sach_nhat_hang_id = :ds AND pb.lo_hang_id = :lo
                    """).setParameter("ds", ((Number) r[0]).intValue()).setParameter("lo", loId).getSingleResult();
            if (((Number) pb[0]).longValue() == 0 || ((Number) pb[1]).longValue() > 0) continue;
            int cho = soNguyen(new BigDecimal(String.valueOf(r[1])));
            int tren = soNguyen(new BigDecimal(String.valueOf(pb[2])));
            kq += Math.max(0, cho - tren);
        }
        return kq;
    }

    /** Hàng chưa có kệ của lô còn tự do cho phiếu {@code phieuNhatId}: sổ chưa có kệ − phần phiếu nhặt khác đang giữ. */
    public int soChuaCoKeTuDo(Integer khoId, Integer loId, Integer phieuNhatId) {
        return Math.max(0, soChuaCoKe(khoId, loId) - giuChuaCoKe(khoId, loId, phieuNhatId));
    }

    /**
     * Kệ của lô ở kho theo thứ tự Đ3 (kệ của lô trước, rồi theo mã) với phần còn lấy được: số trên sổ kệ trừ phần phiếu
     * nhặt khác đang giữ ({@code boQuaPhieuNhatId}: phiếu đang phân bổ, phần của chính nó không tính). Kệ đang kiểm kê có
     * {@code dangKiemKe} và không được lấy.
     */
    public List<KeLay> keConLay(Integer khoId, LoHang lo, Integer boQuaPhieuNhatId) {
        if (!batDuoc() || khoId == null || lo == null) return List.of();
        LinkedHashMap<Integer, Object[]> so = soKe(khoId, lo.getId());
        if (so.isEmpty()) return List.of();
        Map<Integer, Integer> giu = giuTrenKe(khoId, lo.getId(), boQuaPhieuNhatId);
        KhoaKiemKeGuard.TrangThaiKhoa tt = guard.trangThai(khoId);
        Integer keCuaLo = lo.getViTriKho() == null ? null : lo.getViTriKho().getId();
        List<KeLay> kq = new ArrayList<>();
        for (boolean dauTien : new boolean[]{true, false}) {
            for (Map.Entry<Integer, Object[]> e : so.entrySet()) {
                if (dauTien != Objects.equals(e.getKey(), keCuaLo)) continue;
                int con = Math.max(0, (Integer) e.getValue()[1] - giu.getOrDefault(e.getKey(), 0));
                kq.add(new KeLay(e.getKey(), (String) e.getValue()[0], BigDecimal.valueOf(con),
                        !tt.trong() && tt.capDangKhoa(e.getKey(), lo.getId())));
            }
        }
        return kq;
    }

    /**
     * Chia {@code soLuong} của lô ra kệ theo thứ tự Đ3, bỏ kệ đang kiểm kê; {@code daGiuCuaChinhNo}: phần của chính dòng
     * phân bổ đang có trên từng kệ (không lấy lại lần nữa). Phần không chia được ra kệ là hàng chưa có kệ (không trả về).
     */
    private List<KeLay> chia(Integer khoId, LoHang lo, BigDecimal soLuong, Integer boQuaPhieuNhatId,
                             Map<Integer, Integer> daGiuCuaChinhNo) {
        int can = soNguyen(soLuong);
        List<KeLay> kq = new ArrayList<>();
        if (can <= 0) return kq;
        for (KeLay k : keConLay(khoId, lo, boQuaPhieuNhatId)) {
            if (can == 0) break;
            if (k.dangKiemKe()) continue;
            int con = k.soLuong().intValue() - daGiuCuaChinhNo.getOrDefault(k.viTriId(), 0);
            int lay = Math.min(Math.max(0, con), can);
            if (lay > 0) {
                kq.add(new KeLay(k.viTriId(), k.maViTri(), BigDecimal.valueOf(lay), false));
                can -= lay;
            }
        }
        return kq;
    }

    private Map<Integer, Integer> dongCuaPhanBo(Integer phanBoId) {
        @SuppressWarnings("unchecked")
        // Theo id = thứ tự lúc chia (kệ lấy trước ghi trước): catBot bớt từ cuối
        List<Object[]> rows = em.createNativeQuery("SELECT vi_tri_kho_id, so_luong FROM phan_bo_lo_nhat_hang_vi_tri "
                + "WHERE phan_bo_lo_nhat_hang_id = :id ORDER BY id").setParameter("id", phanBoId).getResultList();
        Map<Integer, Integer> kq = new LinkedHashMap<>();
        for (Object[] r : rows) kq.merge(((Number) r[0]).intValue(), soNguyen((BigDecimal) r[1]), Integer::sum);
        return kq;
    }

    private void luu(Integer phanBoId, Map<Integer, Integer> theoKe) {
        repo.xoaCuaPhanBo(phanBoId);
        theoKe.forEach((ke, sl) -> {
            if (sl != null && sl > 0) {
                repo.save(PhanBoLoNhatHangViTri.builder().phanBoLoNhatHangId(phanBoId).viTriKhoId(ke)
                        .soLuong(BigDecimal.valueOf(sl)).build());
            }
        });
    }

    // ───────────────────────────── Ghi khi phân bổ ─────────────────────────────

    /** Chia lại toàn bộ dòng phân bổ (vừa lưu) ra kệ. Gọi sau khi phân bổ đã có id, trong cùng giao dịch. */
    @Transactional
    public void ghi(PhanBoLoNhatHang pb, Integer khoId, Integer phieuNhatId) {
        if (!batDuoc() || pb == null || pb.getId() == null) return;
        Map<Integer, Integer> moi = new LinkedHashMap<>();
        chia(khoId, pb.getLoHang(), pb.getSoLuong(), phieuNhatId, Map.of())
                .forEach(k -> moi.put(k.viTriId(), k.soLuong().intValue()));
        luu(pb.getId(), moi);
        danhDauDaChia(pb.getId());
    }

    /**
     * Dòng phân bổ vừa tăng thêm {@code them} (bù lúc Hoàn tất nhặt): giữ các kệ đã có, chia phần thêm. Phân bổ chưa biết kệ
     * (ghi trước bản này) giữ nguyên là chưa biết.
     */
    @Transactional
    public void ghiThem(PhanBoLoNhatHang pb, Integer khoId, Integer phieuNhatId, BigDecimal them) {
        if (!batDuoc() || pb == null || pb.getId() == null || !daChia(pb.getId())) return;
        Map<Integer, Integer> co = dongCuaPhanBo(pb.getId());
        Map<Integer, Integer> moi = new LinkedHashMap<>(co);
        chia(khoId, pb.getLoHang(), them, phieuNhatId, co).forEach(k -> moi.merge(k.viTriId(), k.soLuong().intValue(), Integer::sum));
        luu(pb.getId(), moi);
    }

    /**
     * Dòng phân bổ vừa giảm còn {@code soLuongMoi} (đơn bị hủy khi phiếu còn mở): bớt phần chưa có kệ trước, rồi bớt từ
     * kệ xếp cuối trong thứ tự lấy.
     */
    @Transactional
    public void catBot(PhanBoLoNhatHang pb, BigDecimal soLuongMoi) {
        if (!batDuoc() || pb == null || pb.getId() == null || !daChia(pb.getId())) return;
        Map<Integer, Integer> co = dongCuaPhanBo(pb.getId());
        int tongKe = co.values().stream().mapToInt(Integer::intValue).sum();
        int du = tongKe - soNguyen(soLuongMoi);
        if (du <= 0) return;
        List<Integer> ke = new ArrayList<>(co.keySet());
        Collections.reverse(ke);
        for (Integer k : ke) {
            if (du == 0) break;
            int bot = Math.min(du, co.get(k));
            co.put(k, co.get(k) - bot);
            du -= bot;
        }
        luu(pb.getId(), co);
    }

    /**
     * Người nhặt chọn kệ cho lô (hộp Chọn lô, Đ5). {@code chon} null hoặc rỗng: tự chia theo Đ3. Mỗi kệ phải thuộc kho,
     * đang có lô này, không đang kiểm kê và không vượt phần còn lấy được; phần ghi "chưa có kệ" là phần còn lại.
     */
    @Transactional
    public void ghiTheoChon(PhanBoLoNhatHang pb, Integer khoId, Integer phieuNhatId, List<KeChon> chon) {
        if (!batDuoc() || pb == null || pb.getId() == null) return;
        if (chon == null || chon.isEmpty()) {
            ghi(pb, khoId, phieuNhatId);
            return;
        }
        LoHang lo = pb.getLoHang();
        Map<Integer, KeLay> co = new HashMap<>();
        keConLay(khoId, lo, phieuNhatId).forEach(k -> co.put(k.viTriId(), k));
        Map<Integer, Integer> moi = new LinkedHashMap<>();
        BigDecimal tong = BigDecimal.ZERO;
        for (KeChon c : chon) {
            if (c == null || c.soLuong() == null || c.soLuong().signum() <= 0) continue;
            if (c.soLuong().stripTrailingZeros().scale() > 0) {
                throw new CommonException(ThongDiep.of("khoVanHanh.soLayOKePhaiNguyen"), HttpStatus.BAD_REQUEST, null);
            }
            tong = tong.add(c.soLuong());
            if (c.viTriId() == null) continue;
            KeLay k = co.get(c.viTriId());
            if (k == null) {
                throw new CommonException(ThongDiep.of("khoVanHanh.loKhongCoTrenKeDaChon", lo.getMaLo()), HttpStatus.BAD_REQUEST, null);
            }
            if (k.dangKiemKe()) {
                throw new CommonException(ThongDiep.of("khoVanHanh.keDangKiemKeChonKeKhac", k.maViTri()), HttpStatus.CONFLICT, null);
            }
            int sl = moi.merge(c.viTriId(), c.soLuong().intValue(), Integer::sum);
            if (sl > k.soLuong().intValue()) {
                throw new CommonException(ThongDiep.of("khoVanHanh.keChiConCuaLoCoTheLay",
                        k.maViTri(), k.soLuong().intValue(), lo.getMaLo()), HttpStatus.CONFLICT, null);
            }
        }
        if (tong.compareTo(pb.getSoLuong()) != 0) {
            throw new CommonException(ThongDiep.of("khoVanHanh.soChiaTheoKePhaiBang",
                    lo.getMaLo(), pb.getSoLuong().stripTrailingZeros().toPlainString()), HttpStatus.BAD_REQUEST, null);
        }
        int phanChuaCoKe = soNguyen(tong) - moi.values().stream().mapToInt(Integer::intValue).sum();
        if (phanChuaCoKe > 0) {
            // Trừ phần hàng chưa có kệ phiếu nhặt khác đã giữ, không thì hai phiếu cùng được hứa một chỗ hàng
            int coChuaCoKe = soChuaCoKeTuDo(khoId, lo.getId(), phieuNhatId);
            if (phanChuaCoKe > coChuaCoKe) {
                throw new CommonException(ThongDiep.of("khoVanHanh.loChiConOHangChuaCoKe", lo.getMaLo(), coChuaCoKe, phanChuaCoKe), HttpStatus.CONFLICT, null);
            }
        }
        luu(pb.getId(), moi);
        danhDauDaChia(pb.getId());
    }

    /** Hàng chưa có kệ của lô ở kho = tồn lô ở kho − tổng sổ kệ của các kệ trong kho (không âm). */
    public int soChuaCoKe(Integer khoId, Integer loId) {
        if (khoId == null || loId == null) return 0;
        Object ton = em.createNativeQuery("SELECT COALESCE(SUM(so_luong_ton), 0) FROM ton_kho_theo_lo "
                + "WHERE kho_id = :kho AND lo_hang_id = :lo").setParameter("kho", khoId).setParameter("lo", loId).getSingleResult();
        Number ke = (Number) em.createNativeQuery("""
                SELECT COALESCE(SUM(t.so_luong), 0) FROM ton_kho_vi_tri t JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
                 WHERE v.kho_id = :kho AND t.lo_hang_id = :lo AND t.so_luong > 0
                """).setParameter("kho", khoId).setParameter("lo", loId).getSingleResult();
        return Math.max(0, soNguyen(new BigDecimal(String.valueOf(ton))) - (ke == null ? 0 : ke.intValue()));
    }

    // ───────────────────────────── Đọc ─────────────────────────────

    /** Các kệ của từng dòng phân bổ, theo thứ tự lấy; kệ đang kiểm kê có cờ. Dòng không có kệ: danh sách rỗng. */
    public Map<Integer, List<KeLay>> docKe(Collection<PhanBoLoNhatHang> pbs, Integer khoId) {
        Map<Integer, List<KeLay>> kq = new HashMap<>();
        if (!batDuoc() || pbs == null || pbs.isEmpty()) return kq;
        Map<Integer, PhanBoLoNhatHang> theoId = new HashMap<>();
        pbs.forEach(pb -> theoId.put(pb.getId(), pb));
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT pv.phan_bo_lo_nhat_hang_id, pv.vi_tri_kho_id, v.ma_vi_tri, pv.so_luong
                  FROM phan_bo_lo_nhat_hang_vi_tri pv JOIN vi_tri_kho v ON v.id = pv.vi_tri_kho_id
                 WHERE pv.phan_bo_lo_nhat_hang_id IN (:ids) ORDER BY pv.id
                """).setParameter("ids", theoId.keySet()).getResultList();
        if (rows.isEmpty()) return kq;
        KhoaKiemKeGuard.TrangThaiKhoa tt = guard.trangThai(khoId);
        for (Object[] r : rows) {
            Integer pbId = ((Number) r[0]).intValue();
            Integer ke = ((Number) r[1]).intValue();
            PhanBoLoNhatHang pb = theoId.get(pbId);
            boolean khoa = pb != null && !tt.trong() && tt.capDangKhoa(ke, pb.getLoHang().getId());
            kq.computeIfAbsent(pbId, x -> new ArrayList<>()).add(new KeLay(ke, (String) r[2], (BigDecimal) r[3], khoa));
        }
        // Kệ của lô lên đầu (cùng thứ tự lúc chia)
        kq.forEach((pbId, ds) -> {
            PhanBoLoNhatHang pb = theoId.get(pbId);
            Integer keCuaLo = pb == null || pb.getLoHang().getViTriKho() == null ? null : pb.getLoHang().getViTriKho().getId();
            ds.sort(Comparator.comparing((KeLay k) -> !Objects.equals(k.viTriId(), keCuaLo)).thenComparing(KeLay::maViTri));
        });
        return kq;
    }

    /** Các lô (trong {@code loIds}) đang nằm trên ít nhất một kệ của kho. CSDL chưa nâng cấp: coi như mọi lô. */
    public Set<Integer> loCoTrenKe(Integer khoId, Collection<Integer> loIds) {
        if (loIds == null || loIds.isEmpty()) return Collections.emptySet();
        if (!batDuoc() || khoId == null) return new HashSet<>(loIds);
        @SuppressWarnings("unchecked")
        List<Object> r = em.createNativeQuery("""
                SELECT DISTINCT t.lo_hang_id FROM ton_kho_vi_tri t JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
                 WHERE v.kho_id = :kho AND t.lo_hang_id IN (:los) AND t.so_luong > 0
                """).setParameter("kho", khoId).setParameter("los", loIds).getResultList();
        Set<Integer> kq = new HashSet<>();
        r.forEach(x -> kq.add(((Number) x).intValue()));
        return kq;
    }

    // ───────────────────────────── Xóa kệ ─────────────────────────────

    /** Mã các phiếu nhặt (tối đa 3) còn giữ hàng ở kệ: đang nhặt, hoặc đã nhặt mà chưa xuất kho. */
    public List<String> phieuDangGiuKe(Integer viTriId) {
        if (!batDuoc() || viTriId == null) return List.of();
        @SuppressWarnings("unchecked")
        List<Object> r = em.createNativeQuery("""
                SELECT DISTINCT ds.ma_pick_list FROM phan_bo_lo_nhat_hang_vi_tri pv
                  JOIN phan_bo_lo_nhat_hang pb ON pb.id = pv.phan_bo_lo_nhat_hang_id
                  JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                  JOIN danh_sach_nhat_hang ds ON ds.id = ct.danh_sach_nhat_hang_id
                 WHERE pv.vi_tri_kho_id = :id AND pv.so_luong > 0 AND
                """ + PHIEU_CON_GIU + " ORDER BY ds.ma_pick_list LIMIT 3").setParameter("id", viTriId).getResultList();
        return r.stream().map(String::valueOf).toList();
    }

    /**
     * Xóa các dòng kệ không còn nghĩa của kệ (phiếu nhặt đã hủy, hoặc đã nhặt và mọi phiếu xuất đã xuất / hủy) để xóa
     * được kệ (khóa ngoại tới vi_tri_kho). Gọi sau {@link #phieuDangGiuKe} trả rỗng.
     */
    @Transactional
    public int xoaDongCuCuaKe(Integer viTriId) {
        if (!batDuoc() || viTriId == null) return 0;
        return em.createNativeQuery("""
                DELETE pv FROM phan_bo_lo_nhat_hang_vi_tri pv
                  JOIN phan_bo_lo_nhat_hang pb ON pb.id = pv.phan_bo_lo_nhat_hang_id
                  JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                  JOIN danh_sach_nhat_hang ds ON ds.id = ct.danh_sach_nhat_hang_id
                 WHERE pv.vi_tri_kho_id = :id AND NOT
                """ + PHIEU_CON_GIU).setParameter("id", viTriId).executeUpdate();
    }

    // ───────────────────────────── Quét nhặt ─────────────────────────────

    /**
     * Lúc quét xác nhận nhặt (BA 8.2 Scan-to-Pick): phần phân bổ của dòng nằm ở kệ vừa bị khóa kiểm kê thì chặn, báo đợt
     * đang giữ khóa. Bình thường không xảy ra vì Bắt đầu kiểm kê đã chặn khi còn phiếu nhặt mở ở kệ trong phạm vi.
     */
    public void kiemTraQuet(Integer khoId, Integer chiTietNhatHangId) {
        if (!batDuoc() || khoId == null || chiTietNhatHangId == null) return;
        KhoaKiemKeGuard.TrangThaiKhoa tt = guard.trangThai(khoId);
        if (tt.trong()) return;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT pv.vi_tri_kho_id, pb.lo_hang_id FROM phan_bo_lo_nhat_hang_vi_tri pv
                  JOIN phan_bo_lo_nhat_hang pb ON pb.id = pv.phan_bo_lo_nhat_hang_id
                 WHERE pb.chi_tiet_nhat_hang_id = :ct
                """).setParameter("ct", chiTietNhatHangId).getResultList();
        for (Object[] r : rows) {
            Integer ke = ((Number) r[0]).intValue();
            Integer lo = ((Number) r[1]).intValue();
            if (tt.capDangKhoa(ke, lo)) {
                LoiCoMaException e = guard.loi(tt, tt.dotCuaCap(ke, lo), ke, lo, "nhặt ở kệ này");
                throw new LoiCoMaException(e.getStatus(), e.getMa(),
                        ThongDiep.of("khoVanHanh.keDangKiemKeMoPhanBo",
                                e.getThongDiep() != null ? e.getThongDiep() : e.getMessage()), e.getDuLieu());
            }
        }
    }

    // ───────────────────────────── Xuất kho ─────────────────────────────

    /** Phiếu nhặt đã tạo ra phiếu xuất (phiếu chuyển kho: qua phieu_xuat_kho_id; phiếu bán: qua đơn), nếu đã nhặt xong. */
    private Integer phieuNhatCua(PhieuXuatKho px) {
        @SuppressWarnings("unchecked")
        List<Object> r = em.createNativeQuery("""
                SELECT ds.id FROM danh_sach_nhat_hang ds
                 WHERE ds.trang_thai = 'da_nhat' AND ds.kho_xuat_id = :kho
                   AND (ds.phieu_xuat_kho_id = :px
                        OR ds.id = (SELECT d.danh_sach_nhat_hang_id FROM don_ban_hang d WHERE d.id = :don))
                 ORDER BY ds.id DESC LIMIT 1
                """).setParameter("kho", px.getKho().getId()).setParameter("px", px.getId())
                .setParameter("don", px.getDonBanHang() == null ? -1 : px.getDonBanHang().getId()).getResultList();
        return r.isEmpty() ? null : ((Number) r.get(0)).intValue();
    }

    /**
     * Xuất {@code soLuong} của lô theo phiếu xuất tạo từ phiếu nhặt: lấy phần đã nhặt ở từng kệ (theo dòng kệ còn lại của
     * phiếu nhặt, kệ của lô trước) và giảm các dòng đó tương ứng. Trả [kệ → số] để trừ sổ kệ đúng chỗ; danh sách rỗng:
     * phần này lấy ở hàng chưa có kệ. null khi phiếu không đến từ phiếu nhặt, hoặc phân bổ lô đó chưa biết kệ (giữ cách trừ
     * theo thứ tự Đ3).
     */
    @Transactional
    public LinkedHashMap<Integer, Integer> layKeDaNhat(PhieuXuatKho px, LoHang lo, BigDecimal soLuong) {
        if (!batDuoc() || px == null || px.getKho() == null || lo == null) return null;
        Integer phieuNhat = phieuNhatCua(px);
        if (phieuNhat == null) return null;
        // Lô phải có phân bổ trong phiếu nhặt và mọi phân bổ của lô đều đã chia kệ
        Object[] dem = (Object[]) em.createNativeQuery("""
                SELECT COUNT(*), COALESCE(SUM(pb.chia_ke = 0), 0) FROM phan_bo_lo_nhat_hang pb
                  JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                 WHERE ct.danh_sach_nhat_hang_id = :ds AND pb.lo_hang_id = :lo
                """).setParameter("ds", phieuNhat).setParameter("lo", lo.getId()).getSingleResult();
        if (((Number) dem[0]).longValue() == 0 || ((Number) dem[1]).longValue() > 0) return null;
        // Khóa riêng dòng kệ (OF pv): hai phiếu xuất của cùng phiếu nhặt lần lượt giảm, đọc bản mới nhất
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT pv.id, pv.vi_tri_kho_id, pv.so_luong, v.ma_vi_tri FROM phan_bo_lo_nhat_hang_vi_tri pv
                  JOIN phan_bo_lo_nhat_hang pb ON pb.id = pv.phan_bo_lo_nhat_hang_id
                  JOIN chi_tiet_nhat_hang ct ON ct.id = pb.chi_tiet_nhat_hang_id
                  JOIN vi_tri_kho v ON v.id = pv.vi_tri_kho_id
                 WHERE ct.danh_sach_nhat_hang_id = :ds AND pb.lo_hang_id = :lo
                 ORDER BY pv.id
                 FOR UPDATE OF pv
                """).setParameter("ds", phieuNhat).setParameter("lo", lo.getId()).getResultList();
        Integer keCuaLo = lo.getViTriKho() == null ? null : lo.getViTriKho().getId();
        rows.sort(Comparator.comparing((Object[] r) -> !Objects.equals(((Number) r[1]).intValue(), keCuaLo))
                .thenComparing(r -> (String) r[3]));
        LinkedHashMap<Integer, Integer> kq = new LinkedHashMap<>();
        int can = soNguyen(soLuong);
        for (Object[] r : rows) {
            if (can == 0) break;
            long id = ((Number) r[0]).longValue();
            int co = soNguyen((BigDecimal) r[2]);
            int lay = Math.min(co, can);
            if (lay <= 0) continue;
            kq.merge(((Number) r[1]).intValue(), lay, Integer::sum);
            can -= lay;
            if (lay == co) {
                em.createNativeQuery("DELETE FROM phan_bo_lo_nhat_hang_vi_tri WHERE id = :id").setParameter("id", id).executeUpdate();
            } else {
                em.createNativeQuery("UPDATE phan_bo_lo_nhat_hang_vi_tri SET so_luong = so_luong - :lay WHERE id = :id")
                        .setParameter("lay", lay).setParameter("id", id).executeUpdate();
            }
        }
        return kq;
    }
}
