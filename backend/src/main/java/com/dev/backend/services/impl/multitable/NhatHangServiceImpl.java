package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.request.DonChoXuatFilterRequest;
import com.dev.backend.dto.request.PhanCongNguoiNhatRequest;
import com.dev.backend.dto.request.TaoPickListRequest;
import com.dev.backend.dto.request.QuetBarcodeRequest;
import com.dev.backend.dto.response.customize.DonChoXuatDto;
import com.dev.backend.dto.response.customize.HangCanHoanKeDto;
import com.dev.backend.dto.response.customize.KetQuaQuetBarcodeDto;
import com.dev.backend.dto.response.entities.ChiTietNhatHangDto;
import com.dev.backend.dto.response.entities.DanhSachNhatHangDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.ChiTietNhatHangMapper;
import com.dev.backend.mapper.DanhSachNhatHangMapper;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.multitable.NhatHangService;
import jakarta.persistence.criteria.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
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
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;

    @Autowired
    private CanhBaoRepository canhBaoRepository;

    @Autowired
    private ChiTietDonBanHangRepository chiTietDonBanHangRepository;

    @Autowired
    private com.dev.backend.websocket.OutboundWebSocketHandler outboundWebSocketHandler;

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

            // Trạng thái = 1 (Reserved / Chờ nhặt / Chờ xuất kho)
            predicates.add(cb.equal(root.get("trangThai"), 1));

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

        if (donPage.isEmpty()) {
            return Page.empty(pageable);
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

        Map<Integer, BigDecimal> availableStockMap = new HashMap<>();
        if (!allVariantIds.isEmpty()) {
            List<Object[]> stockRows = tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(finalKhoId, new ArrayList<>(allVariantIds));
            for (Object[] row : stockRows) {
                Integer vId = (Integer) row[0];
                BigDecimal qty = (BigDecimal) row[1];
                availableStockMap.put(vId, qty != null ? qty : BigDecimal.ZERO);
            }
        }

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
                        BigDecimal orderQty = ctd.getSoLuongDat() != null ? ctd.getSoLuongDat() : BigDecimal.ZERO;
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

    @Override
    @Transactional(rollbackFor = Exception.class)
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
            if (don.getTrangThai() == null || don.getTrangThai() != 1) {
                throw new CommonException("Đơn hàng " + don.getSoDonHang() + " không ở trạng thái Chờ nhặt (trạng thái hiện tại: " + don.getTrangThai() + ")");
            }
            if (don.getDanhSachNhatHang() != null) {
                throw new CommonException("Đơn hàng " + don.getSoDonHang() + " đã được gom vào Pick List " + don.getDanhSachNhatHang().getMaPickList());
            }
            if (don.getChiTietDonBanHangs() == null || don.getChiTietDonBanHangs().isEmpty()) {
                throw new CommonException("Đơn hàng " + don.getSoDonHang() + " không có chi tiết sản phẩm");
            }
        }

        // Sinh mã Pick List theo quy chuẩn: PL-YYYYMMDD-XXX
        String dateStr = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "PL-" + dateStr + "-";
        List<String> existingCodes = danhSachNhatHangRepository.findMaPickListByPrefix(prefix);
        int nextSeq = 1;
        if (existingCodes != null && !existingCodes.isEmpty()) {
            String latestCode = existingCodes.get(0);
            try {
                String seqStr = latestCode.substring(prefix.length());
                nextSeq = Integer.parseInt(seqStr) + 1;
            } catch (Exception e) {
                log.warn("Không thể parse số thứ tự từ mã {}: {}", latestCode, e.getMessage());
                nextSeq = existingCodes.size() + 1;
            }
        }
        String maPickList = String.format("%s%03d", prefix, nextSeq);

        // Gán nhân viên nhặt hàng nếu có chỉ định
        NguoiDung nguoiNhat = null;
        if (request.getNguoiNhatId() != null) {
            nguoiNhat = nguoiDungRepository.findById(request.getNguoiNhatId())
                    .orElseThrow(() -> new CommonException("Không tìm thấy nhân viên nhặt hàng ID: " + request.getNguoiNhatId()));
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
        pickList = danhSachNhatHangRepository.save(pickList);

        // Gom nhóm SKU và tính tổng số lượng cần nhặt (Wave Picking consolidation)
        Map<Integer, BigDecimal> skuQuantityMap = new LinkedHashMap<>();
        Map<Integer, BienTheSanPham> variantMap = new HashMap<>();

        for (DonBanHang don : donList) {
            for (ChiTietDonBanHang ctd : don.getChiTietDonBanHangs()) {
                BienTheSanPham bt = ctd.getBienTheSanPham();
                if (bt != null && bt.getId() != null) {
                    variantMap.put(bt.getId(), bt);
                    BigDecimal curr = skuQuantityMap.getOrDefault(bt.getId(), BigDecimal.ZERO);
                    BigDecimal addQty = ctd.getSoLuongDat() != null ? ctd.getSoLuongDat() : BigDecimal.ZERO;
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

        // Cập nhật trạng thái các đơn hàng sang 2 (Picking / Đang nhặt hàng) và liên kết với Pick List
        List<String> maDonList = new ArrayList<>();
        for (DonBanHang don : donList) {
            don.setDanhSachNhatHang(pickList);
            don.setTrangThai(2); // Picking
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

    @Override
    @Transactional(readOnly = true)
    public Page<DanhSachNhatHangDto> getDanhSachPickList(Integer khoId, String trangThai, String searchText, Pageable pageable) {
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

            if (StringUtils.hasText(searchText)) {
                String pattern = "%" + searchText.trim().toLowerCase() + "%";
                Predicate pMa = cb.like(cb.lower(root.get("maPickList")), pattern);
                Predicate pNguoiNhat = cb.like(cb.lower(root.get("nguoiNhat").get("hoTen")), pattern);
                predicates.add(cb.or(pMa, pNguoiNhat));
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

        if (pickList.getChiTietNhatHangs() != null) {
            dto.setChiTietNhatHangs(pickList.getChiTietNhatHangs().stream()
                    .map(ctn -> {
                        ChiTietNhatHangDto itemDto = chiTietNhatHangMapper.toDto(ctn);
                        itemDto.setViTriKho("A-01-02");
                        return itemDto;
                    })
                    .collect(Collectors.toList()));
        }

        return dto;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
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

        // Kiểm tra trạng thái hợp lệ của Pick List
        String trangThaiHienTai = pickList.getTrangThai();
        if ("da_nhat".equalsIgnoreCase(trangThaiHienTai) || "da_xuat".equalsIgnoreCase(trangThaiHienTai) || "da_huy".equalsIgnoreCase(trangThaiHienTai)) {
            throw new CommonException("Không thể phân công lại cho đợt nhặt hàng đã ở trạng thái: " + trangThaiHienTai);
        }

        // Kiểm tra nhân viên được gán
        NguoiDung assignee = nguoiDungRepository.findById(request.getNguoiNhatId())
                .orElseThrow(() -> new CommonException("Không tìm thấy nhân viên nhặt hàng ID: " + request.getNguoiNhatId()));

        if (assignee.getTrangThai() == null || assignee.getTrangThai() != 1) {
            throw new CommonException("Tài khoản nhân viên nhặt hàng đang bị khóa hoặc ngưng hoạt động");
        }

        // Kiểm tra quyền: nếu là nhân viên kho thì chỉ được tự nhận việc (self-assign)
        boolean isQuanLy = isAdmin || (authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.quan_ly_kho));
        if (!isQuanLy && !authUser.getId().equals(request.getNguoiNhatId())) {
            throw new CommonException("Nhân viên kho chỉ có quyền tự nhận việc (Self-assignment)");
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

    @Override
    @Transactional(rollbackFor = Exception.class)
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

        // Kiểm tra quyền đối với nhân viên kho
        boolean isKhoStaff = authUser.getVaiTro() != null && authUser.getVaiTro().contains(IRoleType.nhan_vien_kho);
        if (isKhoStaff && !isAdmin && authUser.getVaiTro().size() == 1) {
            if (pickList.getNguoiNhat() != null && !authUser.getId().equals(pickList.getNguoiNhat().getId())) {
                throw new CommonException("Đợt nhặt hàng này đã được phân công cho nhân viên: " + pickList.getNguoiNhat().getHoTen());
            }
            if (pickList.getNguoiNhat() == null) {
                NguoiDung currentUser = nguoiDungRepository.findById(authUser.getId()).orElse(null);
                pickList.setNguoiNhat(currentUser);
            }
        }

        // Kiểm tra State Machine
        String trangThai = pickList.getTrangThai();
        if ("da_nhat".equals(trangThai)) {
            throw new CommonException("Đợt nhặt hàng này đã hoàn tất quá trình nhặt hàng");
        }
        if ("da_xuat".equals(trangThai)) {
            throw new CommonException("Đợt nhặt hàng này đã được xuất kho");
        }
        if ("da_huy".equals(trangThai)) {
            throw new CommonException("Đợt nhặt hàng này đã bị hủy");
        }

        // Nếu đang ở trạng thái cho_nhat, tự động chuyển sang dang_nhat
        if ("cho_nhat".equals(trangThai)) {
            pickList.setTrangThai("dang_nhat");
            danhSachNhatHangRepository.save(pickList);
        }

        String rawBarcode = request.getBarcode().trim();
        BigDecimal qtyToAdd = request.getSoLuong() != null && request.getSoLuong().compareTo(BigDecimal.ZERO) > 0
                ? request.getSoLuong().setScale(3, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ONE.setScale(3, java.math.RoundingMode.HALF_UP);

        List<ChiTietNhatHang> chiTiets = pickList.getChiTietNhatHangs();
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

        BigDecimal currentScanned = matchedItem.getSoLuongDaQuet() != null ? matchedItem.getSoLuongDaQuet() : BigDecimal.ZERO;
        BigDecimal required = matchedItem.getSoLuongCanNhat() != null ? matchedItem.getSoLuongCanNhat() : BigDecimal.ZERO;

        if (currentScanned.compareTo(required) >= 0) {
            throw new CommonException("Mặt hàng [" + matchedItem.getBienTheSanPham().getMaSku() + "] đã nhặt đủ số lượng yêu cầu (" + currentScanned + "/" + required + ")!");
        }

        BigDecimal newScanned = currentScanned.add(qtyToAdd);
        if (newScanned.compareTo(required) > 0) {
            throw new CommonException("Số lượng quét vượt quá yêu cầu (Đã quét: " + currentScanned + ", Quét thêm: " + qtyToAdd + ", Cần nhặt: " + required + ")");
        }

        matchedItem.setSoLuongDaQuet(newScanned);
        chiTietNhatHangRepository.save(matchedItem);

        // Tính toán tổng tiến độ
        BigDecimal totalRequired = BigDecimal.ZERO;
        BigDecimal totalScanned = BigDecimal.ZERO;
        boolean allFinished = true;

        for (ChiTietNhatHang ctn : chiTiets) {
            BigDecimal can = ctn.getSoLuongCanNhat() != null ? ctn.getSoLuongCanNhat() : BigDecimal.ZERO;
            BigDecimal da = ctn.getId().equals(matchedItem.getId()) ? newScanned : (ctn.getSoLuongDaQuet() != null ? ctn.getSoLuongDaQuet() : BigDecimal.ZERO);
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
        String shelfLocation = "A-01-02"; // Vị trí kệ định vị theo SRS 6.3.1

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

        BienTheSanPham bt = matchedItem.getBienTheSanPham();
        String tenSp = bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku();
        String tenMau = bt.getMauSac() != null ? bt.getMauSac().getTenMau() : "";
        String tenSize = bt.getSize() != null ? bt.getSize().getTenSize() : "";

        return KetQuaQuetBarcodeDto.builder()
                .chiTietId(matchedItem.getId())
                .bienTheId(bt.getId())
                .maSku(bt.getMaSku())
                .maVachSku(bt.getMaVachSku())
                .tenSanPham(tenSp)
                .tenMau(tenMau)
                .tenSize(tenSize)
                .viTriKho(shelfLocation)
                .soLuongCanNhat(required)
                .soLuongDaQuet(newScanned)
                .soLuongConLai(remainingItem)
                .trangThaiDong(itemStatus)
                .tongSoLuongCanNhat(totalRequired)
                .tongSoLuongDaQuet(totalScanned)
                .tongSoLuongConLai(totalRequired.subtract(totalScanned))
                .phanTramHoanThanh(percent)
                .coTheHoanTat(allFinished)
                .thongBao("Đã quét 1x " + tenSp + " [" + bt.getMaSku() + "] (" + newScanned + "/" + required + ")")
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
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

        if ("da_nhat".equals(pickList.getTrangThai())) {
            throw new CommonException("Đợt nhặt hàng này đã hoàn tất trước đó");
        }
        if ("da_xuat".equals(pickList.getTrangThai())) {
            throw new CommonException("Đợt nhặt hàng này đã được xuất kho");
        }
        if ("da_huy".equals(pickList.getTrangThai())) {
            throw new CommonException("Đợt nhặt hàng này đã bị hủy");
        }

        List<ChiTietNhatHang> chiTiets = pickList.getChiTietNhatHangs();
        if (chiTiets == null || chiTiets.isEmpty()) {
            throw new CommonException("Đợt nhặt hàng không có mặt hàng nào để hoàn tất");
        }

        // Bắt buộc 100% dòng mặt hàng phải nhặt đủ số lượng yêu cầu
        for (ChiTietNhatHang ctn : chiTiets) {
            BigDecimal can = ctn.getSoLuongCanNhat() != null ? ctn.getSoLuongCanNhat() : BigDecimal.ZERO;
            BigDecimal da = ctn.getSoLuongDaQuet() != null ? ctn.getSoLuongDaQuet() : BigDecimal.ZERO;
            if (da.compareTo(can) < 0) {
                String sku = ctn.getBienTheSanPham() != null ? ctn.getBienTheSanPham().getMaSku() : "SKU";
                throw new CommonException("Chưa nhặt đủ hàng! Mặt hàng [" + sku + "] mới nhặt " + da + "/" + can);
            }
        }

        String trangThaiCu = pickList.getTrangThai();
        List<DonBanHang> donHangs = pickList.getDonBanHangs() != null ? pickList.getDonBanHangs() : List.of();
        NguoiDung currentUser = nguoiDungRepository.findById(authUser.getId()).orElse(null);

        // 1. Chỉ đơn chưa xuất và chưa hủy (1 Chờ xuất kho / 2 Đang xử lý xuất kho) mới được tạo phiếu xuất.
        //    Đơn bị hủy trong lúc nhặt (ví dụ sàn hủy qua đồng bộ đơn) hoặc đã xuất bằng phiếu khác thì bỏ qua,
        //    trả về danh sách để màn hình nhắc nhân viên trả hàng đã nhặt của các đơn này về kệ.
        List<DonBanHang> donHopLe = new ArrayList<>();
        List<String> donChuaTaoPhieuXuat = new ArrayList<>();   // mã đơn, trả về cho màn hình
        List<String> lyDoBoQua = new ArrayList<>();             // mã đơn kèm lý do, ghi nhật ký
        boolean conDonDaXuat = false;
        for (DonBanHang dbh : donHangs) {
            Integer tt = dbh.getTrangThai();
            if (tt != null && (tt == ITrangThaiDonBanHang.CHO_XUAT_KHO || tt == ITrangThaiDonBanHang.DANG_XUAT_KHO)) {
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

        // 2. Trạng thái phiếu nhặt: còn đơn cần xuất → 'da_nhat'; không còn đơn nào cần xuất thì
        //    'da_xuat' nếu có đơn đã xuất, 'da_huy' nếu mọi đơn đều đã hủy.
        String trangThaiMoi = !donHopLe.isEmpty() ? "da_nhat" : (conDonDaXuat ? "da_xuat" : "da_huy");
        pickList.setTrangThai(trangThaiMoi);
        pickList.setNgayHoanTat(Instant.now());
        pickList = danhSachNhatHangRepository.save(pickList);

        // 3. Đơn bán GIỮ NGUYÊN trạng thái (2 = Đang xử lý xuất kho). Trạng thái 3 (Đã xuất toàn bộ)
        //    chỉ do PhieuXuatKhoService.updateTrangThaiDonBanHang đặt khi phiếu xuất đã hoàn thành,
        //    để đơn không hiện "đã xuất" và không "Giao thành công" được khi kho chưa trừ tồn.
        if (!donHopLe.isEmpty()) {
            for (DonBanHang dbh : donHopLe) {
                // Tự động sinh Phiếu Xuất Kho ở trạng thái 0 ("Chờ xuất") nếu chưa có
                boolean daCoPhieu = phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThai(dbh.getId(), 0);
                if (!daCoPhieu) {
                    long seq = phieuXuatKhoRepository.countBySoPhieuXuatStartingWith("PXK-") + 1;
                    String soPxk = String.format("PXK-%s-%03d",
                            LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")), seq);

                    PhieuXuatKho pxk = PhieuXuatKho.builder()
                            .soPhieuXuat(soPxk)
                            .donBanHang(dbh)
                            .kho(pickList.getKhoXuat())
                            .loaiXuat("ban_hang")
                            .trangThai(0) // 0: Chờ xuất (Pending Export - badge cam SRS 6.3.2)
                            .nguoiXuat(currentUser)
                            .ghiChu("Phiếu xuất tự động từ đợt nhặt hàng " + pickList.getMaPickList())
                            .build();
                    phieuXuatKhoRepository.save(pxk);

                    // Tạo chi tiết phiếu xuất kho cho từng sản phẩm trong đơn
                    if (dbh.getChiTietDonBanHangs() != null) {
                        for (ChiTietDonBanHang ctdb : dbh.getChiTietDonBanHangs()) {
                            BigDecimal giaVon = ctdb.getBienTheSanPham() != null && ctdb.getBienTheSanPham().getGiaVon() != null
                                    ? ctdb.getBienTheSanPham().getGiaVon()
                                    : (ctdb.getDonGia() != null ? ctdb.getDonGia() : BigDecimal.ZERO);

                            ChiTietPhieuXuatKho ctPxk = ChiTietPhieuXuatKho.builder()
                                    .phieuXuatKho(pxk)
                                    .bienTheSanPham(ctdb.getBienTheSanPham())
                                    .soLuongXuat(ctdb.getSoLuongDat() != null ? ctdb.getSoLuongDat() : BigDecimal.ONE)
                                    .giaVon(giaVon)
                                    .ghiChu("Xuất theo đơn " + dbh.getSoDonHang())
                                    .build();
                            chiTietPhieuXuatKhoRepository.save(ctPxk);
                        }
                    }
                }
            }
        }

        // 4. Ghi vết kiểm toán
        String ghiChuNhatKy = "Hoàn tất đợt nhặt hàng " + pickList.getMaPickList()
                + (donHopLe.isEmpty()
                    ? ", không còn đơn nào cần xuất nên không tạo phiếu xuất"
                    : ", tự động sinh phiếu xuất kho chờ xuất cho " + donHopLe.size() + " đơn")
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void xuLyDonBiHuyTrongPickList(DonBanHang don) {
        if (don == null || don.getId() == null) {
            return;
        }

        DanhSachNhatHang pickList = don.getDanhSachNhatHang();
        if (pickList == null) {
            return;
        }

        Integer pickListId = pickList.getId();
        String currentTrangThai = pickList.getTrangThai();
        log.info("[OUTBOUND-CANCEL] Xử lý đơn hàng {} bị hủy trong Pick List {} (Trạng thái: {})",
                don.getSoDonHang(), pickList.getMaPickList(), currentTrangThai);

        List<ChiTietDonBanHang> chiTietDons = chiTietDonBanHangRepository.findByDonBanHangId(don.getId());
        List<ChiTietNhatHang> chiTietNhats = chiTietNhatHangRepository.findByDanhSachNhatHang_Id(pickListId);

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
                            CanhBao canhBao = CanhBao.builder()
                                    .loaiCanhBao("HOAN_KE_CHO_CAT")
                                    .bienTheSanPham(bt)
                                    .kho(pickList.getKhoXuat())
                                    .soLuongHienTai(slThua)
                                    .nguongCanhBao(BigDecimal.valueOf(pickListId))
                                    .trangThai(0) // 0: Chờ cất kệ
                                    .build();
                            canhBaoRepository.save(canhBao);

                            Map<String, Object> itemTraKe = new HashMap<>();
                            itemTraKe.put("sku", bt.getMaSku());
                            itemTraKe.put("tenSanPham", bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : bt.getMaSku());
                            itemTraKe.put("soLuong", slThua);
                            danhSachHangTraKe.add(itemTraKe);
                        }

                        chiTietNhatHangRepository.save(ctn);
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
                        CanhBao cb = CanhBao.builder()
                                .loaiCanhBao("HOAN_KE_CHO_CAT")
                                .bienTheSanPham(ctn.getBienTheSanPham())
                                .kho(pickList.getKhoXuat())
                                .soLuongHienTai(daQuet)
                                .nguongCanhBao(BigDecimal.valueOf(pickListId))
                                .trangThai(0)
                                .build();
                        canhBaoRepository.save(cb);
                        ctn.setSoLuongDaQuet(BigDecimal.ZERO);
                        chiTietNhatHangRepository.save(ctn);
                    }
                }

                outboundWebSocketHandler.sendPickListEvent(pickListId, "PICK_LIST_CANCELLED", Map.of(
                        "pickListId", pickListId,
                        "maPickList", pickList.getMaPickList(),
                        "message", "Toàn bộ đơn hàng trong đợt nhặt " + pickList.getMaPickList() + " đã bị hủy! Vui lòng dừng nhặt và cất toàn bộ hàng đã lấy về kệ."
                ));
            } else {
                // Vẫn còn đơn hợp lệ -> Gửi WebSocket báo Pick UI cập nhật
                outboundWebSocketHandler.sendPickListEvent(pickListId, "ORDER_CANCELLED_IN_PICK_LIST", Map.of(
                        "pickListId", pickListId,
                        "maPickList", pickList.getMaPickList(),
                        "soDonHangBiHuy", don.getSoDonHang(),
                        "hangCanTraKe", danhSachHangTraKe,
                        "message", "Đơn hàng " + don.getSoDonHang() + " đã bị hủy! Số lượng cần nhặt đã tự động giảm. Vui lòng chuyển hàng thừa (nếu có) vào khay Put-back trên xe đẩy."
                ));
            }
        }
        // Trường hợp 2: Đã hoàn tất nhặt (da_nhat), đã có PXK nháp tại bàn đóng gói
        else if ("da_nhat".equals(currentTrangThai)) {
            // Tìm các phiếu xuất kho nháp của đơn hàng này
            List<PhieuXuatKho> pxkList = phieuXuatKhoRepository.findByDonBanHangId(don.getId());
            for (PhieuXuatKho pxk : pxkList) {
                if (pxk.getTrangThai() != null && pxk.getTrangThai() == 0) { // 0: Chờ xuất / Nháp
                    pxk.setTrangThai(2); // 2: Đã hủy / Thu hồi
                    String note = (pxk.getGhiChu() != null ? pxk.getGhiChu() + " | " : "") + "Tự động hủy do đơn " + don.getSoDonHang() + " bị hủy";
                    pxk.setGhiChu(note);
                    phieuXuatKhoRepository.save(pxk);
                }
            }

            // Sinh lệnh cất hàng về kệ (Put-away Task) cho toàn bộ sản phẩm của đơn đã nhặt về bàn đóng gói
            for (ChiTietDonBanHang ctd : chiTietDons) {
                if (ctd.getBienTheSanPham() != null && ctd.getSoLuongDat() != null && ctd.getSoLuongDat().compareTo(BigDecimal.ZERO) > 0) {
                    CanhBao canhBao = CanhBao.builder()
                            .loaiCanhBao("HOAN_KE_CHO_CAT")
                            .bienTheSanPham(ctd.getBienTheSanPham())
                            .kho(pickList.getKhoXuat())
                            .soLuongHienTai(ctd.getSoLuongDat())
                            .nguongCanhBao(BigDecimal.valueOf(pickListId))
                            .trangThai(0) // 0: Chờ cất kệ
                            .build();
                    canhBaoRepository.save(canhBao);
                }
            }

            // Kiểm tra các đơn còn lại trong Pick List
            List<DonBanHang> donCungDot = donBanHangRepository.findByDanhSachNhatHang_Id(pickListId);
            boolean conDonHoatDong = donCungDot.stream().anyMatch(d -> !d.getId().equals(don.getId()) && d.getTrangThai() != null && d.getTrangThai() != 4);

            if (!conDonHoatDong) {
                pickList.setTrangThai("da_huy");
                danhSachNhatHangRepository.save(pickList);
                outboundWebSocketHandler.sendPickListEvent(pickListId, "PICK_LIST_CANCELLED", Map.of(
                        "pickListId", pickListId,
                        "maPickList", pickList.getMaPickList(),
                        "message", "Toàn bộ đơn hàng trong đợt đã bị hủy! Toàn bộ phiếu xuất đã bị thu hồi. Đã sinh lệnh cất toàn bộ hàng về kệ."
                ));
            } else {
                outboundWebSocketHandler.sendPickListEvent(pickListId, "ORDER_CANCELLED_IN_PACKING", Map.of(
                        "pickListId", pickListId,
                        "maPickList", pickList.getMaPickList(),
                        "soDonHangBiHuy", don.getSoDonHang(),
                        "message", "Đơn hàng " + don.getSoDonHang() + " đã bị hủy! Phiếu xuất nháp đã bị thu hồi. Vui lòng chuyển hàng của đơn vào Thùng gom hàng hoàn kệ (Return-to-stock)."
                ));
            }
        }
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
            String maPickList = null;
            if (refPickListId != null) {
                maPickList = danhSachNhatHangRepository.findById(refPickListId)
                        .map(DanhSachNhatHang::getMaPickList).orElse(null);
            }

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
                    .lyDo("Đơn hàng bị hủy trong luồng xuất kho")
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

        NguoiDungAuthInfo authUser = SecurityContextHolder.getUser();
        NguoiDung currentUser = authUser != null ? nguoiDungRepository.findById(authUser.getId()).orElse(null) : null;

        cb.setTrangThai(1); // 1: Đã cất kệ
        cb.setNgayXuLy(Instant.now());
        cb.setNguoiXuLy(currentUser);
        canhBaoRepository.save(cb);
    }
}

