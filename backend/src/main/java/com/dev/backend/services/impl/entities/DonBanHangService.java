package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FilterLogicType;
import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.ChiTietDonBanHangCreating;
import com.dev.backend.dto.request.DonBanHangCreating;
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.dto.response.customize.BienTheSanPhamSelectDto;
import com.dev.backend.dto.response.customize.ChiTietTonKhoKhaDungDto;
import com.dev.backend.dto.response.customize.DonBanHangDetailResponse;
import com.dev.backend.dto.response.customize.DonBanHangKpiHomNayDto;
import com.dev.backend.dto.response.customize.KhoKhaDungDto;
import com.dev.backend.dto.response.customize.PhieuXuatKhoSummaryDto;
import com.dev.backend.dto.response.customize.ThanhToanTaiQuayDto;
import com.dev.backend.dto.response.customize.TongQuanMuaHangKhachDto;
import com.dev.backend.dto.response.entities.ChiTietDonBanHangDto;
import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.thanhtoan.ThanhToanDonBanDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.ChiTietDonBanHangMapper;
import com.dev.backend.mapper.DonBanHangMapper;
import com.dev.backend.mapper.PhieuXuatKhoMapper;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Root;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dev.backend.event.InventoryRestockedEvent;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.impl.multitable.GiuChoChuyenKhoService;
import com.dev.backend.services.multitable.BangChungDongGoiService;
import com.dev.backend.services.multitable.NhatHangService;
import lombok.extern.slf4j.Slf4j;
import com.dev.backend.utils.SauCommit;
import com.dev.backend.utils.SoChungTu;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Lazy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Slf4j
@Service
public class DonBanHangService extends BaseServiceImpl<DonBanHang, Integer> {

    /** Trạng thái phiếu nhặt hàng còn hoạt động: đơn thuộc các phiếu này bị khóa, không được hủy. */
    private static final Set<String> PHIEU_NHAT_DANG_HOAT_DONG = Set.of("cho_nhat", "dang_nhat", "da_nhat");

    /** Giá trị cột loai_chung_tu của đơn bán (báo giá là "bao_gia"). */
    static final String LOAI_CHUNG_TU_DON_BAN = "don_ban_hang";

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private DonBanHangMapper donBanHangMapper;

    @Autowired
    private ChiTietDonBanHangMapper chiTietDonBanHangMapper;

    @Autowired
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @Autowired
    private PhieuXuatKhoMapper phieuXuatKhoMapper;

    @Autowired
    private ChiTietDonBanHangRepository chiTietDonBanHangRepository;

    @Autowired
    private BienTheSanPhamRepository bienTheSanPhamRepository;

    @Autowired
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;

    @Autowired
    private DonBanHangRepository donBanHangRepository;

    @Autowired
    private PhieuNhapKhoService phieuNhapKhoService;

    @Autowired
    private PhieuXuatKhoService phieuXuatKhoService;

    @Autowired
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;

    @Autowired
    @Lazy
    private NhatHangService nhatHangService;

    @Autowired
    @Lazy
    private KenhBanHangDongBoService kenhBanHangDongBoService;

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private KhoRepository khoRepository;

    @Autowired
    private PosPaymentRepository posPaymentRepository;

    @Autowired
    private ThanhToanDonBanService thanhToanDonBanService;

    @Autowired
    private BangChungDongGoiService bangChungDongGoiService;

