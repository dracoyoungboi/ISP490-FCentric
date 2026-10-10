package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.response.customize.DayTonResultDto;
import com.dev.backend.dto.response.customize.DongBoTongQuanDto;
import com.dev.backend.dto.response.customize.TuDongLienKetResultDto;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KenhBanHangDongBoServiceTest {

    @Mock
    private KenhBanHangRepository kenhBanHangRepository;
    @Mock
    private TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    @Mock
    private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock
    private KenhBanHangService kenhBanHangService;
    @Mock
    private LichSuThayDoiService lichSuThayDoiService;
    @Mock
    private NguoiDungRepository nguoiDungRepository;

    private KenhBanHangDongBoServiceImpl service;

    private KenhBanHang shopifyKenh;
    private BienTheSanPham bienThe1;
    private TrangThaiDongBoSanPham mapping1;

    @BeforeEach
    void setUp() {
        service = new KenhBanHangDongBoServiceImpl(
                kenhBanHangRepository,
                trangThaiDongBoSanPhamRepository,
                bienTheSanPhamRepository,
                tonKhoTheoLoRepository,
                kenhBanHangService,
                lichSuThayDoiService,
                nguoiDungRepository
        );

        shopifyKenh = KenhBanHang.builder()
                .id(1)
                .maKenh("SHOPIFY")
                .tenKenh("Cửa hàng Shopify")
                .apiUrl("https://fcentric-store.myshopify.com/admin/api/2024-01")
                .apiKey("shpat_token")
                .trangThai(1)
                .build();

        SanPhamQuanAo sp = SanPhamQuanAo.builder()
                .id(10)
                .tenSanPham("Áo Polo FCentric")
                .build();

        bienThe1 = BienTheSanPham.builder()
                .id(101)
                .sanPham(sp)
                .maSku("POLO-BLK-M")
                .giaBan(BigDecimal.valueOf(250000))
                .trangThai(1)
                .build();

        mapping1 = TrangThaiDongBoSanPham.builder()
                .id(1)
                .kenhBanHang(shopifyKenh)
                .bienTheSanPham(bienThe1)
                .maSanPhamKenh("48123456789")
                .trangThaiDongBo("thanh_cong")
                .ngayDongBoCuoi(Instant.now())
                .build();

        when(kenhBanHangRepository.findByMaKenh("SHOPIFY")).thenReturn(Optional.of(shopifyKenh));
        when(trangThaiDongBoSanPhamRepository.save(any(TrangThaiDongBoSanPham.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void tuDongLienKet_thanhCong() {
        when(bienTheSanPhamRepository.findByTrangThai(1)).thenReturn(List.of(bienThe1));
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(1, 101)).thenReturn(Optional.empty());

        TuDongLienKetResultDto result = service.tuDongLienKet("SHOPIFY");

        assertNotNull(result);
        assertEquals(1, result.getSoDaGhep());
        verify(trangThaiDongBoSanPhamRepository).save(any(TrangThaiDongBoSanPham.class));
    }

    @Test
    void filterLienKet_traVePageDto() {
        Page<TrangThaiDongBoSanPham> page = new PageImpl<>(List.of(mapping1));
        when(trangThaiDongBoSanPhamRepository.filterByKenh(eq(1), any(), any(), any())).thenReturn(page);
        List<Object[]> mockStock = new java.util.ArrayList<>();
        mockStock.add(new Object[]{101, BigDecimal.valueOf(15)});
        when(tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(any(), any()))
                .thenReturn(mockStock);

        Page<LienKetSanPhamDto> dtos = service.filterLienKet("SHOPIFY", null, null, PageRequest.of(0, 10));

        assertNotNull(dtos);
        assertEquals(1, dtos.getTotalElements());
        LienKetSanPhamDto dto = dtos.getContent().get(0);
        assertEquals("POLO-BLK-M", dto.getMaSku());
        assertEquals("da_lien_ket", dto.getTrangThaiLienKet());
        assertEquals(BigDecimal.valueOf(15), dto.getSoLuongKhaDung());
    }

    @Test
    void capNhatLienKet_thanhCong() {
        when(trangThaiDongBoSanPhamRepository.findById(1)).thenReturn(Optional.of(mapping1));
        when(bienTheSanPhamRepository.findById(101)).thenReturn(Optional.of(bienThe1));

        CapNhatLienKetRequest req = CapNhatLienKetRequest.builder()
                .bienTheSanPhamId(101)
                .choPhepDongBo(true)
                .build();

        LienKetSanPhamDto dto = service.capNhatLienKet(1, req);

        assertNotNull(dto);
        assertEquals("da_lien_ket", dto.getTrangThaiLienKet());
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
    }

    @Test
    void dayTonKhoLenKenh_apDungCongThucTonKhaDung() {
        when(trangThaiDongBoSanPhamRepository.findByKenhBanHangId(1)).thenReturn(List.of(mapping1));
        // Tồn khả dụng = 20
        List<Object[]> mockStock2 = new java.util.ArrayList<>();
        mockStock2.add(new Object[]{101, BigDecimal.valueOf(20)});
        when(tonKhoTheoLoRepository.sumSoLuongKhaDungByKhoAndBienTheIds(any(), eq(List.of(101))))
                .thenReturn(mockStock2);

        DayTonKenhRequest req = DayTonKenhRequest.builder()
                .khoId(1)
                .tyLeDayTon(BigDecimal.valueOf(100))
                .tonDem(2) // 20 - 2 = 18
                .nguongVe0(1)
                .build();

        DayTonResultDto result = service.dayTonKhoLenKenh("SHOPIFY", req);

        assertNotNull(result);
        assertEquals(1, result.getSoDong());
        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
    }

    @Test
    void dayTonKhoKhanCap_kichHoatChoSKUDuoi3Units() {
        when(trangThaiDongBoSanPhamRepository.findByBienTheSanPhamId(101)).thenReturn(List.of(mapping1));

        service.dayTonKhoKhanCap(101);

        verify(trangThaiDongBoSanPhamRepository).save(mapping1);
    }

    @Test
    void getTongQuan_traVeKpiChuan() {
        when(trangThaiDongBoSanPhamRepository.countByKenhBanHangId(1)).thenReturn(100L);
        when(trangThaiDongBoSanPhamRepository.countByKenhBanHangIdAndTrangThaiDongBo(1, "thanh_cong")).thenReturn(90L);
        when(trangThaiDongBoSanPhamRepository.countByKenhBanHangIdAndTrangThaiDongBo(1, "that_bai")).thenReturn(2L);

        DongBoTongQuanDto kpi = service.getTongQuan("SHOPIFY");

        assertNotNull(kpi);
        assertEquals(100L, kpi.getTongSkuSan());
        assertEquals(90L, kpi.getDaLienKet());
        assertEquals(8L, kpi.getChuaLienKet());
        assertEquals(2L, kpi.getLoiDongBo());
    }
}

