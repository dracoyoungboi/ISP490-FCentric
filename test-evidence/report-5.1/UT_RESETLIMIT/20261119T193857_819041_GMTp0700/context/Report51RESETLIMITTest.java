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
class Report51RESETLIMITTest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_RESETLIMIT_001() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); var d=limiter.tryAcquire("test-a","192.0.2.1",1); assertTrue(d.allowed()); assertNull(d.reason()); assertEquals(0,d.retryAfterSeconds());
    }

    @Test
    void UT_RESETLIMIT_002() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); limiter.tryAcquire("test-a","192.0.2.1",1); clock.advance(Duration.ofSeconds(0)); var d=limiter.tryAcquire("test-a","192.0.2.1",1); assertEquals(false,d.allowed()); assertEquals(60,d.retryAfterSeconds()); assertEquals(PasswordResetRateLimiter.Reason.COOLDOWN,d.reason());
    }

    @Test
    void UT_RESETLIMIT_003() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); limiter.tryAcquire("test-a","192.0.2.1",1); clock.advance(Duration.ofSeconds(59)); var d=limiter.tryAcquire("test-a","192.0.2.1",1); assertEquals(false,d.allowed()); assertEquals(1,d.retryAfterSeconds()); assertEquals(PasswordResetRateLimiter.Reason.COOLDOWN,d.reason());
    }

    @Test
    void UT_RESETLIMIT_004() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); limiter.tryAcquire("test-a","192.0.2.1",1); clock.advance(Duration.ofSeconds(60)); var d=limiter.tryAcquire("test-a","192.0.2.1",1); assertEquals(true,d.allowed()); assertEquals(0,d.retryAfterSeconds());
    }

    @Test
    void UT_RESETLIMIT_005() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); limiter.tryAcquire("a","192.0.2.1",1); clock.advance(Duration.ofMillis(59500)); assertEquals(1,limiter.tryAcquire("a","192.0.2.1",1).retryAfterSeconds());
    }

    @Test
    void UT_RESETLIMIT_006() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); limiter.tryAcquire("a","192.0.2.1",1); clock.advance(Duration.ofSeconds(30)); assertFalse(limiter.tryAcquire("a","192.0.2.1",1).allowed()); clock.advance(Duration.ofSeconds(30)); assertTrue(limiter.tryAcquire("a","192.0.2.1",1).allowed());
    }

    @Test
    void UT_RESETLIMIT_007() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); limiter.tryAcquire("a","192.0.2.1",1); assertEquals(PasswordResetRateLimiter.Reason.COOLDOWN,limiter.tryAcquire("b","192.0.2.2",1).reason());
    }

    @Test
    void UT_RESETLIMIT_008() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); for(int i=0;i<5;i++){ assertTrue(limiter.tryAcquire("a","192.0.2.1",null).allowed()); clock.advance(Duration.ofSeconds(60)); } var d=limiter.tryAcquire("a","192.0.2.1",null); assertEquals(PasswordResetRateLimiter.Reason.TOO_MANY,d.reason()); assertEquals(3300,d.retryAfterSeconds());
    }

    @Test
    void UT_RESETLIMIT_009() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); for(int i=0;i<5;i++){limiter.tryAcquire("a","192.0.2.1",null);clock.advance(Duration.ofSeconds(60));} clock.advance(Duration.ofSeconds(3300)); assertTrue(limiter.tryAcquire("a","192.0.2.1",null).allowed());
    }

    @Test
    void UT_RESETLIMIT_010() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); for(int i=0;i<20;i++)assertTrue(limiter.tryAcquire("test-"+i,"192.0.2.1",null).allowed()); assertEquals(PasswordResetRateLimiter.Reason.TOO_MANY,limiter.tryAcquire("test-20","192.0.2.1",null).reason());
    }

    @Test
    void UT_RESETLIMIT_011() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); for(int i=0;i<100;i++)assertTrue(limiter.tryAcquire("test-"+i,"192.0.2."+i,i).allowed()); var d=limiter.tryAcquire("unknown","198.51.100.1",null); assertEquals(PasswordResetRateLimiter.Reason.GLOBAL_LIMIT,d.reason()); assertEquals(86400,d.retryAfterSeconds());
    }

    @Test
    void UT_RESETLIMIT_012() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); for(int i=0;i<101;i++)assertTrue(limiter.tryAcquire("test-"+i,"192.0.2."+i,null).allowed());
    }

    @Test
    void UT_RESETLIMIT_013() {
        var clock=new MutableClock(T0); var limiter=new PasswordResetRateLimiter(clock); limiter.tryAcquire("a","192.0.2.1",1); clock.advance(Duration.ofHours(25)); limiter.purgeExpired(); assertTrue(limiter.tryAcquire("a","192.0.2.1",1).allowed());
    }
}
