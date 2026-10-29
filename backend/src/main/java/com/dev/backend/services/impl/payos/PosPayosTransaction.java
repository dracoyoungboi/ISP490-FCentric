package com.dev.backend.services.impl.payos;

import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.entities.PosPayosPayment;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.PosPayosPaymentRepository;
import com.dev.backend.services.impl.entities.PosCheckoutTransaction;
import com.dev.backend.services.impl.entities.PosCheckoutTransaction.CheckoutContext;
import com.dev.backend.services.impl.entities.PosCheckoutTransaction.ReservedLot;
import com.dev.backend.utils.NoiDungVietQr;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Các bước GHI của luồng payOS, mỗi bước một transaction. Dòng pos_payos_payment luôn
 * được khóa (SELECT ... FOR UPDATE) trước khi đổi trạng thái, nên webhook, polling của
 * màn POS và job hết hạn có chạy cùng lúc cũng chỉ một bên được xử lý.
 */
@Service
public class PosPayosTransaction {

    private final PosPayosPaymentRepository repository;
    private final PosCheckoutTransaction checkoutTransaction;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;

    public PosPayosTransaction(PosPayosPaymentRepository repository, PosCheckoutTransaction checkoutTransaction,
                               ObjectMapper objectMapper, EntityManager entityManager) {
        this.repository = repository;
        this.checkoutTransaction = checkoutTransaction;
        this.objectMapper = objectMapper;
        this.entityManager = entityManager;
    }

    /**
     * Đọc trạng thái MỚI NHẤT của giao dịch (dùng để ra quyết định ngoài transaction ghi).
     * Không dùng repository.findByOrderCode trực tiếp: với open-in-view, entity đã nạp
     * trước đó trong request được trả lại nguyên trạng thái cũ.
     */
    @Transactional(readOnly = true)
    public Optional<PosPayosPayment> reload(Long orderCode) {
        Optional<PosPayosPayment> row = repository.findByOrderCode(orderCode);
        row.ifPresent(entityManager::refresh);
        return row;
    }

    /** Phần mã QR nhỏ nhất khi khách trả trước một phần bằng tiền mặt (mức máy chủ dùng khi thử kết nối payOS). */
    static final BigDecimal MIN_QR = new BigDecimal("2000");

