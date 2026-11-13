package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.kiemke.KiemKeDto;
import com.dev.backend.dto.kiemke.KiemKeYeuCau;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.ThongBaoKiemKeService;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.SoChungTu;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import com.dev.backend.i18n.NgonNgu;
import com.dev.backend.i18n.ThongDiep;

/**
 * Vòng đời đợt kiểm kê khoanh vùng (đặc tả BA 5, UC-STK-01..05, 07). Phê duyệt và mở khóa ở {@link KiemKeDuyetService}.
 * <pre>
 *   Nháp ──Bắt đầu──▶ Đang kiểm kê ──Trình duyệt──▶ Chờ duyệt ──Phê duyệt──▶ Đã duyệt
 *                         ▲                             │
 *                         └────────── Đếm lại ──────────┘          Nháp / Đang kiểm kê / Chờ duyệt ──Hủy──▶ Đã hủy
 * </pre>
 * Bắt đầu, Lô phát sinh, Phê duyệt, Hủy đợt đang khóa giữ mutex kho (khóa ghi) trong cả giao dịch; mọi lệnh khóa dòng
 * đợt rồi mới xét trạng thái, phiên bản (expectedVersion) và Idempotency-Key.
 */
@Slf4j
@Service
public class KiemKeService {

    @PersistenceContext
    private EntityManager em;

    private final DotKiemKeRepository dotRepo;
    private final ChiTietKiemKeRepository dongRepo;
    private final DotKiemKeViTriRepository dotViTriRepo;
    private final DotKiemKeKhoaLoRepository khoaLoRepo;
    private final DotKiemKeKhuVucRepository dotKhuVucRepo;
    private final DotKiemKeDanhMucRepository dotDanhMucRepo;
    private final KiemKeLanDemRepository lanDemRepo;
    private final LichSuKiemKeRepository nhatKyRepo;
    private final AnhKiemKeRepository anhRepo;
    private final NguoiDungRepository nguoiDungRepo;
    private final PhanQuyenNguoiDungKhoRepository phanQuyenRepo;
    private final ViTriKhoRepository viTriRepo;
    private final LoHangRepository loHangRepo;
    private final TonKhoViTriRepository tonKeRepo;
    private final DanhMucQuanAoRepository danhMucRepo;
    private final KhoaKiemKeGuard guard;
    private final KiemKePhamViService phamVi;
    private final KiemKeLenhService lenh;
    private final KiemKeQuyen quyen;
    private final KiemKeSanSang sanSang;
    private final KiemKeDuyetService duyet;
    private final ThongBaoKiemKeService thongBao;
    private final ObjectMapper objectMapper;

    public KiemKeService(DotKiemKeRepository dotRepo, ChiTietKiemKeRepository dongRepo,
                         DotKiemKeViTriRepository dotViTriRepo, DotKiemKeKhoaLoRepository khoaLoRepo,
                         DotKiemKeKhuVucRepository dotKhuVucRepo, DotKiemKeDanhMucRepository dotDanhMucRepo,
                         KiemKeLanDemRepository lanDemRepo, LichSuKiemKeRepository nhatKyRepo,
                         AnhKiemKeRepository anhRepo, NguoiDungRepository nguoiDungRepo,
                         PhanQuyenNguoiDungKhoRepository phanQuyenRepo, ViTriKhoRepository viTriRepo,
                         LoHangRepository loHangRepo, TonKhoViTriRepository tonKeRepo,
                         DanhMucQuanAoRepository danhMucRepo, KhoaKiemKeGuard guard, KiemKePhamViService phamVi,
                         KiemKeLenhService lenh, KiemKeQuyen quyen, KiemKeSanSang sanSang, KiemKeDuyetService duyet,
                         ThongBaoKiemKeService thongBao, ObjectMapper objectMapper) {
        this.dotRepo = dotRepo;
        this.dongRepo = dongRepo;
        this.dotViTriRepo = dotViTriRepo;
        this.khoaLoRepo = khoaLoRepo;
        this.dotKhuVucRepo = dotKhuVucRepo;
        this.dotDanhMucRepo = dotDanhMucRepo;
        this.lanDemRepo = lanDemRepo;
        this.nhatKyRepo = nhatKyRepo;
        this.anhRepo = anhRepo;
        this.nguoiDungRepo = nguoiDungRepo;
        this.phanQuyenRepo = phanQuyenRepo;
        this.viTriRepo = viTriRepo;
        this.loHangRepo = loHangRepo;
        this.tonKeRepo = tonKeRepo;
        this.danhMucRepo = danhMucRepo;
        this.guard = guard;
        this.phamVi = phamVi;
        this.lenh = lenh;
        this.quyen = quyen;
        this.sanSang = sanSang;
        this.duyet = duyet;
        this.thongBao = thongBao;
        this.objectMapper = objectMapper;
    }

    // ───────────────────────────── Lỗi có mã ─────────────────────────────

