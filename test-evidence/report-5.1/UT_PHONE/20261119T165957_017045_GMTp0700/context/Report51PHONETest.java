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
class Report51PHONETest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_PHONE_001() {
        assertEquals(null,SoDienThoai.chuanHoa(null));
    }

    @Test
    void UT_PHONE_002() {
        assertEquals(null,SoDienThoai.chuanHoa(""));
    }

    @Test
    void UT_PHONE_003() {
        assertEquals(null,SoDienThoai.chuanHoa("  .()- "));
    }

    @Test
    void UT_PHONE_004() {
        assertEquals("0000000000",SoDienThoai.chuanHoa("+84000000000"));
    }

    @Test
    void UT_PHONE_005() {
        assertEquals("0000000000",SoDienThoai.chuanHoa("(000) 000-0000"));
    }

    @Test
    void UT_PHONE_006() {
        assertEquals("abc",SoDienThoai.chuanHoa("abc"));
    }

    @Test
    void UT_PHONE_007() {
        assertEquals(null,SoDienThoai.choTimKiem(null));
    }

    @Test
    void UT_PHONE_008() {
        assertEquals(null,SoDienThoai.choTimKiem("123"));
    }

    @Test
    void UT_PHONE_009() {
        assertEquals("1234",SoDienThoai.choTimKiem("1234"));
    }

    @Test
    void UT_PHONE_010() {
        assertEquals("0000000000",SoDienThoai.choTimKiem("84000000000"));
    }

    @Test
    void UT_PHONE_011() {
        assertEquals(null,SoDienThoai.choTimKiem("12ab"));
    }

    @Test
    void UT_PHONE_012() {
        assertEquals("0000000000",SoDienThoai.choTimKiem("000 000 0000"));
    }
}
