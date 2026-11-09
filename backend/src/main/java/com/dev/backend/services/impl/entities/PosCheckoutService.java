package com.dev.backend.services.impl.entities;

import com.dev.backend.i18n.DichCauDaLuu;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.i18n.LoiTrangThaiException;
import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PosCheckoutRecoveryResponse;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.PosCheckoutRequest;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.PosCheckoutRequestRepository;
import com.dev.backend.utils.PosCheckoutPayloadHash;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Orchestrator checkout POS — KHÔNG transactional; gọi PosCheckoutTransaction qua
 * proxy (không tự gọi nội bộ để transaction interception hoạt động đúng).
 *
 * Idempotency: request_id UNIQUE ở DB là chốt chặn race. Nếu executor ném
 * DataIntegrityViolationException do trùng key, transaction đã rollback và KHÔNG
 * được dùng tiếp (poisoned) — mọi xử lý trùng xảy ra NGOÀI transaction đó:
 * - đọc bản ghi thắng trong transaction mới;
 * - cùng hash + SUCCESS -> trả chính xác kết quả đã lưu;
 * - cùng hash + FAILED -> lỗi xác định đã lưu;
 * - khác hash -> 409 (payload khác dùng key cũ);
 * - không thấy bản ghi (bên thắng đã rollback, key trống) -> thử lại ĐÚNG 1 lần.
 *
 * Lỗi nghiệp vụ (CommonException) được ghi FAILED trong transaction riêng
 * (REQUIRES_NEW) để phân biệt lỗi XÁC ĐỊNH với "không tìm thấy" = chưa rõ kết quả.
 */
@Service
public class PosCheckoutService {

    static final String BUSY_MESSAGE = ThongDiep.vi("banHang.nhieuQuayThanhToan");

    @Autowired
    private PosCheckoutTransaction transaction;

    @Autowired
    private PosCheckoutRequestRepository posCheckoutRequestRepository;

    @Autowired
    private PosCatalogService posCatalogService;

    @Autowired
    private ObjectMapper objectMapper;

    public PosCheckoutResponse checkout(PosCheckoutCreating request) {
        try {
            // Deadlock / trùng số chứng từ do quầy khác chạy cùng lúc -> thử lại transaction mới, cùng requestId.
            return PosConcurrencyRetry.call(() -> transaction.execute(request));
        } catch (DataIntegrityViolationException ex) {
            if (PosConcurrencyRetry.isDuplicateDocumentNumber(ex)) {
                throw new CommonException(ThongDiep.of("banHang.nhieuQuayThanhToan"), HttpStatus.CONFLICT, null);
            }
            if (!isDuplicateRequestId(ex)) {
                throw ex;
            }
            PosCheckoutRequest existing = findExisting(request);
            if (existing != null) {
                return resolveExisting(request, existing);
            }
            // Bên thắng đã rollback -> key trống; thử lại đúng 1 lần (transaction mới, sạch).
            return PosConcurrencyRetry.call(() -> transaction.execute(request));
        } catch (CommonException ex) {
            try {
                recordFailure(request, ex.getMessage());
            } catch (CheckoutAlreadySucceeded alreadySucceeded) {
                // Đua: trong lúc ghi FAILED, một request cùng key đã SUCCESS -> trả kết quả thắng.
                return alreadySucceeded.getResult();
            }
            throw ex;
        }
    }

