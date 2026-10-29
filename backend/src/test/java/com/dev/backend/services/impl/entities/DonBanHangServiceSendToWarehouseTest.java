package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.response.customize.KhoKhaDungDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.services.impl.multitable.GiuChoChuyenKhoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
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
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @Mock private GiuChoChuyenKhoService giuChoChuyenKhoService;

    private DonBanHangService service;

    private Kho kho1;
    private Kho kho2;
    private Kho khoTrungChuyen;
    private DonBanHang donDraft;

    @BeforeEach
    void setUp() {
        service = new DonBanHangService(donBanHangRepository);
        ReflectionTestUtils.setField(service, "khoRepository", khoRepository);
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
        ReflectionTestUtils.setField(service, "nguoiDungRepository", nguoiDungRepository);
        ReflectionTestUtils.setField(service, "chiTietDonBanHangRepository", chiTietDonBanHangRepository);
        ReflectionTestUtils.setField(service, "tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        ReflectionTestUtils.setField(service, "chiTietPhieuXuatKhoRepository", chiTietPhieuXuatKhoRepository);
        ReflectionTestUtils.setField(service, "giuChoChuyenKhoService", giuChoChuyenKhoService);

        kho1 = Kho.builder().id(1).maKho("KHO-HN").tenKho("Kho Hà Nội").trangThai(1).build();
        kho2 = Kho.builder().id(2).maKho("KHO-HCM").tenKho("Kho Hồ Chí Minh").trangThai(1).build();
        khoTrungChuyen = Kho.builder().id(20).maKho("KHO_TRANSIT").tenKho("Kho Trung Chuyển").trangThai(1).build();

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

        assertEquals(1, donDraft.getTrangThai(), "Trạng thái đơn phải chuyển sang 1 (Chờ nhặt hàng)");
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
        assertTrue(ex.getMessage().contains("ngừng hoạt động"));
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void sendToWarehouse_thatBai_khoTrungChuyen() {
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(khoRepository.findById(20)).thenReturn(Optional.of(khoTrungChuyen));

        CommonException ex = assertThrows(CommonException.class, () -> service.sendToWarehouse(120, 20));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Kho Trung Chuyển"));
        assertEquals(0, donDraft.getTrangThai());
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void sendToWarehouse_thatBai_khongTruyenKhoId_khoHienTaiLaKhoTrungChuyen() {
        donDraft.setKhoXuat(khoTrungChuyen);
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));

        CommonException ex = assertThrows(CommonException.class, () -> service.sendToWarehouse(120, null));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void sendToWarehouse_thatBai_khongCoKhoNao_khongMacDinhKho1() {
        donDraft.setKhoXuat(null);
        SecurityContextHolder.clear(); // không có ngữ cảnh kho
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));

        CommonException ex = assertThrows(CommonException.class, () -> service.sendToWarehouse(120, null));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Vui lòng chọn kho xuất"));
        verify(khoRepository, never()).findById(any());
        verify(donBanHangRepository, never()).save(any());
    }

    @Test
    void sendToWarehouse_thatBai_donKhongPhaiTrangThaiNhap() {
        donDraft.setTrangThai(1); // Đã ở Chờ nhặt hàng
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

    @Test
    void getKhoKhaDung_thanhCong_kho1DuHang_kho2ThieuHang_sapXepChuan() {
        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(1).tenSanPham("Áo Thun Polo").build();
        MauSac mauTrang = MauSac.builder().id(1).tenMau("Trắng").build();
        Size sizeM = Size.builder().id(1).tenSize("M").build();

        BienTheSanPham bt1 = BienTheSanPham.builder()
                .id(10)
                .maSku("AT-TRG-M")
                .sanPham(sp)
                .mauSac(mauTrang)
                .size(sizeM)
                .build();
        BienTheSanPham bt2 = BienTheSanPham.builder()
                .id(20)
                .maSku("AT-TRG-L")
                .sanPham(sp)
                .mauSac(mauTrang)
                .size(sizeM)
                .build();

        ChiTietDonBanHang ct1 = ChiTietDonBanHang.builder()
                .id(1)
                .donBanHang(donDraft)
                .bienTheSanPham(bt1)
                .soLuongDat(BigDecimal.valueOf(2))
                .build();
        ChiTietDonBanHang ct2 = ChiTietDonBanHang.builder()
                .id(2)
                .donBanHang(donDraft)
                .bienTheSanPham(bt2)
                .soLuongDat(BigDecimal.valueOf(3))
                .build();

        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(chiTietDonBanHangRepository.findByDonBanHangId(120)).thenReturn(List.of(ct1, ct2));
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(kho1, kho2));

        // Khả dụng theo lô (tồn − đang giữ): Kho 1 có bt1: 10, bt2: 5. Kho 2 có bt1: 1, bt2: 10
        List<Object[]> onHandData = List.<Object[]>of(
                new Object[]{10, 1, BigDecimal.valueOf(10)},
                new Object[]{20, 1, BigDecimal.valueOf(5)},
                new Object[]{10, 2, BigDecimal.valueOf(1)},
                new Object[]{20, 2, BigDecimal.valueOf(10)}
        );
        when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(List.of(10, 20))).thenReturn(onHandData);

        // Chờ xuất: Kho 1 có đơn khác đặt bt2: 1 cái, chưa xuất (còn lại 4 >= 3). Kho 2: không có
        List<Object[]> outgoingData = List.<Object[]>of(
                new Object[]{20, 1, BigDecimal.valueOf(1)}
        );
        when(chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(List.of(10, 20), 120, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(outgoingData);

        List<KhoKhaDungDto> result = service.getKhoKhaDungChoDonHang(120);

        assertNotNull(result);
        assertEquals(2, result.size());

        // Kho 1 đủ hàng cả 2 món (10-0=10 >= 2; 5-1=4 >= 3) -> duHang = true
        // Kho 2 thiếu bt1 (1-0=1 < 2; 10-0=10 >= 3) -> duHang = false
        // Sắp xếp: Kho 1 phải đứng đầu tiên
        KhoKhaDungDto topKho = result.get(0);
        assertEquals(1, topKho.getKhoId());
        assertTrue(topKho.getDuHang(), "Kho 1 phải đủ hàng");
        assertEquals(2, topKho.getSoLuongMatHangDu());
        assertEquals(2, topKho.getTongSoMatHang());

        KhoKhaDungDto secondKho = result.get(1);
        assertEquals(2, secondKho.getKhoId());
        assertFalse(secondKho.getDuHang(), "Kho 2 phải thiếu hàng do bt1 chỉ còn 1/2");
        assertEquals(1, secondKho.getSoLuongMatHangDu());
        assertEquals(2, secondKho.getTongSoMatHang());
    }

    @Test
    void getKhoKhaDung_choXuatChiTinhPhanChuaXuat() {
        BienTheSanPham bt = BienTheSanPham.builder().id(10).maSku("AT-TRG-M")
                .sanPham(SanPhamQuanAo.builder().id(1).tenSanPham("Áo").build()).build();
        ChiTietDonBanHang ct = ChiTietDonBanHang.builder().id(1).donBanHang(donDraft).bienTheSanPham(bt)
                .soLuongDat(BigDecimal.valueOf(3)).build();
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(chiTietDonBanHangRepository.findByDonBanHangId(120)).thenReturn(List.of(ct));
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(kho1));
        when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(List.of(10)))
                .thenReturn(List.<Object[]>of(new Object[]{10, 1, BigDecimal.valueOf(5)}));
        // Đơn khác đặt 4, đã xuất 2 (xuất một phần) → còn chờ xuất 2 → khả dụng 5 − 2 = 3 >= 3
        when(chiTietDonBanHangRepository.sumDatDonGiuHangTheoKho(List.of(10), 120, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(List.<Object[]>of(new Object[]{10, 1, BigDecimal.valueOf(4)}));
        when(chiTietPhieuXuatKhoRepository.sumDaXuatDonGiuHangTheoKho(List.of(10), 120, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(List.<Object[]>of(new Object[]{10, 1, BigDecimal.valueOf(2)}));

        List<KhoKhaDungDto> result = service.getKhoKhaDungChoDonHang(120);

        assertEquals(1, result.size());
        assertTrue(result.get(0).getDuHang(), "phần đã xuất không được trừ lần nữa");
        assertEquals(0, BigDecimal.valueOf(3).compareTo(result.get(0).getChiTietTonKho().get(0).getTonKhaDung()));
    }

    @Test
    void getKhoKhaDung_truHangPhieuChuyenKhoDangGiuChoOKhoNguon() {
        // Kho 1 khả dụng theo lô 5, phiếu chuyển Chờ duyệt / Đã duyệt từ kho 1 giữ chỗ 3 → còn 2 < 3: không đủ.
        // Phiếu chuyển giữ ở kho khác (kho 2) không trừ vào kho 1.
        BienTheSanPham bt = BienTheSanPham.builder().id(10).maSku("AT-TRG-M")
                .sanPham(SanPhamQuanAo.builder().id(1).tenSanPham("Áo").build()).build();
        ChiTietDonBanHang ct = ChiTietDonBanHang.builder().id(1).donBanHang(donDraft).bienTheSanPham(bt)
                .soLuongDat(BigDecimal.valueOf(3)).build();
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(chiTietDonBanHangRepository.findByDonBanHangId(120)).thenReturn(List.of(ct));
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(kho1, kho2));
        when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(List.of(10))).thenReturn(List.<Object[]>of(
                new Object[]{10, 1, BigDecimal.valueOf(5)},
                new Object[]{10, 2, BigDecimal.valueOf(4)}));
        when(giuChoChuyenKhoService.theoKho(List.of(10)))
                .thenReturn(java.util.Map.of(10, java.util.Map.of(1, BigDecimal.valueOf(3), 2, BigDecimal.ONE)));

        List<KhoKhaDungDto> result = service.getKhoKhaDungChoDonHang(120);

        KhoKhaDungDto k1 = result.stream().filter(k -> k.getKhoId() == 1).findFirst().orElseThrow();
        KhoKhaDungDto k2 = result.stream().filter(k -> k.getKhoId() == 2).findFirst().orElseThrow();
        assertFalse(k1.getDuHang());
        assertEquals(0, BigDecimal.valueOf(2).compareTo(k1.getChiTietTonKho().get(0).getTonKhaDung()));
        assertTrue(k2.getDuHang());
        assertEquals(0, BigDecimal.valueOf(3).compareTo(k2.getChiTietTonKho().get(0).getTonKhaDung()));
    }

    @Test
    void getKhoKhaDung_thatBai_donKhongTonTai() {
        when(donBanHangRepository.findById(999)).thenReturn(Optional.empty());

        CommonException ex = assertThrows(CommonException.class, () -> service.getKhoKhaDungChoDonHang(999));
        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
    }

    @Test
    void getKhoKhaDung_donKhongCoChiTiet_traVeTatCaKhoDuHang() {
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(chiTietDonBanHangRepository.findByDonBanHangId(120)).thenReturn(Collections.emptyList());
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(kho1, kho2));

        List<KhoKhaDungDto> result = service.getKhoKhaDungChoDonHang(120);

        assertEquals(2, result.size());
        assertTrue(result.get(0).getDuHang());
        assertEquals(0, result.get(0).getTongSoMatHang());
    }

    @Test
    void getKhoKhaDung_boQuaKhoTrungChuyen() {
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(chiTietDonBanHangRepository.findByDonBanHangId(120)).thenReturn(Collections.emptyList());
        when(khoRepository.findByTrangThai(1)).thenReturn(List.of(kho1, khoTrungChuyen, kho2));

        List<KhoKhaDungDto> result = service.getKhoKhaDungChoDonHang(120);

        assertEquals(List.of(1, 2), result.stream().map(KhoKhaDungDto::getKhoId).toList(),
                "modal Gửi sang kho không được gợi ý Kho Trung Chuyển");
    }

    @Test
    void getKhoKhaDung_khongCoKhoHoatDong_traVeEmptyList() {
        when(donBanHangRepository.findById(120)).thenReturn(Optional.of(donDraft));
        when(chiTietDonBanHangRepository.findByDonBanHangId(120)).thenReturn(Collections.emptyList());
        when(khoRepository.findByTrangThai(1)).thenReturn(Collections.emptyList());

        List<KhoKhaDungDto> result = service.getKhoKhaDungChoDonHang(120);

        assertTrue(result.isEmpty());
    }
}