    @Autowired
    private ThueGtgtService thueGtgtService;

    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private GiuChoChuyenKhoService giuChoChuyenKhoService;


    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public DonBanHangService(DonBanHangRepository repository) {
        super(repository);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DonBanHang> filter(BaseFilterRequest request) {
        List<FilterCriteria> phamVi = dieuKienPhamViTheoVaiTro(SecurityContextHolder.getUser());
        if (phamVi.isEmpty()) {
            return super.filter(request);
        }

        List<FilterCriteria> filters = request.getFilters() == null
                ? new ArrayList<>()
                : new ArrayList<>(request.getFilters());
        filters.addAll(phamVi);
        request.setFilters(filters);
        return super.filter(request);
    }

    /**
     * Điều kiện phạm vi theo vai trò của người dùng hiện tại, thêm vào mọi truy vấn đơn bán / báo giá.
     * Danh sách đơn và các số tổng hợp (vd. trang chi tiết khách hàng) dùng chung hàm này để số luôn khớp danh sách.
     * <ul>
     *   <li>Quản trị viên: không thêm điều kiện.</li>
     *   <li>Nhân viên kho / quản lý kho: đơn xuất từ kho mình phụ trách; chưa được gán kho thì không thấy đơn nào.</li>
     *   <li>Chỉ là nhân viên bán hàng: đơn do mình tạo.</li>
     * </ul>
     */
    List<FilterCriteria> dieuKienPhamViTheoVaiTro(NguoiDungAuthInfo currentUser) {
        Set<String> roles = currentUser.getVaiTro() == null ? Set.of() : currentUser.getVaiTro();
        if (roles.contains(IRoleType.quan_tri_vien)) {
            return List.of();
        }

        if (roles.contains(IRoleType.nhan_vien_kho) || roles.contains(IRoleType.quan_ly_kho)) {
            List<Integer> myWarehouseIds = currentUser.getPhanQuyenNguoiDungKhos() == null
                    ? List.of()
                    : currentUser.getPhanQuyenNguoiDungKhos()
                    .stream()
                    .map(pq -> pq.getKho().getId())
                    .toList();

            if (!myWarehouseIds.isEmpty()) {
                return List.of(FilterCriteria.builder()
                        .fieldName("khoXuat.id")
                        .operation(FilterOperation.IN)
                        .value(myWarehouseIds)
                        .build());
            }
            // Chưa được gán kho nào: chặn không cho thấy đơn nào
            return List.of(FilterCriteria.builder()
                    .fieldName("id")
                    .operation(FilterOperation.EQUALS)
                    .value(-1)
                    .build());
        }

        if (roles.contains(IRoleType.nhan_vien_ban_hang)) {
            return List.of(FilterCriteria.builder()
                    .fieldName("nguoiTao.id")
                    .operation(FilterOperation.EQUALS)
                    .value(currentUser.getId())
                    .build());
        }
        return List.of();
    }

    /**
     * Một đơn có nằm trong phạm vi vai trò của người dùng không — cùng quy tắc với {@link #dieuKienPhamViTheoVaiTro}, để
     * mở đơn theo id không xem / thao tác được đơn mà màn danh sách không cho thấy (đổi số trên đường dẫn).
     */
    public static boolean trongPhamVi(DonBanHang don, NguoiDungAuthInfo currentUser) {
        if (currentUser == null) return true; // gọi nội bộ (job đồng bộ sàn)
        Set<String> roles = currentUser.getVaiTro() == null ? Set.of() : currentUser.getVaiTro();
        if (roles.contains(IRoleType.quan_tri_vien)) return true;
        if (roles.contains(IRoleType.nhan_vien_kho) || roles.contains(IRoleType.quan_ly_kho)) {
            Integer khoXuatId = don.getKhoXuat() == null ? null : don.getKhoXuat().getId();
            return khoXuatId != null && currentUser.getPhanQuyenNguoiDungKhos() != null
                    && currentUser.getPhanQuyenNguoiDungKhos().stream()
                    .anyMatch(pq -> pq.getKho() != null && khoXuatId.equals(pq.getKho().getId()));
        }
        if (roles.contains(IRoleType.nhan_vien_ban_hang)) {
            return don.getNguoiTao() != null && currentUser.getId() != null
                    && currentUser.getId().equals(don.getNguoiTao().getId());
        }
        return true;
    }

    // Phí vận chuyển không âm: phí âm kéo tổng đơn xuống, lách được chốt giá sàn 90%
    private static void kiemTraPhiVanChuyen(BigDecimal phi) {
        if (phi != null && phi.signum() < 0) {
            throw new CommonException("Phí vận chuyển không được âm");
        }
    }

    private static final BigDecimal TI_LE_GIA_TOI_THIEU = new BigDecimal("0.9");
    private static final BigDecimal TI_LE_GIA_TOI_DA = new BigDecimal("1.1");

    /**
     * Đơn giá trên báo giá chỉ được lệch tối đa 10% so với giá niêm yết của biến thể (90%–110%), cùng quy tắc màn Tạo
     * báo giá. Mức hiện trong câu lỗi làm tròn vào trong khoảng (tối thiểu làm tròn lên, tối đa làm tròn xuống) như màn.
     * Biến thể chưa có giá niêm yết (null hoặc 0 — cột gia_ban mặc định 0) thì không có khoảng để so: chặn, báo cập nhật giá.
     */
    static void kiemTraGiaThoaThuan(String sku, BigDecimal giaNiemYet, BigDecimal giaThoaThuan) {
        if (giaNiemYet == null || giaNiemYet.signum() <= 0) {
            throw new CommonException("Sản phẩm " + sku + " chưa có giá niêm yết, cập nhật giá bán trước khi báo giá");
        }
        if (giaThoaThuan == null) {
            return; // create() lấy giá niêm yết khi dòng không gửi đơn giá
        }
        BigDecimal toiThieu = giaNiemYet.multiply(TI_LE_GIA_TOI_THIEU);
        if (giaThoaThuan.compareTo(toiThieu) < 0) {
            throw new CommonException("Giá bán của sản phẩm " + sku + " không được thấp hơn 10% so với giá niêm yết (tối thiểu "
                    + dinhDangTien(toiThieu.setScale(0, RoundingMode.CEILING)) + ")");
        }
        BigDecimal toiDa = giaNiemYet.multiply(TI_LE_GIA_TOI_DA);
        if (giaThoaThuan.compareTo(toiDa) > 0) {
            throw new CommonException("Giá bán của sản phẩm " + sku + " không được cao hơn 10% so với giá niêm yết (tối đa "
                    + dinhDangTien(toiDa.setScale(0, RoundingMode.FLOOR)) + ")");
        }
    }

    /** "108.000 ₫" — đặt cứng dấu chấm ngăn nghìn: JRE thiếu dữ liệu locale vi-VN (ảnh alpine) sẽ in "108,000". */
    private static String dinhDangTien(BigDecimal so) {
        DecimalFormatSymbols kyHieu = DecimalFormatSymbols.getInstance(Locale.ROOT);
        kyHieu.setGroupingSeparator('.');
        return new DecimalFormat("#,##0", kyHieu).format(so) + " ₫";
    }

    private static void kiemTraPhamVi(DonBanHang don) {
        if (!trongPhamVi(don, SecurityContextHolder.getUser())) {
            throw new CommonException(HttpStatus.FORBIDDEN, ("bao_gia".equals(don.getLoaiChungTu()) ? "Báo giá " : "Đơn ")
                    + don.getSoDonHang() + " không thuộc phạm vi của bạn.");
        }
    }

    /**
     * Số tổng hợp đơn bán của một khách (trang chi tiết khách hàng): tổng chi tiêu, số đơn, trung bình, đơn gần nhất.
     * Chỉ tính chứng từ đơn bán và cùng phạm vi vai trò với danh sách đơn ({@link #filter}).
     */
    @Transactional(readOnly = true)
    public TongQuanMuaHangKhachDto tongQuanMuaHangCuaKhach(Integer khachHangId) {
        List<FilterCriteria> filters = new ArrayList<>();
        filters.add(FilterCriteria.builder()
                .fieldName("khachHang.id").operation(FilterOperation.EQUALS).value(khachHangId).build());
        filters.add(FilterCriteria.builder()
                .fieldName("loaiChungTu").operation(FilterOperation.EQUALS).value(LOAI_CHUNG_TU_DON_BAN).build());
        filters.addAll(dieuKienPhamViTheoVaiTro(SecurityContextHolder.getUser()));
        Specification<DonBanHang> spec = createSpecification(filters);

        // Một truy vấn gom theo trạng thái: số đơn và tổng tiền của từng trạng thái
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<DonBanHang> root = cq.from(DonBanHang.class);
        Path<Integer> trangThai = root.get("trangThai");
        cq.multiselect(trangThai, cb.count(root), cb.sum(root.<BigDecimal>get("tongCong")))
                .where(spec.toPredicate(root, cq, cb))
                .groupBy(trangThai);

        Map<Integer, SoLieuTrangThai> theoTrangThai = new HashMap<>();
        for (Tuple row : entityManager.createQuery(cq).getResultList()) {
            Integer tt = row.get(0, Integer.class);
            Long soDon = row.get(1, Long.class);
            BigDecimal tongTien = row.get(2, BigDecimal.class);
            // trang_thai NULL coi như Nháp (DEFAULT của cột là 0)
            theoTrangThai.merge(tt == null ? ITrangThaiDonBanHang.NHAP : tt,
                    new SoLieuTrangThai(soDon == null ? 0 : soDon, tongTien == null ? BigDecimal.ZERO : tongTien),
                    SoLieuTrangThai::cong);
        }

        // Đơn đã đặt gần nhất: bỏ đơn nháp (notEqual cũng loại trang_thai NULL, khớp cách coi NULL là Nháp ở trên)
        Specification<DonBanHang> daDat = spec.and((r, q, c) -> c.notEqual(r.get("trangThai"), ITrangThaiDonBanHang.NHAP));
        TongQuanMuaHangKhachDto.DonGanNhat donGanNhat = specificationExecutor
                .findAll(daDat, PageRequest.of(0, 1, Sort.by(Sort.Order.desc("ngayDatHang"), Sort.Order.desc("id"))))
                .stream()
                .findFirst()
                .map(d -> TongQuanMuaHangKhachDto.DonGanNhat.builder()
                        .id(d.getId())
                        .soDonHang(d.getSoDonHang())
                        .ngayDatHang(d.getNgayDatHang())
                        .build())
                .orElse(null);

        // Kênh khách đã mua qua (đơn đã đặt): nối trái để đếm cả đơn bán thường (không gắn kênh)
        CriteriaQuery<Tuple> kq = cb.createTupleQuery();
        Root<DonBanHang> rk = kq.from(DonBanHang.class);
        Join<DonBanHang, KenhBanHang> kenh = rk.join("kenhBanHang", JoinType.LEFT);
        Expression<Long> soDonKenh = cb.count(rk);
        kq.multiselect(kenh.get("id"), kenh.get("maKenh"), kenh.get("tenKenh"), soDonKenh)
                .where(daDat.toPredicate(rk, kq, cb))
                .groupBy(kenh.get("id"), kenh.get("maKenh"), kenh.get("tenKenh"))
                .orderBy(cb.desc(soDonKenh), cb.asc(kenh.get("id")));
        List<TongQuanMuaHangKhachDto.KenhMua> kenhMua = entityManager.createQuery(kq).getResultList().stream()
                .map(row -> TongQuanMuaHangKhachDto.KenhMua.builder()
                        .id(row.get(0, Integer.class))
                        .maKenh(row.get(1, String.class))
                        .tenKenh(row.get(2, String.class))
                        .soDon(row.get(3, Long.class))
                        .build())
                .toList();

        TongQuanMuaHangKhachDto ketQua = tongHopMuaHang(theoTrangThai, donGanNhat);
        ketQua.setKenhMua(kenhMua);

        // Còn phải thu / cần hoàn: đơn không phải đơn sàn có trạng thái thanh toán chưa xong hoặc thu dư. Đơn cũ chưa theo
        // dõi (trạng thái trống) và đơn tại quầy (Đã thanh toán) không vào đây
        Specification<DonBanHang> theoDoiThu = spec.and((r, q, c) -> c.and(
                c.isNull(r.get("kenhBanHang")),
                c.or(c.isNull(r.get("maDonHangKenh")), c.equal(c.trim(r.<String>get("maDonHangKenh")), "")),
                r.get("trangThaiThanhToan").in(THANH_TOAN_CHUA_XONG)));
        CriteriaQuery<Tuple> tq = cb.createTupleQuery();
        Root<DonBanHang> rt = tq.from(DonBanHang.class);
        tq.multiselect(rt.get("id"), rt.get("trangThai"), rt.get("tongCong")).where(theoDoiThu.toPredicate(rt, tq, cb));
        List<DonPhaiThu> donPhaiThu = entityManager.createQuery(tq).getResultList().stream()
                .map(row -> new DonPhaiThu(row.get(0, Integer.class), row.get(1, Integer.class), row.get(2, BigDecimal.class)))
                .toList();
        Map<Integer, BigDecimal> daThu = donPhaiThu.isEmpty() ? Map.of()
                : thanhToanDonBanService.daThuTheoDon(donPhaiThu.stream().map(DonPhaiThu::id).toList());
        congNoThanhToan(ketQua, donPhaiThu, daThu);
        return ketQua;
    }

    /** Trạng thái thanh toán của đơn còn nợ hoặc thu dư (lọc trước khi cộng theo phiếu). */
    private static final List<String> THANH_TOAN_CHUA_XONG = List.of(TinhThanhToan.CHUA_THANH_TOAN,
            TinhThanhToan.THANH_TOAN_MOT_PHAN, TinhThanhToan.CAN_HOAN_TIEN);

    record DonPhaiThu(Integer id, Integer trangThai, BigDecimal tongCong) {
    }

    /**
     * Cộng còn phải thu / cần hoàn của các đơn (tách riêng để kiểm thử): mỗi đơn so phải thu với đã thu theo phiếu;
     * đơn nháp (kể cả trang_thai NULL) có đặt cọc không tính còn phải thu, nhưng thu dư vẫn tính cần hoàn.
     */
    static void congNoThanhToan(TongQuanMuaHangKhachDto kq, List<DonPhaiThu> dsDon, Map<Integer, BigDecimal> daThu) {
        BigDecimal conPhaiThu = BigDecimal.ZERO, canHoan = BigDecimal.ZERO;
        long soConPhaiThu = 0, soCanHoan = 0;
        for (DonPhaiThu d : dsDon) {
            BigDecimal chenh = daThu.getOrDefault(d.id(), BigDecimal.ZERO)
                    .subtract(TinhThanhToan.phaiThu(d.trangThai(), d.tongCong()));
            boolean nhap = d.trangThai() == null || d.trangThai() == ITrangThaiDonBanHang.NHAP;
            if (chenh.signum() < 0 && !nhap) {
                conPhaiThu = conPhaiThu.add(chenh.negate());
                soConPhaiThu++;
            } else if (chenh.signum() > 0) {
                canHoan = canHoan.add(chenh);
                soCanHoan++;
            }
        }
        kq.setConPhaiThu(conPhaiThu);
        kq.setSoDonConPhaiThu(soConPhaiThu);
        kq.setCanHoan(canHoan);
        kq.setSoDonCanHoan(soCanHoan);
    }

    /** Số đơn và tổng tiền của một trạng thái. */
    record SoLieuTrangThai(long soDon, BigDecimal tongTien) {
        SoLieuTrangThai cong(SoLieuTrangThai khac) {
            return new SoLieuTrangThai(soDon + khac.soDon, tongTien.add(khac.tongTien));
        }
    }

    /**
     * Quy tắc tính (tách riêng để kiểm thử): đơn nháp không tính vào số đơn; đơn đã hủy và bị hoàn trả
     * vẫn là đơn đã đặt nhưng không tính vào chi tiêu.
     */
    static TongQuanMuaHangKhachDto tongHopMuaHang(Map<Integer, SoLieuTrangThai> theoTrangThai,
                                                 TongQuanMuaHangKhachDto.DonGanNhat donGanNhat) {
        long soDonNhap = 0;
        long soDonHuy = 0;
        long soDonHoanTra = 0;
        long soDonTinhChiTieu = 0;
        long soDonDangXuLy = 0;
        BigDecimal tongChiTieu = BigDecimal.ZERO;

        for (Map.Entry<Integer, SoLieuTrangThai> e : theoTrangThai.entrySet()) {
            int tt = e.getKey();
            SoLieuTrangThai so = e.getValue();
            if (tt != ITrangThaiDonBanHang.HOAN_THANH && tt != ITrangThaiDonBanHang.DA_HUY
                    && tt != ITrangThaiDonBanHang.BI_HOAN_TRA) {
                soDonDangXuLy += so.soDon();
            }
            if (tt == ITrangThaiDonBanHang.NHAP) {
                soDonNhap += so.soDon();
            } else if (tt == ITrangThaiDonBanHang.DA_HUY) {
                soDonHuy += so.soDon();
            } else if (tt == ITrangThaiDonBanHang.BI_HOAN_TRA) {
                soDonHoanTra += so.soDon();
            } else {
                soDonTinhChiTieu += so.soDon();
                tongChiTieu = tongChiTieu.add(so.tongTien());
            }
        }

        return TongQuanMuaHangKhachDto.builder()
                .soDonDat(soDonTinhChiTieu + soDonHuy + soDonHoanTra)
                .soDonTinhChiTieu(soDonTinhChiTieu)
                .soDonHuy(soDonHuy)
                .soDonHoanTra(soDonHoanTra)
                .soDonNhap(soDonNhap)
                .soDonDangXuLy(soDonDangXuLy)
                .tongChiTieu(tongChiTieu)
                .trungBinhMoiDon(soDonTinhChiTieu == 0
                        ? null
                        : tongChiTieu.divide(BigDecimal.valueOf(soDonTinhChiTieu), 0, RoundingMode.HALF_UP))
                .donGanNhat(donGanNhat)
                .kenhMua(List.of())
                .build();
    }

    @Transactional(readOnly = true)
    public DonBanHangDetailResponse getDetail(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn bán"));
        kiemTraPhamVi(don);

        // Map đơn bán
        DonBanHangDto donDto = donBanHangMapper.toDto(don);

        // Map chi tiết đơn
        List<ChiTietDonBanHangDto> chiTietDtos =
                don.getChiTietDonBanHangs()
                        .stream()
                        .map(chiTietDonBanHangMapper::toDto)
                        .toList();

        // Lấy danh sách phiếu xuất kho liên quan
        List<PhieuXuatKho> phieuList =
                phieuXuatKhoRepository.findByDonBanHangId(id);

        List<PhieuXuatKhoSummaryDto> phieuDtos =
                phieuList.stream()
                        .map(phieuXuatKhoMapper::toSummaryDto)
                        .toList();

        DanhSachNhatHang phieuNhat = don.getDanhSachNhatHang();
        // Hóa đơn tại quầy in tiền khách đưa / tiền thừa từ sổ thu POS (trả kết hợp: phần tiền mặt + phần QR payOS)
        ThanhToanTaiQuayDto thanhToanTaiQuay = posPaymentRepository.findFirstByDonBanHangIdOrderByIdDesc(id)
                .map(thu -> ThanhToanTaiQuayDto.builder()
                        .phuongThuc(thu.getPhuongThuc())
                        .soTienThu(thu.getSoTienThu())
                        .soTienThua(thu.getSoTienThua())
                        .tienMatTruoc(thu.getTienMatTruoc() != null && thu.getTienMatTruoc().signum() > 0 ? thu.getTienMatTruoc() : null)
                        .ngayThu(thu.getNgayTao())
                        .build())
                .orElse(null);
        // Đơn bán thường: phải thu, đã thu, các phiếu thu / hoàn
        ThanhToanDonBanDto.TheoDon thanhToan = thanhToanTaiQuay == null ? thanhToanDonBanService.theoDon(don) : null;
        return DonBanHangDetailResponse.builder()
                .donBanHang(donDto)
                .chiTiet(chiTietDtos)
                .phieuXuatKhoList(phieuDtos)
                .phieuNhatHangId(phieuNhat != null ? phieuNhat.getId() : null)
                .maPickList(phieuNhat != null ? phieuNhat.getMaPickList() : null)
                .trangThaiPhieuNhat(phieuNhat != null ? phieuNhat.getTrangThai() : null)
                .thanhToanTaiQuay(thanhToanTaiQuay)
                .thanhToan(thanhToan)
                .build();
    }

    @Transactional(rollbackFor = Exception.class)
    public void sendToWarehouse(Integer id) {
        sendToWarehouse(id, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public void sendToWarehouse(Integer id, Integer khoId) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy đơn bán với ID: " + id, HttpStatus.NOT_FOUND, null));
        kiemTraPhamVi(don);

        if ("bao_gia".equals(don.getLoaiChungTu())) {
            throw new CommonException("Báo giá không thể gửi sang kho. Vui lòng chuyển thành đơn hàng trước!", HttpStatus.BAD_REQUEST, null);
        }

        if (don.getTrangThai() == null || don.getTrangThai() != 0) {
            throw new CommonException("Chỉ đơn ở trạng thái Nháp mới được gửi kho", HttpStatus.BAD_REQUEST, null);
        }

        Kho khoChon;
        if (khoId != null) {
            khoChon = khoRepository.findById(khoId)
                    .orElseThrow(() -> new CommonException("Không tìm thấy kho xuất với ID: " + khoId, HttpStatus.NOT_FOUND, null));
        } else if (don.getKhoXuat() != null) {
            khoChon = don.getKhoXuat();
        } else {
            Integer contextKhoId = SecurityContextHolder.getKhoId();
            khoChon = contextKhoId != null ? khoRepository.findById(contextKhoId).orElse(null) : null;
            if (khoChon == null) {
                throw new CommonException("Vui lòng chọn kho xuất cho đơn hàng", HttpStatus.BAD_REQUEST, null);
            }
        }
        // Cùng quy tắc lúc tạo đơn: kho đang hoạt động và không phải Kho Trung Chuyển (kho ảo)
        KhoService.kiemTraKhoGiaoDich(khoChon, "Kho xuất hàng");
        don.setKhoXuat(khoChon);

        don.setTrangThai(ITrangThaiDonBanHang.CHO_NHAT_HANG); // 1: Chờ nhặt hàng
        don.setNgayCapNhat(Instant.now());
        repository.save(don);

        // Ghi Audit Trail (lich_su_thay_doi)
        try {
            NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
            NguoiDung actor = null;
            if (auth != null && auth.getId() != null) {
                actor = nguoiDungRepository.findById(auth.getId()).orElse(null);
            }
            String tenKho = don.getKhoXuat() != null ? don.getKhoXuat().getTenKho() : "Chưa xác định";
            lichSuThayDoiService.create(
                    LichSuThayDoi.builder()
                            .loaiThamChieu(ITable.don_ban_hang)
                            .idThamChieu(don.getId())
                            .hanhDong("gui_sang_kho")
                            .giaTriMoi("Gửi đơn " + don.getSoDonHang() + " sang kho xuất: " + tenKho)
                            .nguoiThucHien(actor)
                            .ngayThucHien(Instant.now())
                            .ghiChu("Chuyển trạng thái đơn sang Chờ nhặt hàng")
                            .build()
            );
        } catch (Exception e) {
            log.warn("Không thể ghi log thay đổi khi gửi đơn sang kho: {}", e.getMessage());
        }
    }

    /**
     * Truy vấn tồn khả dụng (Free to Use = On Hand - Outgoing) của các mặt hàng trong đơn hàng
     * tại tất cả các kho đang hoạt động, phục vụ việc lựa chọn kho tiếp nhận tối ưu.
     */
    @Transactional(readOnly = true)
    public List<KhoKhaDungDto> getKhoKhaDungChoDonHang(Integer donHangId) {
        DonBanHang don = repository.findById(donHangId)
                .orElseThrow(() -> new CommonException("Không tìm thấy đơn hàng với ID: " + donHangId, HttpStatus.NOT_FOUND, null));
        kiemTraPhamVi(don);

        List<ChiTietDonBanHang> chiTiets = chiTietDonBanHangRepository.findByDonBanHangId(donHangId);
        // Chỉ gợi ý kho nhận được đơn bán: bỏ Kho Trung Chuyển (kho ảo chứa hàng đang chuyển giữa các kho)
        List<Kho> activeKhos = khoRepository.findByTrangThai(1).stream()
                .filter(k -> !KhoService.laKhoAo(k))
                .toList();

        if (activeKhos == null || activeKhos.isEmpty()) {
            return Collections.emptyList();
        }

        if (chiTiets == null || chiTiets.isEmpty()) {
            return activeKhos.stream().map(k -> KhoKhaDungDto.builder()
                    .khoId(k.getId())
                    .maKho(k.getMaKho())
                    .tenKho(k.getTenKho())
                    .diaChi(k.getDiaChi())
                    .duHang(true)
                    .soLuongMatHangDu(0)
                    .tongSoMatHang(0)
                    .chiTietTonKho(Collections.emptyList())
                    .build()
            ).toList();
        }

        List<Integer> bienTheIds = chiTiets.stream()
                .map(ct -> ct.getBienTheSanPham() != null ? ct.getBienTheSanPham().getId() : null)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        // 1. Tồn khả dụng theo lô (tồn − đang giữ) theo (kho, biến thể); 2. lượng chờ xuất của các đơn khác
        Map<Integer, Map<Integer, BigDecimal>> onHandMap = bienTheIds.isEmpty() ? Map.of() : khaDungLoTheoKho(bienTheIds);
        Map<Integer, Map<Integer, BigDecimal>> outgoingMap = bienTheIds.isEmpty() ? Map.of() : choXuatTheoKho(bienTheIds, donHangId);

        List<KhoKhaDungDto> results = new ArrayList<>();
        for (Kho kho : activeKhos) {
            Integer kId = kho.getId();
            Map<Integer, BigDecimal> khoOnHand = onHandMap.getOrDefault(kId, Collections.emptyMap());
            Map<Integer, BigDecimal> khoOutgoing = outgoingMap.getOrDefault(kId, Collections.emptyMap());

            int matHangDuCount = 0;
            List<ChiTietTonKhoKhaDungDto> itemDtos = new ArrayList<>();

            for (ChiTietDonBanHang ct : chiTiets) {
                BienTheSanPham bt = ct.getBienTheSanPham();
                Integer btId = bt != null ? bt.getId() : null;
                BigDecimal soLuongDat = ct.getSoLuongDat() != null ? ct.getSoLuongDat() : BigDecimal.ZERO;

                BigDecimal onHand = (btId != null) ? khoOnHand.getOrDefault(btId, BigDecimal.ZERO) : BigDecimal.ZERO;
                BigDecimal outgoing = (btId != null) ? khoOutgoing.getOrDefault(btId, BigDecimal.ZERO) : BigDecimal.ZERO;
                BigDecimal tonKhaDung = onHand.subtract(outgoing).max(BigDecimal.ZERO);

                boolean duHang = tonKhaDung.compareTo(soLuongDat) >= 0;
                if (duHang) {
                    matHangDuCount++;
                }

                String tenBienThe = "";
                if (bt != null) {
                    String mau = bt.getMauSac() != null ? bt.getMauSac().getTenMau() : "";
                    String size = bt.getSize() != null ? bt.getSize().getTenSize() : "";
                    if (mau != null && !mau.isBlank() && size != null && !size.isBlank()) {
                        tenBienThe = mau + " / " + size;
                    } else if (mau != null && !mau.isBlank()) {
                        tenBienThe = mau;
                    } else if (size != null && !size.isBlank()) {
                        tenBienThe = size;
                    }
                }

                itemDtos.add(ChiTietTonKhoKhaDungDto.builder()
                        .bienTheId(btId)
                        .maSku(bt != null ? bt.getMaSku() : "")
                        .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : "")
                        .tenBienThe(tenBienThe)
                        .soLuongDat(soLuongDat)
                        .tonKhaDung(tonKhaDung)
                        .duHang(duHang)
                        .build());
            }

            boolean allDuHang = matHangDuCount == chiTiets.size();
            results.add(KhoKhaDungDto.builder()
                    .khoId(kId)
                    .maKho(kho.getMaKho())
                    .tenKho(kho.getTenKho())
                    .diaChi(kho.getDiaChi())
                    .duHang(allDuHang)
                    .soLuongMatHangDu(matHangDuCount)
                    .tongSoMatHang(chiTiets.size())
                    .chiTietTonKho(itemDtos)
                    .build());
        }

        // Sắp xếp: Kho đủ hàng (duHang = true) lên đầu, tiếp theo là số lượng mặt hàng đủ nhiều hơn, sau đó theo tên kho
        results.sort(Comparator
                .comparing(KhoKhaDungDto::getDuHang, Comparator.reverseOrder())
                .thenComparing(KhoKhaDungDto::getSoLuongMatHangDu, Comparator.reverseOrder())
                .thenComparing(KhoKhaDungDto::getTenKho));

        return results;
    }

    /** Tồn khả dụng theo lô (tồn − đang giữ) ở các kho bán được: kho → (biến thể → số lượng). */
    private Map<Integer, Map<Integer, BigDecimal>> khaDungLoTheoKho(List<Integer> bienTheIds) {
        Map<Integer, Map<Integer, BigDecimal>> ketQua = new HashMap<>();
        for (Object[] row : tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(bienTheIds)) {
            ketQua.computeIfAbsent((Integer) row[1], k -> new HashMap<>()).put((Integer) row[0], soLuong(row[2]));
        }
        return ketQua;
    }

    /**
     * Lượng chờ xuất của đơn bán đang giữ hàng (ITrangThaiDonBanHang.DANG_GIU_HANG): đặt − đã xuất thật, cộng hàng
     * phiếu chuyển kho đang giữ chỗ ở kho nguồn (Chờ duyệt / Đã duyệt, phần chưa chọn lô); kho → (biến thể → số lượng).
     * {@code boQuaDonId} để không tính chính đơn đang xét.
     */
    private Map<Integer, Map<Integer, BigDecimal>> choXuatTheoKho(List<Integer> bienTheIds, Integer boQuaDonId) {
        Map<Integer, Map<Integer, BigDecimal>> ketQua = new HashMap<>();
        for (Object[] row : chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(bienTheIds, boQuaDonId, ITrangThaiDonBanHang.DANG_GIU_HANG)) {
            ketQua.computeIfAbsent((Integer) row[1], k -> new HashMap<>()).merge((Integer) row[0], soLuong(row[2]), BigDecimal::add);
        }
        for (Object[] row : chiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho(bienTheIds, boQuaDonId, ITrangThaiDonBanHang.DANG_GIU_HANG)) {
            ketQua.computeIfAbsent((Integer) row[1], k -> new HashMap<>()).merge((Integer) row[0], soLuong(row[2]).negate(), BigDecimal::add);
        }
        giuChoChuyenKhoService.theoKho(bienTheIds).forEach((bienTheId, theoKho) -> theoKho.forEach((khoId, giuCho) ->
                ketQua.computeIfAbsent(khoId, k -> new HashMap<>()).merge(bienTheId, giuCho, BigDecimal::add)));
        return ketQua;
    }

    private static BigDecimal soLuong(Object value) {
        if (value == null) return BigDecimal.ZERO;
        return value instanceof BigDecimal bd ? bd : BigDecimal.valueOf(((Number) value).doubleValue());
    }

    /**
     * Hủy đơn thủ công (người dùng FCentric). Chỉ hủy được khi hàng chưa vào khâu kho: đơn đang trong phiếu nhặt
     * (chờ nhặt / đang nhặt / đã nhặt), chờ đóng gói hoặc chờ xuất kho thì báo 409 để kho xử lý trước —
     * tránh nhặt / đóng gói / xuất hàng cho đơn đã hủy. Sàn hủy đơn đi đường {@link #huyDonTuSan}.
     */
    @Transactional(rollbackFor = Exception.class)
    public void cancel(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chứng từ"));
        kiemTraPhamVi(don);

        if ("bao_gia".equals(don.getLoaiChungTu())) {
            throw new RuntimeException("Đây là báo giá, vui lòng sử dụng chức năng Từ chối báo giá để có thể ghi nhận lý do!");
        }

        // Đơn đã hủy: không chạy lại các bước phía sau (bấm lại, tab thứ hai, gọi API lặp) — nếu chạy lại
        // sẽ trừ số cần nhặt của phiếu nhặt thêm một lần và sinh lệnh hoàn kệ cho hàng chưa nhặt.
        if (Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())) {
            return;
        }

        Integer trangThai = don.getTrangThai();
        if (trangThai != null && (trangThai == ITrangThaiDonBanHang.DA_XUAT_TOAN_BO
                || trangThai == ITrangThaiDonBanHang.HOAN_THANH || trangThai == ITrangThaiDonBanHang.BI_HOAN_TRA)) {
            throw new CommonException("Đơn đã xuất kho, hoàn thành hoặc đã hoàn trả, không thể hủy", HttpStatus.CONFLICT, null);
        }

        boolean existsCompletedPX = phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThai(id, ITrangThaiPhieuXuat.DA_XUAT);
        if (existsCompletedPX) {
            throw new CommonException("Đơn đã có phiếu xuất hoàn thành, không thể hủy", HttpStatus.CONFLICT, null);
        }

        // Khóa đơn theo phiếu nhặt hàng (SRS: Pick List order lock): đơn đã gom vào phiếu nhặt
        // còn hoạt động thì không được hủy, tránh nhặt/xuất hàng cho đơn đã hủy.
        DanhSachNhatHang phieuNhat = don.getDanhSachNhatHang();
        if (phieuNhat != null && (phieuNhat.getTrangThai() == null
                || PHIEU_NHAT_DANG_HOAT_DONG.contains(phieuNhat.getTrangThai()))) {
            throw new CommonException("Đơn đang nằm trong phiếu nhặt hàng " + phieuNhat.getMaPickList()
                    + " nên không thể hủy.", HttpStatus.CONFLICT, null);
        }
        // Đơn đã có phiếu xuất đang đóng gói / chờ xuất (kể cả phiếu tạo tay, không qua phiếu nhặt)
        if (trangThai != null && (trangThai == ITrangThaiDonBanHang.CHO_DONG_GOI || trangThai == ITrangThaiDonBanHang.DA_DONG_GOI)) {
            throw new CommonException("Đơn đang ở khâu " + (trangThai == ITrangThaiDonBanHang.CHO_DONG_GOI ? "chờ đóng gói" : "chờ xuất kho")
                    + " nên không thể hủy. Vui lòng liên hệ kho.", HttpStatus.CONFLICT, null);
        }

        don.setTrangThai(ITrangThaiDonBanHang.DA_HUY);
        repository.save(don);

        // Thu hồi phiếu xuất chưa xuất (nếu có) liên kết với đơn này (SRS 6.3.2) → 4 (Đã hủy)
        phieuXuatKhoService.huyPhieuXuatNhapTheoDon(don.getId(), "Tự động thu hồi do đơn " + don.getSoDonHang() + " bị hủy");

        // Khôi phục báo giá gốc nếu có
        if (don.getSoDonHang() != null && don.getSoDonHang().startsWith("SO")) {
            String maBaoGiaGoc = don.getSoDonHang().split("-")[0].replaceFirst("^SO", "BG");

            donBanHangRepository.findBySoDonHang(maBaoGiaGoc).ifPresent(baoGiaGoc -> {
                if ("bao_gia".equals(baoGiaGoc.getLoaiChungTu()) && baoGiaGoc.getTrangThai() == 2) {
                    baoGiaGoc.setTrangThai(0); // Đưa về lại trạng thái Chờ phản hồi
                    repository.save(baoGiaGoc);
                }
            });
        }

        // Phải thu về 0: đơn đã đặt cọc / thu tiền thành Cần hoàn tiền. Gọi cuối cùng: câu đọc phiếu có khóa giữ khóa
        // tới lúc commit
        thanhToanDonBanService.tinhLaiSauDoiDon(don);

        // Giải phóng Outgoing, hồi phục Free to Use và kích hoạt đẩy tồn (listener chạy sau commit)
        phatSuKienHoanTon(don);

        // Đơn từ sàn (Shopify): gọi Shopify Order Cancel API SAU KHI commit — giao dịch rollback thì không hủy trên sàn
        if (don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank()) {
            String maDonHangKenh = don.getMaDonHangKenh();
            SauCommit.chay("Đồng bộ hủy đơn " + maDonHangKenh + " sang Shopify",
                    () -> kenhBanHangDongBoService.huyDonHangTrenShopify(maDonHangKenh, "Hủy từ FCentric"));
        }
    }

