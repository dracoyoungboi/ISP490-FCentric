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

    @Test
    void shopeeUnpaidChoXacNhan_chanGuiKhoInVanDonVaBaoChiXem() {
        KenhBanHang shopee = KenhBanHang.builder().id(8).maKenh("SHOPEE_OFFICIAL").tenKenh("Shopee").build();
        DonBanHang donUnpaid = DonBanHang.builder()
                .id(125)
                .soDonHang("SHP-UNPAID123")
                .maDonHangKenh("UNPAID123")
                .kenhBanHang(shopee)
                .loaiChungTu("don_ban_hang")
                .trangThai(0)
                .khoXuat(Kho.builder().id(1).maKho("KHO_TONG").tenKho("Kho Tổng").loaiKho("kho_tong").trangThai(1).build())
                .ghiChu("Đơn hàng đồng bộ tự động từ Shopee #UNPAID123 [SHOPEE_CHO_XAC_NHAN]")
                .build();
        when(donBanHangRepository.findById(125)).thenReturn(Optional.of(donUnpaid));

        assertTrue(DonBanHangService.laDonShopeeChoXacNhan(donUnpaid));
        CommonException guiKhoEx = assertThrows(CommonException.class, () -> service.sendToWarehouse(125, 1));
        assertEquals(HttpStatus.BAD_REQUEST, guiKhoEx.getHttpStatus());
        verify(donBanHangRepository, never()).save(any());

        CommonException inVanDonEx = assertThrows(CommonException.class, () -> service.layVanDonSan(125));
        assertEquals(HttpStatus.BAD_REQUEST, inVanDonEx.getHttpStatus());
    }

    @Test
    void donBaSan_duTonKhoHienTai_guiThangKhongCanThuCong_vaChanDoiKhoKhacKhiChuaLoi() {
        KenhBanHang lazada = KenhBanHang.builder().id(9).maKenh("LAZADA").tenKenh("Lazada").build();
        com.dev.backend.entities.BienTheSanPham bt = com.dev.backend.entities.BienTheSanPham.builder().id(101).maSku("SKU-101").build();
        com.dev.backend.entities.ChiTietDonBanHang ct = com.dev.backend.entities.ChiTietDonBanHang.builder()
                .id(1).bienTheSanPham(bt).soLuongDat(java.math.BigDecimal.valueOf(2)).build();

        DonBanHang donLazada = DonBanHang.builder()
                .id(130)
                .soDonHang("LZD-130")
                .maDonHangKenh("LZD130")
                .kenhBanHang(lazada)
                .loaiChungTu("don_ban_hang")
                .trangThai(0)
                .khoXuat(kho1)
                .build();
        when(donBanHangRepository.findById(130)).thenReturn(Optional.of(donLazada));
        when(chiTietDonBanHangRepository.findByDonBanHangId(130)).thenReturn(List.of(ct));
        when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(List.of(101)))
                .thenReturn(List.<Object[]>of(new Object[]{101, 1, java.math.BigDecimal.valueOf(5)}));
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> inv.getArgument(0));

        // Gửi sang kho khác khi chưa rơi vào luồng lỗi bị chặn 400
        CommonException doiKhoEx = assertThrows(CommonException.class, () -> service.sendToWarehouse(130, 2, false));
        assertEquals(HttpStatus.BAD_REQUEST, doiKhoEx.getHttpStatus());

        // Gửi đúng kho hiện tại (và đủ tồn) thành công luôn, không cần thuCongKhiLoi và không có cảnh báo
        String canhBaoDuTon = service.sendToWarehouse(130, 1, false);
        assertNull(canhBaoDuTon);
        assertEquals(1, donLazada.getTrangThai());
        assertEquals(kho1, donLazada.getKhoXuat());
    }

    @Test
    void donBaSan_thieuTonVanGuiKhoHienTaiVaTraCanhBao_thieuKhoHoacNgungBaoLoiThuCong() {
        KenhBanHang tiktok = KenhBanHang.builder().id(10).maKenh("TIKTOK").tenKenh("TikTok Shop").build();
        com.dev.backend.entities.BienTheSanPham bt = com.dev.backend.entities.BienTheSanPham.builder().id(102).maSku("SKU-102").build();
        com.dev.backend.entities.ChiTietDonBanHang ct = com.dev.backend.entities.ChiTietDonBanHang.builder()
                .id(2).bienTheSanPham(bt).soLuongDat(java.math.BigDecimal.valueOf(10)).build();

        DonBanHang donThieuTon = DonBanHang.builder()
                .id(131)
                .soDonHang("TTS-131")
                .maDonHangKenh("TTS131")
                .kenhBanHang(tiktok)
                .loaiChungTu("don_ban_hang")
                .trangThai(0)
                .khoXuat(kho1)
                .build();
        when(donBanHangRepository.findById(131)).thenReturn(Optional.of(donThieuTon));
        when(chiTietDonBanHangRepository.findByDonBanHangId(131)).thenReturn(List.of(ct));
        when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(List.of(102)))
                .thenReturn(List.<Object[]>of(new Object[]{102, 1, java.math.BigDecimal.valueOf(3)}));
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> inv.getArgument(0));

        // Thiếu tồn tại kho hiện tại: vẫn gửi đơn sang kho1 (trangThai = 1) và trả thông báo cảnh báo chuyển kho nội bộ
        String canhBaoThieuTon = service.sendToWarehouse(131, 1, false);
        assertNotNull(canhBaoThieuTon);
        assertTrue(canhBaoThieuTon.contains("Đã gửi đơn sang Kho Hà Nội, nhưng kho đang thiếu hàng cho 1 sản phẩm."));
        assertEquals(1, donThieuTon.getTrangThai());
        assertEquals(kho1, donThieuTon.getKhoXuat());
        verify(donBanHangRepository).save(donThieuTon);

        // Đơn 3 sàn thiếu khoXuat hoàn toàn vẫn báo DON_SAN_CAN_CHON_KHO_THU_CONG để mở popup chọn kho thủ công
        KenhBanHang shopee = KenhBanHang.builder().id(11).maKenh("SHOPEE").tenKenh("Shopee").build();
        DonBanHang donThieuKho = DonBanHang.builder()
                .id(132)
                .soDonHang("SHP-132")
                .maDonHangKenh("SHP132")
                .kenhBanHang(shopee)
                .loaiChungTu("don_ban_hang")
                .trangThai(0)
                .khoXuat(null)
                .build();
        when(donBanHangRepository.findById(132)).thenReturn(Optional.of(donThieuKho));

        var exThieuKho = assertThrows(
                com.dev.backend.exception.customize.LoiCoMaException.class,
                () -> service.sendToWarehouse(132, null, false)
        );
        assertEquals(HttpStatus.CONFLICT, exThieuKho.getStatus());
        assertEquals(com.dev.backend.exception.customize.MaLoi.DON_SAN_CAN_CHON_KHO_THU_CONG, exThieuKho.getMa());

        // Đơn 3 sàn có khoXuat đang ngừng hoạt động cũng báo DON_SAN_CAN_CHON_KHO_THU_CONG
        Kho khoNgung = Kho.builder().id(9).maKho("KHO-OFF").tenKho("Kho Ngừng").trangThai(0).build();
        DonBanHang donKhoNgung = DonBanHang.builder()
                .id(133)
                .soDonHang("LZD-133")
                .maDonHangKenh("LZD133")
                .kenhBanHang(KenhBanHang.builder().id(12).maKenh("LAZADA").tenKenh("Lazada").build())
                .loaiChungTu("don_ban_hang")
                .trangThai(0)
                .khoXuat(khoNgung)
                .build();
        when(donBanHangRepository.findById(133)).thenReturn(Optional.of(donKhoNgung));
        var exKhoNgung = assertThrows(
                com.dev.backend.exception.customize.LoiCoMaException.class,
                () -> service.sendToWarehouse(133, 9, false)
        );
        assertEquals(HttpStatus.CONFLICT, exKhoNgung.getStatus());
        assertEquals(com.dev.backend.exception.customize.MaLoi.DON_SAN_CAN_CHON_KHO_THU_CONG, exKhoNgung.getMa());

        // Fallback chọn kho thủ công (kho2) cho phép gửi qua thành công khi thuCongKhiLoi = true
        when(khoRepository.findById(2)).thenReturn(Optional.of(kho2));
        String canhBaoThuCong = service.sendToWarehouse(132, 2, true);
        assertNull(canhBaoThuCong);
        assertEquals(1, donThieuKho.getTrangThai());
        assertEquals(kho2, donThieuKho.getKhoXuat());
    }

    @Test
    void donBaSan_thieuNhieuDong_demDuMoiBienTheThieuVaCongDongTrung() {
        KenhBanHang lazada = KenhBanHang.builder().id(12).maKenh("LAZADA").tenKenh("Lazada").build();
        com.dev.backend.entities.BienTheSanPham bt102 = com.dev.backend.entities.BienTheSanPham.builder().id(102).maSku("SKU-102").build();
        com.dev.backend.entities.BienTheSanPham bt103 = com.dev.backend.entities.BienTheSanPham.builder().id(103).maSku("SKU-103").build();
        com.dev.backend.entities.BienTheSanPham bt104 = com.dev.backend.entities.BienTheSanPham.builder().id(104).maSku("SKU-104").build();
        // bt102 nằm ở hai dòng (2 + 3 = 5) mà kho chỉ còn 4: thiếu dù từng dòng riêng lẻ đều đủ
        List<com.dev.backend.entities.ChiTietDonBanHang> chiTiet = List.of(
                com.dev.backend.entities.ChiTietDonBanHang.builder().id(11).bienTheSanPham(bt102).soLuongDat(java.math.BigDecimal.valueOf(2)).build(),
                com.dev.backend.entities.ChiTietDonBanHang.builder().id(12).bienTheSanPham(bt103).soLuongDat(java.math.BigDecimal.ONE).build(),
                com.dev.backend.entities.ChiTietDonBanHang.builder().id(13).bienTheSanPham(bt102).soLuongDat(java.math.BigDecimal.valueOf(3)).build(),
                com.dev.backend.entities.ChiTietDonBanHang.builder().id(14).bienTheSanPham(bt104).soLuongDat(java.math.BigDecimal.valueOf(2)).build());
        DonBanHang don = DonBanHang.builder()
                .id(140)
                .soDonHang("LZD-140")
                .maDonHangKenh("LZD140")
                .kenhBanHang(lazada)
                .loaiChungTu("don_ban_hang")
                .trangThai(0)
                .khoXuat(kho1)
                .build();
        when(donBanHangRepository.findById(140)).thenReturn(Optional.of(don));
        when(chiTietDonBanHangRepository.findByDonBanHangId(140)).thenReturn(chiTiet);
        when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(List.of(102, 103, 104)))
                .thenReturn(List.<Object[]>of(
                        new Object[]{102, 1, java.math.BigDecimal.valueOf(4)},
                        new Object[]{103, 1, java.math.BigDecimal.valueOf(5)}));
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> inv.getArgument(0));

        String canhBao = service.sendToWarehouse(140, 1, false);

        assertEquals("Đã gửi đơn sang Kho Hà Nội, nhưng kho đang thiếu hàng cho 2 sản phẩm. Lập phiếu chuyển kho về kho này để nhặt được đơn.", canhBao);
        assertEquals(1, don.getTrangThai());
    }

    @Test
    void donShopeeVaTikTok_guiThangKhoDaMap_thieuTonVanGuiVaKhoNgungBaoLoiThuCong() {
        var bt = com.dev.backend.entities.BienTheSanPham.builder().id(205).maSku("SKU-3SAN-205").build();
        when(khoRepository.findById(2)).thenReturn(Optional.of(kho2));
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> inv.getArgument(0));

        for (String maKenh : List.of("SHOPEE_OFFICIAL", "TIKTOK")) {
            KenhBanHang kenh = KenhBanHang.builder().id(50).maKenh(maKenh).tenKenh(maKenh).build();
            int baseId = maKenh.hashCode() & 0x7FFF;

            // 1. Đủ tồn tại kho đã map (kho2): gửi thẳng thành công, không cảnh báo; đổi kho khác chưa lỗi bị chặn 400
            var ctDu = com.dev.backend.entities.ChiTietDonBanHang.builder()
                    .id(1).bienTheSanPham(bt).soLuongDat(BigDecimal.valueOf(2)).build();
            DonBanHang donDu = DonBanHang.builder()
                    .id(baseId).soDonHang("ORD-" + maKenh + "-1").maDonHangKenh("K-" + maKenh + "-1")
                    .kenhBanHang(kenh).loaiChungTu("don_ban_hang").trangThai(0).khoXuat(kho2).build();
            when(donBanHangRepository.findById(baseId)).thenReturn(Optional.of(donDu));
            when(chiTietDonBanHangRepository.findByDonBanHangId(baseId)).thenReturn(List.of(ctDu));
            when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(List.of(205)))
                    .thenReturn(List.<Object[]>of(new Object[]{205, 2, BigDecimal.valueOf(8)}));

            CommonException exDoiKho = assertThrows(CommonException.class, () -> service.sendToWarehouse(baseId, 1, false));
            assertEquals(HttpStatus.BAD_REQUEST, exDoiKho.getHttpStatus());
            assertNull(service.sendToWarehouse(baseId, 2, false));
            assertEquals(ITrangThaiDonBanHang.CHO_NHAT_HANG, donDu.getTrangThai());
            assertEquals(kho2, donDu.getKhoXuat());

            // 2. Thiếu tồn tại kho2: vẫn gửi thẳng sang kho2 và trả chuỗi cảnh báo thiếu hàng tại Kho Hồ Chí Minh
            DonBanHang donThieu = DonBanHang.builder()
                    .id(baseId + 1).soDonHang("ORD-" + maKenh + "-2").maDonHangKenh("K-" + maKenh + "-2")
                    .kenhBanHang(kenh).loaiChungTu("don_ban_hang").trangThai(0).khoXuat(kho2).build();
            when(donBanHangRepository.findById(baseId + 1)).thenReturn(Optional.of(donThieu));
            when(chiTietDonBanHangRepository.findByDonBanHangId(baseId + 1)).thenReturn(List.of(ctDu));
            when(tonKhoTheoLoRepository.sumKhaDungLoTheoKhoBan(List.of(205)))
                    .thenReturn(List.<Object[]>of(new Object[]{205, 2, BigDecimal.ONE}));

            String warn = service.sendToWarehouse(baseId + 1, 2, false);
            assertNotNull(warn);
            assertTrue(warn.contains("Kho Hồ Chí Minh"));
            assertEquals(ITrangThaiDonBanHang.CHO_NHAT_HANG, donThieu.getTrangThai());
            assertEquals(kho2, donThieu.getKhoXuat());

            // 3. Thiếu khoXuat (null): trả 409 DON_SAN_CAN_CHON_KHO_THU_CONG, mở fallback thuCongKhiLoi = true gửi thành công
            DonBanHang donNullKho = DonBanHang.builder()
                    .id(baseId + 2).soDonHang("ORD-" + maKenh + "-3").maDonHangKenh("K-" + maKenh + "-3")
                    .kenhBanHang(kenh).loaiChungTu("don_ban_hang").trangThai(0).khoXuat(null).build();
            when(donBanHangRepository.findById(baseId + 2)).thenReturn(Optional.of(donNullKho));

            var exMissing = assertThrows(com.dev.backend.exception.customize.LoiCoMaException.class,
                    () -> service.sendToWarehouse(baseId + 2, null, false));
            assertEquals(HttpStatus.CONFLICT, exMissing.getStatus());
            assertEquals(com.dev.backend.exception.customize.MaLoi.DON_SAN_CAN_CHON_KHO_THU_CONG, exMissing.getMa());

            assertNull(service.sendToWarehouse(baseId + 2, 2, true));
            assertEquals(ITrangThaiDonBanHang.CHO_NHAT_HANG, donNullKho.getTrangThai());
            assertEquals(kho2, donNullKho.getKhoXuat());
        }
    }
}
