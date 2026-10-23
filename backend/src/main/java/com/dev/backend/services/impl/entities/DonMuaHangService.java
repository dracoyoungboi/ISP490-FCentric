package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.OtpType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.ApplicationRequestObj;
import com.dev.backend.dto.OtpScheduleObj;
import com.dev.backend.dto.PhienBaoGia;
import com.dev.backend.dto.request.*;
import com.dev.backend.dto.response.GuiLaiYeuCauDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.congncc.BaoGiaDaNhanDto;
import com.dev.backend.dto.response.congncc.MaXacNhanNccDto;
import com.dev.backend.dto.response.congncc.XacNhanMaNccDto;
import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.mapper.DonMuaHangCongNccMapper;
import com.dev.backend.mapper.DonMuaHangMapper;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.services.CalcService;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.LockModeType;
import org.hibernate.Hibernate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Supplier;

@Service
public class DonMuaHangService extends BaseServiceImpl<DonMuaHang, Integer> {

    private static final Logger log = LoggerFactory.getLogger(DonMuaHangService.class);

    // ---------------- Trạng thái đơn mua (cột don_mua_hang.trang_thai) ----------------

    /** Đã gửi yêu cầu báo giá, chờ / đã có báo giá (đã báo giá ⇔ ngayBaoGia != null). */
    public static final int TRANG_THAI_CHO_BAO_GIA = 2;
    /** Đã chấp nhận báo giá, đang vận chuyển. */
    public static final int TRANG_THAI_DA_CHAP_NHAN = 3;
    /** Không chấp nhận báo giá (bị từ chối, hoặc đã chọn nhà cung cấp khác cùng yêu cầu). */
    public static final int TRANG_THAI_KHONG_CHAP_NHAN = 4;
    /** Đã nhận đủ hàng (PhieuNhapKhoService ghi khi hoàn tất phiếu nhập). */
    public static final int TRANG_THAI_DA_NHAN_DU = 5;

    // ---------------- Cổng nhà cung cấp: thời hạn, giới hạn ----------------

    // Thời hạn mã xác nhận báo giá: OtpType.SUPPLIER_MAIL_SIGN_KEY.thoiHan() (dùng chung cho E5, SchedulingJob,
    // hetHanGiay), không đặt hằng riêng ở đây.

    /** Sau bao lâu mới xin được mã mới cho cùng (email, đơn). */
    public static final int MA_NCC_GUI_LAI_SAU_GIAY = 60;
    /** Tối đa số mã gửi trong một giờ cho cùng (email, đơn): chống dò mã, chống gửi email hàng loạt. */
    public static final int MA_NCC_TOI_DA_MOI_GIO = 5;
    /** Nhập sai đến lần này thì mã bị xóa, phải nhận mã mới. */
    public static final int MA_NCC_SAI_TOI_DA = 5;
    /** Độ dài mã xác nhận. */
    private static final long MA_NCC_DO_DAI = 6L;
    /** K10: phiên báo giá sau khi xác nhận mã đúng. */
    public static final int PHIEN_BAO_GIA_PHUT = 60;
    private static final int PHIEN_BAO_GIA_SO_BYTE = 32;

    // ---------------- Báo giá: giới hạn dữ liệu ----------------

    /** Đơn giá tối đa (số nguyên đồng). FE cổng: baoGiaUtils.loiDonGia. */
    public static final BigDecimal DON_GIA_TOI_DA = new BigDecimal("9999999999");
    /** Giới hạn của cột decimal(15,2) (thành tiền từng dòng, tổng tiền). */
    static final BigDecimal TIEN_TOI_DA = new BigDecimal("9999999999999.99");
    /** Ghi chú nhà cung cấp gửi kèm báo giá (một ghi chú cho cả báo giá). FE cổng giữ cùng giá trị. */
    public static final int GHI_CHU_NCC_TOI_DA = 2000;
    /** Lý do không chấp nhận báo giá (K4, không bắt buộc). FE xét báo giá giữ cùng giá trị. */
    public static final int LY_DO_TU_CHOI_TOI_DA = 500;

    // ---------------- K11: gửi lại email yêu cầu báo giá ----------------

    /**
     * Chỉ gửi lại / chỉ báo "chưa gửi được" khi đơn đã tạo quá chừng này phút (email lần đầu có thể còn trong hàng
     * đợi / đang thử lại). FE: CHO_GUI_LAI_E4_PHUT (nếu cần), nhưng nên đọc cờ chuaGuiDuocYeuCau của DonMuaHangDto.
     */
    public static final int GUI_LAI_E4_SAU_PHUT = 5;
    /** Chặn bấm Gửi lại liên tục cho cùng một đơn. */
    public static final int GUI_LAI_E4_CHAN_LAP_GIAY = 60;

    /** Báo chung cho "không có mã đơn" và "email không khớp" để API công khai không lộ đơn nào tồn tại. */
    private static final String LOI_MA_DON_HOAC_EMAIL = "Email hoặc mã đơn hàng không đúng. Vui lòng kiểm tra lại email nhận yêu cầu báo giá.";
    private static final String LOI_DON_KHONG_CON_NHAN = "Đơn mua hàng này không còn nhận báo giá. Vui lòng liên hệ nhân viên mua hàng đã gửi yêu cầu cho Quý công ty.";
    private static final String LOI_PHIEN_HET_HAN = "Phiên báo giá đã hết hạn. Vui lòng nhận mã mới.";
    private static final String LOI_MA_HET_HAN = "Mã xác nhận đã hết hạn hoặc đã dùng. Vui lòng nhận mã mới.";
    private static final String LOI_DON_DA_CO_KET_QUA = "Đơn này đã có kết quả.";
    private static final String LOI_CHUA_CO_BAO_GIA = "Nhà cung cấp chưa gửi báo giá.";
    private static final String LOI_BAO_GIA_DA_DOI = "Nhà cung cấp vừa gửi lại báo giá. Tải lại để xem giá mới.";
    private static final String LOI_YEU_CAU_KHONG_CON_MO = "Yêu cầu báo giá này đã chọn nhà cung cấp hoặc không còn mở.";
    private static final String LOI_KHONG_TIM_THAY_DON = "Không tìm thấy đơn mua hàng.";

    private static final SecureRandom NGAU_NHIEN = new SecureRandom();

    @Autowired
    private EntityManager entityManager;
    @Autowired
    private NhaCungCapService nhaCungCapService;
    @Autowired
    private NguoiDungService nguoiDungService;
    @Autowired
    private KhoService khoService;
    @Autowired
    private ChiTietDonMuaHangService chiTietDonMuaHangService;
    @Autowired
    private BienTheSanPhamService bienTheSanPhamService;

    @Autowired
    private DonMuaHangMapper donMuaHangMapper;
    @Autowired
    private CalcService calcService;
    @Autowired
    private YeuCauMuaHangService yeuCauMuaHangService;
    @Autowired
    private EmailNghiepVuService emailNghiepVuService;
    @Autowired
    private ThongTinCuaHangMuaHang thongTinCuaHangMuaHang;

    /** Đồng hồ cho thời hạn mã, phiên, chặn gửi lại (test thay bằng đồng hồ tua được). */
    private Clock dongHo = Clock.systemUTC();

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public DonMuaHangService(DonMuaHangRepository repository) {
        super(repository);
    }

    private final DonMuaHangRepository donMuaHangRepository = (DonMuaHangRepository) getRepository();

    void setDongHo(Clock dongHo) {
        this.dongHo = dongHo;
    }

    /** Giao dịch chỉ đọc ngắn của lay-otp (đọc đơn xong mới gửi E5, ngoài giao dịch). */
    private TransactionTemplate giaoDichChiDoc;

    @Autowired
    void setTransactionManager(PlatformTransactionManager transactionManager) {
        TransactionTemplate t = new TransactionTemplate(transactionManager);
        t.setReadOnly(true);
        this.giaoDichChiDoc = t;
    }

