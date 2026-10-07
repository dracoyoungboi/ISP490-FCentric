package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.dto.response.customize.PosPriceChangeInfo;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test executor checkout POS (Phase 03): nghiệp vụ + ghi 1 transaction.
 * Chú thích trung thực: test này dùng mock repository nên KHÔNG kiểm chứng ngữ nghĩa
 * khóa MySQL thật (PESSIMISTIC_WRITE) — kiểm thử đồng thời DB thật thuộc Phase 05.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PosCheckoutTransactionTest {

    @Mock private EntityManager entityManager;
    @Mock private PosCatalogService posCatalogService;
    @Mock private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock private DonBanHangRepository donBanHangRepository;
    @Mock private ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @Mock private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock private ChiTietPhieuXuatKhoRepository chiTietPhieuXuatKhoRepository;
    @Mock private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;
    @Mock private PosCheckoutRequestRepository posCheckoutRequestRepository;
    @Mock private PosPaymentRepository posPaymentRepository;

    private PosCheckoutTransaction executor;
    // Mapper như Spring cấu hình (có JavaTimeModule cho Instant)
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
    // Snapshot trạng thái của PosCheckoutRequest TẠI THỜI ĐIỂM mỗi lần save
    // (captor giữ tham chiếu sẽ bị mutate theo entity giữa 2 lần save).
    private final List<PosCheckoutRequest> requestSnapshots = new ArrayList<>();

    @BeforeEach
    void setUp() {
        requestSnapshots.clear();
        executor = new PosCheckoutTransaction();
        ReflectionTestUtils.setField(executor, "entityManager", entityManager);
        ReflectionTestUtils.setField(executor, "posCatalogService", posCatalogService);
        ReflectionTestUtils.setField(executor, "bienTheSanPhamRepository", bienTheSanPhamRepository);
        ReflectionTestUtils.setField(executor, "donBanHangRepository", donBanHangRepository);
        ReflectionTestUtils.setField(executor, "chiTietDonBanHangRepository", chiTietDonBanHangRepository);
        ReflectionTestUtils.setField(executor, "phieuXuatKhoRepository", phieuXuatKhoRepository);
        ReflectionTestUtils.setField(executor, "chiTietPhieuXuatKhoRepository", chiTietPhieuXuatKhoRepository);
        ReflectionTestUtils.setField(executor, "tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        ReflectionTestUtils.setField(executor, "lichSuGiaoDichKhoRepository", lichSuGiaoDichKhoRepository);
        ReflectionTestUtils.setField(executor, "posCheckoutRequestRepository", posCheckoutRequestRepository);
        ReflectionTestUtils.setField(executor, "posPaymentRepository", posPaymentRepository);
        ReflectionTestUtils.setField(executor, "objectMapper", objectMapper);
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder()
                .id(7).vaiTro(Set.of("nhan_vien_ban_hang")).build());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    // ===== fixtures =====

    private BienTheSanPham variant(int id, int trangThai, String giaBan) {
        return BienTheSanPham.builder()
                .id(id)
                .maSku("AK" + id)
                .giaBan(new BigDecimal(giaBan))
                .trangThai(trangThai)
                .sanPham(SanPhamQuanAo.builder().id(59).tenSanPham("Áo test").trangThai(1).build())
                .build();
    }

    private TonKhoTheoLo lotRow(int tonKhoId, int lotId, String ton, String dat, Instant ngayNhap, BienTheSanPham variant, Kho kho) {
        LoHang lo = LoHang.builder().id(lotId).maLo("L" + lotId).giaVon(new BigDecimal("100000"))
                .bienTheSanPham(variant).build();
        return TonKhoTheoLo.builder()
                .id(tonKhoId)
                .kho(kho)
                .loHang(lo)
                .soLuongTon(new BigDecimal(ton))
                .soLuongDaDat(new BigDecimal(dat))
                .ngayNhapGanNhat(ngayNhap)
                .build();
    }

    private PosCheckoutCreating request(String requestId, int unitPrice, String tendered, String qty, int variantId) {
        return PosCheckoutCreating.builder()
                .requestId(requestId)
                .khoId(1)
                .khachHangId(10)
                .items(List.of(PosCheckoutCreating.PosCheckoutItemCreating.builder()
                        .bienTheSanPhamId(variantId)
                        .quantity(new BigDecimal(qty))
                        .unitPriceClient(new BigDecimal(unitPrice))
                        .build()))
                .payment(PosCheckoutCreating.PosCheckoutPaymentCreating.builder()
                        .method("CASH")
                        .tenderedAmount(new BigDecimal(tendered))
                        .build())
                .note("")
                .build();
    }

    private Kho kho1() {
        return Kho.builder().id(1).maKho("KHO01").tenKho("Kho Hà Nội").build();
    }

    private void stubSuccessBasics(Kho kho, BienTheSanPham variant) {
        when(entityManager.find(KhachHang.class, 10))
                .thenReturn(KhachHang.builder().id(10).maKhachHang("KHLE").tenKhachHang("Khách lẻ").trangThai(1).build());
        when(bienTheSanPhamRepository.findAllById(anyList())).thenReturn(List.of(variant));
        when(entityManager.find(Kho.class, 1)).thenReturn(kho);
        when(entityManager.find(NguoiDung.class, 7))
                .thenReturn(NguoiDung.builder().id(7).hoTen("Thu ngân").build());
        when(donBanHangRepository.countBySoDonHangStartingWith(anyString())).thenReturn(0L);
        when(donBanHangRepository.save(any(DonBanHang.class))).thenAnswer(inv -> {
            DonBanHang d = inv.getArgument(0);
            d.setId(501);
            return d;
        });
        when(chiTietDonBanHangRepository.save(any(ChiTietDonBanHang.class))).thenAnswer(inv -> inv.getArgument(0));
        when(phieuXuatKhoRepository.countBySoPhieuXuatStartingWith(anyString())).thenReturn(0L);
        when(phieuXuatKhoRepository.save(any(PhieuXuatKho.class))).thenAnswer(inv -> {
            PhieuXuatKho p = inv.getArgument(0);
            p.setId(601);
            return p;
        });
        when(chiTietPhieuXuatKhoRepository.save(any(ChiTietPhieuXuatKho.class))).thenAnswer(inv -> inv.getArgument(0));
        when(tonKhoTheoLoRepository.save(any(TonKhoTheoLo.class))).thenAnswer(inv -> inv.getArgument(0));
        when(lichSuGiaoDichKhoRepository.save(any(LichSuGiaoDichKho.class))).thenAnswer(inv -> inv.getArgument(0));
        when(posPaymentRepository.save(any(PosPayment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(posCheckoutRequestRepository.save(any(PosCheckoutRequest.class))).thenAnswer(inv -> {
            PosCheckoutRequest r = inv.getArgument(0);
            // snapshot trạng thái tại thời điểm save để assert được PENDING -> SUCCESS
            requestSnapshots.add(PosCheckoutRequest.builder()
                    .id(r.getId())
                    .requestId(r.getRequestId())
                    .requestHash(r.getRequestHash())
                    .khoId(r.getKhoId())
                    .donBanHangId(r.getDonBanHangId())
                    .trangThai(r.getTrangThai())
                    .resultJson(r.getResultJson())
                    .errorMessage(r.getErrorMessage())
                    .nguoiThuNganId(r.getNguoiThuNganId())
                    .build());
            return r;
        });
    }

    // ===== Success =====

    @Test
    void checkout_thanhCong_ghiDuDonPhieuThuTonNhatKyVaKetQua() {
        Kho kho = kho1();
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho, variant);
        when(tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(1, List.of(93)))
                .thenReturn(List.of(lotRow(72, 69, "3", "0", Instant.parse("2026-10-05T12:00:00Z"), variant, kho)));

        PosCheckoutResponse result = executor.execute(request("rq-ok", 120000, "200000", "1", 93));

        assertEquals(501, result.getDonBanHangId());
        assertTrue(result.getSoPhieuXuat().startsWith("PX"));
        assertEquals(0, new BigDecimal("120000").compareTo(result.getTongCong()));
        assertEquals(0, new BigDecimal("200000").compareTo(result.getSoTienThu()));
        assertEquals(0, new BigDecimal("80000").compareTo(result.getSoTienThua()));
        assertEquals(1, result.getItems().size());
        assertEquals(0, new BigDecimal("2").compareTo(result.getItems().get(0).getSoLuongKhaDungSau()));

        ArgumentCaptor<DonBanHang> donCaptor = ArgumentCaptor.forClass(DonBanHang.class);
        verify(donBanHangRepository).save(donCaptor.capture());
        assertEquals("don_ban_hang", donCaptor.getValue().getLoaiChungTu());
        assertEquals(5, donCaptor.getValue().getTrangThai());
        assertEquals("da_thanh_toan", donCaptor.getValue().getTrangThaiThanhToan());
        assertNotNull(donCaptor.getValue().getNgayGiaoHang());

        ArgumentCaptor<PhieuXuatKho> pxCaptor = ArgumentCaptor.forClass(PhieuXuatKho.class);
        verify(phieuXuatKhoRepository).save(pxCaptor.capture());
        assertEquals("ban_hang", pxCaptor.getValue().getLoaiXuat());
        assertEquals(3, pxCaptor.getValue().getTrangThai());

        ArgumentCaptor<PosPayment> payCaptor = ArgumentCaptor.forClass(PosPayment.class);
        verify(posPaymentRepository).save(payCaptor.capture());
        assertEquals("CASH", payCaptor.getValue().getPhuongThuc());
        assertEquals(0, new BigDecimal("120000").compareTo(payCaptor.getValue().getSoTienHang()));
        assertEquals(0, new BigDecimal("80000").compareTo(payCaptor.getValue().getSoTienThua()));
        assertEquals(501, payCaptor.getValue().getDonBanHangId());

        ArgumentCaptor<LichSuGiaoDichKho> journalCaptor = ArgumentCaptor.forClass(LichSuGiaoDichKho.class);
        verify(lichSuGiaoDichKhoRepository).save(journalCaptor.capture());
        assertEquals("xuat_kho", journalCaptor.getValue().getLoaiGiaoDich());
        assertEquals("phieu_xuat_kho", journalCaptor.getValue().getLoaiThamChieu());
        assertEquals(0, new BigDecimal("3").compareTo(journalCaptor.getValue().getSoLuongTruoc()));
        assertEquals(0, new BigDecimal("2").compareTo(journalCaptor.getValue().getSoLuongSau()));

        assertEquals(2, requestSnapshots.size());
        assertEquals(PosCheckoutRequest.TRANG_THAI_PENDING, requestSnapshots.get(0).getTrangThai());
        assertEquals(PosCheckoutRequest.TRANG_THAI_SUCCESS, requestSnapshots.get(1).getTrangThai());
        assertEquals(501, requestSnapshots.get(1).getDonBanHangId());
        assertNotNull(requestSnapshots.get(1).getResultJson());
    }

    @Test
    void checkout_phanBoFIFO_theoNgayNhapRoiMaLo() {
        Kho kho = kho1();
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho, variant);
        TonKhoTheoLo lotSom = lotRow(72, 69, "2", "0", Instant.parse("2026-10-05T12:00:00Z"), variant, kho);
        TonKhoTheoLo lotMuon = lotRow(73, 70, "1", "0", Instant.parse("2026-10-05T13:00:00Z"), variant, kho);
        when(tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(1, List.of(93)))
                .thenReturn(List.of(lotSom, lotMuon));

        executor.execute(request("rq-fifo", 120000, "360000", "3", 93));

        ArgumentCaptor<ChiTietPhieuXuatKho> pickCaptor = ArgumentCaptor.forClass(ChiTietPhieuXuatKho.class);
        verify(chiTietPhieuXuatKhoRepository, times(2)).save(pickCaptor.capture());
        // Lô nhập sớm hơn (id 69) được lấy trước: 2, rồi lô sau (id 70): 1
        assertEquals(69, pickCaptor.getAllValues().get(0).getLoHang().getId());
        assertEquals(0, new BigDecimal("2").compareTo(pickCaptor.getAllValues().get(0).getSoLuongXuat()));
        assertEquals(70, pickCaptor.getAllValues().get(1).getLoHang().getId());
        assertEquals(0, new BigDecimal("1").compareTo(pickCaptor.getAllValues().get(1).getSoLuongXuat()));
        assertEquals(0, new BigDecimal("100000").compareTo(pickCaptor.getAllValues().get(0).getGiaVon()));
    }

    @Test
    void checkout_truLuongDatHangKhongDuocBan() {
        Kho kho = kho1();
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho, variant);
        // ton 3, dat 2 -> khả dụng 1
        when(tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(1, List.of(93)))
                .thenReturn(List.of(lotRow(72, 69, "3", "2", Instant.parse("2026-10-05T12:00:00Z"), variant, kho)));

        executor.execute(request("rq-res", 120000, "120000", "1", 93));

        ArgumentCaptor<TonKhoTheoLo> tonCaptor = ArgumentCaptor.forClass(TonKhoTheoLo.class);
        verify(tonKhoTheoLoRepository).save(tonCaptor.capture());
        assertEquals(0, new BigDecimal("2").compareTo(tonCaptor.getValue().getSoLuongTon()));
    }

    // ===== Lỗi nghiệp vụ =====

    @Test
    void checkout_khongDuTonKho_tuChoiTruocKhiGhiDon() {
        Kho kho = kho1();
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho, variant);
        when(tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(1, List.of(93)))
                .thenReturn(List.of(lotRow(72, 69, "1", "0", Instant.parse("2026-10-05T12:00:00Z"), variant, kho),
                        lotRow(73, 70, "1", "0", Instant.parse("2026-10-05T13:00:00Z"), variant, kho)));

        CommonException ex = assertThrows(CommonException.class,
                () -> executor.execute(request("rq-het", 120000, "360000", "3", 93)));
        assertTrue(ex.getMessage().contains("không đủ"));
        verify(donBanHangRepository, never()).save(any(DonBanHang.class));
    }

    @Test
    void checkout_thieuTienMat_tuChoi() {
        Kho kho = kho1();
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho, variant);
        when(tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(1, List.of(93)))
                .thenReturn(List.of(lotRow(72, 69, "3", "0", Instant.parse("2026-10-05T12:00:00Z"), variant, kho)));

        CommonException ex = assertThrows(CommonException.class,
                () -> executor.execute(request("rq-thieu", 120000, "100000", "1", 93)));
        assertTrue(ex.getMessage().contains("không đủ"));
        verify(donBanHangRepository, never()).save(any(DonBanHang.class));
    }

    @Test
    void checkout_giaThayDoi_409CoCauTruc() {
        Kho kho = kho1();
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho, variant);

        CommonException ex = assertThrows(CommonException.class,
                () -> executor.execute(request("rq-gia", 100000, "120000", "1", 93)));
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertInstanceOf(PosPriceChangeInfo.class, ex.getData());
        PosPriceChangeInfo info = (PosPriceChangeInfo) ex.getData();
        assertTrue(info.getPriceChanged());
        assertEquals(93, info.getItems().get(0).getBienTheSanPhamId());
        assertEquals(0, new BigDecimal("120000").compareTo(info.getItems().get(0).getGiaMoi()));
        // chưa ghi gì kể cả neo request (giá được kiểm trước)
        verify(posCheckoutRequestRepository, never()).save(any(PosCheckoutRequest.class));
    }

    @Test
    void checkout_bienTheNgungBan_tuChoi() {
        BienTheSanPham variant = variant(93, 0, "120000");
        stubSuccessBasics(kho1(), variant);

        CommonException ex = assertThrows(CommonException.class,
                () -> executor.execute(request("rq-ngung", 120000, "120000", "1", 93)));
        assertTrue(ex.getMessage().contains("hoạt động"));
    }

    @Test
    void checkout_sanPhamChaNgungBan_tuChoi() {
        BienTheSanPham variant = variant(93, 1, "120000");
        variant.getSanPham().setTrangThai(2);
        stubSuccessBasics(kho1(), variant);

        CommonException ex = assertThrows(CommonException.class,
                () -> executor.execute(request("rq-cha", 120000, "120000", "1", 93)));
        assertTrue(ex.getMessage().contains("bán"));
    }

    @Test
    void checkout_khachHangKhongHoatDong_tuChoi() {
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho1(), variant);
        when(entityManager.find(KhachHang.class, 10))
                .thenReturn(KhachHang.builder().id(10).maKhachHang("KHX").tenKhachHang("Khách X").trangThai(0).build());

        CommonException ex = assertThrows(CommonException.class,
                () -> executor.execute(request("rq-kh", 120000, "120000", "1", 93)));
        assertTrue(ex.getMessage().contains("Khách hàng"));
    }

    @Test
    void checkout_khachHangKhongTonTai_tuChoi() {
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho1(), variant);
        when(entityManager.find(KhachHang.class, 10)).thenReturn(null);

        assertThrows(CommonException.class,
                () -> executor.execute(request("rq-khx", 120000, "120000", "1", 93)));
    }

    @Test
    void checkout_khoKhongDuocPhanQuyen_biChan() {
        when(posCatalogService.authorizeWarehouse(1))
                .thenThrow(new CommonException("Bạn không phụ trách kho"));

        assertThrows(CommonException.class,
                () -> executor.execute(request("rq-kho", 120000, "120000", "1", 93)));
        verify(posCheckoutRequestRepository, never()).save(any(PosCheckoutRequest.class));
    }

    @Test
    void checkout_trungBienTheTrongDon_biChan() {
        PosCheckoutCreating req = request("rq-trung", 120000, "120000", "1", 93);
        req.setItems(new ArrayList<>(req.getItems()));
        req.getItems().add(PosCheckoutCreating.PosCheckoutItemCreating.builder()
                .bienTheSanPhamId(93).quantity(new BigDecimal("1"))
                .unitPriceClient(new BigDecimal("120000")).build());

        CommonException ex = assertThrows(CommonException.class, () -> executor.execute(req));
        assertTrue(ex.getMessage().contains("lặp"));
    }

    @Test
    void checkout_soLuongKhongNguyen_biChan() {
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho1(), variant);

        CommonException ex = assertThrows(CommonException.class,
                () -> executor.execute(request("rq-le", 120000, "120000", "1.5", 93)));
        assertTrue(ex.getMessage().contains("nguyên"));
    }

    @Test
    void checkout_phuongThucKhacCash_biChan() {
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho1(), variant);
        PosCheckoutCreating req = request("rq-method", 120000, "120000", "1", 93);
        req.getPayment().setMethod("TRANSFER");

        CommonException ex = assertThrows(CommonException.class, () -> executor.execute(req));
        assertTrue(ex.getMessage().contains("CASH"));
    }

    @Test
    void checkout_tienMatLeDong_biChan() {
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho1(), variant);
        PosCheckoutCreating req = request("rq-ledong", 120000, "120000.5", "1", 93);

        CommonException ex = assertThrows(CommonException.class, () -> executor.execute(req));
        assertTrue(ex.getMessage().contains("nguyên đồng"));
    }

    @Test
    void checkout_tienMatVuotGioiHan_biChan() {
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho1(), variant);
        PosCheckoutCreating req = request("rq-limit", 120000, "600000000", "1", 93);

        CommonException ex = assertThrows(CommonException.class, () -> executor.execute(req));
        assertTrue(ex.getMessage().contains("giới hạn"));
    }

    // ===== Rollback / sinh số =====

    @Test
    void checkout_loiGhiGiuaChung_ngungNgay_khongGhiPhieuThu() {
        Kho kho = kho1();
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho, variant);
        when(tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(1, List.of(93)))
                .thenReturn(List.of(lotRow(72, 69, "3", "0", Instant.parse("2026-10-05T12:00:00Z"), variant, kho)));
        doThrow(new RuntimeException("Lỗi ghi nhật ký kho"))
                .when(lichSuGiaoDichKhoRepository).save(any(LichSuGiaoDichKho.class));

        assertThrows(RuntimeException.class,
                () -> executor.execute(request("rq-rollback", 120000, "120000", "1", 93)));

        // Ghi dừng trước phiếu thu và trước khi chốt SUCCESS.
        verify(posPaymentRepository, never()).save(any(PosPayment.class));
        assertEquals(1, requestSnapshots.size());
        assertEquals(PosCheckoutRequest.TRANG_THAI_PENDING, requestSnapshots.get(0).getTrangThai());
    }

    @Test
    void checkout_trungSoDonHang_thuLaiRoiThanhCong() {
        Kho kho = kho1();
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho, variant);
        when(tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(1, List.of(93)))
                .thenReturn(List.of(lotRow(72, 69, "3", "0", Instant.parse("2026-10-05T12:00:00Z"), variant, kho)));
        when(donBanHangRepository.save(any(DonBanHang.class)))
                .thenThrow(new DataIntegrityViolationException("uk_don_ban_hang_so_don_hang"))
                .thenAnswer(inv -> {
                    DonBanHang d = inv.getArgument(0);
                    d.setId(501);
                    return d;
                });

        PosCheckoutResponse result = executor.execute(request("rq-sodon", 120000, "120000", "1", 93));

        assertEquals(501, result.getDonBanHangId());
        verify(donBanHangRepository, times(2)).save(any(DonBanHang.class));
    }

    @Test
    void checkout_trungSoPhieuXuat_thuLaiRoiThanhCong() {
        Kho kho = kho1();
        BienTheSanPham variant = variant(93, 1, "120000");
        stubSuccessBasics(kho, variant);
        when(tonKhoTheoLoRepository.lockLotsForUpdateByKhoAndVariants(1, List.of(93)))
                .thenReturn(List.of(lotRow(72, 69, "3", "0", Instant.parse("2026-10-05T12:00:00Z"), variant, kho)));
        when(phieuXuatKhoRepository.save(any(PhieuXuatKho.class)))
                .thenThrow(new DataIntegrityViolationException("uk_phieu_xuat_kho_so_phieu"))
                .thenAnswer(inv -> {
                    PhieuXuatKho p = inv.getArgument(0);
                    p.setId(601);
                    return p;
                });

        PosCheckoutResponse result = executor.execute(request("rq-sopx", 120000, "120000", "1", 93));

        assertNotNull(result.getSoPhieuXuat());
        verify(phieuXuatKhoRepository, times(2)).save(any(PhieuXuatKho.class));
    }
}
