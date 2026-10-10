package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FilterLogicType;
import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.ChiTietDonBanHangCreating;
import com.dev.backend.dto.request.DonBanHangCreating;
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.dto.response.customize.BienTheSanPhamSelectDto;
import com.dev.backend.dto.response.customize.DonBanHangDetailResponse;
import com.dev.backend.dto.response.customize.DonBanHangKpiHomNayDto;
import com.dev.backend.dto.response.customize.PhieuXuatKhoSummaryDto;
import com.dev.backend.dto.response.entities.ChiTietDonBanHangDto;
import com.dev.backend.dto.response.entities.DonBanHangDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.ChiTietDonBanHangMapper;
import com.dev.backend.mapper.DonBanHangMapper;
import com.dev.backend.mapper.PhieuXuatKhoMapper;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class DonBanHangService extends BaseServiceImpl<DonBanHang, Integer> {

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
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        Set<String> roles = currentUser.getVaiTro();

        // 1. Nếu là Admin thì không lọc gì thêm, để super.filter xử lý theo request từ FE
        if (roles.contains(IRoleType.quan_tri_vien)) {
            return super.filter(request);
        }

        List<FilterCriteria> filters = request.getFilters() == null
                ? new ArrayList<>()
                : new ArrayList<>(request.getFilters());

        // 2. ƯU TIÊN: Nếu là nhân viên kho hoặc quản lý kho
        if (roles.contains(IRoleType.nhan_vien_kho) || roles.contains(IRoleType.quan_ly_kho)) {
            List<Integer> myWarehouseIds = currentUser.getPhanQuyenNguoiDungKhos()
                    .stream()
                    .map(pq -> pq.getKho().getId())
                    .toList();

            if (!myWarehouseIds.isEmpty()) {
                filters.add(FilterCriteria.builder()
                        .fieldName("khoXuat.id")
                        .operation(FilterOperation.IN)
                        .value(myWarehouseIds)
                        .build());
            } else {
                // Nếu nhân viên kho chưa được gán kho nào, chặn không cho thấy đơn nào
                filters.add(FilterCriteria.builder()
                        .fieldName("id")
                        .operation(FilterOperation.EQUALS)
                        .value(-1)
                        .build());
            }
        }
        // 3. Nếu CHỈ là nhân viên bán hàng (không có quyền kho)
        else if (roles.contains(IRoleType.nhan_vien_ban_hang)) {
            filters.add(FilterCriteria.builder()
                    .fieldName("nguoiTao.id")
                    .operation(FilterOperation.EQUALS)
                    .value(currentUser.getId())
                    .build());
        }

        request.setFilters(filters);
        return super.filter(request);
    }

    @Transactional(readOnly = true)
    public DonBanHangDetailResponse getDetail(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn bán"));

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

        return DonBanHangDetailResponse.builder()
                .donBanHang(donDto)
                .chiTiet(chiTietDtos)
                .phieuXuatKhoList(phieuDtos)
                .build();
    }

    @Transactional
    public void sendToWarehouse(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn bán"));

        if ("bao_gia".equals(don.getLoaiChungTu())) {
            throw new RuntimeException("Báo giá không thể gửi sang kho. Vui lòng chuyển thành đơn hàng trước!");
        }

        if (don.getTrangThai() == null || don.getTrangThai() != 0) {
            throw new RuntimeException("Chỉ đơn ở trạng thái Nháp mới được gửi kho");
        }
        don.setTrangThai(1); // Chờ xuất kho
        repository.save(don);
    }

    @Transactional
    public void cancel(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chứng từ"));

        if ("bao_gia".equals(don.getLoaiChungTu())) {
            throw new RuntimeException("Đây là báo giá, vui lòng sử dụng chức năng Từ chối báo giá để có thể ghi nhận lý do!");
        }

        if (don.getTrangThai() == 3 || don.getTrangThai() == 5) {
            throw new RuntimeException("Đơn đã hoàn thành hoặc đang giao, không thể hủy");
        }

        boolean existsCompletedPX = phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThai(id, 3);
        if (existsCompletedPX) {
            throw new RuntimeException("Đơn đã có phiếu xuất hoàn thành, không thể hủy");
        }

        don.setTrangThai(4); // Hủy đơn
        repository.save(don);
        if (don.getSoDonHang() != null && don.getSoDonHang().startsWith("SO")) {
            String maBaoGiaGoc = don.getSoDonHang().split("-")[0].replaceFirst("^SO", "BG");

            donBanHangRepository.findBySoDonHang(maBaoGiaGoc).ifPresent(baoGiaGoc -> {
                if ("bao_gia".equals(baoGiaGoc.getLoaiChungTu()) && baoGiaGoc.getTrangThai() == 2) {
                    baoGiaGoc.setTrangThai(0); // Đưa về lại trạng thái Chờ phản hồi
                    repository.save(baoGiaGoc);
                }
            });
        }
    }
    @Transactional
    public DonBanHang create(DonBanHangCreating request) {
        if (request.getChiTiet() == null || request.getChiTiet().isEmpty()) {
            throw new RuntimeException("Danh sách sản phẩm không được rỗng");
        }

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
                    BigDecimal mucGiamToiDa = giaNiemYet.multiply(new BigDecimal("0.9")); // 90% giá gốc
                    if (giaThoaThuan.compareTo(mucGiamToiDa) < 0) {
                        throw new RuntimeException("Giá bán của sản phẩm " + bienThe.getMaSku() +
                                " không được thấp hơn 10% so với giá niêm yết (" + mucGiamToiDa + ")");
                    }

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

        if (!"bao_gia".equals(baoGia.getLoaiChungTu())) {
            throw new RuntimeException("Chỉ chứng từ loại báo giá mới được chuyển đổi thành đơn");
        }
        if (baoGia.getTrangThai() == 4) {
            throw new RuntimeException("Báo giá này đã bị từ chối/hủy, không thể tạo đơn");
        }
        if (baoGia.getTrangThai() == 2) {
            throw new RuntimeException("Báo giá này đã được chuyển thành đơn hàng trước đó");
        }

        Kho kho = null;
        if (khoXuatId != null) {
            kho = entityManager.find(Kho.class, khoXuatId);
        }
        if (kho == null) {
            throw new RuntimeException("Vui lòng cung cấp kho xuất hàng để có thể tạo đơn bán hàng chính thức");
        }

        for (ChiTietDonBanHang item : baoGia.getChiTietDonBanHangs()) {
            BigDecimal qtyKhaDung = tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienThe(kho.getId(), item.getBienTheSanPham().getId());
            if (qtyKhaDung == null || qtyKhaDung.compareTo(item.getSoLuongDat()) < 0) {
                throw new CommonException("Sản phẩm [" + item.getBienTheSanPham().getMaSku() + "] không đủ hàng trong kho. Không thể tạo đơn!");
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
        if (!"bao_gia".equals(don.getLoaiChungTu())) {
            throw new RuntimeException("Chỉ áp dụng từ chối cho loại chứng từ báo giá");
        }

        don.setTrangThai(4); // 4 = Hủy / Từ chối
        don.setLyDoTuChoi(reason);
        repository.save(don);
    }

    private String generateMaChungTu(String type) {
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        String prefix = "bao_gia".equals(type) ? "BG" + dateStr : "SO" + dateStr;
        long countToday = ((DonBanHangRepository) repository).countBySoDonHangStartingWith(prefix);
        return prefix + (countToday + 1);
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
                        .tenSize(v.getSize() != null ? v.getSize().getTenSize() : null)
                        .tenChatLieu(v.getChatLieu() != null ?
                                v.getChatLieu().getTenChatLieu() : null)
                        .build())
                .toList();
    }

    private String generateSoDonHang() {
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        String prefix = "SO" + dateStr;
        long countToday = ((DonBanHangRepository) repository).countBySoDonHangStartingWith(prefix);
        return prefix + (countToday + 1);
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
        repository.save(don);
    }
    @Transactional
    public void returnOrder(Integer id) {
        DonBanHang don = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn bán"));

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