    /**
     * Giữ chỗ hàng + tạo giao dịch PENDING (chưa gọi payOS). Khách trả trước một phần bằng tiền mặt (tienMatTruoc) thì mã
     * QR chỉ mang phần còn lại; không có thì QR trọn hóa đơn.
     * READ_COMMITTED: điểm vào giao dịch của PosCheckoutTransaction.reserveForTransfer (gọi lồng thì mức cô lập lấy theo
     * giao dịch này) — sau khi chờ khóa dòng tồn, giữ chỗ phiếu chuyển / phần đang giữ đọc được bản vừa ghi xong.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PosPayosPayment createPending(PosCheckoutCreating request, Integer cashierId, int expiryMinutes) {
        PosCheckoutTransaction.ReservationResult reservation = checkoutTransaction.reserveForTransfer(request);
        BigDecimal tienMat = tienMatTruocQr(request.getTienMatTruoc(), reservation.total());
        BigDecimal soTienQr = tienMat == null ? reservation.total() : reservation.total().subtract(tienMat);

        // Chốt giá + phương thức vào payload: lúc tiền về sẽ tạo đơn đúng số tiền khách đã trả.
        PosCheckoutCreating locked = PosCheckoutCreating.builder()
                .requestId(request.getRequestId().trim())
                .khoId(request.getKhoId())
                .khachHangId(request.getKhachHangId())
                .note(request.getNote())
                .items(request.getItems().stream().map(i -> PosCheckoutCreating.PosCheckoutItemCreating.builder()
                        .bienTheSanPhamId(i.getBienTheSanPhamId())
                        .quantity(i.getQuantity())
                        .unitPriceClient(reservation.unitPrices().get(i.getBienTheSanPhamId()))
                        .build()).toList())
                .payment(PosCheckoutCreating.PosCheckoutPaymentCreating.builder()
                        .method(CheckoutContext.METHOD_PAYOS)
                        .tenderedAmount(soTienQr)
                        .build())
                .tienMatTruoc(tienMat)
                .build();

        long orderCode = newOrderCode();
        Instant now = Instant.now();
        PosPayosPayment row = PosPayosPayment.builder()
                .orderCode(orderCode)
                .requestId(locked.getRequestId())
                .khoId(request.getKhoId())
                .nguoiThuNganId(cashierId)
                .soTien(soTienQr)
                .tienMatTruoc(tienMat)
                .trangThai(PosPayosPayment.PENDING)
                .noiDungCk(description(orderCode))
                .payloadJson(write(Map.of("payload", locked, "productNames", reservation.productNames())))
                .giuChoJson(write(reservation.reserved()))
                .dangGiuCho(true)
                .hetHanLuc(now.plusSeconds(expiryMinutes * 60L))
                .ngayTao(now)
                .ngayCapNhat(now)
                .build();
        return repository.save(row);
    }

    @Transactional
    public PosPayosPayment markLinkCreated(Long orderCode, JsonNode data) {
        PosPayosPayment row = lock(orderCode);
        row.setPaymentLinkId(text(data, "paymentLinkId"));
        row.setCheckoutUrl(text(data, "checkoutUrl"));
        row.setQrCode(text(data, "qrCode"));
        row.setBin(text(data, "bin"));
        row.setSoTaiKhoan(text(data, "accountNumber"));
        row.setTenTaiKhoan(text(data, "accountName"));
        // Nội dung CK thật payOS dùng để nhận diện khoản chuyển ("CS… FC…"), lấy từ chính mã QR; không đọc được
        // thì dùng description payOS trả về, cuối cùng mới giữ nội dung ngắn mình gửi đi.
        String noiDung = NoiDungVietQr.tuMaQr(row.getQrCode());
        if (noiDung == null) noiDung = text(data, "description");
        // Dài quá cột thì giữ nội dung ngắn cũ: nội dung bị cắt còn tệ hơn (khách chuyển theo đó không được ghi nhận)
        if (noiDung != null && !noiDung.isBlank() && noiDung.trim().length() <= 50) row.setNoiDungCk(noiDung.trim());
        row.setNgayCapNhat(Instant.now());
        return repository.save(row);
    }

    /**
     * Đóng giao dịch chưa thanh toán (FAILED / CANCELLED / EXPIRED) và trả lại hàng giữ chỗ.
     * Chỉ tác động khi đang PENDING — gọi lặp lại không trả hàng 2 lần.
     */
    @Transactional
    public PosPayosPayment closeUnpaid(Long orderCode, String newStatus, String message) {
        PosPayosPayment row = lock(orderCode);
        if (!PosPayosPayment.PENDING.equals(row.getTrangThai())) {
            return row;
        }
        releaseIfHeld(row);
        row.setTrangThai(newStatus);
        row.setErrorMessage(truncate(message));
        // Không tạo được mã QR: khách chưa thấy mã nào, tiền mặt khách đưa vẫn ở quầy cho lần tạo mã sau — giao dịch hỏng
        // này không mang tiền mặt (Đối soát không nhắc trả lại một khoản không có thật)
        if (PosPayosPayment.FAILED.equals(newStatus) && row.getQrCode() == null) row.setTienMatTruoc(null);
        row.setNgayCapNhat(Instant.now());
        return repository.save(row);
    }

