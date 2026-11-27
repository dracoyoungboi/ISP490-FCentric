package com.dev.backend.services.impl.dss;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.dss.*;
import com.dev.backend.dto.request.CauHinhHeThongBulkUpdateRequest;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.DssReplenishmentRepository;
import com.dev.backend.repository.DssReplenishmentRepository.KhoInfo;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.dss.DssPolicyEngine.CalculationOutput;
import com.dev.backend.services.impl.dss.DssPolicyEngine.SkuRawInput;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Service điều phối Phân hệ 1 (DSS Gợi ý nhập hàng).
 * Chuỗi xử lý: Đọc 12 tham số ở `cau_hinh_he_thong` -> gọi `DssReplenishmentRepository` gom dữ liệu tồn/bán/mua toàn kho
 * -> đưa sang `DssPolicyEngine` tính ABC/SS/ROP/Q -> ghi ngưỡng cảnh báo vào `canh_bao` và Audit Log.
 */
@Service
@Slf4j
public class DssReplenishmentService {

    private final DssReplenishmentRepository repo;
    private final DieuHanhHeThongService dieuHanhHeThongService;
    private final LichSuThayDoiService lichSuThayDoiService;
    private final NguoiDungRepository nguoiDungRepository;

    public DssReplenishmentService(
            DssReplenishmentRepository repo,
            DieuHanhHeThongService dieuHanhHeThongService,
            LichSuThayDoiService lichSuThayDoiService,
            NguoiDungRepository nguoiDungRepository) {
        this.repo = repo;
        this.dieuHanhHeThongService = dieuHanhHeThongService;
        this.lichSuThayDoiService = lichSuThayDoiService;
        this.nguoiDungRepository = nguoiDungRepository;
    }

    // Đọc danh sách kho đang hoạt động (trừ KHO_TRANSIT) để hiển thị phạm vi tổng hợp trên UI
    @Transactional(readOnly = true)
    public List<KhoInfo> listWarehouses() {
        return repo.listActiveWarehouses();
    }

    // Đọc 12 tham số cấu hình DSS từ bảng `cau_hinh_he_thong` (chế độ ABC/Global, Z, T, N, g%, B, Lead Time...)
    public DssConfigDto readConfig() {
        double serviceLevelZ = 1.65d;
        String zStr = dieuHanhHeThongService.getCauHinhString(DieuHanhHeThongServiceImpl.CAU_HINH_DSS_SERVICE_LEVEL_Z, "1.65");
        try {
            if (zStr != null && !zStr.isBlank()) {
                serviceLevelZ = Double.parseDouble(zStr.trim());
            }
        } catch (NumberFormatException ignored) {
            serviceLevelZ = 1.65d;
        }

        return DssConfigDto.builder()
                .mode(dieuHanhHeThongService.getCauHinhString(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_MODE, DssPolicyEngine.MODE_BY_ABC))
                .globalPresetCode(dieuHanhHeThongService.getCauHinhString(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_GLOBAL_PRESET, DssPolicyEngine.PRESET_STANDARD))
                .observationDaysN(dieuHanhHeThongService.getCauHinhInt(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_OBSERVATION_DAYS_N, 14))
                .serviceLevelZ(serviceLevelZ)
                .cycleDaysT(dieuHanhHeThongService.getCauHinhInt(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_CYCLE_T, 14))
                .peakGrowthPercentG(dieuHanhHeThongService.getCauHinhInt(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_PEAK_GROWTH_G, 30))
                .peakCampaignDays(dieuHanhHeThongService.getCauHinhInt(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_PEAK_CAMPAIGN_DAYS, 14))
                .leanBufferDaysB(dieuHanhHeThongService.getCauHinhInt(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_LEAN_BUFFER_DAYS, 3))
                .phaseOutRemainingDays(dieuHanhHeThongService.getCauHinhInt(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_PHASEOUT_REMAINING_DAYS, 15))
                .defaultLeadTimeAvg(dieuHanhHeThongService.getCauHinhInt(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_DEFAULT_L_AVG, 5))
                .defaultLeadTimeMax(dieuHanhHeThongService.getCauHinhInt(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_DEFAULT_L_MAX, 7))
                .leadTimeSampleM(dieuHanhHeThongService.getCauHinhInt(
                        DieuHanhHeThongServiceImpl.CAU_HINH_DSS_LEAD_TIME_SAMPLE_M, 10))
                .build();
    }

    // Luồng GET lúc mở trang: tính gợi ý chỉ đọc (persistAlerts = false), không ghi DB
    @Transactional(readOnly = true)
    public DssReplenishmentResponse getRecommendations(Integer khoId) {
        return evaluateAllWarehouses(khoId, false);
    }

