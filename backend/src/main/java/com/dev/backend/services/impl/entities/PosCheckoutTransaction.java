package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.dto.response.customize.PosPriceChangeInfo;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.utils.PosCheckoutPayloadHash;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Executor ghi của checkout POS — MỘT transaction DB cho toàn bộ: đơn bán hàng
 * trực tiếp, dòng đơn, phiếu xuất kho hoàn thành theo lô, trừ tồn, nhật ký kho,
 * phiếu thu tiền mặt và kết quả checkout. Không gọi helper trừ tồn nào khác
 * (không dùng pickLoHang/createFromSO/complete của luồng cũ) — tránh trừ 2 lần
 * và tránh lỗ hổng ràng buộc phiếu–dòng–SKU–lô của code cũ.
 *
 * Bean riêng để transaction proxy hoạt động đúng (orchestrator PosCheckoutService
 * gọi qua proxy, không tự gọi nội bộ). Mọi lỗi RuntimeException -> rollback toàn
 * bộ (không có checked exception nào trong luồng này).
 */
@Service
public class PosCheckoutTransaction {

    private static final int MAX_DONG = 100;
    private static final int MAX_SO_LUONG_MOI_DONG = 1000;
    private static final BigDecimal MAX_TIEN_MAT = new BigDecimal("500000000");
    private static final int MAX_RETRY_SO_CHUNG_TU = 5;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PosCatalogService posCatalogService;

