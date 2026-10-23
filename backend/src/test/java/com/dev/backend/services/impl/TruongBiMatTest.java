package com.dev.backend.services.impl;

import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.InvalidFieldException;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Bộ lọc / sắp xếp chung (M-2): không được lọc theo cột bí mật, kể cả đi vòng qua quan hệ — đếm số dòng khớp từng tiền
 * tố ("quanLy.matKhauHash" bắt đầu bằng "$2a$10$a"…) là dò ra được giá trị.
 */
class TruongBiMatTest {

    static class KhoThu extends BaseServiceImpl<Kho, Integer> {
        KhoThu() {
            super(mock(KhoRepository.class));
        }

        @Override
        protected EntityManager getEntityManager() {
            return null;
        }
    }

    static class NguoiDungThu extends BaseServiceImpl<NguoiDung, Integer> {
        NguoiDungThu() {
            super(mock(NguoiDungRepository.class));
        }

        @Override
        protected EntityManager getEntityManager() {
            return null;
        }
    }

    @Test
    void cotBiMatQuaQuanHe_biTuChoi() {
        KhoThu kho = new KhoThu();
        InvalidFieldException loi = assertThrows(InvalidFieldException.class,
                () -> kho.validateFieldName("quanLy.matKhauHash"));
        assertEquals("Không được lọc hoặc sắp xếp theo trường này", loi.getMessage());
    }

    @Test
    void cotBiMatTrucTiep_biTuChoi() {
        NguoiDungThu nguoiDung = new NguoiDungThu();
        assertThrows(InvalidFieldException.class, () -> nguoiDung.validateFieldName("matKhauHash"));
    }

    @Test
    void moiTenCotBiMat_deuBiChan() {
        KhoThu kho = new KhoThu();
        for (String truong : BaseServiceImpl.TRUONG_BI_MAT) {
            assertThrows(InvalidFieldException.class, () -> kho.validateFieldName("quanLy." + truong), truong);
        }
    }

    @Test
    void cotBiMat_doiHoaThuong_vanBiChan() {
        // Sắp xếp qua Spring Data hạ chữ đầu: "quanLy.MatKhauHash" vẫn sắp theo matKhauHash
        KhoThu kho = new KhoThu();
        for (String truong : new String[]{"quanLy.MatKhauHash", "quanLy.MATKHAUHASH", "quanLy. matKhauHash "}) {
            assertThrows(InvalidFieldException.class, () -> kho.validateFieldName(truong), truong);
        }
    }

    @Test
    void giaTriLocCotSoThapPhan_soMuKhongLo_bao400() {
        assertThrows(InvalidFieldException.class, () -> BaseServiceImpl.soThapPhanCoGioiHan("1e900000000", "giaBan"));
        assertThrows(InvalidFieldException.class, () -> BaseServiceImpl.soThapPhanCoGioiHan("abc", "giaBan"));
        assertThrows(InvalidFieldException.class,
                () -> BaseServiceImpl.soThapPhanCoGioiHan(java.util.List.of("1", "1e-900000000"), "giaBan"));
        assertEquals(new java.math.BigDecimal("459000.50"), BaseServiceImpl.soThapPhanCoGioiHan(" 459000.50 ", "giaBan"));
        assertEquals(java.util.List.of(new java.math.BigDecimal("1"), new java.math.BigDecimal("2")),
                BaseServiceImpl.soThapPhanCoGioiHan(java.util.List.of(1, "2"), "giaBan"));
    }

    @Test
    void cotThuong_vanLocDuoc() {
        KhoThu kho = new KhoThu();
        assertDoesNotThrow(() -> kho.validateFieldName("tenKho"));
        assertDoesNotThrow(() -> kho.validateFieldName("quanLy.hoTen"));
        assertDoesNotThrow(() -> new NguoiDungThu().validateFieldName("tenDangNhap"));
    }
}
