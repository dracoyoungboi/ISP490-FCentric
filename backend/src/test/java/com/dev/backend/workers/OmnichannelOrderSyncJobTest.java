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
        DonBanHang existingOrder = DonBanHang.builder().id(99).soDonHang("SHP-1024").trangThai(4).build();
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
}