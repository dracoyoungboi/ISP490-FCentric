package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.*;
import com.dev.backend.event.InventoryRestockedEvent;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.multitable.NhatHangService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Hủy đơn: thủ công (chặn khi hàng đã vào khâu kho) và từ sàn (tự xử lý ở mọi bước kho).
 */
@ExtendWith(MockitoExtension.class)
class DonBanHangServiceCancellationTest {

    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private NhatHangService nhatHangService;
    @Mock private KenhBanHangDongBoService kenhBanHangDongBoService;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private PhieuXuatKhoService phieuXuatKhoService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;

    private DonBanHangService service;

    private Kho kho;
    private BienTheSanPham bt;

    @BeforeEach
    void setUp() {
        service = new DonBanHangService(donBanHangRepository);
        ReflectionTestUtils.setField(service, "phieuXuatKhoRepository", phieuXuatKhoRepository);
        ReflectionTestUtils.setField(service, "chiTietDonBanHangRepository", chiTietDonBanHangRepository);
        ReflectionTestUtils.setField(service, "nhatHangService", nhatHangService);
        ReflectionTestUtils.setField(service, "kenhBanHangDongBoService", kenhBanHangDongBoService);
        ReflectionTestUtils.setField(service, "eventPublisher", eventPublisher);
        ReflectionTestUtils.setField(service, "phieuXuatKhoService", phieuXuatKhoService);
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
        kho = Kho.builder().id(1).tenKho("Kho Tổng").build();
        bt = BienTheSanPham.builder().id(10).maSku("SKU-X").build();
    }

    private DonBanHang don(int id, int trangThai, DanhSachNhatHang pickList) {
        return DonBanHang.builder()
                .id(id)
                .soDonHang("SHP-" + id)
                .maDonHangKenh("SHOPIFY-" + id)
                .loaiChungTu("don_ban_hang")
                .trangThai(trangThai)
                .danhSachNhatHang(pickList)
                .khoXuat(kho)
                .build();
    }

    private void coMotDong(DonBanHang don) {
        when(chiTietDonBanHangRepository.findByDonBanHangId(don.getId())).thenReturn(List.of(
                ChiTietDonBanHang.builder().donBanHang(don).bienTheSanPham(bt).soLuongDat(BigDecimal.valueOf(5)).build()));
    }

    // ===================== hủy thủ công =====================

    @Test
    void cancel_donChoNhatChuaVaoPhieuNhat_huyThuHoiPhieuVaDongBoShopify() {
        DonBanHang don = don(100, 1, null);
        when(donBanHangRepository.findById(100)).thenReturn(Optional.of(don));
        coMotDong(don);

        service.cancel(100);

        assertEquals(4, don.getTrangThai());
        verify(donBanHangRepository).save(don);
        verifyNoInteractions(nhatHangService);
        verify(phieuXuatKhoService).huyPhieuXuatNhapTheoDon(100, "Tự động thu hồi do đơn SHP-100 bị hủy");
        verify(eventPublisher).publishEvent(any(InventoryRestockedEvent.class));
        // Không có giao dịch đang mở trong unit test nên lời gọi "sau commit" chạy ngay
        verify(kenhBanHangDongBoService).huyDonHangTrenShopify("SHOPIFY-100", "Hủy từ FCentric");
    }

