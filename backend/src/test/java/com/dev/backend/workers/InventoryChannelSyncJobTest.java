package com.dev.backend.workers;

import com.dev.backend.dto.response.customize.DayTonResultDto;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.event.InventoryDeductedEvent;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.orm.jpa.EntityManagerHolder;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InventoryChannelSyncJobTest {

    @Mock private KenhBanHangDongBoService kenhBanHangDongBoService;
    @Mock private KenhBanHangRepository kenhBanHangRepository;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;
    @Mock private EntityManagerFactory entityManagerFactory;
    @Mock private EntityManager entityManager;

    private InventoryChannelSyncJob job;
    private final KenhBanHang shopify = KenhBanHang.builder().id(1).maKenh("SHOPIFY").tenKenh("Shopify").trangThai(1).build();
    private final KenhBanHang tiktok = KenhBanHang.builder().id(2).maKenh("TIKTOK").tenKenh("TikTok Shop").trangThai(1).build();

    @BeforeEach
    void setUp() {
        job = new InventoryChannelSyncJob(kenhBanHangDongBoService, kenhBanHangRepository, dieuHanhHeThongService, entityManagerFactory);
        when(dieuHanhHeThongService.getCauHinhInt("REALTIME_SYNC_THRESHOLD", 3)).thenReturn(3);
        when(dieuHanhHeThongService.getCauHinhInt("OMNI_SYNC_INTERVAL_MINS", 10)).thenReturn(10);
        when(entityManagerFactory.createEntityManager()).thenReturn(entityManager);
        when(entityManager.isOpen()).thenReturn(true);
    }

    @AfterEach
    void donLuong() {
        // Test hỏng giữa chừng cũng không để phiên dính sang test sau trên cùng luồng
        TransactionSynchronizationManager.unbindResourceIfPossible(entityManagerFactory);
    }

    /** EntityManager đang gắn vào luồng hiện tại (cái mà repository/proxy LAZY sẽ dùng), null nếu không có phiên. */
    private EntityManager phienDangMo() {
        EntityManagerHolder holder = (EntityManagerHolder) TransactionSynchronizationManager.getResource(entityManagerFactory);
        return holder != null ? holder.getEntityManager() : null;
    }

    @Test
    void dayTonDinhKy_chayTrongPhienJpa_dongPhienSauDot() {
        when(kenhBanHangRepository.findByTrangThai(1)).thenReturn(List.of(shopify));
        List<EntityManager> phienLucDay = new ArrayList<>();
        when(kenhBanHangDongBoService.dayTonKhoLenKenh(eq("SHOPIFY"), any())).thenAnswer(inv -> {
            phienLucDay.add(phienDangMo());
            return DayTonResultDto.builder().soDong(3).build();
        });

        job.scheduledInventoryBatchSync();

        // Đẩy tồn chạy khi đã có phiên mở; xong đợt thì gỡ khỏi luồng và đóng
        assertEquals(List.of(entityManager), phienLucDay);
        assertFalse(TransactionSynchronizationManager.hasResource(entityManagerFactory));
        verify(entityManager).close();
    }

    @Test
    void dayTonDinhKy_kenhLoi_vanDongPhien_kenhSauCoPhienRieng() {
        EntityManager phienKenhSau = mock(EntityManager.class);
        when(phienKenhSau.isOpen()).thenReturn(true);
        when(entityManagerFactory.createEntityManager()).thenReturn(entityManager, phienKenhSau);
        when(kenhBanHangRepository.findByTrangThai(1)).thenReturn(List.of(shopify, tiktok));
        when(kenhBanHangDongBoService.dayTonKhoLenKenh(eq("SHOPIFY"), any()))
                .thenThrow(new IllegalStateException("Shopify từ chối kết nối"));
        List<EntityManager> phienLucDayKenhSau = new ArrayList<>();
        when(kenhBanHangDongBoService.dayTonKhoLenKenh(eq("TIKTOK"), any())).thenAnswer(inv -> {
            phienLucDayKenhSau.add(phienDangMo());
            return DayTonResultDto.builder().soDong(1).build();
        });

        job.scheduledInventoryBatchSync();

        // Kênh lỗi vẫn trả phiên; kênh sau vẫn chạy, trong phiên của riêng nó
        verify(entityManager).close();
        assertEquals(List.of(phienKenhSau), phienLucDayKenhSau);
        verify(phienKenhSau).close();
        assertFalse(TransactionSynchronizationManager.hasResource(entityManagerFactory));
    }

    @Test
    void dayTonDinhKy_tatTuDong_khongMoPhien() {
        when(kenhBanHangRepository.findByTrangThai(1)).thenReturn(List.of(shopify));
        when(dieuHanhHeThongService.getCauHinhString("KENH_SHOPIFY_TU_DONG_DAY_TON", null)).thenReturn("false");

        job.scheduledInventoryBatchSync();

        verify(kenhBanHangDongBoService, never()).dayTonKhoLenKenh(any(), any());
        verify(entityManagerFactory, never()).createEntityManager();
    }

    @Test
    void onInventoryDeducted_tonDuoi3Units_kichHoatDayTonKhanCap() {
        // Tồn còn lại = 2 (< 3 units mặc định)
        InventoryDeductedEvent event = new InventoryDeductedEvent(this, 101, BigDecimal.valueOf(2), 1);

        job.onInventoryDeducted(event);

        verify(kenhBanHangDongBoService, times(1)).dayTonKhoKhanCap(101);
    }

    @Test
    void onInventoryDeducted_tonTren3Units_khongKichHoat() {
        // Tồn còn lại = 5 (>= 3 units)
        InventoryDeductedEvent event = new InventoryDeductedEvent(this, 101, BigDecimal.valueOf(5), 1);

        job.onInventoryDeducted(event);

        verify(kenhBanHangDongBoService, never()).dayTonKhoKhanCap(any());
    }

    @Test
    void onInventoryDeducted_dynamicThreshold_kichHoatTheoCauHinhMoi() {
        // Cấu hình threshold = 10 units (VD Flash sale)
        when(dieuHanhHeThongService.getCauHinhInt("REALTIME_SYNC_THRESHOLD", 3)).thenReturn(10);

        // Tồn còn lại = 7 (< 10 units) -> Phải kích hoạt đẩy tồn
        InventoryDeductedEvent event = new InventoryDeductedEvent(this, 202, BigDecimal.valueOf(7), 1);

        job.onInventoryDeducted(event);

        verify(kenhBanHangDongBoService, times(1)).dayTonKhoKhanCap(202);
    }
}

