package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhoUpdating;
import com.dev.backend.dto.response.KhoTomTatResponse;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhoMapper;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.KhoTomTatRepository;
import com.dev.backend.services.impl.multitable.TongQuanAdminServiceImpl;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Popup Chi tiết kho: đổi trạng thái (thay cho "Xóa kho" – vốn chỉ đặt trạng thái 0) và số liệu tóm tắt.
 */
class KhoServiceTrangThaiTest {

    private KhoRepository khoRepository;
    private KhoTomTatRepository khoTomTatRepository;
    private EntityManager entityManager;
    private TypedQuery<Kho> khoTongKhac;
    private NguoiDungService nguoiDungService;
    private KhoService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        khoRepository = mock(KhoRepository.class);
        khoTomTatRepository = mock(KhoTomTatRepository.class);
        entityManager = mock(EntityManager.class);
        nguoiDungService = mock(NguoiDungService.class);
        khoTongKhac = mock(TypedQuery.class, RETURNS_SELF);
        when(khoTongKhac.getResultList()).thenReturn(List.of());
        when(entityManager.createQuery(anyString(), eq(Kho.class))).thenReturn(khoTongKhac);
        when(khoRepository.save(any(Kho.class))).thenAnswer(i -> i.getArgument(0));

        service = new KhoService(khoRepository);
        ReflectionTestUtils.setField(service, "khoRepository", khoRepository);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "khoTomTatRepository", khoTomTatRepository);
        ReflectionTestUtils.setField(service, "nguoiDungService", nguoiDungService);
        ReflectionTestUtils.setField(service, "khoMapper", mock(KhoMapper.class));
    }

    private Kho kho(int id, String ma, String loai, int trangThai) {
        Kho k = Kho.builder().id(id).maKho(ma).tenKho("Kho " + ma).loaiKho(loai).trangThai(trangThai).build();
        when(khoRepository.findById(id)).thenReturn(Optional.of(k));
        return k;
    }

    @Test
    void ngungKhoBanHang_datTrangThai0_vaLuu() {
        kho(3, "KHO01", KhoService.KHO_BAN_HANG, 1);

        Kho ketQua = service.doiTrangThai(3, 0);

        assertEquals(0, ketQua.getTrangThai());
        verify(khoRepository).save(argThat(k -> k.getId() == 3 && k.getTrangThai() == 0));
    }

    @Test
    void khoAo_khongNgungDuoc_caQuaDoiTrangThaiLanCapNhat() {
        Kho ao = kho(2, "KHO_TRANSIT", KhoService.KHO_BAN_HANG, 1);
        CommonException loi = assertThrows(CommonException.class, () -> service.doiTrangThai(2, 0));
        assertTrue(loi.getMessage().contains("kho ảo"));

        when(nguoiDungService.getOne(7)).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        when(khoRepository.findByMaKho("KHO_TRANSIT")).thenReturn(Optional.of(ao));
        KhoUpdating sua = KhoUpdating.builder().id(2).maKho("KHO_TRANSIT").tenKho("Kho Trung Chuyển")
                .diaChi("—").quanLyId(7).trangThai(0).loaiKho(KhoService.KHO_BAN_HANG).build();
        assertThrows(CommonException.class, () -> service.update(sua));

        verify(khoRepository, never()).save(any());
    }

    @Test
    void khoAo_khongDoiDuocMaHayLoai_deLachQuyTacLuonHoatDong() {
        kho(2, "KHO_TRANSIT", KhoService.KHO_BAN_HANG, 1);
        when(nguoiDungService.getOne(7)).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        when(khoRepository.findByMaKho(anyString())).thenReturn(Optional.empty());

        KhoUpdating doiMa = KhoUpdating.builder().id(2).maKho("KHO_X").tenKho("Kho Trung Chuyển")
                .diaChi("—").quanLyId(7).trangThai(1).loaiKho(KhoService.KHO_BAN_HANG).build();
        assertThrows(CommonException.class, () -> service.update(doiMa));

        KhoUpdating doiLoai = KhoUpdating.builder().id(2).maKho("KHO_TRANSIT").tenKho("Kho Trung Chuyển")
                .diaChi("—").quanLyId(7).trangThai(1).loaiKho(KhoService.KHO_TONG).build();
        assertThrows(CommonException.class, () -> service.update(doiLoai));

        KhoUpdating doiTen = KhoUpdating.builder().id(2).maKho("KHO_TRANSIT").tenKho("Kho đang chuyển")
                .diaChi("Kho ảo").quanLyId(7).trangThai(1).loaiKho(KhoService.KHO_BAN_HANG).build();
        when(khoRepository.findByMaKho("KHO_TRANSIT")).thenReturn(Optional.empty());
        assertDoesNotThrow(() -> service.update(doiTen));
        verify(khoRepository, times(1)).save(any());
    }

    @Test
    void choPhepLaiKhoTong_khiDaCoKhoTongKhacDangHoatDong_thiBaoLoi() {
        kho(1, "KHO_TONG", KhoService.KHO_TONG, 0);
        when(khoTongKhac.getResultList()).thenReturn(List.of(Kho.builder().id(9).tenKho("Kho tổng mới").build()));

        CommonException loi = assertThrows(CommonException.class, () -> service.doiTrangThai(1, 1));

        assertTrue(loi.getMessage().contains("Kho tổng mới"));
        verify(khoRepository, never()).save(any());
    }

    @Test
    void choPhepLaiKhoTong_khiChuaCoKhoTongNaoKhac_thiDuoc() {
        kho(1, "KHO_TONG", KhoService.KHO_TONG, 0);

        assertEquals(1, service.doiTrangThai(1, 1).getTrangThai());
    }

    @Test
    void trangThaiKhongDoi_khongGhiLai_trangThaiLa_thiBaoLoi() {
        kho(4, "KHO02", KhoService.KHO_BAN_HANG, 0);

        assertEquals(0, service.doiTrangThai(4, 0).getTrangThai());
        verify(khoRepository, never()).save(any());

        assertThrows(CommonException.class, () -> service.doiTrangThai(4, 2));
        assertThrows(CommonException.class, () -> service.doiTrangThai(4, null));
    }

    @Test
    void khongTimThayKho_bao404() {
        when(khoRepository.findById(99)).thenReturn(Optional.empty());

        CommonException doi = assertThrows(CommonException.class, () -> service.doiTrangThai(99, 0));
        CommonException tomTat = assertThrows(CommonException.class, () -> service.tomTat(99));

        assertEquals(HttpStatus.NOT_FOUND, doi.getHttpStatus());
        assertEquals(HttpStatus.NOT_FOUND, tomTat.getHttpStatus());
    }

    @Test
    void tomTat_lamTronSo_vaDungNguongCauHinh() {
        kho(1, "KHO_TONG", KhoService.KHO_TONG, 1);
        when(khoTomTatRepository.cauHinhSoDuong("DEFAULT_MIN_STOCK_ALERT")).thenReturn(5);
        when(khoTomTatRepository.tonKho(1, 5)).thenReturn(new KhoTomTatRepository.TonKhoDong(
                new BigDecimal("1396.000"), new BigDecimal("44.000"), new BigDecimal("1352.000"),
                new BigDecimal("139600000.50"), 39, 3, 5));
        when(khoTomTatRepository.soNguoiPhanQuyen(1)).thenReturn(4L);

        KhoTomTatResponse r = service.tomTat(1);

        assertEquals(new KhoTomTatResponse(1, 1396, 1352, 44, 139_600_001, 39, 3, 5, 5, 4), r);
    }

    @Test
    void tomTat_chuaCauHinhNguong_thiDungMacDinhTongQuan() {
        kho(1, "KHO_TONG", KhoService.KHO_TONG, 1);
        when(khoTomTatRepository.cauHinhSoDuong(anyString())).thenReturn(null);
        when(khoTomTatRepository.tonKho(eq(1), anyInt())).thenReturn(new KhoTomTatRepository.TonKhoDong(
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, 0));

        KhoTomTatResponse r = service.tomTat(1);

        assertEquals(TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH, r.nguongSapHet());
        verify(khoTomTatRepository).tonKho(1, TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH);
    }
}
