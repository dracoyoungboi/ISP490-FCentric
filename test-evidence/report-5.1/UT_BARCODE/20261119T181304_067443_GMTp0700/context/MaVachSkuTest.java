package com.dev.backend.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Mã vạch SKU tự sinh: tiền tố 2 chữ số + id đệm 0 đủ 10 chữ số; chuỗi trống lưu null. */
class MaVachSkuTest {

    @Test
    void sinh_tienToCongIdDemDu10ChuSo() {
        assertEquals("2000010037", MaVachSku.sinh("20", 10037));
        assertEquals("2000000150", MaVachSku.sinh("20", 150));
        assertEquals("2500000001", MaVachSku.sinh("25", 1));
        assertEquals(10, MaVachSku.sinh("20", 174).length());
    }

    @Test
    void sinh_idDaiHonChoTrong_giuNguyenDuChuSoCuaId() {
        assertEquals("20123456789", MaVachSku.sinh("20", 123456789));
    }

    @Test
    void sinh_tienToCauHinhSai_dungTienToMacDinh() {
        assertEquals("2000000007", MaVachSku.sinh(null, 7));
        assertEquals("2000000007", MaVachSku.sinh("893", 7));
        assertEquals("2000000007", MaVachSku.sinh("AB", 7));
        assertEquals("2900000007", MaVachSku.sinh(" 29 ", 7));
    }

    @Test
    void sinh_chuaCoId_baoLoi() {
        assertThrows(IllegalArgumentException.class, () -> MaVachSku.sinh("20", 0));
    }

    @Test
    void tienTo_chiNhanDung2ChuSo() {
        assertTrue(MaVachSku.laTienToHopLe("20"));
        assertTrue(MaVachSku.laTienToHopLe("29"));
        assertFalse(MaVachSku.laTienToHopLe("2"));
        assertFalse(MaVachSku.laTienToHopLe("893"));
        assertFalse(MaVachSku.laTienToHopLe("2a"));
        assertFalse(MaVachSku.laTienToHopLe(" 20"));
        assertFalse(MaVachSku.laTienToHopLe(null));
    }

    @Test
    void chuanHoa_chuoiRongThanhNull_boKhoangTrangHaiDau() {
        assertNull(MaVachSku.chuanHoa(null));
        assertNull(MaVachSku.chuanHoa(""));
        assertNull(MaVachSku.chuanHoa("   "));
        assertEquals("8936000000123", MaVachSku.chuanHoa(" 8936000000123 "));
    }
}
