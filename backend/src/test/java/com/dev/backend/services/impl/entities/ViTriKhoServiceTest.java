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
    private LoHangRepository loHangRepository;
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
                loHangRepository,
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
        when(viTriKhoRepository.khoaTheoId(100)).thenReturn(Optional.of(viTri));
        when(tonKhoViTriRepository.sumDangChuaByViTriId(100)).thenReturn(25);

        CommonException ex = assertThrows(CommonException.class, () -> service.xoaViTri(1, 100));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("không thể xóa"));
        verify(viTriKhoRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Xóa vị trí kệ bị chặn khi kệ còn lô đã khóa của phiếu nhập Nháp chờ lên kệ, câu báo nêu số phiếu")
    void testXoaViTri_ConLoChoNhap_ChanConflict() {
        when(viTriKhoRepository.khoaTheoId(100)).thenReturn(Optional.of(viTri));
        when(tonKhoViTriRepository.sumDangChuaByViTriId(100)).thenReturn(0);
        when(chiTietPhieuNhapKhoRepository.loChoNhapTheoViTri(100)).thenReturn(List.<Object[]>of(
                new Object[]{"PN202610171", 1L, 1L},
                new Object[]{"PN202610172", 2L, 2L}));

        CommonException ex = assertThrows(CommonException.class, () -> service.xoaViTri(1, 100));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("Kệ A-01-01 đang chờ nhập 3 sản phẩm của phiếu PN202610171, PN202610172. "
                + "Sửa kệ của các lô đó ở màn kiểm đếm hoặc hủy phiếu trước khi xóa kệ.", ex.getMessage());
        verify(loHangRepository, never()).goViTriKho(any());
        verify(tonKhoViTriRepository, never()).xoaDongSoKhongTheoViTri(any());
        verify(viTriKhoRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Lô chỉ có hàng không đạt vẫn trỏ tới kệ: chặn xóa, câu báo đếm số lô")
    void testXoaViTri_LoChiHangKhongDat_ChanConflict() {
        when(viTriKhoRepository.khoaTheoId(100)).thenReturn(Optional.of(viTri));
        when(tonKhoViTriRepository.sumDangChuaByViTriId(100)).thenReturn(0);
        when(chiTietPhieuNhapKhoRepository.loChoNhapTheoViTri(100)).thenReturn(List.<Object[]>of(
                new Object[]{"PN202610172", 1L, 0L}));

        CommonException ex = assertThrows(CommonException.class, () -> service.xoaViTri(1, 100));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().startsWith("Kệ A-01-01 đang gắn 1 lô đã khóa của phiếu PN202610172."), ex.getMessage());
        verify(viTriKhoRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Xóa kệ trống: khóa kệ trước mọi lệnh đọc, gỡ kệ khỏi lô đã nhập theo id, bỏ dòng tồn số 0 rồi mới xóa kệ")
    void testXoaViTri_KeTrong_GoLienKetRoiXoa() {
        when(viTriKhoRepository.khoaTheoId(100)).thenReturn(Optional.of(viTri));
        when(tonKhoViTriRepository.sumDangChuaByViTriId(100)).thenReturn(0);
        when(chiTietPhieuNhapKhoRepository.loChoNhapTheoViTri(100)).thenReturn(Collections.emptyList());
        when(loHangRepository.idLoTheoViTri(100)).thenReturn(List.of(5, 6));

        service.xoaViTri(1, 100);

        var thuTu = inOrder(viTriKhoRepository, khoRepository, tonKhoViTriRepository, chiTietPhieuNhapKhoRepository, loHangRepository);
        // Khóa kệ là lệnh đầu tiên: ở REPEATABLE READ lệnh đọc thường đầu tiên chốt ảnh dữ liệu của giao dịch
        thuTu.verify(viTriKhoRepository).khoaTheoId(100);
        thuTu.verify(khoRepository).findById(1);
        thuTu.verify(tonKhoViTriRepository).sumDangChuaByViTriId(100);
        thuTu.verify(chiTietPhieuNhapKhoRepository).loChoNhapTheoViTri(100);
        thuTu.verify(loHangRepository).goViTriKho(List.of(5, 6));
        thuTu.verify(tonKhoViTriRepository).xoaDongSoKhongTheoViTri(100);
        thuTu.verify(viTriKhoRepository).delete(viTri);
    }

    @Test
    @DisplayName("Tổng tồn kệ về 0 nhưng còn dòng tồn dương (có dòng âm bù): chặn xóa, không gỡ lô")
    void testXoaViTri_ConDongTonDuong_ChanConflict() {
        when(viTriKhoRepository.khoaTheoId(100)).thenReturn(Optional.of(viTri));
        when(tonKhoViTriRepository.sumDangChuaByViTriId(100)).thenReturn(0);
        when(tonKhoViTriRepository.existsByViTriKho_IdAndSoLuongGreaterThan(100, 0)).thenReturn(true);

        CommonException ex = assertThrows(CommonException.class, () -> service.xoaViTri(1, 100));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        verifyNoInteractions(loHangRepository);
        verify(viTriKhoRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Sửa kệ trả cả số chờ nhập và số lô chờ nhập (giao diện thay cả dòng kệ bằng kết quả này)")
    void testSuaViTri_TraChoNhap() {
        when(viTriKhoRepository.findById(100)).thenReturn(Optional.of(viTri));
        when(viTriKhoRepository.save(viTri)).thenReturn(viTri);
        when(tonKhoViTriRepository.sumDangChuaByViTriId(100)).thenReturn(0);
        when(chiTietPhieuNhapKhoRepository.loChoNhapTheoViTri(100)).thenReturn(List.<Object[]>of(
                new Object[]{"PN1", 1L, 3L}, new Object[]{"PN2", 2L, 0L}));

        ViTriKhoDto dto = service.suaViTri(1, 100, ViTriKhoRequest.builder().trangThai("BAO_TRI").build());

        assertEquals(3, dto.getChoNhap());
        assertEquals(3, dto.getSoLoChoNhap());
        assertEquals("BAO_TRI", dto.getTrangThai());
    }

    @Test
    @DisplayName("Xóa kệ chưa từng có lô: không chạy lệnh gỡ kệ khỏi lô")
    void testXoaViTri_KhongCoLo_KhongGoLienKet() {
        when(viTriKhoRepository.khoaTheoId(100)).thenReturn(Optional.of(viTri));
        when(tonKhoViTriRepository.sumDangChuaByViTriId(100)).thenReturn(0);
        when(chiTietPhieuNhapKhoRepository.loChoNhapTheoViTri(100)).thenReturn(Collections.emptyList());
        when(loHangRepository.idLoTheoViTri(100)).thenReturn(Collections.emptyList());

        service.xoaViTri(1, 100);

        verify(loHangRepository, never()).goViTriKho(any());
        verify(viTriKhoRepository).delete(viTri);
    }

    @Test
    @DisplayName("Xóa kệ của kho khác bị chặn trước khi đụng tới lô")
    void testXoaViTri_KhacKho_ChanTruocKhiGoLienKet() {
        when(viTriKhoRepository.khoaTheoId(100)).thenReturn(Optional.of(viTri));

        CommonException ex = assertThrows(CommonException.class, () -> service.xoaViTri(2, 100));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        verifyNoInteractions(loHangRepository);
        verify(viTriKhoRepository, never()).delete(any());
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
        when(chiTietPhieuNhapKhoRepository.sumChoNhapTheoKho(1)).thenReturn(List.<Object[]>of(new Object[]{20, 12L, 2L}));

        List<ViTriKhoDto> ds = service.dsViTri(1);

        assertEquals(32, ds.get(0).getDangChua());
        assertEquals(12, ds.get(0).getChoNhap());
        assertEquals(2, ds.get(0).getSoLoChoNhap());
        assertEquals(0, ds.get(1).getDangChua());
        assertEquals(0, ds.get(1).getChoNhap());
        assertEquals(0, ds.get(1).getSoLoChoNhap());
    }
}
