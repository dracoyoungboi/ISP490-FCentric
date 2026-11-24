package com.dev.backend.services.impl;
import com.dev.backend.dto.request.*;
import com.dev.backend.constant.enums.*;
import com.dev.backend.exception.customize.InvalidFieldException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.jpa.domain.Specification;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.function.ThrowingSupplier;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class BaseServiceReportTest {
 static class TestEntity {
  @Id @Column Integer id; @Column String ten; @Column Integer trangThai;
  @Column String matKhauHash;
  TestEntity(Integer i,String t,Integer s){id=i;ten=t;trangThai=s;}
 }
 interface Repo extends JpaRepository<TestEntity,Integer>,JpaSpecificationExecutor<TestEntity>{}
 static class Svc extends BaseServiceImpl<TestEntity,Integer>{
  Svc(Repo r){super(r);} protected EntityManager getEntityManager(){return null;}
  Pageable pageable(List<SortCriteria> s,Integer p,Integer n){return createPageable(s,p,n);}
 }
 static Object view(Object o){
  if(o instanceof TestEntity x)return Map.of("id",x.id,"ten",x.ten,"trangThai",x.trangThai);
  if(o instanceof Page<?> p)return Map.of("content",p.getContent().stream().map(BaseServiceReportTest::view).toList(),"total",p.getTotalElements(),"page",p.getNumber(),"size",p.getSize());
  if(o instanceof Pageable p)return Map.of("page",p.getPageNumber(),"size",p.getPageSize(),"sort",p.getSort().toString());
  if(o instanceof Throwable t){var d=new LinkedHashMap<String,Object>();d.put("exceptionClass",t.getClass().getName()); if(t instanceof InvalidFieldException f)d.put("messageKey",f.getThongDiep().khoa());else d.put("message",t.getMessage());return d;}
  if(o instanceof Specification<?>)return "non-null Specification";
  if(o instanceof Map<?,?> m){var d=new LinkedHashMap<String,Object>();m.forEach((k,v)->d.put(k.toString(),view(v)));return d;}
  return o;
 }
 static String json(Object o){try{return new ObjectMapper().writeValueAsString(view(o));}catch(Exception e){throw new RuntimeException(e);}}
 static class C implements AutoCloseable {
  final Repo r=mock(Repo.class);final Svc svc=new Svc(r);boolean pass;
  C(int n,Object input){when(r.findById(10)).thenReturn(n==2||n==6?Optional.empty():Optional.of(new TestEntity(10,"Original name",1)));when(r.save(any())).thenAnswer(a->a.getArgument(0));
   System.out.println("==================================================\nTest Case ID: UT_BASE_"+String.format("%03d",n));System.out.println("Test class: com.dev.backend.services.impl.BaseServiceReportTest\nTest method: UT_BASE_"+String.format("%03d",n));System.out.println("Step 1 - Prepare input: "+json(input)+(n==2||n==6?"; repository fixture=Optional.empty(); save Answer returns argument0":"; repository fixture={id:10,ten:Original name,trangThai:1}; save Answer returns argument0"));System.out.println("Step 2 - Execute: real BaseServiceImpl operation; see archived method source.");}
  <T>T call(ThrowingSupplier<T> f)throws Throwable{try{T a=f.get();emit(a);return a;}catch(Throwable t){emit(t);throw t;}}
  void emit(Object a){var calls=mockingDetails(r).getInvocations().stream().map(i->Map.of("method",i.getMethod().getName(),"arguments",Arrays.stream(i.getArguments()).map(BaseServiceReportTest::view).toList())).toList();System.out.println("Timeline: "+json(Map.of("stage","action","result",view(a),"interactions",calls)));}
  public void close(){System.out.println("Step 3 - Actual result: exact result and recorded interactions above.");System.out.println("Step 4 - Verify expected result: field/exception/captor assertions in archived source; PASSED only after verification.");System.out.println("Assertion result: "+(pass?"PASSED":"FAILED")+"\n==================================================");}
 }
 static void entity(TestEntity a,int id,String ten,int status){assertNotNull(a);assertEquals(id,a.id);assertEquals(ten,a.ten);assertEquals(status,a.trangThai);}
 static void key(InvalidFieldException e,String k){assertNotNull(e.getThongDiep());assertEquals(k,e.getThongDiep().khoa());}
 static SortCriteria sort(String f,SortDirection d){return SortCriteria.builder().fieldName(f).direction(d).build();}
 @Test void UT_BASE_001(){var input=new TestEntity(99,"Updated name",1);try(var c=new C(1,input)){var a=assertDoesNotThrow(()->c.call(()->c.svc.update(10,input)));entity(a,10,"Updated name",1);c.pass=true;}}
 @Test void UT_BASE_002(){try(var c=new C(2,new TestEntity(10,"Updated name",1))){when(c.r.findById(10)).thenReturn(Optional.empty());var ex=assertThrowsExactly(IllegalArgumentException.class,()->c.call(()->c.svc.update(10,new TestEntity(10,"Updated name",1))));assertEquals("Entity not found for id: 10",ex.getMessage());c.pass=true;}}
 @Test void UT_BASE_003(){var m=new LinkedHashMap<String,Object>();m.put("id",99);m.put("ten","Updated name");m.put("trangThai","0");try(var c=new C(3,m)){var a=assertDoesNotThrow(()->c.call(()->c.svc.updateFromMap(10,m)));entity(a,10,"Updated name",0);c.pass=true;}}
 @Test void UT_BASE_004(){try(var c=new C(4,Map.of("unknownField","value"))){key(assertThrowsExactly(InvalidFieldException.class,()->c.call(()->c.svc.updateFromMap(10,Map.of("unknownField","value")))),"heThong.fieldKhongTonTai");c.pass=true;}}
 @Test void UT_BASE_005(){try(var c=new C(5,Map.of("id",10,"status",0))){var a=assertDoesNotThrow(()->c.call(()->c.svc.changeStatus(10,0)));entity(a,10,"Original name",0);var cap=ArgumentCaptor.forClass(TestEntity.class);verify(c.r).save(cap.capture());entity(cap.getValue(),10,"Original name",0);c.pass=true;}}
 @Test void UT_BASE_006(){try(var c=new C(6,Map.of("id",10,"status",0))){when(c.r.findById(10)).thenReturn(Optional.empty());var ex=assertThrowsExactly(IllegalArgumentException.class,()->c.call(()->c.svc.changeStatus(10,0)));assertEquals("Entity not found for id: 10",ex.getMessage());verify(c.r,never()).save(any());c.pass=true;}}
 @Test void UT_BASE_007(){try(var c=new C(7,"sorts=[],page=null,size=null")){var a=assertDoesNotThrow(()->c.call(()->c.svc.pageable(List.of(),null,null)));assertEquals(0,a.getPageNumber());assertEquals(20,a.getPageSize());assertTrue(a.getSort().isUnsorted());c.pass=true;}}
 @Test void UT_BASE_008(){try(var c=new C(8,"ten DESC,page=1,size=10")){var a=assertDoesNotThrow(()->c.call(()->c.svc.pageable(List.of(sort("ten",SortDirection.DESC)),1,10)));assertEquals(1,a.getPageNumber());assertEquals(10,a.getPageSize());var orders=a.getSort().stream().toList();assertEquals(1,orders.size());assertEquals("ten",orders.get(0).getProperty());assertEquals(Sort.Direction.DESC,orders.get(0).getDirection());c.pass=true;}}
 @Test void UT_BASE_009(){try(var c=new C(9,"matKhauHash ASC,page0,size20; mapped sensitive field exists")){key(assertThrowsExactly(InvalidFieldException.class,()->c.call(()->c.svc.pageable(List.of(sort("matKhauHash",SortDirection.ASC)),0,20))),"heThong.khongDuocLocTruongNay");c.pass=true;}}
 @Test void UT_BASE_010(){try(var c=new C(10,"unknownField ASC,page0,size20")){key(assertThrowsExactly(InvalidFieldException.class,()->c.call(()->c.svc.pageable(List.of(sort("unknownField",SortDirection.ASC)),0,20))),"heThong.fieldKhongHopLe");c.pass=true;}}
 @Test void UT_BASE_011(){try(var c=new C(11,"filters=[],sorts=[],page0,size20; mocked Page E1/total1")){var e=new TestEntity(10,"Sample name",1);Page<TestEntity> expected=new PageImpl<>(List.of(e),PageRequest.of(0,20),1);when(c.r.findAll(any(Specification.class),any(Pageable.class))).thenReturn(expected);var req=BaseFilterRequest.builder().filters(List.of()).sorts(List.of()).page(0).size(20).build();var a=assertDoesNotThrow(()->c.call(()->c.svc.filter(req)));assertSame(expected,a);assertEquals(1,a.getContent().size());entity(a.getContent().get(0),10,"Sample name",1);assertEquals(1,a.getTotalElements());assertEquals(0,a.getNumber());assertEquals(20,a.getSize());var sc=ArgumentCaptor.forClass(Specification.class);var pc=ArgumentCaptor.forClass(Pageable.class);verify(c.r).findAll(sc.capture(),pc.capture());assertNotNull(sc.getValue());assertEquals(0,pc.getValue().getPageNumber());assertEquals(20,pc.getValue().getPageSize());assertTrue(pc.getValue().getSort().isUnsorted());c.pass=true;}}
 @Test void UT_BASE_012(){try(var c=new C(12,"filters=[],quanLy.matKhauHash ASC,page0,size20 PROPOSED; not read from image")){var req=BaseFilterRequest.builder().filters(List.of()).sorts(List.of(sort("quanLy.matKhauHash",SortDirection.ASC))).page(0).size(20).build();key(assertThrowsExactly(InvalidFieldException.class,()->c.call(()->c.svc.filter(req))),"heThong.khongDuocLocTruongNay");verify(c.r,never()).findAll(any(Specification.class),any(Pageable.class));c.pass=true;}}
}
