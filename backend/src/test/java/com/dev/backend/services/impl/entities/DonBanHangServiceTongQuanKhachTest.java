package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FilterOperation;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.FilterCriteria;
import com.dev.backend.dto.response.customize.TongQuanMuaHangKhachDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.repository.DonBanHangRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Số tổng hợp đơn bán của khách (trang chi tiết khách hàng) và phạm vi theo vai trò dùng chung với danh sách đơn.
 */
@ExtendWith(MockitoExtension.class)
class DonBanHangServiceTongQuanKhachTest {

    @Mock private DonBanHangRepository donBanHangRepository;

    private DonBanHangService service;

    @BeforeEach
    void setUp() {
        service = new DonBanHangService(donBanHangRepository);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    /** Nhóm đơn không gắn kênh (đơn tạo trên hệ thống / POS). */
    private static TinhMuaHangKhach.Dong so(int trangThai, long soDon, String tongTien) {
        return new TinhMuaHangKhach.Dong(trangThai, false, soDon, new BigDecimal(tongTien));
    }

    /** Nhóm đơn sàn (gắn kênh). */
    private static TinhMuaHangKhach.Dong san(int trangThai, long soDon, String tongTien) {
        return new TinhMuaHangKhach.Dong(trangThai, true, soDon, new BigDecimal(tongTien));
    }

    private static NguoiDungAuthInfo nguoiDung(int id, Set<String> vaiTro, Integer... khoIds) {
        List<PhanQuyenNguoiDungKhoDto> quyenKho = new ArrayList<>();
        for (Integer khoId : khoIds) {
            quyenKho.add(PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(khoId).build()).build());
        }
        return NguoiDungAuthInfo.builder().id(id).vaiTro(vaiTro).phanQuyenNguoiDungKhos(quyenKho).build();
    }

    // ───────────────────────── Quy tắc tính ─────────────────────────

    @Test
    void tongHop_khongTinhNhapVaoSoDon_khongTinhHuyHoanTraVaoChiTieu() {
        List<TinhMuaHangKhach.Dong> theoTrangThai = List.of(
                so(ITrangThaiDonBanHang.NHAP, 1, "12600000"),
                so(ITrangThaiDonBanHang.CHO_NHAT_HANG, 1, "18400000"),
                so(ITrangThaiDonBanHang.DA_DONG_GOI, 1, "2350000"),
                so(ITrangThaiDonBanHang.DA_XUAT_TOAN_BO, 1, "24750000"),
                so(ITrangThaiDonBanHang.HOAN_THANH, 7, "114300000"),
                so(ITrangThaiDonBanHang.BI_HOAN_TRA, 1, "1890000"),
                so(ITrangThaiDonBanHang.DA_HUY, 1, "9800000"));

        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(theoTrangThai, null, null);

        assertEquals(12, kq.getSoDonDat(), "13 đơn trừ 1 nháp");
        assertEquals(10, kq.getSoDonTinhChiTieu(), "đơn đã đặt trừ 1 hủy và 1 hoàn trả");
        assertEquals(1, kq.getSoDonHuy());
        assertEquals(1, kq.getSoDonHoanTra());
        assertEquals(1, kq.getSoDonNhap());
        assertEquals(4, kq.getSoDonDangXuLy(), "nháp + chờ nhặt + chờ xuất kho + đã xuất kho");
        assertEquals(0, new BigDecimal("159800000").compareTo(kq.getTongChiTieu()));
        assertEquals(0, new BigDecimal("15980000").compareTo(kq.getTrungBinhMoiDon()));
        assertNull(kq.getDonGanNhat());
    }

    @Test
    void tongHop_trungBinhLamTronDenDong() {
        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(
                List.of(so(ITrangThaiDonBanHang.HOAN_THANH, 3, "100000")), null, null);

        assertEquals(0, new BigDecimal("33333").compareTo(kq.getTrungBinhMoiDon()));
        assertEquals(0, kq.getTrungBinhMoiDon().scale());
    }

    @Test
    void tongHop_khachChuaCoDon_traSoKhongVaTrungBinhNull() {
        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(List.of(), null, null);

        assertEquals(0, kq.getSoDonDat());
        assertEquals(0, kq.getSoDonTinhChiTieu());
        assertEquals(0, BigDecimal.ZERO.compareTo(kq.getTongChiTieu()));
        assertNull(kq.getTrungBinhMoiDon());
    }

