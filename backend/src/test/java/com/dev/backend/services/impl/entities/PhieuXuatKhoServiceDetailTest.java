package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.PickLoHangRequest;
import com.dev.backend.dto.response.customize.PickedLotDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.TonKhoTheoLoDto;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.LoHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.services.impl.multitable.LoDangGiuService;
import com.dev.backend.dto.response.entities.ChiTietPhieuNhapKhoResponse;
import com.dev.backend.dto.response.entities.ChiTietPhieuXuatKhoDto;
import com.dev.backend.entities.*;
import com.dev.backend.dto.response.entities.PhieuXuatKhoDto;
import com.dev.backend.repository.ChiTietPhieuXuatKhoRepository;
import com.dev.backend.repository.DanhSachNhatHangRepository;
import com.dev.backend.repository.PhieuXuatKhoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Danh sách sản phẩm trong chi tiết phiếu xuất (GET /api/v1/phieu-xuat-kho/{id}).
 * Dòng gốc (lo_hang null) là nguồn chính; biến thể chỉ có dòng đã pick (phiếu POS)
 * được gộp thành 1 dòng hiển thị, và dòng đó không dùng được để pick lô.
 */
@ExtendWith(MockitoExtension.class)
class PhieuXuatKhoServiceDetailTest {

    private static final int PHIEU_ID = 10;

    @Mock
    private PhieuXuatKhoRepository repository;
    @Mock
    private ChiTietPhieuXuatKhoRepository chiTietRepo;
    @Mock
    private LoDangGiuService loDangGiuService;
    @Mock
    private LoHangRepository loHangRepository;
    @Mock
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock
    private NguoiDungRepository nguoiDungRepository;
    @Mock
    private LichSuThayDoiService lichSuThayDoiService;

    private PhieuXuatKhoService service;

    @BeforeEach
    void setUp() {
        service = new PhieuXuatKhoService(repository);
        ReflectionTestUtils.setField(service, "chiTietPhieuXuatKhoRepository", chiTietRepo);
        ReflectionTestUtils.setField(service, "loDangGiuService", loDangGiuService);
        ReflectionTestUtils.setField(service, "loHangRepository", loHangRepository);
        ReflectionTestUtils.setField(service, "tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        ReflectionTestUtils.setField(service, "nguoiDungRepository", nguoiDungRepository);
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    private static void dangNhap(String vaiTro) {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of(vaiTro)).build());
        SecurityContextHolder.setKhoId(1); // đang chọn đúng kho của phiếu mẫu (phieuCoKho): thao tác ghi kiểm kho đang chọn
    }

    // ── Dữ liệu mẫu ──

    private PhieuXuatKho phieu(String loaiXuat, int trangThai) {
        return PhieuXuatKho.builder()
                .id(PHIEU_ID).soPhieuXuat("PX-TEST").loaiXuat(loaiXuat)
                .trangThai(trangThai).ngayTao(Instant.now())
                .build();
    }

    private BienTheSanPham bienThe(int id, String sku) {
        return BienTheSanPham.builder()
                .id(id).maSku(sku)
                .sanPham(SanPhamQuanAo.builder().tenSanPham("Áo " + sku).build())
                .mauSac(MauSac.builder().tenMau("Đen").build())
                .build();
    }

    private ChiTietPhieuXuatKho dongGoc(int id, PhieuXuatKho p, BienTheSanPham bt, String sl) {
        return ChiTietPhieuXuatKho.builder()
                .id(id).phieuXuatKho(p).bienTheSanPham(bt).soLuongXuat(new BigDecimal(sl))
                .build();
    }

    private ChiTietPhieuXuatKho dongPick(int id, PhieuXuatKho p, BienTheSanPham bt, int loId, String sl) {
        return ChiTietPhieuXuatKho.builder()
                .id(id).phieuXuatKho(p).bienTheSanPham(bt)
                .loHang(LoHang.builder().id(loId).maLo("LO-" + loId).bienTheSanPham(bt).build())
                .soLuongXuat(new BigDecimal(sl))
                .build();
    }

