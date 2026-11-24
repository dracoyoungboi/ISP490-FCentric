package com.dev.backend.utils;

import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class KenhCauHinhDongBoTest {

    @Test
    void chuaCoCauHinh_giuHanhViCu() {
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);

        assertTrue(KenhCauHinhDongBo.tuDongDayTon(cauHinh, "SHOPIFY"));
        assertTrue(KenhCauHinhDongBo.tuDongLayDon(cauHinh, "SHOPIFY"));
        assertEquals(100, KenhCauHinhDongBo.tyLeDayTon(cauHinh, "SHOPIFY"));
        assertEquals(0, KenhCauHinhDongBo.tonDem(cauHinh, "SHOPIFY"));
        assertEquals(0, KenhCauHinhDongBo.nguongVe0(cauHinh, "SHOPIFY"));
        assertTrue(KenhCauHinhDongBo.tuDongDayTon(null, "SHOPIFY"));
    }

    @Test
    void docGiaTriDaLuu() {
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString("KENH_SHOPIFY_TU_DONG_DAY_TON", null)).thenReturn("false");
        when(cauHinh.getCauHinhString("KENH_SHOPIFY_TU_DONG_LAY_DON", null)).thenReturn("0");
        when(cauHinh.getCauHinhString("KENH_SHOPIFY_TY_LE_DAY_TON", null)).thenReturn("80");
        when(cauHinh.getCauHinhString("KENH_SHOPIFY_TON_DEM", null)).thenReturn(" 2 ");
        when(cauHinh.getCauHinhString("KENH_SHOPIFY_NGUONG_VE_0", null)).thenReturn("1");

        assertFalse(KenhCauHinhDongBo.tuDongDayTon(cauHinh, "shopify"));
        assertFalse(KenhCauHinhDongBo.tuDongLayDon(cauHinh, "SHOPIFY"));
        assertEquals(80, KenhCauHinhDongBo.tyLeDayTon(cauHinh, "SHOPIFY"));
        assertEquals(2, KenhCauHinhDongBo.tonDem(cauHinh, "SHOPIFY"));
        assertEquals(1, KenhCauHinhDongBo.nguongVe0(cauHinh, "SHOPIFY"));
    }

    @Test
    void giaTriHongHoacNgoaiKhoang_quayVeMacDinh() {
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString("KENH_SHOPIFY_TU_DONG_DAY_TON", null)).thenReturn("abc");
        when(cauHinh.getCauHinhString("KENH_SHOPIFY_TY_LE_DAY_TON", null)).thenReturn("150");
        when(cauHinh.getCauHinhString("KENH_SHOPIFY_TON_DEM", null)).thenReturn("-3");
        when(cauHinh.getCauHinhString("KENH_SHOPIFY_NGUONG_VE_0", null)).thenReturn("x");

        assertTrue(KenhCauHinhDongBo.tuDongDayTon(cauHinh, "SHOPIFY"));
        assertEquals(100, KenhCauHinhDongBo.tyLeDayTon(cauHinh, "SHOPIFY"));
        assertEquals(0, KenhCauHinhDongBo.tonDem(cauHinh, "SHOPIFY"));
        assertEquals(0, KenhCauHinhDongBo.nguongVe0(cauHinh, "SHOPIFY"));
    }

    @Test
    void khoaTheoMaKenhChuanHoa() {
        assertEquals("KENH_SHOPIFY_TON_DEM", KenhCauHinhDongBo.khoa(" shopify ", KenhCauHinhDongBo.TON_DEM));
        assertEquals("KENH_TIKTOK_SHOP_TON_DEM", KenhCauHinhDongBo.khoa("tiktok-shop", KenhCauHinhDongBo.TON_DEM));
    }
}
