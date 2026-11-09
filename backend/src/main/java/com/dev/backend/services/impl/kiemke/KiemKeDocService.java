package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.kiemke.KiemKeDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.*;
import com.dev.backend.utils.HienThiBienThe;
import com.dev.backend.utils.KhoDangChon;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import com.dev.backend.i18n.NgonNgu;
import com.dev.backend.i18n.ThongDiep;

/** Phần đọc của kiểm kê khoanh vùng: danh sách, chi tiết, dòng, nhật ký, sơ đồ khóa (hàng chưa có kệ ở HangChuaCoKeService). */
@Service
@Transactional(readOnly = true)
public class KiemKeDocService {

    @PersistenceContext
    private EntityManager em;

    private final DotKiemKeRepository dotRepo;
    private final ChiTietKiemKeRepository dongRepo;
    private final DotKiemKeViTriRepository dotViTriRepo;
    private final DotKiemKeKhuVucRepository dotKhuVucRepo;
    private final DotKiemKeDanhMucRepository dotDanhMucRepo;
    private final KiemKeLanDemRepository lanDemRepo;
    private final LichSuKiemKeRepository nhatKyRepo;
    private final AnhKiemKeRepository anhRepo;
    private final KhuVucKhoRepository khuVucRepo;
    private final ViTriKhoRepository viTriRepo;
    private final DanhMucQuanAoRepository danhMucRepo;
    private final KhoRepository khoRepo;
    private final PhanQuyenNguoiDungKhoRepository phanQuyenRepo;
    private final ChiTietPhieuDieuChinhRepository dongPhieuRepo;
    private final KiemKeQuyen quyen;
    private final KiemKeSanSang sanSang;
    private final KhoaKiemKeGuard guard;
    private final ObjectMapper objectMapper;

    public KiemKeDocService(DotKiemKeRepository dotRepo, ChiTietKiemKeRepository dongRepo,
                            DotKiemKeViTriRepository dotViTriRepo, DotKiemKeKhuVucRepository dotKhuVucRepo,
                            DotKiemKeDanhMucRepository dotDanhMucRepo, KiemKeLanDemRepository lanDemRepo,
                            LichSuKiemKeRepository nhatKyRepo, AnhKiemKeRepository anhRepo, KhuVucKhoRepository khuVucRepo,
                            ViTriKhoRepository viTriRepo, DanhMucQuanAoRepository danhMucRepo, KhoRepository khoRepo,
                            PhanQuyenNguoiDungKhoRepository phanQuyenRepo, ChiTietPhieuDieuChinhRepository dongPhieuRepo,
                            KiemKeQuyen quyen, KiemKeSanSang sanSang, KhoaKiemKeGuard guard, ObjectMapper objectMapper) {
        this.dotRepo = dotRepo;
        this.dongRepo = dongRepo;
        this.dotViTriRepo = dotViTriRepo;
        this.dotKhuVucRepo = dotKhuVucRepo;
        this.dotDanhMucRepo = dotDanhMucRepo;
        this.lanDemRepo = lanDemRepo;
        this.nhatKyRepo = nhatKyRepo;
        this.anhRepo = anhRepo;
        this.khuVucRepo = khuVucRepo;
        this.viTriRepo = viTriRepo;
        this.danhMucRepo = danhMucRepo;
        this.khoRepo = khoRepo;
        this.phanQuyenRepo = phanQuyenRepo;
        this.dongPhieuRepo = dongPhieuRepo;
        this.quyen = quyen;
        this.sanSang = sanSang;
        this.guard = guard;
        this.objectMapper = objectMapper;
    }

    static KiemKeDto.Nguoi nguoi(NguoiDung n) {
        return n == null ? null : new KiemKeDto.Nguoi(n.getId(), n.getHoTen());
    }

    static KiemKeDto.Ma ma(Kho k) {
        return k == null ? null : new KiemKeDto.Ma(k.getId(), k.getMaKho(), k.getTenKho());
    }

