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

@ExtendWith(MockitoExtension.class)
class InventoryChannelSyncJobTest {

    @Mock private KenhBanHangDongBoService kenhBanHangDongBoService;
    @Mock private KenhBanHangRepository kenhBanHangRepository;

    private InventoryChannelSyncJob job;

    @BeforeEach
    void setUp() {
        job = new InventoryChannelSyncJob(kenhBanHangDongBoService, kenhBanHangRepository);
    }

    @Test
    void onInventoryDeducted_tonDuoi3Units_kichHoatDayTonKhanCap() {
        // Tồn còn lại = 2 (< 3 units)
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
}

