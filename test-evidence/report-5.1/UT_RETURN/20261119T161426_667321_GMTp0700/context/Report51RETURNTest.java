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
class Report51RETURNTest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_RETURN_001() {
        assertEquals(false,TraHangQuyTac.quaHan(T0,T0.plusSeconds(0)));
    }

    @Test
    void UT_RETURN_002() {
        assertEquals(false,TraHangQuyTac.quaHan(T0,T0.plusSeconds(259199)));
    }

    @Test
    void UT_RETURN_003() {
        assertEquals(false,TraHangQuyTac.quaHan(T0,T0.plusSeconds(259200)));
    }

    @Test
    void UT_RETURN_004() {
        assertEquals(true,TraHangQuyTac.quaHan(T0,T0.plusSeconds(259201)));
    }

    @Test
    void UT_RETURN_005() {
        assertTrue(TraHangQuyTac.quaHan(null,T0));
    }

    @Test
    void UT_RETURN_006() {
        assertBd("33",TraHangQuyTac.donGiaThucTra(B("100"),B("0"),B("3")));
    }

    @Test
    void UT_RETURN_007() {
        assertBd("50",TraHangQuyTac.donGiaThucTra(B("100"),B("1"),B("2")));
    }

    @Test
    void UT_RETURN_008() {
        assertBd("0",TraHangQuyTac.donGiaThucTra(B("100"),B("0"),B("0")));
    }

    @Test
    void UT_RETURN_009() {
        assertBd("0",TraHangQuyTac.donGiaThucTra(B("100"),B("0"),B("-1")));
    }

    @Test
    void UT_RETURN_010() {
        assertBd("0",TraHangQuyTac.donGiaThucTra(B("100"),B("0"),null));
    }

    @Test
    void UT_RETURN_011() {
        assertBd("0",TraHangQuyTac.donGiaThucTra(null,null,B("1")));
    }

    @Test
    void UT_RETURN_012() {
        assertBd("0",TraHangQuyTac.donGiaThucTra(B("50"),B("60"),B("1")));
    }

    @Test
    void UT_RETURN_013() {
        assertBd("33.00",TraHangQuyTac.tienHoan(B("100"),B("0"),B("3"),B("0"),B("0"),B("1")));
    }

    @Test
    void UT_RETURN_014() {
        assertBd("34.00",TraHangQuyTac.tienHoan(B("100"),B("0"),B("3"),B("2"),B("66"),B("1")));
    }

    @Test
    void UT_RETURN_015() {
        assertBd("34.00",TraHangQuyTac.tienHoan(B("100"),B("0"),B("3"),B("2"),B("66"),B("2")));
    }

    @Test
    void UT_RETURN_016() {
        assertBd("0",TraHangQuyTac.tienHoan(B("100"),B("0"),B("3"),B("2"),B("110"),B("1")));
    }

    @Test
    void UT_RETURN_017() {
        assertBd("0",TraHangQuyTac.tienHoan(B("100"),B("0"),B("3"),B("0"),B("0"),B("0")));
    }

    @Test
    void UT_RETURN_018() {
        assertEquals(null,TraHangQuyTac.cheSoDienThoai(null));
    }

    @Test
    void UT_RETURN_019() {
        assertEquals(null,TraHangQuyTac.cheSoDienThoai(""));
    }

    @Test
    void UT_RETURN_020() {
        assertEquals(null,TraHangQuyTac.cheSoDienThoai("abc"));
    }

    @Test
    void UT_RETURN_021() {
        assertEquals("xxxxxx",TraHangQuyTac.cheSoDienThoai("123456"));
    }

    @Test
    void UT_RETURN_022() {
        assertEquals("0 1xx 456",TraHangQuyTac.cheSoDienThoai("0123456"));
    }

    @Test
    void UT_RETURN_023() {
        assertEquals("09xx xxx 218",TraHangQuyTac.cheSoDienThoai("0900000218"));
    }

    @Test
    void UT_RETURN_024() {
        assertEquals(false,TraHangQuyTac.soTaiKhoanHopLe(null));
    }

    @Test
    void UT_RETURN_025() {
        assertEquals(false,TraHangQuyTac.soTaiKhoanHopLe(""));
    }

    @Test
    void UT_RETURN_026() {
        assertEquals(false,TraHangQuyTac.soTaiKhoanHopLe("00000"));
    }

    @Test
    void UT_RETURN_027() {
        assertEquals(true,TraHangQuyTac.soTaiKhoanHopLe("000000"));
    }

    @Test
    void UT_RETURN_028() {
        assertEquals(true,TraHangQuyTac.soTaiKhoanHopLe("00000000000000000000"));
    }

    @Test
    void UT_RETURN_029() {
        assertEquals(false,TraHangQuyTac.soTaiKhoanHopLe("000000000000000000000"));
    }

    @Test
    void UT_RETURN_030() {
        assertEquals(false,TraHangQuyTac.soTaiKhoanHopLe("12345a"));
    }

    @Test
    void UT_RETURN_031() {
        assertEquals(false,TraHangQuyTac.soTaiKhoanHopLe(" 123456"));
    }
}