    @Autowired
    private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Autowired
    private DonBanHangRepository donBanHangRepository;
    @Autowired
    private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Autowired
    private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Autowired
    private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @Autowired
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Autowired
    private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;
    @Autowired
    private PosCheckoutRequestRepository posCheckoutRequestRepository;
    @Autowired
    private PosPaymentRepository posPaymentRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Transactional
    public PosCheckoutResponse execute(PosCheckoutCreating request) {
        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        Integer userId = auth.getId();

        // 1. Xác thực nghiệp vụ (trước khi ghi bất cứ gì): requestId/items trước vì là
        //    validate hình thức rẻ nhất, rồi kho/khách, rồi biến thể.
        String requestId = validateRequestId(request.getRequestId());
        request.setRequestId(requestId); // dùng giá trị đã trim cho hash + lưu DB
        List<PosCheckoutCreating.PosCheckoutItemCreating> items = validateItems(request.getItems());
        posCatalogService.authorizeWarehouse(request.getKhoId());
        KhachHang khachHang = validateCustomer(request.getKhachHangId());
        Map<Integer, BienTheSanPham> variants = validateVariants(items);

        // 2. Giá server là nguồn quyết định — lệch giá hiển thị -> 409 có cấu trúc
        BigDecimal tongTienHang = BigDecimal.ZERO;
        List<PosPriceChangeInfo.PosPriceChangeItem> priceChanges = new ArrayList<>();
        for (PosCheckoutCreating.PosCheckoutItemCreating item : items) {
            BienTheSanPham variant = variants.get(item.getBienTheSanPhamId());
            BigDecimal giaBan = variant.getGiaBan();
            if (giaBan == null || giaBan.compareTo(BigDecimal.ZERO) <= 0) {
                throw new CommonException("Biến thể " + variant.getMaSku() + " chưa có giá bán, không thể bán tại quầy");
            }
            if (item.getUnitPriceClient() == null || item.getUnitPriceClient().compareTo(giaBan) != 0) {
                priceChanges.add(PosPriceChangeInfo.PosPriceChangeItem.builder()
                        .bienTheSanPhamId(variant.getId())
                        .maSku(variant.getMaSku())
                        .giaHienThi(item.getUnitPriceClient())
                        .giaMoi(giaBan)
                        .build());
                continue;
            }
            tongTienHang = tongTienHang.add(giaBan.multiply(item.getQuantity()));
        }
        if (!priceChanges.isEmpty()) {
            throw new CommonException(
                    "Giá sản phẩm đã thay đổi. Vui lòng xác nhận lại giá mới trước khi thanh toán.",
                    HttpStatus.CONFLICT,
                    PosPriceChangeInfo.builder().priceChanged(true).items(priceChanges).build());
        }

        // 3. Tiền mặt: validate + phải đủ. Tiền thừa không phải doanh thu.
        BigDecimal tendered = validatePayment(request.getPayment());
        if (tendered.compareTo(tongTienHang) < 0) {
            throw new CommonException("Số tiền khách đưa không đủ để thanh toán hóa đơn");
        }
        BigDecimal tienThua = tendered.subtract(tongTienHang);

        // 4. Neo idempotency: INSERT request (unique chặn race tại DB) TRƯỚC khi khóa tồn.
        //    Trùng key -> DataIntegrityViolationException nổi lên orchestrator xử lý NGOÀI
        //    transaction lỗi (không retry trong transaction đã hỏng).
        String requestHash = PosCheckoutPayloadHash.of(request);
        PosCheckoutRequest requestRow = PosCheckoutRequest.builder()
                .requestId(request.getRequestId())
                .requestHash(requestHash)
                .khoId(request.getKhoId())
                .trangThai(PosCheckoutRequest.TRANG_THAI_PENDING)
                .nguoiThuNganId(userId)
                .ngayTao(Instant.now())
                .build();
        posCheckoutRequestRepository.save(requestRow);
        entityManager.flush();

        // 5. Khóa các dòng tồn theo thứ tự PK ổn định, kiểm tra khả dụng SAU khóa.
        List<Integer> variantIds = items.stream()
                .map(PosCheckoutCreating.PosCheckoutItemCreating::getBienTheSanPhamId)
                .sorted()
                .toList();
        List<TonKhoTheoLo> lockedLots = tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(request.getKhoId(), variantIds);
        Map<Integer, List<TonKhoTheoLo>> lotsByVariant = lockedLots.stream()
                .collect(Collectors.groupingBy(t -> t.getLoHang().getBienTheSanPham().getId()));

        // 6. Phân bổ lô theo chính sách FIFO: ngayNhapGanNhat tăng dần, tie-break loHang.id;
        //    chỉ lấy lô đúng kho + đúng SKU (đã bảo đảm bởi query), khả dụng = ton - dat.
        Map<Integer, List<LotAllocation>> allocationByVariant = new LinkedHashMap<>();
        for (PosCheckoutCreating.PosCheckoutItemCreating item : items) {
            List<TonKhoTheoLo> rows = lotsByVariant.getOrDefault(item.getBienTheSanPhamId(), List.of());
            List<TonKhoTheoLo> fifo = rows.stream()
                    .filter(t -> soLuongKhaDung(t).compareTo(BigDecimal.ZERO) > 0)
                    .sorted(Comparator.comparing(
                            (TonKhoTheoLo t) -> t.getNgayNhapGanNhat() == null ? Instant.MAX : t.getNgayNhapGanNhat())
                            .thenComparing(t -> t.getLoHang().getId()))
                    .toList();

            BigDecimal can = fifo.stream().map(PosCheckoutTransaction::soLuongKhaDung)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal need = item.getQuantity();
            if (can.compareTo(need) < 0) {
                throw new CommonException("Sản phẩm [" + variants.get(item.getBienTheSanPhamId()).getMaSku()
                        + "] không đủ tồn kho khả dụng tại kho này (cần " + need.toPlainString()
                        + ", còn " + can.toPlainString() + ")");
            }

            List<LotAllocation> allocations = new ArrayList<>();
            BigDecimal remaining = need;
            for (TonKhoTheoLo t : fifo) {
                if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
                BigDecimal available = soLuongKhaDung(t);
                BigDecimal take = available.min(remaining);
                allocations.add(new LotAllocation(t, take));
                remaining = remaining.subtract(take);
            }
            allocationByVariant.put(item.getBienTheSanPhamId(), allocations);
        }

        // 7. Sinh số chứng từ an toàn (count+1 + retry trên unique — convention repo,
        //    IDENTITY khiến INSERT nổ ngay tại save nên vòng lặp hoạt động).
        Kho kho = entityManager.find(Kho.class, request.getKhoId());
        NguoiDung nguoiDung = entityManager.find(NguoiDung.class, userId);
        DonBanHang don = createOrderWithDetails(request, khachHang, kho, nguoiDung, items, variants, tongTienHang);
        PhieuXuatKho phieuXuat = createIssueWithPicks(don, kho, nguoiDung, allocationByVariant);

        // 8. Trừ tồn + nhật ký kho (một lần duy nhất cho mỗi dòng tồn).
        for (Map.Entry<Integer, List<LotAllocation>> entry : allocationByVariant.entrySet()) {
            Set<Integer> seenLotIds = new HashSet<>();
            BienTheSanPham variant = variants.get(entry.getKey());
            for (LotAllocation alloc : entry.getValue()) {
                TonKhoTheoLo t = alloc.row;
                if (!seenLotIds.add(t.getLoHang().getId())) {
                    throw new IllegalStateException("Lô " + t.getLoHang().getMaLo() + " bị phân bổ trùng trong checkout");
                }
                BigDecimal truoc = t.getSoLuongTon();
                t.setSoLuongTon(truoc.subtract(alloc.quantity));
                t.setNgayXuatGanNhat(Instant.now());
                tonKhoTheoLoRepository.save(t);

                lichSuGiaoDichKhoRepository.save(LichSuGiaoDichKho.builder()
                        .ngayGiaoDich(Instant.now())
                        .loaiGiaoDich("xuat_kho")
                        .loaiThamChieu("phieu_xuat_kho")
                        .idThamChieu(phieuXuat.getId())
                        .bienTheSanPham(variant)
                        .loHang(t.getLoHang())
                        .kho(kho)
                        .soLuong(alloc.quantity)
                        .soLuongTruoc(truoc)
                        .soLuongSau(t.getSoLuongTon())
                        .giaVon(t.getLoHang().getGiaVon())
                        .nguoiDung(nguoiDung)
                        .ghiChu("Xuất kho POS: " + phieuXuat.getSoPhieuXuat())
                        .build());
            }
        }

        // Tồn khả dụng sau bán: tổng trên TOÀN BỘ lô đã khóa của kho (không chỉ lô được phân bổ).
        Map<Integer, BigDecimal> khaDungSauByVariant = new HashMap<>();
        for (Integer variantId : variantIds) {
            khaDungSauByVariant.put(variantId,
                    lotsByVariant.getOrDefault(variantId, List.of()).stream()
                            .map(PosCheckoutTransaction::soLuongKhaDung)
                            .reduce(BigDecimal.ZERO, BigDecimal::add));
        }

        // 9. Phiếu thu tiền mặt (chứng từ đối soát — không phải cờ paid).
        posPaymentRepository.save(PosPayment.builder()
                .requestId(request.getRequestId())
                .donBanHangId(don.getId())
                .phuongThuc("CASH")
                .soTienHang(tongTienHang)
                .soTienThu(tendered)
                .soTienThua(tienThua)
                .nguoiThuId(userId)
                .ngayTao(Instant.now())
                .build());

        // 10. Hoàn tất neo idempotency với kết quả đã lưu (cùng transaction).
        PosCheckoutResponse response = buildResponse(don, phieuXuat, items, variants, tongTienHang, tendered, tienThua, khaDungSauByVariant);
        try {
            requestRow.setTrangThai(PosCheckoutRequest.TRANG_THAI_SUCCESS);
            requestRow.setDonBanHangId(don.getId());
            requestRow.setResultJson(objectMapper.writeValueAsString(response));
        } catch (Exception e) {
            throw new IllegalStateException("Không thể lưu kết quả checkout", e);
        }
        posCheckoutRequestRepository.save(requestRow);
        return response;
    }

