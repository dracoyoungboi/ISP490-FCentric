package com.dev.backend.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Biển số xe Việt Nam: cùng bộ ca với frontend components/chuyen-kho/bienSoXe.test.js để hai phía không lệch nhau.
 */
class BienSoXeTest {

    // { gõ vào, lưu thành, loại }
    private static final String[][] NHAN = {
            {"30A-123.45", "30A-123.45", "O_TO"},
            {"30a12345", "30A-123.45", "O_TO"},
            {"30A 123 45", "30A-123.45", "O_TO"},
            {"30A-12345", "30A-123.45", "O_TO"},
            {"30A-123,45", "30A-123.45", "O_TO"},
            {" 51k – 678.90 ", "51K-678.90", "O_TO"},
            {"29C-012.34", "29C-012.34", "O_TO"},
            {"80B-001.23", "80B-001.23", "O_TO"},
            {"39A-123.45", "39A-123.45", "O_TO"},
            {"29A-1234", "29A-1234", "O_TO"},
            {"29a1234", "29A-1234", "O_TO"},
            {"20KT-226.22", "20KT-226.22", "O_TO"},
            {"15RM-012.34", "15RM-012.34", "O_TO"},
            {"29HC12345", "29HC-123.45", "O_TO"},
            {"51LD-123.45", "51LD-123.45", "O_TO"},
            {"51R-141.39", "51R-141.39", "O_TO"},
            {"50TĐ-821.08", "50TĐ-821.08", "O_TO"},
            {"50tđ82108", "50TĐ-821.08", "O_TO"},
            {"29-B1 123.45", "29-B1 123.45", "XE_MAY"},
            {"29B1-123.45", "29-B1 123.45", "XE_MAY"},
            {"29B112345", "29-B1 123.45", "XE_MAY"},
            {"30-AB 266.59", "30-AB 266.59", "XE_MAY"},
            {"30ab26659", "30-AB 266.59", "XE_MAY"},
            {"29-AR 123.45", "29-AR 123.45", "XE_MAY"},
            {"29-MĐ1 013.53", "29-MĐ1 013.53", "XE_MAY"},
            {"29-md1 013.53", "29-MĐ1 013.53", "XE_MAY"},
            {"29-B1 1234", "29-B1 1234", "XE_MAY"},
            {"29-KT 123.45", "29-KT 123.45", "XE_MAY"},
            {"29-MD 123.45", "29-MD 123.45", "XE_MAY"},
            {"29MD12345", "29-MD 123.45", "XE_MAY"},
            {"29-MK1 2345", "29-MK1 2345", "XE_MAY"},
            {"29B1 1234", "29-B1 1234", "XE_MAY"},
            {"29 - B1  123 . 45", "29-B1 123.45", "XE_MAY"},
            {"30 A 123.45", "30A-123.45", "O_TO"},
            {"20 KT 226.22", "20KT-226.22", "O_TO"},
            {"29B11234", "29B-112.34", "O_TO"},
            {"29KT12345", "29KT-123.45", "O_TO"},
            {"T80-235.88", "T80-235.88", "TAM_THOI"},
            {"t29 12345", "T29-123.45", "TAM_THOI"},
    };

    private static final String[] CHAN = {
            "", "   ", null, "A", "xe 9 tấn", "30AS-012345", "30I-123.45", "30O-123.45", "3OA-123.45", "30Q-1234", "30W-123.45",
            "30A-123.456", "30A-123", "30A-12.345", "30A--123.45", "30A-000.00", "30A-0000", "29-W1 123.45", "29-B0 123.45",
            "13A-123.45", "42A-123.45", "10A-123.45", "05A-123.45", "80-441-NG-02", "TM-12-34", "T13-123.45", "T80-000.00",
            "30A-123.45 / 29R-012.34", "29-B 123.45", "29-B 1234", "T-80-235.88", "29-AB1 23.45", "29-B11 234", "30A-1234 5",
    };

