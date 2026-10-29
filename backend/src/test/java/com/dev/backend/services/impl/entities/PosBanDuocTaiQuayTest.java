package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.PosCatalogBienTheDto;
import com.dev.backend.dto.PosCatalogNhomDto;
import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PosCatalogItemDto;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.dto.response.customize.PosInsufficientStockInfo;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.multitable.BanDuocTaiQuayService;
import com.dev.backend.services.impl.multitable.GiuChoChuyenKhoService;
import com.dev.backend.services.impl.multitable.LoDangGiuService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Số bán được tại quầy: danh mục POS (gộp kích cỡ, tra tồn giỏ, tra cứu mã) và bước thanh toán dùng CHUNG một công thức
 * (BanDuocTaiQuayService). Dịch vụ thật (BanDuocTaiQuayService, LoDangGiuService, GiuChoChuyenKhoService, PosCatalogService,
 * PosCheckoutTransaction) chạy trên cùng một bộ dữ liệu repository giả; số "SQL" của danh mục được dựng đúng như truy vấn
 * (Σ theo lô max(0, tồn − đã đặt)).
 *
 * Dữ liệu kho 1:
 * - SKU 93 (mẫu 59, màu 1): lô 69 tồn 3 (phiếu nhặt đang mở giữ 2 → còn 1), lô 70 tồn 2 đặt 1 (phiếu xuất bán chờ xuất
 *   giữ 3 → âm, tính 0), lô 71 tồn 4; phiếu chuyển giữ chỗ 2 → bán được 1 + 0 + 4 − 2 = 3 (SQL thô: 3 + 1 + 4 = 8).
 * - SKU 94 (mẫu 59, màu 1, cỡ sau): lô 75 tồn 4, không bị giữ → 4.
 * - SKU 95 (mẫu 60, màu 2): lô 80 tồn 2, phiếu chuyển giữ chỗ 2 → 0 (SQL thô: 2).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PosBanDuocTaiQuayTest {

    @Mock private EntityManager entityManager;
    @Mock private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock private AnhBienTheRepository anhBienTheRepository;
    @Mock private AnhQuanAoRepository anhQuanAoRepository;
    @Mock private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;
    @Mock private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock private PhanBoLoNhatHangRepository phanBoLoNhatHangRepository;
    @Mock private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @Mock private ChiTietPhieuChuyenKhoRepository chiTietPhieuChuyenKhoRepository;
    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private ThueGtgtService thueGtgtService;
    @Mock private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;
    @Mock private PosCheckoutRequestRepository posCheckoutRequestRepository;
    @Mock private PosPaymentRepository posPaymentRepository;

    private BanDuocTaiQuayService banDuocTaiQuayService;
    private PosCatalogService catalog;
    private PosCheckoutTransaction checkout;

    private Kho kho;
    private final Map<Integer, BienTheSanPham> bienThes = new LinkedHashMap<>();
    private final List<TonKhoTheoLo> lots = new ArrayList<>();

    @BeforeEach
    void setUp() {
        kho = Kho.builder().id(1).tenKho("Kho 1").maKho("KHO01").loaiKho("cua_hang").trangThai(1).build();
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of("quan_tri_vien")).build());

        bienThes.clear();
        lots.clear();
        bienThes.put(93, bienThe(93, 59));
        bienThes.put(94, bienThe(94, 59));
        bienThes.put(95, bienThe(95, 60));
        lots.add(lot(72, 69, 93, "3", "0", "2026-10-01T00:00:00Z"));
        lots.add(lot(73, 70, 93, "2", "1", "2026-10-02T00:00:00Z"));
        lots.add(lot(74, 71, 93, "4", "0", "2026-10-03T00:00:00Z"));
        lots.add(lot(76, 75, 94, "4", "0", "2026-10-01T00:00:00Z"));
        lots.add(lot(81, 80, 95, "2", "0", "2026-10-01T00:00:00Z"));

        LoDangGiuService loDangGiuService = new LoDangGiuService();
        ReflectionTestUtils.setField(loDangGiuService, "phanBoLoNhatHangRepository", phanBoLoNhatHangRepository);
        ReflectionTestUtils.setField(loDangGiuService, "chiTietPhieuXuatKhoRepository", chiTietPhieuXuatKhoRepository);
        ReflectionTestUtils.setField(loDangGiuService, "tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        ReflectionTestUtils.setField(loDangGiuService, "entityManager", entityManager);
        GiuChoChuyenKhoService giuChoChuyenKhoService = new GiuChoChuyenKhoService(chiTietPhieuChuyenKhoRepository);
        banDuocTaiQuayService = new BanDuocTaiQuayService(tonKhoTheoLoRepository, loDangGiuService, giuChoChuyenKhoService);

        catalog = new PosCatalogService();
        ReflectionTestUtils.setField(catalog, "entityManager", entityManager);
        ReflectionTestUtils.setField(catalog, "bienTheSanPhamRepository", bienTheSanPhamRepository);
        ReflectionTestUtils.setField(catalog, "anhBienTheRepository", anhBienTheRepository);
        ReflectionTestUtils.setField(catalog, "anhQuanAoRepository", anhQuanAoRepository);
        ReflectionTestUtils.setField(catalog, "phanQuyenNguoiDungKhoRepository", phanQuyenNguoiDungKhoRepository);
        ReflectionTestUtils.setField(catalog, "banDuocTaiQuayService", banDuocTaiQuayService);

        checkout = new PosCheckoutTransaction();
        ReflectionTestUtils.setField(checkout, "entityManager", entityManager);
        ReflectionTestUtils.setField(checkout, "posCatalogService", catalog);
        ReflectionTestUtils.setField(checkout, "bienTheSanPhamRepository", bienTheSanPhamRepository);
        ReflectionTestUtils.setField(checkout, "donBanHangRepository", donBanHangRepository);
        ReflectionTestUtils.setField(checkout, "chiTietDonBanHangRepository", chiTietDonBanHangRepository);
        ReflectionTestUtils.setField(checkout, "phieuXuatKhoRepository", phieuXuatKhoRepository);
        ReflectionTestUtils.setField(checkout, "chiTietPhieuXuatKhoRepository", chiTietPhieuXuatKhoRepository);
        ReflectionTestUtils.setField(checkout, "tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        ReflectionTestUtils.setField(checkout, "loDangGiuService", loDangGiuService);
        ReflectionTestUtils.setField(checkout, "giuChoChuyenKhoService", giuChoChuyenKhoService);
        ReflectionTestUtils.setField(checkout, "thueGtgtService", thueGtgtService);
        ReflectionTestUtils.setField(checkout, "lichSuGiaoDichKhoRepository", lichSuGiaoDichKhoRepository);
        ReflectionTestUtils.setField(checkout, "posCheckoutRequestRepository", posCheckoutRequestRepository);
        ReflectionTestUtils.setField(checkout, "posPaymentRepository", posPaymentRepository);
        ReflectionTestUtils.setField(checkout, "objectMapper",
                new ObjectMapper().registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule()));

        stubKhoVaGiuCho();
        stubDanhMucSql();
        stubThanhToan();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    // ===== Dữ liệu =====

    private BienTheSanPham bienThe(int id, int sanPhamId) {
        return BienTheSanPham.builder().id(id).maSku("SKU" + id).giaBan(new BigDecimal("100000")).trangThai(1)
                .sanPham(SanPhamQuanAo.builder().id(sanPhamId).tenSanPham("Áo " + sanPhamId).trangThai(1).build())
                .build();
    }

    private TonKhoTheoLo lot(int id, int loHangId, int bienTheId, String ton, String dat, String ngayNhap) {
        LoHang lo = LoHang.builder().id(loHangId).maLo("L" + loHangId).giaVon(new BigDecimal("50000"))
                .bienTheSanPham(bienThes.get(bienTheId)).build();
        return TonKhoTheoLo.builder().id(id).kho(kho).loHang(lo)
                .soLuongTon(new BigDecimal(ton)).soLuongDaDat(new BigDecimal(dat))
                .ngayNhapGanNhat(Instant.parse(ngayNhap)).build();
    }

    private List<TonKhoTheoLo> lotsCua(Collection<Integer> bienTheIds) {
        return lots.stream().filter(t -> bienTheIds.contains(t.getLoHang().getBienTheSanPham().getId())).toList();
    }

    /** Đúng như cột tồn của truy vấn danh mục: Σ theo lô max(0, tồn − đã đặt). */
    private BigDecimal soSql(int bienTheId) {
        return lotsCua(List.of(bienTheId)).stream()
                .map(t -> t.getSoLuongTon().subtract(t.getSoLuongDaDat()).max(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private PosCatalogBienTheDto dongDanhMuc(int bienTheId, int mauSacId, int thuTuSize) {
        BienTheSanPham b = bienThes.get(bienTheId);
        return new PosCatalogBienTheDto(bienTheId, b.getSanPham().getId(), b.getSanPham().getTenSanPham(), b.getMaSku(),
                null, mauSacId, "Màu " + mauSacId, "#000000", "S" + thuTuSize, thuTuSize, 1, "Cotton",
                b.getGiaBan(), soSql(bienTheId), 28, "Áo");
    }

    private PosCatalogItemDto dongTraCuu(int bienTheId) {
        BienTheSanPham b = bienThes.get(bienTheId);
        return new PosCatalogItemDto(bienTheId, b.getSanPham().getId(), b.getSanPham().getTenSanPham(), b.getMaSku(),
                null, "Màu", "#000000", "M", "Cotton", b.getGiaBan(), soSql(bienTheId), 28, "Áo");
    }

    private static List<Object[]> dong(Object[]... rows) {
        return new ArrayList<>(List.of(rows));
    }

    private void stubKhoVaGiuCho() {
        when(entityManager.find(Kho.class, 1)).thenReturn(kho);
        when(tonKhoTheoLoRepository.findByKhoAndBienTheIds(eq(1), anyCollection()))
                .thenAnswer(inv -> lotsCua(inv.getArgument(1)));
        // Phiếu nhặt đang mở giữ 2 chiếc của lô 69; phiếu xuất bán Chờ xuất giữ 3 chiếc của lô 70
        when(phanBoLoNhatHangRepository.bienTheDangGiuTaiKho(1)).thenReturn(List.of(93));
        when(phanBoLoNhatHangRepository.sumDangGiuTheoLo(eq(1), anyCollection(), isNull())).thenAnswer(inv -> {
            Collection<Integer> loIds = inv.getArgument(1);
            return loIds.contains(69) ? dong(new Object[]{69, new BigDecimal("2")}) : dong();
        });
        when(chiTietPhieuXuatKhoRepository.bienTheDangGiuPhieuBanChuaXuat(1)).thenReturn(List.of(93));
        when(chiTietPhieuXuatKhoRepository.sumDangGiuPhieuBanChuaXuat(eq(1), anyCollection(), isNull())).thenAnswer(inv -> {
            Collection<Integer> loIds = inv.getArgument(1);
            return loIds.contains(70) ? dong(new Object[]{70, new BigDecimal("3")}) : dong();
        });
        // Phiếu chuyển Chờ duyệt / Đã duyệt từ kho 1 giữ chỗ 2 chiếc SKU 93 và 2 chiếc SKU 95 (chưa chọn lô)
        when(chiTietPhieuChuyenKhoRepository.bienTheGiuChoTaiKho(1)).thenReturn(List.of(93, 95));
        // Các phiếu chuyển này chưa có phiếu nhặt: giữ đủ và phần ngoài phiếu nhặt (truPhanBoNhat) bằng nhau
        org.mockito.stubbing.Answer<List<Object[]>> giuCho = inv -> {
            Collection<Integer> ids = inv.getArgument(0);
            List<Object[]> rows = dong();
            if (ids.contains(93)) rows.add(new Object[]{93, 1, new BigDecimal("2")});
            if (ids.contains(95)) rows.add(new Object[]{95, 1, new BigDecimal("2")});
            return rows;
        };
        when(chiTietPhieuChuyenKhoRepository.giuChoTheoBienTheVaKho(anyCollection(), eq(1), isNull())).thenAnswer(giuCho);
        when(chiTietPhieuChuyenKhoRepository.giuChoTheoBienTheVaKho(anyCollection(), eq(1), isNull(), anyBoolean())).thenAnswer(giuCho);
    }

    private void stubDanhMucSql() {
        when(bienTheSanPhamRepository.findPosCatalogBienThe(eq(1), isNull()))
                .thenAnswer(inv -> List.of(dongDanhMuc(93, 1, 1), dongDanhMuc(94, 1, 2), dongDanhMuc(95, 2, 1)));
        when(bienTheSanPhamRepository.findPosAvailableStock(eq(1), anyCollection())).thenAnswer(inv -> {
            Collection<Integer> ids = inv.getArgument(1);
            List<Object[]> rows = dong();
            for (Integer id : ids) {
                if (bienThes.containsKey(id)) rows.add(new Object[]{id, soSql(id)});
            }
            return rows;
        });
        when(bienTheSanPhamRepository.findPosCatalogByBarcode(eq(1), anyString(), any())).thenAnswer(inv -> {
            int id = Integer.parseInt(((String) inv.getArgument(1)).replace("SKU", ""));
            return new PageImpl<>(List.of(dongTraCuu(id)));
        });
        when(bienTheSanPhamRepository.findPosCatalogBySkuPrefix(eq(1), anyString(), any())).thenAnswer(inv -> {
            int id = Integer.parseInt(((String) inv.getArgument(1)).replace("SKU", ""));
            return new PageImpl<>(List.of(dongTraCuu(id)));
        });
    }

    private void stubThanhToan() {
        when(entityManager.find(KhachHang.class, 10))
                .thenReturn(KhachHang.builder().id(10).maKhachHang("KHLE").tenKhachHang("Khách lẻ").trangThai(1).build());
        when(entityManager.find(NguoiDung.class, 7)).thenReturn(NguoiDung.builder().id(7).hoTen("Thu ngân").build());
        when(bienTheSanPhamRepository.findAllById(anyList())).thenAnswer(inv -> {
            List<Integer> ids = inv.getArgument(0);
            return ids.stream().map(bienThes::get).toList();
        });
        when(tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(eq(1), anyCollection()))
                .thenAnswer(inv -> lotsCua(inv.getArgument(1)));
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> {
            DonBanHang d = inv.getArgument(0);
            d.setId(501);
            return d;
        });
        when(phieuXuatKhoRepository.save(any(PhieuXuatKho.class))).thenAnswer(inv -> {
            PhieuXuatKho p = inv.getArgument(0);
            p.setId(601);
            return p;
        });
        when(posCheckoutRequestRepository.save(any(PosCheckoutRequest.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private PosCheckoutCreating banTaiQuay(String requestId, int bienTheId, int soLuong) {
        return PosCheckoutCreating.builder()
                .requestId(requestId)
                .khoId(1)
                .khachHangId(10)
                .items(List.of(PosCheckoutCreating.PosCheckoutItemCreating.builder()
                        .bienTheSanPhamId(bienTheId)
                        .quantity(BigDecimal.valueOf(soLuong))
                        .unitPriceClient(new BigDecimal("100000"))
                        .build()))
                .payment(PosCheckoutCreating.PosCheckoutPaymentCreating.builder()
                        .method("CASH")
                        .tenderedAmount(BigDecimal.valueOf(100000L * soLuong))
                        .build())
                .note("")
                .build();
    }

    /** Số thanh toán còn cho bán khi bị chặn (409 có cấu trúc). */
    private BigDecimal conLaiKhiBiChan(int bienTheId, int soLuong) {
        CommonException ex = assertThrows(CommonException.class,
                () -> checkout.execute(banTaiQuay("rq-" + bienTheId + "-" + soLuong, bienTheId, soLuong)));
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus(), ex.getMessage());
        PosInsufficientStockInfo info = assertInstanceOf(PosInsufficientStockInfo.class, ex.getData());
        return info.getInsufficient().get(0).getConLai();
    }

    private Map<Integer, BigDecimal> soTrenDanhMuc() {
        Page<PosCatalogNhomDto> trang = catalog.getCatalogNhom(1, null, null, 0, 60);
        Map<Integer, BigDecimal> theoMa = new LinkedHashMap<>();
        trang.getContent().forEach(n -> n.getBienThes().forEach(b -> theoMa.put(b.getBienTheSanPhamId(), b.getSoLuongKhaDung())));
        return theoMa;
    }

    private static void assertSo(String mong, BigDecimal thuc, String moTa) {
        assertNotNull(thuc, moTa);
        assertEquals(0, new BigDecimal(mong).compareTo(thuc), moTa + ": " + thuc);
    }

    // ===== Công thức dùng chung =====

    @Test
    void banDuocTaiQuay_truPhieuNhat_phieuXuatBan_giuChoChuyen_loAmTinh0() {
        Map<Integer, BigDecimal> so = banDuocTaiQuayService.banDuocTaiQuay(1, List.of(93, 94, 95, 999));

        assertSo("3", so.get(93), "1 + 0 (lô âm không bù) + 4 − giữ chỗ chuyển 2");
        assertSo("4", so.get(94), "không bị giữ");
        assertSo("0", so.get(95), "giữ chỗ chuyển bằng tồn");
        assertSo("0", so.get(999), "chưa có lô nào");
    }

    @Test
    void banDuocCuaMaDangGiu_chiTinhLaiMaBiGiu() {
        Map<Integer, BigDecimal> so = banDuocTaiQuayService.banDuocCuaMaDangGiu(1, List.of(93, 94, 95));

        assertEquals(Set.of(93, 95), so.keySet(), "mã 94 không bị giữ thì giữ số SQL");
        verify(tonKhoTheoLoRepository).findByKhoAndBienTheIds(eq(1), argThat(ids -> !ids.contains(94)));
    }

    @Test
    void banDuocCuaMaDangGiu_khoKhongCoGiNiGiu_khongNapLo() {
        when(phanBoLoNhatHangRepository.bienTheDangGiuTaiKho(1)).thenReturn(List.of());
        when(chiTietPhieuXuatKhoRepository.bienTheDangGiuPhieuBanChuaXuat(1)).thenReturn(List.of());
        when(chiTietPhieuChuyenKhoRepository.bienTheGiuChoTaiKho(1)).thenReturn(List.of());

        assertTrue(banDuocTaiQuayService.banDuocCuaMaDangGiu(1, List.of(93, 94, 95)).isEmpty());
        verify(tonKhoTheoLoRepository, never()).findByKhoAndBienTheIds(anyInt(), anyCollection());
    }

    // ===== Danh mục POS =====

    @Test
    void danhMucNhom_truGiuChoChuyenVaPhanPhieuNhatGiu() {
        Map<Integer, BigDecimal> so = soTrenDanhMuc();

        assertSo("3", so.get(93), "SQL thô 8 → bán được 3");
        assertSo("4", so.get(94), "không bị giữ");
        assertSo("0", so.get(95), "SQL thô 2 → giữ chỗ chuyển hết");
    }

    @Test
    void danhMucNhom_conHang_nhomBiGiuHetBiLoai_hetHang_thayNhomDo() {
        Page<PosCatalogNhomDto> conHang = catalog.getCatalogNhom(1, null, "con_hang", 0, 60);
        assertEquals(1, conHang.getTotalElements());
        assertEquals(59, conHang.getContent().get(0).getSanPhamId());
        assertSo("7", conHang.getContent().get(0).getTongTonKhaDung(), "tổng nhóm 59 = 3 + 4");

        Page<PosCatalogNhomDto> hetHang = catalog.getCatalogNhom(1, null, "het_hang", 0, 60);
        assertEquals(1, hetHang.getTotalElements());
        assertEquals(60, hetHang.getContent().get(0).getSanPhamId());
    }

    @Test
    void traTonGio_truGiuChoChuyenVaPhanPhieuNhatGiu() {
        Map<Integer, BigDecimal> so = catalog.getAvailableStock(1, List.of(93, 94, 95));

        assertSo("3", so.get(93), "SKU 93");
        assertSo("4", so.get(94), "SKU 94");
        assertSo("0", so.get(95), "SKU 95");
    }

    @Test
    void traCuuMa_quetMaVaPhimEnter_dungSoBanDuoc() {
        assertSo("3", catalog.lookup(1, null, "SKU93").get(0).getSoLuongKhaDung(), "quét mã SKU 93");
        assertSo("0", catalog.lookup(1, "SKU95", null).get(0).getSoLuongKhaDung(), "Enter SKU 95");
        assertSo("4", catalog.lookup(1, null, "SKU94").get(0).getSoLuongKhaDung(), "quét mã SKU 94");
    }

    // ===== Đối chiếu danh mục ↔ thanh toán =====

    @Test
    void doiChieu_soDanhMuc_bangSoThanhToanChoBan() {
        Map<Integer, BigDecimal> danhMuc = soTrenDanhMuc();
        Map<Integer, BigDecimal> gio = catalog.getAvailableStock(1, List.of(93, 94, 95));

        for (int ma : List.of(93, 94, 95)) {
            BigDecimal soDanhMuc = danhMuc.get(ma);
            int vuot = soDanhMuc.intValue() + 1;
            assertSo(soDanhMuc.toPlainString(), conLaiKhiBiChan(ma, vuot), "thanh toán SKU " + ma + " báo còn");
            assertSo(soDanhMuc.toPlainString(), gio.get(ma), "tra tồn giỏ SKU " + ma);
        }
    }

    @Test
    void doiChieu_banDungSoDanhMuc_thanhCong_soConLaiSauBan0() {
        BigDecimal soDanhMuc = soTrenDanhMuc().get(93);

        PosCheckoutResponse ketQua = checkout.execute(banTaiQuay("rq-du", 93, soDanhMuc.intValue()));

        assertSo("0", ketQua.getItems().get(0).getSoLuongKhaDungSau(), "bán hết số danh mục báo");
        assertSo("0", soTrenDanhMuc().get(93), "danh mục sau khi bán");
        // Quầy không ghi vào lô phiếu nhặt / phiếu xuất bán đang giữ: lô 69 còn đúng 2 chiếc phiếu nhặt giữ
        assertSo("2", lots.get(0).getSoLuongTon(), "lô 69");
        assertSo("2", lots.get(1).getSoLuongTon(), "lô 70 không bị đụng");
    }
}