    @Test
    void cancel_donTrongPhieuNhat_bi409_khongThayDoiGi() {
        for (String ttPhieu : List.of("cho_nhat", "dang_nhat", "da_nhat")) {
            DanhSachNhatHang pickList = DanhSachNhatHang.builder().id(5).maPickList("PL-001").trangThai(ttPhieu).khoXuat(kho).build();
            DonBanHang don = don(101, "da_nhat".equals(ttPhieu) ? 7 : 1, pickList);
            when(donBanHangRepository.findById(101)).thenReturn(Optional.of(don));

            CommonException ex = assertThrows(CommonException.class, () -> service.cancel(101));

            assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus(), ttPhieu);
            assertTrue(ex.getMessage().contains("phiếu nhặt hàng PL-001"), ex.getMessage());
            assertNotEquals(4, don.getTrangThai());
        }
        verify(donBanHangRepository, never()).save(any());
        verifyNoInteractions(nhatHangService, phieuXuatKhoService, eventPublisher, kenhBanHangDongBoService);
    }

    @Test
    void cancel_donChoDongGoiHoacChoXuatKho_khongQuaPhieuNhat_bi409() {
        for (int trangThai : List.of(7, 8)) {
            DonBanHang don = don(102, trangThai, null);
            when(donBanHangRepository.findById(102)).thenReturn(Optional.of(don));

            CommonException ex = assertThrows(CommonException.class, () -> service.cancel(102));

            assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
            assertEquals(trangThai, don.getTrangThai());
        }
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void cancel_donDaXuatHoanThanhHoacHoanTra_khongHuyDuoc() {
        for (int trangThai : List.of(3, 5, 6)) {
            DonBanHang don = don(103, trangThai, null);
            when(donBanHangRepository.findById(103)).thenReturn(Optional.of(don));

            assertThrows(RuntimeException.class, () -> service.cancel(103));

            assertEquals(trangThai, don.getTrangThai());
        }
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void cancel_donDaHuy_khongChayLaiBuocNao() {
        // Bấm hủy lần hai / tab thứ hai / gọi API lặp: chạy lại sẽ trừ số cần nhặt của phiếu nhặt thêm một lần
        DanhSachNhatHang pickList = DanhSachNhatHang.builder().id(5).maPickList("PL-001").trangThai("cho_nhat").build();
        DonBanHang don = don(104, 4, pickList);
        when(donBanHangRepository.findById(104)).thenReturn(Optional.of(don));

        service.cancel(104);

        assertEquals(4, don.getTrangThai());
        verify(donBanHangRepository, never()).save(any());
        verifyNoInteractions(nhatHangService, phieuXuatKhoService, phieuXuatKhoRepository,
                chiTietDonBanHangRepository, eventPublisher, kenhBanHangDongBoService);
    }

    // ===================== hủy từ sàn =====================

    @Test
    void huyDonTuSan_donDaNhat_xuLyPhieuNhatThuHoiPhieu_khongGoiNguocShopify() {
        DanhSachNhatHang pickList = DanhSachNhatHang.builder().id(5).maPickList("PL-001").trangThai("da_nhat").khoXuat(kho).build();
        DonBanHang don = don(105, 7, pickList);
        when(donBanHangRepository.findById(105)).thenReturn(Optional.of(don));

        boolean daHuy = service.huyDonTuSan(105, "Hủy từ sàn Shopify: customer");

        assertTrue(daHuy);
        assertEquals(4, don.getTrangThai());
        assertEquals("Hủy từ sàn Shopify: customer", don.getLyDoTuChoi());
        verify(donBanHangRepository).save(don);
        verify(nhatHangService).xuLyDonBiHuyTrongPickList(don); // entity đang được quản lý, không tách rời
        verify(phieuXuatKhoService).huyPhieuXuatNhapTheoDon(105, "Tự động thu hồi do sàn hủy đơn");
        verifyNoInteractions(eventPublisher, kenhBanHangDongBoService); // đẩy tồn do phiếu nhặt phát; không hủy ngược sàn
    }

    @Test
    void huyDonTuSan_donKhongTrongPhieuNhat_phatSuKienDayTon() {
        DonBanHang don = don(106, 8, null);
        when(donBanHangRepository.findById(106)).thenReturn(Optional.of(don));
        coMotDong(don);

        assertTrue(service.huyDonTuSan(106, "Hủy từ sàn Shopify: "));

        assertEquals(4, don.getTrangThai());
        verify(phieuXuatKhoService).huyPhieuXuatNhapTheoDon(106, "Tự động thu hồi do sàn hủy đơn");
        verify(eventPublisher).publishEvent(any(InventoryRestockedEvent.class));
        verifyNoInteractions(nhatHangService, kenhBanHangDongBoService);
    }

    @Test
    void huyDonTuSan_donDaXuatHoanThanhHoanTra_giuNguyen() {
        for (int trangThai : List.of(3, 5, 6)) {
            DonBanHang don = don(107, trangThai, null);
            when(donBanHangRepository.findById(107)).thenReturn(Optional.of(don));

            assertFalse(service.huyDonTuSan(107, "Hủy từ sàn Shopify: "));

            assertEquals(trangThai, don.getTrangThai(), "sàn hủy đơn đã xuất không được ghi đè thành Đã hủy");
        }
        verify(donBanHangRepository, never()).save(any());
        verifyNoInteractions(nhatHangService, phieuXuatKhoService, eventPublisher);
    }

    @Test
    void huyDonTuSan_donDaXuatMotPhan_giuNguyen() {
        DonBanHang don = don(108, 2, null);
        when(donBanHangRepository.findById(108)).thenReturn(Optional.of(don));
        when(phieuXuatKhoRepository.existsByDonBanHangIdAndTrangThai(108, 3)).thenReturn(true);

        assertFalse(service.huyDonTuSan(108, "Hủy từ sàn Shopify: "));

        assertEquals(2, don.getTrangThai());
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void huyDonTuSan_donDaHuy_khongLamGi() {
        DonBanHang don = don(109, 4, null);
        when(donBanHangRepository.findById(109)).thenReturn(Optional.of(don));

        assertFalse(service.huyDonTuSan(109, "Hủy từ sàn Shopify: "));

        verify(donBanHangRepository, never()).save(any());
        verifyNoInteractions(nhatHangService, phieuXuatKhoService, eventPublisher, lichSuThayDoiService);
    }
}