    /**
     * Sàn (Shopify) báo hủy đơn. Không chặn được như hủy thủ công nên tự xử lý ở mọi bước kho: giảm số cần nhặt /
     * sinh lệnh hoàn kệ (phiếu nhặt), thu hồi phiếu xuất chưa xuất. Đơn đã xuất kho (hoặc hoàn thành / hoàn trả)
     * thì KHÔNG chuyển sang hủy — chỉ ghi nhật ký để xử lý hoàn trả. Đơn được nạp trong giao dịch này nên quan hệ
     * lazy (phiếu nhặt) đọc được — job đồng bộ gọi qua proxy, không truyền entity tách rời.
     *
     * @return true nếu đơn đã được chuyển sang Đã hủy
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean huyDonTuSan(Integer donId, String lyDo) {
        DonBanHang don = repository.findById(donId).orElse(null);
        if (don == null || Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())) {
            return false;
        }
        Integer trangThai = don.getTrangThai();
        boolean daXuat = (trangThai != null && (trangThai == ITrangThaiDonBanHang.DA_XUAT_TOAN_BO
                || trangThai == ITrangThaiDonBanHang.HOAN_THANH || trangThai == ITrangThaiDonBanHang.BI_HOAN_TRA))
                || phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThai(donId, ITrangThaiPhieuXuat.DA_XUAT);
        if (daXuat) {
            log.warn("[CHANNEL-CANCEL] Sàn báo hủy đơn {} nhưng đơn đã xuất kho (trạng thái {}) — giữ nguyên, cần xử lý hoàn trả",
                    don.getSoDonHang(), trangThai);
            ghiNhatKyDon(don, "huy_don_tu_san", "Sàn báo hủy nhưng đơn đã xuất kho — giữ nguyên trạng thái, cần xử lý hoàn trả. " + lyDo);
            return false;
        }

        boolean trongPhieuNhat = don.getDanhSachNhatHang() != null;
        don.setTrangThai(ITrangThaiDonBanHang.DA_HUY);
        don.setLyDoTuChoi(lyDo);
        don.setNgayCapNhat(Instant.now());
        repository.save(don);

        // Lỗi ở bước phiếu nhặt làm hủy cả giao dịch (đơn chưa bị đánh dấu hủy); job đồng bộ thử lại ở lượt sau
        if (trongPhieuNhat) {
            nhatHangService.xuLyDonBiHuyTrongPickList(don);
        }
        phieuXuatKhoService.huyPhieuXuatNhapTheoDon(donId, "Tự động thu hồi do sàn hủy đơn");
        if (!trongPhieuNhat) {
            phatSuKienHoanTon(don); // đơn trong phiếu nhặt: xuLyDonBiHuyTrongPickList đã phát
        }
        ghiNhatKyDon(don, "huy_don_tu_san", lyDo);
        return true;
    }

    /** Phát InventoryRestockedEvent cho từng dòng đơn (listener đẩy tồn chạy sau commit). */
    private void phatSuKienHoanTon(DonBanHang don) {
        List<ChiTietDonBanHang> chiTiets = chiTietDonBanHangRepository.findByDonBanHangId(don.getId());
        for (ChiTietDonBanHang ctd : chiTiets) {
            if (ctd.getBienTheSanPham() != null && ctd.getSoLuongDat() != null && ctd.getSoLuongDat().compareTo(BigDecimal.ZERO) > 0) {
                eventPublisher.publishEvent(new InventoryRestockedEvent(this, ctd.getBienTheSanPham().getId(), ctd.getSoLuongDat(),
                        don.getKhoXuat() != null ? don.getKhoXuat().getId() : null));
            }
        }
    }