    private DotKiemKe dotXemDuoc(Integer id) {
        DotKiemKe dot = dotRepo.findById(id)
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE, ThongDiep.of("khoVanHanh.dotKiemKeKhongTimThayId", id)));
        KhoDangChon.kiemTraXem(dot.getKho(), KiemKeService.ten(dot));
        return dot;
    }

    // ───────────────────────────── Danh sách ─────────────────────────────

    public List<KiemKeDto.Dot> danhSach(Integer khoId, Byte trangThai, String loai, String tuKhoa) {
        sanSang.batBuoc();
        DotKiemKe.LoaiKiemKe l = null;
        if (loai != null && !loai.isBlank()) {
            try {
                l = DotKiemKe.LoaiKiemKe.valueOf(loai);
            } catch (RuntimeException e) {
                l = null;
            }
        }
        String tk = tuKhoa == null ? "" : tuKhoa.trim().toLowerCase(Locale.ROOT);
        List<DotKiemKe> dots = dotRepo.timKiem(khoId, trangThai, l).stream()
                .filter(d -> KhoDangChon.duocXem(d.getKho()))
                .filter(d -> tk.isEmpty() || (d.getMaDotKiemKe() != null && d.getMaDotKiemKe().toLowerCase(Locale.ROOT).contains(tk))
                        || (d.getTenDotKiemKe() != null && d.getTenDotKiemKe().toLowerCase(Locale.ROOT).contains(tk)))
                .toList();
        if (dots.isEmpty()) return List.of();
        List<Integer> ids = dots.stream().map(DotKiemKe::getId).toList();
        Map<Integer, int[]> dem = new HashMap<>();
        Map<Integer, BigDecimal[]> giaTri = new HashMap<>();
        for (Object[] r : dongRepo.demTheoDot(ids)) {
            dem.put((Integer) r[0], new int[]{((Number) r[1]).intValue(), so(r[2]), so(r[3]), so(r[4]), so(r[5])});
            giaTri.put((Integer) r[0], new BigDecimal[]{tien(r[6]).negate(), tien(r[7])});
        }
        Map<Integer, Integer> keKhoa = new HashMap<>();
        @SuppressWarnings("unchecked")
        List<Object[]> soKe = em.createNativeQuery("SELECT dot_kiem_ke_id, COUNT(*) FROM dot_kiem_ke_vi_tri "
                        + "WHERE trang_thai_khoa = 1 AND dot_kiem_ke_id IN (:ids) GROUP BY dot_kiem_ke_id")
                .setParameter("ids", ids).getResultList();
        soKe.forEach(r -> keKhoa.put(((Number) r[0]).intValue(), ((Number) r[1]).intValue()));
        PhamViGon pv = phamViGon(ids);
        List<KiemKeDto.Dot> kq = new ArrayList<>();
        for (DotKiemKe d : dots) {
            int[] x = dem.getOrDefault(d.getId(), new int[5]);
            BigDecimal[] v = giaTri.getOrDefault(d.getId(), new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            KiemKeDto.ThongKe tkDot = new KiemKeDto.ThongKe(x[0], x[1], x[2], x[3], 0, x[4], 0, 0, 0,
                    v[0], v[1], v[1].subtract(v[0]));
            KiemKeDto.Dot dto = dotDto(d, tkDot, keKhoa.getOrDefault(d.getId(), 0), false);
            kq.add(new KiemKeDto.Dot(dto.id(), dto.ma(), dto.ten(), dto.kho(), dto.loaiKiemKe(), dto.trangThai(),
                    dto.phienBan(), dto.phienBanPhamVi(), dto.nguoiChuTri(), dto.lyDo(), dto.ghiChu(), dto.ngayTao(),
                    dto.ngayDuKienBatDau(), dto.ngayBatDau(), dto.ngayHoanThanh(), dto.ngayDuyet(), dto.ngayKetThuc(),
                    dto.ngayHuy(), dto.lyDoHuy(), dto.nguoiDuyet(), dto.nguoiHuy(), dto.danhMuc(),
                    pv.danhMuc.getOrDefault(d.getId(), List.of()), pv.khuVuc.getOrDefault(d.getId(), List.of()),
                    pv.viTri.getOrDefault(d.getId(), List.of()), dto.cheDoKhoa(), dto.soKeKhoa(), tkDot,
                    dto.phieuDieuChinh(), dto.quyen()));
        }
        return kq;
    }

    private static BigDecimal tien(Object o) {
        return o == null ? BigDecimal.ZERO : o instanceof BigDecimal b ? b : new BigDecimal(String.valueOf(o));
    }

    /** Phạm vi đã chọn của nhiều đợt (cho danh sách): khu vực, kệ, danh mục chốt — mỗi loại một truy vấn. */
    private record PhamViGon(Map<Integer, List<KiemKeDto.Ma>> khuVuc, Map<Integer, List<KiemKeDto.ViTri>> viTri,
                             Map<Integer, List<KiemKeDto.Ma>> danhMuc) {
    }

    @SuppressWarnings("unchecked")
    private PhamViGon phamViGon(List<Integer> ids) {
        Map<Integer, List<KiemKeDto.Ma>> khu = new HashMap<>();
        for (Object[] r : (List<Object[]>) em.createNativeQuery("SELECT d.dot_kiem_ke_id, k.id, k.ma_khu_vuc, k.ten_khu_vuc "
                + "FROM dot_kiem_ke_khu_vuc d JOIN khu_vuc_kho k ON k.id = d.khu_vuc_kho_id WHERE d.dot_kiem_ke_id IN (:ids) "
                + "ORDER BY k.ma_khu_vuc").setParameter("ids", ids).getResultList()) {
            khu.computeIfAbsent(((Number) r[0]).intValue(), x -> new ArrayList<>())
                    .add(new KiemKeDto.Ma(((Number) r[1]).intValue(), (String) r[2], (String) r[3]));
        }
        Map<Integer, List<KiemKeDto.ViTri>> ke = new HashMap<>();
        for (Object[] r : (List<Object[]>) em.createNativeQuery("SELECT d.dot_kiem_ke_id, v.id, v.ma_vi_tri "
                + "FROM dot_kiem_ke_vi_tri d JOIN vi_tri_kho v ON v.id = d.vi_tri_kho_id WHERE d.dot_kiem_ke_id IN (:ids) "
                + "ORDER BY v.ma_vi_tri").setParameter("ids", ids).getResultList()) {
            ke.computeIfAbsent(((Number) r[0]).intValue(), x -> new ArrayList<>())
                    .add(new KiemKeDto.ViTri(((Number) r[1]).intValue(), (String) r[2], null));
        }
        Map<Integer, List<KiemKeDto.Ma>> dm = new HashMap<>();
        for (Object[] r : (List<Object[]>) em.createNativeQuery("SELECT d.dot_kiem_ke_id, c.id, c.ma_danh_muc, c.ten_danh_muc "
                + "FROM dot_kiem_ke_danh_muc d JOIN danh_muc_quan_ao c ON c.id = d.danh_muc_id WHERE d.dot_kiem_ke_id IN (:ids)")
                .setParameter("ids", ids).getResultList()) {
            dm.computeIfAbsent(((Number) r[0]).intValue(), x -> new ArrayList<>())
                    .add(new KiemKeDto.Ma(((Number) r[1]).intValue(), (String) r[2], (String) r[3]));
        }
        return new PhamViGon(khu, ke, dm);
    }

    private static int so(Object o) {
        return o == null ? 0 : ((Number) o).intValue();
    }

    public KiemKeDto.TongQuan tongQuan(Integer khoId) {
        sanSang.batBuoc();
        List<DotKiemKe> dots = dotRepo.timKiem(khoId, null, null).stream().filter(d -> KhoDangChon.duocXem(d.getKho())).toList();
        long nhap = dots.stream().filter(d -> d.getTrangThai() == IKiemKe.NHAP).count();
        long dang = dots.stream().filter(d -> d.getTrangThai() == IKiemKe.DANG_KIEM_KE).count();
        long cho = dots.stream().filter(d -> d.getTrangThai() == IKiemKe.CHO_DUYET).count();
        long keCoKhoa;
        if (khoId != null || KiemKeQuyen.laQuanTri(quyen.nguoiXem())) {
            keCoKhoa = dotRepo.demKeCoKhoa(khoId);
        } else {
            Set<Integer> khoXem = dots.stream().map(d -> d.getKho().getId()).collect(Collectors.toSet());
            keCoKhoa = khoXem.stream().mapToLong(dotRepo::demKeCoKhoa).sum();
        }
        return new KiemKeDto.TongQuan(dots.size(), nhap, dang, cho, keCoKhoa);
    }

    // ───────────────────────────── Chi tiết ─────────────────────────────

    public KiemKeDto.Dot chiTiet(Integer id) {
        sanSang.batBuoc();
        DotKiemKe dot = dotXemDuoc(id);
        List<ChiTietKiemKe> dong = dongRepo.findByDotKiemKeId(id);
        int soKeKhoa = (int) dotViTriRepo.theoDot(id).stream().filter(v -> v.getTrangThaiKhoa() == 1).count();
        return dotDto(dot, thongKe(dong), soKeKhoa, true);
    }

    static KiemKeDto.ThongKe thongKe(List<ChiTietKiemKe> dong) {
        int daDem = 0, chua = 0, canLai = 0, xacNhan = 0, lech = 0, thieuLyDo = 0;
        long thieu = 0, thua = 0;
        BigDecimal gtThieu = BigDecimal.ZERO, gtThua = BigDecimal.ZERO;
        for (ChiTietKiemKe d : dong) {
            byte tt = d.getTrangThai() == null ? 0 : d.getTrangThai();
            if (d.getSoLuongThucTe() != null) daDem++;
            if (tt == IKiemKe.DONG_CHUA_KIEM) chua++;
            if (tt == IKiemKe.DONG_CAN_KIEM_LAI) canLai++;
            if (tt == IKiemKe.DONG_DA_XAC_NHAN) xacNhan++;
            if (KiemKeTinhToan.lech(d)) {
                lech++;
                if (!KiemKeTinhToan.coChu(d.getLyDoChenhLech())) thieuLyDo++;
                long q = d.getChenhLechSoLuong().longValue();
                BigDecimal v = d.getGiaTriChenhLech() == null ? BigDecimal.ZERO : d.getGiaTriChenhLech();
                if (q < 0) {
                    thieu += -q;
                    gtThieu = gtThieu.add(v.negate());
                } else {
                    thua += q;
                    gtThua = gtThua.add(v);
                }
            }
        }
        return new KiemKeDto.ThongKe(dong.size(), daDem, chua, canLai, xacNhan, lech, thieuLyDo, thieu, thua,
                gtThieu, gtThua, gtThua.subtract(gtThieu));
    }

    private KiemKeDto.Dot dotDto(DotKiemKe d, KiemKeDto.ThongKe tk, int soKeKhoa, boolean day) {
        String loai = d.getLoaiKiemKe() == null ? null : d.getLoaiKiemKe().name();
        List<KiemKeDto.Ma> khuVuc = List.of();
        List<KiemKeDto.ViTri> viTri = List.of();
        List<KiemKeDto.Ma> danhMucChot = List.of();
        KiemKeDto.Ma phieu = null;
        if (day) {
            List<Integer> kv = dotKhuVucRepo.idCuaDot(d.getId());
            if (!kv.isEmpty()) {
                khuVuc = khuVucRepo.findAllById(kv).stream().sorted(Comparator.comparing(KhuVucKho::getMaKhuVuc))
                        .map(k -> new KiemKeDto.Ma(k.getId(), k.getMaKhuVuc(), k.getTenKhuVuc())).toList();
            }
            viTri = dotViTriRepo.theoDot(d.getId()).stream().map(v -> new KiemKeDto.ViTri(v.getViTriKho().getId(),
                    v.getViTriKho().getMaViTri(), v.getViTriKho().getKhuVucKho() == null ? null
                    : v.getViTriKho().getKhuVucKho().getTenKhuVuc())).toList();
            List<Integer> dm = dotDanhMucRepo.idCuaDot(d.getId());
            if (!dm.isEmpty()) {
                danhMucChot = danhMucRepo.findAllById(dm).stream()
                        .map(x -> new KiemKeDto.Ma(x.getId(), x.getMaDanhMuc(), x.getTenDanhMuc())).toList();
            }
            @SuppressWarnings("unchecked")
            List<Object[]> p = em.createNativeQuery("SELECT id, so_phieu FROM phieu_dieu_chinh_kho WHERE dot_kiem_ke_id = :id "
                    + "AND nguon = 'kiem_ke' ORDER BY id DESC LIMIT 1").setParameter("id", d.getId()).getResultList();
            if (!p.isEmpty()) phieu = new KiemKeDto.Ma(((Number) p.get(0)[0]).intValue(), (String) p.get(0)[1], null);
        }
        String cheDo = loai == null || IKiemKe.dangGiuKhoa(d.getTrangThai()) == false ? null
                : IKiemKe.laKhoaToanKe(loai) ? IKiemKe.TOAN_KE : IKiemKe.THEO_LO;
        DanhMucQuanAo dmGoc = d.getDanhMuc();
        return new KiemKeDto.Dot(d.getId(), d.getMaDotKiemKe(), d.getTenDotKiemKe(), ma(d.getKho()), loai,
                d.getTrangThai() == null ? 0 : d.getTrangThai(), d.getPhienBan() == null ? 0 : d.getPhienBan(),
                d.getPhienBanPhamVi() == null ? 1 : d.getPhienBanPhamVi(), nguoi(d.getNguoiChuTri()), d.getLyDo(), d.getGhiChu(),
                d.getNgayTao(), d.getNgayDuKienBatDau(), d.getNgayBatDau(), d.getNgayHoanThanh(), d.getNgayDuyet(),
                d.getNgayKetThuc(), d.getNgayHuy(), d.getLyDoHuy(), nguoi(d.getNguoiDuyet()), nguoi(d.getNguoiHuy()),
                dmGoc == null ? null : new KiemKeDto.Ma(dmGoc.getId(), dmGoc.getMaDanhMuc(), dmGoc.getTenDanhMuc()),
                danhMucChot, khuVuc, viTri, cheDo, soKeKhoa, tk, phieu, quyen.quyen(d));
    }

    // ───────────────────────────── Dòng ─────────────────────────────

    public List<KiemKeDto.Dong> dong(Integer id) {
        sanSang.batBuoc();
        DotKiemKe dot = dotXemDuoc(id);
        List<ChiTietKiemKe> dong = dongRepo.dongCuaDot(dot.getId());
        return dongDto(dong);
    }

    public KiemKeDto.Dong mot(ChiTietKiemKe d) {
        return dongDto(List.of(d)).get(0);
    }

    private List<KiemKeDto.Dong> dongDto(List<ChiTietKiemKe> dong) {
        if (dong.isEmpty()) return List.of();
        List<Integer> ids = dong.stream().map(ChiTietKiemKe::getId).toList();
        Map<Integer, List<KiemKeLanDem>> lanTruoc = lanDemRepo.theoDong(ids).stream()
                .collect(Collectors.groupingBy(KiemKeLanDem::getChiTietKiemKeId));
        Map<Integer, Integer> lanCuaAnh = new HashMap<>();
        lanTruoc.values().forEach(ds -> ds.forEach(l -> docIdAnh(l.getAnhThamChieu()).forEach(a -> lanCuaAnh.put(a, l.getLanKiemDem()))));
        Map<Integer, List<AnhKiemKe>> anh = anhRepo.theoDong(ids).stream()
                .collect(Collectors.groupingBy(a -> a.getChiTietKiemKe().getId()));
        List<KiemKeDto.Dong> kq = new ArrayList<>();
        for (ChiTietKiemKe d : dong) {
            BienTheSanPham bt = d.getBienTheSanPham();
            ViTriKho ke = d.getViTriKe();
            List<KiemKeDto.Anh> anhDong = anh.getOrDefault(d.getId(), List.of()).stream()
                    .map(a -> new KiemKeDto.Anh(a.getId(), a.getTepTin() == null ? null : a.getTepTin().getDuongDan(),
                            a.getMoTa(), a.getNgayChup(), nguoi(a.getNguoiChup()),
                            lanCuaAnh.getOrDefault(a.getId(), d.getLanKiemDem())))
                    .toList();
            List<KiemKeDto.LanDem> lan = lanTruoc.getOrDefault(d.getId(), List.of()).stream()
                    .map(l -> new KiemKeDto.LanDem(l.getLanKiemDem(), l.getSoLuongThucTe(), l.getLyDoChenhLech(),
                            nguoi(l.getNguoiKiemDem()), l.getNgayKiemDem(), nguoi(l.getNguoiYeuCau()), l.getLyDoKiemLai(),
                            l.getNgayYeuCau()))
                    .toList();
            kq.add(new KiemKeDto.Dong(d.getId(),
                    ke == null ? new KiemKeDto.ViTri(null, d.getViTriKho(), null)
                            : new KiemKeDto.ViTri(ke.getId(), ke.getMaViTri(), null),
                    d.getLoHang() == null ? null : new KiemKeDto.Ma(d.getLoHang().getId(), d.getLoHang().getMaLo(), null),
                    sanPham(bt), d.getSoLuongHeThong(), d.getGiaVonHeThong(), d.getSoLuongThucTe(), d.getChenhLechSoLuong(),
                    d.getTiLeChenhLech(), d.getGiaTriChenhLech(), d.getLoaiChenhLech() == null ? null : d.getLoaiChenhLech().name(),
                    d.getLanKiemDem() == null ? 1 : d.getLanKiemDem(), d.getTrangThai() == null ? 0 : d.getTrangThai(),
                    d.getLyDoChenhLech(), d.getBienPhapXuLy(), nguoi(d.getNguoiKiemDem()), d.getNgayKiemDem(),
                    d.getPhienBan() == null ? 0 : d.getPhienBan(),
                    d.getSoLuongHeThong() != null && d.getSoLuongHeThong().signum() == 0 && ke != null,
                    anhDong, lan));
        }
        return kq;
    }

    static KiemKeDto.SanPham sanPham(BienTheSanPham bt) {
        if (bt == null) return null;
        return new KiemKeDto.SanPham(bt.getId(), bt.getMaSku(), HienThiBienThe.tenSanPham(bt), HienThiBienThe.tenMau(bt),
                HienThiBienThe.maMauHex(bt), HienThiBienThe.kichCo(bt), HienThiBienThe.anh(bt), bt.getMaVachSku());
    }

    private List<Integer> docIdAnh(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return Arrays.asList(objectMapper.readValue(json, Integer[].class));
        } catch (Exception e) {
            return List.of();
        }
    }

    // ───────────────────────────── Nhật ký, phiếu ─────────────────────────────

    public List<KiemKeDto.NhatKy> nhatKy(Integer id) {
        sanSang.batBuoc();
        dotXemDuoc(id);
        return nhatKyRepo.theoDot(id).stream()
                .map(l -> new KiemKeDto.NhatKy(l.getHanhDong(), l.getNoiDung(), nguoi(l.getNguoiThucHien()), l.getNgayThucHien()))
                .toList();
    }

    public KiemKeDto.PhieuDieuChinh phieuDieuChinh(Integer id) {
        sanSang.batBuoc();
        dotXemDuoc(id);
        List<PhieuDieuChinhKho> ds = em.createQuery("SELECT p FROM PhieuDieuChinhKho p LEFT JOIN FETCH p.nguoiDuyet "
                        + "WHERE p.dotKiemKe.id = :id AND p.nguon = 'kiem_ke' ORDER BY p.id DESC", PhieuDieuChinhKho.class)
                .setParameter("id", id).setMaxResults(1).getResultList();
        if (ds.isEmpty()) return null;
        PhieuDieuChinhKho p = ds.get(0);
        int soDong = dongPhieuRepo.findByPhieuDieuChinhKho_IdOrderByIdAsc(p.getId()).size();
        return new KiemKeDto.PhieuDieuChinh(p.getId(), p.getSoPhieu(), p.getLoaiDieuChinh(), p.getTongGiaTriTang(),
                p.getTongGiaTriGiam(), p.getGiaTriChenhLechThuan(), p.getNgayDieuChinh(), nguoi(p.getNguoiDuyet()), soDong);
    }

    // ───────────────────────────── Người chủ trì ─────────────────────────────

    public List<KiemKeDto.Nguoi> nguoiChuTri(Integer khoId) {
        Kho kho = khoRepo.findById(khoId).orElseThrow(() -> KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.khoKhongTimThay")));
        KhoDangChon.kiemTraXem(kho, "Kho " + kho.getTenKho());
        return phanQuyenRepo.nguoiDungTheoKhoVaVaiTroTai(khoId, List.of(IRoleType.quan_ly_kho), Instant.now()).stream()
                .map(KiemKeDocService::nguoi).toList();
    }

    // ───────────────────────────── Sơ đồ khóa ─────────────────────────────

    public KiemKeDto.SoDo soDo(Integer khoId) {
        sanSang.batBuoc();
        Kho kho = khoRepo.findById(khoId).orElseThrow(() -> KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.khoKhongTimThay")));
        KhoDangChon.kiemTraXem(kho, "Kho " + kho.getTenKho());
        List<ViTriKho> ke = viTriRepo.findByKho_IdOrderByMaViTriAsc(khoId);
        Map<Integer, List<KiemKeDto.Ma>> dotCuaKe = new HashMap<>();
        Map<Integer, String> cheDo = new HashMap<>();
        for (Object[] r : dotViTriRepo.khoaDangCoCuaKho(khoId)) {
            Integer v = ((Number) r[0]).intValue();
            dotCuaKe.computeIfAbsent(v, k -> new ArrayList<>()).add(new KiemKeDto.Ma(((Number) r[1]).intValue(), (String) r[2],
                    ((Number) r[3]).intValue() == IKiemKe.CHO_DUYET ? "Chờ duyệt" : "Đang kiểm kê"));
            String c = (String) r[4];
            if (IKiemKe.TOAN_KE.equals(c) || !cheDo.containsKey(v)) cheDo.put(v, c);
        }
        KhoaKiemKeGuard.TrangThaiKhoa tt = guard.trangThai(khoId);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT t.vi_tri_kho_id, l.id, l.ma_lo, bt.ma_sku, sp.ten_san_pham, t.so_luong, sp.danh_muc_id
                  FROM ton_kho_vi_tri t
                  JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
                  JOIN lo_hang l ON l.id = t.lo_hang_id
                  JOIN bien_the_san_pham bt ON bt.id = t.bien_the_san_pham_id
                  JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id
                 WHERE v.kho_id = :kho AND t.so_luong > 0
                 ORDER BY t.vi_tri_kho_id, l.ma_lo
                """).setParameter("kho", khoId).getResultList();
        Map<Integer, List<KiemKeDto.LoTrenKe>> loCuaKe = new HashMap<>();
        for (Object[] r : rows) {
            Integer v = ((Number) r[0]).intValue();
            Integer lo = ((Number) r[1]).intValue();
            // Lô thuộc danh mục đang kiểm ở kho cũng tạm dừng ở mọi kệ của kho (chốt chặn danh mục toàn kho)
            boolean khoa = tt.capDangKhoa(v, lo) || (r[6] != null && tt.danhMuc.containsKey(((Number) r[6]).intValue()));
            loCuaKe.computeIfAbsent(v, k -> new ArrayList<>()).add(new KiemKeDto.LoTrenKe(lo, (String) r[2], (String) r[3],
                    (String) r[4], ((Number) r[5]).intValue(), khoa));
        }
        Map<Integer, List<KiemKeDto.KeSoDo>> theoKhu = new LinkedHashMap<>();
        int toan = 0, min = 0, baoTri = 0;
        for (ViTriKho v : ke) {
            List<KiemKeDto.LoTrenKe> lo = loCuaKe.getOrDefault(v.getId(), List.of());
            int dangChua = lo.stream().mapToInt(KiemKeDto.LoTrenKe::soLuong).sum();
            String c = cheDo.get(v.getId());
            if (IKiemKe.TOAN_KE.equals(c)) toan++;
            else if (IKiemKe.THEO_LO.equals(c)) min++;
            else if (IKiemKe.KE_BAO_TRI.equals(v.getTrangThai())) baoTri++;
            Integer khu = v.getKhuVucKho() == null ? 0 : v.getKhuVucKho().getId();
            theoKhu.computeIfAbsent(khu, k -> new ArrayList<>()).add(new KiemKeDto.KeSoDo(v.getId(), v.getMaViTri(),
                    v.getTrangThai(), v.getSucChuaToiDa(), dangChua, c, dotCuaKe.getOrDefault(v.getId(), List.of()), lo));
        }
        Map<Integer, KhuVucKho> khuVuc = khuVucRepo.findByKho_IdOrderByMaKhuVucAsc(khoId).stream()
                .collect(Collectors.toMap(KhuVucKho::getId, k -> k, (a, b) -> a, LinkedHashMap::new));
        List<KiemKeDto.KhuVucSoDo> ds = new ArrayList<>();
        for (KhuVucKho k : khuVuc.values()) {
            List<KiemKeDto.KeSoDo> keKhu = theoKhu.remove(k.getId());
            if (keKhu != null) ds.add(new KiemKeDto.KhuVucSoDo(k.getId(), k.getMaKhuVuc(), k.getTenKhuVuc(), keKhu));
        }
        String tenKhac = ThongDiep.of("hienThiBaoCao.khuKhac").theoNgonNgu(NgonNgu.hienTai());
        theoKhu.forEach((k, v) -> ds.add(new KiemKeDto.KhuVucSoDo(k, null, tenKhac, v)));
        return new KiemKeDto.SoDo(ma(kho), ds, toan, min, baoTri);
    }

    // ───────────────────────────── Tìm lô (lô phát sinh) ─────────────────────────────

    /**
     * Lô có trong danh mục hàng hóa khớp đầu mã lô hoặc SKU (tối đa 20, trùng hẳn mã lô lên đầu) cho hộp Thêm lô phát sinh.
     * Đợt theo danh mục chỉ trả lô thuộc danh mục đã chốt; lúc thêm máy chủ vẫn kiểm lại đủ điều kiện.
     */
    public List<KiemKeDto.LoTim> timLo(Integer id, String tuKhoa) {
        sanSang.batBuoc();
        DotKiemKe dot = dotXemDuoc(id);
        String tu = tuKhoa == null ? "" : tuKhoa.trim().toLowerCase(Locale.ROOT);
        if (tu.isEmpty()) return List.of();
        if (tu.length() > 100) tu = tu.substring(0, 100);
        // Ký tự thoát '!' (không dùng '\': MySQL đọc '\' trong chuỗi là ký tự thoát của chính nó)
        String mau = tu.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        boolean theoDanhMuc = !IKiemKe.laKhoaToanKe(dot.getLoaiKiemKe().name());
        List<Integer> danhMuc = theoDanhMuc ? dotDanhMucRepo.idCuaDot(id) : List.of();
        if (theoDanhMuc && danhMuc.isEmpty()) return List.of();
        var q = em.createQuery("SELECT l FROM LoHang l JOIN FETCH l.bienTheSanPham b LEFT JOIN FETCH b.sanPham s "
                        + "WHERE (LOWER(l.maLo) LIKE :mau ESCAPE '!' OR LOWER(b.maSku) LIKE :mau ESCAPE '!'"
                        + " OR LOWER(b.maVachSku) LIKE :mau ESCAPE '!')"
                        + (theoDanhMuc ? " AND s.danhMuc.id IN :dm" : "")
                        + " ORDER BY CASE WHEN LOWER(l.maLo) = :dung THEN 0 ELSE 1 END, l.maLo", LoHang.class)
                .setParameter("mau", mau).setParameter("dung", tu).setMaxResults(20);
        if (theoDanhMuc) q.setParameter("dm", danhMuc);
        return q.getResultList().stream()
                .map(l -> new KiemKeDto.LoTim(l.getId(), l.getMaLo(), sanPham(l.getBienTheSanPham()))).toList();
    }

    // ───────────────────────────── Hàng chưa có kệ ─────────────────────────────

    /**
     * Số kệ và số sản phẩm trên sổ kệ theo từng danh mục của kho, gộp cả cây con (cho bảng chọn danh mục ở Tạo đợt kiểm kê).
     * Một kệ chứa hàng của nhiều danh mục con chỉ đếm một lần ở danh mục cha. Danh mục không có hàng trên kệ thì không trả về.
     * Cây có vòng lặp / quá sâu: dừng leo ở mức {@link IKiemKe#DO_SAU_DANH_MUC_TOI_DA} (không báo lỗi, đây chỉ là số tham khảo;
     * lúc bắt đầu, phạm vi vẫn tự báo lỗi cây như cũ).
     */
    public List<KiemKeDto.DanhMucTrenKe> danhMucTrenKe(Integer khoId) {
        Kho kho = khoRepo.findById(khoId).orElseThrow(() -> KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.khoKhongTimThay")));
        KhoDangChon.kiemTraXem(kho, "Kho " + kho.getTenKho());
        Map<Integer, Integer> cha = new HashMap<>();
        @SuppressWarnings("unchecked")
        List<Object[]> cay = em.createNativeQuery("SELECT id, danh_muc_cha_id FROM danh_muc_quan_ao").getResultList();
        for (Object[] r : cay) {
            if (r[1] != null) cha.put(((Number) r[0]).intValue(), ((Number) r[1]).intValue());
        }
        List<Object[]> dong = em.createQuery("SELECT t.loHang.bienTheSanPham.sanPham.danhMuc.id, t.viTriKho.id, SUM(t.soLuong) "
                        + "FROM TonKhoViTri t WHERE t.viTriKho.kho.id = :kho AND t.soLuong > 0 "
                        + "GROUP BY t.loHang.bienTheSanPham.sanPham.danhMuc.id, t.viTriKho.id", Object[].class)
                .setParameter("kho", khoId).getResultList();
        return gopDanhMucTrenKe(cha, dong);
    }

    /** Gộp các dòng (danh mục sản phẩm, kệ, số lượng) lên mọi tổ tiên theo {@code cha}; kệ đếm khác nhau. Hàm thuần để test. */
    static List<KiemKeDto.DanhMucTrenKe> gopDanhMucTrenKe(Map<Integer, Integer> cha, List<Object[]> dong) {
        Map<Integer, Set<Integer>> keTheoDm = new HashMap<>();
        Map<Integer, Long> slTheoDm = new HashMap<>();
        for (Object[] r : dong) {
            if (r[0] == null || r[1] == null) continue;
            Integer ke = ((Number) r[1]).intValue();
            long sl = r[2] == null ? 0 : ((Number) r[2]).longValue();
            // Cộng vào danh mục của sản phẩm và mọi tổ tiên
            Integer dm = ((Number) r[0]).intValue();
            Set<Integer> daQua = new HashSet<>();
            for (int sau = 0; dm != null && sau <= IKiemKe.DO_SAU_DANH_MUC_TOI_DA && daQua.add(dm); sau++) {
                keTheoDm.computeIfAbsent(dm, k -> new HashSet<>()).add(ke);
                slTheoDm.merge(dm, sl, Long::sum);
                dm = cha.get(dm);
            }
        }
        return keTheoDm.entrySet().stream()
                .map(e -> new KiemKeDto.DanhMucTrenKe(e.getKey(), e.getValue().size(), slTheoDm.getOrDefault(e.getKey(), 0L)))
                .sorted(Comparator.comparing(KiemKeDto.DanhMucTrenKe::danhMucId))
                .toList();
    }
}
