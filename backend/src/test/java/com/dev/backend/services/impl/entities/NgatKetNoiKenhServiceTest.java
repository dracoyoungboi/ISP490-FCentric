package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.customize.DongBoNgayDto;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NgatKetNoiKenhServiceTest {

    @Mock
    private KenhBanHangService kenhBanHangService;
    @Mock
    private KenhBanHangDongBoService kenhBanHangDongBoService;
    @Mock
    private DongBoNgayService dongBoNgayService;

    private NgatKetNoiKenhService service;
    /** true khi đang ở trong khóa đẩy tồn của kênh (giả lập chayKhiKenhRanh) */
    private final AtomicBoolean dangGiuKhoa = new AtomicBoolean();

    private static ShopifyConfigResponse ketNoi(String trangThai) {
        return ShopifyConfigResponse.builder().maKenh("SHOPIFY").kieuKetNoi("khoa").trangThaiKetNoi(trangThai).build();
    }

    @BeforeEach
    void setUp() {
        service = new NgatKetNoiKenhService(kenhBanHangService, kenhBanHangDongBoService, dongBoNgayService);
        when(kenhBanHangService.coKhoaShopify()).thenReturn(true);
        when(kenhBanHangService.getShopifyConfig()).thenReturn(ketNoi("chua_ket_noi"));
        when(kenhBanHangDongBoService.chayKhiKenhRanh(eq("SHOPIFY"), any())).thenAnswer(inv -> {
            dangGiuKhoa.set(true);
            try {
                ((Runnable) inv.getArgument(1)).run();
                return true;
            } finally {
                dangGiuKhoa.set(false);
            }
        });
    }

    @Test
    void ngatKetNoi_thanhCong_xoaKhoaTrongKhoaDayTonRoiQuenMocLanChay() {
        doAnswer(inv -> {
            assertTrue(dangGiuKhoa.get(), "phải xóa khóa khi đang giữ khóa đẩy tồn");
            return null;
        }).when(kenhBanHangService).xoaKhoaShopify();

        ShopifyConfigResponse res = service.ngatKetNoi("shopify");

        assertEquals("chua_ket_noi", res.getTrangThaiKetNoi());
        verify(kenhBanHangService).kiemTraSanShopify("shopify");
        verify(kenhBanHangService).xoaKhoaShopify();
        verify(kenhBanHangDongBoService).xoaMocLanChay("SHOPIFY");
    }

    @Test
    void ngatKetNoi_daNgatRoi_khongLamGi() {
        when(kenhBanHangService.coKhoaShopify()).thenReturn(false);

        assertEquals("chua_ket_noi", service.ngatKetNoi("SHOPIFY").getTrangThaiKetNoi());

        verify(kenhBanHangDongBoService, never()).chayKhiKenhRanh(any(), any());
        verify(kenhBanHangService, never()).xoaKhoaShopify();
    }

    @Test
    void ngatKetNoi_sanKhac_baoKhongHoTro() {
        doThrow(new LoiCoMaException(HttpStatus.BAD_REQUEST, MaLoi.SAN_KHONG_HO_TRO, "Máy chủ chưa hỗ trợ kết nối Lazada."))
                .when(kenhBanHangService).kiemTraSanShopify("LAZADA");

        assertEquals(MaLoi.SAN_KHONG_HO_TRO, assertThrows(LoiCoMaException.class, () -> service.ngatKetNoi("LAZADA")).getMa());
        verify(kenhBanHangService, never()).xoaKhoaShopify();
    }

    @Test
    void ngatKetNoi_khoaDayTonDangBan_bao409KhongXoa() {
        when(kenhBanHangDongBoService.chayKhiKenhRanh(eq("SHOPIFY"), any())).thenReturn(false);

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.ngatKetNoi("SHOPIFY"));

        assertEquals(MaLoi.DANG_DONG_BO, loi.getMa());
        assertEquals(HttpStatus.CONFLICT, loi.getStatus());
        assertFalse(loi.getMessage().contains("bị khóa"));
        verify(kenhBanHangService, never()).xoaKhoaShopify();
        verify(kenhBanHangDongBoService, never()).xoaMocLanChay(any());
    }

    @Test
    void ngatKetNoi_dongBoNgayDangChay_kiemSauKhiGiuKhoa_bao409KhongXoa() {
        when(dongBoNgayService.hienTai("SHOPIFY")).thenAnswer(inv -> {
            assertTrue(dangGiuKhoa.get(), "phải kiểm Đồng bộ ngay sau khi đã giữ khóa đẩy tồn");
            return DongBoNgayDto.builder().maKenh("SHOPIFY").trangThai(DongBoNgayService.DANG_CHAY).build();
        });

        LoiCoMaException loi = assertThrows(LoiCoMaException.class, () -> service.ngatKetNoi("SHOPIFY"));

        assertEquals(MaLoi.DANG_DONG_BO, loi.getMa());
        verify(kenhBanHangService, never()).xoaKhoaShopify();
        // Khóa đẩy tồn đã được thả (chayKhiKenhRanh thả trong finally)
        assertFalse(dangGiuKhoa.get());
    }

    @Test
    void ngatKetNoi_dongBoNgayDaXong_vanNgat() {
        when(dongBoNgayService.hienTai("SHOPIFY"))
                .thenReturn(DongBoNgayDto.builder().maKenh("SHOPIFY").trangThai(DongBoNgayService.XONG).build());

        service.ngatKetNoi("SHOPIFY");

        verify(kenhBanHangService).xoaKhoaShopify();
    }
}