    // Luồng bấm nút "Tính lại ngay": tính lại toàn hệ thống, đồng bộ bảng `canh_bao` và ghi Audit Log
    @Transactional(rollbackFor = Exception.class)
    public DssReplenishmentResponse recalculateAndSyncAlerts(Integer khoId) {
        DssReplenishmentResponse response = evaluateAllWarehouses(khoId, true);
        recordAuditLog(response);
        return response;
    }

    /**
     * Tính toán lại DSS một lần trên tổng tất cả các kho đang hoạt động và đồng bộ cảnh báo {@code canh_bao}
     * vào Kho tổng chính (tránh ghi ngưỡng toàn hệ thống sang các kho chi nhánh).
     *
     * @return số lượng kho đang hoạt động được tổng hợp trong lần chạy
     */
    @Transactional(rollbackFor = Exception.class)
    public int recalculateAllActiveWarehouses() {
        List<KhoInfo> warehouses = repo.listActiveWarehouses();
        if (warehouses == null || warehouses.isEmpty()) {
            return 0;
        }
        KhoInfo anchorKho = resolveAnchorCentralWarehouse(warehouses, null);
        DssConfigDto config = readConfig();
        LocalDate todayVn = LocalDate.now(DssReplenishmentRepository.VN_ZONE);
        List<SkuRawInput> rawInputs = repo.loadRawInputsAllWarehouses(
                config.getObservationDaysN(), config.getLeadTimeSampleM(), todayVn);
        CalculationOutput out = DssPolicyEngine.calculate(rawInputs, config, todayVn);
        repo.syncLowStockAlerts(anchorKho.id(), out.items());
        return warehouses.size();
    }

