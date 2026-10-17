package com.dev.backend.workers;

import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.response.customize.DayTonResultDto;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.event.InventoryDeductedEvent;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.impl.entities.DonBanHangService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.multitable.NhatHangService;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Các job tự động tôn trọng cấu hình đồng bộ theo kênh; chưa lưu cấu hình thì chạy như cũ. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KenhCauHinhDongBoJobTest {

    @Mock private KenhBanHangDongBoService kenhBanHangDongBoService;
    @Mock private KenhBanHangRepository kenhBanHangRepository;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;
    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private KhachHangRepository khachHangRepository;
    @Mock private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock private TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    @Mock private KenhBanHangService kenhBanHangService;
    @Mock private KhoRepository khoRepository;
    @Mock private NhatHangService nhatHangService;
    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private DonBanHangService donBanHangService;
    @Mock private EntityManagerFactory entityManagerFactory;

    private InventoryChannelSyncJob tonJob;
    private OmnichannelOrderSyncJob donJob;
    private final KenhBanHang shopify = KenhBanHang.builder().id(1).maKenh("SHOPIFY").tenKenh("Shopify").trangThai(1).build();

    @BeforeEach
    void setUp() {
        tonJob = new InventoryChannelSyncJob(kenhBanHangDongBoService, kenhBanHangRepository, dieuHanhHeThongService, entityManagerFactory);
        donJob = new OmnichannelOrderSyncJob(kenhBanHangRepository, donBanHangRepository, chiTietDonBanHangRepository,
                khachHangRepository, bienTheSanPhamRepository, trangThaiDongBoSanPhamRepository, kenhBanHangService,
                khoRepository, nhatHangService, phieuXuatKhoRepository, dieuHanhHeThongService, donBanHangService);
        when(kenhBanHangRepository.findByTrangThai(1)).thenReturn(List.of(shopify));
        when(dieuHanhHeThongService.getCauHinhInt("OMNI_SYNC_INTERVAL_MINS", 10)).thenReturn(10);
        when(dieuHanhHeThongService.getCauHinhInt("REALTIME_SYNC_THRESHOLD", 3)).thenReturn(3);
        when(kenhBanHangDongBoService.dayTonKhoLenKenh(any(), any())).thenReturn(DayTonResultDto.builder().soDong(0).build());
    }

    @Test
    void dayTonDinhKy_chuaCauHinh_dungMacDinhCu() {
        tonJob.scheduledInventoryBatchSync();

        ArgumentCaptor<DayTonKenhRequest> captor = ArgumentCaptor.forClass(DayTonKenhRequest.class);
        verify(kenhBanHangDongBoService).dayTonKhoLenKenh(eq("SHOPIFY"), captor.capture());
        assertEquals(0, BigDecimal.valueOf(100).compareTo(captor.getValue().getTyLeDayTon()));
        assertEquals(0, captor.getValue().getTonDem());
        assertEquals(0, captor.getValue().getNguongVe0());
    }

    @Test
    void dayTonDinhKy_apDungQuyTacDaLuu() {
        when(dieuHanhHeThongService.getCauHinhString("KENH_SHOPIFY_TY_LE_DAY_TON", null)).thenReturn("80");
        when(dieuHanhHeThongService.getCauHinhString("KENH_SHOPIFY_TON_DEM", null)).thenReturn("2");
        when(dieuHanhHeThongService.getCauHinhString("KENH_SHOPIFY_NGUONG_VE_0", null)).thenReturn("1");

        tonJob.scheduledInventoryBatchSync();

        ArgumentCaptor<DayTonKenhRequest> captor = ArgumentCaptor.forClass(DayTonKenhRequest.class);
        verify(kenhBanHangDongBoService).dayTonKhoLenKenh(eq("SHOPIFY"), captor.capture());
        assertEquals(0, BigDecimal.valueOf(80).compareTo(captor.getValue().getTyLeDayTon()));
        assertEquals(2, captor.getValue().getTonDem());
        assertEquals(1, captor.getValue().getNguongVe0());
    }

    @Test
    void dayTonDinhKy_tatTuDong_boQuaKenh() {
        when(dieuHanhHeThongService.getCauHinhString("KENH_SHOPIFY_TU_DONG_DAY_TON", null)).thenReturn("false");

        tonJob.scheduledInventoryBatchSync();

        verify(kenhBanHangDongBoService, never()).dayTonKhoLenKenh(any(), any());
    }

    @Test
    void dayTonKhanCap_tatTuDong_khongDay() {
        when(dieuHanhHeThongService.getCauHinhString("KENH_SHOPIFY_TU_DONG_DAY_TON", null)).thenReturn("false");

        tonJob.onInventoryDeducted(new InventoryDeductedEvent(this, 101, BigDecimal.valueOf(1), 1));

        verify(kenhBanHangDongBoService, never()).dayTonKhoKhanCap(any());
    }

    @Test
    void layDonDinhKy_tatTuDong_khongGoiSan() {
        when(dieuHanhHeThongService.getCauHinhString("KENH_SHOPIFY_TU_DONG_LAY_DON", null)).thenReturn("false");

        donJob.scheduledOrderSync();

        verify(kenhBanHangService, never()).getDecryptedShopifyAccessToken();
    }

    @Test
    void layDonDinhKy_chuaCauHinh_vanChayNhuCu() {
        donJob.scheduledOrderSync();

        // Không có token nên dừng sớm, nhưng job vẫn đi vào bước lấy đơn như trước
        verify(kenhBanHangService).getDecryptedShopifyAccessToken();
    }
}
