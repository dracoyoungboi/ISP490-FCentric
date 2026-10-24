package com.dev.backend.config;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.utils.GioiHanSoThapPhan;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Số có số mũ khổng lồ (M-3): "1e900000000" đọc vào rất rẻ nhưng cộng / làm tròn / ghi CSDL phải dựng hàng trăm triệu
 * chữ số. Bộ đọc JSON chặn ngay ở cửa (400), trước khi tới service.
 */
class GioiHanSoThapPhanConfigTest {

    static class DonGia {
        public BigDecimal gia;
        public List<BigDecimal> dsGia;
    }

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        Jackson2ObjectMapperBuilder builder = new Jackson2ObjectMapperBuilder();
        new GioiHanSoThapPhanConfig().gioiHanBigDecimal().customize(builder);
        objectMapper = builder.build();
    }

    @Test
    void hopLe_bienGioiHan() {
        assertTrue(GioiHanSoThapPhan.hopLe(null));
        assertTrue(GioiHanSoThapPhan.hopLe(new BigDecimal("99999999999999999999")));            // 20 chữ số nguyên
        assertFalse(GioiHanSoThapPhan.hopLe(new BigDecimal("100000000000000000000")));          // 21
        assertTrue(GioiHanSoThapPhan.hopLe(new BigDecimal("-12345.0123456789")));
        assertTrue(GioiHanSoThapPhan.hopLe(new BigDecimal("100000.01999999999")), "số do JS tính (6 × 16666.67)");
        assertTrue(GioiHanSoThapPhan.hopLe(new BigDecimal("0." + "1".repeat(30))));              // 30 chữ số lẻ
        assertFalse(GioiHanSoThapPhan.hopLe(new BigDecimal("0." + "1".repeat(31))));             // 31
        assertTrue(GioiHanSoThapPhan.hopLe(new BigDecimal("1E+5")));
        assertFalse(GioiHanSoThapPhan.hopLe(new BigDecimal("1e900000000")));
        assertFalse(GioiHanSoThapPhan.hopLe(new BigDecimal("1e-900000000")));
    }

    @Test
    void kiemTra_vuotGioiHan_bao400CoTenTruong() {
        CommonException loi = assertThrows(CommonException.class,
                () -> GioiHanSoThapPhan.kiemTra(new BigDecimal("1e900000000"), "Giá bán"));
        assertEquals("Giá bán vượt giới hạn cho phép", loi.getMessage());
        assertEquals(new BigDecimal("459000"), GioiHanSoThapPhan.kiemTra(new BigDecimal("459000"), "Giá bán"));
    }

    @Test
    void docJson_soMuKhongLo_biTuChoi() {
        assertThrows(InvalidFormatException.class,
                () -> objectMapper.readValue("{\"gia\": 1e900000000}", DonGia.class));
        assertThrows(InvalidFormatException.class,
                () -> objectMapper.readValue("{\"gia\": \"1e900000000\"}", DonGia.class), "dạng chuỗi cũng chặn");
        assertThrows(InvalidFormatException.class,
                () -> objectMapper.readValue("{\"dsGia\": [1, 1e-900000000]}", DonGia.class), "phần tử trong danh sách");
    }

    @Test
    void docJson_soBinhThuong_giuNguyen() throws Exception {
        DonGia d = objectMapper.readValue("{\"gia\": 459000.50, \"dsGia\": [\"12.5\", 0]}", DonGia.class);
        assertEquals(new BigDecimal("459000.50"), d.gia);
        assertEquals(List.of(new BigDecimal("12.5"), new BigDecimal("0")), d.dsGia);
        assertNull(objectMapper.readValue("{\"gia\": null}", DonGia.class).gia);
    }
}
