package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.DanhMucQuanAoCreating;
import com.dev.backend.dto.request.DanhMucQuanAoUpdating;
import com.dev.backend.entities.DanhMucQuanAo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DanhMucQuanAoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cập nhật / tạo danh mục: chặn vòng lặp cha–con, không lỗi 500 khi trạng thái trống.
 * Cây mẫu: Áo(1) › Áo thun(2) › Áo thun cổ tròn(3); Quần(4).
 */
@ExtendWith(MockitoExtension.class)
class DanhMucQuanAoServiceTest {

    @Mock
    private DanhMucQuanAoRepository repository;

    private DanhMucQuanAoService service;

    private DanhMucQuanAo ao;
    private DanhMucQuanAo aoThun;
    private DanhMucQuanAo aoThunCoTron;
    private DanhMucQuanAo quan;

    @BeforeEach
    void setUp() {
        service = new DanhMucQuanAoService(repository);
        ao = danhMuc(1, "DM001", "Áo", null, 1);
        aoThun = danhMuc(2, "DM002", "Áo thun", ao, 1);
        aoThunCoTron = danhMuc(3, "DM003", "Áo thun cổ tròn", aoThun, 1);
        quan = danhMuc(4, "DM004", "Quần", null, 1);
    }

    private static DanhMucQuanAo danhMuc(Integer id, String ma, String ten, DanhMucQuanAo cha, Integer trangThai) {
        return DanhMucQuanAo.builder().id(id).maDanhMuc(ma).tenDanhMuc(ten).danhMucCha(cha).trangThai(trangThai).moTa("").build();
    }

    private void coSan(DanhMucQuanAo... danhMucs) {
        for (DanhMucQuanAo dm : danhMucs) {
            when(repository.findById(dm.getId())).thenReturn(Optional.of(dm));
        }
    }

    private static DanhMucQuanAoUpdating capNhat(Integer id, String ten, Integer chaId, Integer trangThai) {
        return DanhMucQuanAoUpdating.builder().id(id).tenDanhMuc(ten).danhMucChaId(chaId).moTa("").trangThai(trangThai).build();
    }

    // ── Chặn vòng lặp cha–con ──────────────────────────────────────────────

    @Test
    void update_chuyenVaoChauCuaChinhNo_baoLoi_khongLuu() {
        coSan(ao, aoThunCoTron);

        CommonException loi = assertThrows(CommonException.class,
                () -> service.update(capNhat(1, "Áo", 3, 1)));

        assertEquals("Không thể chuyển danh mục vào nhánh con của chính nó", loi.getMessage());
        verify(repository, never()).save(any());
        assertNull(ao.getDanhMucCha(), "Không được đổi cha của danh mục khi bị chặn");
    }

