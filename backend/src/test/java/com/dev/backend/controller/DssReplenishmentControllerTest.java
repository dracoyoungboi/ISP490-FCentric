package com.dev.backend.controller;

import com.dev.backend.dto.dss.DssConfigDto;
import com.dev.backend.dto.dss.DssConfigUpdateRequest;
import com.dev.backend.dto.dss.DssReplenishmentResponse;
import com.dev.backend.dto.dss.DssSummaryDto;
import com.dev.backend.repository.DssReplenishmentRepository.KhoInfo;
import com.dev.backend.services.impl.dss.DssReplenishmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DssReplenishmentControllerTest {

    @Mock
    private DssReplenishmentService dssReplenishmentService;

    private DssReplenishmentController controller;

    @BeforeEach
    void setUp() {
        controller = new DssReplenishmentController(dssReplenishmentService);
    }

    @Test
    void getRecommendations_vaWarehouses_traVe200() {
        when(dssReplenishmentService.listWarehouses())
                .thenReturn(List.of(new KhoInfo(1, "KHO_TONG", "Kho tổng", true)));
        DssReplenishmentResponse mockResp = DssReplenishmentResponse.builder()
                .khoId(1)
                .tenKho("Kho tổng")
                .laKhoTong(true)
                .scope(DssReplenishmentResponse.SCOPE_ALL_WAREHOUSES)
                .includedWarehouseCount(3)
                .config(DssConfigDto.builder().mode("BY_ABC_CLASS").build())
                .summary(DssSummaryDto.builder().totalSkus(3).needReorderCount(1).build())
                .items(List.of())
                .build();
        when(dssReplenishmentService.getRecommendations(1)).thenReturn(mockResp);

        var whRes = controller.getWarehouses();
        assertEquals(200, whRes.getBody().getStatus());
        assertEquals(1, whRes.getBody().getData().size());

        var recRes = controller.getRecommendations(1);
        assertEquals(200, recRes.getBody().getStatus());
        assertEquals(1, recRes.getBody().getData().getKhoId());
        assertEquals(DssReplenishmentResponse.SCOPE_ALL_WAREHOUSES, recRes.getBody().getData().getScope());
        assertEquals(3, recRes.getBody().getData().getIncludedWarehouseCount());
    }

    @Test
    void updateConfig_vaRecalculate_goiServiceVaTraThongDiep() {
        DssConfigUpdateRequest req = DssConfigUpdateRequest.builder()
                .mode("GLOBAL_PRESET")
                .globalPresetCode("PRESET_02_PEAK")
                .khoId(1)
                .build();
        DssReplenishmentResponse mockResp = DssReplenishmentResponse.builder()
                .khoId(1)
                .summary(DssSummaryDto.builder().alertedInCanhBaoCount(2).build())
                .build();
        when(dssReplenishmentService.updateConfig(req)).thenReturn(mockResp);
        when(dssReplenishmentService.recalculateAndSyncAlerts(1)).thenReturn(mockResp);

        var updRes = controller.updateConfig(req);
        assertEquals(200, updRes.getBody().getStatus());
        assertEquals(2, updRes.getBody().getData().getSummary().getAlertedInCanhBaoCount());

        var recRes = controller.recalculate(1);
        assertEquals(200, recRes.getBody().getStatus());
        verify(dssReplenishmentService).recalculateAndSyncAlerts(1);
    }
}

