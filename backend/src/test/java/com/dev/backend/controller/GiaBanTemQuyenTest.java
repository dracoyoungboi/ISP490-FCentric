package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.response.entities.BienTheSanPhamDto;
import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.utils.XemGiaVon;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Quyền của màn "Giá bán & tem mã vạch": chỉ quản trị viên đổi giá bán; quản lý kho xem danh sách để in tem; in tem theo
 * phiếu nhập mở cho cả nhân viên kho. API cũ PATCH /sku/{id}/price (nhận cả giá vốn) đã gỡ. Nhân viên bán hàng không
 * thấy giá vốn ở POST /san-pham-quan-ao/filter.
 */
class GiaBanTemQuyenTest {

    private static Set<String> vaiTro(Class<?> controller, Class<? extends Annotation> loai, String duongDan) {
        Method m = Arrays.stream(controller.getDeclaredMethods())
                .filter(x -> x.isAnnotationPresent(loai))
                .filter(x -> Arrays.asList(duongDanCua(x.getAnnotation(loai))).contains(duongDan))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Không thấy " + duongDan + " trong " + controller.getSimpleName()));
        RequireAuth yeuCau = m.getAnnotation(RequireAuth.class);
        assertNotNull(yeuCau, duongDan + " phải bắt buộc đăng nhập");
        return new HashSet<>(Arrays.asList(yeuCau.roles()));
    }

    private static String[] duongDanCua(Annotation a) {
        if (a instanceof GetMapping g) return g.value();
        if (a instanceof PostMapping p) return p.value();
        if (a instanceof PatchMapping p) return p.value();
        return new String[0];
    }

    @Test
    void doiGiaBan_chiQuanTriVien() {
        assertEquals(Set.of(IRoleType.quan_tri_vien), vaiTro(SanPhamQuanAoController.class, PatchMapping.class, "/sku/gia-ban"));
    }

    @Test
    void danhSachGiaBan_quanTriVienVaQuanLyKho() {
        assertEquals(Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho),
                vaiTro(SanPhamQuanAoController.class, PostMapping.class, "/gia-ban/filter"));
    }

    @Test
    void apiDoiGiaCuNhanGiaVon_daGo() {
        boolean conApiCu = Arrays.stream(SanPhamQuanAoController.class.getDeclaredMethods())
                .filter(m -> m.isAnnotationPresent(PatchMapping.class))
                .anyMatch(m -> Arrays.asList(m.getAnnotation(PatchMapping.class).value()).contains("/sku/{id}/price"));
        assertFalse(conApiCu);
    }

    @Test
    void inTem_moChoNhanVienKho() {
        Set<String> kho = Set.of(IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho);
        assertEquals(kho, vaiTro(TemSanPhamController.class, GetMapping.class, "/cau-hinh"));
        assertEquals(kho, vaiTro(TemSanPhamController.class, GetMapping.class, "/tra-ma"));
        assertEquals(kho, vaiTro(PhieuNhapKhoController.class, GetMapping.class, "/{id}/so-luong-in-tem"));
        assertEquals(kho, vaiTro(PhieuNhapKhoController.class, GetMapping.class, "/in-tem/da-hoan-tat"));
    }

    @Test
    void xemGiaVon_nhanVienBanHangKhongThay_vaiTroKhacThay() {
        assertFalse(XemGiaVon.duocXem(Set.of(IRoleType.nhan_vien_ban_hang)));
        assertFalse(XemGiaVon.duocXem(Set.of()));
        assertFalse(XemGiaVon.duocXem(null));
        assertTrue(XemGiaVon.duocXem(Set.of(IRoleType.quan_ly_kho)));
        assertTrue(XemGiaVon.duocXem(Set.of(IRoleType.nhan_vien_mua_hang)));
        assertTrue(XemGiaVon.duocXem(Set.of(IRoleType.nhan_vien_ban_hang, IRoleType.quan_tri_vien)));
    }

    @Test
    void anGiaVon_xoaGiaVonSanPhamVaBienThe_giuGiaBan() {
        SanPhamQuanAoDto dto = SanPhamQuanAoDto.builder()
                .giaVonMacDinh(new BigDecimal("100"))
                .bienTheSanPhams(List.of(BienTheSanPhamDto.builder().giaVon(new BigDecimal("100")).giaBan(new BigDecimal("150")).build()))
                .build();

        SanPhamQuanAoController.anGiaVon(dto);

        assertNull(dto.getGiaVonMacDinh());
        assertNull(dto.getBienTheSanPhams().get(0).getGiaVon());
        assertEquals(0, new BigDecimal("150").compareTo(dto.getBienTheSanPhams().get(0).getGiaBan()));
    }
}
