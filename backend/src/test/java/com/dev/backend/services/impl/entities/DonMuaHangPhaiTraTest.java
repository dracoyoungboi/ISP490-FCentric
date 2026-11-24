package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.entities.BienTheSanPhamDto;
import com.dev.backend.dto.response.entities.ChiTietDonMuaHangDto;
import com.dev.backend.dto.response.entities.DonMuaHangDto;
import com.dev.backend.services.BienBanTraHangService;
import com.dev.backend.services.BienBanTraHangService.TraHangTheoDon;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

/** Số phải trả nhà cung cấp của đơn mua (DonMuaHangService.tinhPhaiTra / boSungPhaiTra). */
class DonMuaHangPhaiTraTest {

    private static ChiTietDonMuaHangDto dong(int btId, String gia, int dat, int nhan) {
        return ChiTietDonMuaHangDto.builder().id(btId)
                .bienTheSanPham(BienTheSanPhamDto.builder().id(btId).build())
                .donGia(new BigDecimal(gia)).soLuongDat(BigDecimal.valueOf(dat)).soLuongDaNhan(BigDecimal.valueOf(nhan))
                .build();
    }

    private static DonMuaHangDto don(int id, int trangThai, ChiTietDonMuaHangDto... ds) {
        return DonMuaHangDto.builder().id(id).trangThai(trangThai).tongTien(new BigDecimal("999"))
                .chiTietDonMuaHangs(new ArrayList<>(List.of(ds))).build();
    }

    private static void so(String mong, BigDecimal thuc, String nhan) {
        assertNotNull(thuc, nhan);
        assertEquals(0, new BigDecimal(mong).compareTo(thuc), nhan + ": " + thuc);
    }

    @Test
    @DisplayName("Đơn PO202611247341: 950.000 theo số đặt, trừ 3 sản phẩm lỗi 290.000 → phải trả 660.000")
    void truHangLoi() {
        // Áo M: 5 × 100.000, nhận 3 đạt + 2 lỗi trừ tiền; áo L: 5 × 90.000, nhận 4 đạt + 1 lỗi trừ tiền
        DonMuaHangDto d = don(1, 5, dong(1, "100000", 5, 5), dong(2, "90000", 5, 5));
        DonMuaHangService.tinhPhaiTra(d, new TraHangTheoDon(Map.of(1, 2, 2, 1), 0));
        so("950000", d.getTienTheoDat(), "tiền theo số đặt");
        so("290000", d.getGiamTruLoi(), "giảm trừ");
        assertEquals(3, d.getSoLoiTruTien());
        so("660000", d.getPhaiTra(), "phải trả");
        so("0", d.getKhongGiao(), "không giao");
        assertEquals(0, d.getSoLoiChoChot());
    }

    @Test
    @DisplayName("Đơn đang vận chuyển chưa nhận gì: phải trả = tiền theo số đặt; hàng lỗi chưa chốt chỉ đếm, chưa trừ")
    void dangVanChuyen() {
        DonMuaHangDto d = don(2, 3, dong(1, "100000", 10, 0));
        DonMuaHangService.tinhPhaiTra(d, new TraHangTheoDon(Map.of(), 2));
        so("1000000", d.getPhaiTra(), "phải trả");
        assertEquals(2, d.getSoLoiChoChot());
    }

    @Test
    @DisplayName("Đơn đóng thiếu: chỉ trả hàng đạt đã nhận; phần không giao kể riêng, không trừ hai lần phần lỗi")
    void dongThieu() {
        // Đặt 20 × 100.000, nhận 12 (gồm 2 lỗi đã trừ tiền) rồi đóng: trả 10 đạt, không giao 8
        DonMuaHangDto d = don(3, DonMuaHangService.TRANG_THAI_DA_DONG, dong(1, "100000", 20, 12));
        DonMuaHangService.tinhPhaiTra(d, new TraHangTheoDon(Map.of(1, 2), 0));
        so("1000000", d.getPhaiTra(), "phải trả");
        so("200000", d.getGiamTruLoi(), "giảm trừ");
        so("800000", d.getKhongGiao(), "không giao");
        assertEquals(8, d.getSoKhongGiao());
        so("2000000", d.getTienTheoDat(), "tiền theo số đặt");
        assertEquals(0, d.getTienTheoDat().compareTo(d.getPhaiTra().add(d.getGiamTruLoi()).add(d.getKhongGiao())));
    }

    @Test
    @DisplayName("Đơn đã hủy: phải trả null (hiện —); số trừ không vượt số đã nhận")
    void daHuyVaTruVuot() {
        DonMuaHangDto huy = don(4, DonMuaHangService.TRANG_THAI_DA_HUY, dong(1, "100000", 5, 0));
        DonMuaHangService.tinhPhaiTra(huy, new TraHangTheoDon(Map.of(), 3));
        assertNull(huy.getPhaiTra());
        assertEquals(0, huy.getSoLoiChoChot());

        DonMuaHangDto lech = don(5, 3, dong(1, "100000", 5, 1));
        DonMuaHangService.tinhPhaiTra(lech, new TraHangTheoDon(Map.of(1, 4), 0));
        assertEquals(1, lech.getSoLoiTruTien(), "trừ tối đa bằng số đã nhận");
        so("400000", lech.getPhaiTra(), "phải trả");
    }

    @Test
    @DisplayName("Đơn không có dòng (dữ liệu cũ): phải trả lấy tổng tiền của đơn")
    void khongCoDong() {
        DonMuaHangDto d = DonMuaHangDto.builder().id(6).trangThai(3).tongTien(new BigDecimal("500000")).build();
        DonMuaHangService.tinhPhaiTra(d, TraHangTheoDon.TRONG);
        so("500000", d.getPhaiTra(), "phải trả");
    }

    @Test
    @DisplayName("Cả trang danh sách: đọc biên bản một lần cho mọi đơn; đơn không có biên bản tính như không trừ")
    void caTrang() {
        DonMuaHangService service = new DonMuaHangService(mock(com.dev.backend.repository.DonMuaHangRepository.class));
        BienBanTraHangService bb = mock(BienBanTraHangService.class);
        ReflectionTestUtils.setField(service, "bienBanTraHangService", bb);
        when(bb.traHangTheoDon(anyCollection())).thenReturn(Map.of(10, new TraHangTheoDon(Map.of(1, 1), 0)));
        DonMuaHangDto a = don(10, 5, dong(1, "100000", 2, 2));
        DonMuaHangDto b = don(11, 3, dong(1, "50000", 4, 0));

        service.boSungPhaiTra(List.of(a, b));

        so("100000", a.getPhaiTra(), "đơn có trừ");
        so("200000", b.getPhaiTra(), "đơn không có biên bản");
        verify(bb, times(1)).traHangTheoDon(List.of(10, 11));
    }
}
