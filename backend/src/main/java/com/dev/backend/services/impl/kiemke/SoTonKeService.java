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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import com.dev.backend.i18n.ThongDiep;

/**
 * Sổ tồn theo kệ (ton_kho_vi_tri), chốt Đ2 PA 1: số trên từng cặp kệ–lô luôn đi cùng tồn của lô ở kho
 * (ton_kho_theo_lo). Phần tồn của lô không nằm trên kệ nào của kho là hàng chưa có kệ:
 * <pre>chưa có kệ(lô, kho) = tồn lô ở kho − Σ số trên các kệ của kho</pre>
 * <ul>
 *   <li>{@link #tru}: tồn lô giảm (xuất, bán) — trừ ở kệ của lô trước, rồi các kệ khác theo mã, cuối cùng phần chưa
 *   có kệ (chốt Đ3); bỏ qua kệ đang kiểm kê. Phần kệ phiếu nhặt đang giữ chỉ trừ sau cùng.</li>
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

    /** Phần kệ / hàng chưa có kệ phiếu nhặt đang giữ (phân bổ nhặt theo kệ); null khi unit test dựng tay. */
    @Autowired(required = false)
    private PhanBoKeService phanBoKeService;

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
        tru(khoId, lo, soLuong, tonLoTruoc, null);
    }

    /**
     * Như {@link #tru(Integer, LoHang, BigDecimal, BigDecimal)}, có thêm {@code keDaNhat}: [kệ → số] hàng đã nhặt ở từng
     * kệ (phiếu xuất tạo từ phiếu nhặt có ghi kệ, {@link PhanBoKeService#layKeDaNhat}). Trừ đúng các kệ đó trước; phần
     * còn lại đã nhặt ở hàng chưa có kệ nên trừ phần chưa có kệ trước, thiếu mới tới các kệ theo thứ tự Đ3.
     * {@code keDaNhat} null: trừ theo thứ tự Đ3 như cũ.
     */
    @Transactional
    public void tru(Integer khoId, LoHang lo, BigDecimal soLuong, BigDecimal tonLoTruoc, Map<Integer, Integer> keDaNhat) {
        int can = soNguyen(soLuong);
        if (khoId == null || lo == null || can <= 0) return;
        List<TonKhoViTri> dong = khoaDong(khoId, lo.getId());
        if (dong.isEmpty()) return; // lô không có trên kệ nào của kho: chỉ có phần chưa có kệ
        int tongKe = dong.stream().mapToInt(t -> Math.max(0, t.getSoLuong() == null ? 0 : t.getSoLuong())).sum();
        int chuaCoKe = Math.max(0, soNguyen(tonLoTruoc) - tongKe);
        Set<Integer> dangKiem = guard.keDangKiemCuaLo(khoId, lo.getId());
        Integer keCuaLo = lo.getViTriKho() == null ? null : lo.getViTriKho().getId();
        List<TonKhoViTri> thuTu = new ArrayList<>(dong);
        // Đ3: kệ của lô, rồi các kệ khác theo mã (cùng thứ tự phiếu nhặt chia kệ)
        thuTu.sort(Comparator.comparing((TonKhoViTri t) -> !Objects.equals(t.getViTriKho().getId(), keCuaLo))
                .thenComparing(t -> t.getViTriKho().getMaViTri() == null ? "" : t.getViTriKho().getMaViTri())
                .thenComparing(t -> t.getViTriKho().getId()));
        // Phần trên kệ phiếu nhặt khác đang giữ (đang nhặt / đã nhặt chờ xuất): trừ sau cùng, để bán quầy hay phiếu không
        // từ phiếu nhặt không ăn vào hàng người nhặt sẽ lấy ở kệ đó
        Map<Integer, Integer> giu = phanBoKeService == null ? Map.of() : phanBoKeService.giuTrenKeCuaLo(khoId, lo.getId());
        if (keDaNhat != null) {
            for (TonKhoViTri t : thuTu) {
                if (can == 0) break;
                Integer goi = keDaNhat.get(t.getViTriKho().getId());
                if (goi == null || goi <= 0 || dangKiem.contains(t.getViTriKho().getId())) continue;
                int co = Math.max(0, t.getSoLuong() == null ? 0 : t.getSoLuong());
                int lay = Math.min(Math.min(co, goi), can);
                if (lay > 0) {
                    t.setSoLuong(co - lay);
                    tonKhoViTriRepository.save(t);
                    can -= lay;
                }
            }
            int tuChuaCoKe = Math.min(can, chuaCoKe);
            can -= tuChuaCoKe;
            chuaCoKe -= tuChuaCoKe;
        }
        // Phần kệ còn tự do (sổ kệ − phần phiếu nhặt giữ)
        for (TonKhoViTri t : thuTu) {
            if (can == 0) break;
            if (dangKiem.contains(t.getViTriKho().getId())) continue;
            int co = Math.max(0, t.getSoLuong() == null ? 0 : t.getSoLuong());
            int lay = Math.min(Math.max(0, co - giu.getOrDefault(t.getViTriKho().getId(), 0)), can);
            if (lay > 0) {
                t.setSoLuong(co - lay);
                tonKhoViTriRepository.save(t);
                can -= lay;
            }
        }
        if (keDaNhat == null) {
            int tuChuaCoKe = Math.min(can, chuaCoKe);
            can -= tuChuaCoKe;
            chuaCoKe -= tuChuaCoKe;
        }
        // Cuối cùng phần đang giữ (dữ liệu lệch / phiếu không theo phân bổ)
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
                throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.loChiConOKeDangKiemKe", lo.getMaLo()));
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

    /** Một lô có hàng chưa có kệ ở kho; {@code keChinhId}: kệ chính của lô (lo_hang.vi_tri_kho_id) khi thuộc kho này. */
    public record HangChuaCoKe(Integer loHangId, String maLo, Integer bienTheId, String maSku, BigDecimal tonLo,
                               int trenKe, int chuaCoKe, Integer keChinhId, String keChinh) {
    }

    /**
     * Các lô còn hàng chưa có kệ ở kho, kèm kệ chính của lô nếu thuộc kho (gợi ý kệ ở HangChuaCoKeService). Dòng sổ kệ
     * âm (dữ liệu lệch) tính là 0, như {@link #xepKe}. Kho chưa khai báo kệ nào là kho không quản lý kệ: trả rỗng (menu
     * không có số đếm, chứng từ không nhắc xếp kệ).
     */
    @Transactional(readOnly = true)
    public List<HangChuaCoKe> hangChuaCoKe(Integer khoId) {
        return hangChuaCoKe(khoId, true);
    }

    /** Như {@link #hangChuaCoKe(Integer)}; {@code kiemCoKe} false khi nơi gọi đã biết kho có kệ (khỏi một câu truy vấn). */
    @Transactional(readOnly = true)
    public List<HangChuaCoKe> hangChuaCoKe(Integer khoId, boolean kiemCoKe) {
        if (khoId == null || (kiemCoKe && !khoCoKe(khoId))) return List.of();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT k.lo_hang_id, l.ma_lo, bt.id, bt.ma_sku, k.so_luong_ton,
                       COALESCE((SELECT SUM(GREATEST(t.so_luong, 0)) FROM ton_kho_vi_tri t JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
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

    /** Kho đã khai báo ít nhất một kệ. */
    private boolean khoCoKe(Integer khoId) {
        return !em.createNativeQuery("SELECT 1 FROM vi_tri_kho WHERE kho_id = :kho LIMIT 1")
                .setParameter("kho", khoId).getResultList().isEmpty();
    }

    /**
     * Đưa {@code soLuong} hàng chưa có kệ của lô lên kệ {@code viTriId} cùng kho. Kệ phải đang hoạt động, còn sức chứa,
     * không đang kiểm kê. Lô chưa có kệ chính thì nhận kệ này làm kệ của lô.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void xepKe(Integer khoId, Integer loId, Integer viTriId, int soLuong) {
        if (soLuong <= 0) throw new CommonException(ThongDiep.of("khoVanHanh.soLuongXepKePhaiDuong"));
        guard.giuKho(khoId);
        TonKhoTheoLo ton = khoaTonLo(khoId, loId);
        ViTriKho viTri = keCuaKho(khoId, viTriId);
        guard.kiemTraNhapKe(khoId, viTriId, List.of(loId), "xếp hàng lên kệ");
        List<TonKhoViTri> dong = khoaDong(khoId, loId);
        int tongKe = dong.stream().mapToInt(t -> Math.max(0, t.getSoLuong() == null ? 0 : t.getSoLuong())).sum();
        int chuaCoKe = soNguyen(ton.getSoLuongTon()) - tongKe;
        if (soLuong > chuaCoKe) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.loChiConChuaCoKe", ton.getLoHang().getMaLo(), Math.max(0, chuaCoKe)));
        }
        int giuChua = phanBoKeService == null ? 0 : phanBoKeService.giuChuaCoKe(khoId, loId, null);
        if (giuChua > 0 && soLuong > chuaCoKe - giuChua) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.loChuaCoKeDangPhanBoNhat",
                    ton.getLoHang().getMaLo(), giuChua, Math.max(0, chuaCoKe - giuChua)));
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
        if (soLuong <= 0) throw new CommonException(ThongDiep.of("khoVanHanh.soLuongChuyenKePhaiDuong"));
        if (tuViTriId == null || denViTriId == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("khoVanHanh.keDaChonKhongTimThay"));
        }
        if (Objects.equals(tuViTriId, denViTriId)) throw new CommonException(ThongDiep.of("khoVanHanh.chonKeDenKhacKeDangChua"));
        guard.giuKho(khoId);
        TonKhoTheoLo ton = khoaTonLo(khoId, loId);
        // Khóa hai kệ theo id tăng dần (cùng thứ tự với Chuyển kệ nội bộ nhiều kệ) để hai luồng ngược chiều không chờ vòng
        ViTriKho tu, den;
        if (tuViTriId < denViTriId) {
            tu = keCuaKho(khoId, tuViTriId);
            den = keCuaKho(khoId, denViTriId);
        } else {
            den = keCuaKho(khoId, denViTriId);
            tu = keCuaKho(khoId, tuViTriId);
        }
        guard.kiemTraXuat(khoId, Map.of(loId, BigDecimal.valueOf(soLuong)), Map.of(loId, ton.getSoLuongTon()), "chuyển hàng khỏi kệ");
        if (guard.keDangKiemCuaLo(khoId, loId).contains(tuViTriId)) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.keDangKiemKeChuaChuyen", tu.getMaViTri()));
        }
        guard.kiemTraNhapKe(khoId, denViTriId, List.of(loId), "chuyển hàng lên kệ");
        khoaDong(khoId, loId);
        TonKhoViTri nguon = tonKhoViTriRepository.khoaTheoKeVaLo(tuViTriId, loId)
                .orElseThrow(() -> new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.keKhongCoLoNay", tu.getMaViTri())));
        int co = nguon.getSoLuong() == null ? 0 : nguon.getSoLuong();
        if (co < soLuong) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.keChiConSanPhamCuaLo", tu.getMaViTri(), Math.max(0, co)));
        }
        int giuO = phanBoKeService == null ? 0 : phanBoKeService.giuTrenKeCuaLo(khoId, loId).getOrDefault(tuViTriId, 0);
        if (giuO > 0 && soLuong > co - giuO) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.keCoSanPhamDangPhanBoNhat", tu.getMaViTri(), giuO, Math.max(0, co - giuO)));
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
        if (ids.isEmpty()) throw new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("khoVanHanh.khoKhongCoLoDaChon"));
        TonKhoTheoLo ton = tonKhoTheoLoRepository.lockLotsForUpdateByIds(ids).get(0);
        em.refresh(ton, LockModeType.PESSIMISTIC_WRITE);
        return ton;
    }

    private ViTriKho keCuaKho(Integer khoId, Integer viTriId) {
        ViTriKho viTri = viTriKhoRepository.khoaTheoId(viTriId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("khoVanHanh.keDaChonKhongTimThay")));
        if (viTri.getKho() == null || !khoId.equals(viTri.getKho().getId())) {
            throw new CommonException(HttpStatus.FORBIDDEN, ThongDiep.of("khoVanHanh.keKhongThuocKho", viTri.getMaViTri()));
        }
        String tt = viTri.getTrangThai();
        if (tt != null && !IKiemKe.KE_HOAT_DONG.equals(tt) && !IKiemKe.KE_DAY_HANG.equals(tt)) {
            throw new CommonException(HttpStatus.CONFLICT, IKiemKe.KE_KHOA_KIEM_KE.equals(tt)
                    ? ThongDiep.of("khoVanHanh.keDangKiemKe", viTri.getMaViTri())
                    : ThongDiep.of("khoVanHanh.keDangBaoTri", viTri.getMaViTri()));
        }
        return viTri;
    }

    private void kiemTraSucChua(ViTriKho viTri, int them) {
        Integer sucChua = viTri.getSucChuaToiDa();
        if (sucChua == null || sucChua <= 0) return;
        Integer dang = tonKhoViTriRepository.sumDangChuaByViTriId(viTri.getId());
        int dangChua = dang == null ? 0 : dang;
        if (dangChua + them > sucChua) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("khoVanHanh.keConChoCho", viTri.getMaViTri(), Math.max(0, sucChua - dangChua)));
        }
    }
}
