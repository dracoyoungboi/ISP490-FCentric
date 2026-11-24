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
class Report51TAXTest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    @Test
    void UT_TAX_001() {
        var result=TachThue.tach(B("2"),B("216000"),B("0"),B("8")); assertBd("100000",result.donGia()); assertBd("200000",result.thanhTien()); assertBd("0",result.chietKhau()); assertBd("16000",result.tienThue()); assertBd("216000",result.tongCong());
    }

    @Test
    void UT_TAX_002() {
        var result=TachThue.tach(B("2"),B("220000"),B("22000"),B("10")); assertBd("100000",result.donGia()); assertBd("200000",result.thanhTien()); assertBd("20000",result.chietKhau()); assertBd("18000",result.tienThue()); assertBd("198000",result.tongCong());
    }

    @Test
    void UT_TAX_003() {
        var result=TachThue.tach(B("3"),B("100"),B("0"),B("0")); assertBd("33.3333",result.donGia()); assertBd("100",result.thanhTien()); assertBd("0",result.chietKhau()); assertBd("0",result.tienThue()); assertBd("100",result.tongCong());
    }

    @Test
    void UT_TAX_004() {
        var result=TachThue.tach(B("1"),B("105"),B("0"),B("5")); assertBd("100",result.donGia()); assertBd("100",result.thanhTien()); assertBd("0",result.chietKhau()); assertBd("5",result.tienThue()); assertBd("105",result.tongCong());
    }

    @Test
    void UT_TAX_005() {
        var result=TachThue.tach(B("1"),B("100"),B("100"),B("0")); assertBd("100",result.donGia()); assertBd("100",result.thanhTien()); assertBd("100",result.chietKhau()); assertBd("0",result.tienThue()); assertBd("0",result.tongCong());
    }

    @Test
    void UT_TAX_006() {
        var result=TachThue.tach(B("1"),null,null,B("0")); assertBd("0",result.donGia()); assertBd("0",result.thanhTien()); assertBd("0",result.chietKhau()); assertBd("0",result.tienThue()); assertBd("0",result.tongCong());
    }

    @Test
    void UT_TAX_007() {
        assertKey("keToanDuLieuVao.soLuongPhaiLonHon0",assertThrows(LoiThamSoException.class,()->TachThue.tach(null,B("100"),B("0"),B("10"))));
    }

    @Test
    void UT_TAX_008() {
        assertKey("keToanDuLieuVao.soLuongPhaiLonHon0",assertThrows(LoiThamSoException.class,()->TachThue.tach(B("0"),B("100"),B("0"),B("10"))));
    }

    @Test
    void UT_TAX_009() {
        assertKey("keToanDuLieuVao.soLuongPhaiLonHon0",assertThrows(LoiThamSoException.class,()->TachThue.tach(B("-1"),B("100"),B("0"),B("10"))));
    }

    @Test
    void UT_TAX_010() {
        assertKey("keToanDuLieuVao.tienHoacGiamGiaSai",assertThrows(LoiThamSoException.class,()->TachThue.tach(B("1"),B("-1"),B("0"),B("10"))));
    }

    @Test
    void UT_TAX_011() {
        assertKey("keToanDuLieuVao.tienHoacGiamGiaSai",assertThrows(LoiThamSoException.class,()->TachThue.tach(B("1"),B("100"),B("-1"),B("10"))));
    }

    @Test
    void UT_TAX_012() {
        assertKey("keToanDuLieuVao.tienHoacGiamGiaSai",assertThrows(LoiThamSoException.class,()->TachThue.tach(B("1"),B("100"),B("101"),B("10"))));
    }

    @Test
    void UT_TAX_013() {
        assertBd("0",TachThue.dong(null));
    }

    @Test
    void UT_TAX_014() {
        assertBd("1",TachThue.dong(B("1.49")));
    }

    @Test
    void UT_TAX_015() {
        assertBd("2",TachThue.dong(B("1.50")));
    }

    @Test
    void UT_TAX_016() {
        assertBd("-2",TachThue.dong(B("-1.50")));
    }

    @Test
    void UT_TAX_017() {
        assertEquals(List.of(),TachThue.chiaTheoTyLe(B("10"),List.of()));
    }

    @Test
    void UT_TAX_018() {
        assertEquals(List.of(B("10"),B("0")),TachThue.chiaTheoTyLe(B("10"),List.of(B("0"),B("0"))));
    }

    @Test
    void UT_TAX_019() {
        assertEquals(List.of(B("4"),B("3"),B("3")),TachThue.chiaTheoTyLe(B("10"),List.of(B("1"),B("1"),B("1"))));
    }

    @Test
    void UT_TAX_020() {
        assertEquals(List.of(B("2"),B("6")),TachThue.chiaTheoTyLe(B("8"),List.of(B("1"),B("3"))));
    }

    @Test
    void UT_TAX_021() {
        assertEquals(List.of(B("0"),B("0")),TachThue.chiaTheoTyLe(B("0"),List.of(B("1"),B("2"))));
    }
}
