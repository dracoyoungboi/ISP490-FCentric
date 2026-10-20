package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.inbound.KhuVucKhoRequest;
import com.dev.backend.dto.request.inbound.ViTriKhoRequest;
import com.dev.backend.dto.response.inbound.KhuVucKhoDto;
import com.dev.backend.dto.response.inbound.ViTriKhoDto;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.KhuVucKho;
import com.dev.backend.entities.ViTriKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ViTriKhoServiceTest {

    @Mock
    private KhoRepository khoRepository;
    @Mock
    private KhuVucKhoRepository khuVucKhoRepository;
    @Mock
    private ViTriKhoRepository viTriKhoRepository;
    @Mock
    private TonKhoViTriRepository tonKhoViTriRepository;
    @Mock
    private MatBangKhoRepository matBangKhoRepository;
    @Mock
    private ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    @Mock
    private ObjectMapper objectMapper;

    private ViTriKhoServiceImpl service;

    private Kho kho;
    private KhuVucKho khuVuc;
    private ViTriKho viTri;

    @BeforeEach
    void setUp() {
        service = new ViTriKhoServiceImpl(
                khoRepository,
                khuVucKhoRepository,
                viTriKhoRepository,
                tonKhoViTriRepository,
                matBangKhoRepository,
                chiTietPhieuNhapKhoRepository,
                objectMapper
        );

        kho = Kho.builder().id(1).maKho("KHO_TONG").tenKho("Kho Tổng").build();
        khuVuc = KhuVucKho.builder().id(10).kho(kho).maKhuVuc("A").tenKhuVuc("Khu A").loaiKhu("LUU_KHO").build();
        viTri = ViTriKho.builder().id(100).khuVucKho(khuVuc).maViTri("A-01-01").dayKe("A").hangKe("01").tangKe("01").sucChuaToiDa(100).trangThai("HOAT_DONG").build();
    }

    @Test
    @DisplayName("Lấy danh sách khu vực kho thành công")
    void testLayDanhSachKhuVuc_ThanhCong() {
        when(khuVucKhoRepository.findByKho_IdOrderByMaKhuVucAsc(1)).thenReturn(List.of(khuVuc));
        when(viTriKhoRepository.countByKhuVucKho_Id(10)).thenReturn(5L);

        List<KhuVucKhoDto> list = service.dsKhuVuc(1);
        assertEquals(1, list.size());
        assertEquals("A", list.get(0).getMaKhuVuc());
        assertEquals(5, list.get(0).getSoViTri());
    }

    @Test
    @DisplayName("Tạo khu vực kho thành công")
    void testTaoKhuVuc_ThanhCong() {
        when(khoRepository.findById(1)).thenReturn(Optional.of(kho));
        when(khuVucKhoRepository.existsByKho_IdAndMaKhuVuc(1, "A")).thenReturn(false);
        when(khuVucKhoRepository.save(any(KhuVucKho.class))).thenAnswer(inv -> {
            KhuVucKho kv = inv.getArgument(0);
            kv.setId(11);
            return kv;
        });

        KhuVucKhoRequest req = KhuVucKhoRequest.builder()
                .maKhuVuc("A")
                .tenKhuVuc("Khu Lưu Kho A")
                .loaiKhu("LUU_KHO")
                .build();

        KhuVucKhoDto result = service.taoKhuVuc(1, req);
        assertNotNull(result);
        assertEquals("A", result.getMaKhuVuc());
    }

    @Test
    @DisplayName("Tạo khu vực kho báo lỗi trùng mã khu vực")
    void testTaoKhuVuc_TrungMa_BaoLoi() {
        when(khoRepository.findById(1)).thenReturn(Optional.of(kho));
        when(khuVucKhoRepository.existsByKho_IdAndMaKhuVuc(1, "A")).thenReturn(true);

        KhuVucKhoRequest req = KhuVucKhoRequest.builder().maKhuVuc("A").tenKhuVuc("Khu A").build();

        CommonException ex = assertThrows(CommonException.class, () -> service.taoKhuVuc(1, req));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
    }

    @Test
    @DisplayName("Sinh vị trí kệ hàng loạt thành công")
    void testSinhViTriHangLoat_ThanhCong() {
        when(khuVucKhoRepository.findById(10)).thenReturn(Optional.of(khuVuc));
        when(viTriKhoRepository.existsByKho_IdAndMaViTri(eq(1), anyString())).thenReturn(false);
        when(viTriKhoRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        ViTriKhoRequest req = ViTriKhoRequest.builder()
                .khuVucId(10)
                .day("A")
                .hangTu(1)
                .hangDen(2)
                .tangTu(1)
                .tangDen(2)
                .sucChua(100)
                .build();

        List<ViTriKhoDto> created = service.taoViTri(1, req);
        assertEquals(4, created.size()); // 2 hàng x 2 tầng = 4 vị trí
    }

    @Test
    @DisplayName("Tạo vị trí kệ cùng mã ở 2 kho khác nhau thành công")
    void testTaoViTri_CungMaKhacKho_ThanhCong() {
        Kho kho22 = Kho.builder().id(22).maKho("KHO_TONG").tenKho("Kho Tổng").build();
        KhuVucKho khuVuc22 = KhuVucKho.builder().id(220).kho(kho22).maKhuVuc("KHU-A").build();

        when(khuVucKhoRepository.findById(220)).thenReturn(Optional.of(khuVuc22));
        when(viTriKhoRepository.existsByKho_IdAndMaViTri(22, "A-01-01")).thenReturn(false);
        when(viTriKhoRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        ViTriKhoRequest req = ViTriKhoRequest.builder()
                .khuVucId(220)
                .maViTri("A-01-01")
                .day("A")
                .hang("01")
                .tang("01")
                .sucChua(100)
                .build();

        List<ViTriKhoDto> result = service.taoViTri(22, req);
        assertEquals(1, result.size());
        assertEquals("A-01-01", result.get(0).getMaViTri());
    }

    @Test
    @DisplayName("Tạo vị trí kệ trùng mã trong cùng một kho báo lỗi CONFLICT 409")
    void testTaoViTri_TrungMaCungKho_BaoLoiConflict() {
        when(khuVucKhoRepository.findById(10)).thenReturn(Optional.of(khuVuc));
        when(viTriKhoRepository.existsByKho_IdAndMaViTri(1, "A-01-01")).thenReturn(true);

        ViTriKhoRequest req = ViTriKhoRequest.builder()
                .khuVucId(10)
                .maViTri("A-01-01")
                .build();

        CommonException ex = assertThrows(CommonException.class, () -> service.taoViTri(1, req));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("đã tồn tại trong kho này"));
    }

    @Test
    @DisplayName("Xóa vị trí kệ bị chặn nếu kệ còn tồn hàng")
    void testXoaViTri_ConHang_ChanConflict() {
        when(viTriKhoRepository.findById(100)).thenReturn(Optional.of(viTri));
        when(tonKhoViTriRepository.sumDangChuaByViTriId(100)).thenReturn(25);

        CommonException ex = assertThrows(CommonException.class, () -> service.xoaViTri(1, 100));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("không thể xóa"));
    }

    @Test
    @DisplayName("Danh sách kệ: choNhap = hàng đạt của lô đã khóa chưa nhập kho, tách riêng với dangChua")
    void testDsViTri_CoChoNhap() {
        Kho kho = Kho.builder().id(1).build();
        KhuVucKho khu = KhuVucKho.builder().id(5).kho(kho).tenKhuVuc("Khu A").build();
        ViTriKho ke = ViTriKho.builder().id(20).kho(kho).khuVucKho(khu).maViTri("A-01-02").sucChuaToiDa(60).trangThai("HOAT_DONG").build();
        ViTriKho keTrong = ViTriKho.builder().id(21).kho(kho).khuVucKho(khu).maViTri("A-01-03").sucChuaToiDa(40).trangThai("HOAT_DONG").build();
        when(viTriKhoRepository.findByKho_IdOrderByMaViTriAsc(1)).thenReturn(List.of(ke, keTrong));
        when(tonKhoViTriRepository.sumDangChuaByKhoIdGroupByViTriId(1)).thenReturn(List.<Object[]>of(new Object[]{20, 32L}));
        when(chiTietPhieuNhapKhoRepository.sumChoNhapTheoKho(1)).thenReturn(List.<Object[]>of(new Object[]{20, 12L}));

        List<ViTriKhoDto> ds = service.dsViTri(1);

        assertEquals(32, ds.get(0).getDangChua());
        assertEquals(12, ds.get(0).getChoNhap());
        assertEquals(0, ds.get(1).getDangChua());
        assertEquals(0, ds.get(1).getChoNhap());
    }
}
