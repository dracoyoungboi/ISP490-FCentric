package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.dto.response.customize.KhachHangDetailDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapperImpl;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhachHangRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Ngừng / cho phép hoạt động khách hàng từ trang chi tiết (PUT /khach-hang/{id} chỉ gửi trangThai)
 * và lịch sử mua hàng không lẫn báo giá.
 */
@ExtendWith(MockitoExtension.class)
class KhachHangServiceTrangThaiTest {

    @Mock private KhachHangRepository repository;
    @Mock private EntityManager entityManager;
    @Mock private DonBanHangRepository donBanHangRepository;

    private KhachHangService service;
    private KhachHang khach;

    @BeforeEach
    void setUp() {
        service = new KhachHangService(repository, new KhachHangMapperImpl(), entityManager, donBanHangRepository);
        khach = KhachHang.builder()
                .id(16).maKhachHang("KH016").tenKhachHang("Công ty TNHH Thời trang Minh Khôi")
                .soDienThoai("0912345678").email("muahang@minhkhoi.example.vn")
                .loaiKhachHang("doanh_nghiep").trangThai(1)
                .build();
    }

    @Test
    void ngungHoatDong_chiGuiTrangThai_giuNguyenCacTruongKhac() {
        when(repository.findById(16)).thenReturn(Optional.of(khach));
        when(repository.save(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        var dto = service.update(16, KhachHangUpdating.builder().trangThai(0).build());

        assertEquals(0, dto.getTrangThai());
        assertEquals("Công ty TNHH Thời trang Minh Khôi", dto.getTenKhachHang());
        assertEquals("0912345678", dto.getSoDienThoai());
        assertEquals("muahang@minhkhoi.example.vn", dto.getEmail());
        assertEquals("doanh_nghiep", dto.getLoaiKhachHang());
    }

    @Test
    void choPhepHoatDongLai() {
        khach.setTrangThai(0);
        when(repository.findById(16)).thenReturn(Optional.of(khach));
        when(repository.save(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        var dto = service.update(16, KhachHangUpdating.builder().trangThai(1).build());

        assertEquals(1, dto.getTrangThai());
    }

    @Test
    void trangThaiNgoai01_baoLoi_khongLuu() {
        when(repository.findById(16)).thenReturn(Optional.of(khach));

        CommonException ex = assertThrows(CommonException.class,
                () -> service.update(16, KhachHangUpdating.builder().trangThai(2).build()));

        assertEquals("Trạng thái khách hàng không hợp lệ", ex.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void lichSuMuaHang_boBaoGia_donKhongKenhLaBanThuong() {
        when(repository.findById(16)).thenReturn(Optional.of(khach));
        DonBanHang donShopify = DonBanHang.builder().id(1).soDonHang("SHP-1012").loaiChungTu("don_ban_hang")
                .ngayDatHang(Instant.parse("2026-10-14T13:31:00Z")).tongCong(new BigDecimal("2350000"))
                .kenhBanHang(KenhBanHang.builder().id(3).maKenh("SHOPIFY").tenKenh("Shopify").build())
                .build();
        DonBanHang baoGia = DonBanHang.builder().id(2).soDonHang("BG202610151").loaiChungTu("bao_gia")
                .ngayDatHang(Instant.parse("2026-10-15T02:00:00Z")).tongCong(new BigDecimal("32500000")).build();
        DonBanHang donThuong = DonBanHang.builder().id(3).soDonHang("SO202610121").loaiChungTu("don_ban_hang")
                .ngayDatHang(Instant.parse("2026-10-12T02:02:00Z")).tongCong(new BigDecimal("24750000")).build();
        when(donBanHangRepository.findByKhachHangIdOrderByNgayDatHangDesc(16))
                .thenReturn(List.of(baoGia, donShopify, donThuong));

        KhachHangDetailDto detail = service.getKhachHangDetail(16);

        assertEquals(2, detail.getTongSoDonHang());
        assertEquals(List.of("SHP-1012", "SO202610121"),
                detail.getLichSuMuaHang().stream().map(h -> h.getMaDonHang()).toList());
        assertEquals("SHOPIFY", detail.getLichSuMuaHang().get(0).getKenh());
        assertNull(detail.getLichSuMuaHang().get(1).getKenh(), "đơn không gắn kênh không được ghi là POS");
    }
}
