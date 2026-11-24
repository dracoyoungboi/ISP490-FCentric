package com.dev.backend.utils;

import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.dto.request.FilterCriteria;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// Supplemental tach expectations arrived before the first execution; no partial run existed.
class SearchUtilitiesReportTest {
    private static final String TEXT_SOURCE = "Explicit supplied text; original image unavailable for crosscheck.";
    private static final String SUPPLEMENT_SOURCE = "User supplemental conversation specification; not an independently approved report.";

    @Test
    void UT_SEARCH_001() {
        String q = " Áo khoác ";
        String expected = "Áo khoác";
        var input = new LinkedHashMap<String, Object>();
        input.put("q", q);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_001", "chuanHoa", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.chuanHoa(q)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_002() {
        String q = "A";
        String expected = null;
        var input = new LinkedHashMap<String, Object>();
        input.put("q", q);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_002", "chuanHoa", input, expected,
                "No exception; assertNull(actual).", TEXT_SOURCE)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.chuanHoa(q)));
            assertNull(actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_003() {
        String q = "A".repeat(101);
        String expected = "A".repeat(100);
        var input = new LinkedHashMap<String, Object>();
        input.put("q", q);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_003", "chuanHoa", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing. String length must equal 100.", TEXT_SOURCE)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.chuanHoa(q)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            assertEquals(100, actual.length());
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_004() {
        String tk = "AK_10%!";
        boolean chinhXac = false;
        String expected = "%ak!_10!%!!%";
        var input = new LinkedHashMap<String, Object>();
        input.put("tk", tk);
        input.put("chinhXac", chinhXac);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_004", "mau", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.mau(tk, chinhXac)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_005() {
        String tk = "AK001";
        boolean chinhXac = true;
        String expected = "ak001";
        var input = new LinkedHashMap<String, Object>();
        input.put("tk", tk);
        input.put("chinhXac", chinhXac);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_005", "mau", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.mau(tk, chinhXac)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_006() {
        String tk = "SO202611062";
        Boolean expected = Boolean.TRUE;
        var input = new LinkedHashMap<String, Object>();
        input.put("tk", tk);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_006", "giongMaChungTu", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.giongMaChungTu(tk)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_007() {
        String tk = "PX";
        Boolean expected = Boolean.TRUE;
        var input = new LinkedHashMap<String, Object>();
        input.put("tk", tk);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_007", "giongMaChungTu", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.giongMaChungTu(tk)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_008() {
        String tk = "0912345678";
        Boolean expected = Boolean.FALSE;
        var input = new LinkedHashMap<String, Object>();
        input.put("tk", tk);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_008", "giongMaChungTu", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.giongMaChungTu(tk)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_009() {
        String tk = "PX_1";
        Boolean expected = Boolean.FALSE;
        var input = new LinkedHashMap<String, Object>();
        input.put("tk", tk);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_009", "giongMaChungTu", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.giongMaChungTu(tk)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_010() {
        String giaTri = "AK001";
        String tk = "ak001";
        Integer expected = 0;
        var input = new LinkedHashMap<String, Object>();
        input.put("giaTri", giaTri);
        input.put("tk", tk);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_010", "mucKhop", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.mucKhop(giaTri, tk)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_011() {
        String giaTri = "AK001-XL";
        String tk = "AK001";
        Integer expected = 1;
        var input = new LinkedHashMap<String, Object>();
        input.put("giaTri", giaTri);
        input.put("tk", tk);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_011", "mucKhop", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.mucKhop(giaTri, tk)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_012() {
        String giaTri = "SP-AK001-XL";
        String tk = "AK001";
        Integer expected = 2;
        var input = new LinkedHashMap<String, Object>();
        input.put("giaTri", giaTri);
        input.put("tk", tk);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_012", "mucKhop", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.mucKhop(giaTri, tk)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_013() {
        String giaTri = "QT002";
        String tk = "AK001";
        Integer expected = 3;
        var input = new LinkedHashMap<String, Object>();
        input.put("giaTri", giaTri);
        input.put("tk", tk);
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_013", "mucKhop", input, expected,
                "No exception; non-null result; exact assertEquals(expected, actual); no actual postprocessing.", TEXT_SOURCE)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.mucKhop(giaTri, tk)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_014() {
        // All four expected fields are from the user's supplemental specification.
        FilterCriteria keyword = FilterCriteria.builder().fieldName("tuKhoa").operation(FilterOperation.LIKE).value(" Áo ").build();
        FilterCriteria status = FilterCriteria.builder().fieldName("trangThai").operation(FilterOperation.EQUALS).value(1).build();
        List<FilterCriteria> filters = new ArrayList<>(List.of(keyword, status));
        var input = new LinkedHashMap<String, Object>();
        input.put("filters", filters);
        var expected = new LinkedHashMap<String, Object>();
        expected.put("coTruong", true);
        expected.put("tuKhoa", "Áo");
        expected.put("chinhXac", false);
        expected.put("conLai", List.of(new SearchReportWalkthrough.ExpectedFilter("trangThai", FilterOperation.EQUALS, 1)));
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_014", "tach", input, expected,
                "No exception; non-null Tach; verify coTruong, tuKhoa, chinhXac, non-null conLai and exact size; for remaining criteria verify fieldName, operation and Integer value. No input-mutation requirement.", SUPPLEMENT_SOURCE)) {
            TuKhoaTimKiem.Tach actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.tach(filters)));
            assertNotNull(actual);
            assertTrue(actual.coTruong());
            assertEquals("Áo", actual.tuKhoa());
            assertFalse(actual.chinhXac());
            assertNotNull(actual.conLai());
            assertEquals(1, actual.conLai().size());
            FilterCriteria remaining = actual.conLai().get(0);
            assertNotNull(remaining);
            assertEquals("trangThai", remaining.getFieldName());
            assertEquals(FilterOperation.EQUALS, remaining.getOperation());
            assertInstanceOf(Integer.class, remaining.getValue());
            assertEquals(1, remaining.getValue());
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_015() {
        // All four expected fields are from the user's supplemental specification.
        FilterCriteria keyword = FilterCriteria.builder().fieldName("tuKhoa").operation(FilterOperation.EQUALS).value(" A ").build();
        List<FilterCriteria> filters = new ArrayList<>(List.of(keyword));
        var input = new LinkedHashMap<String, Object>();
        input.put("filters", filters);
        var expected = new LinkedHashMap<String, Object>();
        expected.put("coTruong", true);
        expected.put("tuKhoa", "A");
        expected.put("chinhXac", true);
        expected.put("conLai", List.of());
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_015", "tach", input, expected,
                "No exception; non-null Tach; verify coTruong, tuKhoa, chinhXac, non-null conLai and exact size; for remaining criteria verify fieldName, operation and Integer value. No input-mutation requirement.", SUPPLEMENT_SOURCE)) {
            TuKhoaTimKiem.Tach actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.tach(filters)));
            assertNotNull(actual);
            assertTrue(actual.coTruong());
            assertEquals("A", actual.tuKhoa());
            assertTrue(actual.chinhXac());
            assertNotNull(actual.conLai());
            assertEquals(0, actual.conLai().size());
            walkthrough.passed();
        }
    }

    @Test
    void UT_SEARCH_016() {
        // All four expected fields are from the user's supplemental specification.
        FilterCriteria keyword = FilterCriteria.builder().fieldName("tuKhoa").operation(FilterOperation.LIKE).value(" ").build();
        FilterCriteria status = FilterCriteria.builder().fieldName("trangThai").operation(FilterOperation.EQUALS).value(1).build();
        List<FilterCriteria> filters = new ArrayList<>(List.of(keyword, status));
        var input = new LinkedHashMap<String, Object>();
        input.put("filters", filters);
        var expected = new LinkedHashMap<String, Object>();
        expected.put("coTruong", true);
        expected.put("tuKhoa", null);
        expected.put("chinhXac", false);
        expected.put("conLai", List.of(new SearchReportWalkthrough.ExpectedFilter("trangThai", FilterOperation.EQUALS, 1)));
        try (var walkthrough = new SearchReportWalkthrough("UT_SEARCH_016", "tach", input, expected,
                "No exception; non-null Tach; verify coTruong, tuKhoa, chinhXac, non-null conLai and exact size; for remaining criteria verify fieldName, operation and Integer value. No input-mutation requirement.", SUPPLEMENT_SOURCE)) {
            TuKhoaTimKiem.Tach actual = assertDoesNotThrow(() -> walkthrough.execute(() -> TuKhoaTimKiem.tach(filters)));
            assertNotNull(actual);
            assertTrue(actual.coTruong());
            assertNull(actual.tuKhoa());
            assertFalse(actual.chinhXac());
            assertNotNull(actual.conLai());
            assertEquals(1, actual.conLai().size());
            FilterCriteria remaining = actual.conLai().get(0);
            assertNotNull(remaining);
            assertEquals("trangThai", remaining.getFieldName());
            assertEquals(FilterOperation.EQUALS, remaining.getOperation());
            assertInstanceOf(Integer.class, remaining.getValue());
            assertEquals(1, remaining.getValue());
            walkthrough.passed();
        }
    }
}