    @Transactional
    public ResponseEntity<ResponseData<DonMuaHangDto>> create(DonMuaHangCreating creating) {


        Kho khoNhap = khoService.getOne(SecurityContextHolder.getKhoId()).orElseThrow(
                () -> new CommonException("Không tìm thấy kho id: " + SecurityContextHolder.getKhoId())
        );
        KhoService.kiemTraKhoNhapNcc(khoNhap);


        NguoiDungAuthInfo authInfo = SecurityContextHolder.getUser();

        NguoiDung nguoiTao = nguoiDungService.getOne(authInfo.getId()).orElseThrow(
                () -> new CommonException("Không tìm thấy người dùng id :" + authInfo.getId())
        );

        DonMuaHang donMuaHang = DonMuaHang.builder()
                .khoNhap(khoNhap)
                .ngayDatHang(creating.getNgayDatHang())
                .ngayGiaoDuKien(creating.getNgayGiaoDuKien())
                .trangThai(1)
                .tongTien(BigDecimal.ZERO)
                .ghiChu(creating.getGhiChu())
                .nguoiTao(nguoiTao)
                .nguoiDuyet(nguoiTao.getVaiTro().equals(IRoleType.quan_tri_vien) ? nguoiTao : null)
                .build();

        donMuaHang = create(donMuaHang);

        BigDecimal tongTien = BigDecimal.ZERO;
        BigDecimal tongSoLuong = BigDecimal.ZERO;

        List<ChiTietDonMuaHang> chiTietDonMuaHangs = new ArrayList<>();

        for (ChiTietDonMuaHangCreating ctdmhCreating : creating.getChiTietDonMuaHangs()) {
            BienTheSanPham bienTheSanPham = bienTheSanPhamService.getOne(ctdmhCreating.getBienTheSanPhamId()).orElseThrow(
                    () -> new CommonException("Không tìm thấy biến thể sản phẩm id: " + ctdmhCreating.getBienTheSanPhamId())
            );
            ChiTietDonMuaHang chiTietDonMuaHang = ChiTietDonMuaHang.builder()
                    .donMuaHang(donMuaHang)
                    .bienTheSanPham(bienTheSanPham)
                    .soLuongDat(ctdmhCreating.getSoLuongDat())
                    .soLuongDaNhan(ctdmhCreating.getSoLuongDaNhan())
                    .donGia(ctdmhCreating.getDonGia())
                    .ghiChu(ctdmhCreating.getGhiChu())
                    .build();
            chiTietDonMuaHangs.add(chiTietDonMuaHang);
            chiTietDonMuaHang = chiTietDonMuaHangService.create(chiTietDonMuaHang);
            tongSoLuong = tongSoLuong.add(chiTietDonMuaHang.getSoLuongDat());
            tongTien = tongTien.add(chiTietDonMuaHang.getThanhTien());
        }
        donMuaHang.setTongTien(tongTien);
        donMuaHang.setChiTietDonMuaHangs(chiTietDonMuaHangs);
        update(donMuaHang.getId(), donMuaHang);
        donMuaHang = getOne(donMuaHang.getId()).orElseThrow(
                () -> new CommonException("Không tìm thấy đơn mua hàng : " + creating.getNgayDatHang())
        );

        for (ChiTietDonMuaHang chiTietDonMuaHang : donMuaHang.getChiTietDonMuaHangs()) {
            for (ApplicationRequestObj appReq : GlobalCache.APPLICATION_REQUEST_OBJS) {
                appReq.getBienTheSanPhamIds().removeIf(
                        (tempId) -> tempId.equals(chiTietDonMuaHang.getBienTheSanPham().getId())
                );
            }
        }

        return ResponseEntity.ok(
                ResponseData.<DonMuaHangDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(donMuaHangMapper.toDto(donMuaHang))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    // =====================================================================================================
    // Cổng nhà cung cấp (API công khai, chưa đăng nhập nội bộ): nhận mã, xác nhận mã, gửi báo giá
    // =====================================================================================================

    /** Email so không phân biệt hoa thường, bỏ khoảng trắng hai đầu. null/trống -> null. */
    static String chuanHoaEmail(String email) {
        if (email == null || email.isBlank()) return null;
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean emailKhop(DonMuaHang don, String emailDaChuanHoa) {
        if (emailDaChuanHoa == null || don.getNhaCungCap() == null) return false;
        return emailDaChuanHoa.equals(chuanHoaEmail(don.getNhaCungCap().getEmail()));
    }

    private static LoiCoMaException loiDonHoacEmail(String message) {
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.DON_HOAC_EMAIL_SAI, message);
    }

    private static LoiCoMaException donKhongConNhan() {
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.DON_KHONG_CON_NHAN, LOI_DON_KHONG_CON_NHAN);
    }

    private static LoiCoMaException phienHetHan() {
        return new LoiCoMaException(HttpStatus.FORBIDDEN, MaLoi.PHIEN_HET_HAN, LOI_PHIEN_HET_HAN);
    }

    private static LoiCoMaException maHetHan(String message) {
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.MA_HET_HAN, message);
    }

    /**
     * Đơn mua cho cổng nhà cung cấp: theo id (liên kết trong email có sẵn id) hoặc theo mã đơn nhà cung cấp tự nhập.
     * Email phải khớp email nhà cung cấp của đơn (không phân biệt hoa thường). Không có đơn, nhà cung cấp không có
     * email hoặc email khác: cùng một lỗi DON_HOAC_EMAIL_SAI.
     */
    private DonMuaHang timDonChoNhaCungCap(Integer donMuaHangId, String soDonMua, String emailDaChuanHoa) {
        if (emailDaChuanHoa == null) {
            throw loiDonHoacEmail("Vui lòng nhập email nhận yêu cầu báo giá.");
        }
        Optional<DonMuaHang> don;
        if (donMuaHangId != null) {
            don = donMuaHangRepository.findById(donMuaHangId);
        } else if (soDonMua != null && !soDonMua.isBlank()) {
            don = donMuaHangRepository.findBySoDonMua(soDonMua.trim());
        } else {
            throw loiDonHoacEmail("Vui lòng nhập mã đơn hàng.");
        }
        return don.filter(d -> emailKhop(d, emailDaChuanHoa))
                .orElseThrow(() -> loiDonHoacEmail(LOI_MA_DON_HOAC_EMAIL));
    }

    /** Đơn còn nhận báo giá: đơn ở 2 và yêu cầu nhập hàng của đơn ở 3 (đã gửi báo giá, chưa chọn nhà cung cấp). */
    private static void kiemDonConNhanBaoGia(DonMuaHang don, YeuCauMuaHang yeuCau) {
        if (!Objects.equals(don.getTrangThai(), TRANG_THAI_CHO_BAO_GIA)) {
            throw donKhongConNhan();
        }
        try {
            if (yeuCau == null || !Objects.equals(yeuCau.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA)) {
                throw donKhongConNhan();
            }
        } catch (EntityNotFoundException e) {
            // Đơn cũ trỏ tới yêu cầu không còn (không có khóa ngoại): coi như không còn nhận báo giá
            throw donKhongConNhan();
        }
    }

    private static String khoaLuotGuiMa(String email, Integer donMuaHangId) {
        return email + "|" + donMuaHangId;
    }

    private static boolean laMaNccCua(OtpScheduleObj o, String email, Integer donMuaHangId) {
        return o.getType() == OtpType.SUPPLIER_MAIL_SIGN_KEY
                && Objects.equals(o.getEmail(), email)
                && Objects.equals(o.getDonMuaHangId(), donMuaHangId);
    }

