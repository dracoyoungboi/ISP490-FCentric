package com.dev.backend.services.impl.trahang;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.trahang.TraHangDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.PosCatalogService;
import com.dev.backend.utils.PublicAssetUrl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Phần ĐỌC của trả hàng tại quầy (đặc tả BA bước 1–2): tìm hóa đơn gốc theo mã hoặc số điện thoại, dựng khối thông
 * tin đơn + bảng dòng hàng, biên bản trả. Kèm các hàm kiểm dùng chung với {@link TraHangTaiQuayTransaction} và
 * {@link DuyetTraHangService}. Không phụ thuộc hai lớp đó (tránh vòng bean).
 */
@Service
public class TraHangTaiQuayService {

    public static final String TRA_MOT_PHAN = "tra_mot_phan";
    public static final String DA_TRA_HET = "da_tra_het";
    private static final int TOI_DA_KET_QUA_TIM = 20;

    @Autowired
    private EntityManager em;
    @Autowired
    private PosCatalogService posCatalogService;
    @Autowired
    private PhieuTraHangRepository phieuTraHangRepository;
    @Autowired
    private ChiTietPhieuTraHangRepository chiTietRepository;
    @Autowired
    private YeuCauDuyetTraHangRepository yeuCauRepository;
    @Autowired
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;

    // ================= Bước 1: tra cứu =================

    /**
     * Tìm hóa đơn POS đã thanh toán theo mã hóa đơn (khớp đúng) hoặc số điện thoại khách (mới nhất trước, tối đa 20).
     * Không thấy → MSG-RET-01.
     */
    @Transactional(readOnly = true)
    public List<TraHangDto.DonTomTat> tim(String q, Integer khoNhanId) {
        posCatalogService.authorizeWarehouse(khoNhanId);
        String tuKhoa = q == null ? "" : q.trim();
        if (tuKhoa.isEmpty()) throw khongTimThay();
        List<DonBanHang> ds = new ArrayList<>();
        DonBanHang theoMa = em.createQuery("select d from DonBanHang d where d.soDonHang = :ma", DonBanHang.class)
                .setParameter("ma", tuKhoa.toUpperCase(Locale.ROOT)).getResultStream().findFirst().orElse(null);
        if (theoMa != null && laDonHopLe(theoMa)) {
            ds.add(theoMa);
        } else {
            String so = tuKhoa.replaceAll("[\\s.\\-]", "");
            if (so.matches("\\+?\\d{8,15}")) {
                if (so.startsWith("+84")) so = "0" + so.substring(3);
                @SuppressWarnings("unchecked")
                List<Number> ids = em.createNativeQuery("""
                        SELECT d.id FROM don_ban_hang d
                          JOIN khach_hang k ON k.id = d.khach_hang_id
                         WHERE REPLACE(REPLACE(REPLACE(k.so_dien_thoai, ' ', ''), '.', ''), '-', '') = :sdt
                           AND d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai = 5
                           AND d.trang_thai_thanh_toan = 'da_thanh_toan'
                           AND EXISTS (SELECT 1 FROM pos_payment p WHERE p.don_ban_hang_id = d.id)
                         ORDER BY COALESCE(d.ngay_giao_hang, d.ngay_dat_hang) DESC, d.id DESC
                         LIMIT 20
                        """).setParameter("sdt", so).getResultList();
                for (Number id : ids) ds.add(em.find(DonBanHang.class, id.intValue()));
            }
        }
        if (ds.isEmpty()) throw khongTimThay();
        Instant bayGio = Instant.now();
        List<TraHangDto.DonTomTat> kq = new ArrayList<>();
        for (DonBanHang d : ds.subList(0, Math.min(ds.size(), TOI_DA_KET_QUA_TIM))) {
            KhachHang kh = d.getKhachHang();
            String tt = trangThaiTraHang(d.getId());
            kq.add(new TraHangDto.DonTomTat(d.getId(), d.getSoDonHang(), thanhToanLuc(d),
                    d.getKhoXuat() == null ? null : d.getKhoXuat().getTenKho(), d.getTongCong(),
                    kh == null ? null : kh.getTenKhachHang(), kh == null ? null : TraHangQuyTac.cheSoDienThoai(kh.getSoDienThoai()),
                    tt, !DA_TRA_HET.equals(tt), TraHangQuyTac.quaHan(thanhToanLuc(d), bayGio)));
        }
        return kq;
    }

