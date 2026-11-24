package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.dss.DssConfigDto;
import com.dev.backend.dto.dss.DssRecommendationItemDto;
import com.dev.backend.dto.dss.DssReplenishmentResponse;
import com.dev.backend.dto.dss.DssSummaryDto;
import com.dev.backend.dto.response.HangNhapKhoTongResponse;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.BienThe;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.KhoTong;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.HangNhapKhoTongRepository;
import com.dev.backend.repository.TongQuanVaiTroRepository;
import com.dev.backend.services.impl.dss.DssPolicyEngine;
import com.dev.backend.services.impl.dss.DssReplenishmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Hàng nhập về Kho tổng (màn Tạo yêu cầu nhập hàng): kiểm tra ánh xạ 100% số liệu tồn, ROP, SS, số đề xuất Q
 * và các cờ cảnh báo từ {@link DssReplenishmentService}, kèm mã vạch và yêu cầu nhập đang mở.
 */
@ExtendWith(MockitoExtension.class)
class HangNhapKhoTongServiceTest {

    @Mock
    private HangNhapKhoTongRepository repo;
    @Mock
    private TongQuanVaiTroRepository vaiTro;
    @Mock
    private DssReplenishmentService dssReplenishmentService;

    private HangNhapKhoTongService service;

    private final KhoTong khoTong1 = new KhoTong(1, "KHO_TONG", "Kho tổng", "Hà Nội", "Quản lý A");
    private final KhoTong khoTong2 = new KhoTong(5, "KHO_TONG_2", "Kho tổng 2", null, null);

    @BeforeEach
    void setUp() {
        service = new HangNhapKhoTongService(repo, vaiTro, dssReplenishmentService);
    }

    private static DssConfigDto configMacDinh() {
        return DssConfigDto.builder()
                .mode(DssPolicyEngine.MODE_BY_ABC)
                .globalPresetCode(DssPolicyEngine.PRESET_STANDARD)
                .observationDaysN(14)
                .serviceLevelZ(2.33d)
                .cycleDaysT(14)
                .peakGrowthPercentG(30)
                .peakCampaignDays(14)
                .leanBufferDaysB(3)
                .phaseOutRemainingDays(15)
                .defaultLeadTimeAvg(5)
                .defaultLeadTimeMax(7)
                .leadTimeSampleM(10)
                .build();
    }

    private static DssRecommendationItemDto dssItem(
            int bienTheId,
            int sanPhamId,
            String tenSanPham,
            long ftu,
            long incoming,
            long rop,
            long ss,
            long q,
            boolean needsReorder,
            boolean daTungNhap) {
        return DssRecommendationItemDto.builder()
                .sanPhamId(sanPhamId)
                .bienTheSanPhamId(bienTheId)
                .maSanPham("SP" + sanPhamId)
                .maSku("SKU-" + bienTheId)
                .tenSanPham(tenSanPham)
                .tenMau("Đen")
                .maMauHex("#111111")
                .tenSize("M")
                .tenChatLieu("Cotton")
                .tenDanhMuc("Áo khoác")
                .ftu(ftu)
                .incoming(incoming)
                .reorderPoint(rop)
                .safetyStock(ss)
                .suggestedOrderQty(q)
                .needsReorder(needsReorder)
                .daTungNhap(daTungNhap)
                .abcClass("B")
                .urgencyLevel(needsReorder ? DssPolicyEngine.URGENCY_HIGH : DssPolicyEngine.URGENCY_NORMAL)
                .appliedPreset(DssPolicyEngine.PRESET_STANDARD)
                .avgDailyDemand(1.5d)
                .daysOfInventory(5.0d)
                .build();
    }

    @Test
    @DisplayName("soLuongDeXuatTheoDss: chỉ trả Q khi needsReorder = true và không khóa ngừng nhập")
    void soLuongDeXuatTheoDss_chiLayKhiNeedsReorderVaChuaKhoa() {
        assertEquals(0L, HangNhapKhoTongService.soLuongDeXuatTheoDss(null));

        DssRecommendationItemDto canNhap = dssItem(1, 10, "Áo", 5, 0, 10, 4, 25, true, true);
        assertEquals(25L, HangNhapKhoTongService.soLuongDeXuatTheoDss(canNhap));

        DssRecommendationItemDto chuaChamRopDuQDuong = dssItem(2, 10, "Áo", 35, 0, 32, 12, 18, false, true);
        assertEquals(0L, HangNhapKhoTongService.soLuongDeXuatTheoDss(chuaChamRopDuQDuong));

        DssRecommendationItemDto biKhoaNgungNhap = dssItem(3, 10, "Áo", 2, 0, 0, 0, 15, true, true);
        biKhoaNgungNhap.setPrCreationLocked(true);
        assertEquals(0L, HangNhapKhoTongService.soLuongDeXuatTheoDss(biKhoaNgungNhap));
    }