    /** Mã mới nhất của (email, đơn); null nếu không có. */
    private static OtpScheduleObj timMaNcc(String email, Integer donMuaHangId) {
        return GlobalCache.OTP_SCHEDULE_OBJS.stream()
                .filter(o -> laMaNccCua(o, email, donMuaHangId))
                .max(Comparator.comparing(OtpScheduleObj::getCreatedAt))
                .orElse(null);
    }

    /** Số giây (làm tròn lên, không âm) từ {@code tu} tới {@code den}. */
    private static int giayConLai(Instant tu, Instant den) {
        long ms = Duration.between(tu, den).toMillis();
        if (ms <= 0) return 0;
        return (int) Math.min(Integer.MAX_VALUE, (ms + 999) / 1000);
    }

    /**
     * Nhận mã xác nhận báo giá (E5 gửi ngay trong request). Mỗi (email, đơn) một mã; xin lại trong 60 giây hoặc quá
     * 5 mã mỗi giờ thì 429.
     * <p>Không giữ giao dịch trong lúc chờ máy chủ email: đơn được đọc, kiểm và nạp sẵn mọi quan hệ E5 cần (nhà cung
     * cấp, người phụ trách) trong một giao dịch chỉ đọc ngắn, rồi E5 gửi ngoài giao dịch, không còn đọc LAZY (chạy
     * được cả khi tắt open-in-view). Lưu ý: open-in-view đang bật (mặc định) nên EntityManager của request vẫn giữ
     * kết nối CSDL đã lấy tới hết request; muốn nhả hẳn kết nối trong lúc chờ SMTP phải loại 3 API cổng khỏi
     * open-in-view.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ResponseEntity<ResponseData<MaXacNhanNccDto>> getOtpForSupplier(OtpDonMuaHangGetting getting) {
        String email = chuanHoaEmail(getting == null ? null : getting.getEmail());
        DonMuaHang don = docTrongGiaoDichChiDoc(() -> {
            DonMuaHang d = timDonChoNhaCungCap(getting == null ? null : getting.getDonMuaHangId(),
                    getting == null ? null : getting.getSoDonMua(), email);
            kiemDonConNhanBaoGia(d, d.getYeuCauMuaHang());
            napQuanHeChoEmailMa(d);
            return d;
        });

        Instant now = dongHo.instant();
        Duration thoiHanMa = OtpType.SUPPLIER_MAIL_SIGN_KEY.thoiHan();
        String khoa = khoaLuotGuiMa(email, don.getId());
        OtpScheduleObj ma;
        synchronized (GlobalCache.OTP_SCHEDULE_OBJS) {
            OtpScheduleObj cu = timMaNcc(email, don.getId());
            // R10: mã cũ đã hết hạn (hoặc đã dùng / đã dọn) thì hetHanGiay = 0 để cổng ở lại bước nhận mã
            int hetHanMaCu = cu == null ? 0 : giayConLai(now, cu.getCreatedAt().plus(thoiHanMa));
            if (cu != null && now.isBefore(cu.getCreatedAt().plusSeconds(MA_NCC_GUI_LAI_SAU_GIAY))) {
                int cho = giayConLai(now, cu.getCreatedAt().plusSeconds(MA_NCC_GUI_LAI_SAU_GIAY));
                throw new LoiCoMaException(HttpStatus.TOO_MANY_REQUESTS, MaLoi.MA_CU_CON_HIEU_LUC,
                        "Vui lòng chờ " + cho + " giây rồi nhận mã mới.",
                        Map.of("guiLaiSauGiay", cho, "hetHanGiay", hetHanMaCu));
            }
            Instant motGioTruoc = now.minus(1, ChronoUnit.HOURS);
            List<Instant> luot = GlobalCache.LUOT_GUI_MA_NCC.getOrDefault(khoa, List.of()).stream()
                    .filter(t -> t.isAfter(motGioTruoc))
                    .sorted()
                    .toList();
            if (luot.size() >= MA_NCC_TOI_DA_MOI_GIO) {
                int cho = Math.max(1, giayConLai(now, luot.get(0).plus(1, ChronoUnit.HOURS)));
                throw new LoiCoMaException(HttpStatus.TOO_MANY_REQUESTS, MaLoi.MA_CU_CON_HIEU_LUC,
                        "Đã gửi " + MA_NCC_TOI_DA_MOI_GIO + " mã xác nhận trong một giờ. Vui lòng thử lại sau "
                                + ((cho + 59) / 60) + " phút.",
                        Map.of("guiLaiSauGiay", cho, "hetHanGiay", hetHanMaCu));
            }
            GlobalCache.OTP_SCHEDULE_OBJS.removeIf(o -> laMaNccCua(o, email, don.getId()));
            ma = OtpScheduleObj.builder()
                    .email(email)
                    .otp(calcService.getRandomActiveCode(MA_NCC_DO_DAI))
                    .type(OtpType.SUPPLIER_MAIL_SIGN_KEY)
                    .donMuaHangId(don.getId())
                    .createdAt(now)
                    .build();
            GlobalCache.OTP_SCHEDULE_OBJS.add(ma);
            List<Instant> luotMoi = new ArrayList<>(luot);
            luotMoi.add(now);
            GlobalCache.LUOT_GUI_MA_NCC.put(khoa, List.copyOf(luotMoi));
        }

        try {
            // Ngoài synchronized (Quên mật khẩu dùng chung khóa này) và ngoài transaction (NOT_SUPPORTED)
            emailNghiepVuService.guiMaXacNhanBaoGia(don, don.getNhaCungCap().getEmail().trim(), ma.getOtp(),
                    ma.getCreatedAt().plus(thoiHanMa));
        } catch (RuntimeException e) {
            // Gửi lỗi: xóa mã và lượt vừa tính để nhà cung cấp xin lại được ngay. Không ghi mã vào log.
            synchronized (GlobalCache.OTP_SCHEDULE_OBJS) {
                GlobalCache.OTP_SCHEDULE_OBJS.remove(ma);
                GlobalCache.LUOT_GUI_MA_NCC.computeIfPresent(khoa, (k, ds) -> {
                    List<Instant> conLai = new ArrayList<>(ds);
                    conLai.remove(now);
                    return conLai.isEmpty() ? null : List.copyOf(conLai);
                });
            }
            log.warn("Không gửi được email mã xác nhận báo giá đơn {} ({})", don.getSoDonMua(), e.getClass().getSimpleName());
            throw new LoiCoMaException(HttpStatus.SERVICE_UNAVAILABLE, MaLoi.CHUA_GUI_DUOC_MA,
                    "Chưa gửi được mã xác nhận. Vui lòng thử lại sau ít phút.");
        }

        return ResponseEntity.ok(
                ResponseData.<MaXacNhanNccDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(MaXacNhanNccDto.builder()
                                .hetHanGiay((int) thoiHanMa.toSeconds())
                                .guiLaiSauGiay(MA_NCC_GUI_LAI_SAU_GIAY)
                                .build())
                        .message("Đã gửi mã xác nhận.")
                        .error(null)
                        .build()
        );
    }

    /** Chạy {@code viec} trong giao dịch chỉ đọc (không có bộ quản lý giao dịch, như test đơn vị: chạy thẳng). */
    private <T> T docTrongGiaoDichChiDoc(Supplier<T> viec) {
        return giaoDichChiDoc == null ? viec.get() : giaoDichChiDoc.execute(trangThaiGiaoDich -> viec.get());
    }

    /** Nạp sẵn các quan hệ LAZY mà E5 đọc (tên, email nhà cung cấp; phần ký người phụ trách) khi còn trong giao dịch. */
    private static void napQuanHeChoEmailMa(DonMuaHang don) {
        Hibernate.initialize(don.getNhaCungCap());
        try {
            Hibernate.initialize(don.getNguoiTao());
        } catch (EntityNotFoundException e) {
            // Người tạo không còn (dữ liệu cũ): E5 tự báo không dựng được thư -> 503 như trước
        }
    }

