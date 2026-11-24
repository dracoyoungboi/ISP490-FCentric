package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.dss.DssRecommendationItemDto;
import com.dev.backend.dto.dss.DssReplenishmentResponse;
import com.dev.backend.dto.response.HangNhapKhoTongResponse;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.BienThe;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.KhoTong;
import com.dev.backend.repository.DssReplenishmentRepository;
import com.dev.backend.repository.DssReplenishmentRepository.KhoInfo;
import com.dev.backend.repository.HangNhapKhoTongRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TongQuanVaiTroRepository;
import com.dev.backend.services.impl.dss.DssPolicyEngine;
import com.dev.backend.services.impl.dss.DssPolicyEngine.SkuRawInput;
import com.dev.backend.services.impl.dss.DssReplenishmentService;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Kiểm thử đối soát song song giữa màn Tạo yêu cầu nhập hàng ({@link HangNhapKhoTongService})
 * và màn Gợi ý nhập hàng DSS ({@link DssReplenishmentService}) qua {@link DssPolicyEngine} thật
 * trên cùng một tập dữ liệu SKU đầu vào.
 */
@ExtendWith(MockitoExtension.class)
class HangNhapKhoTongDssParityTest {

    @Mock private DssReplenishmentRepository dssRepo;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private NguoiDungRepository nguoiDungRepository;

    @Mock private HangNhapKhoTongRepository hangRepo;
    @Mock private TongQuanVaiTroRepository vaiTroRepo;

    private DssReplenishmentService dssService;
    private HangNhapKhoTongService hangService;
    private Map<String, String> configOverrides;

    @BeforeEach
    void setUp() {
        configOverrides = new HashMap<>();
        dssService = new DssReplenishmentService(dssRepo, dieuHanhHeThongService, lichSuThayDoiService, nguoiDungRepository);
        hangService = new HangNhapKhoTongService(hangRepo, vaiTroRepo, dssService);

        when(dssRepo.listActiveWarehouses()).thenReturn(List.of(
                new KhoInfo(1, "KHO_TONG", "Kho tổng", true),
                new KhoInfo(2, "CH_Q1", "Cửa hàng Quận 1", false),
                new KhoInfo(3, "CH_Q7", "Cửa hàng Quận 7", false)));
        when(hangRepo.khoTongHoatDong()).thenReturn(List.of(new KhoTong(1, "KHO_TONG", "Kho tổng", "Hà Nội", "QL A")));
        when(hangRepo.maVachTheoBienThe(any())).thenReturn(Map.of(101, "8930000101"));
        when(vaiTroRepo.yeuCauMoTheoBienThe(any())).thenReturn(Map.of());

        when(dieuHanhHeThongService.getCauHinhString(anyString(), anyString()))
                .thenAnswer(inv -> configOverrides.getOrDefault(inv.getArgument(0), inv.getArgument(1)));
        when(dieuHanhHeThongService.getCauHinhInt(anyString(), anyInt()))
                .thenAnswer(inv -> {
                    String raw = configOverrides.get(inv.getArgument(0));
                    return raw != null ? Integer.parseInt(raw) : inv.getArgument(1);
                });
    }

    private static SkuRawInput skuInput(
            int id,
            String ten,
            long ftu,
            long incoming,
            boolean daTungNhap,
            double[] dailySold,
            long revenueN,
            long sold30,
            List<Double> leadTimes) {
        return new SkuRawInput(
                1000 + id,
                id,
                "SP-" + id,
                "SKU-" + id,
                ten,
                "Đen",
                "#111111",
                "M",
                "Cotton",
                "Áo khoác",
                null,
                ftu + 1,
                1,
                incoming,
                ftu,
                daTungNhap,
                dailySold,
                revenueN,
                sold30,
                Map.of("SHOPEE", sold30),
                leadTimes,
                null,
                null,
                BigDecimal.valueOf(150000));
    }

