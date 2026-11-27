package com.dev.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Dòng Báo cáo tồn kho gửi cho người không được xem giá vốn (SRS 2.4.1): JSON giữ đủ số tồn như dòng gốc, giá trị tồn
 * null, không lộ dòng gốc qua trường phụ.
 */
class TonKhoKhongGiaVonTest {

    static TonKhoProjection goc() {
        Map<String, Object> v = new HashMap<>();
        v.put("getBienTheId", 7);
        v.put("getMaSku", "SKU-7");
        v.put("getMaSanPham", "SP-7");
        v.put("getTenSanPham", "Áo");
        v.put("getTenMau", "Đen");
        v.put("getMaSize", "M");
        v.put("getTenChatLieu", "Cotton");
        v.put("getMucTonToiThieu", 3);
        v.put("getKhoId", 2);
        v.put("getTenKho", "Cửa hàng");
        v.put("getOnHand", new BigDecimal("10"));
        v.put("getIncoming", new BigDecimal("4"));
        v.put("getOutgoing", new BigDecimal("1"));
        v.put("getFreeToUse", new BigDecimal("9"));
        v.put("getTongGiaTri", new BigDecimal("1200000"));
        return (TonKhoProjection) Proxy.newProxyInstance(TonKhoProjection.class.getClassLoader(),
                new Class<?>[]{TonKhoProjection.class}, (p, m, a) -> v.get(m.getName()));
    }

    @Test
    void jsonGiuSoTonBoGiaTriTon() throws Exception {
        JsonNode j = new ObjectMapper().valueToTree(new TonKhoKhongGiaVon(goc()));
        assertTrue(j.get("tongGiaTri").isNull(), "giá trị tồn phải null");
        assertEquals(7, j.get("bienTheId").asInt());
        assertEquals("SKU-7", j.get("maSku").asText());
        assertEquals("Cửa hàng", j.get("tenKho").asText());
        assertEquals(3, j.get("mucTonToiThieu").asInt());
        assertEquals(0, new BigDecimal("10").compareTo(j.get("onHand").decimalValue()));
        assertEquals(0, new BigDecimal("4").compareTo(j.get("incoming").decimalValue()));
        assertEquals(0, new BigDecimal("1").compareTo(j.get("outgoing").decimalValue()));
        assertEquals(0, new BigDecimal("9").compareTo(j.get("freeToUse").decimalValue()));
        assertEquals(15, j.size(), "đúng 15 trường như TonKhoProjection, không có trường phụ: " + j.fieldNames());
        assertFalse(j.toString().contains("1200000"), "không lộ giá trị tồn ở bất kỳ trường nào");
    }
}
