package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DonBanHangServiceSendToWarehouseTest {

    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private KhoRepository khoRepository;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private NguoiDungRepository nguoiDungRepository;

    private DonBanHangService service;

    private Kho kho1;
    private Kho kho2;
    private DonBanHang donDraft;

    @BeforeEach
    void setUp() {
        service = new DonBanHangService(donBanHangRepository);
        ReflectionTestUtils.setField(service, "khoRepository", khoRepository);
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
        ReflectionTestUtils.setField(service, "nguoiDungRepository", nguoiDungRepository);

        kho1 = Kho.builder().id(1).maKho("KHO-HN").tenKho("Kho Hà Nội").trangThai(1).build();
        kho2 = Kho.builder().id(2).maKho("KHO-HCM").tenKho("Kho Hồ Chí Minh").trangThai(1).build();

        donDraft = DonBanHang.builder()
                .id(120)
                .soDonHang("SHP-1007")
                .loaiChungTu("don_ban_hang")
                .trangThai(0) // Nháp
                .khoXuat(kho1)
                .build();
    }

    @Test
    void sendToWarehouse_thanhCong_voiKhoIdMoi() {
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(khoRepository.findById(2)).thenReturn(Optional.of(kho2));
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.sendToWarehouse(120, 2);

        assertEquals(1, donDraft.getTrangThai(), "Trạng thái đơn phải chuyển sang 1 (Chờ xuất kho)");
        assertEquals(kho2, donDraft.getKhoXuat(), "Kho xuất phải được cập nhật sang Kho 2");
        verify(donBanHangRepository).save(donDraft);
        verify(lichSuThayDoiService).create(any(LichSuThayDoi.class));
    }

    @Test
    void sendToWarehouse_thanhCong_khongTruyenKhoId_giuKhoHienTai() {
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.sendToWarehouse(120, null);

        assertEquals(1, donDraft.getTrangThai());
        assertEquals(kho1, donDraft.getKhoXuat(), "Kho xuất phải giữ nguyên Kho 1");
        verify(donBanHangRepository).save(donDraft);
    }

    @Test
    void sendToWarehouse_thatBai_khoKhongTonTai() {
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(khoRepository.findById(999)).thenReturn(Optional.empty());

        CommonException ex = assertThrows(CommonException.class, () -> service.sendToWarehouse(120, 999));
        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void sendToWarehouse_thatBai_khoTamDungHoatDong() {
        Kho khoInactive = Kho.builder().id(3).maKho("KHO-OFF").tenKho("Kho Tạm Dừng").trangThai(0).build();
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(khoRepository.findById(3)).thenReturn(Optional.of(khoInactive));

        CommonException ex = assertThrows(CommonException.class, () -> service.sendToWarehouse(120, 3));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("tạm dừng"));
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void sendToWarehouse_thatBai_donKhongPhaiTrangThaiNhap() {
        donDraft.setTrangThai(1); // Đã ở Chờ xuất kho
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));

        CommonException ex = assertThrows(CommonException.class, () -> service.sendToWarehouse(120, 2));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Chỉ đơn ở trạng thái Nháp"));
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void sendToWarehouse_thatBai_loaiChungTuBaoGia() {
        donDraft.setLoaiChungTu("bao_gia");
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));

        CommonException ex = assertThrows(CommonException.class, () -> service.sendToWarehouse(120, 2));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Báo giá không thể gửi sang kho"));
        verify(donBanHangRepository, never()).save(any());
    }
}