    /**
     * Ghi lịch sử thay đổi của đơn SAU KHI commit: lỗi ghi nhật ký (vd. thiếu người thực hiện) không được làm hỏng
     * giao dịch nghiệp vụ — lỗi trong giao dịch đánh dấu rollback-only dù đã bắt. Không có người thao tác
     * (job đồng bộ sàn; cột nguoi_thuc_hien_id NOT NULL) thì chỉ ghi log ứng dụng.
     */
    private void ghiNhatKyDon(DonBanHang don, String hanhDong, String ghiChu) {
        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        Integer donId = don.getId();
        String giaTriMoi = "Đơn " + don.getSoDonHang() + " - trạng thái " + don.getTrangThai();
        if (auth == null || auth.getId() == null) {
            log.info("[NHAT-KY-DON] {} {}: {}", hanhDong, giaTriMoi, ghiChu);
            return;
        }
        Integer nguoiId = auth.getId();
        SauCommit.chay("Ghi nhật ký đơn " + don.getSoDonHang(), () -> lichSuThayDoiService.createGiaoDichRieng(LichSuThayDoi.builder()
                .loaiThamChieu(ITable.don_ban_hang)
                .idThamChieu(donId)
                .hanhDong(hanhDong)
                .giaTriMoi(giaTriMoi)
                .nguoiThucHien(nguoiDungRepository.findById(nguoiId).orElse(null))
                .ngayThucHien(Instant.now())
                .ghiChu(ghiChu)
                .build()));
    }