    /**
     * Tiền đã về: tạo đơn + trừ kho bằng đúng luồng checkout POS (giá đã chốt), idempotent.
     * PAID rồi -> trả kết quả đã lưu. PENDING -> trả giữ chỗ rồi trừ kho trong CÙNG transaction.
     * Đã hủy / hết hạn mà tiền vẫn về -> KHÔNG tự tạo đơn (lúc đó thu ngân có thể đã bán món này bằng
     * tiền mặt): ném lỗi để nơi gọi đánh PAID_ERROR, quản lý kiểm tra rồi tạo đơn hoặc hoàn tiền.
     * READ_COMMITTED: điểm vào giao dịch của PosCheckoutTransaction.executeWith (xem createPending).
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PosCheckoutResponse finalizePaid(Long orderCode, BigDecimal paidAmount, String bankReference) {
        PosPayosPayment row = lock(orderCode);
        if (PosPayosPayment.PAID.equals(row.getTrangThai())) {
            return read(row.getResultJson(), PosCheckoutResponse.class);
        }
        if (PosPayosPayment.PAID_ERROR.equals(row.getTrangThai())) {
            throw new CommonException(row.getErrorMessage(), HttpStatus.CONFLICT, null);
        }
        if (!PosPayosPayment.PENDING.equals(row.getTrangThai())) {
            throw new CommonException("khách chuyển khoản sau khi mã QR đã bị hủy hoặc hết hạn — "
                    + "kiểm tra hàng đã giao chưa rồi tạo đơn hoặc hoàn tiền", HttpStatus.CONFLICT, null);
        }
        if (paidAmount == null || paidAmount.compareTo(row.getSoTien()) != 0) {
            throw new CommonException("Số tiền nhận được (" + (paidAmount == null ? "?" : plain(paidAmount))
                    + "đ) khác số tiền " + (coTienMat(row) ? "mã QR" : "hóa đơn") + " (" + plain(row.getSoTien()) + "đ)");
        }
        PosCheckoutResponse result = createOrder(row, payload(row), paidAmount, null);

        row.setTrangThai(PosPayosPayment.PAID);
        row.setDonBanHangId(result.getDonBanHangId());
        row.setResultJson(write(result));
        row.setSoTienDaNhan(paidAmount);
        row.setMaGiaoDichNganHang(bankReference);
        // Bán bình thường: không cần giữ tài khoản cá nhân của khách (chỉ giữ để trả lại tiền khi có sự cố)
        row.setTenNguoiChuyen(null);
        row.setNganHangNguoiChuyen(null);
        row.setSoTkNguoiChuyen(null);
        row.setThanhToanLuc(Instant.now());
        row.setErrorMessage(null);
        row.setNgayCapNhat(Instant.now());
        repository.save(row);
        return result;
    }

    /**
     * Đã nhận tiền nhưng không tạo được đơn: giữ nguyên hàng giữ chỗ (nếu còn), đánh dấu để quản lý xử lý.
     * Lần báo sau cho giao dịch đã PAID_ERROR (webhook gửi lại, job hỏi lại) không lồng thêm tiền tố vào lỗi.
     * Số tiền: `laTongDaNhan` = payOS báo TỔNG đã nhận (hỏi trạng thái) -> ghi đúng số đó; ngược lại là số của
     * MỘT lần chuyển (webhook) -> cộng dồn khi là mã giao dịch ngân hàng mới (khách chuyển thiếu rồi chuyển
     * thêm), bỏ qua khi webhook gửi lại cùng mã.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markPaidError(Long orderCode, String message, String bankReference, BigDecimal paidAmount,
                              boolean laTongDaNhan) {
        PosPayosPayment row = lock(orderCode);
        if (!canBecomePaidError(row.getTrangThai())) return;
        boolean daLoi = PosPayosPayment.PAID_ERROR.equals(row.getTrangThai());
        if (!daLoi) {
            row.setErrorMessage(truncate("Đã nhận tiền nhưng chưa tạo được đơn: " + message));
            row.setThanhToanLuc(Instant.now());
            // Mã QR đã đóng (hủy/hết hạn/lỗi tạo) trước khi tiền về
            row.setTienVeSauHuy(!PosPayosPayment.PENDING.equals(row.getTrangThai()));
        }
        row.setTrangThai(PosPayosPayment.PAID_ERROR);
        String cacMa = row.getMaGiaoDichNganHang();
        boolean maMoi = bankReference != null && (cacMa == null || !List.of(cacMa.split(",")).contains(bankReference));
        if (paidAmount != null) {
            boolean congDon = !laTongDaNhan && daLoi && maMoi && cacMa != null && row.getSoTienDaNhan() != null;
            if (laTongDaNhan || !daLoi || congDon) {
                row.setSoTienDaNhan(congDon ? row.getSoTienDaNhan().add(paidAmount) : paidAmount);
            }
        }
        if (maMoi) {
            String ds = cacMa == null ? bankReference : cacMa + "," + bankReference;
            row.setMaGiaoDichNganHang(ds.length() > 100 ? ds.substring(ds.length() - 100) : ds);
        }
        row.setNgayCapNhat(Instant.now());
        repository.save(row);
    }

    /**
     * Ghi tài khoản khách đã chuyển (counterAccount* trong thông báo payOS) — chỉ ghi lần đầu, để quản lý trả lại
     * tiền đúng chỗ. Transaction riêng, chạy trước bước tạo đơn: tạo đơn lỗi (rollback) vẫn còn thông tin này.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ghiNguoiChuyen(Long orderCode, JsonNode giaoDich) {
        if (giaoDich == null || giaoDich.isMissingNode()) return;
        String ten = text(giaoDich, "counterAccountName");
        String soTk = text(giaoDich, "counterAccountNumber");
        if (isBlank(ten) && isBlank(soTk)) return;
        String nganHang = text(giaoDich, "counterAccountBankName");
        if (isBlank(nganHang)) nganHang = text(giaoDich, "counterAccountBankId");
        PosPayosPayment row = lock(orderCode);
        if (!isBlank(row.getTenNguoiChuyen()) || !isBlank(row.getSoTkNguoiChuyen())) return;
        row.setTenNguoiChuyen(cat(ten, 200));
        row.setNganHangNguoiChuyen(cat(nganHang, 100));
        row.setSoTkNguoiChuyen(cat(soTk, 50));
        repository.save(row);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String cat(String s, int max) {
        if (isBlank(s)) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    /** PAID / REFUNDED đã xong — không bao giờ quay lại PAID_ERROR. */
    private static boolean canBecomePaidError(String status) {
        return !PosPayosPayment.PAID.equals(status) && !PosPayosPayment.REFUNDED.equals(status);
    }

