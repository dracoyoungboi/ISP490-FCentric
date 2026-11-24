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
class Report51MAPPINGTest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_MAPPING_001() {
        assertNull(Mappers.getMapper(KhachHangMapper.class).toDto((KhachHang)null));
    }

    @Test
    void UT_MAPPING_002() {
        var row=new KhachHang(); row.setId(7); row.setTenKhachHang("Test customer"); var dto=Mappers.getMapper(KhachHangMapper.class).toDto(row); assertEquals(7,dto.getId()); assertEquals("Test customer",dto.getTenKhachHang());
    }

    @Test
    void UT_MAPPING_003() {
        var row=new KhachHang(); row.setTenKhachHang("Test customer"); Mappers.getMapper(KhachHangMapper.class).partialUpdate(new KhachHangUpdating(),row); assertEquals("Test customer",row.getTenKhachHang());
    }

    @Test
    void UT_MAPPING_004() {
        var row=new KhachHang(); row.setMaSoThue("1234567890"); var patch=new KhachHangUpdating(); patch.setMaSoThue(""); Mappers.getMapper(KhachHangMapper.class).partialUpdate(patch,row); assertEquals("",row.getMaSoThue());
    }

    @Test
    void UT_MAPPING_005() {
        var result=Mappers.getMapper(KhachHangMapper.class).toDtoPage(new PageImpl<KhachHang>(List.of(),PageRequest.of(2,5),0)); assertTrue(result.isEmpty()); assertEquals(2,result.getNumber()); assertEquals(5,result.getSize());
    }
}
