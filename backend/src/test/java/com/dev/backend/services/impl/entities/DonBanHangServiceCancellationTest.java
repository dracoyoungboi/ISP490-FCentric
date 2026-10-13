package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.*;
import com.dev.backend.event.InventoryRestockedEvent;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.multitable.NhatHangService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DonBanHangServiceCancellationTest {

    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private NhatHangService nhatHangService;
    @Mock private KenhBanHangDongBoService kenhBanHangDongBoService;
    @Mock private ApplicationEventPublisher eventPublisher;

    private DonBanHangService service;

    @BeforeEach
    void setUp() {
        service = new DonBanHangService(donBanHangRepository);
        ReflectionTestUtils.setField(service, "phieuXuatKhoRepository", phieuXuatKhoRepository);
        ReflectionTestUtils.setField(service, "chiTietDonBanHangRepository", chiTietDonBanHangRepository);
        ReflectionTestUtils.setField(service, "nhatHangService", nhatHangService);
        ReflectionTestUtils.setField(service, "kenhBanHangDongBoService", kenhBanHangDongBoService);
        ReflectionTestUtils.setField(service, "eventPublisher", eventPublisher);
    }

    @Test
    void cancel_orderWithDraftPxk_revokesPxkAndNotifiesShopify() {
        // Arrange
        Kho kho = Kho.builder().id(1).tenKho("Kho Tổng").build();
        DanhSachNhatHang pickList = DanhSachNhatHang.builder().id(5).maPickList("PL-001").trangThai("da_nhat").khoXuat(kho).build();
        DonBanHang don = DonBanHang.builder()
                .id(100)
                .soDonHang("SHP-1001")
                .maDonHangKenh("SHOPIFY-999")
                .loaiChungTu("don_ban_hang")
                .trangThai(2) // Đang xử lý
                .danhSachNhatHang(pickList)
                .khoXuat(kho)
                .build();

        PhieuXuatKho draftPxk = PhieuXuatKho.builder()
                .id(200)
                .soPhieuXuat("PXK-20261012-001")
                .donBanHang(don)
                .trangThai(0) // Nháp / Chờ xuất
                .build();

        BienTheSanPham bt = BienTheSanPham.builder().id(10).maSku("SKU-X").build();
        ChiTietDonBanHang ctd = ChiTietDonBanHang.builder()
                .donBanHang(don)
                .bienTheSanPham(bt)
                .soLuongDat(BigDecimal.valueOf(5))
                .build();

        when(donBanHangRepository.findById(100)).thenReturn(Optional.of(don));
        when(phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThai(100, 3)).thenReturn(false);
        when(phieuXuatKhoRepository.findByDonBanHangId(100)).thenReturn(List.of(draftPxk));
        when(chiTietDonBanHangRepository.findByDonBanHangId(100)).thenReturn(List.of(ctd));

        // Act
        service.cancel(100);

        // Assert
        // 1. Trạng thái đơn chuyển sang Đã hủy (4)
        assertEquals(4, don.getTrangThai());
        verify(donBanHangRepository).save(don);

        // 2. Pick List được cập nhật điều phối
        verify(nhatHangService).xuLyDonBiHuyTrongPickList(don);

        // 3. Phiếu xuất kho nháp chuyển sang Đã hủy (2)
        assertEquals(2, draftPxk.getTrangThai());
        assertTrue(draftPxk.getGhiChu().contains("Tự động thu hồi do đơn SHP-1001 bị hủy"));
        verify(phieuXuatKhoRepository).save(draftPxk);

        // 4. Phát sự kiện khôi phục tồn Free to Use
        verify(eventPublisher).publishEvent(any(InventoryRestockedEvent.class));

        // 5. Đồng bộ hủy đơn sang Shopify API
        verify(kenhBanHangDongBoService).huyDonHangTrenShopify("SHOPIFY-999", "Hủy từ FCentric");
    }
}

