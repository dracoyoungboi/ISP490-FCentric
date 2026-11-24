package com.dev.backend.workers;

import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OmnichannelOrderSyncJobTest {

    @Mock private KenhBanHangRepository kenhBanHangRepository;
    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private KhachHangRepository khachHangRepository;
    @Mock private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock private TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    @Mock private KenhBanHangService kenhBanHangService;
    @Mock private KhoRepository khoRepository;
    @Mock private com.dev.backend.services.multitable.NhatHangService nhatHangService;
    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private com.dev.backend.services.multitable.DieuHanhHeThongService dieuHanhHeThongService;
    @Mock private com.dev.backend.services.impl.entities.DonBanHangService donBanHangService;

    private OmnichannelOrderSyncJob job;
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void webhookProgressDoesNotEchoBackAndMovesOnlyDraftToWaitingThroughSystemService() throws Exception {
        var sync = mock(com.dev.backend.services.KenhBanHangDongBoService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(job, "kenhBanHangDongBoService", sync);
        var channel = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        var order = DonBanHang.builder().id(9).trangThai(1).trangThaiThanhToan("da_thanh_toan").build();
        when(donBanHangRepository.findByKenhBanHangIdAndMaDonHangKenh(1, "123")).thenReturn(Optional.of(order));
        job.processShopifyWebhookOrder(mapper.readTree("{\"id\":123,\"financial_status\":\"paid\",\"cancelled_at\":null}"), channel, true);
        verify(donBanHangService).batDauXuLyTuShopify(1, "123");
        verifyNoInteractions(sync);
    }

    @Test
    void webhookDatabaseFailureMustEscapeSoDeliveryCanRetry() throws Exception {
        var channel = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        var order = DonBanHang.builder().id(9).trangThai(1).build();
        when(donBanHangRepository.findByKenhBanHangIdAndMaDonHangKenh(1, "123")).thenReturn(Optional.of(order));
        doThrow(new IllegalStateException("rollback")).when(donBanHangService).huyDonTuSan(eq(9), anyString());
        assertThrows(IllegalStateException.class, () -> job.processShopifyWebhookOrder(mapper.readTree("{\"id\":123,\"cancelled_at\":\"2026-11-18T00:00:00Z\"}"), channel, false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"SHOPEE", "SHOPEE_OFFICIAL", "LAZADA", "TIKTOK", "SHOPIFY"})
    void shopifyWebhookMustNeverUpdateAnotherChannelWithTheSameExternalOrderId(String otherCode) throws Exception {
        var channel = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        var foreign = DonBanHang.builder().id(88).kenhBanHang(KenhBanHang.builder().id(9).maKenh(otherCode).build())
                .maDonHangKenh("123").trangThai(1).trangThaiThanhToan("chua_thanh_toan").build();
        when(donBanHangRepository.findByMaDonHangKenh("123")).thenReturn(Optional.of(foreign));

        job.processShopifyWebhookOrder(mapper.readTree("{\"id\":123,\"order_number\":1024,\"financial_status\":\"paid\",\"line_items\":[]}"), channel, false);

        assertEquals("chua_thanh_toan", foreign.getTrangThaiThanhToan());
        verify(donBanHangRepository, never()).save(foreign);
        var saved = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(saved.capture());
        assertSame(channel, saved.getValue().getKenhBanHang());
    }

    @ParameterizedTest
    @ValueSource(strings = {"SHOPEE", "LAZADA", "TIKTOK", "SHOPIFY"})
    void displayNumberWithoutAnExternalIdMustNotAdoptAnOrderFromAnotherChannel(String otherCode) throws Exception {
        var channel = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        var foreign = DonBanHang.builder().id(88).soDonHang("SHP-1024")
                .kenhBanHang(KenhBanHang.builder().id(9).maKenh(otherCode).build()).trangThai(1).build();
        when(donBanHangRepository.findBySoDonHang("SHP-1024")).thenReturn(Optional.of(foreign));

        job.processShopifyWebhookOrder(mapper.readTree("{\"id\":123,\"order_number\":1024,\"cancelled_at\":\"2026-11-18T00:00:00Z\",\"line_items\":[]}"), channel, false);

        verify(donBanHangService, never()).huyDonTuSan(eq(88), anyString());
        var saved = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(saved.capture());
        assertSame(channel, saved.getValue().getKenhBanHang());
        assertNotEquals(foreign.getSoDonHang(), saved.getValue().getSoDonHang());
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 7, 8})
    void retriesNativeProgressForExistingWaitingOrdersOnlyAfterCommit(int warehouseState) throws Exception {
        var sync = mock(com.dev.backend.services.KenhBanHangDongBoService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(job, "kenhBanHangDongBoService", sync);
        var kenh = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        var don = DonBanHang.builder().id(9).trangThai(warehouseState).maDonHangKenh("123")
                .trangThaiThanhToan("da_thanh_toan").build();
        when(donBanHangRepository.findByKenhBanHangIdAndMaDonHangKenh(1, "123")).thenReturn(Optional.of(don));
        var node = mapper.readTree("{\"id\":123,\"cancelled_at\":null,\"financial_status\":\"paid\",\"fulfillment_status\":null}");

        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            assertFalse(job.processSingleOrder(node, kenh));
            verifyNoInteractions(sync);
            var callbacks = org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations();
            callbacks.forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit);
            callbacks.forEach(c -> c.afterCompletion(org.springframework.transaction.support.TransactionSynchronization.STATUS_COMMITTED));
            verify(sync, times(1)).dongBoTrangThaiDangThucHienShopify("123");
            assertEquals(warehouseState, don.getTrangThai());
            verifyNoInteractions(chiTietDonBanHangRepository, trangThaiDongBoSanPhamRepository);
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 3, 4, 5, 6})
    void neverReportsProgressForDraftOrTerminalOrders(int warehouseState) throws Exception {
        var sync = mock(com.dev.backend.services.KenhBanHangDongBoService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(job, "kenhBanHangDongBoService", sync);
        var kenh = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        var don = DonBanHang.builder().id(9).trangThai(warehouseState).maDonHangKenh("123")
                .trangThaiThanhToan("da_thanh_toan").build();
        when(donBanHangRepository.findByKenhBanHangIdAndMaDonHangKenh(1, "123")).thenReturn(Optional.of(don));
        assertFalse(job.processSingleOrder(mapper.readTree("{\"id\":123,\"cancelled_at\":null,\"financial_status\":\"paid\"}"), kenh));
        verifyNoInteractions(sync);
    }

    @BeforeEach
    void setUp() {
        job = new OmnichannelOrderSyncJob(
                kenhBanHangRepository,
                donBanHangRepository,
                chiTietDonBanHangRepository,
                khachHangRepository,
                bienTheSanPhamRepository,
                trangThaiDongBoSanPhamRepository,
                kenhBanHangService,
                khoRepository,
                nhatHangService,
                phieuXuatKhoRepository,
                dieuHanhHeThongService,
                donBanHangService
        );
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void getChuKyPhut_docCauHinhVaGioiHan() {
        when(dieuHanhHeThongService.getCauHinhInt("OMNI_SYNC_INTERVAL_MINS", 10)).thenReturn(3, 0, 5000);

        assertEquals(3, job.getChuKyPhut());
        assertEquals(1, job.getChuKyPhut());
        assertEquals(1440, job.getChuKyPhut());
    }

    @Test
    void getLanLayDonCuoi_chuaLayDonThiNull() {
        assertNull(job.getLanLayDonCuoi(1));
        assertNull(job.getLanLayDonCuoi(null));
    }

    @Test
    void processSingleOrder_newOrder_createsOrderWithShpPrefixAndStatusZero() throws Exception {
        String json = """
        {
            "id": 5512345678,
            "order_number": 1024,
            "financial_status": "pending",
            "current_subtotal_price": "500000.00",
            "total_price": "530000.00",
            "total_shipping_price_set": {
                "shop_money": { "amount": "30000.00" }
            },
            "customer": {
                "first_name": "Nguyễn",
                "last_name": "Văn A",
                "phone": "0912345678",
                "email": "vana@example.com"
            },
            "shipping_address": {
                "address1": "123 Lê Lợi",
                "city": "Hồ Chí Minh",
                "province": "Quận 1",
                "country": "Vietnam"
            },
            "line_items": [
                {
                    "id": 998877,
                    "title": "Áo Thun Basic",
                    "sku": "TSHIRT-BLK-L",
                    "variant_id": 48111222,
                    "quantity": 2,
                    "price": "250000.00"
                }
            ]
        }
        """;

        KenhBanHang kenh = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        KhachHang kh = KhachHang.builder().id(5).tenKhachHang("Nguyễn Văn A").soDienThoai("0912345678").build();
        BienTheSanPham bt = BienTheSanPham.builder().id(20).maSku("TSHIRT-BLK-L").giaBan(BigDecimal.valueOf(250000)).build();

        when(donBanHangRepository.findBySoDonHang("SHP-1024")).thenReturn(Optional.empty());
        when(donBanHangRepository.findByMaDonHangKenh("5512345678")).thenReturn(Optional.empty());
        when(khachHangRepository.findFirstBySoDienThoai("0912345678")).thenReturn(Optional.of(kh));
        when(bienTheSanPhamRepository.findByMaSkuIgnoreCase("TSHIRT-BLK-L")).thenReturn(Optional.of(bt));

        boolean processed = job.processSingleOrder(mapper.readTree(json), kenh);

        assertTrue(processed);
        ArgumentCaptor<DonBanHang> captor = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(captor.capture());

        DonBanHang saved = captor.getValue();
        assertEquals("SHP-1024", saved.getSoDonHang());
        assertEquals("5512345678", saved.getMaDonHangKenh());
        assertEquals(0, saved.getTrangThai()); // 0 = Chờ xử lý (Pending)
        assertEquals(new BigDecimal("500000.00"), saved.getTienHang());
        assertEquals(new BigDecimal("30000.00"), saved.getPhiVanChuyen());
        assertEquals(new BigDecimal("530000.00"), saved.getTongCong());
        assertEquals("chua_thanh_toan", saved.getTrangThaiThanhToan());
        verify(chiTietDonBanHangRepository, times(1)).save(any());
    }

    @Test
    void processSingleOrder_cancelledOrder_updatesStatusToCancelledAndCallsPickListAdjustment() throws Exception {
        String json = """
        {
            "id": 5512345678,
            "order_number": 1024,
            "cancelled_at": "2026-10-12T15:00:00Z",
            "cancel_reason": "customer",
            "financial_status": "voided"
        }
        """;

        KenhBanHang kenh = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        DonBanHang existingOrder = DonBanHang.builder()
                .id(99)
                .soDonHang("SHP-1024")
                .maDonHangKenh("5512345678")
                .kenhBanHang(kenh)
                .trangThai(1) // Chờ nhặt hàng (có thể đang nằm trong phiếu nhặt)
                .build();

        when(donBanHangRepository.findBySoDonHang("SHP-1024")).thenReturn(Optional.of(existingOrder));

        boolean processed = job.processSingleOrder(mapper.readTree(json), kenh);

        assertFalse(processed);
        // Hủy theo sàn đi qua DonBanHangService (giao dịch riêng, nạp lại đơn) — job không sửa entity tách rời
        verify(donBanHangService).huyDonTuSan(99, "Hủy từ sàn Shopify: customer");
        verify(donBanHangRepository, never()).save(existingOrder);
    }

    @Test
    void processSingleOrder_donDaHuy_khongGoiHuyLanNua() throws Exception {
        String json = """
        { "id": 5512345678, "order_number": 1024, "cancelled_at": "2026-10-12T15:00:00Z", "financial_status": "voided" }
        """;
        DonBanHang existingOrder = DonBanHang.builder().id(99).soDonHang("SHP-1024").trangThai(4)
                .kenhBanHang(KenhBanHang.builder().id(1).maKenh("SHOPIFY").build()).build();
        when(donBanHangRepository.findBySoDonHang("SHP-1024")).thenReturn(Optional.of(existingOrder));

        assertFalse(job.processSingleOrder(mapper.readTree(json), KenhBanHang.builder().id(1).maKenh("SHOPIFY").build()));

        verifyNoInteractions(donBanHangService);
    }

    // ---------------- Đổi sang cửa hàng Shopify khác: số đơn hiển thị trùng với đơn của cửa hàng cũ ----------------

    private static final String DON_CUA_HANG_MOI = """
        {
            "id": 6600000004321,
            "order_number": 1001,
            "financial_status": "paid",
            "current_subtotal_price": "200000.00",
            "total_price": "200000.00",
            "total_shipping_price_set": { "shop_money": { "amount": "0.00" } },
            "customer": { "first_name": "Trần", "last_name": "B", "phone": "0987654321" },
            "line_items": []
        }
        """;

    private DonBanHang donCuaHangCu() {
        return DonBanHang.builder().id(55).soDonHang("SHP-1001").maDonHangKenh("5500000001111").trangThai(1).build();
    }

    @Test
    void processSingleOrder_cuaHangMoiTrungSoVoiDonCu_taoDonMoiCoDuoiId() throws Exception {
        KenhBanHang kenh = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        when(donBanHangRepository.findBySoDonHang("SHP-1001")).thenReturn(Optional.of(donCuaHangCu()));
        when(donBanHangRepository.findBySoDonHang("SHP-1001-4321")).thenReturn(Optional.empty());
        when(khachHangRepository.findFirstBySoDienThoai("0987654321")).thenReturn(Optional.of(KhachHang.builder().id(6).build()));

        assertTrue(job.processSingleOrder(mapper.readTree(DON_CUA_HANG_MOI), kenh));

        ArgumentCaptor<DonBanHang> captor = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(captor.capture());
        assertEquals("SHP-1001-4321", captor.getValue().getSoDonHang());
        assertEquals("6600000004321", captor.getValue().getMaDonHangKenh());
        verifyNoInteractions(donBanHangService);
    }

    @Test
    void processSingleOrder_duoiCungTrung_dungCaId() throws Exception {
        KenhBanHang kenh = KenhBanHang.builder().id(1).maKenh("SHOPIFY").build();
        when(donBanHangRepository.findBySoDonHang("SHP-1001")).thenReturn(Optional.of(donCuaHangCu()));
        when(donBanHangRepository.findBySoDonHang("SHP-1001-4321")).thenReturn(Optional.of(DonBanHang.builder().id(56).build()));
        when(khachHangRepository.findFirstBySoDienThoai("0987654321")).thenReturn(Optional.of(KhachHang.builder().id(6).build()));

        assertTrue(job.processSingleOrder(mapper.readTree(DON_CUA_HANG_MOI), kenh));

        ArgumentCaptor<DonBanHang> captor = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(captor.capture());
        assertEquals("SHP-1001-6600000004321", captor.getValue().getSoDonHang());
        assertTrue(captor.getValue().getSoDonHang().length() <= 50);
    }

    @Test
    void processSingleOrder_donCuaHangMoiBiHuy_khongHuyNhamDonCu() throws Exception {
        String json = """
        { "id": 6600000004321, "order_number": 1001, "cancelled_at": "2026-10-23T08:00:00Z",
          "cancel_reason": "customer", "financial_status": "voided", "line_items": [] }
        """;
        when(donBanHangRepository.findBySoDonHang("SHP-1001")).thenReturn(Optional.of(donCuaHangCu()));
        when(donBanHangRepository.findBySoDonHang("SHP-1001-4321")).thenReturn(Optional.empty());

        job.processSingleOrder(mapper.readTree(json), KenhBanHang.builder().id(1).maKenh("SHOPIFY").build());

        verify(donBanHangService, never()).huyDonTuSan(eq(55), any());
    }

    @Test
    void processSingleOrder_timTheoIdDonTrongKenhTruoc_huyDungDon() throws Exception {
        String json = """
        { "id": 6600000004321, "order_number": 1001, "cancelled_at": "2026-10-23T08:00:00Z",
          "cancel_reason": "customer", "financial_status": "voided" }
        """;
        DonBanHang donMoi = DonBanHang.builder().id(77).soDonHang("SHP-1001-4321").maDonHangKenh("6600000004321").trangThai(0).build();
        when(donBanHangRepository.findByKenhBanHangIdAndMaDonHangKenh(1, "6600000004321")).thenReturn(Optional.of(donMoi));
        when(donBanHangRepository.findBySoDonHang("SHP-1001")).thenReturn(Optional.of(donCuaHangCu()));

        assertFalse(job.processSingleOrder(mapper.readTree(json), KenhBanHang.builder().id(1).maKenh("SHOPIFY").build()));

        verify(donBanHangService).huyDonTuSan(77, "Hủy từ sàn Shopify: customer");
        verify(donBanHangService, never()).huyDonTuSan(eq(55), any());
    }

    // ---------- Shopify từ chối khóa làm mới ----------

    private KenhBanHang kenhShopify() {
        return KenhBanHang.builder().id(2).maKenh("SHOPIFY")
                .apiUrl("https://fcentric-dev.myshopify.com/admin/api/2024-01").trangThai(1).build();
    }

    private static LoiCoMaException tuChoiLamMoi() {
        return new LoiCoMaException(HttpStatus.FAILED_DEPENDENCY, MaLoi.LAM_MOI_KHOA_LOI,
                "Shopify đã từ chối khóa làm mới (HTTP 401). Cập nhật khóa truy cập ở Cấu hình Shopify rồi thử lại.");
    }

    @Test
    void scheduledOrderSync_shopifyTuChoiKhoaLamMoi_jobKhongNemLoiRaNgoai() {
        when(kenhBanHangRepository.findByTrangThai(1)).thenReturn(List.of(kenhShopify()));
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenThrow(tuChoiLamMoi());

        assertDoesNotThrow(job::scheduledOrderSync);
        verify(kenhBanHangService).getDecryptedShopifyAccessToken();
    }

    @Test
    void syncShopifyOrders_nutLayDonDungChung_vanNhanLoi424KhongBaoKhongDon() {
        when(kenhBanHangService.getDecryptedShopifyAccessToken()).thenThrow(tuChoiLamMoi());

        LoiCoMaException loi = assertThrows(LoiCoMaException.class,
                () -> job.syncShopifyOrders(kenhShopify(), Instant.now().minusSeconds(86_400), Instant.now()));
        assertEquals(MaLoi.LAM_MOI_KHOA_LOI, loi.getMa());
    }

    @Test
    void mapShopeeOrderStatus_chuanHoaDu8TrangThaiBaoGomHoanTra() throws Exception {
        java.lang.reflect.Method mapMethod = OmnichannelOrderSyncJob.class.getDeclaredMethod("mapShopeeOrderStatus", String.class);
        mapMethod.setAccessible(true);

        assertEquals(0, mapMethod.invoke(null, "UNPAID"), "UNPAID -> 0 (Nháp)");
        assertEquals(0, mapMethod.invoke(null, "READY_TO_SHIP"), "READY_TO_SHIP -> 0 (Nháp chờ gửi sang kho)");
        assertEquals(1, mapMethod.invoke(null, "PROCESSED"), "PROCESSED -> 1 (Chờ nhặt hàng / Người bán đang chuẩn bị hàng)");
        assertEquals(3, mapMethod.invoke(null, "SHIPPED"), "SHIPPED -> 3 (Đã xuất toàn bộ)");
        assertEquals(3, mapMethod.invoke(null, "TO_CONFIRM_RECEIVE"), "TO_CONFIRM_RECEIVE -> 3 (Đã xuất toàn bộ)");
        assertEquals(5, mapMethod.invoke(null, "COMPLETED"), "COMPLETED -> 5 (Hoàn thành)");
        assertEquals(4, mapMethod.invoke(null, "CANCELLED"), "CANCELLED -> 4 (Đã hủy)");
        assertEquals(4, mapMethod.invoke(null, "IN_CANCEL"), "IN_CANCEL -> 4 (Đã hủy)");
        assertEquals(6, mapMethod.invoke(null, "TO_RETURN"), "TO_RETURN -> 6 (Bị hoàn trả)");
        assertEquals(6, mapMethod.invoke(null, "RETURNED"), "RETURNED -> 6 (Bị hoàn trả)");
        assertEquals(6, mapMethod.invoke(null, "RETURN_REFUND"), "RETURN_REFUND -> 6 (Bị hoàn trả)");
    }

    @Test
    void processSingleShopeeOrder_khiDonBiHuyTrenShopee_goiHuyDonTuSan() {
        var kenh = KenhBanHang.builder().id(2).maKenh("SHOPEE").tenKenh("Shopee Store").build();
        var don = DonBanHang.builder().id(201).soDonHang("SHP-241105123456").maDonHangKenh("241105123456").trangThai(1).build();
        when(donBanHangRepository.findBySoDonHang("SHP-241105123456")).thenReturn(Optional.of(don));

        var orderDto = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        orderDto.setOrderSn("241105123456");
        orderDto.setOrderStatus("CANCELLED");
        orderDto.setCancelReason("Khách đổi ý");

        boolean result = job.processSingleShopeeOrder(orderDto, kenh);

        assertFalse(result, "Cập nhật đơn đã tồn tại trả về false (không tính vào đơn mới tạo)");
        verify(donBanHangService).huyDonTuSan(201, "Khách đổi ý");
    }

    @Test
    void processSingleShopeeOrder_khiDonHoanTraTrenShopee_goiCapNhatTrangThaiGiaoHangTuSan() {
        var kenh = KenhBanHang.builder().id(2).maKenh("SHOPEE").tenKenh("Shopee Store").build();
        var don = DonBanHang.builder().id(202).soDonHang("SHP-241105654321").maDonHangKenh("241105654321").trangThai(3).build();
        when(donBanHangRepository.findBySoDonHang("SHP-241105654321")).thenReturn(Optional.of(don));

        var orderDto = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        orderDto.setOrderSn("241105654321");
        orderDto.setOrderStatus("TO_RETURN");

        boolean result = job.processSingleShopeeOrder(orderDto, kenh);

        assertFalse(result);
        verify(donBanHangService).capNhatTrangThaiGiaoHangTuSan(202, "TO_RETURN");
    }

    @Test
    @org.junit.jupiter.api.DisplayName("Shopify: Buyer gửi yêu cầu hoàn trả (return_status = RETURN_REQUESTED) phải chuyển ngay sang Bị hoàn trả (6)")
    void processShopifyWebhookOrder_khiCoReturnStatusReturnRequested_chuyenNgaySangBiHoanTra() throws Exception {
        var channel = KenhBanHang.builder().id(1).maKenh("SHOPIFY").tenKenh("Shopify Store").build();
        var order = DonBanHang.builder()
                .id(305)
                .kenhBanHang(channel)
                .maDonHangKenh("5550001")
                .trangThai(3)
                .trangThaiThanhToan("da_thanh_toan")
                .build();
        when(donBanHangRepository.findByKenhBanHangIdAndMaDonHangKenh(1, "5550001")).thenReturn(Optional.of(order));

        String payload = """
                {
                  "id": 5550001,
                  "financial_status": "paid",
                  "fulfillment_status": "fulfilled",
                  "cancelled_at": null,
                  "return_status": "RETURN_REQUESTED",
                  "refunds": []
                }
                """;

        job.processShopifyWebhookOrder(mapper.readTree(payload), channel, false);

        verify(donBanHangService).capNhatTrangThaiGiaoHangTuSan(305, "return_requested");
    }

    @Test
    @org.junit.jupiter.api.DisplayName("Shopee: Đơn đã gửi sang kho trên FCentric (1) nhưng sàn vẫn READY_TO_SHIP phải tự đẩy sang PROCESSED")
    void processSingleShopeeOrder_khiDonDaGuiSangKhoNhungSanConReadyToShip_goiDongBoChuanBiHang() {
        var sync = mock(com.dev.backend.services.KenhBanHangDongBoService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(job, "kenhBanHangDongBoService", sync);

        var kenh = KenhBanHang.builder().id(8).maKenh("SHOPEE_OFFICIAL").tenKenh("Shopee").build();
        var don = DonBanHang.builder().id(401).soDonHang("SHP-261119XYZ").maDonHangKenh("261119XYZ")
                .trangThai(com.dev.backend.constant.variables.ITrangThaiDonBanHang.CHO_NHAT_HANG).build();
        when(donBanHangRepository.findBySoDonHang("SHP-261119XYZ")).thenReturn(Optional.of(don));

        var orderDto = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        orderDto.setOrderSn("261119XYZ");
        orderDto.setOrderStatus("READY_TO_SHIP");

        boolean result = job.processSingleShopeeOrder(orderDto, kenh);

        assertFalse(result);
        verify(sync).dongBoTrangThaiChuanBiHangShopee("261119XYZ");
    }

    @Test
    @org.junit.jupiter.api.DisplayName("Shopify đa kho: Kéo đơn mới LUÔN giữ khoXuat = Kho Tổng dù FO gán Location chi nhánh HCM, lưu gợi ý vào ShopifyOrderRoutingService")
    void processSingleOrder_shopifyDaKho_giuKhoTongVaLuuGoiY() throws Exception {
        var khoTong = com.dev.backend.entities.Kho.builder()
                .id(1).maKho("KHO_TONG").tenKho("Kho Tổng").loaiKho("kho_tong").trangThai(1).build();
        var khoHcm = com.dev.backend.entities.Kho.builder()
                .id(2).maKho("CN_HCM").tenKho("Kho Chi Nhánh HCM").loaiKho("cua_hang").trangThai(1).build();
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(khoTong, khoHcm));

        String mappingJson = """
                {
                  "cheDoDaKho": true,
                  "danhSachKho": [
                    { "maKhoSan": "11111", "tenKhoSan": "Kho Tổng", "khoIdFCentric": 1, "laMacDinh": true, "kichHoat": true },
                    { "maKhoSan": "22222", "tenKhoSan": "HCM Branch", "khoIdFCentric": 2, "laMacDinh": false, "kichHoat": true }
                  ]
                }
                """;
        when(dieuHanhHeThongService.getCauHinhString(eq("KENH_SHOPIFY_KHO_MAPPING"), any())).thenReturn(mappingJson);

        var routingService = spy(new com.dev.backend.services.shopify.ShopifyOrderRoutingService());
        org.springframework.test.util.ReflectionTestUtils.setField(routingService, "dieuHanhHeThongService", dieuHanhHeThongService);
        org.springframework.test.util.ReflectionTestUtils.setField(job, "shopifyOrderRoutingService", routingService);

        KenhBanHang kenh = KenhBanHang.builder().id(1).maKenh("SHOPIFY").tenKenh("Shopify").build();
        when(donBanHangRepository.findByKenhBanHangIdAndMaDonHangKenh(1, "778899001")).thenReturn(Optional.empty());
        when(donBanHangRepository.findBySoDonHang("SHP-2099")).thenReturn(Optional.empty());
        when(khachHangRepository.findFirstBySoDienThoai("0912345678")).thenReturn(Optional.of(KhachHang.builder().id(6).build()));

        String orderJson = """
                {
                  "id": 778899001,
                  "order_number": 2099,
                  "financial_status": "paid",
                  "current_subtotal_price": "350000.00",
                  "total_price": "350000.00",
                  "total_shipping_price_set": { "shop_money": { "amount": "0.00" } },
                  "customer": { "first_name": "Lê", "last_name": "C", "phone": "0912345678" },
                  "fulfillment_orders_gql": [
                    {
                      "id": "81001",
                      "status": "OPEN",
                      "assignedLocationId": "22222",
                      "assignedLocationName": "HCM Branch",
                      "deliveryMethodType": "PICK_UP",
                      "skus": ["AO-01"]
                    }
                  ],
                  "line_items": []
                }
                """;

        assertTrue(job.processSingleOrder(mapper.readTree(orderJson), kenh));

        ArgumentCaptor<DonBanHang> donCaptor = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(donCaptor.capture());
        DonBanHang saved = donCaptor.getValue();
        assertNotNull(saved.getKhoXuat());
        assertEquals(1, saved.getKhoXuat().getId(), "Đơn Shopify mới kéo về phải luôn giữ nguyên ở Kho Tổng để QLK Kho Tổng điều tiết");
        assertTrue(saved.getGhiChu() != null && saved.getGhiChu().contains("[GỢI Ý KHO: HCM Branch -> Kho Chi Nhánh HCM]"),
                "Ghi chú thực tế: " + saved.getGhiChu());
        assertTrue(saved.getGhiChu().contains("[NHẬN TẠI CỬA HÀNG]"));

        ArgumentCaptor<com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta> metaCaptor =
                ArgumentCaptor.forClass(com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta.class);
        verify(routingService).save(metaCaptor.capture());
        assertEquals(2, metaCaptor.getValue().getKhoDeXuatId());
        assertEquals("PICK_UP", metaCaptor.getValue().getDeliveryMethodType());
    }

    @Test
    @org.junit.jupiter.api.DisplayName("Shopee COD UNPAID (Chờ xác nhận): gắn cờ [SHOPEE_CHO_XAC_NHAN], không sinh giả SPXVN và không báo đơn chờ kho; lên READY_TO_SHIP thì mở khóa")
    void processSingleShopeeOrder_unpaidCodChiXem_chuyenReadyToShipMoiMoKhoaVaBaoDon() {
        var thongBao = mock(com.dev.backend.services.impl.entities.ThongBaoXuatKhoService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(job, "thongBaoXuatKhoService", thongBao);

        var kenh = KenhBanHang.builder().id(8).maKenh("SHOPEE_OFFICIAL").tenKenh("Shopee").build();
        var khoTong = com.dev.backend.entities.Kho.builder()
                .id(1).maKho("KHO_TONG").tenKho("Kho Tổng").loaiKho("kho_tong").trangThai(1).build();
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(khoTong));
        when(khachHangRepository.findFirstBySoDienThoai("0901112233"))
                .thenReturn(Optional.of(KhachHang.builder().id(10).tenKhachHang("Khách Shopee").build()));
        when(donBanHangRepository.findBySoDonHang("SHP-261120COD")).thenReturn(Optional.empty());

        var addr = new com.dev.backend.dto.response.customize.ShopeeOrderDto.ShopeeRecipientAddressDto();
        addr.setName("Nguyễn Test");
        addr.setPhone("0901112233");
        addr.setFullAddress("Hà Nội");

        var unpaidDto = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        unpaidDto.setOrderSn("261120COD");
        unpaidDto.setOrderStatus("UNPAID");
        unpaidDto.setPaymentMethod("CASH_ON_DELIVERY");
        unpaidDto.setTotalAmount(250000.0);
        unpaidDto.setRecipientAddress(addr);

        assertTrue(job.processSingleShopeeOrder(unpaidDto, kenh));

        ArgumentCaptor<DonBanHang> savedCap = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(savedCap.capture());
        DonBanHang saved = savedCap.getValue();
        assertEquals(0, saved.getTrangThai());
        assertNotNull(saved.getGhiChu());
        assertTrue(saved.getGhiChu().contains(OmnichannelOrderSyncJob.TAG_SHOPEE_CHO_XAC_NHAN));
        assertFalse(saved.getGhiChu().contains("SPXVN261120COD"), "Đơn UNPAID chưa có vận đơn thì không được tự bịa mã SPXVN");
        verify(thongBao, never()).donSanMoi(any());

        // Đợt quét sau Shopee xác nhận -> READY_TO_SHIP (Chờ lấy hàng - Chưa xử lý)
        saved.setId(505);
        when(donBanHangRepository.findBySoDonHang("SHP-261120COD")).thenReturn(Optional.of(saved));

        var readyDto = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        readyDto.setOrderSn("261120COD");
        readyDto.setOrderStatus("READY_TO_SHIP");
        readyDto.setPaymentMethod("CASH_ON_DELIVERY");
        readyDto.setTrackingNumber("SPXVN05999888");
        readyDto.setShippingCarrier("SPX Express");

        assertFalse(job.processSingleShopeeOrder(readyDto, kenh));
        assertFalse(saved.getGhiChu().contains(OmnichannelOrderSyncJob.TAG_SHOPEE_CHO_XAC_NHAN),
                "Phải gỡ [SHOPEE_CHO_XAC_NHAN] khi Shopee chuyển READY_TO_SHIP");
        assertTrue(saved.getGhiChu().contains("SPXVN05999888"));
        assertEquals("chua_thanh_toan", saved.getTrangThaiThanhToan());
        verify(thongBao, times(1)).donSanMoi(kenh);
    }

    @Test
    @org.junit.jupiter.api.DisplayName("Shopee Ví điện tử UNPAID: phải lưu chua_thanh_toan (không cầm đèn chạy trước ô tô), lên READY_TO_SHIP mới đổi da_thanh_toan")
    void processSingleShopeeOrder_viDienTuUnpaid_chuaThanhToanDenKhiReadyToShipMoiDaThanhToan() {
        var kenh = KenhBanHang.builder().id(8).maKenh("SHOPEE_OFFICIAL").tenKenh("Shopee").build();
        var khoTong = com.dev.backend.entities.Kho.builder()
                .id(1).maKho("KHO_TONG").tenKho("Kho Tổng").loaiKho("kho_tong").trangThai(1).build();
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(khoTong));
        when(khachHangRepository.findFirstBySoDienThoai("0902223344"))
                .thenReturn(Optional.of(KhachHang.builder().id(11).tenKhachHang("Khách Shopee").build()));
        when(donBanHangRepository.findBySoDonHang("SHP-261121EW")).thenReturn(Optional.empty());

        var addr = new com.dev.backend.dto.response.customize.ShopeeOrderDto.ShopeeRecipientAddressDto();
        addr.setName("Trần Ví");
        addr.setPhone("0902223344");
        addr.setFullAddress("TP.HCM");

        var unpaidWalletDto = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        unpaidWalletDto.setOrderSn("261121EW");
        unpaidWalletDto.setOrderStatus("UNPAID");
        unpaidWalletDto.setPaymentMethod("ShopeePay");
        unpaidWalletDto.setTotalAmount(420000.0);
        unpaidWalletDto.setRecipientAddress(addr);

        assertTrue(job.processSingleShopeeOrder(unpaidWalletDto, kenh));

        ArgumentCaptor<DonBanHang> savedCap = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(savedCap.capture());
        DonBanHang saved = savedCap.getValue();
        assertEquals("chua_thanh_toan", saved.getTrangThaiThanhToan(),
                "Đơn ví điện tử UNPAID chưa thanh toán trên sàn thì phải ở chua_thanh_toan");
        assertTrue(saved.getGhiChu().contains(OmnichannelOrderSyncJob.TAG_SHOPEE_CHO_XAC_NHAN));

        saved.setId(506);
        when(donBanHangRepository.findBySoDonHang("SHP-261121EW")).thenReturn(Optional.of(saved));

        var paidDto = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        paidDto.setOrderSn("261121EW");
        paidDto.setOrderStatus("READY_TO_SHIP");
        paidDto.setPaymentMethod("ShopeePay");
        paidDto.setTrackingNumber("SPXVN05999999");

        job.processSingleShopeeOrder(paidDto, kenh);
        assertEquals("da_thanh_toan", saved.getTrangThaiThanhToan());
        assertFalse(saved.getGhiChu().contains(OmnichannelOrderSyncJob.TAG_SHOPEE_CHO_XAC_NHAN));
    }

    @Test
    @org.junit.jupiter.api.DisplayName("Shopee Cash on Delivery (chữ thường có dấu cách) & heal UNPAID: giữ chua_thanh_toan tới khi COMPLETED")
    void processSingleShopeeOrder_cashOnDeliveryVaHieuChinhUnpaid() {
        var kenh = KenhBanHang.builder().id(8).maKenh("SHOPEE").tenKenh("Shopee").build();
        var existingWrong = DonBanHang.builder()
                .id(507).soDonHang("SHP-261121COD2").maDonHangKenh("261121COD2")
                .trangThai(0).trangThaiThanhToan("da_thanh_toan").ghiChu("Cũ").build();
        when(donBanHangRepository.findBySoDonHang("SHP-261121COD2")).thenReturn(Optional.of(existingWrong));

        var codReady = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        codReady.setOrderSn("261121COD2");
        codReady.setOrderStatus("READY_TO_SHIP");
        codReady.setPaymentMethod("Cash on Delivery");
        job.processSingleShopeeOrder(codReady, kenh);

        assertEquals("chua_thanh_toan", existingWrong.getTrangThaiThanhToan(),
                "Cash on Delivery khi mới READY_TO_SHIP phải hiệu chỉnh/giữ ở chua_thanh_toan");

        var codDone = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        codDone.setOrderSn("261121COD2");
        codDone.setOrderStatus("COMPLETED");
        codDone.setPaymentMethod("Cash on Delivery");
        job.processSingleShopeeOrder(codDone, kenh);

        assertEquals("da_thanh_toan", existingWrong.getTrangThaiThanhToan(),
                "Cash on Delivery sau khi COMPLETED mới đổi sang da_thanh_toan");
    }

    @Test
    @org.junit.jupiter.api.DisplayName("Shopee READY_TO_SHIP không có tracking/ĐVVC: không bịa SPXVN<orderSn>, không ghi [ĐƠN VỊ: ], lưu rõ PTTT Ví ShopeePay")
    void processSingleShopeeOrder_noTrackingOrBlankCarrier_neverFabricatesSpxvnOrEmptyTag() {
        var kenh = KenhBanHang.builder().id(8).maKenh("SHOPEE_OFFICIAL").tenKenh("Shopee").build();
        var khoTong = com.dev.backend.entities.Kho.builder()
                .id(1).maKho("KHO_TONG").tenKho("Kho Tổng").loaiKho("kho_tong").trangThai(1).build();
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(khoTong));
        when(khachHangRepository.findFirstBySoDienThoai("0903334455"))
                .thenReturn(Optional.of(KhachHang.builder().id(12).tenKhachHang("Khách Shopee").build()));
        when(donBanHangRepository.findBySoDonHang("SHP-261125EWALLET")).thenReturn(Optional.empty());

        var addr = new com.dev.backend.dto.response.customize.ShopeeOrderDto.ShopeeRecipientAddressDto();
        addr.setName("****");
        addr.setPhone("0903334455");
        addr.setFullAddress("****");

        var dto = new com.dev.backend.dto.response.customize.ShopeeOrderDto();
        dto.setOrderSn("261125EWALLET");
        dto.setOrderStatus("READY_TO_SHIP");
        dto.setPaymentMethod("ShopeePay");
        dto.setShippingCarrier("");
        dto.setTrackingNumber(null);
        dto.setTotalAmount(540000.0);
        dto.setRecipientAddress(addr);

        assertTrue(job.processSingleShopeeOrder(dto, kenh));

        ArgumentCaptor<DonBanHang> cap = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(cap.capture());
        String note = cap.getValue().getGhiChu();
        assertNotNull(note);
        assertFalse(note.contains("SPXVN261125EWALLET"), "Tuyệt đối không tự bịa mã SPXVN theo mã đơn");
        assertFalse(note.contains("[ĐƠN VỊ: ]"), "Tuyệt đối không ghi thẻ [ĐƠN VỊ: ] rỗng");
        assertTrue(note.contains("[PTTT: Ví ShopeePay]"));
        assertFalse(note.contains("[COD:"));
        assertEquals("da_thanh_toan", cap.getValue().getTrangThaiThanhToan());
    }

    @Test
    @org.junit.jupiter.api.DisplayName("syncRealShopeeOrders: gọi get_shipping_document_data_info lấy mã chia chọn tuyến thật & tự chữa đơn lưu SPXVN giả")
    void syncRealShopeeOrders_enrichesRealSortCodeAndHealsBrokenOrder() {
        var shopeeClientMock = mock(com.dev.backend.services.shopee.ShopeeClient.class);
        org.springframework.test.util.ReflectionTestUtils.setField(job, "shopeeClient", shopeeClientMock);

        var kenh = KenhBanHang.builder().id(8).maKenh("SHOPEE_OFFICIAL").tenKenh("Shopee").build();
        when(kenhBanHangService.getShopeeShopId("SHOPEE_OFFICIAL")).thenReturn(88201679L);
        when(kenhBanHangService.getShopeePartnerId("SHOPEE_OFFICIAL")).thenReturn(2001L);
        when(kenhBanHangService.getDecryptedShopeePartnerKey("SHOPEE_OFFICIAL")).thenReturn("pk_live");
        when(kenhBanHangService.getDecryptedShopeeAccessToken("SHOPEE_OFFICIAL")).thenReturn("at_live");

        String sn = "261120S3WBWNQG";
        var existingBroken = DonBanHang.builder()
                .id(76).soDonHang("SHP-" + sn).maDonHangKenh(sn).kenhBanHang(kenh)
                .trangThai(5).trangThaiThanhToan("chua_thanh_toan")
                .tongCong(new BigDecimal("320000"))
                .ghiChu("[VẬN ĐƠN: SPXVN" + sn + "] [ĐƠN VỊ: ] | Đơn hàng đồng bộ tự động từ Shopee #" + sn)
                .build();
        when(donBanHangRepository.findBySoDonHang("SHP-" + sn)).thenReturn(Optional.of(existingBroken));

        var listRes = mapper.createObjectNode().put("error", "");
        listRes.putObject("response").put("more", false).putArray("order_list").addObject().put("order_sn", sn);
        when(shopeeClientMock.getOrderList(eq("2001"), eq("pk_live"), eq("at_live"), eq("88201679"),
                anyLong(), anyLong(), eq("update_time"), isNull(), eq(50), isNull(), eq(false)))
                .thenReturn(listRes);

        var detailRes = mapper.createObjectNode().put("error", "");
        var ordNode = detailRes.putObject("response").putArray("order_list").addObject();
        ordNode.put("order_sn", sn)
                .put("order_status", "PROCESSED")
                .put("payment_method", "CASH_ON_DELIVERY")
                .put("shipping_carrier", "")
                .put("total_amount", 320000.0);
        ordNode.putArray("package_list").addObject()
                .put("package_number", "PKG-888")
                .put("shipping_carrier", "Shopee Xpress (SPX VN)");
        when(shopeeClientMock.getOrderDetail(eq("2001"), eq("pk_live"), eq("at_live"), eq("88201679"),
                eq(List.of(sn)), eq(false)))
                .thenReturn(detailRes);

        var trackRes = mapper.createObjectNode().put("error", "");
        trackRes.putObject("response").put("tracking_number", "SPXVN05998877");
        when(shopeeClientMock.getTrackingNumber(eq("2001"), eq("pk_live"), eq("at_live"), eq("88201679"),
                eq(sn), eq(false)))
                .thenReturn(trackRes);

        var docRes = mapper.createObjectNode().put("error", "");
        var info = docRes.putObject("response").putObject("shipping_document_info");
        info.put("tracking_number", "SPXVN05998877");
        info.put("shipping_carrier", "Shopee Xpress (SPX VN)");
        info.put("cod", true);
        info.put("cod_amount", 320000);
        info.putObject("recipient_sort_code")
                .put("first_recipient_sort_code", "20-HAN-DD")
                .put("second_recipient_sort_code", "HN012-00-01");
        when(shopeeClientMock.getShippingDocumentDataInfo(eq("2001"), eq("pk_live"), eq("at_live"), eq("88201679"),
                eq(sn), eq("PKG-888"), eq(false)))
                .thenReturn(docRes);

        job.syncRealShopeeOrders(kenh, Instant.now().minusSeconds(600), Instant.now());

        String healed = existingBroken.getGhiChu();
        assertNotNull(healed);
        assertFalse(healed.contains("SPXVN" + sn), "Mã SPXVN giả phải bị ghi đè bởi mã vận đơn thật");
        assertFalse(healed.contains("[ĐƠN VỊ: ]"), "Thẻ [ĐƠN VỊ: ] rỗng phải bị thay bằng ĐVVC thật");
        assertTrue(healed.contains("[VẬN ĐƠN: SPXVN05998877]"));
        assertTrue(healed.contains("[ĐƠN VỊ: Shopee Xpress (SPX VN)]"));
        assertTrue(healed.contains("[TUYẾN: 20-HAN-DD]"));
        assertTrue(healed.contains("[TRẠM: HN012-00-01]"));
        assertTrue(healed.contains("[PTTT: COD]"));
        assertTrue(healed.contains("[COD: 320000]"));
    }
}
