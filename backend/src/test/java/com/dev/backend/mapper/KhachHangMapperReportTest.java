package com.dev.backend.mapper;

import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.entities.KhachHang;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Instant;
import java.util.List;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import static org.junit.jupiter.api.Assertions.*;

/** Supplemental synthetic E1/D1 from the conversation; original report fixture was not recovered. */
class KhachHangMapperReportTest {
    record Fields(Integer id, String maKhachHang, String tenKhachHang, String maSoThue,
                  String nguoiLienHe, String soDienThoai, String email, String diaChi,
                  String loaiKhachHang, Integer trangThai, Instant ngayTao, Instant ngayCapNhat) { }

    // Explicit independent expected values, never obtained from any mapper invocation.
    static final Fields E1 = new Fields(10, "KH_TEST_001", "Công ty Ánh Dương", "0101234567",
            "Nguyễn Văn An", "0912345678", "customer@example.test", "Địa chỉ kiểm thử 01", "le", 1,
            Instant.parse("2026-11-01T03:00:00Z"), Instant.parse("2026-11-02T03:00:00Z"));
    static final Fields D1 = new Fields(10, "KH_TEST_001", "Công ty Ánh Dương", "0101234567",
            "Nguyễn Văn An", "0912345678", "customer@example.test", "Địa chỉ kiểm thử 01", "le", 1,
            Instant.parse("2026-11-01T03:00:00Z"), Instant.parse("2026-11-02T03:00:00Z"));

    static KhachHang e1() {
        return KhachHang.builder().id(E1.id()).maKhachHang(E1.maKhachHang()).tenKhachHang(E1.tenKhachHang())
                .maSoThue(E1.maSoThue()).nguoiLienHe(E1.nguoiLienHe()).soDienThoai(E1.soDienThoai())
                .email(E1.email()).diaChi(E1.diaChi()).loaiKhachHang(E1.loaiKhachHang()).trangThai(E1.trangThai())
                .ngayTao(E1.ngayTao()).ngayCapNhat(E1.ngayCapNhat()).build();
    }

    static KhachHangDto d1() {
        return KhachHangDto.builder().id(D1.id()).maKhachHang(D1.maKhachHang()).tenKhachHang(D1.tenKhachHang())
                .maSoThue(D1.maSoThue()).nguoiLienHe(D1.nguoiLienHe()).soDienThoai(D1.soDienThoai())
                .email(D1.email()).diaChi(D1.diaChi()).loaiKhachHang(D1.loaiKhachHang()).trangThai(D1.trangThai())
                .ngayTao(D1.ngayTao()).ngayCapNhat(D1.ngayCapNhat()).build();
    }

    // Value snapshots read getters only. Strings, Integers and Instants are immutable.
    static Fields snapshot(KhachHang x) {
        assertNotNull(x);
        return new Fields(x.getId(), x.getMaKhachHang(), x.getTenKhachHang(), x.getMaSoThue(),
                x.getNguoiLienHe(), x.getSoDienThoai(), x.getEmail(), x.getDiaChi(), x.getLoaiKhachHang(),
                x.getTrangThai(), x.getNgayTao(), x.getNgayCapNhat());
    }

    static Fields snapshot(KhachHangDto x) {
        assertNotNull(x);
        return new Fields(x.getId(), x.getMaKhachHang(), x.getTenKhachHang(), x.getMaSoThue(),
                x.getNguoiLienHe(), x.getSoDienThoai(), x.getEmail(), x.getDiaChi(), x.getLoaiKhachHang(),
                x.getTrangThai(), x.getNgayTao(), x.getNgayCapNhat());
    }

    static void fields(Fields expected, Fields actual) {
        assertNotNull(actual);
        assertAll("All 12 fields, not DTO equals(id) or a round trip",
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
                () -> assertEquals(expected.ngayTao(), actual.ngayTao(), "ngayTao"),
                () -> assertEquals(expected.ngayCapNhat(), actual.ngayCapNhat(), "ngayCapNhat"));
    }

    record PageValues(List<Fields> content, int pageNumber, int pageSize, long totalElements, int totalPages, boolean paged) { }
    static PageValues entityPage(Page<KhachHang> p) {
        return new PageValues(p.getContent().stream().map(KhachHangMapperReportTest::snapshot).toList(),
                p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.getPageable().isPaged());
    }
    static PageValues dtoPage(Page<KhachHangDto> p) {
        assertNotNull(p);
        return new PageValues(p.getContent().stream().map(KhachHangMapperReportTest::snapshot).toList(),
                p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.getPageable().isPaged());
    }
    static void pageMetadata(Page<?> p, int number, int size, long total, int totalPages) {
        assertNotNull(p);
        assertAll("Page metadata", () -> assertEquals(number, p.getNumber(), "pageNumber"),
                () -> assertEquals(size, p.getSize(), "pageSize"),
                () -> assertEquals(total, p.getTotalElements(), "totalElements"),
                () -> assertEquals(totalPages, p.getTotalPages(), "totalPages"),
                () -> assertTrue(p.getPageable().isPaged(), "Pageable must remain paged"));
    }

