package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.request.ChiTietKiemKeUpdate;
import com.dev.backend.dto.request.inbound.KhuVucKhoRequest;
import com.dev.backend.dto.request.PhieuKiemKeCreate;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

/**
 * Đợt 2: chứng từ kho chỉ thao tác được từ đúng kho — phiếu xuất (H-2), kiểm kê (H-3), chuyển kho (H-4), vị trí kho (M-8).
 * Ghi: chứng từ thuộc kho đang chọn. Xem: người dùng được phân kho của chứng từ. Phiếu chuyển: kho nguồn và kho đích.
 * Kho A = 1, B = 2, C = 3.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChungTuThuocKhoTest {

    private static final int A = 1, B = 2, C = 3;
    private static final int PHIEU_ID = 50;

    @Mock private PhieuXuatKhoRepository pxRepo;
    @Mock private ChiTietPhieuXuatKhoRepository ctPxRepo;
    @Mock private TonKhoTheoLoRepository tonRepo;
    @Mock private NguoiDungRepository ndRepo;
    @Mock private PhieuNhapKhoRepository pnRepo;
    @Mock private DotKiemKeRepository dotRepo;
    @Mock private ChiTietKiemKeRepository ctKkRepo;
    @Mock private KhoRepository khoRepo;
    @Mock private LichSuGiaoDichKhoService lichSuService;
    @Mock private KhuVucKhoRepository kvRepo;
    @Mock private ViTriKhoRepository vtRepo;
    @Mock private TonKhoViTriRepository tkvtRepo;
    @Mock private MatBangKhoRepository mbRepo;
    @Mock private ChiTietPhieuNhapKhoRepository ctPnRepo;
    @Mock private LoHangRepository loRepo;

    private PhieuXuatKhoService px;
    private PhieuNhapKhoService pn;
    private PhieuKiemKeService kk;
    private ViTriKhoServiceImpl vt;

    @BeforeEach
    void setUp() {
        px = new PhieuXuatKhoService(pxRepo);
        ReflectionTestUtils.setField(px, "chiTietPhieuXuatKhoRepository", ctPxRepo);
        ReflectionTestUtils.setField(px, "tonKhoTheoLoRepository", tonRepo);
        ReflectionTestUtils.setField(px, "nguoiDungRepository", ndRepo);

        pn = new PhieuNhapKhoService(pnRepo);
        ReflectionTestUtils.setField(pn, "phieuXuatKhoRepository", pxRepo);
        ReflectionTestUtils.setField(pn, "nguoiDungRepository", ndRepo);

        kk = new PhieuKiemKeService(dotRepo, ctKkRepo, tonRepo, khoRepo, ndRepo, lichSuService);
        vt = new ViTriKhoServiceImpl(khoRepo, kvRepo, vtRepo, tkvtRepo, mbRepo, ctPnRepo, loRepo, new ObjectMapper());

        for (int id : new int[]{A, B, C}) {
            when(khoRepo.findById(id)).thenReturn(Optional.of(kho(id)));
        }
        when(pxRepo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    // ── Dữ liệu và tiện ích ──

    private static Kho kho(int id) {
        return Kho.builder().id(id).tenKho("Kho " + (char) ('A' + id - 1)).build();
    }

    private static void dangNhap(String vaiTro, Integer khoDangChon, Integer... khoDuocPhan) {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of(vaiTro))
                .phanQuyenNguoiDungKhos(Arrays.stream(khoDuocPhan)
                        .map(id -> PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(id).build()).build())
                        .toList())
                .build());
        if (khoDangChon != null) SecurityContextHolder.setKhoId(khoDangChon);
    }

    private static void biChan(Executable e) {
        CommonException ex = assertThrows(CommonException.class, e);
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus(), ex.getMessage());
    }

    /** Qua được bước kiểm kho: không 403. Phần sau của hàm (không dựng đủ dữ liệu) ném lỗi khác thì bỏ qua. */
    private static void quaCuaKho(Executable e) {
        try {
            e.execute();
        } catch (CommonException ex) {
            assertNotEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus(), "bị chặn nhầm: " + ex.getMessage());
        } catch (AccessDeniedException ex) {
            fail("bị chặn nhầm: " + ex.getMessage());
        } catch (Throwable ignored) {
            // đã qua bước kiểm kho
        }
    }

    private PhieuXuatKho phieuBan(int khoId, int trangThai) {
        PhieuXuatKho p = PhieuXuatKho.builder().id(PHIEU_ID).soPhieuXuat("PX-" + khoId).loaiXuat("ban_hang")
                .kho(kho(khoId)).trangThai(trangThai).ngayTao(Instant.now()).build();
        when(pxRepo.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        return p;
    }

    /** Yêu cầu chuyển kho: kho nguồn (kho) → kho đích (khoChuyenDen). */
    private PhieuXuatKho phieuChuyen(int nguon, int dich, int trangThai) {
        PhieuXuatKho p = PhieuXuatKho.builder().id(PHIEU_ID).soPhieuXuat("PX-TRF-1").loaiXuat("khac")
                .kho(kho(nguon)).khoChuyenDen(kho(dich)).trangThai(trangThai).ngayTao(Instant.now()).build();
        when(pxRepo.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(pxRepo.findByIdForUpdate(PHIEU_ID)).thenReturn(Optional.of(p)); // hủy / tạo phiếu xuất, phiếu nhập khóa dòng
        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNull(PHIEU_ID)).thenReturn(List.of(new ChiTietPhieuXuatKho()));
        return p;
    }

    // ═════════════ Phiếu xuất (H-2) ═════════════

    @Test
    void phieuXuat_xacNhanXuat_tuKhoKhac_biChan_khongGhiGi() {
        dangNhap(IRoleType.quan_ly_kho, A, A, B); // được phân cả B nhưng đang chọn A
        phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);

        biChan(() -> px.xacNhanXuatKho(PHIEU_ID, null, 7));
        verify(pxRepo, never()).save(any());
        verify(tonRepo, never()).save(any());
    }

    @Test
    void phieuXuat_xacNhanXuat_dungKho_quaCuaKho() {
        dangNhap(IRoleType.quan_ly_kho, B, B);
        phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);
        quaCuaKho(() -> px.xacNhanXuatKho(PHIEU_ID, null, 7));
    }

    @Test
    void phieuXuat_huy_tuKhoKhac_biChan_trangThaiGiuNguyen() {
        dangNhap(IRoleType.quan_ly_kho, A, A);
        PhieuXuatKho p = phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);

        biChan(() -> px.cancel(PHIEU_ID));
        assertEquals(ITrangThaiPhieuXuat.CHO_XUAT, p.getTrangThai());
        verify(pxRepo, never()).save(any());
    }

    @Test
    void phieuXuat_huy_dungKho_veDaHuy() {
        dangNhap(IRoleType.quan_ly_kho, B, B);
        PhieuXuatKho p = phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);

        px.cancel(PHIEU_ID);
        assertEquals(ITrangThaiPhieuXuat.DA_HUY, p.getTrangThai());
    }

    @Test
    void phieuXuat_thuHoiTheoDonBiHuy_khongKiemKhoDangChon() {
        // nhân viên bán hàng hủy đơn khi đang chọn cửa hàng A, phiếu xuất của đơn nằm ở kho B: vẫn phải thu hồi được
        dangNhap(IRoleType.nhan_vien_ban_hang, A, A);
        PhieuXuatKho p = PhieuXuatKho.builder().id(PHIEU_ID).soPhieuXuat("PX-B").loaiXuat("ban_hang").kho(kho(B))
                .trangThai(ITrangThaiPhieuXuat.CHO_XUAT).build();
        when(pxRepo.findByDonBanHangId(99)).thenReturn(List.of(p));

        assertEquals(1, px.huyPhieuXuatNhapTheoDon(99, "Tự động thu hồi do đơn bị hủy"));
        assertEquals(ITrangThaiPhieuXuat.DA_HUY, p.getTrangThai());
    }

    @Test
    void phieuXuat_chonLo_tuKhoKhac_biChan() {
        dangNhap(IRoleType.quan_ly_kho, A, A);
        phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);
        biChan(() -> px.pickLoHang(PHIEU_ID, null));
        verify(ctPxRepo, never()).save(any());
    }

    @Test
    void phieuXuat_xem_duocPhanKhoCuaPhieu_khongCanDangChon() {
        dangNhap(IRoleType.nhan_vien_kho, A, A, B);
        phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);
        assertEquals(PHIEU_ID, px.layPhieuDuocXem(PHIEU_ID).getId());
        quaCuaKho(() -> px.getDetail(PHIEU_ID));
    }

    @Test
    void phieuXuat_xem_khongDuocPhanKho_biChan() {
        dangNhap(IRoleType.nhan_vien_kho, A, A);
        PhieuXuatKho p = phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);
        when(pxRepo.findBySoPhieuXuat("PX-2")).thenReturn(Optional.of(p));

        biChan(() -> px.layPhieuDuocXem(PHIEU_ID));
        biChan(() -> px.getDetail(PHIEU_ID));
        biChan(() -> px.getAvailableLots(PHIEU_ID, 1));
        biChan(() -> px.getPickedLots(PHIEU_ID, 200));
        biChan(() -> px.scanToPack("PX-2"));
    }

    @Test
    void phieuXuat_xemLoDaChon_dongCuaPhieuKhac_baoLoi() {
        dangNhap(IRoleType.nhan_vien_kho, B, B);
        phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);
        PhieuXuatKho phieuKhac = PhieuXuatKho.builder().id(999).build();
        when(ctPxRepo.findById(200)).thenReturn(Optional.of(ChiTietPhieuXuatKho.builder().id(200).phieuXuatKho(phieuKhac)
                .bienTheSanPham(BienTheSanPham.builder().id(1).build()).build()));

        CommonException ex = assertThrows(CommonException.class, () -> px.getPickedLots(PHIEU_ID, 200));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(ctPxRepo, never()).findPickedLots(anyInt(), anyInt());
    }

    @Test
    void phieuXuat_xemChoBanHang_vaiTroKhoKhongDuocPhan_biChan_banHangGiuQuyTacCu() {
        NguoiDung nguoiTao = NguoiDung.builder().id(7).build();
        PhieuXuatKho p = phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);
        p.setDonBanHang(DonBanHang.builder().id(99).soDonHang("DH-1").nguoiTao(nguoiTao).build());

        dangNhap(IRoleType.nhan_vien_kho, A, A);
        biChan(() -> px.viewForSales(PHIEU_ID));

        dangNhap(IRoleType.nhan_vien_ban_hang, A, A); // không được phân kho B nhưng là người tạo đơn
        assertEquals("DH-1", px.viewForSales(PHIEU_ID).getSoDonHang());
    }

    @Test
    void quanTriVien_khongChonKho_vanThaoTacDuoc() {
        dangNhap(IRoleType.quan_tri_vien, null);
        PhieuXuatKho p = phieuBan(B, ITrangThaiPhieuXuat.CHO_XUAT);
        px.cancel(PHIEU_ID);
        assertEquals(ITrangThaiPhieuXuat.DA_HUY, p.getTrangThai());
    }

    // ═════════════ Chuyển kho (H-4) — nguồn A, đích B ═════════════
    // Phạm vi kho của phiếu chuyển (xem, duyệt, hủy, nhặt, xác nhận xuất, nhận, nhập hoàn trả) kiểm ở
    // PhieuChuyenKhoServiceTest. Ở đây chỉ còn phiếu xuất con / dòng phiếu chuyển cũ đi nhầm qua màn phiếu xuất.

    @Test
    void phieuXuat_huyQuaManPhieuXuat_phieuXuatConCuaPhieuChuyen_baoLoi_trangThaiGiuNguyen() {
        // BA, A5: phiếu xuất con hủy cùng phiếu chuyển; hủy riêng thì phiếu chuyển Đã duyệt mất phiếu xuất
        PhieuChuyenKho pck = PhieuChuyenKho.builder().id(PHIEU_ID).soPhieuChuyen("PX-TRF-1").khoXuat(kho(A)).khoNhap(kho(B))
                .trangThai("DA_DUYET").build();
        PhieuXuatKho con = PhieuXuatKho.builder().id(60).soPhieuXuat("PX-CK-1").loaiXuat("chuyen_kho").kho(kho(A))
                .khoChuyenDen(kho(B)).phieuChuyenKho(pck).trangThai(ITrangThaiPhieuXuat.NHAP).build();
        when(pxRepo.findById(60)).thenReturn(Optional.of(con));
        dangNhap(IRoleType.quan_ly_kho, A, A);

        CommonException ex = assertThrows(CommonException.class, () -> px.cancel(60));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertEquals(ITrangThaiPhieuXuat.NHAP, con.getTrangThai());
        verify(pxRepo, never()).save(any());
    }

    @Test
    void phieuXuat_phieuXuatConCuaPhieuChuyen_tuKhoNhan_biChan() {
        PhieuChuyenKho pck = PhieuChuyenKho.builder().id(PHIEU_ID).soPhieuChuyen("PX-TRF-1").khoXuat(kho(A)).khoNhap(kho(B))
                .trangThai("DA_DUYET").build();
        PhieuXuatKho con = PhieuXuatKho.builder().id(60).soPhieuXuat("PX-CK-1").loaiXuat("chuyen_kho").kho(kho(A))
                .khoChuyenDen(kho(B)).phieuChuyenKho(pck).trangThai(ITrangThaiPhieuXuat.NHAP).build();
        when(pxRepo.findById(60)).thenReturn(Optional.of(con));
        dangNhap(IRoleType.quan_ly_kho, B, A, B); // được phân cả kho nguồn nhưng đang chọn kho nhận

        biChan(() -> px.xuatPhieuXuatCon(60, 7));
        biChan(() -> px.pickLoHang(60, null));
        biChan(() -> px.cancel(60));
        // hai bên của phiếu chuyển đều xem được phiếu xuất con
        assertEquals(60, px.layPhieuDuocXem(60).getId());
        verify(tonRepo, never()).save(any());
    }

    @Test
    void phieuXuat_huyQuaManPhieuXuat_phieuChuyenKho_baoLoi_trangThaiGiuNguyen() {
        // phiếu chuyển đã hoàn tất (5): hủy qua màn phiếu xuất từng đưa về 4 rồi nhập hoàn trả → hàng nhân đôi
        PhieuXuatKho p = phieuChuyen(A, B, 5);
        dangNhap(IRoleType.quan_ly_kho, A, A);

        CommonException ex = assertThrows(CommonException.class, () -> px.cancel(PHIEU_ID));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertEquals(5, p.getTrangThai());
        verify(pxRepo, never()).save(any());
    }

    @Test
    void phieuXuat_quetDonChuaCoPhieu_cuaKhoKhac_khongLoTrangThaiDon() {
        DonBanHangRepository donRepo = mock(DonBanHangRepository.class);
        ReflectionTestUtils.setField(px, "donBanHangRepository", donRepo);
        when(pxRepo.findBySoPhieuXuat("DH-9")).thenReturn(Optional.empty());
        when(donRepo.findBySoDonHang("DH-9")).thenReturn(Optional.of(
                DonBanHang.builder().id(9).soDonHang("DH-9").khoXuat(kho(B)).trangThai(4).build()));
        when(pxRepo.findByDonBanHangId(9)).thenReturn(List.of());
        dangNhap(IRoleType.nhan_vien_kho, A, A);

        biChan(() -> px.scanToPack("DH-9"));
    }

    @Test
    void chuyenKho_phieuNhapCuaPhieuChuyen_khoKhac403_dungKhoVanKhongNhapQuaManPhieuNhap() {
        PhieuNhapKho phieuNhap = PhieuNhapKho.builder().id(70).soPhieuNhap("PN-TRF-1").kho(kho(B)).trangThai(0)
                .phieuChuyenKho(PhieuChuyenKho.builder().id(PHIEU_ID).khoXuat(kho(A)).khoNhap(kho(B)).build()).build();
        when(pnRepo.findById(70)).thenReturn(Optional.of(phieuNhap));
        when(pnRepo.khoaTheoId(70)).thenReturn(Optional.of(phieuNhap)); // nhập kho khóa dòng phiếu nhập

        dangNhap(IRoleType.quan_ly_kho, A, A, B);
        biChan(() -> pn.completePhieuNhap(70, 7));

        dangNhap(IRoleType.quan_ly_kho, B, B);
        CommonException ex = assertThrows(CommonException.class, () -> pn.completePhieuNhap(70, 7));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus(), ex.getMessage());
        assertEquals(0, phieuNhap.getTrangThai());
        verify(tonRepo, never()).save(any());
    }

    // ═════════════ Kiểm kê (H-3) — đợt 10 của kho A, dòng 100 (lô 5, hệ thống 20) ═════════════

    private TonKhoTheoLo kichBanKiemKe() {
        DotKiemKe dot = DotKiemKe.builder().id(10).maDotKiemKe("KK1").trangThai((byte) 0).kho(kho(A)).build();
        ChiTietKiemKe ct = ChiTietKiemKe.builder().id(100).dotKiemKeId(10).loHang(LoHang.builder().id(5).build())
                .soLuongHeThong(new BigDecimal("20")).build();
        TonKhoTheoLo tonA = TonKhoTheoLo.builder().kho(kho(A)).soLuongTon(new BigDecimal("20")).build();
        when(dotRepo.findById(10)).thenReturn(Optional.of(dot));
        when(dotRepo.khoaTheoId(10)).thenReturn(Optional.of(dot)); // hoàn thành khóa dòng đợt
        when(ctKkRepo.findById(100)).thenReturn(Optional.of(ct));
        when(tonRepo.findByKho_IdAndLoHang_Id(A, 5)).thenReturn(Optional.of(tonA));
        when(ndRepo.findByEmail(any())).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        org.springframework.security.core.context.SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken("nv@kho.test", null, List.of()));
        return tonA;
    }

    private static List<ChiTietKiemKeUpdate> dem(Integer soLuong) {
        return List.of(ChiTietKiemKeUpdate.builder().chiTietId(100).soLuongThucTe(soLuong).build());
    }

    @Test
    void kiemKe_hoanThanh_tuKhoKhac_biChan_tonGiuNguyen() {
        TonKhoTheoLo tonA = kichBanKiemKe();
        dangNhap(IRoleType.nhan_vien_kho, B, B);

        biChan(() -> kk.complete(10, A, dem(0)));
        assertEquals(new BigDecimal("20"), tonA.getSoLuongTon());
        verify(tonRepo, never()).save(any());
    }

    @Test
    void kiemKe_hoanThanh_khoIdLechKhoCuaDot_baoLoi_khongGhiKhoKhac() {
        kichBanKiemKe();
        TonKhoTheoLo tonB = TonKhoTheoLo.builder().kho(kho(B)).soLuongTon(new BigDecimal("20")).build();
        when(tonRepo.findByKho_IdAndLoHang_Id(B, 5)).thenReturn(Optional.of(tonB));
        dangNhap(IRoleType.nhan_vien_kho, A, A);

        CommonException ex = assertThrows(CommonException.class, () -> kk.complete(10, B, dem(0)));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertEquals(new BigDecimal("20"), tonB.getSoLuongTon());
        verify(tonRepo, never()).save(any());
    }

    @Test
    void kiemKe_hoanThanh_dongCuaDotKhac_baoLoi() {
        kichBanKiemKe();
        when(ctKkRepo.findById(100)).thenReturn(Optional.of(ChiTietKiemKe.builder().id(100).dotKiemKeId(11)
                .loHang(LoHang.builder().id(5).build()).build()));
        dangNhap(IRoleType.nhan_vien_kho, A, A);

        assertThrows(CommonException.class, () -> kk.complete(10, A, dem(0)));
        verify(tonRepo, never()).save(any());
    }

    @Test
    void kiemKe_hoanThanh_soLuongAmHoacTrong_baoLoi() {
        TonKhoTheoLo tonA = kichBanKiemKe();
        dangNhap(IRoleType.nhan_vien_kho, A, A);

        assertThrows(CommonException.class, () -> kk.complete(10, A, dem(-50)));
        assertThrows(CommonException.class, () -> kk.complete(10, A, dem(null)));
        assertEquals(new BigDecimal("20"), tonA.getSoLuongTon());
    }

    @Test
    void kiemKe_hoanThanh_dongGuiTrungHoacThieu_baoLoi() {
        TonKhoTheoLo tonA = kichBanKiemKe();
        dangNhap(IRoleType.nhan_vien_kho, A, A);
        ChiTietKiemKeUpdate dong = ChiTietKiemKeUpdate.builder().chiTietId(100).soLuongThucTe(5).build();

        assertThrows(CommonException.class, () -> kk.complete(10, A, List.of(dong, dong)));
        assertThrows(CommonException.class, () -> kk.complete(10, A, Arrays.asList(dong, null)));
        assertThrows(CommonException.class, () -> kk.complete(10, A,
                List.of(ChiTietKiemKeUpdate.builder().soLuongThucTe(5).build())));
        assertEquals(new BigDecimal("20"), tonA.getSoLuongTon());
        verify(tonRepo, never()).save(any());
    }

    @Test
    void kiemKe_hoanThanh_hopLe_ghiTonVaoKhoCuaDot() {
        TonKhoTheoLo tonA = kichBanKiemKe();
        dangNhap(IRoleType.nhan_vien_kho, A, A);

        kk.complete(10, A, dem(15));
        assertEquals(new BigDecimal("15"), tonA.getSoLuongTon());
        verify(tonRepo).findByKho_IdAndLoHang_Id(A, 5);
        // đọc đợt bằng khóa dòng: hai người bấm Hoàn thành cùng lúc thì người sau thấy đợt đã hoàn thành
        verify(dotRepo).khoaTheoId(10);
        verify(dotRepo, never()).findById(10);
    }

    @Test
    void kiemKe_hoanThanhLanHai_sauKhiDotDaXong_baoLoi_khongGhiTonLanNua() {
        TonKhoTheoLo tonA = kichBanKiemKe();
        dangNhap(IRoleType.nhan_vien_kho, A, A);

        kk.complete(10, A, dem(15));
        // người thứ hai đọc đợt lúc người đầu chưa commit: bản không khóa vẫn "đang kiểm kê", bản khóa dòng (chờ người
        // đầu commit) là đã hoàn thành. Phải đọc bằng khóa dòng thì mới bị chặn.
        when(dotRepo.findById(10)).thenReturn(Optional.of(DotKiemKe.builder().id(10).maDotKiemKe("KK1")
                .trangThai((byte) 0).kho(kho(A)).build()));
        assertThrows(RuntimeException.class, () -> kk.complete(10, A, dem(12)));
        assertEquals(new BigDecimal("15"), tonA.getSoLuongTon());
    }

    @Test
    void kiemKe_xem_khoKhongDuocPhan_biChan_danhSachChiDotCuaKhoDuocPhan() {
        kichBanKiemKe(); // đợt 10 của kho A
        DotKiemKe dotB = DotKiemKe.builder().id(11).maDotKiemKe("KK2").trangThai((byte) 0).kho(kho(B)).build();
        when(dotRepo.findAllWithDetails()).thenReturn(List.of(
                DotKiemKe.builder().id(10).maDotKiemKe("KK1").trangThai((byte) 0).kho(kho(A)).build(), dotB));
        when(ctKkRepo.findByDotKiemKeId(10)).thenReturn(List.of());

        dangNhap(IRoleType.nhan_vien_kho, B, B);
        biChan(() -> kk.getChiTiet(10));
        biChan(() -> kk.getById(10));
        assertEquals(List.of(11), kk.getList().stream().map(d -> d.getId()).toList());

        dangNhap(IRoleType.nhan_vien_kho, B, A, B); // được phân kho A: xem được, không cần đang chọn A
        assertEquals(List.of(), kk.getChiTiet(10));
        assertEquals(2, kk.getList().size());
    }

    @Test
    void kiemKe_taoDot_khoTrongBodyKhacKhoDangChon_biChan() {
        kichBanKiemKe();
        dangNhap(IRoleType.quan_ly_kho, A, A, B);
        PhieuKiemKeCreate yeuCau = new PhieuKiemKeCreate();
        yeuCau.setKhoId(B);

        biChan(() -> kk.create(yeuCau));
        verify(dotRepo, never()).save(any());
    }

    // ═════════════ Vị trí kho (M-8) ═════════════

    @Test
    void viTri_suaSoDo_khoTrenDuongDanKhacKhoDangChon_biChan() {
        dangNhap(IRoleType.quan_ly_kho, A, A, B);
        KhuVucKhoRequest kv = new KhuVucKhoRequest();
        kv.setMaKhuVuc("Z1");

        biChan(() -> vt.taoKhuVuc(B, kv));
        biChan(() -> vt.suaKhuVuc(B, 1, kv));
        biChan(() -> vt.xoaKhuVuc(B, 1));
        biChan(() -> vt.taoViTri(B, null));
        biChan(() -> vt.suaViTri(B, 1, null));
        biChan(() -> vt.xoaViTri(B, 1));
        biChan(() -> vt.luuMatBang(B, Map.of()));
        verify(kvRepo, never()).save(any());
        verify(vtRepo, never()).save(any());
        verify(mbRepo, never()).save(any());
    }

    @Test
    void viTri_xemSoDo_duocPhanKho_khongCanDangChon_khongDuocPhanBiChan() {
        when(kvRepo.findByKho_IdOrderByMaKhuVucAsc(B)).thenReturn(List.of());
        dangNhap(IRoleType.nhan_vien_kho, A, A, B); // màn kiểm đếm lô đọc kệ của kho phiếu nhập B
        assertEquals(List.of(), vt.dsKhuVuc(B));
        assertNull(vt.layMatBang(B));

        dangNhap(IRoleType.nhan_vien_kho, A, A);
        biChan(() -> vt.dsKhuVuc(B));
        biChan(() -> vt.layMatBang(B));
        biChan(() -> vt.loTrenKe(B, 1));
    }

    @Test
    void viTri_loTrenKe_keCuaKhoKhac_baoLoi() {
        ViTriKho keCuaB = ViTriKho.builder().id(9).khuVucKho(KhuVucKho.builder().id(1).kho(kho(B)).build()).build();
        when(vtRepo.findById(9)).thenReturn(Optional.of(keCuaB));
        dangNhap(IRoleType.nhan_vien_kho, A, A);

        CommonException ex = assertThrows(CommonException.class, () -> vt.loTrenKe(A, 9));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(tkvtRepo, never()).findActiveLotsByViTriId(anyInt());
    }
}