    @Test
    void tongHop_chiCoDonNhap_chuaTinhLaDaDat() {
        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(
                List.of(so(ITrangThaiDonBanHang.NHAP, 2, "5000000")), null, null);

        assertEquals(0, kq.getSoDonDat());
        assertEquals(2, kq.getSoDonNhap());
        assertEquals(2, kq.getSoDonDangXuLy());
        assertEquals(0, BigDecimal.ZERO.compareTo(kq.getTongChiTieu()));
        assertNull(kq.getTrungBinhMoiDon());
    }

    @Test
    void tongHop_chiCoDonHuy_daDatNhungKhongCoChiTieu() {
        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(
                List.of(so(ITrangThaiDonBanHang.DA_HUY, 2, "5000000")), null, null);

        assertEquals(2, kq.getSoDonDat());
        assertEquals(0, kq.getSoDonTinhChiTieu());
        assertEquals(0, kq.getSoDonDangXuLy());
        assertNull(kq.getTrungBinhMoiDon());
    }

    @Test
    void tongHop_giuDonGanNhat() {
        TongQuanMuaHangKhachDto.DonGanNhat gan = TongQuanMuaHangKhachDto.DonGanNhat.builder()
                .id(9).soDonHang("SO202610162").ngayDatHang(Instant.parse("2026-10-16T03:15:00Z")).build();

        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(
                List.of(so(ITrangThaiDonBanHang.CHO_NHAT_HANG, 1, "18400000")), null, gan);

        assertSame(gan, kq.getDonGanNhat());
    }

    @Test
    void tongHop_donSanChoXuLyLuuNhap_vanLaDonDaDatVaTinhChiTieu() {
        // Shopee chờ giao / TikTok mới về đều lưu trạng thái 0; đơn nháp tạo tay thì không tính
        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(List.of(
                san(ITrangThaiDonBanHang.NHAP, 2, "578000"),
                so(ITrangThaiDonBanHang.NHAP, 1, "900000"),
                san(ITrangThaiDonBanHang.HOAN_THANH, 1, "289000")), null, null);

        assertEquals(3, kq.getSoDonDat());
        assertEquals(3, kq.getSoDonTinhChiTieu());
        assertEquals(1, kq.getSoDonNhap(), "chỉ đơn nháp tạo tay");
        assertEquals(3, kq.getSoDonDangXuLy(), "2 đơn sàn chờ xử lý + 1 nháp tạo tay");
        assertEquals(0, new BigDecimal("867000").compareTo(kq.getTongChiTieu()));
    }

    @Test
    void tongHop_donSanChoXuLyBiHuy_khongTinhChiTieu() {
        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(List.of(
                san(ITrangThaiDonBanHang.DA_HUY, 1, "199000")), null, null);

        assertEquals(1, kq.getSoDonDat());
        assertEquals(1, kq.getSoDonHuy());
        assertEquals(0, kq.getSoDonNhap());
        assertEquals(0, BigDecimal.ZERO.compareTo(kq.getTongChiTieu()));
    }

    @Test
    void tongHop_truTienTraHang_trungBinhTinhTrenTongDaTru() {
        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(
                List.of(so(ITrangThaiDonBanHang.HOAN_THANH, 3, "1870000")), new BigDecimal("250000"), null);

        assertEquals(0, new BigDecimal("1620000").compareTo(kq.getTongChiTieu()));
        assertEquals(0, new BigDecimal("250000").compareTo(kq.getTienTraHang()));
        assertEquals(0, new BigDecimal("540000").compareTo(kq.getTrungBinhMoiDon()));
        assertEquals(3, kq.getSoDonTinhChiTieu(), "trả một phần không bớt số đơn");
    }

    @Test
    void tongHop_tienTraHangVuotTong_khongAm() {
        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(
                List.of(so(ITrangThaiDonBanHang.HOAN_THANH, 1, "100000")), new BigDecimal("150000"), null);

        assertEquals(0, BigDecimal.ZERO.compareTo(kq.getTongChiTieu()));
        assertEquals(0, BigDecimal.ZERO.compareTo(kq.getTrungBinhMoiDon()));
    }

    @Test
    void tongHop_trangThaiNullKhongKenh_laNhap() {
        TongQuanMuaHangKhachDto kq = DonBanHangService.tongHopMuaHang(List.of(
                new TinhMuaHangKhach.Dong(null, false, 1, new BigDecimal("50000")),
                new TinhMuaHangKhach.Dong(null, true, 1, new BigDecimal("70000"))), null, null);

        assertEquals(1, kq.getSoDonNhap());
        assertEquals(1, kq.getSoDonDat(), "trạng thái trống nhưng có kênh: đơn sàn chờ xử lý");
        assertEquals(0, new BigDecimal("70000").compareTo(kq.getTongChiTieu()));
    }

