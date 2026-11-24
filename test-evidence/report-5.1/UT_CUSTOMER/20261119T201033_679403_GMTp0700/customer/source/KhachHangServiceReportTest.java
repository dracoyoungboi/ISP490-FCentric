package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.dto.request.PosQuickCustomerCreating;
import com.dev.backend.dto.response.customize.KhachHangDetailDto;
import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.mapper.KhachHangMapperImpl;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhachHangRepository;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Report 5.1: real service/MapStruct; synthetic fixtures and isolated persistence mocks. */
class KhachHangServiceReportTest {
    static final Instant CREATED = Instant.parse("2026-11-01T03:00:00Z");
    static final Instant UPDATED = Instant.parse("2026-11-02T03:00:00Z");
    static final Instant T1 = Instant.parse("2026-11-03T03:00:00Z");
    record Values(Integer id, String maKhachHang, String tenKhachHang, String maSoThue,
                  String nguoiLienHe, String soDienThoai, String email, String diaChi,
                  String loaiKhachHang, Integer trangThai, Instant ngayTao, Instant ngayCapNhat) { }
    static final Values E1 = new Values(10, "KH_TEST_001", "Công ty Ánh Dương", "0101234567", "Nguyễn Văn An",
            "0912345678", "customer@example.test", "Địa chỉ kiểm thử 01", "le", 1, CREATED, UPDATED);
    static KhachHang e1() {
        return KhachHang.builder().id(10).maKhachHang("KH_TEST_001").tenKhachHang("Công ty Ánh Dương")
                .maSoThue("0101234567").nguoiLienHe("Nguyễn Văn An").soDienThoai("0912345678")
                .email("customer@example.test").diaChi("Địa chỉ kiểm thử 01").loaiKhachHang("le").trangThai(1)
                .ngayTao(CREATED).ngayCapNhat(UPDATED).build();
    }
    static KhachHangCreating c1() {
        // Supplemental C1: other optional fields null; no preset customer code or status.
        return KhachHangCreating.builder().tenKhachHang("Nguyễn Văn An").soDienThoai("0912345678")
                .email("an@example.test").loaiKhachHang("le").build();
    }
    static Values values(KhachHang x) {
        assertNotNull(x);
        return new Values(x.getId(), x.getMaKhachHang(), x.getTenKhachHang(), x.getMaSoThue(), x.getNguoiLienHe(),
                x.getSoDienThoai(), x.getEmail(), x.getDiaChi(), x.getLoaiKhachHang(), x.getTrangThai(), x.getNgayTao(), x.getNgayCapNhat());
    }
    static Values values(KhachHangDto x) {
        assertNotNull(x);
        return new Values(x.getId(), x.getMaKhachHang(), x.getTenKhachHang(), x.getMaSoThue(), x.getNguoiLienHe(),
                x.getSoDienThoai(), x.getEmail(), x.getDiaChi(), x.getLoaiKhachHang(), x.getTrangThai(), x.getNgayTao(), x.getNgayCapNhat());
    }
    static void fields(Values expected, Values actual, boolean compareDates) {
        assertAll("Customer fields (DTO equals(id) is insufficient)",
                () -> assertEquals(expected.id(), actual.id(), "id"),
                () -> assertEquals(expected.maKhachHang(), actual.maKhachHang(), "maKhachHang"),
                () -> assertEquals(expected.tenKhachHang(), actual.tenKhachHang(), "tenKhachHang"),
                () -> assertEquals(expected.maSoThue(), actual.maSoThue(), "maSoThue"),
                () -> assertEquals(expected.nguoiLienHe(), actual.nguoiLienHe(), "nguoiLienHe"),
                () -> assertEquals(expected.soDienThoai(), actual.soDienThoai(), "soDienThoai"),
                () -> assertEquals(expected.email(), actual.email(), "email"),
                () -> assertEquals(expected.diaChi(), actual.diaChi(), "diaChi"),
                () -> assertEquals(expected.loaiKhachHang(), actual.loaiKhachHang(), "loaiKhachHang"),
                () -> assertEquals(expected.trangThai(), actual.trangThai(), "trangThai"),
                () -> { if (compareDates) assertEquals(expected.ngayTao(), actual.ngayTao(), "ngayTao"); },
                () -> { if (compareDates) assertEquals(expected.ngayCapNhat(), actual.ngayCapNhat(), "ngayCapNhat"); });
    }
    static Map<String,Object> m(Object... pairs) {
        Map<String,Object> result = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) result.put((String)pairs[i], pairs[i + 1]);
        return result;
    }
    static Map<String,Object> createdExpected(String code, boolean email) {
        var result = m("id",10,"maKhachHang",code,"tenKhachHang","Nguyễn Văn An","soDienThoai","0912345678",
                "loaiKhachHang","le","trangThai",1);
        if (email) result.put("email","an@example.test");
        return result;
    }
    static void created(Values a, String code, boolean checkEmail) {
        assertAll(() -> assertEquals(10,a.id(),"id (mock persistence only)"),
                () -> assertEquals(code,a.maKhachHang(),"maKhachHang (production generated)"),
                () -> assertEquals("Nguyễn Văn An",a.tenKhachHang(),"tenKhachHang"),
                () -> assertEquals("0912345678",a.soDienThoai(),"soDienThoai"),
                () -> assertEquals("le",a.loaiKhachHang(),"loaiKhachHang"),
                () -> assertEquals(1,a.trangThai(),"trangThai (production default)"),
                () -> { if (checkEmail) assertEquals("an@example.test",a.email(),"email"); });
    }
    record OrderValues(Integer id, String soDonHang, String loaiChungTu, Integer khachHangId,
                       Instant ngayDatHang, BigDecimal tongCong, String kenh) { }
    static OrderValues order(DonBanHang d) {
        return new OrderValues(d.getId(),d.getSoDonHang(),d.getLoaiChungTu(),d.getKhachHang().getId(),
                d.getNgayDatHang(),d.getTongCong(),d.getKenhBanHang()==null?null:d.getKenhBanHang().getMaKenh());
    }

    static final class Case implements AutoCloseable {
        static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).configure(JsonGenerator.Feature.ESCAPE_NON_ASCII,true);
        final KhachHangRepository repo = mock(KhachHangRepository.class);
        final DonBanHangRepository history = mock(DonBanHangRepository.class);
        final EntityManager em = mock(EntityManager.class);
        final DieuHanhHeThongService config = mock(DieuHanhHeThongService.class);
        final KhachHangMapper mapper = Mappers.getMapper(KhachHangMapper.class);
        final KhachHangService service;
        final List<Object> persistence = new ArrayList<>();
        KhachHang tracked;
        boolean passed;
        Case(String id) {
            System.out.println("==================================================");
            System.out.println("Test Case ID: " + id);
            System.out.println("Test class: com.dev.backend.services.impl.entities.KhachHangServiceReportTest");
            System.out.println("Test method: " + id);
            assertEquals(KhachHangMapperImpl.class,mapper.getClass());
            service = new KhachHangService(repo,mapper,em,history,config);
            System.out.println("Step 1 - Prepare input: fresh real service and generated MapStruct mapper; fresh repository/EntityManager/config mocks; no Spring or database.");
            System.out.println("Fixture source: supplied supplemental E1/C1; additional mock/order fixtures explicitly logged. No report image independently inspected.");
            when(repo.save(any(KhachHang.class))).thenAnswer(inv -> {
                KhachHang arg = inv.getArgument(0);
                Values before = values(arg);
                boolean assigned = arg.getId() == null;
                if (assigned) arg.setId(10); // Persistence simulation: ID ONLY, no business-field assignments.
                persistence.add(m("method","save","argumentBeforeMock",before,"idAssignedByMock",assigned,
                        "returnedArgument",values(arg)));
                return arg;
            });
            when(repo.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> {
                KhachHang arg = inv.getArgument(0);
                persistence.add(m("method","saveAndFlush","argumentBeforeMock",values(arg),"idAssignedByMock",false,
                        "returnedArgument",values(arg)));
                return arg;
            });
        }
        void log(String label, Object value) { System.out.println(label + ": " + assertDoesNotThrow(() -> JSON.writeValueAsString(value))); }
        void track(KhachHang entity) { tracked=entity; log("Step 1 - Before",values(entity)); }
        void input(Object input) { log("Step 1 - Input",input); }
        void setup(String label, Object result) { log("Step 1 - Mock " + label,result); }
        void expect(Object fields, String interactions) { log("Step 4 - Verify expected result",m("fields",fields,"interactions",interactions)); }
        <T> T call(String function, Supplier<T> operation) {
            System.out.println("Function: KhachHangService."+function);
            System.out.println("Step 2 - Execute: "+function+"; invoke production once.");
            try {
                T actual=operation.get(); log("Step 3 - Actual result",actual); return actual;
            } catch (CommonException ex) {
                log("Step 3 - Actual exception",m("class",ex.getClass().getName(),"messageKey",ex.getThongDiep()==null?null:ex.getThongDiep().khoa(),
                        "status",ex.getStatus().value(),"data",ex.getData()));
                throw ex;
            } catch (RuntimeException | Error ex) { System.out.println("Unexpected exception: "+ex); throw ex; }
        }
        void callVoid(String function, Runnable operation) {
            System.out.println("Function: KhachHangService."+function);
            System.out.println("Step 2 - Execute: "+function+"; invoke production once.");
            try { operation.run(); }
            catch (RuntimeException | Error ex) { System.out.println("Unexpected exception: "+ex); throw ex; }
            log("Step 3 - Void completion",m("return","void","entityAfter",tracked==null?null:values(tracked)));
        }
        CommonException error(String function, String key, HttpStatus status, Supplier<?> operation) {
            expect(m("exceptionClass",CommonException.class.getName(),"messageKey",key,
                    "requiredStatus",status==null?"not specified":status.value()),"See case-specific verify assertions in source.");
            CommonException ex=assertThrows(CommonException.class,() -> call(function,operation));
            assertNotNull(ex.getThongDiep()); assertEquals(key,ex.getThongDiep().khoa(),"message key");
            if(status!=null) assertEquals(status,ex.getStatus(),"exception status, not an HTTP response");
            return ex;
        }
        List<KhachHang> captures(boolean flush,int count) {
            var captor=ArgumentCaptor.forClass(KhachHang.class);
            if(flush) verify(repo,times(count)).saveAndFlush(captor.capture());
            else verify(repo,times(count)).save(captor.capture());
            log("Captured persistence arguments (state at verification)",captor.getAllValues().stream().map(KhachHangServiceReportTest::values).toList());
            return captor.getAllValues();
        }
        void passed() { passed=true; }
        @Override public void close() {
            if(tracked!=null) log("Entity after operation",values(tracked));
            log("Persistence Answer snapshots at call time",persistence);
            List<Object> invocations=new ArrayList<>();
            for(var entry:m("repository",repo,"historyRepository",history,"configuration",config,"entityManager",em).entrySet())
                for(var invocation:mockingDetails(entry.getValue()).getInvocations())
                    invocations.add(m("dependency",entry.getKey(),"method",invocation.getMethod().getName(),"arguments",invocation.getArguments()));
            log("Actual dependency invocations",invocations);
            System.out.println("Assertion result: "+(passed?"PASSED":"FAILED"));
            System.out.println("==================================================");
        }
    }

    @Test void UT_CUSTOMER_001() {
        try(var c=new Case("UT_CUSTOMER_001")) {
            var input=c1(); c.input(input);
            when(c.repo.findFirstBySoDienThoai("0912345678")).thenReturn(Optional.empty());
            when(c.repo.findFirstByEmail("an@example.test")).thenReturn(Optional.empty());
            when(c.repo.existsByMaKhachHang("KH000010")).thenReturn(false);
            when(c.config.getCauHinhString(DieuHanhHeThongServiceImpl.CAU_HINH_MA_KHACH_HANG_TIEN_TO,
                    DieuHanhHeThongServiceImpl.MA_KHACH_HANG_TIEN_TO_MAC_DINH)).thenReturn("KH");
            c.setup("contact lookups / existsByMaKhachHang / prefix",m("phone",null,"email",null,"codeExists",false,"prefix","KH","mockAssignedId",10));
            c.expect(createdExpected("KH000010",true),"Two saves; configuration prefix and code collision check. ID only assigned by persistence mock.");
            var actual=assertDoesNotThrow(() -> c.call("create(creating)",() -> c.service.create(input)));
            created(values(actual),"KH000010",true);
            var saved=c.captures(false,2); created(values(saved.get(1)),"KH000010",true);
            verify(c.repo).findFirstBySoDienThoai("0912345678"); verify(c.repo).findFirstByEmail("an@example.test");
            verify(c.repo).existsByMaKhachHang("KH000010");
            verify(c.config).getCauHinhString("MA_KHACH_HANG_TIEN_TO","KH");
            assertEquals(2,c.persistence.size()); c.passed();
        }
    }
    @Test void UT_CUSTOMER_002() {
        try(var c=new Case("UT_CUSTOMER_002")) {
            var input=c1(); input.setSoDienThoai(null); input.setEmail(null); c.input(input);
            c.error("create(creating)","banHang.canLienHeKhachHang",null,() -> c.service.create(input));
            verify(c.repo,never()).save(any(KhachHang.class)); c.passed();
        }
    }
    @Test void UT_CUSTOMER_003() {
        try(var c=new Case("UT_CUSTOMER_003")) {
            var other=e1(); other.setId(20); other.setMaKhachHang("KH_OTHER_020"); other.setTrangThai(0);
            when(c.repo.findFirstBySoDienThoai("0912345678")).thenReturn(Optional.of(other));
            c.setup("findFirstBySoDienThoai",values(other)); var input=c1(); c.input(input);
            c.error("create(creating)","banHang.soDienThoaiDaThuocKhachMa",HttpStatus.CONFLICT,() -> c.service.create(input));
            verify(c.repo).findFirstBySoDienThoai("0912345678"); verify(c.repo,never()).save(any(KhachHang.class)); c.passed();
        }
    }
    @Test void UT_CUSTOMER_004() {
        try(var c=new Case("UT_CUSTOMER_004")) {
            var other=e1(); other.setId(20); other.setMaKhachHang("KH_OTHER_020"); other.setEmail("an@example.test");
            when(c.repo.findFirstBySoDienThoai("0912345678")).thenReturn(Optional.empty());
            when(c.repo.findFirstByEmail("an@example.test")).thenReturn(Optional.of(other));
            c.setup("phone lookup",null); c.setup("email lookup",values(other)); var input=c1(); c.input(input);
            c.error("create(creating)","banHang.emailDaThuocKhachMa",HttpStatus.CONFLICT,() -> c.service.create(input));
            verify(c.repo).findFirstBySoDienThoai("0912345678"); verify(c.repo).findFirstByEmail("an@example.test");
            verify(c.repo,never()).save(any(KhachHang.class)); c.passed();
        }
    }
    @Test void UT_CUSTOMER_005() {
        try(var c=new Case("UT_CUSTOMER_005")) {
            var input=c1(); input.setSoDienThoai("12345"); c.input(input);
            c.error("create(creating)","banHang.soDienThoaiKhongHopLe",null,() -> c.service.create(input));
            verify(c.repo,never()).save(any(KhachHang.class)); c.passed();
        }
    }
    @Test void UT_CUSTOMER_006() {
        try(var c=new Case("UT_CUSTOMER_006")) {
            var input=PosQuickCustomerCreating.builder().tenKhachHang(" Nguyễn Văn An ").soDienThoai("0912 345 678").build(); c.input(input);
            when(c.repo.findFirstBySoDienThoai("0912345678")).thenReturn(Optional.empty());
            when(c.repo.existsByMaKhachHang("KH0912345678")).thenReturn(false);
            c.setup("normalized phone lookup and code collision",m("phoneResult",null,"codeExists",false,"mockAssignedId",10));
            c.expect(createdExpected("KH0912345678",false),"save once; lookup normalized phone and production-generated code.");
            var actual=assertDoesNotThrow(() -> c.call("quickCreateForPos(request)",() -> c.service.quickCreateForPos(input)));
            created(values(actual),"KH0912345678",false); created(values(c.captures(false,1).get(0)),"KH0912345678",false);
            verify(c.repo).findFirstBySoDienThoai("0912345678"); verify(c.repo).existsByMaKhachHang("KH0912345678"); c.passed();
        }
    }
    @Test void UT_CUSTOMER_007() {
        try(var c=new Case("UT_CUSTOMER_007")) {
            var existing=e1(); when(c.repo.findFirstBySoDienThoai("0912345678")).thenReturn(Optional.of(existing)); c.setup("phone lookup",values(existing));
            var input=PosQuickCustomerCreating.builder().tenKhachHang("Khách mới").soDienThoai("0912345678").build(); c.input(input);
            var ex=c.error("quickCreateForPos(request)","banHang.soDienThoaiDaThuocKhach",HttpStatus.CONFLICT,() -> c.service.quickCreateForPos(input));
            var data=assertInstanceOf(KhachHangDto.class,ex.getData()); fields(E1,values(data),true);
            c.log("Expected exception data",E1); verify(c.repo).findFirstBySoDienThoai("0912345678"); verify(c.repo,never()).save(any(KhachHang.class)); c.passed();
        }
    }
    @Test void UT_CUSTOMER_008() {
        try(var c=new Case("UT_CUSTOMER_008")) {
            var entity=e1(); c.track(entity); when(c.repo.findById(10)).thenReturn(Optional.of(entity));
            var input=KhachHangUpdating.builder().tenKhachHang("Nguyễn Minh An").build(); c.input(m("id",10,"updating",input));
            var expected=new Values(10,"KH_TEST_001","Nguyễn Minh An","0101234567","Nguyễn Văn An","0912345678",
                    "customer@example.test","Địa chỉ kiểm thử 01","le",1,null,null);
            var expectedFields=new LinkedHashMap<>(Case.JSON.<Map<String,Object>>convertValue(expected,Map.class));
            expectedFields.remove("ngayTao"); expectedFields.remove("ngayCapNhat");
            c.expect(m("requiredFields",expectedFields,"dates","Not asserted: report does not require unchanged ngayCapNhat."),"saveAndFlush once; capture actual entity.");
            var actual=assertDoesNotThrow(() -> c.call("update(id, updating)",() -> c.service.update(10,input)));
            fields(expected,values(actual),false); fields(expected,values(c.captures(true,1).get(0)),false);
            verify(c.repo).findById(10); c.passed();
        }
    }
    @Test void UT_CUSTOMER_009() {
        try(var c=new Case("UT_CUSTOMER_009")) {
            var entity=e1(); c.track(entity); when(c.repo.findById(10)).thenReturn(Optional.of(entity));
            var input=KhachHangUpdating.builder().soDienThoai("").email("").build(); c.input(m("id",10,"updating",input));
            c.error("update(id, updating)","banHang.canLienHeKhachHang",null,() -> c.service.update(10,input));
            verify(c.repo).findById(10); verify(c.repo,never()).saveAndFlush(any(KhachHang.class)); c.passed();
        }
    }
    @Test void UT_CUSTOMER_010() {
        try(var c=new Case("UT_CUSTOMER_010")) {
            var entity=e1(); c.track(entity); when(c.repo.findById(10)).thenReturn(Optional.of(entity));
            var input=KhachHangUpdating.builder().trangThai(2).build(); c.input(m("id",10,"updating",input));
            c.error("update(id, updating)","banHang.trangThaiKhachHangSai",null,() -> c.service.update(10,input));
            verify(c.repo).findById(10); verify(c.repo,never()).saveAndFlush(any(KhachHang.class)); c.passed();
        }
    }
    @Test void UT_CUSTOMER_011() {
        try(var c=new Case("UT_CUSTOMER_011")) {
            var entity=e1(); entity.setId(1); entity.setMaKhachHang("KHLE"); c.track(entity); when(c.repo.findById(1)).thenReturn(Optional.of(entity));
            var input=KhachHangUpdating.builder().tenKhachHang("Changed name").build(); c.input(m("id",1,"updating",input));
            c.error("update(id, updating)","banHang.khachLeKhongSua",HttpStatus.CONFLICT,() -> c.service.update(1,input));
            verify(c.repo).findById(1); verify(c.repo,never()).saveAndFlush(any(KhachHang.class)); c.passed();
        }
    }
    @Test void UT_CUSTOMER_012() {
        try(var c=new Case("UT_CUSTOMER_012")) {
            var entity=e1(); c.track(entity); when(c.repo.findById(10)).thenReturn(Optional.of(entity)); c.input(m("id",10));
            c.expect(m("return","void","trangThai",0),"save(E1) once; no physical customer/history deletion, checked through repository APIs and no extra interactions. Mock scope only.");
            assertDoesNotThrow(() -> c.callVoid("xoaMem(id)",() -> c.service.xoaMem(10)));
            assertEquals(0,entity.getTrangThai()); var saved=c.captures(false,1).get(0); assertSame(entity,saved); assertEquals(0,saved.getTrangThai());
            verify(c.repo).findById(10);
            verify(c.repo,never()).delete(any(KhachHang.class)); verify(c.repo,never()).deleteById(anyInt());
            verify(c.repo,never()).deleteAll(); verify(c.repo,never()).deleteAll(anyIterable()); verify(c.repo,never()).deleteAllById(anyIterable());
            verify(c.repo,never()).deleteAllInBatch(); verify(c.repo,never()).deleteAllInBatch(anyIterable()); verify(c.repo,never()).deleteAllByIdInBatch(anyIterable());
            verifyNoMoreInteractions(c.repo); verifyNoInteractions(c.history,c.em); c.passed();
        }
    }
    @Test void UT_CUSTOMER_013() {
        try(var c=new Case("UT_CUSTOMER_013")) {
            var entity=e1(); entity.setId(1); entity.setMaKhachHang("KHLE"); c.track(entity); when(c.repo.findById(1)).thenReturn(Optional.of(entity)); c.input(m("id",1));
            c.error("xoaMem(id)","banHang.khachLeKhongSua",HttpStatus.CONFLICT,() -> { c.service.xoaMem(1); return null; });
            verify(c.repo).findById(1); verify(c.repo,never()).save(any(KhachHang.class)); c.passed();
        }
    }
    @Test void UT_CUSTOMER_014() {
        try(var c=new Case("UT_CUSTOMER_014")) {
            var active=e1(); var stopped=e1(); stopped.setId(20); stopped.setMaKhachHang("KH_TEST_002"); stopped.setTrangThai(0);
            var missing=e1(); missing.setId(30); missing.setMaKhachHang("KH_TEST_003"); missing.setTrangThai(null);
            when(c.repo.findAll()).thenReturn(List.of(active,stopped,missing)); c.setup("findAll ordered result",List.of(values(active),values(stopped),values(missing))); c.input(m("parameters",List.of()));
            c.expect(List.of(E1),"findAll once; production filters statuses 0 and null; exact one DTO.");
            var actual=assertDoesNotThrow(() -> c.call("getAllActiveForSales()",c.service::getAllActiveForSales));
            assertNotNull(actual); assertEquals(1,actual.size()); fields(E1,values(actual.get(0)),true); verify(c.repo).findAll(); c.passed();
        }
    }
    @Test void UT_CUSTOMER_015() {
        try(var c=new Case("UT_CUSTOMER_015")) {
            var entity=e1(); when(c.repo.findById(10)).thenReturn(Optional.of(entity)); c.setup("findById",values(entity));
            var q1=DonBanHang.builder().id(101).soDonHang("Q001").loaiChungTu("bao_gia").khachHang(entity).ngayDatHang(T1)
                    .tongCong(new BigDecimal("50000")).kenhBanHang(null).build();
            var s1=DonBanHang.builder().id(102).soDonHang("SO001").loaiChungTu("don_ban_hang").khachHang(entity).ngayDatHang(T1)
                    .tongCong(new BigDecimal("120000")).kenhBanHang(null).build();
            when(c.history.findByKhachHangIdOrderByNgayDatHangDesc(10)).thenReturn(List.of(q1,s1));
            c.setup("history query ordered result Q1 then S1",List.of(order(q1),order(s1))); c.input(m("id",10));
            c.expect(m("customer",m("id",10,"maKhachHang",E1.maKhachHang(),"tenKhachHang",E1.tenKhachHang(),"soDienThoai",E1.soDienThoai(),"email",E1.email(),"diaChi",E1.diaChi()),
                    "tongSoDonHang",1,"lichSuMuaHang",List.of(m("maDonHang","SO001","ngay",T1,"kenh",null,"giaTri",new BigDecimal("120000")))),
                    "History query once with id10; service must remove Q1, mock returns both Q1/S1 unfiltered.");
            KhachHangDetailDto actual=assertDoesNotThrow(() -> c.call("getKhachHangDetail(id)",() -> c.service.getKhachHangDetail(10)));
            assertNotNull(actual);
            assertAll(() -> assertEquals(10,actual.getId()), () -> assertEquals(E1.maKhachHang(),actual.getMaKhachHang()),
                    () -> assertEquals(E1.tenKhachHang(),actual.getTenKhachHang()), () -> assertEquals(E1.soDienThoai(),actual.getSoDienThoai()),
                    () -> assertEquals(E1.email(),actual.getEmail()), () -> assertEquals(E1.diaChi(),actual.getDiaChi()),
                    () -> assertEquals(1,actual.getTongSoDonHang()));
            assertNotNull(actual.getLichSuMuaHang()); assertEquals(1,actual.getLichSuMuaHang().size()); var line=actual.getLichSuMuaHang().get(0);
            assertAll(() -> assertEquals("SO001",line.getMaDonHang()), () -> assertEquals(T1,line.getNgay()), () -> assertNull(line.getKenh()),
                    () -> { assertNotNull(line.getGiaTri()); assertEquals(0,new BigDecimal("120000").compareTo(line.getGiaTri())); });
            verify(c.repo).findById(10); verify(c.history).findByKhachHangIdOrderByNgayDatHangDesc(10); c.passed();
        }
    }
    @Test void UT_CUSTOMER_016() {
        try(var c=new Case("UT_CUSTOMER_016")) {
            when(c.repo.findById(999)).thenReturn(Optional.empty()); c.setup("findById(999)",null); c.input(m("id",999));
            c.error("getKhachHangDetail(id)","banHang.khachHangKhongTimThayVoiId",null,() -> c.service.getKhachHangDetail(999));
            verify(c.repo).findById(999); verifyNoInteractions(c.history); c.passed();
        }
    }
}