    /**
     * Quản lý xử lý giao dịch lỗi bằng "Tạo đơn bán": giá đã chốt lúc tạo QR, trả giữ chỗ (nếu còn)
     * rồi trừ kho trong cùng transaction. Chỉ khi đã nhận ĐỦ tiền; chuyển dư thì đơn vẫn đúng tổng
     * hóa đơn và ghi chú số cần hoàn. Thiếu hàng / lỗi khác -> ném lỗi, giao dịch giữ nguyên PAID_ERROR.
     * READ_COMMITTED: điểm vào giao dịch của PosCheckoutTransaction.executeWith (xem createPending).
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PosCheckoutResponse createOrderFromPaidError(Long orderCode, Integer managerId, String note) {
        PosPayosPayment row = lockPaidError(orderCode);
        if (row.isTienVeSauHuy() && coTienMat(row)) {
            // Lúc hủy mã, quầy đã / sẽ trả lại khách phần tiền mặt: tiền payOS một mình không đủ trả hóa đơn
            throw new CommonException("Tiền payOS về sau khi mã QR đã hủy, phần tiền mặt " + plain(row.getTienMatTruoc())
                    + "đ đã trả lại khách — không tạo đơn được. Hoàn khoản payOS cho khách rồi chọn Đã hoàn tiền.",
                    HttpStatus.CONFLICT, null);
        }
        BigDecimal received = row.getSoTienDaNhan();
        if (received == null) {
            throw new CommonException("Chưa rõ số tiền đã nhận của giao dịch này — kiểm tra sao kê ngân hàng; "
                    + "nếu đã hoàn tiền cho khách thì chọn Đã hoàn tiền.", HttpStatus.CONFLICT, null);
        }
        if (received.compareTo(row.getSoTien()) < 0) {
            throw new CommonException("Khách mới chuyển " + plain(received) + "đ / " + plain(row.getSoTien())
                    + "đ — không tạo đơn được. Hoàn tiền cho khách rồi bán lại bằng hóa đơn mới.", HttpStatus.CONFLICT, null);
        }
        BigDecimal overpaid = received.subtract(row.getSoTien());
        PosCheckoutCreating payload = payload(row);
        if (overpaid.signum() > 0) {
            String extra = "Khách chuyển dư " + plain(overpaid) + "đ qua payOS — cần hoàn lại.";
            payload.setNote(payload.getNote() == null || payload.getNote().isBlank() ? extra : payload.getNote() + " " + extra);
        }

        // requestId riêng: requestId gốc có thể đã gắn với đơn khác (QR tạo lại cùng requestId được trả trước,
        // hay lần thử tiền mặt) -> khóa duy nhất pos_checkout_request chặn mãi. Đơn mang ngày tiền về.
        payload.setRequestId("PAYOS-XU-LY-" + row.getOrderCode());
        PosCheckoutResponse result = createOrder(row, payload, row.getSoTien(), row.getThanhToanLuc());

        row.setTrangThai(PosPayosPayment.PAID);
        row.setDonBanHangId(result.getDonBanHangId());
        row.setResultJson(write(result));
        markHandled(row, managerId, note);
        repository.save(row);
        return result;
    }

    /**
     * Quản lý đã tự hoàn tiền cho khách qua ngân hàng: trả hàng giữ chỗ (nếu còn), không tạo chứng từ tiền. Tiền mặt khách
     * trả trước (nếu có) vẫn ở quầy: thu ngân trả khách rồi tự xác nhận (traLaiTienMat).
     */
    @Transactional
    public PosPayosPayment markRefunded(Long orderCode, Integer managerId, String note) {
        PosPayosPayment row = lockPaidError(orderCode);
        releaseIfHeld(row);
        row.setTrangThai(PosPayosPayment.REFUNDED);
        markHandled(row, managerId, note);
        return repository.save(row);
    }

