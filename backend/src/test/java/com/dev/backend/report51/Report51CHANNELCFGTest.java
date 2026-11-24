package com.dev.backend.report51;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import com.dev.backend.utils.*;
import com.dev.backend.i18n.*;
import com.dev.backend.exception.customize.*;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.ketoan.TachThue;
import com.dev.backend.services.impl.trahang.TraHangQuyTac;
import com.dev.backend.services.impl.utils.*;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.testsupport.MutableClock;
import com.dev.backend.dto.request.*;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.constant.enums.*;
import org.mapstruct.factory.Mappers;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.*;

// Dữ liệu hoàn toàn giả; mỗi method tương ứng đúng một case trong report.
class Report51CHANNELCFGTest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_CHANNELCFG_001() {
        assertEquals("SHOPIFY",KenhCauHinhDongBo.chuanHoaMaKenh(null));
    }

    @Test
    void UT_CHANNELCFG_002() {
        assertEquals("SHOPIFY",KenhCauHinhDongBo.chuanHoaMaKenh(" "));
    }

    @Test
    void UT_CHANNELCFG_003() {
        assertEquals("TIKTOK_SHOP",KenhCauHinhDongBo.chuanHoaMaKenh(" tiktok-shop "));
    }

    @Test
    void UT_CHANNELCFG_004() {
        assertEquals("KENH_SHOPEE_TON_DEM",KenhCauHinhDongBo.khoa("shopee","TON_DEM"));
    }

    @Test
    void UT_CHANNELCFG_005() {
        assertTrue(KenhCauHinhDongBo.tuDongDayTon(null,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_006() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null)).thenReturn(null); assertEquals(true,KenhCauHinhDongBo.tuDongDayTon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null);
    }

    @Test
    void UT_CHANNELCFG_007() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null)).thenReturn(""); assertEquals(true,KenhCauHinhDongBo.tuDongDayTon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null);
    }

    @Test
    void UT_CHANNELCFG_008() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null)).thenReturn("false"); assertEquals(false,KenhCauHinhDongBo.tuDongDayTon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null);
    }

    @Test
    void UT_CHANNELCFG_009() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null)).thenReturn(" FALSE "); assertEquals(false,KenhCauHinhDongBo.tuDongDayTon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null);
    }

    @Test
    void UT_CHANNELCFG_010() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null)).thenReturn("0"); assertEquals(false,KenhCauHinhDongBo.tuDongDayTon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null);
    }

    @Test
    void UT_CHANNELCFG_011() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null)).thenReturn("true"); assertEquals(true,KenhCauHinhDongBo.tuDongDayTon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null);
    }

    @Test
    void UT_CHANNELCFG_012() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null)).thenReturn("invalid"); assertEquals(true,KenhCauHinhDongBo.tuDongDayTon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_DAY_TON",null);
    }

    @Test
    void UT_CHANNELCFG_013() {
        assertTrue(KenhCauHinhDongBo.tuDongLayDon(null,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_014() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null)).thenReturn(null); assertEquals(true,KenhCauHinhDongBo.tuDongLayDon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null);
    }

    @Test
    void UT_CHANNELCFG_015() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null)).thenReturn(""); assertEquals(true,KenhCauHinhDongBo.tuDongLayDon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null);
    }

    @Test
    void UT_CHANNELCFG_016() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null)).thenReturn("false"); assertEquals(false,KenhCauHinhDongBo.tuDongLayDon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null);
    }

    @Test
    void UT_CHANNELCFG_017() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null)).thenReturn(" FALSE "); assertEquals(false,KenhCauHinhDongBo.tuDongLayDon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null);
    }

    @Test
    void UT_CHANNELCFG_018() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null)).thenReturn("0"); assertEquals(false,KenhCauHinhDongBo.tuDongLayDon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null);
    }

    @Test
    void UT_CHANNELCFG_019() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null)).thenReturn("true"); assertEquals(true,KenhCauHinhDongBo.tuDongLayDon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null);
    }

    @Test
    void UT_CHANNELCFG_020() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null)).thenReturn("invalid"); assertEquals(true,KenhCauHinhDongBo.tuDongLayDon(cfg,"SHOPEE")); verify(cfg).getCauHinhString("KENH_SHOPEE_TU_DONG_LAY_DON",null);
    }

    @Test
    void UT_CHANNELCFG_021() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TY_LE_DAY_TON",null)).thenReturn("0"); assertEquals(100,KenhCauHinhDongBo.tyLeDayTon(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_022() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TY_LE_DAY_TON",null)).thenReturn("1"); assertEquals(1,KenhCauHinhDongBo.tyLeDayTon(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_023() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TY_LE_DAY_TON",null)).thenReturn("50"); assertEquals(50,KenhCauHinhDongBo.tyLeDayTon(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_024() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TY_LE_DAY_TON",null)).thenReturn("100"); assertEquals(100,KenhCauHinhDongBo.tyLeDayTon(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_025() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TY_LE_DAY_TON",null)).thenReturn("101"); assertEquals(100,KenhCauHinhDongBo.tyLeDayTon(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_026() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TY_LE_DAY_TON",null)).thenReturn(null); assertEquals(100,KenhCauHinhDongBo.tyLeDayTon(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_027() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TY_LE_DAY_TON",null)).thenReturn("bad"); assertEquals(100,KenhCauHinhDongBo.tyLeDayTon(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_028() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TY_LE_DAY_TON",null)).thenReturn("2147483648"); assertEquals(100,KenhCauHinhDongBo.tyLeDayTon(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_029() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TON_DEM",null)).thenReturn("-1"); assertEquals(0,KenhCauHinhDongBo.tonDem(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_030() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TON_DEM",null)).thenReturn("0"); assertEquals(0,KenhCauHinhDongBo.tonDem(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_031() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TON_DEM",null)).thenReturn("100000"); assertEquals(100000,KenhCauHinhDongBo.tonDem(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_032() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TON_DEM",null)).thenReturn("100001"); assertEquals(0,KenhCauHinhDongBo.tonDem(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_033() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TON_DEM",null)).thenReturn(null); assertEquals(0,KenhCauHinhDongBo.tonDem(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_034() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TON_DEM",null)).thenReturn("bad"); assertEquals(0,KenhCauHinhDongBo.tonDem(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_035() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_TON_DEM",null)).thenReturn("2147483648"); assertEquals(0,KenhCauHinhDongBo.tonDem(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_036() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_NGUONG_VE_0",null)).thenReturn("-1"); assertEquals(0,KenhCauHinhDongBo.nguongVe0(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_037() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_NGUONG_VE_0",null)).thenReturn("0"); assertEquals(0,KenhCauHinhDongBo.nguongVe0(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_038() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_NGUONG_VE_0",null)).thenReturn("100000"); assertEquals(100000,KenhCauHinhDongBo.nguongVe0(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_039() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_NGUONG_VE_0",null)).thenReturn("100001"); assertEquals(0,KenhCauHinhDongBo.nguongVe0(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_040() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_NGUONG_VE_0",null)).thenReturn(null); assertEquals(0,KenhCauHinhDongBo.nguongVe0(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_041() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_NGUONG_VE_0",null)).thenReturn("bad"); assertEquals(0,KenhCauHinhDongBo.nguongVe0(cfg,"SHOPEE"));
    }

    @Test
    void UT_CHANNELCFG_042() {
        var cfg=mock(DieuHanhHeThongService.class); when(cfg.getCauHinhString("KENH_SHOPEE_NGUONG_VE_0",null)).thenReturn("2147483648"); assertEquals(0,KenhCauHinhDongBo.nguongVe0(cfg,"SHOPEE"));
    }
}
