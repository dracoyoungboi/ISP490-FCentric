package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.services.impl.multitable.NhatHangServiceImpl;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import java.sql.SQLIntegrityConstraintViolationException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Chạy lại thao tác khi số chứng từ "lớn nhất + 1" bị giao dịch khác dùng trước (khóa duy nhất của cột số chặn bên sau):
 * chỉ thử lại lỗi trùng cột SỐ CHỨNG TỪ, tối đa SO_LAN lần, chờ tăng dần giữa các lần; trùng khác (số XKNB người dùng
 * nhập, khóa ngoại) ném nguyên.
 */
class ThuLaiKhiTrungSoTest {

    private final java.util.List<Long> daCho = new java.util.ArrayList<>();
    private java.util.function.LongConsumer choGoc;

    @BeforeEach
    void khongChoThat() {
        choGoc = ThuLaiKhiTrungSo.cho;
        ThuLaiKhiTrungSo.cho = daCho::add;
    }

    @AfterEach
    void traLai() {
        ThuLaiKhiTrungSo.cho = choGoc;
    }

    private static RuntimeException trungQuaSpring(String bangKhoa, String so) {
        String cau = "Duplicate entry '" + so + "' for key '" + bangKhoa + "'";
        return new DataIntegrityViolationException("could not execute statement [" + cau + "]",
                new SQLIntegrityConstraintViolationException(cau));
    }

    /** Lỗi Hibernate thô (flush gọi thẳng trên EntityManager, không qua Spring dịch lỗi). */
    private static RuntimeException trungQuaHibernate(String bangKhoa, String so) {
        String cau = "Duplicate entry '" + so + "' for key '" + bangKhoa + "'";
        return new ConstraintViolationException("could not execute statement", new SQLIntegrityConstraintViolationException(cau), null);
    }

    @Test
    @DisplayName("Trùng số lệnh / PX-CK / PN / BBGN / DCK / phiếu nhặt lần đầu → chạy lại, lần sau thành công")
    void trungSoChungTu_chayLai() {
        for (RuntimeException loi : new RuntimeException[]{
                trungQuaSpring("phieu_chuyen_kho.uk_pck_so_lenh", "LDD-20261029-009"),
                trungQuaSpring("phieu_chuyen_kho.uk_so_phieu_chuyen", "PX-TRF-202610293"),
                trungQuaHibernate("phieu_xuat_kho.uk_phieu_xuat_kho_so_phieu", "PX202610291"),
                trungQuaSpring("phieu_nhap_kho.so_phieu_nhap", "PN-TRF-202610291"),
                trungQuaSpring("bien_ban_giao_nhan.uk_so_bien_ban", "BBGN-20261029-001"),
                trungQuaSpring("phieu_dieu_chinh_kho.so_phieu", "DCK-20261029-001"),
                trungQuaSpring("uk_ma_pick_list", "PL-20261029-003"),
                new CommonException(NhatHangServiceImpl.LOI_TRUNG_MA_PHIEU_NHAT, HttpStatus.CONFLICT, null)}) {
            AtomicInteger lan = new AtomicInteger();
            String kq = ThuLaiKhiTrungSo.chay(() -> {
                if (lan.incrementAndGet() == 1) throw loi;
                return "xong";
            });
            assertEquals("xong", kq);
            assertEquals(2, lan.get(), loi.getMessage());
        }
    }

    @Test
    @DisplayName("Trùng mãi → dừng sau SO_LAN lần, chờ tăng dần giữa các lần, 409 câu dễ hiểu")
    void trungMai_dungSauBaLan_409() {
        AtomicInteger lan = new AtomicInteger();
        CommonException ex = assertThrows(CommonException.class, () -> ThuLaiKhiTrungSo.chay(() -> {
            lan.incrementAndGet();
            throw trungQuaSpring("phieu_chuyen_kho.uk_pck_so_lenh", "LDD-20261029-009");
        }));
        assertEquals(ThuLaiKhiTrungSo.SO_LAN, lan.get());
        assertEquals(ThuLaiKhiTrungSo.SO_LAN - 1, daCho.size(), "chờ giữa các lần, không chờ sau lần cuối");
        for (int i = 0; i < daCho.size(); i++) {
            long ms = daCho.get(i);
            assertTrue(ms >= 20L * (i + 1) && ms < 80L * (i + 1), "lần " + (i + 1) + " chờ " + ms + " ms");
        }
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertEquals(ThuLaiKhiTrungSo.LOI_HET_LAN, ex.getMessage());
    }

    @Test
    @DisplayName("Trùng số XKNB người dùng nhập, lỗi khóa ngoại, lỗi nghiệp vụ khác → ném nguyên, không chạy lại")
    void loiKhac_khongChayLai() {
        for (RuntimeException loi : new RuntimeException[]{
                trungQuaSpring("phieu_chuyen_kho.uk_pck_xknb", "6K26NAB-0000125"),
                new DataIntegrityViolationException("x", new SQLIntegrityConstraintViolationException(
                        "Cannot add or update a child row: a foreign key constraint fails")),
                new CommonException(HttpStatus.CONFLICT, "Phiếu đang ở trạng thái Đã hủy")}) {
            AtomicInteger lan = new AtomicInteger();
            RuntimeException nem = assertThrows(RuntimeException.class, () -> ThuLaiKhiTrungSo.chay(() -> {
                lan.incrementAndGet();
                throw loi;
            }));
            assertSame(loi, nem);
            assertEquals(1, lan.get(), loi.getMessage());
        }
    }
}
