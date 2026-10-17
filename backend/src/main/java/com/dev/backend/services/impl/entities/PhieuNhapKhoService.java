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

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.event.InventoryRestockedEvent;
import com.dev.backend.utils.SauCommit;
import org.springframework.http.HttpStatus;
import org.springframework.context.ApplicationEventPublisher;

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

    @Autowired
    private ViTriKhoRepository viTriKhoRepository;

    @Autowired
    private TonKhoViTriRepository tonKhoViTriRepository;

    @Autowired
    private BienBanTraHangNccRepository bienBanTraHangNccRepository;

    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;

    @Autowired
    private ApplicationEventPublisher eventPublisher;

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
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu nhập"));

        if (phieu.getTrangThai() != 0) {
            throw new CommonException("Phiếu không ở trạng thái có thể nhập kho");
        }

        List<ChiTietPhieuNhapKho> danhSachNhapTheoLo = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(phieuNhapKhoId);

        // 1. CHỐT CHẶN AN TOÀN (SAFETY LOCK): Kiểm tra hàng lỗi QC và biên bản RTV
        int tongLoi = danhSachNhapTheoLo.stream()
                .mapToInt(ct -> ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0)
                .sum();
        if (tongLoi > 0) {
            boolean coBienBanRtv = bienBanTraHangNccRepository.existsByPhieuNhapKho_Id(phieuNhapKhoId);
            if (!coBienBanRtv) {
                throw new CommonException(HttpStatus.CONFLICT,
                        "Không thể hoàn tất nhập kho: Đơn có " + tongLoi + " sản phẩm lỗi kiểm đếm nhưng chưa phát hành Biên bản trả hàng (RTV). Vui lòng phát hành biên bản RTV để giải phóng chốt chặn an toàn.");
            }
        }

        // 2. Kiểm tra hoàn tất kiểm đếm cho toàn bộ dòng dự kiến nhập (draft items)
        for (ChiTietPhieuNhapKho ctDraft : phieu.getChiTietPhieuNhapKhos()) {
            if (ctDraft.getLoHang() == null) {
                int canNhap = ctDraft.getSoLuongNhap() != null ? ctDraft.getSoLuongNhap().intValue() : 0;
                int datQc = danhSachNhapTheoLo.stream()
                        .filter(ct -> ct.getBienTheSanPham().getId().equals(ctDraft.getBienTheSanPham().getId()))
                        .mapToInt(ct -> ct.getLoHang().getSoLuongNhap() != null ? ct.getLoHang().getSoLuongNhap() : ct.getSoLuongNhap().intValue())
                        .sum();
                int loiQc = danhSachNhapTheoLo.stream()
                        .filter(ct -> ct.getBienTheSanPham().getId().equals(ctDraft.getBienTheSanPham().getId()))
                        .mapToInt(ct -> ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0)
                        .sum();
                boolean daXong = "DA_HOAN_TAT".equals(ctDraft.getTrangThaiKiemDem()) || (datQc + loiQc >= canNhap);
                if (!daXong && canNhap > 0) {
                    throw new CommonException(HttpStatus.BAD_REQUEST,
                            "Vui lòng khai báo đầy đủ thông tin lô hoặc kiểm đếm cho sản phẩm "
                                    + ctDraft.getBienTheSanPham().getMaSku() + " (Đã kiểm: " + (datQc + loiQc) + "/" + canNhap + ")");
                }
            }
        }

        NguoiDung nguoiNhap = nguoiDungRepository.findById(nguoiNhapId)
                .orElseThrow(() -> new CommonException("Không tìm thấy thông tin người nhập"));

        Kho kho = phieu.getKho();
        BigDecimal tongTien = BigDecimal.ZERO;

        // Khóa các dòng tồn theo lô sẽ ghi, thứ tự PK ổn định (chống lost update với POS checkout).
        List<Integer> lotIdsToLock = danhSachNhapTheoLo.stream()
                .map(ct -> ct.getLoHang().getId())
                .distinct()
                .sorted()
                .toList();
        if (!lotIdsToLock.isEmpty()) {
            tonKhoTheoLoRepository.lockLotsForUpdateByLotIds(lotIdsToLock);
        }

        // donMuaHang sẽ là null nếu đây là phiếu Nhập Hoàn Trả (Return)
        DonMuaHang donMuaHang = phieu.getDonMuaHang();

        // Khởi tạo Set để lưu các ID Sản phẩm cha cần cập nhật giá
        Set<Integer> sanPhamIdsCanCapNhat = new HashSet<>();

        // Map lưu tổng số lượng PO đã xử lý (Đạt + Lỗi) theo từng biến thể để trừ Incoming chính xác
        Map<Integer, BigDecimal> poQtyHandledPerVariant = new HashMap<>();

        for (ChiTietPhieuNhapKho ct : danhSachNhapTheoLo) {
            LoHang loHang = ct.getLoHang();
            BigDecimal soLuongNhap = ct.getSoLuongNhap(); // Số lượng ĐẠT nhập kho

            // 1. Chuyển trạng thái lô từ TAM_KHOA sang HOAT_DONG
            loHang.setTrangThai("HOAT_DONG");
            loHangRepository.save(loHang);

            // 2. Ghi nhận số lượng ĐẠT vào ton_kho_vi_tri (nếu có vị trí kệ)
            if (loHang.getViTriKho() != null && soLuongNhap.compareTo(BigDecimal.ZERO) > 0) {
                ViTriKho viTri = loHang.getViTriKho();
                TonKhoViTri tkvt = tonKhoViTriRepository.findByViTriKho_IdAndLoHang_Id(viTri.getId(), loHang.getId())
                        .orElse(TonKhoViTri.builder()
                                .viTriKho(viTri)
                                .loHang(loHang)
                                .bienTheSanPham(ct.getBienTheSanPham())
                                .soLuong(0)
                                .build());
                tkvt.setSoLuong(tkvt.getSoLuong() + soLuongNhap.intValue());
                tonKhoViTriRepository.save(tkvt);
            }

            // 3. Cập nhật On Hand trong ton_kho_theo_lo (chỉ tăng số lượng ĐẠT)
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

            // Tích lũy số lượng kiểm đếm (Đạt + Lỗi) của biến thể từ các lô
            int slDatLo = loHang.getSoLuongNhap() != null ? loHang.getSoLuongNhap() : soLuongNhap.intValue();
            int slLoiLo = loHang.getSoLuongLoi() != null ? loHang.getSoLuongLoi() : 0;
            poQtyHandledPerVariant.merge(ct.getBienTheSanPham().getId(), BigDecimal.valueOf(slDatLo + slLoiLo), BigDecimal::add);

            // Ghi lịch sử giao dịch kho
            String ghiChuLS = donMuaHang != null
                    ? "Nhập kho từ phiếu: " + phieu.getSoPhieuNhap() + " (Kệ: " + (loHang.getViTriKho() != null ? loHang.getViTriKho().getMaViTri() : "Chưa gắn kệ") + ")"
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

            // Kích hoạt phát tán InventoryRestockedEvent cho SKU có số lượng Đạt nhập kho
            if (eventPublisher != null && soLuongNhap.compareTo(BigDecimal.ZERO) > 0) {
                try {
                    eventPublisher.publishEvent(new InventoryRestockedEvent(this, ct.getBienTheSanPham().getId(), soLuongNhap, kho.getId()));
                } catch (Exception ex) {
                    // Log warning mà không làm gián đoạn transaction
                }
            }

            // Cộng tổng tiền cho phiếu
            tongTien = tongTien.add(soLuongNhap.multiply(ct.getDonGia()));
        }

        // 4. CẬP NHẬT CÂN BẰNG TỒN KHO: Incoming -= Q_PO (giải phóng nghĩa vụ nhận hàng theo PO)
        if (donMuaHang != null) {
            for (Map.Entry<Integer, BigDecimal> entry : poQtyHandledPerVariant.entrySet()) {
                Integer btId = entry.getKey();
                BigDecimal totalPoHandled = entry.getValue();

                ChiTietDonMuaHang ctPo = donMuaHang.getChiTietDonMuaHangs().stream()
                        .filter(item -> item.getBienTheSanPham().getId().equals(btId))
                        .findFirst()
                        .orElse(null);

                if (ctPo != null) {
                    BigDecimal daNhanHienTai = ctPo.getSoLuongDaNhan() != null ? ctPo.getSoLuongDaNhan() : BigDecimal.ZERO;
                    ctPo.setSoLuongDaNhan(daNhanHienTai.add(totalPoHandled));
                    chiTietDonMuaHangRepository.save(ctPo);
                }
            }
            // Chốt trạng thái PO nếu tất cả biến thể đã nhận đủ
            boolean allDone = donMuaHang.getChiTietDonMuaHangs().stream()
                    .allMatch(item -> item.getSoLuongDaNhan() != null && item.getSoLuongDaNhan().compareTo(item.getSoLuongDat()) >= 0);
            if (allDone) {
                donMuaHang.setTrangThai(4); // Hoàn thành
            }
            donMuaHangRepository.save(donMuaHang);
        }

        phieu.setTongTien(tongTien);
        phieu.setTrangThai(TrangThaiPhieuNhap.COMPLETED.getValue());
        phieu.setNguoiNhap(nguoiNhap);
        phieu.setNgayNhap(Instant.now());
        repository.save(phieu);

        // Ghi nhật ký kiểm toán LichSuThayDoi sau khi commit thành công
        Integer phieuId = phieu.getId();
        String soPhieuNhap = phieu.getSoPhieuNhap();
        SauCommit.chay("Ghi nhật ký hoàn tất nhập kho " + soPhieuNhap, () -> lichSuThayDoiService.createGiaoDichRieng(
                LichSuThayDoi.builder()
                        .loaiThamChieu(ITable.phieu_nhap_kho)
                        .idThamChieu(phieuId)
                        .kho(kho)
                        .hanhDong(IHanhDong.nhap_kho)
                        .giaTriMoi("trang_thai = 3 (Hoàn tất)")
                        .nguoiThucHien(nguoiNhap)
                        .ngayThucHien(Instant.now())
                        .ghiChu("Hoàn tất nhập kho cho phiếu " + soPhieuNhap + " (Tổng lỗi: " + tongLoi + ")")
                        .build()));

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
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu nhập"));

        if (phieu.getSoPhieuNhap().startsWith("PN-RET-")) {
            throw new CommonException("Phiếu nhập hoàn trả đã được hệ thống cố định lô hàng, không thể chỉnh sửa!");
        }

        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new CommonException("Chỉ được khai báo lô ở trạng thái Nháp");
        }

        ChiTietPhieuNhapKho dongDraft = chiTietPhieuNhapKhoRepository
                .findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(phieuNhapKhoId, request.getBienTheSanPhamId())
                .orElseThrow(() -> new CommonException("Sản phẩm không thuộc phiếu này"));

        BigDecimal soLuongCanNhap = dongDraft.getSoLuongNhap();
        BigDecimal soLuongNhap = request.getSoLuongNhap() != null ? request.getSoLuongNhap() : BigDecimal.ZERO;
        BigDecimal soLuongLoi = request.getSoLuongLoi() != null ? request.getSoLuongLoi() : BigDecimal.ZERO;

        if (soLuongNhap.compareTo(BigDecimal.ZERO) < 0 || soLuongLoi.compareTo(BigDecimal.ZERO) < 0) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Số lượng Đạt hoặc Lỗi không được âm");
        }
        if (soLuongNhap.add(soLuongLoi).compareTo(BigDecimal.ZERO) <= 0) {
            throw new CommonException(HttpStatus.BAD_REQUEST, "Tổng số lượng Đạt và Lỗi của thùng hàng phải lớn hơn 0");
        }

        // Kiểm tra và xác thực vị trí kệ (nếu có chọn)
        ViTriKho viTri = null;
        if (request.getViTriKhoId() != null) {
            viTri = viTriKhoRepository.findById(request.getViTriKhoId())
                    .orElseThrow(() -> new CommonException("Không tìm thấy vị trí kệ ID: " + request.getViTriKhoId()));
            if (!viTri.getKhuVucKho().getKho().getId().equals(phieu.getKho().getId())) {
                throw new CommonException(HttpStatus.FORBIDDEN, "Vị trí kệ không thuộc kho của phiếu nhập");
            }
            if (viTri.getTrangThai() != null && !"HOAT_DONG".equalsIgnoreCase(viTri.getTrangThai())) {
                throw new CommonException(HttpStatus.BAD_REQUEST, "Vị trí kệ đang bị khóa hoặc ngừng hoạt động");
            }
            if (viTri.getSucChuaToiDa() != null && viTri.getSucChuaToiDa() > 0 && soLuongNhap.compareTo(BigDecimal.ZERO) > 0) {
                int dangChua = tonKhoViTriRepository.sumDangChuaByViTriId(viTri.getId());
                if (dangChua + soLuongNhap.intValue() > viTri.getSucChuaToiDa()) {
                    throw new CommonException(HttpStatus.BAD_REQUEST,
                            "Vị trí kệ " + viTri.getMaViTri() + " không đủ sức chứa (Sức chứa: " + viTri.getSucChuaToiDa()
                                    + ", Hiện chứa: " + dangChua + ", Cần nhập: " + soLuongNhap.intValue() + ")");
                }
            }
        }

        List<ChiTietPhieuNhapKho> dsLoHienTai = chiTietPhieuNhapKhoRepository.findDeclaredLots(phieuNhapKhoId, request.getBienTheSanPhamId());
        Optional<ChiTietPhieuNhapKho> existingCtOpt = chiTietPhieuNhapKhoRepository
                .findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(phieuNhapKhoId, request.getBienTheSanPhamId(), request.getMaLo());

        int tongDatCu = 0;
        int tongLoiCu = 0;
        for (ChiTietPhieuNhapKho ct : dsLoHienTai) {
            if (existingCtOpt.isPresent() && ct.getId().equals(existingCtOpt.get().getId())) {
                continue; // bỏ qua bản ghi cũ nếu đang sửa
            }
            tongDatCu += (ct.getLoHang().getSoLuongNhap() != null ? ct.getLoHang().getSoLuongNhap() : ct.getSoLuongNhap().intValue());
            tongLoiCu += (ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0);
        }

        int tongKiemDemSau = tongDatCu + tongLoiCu + soLuongNhap.intValue() + soLuongLoi.intValue();
        if (tongKiemDemSau > soLuongCanNhap.intValue()) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Tổng số lượng kiểm đếm (Đạt + Lỗi: " + tongKiemDemSau + ") vượt quá số lượng cần nhập của PO (" + soLuongCanNhap.intValue() + ")");
        }

        if (existingCtOpt.isPresent()) {
            ChiTietPhieuNhapKho ct = existingCtOpt.get();
            ct.setSoLuongNhap(soLuongNhap);
            ct.setGhiChu(request.getGhiChu());
            LoHang lo = ct.getLoHang();
            lo.setNgaySanXuat(request.getNgaySanXuat());
            lo.setViTriKho(viTri);
            lo.setSoLuongNhap(soLuongNhap.intValue());
            lo.setSoLuongConLai(soLuongNhap.intValue());
            lo.setSoLuongLoi(soLuongLoi.intValue());
            lo.setTrangThai("TAM_KHOA");
            lo.setGhiChu(request.getGhiChu());
            loHangRepository.save(lo);
            chiTietPhieuNhapKhoRepository.save(ct);
        } else {
            LoHang loHang = loHangRepository.save(LoHang.builder()
                    .bienTheSanPham(dongDraft.getBienTheSanPham())
                    .maLo(request.getMaLo())
                    .ngaySanXuat(request.getNgaySanXuat())
                    .viTriKho(viTri)
                    .soLuongNhap(soLuongNhap.intValue())
                    .soLuongConLai(soLuongNhap.intValue())
                    .soLuongLoi(soLuongLoi.intValue())
                    .trangThai("TAM_KHOA")
                    .giaVon(dongDraft.getDonGia())
                    .nhaCungCap(phieu.getNhaCungCap())
                    .ghiChu(request.getGhiChu())
                    .build());

            chiTietPhieuNhapKhoRepository.save(ChiTietPhieuNhapKho.builder()
                    .phieuNhapKho(phieu)
                    .bienTheSanPham(dongDraft.getBienTheSanPham())
                    .loHang(loHang)
                    .soLuongNhap(soLuongNhap)
                    .donGia(dongDraft.getDonGia())
                    .ghiChu(request.getGhiChu())
                    .build());
        }

        // Cập nhật số lượng đạt/lỗi tổng và trạng thái kiểm đếm của dòng draft
        int tongDatMoi = tongDatCu + soLuongNhap.intValue();
        int tongLoiMoi = tongLoiCu + soLuongLoi.intValue();
        dongDraft.setSoLuongDatQc(tongDatMoi);
        dongDraft.setSoLuongLoiQc(tongLoiMoi);
        dongDraft.setSoLuongYeuCau(soLuongCanNhap.intValue());
        if (tongDatMoi + tongLoiMoi >= soLuongCanNhap.intValue()) {
            dongDraft.setTrangThaiKiemDem("DA_HOAN_TAT");
        } else if (tongDatMoi + tongLoiMoi > 0) {
            dongDraft.setTrangThaiKiemDem("DANG_KIEM_DEM");
        } else {
            dongDraft.setTrangThaiKiemDem("CHO_KIEM_DEM");
        }
        chiTietPhieuNhapKhoRepository.save(dongDraft);
    }

    @Transactional
    public void hoanTatKiemDemBienThe(Integer phieuNhapKhoId, Integer bienTheSanPhamId) {
        PhieuNhapKho phieu = repository.findById(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu nhập"));
        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new CommonException("Chỉ được hoàn tất kiểm đếm khi phiếu ở trạng thái Nháp");
        }
        ChiTietPhieuNhapKho dongDraft = chiTietPhieuNhapKhoRepository
                .findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(phieuNhapKhoId, bienTheSanPhamId)
                .orElseThrow(() -> new CommonException("Biến thể không thuộc phiếu nhập này"));

        List<ChiTietPhieuNhapKho> dsLo = chiTietPhieuNhapKhoRepository.findDeclaredLots(phieuNhapKhoId, bienTheSanPhamId);
        int tongDat = dsLo.stream()
                .mapToInt(ct -> ct.getLoHang().getSoLuongNhap() != null ? ct.getLoHang().getSoLuongNhap() : ct.getSoLuongNhap().intValue())
                .sum();
        int tongLoi = dsLo.stream()
                .mapToInt(ct -> ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0)
                .sum();
        int tongKiemDem = tongDat + tongLoi;
        int soLuongPo = dongDraft.getSoLuongNhap().intValue();

        if (tongKiemDem < soLuongPo) {
            throw new CommonException(HttpStatus.BAD_REQUEST,
                    "Tổng kiểm đếm (" + tongKiemDem + ") chưa đạt số lượng yêu cầu của PO (" + soLuongPo + ")");
        }

        dongDraft.setSoLuongDatQc(tongDat);
        dongDraft.setSoLuongLoiQc(tongLoi);
        dongDraft.setTrangThaiKiemDem("DA_HOAN_TAT");
        chiTietPhieuNhapKhoRepository.save(dongDraft);
    }

    @Transactional(readOnly = true)
    public List<LoHangKhaiBaoDto> getDanhSachLoDaKhaiBao(Integer phieuNhapKhoId, Integer bienTheSanPhamId) {
        return chiTietPhieuNhapKhoRepository.findDeclaredLots(phieuNhapKhoId, bienTheSanPhamId).stream()
                .map(ct -> {
                    LoHang lo = ct.getLoHang();
                    return LoHangKhaiBaoDto.builder()
                            .chiTietPhieuNhapKhoId(ct.getId())
                            .loHangId(lo.getId())
                            .maLo(lo.getMaLo())
                            .ngaySanXuat(lo.getNgaySanXuat())
                            .soLuongNhap(BigDecimal.valueOf(lo.getSoLuongNhap() != null ? lo.getSoLuongNhap() : ct.getSoLuongNhap().intValue()))
                            .soLuongLoi(BigDecimal.valueOf(lo.getSoLuongLoi() != null ? lo.getSoLuongLoi() : 0))
                            .viTriKhoId(lo.getViTriKho() != null ? lo.getViTriKho().getId() : null)
                            .maViTri(lo.getViTriKho() != null ? lo.getViTriKho().getMaViTri() : null)
                            .trangThai(lo.getTrangThai())
                            .ghiChu(ct.getGhiChu())
                            .build();
                })
                .toList();
    }

    @Transactional
    public void xoaLo(Integer phieuNhapKhoId, Integer chiTietId) {
        PhieuNhapKho phieu = repository.findById(phieuNhapKhoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu"));

        if (phieu.getSoPhieuNhap().startsWith("PN-RET-")) {
            throw new CommonException("Phiếu nhập hoàn trả đã được hệ thống cố định lô hàng, không thể xóa!");
        }

        if (phieu.getTrangThai() != TrangThaiPhieuNhap.DRAFT.getValue()) {
            throw new CommonException("Chỉ được xóa lô ở trạng thái Nháp");
        }
        ChiTietPhieuNhapKho ct = chiTietPhieuNhapKhoRepository.findByIdAndPhieuNhapKho_Id(chiTietId, phieuNhapKhoId)
                .orElseThrow(() -> new CommonException("Không tìm thấy lô"));
        Integer bienTheId = ct.getBienTheSanPham().getId();
        LoHang lo = ct.getLoHang();
        chiTietPhieuNhapKhoRepository.delete(ct);
        if (lo != null) {
            loHangRepository.delete(lo);
        }

        // Cập nhật lại dòng draft
        Optional<ChiTietPhieuNhapKho> dongDraftOpt = chiTietPhieuNhapKhoRepository
                .findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(phieuNhapKhoId, bienTheId);
        if (dongDraftOpt.isPresent()) {
            ChiTietPhieuNhapKho dongDraft = dongDraftOpt.get();
            List<ChiTietPhieuNhapKho> dsConLai = chiTietPhieuNhapKhoRepository.findDeclaredLots(phieuNhapKhoId, bienTheId);
            int dat = dsConLai.stream().mapToInt(c -> c.getLoHang().getSoLuongNhap() != null ? c.getLoHang().getSoLuongNhap() : c.getSoLuongNhap().intValue()).sum();
            int loi = dsConLai.stream().mapToInt(c -> c.getLoHang().getSoLuongLoi() != null ? c.getLoHang().getSoLuongLoi() : 0).sum();
            dongDraft.setSoLuongDatQc(dat);
            dongDraft.setSoLuongLoiQc(loi);
            int canNhap = dongDraft.getSoLuongNhap() != null ? dongDraft.getSoLuongNhap().intValue() : 0;
            if (dat + loi >= canNhap && canNhap > 0) {
                dongDraft.setTrangThaiKiemDem("DA_HOAN_TAT");
            } else if (dat + loi > 0) {
                dongDraft.setTrangThaiKiemDem("DANG_KIEM_DEM");
            } else {
                dongDraft.setTrangThaiKiemDem("CHO_KIEM_DEM");
            }
            chiTietPhieuNhapKhoRepository.save(dongDraft);
        }
    }

    @Transactional(readOnly = true)
    public ChiTietPhieuNhapKhoDto getDetail(Integer id) {
        PhieuNhapKho phieu = repository.findById(id)
                .orElseThrow(() -> new CommonException("Không tìm thấy phiếu nhập id: " + id));

        Integer phieuXuatGocId = null;
        if (phieu.getPhieuChuyenKhoGoc() != null) {
            phieuXuatGocId = phieu.getPhieuChuyenKhoGoc().getId();
        }

        Map<Integer, PhieuNhapKhoItemDto> itemsMap = new LinkedHashMap<>();
        List<ChiTietPhieuNhapKho> danhSachNhapTheoLo = chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(id);

        for (ChiTietPhieuNhapKho ct : phieu.getChiTietPhieuNhapKhos()) {
            Integer btId = ct.getBienTheSanPham().getId();
            PhieuNhapKhoItemDto dto = itemsMap.computeIfAbsent(btId, k -> PhieuNhapKhoItemDto.builder()
                    .bienTheSanPhamId(btId)
                    .sku(ct.getBienTheSanPham().getMaSku())
                    .tenBienThe(ct.getBienTheSanPham().getSanPham().getTenSanPham())
                    .soLuongCanNhap(BigDecimal.ZERO)
                    .soLuongDaKhaiBao(BigDecimal.ZERO)
                    .soLuongDatQc(0)
                    .soLuongLoiQc(0)
                    .soLoDaKhoa(0)
                    .trangThaiKiemDem("CHO_KIEM_DEM")
                    .build());

            if (ct.getLoHang() == null) {
                dto.setSoLuongCanNhap(ct.getSoLuongNhap());
                if (ct.getTrangThaiKiemDem() != null) {
                    dto.setTrangThaiKiemDem(ct.getTrangThaiKiemDem());
                }
            } else {
                BigDecimal slMoi = ct.getSoLuongNhap() != null ? ct.getSoLuongNhap() : BigDecimal.ZERO;
                dto.setSoLuongDaKhaiBao(dto.getSoLuongDaKhaiBao().add(slMoi));
                if (phieu.getDonMuaHang() == null) {
                    dto.setSoLuongCanNhap(dto.getSoLuongDaKhaiBao());
                }
            }
        }

        // Tính toán các chỉ số QC chi tiết theo từng biến thể từ các lô đã khai báo
        for (PhieuNhapKhoItemDto dto : itemsMap.values()) {
            Integer btId = dto.getBienTheSanPhamId();
            List<ChiTietPhieuNhapKho> lotsForBt = danhSachNhapTheoLo.stream()
                    .filter(ct -> ct.getBienTheSanPham().getId().equals(btId))
                    .toList();

            int dat = lotsForBt.stream()
                    .mapToInt(ct -> ct.getLoHang().getSoLuongNhap() != null ? ct.getLoHang().getSoLuongNhap() : ct.getSoLuongNhap().intValue())
                    .sum();
            int loi = lotsForBt.stream()
                    .mapToInt(ct -> ct.getLoHang().getSoLuongLoi() != null ? ct.getLoHang().getSoLuongLoi() : 0)
                    .sum();

            dto.setSoLuongDatQc(dat);
            dto.setSoLuongLoiQc(loi);
            dto.setSoLoDaKhoa(lotsForBt.size());

            int canNhap = dto.getSoLuongCanNhap() != null ? dto.getSoLuongCanNhap().intValue() : 0;
            boolean daDu = (dat + loi >= canNhap) && canNhap > 0;
            dto.setDaDuLo(daDu);

            if (!"DA_HOAN_TAT".equals(dto.getTrangThaiKiemDem())) {
                if (daDu) {
                    dto.setTrangThaiKiemDem("DA_HOAN_TAT");
                } else if (dat + loi > 0) {
                    dto.setTrangThaiKiemDem("DANG_KIEM_DEM");
                } else {
                    dto.setTrangThaiKiemDem("CHO_KIEM_DEM");
                }
            }
        }

        List<PhieuNhapKhoItemDto> items = new ArrayList<>(itemsMap.values());

        // Tổng số lượng Đạt, Lỗi và Tiến độ toàn phiếu
        int tongDat = items.stream().mapToInt(i -> i.getSoLuongDatQc() != null ? i.getSoLuongDatQc() : 0).sum();
        int tongLoi = items.stream().mapToInt(i -> i.getSoLuongLoiQc() != null ? i.getSoLuongLoiQc() : 0).sum();
        int tongCanNhap = items.stream().mapToInt(i -> i.getSoLuongCanNhap() != null ? i.getSoLuongCanNhap().intValue() : 0).sum();
        double tienDo = tongCanNhap > 0
                ? Math.min(100.0, Math.round(((double) (tongDat + tongLoi) / tongCanNhap) * 1000.0) / 10.0)
                : 100.0;

        // Chốt chặn Safety Lock (Hàng lỗi và Biên bản RTV)
        Optional<BienBanTraHangNcc> rtvOpt = bienBanTraHangNccRepository.findByPhieuNhapKho_Id(phieu.getId());
        boolean coBienBanRtv = rtvOpt.isPresent();
        String maBienBanRtv = rtvOpt.map(BienBanTraHangNcc::getMaBienBan).orElse(null);
        boolean safetyLock = tongLoi > 0 && !coBienBanRtv;

        boolean allItemsDone = !items.isEmpty() && items.stream().allMatch(i -> Boolean.TRUE.equals(i.getDaDuLo()) || "DA_HOAN_TAT".equals(i.getTrangThaiKiemDem()));
        boolean coTheNhapKho = (phieu.getTrangThai() == TrangThaiPhieuNhap.DRAFT.getValue()) && allItemsDone && !safetyLock;

        ChiTietPhieuNhapKhoDto.ChiTietPhieuNhapKhoDtoBuilder builder = ChiTietPhieuNhapKhoDto.builder()
                .id(phieu.getId())
                .phieuXuatGocId(phieuXuatGocId)
                .soPhieuNhap(phieu.getSoPhieuNhap())
                .trangThai(phieu.getTrangThai())
                .ngayNhap(phieu.getNgayNhap())
                .khoId(phieu.getKho().getId())
                .tenKho(phieu.getKho().getTenKho())
                .items(items)
                .tienDoKiemDem(tienDo)
                .tongSoLuongDat(tongDat)
                .tongSoLuongLoi(tongLoi)
                .coBienBanRtv(coBienBanRtv)
                .maBienBanRtv(maBienBanRtv)
                .safetyLock(safetyLock)
                .coTheNhapKho(coTheNhapKho)
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