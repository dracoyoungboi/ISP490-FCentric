package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.LoHangRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TonKhoViTriRepository;
import com.dev.backend.repository.ViTriKhoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Sổ tồn theo kệ (ton_kho_vi_tri), chốt Đ2 PA 1: số trên từng cặp kệ–lô luôn đi cùng tồn của lô ở kho
 * (ton_kho_theo_lo). Phần tồn của lô không nằm trên kệ nào của kho là hàng chưa có kệ:
 * <pre>chưa có kệ(lô, kho) = tồn lô ở kho − Σ số trên các kệ của kho</pre>
 * <ul>
 *   <li>{@link #tru}: tồn lô giảm (xuất, bán) — trừ ở kệ của lô trước, rồi các kệ khác, cuối cùng phần chưa có kệ
 *   (chốt Đ3); bỏ qua kệ đang kiểm kê.</li>
 *   <li>{@link #cong}: nhập lên một kệ của đúng kho; kệ khác kho / không có kệ thì hàng vào phần chưa có kệ.</li>
 *   <li>{@link #xepKe} / {@link #chuyenKe}: đổi chỗ trong kho, tồn lô không đổi.</li>
 * </ul>
 * Dòng sổ kệ khóa theo PK sau khi luồng đã khóa dòng tồn lô (cùng thứ tự ở mọi luồng thường); kiểm kê giữ mutex kho
 * nên không chạy xen.
 */
@Slf4j
@Service
public class SoTonKeService {

    @PersistenceContext
    private EntityManager em;

    private final TonKhoViTriRepository tonKhoViTriRepository;
    private final TonKhoTheoLoRepository tonKhoTheoLoRepository;
    private final ViTriKhoRepository viTriKhoRepository;
    private final LoHangRepository loHangRepository;
    private final KhoaKiemKeGuard guard;

    public SoTonKeService(TonKhoViTriRepository tonKhoViTriRepository, TonKhoTheoLoRepository tonKhoTheoLoRepository,
                          ViTriKhoRepository viTriKhoRepository, LoHangRepository loHangRepository,
                          KhoaKiemKeGuard guard) {
        this.tonKhoViTriRepository = tonKhoViTriRepository;
        this.tonKhoTheoLoRepository = tonKhoTheoLoRepository;
        this.viTriKhoRepository = viTriKhoRepository;
        this.loHangRepository = loHangRepository;
        this.guard = guard;
    }

    static int soNguyen(BigDecimal v) {
        return v == null ? 0 : v.setScale(0, RoundingMode.HALF_UP).intValue();
    }

    /** Khóa và nạp lại các dòng sổ kệ của lô ở kho (open-in-view có thể giữ bản cũ). */
    private List<TonKhoViTri> khoaDong(Integer khoId, Integer loId) {
        List<TonKhoViTri> dong = tonKhoViTriRepository.khoaTheoKhoVaLo(khoId, loId);
        for (TonKhoViTri t : dong) em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
        return dong;
    }

    /**
     * Tồn lô ở kho vừa giảm {@code soLuong}. {@code tonLoTruoc}: tồn lô ở kho TRƯỚC khi trừ (dòng tồn lô đã khóa).
     * Luồng gọi đã qua {@link KhoaKiemKeGuard#kiemTraXuat}; phần không lấy được mà chỉ còn ở kệ đang kiểm kê là lỗi.
     */
    @Transactional
    public void tru(Integer khoId, LoHang lo, BigDecimal soLuong, BigDecimal tonLoTruoc) {
        int can = soNguyen(soLuong);
        if (khoId == null || lo == null || can <= 0) return;
        List<TonKhoViTri> dong = khoaDong(khoId, lo.getId());
        if (dong.isEmpty()) return; // lô không có trên kệ nào của kho: chỉ có phần chưa có kệ
        int tongKe = dong.stream().mapToInt(t -> Math.max(0, t.getSoLuong() == null ? 0 : t.getSoLuong())).sum();
        int chuaCoKe = Math.max(0, soNguyen(tonLoTruoc) - tongKe);
        Set<Integer> dangKiem = guard.keDangKiemCuaLo(khoId, lo.getId());
        Integer keCuaLo = lo.getViTriKho() == null ? null : lo.getViTriKho().getId();
        List<TonKhoViTri> thuTu = new ArrayList<>(dong);
        thuTu.sort(Comparator.comparing((TonKhoViTri t) -> !Objects.equals(t.getViTriKho().getId(), keCuaLo))
                .thenComparing(t -> t.getViTriKho().getId()));
        for (TonKhoViTri t : thuTu) {
            if (can == 0) break;
            if (dangKiem.contains(t.getViTriKho().getId())) continue;
            int co = Math.max(0, t.getSoLuong() == null ? 0 : t.getSoLuong());
            int lay = Math.min(co, can);
            if (lay > 0) {
                t.setSoLuong(co - lay);
                tonKhoViTriRepository.save(t);
                can -= lay;
            }
        }
        can -= Math.min(can, chuaCoKe);
        if (can > 0) {
            // Chỉ còn ở kệ đang kiểm kê (chốt chặn đã phải dừng trước đó) hoặc sổ kệ lệch tồn lô
            boolean conOKeKiem = thuTu.stream().anyMatch(t -> dangKiem.contains(t.getViTriKho().getId())
                    && t.getSoLuong() != null && t.getSoLuong() > 0);
            if (conOKeKiem) {
                throw new CommonException(HttpStatus.CONFLICT, "Lô " + lo.getMaLo()
                        + " chỉ còn ở kệ đang kiểm kê. Tạm dừng xuất lô này tới khi đợt kiểm kê được duyệt hoặc hủy.");
            }
            log.warn("[SO-KE] Lô {} ở kho {}: sổ kệ thiếu {} so với tồn lô khi trừ", lo.getId(), khoId, can);
        }
    }

    /**
     * Nhập {@code soLuong} của lô lên kệ {@code viTri} ở kho {@code khoId}. Kệ null hoặc thuộc kho khác (vd. phiếu nhập
     * hoàn trả về kho không phải kho của kệ lô) thì hàng vào phần chưa có kệ, không ghi gì.
     */
    @Transactional
    public void cong(Integer khoId, ViTriKho viTri, LoHang lo, BienTheSanPham bienThe, BigDecimal soLuong) {
        int them = soNguyen(soLuong);
        if (khoId == null || viTri == null || lo == null || them <= 0) return;
        Integer khoCuaKe = viTri.getKho() != null ? viTri.getKho().getId()
                : viTri.getKhuVucKho() != null && viTri.getKhuVucKho().getKho() != null ? viTri.getKhuVucKho().getKho().getId() : null;
        if (!khoId.equals(khoCuaKe)) return;
        TonKhoViTri t = tonKhoViTriRepository.khoaTheoKeVaLo(viTri.getId(), lo.getId()).orElse(null);
        if (t == null) {
            t = TonKhoViTri.builder().viTriKho(viTri).loHang(lo)
                    .bienTheSanPham(bienThe != null ? bienThe : lo.getBienTheSanPham()).soLuong(0).build();
        } else {
            em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
        }
        t.setSoLuong((t.getSoLuong() == null ? 0 : t.getSoLuong()) + them);
        tonKhoViTriRepository.save(t);
    }

    /** Đặt số trên một cặp kệ–lô (phê duyệt kiểm kê ghi số đếm thực tế). */
    @Transactional
    public void datSo(ViTriKho viTri, LoHang lo, BienTheSanPham bienThe, int soMoi) {
        TonKhoViTri t = tonKhoViTriRepository.khoaTheoKeVaLo(viTri.getId(), lo.getId()).orElse(null);
        if (t == null) {
            if (soMoi == 0) return;
            t = TonKhoViTri.builder().viTriKho(viTri).loHang(lo)
                    .bienTheSanPham(bienThe != null ? bienThe : lo.getBienTheSanPham()).soLuong(0).build();
        } else {
            em.refresh(t, LockModeType.PESSIMISTIC_WRITE);
        }
        t.setSoLuong(soMoi);
        tonKhoViTriRepository.save(t);
    }

    // ───────────────────────────── Xếp kệ / chuyển kệ ─────────────────────────────

    /** Một lô có hàng chưa có kệ ở kho. */
    public record HangChuaCoKe(Integer loHangId, String maLo, Integer bienTheId, String maSku, BigDecimal tonLo,
                               int trenKe, int chuaCoKe, Integer keGoiYId, String keGoiY) {
    }

    /** Các lô còn hàng chưa có kệ ở kho, kèm kệ gợi ý (kệ của lô nếu thuộc kho). */
    @Transactional(readOnly = true)
    public List<HangChuaCoKe> hangChuaCoKe(Integer khoId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT k.lo_hang_id, l.ma_lo, bt.id, bt.ma_sku, k.so_luong_ton,
                       COALESCE((SELECT SUM(t.so_luong) FROM ton_kho_vi_tri t JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
                                  WHERE t.lo_hang_id = k.lo_hang_id AND v.kho_id = k.kho_id), 0) AS tren_ke,
                       CASE WHEN vk.kho_id = k.kho_id THEN vk.id END AS ke_id,
                       CASE WHEN vk.kho_id = k.kho_id THEN vk.ma_vi_tri END AS ke_ma
                  FROM ton_kho_theo_lo k
                  JOIN lo_hang l ON l.id = k.lo_hang_id
                  JOIN bien_the_san_pham bt ON bt.id = l.bien_the_san_pham_id
                  LEFT JOIN vi_tri_kho vk ON vk.id = l.vi_tri_kho_id
                 WHERE k.kho_id = :kho AND k.so_luong_ton >= 1
                 ORDER BY l.ma_lo, k.lo_hang_id
                """).setParameter("kho", khoId).getResultList();
        List<HangChuaCoKe> kq = new ArrayList<>();
        for (Object[] r : rows) {
            BigDecimal ton = (BigDecimal) r[4];
            int trenKe = ((Number) r[5]).intValue();
            int chua = soNguyen(ton) - trenKe;
            if (chua <= 0) continue;
            kq.add(new HangChuaCoKe(((Number) r[0]).intValue(), (String) r[1], ((Number) r[2]).intValue(), (String) r[3],
                    ton, trenKe, chua, r[6] == null ? null : ((Number) r[6]).intValue(), (String) r[7]));
        }
        return kq;
    }

    /**
     * Đưa {@code soLuong} hàng chưa có kệ của lô lên kệ {@code viTriId} cùng kho. Kệ phải đang hoạt động, còn sức chứa,
     * không đang kiểm kê. Lô chưa có kệ chính thì nhận kệ này làm kệ của lô.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void xepKe(Integer khoId, Integer loId, Integer viTriId, int soLuong) {
        if (soLuong <= 0) throw new CommonException("Số lượng xếp kệ phải lớn hơn 0");
        guard.giuKho(khoId);
        TonKhoTheoLo ton = khoaTonLo(khoId, loId);
        ViTriKho viTri = keCuaKho(khoId, viTriId);
        guard.kiemTraNhapKe(khoId, viTriId, List.of(loId), "xếp hàng lên kệ");
        List<TonKhoViTri> dong = khoaDong(khoId, loId);
        int tongKe = dong.stream().mapToInt(t -> Math.max(0, t.getSoLuong() == null ? 0 : t.getSoLuong())).sum();
        int chuaCoKe = soNguyen(ton.getSoLuongTon()) - tongKe;
        if (soLuong > chuaCoKe) {
            throw new CommonException(HttpStatus.CONFLICT, "Lô " + ton.getLoHang().getMaLo() + " chỉ còn "
                    + Math.max(0, chuaCoKe) + " sản phẩm chưa có kệ ở kho này");
        }
        kiemTraSucChua(viTri, soLuong);
        cong(khoId, viTri, ton.getLoHang(), ton.getLoHang().getBienTheSanPham(), BigDecimal.valueOf(soLuong));
        LoHang lo = ton.getLoHang();
        if (lo.getViTriKho() == null) {
            lo.setViTriKho(viTri);
            loHangRepository.save(lo);
        }
    }

    /** Chuyển {@code soLuong} của lô từ kệ này sang kệ khác cùng kho; cả hai kệ không được đang kiểm kê. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void chuyenKe(Integer khoId, Integer loId, Integer tuViTriId, Integer denViTriId, int soLuong) {
        if (soLuong <= 0) throw new CommonException("Số lượng chuyển kệ phải lớn hơn 0");
        if (Objects.equals(tuViTriId, denViTriId)) throw new CommonException("Chọn kệ đến khác kệ đang chứa");
        guard.giuKho(khoId);
        TonKhoTheoLo ton = khoaTonLo(khoId, loId);
        ViTriKho tu = keCuaKho(khoId, tuViTriId);
        ViTriKho den = keCuaKho(khoId, denViTriId);
        guard.kiemTraXuat(khoId, Map.of(loId, BigDecimal.valueOf(soLuong)), Map.of(loId, ton.getSoLuongTon()), "chuyển hàng khỏi kệ");
        if (guard.keDangKiemCuaLo(khoId, loId).contains(tuViTriId)) {
            throw new CommonException(HttpStatus.CONFLICT, "Kệ " + tu.getMaViTri() + " đang kiểm kê, chưa chuyển hàng đi được");
        }
        guard.kiemTraNhapKe(khoId, denViTriId, List.of(loId), "chuyển hàng lên kệ");
        khoaDong(khoId, loId);
        TonKhoViTri nguon = tonKhoViTriRepository.khoaTheoKeVaLo(tuViTriId, loId)
                .orElseThrow(() -> new CommonException(HttpStatus.CONFLICT, "Kệ " + tu.getMaViTri() + " không có lô này"));
        int co = nguon.getSoLuong() == null ? 0 : nguon.getSoLuong();
        if (co < soLuong) {
            throw new CommonException(HttpStatus.CONFLICT, "Kệ " + tu.getMaViTri() + " chỉ còn " + Math.max(0, co) + " sản phẩm của lô này");
        }
        kiemTraSucChua(den, soLuong);
        nguon.setSoLuong(co - soLuong);
        tonKhoViTriRepository.save(nguon);
        cong(khoId, den, ton.getLoHang(), ton.getLoHang().getBienTheSanPham(), BigDecimal.valueOf(soLuong));
        LoHang lo = ton.getLoHang();
        if (lo.getViTriKho() != null && tuViTriId.equals(lo.getViTriKho().getId()) && co == soLuong) {
            lo.setViTriKho(den);
            loHangRepository.save(lo);
        }
    }

    private TonKhoTheoLo khoaTonLo(Integer khoId, Integer loId) {
        List<Integer> ids = tonKhoTheoLoRepository.findIdsByKhoAndLots(khoId, List.of(loId));
        if (ids.isEmpty()) throw new CommonException(HttpStatus.NOT_FOUND, "Kho này không có lô hàng đã chọn");
        TonKhoTheoLo ton = tonKhoTheoLoRepository.lockLotsForUpdateByIds(ids).get(0);
        em.refresh(ton, LockModeType.PESSIMISTIC_WRITE);
        return ton;
    }

    private ViTriKho keCuaKho(Integer khoId, Integer viTriId) {
        ViTriKho viTri = viTriKhoRepository.khoaTheoId(viTriId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy kệ đã chọn"));
        if (viTri.getKho() == null || !khoId.equals(viTri.getKho().getId())) {
            throw new CommonException(HttpStatus.FORBIDDEN, "Kệ " + viTri.getMaViTri() + " không thuộc kho này");
        }
        String tt = viTri.getTrangThai();
        if (tt != null && !IKiemKe.KE_HOAT_DONG.equals(tt) && !IKiemKe.KE_DAY_HANG.equals(tt)) {
            throw new CommonException(HttpStatus.CONFLICT, IKiemKe.KE_KHOA_KIEM_KE.equals(tt)
                    ? "Kệ " + viTri.getMaViTri() + " đang kiểm kê" : "Kệ " + viTri.getMaViTri() + " đang bảo trì");
        }
        return viTri;
    }

    private void kiemTraSucChua(ViTriKho viTri, int them) {
        Integer sucChua = viTri.getSucChuaToiDa();
        if (sucChua == null || sucChua <= 0) return;
        Integer dang = tonKhoViTriRepository.sumDangChuaByViTriId(viTri.getId());
        int dangChua = dang == null ? 0 : dang;
        if (dangChua + them > sucChua) {
            throw new CommonException(HttpStatus.CONFLICT, "Kệ " + viTri.getMaViTri() + " còn chỗ cho "
                    + Math.max(0, sucChua - dangChua) + " sản phẩm");
        }
    }
}
