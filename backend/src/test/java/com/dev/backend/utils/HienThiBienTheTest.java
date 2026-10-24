package com.dev.backend.utils;

import com.dev.backend.entities.AnhBienThe;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.TepTin;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Ảnh biến thể trên bảng chứng từ: đường dẫn MinIO http theo IP phải đổi sang https như các chỗ trả ảnh khác. */
class HienThiBienTheTest {

    private static BienTheSanPham coAnh(String duongDan) {
        return BienTheSanPham.builder().id(1)
                .anhBienThe(AnhBienThe.builder().tepTin(TepTin.builder().duongDan(duongDan).build()).build())
                .build();
    }

    @Test
    void anh_duongDanHttpTheoIp_doiSangHttps() {
        assertEquals("https://minio.slmglobal.vn/fashion/anh-1.png",
                HienThiBienThe.anh(coAnh("http://171.244.142.43:9000/fashion/anh-1.png")));
    }

    @Test
    void anh_duongDanHttpsGiuNguyen() {
        assertEquals("https://minio.slmglobal.vn/fashion/anh-2.png",
                HienThiBienThe.anh(coAnh("https://minio.slmglobal.vn/fashion/anh-2.png")));
    }

    @Test
    void anh_thieuBienTheAnhHoacTep_traNull() {
        assertNull(HienThiBienThe.anh(null));
        assertNull(HienThiBienThe.anh(BienTheSanPham.builder().id(1).build()));
        assertNull(HienThiBienThe.anh(BienTheSanPham.builder().id(1).anhBienThe(AnhBienThe.builder().build()).build()));
    }
}
