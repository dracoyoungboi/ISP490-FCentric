package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Đợt 2b: mỗi phiếu chuyển chỉ nhận hàng một lần, đúng trạng thái, đúng số đang đi đường.
 * Kho nguồn A = 1, kho đích B = 2, kho trung chuyển = 99. Phiếu chuyển gốc id 50, phiếu nhập id 70, lô 5, 10 cái.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChuyenKhoNhanHangTest {

    private static final int A = 1, B = 2, TRANSIT = 99;
    private static final int PCK = 50, PN = 70, LO = 5;

    @Mock private PhieuNhapKhoRepository pnRepo;
    @Mock private PhieuXuatKhoRepository pxRepo;
    @Mock private ChiTietPhieuNhapKhoRepository ctPnRepo;
    @Mock private ChiTietPhieuXuatKhoRepository ctPxRepo;
    @Mock private TonKhoTheoLoRepository tonRepo;
    @Mock private NguoiDungRepository ndRepo;
    @Mock private LichSuGiaoDichKhoRepository lichSuRepo;
    @Mock private SanPhamQuanAoService sanPhamService;
    @Mock private EntityManager em;
    @Mock private TypedQuery<Kho> khoQuery;

    private PhieuNhapKhoService pn;
    private PhieuXuatKhoService px;

    @BeforeEach
    void setUp() {
        pn = new PhieuNhapKhoService(pnRepo);
        ReflectionTestUtils.setField(pn, "entityManager", em);
        ReflectionTestUtils.setField(pn, "phieuXuatKhoRepository", pxRepo);
        ReflectionTestUtils.setField(pn, "chiTietPhieuNhapKhoRepository", ctPnRepo);
        ReflectionTestUtils.setField(pn, "tonKhoTheoLoRepository", tonRepo);
        ReflectionTestUtils.setField(pn, "nguoiDungRepository", ndRepo);
        ReflectionTestUtils.setField(pn, "lichSuGiaoDichKhoRepository", lichSuRepo);
        ReflectionTestUtils.setField(pn, "sanPhamQuanAoService", sanPhamService);

        px = new PhieuXuatKhoService(pxRepo);
        ReflectionTestUtils.setField(px, "entityManager", em);
        ReflectionTestUtils.setField(px, "phieuNhapKhoRepository", pnRepo);
        ReflectionTestUtils.setField(px, "chiTietPhieuXuatKhoRepository", ctPxRepo);
        ReflectionTestUtils.setField(px, "tonKhoTheoLoRepository", tonRepo);
        ReflectionTestUtils.setField(px, "nguoiDungRepository", ndRepo);

        when(em.createQuery(contains("KHO_TRANSIT"), eq(Kho.class))).thenReturn(khoQuery);
        when(khoQuery.getSingleResult()).thenReturn(kho(TRANSIT));
        when(ndRepo.findById(any())).thenReturn(Optional.of(NguoiDung.builder().id(7).build()));
        when(pnRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(pxRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(tonRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        quanTriVien(); // bỏ qua kiểm kho đang chọn (đã test ở đợt 2) để tập trung vào máy trạng thái
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

    private PhieuXuatKho phieuChuyen(int trangThai) {
        PhieuXuatKho p = PhieuXuatKho.builder().id(PCK).soPhieuXuat("PX-TRF-1").loaiXuat("khac")
                .kho(kho(A)).khoChuyenDen(kho(B)).trangThai(trangThai).ngayTao(Instant.now()).build();
        when(pxRepo.findById(PCK)).thenReturn(Optional.of(p));
        when(pxRepo.findByIdForUpdate(PCK)).thenReturn(Optional.of(p));
        return p;
    }

    private PhieuNhapKho phieuNhap(int khoId, PhieuXuatKho goc) {
        PhieuNhapKho p = PhieuNhapKho.builder().id(PN).soPhieuNhap(khoId == B ? "PN-TRF-1" : "PN-RET-1").kho(kho(khoId))
                .trangThai(TrangThaiPhieuNhap.DRAFT.getValue()).phieuChuyenKhoGoc(goc).build();
        when(pnRepo.findById(PN)).thenReturn(Optional.of(p));
        when(pnRepo.khoaTheoId(PN)).thenReturn(Optional.of(p));
        BienTheSanPham bt = BienTheSanPham.builder().id(3).sanPham(SanPhamQuanAo.builder().id(4).build()).build();
        when(ctPnRepo.findAllByPhieuNhapKhoIdAndCoLo(PN)).thenReturn(List.of(ChiTietPhieuNhapKho.builder()
                .phieuNhapKho(p).bienTheSanPham(bt).loHang(LoHang.builder().id(LO).maLo("LO-5").build())
                .soLuongNhap(new BigDecimal("10")).donGia(BigDecimal.ONE).build()));
        return p;
    }

    private TonKhoTheoLo tonTrungChuyen(String soLuong) {
        TonKhoTheoLo t = TonKhoTheoLo.builder().kho(kho(TRANSIT)).soLuongTon(new BigDecimal(soLuong)).build();
        when(tonRepo.findByKho_IdAndLoHang_Id(TRANSIT, LO)).thenReturn(Optional.of(t));
        return t;
    }

    private TonKhoTheoLo tonKho(int khoId, String soLuong) {
        TonKhoTheoLo t = TonKhoTheoLo.builder().kho(kho(khoId)).soLuongTon(new BigDecimal(soLuong)).build();
        when(tonRepo.findByKho_IdAndLoHang_Id(khoId, LO)).thenReturn(Optional.of(t));
        return t;
    }

    private static void xungDot(Throwable t) {
        assertInstanceOf(CommonException.class, t);
        assertEquals(HttpStatus.CONFLICT, ((CommonException) t).getHttpStatus(), t.getMessage());
    }

    // ═════ S3: hoàn tất nhận ═════

    @Test
    void hoanTatNhan_dangChuyen_vaoKhoDich_truTrungChuyenCongKhoDich_chotPhieuChuyen() {
        PhieuXuatKho goc = phieuChuyen(3);
        phieuNhap(B, goc);
        TonKhoTheoLo transit = tonTrungChuyen("10");
        TonKhoTheoLo tonB = tonKho(B, "0");

        pn.completeTransferReceipt(PN, 7);

        assertEquals(0, transit.getSoLuongTon().compareTo(BigDecimal.ZERO));
        assertEquals(0, tonB.getSoLuongTon().compareTo(new BigDecimal("10")));
        assertEquals(5, goc.getTrangThai());
        verify(em).refresh(goc, LockModeType.PESSIMISTIC_WRITE);
        verify(pnRepo).khoaTheoId(PN);
    }

    @Test
    void hoanTatNhan_phieuChuyenDaHuy_khoDichKhongNhanDuoc_tonGiuNguyen() {
        // L4: phiếu nhập lập lúc đang chuyển, sau đó phiếu chuyển bị hủy (kho nguồn sẽ nhập hoàn trả)
        PhieuXuatKho goc = phieuChuyen(4);
        phieuNhap(B, goc);
        TonKhoTheoLo transit = tonTrungChuyen("10");

        xungDot(assertThrows(CommonException.class, () -> pn.completeTransferReceipt(PN, 7)));
        assertEquals(0, transit.getSoLuongTon().compareTo(new BigDecimal("10")));
        verify(tonRepo, never()).save(any());
        verify(lichSuRepo, never()).save(any());
    }

    @Test
    void hoanTatNhan_phieuChuyenDaHoanTat_khongNhanLanHai() {
        PhieuXuatKho goc = phieuChuyen(5);
        phieuNhap(B, goc);
        tonTrungChuyen("10");
        xungDot(assertThrows(CommonException.class, () -> pn.completeTransferReceipt(PN, 7)));
        verify(tonRepo, never()).save(any());
    }

    @Test
    void hoanTatNhan_hoanTra_phieuChuyenDaHuy_veKhoNguon_phieuChuyenGiuDaHuy() {
        PhieuXuatKho goc = phieuChuyen(4);
        phieuNhap(A, goc);
        TonKhoTheoLo transit = tonTrungChuyen("10");
        TonKhoTheoLo tonA = tonKho(A, "0");

        pn.completeTransferReceipt(PN, 7);

        assertEquals(0, transit.getSoLuongTon().compareTo(BigDecimal.ZERO));
        assertEquals(0, tonA.getSoLuongTon().compareTo(new BigDecimal("10")));
        assertEquals(4, goc.getTrangThai());
    }

    @Test
    void hoanTatNhan_hoanTraKhiPhieuChuyenConDangChuyen_biChan() {
        PhieuXuatKho goc = phieuChuyen(3);
        phieuNhap(A, goc);
        tonTrungChuyen("10");
        xungDot(assertThrows(CommonException.class, () -> pn.completeTransferReceipt(PN, 7)));
        verify(tonRepo, never()).save(any());
    }

    @Test
    void hoanTatNhan_trungChuyenKhongDu_baoLoi_khongDeAm() {
        // L3: trung chuyển chỉ còn 4 (6 cái đã bị phiếu khác / lần nhận trước lấy) — trước đây xuống −6
        PhieuXuatKho goc = phieuChuyen(3);
        phieuNhap(B, goc);
        TonKhoTheoLo transit = tonTrungChuyen("4");

        CommonException ex = assertThrows(CommonException.class, () -> pn.completeTransferReceipt(PN, 7));
        xungDot(ex);
        assertTrue(ex.getMessage().contains("LO-5"), ex.getMessage());
        assertEquals(0, transit.getSoLuongTon().compareTo(new BigDecimal("4")));
        assertEquals(3, goc.getTrangThai());
    }

    // ═════ S1: nhập thường không nhận phiếu chuyển ═════

    @Test
    void nhapThuong_phieuNhapChuyenKho_biChan_khongCongTon() {
        // L1: trước đây cộng kho đích mà không trừ trung chuyển, phiếu chuyển vẫn "Đang chuyển"
        PhieuXuatKho goc = phieuChuyen(3);
        phieuNhap(B, goc);
        tonTrungChuyen("10");

        CommonException ex = assertThrows(CommonException.class, () -> pn.completePhieuNhap(PN, 7));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(tonRepo, never()).save(any());
        assertEquals(3, goc.getTrangThai());
    }

    // ═════ S2: một phiếu nhập chưa hủy cho mỗi phiếu chuyển ═════

    @Test
    void taoPhieuNhap_daCoPhieuNhapChuaHuy_biChan_neuSoPhieu() {
        phieuChuyen(3);
        when(pnRepo.findFirstByPhieuChuyenKhoGoc_IdAndTrangThaiNot(PCK, TrangThaiPhieuNhap.CANCELLED.getValue()))
                .thenReturn(Optional.of(PhieuNhapKho.builder().id(71).soPhieuNhap("PN-TRF-CU").build()));

        CommonException ex = assertThrows(CommonException.class, () -> pn.createImportFromTransfer(PCK));
        xungDot(ex);
        assertTrue(ex.getMessage().contains("PN-TRF-CU"), ex.getMessage());
        verify(pnRepo, never()).save(any());
        verify(pxRepo).findByIdForUpdate(PCK);
    }

    @Test
    void taoPhieuNhap_chiCoPhieuNhapDaHuy_lapDuocPhieuMoi() {
        phieuChuyen(3);
        when(pnRepo.findFirstByPhieuChuyenKhoGoc_IdAndTrangThaiNot(anyInt(), anyInt())).thenReturn(Optional.empty());
        @SuppressWarnings("unchecked") TypedQuery<PhieuXuatKho> qCon = mock(TypedQuery.class);
        @SuppressWarnings("unchecked") TypedQuery<ChiTietPhieuXuatKho> qDong = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(PhieuXuatKho.class))).thenReturn(qCon);
        when(qCon.setParameter(anyString(), any())).thenReturn(qCon);
        when(qCon.getResultList()).thenReturn(List.of(PhieuXuatKho.builder().id(60).trangThai(3).build()));
        when(em.createQuery(anyString(), eq(ChiTietPhieuXuatKho.class))).thenReturn(qDong);
        when(qDong.setParameter(anyString(), any())).thenReturn(qDong);
        when(qDong.getResultList()).thenReturn(List.of());

        PhieuNhapKho moi = pn.createImportFromTransfer(PCK);
        assertEquals(B, moi.getKho().getId());
        assertTrue(moi.getSoPhieuNhap().startsWith("PN-TRF-"));
    }

    // ═════ S4 (PA2): hủy khi hàng đang đi đường ═════

    @Test
    void huyDangChuyen_khoDichDaLapPhieuNhap_biChan_trangThaiGiuNguyen() {
        PhieuXuatKho goc = phieuChuyen(3);
        when(pnRepo.findFirstByPhieuChuyenKhoGoc_IdAndTrangThaiNot(PCK, TrangThaiPhieuNhap.CANCELLED.getValue()))
                .thenReturn(Optional.of(PhieuNhapKho.builder().id(71).soPhieuNhap("PN-TRF-1").build()));

        CommonException ex = assertThrows(CommonException.class, () -> px.cancelTransfer(PCK));
        xungDot(ex);
        assertTrue(ex.getMessage().contains("PN-TRF-1"), ex.getMessage());
        assertEquals(3, goc.getTrangThai());
        verify(pxRepo).findByIdForUpdate(PCK);
    }

    @Test
    void huyDangChuyen_khoDichChuaLapHoacDaHuyPhieuNhap_huyDuoc() {
        PhieuXuatKho goc = phieuChuyen(3);
        when(pnRepo.findFirstByPhieuChuyenKhoGoc_IdAndTrangThaiNot(anyInt(), anyInt())).thenReturn(Optional.empty());
        px.cancelTransfer(PCK);
        assertEquals(4, goc.getTrangThai());
    }

    @Test
    void huyTruocKhiXuat_khongXetPhieuNhap() {
        PhieuXuatKho goc = phieuChuyen(2);
        px.cancelTransfer(PCK);
        assertEquals(4, goc.getTrangThai());
        verify(pnRepo, never()).findFirstByPhieuChuyenKhoGoc_IdAndTrangThaiNot(anyInt(), anyInt());
    }

    // ═════ S5: không "hồi sinh" phiếu đã hủy, một phiếu xuất con ═════

    @Test
    void xacNhanXuatPhieuCon_phieuGocDaHuy_biChan_khongDuaVeDangChuyen() {
        PhieuXuatKho goc = phieuChuyen(4);
        PhieuXuatKho con = PhieuXuatKho.builder().id(60).soPhieuXuat("PX-CON").loaiXuat("chuyen_kho").kho(kho(A))
                .khoChuyenDen(kho(B)).phieuChuyenKhoGoc(goc).trangThai(ITrangThaiPhieuXuat.NHAP).build();
        when(pxRepo.findById(60)).thenReturn(Optional.of(con));

        CommonException ex = assertThrows(CommonException.class, () -> px.xacNhanXuatKho(60, null, 7));
        xungDot(ex);
        assertEquals(4, goc.getTrangThai());
        assertEquals(ITrangThaiPhieuXuat.NHAP, con.getTrangThai());
        verify(em).refresh(goc, LockModeType.PESSIMISTIC_WRITE);
        verify(tonRepo, never()).save(any());
    }

    @Test
    void xacNhanXuatPhieuCon_khoaDongTrungChuyenCungDongKhoNguon_truocKhiDoc() {
        // Nhận chuyển kho cùng lô khóa dòng trung chuyển; xuất phải khóa dòng đó trước khi cộng, không thì ghi đè số
        // bên nhận vừa trừ. Khóa chung một câu với dòng kho nguồn, PK tăng dần (cùng thứ tự khóa toàn cục).
        PhieuXuatKho goc = phieuChuyen(2);
        PhieuXuatKho con = PhieuXuatKho.builder().id(60).soPhieuXuat("PX-CON").loaiXuat("chuyen_kho").kho(kho(A))
                .khoChuyenDen(kho(B)).phieuChuyenKhoGoc(goc).trangThai(ITrangThaiPhieuXuat.NHAP).build();
        when(pxRepo.findById(60)).thenReturn(Optional.of(con));
        BienTheSanPham bt = BienTheSanPham.builder().id(3).sanPham(SanPhamQuanAo.builder().id(4).build()).build();
        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(60)).thenReturn(List.of(ChiTietPhieuXuatKho.builder()
                .phieuXuatKho(con).bienTheSanPham(bt).loHang(LoHang.builder().id(LO).maLo("LO-5").build())
                .soLuongXuat(new BigDecimal("10")).build()));
        when(tonRepo.findIdsByKhoAndVariants(A, List.of(3))).thenReturn(List.of(40));
        when(tonRepo.findIdsByKhoAndLots(TRANSIT, List.of(LO))).thenReturn(List.of(12));
        tonKho(A, "10");
        tonTrungChuyen("0");

        try {
            px.xacNhanXuatKho(60, null, 7);
        } catch (Throwable ignored) {
            // phần sau (sổ kho, đồng bộ) không dựng đủ dữ liệu: chỉ xét bước khóa
        }

        var thuTu = inOrder(tonRepo);
        thuTu.verify(tonRepo).lockLotsForUpdateByIds(List.of(12, 40));
        thuTu.verify(tonRepo).findByKho_IdAndLoHang_Id(TRANSIT, LO);
        verify(tonRepo, never()).lockLotsForUpdateByKhoAndVariants(anyInt(), any());
    }

    @Test
    void taoPhieuXuatCon_daCoPhieuXuatChuaHuy_biChan() {
        phieuChuyen(2);
        when(pxRepo.findFirstByPhieuChuyenKhoGoc_IdAndTrangThaiNot(PCK, ITrangThaiPhieuXuat.DA_HUY))
                .thenReturn(Optional.of(PhieuXuatKho.builder().id(60).soPhieuXuat("PX-CON").build()));

        CommonException ex = assertThrows(CommonException.class, () -> px.createExportFromTransfer(PCK));
        xungDot(ex);
        assertTrue(ex.getMessage().contains("PX-CON"), ex.getMessage());
        verify(pxRepo, never()).save(any());
    }
}
