package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Test orchestrator checkout POS: idempotency (trùng key cùng payload -> trả kết quả
 * đã lưu; khác payload -> 409; key trống do bên thắng rollback -> thử lại đúng 1 lần),
 * lỗi nghiệp vụ -> ghi FAILED ở transaction riêng, và phục hồi có phân quyền.
 */
@ExtendWith(MockitoExtension.class)
class PosCheckoutServiceTest {

    @Mock
    private PosCheckoutTransaction transaction;
    @Mock
    private PosCheckoutRequestRepository posCheckoutRequestRepository;
    @Mock
    private PosCatalogService posCatalogService;

    private PosCheckoutService service;
    // Mapper như Spring cấu hình (có JavaTimeModule cho Instant)
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    @BeforeEach
    void setUp() {
        service = new PosCheckoutService();
        ReflectionTestUtils.setField(service, "transaction", transaction);
        ReflectionTestUtils.setField(service, "posCheckoutRequestRepository", posCheckoutRequestRepository);
        ReflectionTestUtils.setField(service, "posCatalogService", posCatalogService);
        ReflectionTestUtils.setField(service, "objectMapper", objectMapper);
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder()
                .id(7).vaiTro(Set.of("nhan_vien_ban_hang")).build());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private PosCheckoutCreating request(String requestId, int unitPrice) {
        return PosCheckoutCreating.builder()
                .requestId(requestId)
                .khoId(1)
                .khachHangId(10)
                .items(java.util.List.of(PosCheckoutCreating.PosCheckoutItemCreating.builder()
                        .bienTheSanPhamId(93)
                        .quantity(new BigDecimal("1"))
                        .unitPriceClient(new BigDecimal(unitPrice))
                        .build()))
                .payment(PosCheckoutCreating.PosCheckoutPaymentCreating.builder()
                        .method("CASH")
                        .tenderedAmount(new BigDecimal("200000"))
                        .build())
                .note("")
                .build();
    }

    private PosCheckoutResponse response() {
        return PosCheckoutResponse.builder()
                .donBanHangId(501)
                .soDonHang("SO2026100601")
                .soPhieuXuat("PX2026100601")
                .tongTienHang(new BigDecimal("120000"))
                .tongCong(new BigDecimal("120000"))
                .soTienThu(new BigDecimal("200000"))
                .soTienThua(new BigDecimal("80000"))
                .build();
    }

    private PosCheckoutRequest row(String requestId, String hash, String trangThai, String resultJson, String error) {
        return PosCheckoutRequest.builder()
                .id(1L)
                .requestId(requestId)
                .requestHash(hash)
                .khoId(1)
                .trangThai(trangThai)
                .resultJson(resultJson)
                .errorMessage(error)
                .nguoiThuNganId(7)
                .build();
    }

    @Test
    void checkout_thanhCong_traKetQuaExecutor() {
        PosCheckoutResponse expected = response();
        when(transaction.execute(any())).thenReturn(expected);

        PosCheckoutResponse result = service.checkout(request("rq-1", 120000));

        assertSame(expected, result);
        verify(transaction, never()).recordFailure(any(), any());
    }

    @Test
    void checkout_trungKey_cungPayload_traKetQuaDaLuu() throws Exception {
        PosCheckoutResponse expected = response();
        String json = objectMapper.writeValueAsString(expected);
        PosCheckoutCreating req = request("rq-1", 120000);
        when(transaction.execute(any())).thenThrow(
                new DataIntegrityViolationException("uk_pos_checkout_request_request_id"));
        when(posCheckoutRequestRepository.findByRequestId("rq-1"))
                .thenReturn(Optional.of(row("rq-1", PosCheckoutPayloadHash.of(req),
                        PosCheckoutRequest.TRANG_THAI_SUCCESS, json, null)));

        PosCheckoutResponse result = service.checkout(req);

        assertEquals(expected.getDonBanHangId(), result.getDonBanHangId());
        assertEquals(expected.getSoDonHang(), result.getSoDonHang());
        assertEquals(new BigDecimal("80000"), result.getSoTienThua());
        verify(transaction, times(1)).execute(any()); // KHÔNG thử lại — kết quả đã lưu được trả về
    }

