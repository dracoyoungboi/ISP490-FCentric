package com.dev.backend.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class NoiDungVietQrTest {

    private static String truong(String id, String value) {
        return id + String.format("%02d", value.length()) + value;
    }

    @Test
    void docNoiDungDayDuPayosTuMaQr() {
        String merchant = truong("00", "A000000727") + truong("01", truong("00", "970418") + truong("01", "8861569020"))
                + truong("02", "QRIBFTTA");
        String qr = truong("00", "01") + truong("01", "12") + truong("38", merchant) + truong("53", "704")
                + truong("54", "120000") + truong("58", "VN") + truong("62", truong("08", "CST9DVDPQ93 FC2320800"))
                + "6304ABCD";

        assertEquals("CST9DVDPQ93 FC2320800", NoiDungVietQr.tuMaQr(qr));
    }

    @Test
    void truong62CoMucConKhacDungTruoc_vaTruong38ChuaChuoi62() {
        String merchant = truong("00", "A000000727") + truong("01", "62" + "0812ABC");
        String qr = truong("00", "01") + truong("38", merchant)
                + truong("62", truong("05", "REF") + truong("07", "POS1") + truong("08", "CSAB12 FC123")) + "6304ABCD";
        assertEquals("CSAB12 FC123", NoiDungVietQr.tuMaQr(qr));
    }

    @Test
    void docLechRaKyTuLa_traNullDeDungDescription() {
        String qr = truong("00", "01") + truong("62", truong("08", "Nội dung")) + "6304ABCD";
        assertNull(NoiDungVietQr.tuMaQr(qr));
    }

    @Test
    void chuoiHongHoacKhongCoNoiDung_traNull() {
        assertNull(NoiDungVietQr.tuMaQr(null));
        assertNull(NoiDungVietQr.tuMaQr("0002010102"));
        assertNull(NoiDungVietQr.tuMaQr("000201xx"));
        assertNull(NoiDungVietQr.tuMaQr("0002015802VN" + "6299" + "0805ABCDE"));
    }
}