    /** Ghi lỗi nghiệp vụ XÁC ĐỊNH ngoài transaction chính (transaction riêng, không bị rollback theo). */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public Optional<PosCheckoutResponse> recordFailure(PosCheckoutCreating request, String errorMessage) {
        PosCheckoutRequest row = PosCheckoutRequest.builder()
                .requestId(request.getRequestId())
                .requestHash(PosCheckoutPayloadHash.of(request))
                .khoId(request.getKhoId())
                .trangThai(PosCheckoutRequest.TRANG_THAI_FAILED)
                .errorMessage(errorMessage.length() > 500 ? errorMessage.substring(0, 500) : errorMessage)
                .nguoiThuNganId(SecurityContextHolder.getUser().getId())
                .ngayTao(Instant.now())
                .build();
        try {
            posCheckoutRequestRepository.save(row);
            return Optional.empty();
        } catch (DataIntegrityViolationException ex) {
            // Đua với một request cùng key: bên kia đã SUCCESS/FAILED trước -> đọc kết quả thắng.
            Optional<PosCheckoutRequest> existing = posCheckoutRequestRepository.findByRequestId(request.getRequestId());
            if (existing.isPresent() && PosCheckoutRequest.TRANG_THAI_SUCCESS.equals(existing.get().getTrangThai())
                    && existing.get().getResultJson() != null) {
                try {
                    return Optional.of(objectMapper.readValue(existing.get().getResultJson(), PosCheckoutResponse.class));
                } catch (Exception ignored) {
                    return Optional.empty();
                }
            }
            return Optional.empty();
        }
    }

