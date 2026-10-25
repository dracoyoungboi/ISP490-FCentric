package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.HangNhapKhoTongResponse;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.BienThe;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.KhoTong;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.HangNhapKhoTongRepository;
import com.dev.backend.repository.HangNhapKhoTongRepository.HangDong;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanVaiTroRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Hàng nhập về Kho tổng (màn Tạo yêu cầu nhập hàng): chọn Kho tổng, số đề xuất và cờ còn dư theo đúng quy tắc mục
 * Cần mua / phân loại Dư ở Tổng quan, gắn số đang về và yêu cầu nhập đang mở.
 */
@ExtendWith(MockitoExtension.class)
class HangNhapKhoTongServiceTest {

    @Mock
    private HangNhapKhoTongRepository repo;
    @Mock
    private TongQuanVaiTroRepository vaiTro;
    @Mock
    private TongQuanAdminRepository admin;

    private HangNhapKhoTongService service;

    private final KhoTong khoTong1 = new KhoTong(1, "KHO_TONG", "Kho tổng", "Hà Nội", "Quản lý A");
    private final KhoTong khoTong2 = new KhoTong(5, "KHO_TONG_2", "Kho tổng 2", null, null);

    @BeforeEach
    void setUp() {
        service = new HangNhapKhoTongService(repo, vaiTro, admin);
    }

    private static HangDong hang(int id, long khaDung, boolean daTungNhap, int nguong) {
        return new HangDong(id, "SKU-" + id, "20" + id, 100, "AK01", "Áo khoác", "Áo khoác", "Đen", "#111111", "M",
                "Cotton", null, khaDung, daTungNhap, nguong);
    }

    @Test
    void quyTacDeXuat_giongMucCanMua() {
        // khả dụng + đang về ≤ ngưỡng → đưa lên gấp đôi ngưỡng, tối thiểu 1
        assertEquals(20, HangNhapKhoTongService.soLuongDeXuat(true, 0, 0, 10));
        assertEquals(12, HangNhapKhoTongService.soLuongDeXuat(true, 3, 5, 10));
        assertEquals(10, HangNhapKhoTongService.soLuongDeXuat(true, 10, 0, 10));
        assertEquals(0, HangNhapKhoTongService.soLuongDeXuat(true, 6, 5, 10), "vượt ngưỡng khi tính cả đang về");
        assertEquals(0, HangNhapKhoTongService.soLuongDeXuat(false, 0, 0, 10), "chưa từng nhập thì không đề xuất");
        assertEquals(15, HangNhapKhoTongService.soLuongDeXuat(true, -5, 0, 5), "khả dụng âm vẫn tính đúng");
    }

    @Test
    void quyTacConDu_theoHeSoDu() {
        assertFalse(HangNhapKhoTongService.conDu(20, 10, 10, 3));
        assertTrue(HangNhapKhoTongService.conDu(25, 6, 10, 3));
        assertTrue(HangNhapKhoTongService.conDu(0, 31, 10, 3), "đang về cũng tính");
    }

    @Test
    void hangKhoTong_khongTruyenKho_layKhoTongDauTien_vaGhepSoLieu() {
        when(repo.khoTongHoatDong()).thenReturn(List.of(khoTong1, khoTong2));
        when(admin.cauHinhSo("DEFAULT_MIN_STOCK_ALERT")).thenReturn(10);
        when(admin.cauHinhSo("SURPLUS_STOCK_RATIO")).thenReturn(null);
        when(repo.hangKhoTong(1, 10)).thenReturn(List.of(hang(7, 2, true, 10), hang(8, 40, true, 10), hang(9, 0, false, 10)));
        when(vaiTro.dangVeTheoBienThe(eq(1), any())).thenReturn(Map.of(7, 3L));
        when(vaiTro.yeuCauMoTheoBienThe(any())).thenReturn(Map.of(7, new TongQuanVaiTroRepository.YeuCauMo(31, "PR202610240031", 2)));

        HangNhapKhoTongResponse kq = service.hangKhoTong(null);

        assertEquals(khoTong1, kq.kho());
        assertEquals(2, kq.dsKhoTong().size());
        assertEquals(10, kq.nguongMacDinh());
        assertEquals(TongQuanAdminServiceImpl.HE_SO_DU_MAC_DINH, kq.heSoDu(), "chưa cấu hình thì dùng mặc định");
        BienThe can = kq.bienThe().get(0);
        assertEquals(3, can.dangVe());
        assertEquals(15, can.soLuongDeXuat());
        assertFalse(can.du());
        assertEquals("PR202610240031", can.yeuCauMo().ma());
        assertEquals(2, can.yeuCauMo().soYeuCau());
        BienThe du = kq.bienThe().get(1);
        assertEquals(0, du.soLuongDeXuat());
        assertTrue(du.du());
        assertNull(du.yeuCauMo());
        BienThe chuaNhap = kq.bienThe().get(2);
        assertFalse(chuaNhap.daTungNhap());
        assertEquals(0, chuaNhap.soLuongDeXuat());
    }

    @Test
    void hangKhoTong_chonKhoTongKhac() {
        when(repo.khoTongHoatDong()).thenReturn(List.of(khoTong1, khoTong2));
        when(repo.hangKhoTong(eq(5), anyInt())).thenReturn(List.of());
        when(vaiTro.dangVeTheoBienThe(eq(5), any())).thenReturn(Map.of());
        when(vaiTro.yeuCauMoTheoBienThe(any())).thenReturn(Map.of());

        assertEquals(khoTong2, service.hangKhoTong(5).kho());
    }

    @Test
    void hangKhoTong_khoKhongPhaiKhoTong_biChan() {
        when(repo.khoTongHoatDong()).thenReturn(List.of(khoTong1));
        CommonException ex = assertThrows(CommonException.class, () -> service.hangKhoTong(2));
        assertTrue(ex.getMessage().contains("Kho tổng"));
        verify(repo, never()).hangKhoTong(anyInt(), anyInt());
    }

    @Test
    void hangKhoTong_chuaCoKhoTong_traRong() {
        when(repo.khoTongHoatDong()).thenReturn(List.of());
        HangNhapKhoTongResponse kq = service.hangKhoTong(null);
        assertNull(kq.kho());
        assertTrue(kq.bienThe().isEmpty());
        verifyNoInteractions(vaiTro);
    }

    @Test
    void hangKhoTong_docCauHinhLoi_vanDungMacDinh() {
        when(repo.khoTongHoatDong()).thenReturn(List.of(khoTong1));
        when(admin.cauHinhSo(any())).thenThrow(new RuntimeException("mất kết nối"));
        when(repo.hangKhoTong(1, TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH)).thenReturn(List.of());
        when(vaiTro.dangVeTheoBienThe(eq(1), any())).thenReturn(Map.of());
        when(vaiTro.yeuCauMoTheoBienThe(any())).thenReturn(Map.of());

        HangNhapKhoTongResponse kq = service.hangKhoTong(null);
        assertEquals(TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH, kq.nguongMacDinh());
    }
}
