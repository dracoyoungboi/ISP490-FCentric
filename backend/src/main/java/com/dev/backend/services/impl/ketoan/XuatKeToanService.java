package com.dev.backend.services.impl.ketoan;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.TaoLoXuatKeToanRequest;
import com.dev.backend.dto.response.ketoan.ChungTuXuatKeToanDto;
import com.dev.backend.dto.response.ketoan.LoXuatKeToanDto;
import com.dev.backend.dto.response.ketoan.XemTruocXuatKeToanDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.CauHinhKeToanRepository;
import com.dev.backend.repository.ChungTuXuatKeToanRepository;
import com.dev.backend.repository.KeToanNguonRepository;
import com.dev.backend.repository.LoXuatKeToanRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.utils.SoChungTu;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Xuất dữ liệu kế toán sang AMIS Kế toán doanh nghiệp theo lô.
 *
 * <p>Một lô gồm mọi chứng từ đủ điều kiện mà chưa nằm trong lô nào còn hiệu lực, có ngày hạch toán từ ngày mốc đến hết
 * "ngày chốt" (chọn ngày chốt thay vì khoảng ngày để không sót chứng từ): tồn đầu kỳ (chỉ lô đầu), mua hàng, chuyển
 * kho hai bước, bán hàng, kèm danh mục đầy đủ (kế toán nhập ở chế độ Cập nhật). Chứng từ có lỗi chặn bị để lại cho lô
 * sau. Tạo lô thì khóa chứng từ (chung_tu_xuat_ke_toan, UNIQUE theo chứng từ còn hiệu lực) và lưu tệp nén kèm SHA-256.</p>
 *
 * <p>Đơn đã giao kế toán rồi bị hoàn trả vẫn được hoàn trả (chốt 25/10/2026): màn xuất liệt kê ở "Phát sinh sau khi
 * xuất" để kế toán lập Hàng bán trả lại trên AMIS (đợt 2 sẽ tự sinh chứng từ này).</p>
 */
@Service
public class XuatKeToanService {

    public static final ZoneId MUI_GIO = DungChungTuAmis.MUI_GIO;
    private static final DateTimeFormatter NGAY_SO_LO = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter GIO = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    static final int LY_DO_TOI_DA = 500;

    private final CauHinhKeToanService cauHinhKeToanService;
    private final CauHinhKeToanRepository cauHinhKeToanRepository;
    private final ThueSuatService thueSuatService;
    private final KeToanNguonRepository nguon;
    private final LoXuatKeToanRepository loXuatRepository;
    private final ChungTuXuatKeToanRepository chungTuRepository;
    private final LichSuThayDoiService lichSuThayDoiService;
    private final Clock dongHo;

    @Autowired
    public XuatKeToanService(CauHinhKeToanService cauHinhKeToanService,
                             CauHinhKeToanRepository cauHinhKeToanRepository,
                             ThueSuatService thueSuatService,
                             KeToanNguonRepository nguon,
                             LoXuatKeToanRepository loXuatRepository,
                             ChungTuXuatKeToanRepository chungTuRepository,
                             LichSuThayDoiService lichSuThayDoiService) {
        this(cauHinhKeToanService, cauHinhKeToanRepository, thueSuatService, nguon, loXuatRepository, chungTuRepository,
                lichSuThayDoiService, Clock.system(MUI_GIO));
    }

    /** Cho test: đồng hồ cố định. */
    XuatKeToanService(CauHinhKeToanService cauHinhKeToanService,
                      CauHinhKeToanRepository cauHinhKeToanRepository,
                      ThueSuatService thueSuatService,
                      KeToanNguonRepository nguon,
                      LoXuatKeToanRepository loXuatRepository,
                      ChungTuXuatKeToanRepository chungTuRepository,
                      LichSuThayDoiService lichSuThayDoiService,
                      Clock dongHo) {
        this.cauHinhKeToanService = cauHinhKeToanService;
        this.cauHinhKeToanRepository = cauHinhKeToanRepository;
        this.thueSuatService = thueSuatService;
        this.nguon = nguon;
        this.loXuatRepository = loXuatRepository;
        this.chungTuRepository = chungTuRepository;
        this.lichSuThayDoiService = lichSuThayDoiService;
        this.dongHo = dongHo;
    }

    /** Kết quả dựng một lô (dùng chung cho xem trước và tạo lô). */
    record Lo(CauHinhKeToan cauHinh, LocalDate denNgay, DungChungTuAmis.KetQua ketQua, boolean coTonDauKy,
              List<NguonKeToan.SauXuat> sauXuat, List<DungChungTuAmis.VanDe> bienDongKho,
              XemTruocXuatKeToanDto.DoiChieu doiChieu, String lyDoKhongTheTao) {
    }

    static final String LOAI_BIEN_DONG_KHO = "bien_dong_kho";

