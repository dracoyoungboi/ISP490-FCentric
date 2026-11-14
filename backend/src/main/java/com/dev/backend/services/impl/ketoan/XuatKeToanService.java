package com.dev.backend.services.impl.ketoan;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.TaoLoXuatKeToanRequest;
import com.dev.backend.dto.response.ketoan.ChungTuXuatKeToanDto;
import com.dev.backend.dto.response.ketoan.LoXuatKeToanDto;
import com.dev.backend.dto.response.ketoan.XemTruocXuatKeToanDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.NgonNgu;
import com.dev.backend.i18n.ThongDiep;
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
 * kho hai bước, nhập / xuất kho khác (kiểm kê, hao hụt chuyển kho), bán hàng, hàng bán trả lại (trả hàng tại quầy, đơn
 * đã giao kế toán rồi bị hoàn trả), kèm danh mục (kế toán nhập ở chế độ Cập nhật). Chứng từ có lỗi chặn bị để lại cho
 * lô sau. Tạo lô thì khóa chứng từ (chung_tu_xuat_ke_toan, UNIQUE theo chứng từ còn hiệu lực) và lưu tệp nén kèm
 * SHA-256. Hủy lô (chỉ lô mới nhất) trả chứng từ của lô về "chưa xuất".</p>
 *
 * <p>Đơn đã giao kế toán rồi bị hoàn trả vẫn được hoàn trả (chốt 25/10/2026). Đơn hoàn trả từ 14/11/2026 có nhật ký
 * nên tự thành chứng từ Hàng bán trả lại; đơn cũ hơn vẫn liệt kê ở "Phát sinh sau khi xuất" để kế toán lập tay.</p>
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
              XemTruocXuatKeToanDto.DoiChieu doiChieu, ThongDiep lyDoKhongTheTao) {
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
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.chonNgayXuatDen"));
        }
        String ghiChu = req.getGhiChu() == null ? null : req.getGhiChu().trim();
        if (ghiChu != null && ghiChu.length() > LY_DO_TOI_DA) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.ghiChuToiDa500"));
        }
        // Khóa dòng cấu hình: hai người tạo lô cùng lúc thì chạy lần lượt, người sau thấy chứng từ đã vào lô trước
        CauHinhKeToan ch = cauHinhKeToanRepository.findByIdForUpdate(CauHinhKeToan.ID)
                .orElseThrow(() -> new CommonException(ThongDiep.of("keToanDuLieuVao.chuaCoCauHinhXuat")));
        Lo lo = dung(ch, req.getDenNgay());
        if (lo.lyDoKhongTheTao() != null) {
            throw new CommonException(HttpStatus.CONFLICT, lo.lyDoKhongTheTao());
        }
        // Lô đầu tiên của bản tự dựng chốt mốc tự dựng (đúng mốc vừa dùng để dựng lô này). Sau đó hủy lô cũng không dời
        // mốc: chứng từ tự dựng bị chặn ở lô này vẫn quay lại lô sau, biến động trước mốc vẫn ở danh sách lập tay.
        if (ch.getTuDongTu() == null) {
            ch.setTuDongTu(mocTuDong(ch, ch.getNgayMoc().atStartOfDay(MUI_GIO).toInstant()));
        }
        if (req.getDauVet() != null && !req.getDauVet().equals(dauVet(lo.ketQua()))) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("keToanDuLieuVao.duLieuDaThayDoi"));
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
                .trangThai(LoXuatKeToan.TRANG_THAI_HIEU_LUC)
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
                    .maKhach(ct.maKhach())
                    .trangThai(ChungTuXuatKeToan.TRANG_THAI_DA_XUAT)
                    .build());
        }
        try {
            chungTuRepository.saveAllAndFlush(khoa);
        } catch (DataIntegrityViolationException e) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("keToanDuLieuVao.chungTuVuaXuatLoKhac"));
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
            throw new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("keToanDuLieuVao.loXuatKhongTimThay"));
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
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("keToanDuLieuVao.loXuatKhongTimThay")));
        if (!sha256(lo.getTep()).equals(lo.getMaBam())) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("keToanDuLieuVao.tepLoSaiMaBam", lo.getSoLo()));
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
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.nhapLyDoMoKhoa"));
        }
        if (gon.length() > LY_DO_TOI_DA) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.lyDoToiDa500"));
        }
        ChungTuXuatKeToan ct = chungTuRepository.findByIdForUpdate(chungTuId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("keToanDuLieuVao.chungTuKhongTimThayTrongLo")));
        if (ChungTuXuatKeToan.TRANG_THAI_DA_HUY_LO.equals(ct.getTrangThai())) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("keToanDuLieuVao.chungTuThuocLoDaHuy", ct.getSoChungTu()));
        }
        if (!ChungTuXuatKeToan.TRANG_THAI_DA_XUAT.equals(ct.getTrangThai())) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("keToanDuLieuVao.chungTuDaMoKhoa", ct.getSoChungTu()));
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

    // ── Hủy lô ─────────────────────────────────────────────────────────────

    /**
     * Hủy lô còn hiệu lực mới nhất: mọi chứng từ đang khóa của lô quay về "chưa xuất" và vào lô sau; tệp nén giữ lại làm
     * bằng chứng (vẫn tải được, đánh dấu đã hủy). Chỉ lô mới nhất: lô sau dựa vào chứng từ của lô trước trên AMIS (hàng
     * phải vào kho trước khi xuất). Kế toán phải xóa trên AMIS các chứng từ của lô đã nhập trước khi nhập lô mới. Khóa
     * dòng cấu hình như lúc tạo lô để hai thao tác không chạy chồng nhau. Ghi nhật ký kèm lý do.
     */
    @Transactional
    public LoXuatKeToanDto huyLo(Integer loId, String lyDo) {
        String gon = lyDo == null ? "" : lyDo.trim();
        if (gon.isEmpty()) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.nhapLyDoHuyLo"));
        }
        if (gon.length() > LY_DO_TOI_DA) {
            throw new CommonException(ThongDiep.of("keToanDuLieuVao.lyDoToiDa500"));
        }
        cauHinhKeToanRepository.findByIdForUpdate(CauHinhKeToan.ID)
                .orElseThrow(() -> new CommonException(ThongDiep.of("keToanDuLieuVao.chuaCoCauHinhXuat")));
        LoXuatKeToanDto lo = loXuatRepository.tomTat(loId)
                .orElseThrow(() -> new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("keToanDuLieuVao.loXuatKhongTimThay")));
        if (!LoXuatKeToan.TRANG_THAI_HIEU_LUC.equals(lo.getTrangThai())) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("keToanDuLieuVao.loDaHuy", lo.getSoLo()));
        }
        Integer moiNhat = loXuatRepository.idLoHieuLucMoiNhat();
        if (!loId.equals(moiNhat)) {
            String soLoMoiNhat = moiNhat == null ? "" : loXuatRepository.tomTat(moiNhat).map(LoXuatKeToanDto::getSoLo).orElse("");
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("keToanDuLieuVao.chiHuyLoMoiNhat", soLoMoiNhat));
        }
        NguoiDung nguoi = cauHinhKeToanService.nguoiDangThucHien();
        Instant bayGio = Instant.now(dongHo);
        if (loXuatRepository.huy(loId, nguoi, bayGio, gon) != 1) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("keToanDuLieuVao.loDaHuy", lo.getSoLo()));
        }
        int soChungTu = chungTuRepository.huyTheoLo(loId);
        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.lo_xuat_ke_toan)
                .idThamChieu(loId)
                .hanhDong(IHanhDong.huy_lo_xuat_ke_toan)
                .giaTriCu("{\"trangThai\":\"hieu_luc\",\"soLo\":\"" + lo.getSoLo() + "\"}")
                .giaTriMoi("{\"trangThai\":\"da_huy\",\"soChungTuTraVe\":" + soChungTu + ",\"maBam\":\"" + lo.getMaBam() + "\"}")
                .nguoiThucHien(nguoi)
                .ngayThucHien(bayGio)
                .ghiChu(gon)
                .build());
        return loXuatRepository.tomTat(loId).orElseThrow();
    }

    // ── Dựng lô ────────────────────────────────────────────────────────────

    /**
     * Chỗ danh sách "biến động kho chưa có chứng từ" của các lô còn hiệu lực đã liệt kê tới (lô sau liệt kê tiếp từ đây):
     * đầu ngày sau ngày "xuất đến" muộn nhất; lô đó tạo khi chưa hết ngày "xuất đến" (xuất đến hết hôm nay) thì lúc tạo
     * lô, vì biến động sau lúc đó chưa lô nào liệt kê. Chưa có lô thì là ngày mốc ({@code tu}).
     */
    private Instant ketThucLietKeLoTruoc(CauHinhKeToan ch, Instant tu) {
        LocalDate denLoTruoc = loXuatRepository.denNgayMuonNhat();
        if (denLoTruoc == null || denLoTruoc.isBefore(ch.getNgayMoc())) {
            return tu;
        }
        Instant ketThuc = denLoTruoc.plusDays(1).atStartOfDay(MUI_GIO).toInstant();
        Instant taoLoTruoc = loXuatRepository.ngayTaoLoDenMuonNhat();
        if (taoLoTruoc != null && taoLoTruoc.isBefore(ketThuc)) {
            ketThuc = taoLoTruoc.isBefore(tu) ? tu : taoLoTruoc;
        }
        return ketThuc;
    }

    /**
     * Mốc tự dựng phiếu nhập / xuất kho khác và chứng từ trả hàng tại quầy. Cột tu_dong_tu chốt ở lô đầu tiên tạo bằng
     * bản tự dựng (taoLo); trước đó suy từ các lô còn hiệu lực — đều do bản cũ tạo, kể cả lô tạo giữa lúc chạy migration
     * và lúc lên backend mới: biến động các lô đó đã liệt kê để kế toán lập tay thì không dựng lại (khỏi ghi sổ hai lần).
     */
    Instant mocTuDong(CauHinhKeToan ch, Instant tu) {
        if (ch.getTuDongTu() != null) {
            return ch.getTuDongTu().isAfter(tu) ? ch.getTuDongTu() : tu;
        }
        return ketThucLietKeLoTruoc(ch, tu);
    }

    Lo dung(CauHinhKeToan ch, LocalDate denNgay) {
        LocalDate homNay = LocalDate.now(dongHo);
        if (ch.getNgayMoc() == null) {
            return rong(ch, denNgay, ThongDiep.of("keToanDuLieuVao.chuaDatNgayMoc"));
        }
        if (denNgay == null) {
            return rong(ch, null, ThongDiep.of("keToanDuLieuVao.chonNgayXuatDenCoCham"));
        }
        if (denNgay.isBefore(ch.getNgayMoc())) {
            return rong(ch, denNgay, ThongDiep.of("keToanDuLieuVao.xuatDenTruocNgayMoc", ch.getNgayMoc().format(GhiTepAmis.NGAY)));
        }
        if (denNgay.isAfter(homNay)) {
            return rong(ch, denNgay, ThongDiep.of("keToanDuLieuVao.xuatDenSauHomNay"));
        }
        Instant tu = ch.getNgayMoc().atStartOfDay(MUI_GIO).toInstant();
        Instant den = denNgay.plusDays(1).atStartOfDay(MUI_GIO).toInstant();
        DungChungTuAmis bo = new DungChungTuAmis(ch, thueSuatService.boTra());
        // Phiếu kho khác và trả hàng tại quầy chỉ tự dựng từ mốc tự dựng: phần trước đó các lô cũ đã liệt kê để kế toán lập tay
        Instant tuDong = mocTuDong(ch, tu);

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

        if (tuDong.isBefore(den)) {
            bo.khoKhac(nguon.khoKhacChuaXuat(tuDong, den, tu));
        }

        List<NguonKeToan.DonBan> don = nguon.donBanChuaXuat(tu, den);
        Map<Integer, List<NguonKeToan.DongBan>> dongBan = nguon.dongDonBan(ids(don, NguonKeToan.DonBan::id)).stream()
                .collect(Collectors.groupingBy(NguonKeToan.DongBan::donId, LinkedHashMap::new, Collectors.toList()));
        bo.banHang(don, dongBan);

        DungChungTuAmis.KetQua kq = bo.ketQua();
        Set<Integer> donTrongLo = kq.chungTu().stream()
                .filter(c -> ChungTuXuatKeToan.LOAI_BAN_HANG.equals(c.loai()))
                .map(DungChungTuAmis.ChungTu::idNguon).collect(Collectors.toSet());

        List<NguonKeToan.PhieuTraQuay> traQuay = tuDong.isBefore(den) ? nguon.phieuTraQuayChuaXuat(tuDong, den) : List.of();
        Map<Integer, List<NguonKeToan.DongTraQuay>> dongTra = nguon.dongTraQuay(ids(traQuay, NguonKeToan.PhieuTraQuay::id)).stream()
                .collect(Collectors.groupingBy(NguonKeToan.DongTraQuay::phieuId, LinkedHashMap::new, Collectors.toList()));
        bo.traLaiQuay(traQuay, dongTra, donTrongLo, ch.getNgayMoc());

        List<NguonKeToan.DonHoan> donHoan = nguon.donHoanChuaXuat(tu, den);
        Map<Integer, List<NguonKeToan.DongBan>> dongHoan = nguon.dongDonBan(donHoan.stream().map(h -> h.don().id()).toList()).stream()
                .collect(Collectors.groupingBy(NguonKeToan.DongBan::donId, LinkedHashMap::new, Collectors.toList()));
        bo.traLaiDon(donHoan, dongHoan);

        if (!kq.chungTu().isEmpty()) {
            // Danh mục khách: chỉ khách giữ mã riêng có chứng từ trong lô, cộng khách lẻ KHLE nếu có (dòng của CSDL);
            // mã gom theo sàn dựng sẵn trong DungChungTuAmis.danhMuc
            Set<String> maKhach = new LinkedHashSet<>(kq.maKhachRieng());
            if (kq.maKhachNhom().contains(DungChungTuAmis.MA_KHACH_LE)) {
                maKhach.add(DungChungTuAmis.MA_KHACH_LE);
            }
            bo.danhMuc(nguon.kho(), nguon.khachHang(maKhach), nguon.nhaCungCap(), nguon.hangHoa(), denNgay);
        }

        // Đối chiếu với Báo cáo doanh thu cùng khoảng ngày (bán trừ tiền hoàn của trả hàng tại quầy)
        Map<Integer, BigDecimal> tongDon = new HashMap<>();
        for (NguonKeToan.DonBan d : don) tongDon.put(d.id(), TachThue.dong(d.tongCong()));
        Map<Integer, BigDecimal> tongTra = new HashMap<>();
        for (NguonKeToan.PhieuTraQuay t : traQuay) tongTra.put(t.id(), TachThue.dong(t.tongTienHoan()));
        Map<Integer, BigDecimal> tongHoan = new HashMap<>();
        for (NguonKeToan.DonHoan h : donHoan) tongHoan.put(h.don().id(), TachThue.dong(h.don().tongCong()));
        BigDecimal baoCao = TachThue.dong(nguon.doanhThuBaoCao(tu, den));
        BigDecimal loTruoc = TachThue.dong(nguon.doanhThuDaGiao(ch.getNgayMoc(), denNgay));
        BigDecimal trongLo = doanhThuThuan(kq.chungTu());
        BigDecimal biChan = BigDecimal.ZERO;
        for (DungChungTuAmis.VanDe v : kq.chan()) {
            if (v.idNguon() == null) continue;
            if (ChungTuXuatKeToan.LOAI_BAN_HANG.equals(v.loai())) {
                biChan = biChan.add(tongDon.getOrDefault(v.idNguon(), BigDecimal.ZERO));
            } else if (ChungTuXuatKeToan.LOAI_TRA_LAI_QUAY.equals(v.loai())) {
                biChan = biChan.subtract(tongTra.getOrDefault(v.idNguon(), BigDecimal.ZERO));
            } else if (ChungTuXuatKeToan.LOAI_TRA_LAI_DON.equals(v.loai())) {
                // Báo cáo doanh thu đã bỏ đơn hoàn trả, lô trước vẫn tính chứng từ bán: phần chưa trừ được nằm ở đây
                biChan = biChan.subtract(tongHoan.getOrDefault(v.idNguon(), BigDecimal.ZERO));
            }
        }
        // Trả hàng tại quầy trước mốc tự dựng chưa có chứng từ: kế toán lập tay theo danh sách biến động của lô cũ, không
        // nằm trong lô nào nhưng Báo cáo doanh thu vẫn trừ
        if (tuDong.isAfter(tu)) {
            biChan = biChan.subtract(TachThue.dong(nguon.tienHoanTraQuayChuaXuat(tu, tuDong.isBefore(den) ? tuDong : den)));
        }
        XemTruocXuatKeToanDto.DoiChieu doiChieu = XemTruocXuatKeToanDto.DoiChieu.builder()
                .doanhThuBaoCao(baoCao)
                .doanhThuLoTruoc(loTruoc)
                .doanhThuTrongLo(trongLo)
                .doanhThuBiChan(biChan)
                .chenhLech(baoCao.subtract(loTruoc).subtract(trongLo).subtract(biChan))
                .build();

        ThongDiep lyDo = null;
        boolean tonBiChan = kq.chan().stream().anyMatch(v -> ChungTuXuatKeToan.LOAI_TON_DAU_KY.equals(v.loai()));
        if (canTonDauKy && tonBiChan) {
            lyDo = ThongDiep.of("keToanDuLieuVao.tonDauKyBiChan");
        } else if (kq.chungTu().isEmpty()) {
            lyDo = ThongDiep.of("keToanDuLieuVao.khongCoChungTuMoi", denNgay.format(GhiTepAmis.NGAY));
        }
        // Biến động kho chưa có chứng từ: chỉ phần phát sinh sau lô trước (mỗi biến động hiện ở đúng một lô)
        Instant tuBienDong = ketThucLietKeLoTruoc(ch, tu);
        List<DungChungTuAmis.VanDe> bienDong = tuBienDong.isBefore(den)
                ? nguon.bienDongKhoKhongCoChungTu(tuBienDong, den, tu, tuDong).stream().map(XuatKeToanService::bienDong).toList()
                : List.of();
        return new Lo(ch, denNgay, kq, canTonDauKy, nguon.donDaXuatBiHoanTra(), bienDong, doiChieu, lyDo);
    }

    private Lo rong(CauHinhKeToan ch, LocalDate denNgay, ThongDiep lyDo) {
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
            throw new UncheckedIOException(ThongDiep.vi("keToanDuLieuVao.khongDongGoiDuocTepNen"), e);
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
        sb.append("Nhập ĐÚNG THỨ TỰ dưới đây. Hàng phải vào kho trước khi xuất: nhập hết mua hàng, chuyển kho, nhập kho khác").append(n)
                .append("trước xuất kho khác và bán hàng, nếu không AMIS báo tồn âm (khi đặt \"không cho xuất quá số lượng tồn\").").append(n)
                .append("Ở bước Chọn tệp: bỏ tick \"Tự động ghép cột với AVA Kế toán\" (tên cột trong tệp đã đúng mẫu AMIS).").append(n).append(n);
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
        sb.append("GHI SỔ: chứng từ nhập từ Excel chưa ghi sổ. Nhập xong mỗi tệp chứng từ, mở danh sách tương ứng trên AMIS").append(n)
                .append("(Mua hàng, Kho › Chuyển kho / Nhập kho / Xuất kho, Bán hàng, Trả lại hàng bán), chọn các chứng từ vừa nhập,").append(n)
                .append("bấm Ghi sổ, theo đúng thứ tự tệp ở trên. Danh sách AMIS mặc định 20 dòng/trang: đặt Số dòng/trang = 100").append(n)
                .append("hoặc ghi sổ từng trang, chứng từ ở trang sau không được chọn. Ghi sổ cả loạt mà AMIS báo \"vượt quá số lượng").append(n)
                .append("tồn\" thì bấm Ghi sổ lại các chứng từ còn lại (AMIS xử lý cả loạt không theo thứ tự ngày). Màn kết quả nhập").append(n)
                .append("của AMIS có lúc báo số dòng thành công sai: kiểm tra lại danh sách chứng từ trên AMIS.").append(n);
        sb.append("Danh mục: chọn phương thức nhập \"Cập nhật\" (mã đã có thì sửa theo tệp, mã mới thì thêm).").append(n);
        sb.append("Khách hàng: đơn sàn ghi theo mã sàn (SAN_LAZADA, SAN_SHOPEE, SAN_TIKTOK, SAN_SHOPIFY), đơn tại quầy ghi").append(n)
                .append("khách lẻ KHLE; chỉ khách có mã số thuế giữ mã riêng. Công nợ đơn sàn theo dõi theo sàn.").append(n);
        sb.append("Tài khoản ").append(lo.cauHinh().getTkNganHang()).append(" (bán tại quầy trả QR payOS): AMIS bắt buộc tài khoản ngân hàng, số").append(n)
                .append("tài khoản ở cột Nộp vào TK phải đã khai báo ở Danh mục › Tài khoản ngân hàng trên AMIS. Hoàn tiền chuyển").append(n)
                .append("khoản cho khách trả hàng ghi giảm trừ công nợ; kế toán lập chứng từ chi tiền gửi riêng.").append(n);
        sb.append("Hàng bán trả lại: ghi \"Không có hóa đơn\". Đơn gốc đã phát hành hóa đơn điện tử thì lập hóa đơn điều chỉnh").append(n)
                .append("trên MISA meInvoice. Hàng lỗi khách trả là chứng từ riêng (số phiếu + \"-L\") không kèm phiếu nhập kho.").append(n);
        sb.append("Chứng từ: AMIS chỉ thêm mới. Muốn sửa chứng từ đã nhập: xóa trên AMIS, nhờ quản trị viên F Centric mở khóa").append(n)
                .append("chứng từ đó (hoặc hủy cả lô nếu là lô mới nhất) ở màn Xuất dữ liệu kế toán, rồi tạo lô mới.").append(n);
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
            sb.append(n).append("Biến động kho không có chứng từ trong lô (lập tay trên AMIS trước khi nhập xuất kho khác và bán hàng):").append(n);
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
            case HoSoAmis.NHAP_KHO -> "Kho › Nhập kho › Nhập từ Excel, loại chứng từ \"Nhập kho\"";
            case HoSoAmis.XUAT_KHO -> "Kho › Xuất kho › Nhập từ Excel, loại chứng từ \"Xuất kho\"";
            case HoSoAmis.TRA_LAI -> "Bán hàng › Trả lại hàng bán › Nhập từ Excel";
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
            case HoSoAmis.BAN_HANG -> "Ở bước Ghép dữ liệu, bấm \"Ẩn/hiện thông tin\", tick Địa chỉ, Mã số thuế, Nộp vào TK rồi Đồng ý"
                    + " (AMIS ẩn sẵn 3 cột này: không bật thì mất mã số thuế của khách công ty và tài khoản nhận tiền QR, chứng từ"
                    + " QR không ghi sổ được).";
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
            case HoSoAmis.NHAP_KHO -> "PHIẾU NHẬP KHO KHÁC";
            case HoSoAmis.XUAT_KHO -> "PHIẾU XUẤT KHO KHÁC";
            case HoSoAmis.TRA_LAI -> "HÀNG BÁN TRẢ LẠI";
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
                        .noiDung(ThongDiep.dich("keToanDuLieuVao.phatSinhSauXuat", s.soLo()))
                        .build()).toList())
                .bienDongKho(lo.bienDongKho().stream().map(XuatKeToanService::vanDe).toList())
                .doiChieu(lo.doiChieu())
                .coTheTaoLo(lo.lyDoKhongTheTao() == null)
                .lyDoKhongTheTao(lo.lyDoKhongTheTao() == null ? null : lo.lyDoKhongTheTao().theoNgonNgu(NgonNgu.hienTai()))
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

    static final String NHOM_NHAP_KHO_KHAC = "nhap_kho_khac";
    static final String NHOM_XUAT_KHO_KHAC = "xuat_kho_khac";
    static final String NHOM_TRA_LAI = "tra_lai";

    /** Nhóm hiển thị của loại chứng từ: phiếu kho khác theo chiều (mọi bảng nguồn), hàng bán trả lại (quầy + đơn hoàn). */
    static String nhomHienThi(String loai) {
        if (loai == null) return "";
        if (loai.startsWith("nhap_khac_")) return NHOM_NHAP_KHO_KHAC;
        if (loai.startsWith("xuat_khac_")) return NHOM_XUAT_KHO_KHAC;
        if (loai.startsWith("tra_lai_")) return NHOM_TRA_LAI;
        return loai;
    }

    /** Tổng theo loại, theo thứ tự nhập vào AMIS. */
    static List<TongLoai> tongHopTheoLoai(DungChungTuAmis.KetQua kq) {
        List<String> thuTu = List.of(ChungTuXuatKeToan.LOAI_TON_DAU_KY, ChungTuXuatKeToan.LOAI_MUA_HANG,
                ChungTuXuatKeToan.LOAI_CHUYEN_KHO_XUAT, ChungTuXuatKeToan.LOAI_CHUYEN_KHO_NHAN, NHOM_NHAP_KHO_KHAC,
                NHOM_XUAT_KHO_KHAC, ChungTuXuatKeToan.LOAI_BAN_HANG, NHOM_TRA_LAI);
        List<TongLoai> ds = new ArrayList<>();
        for (String loai : thuTu) {
            List<DungChungTuAmis.ChungTu> cua = kq.chungTu().stream().filter(c -> loai.equals(nhomHienThi(c.loai()))).toList();
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
                new String[]{"Doanh thu theo Báo cáo doanh thu (đơn đã xuất đủ / hoàn thành, trừ tiền hoàn tại quầy)", d.getDoanhThuBaoCao().toPlainString()},
                new String[]{"Đã giao kế toán ở các lô trước", d.getDoanhThuLoTruoc().toPlainString()},
                new String[]{"Trong lô này", d.getDoanhThuTrongLo().toPlainString()},
                new String[]{"Bị chặn, để lại lô sau", d.getDoanhThuBiChan().toPlainString()},
                new String[]{"Chênh lệch (đơn hoàn trả hoặc phiếu trả tại quầy kế toán lập tay)", d.getChenhLech().toPlainString()});
    }

    record TongBan(BigDecimal truocThue, BigDecimal thue, BigDecimal tongCong) {
    }

    /** Doanh thu thuần của các chứng từ: tổng tiền chứng từ bán trừ chứng từ hàng bán trả lại. */
    static BigDecimal doanhThuThuan(List<DungChungTuAmis.ChungTu> ds) {
        BigDecimal kq = BigDecimal.ZERO;
        for (DungChungTuAmis.ChungTu c : ds) {
            if (ChungTuXuatKeToan.LOAI_BAN_HANG.equals(c.loai())) {
                kq = kq.add(c.tongTien());
            } else if (NHOM_TRA_LAI.equals(nhomHienThi(c.loai()))) {
                kq = kq.subtract(c.tongTien());
            }
        }
        return kq;
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
            case NHOM_NHAP_KHO_KHAC -> "Nhập kho khác";
            case NHOM_XUAT_KHO_KHAC -> "Xuất kho khác";
            case NHOM_TRA_LAI -> "Hàng bán trả lại";
            case ChungTuXuatKeToan.LOAI_TRA_LAI_QUAY -> "Trả hàng tại quầy";
            case ChungTuXuatKeToan.LOAI_TRA_LAI_DON -> "Đơn hoàn trả";
            case "danh_muc" -> "Danh mục";
            case LOAI_BIEN_DONG_KHO -> "Biến động kho";
            default -> loai.startsWith("nhap_khac_") ? "Nhập kho khác" : loai.startsWith("xuat_khac_") ? "Xuất kho khác" : loai;
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