    @Test
    void checkout_trungKey_khacPayload_xungDot409() {
        PosCheckoutCreating req = request("rq-1", 120000);
        when(transaction.execute(any())).thenThrow(
                new DataIntegrityViolationException("uk_pos_checkout_request_request_id"));
        when(posCheckoutRequestRepository.findByRequestId("rq-1"))
                .thenReturn(Optional.of(row("rq-1", "hash-khac",
                        PosCheckoutRequest.TRANG_THAI_SUCCESS, null, null)));

        CommonException ex = assertThrows(CommonException.class, () -> service.checkout(req));
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("requestId"));
    }

    @Test
    void checkout_trungKey_cungPayload_FAILEDDaGhi_traLoiDaLuu() {
        PosCheckoutCreating req = request("rq-1", 120000);
        when(transaction.execute(any())).thenThrow(
                new DataIntegrityViolationException("uk_pos_checkout_request_request_id"));
        when(posCheckoutRequestRepository.findByRequestId("rq-1"))
                .thenReturn(Optional.of(row("rq-1", PosCheckoutPayloadHash.of(req),
                        PosCheckoutRequest.TRANG_THAI_FAILED, null, "Không đủ tiền mặt")));

        CommonException ex = assertThrows(CommonException.class, () -> service.checkout(req));
        assertEquals("Không đủ tiền mặt", ex.getMessage());
    }

    @Test
    void checkout_trungKey_nhungBenThangRollback_thuLaiDungMotLan() {
        PosCheckoutResponse expected = response();
        when(transaction.execute(any()))
                .thenThrow(new DataIntegrityViolationException("uk_pos_checkout_request_request_id"))
                .thenReturn(expected);
        when(posCheckoutRequestRepository.findByRequestId("rq-1")).thenReturn(Optional.empty());

        PosCheckoutResponse result = service.checkout(request("rq-1", 120000));

        assertSame(expected, result);
        verify(transaction, times(2)).execute(any());
    }

    @Test
    void checkout_loiNghiepVu_ghiFAILED_roiNemLai() {
        CommonException business = new CommonException("Không đủ tồn kho");
        when(transaction.execute(any())).thenThrow(business);
        when(transaction.recordFailure(any(), eq("Không đủ tồn kho"))).thenReturn(Optional.empty());

        CommonException ex = assertThrows(CommonException.class, () -> service.checkout(request("rq-2", 120000)));
        assertEquals("Không đủ tồn kho", ex.getMessage());
        verify(transaction).recordFailure(any(), eq("Không đủ tồn kho"));
    }

    @Test
    void checkout_ghiFAILED_nhungBenThangDaSuccess_traKetQuaThang() {
        PosCheckoutResponse expected = response();
        when(transaction.execute(any())).thenThrow(new CommonException("Không đủ tồn kho"));
        when(transaction.recordFailure(any(), any())).thenReturn(Optional.of(expected));

        PosCheckoutResponse result = service.checkout(request("rq-3", 120000));

        assertEquals(expected.getDonBanHangId(), result.getDonBanHangId());
    }

    // ===== Recovery =====

    @Test
    void recovery_success_traKetQuaDaLuu() throws Exception {
        PosCheckoutResponse expected = response();
        String json = objectMapper.writeValueAsString(expected);
        when(posCheckoutRequestRepository.findByRequestId("rq-1"))
                .thenReturn(Optional.of(row("rq-1", "h", PosCheckoutRequest.TRANG_THAI_SUCCESS, json, null)));

        PosCheckoutRecoveryResponse result = service.getCheckoutRequest("rq-1");

        assertEquals(PosCheckoutRequest.TRANG_THAI_SUCCESS, result.getTrangThai());
        assertEquals(expected.getDonBanHangId(), result.getResult().getDonBanHangId());
    }

    @Test
    void recovery_failed_traThongDiepLoi() {
        when(posCheckoutRequestRepository.findByRequestId("rq-1"))
                .thenReturn(Optional.of(row("rq-1", "h", PosCheckoutRequest.TRANG_THAI_FAILED, null, "Hết hàng")));

        PosCheckoutRecoveryResponse result = service.getCheckoutRequest("rq-1");

        assertEquals(PosCheckoutRequest.TRANG_THAI_FAILED, result.getTrangThai());
        assertEquals("Hết hàng", result.getErrorMessage());
        assertNull(result.getResult());
    }

    @Test
    void recovery_khongTimThay_404() {
        when(posCheckoutRequestRepository.findByRequestId("rq-x")).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.getCheckoutRequest("rq-x"));
    }

    @Test
    void recovery_chuSoHuu_duocXem() {
        PosCheckoutRequest own = row("rq-1", "h", PosCheckoutRequest.TRANG_THAI_FAILED, null, "Lỗi");
        own.setNguoiThuNganId(7); // chính người dùng hiện tại (id 7)
        when(posCheckoutRequestRepository.findByRequestId("rq-1")).thenReturn(Optional.of(own));

        assertDoesNotThrow(() -> service.getCheckoutRequest("rq-1"));
        verify(posCatalogService, never()).authorizeWarehouse(anyInt());
    }

    @Test
    void recovery_admin_duocXem() {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder()
                .id(1).vaiTro(Set.of("quan_tri_vien")).build());
        PosCheckoutRequest other = row("rq-1", "h", PosCheckoutRequest.TRANG_THAI_FAILED, null, "Lỗi");
        other.setNguoiThuNganId(99); // không phải admin
        when(posCheckoutRequestRepository.findByRequestId("rq-1")).thenReturn(Optional.of(other));

        assertDoesNotThrow(() -> service.getCheckoutRequest("rq-1"));
        verify(posCatalogService, never()).authorizeWarehouse(anyInt());
    }

    @Test
    void recovery_khongPhaiChuSoHuu_khongCoQuyenKho_biChan() {
        PosCheckoutRequest other = row("rq-1", "h", PosCheckoutRequest.TRANG_THAI_FAILED, null, "Lỗi");
        other.setNguoiThuNganId(99); // thu ngân khác
        when(posCheckoutRequestRepository.findByRequestId("rq-1")).thenReturn(Optional.of(other));
        when(posCatalogService.authorizeWarehouse(1)).thenThrow(new CommonException("Bạn không phụ trách kho"));

        CommonException ex = assertThrows(CommonException.class, () -> service.getCheckoutRequest("rq-1"));
        assertTrue(ex.getMessage().contains("kho"));
    }
}