    // ───────────────────────── Phạm vi theo vai trò ─────────────────────────

    @Test
    void phamVi_quanTriVien_khongThemDieuKien() {
        NguoiDungAuthInfo admin = nguoiDung(1, Set.of(IRoleType.quan_tri_vien, IRoleType.nhan_vien_ban_hang));
        assertTrue(service.dieuKienPhamViTheoVaiTro(admin).isEmpty());
    }

    @Test
    void phamVi_vaiTroKho_chiDonCuaKhoPhuTrach() {
        NguoiDungAuthInfo nvk = nguoiDung(5, Set.of(IRoleType.nhan_vien_kho), 2, 3);

        List<FilterCriteria> dk = service.dieuKienPhamViTheoVaiTro(nvk);

        assertEquals(1, dk.size());
        assertEquals("khoXuat.id", dk.get(0).getFieldName());
        assertEquals(FilterOperation.IN, dk.get(0).getOperation());
        assertEquals(List.of(2, 3), dk.get(0).getValue());
    }

    @Test
    void phamVi_vaiTroKhoChuaGanKho_khongThayDonNao() {
        NguoiDungAuthInfo qlk = nguoiDung(6, Set.of(IRoleType.quan_ly_kho));

        List<FilterCriteria> dk = service.dieuKienPhamViTheoVaiTro(qlk);

        assertEquals(1, dk.size());
        assertEquals("id", dk.get(0).getFieldName());
        assertEquals(-1, dk.get(0).getValue());
    }

    @Test
    void phamVi_vaiTroKhoVaBanHang_uuTienPhamViKho() {
        NguoiDungAuthInfo user = nguoiDung(7, Set.of(IRoleType.quan_ly_kho, IRoleType.nhan_vien_ban_hang), 4);

        List<FilterCriteria> dk = service.dieuKienPhamViTheoVaiTro(user);

        assertEquals(1, dk.size());
        assertEquals("khoXuat.id", dk.get(0).getFieldName());
    }

    @Test
    void phamVi_chiBanHang_donMinhTao() {
        NguoiDungAuthInfo nvbh = nguoiDung(8, Set.of(IRoleType.nhan_vien_ban_hang));

        List<FilterCriteria> dk = service.dieuKienPhamViTheoVaiTro(nvbh);

        assertEquals(1, dk.size());
        assertEquals("nguoiTao.id", dk.get(0).getFieldName());
        assertEquals(FilterOperation.EQUALS, dk.get(0).getOperation());
        assertEquals(8, dk.get(0).getValue());
    }

    @Test
    void phamVi_khongCoVaiTro_khongNem() {
        NguoiDungAuthInfo user = NguoiDungAuthInfo.builder().id(9).build();
        assertTrue(service.dieuKienPhamViTheoVaiTro(user).isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void filter_themPhamViVaoBoLocCuaManHinh_giuNguyenBoLocCu() {
        SecurityContextHolder.setUser(nguoiDung(8, Set.of(IRoleType.nhan_vien_ban_hang)));
        when(donBanHangRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<DonBanHang>(List.of()));
        FilterCriteria cuaManHinh = FilterCriteria.builder()
                .fieldName("khachHang.id").operation(FilterOperation.EQUALS).value(16).build();
        BaseFilterRequest request = new BaseFilterRequest();
        request.setFilters(List.of(cuaManHinh));
        request.setSorts(List.of());
        request.setPage(0);
        request.setSize(20);

        Page<DonBanHang> page = service.filter(request);

        assertNotNull(page);
        assertEquals(2, request.getFilters().size());
        assertSame(cuaManHinh, request.getFilters().get(0));
        assertEquals("nguoiTao.id", request.getFilters().get(1).getFieldName());
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(donBanHangRepository).findAll(any(Specification.class), pageable.capture());
        assertEquals(20, pageable.getValue().getPageSize());
    }

    @Test
    @SuppressWarnings("unchecked")
    void filter_quanTriVien_khongDoiBoLoc() {
        SecurityContextHolder.setUser(nguoiDung(1, Set.of(IRoleType.quan_tri_vien)));
        when(donBanHangRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<DonBanHang>(List.of()));
        List<FilterCriteria> boLoc = List.of(FilterCriteria.builder()
                .fieldName("khachHang.id").operation(FilterOperation.EQUALS).value(16).build());
        BaseFilterRequest request = new BaseFilterRequest();
        request.setFilters(boLoc);
        request.setSorts(List.of());

        service.filter(request);

        assertSame(boLoc, request.getFilters());
    }
}
