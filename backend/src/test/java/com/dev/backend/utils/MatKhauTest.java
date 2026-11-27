package com.dev.backend.utils;

import com.dev.backend.i18n.ThongDiep;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Cùng ca với frontend utils/matKhau.test.js. */
class MatKhauTest {

    private static String loi(String matKhau) {
        ThongDiep td = MatKhau.loi(matKhau);
        return td == null ? null : td.khoa();
    }

    @Test
    void doDai_8Den64KyTu() {
        assertEquals("heThong.nhapMatKhauMoi", loi(null));
        assertEquals("heThong.nhapMatKhauMoi", loi(""));
        assertEquals("heThong.matKhauMoiToiThieu", loi("Kho@202"));
        assertNull(loi("Kho@2026"));
        assertNull(loi("Aa1!" + "a".repeat(60)));
        assertEquals("heThong.matKhauMoiToiDa", loi("Aa1!" + "a".repeat(61)));
    }

    @Test
    void khongDauCachOBatKyDau() {
        assertEquals("heThong.nhapMatKhauMoi", loi("        "));
        for (String mk : new String[]{"Kho tong@2026", " Kho@2026", "Kho@2026 ", "Kho@2026\t", "Kho @2026"}) {
            assertEquals("heThong.matKhauCoDauCach", loi(mk), mk);
        }
    }

    @Test
    void chiKyTuBanPhimTiengAnh_khongChuCoDau() {
        for (String mk : new String[]{"Hà@Nội2026", "Đalat@2026", "Kho@2026€", "Kho@2026😀", "Kho@2026ệ"}) {
            assertEquals("heThong.matKhauKyTuKhongHopLe", loi(mk), mk);
        }
    }

    @Test
    void phaiDuBonLoaiKyTu() {
        for (String mk : new String[]{"kho@2026hn", "KHO@2026HN", "Kho@hangtong", "Kho2026hn", "20262027"}) {
            assertEquals("heThong.matKhauThieuLoaiKyTu", loi(mk), mk);
        }
        for (String mk : new String[]{"Khang123@", "Kho2026#hn", "Ab1~cdef", "P@ssw0rd"}) {
            assertNull(loi(mk), mk);
        }
    }

    @Test
    void chuaChanMatKhauPhoBien() {
        assertNull(loi("Matkhau@123"));
        assertNull(loi("Qwerty1!"));
    }
}
