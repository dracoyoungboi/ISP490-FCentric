package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.request.PhanBoLoNhatHangRequest;
import com.dev.backend.dto.request.PhanCongNguoiNhatRequest;
import com.dev.backend.dto.request.PickLoHangRequest;
import com.dev.backend.dto.request.QuetBarcodeRequest;
import com.dev.backend.dto.response.customize.HangCanHoanKeDto;
import com.dev.backend.dto.response.entities.ChiTietNhatHangDto;
import com.dev.backend.dto.response.entities.DanhSachNhatHangDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.ChiTietNhatHangMapper;
import com.dev.backend.mapper.DanhSachNhatHangMapper;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.impl.entities.PhieuXuatKhoService;
import com.dev.backend.websocket.OutboundWebSocketHandler;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.*;

/**
 * Phiếu nhặt của phiếu chuyển kho (đặc tả bước 8–9, phương án 1 phiếu nhặt ↔ 1 PX-CK): tạo khi duyệt (kho xuất của
 * phiếu chuyển, chưa phân công, phân bổ FIFO), mã PL thử số kế tiếp khi trùng, Hoàn tất nhặt rẽ nhánh (ghi lô vào PX-CK,
 * không tạo phiếu xuất bán, không Đã hủy), hủy theo phiếu chuyển ở từng trạng thái, chặn chọn lô tay khi phiếu nhặt mở.
 * Kho tổng = 1 (kho xuất), cửa hàng = 2 (kho nhận / kho đang chọn khác), phiếu chuyển 50, PX-CK 60, phiếu nhặt 80,
 * biến thể 93, lô 5 (nhập 01/10, còn 6) và lô 6 (nhập 05/10, còn 20).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NhatHangChuyenKhoTest {

    private static final int KHO = 1, CUA_HANG = 2, PCK = 50, PX = 60, PL = 80, BT = 93, NHAN_VIEN = 9;
    private static final String TIEN_TO = "PL-" + LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))
            .format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";

    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private DanhSachNhatHangRepository danhSachNhatHangRepository;
    @Mock private ChiTietNhatHangRepository chiTietNhatHangRepository;
    @Mock private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock private KhoRepository khoRepository;
    @Mock private NguoiDungRepository nguoiDungRepository;
    @Mock private ChiTietNhatHangMapper chiTietNhatHangMapper;
    @Mock private DanhSachNhatHangMapper danhSachNhatHangMapper;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private PhieuXuatKhoService phieuXuatKhoService;
    @Mock private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @Mock private CanhBaoRepository canhBaoRepository;
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private OutboundWebSocketHandler outboundWebSocketHandler;
    @Mock private org.springframework.context.ApplicationEventPublisher eventPublisher;
    @Mock private com.dev.backend.services.multitable.BangChungDongGoiService bangChungDongGoiService;
    @Mock private PhanBoLoNhatHangRepository phanBoLoNhatHangRepository;
    @Mock private LoHangRepository loHangRepository;
    @Mock private LoDangGiuService loDangGiuService;
    @Mock private GiuChoChuyenKhoService giuChoChuyenKhoService;
    @Mock private EntityManager entityManager;

    @InjectMocks
    private NhatHangServiceImpl service;

    private Kho kho, cuaHang;
    private BienTheSanPham bienThe;
    private LoHang lo5, lo6;
    private PhieuChuyenKho phieuChuyen;
    private PhieuXuatKho phieuXuat;

    @BeforeEach
    void setUp() {
        kho = Kho.builder().id(KHO).tenKho("Kho tổng").build();
        cuaHang = Kho.builder().id(CUA_HANG).tenKho("Cửa hàng 1").build();
        bienThe = BienTheSanPham.builder().id(BT).maSku("AK-93")
                .sanPham(SanPhamQuanAo.builder().id(4).tenSanPham("Áo khoác").build()).build();
        lo5 = LoHang.builder().id(5).maLo("LO-5").bienTheSanPham(bienThe).giaVon(new BigDecimal("100")).build();
        lo6 = LoHang.builder().id(6).maLo("LO-6").bienTheSanPham(bienThe).giaVon(new BigDecimal("120")).build();
        phieuChuyen = PhieuChuyenKho.builder().id(PCK).soPhieuChuyen("PX-TRF-1").khoXuat(kho).khoNhap(cuaHang)
                .trangThai(IChuyenKho.DA_DUYET).build();
        phieuXuat = PhieuXuatKho.builder().id(PX).soPhieuXuat("PX-CK-1").loaiXuat("chuyen_kho").kho(kho)
                .khoChuyenDen(cuaHang).phieuChuyenKho(phieuChuyen).trangThai(ITrangThaiPhieuXuat.NHAP).build();

        when(danhSachNhatHangRepository.save(any(DanhSachNhatHang.class))).thenAnswer(i -> {
            DanhSachNhatHang d = i.getArgument(0);
            if (d.getId() == null) d.setId(PL);
            return d;
        });
        when(loHangRepository.getReferenceById(5)).thenReturn(lo5);
        when(loHangRepository.getReferenceById(6)).thenReturn(lo6);
        when(danhSachNhatHangMapper.toDto(any())).thenAnswer(i -> {
            DanhSachNhatHang d = i.getArgument(0);
            return DanhSachNhatHangDto.builder().id(d.getId()).maPickList(d.getMaPickList()).trangThai(d.getTrangThai()).build();
        });
        when(chiTietNhatHangMapper.toDto(any())).thenAnswer(i -> new ChiTietNhatHangDto());
        when(phanBoLoNhatHangRepository.save(any(PhanBoLoNhatHang.class))).thenAnswer(i -> i.getArgument(0));
        when(canhBaoRepository.save(any(CanhBao.class))).thenAnswer(i -> i.getArgument(0));
        dangNhap(IRoleType.nhan_vien_kho, KHO);
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    // ── Dữ liệu ──

    private static void dangNhap(String vaiTro, Integer khoDangChon) {
        SecurityContextHolder.clear();
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(NHAN_VIEN).vaiTro(Set.of(vaiTro)).build());
        if (khoDangChon != null) SecurityContextHolder.setKhoId(khoDangChon);
    }

    /** Tồn lô 5 = 6 (nhập 01/10), lô 6 = 20 (nhập 05/10) ở kho xuất, không ai khác giữ. */
    private List<TonKhoTheoLo> tonHaiLo(String lo5Ton, String lo6Ton) {
        List<TonKhoTheoLo> ton = List.of(
                TonKhoTheoLo.builder().kho(kho).loHang(lo5).soLuongTon(new BigDecimal(lo5Ton)).soLuongDaDat(BigDecimal.ZERO)
                        .ngayNhapGanNhat(Instant.parse("2026-10-01T00:00:00Z")).build(),
                TonKhoTheoLo.builder().kho(kho).loHang(lo6).soLuongTon(new BigDecimal(lo6Ton)).soLuongDaDat(BigDecimal.ZERO)
                        .ngayNhapGanNhat(Instant.parse("2026-10-05T00:00:00Z")).build());
        when(loDangGiuService.khoaTonTheoBienThe(eq(KHO), any())).thenReturn(ton);
        when(loDangGiuService.dangGiuTheoLo(eq(KHO), any(), any(), any())).thenReturn(new HashMap<>());
        return ton;
    }

    /** Phiếu nhặt 80 của PX-CK 60, giao cho nhân viên 9, một dòng AK-93 cần 10 đã quét {@code daQuet}. */
    private DanhSachNhatHang phieuNhat(String trangThai, String daQuet) {
        DanhSachNhatHang pl = DanhSachNhatHang.builder().id(PL).maPickList(TIEN_TO + "001").khoXuat(kho)
                .phieuXuatKho(phieuXuat).trangThai(trangThai).ngayTao(Instant.now())
                .nguoiNhat(NguoiDung.builder().id(NHAN_VIEN).hoTen("Thủ kho A").build()).build();
        ChiTietNhatHang dong = ChiTietNhatHang.builder().id(1).danhSachNhatHang(pl).bienTheSanPham(bienThe)
                .soLuongCanNhat(new BigDecimal("10")).soLuongDaQuet(new BigDecimal(daQuet)).build();
        pl.setChiTietNhatHangs(new ArrayList<>(List.of(dong)));
        when(danhSachNhatHangRepository.findById(PL)).thenReturn(Optional.of(pl));
        when(danhSachNhatHangRepository.findByPhieuXuatKho_Id(PX)).thenReturn(Optional.of(pl));
        when(chiTietNhatHangRepository.findByDanhSachNhatHangIdWithLockOrderByIdAsc(PL)).thenReturn(new ArrayList<>(List.of(dong)));
        // dòng gốc của PX-CK: 10 cái AK-93
        when(chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(PX)).thenReturn(List.of(ChiTietPhieuXuatKho
                .builder().id(600).phieuXuatKho(phieuXuat).bienTheSanPham(bienThe).soLuongXuat(new BigDecimal("10")).build()));
        return pl;
    }

    private PhanBoLoNhatHang phanBo(DanhSachNhatHang pl, LoHang lo, String soLuong) {
        return PhanBoLoNhatHang.builder().chiTietNhatHang(pl.getChiTietNhatHangs().get(0)).loHang(lo)
                .soLuong(new BigDecimal(soLuong)).build();
    }

    private static void assertSo(String expected, BigDecimal actual) {
        assertNotNull(actual);
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    private static CommonException xungDot(Exception e) {
        CommonException ce = assertInstanceOf(CommonException.class, e);
        assertEquals(HttpStatus.CONFLICT, ce.getHttpStatus(), ce.getMessage());
        return ce;
    }

    // ══════════════════════════ Tạo khi duyệt (đặc tả bước 8) ══════════════════════════

    @Test
    @DisplayName("Duyệt: phiếu nhặt ở KHO XUẤT của phiếu chuyển (không lấy kho đang chọn), chưa phân công, dòng = dòng phiếu chuyển, phân bổ FIFO")
    void taoPhieuNhat_khoXuat_chuaPhanCong_phanBoFifo() {
        dangNhap(IRoleType.quan_ly_kho, CUA_HANG); // người duyệt đang chọn kho khác
        tonHaiLo("6", "20");
        when(danhSachNhatHangRepository.soDuoiLonNhat(TIEN_TO)).thenReturn(2);
        ChiTietPhieuChuyenKho dong = ChiTietPhieuChuyenKho.builder().id(1).phieuChuyenKho(phieuChuyen)
                .bienTheSanPham(bienThe).soLuongChuyen(10).build();

        DanhSachNhatHang pl = service.taoPhieuNhatChuyenKho(phieuChuyen, phieuXuat, List.of(dong));

        assertEquals(KHO, pl.getKhoXuat().getId());
        assertSame(phieuXuat, pl.getPhieuXuatKho());
        assertTrue(pl.laChuyenKho());
        assertNull(pl.getNguoiNhat(), "chưa phân công: quản lý giao hoặc nhân viên tự nhận");
        assertEquals("cho_nhat", pl.getTrangThai());
        assertEquals(TIEN_TO + "003", pl.getMaPickList());
        assertTrue(pl.getGhiChu().contains("PX-TRF-1"), pl.getGhiChu());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChiTietNhatHang>> dongNhat = ArgumentCaptor.forClass(List.class);
        verify(chiTietNhatHangRepository).saveAll(dongNhat.capture());
        assertEquals(1, dongNhat.getValue().size());
        assertSame(bienThe, dongNhat.getValue().get(0).getBienTheSanPham());
        assertSo("10", dongNhat.getValue().get(0).getSoLuongCanNhat());
        assertSo("0", dongNhat.getValue().get(0).getSoLuongDaQuet());

        // FIFO: lô 5 (cũ) lấy hết 6, lô 6 lấy 4 — giữ lô ngay, khóa tồn của kho xuất
        ArgumentCaptor<PhanBoLoNhatHang> pb = ArgumentCaptor.forClass(PhanBoLoNhatHang.class);
        verify(phanBoLoNhatHangRepository, times(2)).save(pb.capture());
        assertEquals(5, pb.getAllValues().get(0).getLoHang().getId());
        assertSo("6", pb.getAllValues().get(0).getSoLuong());
        assertEquals(6, pb.getAllValues().get(1).getLoHang().getId());
        assertSo("4", pb.getAllValues().get(1).getSoLuong());
        verify(loDangGiuService).khoaTonTheoBienThe(KHO, List.of(BT));
        verify(loDangGiuService, never()).khoaTonTheoBienThe(eq(CUA_HANG), any());
    }

    @Test
    @DisplayName("Duyệt khi lô không đủ: phân bổ phần có, vẫn tạo phiếu nhặt (Hoàn tất nhặt mới chặn)")
    void taoPhieuNhat_loKhongDu_phanBoPhanCo() {
        tonHaiLo("3", "2");
        ChiTietPhieuChuyenKho dong = ChiTietPhieuChuyenKho.builder().id(1).phieuChuyenKho(phieuChuyen)
                .bienTheSanPham(bienThe).soLuongChuyen(10).build();

        DanhSachNhatHang pl = service.taoPhieuNhatChuyenKho(phieuChuyen, phieuXuat, List.of(dong));

        assertEquals("cho_nhat", pl.getTrangThai());
        ArgumentCaptor<PhanBoLoNhatHang> pb = ArgumentCaptor.forClass(PhanBoLoNhatHang.class);
        verify(phanBoLoNhatHangRepository, times(2)).save(pb.capture());
        assertSo("5", pb.getAllValues().stream().map(PhanBoLoNhatHang::getSoLuong).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    @Test
    @DisplayName("Mã phiếu nhặt: số đuôi lớn nhất + 1 (đọc KHÔNG khóa); số đó đã có thì thử số kế tiếp; chưa có mã nào trong ngày → 001")
    void maPickList_thuSoKeTiepKhiTrung() {
        when(danhSachNhatHangRepository.soDuoiLonNhat(TIEN_TO)).thenReturn(4);
        when(danhSachNhatHangRepository.existsByMaPickList(TIEN_TO + "005")).thenReturn(true);
        assertEquals(TIEN_TO + "006", service.maPickListMoi());

        when(danhSachNhatHangRepository.soDuoiLonNhat(TIEN_TO)).thenReturn(null);
        when(danhSachNhatHangRepository.existsByMaPickList(anyString())).thenReturn(false);
        assertEquals(TIEN_TO + "001", service.maPickListMoi());

        when(danhSachNhatHangRepository.soDuoiLonNhat(TIEN_TO)).thenReturn(999);
        assertEquals(TIEN_TO + "1000", service.maPickListMoi(), "so theo số, không theo chuỗi");
    }

    @Test
    @DisplayName("Mã phiếu nhặt: thử hết số lần mà vẫn trùng → 409 'thử lại', không lưu phiếu")
    void maPickList_trungMai_409() {
        when(danhSachNhatHangRepository.soDuoiLonNhat(TIEN_TO)).thenReturn(1);
        when(danhSachNhatHangRepository.existsByMaPickList(anyString())).thenReturn(true);
        ChiTietPhieuChuyenKho dong = ChiTietPhieuChuyenKho.builder().id(1).bienTheSanPham(bienThe).soLuongChuyen(10).build();

        CommonException ex = xungDot(assertThrows(CommonException.class,
                () -> service.taoPhieuNhatChuyenKho(phieuChuyen, phieuXuat, List.of(dong))));

        assertTrue(ex.getMessage().contains("thử lại"), ex.getMessage());
        verify(danhSachNhatHangRepository, never()).save(any());
    }

    @Test
    @DisplayName("Mã phiếu nhặt: câu đọc số lớn nhất không có FOR UPDATE / @Lock trên bảng phiếu nhặt (tránh kẹt chéo với Hoàn tất nhặt)")
    void maPickList_khongKhoaBangPhieuNhat() {
        for (java.lang.reflect.Method m : DanhSachNhatHangRepository.class.getDeclaredMethods()) {
            org.springframework.data.jpa.repository.Query q = m.getAnnotation(org.springframework.data.jpa.repository.Query.class);
            if (q != null) {
                assertFalse(q.value().toUpperCase(Locale.ROOT).contains("FOR UPDATE"), m.getName());
            }
            assertNull(m.getAnnotation(org.springframework.data.jpa.repository.Lock.class), m.getName());
        }
        assertDoesNotThrow(() -> DanhSachNhatHangRepository.class.getMethod("soDuoiLonNhat", String.class));
    }

    @Test
    @DisplayName("Mã phiếu nhặt: giao dịch khác vừa lấy cùng mã → khóa duy nhất chặn khi lưu → 409 'Có người vừa tạo phiếu nhặt cùng lúc', không ghi dòng / phân bổ")
    void maPickList_trungKhiLuu_409CauRo() {
        when(danhSachNhatHangRepository.soDuoiLonNhat(TIEN_TO)).thenReturn(2);
        ChiTietPhieuChuyenKho dong = ChiTietPhieuChuyenKho.builder().id(1).bienTheSanPham(bienThe).soLuongChuyen(10).build();
        // INSERT chạy ngay khi lưu (khóa tự tăng) hoặc lúc đẩy (flush): cả hai đường đều ra câu rõ
        when(danhSachNhatHangRepository.save(any(DanhSachNhatHang.class))).thenThrow(new DataIntegrityViolationException(
                "could not execute statement [Duplicate entry '" + TIEN_TO + "003' for key 'danh_sach_nhat_hang.uk_ma_pick_list']"));

        CommonException ex = xungDot(assertThrows(CommonException.class,
                () -> service.taoPhieuNhatChuyenKho(phieuChuyen, phieuXuat, List.of(dong))));
        assertEquals(NhatHangServiceImpl.LOI_TRUNG_MA_PHIEU_NHAT, ex.getMessage());

        reset(danhSachNhatHangRepository);
        when(danhSachNhatHangRepository.soDuoiLonNhat(TIEN_TO)).thenReturn(2);
        when(danhSachNhatHangRepository.save(any(DanhSachNhatHang.class))).thenAnswer(i -> i.getArgument(0));
        doThrow(new DataIntegrityViolationException("Duplicate entry '" + TIEN_TO + "003' for key 'uk_ma_pick_list'"))
                .when(danhSachNhatHangRepository).flush();
        ex = xungDot(assertThrows(CommonException.class,
                () -> service.taoPhieuNhatChuyenKho(phieuChuyen, phieuXuat, List.of(dong))));
        assertEquals(NhatHangServiceImpl.LOI_TRUNG_MA_PHIEU_NHAT, ex.getMessage());

        verify(chiTietNhatHangRepository, never()).saveAll(any());
        verify(phanBoLoNhatHangRepository, never()).save(any());
        verify(loDangGiuService, never()).khoaTonTheoBienThe(any(), any());
    }

    @Test
    @DisplayName("Lưu phiếu nhặt vi phạm ràng buộc khác (không phải mã) → giữ nguyên lỗi ràng buộc (409 câu chung)")
    void luuPhieuNhat_rangBuocKhac_giuNguyen() {
        when(danhSachNhatHangRepository.soDuoiLonNhat(TIEN_TO)).thenReturn(2);
        when(danhSachNhatHangRepository.save(any(DanhSachNhatHang.class))).thenThrow(new DataIntegrityViolationException(
                "Duplicate entry '60' for key 'danh_sach_nhat_hang.uk_dsnh_phieu_xuat_kho'"));
        ChiTietPhieuChuyenKho dong = ChiTietPhieuChuyenKho.builder().id(1).bienTheSanPham(bienThe).soLuongChuyen(10).build();

        assertThrows(DataIntegrityViolationException.class,
                () -> service.taoPhieuNhatChuyenKho(phieuChuyen, phieuXuat, List.of(dong)));
    }

    // ══════════════════════════ Hoàn tất nhặt (đặc tả bước 9) ══════════════════════════

    @Test
    @DisplayName("Hoàn tất phiếu nhặt chuyển kho: lô đã phân bổ ghi vào PX-CK (cộng đã đặt), phiếu Đã nhặt; không tạo phiếu xuất bán, không đụng đơn")
    void hoanTat_chuyenKho_ghiLoVaoPhieuXuat() {
        DanhSachNhatHang pl = phieuNhat("dang_nhat", "10");
        tonHaiLo("6", "20");
        when(phanBoLoNhatHangRepository.findByPhieuNhatId(PL)).thenReturn(List.of(phanBo(pl, lo5, "6"), phanBo(pl, lo6, "4")));

        DanhSachNhatHangDto kq = service.hoanTatNhatHang(PL);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PickLoHangRequest.Item>> lo = ArgumentCaptor.forClass(List.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<Integer, TonKhoTheoLo>> ton = ArgumentCaptor.forClass(Map.class);
        verify(phieuXuatKhoService).ghiLoChoBienThe(same(phieuXuat), same(bienThe), ton.capture(), lo.capture(), eq(PL));
        assertEquals(Set.of(5, 6), ton.getValue().keySet());
        assertEquals(2, lo.getValue().size());
        assertEquals(5, lo.getValue().get(0).getLoHangId());
        assertSo("6", lo.getValue().get(0).getSoLuongXuat());
        assertEquals(6, lo.getValue().get(1).getLoHangId());
        assertSo("4", lo.getValue().get(1).getSoLuongXuat());

        assertEquals("da_nhat", pl.getTrangThai(), "không rơi vào nhánh Đã hủy của phiếu không có đơn");
        assertNotNull(pl.getNgayHoanTat());
        verify(phieuXuatKhoRepository, never()).save(any());
        verify(chiTietPhieuXuatKhoRepository, never()).save(any());
        verifyNoInteractions(donBanHangRepository);
        assertEquals(NhatHangServiceImpl.LOAI_CHUYEN_KHO, kq.getLoaiPhieu());
        assertEquals("PX-TRF-1", kq.getSoPhieuChuyen());
        assertEquals(PCK, kq.getPhieuChuyenKhoId());
        assertEquals(PX, kq.getPhieuXuatKhoId());
        assertEquals(0, kq.getTongDonHang());

        // Thứ tự khóa chung với Chọn lô / Hủy phiếu chuyển: phiếu chuyển → dòng nhặt → phiếu nhặt → PX-CK → tồn
        var thuTu = inOrder(entityManager, chiTietNhatHangRepository, loDangGiuService, phieuXuatKhoService);
        thuTu.verify(entityManager).refresh(phieuChuyen, LockModeType.PESSIMISTIC_WRITE);
        thuTu.verify(chiTietNhatHangRepository).findByDanhSachNhatHangIdWithLockOrderByIdAsc(PL);
        thuTu.verify(entityManager).refresh(pl, LockModeType.PESSIMISTIC_WRITE);
        thuTu.verify(entityManager).refresh(phieuXuat, LockModeType.PESSIMISTIC_WRITE);
        thuTu.verify(loDangGiuService).khoaTonTheoBienThe(KHO, List.of(BT));
        thuTu.verify(phieuXuatKhoService).ghiLoChoBienThe(any(), any(), any(), any(), any());
        // phần phiếu khác giữ không tính chính phiếu nhặt này
        verify(loDangGiuService).dangGiuTheoLo(eq(KHO), any(), eq(PL), isNull());

        // nhật ký: phiếu nhặt + phiếu chuyển (trạng thái phiếu chuyển không đổi)
        ArgumentCaptor<LichSuThayDoi> nk = ArgumentCaptor.forClass(LichSuThayDoi.class);
        verify(lichSuThayDoiService, times(2)).create(nk.capture());
        LichSuThayDoi nkPhieuChuyen = nk.getAllValues().get(1);
        assertEquals(ITable.phieu_chuyen_kho, nkPhieuChuyen.getLoaiThamChieu());
        assertEquals(PCK, nkPhieuChuyen.getIdThamChieu());
        assertEquals(IHanhDong.nhat_xong_chuyen_kho, nkPhieuChuyen.getHanhDong());
        assertEquals(IChuyenKho.DA_DUYET, phieuChuyen.getTrangThai());
    }

    @Test
    @DisplayName("Hoàn tất: phân bổ đã lưu thiếu (lô hụt lúc duyệt) → bù FIFO từ lô còn lại rồi mới ghi PX-CK")
    void hoanTat_phanBoThieu_buFifo() {
        DanhSachNhatHang pl = phieuNhat("dang_nhat", "10");
        tonHaiLo("6", "20");
        when(phanBoLoNhatHangRepository.findByPhieuNhatId(PL)).thenReturn(List.of(phanBo(pl, lo5, "6")));

        service.hoanTatNhatHang(PL);

        ArgumentCaptor<PhanBoLoNhatHang> bu = ArgumentCaptor.forClass(PhanBoLoNhatHang.class);
        verify(phanBoLoNhatHangRepository).save(bu.capture());
        assertEquals(6, bu.getValue().getLoHang().getId());
        assertSo("4", bu.getValue().getSoLuong());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PickLoHangRequest.Item>> lo = ArgumentCaptor.forClass(List.class);
        verify(phieuXuatKhoService).ghiLoChoBienThe(any(), any(), any(), lo.capture(), eq(PL));
        assertSo("10", lo.getValue().stream().map(PickLoHangRequest.Item::getSoLuongXuat).reduce(BigDecimal.ZERO, BigDecimal::add));
        assertEquals("da_nhat", pl.getTrangThai());
    }

    @Test
    @DisplayName("Hoàn tất: các lô không còn đủ tồn → 409 báo kiểm kê, phiếu nhặt giữ nguyên, PX-CK không có lô")
    void hoanTat_thieuTonTheoLo_409() {
        DanhSachNhatHang pl = phieuNhat("dang_nhat", "10");
        tonHaiLo("6", "2");
        when(phanBoLoNhatHangRepository.findByPhieuNhatId(PL)).thenReturn(List.of(phanBo(pl, lo5, "6")));

        CommonException ex = xungDot(assertThrows(CommonException.class, () -> service.hoanTatNhatHang(PL)));

        assertTrue(ex.getMessage().contains("Không đủ tồn theo lô"), ex.getMessage());
        assertEquals("dang_nhat", pl.getTrangThai());
        verify(phieuXuatKhoService, never()).ghiLoChoBienThe(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Hoàn tất: phiếu chuyển đã hủy / đã xuất → 409, phiếu nhặt không đổi (không Đã hủy, không Đã nhặt)")
    void hoanTat_phieuChuyenKhongConDaDuyet_409() {
        for (String tt : List.of(IChuyenKho.DA_HUY, IChuyenKho.DANG_VAN_CHUYEN)) {
            phieuChuyen.setTrangThai(tt);
            DanhSachNhatHang pl = phieuNhat("dang_nhat", "10");
            tonHaiLo("6", "20");

            CommonException ex = xungDot(assertThrows(CommonException.class, () -> service.hoanTatNhatHang(PL)));

            assertTrue(ex.getMessage().contains("PX-TRF-1"), ex.getMessage());
            assertEquals("dang_nhat", pl.getTrangThai());
        }
        verify(phieuXuatKhoService, never()).ghiLoChoBienThe(any(), any(), any(), any(), any());
        verify(danhSachNhatHangRepository, never()).save(any());
    }

    @Test
    @DisplayName("Hoàn tất: chưa nhặt đủ 100% → chặn (số gọn 7/10, không 7.000); PX-CK không còn Nháp → 409")
    void hoanTat_chuaNhatDuHoacPhieuXuatKhongConNhap() {
        DanhSachNhatHang pl = phieuNhat("dang_nhat", "7.000");
        pl.getChiTietNhatHangs().get(0).setSoLuongCanNhat(new BigDecimal("10.000"));
        tonHaiLo("6", "20");
        CommonException ex = assertThrows(CommonException.class, () -> service.hoanTatNhatHang(PL));
        assertTrue(ex.getMessage().contains("Chưa nhặt đủ"), ex.getMessage());
        assertTrue(ex.getMessage().contains("mới nhặt 7/10"), ex.getMessage());
        assertEquals("dang_nhat", pl.getTrangThai());

        phieuNhat("dang_nhat", "10");
        phieuXuat.setTrangThai(ITrangThaiPhieuXuat.DA_HUY);
        xungDot(assertThrows(CommonException.class, () -> service.hoanTatNhatHang(PL)));
        verify(phieuXuatKhoService, never()).ghiLoChoBienThe(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Hoàn tất: phiếu chưa phân công, hoặc nhân viên không phải người được giao → 409; đã nhặt xong rồi → chặn")
    void hoanTat_quyenNguoiNhat() {
        DanhSachNhatHang pl = phieuNhat("dang_nhat", "10");
        tonHaiLo("6", "20");
        pl.setNguoiNhat(null);
        xungDot(assertThrows(CommonException.class, () -> service.hoanTatNhatHang(PL)));

        pl = phieuNhat("dang_nhat", "10");
        pl.setNguoiNhat(NguoiDung.builder().id(77).hoTen("Người khác").build());
        xungDot(assertThrows(CommonException.class, () -> service.hoanTatNhatHang(PL)));

        phieuNhat("da_nhat", "10");
        assertThrows(CommonException.class, () -> service.hoanTatNhatHang(PL));
        verify(phieuXuatKhoService, never()).ghiLoChoBienThe(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Hoàn tất: PX-CK cũ tách một biến thể thành hai dòng gốc (3 + 7) → cộng dồn = 10, ghi lô bình thường")
    void hoanTat_haiDongGocCungBienThe_congDon() {
        DanhSachNhatHang pl = phieuNhat("dang_nhat", "10");
        tonHaiLo("6", "20");
        when(phanBoLoNhatHangRepository.findByPhieuNhatId(PL)).thenReturn(List.of(phanBo(pl, lo5, "6"), phanBo(pl, lo6, "4")));
        when(chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(PX)).thenReturn(List.of(
                ChiTietPhieuXuatKho.builder().id(600).phieuXuatKho(phieuXuat).bienTheSanPham(bienThe).soLuongXuat(new BigDecimal("3")).build(),
                ChiTietPhieuXuatKho.builder().id(601).phieuXuatKho(phieuXuat).bienTheSanPham(bienThe).soLuongXuat(new BigDecimal("7.000")).build()));

        service.hoanTatNhatHang(PL);

        verify(phieuXuatKhoService).ghiLoChoBienThe(same(phieuXuat), same(bienThe), any(), any(), eq(PL));
        assertEquals("da_nhat", pl.getTrangThai());
    }

    @Test
    @DisplayName("Hoàn tất: PX-CK không có dòng gốc của biến thể → 409 nói rõ thiếu dòng (không in 'ghi 0'); dòng gốc lệch số → 409 in số gọn")
    void hoanTat_thieuDongGocHoacLechSo_409() {
        DanhSachNhatHang pl = phieuNhat("dang_nhat", "10");
        tonHaiLo("6", "20");
        when(chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(PX)).thenReturn(List.of());

        CommonException ex = xungDot(assertThrows(CommonException.class, () -> service.hoanTatNhatHang(PL)));
        assertTrue(ex.getMessage().contains("không có dòng sản phẩm [AK-93]"), ex.getMessage());
        assertFalse(ex.getMessage().contains("ghi 0"), ex.getMessage());

        when(chiTietPhieuXuatKhoRepository.findByPhieuXuatKhoIdAndLoHangIsNull(PX)).thenReturn(List.of(ChiTietPhieuXuatKho
                .builder().id(600).phieuXuatKho(phieuXuat).bienTheSanPham(bienThe).soLuongXuat(new BigDecimal("3.000")).build()));
        ex = xungDot(assertThrows(CommonException.class, () -> service.hoanTatNhatHang(PL)));
        assertTrue(ex.getMessage().contains("là 10 nhưng phiếu xuất PX-CK-1 ghi 3."), ex.getMessage());

        assertEquals("dang_nhat", pl.getTrangThai());
        verify(phieuXuatKhoService, never()).ghiLoChoBienThe(any(), any(), any(), any(), any());
    }

    // ══════════════════════════ Quét mã / phân công: khóa rồi kiểm lại trạng thái ══════════════════════════

    /** Phiếu nhặt gom đơn bán (không có PX-CK) id 81, giao cho nhân viên 9, một dòng AK-93 cần 10 đã quét {@code daQuet}. */
    private DanhSachNhatHang phieuNhatBan(String trangThai, String daQuet) {
        DanhSachNhatHang pl = DanhSachNhatHang.builder().id(81).maPickList(TIEN_TO + "002").khoXuat(kho)
                .trangThai(trangThai).ngayTao(Instant.now())
                .nguoiNhat(NguoiDung.builder().id(NHAN_VIEN).hoTen("Thủ kho A").build()).build();
        ChiTietNhatHang dong = ChiTietNhatHang.builder().id(2).danhSachNhatHang(pl).bienTheSanPham(bienThe)
                .soLuongCanNhat(new BigDecimal("10")).soLuongDaQuet(new BigDecimal(daQuet)).build();
        pl.setChiTietNhatHangs(new ArrayList<>(List.of(dong)));
        when(danhSachNhatHangRepository.findById(81)).thenReturn(Optional.of(pl));
        when(chiTietNhatHangRepository.findByDanhSachNhatHangIdWithLockOrderByIdAsc(81)).thenReturn(new ArrayList<>(List.of(dong)));
        return pl;
    }

    /** Trong lúc chờ khóa, giao dịch khác đã đưa phiếu nhặt sang {@code trangThaiMoi}: refresh có khóa đọc ra bản đó. */
    private void choKhoaXongThi(DanhSachNhatHang pl, String trangThaiMoi) {
        doAnswer(i -> {
            pl.setTrangThai(trangThaiMoi);
            return null;
        }).when(entityManager).refresh(pl, LockModeType.PESSIMISTIC_WRITE);
    }

    private static QuetBarcodeRequest quet(String ma) {
        return QuetBarcodeRequest.builder().barcode(ma).build();
    }

    @Test
    @DisplayName("Quét mã (phiếu chuyển kho & phiếu bán): khóa dòng nhặt rồi phiếu nhặt, nạp lại dòng; chờ nhặt → đang nhặt, số quét +1")
    void quet_khoaTheoThuTu_roiGhi() {
        when(chiTietNhatHangRepository.save(any(ChiTietNhatHang.class))).thenAnswer(i -> i.getArgument(0));
        for (DanhSachNhatHang pl : List.of(phieuNhat("cho_nhat", "3"), phieuNhatBan("cho_nhat", "3"))) {
            clearInvocations(entityManager, chiTietNhatHangRepository, danhSachNhatHangRepository);

            var kq = service.quetBarcode(pl.getId(), quet("ak-93"));

            ChiTietNhatHang dong = pl.getChiTietNhatHangs().get(0);
            var thuTu = inOrder(chiTietNhatHangRepository, entityManager, danhSachNhatHangRepository);
            thuTu.verify(chiTietNhatHangRepository).findByDanhSachNhatHangIdWithLockOrderByIdAsc(pl.getId());
            thuTu.verify(entityManager).refresh(pl, LockModeType.PESSIMISTIC_WRITE);
            thuTu.verify(danhSachNhatHangRepository).save(pl);
            thuTu.verify(entityManager).refresh(dong);
            thuTu.verify(chiTietNhatHangRepository).save(dong);
            assertEquals("dang_nhat", pl.getTrangThai());
            assertSo("4", dong.getSoLuongDaQuet());
            assertSo("4", kq.getSoLuongDaQuet());
            verify(chiTietNhatHangRepository, never()).findByIdWithLock(any());
        }
    }

    @Test
    @DisplayName("Quét mã chạy chồng với Hủy phiếu chuyển / Hoàn tất / đơn hủy: sau khi có khóa phiếu đã Đã hủy / Đã nhặt → 409, không ghi đè thành Đang nhặt")
    void quet_sauKhiPhieuDaHuyHoacDaNhat_409() {
        for (String moi : List.of("da_huy", "da_nhat")) {
            for (DanhSachNhatHang pl : List.of(phieuNhat("cho_nhat", "3"), phieuNhatBan("dang_nhat", "3"))) {
                choKhoaXongThi(pl, moi);

                xungDot(assertThrows(CommonException.class, () -> service.quetBarcode(pl.getId(), quet("AK-93"))));

                assertEquals(moi, pl.getTrangThai(), "không bị ghi đè thành dang_nhat");
                assertSo("3", pl.getChiTietNhatHangs().get(0).getSoLuongDaQuet());
            }
        }
        verify(danhSachNhatHangRepository, never()).save(any());
        verify(chiTietNhatHangRepository, never()).save(any());
    }

    @Test
    @DisplayName("Phân công chạy chồng với Hủy phiếu chuyển / Hoàn tất: khóa dòng nhặt rồi phiếu nhặt; phiếu đã Đã hủy / Đã nhặt → 409, người nhặt không đổi")
    void phanCong_sauKhiPhieuDaHuyHoacDaNhat_409() {
        dangNhap(IRoleType.quan_ly_kho, KHO);
        NguoiDung nguoiMoi = NguoiDung.builder().id(12).hoTen("Thủ kho B").trangThai(1).build();
        when(nguoiDungRepository.findById(12)).thenReturn(Optional.of(nguoiMoi));
        for (String moi : List.of("da_huy", "da_nhat")) {
            for (DanhSachNhatHang pl : List.of(phieuNhat("cho_nhat", "0"), phieuNhatBan("dang_nhat", "3"))) {
                choKhoaXongThi(pl, moi);

                xungDot(assertThrows(CommonException.class,
                        () -> service.phanCongNguoiNhat(pl.getId(), new PhanCongNguoiNhatRequest(12, null))));

                assertEquals(moi, pl.getTrangThai());
                assertEquals(NHAN_VIEN, pl.getNguoiNhat().getId());
                var thuTu = inOrder(chiTietNhatHangRepository, entityManager);
                thuTu.verify(chiTietNhatHangRepository).findByDanhSachNhatHangIdWithLockOrderByIdAsc(pl.getId());
                thuTu.verify(entityManager).refresh(pl, LockModeType.PESSIMISTIC_WRITE);
            }
        }
        verify(danhSachNhatHangRepository, never()).save(any());
        verifyNoInteractions(lichSuThayDoiService);
    }

    @Test
    @DisplayName("Phân công phiếu còn mở: khóa rồi mới lưu người nhặt mới")
    void phanCong_phieuConMo_luuSauKhiKhoa() {
        dangNhap(IRoleType.quan_ly_kho, KHO);
        NguoiDung nguoiMoi = NguoiDung.builder().id(12).hoTen("Thủ kho B").trangThai(1).build();
        when(nguoiDungRepository.findById(12)).thenReturn(Optional.of(nguoiMoi));
        DanhSachNhatHang pl = phieuNhatBan("cho_nhat", "0");

        service.phanCongNguoiNhat(81, new PhanCongNguoiNhatRequest(12, null));

        assertSame(nguoiMoi, pl.getNguoiNhat());
        var thuTu = inOrder(chiTietNhatHangRepository, entityManager, danhSachNhatHangRepository);
        thuTu.verify(chiTietNhatHangRepository).findByDanhSachNhatHangIdWithLockOrderByIdAsc(81);
        thuTu.verify(entityManager).refresh(pl, LockModeType.PESSIMISTIC_WRITE);
        thuTu.verify(danhSachNhatHangRepository).save(pl);
    }

    // ══════════════════════════ Hủy theo phiếu chuyển ══════════════════════════

    @Test
    @DisplayName("Hủy khi chờ nhặt (chưa quét): phiếu nhặt Đã hủy, không có lệnh trả kệ, màn nhặt nhận PICK_LIST_CANCELLED")
    void huy_choNhat_khongTraKe() {
        DanhSachNhatHang pl = phieuNhat("cho_nhat", "0");

        assertSame(pl, service.huyPhieuNhatChuyenKho(phieuXuat, "PX-TRF-1"));

        assertEquals("da_huy", pl.getTrangThai());
        verify(canhBaoRepository, never()).save(any());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> tin = ArgumentCaptor.forClass(Map.class);
        verify(outboundWebSocketHandler).sendPickListEvent(eq(PL), eq("PICK_LIST_CANCELLED"), tin.capture());
        assertEquals(NhatHangServiceImpl.LY_DO_HOAN_KE_CHUYEN_KHO_HUY, tin.getValue().get("lyDo"));
        // thứ tự khóa: dòng nhặt rồi phiếu nhặt (bên gọi đã khóa phiếu chuyển)
        var thuTu = inOrder(chiTietNhatHangRepository, entityManager);
        thuTu.verify(chiTietNhatHangRepository).findByDanhSachNhatHangIdWithLockOrderByIdAsc(PL);
        thuTu.verify(entityManager).refresh(pl, LockModeType.PESSIMISTIC_WRITE);
    }

    @Test
    @DisplayName("Hủy khi đang nhặt: số đã quét sinh lệnh trả kệ HOAN_KE_CHO_CAT, số quét về 0, phiếu nhặt Đã hủy")
    void huy_dangNhat_traKeSoDaQuet() {
        DanhSachNhatHang pl = phieuNhat("dang_nhat", "3");

        service.huyPhieuNhatChuyenKho(phieuXuat, "PX-TRF-1");

        ArgumentCaptor<CanhBao> cb = ArgumentCaptor.forClass(CanhBao.class);
        verify(canhBaoRepository).save(cb.capture());
        assertEquals("HOAN_KE_CHO_CAT", cb.getValue().getLoaiCanhBao());
        assertSo("3", cb.getValue().getSoLuongHienTai());
        assertSo(String.valueOf(PL), cb.getValue().getNguongCanhBao());
        assertEquals(0, cb.getValue().getTrangThai());
        assertSame(kho, cb.getValue().getKho());
        assertSo("0", pl.getChiTietNhatHangs().get(0).getSoLuongDaQuet());
        assertEquals("da_huy", pl.getTrangThai());
        verify(outboundWebSocketHandler).sendPickListEvent(eq(PL), eq("PICK_LIST_CANCELLED"), any());
    }

    @Test
    @DisplayName("Hủy khi đã nhặt xong: trả kệ toàn bộ số đã nhặt, phiếu nhặt Đã hủy (lô PX-CK do bên gọi nhả khi hủy PX-CK)")
    void huy_daNhat_traKeToanBo() {
        DanhSachNhatHang pl = phieuNhat("da_nhat", "10");

        service.huyPhieuNhatChuyenKho(phieuXuat, "PX-TRF-1");

        ArgumentCaptor<CanhBao> cb = ArgumentCaptor.forClass(CanhBao.class);
        verify(canhBaoRepository).save(cb.capture());
        assertSo("10", cb.getValue().getSoLuongHienTai());
        assertEquals("da_huy", pl.getTrangThai());
        verify(phieuXuatKhoService, never()).huyPhieuXuatCon(any());
    }

    @Test
    @DisplayName("Hủy: phiếu nhặt đã hủy giữ nguyên; PX-CK không có phiếu nhặt (phiếu cũ) → null, không làm gì")
    void huy_daHuyHoacKhongCoPhieuNhat() {
        DanhSachNhatHang pl = phieuNhat("da_huy", "0");
        assertSame(pl, service.huyPhieuNhatChuyenKho(phieuXuat, "PX-TRF-1"));
        verify(danhSachNhatHangRepository, never()).save(any());
        verifyNoInteractions(outboundWebSocketHandler);

        when(danhSachNhatHangRepository.findByPhieuXuatKho_Id(PX)).thenReturn(Optional.empty());
        assertNull(service.huyPhieuNhatChuyenKho(phieuXuat, "PX-TRF-1"));
        verify(canhBaoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Hàng cần hoàn kệ: lý do theo loại phiếu nhặt (phiếu chuyển kho bị hủy / đơn bị hủy)")
    void hangCanHoanKe_lyDoTheoLoaiPhieu() {
        DanhSachNhatHang plChuyen = phieuNhat("da_huy", "0");
        DanhSachNhatHang plBan = DanhSachNhatHang.builder().id(81).maPickList(TIEN_TO + "002").khoXuat(kho).build();
        when(danhSachNhatHangRepository.findById(81)).thenReturn(Optional.of(plBan));
        when(canhBaoRepository.findByKhoIdAndLoaiCanhBaoAndTrangThai(KHO, "HOAN_KE_CHO_CAT", 0)).thenReturn(List.of(
                CanhBao.builder().id(1).bienTheSanPham(bienThe).kho(kho).soLuongHienTai(BigDecimal.ONE)
                        .nguongCanhBao(BigDecimal.valueOf(PL)).trangThai(0).build(),
                CanhBao.builder().id(2).bienTheSanPham(bienThe).kho(kho).soLuongHienTai(BigDecimal.ONE)
                        .nguongCanhBao(BigDecimal.valueOf(81)).trangThai(0).build()));

        List<HangCanHoanKeDto> ds = service.getDanhSachHangCanHoanKe(null);

        assertEquals("Phiếu chuyển kho bị hủy", ds.get(0).getLyDo());
        assertEquals(plChuyen.getMaPickList(), ds.get(0).getMaPickList());
        assertEquals("Đơn hàng bị hủy trong luồng xuất kho", ds.get(1).getLyDo());
    }

    @Test
    @DisplayName("Đơn bị hủy không đụng phiếu nhặt chuyển kho (phiếu không có đơn)")
    void donBiHuy_khongDungPhieuNhatChuyenKho() {
        DanhSachNhatHang pl = phieuNhat("dang_nhat", "3");
        DonBanHang don = DonBanHang.builder().id(101).soDonHang("SHP-1").danhSachNhatHang(pl).build();

        service.xuLyDonBiHuyTrongPickList(don);

        assertEquals("dang_nhat", pl.getTrangThai());
        verifyNoInteractions(chiTietNhatHangRepository, canhBaoRepository, outboundWebSocketHandler);
    }

    // ══════════════════════════ Đọc ══════════════════════════

    @Test
    @DisplayName("Chi tiết phiếu nhặt chuyển kho: loại CHUYEN_KHO, số phiếu chuyển, kho nhận, số PX-CK, 0 đơn")
    void chiTiet_loaiChuyenKho() {
        phieuNhat("cho_nhat", "0");

        DanhSachNhatHangDto dto = service.getChiTietPickList(PL);

        assertEquals(NhatHangServiceImpl.LOAI_CHUYEN_KHO, dto.getLoaiPhieu());
        assertEquals(PCK, dto.getPhieuChuyenKhoId());
        assertEquals("PX-TRF-1", dto.getSoPhieuChuyen());
        assertEquals(IChuyenKho.DA_DUYET, dto.getTrangThaiPhieuChuyen());
        assertEquals("Cửa hàng 1", dto.getTenKhoNhan());
        assertEquals("PX-CK-1", dto.getSoPhieuXuat());
        assertEquals(0, dto.getTongDonHang());
        verifyNoInteractions(bangChungDongGoiService);
    }

    // ══════════════════════════ Chặn chọn lô tay khi phiếu nhặt mở ══════════════════════════

    @Test
    @DisplayName("Chọn lô tay PX-CK khi có phiếu nhặt chưa hủy (chờ nhặt / đang nhặt / ĐÃ NHẶT) → 409; phiếu nhặt đã hủy thì đi tiếp đường chọn tay")
    void chonLoTay_phieuNhatMo_biChan() {
        PhieuXuatKhoService px = new PhieuXuatKhoService(phieuXuatKhoRepository);
        ReflectionTestUtils.setField(px, "entityManager", entityManager);
        ReflectionTestUtils.setField(px, "danhSachNhatHangRepository", danhSachNhatHangRepository);
        ReflectionTestUtils.setField(px, "chiTietPhieuXuatKhoRepository", chiTietPhieuXuatKhoRepository);
        dangNhap(IRoleType.quan_tri_vien, null);
        when(phieuXuatKhoRepository.findById(PX)).thenReturn(Optional.of(phieuXuat));
        PickLoHangRequest yc = new PickLoHangRequest();
        yc.setChiTietPhieuXuatKhoId(600);

        for (String tt : List.of("cho_nhat", "dang_nhat", "da_nhat")) {
            DanhSachNhatHang pl = phieuNhat(tt, "0");
            CommonException ex = xungDot(assertThrows(CommonException.class, () -> px.pickLoHang(PX, yc)));
            assertTrue(ex.getMessage().contains(pl.getMaPickList()), ex.getMessage());
        }
        // đã nhặt xong: lô PX-CK lấy theo phiếu nhặt, chọn tay (mọi vai trò kho) sẽ làm lô chứng từ lệch lô đã nhặt
        phieuNhat("da_nhat", "10");
        assertTrue(xungDot(assertThrows(CommonException.class, () -> px.pickLoHang(PX, yc))).getMessage().contains("đã nhặt xong"));
        verify(chiTietPhieuXuatKhoRepository, never()).findById(any());

        phieuNhat("da_huy", "0");
        RuntimeException tiep = assertThrows(RuntimeException.class, () -> px.pickLoHang(PX, yc));
        assertEquals("Không tìm thấy dòng phiếu xuất gốc", tiep.getMessage(), "qua được bước chặn");
    }

    // ══════════════════════════ Sửa sau rà soát 29/10 ══════════════════════════

    private static PhanBoLoNhatHangRequest layLo(LoHang lo, String soLuong) {
        return PhanBoLoNhatHangRequest.builder()
                .phanBo(List.of(new PhanBoLoNhatHangRequest.Item(lo.getId(), new BigDecimal(soLuong)))).build();
    }

    @Test
    @DisplayName("Lưu phân bổ lô chạy chồng với Hoàn tất / Hủy: khóa dòng nhặt rồi phiếu nhặt TRƯỚC khi kiểm trạng thái; phiếu đã Đã nhặt / Đã hủy → 409, không xóa phân bổ")
    void luuPhanBoLo_khoaTruocRoiMoiKiem_409() {
        for (String moi : List.of("da_nhat", "da_huy")) {
            DanhSachNhatHang pl = phieuNhat("dang_nhat", "3");
            choKhoaXongThi(pl, moi);
            clearInvocations(chiTietNhatHangRepository, entityManager);

            xungDot(assertThrows(CommonException.class, () -> service.luuPhanBoLo(PL, 1, layLo(lo5, "10"))));

            var thuTu = inOrder(chiTietNhatHangRepository, entityManager);
            thuTu.verify(chiTietNhatHangRepository).findByDanhSachNhatHangIdWithLockOrderByIdAsc(PL);
            thuTu.verify(entityManager).refresh(pl, LockModeType.PESSIMISTIC_WRITE);
            assertEquals(moi, pl.getTrangThai());
        }
        verify(phanBoLoNhatHangRepository, never()).deleteByChiTietId(any());
        verify(chiTietNhatHangRepository, never()).findByIdWithLock(any());
    }

    @Test
    @DisplayName("Lưu phân bổ lô phiếu nhặt đơn bán: không lấy phần phiếu chuyển đang giữ chỗ (chưa chọn lô) → 409 nêu số giữ chỗ, không xóa phân bổ")
    void luuPhanBoLo_phieuBan_khongLayPhanGiuChoChuyen() {
        phieuNhatBan("dang_nhat", "0");
        tonHaiLo("6", "20");
        when(loHangRepository.findById(6)).thenReturn(Optional.of(lo6));
        when(giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(eq(KHO), any())).thenReturn(Map.of(BT, new BigDecimal("20")));

        CommonException ex = xungDot(assertThrows(CommonException.class, () -> service.luuPhanBoLo(81, 2, layLo(lo6, "10"))));

        assertTrue(ex.getMessage().contains("chỉ còn 6 có thể lấy"), ex.getMessage());
        assertTrue(ex.getMessage().contains("phiếu chuyển kho đang giữ chỗ 20"), ex.getMessage());
        verify(phanBoLoNhatHangRepository, never()).deleteByChiTietId(any());
    }

    @Test
    @DisplayName("Phiếu nhặt của PX-CK: phân bổ FIFO không trừ giữ chỗ phiếu chuyển (giữ chỗ đó gồm chính phiếu này)")
    void taoPhieuNhat_chuyenKho_khongTruGiuCho() {
        tonHaiLo("6", "20");
        when(danhSachNhatHangRepository.soDuoiLonNhat(TIEN_TO)).thenReturn(2);
        when(giuChoChuyenKhoService.taiKhoNgoaiPhieuNhat(any(), any())).thenReturn(Map.of(BT, new BigDecimal("10")));
        ChiTietPhieuChuyenKho dong = ChiTietPhieuChuyenKho.builder().id(1).phieuChuyenKho(phieuChuyen)
                .bienTheSanPham(bienThe).soLuongChuyen(10).build();

        service.taoPhieuNhatChuyenKho(phieuChuyen, phieuXuat, List.of(dong));

        ArgumentCaptor<PhanBoLoNhatHang> pb = ArgumentCaptor.forClass(PhanBoLoNhatHang.class);
        verify(phanBoLoNhatHangRepository, atLeastOnce()).save(pb.capture());
        assertSo("10", pb.getAllValues().stream().map(PhanBoLoNhatHang::getSoLuong).reduce(BigDecimal.ZERO, BigDecimal::add));
        verify(giuChoChuyenKhoService, never()).taiKhoNgoaiPhieuNhat(any(), any());
    }

    private CanhBao lenhHoanKe(Kho k, int trangThai) {
        CanhBao cb = CanhBao.builder().id(300).loaiCanhBao("HOAN_KE_CHO_CAT").kho(k).bienTheSanPham(bienThe)
                .soLuongHienTai(new BigDecimal("7")).trangThai(trangThai).build();
        when(canhBaoRepository.findById(300)).thenReturn(Optional.of(cb));
        return cb;
    }

    @Test
    @DisplayName("Xác nhận hoàn kệ: lệnh của kho khác → 403, không đóng lệnh; lệnh đã cất kệ (câu UPDATE có điều kiện đổi 0 dòng) → 409; cả hai không phát sự kiện cộng tồn")
    void xacNhanHoanKe_khoKhacHoacDaXuLy() {
        lenhHoanKe(cuaHang, 0);
        CommonException ex = assertThrows(CommonException.class, () -> service.xacNhanHoanKe(300));
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus(), ex.getMessage());
        verify(canhBaoRepository, never()).danhDauDaCatKe(any(), any(), any());

        lenhHoanKe(kho, 0);
        when(canhBaoRepository.danhDauDaCatKe(eq(300), any(), eq(NHAN_VIEN))).thenReturn(0);
        xungDot(assertThrows(CommonException.class, () -> service.xacNhanHoanKe(300)));

        verify(canhBaoRepository, never()).save(any());
        verifyNoInteractions(eventPublisher);
    }

    @Test
    @DisplayName("Xác nhận hoàn kệ đúng kho, lệnh còn chờ: đóng lệnh bằng câu UPDATE (người xử lý = người bấm), phát sự kiện cộng tồn một lần")
    void xacNhanHoanKe_dungKho_daCatKe() {
        lenhHoanKe(kho, 0);
        when(canhBaoRepository.danhDauDaCatKe(eq(300), any(), eq(NHAN_VIEN))).thenReturn(1);

        service.xacNhanHoanKe(300);

        verify(canhBaoRepository).danhDauDaCatKe(eq(300), any(java.time.Instant.class), eq(NHAN_VIEN));
        verify(canhBaoRepository, never()).save(any());
        verify(eventPublisher, times(1)).publishEvent(any(org.springframework.context.ApplicationEvent.class));
    }
}