    // ================= helpers =================

    private String validateRequestId(String requestId) {
        if (requestId == null || requestId.isBlank()) {
            throw new CommonException("Thiếu requestId cho giao dịch thanh toán");
        }
        if (requestId.length() > 64) {
            throw new CommonException("requestId không được dài quá 64 ký tự");
        }
        return requestId.trim();
    }

    private KhachHang validateCustomer(Integer khachHangId) {
        if (khachHangId == null) {
            throw new CommonException("Vui lòng chọn khách hàng cho hóa đơn");
        }
        KhachHang khachHang = entityManager.find(KhachHang.class, khachHangId);
        if (khachHang == null) {
            throw new CommonException("Khách hàng không tồn tại");
        }
        if (khachHang.getTrangThai() == null || khachHang.getTrangThai() != 1) {
            throw new CommonException("Khách hàng không còn hoạt động, không thể bán hàng");
        }
        return khachHang;
    }

    private List<PosCheckoutCreating.PosCheckoutItemCreating> validateItems(List<PosCheckoutCreating.PosCheckoutItemCreating> items) {
        if (items == null || items.isEmpty()) {
            throw new CommonException("Hóa đơn không có sản phẩm nào");
        }
        if (items.size() > MAX_DONG) {
            throw new CommonException("Hóa đơn quá nhiều dòng (tối đa " + MAX_DONG + ")");
        }
        Set<Integer> seen = new HashSet<>();
        for (PosCheckoutCreating.PosCheckoutItemCreating item : items) {
            if (item.getBienTheSanPhamId() == null) {
                throw new CommonException("Dòng sản phẩm thiếu mã biến thể");
            }
            if (!seen.add(item.getBienTheSanPhamId())) {
                throw new CommonException("Biến thể " + item.getBienTheSanPhamId() + " bị lặp trong hóa đơn");
            }
            BigDecimal qty = item.getQuantity();
            if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new CommonException("Số lượng sản phẩm phải lớn hơn 0");
            }
            // Hàng may mặc: chỉ số lượng nguyên dương.
            if (qty.stripTrailingZeros().scale() > 0) {
                throw new CommonException("Số lượng sản phẩm phải là số nguyên");
            }
            if (qty.compareTo(BigDecimal.valueOf(MAX_SO_LUONG_MOI_DONG)) > 0) {
                throw new CommonException("Số lượng mỗi dòng tối đa " + MAX_SO_LUONG_MOI_DONG);
            }
        }
        return items;
    }

    private Map<Integer, BienTheSanPham> validateVariants(List<PosCheckoutCreating.PosCheckoutItemCreating> items) {
        List<Integer> ids = items.stream()
                .map(PosCheckoutCreating.PosCheckoutItemCreating::getBienTheSanPhamId)
                .distinct()
                .toList();
        Map<Integer, BienTheSanPham> found = bienTheSanPhamRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(BienTheSanPham::getId, v -> v));
        for (Integer id : ids) {
            BienTheSanPham variant = found.get(id);
            if (variant == null) {
                throw new CommonException("Biến thể " + id + " không tồn tại");
            }
            if (variant.getTrangThai() == null || variant.getTrangThai() != 1) {
                throw new CommonException("Biến thể " + variant.getMaSku() + " không còn hoạt động");
            }
            if (variant.getSanPham() == null || variant.getSanPham().getTrangThai() == null
                    || variant.getSanPham().getTrangThai() != 1) {
                throw new CommonException("Sản phẩm của biến thể " + variant.getMaSku() + " không còn bán được");
            }
        }
        return found;
    }

    private BigDecimal validatePayment(PosCheckoutCreating.PosCheckoutPaymentCreating payment) {
        if (payment == null || payment.getMethod() == null || payment.getMethod().isBlank()) {
            throw new CommonException("Thiếu thông tin thanh toán");
        }
        if (!"CASH".equalsIgnoreCase(payment.getMethod())) {
            throw new CommonException("Phương thức thanh toán không được hỗ trợ ở giai đoạn hiện tại (chỉ CASH)");
        }
        BigDecimal tendered = payment.getTenderedAmount();
        if (tendered == null) {
            throw new CommonException("Thiếu số tiền khách đưa");
        }
        if (tendered.compareTo(BigDecimal.ZERO) < 0) {
            throw new CommonException("Số tiền khách đưa không được âm");
        }
        if (tendered.stripTrailingZeros().scale() > 0) {
            throw new CommonException("Số tiền khách đưa phải là số nguyên đồng");
        }
        if (tendered.compareTo(MAX_TIEN_MAT) > 0) {
            throw new CommonException("Số tiền mặt một giao dịch vượt giới hạn cho phép (" + MAX_TIEN_MAT.toPlainString() + ")");
        }
        return tendered;
    }

    private DonBanHang createOrderWithDetails(
            PosCheckoutCreating request, KhachHang khachHang, Kho kho, NguoiDung nguoiDung,
            List<PosCheckoutCreating.PosCheckoutItemCreating> items,
            Map<Integer, BienTheSanPham> variants, BigDecimal tongTienHang) {
        int retry = 0;
        while (true) {
            try {
                DonBanHang don = DonBanHang.builder()
                        .soDonHang(generateSoDonHang())
                        .loaiChungTu("don_ban_hang") // giữ enum hiện hữu, KHÔNG thêm giá trị mới
                        .khachHang(khachHang)
                        .khoXuat(kho)
                        .ngayDatHang(Instant.now())
                        .ngayGiaoHang(Instant.now()) // POS: giao ngay tại quầy
                        .trangThai(ITrangThaiDonBanHang.HOAN_THANH)
                        .tienHang(tongTienHang)
                        .phiVanChuyen(BigDecimal.ZERO)
                        .tongCong(tongTienHang)
                        .trangThaiThanhToan("da_thanh_toan")
                        .ghiChu(request.getNote() == null || request.getNote().isBlank() ? null : request.getNote().trim())
                        .nguoiTao(nguoiDung)
                        .build();
                donBanHangRepository.save(don);

                for (PosCheckoutCreating.PosCheckoutItemCreating item : items) {
                    BienTheSanPham variant = variants.get(item.getBienTheSanPhamId());
                    BigDecimal giaBan = variant.getGiaBan();
                    chiTietDonBanHangRepository.save(ChiTietDonBanHang.builder()
                            .donBanHang(don)
                            .bienTheSanPham(variant)
                            .soLuongDat(item.getQuantity())
                            .soLuongDaGiao(item.getQuantity())
                            .donGia(giaBan)
                            .thanhTien(giaBan.multiply(item.getQuantity()))
                            .build());
                }
                return don;
            } catch (DataIntegrityViolationException ex) {
                if (isDuplicateSoDonHang(ex) && retry < MAX_RETRY_SO_CHUNG_TU) {
                    retry++;
                    continue;
                }
                throw ex;
            }
        }
    }

    private PhieuXuatKho createIssueWithPicks(
            DonBanHang don, Kho kho, NguoiDung nguoiDung,
            Map<Integer, List<LotAllocation>> allocationByVariant) {
        int retry = 0;
        while (true) {
            try {
                PhieuXuatKho phieuXuat = PhieuXuatKho.builder()
                        .soPhieuXuat(generateSoPhieuXuat())
                        .donBanHang(don)
                        .ngayXuat(Instant.now())
                        .kho(kho)
                        .loaiXuat("ban_hang") // enum hiện hữu
                        .trangThai(3) // Đã xuất
                        .nguoiXuat(nguoiDung)
                        .ngayTao(Instant.now())
                        .ghiChu("Xuất kho POS cho đơn " + don.getSoDonHang())
                        .build();
                phieuXuatKhoRepository.save(phieuXuat);

                for (Map.Entry<Integer, List<LotAllocation>> entry : allocationByVariant.entrySet()) {
                    BienTheSanPham variant = entry.getValue().get(0).row.getLoHang().getBienTheSanPham();
                    for (LotAllocation alloc : entry.getValue()) {
                        chiTietPhieuXuatKhoRepository.save(ChiTietPhieuXuatKho.builder()
                                .phieuXuatKho(phieuXuat)
                                .bienTheSanPham(variant)
                                .loHang(alloc.row.getLoHang())
                                .soLuongXuat(alloc.quantity)
                                .giaVon(alloc.row.getLoHang().getGiaVon())
                                .build());
                    }
                }
                return phieuXuat;
            } catch (DataIntegrityViolationException ex) {
                if (isDuplicateSoPhieuXuat(ex) && retry < MAX_RETRY_SO_CHUNG_TU) {
                    retry++;
                    continue;
                }
                throw ex;
            }
        }
    }

    private PosCheckoutResponse buildResponse(
            DonBanHang don, PhieuXuatKho phieuXuat,
            List<PosCheckoutCreating.PosCheckoutItemCreating> items,
            Map<Integer, BienTheSanPham> variants,
            BigDecimal tongTienHang, BigDecimal tendered, BigDecimal tienThua,
            Map<Integer, BigDecimal> khaDungSauByVariant) {
        List<PosCheckoutResponse.PosCheckoutItemResponse> itemResponses = items.stream()
                .map(item -> {
                    BienTheSanPham variant = variants.get(item.getBienTheSanPhamId());
                    BigDecimal giaBan = variant.getGiaBan();
                    return PosCheckoutResponse.PosCheckoutItemResponse.builder()
                            .bienTheSanPhamId(variant.getId())
                            .maSku(variant.getMaSku())
                            .soLuong(item.getQuantity())
                            .donGia(giaBan)
                            .thanhTien(giaBan.multiply(item.getQuantity()))
                            .soLuongKhaDungSau(khaDungSauByVariant.getOrDefault(variant.getId(), BigDecimal.ZERO))
                            .build();
                })
                .toList();
        return PosCheckoutResponse.builder()
                .donBanHangId(don.getId())
                .soDonHang(don.getSoDonHang())
                .soPhieuXuat(phieuXuat.getSoPhieuXuat())
                .tongTienHang(tongTienHang)
                .tongCong(tongTienHang)
                .soTienThu(tendered)
                .soTienThua(tienThua)
                .ngayGiaoHang(don.getNgayGiaoHang())
                .items(itemResponses)
                .build();
    }

    private String generateSoDonHang() {
        String prefix = "SO" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        long countToday = donBanHangRepository.countBySoDonHangStartingWith(prefix);
        return prefix + (countToday + 1);
    }

    private String generateSoPhieuXuat() {
        String prefix = "PX" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        long countToday = phieuXuatKhoRepository.countBySoPhieuXuatStartingWith(prefix);
        return prefix + (countToday + 1);
    }

    private boolean isDuplicateSoDonHang(Exception ex) {
        return containsConstraint(ex, "uk_don_ban_hang_so_don_hang");
    }

    private boolean isDuplicateSoPhieuXuat(Exception ex) {
        return containsConstraint(ex, "uk_phieu_xuat_kho_so_phieu");
    }

    private boolean containsConstraint(Throwable cause, String constraint) {
        while (cause != null) {
            if (cause.getMessage() != null && cause.getMessage().contains(constraint)) return true;
            cause = cause.getCause();
        }
        return false;
    }

    private static BigDecimal soLuongKhaDung(TonKhoTheoLo t) {
        BigDecimal ton = t.getSoLuongTon() != null ? t.getSoLuongTon() : BigDecimal.ZERO;
        BigDecimal dat = t.getSoLuongDaDat() != null ? t.getSoLuongDaDat() : BigDecimal.ZERO;
        return ton.subtract(dat);
    }

    private record LotAllocation(TonKhoTheoLo row, BigDecimal quantity) {
    }
}
