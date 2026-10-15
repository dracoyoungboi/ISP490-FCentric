package com.dev.backend.utils;

import com.dev.backend.utils.PhanBoLoFifo.Lo;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Các phép chia lô thuần của nhặt hàng theo lô (Log 2): FIFO, cắt khi đơn hủy, chia cho từng đơn. */
class PhanBoLoFifoTest {

    private static BigDecimal n(String v) {
        return new BigDecimal(v);
    }

    private static Lo lo(int id, String soLuong) {
        return new Lo(id, n(soLuong));
    }

    private static void assertLos(List<Lo> thuc, Lo... mong) {
        assertEquals(mong.length, thuc.size(), "số lô: " + thuc);
        for (int i = 0; i < mong.length; i++) {
            assertEquals(mong[i].loHangId(), thuc.get(i).loHangId(), "lô thứ " + i + ": " + thuc);
            assertEquals(0, mong[i].soLuong().compareTo(thuc.get(i).soLuong()), "số lượng lô thứ " + i + ": " + thuc);
        }
    }

    @Test
    void layFifo_layLoCuTruoc_vaChiaNhieuLoKhiLoDauKhongDu() {
        // L1 (nhập sớm) còn 3, L2 còn 10: cần 5 → L1×3 + L2×2
        assertLos(PhanBoLoFifo.layFifo(List.of(lo(1, "3"), lo(2, "10")), n("5")), lo(1, "3"), lo(2, "2"));
    }

    @Test
    void layFifo_loDauDu_chiLayLoDau() {
        // Dữ liệu demo: L1 còn 10, cần 5 → FIFO đúng là L1×5 (không phải 3 + 2)
        assertLos(PhanBoLoFifo.layFifo(List.of(lo(1, "10"), lo(2, "14")), n("5")), lo(1, "5"));
    }

    @Test
    void layFifo_thieuTon_layHetPhanCo_boQuaLoKhongCon() {
        List<Lo> kq = PhanBoLoFifo.layFifo(List.of(lo(1, "0"), lo(2, "2"), lo(3, "1")), n("5"));
        assertLos(kq, lo(2, "2"), lo(3, "1"));
        assertEquals(0, n("3").compareTo(PhanBoLoFifo.tong(kq)), "thiếu tồn: bên gọi so tổng để báo thiếu");
    }

    @Test
    void catTuLoMoiNhat_donHuyGiuaChung_catLoMoiTruoc() {
        // E1: cần 5 giảm còn 2, phân bổ L1×3 + L2×2 → cắt L2 hết rồi bớt L1 → L1×2
        assertLos(PhanBoLoFifo.catTuLoMoiNhat(List.of(lo(1, "3"), lo(2, "2")), n("2")), lo(1, "2"));
    }

    @Test
    void catTuLoMoiNhat_khongCanCat_giuNguyen_vaVeKhongThiBoHet() {
        assertLos(PhanBoLoFifo.catTuLoMoiNhat(List.of(lo(1, "3"), lo(2, "2")), n("5")), lo(1, "3"), lo(2, "2"));
        assertTrue(PhanBoLoFifo.catTuLoMoiNhat(List.of(lo(1, "3"), lo(2, "2")), n("0")).isEmpty());
    }

    @Test
    void chiaChoDon_donDatSomNhanLoCuTruoc() {
        // B1: SHP-1009 (đặt trước) cần 3, LAZ-5502 cần 2; phân bổ L1×3 + L2×2
        Map<String, java.math.BigDecimal> can = new LinkedHashMap<>();
        can.put("SHP-1009", n("3"));
        can.put("LAZ-5502", n("2"));
        Map<String, List<Lo>> kq = PhanBoLoFifo.chiaChoDon(List.of(lo(1, "3"), lo(2, "2")), can);
        assertLos(kq.get("SHP-1009"), lo(1, "3"));
        assertLos(kq.get("LAZ-5502"), lo(2, "2"));
    }

    @Test
    void chiaChoDon_motDonNhanNhieuLo() {
        // B2: đơn đầu cần 4 mà L1 chỉ có 3 → L1×3 + L2×1; đơn sau nhận phần còn lại của L2
        Map<Integer, BigDecimal> can = new LinkedHashMap<>();
        can.put(10, n("4"));
        can.put(11, n("3"));
        Map<Integer, List<Lo>> kq = PhanBoLoFifo.chiaChoDon(List.of(lo(1, "3"), lo(2, "4")), can);
        assertLos(kq.get(10), lo(1, "3"), lo(2, "1"));
        assertLos(kq.get(11), lo(2, "3"));
    }

    @Test
    void chiaChoDon_phanBoThua_boQuaPhanThua() {
        // Đơn hủy ngoài luồng phiếu nhặt: phân bổ 5 nhưng chỉ còn một đơn cần 2
        Map<Integer, BigDecimal> can = new LinkedHashMap<>();
        can.put(10, n("2"));
        Map<Integer, List<Lo>> kq = PhanBoLoFifo.chiaChoDon(List.of(lo(1, "3"), lo(2, "2")), can);
        assertLos(kq.get(10), lo(1, "2"));
    }
}