    static LoiCoMaException saiTrangThai(ThongDiep cau, DotKiemKe dot) {
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_INVALID_STATE, cau,
                Map.of("trangThai", dot.getTrangThai() == null ? 0 : dot.getTrangThai(), "phienBan", dot.getPhienBan()));
    }

    static void kiemTraPhienBan(DotKiemKe dot, Long phienBan) {
        if (phienBan == null) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.STK_VERSION_CONFLICT,
                    ThongDiep.of("khoVanHanh.thieuPhienBanDot"));
        }
        if (!phienBan.equals(dot.getPhienBan())) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_VERSION_CONFLICT,
                    ThongDiep.of("khoVanHanh.dotVuaDuocCapNhat", dot.getMaDotKiemKe()),
                    Map.of("phienBan", dot.getPhienBan()));
        }
    }

    static String ten(DotKiemKe dot) {
        return "Đợt kiểm kê " + dot.getMaDotKiemKe();
    }

    /** {@code khoaLoi}: khóa câu "… tối đa {0} ký tự" của trường (tham số là {@code toiDa}). */
    private static String chuoi(String s, int toiDa, String khoaLoi) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        if (t.length() > toiDa) throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.STK_INVALID_SCOPE,
                ThongDiep.of(khoaLoi, toiDa));
        return t;
    }

    private DotKiemKe khoaDot(Integer id) {
        DotKiemKe dot = dotRepo.khoaTheoId(id)
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE,
                        ThongDiep.of("khoVanHanh.dotKiemKeKhongTimThayId", id)));
        em.refresh(dot, LockModeType.PESSIMISTIC_WRITE);
        return dot;
    }

    /** Đợt đang khóa phạm vi: lấy mutex kho (khóa ghi) trước khi khóa dòng đợt, đúng thứ tự khóa toàn hệ thống. */
    private DotKiemKe khoaDotVaKho(Integer id) {
        DotKiemKe xem = dotRepo.findById(id)
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE,
                        ThongDiep.of("khoVanHanh.dotKiemKeKhongTimThayId", id)));
        guard.giuKhoGhi(xem.getKho().getId());
        return khoaDot(id);
    }

    void ghiNhatKy(DotKiemKe dot, String hanhDong, String noiDung, NguoiDung nguoi) {
        LichSuKiemKe l = new LichSuKiemKe();
        l.setDotKiemKe(dot);
        l.setHanhDong(hanhDong);
        l.setNoiDung(noiDung);
        l.setNguoiThucHien(nguoi);
        l.setNgayThucHien(Instant.now());
        nhatKyRepo.save(l);
    }

    static KiemKeDto.KetQuaLenh ketQua(DotKiemKe dot, PhieuDieuChinhKho phieu) {
        return new KiemKeDto.KetQuaLenh(dot.getId(), dot.getTrangThai(), dot.getPhienBan(),
                phieu == null ? null : phieu.getId(), phieu == null ? null : phieu.getSoPhieu());
    }

    private static void tangPhienBan(DotKiemKe dot) {
        dot.setPhienBan((dot.getPhienBan() == null ? 0 : dot.getPhienBan()) + 1);
        dot.setNgayCapNhat(Instant.now());
    }

    // ───────────────────────────── Nháp ─────────────────────────────

    /** Kiểm và ghi các trường chung của đợt (BR-STK-01). */
    private void ganThongTin(DotKiemKe dot, KiemKeYeuCau.Dot yc, Kho kho, NguoiDung nguoiTao) {
        String tenDot = chuoi(yc.tenDotKiemKe(), IKiemKe.TEN_DOT_TOI_DA, "khoVanHanh.tenDotToiDaKyTu");
        if (tenDot == null) throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.nhapTenDot"));
        String lyDo = chuoi(yc.lyDo(), IKiemKe.LY_DO_TOI_DA, "khoVanHanh.lyDoToiDaKyTu");
        if (lyDo == null) throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.nhapLyDoKiemKe"));
        dot.setTenDotKiemKe(tenDot);
        dot.setLyDo(lyDo);
        dot.setGhiChu(chuoi(yc.ghiChu(), IKiemKe.LY_DO_TOI_DA, "khoVanHanh.ghiChuToiDaKyTu"));
        kiemTraNgayDuKien(yc.ngayDuKienBatDau(), dot.getNgayDuKienBatDau(), Instant.now());
        dot.setNgayDuKienBatDau(yc.ngayDuKienBatDau());
        dot.setNguoiChuTri(nguoiChuTri(kho, yc.nguoiChuTriId(), nguoiTao));
        DotKiemKe.LoaiKiemKe loai;
        try {
            loai = DotKiemKe.LoaiKiemKe.valueOf(yc.loaiKiemKe());
        } catch (RuntimeException e) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.chonPhamViKiemKe"));
        }
        dot.setLoaiKiemKe(loai);
        dot.setDanhMuc(IKiemKe.THEO_DANH_MUC.equals(yc.loaiKiemKe()) && yc.danhMucId() != null
                ? danhMucRepo.findById(yc.danhMucId()).orElse(null) : null);
    }

    /**
     * Thời điểm dự kiến bắt đầu không được ở quá khứ (so theo phút: ô chọn chỉ tới phút). Sửa nháp mà giữ nguyên thời điểm
     * cũ đã trôi qua thì vẫn cho lưu, để không chặn việc sửa phần khác của đợt.
     */
    static void kiemTraNgayDuKien(Instant moi, Instant cu, Instant bayGio) {
        if (moi == null) return;
        Instant phutMoi = moi.truncatedTo(ChronoUnit.MINUTES);
        if (cu != null && phutMoi.equals(cu.truncatedTo(ChronoUnit.MINUTES))) return;
        if (phutMoi.isBefore(bayGio.truncatedTo(ChronoUnit.MINUTES))) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.ngayDuKienDaQua"));
        }
    }

    /**
     * Người chủ trì (Đ11): quản lý kho đang được phân quyền ở kho, hoặc quản trị viên; mặc định người tạo. Nhân viên kho lập
     * đợt (quyền tao_dot_kiem_ke) phải chọn chủ trì: người chủ trì bấm Bắt đầu, việc của quản lý kho.
     */
    private NguoiDung nguoiChuTri(Kho kho, Integer id, NguoiDung nguoiTao) {
        if (id == null && KiemKeQuyen.lapNhoQuyen(quyen.nguoiXem())) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.chonNguoiChuTriLaQuanLy"));
        }
        NguoiDung nd = id == null ? nguoiTao : nguoiDungRepo.findById(id)
                .orElseThrow(() -> KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.nguoiChuTriKhongTimThay")));
        if (IRoleType.quan_tri_vien.equals(nd.getVaiTro())) return nd;
        boolean laQuanLy = phanQuyenRepo.nguoiDungTheoKhoVaVaiTroTai(kho.getId(), List.of(IRoleType.quan_ly_kho), Instant.now())
                .stream().anyMatch(n -> n.getId().equals(nd.getId()));
        if (!laQuanLy) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.nguoiChuTriPhaiLaQuanLy", kho.getTenKho()));
        }
        return nd;
    }

    /** Lưu lựa chọn khu vực / kệ của nháp (chưa khóa gì). */
    private void luuLuaChon(DotKiemKe dot, KiemKePhamViService.LuaChon lc) {
        dotKhuVucRepo.xoaCuaDot(dot.getId());
        dotViTriRepo.xoaChuaKhoaCuaDot(dot.getId());
        if (IKiemKe.THEO_KHU_VUC.equals(lc.loai())) {
            for (Integer kv : lc.khuVucIds()) dotKhuVucRepo.save(new DotKiemKePhamVi.KhuVuc(dot.getId(), kv));
        }
        if (IKiemKe.THEO_KE.equals(lc.loai())) {
            for (ViTriKho v : viTriRepo.findAllById(lc.viTriIds())) {
                dotViTriRepo.save(DotKiemKeViTri.builder().dotKiemKeId(dot.getId()).viTriKho(v)
                        .cheDoKhoa(IKiemKe.TOAN_KE).trangThaiKhoa(0).build());
            }
        }
    }

    static KiemKePhamViService.LuaChon luaChon(KiemKeYeuCau.Dot yc) {
        return new KiemKePhamViService.LuaChon(yc.khoId(), yc.loaiKiemKe(), yc.khuVucIds(), yc.viTriIds(), yc.danhMucId());
    }

    /** Lựa chọn phạm vi đã lưu của một đợt nháp. */
    KiemKePhamViService.LuaChon luaChon(DotKiemKe dot) {
        String loai = dot.getLoaiKiemKe() == null ? null : dot.getLoaiKiemKe().name();
        List<Integer> ke = IKiemKe.THEO_KE.equals(loai)
                ? dotViTriRepo.theoDot(dot.getId()).stream().map(v -> v.getViTriKho().getId()).toList() : List.of();
        return new KiemKePhamViService.LuaChon(dot.getKho().getId(), loai, dotKhuVucRepo.idCuaDot(dot.getId()), ke,
                dot.getDanhMuc() == null ? null : dot.getDanhMuc().getId());
    }

    private DotKiemKe taoHeader(KiemKeYeuCau.Dot yc, NguoiDung nguoi) {
        Kho kho = phamVi.khoHopLe(yc.khoId());
        KhoDangChon.kiemTra(kho, "Đợt kiểm kê kho " + kho.getTenKho());
        quyen.batBuocLapDot(kho.getId());
        KiemKePhamViService.LuaChon lc = luaChon(yc);
        phamVi.kiemTraLuaChon(kho, lc);
        DotKiemKe dot = new DotKiemKe();
        dot.setKho(kho);
        ganThongTin(dot, yc, kho, nguoi);
        String tienTo = IKiemKe.TIEN_TO_MA_DOT + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "-";
        dot.setMaDotKiemKe(SoChungTu.tiepTheoBaChuSo(tienTo, dotRepo.soDuoiLonNhat(tienTo)));
        dot.setTrangThai(IKiemKe.NHAP);
        dot.setPhienBan(0L);
        dot.setPhienBanPhamVi(2);
        dot.setNgayTao(Instant.now());
        dot.setNgayCapNhat(Instant.now());
        try {
            // Mã đợt lấy theo số lớn nhất trong ngày: hai người lập cùng lúc có thể ra cùng mã (cột ma_dot_kiem_ke UNIQUE).
            // Ghi ngay để bắt trùng tại đây và báo rõ, thay cho lỗi 409 chung chung lúc commit
            dot = dotRepo.saveAndFlush(dot);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            String goc = String.valueOf(org.springframework.core.NestedExceptionUtils.getMostSpecificCause(e).getMessage());
            if (!goc.contains("Duplicate") || !goc.contains("ma_dot_kiem_ke")) throw e;
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_INVALID_STATE,
                    ThongDiep.of("khoVanHanh.maDotVuaBiDung", dot.getMaDotKiemKe()));
        }
        luuLuaChon(dot, lc);
        ghiNhatKy(dot, IKiemKe.HD_TAO, "Tạo đợt " + dot.getMaDotKiemKe() + " (Nháp), phạm vi " + moTaLoai(lc.loai()), nguoi);
        return dot;
    }

    static String moTaLoai(String loai) {
        return switch (loai == null ? "" : loai) {
            case IKiemKe.TOAN_BO -> "toàn bộ kho";
            case IKiemKe.THEO_KHU_VUC -> "theo khu vực";
            case IKiemKe.THEO_KE -> "theo vị trí kệ";
            case IKiemKe.THEO_DANH_MUC -> "theo danh mục";
            default -> loai;
        };
    }

    /** UC-STK-01: lưu nháp; chưa chốt tồn, chưa khóa. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public KiemKeDto.KetQuaLenh taoNhap(KiemKeYeuCau.Dot yc) {
        sanSang.batBuoc();
        NguoiDung nguoi = quyen.nguoiHienTai();
        DotKiemKe dot = taoHeader(yc, nguoi);
        baoChuTriNeuKhacNguoi(dot, nguoi);
        return ketQua(dot, null);
    }

    /** Đ3 (chốt 10/11): người lưu nháp không phải người chủ trì thì báo người chủ trì vào bắt đầu đợt. */
    private void baoChuTriNeuKhacNguoi(DotKiemKe dot, NguoiDung nguoi) {
        NguoiDung chuTri = dot.getNguoiChuTri();
        if (chuTri != null && nguoi != null && !chuTri.getId().equals(nguoi.getId())) thongBao.choBatDau(dot, nguoi);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public KiemKeDto.KetQuaLenh suaNhap(Integer id, KiemKeYeuCau.Dot yc) {
        sanSang.batBuoc();
        NguoiDung nguoi = quyen.nguoiHienTai();
        DotKiemKe dot = khoaDot(id);
        KhoDangChon.kiemTra(dot.getKho(), ten(dot));
        quyen.batBuocSuaNhap(dot);
        if (dot.getTrangThai() != IKiemKe.NHAP) throw saiTrangThai(ThongDiep.of("khoVanHanh.chiSuaDotNhap"), dot);
        kiemTraPhienBan(dot, yc.phienBan());
        Integer chuTriCu = dot.getNguoiChuTri() == null ? null : dot.getNguoiChuTri().getId();
        if (yc.khoId() != null && !yc.khoId().equals(dot.getKho().getId())) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.khongDoiKhoCuaDot"));
        }
        KiemKePhamViService.LuaChon lc = new KiemKePhamViService.LuaChon(dot.getKho().getId(), yc.loaiKiemKe(),
                yc.khuVucIds(), yc.viTriIds(), yc.danhMucId());
        phamVi.kiemTraLuaChon(dot.getKho(), lc);
        ganThongTin(dot, yc, dot.getKho(), nguoi);
        tangPhienBan(dot);
        dotRepo.save(dot);
        luuLuaChon(dot, lc);
        ghiNhatKy(dot, IKiemKe.HD_SUA_NHAP, "Sửa nháp, phạm vi " + moTaLoai(lc.loai()), nguoi);
        // Chỉ báo khi đổi sang người chủ trì khác (không báo lại mỗi lần lưu nháp)
        if (dot.getNguoiChuTri() != null && !dot.getNguoiChuTri().getId().equals(chuTriCu)) baoChuTriNeuKhacNguoi(dot, nguoi);
        return ketQua(dot, null);
    }

    /** Xem trước phạm vi (không khóa, không ghi). Sửa nháp gửi {@code dotId} để không tự giao thoa với chính nó. */
    @Transactional(readOnly = true)
    public KiemKeDto.XemTruoc xemTruoc(KiemKeYeuCau.Dot yc, Integer dotId) {
        sanSang.batBuoc();
        Kho kho = phamVi.khoHopLe(yc.khoId());
        KhoDangChon.kiemTraXem(kho, "Kho " + kho.getTenKho());
        quyen.batBuocLapDot(kho.getId());
        KiemKePhamViService.PhamVi pv = phamVi.xacDinh(luaChon(yc), dotId, false);
        List<KiemKeDto.VanDe> vanDe = pv.vanDe().stream()
                .map(v -> new KiemKeDto.VanDe(v.ma(), v.cau().theoNgonNgu(NgonNgu.hienTai()), v.cau().tiengViet())).toList();
        List<KiemKeDto.VanDe> canhBao = pv.canhBao().stream()
                .map(v -> new KiemKeDto.VanDe(v.ma(), v.cau().theoNgonNgu(NgonNgu.hienTai()), v.cau().tiengViet())).toList();
        return new KiemKeDto.XemTruoc(pv.keIds().size(), pv.dong().size(), pv.soLo(), pv.tongSoLuong(),
                pv.danhMuc().size(), vanDe, vanDe.isEmpty(), canhBao);
    }

    // ───────────────────────────── Bắt đầu ─────────────────────────────

    /** UC-STK-01 "Tạo & bắt đầu": tạo và kích hoạt trong một giao dịch; lỗi kích hoạt thì không có đợt nào được tạo. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public KiemKeDto.KetQuaLenh taoVaBatDau(KiemKeYeuCau.Dot yc, String khoaLenh) {
        sanSang.batBuoc();
        String khoa = lenh.chuanHoa(khoaLenh);
        NguoiDung nguoi = quyen.nguoiHienTai();
        Kho kho = phamVi.khoHopLe(yc.khoId());
        guard.giuKhoGhi(kho.getId());
        String hash = lenh.bam(IKiemKe.LENH_TAO_VA_BAT_DAU, yc);
        Optional<KiemKeDto.KetQuaLenh> cu = lenh.daXuLy(kho.getId(), khoa, IKiemKe.LENH_TAO_VA_BAT_DAU, hash);
        if (cu.isPresent()) return cu.get();
        DotKiemKe dot = taoHeader(yc, nguoi);
        em.flush();
        batDauTrongGiaoDich(dot, nguoi);
        KiemKeDto.KetQuaLenh kq = ketQua(dot, null);
        lenh.ghi(kho.getId(), khoa, IKiemKe.LENH_TAO_VA_BAT_DAU, hash, kq);
        return kq;
    }

    /** UC-STK-02: kiểm điều kiện, khóa phạm vi, chốt số tồn và giá vốn — tất cả trong một giao dịch giữ mutex kho. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public KiemKeDto.KetQuaLenh batDau(Integer id, Long phienBan, String khoaLenh) {
        sanSang.batBuoc();
        String khoa = lenh.chuanHoa(khoaLenh);
        NguoiDung nguoi = quyen.nguoiHienTai();
        DotKiemKe dot = khoaDotVaKho(id);
        KhoDangChon.kiemTra(dot.getKho(), ten(dot));
        String hash = lenh.bam(IKiemKe.LENH_BAT_DAU, Map.of("id", id, "phienBan", phienBan == null ? -1 : phienBan));
        Optional<KiemKeDto.KetQuaLenh> cu = lenh.daXuLy(dot.getKho().getId(), khoa, IKiemKe.LENH_BAT_DAU, hash);
        if (cu.isPresent()) return cu.get();
        if (dot.getTrangThai() != IKiemKe.NHAP) throw saiTrangThai(ThongDiep.of("khoVanHanh.chiBatDauDotNhap"), dot);
        kiemTraPhienBan(dot, phienBan);
        phamVi.khoHopLe(dot.getKho().getId());
        batDauTrongGiaoDich(dot, nguoi);
        KiemKeDto.KetQuaLenh kq = ketQua(dot, null);
        lenh.ghi(dot.getKho().getId(), khoa, IKiemKe.LENH_BAT_DAU, hash, kq);
        return kq;
    }

    /** Đã giữ mutex kho (khóa ghi) và khóa dòng đợt Nháp. */
    private void batDauTrongGiaoDich(DotKiemKe dot, NguoiDung nguoi) {
        KiemKePhamViService.PhamVi pv = phamVi.xacDinh(luaChon(dot), dot.getId(), true);
        if (!pv.vanDe().isEmpty()) throw loiVanDe(pv.vanDe());
        Instant bayGio = Instant.now();
        String loai = pv.loai();
        Integer dotId = dot.getId();

        if (IKiemKe.THEO_DANH_MUC.equals(loai)) {
            for (Integer dm : pv.danhMuc()) dotDanhMucRepo.save(new DotKiemKePhamVi.DanhMuc(dotId, dm));
        }
        int soKe;
        if (IKiemKe.laKhoaToanKe(loai)) {
            dotViTriRepo.xoaChuaKhoaCuaDot(dotId);
            for (ViTriKho v : pv.ke()) {
                dotViTriRepo.save(DotKiemKeViTri.builder().dotKiemKeId(dotId).viTriKho(v).cheDoKhoa(IKiemKe.TOAN_KE)
                        .trangThaiKhoa(1).trangThaiTruocKhoa(v.getTrangThai()).thoiDiemKhoa(bayGio).build());
                v.setTrangThai(IKiemKe.KE_KHOA_KIEM_KE);
                viTriRepo.save(v);
            }
            soKe = pv.ke().size();
        } else {
            Map<Integer, ViTriKho> keCoHang = new TreeMap<>();
            pv.dong().forEach(t -> keCoHang.put(t.getViTriKho().getId(), t.getViTriKho()));
            for (ViTriKho v : keCoHang.values()) {
                dotViTriRepo.save(DotKiemKeViTri.builder().dotKiemKeId(dotId).viTriKho(v).cheDoKhoa(IKiemKe.THEO_LO)
                        .trangThaiKhoa(1).trangThaiTruocKhoa(v.getTrangThai()).thoiDiemKhoa(bayGio).build());
            }
            em.flush();
            for (TonKhoViTri t : pv.dong()) {
                khoaLoRepo.save(DotKiemKeKhoaLo.builder().dotKiemKeId(dotId).viTriKhoId(t.getViTriKho().getId())
                        .loHangId(t.getLoHang().getId()).trangThaiKhoa(1).thoiDiemKhoa(bayGio).build());
            }
            if (!pv.dong().isEmpty()) {
                em.createNativeQuery("UPDATE ton_kho_vi_tri SET dang_kiem_ke = 1 WHERE id IN (:ids)")
                        .setParameter("ids", pv.dong().stream().map(TonKhoViTri::getId).toList()).executeUpdate();
            }
            soKe = keCoHang.size();
        }
        em.flush();

        // Số chốt (snapshot) theo từng cặp kệ–lô: số trên sổ kệ và giá vốn của lô, một lần duy nhất (BR-STK-04)
        for (TonKhoViTri t : pv.dong()) {
            LoHang lo = t.getLoHang();
            dongRepo.save(ChiTietKiemKe.builder()
                    .dotKiemKeId(dotId)
                    .bienTheSanPham(t.getBienTheSanPham() != null ? t.getBienTheSanPham() : lo.getBienTheSanPham())
                    .loHang(lo)
                    .viTriKe(t.getViTriKho())
                    .viTriKho(t.getViTriKho().getMaViTri())
                    .soLuongHeThong(BigDecimal.valueOf(t.getSoLuong()))
                    .giaVonHeThong(lo.getGiaVon() == null ? BigDecimal.ZERO : lo.getGiaVon())
                    .soLuongThucTe(null)
                    .chenhLechSoLuong(null)
                    .tiLeChenhLech(null)
                    .giaTriChenhLech(null)
                    .lanKiemDem(1)
                    .trangThai(IKiemKe.DONG_CHUA_KIEM)
                    .phienBan(0L)
                    .ngayTao(bayGio)
                    .ngayCapNhat(bayGio)
                    .build());
        }

        dot.setTrangThai(IKiemKe.DANG_KIEM_KE);
        dot.setNgayBatDau(bayGio);
        dot.setPhienBanPhamVi(2);
        tangPhienBan(dot);
        dotRepo.save(dot);
        ghiNhatKy(dot, IKiemKe.HD_BAT_DAU, "Chốt " + pv.dong().size() + " dòng lô–kệ (" + pv.tongSoLuong() + " sp) tại "
                + soKe + " kệ; " + (IKiemKe.laKhoaToanKe(loai) ? "khóa toàn kệ" : "khóa mịn theo "
                + pv.danhMuc().size() + " danh mục"), nguoi);
        thongBao.batDau(dot, nguoi);
    }

    /** Một lỗi có mã cho danh sách vướng mắc; mã ưu tiên giao thoa → việc dở → phạm vi. */
    static LoiCoMaException loiVanDe(List<KiemKePhamViService.VanDe> vanDe) {
        List<String> uuTien = List.of(MaLoi.STK_SCOPE_CONFLICT, MaLoi.STK_PENDING_PICK, MaLoi.STK_INVALID_SCOPE);
        String ma = uuTien.stream().filter(m -> vanDe.stream().anyMatch(v -> m.equals(v.ma()))).findFirst()
                .orElse(MaLoi.STK_INVALID_SCOPE);
        HttpStatus status = MaLoi.STK_INVALID_SCOPE.equals(ma) ? HttpStatus.BAD_REQUEST : HttpStatus.CONFLICT;
        Object noi = "";
        for (int i = 0; i < vanDe.size(); i++) {
            noi = i == 0 ? vanDe.get(i).cau() : ThongDiep.of("khoVanHanh.ghepCham", noi, vanDe.get(i).cau());
        }
        ThongDiep cau = ThongDiep.of("khoVanHanh.chuaBatDauDuoc", noi);
        List<Map<String, String>> ds = vanDe.stream()
                .map(v -> Map.of("ma", v.ma(), "noiDung", v.cau().theoNgonNgu(NgonNgu.hienTai()), "noiDungGoc", v.cau().tiengViet())).toList();
        return new LoiCoMaException(status, ma, cau, Map.of("vanDe", ds));
    }

    // ───────────────────────────── Kiểm đếm ─────────────────────────────

    /** UC-STK-03: lưu số đếm một dòng (đợt Đang kiểm kê, dòng chưa xác nhận, đúng phiên bản dòng). */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ChiTietKiemKe demDong(Integer dotId, Integer dongId, KiemKeYeuCau.DemDong yc) {
        sanSang.batBuoc();
        NguoiDung nguoi = quyen.nguoiHienTai();
        DotKiemKe dot = dotRepo.khoaDocTheoId(dotId)
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE, ThongDiep.of("khoVanHanh.dotKiemKeKhongTimThay")));
        em.refresh(dot, LockModeType.PESSIMISTIC_READ);
        KhoDangChon.kiemTra(dot.getKho(), ten(dot));
        if (dot.getTrangThai() != IKiemKe.DANG_KIEM_KE) {
            throw saiTrangThai(dot.getTrangThai() == IKiemKe.CHO_DUYET
                    ? ThongDiep.of("khoVanHanh.dotDaTrinhSoDemChiXem") : ThongDiep.of("khoVanHanh.dotKhongDangKiemKe"), dot);
        }
        ChiTietKiemKe dong = dongRepo.khoaTheoId(dongId)
                .filter(d -> dotId.equals(d.getDotKiemKeId()))
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE,
                        ThongDiep.of("khoVanHanh.dongKiemKeKhongThuocDot")));
        em.refresh(dong, LockModeType.PESSIMISTIC_WRITE);
        if (dong.getTrangThai() != null && dong.getTrangThai() == IKiemKe.DONG_DA_XAC_NHAN) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_INVALID_STATE,
                    ThongDiep.of("khoVanHanh.dongDaQuanLyXacNhan"), Map.of("trangThai", (int) dong.getTrangThai()));
        }
        if (yc.phienBan() == null || !yc.phienBan().equals(dong.getPhienBan())) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_VERSION_CONFLICT,
                    ThongDiep.of("khoVanHanh.dongVuaLuuMayKhac"),
                    Map.of("phienBan", dong.getPhienBan(), "dongId", dong.getId()));
        }
        Integer t = yc.soLuongThucTe();
        if (t != null && (t < 0 || t > IKiemKe.SO_LUONG_TOI_DA)) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.STK_INVALID_SCOPE,
                    ThongDiep.of("khoVanHanh.soDemKhongHopLe", String.format("%,d", IKiemKe.SO_LUONG_TOI_DA).replace(',', '.')));
        }
        dong.setSoLuongThucTe(t == null ? null : BigDecimal.valueOf(t));
        dong.setLyDoChenhLech(chuoi(yc.lyDoChenhLech(), IKiemKe.LY_DO_TOI_DA, "khoVanHanh.lyDoChenhLechToiDaKyTu"));
        dong.setBienPhapXuLy(chuoi(yc.bienPhapXuLy(), IKiemKe.LY_DO_TOI_DA, "khoVanHanh.bienPhapXuLyToiDaKyTu"));
        KiemKeTinhToan.apDung(dong);
        if (t == null) {
            dong.setTrangThai(dong.getLanKiemDem() != null && dong.getLanKiemDem() > 1
                    ? IKiemKe.DONG_CAN_KIEM_LAI : IKiemKe.DONG_CHUA_KIEM);
            dong.setNguoiKiemDem(null);
            dong.setNgayKiemDem(null);
        } else {
            dong.setTrangThai(IKiemKe.DONG_DA_KIEM);
            dong.setNguoiKiemDem(nguoi);
            dong.setNgayKiemDem(Instant.now());
        }
        dong.setPhienBan((dong.getPhienBan() == null ? 0 : dong.getPhienBan()) + 1);
        dong.setNgayCapNhat(Instant.now());
        return dongRepo.save(dong);
    }

    /** UC-STK-03 lô phát sinh (BR-STK-11). Giữ mutex kho vì có thể thêm khóa mịn. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ChiTietKiemKe themPhatSinh(Integer dotId, KiemKeYeuCau.PhatSinh yc) {
        sanSang.batBuoc();
        NguoiDung nguoi = quyen.nguoiHienTai();
        DotKiemKe dot = khoaDotVaKho(dotId);
        KhoDangChon.kiemTra(dot.getKho(), ten(dot));
        if (dot.getTrangThai() != IKiemKe.DANG_KIEM_KE) throw saiTrangThai(ThongDiep.of("khoVanHanh.chiThemLoPhatSinhKhiDangKiem"), dot);
        Integer t = yc.soLuongThucTe();
        if (t == null || t < 1 || t > IKiemKe.SO_LUONG_TOI_DA) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.soLuongPhatSinhKhongHopLe"));
        }
        String lyDo = chuoi(yc.lyDoChenhLech(), IKiemKe.LY_DO_TOI_DA, "khoVanHanh.giaiTrinhToiDaKyTu");
        if (lyDo == null) throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.nhapGiaiTrinhLoPhatSinh"));
        LoHang lo = yc.loHangId() == null ? null : loHangRepo.findById(yc.loHangId()).orElse(null);
        if (lo == null) throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.chonLoCoTrongDanhMuc"));
        ViTriKho ke = yc.viTriKhoId() == null ? null : viTriRepo.findById(yc.viTriKhoId()).orElse(null);
        if (ke == null || ke.getKho() == null || !ke.getKho().getId().equals(dot.getKho().getId())) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.chonKeThuocKhoCuaDot"));
        }
        if (IKiemKe.KE_BAO_TRI.equals(ke.getTrangThai())) throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.keDangBaoTri", ke.getMaViTri()));
        String loai = dot.getLoaiKiemKe().name();
        DotKiemKeViTri keCuaDot = dotViTriRepo.findByDotKiemKeIdAndViTriKho_Id(dotId, ke.getId()).orElse(null);
        KhoaKiemKeGuard.TrangThaiKhoa tt = guard.trangThai(dot.getKho().getId());
        if (IKiemKe.laKhoaToanKe(loai)) {
            if (keCuaDot == null || keCuaDot.getTrangThaiKhoa() != 1) {
                throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.keNgoaiPhamVi", ke.getMaViTri()));
            }
        } else {
            Set<Integer> tap = new HashSet<>(dotDanhMucRepo.idCuaDot(dotId));
            Integer dmLo = lo.getBienTheSanPham() != null && lo.getBienTheSanPham().getSanPham() != null
                    && lo.getBienTheSanPham().getSanPham().getDanhMuc() != null
                    ? lo.getBienTheSanPham().getSanPham().getDanhMuc().getId() : null;
            if (dmLo == null || !tap.contains(dmLo)) {
                throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.loKhongThuocDanhMucDot", lo.getMaLo()));
            }
            Integer dotKhac = tt.keToanKe.get(ke.getId());
            if (dotKhac == null) dotKhac = tt.capKhoaMin.get(KhoaKiemKeGuard.khoa(ke.getId(), lo.getId()));
            if (dotKhac != null && !dotKhac.equals(dotId)) {
                throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_SCOPE_CONFLICT, ThongDiep.of("khoVanHanh.keDangDoDotKhacGiuKhoa",
                        ke.getMaViTri(), tt.maDot.get(dotKhac)));
            }
        }
        if (dongRepo.existsByDotKiemKeIdAndViTriKe_IdAndLoHang_Id(dotId, ke.getId(), lo.getId())) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.loOKeDaCoDong", lo.getMaLo(), ke.getMaViTri()));
        }
        TonKhoViTri tonKe = tonKeRepo.findByViTriKho_IdAndLoHang_Id(ke.getId(), lo.getId()).orElse(null);
        if (tonKe != null && tonKe.getSoLuong() != null && tonKe.getSoLuong() != 0) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.soKeDangGhiKhongPhaiPhatSinh", tonKe.getSoLuong(), lo.getMaLo(), ke.getMaViTri()));
        }
        Instant bayGio = Instant.now();
        if (IKiemKe.THEO_DANH_MUC.equals(loai)) {
            if (keCuaDot == null) {
                dotViTriRepo.save(DotKiemKeViTri.builder().dotKiemKeId(dotId).viTriKho(ke).cheDoKhoa(IKiemKe.THEO_LO)
                        .trangThaiKhoa(1).trangThaiTruocKhoa(ke.getTrangThai()).thoiDiemKhoa(bayGio).build());
                em.flush();
            }
            khoaLoRepo.save(DotKiemKeKhoaLo.builder().dotKiemKeId(dotId).viTriKhoId(ke.getId()).loHangId(lo.getId())
                    .trangThaiKhoa(1).thoiDiemKhoa(bayGio).build());
            if (tonKe != null) {
                em.createNativeQuery("UPDATE ton_kho_vi_tri SET dang_kiem_ke = 1 WHERE id = :id")
                        .setParameter("id", tonKe.getId()).executeUpdate();
            }
        }
        ChiTietKiemKe dong = ChiTietKiemKe.builder()
                .dotKiemKeId(dotId)
                .bienTheSanPham(lo.getBienTheSanPham())
                .loHang(lo)
                .viTriKe(ke)
                .viTriKho(ke.getMaViTri())
                .soLuongHeThong(BigDecimal.ZERO)
                .giaVonHeThong(lo.getGiaVon() == null ? BigDecimal.ZERO : lo.getGiaVon())
                .soLuongThucTe(BigDecimal.valueOf(t))
                .lyDoChenhLech(lyDo)
                .lanKiemDem(1)
                .trangThai(IKiemKe.DONG_DA_KIEM)
                .nguoiKiemDem(nguoi)
                .ngayKiemDem(bayGio)
                .phienBan(0L)
                .ngayTao(bayGio)
                .ngayCapNhat(bayGio)
                .build();
        KiemKeTinhToan.apDung(dong);
        dong = dongRepo.save(dong);
        tangPhienBan(dot);
        dotRepo.save(dot);
        ghiNhatKy(dot, IKiemKe.HD_PHAT_SINH, "Thêm lô phát sinh " + lo.getMaLo() + " tại kệ " + ke.getMaViTri() + ": "
                + t + " sp, số chốt 0", nguoi);
        return dong;
    }

    // ───────────────────────────── Trình duyệt / Đếm lại ─────────────────────────────

    /** UC-STK-04: đủ số đếm và lý do cho mọi dòng lệch → Chờ duyệt (giữ khóa). */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public KiemKeDto.KetQuaLenh trinhDuyet(Integer id, Long phienBan, String khoaLenh) {
        sanSang.batBuoc();
        String khoa = lenh.chuanHoa(khoaLenh);
        NguoiDung nguoi = quyen.nguoiHienTai();
        DotKiemKe dot = khoaDot(id);
        KhoDangChon.kiemTra(dot.getKho(), ten(dot));
        String hash = lenh.bam(IKiemKe.LENH_TRINH_DUYET, Map.of("id", id, "phienBan", phienBan == null ? -1 : phienBan));
        Optional<KiemKeDto.KetQuaLenh> cu = lenh.daXuLy(dot.getKho().getId(), khoa, IKiemKe.LENH_TRINH_DUYET, hash);
        if (cu.isPresent()) return cu.get();
        if (dot.getTrangThai() != IKiemKe.DANG_KIEM_KE) throw saiTrangThai(ThongDiep.of("khoVanHanh.chiTrinhDuyetKhiDangKiem"), dot);
        kiemTraPhienBan(dot, phienBan);
        List<ChiTietKiemKe> dong = dongRepo.khoaTheoDot(id);
        kiemTraDuSoDem(dong);
        int lech = (int) dong.stream().filter(KiemKeTinhToan::lech).count();
        long thua = dong.stream().filter(KiemKeTinhToan::lech).mapToLong(d -> Math.max(0, d.getChenhLechSoLuong().longValue())).sum();
        long thieu = dong.stream().filter(KiemKeTinhToan::lech).mapToLong(d -> Math.max(0, -d.getChenhLechSoLuong().longValue())).sum();
        dot.setTrangThai(IKiemKe.CHO_DUYET);
        dot.setNgayHoanThanh(Instant.now());
        tangPhienBan(dot);
        dotRepo.save(dot);
        ghiNhatKy(dot, IKiemKe.HD_TRINH_DUYET, "Hoàn thành kiểm đếm " + dong.size() + " dòng, lệch " + lech
                + " dòng (thiếu " + thieu + ", thừa " + thua + " sp). Chờ phê duyệt, giữ nguyên khóa", nguoi);
        thongBao.choDuyet(dot, lech, thua, thieu, nguoi);
        KiemKeDto.KetQuaLenh kq = ketQua(dot, null);
        lenh.ghi(dot.getKho().getId(), khoa, IKiemKe.LENH_TRINH_DUYET, hash, kq);
        return kq;
    }

    /** STK_COUNT_INCOMPLETE khi còn dòng chưa kiểm / cần kiểm lại hoặc dòng lệch chưa có lý do. */
    static void kiemTraDuSoDem(List<ChiTietKiemKe> dong) {
        int chuaKiem = 0, canKiemLai = 0, thieuLyDo = 0;
        for (ChiTietKiemKe d : dong) {
            byte tt = d.getTrangThai() == null ? IKiemKe.DONG_CHUA_KIEM : d.getTrangThai();
            if (d.getSoLuongThucTe() == null || tt == IKiemKe.DONG_CHUA_KIEM) {
                if (tt == IKiemKe.DONG_CAN_KIEM_LAI) canKiemLai++;
                else chuaKiem++;
            } else if (tt == IKiemKe.DONG_CAN_KIEM_LAI) {
                canKiemLai++;
            } else if (KiemKeTinhToan.lech(d) && !KiemKeTinhToan.coChu(d.getLyDoChenhLech())) {
                thieuLyDo++;
            }
        }
        if (chuaKiem + canKiemLai + thieuLyDo == 0) return;
        List<ThongDiep> phan = new ArrayList<>();
        if (chuaKiem > 0) phan.add(ThongDiep.of("khoVanHanh.mucDongChuaKiem", chuaKiem));
        if (canKiemLai > 0) phan.add(ThongDiep.of("khoVanHanh.mucDongCanKiemLai", canKiemLai));
        if (thieuLyDo > 0) phan.add(ThongDiep.of("khoVanHanh.mucDongLechChuaLyDo", thieuLyDo));
        throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_COUNT_INCOMPLETE,
                ThongDiep.of("khoVanHanh.conDongChuaXong", KiemKePhamViService.ghep(phan)),
                Map.of("chuaKiem", chuaKiem, "canKiemLai", canKiemLai, "thieuLyDo", thieuLyDo));
    }

    /** UC-STK-05: mở lại các dòng được chọn (lưu lần đếm cũ), xác nhận các dòng còn lại; giữ số chốt và khóa. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public KiemKeDto.KetQuaLenh demLai(Integer id, KiemKeYeuCau.DemLai yc, String khoaLenh) {
        sanSang.batBuoc();
        String khoa = lenh.chuanHoa(khoaLenh);
        NguoiDung nguoi = quyen.nguoiHienTai();
        DotKiemKe dot = khoaDot(id);
        KhoDangChon.kiemTra(dot.getKho(), ten(dot));
        if (!quyen.duocDuyet(quyen.nguoiXem(), dot)) {
            throw new LoiCoMaException(HttpStatus.FORBIDDEN, MaLoi.STK_INVALID_STATE,
                    ThongDiep.of("khoVanHanh.chiQuanLyKhoYeuCauDemLai"));
        }
        String hash = lenh.bam(IKiemKe.LENH_DEM_LAI, yc);
        Optional<KiemKeDto.KetQuaLenh> cu = lenh.daXuLy(dot.getKho().getId(), khoa, IKiemKe.LENH_DEM_LAI, hash);
        if (cu.isPresent()) return cu.get();
        if (dot.getTrangThai() != IKiemKe.CHO_DUYET) throw saiTrangThai(ThongDiep.of("khoVanHanh.chiYeuCauDemLaiKhiChoDuyet"), dot);
        kiemTraPhienBan(dot, yc.phienBan());
        String lyDo = chuoi(yc.lyDo(), IKiemKe.LY_DO_TOI_DA, "khoVanHanh.lyDoDemLaiToiDaKyTu");
        if (lyDo == null) throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.nhapLyDoDemLai"));
        Set<Integer> chon = yc.dongIds() == null ? Set.of() : yc.dongIds().stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (chon.isEmpty()) throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.chonItNhatMotDongDemLai"));
        List<ChiTietKiemKe> dong = dongRepo.khoaTheoDot(id);
        Set<Integer> coTrongDot = dong.stream().map(ChiTietKiemKe::getId).collect(Collectors.toSet());
        if (!coTrongDot.containsAll(chon)) throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.coDongKhongThuocDot"));

        Map<Integer, Set<Integer>> anhDaLuu = new HashMap<>();
        for (KiemKeLanDem l : lanDemRepo.theoDong(chon)) {
            anhDaLuu.computeIfAbsent(l.getChiTietKiemKeId(), k -> new HashSet<>()).addAll(docIdAnh(l.getAnhThamChieu()));
        }
        Instant bayGio = Instant.now();
        List<String> ten = new ArrayList<>();
        for (ChiTietKiemKe d : dong) {
            if (chon.contains(d.getId())) {
                List<Integer> anh = new ArrayList<>(anhRepo.idTheoDong(d.getId()));
                anh.removeAll(anhDaLuu.getOrDefault(d.getId(), Set.of()));
                lanDemRepo.save(KiemKeLanDem.builder()
                        .chiTietKiemKeId(d.getId())
                        .lanKiemDem(d.getLanKiemDem() == null ? 1 : d.getLanKiemDem())
                        .soLuongHeThong(d.getSoLuongHeThong())
                        .giaVonHeThong(d.getGiaVonHeThong() == null ? BigDecimal.ZERO : d.getGiaVonHeThong())
                        .soLuongThucTe(d.getSoLuongThucTe() == null ? BigDecimal.ZERO : d.getSoLuongThucTe())
                        .lyDoChenhLech(d.getLyDoChenhLech())
                        .bienPhapXuLy(d.getBienPhapXuLy())
                        .nguoiKiemDem(d.getNguoiKiemDem())
                        .ngayKiemDem(d.getNgayKiemDem())
                        .nguoiYeuCau(nguoi)
                        .lyDoKiemLai(lyDo)
                        .ngayYeuCau(bayGio)
                        .anhThamChieu(vietIdAnh(anh))
                        .build());
                d.setTrangThai(IKiemKe.DONG_CAN_KIEM_LAI);
                d.setLanKiemDem((d.getLanKiemDem() == null ? 1 : d.getLanKiemDem()) + 1);
                d.setSoLuongThucTe(null);
                d.setLyDoChenhLech(null);
                d.setBienPhapXuLy(null);
                d.setNguoiKiemDem(null);
                d.setNgayKiemDem(null);
                KiemKeTinhToan.apDung(d);
                ten.add((d.getViTriKho() == null ? "" : d.getViTriKho() + " / ") + (d.getLoHang() == null ? "" : d.getLoHang().getMaLo()));
            } else {
                d.setTrangThai(IKiemKe.DONG_DA_XAC_NHAN);
            }
            d.setPhienBan((d.getPhienBan() == null ? 0 : d.getPhienBan()) + 1);
            d.setNgayCapNhat(bayGio);
            dongRepo.save(d);
        }
        dot.setTrangThai(IKiemKe.DANG_KIEM_KE);
        dot.setNgayHoanThanh(null);
        tangPhienBan(dot);
        dotRepo.save(dot);
        ghiNhatKy(dot, IKiemKe.HD_DEM_LAI, "Yêu cầu đếm lại " + chon.size() + " dòng (" + KiemKePhamViService.gon(ten)
                + "): " + lyDo + ". Các dòng còn lại đã xác nhận; giữ số chốt và khóa", nguoi);
        thongBao.demLai(dot, chon.size(), lyDo, nguoi);
        KiemKeDto.KetQuaLenh kq = ketQua(dot, null);
        lenh.ghi(dot.getKho().getId(), khoa, IKiemKe.LENH_DEM_LAI, hash, kq);
        return kq;
    }

    private Set<Integer> docIdAnh(String json) {
        if (json == null || json.isBlank()) return Set.of();
        try {
            return new HashSet<>(Arrays.asList(objectMapper.readValue(json, Integer[].class)));
        } catch (Exception e) {
            return Set.of();
        }
    }

    private String vietIdAnh(List<Integer> ids) {
        try {
            return objectMapper.writeValueAsString(ids);
        } catch (Exception e) {
            return "[]";
        }
    }

    // ───────────────────────────── Hủy ─────────────────────────────

    /** UC-STK-07: hủy đợt Nháp / Đang kiểm kê / Chờ duyệt; mở đúng khóa của đợt, không đổi tồn, giữ số đếm và ảnh. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public KiemKeDto.KetQuaLenh huy(Integer id, KiemKeYeuCau.Huy yc, String khoaLenh) {
        sanSang.batBuoc();
        String khoa = lenh.chuanHoa(khoaLenh);
        NguoiDung nguoi = quyen.nguoiHienTai();
        DotKiemKe xem = dotRepo.findById(id)
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE, ThongDiep.of("khoVanHanh.dotKiemKeKhongTimThay")));
        // Ghi lại trạng thái lúc đọc: `xem` và `dot` là cùng một entity, khóa xong entity được nạp lại
        byte lucDoc = xem.getTrangThai() == null ? IKiemKe.NHAP : xem.getTrangThai();
        DotKiemKe dot = IKiemKe.dangGiuKhoa(lucDoc) ? khoaDotVaKho(id) : khoaDot(id);
        KhoDangChon.kiemTra(dot.getKho(), ten(dot));
        String hash = lenh.bam(IKiemKe.LENH_HUY, yc);
        Optional<KiemKeDto.KetQuaLenh> cu = lenh.daXuLy(dot.getKho().getId(), khoa, IKiemKe.LENH_HUY, hash);
        if (cu.isPresent()) return cu.get();
        byte truoc = dot.getTrangThai();
        if (truoc != IKiemKe.NHAP && truoc != IKiemKe.DANG_KIEM_KE && truoc != IKiemKe.CHO_DUYET) {
            throw saiTrangThai(ThongDiep.of("khoVanHanh.dotDaKetThucKhongHuy"), dot);
        }
        if (IKiemKe.dangGiuKhoa(truoc) && !IKiemKe.dangGiuKhoa(lucDoc)) {
            // Vừa được bắt đầu giữa lúc đọc và lúc khóa: làm lại theo đúng thứ tự khóa
            throw saiTrangThai(ThongDiep.of("khoVanHanh.dotVuaBatDauHuyLai"), dot);
        }
        kiemTraPhienBan(dot, yc.phienBan());
        String lyDo = chuoi(yc.lyDo(), IKiemKe.LY_DO_TOI_DA, "khoVanHanh.lyDoHuyToiDaKyTu");
        if (lyDo == null) throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.nhapLyDoHuyDot"));
        Instant bayGio = Instant.now();
        dot.setTrangThai(IKiemKe.DA_HUY);
        dot.setNguoiHuy(nguoi);
        dot.setNgayHuy(bayGio);
        dot.setLyDoHuy(lyDo);
        dot.setNgayKetThuc(bayGio);
        tangPhienBan(dot);
        dotRepo.save(dot);
        if (IKiemKe.dangGiuKhoa(truoc)) duyet.moKhoa(dot, nguoi);
        ghiNhatKy(dot, IKiemKe.HD_HUY, "Hủy: " + lyDo + (IKiemKe.dangGiuKhoa(truoc)
                ? ". Mở khóa của đợt, không điều chỉnh tồn" : ""), nguoi);
        if (IKiemKe.dangGiuKhoa(truoc)) thongBao.ketThuc(dot, false, nguoi);
        KiemKeDto.KetQuaLenh kq = ketQua(dot, null);
        lenh.ghi(dot.getKho().getId(), khoa, IKiemKe.LENH_HUY, hash, kq);
        return kq;
    }
}