    private static boolean maKhop(String maDung, String maNhap) {
        if (maDung == null || maNhap == null) return false;
        return MessageDigest.isEqual(maDung.getBytes(StandardCharsets.UTF_8), maNhap.getBytes(StandardCharsets.UTF_8));
    }

    private static String taoMaPhien() {
        byte[] b = new byte[PHIEN_BAO_GIA_SO_BYTE];
        NGAU_NHIEN.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    /**
     * Xác nhận mã: khớp đủ loại mã, email, đơn và còn hạn. Sai thì tăng số lần sai, đủ 5 lần thì xóa mã. Đúng thì xóa
     * mã (chỉ dùng một lần; hai yêu cầu cùng lúc chỉ một yêu cầu qua) và mở phiên báo giá 60 phút cho đúng đơn này.
     */
    @Transactional(readOnly = true)
    public ResponseEntity<ResponseData<XacNhanMaNccDto>> confirmOtpForSupplier(OtpDonMuaHangConfirming confirming) {
        String email = chuanHoaEmail(confirming == null ? null : confirming.getEmail());
        DonMuaHang don = timDonChoNhaCungCap(confirming == null ? null : confirming.getDonMuaHangId(),
                confirming == null ? null : confirming.getSoDonMua(), email);
        kiemDonConNhanBaoGia(don, don.getYeuCauMuaHang());

        Instant now = dongHo.instant();
        String maNhap = confirming.getOtp() == null ? "" : confirming.getOtp().trim();
        OtpScheduleObj ma = timMaNcc(email, don.getId());
        if (ma == null) {
            throw maHetHan(LOI_MA_HET_HAN);
        }
        if (now.isAfter(ma.getCreatedAt().plus(OtpType.SUPPLIER_MAIL_SIGN_KEY.thoiHan()))) {
            GlobalCache.OTP_SCHEDULE_OBJS.remove(ma);
            throw maHetHan(LOI_MA_HET_HAN);
        }
        if (!maKhop(ma.getOtp(), maNhap)) {
            int sai = ma.getFailedAttempts().incrementAndGet();
            if (sai >= MA_NCC_SAI_TOI_DA) {
                GlobalCache.OTP_SCHEDULE_OBJS.remove(ma);
                throw maHetHan("Đã nhập sai " + MA_NCC_SAI_TOI_DA + " lần. Vui lòng nhận mã mới.");
            }
            int conLai = MA_NCC_SAI_TOI_DA - sai;
            throw new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.MA_SAI,
                    "Mã xác nhận không đúng. Còn " + conLai + " lần thử.", Map.of("conLaiLanThu", conLai));
        }
        if (!GlobalCache.OTP_SCHEDULE_OBJS.remove(ma)) {
            // Yêu cầu khác vừa dùng (hoặc job vừa dọn) đúng mã này
            throw maHetHan(LOI_MA_HET_HAN);
        }

        String maPhien = taoMaPhien();
        Instant hetHanPhien = now.plus(PHIEN_BAO_GIA_PHUT, ChronoUnit.MINUTES);
        Integer donId = don.getId();
        // Mỗi (email, đơn) một phiên: xác nhận lại thì phiên cũ hết dùng
        GlobalCache.PHIEN_BAO_GIA.values().removeIf(p -> Objects.equals(p.donMuaHangId(), donId) && email.equals(p.email()));
        GlobalCache.PHIEN_BAO_GIA.put(maPhien, new PhienBaoGia(donId, email, hetHanPhien));

        return ResponseEntity.ok(
                ResponseData.<XacNhanMaNccDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(XacNhanMaNccDto.builder()
                                .donMua(DonMuaHangCongNccMapper.toDto(don))
                                .phienBaoGia(maPhien)
                                .hetHanPhien(hetHanPhien)
                                .cuaHang(thongTinCuaHangMuaHang.choCongNhaCungCap())
                                .build())
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    /** Phiên còn hạn của token; không có / hết hạn (xóa luôn) thì PHIEN_HET_HAN. Không ghi token vào log. */
    private PhienBaoGia layPhien(String maPhien, Instant now) {
        if (maPhien == null || maPhien.isBlank()) throw phienHetHan();
        String khoa = maPhien.trim();
        PhienBaoGia phien = GlobalCache.PHIEN_BAO_GIA.get(khoa);
        if (phien == null) throw phienHetHan();
        if (phien.daHetHan(now)) {
            GlobalCache.PHIEN_BAO_GIA.remove(khoa, phien);
            throw phienHetHan();
        }
        return phien;
    }

    private static LoiCoMaException baoGiaSai(String message, Integer dong) {
        Map<String, Object> duLieu = new HashMap<>();
        if (dong != null) duLieu.put("dong", dong);
        return new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.BAO_GIA_KHONG_HOP_LE, message, duLieu);
    }

    /**
     * Id dòng chi_tiet_don_mua_hang của một mục báo giá: chiTietDonMuaHangId, thiếu thì id (cổng gửi cả hai, cùng giá
     * trị). Hai trường cùng có mà khác nhau: coi như thiếu (không đoán dòng nào).
     */
    private static Integer idDongBaoGia(ChiTietDonMuaHangBaoGia muc) {
        Integer theoMa = muc.getChiTietDonMuaHangId();
        Integer theoId = muc.getId();
        if (theoMa != null && theoId != null && !theoMa.equals(theoId)) return null;
        return theoMa != null ? theoMa : theoId;
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    /** "3 (AO-DO-M)": số thứ tự dòng (theo id, như email và cổng) kèm SKU. */
    private static String nhanDong(int stt, ChiTietDonMuaHang ct) {
        String sku = ct.getBienTheSanPham() == null ? null : ct.getBienTheSanPham().getMaSku();
        return sku == null || sku.isBlank() ? String.valueOf(stt) : stt + " (" + sku + ")";
    }

    /**
     * Nhà cung cấp gửi (hoặc gửi lại) báo giá. Cần phiên báo giá của đúng đơn (header X-Phien-Bao-Gia). Khóa yêu cầu
     * rồi mới khóa đơn (cùng thứ tự với xét báo giá), kiểm lại đơn còn nhận báo giá, kiểm dữ liệu, ghép đơn giá theo id
     * dòng. Ghi tổng tiền tự tính, ghi chú, ngayBaoGia; trạng thái giữ 2. M3 dựng trong transaction, gửi sau commit.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ResponseEntity<ResponseData<BaoGiaDaNhanDto>> baoGiaDonMuaHang(String maPhien, DonMuaHangBaoGia baoGia) {
        Instant now = dongHo.instant();
        PhienBaoGia phien = layPhien(maPhien, now);
        if (baoGia == null || baoGia.getId() == null || !Objects.equals(phien.donMuaHangId(), baoGia.getId())) {
            throw phienHetHan();
        }
        Integer donId = phien.donMuaHangId();

        // R13: đơn không thuộc yêu cầu nào (cột NULL) hoặc trỏ tới yêu cầu không còn: 409, không khóa đơn
        int yeuCauId = donMuaHangRepository.layIdYeuCau(donId).orElseThrow(DonMuaHangService::donKhongConNhan);
        if (yeuCauId == 0) throw donKhongConNhan();
        YeuCauMuaHang yeuCau = khoaYeuCau(yeuCauId);
        if (yeuCau == null) throw donKhongConNhan();
        DonMuaHang don = khoaDon(donId);
        if (don == null) throw donKhongConNhan();
        kiemDonConNhanBaoGia(don, yeuCau);
        if (!emailKhop(don, phien.email())) {
            // Email nhà cung cấp của đơn vừa đổi: phiên mở bằng email cũ không còn dùng được
            throw phienHetHan();
        }

        String ghiChu = baoGia.getGhiChu() == null || baoGia.getGhiChu().isBlank() ? null : baoGia.getGhiChu().trim();
        if (ghiChu != null && ghiChu.length() > GHI_CHU_NCC_TOI_DA) {
            throw baoGiaSai("Ghi chú không được quá 2.000 ký tự.", null);
        }

        List<ChiTietDonMuaHang> cacDong = new ArrayList<>(
                don.getChiTietDonMuaHangs() == null ? List.of() : don.getChiTietDonMuaHangs());
        cacDong.sort(Comparator.comparing(ChiTietDonMuaHang::getId));
        if (cacDong.isEmpty()) {
            throw baoGiaSai("Đơn này chưa có sản phẩm nào để báo giá.", null);
        }
        List<ChiTietDonMuaHangBaoGia> gui = baoGia.getChiTietDonMuaHangBaoGias();
        if (gui == null || gui.isEmpty()) {
            throw baoGiaSai("Báo giá chưa có dòng sản phẩm nào.", null);
        }

        Map<Integer, ChiTietDonMuaHang> dongTheoId = new LinkedHashMap<>();
        Map<Integer, Integer> sttTheoId = new HashMap<>();
        for (int i = 0; i < cacDong.size(); i++) {
            dongTheoId.put(cacDong.get(i).getId(), cacDong.get(i));
            sttTheoId.put(cacDong.get(i).getId(), i + 1);
        }

        Map<Integer, BigDecimal> giaTheoId = new HashMap<>();
        for (ChiTietDonMuaHangBaoGia muc : gui) {
            Integer idDong = muc == null ? null : idDongBaoGia(muc);
            if (idDong == null) {
                throw baoGiaSai("Báo giá có dòng thiếu mã dòng. Tải lại trang rồi gửi lại.", null);
            }
            ChiTietDonMuaHang ct = dongTheoId.get(idDong);
            if (ct == null) {
                throw baoGiaSai("Báo giá có dòng không thuộc đơn " + don.getSoDonMua() + ". Tải lại trang rồi gửi lại.", idDong);
            }
            String nhan = nhanDong(sttTheoId.get(idDong), ct);
            if (giaTheoId.containsKey(idDong)) {
                throw baoGiaSai("Dòng " + nhan + " bị gửi hai lần. Tải lại trang rồi gửi lại.", idDong);
            }
            BigDecimal donGia = muc.getDonGia();
            if (donGia == null) {
                throw baoGiaSai("Dòng " + nhan + " chưa có đơn giá.", idDong);
            }
            if (donGia.signum() <= 0) {
                throw baoGiaSai("Đơn giá dòng " + nhan + " phải lớn hơn 0.", idDong);
            }
            if (donGia.stripTrailingZeros().scale() > 0) {
                throw baoGiaSai("Đơn giá dòng " + nhan + " phải là số nguyên đồng, không có phần lẻ.", idDong);
            }
            if (donGia.compareTo(DON_GIA_TOI_DA) > 0) {
                throw baoGiaSai("Đơn giá dòng " + nhan + " không được quá 9.999.999.999 ₫.", idDong);
            }
            giaTheoId.put(idDong, donGia.setScale(2, RoundingMode.UNNECESSARY));
        }
        for (ChiTietDonMuaHang ct : cacDong) {
            if (!giaTheoId.containsKey(ct.getId())) {
                throw baoGiaSai("Dòng " + nhanDong(sttTheoId.get(ct.getId()), ct) + " chưa có đơn giá.", ct.getId());
            }
        }

        // Thành tiền tự tính (không đọc thanhTien: cột tự sinh, entity giữ giá trị cũ sau khi cập nhật)
        BigDecimal tongTien = BigDecimal.ZERO;
        for (ChiTietDonMuaHang ct : cacDong) {
            BigDecimal soLuong = ct.getSoLuongDat() == null ? BigDecimal.ZERO : ct.getSoLuongDat();
            BigDecimal thanhTien = soLuong.multiply(giaTheoId.get(ct.getId())).setScale(2, RoundingMode.HALF_UP);
            if (thanhTien.compareTo(TIEN_TOI_DA) > 0) {
                throw baoGiaSai("Thành tiền dòng " + nhanDong(sttTheoId.get(ct.getId()), ct)
                        + " vượt quá giới hạn 9.999.999.999.999 ₫. Kiểm tra lại đơn giá.", ct.getId());
            }
            tongTien = tongTien.add(thanhTien);
        }
        if (tongTien.compareTo(TIEN_TOI_DA) > 0) {
            throw baoGiaSai("Tổng tiền báo giá vượt quá giới hạn 9.999.999.999.999 ₫. Kiểm tra lại đơn giá.", null);
        }

        for (ChiTietDonMuaHang ct : cacDong) {
            ct.setDonGia(giaTheoId.get(ct.getId()));
            chiTietDonMuaHangService.update(ct.getId(), ct);
        }
        // Cột TIMESTAMP không giữ phần lẻ của giây (và làm tròn): cắt trước để giờ trong M3, trên màn hình, trong CSDL
        // là một, và phép so ngayBaoGiaDaXem khi xét báo giá khớp đúng.
        Instant ngayBaoGia = ngayBaoGiaMoi(now, don.getNgayBaoGia());
        don.setTongTien(tongTien.setScale(2, RoundingMode.HALF_UP));
        don.setGhiChuNhaCungCap(ghiChu);
        don.setNgayBaoGia(ngayBaoGia);
        donMuaHangRepository.save(don);

        emailNghiepVuService.guiDaNhanBaoGia(don);
        // M3 đi tới email nhà cung cấp của đơn (đã khớp email của phiên ở trên)
        String emailXacNhan = don.getNhaCungCap() == null ? null : blankToNull(don.getNhaCungCap().getEmail());

        return ResponseEntity.ok(
                ResponseData.<BaoGiaDaNhanDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(BaoGiaDaNhanDto.builder()
                                .ngayBaoGia(ngayBaoGia)
                                .tongTien(don.getTongTien())
                                .daGuiEmailXacNhan(emailXacNhan != null)
                                .emailXacNhan(emailXacNhan)
                                .build())
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    /**
     * ngayBaoGia của lần gửi này: giờ hiện tại cắt về giây, nhưng luôn lớn hơn lần báo giá trước ít nhất 1 giây. Gửi
     * lại trong cùng một giây vẫn ra ngày khác, nên màn xét đang hiện lần trước nhận 409 BAO_GIA_DA_DOI thay vì chấp
     * nhận một giá nhân viên chưa thấy (đặc tả 6.3), và M3 của lần trước bị bỏ.
     */
    static Instant ngayBaoGiaMoi(Instant now, Instant ngayBaoGiaCu) {
        Instant moi = now.truncatedTo(ChronoUnit.SECONDS);
        if (ngayBaoGiaCu == null) return moi;
        Instant sauLanCu = ngayBaoGiaCu.truncatedTo(ChronoUnit.SECONDS).plusSeconds(1);
        return moi.isBefore(sauLanCu) ? sauLanCu : moi;
    }

    // =====================================================================================================
    // Khóa theo thứ tự cố định của luồng mua hàng: yêu cầu nhập hàng -> các đơn mua (id tăng dần) -> dòng
    // =====================================================================================================

    /**
     * Khóa yêu cầu (SELECT … FOR UPDATE) rồi nạp lại bằng locking read: với open-in-view, entity có thể đã nằm trong
     * persistence context từ trước (đọc không khóa), find có khóa vẫn trả bản cũ. null nếu không có.
     */
    private YeuCauMuaHang khoaYeuCau(Integer id) {
        YeuCauMuaHang yeuCau = entityManager.find(YeuCauMuaHang.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (yeuCau != null) {
            entityManager.refresh(yeuCau, LockModeType.PESSIMISTIC_WRITE);
        }
        return yeuCau;
    }

    /** Khóa một đơn và nạp lại (xem {@link #khoaYeuCau}). null nếu không có. */
    private DonMuaHang khoaDon(Integer id) {
        DonMuaHang don = donMuaHangRepository.findByIdForUpdate(id).orElse(null);
        if (don != null) {
            entityManager.refresh(don, LockModeType.PESSIMISTIC_WRITE);
        }
        return don;
    }

    /** Khóa mọi đơn cùng yêu cầu theo id tăng dần và nạp lại từng đơn. */
    private List<DonMuaHang> khoaCacDonCuaYeuCau(Integer yeuCauId) {
        List<DonMuaHang> cacDon = donMuaHangRepository.khoaTheoYeuCau(yeuCauId);
        for (DonMuaHang don : cacDon) {
            entityManager.refresh(don, LockModeType.PESSIMISTIC_WRITE);
        }
        return cacDon;
    }

    private static LoiCoMaException yeuCauKhongConMo() {
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.YEU_CAU_KHONG_CON_MO, LOI_YEU_CAU_KHONG_CON_MO);
    }

    /**
     * Yêu cầu còn chọn được báo giá: đang ở 3 (đã gửi yêu cầu báo giá) và chưa có đơn nào cùng yêu cầu đã được chấp
     * nhận (3) hay đã nhận đủ (5). Kiểm cả hai vì CSDL chưa chạy migration có thể còn yêu cầu ở 3 đã có đơn được chọn.
     */
    static boolean yeuCauConMo(YeuCauMuaHang yeuCau, List<DonMuaHang> cacDonCuaYeuCau) {
        if (yeuCau == null || !Objects.equals(yeuCau.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA)) {
            return false;
        }
        return cacDonCuaYeuCau.stream().noneMatch(d -> Objects.equals(d.getTrangThai(), TRANG_THAI_DA_CHAP_NHAN)
                || Objects.equals(d.getTrangThai(), TRANG_THAI_DA_NHAN_DU));
    }

    private NguoiDung nguoiDangThaoTac() {
        NguoiDungAuthInfo authInfo = SecurityContextHolder.getUser();
        if (authInfo == null || authInfo.getId() == null) {
            throw new CommonException("Bạn phải đăng nhập", HttpStatus.UNAUTHORIZED, null);
        }
        return nguoiDungService.getOne(authInfo.getId()).orElseThrow(
                () -> new CommonException("Không tìm thấy người dùng id: " + authInfo.getId())
        );
    }

    // =====================================================================================================
    // Xét báo giá: chấp nhận (3) / không chấp nhận (4)
    // =====================================================================================================

    /**
     * Xét báo giá của một nhà cung cấp, cả hàm trong một transaction.
     * - Khóa yêu cầu, rồi mọi đơn cùng yêu cầu (id tăng dần), rồi mới đọc trạng thái và ngayBaoGia: bấm 2 lần chỉ ra
     *   1 kết quả và 1 lần gửi email; nhà cung cấp gửi lại báo giá cùng lúc thì hoặc vào trước (BAO_GIA_DA_DOI), hoặc
     *   bị từ chối (DON_KHONG_CON_NHAN ở cổng).
     * - Chỉ xét đơn ở 2, đã có báo giá, yêu cầu ở 3, và ngayBaoGiaDaXem trùng giá trị trong CSDL (M1 không xác nhận
     *   một giá nhân viên chưa thấy).
     * - Chấp nhận: đơn -> 3, yêu cầu -> đã chọn nhà cung cấp (5); K1: các đơn khác cùng yêu cầu đang ở 2 -> 4 (lý do
     *   trống, KHÔNG ghi người duyệt: HOP-DONG 6.3, DonMuaHangDto.khongDuocChon dựa vào đó). Email sau commit: M1 cho
     *   đơn được chọn, M2 cho từng đơn còn lại.
     * - Không chấp nhận: đơn -> 4 kèm lý do (K4, không bắt buộc), ghi người duyệt; yêu cầu giữ 3 để chọn báo giá khác.
     *   M2 sau commit.
     * - 409: DON_DA_CO_KET_QUA (đơn không còn ở 2), YEU_CAU_KHONG_CON_MO (đơn không thuộc yêu cầu nào / yêu cầu không
     *   còn, yêu cầu khác 3, hoặc đã có đơn cùng yêu cầu ở 3, 5), CHUA_CO_BAO_GIA, BAO_GIA_DA_DOI. Lỗi nhập liệu: 400.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void xetBaoGia(Integer id, Integer ketQua, String lyDo, Instant ngayBaoGiaDaXem) {
        if (ketQua == null || (ketQua != TRANG_THAI_DA_CHAP_NHAN && ketQua != TRANG_THAI_KHONG_CHAP_NHAN)) {
            throw new CommonException("Kết quả xét báo giá không hợp lệ: chỉ nhận Chấp nhận (3) hoặc Không chấp nhận (4).");
        }
        String lyDoChuan = lyDo == null || lyDo.isBlank() ? null : lyDo.trim();
        if (lyDoChuan != null && lyDoChuan.length() > LY_DO_TU_CHOI_TOI_DA) {
            throw new CommonException("Lý do không chấp nhận không được quá " + LY_DO_TU_CHOI_TOI_DA + " ký tự.");
        }
        if (id == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON);
        }
        NguoiDung nguoiChot = nguoiDangThaoTac();

        int yeuCauId = donMuaHangRepository.layIdYeuCau(id).orElseThrow(
                () -> new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON));
        // R13: đơn cũ không thuộc yêu cầu nào, hoặc trỏ tới yêu cầu không còn (find có khóa trả null): 409, không NPE
        YeuCauMuaHang yeuCau = yeuCauId == 0 ? null : khoaYeuCau(yeuCauId);
        if (yeuCau == null) {
            throw yeuCauKhongConMo();
        }
        List<DonMuaHang> cacDon = khoaCacDonCuaYeuCau(yeuCauId);
        DonMuaHang don = cacDon.stream().filter(d -> id.equals(d.getId())).findFirst().orElseThrow(
                () -> new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON));

        if (!Objects.equals(don.getTrangThai(), TRANG_THAI_CHO_BAO_GIA)) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.DON_DA_CO_KET_QUA, LOI_DON_DA_CO_KET_QUA);
        }
        // Yêu cầu đã chọn nhà cung cấp; hoặc dữ liệu cũ: yêu cầu còn ở 3 mà đã có đơn được chọn (3) / nhận đủ (5)
        if (!yeuCauConMo(yeuCau, cacDon)) {
            throw yeuCauKhongConMo();
        }
        if (don.getNgayBaoGia() == null) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.CHUA_CO_BAO_GIA, LOI_CHUA_CO_BAO_GIA);
        }
        if (ngayBaoGiaDaXem == null) {
            throw new CommonException("Tải lại trang để xem báo giá mới nhất rồi thử lại.");
        }
        if (don.getNgayBaoGia().getEpochSecond() != ngayBaoGiaDaXem.getEpochSecond()) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.BAO_GIA_DA_DOI, LOI_BAO_GIA_DA_DOI);
        }

        if (ketQua == TRANG_THAI_DA_CHAP_NHAN) {
            don.setTrangThai(TRANG_THAI_DA_CHAP_NHAN);
            don.setNguoiDuyet(nguoiChot);
            don.setLyDoTuChoi(null);
            donMuaHangRepository.save(don);

            // K1: đã chọn nhà cung cấp này thì các báo giá còn chờ của cùng yêu cầu kết thúc. Không phải bị từ chối vì
            // lý do riêng: không lý do, không người duyệt (phân biệt với từ chối thật, xem khongDuocChon).
            List<DonMuaHang> conLai = new ArrayList<>();
            for (DonMuaHang khac : cacDon) {
                if (khac != don && Objects.equals(khac.getTrangThai(), TRANG_THAI_CHO_BAO_GIA)) {
                    khac.setTrangThai(TRANG_THAI_KHONG_CHAP_NHAN);
                    khac.setNguoiDuyet(null);
                    khac.setLyDoTuChoi(null);
                    donMuaHangRepository.save(khac);
                    conLai.add(khac);
                }
            }

            // Thay đổi trên entity đã khóa (không gọi changeStatus: hàm đó đọc lại yêu cầu)
            yeuCau.setTrangThai(YeuCauMuaHangService.TRANG_THAI_DA_CHON_NCC);
            yeuCauMuaHangService.create(yeuCau);

            emailNghiepVuService.guiXacNhanDatHang(don);
            for (DonMuaHang khac : conLai) {
                emailNghiepVuService.guiKetQuaBaoGia(khac);
            }
        } else {
            don.setTrangThai(TRANG_THAI_KHONG_CHAP_NHAN);
            don.setLyDoTuChoi(lyDoChuan);
            don.setNguoiDuyet(nguoiChot);
            donMuaHangRepository.save(don);
            emailNghiepVuService.guiKetQuaBaoGia(don);
        }
    }

    // =====================================================================================================
    // Gửi yêu cầu báo giá (E4) và gửi lại (K11)
    // =====================================================================================================

    /**
     * Gửi yêu cầu báo giá: mỗi nhà cung cấp một đơn mua (trạng thái 2) và một email E4 (gửi sau commit).
     * Chặn trước khi tạo gì: thiếu thông tin cửa hàng (409 THIEU_THONG_TIN_CUA_HANG). Khóa yêu cầu rồi mới kiểm trạng
     * thái: bấm 2 lần cùng lúc chỉ ra một bộ đơn, lần sau 409 YEU_CAU_DA_GUI.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ResponseEntity<ResponseData<String>> guiYeuCauBaoGiaDenNhaCungCap(YeuCauDenNhaCungCapCreating yeuCau) {
        thongTinCuaHangMuaHang.kiemDuDeGuiNhaCungCap();
        if (yeuCau == null || yeuCau.getYeuCauMuaHangId() == null) {
            throw new CommonException("Vui lòng chọn yêu cầu nhập hàng.");
        }
        if (yeuCau.getNhaCungCapIds() == null || yeuCau.getNhaCungCapIds().isEmpty()) {
            throw new CommonException("Vui lòng chọn ít nhất một nhà cung cấp");
        }
        // lấy thông tin người dùng đang đăng nhập
        NguoiDung nguoiDung = nguoiDangThaoTac();

        YeuCauMuaHang yeuCauMuaHang = khoaYeuCau(yeuCau.getYeuCauMuaHangId());
        if (yeuCauMuaHang == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu nhập hàng.");
        }
        // Kiểm sau khi khóa: hai lần bấm cùng lúc thì lần sau chờ khóa, thấy yêu cầu đã ở 3 và dừng
        if (Objects.equals(yeuCauMuaHang.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA)
                || Objects.equals(yeuCauMuaHang.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_CHON_NCC)) {
            String ma = yeuCauMuaHang.getSoYeuCauMuaHang();
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.YEU_CAU_DA_GUI,
                    (ma == null || ma.isBlank() ? "Yêu cầu này" : "Yêu cầu " + ma)
                            + " đã được gửi báo giá. Tải lại trang để xem.");
        }
        //kiểm tra xem yêu cầu đã dc duyệt hay chưa
        if (!Objects.equals(yeuCauMuaHang.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_DUYET)) {
            throw new CommonException(HttpStatus.CONFLICT,
                    "Yêu cầu nhập hàng chưa được duyệt nên chưa gửi được yêu cầu báo giá.");
        }

        // Kiểm tra hết các nhà cung cấp TRƯỚC khi tạo đơn: chỉ một nhà cung cấp không hợp lệ
        // thì không tạo đơn cho ai. Trùng id thì chỉ gửi một lần.
        List<NhaCungCap> danhSachNhaCungCap = new ArrayList<>();
        for (Integer nhaCungCapId : new LinkedHashSet<>(yeuCau.getNhaCungCapIds())) {
            NhaCungCap nhaCungCap = nhaCungCapService.getOne(nhaCungCapId).orElseThrow(
                    () -> new CommonException("Có nhà cung cấp đã chọn không còn trong hệ thống. Tải lại trang rồi chọn lại.")
            );
            // Nhà cung cấp đã ngừng hoạt động thì không nhận yêu cầu báo giá mới
            if (!Objects.equals(nhaCungCap.getTrangThai(), NhaCungCapService.TRANG_THAI_HOAT_DONG)) {
                throw new CommonException("Nhà cung cấp " + nhaCungCap.getTenNhaCungCap()
                        + " đã ngừng hoạt động, không thể gửi yêu cầu báo giá.");
            }
            // Yêu cầu báo giá gửi qua email và nhà cung cấp đăng nhập cổng bằng email
            if (nhaCungCap.getEmail() == null || nhaCungCap.getEmail().isBlank()) {
                throw new CommonException("Nhà cung cấp " + nhaCungCap.getTenNhaCungCap()
                        + " chưa có email nên không gửi được yêu cầu báo giá. Vui lòng cập nhật email trước.");
            }
            danhSachNhaCungCap.add(nhaCungCap);
        }

        // Cùng đồng hồ với cờ chuaGuiDuocYeuCau / gửi lại (mốc 5 phút tính từ ngày đặt khi chưa có ngay_tao)
        Instant now = dongHo.instant();
        //duyệt qua danh sách nhà cung cấp đã kiểm tra
        for (NhaCungCap nhaCungCap : danhSachNhaCungCap) {
            //tạo đơn báo giá cho từng nhà cung cấp
            DonMuaHang donMuaHang = DonMuaHang.builder()
                    .yeuCauMuaHang(yeuCauMuaHang)
                    .soDonMua(calcService.getRandomProductCode("PO"))
                    .nhaCungCap(nhaCungCap)
                    .khoNhap(yeuCauMuaHang.getKhoNhap())
                    .trangThai(TRANG_THAI_CHO_BAO_GIA)
                    .nguoiTao(nguoiDung)
                    .ngayDatHang(now)
                    .ngayGiaoDuKien(yeuCauMuaHang.getNgayGiaoDuKien())
                    .build();

            //lưu đơn mua hàng
            donMuaHang = create(donMuaHang);

            /*
            lấy danh sách sản phẩm từ Yêu cầu gốc sang Đơn mua hàng mới
            lấy thoong tin yêu cầu gốc mà NVK gửi cho QLK duyệt
            số lượng, sản phẩm, kho, ngày giao dự kiến
             */
            List<ChiTietDonMuaHang> chiTietDonMuaHangs = new ArrayList<>();
            for (ChiTietYeuCauMuaHang chiTietYeuCauMuaHang : yeuCauMuaHang.getChiTietYeuCauMuaHangs()) {
                //chuyển đổi từ thông tin của Yêu cầu sang thông tin của Đơn hàng
                ChiTietDonMuaHang chiTietDonMuaHang = fromChiTietYeuCauToChiTietBaoGia(donMuaHang, chiTietYeuCauMuaHang);
                chiTietDonMuaHang = chiTietDonMuaHangService.create(chiTietDonMuaHang);
                chiTietDonMuaHangs.add(chiTietDonMuaHang);
            }

            //truyền chi tiết danh sách đơn mua hàng vào đơn mua hàng
            donMuaHang.setChiTietDonMuaHangs(chiTietDonMuaHangs);
            // E4: dựng dữ liệu ngay (đơn và dòng đã có id), gửi sau commit; gửi được thì ghi ngay_gui_yeu_cau.
            // Nhà cung cấp này lỗi không ảnh hưởng nhà cung cấp khác; rollback thì không ai nhận email.
            emailNghiepVuService.guiYeuCauBaoGia(donMuaHang);
        }
        // Giữ NGUYÊN mã yêu cầu (PR...) — không ghi đè bằng mã RFQ ngẫu nhiên
        // nữa; yêu cầu cũ chưa có mã thì bổ sung mã PR. Cập nhật trạng thái
        // một lần sau khi đã tạo đơn cho mọi nhà cung cấp.
        yeuCauMuaHangService.damBaoCoMa(yeuCauMuaHang);
        //trạng thái đã gửi báo giá
        yeuCauMuaHang.setTrangThai(YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA);
        yeuCauMuaHangService.update(yeuCauMuaHang.getId(), yeuCauMuaHang);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    /**
     * K11 · "Email yêu cầu báo giá chưa gửi được" của một đơn: đơn ở 2, chưa có báo giá, chưa ghi nhận gửi được
     * (ngay_gui_yeu_cau trống), yêu cầu ở 3, đơn đã tạo quá {@link #GUI_LAI_E4_SAU_PHUT} phút (lần gửi đầu có thể còn
     * trong hàng đợi). Nguồn chung cho cờ DonMuaHangDto.chuaGuiDuocYeuCau và điều kiện của API gửi lại.
     * Không kiểm "đã có đơn khác được chọn": việc đó cần đọc các đơn cùng yêu cầu (API gửi lại tự kiểm).
     */
    public static boolean chuaGuiDuocYeuCau(DonMuaHang don, Integer trangThaiYeuCau, Instant now) {
        if (don == null || now == null) return false;
        if (!Objects.equals(don.getTrangThai(), TRANG_THAI_CHO_BAO_GIA)) return false;
        if (don.getNgayBaoGia() != null || don.getNgayGuiYeuCau() != null) return false;
        if (!Objects.equals(trangThaiYeuCau, YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA)) return false;
        Instant taoLuc = don.getNgayTao() != null ? don.getNgayTao() : don.getNgayDatHang();
        return taoLuc == null || !now.isBefore(taoLuc.plus(GUI_LAI_E4_SAU_PHUT, ChronoUnit.MINUTES));
    }

    /**
     * K1 · Đơn tự đóng vì đã chấp nhận báo giá khác cùng yêu cầu: đơn ở 4, không có người duyệt (từ chối thật luôn
     * ghi người duyệt) và yêu cầu đã chọn nhà cung cấp. Cờ DonMuaHangDto.khongDuocChon.
     */
    public static boolean khongDuocChon(DonMuaHang don, Integer trangThaiYeuCau) {
        return don != null
                && Objects.equals(don.getTrangThai(), TRANG_THAI_KHONG_CHAP_NHAN)
                && don.getNguoiDuyet() == null
                && Objects.equals(trangThaiYeuCau, YeuCauMuaHangService.TRANG_THAI_DA_CHON_NCC);
    }

    private static LoiCoMaException khongGuiLaiDuoc(String message) {
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.KHONG_GUI_LAI_DUOC, message);
    }