    private List<SkuRawInput> boDuLieu6NhomSku() {
        return List.of(
                // 1) Nhóm A (Peak): tồn 2, bán 10/ngày -> CRITICAL, cần nhập gấp
                skuInput(101, "Áo polo bán chạy", 2, 0, true,
                        new double[]{10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10}, 5_000_000L, 280, List.of(4.0, 6.0)),
                // 2) Nhóm B (Standard): chạm ROP -> HIGH, cần nhập
                skuInput(102, "Áo khoác vừa tầm", 10, 2, true,
                        new double[]{2, 4, 2, 4, 2, 4, 2, 4, 2, 4, 2, 4, 2, 4}, 1_600_000L, 70, List.of(4.0, 4.0)),
                // 3) Nhóm C (Lean): L_avg=5, B=3, T=14, D_avg=4 -> SS=12, ROP=32. FTU=35 > ROP nên needsReorder=false dù Q=33!
                skuInput(103, "Quần thể thao chưa chạm ROP", 35, 0, true,
                        new double[]{4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4}, 400_000L, 84, List.of()),
                // 4) Tồn ít nhưng bán chậm (FTU=5, 30 ngày không bán) -> ROP=0, Q=0, deadStock=true
                skuInput(104, "Áo khoác tồn chậm", 5, 0, true,
                        new double[14], 0L, 0, List.of()),
                // 5) SKU mới tồn 0 chưa phát sinh bán -> ROP=0, Q=0, deadStock=false
                skuInput(105, "Áo sơ mi mới chưa bán", 0, 0, false,
                        new double[14], 0L, 0, List.of()),
                // 6) Chưa từng nhập kho tổng nhưng có sức bán -> needsReorder=true, Q>0
                skuInput(106, "Áo thun chưa nhập nhưng có đơn", 0, 0, false,
                        new double[]{3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3}, 1_000_000L, 60, List.of())
        );
    }

    @Test
    @DisplayName("Chế độ ABC tự động: tập mã đề xuất, tổng Q, ROP, tồn an toàn và trạng thái khớp 100% giữa 2 màn")
    void doiSoat_cheDoAbcTuDong_khopMotMotVoiDss() {
        List<SkuRawInput> rawInputs = boDuLieu6NhomSku();
        when(dssRepo.loadRawInputsAllWarehouses(anyInt(), anyInt(), any(LocalDate.class))).thenReturn(rawInputs);

        DssReplenishmentResponse dssResp = dssService.getRecommendations(1);
        HangNhapKhoTongResponse hangResp = hangService.hangKhoTong(1);

        assertEquals(DssReplenishmentResponse.SCOPE_ALL_WAREHOUSES, dssResp.getScope());
        assertEquals(3, dssResp.getIncludedWarehouseCount());
        assertParity(dssResp, hangResp);

        Map<Integer, BienThe> byId = hangResp.bienThe().stream()
                .collect(Collectors.toMap(BienThe::bienTheId, Function.identity()));
        // SKU 103 có FTU=35 > ROP=32 nên không được phép gợi ý nhập dù target chu kỳ Q > 0
        assertEquals(0L, byId.get(103).soLuongDeXuat());
        // SKU 104 bán chậm tồn 5 cái: ROP=0, đề xuất=0, đánh dấu tồn chậm
        assertEquals(0L, byId.get(104).soLuongDeXuat());
        assertEquals(0, byId.get(104).nguong());
        assertTrue(byId.get(104).tonCham());
        assertTrue(byId.get(104).du());
        // SKU 105 tồn 0 chưa bán: không bị gán nhầm bán chậm hay đề xuất gấp đôi ngưỡng
        assertEquals(0L, byId.get(105).soLuongDeXuat());
        assertFalse(byId.get(105).tonCham());
        assertFalse(byId.get(105).du());
        // SKU 106 chưa từng nhập nhưng DSS cần nhập -> vẫn có đề xuất > 0
        assertTrue(byId.get(106).soLuongDeXuat() > 0L);
    }

