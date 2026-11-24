package com.dev.backend.utils;

import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChannelConfigurationReportTest {
    @Test
    void UT_CHANNELCFG_001() {
        String maKenh = " shopee ";
        String ten = "TU_DONG_DAY_TON";
        String expected = "KENH_SHOPEE_TU_DONG_DAY_TON";
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        input.put("ten", ten);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_001", "khoa", input, expected, null, null, null)) {
            String actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.khoa(maKenh, ten)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_002() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TU_DONG_DAY_TON";
        String stubValue = "false";
        Boolean expected = Boolean.FALSE;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_002", "tuDongDayTon", input, expected, cauHinh, expectedKey, stubValue)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tuDongDayTon(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_003() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TU_DONG_DAY_TON";
        String stubValue = null;
        Boolean expected = Boolean.TRUE;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_003", "tuDongDayTon", input, expected, cauHinh, expectedKey, stubValue)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tuDongDayTon(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_004() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TU_DONG_LAY_DON";
        String stubValue = "false";
        Boolean expected = Boolean.FALSE;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_004", "tuDongLayDon", input, expected, cauHinh, expectedKey, stubValue)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tuDongLayDon(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_005() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TU_DONG_LAY_DON";
        String stubValue = null;
        Boolean expected = Boolean.TRUE;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_005", "tuDongLayDon", input, expected, cauHinh, expectedKey, stubValue)) {
            Boolean actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tuDongLayDon(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_006() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TY_LE_DAY_TON";
        String stubValue = "50";
        Integer expected = 50;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_006", "tyLeDayTon", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tyLeDayTon(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_007() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TY_LE_DAY_TON";
        String stubValue = "0";
        Integer expected = 100;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_007", "tyLeDayTon", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tyLeDayTon(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_008() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TY_LE_DAY_TON";
        String stubValue = "101";
        Integer expected = 100;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_008", "tyLeDayTon", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tyLeDayTon(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_009() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TY_LE_DAY_TON";
        String stubValue = "abc";
        Integer expected = 100;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_009", "tyLeDayTon", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tyLeDayTon(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_010() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TON_DEM";
        String stubValue = "5";
        Integer expected = 5;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_010", "tonDem", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tonDem(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_011() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TON_DEM";
        String stubValue = null;
        Integer expected = 0;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_011", "tonDem", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tonDem(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_012() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_TON_DEM";
        String stubValue = "100001";
        Integer expected = 0;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_012", "tonDem", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.tonDem(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_013() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_NGUONG_VE_0";
        String stubValue = "3";
        Integer expected = 3;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_013", "nguongVe0", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.nguongVe0(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_014() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_NGUONG_VE_0";
        String stubValue = null;
        Integer expected = 0;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_014", "nguongVe0", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.nguongVe0(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }

    @Test
    void UT_CHANNELCFG_015() {
        String maKenh = "SHOPIFY";
        String expectedKey = "KENH_SHOPIFY_NGUONG_VE_0";
        String stubValue = "-1";
        Integer expected = 0;
        DieuHanhHeThongService cauHinh = mock(DieuHanhHeThongService.class);
        when(cauHinh.getCauHinhString(expectedKey, null)).thenReturn(stubValue);
        var input = new LinkedHashMap<String, Object>();
        input.put("maKenh", maKenh);
        try (var walkthrough = new ChannelConfigurationWalkthrough("UT_CHANNELCFG_015", "nguongVe0", input, expected, cauHinh, expectedKey, stubValue)) {
            Integer actual = assertDoesNotThrow(() -> walkthrough.execute(() -> KenhCauHinhDongBo.nguongVe0(cauHinh, maKenh)));
            assertNotNull(actual);
            assertEquals(expected, actual);
            verify(cauHinh, times(1)).getCauHinhString(expectedKey, null);
            verifyNoMoreInteractions(cauHinh);
            walkthrough.serviceVerified();
            walkthrough.passed();
        }
    }
}