    @Test
    void update_chuyenVaoConTrucTiep_baoLoi_khongLuu() {
        coSan(ao, aoThun);

        CommonException loi = assertThrows(CommonException.class,
                () -> service.update(capNhat(1, "Áo", 2, 1)));

        assertEquals("Không thể chuyển danh mục vào nhánh con của chính nó", loi.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void update_tuLamChaChinhNo_vanBaoLoiNhuCu() {
        coSan(ao);

        CommonException loi = assertThrows(CommonException.class,
                () -> service.update(capNhat(1, "Áo", 1, 1)));

        assertEquals("Không thể gán danh mục cha cho chính nó", loi.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void update_chuyenSangNhanhKhac_hopLe_luuDungCha() {
        coSan(aoThunCoTron, quan);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(capNhat(3, "Áo thun cổ tròn", 4, 1));

        ArgumentCaptor<DanhMucQuanAo> daLuu = ArgumentCaptor.forClass(DanhMucQuanAo.class);
        verify(repository).save(daLuu.capture());
        assertSame(quan, daLuu.getValue().getDanhMucCha());
    }

    @Test
    void update_chuyenChaXuongCapThapHonTrongNhanhKhac_hopLe() {
        // Chuyển Quần vào dưới Áo thun cổ tròn (sâu 3 cấp ở nhánh khác): không phải vòng lặp
        coSan(quan, aoThunCoTron);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(capNhat(4, "Quần", 3, 1));

        assertSame(aoThunCoTron, quan.getDanhMucCha());
    }

    @Test
    void update_giuNguyenCha_hopLe() {
        coSan(aoThun, ao);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(capNhat(2, "Áo thun nam", 1, 1));

        assertSame(ao, aoThun.getDanhMucCha());
        assertEquals("Áo thun nam", aoThun.getTenDanhMuc());
    }

    @Test
    void update_veDanhMucGoc_hopLe() {
        coSan(aoThunCoTron);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(capNhat(3, "Áo thun cổ tròn", null, 1));

        assertNull(aoThunCoTron.getDanhMucCha());
        verify(repository).save(aoThunCoTron);
    }

    @Test
    void update_duLieuPhiaTrenDaCoVong_baoLoi_khongLapVoHan() {
        // Dữ liệu hỏng có sẵn: X(10) ↔ Y(11). Chuyển Quần vào X không được làm treo máy chủ
        DanhMucQuanAo x = danhMuc(10, "X", "X", null, 1);
        DanhMucQuanAo y = danhMuc(11, "Y", "Y", x, 1);
        x.setDanhMucCha(y);
        coSan(quan, x);

        CommonException loi = assertTimeoutPreemptively(Duration.ofSeconds(2),
                () -> assertThrows(CommonException.class, () -> service.update(capNhat(4, "Quần", 10, 1))));

        assertEquals("Dữ liệu danh mục cha đang bị lỗi vòng lặp, không chuyển vào đây được", loi.getMessage());
        verify(repository, never()).save(any());
    }

    // ── Trạng thái trống (null) ────────────────────────────────────────────

    @Test
    void update_chaCoTrangThaiTrong_khongLoi500_vaLuu() {
        ao.setTrangThai(null);
        coSan(aoThun, ao);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertDoesNotThrow(() -> service.update(capNhat(2, "Áo thun", 1, 1)));
        verify(repository).save(aoThun);
    }

    @Test
    void update_chaDangNgung_vanBaoLoiNhuCu() {
        ao.setTrangThai(0);
        coSan(aoThun, ao);

        CommonException loi = assertThrows(CommonException.class,
                () -> service.update(capNhat(2, "Áo thun", 1, 1)));

        assertEquals("Danh mục cha đã bị xoá", loi.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void update_khongGuiTrangThai_giuNguyenTrangThaiCu() {
        aoThun.setTrangThai(0);
        coSan(aoThun, ao);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(capNhat(2, "Áo thun", 1, null));

        assertEquals(0, aoThun.getTrangThai());
    }

    @Test
    void update_guiTrangThai_ghiDungGiaTri() {
        coSan(aoThun, ao);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(capNhat(2, "Áo thun", 1, 0));

        assertEquals(0, aoThun.getTrangThai());
    }

    @Test
    void create_khongGuiTrangThai_macDinhHoatDong() {
        when(repository.findByMaDanhMuc("DM010")).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.create(DanhMucQuanAoCreating.builder().maDanhMuc("DM010").tenDanhMuc("Váy").build());

        ArgumentCaptor<DanhMucQuanAo> daLuu = ArgumentCaptor.forClass(DanhMucQuanAo.class);
        verify(repository).save(daLuu.capture());
        assertEquals(1, daLuu.getValue().getTrangThai());
        assertNull(daLuu.getValue().getDanhMucCha());
    }

    @Test
    void create_guiTrangThai_giuNguyenGiaTri() {
        when(repository.findByMaDanhMuc("DM011")).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.create(DanhMucQuanAoCreating.builder().maDanhMuc("DM011").tenDanhMuc("Mũ").trangThai(0).build());

        ArgumentCaptor<DanhMucQuanAo> daLuu = ArgumentCaptor.forClass(DanhMucQuanAo.class);
        verify(repository).save(daLuu.capture());
        assertEquals(0, daLuu.getValue().getTrangThai());
    }
}
