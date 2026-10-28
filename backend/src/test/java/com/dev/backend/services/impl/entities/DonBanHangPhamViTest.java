package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.ChiTietDonBanHangCreating;
import com.dev.backend.dto.request.DonBanHangCreating;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DonBanHangRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Đợt 3 (M-7): mở đơn / báo giá theo id theo đúng phạm vi của màn danh sách — nhân viên bán hàng chỉ đơn mình tạo,
 * nhân viên / quản lý kho chỉ đơn xuất từ kho mình, quản trị viên tất cả. Kèm: không từ chối lại báo giá đã chốt,
 * phí vận chuyển không âm.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DonBanHangPhamViTest {

    private static final int NGUOI_TAO = 7, NGUOI_KHAC = 8, KHO_A = 1, KHO_B = 2, DON_ID = 90;

    @Mock private DonBanHangRepository repo;
    private DonBanHangService service;

    @BeforeEach
    void setUp() {
        service = new DonBanHangService(repo);
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    private static NguoiDungAuthInfo nguoi(int id, String vaiTro, Integer... khoDuocPhan) {
        return NguoiDungAuthInfo.builder().id(id).vaiTro(Set.of(vaiTro))
                .phanQuyenNguoiDungKhos(Arrays.stream(khoDuocPhan)
                        .map(k -> PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(k).build()).build())
                        .toList())
                .build();
    }

    private static void dangNhap(int id, String vaiTro, Integer... khoDuocPhan) {
        SecurityContextHolder.setUser(nguoi(id, vaiTro, khoDuocPhan));
    }

    private DonBanHang don(String loai, int trangThai, Integer khoXuat) {
        DonBanHang d = DonBanHang.builder().id(DON_ID).soDonHang("SO-1").loaiChungTu(loai).trangThai(trangThai)
                .nguoiTao(NguoiDung.builder().id(NGUOI_TAO).build())
                .khoXuat(khoXuat == null ? null : Kho.builder().id(khoXuat).build()).build();
        when(repo.findById(DON_ID)).thenReturn(Optional.of(d));
        return d;
    }

    private static void biChan(Executable e) {
        CommonException ex = assertThrows(CommonException.class, e);
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus(), ex.getMessage());
        assertFalse(ex.getMessage().toLowerCase().contains("bị khóa"), "frontend sẽ đăng xuất nhầm");
    }

    // ===== quy tắc phạm vi (cùng quy tắc danh sách) =====

    @Test
    void trongPhamVi_theoVaiTro() {
        DonBanHang d = DonBanHang.builder().nguoiTao(NguoiDung.builder().id(NGUOI_TAO).build())
                .khoXuat(Kho.builder().id(KHO_A).build()).build();
        assertTrue(DonBanHangService.trongPhamVi(d, nguoi(1, IRoleType.quan_tri_vien)));
        assertTrue(DonBanHangService.trongPhamVi(d, nguoi(NGUOI_TAO, IRoleType.nhan_vien_ban_hang)));
        assertFalse(DonBanHangService.trongPhamVi(d, nguoi(NGUOI_KHAC, IRoleType.nhan_vien_ban_hang)));
        assertTrue(DonBanHangService.trongPhamVi(d, nguoi(NGUOI_KHAC, IRoleType.nhan_vien_kho, KHO_A)));
        assertFalse(DonBanHangService.trongPhamVi(d, nguoi(NGUOI_KHAC, IRoleType.quan_ly_kho, KHO_B)));
        assertFalse(DonBanHangService.trongPhamVi(d, nguoi(NGUOI_KHAC, IRoleType.nhan_vien_kho)), "chưa được gán kho");
        assertTrue(DonBanHangService.trongPhamVi(d, null), "gọi nội bộ (job đồng bộ sàn)");
    }

    @Test
    void trongPhamVi_vaiTroKho_donChuaCoKhoXuat_khongThay() {
        DonBanHang baoGia = DonBanHang.builder().nguoiTao(NguoiDung.builder().id(NGUOI_TAO).build()).build();
        assertFalse(DonBanHangService.trongPhamVi(baoGia, nguoi(NGUOI_KHAC, IRoleType.quan_ly_kho, KHO_A)));
    }

    // ===== mở / thao tác theo id =====

    @Test
    void banHang_moDonCuaDongNghiep_biChan_moiThaoTac() {
        DonBanHang d = don("don_hang", 3, KHO_A);
        dangNhap(NGUOI_KHAC, IRoleType.nhan_vien_ban_hang);

        biChan(() -> service.getDetail(DON_ID));
        biChan(() -> service.getKhoKhaDungChoDonHang(DON_ID));
        biChan(() -> service.sendToWarehouse(DON_ID, KHO_A));
        biChan(() -> service.cancel(DON_ID));
        biChan(() -> service.markAsDelivered(DON_ID));
        biChan(() -> service.returnOrder(DON_ID));
        assertEquals(3, d.getTrangThai());
        verify(repo, never()).save(any());
    }

    @Test
    void banHang_baoGiaCuaDongNghiep_khongTuChoiKhongChuyenDuoc() {
        DonBanHang bg = don("bao_gia", 1, null);
        dangNhap(NGUOI_KHAC, IRoleType.nhan_vien_ban_hang);

        biChan(() -> service.rejectQuote(DON_ID, "giá cao"));
        biChan(() -> service.convertToOrder(DON_ID, KHO_A, null, null, null));
        assertEquals(1, bg.getTrangThai());
    }

    @Test
    void kho_donXuatTuKhoKhac_biChan() {
        don("don_hang", 3, KHO_B);
        dangNhap(NGUOI_KHAC, IRoleType.quan_ly_kho, KHO_A);
        biChan(() -> service.getDetail(DON_ID));
    }

    @Test
    void banHang_donCuaMinh_quaCuaPhamVi() {
        DonBanHang d = don("don_hang", 3, KHO_A);
        dangNhap(NGUOI_TAO, IRoleType.nhan_vien_ban_hang);
        // qua bước phạm vi; phần sau (chi tiết đơn) không dựng đủ dữ liệu nên lỗi khác 403 là chấp nhận được
        try {
            service.markAsDelivered(DON_ID);
        } catch (CommonException ex) {
            assertNotEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus(), ex.getMessage());
        } catch (RuntimeException ignored) {
            // đã qua bước phạm vi
        }
        assertNotNull(d);
    }

    // ===== hạn lưu bằng chứng đóng gói =====

    @Test
    void daGiao_vaHoanTra_giaHanLuuBangChungDongGoi() {
        var bangChung = mock(com.dev.backend.services.multitable.BangChungDongGoiService.class);
        var pxRepo = mock(com.dev.backend.repository.PhieuXuatKhoRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "bangChungDongGoiService", bangChung);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "chiTietDonBanHangRepository",
                mock(com.dev.backend.repository.ChiTietDonBanHangRepository.class));
        org.springframework.test.util.ReflectionTestUtils.setField(service, "phieuXuatKhoRepository", pxRepo);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "thanhToanDonBanService",
                mock(ThanhToanDonBanService.class));
        dangNhap(NGUOI_TAO, IRoleType.nhan_vien_ban_hang);

        // Đã giao: hạn tính từ ngày giao (khiếu nại số lượng / chất lượng tính từ đây)
        DonBanHang d = don("don_hang", 3, KHO_A);
        java.time.Instant giao = java.time.Instant.now().minusSeconds(3L * 86400);
        d.setNgayGiaoHang(giao);
        service.markAsDelivered(DON_ID);
        assertEquals(5, d.getTrangThai());
        verify(bangChung).giaHanLuuTu(DON_ID, giao);

        // Bị hoàn trả: hạn tính từ hôm hoàn trả
        DonBanHang tra = don("don_hang", 3, KHO_A);
        when(pxRepo.existsByDonBanHangIdAndTrangThai(DON_ID, 3)).thenReturn(true);
        java.time.Instant truoc = java.time.Instant.now();
        service.returnOrder(DON_ID);
        assertEquals(6, tra.getTrangThai());
        verify(bangChung).giaHanLuuTu(eq(DON_ID), argThat(t -> t != null && !t.isBefore(truoc)));
    }

    // ===== báo giá đã chốt / đã từ chối =====

    @Test
    void tuChoiBaoGia_daChuyenThanhDonHoacDaTuChoi_baoLoi_trangThaiGiuNguyen() {
        dangNhap(NGUOI_TAO, IRoleType.nhan_vien_ban_hang);
        DonBanHang daChot = don("bao_gia", 2, null);
        assertThrows(CommonException.class, () -> service.rejectQuote(DON_ID, "x"));
        assertEquals(2, daChot.getTrangThai());

        DonBanHang daTuChoi = don("bao_gia", 4, null);
        assertThrows(CommonException.class, () -> service.rejectQuote(DON_ID, "x"));
        assertEquals(4, daTuChoi.getTrangThai());
        verify(repo, never()).save(any());
    }

    @Test
    void tuChoiBaoGia_dangCho_tuChoiDuoc() {
        dangNhap(NGUOI_TAO, IRoleType.nhan_vien_ban_hang);
        DonBanHang bg = don("bao_gia", 1, null);
        service.rejectQuote(DON_ID, "khách chưa cần");
        assertEquals(4, bg.getTrangThai());
        assertEquals("khách chưa cần", bg.getLyDoTuChoi());
    }

    // ===== phí vận chuyển =====

    @Test
    void phiVanChuyenAm_baoLoi_khiTaoDonVaKhiChuyenBaoGia() {
        dangNhap(NGUOI_TAO, IRoleType.nhan_vien_ban_hang);
        DonBanHangCreating yeuCau = DonBanHangCreating.builder().phiVanChuyen(new BigDecimal("-50000"))
                .chiTiet(List.of(new ChiTietDonBanHangCreating())).build();
        CommonException taoDon = assertThrows(CommonException.class, () -> service.create(yeuCau));
        assertTrue(taoDon.getMessage().contains("Phí vận chuyển"), taoDon.getMessage());

        DonBanHang bg = don("bao_gia", 1, null);
        CommonException chuyen = assertThrows(CommonException.class,
                () -> service.convertToOrder(DON_ID, KHO_A, null, null, new BigDecimal("-1")));
        assertTrue(chuyen.getMessage().contains("Phí vận chuyển"), chuyen.getMessage());
        assertEquals(1, bg.getTrangThai());
    }
}