    private List<ChiTietPhieuXuatKhoDto> chiTiet(PhieuXuatKho p,
                                                List<ChiTietPhieuXuatKho> goc,
                                                List<ChiTietPhieuXuatKho> picks) {
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(chiTietRepo.findByPhieuXuatKhoIdAndLoHangIsNull(PHIEU_ID)).thenReturn(goc);
        when(chiTietRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PHIEU_ID)).thenReturn(picks);
        ChiTietPhieuNhapKhoResponse res = service.getDetail(PHIEU_ID);
        return res.getChiTiet();
    }

    private static void assertQty(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    // ── KB1–2: phiếu bán hàng thường (có dòng gốc) — giữ nguyên hành vi cũ ──

    @Test
    void kb1_phieuBanHangNhap_chuaPick_hienDongGoc() {
        PhieuXuatKho p = phieu("ban_hang", 0);
        BienTheSanPham a = bienThe(1, "SKU-A");
        when(chiTietRepo.sumSoLuongDaPick(PHIEU_ID, 1)).thenReturn(BigDecimal.ZERO);

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p, List.of(dongGoc(100, p, a, "5")), List.of());

        assertEquals(1, rows.size());
        assertEquals(100, rows.get(0).getId());
        assertQty("5", rows.get(0).getSoLuongCanXuat());
        assertQty("0", rows.get(0).getSoLuongDaPick());
        assertFalse(rows.get(0).getDuSoLuong());
    }

    @Test
    void kb2_phieuBanHangDaPickDu_khongNhanDoiDongTheoLo() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");
        when(chiTietRepo.sumSoLuongDaPick(PHIEU_ID, 1)).thenReturn(new BigDecimal("5"));

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p,
                List.of(dongGoc(100, p, a, "5")),
                List.of(dongPick(101, p, a, 7, "3"), dongPick(102, p, a, 8, "2")));

        assertEquals(1, rows.size(), "dòng pick của biến thể đã có dòng gốc không được hiện thêm");
        assertEquals(100, rows.get(0).getId(), "vẫn trỏ về dòng gốc để Pick lot hoạt động");
        assertQty("5", rows.get(0).getSoLuongDaPick());
        assertTrue(rows.get(0).getDuSoLuong());
    }

    // ── KB3–5: phiếu POS (chỉ có dòng theo lô) — trước đây trả về rỗng ──

    @Test
    void kb3_phieuPos_motBienTheMotLo() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p, List.of(), List.of(dongPick(200, p, a, 7, "2")));

        assertEquals(1, rows.size());
        ChiTietPhieuXuatKhoDto r = rows.get(0);
        assertEquals(200, r.getId());
        assertEquals(1, r.getBienTheSanPhamId());
        assertEquals("SKU-A", r.getSku());
        assertEquals("Áo SKU-A / Đen", r.getTenBienThe());
        assertQty("2", r.getSoLuongCanXuat());
        assertQty("2", r.getSoLuongDaPick());
        assertTrue(r.getDuSoLuong());
        verify(chiTietRepo, never()).sumSoLuongDaPick(anyInt(), anyInt());
    }

    @Test
    void kb4_phieuPos_motBienTheTachNhieuLo_gopThanhMotDong() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");

        // Thứ tự trả về từ DB không đảm bảo — id nhỏ nhất phải được chọn
        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p, List.of(),
                List.of(dongPick(202, p, a, 8, "1"), dongPick(201, p, a, 7, "3")));

        assertEquals(1, rows.size());
        assertEquals(201, rows.get(0).getId());
        assertQty("4", rows.get(0).getSoLuongCanXuat());
        assertQty("4", rows.get(0).getSoLuongDaPick());
    }

    @Test
    void kb5_phieuPos_nhieuBienThe_thuTuTheoDongDauTien() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");
        BienTheSanPham b = bienThe(2, "SKU-B");

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p, List.of(), List.of(
                dongPick(303, p, a, 9, "1"),
                dongPick(301, p, b, 7, "2"),
                dongPick(302, p, a, 8, "1.5")));

        assertEquals(2, rows.size());
        assertEquals("SKU-B", rows.get(0).getSku());
        assertEquals(301, rows.get(0).getId());
        assertQty("2", rows.get(0).getSoLuongCanXuat());
        assertEquals("SKU-A", rows.get(1).getSku());
        assertEquals(302, rows.get(1).getId());
        assertQty("2.5", rows.get(1).getSoLuongCanXuat());
    }

    // ── KB6: dữ liệu lẫn (có gốc cho A, chỉ có pick cho B) — không được giấu B ──

    @Test
    void kb6_phieuTron_dongGocTruoc_bienTheMoCoiSau() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");
        BienTheSanPham b = bienThe(2, "SKU-B");
        when(chiTietRepo.sumSoLuongDaPick(PHIEU_ID, 1)).thenReturn(new BigDecimal("5"));

        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(p,
                List.of(dongGoc(100, p, a, "5")),
                List.of(dongPick(101, p, a, 7, "5"), dongPick(102, p, b, 8, "1")));

        assertEquals(2, rows.size());
        assertEquals(100, rows.get(0).getId());
        assertEquals(102, rows.get(1).getId());
        assertQty("1", rows.get(1).getSoLuongCanXuat());
    }

    // ── KB7: phiếu không có dòng nào ──

    @Test
    void kb7_phieuRong_traVeDanhSachRong() {
        List<ChiTietPhieuXuatKhoDto> rows = chiTiet(phieu("ban_hang", 0), List.of(), List.of());
        assertTrue(rows.isEmpty());
    }

    // ── KB7b: PX-CK có phiếu nhặt → chi tiết trả phieuNhatId / maPhieuNhat / trangThaiPhieuNhat (giao diện ẩn "Chọn lô") ──

    @Test
    void kb7b_phieuXuatChuyenKho_coPhieuNhat_traBaTruongPhieuNhat() {
        DanhSachNhatHangRepository dsnhRepo = mock(DanhSachNhatHangRepository.class);
        ReflectionTestUtils.setField(service, "danhSachNhatHangRepository", dsnhRepo);
        PhieuXuatKho p = phieu("chuyen_kho", 0);
        p.setPhieuChuyenKho(PhieuChuyenKho.builder().id(50).soPhieuChuyen("PX-TRF-1").build());
        when(dsnhRepo.findByPhieuXuatKho_Id(PHIEU_ID)).thenReturn(Optional.of(DanhSachNhatHang.builder()
                .id(80).maPickList("PL-20261028-001").trangThai("da_nhat").build()));
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));

        PhieuXuatKhoDto dto = service.getDetail(PHIEU_ID).getPhieu();

        assertEquals(80, dto.getPhieuNhatId());
        assertEquals("PL-20261028-001", dto.getMaPhieuNhat());
        assertEquals("da_nhat", dto.getTrangThaiPhieuNhat());
        assertEquals(50, dto.getPhieuChuyenKhoGocId());

        // PX-CK chưa có phiếu nhặt (phiếu cũ chọn lô tay): ba trường trống
        when(dsnhRepo.findByPhieuXuatKho_Id(PHIEU_ID)).thenReturn(Optional.empty());
        dto = service.getDetail(PHIEU_ID).getPhieu();
        assertNull(dto.getPhieuNhatId());
        assertNull(dto.getMaPhieuNhat());
        assertNull(dto.getTrangThaiPhieuNhat());
    }

    @Test
    void kb7c_phieuBanHang_khongTraPhieuNhat_khongTraBangPhieuNhat() {
        DanhSachNhatHangRepository dsnhRepo = mock(DanhSachNhatHangRepository.class);
        ReflectionTestUtils.setField(service, "danhSachNhatHangRepository", dsnhRepo);
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(phieu("ban_hang", 0)));

        PhieuXuatKhoDto dto = service.getDetail(PHIEU_ID).getPhieu();

        assertNull(dto.getPhieuNhatId());
        assertNull(dto.getMaPhieuNhat());
        assertNull(dto.getTrangThaiPhieuNhat());
        verifyNoInteractions(dsnhRepo);
    }

    // ── KB8–9: dòng gộp không được dùng để pick lô ──

    @Test
    void kb8_pickLoTrenPhieuPosDaXuat_biChan() {
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(phieu("ban_hang", 3)));
        PickLoHangRequest req = PickLoHangRequest.builder()
                .chiTietPhieuXuatKhoId(200).loHangPicks(List.of()).build();

        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.pickLoHang(PHIEU_ID, req));
        assertTrue(ex.getMessage().contains("chưa xuất kho"), ex.getMessage());
        verify(chiTietRepo, never()).deletePickedByPhieuAndBienThe(anyInt(), anyInt());
    }

    @Test
    void kb9_pickLoBangIdDongTheoLo_trenPhieuNhap_biChan() {
        dangNhap(IRoleType.quan_ly_kho);
        PhieuXuatKho p = phieuCoKho("ban_hang", 0);
        BienTheSanPham a = bienThe(1, "SKU-A");
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(chiTietRepo.findById(200)).thenReturn(Optional.of(dongPick(200, p, a, 7, "2")));
        PickLoHangRequest req = PickLoHangRequest.builder()
                .chiTietPhieuXuatKhoId(200).loHangPicks(List.of()).build();

        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.pickLoHang(PHIEU_ID, req));
        assertTrue(ex.getMessage().contains("dòng sản phẩm gốc"));
        verify(chiTietRepo, never()).deletePickedByPhieuAndBienThe(anyInt(), anyInt());
    }

    // ── KB11–16: phiếu bán hàng — lô lấy từ phiếu nhặt, chỉ quản lý kho sửa lô (Log 2 / Log 4) ──

    private PhieuXuatKho phieuCoKho(String loaiXuat, int trangThai) {
        PhieuXuatKho p = phieu(loaiXuat, trangThai);
        p.setKho(Kho.builder().id(1).tenKho("Kho HN").build());
        return p;
    }

    private static PickLoHangRequest yeuCauLo(int dongGocId, int loHangId, String soLuong) {
        PickLoHangRequest.Item item = new PickLoHangRequest.Item();
        item.setLoHangId(loHangId);
        item.setSoLuongXuat(new BigDecimal(soLuong));
        return PickLoHangRequest.builder().chiTietPhieuXuatKhoId(dongGocId).loHangPicks(List.of(item)).build();
    }

    private static TonKhoTheoLo ton(LoHang lo, String ton, String dat, Instant ngayNhap) {
        return TonKhoTheoLo.builder().loHang(lo).soLuongTon(new BigDecimal(ton)).soLuongDaDat(new BigDecimal(dat))
                .ngayNhapGanNhat(ngayNhap).build();
    }

    @Test
    void kb11_nhanVienKho_suaLoPhieuBan_biChan() {
        dangNhap(IRoleType.nhan_vien_kho);
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(phieuCoKho("ban_hang", 6)));

        CommonException ex = assertThrows(CommonException.class, () -> service.pickLoHang(PHIEU_ID, yeuCauLo(200, 7, "1")));

        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
        verify(chiTietRepo, never()).deletePickedByPhieuAndBienThe(anyInt(), anyInt());
    }

    @Test
    void kb12_quanLy_suaLoPhieuBan_phaiDuSoLuongDong() {
        dangNhap(IRoleType.quan_ly_kho);
        PhieuXuatKho p = phieuCoKho("ban_hang", 6);
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(chiTietRepo.findById(200)).thenReturn(Optional.of(dongGoc(200, p, bienThe(1, "SKU-A"), "5")));

        CommonException ex = assertThrows(CommonException.class, () -> service.pickLoHang(PHIEU_ID, yeuCauLo(200, 7, "3")));

        assertTrue(ex.getMessage().contains("phải đủ số lượng"), ex.getMessage());
        verify(chiTietRepo, never()).deletePickedByPhieuAndBienThe(anyInt(), anyInt());
    }

    @Test
    void kb13_quanLy_suaLo_loCuaSanPhamKhac_biChan() {
        dangNhap(IRoleType.quan_ly_kho);
        PhieuXuatKho p = phieuCoKho("ban_hang", 6);
        BienTheSanPham a = bienThe(1, "SKU-A");
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(chiTietRepo.findById(200)).thenReturn(Optional.of(dongGoc(200, p, a, "2")));
        when(loDangGiuService.khoaTonTheoBienThe(eq(1), anyList())).thenReturn(List.of());
        when(loDangGiuService.dangGiuTheoLo(eq(1), any(), isNull(), eq(PHIEU_ID))).thenReturn(new HashMap<>());
        when(loHangRepository.findById(8)).thenReturn(Optional.of(
                LoHang.builder().id(8).maLo("LO-B").bienTheSanPham(bienThe(2, "SKU-B")).build()));

        CommonException ex = assertThrows(CommonException.class, () -> service.pickLoHang(PHIEU_ID, yeuCauLo(200, 8, "2")));

        assertTrue(ex.getMessage().contains("không phải lô của sản phẩm"), ex.getMessage());
        verify(chiTietRepo, never()).save(any());
    }

    @Test
    void kb14_quanLy_suaLo_vuotPhanConLaiSauKhiTruPhieuKhacGiu_biChan() {
        dangNhap(IRoleType.quan_ly_kho);
        PhieuXuatKho p = phieuCoKho("ban_hang", 0);
        BienTheSanPham a = bienThe(1, "SKU-A");
        LoHang lo7 = LoHang.builder().id(7).maLo("LO-7").bienTheSanPham(a).build();
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(chiTietRepo.findById(200)).thenReturn(Optional.of(dongGoc(200, p, a, "3")));
        when(loDangGiuService.khoaTonTheoBienThe(eq(1), anyList())).thenReturn(List.of(ton(lo7, "5", "0", Instant.now())));
        // Phiếu nhặt / phiếu xuất khác đang giữ 3 trên lô 7 → chỉ còn 2
        when(loDangGiuService.dangGiuTheoLo(eq(1), any(), isNull(), eq(PHIEU_ID)))
                .thenReturn(new HashMap<>(Map.of(7, new BigDecimal("3"))));
        when(loHangRepository.findById(7)).thenReturn(Optional.of(lo7));

        CommonException ex = assertThrows(CommonException.class, () -> service.pickLoHang(PHIEU_ID, yeuCauLo(200, 7, "3")));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("chỉ còn 2"), ex.getMessage());
        verify(chiTietRepo, never()).save(any());
    }

    @Test
    void kb15_quanLy_suaLo_hopLe_luuDongLo_khongDungSoLuongDaDat() {
        dangNhap(IRoleType.quan_ly_kho);
        PhieuXuatKho p = phieuCoKho("ban_hang", 6);
        BienTheSanPham a = bienThe(1, "SKU-A");
        LoHang lo7 = LoHang.builder().id(7).maLo("LO-7").bienTheSanPham(a).giaVon(new BigDecimal("100")).build();
        TonKhoTheoLo t7 = ton(lo7, "5", "1", Instant.now());
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(chiTietRepo.findById(200)).thenReturn(Optional.of(dongGoc(200, p, a, "3")));
        when(loDangGiuService.khoaTonTheoBienThe(eq(1), anyList())).thenReturn(List.of(t7));
        when(loDangGiuService.dangGiuTheoLo(eq(1), any(), isNull(), eq(PHIEU_ID))).thenReturn(new HashMap<>());
        when(loHangRepository.findById(7)).thenReturn(Optional.of(lo7));

        service.pickLoHang(PHIEU_ID, yeuCauLo(200, 7, "3"));

        verify(chiTietRepo).deletePickedByPhieuAndBienThe(PHIEU_ID, 1);
        verify(chiTietRepo).save(argThat(ct -> ct.getLoHang() == lo7 && ct.getSoLuongXuat().compareTo(new BigDecimal("3")) == 0));
        assertEquals(0, new BigDecimal("1").compareTo(t7.getSoLuongDaDat()), "phiếu bán không cộng vào so_luong_da_dat");
        verify(tonKhoTheoLoRepository, never()).save(any());
    }

    @Test
    void kb16_loKhaDung_truPhanPhieuKhacGiu_vanGiuLoCuaChinhPhieu_sapFifo() {
        PhieuXuatKho p = phieuCoKho("ban_hang", 6);
        BienTheSanPham a = bienThe(1, "SKU-A");
        LoHang lo7 = LoHang.builder().id(7).maLo("LO-7").bienTheSanPham(a).build();
        LoHang lo8 = LoHang.builder().id(8).maLo("LO-8").bienTheSanPham(a).build();
        LoHang lo9 = LoHang.builder().id(9).maLo("LO-9").bienTheSanPham(a).build();
        Instant cu = Instant.parse("2026-10-01T00:00:00Z");
        Instant moi = Instant.parse("2026-10-08T00:00:00Z");
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p));
        when(chiTietRepo.findPickedLots(PHIEU_ID, 1)).thenReturn(List.of(new PickedLotDto(9, new BigDecimal("2"))));
        when(tonKhoTheoLoRepository.findByKhoAndBienThe(1, 1)).thenReturn(List.of(
                ton(lo7, "5", "0", moi), ton(lo8, "4", "1", cu), ton(lo9, "2", "0", moi)));
        // Lô 8 bị phiếu nhặt khác giữ hết phần còn lại; lô 9 là lô của chính phiếu (không tính là bị giữ)
        when(loDangGiuService.dangGiuTheoLo(eq(1), any(), isNull(), eq(PHIEU_ID)))
                .thenReturn(new HashMap<>(Map.of(8, new BigDecimal("3"))));

        List<TonKhoTheoLoDto> lots = service.getAvailableLots(PHIEU_ID, 1);

        assertEquals(List.of(7, 9), lots.stream().map(TonKhoTheoLoDto::getLoHangId).toList(), "lô 8 hết phần lấy được nên ẩn");
        assertQty("5", lots.get(0).getSoLuongKhaDung());
        assertQty("2", lots.get(1).getSoLuongKhaDung());
    }

    // ── KB10: "Xem lô" / in phiếu dùng id dòng gộp → tra lô theo đúng biến thể ──

    @Test
    void kb10_xemLoBangIdDongGop_traTheoBienThe() {
        PhieuXuatKho p = phieu("ban_hang", 3);
        BienTheSanPham a = bienThe(1, "SKU-A");
        when(repository.findById(PHIEU_ID)).thenReturn(Optional.of(p)); // nạp phiếu để kiểm kho trước khi xem lô
        when(chiTietRepo.findById(201)).thenReturn(Optional.of(dongPick(201, p, a, 7, "3")));

        service.getPickedLots(PHIEU_ID, 201);

        verify(chiTietRepo).findPickedLots(PHIEU_ID, 1);
    }
}
