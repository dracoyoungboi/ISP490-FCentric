package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.PhieuXuatKho;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DonBanHangServiceGiaoHangSanTest {

    @Mock
    private DonBanHangRepository donBanHangRepository;

    @Mock
    private PhieuXuatKhoRepository phieuXuatKhoRepository;

    @InjectMocks
    private DonBanHangService donBanHangService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(donBanHangService, "phieuXuatKhoRepository", phieuXuatKhoRepository);
        ReflectionTestUtils.setField(donBanHangService, "repository", donBanHangRepository);
    }

    @Test
    @DisplayName("Khi sàn báo SHIPPED nhưng phiếu xuất kho đang ở CHO_XUAT -> Không được nhảy sang Đã xuất kho")
    void testCapNhatTrangThai_shipped_khiCoPhieuChoXuat_khongDoiTrangThai() {
        DonBanHang don = DonBanHang.builder()
                .id(100)
                .soDonHang("SHP-261115BBMC80TC")
                .trangThai(ITrangThaiDonBanHang.DA_DONG_GOI)
                .build();

        PhieuXuatKho px = PhieuXuatKho.builder()
                .id(200)
                .trangThai(ITrangThaiPhieuXuat.CHO_XUAT)
                .build();

        when(donBanHangRepository.findById(100)).thenReturn(Optional.of(don));
        when(phieuXuatKhoRepository.findByDonBanHangId(100)).thenReturn(List.of(px));

        boolean updated = donBanHangService.capNhatTrangThaiGiaoHangTuSan(100, "SHIPPED");

        assertFalse(updated, "Hàm phải trả về false và không đổi trạng thái đơn");
        assertEquals(ITrangThaiDonBanHang.DA_DONG_GOI, don.getTrangThai(), "Đơn phải giữ nguyên trạng thái Đã đóng gói (8)");
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    @DisplayName("Khi sàn báo SHIPPED và không có phiếu xuất kho nào đang chờ duyệt -> Chuyển sang Đã xuất kho")
    void testCapNhatTrangThai_shipped_khiKhongCoPhieuChoXuat_chuyenDaXuatKho() {
        DonBanHang don = DonBanHang.builder()
                .id(101)
                .soDonHang("SHP-261115XYZ")
                .trangThai(ITrangThaiDonBanHang.DA_DONG_GOI)
                .build();

        when(donBanHangRepository.findById(101)).thenReturn(Optional.of(don));
        when(phieuXuatKhoRepository.findByDonBanHangId(101)).thenReturn(List.of());

        boolean updated = donBanHangService.capNhatTrangThaiGiaoHangTuSan(101, "SHIPPED");

        assertTrue(updated, "Hàm phải trả về true");
        assertEquals(ITrangThaiDonBanHang.DA_XUAT_TOAN_BO, don.getTrangThai(), "Đơn phải chuyển sang Đã xuất toàn bộ (3)");
        verify(donBanHangRepository, times(1)).save(don);
    }

    @Test
    @DisplayName("Shopify: Khi sàn báo fulfilled -> Chuyển sang Đã xuất kho (3), KHÔNG được nhảy sang Hoàn thành (5)")
    void testCapNhatTrangThai_fulfilled_chuyenSangDaXuatKho_KhongNhaySangHoanThanh() {
        DonBanHang don = DonBanHang.builder()
                .id(102)
                .soDonHang("SPF-102")
                .trangThai(ITrangThaiDonBanHang.DA_DONG_GOI)
                .build();

        when(donBanHangRepository.findById(102)).thenReturn(Optional.of(don));
        when(phieuXuatKhoRepository.findByDonBanHangId(102)).thenReturn(List.of());

        boolean updated = donBanHangService.capNhatTrangThaiGiaoHangTuSan(102, "fulfilled");

        assertTrue(updated, "Hàm phải trả về true");
        assertEquals(ITrangThaiDonBanHang.DA_XUAT_TOAN_BO, don.getTrangThai(), "fulfilled trên Shopify chỉ là Đã xuất kho (3), không phải Hoàn thành (5)");
        assertNotEquals(ITrangThaiDonBanHang.HOAN_THANH, don.getTrangThai());
        verify(donBanHangRepository, times(1)).save(don);
    }

    @Test
    @DisplayName("Shopify: Khi sàn báo delivered -> Chuyển sang Hoàn thành (5) và cập nhật đã thanh toán")
    void testCapNhatTrangThai_delivered_chuyenSangHoanThanh() {
        DonBanHang don = DonBanHang.builder()
                .id(103)
                .soDonHang("SPF-103")
                .trangThai(ITrangThaiDonBanHang.DA_XUAT_TOAN_BO)
                .build();

        when(donBanHangRepository.findById(103)).thenReturn(Optional.of(don));
        when(phieuXuatKhoRepository.findByDonBanHangId(103)).thenReturn(List.of());

        boolean updated = donBanHangService.capNhatTrangThaiGiaoHangTuSan(103, "delivered");

        assertTrue(updated, "Hàm phải trả về true");
        assertEquals(ITrangThaiDonBanHang.HOAN_THANH, don.getTrangThai(), "delivered trên Shopify chuyển sang Hoàn thành (5)");
        assertEquals("da_thanh_toan", don.getTrangThaiThanhToan());
        verify(donBanHangRepository, times(1)).save(don);
    }

    @Test
    @DisplayName("Shopify: Khi sàn báo refunded hoặc returned -> Chuyển sang Bị hoàn trả (6)")
    void testCapNhatTrangThai_refunded_chuyenSangBiHoanTra() {
        DonBanHang don = DonBanHang.builder()
                .id(104)
                .soDonHang("SPF-104")
                .trangThai(ITrangThaiDonBanHang.DA_XUAT_TOAN_BO)
                .build();

        when(donBanHangRepository.findById(104)).thenReturn(Optional.of(don));

        boolean updated = donBanHangService.capNhatTrangThaiGiaoHangTuSan(104, "refunded");

        assertTrue(updated, "Hàm phải trả về true");
        assertEquals(ITrangThaiDonBanHang.BI_HOAN_TRA, don.getTrangThai(), "refunded trên Shopify chuyển sang Bị hoàn trả (6)");
        verify(donBanHangRepository, times(1)).save(don);
    }

    @Test
    @DisplayName("Shopee: Khi sàn báo TO_CONFIRM_RECEIVE -> Chuyển sang Đã xuất kho (3)")
    void testCapNhatTrangThai_shopeeToConfirmReceive_chuyenSangDaXuatKho() {
        DonBanHang don = DonBanHang.builder()
                .id(105)
                .soDonHang("SHP-105")
                .trangThai(ITrangThaiDonBanHang.DA_DONG_GOI)
                .build();

        when(donBanHangRepository.findById(105)).thenReturn(Optional.of(don));
        when(phieuXuatKhoRepository.findByDonBanHangId(105)).thenReturn(List.of());

        boolean updated = donBanHangService.capNhatTrangThaiGiaoHangTuSan(105, "TO_CONFIRM_RECEIVE");

        assertTrue(updated, "Hàm phải trả về true");
        assertEquals(ITrangThaiDonBanHang.DA_XUAT_TOAN_BO, don.getTrangThai(), "TO_CONFIRM_RECEIVE chuyển sang Đã xuất kho (3)");
        verify(donBanHangRepository, times(1)).save(don);
    }
}

