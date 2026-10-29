package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Phiếu xuất con PX-CK và phiếu nhập của phiếu chuyển kho chỉ đi qua màn Phiếu chuyển kho (đặc tả BA, BR-TRF-02):
 * màn phiếu xuất / phiếu nhập không xuất, không hủy, không nhập được chúng; xuất phiếu con chỉ khi phiếu chuyển còn
 * Đã duyệt và khóa dòng tồn kho nguồn cùng dòng trung chuyển. Nhận hàng, nhập hoàn trả: PhieuChuyenKhoServiceTest.
 * Kho nguồn A = 1, kho đích B = 2, kho trung chuyển = 99. Phiếu chuyển id 50, phiếu xuất con id 60, lô 5, 10 cái.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChuyenKhoNhanHangTest {

    private static final int A = 1, B = 2, TRANSIT = 99;
    private static final int PCK = 50, PX = 60, PN = 70, LO = 5;

    @Mock private PhieuNhapKhoRepository pnRepo;
    @Mock private PhieuXuatKhoRepository pxRepo;
    @Mock private ChiTietPhieuXuatKhoRepository ctPxRepo;
    @Mock private TonKhoTheoLoRepository tonRepo;
    @Mock private NguoiDungRepository ndRepo;
    @Mock private LichSuGiaoDichKhoRepository lichSuRepo;
    @Mock private SanPhamQuanAoService sanPhamService;
    @Mock private EntityManager em;
    @Mock private TypedQuery<Kho> khoQuery;

    private PhieuNhapKhoService pn;
    private PhieuXuatKhoService px;
    private BienTheSanPham bienThe;
    private LoHang lo;

    @BeforeEach
    void setUp() {
        pn = new PhieuNhapKhoService(pnRepo);
        ReflectionTestUtils.setField(pn, "entityManager", em);
        ReflectionTestUtils.setField(pn, "tonKhoTheoLoRepository", tonRepo);

        px = new PhieuXuatKhoService(pxRepo);
        ReflectionTestUtils.setField(px, "entityManager", em);
        ReflectionTestUtils.setField(px, "chiTietPhieuXuatKhoRepository", ctPxRepo);
        ReflectionTestUtils.setField(px, "tonKhoTheoLoRepository", tonRepo);
        ReflectionTestUtils.setField(px, "nguoiDungRepository", ndRepo);
        ReflectionTestUtils.setField(px, "lichSuGiaoDichKhoRepository", lichSuRepo);
        ReflectionTestUtils.setField(px, "sanPhamQuanAoService", sanPhamService);

        when(em.createQuery(contains("KHO_TRANSIT"), eq(Kho.class))).thenReturn(khoQuery);
        when(khoQuery.getSingleResult()).thenReturn(kho(TRANSIT));
        when(ndRepo.findById(any())).thenReturn(Optional.of(NguoiDung.builder().id(7).hoTen("Thủ kho").build()));
        when(pnRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(pxRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(tonRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        bienThe = BienTheSanPham.builder().id(3).maSku("AK-3").sanPham(SanPhamQuanAo.builder().id(4).build()).build();
        lo = LoHang.builder().id(LO).maLo("LO-5").bienTheSanPham(bienThe).giaVon(BigDecimal.TEN).build();
        quanTriVien(); // bỏ qua kiểm kho đang chọn (đã test ở ChungTuThuocKhoTest) để tập trung vào luồng
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    // ── Dữ liệu ──

    private static void quanTriVien() {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of(IRoleType.quan_tri_vien))
                .phanQuyenNguoiDungKhos(List.<PhanQuyenNguoiDungKhoDto>of()).build());
    }

    private static Kho kho(int id) {
        return Kho.builder().id(id).tenKho("Kho " + id).build();
    }

    private static PhieuChuyenKho phieuChuyen(String trangThai) {
        return PhieuChuyenKho.builder().id(PCK).soPhieuChuyen("PX-TRF-1").khoXuat(kho(A)).khoNhap(kho(B))
                .trangThai(trangThai).build();
    }

    private PhieuXuatKho phieuXuatCon(PhieuChuyenKho goc, int trangThai) {
        PhieuXuatKho con = PhieuXuatKho.builder().id(PX).soPhieuXuat("PX-CK-1").loaiXuat("chuyen_kho").kho(kho(A))
                .khoChuyenDen(kho(B)).phieuChuyenKho(goc).trangThai(trangThai).build();
        when(pxRepo.findById(PX)).thenReturn(Optional.of(con));
        return con;
    }

    /** Đã chọn đủ lô: dòng gốc 10, dòng lô 5 là 10. */
    private void daChonLo(PhieuXuatKho con) {
        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNull(PX)).thenReturn(List.of(ChiTietPhieuXuatKho.builder()
                .phieuXuatKho(con).bienTheSanPham(bienThe).soLuongXuat(new BigDecimal("10")).build()));
        when(ctPxRepo.sumSoLuongDaPick(PX, 3)).thenReturn(new BigDecimal("10"));
        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(ChiTietPhieuXuatKho.builder()
                .phieuXuatKho(con).bienTheSanPham(bienThe).loHang(lo).soLuongXuat(new BigDecimal("10")).build()));
    }

    private TonKhoTheoLo ton(int khoId, String soLuong, String daDat) {
        TonKhoTheoLo t = TonKhoTheoLo.builder().kho(kho(khoId)).loHang(lo).soLuongTon(new BigDecimal(soLuong))
                .soLuongDaDat(new BigDecimal(daDat)).build();
        when(tonRepo.findByKho_IdAndLoHang_Id(khoId, LO)).thenReturn(Optional.of(t));
        return t;
    }

    private static void xungDot(Throwable t) {
        assertInstanceOf(CommonException.class, t);
        assertEquals(HttpStatus.CONFLICT, ((CommonException) t).getHttpStatus(), t.getMessage());
    }

    // ═════ Nhập thường không nhận phiếu nhập của phiếu chuyển ═════

    @Test
    void nhapThuong_phieuNhapCuaPhieuChuyen_biChan_khongCongTon() {
        // trước đây cộng kho đích mà không trừ trung chuyển, phiếu chuyển vẫn "Đang chuyển" và còn nhận được lần nữa
        PhieuNhapKho phieu = PhieuNhapKho.builder().id(PN).soPhieuNhap("PN-TRF-1").kho(kho(B))
                .trangThai(TrangThaiPhieuNhap.DRAFT.getValue()).phieuChuyenKho(phieuChuyen(IChuyenKho.DANG_VAN_CHUYEN)).build();
        when(pnRepo.khoaTheoId(PN)).thenReturn(Optional.of(phieu));

        CommonException ex = assertThrows(CommonException.class, () -> pn.completePhieuNhap(PN, 7));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("màn Nhận hàng của phiếu chuyển kho"), ex.getMessage());
        assertEquals(TrangThaiPhieuNhap.DRAFT.getValue(), phieu.getTrangThai());
        verify(tonRepo, never()).save(any());
    }

    // ═════ Xuất phiếu con ═════

    @Test
    void xacNhanXuatTuManPhieuXuat_phieuCon_409_phaiXuatOManPhieuChuyen() {
        PhieuXuatKho con = phieuXuatCon(phieuChuyen(IChuyenKho.DA_DUYET), ITrangThaiPhieuXuat.NHAP);
        daChonLo(con);

        CommonException ex = assertThrows(CommonException.class, () -> px.xacNhanXuatKho(PX, null, 7));
        xungDot(ex);
        assertTrue(ex.getMessage().contains("PX-TRF-1") && ex.getMessage().contains("giấy đi đường"), ex.getMessage());
        assertEquals(ITrangThaiPhieuXuat.NHAP, con.getTrangThai());
        verify(tonRepo, never()).save(any());
    }

    @Test
    void xuatPhieuCon_phieuChuyenDaHuy_409_khongDuaHangVaoTrungChuyen() {
        PhieuChuyenKho goc = phieuChuyen(IChuyenKho.DA_HUY);
        PhieuXuatKho con = phieuXuatCon(goc, ITrangThaiPhieuXuat.NHAP);
        daChonLo(con);

        xungDot(assertThrows(CommonException.class, () -> px.xuatPhieuXuatCon(PX, 7)));
        assertEquals(IChuyenKho.DA_HUY, goc.getTrangThai());
        assertEquals(ITrangThaiPhieuXuat.NHAP, con.getTrangThai());
        verify(tonRepo, never()).save(any());
    }

    @Test
    void xuatPhieuCon_daXuatRoi_khongXuatLanHai() {
        PhieuXuatKho con = phieuXuatCon(phieuChuyen(IChuyenKho.DA_DUYET), ITrangThaiPhieuXuat.DA_XUAT);
        daChonLo(con);
        assertThrows(CommonException.class, () -> px.xuatPhieuXuatCon(PX, 7));
        verify(tonRepo, never()).save(any());
    }

    @Test
    void xuatPhieuCon_truNguonNhaDangGiu_congTrungChuyen_ghiSoKhoHaiDong() {
        PhieuXuatKho con = phieuXuatCon(phieuChuyen(IChuyenKho.DA_DUYET), ITrangThaiPhieuXuat.NHAP);
        daChonLo(con);
        TonKhoTheoLo nguon = ton(A, "12", "10");
        TonKhoTheoLo tc = ton(TRANSIT, "0", "0");

        px.xuatPhieuXuatCon(PX, 7);

        assertEquals(0, nguon.getSoLuongTon().compareTo(new BigDecimal("2")));
        assertEquals(0, nguon.getSoLuongDaDat().compareTo(BigDecimal.ZERO), "nhả phần lô đã giữ khi nhặt");
        assertEquals(0, tc.getSoLuongTon().compareTo(new BigDecimal("10")));
        assertEquals(ITrangThaiPhieuXuat.DA_XUAT, con.getTrangThai());
        assertNotNull(con.getNgayXuat());
        ArgumentCaptor<LichSuGiaoDichKho> so = ArgumentCaptor.forClass(LichSuGiaoDichKho.class);
        verify(lichSuRepo, times(2)).save(so.capture());
        assertEquals("nhap_kho", so.getAllValues().get(0).getLoaiGiaoDich());
        assertEquals(TRANSIT, so.getAllValues().get(0).getKho().getId());
        assertEquals("xuat_kho", so.getAllValues().get(1).getLoaiGiaoDich());
        assertEquals(A, so.getAllValues().get(1).getKho().getId());
        verify(sanPhamService).recalculatePriceAndStatus(4);
    }

    @Test
    void xuatPhieuCon_khoaDongTrungChuyenCungDongKhoNguon_truocKhiDoc() {
        // Nhận chuyển kho cùng lô khóa dòng trung chuyển; xuất phải khóa dòng đó trước khi cộng, không thì ghi đè số
        // bên nhận vừa trừ. Khóa chung một câu với dòng kho nguồn, PK tăng dần (cùng thứ tự khóa toàn cục).
        PhieuXuatKho con = phieuXuatCon(phieuChuyen(IChuyenKho.DA_DUYET), ITrangThaiPhieuXuat.NHAP);
        daChonLo(con);
        when(tonRepo.findIdsByKhoAndVariants(A, List.of(3))).thenReturn(List.of(40));
        when(tonRepo.findIdsByKhoAndLots(TRANSIT, List.of(LO))).thenReturn(List.of(12));
        ton(A, "10", "10");
        ton(TRANSIT, "0", "0");

        px.xuatPhieuXuatCon(PX, 7);

        var thuTu = inOrder(tonRepo);
        thuTu.verify(tonRepo).lockLotsForUpdateByIds(List.of(12, 40));
        thuTu.verify(tonRepo).findByKho_IdAndLoHang_Id(A, LO);
        verify(tonRepo, never()).lockLotsForUpdateByKhoAndVariants(anyInt(), any());
    }

    // ═════ Hủy, chọn lô phiếu con ═════

    @Test
    void huyTuManPhieuXuat_phieuCon_biChan_trangThaiGiuNguyen() {
        PhieuXuatKho con = phieuXuatCon(phieuChuyen(IChuyenKho.DA_DUYET), ITrangThaiPhieuXuat.NHAP);

        CommonException ex = assertThrows(CommonException.class, () -> px.cancel(PX));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("màn Phiếu chuyển kho"), ex.getMessage());
        assertEquals(ITrangThaiPhieuXuat.NHAP, con.getTrangThai());
        verify(pxRepo, never()).save(any());
    }

    @Test
    void huyPhieuCon_theoPhieuChuyen_nhaLoDangGiu_veDaHuy() {
        PhieuXuatKho con = phieuXuatCon(phieuChuyen(IChuyenKho.DA_DUYET), ITrangThaiPhieuXuat.NHAP);
        daChonLo(con);
        TonKhoTheoLo nguon = ton(A, "12", "10");
        when(tonRepo.findIdsByKhoAndLots(A, List.of(LO))).thenReturn(List.of(40));

        px.huyPhieuXuatCon(con);

        assertEquals(0, nguon.getSoLuongDaDat().compareTo(BigDecimal.ZERO));
        assertEquals(0, nguon.getSoLuongTon().compareTo(new BigDecimal("12")), "hủy trước khi xuất không đổi tồn");
        assertEquals(ITrangThaiPhieuXuat.DA_HUY, con.getTrangThai());
        verify(tonRepo).lockLotsForUpdateByIds(List.of(40));
    }

    @Test
    void huyPhieuCon_daXuat_khongHuyDuoc() {
        PhieuXuatKho con = phieuXuatCon(phieuChuyen(IChuyenKho.DANG_VAN_CHUYEN), ITrangThaiPhieuXuat.DA_XUAT);
        assertThrows(RuntimeException.class, () -> px.huyPhieuXuatCon(con));
        assertEquals(ITrangThaiPhieuXuat.DA_XUAT, con.getTrangThai());
    }

    @Test
    void chonLoPhieuCon_phieuChuyenKhongConChoXuat_409() {
        phieuXuatCon(phieuChuyen(IChuyenKho.DA_HUY), ITrangThaiPhieuXuat.NHAP);
        xungDot(assertThrows(CommonException.class, () -> px.pickLoHang(PX, null)));
        verify(ctPxRepo, never()).save(any());
        verify(tonRepo, never()).save(any());
    }
}
