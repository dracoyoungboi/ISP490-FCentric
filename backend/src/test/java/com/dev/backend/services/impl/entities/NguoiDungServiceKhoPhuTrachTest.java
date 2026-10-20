package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.KhoPhuTrachHieuLucDto;
import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Cột "Kho phụ trách" của danh sách Người dùng (POST /api/v1/admin/filter): mỗi trang gắn kho đang làm việc
 * cho người dùng bằng một truy vấn; quản trị viên không gắn; dữ liệu cũ còn nhiều kho thì lấy kho đầu.
 */
class NguoiDungServiceKhoPhuTrachTest {

    private PhanQuyenNguoiDungKhoService pqService;
    private NguoiDungService service;

    @BeforeEach
    void setUp() {
        service = new NguoiDungService(mock(NguoiDungRepository.class));
        pqService = mock(PhanQuyenNguoiDungKhoService.class);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungKhoService", pqService);
    }

    private static NguoiDungDto nguoiDung(int id, String vaiTro) {
        return NguoiDungDto.builder().id(id).vaiTro(vaiTro).build();
    }

    @Test
    @DisplayName("Nhân viên được gắn kho đang làm việc; quản trị viên không đưa vào truy vấn")
    @SuppressWarnings("unchecked")
    void ganKhoChoNhanVien() {
        NguoiDungDto nhanVienKho = nguoiDung(5, IRoleType.nhan_vien_kho);
        NguoiDungDto quanTri = nguoiDung(1, IRoleType.quan_tri_vien);
        NguoiDungDto chuaCoKho = nguoiDung(7, IRoleType.nhan_vien_ban_hang);
        KhoPhuTrachHieuLucDto khoTong = KhoPhuTrachHieuLucDto.builder().maKho("KHO_TONG").tenKho("Kho tổng").build();
        when(pqService.layKhoPhuTrachHieuLucTheoNguoiDung(any())).thenReturn(Map.of(5, khoTong));

        service.ganKhoPhuTrachHieuLuc(List.of(nhanVienKho, quanTri, chuaCoKho));

        assertSame(khoTong, nhanVienKho.getKhoPhuTrachHieuLuc());
        assertNull(quanTri.getKhoPhuTrachHieuLuc());
        assertNull(chuaCoKho.getKhoPhuTrachHieuLuc());
        ArgumentCaptor<Collection<Integer>> ids = ArgumentCaptor.forClass(Collection.class);
        verify(pqService, times(1)).layKhoPhuTrachHieuLucTheoNguoiDung(ids.capture());
        assertEquals(List.of(5, 7), List.copyOf(ids.getValue()));
    }

    @Test
    @DisplayName("Trang chỉ có quản trị viên: không truy vấn phân quyền kho")
    void trangChiCoQuanTriVien() {
        service.ganKhoPhuTrachHieuLuc(List.of(nguoiDung(1, IRoleType.quan_tri_vien), nguoiDung(2, IRoleType.quan_tri_vien)));

        verifyNoInteractions(pqService);
    }

    @Test
    @DisplayName("Dữ liệu cũ còn nhiều kho hiệu lực: lấy kho đầu (như trang chi tiết), giữ ngày hết hiệu lực")
    void layKhoDauKhiConNhieuKho() {
        PhanQuyenNguoiDungKhoRepository repo = mock(PhanQuyenNguoiDungKhoRepository.class);
        PhanQuyenNguoiDungKhoService that = new PhanQuyenNguoiDungKhoService(repo);
        Instant hetHieuLuc = Instant.parse("2026-12-31T16:59:59Z");
        when(repo.layKhoHieuLucTheoNguoiDung(eq(List.of(5, 6)), any(Instant.class))).thenReturn(List.<Object[]>of(
                new Object[]{5, "KHO_TONG", "Kho tổng", hetHieuLuc},
                new Object[]{5, "KHO_HN", "Kho Hà Nội", null},
                new Object[]{6, "KHO_HCM", "Kho Hồ Chí Minh", null}));

        Map<Integer, KhoPhuTrachHieuLucDto> ketQua = that.layKhoPhuTrachHieuLucTheoNguoiDung(List.of(5, 6));

        assertEquals(2, ketQua.size());
        assertEquals("Kho tổng", ketQua.get(5).getTenKho());
        assertEquals(hetHieuLuc, ketQua.get(5).getNgayKetThuc());
        assertEquals("Kho Hồ Chí Minh", ketQua.get(6).getTenKho());
        assertNull(ketQua.get(6).getNgayKetThuc());
    }

    @Test
    @DisplayName("Không có người dùng nào cần tra: không truy vấn")
    void danhSachRong() {
        PhanQuyenNguoiDungKhoRepository repo = mock(PhanQuyenNguoiDungKhoRepository.class);

        assertTrue(new PhanQuyenNguoiDungKhoService(repo).layKhoPhuTrachHieuLucTheoNguoiDung(List.of()).isEmpty());
        verifyNoInteractions(repo);
    }
}
