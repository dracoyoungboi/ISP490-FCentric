package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.customize.KenhThongKeDonDto;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KenhThongKeDonServiceTest {

    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private KenhBanHangRepository kenhBanHangRepository;

    private KenhThongKeDonService service;

    @BeforeEach
    void setUp() {
        // 15/10/2026 10:00 giờ Việt Nam
        Clock clock = Clock.fixed(Instant.parse("2026-10-15T03:00:00Z"), ZoneOffset.UTC);
        service = new KenhThongKeDonService(donBanHangRepository, kenhBanHangRepository, clock);
        when(kenhBanHangRepository.findByMaKenh(anyString())).thenReturn(Optional.empty());
        when(kenhBanHangRepository.findByMaKenh("SHOPIFY"))
                .thenReturn(Optional.of(KenhBanHang.builder().id(7).maKenh("SHOPIFY").trangThai(1).build()));
        when(donBanHangRepository.layDonKenhTrongKhoang(any(), any(), any())).thenReturn(List.of());
        when(donBanHangRepository.demDonKenhTheoTrangThai(any())).thenReturn(List.of());
    }

    private static Object[] don(String luc, int trangThai, long tien) {
        return new Object[]{Instant.parse(luc), trangThai, BigDecimal.valueOf(tien)};
    }

    @Test
    void macDinh30NgayDenHomNay_dienDuNgayTrong() {
        KenhThongKeDonDto dto = service.thongKe("shopify", null, null);

        assertEquals("SHOPIFY", dto.getMaKenh());
        assertEquals("2026-09-16", dto.getTu());
        assertEquals("2026-10-15", dto.getDen());
        assertEquals(30, dto.getTheoNgay().size());
        assertEquals(0, dto.getTongDon());
        assertEquals(0.0, dto.getTyLeHuy());
        assertEquals(0, BigDecimal.ZERO.compareTo(dto.getDoanhSo()));

        ArgumentCaptor<Instant> tu = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> den = ArgumentCaptor.forClass(Instant.class);
        verify(donBanHangRepository).layDonKenhTrongKhoang(eq(7), tu.capture(), den.capture());
        // 00:00 ngày 16/09 giờ VN = 17:00 ngày 15/09 UTC; mốc cuối là 00:00 ngày 16/10 giờ VN
        assertEquals(Instant.parse("2026-09-15T17:00:00Z"), tu.getValue());
        assertEquals(Instant.parse("2026-10-15T17:00:00Z"), den.getValue());
    }

    @Test
    void tinhTongDoanhSoDonHuyVaGomTheoNgayGioVietNam() {
        List<Object[]> dong = new ArrayList<>();
        dong.add(don("2026-10-14T18:30:00Z", 0, 200_000));   // 01:30 ngày 15/10 giờ VN
        dong.add(don("2026-10-15T02:00:00Z", 5, 300_000));   // 09:00 ngày 15/10
        dong.add(don("2026-10-13T05:00:00Z", 4, 999_000));   // đơn hủy ngày 13/10
        when(donBanHangRepository.layDonKenhTrongKhoang(any(), any(), any())).thenReturn(dong);
        List<Object[]> trangThai = new ArrayList<>();
        trangThai.add(new Object[]{0, 3L});
        trangThai.add(new Object[]{1, 2L});
        when(donBanHangRepository.demDonKenhTheoTrangThai(7)).thenReturn(trangThai);

        KenhThongKeDonDto dto = service.thongKe("SHOPIFY", "2026-10-13", "2026-10-15");

        assertEquals(3, dto.getTheoNgay().size());
        assertEquals(3, dto.getTongDon());
        assertEquals(1, dto.getDonHuy());
        assertEquals(33.3, dto.getTyLeHuy());
        assertEquals(0, BigDecimal.valueOf(500_000).compareTo(dto.getDoanhSo()));
        KenhThongKeDonDto.Ngay ngay13 = dto.getTheoNgay().get(0);
        assertEquals("2026-10-13", ngay13.getNgay());
        assertEquals(1, ngay13.getSoHuy());
        assertEquals(0, BigDecimal.ZERO.compareTo(ngay13.getDoanhSo()));
        KenhThongKeDonDto.Ngay ngay15 = dto.getTheoNgay().get(2);
        assertEquals(2, ngay15.getSoDon());
        assertEquals(0, BigDecimal.valueOf(500_000).compareTo(ngay15.getDoanhSo()));
        assertEquals(3L, dto.getTheoTrangThai().get(0));
        assertEquals(2L, dto.getTheoTrangThai().get(1));
    }

    @Test
    void khoangSaiHoacQuaDai_bao400() {
        CommonException nguoc = assertThrows(CommonException.class, () -> service.thongKe("SHOPIFY", "2026-10-15", "2026-10-01"));
        assertEquals(HttpStatus.BAD_REQUEST, nguoc.getHttpStatus());
        CommonException dai = assertThrows(CommonException.class, () -> service.thongKe("SHOPIFY", "2026-01-01", "2026-10-15"));
        assertEquals(HttpStatus.BAD_REQUEST, dai.getHttpStatus());
        CommonException sai = assertThrows(CommonException.class, () -> service.thongKe("SHOPIFY", "15/10/2026", null));
        assertEquals(HttpStatus.BAD_REQUEST, sai.getHttpStatus());
        verify(donBanHangRepository, never()).layDonKenhTrongKhoang(any(), any(), any());
    }

    @Test
    void kenhKhongTonTai_bao404_maKenhSai_bao400() {
        CommonException khongCo = assertThrows(CommonException.class, () -> service.thongKe("LAZADA", null, null));
        assertEquals(HttpStatus.NOT_FOUND, khongCo.getHttpStatus());
        CommonException sai = assertThrows(CommonException.class, () -> service.thongKe("shop;drop", null, null));
        assertEquals(HttpStatus.BAD_REQUEST, sai.getHttpStatus());
    }
}
