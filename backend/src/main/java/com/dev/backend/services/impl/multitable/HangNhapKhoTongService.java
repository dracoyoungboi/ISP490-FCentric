package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.dss.DssConfigDto;
import com.dev.backend.dto.dss.DssRecommendationItemDto;
import com.dev.backend.dto.dss.DssReplenishmentResponse;
import com.dev.backend.dto.response.HangNhapKhoTongResponse;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.BienThe;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.CauHinhDss;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.KhoTong;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.YeuCauMo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.HangNhapKhoTongRepository;
import com.dev.backend.repository.TongQuanVaiTroRepository;
import com.dev.backend.services.impl.dss.DssReplenishmentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Collator;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Hàng nhập về Kho tổng cho màn Tạo yêu cầu nhập hàng: lấy trực tiếp 100% số liệu tồn khả dụng, hàng đang về,
 * điểm đặt hàng lại (ROP), tồn an toàn (SS), số lượng đề xuất đặt (Q) và trạng thái bán chậm / xả hàng / ngừng nhập
 * từ {@link DssReplenishmentService} (tính tổng trên toàn bộ kho đang hoạt động), ghép thêm mã vạch quét tay
 * và danh sách yêu cầu nhập hàng đang mở. Chứng từ yêu cầu nhập hàng vẫn nhận về {@code Kho tổng}.
 */
@Service
public class HangNhapKhoTongService {

    private final HangNhapKhoTongRepository repo;
    private final TongQuanVaiTroRepository vaiTro;
    private final DssReplenishmentService dssReplenishmentService;

    public HangNhapKhoTongService(
            HangNhapKhoTongRepository repo,
            TongQuanVaiTroRepository vaiTro,
            DssReplenishmentService dssReplenishmentService) {
        this.repo = repo;
        this.vaiTro = vaiTro;
        this.dssReplenishmentService = dssReplenishmentService;
    }

    /**
     * @param khoId Kho tổng cần xem; null thì lấy Kho tổng đầu tiên. Không phải Kho tổng đang hoạt động thì báo lỗi.
     */
    @Transactional(readOnly = true)
    public HangNhapKhoTongResponse hangKhoTong(Integer khoId) {
        List<KhoTong> dsKhoTong = repo.khoTongHoatDong();
        if (dsKhoTong.isEmpty()) {
            if (khoId != null) throw new CommonException(ThongDiep.of("khoVanHanh.chuaCoKhoTongNhanHang"));
            return new HangNhapKhoTongResponse(null, List.of(), null, List.of());
        }
        KhoTong kho = khoId == null
                ? dsKhoTong.get(0)
                : dsKhoTong.stream().filter(k -> khoId.equals(k.id())).findFirst().orElseThrow(() -> new CommonException(
                        ThongDiep.of("khoVanHanh.khoNhanPhaiLaKhoTong")));

        DssReplenishmentResponse dss = dssReplenishmentService.getRecommendations(kho.id());
        List<DssRecommendationItemDto> dssItems = (dss != null && dss.getItems() != null)
                ? dss.getItems()
                : List.of();
        CauHinhDss cauHinhDss = (dss != null && dss.getConfig() != null)
                ? toCauHinhDss(dss.getConfig())
                : null;

        List<Integer> ids = dssItems.stream()
                .map(DssRecommendationItemDto::getBienTheSanPhamId)
                .filter(Objects::nonNull)
                .toList();
        Map<Integer, String> maVach = repo.maVachTheoBienThe(ids);
        Map<Integer, TongQuanVaiTroRepository.YeuCauMo> yeuCau = vaiTro.yeuCauMoTheoBienThe(ids);

        Collator viCollator = Collator.getInstance(Locale.forLanguageTag("vi-VN"));
        viCollator.setStrength(Collator.SECONDARY);

        List<BienThe> bienThe = dssItems.stream()
                .map(it -> {
                    Integer bienTheId = it.getBienTheSanPhamId();
                    TongQuanVaiTroRepository.YeuCauMo yc = bienTheId != null ? yeuCau.get(bienTheId) : null;
                    int rop = (int) Math.min(Integer.MAX_VALUE, Math.max(0L, it.getReorderPoint()));
                    return new BienThe(
                            bienTheId,
                            it.getMaSku(),
                            bienTheId != null ? maVach.get(bienTheId) : null,
                            it.getSanPhamId(),
                            it.getMaSanPham(),
                            it.getTenSanPham(),
                            it.getTenDanhMuc(),
                            it.getTenMau(),
                            it.getMaMauHex(),
                            it.getTenSize(),
                            it.getTenChatLieu(),
                            it.getAnh(),
                            it.getFtu(),
                            it.getIncoming(),
                            rop,
                            it.isDaTungNhap(),
                            soLuongDeXuatTheoDss(it),
                            canChuYDuHoacChamTheoDss(it),
                            yc == null ? null : new YeuCauMo(yc.id(), yc.ma(), yc.soYeuCau()),
                            it.getSafetyStock(),
                            it.getExcessStock(),
                            it.isFlashSaleRecommended(),
                            it.isDeadStock(),
                            it.isPrCreationLocked(),
                            it.getAbcClass(),
                            it.getUrgencyLevel(),
                            it.getAppliedPreset(),
                            it.getDaysOfInventory(),
                            it.getAvgDailyDemand());
                })
                .sorted(Comparator
                        .comparing((BienThe b) -> b.tenSanPham() == null ? "" : b.tenSanPham(), viCollator)
                        .thenComparing(b -> b.sanPhamId() == null ? 0 : b.sanPhamId())
                        .thenComparing(b -> b.bienTheId() == null ? 0 : b.bienTheId()))
                .toList();

        return new HangNhapKhoTongResponse(kho, dsKhoTong, cauHinhDss, bienThe);
    }

    /** Chỉ lấy số lượng đề xuất Q của DSS khi biến thể cần nhập lại (FTU <= ROP, Q > 0) và chưa bị khóa ngừng nhập. */
    static long soLuongDeXuatTheoDss(DssRecommendationItemDto it) {
        if (it == null || it.isPrCreationLocked() || !it.isNeedsReorder()) return 0L;
        return Math.max(0L, it.getSuggestedOrderQty());
    }

    /** Cờ cần chú ý theo DSS: hàng bán chậm 30 ngày, có tồn dư cần xả hoặc được khuyến nghị xả hàng. */
    static boolean canChuYDuHoacChamTheoDss(DssRecommendationItemDto it) {
        return it != null && (it.isDeadStock() || it.getExcessStock() > 0L || it.isFlashSaleRecommended());
    }

    private static CauHinhDss toCauHinhDss(DssConfigDto cfg) {
        return new CauHinhDss(
                cfg.getMode(),
                cfg.getGlobalPresetCode(),
                cfg.getObservationDaysN(),
                cfg.getServiceLevelZ(),
                cfg.getCycleDaysT(),
                cfg.getPeakGrowthPercentG(),
                cfg.getPeakCampaignDays(),
                cfg.getLeanBufferDaysB(),
                cfg.getPhaseOutRemainingDays());
    }
}
