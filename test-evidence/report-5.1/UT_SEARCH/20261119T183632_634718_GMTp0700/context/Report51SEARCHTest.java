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
class Report51SEARCHTest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_SEARCH_001() {
        assertEquals(null,TuKhoaTimKiem.chuanHoa(null));
    }

    @Test
    void UT_SEARCH_002() {
        assertEquals(null,TuKhoaTimKiem.chuanHoa("a"));
    }

    @Test
    void UT_SEARCH_003() {
        assertEquals("ab",TuKhoaTimKiem.chuanHoa(" ab "));
    }

    @Test
    void UT_SEARCH_004() {
        assertEquals("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",TuKhoaTimKiem.chuanHoa("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
    }

    @Test
    void UT_SEARCH_005() {
        assertEquals("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",TuKhoaTimKiem.chuanHoa("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
    }

    @Test
    void UT_SEARCH_006() {
        assertEquals("ab!!!%!_",TuKhoaTimKiem.thoat("Ab!%_"));
    }

    @Test
    void UT_SEARCH_007() {
        assertEquals("polo",TuKhoaTimKiem.thoat("Polo"));
    }

    @Test
    void UT_SEARCH_008() {
        assertEquals("ab!%",TuKhoaTimKiem.mau("Ab%",true));
    }

    @Test
    void UT_SEARCH_009() {
        assertEquals("%ab!%%",TuKhoaTimKiem.mau("Ab%",false));
    }

    @Test
    void UT_SEARCH_010() {
        assertEquals(false,TuKhoaTimKiem.giongMaChungTu(null));
    }

    @Test
    void UT_SEARCH_011() {
        assertEquals(true,TuKhoaTimKiem.giongMaChungTu("PX"));
    }

    @Test
    void UT_SEARCH_012() {
        assertEquals(true,TuKhoaTimKiem.giongMaChungTu("PN-RET"));
    }

    @Test
    void UT_SEARCH_013() {
        assertEquals(false,TuKhoaTimKiem.giongMaChungTu("Polo"));
    }

    @Test
    void UT_SEARCH_014() {
        assertEquals(false,TuKhoaTimKiem.giongMaChungTu("1234"));
    }

    @Test
    void UT_SEARCH_015() {
        assertEquals(true,TuKhoaTimKiem.giongMaChungTu("AB12"));
    }

    @Test
    void UT_SEARCH_016() {
        assertEquals(false,TuKhoaTimKiem.giongMaChungTu("PX_1"));
    }

    @Test
    void UT_SEARCH_017() {
        assertEquals(false,TuKhoaTimKiem.giongMaChungTu("PX%1"));
    }

    @Test
    void UT_SEARCH_018() {
        assertEquals(false,TuKhoaTimKiem.giongMaChungTu("PX 1"));
    }

    @Test
    void UT_SEARCH_019() {
        assertEquals(0,TuKhoaTimKiem.mucKhop("Polo","POLO"));
    }

    @Test
    void UT_SEARCH_020() {
        assertEquals(1,TuKhoaTimKiem.mucKhop("Polo nam","polo"));
    }

    @Test
    void UT_SEARCH_021() {
        assertEquals(2,TuKhoaTimKiem.mucKhop("Ao Polo","polo"));
    }

    @Test
    void UT_SEARCH_022() {
        assertEquals(3,TuKhoaTimKiem.mucKhop("Ao","polo"));
    }

    @Test
    void UT_SEARCH_023() {
        assertEquals(3,TuKhoaTimKiem.mucKhop(null,"polo"));
    }

    @Test
    void UT_SEARCH_024() {
        assertEquals(3,TuKhoaTimKiem.mucKhop("Ao",null));
    }

    @Test
    void UT_SEARCH_025() {
        var result=TuKhoaTimKiem.tach(null); assertFalse(result.coTruong()); assertNull(result.conLai());
    }

    @Test
    void UT_SEARCH_026() {
        var normal=FilterCriteria.builder().fieldName("id").operation(FilterOperation.EQUALS).value(7).build(); var input=List.of(FilterCriteria.builder().fieldName("tuKhoa").operation(FilterOperation.LIKE).value("old").build(),normal,FilterCriteria.builder().fieldName("tuKhoa").operation(FilterOperation.EQUALS).value(" x ").build()); var result=TuKhoaTimKiem.tach(input); assertEquals("x",result.tuKhoa()); assertTrue(result.chinhXac()); assertEquals(List.of(normal),result.conLai()); assertEquals(3,input.size());
    }
}
