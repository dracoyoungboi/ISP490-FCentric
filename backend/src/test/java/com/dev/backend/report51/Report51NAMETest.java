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
class Report51NAMETest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_NAME_001() {
        assertEquals("",HoTen.chuanHoa(null));
    }

    @Test
    void UT_NAME_002() {
        assertEquals("An Binh",HoTen.chuanHoa("  An   Binh  "));
    }

    @Test
    void UT_NAME_003() {
        assertEquals("An Binh",HoTen.chuanHoa("An\u200b Binh"));
    }

    @Test
    void UT_NAME_004() {
        assertEquals("Nguy\u1ec5n",HoTen.chuanHoa("Nguye\u0302\u0303n"));
    }

    @Test
    void UT_NAME_005() {
        assertEquals(HoTen.LOI_TRONG,HoTen.loi(null));
    }

    @Test
    void UT_NAME_006() {
        assertEquals(HoTen.LOI_TRONG,HoTen.loi("   "));
    }

    @Test
    void UT_NAME_007() {
        assertEquals(HoTen.LOI_NGAN,HoTen.loi("A"));
    }

    @Test
    void UT_NAME_008() {
        assertEquals(null,HoTen.loi("An"));
    }

    @Test
    void UT_NAME_009() {
        assertEquals(null,HoTen.loi("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
    }

    @Test
    void UT_NAME_010() {
        assertEquals(HoTen.LOI_DAI,HoTen.loi("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
    }

    @Test
    void UT_NAME_011() {
        assertEquals(HoTen.LOI_DAI,HoTen.loi("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
    }

    @Test
    void UT_NAME_012() {
        assertEquals(HoTen.LOI_KY_TU,HoTen.loi("1An"));
    }

    @Test
    void UT_NAME_013() {
        assertEquals(null,HoTen.loi("O'Neil"));
    }

    @Test
    void UT_NAME_014() {
        assertEquals(HoTen.LOI_KY_TU,HoTen.loi("An!"));
    }
}
