package com.dev.backend.services.impl.congncc;

import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.dto.PhienCongNcc;
import com.dev.backend.dto.request.DonMuaHangBaoGia;
import com.dev.backend.dto.request.congncc.CongNccRequest;
import com.dev.backend.dto.response.congncc.BaoGiaDaNhanDto;
import com.dev.backend.dto.response.congncc.CongNcc;
import com.dev.backend.dto.response.congncc.DonMuaHangCongNccDto;
import com.dev.backend.dto.response.congncc.MaXacNhanNccDto;
import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.dev.backend.entities.ChiTietDonMuaHang;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.NhaCungCap;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.repository.NhaCungCapRepository;
import com.dev.backend.services.BienBanTraHangService;
import com.dev.backend.services.CalcService;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.entities.NhatKyTraHangNcc;
import com.dev.backend.services.impl.entities.DonMuaHangService;
import com.dev.backend.services.impl.entities.HanBaoGia;
import com.dev.backend.services.impl.entities.ThongTinCuaHangMuaHang;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Cổng nhà cung cấp: nhà cung cấp không có tài khoản, đăng nhập bằng email đã đăng ký + mã 6 số gửi về email đó, được
 * phiên 60 phút (chỉ trong bộ nhớ). Mỗi lần dùng phiên, các nhà cung cấp được xem tra lại theo email (nhiều nhà cung cấp
 * có thể dùng chung một email), nên đổi email nhà cung cấp là email cũ hết xem được ngay.
 * <p>Trong phiên: việc cần làm (biên bản chờ chọn cách xử lý, đơn chờ báo giá), xem / gửi báo giá, xem / trả lời biên bản
 * trả hàng, lịch sử báo giá và hàng lỗi trả lại. Mọi dữ liệu chỉ thuộc các nhà cung cấp của phiên; id lạ trả 404.
 */
@Service
@Slf4j
public class CongNhaCungCapService {

    /** Thời hạn mã: OtpType.SUPPLIER_MAIL_SIGN_KEY (5 phút). Sau bao lâu mới xin được mã mới cho cùng email. */
    public static final int MA_GUI_LAI_SAU_GIAY = 60;
    /** Tối đa số mã gửi trong một giờ cho cùng email: chống dò mã, chống gửi email hàng loạt. */
    public static final int MA_TOI_DA_MOI_GIO = 5;
    /** Nhập sai đến lần này thì mã bị xóa, phải nhận mã mới. */
    public static final int MA_SAI_TOI_DA = 5;
    private static final long MA_DO_DAI = 6L;
    public static final int PHIEN_PHUT = 60;
    private static final int PHIEN_SO_BYTE = 32;
    private static final ZoneId MUI_GIO_VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private static final int DON_CHO_BAO_GIA = DonMuaHangService.TRANG_THAI_CHO_BAO_GIA;
    private static final Set<Integer> DON_DUOC_CHAP_NHAN = Set.of(DonMuaHangService.TRANG_THAI_DA_CHAP_NHAN,
            DonMuaHangService.TRANG_THAI_DA_NHAN_DU, DonMuaHangService.TRANG_THAI_DA_DONG);
    private static final SecureRandom NGAU_NHIEN = new SecureRandom();

    private final NhaCungCapRepository nhaCungCapRepository;
    private final DonMuaHangRepository donMuaHangRepository;
    private final DonMuaHangService donMuaHangService;
    private final BienBanTraHangService bienBanTraHangService;
    private final EmailNghiepVuService emailNghiepVuService;
    private final CalcService calcService;
    private final ThongTinCuaHangMuaHang thongTinCuaHangMuaHang;
    private final NhatKyTraHangNcc nhatKyTraHangNcc;
    private Clock dongHo = Clock.systemUTC();
    /** Hạn báo giá; null khi unit test dựng tay (không lọc theo hạn). */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private HanBaoGia hanBaoGia;

    public CongNhaCungCapService(NhaCungCapRepository nhaCungCapRepository, DonMuaHangRepository donMuaHangRepository,
                                 DonMuaHangService donMuaHangService, BienBanTraHangService bienBanTraHangService,
                                 EmailNghiepVuService emailNghiepVuService, CalcService calcService,
                                 ThongTinCuaHangMuaHang thongTinCuaHangMuaHang, NhatKyTraHangNcc nhatKyTraHangNcc) {
        this.nhaCungCapRepository = nhaCungCapRepository;
        this.donMuaHangRepository = donMuaHangRepository;
        this.donMuaHangService = donMuaHangService;
        this.bienBanTraHangService = bienBanTraHangService;
        this.emailNghiepVuService = emailNghiepVuService;
        this.calcService = calcService;
        this.thongTinCuaHangMuaHang = thongTinCuaHangMuaHang;
        this.nhatKyTraHangNcc = nhatKyTraHangNcc;
    }

    void setDongHo(Clock dongHo) {
        this.dongHo = dongHo;
    }

    // ─────────────────────────────────────────────────────────────
    // ĐĂNG NHẬP
    // ─────────────────────────────────────────────────────────────

