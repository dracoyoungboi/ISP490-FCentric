package com.dev.backend.workers;

import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.KhachHang;
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

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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
                khoRepository
        );
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> inv.getArgument(0));
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
}

