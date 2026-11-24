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
class Report51FIFOTest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_FIFO_001() {
        assertBd("0", PhanBoLoFifo.tong(List.of()));
    }

    @Test
    void UT_FIFO_002() {
        assertBd("2", PhanBoLoFifo.tong(List.of(L(1,"2"))));
    }

    @Test
    void UT_FIFO_003() {
        assertBd("9", PhanBoLoFifo.tong(List.of(L(1,"2"),L(2,"3"),L(3,"4"))));
    }

    @Test
    void UT_FIFO_004() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(),PhanBoLoFifo.layFifo(input,B("0"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_005() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(),PhanBoLoFifo.layFifo(input,B("-1"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_006() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"2")),PhanBoLoFifo.layFifo(input,B("2"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_007() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"3")),PhanBoLoFifo.layFifo(input,B("3"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_008() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"3"),L(2,"1")),PhanBoLoFifo.layFifo(input,B("4"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_009() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"3"),L(2,"5")),PhanBoLoFifo.layFifo(input,B("8"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_010() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"3"),L(2,"5")),PhanBoLoFifo.layFifo(input,B("9"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_011() {
        assertEquals(List.of(L(3,"2")),PhanBoLoFifo.layFifo(List.of(L(1,"0"),L(2,"-2"),L(3,"4")),B("2")));
    }

    @Test
    void UT_FIFO_012() {
        assertTrue(PhanBoLoFifo.layFifo(List.of(),B("3")).isEmpty());
    }

    @Test
    void UT_FIFO_013() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(),PhanBoLoFifo.catTuLoMoiNhat(input,B("-1"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_014() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(),PhanBoLoFifo.catTuLoMoiNhat(input,B("0"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_015() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"2")),PhanBoLoFifo.catTuLoMoiNhat(input,B("2"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_016() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"3")),PhanBoLoFifo.catTuLoMoiNhat(input,B("3"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_017() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"3"),L(2,"3")),PhanBoLoFifo.catTuLoMoiNhat(input,B("6"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_018() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"3"),L(2,"5")),PhanBoLoFifo.catTuLoMoiNhat(input,B("8"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_019() {
        var input=List.of(L(1,"3"),L(2,"5")); assertEquals(List.of(L(1,"3"),L(2,"5")),PhanBoLoFifo.catTuLoMoiNhat(input,B("9"))); assertEquals(List.of(L(1,"3"),L(2,"5")),input);
    }

    @Test
    void UT_FIFO_020() {
        var orders=new LinkedHashMap<String,BigDecimal>(); orders.put("A",B("2")); orders.put("B",B("4")); var result=PhanBoLoFifo.chiaChoDon(List.of(L(1,"3"),L(2,"5")),orders); assertEquals(List.of(L(1,"2")),result.get("A")); assertEquals(List.of(L(1,"1"),L(2,"3")),result.get("B")); assertEquals(List.of("A","B"),new ArrayList<>(result.keySet()));
    }

    @Test
    void UT_FIFO_021() {
        var orders=new LinkedHashMap<String,BigDecimal>(); orders.put("A",B("0")); orders.put("B",B("2")); var result=PhanBoLoFifo.chiaChoDon(List.of(L(1,"3"),L(2,"5")),orders); assertEquals(List.of(),result.get("A")); assertEquals(List.of(L(1,"2")),result.get("B")); assertEquals(List.of("A","B"),new ArrayList<>(result.keySet()));
    }

    @Test
    void UT_FIFO_022() {
        var orders=new LinkedHashMap<String,BigDecimal>(); orders.put("A",B("6")); orders.put("B",B("6")); var result=PhanBoLoFifo.chiaChoDon(List.of(L(1,"3"),L(2,"5")),orders); assertEquals(List.of(L(1,"3"),L(2,"3")),result.get("A")); assertEquals(List.of(L(2,"2")),result.get("B")); assertEquals(List.of("A","B"),new ArrayList<>(result.keySet()));
    }

    @Test
    void UT_FIFO_023() {
        assertTrue(PhanBoLoFifo.chiaChoDon(List.of(L(1,"3")),Map.of()).isEmpty());
    }

    @Test
    void UT_FIFO_024() {
        assertEquals(List.of(L(1,"5")),PhanBoLoFifo.chiaChoDon(List.of(L(1,"2"),L(1,"3")),Map.of("A",B("5"))).get("A"));
    }
}
