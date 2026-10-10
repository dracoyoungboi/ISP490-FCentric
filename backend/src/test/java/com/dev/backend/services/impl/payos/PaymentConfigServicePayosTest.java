package com.dev.backend.services.impl.payos;

import com.dev.backend.dto.request.PayosConfigUpdating;
import com.dev.backend.dto.response.customize.PayosTestResult;
import com.dev.backend.entities.CauHinhThanhToan;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.CauHinhThanhToanRepository;
import com.dev.backend.utils.PaymentSecretCipher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Kế hoạch: docs/test-plan-payos-xac-minh-khoa.md, mục 2.2 (S1–S10).
 * Repository + verifier là mock; cipher thật để kiểm khóa được mã hoá/giải mã đúng.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PaymentConfigServicePayosTest {

    private static final String CLIENT_CU = "11111111-1111-1111-1111-111111111111";
    private static final String API_CU = "22222222-2222-2222-2222-222222222222";
    private static final String CHECKSUM_CU = "c".repeat(64);
    private static final String CLIENT_MOI = "33333333-3333-3333-3333-333333333333";
    private static final String API_MOI = "44444444-4444-4444-4444-444444444444";
    private static final String CHECKSUM_MOI = "d".repeat(64);
    private static final Instant WEBHOOK_LUC = Instant.parse("2026-10-09T06:32:00Z");

    private static final PayosCredentialVerifier.Result DAT =
            new PayosCredentialVerifier.Result(true, false, "00", "Kết nối payOS thành công");
    private static final PayosCredentialVerifier.Result KHONG_DAT =
            new PayosCredentialVerifier.Result(false, false, "20", "payOS từ chối bộ khóa: Thông tin xác thực không hợp lệ (mã 20)");
    private static final PayosCredentialVerifier.Result MAT_MANG =
            new PayosCredentialVerifier.Result(false, true, null, "Không kết nối được tới payOS");

    @Mock
    private CauHinhThanhToanRepository repository;
    @Mock
    private PayosClient payosClient;
    @Mock
    private PayosCredentialVerifier verifier;

    private final PaymentSecretCipher cipher = new PaymentSecretCipher("unit-test-secret");
    private PaymentConfigService service;
    private CauHinhThanhToan cfg;

    @BeforeEach
    void setUp() {
        service = new PaymentConfigService(repository, cipher, payosClient, verifier, "https://fcentric.net");
        when(repository.save(any(CauHinhThanhToan.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private void daCoKhoa() {
        cfg = CauHinhThanhToan.builder()
                .id(1)
                .nhaCungCap(CauHinhThanhToan.NCC_PAYOS)
                .kichHoat(true)
                .clientIdMaHoa(cipher.encrypt(CLIENT_CU))
                .apiKeyMaHoa(cipher.encrypt(API_CU))
                .checksumKeyMaHoa(cipher.encrypt(CHECKSUM_CU))
                .thoiGianHetHanPhut(3)
                .webhookUrl("https://fcentric.net/api/v1/payos/webhook")
                .webhookXacNhanLuc(WEBHOOK_LUC)
                .build();
        when(repository.findByNhaCungCap(CauHinhThanhToan.NCC_PAYOS)).thenReturn(Optional.of(cfg));
    }

    private void chuaCoKhoa() {
        cfg = CauHinhThanhToan.builder().id(1).nhaCungCap(CauHinhThanhToan.NCC_PAYOS).kichHoat(false)
                .thoiGianHetHanPhut(15).build();
        when(repository.findByNhaCungCap(CauHinhThanhToan.NCC_PAYOS)).thenReturn(Optional.of(cfg));
    }

    private static PayosConfigUpdating khoa(String clientId, String apiKey, String checksum) {
        return PayosConfigUpdating.builder().clientId(clientId).apiKey(apiKey).checksumKey(checksum).build();
    }

    private PayosCredentials credDaXacMinh() {
        ArgumentCaptor<PayosCredentials> c = ArgumentCaptor.forClass(PayosCredentials.class);
        verify(verifier).verify(c.capture());
        return c.getValue();
    }

    private void khoaDangLuuKhongDoi() {
        assertEquals(CLIENT_CU, cipher.decrypt(cfg.getClientIdMaHoa()));
        assertEquals(API_CU, cipher.decrypt(cfg.getApiKeyMaHoa()));
        assertEquals(CHECKSUM_CU, cipher.decrypt(cfg.getChecksumKeyMaHoa()));
    }

    // ---------- S1–S10 ----------

    @Test
    void S1_luuKhoaDung_xacMinhDat_luuBanMaHoa() {
        chuaCoKhoa();
        when(verifier.verify(any())).thenReturn(DAT);

        service.updatePayos(khoa(" " + CLIENT_MOI + " ", API_MOI, CHECKSUM_MOI));

        assertEquals(new PayosCredentials(CLIENT_MOI, API_MOI, CHECKSUM_MOI), credDaXacMinh());
        assertNotEquals(CLIENT_MOI, cfg.getClientIdMaHoa(), "khóa phải được mã hoá trước khi lưu");
        assertEquals(CLIENT_MOI, cipher.decrypt(cfg.getClientIdMaHoa()));
        assertEquals(API_MOI, cipher.decrypt(cfg.getApiKeyMaHoa()));
        assertEquals(CHECKSUM_MOI, cipher.decrypt(cfg.getChecksumKeyMaHoa()));
        verify(repository).save(cfg);
    }

    @Test
    void S2_xacMinhKhongDat_nemLoi_khongLuu_khoaCuGiuNguyen() {
        daCoKhoa();
        when(verifier.verify(any())).thenReturn(KHONG_DAT);

        CommonException e = assertThrows(CommonException.class,
                () -> service.updatePayos(khoa(CLIENT_MOI, API_MOI, CHECKSUM_MOI)));

        assertTrue(e.getMessage().contains("Thông tin xác thực không hợp lệ"), e.getMessage());
        assertEquals(HttpStatus.BAD_REQUEST, e.getHttpStatus());
        verify(repository, never()).save(any());
        khoaDangLuuKhongDoi();
        assertEquals(WEBHOOK_LUC, cfg.getWebhookXacNhanLuc());
    }

    @Test
    void S3_saiDinhDang_khongGoiPayos() {
        daCoKhoa();

        assertThrows(CommonException.class, () -> service.updatePayos(khoa("abc", API_MOI, CHECKSUM_MOI)));
        assertThrows(CommonException.class, () -> service.updatePayos(khoa(CLIENT_MOI, "abc", CHECKSUM_MOI)));
        assertThrows(CommonException.class, () -> service.updatePayos(khoa(CLIENT_MOI, API_MOI, "xyz")));
        assertThrows(CommonException.class, () -> service.updatePayos(khoa(CLIENT_MOI, API_MOI, "g".repeat(64))));

        verifyNoInteractions(verifier);
        verify(repository, never()).save(any());
        khoaDangLuuKhongDoi();
    }

    @Test
    void S3b_thamSoKhacSai_khongGoiPayos() {
        daCoKhoa();
        PayosConfigUpdating req = khoa(CLIENT_MOI, API_MOI, CHECKSUM_MOI);
        req.setThoiGianHetHanPhut(1);

        assertThrows(CommonException.class, () -> service.updatePayos(req));

        verifyNoInteractions(verifier);
    }

    @Test
    void S4_chiDoiChecksum_ghepVoiKhoaDangLuu() {
        daCoKhoa();
        when(verifier.verify(any())).thenReturn(DAT);

        service.updatePayos(khoa(null, "", CHECKSUM_MOI));

        assertEquals(new PayosCredentials(CLIENT_CU, API_CU, CHECKSUM_MOI), credDaXacMinh());
        assertEquals(CHECKSUM_MOI, cipher.decrypt(cfg.getChecksumKeyMaHoa()));
        assertEquals(CLIENT_CU, cipher.decrypt(cfg.getClientIdMaHoa()));
    }

    @Test
    void S5_khongDoiKhoa_khongGoiPayos() {
        daCoKhoa();

        service.updatePayos(PayosConfigUpdating.builder().thoiGianHetHanPhut(5).build());
        service.updatePayos(PayosConfigUpdating.builder().kichHoat(false).build());

        verifyNoInteractions(verifier);
        assertEquals(5, cfg.getThoiGianHetHanPhut());
        assertFalse(cfg.getKichHoat());
    }

    @Test
    void S6_lanDauChiNhapClientId_baoCanDu3Khoa() {
        chuaCoKhoa();

        CommonException e = assertThrows(CommonException.class,
                () -> service.updatePayos(khoa(CLIENT_MOI, null, null)));

        assertTrue(e.getMessage().contains("đủ"), e.getMessage());
        verifyNoInteractions(verifier);
        verify(repository, never()).save(any());
    }

    @Test
    void S7_matMangKhiLuu_bao502_khongLuu() {
        daCoKhoa();
        when(verifier.verify(any())).thenReturn(MAT_MANG);

        CommonException e = assertThrows(CommonException.class,
                () -> service.updatePayos(khoa(CLIENT_MOI, API_MOI, CHECKSUM_MOI)));

        assertEquals(HttpStatus.BAD_GATEWAY, e.getHttpStatus());
        verify(repository, never()).save(any());
        khoaDangLuuKhongDoi();
    }

    @Test
    void S8_doiClientId_xoaTrangThaiWebhook() {
        daCoKhoa();
        when(verifier.verify(any())).thenReturn(DAT);

        service.updatePayos(khoa(CLIENT_MOI, API_MOI, CHECKSUM_MOI));

        assertNull(cfg.getWebhookXacNhanLuc());
        assertEquals("https://fcentric.net/api/v1/payos/webhook", cfg.getWebhookUrl(), "URL vẫn giữ để đăng ký lại");
    }

    @Test
    void S8b_nhapLaiCungClientId_giuTrangThaiWebhook() {
        daCoKhoa();
        when(verifier.verify(any())).thenReturn(DAT);

        service.updatePayos(khoa(CLIENT_CU, API_MOI, CHECKSUM_CU));

        assertEquals(WEBHOOK_LUC, cfg.getWebhookXacNhanLuc());
    }

    // ---------- Cập nhật riêng từng khóa ----------

    @Test
    void S11_chiDoiApiKey_ghepVoiKhoaDangLuu_giuWebhook() {
        daCoKhoa();
        when(verifier.verify(any())).thenReturn(DAT);

        service.updatePayos(khoa(null, API_MOI, null));

        assertEquals(new PayosCredentials(CLIENT_CU, API_MOI, CHECKSUM_CU), credDaXacMinh());
        assertEquals(CLIENT_CU, cipher.decrypt(cfg.getClientIdMaHoa()));
        assertEquals(API_MOI, cipher.decrypt(cfg.getApiKeyMaHoa()));
        assertEquals(CHECKSUM_CU, cipher.decrypt(cfg.getChecksumKeyMaHoa()));
        assertEquals(WEBHOOK_LUC, cfg.getWebhookXacNhanLuc());
    }

    @Test
    void S12_cungClientId_doiHaiKhoa_luuDuoc_giuWebhook() {
        daCoKhoa();
        when(verifier.verify(any())).thenReturn(DAT);

        service.updatePayos(khoa(CLIENT_CU, API_MOI, CHECKSUM_MOI));

        assertEquals(new PayosCredentials(CLIENT_CU, API_MOI, CHECKSUM_MOI), credDaXacMinh());
        assertEquals(API_MOI, cipher.decrypt(cfg.getApiKeyMaHoa()));
        assertEquals(CHECKSUM_MOI, cipher.decrypt(cfg.getChecksumKeyMaHoa()));
        assertEquals(WEBHOOK_LUC, cfg.getWebhookXacNhanLuc());
    }

    @Test
    void S13_doiClientId_thieuBoKhoa_baoLoi_khongGoiPayos() {
        daCoKhoa();

        CommonException thieuApi = assertThrows(CommonException.class,
                () -> service.updatePayos(khoa(CLIENT_MOI, null, CHECKSUM_MOI)));
        CommonException thieuChecksum = assertThrows(CommonException.class,
                () -> service.updatePayos(khoa(CLIENT_MOI, API_MOI, " ")));
        assertThrows(CommonException.class, () -> service.updatePayos(khoa(CLIENT_MOI, null, null)));

        assertTrue(thieuApi.getMessage().contains("Đổi Client ID"), thieuApi.getMessage());
        assertTrue(thieuChecksum.getMessage().contains("Đổi Client ID"), thieuChecksum.getMessage());
        verifyNoInteractions(verifier);
        verify(repository, never()).save(any());
        khoaDangLuuKhongDoi();
        assertEquals(WEBHOOK_LUC, cfg.getWebhookXacNhanLuc());
    }

    @Test
    void S14_chiKhoangTrang_khongGoiPayos_khoaGiuNguyen() {
        daCoKhoa();

        service.updatePayos(khoa("  ", "", "\t"));

        verifyNoInteractions(verifier);
        khoaDangLuuKhongDoi();
        assertEquals(WEBHOOK_LUC, cfg.getWebhookXacNhanLuc());
    }

    @Test
    void S15_chiDoiApiKey_xacMinhKhongDat_khongLuu() {
        daCoKhoa();
        when(verifier.verify(any())).thenReturn(KHONG_DAT);

        assertThrows(CommonException.class, () -> service.updatePayos(khoa(null, API_MOI, null)));

        verify(repository, never()).save(any());
        khoaDangLuuKhongDoi();
    }

    @Test
    void S9_testConnection_dungKhoaDangLuu_traKetQuaVerifier() {
        daCoKhoa();
        when(verifier.verify(any())).thenReturn(DAT, KHONG_DAT);

        PayosTestResult ok = service.testConnection();
        PayosTestResult fail = service.testConnection();

        assertTrue(ok.getOk());
        assertFalse(fail.getOk());
        assertEquals(KHONG_DAT.message(), fail.getMessage());
        assertEquals("20", fail.getCode());
        ArgumentCaptor<PayosCredentials> c = ArgumentCaptor.forClass(PayosCredentials.class);
        verify(verifier, times(2)).verify(c.capture());
        assertEquals(new PayosCredentials(CLIENT_CU, API_CU, CHECKSUM_CU), c.getValue());
        verify(repository, never()).save(any());
    }

    @Test
    void S10_testConnection_thieuKhoa_nemLoiNhuCu() {
        chuaCoKhoa();

        assertThrows(CommonException.class, () -> service.testConnection());
        verifyNoInteractions(verifier);
    }
}