    // ── Xem trước ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public XemTruocXuatKeToanDto xemTruoc(LocalDate denNgay) {
        return toXemTruoc(dung(cauHinhKeToanService.lay(), denNgay));
    }

    // ── Tạo lô ─────────────────────────────────────────────────────────────

    @Transactional
    public LoXuatKeToanDto taoLo(TaoLoXuatKeToanRequest req) {
        if (req == null || req.getDenNgay() == null) {
            throw new CommonException("Chọn ngày ở ô Xuất đến hết ngày");
        }
        String ghiChu = req.getGhiChu() == null ? null : req.getGhiChu().trim();
        if (ghiChu != null && ghiChu.length() > LY_DO_TOI_DA) {
            throw new CommonException("Ghi chú tối đa 500 ký tự");
        }
        // Khóa dòng cấu hình: hai người tạo lô cùng lúc thì chạy lần lượt, người sau thấy chứng từ đã vào lô trước
        CauHinhKeToan ch = cauHinhKeToanRepository.findByIdForUpdate(CauHinhKeToan.ID)
                .orElseThrow(() -> new CommonException("Chưa có cấu hình xuất kế toán. Báo quản trị hệ thống."));
        Lo lo = dung(ch, req.getDenNgay());
        if (lo.lyDoKhongTheTao() != null) {
            throw new CommonException(HttpStatus.CONFLICT, lo.lyDoKhongTheTao());
        }
        if (req.getDauVet() != null && !req.getDauVet().equals(dauVet(lo.ketQua()))) {
            throw new CommonException(HttpStatus.CONFLICT,
                    "Dữ liệu đã thay đổi sau lần kiểm tra (có chứng từ mới, vừa sửa hoặc vừa mở khóa). Kiểm tra lại rồi tạo lô.");
        }
        NguoiDung nguoi = cauHinhKeToanService.nguoiDangThucHien();
        LocalDateTime bayGio = LocalDateTime.now(dongHo);
        String tienTo = "KT-" + bayGio.toLocalDate().format(NGAY_SO_LO) + "-";
        String soLo = SoChungTu.tiepTheo(tienTo, loXuatRepository.soDuoiLonNhat(tienTo));

        byte[] zip = dongGoi(soLo, lo, nguoi.getHoTen(), bayGio);
        List<DungChungTuAmis.ChungTu> dsCt = lo.ketQua().chungTu();
        TongBan tongBan = tongBan(dsCt);
        LoXuatKeToan entity = LoXuatKeToan.builder()
                .soLo(soLo)
                .hoSo(ch.getHoSo())
                .denNgay(lo.denNgay())
                .tuNgay(dsCt.stream().map(DungChungTuAmis.ChungTu::ngayHachToan).min(Comparator.naturalOrder()).orElse(null))
                .coTonDauKy(lo.coTonDauKy())
                .soChungTu(dsCt.size())
                .tongTruocThue(tongBan.truocThue())
                .tongThue(tongBan.thue())
                .tongCong(tongBan.tongCong())
                .tenTep(soLo + ".zip")
                .tep(zip)
                .kichThuoc(zip.length)
                .maBam(sha256(zip))
                .ghiChu(ghiChu == null || ghiChu.isEmpty() ? null : ghiChu)
                .nguoiTao(nguoi)
                .ngayTao(Instant.now(dongHo))
                .build();
        entity = loXuatRepository.save(entity);

        List<ChungTuXuatKeToan> khoa = new ArrayList<>();
        for (DungChungTuAmis.ChungTu ct : dsCt) {
            khoa.add(ChungTuXuatKeToan.builder()
                    .loXuat(entity)
                    .loai(ct.loai())
                    .idNguon(ct.idNguon())
                    .soChungTu(cat(ct.soChungTu(), 60))
                    .ngayHachToan(ct.ngayHachToan())
                    .tongTien(ct.tongTien())
                    .trangThai(ChungTuXuatKeToan.TRANG_THAI_DA_XUAT)
                    .build());
        }
        try {
            chungTuRepository.saveAllAndFlush(khoa);
        } catch (DataIntegrityViolationException e) {
            throw new CommonException(HttpStatus.CONFLICT,
                    "Có chứng từ vừa được xuất ở một lô khác. Bấm Kiểm tra lại rồi tạo lô.");
        }

        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.lo_xuat_ke_toan)
                .idThamChieu(entity.getId())
                .hanhDong(IHanhDong.tao_lo_xuat_ke_toan)
                .giaTriMoi("{\"soLo\":\"" + soLo + "\",\"denNgay\":\"" + lo.denNgay() + "\",\"soChungTu\":" + dsCt.size()
                        + ",\"tongCong\":" + tongBan.tongCong().toPlainString() + ",\"maBam\":\"" + entity.getMaBam() + "\"}")
                .nguoiThucHien(nguoi)
                .ngayThucHien(Instant.now(dongHo))
                .ghiChu(entity.getGhiChu())
                .build());
        return loXuatRepository.tomTat(entity.getId()).orElseThrow();
    }

    // ── Lô đã tạo ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<LoXuatKeToanDto> danhSachLo() {
        return loXuatRepository.danhSach();
    }

    @Transactional(readOnly = true)
    public List<ChungTuXuatKeToanDto> chungTuCuaLo(Integer loId) {
        if (!loXuatRepository.existsById(loId)) {
            throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy lô xuất");
        }
        return chungTuRepository.findByLoXuatId(loId).stream().map(c -> ChungTuXuatKeToanDto.builder()
                .id(c.getId())
                .loai(c.getLoai())
                .idNguon(c.getIdNguon())
                .soChungTu(c.getSoChungTu())
                .ngayHachToan(c.getNgayHachToan())
                .tongTien(c.getTongTien())
                .trangThai(c.getTrangThai())
                .nguoiMoKhoa(c.getNguoiMoKhoa() == null ? null : c.getNguoiMoKhoa().getHoTen())
                .moKhoaLuc(c.getMoKhoaLuc())
                .lyDoMoKhoa(c.getLyDoMoKhoa())
                .build()).toList();
    }

    public record TepTai(String ten, byte[] noiDung, String maBam) {
    }

    /** Tệp nén đúng bản đã giao (kiểm lại SHA-256 trước khi trả). */
    @Transactional(readOnly = true)
    public TepTai taiTep(Integer loId) {
        LoXuatKeToan lo = loXuatRepository.findById(loId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy lô xuất"));
        if (!sha256(lo.getTep()).equals(lo.getMaBam())) {
            throw new CommonException(HttpStatus.CONFLICT, "Tệp của lô " + lo.getSoLo() + " không khớp mã băm đã lưu. Báo quản trị hệ thống.");
        }
        return new TepTai(lo.getTenTep(), lo.getTep(), lo.getMaBam());
    }

    // ── Mở khóa ────────────────────────────────────────────────────────────

    /**
     * Mở khóa khẩn cấp một chứng từ đã giao: chứng từ quay về "chưa xuất" và vào lô sau. Kế toán phải xóa chứng từ cũ
     * trên AMIS trước khi nhập lại (AMIS chỉ thêm mới, trùng số thì báo lỗi). Mỗi lần mở đều ghi nhật ký kèm lý do.
     */
    @Transactional
    public ChungTuXuatKeToanDto moKhoa(Integer chungTuId, String lyDo) {
        String gon = lyDo == null ? "" : lyDo.trim();
        if (gon.isEmpty()) {
            throw new CommonException("Nhập lý do mở khóa");
        }
        if (gon.length() > LY_DO_TOI_DA) {
            throw new CommonException("Lý do tối đa 500 ký tự");
        }
        ChungTuXuatKeToan ct = chungTuRepository.findByIdForUpdate(chungTuId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy chứng từ trong lô"));
        if (!ChungTuXuatKeToan.TRANG_THAI_DA_XUAT.equals(ct.getTrangThai())) {
            throw new CommonException(HttpStatus.CONFLICT, "Chứng từ " + ct.getSoChungTu() + " đã được mở khóa trước đó.");
        }
        NguoiDung nguoi = cauHinhKeToanService.nguoiDangThucHien();
        String soLo = chungTuRepository.soLoCua(ct.getId()).orElse("");
        ct.setTrangThai(ChungTuXuatKeToan.TRANG_THAI_DA_MO_KHOA);
        ct.setNguoiMoKhoa(nguoi);
        ct.setMoKhoaLuc(Instant.now(dongHo));
        ct.setLyDoMoKhoa(gon);
        chungTuRepository.save(ct);
        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.chung_tu_xuat_ke_toan)
                .idThamChieu(ct.getId())
                .hanhDong(IHanhDong.mo_khoa_chung_tu_ke_toan)
                .giaTriCu("{\"trangThai\":\"da_xuat\",\"soLo\":\"" + soLo + "\"}")
                .giaTriMoi("{\"trangThai\":\"da_mo_khoa\",\"loai\":\"" + ct.getLoai() + "\",\"idNguon\":" + ct.getIdNguon()
                        + ",\"soChungTu\":\"" + ct.getSoChungTu().replace("\"", "'") + "\"}")
                .nguoiThucHien(nguoi)
                .ngayThucHien(Instant.now(dongHo))
                .ghiChu(gon)
                .build());
        return ChungTuXuatKeToanDto.builder()
                .id(ct.getId()).loai(ct.getLoai()).idNguon(ct.getIdNguon()).soChungTu(ct.getSoChungTu())
                .ngayHachToan(ct.getNgayHachToan()).tongTien(ct.getTongTien()).trangThai(ct.getTrangThai())
                .nguoiMoKhoa(nguoi.getHoTen()).moKhoaLuc(ct.getMoKhoaLuc()).lyDoMoKhoa(gon)
                .build();
    }

    // ── Dựng lô ────────────────────────────────────────────────────────────

    Lo dung(CauHinhKeToan ch, LocalDate denNgay) {
        LocalDate homNay = LocalDate.now(dongHo);
        if (ch.getNgayMoc() == null) {
            return rong(ch, denNgay, "Chưa đặt ngày mốc ở Cấu hình › Xuất kế toán (trùng \"Ngày bắt đầu dữ liệu\" trên AMIS).");
        }
        if (denNgay == null) {
            return rong(ch, null, "Chọn ngày ở ô Xuất đến hết ngày.");
        }
        if (denNgay.isBefore(ch.getNgayMoc())) {
            return rong(ch, denNgay, "Xuất đến hết ngày phải từ ngày mốc " + ch.getNgayMoc().format(GhiTepAmis.NGAY) + " trở đi.");
        }
        if (denNgay.isAfter(homNay)) {
            return rong(ch, denNgay, "Xuất đến hết ngày không được sau hôm nay.");
        }
        Instant tu = ch.getNgayMoc().atStartOfDay(MUI_GIO).toInstant();
        Instant den = denNgay.plusDays(1).atStartOfDay(MUI_GIO).toInstant();
        DungChungTuAmis bo = new DungChungTuAmis(ch, thueSuatService.boTra());

        boolean canTonDauKy = !chungTuRepository.existsByLoaiAndIdNguonAndTrangThai(
                ChungTuXuatKeToan.LOAI_TON_DAU_KY, 0, ChungTuXuatKeToan.TRANG_THAI_DA_XUAT);
        if (canTonDauKy) {
            bo.tonDauKy(nguon.tonTaiMoc(tu), ch.getNgayMoc());
        }

        List<NguonKeToan.PhieuMua> mua = nguon.phieuMuaChuaXuat(tu, den);
        Map<Integer, List<NguonKeToan.DongMua>> dongMua = nguon.dongPhieuMua(ids(mua, NguonKeToan.PhieuMua::id)).stream()
                .collect(Collectors.groupingBy(NguonKeToan.DongMua::phieuId, LinkedHashMap::new, Collectors.toList()));
        bo.muaHang(mua, dongMua);

        List<NguonKeToan.PhieuChuyen> chuyenXuat = nguon.chuyenKhoXuatChuaXuat(tu, den);
        List<NguonKeToan.PhieuChuyen> chuyenNhan = nguon.chuyenKhoNhanChuaXuat(tu, den);
        Map<String, List<NguonKeToan.DongChuyen>> dongChuyen = new HashMap<>();
        for (NguonKeToan.DongChuyen d : nguon.dongChuyenKhoXuat(ids(chuyenXuat, NguonKeToan.PhieuChuyen::id))) {
            dongChuyen.computeIfAbsent(DungChungTuAmis.khoaChuyen(d.loai(), d.phieuId()), k -> new ArrayList<>()).add(d);
        }
        for (NguonKeToan.DongChuyen d : nguon.dongChuyenKhoNhan(ids(chuyenNhan, NguonKeToan.PhieuChuyen::id))) {
            dongChuyen.computeIfAbsent(DungChungTuAmis.khoaChuyen(d.loai(), d.phieuId()), k -> new ArrayList<>()).add(d);
        }
        List<NguonKeToan.PhieuChuyen> chuyen = new ArrayList<>(chuyenXuat);
        chuyen.addAll(chuyenNhan);
        chuyen.sort(Comparator.comparing(NguonKeToan.PhieuChuyen::ngay));
        bo.chuyenKho(chuyen, dongChuyen);

        List<NguonKeToan.DonBan> don = nguon.donBanChuaXuat(tu, den);
        Map<Integer, List<NguonKeToan.DongBan>> dongBan = nguon.dongDonBan(ids(don, NguonKeToan.DonBan::id)).stream()
                .collect(Collectors.groupingBy(NguonKeToan.DongBan::donId, LinkedHashMap::new, Collectors.toList()));
        bo.banHang(don, dongBan);

        DungChungTuAmis.KetQua kq = bo.ketQua();
        if (!kq.chungTu().isEmpty()) {
            Set<String> maKhach = new HashSet<>();
            Set<Integer> donTrongLo = kq.chungTu().stream()
                    .filter(c -> ChungTuXuatKeToan.LOAI_BAN_HANG.equals(c.loai()))
                    .map(DungChungTuAmis.ChungTu::idNguon).collect(Collectors.toSet());
            for (NguonKeToan.DonBan d : don) {
                if (donTrongLo.contains(d.id())) maKhach.add(d.maKhachHang());
            }
            bo.danhMuc(nguon.kho(), nguon.khachHang(maKhach), nguon.nhaCungCap(), nguon.hangHoa(), denNgay);
        }

        // Đối chiếu với Báo cáo doanh thu cùng khoảng ngày
        Map<Integer, BigDecimal> tongDon = new HashMap<>();
        for (NguonKeToan.DonBan d : don) tongDon.put(d.id(), TachThue.dong(d.tongCong()));
        BigDecimal baoCao = TachThue.dong(nguon.doanhThuBaoCao(tu, den));
        BigDecimal loTruoc = TachThue.dong(nguon.doanhThuDaGiao(ch.getNgayMoc(), denNgay));
        BigDecimal trongLo = tongBan(kq.chungTu()).tongCong();
        BigDecimal biChan = kq.chan().stream()
                .filter(v -> ChungTuXuatKeToan.LOAI_BAN_HANG.equals(v.loai()) && v.idNguon() != null)
                .map(v -> tongDon.getOrDefault(v.idNguon(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        XemTruocXuatKeToanDto.DoiChieu doiChieu = XemTruocXuatKeToanDto.DoiChieu.builder()
                .doanhThuBaoCao(baoCao)
                .doanhThuLoTruoc(loTruoc)
                .doanhThuTrongLo(trongLo)
                .doanhThuBiChan(biChan)
                .chenhLech(baoCao.subtract(loTruoc).subtract(trongLo).subtract(biChan))
                .build();

        String lyDo = null;
        boolean tonBiChan = kq.chan().stream().anyMatch(v -> ChungTuXuatKeToan.LOAI_TON_DAU_KY.equals(v.loai()));
        if (canTonDauKy && tonBiChan) {
            lyDo = "Tồn đầu kỳ bị chặn nên chưa tạo được lô đầu tiên (AMIS sẽ báo tồn âm cho mọi phiếu xuất). Xem lỗi chặn.";
        } else if (kq.chungTu().isEmpty()) {
            lyDo = "Không có chứng từ mới nào đến hết ngày " + denNgay.format(GhiTepAmis.NGAY) + ".";
        }
        // Biến động kho chưa có chứng từ: chỉ phần phát sinh sau lô trước (mỗi biến động hiện ở đúng một lô)
        LocalDate denLoTruoc = loXuatRepository.denNgayMuonNhat();
        Instant tuBienDong = tu;
        if (denLoTruoc != null && !denLoTruoc.isBefore(ch.getNgayMoc())) {
            tuBienDong = denLoTruoc.plusDays(1).atStartOfDay(MUI_GIO).toInstant();
            // Lô trước tạo khi chưa hết ngày "xuất đến" của nó (xuất đến hết hôm nay): biến động sau lúc tạo lô đó chưa
            // lô nào liệt kê, nên lô này liệt kê từ lúc tạo lô trước
            Instant taoLoTruoc = loXuatRepository.ngayTaoLoDenMuonNhat();
            if (taoLoTruoc != null && taoLoTruoc.isBefore(tuBienDong)) {
                tuBienDong = taoLoTruoc.isBefore(tu) ? tu : taoLoTruoc;
            }
        }
        List<DungChungTuAmis.VanDe> bienDong = tuBienDong.isBefore(den)
                ? nguon.bienDongKhoKhongCoChungTu(tuBienDong, den, tu).stream().map(XuatKeToanService::bienDong).toList()
                : List.of();
        return new Lo(ch, denNgay, kq, canTonDauKy, nguon.donDaXuatBiHoanTra(), bienDong, doiChieu, lyDo);
    }

    private Lo rong(CauHinhKeToan ch, LocalDate denNgay, String lyDo) {
        return new Lo(ch, denNgay, new DungChungTuAmis.KetQua(), false, List.of(), List.of(), null, lyDo);
    }

    static DungChungTuAmis.VanDe bienDong(NguonKeToan.BienDongKho b) {
        // Không có số chứng từ: ghi nhãn chung kèm id (loai_tham_chieu là mã nội bộ, không đưa ra màn hình)
        String ma = b.soChungTu() != null ? b.soChungTu()
                : ("kiem_ke".equals(b.nhom()) ? "Kiểm kê" : "Giao dịch kho") + (b.idThamChieu() == null ? "" : " #" + b.idThamChieu());
        String luong = (b.tang().signum() > 0 ? "tăng " + soLuong(b.tang()) : "")
                + (b.tang().signum() > 0 && b.giam().signum() > 0 ? ", " : "")
                + (b.giam().signum() > 0 ? "giảm " + soLuong(b.giam()) : "")
                + " (" + b.soDong() + " dòng)";
        String noiDung = switch (b.nhom()) {
            case "kiem_ke" -> "Điều chỉnh kiểm kê ở kho " + b.maKho() + ": " + luong
                    + ". Lập phiếu nhập / xuất kho điều chỉnh trên AMIS.";
            case "xuat_khac" -> "Xuất kho khác ở kho " + b.maKho() + ": " + luong + ". Lập phiếu xuất kho trên AMIS.";
            case "nhap_lai_ban_truoc_moc" -> "Hàng của phiếu xuất bán trước ngày mốc nhập lại kho " + b.maKho() + ": " + luong
                    + ". Lập Hàng bán trả lại hoặc phiếu nhập kho trên AMIS.";
            case "nhap_hang_hoan" -> "Hàng hoàn của đơn bán nhập lại kho " + b.maKho() + ": " + luong
                    + (b.ghiChu() == null || b.ghiChu().isBlank() ? "" : " — " + b.ghiChu().trim())
                    + ". Đơn đã giao kế toán thì lập Hàng bán trả lại; đơn bán trước ngày mốc thì lập phiếu nhập kho trên AMIS;"
                    + " đơn chưa từng giao kế toán (hủy, hoàn trả trước khi xuất) thì không lập gì: phiếu xuất của đơn cũng"
                    + " không sang kế toán.";
            case "xuat_ban_khong_doanh_thu" -> "Phiếu xuất bán của đơn đã hủy / bị hoàn trả ở kho " + b.maKho() + ": " + luong
                    + (b.ghiChu() == null || b.ghiChu().isBlank() ? "" : " — " + b.ghiChu().trim())
                    + ". Đơn không ghi doanh thu nên phiếu này không sang kế toán. Hàng đã nhập lại kho (phiếu PN-RET của"
                    + " đơn) thì không lập gì; hàng không về thì lập phiếu xuất kho khác trên AMIS.";
            case "nhap_khac" -> "Phiếu nhập không từ đơn mua, không từ chuyển kho ở kho " + b.maKho() + ": " + luong
                    + ". Lập phiếu nhập kho trên AMIS.";
            case "ghi_giam_chuyen_kho" -> "Ghi giảm hao hụt chuyển kho (hàng thiếu, hỏng khi nhận) ở kho " + b.maKho() + ": " + luong
                    + (b.ghiChu() == null || b.ghiChu().isBlank() ? "" : " — " + b.ghiChu().trim())
                    + ". Lập phiếu xuất kho từ kho này trên AMIS, hạch toán theo cách xử lý hàng thiếu của công ty.";
            default -> "Biến động kho " + b.maKho() + " không có chứng từ kế toán: " + luong + ". Xem tay.";
        };
        return new DungChungTuAmis.VanDe(LOAI_BIEN_DONG_KHO, b.idThamChieu(), ma, noiDung);
    }

    private static String soLuong(BigDecimal so) {
        return so.stripTrailingZeros().toPlainString();
    }

    // ── Đóng gói ───────────────────────────────────────────────────────────

    byte[] dongGoi(String soLo, Lo lo, String nguoiTao, LocalDateTime luc) {
        DungChungTuAmis.KetQua kq = lo.ketQua();
        try (ByteArrayOutputStream ra = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(ra, StandardCharsets.UTF_8)) {
            ghiMuc(zip, "00_HUONG_DAN.txt", huongDan(soLo, lo, nguoiTao, luc).getBytes(StandardCharsets.UTF_8));
            for (DungChungTuAmis.Tep t : kq.tep()) {
                HoSoAmis.Mau mau = HoSoAmis.mau(t.mau());
                List<String> dau = List.of(
                        "TỆP XUẤT TỪ F CENTRIC ĐỂ NHẬP VÀO AMIS KẾ TOÁN — " + tenMau(t.mau()) + " — lô " + soLo,
                        "Khi nhập: chọn sheet \"" + mau.sheet() + "\", Dòng tiêu đề là dòng số " + mau.dongTieuDe() + ".",
                        "Tên cột chép đúng tệp mẫu nâng cao của AMIS; không đổi tên, không chèn cột phía trên dòng tiêu đề.",
                        "Tạo lúc " + luc.format(GIO) + " bởi " + nguoiTao + ".");
                ghiMuc(zip, t.ten() + ".xlsx", GhiTepAmis.ghi(mau, t.dong(), dau));
            }
            ghiMuc(zip, "90_DoiChieu.xlsx", GhiDoiChieu.ghi(soLo, lo.cauHinh().getNgayMoc(), lo.denNgay(), tongHopDoiChieu(kq),
                    kq.chungTu(), vanDeDoiChieu(lo), dongDoiChieu(lo.doiChieu())));
            zip.finish();
            return ra.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Không đóng gói được tệp nén", e);
        }
    }

    private static void ghiMuc(ZipOutputStream zip, String ten, byte[] noiDung) throws IOException {
        zip.putNextEntry(new ZipEntry(ten));
        zip.write(noiDung);
        zip.closeEntry();
    }

    String huongDan(String soLo, Lo lo, String nguoiTao, LocalDateTime luc) {
        StringBuilder sb = new StringBuilder();
        String n = "\r\n";
        sb.append('﻿');
        sb.append("HƯỚNG DẪN NHẬP VÀO AMIS KẾ TOÁN (DOANH NGHIỆP)").append(n);
        sb.append("Lô ").append(soLo).append(" — tạo lúc ").append(luc.format(GIO)).append(" bởi ").append(nguoiTao).append(n);
        sb.append("Gồm chứng từ chưa giao có ngày hạch toán từ ").append(lo.cauHinh().getNgayMoc().format(GhiTepAmis.NGAY))
                .append(" (ngày mốc) đến hết ").append(lo.denNgay().format(GhiTepAmis.NGAY)).append('.').append(n).append(n);
        sb.append("Nhập ĐÚNG THỨ TỰ dưới đây. Hàng phải vào kho trước khi xuất: nhập hết mua hàng và chuyển kho trước bán").append(n)
                .append("hàng, nếu không AMIS báo tồn âm (đang đặt \"không cho xuất quá số lượng tồn\").").append(n).append(n);
        int stt = 1;
        for (DungChungTuAmis.Tep t : lo.ketQua().tep()) {
            HoSoAmis.Mau mau = HoSoAmis.mau(t.mau());
            sb.append(stt++).append(". ").append(t.ten()).append(".xlsx — ").append(noiNhap(t.mau()))
                    .append(". Dòng tiêu đề là dòng số ").append(mau.dongTieuDe()).append('.').append(n);
            String luuY = luuYGhepCot(t.mau());
            if (luuY != null) {
                sb.append("   ").append(luuY).append(n);
            }
        }
        sb.append(n);
        sb.append("Danh mục: chọn phương thức nhập \"Cập nhật\" (mã đã có thì sửa theo tệp, mã mới thì thêm).").append(n);
        sb.append("Chứng từ: AMIS chỉ thêm mới. Muốn sửa chứng từ đã nhập: xóa trên AMIS, nhờ quản trị viên F Centric mở khóa").append(n)
                .append("chứng từ đó ở màn Xuất dữ liệu kế toán, rồi tạo lô mới.").append(n);
        sb.append("Hóa đơn điện tử: tệp để trống số hóa đơn; kế toán phát hành trên MISA meInvoice.").append(n);
        sb.append("Giá vốn: để trống, AMIS tính theo phương pháp đã đăng ký (bình quân cuối kỳ).").append(n);
        sb.append("Đối chiếu sau khi nhập: 90_DoiChieu.xlsx. Mã băm SHA-256 của tệp nén xem ở màn Xuất dữ liệu kế toán.").append(n);
        if (!lo.sauXuat().isEmpty()) {
            sb.append(n).append("Đơn đã giao kế toán rồi bị hoàn trả (lập Hàng bán trả lại trên AMIS):").append(n);
            for (NguonKeToan.SauXuat s : lo.sauXuat()) {
                sb.append("  - ").append(s.soDon()).append(" (đã giao ở lô ").append(s.soLo()).append(')').append(n);
            }
        }
        if (!lo.bienDongKho().isEmpty()) {
            sb.append(n).append("Biến động kho không có chứng từ trong lô (lập tay trên AMIS trước khi nhập bán hàng):").append(n);
            for (DungChungTuAmis.VanDe v : lo.bienDongKho()) {
                sb.append("  - ").append(v.soChungTu()).append(": ").append(v.noiDung()).append(n);
            }
        }
        return sb.toString();
    }

    private static String noiNhap(String mau) {
        return switch (mau) {
            case HoSoAmis.KHO -> "Danh mục › Kho › Nhập từ Excel";
            case HoSoAmis.KHACH_HANG -> "Danh mục › Khách hàng › Nhập từ Excel";
            case HoSoAmis.NHA_CUNG_CAP -> "Danh mục › Nhà cung cấp › Nhập từ Excel";
            case HoSoAmis.VAT_TU_HANG_HOA -> "Danh mục › Vật tư hàng hóa › Thêm › Nhập từ Excel";
            case HoSoAmis.TON_DAU_KY -> "Số dư ban đầu › Tồn kho vật tư, hàng hóa và CCDC › Nhập số dư từ Excel";
            case HoSoAmis.MUA_HANG -> "Mua hàng › Mua hàng › Nhập từ Excel, loại \"Mua hàng trong nước\"";
            case HoSoAmis.CHUYEN_KHO -> "Kho › Nhập kho › Nhập từ Excel, loại \"Chuyển kho\"";
            case HoSoAmis.BAN_HANG -> "Bán hàng › Bán hàng › Nhập từ Excel, loại \"Bán hàng hóa\"";
            default -> mau;
        };
    }

    /**
     * Cột tệp có dữ liệu nhưng AMIS ẩn sẵn ở bước Ghép dữ liệu (đã thử trên AMIS dùng thử 25/10/2026): không bật thì AMIS
     * bỏ qua cột đó khi nhập.
     */
    static String luuYGhepCot(String mau) {
        return switch (mau) {
            case HoSoAmis.KHACH_HANG, HoSoAmis.NHA_CUNG_CAP -> "Ở bước Ghép dữ liệu, bấm \"Ẩn/hiện thông tin\", tick Điện thoại,"
                    + " Là tổ chức/cá nhân, Họ và tên NLH, Email rồi Đồng ý (AMIS ẩn sẵn 4 cột này, không bật thì mất các thông tin đó).";
            case HoSoAmis.VAT_TU_HANG_HOA -> "Ở bước Ghép dữ liệu, bấm \"Ẩn/hiện thông tin\", tick Là đơn giá bán sau thuế rồi Đồng ý"
                    + " (đơn giá bán trong tệp đã gồm thuế GTGT).";
            default -> null;
        };
    }

    private static String tenMau(String mau) {
        return switch (mau) {
            case HoSoAmis.KHO -> "DANH MỤC KHO";
            case HoSoAmis.KHACH_HANG -> "DANH MỤC KHÁCH HÀNG";
            case HoSoAmis.NHA_CUNG_CAP -> "DANH MỤC NHÀ CUNG CẤP";
            case HoSoAmis.VAT_TU_HANG_HOA -> "DANH MỤC VẬT TƯ HÀNG HÓA";
            case HoSoAmis.TON_DAU_KY -> "TỒN KHO ĐẦU KỲ";
            case HoSoAmis.MUA_HANG -> "MUA HÀNG TRONG NƯỚC NHẬP KHO";
            case HoSoAmis.CHUYEN_KHO -> "CHUYỂN KHO";
            case HoSoAmis.BAN_HANG -> "BÁN HÀNG HÓA KIÊM PHIẾU XUẤT KHO";
            default -> mau;
        };
    }

    // ── Chuyển sang DTO ────────────────────────────────────────────────────

    XemTruocXuatKeToanDto toXemTruoc(Lo lo) {
        DungChungTuAmis.KetQua kq = lo.ketQua();
        List<XemTruocXuatKeToanDto.TongHopLoai> tongHop = tongHopTheoLoai(kq).stream()
                .map(t -> XemTruocXuatKeToanDto.TongHopLoai.builder()
                        .loai(t.loai()).ten(tenLoai(t.loai())).soChungTu(t.soChungTu()).soDong(t.soDong())
                        .truocThue(t.truocThue()).thue(t.thue()).tongCong(t.tongCong()).build())
                .toList();
        return XemTruocXuatKeToanDto.builder()
                .ngayMoc(lo.cauHinh().getNgayMoc())
                .denNgay(lo.denNgay())
                .tuNgay(kq.chungTu().stream().map(DungChungTuAmis.ChungTu::ngayHachToan).min(Comparator.naturalOrder()).orElse(null))
                .coTonDauKy(lo.coTonDauKy())
                .tongHop(tongHop)
                .loiChan(kq.chan().stream().map(XuatKeToanService::vanDe).toList())
                .canhBao(kq.canhBao().stream().map(XuatKeToanService::vanDe).toList())
                .phatSinhSauXuat(lo.sauXuat().stream().map(s -> XemTruocXuatKeToanDto.VanDe.builder()
                        .loai(ChungTuXuatKeToan.LOAI_BAN_HANG).idNguon(s.donId()).soChungTu(s.soDon())
                        .noiDung("Đã giao kế toán ở lô " + s.soLo() + ", sau đó bị hoàn trả. Lập Hàng bán trả lại trên AMIS.")
                        .build()).toList())
                .bienDongKho(lo.bienDongKho().stream().map(XuatKeToanService::vanDe).toList())
                .doiChieu(lo.doiChieu())
                .coTheTaoLo(lo.lyDoKhongTheTao() == null)
                .lyDoKhongTheTao(lo.lyDoKhongTheTao())
                .dauVet(lo.lyDoKhongTheTao() == null ? dauVet(kq) : null)
                .build();
    }

    /** Dấu vết nội dung lô: băm danh sách chứng từ (loại, nguồn, tiền, số dòng) đã sắp xếp. */
    static String dauVet(DungChungTuAmis.KetQua kq) {
        String noiDung = kq.chungTu().stream()
                .map(c -> c.loai() + ":" + c.idNguon() + ":" + c.tongTien().stripTrailingZeros().toPlainString() + ":" + c.soDong())
                .sorted()
                .collect(Collectors.joining("\n"));
        return sha256(noiDung.getBytes(StandardCharsets.UTF_8)).substring(0, 16);
    }

    private static XemTruocXuatKeToanDto.VanDe vanDe(DungChungTuAmis.VanDe v) {
        return XemTruocXuatKeToanDto.VanDe.builder()
                .loai(v.loai()).idNguon(v.idNguon()).soChungTu(v.soChungTu()).noiDung(v.noiDung()).build();
    }

    record TongLoai(String loai, int soChungTu, int soDong, BigDecimal truocThue, BigDecimal thue, BigDecimal tongCong) {
    }

    /** Tổng theo loại, theo thứ tự nhập vào AMIS. */
    static List<TongLoai> tongHopTheoLoai(DungChungTuAmis.KetQua kq) {
        List<String> thuTu = List.of(ChungTuXuatKeToan.LOAI_TON_DAU_KY, ChungTuXuatKeToan.LOAI_MUA_HANG,
                ChungTuXuatKeToan.LOAI_CHUYEN_KHO_XUAT, ChungTuXuatKeToan.LOAI_CHUYEN_KHO_NHAN, ChungTuXuatKeToan.LOAI_BAN_HANG);
        List<TongLoai> ds = new ArrayList<>();
        for (String loai : thuTu) {
            List<DungChungTuAmis.ChungTu> cua = kq.chungTu().stream().filter(c -> loai.equals(c.loai())).toList();
            if (cua.isEmpty()) continue;
            ds.add(new TongLoai(loai, cua.size(), cua.stream().mapToInt(DungChungTuAmis.ChungTu::soDong).sum(),
                    tong(cua, DungChungTuAmis.ChungTu::truocThue), tong(cua, DungChungTuAmis.ChungTu::thue),
                    tong(cua, DungChungTuAmis.ChungTu::tongTien)));
        }
        return ds;
    }

    private static List<GhiDoiChieu.DongTongHop> tongHopDoiChieu(DungChungTuAmis.KetQua kq) {
        return tongHopTheoLoai(kq).stream().map(t -> new GhiDoiChieu.DongTongHop(tenLoai(t.loai()), t.soChungTu(),
                t.soDong(), t.truocThue(), t.thue(), t.tongCong())).toList();
    }

    private static List<GhiDoiChieu.DongVanDe> vanDeDoiChieu(Lo lo) {
        List<GhiDoiChieu.DongVanDe> ds = new ArrayList<>();
        lo.ketQua().chan().forEach(v -> ds.add(new GhiDoiChieu.DongVanDe("Để lại lô sau", tenLoai(v.loai()), v.soChungTu(), v.noiDung())));
        lo.ketQua().canhBao().forEach(v -> ds.add(new GhiDoiChieu.DongVanDe("Cảnh báo", tenLoai(v.loai()), v.soChungTu(), v.noiDung())));
        lo.sauXuat().forEach(s -> ds.add(new GhiDoiChieu.DongVanDe("Phát sinh sau khi xuất", tenLoai(ChungTuXuatKeToan.LOAI_BAN_HANG),
                s.soDon(), "Đã giao ở lô " + s.soLo() + ", sau đó bị hoàn trả: lập Hàng bán trả lại trên AMIS.")));
        lo.bienDongKho().forEach(v -> ds.add(new GhiDoiChieu.DongVanDe("Biến động kho lập tay", tenLoai(v.loai()), v.soChungTu(), v.noiDung())));
        return ds;
    }

    private static List<String[]> dongDoiChieu(XemTruocXuatKeToanDto.DoiChieu d) {
        if (d == null) return List.of();
        return List.of(
                new String[]{"Doanh thu theo Báo cáo doanh thu (đơn đã xuất đủ / hoàn thành)", d.getDoanhThuBaoCao().toPlainString()},
                new String[]{"Đã giao kế toán ở các lô trước", d.getDoanhThuLoTruoc().toPlainString()},
                new String[]{"Trong lô này", d.getDoanhThuTrongLo().toPlainString()},
                new String[]{"Bị chặn, để lại lô sau", d.getDoanhThuBiChan().toPlainString()},
                new String[]{"Chênh lệch (đơn đã giao rồi bị hoàn trả)", d.getChenhLech().toPlainString()});
    }

    record TongBan(BigDecimal truocThue, BigDecimal thue, BigDecimal tongCong) {
    }

    static TongBan tongBan(List<DungChungTuAmis.ChungTu> ds) {
        List<DungChungTuAmis.ChungTu> ban = ds.stream().filter(c -> ChungTuXuatKeToan.LOAI_BAN_HANG.equals(c.loai())).toList();
        return new TongBan(tong(ban, DungChungTuAmis.ChungTu::truocThue), tong(ban, DungChungTuAmis.ChungTu::thue),
                tong(ban, DungChungTuAmis.ChungTu::tongTien));
    }

    private static BigDecimal tong(List<DungChungTuAmis.ChungTu> ds, java.util.function.Function<DungChungTuAmis.ChungTu, BigDecimal> f) {
        return ds.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    static String tenLoai(String loai) {
        if (loai == null) return "";
        return switch (loai) {
            case ChungTuXuatKeToan.LOAI_BAN_HANG -> "Bán hàng";
            case ChungTuXuatKeToan.LOAI_MUA_HANG -> "Mua hàng";
            case ChungTuXuatKeToan.LOAI_CHUYEN_KHO_XUAT -> "Chuyển kho (xuất đi)";
            case ChungTuXuatKeToan.LOAI_CHUYEN_KHO_NHAN -> "Chuyển kho (nhận về)";
            case ChungTuXuatKeToan.LOAI_TON_DAU_KY -> "Tồn đầu kỳ";
            case "danh_muc" -> "Danh mục";
            case LOAI_BIEN_DONG_KHO -> "Biến động kho";
            default -> loai;
        };
    }

    private static <T> List<Integer> ids(List<T> ds, java.util.function.ToIntFunction<T> f) {
        return ds.stream().map(f::applyAsInt).toList();
    }

    private static String cat(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    static String sha256(byte[] du) {
        try {
            byte[] bam = MessageDigest.getInstance("SHA-256").digest(du);
            StringBuilder sb = new StringBuilder();
            for (byte b : bam) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