    /**
     * K11: gửi lại email Yêu cầu báo giá (đúng mã đơn cũ) khi lần đầu không gửi được. Khóa yêu cầu rồi các đơn cùng
     * yêu cầu (cùng thứ tự với xét báo giá).
     * - 409 THIEU_THONG_TIN_CUA_HANG: thiếu tên đăng ký kinh doanh / địa chỉ đăng ký (kiểm trước khi khóa).
     * - 409 YEU_CAU_KHONG_CON_MO: đơn không thuộc yêu cầu nào / yêu cầu không còn, yêu cầu khác 3, đã có đơn được chọn.
     * - 409 KHONG_GUI_LAI_DUOC: đơn đã có kết quả / đã có báo giá / email đã gửi được / đơn vừa tạo / nhà cung cấp
     *   không có email / bấm lại trong {@link #GUI_LAI_E4_CHAN_LAP_GIAY} giây.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public GuiLaiYeuCauDto guiLaiYeuCauBaoGia(Integer id) {
        thongTinCuaHangMuaHang.kiemDuDeGuiNhaCungCap();
        if (id == null) throw new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON);
        int yeuCauId = donMuaHangRepository.layIdYeuCau(id).orElseThrow(
                () -> new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON));
        YeuCauMuaHang yeuCau = yeuCauId == 0 ? null : khoaYeuCau(yeuCauId);
        if (yeuCau == null) {
            throw yeuCauKhongConMo();
        }
        List<DonMuaHang> cacDon = khoaCacDonCuaYeuCau(yeuCauId);
        DonMuaHang don = cacDon.stream().filter(d -> id.equals(d.getId())).findFirst().orElseThrow(
                () -> new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON));

        if (!Objects.equals(don.getTrangThai(), TRANG_THAI_CHO_BAO_GIA)) {
            throw khongGuiLaiDuoc("Đơn này đã có kết quả nên không cần gửi lại email yêu cầu báo giá. Tải lại trang.");
        }
        if (!yeuCauConMo(yeuCau, cacDon)) {
            throw yeuCauKhongConMo();
        }
        if (don.getNgayBaoGia() != null) {
            throw khongGuiLaiDuoc("Nhà cung cấp đã gửi báo giá nên không cần gửi lại email yêu cầu báo giá. Tải lại trang.");
        }
        if (don.getNgayGuiYeuCau() != null) {
            throw khongGuiLaiDuoc("Email yêu cầu báo giá đã gửi được tới nhà cung cấp. Tải lại trang.");
        }
        Instant now = dongHo.instant();
        if (!chuaGuiDuocYeuCau(don, yeuCau.getTrangThai(), now)) {
            // Còn lại đúng một lý do: đơn vừa tạo, email lần đầu có thể còn trong hàng đợi
            throw khongGuiLaiDuoc("Email yêu cầu báo giá đang được gửi. Vui lòng chờ vài phút rồi tải lại trang.");
        }
        if (don.getNhaCungCap() == null || blankToNull(don.getNhaCungCap().getEmail()) == null) {
            throw khongGuiLaiDuoc("Nhà cung cấp chưa có email nên không gửi được yêu cầu báo giá. Cập nhật email nhà cung cấp trước.");
        }

        boolean[] duocGui = {false};
        Instant lanTruoc = GlobalCache.GUI_LAI_YEU_CAU.compute(id, (k, truoc) -> {
            if (truoc != null && now.isBefore(truoc.plusSeconds(GUI_LAI_E4_CHAN_LAP_GIAY))) return truoc;
            duocGui[0] = true;
            return now;
        });
        if (!duocGui[0]) {
            int cho = Math.max(1, giayConLai(now, lanTruoc.plusSeconds(GUI_LAI_E4_CHAN_LAP_GIAY)));
            throw khongGuiLaiDuoc("Email yêu cầu báo giá vừa được gửi lại. Vui lòng thử lại sau " + cho + " giây.");
        }

        // E4 đọc dòng của đơn: don là entity đã nạp lại sau khi khóa, danh sách dòng nạp từ CSDL (@OrderBy id)
        emailNghiepVuService.guiYeuCauBaoGia(don);
        return GuiLaiYeuCauDto.builder().daDuaVaoHangDoi(true).build();
    }

    //hàm hỗ trợ chi tiết yêu cầu đến chi tiết báo giá
    private ChiTietDonMuaHang fromChiTietYeuCauToChiTietBaoGia(DonMuaHang donMuaHang,ChiTietYeuCauMuaHang chiTietYeuCauMuaHang){
        return ChiTietDonMuaHang.builder()
                .bienTheSanPham(chiTietYeuCauMuaHang.getBienTheSanPham())
                .donMuaHang(donMuaHang)
                .donGia(BigDecimal.ZERO)
                .soLuongDat(chiTietYeuCauMuaHang.getSoLuongDat())
                .soLuongDaNhan(BigDecimal.ZERO )
                .thanhTien(BigDecimal.ZERO)
                .build();
    }
}
