package com.dev.backend.services.impl.dss;

import com.dev.backend.dto.dss.DssReplenishmentResponse;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DssReplenishmentRepository;
import com.dev.backend.repository.DssReplenishmentRepository.KhoInfo;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.dss.DssPolicyEngine.SkuRawInput;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DssReplenishmentServiceTest {

    @Mock private DssReplenishmentRepository repo;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private NguoiDungRepository nguoiDungRepository;

    private DssReplenishmentService service;

    @BeforeEach
    void setUp() {
        service = new DssReplenishmentService(repo, dieuHanhHeThongService, lichSuThayDoiService, nguoiDungRepository);
        lenient().when(dieuHanhHeThongService.getCauHinhString(anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1));
        lenient().when(dieuHanhHeThongService.getCauHinhInt(anyString(), anyInt()))
                .thenAnswer(inv -> inv.getArgument(1));
    }

    private static List<KhoInfo> baKhoHoatDong() {
        return List.of(
                new KhoInfo(1, "KHO_TONG", "Kho tổng", true),
                new KhoInfo(2, "CH_Q1", "Cửa hàng Quận 1", false),
                new KhoInfo(3, "CH_Q7", "Cửa hàng Quận 7", false));
    }

    private static SkuRawInput sampleInput() {
        return new SkuRawInput(
                10,
                101,
                "SP-10",
                "SKU-101",
                "Áo polo FCentric",
                "Đen",
                "#000000",
                "M",
                "Cotton",
                "Áo Polo",
                null,
                12L,
                2L,
                0L,
                10L,
                true,
                new double[]{4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4},
                5_000_000L,
                120L,
                Map.of("POS", 120L),
                List.of(4.0, 5.0),
                null,
                null,
                BigDecimal.valueOf(150000));
    }

    @Test
    @DisplayName("getRecommendations: tính 1 lần toàn hệ thống và luôn neo khoId về Kho tổng")
    void getRecommendations_tongHopToanHeThong_vaNeoKhoTong() {
        List<KhoInfo> warehouses = baKhoHoatDong();
        when(repo.listActiveWarehouses()).thenReturn(warehouses);
        when(repo.loadRawInputsAllWarehouses(anyInt(), anyInt(), any(LocalDate.class)))
                .thenReturn(List.of(sampleInput()));

        // Kể cả khi truyền ID một kho chi nhánh cũ, vẫn tổng hợp toàn hệ thống và neo về Kho tổng
        DssReplenishmentResponse resp = service.getRecommendations(2);

        assertEquals(DssReplenishmentResponse.SCOPE_ALL_WAREHOUSES, resp.getScope());
        assertEquals(3, resp.getIncludedWarehouseCount());
        assertEquals(warehouses, resp.getIncludedWarehouses());
        assertEquals(1, resp.getKhoId());
        assertEquals("Kho tổng", resp.getTenKho());
        assertTrue(resp.isLaKhoTong());
        assertEquals(1, resp.getItems().size());

        verify(repo, times(1)).loadRawInputsAllWarehouses(anyInt(), anyInt(), any(LocalDate.class));
        verify(repo, never()).syncLowStockAlerts(anyInt(), anyList());
    }

    @Test
    @DisplayName("recalculateAllActiveWarehouses: batch đêm chỉ tính 1 lần toàn hệ thống và chỉ ghi canh_bao cho Kho tổng")
    void recalculateAllActiveWarehouses_chayMotLan_vaChiDongBoCanhBaoKhoTong() {
        when(repo.listActiveWarehouses()).thenReturn(baKhoHoatDong());
        when(repo.loadRawInputsAllWarehouses(anyInt(), anyInt(), any(LocalDate.class)))
                .thenReturn(List.of(sampleInput()));
        when(repo.syncLowStockAlerts(eq(1), anyList())).thenReturn(1);

        int count = service.recalculateAllActiveWarehouses();

        assertEquals(3, count);
        verify(repo, times(1)).loadRawInputsAllWarehouses(anyInt(), anyInt(), any(LocalDate.class));
        verify(repo, times(1)).syncLowStockAlerts(eq(1), anyList());
        verify(repo, never()).syncLowStockAlerts(eq(2), anyList());
        verify(repo, never()).syncLowStockAlerts(eq(3), anyList());
    }

    @Test
    @DisplayName("getRecommendations: không có kho đang hoạt động nào thì ném CommonException")
    void getRecommendations_khongCoKhoHoatDong_nemCommonException() {
        when(repo.listActiveWarehouses()).thenReturn(List.of());
        assertThrows(CommonException.class, () -> service.getRecommendations(null));
    }
}
