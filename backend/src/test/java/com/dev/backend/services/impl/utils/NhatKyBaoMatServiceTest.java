package com.dev.backend.services.impl.utils;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Nhật ký bảo mật: ghi đúng dòng, lỗi ghi không lan ra thao tác chính, ghi sau commit thì rollback không để lại dòng. */
class NhatKyBaoMatServiceTest {

    private final LichSuThayDoiService lichSu = mock(LichSuThayDoiService.class);
    private final NguoiDungRepository nguoiDungRepo = mock(NguoiDungRepository.class);
    // Executor chạy ngay trên luồng test để kiểm tra đồng bộ; luồng nền thật có test riêng bên dưới
    private final NhatKyBaoMatService service = new NhatKyBaoMatService(lichSu, nguoiDungRepo, Runnable::run);

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void ghiNgay_dungCotVaBoKyTuXuongDong() {
        NguoiDung nd = NguoiDung.builder().id(7).build();
        when(nguoiDungRepo.findById(7)).thenReturn(Optional.of(nd));

        service.ghiNgay(IHanhDong.dang_nhap_that_bai, ITable.nguoi_dung, 7, 7, "Sai mật khẩu\r\nGIẢ: dòng log");

        ArgumentCaptor<LichSuThayDoi> dong = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSu).createGiaoDichRieng(dong.capture());
        LichSuThayDoi ls = dong.getValue();
        assertEquals(IHanhDong.dang_nhap_that_bai, ls.getHanhDong());
        assertEquals(ITable.nguoi_dung, ls.getLoaiThamChieu());
        assertEquals(7, ls.getIdThamChieu());
        assertSame(nd, ls.getNguoiThucHien());
        assertNotNull(ls.getNgayThucHien());
        assertEquals("Sai mật khẩu  GIẢ: dòng log", ls.getGhiChu());
    }

    @Test
    void ghiNgay_khongBietNguoiThucHien_khongGhi() {
        service.ghiNgay(IHanhDong.dang_nhap, ITable.nguoi_dung, 7, null, null);
        when(nguoiDungRepo.findById(99)).thenReturn(Optional.empty());
        service.ghiNgay(IHanhDong.dang_nhap, ITable.nguoi_dung, 99, 99, null);
        verifyNoInteractions(lichSu);
    }

    @Test
    void ghiNgay_loiCsdl_khongNemRaNgoai() {
        when(nguoiDungRepo.findById(7)).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        when(lichSu.createGiaoDichRieng(any())).thenThrow(new IllegalStateException("mất kết nối"));
        assertDoesNotThrow(() -> service.ghiNgay(IHanhDong.dang_nhap, ITable.nguoi_dung, 7, 7, null));

        when(nguoiDungRepo.findById(8)).thenThrow(new IllegalStateException("mất kết nối"));
        assertDoesNotThrow(() -> service.ghiNgay(IHanhDong.dang_nhap, ITable.nguoi_dung, 8, 8, null));
    }

    @Test
    void ghiSauCommit_chiGhiKhiGiaoDichCommit() {
        when(nguoiDungRepo.findById(7)).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        TransactionSynchronizationManager.initSynchronization();

        service.ghiSauCommit(IHanhDong.khoa_tai_khoan, ITable.nguoi_dung, 7, 7, null);
        verifyNoInteractions(lichSu);

        List<TransactionSynchronization> dongBo = TransactionSynchronizationManager.getSynchronizations();
        assertEquals(1, dongBo.size());
        dongBo.get(0).afterCommit();
        verify(lichSu).createGiaoDichRieng(any());
    }

    @Test
    void luongNenThat_ghiKhongChanLuongGoi() throws Exception {
        when(nguoiDungRepo.findById(7)).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        NhatKyBaoMatService that = new NhatKyBaoMatService(lichSu, nguoiDungRepo);
        Thread[] luongGhi = new Thread[1];
        when(lichSu.createGiaoDichRieng(any())).thenAnswer(inv -> {
            luongGhi[0] = Thread.currentThread();
            return inv.getArgument(0);
        });
        try {
            that.ghiNgay(IHanhDong.dang_nhap, ITable.nguoi_dung, 7, 7, null);
            verify(lichSu, timeout(3000)).createGiaoDichRieng(any());
            assertNotSame(Thread.currentThread(), luongGhi[0], "ghi trên luồng nền, không giữ thêm kết nối của request");
            assertEquals("nhat-ky-bao-mat", luongGhi[0].getName());
        } finally {
            that.dung();
        }
    }

    @Test
    void xepHangLoi_khongNemRaNgoai() {
        NhatKyBaoMatService day = new NhatKyBaoMatService(lichSu, nguoiDungRepo, viec -> {
            throw new java.util.concurrent.RejectedExecutionException("đầy");
        });
        assertDoesNotThrow(() -> day.ghiNgay(IHanhDong.dang_nhap, ITable.nguoi_dung, 7, 7, null));
        verifyNoInteractions(lichSu);
    }

    @Test
    void ghiNgayGioiHan_trongKhoang_chiMotDong_moiDoiTuongRieng() {
        when(nguoiDungRepo.findById(any())).thenAnswer(inv -> Optional.of(NguoiDung.builder().id(inv.getArgument(0)).build()));
        java.time.Duration muoiPhut = java.time.Duration.ofMinutes(10);

        for (int i = 0; i < 50; i++) {
            service.ghiNgayGioiHan(IHanhDong.dang_nhap_that_bai, ITable.nguoi_dung, 7, 7, "lặp", muoiPhut);
        }
        service.ghiNgayGioiHan(IHanhDong.dang_nhap_that_bai, ITable.nguoi_dung, 8, 8, "khác", muoiPhut);
        verify(lichSu, times(2)).createGiaoDichRieng(any());

        // Khoảng 0: lần nào cũng ghi
        service.ghiNgayGioiHan(IHanhDong.dang_nhap, ITable.nguoi_dung, 9, 9, null, java.time.Duration.ZERO);
        service.ghiNgayGioiHan(IHanhDong.dang_nhap, ITable.nguoi_dung, 9, 9, null, java.time.Duration.ZERO);
        verify(lichSu, times(4)).createGiaoDichRieng(any());
    }

    @Test
    void ip_dinhDang() {
        assertEquals("IP 203.0.113.10", NhatKyBaoMatService.ip(" 203.0.113.10 "));
        assertNull(NhatKyBaoMatService.ip(null));
        assertNull(NhatKyBaoMatService.ip(" "));
    }
}
