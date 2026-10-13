package com.dev.backend.workers;

import com.dev.backend.event.InventoryDeductedEvent;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.mockito.Mockito.*;

import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InventoryChannelSyncJobTest {

    @Mock private KenhBanHangDongBoService kenhBanHangDongBoService;
    @Mock private KenhBanHangRepository kenhBanHangRepository;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;

    private InventoryChannelSyncJob job;

    @BeforeEach
    void setUp() {
        job = new InventoryChannelSyncJob(kenhBanHangDongBoService, kenhBanHangRepository, dieuHanhHeThongService);
        when(dieuHanhHeThongService.getCauHinhInt("REALTIME_SYNC_THRESHOLD", 3)).thenReturn(3);
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

