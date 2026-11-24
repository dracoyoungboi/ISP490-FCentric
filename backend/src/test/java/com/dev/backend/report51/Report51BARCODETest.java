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
class Report51BARCODETest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_BARCODE_001() {
        assertEquals(false,MaVachSku.laTienToHopLe(null));
    }

    @Test
    void UT_BARCODE_002() {
        assertEquals(false,MaVachSku.laTienToHopLe(""));
    }

    @Test
    void UT_BARCODE_003() {
        assertEquals(false,MaVachSku.laTienToHopLe("2"));
    }

    @Test
    void UT_BARCODE_004() {
        assertEquals(true,MaVachSku.laTienToHopLe("20"));
    }

    @Test
    void UT_BARCODE_005() {
        assertEquals(true,MaVachSku.laTienToHopLe("00"));
    }

    @Test
    void UT_BARCODE_006() {
        assertEquals(false,MaVachSku.laTienToHopLe("200"));
    }

    @Test
    void UT_BARCODE_007() {
        assertEquals(false,MaVachSku.laTienToHopLe(" 20"));
    }

    @Test
    void UT_BARCODE_008() {
        assertEquals(false,MaVachSku.laTienToHopLe("2a"));
    }

    @Test
    void UT_BARCODE_009() {
        assertEquals("20",MaVachSku.tienToDung(null));
    }

    @Test
    void UT_BARCODE_010() {
        assertEquals("20",MaVachSku.tienToDung("bad"));
    }

    @Test
    void UT_BARCODE_011() {
        assertEquals("21",MaVachSku.tienToDung(" 21 "));
    }

    @Test
    void UT_BARCODE_012() {
        assertEquals("2000000001",MaVachSku.sinh("20",1));
    }

    @Test
    void UT_BARCODE_013() {
        assertEquals("2000000150",MaVachSku.sinh("20",150));
    }

    @Test
    void UT_BARCODE_014() {
        assertEquals("202147483647",MaVachSku.sinh("20",2147483647));
    }

    @Test
    void UT_BARCODE_015() {
        assertKey("sanPhamMuaHang.maVachChiSinhChoBienTheCoId",assertThrows(LoiThamSoException.class,()->MaVachSku.sinh("20",0)));
    }

    @Test
    void UT_BARCODE_016() {
        assertKey("sanPhamMuaHang.maVachChiSinhChoBienTheCoId",assertThrows(LoiThamSoException.class,()->MaVachSku.sinh("20",-1)));
    }

    @Test
    void UT_BARCODE_017() {
        assertEquals(null,MaVachSku.chuanHoa(null));
    }

    @Test
    void UT_BARCODE_018() {
        assertEquals(null,MaVachSku.chuanHoa("  "));
    }

    @Test
    void UT_BARCODE_019() {
        assertEquals("123",MaVachSku.chuanHoa(" 123 "));
    }
}
