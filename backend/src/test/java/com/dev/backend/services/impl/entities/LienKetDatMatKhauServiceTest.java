package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.LienKetDatMatKhau;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.LienKetDatMatKhauRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Mã liên kết đặt mật khẩu: ngẫu nhiên, chỉ lưu SHA-256, hạn 24 giờ, mỗi lý do không dùng được có mã lỗi riêng. */
class LienKetDatMatKhauServiceTest {

    private static final Instant LUC = Instant.parse("2026-11-01T03:00:00Z");

    private final LienKetDatMatKhauRepository repo = mock(LienKetDatMatKhauRepository.class);
    private final LienKetDatMatKhauService service = new LienKetDatMatKhauService(repo);

    @Test
    void bam_laSha256Hex() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", LienKetDatMatKhauService.bam("abc"));
    }

    @Test
    void tao_huyLienKetCuTruoc_luuBam_khongLuuMaGoc_han24Gio() {
        LienKetDatMatKhauService.LienKetMoi moi = service.tao(7, LienKetDatMatKhauService.CAP_LAI, 1, LUC);

        assertTrue(moi.ma().matches("^[A-Za-z0-9_-]{43}$"), "32 byte base64url không đệm: " + moi.ma());
        assertEquals(LUC.plus(Duration.ofHours(24)), moi.hetHanLuc());
        assertFalse(moi.toString().contains(moi.ma()), "toString không lộ mã");

        ArgumentCaptor<LienKetDatMatKhau> luu = ArgumentCaptor.forClass(LienKetDatMatKhau.class);
        InOrder thuTu = inOrder(repo);
        thuTu.verify(repo).huyConMo(7, LUC);
        thuTu.verify(repo).save(luu.capture());
        LienKetDatMatKhau lk = luu.getValue();
        assertEquals(LienKetDatMatKhauService.bam(moi.ma()), lk.getMaBam());
        assertNotEquals(moi.ma(), lk.getMaBam());
        assertEquals(7, lk.getNguoiDungId());
        assertEquals(LienKetDatMatKhauService.CAP_LAI, lk.getMucDich());
        assertEquals(1, lk.getTaoBoi());
        assertEquals(LUC, lk.getTaoLuc());
        assertNull(lk.getDaDungLuc());
        assertNull(lk.getHuyLuc());

        assertNotEquals(moi.ma(), service.tao(7, LienKetDatMatKhauService.CAP_LAI, 1, LUC).ma(), "mỗi lần một mã mới");
    }

    private LienKetDatMatKhau lienKet(String ma) {
        LienKetDatMatKhau lk = LienKetDatMatKhau.builder().id(5).nguoiDungId(7).maBam(LienKetDatMatKhauService.bam(ma))
                .mucDich(LienKetDatMatKhauService.TAO_TAI_KHOAN).taoLuc(LUC).hetHanLuc(LUC.plus(Duration.ofHours(24)))
                .build();
        when(repo.findByMaBam(lk.getMaBam())).thenReturn(Optional.of(lk));
        return lk;
    }

    private static String ma(LoiCoMaException e) {
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertFalse(e.getMessage().contains("bị khóa"));
        return e.getMa();
    }

    @Test
    void timConHieuLuc_conHan_traLienKet() {
        String ma = "A".repeat(43);
        LienKetDatMatKhau lk = lienKet(ma);
        assertSame(lk, service.timConHieuLuc(ma, LUC.plus(Duration.ofHours(23))));
    }

    @Test
    void timConHieuLuc_moiLyDoMotMa() {
        String ma = "B".repeat(43);
        LienKetDatMatKhau lk = lienKet(ma);

        assertEquals(MaLoi.LIEN_KET_HET_HAN, ma(assertThrows(LoiCoMaException.class,
                () -> service.timConHieuLuc(ma, lk.getHetHanLuc()))), "đúng giờ hết hạn là hết");
        LoiCoMaException hetHan = assertThrows(LoiCoMaException.class,
                () -> service.timConHieuLuc(ma, LUC.plus(Duration.ofDays(3))));
        assertTrue(hetHan.getMessage().contains("10:00 ngày 02/11/2026"), hetHan.getMessage());

        lk.setHuyLuc(LUC);
        assertEquals(MaLoi.LIEN_KET_DA_THAY, ma(assertThrows(LoiCoMaException.class, () -> service.timConHieuLuc(ma, LUC))));

        lk.setDaDungLuc(LUC);
        assertEquals(MaLoi.LIEN_KET_DA_DUNG, ma(assertThrows(LoiCoMaException.class, () -> service.timConHieuLuc(ma, LUC))),
                "đã dùng báo trước đã thay");
    }

    @Test
    void timConHieuLuc_maKhongCo_hoacSaiDang() {
        assertEquals(MaLoi.LIEN_KET_KHONG_HOP_LE, ma(assertThrows(LoiCoMaException.class,
                () -> service.timConHieuLuc("C".repeat(43), LUC))));
        for (String sai : new String[]{null, "", "ngan", "co dau cach".repeat(5), "x".repeat(101), "a+b/c=".repeat(8)}) {
            assertEquals(MaLoi.LIEN_KET_KHONG_HOP_LE, ma(assertThrows(LoiCoMaException.class,
                    () -> service.timConHieuLuc(sai, LUC))), String.valueOf(sai));
        }
        verify(repo, times(1)).findByMaBam(any());
    }

    @Test
    void khoaDeDung_docQuaKhoaDong_cungLuatKiem() {
        String ma = "D".repeat(43);
        LienKetDatMatKhau lk = LienKetDatMatKhau.builder().id(5).nguoiDungId(7).maBam(LienKetDatMatKhauService.bam(ma))
                .mucDich(LienKetDatMatKhauService.CAP_LAI).taoLuc(LUC).hetHanLuc(LUC.plus(Duration.ofHours(24))).build();
        when(repo.khoaTheoMaBam(lk.getMaBam())).thenReturn(Optional.of(lk));

        assertSame(lk, service.khoaDeDung(ma, LUC));
        verify(repo, never()).findByMaBam(any());

        lk.setDaDungLuc(LUC);
        assertEquals(MaLoi.LIEN_KET_DA_DUNG, ma(assertThrows(LoiCoMaException.class, () -> service.khoaDeDung(ma, LUC))));
        assertEquals(MaLoi.LIEN_KET_KHONG_HOP_LE, ma(assertThrows(LoiCoMaException.class,
                () -> service.khoaDeDung("sai dang", LUC))));
        verify(repo, times(2)).khoaTheoMaBam(any());
    }
}