    /** Khối thông tin đơn gốc + bảng dòng hàng cho cửa hàng nhận {@code khoNhanId} (đặc tả BA mục V.1–V.2). */
    @Transactional(readOnly = true)
    public TraHangDto.DonGoc donGoc(Integer donId, Integer khoNhanId) {
        posCatalogService.authorizeWarehouse(khoNhanId);
        DonBanHang don = donId == null ? null : em.find(DonBanHang.class, donId);
        kiemDonHopLe(don);
        Kho khoNhan = em.find(Kho.class, khoNhanId);
        Instant bayGio = Instant.now();
        Instant thanhToan = thanhToanLuc(don);
        boolean quaHan = TraHangQuyTac.quaHan(thanhToan, bayGio);

        Map<Integer, BigDecimal> daTra = daTraTheoDong(don.getId());
        Map<Integer, BigDecimal> daHoan = daHoanTheoDong(don.getId());
        List<Integer> bienTheIds = don.getChiTietDonBanHangs().stream().map(c -> c.getBienTheSanPham().getId()).toList();
        Map<Integer, Integer> keGoiY = keGoiY(khoNhanId, bienTheIds);
        List<TraHangDto.Dong> dong = new ArrayList<>();
        for (ChiTietDonBanHang ct : don.getChiTietDonBanHangs()) {
            BienTheSanPham bt = ct.getBienTheSanPham();
            BigDecimal tra = daTra.getOrDefault(ct.getId(), BigDecimal.ZERO);
            String anh = bt.getAnhBienThe() != null && bt.getAnhBienThe().getTepTin() != null
                    ? PublicAssetUrl.toHttps(bt.getAnhBienThe().getTepTin().getDuongDan()) : null;
            dong.add(new TraHangDto.Dong(ct.getId(), bt.getId(), bt.getMaSku(),
                    bt.getSanPham() == null ? bt.getMaSku() : bt.getSanPham().getTenSanPham(),
                    bt.getMauSac() == null ? null : bt.getMauSac().getTenMau(),
                    bt.getSize() == null ? null : bt.getSize().getTenSize(), anh,
                    ct.getSoLuongDat(), tra, ct.getSoLuongDat().subtract(tra).max(BigDecimal.ZERO), ct.getDonGia(),
                    TraHangQuyTac.donGiaThucTra(ct.getThanhTien(), ct.getTienGiamGia(), ct.getSoLuongDat()),
                    keGoiY.get(bt.getId()),
                    TraHangQuyTac.tienHoan(ct.getThanhTien(), ct.getTienGiamGia(), ct.getSoLuongDat(), tra,
                            daHoan.getOrDefault(ct.getId(), BigDecimal.ZERO), ct.getSoLuongDat().subtract(tra).max(BigDecimal.ZERO))));
        }

        List<TraHangDto.Ke> ke = keCuaKho(khoNhanId);
        KhachHang kh = don.getKhachHang();
        List<TraHangDto.PhieuDaTra> daCo = phieuTraHangRepository.findByDonBanHangIdOrderByIdAsc(don.getId()).stream()
                .map(p -> new TraHangDto.PhieuDaTra(p.getId(), p.getSoPhieu(), p.getNgayTao(), p.getTongTienHoan(),
                        tenKho(p.getKhoNhanId())))
                .toList();
        return new TraHangDto.DonGoc(don.getId(), don.getSoDonHang(), thanhToan,
                thanhToan == null ? null : thanhToan.plus(TraHangQuyTac.HAN_TRA),
                thanhToan == null ? 0 : Math.max(0, Duration.between(thanhToan, bayGio).toDays()), quaHan,
                don.getKhoXuat().getId(), don.getKhoXuat().getTenKho(), khoNhan.getId(), khoNhan.getTenKho(),
                !Objects.equals(don.getKhoXuat().getId(), khoNhan.getId()),
                don.getNguoiTao() == null ? null : tenNguoi(don.getNguoiTao()),
                kh == null ? null : kh.getTenKhachHang(),
                kh == null ? null : TraHangQuyTac.cheSoDienThoai(kh.getSoDienThoai()),
                don.getTongCong(), phuongThucGoc(don.getId()), trangThaiTraHang(don.getId()),
                !ke.isEmpty(), ke, dong, quaHan ? duyetHieuLuc(don.getId(), khoNhanId, bayGio) : null,
                laQuanLyCuaHang(khoNhanId), daCo);
    }