    /**
     * Thu ngân xác nhận đã trả lại khách phần tiền mặt trả trước khi mã QR không thành (hủy / hết hạn / không tạo được,
     * tiền payOS về sau khi đã hủy, hoặc quản lý đã hoàn khoản payOS). Gọi lặp lại trả nguyên kết quả cũ. Mã còn chờ, đơn
     * đã tạo hay giao dịch đang chờ quản lý xử lý thì không trả lại ở đây.
     */
    @Transactional
    public PosPayosPayment traLaiTienMat(Long orderCode, Integer userId) {
        PosPayosPayment row = lock(orderCode);
        if (!coTienMat(row)) {
            throw new CommonException("Giao dịch này không có tiền mặt khách trả trước.", HttpStatus.CONFLICT, null);
        }
        if (row.getTienMatTraLaiLuc() != null) return row;
        String trangThai = row.getTrangThai();
        if (PosPayosPayment.PENDING.equals(trangThai)) {
            throw new CommonException("Mã QR còn đang chờ khách chuyển — hủy mã trước rồi mới trả lại tiền mặt.",
                    HttpStatus.CONFLICT, null);
        }
        if (PosPayosPayment.PAID.equals(trangThai)) {
            throw new CommonException("Đơn đã hoàn tất, tiền mặt đã ghi vào đơn — không trả lại ở đây.",
                    HttpStatus.CONFLICT, null);
        }
        if (PosPayosPayment.PAID_ERROR.equals(trangThai) && !row.isTienVeSauHuy()) {
            throw new CommonException("Giao dịch đang chờ quản lý xử lý ở Đối soát chuyển khoản (tạo đơn hoặc hoàn tiền).",
                    HttpStatus.CONFLICT, null);
        }
        // Cột lưu tới giây: cắt sẵn để lần bấm lại trả đúng giờ đã trả về lần đầu
        row.setTienMatTraLaiLuc(Instant.now().truncatedTo(ChronoUnit.SECONDS));
        row.setNguoiTraLaiTienMatId(userId);
        row.setNgayCapNhat(Instant.now());
        return repository.save(row);
    }

    /**
     * Tiền mặt khách trả trước khi tạo mã QR: trống / 0 = không có (trả null). Phải là số nguyên đồng, nhỏ hơn hóa đơn và
     * để lại cho mã QR ít nhất {@link #MIN_QR}.
     */
    static BigDecimal tienMatTruocQr(BigDecimal tienMat, BigDecimal tongHoaDon) {
        if (tienMat == null || tienMat.signum() == 0) return null;
        if (tienMat.signum() < 0) throw new CommonException("Tiền mặt khách trả trước không được âm");
        if (tienMat.stripTrailingZeros().scale() > 0) {
            throw new CommonException("Tiền mặt khách trả trước phải là số nguyên đồng");
        }
        if (tienMat.compareTo(tongHoaDon) >= 0) {
            throw new CommonException("Khách trả đủ bằng tiền mặt — chọn cách trả Tiền mặt thay vì tạo mã QR");
        }
        if (tongHoaDon.subtract(tienMat).compareTo(MIN_QR) < 0) {
            throw new CommonException("Phần quét mã QR phải từ " + plain(MIN_QR) + "đ trở lên");
        }
        return tienMat.setScale(2);
    }

    static boolean coTienMat(PosPayosPayment row) {
        return row.getTienMatTruoc() != null && row.getTienMatTruoc().signum() > 0;
    }

    private PosPayosPayment lockPaidError(Long orderCode) {
        PosPayosPayment row = lock(orderCode);
        if (!PosPayosPayment.PAID_ERROR.equals(row.getTrangThai())) {
            throw new CommonException("Giao dịch này không còn chờ xử lý (trạng thái " + row.getTrangThai()
                    + ") — tải lại danh sách.", HttpStatus.CONFLICT, null);
        }
        return row;
    }

    private void markHandled(PosPayosPayment row, Integer managerId, String note) {
        row.setNguoiXuLyId(managerId);
        row.setXuLyLuc(Instant.now());
        row.setGhiChuXuLy(truncate(note == null || note.isBlank() ? null : note.trim()));
        row.setNgayCapNhat(Instant.now());
    }

