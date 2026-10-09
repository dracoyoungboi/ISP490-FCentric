package com.dev.backend.services.impl.payos;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.utils.PayosSignature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Kế hoạch: docs/test-plan-payos-xac-minh-khoa.md, mục 2.1 (V1–V11).
 * Mock PayosClient — không gọi payOS thật.
 */
@ExtendWith(MockitoExtension.class)
class PayosCredentialVerifierTest {

    private static final String CHECKSUM = "a".repeat(64);
    private static final PayosCredentials CRED = new PayosCredentials(
            "11111111-2222-3333-4444-555555555555",
            "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            CHECKSUM);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Mock
    private PayosClient payosClient;

    private PayosCredentialVerifier verifier;

    @BeforeEach
    void setUp() {
        verifier = new PayosCredentialVerifier(payosClient, "https://fcentric.net/");
    }

    // ---------- helpers ----------

    private static ObjectNode linkData(long orderCode) {
        ObjectNode data = MAPPER.createObjectNode();
        data.put("bin", "970422");
        data.put("accountNumber", "0123456789");
        data.put("accountName", "FCENTRIC");
        data.put("amount", PayosCredentialVerifier.TEST_AMOUNT);
        data.put("description", PayosCredentialVerifier.TEST_DESCRIPTION);
        data.put("orderCode", orderCode);
        data.put("currency", "VND");
        data.put("paymentLinkId", "abc123");
        data.put("status", "PENDING");
        data.put("checkoutUrl", "https://pay.payos.vn/web/abc123");
        data.put("qrCode", "000201...");
        return data;
    }

    /** payOS tạo link thành công, ký response bằng checksumKeyKy. */
    private void createReturnsOk(String checksumKeyKy) {
        when(payosClient.createPaymentLink(eq(CRED), anyLong(), anyLong(), anyString(), anyString(), anyString(),
                anyLong(), anyList()))
                .thenAnswer(inv -> {
                    long orderCode = inv.getArgument(1);
                    JsonNode data = linkData(orderCode);
                    String sig = checksumKeyKy == null ? null : PayosSignature.forData(data, checksumKeyKy);
                    return new PayosClient.PayosResult(200, "00", "success", data, sig);
                });
    }

    private void createReturns(PayosClient.PayosResult result) {
        when(payosClient.createPaymentLink(any(), anyLong(), anyLong(), anyString(), anyString(), anyString(),
                anyLong(), anyList())).thenReturn(result);
    }

    private long capturedOrderCode() {
        ArgumentCaptor<Long> code = ArgumentCaptor.forClass(Long.class);
        verify(payosClient).createPaymentLink(any(), code.capture(), anyLong(), anyString(), anyString(), anyString(),
                anyLong(), anyList());
        return code.getValue();
    }

    // ---------- V1–V11 ----------

    @Test
    void V1_khoaDung_chuKyDung_thanhCong_vaHuyLink() {
        createReturnsOk(CHECKSUM);
        when(payosClient.cancelPaymentLink(eq(CRED), anyLong(), anyString()))
                .thenReturn(new PayosClient.PayosResult(200, "00", "success", null));

        PayosCredentialVerifier.Result r = verifier.verify(CRED);

        assertTrue(r.ok(), r.message());
        assertFalse(r.unreachable());
        assertEquals("00", r.code());
        long orderCode = capturedOrderCode();
        verify(payosClient).cancelPaymentLink(eq(CRED), eq(orderCode), anyString());
    }

    @Test
    void V2_http401_thatBai_khongHuy() {
        createReturns(new PayosClient.PayosResult(401, null, "Unauthorized", null));

        PayosCredentialVerifier.Result r = verifier.verify(CRED);

        assertFalse(r.ok());
        assertFalse(r.unreachable());
        assertTrue(r.message().contains("Client ID") && r.message().contains("API Key"), r.message());
        verify(payosClient, never()).cancelPaymentLink(any(), anyLong(), anyString());
    }

    /** Hồi quy đúng lỗi đã báo: trước đây mọi phản hồi có `code` đều bị coi là thành công. */
    @Test
    void V3_http200_code101_khongDuocCoiLaThanhCong() {
        createReturns(new PayosClient.PayosResult(200, "101", "Mã thanh toán không tồn tại", null));

        PayosCredentialVerifier.Result r = verifier.verify(CRED);

        assertFalse(r.ok());
        assertEquals("101", r.code());
        verify(payosClient, never()).cancelPaymentLink(any(), anyLong(), anyString());
    }

    @Test
    void V4_http200_codeLoi_thongDiepChuaDescVaCode() {
        createReturns(new PayosClient.PayosResult(200, "20", "Thông tin xác thực không hợp lệ", null));

        PayosCredentialVerifier.Result r = verifier.verify(CRED);

        assertFalse(r.ok());
        assertTrue(r.message().contains("Thông tin xác thực không hợp lệ"), r.message());
        assertTrue(r.message().contains("20"), r.message());
    }

    @Test
    void V5_chuKySai_thatBai_nhacChecksum_vanHuyLink() {
        createReturnsOk("b".repeat(64)); // payOS ký bằng khóa khác với khóa đang kiểm

        PayosCredentialVerifier.Result r = verifier.verify(CRED);

        assertFalse(r.ok());
        assertTrue(r.message().contains("Checksum Key"), r.message());
        long orderCode = capturedOrderCode();
        verify(payosClient).cancelPaymentLink(eq(CRED), eq(orderCode), anyString());
    }

    @Test
    void V6_khongCoChuKy_vanThanhCong() {
        createReturnsOk(null);

        assertTrue(verifier.verify(CRED).ok());
    }

    @Test
    void V7_code00_nhungKhongCoData_thatBai() {
        createReturns(new PayosClient.PayosResult(200, "00", "success", null, "sig"));

        assertFalse(verifier.verify(CRED).ok());
    }

    @Test
    void V8_http500_thatBai() {
        createReturns(new PayosClient.PayosResult(500, null, "Internal Server Error", null));

        PayosCredentialVerifier.Result r = verifier.verify(CRED);

        assertFalse(r.ok());
        assertFalse(r.unreachable());
    }

    @Test
    void V9_loiMang_traKetQuaKhongKetNoiDuoc_khongNem() {
        when(payosClient.createPaymentLink(any(), anyLong(), anyLong(), anyString(), anyString(), anyString(),
                anyLong(), anyList()))
                .thenThrow(new CommonException("Không kết nối được tới payOS", HttpStatus.BAD_GATEWAY, null));

        PayosCredentialVerifier.Result r = assertDoesNotThrow(() -> verifier.verify(CRED));

        assertFalse(r.ok());
        assertTrue(r.unreachable());
        assertTrue(r.message().contains("Không kết nối được"), r.message());
    }

    @Test
    void V10_huyLinhLoi_khongAnhHuongKetQua() {
        createReturnsOk(CHECKSUM);
        when(payosClient.cancelPaymentLink(any(), anyLong(), anyString()))
                .thenThrow(new CommonException("Không kết nối được tới payOS", HttpStatus.BAD_GATEWAY, null));

        assertTrue(assertDoesNotThrow(() -> verifier.verify(CRED)).ok());
    }

    @Test
    void V10b_huyLinkTraCodeLoi_khongAnhHuongKetQua() {
        createReturnsOk(CHECKSUM);
        when(payosClient.cancelPaymentLink(any(), anyLong(), anyString()))
                .thenReturn(new PayosClient.PayosResult(200, "101", "Đơn thanh toán không thể hủy", null));

        assertTrue(verifier.verify(CRED).ok());
    }

    @Test
    @SuppressWarnings("unchecked")
    void V11_thamSoGuiDi_dungQuyUoc() {
        createReturnsOk(CHECKSUM);
        long before = Instant.now().getEpochSecond();

        verifier.verify(CRED);

        long after = Instant.now().getEpochSecond();
        ArgumentCaptor<Long> orderCode = ArgumentCaptor.forClass(Long.class);
        ArgumentCaptor<Long> amount = ArgumentCaptor.forClass(Long.class);
        ArgumentCaptor<String> desc = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> returnUrl = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> cancelUrl = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Long> expiredAt = ArgumentCaptor.forClass(Long.class);
        ArgumentCaptor<List<PayosClient.Item>> items = ArgumentCaptor.forClass(List.class);
        verify(payosClient).createPaymentLink(eq(CRED), orderCode.capture(), amount.capture(), desc.capture(),
                returnUrl.capture(), cancelUrl.capture(), expiredAt.capture(), items.capture());

        assertEquals(2000L, amount.getValue());
        assertTrue(desc.getValue().length() <= 9, "payOS giới hạn 9 ký tự cho tài khoản chưa liên kết");
        assertTrue(orderCode.getValue() >= 9_000_000_000_000L && orderCode.getValue() < 10_000_000_000_000L,
                "orderCode phải nằm trong dải riêng, không trùng mã đơn POS: " + orderCode.getValue());
        assertTrue(orderCode.getValue() < (1L << 53));
        assertTrue(expiredAt.getValue() >= before + 120 && expiredAt.getValue() <= after + 120);
        assertEquals("https://fcentric.net/settings/payment", returnUrl.getValue());
        assertEquals("https://fcentric.net/settings/payment", cancelUrl.getValue());
        assertEquals(1, items.getValue().size());
        assertEquals(1, items.getValue().get(0).quantity());
        assertEquals(2000L, items.getValue().get(0).price());
    }

    @Test
    void V11b_haiLanKiemTra_khacOrderCode() {
        createReturnsOk(CHECKSUM);

        verifier.verify(CRED);
        verifier.verify(CRED);

        ArgumentCaptor<Long> code = ArgumentCaptor.forClass(Long.class);
        verify(payosClient, times(2)).createPaymentLink(any(), code.capture(), anyLong(), anyString(), anyString(),
                anyString(), anyLong(), anyList());
        assertNotEquals(code.getAllValues().get(0), code.getAllValues().get(1));
    }
}