    @Test
    void nhanBienOToXeMayBienTam_luuCachVietChuan() {
        for (String[] ca : NHAN) {
            BienSoXe.KetQua kq = BienSoXe.kiemTra(ca[0]);
            assertTrue(kq.hopLe(), ca[0] + " → " + kq.loi());
            assertEquals(ca[1], kq.giaTri(), ca[0]);
            assertEquals(BienSoXe.Loai.valueOf(ca[2]), kq.loai(), ca[0]);
        }
    }

    @Test
    void chanBienSaiMau_kemCauLoi() {
        for (String vao : CHAN) {
            BienSoXe.KetQua kq = BienSoXe.kiemTra(vao);
            assertFalse(kq.hopLe(), String.valueOf(vao));
            assertNotNull(kq.loi(), String.valueOf(vao));
            assertNull(kq.giaTri(), String.valueOf(vao));
        }
    }

    @Test
    void cauLoiChiRaChoSai() {
        assertEquals("Nhập biển số xe", BienSoXe.kiemTra("").loi());
        assertTrue(BienSoXe.kiemTra("3OA-123.45").loi().contains("có thể là số 0/1"));
        assertTrue(BienSoXe.kiemTra("30O-123.45").loi().contains("Không dùng chữ I, J, O, Q, W"));
        assertTrue(BienSoXe.kiemTra("42A-123.45").loi().contains("\"42\" không phải mã tỉnh"));
        assertTrue(BienSoXe.kiemTra("30AS-012345").loi().contains("ví dụ 30A-123.45"));
        assertEquals("Số thứ tự không được toàn số 0", BienSoXe.kiemTra("30A-000.00").loi());
        assertEquals("Số thứ tự không được toàn số 0", BienSoXe.kiemTra("T80-000.00").loi());
    }

    @Test
    void bangKyHieuDiaPhuong_81MaPhuLuc02ThongTu51() {
        assertEquals(81, BienSoXe.MA_DIA_PHUONG.size());
        for (String ma : new String[]{"11", "29", "39", "41", "80", "99"}) assertTrue(BienSoXe.MA_DIA_PHUONG.contains(ma), ma);
        for (String ma : new String[]{"10", "13", "42", "44", "45", "46", "87", "91", "96"}) {
            assertFalse(BienSoXe.MA_DIA_PHUONG.contains(ma), ma);
        }
    }

    @Test
    void danTuNoiKhac_khoangTrangKhongNgat_kyTuRong0_gachDai_chuEth_chamGiua() {
        assertEquals("30A-123.45", BienSoXe.kiemTra("30A" + (char) 0xA0 + "123.45").giaTri());
        assertEquals("30A-123.45", BienSoXe.kiemTra("30A-123" + (char) 0x200B + ".45").giaTri());
        assertEquals("30A-123.45", BienSoXe.kiemTra("30A" + (char) 0x2014 + "123" + (char) 0xB7 + "45").giaTri());
        assertEquals("29-MĐ1 013.53", BienSoXe.kiemTra("29-M" + (char) 0xD0 + "1 013.53").giaTri());
        assertEquals("30A-123.45", BienSoXe.kiemTra("30A" + (char) 0x2212 + "123.45").giaTri());
        // Gạch mới của Unicode 14 (Java 17 chưa biết): hai phía cùng chặn
        assertFalse(BienSoXe.kiemTra("30A" + (char) 0x2E5D + "123.45").hopLe());
    }

    @Test
    void chuoiQua64KyTu_chanNgay() {
        assertEquals("Chưa đúng mẫu, ví dụ 30A-123.45",
                BienSoXe.kiemTra("30A-123.45" + " ".repeat(55)).loi());
        assertEquals("30A-123.45", BienSoXe.kiemTra("30A-123.45" + " ".repeat(54)).giaTri());
    }

    @Test
    void chuanHoaLaiCachVietChuan_giuNguyen() {
        for (String[] ca : NHAN) assertEquals(ca[1], BienSoXe.kiemTra(ca[1]).giaTri(), ca[1]);
    }
}