    private PosCheckoutResponse resolveExisting(PosCheckoutCreating request, PosCheckoutRequest existing) {
        String hash = PosCheckoutPayloadHash.of(request);
        if (!hash.equals(existing.getRequestHash())) {
            throw new CommonException(
                    ThongDiep.of("banHang.requestIdDaDung"),
                    HttpStatus.CONFLICT,
                    null);
        }
        if (PosCheckoutRequest.TRANG_THAI_SUCCESS.equals(existing.getTrangThai()) && existing.getResultJson() != null) {
            try {
                return objectMapper.readValue(existing.getResultJson(), PosCheckoutResponse.class);
            } catch (Exception e) {
                throw new LoiTrangThaiException(ThongDiep.of("banHang.khongDocKetQuaThanhToan"), e);
            }
        }
        // Câu lỗi đã lưu (tiếng Việt) trả lại nguyên văn; bộ xử lý lỗi chung dịch nếu khớp kho câu
        throw existing.getErrorMessage() != null
                ? new CommonException(existing.getErrorMessage(), HttpStatus.CONFLICT, null)
                : new CommonException(ThongDiep.of("banHang.yeuCauThanhToanDaThatBai"), HttpStatus.CONFLICT, null);
    }

    private PosCheckoutRequest findExisting(PosCheckoutCreating request) {
        return posCheckoutRequestRepository.findByRequestId(request.getRequestId()).orElse(null);
    }

    private void recordFailure(PosCheckoutCreating request, String message) {
        Optional<PosCheckoutResponse> winner = transaction.recordFailure(request, message);
        // Nếu trong lúc ghi FAILED phát hiện bên thắng đã SUCCESS -> dùng kết quả thắng.
        if (winner.isPresent()) {
            throw new CheckoutAlreadySucceeded(winner.get());
        }
    }

    private boolean isDuplicateRequestId(Exception ex) {
        Throwable cause = ex;
        while (cause != null) {
            if (cause.getMessage() != null && cause.getMessage().contains("uk_pos_checkout_request_request_id")) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }

    /** Phục hồi kết quả checkout — có xác thực + chủ sở hữu/quyền kho. */
    public PosCheckoutRecoveryResponse getCheckoutRequest(String requestId) {
        PosCheckoutRequest row = posCheckoutRequestRepository.findByRequestId(requestId)
                .orElseThrow(() -> new EntityNotFoundException(ThongDiep.vi("banHang.yeuCauThanhToanKhongTimThay", requestId)));

        authorizeRecovery(row);

        PosCheckoutRecoveryResponse.PosCheckoutRecoveryResponseBuilder builder =
                PosCheckoutRecoveryResponse.builder()
                        .requestId(row.getRequestId())
                        .trangThai(row.getTrangThai())
                        // Câu lỗi lưu tiếng Việt: dịch lúc đọc theo ngôn ngữ người xem
                        .errorMessage(DichCauDaLuu.dich(row.getErrorMessage()));
        if (PosCheckoutRequest.TRANG_THAI_SUCCESS.equals(row.getTrangThai()) && row.getResultJson() != null) {
            try {
                builder.result(objectMapper.readValue(row.getResultJson(), PosCheckoutResponse.class));
            } catch (Exception e) {
                throw new LoiTrangThaiException(ThongDiep.of("banHang.khongDocKetQuaThanhToan"), e);
            }
        }
        return builder.build();
    }

    /** Chủ sở hữu (thu ngân tạo) hoặc admin, hoặc người có quyền kho của giao dịch. */
    private void authorizeRecovery(PosCheckoutRequest row) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        if (user.getVaiTro().contains(IRoleType.quan_tri_vien)) {
            return;
        }
        if (row.getNguoiThuNganId() != null && row.getNguoiThuNganId().equals(user.getId())) {
            return;
        }
        // Không phải chủ sở hữu: chỉ cho xem nếu có quyền kho của giao dịch (quản lý kho).
        posCatalogService.authorizeWarehouse(row.getKhoId());
    }

    /** Ngoại lệ nội bộ: bên thắng đã thành công trong lúc ghi FAILED. */
    static class CheckoutAlreadySucceeded extends RuntimeException {
        private final transient PosCheckoutResponse result;

        CheckoutAlreadySucceeded(PosCheckoutResponse result) {
            super("Yêu cầu thanh toán đã thành công trước đó");
            this.result = result;
        }

        PosCheckoutResponse getResult() {
            return result;
        }
    }
}
