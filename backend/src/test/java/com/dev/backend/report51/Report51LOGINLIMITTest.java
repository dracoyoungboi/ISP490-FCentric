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
class Report51LOGINLIMITTest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_LOGINLIMIT_001() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); var d=limiter.tryAcquire("test-a",1,"192.0.2.1"); assertTrue(d.allowed()); assertEquals(0,d.retryAfterSeconds());
    }

    @Test
    void UT_LOGINLIMIT_002() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<5;i++)assertTrue(limiter.tryAcquire("a",1,"192.0.2.1").allowed()); var d=limiter.tryAcquire("a",1,"192.0.2.1"); assertFalse(d.allowed()); assertEquals(60,d.retryAfterSeconds());
    }

    @Test
    void UT_LOGINLIMIT_003() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<5;i++)limiter.tryAcquire("a",1,"192.0.2.1"); assertTrue(limiter.tryAcquire("a",1,"192.0.2.2").allowed());
    }

    @Test
    void UT_LOGINLIMIT_004() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<5;i++)limiter.tryAcquire("a",1); var d=limiter.tryAcquire("a",1,"192.0.2.1"); assertFalse(d.allowed()); assertEquals(60,d.retryAfterSeconds());
    }

    @Test
    void UT_LOGINLIMIT_005() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<20;i++)assertTrue(limiter.tryAcquire("a",1,"192.0.2."+i).allowed()); var d=limiter.tryAcquire("a",1,"198.51.100.1"); assertFalse(d.allowed()); assertEquals(60,d.retryAfterSeconds());
    }

    @Test
    void UT_LOGINLIMIT_006() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<5;i++)limiter.tryAcquire("a",1); limiter.recordSuccess("alias",1); assertTrue(limiter.tryAcquire("a",1).allowed());
    }

    @Test
    void UT_LOGINLIMIT_007() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<5;i++)limiter.tryAcquire(" Tést ",null,"192.0.2.1"); assertFalse(limiter.tryAcquire("test",null,"192.0.2.1").allowed());
    }

    @Test
    void UT_LOGINLIMIT_008() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<5;i++)limiter.tryAcquire("a",1); clock.advance(Duration.ofSeconds(59)); var d=limiter.tryAcquire("a",1); assertEquals(false,d.allowed()); assertEquals(1,d.retryAfterSeconds());
    }

    @Test
    void UT_LOGINLIMIT_009() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<5;i++)limiter.tryAcquire("a",1); clock.advance(Duration.ofSeconds(60)); var d=limiter.tryAcquire("a",1); assertEquals(true,d.allowed()); assertEquals(0,d.retryAfterSeconds());
    }

    @Test
    void UT_LOGINLIMIT_010() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<5;i++)limiter.tryAcquire("a",1); clock.advance(Duration.ofSeconds(30)); assertFalse(limiter.tryAcquire("a",1).allowed()); clock.advance(Duration.ofSeconds(30)); assertTrue(limiter.tryAcquire("a",1).allowed());
    }

    @Test
    void UT_LOGINLIMIT_011() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<25;i++)assertTrue(limiter.tryAcquire(null,null).allowed());
    }

    @Test
    void UT_LOGINLIMIT_012() {
        var clock=new MutableClock(T0); var limiter=new LoginRateLimiter(clock); for(int i=0;i<5;i++)limiter.tryAcquire("a",1); clock.advance(Duration.ofHours(25)); limiter.purgeExpired(); for(int i=0;i<5;i++)assertTrue(limiter.tryAcquire("a",1).allowed()); assertEquals(60,limiter.tryAcquire("a",1).retryAfterSeconds());
    }
}