    static final class Case implements AutoCloseable {
        final KhachHangMapper mapper;
        boolean passed;
        static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .configure(JsonGenerator.Feature.ESCAPE_NON_ASCII, true);
        Case(String id, String function) {
            System.out.println("==================================================");
            System.out.println("Test Case ID: " + id);
            System.out.println("Test class: com.dev.backend.mapper.KhachHangMapperReportTest");
            System.out.println("Test method: " + id);
            System.out.println("Function: KhachHangMapper." + function);
            System.out.println("Fixture review: FULL for supplied specification and supplemental fixture; original report fixture not recovered.");
            System.out.println("Fixture source: supplemental conversation before first execution. Cases 002/007/008: user-confirmed image details, image not locally inspected. Case 004: supplemental postcondition.");
            mapper = assertDoesNotThrow(() -> Mappers.getMapper(KhachHangMapper.class));
            assertEquals(KhachHangMapperImpl.class, mapper.getClass());
            System.out.println("Mapper implementation: " + mapper.getClass().getName());
        }
        void log(String label, Object value) {
            System.out.println(label + ": " + assertDoesNotThrow(() -> JSON.writeValueAsString(value)));
        }
        <T> T execute(String call, Supplier<T> action) {
            System.out.println("Step 2 - Execute: " + call);
            return assertDoesNotThrow(() -> {
                try { return action.get(); }
                catch (RuntimeException | Error ex) {
                    System.out.println("Unexpected exception: " + ex);
                    throw ex;
                }
            });
        }
        void executeVoid(String call, Runnable action) {
            System.out.println("Step 2 - Execute: " + call);
            assertDoesNotThrow(() -> {
                try { action.run(); }
                catch (RuntimeException | Error ex) {
                    System.out.println("Unexpected exception: " + ex);
                    throw ex;
                }
            });
            System.out.println("Step 3 - Return: void; completed without exception, no returned value.");
        }
        void passed() { passed = true; }
        @Override public void close() {
            System.out.println("Assertion result: " + (passed ? "PASSED" : "FAILED"));
            System.out.println("Report comparison: FULL for specification and supplemental fixture; not a recovered original fixture.");
            System.out.println("==================================================");
        }
    }

    @Test void UT_MAPPING_001() {
        try (var c = new Case("UT_MAPPING_001", "toDto")) {
            var input = e1(); c.log("Step 1 - Prepare input", snapshot(input));
            var actual = c.execute("mapper.toDto(input)", () -> c.mapper.toDto(input));
            c.log("Step 3 - Actual result", actual);
            c.log("Step 4 - Verify expected result", E1);
            fields(E1, snapshot(actual)); c.passed();
        }
    }

    @Test void UT_MAPPING_002() {
        try (var c = new Case("UT_MAPPING_002", "toDto")) {
            // All five null fields were confirmed by the user from the full report image before execution.
            var input = e1(); input.setMaSoThue(null); input.setNguoiLienHe(null); input.setSoDienThoai(null);
            input.setEmail(null); input.setDiaChi(null);
            Fields expected = new Fields(10, "KH_TEST_001", "Công ty Ánh Dương", null, null, null,
                    null, null, "le", 1, E1.ngayTao(), E1.ngayCapNhat());
            c.log("Step 1 - Prepare input", snapshot(input));
            var actual = c.execute("mapper.toDto(input)", () -> c.mapper.toDto(input));
            c.log("Step 3 - Actual result", actual); c.log("Step 4 - Verify expected result", expected);
            fields(expected, snapshot(actual));
            assertAll(() -> assertNull(actual.getMaSoThue()), () -> assertNull(actual.getNguoiLienHe()),
                    () -> assertNull(actual.getSoDienThoai()), () -> assertNull(actual.getEmail()),
                    () -> assertNull(actual.getDiaChi())); c.passed();
        }
    }

    @Test void UT_MAPPING_003() {
        try (var c = new Case("UT_MAPPING_003", "toEntity")) {
            var input = d1(); c.log("Step 1 - Prepare input", snapshot(input));
            var actual = c.execute("mapper.toEntity(input)", () -> c.mapper.toEntity(input));
            c.log("Step 3 - Actual result", actual); c.log("Step 4 - Verify expected result", D1);
            fields(D1, snapshot(actual)); c.passed();
        }
    }

