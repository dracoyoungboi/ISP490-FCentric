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
class Report51BASETest {

    static final Instant T0=Instant.parse("2026-01-01T00:00:00Z");
    static BigDecimal B(String s){return new BigDecimal(s);}
    static PhanBoLoFifo.Lo L(int id,String q){return new PhanBoLoFifo.Lo(id,B(q));}
    static void assertBd(String expected,BigDecimal actual){assertEquals(0,B(expected).compareTo(actual));}
    static void assertKey(String key,CoThongDiep ex){assertNotNull(ex.getThongDiep());assertEquals(key,ex.getThongDiep().khoa());}

    interface Repo extends JpaRepository<Row,Integer>, JpaSpecificationExecutor<Row> {}
    static class Parent { @jakarta.persistence.Id @jakarta.persistence.Column Integer id; }
    static class Row extends Parent {
        @jakarta.persistence.Column String name="old";
        @jakarta.persistence.Column Integer trangThai=0;
        @jakarta.persistence.Column Long amount=1L;
        @jakarta.persistence.Column Boolean enabled=false;
        @jakarta.persistence.Column UUID uuid;
        @jakarta.persistence.Column BigDecimal price;
        @jakarta.persistence.Column String matKhauHash;
    }
    static class Svc extends BaseServiceImpl<Row,Integer> {
        Svc(JpaRepository<Row,Integer> r){super(r);}
        protected EntityManager getEntityManager(){return null;}
        void valid(String s){validateFieldName(s);}
        Pageable pageable(List<SortCriteria> s,Integer p,Integer n){return createPageable(s,p,n);}
        Predicate pred(CriteriaBuilder cb,Path<?> p,FilterCriteria f){return createPredicate(cb,p,f);}
        Specification<Row> spec(List<FilterCriteria> f){return createSpecification(f);}
    }

    @Test
    void UT_BASE_001() {
        var repo=mock(Repo.class); var svc=new Svc(repo); when(repo.findById(7)).thenReturn(Optional.empty()); var ex=assertThrows(IllegalArgumentException.class,()->svc.update(7,new Row())); assertEquals("Entity not found for id: 7",ex.getMessage()); verify(repo,never()).save(any());
    }

