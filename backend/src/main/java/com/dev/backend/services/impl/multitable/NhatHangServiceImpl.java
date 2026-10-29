package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.request.DonChoXuatFilterRequest;
import com.dev.backend.dto.request.PhanBoLoNhatHangRequest;
import com.dev.backend.dto.request.PhanCongNguoiNhatRequest;
import com.dev.backend.dto.request.PickLoHangRequest;
import com.dev.backend.dto.request.TaoPickListRequest;
import com.dev.backend.dto.request.QuetBarcodeRequest;
import com.dev.backend.dto.response.customize.DonChoXuatDto;
import com.dev.backend.dto.response.customize.HangCanHoanKeDto;
import com.dev.backend.dto.response.customize.KetQuaQuetBarcodeDto;
import com.dev.backend.dto.response.customize.LoKhaDungNhatHangDto;
import com.dev.backend.dto.response.customize.PhanBoLoDto;
import com.dev.backend.dto.response.entities.ChiTietNhatHangDto;
import com.dev.backend.dto.response.entities.DanhSachNhatHangDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.ChiTietNhatHangMapper;
import com.dev.backend.mapper.DanhSachNhatHangMapper;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.impl.entities.PhieuXuatKhoService;
import com.dev.backend.utils.PhanBoLoFifo;
import com.dev.backend.utils.SauCommit;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.SoChungTu;
import com.dev.backend.services.multitable.NhatHangService;
import com.dev.backend.event.InventoryRestockedEvent;
import org.springframework.context.ApplicationEventPublisher;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class NhatHangServiceImpl implements NhatHangService {

    static final String LOI_NGUOI_NHAT_NGUNG_HOAT_DONG = "Tài khoản nhân viên nhặt hàng đang tạm khóa hoặc ngưng hoạt động";

    /** Loại phiếu nhặt (DTO, bộ lọc danh sách), suy ra từ danh_sach_nhat_hang.phieu_xuat_kho_id. */
    public static final String LOAI_BAN_HANG = "BAN_HANG";
    public static final String LOAI_CHUYEN_KHO = "CHUYEN_KHO";

    /** Lý do ở màn Hàng cần hoàn kệ, theo loại phiếu nhặt của lệnh trả kệ. */
    static final String LY_DO_HOAN_KE_DON_HUY = "Đơn hàng bị hủy trong luồng xuất kho";
    static final String LY_DO_HOAN_KE_CHUYEN_KHO_HUY = "Phiếu chuyển kho bị hủy";

    /** Số lần thử số kế tiếp khi mã phiếu nhặt vừa sinh đã có. */
    private static final int SO_LAN_THU_MA = 5;

    /** Hai giao dịch cùng lấy một mã phiếu nhặt: khóa duy nhất uk_ma_pick_list chặn giao dịch sau. */
    public static final String LOI_TRUNG_MA_PHIEU_NHAT = "Có người vừa tạo phiếu nhặt cùng lúc, vui lòng thử lại";

    @Autowired
    private DonBanHangRepository donBanHangRepository;

    @Autowired
    private DanhSachNhatHangRepository danhSachNhatHangRepository;

    @Autowired
    private ChiTietNhatHangRepository chiTietNhatHangRepository;

    @Autowired
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;

    @Autowired
    private KhoRepository khoRepository;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private ChiTietNhatHangMapper chiTietNhatHangMapper;

    @Autowired
    private DanhSachNhatHangMapper danhSachNhatHangMapper;

    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;

    @Autowired
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @Autowired
    private PhieuXuatKhoService phieuXuatKhoService;

    @Autowired
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;

    @Autowired
    private CanhBaoRepository canhBaoRepository;

    @Autowired
    private ChiTietDonBanHangRepository chiTietDonBanHangRepository;

    @Autowired
    private com.dev.backend.websocket.OutboundWebSocketHandler outboundWebSocketHandler;

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private com.dev.backend.services.multitable.BangChungDongGoiService bangChungDongGoiService;

    @Autowired
    private PhanBoLoNhatHangRepository phanBoLoNhatHangRepository;

    @Autowired
    private LoHangRepository loHangRepository;

    @Autowired
    private LoDangGiuService loDangGiuService;

    @Autowired
    private GiuChoChuyenKhoService giuChoChuyenKhoService;

    @Autowired
    private EntityManager entityManager;

    @Override
    @Transactional(readOnly = true)
    public Page<DonChoXuatDto> getDonChoXuat(DonChoXuatFilterRequest filterRequest) {
        Integer khoId = SecurityContextHolder.getKhoId();
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();

        if (authUser == null) {
            throw new CommonException("Người dùng chưa được xác thực trong hệ thống");
        }

        boolean isAdmin = authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (isAdmin && filterRequest.getKhoId() != null) {
            khoId = filterRequest.getKhoId();
        }

        if (khoId == null) {
            throw new CommonException("Vui lòng chọn ngữ cảnh kho làm việc");
        }

        final Integer finalKhoId = khoId;

        // Xây dựng Specification lọc đơn hàng chờ xuất
        Specification<DonBanHang> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Chỉ lấy đơn bán hàng (loại bỏ báo giá)
            predicates.add(cb.equal(root.get("loaiChungTu"), "don_ban_hang"));

            // 1 Chờ nhặt hàng; 2 Đã xuất một phần (dữ liệu cũ) nhặt tiếp phần còn lại — phiếu xuất bán hàng chỉ sinh
            // từ phiếu nhặt nên đơn 2 không còn đường nào khác để xuất nốt
            predicates.add(root.get("trangThai").in(ITrangThaiDonBanHang.CHO_NHAT_HANG, ITrangThaiDonBanHang.DANG_XUAT_KHO));

            // Đơn chưa được gom vào Pick List nào
            predicates.add(cb.isNull(root.get("danhSachNhatHang")));

            // Phải thuộc đúng kho xuất
            predicates.add(cb.equal(root.get("khoXuat").get("id"), finalKhoId));

            // Tìm kiếm theo mã đơn hoặc tên khách hàng
            if (StringUtils.hasText(filterRequest.getSearchText())) {
                String pattern = "%" + filterRequest.getSearchText().trim().toLowerCase() + "%";
                Predicate pSoDon = cb.like(cb.lower(root.get("soDonHang")), pattern);
                Predicate pKhach = cb.like(cb.lower(root.get("khachHang").get("tenKhachHang")), pattern);
                predicates.add(cb.or(pSoDon, pKhach));
            }

            // Lọc theo kênh bán hàng
            if (filterRequest.getKenhBanId() != null) {
                predicates.add(cb.equal(root.get("kenhBanHang").get("id"), filterRequest.getKenhBanId()));
            }

            // Lọc theo khoảng ngày tạo / đặt hàng
            if (filterRequest.getTuNgay() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("ngayDatHang"), filterRequest.getTuNgay()));
            }
            if (filterRequest.getDenNgay() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("ngayDatHang"), filterRequest.getDenNgay()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        // Phân trang và sắp xếp
        String sortDir = filterRequest.getSortDir() != null ? filterRequest.getSortDir() : "desc";
        String sortBy = filterRequest.getSortBy() != null ? filterRequest.getSortBy() : "ngayDatHang";
        Sort sort = Sort.by("asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy);

        int pageNum = filterRequest.getPage() != null && filterRequest.getPage() >= 0 ? filterRequest.getPage() : 0;
        int pageSize = filterRequest.getSize() != null && filterRequest.getSize() > 0 ? filterRequest.getSize() : 20;
        Pageable pageable = PageRequest.of(pageNum, pageSize, sort);

        Page<DonBanHang> donPage = donBanHangRepository.findAll(spec, pageable);

        // Trang rỗng (kể cả xin trang vượt số trang) vẫn giữ tổng thật để giao diện lùi về trang cuối còn dữ liệu
        if (donPage.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, donPage.getTotalElements());
        }

        // Tối ưu hóa: Thu thập toàn bộ ID biến thể xuất hiện trong trang để truy vấn tồn khả dụng 1 lần duy nhất
        Set<Integer> allVariantIds = new HashSet<>();
        for (DonBanHang dbh : donPage.getContent()) {
            if (dbh.getChiTietDonBanHangs() != null) {
                for (ChiTietDonBanHang ctd : dbh.getChiTietDonBanHangs()) {
                    if (ctd.getBienTheSanPham() != null && ctd.getBienTheSanPham().getId() != null) {
                        allVariantIds.add(ctd.getBienTheSanPham().getId());
                    }
                }
            }
        }

        // Khả dụng cho đơn chờ = phần còn lại của các lô (trừ đang giữ, phân bổ phiếu nhặt đang mở, dòng lô phiếu xuất
        // bán chưa xuất) − giữ chỗ phiếu chuyển chưa chọn lô — đúng phép phân bổ lô khi tạo phiếu nhặt, nên "Đủ hàng" là
        // tạo phiếu nhặt sẽ phân bổ đủ
        Map<Integer, BigDecimal> availableStockMap = new HashMap<>(loDangGiuService.conLaiTheoBienThe(finalKhoId, allVariantIds));
        giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(finalKhoId, allVariantIds).forEach((id, giu) ->
                availableStockMap.computeIfPresent(id, (k, con) -> con.subtract(giu).max(BigDecimal.ZERO)));

        // Ánh xạ sang DonChoXuatDto kèm kiểm tra khả dụng tồn kho
        List<DonChoXuatDto> dtoList = donPage.getContent().stream().map(dbh -> {
            int uniqueSkuCount = 0;
            BigDecimal totalQty = BigDecimal.ZERO;
            boolean isDuHang = true;

            if (dbh.getChiTietDonBanHangs() != null && !dbh.getChiTietDonBanHangs().isEmpty()) {
                Set<Integer> skuSet = new HashSet<>();
                for (ChiTietDonBanHang ctd : dbh.getChiTietDonBanHangs()) {
                    if (ctd.getBienTheSanPham() != null) {
                        skuSet.add(ctd.getBienTheSanPham().getId());
                        BigDecimal orderQty = soLuongConPhaiXuat(dbh, ctd);
                        totalQty = totalQty.add(orderQty);

                        BigDecimal availableQty = availableStockMap.getOrDefault(ctd.getBienTheSanPham().getId(), BigDecimal.ZERO);
                        if (orderQty.compareTo(availableQty) > 0) {
                            isDuHang = false;
                        }
                    }
                }
                uniqueSkuCount = skuSet.size();
            } else {
                isDuHang = false;
            }

            String tenKenh = "Trực tiếp";
            String maKenh = "DIRECT";
            if (dbh.getKenhBanHang() != null) {
                tenKenh = dbh.getKenhBanHang().getTenKenh();
                maKenh = dbh.getKenhBanHang().getMaKenh();
            }

            return DonChoXuatDto.builder()
                    .id(dbh.getId())
                    .soDonHang(dbh.getSoDonHang())
                    .kenhBanId(dbh.getKenhBanHang() != null ? dbh.getKenhBanHang().getId() : null)
                    .tenKenhBan(tenKenh)
                    .maKenhBan(maKenh)
                    .khachHangId(dbh.getKhachHang() != null ? dbh.getKhachHang().getId() : null)
                    .tenKhachHang(dbh.getKhachHang() != null ? dbh.getKhachHang().getTenKhachHang() : "Khách lẻ")
                    .khoXuatId(dbh.getKhoXuat() != null ? dbh.getKhoXuat().getId() : null)
                    .tenKhoXuat(dbh.getKhoXuat() != null ? dbh.getKhoXuat().getTenKho() : "")
                    .ngayTao(dbh.getNgayDatHang() != null ? dbh.getNgayDatHang() : dbh.getNgayTao())
                    .soLuongSku(uniqueSkuCount)
                    .tongSoLuong(totalQty)
                    .khaDung(isDuHang ? "Đủ hàng" : "Thiếu hàng")
                    .duHang(isDuHang)
                    .trangThai("Chờ nhặt")
                    .tongCong(dbh.getTongCong() != null ? dbh.getTongCong() : BigDecimal.ZERO)
                    .build();
        }).collect(Collectors.toList());

        return new PageImpl<>(dtoList, pageable, donPage.getTotalElements());
    }

    /**
     * READ_COMMITTED: sau khi chờ khóa dòng tồn (phân bổ FIFO), lần đọc phần đang giữ thấy phiếu nhặt / phiếu xuất vừa
     * ghi xong (như PhieuChuyenKhoService.tao); REPEATABLE READ đọc ảnh chụp cũ nên phân bổ chồng lên lô vừa bị giữ.
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public DanhSachNhatHangDto taoPickList(TaoPickListRequest request) {
        if (request.getDonBanHangIds() == null || request.getDonBanHangIds().isEmpty()) {
            throw new CommonException("Vui lòng chọn ít nhất một đơn hàng để tạo Pick List");
        }

        Integer khoId = SecurityContextHolder.getKhoId();
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();

        if (authUser == null) {
            throw new CommonException("Người dùng chưa được xác thực trong hệ thống");
        }

        if (khoId == null) {
            throw new CommonException("Vui lòng chọn ngữ cảnh kho làm việc để tạo Pick List");
        }

        Kho kho = khoRepository.findById(khoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy kho làm việc ID: " + khoId));

        NguoiDung currentUser = nguoiDungRepository.findById(authUser.getId())
                .orElseThrow(() -> new CommonException("Không tìm thấy thông tin người dùng: " + authUser.getId()));

        // Tải danh sách đơn hàng đã chọn
        List<DonBanHang> donList = donBanHangRepository.findAllById(request.getDonBanHangIds());
        if (donList.size() != request.getDonBanHangIds().size()) {
            throw new CommonException("Một số đơn hàng đã chọn không tồn tại trong hệ thống");
        }

        // Kiểm tra hợp lệ nghiệp vụ trên từng đơn hàng
        for (DonBanHang don : donList) {
            if (don.getKhoXuat() == null || !khoId.equals(don.getKhoXuat().getId())) {
                throw new CommonException("Đơn hàng " + don.getSoDonHang() + " không thuộc kho " + kho.getTenKho());
            }
            Integer tt = don.getTrangThai();
            if (tt == null || (tt != ITrangThaiDonBanHang.CHO_NHAT_HANG && tt != ITrangThaiDonBanHang.DANG_XUAT_KHO)) {
                throw new CommonException("Đơn hàng " + don.getSoDonHang() + " không ở trạng thái Chờ nhặt (trạng thái hiện tại: " + don.getTrangThai() + ")");
            }
            if (don.getDanhSachNhatHang() != null) {
                throw new CommonException("Đơn hàng " + don.getSoDonHang() + " đã được gom vào Pick List " + don.getDanhSachNhatHang().getMaPickList());
            }
            if (don.getChiTietDonBanHangs() == null || don.getChiTietDonBanHangs().isEmpty()) {
                throw new CommonException("Đơn hàng " + don.getSoDonHang() + " không có chi tiết sản phẩm");
            }
            if (don.getChiTietDonBanHangs().stream().noneMatch(ctd -> soLuongConPhaiXuat(don, ctd).signum() > 0)) {
                throw new CommonException("Đơn hàng " + don.getSoDonHang() + " đã xuất đủ toàn bộ sản phẩm");
            }
        }

        // Sinh mã Pick List theo quy chuẩn: PL-YYYYMMDD-XXX
        String maPickList = maPickListMoi();

        // Gán nhân viên nhặt hàng nếu có chỉ định
        NguoiDung nguoiNhat = null;
        if (request.getNguoiNhatId() != null) {
            nguoiNhat = nguoiDungRepository.findById(request.getNguoiNhatId())
                    .orElseThrow(() -> new CommonException("Không tìm thấy nhân viên nhặt hàng ID: " + request.getNguoiNhatId()));
            // Cùng quy tắc với phanCongNguoiNhat: tài khoản còn hoạt động; nhân viên kho chỉ giao cho chính mình
            if (nguoiNhat.getTrangThai() == null || nguoiNhat.getTrangThai() != 1) {
                // Không viết "bị khóa": giao diện coi câu có cụm đó là chính người đang thao tác bị khóa và đăng xuất
                throw new CommonException(LOI_NGUOI_NHAT_NGUNG_HOAT_DONG);
            }
            boolean laQuanLy = authUser.getVaiTro() != null && (authUser.getVaiTro().contains(IRoleType.quan_tri_vien)
                    || authUser.getVaiTro().contains(IRoleType.quan_ly_kho));
            if (!laQuanLy && !authUser.getId().equals(nguoiNhat.getId())) {
                throw new CommonException("Nhân viên kho chỉ có quyền tự nhận việc (Self-assignment)");
            }
        }

        // Khởi tạo và lưu DanhSachNhatHang
        DanhSachNhatHang pickList = DanhSachNhatHang.builder()
                .maPickList(maPickList)
                .khoXuat(kho)
                .nguoiNhat(nguoiNhat)
                .trangThai("cho_nhat")
                .ghiChu(request.getGhiChu())
                .ngayTao(Instant.now())
                .build();
        pickList = luuPhieuNhatMoi(pickList);

        // Gom nhóm SKU và tính tổng số lượng cần nhặt (Wave Picking consolidation)
        Map<Integer, BigDecimal> skuQuantityMap = new LinkedHashMap<>();
        Map<Integer, BienTheSanPham> variantMap = new HashMap<>();

        for (DonBanHang don : donList) {
            for (ChiTietDonBanHang ctd : don.getChiTietDonBanHangs()) {
                BienTheSanPham bt = ctd.getBienTheSanPham();
                BigDecimal addQty = soLuongConPhaiXuat(don, ctd);
                if (bt != null && bt.getId() != null && addQty.signum() > 0) {
                    variantMap.put(bt.getId(), bt);
                    BigDecimal curr = skuQuantityMap.getOrDefault(bt.getId(), BigDecimal.ZERO);
                    skuQuantityMap.put(bt.getId(), curr.add(addQty));
                }
            }
        }

        List<ChiTietNhatHang> chiTietList = new ArrayList<>();
        BigDecimal tongSoLuongCanNhat = BigDecimal.ZERO;

        for (Map.Entry<Integer, BigDecimal> entry : skuQuantityMap.entrySet()) {
            ChiTietNhatHang ctn = ChiTietNhatHang.builder()
                    .danhSachNhatHang(pickList)
                    .bienTheSanPham(variantMap.get(entry.getKey()))
                    .soLuongCanNhat(entry.getValue())
                    .soLuongDaQuet(BigDecimal.ZERO)
                    .build();
            chiTietList.add(ctn);
            tongSoLuongCanNhat = tongSoLuongCanNhat.add(entry.getValue());
        }

        chiTietNhatHangRepository.saveAll(chiTietList);
        pickList.setChiTietNhatHangs(chiTietList);

        // Phân bổ lô FIFO ngay khi tạo để giữ lô (phiếu nhặt khác, chuyển kho, POS chỉ thấy phần còn lại);
        // người nhặt sửa tay được trước khi hoàn tất. Lô không đủ thì phân bổ phần có, Hoàn tất nhặt sẽ chặn.
        // Không lấy phần phiếu chuyển đang giữ chỗ (ma trận 3.2: phiếu chuyển giữ chỗ từ lúc tạo).
        phanBoFifoBanDau(khoId, chiTietList, true);

        // Liên kết đơn với Pick List. Đơn GIỮ trạng thái 1 (Chờ nhặt hàng) tới khi hoàn tất nhặt
        // (lúc đó chuyển 7 - Chờ đóng gói); trạng thái 2 chỉ còn nghĩa "đã xuất một phần".
        List<String> maDonList = new ArrayList<>();
        for (DonBanHang don : donList) {
            don.setDanhSachNhatHang(pickList);
            don.setNgayCapNhat(Instant.now());
            maDonList.add(don.getSoDonHang());
        }
        donBanHangRepository.saveAll(donList);
        pickList.setDonBanHangs(donList);

        // Ghi nhận nhật ký kiểm toán (LichSuThayDoi)
        try {
            lichSuThayDoiService.create(
                    LichSuThayDoi.builder()
                            .loaiThamChieu(ITable.danh_sach_nhat_hang)
                            .idThamChieu(pickList.getId())
                            .kho(kho)
                            .hanhDong(IHanhDong.tao_pick_list)
                            .giaTriCu(null)
                            .giaTriMoi("Mã: " + maPickList + ", Gom " + donList.size() + " đơn, " + skuQuantityMap.size() + " SKU, Tổng SL: " + tongSoLuongCanNhat)
                            .nguoiThucHien(currentUser)
                            .ngayThucHien(Instant.now())
                            .ghiChu("Tạo Pick List gom đơn chờ xuất thành công")
                            .build()
            );
        } catch (Exception e) {
            log.warn("Không thể ghi log lịch sử thay đổi cho Pick List {}: {}", maPickList, e.getMessage());
        }

        // Chuyển đổi DTO phản hồi
        DanhSachNhatHangDto resDto = danhSachNhatHangMapper.toDto(pickList);
        dienLoaiPhieu(resDto, pickList);
        resDto.setTongDonHang(donList.size());
        resDto.setTongSku(skuQuantityMap.size());
        resDto.setTongSoLuongCanNhat(tongSoLuongCanNhat);
        resDto.setTongSoLuongDaQuet(BigDecimal.ZERO);
        resDto.setDanhSachMaDonHang(maDonList);

        List<ChiTietNhatHangDto> chiTietDtos = chiTietList.stream()
                .map(chiTietNhatHangMapper::toDto)
                .collect(Collectors.toList());
        resDto.setChiTietNhatHangs(chiTietDtos);

        return resDto;
    }

    /**
     * Mã phiếu nhặt mới PL-yyyyMMdd-XXX: số đuôi lớn nhất của ngày + 1, so theo SỐ (PL-…-1000 sau PL-…-999). Đọc KHÔNG
     * khóa (DanhSachNhatHangRepository.soDuoiLonNhat): khóa dãy mã của ngày giữ khóa dòng phiếu nhặt rồi mới khóa tồn,
     * ngược thứ tự với Hoàn tất nhặt (khóa tồn rồi ghi phiếu nhặt) nên kẹt chéo. Mã vừa sinh đã có thì thử số kế tiếp
     * (câu kiểm cũng không khóa, tối đa SO_LAN_THU_MA lần); hai giao dịch cùng lấy một số thì giao dịch sau bị khóa duy
     * nhất chặn khi lưu (luuPhieuNhatMoi báo 409 "thử lại").
     */
    String maPickListMoi() {
        String tienTo = "PL-" + LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        Number lonNhat = danhSachNhatHangRepository.soDuoiLonNhat(tienTo);
        long so = lonNhat == null ? 0 : lonNhat.longValue();
        for (int lan = 0; lan < SO_LAN_THU_MA; lan++) {
            String ma = SoChungTu.tiepTheoBaChuSo(tienTo, so + lan);
            if (!danhSachNhatHangRepository.existsByMaPickList(ma)) {
                return ma;
            }
            log.warn("Mã phiếu nhặt {} đã có, thử số kế tiếp", ma);
        }
        throw new CommonException("Không cấp được mã phiếu nhặt mới, vui lòng thử lại", HttpStatus.CONFLICT, null);
    }

    /**
     * Lưu phiếu nhặt mới và đẩy câu INSERT ngay: mã vừa cấp bị giao dịch khác chạy cùng lúc dùng trước thì khóa duy nhất
     * uk_ma_pick_list chặn — báo 409 câu rõ để người dùng bấm lại (lỗi ràng buộc làm hỏng giao dịch, không thử số khác
     * trong cùng giao dịch). Lỗi ràng buộc khác giữ nguyên (RestControllerGlobalExceptionHandler trả 409 câu chung).
     */
    private DanhSachNhatHang luuPhieuNhatMoi(DanhSachNhatHang pickList) {
        try {
            DanhSachNhatHang daLuu = danhSachNhatHangRepository.save(pickList);
            danhSachNhatHangRepository.flush();
            return daLuu;
        } catch (DataIntegrityViolationException ex) {
            if (!trungMaPickList(ex, pickList.getMaPickList())) {
                throw ex;
            }
            log.warn("Mã phiếu nhặt {} vừa bị giao dịch khác dùng: {}", pickList.getMaPickList(),
                    ex.getMostSpecificCause().getMessage());
            throw new CommonException(LOI_TRUNG_MA_PHIEU_NHAT, HttpStatus.CONFLICT, null);
        }
    }

    private static boolean trungMaPickList(DataIntegrityViolationException ex, String maPickList) {
        String loi = ex.getMessage() + " " + ex.getMostSpecificCause().getMessage();
        return loi.contains("uk_ma_pick_list") || (maPickList != null && loi.contains("'" + maPickList + "'"));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DanhSachNhatHang taoPhieuNhatChuyenKho(PhieuChuyenKho phieuChuyen, PhieuXuatKho phieuXuat,
                                                   List<ChiTietPhieuChuyenKho> dong) {
        Kho kho = phieuChuyen.getKhoXuat();
        // Chưa phân công (N5): quản lý kho xuất giao, hoặc nhân viên kho tự nhận phiếu chưa có người như phiếu nhặt đơn bán
        DanhSachNhatHang pickList = luuPhieuNhatMoi(DanhSachNhatHang.builder()
                .maPickList(maPickListMoi())
                .khoXuat(kho)
                .phieuXuatKho(phieuXuat)
                .trangThai("cho_nhat")
                .ghiChu("Nhặt hàng cho phiếu chuyển " + phieuChuyen.getSoPhieuChuyen()
                        + (phieuChuyen.getKhoNhap() != null ? " → " + phieuChuyen.getKhoNhap().getTenKho() : ""))
                .ngayTao(Instant.now())
                .build());

        // Một dòng nhặt mỗi biến thể (phiếu chuyển đã gộp theo biến thể, khóa duy nhất phiếu + biến thể)
        List<ChiTietNhatHang> chiTietList = new ArrayList<>();
        BigDecimal tong = BigDecimal.ZERO;
        for (ChiTietPhieuChuyenKho ct : dong) {
            BigDecimal soLuong = BigDecimal.valueOf(ct.getSoLuongChuyen() == null ? 0 : ct.getSoLuongChuyen());
            if (ct.getBienTheSanPham() == null || soLuong.signum() <= 0) continue;
            chiTietList.add(ChiTietNhatHang.builder()
                    .danhSachNhatHang(pickList)
                    .bienTheSanPham(ct.getBienTheSanPham())
                    .soLuongCanNhat(soLuong)
                    .soLuongDaQuet(BigDecimal.ZERO)
                    .build());
            tong = tong.add(soLuong);
        }
        chiTietNhatHangRepository.saveAll(chiTietList);
        pickList.setChiTietNhatHangs(chiTietList);

        // Giữ lô ngay như phiếu nhặt đơn bán: phân bổ FIFO, phần lô không đủ thì Hoàn tất nhặt chặn. Không trừ giữ chỗ
        // phiếu chuyển: phần giữ chỗ đó gồm chính phiếu này, phiếu khác đã được trừ khi duyệt (kiemTraKhaDung)
        phanBoFifoBanDau(kho.getId(), chiTietList, false);

        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        if (authUser != null) {
            ghiNhatKySauCommit(pickList, IHanhDong.tao_pick_list, null,
                    "Mã: " + pickList.getMaPickList() + ", phiếu chuyển " + phieuChuyen.getSoPhieuChuyen() + ", "
                            + chiTietList.size() + " SKU, Tổng SL: " + hienThi(tong),
                    "Tạo phiếu nhặt khi duyệt phiếu chuyển " + phieuChuyen.getSoPhieuChuyen()
                            + " (phiếu xuất " + phieuXuat.getSoPhieuXuat() + ")", authUser.getId());
        }
        return pickList;
    }

    /** Loại phiếu nhặt và phiếu chuyển kho của nó (loại CHUYEN_KHO) cho DTO danh sách / chi tiết. */
    private static void dienLoaiPhieu(DanhSachNhatHangDto dto, DanhSachNhatHang pickList) {
        PhieuXuatKho px = pickList.getPhieuXuatKho();
        dto.setLoaiPhieu(px != null ? LOAI_CHUYEN_KHO : LOAI_BAN_HANG);
        if (px == null) return;
        dto.setPhieuXuatKhoId(px.getId());
        dto.setSoPhieuXuat(px.getSoPhieuXuat());
        PhieuChuyenKho pck = px.getPhieuChuyenKho();
        if (pck != null) {
            dto.setPhieuChuyenKhoId(pck.getId());
            dto.setSoPhieuChuyen(pck.getSoPhieuChuyen());
            dto.setTrangThaiPhieuChuyen(pck.getTrangThai());
            dto.setTenKhoNhan(pck.getKhoNhap() != null ? pck.getKhoNhap().getTenKho() : null);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DanhSachNhatHangDto> getDanhSachPickList(Integer khoId, String trangThai, String loai, String searchText,
                                                         Pageable pageable) {
        Integer contextKhoId = SecurityContextHolder.getKhoId();
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();

        if (authUser == null) {
            throw new CommonException("Người dùng chưa được xác thực");
        }

        boolean isAdmin = authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (isAdmin && khoId != null) {
            contextKhoId = khoId;
        }

        if (contextKhoId == null) {
            throw new CommonException("Vui lòng chọn ngữ cảnh kho làm việc");
        }

        final Integer finalKhoId = contextKhoId;

        Specification<DanhSachNhatHang> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("khoXuat").get("id"), finalKhoId));

            if (StringUtils.hasText(trangThai)) {
                predicates.add(cb.equal(root.get("trangThai"), trangThai));
            }

            // Loại phiếu: phiếu chuyển kho có phiếu xuất PX-CK, phiếu gom đơn bán thì không
            if (LOAI_CHUYEN_KHO.equalsIgnoreCase(loai)) {
                predicates.add(cb.isNotNull(root.get("phieuXuatKho")));
            } else if (LOAI_BAN_HANG.equalsIgnoreCase(loai)) {
                predicates.add(cb.isNull(root.get("phieuXuatKho")));
            }

            if (StringUtils.hasText(searchText)) {
                String pattern = "%" + searchText.trim().toLowerCase() + "%";
                // Nối ngoài: phiếu chưa phân công / không phải chuyển kho vẫn tìm được theo mã
                Join<DanhSachNhatHang, NguoiDung> nguoiNhat = root.join("nguoiNhat", JoinType.LEFT);
                Join<DanhSachNhatHang, PhieuXuatKho> phieuXuat = root.join("phieuXuatKho", JoinType.LEFT);
                Join<PhieuXuatKho, PhieuChuyenKho> phieuChuyen = phieuXuat.join("phieuChuyenKho", JoinType.LEFT);
                Predicate pMa = cb.like(cb.lower(root.get("maPickList")), pattern);
                Predicate pNguoiNhat = cb.like(cb.lower(nguoiNhat.get("hoTen")), pattern);
                Predicate pPhieuChuyen = cb.like(cb.lower(phieuChuyen.get("soPhieuChuyen")), pattern);
                predicates.add(cb.or(pMa, pNguoiNhat, pPhieuChuyen));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        // Chuẩn hóa và làm sạch Pageable sort, loại bỏ triệt để các ký tự [, ], ", ' do Swagger UI gây ra
        Pageable safePageable = pageable;
        if (pageable != null && pageable.getSort().isSorted()) {
            List<Sort.Order> safeOrders = new ArrayList<>();
            List<String> validFields = List.of("id", "maPickList", "ngayTao", "ngayHoanTat", "trangThai");
            for (Sort.Order order : pageable.getSort()) {
                String prop = order.getProperty();
                if (prop != null) {
                    prop = prop.replaceAll("[\\[\\]\"']", "").trim();
                }
                if (validFields.contains(prop)) {
                    safeOrders.add(new Sort.Order(order.getDirection(), prop));
                }
            }
            if (!safeOrders.isEmpty()) {
                safePageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(safeOrders));
            } else {
                safePageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "ngayTao"));
            }
        } else if (pageable == null) {
            safePageable = PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "ngayTao"));
        }

        Page<DanhSachNhatHang> pickListPage = danhSachNhatHangRepository.findAll(spec, safePageable);

        List<DanhSachNhatHangDto> dtoList = pickListPage.getContent().stream().map(pl -> {
            DanhSachNhatHangDto dto = danhSachNhatHangMapper.toDto(pl);
            dienLoaiPhieu(dto, pl);

            int orderCount = pl.getDonBanHangs() != null ? pl.getDonBanHangs().size() : 0;
            List<String> orderCodes = pl.getDonBanHangs() != null
                    ? pl.getDonBanHangs().stream().map(DonBanHang::getSoDonHang).collect(Collectors.toList())
                    : Collections.emptyList();

            int skuCount = pl.getChiTietNhatHangs() != null ? pl.getChiTietNhatHangs().size() : 0;
            BigDecimal totalCanNhat = BigDecimal.ZERO;
            BigDecimal totalDaQuet = BigDecimal.ZERO;

            if (pl.getChiTietNhatHangs() != null) {
                for (ChiTietNhatHang ctn : pl.getChiTietNhatHangs()) {
                    if (ctn.getSoLuongCanNhat() != null) totalCanNhat = totalCanNhat.add(ctn.getSoLuongCanNhat());
                    if (ctn.getSoLuongDaQuet() != null) totalDaQuet = totalDaQuet.add(ctn.getSoLuongDaQuet());
                }
            }

            dto.setTongDonHang(orderCount);
            dto.setTongSku(skuCount);
            dto.setTongSoLuongCanNhat(totalCanNhat);
            dto.setTongSoLuongDaQuet(totalDaQuet);
            dto.setDanhSachMaDonHang(orderCodes);

            return dto;
        }).collect(Collectors.toList());

        return new PageImpl<>(dtoList, pageable, pickListPage.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public DanhSachNhatHangDto getChiTietPickList(Integer id) {
        DanhSachNhatHang pickList = danhSachNhatHangRepository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy đợt nhặt hàng Pick List ID: " + id));

        Integer contextKhoId = SecurityContextHolder.getKhoId();
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        boolean isAdmin = authUser != null && authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_tri_vien);

        if (!isAdmin && contextKhoId != null && !contextKhoId.equals(pickList.getKhoXuat().getId())) {
            throw new CommonException("Bạn không có quyền truy cập Pick List thuộc kho khác");
        }

        DanhSachNhatHangDto dto = danhSachNhatHangMapper.toDto(pickList);
        dienLoaiPhieu(dto, pickList);

        int orderCount = pickList.getDonBanHangs() != null ? pickList.getDonBanHangs().size() : 0;
        List<String> orderCodes = pickList.getDonBanHangs() != null
                ? pickList.getDonBanHangs().stream().map(DonBanHang::getSoDonHang).collect(Collectors.toList())
                : Collections.emptyList();

        int skuCount = pickList.getChiTietNhatHangs() != null ? pickList.getChiTietNhatHangs().size() : 0;
        BigDecimal totalCanNhat = BigDecimal.ZERO;
        BigDecimal totalDaQuet = BigDecimal.ZERO;

        if (pickList.getChiTietNhatHangs() != null) {
            for (ChiTietNhatHang ctn : pickList.getChiTietNhatHangs()) {
                if (ctn.getSoLuongCanNhat() != null) totalCanNhat = totalCanNhat.add(ctn.getSoLuongCanNhat());
                if (ctn.getSoLuongDaQuet() != null) totalDaQuet = totalDaQuet.add(ctn.getSoLuongDaQuet());
            }
        }

        double percent = 0.0;
        if (totalCanNhat.compareTo(BigDecimal.ZERO) > 0) {
            percent = totalDaQuet.multiply(BigDecimal.valueOf(100))
                    .divide(totalCanNhat, 2, java.math.RoundingMode.HALF_UP).doubleValue();
            if (percent > 100.0) percent = 100.0;
        }

        boolean allDone = totalCanNhat.compareTo(BigDecimal.ZERO) > 0;
        if (pickList.getChiTietNhatHangs() != null) {
            for (ChiTietNhatHang ctn : pickList.getChiTietNhatHangs()) {
                BigDecimal can = ctn.getSoLuongCanNhat() != null ? ctn.getSoLuongCanNhat() : BigDecimal.ZERO;
                BigDecimal da = ctn.getSoLuongDaQuet() != null ? ctn.getSoLuongDaQuet() : BigDecimal.ZERO;
                if (da.compareTo(can) < 0) {
                    allDone = false;
                    break;
                }
            }
        }

        dto.setTongDonHang(orderCount);
        dto.setTongSku(skuCount);
        dto.setTongSoLuongCanNhat(totalCanNhat);
        dto.setTongSoLuongDaQuet(totalDaQuet);
        dto.setPhanTramHoanThanh(percent);
        // Chỉ phiếu đang mở (chờ nhặt / đang nhặt) mới hoàn tất được
        dto.setCoTheHoanTat(allDone && ("cho_nhat".equals(pickList.getTrangThai()) || "dang_nhat".equals(pickList.getTrangThai())));
        dto.setDanhSachMaDonHang(orderCodes);

        if (pickList.getDonBanHangs() != null) {
            List<Integer> donIds = pickList.getDonBanHangs().stream().map(DonBanHang::getId).collect(Collectors.toList());
            Map<Integer, Boolean> daDuMap = bangChungDongGoiService.kiemTraDaDuBangChungTheoDanhSachDon(donIds);
            Map<Integer, Integer> demMap = bangChungDongGoiService.demSoLuongBangChungTheoDanhSachDon(donIds);

            List<DanhSachNhatHangDto.DonThamChieuDto> donDtos = pickList.getDonBanHangs().stream().map(d -> {
                boolean biHuy = d.getTrangThai() != null && d.getTrangThai() == ITrangThaiDonBanHang.DA_HUY;
                String tenTrangThai = tenTrangThaiDon(d.getTrangThai());
                BigDecimal tongCong = d.getTongCong() != null ? d.getTongCong() : BigDecimal.ZERO;
                boolean yeuCauVideo = tongCong.compareTo(com.dev.backend.services.impl.multitable.BangChungDongGoiServiceImpl.NGUONG_TIEN_VIDEO) >= 0;

                return DanhSachNhatHangDto.DonThamChieuDto.builder()
                        .id(d.getId())
                        .soDonHang(d.getSoDonHang())
                        .trangThai(d.getTrangThai())
                        .tenTrangThai(tenTrangThai)
                        .biHuy(biHuy)
                        .tenKenh(d.getKenhBanHang() != null ? d.getKenhBanHang().getTenKenh() : "Trực tiếp")
                        .tenKhachHang(d.getKhachHang() != null ? d.getKhachHang().getTenKhachHang() : "Khách lẻ")
                        .tomTatHang(tomTatHang(d))
                        .tongCong(tongCong)
                        .yeuCauVideo(yeuCauVideo)
                        .daDuBangChung(daDuMap.getOrDefault(d.getId(), false))
                        .soLuongBangChung(demMap.getOrDefault(d.getId(), 0))
                        .build();
            }).collect(Collectors.toList());
            dto.setDanhSachDonHang(donDtos);
        }

        if (pickList.getChiTietNhatHangs() != null) {
            // Phân bổ lô của từng dòng, sắp FIFO theo ngày lô nhập vào kho xuất. Hệ thống chưa lưu vị trí kệ nên
            // không trả vị trí (trước đây gán cứng "A-01-02").
            Map<Integer, List<PhanBoLoNhatHang>> phanBoTheoDong = phanBoLoNhatHangRepository.findByPhieuNhatId(pickList.getId())
                    .stream().collect(Collectors.groupingBy(pb -> pb.getChiTietNhatHang().getId()));
            Map<Integer, TonKhoTheoLo> tonTheoLo = tonTheoLo(pickList.getKhoXuat().getId(), phanBoTheoDong.values().stream()
                    .flatMap(List::stream).map(pb -> pb.getLoHang().getId()).collect(Collectors.toSet()));
            dto.setChiTietNhatHangs(pickList.getChiTietNhatHangs().stream()
                    .map(ctn -> {
                        ChiTietNhatHangDto itemDto = chiTietNhatHangMapper.toDto(ctn);
                        List<PhanBoLoNhatHang> phanBo = sapPhanBoFifo(phanBoTheoDong.getOrDefault(ctn.getId(), List.of()), tonTheoLo);
                        itemDto.setPhanBoLo(phanBo.stream().map(pb -> PhanBoLoDto.builder()
                                .loHangId(pb.getLoHang().getId())
                                .maLo(pb.getLoHang().getMaLo())
                                .soLuong(pb.getSoLuong())
                                .ngayNhapGanNhat(tonTheoLo.containsKey(pb.getLoHang().getId())
                                        ? tonTheoLo.get(pb.getLoHang().getId()).getNgayNhapGanNhat() : null)
                                .build()).collect(Collectors.toList()));
                        itemDto.setSoLuongDaPhanBo(phanBo.stream().map(PhanBoLoNhatHang::getSoLuong)
                                .reduce(BigDecimal.ZERO, BigDecimal::add));
                        itemDto.setPhanBoThuCong(phanBo.stream().anyMatch(pb -> pb.getNguoiCapNhat() != null));
                        return itemDto;
                    })
                    .collect(Collectors.toList()));
        }

        return dto;
    }

    // ===================== phân bổ lô (Log 2) =====================

    @Override
    @Transactional(readOnly = true)
    public List<LoKhaDungNhatHangDto> getLoKhaDungChoDong(Integer pickListId, Integer chiTietId) {
        DanhSachNhatHang pickList = danhSachNhatHangRepository.findById(pickListId)
                .orElseThrow(() -> new CommonException("Không tìm thấy đợt nhặt hàng Pick List ID: " + pickListId));
        kiemTraKhoPhieuNhat(pickList);
        ChiTietNhatHang dong = layDongCuaPhieu(pickList, chiTietId);
        Integer khoId = pickList.getKhoXuat().getId();

        Map<Integer, BigDecimal> cuaDong = new HashMap<>();
        phanBoLoNhatHangRepository.findByChiTietId(dong.getId())
                .forEach(pb -> cuaDong.merge(pb.getLoHang().getId(), pb.getSoLuong(), BigDecimal::add));

        List<TonKhoTheoLo> tonList = tonKhoTheoLoRepository.findByKhoAndBienThe(khoId, dong.getBienTheSanPham().getId());
        Map<Integer, BigDecimal> dangGiu = loDangGiuService.dangGiuTheoLo(khoId,
                tonList.stream().map(t -> t.getLoHang().getId()).toList(), pickList.getId(), null);

        return tonList.stream()
                .filter(t -> cuaDong.containsKey(t.getLoHang().getId())
                        || (t.getSoLuongTon() != null && t.getSoLuongTon().signum() > 0))
                .sorted(LoDangGiuService.FIFO)
                .map(t -> LoKhaDungNhatHangDto.builder()
                        .loHangId(t.getLoHang().getId())
                        .maLo(t.getLoHang().getMaLo())
                        .ngayNhapGanNhat(t.getNgayNhapGanNhat())
                        .conLai(LoDangGiuService.conLai(t, dangGiu).max(BigDecimal.ZERO))
                        .daPhanBo(cuaDong.getOrDefault(t.getLoHang().getId(), BigDecimal.ZERO))
                        .build())
                .collect(Collectors.toList());
    }

    /** READ_COMMITTED: sau khi chờ khóa dòng tồn, phần phiếu khác đang giữ đọc được bản vừa ghi xong (xem taoPickList). */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public DanhSachNhatHangDto luuPhanBoLo(Integer pickListId, Integer chiTietId, PhanBoLoNhatHangRequest request) {
        DanhSachNhatHang pickList = danhSachNhatHangRepository.findById(pickListId)
                .orElseThrow(() -> new CommonException("Không tìm thấy đợt nhặt hàng Pick List ID: " + pickListId));
        NguoiDungAuthInfo authUser = kiemTraKhoPhieuNhat(pickList);
        // Khóa dòng nhặt rồi phiếu nhặt và đọc lại bản mới nhất TRƯỚC khi kiểm trạng thái, người nhặt và số cần nhặt (như
        // quét mã): lưu chạy chồng với Hoàn tất / Hủy phiếu chuyển / phân công lại / đơn bị hủy thì chờ rồi bị chặn ở dưới
        List<ChiTietNhatHang> dongDaKhoa = khoaDongVaPhieuNhat(pickList);
        if (!"cho_nhat".equals(pickList.getTrangThai()) && !"dang_nhat".equals(pickList.getTrangThai())) {
            throw new CommonException("Phiếu nhặt " + pickList.getMaPickList() + " đã kết thúc nhặt nên không sửa phân bổ lô được.",
                    HttpStatus.CONFLICT, null);
        }
        // Người được giao nhặt, hoặc quản lý kho / quản trị viên sửa thay
        boolean laQuanLy = authUser.getVaiTro() != null && (authUser.getVaiTro().contains(IRoleType.quan_tri_vien)
                || authUser.getVaiTro().contains(IRoleType.quan_ly_kho));
        boolean laNguoiNhat = pickList.getNguoiNhat() != null && authUser.getId().equals(pickList.getNguoiNhat().getId());
        if (!laQuanLy && !laNguoiNhat) {
            throw new CommonException(pickList.getNguoiNhat() == null
                    ? "Phiếu nhặt " + pickList.getMaPickList() + " chưa được phân công. Nhận việc trước khi phân bổ lô."
                    : "Chỉ người được giao nhặt (" + pickList.getNguoiNhat().getHoTen() + ") hoặc quản lý kho mới sửa được phân bổ lô.",
                    HttpStatus.CONFLICT, null);
        }

        ChiTietNhatHang dong = dongDaKhoa.stream().filter(ct -> ct.getId().equals(chiTietId)).findFirst()
                .orElseThrow(() -> new CommonException("Dòng sản phẩm không thuộc phiếu nhặt " + pickList.getMaPickList(),
                        HttpStatus.NOT_FOUND, null));
        // Dòng có thể đã nạp trước đó trong request (open-in-view): đọc lại số cần nhặt mới nhất sau khi khóa
        entityManager.refresh(dong);
        Integer bienTheId = dong.getBienTheSanPham().getId();
        String sku = dong.getBienTheSanPham().getMaSku();

        if (request == null || request.getPhanBo() == null) {
            throw new CommonException("Thiếu danh sách phân bổ lô");
        }
        Map<Integer, BigDecimal> yeuCau = new LinkedHashMap<>();
        for (PhanBoLoNhatHangRequest.Item item : request.getPhanBo()) {
            if (item == null || item.getLoHangId() == null || item.getSoLuong() == null) {
                throw new CommonException("Mỗi dòng phân bổ phải có lô và số lượng");
            }
            if (item.getSoLuong().signum() < 0) {
                throw new CommonException("Số lượng lấy từ lô không được âm");
            }
            if (yeuCau.containsKey(item.getLoHangId())) {
                throw new CommonException("Một lô chỉ được khai một lần trong phân bổ");
            }
            if (item.getSoLuong().signum() > 0) {
                yeuCau.put(item.getLoHangId(), item.getSoLuong());
            }
        }
        BigDecimal tongYeuCau = yeuCau.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal canNhat = dong.getSoLuongCanNhat() != null ? dong.getSoLuongCanNhat() : BigDecimal.ZERO;
        if (tongYeuCau.compareTo(canNhat) != 0) {
            throw new CommonException("Tổng phân bổ của [" + sku + "] là " + hienThi(tongYeuCau)
                    + ", phải bằng số cần nhặt " + hienThi(canNhat));
        }

        Integer khoId = pickList.getKhoXuat().getId();
        Map<Integer, TonKhoTheoLo> tonTheoLo = loDangGiuService.khoaTonTheoBienThe(khoId, List.of(bienTheId)).stream()
                .collect(Collectors.toMap(t -> t.getLoHang().getId(), t -> t, (a, b) -> a));
        Map<Integer, BigDecimal> dangGiu = loDangGiuService.dangGiuTheoLo(khoId, tonTheoLo.keySet(), pickList.getId(), null);
        List<PhanBoLoFifo.Lo> phanBoMoi = new ArrayList<>();
        for (Map.Entry<Integer, BigDecimal> e : yeuCau.entrySet()) {
            LoHang lo = loHangRepository.findById(e.getKey())
                    .orElseThrow(() -> new CommonException("Không tìm thấy lô hàng ID: " + e.getKey()));
            if (lo.getBienTheSanPham() == null || !bienTheId.equals(lo.getBienTheSanPham().getId())) {
                throw new CommonException("Lô " + lo.getMaLo() + " không phải lô của sản phẩm [" + sku + "]");
            }
            TonKhoTheoLo ton = tonTheoLo.get(lo.getId());
            BigDecimal conLai = ton != null ? LoDangGiuService.conLai(ton, dangGiu) : BigDecimal.ZERO;
            if (e.getValue().compareTo(conLai) > 0) {
                throw new CommonException("Lô " + lo.getMaLo() + " chỉ còn " + hienThi(conLai.max(BigDecimal.ZERO))
                        + " có thể lấy (phần còn lại đang được phiếu khác giữ), không đủ " + hienThi(e.getValue()),
                        HttpStatus.CONFLICT, null);
            }
            phanBoMoi.add(new PhanBoLoFifo.Lo(lo.getId(), e.getValue()));
        }
        // Phiếu nhặt đơn bán không lấy phần phiếu chuyển đang giữ chỗ mà chưa chọn lô (phiếu nhặt chuyển kho đã được
        // kiểm khi duyệt phiếu chuyển)
        if (!pickList.laChuyenKho()) {
            BigDecimal giuChoChuyen = giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(khoId, List.of(bienTheId))
                    .getOrDefault(bienTheId, BigDecimal.ZERO);
            BigDecimal conLaiCuaMa = tonTheoLo.values().stream()
                    .map(t -> LoDangGiuService.conLai(t, dangGiu).max(BigDecimal.ZERO))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (giuChoChuyen.signum() > 0 && tongYeuCau.compareTo(conLaiCuaMa.subtract(giuChoChuyen)) > 0) {
                throw new CommonException("[" + sku + "] chỉ còn " + hienThi(conLaiCuaMa.subtract(giuChoChuyen).max(BigDecimal.ZERO))
                        + " có thể lấy: phiếu chuyển kho đang giữ chỗ " + hienThi(giuChoChuyen) + ". Không đủ "
                        + hienThi(tongYeuCau) + ".", HttpStatus.CONFLICT, null);
            }
        }

        NguoiDung nguoiSua = nguoiDungRepository.findById(authUser.getId()).orElse(null);
        String cu = moTaPhanBo(phanBoLoNhatHangRepository.findByChiTietId(dong.getId()));
        phanBoLoNhatHangRepository.deleteByChiTietId(dong.getId());
        for (PhanBoLoFifo.Lo lo : phanBoMoi) {
            phanBoLoNhatHangRepository.save(PhanBoLoNhatHang.builder()
                    .chiTietNhatHang(dong)
                    .loHang(loHangRepository.getReferenceById(lo.loHangId()))
                    .soLuong(lo.soLuong())
                    .nguoiCapNhat(nguoiSua)
                    .ngayCapNhat(Instant.now())
                    .build());
        }

        String moi = phanBoMoi.stream().map(lo -> maLo(tonTheoLo, lo.loHangId()) + " × " + hienThi(lo.soLuong()))
                .collect(Collectors.joining(", "));
        ghiNhatKySauCommit(pickList, IHanhDong.phan_bo_lo_nhat_hang, cu, moi,
                "Phân bổ lô cho [" + sku + "] ở phiếu nhặt " + pickList.getMaPickList(), authUser.getId());
        return getChiTietPickList(pickList.getId());
    }

    /** Kiểm tra quyền truy cập kho của phiếu nhặt (quản trị viên xem mọi kho), trả người đang thao tác. */
    private NguoiDungAuthInfo kiemTraKhoPhieuNhat(DanhSachNhatHang pickList) {
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        if (authUser == null) {
            throw new CommonException("Người dùng chưa được xác thực trong hệ thống");
        }
        boolean isAdmin = authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        Integer contextKhoId = SecurityContextHolder.getKhoId();
        if (!isAdmin && contextKhoId != null && !contextKhoId.equals(pickList.getKhoXuat().getId())) {
            throw new CommonException("Bạn không có quyền thao tác trên Pick List thuộc kho khác");
        }
        return authUser;
    }

    private static ChiTietNhatHang layDongCuaPhieu(DanhSachNhatHang pickList, Integer chiTietId) {
        return (pickList.getChiTietNhatHangs() == null ? List.<ChiTietNhatHang>of() : pickList.getChiTietNhatHangs())
                .stream().filter(ct -> ct.getId().equals(chiTietId)).findFirst()
                .orElseThrow(() -> new CommonException("Dòng sản phẩm không thuộc phiếu nhặt " + pickList.getMaPickList(),
                        HttpStatus.NOT_FOUND, null));
    }

    /**
     * Phân bổ FIFO cho các dòng vừa tạo của phiếu nhặt (giữ lô ngay khi tạo). Mỗi dòng một biến thể khác nhau nên
     * lô không chồng nhau giữa các dòng. Lô không đủ thì phân bổ phần có.
     * {@code truGiuChoChuyen}: phiếu nhặt đơn bán không lấy phần phiếu chuyển đang giữ chỗ mà chưa chọn lô (đọc sau khi khóa
     * dòng tồn, như lúc tạo phiếu chuyển).
     */
    private void phanBoFifoBanDau(Integer khoId, List<ChiTietNhatHang> dongs, boolean truGiuChoChuyen) {
        List<Integer> bienTheIds = dongs.stream().map(d -> d.getBienTheSanPham().getId()).distinct().toList();
        List<TonKhoTheoLo> tonList = loDangGiuService.khoaTonTheoBienThe(khoId, bienTheIds);
        Map<Integer, BigDecimal> dangGiu = loDangGiuService.dangGiuTheoLo(khoId,
                tonList.stream().map(t -> t.getLoHang().getId()).toList(), null, null);
        Map<Integer, BigDecimal> giuChoChuyen = truGiuChoChuyen
                ? giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(khoId, bienTheIds) : Map.of();
        for (ChiTietNhatHang dong : dongs) {
            List<PhanBoLoFifo.Lo> conLai = conLaiTheoFifo(tonList, dong.getBienTheSanPham().getId(), dangGiu, Map.of());
            BigDecimal duocLay = PhanBoLoFifo.tong(conLai)
                    .subtract(giuChoChuyen.getOrDefault(dong.getBienTheSanPham().getId(), BigDecimal.ZERO)).max(BigDecimal.ZERO);
            for (PhanBoLoFifo.Lo lo : PhanBoLoFifo.layFifo(conLai, dong.getSoLuongCanNhat().min(duocLay))) {
                phanBoLoNhatHangRepository.save(PhanBoLoNhatHang.builder()
                        .chiTietNhatHang(dong)
                        .loHang(loHangRepository.getReferenceById(lo.loHangId()))
                        .soLuong(lo.soLuong())
                        .ngayCapNhat(Instant.now())
                        .build());
            }
        }
    }

    /**
     * Còn lại của các lô một biến thể theo thứ tự FIFO, cộng lại phần {@code daCo} (phân bổ hiện có của chính
     * dòng, không tính là "đang giữ" với chính nó). Lô còn lại ≤ 0 bị bỏ.
     */
    private static List<PhanBoLoFifo.Lo> conLaiTheoFifo(List<TonKhoTheoLo> tonList, Integer bienTheId,
                                                        Map<Integer, BigDecimal> dangGiu, Map<Integer, BigDecimal> daCo) {
        return tonList.stream()
                .filter(t -> bienTheId.equals(t.getLoHang().getBienTheSanPham().getId()))
                .sorted(LoDangGiuService.FIFO)
                .map(t -> new PhanBoLoFifo.Lo(t.getLoHang().getId(),
                        LoDangGiuService.conLai(t, dangGiu).subtract(daCo.getOrDefault(t.getLoHang().getId(), BigDecimal.ZERO))))
                .filter(lo -> lo.soLuong().signum() > 0)
                .collect(Collectors.toList());
    }

    private Map<Integer, TonKhoTheoLo> tonTheoLo(Integer khoId, Collection<Integer> loHangIds) {
        if (loHangIds.isEmpty()) return Map.of();
        return tonKhoTheoLoRepository.findByKho_IdAndLoHang_IdIn(khoId, loHangIds).stream()
                .collect(Collectors.toMap(t -> t.getLoHang().getId(), t -> t, (a, b) -> a));
    }

    /** Sắp phân bổ theo FIFO của lô tại kho (lô không còn dòng tồn xếp cuối). */
    private static List<PhanBoLoNhatHang> sapPhanBoFifo(List<PhanBoLoNhatHang> phanBo, Map<Integer, TonKhoTheoLo> tonTheoLo) {
        return phanBo.stream().sorted(Comparator
                .comparing((PhanBoLoNhatHang pb) -> {
                    TonKhoTheoLo t = tonTheoLo.get(pb.getLoHang().getId());
                    return t != null && t.getNgayNhapGanNhat() != null ? t.getNgayNhapGanNhat() : Instant.MAX;
                })
                .thenComparing(pb -> pb.getLoHang().getId()))
                .collect(Collectors.toList());
    }

    private static String moTaPhanBo(List<PhanBoLoNhatHang> phanBo) {
        if (phanBo.isEmpty()) return "Chưa phân bổ";
        return phanBo.stream().map(pb -> pb.getLoHang().getMaLo() + " × " + hienThi(pb.getSoLuong()))
                .collect(Collectors.joining(", "));
    }

    private static String maLo(Map<Integer, TonKhoTheoLo> tonTheoLo, Integer loHangId) {
        TonKhoTheoLo t = tonTheoLo.get(loHangId);
        return t != null ? t.getLoHang().getMaLo() : "#" + loHangId;
    }

    private static String hienThi(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }

    /** Số lượng của dòng đơn còn phải xuất: đặt − đã xuất thật (đơn 2 - đã xuất một phần chỉ nhặt phần còn lại). */
    private BigDecimal soLuongConPhaiXuat(DonBanHang don, ChiTietDonBanHang ctd) {
        BigDecimal dat = ctd.getSoLuongDat() != null ? ctd.getSoLuongDat() : BigDecimal.ZERO;
        if (ctd.getBienTheSanPham() == null || don.getTrangThai() == null
                || don.getTrangThai() != ITrangThaiDonBanHang.DANG_XUAT_KHO) {
            return dat;
        }
        BigDecimal daXuat = chiTietPhieuXuatKhoRepository.sumSoLuongDaXuatThucTe(don.getId(), ctd.getBienTheSanPham().getId());
        return daXuat != null ? dat.subtract(daXuat).max(BigDecimal.ZERO) : dat;
    }

    /** Tóm tắt hàng của đơn cho thẻ đơn ở màn nhặt: "3 × Áo khoác A, 2 × Quần B +1 sản phẩm". */
    private static String tomTatHang(DonBanHang don) {
        List<ChiTietDonBanHang> dongs = don.getChiTietDonBanHangs() != null ? don.getChiTietDonBanHangs() : List.of();
        String dau = dongs.stream().limit(2).map(ct -> {
            BienTheSanPham bt = ct.getBienTheSanPham();
            String ten = bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham()
                    : (bt != null ? bt.getMaSku() : "Sản phẩm");
            return hienThi(ct.getSoLuongDat()) + " × " + ten;
        }).collect(Collectors.joining(", "));
        return dongs.size() > 2 ? dau + " +" + (dongs.size() - 2) + " sản phẩm" : dau;
    }

    /** Nhật ký ghi SAU commit bằng giao dịch riêng: lỗi ghi nhật ký không làm hỏng thao tác chính. */
    private void ghiNhatKySauCommit(DanhSachNhatHang pickList, String hanhDong, String giaTriCu, String giaTriMoi,
                                    String ghiChu, Integer nguoiId) {
        Integer phieuId = pickList.getId();
        Kho kho = pickList.getKhoXuat();
        SauCommit.chay("Ghi nhật ký phiếu nhặt " + pickList.getMaPickList(), () -> lichSuThayDoiService.createGiaoDichRieng(
                LichSuThayDoi.builder()
                        .loaiThamChieu(ITable.danh_sach_nhat_hang)
                        .idThamChieu(phieuId)
                        .kho(kho)
                        .hanhDong(hanhDong)
                        .giaTriCu(giaTriCu)
                        .giaTriMoi(giaTriMoi)
                        .nguoiThucHien(nguoiDungRepository.findById(nguoiId).orElse(null))
                        .ngayThucHien(Instant.now())
                        .ghiChu(ghiChu)
                        .build()));
    }

    /**
     * Chốt lô lúc Hoàn tất nhặt rồi chia cho từng đơn hợp lệ. Trả về [đơn → [biến thể → lô]].
     * <ul>
     *   <li>Phân bổ đã lưu phải còn đủ lô (tồn có thể đã đổi do kiểm kê / điều chỉnh) — không thì bắt phân bổ lại.</li>
     *   <li>Thiếu so với số các đơn cần thì bù theo FIFO; vẫn thiếu thì chặn, báo quản lý kiểm kê.</li>
     *   <li>Phần phân bổ thừa (đơn hủy ngoài luồng phiếu nhặt) bỏ qua: hàng đó phải trả về kệ.</li>
     * </ul>
     */
    private Map<Integer, Map<Integer, List<PhanBoLoFifo.Lo>>> chotVaChiaLo(DanhSachNhatHang pickList,
                                                                           List<ChiTietNhatHang> chiTiets,
                                                                           List<DonBanHang> donHopLe) {
        Integer khoId = pickList.getKhoXuat().getId();
        List<Integer> bienTheIds = chiTiets.stream().map(ct -> ct.getBienTheSanPham().getId()).distinct().toList();
        List<TonKhoTheoLo> tonList = loDangGiuService.khoaTonTheoBienThe(khoId, bienTheIds);
        Map<Integer, TonKhoTheoLo> tonTheoLo = tonList.stream()
                .collect(Collectors.toMap(t -> t.getLoHang().getId(), t -> t, (a, b) -> a));
        Map<Integer, BigDecimal> dangGiu = loDangGiuService.dangGiuTheoLo(khoId, tonTheoLo.keySet(), pickList.getId(), null);
        Map<Integer, BigDecimal> giuChoChuyen = giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(khoId, bienTheIds);
        Map<Integer, List<PhanBoLoNhatHang>> phanBoTheoDong = phanBoLoNhatHangRepository.findByPhieuNhatId(pickList.getId())
                .stream().collect(Collectors.groupingBy(pb -> pb.getChiTietNhatHang().getId()));

        // Đơn đặt sớm nhận lô cũ trước
        List<DonBanHang> donTheoThuTu = donHopLe.stream().sorted(Comparator
                .comparing((DonBanHang d) -> d.getNgayDatHang() != null ? d.getNgayDatHang()
                        : (d.getNgayTao() != null ? d.getNgayTao() : Instant.MAX))
                .thenComparing(DonBanHang::getId)).toList();

        Map<Integer, Map<Integer, List<PhanBoLoFifo.Lo>>> ketQua = new HashMap<>();
        for (ChiTietNhatHang dong : chiTiets) {
            Integer bienTheId = dong.getBienTheSanPham().getId();

            Map<Integer, BigDecimal> canTheoDon = new LinkedHashMap<>();
            for (DonBanHang d : donTheoThuTu) {
                BigDecimal can = (d.getChiTietDonBanHangs() == null ? List.<ChiTietDonBanHang>of() : d.getChiTietDonBanHangs())
                        .stream()
                        .filter(ct -> ct.getBienTheSanPham() != null && bienTheId.equals(ct.getBienTheSanPham().getId()))
                        .map(ct -> soLuongConPhaiXuat(d, ct))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                if (can.signum() > 0) canTheoDon.put(d.getId(), can);
            }
            BigDecimal tongCanDon = canTheoDon.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            if (tongCanDon.signum() == 0) continue;

            List<PhanBoLoFifo.Lo> phanBoFifo = chotLoCuaDong(dong, tongCanDon, tonList, tonTheoLo, dangGiu,
                    phanBoTheoDong.getOrDefault(dong.getId(), List.of()), giuChoChuyen.get(bienTheId));
            PhanBoLoFifo.chiaChoDon(phanBoFifo, canTheoDon).forEach((donId, los) ->
                    ketQua.computeIfAbsent(donId, k -> new HashMap<>()).put(bienTheId, los));
        }
        return ketQua;
    }

    /**
     * Chốt lô của một dòng nhặt lúc Hoàn tất (dùng chung cho phiếu bán và phiếu chuyển kho): phân bổ đã lưu phải còn đủ
     * lô (tồn có thể đã đổi do kiểm kê / điều chỉnh) — không thì bắt phân bổ lại; thiếu so với {@code can} thì bù theo
     * FIFO và lưu phần bù; vẫn thiếu thì chặn, báo quản lý kiểm kê. Trả phân bổ (đã gồm phần bù) sắp FIFO, có thể THỪA
     * so với {@code can} (đơn hủy ngoài luồng phiếu nhặt): bên gọi chỉ lấy đủ phần cần.
     * {@code dangGiu}: phần nơi khác giữ theo lô, KHÔNG tính chính phiếu nhặt này.
     */
    private List<PhanBoLoFifo.Lo> chotLoCuaDong(ChiTietNhatHang dong, BigDecimal can, List<TonKhoTheoLo> tonList,
                                                Map<Integer, TonKhoTheoLo> tonTheoLo, Map<Integer, BigDecimal> dangGiu,
                                                List<PhanBoLoNhatHang> daLuu, BigDecimal giuChoChuyen) {
        Integer bienTheId = dong.getBienTheSanPham().getId();
        String sku = dong.getBienTheSanPham().getMaSku();
        Map<Integer, BigDecimal> daCo = new HashMap<>();
        daLuu.forEach(pb -> daCo.merge(pb.getLoHang().getId(), pb.getSoLuong(), BigDecimal::add));
        for (Map.Entry<Integer, BigDecimal> e : daCo.entrySet()) {
            TonKhoTheoLo t = tonTheoLo.get(e.getKey());
            BigDecimal conLai = t != null ? LoDangGiuService.conLai(t, dangGiu) : BigDecimal.ZERO;
            if (e.getValue().compareTo(conLai) > 0) {
                String maLo = t != null ? t.getLoHang().getMaLo() : daLuu.stream()
                        .filter(pb -> pb.getLoHang().getId().equals(e.getKey()))
                        .map(pb -> pb.getLoHang().getMaLo()).findFirst().orElse("#" + e.getKey());
                throw new CommonException("Lô " + maLo + " của [" + sku + "] chỉ còn " + hienThi(conLai.max(BigDecimal.ZERO))
                        + " nhưng đang phân bổ " + hienThi(e.getValue()) + ". Vui lòng phân bổ lại lô trước khi hoàn tất nhặt.",
                        HttpStatus.CONFLICT, null);
            }
        }

        BigDecimal tongDaCo = daCo.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (tongDaCo.compareTo(can) < 0) {
            List<PhanBoLoFifo.Lo> conLaiFifo = conLaiTheoFifo(tonList, bienTheId, dangGiu, daCo);
            // Phần bù không lấy vào phần phiếu chuyển đang giữ chỗ mà chưa chọn lô (chỉ phiếu nhặt đơn bán truyền > 0)
            BigDecimal giuCho = giuChoChuyen == null ? BigDecimal.ZERO : giuChoChuyen;
            BigDecimal canBu = can.subtract(tongDaCo)
                    .min(PhanBoLoFifo.tong(conLaiFifo).subtract(giuCho).max(BigDecimal.ZERO));
            List<PhanBoLoFifo.Lo> bu = PhanBoLoFifo.layFifo(conLaiFifo, canBu);
            BigDecimal tongSauBu = tongDaCo.add(PhanBoLoFifo.tong(bu));
            if (tongSauBu.compareTo(can) < 0) {
                throw new CommonException("Không đủ tồn theo lô cho [" + sku + "]: cần " + hienThi(can)
                        + ", các lô chỉ còn " + hienThi(tongSauBu) + " có thể lấy"
                        + (giuCho.signum() > 0 ? " (phiếu chuyển kho đang giữ chỗ " + hienThi(giuCho) + ")" : "")
                        + ". Báo quản lý kho kiểm kê trước khi hoàn tất nhặt.",
                        HttpStatus.CONFLICT, null);
            }
            for (PhanBoLoFifo.Lo lo : bu) {
                PhanBoLoNhatHang cu = daLuu.stream().filter(pb -> pb.getLoHang().getId().equals(lo.loHangId()))
                        .findFirst().orElse(null);
                if (cu != null) {
                    cu.setSoLuong(cu.getSoLuong().add(lo.soLuong()));
                    phanBoLoNhatHangRepository.save(cu);
                } else {
                    phanBoLoNhatHangRepository.save(PhanBoLoNhatHang.builder()
                            .chiTietNhatHang(dong)
                            .loHang(loHangRepository.getReferenceById(lo.loHangId()))
                            .soLuong(lo.soLuong())
                            .ngayCapNhat(Instant.now())
                            .build());
                }
                daCo.merge(lo.loHangId(), lo.soLuong(), BigDecimal::add);
            }
        }

        return daCo.entrySet().stream()
                .sorted(Comparator.comparing((Map.Entry<Integer, BigDecimal> e) -> {
                    TonKhoTheoLo t = tonTheoLo.get(e.getKey());
                    return t != null && t.getNgayNhapGanNhat() != null ? t.getNgayNhapGanNhat() : Instant.MAX;
                }).thenComparing(Map.Entry::getKey))
                .map(e -> new PhanBoLoFifo.Lo(e.getKey(), e.getValue()))
                .toList();
    }

    /**
     * Đơn bị hủy khi phiếu nhặt còn mở làm giảm số cần nhặt của dòng: cắt phân bổ từ lô mới nhất cho bằng số mới
     * (phần cắt trả lại cho nơi khác dùng).
     */
    private void catPhanBoTheoSoCanNhat(DanhSachNhatHang pickList, ChiTietNhatHang dong) {
        List<PhanBoLoNhatHang> daLuu = phanBoLoNhatHangRepository.findByChiTietId(dong.getId());
        if (daLuu.isEmpty()) return;
        Map<Integer, TonKhoTheoLo> tonTheoLo = tonTheoLo(pickList.getKhoXuat().getId(),
                daLuu.stream().map(pb -> pb.getLoHang().getId()).collect(Collectors.toSet()));
        List<PhanBoLoNhatHang> theoFifo = sapPhanBoFifo(daLuu, tonTheoLo);
        BigDecimal canMoi = dong.getSoLuongCanNhat() != null ? dong.getSoLuongCanNhat() : BigDecimal.ZERO;
        List<PhanBoLoFifo.Lo> sauCat = PhanBoLoFifo.catTuLoMoiNhat(theoFifo.stream()
                .map(pb -> new PhanBoLoFifo.Lo(pb.getLoHang().getId(), pb.getSoLuong())).toList(), canMoi);
        Map<Integer, BigDecimal> conGiu = sauCat.stream()
                .collect(Collectors.toMap(PhanBoLoFifo.Lo::loHangId, PhanBoLoFifo.Lo::soLuong));
        for (PhanBoLoNhatHang pb : theoFifo) {
            BigDecimal moi = conGiu.get(pb.getLoHang().getId());
            if (moi == null) {
                phanBoLoNhatHangRepository.delete(pb);
            } else if (moi.compareTo(pb.getSoLuong()) != 0) {
                pb.setSoLuong(moi);
                phanBoLoNhatHangRepository.save(pb);
            }
        }
    }

    /** READ_COMMITTED: sau khi chờ khóa phiếu nhặt, các lần đọc tiếp thấy bản vừa ghi xong (xem khoaDongVaPhieuNhat). */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public DanhSachNhatHangDto phanCongNguoiNhat(Integer id, PhanCongNguoiNhatRequest request) {
        if (id == null) {
            throw new CommonException("ID đợt nhặt hàng không được để trống");
        }
        if (request == null || request.getNguoiNhatId() == null) {
            throw new CommonException("ID nhân viên nhặt hàng không được để trống");
        }

        Integer contextKhoId = SecurityContextHolder.getKhoId();
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        if (authUser == null) {
            throw new CommonException("Người dùng chưa được xác thực trong hệ thống");
        }
        if (contextKhoId == null) {
            throw new CommonException("Vui lòng chọn ngữ cảnh kho làm việc");
        }

        DanhSachNhatHang pickList = danhSachNhatHangRepository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy đợt nhặt hàng Pick List ID: " + id));

        boolean isAdmin = authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (!isAdmin && (pickList.getKhoXuat() == null || !contextKhoId.equals(pickList.getKhoXuat().getId()))) {
            throw new CommonException("Bạn không có quyền thao tác trên đợt nhặt hàng của kho khác");
        }

        // Khóa dòng nhặt rồi phiếu nhặt và đọc lại bản mới nhất trước khi kiểm: phân công chạy chồng với Hủy phiếu chuyển /
        // Hoàn tất nhặt thì chờ, rồi bị chặn ở kiểm tra dưới thay vì ghi đè phiếu đã kết thúc (lưu ghi lại mọi cột)
        khoaDongVaPhieuNhat(pickList);

        // Kiểm tra trạng thái hợp lệ của Pick List
        String trangThaiHienTai = pickList.getTrangThai();
        if ("da_nhat".equalsIgnoreCase(trangThaiHienTai) || "da_xuat".equalsIgnoreCase(trangThaiHienTai) || "da_huy".equalsIgnoreCase(trangThaiHienTai)) {
            throw new CommonException("Không thể phân công lại cho đợt nhặt hàng đã ở trạng thái: " + trangThaiHienTai,
                    HttpStatus.CONFLICT, null);
        }

        // Kiểm tra nhân viên được gán
        NguoiDung assignee = nguoiDungRepository.findById(request.getNguoiNhatId())
                .orElseThrow(() -> new CommonException("Không tìm thấy nhân viên nhặt hàng ID: " + request.getNguoiNhatId()));

        if (assignee.getTrangThai() == null || assignee.getTrangThai() != 1) {
            throw new CommonException(LOI_NGUOI_NHAT_NGUNG_HOAT_DONG);
        }

        // Kiểm tra quyền: nếu là nhân viên kho thì chỉ được tự nhận việc (self-assign)
        boolean isQuanLy = isAdmin || (authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_ly_kho));
        if (!isQuanLy && !authUser.getId().equals(request.getNguoiNhatId())) {
            throw new CommonException("Nhân viên kho chỉ có quyền tự nhận việc (Self-assignment)");
        }
        // Nhân viên kho chỉ tự nhận phiếu CHƯA có người nhặt — không nhận lại phiếu đã giao cho người khác
        if (!isQuanLy && pickList.getNguoiNhat() != null && !authUser.getId().equals(pickList.getNguoiNhat().getId())) {
            throw new CommonException("Phiếu nhặt " + pickList.getMaPickList() + " đã được giao cho "
                    + pickList.getNguoiNhat().getHoTen() + ". Liên hệ quản lý kho nếu cần phân công lại.",
                    HttpStatus.CONFLICT, null);
        }

        String oldPickerName = pickList.getNguoiNhat() != null ? pickList.getNguoiNhat().getHoTen() : "Chưa phân công";
        pickList.setNguoiNhat(assignee);
        if (StringUtils.hasText(request.getGhiChu())) {
            pickList.setGhiChu(request.getGhiChu().trim());
        }
        pickList = danhSachNhatHangRepository.save(pickList);

        // Ghi nhận nhật ký kiểm toán
        NguoiDung currentUser = nguoiDungRepository.findById(authUser.getId()).orElse(assignee);
        try {
            lichSuThayDoiService.create(
                    LichSuThayDoi.builder()
                            .loaiThamChieu(ITable.danh_sach_nhat_hang)
                            .idThamChieu(pickList.getId())
                            .kho(pickList.getKhoXuat())
                            .hanhDong(IHanhDong.phan_cong_nhat_hang)
                            .giaTriCu(oldPickerName)
                            .giaTriMoi(assignee.getHoTen() + " (ID: " + assignee.getId() + ")")
                            .nguoiThucHien(currentUser)
                            .ngayThucHien(Instant.now())
                            .ghiChu(StringUtils.hasText(request.getGhiChu()) ? request.getGhiChu() : "Phân công nhân viên nhặt hàng")
                            .build()
            );
        } catch (Exception e) {
            log.warn("Không thể ghi log lịch sử phân công cho Pick List {}: {}", pickList.getMaPickList(), e.getMessage());
        }

        return getChiTietPickList(pickList.getId());
    }

    /** READ_COMMITTED: sau khi chờ khóa dòng nhặt / phiếu nhặt, các lần đọc tiếp thấy bản vừa ghi xong (xem khoaDongVaPhieuNhat). */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public KetQuaQuetBarcodeDto quetBarcode(Integer pickListId, QuetBarcodeRequest request) {
        if (pickListId == null) {
            throw new CommonException("Mã đợt nhặt hàng (Pick List ID) không được để trống");
        }
        if (request == null || !StringUtils.hasText(request.getBarcode())) {
            throw new CommonException("Mã barcode hoặc SKU không được để trống");
        }

        DanhSachNhatHang pickList = danhSachNhatHangRepository.findById(pickListId)
                .orElseThrow(() -> new CommonException("Không tìm thấy đợt nhặt hàng Pick List ID: " + pickListId));

        Integer contextKhoId = SecurityContextHolder.getKhoId();
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        if (authUser == null) {
            throw new CommonException("Người dùng chưa được xác thực trong hệ thống");
        }

        boolean isAdmin = authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (!isAdmin && contextKhoId != null && !contextKhoId.equals(pickList.getKhoXuat().getId())) {
            throw new CommonException("Bạn không có quyền quét nhặt hàng cho Pick List thuộc kho khác");
        }

        // Khóa dòng nhặt rồi phiếu nhặt và đọc lại bản mới nhất TRƯỚC khi kiểm trạng thái: quét chạy chồng với Hủy phiếu
        // chuyển / Hoàn tất nhặt thì chờ, rồi bị chặn ở kiểm tra dưới thay vì ghi đè phiếu đã Đã hủy / Đã nhặt thành Đang
        // nhặt (bảng không có cột phiên bản, lưu ghi lại mọi cột)
        List<ChiTietNhatHang> chiTiets = khoaDongVaPhieuNhat(pickList);

        // Kiểm tra State Machine
        String trangThai = pickList.getTrangThai();
        if ("da_nhat".equals(trangThai)) {
            throw new CommonException("Đợt nhặt hàng này đã hoàn tất quá trình nhặt hàng", HttpStatus.CONFLICT, null);
        }
        if ("da_xuat".equals(trangThai)) {
            throw new CommonException("Đợt nhặt hàng này đã được xuất kho", HttpStatus.CONFLICT, null);
        }
        if ("da_huy".equals(trangThai)) {
            throw new CommonException("Đợt nhặt hàng này đã bị hủy", HttpStatus.CONFLICT, null);
        }

        // Bắt buộc phân công trước khi nhặt, với MỌI vai trò: chỉ người được giao mới quét nhặt được.
        // Quản lý kho / quản trị viên muốn tự nhặt thì phân công cho chính mình trước; nhân viên kho tự nhận việc.
        kiemTraNguoiNhat(pickList, authUser);

        // Nếu đang ở trạng thái cho_nhat, tự động chuyển sang dang_nhat
        if ("cho_nhat".equals(trangThai)) {
            pickList.setTrangThai("dang_nhat");
            danhSachNhatHangRepository.save(pickList);
        }

        String rawBarcode = request.getBarcode().trim();
        BigDecimal qtyToAdd = request.getSoLuong() != null && request.getSoLuong().compareTo(BigDecimal.ZERO) > 0
                ? request.getSoLuong().setScale(3, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ONE.setScale(3, java.math.RoundingMode.HALF_UP);

        if (chiTiets == null || chiTiets.isEmpty()) {
            throw new CommonException("Đợt nhặt hàng không có mặt hàng nào cần nhặt");
        }

        // Tìm dòng chi tiết khớp với mã vạch hoặc SKU
        ChiTietNhatHang matchedItem = null;
        for (ChiTietNhatHang ctn : chiTiets) {
            BienTheSanPham bt = ctn.getBienTheSanPham();
            if (bt != null) {
                boolean matchSku = bt.getMaSku() != null && bt.getMaSku().equalsIgnoreCase(rawBarcode);
                boolean matchBarcode = bt.getMaVachSku() != null && bt.getMaVachSku().equalsIgnoreCase(rawBarcode);
                if (matchSku || matchBarcode) {
                    matchedItem = ctn;
                    break;
                }
            }
        }

        if (matchedItem == null) {
            throw new CommonException("Mã vạch / SKU [" + rawBarcode + "] không thuộc danh sách mặt hàng cần nhặt của đợt này!");
        }

        // Dòng đã khóa ở trên (chống mất cập nhật khi quét chồng hoặc webhook hủy đơn giảm số cần nhặt); nạp lại số của
        // dòng sẽ ghi: câu khóa không ghi đè thực thể đã nạp trước đó trong request
        ChiTietNhatHang lockedItem = matchedItem;
        entityManager.refresh(lockedItem);

        BigDecimal currentScanned = lockedItem.getSoLuongDaQuet() != null ? lockedItem.getSoLuongDaQuet() : BigDecimal.ZERO;
        BigDecimal required = lockedItem.getSoLuongCanNhat() != null ? lockedItem.getSoLuongCanNhat() : BigDecimal.ZERO;

        if (currentScanned.compareTo(required) >= 0) {
            throw new CommonException("Mặt hàng [" + (lockedItem.getBienTheSanPham() != null ? lockedItem.getBienTheSanPham().getMaSku() : rawBarcode) + "] đã nhặt đủ số lượng yêu cầu (" + currentScanned + "/" + required + ")!");
        }

        BigDecimal newScanned = currentScanned.add(qtyToAdd);
        if (newScanned.compareTo(required) > 0) {
            throw new CommonException("Số lượng quét vượt quá yêu cầu (Đã quét: " + currentScanned + ", Quét thêm: " + qtyToAdd + ", Cần nhặt: " + required + ")");
        }

        lockedItem.setSoLuongDaQuet(newScanned);
        lockedItem = chiTietNhatHangRepository.save(lockedItem);

        // Tính toán tổng tiến độ
        BigDecimal totalRequired = BigDecimal.ZERO;
        BigDecimal totalScanned = BigDecimal.ZERO;
        boolean allFinished = true;

        for (ChiTietNhatHang ctn : chiTiets) {
            BigDecimal can = ctn.getId().equals(lockedItem.getId()) ? lockedItem.getSoLuongCanNhat() : (ctn.getSoLuongCanNhat() != null ? ctn.getSoLuongCanNhat() : BigDecimal.ZERO);
            BigDecimal da = ctn.getId().equals(lockedItem.getId()) ? newScanned : (ctn.getSoLuongDaQuet() != null ? ctn.getSoLuongDaQuet() : BigDecimal.ZERO);
            totalRequired = totalRequired.add(can);
            totalScanned = totalScanned.add(da);
            if (da.compareTo(can) < 0) {
                allFinished = false;
            }
        }

        double percent = 0.0;
        if (totalRequired.compareTo(BigDecimal.ZERO) > 0) {
            percent = totalScanned.multiply(BigDecimal.valueOf(100))
                    .divide(totalRequired, 2, java.math.RoundingMode.HALF_UP).doubleValue();
            if (percent > 100.0) percent = 100.0;
        }

        BigDecimal remainingItem = required.subtract(newScanned);
        String itemStatus = remainingItem.compareTo(BigDecimal.ZERO) == 0 ? "da_xong" : "dang_nhat";

        // Ghi vết kiểm toán
        NguoiDung currentUser = nguoiDungRepository.findById(authUser.getId()).orElse(null);
        try {
            lichSuThayDoiService.create(
                    LichSuThayDoi.builder()
                            .loaiThamChieu(ITable.danh_sach_nhat_hang)
                            .idThamChieu(pickList.getId())
                            .kho(pickList.getKhoXuat())
                            .hanhDong(IHanhDong.quet_barcode)
                            .giaTriCu(currentScanned.toString())
                            .giaTriMoi(newScanned.toString())
                            .nguoiThucHien(currentUser)
                            .ngayThucHien(Instant.now())
                            .ghiChu("Quét mã " + rawBarcode + " (" + newScanned + "/" + required + ") cho đợt " + pickList.getMaPickList())
                            .build()
            );
        } catch (Exception e) {
            log.warn("Không thể ghi log quét barcode cho Pick List {}: {}", pickList.getMaPickList(), e.getMessage());
        }

        BienTheSanPham bt = lockedItem.getBienTheSanPham();
        String tenSp = bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : (bt != null ? bt.getMaSku() : rawBarcode);
        String tenMau = bt != null && bt.getMauSac() != null ? bt.getMauSac().getTenMau() : "";
        String tenSize = bt != null && bt.getSize() != null ? bt.getSize().getTenSize() : "";

        return KetQuaQuetBarcodeDto.builder()
                .chiTietId(lockedItem.getId())
                .bienTheId(bt != null ? bt.getId() : null)
                .maSku(bt != null ? bt.getMaSku() : null)
                .maVachSku(bt != null ? bt.getMaVachSku() : null)
                .tenSanPham(tenSp)
                .tenMau(tenMau)
                .tenSize(tenSize)
                .viTriKho(null) // hệ thống chưa lưu vị trí kệ
                .soLuongCanNhat(required)
                .soLuongDaQuet(newScanned)
                .soLuongConLai(remainingItem)
                .trangThaiDong(itemStatus)
                .tongSoLuongCanNhat(totalRequired)
                .tongSoLuongDaQuet(totalScanned)
                .tongSoLuongConLai(totalRequired.subtract(totalScanned))
                .phanTramHoanThanh(percent)
                .coTheHoanTat(allFinished)
                .thongBao("Đã quét " + hienThi(qtyToAdd) + "x " + tenSp + " [" + (bt != null ? bt.getMaSku() : rawBarcode) + "] ("
                        + hienThi(newScanned) + "/" + hienThi(required) + ")")
                .build();
    }

    /**
     * Khóa các dòng nhặt (id tăng dần) rồi phiếu nhặt — cùng thứ tự với Hoàn tất nhặt, Hủy phiếu chuyển và đơn bị hủy trong
     * phiếu nhặt — rồi nạp lại phiếu nhặt từ CSDL (trạng thái, người nhặt mới nhất). Bảng không có cột phiên bản nên thao
     * tác ghi phiếu nhặt phải kiểm trạng thái SAU bước này. Trả các dòng nhặt đã khóa.
     */
    private List<ChiTietNhatHang> khoaDongVaPhieuNhat(DanhSachNhatHang pickList) {
        List<ChiTietNhatHang> chiTiets = chiTietNhatHangRepository.findByDanhSachNhatHangIdWithLockOrderByIdAsc(pickList.getId());
        entityManager.refresh(pickList, LockModeType.PESSIMISTIC_WRITE);
        return chiTiets;
    }

    /**
     * Bắt buộc phân công trước khi nhặt: phiếu chưa có người nhặt thì không ai quét được, và chỉ người được
     * giao mới quét được (kể cả quản lý kho / quản trị viên — muốn tự nhặt thì phân công cho chính mình).
     */
    private void kiemTraNguoiNhat(DanhSachNhatHang pickList, NguoiDungAuthInfo authUser) {
        NguoiDung nguoiNhat = pickList.getNguoiNhat();
        if (nguoiNhat == null) {
            throw new CommonException("Phiếu nhặt " + pickList.getMaPickList() + " chưa được phân công. "
                    + "Cần phân công người nhặt (hoặc bấm Nhận việc) trước khi nhặt hàng.", HttpStatus.CONFLICT, null);
        }
        if (!authUser.getId().equals(nguoiNhat.getId())) {
            throw new CommonException("Phiếu nhặt " + pickList.getMaPickList() + " đang giao cho " + nguoiNhat.getHoTen()
                    + ". Chỉ người được phân công mới nhặt được — muốn tự nhặt thì phân công lại cho mình.",
                    HttpStatus.CONFLICT, null);
        }
    }

    /**
     * READ_COMMITTED: sau khi chờ khóa (phiếu chuyển, dòng nhặt, tồn), lần đọc phần đang giữ / phân bổ / dòng phiếu xuất
     * thấy bản vừa ghi xong (như PhieuChuyenKhoService.tao); REPEATABLE READ đọc ảnh chụp cũ từ lần đọc đầu giao dịch.
     */
    @Override
    @Transactional(rollbackFor = Exception.class, isolation = Isolation.READ_COMMITTED)
    public DanhSachNhatHangDto hoanTatNhatHang(Integer pickListId) {
        if (pickListId == null) {
            throw new CommonException("Mã đợt nhặt hàng (Pick List ID) không được để trống");
        }

        DanhSachNhatHang pickList = danhSachNhatHangRepository.findById(pickListId)
                .orElseThrow(() -> new CommonException("Không tìm thấy đợt nhặt hàng Pick List ID: " + pickListId));

        Integer contextKhoId = SecurityContextHolder.getKhoId();
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        if (authUser == null) {
            throw new CommonException("Người dùng chưa được xác thực trong hệ thống");
        }

        boolean isAdmin = authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (!isAdmin && contextKhoId != null && !contextKhoId.equals(pickList.getKhoXuat().getId())) {
            throw new CommonException("Bạn không có quyền thao tác trên Pick List thuộc kho khác");
        }

        // Phiếu nhặt của phiếu chuyển kho: không có đơn, không tạo phiếu xuất bán, không qua đóng gói — chỉ chốt lô vào
        // PX-CK. Rẽ trước mọi bước dưới (dưới đây phiếu không có đơn hợp lệ sẽ bị đặt Đã hủy)
        if (pickList.laChuyenKho()) {
            return hoanTatPhieuNhatChuyenKho(pickList, authUser, isAdmin);
        }

        // Khóa dòng nhặt rồi phiếu nhặt và đọc lại TRƯỚC khi kiểm, rồi mới khóa tồn (chotVaChiaLo): cùng thứ tự với quét mã,
        // lưu phân bổ lô, đơn bị hủy (dòng nhặt → phiếu nhặt → tồn). Hoàn tất chạy chồng với lưu phân bổ / Hoàn tất lần hai
        // thì chờ rồi bị chặn ở kiểm tra dưới, không kẹt khóa chéo.
        List<ChiTietNhatHang> chiTiets = khoaDongVaPhieuNhat(pickList);
        kiemTraDuocHoanTat(pickList, authUser, isAdmin);

        if (chiTiets == null || chiTiets.isEmpty()) {
            throw new CommonException("Đợt nhặt hàng không có mặt hàng nào để hoàn tất");
        }
        kiemTraNhatDu(chiTiets);

        String trangThaiCu = pickList.getTrangThai();
        List<DonBanHang> donHangs = pickList.getDonBanHangs() != null ? pickList.getDonBanHangs() : List.of();
        NguoiDung currentUser = nguoiDungRepository.findById(authUser.getId()).orElse(null);

        // 1. Chỉ đơn chưa xuất và chưa hủy (1 Chờ nhặt hàng; 2 là dữ liệu cũ trước bản đóng gói) mới được tạo phiếu xuất.
        //    Đơn bị hủy trong lúc nhặt (ví dụ sàn hủy qua đồng bộ đơn) hoặc đã xuất bằng phiếu khác thì bỏ qua,
        //    trả về danh sách để màn hình nhắc nhân viên trả hàng đã nhặt của các đơn này về kệ.
        List<DonBanHang> donHopLe = new ArrayList<>();
        List<String> donChuaTaoPhieuXuat = new ArrayList<>();   // mã đơn, trả về cho màn hình
        List<String> lyDoBoQua = new ArrayList<>();             // mã đơn kèm lý do, ghi nhật ký
        boolean conDonDaXuat = false;
        for (DonBanHang dbh : donHangs) {
            Integer tt = dbh.getTrangThai();
            if (tt != null && (tt == ITrangThaiDonBanHang.CHO_NHAT_HANG || tt == ITrangThaiDonBanHang.DANG_XUAT_KHO)) {
                donHopLe.add(dbh);
                continue;
            }
            String lyDo;
            if (tt != null && tt == ITrangThaiDonBanHang.DA_HUY) {
                lyDo = "đã hủy";
            } else if (tt != null && (tt == ITrangThaiDonBanHang.DA_XUAT_TOAN_BO
                    || tt == ITrangThaiDonBanHang.HOAN_THANH || tt == ITrangThaiDonBanHang.BI_HOAN_TRA)) {
                conDonDaXuat = true;
                lyDo = "đã xuất trước đó";
            } else {
                lyDo = "không ở trạng thái chờ xuất";
            }
            donChuaTaoPhieuXuat.add(dbh.getSoDonHang());
            lyDoBoQua.add(dbh.getSoDonHang() + " (" + lyDo + ")");
        }

        // 1b. Chốt lô: phân bổ đã lưu phải còn đủ lô; phần thiếu bù theo FIFO, thiếu tồn theo lô thì chặn để quản lý
        //     kiểm kê; rồi chia lô cho từng đơn (đơn đặt sớm nhận lô cũ trước, một đơn nhận được nhiều lô).
        Map<Integer, Map<Integer, List<PhanBoLoFifo.Lo>>> loTheoDon = donHopLe.isEmpty()
                ? Map.of() : chotVaChiaLo(pickList, chiTiets, donHopLe);

        // 2. Trạng thái phiếu nhặt: việc nhặt kết thúc ở 'da_nhat' (đóng gói / xuất kho theo dõi trên từng đơn
        //    và phiếu xuất); chỉ 'da_huy' khi mọi đơn đều đã hủy. Không còn 'da_xuat'.
        String trangThaiMoi = (!donHopLe.isEmpty() || conDonDaXuat) ? "da_nhat" : "da_huy";
        pickList.setTrangThai(trangThaiMoi);
        pickList.setNgayHoanTat(Instant.now());
        pickList = danhSachNhatHangRepository.save(pickList);

        // 3. Đơn chuyển 7 (Chờ đóng gói) kèm phiếu xuất nháp. Trạng thái 3 (Đã xuất toàn bộ) chỉ do
        //    PhieuXuatKhoService.updateTrangThaiDonBanHang đặt khi phiếu xuất đã hoàn thành,
        //    để đơn không hiện "đã xuất" và không "Giao thành công" được khi kho chưa trừ tồn.
        if (!donHopLe.isEmpty()) {
            for (DonBanHang dbh : donHopLe) {
                dbh.setTrangThai(ITrangThaiDonBanHang.CHO_DONG_GOI);
                dbh.setNgayCapNhat(Instant.now());
                // Tự động sinh Phiếu Xuất Kho nháp (chờ đóng gói) nếu đơn chưa có phiếu nháp / đã đóng gói
                boolean daCoPhieu = phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThaiIn(dbh.getId(),
                        List.of(ITrangThaiPhieuXuat.NHAP, ITrangThaiPhieuXuat.CHO_XUAT));
                if (!daCoPhieu) {
                    long seq = phieuXuatKhoRepository.countBySoPhieuXuatStartingWith("PXK-") + 1;
                    String soPxk = String.format("PXK-%s-%03d",
                            LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")), seq);

                    PhieuXuatKho pxk = PhieuXuatKho.builder()
                            .soPhieuXuat(soPxk)
                            .donBanHang(dbh)
                            .kho(pickList.getKhoXuat())
                            .loaiXuat("ban_hang")
                            .trangThai(ITrangThaiPhieuXuat.NHAP) // Nháp: chờ đóng gói (Scan-to-Pack)
                            .nguoiXuat(currentUser)
                            .ghiChu("Phiếu xuất tự động từ đợt nhặt hàng " + pickList.getMaPickList())
                            .build();
                    phieuXuatKhoRepository.save(pxk);

                    // Tạo chi tiết phiếu xuất kho cho từng sản phẩm trong đơn — chỉ phần CÒN LẠI chưa xuất
                    // (đơn 2 - dữ liệu cũ đã xuất một phần - không được xuất lại phần đã xuất)
                    if (dbh.getChiTietDonBanHangs() != null) {
                        for (ChiTietDonBanHang ctdb : dbh.getChiTietDonBanHangs()) {
                            BigDecimal soLuongDat = ctdb.getSoLuongDat() != null ? ctdb.getSoLuongDat() : BigDecimal.ONE;
                            BigDecimal daXuat = ctdb.getBienTheSanPham() != null
                                    ? chiTietPhieuXuatKhoRepository.sumSoLuongDaXuatThucTe(dbh.getId(), ctdb.getBienTheSanPham().getId())
                                    : null;
                            BigDecimal conLai = daXuat != null ? soLuongDat.subtract(daXuat) : soLuongDat;
                            if (conLai.compareTo(BigDecimal.ZERO) <= 0) {
                                continue;
                            }
                            BigDecimal giaVon = ctdb.getBienTheSanPham() != null && ctdb.getBienTheSanPham().getGiaVon() != null
                                    ? ctdb.getBienTheSanPham().getGiaVon()
                                    : (ctdb.getDonGia() != null ? ctdb.getDonGia() : BigDecimal.ZERO);

                            ChiTietPhieuXuatKho ctPxk = ChiTietPhieuXuatKho.builder()
                                    .phieuXuatKho(pxk)
                                    .bienTheSanPham(ctdb.getBienTheSanPham())
                                    .soLuongXuat(conLai)
                                    .giaVon(giaVon)
                                    .ghiChu("Xuất theo đơn " + dbh.getSoDonHang())
                                    .build();
                            chiTietPhieuXuatKhoRepository.save(ctPxk);
                        }
                    }

                    // Dòng lô lấy từ phân bổ của phiếu nhặt: phiếu xuất bán hàng không còn bước chọn lô
                    loTheoDon.getOrDefault(dbh.getId(), Map.of()).forEach((bienTheId, los) -> {
                        BienTheSanPham bt = dbh.getChiTietDonBanHangs().stream()
                                .map(ChiTietDonBanHang::getBienTheSanPham)
                                .filter(b -> b != null && bienTheId.equals(b.getId()))
                                .findFirst().orElseThrow();
                        for (PhanBoLoFifo.Lo lo : los) {
                            LoHang loHang = loHangRepository.getReferenceById(lo.loHangId());
                            chiTietPhieuXuatKhoRepository.save(ChiTietPhieuXuatKho.builder()
                                    .phieuXuatKho(pxk)
                                    .bienTheSanPham(bt)
                                    .loHang(loHang)
                                    .soLuongXuat(lo.soLuong())
                                    .giaVon(loHang.getGiaVon())
                                    .build());
                        }
                    });
                }
            }
        }

        // 4. Ghi vết kiểm toán
        String ghiChuNhatKy = "Hoàn tất đợt nhặt hàng " + pickList.getMaPickList()
                + (donHopLe.isEmpty()
                    ? ", không còn đơn nào cần xuất nên không tạo phiếu xuất"
                    : ", tự động sinh phiếu xuất kho nháp (chờ đóng gói) cho " + donHopLe.size() + " đơn")
                + (donChuaTaoPhieuXuat.isEmpty()
                    ? ""
                    : ". Không tạo phiếu xuất cho đơn: " + String.join(", ", lyDoBoQua)
                        + ". Hàng đã nhặt cho các đơn này cần trả về kệ");
        try {
            lichSuThayDoiService.create(
                    LichSuThayDoi.builder()
                            .loaiThamChieu(ITable.danh_sach_nhat_hang)
                            .idThamChieu(pickList.getId())
                            .kho(pickList.getKhoXuat())
                            .hanhDong(IHanhDong.hoan_tat_nhat_hang)
                            .giaTriCu(trangThaiCu)
                            .giaTriMoi(trangThaiMoi)
                            .nguoiThucHien(currentUser)
                            .ngayThucHien(Instant.now())
                            .ghiChu(ghiChuNhatKy)
                            .build()
            );
        } catch (Exception e) {
            log.warn("Không thể ghi log hoàn tất nhặt hàng cho Pick List {}: {}", pickList.getMaPickList(), e.getMessage());
        }

        DanhSachNhatHangDto ketQua = getChiTietPickList(pickList.getId());
        ketQua.setDonChuaTaoPhieuXuat(donChuaTaoPhieuXuat);
        return ketQua;
    }

    /**
     * Phiếu còn mở và người đang thao tác được hoàn tất: phiếu chưa phân công thì chưa ai được nhặt nên không hoàn tất
     * được; nhân viên kho chỉ hoàn tất phiếu giao cho mình, quản lý kho / quản trị viên hoàn tất thay được (giám sát).
     */
    private static void kiemTraDuocHoanTat(DanhSachNhatHang pickList, NguoiDungAuthInfo authUser, boolean isAdmin) {
        if ("da_nhat".equals(pickList.getTrangThai())) {
            throw new CommonException("Đợt nhặt hàng này đã hoàn tất trước đó");
        }
        if ("da_xuat".equals(pickList.getTrangThai())) {
            throw new CommonException("Đợt nhặt hàng này đã được xuất kho");
        }
        if ("da_huy".equals(pickList.getTrangThai())) {
            throw new CommonException("Đợt nhặt hàng này đã bị hủy");
        }
        if (pickList.getNguoiNhat() == null) {
            throw new CommonException("Phiếu nhặt " + pickList.getMaPickList() + " chưa được phân công người nhặt.",
                    HttpStatus.CONFLICT, null);
        }
        boolean isQuanLy = isAdmin || (authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_ly_kho));
        if (!isQuanLy && !authUser.getId().equals(pickList.getNguoiNhat().getId())) {
            throw new CommonException("Phiếu nhặt " + pickList.getMaPickList() + " đang giao cho "
                    + pickList.getNguoiNhat().getHoTen() + ", bạn không hoàn tất được.", HttpStatus.CONFLICT, null);
        }
    }

    /** Bắt buộc 100% dòng mặt hàng phải nhặt đủ số lượng yêu cầu. */
    private static void kiemTraNhatDu(List<ChiTietNhatHang> chiTiets) {
        for (ChiTietNhatHang ctn : chiTiets) {
            BigDecimal can = ctn.getSoLuongCanNhat() != null ? ctn.getSoLuongCanNhat() : BigDecimal.ZERO;
            BigDecimal da = ctn.getSoLuongDaQuet() != null ? ctn.getSoLuongDaQuet() : BigDecimal.ZERO;
            if (da.compareTo(can) < 0) {
                String sku = ctn.getBienTheSanPham() != null ? ctn.getBienTheSanPham().getMaSku() : "SKU";
                throw new CommonException("Chưa nhặt đủ hàng! Mặt hàng [" + sku + "] mới nhặt " + hienThi(da) + "/" + hienThi(can));
            }
        }
    }

    /**
     * Hoàn tất nhặt của phiếu chuyển kho (đặc tả bước 9). Khóa theo thứ tự chung với Chọn lô / Hủy phiếu chuyển: phiếu
     * chuyển → dòng nhặt → phiếu nhặt → PX-CK → tồn, rồi đọc lại trạng thái mới nhất. Phiếu chuyển phải còn Đã duyệt,
     * PX-CK còn Nháp, nhặt đủ 100%; chốt lô như phiếu bán (chotLoCuaDong: phân bổ đã lưu phải còn đủ, thiếu bù FIFO,
     * thiếu tồn theo lô thì chặn) rồi ghi dòng lô vào PX-CK và cộng so_luong_da_dat (PhieuXuatKhoService.ghiLoChoBienThe)
     * — hàng chuyển kho giữ qua so_luong_da_dat tới khi xuất hoặc hủy. Không tạo phiếu xuất bán, không đổi đơn, không qua
     * đóng gói (đóng gói / niêm phong làm ngoài thực tế); kho xuất bấm Xác nhận xuất ở phiếu chuyển.
     */
    private DanhSachNhatHangDto hoanTatPhieuNhatChuyenKho(DanhSachNhatHang pickList, NguoiDungAuthInfo authUser, boolean isAdmin) {
        PhieuXuatKho px = pickList.getPhieuXuatKho();
        PhieuChuyenKho pck = px.getPhieuChuyenKho();
        entityManager.refresh(pck, LockModeType.PESSIMISTIC_WRITE);
        List<ChiTietNhatHang> chiTiets = chiTietNhatHangRepository.findByDanhSachNhatHangIdWithLockOrderByIdAsc(pickList.getId());
        entityManager.refresh(pickList, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(px, LockModeType.PESSIMISTIC_WRITE);

        kiemTraDuocHoanTat(pickList, authUser, isAdmin);
        if (!IChuyenKho.DA_DUYET.equals(pck.getTrangThai())) {
            throw new CommonException("Phiếu chuyển " + pck.getSoPhieuChuyen() + " không còn chờ xuất (đã hủy hoặc đã xuất), "
                    + "không hoàn tất nhặt được.", HttpStatus.CONFLICT, null);
        }
        if (!Integer.valueOf(ITrangThaiPhieuXuat.NHAP).equals(px.getTrangThai())) {
            throw new CommonException("Phiếu xuất " + px.getSoPhieuXuat() + " không còn ở trạng thái Nháp, không hoàn tất nhặt được.",
                    HttpStatus.CONFLICT, null);
        }
        if (chiTiets == null || chiTiets.isEmpty()) {
            throw new CommonException("Đợt nhặt hàng không có mặt hàng nào để hoàn tất");
        }
        kiemTraNhatDu(chiTiets);

        // Số trên PX-CK theo biến thể = cộng các dòng gốc (chưa chọn lô): PX-CK cũ có thể tách một biến thể thành nhiều
        // dòng (3 + 2). Số cần nhặt phải đúng số đó
        Map<Integer, BigDecimal> soTrenPhieuXuat = new HashMap<>();
        for (ChiTietPhieuXuatKho ct : chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(px.getId())) {
            soTrenPhieuXuat.merge(ct.getBienTheSanPham().getId(),
                    ct.getSoLuongXuat() != null ? ct.getSoLuongXuat() : BigDecimal.ZERO, BigDecimal::add);
        }

        // Chốt lô: khóa tồn của mọi biến thể một lần (PK tăng dần), phần phiếu khác giữ không tính chính phiếu nhặt này
        Integer khoId = pickList.getKhoXuat().getId();
        List<Integer> bienTheIds = chiTiets.stream().map(ct -> ct.getBienTheSanPham().getId()).distinct().toList();
        List<TonKhoTheoLo> tonList = loDangGiuService.khoaTonTheoBienThe(khoId, bienTheIds);
        Map<Integer, TonKhoTheoLo> tonTheoLo = tonList.stream()
                .collect(Collectors.toMap(t -> t.getLoHang().getId(), t -> t, (a, b) -> a));
        Map<Integer, BigDecimal> dangGiu = loDangGiuService.dangGiuTheoLo(khoId, tonTheoLo.keySet(), pickList.getId(), null);
        Map<Integer, List<PhanBoLoNhatHang>> phanBoTheoDong = phanBoLoNhatHangRepository.findByPhieuNhatId(pickList.getId())
                .stream().collect(Collectors.groupingBy(pb -> pb.getChiTietNhatHang().getId()));

        BigDecimal tong = BigDecimal.ZERO;
        for (ChiTietNhatHang dong : chiTiets) {
            BigDecimal can = dong.getSoLuongCanNhat() != null ? dong.getSoLuongCanNhat() : BigDecimal.ZERO;
            if (can.signum() <= 0) continue;
            BienTheSanPham bt = dong.getBienTheSanPham();
            BigDecimal soPhieuXuat = soTrenPhieuXuat.get(bt.getId());
            if (soPhieuXuat == null) {
                throw new CommonException("Phiếu xuất " + px.getSoPhieuXuat() + " không có dòng sản phẩm [" + bt.getMaSku()
                        + "] trong khi phiếu nhặt cần nhặt " + hienThi(can) + ". Báo quản lý kho kiểm tra phiếu chuyển "
                        + pck.getSoPhieuChuyen() + ".", HttpStatus.CONFLICT, null);
            }
            if (soPhieuXuat.compareTo(can) != 0) {
                throw new CommonException("Số cần nhặt của [" + bt.getMaSku() + "] là " + hienThi(can) + " nhưng phiếu xuất "
                        + px.getSoPhieuXuat() + " ghi " + hienThi(soPhieuXuat)
                        + ". Báo quản lý kho kiểm tra phiếu chuyển " + pck.getSoPhieuChuyen() + ".", HttpStatus.CONFLICT, null);
            }

            // Phân bổ có thể thừa (không xảy ra với phiếu chuyển, phòng dữ liệu lệch): chỉ lấy đủ phần cần theo FIFO
            List<PhanBoLoFifo.Lo> los = PhanBoLoFifo.layFifo(chotLoCuaDong(dong, can, tonList, tonTheoLo, dangGiu,
                    phanBoTheoDong.getOrDefault(dong.getId(), List.of()), BigDecimal.ZERO), can);
            Map<Integer, TonKhoTheoLo> tonCuaMa = tonList.stream()
                    .filter(t -> bt.getId().equals(t.getLoHang().getBienTheSanPham().getId()))
                    .collect(Collectors.toMap(t -> t.getLoHang().getId(), t -> t, (a, b) -> a));
            List<PickLoHangRequest.Item> loLay = los.stream().map(lo -> {
                PickLoHangRequest.Item item = new PickLoHangRequest.Item();
                item.setLoHangId(lo.loHangId());
                item.setSoLuongXuat(lo.soLuong());
                return item;
            }).toList();
            phieuXuatKhoService.ghiLoChoBienThe(px, bt, tonCuaMa, loLay, pickList.getId());
            tong = tong.add(can);
        }

        String trangThaiCu = pickList.getTrangThai();
        pickList.setTrangThai("da_nhat");
        pickList.setNgayHoanTat(Instant.now());
        pickList = danhSachNhatHangRepository.save(pickList);

        NguoiDung currentUser = nguoiDungRepository.findById(authUser.getId()).orElse(null);
        String ghiChu = "Hoàn tất phiếu nhặt " + pickList.getMaPickList() + " của phiếu chuyển " + pck.getSoPhieuChuyen()
                + ": đã giữ lô " + hienThi(tong) + " sản phẩm cho phiếu xuất " + px.getSoPhieuXuat()
                + ". Chờ xác nhận xuất ở phiếu chuyển.";
        try {
            lichSuThayDoiService.create(LichSuThayDoi.builder()
                    .loaiThamChieu(ITable.danh_sach_nhat_hang)
                    .idThamChieu(pickList.getId())
                    .kho(pickList.getKhoXuat())
                    .hanhDong(IHanhDong.hoan_tat_nhat_hang)
                    .giaTriCu(trangThaiCu)
                    .giaTriMoi("da_nhat")
                    .nguoiThucHien(currentUser)
                    .ngayThucHien(Instant.now())
                    .ghiChu(ghiChu)
                    .build());
            // Nhật ký phiếu chuyển (cùng dạng PhieuChuyenKhoService.ghiNhatKy): trạng thái phiếu chuyển không đổi
            lichSuThayDoiService.create(LichSuThayDoi.builder()
                    .loaiThamChieu(ITable.phieu_chuyen_kho)
                    .idThamChieu(pck.getId())
                    .kho(pck.getKhoXuat())
                    .hanhDong(IHanhDong.nhat_xong_chuyen_kho)
                    .giaTriCu("trang_thai = " + pck.getTrangThai())
                    .giaTriMoi("trang_thai = " + pck.getTrangThai())
                    .nguoiThucHien(currentUser)
                    .ngayThucHien(Instant.now())
                    .ghiChu("Đã nhặt xong theo phiếu nhặt " + pickList.getMaPickList() + ", giữ lô cho phiếu xuất " + px.getSoPhieuXuat())
                    .build());
        } catch (Exception e) {
            log.warn("Không thể ghi log hoàn tất nhặt hàng cho Pick List {}: {}", pickList.getMaPickList(), e.getMessage());
        }

        return getChiTietPickList(pickList.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DanhSachNhatHang huyPhieuNhatChuyenKho(PhieuXuatKho phieuXuat, String soPhieuChuyen) {
        DanhSachNhatHang pickList = danhSachNhatHangRepository.findByPhieuXuatKho_Id(phieuXuat.getId()).orElse(null);
        if (pickList == null) {
            return null;
        }
        // Bên gọi đã khóa phiếu chuyển: khóa tiếp dòng nhặt (tuần tự với quét mã) rồi phiếu nhặt, đọc trạng thái mới nhất
        List<ChiTietNhatHang> chiTiets = chiTietNhatHangRepository.findByDanhSachNhatHangIdWithLockOrderByIdAsc(pickList.getId());
        entityManager.refresh(pickList, LockModeType.PESSIMISTIC_WRITE);
        String truoc = pickList.getTrangThai();
        if ("da_huy".equals(truoc)) {
            return pickList;
        }
        boolean dangMo = "cho_nhat".equals(truoc) || "dang_nhat".equals(truoc);

        // Hàng đã nhặt cần trả về kệ: đang nhặt = số đã quét (về 0 như luồng mọi đơn bị hủy); đã nhặt xong = toàn bộ (lô
        // đã ghi trên PX-CK, bên gọi nhả khi hủy PX-CK)
        BigDecimal tongTraKe = BigDecimal.ZERO;
        for (ChiTietNhatHang ctn : chiTiets) {
            BigDecimal daQuet = ctn.getSoLuongDaQuet() != null ? ctn.getSoLuongDaQuet() : BigDecimal.ZERO;
            if (daQuet.signum() <= 0) continue;
            taoLenhHoanKe(pickList, ctn.getBienTheSanPham(), daQuet);
            tongTraKe = tongTraKe.add(daQuet);
            if (dangMo) {
                ctn.setSoLuongDaQuet(BigDecimal.ZERO);
                chiTietNhatHangRepository.save(ctn);
            }
        }
        pickList.setTrangThai("da_huy");
        danhSachNhatHangRepository.save(pickList);

        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        try {
            lichSuThayDoiService.create(LichSuThayDoi.builder()
                    .loaiThamChieu(ITable.danh_sach_nhat_hang)
                    .idThamChieu(pickList.getId())
                    .kho(pickList.getKhoXuat())
                    .hanhDong(IHanhDong.huy_pick_list)
                    .giaTriCu(truoc)
                    .giaTriMoi("da_huy")
                    .nguoiThucHien(authUser != null ? nguoiDungRepository.findById(authUser.getId()).orElse(null) : null)
                    .ngayThucHien(Instant.now())
                    .ghiChu("Hủy theo phiếu chuyển " + soPhieuChuyen
                            + (tongTraKe.signum() > 0 ? ", " + hienThi(tongTraKe) + " sản phẩm đã nhặt cần trả về kệ" : ""))
                    .build());
        } catch (Exception e) {
            log.warn("Không thể ghi log hủy Pick List {}: {}", pickList.getMaPickList(), e.getMessage());
        }

        Integer pickListId = pickList.getId();
        String maPickList = pickList.getMaPickList();
        String thongBao = "Phiếu chuyển " + soPhieuChuyen + " đã bị hủy. "
                + (tongTraKe.signum() > 0 ? "Dừng nhặt và cất toàn bộ hàng đã lấy về kệ." : "Dừng nhặt phiếu này.");
        SauCommit.chay("Gửi WebSocket phiếu nhặt " + pickListId, () -> outboundWebSocketHandler.sendPickListEvent(pickListId,
                "PICK_LIST_CANCELLED", Map.of(
                        "pickListId", pickListId,
                        "maPickList", maPickList,
                        "lyDo", LY_DO_HOAN_KE_CHUYEN_KHO_HUY,
                        "message", thongBao)));
        return pickList;
    }

    /**
     * Lệnh trả hàng về kệ (cảnh báo HOAN_KE_CHO_CAT, nguong_canh_bao = id phiếu nhặt, 0 = chờ cất kệ). Lý do ở màn Hàng cần
     * hoàn kệ đọc theo loại phiếu nhặt (lyDoHoanKe).
     */
    private void taoLenhHoanKe(DanhSachNhatHang pickList, BienTheSanPham bt, BigDecimal soLuong) {
        canhBaoRepository.save(CanhBao.builder()
                .loaiCanhBao("HOAN_KE_CHO_CAT")
                .bienTheSanPham(bt)
                .kho(pickList.getKhoXuat())
                .soLuongHienTai(soLuong)
                .nguongCanhBao(BigDecimal.valueOf(pickList.getId()))
                .trangThai(0) // 0: Chờ cất kệ
                .build());
    }

    /** Lý do trả kệ theo loại phiếu nhặt của lệnh: phiếu chuyển kho bị hủy, hoặc đơn bán bị hủy. */
    static String lyDoHoanKe(DanhSachNhatHang pickList) {
        return pickList != null && pickList.laChuyenKho() ? LY_DO_HOAN_KE_CHUYEN_KHO_HUY : LY_DO_HOAN_KE_DON_HUY;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xuLyDonBiHuyTrongPickList(DonBanHang don) {
        if (don == null || don.getId() == null) {
            return;
        }

        DanhSachNhatHang pickList = don.getDanhSachNhatHang();
        // Phiếu nhặt chuyển kho không có đơn (đơn không nối vào được); phòng dữ liệu lệch: không đụng phiếu đó
        if (pickList == null || pickList.laChuyenKho()) {
            return;
        }

        Integer pickListId = pickList.getId();
        String currentTrangThai = pickList.getTrangThai();
        log.info("[OUTBOUND-CANCEL] Xử lý đơn hàng {} bị hủy trong Pick List {} (Trạng thái: {})",
                don.getSoDonHang(), pickList.getMaPickList(), currentTrangThai);

        List<ChiTietDonBanHang> chiTietDons = chiTietDonBanHangRepository.findByDonBanHangId(don.getId());
        // Áp dụng Ordered Pessimistic Locking (ORDER BY id ASC) theo Rule 8.1 chống Deadlock khi hủy đơn
        List<ChiTietNhatHang> chiTietNhats = chiTietNhatHangRepository.findByDanhSachNhatHangIdWithLockOrderByIdAsc(pickListId);

        // Trường hợp 1: Đang gom nhặt (cho_nhat hoặc dang_nhat)
        if ("cho_nhat".equals(currentTrangThai) || "dang_nhat".equals(currentTrangThai)) {
            List<Map<String, Object>> danhSachHangTraKe = new ArrayList<>();

            for (ChiTietDonBanHang ctd : chiTietDons) {
                BienTheSanPham bt = ctd.getBienTheSanPham();
                if (bt == null) continue;

                BigDecimal slGiam = ctd.getSoLuongDat() != null ? ctd.getSoLuongDat() : BigDecimal.ZERO;
                if (slGiam.compareTo(BigDecimal.ZERO) <= 0) continue;

                for (ChiTietNhatHang ctn : chiTietNhats) {
                    if (ctn.getBienTheSanPham() != null && ctn.getBienTheSanPham().getId().equals(bt.getId())) {
                        BigDecimal canHienTai = ctn.getSoLuongCanNhat() != null ? ctn.getSoLuongCanNhat() : BigDecimal.ZERO;
                        BigDecimal canMoi = canHienTai.subtract(slGiam);
                        if (canMoi.compareTo(BigDecimal.ZERO) < 0) {
                            canMoi = BigDecimal.ZERO;
                        }
                        ctn.setSoLuongCanNhat(canMoi);

                        BigDecimal daQuet = ctn.getSoLuongDaQuet() != null ? ctn.getSoLuongDaQuet() : BigDecimal.ZERO;
                        if (daQuet.compareTo(canMoi) > 0) {
                            BigDecimal slThua = daQuet.subtract(canMoi);
                            ctn.setSoLuongDaQuet(canMoi);

                            // Tạo cảnh báo hoàn kệ Put-back
                            taoLenhHoanKe(pickList, bt, slThua);

                            Map<String, Object> itemTraKe = new HashMap<>();
                            itemTraKe.put("sku", bt.getMaSku());
                            itemTraKe.put("tenSanPham", bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku());
                            itemTraKe.put("soLuong", slThua);
                            danhSachHangTraKe.add(itemTraKe);
                        }

                        chiTietNhatHangRepository.save(ctn);
                        // Số cần nhặt giảm → cắt phân bổ lô từ lô mới nhất, trả phần lô thừa cho nơi khác
                        catPhanBoTheoSoCanNhat(pickList, ctn);

                        // Phát sự kiện giải phóng Outgoing, hoàn lại Free to Use để đẩy tồn tức thời lên kênh TMĐT (SRS 12.3 JOB-03)
                        try {
                            eventPublisher.publishEvent(new InventoryRestockedEvent(this, bt.getId(), slGiam, pickList.getKhoXuat() != null ? pickList.getKhoXuat().getId() : null));
                        } catch (Exception e) {
                            log.warn("Không thể phát sự kiện InventoryRestockedEvent cho SKU {}: {}", bt.getId(), e.getMessage());
                        }
                        break;
                    }
                }
            }

            // Kiểm tra các đơn còn lại trong Pick List
            List<DonBanHang> donCungDot = donBanHangRepository.findByDanhSachNhatHang_Id(pickListId);
            boolean conDonHoatDong = donCungDot.stream().anyMatch(d -> !d.getId().equals(don.getId()) && d.getTrangThai() != null && d.getTrangThai() != 4);

            if (!conDonHoatDong) {
                // Toàn bộ các đơn trong đợt đã bị hủy -> Hủy luôn đợt nhặt
                pickList.setTrangThai("da_huy");
                danhSachNhatHangRepository.save(pickList);

                // Tạo nhiệm vụ hoàn kệ cho toàn bộ hàng đã quét (nếu còn)
                for (ChiTietNhatHang ctn : chiTietNhats) {
                    BigDecimal daQuet = ctn.getSoLuongDaQuet() != null ? ctn.getSoLuongDaQuet() : BigDecimal.ZERO;
                    if (daQuet.compareTo(BigDecimal.ZERO) > 0) {
                        taoLenhHoanKe(pickList, ctn.getBienTheSanPham(), daQuet);
                        ctn.setSoLuongDaQuet(BigDecimal.ZERO);
                        chiTietNhatHangRepository.save(ctn);
                    }
                }

                SauCommit.chay("Gửi WebSocket phiếu nhặt " + pickListId, () -> outboundWebSocketHandler.sendPickListEvent(pickListId, "PICK_LIST_CANCELLED", Map.of(
                            "pickListId", pickListId,
                            "maPickList", pickList.getMaPickList(),
                            "message", "Toàn bộ đơn hàng trong đợt nhặt " + pickList.getMaPickList() + " đã bị hủy! Vui lòng dừng nhặt và cất toàn bộ hàng đã lấy về kệ."
                    )));
            } else {
                // Vẫn còn đơn hợp lệ -> Gửi WebSocket báo Pick UI cập nhật
                SauCommit.chay("Gửi WebSocket phiếu nhặt " + pickListId, () -> outboundWebSocketHandler.sendPickListEvent(pickListId, "ORDER_CANCELLED_IN_PICK_LIST", Map.of(
                            "pickListId", pickListId,
                            "maPickList", pickList.getMaPickList(),
                            "soDonHangBiHuy", don.getSoDonHang(),
                            "hangCanTraKe", danhSachHangTraKe,
                            "message", "Đơn hàng " + don.getSoDonHang() + " đã bị hủy! Số lượng cần nhặt đã tự động giảm. Vui lòng chuyển hàng thừa (nếu có) vào khay Put-back trên xe đẩy."
                    )));
            }
        }
        // Trường hợp 2: Đã hoàn tất nhặt (da_nhat), đã có PXK nháp tại bàn đóng gói
        else if ("da_nhat".equals(currentTrangThai)) {
            // Thu hồi phiếu xuất kho nháp của đơn hàng này → 4 (Đã hủy)
            phieuXuatKhoService.huyPhieuXuatNhapTheoDon(don.getId(), "Tự động hủy do đơn " + don.getSoDonHang() + " bị hủy");

            // Sinh lệnh cất hàng về kệ (Put-away Task) cho toàn bộ sản phẩm của đơn đã nhặt về bàn đóng gói
            for (ChiTietDonBanHang ctd : chiTietDons) {
                if (ctd.getBienTheSanPham() != null && ctd.getSoLuongDat() != null && ctd.getSoLuongDat().compareTo(BigDecimal.ZERO) > 0) {
                    taoLenhHoanKe(pickList, ctd.getBienTheSanPham(), ctd.getSoLuongDat());

                    // Phát sự kiện giải phóng Outgoing, hoàn lại Free to Use để đẩy tồn tức thời lên kênh TMĐT (SRS 12.3 JOB-03)
                    try {
                        eventPublisher.publishEvent(new InventoryRestockedEvent(this, ctd.getBienTheSanPham().getId(), ctd.getSoLuongDat(), pickList.getKhoXuat() != null ? pickList.getKhoXuat().getId() : null));
                    } catch (Exception e) {
                        log.warn("Không thể phát sự kiện InventoryRestockedEvent cho SKU {}: {}", ctd.getBienTheSanPham().getId(), e.getMessage());
                    }
                }
            }

            // Kiểm tra các đơn còn lại trong Pick List
            List<DonBanHang> donCungDot = donBanHangRepository.findByDanhSachNhatHang_Id(pickListId);
            boolean conDonHoatDong = donCungDot.stream().anyMatch(d -> !d.getId().equals(don.getId()) && d.getTrangThai() != null && d.getTrangThai() != 4);

            if (!conDonHoatDong) {
                pickList.setTrangThai("da_huy");
                danhSachNhatHangRepository.save(pickList);
                SauCommit.chay("Gửi WebSocket phiếu nhặt " + pickListId, () -> outboundWebSocketHandler.sendPickListEvent(pickListId, "PICK_LIST_CANCELLED", Map.of(
                            "pickListId", pickListId,
                            "maPickList", pickList.getMaPickList(),
                            "message", "Toàn bộ đơn hàng trong đợt đã bị hủy! Toàn bộ phiếu xuất đã bị thu hồi. Đã sinh lệnh cất toàn bộ hàng về kệ."
                    )));
            } else {
                SauCommit.chay("Gửi WebSocket phiếu nhặt " + pickListId, () -> outboundWebSocketHandler.sendPickListEvent(pickListId, "ORDER_CANCELLED_IN_PACKING", Map.of(
                            "pickListId", pickListId,
                            "maPickList", pickList.getMaPickList(),
                            "soDonHangBiHuy", don.getSoDonHang(),
                            "message", "Đơn hàng " + don.getSoDonHang() + " đã bị hủy! Phiếu xuất nháp đã bị thu hồi. Vui lòng chuyển hàng của đơn vào Thùng gom hàng hoàn kệ (Return-to-stock)."
                    )));
            }
        }
    }

    /** Nhãn trạng thái đơn hiển thị trong phiếu nhặt (theo ITrangThaiDonBanHang). */
    private static String tenTrangThaiDon(Integer trangThai) {
        if (trangThai == null) return "Không xác định";
        return switch (trangThai) {
            case ITrangThaiDonBanHang.CHO_NHAT_HANG -> "Chờ nhặt hàng";
            case ITrangThaiDonBanHang.CHO_DONG_GOI -> "Chờ đóng gói";
            case ITrangThaiDonBanHang.DA_DONG_GOI -> "Chờ xuất kho";
            case ITrangThaiDonBanHang.DANG_XUAT_KHO -> "Đã xuất một phần";
            case ITrangThaiDonBanHang.DA_XUAT_TOAN_BO -> "Đã xuất kho";
            case ITrangThaiDonBanHang.HOAN_THANH -> "Hoàn thành";
            case ITrangThaiDonBanHang.BI_HOAN_TRA -> "Bị hoàn trả";
            case ITrangThaiDonBanHang.DA_HUY -> "Đã hủy";
            default -> "Đang xử lý";
        };
    }

    @Override
    @Transactional(readOnly = true)
    public List<HangCanHoanKeDto> getDanhSachHangCanHoanKe(Integer khoId) {
        Integer contextKhoId = SecurityContextHolder.getKhoId();
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        if (authUser == null) {
            throw new CommonException("Người dùng chưa được xác thực");
        }
        boolean isAdmin = authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (isAdmin && khoId != null) {
            contextKhoId = khoId;
        }
        if (contextKhoId == null) {
            throw new CommonException("Vui lòng chọn ngữ cảnh kho làm việc");
        }

        List<CanhBao> list = canhBaoRepository.findByKhoIdAndLoaiCanhBaoAndTrangThai(contextKhoId, "HOAN_KE_CHO_CAT", 0);
        return list.stream().map(cb -> {
            BienTheSanPham bt = cb.getBienTheSanPham();
            String tenSp = bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : (bt != null ? bt.getMaSku() : "N/A");
            String tenMau = bt != null && bt.getMauSac() != null ? bt.getMauSac().getTenMau() : "";
            String tenSize = bt != null && bt.getSize() != null ? bt.getSize().getTenSize() : "";

            Integer refPickListId = cb.getNguongCanhBao() != null ? cb.getNguongCanhBao().intValue() : null;
            DanhSachNhatHang phieuNhat = refPickListId != null
                    ? danhSachNhatHangRepository.findById(refPickListId).orElse(null) : null;
            String maPickList = phieuNhat != null ? phieuNhat.getMaPickList() : null;

            String phanLoai = (tenMau + " " + tenSize).trim();
            String maNhiemVu = "PA-" + cb.getId();

            return HangCanHoanKeDto.builder()
                    .id(cb.getId())
                    .maNhiemVu(maNhiemVu)
                    .maPickList(maPickList)
                    .bienTheSanPhamId(bt != null ? bt.getId() : null)
                    .maSku(bt != null ? bt.getMaSku() : null)
                    .tenSanPham(tenSp)
                    .phanLoai(phanLoai)
                    .viTriKe("A-01-02")
                    .soLuong(cb.getSoLuongHienTai() != null ? cb.getSoLuongHienTai() : BigDecimal.ZERO)
                    .loaiNguon("HOAN_KE_KHO")
                    .thoiGianHuy(cb.getNgayCanhBao())
                    .trangThai("CHO_CAT_KE")
                    .lyDo(lyDoHoanKe(phieuNhat))
                    .build();
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xacNhanHoanKe(Integer canhBaoId) {
        if (canhBaoId == null) {
            throw new CommonException("Mã nhiệm vụ hoàn kệ không được để trống");
        }
        CanhBao cb = canhBaoRepository.findById(canhBaoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy nhiệm vụ hoàn kệ ID: " + canhBaoId));

        if (!"HOAN_KE_CHO_CAT".equals(cb.getLoaiCanhBao())) {
            throw new CommonException("Nhiệm vụ này không phải loại hoàn kệ cất hàng");
        }
        // Chỉ người đang làm việc ở kho của lệnh (quản trị viên mọi kho)
        KhoDangChon.kiemTra(cb.getKho(), "Nhiệm vụ hoàn kệ");

        // Đóng lệnh bằng một câu UPDATE có điều kiện "còn chờ": hai lần bấm (hoặc hai người cùng lúc) chỉ một lần đổi được,
        // nên sự kiện cộng tồn của kho chỉ phát một lần (save() không ghi được trang_thai, xem CanhBaoRepository)
        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        if (canhBaoRepository.danhDauDaCatKe(cb.getId(), Instant.now(), authUser != null ? authUser.getId() : null) == 0) {
            throw new CommonException("Nhiệm vụ hoàn kệ này đã được xác nhận cất kệ", HttpStatus.CONFLICT, null);
        }

        if (cb.getBienTheSanPham() != null) {
            try {
                eventPublisher.publishEvent(new InventoryRestockedEvent(this, cb.getBienTheSanPham().getId(), cb.getSoLuongHienTai(), cb.getKho() != null ? cb.getKho().getId() : null));
            } catch (Exception e) {
                log.warn("Không thể phát sự kiện InventoryRestockedEvent khi xác nhận hoàn kệ: {}", e.getMessage());
            }
        }
    }
}

