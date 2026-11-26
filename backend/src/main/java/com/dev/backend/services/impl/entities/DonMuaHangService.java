package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.GlobalCache;
import com.dev.backend.constant.enums.FilterOperation;
import org.springframework.data.domain.Page;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.INguonNhatKy;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.ApplicationRequestObj;
import com.dev.backend.dto.request.*;
import com.dev.backend.dto.response.GuiLaiYeuCauDto;
import com.dev.backend.dto.response.entities.ChiTietDonMuaHangDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.congncc.BaoGiaDaNhanDto;
import com.dev.backend.dto.response.congncc.DonMuaHangCongNccDto;
import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.mapper.DonMuaHangCongNccMapper;
import com.dev.backend.mapper.DonMuaHangMapper;
import com.dev.backend.repository.ChiTietDonMuaHangRepository;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.services.CalcService;
import com.dev.backend.services.email.EmailNghiepVuService;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.i18n.ThongDiep;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.LockModeType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import com.dev.backend.services.BienBanTraHangService;
import java.util.*;

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
    /**
     * Đã đóng (nhận thiếu): đơn đang vận chuyển đã nhận ít nhất một đợt, nhà cung cấp không giao tiếp phần còn lại.
     * Phần chưa nhận không còn tính là "đang về" (các truy vấn đang về chỉ lấy 3, 5).
     */
    public static final int TRANG_THAI_DA_DONG = 6;
    /** Đã hủy: đơn đang vận chuyển chưa nhận đợt nào, nhà cung cấp không giao. Không còn tính là "đang về". */
    public static final int TRANG_THAI_DA_HUY = 7;
    /**
     * Hết hạn: tới hạn báo giá (HanBaoGia) mà nhà cung cấp chưa báo giá. Lượt xét hạn mỗi giờ ghi trạng thái này; từ 0:00
     * ngày sau hạn tới lúc đó các màn đã hiện Hết hạn theo cờ quaHanBaoGia, cổng đã chặn gửi.
     */
    public static final int TRANG_THAI_HET_HAN = 8;
    /** Lý do đóng / hủy đơn (bắt buộc), nối vào ghi chú đơn. FE chi tiết đơn mua giữ cùng giá trị. */
    public static final int LY_DO_KET_THUC_TOI_DA = 255;

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

    private static final ThongDiep LOI_DON_KHONG_CON_NHAN = ThongDiep.of("sanPhamMuaHang.donMuaKhongConNhanBaoGia");
    private static final ThongDiep LOI_PHIEN_HET_HAN = ThongDiep.of("sanPhamMuaHang.congPhienHetHan");
    private static final ThongDiep LOI_DON_DA_CO_KET_QUA = ThongDiep.of("sanPhamMuaHang.donMuaDaCoKetQua");
    private static final ThongDiep LOI_CHUA_CO_BAO_GIA = ThongDiep.of("sanPhamMuaHang.donMuaChuaCoBaoGia");
    private static final ThongDiep LOI_BAO_GIA_DA_DOI = ThongDiep.of("sanPhamMuaHang.donMuaBaoGiaDaDoi");
    private static final ThongDiep LOI_YEU_CAU_KHONG_CON_MO = ThongDiep.of("sanPhamMuaHang.donMuaYeuCauKhongConMo");
    private static final ThongDiep LOI_KHONG_TIM_THAY_DON = ThongDiep.of("sanPhamMuaHang.donMuaKhongTimThay");

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
    @Autowired(required = false)
    private ThongBaoMuaHangService thongBaoMuaHangService;
    /** Đóng đơn chuyển hàng lỗi chưa xong sang trừ tiền; @Lazy tránh vòng bean, null khi unit test dựng tay. */
    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private com.dev.backend.services.BienBanTraHangService bienBanTraHangService;
    /** Đơn đã nhận đợt nào chưa tính theo phiếu nhập hoàn tất; null khi unit test dựng tay (dùng tổng đã nhận như cũ). */
    @Autowired(required = false)
    private PhieuNhapKhoRepository phieuNhapKhoRepository;

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
    @Autowired
    private ChiTietDonMuaHangRepository chiTietDonMuaHangRepository;
    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;
    @Autowired
    private LichSuThayDoiRepository lichSuThayDoiRepository;
    /** Hạn báo giá; null khi unit test dựng tay (không chốt hạn, không chặn theo hạn). */
    @Autowired(required = false)
    private HanBaoGia hanBaoGia;

    /**
     * Phạm vi xem đơn mua: quản trị viên và nhân viên mua hàng xem mọi đơn (mua hàng là việc chung của công ty); quản lý
     * kho, nhân viên kho chỉ xem đơn có kho nhập thuộc kho mình được phân quyền. Gọi nội bộ (không có người) thì cho qua.
     */
    public static boolean trongPhamVi(DonMuaHang don, NguoiDungAuthInfo user) {
        if (user == null) return true;
        Set<String> vaiTro = user.getVaiTro() == null ? Set.of() : user.getVaiTro();
        if (vaiTro.contains(IRoleType.quan_tri_vien) || vaiTro.contains(IRoleType.nhan_vien_mua_hang)) return true;
        if (vaiTro.contains(IRoleType.quan_ly_kho) || vaiTro.contains(IRoleType.nhan_vien_kho)) {
            Integer khoNhapId = don.getKhoNhap() == null ? null : don.getKhoNhap().getId();
            return khoNhapId != null && khoCuaNguoiDung(user).contains(khoNhapId);
        }
        return false;
    }

    /** Điều kiện thêm vào bộ lọc danh sách theo {@link #trongPhamVi}; rỗng = không giới hạn. */
    static List<FilterCriteria> dieuKienPhamVi(NguoiDungAuthInfo user) {
        if (user == null) return List.of();
        Set<String> vaiTro = user.getVaiTro() == null ? Set.of() : user.getVaiTro();
        if (vaiTro.contains(IRoleType.quan_tri_vien) || vaiTro.contains(IRoleType.nhan_vien_mua_hang)) return List.of();
        List<Integer> khoIds = (vaiTro.contains(IRoleType.quan_ly_kho) || vaiTro.contains(IRoleType.nhan_vien_kho))
                ? khoCuaNguoiDung(user) : List.of();
        if (khoIds.isEmpty()) {
            // Chưa được gán kho nào (hoặc vai trò khác): không thấy đơn nào
            return List.of(FilterCriteria.builder().fieldName("id").operation(FilterOperation.EQUALS).value(-1).build());
        }
        return List.of(FilterCriteria.builder().fieldName("khoNhap.id").operation(FilterOperation.IN).value(khoIds).build());
    }

    private static List<Integer> khoCuaNguoiDung(NguoiDungAuthInfo user) {
        if (user.getPhanQuyenNguoiDungKhos() == null) return List.of();
        return user.getPhanQuyenNguoiDungKhos().stream()
                .filter(pq -> pq != null && pq.getKho() != null && pq.getKho().getId() != null)
                .map(pq -> pq.getKho().getId())
                .distinct()
                .toList();
    }

    /**
     * Đơn mua đi kèm yêu cầu nhập hàng (API yêu cầu nhập hàng trả cả danh sách đơn mua):
     * - quản trị viên, nhân viên mua hàng: giữ nguyên;
     * - quản lý kho, nhân viên kho: chỉ các đơn có kho nhập thuộc kho mình — cùng luật {@link #trongPhamVi}, để API này
     *   không thành đường vòng xem đơn mua của kho khác;
     * - vai trò khác (nhân viên bán hàng — API đơn mua trả 403): vẫn thấy đơn nào thuộc yêu cầu (mã, nhà cung cấp, trạng
     *   thái, số lượng) nhưng không thấy giá mua, xem {@link #anGiaMua}.
     */
    public static void locDonMuaTheoPhamVi(com.dev.backend.dto.response.entities.YeuCauMuaHangDto dto,
                                           NguoiDungAuthInfo user) {
        if (dto == null || user == null) return;
        Set<String> vaiTro = user.getVaiTro() == null ? Set.of() : user.getVaiTro();
        if (vaiTro.contains(IRoleType.quan_tri_vien) || vaiTro.contains(IRoleType.nhan_vien_mua_hang)) return;
        if (vaiTro.contains(IRoleType.quan_ly_kho) || vaiTro.contains(IRoleType.nhan_vien_kho)) {
            if (dto.getDonMuaHangs() == null) return;
            List<Integer> khoIds = khoCuaNguoiDung(user);
            dto.setDonMuaHangs(dto.getDonMuaHangs().stream()
                    .filter(d -> d != null && d.getKhoNhap() != null && khoIds.contains(d.getKhoNhap().getId()))
                    .toList());
            return;
        }
        anGiaMua(dto);
    }

    /**
     * Bỏ giá mua khỏi yêu cầu nhập hàng cho người không xem được đơn mua: đơn giá, thành tiền, tổng tiền, phần báo giá
     * của nhà cung cấp (ghi chú kèm báo giá, lý do không chấp nhận) và giá vốn của mã hàng (cùng luật XemGiaVon).
     */
    static void anGiaMua(com.dev.backend.dto.response.entities.YeuCauMuaHangDto dto) {
        if (dto.getChiTietYeuCauMuaHangs() != null) {
            dto.getChiTietYeuCauMuaHangs().forEach(ct -> anGiaVon(ct == null ? null : ct.getBienTheSanPham()));
        }
        if (dto.getDonMuaHangs() == null) return;
        for (DonMuaHangDto don : dto.getDonMuaHangs()) {
            if (don == null) continue;
            don.setTongTien(null);
            don.setGhiChuNhaCungCap(null);
            don.setLyDoTuChoi(null);
            if (don.getChiTietDonMuaHangs() == null) continue;
            don.getChiTietDonMuaHangs().forEach(ct -> {
                if (ct == null) return;
                ct.setDonGia(null);
                ct.setThanhTien(null);
                anGiaVon(ct.getBienTheSanPham());
            });
        }
    }

    private static void anGiaVon(com.dev.backend.dto.response.entities.BienTheSanPhamDto bienThe) {
        if (bienThe != null) bienThe.setGiaVon(null);
    }

    /** Thao tác ghi trên đơn mua / yêu cầu của một kho nhập: ngoài phạm vi xem thì cũng không được thao tác (403). */
    static void kiemTraPhamViKhoNhap(Kho khoNhap) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        DonMuaHang tam = new DonMuaHang();
        tam.setKhoNhap(khoNhap);
        if (!trongPhamVi(tam, user)) {
            throw new CommonException(HttpStatus.FORBIDDEN, LOI_NGOAI_PHAM_VI);
        }
    }

    static final ThongDiep LOI_NGOAI_PHAM_VI = ThongDiep.of("sanPhamMuaHang.donMuaNgoaiPhamVi");

    /** Xem chi tiết đơn mua: 404 nếu không có, 403 nếu ngoài phạm vi kho của người xem. */
    @Transactional(readOnly = true)
    public DonMuaHang layDuocXem(Integer id) {
        DonMuaHang don = id == null ? null : donMuaHangRepository.findById(id).orElse(null);
        if (don == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON);
        }
        if (!trongPhamVi(don, SecurityContextHolder.getUser())) {
            // Câu chung, không kèm số đơn: dò id không biết được đơn của kho khác
            throw new CommonException(HttpStatus.FORBIDDEN, LOI_NGOAI_PHAM_VI);
        }
        return don;
    }

    /** Danh sách đơn mua: thêm điều kiện phạm vi kho theo vai trò (không sửa danh sách bộ lọc của bên gọi). */
    @Override
    @Transactional(readOnly = true)
    public Page<DonMuaHang> filter(BaseFilterRequest request) {
        List<FilterCriteria> phamVi = dieuKienPhamVi(SecurityContextHolder.getUser());
        if (phamVi.isEmpty()) return super.filter(request);
        List<FilterCriteria> boLoc = request.getFilters() == null ? new ArrayList<>() : new ArrayList<>(request.getFilters());
        boLoc.addAll(phamVi);
        request.setFilters(boLoc);
        return super.filter(request);
    }

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

    @Transactional
    public ResponseEntity<ResponseData<DonMuaHangDto>> create(DonMuaHangCreating creating) {


        Kho khoNhap = khoService.getOne(SecurityContextHolder.getKhoId()).orElseThrow(
                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.khoKhongTimThay", SecurityContextHolder.getKhoId()))
        );
        KhoService.kiemTraKhoNhapNcc(khoNhap);


        NguoiDungAuthInfo authInfo = SecurityContextHolder.getUser();

        NguoiDung nguoiTao = nguoiDungService.getOne(authInfo.getId()).orElseThrow(
                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.nguoiDungKhongTimThayCach", authInfo.getId()))
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
                    () -> new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheKhongTimThay", ctdmhCreating.getBienTheSanPhamId()))
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
                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.donMuaKhongTimThayNgayDat", creating.getNgayDatHang()))
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
    // Cổng nhà cung cấp: xem đơn, gửi báo giá. Đăng nhập (mã qua email, phiên) ở CongNhaCungCapService; ở đây chỉ nhận
    // email đã xác thực của phiên và các nhà cung cấp của email đó.
    // =====================================================================================================

    /** Email so không phân biệt hoa thường, bỏ khoảng trắng hai đầu. null/trống -> null. */
    public static String chuanHoaEmail(String email) {
        if (email == null || email.isBlank()) return null;
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean emailKhop(DonMuaHang don, String emailDaChuanHoa) {
        if (emailDaChuanHoa == null || don.getNhaCungCap() == null) return false;
        return emailDaChuanHoa.equals(chuanHoaEmail(don.getNhaCungCap().getEmail()));
    }

    private static LoiCoMaException donKhongConNhan() {
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.DON_KHONG_CON_NHAN, LOI_DON_KHONG_CON_NHAN);
    }

    private static LoiCoMaException phienHetHan() {
        return new LoiCoMaException(HttpStatus.FORBIDDEN, MaLoi.PHIEN_HET_HAN, LOI_PHIEN_HET_HAN);
    }

    private static LoiCoMaException khongTimThayDon() {
        return new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.KHONG_TIM_THAY, ThongDiep.of("sanPhamMuaHang.congDonKhongTimThay"));
    }

    /** Số giây (làm tròn lên, không âm) từ {@code tu} tới {@code den}. Dùng chung với cổng nhà cung cấp. */
    public static int giayConLai(Instant tu, Instant den) {
        long ms = Duration.between(tu, den).toMillis();
        if (ms <= 0) return 0;
        return (int) Math.min(Integer.MAX_VALUE, (ms + 999) / 1000);
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

    /**
     * Đơn mua cho cổng: phải thuộc một trong các nhà cung cấp của phiên và đã được gửi yêu cầu báo giá (từ trạng thái 2);
     * không thì 404 KHONG_TIM_THAY (không lộ đơn nào tồn tại). Đơn hết nhận báo giá vẫn xem được (cổng chỉ hiện).
     */
    @Transactional(readOnly = true)
    public DonMuaHangCongNccDto layDonChoCong(Integer donMuaHangId, Collection<Integer> nhaCungCapIds) {
        DonMuaHang don = donMuaHangId == null ? null : donMuaHangRepository.findById(donMuaHangId).orElse(null);
        if (don == null || don.getNhaCungCap() == null || !nhaCungCapIds.contains(don.getNhaCungCap().getId())
                || don.getTrangThai() == null || don.getTrangThai() < TRANG_THAI_CHO_BAO_GIA) {
            throw khongTimThayDon();
        }
        return DonMuaHangCongNccMapper.toDto(don);
    }


    private static LoiCoMaException baoGiaSai(ThongDiep message, Integer dong) {
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
     * Nhà cung cấp gửi (hoặc gửi lại) báo giá đơn {@code donId} trên cổng ({@code emailPhien}: email đã xác thực của phiên
     * cổng, đã chuẩn hóa). Khóa yêu cầu rồi mới khóa đơn (cùng thứ tự với xét báo giá), kiểm lại đơn còn nhận báo giá và
     * email nhà cung cấp của đơn vẫn là email phiên, kiểm dữ liệu, ghép đơn giá theo id dòng. Ghi tổng tiền tự tính, ghi
     * chú, ngayBaoGia; trạng thái giữ 2. M3 dựng trong transaction, gửi sau commit.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BaoGiaDaNhanDto baoGiaTuCong(Integer donId, String emailPhien, DonMuaHangBaoGia baoGia) {
        Instant now = dongHo.instant();
        if (baoGia == null || donId == null || (baoGia.getId() != null && !Objects.equals(baoGia.getId(), donId))) {
            throw khongTimThayDon();
        }

        // R13: đơn không thuộc yêu cầu nào (cột NULL) hoặc trỏ tới yêu cầu không còn: 409, không khóa đơn
        int yeuCauId = donMuaHangRepository.layIdYeuCau(donId).orElseThrow(DonMuaHangService::donKhongConNhan);
        if (yeuCauId == 0) throw donKhongConNhan();
        YeuCauMuaHang yeuCau = khoaYeuCau(yeuCauId);
        if (yeuCau == null) throw donKhongConNhan();
        DonMuaHang don = khoaDon(donId);
        if (don == null) throw donKhongConNhan();
        kiemDonConNhanBaoGia(don, yeuCau);
        if (!emailKhop(don, emailPhien)) {
            // Email nhà cung cấp của đơn vừa đổi: phiên mở bằng email cũ không còn dùng được
            throw phienHetHan();
        }
        // Qua hạn báo giá (từ 0:00 ngày sau hạn) thì không nhận báo giá mới, kể cả sửa báo giá đã gửi: mọi nhà cung cấp
        // cạnh tranh cùng một mốc. Lượt xét hạn 8:00 mới đổi trạng thái, nên kiểm theo giờ ở đây.
        kiemConHanBaoGia(don, now);

        String ghiChu = baoGia.getGhiChu() == null || baoGia.getGhiChu().isBlank() ? null : baoGia.getGhiChu().trim();
        if (ghiChu != null && ghiChu.length() > GHI_CHU_NCC_TOI_DA) {
            throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaGhiChuQuaDai"), null);
        }

        List<ChiTietDonMuaHang> cacDong = new ArrayList<>(
                don.getChiTietDonMuaHangs() == null ? List.of() : don.getChiTietDonMuaHangs());
        cacDong.sort(Comparator.comparing(ChiTietDonMuaHang::getId));
        if (cacDong.isEmpty()) {
            throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaDonChuaCoSanPham"), null);
        }
        List<ChiTietDonMuaHangBaoGia> gui = baoGia.getChiTietDonMuaHangBaoGias();
        if (gui == null || gui.isEmpty()) {
            throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaChuaCoDong"), null);
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
                throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaDongThieuMa"), null);
            }
            ChiTietDonMuaHang ct = dongTheoId.get(idDong);
            if (ct == null) {
                throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaDongKhongThuocDon", don.getSoDonMua()), idDong);
            }
            String nhan = nhanDong(sttTheoId.get(idDong), ct);
            if (giaTheoId.containsKey(idDong)) {
                throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaDongGuiHaiLan", nhan), idDong);
            }
            BigDecimal donGia = muc.getDonGia();
            if (donGia == null) {
                throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaDongChuaCoDonGia", nhan), idDong);
            }
            if (donGia.signum() <= 0) {
                throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaDonGiaLonHon0", nhan), idDong);
            }
            if (donGia.stripTrailingZeros().scale() > 0) {
                throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaDonGiaSoNguyen", nhan), idDong);
            }
            if (donGia.compareTo(DON_GIA_TOI_DA) > 0) {
                throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaDonGiaQuaLon", nhan), idDong);
            }
            giaTheoId.put(idDong, donGia.setScale(2, RoundingMode.UNNECESSARY));
        }
        for (ChiTietDonMuaHang ct : cacDong) {
            if (!giaTheoId.containsKey(ct.getId())) {
                throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaDongChuaCoDonGia", nhanDong(sttTheoId.get(ct.getId()), ct)), ct.getId());
            }
        }

        // Thành tiền tự tính (không đọc thanhTien: cột tự sinh, entity giữ giá trị cũ sau khi cập nhật)
        BigDecimal tongTien = BigDecimal.ZERO;
        for (ChiTietDonMuaHang ct : cacDong) {
            BigDecimal soLuong = ct.getSoLuongDat() == null ? BigDecimal.ZERO : ct.getSoLuongDat();
            BigDecimal thanhTien = soLuong.multiply(giaTheoId.get(ct.getId())).setScale(2, RoundingMode.HALF_UP);
            if (thanhTien.compareTo(TIEN_TOI_DA) > 0) {
                throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaThanhTienQuaLon", nhanDong(sttTheoId.get(ct.getId()), ct)), ct.getId());
            }
            tongTien = tongTien.add(thanhTien);
        }
        if (tongTien.compareTo(TIEN_TOI_DA) > 0) {
            throw baoGiaSai(ThongDiep.of("sanPhamMuaHang.baoGiaTongTienQuaLon"), null);
        }

        for (ChiTietDonMuaHang ct : cacDong) {
            ct.setDonGia(giaTheoId.get(ct.getId()));
            chiTietDonMuaHangService.update(ct.getId(), ct);
        }
        // Cột TIMESTAMP không giữ phần lẻ của giây (và làm tròn): cắt trước để giờ trong M3, trên màn hình, trong CSDL
        // là một, và phép so ngayBaoGiaDaXem khi xét báo giá khớp đúng.
        Instant ngayBaoGia = ngayBaoGiaMoi(now, don.getNgayBaoGia());
        boolean guiLai = don.getNgayBaoGia() != null;
        don.setTongTien(tongTien.setScale(2, RoundingMode.HALF_UP));
        don.setGhiChuNhaCungCap(ghiChu);
        don.setNgayBaoGia(ngayBaoGia);
        donMuaHangRepository.save(don);

        emailNghiepVuService.guiDaNhanBaoGia(don);
        // Báo người gửi yêu cầu báo giá + người lập yêu cầu có báo giá cần xét (M3 chỉ đi tới nhà cung cấp)
        if (thongBaoMuaHangService != null) thongBaoMuaHangService.baoGiaMoi(don, yeuCau, ngayBaoGia, guiLai);
        // M3 đi tới email nhà cung cấp của đơn (đã khớp email của phiên ở trên)
        String emailXacNhan = don.getNhaCungCap() == null ? null : blankToNull(don.getNhaCungCap().getEmail());

        return BaoGiaDaNhanDto.builder()
                .ngayBaoGia(ngayBaoGia)
                .tongTien(don.getTongTien())
                .daGuiEmailXacNhan(emailXacNhan != null)
                .emailXacNhan(emailXacNhan)
                .build();
    }

    /** 409 DON_KHONG_CON_NHAN kèm câu "đã hết hạn lúc 23:59 ngày …" khi đơn đã qua hạn báo giá. */
    private void kiemConHanBaoGia(DonMuaHang don, Instant now) {
        if (hanBaoGia == null) return;
        HanBaoGia.Han han = hanBaoGia.hanCua(don);
        if (han != null && HanBaoGia.daQuaHan(han.ngay(), now)) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.DON_KHONG_CON_NHAN,
                    ThongDiep.of("sanPhamMuaHang.baoGiaDaHetHan", don.getSoDonMua(), NGAY_VN.format(han.ngay())));
        }
    }

    private static final java.time.format.DateTimeFormatter NGAY_VN = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");

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
     * nhận (3, rồi 5 / 6 / 7). Kiểm cả hai vì CSDL chưa chạy migration có thể còn yêu cầu ở 3 đã có đơn được chọn.
     */
    static boolean yeuCauConMo(YeuCauMuaHang yeuCau, List<DonMuaHang> cacDonCuaYeuCau) {
        if (yeuCau == null || !Objects.equals(yeuCau.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA)) {
            return false;
        }
        return cacDonCuaYeuCau.stream().noneMatch(d -> daChot(d.getTrangThai()));
    }

    /** Đơn đã chấp nhận báo giá: đang vận chuyển (3), đã nhận đủ (5), đã đóng nhận thiếu (6) hoặc đã hủy sau khi chốt (7). */
    static boolean daChot(Integer trangThai) {
        return trangThai != null && (trangThai == TRANG_THAI_DA_CHAP_NHAN || trangThai == TRANG_THAI_DA_NHAN_DU
                || trangThai == TRANG_THAI_DA_DONG || trangThai == TRANG_THAI_DA_HUY);
    }

    private NguoiDung nguoiDangThaoTac() {
        NguoiDungAuthInfo authInfo = SecurityContextHolder.getUser();
        if (authInfo == null || authInfo.getId() == null) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.phaiDangNhap"), HttpStatus.UNAUTHORIZED, null);
        }
        return nguoiDungService.getOne(authInfo.getId()).orElseThrow(
                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.nguoiDungKhongTimThay", authInfo.getId()))
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
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.xetBaoGiaKetQuaKhongHopLe"));
        }
        String lyDoChuan = lyDo == null || lyDo.isBlank() ? null : lyDo.trim();
        if (lyDoChuan != null && lyDoChuan.length() > LY_DO_TU_CHOI_TOI_DA) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.xetBaoGiaLyDoQuaDai", LY_DO_TU_CHOI_TOI_DA));
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
        // Ngoài phạm vi kho nhập (không xem được đơn) thì cũng không thao tác được
        kiemTraPhamViKhoNhap(don.getKhoNhap());

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
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.xetBaoGiaTaiLaiTrang"));
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
            // Báo kho nhập chuẩn bị nhận hàng; thông báo "đã gửi báo giá" của các đơn cùng yêu cầu coi như xong
            if (thongBaoMuaHangService != null) thongBaoMuaHangService.daXetBaoGia(don, conLai, true, nguoiChot);
        } else {
            don.setTrangThai(TRANG_THAI_KHONG_CHAP_NHAN);
            don.setLyDoTuChoi(lyDoChuan);
            don.setNguoiDuyet(nguoiChot);
            donMuaHangRepository.save(don);
            emailNghiepVuService.guiKetQuaBaoGia(don);
            if (thongBaoMuaHangService != null) thongBaoMuaHangService.daXetBaoGia(don, List.of(), false, nguoiChot);
            // Báo giá cuối cùng còn chờ: yêu cầu về Đã duyệt để gửi nhà cung cấp khác
            moLaiYeuCauNeuHetDonCho(yeuCau, cacDon, nguoiChot, dongHo.instant(), LY_DO_MO_LAI_KHONG_CHAP_NHAN);
        }
    }

    // =====================================================================================================
    // Hạn báo giá: nhắc trước hạn, hết hạn, yêu cầu về Đã duyệt khi mọi đơn đã kết thúc
    // =====================================================================================================

    /** Lý do ghi lịch sử khi yêu cầu về Đã duyệt (dữ liệu, giữ tiếng Việt). */
    // i18n-giu-nguyen: ghi vào lich_su_thay_doi, không hiện nguyên văn ra giao diện
    static final String LY_DO_MO_LAI_KHONG_CHAP_NHAN = "Không còn báo giá nào chờ xét, chưa chọn nhà cung cấp";
    // i18n-giu-nguyen: ghi vào lich_su_thay_doi
    static final String LY_DO_MO_LAI_HET_HAN = "Các yêu cầu báo giá còn lại đã hết hạn, chưa chọn nhà cung cấp";
    // i18n-giu-nguyen: ghi vào lich_su_thay_doi (lý do đơn hết hạn)
    static final String LY_DO_HET_HAN_CHUA_GUI_EMAIL = "Email yêu cầu báo giá chưa tới nhà cung cấp";
    // i18n-giu-nguyen: ghi vào lich_su_thay_doi (đơn gửi trước khi có hạn, hết hạn không gửi email)
    static final String LY_DO_HET_HAN_DON_CU = "Đơn gửi trước khi có hạn báo giá";

    /** Kết quả xét hạn một đơn (lượt chạy mỗi giờ ghi log, test kiểm). */
    public enum KetQuaXetHan { KHONG_DOI, DA_NHAC, HET_HAN }

    /**
     * Yêu cầu về Đã duyệt khi không còn đơn nào chờ báo giá hay chờ xét (không đơn nào ở 2) và chưa chọn nhà cung cấp
     * (không đơn nào đã chốt). Yêu cầu và các đơn phải đang được khóa bởi nơi gọi. Ghi lịch sử của yêu cầu. Trả true nếu
     * đã đổi.
     */
    boolean moLaiYeuCauNeuHetDonCho(YeuCauMuaHang yeuCau, List<DonMuaHang> cacDon, NguoiDung nguoi, Instant luc,
                                    String lyDo) {
        if (yeuCau == null || !Objects.equals(yeuCau.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA)) {
            return false;
        }
        boolean conCho = cacDon.stream().anyMatch(d -> Objects.equals(d.getTrangThai(), TRANG_THAI_CHO_BAO_GIA));
        boolean daChon = cacDon.stream().anyMatch(d -> daChot(d.getTrangThai()));
        if (conCho || daChon || cacDon.isEmpty()) return false;
        yeuCau.setTrangThai(YeuCauMuaHangService.TRANG_THAI_DA_DUYET);
        yeuCauMuaHangService.create(yeuCau);
        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(YeuCauMuaHangService.LOAI_THAM_CHIEU)
                .idThamChieu(yeuCau.getId())
                .maDoiTuong(yeuCau.getSoYeuCauMuaHang())
                .kho(yeuCau.getKhoNhap())
                .hanhDong(IHanhDong.mo_lai_yeu_cau_mua_hang)
                .giaTriCu(String.valueOf(YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA))
                .giaTriMoi(String.valueOf(YeuCauMuaHangService.TRANG_THAI_DA_DUYET))
                .nguoiThucHien(nguoi)
                .nguon(nguoi == null ? INguonNhatKy.he_thong : INguonNhatKy.nguoi_dung)
                .ngayThucHien(luc)
                .ghiChu(lyDo)
                .build());
        return true;
    }

    /**
     * Xét hạn một đơn còn chờ báo giá (lượt chạy mỗi giờ, mỗi đơn một giao dịch). Khóa yêu cầu rồi các đơn (cùng thứ tự
     * với xét báo giá, nhà cung cấp gửi báo giá), kiểm lại đơn vẫn ở 2, chưa báo giá, yêu cầu còn mở.
     * - Chưa tới hạn: tới mốc nhắc (8:00 ngày trước hạn), chưa nhắc và lúc gửi trước mốc nhắc thì gửi email nhắc, ghi
     *   đã nhắc (đơn gửi trước khi có hạn cũng được nhắc: thư nhắc là lần đầu nhà cung cấp biết hạn).
     * - Qua hạn: đơn sang Hết hạn (8), ghi lịch sử (lý do: email chưa tới / đơn cũ). Nhà cung cấp đã biết hạn (hạn đã chốt
     *   trong E4, hoặc đã nhận thư nhắc) thì gửi email hết hạn và thông báo người gửi yêu cầu; đơn cũ chưa từng được báo
     *   hạn (quá hạn ngay lúc triển khai) thì im lặng. Không còn đơn chờ thì yêu cầu về Đã duyệt.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public KetQuaXetHan xetHanBaoGia(Integer donId, Instant now) {
        if (donId == null || hanBaoGia == null) return KetQuaXetHan.KHONG_DOI;
        int yeuCauId = donMuaHangRepository.layIdYeuCau(donId).orElse(0);
        if (yeuCauId == 0) return KetQuaXetHan.KHONG_DOI;
        YeuCauMuaHang yeuCau = khoaYeuCau(yeuCauId);
        if (yeuCau == null) return KetQuaXetHan.KHONG_DOI;
        List<DonMuaHang> cacDon = khoaCacDonCuaYeuCau(yeuCauId);
        DonMuaHang don = cacDon.stream().filter(d -> donId.equals(d.getId())).findFirst().orElse(null);
        if (don == null || !Objects.equals(don.getTrangThai(), TRANG_THAI_CHO_BAO_GIA) || don.getNgayBaoGia() != null
                || !yeuCauConMo(yeuCau, cacDon)) {
            return KetQuaXetHan.KHONG_DOI;
        }
        HanBaoGia.Han han = hanBaoGia.hanCua(don);
        if (han == null) return KetQuaXetHan.KHONG_DOI;

        if (!HanBaoGia.daQuaHan(han.ngay(), now)) {
            Instant nhacLuc = HanBaoGia.nhacLuc(han.ngay());
            Instant guiLuc = HanBaoGia.guiLuc(don);
            if (!now.isBefore(nhacLuc) && guiLuc != null && guiLuc.isBefore(nhacLuc)
                    && !hanBaoGia.daNhac(don.getId())) {
                emailNghiepVuService.guiNhacHanBaoGia(don, han.ngay());
                hanBaoGia.ghiDaNhac(don, han.ngay(), now);
                return KetQuaXetHan.DA_NHAC;
            }
            return KetQuaXetHan.KHONG_DOI;
        }

        boolean emailDaToi = don.getNgayGuiYeuCau() != null;
        // Nhà cung cấp đã biết hạn: hạn in trong E4 (đã chốt) hoặc đã nhận thư nhắc
        boolean daBietHan = han.daChot() || hanBaoGia.daNhac(don.getId());
        don.setTrangThai(TRANG_THAI_HET_HAN);
        donMuaHangRepository.save(don);
        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.don_mua_hang)
                .idThamChieu(don.getId())
                .maDoiTuong(don.getSoDonMua())
                .kho(don.getKhoNhap())
                .hanhDong(IHanhDong.het_han_bao_gia)
                .giaTriCu(String.valueOf(TRANG_THAI_CHO_BAO_GIA))
                .giaTriMoi(String.valueOf(TRANG_THAI_HET_HAN))
                .nguon(INguonNhatKy.he_thong)
                .ngayThucHien(now)
                .ghiChu(!daBietHan ? LY_DO_HET_HAN_DON_CU : emailDaToi ? null : LY_DO_HET_HAN_CHUA_GUI_EMAIL)
                .build());
        // Đơn cũ chưa từng được báo hạn hết hạn im lặng; email chưa từng tới nhà cung cấp thì báo hết hạn cũng vô ích
        if (daBietHan && emailDaToi) {
            emailNghiepVuService.guiHetHanBaoGia(don, han.ngay());
        }
        boolean veDaDuyet = moLaiYeuCauNeuHetDonCho(yeuCau, cacDon, null, now, LY_DO_MO_LAI_HET_HAN);
        if (thongBaoMuaHangService != null && daBietHan) {
            thongBaoMuaHangService.hetHanBaoGia(don, yeuCau, han.ngay(), veDaDuyet);
        }
        return KetQuaXetHan.HET_HAN;
    }

    /** Danh sách đơn còn chờ nhà cung cấp báo giá (lượt xét hạn duyệt lần lượt, mỗi đơn một giao dịch). */
    @Transactional(readOnly = true)
    public List<Integer> idDonChoBaoGia() {
        return donMuaHangRepository.idChoBaoGia();
    }

    /** Điền hạn báo giá vào DTO chi tiết đơn mua. */
    @Transactional(readOnly = true)
    public DonMuaHangDto boSungHanBaoGia(DonMuaHangDto dto) {
        if (dto == null || dto.getId() == null || hanBaoGia == null) return dto;
        donMuaHangRepository.findById(dto.getId())
                .ifPresent(don -> hanBaoGia.boSung(List.of(dto), List.of(don), dongHo.instant()));
        return dto;
    }

    /** Điền hạn báo giá cho một trang danh sách đơn mua (DTO và entity cùng trang). */
    @Transactional(readOnly = true)
    public void boSungHanBaoGia(Collection<DonMuaHangDto> dtos, Collection<DonMuaHang> dons) {
        if (hanBaoGia == null) return;
        hanBaoGia.boSung(dtos, dons, dongHo.instant());
    }

    // =====================================================================================================
    // Kết thúc đơn đã chốt: đóng nhận thiếu (6) / hủy (7)
    // =====================================================================================================

    /** Đóng đơn đang vận chuyển khi nhà cung cấp giao thiếu: chỉ khi đã nhận ít nhất một đợt. Xem {@link #ketThucDon}. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void dongDon(Integer id, String lyDo) {
        ketThucDon(id, lyDo, TRANG_THAI_DA_DONG);
    }

    /** Hủy đơn đang vận chuyển khi nhà cung cấp không giao: chỉ khi chưa nhận đợt nào. Xem {@link #ketThucDon}. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void huyDon(Integer id, String lyDo) {
        ketThucDon(id, lyDo, TRANG_THAI_DA_HUY);
    }

    /**
     * Đơn đang vận chuyển (3) sang Đã đóng (6) hoặc Đã hủy (7). Lý do bắt buộc (≤ {@link #LY_DO_KET_THUC_TOI_DA} ký tự),
     * nối vào ghi chú đơn và ghi lich_su_thay_doi (người, lúc, lý do). Không gửi email cho nhà cung cấp, không đổi người
     * duyệt (người chốt báo giá).
     * - Đọc đơn không khóa trước: không còn ở 3 thì 409 ngay, chưa giữ khóa nào (không xếp hàng sau luồng báo giá — khóa
     *   đơn trước rồi dòng — với đơn đã đổi trạng thái). Còn ở 3 mới khóa các dòng đơn rồi dòng đơn mua (cùng thứ tự với
     *   hoàn tất phiếu nhập kho: dòng trước, đơn sau), kiểm lại trạng thái sau khóa rồi đọc số đã nhận, phiếu nhập nháp:
     *   bấm hai lần chỉ ra một kết quả; phiếu nhập hoàn tất cùng lúc thì một bên chờ bên kia.
     * - 409: đơn không còn ở 3; đóng mà chưa nhận gì / hủy mà đã nhận hàng; còn phiếu nhập nháp của đơn (hủy hoặc hoàn
     *   tất phiếu đó trước). 400: thiếu / quá dài lý do. 404: không có đơn.
     * - Xong thì thông báo "đã chốt, chờ nhận hàng" (M5) của đơn coi như đã xử lý: không còn hàng nào để nhận.
     */
    private void ketThucDon(Integer id, String lyDo, int trangThaiMoi) {
        boolean dong = trangThaiMoi == TRANG_THAI_DA_DONG;
        ThongDiep viec = ThongDiep.of(dong ? "sanPhamMuaHang.viecDongDon" : "sanPhamMuaHang.viecHuyDon");
        String lyDoChuan = lyDo == null ? "" : lyDo.trim();
        if (lyDoChuan.isEmpty()) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.ketThucDonNhapLyDo", viec));
        }
        if (lyDoChuan.length() > LY_DO_KET_THUC_TOI_DA) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.ketThucDonLyDoToiDa", viec, LY_DO_KET_THUC_TOI_DA));
        }
        if (id == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON);
        }
        NguoiDung nguoi = nguoiDangThaoTac();

        // Đọc thường trước khi khóa: đơn không còn ở 3 thì báo ngay, không giữ khóa nào
        DonMuaHang donChuaKhoa = donMuaHangRepository.findById(id).orElse(null);
        if (donChuaKhoa == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON);
        }
        kiemTraPhamViKhoNhap(donChuaKhoa.getKhoNhap());
        chiKhiDangVanChuyen(donChuaKhoa, viec);

        List<ChiTietDonMuaHang> cacDongDon = chiTietDonMuaHangRepository.khoaTheoDonMua(id);
        DonMuaHang don = khoaDon(id);
        if (don == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, LOI_KHONG_TIM_THAY_DON);
        }
        // Kiểm lại sau khóa: phiếu nhập hoàn tất / người khác đóng, hủy đơn trong lúc chờ khóa
        chiKhiDangVanChuyen(don, viec);
        ThongDiep ma = tenDonTrongCau(don);

        // Đã nhận ít nhất một đợt = có phiếu nhập hoàn tất (kể cả đợt toàn hàng lỗi: "đã nhận" chỉ cộng hàng đạt nên có
        // thể bằng 0). Đơn như vậy phải đóng (hàng lỗi chuyển trừ tiền), không được hủy.
        boolean coDotNhan;
        if (phieuNhapKhoRepository != null) {
            coDotNhan = phieuNhapKhoRepository.demPhieuHoanTatCuaDon(id) > 0;
        } else {
            BigDecimal daNhan = donMuaHangRepository.tongDaNhan(id);
            coDotNhan = daNhan != null && daNhan.signum() > 0;
        }
        if (dong && !coDotNhan) {
            throw new CommonException(HttpStatus.CONFLICT,
                    ThongDiep.of("sanPhamMuaHang.ketThucDonChuaNhanDot", ma));
        }
        // Đóng là "nhận thiếu": đơn hết còn thiếu mọi dòng (đặt − đã nhận − trừ tiền = 0) thì không có phần nào để đóng
        // (màn chi tiết cũng ẩn nút này). Hàng lỗi chờ chốt / chờ giao bù vẫn là còn thiếu nên đóng được.
        if (dong && cacDongDon.stream().noneMatch(ct -> ct.conThieu().signum() > 0)) {
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("sanPhamMuaHang.ketThucDonDaNhanDuKhongDong", ma));
        }
        if (!dong && coDotNhan) {
            throw new CommonException(HttpStatus.CONFLICT,
                    ThongDiep.of("sanPhamMuaHang.ketThucDonDaNhanKhongHuy", ma));
        }
        // Phiếu nhập chưa hoàn tất, chưa hủy (nháp; chờ duyệt / đã duyệt của dữ liệu cũ) đang giữ phần còn lại của đơn
        List<String> phieuNhap = donMuaHangRepository.soPhieuNhapTheoTrangThai(id, List.of(
                TrangThaiPhieuNhap.DRAFT.getValue(), TrangThaiPhieuNhap.PENDING.getValue(),
                TrangThaiPhieuNhap.APPROVED.getValue()));
        if (!phieuNhap.isEmpty()) {
            String so = phieuNhap.get(0) == null ? "" : " " + phieuNhap.get(0);
            throw new CommonException(HttpStatus.CONFLICT, ThongDiep.of("sanPhamMuaHang.ketThucDonConPhieuNhap", ma, so, viec));
        }

        // Hàng lỗi chờ chốt / chờ giao bù chuyển sang trừ tiền (tối đa phần còn thiếu của dòng đơn); khóa dòng bù sau dòng
        // đơn và đơn, cùng thứ tự với chốt
        if (dong && bienBanTraHangService != null) {
            bienBanTraHangService.chuyenTruTienKhiDongDon(don, nguoi, lyDoChuan);
        }

        don.setTrangThai(trangThaiMoi);
        String ghiChuCu = don.getGhiChu();
        don.setGhiChu((ghiChuCu != null && !ghiChuCu.isBlank() ? ghiChuCu.trim() + " | " : "")
                + (dong ? "Lý do đóng đơn: " : "Lý do hủy đơn: ") + lyDoChuan);
        donMuaHangRepository.save(don);

        lichSuThayDoiService.create(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.don_mua_hang)
                .idThamChieu(don.getId())
                .maDoiTuong(don.getSoDonMua())
                .kho(don.getKhoNhap())
                .hanhDong(dong ? IHanhDong.dong_don_mua_hang : IHanhDong.huy_don_mua_hang)
                .giaTriCu(String.valueOf(TRANG_THAI_DA_CHAP_NHAN))
                .giaTriMoi(String.valueOf(trangThaiMoi))
                .nguoiThucHien(nguoi)
                .ngayThucHien(dongHo.instant())
                .ghiChu(lyDoChuan)
                .build());

        if (thongBaoMuaHangService != null) thongBaoMuaHangService.donMuaDaKetThuc(don.getId());
    }

    /** 409 khi đơn không còn Đang vận chuyển (3), câu theo trạng thái hiện tại; {@code viec}: "đóng đơn" / "hủy đơn". */
    private static void chiKhiDangVanChuyen(DonMuaHang don, ThongDiep viec) {
        Integer trangThai = don.getTrangThai();
        if (Objects.equals(trangThai, TRANG_THAI_DA_CHAP_NHAN)) return;
        ThongDiep ma = tenDonTrongCau(don);
        ThongDiep cau;
        if (Objects.equals(trangThai, TRANG_THAI_DA_DONG)) cau = ThongDiep.of("sanPhamMuaHang.ketThucDonDaDongTruoc", ma);
        else if (Objects.equals(trangThai, TRANG_THAI_DA_HUY)) cau = ThongDiep.of("sanPhamMuaHang.ketThucDonDaHuyTruoc", ma);
        else if (Objects.equals(trangThai, TRANG_THAI_DA_NHAN_DU)) cau = ThongDiep.of("sanPhamMuaHang.ketThucDonDaNhanDuKhongCan", ma, viec);
        else cau = ThongDiep.of("sanPhamMuaHang.ketThucDonChiKhiVanChuyen", viec);
        throw new CommonException(HttpStatus.CONFLICT, cau);
    }

    /** "Đơn mua PO…" để ghép câu báo; đơn chưa có số thì "Đơn mua này". */
    private static ThongDiep tenDonTrongCau(DonMuaHang don) {
        return don.getSoDonMua() == null || don.getSoDonMua().isBlank()
                ? ThongDiep.of("sanPhamMuaHang.donMuaNay")
                : ThongDiep.of("sanPhamMuaHang.donMuaSo", don.getSoDonMua());
    }

    /**
     * Điền lý do, lúc và người đóng / hủy (lần gần nhất trong lich_su_thay_doi) vào DTO chi tiết của đơn 6, 7. Đơn khác,
     * hoặc đơn đổi trạng thái ngoài ứng dụng (không có dòng lịch sử): giữ null.
     */
    @Transactional(readOnly = true)
    public DonMuaHangDto boSungKetThuc(DonMuaHangDto dto) {
        if (dto == null || dto.getId() == null) return dto;
        boSungTruTien(dto);
        if (!Objects.equals(dto.getTrangThai(), TRANG_THAI_DA_DONG) && !Objects.equals(dto.getTrangThai(), TRANG_THAI_DA_HUY)) {
            return dto;
        }
        lichSuThayDoiRepository
                .findFirstByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                        ITable.don_mua_hang, dto.getId(),
                        List.of(IHanhDong.dong_don_mua_hang, IHanhDong.huy_don_mua_hang))
                .ifPresent(lichSu -> {
                    dto.setLyDoKetThuc(lichSu.getGhiChu());
                    dto.setNgayKetThuc(lichSu.getNgayThucHien());
                    dto.setNguoiKetThuc(lichSu.getNguoiThucHien() == null ? null : lichSu.getNguoiThucHien().getHoTen());
                });
        return dto;
    }

    /**
     * Số hàng lỗi đã chốt trừ tiền của từng dòng (đã nằm trong "đã nhận"): màn chi tiết đơn tách hàng đạt = đã nhận − trừ
     * tiền. Lấy từ nhật ký các biên bản trả hàng của đơn.
     */
    private void boSungTruTien(DonMuaHangDto dto) {
        if (dto.getChiTietDonMuaHangs() == null) return;
        BienBanTraHangService.TraHangTheoDon th = bienBanTraHangService == null
                ? BienBanTraHangService.TraHangTheoDon.TRONG
                : bienBanTraHangService.traHangTheoDon(List.of(dto.getId()))
                        .getOrDefault(dto.getId(), BienBanTraHangService.TraHangTheoDon.TRONG);
        for (ChiTietDonMuaHangDto ct : dto.getChiTietDonMuaHangs()) {
            Integer btId = ct.getBienTheSanPham() == null ? null : ct.getBienTheSanPham().getId();
            ct.setSoLuongTruTien(BigDecimal.valueOf(btId == null ? 0 : th.truTheoBienThe().getOrDefault(btId, 0)));
        }
        tinhPhaiTra(dto, th);
    }

    /**
     * Điền số phải trả cho các đơn của một trang danh sách (đọc biên bản trả hàng của cả trang một lần). Danh sách đơn
     * mua, tab Đơn mua của nhà cung cấp dùng chung số này với màn chi tiết.
     */
    @Transactional(readOnly = true)
    public <T extends Collection<DonMuaHangDto>> T boSungPhaiTra(T ds) {
        if (ds == null || ds.isEmpty()) return ds;
        List<Integer> ids = ds.stream().filter(Objects::nonNull).map(DonMuaHangDto::getId).filter(Objects::nonNull).toList();
        Map<Integer, BienBanTraHangService.TraHangTheoDon> th = bienBanTraHangService == null
                ? Map.of() : bienBanTraHangService.traHangTheoDon(ids);
        for (DonMuaHangDto dto : ds) {
            if (dto == null) continue;
            tinhPhaiTra(dto, th.getOrDefault(dto.getId(), BienBanTraHangService.TraHangTheoDon.TRONG));
        }
        return ds;
    }

    /**
     * Số tính tiền của một dòng: đã đóng thì hàng đạt đã nhận (đã nhận − trừ tiền, tối đa đặt − trừ tiền); đơn khác thì
     * đặt − trừ tiền. Số trừ tiền không vượt số đã nhận (đã nhận gồm hàng lỗi đã trừ tiền).
     */
    static void tinhPhaiTra(DonMuaHangDto dto, BienBanTraHangService.TraHangTheoDon th) {
        List<ChiTietDonMuaHangDto> dong = dto.getChiTietDonMuaHangs() == null ? List.of() : dto.getChiTietDonMuaHangs();
        boolean daDong = Objects.equals(dto.getTrangThai(), TRANG_THAI_DA_DONG);
        BigDecimal theoDat = BigDecimal.ZERO, phaiTra = BigDecimal.ZERO, giamTru = BigDecimal.ZERO, khongGiao = BigDecimal.ZERO;
        int soTru = 0, soKhongGiao = 0;
        for (ChiTietDonMuaHangDto ct : dong) {
            if (ct == null) continue;
            BigDecimal gia = ct.getDonGia() == null ? BigDecimal.ZERO : ct.getDonGia();
            int dat = nguyen(ct.getSoLuongDat());
            int nhan = nguyen(ct.getSoLuongDaNhan());
            Integer btId = ct.getBienTheSanPham() == null ? null : ct.getBienTheSanPham().getId();
            int tru = Math.min(nhan, Math.max(0, btId == null ? 0 : th.truTheoBienThe().getOrDefault(btId, 0)));
            int canTra = Math.max(0, dat - tru);
            int tinhTien = daDong ? Math.min(Math.max(0, nhan - tru), canTra) : canTra;
            theoDat = theoDat.add(gia.multiply(BigDecimal.valueOf(dat)));
            phaiTra = phaiTra.add(gia.multiply(BigDecimal.valueOf(tinhTien)));
            giamTru = giamTru.add(gia.multiply(BigDecimal.valueOf(tru)));
            soTru += tru;
            if (daDong && canTra > tinhTien) {
                khongGiao = khongGiao.add(gia.multiply(BigDecimal.valueOf(canTra - tinhTien)));
                soKhongGiao += canTra - tinhTien;
            }
        }
        boolean daHuy = Objects.equals(dto.getTrangThai(), TRANG_THAI_DA_HUY);
        dto.setTienTheoDat(dong.isEmpty() ? dto.getTongTien() : theoDat);
        dto.setPhaiTra(daHuy ? null : dong.isEmpty() ? dto.getTongTien() : phaiTra);
        dto.setGiamTruLoi(giamTru);
        dto.setSoLoiTruTien(soTru);
        dto.setKhongGiao(khongGiao);
        dto.setSoKhongGiao(soKhongGiao);
        dto.setSoLoiChoChot(daHuy ? 0 : th.soLoiChoChot());
    }

    private static int nguyen(BigDecimal so) {
        return so == null ? 0 : Math.max(0, so.intValue());
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
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.guiBaoGiaChonYeuCau"));
        }
        if (yeuCau.getNhaCungCapIds() == null || yeuCau.getNhaCungCapIds().isEmpty()) {
            throw new CommonException(ThongDiep.of("sanPhamMuaHang.guiBaoGiaChonNcc"));
        }
        // lấy thông tin người dùng đang đăng nhập
        NguoiDung nguoiDung = nguoiDangThaoTac();

        YeuCauMuaHang yeuCauMuaHang = khoaYeuCau(yeuCau.getYeuCauMuaHangId());
        if (yeuCauMuaHang == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, ThongDiep.of("sanPhamMuaHang.guiBaoGiaKhongTimThayYeuCau"));
        }
        // Đơn mua sinh ra lấy kho nhập của yêu cầu: chỉ người xem được đơn của kho đó mới gửi được
        kiemTraPhamViKhoNhap(yeuCauMuaHang.getKhoNhap());
        // Kiểm sau khi khóa: hai lần bấm cùng lúc thì lần sau chờ khóa, thấy yêu cầu đã ở 3 và dừng
        if (Objects.equals(yeuCauMuaHang.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA)
                || Objects.equals(yeuCauMuaHang.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_CHON_NCC)) {
            String ma = yeuCauMuaHang.getSoYeuCauMuaHang();
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.YEU_CAU_DA_GUI,
                    ma == null || ma.isBlank()
                            ? ThongDiep.of("sanPhamMuaHang.guiBaoGiaYeuCauNayDaGui")
                            : ThongDiep.of("sanPhamMuaHang.guiBaoGiaYeuCauDaGui", ma));
        }
        //kiểm tra xem yêu cầu đã dc duyệt hay chưa
        if (!Objects.equals(yeuCauMuaHang.getTrangThai(), YeuCauMuaHangService.TRANG_THAI_DA_DUYET)) {
            throw new CommonException(HttpStatus.CONFLICT,
                    ThongDiep.of("sanPhamMuaHang.guiBaoGiaYeuCauChuaDuyet"));
        }

        // Kiểm tra hết các nhà cung cấp TRƯỚC khi tạo đơn: chỉ một nhà cung cấp không hợp lệ
        // thì không tạo đơn cho ai. Trùng id thì chỉ gửi một lần.
        List<NhaCungCap> danhSachNhaCungCap = new ArrayList<>();
        for (Integer nhaCungCapId : new LinkedHashSet<>(yeuCau.getNhaCungCapIds())) {
            NhaCungCap nhaCungCap = nhaCungCapService.getOne(nhaCungCapId).orElseThrow(
                    () -> new CommonException(ThongDiep.of("sanPhamMuaHang.guiBaoGiaNccKhongCon"))
            );
            // Nhà cung cấp đã ngừng hoạt động thì không nhận yêu cầu báo giá mới
            if (!Objects.equals(nhaCungCap.getTrangThai(), NhaCungCapService.TRANG_THAI_HOAT_DONG)) {
                throw new CommonException(ThongDiep.of("sanPhamMuaHang.guiBaoGiaNccNgungHoatDong", nhaCungCap.getTenNhaCungCap()));
            }
            // Yêu cầu báo giá gửi qua email và nhà cung cấp đăng nhập cổng bằng email
            if (nhaCungCap.getEmail() == null || nhaCungCap.getEmail().isBlank()) {
                throw new CommonException(ThongDiep.of("sanPhamMuaHang.guiBaoGiaNccChuaCoEmail", nhaCungCap.getTenNhaCungCap()));
            }
            danhSachNhaCungCap.add(nhaCungCap);
        }

        // Cùng đồng hồ với cờ chuaGuiDuocYeuCau / gửi lại (mốc 5 phút tính từ ngày đặt khi chưa có ngay_tao)
        Instant now = dongHo.instant();
        // Hạn báo giá chốt cho cả lần gửi (mọi nhà cung cấp cùng một mốc), ghi vào lịch sử của từng đơn
        java.time.LocalDate han = hanBaoGia == null ? null : HanBaoGia.hanKhiGui(now, hanBaoGia.soNgay());
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
            if (han != null) hanBaoGia.chot(donMuaHang, han, nguoiDung, now);
            // E4: dựng dữ liệu ngay (đơn và dòng đã có id), gửi sau commit; gửi được thì ghi ngay_gui_yeu_cau.
            // Nhà cung cấp này lỗi không ảnh hưởng nhà cung cấp khác; rollback thì không ai nhận email.
            emailNghiepVuService.guiYeuCauBaoGia(donMuaHang, han);
        }
        // Giữ NGUYÊN mã yêu cầu (PR...) — không ghi đè bằng mã RFQ ngẫu nhiên
        // nữa; yêu cầu cũ chưa có mã thì bổ sung mã PR. Cập nhật trạng thái
        // một lần sau khi đã tạo đơn cho mọi nhà cung cấp.
        yeuCauMuaHangService.damBaoCoMa(yeuCauMuaHang);
        //trạng thái đã gửi báo giá
        yeuCauMuaHang.setTrangThai(YeuCauMuaHangService.TRANG_THAI_DA_GUI_BAO_GIA);
        yeuCauMuaHangService.update(yeuCauMuaHang.getId(), yeuCauMuaHang);
        if (thongBaoMuaHangService != null) thongBaoMuaHangService.yeuCauDaGuiBaoGia(yeuCauMuaHang.getId());
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

    private static LoiCoMaException khongGuiLaiDuoc(ThongDiep message) {
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
        // Ngoài phạm vi kho nhập (không xem được đơn) thì cũng không thao tác được
        kiemTraPhamViKhoNhap(don.getKhoNhap());

        if (!Objects.equals(don.getTrangThai(), TRANG_THAI_CHO_BAO_GIA)) {
            throw khongGuiLaiDuoc(ThongDiep.of("sanPhamMuaHang.guiLaiDonDaCoKetQua"));
        }
        if (!yeuCauConMo(yeuCau, cacDon)) {
            throw yeuCauKhongConMo();
        }
        if (don.getNgayBaoGia() != null) {
            throw khongGuiLaiDuoc(ThongDiep.of("sanPhamMuaHang.guiLaiNccDaBaoGia"));
        }
        if (don.getNgayGuiYeuCau() != null) {
            throw khongGuiLaiDuoc(ThongDiep.of("sanPhamMuaHang.guiLaiEmailDaGuiDuoc"));
        }
        Instant now = dongHo.instant();
        if (!chuaGuiDuocYeuCau(don, yeuCau.getTrangThai(), now)) {
            // Còn lại đúng một lý do: đơn vừa tạo, email lần đầu có thể còn trong hàng đợi
            throw khongGuiLaiDuoc(ThongDiep.of("sanPhamMuaHang.guiLaiEmailDangGui"));
        }
        if (don.getNhaCungCap() == null || blankToNull(don.getNhaCungCap().getEmail()) == null) {
            throw khongGuiLaiDuoc(ThongDiep.of("sanPhamMuaHang.guiLaiNccChuaCoEmail"));
        }
        // Qua hạn báo giá: nhà cung cấp không gửi được báo giá nữa nên gửi lại thư cũng vô ích
        HanBaoGia.Han han = hanBaoGia == null ? null : hanBaoGia.hanCua(don);
        if (han != null && HanBaoGia.daQuaHan(han.ngay(), now)) {
            throw khongGuiLaiDuoc(ThongDiep.of("sanPhamMuaHang.guiLaiDaHetHan", NGAY_VN.format(han.ngay())));
        }

        boolean[] duocGui = {false};
        Instant lanTruoc = GlobalCache.GUI_LAI_YEU_CAU.compute(id, (k, truoc) -> {
            if (truoc != null && now.isBefore(truoc.plusSeconds(GUI_LAI_E4_CHAN_LAP_GIAY))) return truoc;
            duocGui[0] = true;
            return now;
        });
        if (!duocGui[0]) {
            int cho = Math.max(1, giayConLai(now, lanTruoc.plusSeconds(GUI_LAI_E4_CHAN_LAP_GIAY)));
            throw khongGuiLaiDuoc(ThongDiep.of("sanPhamMuaHang.guiLaiVuaGuiLai", cho));
        }

        // E4 đọc dòng của đơn: don là entity đã nạp lại sau khi khóa, danh sách dòng nạp từ CSDL (@OrderBy id). Hạn
        // giữ như lần gửi đầu (chỉ đơn đã chốt hạn mới in hạn trong thư)
        emailNghiepVuService.guiYeuCauBaoGia(don, han != null && han.daChot() ? han.ngay() : null);
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