    /**
     * Gửi mã đăng nhập (E5, gửi ngay trong request, ngoài giao dịch). Email phải là email của ít nhất một nhà cung cấp.
     * Xin lại trong 60 giây hoặc quá 5 mã mỗi giờ: 429 MA_CU_CON_HIEU_LUC (kèm guiLaiSauGiay, hetHanGiay).
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public MaXacNhanNccDto layMa(String emailNhap) {
        String email = chuanHoaEmailBatBuoc(emailNhap);
        List<NhaCungCap> ncc = nhaCungCapRepository.timTheoEmail(email);
        if (ncc.isEmpty()) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.EMAIL_KHONG_CO, ThongDiep.of("sanPhamMuaHang.congEmailKhongCo"));
        }

        Instant now = dongHo.instant();
        Duration thoiHanMa = OtpType.SUPPLIER_MAIL_SIGN_KEY.thoiHan();
        OtpScheduleObj ma;
        synchronized (GlobalCache.OTP_SCHEDULE_OBJS) {
            OtpScheduleObj cu = timMa(email);
            // Mã cũ đã hết hạn (hoặc đã dùng / đã dọn) thì hetHanGiay = 0 để cổng ở lại bước nhận mã
            int hetHanMaCu = cu == null ? 0 : DonMuaHangService.giayConLai(now, cu.getCreatedAt().plus(thoiHanMa));
            if (cu != null && now.isBefore(cu.getCreatedAt().plusSeconds(MA_GUI_LAI_SAU_GIAY))) {
                int cho = DonMuaHangService.giayConLai(now, cu.getCreatedAt().plusSeconds(MA_GUI_LAI_SAU_GIAY));
                throw new LoiCoMaException(HttpStatus.TOO_MANY_REQUESTS, MaLoi.MA_CU_CON_HIEU_LUC,
                        ThongDiep.of("sanPhamMuaHang.donMuaChoGiayNhanMaMoi", cho),
                        Map.of("guiLaiSauGiay", cho, "hetHanGiay", hetHanMaCu));
            }
            Instant motGioTruoc = now.minus(1, ChronoUnit.HOURS);
            List<Instant> luot = GlobalCache.LUOT_GUI_MA_NCC.getOrDefault(email, List.of()).stream()
                    .filter(t -> t.isAfter(motGioTruoc)).sorted().toList();
            if (luot.size() >= MA_TOI_DA_MOI_GIO) {
                int cho = Math.max(1, DonMuaHangService.giayConLai(now, luot.get(0).plus(1, ChronoUnit.HOURS)));
                throw new LoiCoMaException(HttpStatus.TOO_MANY_REQUESTS, MaLoi.MA_CU_CON_HIEU_LUC,
                        ThongDiep.of("sanPhamMuaHang.donMuaQuaSoMaMoiGio", MA_TOI_DA_MOI_GIO, (cho + 59) / 60),
                        Map.of("guiLaiSauGiay", cho, "hetHanGiay", hetHanMaCu));
            }
            GlobalCache.OTP_SCHEDULE_OBJS.removeIf(o -> laMaCua(o, email));
            ma = OtpScheduleObj.builder()
                    .email(email)
                    .otp(calcService.getRandomActiveCode(MA_DO_DAI))
                    .type(OtpType.SUPPLIER_MAIL_SIGN_KEY)
                    .createdAt(now)
                    .build();
            GlobalCache.OTP_SCHEDULE_OBJS.add(ma);
            List<Instant> luotMoi = new ArrayList<>(luot);
            luotMoi.add(now);
            GlobalCache.LUOT_GUI_MA_NCC.put(email, List.copyOf(luotMoi));
        }

        try {
            // Gửi tới email đã lưu (giữ cách viết gốc), không phải chuỗi người dùng gõ
            emailNghiepVuService.guiMaDangNhapCong(ncc.get(0).getEmail().trim(), tenHienThi(ncc), ma.getOtp(),
                    ma.getCreatedAt().plus(thoiHanMa));
        } catch (RuntimeException e) {
            // Gửi lỗi: xóa mã và lượt vừa tính để nhà cung cấp xin lại được ngay. Không ghi mã vào log.
            synchronized (GlobalCache.OTP_SCHEDULE_OBJS) {
                GlobalCache.OTP_SCHEDULE_OBJS.remove(ma);
                GlobalCache.LUOT_GUI_MA_NCC.computeIfPresent(email, (k, ds) -> {
                    List<Instant> conLai = new ArrayList<>(ds);
                    conLai.remove(now);
                    return conLai.isEmpty() ? null : List.copyOf(conLai);
                });
            }
            log.warn("Không gửi được email mã đăng nhập Cổng nhà cung cấp ({})", e.getClass().getSimpleName());
            throw new LoiCoMaException(HttpStatus.SERVICE_UNAVAILABLE, MaLoi.CHUA_GUI_DUOC_MA,
                    ThongDiep.of("sanPhamMuaHang.donMuaChuaGuiDuocMa"));
        }
        return MaXacNhanNccDto.builder().hetHanGiay((int) thoiHanMa.toSeconds()).guiLaiSauGiay(MA_GUI_LAI_SAU_GIAY).build();
    }

    /**
     * Xác nhận mã: đúng email và còn hạn. Sai thì tăng số lần sai, đủ 5 lần thì xóa mã. Đúng thì xóa mã (dùng một lần; hai
     * yêu cầu cùng lúc chỉ một qua) và mở phiên 60 phút cho email này (phiên cũ của email hết dùng).
     */
    @Transactional(readOnly = true)
    public CongNcc.DangNhap xacNhanMa(String emailNhap, String maNhapGoc) {
        String email = chuanHoaEmailBatBuoc(emailNhap);
        List<NhaCungCap> ncc = nhaCungCapRepository.timTheoEmail(email);
        if (ncc.isEmpty()) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.EMAIL_KHONG_CO, ThongDiep.of("sanPhamMuaHang.congEmailKhongCo"));
        }
        Instant now = dongHo.instant();
        String maNhap = maNhapGoc == null ? "" : maNhapGoc.trim();
        OtpScheduleObj ma = timMa(email);
        if (ma == null || now.isAfter(ma.getCreatedAt().plus(OtpType.SUPPLIER_MAIL_SIGN_KEY.thoiHan()))) {
            if (ma != null) GlobalCache.OTP_SCHEDULE_OBJS.remove(ma);
            throw maHetHan(ThongDiep.of("sanPhamMuaHang.donMuaMaXacNhanHetHan"));
        }
        // So mã và đếm lần sai trong khóa của chính mã: gửi nhiều yêu cầu song song không thử được quá số lần cho phép
        synchronized (ma) {
            if (ma.getFailedAttempts().get() >= MA_SAI_TOI_DA) {
                GlobalCache.OTP_SCHEDULE_OBJS.remove(ma);
                throw maHetHan(ThongDiep.of("sanPhamMuaHang.donMuaNhapSaiQuaSoLan", MA_SAI_TOI_DA));
            }
            if (!maKhop(ma.getOtp(), maNhap)) {
                int sai = ma.getFailedAttempts().incrementAndGet();
                if (sai >= MA_SAI_TOI_DA) {
                    GlobalCache.OTP_SCHEDULE_OBJS.remove(ma);
                    throw maHetHan(ThongDiep.of("sanPhamMuaHang.donMuaNhapSaiQuaSoLan", MA_SAI_TOI_DA));
                }
                int conLai = MA_SAI_TOI_DA - sai;
                throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.MA_SAI,
                        ThongDiep.of("sanPhamMuaHang.donMuaMaSaiConLan", conLai), Map.of("conLaiLanThu", conLai));
            }
        }
        if (!GlobalCache.OTP_SCHEDULE_OBJS.remove(ma)) {
            // Yêu cầu khác vừa dùng (hoặc job vừa dọn) đúng mã này
            throw maHetHan(ThongDiep.of("sanPhamMuaHang.donMuaMaXacNhanHetHan"));
        }

        String maPhien = taoMaPhien();
        Instant hetHan = now.plus(PHIEN_PHUT, ChronoUnit.MINUTES);
        GlobalCache.PHIEN_CONG_NCC.values().removeIf(p -> email.equals(p.email()));
        GlobalCache.PHIEN_CONG_NCC.put(maPhien, new PhienCongNcc(email, hetHan));
        return new CongNcc.DangNhap(maPhien, hetHan, nhaCungCap(ncc), thongTinCuaHangMuaHang.choCongNhaCungCap());
    }

    public void dangXuat(String maPhien) {
        if (maPhien != null && !maPhien.isBlank()) GlobalCache.PHIEN_CONG_NCC.remove(maPhien.trim());
    }

    /** Phiên còn hạn và các nhà cung cấp của email phiên (không còn nhà cung cấp nào: phiên hết dùng). */
    private record Phien(String email, List<NhaCungCap> nhaCungCap, Set<Integer> ids) {
    }

    private Phien layPhien(String maPhien) {
        if (maPhien == null || maPhien.isBlank()) throw phienHetHan();
        String khoa = maPhien.trim();
        PhienCongNcc phien = GlobalCache.PHIEN_CONG_NCC.get(khoa);
        if (phien == null) throw phienHetHan();
        if (phien.daHetHan(dongHo.instant())) {
            GlobalCache.PHIEN_CONG_NCC.remove(khoa, phien);
            throw phienHetHan();
        }
        List<NhaCungCap> ncc = nhaCungCapRepository.timTheoEmail(phien.email());
        if (ncc.isEmpty()) {
            GlobalCache.PHIEN_CONG_NCC.remove(khoa, phien);
            throw phienHetHan();
        }
        return new Phien(phien.email(), ncc, ncc.stream().map(NhaCungCap::getId).collect(Collectors.toSet()));
    }

    // ─────────────────────────────────────────────────────────────
    // VIỆC CẦN LÀM
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public CongNcc.ViecCanLam viecCanLam(String maPhien) {
        Phien p = layPhien(maPhien);
        Instant now = dongHo.instant();
        Instant baMuoiNgay = now.minus(30, ChronoUnit.DAYS);

        // Người phụ trách mỗi việc = người tạo đơn mua của việc đó; đơn của biên bản nằm sẵn trong danh sách đơn đã gửi
        List<DonMuaHang> don = donMuaHangRepository.choCongNhaCungCap(p.ids());
        Map<Integer, DonMuaHang> donTheoId = new HashMap<>();
        don.forEach(d -> donTheoId.putIfAbsent(d.getId(), d));

        List<BienBanTraHangDto> bienBan = bienBanTraHangService.dsChoCong(p.ids());
        List<CongNcc.BienBanCho> bienBanCho = bienBan.stream()
                .filter(CongNhaCungCapService::choNhaCungCapChon)
                .sorted(Comparator.comparing(BienBanTraHangDto::getNgayLap, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(b -> new CongNcc.BienBanCho(b.getId(), b.getSoBienBan(), b.getSoDonMua(), b.getSoPhieuNhap(),
                        b.getNgayLap(), b.getHanTraLoi(), b.getTongSoLuongLoi() == null ? 0 : b.getTongSoLuongLoi(), b.getGiaTriLoi(),
                        hangLoiTomTat(b), nguoiPhuTrachCua(donTheoId.get(b.getDonMuaHangId()))))
                .toList();

        // Đơn chờ báo giá còn hạn (qua hạn thì không còn là việc cần làm, nằm ở Lịch sử với kết quả Hết hạn)
        List<DonMuaHang> choBaoGia = don.stream()
                .filter(d -> Objects.equals(d.getTrangThai(), DON_CHO_BAO_GIA) && d.getNgayBaoGia() == null)
                .toList();
        Map<Integer, HanBaoGia.Han> han = hanBaoGia == null ? Map.of() : hanBaoGia.hanCua(choBaoGia);
        List<CongNcc.DonChoBaoGia> donCho = choBaoGia.stream()
                .filter(d -> han.get(d.getId()) == null || !HanBaoGia.daQuaHan(han.get(d.getId()).ngay(), now))
                .map(d -> new CongNcc.DonChoBaoGia(d.getId(), d.getSoDonMua(), soMatHang(d), tongSoLuong(d),
                        d.getNgayGiaoDuKien(), d.getKhoNhap() == null ? null : d.getKhoNhap().getTenKho(), ngayYeuCau(d),
                        nguoiPhuTrachCua(d), han.get(d.getId()) == null ? null : han.get(d.getId()).ngay()))
                .toList();

        int baoGiaDaGui = 0;
        int duocChapNhan = 0;
        for (DonMuaHang d : don) {
            if (d.getNgayBaoGia() == null || d.getNgayBaoGia().isBefore(baMuoiNgay)) continue;
            baoGiaDaGui++;
            if (DON_DUOC_CHAP_NHAN.contains(d.getTrangThai())) duocChapNhan++;
        }
        int sanPhamLoi = 0;
        BigDecimal tienTru = BigDecimal.ZERO;
        for (BienBanTraHangDto b : bienBan) {
            if (BienBanTraHangNcc.DA_HUY.equals(b.getTrangThai()) || b.getNgayLap() == null || b.getNgayLap().isBefore(baMuoiNgay)) continue;
            sanPhamLoi += b.getTongSoLuongLoi() == null ? 0 : b.getTongSoLuongLoi();
            BigDecimal tru = tienTruCua(b);
            if (tru != null) tienTru = tienTru.add(tru);
        }
        NguoiDung phuTrach = don.stream().map(DonMuaHang::getNguoiTao).filter(Objects::nonNull).findFirst().orElse(null);
        return new CongNcc.ViecCanLam(nhaCungCap(p.nhaCungCap()), bienBanCho, donCho,
                new CongNcc.SoLieu30Ngay(baoGiaDaGui, duocChapNhan, sanPhamLoi, tienTru), nguoiPhuTrach(phuTrach));
    }

    /** Biên bản nhà cung cấp còn việc phải trả lời: chọn cách bù, hoặc chọn nhận lại / tiêu hủy hàng lỗi còn ở kho. */
    private static boolean choNhaCungCapChon(BienBanTraHangDto b) {
        return Boolean.TRUE.equals(b.getChoNccChonCachBu()) || Boolean.TRUE.equals(b.getChoNccChonHangLoi());
    }

    private static CongNcc.HangLoiTomTat hangLoiTomTat(BienBanTraHangDto b) {
        String tt = b.getTrangThaiHang();
        String moTa;
        if (BienBanTraHangNcc.HANG_DA_TRA.equals(tt)) {
            moTa = b.getNguoiNhanHang() == null ? null
                    : b.getNguoiNhanHang() + (b.getBienSoXe() == null ? "" : " (" + b.getBienSoXe() + ")");
        } else if (BienBanTraHangNcc.HANG_DA_XU_LY.equals(tt)) {
            // Dòng giao trả, dòng tiêu hủy: không có một người nhận / một kho chung để kể
            moTa = null;
        } else {
            moTa = b.getTenKho();
        }
        return new CongNcc.HangLoiTomTat(tt, moTa);
    }

    // ─────────────────────────────────────────────────────────────
    // BÁO GIÁ
    // ─────────────────────────────────────────────────────────────

    /** Đơn của phiên kèm thông tin cửa hàng (trang báo giá). */
    public record DonMuaCong(DonMuaHangCongNccDto donMua, com.dev.backend.dto.response.congncc.CuaHangCongDto cuaHang) {
    }

    @Transactional(readOnly = true)
    public DonMuaCong layDonMua(String maPhien, Integer donMuaHangId) {
        Phien p = layPhien(maPhien);
        return new DonMuaCong(donMuaHangService.layDonChoCong(donMuaHangId, p.ids()), thongTinCuaHangMuaHang.choCongNhaCungCap());
    }

    public BaoGiaDaNhanDto baoGia(String maPhien, Integer donMuaHangId, DonMuaHangBaoGia baoGia) {
        Phien p = layPhien(maPhien);
        // Đơn phải thuộc nhà cung cấp của phiên (404 như xem đơn); email của đơn kiểm lại trong giao dịch báo giá
        donMuaHangService.layDonChoCong(donMuaHangId, p.ids());
        return donMuaHangService.baoGiaTuCong(donMuaHangId, p.email(), baoGia);
    }

    // ─────────────────────────────────────────────────────────────
    // BIÊN BẢN TRẢ HÀNG
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public CongNcc.BienBan bienBan(String maPhien, Integer id) {
        Phien p = layPhien(maPhien);
        return bienBanCong(bienBanTraHangService.chiTietChoCong(id, p.ids()));
    }

    public CongNcc.BienBan traLoiBienBan(String maPhien, Integer id, CongNccRequest.TraLoiBienBan traLoi) {
        Phien p = layPhien(maPhien);
        List<BienBanTraHangService.LuaChonDong> theoDong = traLoi.dong() == null ? null : traLoi.dong().stream()
                .map(d -> d == null ? null : new BienBanTraHangService.LuaChonDong(d.id(), d.phuongAn(), d.hangLoi()))
                .toList();
        return bienBanCong(bienBanTraHangService.traLoiTuCong(id, p.ids(), traLoi.phienBan(), theoDong, traLoi.phuongAn(),
                traLoi.hangLoi(), traLoi.nguoiXacNhan(), traLoi.ghiChu(), Boolean.TRUE.equals(traLoi.camKet())));
    }

    private CongNcc.BienBan bienBanCong(BienBanTraHangDto b) {
        boolean daHuy = BienBanTraHangNcc.DA_HUY.equals(b.getTrangThai());
        String trangThai = daHuy ? "DA_HUY" : choNhaCungCapChon(b) ? "CHO_XAC_NHAN" : "DA_XAC_NHAN";
        boolean daNhap = Boolean.TRUE.equals(b.getPhieuDaNhap());

        Map<Integer, BigDecimal> gia = new HashMap<>();
        if (b.getTheoBienThe() != null) {
            for (BienBanTraHangDto.TheoBienTheDto t : b.getTheoBienThe()) gia.put(t.getBienTheSanPhamId(), t.getDonGia());
        }
        List<CongNcc.DongLoi> dong = new ArrayList<>();
        int tongSl = 0;
        BigDecimal tongGt = BigDecimal.ZERO;
        for (BienBanTraHangDto.ChiTietItemDto it : b.getItems() == null ? List.<BienBanTraHangDto.ChiTietItemDto>of() : b.getItems()) {
            int sl = it.getSoLuong() == null ? 0 : it.getSoLuong();
            BigDecimal donGia = it.getDonGia() != null ? it.getDonGia() : gia.get(it.getBienTheSanPhamId());
            BigDecimal giaTri = donGia == null ? null : donGia.multiply(BigDecimal.valueOf(sl));
            dong.add(new CongNcc.DongLoi(it.getId(), it.getTenBienThe(), it.getMauSac(), it.getKichCo(), it.getSku(),
                    it.getMaLo(), it.getLyDo(), it.getGhiChu(), sl, donGia, giaTri, it.getCachBu(), it.getNguonCachBu(),
                    danhSach(it.getCachBuMo()), Boolean.TRUE.equals(it.getBuXong()), it.getHangLoiNcc(),
                    it.getTrangThaiHang(), danhSach(it.getHangLoiMo()), it.getNguoiNhanHang(), it.getThoiDiemRoiKho(),
                    it.getSoLuongTru() == null ? 0 : it.getSoLuongTru(), it.getTienTru()));
            tongSl += sl;
            if (giaTri != null) tongGt = tongGt.add(giaTri);
        }
        CongNcc.LuaChon cachBu = BienBanTraHangNcc.PA_CHO_CHOT.equals(b.getPhuongAn()) || b.getNguonChot() == null ? null
                : new CongNcc.LuaChon(b.getPhuongAn(), b.getNguonChot(), b.getNguoiXacNhanNcc(), b.getThoiDiemChot(),
                b.getGhiChuChot());
        CongNcc.LuaChon hangLoi = b.getHangLoiNcc() == null ? null
                : new CongNcc.LuaChon(b.getHangLoiNcc(), NhatKyTraHangNcc.NGUON_CONG_NCC, b.getNguoiChonHangLoi(),
                b.getThoiDiemChonHangLoi(), b.getGhiChuChonHangLoi());
        BigDecimal tienTru = tienTruCua(b);
        DonMuaHang don = b.getDonMuaHangId() == null ? null : donMuaHangRepository.findById(b.getDonMuaHangId()).orElse(null);
        return new CongNcc.BienBan(b.getId(), b.getSoBienBan(), b.getSoDonMua(), b.getSoPhieuNhap(), b.getTenKho(),
                don == null || don.getKhoNhap() == null ? null : don.getKhoNhap().getDiaChi(),
                b.getNgayLap(), daNhap, trangThai, b.getPhuongAn(), danhSach(b.getCachBuMo()), danhSach(b.getHangLoiMo()),
                b.getHanTraLoi(), phienBan(b),
                new CongNcc.HangLoi(b.getTrangThaiHang(), b.getCachXuLyHang(), b.getNguoiNhanHang(), b.getBienSoXe(), b.getThoiDiemTra()),
                dong, tongSl, tongGt, tienTru,
                b.getSoLuongTruTien() != null ? b.getSoLuongTruTien() : 0,
                Boolean.TRUE.equals(b.getBuXong()), conChoGiao(b), cachBu, hangLoi,
                nguoiPhuTrach(don == null ? null : don.getNguoiTao()), b.getNguoiLienHeNcc());
    }

    // ─────────────────────────────────────────────────────────────
    // LỊCH SỬ
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public CongNcc.LichSuBaoGia lichSuBaoGia(String maPhien, LocalDate tuNgay, LocalDate denNgay, String tuKhoa) {
        Phien p = layPhien(maPhien);
        KhoangNgay khoang = KhoangNgay.of(tuNgay, denNgay);
        String tk = chuanTuKhoa(tuKhoa);
        List<CongNcc.DongBaoGia> items = new ArrayList<>();
        int daBaoGia = 0, chapNhan = 0, khongChapNhan = 0, choBaoGia = 0;
        List<DonMuaHang> dsDon = donMuaHangRepository.choCongNhaCungCap(p.ids());
        Map<Integer, HanBaoGia.Han> han = hanBaoGia == null ? Map.of() : hanBaoGia.hanCua(dsDon);
        Instant now = dongHo.instant();
        for (DonMuaHang d : dsDon) {
            Instant ngayYeuCau = ngayYeuCau(d);
            if (!khoang.chua(ngayYeuCau)) continue;
            if (!tk.isEmpty() && (d.getSoDonMua() == null || !d.getSoDonMua().toLowerCase(Locale.ROOT).contains(tk))) continue;
            HanBaoGia.Han h = han.get(d.getId());
            String ketQua = ketQuaBaoGia(d, h != null && HanBaoGia.daQuaHan(h.ngay(), now));
            switch (ketQua) {
                case "DUOC_CHAP_NHAN" -> chapNhan++;
                case "KHONG_CHAP_NHAN" -> khongChapNhan++;
                case "CHO_BAO_GIA" -> choBaoGia++;
                default -> {
                }
            }
            if (d.getNgayBaoGia() != null) daBaoGia++;
            items.add(new CongNcc.DongBaoGia(d.getId(), d.getSoDonMua(), ngayYeuCau, d.getNgayBaoGia(), soMatHang(d),
                    d.getNgayBaoGia() == null ? null : d.getTongTien(), ketQua, h == null ? null : h.ngay()));
        }
        return new CongNcc.LichSuBaoGia(items, new CongNcc.TomTatBaoGia(daBaoGia, chapNhan, khongChapNhan, choBaoGia));
    }

    @Transactional(readOnly = true)
    public CongNcc.LichSuTraHang lichSuTraHang(String maPhien, LocalDate tuNgay, LocalDate denNgay, String tuKhoa) {
        Phien p = layPhien(maPhien);
        KhoangNgay khoang = KhoangNgay.of(tuNgay, denNgay);
        String tk = chuanTuKhoa(tuKhoa);
        List<CongNcc.DongTraHang> items = new ArrayList<>();
        int bienBan = 0, sanPhamLoi = 0, choChon = 0;
        BigDecimal tienTru = BigDecimal.ZERO;
        for (BienBanTraHangDto b : bienBanTraHangService.dsChoCong(p.ids())) {
            if (!khoang.chua(b.getNgayLap())) continue;
            if (!tk.isEmpty() && !chua(b.getSoBienBan(), tk) && !chua(b.getSoDonMua(), tk) && !chua(b.getSoPhieuNhap(), tk)) continue;
            boolean daHuy = BienBanTraHangNcc.DA_HUY.equals(b.getTrangThai());
            int sl = b.getTongSoLuongLoi() == null ? 0 : b.getTongSoLuongLoi();
            BigDecimal tru = daHuy ? null : tienTruCua(b);
            if (!daHuy) {
                bienBan++;
                sanPhamLoi += sl;
                if (tru != null) tienTru = tienTru.add(tru);
                if (choNhaCungCapChon(b)) choChon++;
            }
            items.add(new CongNcc.DongTraHang(b.getId(), b.getSoBienBan(), b.getNgayLap(), b.getSoDonMua(), sl,
                    b.getPhuongAn(), tru, Boolean.TRUE.equals(b.getBuXong()), conChoGiao(b), b.getTrangThaiHang(),
                    b.getHangLoiNcc(), !daHuy && choNhaCungCapChon(b), daHuy));
        }
        return new CongNcc.LichSuTraHang(items, new CongNcc.TomTatTraHang(bienBan, sanPhamLoi, tienTru, choChon));
    }

    /**
     * Tiền trừ của biên bản: số đã trừ vào đơn mua (kể cả khi các dòng còn lại đang chờ chọn lại); nhà cung cấp chọn trước
     * khi nhập kho (chưa áp) thì là giá trị các dòng trừ tiền. Không dòng nào trừ tiền: null.
     */
    private static BigDecimal tienTruCua(BienBanTraHangDto b) {
        if (b.getTienTruTien() != null && b.getTienTruTien().signum() > 0) return b.getTienTruTien();
        // Chưa nhập kho: giá trị các dòng trừ tiền (biên bản cũ không có dòng: cả giá trị hàng lỗi)
        if (b.getGiaTriTruTien() != null && b.getGiaTriTruTien().signum() > 0) return b.getGiaTriTruTien();
        return BienBanTraHangNcc.PA_TRU_CONG_NO.equals(b.getPhuongAn()) ? b.getGiaTriLoi() : null;
    }

    private static List<String> danhSach(List<String> ds) {
        return ds == null ? List.of() : ds;
    }

    /** Lần lập nhà cung cấp đang xem (id dòng nhật ký lập cuối): gửi kèm khi trả lời để máy chủ biết có bị lập lại chưa. */
    private Integer phienBan(BienBanTraHangDto b) {
        return b.getId() == null ? null : nhatKyTraHangNcc.idLapCuoi(b.getId());
    }

    /** Giao bù chưa xong: số lỗi đơn mua còn chờ nhà cung cấp giao (theo còn thiếu của dòng đơn cùng biến thể). */
    private static int conChoGiao(BienBanTraHangDto b) {
        if (Boolean.TRUE.equals(b.getBuXong())) return 0;
        // Tính theo các dòng giao bù (có cả khi biên bản vừa giao bù vừa trừ tiền)
        if (b.getSoLuongChoHangBu() != null) return b.getSoLuongChoHangBu();
        if (!BienBanTraHangNcc.PA_DOI_HANG.equals(b.getPhuongAn()) || b.getTheoBienThe() == null) {
            return 0;
        }
        int n = 0;
        for (BienBanTraHangDto.TheoBienTheDto t : b.getTheoBienThe()) {
            int loi = t.getSoLuongLoi() == null ? 0 : t.getSoLuongLoi();
            int thieu = t.getConThieuDongDon() == null ? loi : t.getConThieuDongDon().intValue();
            n += Math.max(0, Math.min(loi, thieu));
        }
        return n;
    }

    /** Kết quả báo giá phía nhà cung cấp. */
    static String ketQuaBaoGia(DonMuaHang d) {
        return ketQuaBaoGia(d, false);
    }

    /**
     * Kết quả báo giá; {@code quaHan}: đã qua hạn báo giá theo giờ — đơn còn ở 2, chưa báo giá thì đã là Hết hạn dù lượt
     * xét hạn (8:00) chưa ghi trạng thái 8.
     */
    static String ketQuaBaoGia(DonMuaHang d, boolean quaHan) {
        Integer tt = d.getTrangThai();
        if (Objects.equals(tt, DON_CHO_BAO_GIA)) {
            if (d.getNgayBaoGia() != null) return "CHO_KET_QUA";
            return quaHan ? "HET_HAN" : "CHO_BAO_GIA";
        }
        if (Objects.equals(tt, DonMuaHangService.TRANG_THAI_HET_HAN)) return "HET_HAN";
        if (DON_DUOC_CHAP_NHAN.contains(tt)) return "DUOC_CHAP_NHAN";
        if (Objects.equals(tt, DonMuaHangService.TRANG_THAI_KHONG_CHAP_NHAN)) return "KHONG_CHAP_NHAN";
        return "DA_HUY";
    }

    // ─────────────────────────────────────────────────────────────
    // TIỆN ÍCH
    // ─────────────────────────────────────────────────────────────

    /**
     * Khoảng ngày lọc lịch sử theo giờ Việt Nam: [00:00 ngày tuNgay, 00:00 ngày sau denNgay). Đầu nào null là không giới
     * hạn đầu đó; cả hai null là mọi thời gian (cổng tự chia trang nên không cắt số tháng). Đang lọc thì chứng từ không có
     * ngày bị loại, không lọc thì vẫn hiện.
     */
    private record KhoangNgay(Instant tu, Instant den) {
        static KhoangNgay of(LocalDate tuNgay, LocalDate denNgay) {
            return new KhoangNgay(tuNgay == null ? null : tuNgay.atStartOfDay(MUI_GIO_VN).toInstant(),
                    denNgay == null ? null : denNgay.plusDays(1).atStartOfDay(MUI_GIO_VN).toInstant());
        }

        boolean chua(Instant ngay) {
            if (tu == null && den == null) return true;
            if (ngay == null) return false;
            return (tu == null || !ngay.isBefore(tu)) && (den == null || ngay.isBefore(den));
        }
    }

    private static String chuanTuKhoa(String tuKhoa) {
        return tuKhoa == null ? "" : tuKhoa.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean chua(String s, String tk) {
        return s != null && s.toLowerCase(Locale.ROOT).contains(tk);
    }

    private static Instant ngayYeuCau(DonMuaHang d) {
        return d.getNgayGuiYeuCau() != null ? d.getNgayGuiYeuCau() : d.getNgayDatHang();
    }

    private static int soMatHang(DonMuaHang d) {
        return d.getChiTietDonMuaHangs() == null ? 0 : d.getChiTietDonMuaHangs().size();
    }

    private static BigDecimal tongSoLuong(DonMuaHang d) {
        BigDecimal tong = BigDecimal.ZERO;
        if (d.getChiTietDonMuaHangs() == null) return tong;
        for (ChiTietDonMuaHang c : d.getChiTietDonMuaHangs()) if (c.getSoLuongDat() != null) tong = tong.add(c.getSoLuongDat());
        return tong;
    }

    private static CongNcc.NhaCungCap nhaCungCap(List<NhaCungCap> ds) {
        return new CongNcc.NhaCungCap(tenHienThi(ds), ds.get(0).getEmail() == null ? null : ds.get(0).getEmail().trim());
    }

    /** Một nhà cung cấp: tên; nhiều nhà cung cấp dùng chung email: nối tên (tối đa 3, còn lại "+n"). */
    private static String tenHienThi(List<NhaCungCap> ds) {
        List<String> ten = ds.stream().map(NhaCungCap::getTenNhaCungCap).filter(Objects::nonNull).map(String::trim)
                .filter(s -> !s.isEmpty()).distinct().toList();
        if (ten.isEmpty()) return null;
        if (ten.size() <= 3) return String.join(", ", ten);
        return String.join(", ", ten.subList(0, 3)) + " +" + (ten.size() - 3);
    }

    private static CongNcc.NguoiPhuTrach nguoiPhuTrachCua(DonMuaHang don) {
        return don == null ? null : nguoiPhuTrach(don.getNguoiTao());
    }

    private static CongNcc.NguoiPhuTrach nguoiPhuTrach(NguoiDung nd) {
        if (nd == null) return null;
        return new CongNcc.NguoiPhuTrach(nd.getHoTen(), nd.getSoDienThoai(), nd.getEmail());
    }

    private static String chuanHoaEmailBatBuoc(String email) {
        String e = DonMuaHangService.chuanHoaEmail(email);
        if (e == null) {
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.EMAIL_KHONG_CO, ThongDiep.of("sanPhamMuaHang.congNhapEmail"));
        }
        return e;
    }

    private static boolean laMaCua(OtpScheduleObj o, String email) {
        return o.getType() == OtpType.SUPPLIER_MAIL_SIGN_KEY && Objects.equals(o.getEmail(), email);
    }

    private static OtpScheduleObj timMa(String email) {
        return GlobalCache.OTP_SCHEDULE_OBJS.stream().filter(o -> laMaCua(o, email))
                .max(Comparator.comparing(OtpScheduleObj::getCreatedAt)).orElse(null);
    }

    private static boolean maKhop(String maDung, String maNhap) {
        if (maDung == null || maNhap == null) return false;
        return MessageDigest.isEqual(maDung.getBytes(StandardCharsets.UTF_8), maNhap.getBytes(StandardCharsets.UTF_8));
    }

    private static String taoMaPhien() {
        byte[] b = new byte[PHIEN_SO_BYTE];
        NGAU_NHIEN.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static LoiCoMaException phienHetHan() {
        return new LoiCoMaException(HttpStatus.FORBIDDEN, MaLoi.PHIEN_HET_HAN, ThongDiep.of("sanPhamMuaHang.congPhienHetHan"));
    }

    private static LoiCoMaException maHetHan(ThongDiep message) {
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.MA_HET_HAN, message);
    }
}