    @Test
    @DisplayName("Chế độ Toàn cục Ngừng nhập & Xả hàng: 100% mã khóa nhập và khớp số tồn dư cần xả")
    void doiSoat_cheDoNgungNhapXaHang_khoaTatCaVaKhopTonDu() {
        configOverrides.put(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_MODE, DssPolicyEngine.MODE_GLOBAL);
        configOverrides.put(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_GLOBAL_PRESET, DssPolicyEngine.PRESET_PHASE_OUT);
        configOverrides.put(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_PHASEOUT_REMAINING_DAYS, "10");

        List<SkuRawInput> rawInputs = boDuLieu6NhomSku();
        when(dssRepo.loadRawInputsAllWarehouses(anyInt(), anyInt(), any(LocalDate.class))).thenReturn(rawInputs);

        DssReplenishmentResponse dssResp = dssService.getRecommendations(1);
        HangNhapKhoTongResponse hangResp = hangService.hangKhoTong(1);

        assertEquals(DssReplenishmentResponse.SCOPE_ALL_WAREHOUSES, dssResp.getScope());
        assertEquals(3, dssResp.getIncludedWarehouseCount());
        assertParity(dssResp, hangResp);
        assertEquals(0L, dssResp.getSummary().getTotalSuggestedQty());
        assertEquals(0L, hangResp.bienThe().stream().mapToLong(BienThe::soLuongDeXuat).sum());
        assertTrue(hangResp.bienThe().stream().allMatch(BienThe::khoaTaoYeuCau));
    }

    private static void assertParity(DssReplenishmentResponse dssResp, HangNhapKhoTongResponse hangResp) {
        Map<Integer, DssRecommendationItemDto> dssById = dssResp.getItems().stream()
                .collect(Collectors.toMap(DssRecommendationItemDto::getBienTheSanPhamId, Function.identity()));
        Map<Integer, BienThe> hangById = hangResp.bienThe().stream()
                .collect(Collectors.toMap(BienThe::bienTheId, Function.identity()));

        assertEquals(dssById.keySet(), hangById.keySet());

        Set<Integer> dssNeedReorderIds = dssResp.getItems().stream()
                .filter(it -> !it.isPrCreationLocked() && it.isNeedsReorder())
                .map(DssRecommendationItemDto::getBienTheSanPhamId)
                .collect(Collectors.toSet());
        Set<Integer> hangSuggestedIds = hangResp.bienThe().stream()
                .filter(bt -> bt.soLuongDeXuat() > 0L)
                .map(BienThe::bienTheId)
                .collect(Collectors.toSet());
        assertEquals(dssNeedReorderIds, hangSuggestedIds, "Tập mã gợi ý nhập phải khớp 1-1 với màn DSS");

        long totalHangSuggested = hangResp.bienThe().stream().mapToLong(BienThe::soLuongDeXuat).sum();
        assertEquals(dssResp.getSummary().getTotalSuggestedQty(), totalHangSuggested,
                "Tổng số lượng đề xuất phải khớp 100% với Tổng đề xuất đặt Q bên DSS");

        for (Integer id : dssById.keySet()) {
            DssRecommendationItemDto d = dssById.get(id);
            BienThe h = hangById.get(id);
            assertEquals(d.getFtu(), h.khaDung(), "FTU khớp cho SKU " + id);
            assertEquals(d.getIncoming(), h.dangVe(), "Incoming khớp cho SKU " + id);
            assertEquals((int) d.getReorderPoint(), h.nguong(), "ROP khớp cho SKU " + id);
            assertEquals(d.getSafetyStock(), h.tonAnToan(), "SS khớp cho SKU " + id);
            assertEquals(d.getExcessStock(), h.tonDuXaHang(), "ExcessStock khớp cho SKU " + id);
            assertEquals(d.isFlashSaleRecommended(), h.goiYXaHang(), "FlashSale khớp cho SKU " + id);
            assertEquals(d.isDeadStock(), h.tonCham(), "DeadStock khớp cho SKU " + id);
            assertEquals(d.isPrCreationLocked(), h.khoaTaoYeuCau(), "PR lock khớp cho SKU " + id);
            assertEquals(d.getAbcClass(), h.phanLoaiAbc(), "ABC khớp cho SKU " + id);
            assertEquals(d.getUrgencyLevel(), h.mucDoKhanCap(), "Urgency khớp cho SKU " + id);
            assertEquals(d.getAppliedPreset(), h.kichBanApDung(), "Preset khớp cho SKU " + id);
            assertEquals(d.getDaysOfInventory(), h.soNgayTonKho(), "DOI khớp cho SKU " + id);
            assertEquals(d.getAvgDailyDemand(), h.banTrungBinhNgay(), "D_avg khớp cho SKU " + id);
        }
    }
}