    @Test
    @DisplayName("canChuYDuHoacChamTheoDss: bật cờ khi tồn chậm, tồn dư hoặc khuyến nghị xả hàng")
    void canChuYDuHoacChamTheoDss_theoDungCoDss() {
        assertFalse(HangNhapKhoTongService.canChuYDuHoacChamTheoDss(null));

        DssRecommendationItemDto binhThuong = dssItem(1, 10, "Áo", 20, 0, 10, 4, 0, false, true);
        assertFalse(HangNhapKhoTongService.canChuYDuHoacChamTheoDss(binhThuong));

        DssRecommendationItemDto tonCham = dssItem(2, 10, "Áo", 1, 0, 0, 0, 0, false, true);
        tonCham.setDeadStock(true);
        assertTrue(HangNhapKhoTongService.canChuYDuHoacChamTheoDss(tonCham));

        DssRecommendationItemDto tonDu = dssItem(3, 10, "Áo", 50, 0, 0, 0, 0, false, true);
        tonDu.setExcessStock(20L);
        assertTrue(HangNhapKhoTongService.canChuYDuHoacChamTheoDss(tonDu));

        DssRecommendationItemDto flashSale = dssItem(4, 10, "Áo", 10, 0, 0, 0, 0, false, true);
        flashSale.setFlashSaleRecommended(true);
        assertTrue(HangNhapKhoTongService.canChuYDuHoacChamTheoDss(flashSale));
    }

    @Test
    @DisplayName("hangKhoTong: không truyền kho lấy Kho tổng đầu tiên và ánh xạ đủ chỉ số DSS")
    void hangKhoTong_khongTruyenKho_layKhoTongDauTien_vaAnhXa100PhanTramTuDss() {
        when(repo.khoTongHoatDong()).thenReturn(List.of(khoTong1, khoTong2));

        // 1) Chưa từng nhập kho (daTungNhap = false) nhưng DSS có nhu cầu -> vẫn đề xuất 15
        DssRecommendationItemDto chuaNhapNhungCan = dssItem(7, 100, "Áo polo", 0, 3, 12, 4, 15, true, false);
        chuaNhapNhungCan.setAbcClass("A");
        chuaNhapNhungCan.setUrgencyLevel(DssPolicyEngine.URGENCY_CRITICAL);
        chuaNhapNhungCan.setAppliedPreset(DssPolicyEngine.PRESET_PEAK);

        // 2) FTU > ROP dù Q tính ra > 0 -> needsReorder = false -> soLuongDeXuat = 0
        DssRecommendationItemDto chuaChamRop = dssItem(8, 101, "Quần kaki", 35, 0, 32, 12, 18, false, true);

        // 3) Tồn ít nhưng bán chậm (FTU = 1, ROP = 0, Q = 0, deadStock = true) -> đề xuất 0, không đề xuất gấp đôi ngưỡng 80
        DssRecommendationItemDto tonCham = dssItem(9, 102, "Áo gió tồn chậm", 1, 0, 0, 0, 0, false, true);
        tonCham.setDeadStock(true);
        tonCham.setFlashSaleRecommended(true);
        tonCham.setUrgencyLevel(DssPolicyEngine.URGENCY_EXCESS);

        // 4) Đang ở kịch bản Ngừng nhập & Xả hàng -> khóa tạo PR, có excessStock = 20
        DssRecommendationItemDto ngungNhap = dssItem(10, 103, "Áo len mùa cũ", 50, 0, 0, 0, 0, false, true);
        ngungNhap.setPrCreationLocked(true);
        ngungNhap.setExcessStock(20L);
        ngungNhap.setFlashSaleRecommended(true);
        ngungNhap.setAppliedPreset(DssPolicyEngine.PRESET_PHASE_OUT);
        ngungNhap.setUrgencyLevel(DssPolicyEngine.URGENCY_EXCESS);

        when(dssReplenishmentService.getRecommendations(1)).thenReturn(DssReplenishmentResponse.builder()
                .khoId(1)
                .tenKho("Kho tổng")
                .laKhoTong(true)
                .config(configMacDinh())
                .summary(DssSummaryDto.builder().totalSkus(4).needReorderCount(1).totalSuggestedQty(15).build())
                .items(List.of(ngungNhap, tonCham, chuaChamRop, chuaNhapNhungCan))
                .build());
        when(repo.maVachTheoBienThe(any())).thenReturn(Map.of(7, "893000000007"));
        when(vaiTro.yeuCauMoTheoBienThe(any())).thenReturn(
                Map.of(7, new TongQuanVaiTroRepository.YeuCauMo(31, "PR202610240031", 2)));

        HangNhapKhoTongResponse kq = service.hangKhoTong(null);

        assertEquals(khoTong1, kq.kho());
        assertEquals(2, kq.dsKhoTong().size());
        assertNotNull(kq.cauHinhDss());
        assertEquals(DssPolicyEngine.MODE_BY_ABC, kq.cauHinhDss().cheDo());
        assertEquals(14, kq.cauHinhDss().chuKyQuanSatN());
        assertEquals(2.33d, kq.cauHinhDss().heSoPhucVuZ());

        // Kiểm tra sắp xếp ổn định theo tenSanPham
        assertEquals(4, kq.bienThe().size());
        BienThe itGió = kq.bienThe().get(0); // "Áo gió tồn chậm"
        assertEquals(9, itGió.bienTheId());
        assertEquals(0L, itGió.soLuongDeXuat());
        assertEquals(0, itGió.nguong());
        assertTrue(itGió.tonCham());
        assertTrue(itGió.du());

        BienThe itLen = kq.bienThe().get(1); // "Áo len mùa cũ"
        assertEquals(10, itLen.bienTheId());
        assertTrue(itLen.khoaTaoYeuCau());
        assertEquals(20L, itLen.tonDuXaHang());
        assertTrue(itLen.goiYXaHang());
        assertEquals(0L, itLen.soLuongDeXuat());

        BienThe itPolo = kq.bienThe().get(2); // "Áo polo"
        assertEquals(7, itPolo.bienTheId());
        assertFalse(itPolo.daTungNhap());
        assertEquals("893000000007", itPolo.maVach());
        assertEquals(3L, itPolo.dangVe());
        assertEquals(12, itPolo.nguong());
        assertEquals(4L, itPolo.tonAnToan());
        assertEquals(15L, itPolo.soLuongDeXuat());
        assertFalse(itPolo.du());
        assertEquals("A", itPolo.phanLoaiAbc());
        assertEquals("CRITICAL", itPolo.mucDoKhanCap());
        assertEquals("PR202610240031", itPolo.yeuCauMo().ma());
        assertEquals(2, itPolo.yeuCauMo().soYeuCau());

        BienThe itQuan = kq.bienThe().get(3); // "Quần kaki"
        assertEquals(8, itQuan.bienTheId());
        assertEquals(0L, itQuan.soLuongDeXuat());
        assertFalse(itQuan.du());
    }

