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
class Report51DECIMALTest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_DECIMAL_001() {
        assertEquals(true,GioiHanSoThapPhan.hopLe(null));
    }

    @Test
    void UT_DECIMAL_002() {
        assertEquals(true,GioiHanSoThapPhan.hopLe(B("0")));
    }

    @Test
    void UT_DECIMAL_003() {
        assertEquals(true,GioiHanSoThapPhan.hopLe(B("99999999999999999999")));
    }

    @Test
    void UT_DECIMAL_004() {
        assertEquals(false,GioiHanSoThapPhan.hopLe(B("100000000000000000000")));
    }

    @Test
    void UT_DECIMAL_005() {
        assertEquals(false,GioiHanSoThapPhan.hopLe(B("-100000000000000000000")));
    }

    @Test
    void UT_DECIMAL_006() {
        assertEquals(true,GioiHanSoThapPhan.hopLe(B("1e-30")));
    }

    @Test
    void UT_DECIMAL_007() {
        assertEquals(false,GioiHanSoThapPhan.hopLe(B("1e-31")));
    }

    @Test
    void UT_DECIMAL_008() {
        assertEquals(false,GioiHanSoThapPhan.hopLe(B("1e900000000")));
    }

    @Test
    void UT_DECIMAL_009() {
        assertEquals(true,GioiHanSoThapPhan.hopLe(B("100000.01999999999")));
    }

    @Test
    void UT_DECIMAL_010() {
        var number=B("123.45"); assertSame(number,GioiHanSoThapPhan.kiemTra(number,"amount"));
    }

    @Test
    void UT_DECIMAL_011() {
        assertKey("sanPhamMuaHang.truongVuotGioiHan",assertThrows(CommonException.class,()->GioiHanSoThapPhan.kiemTra(B("1e21"),"amount")));
    }

    @Test
    void UT_DECIMAL_012() {
        var number=B("123.45"); assertSame(number,GioiHanSoThapPhan.kiemTra(number,ThongDiep.of("keToanDuLieuVao.soLuongPhaiLonHon0")));
    }

    @Test
    void UT_DECIMAL_013() {
        assertKey("sanPhamMuaHang.truongVuotGioiHan",assertThrows(CommonException.class,()->GioiHanSoThapPhan.kiemTra(B("1e21"),ThongDiep.of("keToanDuLieuVao.soLuongPhaiLonHon0"))));
    }
}
