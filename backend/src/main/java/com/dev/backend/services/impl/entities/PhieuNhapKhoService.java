package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.ChiTietPhieuNhapKhoCreating;
import com.dev.backend.dto.request.KhaiBaoLoRequest;
import com.dev.backend.dto.request.PhieuNhapKhoCreating;
import com.dev.backend.dto.response.customize.LoHangKhaiBaoDto;
import com.dev.backend.dto.response.entities.ChiTietPhieuNhapKhoDto;
import com.dev.backend.dto.response.entities.PhieuNhapKhoItemDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
public class PhieuNhapKhoService extends BaseServiceImpl<PhieuNhapKho, Integer> {
    @Autowired
    private EntityManager entityManager;

    @Autowired
    private DonMuaHangRepository donMuaHangRepository;

    @Autowired
    private ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;

    @Autowired
    private LoHangRepository loHangRepository;

    @Autowired
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;

    @Autowired
    private ChiTietDonMuaHangRepository chiTietDonMuaHangRepository;

    @Autowired
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @Autowired
    private SanPhamQuanAoService sanPhamQuanAoService;

    @Autowired
    private DonBanHangRepository donBanHangRepository;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public PhieuNhapKhoService(PhieuNhapKhoRepository repository) {
        super(repository);
    }

    @Transactional
    public PhieuNhapKho createDraft(PhieuNhapKhoCreating request) {
        if (request.getChiTietPhieuNhapKhos() == null
                || request.getChiTietPhieuNhapKhos().isEmpty()) {
            throw new RuntimeException("Danh sách sản phẩm nhập không được rỗng");
        }

        DonMuaHang donMuaHang = donMuaHangRepository.findById(request.getDonMuaHangId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy PO"));
        if (donMuaHang.getTrangThai() == null || (donMuaHang.getTrangThai() != 3 && donMuaHang.getTrangThai() != 5)) {
            throw new RuntimeException("Chỉ được tạo phiếu nhập cho đơn mua hàng ở trạng thái đang vận chuyển hoặc đã thanh toán");
        }
        var currentUser = SecurityContextHolder.getUser();
        boolean isAdmin = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        Integer currentKhoId = SecurityContextHolder.getKhoId();
        if (!isAdmin) {
            if (currentKhoId == null) {
                throw new RuntimeException("Không xác định được kho hiện tại");
            }

            if (donMuaHang.getKhoNhap() == null
                    || !donMuaHang.getKhoNhap().getId().equals(currentKhoId)) {

                throw new RuntimeException(
                        "PO không thuộc kho hiện tại. " +
                                "Kho PO: " +
                                (donMuaHang.getKhoNhap() != null
                                        ? donMuaHang.getKhoNhap().getId()
                                        : "null") +
                                " | Kho hiện tại: " + currentKhoId
                );
            }
        }

        int retry = 0;
        int maxRetry = 5;
        while (true) {
            try {
                PhieuNhapKho phieuNhapKho = PhieuNhapKho.builder()
                        .soPhieuNhap(generateSoPhieu())
                        .donMuaHang(donMuaHang)
                        .nhaCungCap(donMuaHang.getNhaCungCap())
                        .ngayNhap(null)
                        .kho(donMuaHang.getKhoNhap())
                        .ghiChu(request.getGhiChu())
                        .trangThai(TrangThaiPhieuNhap.DRAFT.getValue())
                        .tongTien(BigDecimal.ZERO)
                        .build();

                phieuNhapKho = repository.save(phieuNhapKho);

                BigDecimal tongTien = BigDecimal.ZERO;
                for (ChiTietPhieuNhapKhoCreating item : request.getChiTietPhieuNhapKhos()) {
                    ChiTietDonMuaHang ctPo = donMuaHang.getChiTietDonMuaHangs().stream()
                            .filter(poItem ->
                                    poItem.getBienTheSanPham().getId()
                                            .equals(item.getBienTheSanPhamId())
                            )
                            .findFirst()
                            .orElseThrow(() ->
                                    new RuntimeException("Sản phẩm không thuộc PO")
                            );

                    BigDecimal soLuongNhap = item.getSoLuongDuKienNhap();
                    if (soLuongNhap == null
                            || soLuongNhap.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new RuntimeException(
                                "Số lượng nhập phải lớn hơn 0"
                        );
                    }
                    BigDecimal soLuongDat = ctPo.getSoLuongDat();
                    BigDecimal soLuongDaNhan =
                            ctPo.getSoLuongDaNhan() != null
                                    ? ctPo.getSoLuongDaNhan()
                                    : BigDecimal.ZERO;
                    BigDecimal soLuongConLai =
                            soLuongDat.subtract(soLuongDaNhan);
                    if (soLuongNhap.compareTo(soLuongConLai) > 0) {
                        throw new RuntimeException(
                                "Sản phẩm "
                                        + ctPo.getBienTheSanPham().getMaSku()
                                        + " nhập vượt quá số lượng còn lại ("
                                        + soLuongConLai + ")"
                        );
                    }
                    ChiTietPhieuNhapKho ct = ChiTietPhieuNhapKho.builder()
                            .phieuNhapKho(phieuNhapKho)
                            .bienTheSanPham(ctPo.getBienTheSanPham())
                            .soLuongNhap(soLuongNhap)
                            .donGia(ctPo.getDonGia())
                            .loHang(null)
                            .build();
                    chiTietPhieuNhapKhoRepository.save(ct);
                    tongTien = tongTien.add(
                            ctPo.getDonGia().multiply(soLuongNhap)
                    );
                }
                phieuNhapKho.setTongTien(tongTien);
                repository.save(phieuNhapKho);
                return phieuNhapKho;
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                if (isDuplicateSoPhieu(ex) && retry < maxRetry) {
                    retry++;
                    continue;
                }
                throw ex;
            }
        }
    }

    @Transactional
    public void completePhieuNhap(Integer phieuNhapKhoId, Integer nguoiNhapId) {
        PhieuNhapKho phieu = repository.findById(phieuNhapKhoId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu nhập"));

        if (phieu.getTrangThai() != 0) {
            throw new RuntimeException("Phiếu không ở trạng thái có thể nhập kho");
        }

        long chuaDuLo = chiTietPhieuNhapKhoRepository.countBienTheChuaDuLo(phieuNhapKhoId);
        if (chuaDuLo > 0) {
            throw new RuntimeException("Vui lòng khai báo đầy đủ thông tin lô cho sản phẩm trước khi hoàn tất");
        }

        NguoiDung nguoiNhap = nguoiDungRepository.findById(nguoiNhapId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông tin người nhập"));

        List<ChiTietPhieuNhapKho> danhSachNhapTheoLo = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(phieuNhapKhoId);
        Kho kho = phieu.getKho();
        BigDecimal tongTien = BigDecimal.ZERO;

        // Khóa các dòng tồn theo lô sẽ ghi, thứ tự PK ổn định (chống lost update với POS checkout).
        List<Integer> lotIdsToLock = danhSachNhapTheoLo.stream()
                .map(ct -> ct.getLoHang().getId())
                .distinct()
                .toList();
        tonKhoTheoLoRepository.lockLotsForUpdateByLotIds(lotIdsToLock);

        // donMuaHang sẽ là null nếu đây là phiếu Nhập Hoàn Trả (Return)
        DonMuaHang donMuaHang = phieu.getDonMuaHang();

        // Khởi tạo Set để lưu các ID Sản phẩm cha cần cập nhật giá
        Set<Integer> sanPhamIdsCanCapNhat = new HashSet<>();

        for (ChiTietPhieuNhapKho ct : danhSachNhapTheoLo) {
            LoHang loHang = ct.getLoHang();
            BigDecimal soLuongNhap = ct.getSoLuongNhap();

            TonKhoTheoLo tonKho = tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(kho.getId(), loHang.getId())
                    .orElse(TonKhoTheoLo.builder()
                            .kho(kho)
                            .loHang(loHang)
                            .soLuongTon(BigDecimal.ZERO)
                            .soLuongDaDat(BigDecimal.ZERO)
                            .build());

            BigDecimal soLuongTruoc = tonKho.getSoLuongTon();
            BigDecimal soLuongSau = soLuongTruoc.add(soLuongNhap);

            tonKho.setSoLuongTon(soLuongSau);
            tonKho.setNgayNhapGanNhat(Instant.now());
            tonKho.setLanCapNhatCuoi(Instant.now());
            tonKhoTheoLoRepository.save(tonKho);

            // BỔ SUNG FIX: Chỉ xử lý cập nhật số lượng Đã Nhận nếu có PO
            if (donMuaHang != null) {
                ChiTietDonMuaHang ctPo = donMuaHang.getChiTietDonMuaHangs().stream()
                        .filter(item -> item.getBienTheSanPham().getId().equals(ct.getBienTheSanPham().getId()))
                        .findFirst()
                        .orElseThrow(() -> new RuntimeException("Sản phẩm " + ct.getBienTheSanPham().getMaSku() + " không có trong PO"));

                BigDecimal daNhanHienTai = ctPo.getSoLuongDaNhan() != null ? ctPo.getSoLuongDaNhan() : BigDecimal.ZERO;
                ctPo.setSoLuongDaNhan(daNhanHienTai.add(soLuongNhap));
                chiTietDonMuaHangRepository.save(ctPo);
            }

            // Ghi lịch sử giao dịch (Đổi ghi chú tùy theo phiếu PO hay phiếu Hoàn trả)
            String ghiChuLS = donMuaHang != null
                    ? "Nhập kho từ phiếu: " + phieu.getSoPhieuNhap()
                    : "Nhập hoàn trả (Return) từ phiếu: " + phieu.getSoPhieuNhap();

            LichSuGiaoDichKho history = LichSuGiaoDichKho.builder()
                    .ngayGiaoDich(Instant.now())
                    .loaiGiaoDich("nhap_kho")
                    .loaiThamChieu("phieu_nhap_kho")
                    .idThamChieu(phieu.getId())
                    .bienTheSanPham(ct.getBienTheSanPham())
                    .loHang(loHang)
                    .kho(kho)
                    .soLuong(soLuongNhap)
                    .soLuongTruoc(soLuongTruoc)
                    .soLuongSau(soLuongSau)
                    .giaVon(ct.getDonGia())
                    .nguoiDung(nguoiNhap)
                    .ghiChu(ghiChuLS)
                    .build();
            lichSuGiaoDichKhoRepository.save(history);
            sanPhamIdsCanCapNhat.add(ct.getBienTheSanPham().getSanPham().getId());
            // Cộng tổng tiền cho phiếu
            tongTien = tongTien.add(soLuongNhap.multiply(ct.getDonGia()));
        }

        phieu.setTongTien(tongTien);
        phieu.setTrangThai(TrangThaiPhieuNhap.COMPLETED.getValue());
        phieu.setNguoiNhap(nguoiNhap);
        phieu.setNgayNhap(Instant.now());
        repository.save(phieu);

        if (donMuaHang != null) {
            donMuaHangRepository.save(donMuaHang);
        }

        entityManager.flush();
        for (Integer spId : sanPhamIdsCanCapNhat) {
            sanPhamQuanAoService.recalculatePriceAndStatus(spId);
        }
    }

    @Transactional
    public void huyPhieuNhap(Integer id) {
        PhieuNhapKho phieu = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu nhập"));

        if (phieu.getSoPhieuNhap().startsWith("PN-RET-")) {
            throw new RuntimeException("Đây là phiếu nhập hoàn trả bắt buộc, hệ thống không cho phép hủy!");
        }

        if (phieu.getTrangThai() == TrangThaiPhieuNhap.COMPLETED.getValue()) {
            throw new RuntimeException("Phiếu đã hoàn thành, không thể huỷ");
        }

        phieu.setTrangThai(TrangThaiPhieuNhap.CANCELLED.getValue());
        repository.save(phieu);
    }

    @Transactional
    public void khaiBaoLo(Integer phieuNhapKhoId, KhaiBaoLoRequest request) {
        PhieuNhapKho phieu = repository.findById(phieuNhapKhoId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu nhập"));

        if (phieu.getSoPhieuNhap().startsWith("PN-RET-")) {
            throw new RuntimeException("Phiếu nhập hoàn trả đã được hệ thống cố định lô hàng, không thể chỉnh sửa!");
        }

        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new RuntimeException("Chỉ được khai báo lô ở trạng thái Nháp");
        }

        ChiTietPhieuNhapKho dongDraft = chiTietPhieuNhapKhoRepository
                .findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(phieuNhapKhoId, request.getBienTheSanPhamId())
                .orElseThrow(() -> new RuntimeException("Sản phẩm không thuộc phiếu này"));

        BigDecimal soLuongCanNhap = dongDraft.getSoLuongNhap();
        BigDecimal soLuongDaKhaiBao = chiTietPhieuNhapKhoRepository.sumSoLuongDaKhaiBao(phieuNhapKhoId, request.getBienTheSanPhamId());

        Optional<ChiTietPhieuNhapKho> existingCtOpt = chiTietPhieuNhapKhoRepository
                .findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(phieuNhapKhoId, request.getBienTheSanPhamId(), request.getMaLo());

        BigDecimal soLuongCu = existingCtOpt.map(ChiTietPhieuNhapKho::getSoLuongNhap).orElse(BigDecimal.ZERO);
        BigDecimal tongSauKhaiBao = soLuongDaKhaiBao.subtract(soLuongCu).add(request.getSoLuongNhap());

        if (tongSauKhaiBao.compareTo(soLuongCanNhap) > 0) {
            throw new RuntimeException("Số lượng khai báo vượt quá số lượng cần nhập");
        }

        if (existingCtOpt.isPresent()) {
            ChiTietPhieuNhapKho ct = existingCtOpt.get();
            ct.setSoLuongNhap(request.getSoLuongNhap());
            ct.setGhiChu(request.getGhiChu());
            LoHang lo = ct.getLoHang();
            lo.setNgaySanXuat(request.getNgaySanXuat());
            lo.setGhiChu(request.getGhiChu());
            chiTietPhieuNhapKhoRepository.save(ct);
        } else {
            LoHang loHang = loHangRepository.save(LoHang.builder()
                    .bienTheSanPham(dongDraft.getBienTheSanPham())
                    .maLo(request.getMaLo())
                    .ngaySanXuat(request.getNgaySanXuat())
                    .giaVon(dongDraft.getDonGia())
                    .nhaCungCap(phieu.getNhaCungCap())
                    .ghiChu(request.getGhiChu())
                    .build());

            chiTietPhieuNhapKhoRepository.save(ChiTietPhieuNhapKho.builder()
                    .phieuNhapKho(phieu)
                    .bienTheSanPham(dongDraft.getBienTheSanPham())
                    .loHang(loHang)
                    .soLuongNhap(request.getSoLuongNhap())
                    .donGia(dongDraft.getDonGia())
                    .ghiChu(request.getGhiChu())
                    .build());
        }
    }

    @Transactional(readOnly = true)
    public List<LoHangKhaiBaoDto> getDanhSachLoDaKhaiBao(Integer phieuNhapKhoId, Integer bienTheSanPhamId) {
        return chiTietPhieuNhapKhoRepository.findDeclaredLots(phieuNhapKhoId, bienTheSanPhamId).stream()
                .map(ct -> LoHangKhaiBaoDto.builder()
                        .chiTietPhieuNhapKhoId(ct.getId())
                        .loHangId(ct.getLoHang().getId())
                        .maLo(ct.getLoHang().getMaLo())
                        .ngaySanXuat(ct.getLoHang().getNgaySanXuat())
                        .soLuongNhap(ct.getSoLuongNhap())
                        .ghiChu(ct.getGhiChu())
                        .build())
                .toList();
    }

    @Transactional
    public void xoaLo(Integer phieuNhapKhoId, Integer chiTietId) {
        PhieuNhapKho phieu = repository.findById(phieuNhapKhoId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu"));

        if (phieu.getSoPhieuNhap().startsWith("PN-RET-")) {
            throw new RuntimeException("Phiếu nhập hoàn trả đã được hệ thống cố định lô hàng, không thể xóa!");
        }

        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new RuntimeException("Chỉ được xóa lô ở trạng thái Nháp");
        }
        ChiTietPhieuNhapKho ct = chiTietPhieuNhapKhoRepository.findByIdAndPhieuNhapKho_Id(chiTietId, phieuNhapKhoId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lô"));
        LoHang lo = ct.getLoHang();
        chiTietPhieuNhapKhoRepository.delete(ct);
        loHangRepository.delete(lo);
    }

    @Transactional(readOnly = true)
    public ChiTietPhieuNhapKhoDto getDetail(Integer id) {
        PhieuNhapKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu nhập id: " + id));

        // Lấy ID phiếu gốc qua Khóa ngoại mới cấu hình
        Integer phieuXuatGocId = null;
        if (phieu.getPhieuChuyenKhoGoc() != null) {
            phieuXuatGocId = phieu.getPhieuChuyenKhoGoc().getId();
        }

        Map<Integer, PhieuNhapKhoItemDto> itemsMap = new LinkedHashMap<>();

        for (ChiTietPhieuNhapKho ct : phieu.getChiTietPhieuNhapKhos()) {
            Integer btId = ct.getBienTheSanPham().getId();
            PhieuNhapKhoItemDto dto = itemsMap.computeIfAbsent(btId, k -> PhieuNhapKhoItemDto.builder()
                    .bienTheSanPhamId(btId)
                    .sku(ct.getBienTheSanPham().getMaSku())
                    .tenBienThe(ct.getBienTheSanPham().getSanPham().getTenSanPham())
                    .soLuongCanNhap(BigDecimal.ZERO)
                    .soLuongDaKhaiBao(BigDecimal.ZERO)
                    .build());

            if (ct.getLoHang() == null) {
                // Luồng PO: Dòng chứa số lượng dự kiến nhập từ nhà cung cấp
                dto.setSoLuongCanNhap(ct.getSoLuongNhap());
            } else {
                // Các dòng đã khai báo lô cụ thể (Hoặc dòng từ Chuyển kho)
                BigDecimal slMoi = ct.getSoLuongNhap() != null ? ct.getSoLuongNhap() : BigDecimal.ZERO;
                dto.setSoLuongDaKhaiBao(dto.getSoLuongDaKhaiBao().add(slMoi));

                // Nếu là chuyển kho nội bộ (không có dòng null), số lượng cần nhập chính bằng số lượng đã chuyển đi
                if (phieu.getDonMuaHang() == null) {
                    dto.setSoLuongCanNhap(dto.getSoLuongDaKhaiBao()); // Chuyển kho đã có lô sẵn
                }
            }
        }
        itemsMap.values().forEach(item -> {
            boolean daDu = item.getSoLuongDaKhaiBao().compareTo(item.getSoLuongCanNhap()) >= 0
                    && item.getSoLuongCanNhap().compareTo(BigDecimal.ZERO) > 0;
            item.setDaDuLo(daDu);
        });

        List<PhieuNhapKhoItemDto> items = new ArrayList<>(itemsMap.values());
        ChiTietPhieuNhapKhoDto.ChiTietPhieuNhapKhoDtoBuilder builder = ChiTietPhieuNhapKhoDto.builder()
                .id(phieu.getId())
                .phieuXuatGocId(phieuXuatGocId)
                .soPhieuNhap(phieu.getSoPhieuNhap())
                .trangThai(phieu.getTrangThai())
                .ngayNhap(phieu.getNgayNhap())
                .khoId(phieu.getKho().getId())
                .tenKho(phieu.getKho().getTenKho())
                .items(items)
                .tenNguoiNhap(phieu.getNguoiNhap() != null ? phieu.getNguoiNhap().getHoTen() : null)
                .tenNguoiDuyet(phieu.getNguoiDuyet() != null ? phieu.getNguoiDuyet().getHoTen() : null);

        if (phieu.getDonMuaHang() == null) {
            boolean isReturn = phieu.getPhieuChuyenKhoGoc() != null && phieu.getKho().getId().equals(phieu.getPhieuChuyenKhoGoc().getKho().getId());
            builder.loaiNhap(isReturn ? "Nhập hoàn trả (Hủy chuyển kho)" : "Chuyển kho nội bộ");

            List<String> tenKhoNguonList = lichSuGiaoDichKhoRepository.findTenKhoNguonByPhieuNhap(id);
            if (!tenKhoNguonList.isEmpty()) builder.tenKhoChuyenTu(tenKhoNguonList.get(0));
        } else {
            builder.loaiNhap("Nhập từ đơn mua hàng");
            builder.donMuaHangId(phieu.getDonMuaHang().getId()).soDonMua(phieu.getDonMuaHang().getSoDonMua());
            if (phieu.getNhaCungCap() != null) {
                builder.nhaCungCapId(phieu.getNhaCungCap().getId()).tenNhaCungCap(phieu.getNhaCungCap().getTenNhaCungCap());
            }
        }
        return builder.build();
    }

    private String generateSoPhieu() {
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        String prefix = "PN" + dateStr;
        long countToday = ((PhieuNhapKhoRepository) repository).countBySoPhieuPrefix(prefix);
        return prefix + (countToday + 1);
    }

    private boolean isDuplicateSoPhieu(Exception ex) {
        Throwable cause = ex;
        while (cause != null) {
            if (cause.getMessage() != null && cause.getMessage().contains("uk_phieu_nhap_kho_so_phieu")) return true;
            cause = cause.getCause();
        }
        return false;
    }
    @Transactional
    public void completeTransferReceipt(Integer phieuNhapId, Integer nguoiNhapId) {
        //Tìm phiếu nhập
        PhieuNhapKho phieu = repository.findById(phieuNhapId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu nhập"));

        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new RuntimeException("Chỉ phiếu Nháp mới có thể hoàn tất nhập kho");
        }

        PhieuXuatKho pck = phieu.getPhieuChuyenKhoGoc();
        if (pck == null) {
            throw new RuntimeException("Phiếu nhập này không thuộc luồng luân chuyển kho");
        }

        NguoiDung nguoiNhap = nguoiDungRepository.findById(nguoiNhapId).orElseThrow();
        Kho khoDich = phieu.getKho();

        //Lấy kho trung chuyển
        Kho khoTransit = entityManager.createQuery("SELECT k FROM Kho k WHERE k.maKho = 'KHO_TRANSIT'", Kho.class)
                .getSingleResult();
        if (khoTransit == null) throw new RuntimeException("Lỗi: Hệ thống chưa cấu hình KHO_TRANSIT");

        boolean isReturn = khoDich.getId().equals(pck.getKho().getId());

        List<ChiTietPhieuNhapKho> details = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(phieuNhapId);
        Set<Integer> sanPhamIdsCanCapNhat = new HashSet<>();

        // Khóa các dòng tồn theo lô sẽ ghi, thứ tự PK ổn định (chống lost update với POS checkout).
        List<Integer> lotIdsToLock = details.stream()
                .map(ct -> ct.getLoHang().getId())
                .distinct()
                .toList();
        tonKhoTheoLoRepository.lockLotsForUpdateByLotIds(lotIdsToLock);

        for (ChiTietPhieuNhapKho ct : details) {
            BigDecimal qty = ct.getSoLuongNhap();
            LoHang lo = ct.getLoHang();

            // TRỪ TỒN TẠI KHO TRUNG CHUYỂN
            TonKhoTheoLo tonTransit = tonKhoTheoLoRepository
                    .findByKho_IdAndLoHang_Id(khoTransit.getId(), lo.getId())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy hàng trong kho trung chuyển cho lô: " + lo.getMaLo()));

            BigDecimal tonTruocTransit = tonTransit.getSoLuongTon();
            tonTransit.setSoLuongTon(tonTruocTransit.subtract(qty));
            tonKhoTheoLoRepository.save(tonTransit);

            // CỘNG TỒN VÀO KHO ĐÍCH
            TonKhoTheoLo tonDich = tonKhoTheoLoRepository
                    .findByKho_IdAndLoHang_Id(khoDich.getId(), lo.getId())
                    .orElse(TonKhoTheoLo.builder()
                            .kho(khoDich).loHang(lo)
                            .soLuongTon(BigDecimal.ZERO).soLuongDaDat(BigDecimal.ZERO)
                            .build());

            BigDecimal tonTruocDich = tonDich.getSoLuongTon();
            tonDich.setSoLuongTon(tonTruocDich.add(qty));
            tonDich.setNgayNhapGanNhat(Instant.now());
            tonKhoTheoLoRepository.save(tonDich);

            // GHI LỊCH SỬ GIAO DỊCH
            String loaiGiaoDichNote = isReturn ? "Hoàn trả nhập kho (Hủy yêu cầu): " : "Nhập chuyển kho từ yêu cầu: ";
            LichSuGiaoDichKho history = LichSuGiaoDichKho.builder()
                    .ngayGiaoDich(Instant.now())
                    .loaiGiaoDich("nhap_kho")
                    .loaiThamChieu("phieu_nhap_kho")
                    .idThamChieu(phieu.getId())
                    .bienTheSanPham(ct.getBienTheSanPham())
                    .loHang(lo)
                    .kho(khoDich)
                    .soLuong(qty)
                    .soLuongTruoc(tonTruocDich)
                    .soLuongSau(tonDich.getSoLuongTon())
                    .giaVon(ct.getDonGia())
                    .nguoiDung(nguoiNhap)
                    .ghiChu(loaiGiaoDichNote + pck.getSoPhieuXuat())
                    .build();
            lichSuGiaoDichKhoRepository.save(history);
            sanPhamIdsCanCapNhat.add(ct.getBienTheSanPham().getSanPham().getId());
        }

        // Cập nhật trạng thái phiếu nhập
        phieu.setTrangThai(TrangThaiPhieuNhap.COMPLETED.getValue());
        phieu.setNgayNhap(Instant.now());
        phieu.setNguoiNhap(nguoiNhap);
        repository.save(phieu);

        // Chốt trạng thái Phiếu Chuyển Kho gốc = 5 (Hoàn tất) NẾU là nhập thành công cho kho B
        if (!isReturn) {
            pck.setTrangThai(5);
            phieuXuatKhoRepository.save(pck);
        }
        entityManager.flush();
        for (Integer spId : sanPhamIdsCanCapNhat) {
            sanPhamQuanAoService.recalculatePriceAndStatus(spId);
        }
    }
    @Transactional
    public PhieuNhapKho createImportFromTransfer(Integer pckId) {
        // Tìm phiếu yêu cầu chuyển kho gốc
        PhieuXuatKho pck = phieuXuatKhoRepository.findById(pckId)
                .orElseThrow(() -> new CommonException("Không tìm thấy yêu cầu chuyển kho"));

        if (!"khac".equals(pck.getLoaiXuat()) || pck.getPhieuChuyenKhoGoc() != null) {
            throw new CommonException("Đây không phải là phiếu yêu cầu chuyển kho gốc");
        }

        Kho khoDich;
        String prefix;
        String ghiChu;

        // Xác định luồng: Nhập bình thường (Kho B) hay Nhập Hoàn trả (Kho A)
        if (pck.getTrangThai() == 3) {
            khoDich = pck.getKhoChuyenDen();
            prefix = "PN-TRF-";
            ghiChu = "Nhập kho thủ công từ phiếu chuyển: " + pck.getSoPhieuXuat();
        } else if (pck.getTrangThai() == 4) {
            khoDich = pck.getKho(); // Nhập trả về lại kho nguồn
            prefix = "PN-RET-";
            ghiChu = "Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: " + pck.getSoPhieuXuat();
        } else {
            throw new CommonException("Trạng thái phiếu chuyển không hợp lệ để tạo phiếu nhập");
        }

        // Tìm Phiếu Xuất Con đã thực xuất (Trạng thái = 3) để lấy thông tin hàng trong Transit
        List<PhieuXuatKho> dsPhieuXuatCon = entityManager.createQuery(
                        "SELECT p FROM PhieuXuatKho p WHERE p.phieuChuyenKhoGoc.id = :pckId AND p.trangThai = 3", PhieuXuatKho.class)
                .setParameter("pckId", pckId)
                .getResultList();

        if (dsPhieuXuatCon.isEmpty()) {
            throw new CommonException("Hàng hóa chưa được xuất khỏi kho, không thể tạo phiếu nhập.");
        }
        PhieuXuatKho phieuXuatThucTe = dsPhieuXuatCon.get(0);

        // Tạo phiếu nhập Nháp
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        long countToday = ((PhieuNhapKhoRepository) repository).countBySoPhieuPrefix(prefix + dateStr);
        String soPhieuNhap = prefix + dateStr + (countToday + 1);

        PhieuNhapKho pn = PhieuNhapKho.builder()
                .soPhieuNhap(soPhieuNhap)
                .kho(khoDich)
                .phieuChuyenKhoGoc(pck) // Liên kết khóa ngoại
                .trangThai(TrangThaiPhieuNhap.DRAFT.getValue()) // Nháp (0)
                .ngayTao(Instant.now())
                .ghiChu(ghiChu)
                .tongTien(BigDecimal.ZERO)
                .build();
        pn = repository.save(pn);

        // Kế thừa chi tiết (bao gồm cả Lô hàng) từ phiếu xuất thực tế
        List<ChiTietPhieuXuatKho> xuatDetails = entityManager.createQuery(
                        "SELECT ct FROM ChiTietPhieuXuatKho ct WHERE ct.phieuXuatKho.id = :pxId AND ct.loHang IS NOT NULL", ChiTietPhieuXuatKho.class)
                .setParameter("pxId", phieuXuatThucTe.getId())
                .getResultList();

        BigDecimal tongTien = BigDecimal.ZERO;
        for (ChiTietPhieuXuatKho xuat : xuatDetails) {
            ChiTietPhieuNhapKho ctNhap = ChiTietPhieuNhapKho.builder()
                    .phieuNhapKho(pn)
                    .bienTheSanPham(xuat.getBienTheSanPham())
                    .loHang(xuat.getLoHang()) // KẾ THỪA LÔ HÀNG ĐÃ PICK
                    .soLuongNhap(xuat.getSoLuongXuat())
                    .donGia(xuat.getGiaVon() != null ? xuat.getGiaVon() : BigDecimal.ZERO)
                    .ghiChu("Kế thừa từ hàng đi đường")
                    .build();
            chiTietPhieuNhapKhoRepository.save(ctNhap);
            tongTien = tongTien.add(ctNhap.getDonGia().multiply(ctNhap.getSoLuongNhap()));
        }

        pn.setTongTien(tongTien);
        return repository.save(pn);
    }

    @Transactional
    public PhieuNhapKho createReturnImportDraft(Integer phieuXuatKhoId, String ghiChu) {
        PhieuXuatKho px = phieuXuatKhoRepository.findById(phieuXuatKhoId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu xuất kho"));

        DonBanHang donBanHang = px.getDonBanHang();
        if (donBanHang == null || donBanHang.getTrangThai() != 6) {
            throw new RuntimeException("Phiếu xuất này không thuộc Đơn hàng bị hoàn trả!");
        }

        Kho khoNhan = px.getKho() != null ? px.getKho() : donBanHang.getKhoXuat();
        if (khoNhan == null) {
            throw new RuntimeException("Không xác định được kho nhận trả hàng");
        }

        // Tạo số phiếu
        String dateStr = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        String prefix = "PN-RET-" + dateStr;
        long countToday = ((PhieuNhapKhoRepository) repository).countBySoPhieuPrefix(prefix);
        String soPhieuNhap = prefix + (countToday + 1);

        // Tạo phiếu nhập Nháp
        PhieuNhapKho pn = PhieuNhapKho.builder()
                .soPhieuNhap(soPhieuNhap)
                .kho(khoNhan)
                .ngayNhap(null)
                .trangThai(TrangThaiPhieuNhap.DRAFT.getValue())
                .ghiChu(ghiChu != null ? ghiChu : "Nhập hoàn trả từ phiếu xuất: " + px.getSoPhieuXuat())
                .tongTien(BigDecimal.ZERO)
                .build();
        pn = repository.save(pn);

        BigDecimal tongTienNhap = BigDecimal.ZERO;

        // Lấy chi tiết xuất kho có gắn Lô Hàng
        List<ChiTietPhieuXuatKho> dsChiTietXuat = entityManager.createQuery(
                        "SELECT ct FROM ChiTietPhieuXuatKho ct WHERE ct.phieuXuatKho.id = :pxId AND ct.loHang IS NOT NULL", ChiTietPhieuXuatKho.class)
                .setParameter("pxId", px.getId())
                .getResultList();

        for (ChiTietPhieuXuatKho ctXuat : dsChiTietXuat) {
            BigDecimal slHoanTra = ctXuat.getSoLuongXuat();
            BigDecimal donGia = ctXuat.getGiaVon() != null ? ctXuat.getGiaVon() : BigDecimal.ZERO;

            ChiTietPhieuNhapKho ctNhap = ChiTietPhieuNhapKho.builder()
                    .phieuNhapKho(pn)
                    .bienTheSanPham(ctXuat.getBienTheSanPham())
                    .loHang(ctXuat.getLoHang())
                    .soLuongNhap(slHoanTra)
                    .donGia(donGia)
                    .ghiChu("Hoàn trả từ lô: " + ctXuat.getLoHang().getMaLo())
                    .build();
            chiTietPhieuNhapKhoRepository.save(ctNhap);

            tongTienNhap = tongTienNhap.add(donGia.multiply(slHoanTra));
        }

        pn.setTongTien(tongTienNhap);
        return repository.save(pn);
    }
}