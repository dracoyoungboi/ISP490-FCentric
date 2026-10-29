package com.dev.backend.services.impl.multitable;

import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.LoHang;
import com.dev.backend.entities.TonKhoTheoLo;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

/**
 * Số bán được tại quầy: danh sách lô đưa vào câu "phần đang giữ theo lô" (mệnh đề IN) chỉ gồm lô còn hàng (tồn − đã đặt
 * &gt; 0, đã đặt trống = 0) và được chia từng phần 500 lô. Kho 1, biến thể 93.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BanDuocTaiQuayLoInTest {

    private static final int KHO = 1, BT = 93;

    @Mock private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock private LoDangGiuService loDangGiuService;
    @Mock private GiuChoChuyenKhoService giuChoChuyenKhoService;

    private BanDuocTaiQuayService service;
    private BienTheSanPham bienThe;

    @BeforeEach
    void setUp() {
        service = new BanDuocTaiQuayService(tonKhoTheoLoRepository, loDangGiuService, giuChoChuyenKhoService);
        bienThe = BienTheSanPham.builder().id(BT).maSku("AK-93").build();
        when(giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(eq(KHO), any())).thenReturn(Map.of());
        when(loDangGiuService.dangGiuTheoLo(eq(KHO), anyCollection(), isNull(), isNull())).thenReturn(Map.of());
    }

    private TonKhoTheoLo lo(int loId, String ton, String daDat) {
        return TonKhoTheoLo.builder().loHang(LoHang.builder().id(loId).bienTheSanPham(bienThe).build())
                .soLuongTon(new BigDecimal(ton)).soLuongDaDat(daDat == null ? null : new BigDecimal(daDat)).build();
    }

    private static void assertSo(String mong, BigDecimal thuc) {
        assertNotNull(thuc);
        assertEquals(0, new BigDecimal(mong).compareTo(thuc), "mong " + mong + " nhưng là " + thuc);
    }

    @Test
    @DisplayName("Lô tồn − đặt ≤ 0 không đưa vào IN (đằng nào cũng ra 0); đã đặt trống tính 0 nên lô đó vẫn còn hàng")
    void boLoHetHangKhoiMenhDeIn() {
        when(tonKhoTheoLoRepository.findByKhoAndBienTheIds(eq(KHO), anyCollection())).thenReturn(List.of(
                lo(5, "4", "0"),     // còn 4
                lo(6, "3", "3"),     // đã đặt hết → bỏ
                lo(7, "2", "5"),     // âm (dữ liệu lệch) → bỏ
                lo(8, "2", null)));  // đã đặt trống = 0 → còn 2
        when(loDangGiuService.dangGiuTheoLo(eq(KHO), anyCollection(), isNull(), isNull())).thenReturn(Map.of(5, new BigDecimal("1")));

        Map<Integer, BigDecimal> kq = service.banDuocTaiQuay(KHO, List.of(BT));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<Integer>> loIn = ArgumentCaptor.forClass(Collection.class);
        verify(loDangGiuService).dangGiuTheoLo(eq(KHO), loIn.capture(), isNull(), isNull());
        assertEquals(Set.of(5, 8), new HashSet<>(loIn.getValue()));
        assertSo("5", kq.get(BT)); // (4 − 1) + 0 + 0 + 2
    }

    @Test
    @DisplayName("Không lô nào còn hàng → không hỏi phần đang giữ, bán được 0")
    void khongLoConHang_khongTruyVan() {
        when(tonKhoTheoLoRepository.findByKhoAndBienTheIds(eq(KHO), anyCollection())).thenReturn(List.of(lo(6, "3", "3")));

        assertSo("0", service.banDuocTaiQuay(KHO, List.of(BT)).get(BT));
        verify(loDangGiuService, never()).dangGiuTheoLo(any(), any(), any(), any());
    }

    @Test
    @DisplayName("Danh sách lô dài (1 200 lô còn hàng) → hỏi phần đang giữ thành 3 phần ≤ 500 lô, gộp kết quả")
    void danhSachLoDai_chiaTungPhan500() {
        List<TonKhoTheoLo> ton = new ArrayList<>();
        for (int i = 1; i <= 1200; i++) ton.add(lo(i, "1", "0"));
        when(tonKhoTheoLoRepository.findByKhoAndBienTheIds(eq(KHO), anyCollection())).thenReturn(ton);
        // mỗi phần trả phần giữ của lô đầu tiên trong phần đó: 1, 501, 1001 bị giữ hết
        when(loDangGiuService.dangGiuTheoLo(eq(KHO), anyCollection(), isNull(), isNull())).thenAnswer(i -> {
            Collection<Integer> ids = i.getArgument(1);
            return Map.of(ids.iterator().next(), BigDecimal.ONE);
        });

        Map<Integer, BigDecimal> kq = service.banDuocTaiQuay(KHO, List.of(BT));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<Integer>> loIn = ArgumentCaptor.forClass(Collection.class);
        verify(loDangGiuService, times(3)).dangGiuTheoLo(eq(KHO), loIn.capture(), isNull(), isNull());
        assertEquals(List.of(500, 500, 200), loIn.getAllValues().stream().map(Collection::size).toList());
        Set<Integer> tatCa = new HashSet<>();
        loIn.getAllValues().forEach(tatCa::addAll);
        assertEquals(1200, tatCa.size());
        assertSo("1197", kq.get(BT));
    }
}
