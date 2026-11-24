package com.dev.backend.services.impl.entities;

import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.i18n.LoiChungException;
import com.dev.backend.i18n.TuChoiTruyCapException;
import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FilterLogicType;
import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.dto.response.customize.BienTheSanPhamSelectDto;
import com.dev.backend.dto.response.customize.ChiTietTonKhoKhaDungDto;
import com.dev.backend.dto.response.customize.DonBanHangDetailResponse;
import com.dev.backend.dto.response.customize.DonBanHangKpiHomNayDto;
import com.dev.backend.dto.response.customize.KhoKhaDungDto;
import com.dev.backend.dto.response.customize.PhieuXuatKhoSummaryDto;
import com.dev.backend.dto.response.customize.ThanhToanTaiQuayDto;
import com.dev.backend.dto.response.customize.ThieuTonKhoXuatDto;
import com.dev.backend.dto.response.customize.TongQuanMuaHangKhachDto;
import com.dev.backend.dto.response.entities.ChiTietDonBanHangDto;
import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.mapper.ChiTietDonBanHangMapper;
import com.dev.backend.mapper.DonBanHangMapper;
import com.dev.backend.mapper.PhieuXuatKhoMapper;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.kiemke.KhoaKiemKeGuard;
import com.dev.backend.utils.ShopeeWaybillMetadataHelper;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.dev.backend.dto.response.customize.LazadaOrderTrackingDto;
import com.dev.backend.dto.response.customize.VanDonSanDto;
import com.dev.backend.utils.BarcodeHelper;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.lazada.LazadaClient;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import com.dev.backend.event.InventoryRestockedEvent;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.impl.multitable.GiuChoChuyenKhoService;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import com.dev.backend.services.multitable.BangChungDongGoiService;
import com.dev.backend.services.multitable.NhatHangService;
import lombok.extern.slf4j.Slf4j;
import com.dev.backend.utils.SauCommit;
import com.dev.backend.utils.SoDienThoai;
import com.dev.backend.utils.TuKhoaTimKiem;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Lazy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Slf4j
@Service
public class DonBanHangService extends BaseServiceImpl<DonBanHang, Integer> {

    /** Trạng thái phiếu nhặt hàng còn hoạt động: đơn thuộc các phiếu này bị khóa, không được hủy. */
    private static final Set<String> PHIEU_NHAT_DANG_HOAT_DONG = Set.of("cho_nhat", "dang_nhat", "da_nhat");

    /** Giá trị cột loai_chung_tu của đơn bán. */
    static final String LOAI_CHUNG_TU_DON_BAN = "don_ban_hang";

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private DonBanHangMapper donBanHangMapper;

    @Autowired
    private ChiTietDonBanHangMapper chiTietDonBanHangMapper;

    @Autowired
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @Autowired(required = false)
    private ThongBaoXuatKhoService thongBaoXuatKhoService;

    /** Phần đang kiểm kê theo mã ở kho (gợi ý kho khi gửi đơn sang kho); null khi unit test dựng tay. */
    @Autowired(required = false)
    private KhoaKiemKeGuard khoaKiemKeGuard;

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
    private BangChungDongGoiService bangChungDongGoiService;

    @Autowired
    private ThueGtgtService thueGtgtService;

    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private GiuChoChuyenKhoService giuChoChuyenKhoService;

    @Autowired
    @Lazy
    private KenhBanHangService kenhBanHangService;

    @Autowired
    private LazadaClient lazadaClient;

    @Autowired(required = false)
    private com.dev.backend.services.shopee.ShopeeClient shopeeClient;

    @Autowired(required = false)
    private com.dev.backend.services.shopify.ShopifyOrderRoutingService shopifyOrderRoutingService;

    /** Quản trị viên, hoặc quản lý kho được phân công ở một Kho tổng. */
    public boolean laQuanLyKhoTong(NguoiDungAuthInfo user) {
        if (user == null || user.getVaiTro() == null) return false;
        if (user.getVaiTro().contains(IRoleType.quan_tri_vien)) return true;
        if (!user.getVaiTro().contains(IRoleType.quan_ly_kho)) return false;
        if (user.getPhanQuyenNguoiDungKhos() == null) return false;
        for (var pq : user.getPhanQuyenNguoiDungKhos()) {
            if (pq == null || pq.getKho() == null) continue;
            if (pq.getTrangThai() != null && pq.getTrangThai() != 1) continue;
            if (KhoService.KHO_TONG.equals(pq.getKho().getLoaiKho())) {
                return true;
            }
            if (pq.getKho().getLoaiKho() == null && pq.getKho().getId() != null && khoRepository != null) {
                boolean isTong = khoRepository.findById(pq.getKho().getId())
                        .map(KhoService::laKhoTong)
                        .orElse(false);
                if (isTong) return true;
            }
        }
        return false;
    }

    /** Cô lập quyền gửi sang kho: QTV và NVBH giữ nguyên; Quản lý Kho Tổng chỉ được điều tiết đơn Shopify. */
    boolean duocDieuTietDonSan(DonBanHang don, NguoiDungAuthInfo user) {
        if (user == null) return true;
        Set<String> roles = user.getVaiTro() != null ? user.getVaiTro() : Collections.emptySet();
        if (roles.contains(IRoleType.quan_tri_vien) || roles.contains(IRoleType.nhan_vien_ban_hang)) {
            return true;
        }
        return roles.contains(IRoleType.quan_ly_kho)
                && don != null
                && don.getKenhBanHang() != null
                && OmnichannelOrderSyncJob.isShopify(don.getKenhBanHang().getMaKenh())
                && laQuanLyKhoTong(user);
    }

    /** Đơn Shopee đang chờ xác nhận (UNPAID): chỉ cho phép xem lại, chưa mở gửi kho / hủy / in vận đơn. */
    public static boolean laDonShopeeChoXacNhan(DonBanHang don) {
        if (don == null || don.getKenhBanHang() == null) return false;
        if (!OmnichannelOrderSyncJob.isShopee(don.getKenhBanHang().getMaKenh())) return false;
        boolean dangNhap = don.getTrangThai() == null || Integer.valueOf(ITrangThaiDonBanHang.NHAP).equals(don.getTrangThai());
        return dangNhap
                && don.getGhiChu() != null
                && don.getGhiChu().contains(OmnichannelOrderSyncJob.TAG_SHOPEE_CHO_XAC_NHAN);
    }


    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public DonBanHangService(DonBanHangRepository repository) {
        super(repository);
    }

    /** Trường lọc ảo tuKhoa (ô tìm toàn hệ thống, ô tìm trang Đơn bán): tách ra, phần còn lại lọc như cũ. */
    @Override
    protected Specification<DonBanHang> createSpecification(List<FilterCriteria> filters) {
        TuKhoaTimKiem.Tach tach = TuKhoaTimKiem.tach(filters);
        if (!tach.coTruong()) {
            return super.createSpecification(filters);
        }
        Specification<DonBanHang> conLai = super.createSpecification(tach.conLai());
        return tach.tuKhoa() == null ? conLai : conLai.and(theoTuKhoa(tach.tuKhoa(), tach.chinhXac()));
    }

    /**
     * Đơn khớp từ khóa: số đơn, mã đơn sàn; qua khách: số điện thoại đã bỏ ký tự ngăn cách (khi từ khóa có
     * dáng số điện thoại) và tên khách (chỉ khi tìm "chứa"). Khách dùng EXISTS, không join, để đơn không có khách vẫn
     * được tìm theo số đơn.
     */
    static Specification<DonBanHang> theoTuKhoa(String tuKhoa, boolean chinhXac) {
        String mau = TuKhoaTimKiem.mau(tuKhoa, chinhXac);
        String sdt = SoDienThoai.choTimKiem(tuKhoa);
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> hoac = new ArrayList<>();
            hoac.add(TuKhoaTimKiem.like(cb, root.get("soDonHang"), mau));
            hoac.add(TuKhoaTimKiem.like(cb, root.get("maDonHangKenh"), mau));

            List<jakarta.persistence.criteria.Predicate> theoKhach = new ArrayList<>();
            jakarta.persistence.criteria.Subquery<Integer> khach = query.subquery(Integer.class);
            Root<KhachHang> kh = khach.from(KhachHang.class);
            if (sdt != null) {
                Expression<String> cotSdt = TuKhoaTimKiem.boNganCach(cb, kh.get("soDienThoai"));
                theoKhach.add(chinhXac ? cb.equal(cotSdt, sdt) : cb.like(cotSdt, "%" + TuKhoaTimKiem.thoat(sdt) + "%", TuKhoaTimKiem.KY_TU_THOAT));
            }
            if (!chinhXac) {
                theoKhach.add(TuKhoaTimKiem.like(cb, kh.get("tenKhachHang"), mau));
            }
            if (!theoKhach.isEmpty()) {
                khach.select(kh.get("id")).where(
                        cb.equal(kh.get("id"), root.get("khachHang").get("id")),
                        cb.or(theoKhach.toArray(new jakarta.persistence.criteria.Predicate[0])));
                hoac.add(cb.exists(khach));
            }
            return cb.or(hoac.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DonBanHang> filter(BaseFilterRequest request) {
        List<FilterCriteria> filters = request.getFilters() == null
                ? new ArrayList<>()
                : new ArrayList<>(request.getFilters());

        // Chuẩn hóa bộ lọc yeuCauHuy sang ghiChu chứa [KHÁCH YÊU CẦU HỦY]
        for (int i = 0; i < filters.size(); i++) {
            FilterCriteria fc = filters.get(i);
            if (fc != null && "yeuCauHuy".equalsIgnoreCase(fc.getFieldName())) {
                filters.set(i, FilterCriteria.builder()
                        .fieldName("ghiChu")
                        .operation(FilterOperation.LIKE)
                        .value("[KHÁCH YÊU CẦU HỦY]")
                        .build());
            }
        }

        List<FilterCriteria> phamVi = dieuKienPhamViTheoVaiTro(SecurityContextHolder.getUser());
        if (!phamVi.isEmpty()) {
            filters.addAll(phamVi);
        }
        request.setFilters(filters);
        return super.filter(request);
    }

    /**
     * Điều kiện phạm vi theo vai trò của người dùng hiện tại, thêm vào mọi truy vấn đơn bán.
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

    private static void kiemTraPhamVi(DonBanHang don) {
        if (!trongPhamVi(don, SecurityContextHolder.getUser())) {
            throw new CommonException(HttpStatus.FORBIDDEN, ThongDiep.of("banHang.donNgoaiPhamVi", don.getSoDonHang()));
        }
    }

    /**
     * Số tổng hợp đơn bán của một khách (trang chi tiết khách hàng): tổng chi tiêu, số đơn, trung bình, đơn gần nhất.
     * Chỉ tính chứng từ đơn bán và cùng phạm vi vai trò với danh sách đơn ({@link #filter}). Quy tắc đơn đã đặt / tính
     * chi tiêu / trừ tiền trả hàng ở {@link TinhMuaHangKhach} (dùng chung với danh sách khách hàng).
     */
    @Transactional(readOnly = true)
    public TongQuanMuaHangKhachDto tongQuanMuaHangCuaKhach(Integer khachHangId) {
        Specification<DonBanHang> spec = phamViDonCuaKhach(List.of(khachHangId));

        // Một truy vấn gom theo trạng thái và có / không gắn kênh: số đơn và tổng tiền của từng nhóm
        List<TinhMuaHangKhach.Dong> dong = new ArrayList<>();
        for (Tuple row : gomDonTheoNhom(spec)) {
            dong.add(new TinhMuaHangKhach.Dong(row.get(0, Integer.class), row.get(1) != null,
                    soNguyen(row.get(2, Long.class)), soTien(row.get(3, BigDecimal.class))));
        }
        BigDecimal tienTraHang = tienTraHangTheoKhach(spec).getOrDefault(khachHangId, BigDecimal.ZERO);

        // Đơn đã đặt gần nhất (bỏ đơn nháp tạo tay; đơn sàn chờ xử lý vẫn tính)
        Specification<DonBanHang> daDat = spec.and((r, q, c) -> TinhMuaHangKhach.daDat(r, c));
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

        // Kênh khách đã mua qua (đơn đã đặt): nối trái để đếm cả đơn không gắn kênh
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
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

        TongQuanMuaHangKhachDto ketQua = tongHopMuaHang(dong, tienTraHang, donGanNhat);
        ketQua.setKenhMua(kenhMua);
        return ketQua;
    }

    /**
     * Lần mua gần nhất của nhiều khách một lúc (danh sách khách hàng, một trang): ngày đặt mới nhất của đơn đã đặt.
     * Cùng quy tắc đơn đã đặt và phạm vi vai trò với {@link #tongQuanMuaHangCuaKhach} (khớp ô "Lần mua gần nhất" ở trang
     * chi tiết). Khách không có đơn trong phạm vi thì không có trong kết quả. Một truy vấn gom cho cả trang.
     */
    @Transactional(readOnly = true)
    public Map<Integer, Instant> lanMuaGanNhatTheoKhach(Collection<Integer> khachHangIds) {
        List<Integer> ids = khachHangIds == null ? List.of()
                : khachHangIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) return Map.of();
        Specification<DonBanHang> spec = phamViDonCuaKhach(ids);

        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<DonBanHang> root = cq.from(DonBanHang.class);
        Path<Integer> idKhach = root.get("khachHang").get("id");
        cq.multiselect(idKhach, cb.greatest(root.<Instant>get("ngayDatHang")))
                .where(spec.toPredicate(root, cq, cb), TinhMuaHangKhach.daDat(root, cb))
                .groupBy(idKhach);
        Map<Integer, Instant> ketQua = new HashMap<>();
        for (Tuple row : entityManager.createQuery(cq).getResultList()) {
            Instant ngay = row.get(1, Instant.class);
            if (ngay != null) ketQua.put(row.get(0, Integer.class), ngay);
        }
        return ketQua;
    }

    /** Đơn bán của các khách, trong phạm vi vai trò của người đang xem. */
    private Specification<DonBanHang> phamViDonCuaKhach(List<Integer> khachHangIds) {
        List<FilterCriteria> filters = new ArrayList<>();
        filters.add(khachHangIds.size() == 1
                ? FilterCriteria.builder().fieldName("khachHang.id").operation(FilterOperation.EQUALS)
                        .value(khachHangIds.get(0)).build()
                : FilterCriteria.builder().fieldName("khachHang.id").operation(FilterOperation.IN)
                        .value(new ArrayList<>(khachHangIds)).build());
        filters.add(FilterCriteria.builder()
                .fieldName("loaiChungTu").operation(FilterOperation.EQUALS).value(LOAI_CHUNG_TU_DON_BAN).build());
        filters.addAll(dieuKienPhamViTheoVaiTro(SecurityContextHolder.getUser()));
        return createSpecification(filters);
    }

    /**
     * Gom đơn theo trạng thái và kênh (nối trái: id kênh null = không gắn kênh). Mỗi dòng: [trạng thái, id kênh, số đơn,
     * tổng tiền].
     */
    private List<Tuple> gomDonTheoNhom(Specification<DonBanHang> spec) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<DonBanHang> root = cq.from(DonBanHang.class);
        Join<DonBanHang, KenhBanHang> kenh = root.join("kenhBanHang", JoinType.LEFT);
        Path<Integer> trangThai = root.get("trangThai");
        Path<Integer> idKenh = kenh.get("id");
        cq.multiselect(trangThai, idKenh, cb.count(root), cb.sum(root.<BigDecimal>get("tongCong")))
                .where(spec.toPredicate(root, cq, cb))
                .groupBy(trangThai, idKenh);
        return entityManager.createQuery(cq).getResultList();
    }

