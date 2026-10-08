package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.dto.response.customize.PosInsufficientStockInfo;
import com.dev.backend.dto.response.customize.PosPriceChangeInfo;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.utils.PosCheckoutPayloadHash;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
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
        return executeWith(request, CheckoutContext.cash(auth.getId()));
    }

    /**
     * Checkout dùng chung cho tiền mặt và chuyển khoản payOS.
     * - CASH: như cũ (giá hiện hành, kiểm quyền kho của người đang đăng nhập, tiền khách đưa phải đủ).
     * - PAYOS: gọi từ webhook/job (không có người đăng nhập) với giá ĐÃ CHỐT lúc tạo QR,
     *   số tiền đã nhận phải bằng đúng tổng, và trả lại phần hàng đã giữ chỗ trước khi trừ kho.
     */
    @Transactional
    public PosCheckoutResponse executeWith(PosCheckoutCreating request, CheckoutContext ctx) {
        Integer userId = ctx.userId();

        // 1. Xác thực nghiệp vụ (trước khi ghi bất cứ gì): requestId/items trước vì là
        //    validate hình thức rẻ nhất, rồi kho/khách, rồi biến thể.
        String requestId = validateRequestId(request.getRequestId());
        request.setRequestId(requestId); // dùng giá trị đã trim cho hash + lưu DB
        List<PosCheckoutCreating.PosCheckoutItemCreating> items = validateItems(request.getItems());
        if (!ctx.skipWarehouseAuth()) {
            posCatalogService.authorizeWarehouse(request.getKhoId());
        }
        KhachHang khachHang = validateCustomer(request.getKhachHangId());
        Map<Integer, BienTheSanPham> variants = validateVariants(items);

        // 2. Giá server là nguồn quyết định — lệch giá hiển thị -> 409 có cấu trúc
        Map<Integer, BigDecimal> unitPrices = resolveUnitPrices(items, variants, ctx.lockedPrices());
        BigDecimal tongTienHang = totalOf(items, unitPrices);

        // 3. Thanh toán: tiền mặt phải đủ (tiền thừa không phải doanh thu);
        //    chuyển khoản phải bằng đúng tổng đã chốt.
        BigDecimal tendered;
        if (CheckoutContext.METHOD_PAYOS.equals(ctx.method())) {
            tendered = ctx.paidAmount();
            if (tendered == null || tendered.compareTo(tongTienHang) != 0) {
                throw new CommonException("Số tiền chuyển khoản (" + (tendered == null ? "?" : tendered.toPlainString())
                        + ") không khớp tổng hóa đơn (" + tongTienHang.toPlainString() + ")");
            }
        } else {
            tendered = validatePayment(request.getPayment());
            if (tendered.compareTo(tongTienHang) < 0) {
                throw new CommonException("Số tiền khách đưa không đủ để thanh toán hóa đơn");
            }
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
        List<TonKhoTheoLo> lockedLots = lockLots(request.getKhoId(), variantIds);
        Map<Integer, List<TonKhoTheoLo>> lotsByVariant = lockedLots.stream()
                .collect(Collectors.groupingBy(t -> t.getLoHang().getBienTheSanPham().getId()));

        // 5b. Chuyển khoản: trả lại phần hàng đã giữ chỗ lúc tạo QR (trên chính các dòng vừa khóa)
        //     rồi mới phân bổ — để hàng giữ chỗ được bán cho chính đơn này.
        if (ctx.reservationToRelease() != null) {
            releaseOnLockedRows(lockedLots, ctx.reservationToRelease());
        }

        // 6. Phân bổ lô theo chính sách FIFO: ngayNhapGanNhat tăng dần, tie-break loHang.id;
        //    chỉ lấy lô đúng kho + đúng SKU (đã bảo đảm bởi query), khả dụng = ton - dat.
        Map<Integer, List<LotAllocation>> allocationByVariant = allocateFifo(items, lotsByVariant, variants);

        // 7. Sinh số chứng từ (count+1 — convention repo). Trùng số khi hai giao dịch đếm cùng
        //    lúc -> lỗi unique nổi lên, transaction rollback, caller thử lại bằng transaction
        //    MỚI (PosConcurrencyRetry): thử lại trong cùng transaction vô ích vì snapshot cũ
        //    vẫn đếm ra đúng số đó.
        Kho kho = entityManager.find(Kho.class, request.getKhoId());
        NguoiDung nguoiDung = entityManager.find(NguoiDung.class, userId);
        DonBanHang don = createOrderWithDetails(request, khachHang, kho, nguoiDung, items, variants, unitPrices, tongTienHang);
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
                .phuongThuc(ctx.method())
                .soTienHang(tongTienHang)
                .soTienThu(tendered)
                .soTienThua(tienThua)
                .nguoiThuId(userId)
                .ngayTao(Instant.now())
                .build());

        // 10. Hoàn tất neo idempotency với kết quả đã lưu (cùng transaction).
        PosCheckoutResponse response = buildResponse(don, phieuXuat, items, variants, unitPrices, tongTienHang, tendered, tienThua, khaDungSauByVariant);
        response.setPhuongThuc(ctx.method());
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

    /**
     * Giữ chỗ hàng cho giao dịch chuyển khoản: kiểm tra như checkout (quyền kho, khách, giá, tồn)
     * rồi CỘNG so_luong_da_dat trên các lô theo FIFO — hàng không bị kênh khác bán mất trong lúc
     * khách quét QR. Không tạo đơn, không trừ tồn.
     */
    @Transactional
    public ReservationResult reserveForTransfer(PosCheckoutCreating request) {
        validateRequestId(request.getRequestId());
        List<PosCheckoutCreating.PosCheckoutItemCreating> items = validateItems(request.getItems());
        posCatalogService.authorizeWarehouse(request.getKhoId());
        validateCustomer(request.getKhachHangId());
        Map<Integer, BienTheSanPham> variants = validateVariants(items);
        Map<Integer, BigDecimal> unitPrices = resolveUnitPrices(items, variants, null);
        BigDecimal total = totalOf(items, unitPrices);

        List<Integer> variantIds = items.stream()
                .map(PosCheckoutCreating.PosCheckoutItemCreating::getBienTheSanPhamId)
                .sorted()
                .toList();
        List<TonKhoTheoLo> lockedLots = lockLots(request.getKhoId(), variantIds);
        Map<Integer, List<TonKhoTheoLo>> lotsByVariant = lockedLots.stream()
                .collect(Collectors.groupingBy(t -> t.getLoHang().getBienTheSanPham().getId()));
        Map<Integer, List<LotAllocation>> allocations = allocateFifo(items, lotsByVariant, variants);

        List<ReservedLot> reserved = new ArrayList<>();
        for (List<LotAllocation> list : allocations.values()) {
            for (LotAllocation alloc : list) {
                TonKhoTheoLo t = alloc.row;
                BigDecimal dat = t.getSoLuongDaDat() == null ? BigDecimal.ZERO : t.getSoLuongDaDat();
                t.setSoLuongDaDat(dat.add(alloc.quantity));
                tonKhoTheoLoRepository.save(t);
                reserved.add(new ReservedLot(t.getId(), t.getLoHang().getBienTheSanPham().getId(), alloc.quantity));
            }
        }
        Map<Integer, String> names = new HashMap<>();
        for (BienTheSanPham v : variants.values()) {
            String ten = v.getSanPham() != null && v.getSanPham().getTenSanPham() != null ? v.getSanPham().getTenSanPham() : v.getMaSku();
            names.put(v.getId(), ten);
        }
        return new ReservationResult(total, unitPrices, reserved, names);
    }

    /** Trả lại hàng đã giữ chỗ (hủy/hết hạn/lỗi tạo QR). Không bao giờ để so_luong_da_dat âm. */
    @Transactional
    public void releaseReservation(Integer khoId, List<ReservedLot> reserved) {
        if (reserved == null || reserved.isEmpty()) return;
        List<Integer> variantIds = reserved.stream().map(ReservedLot::bienTheSanPhamId).distinct().sorted().toList();
        List<TonKhoTheoLo> lockedLots = lockLots(khoId, variantIds);
        releaseOnLockedRows(lockedLots, reserved);
    }

    /**
     * Khóa các dòng tồn (PK tăng dần) rồi nạp lại trạng thái MỚI NHẤT bằng locking read.
     * Bắt buộc refresh: với open-in-view, EntityManager sống suốt request — dòng tồn đã nạp
     * ở bước trước (vd. giữ chỗ rồi trả chỗ khi tạo QR lỗi) vẫn nằm trong đó, và query khóa
     * trả lại chính entity cũ thay vì số trong DB -> ghi đè mất cập nhật của quầy khác.
     */
    private List<TonKhoTheoLo> lockLots(Integer khoId, List<Integer> variantIds) {
        List<TonKhoTheoLo> rows = tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(khoId, variantIds);
        for (TonKhoTheoLo t : rows) {
            entityManager.refresh(t, LockModeType.PESSIMISTIC_WRITE);
        }
        return rows;
    }

    private void releaseOnLockedRows(List<TonKhoTheoLo> lockedLots, List<ReservedLot> reserved) {
        Map<Integer, TonKhoTheoLo> byId = lockedLots.stream().collect(Collectors.toMap(TonKhoTheoLo::getId, t -> t));
        for (ReservedLot r : reserved) {
            TonKhoTheoLo t = byId.get(r.tonKhoTheoLoId());
            if (t == null) continue;
            BigDecimal dat = t.getSoLuongDaDat() == null ? BigDecimal.ZERO : t.getSoLuongDaDat();
            BigDecimal after = dat.subtract(r.quantity());
            t.setSoLuongDaDat(after.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : after);
            tonKhoTheoLoRepository.save(t);
        }
    }

    /** Ngữ cảnh checkout: ai thu tiền, phương thức, giá chốt và phần giữ chỗ cần trả. */
    public record CheckoutContext(Integer userId, String method, BigDecimal paidAmount,
                                  Map<Integer, BigDecimal> lockedPrices, List<ReservedLot> reservationToRelease,
                                  boolean skipWarehouseAuth) {
        public static final String METHOD_CASH = "CASH";
        public static final String METHOD_PAYOS = "PAYOS";

        public static CheckoutContext cash(Integer userId) {
            return new CheckoutContext(userId, METHOD_CASH, null, null, null, false);
        }

        public static CheckoutContext payos(Integer cashierId, BigDecimal paidAmount,
                                            Map<Integer, BigDecimal> lockedPrices, List<ReservedLot> reservationToRelease) {
            return new CheckoutContext(cashierId, METHOD_PAYOS, paidAmount, lockedPrices, reservationToRelease, true);
        }
    }

    /** Một phần hàng đang giữ chỗ trên một dòng tồn (ton_kho_theo_lo.id). */
    public record ReservedLot(Integer tonKhoTheoLoId, Integer bienTheSanPhamId, BigDecimal quantity) {
    }

    public record ReservationResult(BigDecimal total, Map<Integer, BigDecimal> unitPrices,
                                    List<ReservedLot> reserved, Map<Integer, String> productNames) {
    }

    // ================= helpers =================

    /** Giá bán từng biến thể: giá chốt (nếu có) hoặc giá hiện hành; lệch giá client hiển thị -> 409. */
    private Map<Integer, BigDecimal> resolveUnitPrices(List<PosCheckoutCreating.PosCheckoutItemCreating> items,
                                                       Map<Integer, BienTheSanPham> variants,
                                                       Map<Integer, BigDecimal> lockedPrices) {
        Map<Integer, BigDecimal> prices = new HashMap<>();
        List<PosPriceChangeInfo.PosPriceChangeItem> priceChanges = new ArrayList<>();
        for (PosCheckoutCreating.PosCheckoutItemCreating item : items) {
            BienTheSanPham variant = variants.get(item.getBienTheSanPhamId());
            BigDecimal giaBan = lockedPrices != null ? lockedPrices.get(variant.getId()) : variant.getGiaBan();
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
            prices.put(variant.getId(), giaBan);
        }
        if (!priceChanges.isEmpty()) {
            throw new CommonException(
                    "Giá sản phẩm đã thay đổi. Vui lòng xác nhận lại giá mới trước khi thanh toán.",
                    HttpStatus.CONFLICT,
                    PosPriceChangeInfo.builder().priceChanged(true).items(priceChanges).build());
        }
        return prices;
    }

    private static BigDecimal totalOf(List<PosCheckoutCreating.PosCheckoutItemCreating> items, Map<Integer, BigDecimal> unitPrices) {
        BigDecimal total = BigDecimal.ZERO;
        for (PosCheckoutCreating.PosCheckoutItemCreating item : items) {
            total = total.add(unitPrices.get(item.getBienTheSanPhamId()).multiply(item.getQuantity()));
        }
        return total;
    }

    /** FIFO: ngayNhapGanNhat tăng dần, tie-break loHang.id; chỉ lô còn khả dụng (ton - dat > 0). */
    private Map<Integer, List<LotAllocation>> allocateFifo(List<PosCheckoutCreating.PosCheckoutItemCreating> items,
                                                           Map<Integer, List<TonKhoTheoLo>> lotsByVariant,
                                                           Map<Integer, BienTheSanPham> variants) {
        Map<Integer, List<LotAllocation>> allocationByVariant = new LinkedHashMap<>();
        List<PosInsufficientStockInfo.PosInsufficientItem> insufficient = new ArrayList<>();
        List<String> messages = new ArrayList<>();
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
                String maSku = variants.get(item.getBienTheSanPhamId()).getMaSku();
                insufficient.add(PosInsufficientStockInfo.PosInsufficientItem.builder()
                        .bienTheSanPhamId(item.getBienTheSanPhamId())
                        .maSku(maSku)
                        .canBan(need)
                        .conLai(can)
                        .build());
                messages.add("Sản phẩm [" + maSku + "] không đủ tồn kho khả dụng tại kho này (cần "
                        + need.toPlainString() + ", còn " + can.toPlainString() + ")");
                continue;
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
        if (!insufficient.isEmpty()) {
            throw new CommonException(String.join("; ", messages), HttpStatus.CONFLICT,
                    PosInsufficientStockInfo.builder().insufficient(insufficient).build());
        }
        return allocationByVariant;
    }

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
            Map<Integer, BienTheSanPham> variants, Map<Integer, BigDecimal> unitPrices, BigDecimal tongTienHang) {
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
            BigDecimal giaBan = unitPrices.get(variant.getId());
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
    }

    private PhieuXuatKho createIssueWithPicks(
            DonBanHang don, Kho kho, NguoiDung nguoiDung,
            Map<Integer, List<LotAllocation>> allocationByVariant) {
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
    }

    private PosCheckoutResponse buildResponse(
            DonBanHang don, PhieuXuatKho phieuXuat,
            List<PosCheckoutCreating.PosCheckoutItemCreating> items,
            Map<Integer, BienTheSanPham> variants, Map<Integer, BigDecimal> unitPrices,
            BigDecimal tongTienHang, BigDecimal tendered, BigDecimal tienThua,
            Map<Integer, BigDecimal> khaDungSauByVariant) {
        List<PosCheckoutResponse.PosCheckoutItemResponse> itemResponses = items.stream()
                .map(item -> {
                    BienTheSanPham variant = variants.get(item.getBienTheSanPhamId());
                    BigDecimal giaBan = unitPrices.get(variant.getId());
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

    private static BigDecimal soLuongKhaDung(TonKhoTheoLo t) {
        BigDecimal ton = t.getSoLuongTon() != null ? t.getSoLuongTon() : BigDecimal.ZERO;
        BigDecimal dat = t.getSoLuongDaDat() != null ? t.getSoLuongDaDat() : BigDecimal.ZERO;
        return ton.subtract(dat);
    }

    private record LotAllocation(TonKhoTheoLo row, BigDecimal quantity) {
    }
}
