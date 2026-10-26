package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhaiBaoLoRequest;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PhieuNhapKhoQcGuardTest {

    @Mock
    private PhieuNhapKhoRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private DonMuaHangRepository donMuaHangRepository;
    @Mock
    private ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    @Mock
    private LoHangRepository loHangRepository;
    @Mock
    private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock
    private NguoiDungRepository nguoiDungRepository;
    @Mock
    private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;
    @Mock
    private ChiTietDonMuaHangRepository chiTietDonMuaHangRepository;
    @Mock
    private PhieuXuatKhoRepository phieuXuatKhoRepository;
    @Mock
    private SanPhamQuanAoService sanPhamQuanAoService;
    @Mock
    private DonBanHangRepository donBanHangRepository;
    @Mock
    private ViTriKhoRepository viTriKhoRepository;
    @Mock
    private TonKhoViTriRepository tonKhoViTriRepository;
    @Mock
    private BienBanTraHangNccRepository bienBanTraHangNccRepository;
    @Mock
    private LichSuThayDoiService lichSuThayDoiService;
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Mock
    private ChiTietLoiLoHangRepository chiTietLoiLoHangRepository;
    @Mock
    private ChiTietTraHangNccRepository chiTietTraHangNccRepository;
    @Mock
    private MaVachNhaCungCapRepository maVachNhaCungCapRepository;
    @Mock
    private CauHinhHeThongRepository cauHinhHeThongRepository;
    @Mock
    private com.dev.backend.services.BienBanTraHangService bienBanTraHangService;

    private PhieuNhapKhoService service;

    private Kho kho;
    private PhieuNhapKho phieu;
    private DonMuaHang po;
    private BienTheSanPham bienThe;
    private SanPhamQuanAo sanPham;
    private ChiTietPhieuNhapKho draftItem;
    private ChiTietDonMuaHang poItem;
    private NguoiDung nguoiNhap;
    private ViTriKho viTri;

    @BeforeEach
    void setUp() {
        service = new PhieuNhapKhoService(repository);

        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "donMuaHangRepository", donMuaHangRepository);
        ReflectionTestUtils.setField(service, "chiTietPhieuNhapKhoRepository", chiTietPhieuNhapKhoRepository);
        ReflectionTestUtils.setField(service, "loHangRepository", loHangRepository);
        ReflectionTestUtils.setField(service, "tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        ReflectionTestUtils.setField(service, "nguoiDungRepository", nguoiDungRepository);
        ReflectionTestUtils.setField(service, "lichSuGiaoDichKhoRepository", lichSuGiaoDichKhoRepository);
        ReflectionTestUtils.setField(service, "chiTietDonMuaHangRepository", chiTietDonMuaHangRepository);
        ReflectionTestUtils.setField(service, "phieuXuatKhoRepository", phieuXuatKhoRepository);
        ReflectionTestUtils.setField(service, "sanPhamQuanAoService", sanPhamQuanAoService);
        ReflectionTestUtils.setField(service, "donBanHangRepository", donBanHangRepository);
        ReflectionTestUtils.setField(service, "viTriKhoRepository", viTriKhoRepository);
        ReflectionTestUtils.setField(service, "tonKhoViTriRepository", tonKhoViTriRepository);
        ReflectionTestUtils.setField(service, "bienBanTraHangNccRepository", bienBanTraHangNccRepository);
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
        ReflectionTestUtils.setField(service, "eventPublisher", eventPublisher);
        ReflectionTestUtils.setField(service, "chiTietLoiLoHangRepository", chiTietLoiLoHangRepository);
        ReflectionTestUtils.setField(service, "chiTietTraHangNccRepository", chiTietTraHangNccRepository);
        ReflectionTestUtils.setField(service, "maVachNhaCungCapRepository", maVachNhaCungCapRepository);
        ReflectionTestUtils.setField(service, "cauHinhHeThongRepository", cauHinhHeThongRepository);
        ReflectionTestUtils.setField(service, "bienBanTraHangService", bienBanTraHangService);

        kho = Kho.builder().id(1).maKho("KHO_HCM").tenKho("Kho HCM").build();
        sanPham = SanPhamQuanAo.builder().id(10).tenSanPham("Áo Thun FCentric").build();
        bienThe = BienTheSanPham.builder().id(100).maSku("FCT-TSHIRT-01").sanPham(sanPham).build();
        nguoiNhap = NguoiDung.builder().id(1).hoTen("Nguyễn Văn Kho").build();

        viTri = ViTriKho.builder().id(20).kho(kho).maViTri("A-01-01").sucChuaToiDa(100).trangThai("HOAT_DONG").khuVucKho(
                KhuVucKho.builder().id(5).kho(kho).build()
        ).build();

        poItem = ChiTietDonMuaHang.builder()
                .id(1001)
                .bienTheSanPham(bienThe)
                .soLuongDat(new BigDecimal("100.000"))
                .soLuongDaNhan(BigDecimal.ZERO)
                .donGia(new BigDecimal("150000.00"))
                .build();

        po = DonMuaHang.builder()
                .id(50)
                .soDonMua("PO-2026-001")
                .khoNhap(kho)
                .trangThai(3)
                .chiTietDonMuaHangs(new ArrayList<>(List.of(poItem)))
                .build();

        phieu = PhieuNhapKho.builder()
                .id(1)
                .soPhieuNhap("PN2026101701")
                .kho(kho)
                .donMuaHang(po)
                .trangThai(0) // DRAFT
                .build();

        draftItem = ChiTietPhieuNhapKho.builder()
                .id(500)
                .phieuNhapKho(phieu)
                .bienTheSanPham(bienThe)
                .soLuongNhap(new BigDecimal("100.000"))
                .donGia(new BigDecimal("150000.00"))
                .soLuongYeuCau(100)
                .loHang(null)
                .build();

        phieu.setChiTietPhieuNhapKhos(List.of(draftItem));
    }

    @Test
    @DisplayName("QC Guard: Chặn nhập kho 409 khi có hàng lỗi nhưng chưa phát hành biên bản RTV")
    void testCompletePhieuNhap_CoLoiChuaRtv_ChanConflict() {
        LoHang loCoLoi = LoHang.builder()
                .id(60)
                .maLo("LOT-DEFECT")
                .bienTheSanPham(bienThe)
                .soLuongNhap(90) // Đạt 90
                .soLuongLoi(10)  // Lỗi 10
                .trangThai("TAM_KHOA")
                .build();

        ChiTietPhieuNhapKho ctLo = ChiTietPhieuNhapKho.builder()
                .id(501)
                .phieuNhapKho(phieu)
                .bienTheSanPham(bienThe)
                .loHang(loCoLoi)
                .soLuongNhap(new BigDecimal("90.000"))
                .donGia(new BigDecimal("150000.00"))
                .build();

        lenient().when(repository.findById(1)).thenReturn(Optional.of(phieu));
        lenient().when(repository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ctLo));
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.empty()); // Chưa có RTV!

        CommonException ex = assertThrows(CommonException.class, () -> service.completePhieuNhap(1, 1));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("chưa phát hành Biên bản trả hàng (RTV)"));
    }

    @Test
    @DisplayName("QC Guard: Mở khóa nhập kho thành công sau khi đã phát hành biên bản RTV")
    void testCompletePhieuNhap_CoLoiDaCoRtv_ThanhCong() {
        LoHang loCoLoi = LoHang.builder()
                .id(60)
                .maLo("LOT-DEFECT")
                .bienTheSanPham(bienThe)
                .soLuongNhap(90) // Đạt 90
                .soLuongLoi(10)  // Lỗi 10
                .viTriKho(viTri)
                .trangThai("TAM_KHOA")
                .build();

        ChiTietPhieuNhapKho ctLo = ChiTietPhieuNhapKho.builder()
                .id(501)
                .phieuNhapKho(phieu)
                .bienTheSanPham(bienThe)
                .loHang(loCoLoi)
                .soLuongNhap(new BigDecimal("90.000"))
                .donGia(new BigDecimal("150000.00"))
                .build();

        lenient().when(repository.findById(1)).thenReturn(Optional.of(phieu));
        lenient().when(repository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ctLo));
        // ĐÃ CÓ RTV khớp số lỗi, phương án Trừ công nợ: đơn mua coi như đã xử lý cả phần lỗi
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(
                BienBanTraHangNcc.builder().id(9).maBienBan("RTV-1").tongSoLuongLoi(10).phuongAnXuLy("TRU_CONG_NO").build()));
        when(bienBanTraHangService.khopHangLoiHienTai(any())).thenReturn(true);
        when(nguoiDungRepository.findById(1)).thenReturn(Optional.of(nguoiNhap));

        when(tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(1, 60)).thenReturn(Optional.empty());
        when(tonKhoViTriRepository.findByViTriKho_IdAndLoHang_Id(20, 60)).thenReturn(Optional.empty());

        service.completePhieuNhap(1, 1);

        // 1. Lô phải chuyển trạng thái sang HOAT_DONG
        assertEquals("HOAT_DONG", loCoLoi.getTrangThai());
        verify(loHangRepository).save(loCoLoi);

        // 2. Ghi nhận số lượng ĐẠT vào ton_kho_vi_tri
        verify(tonKhoViTriRepository).save(argThat(tkvt -> tkvt.getSoLuong() == 90));

        // 3. Bảo toàn 4 trạng thái tồn kho: Incoming -= Q_PO (100), On Hand += Q_ĐẠT (90)
        assertEquals(0, poItem.getSoLuongDaNhan().compareTo(new BigDecimal("100.000"))); // Incoming giải phóng trọn vẹn 100
        verify(tonKhoTheoLoRepository).save(argThat(t -> t.getSoLuongTon().compareTo(new BigDecimal("90.000")) == 0));

        // 4. Phiếu chuyển trạng thái COMPLETED (3)
        assertEquals(3, phieu.getTrangThai());
    }

    @Test
    @DisplayName("Nhập kho phiếu từ đơn mua: lô lệch số giữa dòng phiếu và lô thì chặn 409, không ghi tồn")
    void testCompletePhieuNhap_LoLechSo_ChanConflict() {
        draftItem.setSoLuongNhap(new BigDecimal("1.000"));
        LoHang loCu = LoHang.builder().id(93).maLo("LO-20261017-01").bienTheSanPham(bienThe)
                .soLuongNhap(0).soLuongLoi(0).trangThai("TAM_KHOA").build();
        ChiTietPhieuNhapKho ctLo = ChiTietPhieuNhapKho.builder().id(211).phieuNhapKho(phieu).bienTheSanPham(bienThe)
                .loHang(loCu).soLuongNhap(new BigDecimal("1.000")).donGia(new BigDecimal("150000.00")).build();

        when(repository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ctLo));

        CommonException ex = assertThrows(CommonException.class, () -> service.completePhieuNhap(1, 1));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("Lô LO-20261017-01 của FCT-TSHIRT-01 lệch số (dòng phiếu 1, lô 0). Xóa lô này rồi khóa lại trước khi nhập kho.",
                ex.getMessage());
        verify(tonKhoTheoLoRepository, never()).save(any());
        verify(loHangRepository, never()).save(any());
        assertEquals(0, phieu.getTrangThai());
    }

    @Test
    @DisplayName("Nhập kho phiếu từ đơn mua: lô đã Hoạt động khi phiếu còn nháp thì chặn 409")
    void testCompletePhieuNhap_LoDaHoatDongTrongPhieuNhap_ChanConflict() {
        LoHang loCu = LoHang.builder().id(93).maLo("LO-20261017-01").bienTheSanPham(bienThe)
                .soLuongNhap(100).soLuongLoi(0).trangThai("HOAT_DONG").build();
        ChiTietPhieuNhapKho ctLo = ChiTietPhieuNhapKho.builder().id(211).phieuNhapKho(phieu).bienTheSanPham(bienThe)
                .loHang(loCu).soLuongNhap(new BigDecimal("100.000")).donGia(new BigDecimal("150000.00")).build();

        when(repository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ctLo));

        CommonException ex = assertThrows(CommonException.class, () -> service.completePhieuNhap(1, 1));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("Lô LO-20261017-01 của FCT-TSHIRT-01 đang ở trạng thái Hoạt động dù phiếu chưa nhập kho. "
                + "Hủy phiếu này rồi tạo phiếu mới để kiểm đếm lại.", ex.getMessage());
        verify(tonKhoTheoLoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Nhập kho: một lô đúng đứng trước hai lô sai thì báo cả hai lô sai trong một câu, không ghi gì")
    void testCompletePhieuNhap_NhieuLoSai_BaoMotLanKhongGhi() {
        LoHang loDung = LoHang.builder().id(61).maLo("LO-A").bienTheSanPham(bienThe)
                .soLuongNhap(60).soLuongLoi(0).trangThai("TAM_KHOA").build();
        LoHang loLech = LoHang.builder().id(62).maLo("LO-B").bienTheSanPham(bienThe)
                .soLuongNhap(0).soLuongLoi(0).trangThai("TAM_KHOA").build();
        LoHang loLa = LoHang.builder().id(63).maLo("LO-C").bienTheSanPham(bienThe)
                .soLuongNhap(10).soLuongLoi(0).trangThai(null).build();
        ChiTietPhieuNhapKho ctDung = ChiTietPhieuNhapKho.builder().id(501).phieuNhapKho(phieu).bienTheSanPham(bienThe)
                .loHang(loDung).soLuongNhap(new BigDecimal("60.000")).donGia(new BigDecimal("150000.00")).build();
        ChiTietPhieuNhapKho ctLech = ChiTietPhieuNhapKho.builder().id(502).phieuNhapKho(phieu).bienTheSanPham(bienThe)
                .loHang(loLech).soLuongNhap(new BigDecimal("30.000")).donGia(new BigDecimal("150000.00")).build();
        ChiTietPhieuNhapKho ctLa = ChiTietPhieuNhapKho.builder().id(503).phieuNhapKho(phieu).bienTheSanPham(bienThe)
                .loHang(loLa).soLuongNhap(new BigDecimal("10.000")).donGia(new BigDecimal("150000.00")).build();

        when(repository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        // Máy chủ trả lô không theo thứ tự: câu báo vẫn theo thứ tự dòng
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ctLa, ctDung, ctLech));

        CommonException ex = assertThrows(CommonException.class, () -> service.completePhieuNhap(1, 1));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        // Có lô không ở Tạm khóa (không xóa lô được): câu báo bảo hủy phiếu
        assertEquals("Lô LO-B của FCT-TSHIRT-01 lệch số (dòng phiếu 30, lô 0); "
                + "Lô LO-C của FCT-TSHIRT-01 đang ở trạng thái không xác định dù phiếu chưa nhập kho. "
                + "Hủy phiếu này rồi tạo phiếu mới để kiểm đếm lại.", ex.getMessage());
        verify(loHangRepository, never()).save(any());
        verify(tonKhoTheoLoRepository, never()).save(any());
        verify(lichSuGiaoDichKhoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Nhập kho phiếu đơn mua: lô chưa có số trên lô (dữ liệu trước khi thêm cột) dùng số trên dòng, không bị chặn")
    void testCompletePhieuNhap_LoChuaCoSo_DungSoTrenDong() {
        LoHang loCu = LoHang.builder().id(64).maLo("LO-CU").bienTheSanPham(bienThe)
                .soLuongNhap(null).soLuongLoi(0).trangThai("TAM_KHOA").build();
        ChiTietPhieuNhapKho ctLo = ChiTietPhieuNhapKho.builder().id(504).phieuNhapKho(phieu).bienTheSanPham(bienThe)
                .loHang(loCu).soLuongNhap(new BigDecimal("100.000")).donGia(new BigDecimal("150000.00")).build();

        when(repository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ctLo));
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.empty());
        when(nguoiDungRepository.findById(1)).thenReturn(Optional.of(nguoiNhap));
        when(tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(1, 64)).thenReturn(Optional.empty());

        service.completePhieuNhap(1, 1);

        verify(tonKhoTheoLoRepository).save(argThat(t -> t.getSoLuongTon().compareTo(new BigDecimal("100.000")) == 0));
        assertEquals(0, poItem.getSoLuongDaNhan().compareTo(new BigDecimal("100.000")));
        assertEquals(3, phieu.getTrangThai());
    }

    @Test
    @DisplayName("Phiếu nhập hoàn trả: dòng phiếu khác số nhập ban đầu của lô thật là đúng, không bị chặn")
    void testCompletePhieuNhap_HoanTra_KhongKiemLechSo() {
        LoHang loThat = LoHang.builder().id(70).maLo("LO-BAN-01").bienTheSanPham(bienThe)
                .soLuongNhap(50).soLuongLoi(0).trangThai("HOAT_DONG").build();
        ChiTietPhieuNhapKho ctTra = ChiTietPhieuNhapKho.builder().id(600).bienTheSanPham(bienThe)
                .loHang(loThat).soLuongNhap(new BigDecimal("2.000")).donGia(new BigDecimal("150000.00")).build();
        PhieuNhapKho phieuTra = PhieuNhapKho.builder().id(2).soPhieuNhap("PN-RET-202610261").kho(kho).trangThai(0)
                .chiTietPhieuNhapKhos(List.of(ctTra)).build();
        ctTra.setPhieuNhapKho(phieuTra);

        when(repository.khoaTheoId(2)).thenReturn(Optional.of(phieuTra));
        when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(2)).thenReturn(List.of(ctTra));
        when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(2)).thenReturn(Optional.empty());
        when(nguoiDungRepository.findById(1)).thenReturn(Optional.of(nguoiNhap));
        when(tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(1, 70)).thenReturn(Optional.empty());

        service.completePhieuNhap(2, 1);

        verify(tonKhoTheoLoRepository).save(argThat(t -> t.getSoLuongTon().compareTo(new BigDecimal("2.000")) == 0));
        assertEquals(3, phieuTra.getTrangThai());
    }

    @Test
    @DisplayName("Khai báo lô kiểm đếm: Tự động khóa lô TAM_KHOA và cập nhật tiến độ dòng draft")
    void testKhaiBaoLo_TamKhoaVaCapNhatDraft() {
        lenient().when(repository.findById(1)).thenReturn(Optional.of(phieu));
        lenient().when(repository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        lenient().when(chiTietPhieuNhapKhoRepository.findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(1, 100))
                .thenReturn(Optional.of(draftItem));
        lenient().when(chiTietPhieuNhapKhoRepository.khoaDongDuKien(1, 100)).thenReturn(List.of(draftItem));
        when(chiTietPhieuNhapKhoRepository.findDeclaredLots(1, 100)).thenReturn(Collections.emptyList());
        when(chiTietPhieuNhapKhoRepository.findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(1, 100, "LOT-01"))
                .thenReturn(Optional.empty());
        lenient().when(viTriKhoRepository.findById(20)).thenReturn(Optional.of(viTri));
        lenient().when(viTriKhoRepository.khoaTheoId(20)).thenReturn(Optional.of(viTri));
        when(tonKhoViTriRepository.sumDangChuaByViTriId(20)).thenReturn(10);

        when(loHangRepository.save(any(LoHang.class))).thenAnswer(inv -> {
            LoHang l = inv.getArgument(0);
            l.setId(77);
            return l;
        });

        KhaiBaoLoRequest req = KhaiBaoLoRequest.builder()
                .bienTheSanPhamId(100)
                .maLo("LOT-01")
                .ngaySanXuat(Instant.now())
                .soLuongNhap(new BigDecimal("45.000"))
                .soLuongLoi(new BigDecimal("5.000"))
                .viTriKhoId(20)
                .ghiChu("Kiểm thùng 1")
                .chiTietLoi(List.of(KhaiBaoLoRequest.ChiTietLoiRequest.builder().lyDo("Bung chỉ").soLuong(5).build()))
                .build();

        service.khaiBaoLo(1, req);

        // Lô được lưu ở trạng thái TAM_KHOA với số lượng Đạt 45, Lỗi 5
        verify(loHangRepository).save(argThat(l ->
                "TAM_KHOA".equals(l.getTrangThai()) && l.getSoLuongNhap() == 45 && l.getSoLuongLoi() == 5
        ));

        // Dòng draft được cập nhật số lượng Đạt/Lỗi tổng
        assertEquals(45, draftItem.getSoLuongDatQc());
        assertEquals(5, draftItem.getSoLuongLoiQc());
        assertEquals("DANG_KIEM_DEM", draftItem.getTrangThaiKiemDem());
    }

    @Test
    @DisplayName("Hoàn tất kiểm đếm biến thể chốt trạng thái DA_HOAN_TAT khi đủ số lượng")
    void testHoanTatKiemDemBienThe_DuSoLuong_ChotDaHoanTat() {
        LoHang lo = LoHang.builder().id(88).soLuongNhap(95).soLuongLoi(5).build();
        ChiTietPhieuNhapKho ctLo = ChiTietPhieuNhapKho.builder().loHang(lo).soLuongNhap(new BigDecimal("95")).build();

        lenient().when(repository.findById(1)).thenReturn(Optional.of(phieu));
        lenient().when(repository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        lenient().when(chiTietPhieuNhapKhoRepository.findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(1, 100))
                .thenReturn(Optional.of(draftItem));
        lenient().when(chiTietPhieuNhapKhoRepository.khoaDongDuKien(1, 100)).thenReturn(List.of(draftItem));
        when(chiTietPhieuNhapKhoRepository.findDeclaredLots(1, 100)).thenReturn(List.of(ctLo));

        service.hoanTatKiemDemBienThe(1, 100);

        assertEquals("DA_HOAN_TAT", draftItem.getTrangThaiKiemDem());
        assertEquals(95, draftItem.getSoLuongDatQc());
        assertEquals(5, draftItem.getSoLuongLoiQc());
        verify(chiTietPhieuNhapKhoRepository).save(draftItem);
    }
}
