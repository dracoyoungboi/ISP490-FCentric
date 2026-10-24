package com.dev.backend.utils;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SoChungTuTest {

    @Test
    void chuaCoChungTuNaoTrongNgay_batDauTu1() {
        assertEquals("SO202610241", SoChungTu.tiepTheo("SO20261024", null));
    }

    @Test
    void dayCoLo_layLonNhatCong1_khongTrungSoDaChuyenTuBaoGia() {
        // Đã có SO…1, SO…2 và SO…7 (chuyển từ BG…7): đếm + 1 ra 4 rồi về sau trùng 7; lớn nhất + 1 ra 8.
        assertEquals("SO202610248", SoChungTu.tiepTheo("SO20261024", 7L));
    }

    @Test
    void nhanKieuSoCuaMySql() {
        // CAST(... AS UNSIGNED) trả BigInteger qua JDBC.
        assertEquals("PX-TRF-2026102413", SoChungTu.tiepTheo("PX-TRF-20261024", BigInteger.valueOf(12)));
    }
}