    /**
     * Tiền đã hoàn cho khách qua phiếu trả hàng tại quầy, theo khách: chỉ phiếu của đơn tính chi tiêu (đơn đã hủy / bị
     * hoàn trả vốn không tính, trừ thêm sẽ thành trừ hai lần).
     */
    private Map<Integer, BigDecimal> tienTraHangTheoKhach(Specification<DonBanHang> spec) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<PhieuTraHang> phieu = cq.from(PhieuTraHang.class);
        Root<DonBanHang> don = cq.from(DonBanHang.class);
        Path<Integer> idKhach = don.get("khachHang").get("id");
        cq.multiselect(idKhach, cb.sum(phieu.<BigDecimal>get("tongTienHoan")))
                .where(cb.equal(phieu.get("donBanHangId"), don.get("id")),
                        spec.toPredicate(don, cq, cb),
                        TinhMuaHangKhach.tinhChiTieu(don, cb))
                .groupBy(idKhach);
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        for (Tuple row : entityManager.createQuery(cq).getResultList()) {
            ketQua.put(row.get(0, Integer.class), soTien(row.get(1, BigDecimal.class)));
        }
        return ketQua;
    }

    private static long soNguyen(Long so) {
        return so == null ? 0 : so;
    }

    private static BigDecimal soTien(BigDecimal tien) {
        return tien == null ? BigDecimal.ZERO : tien;
    }

    /**
     * Quy tắc tính (tách riêng để kiểm thử), xem {@link TinhMuaHangKhach}: đơn nháp tạo tay không tính vào số đơn (đơn
     * nháp có kênh là đơn sàn chờ xử lý, vẫn tính); đơn đã hủy và bị hoàn trả vẫn là đơn đã đặt nhưng không tính vào chi
     * tiêu; tiền trả hàng tại quầy trừ khỏi tổng chi tiêu, trung bình tính trên tổng đã trừ.
     */
    static TongQuanMuaHangKhachDto tongHopMuaHang(List<TinhMuaHangKhach.Dong> dong, BigDecimal tienTraHang,
                                                 TongQuanMuaHangKhachDto.DonGanNhat donGanNhat) {
        long soDonNhap = 0;
        long soDonHuy = 0;
        long soDonHoanTra = 0;
        long soDonTinhChiTieu = 0;
        long soDonDangXuLy = 0;
        BigDecimal tongTien = BigDecimal.ZERO;

        for (TinhMuaHangKhach.Dong d : dong == null ? List.<TinhMuaHangKhach.Dong>of() : dong) {
            int tt = TinhMuaHangKhach.trangThai(d.trangThai());
            if (tt != ITrangThaiDonBanHang.HOAN_THANH && tt != ITrangThaiDonBanHang.DA_HUY
                    && tt != ITrangThaiDonBanHang.BI_HOAN_TRA) {
                soDonDangXuLy += d.soDon();
            }
            if (!TinhMuaHangKhach.laDaDat(d.trangThai(), d.coKenh())) {
                soDonNhap += d.soDon();
            } else if (tt == ITrangThaiDonBanHang.DA_HUY) {
                soDonHuy += d.soDon();
            } else if (tt == ITrangThaiDonBanHang.BI_HOAN_TRA) {
                soDonHoanTra += d.soDon();
            } else {
                soDonTinhChiTieu += d.soDon();
                if (d.tongTien() != null) tongTien = tongTien.add(d.tongTien());
            }
        }

        BigDecimal tra = tienTraHang == null ? BigDecimal.ZERO : tienTraHang;
        BigDecimal tongChiTieu = TinhMuaHangKhach.truTraHang(tongTien, tra);
        return TongQuanMuaHangKhachDto.builder()
                .soDonDat(soDonTinhChiTieu + soDonHuy + soDonHoanTra)
                .soDonTinhChiTieu(soDonTinhChiTieu)
                .soDonHuy(soDonHuy)
                .soDonHoanTra(soDonHoanTra)
                .soDonNhap(soDonNhap)
                .soDonDangXuLy(soDonDangXuLy)
                .tongChiTieu(tongChiTieu)
                .tienTraHang(tra)
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
                .orElseThrow(() -> new LoiChungException(ThongDiep.of("banHang.donBanKhongTimThay")));
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

        // Tự động căn chỉnh trạng thái đơn bán theo phiếu xuất kho (Self-healing):
        // Nếu đơn đang ở DA_XUAT_TOAN_BO (3), nhưng phiếu xuất kho thực tế vẫn đang ở CHO_XUAT (6)
        // và chưa có phiếu nào xuất thực tế (DA_XUAT), thì khôi phục đơn về DA_DONG_GOI (8 - Chờ xuất kho)
        if (don.getTrangThai() != null && don.getTrangThai() == ITrangThaiDonBanHang.DA_XUAT_TOAN_BO) {
            boolean coPhieuChoXuat = phieuList.stream().anyMatch(p -> p.getTrangThai() != null && p.getTrangThai() == ITrangThaiPhieuXuat.CHO_XUAT);
            boolean coPhieuDaXuat = phieuList.stream().anyMatch(p -> p.getTrangThai() != null && p.getTrangThai() == ITrangThaiPhieuXuat.DA_XUAT);
            if (coPhieuChoXuat && !coPhieuDaXuat) {
                don.setTrangThai(ITrangThaiDonBanHang.DA_DONG_GOI);
                don.setNgayCapNhat(Instant.now());
                repository.save(don);
                log.info("[DON-HANG] Tự động căn chỉnh đơn {} về Chờ xuất kho (8) vì phiếu xuất kho đang ở trạng thái Chờ xác nhận", don.getSoDonHang());
                donDto = donBanHangMapper.toDto(don);
            }
        }
        lamGiauThongTinVanDonSan(don, donDto);

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
        com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta routingMeta = null;
        if (shopifyOrderRoutingService != null && don.getKenhBanHang() != null
                && OmnichannelOrderSyncJob.isShopify(don.getKenhBanHang().getMaKenh())
                && don.getMaDonHangKenh() != null) {
            routingMeta = shopifyOrderRoutingService.find(don.getMaDonHangKenh()).orElse(null);
        }
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        boolean choXacNhanSan = laDonShopeeChoXacNhan(don);
        boolean coTheGuiKho = !choXacNhanSan
                && Integer.valueOf(ITrangThaiDonBanHang.NHAP).equals(don.getTrangThai())
                && duocDieuTietDonSan(don, currentUser);

        return DonBanHangDetailResponse.builder()
                .donBanHang(donDto)
                .chiTiet(chiTietDtos)
                .phieuXuatKhoList(phieuDtos)
                .phieuNhatHangId(phieuNhat != null ? phieuNhat.getId() : null)
                .maPickList(phieuNhat != null ? phieuNhat.getMaPickList() : null)
                .trangThaiPhieuNhat(phieuNhat != null ? phieuNhat.getTrangThai() : null)
                .thanhToanTaiQuay(thanhToanTaiQuay)
                .khoDeXuatId(routingMeta != null ? routingMeta.getKhoDeXuatId() : null)
                .tenKhoDeXuat(routingMeta != null ? routingMeta.getTenKhoDeXuat() : null)
                .phuongThucGiaoSan(routingMeta != null ? routingMeta.getDeliveryMethodType() : null)
                .tachNhieuKhoSan(routingMeta != null && routingMeta.isSplitMultiLocation())
                .coTheGuiSangKho(coTheGuiKho)
                .choXacNhanSan(choXacNhanSan)
                .thieuTonKhoXuat(Integer.valueOf(ITrangThaiDonBanHang.CHO_NHAT_HANG).equals(don.getTrangThai())
                        ? tinhThieuTonTaiKho(don, don.getKhoXuat())
                        : null)
                .build();
    }

    /** Làm giàu dữ liệu vận đơn, mã chia chọn tuyến và nhãn thanh toán COD/Ví điện tử lên DTO chi tiết đơn bán. */
    private void lamGiauThongTinVanDonSan(DonBanHang don, DonBanHangDto dto) {
        if (don == null || dto == null) {
            return;
        }
        boolean laSan = don.getKenhBanHang() != null
                || (don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank());
        if (!laSan) {
            return;
        }
        String ghiChu = don.getGhiChu();
        String orderSn = don.getMaDonHangKenh();

        if (ShopeeWaybillMetadataHelper.isFakeShopeeTracking(dto.getMaVanDon(), orderSn)) {
            dto.setMaVanDon(ShopeeWaybillMetadataHelper.extractTracking(ghiChu, orderSn));
        }
        if (dto.getDonViVanChuyen() == null || dto.getDonViVanChuyen().isBlank()) {
            dto.setDonViVanChuyen(ShopeeWaybillMetadataHelper.extractCarrier(ghiChu));
        }
        if (dto.getMaKienHang() == null || dto.getMaKienHang().isBlank()) {
            dto.setMaKienHang(ShopeeWaybillMetadataHelper.extractTag(ghiChu, ShopeeWaybillMetadataHelper.TAG_KIEN));
        }
        if (dto.getMaDinhTuyen() == null || dto.getMaDinhTuyen().isBlank()) {
            dto.setMaDinhTuyen(ShopeeWaybillMetadataHelper.extractTag(ghiChu, ShopeeWaybillMetadataHelper.TAG_TUYEN));
        }
        if (dto.getMaTramPhat() == null || dto.getMaTramPhat().isBlank()) {
            dto.setMaTramPhat(ShopeeWaybillMetadataHelper.extractTag(ghiChu, ShopeeWaybillMetadataHelper.TAG_TRAM));
        }

        ShopeeWaybillMetadataHelper.PaymentSummary paymentSummary =
                ShopeeWaybillMetadataHelper.resolveOrderPaymentSummary(
                        ghiChu,
                        don.getTrangThaiThanhToan(),
                        don.getTongCong(),
                        laDonShopeeChoXacNhan(don)
                );
        dto.setTienThuHoCod(paymentSummary.tienThuHoCod());
        dto.setNhanThanhToan(paymentSummary.nhanThanhToan());
    }

    @Transactional(rollbackFor = Exception.class)
    public void sendToWarehouse(Integer id) {
        sendToWarehouse(id, null, false);
    }

    @Transactional(rollbackFor = Exception.class)
    public void sendToWarehouse(Integer id, Integer khoId) {
        sendToWarehouse(id, khoId, false);
    }

    @Transactional(rollbackFor = Exception.class)
    public String sendToWarehouse(Integer id, Integer khoId, boolean thuCongKhiLoi) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new CommonException(ThongDiep.of("banHang.donBanKhongTimThayVoiId", id), HttpStatus.NOT_FOUND, null));
        kiemTraPhamVi(don);
        NguoiDungAuthInfo nguoiGuiKho = SecurityContextHolder.getUser();
        if (!duocDieuTietDonSan(don, nguoiGuiKho)) {
            boolean laQlk = nguoiGuiKho != null && nguoiGuiKho.getVaiTro() != null
                    && nguoiGuiKho.getVaiTro().contains(IRoleType.quan_ly_kho);
            throw new TuChoiTruyCapException(laQlk
                    ? ThongDiep.of("banHang.chiQlKhoTongMoiDieuTietShopify")
                    : ThongDiep.of("banHang.qlKhoChiNhanhKhongGuiDonKhac"));
        }

        if (laDonShopeeChoXacNhan(don)) {
            throw new CommonException(ThongDiep.of("banHang.donShopeeChoXacNhanKhongGuiKho"), HttpStatus.BAD_REQUEST, null);
        }

        if (don.getTrangThai() == null || don.getTrangThai() != 0) {
            throw new CommonException(ThongDiep.of("banHang.chiDonNhapDuocGuiKho"), HttpStatus.BAD_REQUEST, null);
        }

        Kho khoChon;
        String canhBaoThieuTon = null;
        boolean donBaSanTrucTiep = laDonBaSan(don) && !thuCongKhiLoi;
        if (donBaSanTrucTiep) {
            Kho khoHienTai = don.getKhoXuat();
            if (khoHienTai == null) {
                throw new LoiCoMaException(
                        HttpStatus.CONFLICT,
                        MaLoi.DON_SAN_CAN_CHON_KHO_THU_CONG,
                        ThongDiep.of("banHang.donSanCanChonKhoThuCong", "Chưa có kho xuất")
                );
            }
            if (khoId != null && !khoId.equals(khoHienTai.getId())) {
                throw new CommonException(
                        ThongDiep.of("banHang.donSanChiGuiKhoHienTai", khoHienTai.getTenKho()),
                        HttpStatus.BAD_REQUEST,
                        null
                );
            }
            if (!Integer.valueOf(1).equals(khoHienTai.getTrangThai()) || KhoService.laKhoAo(khoHienTai)) {
                throw new LoiCoMaException(
                        HttpStatus.CONFLICT,
                        MaLoi.DON_SAN_CAN_CHON_KHO_THU_CONG,
                        ThongDiep.of("banHang.donSanCanChonKhoThuCong", khoHienTai.getTenKho()),
                        Map.of("khoId", khoHienTai.getId(), "tenKho", khoHienTai.getTenKho(), "lyDo", "kho_khong_hoat_dong")
                );
            }
            ThieuTonKhoXuatDto thieuTon = tinhThieuTonTaiKho(don, khoHienTai);
            if (thieuTon != null) {
                // Vẫn gửi đơn sang kho hiện tại; màn chi tiết đơn hiện dải cảnh báo kể từng dòng thiếu cho tới khi kho đủ hàng
                canhBaoThieuTon = thieuTon.getDotKiemKeToanKho() != null
                        ? ThongDiep.dich("banHang.donSanKhoXuatDangKiemKe", khoHienTai.getTenKho(), thieuTon.getDotKiemKeToanKho())
                        : ThongDiep.dich("banHang.donSanKhongDuTonTaiKhoHienTai", khoHienTai.getTenKho(), thieuTon.getDong().size());
            }
            khoChon = khoHienTai;
        } else if (khoId != null) {
            khoChon = khoRepository.findById(khoId)
                    .orElseThrow(() -> new CommonException(ThongDiep.of("banHang.khoXuatKhongTimThay", khoId), HttpStatus.NOT_FOUND, null));
        } else if (don.getKhoXuat() != null) {
            khoChon = don.getKhoXuat();
        } else if (don.getKenhBanHang() != null) {
            Kho routed = kenhBanHangDongBoService != null
                    ? kenhBanHangDongBoService.resolveKhoXuatChoDonSan(don.getKenhBanHang(), null)
                    : null;
            khoChon = routed != null ? routed : khoRepository.findByTrangThai(1).stream()
                    .filter(KhoService::laKhoTong)
                    .findFirst()
                    .orElseThrow(() -> new CommonException(ThongDiep.of("banHang.khongCoKhoTongHoatDong"), HttpStatus.BAD_REQUEST, null));
        } else {
            Integer contextKhoId = SecurityContextHolder.getKhoId();
            khoChon = contextKhoId != null ? khoRepository.findById(contextKhoId).orElse(null) : null;
            if (khoChon == null) {
                throw new CommonException(ThongDiep.of("banHang.chonKhoXuat"), HttpStatus.BAD_REQUEST, null);
            }
        }
        // Kho đang hoạt động và không phải Kho Trung Chuyển (kho ảo)
        KhoService.kiemTraKhoGiaoDich(khoChon, "Kho xuất hàng");
        don.setKhoXuat(khoChon);

        don.setTrangThai(ITrangThaiDonBanHang.CHO_NHAT_HANG); // 1: Chờ nhặt hàng
        don.setNgayCapNhat(Instant.now());
        repository.save(don);

        if (don.getKenhBanHang() != null && OmnichannelOrderSyncJob.isShopify(don.getKenhBanHang().getMaKenh())
                && don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank()
                && kenhBanHangDongBoService != null) {
            String shopifyOrderId = don.getMaDonHangKenh();
            Integer khoChonId = khoChon.getId();
            SauCommit.chay("Đồng bộ điều tiết kho và gửi sang kho sang Shopify (in_progress)", () -> {
                kenhBanHangDongBoService.chuyenKhoShopifyTheoKhoFCentric(shopifyOrderId, khoChonId);
                kenhBanHangDongBoService.dongBoTrangThaiDangThucHienShopify(shopifyOrderId);
            });
        }

        if (don.getKenhBanHang() != null && OmnichannelOrderSyncJob.isShopee(don.getKenhBanHang().getMaKenh())
                && don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank()
                && kenhBanHangDongBoService != null) {
            String shopeeOrderId = don.getMaDonHangKenh();
            SauCommit.chay("Đồng bộ gửi sang kho sang Shopee (Người bán đang chuẩn bị hàng)",
                    () -> kenhBanHangDongBoService.dongBoTrangThaiChuanBiHangShopee(shopeeOrderId));
        }

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
        // Báo kho xuất có đơn chờ nhặt (dòng tóm tắt "N đơn chờ xuất"); đơn sàn thì số đơn chờ gửi sang kho giảm theo
        if (thongBaoXuatKhoService != null) {
            NguoiDungAuthInfo nguoiGui = SecurityContextHolder.getUser();
            thongBaoXuatKhoService.donGuiSangKho(don, nguoiGui == null ? null : nguoiGui.getId());
        }
        return canhBaoThieuTon;
    }

    /**
     * Truy vấn tồn khả dụng (Free to Use = On Hand - Outgoing) của các mặt hàng trong đơn hàng
     * tại tất cả các kho đang hoạt động, phục vụ việc lựa chọn kho tiếp nhận tối ưu.
     */
    @Transactional(readOnly = true)
    public List<KhoKhaDungDto> getKhoKhaDungChoDonHang(Integer donHangId) {
        DonBanHang don = repository.findById(donHangId)
                .orElseThrow(() -> new CommonException(ThongDiep.of("banHang.donHangKhongTimThayVoiId", donHangId), HttpStatus.NOT_FOUND, null));
        kiemTraPhamVi(don);

        List<ChiTietDonBanHang> chiTiets = chiTietDonBanHangRepository.findByDonBanHangId(donHangId);
        // Chỉ gợi ý kho nhận được đơn bán: bỏ Kho Trung Chuyển (kho ảo chứa hàng đang chuyển giữa các kho)
        List<Kho> activeKhos = khoRepository.findByTrangThai(1).stream()
                .filter(k -> !KhoService.laKhoAo(k))
                .toList();

        if (activeKhos == null || activeKhos.isEmpty()) {
            return Collections.emptyList();
        }

        com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta routingMeta = null;
        if (shopifyOrderRoutingService != null && don.getKenhBanHang() != null
                && OmnichannelOrderSyncJob.isShopify(don.getKenhBanHang().getMaKenh())
                && don.getMaDonHangKenh() != null) {
            routingMeta = shopifyOrderRoutingService.find(don.getMaDonHangKenh()).orElse(null);
        }
        Integer khoDeXuatId = routingMeta != null ? routingMeta.getKhoDeXuatId() : null;
        String phuongThucSan = routingMeta != null ? routingMeta.getDeliveryMethodType() : null;

        if (chiTiets == null || chiTiets.isEmpty()) {
            return activeKhos.stream().map(k -> {
                boolean laGoiY = khoDeXuatId != null && khoDeXuatId.equals(k.getId());
                return KhoKhaDungDto.builder()
                        .khoId(k.getId())
                        .maKho(k.getMaKho())
                        .tenKho(k.getTenKho())
                        .diaChi(k.getDiaChi())
                        .laKhoTong(KhoService.laKhoTong(k))
                        .duHang(true)
                        .soLuongMatHangDu(0)
                        .tongSoMatHang(0)
                        .chiTietTonKho(Collections.emptyList())
                        .goiYTuSan(laGoiY)
                        .phuongThucGiaoSan(laGoiY ? phuongThucSan : null)
                        .build();
            }).sorted(Comparator
                    .comparing((KhoKhaDungDto dto) -> Boolean.TRUE.equals(dto.getGoiYTuSan()), Comparator.reverseOrder())
                    .thenComparing(KhoKhaDungDto::getTenKho))
                    .toList();
        }

        List<Integer> bienTheIds = chiTiets.stream()
                .map(ct -> ct.getBienTheSanPham() != null ? ct.getBienTheSanPham().getId() : null)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        // 1. Tồn khả dụng theo lô (tồn − đang giữ) theo (kho, biến thể); 2. lượng chờ xuất của các đơn khác;
        // 3. phần đang kiểm kê ở các kho có đợt mở (không lấy được tới khi đợt kết thúc, như POS và chuyển kho)
        Map<Integer, Map<Integer, BigDecimal>> onHandMap = bienTheIds.isEmpty() ? Map.of() : khaDungLoTheoKho(bienTheIds);
        Map<Integer, Map<Integer, BigDecimal>> outgoingMap = bienTheIds.isEmpty() ? Map.of() : choXuatTheoKho(bienTheIds, donHangId);
        Map<Integer, KhoaKiemKeGuard.KiemKeTheoMa> kiemKeMap = new HashMap<>();
        if (khoaKiemKeGuard != null && !bienTheIds.isEmpty()) {
            for (Integer khoKiem : khoaKiemKeGuard.khoDangKiemKe()) {
                kiemKeMap.put(khoKiem, khoaKiemKeGuard.dangKiemKeTheoMa(khoKiem, bienTheIds));
            }
        }

        List<KhoKhaDungDto> results = new ArrayList<>();
        for (Kho kho : activeKhos) {
            Integer kId = kho.getId();
            Map<Integer, BigDecimal> khoOnHand = onHandMap.getOrDefault(kId, Collections.emptyMap());
            Map<Integer, BigDecimal> khoOutgoing = outgoingMap.getOrDefault(kId, Collections.emptyMap());
            KhoaKiemKeGuard.KiemKeTheoMa khoKiemKe = kiemKeMap.getOrDefault(kId, KhoaKiemKeGuard.KiemKeTheoMa.RONG);
            String maDotKiemKe = khoKiemKe.dotToanKho();

            int matHangDuCount = 0;
            List<ChiTietTonKhoKhaDungDto> itemDtos = new ArrayList<>();

            for (ChiTietDonBanHang ct : chiTiets) {
                BienTheSanPham bt = ct.getBienTheSanPham();
                Integer btId = bt != null ? bt.getId() : null;
                BigDecimal soLuongDat = ct.getSoLuongDat() != null ? ct.getSoLuongDat() : BigDecimal.ZERO;

                BigDecimal onHand = (btId != null) ? khoOnHand.getOrDefault(btId, BigDecimal.ZERO) : BigDecimal.ZERO;
                BigDecimal outgoing = (btId != null) ? khoOutgoing.getOrDefault(btId, BigDecimal.ZERO) : BigDecimal.ZERO;
                BigDecimal dangKiem = khoKiemKe.cua(btId);
                BigDecimal tonKhaDung = onHand.subtract(outgoing).subtract(dangKiem).max(BigDecimal.ZERO);
                if (maDotKiemKe == null && dangKiem.signum() > 0) maDotKiemKe = khoKiemKe.dotCuaMa().get(btId);

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
                        .soLuongDangKiemKe(dangKiem)
                        .build());
            }

            boolean allDuHang = matHangDuCount == chiTiets.size();
            boolean laGoiY = khoDeXuatId != null && khoDeXuatId.equals(kId);
            results.add(KhoKhaDungDto.builder()
                    .khoId(kId)
                    .maKho(kho.getMaKho())
                    .tenKho(kho.getTenKho())
                    .diaChi(kho.getDiaChi())
                    .laKhoTong(KhoService.laKhoTong(kho))
                    .duHang(allDuHang)
                    .soLuongMatHangDu(matHangDuCount)
                    .tongSoMatHang(chiTiets.size())
                    .chiTietTonKho(itemDtos)
                    .maDotKiemKe(maDotKiemKe)
                    .kiemToanKho(khoKiemKe.dotToanKho() != null)
                    .goiYTuSan(laGoiY)
                    .phuongThucGiaoSan(laGoiY ? phuongThucSan : null)
                    .build());
        }

        // Sắp xếp: Kho đủ hàng (duHang = true) -> kho Shopify gợi ý -> nhiều mặt hàng đủ hơn -> tên kho
        results.sort(Comparator
                .comparing(KhoKhaDungDto::getDuHang, Comparator.reverseOrder())
                .thenComparing((KhoKhaDungDto dto) -> Boolean.TRUE.equals(dto.getGoiYTuSan()), Comparator.reverseOrder())
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

    private static boolean laDonBaSan(DonBanHang don) {
        if (don == null || don.getKenhBanHang() == null) return false;
        String ma = don.getKenhBanHang().getMaKenh();
        return OmnichannelOrderSyncJob.isShopee(ma)
                || OmnichannelOrderSyncJob.isLazada(ma)
                || OmnichannelOrderSyncJob.isTikTok(ma);
    }

    /**
     * Tồn khả dụng của đơn tại kho xuất. Trả null nếu kho đủ hàng; ngược lại trả mọi biến thể thiếu (đã cộng các
     * dòng trùng biến thể), hoặc mã đợt kiểm kê đang khóa toàn kho. Tồn khả dụng = tồn theo lô − hàng các đơn khác
     * và phiếu chuyển kho đang giữ − phần đang kiểm kê.
     */
    private ThieuTonKhoXuatDto tinhThieuTonTaiKho(DonBanHang don, Kho kho) {
        if (kho == null || kho.getId() == null || chiTietDonBanHangRepository == null
                || tonKhoTheoLoRepository == null || don.getId() == null) {
            return null;
        }
        List<ChiTietDonBanHang> chiTiets = chiTietDonBanHangRepository.findByDonBanHangId(don.getId());
        if (chiTiets == null || chiTiets.isEmpty()) {
            return null;
        }
        Map<Integer, BigDecimal> canTheoBienThe = new LinkedHashMap<>();
        Map<Integer, BienTheSanPham> bienTheTheoId = new HashMap<>();
        for (ChiTietDonBanHang ct : chiTiets) {
            BienTheSanPham bt = ct.getBienTheSanPham();
            BigDecimal soLuongDat = ct.getSoLuongDat() != null ? ct.getSoLuongDat() : BigDecimal.ZERO;
            if (bt == null || bt.getId() == null || soLuongDat.signum() <= 0) {
                continue;
            }
            canTheoBienThe.merge(bt.getId(), soLuongDat, BigDecimal::add);
            bienTheTheoId.putIfAbsent(bt.getId(), bt);
        }
        if (canTheoBienThe.isEmpty()) {
            return null;
        }
        List<Integer> bienTheIds = new ArrayList<>(canTheoBienThe.keySet());
        Integer khoId = kho.getId();
        KhoaKiemKeGuard.KiemKeTheoMa khoKiemKe = khoaKiemKeGuard != null
                ? khoaKiemKeGuard.dangKiemKeTheoMa(khoId, bienTheIds)
                : KhoaKiemKeGuard.KiemKeTheoMa.RONG;
        if (khoKiemKe.dotToanKho() != null) {
            return ThieuTonKhoXuatDto.builder()
                    .khoId(khoId)
                    .tenKho(kho.getTenKho())
                    .dotKiemKeToanKho(khoKiemKe.dotToanKho())
                    .dong(List.of())
                    .build();
        }
        Map<Integer, BigDecimal> khoOnHand = khaDungLoTheoKho(bienTheIds).getOrDefault(khoId, Collections.emptyMap());
        Map<Integer, BigDecimal> khoOutgoing = choXuatTheoKhoAnToan(bienTheIds, don.getId()).getOrDefault(khoId, Collections.emptyMap());
        List<ThieuTonKhoXuatDto.Dong> dongThieu = new ArrayList<>();
        canTheoBienThe.forEach((btId, can) -> {
            BigDecimal tonKhaDung = khoOnHand.getOrDefault(btId, BigDecimal.ZERO)
                    .subtract(khoOutgoing.getOrDefault(btId, BigDecimal.ZERO))
                    .subtract(khoKiemKe.cua(btId))
                    .max(BigDecimal.ZERO);
            if (tonKhaDung.compareTo(can) < 0) {
                BienTheSanPham bt = bienTheTheoId.get(btId);
                dongThieu.add(ThieuTonKhoXuatDto.Dong.builder()
                        .bienTheId(btId)
                        .maSku(bt.getMaSku() != null && !bt.getMaSku().isBlank() ? bt.getMaSku() : null)
                        .soLuongCan(can.stripTrailingZeros())
                        .tonKhaDung(tonKhaDung.stripTrailingZeros())
                        .soLuongThieu(can.subtract(tonKhaDung).stripTrailingZeros())
                        .build());
            }
        });
        if (dongThieu.isEmpty()) {
            return null;
        }
        return ThieuTonKhoXuatDto.builder()
                .khoId(khoId)
                .tenKho(kho.getTenKho())
                .dong(dongThieu)
                .build();
    }

    private Map<Integer, Map<Integer, BigDecimal>> choXuatTheoKhoAnToan(List<Integer> bienTheIds, Integer boQuaDonId) {
        Map<Integer, Map<Integer, BigDecimal>> ketQua = new HashMap<>();
        if (chiTietDonBanHangRepository != null) {
            for (Object[] row : chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(bienTheIds, boQuaDonId, ITrangThaiDonBanHang.DANG_GIU_HANG)) {
                ketQua.computeIfAbsent((Integer) row[1], k -> new HashMap<>()).merge((Integer) row[0], soLuong(row[2]), BigDecimal::add);
            }
        }
        if (chiTietPhieuXuatKhoRepository != null) {
            for (Object[] row : chiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho(bienTheIds, boQuaDonId, ITrangThaiDonBanHang.DANG_GIU_HANG)) {
                ketQua.computeIfAbsent((Integer) row[1], k -> new HashMap<>()).merge((Integer) row[0], soLuong(row[2]).negate(), BigDecimal::add);
            }
        }
        if (giuChoChuyenKhoService != null) {
            giuChoChuyenKhoService.theoKho(bienTheIds).forEach((bienTheId, theoKho) -> theoKho.forEach((khoId, giuCho) ->
                    ketQua.computeIfAbsent(khoId, k -> new HashMap<>()).merge(bienTheId, giuCho, BigDecimal::add)));
        }
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
    public void cancel(Integer id, String lyDo) {
        String lyDoHuy = com.dev.backend.dto.request.LyDoHuyRequest.batBuoc(lyDo);
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new LoiChungException(ThongDiep.of("banHang.chungTuKhongTimThay")));
        kiemTraPhamVi(don);

        // Đơn đã hủy: không chạy lại các bước phía sau (bấm lại, tab thứ hai, gọi API lặp) — nếu chạy lại
        // sẽ trừ số cần nhặt của phiếu nhặt thêm một lần và sinh lệnh hoàn kệ cho hàng chưa nhặt.
        if (Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())) {
            return;
        }
        if (laDonShopeeChoXacNhan(don)) {
            throw new CommonException(ThongDiep.of("banHang.donShopeeChoXacNhanChiXem"), HttpStatus.BAD_REQUEST, null);
        }

        Integer trangThai = don.getTrangThai();
        if (trangThai != null && (trangThai == ITrangThaiDonBanHang.DA_XUAT_TOAN_BO
                || trangThai == ITrangThaiDonBanHang.HOAN_THANH || trangThai == ITrangThaiDonBanHang.BI_HOAN_TRA)) {
            throw new CommonException(ThongDiep.of("banHang.donDaXuatKhongHuy"), HttpStatus.CONFLICT, null);
        }

        boolean existsCompletedPX = phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThai(id, ITrangThaiPhieuXuat.DA_XUAT);
        if (existsCompletedPX) {
            throw new CommonException(ThongDiep.of("banHang.donCoPhieuXuatKhongHuy"), HttpStatus.CONFLICT, null);
        }

        // Khóa đơn theo phiếu nhặt hàng (SRS: Pick List order lock): đơn đã gom vào phiếu nhặt
        // còn hoạt động thì không được hủy, tránh nhặt/xuất hàng cho đơn đã hủy.
        DanhSachNhatHang phieuNhat = don.getDanhSachNhatHang();
        if (phieuNhat != null && (phieuNhat.getTrangThai() == null
                || PHIEU_NHAT_DANG_HOAT_DONG.contains(phieuNhat.getTrangThai()))) {
            throw new CommonException(ThongDiep.of("banHang.donTrongPhieuNhatKhongHuy", phieuNhat.getMaPickList()),
                    HttpStatus.CONFLICT, null);
        }
        // Đơn đã có phiếu xuất đang đóng gói / chờ xuất (kể cả phiếu tạo tay, không qua phiếu nhặt)
        if (trangThai != null && (trangThai == ITrangThaiDonBanHang.CHO_DONG_GOI || trangThai == ITrangThaiDonBanHang.DA_DONG_GOI)) {
            throw new CommonException(trangThai == ITrangThaiDonBanHang.CHO_DONG_GOI
                    ? ThongDiep.of("banHang.donChoDongGoiKhongHuy") : ThongDiep.of("banHang.donChoXuatKhoKhongHuy"),
                    HttpStatus.CONFLICT, null);
        }

        don.setTrangThai(ITrangThaiDonBanHang.DA_HUY);
        // Lý do hủy bắt buộc lưu vào ghi chú của chính đơn (lịch sử chứng từ không ghi vào nhật ký)
        don.setGhiChu(noiGhiChu(don.getGhiChu(), "Lý do hủy: " + lyDoHuy));
        repository.save(don);

        // Thu hồi phiếu xuất chưa xuất (nếu có) liên kết với đơn này (SRS 6.3.2) → 4 (Đã hủy)
        phieuXuatKhoService.huyPhieuXuatNhapTheoDon(don.getId(), "Tự động thu hồi do đơn " + don.getSoDonHang()
                + " bị hủy: " + lyDoHuy);

        // Giải phóng Outgoing, hồi phục Free to Use và kích hoạt đẩy tồn (listener chạy sau commit)
        phatSuKienHoanTon(don);
        lamMoiThongBaoDonCho(don);

        // Đơn từ sàn (Shopify / Lazada / Shopee): gọi Order Cancel API SAU KHI commit — giao dịch rollback thì không hủy trên sàn
        if (shopifyOrderRoutingService != null && don.getMaDonHangKenh() != null) {
            shopifyOrderRoutingService.remove(don.getMaDonHangKenh());
        }
        if (don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank() && kenhBanHangDongBoService != null) {
            String maDonHangKenh = don.getMaDonHangKenh();
            KenhBanHang kenh = don.getKenhBanHang();
            String maKenh = kenh != null ? kenh.getMaKenh() : null;
            if (OmnichannelOrderSyncJob.isLazada(maKenh) || (maKenh == null && maDonHangKenh.startsWith("LZD"))) {
                SauCommit.chay("Đồng bộ hủy đơn " + maDonHangKenh + " sang Lazada",
                        () -> kenhBanHangDongBoService.huyDonHangTrenLazada(maDonHangKenh, "Hủy từ FCentric"));
            } else if (OmnichannelOrderSyncJob.isShopee(maKenh) || (maKenh == null && (maDonHangKenh.startsWith("SPX") || (don.getSoDonHang() != null && don.getSoDonHang().startsWith("SHP-") && !maDonHangKenh.startsWith("SHOPIFY"))))) {
                SauCommit.chay("Đồng bộ hủy đơn " + maDonHangKenh + " sang Shopee",
                        () -> kenhBanHangDongBoService.huyDonHangTrenShopee(maDonHangKenh, "Hủy từ FCentric"));
            } else if (OmnichannelOrderSyncJob.isShopify(maKenh) || (maKenh == null && (maDonHangKenh.startsWith("SHOPIFY") || (don.getSoDonHang() != null && don.getSoDonHang().startsWith("SPF-"))))) {
                SauCommit.chay("Đồng bộ hủy đơn " + maDonHangKenh + " sang Shopify",
                        () -> kenhBanHangDongBoService.huyDonHangTrenShopify(maDonHangKenh, "Hủy từ FCentric"));
            }
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
            if (trangThai != null && trangThai == ITrangThaiDonBanHang.BI_HOAN_TRA) {
                return false;
            }
            don.setTrangThai(ITrangThaiDonBanHang.BI_HOAN_TRA);
            don.setNgayCapNhat(Instant.now());
            repository.save(don);
            log.warn("[CHANNEL-CANCEL] Sàn báo hủy đơn {} sau khi đơn đã xuất kho (trạng thái {}) — chuyển sang Bị hoàn trả (6)",
                    don.getSoDonHang(), trangThai);
            ghiNhatKyDon(don, "hoan_tra_tu_san", "Sàn báo hủy sau khi đơn đã xuất kho — chuyển Bị hoàn trả để nhận hoàn. " + lyDo);
            // Báo quản trị viên + quản lý kho xuất (đồng bộ chạy lại nhiều lần vẫn chỉ một thông báo)
            if (thongBaoXuatKhoService != null) thongBaoXuatKhoService.sanHuyDonDaXuat(don, lyDo);
            return true;
        }

        boolean trongPhieuNhat = don.getDanhSachNhatHang() != null;
        don.setTrangThai(ITrangThaiDonBanHang.DA_HUY);
        don.setLyDoTuChoi(lyDo);
        if (don.getGhiChu() != null && don.getGhiChu().contains(OmnichannelOrderSyncJob.TAG_SHOPEE_CHO_XAC_NHAN)) {
            don.setGhiChu(OmnichannelOrderSyncJob.xoaTagShopeeChoXacNhan(don.getGhiChu()));
        }
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
        lamMoiThongBaoDonCho(don);
        return true;
    }

    /** Đơn vừa hủy: số "đơn chờ xuất" của kho và "đơn sàn chờ gửi sang kho" có thể giảm, sửa lại thông báo tóm tắt. */
    private void lamMoiThongBaoDonCho(DonBanHang don) {
        if (thongBaoXuatKhoService == null) return;
        thongBaoXuatKhoService.donDaHuy(don.getId());
        if (don.getKhoXuat() != null) thongBaoXuatKhoService.lamMoiDonChoXuat(don.getKhoXuat().getId());
        if (don.getKenhBanHang() != null) thongBaoXuatKhoService.lamMoiDonSanCho(don.getKenhBanHang());
    }

    /** System-only ingress after verifying Shopify signature and fetching its current state. Never creates packing/export documents. */
    @Transactional(rollbackFor = Exception.class)
    public void batDauXuLyTuShopify(Integer channelId, String shopifyOrderId) {
        DonBanHang don = ((DonBanHangRepository) repository).khoaDonShopify(channelId, shopifyOrderId).orElse(null);
        if (don == null || !Integer.valueOf(ITrangThaiDonBanHang.NHAP).equals(don.getTrangThai())
                || don.getKenhBanHang() == null || !OmnichannelOrderSyncJob.isShopify(don.getKenhBanHang().getMaKenh())
                || !"don_ban_hang".equals(don.getLoaiChungTu()) || don.getKhoXuat() == null
                || !Integer.valueOf(1).equals(don.getKhoXuat().getTrangThai()) || KhoService.laKhoAo(don.getKhoXuat())) return;
        don.setTrangThai(ITrangThaiDonBanHang.CHO_NHAT_HANG);
        don.setNgayCapNhat(Instant.now());
        repository.save(don);
        ghiNhatKyDon(don, "tien_trinh_tu_shopify", "Shopify xác nhận đang xử lý; đơn chuyển sang chờ nhặt");
    }

    @Transactional
    public boolean capNhatTrangThaiGiaoHangTuSan(Integer donId, String trangThaiSan) {
        DonBanHang don = repository.findById(donId).orElse(null);
        if (don == null) {
            return false;
        }
        Integer trangThaiHienTai = don.getTrangThai();
        if (trangThaiHienTai == null) {
            return false;
        }

        String st = trangThaiSan.toLowerCase();
        if (st.contains("delivered") || st.contains("completed")) {
            // Cho phép từ DA_XUAT_TOAN_BO (3), DA_DONG_GOI (8), CHO_DONG_GOI (7)
            if (trangThaiHienTai == ITrangThaiDonBanHang.DA_XUAT_TOAN_BO
                    || trangThaiHienTai == ITrangThaiDonBanHang.DA_DONG_GOI
                    || trangThaiHienTai == ITrangThaiDonBanHang.CHO_DONG_GOI) {
                if (!xuLyPhieuXuatChuaXuatKhiSanGiao(don, trangThaiSan)) {
                    return false;
                }
                don.setTrangThai(ITrangThaiDonBanHang.HOAN_THANH);
                don.setTrangThaiThanhToan("da_thanh_toan");
                don.setNgayCapNhat(Instant.now());
                repository.save(don);
                ghiNhatKyDon(don, "giao_thanh_cong_tu_san", "Sàn cập nhật giao hàng thành công (" + trangThaiSan + ")");
                if (thongBaoXuatKhoService != null) {
                    thongBaoXuatKhoService.donDaGiao(don.getId());
                }
                log.info("[CHANNEL-DELIVERY] Đơn {} đã giao thành công trên sàn -> Chuyển Hoàn thành (5)", don.getSoDonHang());
                return true;
            } else if (trangThaiHienTai == ITrangThaiDonBanHang.CHO_NHAT_HANG
                    || trangThaiHienTai == ITrangThaiDonBanHang.NHAP) {
                log.warn("[CHANNEL-DELIVERY] Đơn {} sàn báo {}, nhưng FCentric mới ở trạng thái {} (chưa nhặt/đóng gói) -> Giữ nguyên trạng thái kho và gửi cảnh báo",
                        don.getSoDonHang(), trangThaiSan, trangThaiHienTai);
                ghiCanhBaoLechTrangThaiSan(don, trangThaiSan, "đơn chưa nhặt/đóng gói trên FCentric");
                return false;
            }
        } else if (st.contains("shipped") || st.contains("in_transit") || st.contains("fulfilled") || st.contains("to_confirm_receive")) {
            // Sàn đã xuất giao (shipped / in_transit / fulfilled / to_confirm_receive):
            // - Nếu phiếu xuất đang ở CHO_XUAT (6 - đã đóng gói): tự động xác nhận xuất kho thật (trừ tồn lô/kệ & ghi thẻ kho).
            // - Nếu còn phiếu NHAP (0) hoặc vướng chốt chặn kiểm kê: giữ nguyên trạng thái kho và gửi cảnh báo cho thủ kho.
            if (trangThaiHienTai == ITrangThaiDonBanHang.DA_DONG_GOI
                    || trangThaiHienTai == ITrangThaiDonBanHang.CHO_DONG_GOI
                    || trangThaiHienTai == ITrangThaiDonBanHang.CHO_NHAT_HANG) {
                if (!xuLyPhieuXuatChuaXuatKhiSanGiao(don, trangThaiSan)) {
                    return false;
                }
                don.setTrangThai(ITrangThaiDonBanHang.DA_XUAT_TOAN_BO);
                don.setNgayCapNhat(Instant.now());
                repository.save(don);
                ghiNhatKyDon(don, "xuat_kho_tu_san", "Sàn cập nhật đã xuất giao (" + trangThaiSan + ")");
                log.info("[CHANNEL-SHIPPED] Đơn {} đang vận chuyển trên sàn -> Chuyển Đã xuất toàn bộ (3)", don.getSoDonHang());
                return true;
            }
        } else if (st.equals("processed")) {
            if (trangThaiHienTai == ITrangThaiDonBanHang.NHAP) {
                don.setTrangThai(ITrangThaiDonBanHang.CHO_NHAT_HANG);
                if (don.getGhiChu() != null && don.getGhiChu().contains(OmnichannelOrderSyncJob.TAG_SHOPEE_CHO_XAC_NHAN)) {
                    don.setGhiChu(OmnichannelOrderSyncJob.xoaTagShopeeChoXacNhan(don.getGhiChu()));
                }
                don.setNgayCapNhat(Instant.now());
                repository.save(don);
                ghiNhatKyDon(don, "san_sang_xu_ly_tu_san", "Sàn cập nhật đang chuẩn bị hàng (" + trangThaiSan + ")");
                return true;
            }
        } else if (st.contains("failed_delivery") || st.contains("returned") || st.contains("refunded")
                || st.contains("to_return") || st.contains("return_refund")
                || st.contains("return_requested") || st.contains("return_in_progress")
                || st.contains("return_approved") || st.contains("inspection_complete")) {
            // Nếu đơn chưa đóng gói/chưa xuất (đang ở Chờ nhặt hoặc Nháp) mà sàn báo hoàn trả -> hủy đơn và giải phóng tạm giữ tồn
            if (trangThaiHienTai == ITrangThaiDonBanHang.CHO_NHAT_HANG || trangThaiHienTai == ITrangThaiDonBanHang.NHAP) {
                return huyDonTuSan(donId, "Sàn cập nhật hoàn trả trước khi xuất kho (" + trangThaiSan + ")");
            }
            // Đơn đã xuất, hoàn thành hoặc đang chuẩn bị hàng/đóng gói -> Chuyển sang Bị hoàn trả (6)
            if (trangThaiHienTai == ITrangThaiDonBanHang.DA_XUAT_TOAN_BO
                    || trangThaiHienTai == ITrangThaiDonBanHang.HOAN_THANH
                    || trangThaiHienTai == ITrangThaiDonBanHang.DA_DONG_GOI
                    || trangThaiHienTai == ITrangThaiDonBanHang.CHO_DONG_GOI
                    || trangThaiHienTai == ITrangThaiDonBanHang.DANG_XUAT_KHO) {
                don.setTrangThai(ITrangThaiDonBanHang.BI_HOAN_TRA);
                don.setNgayCapNhat(Instant.now());
                repository.save(don);
                ghiNhatKyDon(don, "hoan_tra_tu_san", "Sàn cập nhật giao thất bại / hoàn trả (" + trangThaiSan + ")");
                log.info("[CHANNEL-RETURN] Đơn {} giao thất bại / hoàn trả trên sàn -> Chuyển Bị hoàn trả (6)", don.getSoDonHang());
                return true;
            }
        }
        return false;
    }

    private boolean xuLyPhieuXuatChuaXuatKhiSanGiao(DonBanHang don, String trangThaiSan) {
        if (phieuXuatKhoRepository == null || don == null || don.getId() == null) {
            return true;
        }
        List<PhieuXuatKho> phieuList = phieuXuatKhoRepository.findByDonBanHangId(don.getId());
        if (phieuList == null || phieuList.isEmpty()) {
            return true;
        }
        List<PhieuXuatKho> phieuNhap = phieuList.stream()
                .filter(p -> p != null && Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(p.getTrangThai()))
                .toList();
        List<PhieuXuatKho> phieuChoXuat = phieuList.stream()
                .filter(p -> p != null && Integer.valueOf(ITrangThaiPhieuXuat.CHO_XUAT).equals(p.getTrangThai()))
                .toList();
        if (phieuNhap.isEmpty() && phieuChoXuat.isEmpty()) {
            return true;
        }

        if (!phieuNhap.isEmpty()) {
            log.warn("[CHANNEL-DELIVERY] Đơn {} sàn báo {}, nhưng còn {} phiếu xuất ở Nháp (chưa đóng gói) -> Giữ nguyên trạng thái kho {}",
                    don.getSoDonHang(), trangThaiSan, phieuNhap.size(), don.getTrangThai());
            ghiCanhBaoLechTrangThaiSan(don, trangThaiSan, null);
            return false;
        }

        if (phieuXuatKhoService == null) {
            log.info("[CHANNEL-DELIVERY] Đơn {} sàn báo {}, giữ nguyên trạng thái kho {} (phiếu xuất chờ xuất, chưa có PhieuXuatKhoService)",
                    don.getSoDonHang(), trangThaiSan, don.getTrangThai());
            return false;
        }

        for (PhieuXuatKho px : phieuChoXuat) {
            Integer nguoiXuatId = resolveNguoiXuatTuDong(px, don);
            if (nguoiXuatId == null) {
                log.warn("[CHANNEL-DELIVERY] Không xác định được nhân sự xuất kho cho phiếu {} (đơn {})", px.getSoPhieuXuat(), don.getSoDonHang());
                ghiCanhBaoLechTrangThaiSan(don, trangThaiSan, null);
                return false;
            }
            try {
                phieuXuatKhoService.xacNhanXuatKhoTuDongTuSan(px.getId(), nguoiXuatId);
            } catch (Exception ex) {
                log.warn("[CHANNEL-DELIVERY] Tự động xác nhận phiếu xuất {} (đơn {}) thất bại: {}",
                        px.getSoPhieuXuat(), don.getSoDonHang(), ex.getMessage());
                ghiCanhBaoLechTrangThaiSan(don, trangThaiSan, ex.getMessage());
                return false;
            }
        }
        return true;
    }

    private Integer resolveNguoiXuatTuDong(PhieuXuatKho px, DonBanHang don) {
        if (px != null && px.getNguoiXuat() != null && px.getNguoiXuat().getId() != null) {
            return px.getNguoiXuat().getId();
        }
        if (px != null && px.getNguoiDuyet() != null && px.getNguoiDuyet().getId() != null) {
            return px.getNguoiDuyet().getId();
        }
        if (don != null && don.getNguoiTao() != null && don.getNguoiTao().getId() != null) {
            return don.getNguoiTao().getId();
        }
        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        if (auth != null && auth.getId() != null) {
            return auth.getId();
        }
        if (nguoiDungRepository != null) {
            return nguoiDungRepository.findAll(PageRequest.of(0, 1)).stream()
                    .map(NguoiDung::getId)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    private void ghiCanhBaoLechTrangThaiSan(DonBanHang don, String trangThaiSan, String lyDo) {
        String tagPrefix = "[CẢNH BÁO LỆCH SÀN:";
        String currentNote = don.getGhiChu();
        if (currentNote == null || !currentNote.contains(tagPrefix)) {
            String detail = tagPrefix + " Sàn báo " + trangThaiSan
                    + (lyDo != null && !lyDo.isBlank() ? " - " + lyDo.trim() : " - phiếu xuất chưa hoàn tất") + "]";
            don.setGhiChu(noiGhiChu(currentNote, detail));
            don.setNgayCapNhat(Instant.now());
            repository.save(don);
            if (thongBaoXuatKhoService != null) {
                thongBaoXuatKhoService.canhBaoLechTrangThaiSan(don, trangThaiSan, lyDo);
            }
        }
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

    /** Nối một đoạn vào ghi chú đang có của chứng từ (cách nhau " | "). */
    static String noiGhiChu(String ghiChu, String them) {
        return (ghiChu != null && !ghiChu.isBlank() ? ghiChu.trim() + " | " : "") + them;
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

    @Transactional
    public void markAsDelivered(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new LoiChungException(ThongDiep.of("banHang.donBanKhongTimThay")));
        kiemTraPhamVi(don);
        // Chỉ cho phép xác nhận Giao thành công khi toàn bộ hàng đã được kho xuất đi
        if (don.getTrangThai() != 3) {
            throw new LoiChungException(ThongDiep.of("banHang.donChuaXuatDuKhongHoanThanh"));
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
            thueGtgtService.chupLaiTheoNgayGiao(don);
        }
        repository.save(don);

        if (don.getKenhBanHang() != null && OmnichannelOrderSyncJob.isShopify(don.getKenhBanHang().getMaKenh())
                && don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank()
                && kenhBanHangDongBoService != null) {
            if (shopifyOrderRoutingService != null) {
                shopifyOrderRoutingService.remove(don.getMaDonHangKenh());
            }
            String shopifyOrderId = don.getMaDonHangKenh();
            SauCommit.chay("Đồng bộ giao hàng thành công sang Shopify (delivered)",
                    () -> kenhBanHangDongBoService.dongBoTrangThaiDeliveredShopify(shopifyOrderId));
        }
        if (don.getKenhBanHang() != null && OmnichannelOrderSyncJob.isShopee(don.getKenhBanHang().getMaKenh())
                && don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank()
                && kenhBanHangDongBoService != null) {
            String shopeeOrderId = don.getMaDonHangKenh();
            SauCommit.chay("Đồng bộ giao hàng thành công sang Shopee (completed)",
                    () -> kenhBanHangDongBoService.dongBoTrangThaiGiaoThanhCongShopee(shopeeOrderId));
        }
        // Khiếu nại số lượng / chất lượng tính từ ngày giao (Luật Thương mại Điều 318): giữ bằng chứng đóng gói tới
        // ngày giao + hạn lưu (ngày xuất kho + hạn lưu có thể sớm hơn nếu giao chậm)
        bangChungDongGoiService.giaHanLuuTu(don.getId(), don.getNgayGiaoHang());
        if (thongBaoXuatKhoService != null) thongBaoXuatKhoService.donDaGiao(don.getId());
    }
    @Transactional
    public void returnOrder(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new LoiChungException(ThongDiep.of("banHang.donBanKhongTimThay")));
        kiemTraPhamVi(don);

        // Chỉ cho phép hoàn trả khi đơn đang ở trạng thái đã xuất kho (2, 3)
        if (don.getTrangThai() != 2 && don.getTrangThai() != 3) {
            throw new LoiChungException(ThongDiep.of("banHang.chiHoanTraDonDaXuat"));
        }

        // Kiểm tra xem đơn hàng đã có phiếu xuất kho nào hoàn thành chưa
        boolean hasCompletedExport = phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThai(id, 3);
        if (!hasCompletedExport) {
            throw new LoiChungException(ThongDiep.of("banHang.donChuaCoPhieuXuatHoanTra"));
        }

        // Chuyển trạng thái thành Bị hoàn trả (6)
        don.setTrangThai(6);
        repository.save(don);

        if (don.getKenhBanHang() != null && OmnichannelOrderSyncJob.isShopify(don.getKenhBanHang().getMaKenh())
                && don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank()
                && kenhBanHangDongBoService != null) {
            if (shopifyOrderRoutingService != null) {
                shopifyOrderRoutingService.remove(don.getMaDonHangKenh());
            }
            String shopifyOrderId = don.getMaDonHangKenh();
            Integer donId = don.getId();
            SauCommit.chay("Đồng bộ hoàn trả và hoàn tiền sang Shopify",
                    () -> kenhBanHangDongBoService.dongBoHoanTraVaHoanTienShopify(donId, shopifyOrderId));
        }
        if (don.getKenhBanHang() != null && OmnichannelOrderSyncJob.isShopee(don.getKenhBanHang().getMaKenh())
                && don.getMaDonHangKenh() != null && !don.getMaDonHangKenh().isBlank()
                && kenhBanHangDongBoService != null) {
            String shopeeOrderId = don.getMaDonHangKenh();
            SauCommit.chay("Đồng bộ hoàn trả đơn hàng sang Shopee",
                    () -> kenhBanHangDongBoService.dongBoTrangThaiHoanTraShopee(shopeeOrderId));
        }
        // Nhật ký lúc hoàn trả: xuất kế toán lấy làm ngày hạch toán của chứng từ Hàng bán trả lại (đơn đã giao kế toán).
        // Ghi sau commit, giao dịch riêng: ghi lỗi thì đơn vẫn hoàn trả, xuất kế toán coi như đơn không có nhật ký và để kế
        // toán lập tay (danh sách "Phát sinh sau khi xuất").
        NguoiDungAuthInfo nguoiHoan = SecurityContextHolder.getUser();
        if (nguoiHoan != null && nguoiHoan.getId() != null) {
            Integer nguoiHoanId = nguoiHoan.getId();
            Integer donHoanId = don.getId();
            String giaTriHoan = "Đơn " + don.getSoDonHang() + " chuyển sang Bị hoàn trả";
            Instant lucHoan = Instant.now();
            SauCommit.chay("Ghi nhật ký hoàn trả đơn " + don.getSoDonHang(), () -> lichSuThayDoiService.createGiaoDichRieng(
                    LichSuThayDoi.builder()
                            .loaiThamChieu(ITable.don_ban_hang)
                            .idThamChieu(donHoanId)
                            .hanhDong(IHanhDong.hoan_tra_don_ban)
                            .giaTriMoi(giaTriHoan)
                            .nguoiThucHien(nguoiDungRepository.findById(nguoiHoanId).orElse(null))
                            .ngayThucHien(lucHoan)
                            .build()));
        }
        // Đơn bị hoàn trả là lúc cần đối chứng: giữ bằng chứng đóng gói thêm một hạn lưu tính từ hôm nay
        bangChungDongGoiService.giaHanLuuTu(don.getId(), Instant.now());
        // Báo kho xuất lập phiếu nhập hoàn trả khi hàng về
        if (thongBaoXuatKhoService != null) {
            NguoiDungAuthInfo nguoiGhi = SecurityContextHolder.getUser();
            thongBaoXuatKhoService.donHoanTra(don, nguoiGhi == null ? null : nguoiGhi.getId());
        }
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

    /**
     * Lấy tem vận đơn từ sàn (AWB / Shipping Label) cho đơn hàng sàn.
     */
    @Transactional(readOnly = true)
    public VanDonSanDto layVanDonSan(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new CommonException(ThongDiep.of("banHang.donBanHangKhongTimThayId", id), HttpStatus.NOT_FOUND, null));
        kiemTraPhamVi(don);

        if (Integer.valueOf(ITrangThaiDonBanHang.DA_HUY).equals(don.getTrangThai())) {
            throw new CommonException(ThongDiep.of("banHang.donDaHuyKhongInVanDon"), HttpStatus.BAD_REQUEST, null);
        }
        if (laDonShopeeChoXacNhan(don)) {
            throw new CommonException(ThongDiep.of("banHang.donShopeeChoXacNhanKhongInVanDon"), HttpStatus.BAD_REQUEST, null);
        }

        if (don.getKenhBanHang() == null) {
            throw new CommonException(ThongDiep.of("banHang.donKhongThuocKenhSan"), HttpStatus.BAD_REQUEST, null);
        }

        String maKenh = don.getKenhBanHang().getMaKenh();
        if ("LAZADA".equalsIgnoreCase(maKenh)) {
            String orderId = don.getMaDonHangKenh();
            if (orderId == null || orderId.isBlank()) {
                throw new CommonException(ThongDiep.of("banHang.donChuaCoMaLazada"), HttpStatus.BAD_REQUEST, null);
            }

            String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
            String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
            String accessToken = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
            if (appKey == null || appSecret == null || accessToken == null) {
                throw new CommonException(ThongDiep.of("banHang.lazadaChuaCauHinh"), HttpStatus.BAD_REQUEST, null);
            }

            JsonNode labelRes = null;
            try {
                labelRes = lazadaClient.getShippingLabel(appKey, appSecret, accessToken, orderId);
            } catch (Exception ex) {
                log.warn("[AWB-FALLBACK] Lỗi khi gọi API in vận đơn sàn Lazada: {}. Chuyển sang tạo tem A6 nội bộ...", ex.getMessage());
                return taoVanDonLazadaHtml(don, appKey, appSecret, accessToken, orderId);
            }

            String code = labelRes != null ? labelRes.path("code").asText("0") : "-1";
            if (!"0".equals(code) && !"".equals(code)) {
                String errorMsg = labelRes != null ? labelRes.path("message").asText(labelRes.path("sub_message").asText("")) : "";
                log.warn("[AWB-FALLBACK] Lazada báo lỗi lấy tem AWB ({}). Tự động tạo tem nhiệt A6 chuẩn hệ thống có mã vận đơn sàn...", errorMsg);
                return taoVanDonLazadaHtml(don, appKey, appSecret, accessToken, orderId);
            }

            JsonNode docNode = labelRes.path("data").path("document");
            String fileContent = docNode.path("file").asText("").trim();
            String mimeType = docNode.path("mime_type").asText("text/html").trim();

            boolean isMasked = fileContent.startsWith("P*") || fileContent.startsWith("p*")
                    || (fileContent.startsWith("P") && fileContent.contains("****"));

            if (fileContent.isBlank() || isMasked) {
                log.info("[AWB-FALLBACK] Lazada trả về dữ liệu vận đơn ẩn danh (P***) hoặc trống cho đơn {}, tự động tạo tem nhiệt A6 chuẩn hệ thống...", orderId);
                return taoVanDonLazadaHtml(don, appKey, appSecret, accessToken, orderId);
            }

            byte[] decodedBytes;
            boolean isHtml = mimeType.toLowerCase().contains("html")
                    || fileContent.startsWith("<")
                    || fileContent.contains("<html")
                    || fileContent.contains("<!DOCTYPE")
                    || fileContent.contains("<!doctype");

            if (fileContent.startsWith("data:") && fileContent.contains("base64,")) {
                String base64Part = fileContent.substring(fileContent.indexOf("base64,") + 7).trim();
                try {
                    decodedBytes = Base64.getMimeDecoder().decode(base64Part.replaceAll("\\s+", ""));
                } catch (IllegalArgumentException ex) {
                    if (isHtml) {
                        decodedBytes = fileContent.getBytes(StandardCharsets.UTF_8);
                    } else {
                        throw new CommonException(ThongDiep.of("banHang.vanDonLazadaSaiBase64", ex.getMessage()), HttpStatus.BAD_REQUEST, null);
                    }
                }
            } else if (fileContent.startsWith("<") || fileContent.contains("<body") || fileContent.contains("<table") || fileContent.contains("<html")) {
                // Raw HTML từ Lazada (có thể chứa ký tự CSS '*' hoặc comment, không decode Base64)
                decodedBytes = fileContent.getBytes(StandardCharsets.UTF_8);
                if (mimeType.isBlank() || mimeType.equalsIgnoreCase("application/pdf")) {
                    mimeType = "text/html";
                }
            } else {
                try {
                    decodedBytes = Base64.getMimeDecoder().decode(fileContent.replaceAll("\\s+", ""));
                } catch (IllegalArgumentException ex) {
                    if (isHtml) {
                        decodedBytes = fileContent.getBytes(StandardCharsets.UTF_8);
                    } else {
                        throw new CommonException(ThongDiep.of("banHang.vanDonLazadaSaiDinhDang", ex.getMessage()), HttpStatus.BAD_REQUEST, null);
                    }
                }
            }

            if (mimeType.toLowerCase().contains("html")) {
                String html = new String(decodedBytes, StandardCharsets.UTF_8);
                if (!html.contains("window.print")) {
                    html += "<script>window.onload = function() { window.print(); };</script>";
                    decodedBytes = html.getBytes(StandardCharsets.UTF_8);
                }
            }

            return new VanDonSanDto(decodedBytes, mimeType, "awb-" + don.getSoDonHang());
        } else if (OmnichannelOrderSyncJob.isShopee(maKenh)) {
            String orderSn = don.getMaDonHangKenh();
            if (orderSn == null || orderSn.isBlank()) {
                orderSn = don.getSoDonHang();
            }
            if (orderSn != null && orderSn.startsWith("SHP-")) {
                orderSn = orderSn.substring(4).trim();
            }
            if (orderSn == null || orderSn.isBlank()) {
                throw new CommonException(ThongDiep.of("banHang.donChuaCoMaShopee"), HttpStatus.BAD_REQUEST, null);
            }
            String resolvedTracking = null;
            try {
                if (shopeeClient != null && kenhBanHangService != null) {
                    Long partnerId = kenhBanHangService.getShopeePartnerId(maKenh);
                    String partnerKey = kenhBanHangService.getDecryptedShopeePartnerKey(maKenh);
                    String accessToken = kenhBanHangService.getDecryptedShopeeAccessToken(maKenh);
                    Long shopId = kenhBanHangService.getShopeeShopId(maKenh);
                    boolean isSandbox = OmnichannelOrderSyncJob.isShopeeSandbox(maKenh);

                    if (partnerId != null && partnerKey != null && accessToken != null && shopId != null) {
                        String ghiChu = don.getGhiChu() != null ? don.getGhiChu() : "";
                        boolean daCoVanDonThat = ghiChu.contains("[VẬN ĐƠN:") && !ghiChu.contains("SPXVN" + orderSn);
                        byte[] docBytes = shopeeClient.downloadShippingDocument(
                                String.valueOf(partnerId), partnerKey, accessToken, String.valueOf(shopId), orderSn, isSandbox, daCoVanDonThat);
                        if (docBytes != null && docBytes.length > 50 && !com.dev.backend.services.shopee.ShopeeClient.laJsonLoiShopee(docBytes)) {
                            boolean isPdf = docBytes.length > 4 && docBytes[0] == '%' && docBytes[1] == 'P' && docBytes[2] == 'D' && docBytes[3] == 'F';
                            String preview = isPdf ? "" : new String(docBytes, 0, Math.min(docBytes.length, 512), StandardCharsets.UTF_8).toLowerCase(java.util.Locale.ROOT);
                            boolean isHtml = !isPdf && (preview.trim().startsWith("<") || preview.contains("<html") || preview.contains("<!doctype"));
                            if (isPdf || isHtml) {
                                String mime = isPdf ? "application/pdf" : "text/html; charset=utf-8";
                                return new VanDonSanDto(docBytes, mime, "van-don-shopee-" + don.getSoDonHang() + (isPdf ? ".pdf" : ".html"));
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                log.info("[AWB-SHOPEE] Không thể tải tài liệu gốc từ Shopee: {}. Chuyển sang tạo tem A6 nội bộ...", ex.getMessage());
            }
            return taoVanDonShopeeHtml(don, orderSn, resolvedTracking);
        }

        throw new CommonException(ThongDiep.of("banHang.kenhChuaHoTroInVanDon", maKenh), HttpStatus.BAD_REQUEST, null);
    }

    /**
     * Tạo bản in tem nhiệt A6 chuẩn (100x150mm) chứa mã vận đơn (tracking_code) và mã vạch Barcode Code 128
     * của sàn Lazada khi môi trường thử nghiệm chưa được duyệt DataMoat.
     */
    private VanDonSanDto taoVanDonLazadaHtml(DonBanHang don, String appKey, String appSecret, String accessToken, String orderId) {
        LazadaOrderTrackingDto tracking = lazadaClient.getOrderTracking(appKey, appSecret, accessToken, orderId);

        String trackingCode = tracking != null ? tracking.getTrackingCode() : "";
        if (trackingCode == null || trackingCode.isBlank()) {
            trackingCode = (tracking != null && tracking.getPackageId() != null && !tracking.getPackageId().isBlank())
                    ? tracking.getPackageId()
                    : ("LZD" + orderId);
        }
        String carrier = (tracking != null && tracking.getShipmentProvider() != null && !tracking.getShipmentProvider().isBlank())
                ? tracking.getShipmentProvider()
                : "Lazada Express (LEX VN)";
        String packageId = (tracking != null && tracking.getPackageId() != null && !tracking.getPackageId().isBlank())
                ? tracking.getPackageId()
                : ("PKG-" + orderId);

        String recipientName = "Khách hàng sàn Lazada";
        String recipientPhone = "09***382";
        String recipientAddress = "Theo bưu kiện giao vận sàn";
        if (don.getKhachHang() != null) {
            if (don.getKhachHang().getTenKhachHang() != null && !don.getKhachHang().getTenKhachHang().isBlank()) {
                recipientName = don.getKhachHang().getTenKhachHang();
            }
            if (don.getKhachHang().getSoDienThoai() != null && !don.getKhachHang().getSoDienThoai().isBlank()) {
                recipientPhone = don.getKhachHang().getSoDienThoai();
            }
            if (don.getKhachHang().getDiaChi() != null && !don.getKhachHang().getDiaChi().isBlank()) {
                recipientAddress = don.getKhachHang().getDiaChi();
            }
        }
        if (don.getDiaChiGiaoHang() != null && !don.getDiaChiGiaoHang().isBlank()) {
            recipientAddress = don.getDiaChiGiaoHang();
        }

        if (recipientPhone.length() >= 7 && !recipientPhone.contains("***")) {
            recipientPhone = recipientPhone.substring(0, 2) + "***" + recipientPhone.substring(recipientPhone.length() - 3);
        }

        String trackingBarcodeSvg = BarcodeHelper.generateCode128Svg(trackingCode, 48);
        String orderBarcodeSvg = BarcodeHelper.generateCode128Svg(orderId, 32);

        StringBuilder itemsRows = new StringBuilder();
        int totalQty = 0;
        if (don.getChiTietDonBanHangs() != null) {
            for (ChiTietDonBanHang ct : don.getChiTietDonBanHangs()) {
                BienTheSanPham bt = ct.getBienTheSanPham();
                String spName = (bt != null && bt.getSanPham() != null) ? bt.getSanPham().getTenSanPham() : "Sản phẩm";
                String sku = bt != null ? bt.getMaSku() : "";
                int qty = ct.getSoLuongDat() != null ? ct.getSoLuongDat().intValue() : 1;
                totalQty += qty;
                itemsRows.append("<tr>")
                        .append("<td style=\"border:1px solid #ccc;padding:4px 6px;\">").append(spName).append("<br/><small style=\"color:#666;\">SKU: ").append(sku).append("</small></td>")
                        .append("<td style=\"border:1px solid #ccc;padding:4px 6px;text-align:center;font-weight:bold;\">").append(qty).append("</td>")
                        .append("</tr>");
            }
        }

        String html = """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8"/>
                    <title>Vận đơn Lazada - %s</title>
                    <style>
                        @page { size: 100mm 150mm; margin: 3mm; }
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 4mm; color: #111; font-size: 11px; line-height: 1.3; }
                        .thermal-card { border: 2px solid #000; padding: 6px; height: calc(100%% - 16px); box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
                        .header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
                        .logo-text { font-size: 18px; font-weight: 900; letter-spacing: 0.5px; color: #0f146d; }
                        .carrier-tag { font-size: 13px; font-weight: bold; background: #000; color: #fff; padding: 3px 8px; border-radius: 3px; }
                        .barcode-box { text-align: center; margin: 4px 0 6px 0; border-bottom: 1px dashed #000; padding-bottom: 6px; }
                        .barcode-text { font-family: monospace; font-size: 14px; font-weight: bold; margin-top: 4px; letter-spacing: 1.5px; }
                        .info-section { margin-bottom: 6px; font-size: 11px; }
                        .info-title { font-weight: bold; text-transform: uppercase; font-size: 10px; color: #555; margin-bottom: 2px; }
                        .items-table { width: 100%%; border-collapse: collapse; margin-top: 4px; font-size: 10px; }
                        .footer { border-top: 1px dashed #000; padding-top: 4px; font-size: 9px; color: #666; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="thermal-card">
                        <div>
                            <div class="header-row">
                                <span class="logo-text">LAZADA LOGISTICS</span>
                                <span class="carrier-tag">%s</span>
                            </div>
                            <div class="barcode-box">
                                %s
                                <div class="barcode-text">%s</div>
                                <div style="font-size: 9px; color: #555;">MÃ VẬN ĐƠN / TRACKING NUMBER</div>
                            </div>
                            <div class="info-section" style="display: flex; justify-content: space-between;">
                                <div>
                                    <div class="info-title">Mã kiện / Package ID:</div>
                                    <div style="font-weight: bold; font-family: monospace;">%s</div>
                                </div>
                                <div style="text-align: right;">
                                    <div class="info-title">Mã đơn sàn:</div>
                                    <div style="font-weight: bold; font-family: monospace;">%s</div>
                                </div>
                            </div>
                            <div class="barcode-box" style="margin: 2px 0 6px 0; padding-bottom: 4px;">
                                %s
                            </div>
                            <div class="info-section" style="border: 1px solid #ccc; padding: 5px; border-radius: 4px; background: #fafafa;">
                                <div class="info-title">NGƯỜI NHẬN / RECIPIENT:</div>
                                <div style="font-size: 12px; font-weight: bold;">%s - %s</div>
                                <div style="margin-top: 2px; word-break: break-word;">%s</div>
                            </div>
                            <div class="info-section">
                                <div class="info-title">DANH SÁCH SẢN PHẨM (TỔNG: %d):</div>
                                <table class="items-table">
                                    <thead>
                                        <tr style="background:#eee;">
                                            <th style="border:1px solid #ccc;padding:3px;text-align:left;">Sản phẩm</th>
                                            <th style="border:1px solid #ccc;padding:3px;width:35px;text-align:center;">SL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        %s
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="footer">
                            <div>FCentric Omnichannel · Tem in nhiệt chuẩn A6 (100x150mm)</div>
                            <div>Vui lòng quay video mở kiện hàng để hỗ trợ khiếu nại</div>
                        </div>
                    </div>
                    <script>
                        window.onload = function() {
                            window.focus();
                            window.print();
                        };
                    </script>
                </body>
                </html>
                """.formatted(
                orderId,
                carrier,
                trackingBarcodeSvg,
                trackingCode,
                packageId,
                orderId,
                orderBarcodeSvg,
                recipientName,
                recipientPhone,
                recipientAddress,
                totalQty,
                itemsRows.toString()
        );

        return new VanDonSanDto(
                html.getBytes(StandardCharsets.UTF_8),
                "text/html; charset=utf-8",
                "van-don-lazada-" + don.getSoDonHang() + ".html"
        );
    }

    /**
     * Tạo tem vận đơn nhiệt khổ A6 chuẩn Shopee Express (SPX VN) có mã vạch barcode Code 128 cho đơn hàng Shopee.
     */
    private VanDonSanDto taoVanDonShopeeHtml(DonBanHang don, String orderId) {
        return taoVanDonShopeeHtml(don, orderId, null);
    }

    private VanDonSanDto taoVanDonShopeeHtml(DonBanHang don, String orderId, String resolvedTracking) {
        String ghiChu = don.getGhiChu();
        String trackingCode = !ShopeeWaybillMetadataHelper.isFakeShopeeTracking(resolvedTracking, orderId)
                ? resolvedTracking.trim()
                : ShopeeWaybillMetadataHelper.extractTracking(ghiChu, orderId);
        if (trackingCode == null || trackingCode.isBlank()) {
            trackingCode = (orderId != null && !orderId.isBlank()) ? orderId : don.getSoDonHang();
        }
        String extractedCarrier = ShopeeWaybillMetadataHelper.extractCarrier(ghiChu);
        String carrier = extractedCarrier != null ? extractedCarrier : "Shopee Xpress (SPX)";

        String recipientName = "Khách hàng sàn Shopee";
        String recipientPhone = "09***888";
        String recipientAddress = "Theo bưu kiện giao vận sàn Shopee";
        if (don.getKhachHang() != null) {
            if (don.getKhachHang().getTenKhachHang() != null && !don.getKhachHang().getTenKhachHang().isBlank()) {
                recipientName = don.getKhachHang().getTenKhachHang();
            }
            if (don.getKhachHang().getSoDienThoai() != null && !don.getKhachHang().getSoDienThoai().isBlank()) {
                recipientPhone = don.getKhachHang().getSoDienThoai();
            }
            if (don.getKhachHang().getDiaChi() != null && !don.getKhachHang().getDiaChi().isBlank()) {
                recipientAddress = don.getKhachHang().getDiaChi();
            }
        }
        if (don.getDiaChiGiaoHang() != null && !don.getDiaChiGiaoHang().isBlank()) {
            recipientAddress = don.getDiaChiGiaoHang();
        }

        if (recipientPhone.length() >= 7 && !recipientPhone.contains("***")) {
            recipientPhone = recipientPhone.substring(0, 2) + "***" + recipientPhone.substring(recipientPhone.length() - 3);
        }

        String trackingBarcodeSvg = BarcodeHelper.generateCode128Svg(trackingCode, 48);
        String orderBarcodeSvg = BarcodeHelper.generateCode128Svg(orderId != null ? orderId : don.getSoDonHang(), 32);

        StringBuilder itemsRows = new StringBuilder();
        int totalQty = 0;
        if (don.getChiTietDonBanHangs() != null) {
            for (ChiTietDonBanHang ct : don.getChiTietDonBanHangs()) {
                BienTheSanPham bt = ct.getBienTheSanPham();
                String spName = (bt != null && bt.getSanPham() != null) ? bt.getSanPham().getTenSanPham() : "Sản phẩm";
                String sku = bt != null ? bt.getMaSku() : "";
                int qty = ct.getSoLuongDat() != null ? ct.getSoLuongDat().intValue() : 1;
                totalQty += qty;
                itemsRows.append("<tr>")
                        .append("<td style=\"border:1px solid #ccc;padding:4px 6px;\">").append(spName).append("<br/><small style=\"color:#666;\">SKU: ").append(sku).append("</small></td>")
                        .append("<td style=\"border:1px solid #ccc;padding:4px 6px;text-align:center;font-weight:bold;\">").append(qty).append("</td>")
                        .append("</tr>");
            }
        }

        String maTuyen = ShopeeWaybillMetadataHelper.extractTag(ghiChu, ShopeeWaybillMetadataHelper.TAG_TUYEN);
        String maTram = ShopeeWaybillMetadataHelper.extractTag(ghiChu, ShopeeWaybillMetadataHelper.TAG_TRAM);
        String sortingCode;
        if (maTuyen != null) {
            sortingCode = maTram != null ? (maTuyen + " / " + maTram) : maTuyen;
        } else {
            sortingCode = "Đang cập nhật tuyến";
            String addrUpper = recipientAddress.toUpperCase();
            if (addrUpper.contains("HÀ NỘI") || addrUpper.contains("HA NOI") || addrUpper.contains("HN")) {
                sortingCode = "20-HAN / HÀ NỘI";
            } else if (addrUpper.contains("ĐÀ NẴNG") || addrUpper.contains("DA NANG")) {
                sortingCode = "50-DNG / ĐÀ NẴNG";
            } else if (addrUpper.contains("HỒ CHÍ MINH") || addrUpper.contains("HO CHI MINH") || addrUpper.contains("HCM") || addrUpper.contains("SÀI GÒN")) {
                sortingCode = "1-SGN / TP.HCM";
            }
        }

        ShopeeWaybillMetadataHelper.PaymentSummary paySummary = ShopeeWaybillMetadataHelper.resolveOrderPaymentSummary(
                ghiChu, don.getTrangThaiThanhToan(), don.getTongCong(), laDonShopeeChoXacNhan(don));
        String codText = paySummary.cod()
                ? String.format("%,d ₫", paySummary.tienThuHoCod().longValue())
                : "0 ₫ (ĐÃ THANH TOÁN)";

        String html = """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8"/>
                    <title>Vận đơn Shopee - %s</title>
                    <style>
                        @page { size: 100mm 150mm; margin: 3mm; }
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 4mm; color: #111; font-size: 11px; line-height: 1.3; }
                        .thermal-card { border: 2px solid #000; padding: 6px; height: calc(100%% - 16px); box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
                        .header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
                        .logo-text { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #ee4d2d; }
                        .carrier-tag { font-size: 12px; font-weight: bold; background: #ee4d2d; color: #fff; padding: 3px 8px; border-radius: 3px; }
                        .sorting-code { font-size: 18px; font-weight: 900; text-align: center; border: 2px dashed #000; padding: 5px; margin-bottom: 6px; letter-spacing: 1px; background: #fafafa; }
                        .barcode-box { text-align: center; margin: 4px 0 6px 0; border-bottom: 1px dashed #000; padding-bottom: 6px; }
                        .barcode-text { font-family: monospace; font-size: 14px; font-weight: bold; margin-top: 4px; letter-spacing: 1.5px; }
                        .info-section { margin-bottom: 6px; font-size: 11px; }
                        .info-title { font-weight: bold; text-transform: uppercase; font-size: 10px; color: #555; margin-bottom: 2px; }
                        .items-table { width: 100%%; border-collapse: collapse; margin-top: 4px; font-size: 10px; }
                        .cod-box { border: 2px solid #000; padding: 6px 8px; margin: 6px 0; display: flex; justify-content: space-between; align-items: center; background: #fdfdfd; }
                        .footer { border-top: 1px dashed #000; padding-top: 4px; font-size: 9px; color: #666; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="thermal-card">
                        <div>
                            <div style="display:flex;border-bottom:2px solid #000;text-align:center;padding-bottom:4px;margin-bottom:6px;">
                                <div style="flex:1;border-right:1px solid #000;padding:2px 4px;">
                                    <div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:#555;">PICKUP BY</div>
                                    <div style="font-size:11px;font-weight:900;margin-top:2px;">SPX EXPRESS</div>
                                </div>
                                <div style="flex:1;border-right:1px solid #000;padding:2px 4px;">
                                    <div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:#555;">DELIVERY BY</div>
                                    <div style="font-size:11px;font-weight:900;margin-top:2px;">SPX EXPRESS</div>
                                </div>
                                <div style="flex:1;padding:2px 4px;">
                                    <div style="font-size:13px;font-weight:900;color:#ee4d2d;">Shopee</div>
                                    <div style="font-size:9px;font-weight:bold;">%s</div>
                                </div>
                            </div>
                            <div class="sorting-code">%s</div>
                            <div class="barcode-box">
                                %s
                                <div class="barcode-text">%s</div>
                                <div style="font-size:10px;color:#555;margin-top:2px;">Mã đơn: %s</div>
                            </div>
                            <div class="barcode-box" style="padding-bottom:4px;margin-bottom:4px;">
                                %s
                            </div>
                            <div class="cod-box">
                                <span style="font-weight:bold;">TIỀN THU NGƯỜI NHẬN:</span>
                                <span style="font-size:16px;font-weight:900;color:#ee4d2d;">%s</span>
                            </div>
                            <div class="info-section">
                                <div class="info-title">NGƯỜI NHẬN:</div>
                                <b>%s</b> - SĐT: <b>%s</b><br/>
                                %s
                            </div>
                            <div class="info-section">
                                <div class="info-title">DANH SÁCH SẢN PHẨM (TỔNG: %d):</div>
                                <table class="items-table">
                                    <thead>
                                        <tr style="background:#eee;">
                                            <th style="border:1px solid #ccc;padding:3px;text-align:left;">Sản phẩm</th>
                                            <th style="border:1px solid #ccc;padding:3px;width:35px;text-align:center;">SL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        %s
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="footer">
                            <div>Shopee Express · Tem in nhiệt chuẩn A6 (100x150mm)</div>
                            <div>Vui lòng quay video mở kiện hàng để hỗ trợ khiếu nại</div>
                        </div>
                    </div>
                    <script>
                        window.onload = function() {
                            window.focus();
                            window.print();
                        };
                    </script>
                </body>
                </html>
                """.formatted(
                orderId,
                carrier,
                sortingCode,
                trackingBarcodeSvg,
                trackingCode,
                orderId,
                orderBarcodeSvg,
                codText,
                recipientName,
                recipientPhone,
                recipientAddress,
                totalQty,
                itemsRows.toString()
        );

        return new VanDonSanDto(
                html.getBytes(StandardCharsets.UTF_8),
                "text/html; charset=utf-8",
                "van-don-shopee-" + don.getSoDonHang() + ".html"
        );
    }
}