    @Transactional
    public DonBanHang create(DonBanHangCreating request) {
        if (request.getChiTiet() == null || request.getChiTiet().isEmpty()) {
            throw new RuntimeException("Danh sách sản phẩm không được rỗng");
        }
        kiemTraPhiVanChuyen(request.getPhiVanChuyen());

        Integer userId = SecurityContextHolder.getUser().getId();
        NguoiDung nguoiTao = entityManager.find(NguoiDung.class, userId);
        if (nguoiTao == null) {
            throw new RuntimeException("Người dùng không hợp lệ");
        }

        KhachHang khachHang = entityManager.find(KhachHang.class, request.getKhachHangId());
        if (khachHang == null) {
            throw new RuntimeException("Khách hàng không tồn tại");
        }

        if ("don_ban_hang".equals(request.getLoaiChungTu())) {
            throw new RuntimeException("Hệ thống không cho phép tạo Đơn bán hàng trực tiếp. Vui lòng tạo Báo giá và chờ khách hàng chấp nhận!");
        }

        String type = "bao_gia";

        Kho khoXuat = null;
        if (request.getKhoXuatId() != null) {
            khoXuat = entityManager.find(Kho.class, request.getKhoXuatId());
            if (khoXuat == null) throw new RuntimeException("Kho đã chọn không tồn tại");
            KhoService.kiemTraKhoGiaoDich(khoXuat, "Kho xuất hàng");
        }

        int retry = 0;
        int maxRetry = 5;

        while (true) {
            try {
                DonBanHang don = DonBanHang.builder()
                        .soDonHang(generateMaChungTu(type))
                        .loaiChungTu(type)
                        .khachHang(khachHang)
                        .ngayDatHang(Instant.now())
                        .khoXuat(khoXuat)
                        .trangThai(0)
                        .tienHang(BigDecimal.ZERO)
                        .phiVanChuyen(
                                request.getPhiVanChuyen() != null
                                        ? request.getPhiVanChuyen()
                                        : BigDecimal.ZERO
                        )
                        .tongCong(BigDecimal.ZERO)
                        .trangThaiThanhToan("chua_thanh_toan")
                        .diaChiGiaoHang(request.getDiaChiGiaoHang())
                        .ghiChu(request.getGhiChu())
                        .nguoiTao(nguoiTao)
                        .build();

                repository.save(don);

                BigDecimal tongTienHang = BigDecimal.ZERO;
                Set<Integer> variantIds = new HashSet<>();

                for (ChiTietDonBanHangCreating item : request.getChiTiet()) {
                    if (!variantIds.add(item.getBienTheSanPhamId())) {
                        throw new RuntimeException("Biến thể bị trùng trong chứng từ");
                    }

                    if (item.getSoLuongDat() == null || item.getSoLuongDat().compareTo(BigDecimal.ZERO) <= 0) {
                        throw new RuntimeException("Số lượng đặt phải > 0");
                    }

                    BienTheSanPham bienThe = bienTheSanPhamRepository
                            .findById(item.getBienTheSanPhamId())
                            .orElseThrow(() -> new RuntimeException("Không tìm thấy biến thể"));

                    if (bienThe.getTrangThai() == null || bienThe.getTrangThai() != 1) {
                        throw new RuntimeException("Biến thể " + bienThe.getMaSku() + " không còn hoạt động");
                    }

                    BigDecimal qtyDat = item.getSoLuongDat();

                    BigDecimal giaNiemYet = bienThe.getGiaBan();
                    BigDecimal giaThoaThuan = item.getDonGia() != null ? item.getDonGia() : giaNiemYet;
                    kiemTraGiaThoaThuan(bienThe.getMaSku(), giaNiemYet, giaThoaThuan);

                    BigDecimal thanhTien = giaThoaThuan.multiply(qtyDat);

                    ChiTietDonBanHang chiTiet = ChiTietDonBanHang.builder()
                            .donBanHang(don)
                            .bienTheSanPham(bienThe)
                            .soLuongDat(qtyDat)
                            .soLuongDaGiao(BigDecimal.ZERO)
                            .donGia(giaThoaThuan)
                            .thanhTien(thanhTien)
                            .ghiChu(item.getGhiChu())
                            .build();

                    chiTietDonBanHangRepository.save(chiTiet);
                    tongTienHang = tongTienHang.add(thanhTien);
                }

                don.setTienHang(tongTienHang);
                don.setTongCong(tongTienHang.add(don.getPhiVanChuyen()));
                // Đơn bán tạo thẳng (không qua báo giá) chốt lúc tạo: chụp thuế GTGT
                if (!"bao_gia".equals(don.getLoaiChungTu())) thueGtgtService.chup(don, null);
                repository.save(don);

                return don;

            } catch (DataIntegrityViolationException ex) {
                if (isDuplicateSoDonHang(ex) && retry < maxRetry) {
                    retry++;
                    continue;
                }
                throw ex;
            }
        }
    }

