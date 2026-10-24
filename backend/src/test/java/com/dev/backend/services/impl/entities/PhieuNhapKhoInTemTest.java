package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.customize.PhieuNhapInTemDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * In tem theo phiếu nhập: chỉ phiếu đã hoàn tất (3); số tem = số lượng thực nhận của từng biến thể (cộng các lô — số đạt
 * kiểm đếm đã vào tồn); phiếu cũ không có lô thì lấy số đạt / số nhập của dòng dự kiến; danh sách phiếu theo kho xem được.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PhieuNhapKhoInTemTest {

    @Mock private PhieuNhapKhoRepository repository;
    @Mock private TemSanPhamService temSanPhamService;

    private PhieuNhapKhoService service;
    private final Kho khoTong = Kho.builder().id(22).tenKho("Kho tổng").build();

    @BeforeEach
    void setUp() {
        service = new PhieuNhapKhoService(repository);
        ReflectionTestUtils.setField(service, "temSanPhamService", temSanPhamService);
        when(temSanPhamService.dongTheoIds(anyList(), anyMap())).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private static BienTheSanPham bt(int id) {
        return BienTheSanPham.builder().id(id).maSku("SKU-" + id).build();
    }

    private ChiTietPhieuNhapKho dong(PhieuNhapKho phieu, int btId, String soLuong, boolean coLo, int datQc) {
        return ChiTietPhieuNhapKho.builder()
                .phieuNhapKho(phieu).bienTheSanPham(bt(btId))
                .loHang(coLo ? LoHang.builder().id(btId * 10).build() : null)
                .soLuongNhap(new BigDecimal(soLuong)).soLuongDatQc(datQc)
                .build();
    }

    private PhieuNhapKho phieu(int trangThai) {
        PhieuNhapKho p = PhieuNhapKho.builder().id(5).soPhieuNhap("PN202610241").kho(khoTong).trangThai(trangThai).build();
        when(repository.findById(5)).thenReturn(Optional.of(p));
        return p;
    }

    @SuppressWarnings("unchecked")
    private Map<Integer, Integer> soLuongDaGui(List<Integer> thuTuMongDoi) {
        ArgumentCaptor<List<Integer>> ids = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<Map<Integer, Integer>> soLuong = ArgumentCaptor.forClass(Map.class);
        verify(temSanPhamService).dongTheoIds(ids.capture(), soLuong.capture());
        assertEquals(thuTuMongDoi, ids.getValue());
        return soLuong.getValue();
    }

    @Test
    void phieuHoanTat_congSoThucNhanCacLo_khongCongDongDuKien() {
        PhieuNhapKho p = phieu(3);
        p.setChiTietPhieuNhapKhos(List.of(
                dong(p, 101, "12", false, 10),   // dòng dự kiến: cần nhập 12, đạt 10
                dong(p, 101, "6", true, 0),      // lô 1: đạt 6
                dong(p, 101, "4.000", true, 0),  // lô 2: đạt 4
                dong(p, 102, "5", false, 0),
                dong(p, 102, "5", true, 0)));

        service.soLuongInTem(5);

        Map<Integer, Integer> soLuong = soLuongDaGui(List.of(101, 102));
        assertEquals(10, soLuong.get(101));
        assertEquals(5, soLuong.get(102));
    }

    @Test
    void phieuCoLo_bienTheChiCoDongDuKien_khongNhanDuocGiNenKhongIn() {
        PhieuNhapKho p = phieu(3);
        p.setChiTietPhieuNhapKhos(List.of(
                dong(p, 201, "8", false, 7),    // kiểm đếm đạt 7 nhưng không vào lô nào: không có hàng để dán tem
                dong(p, 202, "3", false, 0),    // không nhận được gì
                dong(p, 203, "4", false, 0),
                dong(p, 203, "0", true, 0)));   // lô chỉ có hàng lỗi: thực nhận 0

        service.soLuongInTem(5);

        // 203 chỉ có lô hàng lỗi (thực nhận 0): cũng không có tem
        assertTrue(soLuongDaGui(List.of()).isEmpty());
    }

    @Test
    void phieuCuKhongCoLo_layDatKiemDem_chuaKiemThiLaySoNhap() {
        PhieuNhapKho p = phieu(3);
        p.setChiTietPhieuNhapKhos(List.of(
                dong(p, 201, "8", false, 7),
                dong(p, 202, "3", false, 0),
                dong(p, 201, "2.500", false, 0)));

        service.soLuongInTem(5);

        Map<Integer, Integer> soLuong = soLuongDaGui(List.of(201, 202));
        assertEquals(9, soLuong.get(201));   // 7 + 2 (2,5 làm tròn xuống)
        assertEquals(3, soLuong.get(202));
    }

    @Test
    void danhSachPhieu_phieuCuKhongCoLo_demLaiTuDongDuKien() {
        when(repository.phieuDaHoanTatInTem(anyInt(), anyBoolean(), anyCollection(), any(Pageable.class))).thenReturn(List.<Object[]>of(
                new Object[]{5, "PN202610241", Instant.parse("2026-10-01T03:00:00Z"), "Kho tổng", null, 0L, BigDecimal.ZERO}));
        PhieuNhapKho p = phieu(3);
        p.setChiTietPhieuNhapKhos(List.of(dong(p, 301, "12", false, 10), dong(p, 302, "5", false, 0)));

        List<PhieuNhapInTemDto> ds = service.phieuDaHoanTatInTem(null);

        assertEquals(2, ds.get(0).getSoSku());
        assertEquals(0, new BigDecimal("15").compareTo(ds.get(0).getTongSoLuong()));
    }

    @Test
    void phieuChuaHoanTat_baoLoi() {
        for (int trangThai : new int[]{0, 4}) {
            phieu(trangThai).setChiTietPhieuNhapKhos(List.of());
            CommonException loi = assertThrows(CommonException.class, () -> service.soLuongInTem(5));
            assertTrue(loi.getMessage().contains("chưa hoàn tất"), loi.getMessage());
        }
        verify(temSanPhamService, never()).dongTheoIds(anyList(), anyMap());
    }

    @Test
    void phieuKhoKhac_baoLoiKhongThuocKho() {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(4).vaiTro(Set.of(IRoleType.nhan_vien_kho))
                .phanQuyenNguoiDungKhos(List.of(PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(1).build()).build()))
                .build());
        phieu(3).setChiTietPhieuNhapKhos(List.of());
        assertThrows(CommonException.class, () -> service.soLuongInTem(5));
    }

    @Test
    void danhSachPhieuHoanTat_quanTriVienXemMoiKho_nguoiKhacChiKhoDuocPhan() {
        Instant ngay = Instant.parse("2026-10-24T03:00:00Z");
        when(repository.phieuDaHoanTatInTem(anyInt(), anyBoolean(), anyCollection(), any(Pageable.class))).thenReturn(List.<Object[]>of(
                new Object[]{5, "PN202610241", ngay, "Kho tổng", "Denim Việt", 5L, new BigDecimal("42.000")}));

        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(1).vaiTro(Set.of(IRoleType.quan_tri_vien)).build());
        List<PhieuNhapInTemDto> ds = service.phieuDaHoanTatInTem(null);
        verify(repository).phieuDaHoanTatInTem(eq(3), eq(true), eq(List.of(-1)), argThat(p -> p.getPageSize() == 20));
        assertEquals("PN202610241", ds.get(0).getSoPhieuNhap());
        assertEquals(5, ds.get(0).getSoSku());
        assertEquals(0, new BigDecimal("42").compareTo(ds.get(0).getTongSoLuong()));

        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(2).vaiTro(Set.of(IRoleType.quan_ly_kho))
                .phanQuyenNguoiDungKhos(List.of(PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(22).build()).build()))
                .build());
        service.phieuDaHoanTatInTem(500);
        verify(repository).phieuDaHoanTatInTem(eq(3), eq(false), eq(List.of(22)), argThat(p -> p.getPageSize() == 50));
    }
}