    /** Biên bản trả hàng (in 02 liên): người có quyền ở cửa hàng nhận hoặc cửa hàng bán, hoặc quản trị viên. */
    @Transactional(readOnly = true)
    public TraHangDto.PhieuChiTiet phieu(Integer id) {
        PhieuTraHang p = id == null ? null : phieuTraHangRepository.findById(id).orElse(null);
        if (p == null) throw new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("traHang.phieuKhongTonTai"));
        if (!coQuyenKho(p.getKhoNhanId()) && !coQuyenKho(p.getKhoBanId())) {
            throw new CommonException(HttpStatus.FORBIDDEN, ThongDiep.of("traHang.khongCoQuyenXemPhieu"));
        }
        DonBanHang don = em.find(DonBanHang.class, p.getDonBanHangId());
        KhachHang kh = don.getKhachHang();
        List<TraHangDto.DongPhieu> dong = new ArrayList<>();
        for (ChiTietPhieuTraHang c : chiTietRepository.findByPhieuTraHangIdOrderByIdAsc(p.getId())) {
            BienTheSanPham bt = em.find(BienTheSanPham.class, c.getBienTheSanPhamId());
            ViTriKho ke = c.getViTriKhoId() == null ? null : em.find(ViTriKho.class, c.getViTriKhoId());
            dong.add(new TraHangDto.DongPhieu(bt.getSanPham() == null ? bt.getMaSku() : bt.getSanPham().getTenSanPham(),
                    bt.getMaSku(), bt.getMauSac() == null ? null : bt.getMauSac().getTenMau(),
                    bt.getSize() == null ? null : bt.getSize().getTenSize(), c.getSoLuong(), c.getDonGiaHoan(),
                    c.getThanhTienHoan(), c.getTinhTrang(), ke == null ? null : ke.getMaViTri(), c.getLyDo(),
                    c.getNhomLoi()));
        }
        String soPn = p.getPhieuNhapKhoId() == null ? null
                : em.find(PhieuNhapKho.class, p.getPhieuNhapKhoId()).getSoPhieuNhap();
        NguoiDung lap = em.find(NguoiDung.class, p.getNguoiLapId());
        NguoiDung duyet = p.getNguoiDuyetId() == null ? null : em.find(NguoiDung.class, p.getNguoiDuyetId());
        return new TraHangDto.PhieuChiTiet(p.getId(), p.getSoPhieu(), p.getNgayTao(), soPn, don.getId(),
                don.getSoDonHang(), thanhToanLuc(don), tenKho(p.getKhoBanId()), tenKho(p.getKhoNhanId()),
                !Objects.equals(p.getKhoBanId(), p.getKhoNhanId()),
                kh == null ? null : kh.getTenKhachHang(), kh == null ? null : TraHangQuyTac.cheSoDienThoai(kh.getSoDienThoai()),
                lap == null ? null : tenNguoi(lap), Boolean.TRUE.equals(p.getQuaHan()),
                duyet == null ? null : tenNguoi(duyet), p.getLyDoDuyet(), p.getPhuongThucHoan(), p.getNganHang(),
                cheSoTaiKhoan(p.getSoTaiKhoan()), p.getTenChuTaiKhoan(), p.getMaGiaoDich(), p.getTongSoLuong(),
                p.getSoLuongDat(), p.getSoLuongLoi(), p.getTongTienHoan(), p.getGhiChu(), dong);
    }

    // ================= kiểm dùng chung =================

    /** Lúc thanh toán của hóa đơn POS: ngày giao (= lúc bán tại quầy), thiếu thì ngày đặt. */
    public static Instant thanhToanLuc(DonBanHang d) {
        return d.getNgayGiaoHang() != null ? d.getNgayGiaoHang() : d.getNgayDatHang();
    }

    /** GBR-RET-01: chỉ nhận trả hóa đơn bán tại quầy đã hoàn tất thanh toán. Không đạt → MSG-RET-01. */
    public void kiemDonHopLe(DonBanHang don) {
        if (don == null || !laDonHopLe(don)) throw khongTimThay();
    }

    private boolean laDonHopLe(DonBanHang d) {
        return "don_ban_hang".equals(d.getLoaiChungTu())
                && Integer.valueOf(ITrangThaiDonBanHang.HOAN_THANH).equals(d.getTrangThai())
                && "da_thanh_toan".equals(d.getTrangThaiThanhToan())
                && d.getKhoXuat() != null
                && !em.createNativeQuery("SELECT 1 FROM pos_payment WHERE don_ban_hang_id = :id LIMIT 1")
                .setParameter("id", d.getId()).getResultList().isEmpty();
    }

    private static CommonException khongTimThay() {
        return new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("traHang.khongTimThayDon"));
    }

    public Map<Integer, BigDecimal> daTraTheoDong(Integer donId) {
        Map<Integer, BigDecimal> m = new HashMap<>();
        for (Object[] r : chiTietRepository.daTraTheoDong(donId)) m.put((Integer) r[0], (BigDecimal) r[1]);
        return m;
    }

    public Map<Integer, BigDecimal> daHoanTheoDong(Integer donId) {
        Map<Integer, BigDecimal> m = new HashMap<>();
        for (Object[] r : chiTietRepository.daHoanTheoDong(donId)) m.put((Integer) r[0], (BigDecimal) r[1]);
        return m;
    }

    public String trangThaiTraHang(Integer donId) {
        List<?> r = em.createNativeQuery("SELECT trang_thai_tra_hang FROM don_ban_hang WHERE id = :id")
                .setParameter("id", donId).getResultList();
        return r.isEmpty() || r.get(0) == null ? null : String.valueOf(r.get(0));
    }

    /** Kệ đang hoạt động (kể cả kệ báo đầy — xếp kệ tự kiểm sức chứa) của kho, theo mã. */
    public List<TraHangDto.Ke> keCuaKho(Integer khoId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT id, ma_vi_tri FROM vi_tri_kho
                 WHERE kho_id = :kho AND (trang_thai IS NULL OR trang_thai IN (:hd, :day))
                 ORDER BY ma_vi_tri
                """).setParameter("kho", khoId).setParameter("hd", IKiemKe.KE_HOAT_DONG)
                .setParameter("day", IKiemKe.KE_DAY_HANG).getResultList();
        return rows.stream().map(r -> new TraHangDto.Ke(((Number) r[0]).intValue(), (String) r[1])).toList();
    }

    public Set<Integer> keHoatDongCuaKho(Integer khoId) {
        Set<Integer> s = new HashSet<>();
        keCuaKho(khoId).forEach(k -> s.add(k.id()));
        return s;
    }

    /** Kho có khai báo kệ (kho không quản lý kệ thì không bắt chọn kệ). */
    public boolean khoCoKe(Integer khoId) {
        return !em.createNativeQuery("SELECT 1 FROM vi_tri_kho WHERE kho_id = :kho LIMIT 1")
                .setParameter("kho", khoId).getResultList().isEmpty();
    }

    /** Kệ đang chứa mã nhiều nhất ở kho (gợi ý chọn sẵn cho hàng Đạt): bienTheId → viTriId. */
    private Map<Integer, Integer> keGoiY(Integer khoId, Collection<Integer> bienTheIds) {
        Map<Integer, Integer> m = new HashMap<>();
        if (bienTheIds.isEmpty()) return m;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT t.bien_the_san_pham_id, t.vi_tri_kho_id, SUM(t.so_luong) AS sl
                  FROM ton_kho_vi_tri t JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
                 WHERE v.kho_id = :kho AND t.bien_the_san_pham_id IN (:bt) AND t.so_luong > 0
                   AND (v.trang_thai IS NULL OR v.trang_thai IN (:hd, :day))
                 GROUP BY t.bien_the_san_pham_id, t.vi_tri_kho_id
                 ORDER BY sl DESC
                """).setParameter("kho", khoId).setParameter("bt", bienTheIds)
                .setParameter("hd", IKiemKe.KE_HOAT_DONG).setParameter("day", IKiemKe.KE_DAY_HANG).getResultList();
        for (Object[] r : rows) m.putIfAbsent(((Number) r[0]).intValue(), ((Number) r[1]).intValue());
        return m;
    }

    /**
     * "Quản lý cửa hàng" (Store Manager) của kho: quản trị viên, hoặc quản lý kho có phân quyền hiệu lực ở kho đó. Hệ
     * thống chưa có vai trò cửa hàng trưởng riêng.
     */
    public boolean laQuanLyCuaHang(Integer khoId) {
        NguoiDungAuthInfo u = SecurityContextHolder.getUser();
        if (u == null || u.getVaiTro() == null) return false;
        if (u.getVaiTro().contains(IRoleType.quan_tri_vien)) return true;
        return u.getVaiTro().contains(IRoleType.quan_ly_kho)
                && phanQuyenNguoiDungKhoRepository.coHieuLucTaiKho(u.getId(), khoId, Instant.now());
    }

    private boolean coQuyenKho(Integer khoId) {
        NguoiDungAuthInfo u = SecurityContextHolder.getUser();
        if (u == null) return false;
        if (u.getVaiTro() != null && u.getVaiTro().contains(IRoleType.quan_tri_vien)) return true;
        return khoId != null && phanQuyenNguoiDungKhoRepository.coHieuLucTaiKho(u.getId(), khoId, Instant.now());
    }

    private TraHangDto.DuyetHieuLuc duyetHieuLuc(Integer donId, Integer khoId, Instant bayGio) {
        NguoiDungAuthInfo u = SecurityContextHolder.getUser();
        if (u == null) return null;
        return yeuCauRepository.findByDonBanHangIdAndTrangThaiIn(donId, List.of(YeuCauDuyetTraHang.DA_DUYET)).stream()
                .filter(y -> Objects.equals(y.getKhoId(), khoId) && Objects.equals(y.getNguoiYeuCauId(), u.getId())
                        && y.getDuyetLuc() != null && y.getDuyetLuc().plus(TraHangQuyTac.HIEU_LUC_DUYET).isAfter(bayGio))
                .max(Comparator.comparing(YeuCauDuyetTraHang::getDuyetLuc))
                .map(y -> {
                    NguoiDung nd = y.getNguoiDuyetId() == null ? null : em.find(NguoiDung.class, y.getNguoiDuyetId());
                    return new TraHangDto.DuyetHieuLuc(y.getId(), nd == null ? null : tenNguoi(nd),
                            y.getDuyetLuc().plus(TraHangQuyTac.HIEU_LUC_DUYET));
                })
                .orElse(null);
    }

    /** Phương thức thanh toán gốc: CASH | PAYOS | KET_HOP (tiền mặt + QR). */
    private String phuongThucGoc(Integer donId) {
        @SuppressWarnings("unchecked")
        List<Object[]> r = em.createNativeQuery("""
                SELECT phuong_thuc, tien_mat_truoc FROM pos_payment WHERE don_ban_hang_id = :id ORDER BY id DESC LIMIT 1
                """).setParameter("id", donId).getResultList();
        if (r.isEmpty()) return null;
        String pt = String.valueOf(r.get(0)[0]);
        if ("PAYOS".equals(pt) && r.get(0)[1] != null && ((BigDecimal) r.get(0)[1]).signum() > 0) return "KET_HOP";
        return pt;
    }

    public String tenKho(Integer khoId) {
        Kho k = khoId == null ? null : em.find(Kho.class, khoId);
        return k == null ? null : k.getTenKho();
    }

    public static String tenNguoi(NguoiDung nd) {
        return nd.getHoTen() != null && !nd.getHoTen().isBlank() ? nd.getHoTen().trim() : nd.getTenDangNhap();
    }

    /** Biên bản giao khách: chỉ hiện 4 số cuối tài khoản nhận hoàn. */
    private static String cheSoTaiKhoan(String stk) {
        if (stk == null || stk.length() <= 4) return stk;
        return "•••• " + stk.substring(stk.length() - 4);
    }
}