    @Transactional
    public void convertToOrder(Integer id, Integer khoXuatId, String ghiChu, String diaChi, BigDecimal phiVanChuyen) {
        DonBanHang baoGia = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy báo giá"));
        kiemTraPhamVi(baoGia);

        if (!"bao_gia".equals(baoGia.getLoaiChungTu())) {
            throw new RuntimeException("Chỉ chứng từ loại báo giá mới được chuyển đổi thành đơn");
        }
        if (baoGia.getTrangThai() == 4) {
            throw new RuntimeException("Báo giá này đã bị từ chối/hủy, không thể tạo đơn");
        }
        if (baoGia.getTrangThai() == 2) {
            throw new RuntimeException("Báo giá này đã được chuyển thành đơn hàng trước đó");
        }
        kiemTraPhiVanChuyen(phiVanChuyen);

        Kho kho = null;
        if (khoXuatId != null) {
            kho = entityManager.find(Kho.class, khoXuatId);
        }
        if (kho == null) {
            throw new RuntimeException("Vui lòng cung cấp kho xuất hàng để có thể tạo đơn bán hàng chính thức");
        }
        KhoService.kiemTraKhoGiaoDich(kho, "Kho xuất hàng");

        // Cùng công thức tồn khả dụng với modal Gửi sang kho / đẩy tồn sàn: tồn − đang giữ − lượng chờ xuất của đơn khác
        List<Integer> bienTheBaoGia = baoGia.getChiTietDonBanHangs().stream()
                .map(ct -> ct.getBienTheSanPham().getId()).distinct().toList();
        Map<Integer, BigDecimal> khaDungKho = khaDungLoTheoKho(bienTheBaoGia).getOrDefault(kho.getId(), Map.of());
        Map<Integer, BigDecimal> choXuatKho = choXuatTheoKho(bienTheBaoGia, null).getOrDefault(kho.getId(), Map.of());
        for (ChiTietDonBanHang item : baoGia.getChiTietDonBanHangs()) {
            Integer btId = item.getBienTheSanPham().getId();
            BigDecimal conBanDuoc = khaDungKho.getOrDefault(btId, BigDecimal.ZERO)
                    .subtract(choXuatKho.getOrDefault(btId, BigDecimal.ZERO)).max(BigDecimal.ZERO);
            if (conBanDuoc.compareTo(item.getSoLuongDat()) < 0) {
                throw new CommonException("Sản phẩm [" + item.getBienTheSanPham().getMaSku() + "] không đủ hàng ở " + kho.getTenKho()
                        + ": cần " + item.getSoLuongDat().stripTrailingZeros().toPlainString()
                        + ", còn " + conBanDuoc.stripTrailingZeros().toPlainString() + " có thể bán. Không thể tạo đơn!");
            }
        }
        String baseSoDonHang = baoGia.getSoDonHang().replaceFirst("^BG", "SO");
        String newSoDonHang = baseSoDonHang;
        int version = 1;
        while (donBanHangRepository.findBySoDonHang(newSoDonHang).isPresent()) {
            newSoDonHang = baseSoDonHang + "-" + version;
            version++;
        }

        DonBanHang donMoi = DonBanHang.builder()
                .soDonHang(newSoDonHang)
                .loaiChungTu("don_ban_hang")
                .khachHang(baoGia.getKhachHang())
                .khoXuat(kho)
                .ngayDatHang(Instant.now())
                .trangThai(0)
                .tienHang(baoGia.getTienHang())
                .phiVanChuyen(phiVanChuyen != null ? phiVanChuyen : baoGia.getPhiVanChuyen())
                .trangThaiThanhToan("chua_thanh_toan")
                .diaChiGiaoHang(diaChi != null ? diaChi : baoGia.getDiaChiGiaoHang())
                .ghiChu(ghiChu != null ? ghiChu : baoGia.getGhiChu())
                .nguoiTao(baoGia.getNguoiTao())
                .build();

        donMoi.setTongCong(donMoi.getTienHang().add(donMoi.getPhiVanChuyen()));
        // Chốt đơn từ báo giá: chụp thuế GTGT theo ngày chốt
        thueGtgtService.chup(donMoi, null);
        repository.save(donMoi);

        for (ChiTietDonBanHang itemBaoGia : baoGia.getChiTietDonBanHangs()) {
            ChiTietDonBanHang ctNew = ChiTietDonBanHang.builder()
                    .donBanHang(donMoi)
                    .bienTheSanPham(itemBaoGia.getBienTheSanPham())
                    .soLuongDat(itemBaoGia.getSoLuongDat())
                    .soLuongDaGiao(BigDecimal.ZERO)
                    .donGia(itemBaoGia.getDonGia())
                    .thanhTien(itemBaoGia.getThanhTien())
                    .ghiChu(itemBaoGia.getGhiChu())
                    .build();
            chiTietDonBanHangRepository.save(ctNew);
        }

        baoGia.setTrangThai(2); // Đã chốt đơn
        repository.save(baoGia);
    }

