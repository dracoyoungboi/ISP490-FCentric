package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.enums.KieuDuLieuCauHinh;
import com.dev.backend.dto.request.KenhCauHinhDongBoRequest;
import com.dev.backend.dto.response.customize.KenhCauHinhDongBoDto;
import com.dev.backend.entities.CauHinhHeThong;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.CauHinhHeThongRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KenhCauHinhDongBoServiceTest {

    @Mock private CauHinhHeThongRepository cauHinhHeThongRepository;
    @Mock private KenhBanHangRepository kenhBanHangRepository;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private NguoiDungRepository nguoiDungRepository;

    private KenhCauHinhDongBoService service;
    /** Bảng cau_hinh_he_thong giả lập trong bộ nhớ */
    private final Map<String, CauHinhHeThong> bang = new HashMap<>();

    @BeforeEach
    void setUp() {
        service = new KenhCauHinhDongBoService(cauHinhHeThongRepository, kenhBanHangRepository,
                dieuHanhHeThongService, lichSuThayDoiService, nguoiDungRepository);
        when(cauHinhHeThongRepository.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(bang.get(inv.<String>getArgument(0))));
        when(cauHinhHeThongRepository.existsById(anyString())).thenAnswer(inv -> bang.containsKey(inv.<String>getArgument(0)));
        when(cauHinhHeThongRepository.save(any(CauHinhHeThong.class))).thenAnswer(inv -> {
            CauHinhHeThong c = inv.getArgument(0);
            bang.put(c.getMaCauHinh(), c);
            return c;
        });
        when(dieuHanhHeThongService.getCauHinhString(anyString(), any())).thenAnswer(inv -> {
            CauHinhHeThong c = bang.get(inv.<String>getArgument(0));
            return c != null ? c.getGiaTri() : inv.getArgument(1);
        });
        when(kenhBanHangRepository.findByMaKenh(anyString())).thenReturn(Optional.empty());
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY"))
                .thenReturn(Optional.of(KenhBanHang.builder().id(1).maKenh("SHOPIFY").trangThai(1).build()));
        when(dieuHanhHeThongService.getCauHinhInt("OMNI_SYNC_INTERVAL_MINS", 10)).thenReturn(10);
        when(dieuHanhHeThongService.getCauHinhInt("REALTIME_SYNC_THRESHOLD", 3)).thenReturn(3);
    }

    @Test
    void layCauHinh_chuaLuu_traVeMacDinh() {
        KenhCauHinhDongBoDto dto = service.layCauHinh("shopify");

        assertEquals("SHOPIFY", dto.getMaKenh());
        assertTrue(dto.isTuDongDayTon());
        assertTrue(dto.isTuDongLayDon());
        assertEquals(100, dto.getTyLeDayTon());
        assertEquals(0, dto.getTonDem());
        assertEquals(0, dto.getNguongVe0());
        assertEquals(10, dto.getChuKyPhut());
        assertEquals(3, dto.getNguongDayNgay());
        assertFalse(dto.isDaLuu());
        assertFalse(dto.isDaLuuTonKho());
        assertFalse(dto.isDaLuuDonHang());
        verify(cauHinhHeThongRepository, never()).save(any());
    }

    @Test
    void luuCauHinh_chiGhiTruongCoGiaTri() {
        KenhCauHinhDongBoDto dto = service.luuCauHinh("SHOPIFY", KenhCauHinhDongBoRequest.builder()
                .tuDongDayTon(false)
                .tyLeDayTon(80)
                .build());

        assertFalse(dto.isTuDongDayTon());
        assertTrue(dto.isTuDongLayDon());
        assertEquals(80, dto.getTyLeDayTon());
        assertTrue(dto.isDaLuu());
        assertTrue(dto.isDaLuuTonKho());
        assertFalse(dto.isDaLuuDonHang());
        assertEquals(2, bang.size());
        CauHinhHeThong tuDong = bang.get("KENH_SHOPIFY_TU_DONG_DAY_TON");
        assertEquals("false", tuDong.getGiaTri());
        assertEquals(KieuDuLieuCauHinh.BOOLEAN, tuDong.getKieuDuLieu());
        assertEquals(KieuDuLieuCauHinh.INT, bang.get("KENH_SHOPIFY_TY_LE_DAY_TON").getKieuDuLieu());
        assertNull(bang.get("KENH_SHOPIFY_TU_DONG_LAY_DON"));
    }

    @Test
    void luuCauHinh_giaTriKhongDoi_khongGhiLai() {
        service.luuCauHinh("SHOPIFY", KenhCauHinhDongBoRequest.builder().tonDem(2).build());
        clearInvocations(cauHinhHeThongRepository);

        service.luuCauHinh("SHOPIFY", KenhCauHinhDongBoRequest.builder().tonDem(2).build());

        ArgumentCaptor<CauHinhHeThong> captor = ArgumentCaptor.forClass(CauHinhHeThong.class);
        verify(cauHinhHeThongRepository, never()).save(captor.capture());
        assertEquals(List.of(), captor.getAllValues());
    }

    @Test
    void luuCauHinh_ngoaiKhoang_baoLoiVaKhongGhi() {
        assertThrows(CommonException.class, () -> service.luuCauHinh("SHOPIFY",
                KenhCauHinhDongBoRequest.builder().tyLeDayTon(0).build()));
        assertThrows(CommonException.class, () -> service.luuCauHinh("SHOPIFY",
                KenhCauHinhDongBoRequest.builder().tonDem(-1).build()));
        assertThrows(CommonException.class, () -> service.luuCauHinh("SHOPIFY",
                KenhCauHinhDongBoRequest.builder().nguongVe0(100_001).build()));
        verify(cauHinhHeThongRepository, never()).save(any());
    }

    @Test
    void luuCauHinh_chiPhanDonHang_danhDauDaLuuDonHang() {
        KenhCauHinhDongBoDto dto = service.luuCauHinh("SHOPIFY", KenhCauHinhDongBoRequest.builder().tuDongLayDon(true).build());

        assertTrue(dto.isDaLuuDonHang());
        assertFalse(dto.isDaLuuTonKho());
        assertEquals("true", bang.get("KENH_SHOPIFY_TU_DONG_LAY_DON").getGiaTri());
    }

    @Test
    void luuCauHinh_kenhKhongTonTai_bao404VaKhongGhi() {
        CommonException ex = assertThrows(CommonException.class, () -> service.luuCauHinh("LAZADA",
                KenhCauHinhDongBoRequest.builder().tuDongDayTon(true).build()));
        assertEquals(org.springframework.http.HttpStatus.NOT_FOUND, ex.getHttpStatus());
        verify(cauHinhHeThongRepository, never()).save(any());
    }

    @Test
    void layCauHinh_kenhChuaCo_vanTraMacDinh() {
        KenhCauHinhDongBoDto dto = service.layCauHinh("LAZADA");
        assertTrue(dto.isTuDongDayTon());
        assertEquals(100, dto.getTyLeDayTon());
    }

    @Test
    void maKenhKhongHopLe_baoLoi() {
        assertThrows(CommonException.class, () -> service.layCauHinh("shop ify;drop"));
        assertThrows(CommonException.class, () -> service.layCauHinh(" "));
    }
}
