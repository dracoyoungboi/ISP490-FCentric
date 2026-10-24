package com.dev.backend.services.impl.entities;

import com.dev.backend.exception.customize.CommonException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Khoảng giá của dòng báo giá: 90%–110% giá niêm yết của biến thể (cùng quy tắc màn Tạo báo giá).
 */
class DonBanHangGiaBaoGiaTest {

    private static void kiem(String niemYet, String thoaThuan) {
        DonBanHangService.kiemTraGiaThoaThuan("SKU-1", new BigDecimal(niemYet), new BigDecimal(thoaThuan));
    }

    @Test
    void trongKhoang_vaDungHaiMep_thiHopLe() {
        assertDoesNotThrow(() -> kiem("120000.00", "120000"));
        assertDoesNotThrow(() -> kiem("120000.00", "108000"));
        assertDoesNotThrow(() -> kiem("120000.00", "132000"));
    }

    @Test
    void thapHon90PhanTram_thiBaoMucToiThieu() {
        CommonException loi = assertThrows(CommonException.class, () -> kiem("120000.00", "107999"));
        assertTrue(loi.getMessage().contains("SKU-1"), loi.getMessage());
        assertTrue(loi.getMessage().contains("thấp hơn 10%"), loi.getMessage());
        assertTrue(loi.getMessage().contains("tối thiểu 108.000 ₫"), loi.getMessage());
    }

    @Test
    void caoHon110PhanTram_thiBaoMucToiDa() {
        CommonException loi = assertThrows(CommonException.class, () -> kiem("120000.00", "132001"));
        assertTrue(loi.getMessage().contains("cao hơn 10%"), loi.getMessage());
        assertTrue(loi.getMessage().contains("tối đa 132.000 ₫"), loi.getMessage());
    }

    @Test
    void giaNiemYetLe_mucLamTronVaoTrongKhoangNhuManHinh() {
        // 90% của 99.999 = 89.999,1 → tối thiểu 90.000; 110% = 109.998,9 → tối đa 109.998
        assertThrows(CommonException.class, () -> kiem("99999", "89999"));
        assertDoesNotThrow(() -> kiem("99999", "90000"));
        assertDoesNotThrow(() -> kiem("99999", "109998"));
        CommonException loi = assertThrows(CommonException.class, () -> kiem("99999", "109999"));
        assertTrue(loi.getMessage().contains("tối đa 109.998 ₫"), loi.getMessage());
    }

    @Test
    void chuaCoGiaNiemYet_nullHoac0_thiChanVaBaoCapNhatGia() {
        CommonException loiNull = assertThrows(CommonException.class,
                () -> DonBanHangService.kiemTraGiaThoaThuan("SKU-1", null, new BigDecimal("150000")));
        assertTrue(loiNull.getMessage().contains("chưa có giá niêm yết"), loiNull.getMessage());
        CommonException loi0 = assertThrows(CommonException.class, () -> kiem("0.00", "150000"));
        assertTrue(loi0.getMessage().contains("SKU-1 chưa có giá niêm yết"), loi0.getMessage());
        // Đơn giá âm luôn bị chặn (dưới mức tối thiểu)
        assertThrows(CommonException.class, () -> kiem("120000", "-1"));
    }

    @Test
    void soLonDungDauChamNganNghin() {
        CommonException loi = assertThrows(CommonException.class, () -> kiem("12345678", "1"));
        assertTrue(loi.getMessage().contains("tối thiểu 11.111.111 ₫"), loi.getMessage());
    }
}