    @Transactional
    public void rejectQuote(Integer id, String reason) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy báo giá"));
        kiemTraPhamVi(don);
        if (!"bao_gia".equals(don.getLoaiChungTu())) {
            throw new RuntimeException("Chỉ áp dụng từ chối cho loại chứng từ báo giá");
        }
        // Báo giá đã chuyển thành đơn (2) hoặc đã từ chối (4) thì không từ chối lại (cùng quy tắc với chuyển thành đơn)
        if (Integer.valueOf(2).equals(don.getTrangThai())) {
            throw new CommonException("Báo giá này đã được chuyển thành đơn hàng, không thể từ chối");
        }
        if (Integer.valueOf(4).equals(don.getTrangThai())) {
            throw new CommonException("Báo giá này đã bị từ chối trước đó");
        }

        don.setTrangThai(4); // 4 = Hủy / Từ chối
        don.setLyDoTuChoi(reason);
        repository.save(don);
    }

    private String generateMaChungTu(String type) {
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        String prefix = "bao_gia".equals(type) ? "BG" + dateStr : "SO" + dateStr;
        return SoChungTu.tiepTheo(prefix, ((DonBanHangRepository) repository).soDuoiLonNhat(prefix));
    }

    @Transactional(readOnly = true)
    public List<BienTheSanPhamSelectDto> getActiveVariantsForSale() {
        return bienTheSanPhamRepository
                .findByTrangThai(1)
                .stream()
                .map(v -> BienTheSanPhamSelectDto.builder()
                        .id(v.getId())
                        .maBienThe(v.getMaSku())
                        .tenSanPham(v.getSanPham().getTenSanPham())
                        .giaBan(v.getGiaBan())
                        .tenMau(v.getMauSac() != null ? v.getMauSac().getTenMau() : null)
                        .maMauHex(v.getMauSac() != null ? v.getMauSac().getMaMauHex() : null)
                        .tenSize(v.getSize() != null ? v.getSize().getTenSize() : null)
                        .tenChatLieu(v.getChatLieu() != null ?
                                v.getChatLieu().getTenChatLieu() : null)
                        .maVachSku(v.getMaVachSku())
                        .sanPhamId(v.getSanPham().getId())
                        .build())
                .toList();
    }

    private String generateSoDonHang() {
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        String prefix = "SO" + dateStr;
        return SoChungTu.tiepTheo(prefix, ((DonBanHangRepository) repository).soDuoiLonNhat(prefix));
    }

    private boolean isDuplicateSoDonHang(Exception ex) {
        Throwable cause = ex;
        while (cause != null) {
            if (cause.getMessage() != null && cause.getMessage().contains("uk_don_ban_hang_so_don_hang")) return true;
            cause = cause.getCause();
        }
        return false;
    }
    @Transactional
    public void markAsDelivered(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn bán"));
        kiemTraPhamVi(don);
        // Chỉ cho phép xác nhận Giao thành công khi toàn bộ hàng đã được kho xuất đi
        if (don.getTrangThai() != 3) {
            throw new RuntimeException("Đơn hàng chưa được xuất kho đầy đủ, không thể đánh dấu hoàn thành");
        }
        // Cập nhật số lượng đã giao cho các chi tiết đơn hàng
        List<ChiTietDonBanHang> chiTietList = chiTietDonBanHangRepository.findByDonBanHangId(don.getId());
        for (ChiTietDonBanHang ct : chiTietList) {
            ct.setSoLuongDaGiao(ct.getSoLuongDat());
            chiTietDonBanHangRepository.save(ct);
        }

        don.setTrangThai(5); // 5 = Hoàn thành / Đã giao thành công
        // Đơn cũ xuất kho trước khi có mốc ngày giao: lấy thời điểm xác nhận giao thành công
        if (don.getNgayGiaoHang() == null) {
            don.setNgayGiaoHang(Instant.now());
        }
        repository.save(don);
        // Khiếu nại số lượng / chất lượng tính từ ngày giao (Luật Thương mại Điều 318): giữ bằng chứng đóng gói tới
        // ngày giao + hạn lưu (ngày xuất kho + hạn lưu có thể sớm hơn nếu giao chậm)
        bangChungDongGoiService.giaHanLuuTu(don.getId(), don.getNgayGiaoHang());
    }
    @Transactional
    public void returnOrder(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn bán"));
        kiemTraPhamVi(don);

        // Chỉ cho phép hoàn trả khi đơn đang ở trạng thái đã xuất kho (2, 3)
        if (don.getTrangThai() != 2 && don.getTrangThai() != 3) {
            throw new RuntimeException("Chỉ có thể hoàn trả đơn hàng đã xuất kho");
        }

        // Kiểm tra xem đơn hàng đã có phiếu xuất kho nào hoàn thành chưa
        boolean hasCompletedExport = phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThai(id, 3);
        if (!hasCompletedExport) {
            throw new RuntimeException("Đơn hàng chưa có phiếu xuất kho nào hoàn thành, không có hàng để hoàn trả");
        }

        // Chuyển trạng thái thành Bị hoàn trả (6)
        don.setTrangThai(6);
        repository.save(don);
        // Phải thu về 0: tiền đã thu thành Cần hoàn tiền
        thanhToanDonBanService.tinhLaiSauDoiDon(don);
        // Đơn bị hoàn trả là lúc cần đối chứng: giữ bằng chứng đóng gói thêm một hạn lưu tính từ hôm nay
        bangChungDongGoiService.giaHanLuuTu(don.getId(), Instant.now());
    }

    @Transactional(readOnly = true)
    public DonBanHangKpiHomNayDto getKpiHomNay() {
        Long tong = donBanHangRepository.countOrdersToday();
        Long choXuLy = donBanHangRepository.countOrdersChoXuLy();
        Long dangXuLy = donBanHangRepository.countPendingSaleOrders();
        Long doanhThu = donBanHangRepository.sumRevenueToday();

        return DonBanHangKpiHomNayDto.builder()
                .tongDonHomNay(tong != null ? tong : 0L)
                .choXuLy(choXuLy != null ? choXuLy : 0L)
                .dangXuLy(dangXuLy != null ? dangXuLy : 0L)
                .giaTriDonHomNay(doanhThu != null ? BigDecimal.valueOf(doanhThu) : BigDecimal.ZERO)
                .build();
    }
}