    @Test
    void UT_BASE_002() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var row=new Row(); when(repo.findById(7)).thenReturn(Optional.of(new Row())); when(repo.save(any())).thenAnswer(a->a.getArgument(0)); assertSame(row,svc.update(7,row)); assertEquals(7,row.id); verify(repo).save(row);
    }

    @Test
    void UT_BASE_003() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var row=new Row(); when(repo.findById(7)).thenReturn(Optional.of(row)); assertSame(row,svc.updateFromMap(7,null)); verify(repo,never()).save(any());
    }

    @Test
    void UT_BASE_004() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var row=new Row(); when(repo.findById(7)).thenReturn(Optional.of(row)); assertSame(row,svc.updateFromMap(7,Map.of())); verify(repo,never()).save(any());
    }

    @Test
    void UT_BASE_005() {
        var repo=mock(Repo.class); var svc=new Svc(repo); when(repo.findById(7)).thenReturn(Optional.empty()); assertThrows(IllegalArgumentException.class,()->svc.updateFromMap(7,Map.of("unknown","x"))); verify(repo,never()).save(any());
    }

    @Test
    void UT_BASE_006() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var row=new Row(); row.id=7; when(repo.findById(7)).thenReturn(Optional.of(row)); svc.updateFromMap(7,Map.of("id",9,"name","new")); assertEquals(7,row.id); assertEquals("new",row.name); verify(repo).save(row);
    }

    @Test
    void UT_BASE_007() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var row=new Row(); when(repo.findById(7)).thenReturn(Optional.of(row)); svc.updateFromMap(7,Map.of("trangThai","2")); assertEquals(2,row.trangThai); verify(repo).save(row);
    }

    @Test
    void UT_BASE_008() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var row=new Row(); when(repo.findById(7)).thenReturn(Optional.of(row)); svc.updateFromMap(7,Map.of("amount","123")); assertEquals(123L,row.amount); verify(repo).save(row);
    }

    @Test
    void UT_BASE_009() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var row=new Row(); when(repo.findById(7)).thenReturn(Optional.of(row)); svc.updateFromMap(7,Map.of("enabled","true")); assertTrue(row.enabled); verify(repo).save(row);
    }

    @Test
    void UT_BASE_010() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var row=new Row(); when(repo.findById(7)).thenReturn(Optional.of(row)); svc.updateFromMap(7,Map.of("uuid","00000000-0000-0000-0000-000000000007")); assertEquals(UUID.fromString("00000000-0000-0000-0000-000000000007"),row.uuid); verify(repo).save(row);
    }

    @Test
    void UT_BASE_011() {
        var repo=mock(Repo.class); var svc=new Svc(repo); when(repo.findById(7)).thenReturn(Optional.of(new Row())); assertKey("heThong.fieldKhongTonTai",assertThrows(InvalidFieldException.class,()->svc.updateFromMap(7,Map.of("unknown",1)))); verify(repo,never()).save(any());
    }

    @Test
    void UT_BASE_012() {
        var repo=mock(Repo.class); var svc=new Svc(repo); when(repo.findById(7)).thenReturn(Optional.of(new Row())); assertKey("heThong.khongCapNhatDuocField",assertThrows(LoiTrangThaiException.class,()->svc.updateFromMap(7,Map.of("trangThai","abc")))); verify(repo,never()).save(any());
    }

    @Test
    void UT_BASE_013() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var row=new Row(); when(repo.findById(7)).thenReturn(Optional.of(row)); svc.changeStatus(7,2); assertEquals(2,row.trangThai); verify(repo).save(row);
    }

    @Test
    void UT_BASE_014() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertThrows(IllegalArgumentException.class,()->svc.changeStatus(7,2)); verify(repo,never()).save(any());
    }

    @Test
    void UT_BASE_015() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.khongDuocLocTruongNay",assertThrows(InvalidFieldException.class,()->svc.valid("matKhauHash"))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_016() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.khongDuocLocTruongNay",assertThrows(InvalidFieldException.class,()->svc.valid("name.apiKey"))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_017() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.khongDuocLocTruongNay",assertThrows(InvalidFieldException.class,()->svc.valid("name.MatKhauHash"))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_018() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.khongDuocLocTruongNay",assertThrows(InvalidFieldException.class,()->svc.valid("name.apiSecret"))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_019() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.khongDuocLocTruongNay",assertThrows(InvalidFieldException.class,()->svc.valid("name.refreshToken"))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_020() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.khongDuocLocTruongNay",assertThrows(InvalidFieldException.class,()->svc.valid("name.clientId"))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_021() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.khongDuocLocTruongNay",assertThrows(InvalidFieldException.class,()->svc.valid("name.apiKeyMaHoa"))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_022() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.khongDuocLocTruongNay",assertThrows(InvalidFieldException.class,()->svc.valid("name.checksumKeyMaHoa"))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_023() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.khongDuocLocTruongNay",assertThrows(InvalidFieldException.class,()->svc.valid("name.clientIdMaHoa"))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_024() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.fieldKhongHopLe",assertThrows(InvalidFieldException.class,()->svc.valid("unknown")));
    }

    @Test
    void UT_BASE_025() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertDoesNotThrow(()->svc.valid("id"));
    }

    @Test
    void UT_BASE_026() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var p=svc.pageable(List.of(),null,null); assertEquals(0,p.getPageNumber()); assertEquals(20,p.getPageSize()); assertTrue(p.getSort().isUnsorted());
    }

    @Test
    void UT_BASE_027() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertThrows(IllegalArgumentException.class,()->svc.pageable(List.of(),-1,20));
    }

    @Test
    void UT_BASE_028() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertThrows(IllegalArgumentException.class,()->svc.pageable(List.of(),0,0));
    }

    @Test
    void UT_BASE_029() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var p=svc.pageable(List.of(new SortCriteria("name",SortDirection.DESC),new SortCriteria("id",null)),2,5); assertEquals(2,p.getPageNumber()); assertEquals(5,p.getPageSize()); assertEquals(List.of(new Sort.Order(Sort.Direction.DESC,"name"),new Sort.Order(Sort.Direction.ASC,"id")),p.getSort().toList());
    }

    @Test
    void UT_BASE_030() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var cb=mock(CriteriaBuilder.class); var path=mock(Path.class); var expected=mock(Predicate.class); when(cb.isNull(path)).thenReturn(expected); assertSame(expected,svc.pred(cb,path,FilterCriteria.builder().fieldName("name").operation(FilterOperation.IS_NULL).build())); verify(cb).isNull(path);
    }

    @Test
    void UT_BASE_031() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var cb=mock(CriteriaBuilder.class); var path=mock(Path.class); var expected=mock(Predicate.class); when(cb.isNotNull(path)).thenReturn(expected); assertSame(expected,svc.pred(cb,path,FilterCriteria.builder().fieldName("name").operation(FilterOperation.IS_NOT_NULL).build())); verify(cb).isNotNull(path);
    }

    @Test
    void UT_BASE_032() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var cb=mock(CriteriaBuilder.class); assertNull(svc.pred(cb,mock(Path.class),FilterCriteria.builder().fieldName("name").operation(FilterOperation.EQUALS).build())); verifyNoInteractions(cb);
    }

    @Test
    void UT_BASE_033() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.likeChiChoString",assertThrows(LoiThamSoException.class,()->svc.pred(mock(CriteriaBuilder.class),mock(Path.class),FilterCriteria.builder().fieldName("name").operation(FilterOperation.LIKE).value(7).build())));
    }

    @Test
    void UT_BASE_034() {
        var repo=mock(Repo.class); var svc=new Svc(repo); assertKey("heThong.ilikeChiChoString",assertThrows(LoiThamSoException.class,()->svc.pred(mock(CriteriaBuilder.class),mock(Path.class),FilterCriteria.builder().fieldName("name").operation(FilterOperation.ILIKE).value(7).build())));
    }

    @Test
    void UT_BASE_035() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var request=new BaseFilterRequest(); request.setSorts(List.of(new SortCriteria("matKhauHash",null))); assertThrows(InvalidFieldException.class,()->svc.filter(request)); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_036() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var request=new BaseFilterRequest(); request.setSize(0); assertKey("heThong.loiKhiFilter",assertThrows(LoiChungException.class,()->svc.filter(request))); verifyNoInteractions(repo);
    }

    @Test
    void UT_BASE_037() {
        var repo=mock(Repo.class); var svc=new Svc(repo); var cb=mock(CriteriaBuilder.class); var expected=mock(Predicate.class); when(cb.conjunction()).thenReturn(expected); assertSame(expected,svc.spec(null).toPredicate(mock(Root.class),mock(CriteriaQuery.class),cb));
    }
}
