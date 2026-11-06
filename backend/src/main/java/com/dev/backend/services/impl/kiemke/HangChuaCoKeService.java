package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.dto.kiemke.KiemKeDto;
import com.dev.backend.dto.kiemke.KiemKeYeuCau;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.Kho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.utils.KhoDangChon;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Màn Hàng chưa có kệ: danh sách lô còn hàng chưa có kệ ở kho kèm kệ gợi ý ({@link ChonKeGoiY}) và chứng từ đưa hàng vào
 * kho, số đếm (menu, dòng nhắc trên chứng từ), và xếp nhiều lô một lượt. Phần ghi sổ kệ vẫn ở {@link SoTonKeService#xepKe}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HangChuaCoKeService {

    /** Số phần tối đa của một lượt xếp nhiều lô. */
    static final int TOI_DA_MOT_LUOT = 200;
    /** Cỡ lô của câu IN (...) khi tra chứng từ nhập. */
    private static final int CO_LO_IN = 500;

    static final String NGUON_CHUYEN_KHO = "CHUYEN_KHO",
            NGUON_HUY_CHUYEN_KHO = "HUY_CHUYEN_KHO",
            NGUON_KHACH_TRA = "KHACH_TRA",
            NGUON_NHA_CUNG_CAP = "NHA_CUNG_CAP",
            NGUON_KHAC = "KHAC";

    /** Cùng chứng từ: theo mã lô, rồi id lô. */
    private static final Comparator<SoTonKeService.HangChuaCoKe> THEO_MA_LO = Comparator.comparing(
            (SoTonKeService.HangChuaCoKe h) -> h.maLo() == null ? "" : h.maLo()).thenComparing(SoTonKeService.HangChuaCoKe::loHangId);

    @PersistenceContext
    private EntityManager em;

    private final SoTonKeService soTonKe;
    private final KhoaKiemKeGuard guard;
    private final KhoRepository khoRepo;
    private final PhanBoKeService phanBoKe;

    // ───────────────────────────── Đọc ─────────────────────────────

    /**
     * Lô còn hàng chưa có kệ ở kho theo thứ tự hiển thị (chứng từ mới nhất trước, không rõ chứng từ ở cuối). Gợi ý tính
     * lần lượt theo đúng thứ tự đó để các lô liền nhau không cùng được gợi ý vào một kệ không đủ chỗ cho tất cả.
     */
    @Transactional(readOnly = true)
    public List<KiemKeDto.HangChuaCoKe> danhSach(Integer khoId) {
        kiemTraXemKho(khoId);
        List<SoTonKeService.HangChuaCoKe> ds = soTonKe.hangChuaCoKe(khoId);
        if (ds.isEmpty()) return List.of();

        List<Integer> loIds = ds.stream().map(SoTonKeService.HangChuaCoKe::loHangId).toList();
        Map<Integer, KiemKeDto.NguonNhap> nguon = nguonNhap(khoId, loIds);
        List<SoTonKeService.HangChuaCoKe> theoThuTu = new ArrayList<>(ds);
        theoThuTu.sort(Comparator.comparing((SoTonKeService.HangChuaCoKe h) -> ngayNguon(nguon.get(h.loHangId())), Comparator.reverseOrder())
                .thenComparing(h -> phieuNhapId(nguon.get(h.loHangId())), Comparator.reverseOrder())
                .thenComparing(THEO_MA_LO));

        Map<Integer, BienTheSanPham> bienThe = bienThe(ds);
        KhoaKiemKeGuard.TrangThaiKhoa khoa = guard.trangThai(khoId);
        Set<Integer> loDangKiemKe = loDangKiemKe(khoa, loIds);
        ChonKeGoiY chonKe = new ChonKeGoiY(keCuaKho(khoId), soKeCuaKho(khoId), khoa::capDangKhoa);
        // Phần phiếu nhặt giữ chỉ tính cho lô có phiếu nhặt mở / phiếu xuất chờ (mỗi lô vài câu truy vấn)
        Set<Integer> coTheDangGiu = phanBoKe.loCoTheDangGiu(khoId);

        List<KiemKeDto.HangChuaCoKe> kq = new ArrayList<>(ds.size());
        for (SoTonKeService.HangChuaCoKe h : theoThuTu) {
            BienTheSanPham bt = bienThe.get(h.bienTheId());
            Integer sanPhamId = bt == null || bt.getSanPham() == null ? null : bt.getSanPham().getId();
            int giuNhat = coTheDangGiu.contains(h.loHangId())
                    ? Math.min(h.chuaCoKe(), phanBoKe.giuChuaCoKe(khoId, h.loHangId(), null)) : 0;
            boolean dangKiemKe = loDangKiemKe.contains(h.loHangId());
            ChonKeGoiY.KetQua goiY = chonKe.chon(h.loHangId(), h.bienTheId(), sanPhamId, h.keChinhId(),
                    h.chuaCoKe() - giuNhat, dangKiemKe);
            kq.add(new KiemKeDto.HangChuaCoKe(h.loHangId(), h.maLo(), KiemKeDocService.sanPham(bt), h.tonLo(), h.trenKe(),
                    h.chuaCoKe(), giuNhat, dangKiemKe, goiYDto(goiY.goiY()),
                    goiY.lienQuan().stream().map(HangChuaCoKeService::lienQuanDto).toList(), nguon.get(h.loHangId())));
        }
        return kq;
    }

    /**
     * Số lô và tổng sản phẩm chưa có kệ ở kho: số đếm trên menu, hoặc (truyền {@code phieuChuyenId} / {@code phieuNhapId})
     * chỉ hàng có chứng từ nhập gần nhất là chứng từ đó — dòng nhắc "Xếp kệ" trên phiếu chuyển kho, phiếu nhập.
     */
    @Transactional(readOnly = true)
    public KiemKeDto.DemChuaCoKe dem(Integer khoId, Integer phieuChuyenId, Integer phieuNhapId) {
        kiemTraXemKho(khoId);
        List<SoTonKeService.HangChuaCoKe> ds = soTonKe.hangChuaCoKe(khoId);
        if (!ds.isEmpty() && (phieuChuyenId != null || phieuNhapId != null)) {
            Map<Integer, KiemKeDto.NguonNhap> nguon = nguonNhap(khoId, ds.stream().map(SoTonKeService.HangChuaCoKe::loHangId).toList());
            ds = ds.stream().filter(h -> {
                KiemKeDto.NguonNhap n = nguon.get(h.loHangId());
                return n != null && (phieuChuyenId == null || phieuChuyenId.equals(n.phieuChuyenId()))
                        && (phieuNhapId == null || phieuNhapId.equals(n.phieuNhapId()));
            }).toList();
        }
        return new KiemKeDto.DemChuaCoKe(ds.size(), ds.stream().mapToLong(SoTonKeService.HangChuaCoKe::chuaCoKe).sum());
    }

    private void kiemTraXemKho(Integer khoId) {
        if (khoId == null) throw new CommonException("Chọn kho");
        Kho kho = khoRepo.findById(khoId).orElseThrow(() -> KiemKePhamViService.phamViSai("Không tìm thấy kho"));
        KhoDangChon.kiemTraXem(kho, "Kho " + kho.getTenKho());
    }

    /** Lô cả lô đang thuộc đợt kiểm kê của kho: đợt toàn kho, hoặc danh mục của lô đang kiểm (KhoaKiemKeGuard.kiemTraNhapKe). */
    private Set<Integer> loDangKiemKe(KhoaKiemKeGuard.TrangThaiKhoa khoa, List<Integer> loIds) {
        if (khoa.trong()) return Set.of();
        if (khoa.dotToanKho != null) return new HashSet<>(loIds);
        if (khoa.danhMuc.isEmpty()) return Set.of();
        return guard.danhMucCuaLo(loIds).entrySet().stream()
                .filter(e -> khoa.danhMuc.containsKey(e.getValue()))
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
    }

    private Map<Integer, BienTheSanPham> bienThe(List<SoTonKeService.HangChuaCoKe> ds) {
        return em.createQuery("SELECT b FROM BienTheSanPham b LEFT JOIN FETCH b.sanPham WHERE b.id IN :ids", BienTheSanPham.class)
                .setParameter("ids", ds.stream().map(SoTonKeService.HangChuaCoKe::bienTheId).distinct().toList())
                .getResultList().stream().collect(Collectors.toMap(BienTheSanPham::getId, b -> b));
    }

    /** Mọi kệ của kho kèm số đang chứa (cùng cách tính với SoTonKeService.kiemTraSucChua). */
    private List<ChonKeGoiY.Ke> keCuaKho(Integer khoId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT v.id, v.ma_vi_tri, v.trang_thai, v.suc_chua_toi_da,
                       COALESCE((SELECT SUM(t.so_luong) FROM ton_kho_vi_tri t WHERE t.vi_tri_kho_id = v.id), 0)
                  FROM vi_tri_kho v
                 WHERE v.kho_id = :kho
                """).setParameter("kho", khoId).getResultList();
        return rows.stream().map(r -> new ChonKeGoiY.Ke(so(r[0]), (String) r[1], (String) r[2],
                r[3] == null ? null : so(r[3]), so(r[4]))).toList();
    }

    /** Các dòng sổ kệ có hàng của kho, kèm biến thể và sản phẩm để tìm kệ cùng SKU, cùng mẫu. */
    private List<ChonKeGoiY.DongKe> soKeCuaKho(Integer khoId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT t.vi_tri_kho_id, t.lo_hang_id, t.bien_the_san_pham_id, bt.san_pham_id, t.so_luong
                  FROM ton_kho_vi_tri t
                  JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
                  JOIN bien_the_san_pham bt ON bt.id = t.bien_the_san_pham_id
                 WHERE v.kho_id = :kho AND t.so_luong > 0
                """).setParameter("kho", khoId).getResultList();
        return rows.stream().map(r -> new ChonKeGoiY.DongKe(so(r[0]), so(r[1]), so(r[2]), r[3] == null ? null : so(r[3]),
                so(r[4]))).toList();
    }

    /** Phiếu nhập hoàn tất gần nhất của mỗi lô vào kho (nhận chuyển kho, hoàn trả, khách trả, nhà cung cấp). */
    private Map<Integer, KiemKeDto.NguonNhap> nguonNhap(Integer khoId, List<Integer> loIds) {
        Map<Integer, KiemKeDto.NguonNhap> kq = new HashMap<>();
        for (int i = 0; i < loIds.size(); i += CO_LO_IN) {
            List<Integer> lo = loIds.subList(i, Math.min(loIds.size(), i + CO_LO_IN));
            @SuppressWarnings("unchecked")
            List<Object[]> rows = em.createNativeQuery("""
                    SELECT ct.lo_hang_id, pn.id, pn.so_phieu_nhap, COALESCE(pn.ngay_nhap, pn.ngay_tao),
                           pck.id, pck.so_phieu_chuyen, kx.ten_kho, ncc.ten_nha_cung_cap, nd.ho_ten
                      FROM chi_tiet_phieu_nhap_kho ct
                      JOIN phieu_nhap_kho pn ON pn.id = ct.phieu_nhap_kho_id
                      LEFT JOIN phieu_chuyen_kho pck ON pck.id = pn.phieu_chuyen_kho_id
                      LEFT JOIN kho kx ON kx.id = pck.kho_xuat_id
                      LEFT JOIN nha_cung_cap ncc ON ncc.id = pn.nha_cung_cap_id
                      LEFT JOIN nguoi_dung nd ON nd.id = pn.nguoi_nhap_id
                     WHERE pn.kho_id = :kho AND pn.trang_thai = :hoanTat AND ct.lo_hang_id IN (:lo)
                     ORDER BY ct.lo_hang_id, COALESCE(pn.ngay_nhap, pn.ngay_tao) DESC, pn.id DESC
                    """)
                    .setParameter("kho", khoId)
                    .setParameter("hoanTat", TrangThaiPhieuNhap.COMPLETED.getValue())
                    .setParameter("lo", lo)
                    .getResultList();
            for (Object[] r : rows) kq.putIfAbsent(so(r[0]), nguonDto(r));
        }
        return kq;
    }

    /**
     * Một dòng của {@link #nguonNhap} → chứng từ. Tiền tố PN-RET- dùng chung cho khách trả và hàng về lại kho xuất khi
     * phiếu chuyển bị hủy lúc đang đi đường; phân biệt bằng phiếu chuyển kho gắn với phiếu nhập.
     */
    static KiemKeDto.NguonNhap nguonDto(Object[] r) {
        String soPhieu = (String) r[2];
        Integer phieuChuyenId = r[4] == null ? null : so(r[4]);
        String ncc = (String) r[7];
        boolean hoanTra = soPhieu != null && soPhieu.startsWith(IChuyenKho.TIEN_TO_NHAP_HOAN_TRA);
        String loai = hoanTra ? (phieuChuyenId != null ? NGUON_HUY_CHUYEN_KHO : NGUON_KHACH_TRA)
                : phieuChuyenId != null ? NGUON_CHUYEN_KHO
                : ncc != null ? NGUON_NHA_CUNG_CAP : NGUON_KHAC;
        String tuDau = NGUON_CHUYEN_KHO.equals(loai) ? (String) r[6] : NGUON_NHA_CUNG_CAP.equals(loai) ? ncc : null;
        return new KiemKeDto.NguonNhap(so(r[1]), soPhieu, loai, tuDau, phieuChuyenId, (String) r[5], thoiDiem(r[3]),
                (String) r[8]);
    }

    private static KiemKeDto.GoiYKe goiYDto(ChonKeGoiY.UngVien u) {
        return u == null ? null : new KiemKeDto.GoiYKe(u.ke().id(), u.ke().ma(), u.lyDo(), u.conCho());
    }

    private static KiemKeDto.KeLienQuan lienQuanDto(ChonKeGoiY.UngVien u) {
        return new KiemKeDto.KeLienQuan(u.ke().id(), u.ke().ma(), u.lyDo(), u.chan());
    }

    private static Instant ngayNguon(KiemKeDto.NguonNhap n) {
        return n == null || n.ngay() == null ? Instant.EPOCH : n.ngay();
    }

    private static int phieuNhapId(KiemKeDto.NguonNhap n) {
        return n == null || n.phieuNhapId() == null ? 0 : n.phieuNhapId();
    }

    private static int so(Object o) {
        return ((Number) o).intValue();
    }

    private static Instant thoiDiem(Object o) {
        if (o == null) return null;
        if (o instanceof Instant i) return i;
        if (o instanceof Timestamp t) return t.toInstant();
        if (o instanceof LocalDateTime l) return Timestamp.valueOf(l).toInstant();
        if (o instanceof OffsetDateTime d) return d.toInstant();
        return null;
    }

    // ───────────────────────────── Xếp nhiều lô ─────────────────────────────

    /**
     * Xếp từng phần một, mỗi phần một giao dịch riêng ({@link SoTonKeService#xepKe} qua proxy): phần lỗi (kệ vừa hết
     * chỗ, vừa khóa kiểm kê, số chưa có kệ vừa đổi) chỉ báo riêng, các phần khác vẫn ghi. Không chạy trong giao dịch.
     */
    public List<KiemKeDto.KetQuaXepKe> xepNhieu(Integer khoId, KiemKeYeuCau.XepNhieu yc) {
        List<KiemKeYeuCau.XepKe> ds = yc == null || yc.ds() == null ? List.of() : yc.ds();
        if (ds.isEmpty()) throw new CommonException("Chọn ít nhất một lô để xếp kệ");
        if (ds.size() > TOI_DA_MOT_LUOT) {
            throw new CommonException("Mỗi lượt xếp tối đa " + TOI_DA_MOT_LUOT + " phần; chia làm nhiều lượt");
        }
        List<KiemKeDto.KetQuaXepKe> kq = new ArrayList<>(ds.size());
        for (KiemKeYeuCau.XepKe p : ds) {
            int sl = p == null || p.soLuong() == null ? 0 : p.soLuong();
            Integer loId = p == null ? null : p.loHangId();
            Integer keId = p == null ? null : p.viTriKhoId();
            kq.add(xepMotPhan(khoId, loId, keId, sl));
        }
        return kq;
    }

    private KiemKeDto.KetQuaXepKe xepMotPhan(Integer khoId, Integer loId, Integer keId, int sl) {
        if (loId == null || keId == null) return new KiemKeDto.KetQuaXepKe(loId, keId, sl, false, "Thiếu lô hoặc kệ");
        // Bộ nhớ phiên dùng chung cả yêu cầu (open-in-view): bỏ thực thể của phần trước để phần này đọc lại kệ, tồn lô mới nhất
        em.clear();
        try {
            soTonKe.xepKe(khoId, loId, keId, sl);
            return new KiemKeDto.KetQuaXepKe(loId, keId, sl, true, null);
        } catch (CommonException | LoiCoMaException e) {
            return new KiemKeDto.KetQuaXepKe(loId, keId, sl, false, e.getMessage());
        } catch (RuntimeException e) {
            log.error("[XEP-KE] Kho {} lô {} kệ {}: lỗi khi xếp", khoId, loId, keId, e);
            return new KiemKeDto.KetQuaXepKe(loId, keId, sl, false, "Chưa xếp được do lỗi hệ thống. Thử lại sau giây lát.");
        }
    }
}