    /**
     * Luồng bấm nút "Lưu & Tính lại ROP": ghi 12 tham số xuống bảng `cau_hinh_he_thong`,
     * sau đó chạy lại DSS toàn hệ thống để làm mới `canh_bao` (trừ khi caller yêu cầu chỉ đọc).
     */
    @Transactional(rollbackFor = Exception.class)
    public DssReplenishmentResponse updateConfig(DssConfigUpdateRequest req) {
        if (req == null) {
            return recalculateAndSyncAlerts(null);
        }

        // Khối 1: Thu thập toàn bộ khóa cấu hình không null từ Request (nút "Lưu & Tính lại ROP" trên Màn 1)
        // → đẩy hàng loạt xuống `cau_hinh_he_thong` qua bulkUpdateCauHinh
        Integer userId = currentUserId();
        List<CauHinhHeThongBulkUpdateRequest> updates = new ArrayList<>();
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_MODE, req.getMode());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_GLOBAL_PRESET, req.getGlobalPresetCode());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_OBSERVATION_DAYS_N, req.getObservationDaysN());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_SERVICE_LEVEL_Z, req.getServiceLevelZ());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_CYCLE_T, req.getCycleDaysT());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_PEAK_GROWTH_G, req.getPeakGrowthPercentG());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_PEAK_CAMPAIGN_DAYS, req.getPeakCampaignDays());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_LEAN_BUFFER_DAYS, req.getLeanBufferDaysB());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_PHASEOUT_REMAINING_DAYS, req.getPhaseOutRemainingDays());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_DEFAULT_L_AVG, req.getDefaultLeadTimeAvg());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_DEFAULT_L_MAX, req.getDefaultLeadTimeMax());
        addConfigUpdate(updates, DieuHanhHeThongServiceImpl.CAU_HINH_DSS_LEAD_TIME_SAMPLE_M, req.getLeadTimeSampleM());

        if (!updates.isEmpty()) {
            dieuHanhHeThongService.bulkUpdateCauHinh(updates, userId);
        }

        // Khối 2: Rẽ nhánh sau khi lưu — hoặc chỉ trả gợi ý lên UI (read-only), hoặc chạy lại DSS & ghi bảng `canh_bao`
        if (Boolean.FALSE.equals(req.getRecalculateNow())) {
            return getRecommendations(req.getKhoId());
        }
        return recalculateAndSyncAlerts(req.getKhoId());
    }

    // Lõi điều phối dùng chung cho cả GET (xem trước) và POST/PUT (lưu ngưỡng canh_bao vào Kho tổng)
    private DssReplenishmentResponse evaluateAllWarehouses(Integer requestedKhoId, boolean persistAlerts) {
        // Bước 1: Lấy mọi kho active (bỏ KHO_TRANSIT) và chọn Kho tổng làm neo lưu cảnh báo toàn chuỗi
        List<KhoInfo> activeWarehouses = repo.listActiveWarehouses();
        if (activeWarehouses == null || activeWarehouses.isEmpty()) {
            throw new CommonException(ThongDiep.of("dss.chuaCoKhoTong"));
        }
        KhoInfo anchorKho = resolveAnchorCentralWarehouse(activeWarehouses, requestedKhoId);

        // Bước 2: Đọc cấu hình hiện hành, lấy ngày hôm nay theo UTC+7 và gom SkuRawInput qua 6 câu SQL
        DssConfigDto config = readConfig();
        LocalDate todayVn = LocalDate.now(DssReplenishmentRepository.VN_ZONE);
        List<SkuRawInput> rawInputs = repo.loadRawInputsAllWarehouses(
                config.getObservationDaysN(), config.getLeadTimeSampleM(), todayVn);
        // Bước 3: Giao cho bộ máy toán học thuần DssPolicyEngine xếp hạng ABC và tính SS/ROP/Q/DOI
        CalculationOutput output = DssPolicyEngine.calculate(rawInputs, config, todayVn);

        // Bước 4: Nếu bấm Lưu/Tính lại (persistAlerts = true) thì cập nhật bảng `canh_bao`, ngược lại chỉ đếm trên RAM
        int alertedCount;
        if (persistAlerts) {
            alertedCount = repo.syncLowStockAlerts(anchorKho.id(), output.items());
        } else {
            alertedCount = (int) output.items().stream()
                    .filter(it -> !it.isPrCreationLocked() && it.getReorderPoint() > 0 && it.getFtu() <= it.getReorderPoint())
                    .count();
        }
        if (output.summary() != null) {
            output.summary().setAlertedInCanhBaoCount(alertedCount);
        }

        // Khối 5: Đóng gói DssReplenishmentResponse (meta Kho tổng + phạm vi kho + 12 tham số + Summary + từng dòng SKU) trả ngược lên Controller -> FE
        return DssReplenishmentResponse.builder()
                .khoId(anchorKho.id())
                .tenKho(anchorKho.tenKho())
                .laKhoTong(anchorKho.laKhoTong())
                .scope(DssReplenishmentResponse.SCOPE_ALL_WAREHOUSES)
                .includedWarehouseCount(activeWarehouses.size())
                .includedWarehouses(activeWarehouses)
                .config(config)
                .summary(output.summary())
                .calculatedAt(Instant.now().toString())
                .items(output.items())
                .build();
    }

    private static KhoInfo resolveAnchorCentralWarehouse(List<KhoInfo> activeWarehouses, Integer requestedKhoId) {
        if (requestedKhoId != null) {
            for (KhoInfo k : activeWarehouses) {
                if (requestedKhoId.equals(k.id()) && k.laKhoTong()) {
                    return k;
                }
            }
        }
        for (KhoInfo k : activeWarehouses) {
            if (k.laKhoTong()) {
                return k;
            }
        }
        return activeWarehouses.get(0);
    }

    private static void addConfigUpdate(List<CauHinhHeThongBulkUpdateRequest> list, String key, Object val) {
        if (val == null) return;
        CauHinhHeThongBulkUpdateRequest req = new CauHinhHeThongBulkUpdateRequest();
        req.setMaCauHinh(key);
        req.setGiaTri(String.valueOf(val));
        list.add(req);
    }

    private Integer currentUserId() {
        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        return auth != null ? auth.getId() : null;
    }

    // Ghi Audit Log vào bảng `lich_su_thay_doi` mỗi khi người dùng chốt tính lại ROP & đồng bộ bảng `canh_bao`
    private void recordAuditLog(DssReplenishmentResponse response) {
        Integer userId = currentUserId();
        if (userId == null) return;
        try {
            NguoiDung user = nguoiDungRepository.findById(userId).orElse(null);
            if (user == null) return;
            DssSummaryDto s = response.getSummary();
            DssConfigDto c = response.getConfig();
            lichSuThayDoiService.create(LichSuThayDoi.builder()
                    .loaiThamChieu(ITable.canh_bao)
                    .idThamChieu(response.getKhoId() != null ? response.getKhoId() : 0)
                    .hanhDong(IHanhDong.chay_dss_nhap_hang)
                    .giaTriCu(null)
                    .giaTriMoi("{\"mode\":\"" + c.getMode()
                            + "\",\"preset\":\"" + c.getGlobalPresetCode()
                            + "\",\"needReorder\":" + (s != null ? s.getNeedReorderCount() : 0)
                            + ",\"alerted\":" + (s != null ? s.getAlertedInCanhBaoCount() : 0) + "}")
                    .nguoiThucHien(user)
                    .ngayThucHien(Instant.now())
                    .ghiChu("Tính lại gợi ý nhập hàng toàn hệ thống (" + response.getIncludedWarehouseCount() + " kho)")
                    .build());
        } catch (Exception e) {
            log.warn("[DSS] Không thể ghi lịch sử chạy DSS: {}", e.getMessage());
        }
    }
}