    /** Tạo đơn + trừ kho theo giá đã chốt; trả phần giữ chỗ trong CÙNG transaction (nếu còn giữ). */
    private PosCheckoutResponse createOrder(PosPayosPayment row, PosCheckoutCreating payload, BigDecimal paidAmount,
                                           Instant thoiDiemBan) {
        Map<Integer, BigDecimal> lockedPrices = new HashMap<>();
        payload.getItems().forEach(i -> lockedPrices.put(i.getBienTheSanPhamId(), i.getUnitPriceClient()));
        PosCheckoutResponse result = checkoutTransaction.executeWith(payload, CheckoutContext.payos(
                row.getNguoiThuNganId(), paidAmount, lockedPrices, row.isDangGiuCho() ? reserved(row) : null)
                .withThoiDiemBan(thoiDiemBan)
                .withTienMatTruoc(coTienMat(row) ? row.getTienMatTruoc() : null));
        row.setDangGiuCho(false);
        return result;
    }

    private void releaseIfHeld(PosPayosPayment row) {
        if (!row.isDangGiuCho()) return;
        checkoutTransaction.releaseReservation(row.getKhoId(), reserved(row));
        row.setDangGiuCho(false);
    }

    // ================= helpers =================

    /**
     * Khóa dòng giao dịch rồi nạp lại trạng thái bằng locking read. Refresh là bắt buộc:
     * với open-in-view, webhook/nút Hủy đã đọc dòng này (PENDING) trước khi vào đây; query
     * khóa vẫn chờ đúng khóa nhưng Hibernate trả lại entity cũ -> bên đến sau tưởng còn
     * PENDING, trả chỗ lần hai hoặc ghi đè PAID thành CANCELLED.
     */
    private PosPayosPayment lock(Long orderCode) {
        PosPayosPayment row = repository.lockByOrderCode(orderCode)
                .orElseThrow(() -> new CommonException("Không tìm thấy giao dịch chuyển khoản " + orderCode, HttpStatus.NOT_FOUND, null));
        entityManager.refresh(row, LockModeType.PESSIMISTIC_WRITE);
        return row;
    }

    /** Mã đơn payOS: thời gian (giây) × 1000 + số ngẫu nhiên — duy nhất, < 2^53 để JS đọc an toàn. */
    private long newOrderCode() {
        for (int i = 0; i < 10; i++) {
            long code = (System.currentTimeMillis() / 1000L) * 1000L + ThreadLocalRandom.current().nextInt(1000);
            if (!repository.existsByOrderCode(code)) return code;
        }
        throw new IllegalStateException("Không sinh được mã đơn payOS duy nhất");
    }

    /** Nội dung chuyển khoản ≤ 9 ký tự (giới hạn payOS cho tài khoản chưa liên kết). */
    public static String description(long orderCode) {
        String digits = String.valueOf(orderCode);
        return "FC" + digits.substring(Math.max(0, digits.length() - 7));
    }

    public List<ReservedLot> reserved(PosPayosPayment row) {
        if (row.getGiuChoJson() == null) return List.of();
        try {
            return objectMapper.readValue(row.getGiuChoJson(), new TypeReference<List<ReservedLot>>() {
            });
        } catch (Exception e) {
            throw new IllegalStateException("Không đọc được dữ liệu giữ chỗ của giao dịch " + row.getOrderCode(), e);
        }
    }

    public PosCheckoutCreating payload(PosPayosPayment row) {
        try {
            JsonNode root = objectMapper.readTree(row.getPayloadJson());
            return objectMapper.treeToValue(root.get("payload"), PosCheckoutCreating.class);
        } catch (Exception e) {
            throw new IllegalStateException("Không đọc được giỏ hàng của giao dịch " + row.getOrderCode(), e);
        }
    }

    public Map<Integer, String> productNames(PosPayosPayment row) {
        try {
            JsonNode node = objectMapper.readTree(row.getPayloadJson()).get("productNames");
            if (node == null) return Map.of();
            return objectMapper.convertValue(node, new TypeReference<Map<Integer, String>>() {
            });
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Không ghi được dữ liệu giao dịch payOS", e);
        }
    }

    public <T> T read(String json, Class<T> type) {
        if (json == null) return null;
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            throw new IllegalStateException("Không đọc được kết quả giao dịch payOS", e);
        }
    }

    private static String text(JsonNode data, String field) {
        if (data == null || data.get(field) == null || data.get(field).isNull()) return null;
        return data.get(field).asText();
    }

    /** Số tiền cho thông báo: cột DECIMAL(15,2) mang số 0 thừa ("120000.00") -> "120000". */
    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > 500 ? s.substring(0, 500) : s;
    }
}
