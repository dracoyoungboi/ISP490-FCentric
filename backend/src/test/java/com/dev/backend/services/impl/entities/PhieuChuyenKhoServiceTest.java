package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.TrangThaiPhieuNhap;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.constant.variables.ITrangThaiPhieuXuat;
import com.dev.backend.dto.request.ChiTietPhieuXuatKhoCreating;
import com.dev.backend.dto.request.PhieuChuyenKhoCreating;
import com.dev.backend.dto.request.PhieuChuyenKhoYeuCau;
import com.dev.backend.dto.response.customize.PhieuChuyenKhoDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.impl.multitable.GiuChoChuyenKhoService;
import com.dev.backend.services.impl.multitable.KhaDungChuyenKhoService;
import com.dev.backend.services.impl.multitable.LoDangGiuService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.multitable.NhatHangService;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Chuyển kho nội bộ theo đặc tả BA (UC-7.1): tạo (giữ chỗ), duyệt + lệnh điều động, hủy, xác nhận xuất (BR-TRF-02, giấy
 * đi đường XKNB), nhận đủ / nhận lệch (biên bản), xử lý chênh lệch (ghi giảm / giao bù), nhập hoàn trả, và phạm vi kho.
 * Kho tổng = 1 (kho xuất), Cửa hàng 1 = 2 (kho nhận), Cửa hàng 2 = 3 (kho thứ ba), Kho trung chuyển = 99.
 * Phiếu chuyển id 50, biến thể 93 (AK-93), lô 5 giá vốn 100, phiếu xuất con id 60.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PhieuChuyenKhoServiceTest {

    private static final int KHO_TONG = 1, CUA_HANG = 2, KHO_KHAC = 3, TRANSIT = 99;
    private static final int PCK = 50, BT = 93, LO = 5, LO_2 = 6, PX = 60, NGUOI = 7;
    private static final String HOM_NAY = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);

    @Mock private PhieuChuyenKhoRepository pckRepo;
    @Mock private ChiTietPhieuChuyenKhoRepository ctPckRepo;
    @Mock private BienBanGiaoNhanRepository bbRepo;
    @Mock private ChiTietBienBanGiaoNhanRepository ctBbRepo;
    @Mock private PhieuDieuChinhKhoRepository dckRepo;
    @Mock private ChiTietPhieuDieuChinhRepository ctDckRepo;
    @Mock private PhieuXuatKhoRepository pxRepo;
    @Mock private ChiTietPhieuXuatKhoRepository ctPxRepo;
    @Mock private PhieuNhapKhoRepository pnRepo;
    @Mock private ChiTietPhieuNhapKhoRepository ctPnRepo;
    @Mock private TonKhoTheoLoRepository tonRepo;
    @Mock private LichSuGiaoDichKhoRepository lichSuRepo;
    @Mock private KhoRepository khoRepo;
    @Mock private NguoiDungRepository ndRepo;
    @Mock private PhanQuyenNguoiDungKhoRepository pqRepo;
    @Mock private BienTheSanPhamRepository btRepo;
    @Mock private LoHangRepository loRepo;
    @Mock private PhieuXuatKhoService pxService;
    @Mock private DieuHanhHeThongService cauHinh;
    @Mock private LichSuThayDoiService nhatKy;
    @Mock private SanPhamQuanAoService sanPhamService;
    @Mock private ChiTietDonBanHangRepository ctDonRepo;
    @Mock private GiuChoChuyenKhoService giuCho;
    @Mock private LoDangGiuService loDangGiu;
    @Mock private ThongBaoChuyenKhoService thongBao;
    @Mock private NhatHangService nhatHang;
    @Mock private DanhSachNhatHangRepository dsnhRepo;
    @Mock private AnhBienBanGiaoNhanService anhBienBan;

    private PhieuChuyenKhoService service;

    private Kho khoTong, cuaHang, khoKhac, transit;
    private BienTheSanPham bienThe;
    private LoHang lo, lo2;
    private int idMoi = 500;

    @BeforeEach
    void setUp() {
        khoTong = Kho.builder().id(KHO_TONG).maKho("KHO_TONG").tenKho("Kho tổng").loaiKho("kho_tong").trangThai(1).build();
        cuaHang = Kho.builder().id(CUA_HANG).maKho("CH_01").tenKho("Cửa hàng 1").loaiKho("cua_hang").trangThai(1).build();
        khoKhac = Kho.builder().id(KHO_KHAC).maKho("CH_02").tenKho("Cửa hàng 2").loaiKho("cua_hang").trangThai(1).build();
        transit = Kho.builder().id(TRANSIT).maKho("KHO_TRANSIT").tenKho("Kho trung chuyển").trangThai(1).build();
        for (Kho k : List.of(khoTong, cuaHang, khoKhac, transit)) {
            when(khoRepo.findById(k.getId())).thenReturn(Optional.of(k));
        }
        when(khoRepo.findByMaKho("KHO_TRANSIT")).thenReturn(Optional.of(transit));

        bienThe = BienTheSanPham.builder().id(BT).maSku("AK-93").sanPham(SanPhamQuanAo.builder().id(4).donViTinh("Cái").build()).build();
        lo = LoHang.builder().id(LO).maLo("LO-5").bienTheSanPham(bienThe).giaVon(new BigDecimal("100")).build();
        lo2 = LoHang.builder().id(LO_2).maLo("LO-6").bienTheSanPham(bienThe).giaVon(new BigDecimal("120")).build();
        when(btRepo.findAllById(any())).thenReturn(List.of(bienThe));
        when(ndRepo.findById(any())).thenAnswer(i -> Optional.of(NguoiDung.builder().id(i.getArgument(0)).hoTen("Người dùng").build()));

        when(pckRepo.save(any(PhieuChuyenKho.class))).thenAnswer(i -> {
            PhieuChuyenKho p = i.getArgument(0);
            if (p.getId() == null) p.setId(++idMoi);
            return p;
        });
        when(pxRepo.save(any(PhieuXuatKho.class))).thenAnswer(i -> {
            PhieuXuatKho p = i.getArgument(0);
            if (p.getId() == null) p.setId(++idMoi);
            return p;
        });
        when(pnRepo.save(any(PhieuNhapKho.class))).thenAnswer(i -> {
            PhieuNhapKho p = i.getArgument(0);
            if (p.getId() == null) p.setId(++idMoi);
            return p;
        });
        when(bbRepo.save(any(BienBanGiaoNhan.class))).thenAnswer(i -> {
            BienBanGiaoNhan b = i.getArgument(0);
            if (b.getId() == null) b.setId(++idMoi);
            return b;
        });
        when(dckRepo.save(any(PhieuDieuChinhKho.class))).thenAnswer(i -> {
            PhieuDieuChinhKho d = i.getArgument(0);
            if (d.getId() == null) d.setId(++idMoi);
            return d;
        });
        when(tonRepo.save(any(TonKhoTheoLo.class))).thenAnswer(i -> i.getArgument(0));
        when(cauHinh.getCauHinhString(eq(DieuHanhHeThongServiceImpl.CAU_HINH_XKNB_CHE_DO), anyString())).thenReturn(IChuyenKho.XKNB_CHAN);

        // Bản thật của phép tính khả dụng (dùng chung với Tổng quan): các ca dưới kiểm cả công thức lẫn câu báo
        KhaDungChuyenKhoService khaDung = new KhaDungChuyenKhoService(tonRepo, ctDonRepo, ctPxRepo, giuCho);
        service = new PhieuChuyenKhoService(pckRepo, ctPckRepo, bbRepo, ctBbRepo, dckRepo, ctDckRepo, pxRepo, ctPxRepo,
                pnRepo, ctPnRepo, tonRepo, lichSuRepo, khoRepo, ndRepo, pqRepo, btRepo, loRepo, pxService, khaDung,
                loDangGiu, cauHinh, nhatKy, sanPhamService, thongBao, nhatHang, dsnhRepo, anhBienBan);
    }

    @AfterEach
    void dangXuat() {
        SecurityContextHolder.clear();
    }

    // ══════════════════════════ Dữ liệu và tiện ích ══════════════════════════

    private void dangNhap(String vaiTro, Kho khoDangChon, Kho... duocPhan) {
        SecurityContextHolder.clear();
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(NGUOI).vaiTro(Set.of(vaiTro))
                .phanQuyenNguoiDungKhos(Arrays.stream(duocPhan)
                        .map(k -> PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(k.getId()).build()).build())
                        .toList())
                .build());
        if (khoDangChon != null) SecurityContextHolder.setKhoId(khoDangChon.getId());
        when(pqRepo.findByNguoiDungIdAndActive(NGUOI)).thenReturn(Arrays.stream(duocPhan)
                .map(k -> PhanQuyenNguoiDungKho.builder().kho(k).trangThai(1).build()).toList());
    }

    private void quanTriVien() {
        dangNhap(IRoleType.quan_tri_vien, null);
    }

    /** Quản lý kho được phân công ở Kho tổng, đang chọn Kho tổng. */
    private void quanLyKhoTong() {
        dangNhap(IRoleType.quan_ly_kho, khoTong, khoTong);
    }

    private PhieuChuyenKho phieu(String trangThai) {
        PhieuChuyenKho p = PhieuChuyenKho.builder().id(PCK).soPhieuChuyen("PX-TRF-" + HOM_NAY + "1")
                .khoXuat(khoTong).khoNhap(cuaHang).trangThai(trangThai)
                .nguoiTao(NguoiDung.builder().id(8).hoTen("Người lập").build()).ngayTao(Instant.now()).build();
        when(pckRepo.khoaTheoId(PCK)).thenReturn(Optional.of(p));
        when(pckRepo.findById(PCK)).thenReturn(Optional.of(p));
        when(ctPckRepo.findByPhieuChuyenKho_IdOrderByIdAsc(PCK)).thenReturn(List.of(ChiTietPhieuChuyenKho.builder()
                .id(1).phieuChuyenKho(p).bienTheSanPham(bienThe).soLuongChuyen(10).build()));
        return p;
    }

    private PhieuXuatKho phieuXuatCon(PhieuChuyenKho p, int trangThai) {
        PhieuXuatKho px = PhieuXuatKho.builder().id(PX).soPhieuXuat("PX-CK-" + HOM_NAY + "1").loaiXuat("chuyen_kho")
                .phieuChuyenKho(p).kho(p.getKhoXuat()).khoChuyenDen(p.getKhoNhap()).trangThai(trangThai).build();
        when(pxRepo.findFirstByPhieuChuyenKho_IdAndTrangThaiNot(PCK, ITrangThaiPhieuXuat.DA_HUY)).thenReturn(Optional.of(px));
        when(pxRepo.findByPhieuChuyenKho_IdOrderByIdDesc(PCK)).thenReturn(List.of(px));
        return px;
    }

    /** Phiếu nhặt (id 80, PL-…-001) của PX-CK ở trạng thái {@code trangThai}, giao cho người 9. */
    private DanhSachNhatHang phieuNhat(PhieuXuatKho px, String trangThai) {
        DanhSachNhatHang pl = DanhSachNhatHang.builder().id(80).maPickList("PL-" + HOM_NAY + "-001").khoXuat(px.getKho())
                .phieuXuatKho(px).trangThai(trangThai).ngayTao(Instant.now())
                .nguoiNhat(NguoiDung.builder().id(9).hoTen("Thủ kho A").build()).build();
        when(dsnhRepo.findByPhieuXuatKho_Id(px.getId())).thenReturn(Optional.of(pl));
        return pl;
    }

    /** Phiếu Đã duyệt đã nhặt xong: PX-CK nháp + phiếu nhặt Đã nhặt (lô đã ghi vào PX-CK). */
    private PhieuXuatKho daNhatXong(PhieuChuyenKho p) {
        PhieuXuatKho px = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        phieuNhat(px, "da_nhat");
        return px;
    }

    private static ChiTietPhieuXuatKho dongLo(PhieuXuatKho px, BienTheSanPham bt, LoHang l, String soLuong) {
        return ChiTietPhieuXuatKho.builder().phieuXuatKho(px).bienTheSanPham(bt).loHang(l)
                .soLuongXuat(new BigDecimal(soLuong)).giaVon(l.getGiaVon()).build();
    }

    /** Phiếu đã xuất 10 cái lô 5 (phiếu xuất con đã xuất). */
    private PhieuXuatKho daXuat10(PhieuChuyenKho p) {
        PhieuXuatKho px = phieuXuatCon(p, ITrangThaiPhieuXuat.DA_XUAT);
        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(dongLo(px, bienThe, lo, "10")));
        return px;
    }

    private TonKhoTheoLo ton(Kho kho, LoHang l, String soLuong) {
        TonKhoTheoLo t = TonKhoTheoLo.builder().kho(kho).loHang(l).soLuongTon(new BigDecimal(soLuong))
                .soLuongDaDat(BigDecimal.ZERO).build();
        when(tonRepo.findByKho_IdAndLoHang_Id(kho.getId(), l.getId())).thenReturn(Optional.of(t));
        return t;
    }

    /** Phiếu nhập đã hoàn tất của phiếu chuyển: nhận (hoặc nhập hoàn trả) {@code soLuong} của lô 5. */
    private PhieuNhapKho phieuNhapHoanTat(Kho kho, String soLuong) {
        PhieuNhapKho pn = PhieuNhapKho.builder().id(70).soPhieuNhap("PN-TRF-" + HOM_NAY + "1").kho(kho)
                .trangThai(TrangThaiPhieuNhap.COMPLETED.getValue()).build();
        when(pnRepo.findByPhieuChuyenKho_IdOrderByIdAsc(PCK)).thenReturn(List.of(pn));
        when(ctPnRepo.findAllByPhieuNhapKhoIdAndCoLo(70)).thenReturn(List.of(ChiTietPhieuNhapKho.builder()
                .phieuNhapKho(pn).bienTheSanPham(bienThe).loHang(lo).soLuongNhap(new BigDecimal(soLuong)).build()));
        return pn;
    }

    /**
     * Khả dụng ở kho gửi theo KhaDungChuyenKhoService: (tồn − đang giữ) − chờ xuất của đơn bán tại kho đó − hàng phiếu
     * chuyển khác đang giữ chỗ. {@code boQua}: phiếu đang xét (duyệt) không tính phần giữ chỗ của chính nó.
     */
    private void khaDung(Kho khoGui, String tonTruGiu, String datCuaDon, String daXuatCuaDon, String giuChoKhac, Integer boQua) {
        when(tonRepo.sumSoLuongKhaDungByKhoAndBienTheIds(khoGui.getId(), List.of(BT)))
                .thenReturn(List.<Object[]>of(new Object[]{BT, new BigDecimal(tonTruGiu)}));
        when(ctDonRepo.sumDatDonGiuHangTheoKho(List.of(BT), null, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(datCuaDon == null ? List.of() : List.of(
                        new Object[]{BT, khoGui.getId(), new BigDecimal(datCuaDon)},
                        new Object[]{BT, 77, new BigDecimal("50")})); // đơn của kho khác: không tính
        when(ctPxRepo.sumDaXuatDonGiuHangTheoKho(List.of(BT), null, ITrangThaiDonBanHang.DANG_GIU_HANG))
                .thenReturn(daXuatCuaDon == null ? List.of()
                        : List.<Object[]>of(new Object[]{BT, khoGui.getId(), new BigDecimal(daXuatCuaDon)}));
        when(giuCho.taiKho(khoGui.getId(), List.of(BT), boQua))
                .thenReturn(giuChoKhac == null ? Map.of() : Map.of(BT, new BigDecimal(giuChoKhac)));
    }

    private static PhieuChuyenKhoCreating yeuCau(Kho xuat, Kho nhap, String... soLuong) {
        return PhieuChuyenKhoCreating.builder().khoXuatId(xuat.getId()).khoNhapId(nhap.getId()).ghiChu("Bổ sung hàng bán")
                .chiTietXuat(Arrays.stream(soLuong).map(sl -> ChiTietPhieuXuatKhoCreating.builder()
                        .bienTheSanPhamId(BT).soLuongXuat(new BigDecimal(sl)).build()).toList())
                .build();
    }

    private static PhieuChuyenKhoYeuCau.XacNhanXuat xeCongTy() {
        return PhieuChuyenKhoYeuCau.XacNhanXuat.builder().hinhThucVanChuyen(IChuyenKho.XE_CONG_TY)
                .nguoiVanChuyen("Nguyễn Văn Tài").soDienThoaiVanChuyen("0912 345 678").loaiPhuongTien("Xe tải 1,5 tấn")
                .bienSoXe("29C-12345").kyHieuXknb("6k26nab").soPhieuXknb("0000125").build();
    }

    private static PhieuChuyenKhoYeuCau.NhanLech nhanLech(PhieuChuyenKhoYeuCau.DongNhan... dong) {
        return PhieuChuyenKhoYeuCau.NhanLech.builder().dong(List.of(dong)).nguoiVanChuyen("Nguyễn Văn Tài")
                .thoiDiem(Instant.now()).ketLuan("Thùng số 2 bị ướt").build();
    }

    private static PhieuChuyenKhoYeuCau.DongNhan dem(int loId, Integer dat, Integer hong, String lyDo) {
        return PhieuChuyenKhoYeuCau.DongNhan.builder().bienTheSanPhamId(BT).loHangId(loId)
                .soLuongDat(dat).soLuongHong(hong).lyDo(lyDo).build();
    }

    private static CommonException loi(HttpStatus status, Executable e) {
        CommonException ex = assertThrows(CommonException.class, e);
        assertEquals(status, ex.getHttpStatus(), ex.getMessage());
        return ex;
    }

    private static void assertSo(String expected, BigDecimal actual) {
        assertNotNull(actual);
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    // ══════════════════════════ Tạo yêu cầu ══════════════════════════

    @Test
    @DisplayName("Tạo: kho nhận lập yêu cầu, gộp dòng cùng mã, số nguyên, vào Chờ duyệt (không có Nháp)")
    void tao_khoNhanLap_gopDongCungMa_choDuyet() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        khaDung(khoTong, "10", "2", "0", null, null);

        PhieuChuyenKho p = service.tao(yeuCau(khoTong, cuaHang, "3", "2.000"));

        assertEquals(IChuyenKho.CHO_DUYET, p.getTrangThai());
        assertTrue(p.getSoPhieuChuyen().startsWith("PX-TRF-" + HOM_NAY), p.getSoPhieuChuyen());
        assertEquals(NGUOI, p.getNguoiTao().getId());
        assertEquals(KHO_TONG, p.getKhoXuat().getId());
        assertEquals(CUA_HANG, p.getKhoNhap().getId());
        ArgumentCaptor<ChiTietPhieuChuyenKho> dong = ArgumentCaptor.forClass(ChiTietPhieuChuyenKho.class);
        verify(ctPckRepo, times(1)).save(dong.capture());
        assertEquals(5, dong.getValue().getSoLuongChuyen());
        assertEquals(BT, dong.getValue().getBienTheSanPham().getId());
    }

    @Test
    @DisplayName("Tạo: vượt khả dụng (tính cả đơn bán chờ xuất và phiếu chuyển khác đang giữ chỗ) → 409 đủ số, không lưu")
    void tao_vuotKhaDung_tinhGiuChoPhieuKhac_baoDuSo() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        // tồn trừ giữ 10, đơn bán kho tổng đặt 4 đã xuất 2 → chờ xuất 2, phiếu chuyển khác giữ 5 → còn 3
        khaDung(khoTong, "10", "4", "2", "5", null);

        CommonException ex = loi(HttpStatus.CONFLICT, () -> service.tao(yeuCau(khoTong, cuaHang, "2", "2")));

        assertEquals("Sản phẩm [AK-93] chỉ còn 3 có thể chuyển tại Kho tổng (đơn bán chờ xuất 2, phiếu chuyển khác "
                + "đang giữ 5). Yêu cầu: 4.", ex.getMessage());
        verify(pckRepo, never()).save(any());
        verify(ctPckRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo: không có đơn chờ, không giữ chỗ → câu báo không kèm phần giải thích")
    void tao_khongCoDonCho_cauBaoNgan() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        khaDung(khoTong, "1", null, null, null, null);

        CommonException ex = loi(HttpStatus.CONFLICT, () -> service.tao(yeuCau(khoTong, cuaHang, "2")));

        assertEquals("Sản phẩm [AK-93] chỉ còn 1 có thể chuyển tại Kho tổng. Yêu cầu: 2.", ex.getMessage());
    }

    @Test
    @DisplayName("Tạo: số lượng lẻ, bằng 0 hoặc âm bị chặn trước khi đọc tồn")
    void tao_soLuongKhongHopLe_biChan_khongTruyVanTon() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        for (String sl : List.of("1.5", "0", "-2")) {
            CommonException ex = loi(HttpStatus.BAD_REQUEST, () -> service.tao(yeuCau(khoTong, cuaHang, sl)));
            assertEquals("Số lượng chuyển phải là số nguyên lớn hơn 0", ex.getMessage());
        }
        verifyNoInteractions(tonRepo, ctDonRepo, giuCho);
        verify(pckRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo: kho nhận trùng kho xuất, kho trung chuyển hoặc không có dòng hàng bị chặn")
    void tao_khoKhongHopLe_biChan() {
        quanTriVien();
        assertEquals("Kho nhận phải khác kho xuất",
                loi(HttpStatus.BAD_REQUEST, () -> service.tao(yeuCau(khoTong, khoTong, "1"))).getMessage());
        assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.tao(yeuCau(khoTong, transit, "1")))
                .getMessage().contains("Kho Trung Chuyển"));
        assertEquals("Yêu cầu chuyển kho phải có ít nhất 1 sản phẩm",
                loi(HttpStatus.BAD_REQUEST, () -> service.tao(yeuCau(khoTong, cuaHang))).getMessage());
        verify(pckRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo: người của kho thứ ba (không phải kho nhận, không phải Quản lý Kho tổng) bị 403")
    void tao_khoThuBa_bi403() {
        dangNhap(IRoleType.nhan_vien_kho, khoKhac, khoKhac);
        khaDung(khoTong, "10", null, null, null, null);

        loi(HttpStatus.FORBIDDEN, () -> service.tao(yeuCau(khoTong, cuaHang, "1")));
        verify(pckRepo, never()).save(any());
    }

    @Test
    @DisplayName("Tạo: Quản lý Kho tổng đẩy hàng mọi tuyến (cả chuyển ngang giữa hai cửa hàng)")
    void tao_quanLyKhoTong_moiTuyen() {
        quanLyKhoTong();
        khaDung(cuaHang, "6", null, null, null, null);

        PhieuChuyenKho p = service.tao(yeuCau(cuaHang, khoKhac, "6"));

        assertEquals(IChuyenKho.CHO_DUYET, p.getTrangThai());
        assertEquals(CUA_HANG, p.getKhoXuat().getId());
        assertEquals(KHO_KHAC, p.getKhoNhap().getId());
    }

    // ══════════════════════════ Duyệt + lệnh điều động ══════════════════════════

    @Test
    @DisplayName("Duyệt: Quản lý Kho tổng lập lệnh LDD-yyyyMMdd-XXX, phiếu Đã duyệt, sinh phiếu xuất con PX-CK để nhặt")
    void duyet_quanLyKhoTong_lapLenh_taoPhieuXuatCon() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_DUYET);
        khaDung(khoTong, "10", null, null, null, PCK);
        when(pckRepo.soLenhLonNhat("LDD-" + HOM_NAY + "-")).thenReturn(2);

        service.duyet(PCK, PhieuChuyenKhoYeuCau.Duyet.builder().lyDoDieuDong(IChuyenKho.LY_DO_BO_SUNG).build());

        assertEquals(IChuyenKho.DA_DUYET, p.getTrangThai());
        assertEquals("LDD-" + HOM_NAY + "-003", p.getSoLenhDieuDong());
        assertEquals(NGUOI, p.getNguoiRaLenh().getId());
        assertEquals(IChuyenKho.LY_DO_BO_SUNG, p.getLyDoDieuDong());
        assertNotNull(p.getNgayLenhDieuDong());
        ArgumentCaptor<PhieuXuatKho> px = ArgumentCaptor.forClass(PhieuXuatKho.class);
        verify(pxRepo).save(px.capture());
        assertEquals("chuyen_kho", px.getValue().getLoaiXuat());
        assertEquals(ITrangThaiPhieuXuat.NHAP, px.getValue().getTrangThai());
        assertSame(p, px.getValue().getPhieuChuyenKho());
        assertEquals(KHO_TONG, px.getValue().getKho().getId());
        assertEquals(CUA_HANG, px.getValue().getKhoChuyenDen().getId());
        assertTrue(px.getValue().getSoPhieuXuat().startsWith("PX-CK-" + HOM_NAY), px.getValue().getSoPhieuXuat());
        ArgumentCaptor<ChiTietPhieuXuatKho> dong = ArgumentCaptor.forClass(ChiTietPhieuXuatKho.class);
        verify(ctPxRepo).save(dong.capture());
        assertSo("10", dong.getValue().getSoLuongXuat());
        assertNull(dong.getValue().getLoHang(), "dòng gốc chưa chọn lô");
        // thẩm định tồn không tính phần giữ chỗ của chính phiếu này
        verify(giuCho).taiKho(KHO_TONG, List.of(BT), PCK);
        // đặc tả bước 8: PX-CK vào danh sách chờ nhặt ngay trong lần duyệt, dòng nhặt = dòng phiếu chuyển
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ChiTietPhieuChuyenKho>> dongNhat = ArgumentCaptor.forClass(List.class);
        verify(nhatHang).taoPhieuNhatChuyenKho(same(p), same(px.getValue()), dongNhat.capture());
        assertEquals(1, dongNhat.getValue().size());
        assertEquals(10, dongNhat.getValue().get(0).getSoLuongChuyen());
        var thuTu = inOrder(pxRepo, nhatHang);
        thuTu.verify(pxRepo).save(any(PhieuXuatKho.class));
        thuTu.verify(nhatHang).taoPhieuNhatChuyenKho(any(), any(), any());
    }

    @Test
    @DisplayName("Duyệt bị chặn (thiếu hàng) thì không tạo phiếu nhặt")
    void duyet_biChan_khongTaoPhieuNhat() {
        quanLyKhoTong();
        phieu(IChuyenKho.CHO_DUYET);
        khaDung(khoTong, "3", null, null, null, PCK);

        loi(HttpStatus.CONFLICT, () -> service.duyet(PCK,
                PhieuChuyenKhoYeuCau.Duyet.builder().lyDoDieuDong(IChuyenKho.LY_DO_BO_SUNG).build()));

        verifyNoInteractions(nhatHang);
    }

    @Test
    @DisplayName("Duyệt: quản lý kho của cửa hàng (không phải Kho tổng) bị 403, phiếu giữ Chờ duyệt")
    void duyet_quanLyCuaHang_bi403() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_DUYET);

        loi(HttpStatus.FORBIDDEN, () -> service.duyet(PCK,
                PhieuChuyenKhoYeuCau.Duyet.builder().lyDoDieuDong(IChuyenKho.LY_DO_BO_SUNG).build()));

        assertEquals(IChuyenKho.CHO_DUYET, p.getTrangThai());
        verify(pxRepo, never()).save(any());
    }

    @Test
    @DisplayName("Duyệt: thiếu lý do, hoặc lý do Khác không ghi rõ → 400")
    void duyet_lyDo_batBuoc() {
        quanLyKhoTong();
        phieu(IChuyenKho.CHO_DUYET);

        assertEquals("Chọn lý do điều động", loi(HttpStatus.BAD_REQUEST, () -> service.duyet(PCK,
                PhieuChuyenKhoYeuCau.Duyet.builder().build())).getMessage());
        assertEquals("Ghi rõ lý do điều động", loi(HttpStatus.BAD_REQUEST, () -> service.duyet(PCK,
                PhieuChuyenKhoYeuCau.Duyet.builder().lyDoDieuDong(IChuyenKho.LY_DO_KHAC).ghiChuLenh("  ").build())).getMessage());
        verify(pckRepo, never()).save(any());
    }

    @Test
    @DisplayName("Duyệt sau khi phiếu đã bị hủy (đọc bằng khóa dòng) → 409, không ghi đè Đã hủy")
    void duyet_phieuDaHuy_xungDot_khongGhiDe() {
        quanTriVien();
        PhieuChuyenKho p = phieu(IChuyenKho.DA_HUY);

        loi(HttpStatus.CONFLICT, () -> service.duyet(PCK,
                PhieuChuyenKhoYeuCau.Duyet.builder().lyDoDieuDong(IChuyenKho.LY_DO_BO_SUNG).build()));

        assertEquals(IChuyenKho.DA_HUY, p.getTrangThai());
        verify(pckRepo).khoaTheoId(PCK);
        verify(pckRepo, never()).findById(any());
        verify(pckRepo, never()).save(any());
    }

    @Test
    @DisplayName("Duyệt: tồn đã bị đơn bán khác lấy → thẩm định lại thấy không đủ, 409")
    void duyet_khongConDuHang_409() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_DUYET);
        khaDung(khoTong, "10", "8", "0", null, PCK);

        CommonException ex = loi(HttpStatus.CONFLICT, () -> service.duyet(PCK,
                PhieuChuyenKhoYeuCau.Duyet.builder().lyDoDieuDong(IChuyenKho.LY_DO_CAN_BANG).build()));

        assertTrue(ex.getMessage().contains("chỉ còn 2"), ex.getMessage());
        assertEquals(IChuyenKho.CHO_DUYET, p.getTrangThai());
        verify(pxRepo, never()).save(any());
    }

    @Test
    @DisplayName("Mở phiếu nhặt: PX-CK đã có phiếu nhặt thì trả phiếu đó, không tạo thêm phiếu xuất / phiếu nhặt")
    void damBaoPhieuXuat_daCoPhieuNhat_traLai() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuXuatKho co = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        DanhSachNhatHang pl = phieuNhat(co, "dang_nhat");

        PhieuChuyenKhoService.MoPhieuNhat kq = service.damBaoPhieuXuat(PCK);

        assertSame(co, kq.phieuXuat());
        assertSame(pl, kq.phieuNhat());
        verify(pxRepo, never()).save(any());
        verify(nhatHang, never()).taoPhieuNhatChuyenKho(any(), any(), any());
    }

    @Test
    @DisplayName("Mở phiếu nhặt: PX-CK chưa có lô, chưa có phiếu nhặt (phiếu duyệt trước bản phiếu nhặt) → tạo phiếu nhặt")
    void damBaoPhieuXuat_chuaCoLo_taoPhieuNhat() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuXuatKho co = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        DanhSachNhatHang moi = DanhSachNhatHang.builder().id(81).maPickList("PL-" + HOM_NAY + "-002").build();
        when(nhatHang.taoPhieuNhatChuyenKho(same(p), same(co), any())).thenReturn(moi);

        PhieuChuyenKhoService.MoPhieuNhat kq = service.damBaoPhieuXuat(PCK);

        assertSame(co, kq.phieuXuat());
        assertSame(moi, kq.phieuNhat());
        verify(pxRepo, never()).save(any());
    }

    @Test
    @DisplayName("Mở phiếu nhặt: PX-CK đã có lô chọn tay (dữ liệu cũ) → giữ đường chọn lô tay, không tạo phiếu nhặt")
    void damBaoPhieuXuat_daChonLoTay_giuDuongCu() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuXuatKho co = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(dongLo(co, bienThe, lo, "4")));

        PhieuChuyenKhoService.MoPhieuNhat kq = service.damBaoPhieuXuat(PCK);

        assertSame(co, kq.phieuXuat());
        assertNull(kq.phieuNhat());
        verify(nhatHang, never()).taoPhieuNhatChuyenKho(any(), any(), any());
    }

    @Test
    @DisplayName("Mở phiếu nhặt: phiếu duyệt từ trước khi nâng cấp chưa có PX-CK thì tạo PX-CK rồi phiếu nhặt; kho nhận → 403")
    void damBaoPhieuXuat_chuaCoPhieuXuat_taoCaHai() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        when(pxRepo.findFirstByPhieuChuyenKho_IdAndTrangThaiNot(PCK, ITrangThaiPhieuXuat.DA_HUY)).thenReturn(Optional.empty());
        when(nhatHang.taoPhieuNhatChuyenKho(any(), any(), any()))
                .thenAnswer(i -> DanhSachNhatHang.builder().id(82).phieuXuatKho(i.getArgument(1)).build());

        PhieuChuyenKhoService.MoPhieuNhat kq = service.damBaoPhieuXuat(PCK);

        assertEquals("chuyen_kho", kq.phieuXuat().getLoaiXuat());
        assertSame(p, kq.phieuXuat().getPhieuChuyenKho());
        assertSame(kq.phieuXuat(), kq.phieuNhat().getPhieuXuatKho());

        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang); // kho nhận không nhặt hàng
        loi(HttpStatus.FORBIDDEN, () -> service.damBaoPhieuXuat(PCK));
        p.setTrangThai(IChuyenKho.CHO_DUYET);
        quanLyKhoTong();
        loi(HttpStatus.CONFLICT, () -> service.damBaoPhieuXuat(PCK)); // chưa duyệt thì chưa nhặt
    }

    // ══════════════════════════ Hủy (A5) ══════════════════════════

    @Test
    @DisplayName("Hủy phiếu Đã duyệt: hủy phiếu xuất con chưa xuất (nhả lô đang giữ), ghi người hủy và lý do")
    void huy_daDuyet_huyPhieuXuatCon() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuXuatKho px = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);

        service.huy(PCK, PhieuChuyenKhoYeuCau.Huy.builder().lyDo("Đổi kế hoạch").build());

        verify(pxService).huyPhieuXuatCon(px);
        // phiếu nhặt của PX-CK hủy trước (khóa phiếu chuyển → dòng nhặt, lệnh trả kệ), rồi mới nhả lô PX-CK
        var thuTu = inOrder(pckRepo, nhatHang, pxService);
        thuTu.verify(pckRepo).khoaTheoId(PCK);
        thuTu.verify(nhatHang).huyPhieuNhatChuyenKho(px, p.getSoPhieuChuyen());
        thuTu.verify(pxService).huyPhieuXuatCon(px);
        assertTrue(px.getGhiChu().contains("Hủy theo phiếu chuyển"), px.getGhiChu());
        assertEquals(IChuyenKho.DA_HUY, p.getTrangThai());
        assertEquals("Đổi kế hoạch", p.getLyDoHuy());
        assertEquals(NGUOI, p.getNguoiHuy().getId());
        assertNotNull(p.getNgayHuy());
    }

    @Test
    @DisplayName("Hủy phiếu Chờ duyệt: người lập ở kho nhận được; nhân viên kho nhận khác và kho thứ ba bị 403")
    void huy_choDuyet_quyenTheoNguoiLapVaKho() {
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_DUYET);
        dangNhap(IRoleType.nhan_vien_kho, khoKhac, khoKhac);
        loi(HttpStatus.FORBIDDEN, () -> service.huy(PCK, null));
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang); // không phải người lập (người lập id 8)
        loi(HttpStatus.FORBIDDEN, () -> service.huy(PCK, null));
        assertEquals(IChuyenKho.CHO_DUYET, p.getTrangThai());

        p.setNguoiTao(NguoiDung.builder().id(NGUOI).build());
        service.huy(PCK, null);
        assertEquals(IChuyenKho.DA_HUY, p.getTrangThai());
        assertNull(p.getLyDoHuy(), "lý do hủy không bắt buộc");
        verify(pxService, never()).huyPhieuXuatCon(any());
    }

    @Test
    @DisplayName("Hủy khi hàng đang trên đường: chỉ Quản lý Kho tổng; phiếu Đã hủy, hàng còn ở trung chuyển chờ nhập hoàn trả")
    void huy_dangVanChuyen_chiQuanLyKhoTong() {
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        assertEquals("Hàng đang trên đường: chỉ Quản lý Kho tổng hủy được phiếu",
                loi(HttpStatus.FORBIDDEN, () -> service.huy(PCK, null)).getMessage());
        assertEquals(IChuyenKho.DANG_VAN_CHUYEN, p.getTrangThai());

        quanLyKhoTong();
        service.huy(PCK, PhieuChuyenKhoYeuCau.Huy.builder().lyDo("Xe hỏng giữa đường").build());
        assertEquals(IChuyenKho.DA_HUY, p.getTrangThai());
        verify(pxService, never()).huyPhieuXuatCon(any());
        verify(tonRepo, never()).save(any());
    }

    @Test
    @DisplayName("Hủy phiếu Hoàn tất hoặc Chờ xử lý chênh lệch → 409")
    void huy_hoanTatHoacChoXuLyLech_409() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.HOAN_TAT);
        loi(HttpStatus.CONFLICT, () -> service.huy(PCK, null));
        p.setTrangThai(IChuyenKho.CHO_XU_LY_LECH);
        loi(HttpStatus.CONFLICT, () -> service.huy(PCK, null));
        verify(pckRepo, never()).save(any());
    }

    // ══════════════════════════ Nhập hoàn trả ══════════════════════════

    @Test
    @DisplayName("Nhập hoàn trả: phiếu hủy khi đang chuyển → PN-RET về kho nguồn, trung chuyển −, kho nguồn +")
    void nhapHoanTra_veKhoNguon() {
        dangNhap(IRoleType.quan_ly_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_HUY);
        daXuat10(p);
        TonKhoTheoLo tc = ton(transit, lo, "10");
        TonKhoTheoLo nguon = ton(khoTong, lo, "0");

        PhieuNhapKho pn = service.nhapHoanTra(PCK);

        assertTrue(pn.getSoPhieuNhap().startsWith("PN-RET-" + HOM_NAY), pn.getSoPhieuNhap());
        assertEquals(KHO_TONG, pn.getKho().getId());
        assertEquals(TrangThaiPhieuNhap.COMPLETED.getValue(), pn.getTrangThai());
        assertSame(p, pn.getPhieuChuyenKho());
        assertSo("0", tc.getSoLuongTon());
        assertSo("10", nguon.getSoLuongTon());
        assertEquals(IChuyenKho.DA_HUY, p.getTrangThai());
    }

    @Test
    @DisplayName("Nhập hoàn trả lần hai (đã nhập hết) → 409; phiếu hủy trước khi xuất → 409")
    void nhapHoanTra_daNhapHoacChuaXuat_409() {
        dangNhap(IRoleType.quan_ly_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_HUY);
        when(pxRepo.findByPhieuChuyenKho_IdOrderByIdDesc(PCK)).thenReturn(List.of());
        assertTrue(loi(HttpStatus.CONFLICT, () -> service.nhapHoanTra(PCK)).getMessage().contains("hủy trước khi xuất"));

        daXuat10(p);
        phieuNhapHoanTat(khoTong, "10");
        assertTrue(loi(HttpStatus.CONFLICT, () -> service.nhapHoanTra(PCK)).getMessage().contains("đã được nhập hoàn trả"));
        verify(tonRepo, never()).save(any());
    }

    @Test
    @DisplayName("Nhập hoàn trả từ kho nhận (không phải kho nguồn đang chọn) → 403")
    void nhapHoanTra_tuKhoNhan_403() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_HUY);
        daXuat10(p);
        loi(HttpStatus.FORBIDDEN, () -> service.nhapHoanTra(PCK));
    }

    // ══════════════════════════ Xác nhận xuất (BR-TRF-02) ══════════════════════════

    @Test
    @DisplayName("Xác nhận xuất đủ thông tin: xuất phiếu con (nguồn −, trung chuyển +), Đang vận chuyển, ký hiệu viết hoa")
    void xacNhanXuat_duThongTin_dangVanChuyen() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        daNhatXong(p);

        service.xacNhanXuat(PCK, xeCongTy());

        verify(pxService).xuatPhieuXuatCon(PX, NGUOI);
        assertEquals(IChuyenKho.DANG_VAN_CHUYEN, p.getTrangThai());
        assertEquals("6K26NAB", p.getKyHieuXknb());
        assertEquals("0000125", p.getSoPhieuXknb());
        assertEquals(LocalDate.now(), p.getNgayLapXknb());
        assertEquals("0912345678", p.getSoDienThoaiVanChuyen());
        assertEquals("29C-12345", p.getBienSoXe());
        assertNull(p.getDonViVanChuyen(), "xe công ty không có đơn vị vận chuyển");
    }

    @Test
    @DisplayName("Xác nhận xuất: số điện thoại sai mẫu ^0[35789][0-9]{8}$ → 400, không xuất")
    void xacNhanXuat_soDienThoaiSai_400() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        for (String sdt : List.of("0123456789", "091234567", "09123456789", "0612345678", "abc")) {
            PhieuChuyenKhoYeuCau.XacNhanXuat yc = xeCongTy();
            yc.setSoDienThoaiVanChuyen(sdt);
            assertEquals("Số điện thoại gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09",
                    loi(HttpStatus.BAD_REQUEST, () -> service.xacNhanXuat(PCK, yc)).getMessage(), sdt);
        }
        verify(pxService, never()).xuatPhieuXuatCon(any(), any());
        assertEquals(IChuyenKho.DA_DUYET, p.getTrangThai());
    }

    @Test
    @DisplayName("Xác nhận xuất: ký hiệu XKNB sai mẫu 6[CK]yyN.., số không đủ 7 chữ số, cặp số đã dùng cho chuyến khác")
    void xacNhanXuat_soXknbKhongHopLe() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);

        PhieuChuyenKhoYeuCau.XacNhanXuat kyHieuSai = xeCongTy();
        kyHieuSai.setKyHieuXknb("6K26XAB");
        assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.xacNhanXuat(PCK, kyHieuSai)).getMessage().startsWith("Ký hiệu phiếu XKNB"));
        PhieuChuyenKhoYeuCau.XacNhanXuat soSai = xeCongTy();
        soSai.setSoPhieuXknb("12345");
        assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.xacNhanXuat(PCK, soSai)).getMessage().startsWith("Số phiếu XKNB gồm 7 chữ số"));

        when(pckRepo.existsByKyHieuXknbAndSoPhieuXknbAndIdNot("6K26NAB", "0000125", PCK)).thenReturn(true);
        assertTrue(loi(HttpStatus.CONFLICT, () -> service.xacNhanXuat(PCK, xeCongTy())).getMessage().contains("đã ghi cho chuyến khác"));
        verify(pxService, never()).xuatPhieuXuatCon(any(), any());
    }

    @Test
    @DisplayName("Thiếu số XKNB, chế độ Chặn xuất → 409 'Cần ký hiệu và số...' và không xuất")
    void xacNhanXuat_thieuXknb_cheDoChan_409() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        PhieuChuyenKhoYeuCau.XacNhanXuat yc = xeCongTy();
        yc.setSoPhieuXknb(null);
        yc.setVanXuatKhiChuaCoSo(true); // chế độ Chặn: đồng ý xuất cũng không qua

        assertEquals("Cần ký hiệu và số của giấy đi đường (phiếu XKNB) trước khi hàng rời kho",
                loi(HttpStatus.CONFLICT, () -> service.xacNhanXuat(PCK, yc)).getMessage());
        verify(pxService, never()).xuatPhieuXuatCon(any(), any());
    }

    @Test
    @DisplayName("Thiếu số XKNB, chế độ Chỉ cảnh báo: phải xác nhận lại; xác nhận rồi thì xuất trước, ghi số sau")
    void xacNhanXuat_thieuXknb_chiCanhBao() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        when(cauHinh.getCauHinhString(eq(DieuHanhHeThongServiceImpl.CAU_HINH_XKNB_CHE_DO), anyString()))
                .thenReturn(IChuyenKho.XKNB_CHI_CANH_BAO);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        daNhatXong(p);
        PhieuChuyenKhoYeuCau.XacNhanXuat yc = xeCongTy();
        yc.setSoPhieuXknb(" ");

        assertTrue(loi(HttpStatus.CONFLICT, () -> service.xacNhanXuat(PCK, yc)).getMessage().contains("Đang bật Chỉ cảnh báo"));
        verify(pxService, never()).xuatPhieuXuatCon(any(), any());

        yc.setVanXuatKhiChuaCoSo(true);
        service.xacNhanXuat(PCK, yc);
        verify(pxService).xuatPhieuXuatCon(PX, NGUOI);
        assertEquals(IChuyenKho.DANG_VAN_CHUYEN, p.getTrangThai());
        assertNull(p.getKyHieuXknb(), "chưa có số thì không lưu nửa vời ký hiệu");
        assertNull(p.getSoPhieuXknb());
        assertNull(p.getNgayLapXknb());
    }

    @Test
    @DisplayName("Xác nhận xuất chuyển phát: bắt buộc đơn vị vận chuyển và mã vận đơn; không lưu biển số")
    void xacNhanXuat_chuyenPhat_batBuocDonViVaMaVanDon() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        daNhatXong(p);
        PhieuChuyenKhoYeuCau.XacNhanXuat yc = xeCongTy();
        yc.setHinhThucVanChuyen(IChuyenKho.CHUYEN_PHAT);

        assertEquals("Nhập tên đơn vị vận chuyển", loi(HttpStatus.BAD_REQUEST, () -> service.xacNhanXuat(PCK, yc)).getMessage());
        yc.setDonViVanChuyen("Giao Hàng Nhanh");
        assertEquals("Nhập mã vận đơn", loi(HttpStatus.BAD_REQUEST, () -> service.xacNhanXuat(PCK, yc)).getMessage());
        yc.setMaVanDonHopDong("GHN123456");
        service.xacNhanXuat(PCK, yc);

        assertEquals("Giao Hàng Nhanh", p.getDonViVanChuyen());
        assertEquals("GHN123456", p.getMaVanDonHopDong());
        assertNull(p.getBienSoXe());
        assertNull(p.getLoaiPhuongTien());
    }

    @Test
    @DisplayName("Xác nhận xuất: từ kho nhận → 403; phiếu chưa có phiếu xuất / phiếu xuất đã xuất → 409; chưa duyệt → 409")
    void xacNhanXuat_saiKhoHoacSaiTrangThai() {
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        loi(HttpStatus.FORBIDDEN, () -> service.xacNhanXuat(PCK, xeCongTy()));

        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        assertTrue(loi(HttpStatus.CONFLICT, () -> service.xacNhanXuat(PCK, xeCongTy())).getMessage().contains("Mở phiếu nhặt"));
        phieuXuatCon(p, ITrangThaiPhieuXuat.DA_XUAT);
        loi(HttpStatus.CONFLICT, () -> service.xacNhanXuat(PCK, xeCongTy()));
        p.setTrangThai(IChuyenKho.CHO_DUYET);
        loi(HttpStatus.CONFLICT, () -> service.xacNhanXuat(PCK, xeCongTy()));
        verify(pxService, never()).xuatPhieuXuatCon(any(), any());
    }

    @Test
    @DisplayName("Xác nhận xuất khi phiếu nhặt chưa hoàn tất (chờ nhặt / đang nhặt) → 409 nêu mã phiếu nhặt, không xuất")
    void xacNhanXuat_phieuNhatChuaHoanTat_409() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuXuatKho px = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        for (String tt : List.of("cho_nhat", "dang_nhat")) {
            DanhSachNhatHang pl = phieuNhat(px, tt);
            String cau = loi(HttpStatus.CONFLICT, () -> service.xacNhanXuat(PCK, xeCongTy())).getMessage();
            assertTrue(cau.contains(pl.getMaPickList()) && cau.contains("chưa hoàn tất"), cau);
        }
        // phiếu nhặt đã hủy (dữ liệu lệch) cũng không cho xuất
        phieuNhat(px, "da_huy");
        loi(HttpStatus.CONFLICT, () -> service.xacNhanXuat(PCK, xeCongTy()));
        verify(pxService, never()).xuatPhieuXuatCon(any(), any());
        assertEquals(IChuyenKho.DA_DUYET, p.getTrangThai());
    }

    @Test
    @DisplayName("Xác nhận xuất phiếu cũ không có phiếu nhặt: đã chọn lô tay thì xuất được (phiếu xuất tự kiểm đủ lô)")
    void xacNhanXuat_phieuCuChonLoTay_xuatDuoc() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuXuatKho px = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(dongLo(px, bienThe, lo, "10")));

        service.xacNhanXuat(PCK, xeCongTy());

        verify(pxService).xuatPhieuXuatCon(PX, NGUOI);
        assertEquals(IChuyenKho.DANG_VAN_CHUYEN, p.getTrangThai());
    }

    // ══════════════════════════ Ghi số XKNB sau ══════════════════════════

    @Test
    @DisplayName("Ghi số XKNB sau khi đã xuất: lưu ký hiệu viết hoa, ngày lập mặc định hôm nay")
    void ghiSoXknb_daXuatChuaCoSo() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);

        service.ghiSoXknb(PCK, PhieuChuyenKhoYeuCau.GhiSoXknb.builder().kyHieuXknb("6c26nxy").soPhieuXknb("0000007").build());

        assertEquals("6C26NXY", p.getKyHieuXknb());
        assertEquals("0000007", p.getSoPhieuXknb());
        assertEquals(LocalDate.now(), p.getNgayLapXknb());
        assertEquals(IChuyenKho.DANG_VAN_CHUYEN, p.getTrangThai());
    }

    @Test
    @DisplayName("Ghi số XKNB: phiếu chưa xuất hoặc đã có số → 409")
    void ghiSoXknb_chuaXuatHoacDaCoSo_409() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuChuyenKhoYeuCau.GhiSoXknb yc = PhieuChuyenKhoYeuCau.GhiSoXknb.builder().kyHieuXknb("6K26NAB").soPhieuXknb("0000125").build();
        loi(HttpStatus.CONFLICT, () -> service.ghiSoXknb(PCK, yc));

        p.setTrangThai(IChuyenKho.DANG_VAN_CHUYEN);
        p.setKyHieuXknb("6K26NAB");
        p.setSoPhieuXknb("0000100");
        loi(HttpStatus.CONFLICT, () -> service.ghiSoXknb(PCK, yc));
        assertEquals("0000100", p.getSoPhieuXknb());
    }

    @Test
    @DisplayName("Số XKNB tiếp theo (BA mục 1.3): số lớn nhất của ký hiệu + 1, chưa có thì 0000001, ký hiệu viết thường vẫn nhận")
    void soXknbTiepTheo_tangTheoKyHieu() {
        when(pckRepo.soXknbLonNhat("6K26NFC")).thenReturn(125L);
        assertEquals("0000126", service.soXknbTiepTheo(" 6k26nfc "));
        when(pckRepo.soXknbLonNhat("6K26NAB")).thenReturn(null);
        assertEquals("0000001", service.soXknbTiepTheo("6K26NAB"));
    }

    @Test
    @DisplayName("Số XKNB tiếp theo: ký hiệu sai mẫu bị chặn; ký hiệu đã dùng hết 9999999 → 409")
    void soXknbTiepTheo_kyHieuSaiHoacHetSo() {
        assertThrows(CommonException.class, () -> service.soXknbTiepTheo("6K26AB"));
        assertThrows(CommonException.class, () -> service.soXknbTiepTheo(""));
        when(pckRepo.soXknbLonNhat("6K26NAB")).thenReturn(9_999_999L);
        loi(HttpStatus.CONFLICT, () -> service.soXknbTiepTheo("6K26NAB"));
    }

    // ══════════════════════════ Nhận đủ ══════════════════════════

    @Test
    @DisplayName("Nhận đủ: PN-TRF hoàn tất, trung chuyển −10, kho đích +10, sổ kho hai dòng, phiếu Hoàn tất")
    void nhanDu_truTrungChuyen_congKhoDich_hoanTat() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(p);
        TonKhoTheoLo tc = ton(transit, lo, "10");
        when(tonRepo.findIdsByKhoAndLots(TRANSIT, List.of(LO))).thenReturn(List.of(40));
        when(tonRepo.findIdsByKhoAndLots(CUA_HANG, List.of(LO))).thenReturn(List.of(12));

        PhieuNhapKho pn = service.nhanDu(PCK);

        assertTrue(pn.getSoPhieuNhap().startsWith("PN-TRF-" + HOM_NAY), pn.getSoPhieuNhap());
        assertEquals(CUA_HANG, pn.getKho().getId());
        assertEquals(TrangThaiPhieuNhap.COMPLETED.getValue(), pn.getTrangThai());
        assertSo("1000", pn.getTongTien());
        assertSo("0", tc.getSoLuongTon());
        ArgumentCaptor<TonKhoTheoLo> luu = ArgumentCaptor.forClass(TonKhoTheoLo.class);
        verify(tonRepo, times(2)).save(luu.capture());
        TonKhoTheoLo dich = luu.getAllValues().get(1);
        assertEquals(CUA_HANG, dich.getKho().getId());
        assertSo("10", dich.getSoLuongTon());
        assertEquals(IChuyenKho.HOAN_TAT, p.getTrangThai());
        assertNotNull(p.getNgayThucTeDen());
        // khóa dòng tồn trung chuyển + kho đích chung một câu, PK tăng dần
        verify(tonRepo).lockLotsForUpdateByIds(List.of(12, 40));
        ArgumentCaptor<LichSuGiaoDichKho> so = ArgumentCaptor.forClass(LichSuGiaoDichKho.class);
        verify(lichSuRepo, times(2)).save(so.capture());
        assertEquals("xuat_kho", so.getAllValues().get(0).getLoaiGiaoDich());
        assertEquals(TRANSIT, so.getAllValues().get(0).getKho().getId());
        assertEquals("nhap_kho", so.getAllValues().get(1).getLoaiGiaoDich());
        assertEquals(CUA_HANG, so.getAllValues().get(1).getKho().getId());
        assertEquals(ITable.phieu_nhap_kho, so.getAllValues().get(1).getLoaiThamChieu());
        verify(sanPhamService).recalculatePriceAndStatus(4);
    }

    @Test
    @DisplayName("Nhận đủ: trung chuyển không còn đủ lô → 409 nêu lô, không để âm, phiếu giữ Đang vận chuyển")
    void nhanDu_trungChuyenKhongDu_409() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(p);
        TonKhoTheoLo tc = ton(transit, lo, "4");

        assertTrue(loi(HttpStatus.CONFLICT, () -> service.nhanDu(PCK)).getMessage().contains("LO-5"));
        assertSo("4", tc.getSoLuongTon());
        assertEquals(IChuyenKho.DANG_VAN_CHUYEN, p.getTrangThai());
    }

    @Test
    @DisplayName("Nhận đủ: phiếu đã hủy / đã hoàn tất → 409, không đụng tồn (không nhận lần hai)")
    void nhanDu_daHuyHoacDaHoanTat_409() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_HUY);
        daXuat10(p);
        ton(transit, lo, "10");
        loi(HttpStatus.CONFLICT, () -> service.nhanDu(PCK));
        p.setTrangThai(IChuyenKho.HOAN_TAT);
        loi(HttpStatus.CONFLICT, () -> service.nhanDu(PCK));
        verify(tonRepo, never()).save(any());
        verify(pnRepo, never()).save(any());
    }

    @Test
    @DisplayName("Nhận hàng từ kho nguồn (không phải kho nhận đang chọn) → 403")
    void nhanDu_tuKhoNguon_403() {
        dangNhap(IRoleType.quan_ly_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(p);
        loi(HttpStatus.FORBIDDEN, () -> service.nhanDu(PCK));
        loi(HttpStatus.FORBIDDEN, () -> service.nhanLech(PCK, nhanLech(dem(LO, 9, 0, "Thiếu"))));
    }

    @Test
    @DisplayName("Nhận đủ: phiếu nhập nháp lập tay ở luồng cũ được hủy trước khi nhận theo luồng mới")
    void nhanDu_huyPhieuNhapNhapCu() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(p);
        ton(transit, lo, "10");
        PhieuNhapKho cu = PhieuNhapKho.builder().id(69).soPhieuNhap("PN-TRF-CU").kho(cuaHang)
                .trangThai(TrangThaiPhieuNhap.DRAFT.getValue()).ghiChu("Lập tay").build();
        when(pnRepo.findByPhieuChuyenKho_IdOrderByIdAsc(PCK)).thenReturn(List.of(cu));

        service.nhanDu(PCK);

        assertEquals(TrangThaiPhieuNhap.CANCELLED.getValue(), cu.getTrangThai());
        assertTrue(cu.getGhiChu().startsWith("Lập tay | "), cu.getGhiChu());
    }

    // ══════════════════════════ Nhận lệch (A4) ══════════════════════════

    @Test
    @DisplayName("Nhận lệch: PN-TRF phần đạt, biên bản BBGN cho thiếu + hỏng theo lô, phiếu Chờ xử lý chênh lệch")
    void nhanLech_nhapPhanDat_lapBienBan() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(p);
        TonKhoTheoLo tc = ton(transit, lo, "10");

        BienBanGiaoNhan bb = service.nhanLech(PCK, nhanLech(dem(LO, 7, 1, "Rách bao bì")));

        assertEquals("BBGN-" + HOM_NAY + "-001", bb.getSoBienBan());
        assertEquals(10, bb.getTongSoLuongGui());
        assertEquals(7, bb.getTongSoLuongNhan());
        assertEquals(2, bb.getTongSoLuongThieu());
        assertEquals(1, bb.getTongSoLuongHong());
        assertEquals(IChuyenKho.CHUA_XU_LY, bb.getPhuongAnXuLy());
        assertEquals("Thùng số 2 bị ướt", bb.getGhiChu());
        ArgumentCaptor<ChiTietBienBanGiaoNhan> dong = ArgumentCaptor.forClass(ChiTietBienBanGiaoNhan.class);
        verify(ctBbRepo).save(dong.capture());
        assertEquals(LO, dong.getValue().getLoHang().getId());
        assertEquals(10, dong.getValue().getSoLuongGui());
        assertEquals(7, dong.getValue().getSoLuongNhan());
        assertEquals(2, dong.getValue().getSoLuongThieu());
        assertEquals(1, dong.getValue().getSoLuongHong());
        assertEquals("Rách bao bì", dong.getValue().getLyDoHongThieu());
        // phần đạt vào kho đích, phần lệch (3) còn ở trung chuyển chờ xử lý
        assertSo("3", tc.getSoLuongTon());
        ArgumentCaptor<PhieuNhapKho> pn = ArgumentCaptor.forClass(PhieuNhapKho.class);
        verify(pnRepo, atLeastOnce()).save(pn.capture());
        assertSo("700", pn.getValue().getTongTien());
        assertEquals(IChuyenKho.CHO_XU_LY_LECH, p.getTrangThai());
    }

    @Test
    @DisplayName("Nhận lệch: đạt + hỏng vượt số gửi → 400 (hàng dư ngoài phiếu không nhập theo phiếu này)")
    void nhanLech_vuotSoGui_400() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(p);
        assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.nhanLech(PCK, nhanLech(dem(LO, 9, 2, "Dư"))))
                .getMessage().contains("vượt số gửi 10"));
        assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.nhanLech(PCK, nhanLech(dem(LO, -1, 0, "Âm"))))
                .getMessage().contains("không được âm"));
        verify(bbRepo, never()).save(any());
        verify(pnRepo, never()).save(any());
    }

    @Test
    @DisplayName("Nhận lệch: dòng lệch thiếu lý do → 400; khai thiếu lô đã xuất → 400; khai trùng lô → 400")
    void nhanLech_khaiThieuHoacThieuLyDo_400() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        PhieuXuatKho px = phieuXuatCon(p, ITrangThaiPhieuXuat.DA_XUAT);
        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(
                dongLo(px, bienThe, lo, "6"), dongLo(px, bienThe, lo2, "4")));

        assertTrue(loi(HttpStatus.BAD_REQUEST, () -> service.nhanLech(PCK, nhanLech(dem(LO, 5, 0, " "), dem(LO_2, 4, 0, null))))
                .getMessage().startsWith("Nhập lý do giải trình cho dòng lệch AK-93 lô LO-5"));
        assertEquals("Khai số đếm cho đủ mọi dòng hàng đã xuất",
                loi(HttpStatus.BAD_REQUEST, () -> service.nhanLech(PCK, nhanLech(dem(LO, 5, 0, "Thiếu")))).getMessage());
        assertEquals("Một lô của một sản phẩm chỉ khai một dòng",
                loi(HttpStatus.BAD_REQUEST, () -> service.nhanLech(PCK, nhanLech(dem(LO, 5, 0, "a"), dem(LO, 1, 0, "b")))).getMessage());
        verify(bbRepo, never()).save(any());
    }

    @Test
    @DisplayName("Nhận lệch mà số đếm khớp đủ → 400 hướng sang Xác nhận nhận đủ")
    void nhanLech_khopDu_400() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(p);
        assertEquals("Số đếm khớp đủ số gửi: dùng Xác nhận nhận đủ",
                loi(HttpStatus.BAD_REQUEST, () -> service.nhanLech(PCK, nhanLech(dem(LO, 10, 0, null)))).getMessage());
    }

    @Test
    @DisplayName("Nhận lệch không đạt cái nào (mất cả chuyến): chỉ lập biên bản, không có phiếu nhập")
    void nhanLech_khongDatCaiNao_chiBienBan() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(p);

        BienBanGiaoNhan bb = service.nhanLech(PCK, nhanLech(dem(LO, 0, null, "Mất hàng")));

        assertEquals(10, bb.getTongSoLuongThieu());
        verify(pnRepo, never()).save(any());
        verify(tonRepo, never()).save(any());
        assertEquals(IChuyenKho.CHO_XU_LY_LECH, p.getTrangThai());
    }

    // ══════════════════════════ Xử lý chênh lệch (ghi giảm / giao bù) ══════════════════════════

    /** Phiếu đã nhận lệch: gửi 10, đạt 7 (PN-TRF hoàn tất), thiếu 2, hỏng 1; trung chuyển còn 3 của lô 5. */
    private BienBanGiaoNhan daNhanLech(PhieuChuyenKho p, String daNhan) {
        daXuat10(p);
        phieuNhapHoanTat(cuaHang, daNhan);
        BienBanGiaoNhan bb = BienBanGiaoNhan.builder().id(80).soBienBan("BBGN-" + HOM_NAY + "-001").phieuChuyenKho(p)
                .tongSoLuongGui(10).tongSoLuongNhan(7).tongSoLuongThieu(2).tongSoLuongHong(1)
                .phuongAnXuLy(IChuyenKho.CHUA_XU_LY).build();
        when(bbRepo.findFirstByPhieuChuyenKho_IdOrderByIdDesc(PCK)).thenReturn(Optional.of(bb));
        when(ctBbRepo.findByBienBan_IdOrderByIdAsc(80)).thenReturn(List.of(ChiTietBienBanGiaoNhan.builder().id(81)
                .bienBan(bb).bienTheSanPham(bienThe).loHang(lo).soLuongGui(10).soLuongNhan(7).soLuongThieu(2)
                .soLuongHong(1).lyDoHongThieu("Rách bao bì").build()));
        when(dckRepo.findFirstByBienBanGiaoNhan_Id(80)).thenReturn(Optional.empty());
        return bb;
    }

    private static PhieuChuyenKhoYeuCau.XuLyChenhLech xuLy(String phuongAn) {
        return PhieuChuyenKhoYeuCau.XuLyChenhLech.builder().phuongAn(phuongAn).lyDo("Nhà xe bồi thường").build();
    }

    @Test
    @DisplayName("Ghi giảm hao hụt: phiếu điều chỉnh giảm DCK (nguồn chuyển kho) trừ trung chuyển 3, sổ kho âm, Hoàn tất")
    void xuLy_ghiGiam_phieuDieuChinhGiam_hoanTat() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        BienBanGiaoNhan bb = daNhanLech(p, "7");
        TonKhoTheoLo tc = ton(transit, lo, "3");

        PhieuDieuChinhKho dck = service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT));

        assertEquals("DCK-" + HOM_NAY + "-001", dck.getSoPhieu());
        assertEquals("chuyen_kho", dck.getNguon());
        assertEquals("giam", dck.getLoaiDieuChinh());
        assertEquals(2, dck.getTrangThai());
        assertEquals(TRANSIT, dck.getKho().getId());
        assertSame(p, dck.getPhieuChuyenKho());
        assertSame(bb, dck.getBienBanGiaoNhan());
        assertNull(dck.getDotKiemKe());
        assertSo("300", dck.getTongGiaTriGiam());
        assertSo("-300", dck.getGiaTriChenhLechThuan());
        assertSo("0", tc.getSoLuongTon());
        ArgumentCaptor<ChiTietPhieuDieuChinh> dong = ArgumentCaptor.forClass(ChiTietPhieuDieuChinh.class);
        verify(ctDckRepo).save(dong.capture());
        assertSo("-3", dong.getValue().getSoLuongDieuChinh());
        assertEquals(81, dong.getValue().getChiTietBienBan().getId());
        assertNull(dong.getValue().getChiTietKiemKe());
        ArgumentCaptor<LichSuGiaoDichKho> so = ArgumentCaptor.forClass(LichSuGiaoDichKho.class);
        verify(lichSuRepo).save(so.capture());
        assertEquals("dieu_chinh", so.getValue().getLoaiGiaoDich());
        assertEquals(ITable.phieu_dieu_chinh_kho, so.getValue().getLoaiThamChieu());
        assertEquals(dck.getId(), so.getValue().getIdThamChieu());
        assertSo("-3", so.getValue().getSoLuong());
        assertSo("3", so.getValue().getSoLuongTruoc());
        assertSo("0", so.getValue().getSoLuongSau());
        assertEquals(IChuyenKho.GHI_GIAM_HAO_HUT, bb.getPhuongAnXuLy());
        assertEquals(NGUOI, bb.getNguoiDuyetXuLy().getId());
        assertEquals(IChuyenKho.HOAN_TAT, p.getTrangThai());
        verify(pckRepo, never()).save(argThat((PhieuChuyenKho x) -> x.getPhieuGoc() != null));
    }

    @Test
    @DisplayName("Giao bù: vẫn lập phiếu điều chỉnh giảm phần lệch, và sinh phiếu chuyển mới Chờ duyệt nối phiếu gốc, đúng số lệch")
    void xuLy_giaoBu_ghiGiamVaTaoPhieuMoi() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        BienBanGiaoNhan bb = daNhanLech(p, "7");
        TonKhoTheoLo tc = ton(transit, lo, "3");
        khaDung(khoTong, "20", null, null, null, null);
        when(pckRepo.soDuoiLonNhat("PX-TRF-" + HOM_NAY)).thenReturn(1);

        service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GIAO_BU_HANG));

        assertSo("0", tc.getSoLuongTon());
        verify(ctDckRepo).save(any(ChiTietPhieuDieuChinh.class));
        assertEquals(IChuyenKho.GIAO_BU_HANG, bb.getPhuongAnXuLy());
        assertEquals(IChuyenKho.HOAN_TAT, p.getTrangThai());
        ArgumentCaptor<PhieuChuyenKho> luu = ArgumentCaptor.forClass(PhieuChuyenKho.class);
        verify(pckRepo, atLeastOnce()).save(luu.capture());
        PhieuChuyenKho bu = luu.getAllValues().stream().filter(x -> x.getPhieuGoc() != null).findFirst().orElseThrow();
        assertSame(p, bu.getPhieuGoc());
        assertEquals(IChuyenKho.CHO_DUYET, bu.getTrangThai());
        assertEquals(KHO_TONG, bu.getKhoXuat().getId());
        assertEquals(CUA_HANG, bu.getKhoNhap().getId());
        assertNotEquals(p.getSoPhieuChuyen(), bu.getSoPhieuChuyen());
        ArgumentCaptor<ChiTietPhieuChuyenKho> dong = ArgumentCaptor.forClass(ChiTietPhieuChuyenKho.class);
        verify(ctPckRepo).save(dong.capture());
        assertSame(bu, dong.getValue().getPhieuChuyenKho());
        assertEquals(3, dong.getValue().getSoLuongChuyen());
    }

    @Test
    @DisplayName("Giao bù khi kho nguồn không còn đủ hàng → 409, không tạo phiếu giao bù")
    void xuLy_giaoBu_khoNguonKhongDu_409() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        daNhanLech(p, "7");
        ton(transit, lo, "3");
        khaDung(khoTong, "1", null, null, null, null);

        assertTrue(loi(HttpStatus.CONFLICT, () -> service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GIAO_BU_HANG)))
                .getMessage().contains("chỉ còn 1"));
        verify(pckRepo, never()).save(argThat((PhieuChuyenKho x) -> x.getPhieuGoc() != null));
        verify(ctPckRepo, never()).save(any());
    }

    @Test
    @DisplayName("Xử lý chênh lệch (cấu hình mặc định): không phải Quản lý Kho tổng → 403; thiếu phương án / lý do → 400; biên bản đã xử lý → 409")
    void xuLy_quyenVaDauVao() {
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        BienBanGiaoNhan bb = daNhanLech(p, "7");
        ton(transit, lo, "3");

        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        assertEquals("Chỉ Quản trị viên hoặc Quản lý Kho tổng xử lý được chênh lệch của phiếu này",
                loi(HttpStatus.FORBIDDEN, () -> service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT))).getMessage());

        quanLyKhoTong();
        loi(HttpStatus.BAD_REQUEST, () -> service.xuLyChenhLech(PCK, xuLy("DEN_BU")));
        assertEquals("Nhập lý do xử lý chênh lệch", loi(HttpStatus.BAD_REQUEST, () -> service.xuLyChenhLech(PCK,
                PhieuChuyenKhoYeuCau.XuLyChenhLech.builder().phuongAn(IChuyenKho.GHI_GIAM_HAO_HUT).build())).getMessage());
        bb.setPhuongAnXuLy(IChuyenKho.GHI_GIAM_HAO_HUT);
        loi(HttpStatus.CONFLICT, () -> service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT)));
        verify(dckRepo, never()).save(any());
        assertEquals(IChuyenKho.CHO_XU_LY_LECH, p.getTrangThai());
    }

    @Test
    @DisplayName("Xử lý chênh lệch: phần đi đường của phiếu không còn đủ số lệch (đã nhận / nhập thêm) → 409, không ghi giảm")
    void xuLy_phanDiDuongKhongDu_409() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        daNhanLech(p, "9"); // đã nhận 9 trên 10 gửi → còn 1 đi đường, biên bản đòi ghi giảm 3
        TonKhoTheoLo tc = ton(transit, lo, "3");

        assertTrue(loi(HttpStatus.CONFLICT, () -> service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT)))
                .getMessage().contains("không còn đủ 3"));
        assertSo("3", tc.getSoLuongTon());
        verify(lichSuRepo, never()).save(any());
    }

    // ══════════════════════════ Ai được xử lý chênh lệch (Cấu hình › Chuyển kho) ══════════════════════════

    private void cheDoXuLyLech(String cheDo) {
        when(cauHinh.getCauHinhString(eq(DieuHanhHeThongServiceImpl.CAU_HINH_CHUYEN_KHO_QUYEN_XU_LY_LECH), anyString()))
                .thenReturn(cheDo);
    }

    /** Phiếu Cửa hàng 2 → Cửa hàng 1 chờ xử lý lệch: quản lý kho xuất (Cửa hàng 2) không phải Quản lý Kho tổng. */
    private PhieuChuyenKho phieuLechGiuaHaiCuaHang() {
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        p.setKhoXuat(khoKhac);
        p.setKhoNhap(cuaHang);
        return p;
    }

    @Test
    @DisplayName("Ai được xử lý chênh lệch: 3 chế độ × QTV / QL Kho tổng / QL kho xuất / QL kho nhận / nhân viên kho xuất, cờ quyền khớp lúc bấm")
    void xuLy_quyenTheoCauHinh_maTran() {
        phieuLechGiuaHaiCuaHang();
        Map<String, Runnable> nguoi = new LinkedHashMap<>();
        nguoi.put("Quản trị viên", this::quanTriVien);
        nguoi.put("Quản lý Kho tổng", this::quanLyKhoTong);
        nguoi.put("Quản lý kho xuất", () -> dangNhap(IRoleType.quan_ly_kho, khoKhac, khoKhac));
        nguoi.put("Quản lý kho nhận", () -> dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang));
        nguoi.put("Nhân viên kho xuất", () -> dangNhap(IRoleType.nhan_vien_kho, khoKhac, khoKhac));
        Map<String, List<String>> duoc = new LinkedHashMap<>();
        duoc.put(IChuyenKho.XU_LY_LECH_QL_KHO_TONG, List.of("Quản trị viên", "Quản lý Kho tổng"));
        duoc.put(IChuyenKho.XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT, List.of("Quản trị viên", "Quản lý Kho tổng", "Quản lý kho xuất"));
        duoc.put(IChuyenKho.XU_LY_LECH_CHI_QUAN_TRI, List.of("Quản trị viên"));

        for (Map.Entry<String, List<String>> cd : duoc.entrySet()) {
            cheDoXuLyLech(cd.getKey());
            for (Map.Entry<String, Runnable> ai : nguoi.entrySet()) {
                ai.getValue().run();
                boolean mongDoi = cd.getValue().contains(ai.getKey());
                String ca = cd.getKey() + " · " + ai.getKey();
                assertEquals(mongDoi, service.chiTiet(PCK).getQuyen().isXuLyChenhLech(), ca);
                // Qua kiểm quyền thì dừng ở bước kiểm phương án (400); không qua thì 403
                CommonException ex = assertThrows(CommonException.class, () -> service.xuLyChenhLech(PCK, xuLy("DEN_BU")), ca);
                assertEquals(mongDoi ? HttpStatus.BAD_REQUEST : HttpStatus.FORBIDDEN, ex.getHttpStatus(), ca + ": " + ex.getMessage());
            }
        }
        verify(dckRepo, never()).save(any());
    }

    @Test
    @DisplayName("Ai được xử lý chênh lệch: câu mô tả theo cấu hình (thiếu / lạ = mặc định), 403 nêu ai được làm, quản lý kho xuất phải đứng ở kho xuất")
    void xuLy_quanLyKhoXuat_moTaVaKhoDangChon() {
        PhieuChuyenKho p = phieuLechGiuaHaiCuaHang();
        BienBanGiaoNhan bb = daNhanLech(p, "7");
        TonKhoTheoLo tc = ton(transit, lo, "3");

        // Chưa có khóa (null) hoặc giá trị lạ sửa tay trong CSDL: theo mặc định
        quanTriVien();
        cheDoXuLyLech(null);
        assertEquals("Quản trị viên hoặc Quản lý Kho tổng", service.chiTiet(PCK).getAiXuLyChenhLech());
        cheDoXuLyLech("QL_KHO_NHAN");
        assertEquals("Quản trị viên hoặc Quản lý Kho tổng", service.chiTiet(PCK).getAiXuLyChenhLech());
        quanLyKhoTong();
        assertTrue(service.chiTiet(PCK).getQuyen().isXuLyChenhLech());
        cheDoXuLyLech(IChuyenKho.XU_LY_LECH_CHI_QUAN_TRI);
        assertEquals("Quản trị viên", service.chiTiet(PCK).getAiXuLyChenhLech());
        assertEquals("Chỉ Quản trị viên xử lý được chênh lệch của phiếu này",
                loi(HttpStatus.FORBIDDEN, () -> service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT))).getMessage());

        cheDoXuLyLech(IChuyenKho.XU_LY_LECH_QL_KHO_TONG_VA_KHO_XUAT);
        assertEquals("Quản trị viên, Quản lý Kho tổng hoặc quản lý Cửa hàng 2", service.chiTiet(PCK).getAiXuLyChenhLech());
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        assertEquals("Chỉ Quản trị viên, Quản lý Kho tổng hoặc quản lý Cửa hàng 2 xử lý được chênh lệch của phiếu này",
                loi(HttpStatus.FORBIDDEN, () -> service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT))).getMessage());

        // Quản lý cả hai cửa hàng mà đang đứng ở kho nhận: thấy nút, bấm thì được nhắc chọn đúng kho
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang, khoKhac);
        assertTrue(service.chiTiet(PCK).getQuyen().isXuLyChenhLech());
        assertTrue(loi(HttpStatus.FORBIDDEN, () -> service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT)))
                .getMessage().contains("kho khác kho đang chọn"));
        verify(dckRepo, never()).save(any());
        assertEquals(IChuyenKho.CHO_XU_LY_LECH, p.getTrangThai());

        // Đứng ở kho xuất: ghi giảm trọn luồng, người duyệt là người đang đăng nhập
        dangNhap(IRoleType.quan_ly_kho, khoKhac, khoKhac);
        service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT));
        assertSo("0", tc.getSoLuongTon());
        assertEquals(IChuyenKho.GHI_GIAM_HAO_HUT, bb.getPhuongAnXuLy());
        assertEquals(NGUOI, bb.getNguoiDuyetXuLy().getId());
        assertEquals(IChuyenKho.HOAN_TAT, p.getTrangThai());

        // Kho xuất là Kho tổng: quản lý kho xuất chính là Quản lý Kho tổng, câu không kể hai lần
        p.setKhoXuat(khoTong);
        assertEquals("Quản trị viên hoặc Quản lý Kho tổng", service.moTaNguoiXuLyChenhLech(p));
    }

    // ══════════════════════════ Đọc: chi tiết, danh sách (phạm vi kho H-4) ══════════════════════════

    @Test
    @DisplayName("Chi tiết: kho xuất và kho nhận đều xem được, kho thứ ba bị 403; Quản lý Kho tổng xem mọi phiếu và được duyệt")
    void chiTiet_haiBenXemDuoc_khoThuBaBiChan() {
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_DUYET);
        when(pxRepo.findByPhieuChuyenKho_IdOrderByIdDesc(PCK)).thenReturn(List.of());

        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKhoDto.ChiTiet ct = service.chiTiet(PCK);
        assertEquals(CUA_HANG, ct.getKhoNhap().getId());
        assertFalse(ct.getQuyen().isDuyet());
        assertEquals(10, ct.getHang().get(0).getSoLuongChuyen());
        assertEquals("Cái", ct.getHang().get(0).getDonViTinh());

        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        assertEquals(KHO_TONG, service.chiTiet(PCK).getKhoXuat().getId());

        dangNhap(IRoleType.quan_ly_kho, khoKhac, khoKhac);
        loi(HttpStatus.FORBIDDEN, () -> service.chiTiet(PCK));

        quanLyKhoTong();
        assertTrue(service.chiTiet(PCK).getQuyen().isDuyet());
        p.setTrangThai(IChuyenKho.DA_DUYET);
        PhieuChuyenKhoDto.Quyen q = service.chiTiet(PCK).getQuyen();
        assertTrue(q.isXuat() && q.isNhat() && q.isHuy());
        assertFalse(q.isNhan());
    }

    @Test
    @DisplayName("Chi tiết phiếu đang đi: số đã xuất, còn trên đường theo biến thể và hàng theo lô cho màn Nhận hàng")
    void chiTiet_dangVanChuyen_soLieuHang() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(p);

        PhieuChuyenKhoDto.ChiTiet ct = service.chiTiet(PCK);

        assertSo("10", ct.getHang().get(0).getDaXuat());
        assertSo("10", ct.getHang().get(0).getConTrenDuong());
        assertEquals(1, ct.getHangTheoLo().size());
        assertEquals("LO-5", ct.getHangTheoLo().get(0).getMaLo());
        assertTrue(ct.getQuyen().isNhan());
        assertFalse(ct.getQuyen().isGhiSoXknb(), "kho nhận không ghi số XKNB");
    }

    @Test
    @DisplayName("Chi tiết có biên bản: kèm ảnh chụp của biên bản và cờ thêm ảnh (cùng điều kiện với lúc bấm thêm)")
    void chiTiet_bienBan_kemAnhVaCoThemAnh() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        BienBanGiaoNhan bb = daNhanLech(p, "7");
        List<PhieuChuyenKhoDto.AnhBienBan> anh = List.of(PhieuChuyenKhoDto.AnhBienBan.builder()
                .id(1).url("https://minio.slmglobal.vn/a.jpg").moTa("Thùng móp").nguoiChup("Người dùng").duocXoa(true).build());
        when(anhBienBan.danhSach(eq(bb), eq(p), any())).thenReturn(anh);
        when(anhBienBan.duocThem(any(), eq(p), eq(bb))).thenReturn(true);

        PhieuChuyenKhoDto.ChiTiet ct = service.chiTiet(PCK);

        assertEquals(anh, ct.getBienBan().getAnh());
        assertTrue(ct.getQuyen().isThemAnhBienBan());

        // Phiếu chưa có biên bản: không hỏi danh sách ảnh, cờ theo biên bản trống
        PhieuChuyenKho p2 = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        when(bbRepo.findFirstByPhieuChuyenKho_IdOrderByIdDesc(PCK)).thenReturn(Optional.empty());
        clearInvocations(anhBienBan);
        PhieuChuyenKhoDto.ChiTiet ct2 = service.chiTiet(PCK);
        assertNull(ct2.getBienBan());
        assertFalse(ct2.getQuyen().isThemAnhBienBan());
        verify(anhBienBan, never()).danhSach(any(), any(), any());
        verify(anhBienBan).duocThem(any(), eq(p2), isNull());
    }

    @Test
    @DisplayName("Chi tiết phiếu Đã duyệt: phiếu nhặt (mã, trạng thái, người nhặt), đã nhặt theo số quét; xác nhận xuất chỉ khi đã nhặt xong")
    void chiTiet_daDuyet_phieuNhat() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuXuatKho px = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        DanhSachNhatHang pl = phieuNhat(px, "dang_nhat");
        pl.setChiTietNhatHangs(List.of(ChiTietNhatHang.builder().id(1).danhSachNhatHang(pl).bienTheSanPham(bienThe)
                .soLuongCanNhat(new BigDecimal("10")).soLuongDaQuet(new BigDecimal("4")).build()));

        PhieuChuyenKhoDto.ChiTiet ct = service.chiTiet(PCK);

        assertEquals(80, ct.getPhieuNhat().getId());
        assertEquals(pl.getMaPickList(), ct.getPhieuNhat().getSo());
        assertEquals("dang_nhat", ct.getPhieuNhat().getTrangThai());
        assertEquals("Thủ kho A", ct.getPhieuNhat().getNguoi());
        assertSo("4", ct.getHang().get(0).getDaNhat());
        assertFalse(ct.isDaNhatXong());
        assertFalse(ct.isChonLoTay());

        // hoàn tất nhặt: lô đã ghi vào PX-CK, số đã nhặt đọc từ dòng lô
        pl.setTrangThai("da_nhat");
        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(dongLo(px, bienThe, lo, "10")));
        ct = service.chiTiet(PCK);
        assertTrue(ct.isDaNhatXong());
        assertSo("10", ct.getHang().get(0).getDaNhat());
    }

    @Test
    @DisplayName("Chi tiết: phiếu nhặt Đã nhặt nhưng PX-CK chưa có lô / lô thiếu (6/10) → chưa được xác nhận xuất; đủ 6 + 4 = 10 thì được")
    void chiTiet_daNhat_loPhieuXuatThieu_chuaNhatXong() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuXuatKho px = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);
        phieuNhat(px, "da_nhat");

        assertFalse(service.chiTiet(PCK).isDaNhatXong(), "PX-CK chưa có dòng lô");

        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(dongLo(px, bienThe, lo, "6")));
        assertFalse(service.chiTiet(PCK).isDaNhatXong(), "lô PX-CK mới 6/10");

        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(dongLo(px, bienThe, lo, "6"),
                dongLo(px, bienThe, lo2, "4.000")));
        assertTrue(service.chiTiet(PCK).isDaNhatXong());
    }

    @Test
    @DisplayName("Chi tiết phiếu cũ không có phiếu nhặt: chọn lô tay đủ thì được xác nhận xuất, thiếu thì chưa; chưa có lô thì chưa nhặt")
    void chiTiet_phieuCuChonLoTay() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        PhieuXuatKho px = phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);

        PhieuChuyenKhoDto.ChiTiet ct = service.chiTiet(PCK);
        assertNull(ct.getPhieuNhat());
        assertFalse(ct.isDaNhatXong());
        assertFalse(ct.isChonLoTay());

        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(dongLo(px, bienThe, lo, "6")));
        ct = service.chiTiet(PCK);
        assertTrue(ct.isChonLoTay());
        assertFalse(ct.isDaNhatXong(), "mới chọn 6/10");

        when(ctPxRepo.findByPhieuXuatKhoIdAndLoHangIsNotNull(PX)).thenReturn(List.of(dongLo(px, bienThe, lo, "6"),
                dongLo(px, bienThe, lo2, "4")));
        assertTrue(service.chiTiet(PCK).isDaNhatXong());
    }

    @Test
    @DisplayName("Danh sách: người không phải Quản lý Kho tổng mà chưa chọn kho → 400; phiếu hoàn tất có ghi giảm được đánh dấu")
    void danhSach_phamViVaDanhDauChenhLech() {
        dangNhap(IRoleType.nhan_vien_kho, null, cuaHang);
        assertEquals("Chọn kho làm việc để xem phiếu chuyển kho",
                loi(HttpStatus.BAD_REQUEST, () -> service.danhSach(null, null, null, null, null, 0, 10)).getMessage());

        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.HOAN_TAT);
        when(pckRepo.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(p)));
        when(ctPckRepo.tongSoLuongTheoPhieu(List.of(PCK))).thenReturn(List.<Object[]>of(new Object[]{PCK, 10L}));
        when(bbRepo.findByPhieuChuyenKho_IdIn(List.of(PCK))).thenReturn(List.of(BienBanGiaoNhan.builder()
                .phieuChuyenKho(p).phuongAnXuLy(IChuyenKho.GHI_GIAM_HAO_HUT).build()));

        PhieuChuyenKhoDto.DanhSach ds = service.danhSach("TAB_LA", null, null, null, null, 0, 10);

        assertEquals(1, ds.getContent().size());
        assertTrue(ds.getContent().get(0).isCoChenhLech());
        assertEquals(10, ds.getContent().get(0).getTongSoLuong());
        assertEquals(PhieuChuyenKhoService.TAB, List.copyOf(ds.getSoTheoTab().keySet()));
        verify(pckRepo, times(PhieuChuyenKhoService.TAB.size())).count(any(Specification.class));
    }

    @Test
    @DisplayName("Danh sách không gửi tab (null): theo tab Tất cả, không lỗi 500 (List.of không nhận contains(null))")
    @SuppressWarnings("unchecked")
    void danhSach_tabNull_tatCa() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_DUYET);
        when(pckRepo.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(p)));

        PhieuChuyenKhoDto.DanhSach ds = assertDoesNotThrow(() -> service.danhSach(null, null, null, null, null, 0, 10));

        assertEquals(1, ds.getContent().size());
        assertEquals(PhieuChuyenKhoService.TAB, List.copyOf(ds.getSoTheoTab().keySet()));
        // Điều kiện của trang: Quản lý Kho tổng, không từ khóa / kho / trạng thái, tab Tất cả → không lọc gì (chỉ cb.and rỗng)
        ArgumentCaptor<Specification<PhieuChuyenKho>> dieuKien = ArgumentCaptor.forClass(Specification.class);
        verify(pckRepo).findAll(dieuKien.capture(), any(Pageable.class));
        CriteriaBuilder cb = mock(CriteriaBuilder.class);
        dieuKien.getValue().toPredicate(mock(Root.class), mock(CriteriaQuery.class), cb);
        assertEquals(Set.of("and"), mockingDetails(cb).getInvocations().stream()
                .map(i -> i.getMethod().getName()).collect(Collectors.toSet()));
    }

    @Test
    @DisplayName("Chi tiết khi chưa có bảng ảnh biên bản (chưa chạy bước h): vẫn trả phiếu + biên bản, ảnh rỗng; truy vấn ảnh ở giao dịch chỉ đọc REQUIRES_NEW riêng")
    void chiTiet_loiBangAnhBienBan_vanTraDuLieu() {
        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        BienBanGiaoNhan bb = daNhanLech(p, "7");
        // Dịch vụ ảnh thật; kho ảnh ném lỗi SQL như khi chưa có bảng bien_ban_giao_nhan_anh
        BienBanGiaoNhanAnhRepository anhRepo = mock(BienBanGiaoNhanAnhRepository.class);
        when(anhRepo.danhSachTheoBienBan(bb.getId())).thenThrow(new InvalidDataAccessResourceUsageException(
                "Table 'fashion_system.bien_ban_giao_nhan_anh' doesn't exist"));
        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
        when(txManager.getTransaction(any())).thenAnswer(i -> new SimpleTransactionStatus());
        AnhBienBanGiaoNhanService anhThat = new AnhBienBanGiaoNhanService(pckRepo, bbRepo, anhRepo,
                mock(TepTinRepository.class), ndRepo, pqRepo, nhatKy, mock(MinioService.class), txManager);
        ReflectionTestUtils.setField(service, "anhBienBanGiaoNhanService", anhThat);

        PhieuChuyenKhoDto.ChiTiet ct = assertDoesNotThrow(() -> service.chiTiet(PCK));

        assertEquals(PCK, ct.getId());
        assertEquals(bb.getSoBienBan(), ct.getBienBan().getSoBienBan());
        assertTrue(ct.getBienBan().getAnh().isEmpty());
        assertTrue(ct.getQuyen().isThemAnhBienBan(), "cờ thêm ảnh không đọc bảng ảnh");
        assertSo("10", ct.getHang().get(0).getDaXuat());
        // Lỗi nằm trong giao dịch riêng (REQUIRES_NEW, chỉ đọc) và chỉ giao dịch đó hoàn tác: giao dịch của chi tiết
        // phiếu không bị đánh dấu rollback-only
        ArgumentCaptor<TransactionDefinition> dn = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(txManager).getTransaction(dn.capture());
        assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, dn.getValue().getPropagationBehavior());
        assertTrue(dn.getValue().isReadOnly());
        verify(txManager).rollback(any());
    }

    // ══════════════════════════ Thông báo (UC 7.2): gọi đúng sự kiện, sau nhật ký ══════════════════════════
    // Luật người nhận và cách ghi kiểm ở ThongBaoChuyenKhoServiceTest.

    @Test
    @DisplayName("Thông báo: tạo phiếu → choDuyet(phiếu mới, người tạo), sau khi ghi nhật ký")
    void thongBao_tao_choDuyet() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        khaDung(khoTong, "10", "2", "0", null, null);

        PhieuChuyenKho p = service.tao(yeuCau(khoTong, cuaHang, "3"));

        var thuTu = inOrder(nhatKy, thongBao);
        thuTu.verify(nhatKy).create(any(LichSuThayDoi.class));
        thuTu.verify(thongBao).choDuyet(same(p), argThat(n -> n.getId() == NGUOI));
        verifyNoMoreInteractions(thongBao);
    }

    @Test
    @DisplayName("Thông báo: duyệt → daDuyet; duyệt bị chặn (403) thì không thông báo")
    void thongBao_duyet() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_DUYET);
        loi(HttpStatus.FORBIDDEN, () -> service.duyet(PCK, PhieuChuyenKhoYeuCau.Duyet.builder()
                .lyDoDieuDong(IChuyenKho.LY_DO_BO_SUNG).build()));
        verifyNoInteractions(thongBao);

        quanLyKhoTong();
        khaDung(khoTong, "10", null, null, null, PCK);
        service.duyet(PCK, PhieuChuyenKhoYeuCau.Duyet.builder().lyDoDieuDong(IChuyenKho.LY_DO_BO_SUNG).build());
        var thuTu = inOrder(nhatKy, thongBao);
        thuTu.verify(nhatKy).create(any(LichSuThayDoi.class));
        thuTu.verify(thongBao).daDuyet(same(p), argThat(n -> n.getId() == NGUOI));
        verifyNoMoreInteractions(thongBao);
    }

    @Test
    @DisplayName("Thông báo: hủy → daHuy kèm trạng thái trước khi hủy (phân biệt từ chối / hủy, có báo kho xuất không)")
    void thongBao_huy_kemTrangThaiTruoc() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        phieuXuatCon(p, ITrangThaiPhieuXuat.NHAP);

        service.huy(PCK, PhieuChuyenKhoYeuCau.Huy.builder().lyDo("Đổi kế hoạch").build());

        verify(thongBao).daHuy(same(p), eq(IChuyenKho.DA_DUYET), argThat(n -> n.getId() == NGUOI));
        assertEquals(IChuyenKho.DA_HUY, p.getTrangThai(), "từ chối vẫn là trạng thái Đã hủy");
        verifyNoMoreInteractions(thongBao);
    }

    @Test
    @DisplayName("Thông báo: xác nhận xuất → daXuat; nhận lệch → nhanLech kèm biên bản; nhận đủ không thông báo")
    void thongBao_xuat_nhanLech_nhanDu() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        daNhatXong(p);
        service.xacNhanXuat(PCK, xeCongTy());
        verify(thongBao).daXuat(same(p), argThat(n -> n.getId() == NGUOI));

        dangNhap(IRoleType.nhan_vien_kho, cuaHang, cuaHang);
        PhieuChuyenKho dangDi = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(dangDi);
        ton(transit, lo, "10");
        BienBanGiaoNhan bb = service.nhanLech(PCK, nhanLech(dem(LO, 7, 1, "Rách bao bì")));
        verify(thongBao).nhanLech(same(dangDi), same(bb), argThat(n -> n.getId() == NGUOI));

        PhieuChuyenKho du = phieu(IChuyenKho.DANG_VAN_CHUYEN);
        daXuat10(du);
        ton(transit, lo, "10");
        service.nhanDu(PCK);
        verifyNoMoreInteractions(thongBao);
    }

    @Test
    @DisplayName("Thông báo: xử lý chênh lệch giao bù → choDuyet(phiếu giao bù); ghi giảm không tạo phiếu nên không thông báo")
    void thongBao_giaoBu_choDuyet() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        daNhanLech(p, "7");
        ton(transit, lo, "3");
        khaDung(khoTong, "20", null, null, null, null);
        when(pckRepo.soDuoiLonNhat("PX-TRF-" + HOM_NAY)).thenReturn(1);

        service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GIAO_BU_HANG));

        ArgumentCaptor<PhieuChuyenKho> bu = ArgumentCaptor.forClass(PhieuChuyenKho.class);
        verify(thongBao).choDuyet(bu.capture(), argThat(n -> n.getId() == NGUOI));
        assertSame(p, bu.getValue().getPhieuGoc());
        assertEquals(IChuyenKho.CHO_DUYET, bu.getValue().getTrangThai());
        verifyNoMoreInteractions(thongBao);

        PhieuChuyenKho p2 = phieu(IChuyenKho.CHO_XU_LY_LECH);
        daNhanLech(p2, "7");
        ton(transit, lo, "3");
        service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT));
        verifyNoMoreInteractions(thongBao);
    }

    // ══════════════════════════ Sửa sau rà soát 29/10 ══════════════════════════

    @Test
    @DisplayName("Tạo: gộp hai dòng cùng mã vượt giới hạn số nguyên, hoặc một dòng quá lớn → 400, không tạo phiếu số lượng âm")
    void tao_soLuongTranSo_400() {
        dangNhap(IRoleType.quan_ly_kho, cuaHang, cuaHang);
        khaDung(khoTong, "10", null, null, null, null);
        for (PhieuChuyenKhoCreating yc : List.of(yeuCau(khoTong, cuaHang, "2000000000", "2000000000"),
                yeuCau(khoTong, cuaHang, "3000000000"))) {
            assertEquals("Số lượng chuyển quá lớn", loi(HttpStatus.BAD_REQUEST, () -> service.tao(yc)).getMessage());
        }
        verify(pckRepo, never()).save(any());
        verify(ctPckRepo, never()).save(any());
    }

    @Test
    @DisplayName("Giao bù: khóa một lần dòng trung chuyển của lô lệch CÙNG dòng tồn kho nguồn của mã lệch, theo PK tăng dần (giữ chỗ mới như tao)")
    void xuLy_giaoBu_khoaTonKhoNguon() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        daNhanLech(p, "7");
        ton(transit, lo, "3");
        khaDung(khoTong, "20", null, null, null, null);
        when(pckRepo.soDuoiLonNhat("PX-TRF-" + HOM_NAY)).thenReturn(1);
        when(tonRepo.findIdsByKhoAndLots(eq(TRANSIT), any())).thenReturn(List.of(30));
        when(tonRepo.findIdsByKhoAndVariants(eq(KHO_TONG), any())).thenReturn(List.of(40, 12));

        service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GIAO_BU_HANG));

        verify(tonRepo).findIdsByKhoAndVariants(KHO_TONG, List.of(BT));
        verify(tonRepo).lockLotsForUpdateByIds(List.of(12, 30, 40));
        verify(tonRepo, times(1)).lockLotsForUpdateByIds(any());
        // khóa phiếu chuyển → khóa tồn (một lượt) → mới đọc khả dụng kho nguồn để giữ chỗ phiếu bù
        var thuTu = inOrder(pckRepo, tonRepo);
        thuTu.verify(pckRepo).khoaTheoId(PCK);
        thuTu.verify(tonRepo).lockLotsForUpdateByIds(List.of(12, 30, 40));
        thuTu.verify(tonRepo).sumSoLuongKhaDungByKhoAndBienTheIds(KHO_TONG, List.of(BT));
    }

    @Test
    @DisplayName("Ghi giảm: chỉ khóa dòng trung chuyển, không đụng tồn kho nguồn")
    void xuLy_ghiGiam_chiKhoaTrungChuyen() {
        quanLyKhoTong();
        PhieuChuyenKho p = phieu(IChuyenKho.CHO_XU_LY_LECH);
        daNhanLech(p, "7");
        ton(transit, lo, "3");
        when(tonRepo.findIdsByKhoAndLots(eq(TRANSIT), any())).thenReturn(List.of(30));

        service.xuLyChenhLech(PCK, xuLy(IChuyenKho.GHI_GIAM_HAO_HUT));

        verify(tonRepo).lockLotsForUpdateByIds(List.of(30));
        verify(tonRepo, never()).findIdsByKhoAndVariants(any(), any());
    }

    private static DataIntegrityViolationException loiRangBuoc(String cauMySql) {
        return new DataIntegrityViolationException("could not execute statement [" + cauMySql + "]",
                new java.sql.SQLIntegrityConstraintViolationException(cauMySql));
    }

    @Test
    @DisplayName("Xác nhận xuất / Ghi số XKNB: hai chuyến cùng lúc ghi một số, bên sau dính khóa uk_pck_xknb khi lưu → 409 câu rõ, không xuất")
    void xknb_trungLucLuu_409() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        when(pckRepo.saveAndFlush(any(PhieuChuyenKho.class)))
                .thenThrow(loiRangBuoc("Duplicate entry '6K26NAB-0000125' for key 'phieu_chuyen_kho.uk_pck_xknb'"));

        PhieuChuyenKho p = phieu(IChuyenKho.DA_DUYET);
        daNhatXong(p);
        assertEquals("Số 0000125 của ký hiệu 6K26NAB vừa được ghi cho chuyến khác",
                loi(HttpStatus.CONFLICT, () -> service.xacNhanXuat(PCK, xeCongTy())).getMessage());
        verify(pxService, never()).xuatPhieuXuatCon(any(), any());

        phieu(IChuyenKho.DANG_VAN_CHUYEN);
        PhieuChuyenKhoYeuCau.GhiSoXknb yc = PhieuChuyenKhoYeuCau.GhiSoXknb.builder().kyHieuXknb("6c26nxy").soPhieuXknb("0000007").build();
        assertEquals("Số 0000007 của ký hiệu 6C26NXY vừa được ghi cho chuyến khác",
                loi(HttpStatus.CONFLICT, () -> service.ghiSoXknb(PCK, yc)).getMessage());
    }

    @Test
    @DisplayName("Ghi số XKNB: lỗi ràng buộc khác khi lưu giữ nguyên, không đổi thành câu trùng số")
    void ghiSoXknb_rangBuocKhac_giuNguyen() {
        dangNhap(IRoleType.nhan_vien_kho, khoTong, khoTong);
        phieu(IChuyenKho.DANG_VAN_CHUYEN);
        DataIntegrityViolationException khac = loiRangBuoc("Cannot add or update a child row: a foreign key constraint fails");
        when(pckRepo.saveAndFlush(any(PhieuChuyenKho.class))).thenThrow(khac);

        assertSame(khac, assertThrows(DataIntegrityViolationException.class, () -> service.ghiSoXknb(PCK,
                PhieuChuyenKhoYeuCau.GhiSoXknb.builder().kyHieuXknb("6C26NXY").soPhieuXknb("0000007").build())));
    }
}