    @Test
    @DisplayName("hangKhoTong: chọn đúng Kho tổng khác khi truyền khoId")
    void hangKhoTong_chonKhoTongKhac() {
        when(repo.khoTongHoatDong()).thenReturn(List.of(khoTong1, khoTong2));
        when(dssReplenishmentService.getRecommendations(5)).thenReturn(DssReplenishmentResponse.builder()
                .khoId(5)
                .config(configMacDinh())
                .items(List.of())
                .build());
        when(repo.maVachTheoBienThe(any())).thenReturn(Map.of());
        when(vaiTro.yeuCauMoTheoBienThe(any())).thenReturn(Map.of());

        assertEquals(khoTong2, service.hangKhoTong(5).kho());
        verify(dssReplenishmentService).getRecommendations(5);
    }

    @Test
    @DisplayName("hangKhoTong: chặn kho không phải Kho tổng và không gọi DSS")
    void hangKhoTong_khoKhongPhaiKhoTong_biChan() {
        when(repo.khoTongHoatDong()).thenReturn(List.of(khoTong1));
        CommonException ex = assertThrows(CommonException.class, () -> service.hangKhoTong(2));
        assertTrue(ex.getMessage().contains("Kho tổng"));
        verifyNoInteractions(dssReplenishmentService);
    }

    @Test
    @DisplayName("hangKhoTong: chưa có Kho tổng đang hoạt động thì trả rỗng (không truyền kho) hoặc báo lỗi (có truyền kho)")
    void hangKhoTong_chuaCoKhoTong_xuLyDung() {
        when(repo.khoTongHoatDong()).thenReturn(List.of());

        HangNhapKhoTongResponse kq = service.hangKhoTong(null);
        assertNull(kq.kho());
        assertNull(kq.cauHinhDss());
        assertTrue(kq.bienThe().isEmpty());

        assertThrows(CommonException.class, () -> service.hangKhoTong(1));
        verifyNoInteractions(dssReplenishmentService);
        verifyNoInteractions(vaiTro);
    }
}