    @Test void UT_MAPPING_004() {
        try (var c = new Case("UT_MAPPING_004", "partialUpdate")) {
            var entity = e1(); Fields before = snapshot(entity);
            var update = KhachHangUpdating.builder().tenKhachHang("Công ty Bình Minh").email("new@example.test").build();
            // All ten unchanged fields are a user-supplied supplemental postcondition, not recovered image Notes.
            Fields expected = new Fields(10, "KH_TEST_001", "Công ty Bình Minh", "0101234567", "Nguyễn Văn An",
                    "0912345678", "new@example.test", "Địa chỉ kiểm thử 01", "le", 1, E1.ngayTao(), E1.ngayCapNhat());
            c.log("Step 1 - Before", before); c.log("Step 1 - Update input", update);
            c.executeVoid("mapper.partialUpdate(update, entity)", () -> c.mapper.partialUpdate(update, entity));
            c.log("Step 3 - Actual result", snapshot(entity));
            c.log("Step 4 - Verify expected result", expected); fields(expected, snapshot(entity)); c.passed();
        }
    }

    @Test void UT_MAPPING_005() {
        try (var c = new Case("UT_MAPPING_005", "partialUpdate")) {
            var entity = e1(); Fields before = snapshot(entity); var update = new KhachHangUpdating();
            c.log("Step 1 - Before", before); c.log("Step 1 - Update input", update);
            c.executeVoid("mapper.partialUpdate(update, entity)", () -> c.mapper.partialUpdate(update, entity));
            c.log("Step 3 - Actual result", snapshot(entity));
            c.log("Step 4 - Verify expected result", before); fields(before, snapshot(entity)); c.passed();
        }
    }

    @Test void UT_MAPPING_006() {
        try (var c = new Case("UT_MAPPING_006", "partialUpdate")) {
            var entity = e1(); Fields before = snapshot(entity); assertNotNull(before.email()); assertFalse(before.email().isEmpty());
            var update = KhachHangUpdating.builder().email("").trangThai(0).build();
            Fields expected = new Fields(10, "KH_TEST_001", "Công ty Ánh Dương", "0101234567", "Nguyễn Văn An",
                    "0912345678", "", "Địa chỉ kiểm thử 01", "le", 0, E1.ngayTao(), E1.ngayCapNhat());
            c.log("Step 1 - Before", before); c.log("Step 1 - Update input", update);
            c.executeVoid("mapper.partialUpdate(update, entity)", () -> c.mapper.partialUpdate(update, entity));
            c.log("Step 3 - Actual result", snapshot(entity));
            c.log("Step 4 - Verify expected result", expected); fields(expected, snapshot(entity)); c.passed();
        }
    }

    @Test void UT_MAPPING_007() {
        try (var c = new Case("UT_MAPPING_007", "toDtoPage")) {
            // Full page metadata confirmed by the user from the report image.
            var page = new PageImpl<>(List.of(e1()), PageRequest.of(1, 1), 3);
            c.log("Step 1 - Prepare input", entityPage(page));
            pageMetadata(page, 1, 1, 3, 3); assertEquals(1, page.getContent().size()); fields(E1, snapshot(page.getContent().get(0)));
            var actual = c.execute("mapper.toDtoPage(page)", () -> c.mapper.toDtoPage(page));
            assertNotNull(actual); c.log("Step 3 - Actual result", dtoPage(actual));
            c.log("Step 4 - Verify expected result", new PageValues(List.of(E1), 1, 1, 3, 3, true));
            pageMetadata(actual, 1, 1, 3, 3); assertEquals(page.getPageable(), actual.getPageable());
            assertEquals(1, actual.getContent().size()); fields(E1, snapshot(actual.getContent().get(0))); c.passed();
        }
    }

    @Test void UT_MAPPING_008() {
        try (var c = new Case("UT_MAPPING_008", "toDtoPage")) {
            // Empty content and all metadata confirmed by the user from the report image.
            Page<KhachHang> page = new PageImpl<>(List.of(), PageRequest.of(0, 20), 0);
            c.log("Step 1 - Prepare input", entityPage(page)); pageMetadata(page, 0, 20, 0, 0); assertTrue(page.getContent().isEmpty());
            var actual = c.execute("mapper.toDtoPage(page)", () -> c.mapper.toDtoPage(page));
            assertNotNull(actual); c.log("Step 3 - Actual result", dtoPage(actual));
            c.log("Step 4 - Verify expected result", new PageValues(List.of(), 0, 20, 0, 0, true));
            assertTrue(actual.getContent().isEmpty()); pageMetadata(actual, 0, 20, 0, 0);
            assertEquals(page.getPageable(), actual.getPageable()); c.passed();
        }
    }
}
