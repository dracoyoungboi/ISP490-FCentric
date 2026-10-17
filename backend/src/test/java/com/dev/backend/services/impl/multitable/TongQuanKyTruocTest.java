package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.TongQuanAdminResponse.Diem;
import com.dev.backend.dto.response.TongQuanAdminResponse.DoanhThu;
import com.dev.backend.repository.TongQuanAdminRepository.DoanhThuNgay;
import com.dev.backend.services.impl.multitable.TongQuanAdminServiceImpl.DuLieuNgay;
import com.dev.backend.services.impl.multitable.TongQuanAdminServiceImpl.KhungKy;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Số liệu kỳ trước theo ngày/tháng cho biểu đồ so sánh: đúng khoảng, đúng số điểm, tổng khớp doanhThuKyTruoc. */
class TongQuanKyTruocTest {

    static final LocalDate HOM_NAY = LocalDate.of(2026, 10, 17);

    /** Mỗi ngày từ 1/1/2024 đến hôm nay: doanh thu = số thứ tự ngày × 1.000, giá vốn 40%, 2 đơn. */
    static DuLieuNgay duLieu() {
        DuLieuNgay m = new DuLieuNgay();
        long i = 1;
        for (LocalDate d = LocalDate.of(2024, 1, 1); !d.isAfter(HOM_NAY); d = d.plusDays(1), i++) {
            BigDecimal dt = BigDecimal.valueOf(i * 1000);
            m.doanhThu.put(d, new DoanhThuNgay(d, dt, 2));
            m.giaVon.put(d, dt.multiply(new BigDecimal("0.4")));
        }
        return m;
    }

    private static DoanhThu tinh(String ky) {
        TongQuanAdminServiceImpl s = new TongQuanAdminServiceImpl(null, null);
        return s.tinhDoanhThu(TongQuanAdminServiceImpl.khungKy(ky, HOM_NAY), HOM_NAY, duLieu());
    }

    private static void kiemChung(DoanhThu dt, int soDiem, String dauTien, String cuoiCung) {
        List<Diem> truoc = dt.diemKyTruoc();
        assertEquals(soDiem, truoc.size());
        assertEquals(dauTien, truoc.get(0).tu());
        assertEquals(cuoiCung, truoc.get(truoc.size() - 1).tu());
        assertEquals(dt.diem().stream().filter(d -> !d.chuaKetThuc()).count(), truoc.size(), "cùng số điểm đã trọn");
        assertTrue(truoc.stream().noneMatch(Diem::chuaKetThuc));
        assertEquals(dt.doanhThuKyTruoc(), truoc.stream().mapToLong(Diem::doanhThu).sum(), "tổng khớp doanhThuKyTruoc");
        for (Diem d : truoc) {
            assertEquals(Math.round(d.doanhThu() * 0.6), d.loiNhuan(), "lợi nhuận = doanh thu − giá vốn: " + d.tu());
        }
    }

    @Test
    void ky30Ngay_30NgayLienTruoc() {
        DoanhThu dt = tinh("30_ngay");
        kiemChung(dt, 30, "2026-08-18", "2026-09-16");
        assertEquals("2026-09-17", dt.tuNgay());
        assertEquals(60, dt.diemKyTruoc().stream().mapToLong(Diem::soDon).sum());
    }

    @Test
    void ky7Ngay_7NgayLienTruoc() {
        kiemChung(tinh("7_ngay"), 7, "2026-10-03", "2026-10-09");
    }

    @Test
    void ky12Thang_cungKyNamTruocTheoThang() {
        DoanhThu dt = tinh("12_thang");
        kiemChung(dt, 12, "2024-10-01", "2025-09-01");
        assertEquals("2025-10-01", dt.diem().get(0).tu());
    }
}
