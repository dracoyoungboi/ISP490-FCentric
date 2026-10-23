package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.KhaiBaoLoRequest;
import com.dev.backend.dto.response.customize.LoHangKhaiBaoDto;
import com.dev.backend.dto.response.entities.ChiTietPhieuNhapKhoDto;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.dto.response.entities.PhieuNhapKhoItemDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Luồng kiểm đếm & khóa lô của phiếu nhập từ đơn mua (PhieuNhapKhoService):
 * chi tiết lỗi theo lý do, ngày sản xuất, mã lô trùng, sức chứa kệ tính cả lô chờ nhập,
 * chặn phiếu kho khác, biên bản trả hàng lệch, phương án đổi hàng và lô chỉ có hàng lỗi.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class KiemDemNhapKhoServiceTest {

    @Mock private PhieuNhapKhoRepository repository;
    @Mock private EntityManager entityManager;
    @Mock private DonMuaHangRepository donMuaHangRepository;
    @Mock private ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    @Mock private LoHangRepository loHangRepository;
    @Mock private TonKhoTheoLoRepository tonKhoTheoLoRepository;
    @Mock private NguoiDungRepository nguoiDungRepository;
    @Mock private LichSuGiaoDichKhoRepository lichSuGiaoDichKhoRepository;
    @Mock private ChiTietDonMuaHangRepository chiTietDonMuaHangRepository;
    @Mock private SanPhamQuanAoService sanPhamQuanAoService;
    @Mock private ViTriKhoRepository viTriKhoRepository;
    @Mock private TonKhoViTriRepository tonKhoViTriRepository;
    @Mock private BienBanTraHangNccRepository bienBanTraHangNccRepository;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private ChiTietLoiLoHangRepository chiTietLoiLoHangRepository;
    @Mock private ChiTietTraHangNccRepository chiTietTraHangNccRepository;
    @Mock private MaVachNhaCungCapRepository maVachNhaCungCapRepository;
    @Mock private CauHinhHeThongRepository cauHinhHeThongRepository;
    @Mock private com.dev.backend.services.BienBanTraHangService bienBanTraHangService;

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private PhieuNhapKhoService service;
    private Kho kho;
    private NhaCungCap ncc;
    private PhieuNhapKho phieu;
    private DonMuaHang po;
    private ChiTietDonMuaHang poItem;
    private BienTheSanPham bienThe;
    private ChiTietPhieuNhapKho dongDraft;
    private ViTriKho ke;
    private int idLoMoi = 700;

    @BeforeEach
    void setUp() {
        service = new PhieuNhapKhoService(repository);
        Map<String, Object> phuThuoc = new LinkedHashMap<>();
        phuThuoc.put("entityManager", entityManager);
        phuThuoc.put("donMuaHangRepository", donMuaHangRepository);
        phuThuoc.put("chiTietPhieuNhapKhoRepository", chiTietPhieuNhapKhoRepository);
        phuThuoc.put("loHangRepository", loHangRepository);
        phuThuoc.put("tonKhoTheoLoRepository", tonKhoTheoLoRepository);
        phuThuoc.put("nguoiDungRepository", nguoiDungRepository);
        phuThuoc.put("lichSuGiaoDichKhoRepository", lichSuGiaoDichKhoRepository);
        phuThuoc.put("chiTietDonMuaHangRepository", chiTietDonMuaHangRepository);
        phuThuoc.put("sanPhamQuanAoService", sanPhamQuanAoService);
        phuThuoc.put("viTriKhoRepository", viTriKhoRepository);
        phuThuoc.put("tonKhoViTriRepository", tonKhoViTriRepository);
        phuThuoc.put("bienBanTraHangNccRepository", bienBanTraHangNccRepository);
        phuThuoc.put("lichSuThayDoiService", lichSuThayDoiService);
        phuThuoc.put("eventPublisher", eventPublisher);
        phuThuoc.put("chiTietLoiLoHangRepository", chiTietLoiLoHangRepository);
        phuThuoc.put("chiTietTraHangNccRepository", chiTietTraHangNccRepository);
        phuThuoc.put("maVachNhaCungCapRepository", maVachNhaCungCapRepository);
        phuThuoc.put("cauHinhHeThongRepository", cauHinhHeThongRepository);
        phuThuoc.put("bienBanTraHangService", bienBanTraHangService);
        phuThuoc.forEach((ten, gt) -> ReflectionTestUtils.setField(service, ten, gt));

        kho = Kho.builder().id(1).tenKho("Kho Hà Nội").build();
        ncc = NhaCungCap.builder().id(5).tenNhaCungCap("May Phương Nam").build();
        SanPhamQuanAo sp = SanPhamQuanAo.builder().id(10).tenSanPham("Quần Jeans Baggy").build();
        bienThe = BienTheSanPham.builder().id(100).maSku("QJ2610141-XN-30").maVachSku("2000000000107").sanPham(sp)
                .mauSac(MauSac.builder().tenMau("Xanh nhạt").build())
                .size(com.dev.backend.entities.Size.builder().tenSize("30").build())
                .build();
        poItem = ChiTietDonMuaHang.builder().id(1001).bienTheSanPham(bienThe).soLuongDat(new BigDecimal("40"))
                .soLuongDaNhan(BigDecimal.ZERO).donGia(new BigDecimal("150000")).build();
        po = DonMuaHang.builder().id(50).soDonMua("PO-01").khoNhap(kho).trangThai(3)
                .chiTietDonMuaHangs(new ArrayList<>(List.of(poItem))).build();
        phieu = PhieuNhapKho.builder().id(1).soPhieuNhap("PN202610191").kho(kho).nhaCungCap(ncc).donMuaHang(po).trangThai(0).build();
        dongDraft = ChiTietPhieuNhapKho.builder().id(500).phieuNhapKho(phieu).bienTheSanPham(bienThe)
                .soLuongNhap(new BigDecimal("40")).donGia(new BigDecimal("150000")).build();
        phieu.setChiTietPhieuNhapKhos(new ArrayList<>(List.of(dongDraft)));
        ke = ViTriKho.builder().id(20).kho(kho).maViTri("A-01-02").sucChuaToiDa(60).trangThai("HOAT_DONG")
                .khuVucKho(KhuVucKho.builder().id(5).kho(kho).build()).build();

        when(repository.findById(1)).thenReturn(Optional.of(phieu));
        when(repository.khoaTheoId(1)).thenReturn(Optional.of(phieu));
        when(chiTietPhieuNhapKhoRepository.findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(1, 100))
                .thenReturn(Optional.of(dongDraft));
        when(chiTietPhieuNhapKhoRepository.khoaDongDuKien(1, 100)).thenReturn(List.of(dongDraft));
        when(chiTietPhieuNhapKhoRepository.findDeclaredLots(1, 100)).thenReturn(new ArrayList<>());
        when(chiTietPhieuNhapKhoRepository.findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(anyInt(), anyInt(), anyString()))
                .thenReturn(Optional.empty());
        when(viTriKhoRepository.findById(20)).thenReturn(Optional.of(ke));
        when(viTriKhoRepository.khoaTheoId(20)).thenReturn(Optional.of(ke));
        when(tonKhoViTriRepository.sumDangChuaByViTriId(20)).thenReturn(0);
        when(chiTietPhieuNhapKhoRepository.sumChoNhapTheoViTri(eq(20), any())).thenReturn(0L);
        when(loHangRepository.save(any(LoHang.class))).thenAnswer(inv -> {
            LoHang l = inv.getArgument(0);
            if (l.getId() == null) l.setId(idLoMoi++);
            return l;
        });
        // Sửa lô đã có ghi ngay xuống CSDL (saveAndFlush) để trùng khóa duy nhất báo lỗi trong try/catch
        when(loHangRepository.saveAndFlush(any(LoHang.class))).thenAnswer(inv -> inv.getArgument(0));
        when(nguoiDungRepository.findById(9)).thenReturn(Optional.of(NguoiDung.builder().id(9).hoTen("Lê Thu Hà").build()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    // ── Tiện ích ──

    private static Instant ngay(LocalDate d) {
        return d.atStartOfDay().toInstant(ZoneOffset.UTC); // FE gửi yyyy-MM-ddT00:00:00.000Z
    }

    private KhaiBaoLoRequest.KhaiBaoLoRequestBuilder lo(String maLo, int dat, int loi) {
        return KhaiBaoLoRequest.builder().bienTheSanPhamId(100).maLo(maLo).taoMoi(true)
                .ngaySanXuat(ngay(LocalDate.now(VN).minusDays(20)))
                .soLuongNhap(BigDecimal.valueOf(dat)).soLuongLoi(BigDecimal.valueOf(loi))
                .viTriKhoId(dat > 0 ? 20 : null);
    }

    private static KhaiBaoLoRequest.ChiTietLoiRequest ly(String lyDo, int sl) {
        return KhaiBaoLoRequest.ChiTietLoiRequest.builder().lyDo(lyDo).soLuong(sl).build();
    }

    private static void dangNhap(String vaiTro, Integer khoDangChon, Integer... khoDuocGiao) {
        List<PhanQuyenNguoiDungKhoDto> pq = Arrays.stream(khoDuocGiao)
                .map(id -> PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(id).build()).build())
                .toList();
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(9).vaiTro(Set.of(vaiTro)).phanQuyenNguoiDungKhos(pq).build());
        SecurityContextHolder.setKhoId(khoDangChon);
    }

    private LoHang loDaKhoa(int id, String maLo, int dat, int loi) {
        return LoHang.builder().id(id).maLo(maLo).bienTheSanPham(bienThe).soLuongNhap(dat).soLuongLoi(loi)
                .viTriKho(dat > 0 ? ke : null).trangThai("TAM_KHOA").build();
    }

    private ChiTietPhieuNhapKho ctLo(LoHang lo) {
        return ChiTietPhieuNhapKho.builder().id(lo.getId() + 1000).phieuNhapKho(phieu).bienTheSanPham(bienThe).loHang(lo)
                .soLuongNhap(BigDecimal.valueOf(lo.getSoLuongNhap())).donGia(new BigDecimal("150000")).build();
    }

    private static CommonException loi(org.junit.jupiter.api.function.Executable viec) {
        return assertThrows(CommonException.class, viec);
    }

    // ── Khóa lô ──

    @Nested
    @DisplayName("Khóa lô (khaiBaoLo)")
    class KhoaLo {

        @Test
        @DisplayName("Lưu hàng không đạt theo lý do, gộp lý do trùng, gắn đúng lô vừa tạo")
        void luuChiTietLoiTheoLyDo() {
            service.khaiBaoLo(1, lo(" LO-PN202610191-01 ", 9, 3)
                    .chiTietLoi(List.of(ly("Bung chỉ", 1), ly("Ố bẩn", 1), ly("Bung chỉ", 1))).build());

            ArgumentCaptor<List<ChiTietLoiLoHang>> cap = ArgumentCaptor.forClass(List.class);
            verify(chiTietLoiLoHangRepository).saveAll(cap.capture());
            List<ChiTietLoiLoHang> ds = cap.getValue();
            assertEquals(2, ds.size());
            assertEquals("Bung chỉ", ds.get(0).getLyDo());
            assertEquals(2, ds.get(0).getSoLuong());
            assertEquals("Ố bẩn", ds.get(1).getLyDo());
            assertEquals(700, ds.get(0).getLoHang().getId());
            verify(loHangRepository).save(argThat(l -> "LO-PN202610191-01".equals(l.getMaLo()) && "TAM_KHOA".equals(l.getTrangThai())
                    && l.getSoLuongNhap() == 9 && l.getSoLuongLoi() == 3 && l.getViTriKho() == ke));
            assertEquals("DANG_KIEM_DEM", dongDraft.getTrangThaiKiemDem());
            assertEquals(9, dongDraft.getSoLuongDatQc());
            assertEquals(3, dongDraft.getSoLuongLoiQc());
        }

        @Test
        @DisplayName("Lô đủ số đặt thì dòng biến thể chuyển DA_HOAN_TAT (không cần nút Hoàn tất)")
        void duSoThiDaHoanTat() {
            service.khaiBaoLo(1, lo("LO-1", 40, 0).build());
            assertEquals("DA_HOAN_TAT", dongDraft.getTrangThaiKiemDem());
            verify(chiTietLoiLoHangRepository, never()).saveAll(any());
        }

        @Test
        @DisplayName("Tổng theo lý do khác số không đạt: 400, không lưu lô")
        void tongLyDoLech() {
            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 9, 3).chiTietLoi(List.of(ly("Bung chỉ", 2))).build()));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertTrue(ex.getMessage().contains("(2)") && ex.getMessage().contains("(3)"), ex.getMessage());
            verify(loHangRepository, never()).save(any());
        }

        @Test
        @DisplayName("Có hàng không đạt mà không có lý do: 400")
        void loiKhongLyDo() {
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, lo("LO-1", 9, 3).build())).getStatus());
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, lo("LO-1", 9, 3)
                    .chiTietLoi(List.of(ly("  ", 3))).build())).getStatus());
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, lo("LO-1", 9, 3)
                    .chiTietLoi(List.of(ly("Bung chỉ", 3), ly("Khác", 0))).build())).getStatus());
            verify(loHangRepository, never()).save(any());
        }

        @Test
        @DisplayName("Cách gửi cũ lyDoLoi: một dòng cho cả số lỗi")
        void lyDoLoiCu() {
            service.khaiBaoLo(1, lo("LO-1", 9, 3).lyDoLoi("Rách vải").build());
            verify(chiTietLoiLoHangRepository).saveAll(argThat((List<ChiTietLoiLoHang> ds) ->
                    ds.size() == 1 && "Rách vải".equals(ds.get(0).getLyDo()) && ds.get(0).getSoLuong() == 3));
        }

        @Test
        @DisplayName("Cách gửi cũ lyDoLoi dài quá 50 ký tự: 400, không cắt ngầm")
        void lyDoLoiCuQuaDai() {
            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 9, 3).lyDoLoi("x".repeat(51)).build()));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertTrue(ex.getMessage().contains("50"), ex.getMessage());
            verify(loHangRepository, never()).save(any());
        }

        @Test
        @DisplayName("Gộp lý do không phân biệt hoa thường, khoảng trắng thừa; giữ cách viết đầu tiên")
        void gopLyDoKhongPhanBietHoaThuong() {
            service.khaiBaoLo(1, lo("LO-1", 9, 3)
                    .chiTietLoi(List.of(ly("Bung chỉ", 1), ly("bung  CHỈ ", 1), ly("Ố bẩn", 1))).build());
            ArgumentCaptor<List<ChiTietLoiLoHang>> cap = ArgumentCaptor.forClass(List.class);
            verify(chiTietLoiLoHangRepository).saveAll(cap.capture());
            List<ChiTietLoiLoHang> ds = cap.getValue();
            assertEquals(2, ds.size());
            assertEquals("Bung chỉ", ds.get(0).getLyDo());
            assertEquals(2, ds.get(0).getSoLuong());
        }

        @Test
        @DisplayName("Mã lô mang tiền tố thẻ lệnh FC- (quét nhầm tem lô thành thẻ lệnh): 400")
        void maLoTienToTheLenh() {
            for (String ma : List.of("FC-KHOA-LO", "fc-dat", "Fc-PN202610191-01", "LO-PN202610191-04FC-KHOA-LO")) {
                CommonException ex = loi(() -> service.khaiBaoLo(1, lo(ma, 5, 0).build()));
                assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus(), ma);
                assertTrue(ex.getMessage().contains("FC-"), ex.getMessage());
            }
            verify(loHangRepository, never()).save(any());
        }

        @Test
        @DisplayName("Kho có kệ đang hoạt động: lô có hàng đạt phải chọn kệ; kho chưa dựng kệ thì không bắt")
        void batBuocKeKhiKhoCoKe() {
            when(viTriKhoRepository.existsByKho_IdAndTrangThai(1, "HOAT_DONG")).thenReturn(true);
            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0).viTriKhoId(null).build()));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertTrue(ex.getMessage().contains("Chọn kệ"), ex.getMessage());
            verify(loHangRepository, never()).save(any());

            when(viTriKhoRepository.existsByKho_IdAndTrangThai(1, "HOAT_DONG")).thenReturn(false);
            service.khaiBaoLo(1, lo("LO-1", 5, 0).viTriKhoId(null).build());
            verify(loHangRepository).save(argThat(l -> l.getViTriKho() == null && l.getSoLuongNhap() == 5));
        }

        @Test
        @DisplayName("Lô chỉ có hàng lỗi không cần kệ")
        void loChiCoLoi() {
            service.khaiBaoLo(1, lo("LO-1", 0, 2).chiTietLoi(List.of(ly("Sai màu / kích cỡ", 2))).build());
            verify(loHangRepository).save(argThat(l -> l.getViTriKho() == null && l.getSoLuongNhap() == 0 && l.getSoLuongLoi() == 2));
        }

        @Test
        @DisplayName("Ngày sản xuất sau hôm nay (giờ Việt Nam): 400; hôm nay thì được")
        void ngaySanXuat() {
            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0).ngaySanXuat(ngay(LocalDate.now(VN).plusDays(1))).build()));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertEquals("Ngày sản xuất không được sau hôm nay", ex.getMessage());

            service.khaiBaoLo(1, lo("LO-1", 5, 0).ngaySanXuat(ngay(LocalDate.now(VN))).build());
            verify(loHangRepository).save(any());
        }

        @Test
        @DisplayName("Mã lô trống hoặc số lượng lẻ: 400")
        void dauVaoSai() {
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, lo("  ", 5, 0).build())).getStatus());
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0)
                    .soLuongNhap(new BigDecimal("1.5")).build())).getStatus());
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, lo("LO-1", 0, 0).build())).getStatus());
        }

        @Test
        @DisplayName("Màn kiểm đếm (taoMoi) gặp mã lô đã khóa trong phiếu: 409, không ghi đè lô cũ")
        void taoMoiTrungMaLoTrongPhieu() {
            LoHang cu = loDaKhoa(60, "LO-1", 12, 0);
            when(chiTietPhieuNhapKhoRepository.findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(1, 100, "LO-1"))
                    .thenReturn(Optional.of(ctLo(cu)));

            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0).build()));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
            assertEquals(12, cu.getSoLuongNhap());
            verify(loHangRepository, never()).save(any());
        }

        @Test
        @DisplayName("Màn khai báo lô (không taoMoi) cùng mã lô: cập nhật lô cũ, thay chi tiết lỗi, kệ không tính lô đang sửa")
        void capNhatLoCu() {
            LoHang cu = loDaKhoa(60, "LO-1", 12, 0);
            ChiTietPhieuNhapKho ct = ctLo(cu);
            when(chiTietPhieuNhapKhoRepository.findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(1, 100, "LO-1"))
                    .thenReturn(Optional.of(ct));
            when(chiTietPhieuNhapKhoRepository.findDeclaredLots(1, 100)).thenReturn(List.of(ct));

            service.khaiBaoLo(1, lo("LO-1", 10, 2).taoMoi(null).chiTietLoi(List.of(ly("Bung chỉ", 2))).build());

            assertEquals(10, cu.getSoLuongNhap());
            assertEquals(2, cu.getSoLuongLoi());
            verify(chiTietPhieuNhapKhoRepository).sumChoNhapTheoViTri(20, 60);
            InOrder thuTu = inOrder(chiTietLoiLoHangRepository);
            thuTu.verify(chiTietLoiLoHangRepository).deleteByLoHangId(60);
            thuTu.verify(chiTietLoiLoHangRepository).saveAll(any());
            assertEquals(10, dongDraft.getSoLuongDatQc(), "không cộng trùng lô đang sửa");
        }

        @Test
        @DisplayName("Màn khai báo lô cũ sửa lô (chỉ gửi mã lô, ngày, số đạt, ghi chú): giữ số không đạt, chi tiết lỗi và kệ đã khóa")
        void manCuSuaLoGiuLoiVaKe() {
            when(viTriKhoRepository.existsByKho_IdAndTrangThai(1, "HOAT_DONG")).thenReturn(true);
            LoHang cu = loDaKhoa(60, "LO-1", 12, 3);
            ChiTietPhieuNhapKho ct = ctLo(cu);
            when(chiTietPhieuNhapKhoRepository.findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(1, 100, "LO-1"))
                    .thenReturn(Optional.of(ct));
            when(chiTietPhieuNhapKhoRepository.findDeclaredLots(1, 100)).thenReturn(List.of(ct));

            // Đúng payload của KhaiBaoLo.jsx: không taoMoi, không soLuongLoi / chiTietLoi / lyDoLoi / viTriKhoId
            service.khaiBaoLo(1, KhaiBaoLoRequest.builder().bienTheSanPhamId(100).maLo("LO-1")
                    .ngaySanXuat(ngay(LocalDate.now(VN).minusDays(20))).soLuongNhap(BigDecimal.TEN).ghiChu("Sửa số đạt").build());

            assertEquals(10, cu.getSoLuongNhap());
            assertEquals(3, cu.getSoLuongLoi(), "không xóa hàng không đạt đã khóa ở màn kiểm đếm");
            assertSame(ke, cu.getViTriKho(), "không bỏ kệ đã chọn");
            verify(chiTietLoiLoHangRepository, never()).deleteByLoHangId(anyInt());
            verify(chiTietLoiLoHangRepository, never()).saveAll(any());
            // Kệ cũ vẫn được kiểm sức chứa với số đạt mới (không tính lô đang sửa)
            verify(chiTietPhieuNhapKhoRepository).sumChoNhapTheoViTri(20, 60);
            assertEquals(10, dongDraft.getSoLuongDatQc());
            assertEquals(3, dongDraft.getSoLuongLoiQc());
        }

        @Test
        @DisplayName("Màn khai báo lô cũ sửa lô còn 0 đạt mà kệ cũ nay bảo trì: không lấy lại kệ cũ, lưu được; còn hàng đạt thì vẫn chặn")
        void manCuSuaLoKhongDatKeCuBaoTri() {
            when(viTriKhoRepository.existsByKho_IdAndTrangThai(1, "HOAT_DONG")).thenReturn(true);
            ke.setTrangThai("BAO_TRI");
            LoHang cu = loDaKhoa(60, "LO-1", 12, 3);
            ChiTietPhieuNhapKho ct = ctLo(cu);
            when(chiTietPhieuNhapKhoRepository.findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(1, 100, "LO-1"))
                    .thenReturn(Optional.of(ct));
            when(chiTietPhieuNhapKhoRepository.findDeclaredLots(1, 100)).thenReturn(List.of(ct));
            KhaiBaoLoRequest.KhaiBaoLoRequestBuilder manCu = KhaiBaoLoRequest.builder().bienTheSanPhamId(100).maLo("LO-1")
                    .ngaySanXuat(ngay(LocalDate.now(VN).minusDays(20)));

            service.khaiBaoLo(1, manCu.soLuongNhap(BigDecimal.ZERO).build());

            assertEquals(0, cu.getSoLuongNhap());
            assertEquals(3, cu.getSoLuongLoi(), "giữ số không đạt đã khóa");
            assertNull(cu.getViTriKho(), "lô không còn hàng đạt: không gắn kệ (như trước khi giữ kệ cũ)");
            verify(viTriKhoRepository, never()).khoaTheoId(anyInt());
            verify(loHangRepository).saveAndFlush(cu);

            // Còn hàng đạt cần lên kệ mà kệ cũ bảo trì: vẫn từ chối, chọn kệ khác
            cu.setViTriKho(ke);
            CommonException ex = loi(() -> service.khaiBaoLo(1, manCu.soLuongNhap(BigDecimal.valueOf(5)).build()));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertTrue(ex.getMessage().contains("tạm khóa hoặc ngừng hoạt động"), ex.getMessage());
            // Không viết "bị khóa": giao diện coi là tài khoản bị khóa và đăng xuất
            assertFalse(ex.getMessage().contains("bị khóa"), ex.getMessage());
        }

        @Test
        @DisplayName("Sửa lô đã có (đổi ngày sản xuất) vướng khóa duy nhất của lô khi chạy đồng thời: ghi ngay trong try nên 409, không lỗi lúc commit")
        void suaLoCoSanTrungKhoaLo() {
            LoHang cu = loDaKhoa(60, "LO-1", 12, 0);
            ChiTietPhieuNhapKho ct = ctLo(cu);
            when(chiTietPhieuNhapKhoRepository.findByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHang_MaLo(1, 100, "LO-1"))
                    .thenReturn(Optional.of(ct));
            when(chiTietPhieuNhapKhoRepository.findDeclaredLots(1, 100)).thenReturn(List.of(ct));
            doThrow(new org.springframework.dao.DataIntegrityViolationException("could not execute statement",
                    new java.sql.SQLIntegrityConstraintViolationException(
                            "Duplicate entry '100-LO-1-2026-09-30 00:00:00' for key 'lo_hang.unique_bien_the_lo'")))
                    .when(loHangRepository).saveAndFlush(any(LoHang.class));

            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 10, 0).taoMoi(null)
                    .ngaySanXuat(ngay(LocalDate.now(VN).minusDays(3))).build()));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
            assertTrue(ex.getMessage().contains("Mã lô LO-1") && ex.getMessage().contains("Đổi mã lô khác"), ex.getMessage());
            verify(loHangRepository, never()).save(any());
            verify(chiTietPhieuNhapKhoRepository, never()).save(any());
        }

        @Test
        @DisplayName("Phiếu khác khóa cùng (biến thể, mã lô, ngày sản xuất) cùng lúc: trùng khóa lô thì 409 câu rõ; lỗi ràng buộc khác ném nguyên")
        void trungKhoaLoCungLuc() {
            doThrow(new org.springframework.dao.DataIntegrityViolationException("could not execute statement",
                    new java.sql.SQLIntegrityConstraintViolationException(
                            "Duplicate entry '100-LO-1-2026-09-30 00:00:00' for key 'lo_hang.unique_bien_the_lo'")))
                    .when(loHangRepository).save(any(LoHang.class));

            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0).build()));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
            assertTrue(ex.getMessage().contains("Mã lô LO-1") && ex.getMessage().contains("Đổi mã lô khác"), ex.getMessage());
            verify(chiTietPhieuNhapKhoRepository, never()).save(any());

            doThrow(new org.springframework.dao.DataIntegrityViolationException("could not execute statement",
                    new java.sql.SQLIntegrityConstraintViolationException(
                            "Cannot add or update a child row: a foreign key constraint fails (`lo_hang_ibfk_2`)")))
                    .when(loHangRepository).save(any(LoHang.class));
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                    () -> service.khaiBaoLo(1, lo("LO-1", 5, 0).build()));
        }

        @Test
        @DisplayName("Trùng (biến thể, mã lô, ngày sản xuất) với lô của phiếu khác: 409 thay vì lỗi CSDL; khác ngày thì được")
        void trungMaLoPhieuKhac() {
            Instant nsx = ngay(LocalDate.now(VN).minusDays(20));
            LoHang loPhieuKhac = LoHang.builder().id(61).maLo("LO-1").bienTheSanPham(bienThe).ngaySanXuat(nsx).build();
            when(loHangRepository.findByBienTheSanPham_IdAndMaLo(100, "LO-1")).thenReturn(List.of(loPhieuKhac));

            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0).ngaySanXuat(nsx).build()));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());

            service.khaiBaoLo(1, lo("LO-1", 5, 0).ngaySanXuat(ngay(LocalDate.now(VN).minusDays(3))).build());
            verify(loHangRepository).save(any());
        }

        @Test
        @DisplayName("Số rất lớn (2^32 + 5) không bị tràn thành số nhỏ: 400, không lưu lô")
        void soRatLonKhongTran() {
            KhaiBaoLoRequest req = lo("LO-1", 0, 0).soLuongNhap(new BigDecimal("4294967301")).build();
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, req)).getStatus());
            KhaiBaoLoRequest req2 = lo("LO-1", 0, 0).soLuongNhap(new BigDecimal("2147483648")).build();
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, req2)).getStatus());
            verify(loHangRepository, never()).save(any());
        }

        @Test
        @DisplayName("Lý do không đạt có số lớn hơn số lỗi của lô (cộng tràn về đúng tổng): 400")
        void lyDoTranSo() {
            KhaiBaoLoRequest req = lo("LO-1", 5, 2).chiTietLoi(List.of(ly("Bung chỉ", Integer.MAX_VALUE), ly("Rách vải", Integer.MAX_VALUE), ly("Ố bẩn", 4))).build();
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, req)).getStatus());
            verify(loHangRepository, never()).save(any());
        }

        @Test
        @DisplayName("Ngày sản xuất: bắt buộc; năm nhập nhầm (trước 2000) bị chặn; quy về đầu ngày lịch Việt Nam")
        void ngaySanXuatBatBuocVaQuyVeNgay() {
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0).ngaySanXuat(null).build())).getStatus());
            assertEquals(HttpStatus.BAD_REQUEST,
                    loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0).ngaySanXuat(ngay(LocalDate.of(102, 10, 15))).build())).getStatus());

            LocalDate homQua = LocalDate.now(VN).minusDays(1);
            // 23:59:59.999 giờ VN của hôm qua: cột TIMESTAMP(0) sẽ làm tròn sang hôm nay nếu không quy về đầu ngày
            Instant cuoiNgay = homQua.atTime(23, 59, 59, 999_000_000).atZone(VN).toInstant();
            service.khaiBaoLo(1, lo("LO-1", 5, 0).ngaySanXuat(cuoiNgay).build());
            verify(loHangRepository).save(argThat(l -> ngay(homQua).equals(l.getNgaySanXuat())));
        }

        @Test
        @DisplayName("Khóa dòng dự kiến và dòng kệ trước khi kiểm (khóa lô đồng thời chạy tuần tự)")
        void khoaDongTruocKhiKiem() {
            service.khaiBaoLo(1, lo("LO-1", 5, 0).build());
            // Cùng thứ tự với nhập kho / hủy phiếu / lập biên bản (phiếu → dòng dự kiến → kệ): hai lệnh chạy cùng lúc
            // xếp hàng chờ nhau thay vì khóa chéo (deadlock)
            InOrder thuTu = inOrder(repository, chiTietPhieuNhapKhoRepository, viTriKhoRepository);
            thuTu.verify(repository).khoaTheoId(1);
            thuTu.verify(chiTietPhieuNhapKhoRepository).khoaDongDuKien(1, 100);
            thuTu.verify(viTriKhoRepository).khoaTheoId(20);
            verify(viTriKhoRepository, never()).findById(20);
            verify(repository, never()).findById(1);
        }

        @Test
        @DisplayName("Phiếu đã hủy: câu báo nói rõ phiếu đã hủy")
        void phieuDaHuy() {
            phieu.setTrangThai(4);
            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0).build()));
            assertTrue(ex.getMessage().contains("đã bị hủy"), ex.getMessage());
        }

        @Test
        @DisplayName("Sức chứa kệ tính cả hàng đạt của lô đã khóa chưa nhập kho")
        void sucChuaTinhCaChoNhap() {
            when(tonKhoViTriRepository.sumDangChuaByViTriId(20)).thenReturn(30);
            when(chiTietPhieuNhapKhoRepository.sumChoNhapTheoViTri(20, null)).thenReturn(20L);

            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-1", 11, 0).build()));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertTrue(ex.getMessage().contains("chỉ còn trống 10"), ex.getMessage());
            assertTrue(ex.getMessage().contains("Chờ nhập từ lô đã khóa: 20"), ex.getMessage());

            service.khaiBaoLo(1, lo("LO-1", 10, 0).build());
            verify(loHangRepository).save(argThat(l -> l.getSoLuongNhap() == 10));
        }

        @Test
        @DisplayName("Vượt số cần nhập của đơn mua: 400")
        void vuotSoDat() {
            LoHang cu = loDaKhoa(60, "LO-1", 35, 0);
            when(chiTietPhieuNhapKhoRepository.findDeclaredLots(1, 100)).thenReturn(List.of(ctLo(cu)));
            CommonException ex = loi(() -> service.khaiBaoLo(1, lo("LO-2", 6, 0).build()));
            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertTrue(ex.getMessage().contains("41"));
        }

        @Test
        @DisplayName("Nhân viên kho đang chọn kho khác: 403; quản trị viên được")
        void khoKhac() {
            dangNhap("nhan_vien_kho", 2, 1, 2);
            assertEquals(HttpStatus.FORBIDDEN, loi(() -> service.khaiBaoLo(1, lo("LO-1", 5, 0).build())).getStatus());
            verify(loHangRepository, never()).save(any());

            dangNhap("nhan_vien_kho", 1, 1);
            service.khaiBaoLo(1, lo("LO-1", 5, 0).build());

            dangNhap("quan_tri_vien", 2);
            service.khaiBaoLo(1, lo("LO-2", 5, 0).build());
            verify(loHangRepository, times(2)).save(any());
        }

        @Test
        @DisplayName("Phiếu không còn Nháp: không khóa lô được")
        void phieuDaNhap() {
            phieu.setTrangThai(3);
            assertThrows(CommonException.class, () -> service.khaiBaoLo(1, lo("LO-1", 5, 0).build()));
        }
    }

    // ── Đọc / xóa lô ──

    @Test
    @DisplayName("Danh sách lô trả chi tiết lỗi của từng lô (một truy vấn cho mọi lô)")
    void dsLoCoChiTietLoi() {
        LoHang a = loDaKhoa(60, "LO-1", 9, 3);
        LoHang b = loDaKhoa(61, "LO-2", 12, 0);
        when(chiTietPhieuNhapKhoRepository.findDeclaredLots(1, 100)).thenReturn(List.of(ctLo(a), ctLo(b)));
        when(chiTietLoiLoHangRepository.findByLoHangIds(List.of(60, 61))).thenReturn(List.of(
                ChiTietLoiLoHang.builder().loHang(a).lyDo("Bung chỉ").soLuong(2).build(),
                ChiTietLoiLoHang.builder().loHang(a).lyDo("Ố bẩn").soLuong(1).build()));

        List<LoHangKhaiBaoDto> ds = service.getDanhSachLoDaKhaiBao(1, 100);

        assertEquals(2, ds.get(0).getChiTietLoi().size());
        assertEquals("Ố bẩn", ds.get(0).getChiTietLoi().get(1).getLyDo());
        assertEquals(0, ds.get(1).getChiTietLoi().size());
        assertEquals(3, ds.get(0).getSoLuongLoi().intValue());
    }

    @Test
    @DisplayName("Xem phiếu: người thuộc kho của phiếu xem được dù đang chọn kho khác; không thuộc thì 403")
    void xemPhieuKhoKhac() {
        dangNhap("quan_ly_kho", 2, 1, 2);
        assertNotNull(service.getDanhSachLoDaKhaiBao(1, 100));
        assertNotNull(service.getDetail(1));

        dangNhap("nhan_vien_kho", 2, 2);
        assertEquals(HttpStatus.FORBIDDEN, loi(() -> service.getDetail(1)).getStatus());
        assertEquals(HttpStatus.FORBIDDEN, loi(() -> service.getDanhSachLoDaKhaiBao(1, 100)).getStatus());
    }

    @Test
    @DisplayName("Xóa lô: xóa chi tiết lỗi, gỡ lô khỏi dòng biên bản, rồi mới xóa lô")
    void xoaLo() {
        LoHang a = loDaKhoa(60, "LO-1", 9, 3);
        ChiTietPhieuNhapKho ct = ctLo(a);
        when(chiTietPhieuNhapKhoRepository.findByIdAndPhieuNhapKho_Id(1060, 1)).thenReturn(Optional.of(ct));

        service.xoaLo(1, 1060);

        verify(repository).khoaTheoId(1);
        verify(repository, never()).findById(1);
        InOrder thuTu = inOrder(chiTietLoiLoHangRepository, chiTietTraHangNccRepository, loHangRepository);
        thuTu.verify(chiTietLoiLoHangRepository).deleteByLoHangId(60);
        thuTu.verify(chiTietTraHangNccRepository).boLienKetLo(60);
        thuTu.verify(loHangRepository).delete(a);
        verify(chiTietPhieuNhapKhoRepository).delete(ct);
    }

    @Test
    @DisplayName("Xóa lô của phiếu chuyển kho (lô thật của kho gửi): 400 câu rõ, không đụng lô, chi tiết lỗi, biên bản")
    void xoaLoPhieuChuyenKho() {
        phieu.setDonMuaHang(null);
        phieu.setSoPhieuNhap("PN-TRF-202610201");
        LoHang loThat = LoHang.builder().id(70).maLo("LO-THAT-01").bienTheSanPham(bienThe).soLuongNhap(12).soLuongLoi(0)
                .trangThai("HOAT_DONG").build();
        when(chiTietPhieuNhapKhoRepository.findByIdAndPhieuNhapKho_Id(1070, 1)).thenReturn(Optional.of(ctLo(loThat)));

        CommonException ex = loi(() -> service.xoaLo(1, 1070));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("không xóa lô được"), ex.getMessage());
        verify(loHangRepository, never()).delete(any(LoHang.class));
        verify(chiTietPhieuNhapKhoRepository, never()).delete(any(ChiTietPhieuNhapKho.class));
        verify(chiTietLoiLoHangRepository, never()).deleteByLoHangId(anyInt());
        verify(chiTietTraHangNccRepository, never()).boLienKetLo(anyInt());
    }

    @Test
    @DisplayName("Tạo phiếu nhập: trừ cả số các phiếu Nháp khác của cùng đơn đang giữ (không nhập trùng một đơn)")
    void taoPhieuTruPhieuNhapKhac() {
        dangNhap("quan_ly_kho", 1, 1);
        when(donMuaHangRepository.findById(50)).thenReturn(Optional.of(po));
        when(chiTietPhieuNhapKhoRepository.sumDuKienPhieuNhapCungDon(50, 100)).thenReturn(new BigDecimal("35"));
        when(repository.save(any(PhieuNhapKho.class))).thenAnswer(inv -> inv.getArgument(0));
        com.dev.backend.dto.request.PhieuNhapKhoCreating yc = com.dev.backend.dto.request.PhieuNhapKhoCreating.builder()
                .donMuaHangId(50)
                .chiTietPhieuNhapKhos(List.of(com.dev.backend.dto.request.ChiTietPhieuNhapKhoCreating.builder()
                        .bienTheSanPhamId(100).soLuongDuKienNhap(new BigDecimal("10")).build()))
                .build();
        CommonException ex = loi(() -> service.createDraft(yc));
        assertTrue(ex.getMessage().contains("còn lại (5)") && ex.getMessage().contains("đã giữ 35"), ex.getMessage());
        verify(chiTietDonMuaHangRepository).khoaTheoDonMua(50);

        yc.getChiTietPhieuNhapKhos().get(0).setSoLuongDuKienNhap(new BigDecimal("5"));
        service.createDraft(yc);
        verify(chiTietPhieuNhapKhoRepository).save(argThat(ct -> ct.getSoLuongNhap().compareTo(new BigDecimal("5")) == 0));
    }

    @Test
    @DisplayName("Tạo phiếu: lỗi dữ liệu / sai kho là 4xx có câu tiếng Việt (không phải 500)")
    void taoPhieuLoiNghiepVu() {
        dangNhap("nhan_vien_kho", 2, 2);
        com.dev.backend.dto.request.PhieuNhapKhoCreating yc = com.dev.backend.dto.request.PhieuNhapKhoCreating.builder()
                .donMuaHangId(50)
                .chiTietPhieuNhapKhos(List.of(com.dev.backend.dto.request.ChiTietPhieuNhapKhoCreating.builder()
                        .bienTheSanPhamId(100).soLuongDuKienNhap(new BigDecimal("5")).build()))
                .build();
        when(donMuaHangRepository.findById(50)).thenReturn(Optional.of(po));
        CommonException ex = loi(() -> service.createDraft(yc));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertTrue(ex.getMessage().contains("Kho Hà Nội") && !ex.getMessage().contains("Kho PO"), ex.getMessage());

        dangNhap("nhan_vien_kho", 1, 1);
        when(donMuaHangRepository.findById(51)).thenReturn(Optional.empty());
        yc.setDonMuaHangId(51);
        assertEquals(HttpStatus.NOT_FOUND, loi(() -> service.createDraft(yc)).getStatus());
        yc.setDonMuaHangId(null);
        assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.createDraft(yc)).getStatus());

        yc.setDonMuaHangId(50);
        po.setTrangThai(1);
        assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.createDraft(yc)).getStatus());
        po.setTrangThai(3);
        when(repository.save(any(PhieuNhapKho.class))).thenAnswer(inv -> inv.getArgument(0));
        yc.getChiTietPhieuNhapKhos().get(0).setBienTheSanPhamId(999);
        assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.createDraft(yc)).getStatus());
        yc.getChiTietPhieuNhapKhos().get(0).setBienTheSanPhamId(100);
        yc.getChiTietPhieuNhapKhos().get(0).setSoLuongDuKienNhap(BigDecimal.ZERO);
        assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.createDraft(yc)).getStatus());

        // Số lẻ, dòng rỗng, hai dòng cùng biến thể: 400 trước khi đụng đơn mua
        yc.getChiTietPhieuNhapKhos().get(0).setSoLuongDuKienNhap(new BigDecimal("1.5"));
        assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.createDraft(yc)).getStatus());
        java.util.List<com.dev.backend.dto.request.ChiTietPhieuNhapKhoCreating> coNull = new ArrayList<>();
        coNull.add(null);
        yc.setChiTietPhieuNhapKhos(coNull);
        assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.createDraft(yc)).getStatus());
        yc.setChiTietPhieuNhapKhos(List.of(
                com.dev.backend.dto.request.ChiTietPhieuNhapKhoCreating.builder().bienTheSanPhamId(100).soLuongDuKienNhap(new BigDecimal("5")).build(),
                com.dev.backend.dto.request.ChiTietPhieuNhapKhoCreating.builder().bienTheSanPhamId(100).soLuongDuKienNhap(new BigDecimal("5")).build()));
        CommonException trung = loi(() -> service.createDraft(yc));
        assertEquals(HttpStatus.BAD_REQUEST, trung.getStatus());
        assertTrue(trung.getMessage().contains("hai dòng"), trung.getMessage());
    }

    @Test
    @DisplayName("Xóa qua id dòng dự kiến (chưa có lô): 400, không xóa mất số cần nhập")
    void xoaDongDuKien() {
        when(chiTietPhieuNhapKhoRepository.findByIdAndPhieuNhapKho_Id(500, 1)).thenReturn(Optional.of(dongDraft));
        assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.xoaLo(1, 500)).getStatus());
        verify(chiTietPhieuNhapKhoRepository, never()).delete(any(ChiTietPhieuNhapKho.class));
    }

    @Nested
    @DisplayName("Hủy phiếu nhập (huyPhieuNhap)")
    class HuyPhieu {

        @Test
        @DisplayName("Bỏ lô đã khóa (chi tiết lỗi, dòng biên bản, lô) và hủy biên bản, giải phóng mã lô")
        void boLoVaBienBan() {
            LoHang a = loDaKhoa(60, "LO-1", 9, 3);
            ChiTietPhieuNhapKho ct = ctLo(a);
            when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ct));
            BienBanTraHangNcc bb = BienBanTraHangNcc.builder().id(9).maBienBan("RTV-20261019-001").build();
            when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(bb));
            dongDraft.setSoLuongDatQc(9);
            dongDraft.setTrangThaiKiemDem("DANG_KIEM_DEM");

            service.huyPhieuNhap(1);

            verify(chiTietLoiLoHangRepository).deleteByLoHangId(60);
            verify(chiTietTraHangNccRepository).boLienKetLo(60);
            verify(chiTietPhieuNhapKhoRepository).delete(ct);
            verify(loHangRepository).delete(a);
            // Biên bản hủy nhưng giữ lại: số biên bản đã cấp không được cấp lại cho phiếu khác
            assertEquals(BienBanTraHangNcc.DA_HUY, bb.getTrangThai());
            verify(bienBanTraHangNccRepository).save(bb);
            verify(bienBanTraHangNccRepository, never()).delete(any(BienBanTraHangNcc.class));
            assertEquals(4, phieu.getTrangThai());
            assertEquals(0, dongDraft.getSoLuongDatQc());
            assertEquals("CHO_KIEM_DEM", dongDraft.getTrangThaiKiemDem());
        }

        @Test
        @DisplayName("Phiếu chuyển kho (không có đơn mua): chỉ đổi trạng thái, không đụng lô thật của kho gửi")
        void phieuChuyenKhoKhongXoaLo() {
            phieu.setDonMuaHang(null);
            phieu.setSoPhieuNhap("PN-TRF-20261020-01");
            LoHang loThat = LoHang.builder().id(70).maLo("LO-THAT-01").bienTheSanPham(bienThe).soLuongNhap(12).soLuongLoi(0)
                    .trangThai("HOAT_DONG").build();
            when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ctLo(loThat)));

            service.huyPhieuNhap(1);

            assertEquals(4, phieu.getTrangThai());
            verify(loHangRepository, never()).delete(any(LoHang.class));
            verify(chiTietPhieuNhapKhoRepository, never()).delete(any(ChiTietPhieuNhapKho.class));
            verify(chiTietLoiLoHangRepository, never()).deleteByLoHangId(anyInt());
            verify(bienBanTraHangNccRepository, never()).delete(any(BienBanTraHangNcc.class));
        }

        @Test
        @DisplayName("Phiếu từ đơn mua: chỉ dọn lô đang khóa tạm (TAM_KHOA), lô đã có trạng thái khác giữ nguyên")
        void chiDonLoTamKhoa() {
            LoHang tam = loDaKhoa(60, "LO-1", 9, 0);
            LoHang khac = LoHang.builder().id(61).maLo("LO-2").bienTheSanPham(bienThe).soLuongNhap(5).soLuongLoi(0)
                    .trangThai("HOAT_DONG").build();
            ChiTietPhieuNhapKho ctTam = ctLo(tam);
            ChiTietPhieuNhapKho ctKhac = ctLo(khac);
            when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ctTam, ctKhac));

            service.huyPhieuNhap(1);

            verify(loHangRepository).delete(tam);
            verify(loHangRepository, never()).delete(khac);
            verify(chiTietPhieuNhapKhoRepository).delete(ctTam);
            verify(chiTietPhieuNhapKhoRepository, never()).delete(ctKhac);
            verify(repository).khoaTheoId(1);
        }

        @Test
        @DisplayName("Hủy lần hai hoặc hủy phiếu đã nhập kho: 400 (không phải lỗi 500)")
        void huyLai() {
            phieu.setTrangThai(4);
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.huyPhieuNhap(1)).getStatus());
            phieu.setTrangThai(3);
            assertEquals(HttpStatus.BAD_REQUEST, loi(() -> service.huyPhieuNhap(1)).getStatus());
        }
    }

    // ── Chi tiết phiếu ──

    @Nested
    @DisplayName("Chi tiết phiếu (getDetail)")
    class ChiTietPhieu {

        private void coLo(LoHang... ds) {
            List<ChiTietPhieuNhapKho> cts = Arrays.stream(ds).map(KiemDemNhapKhoServiceTest.this::ctLo).toList();
            List<ChiTietPhieuNhapKho> tatCa = new ArrayList<>(List.of(dongDraft));
            tatCa.addAll(cts);
            phieu.setChiTietPhieuNhapKhos(tatCa);
            when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(cts);
        }

        @Test
        @DisplayName("Biến thể có màu, kích cỡ, mã vạch tem FCentric, mã vạch NCC đã liên kết; chế độ mặc định")
        void thongTinBienThe() {
            when(maVachNhaCungCapRepository.findBarcodeTheoBienThe(eq(5), anyCollection()))
                    .thenReturn(List.<Object[]>of(new Object[]{100, "8935001200307"}, new Object[]{100, "8935001200314"}));

            ChiTietPhieuNhapKhoDto dto = service.getDetail(1);
            PhieuNhapKhoItemDto item = dto.getItems().get(0);

            assertEquals("Quần Jeans Baggy", item.getTenBienThe());
            assertEquals("Xanh nhạt", item.getMauSac());
            assertEquals("30", item.getKichCo());
            assertEquals("2000000000107", item.getMaVachSku());
            assertEquals(List.of("8935001200307", "8935001200314"), item.getMaVachNcc());
            assertEquals("QUET_TIEP_LA_DAT", dto.getCheDoXacNhanChatLuong());
            assertFalse(dto.getBienBanLech());
            assertNull(dto.getTongLoiBienBan());
        }

        @Test
        @DisplayName("Chế độ xác nhận đọc từ cấu hình; giá trị lạ thì về mặc định")
        void cheDoTuCauHinh() {
            when(cauHinhHeThongRepository.findById("KIEM_DEM_XAC_NHAN"))
                    .thenReturn(Optional.of(CauHinhHeThong.builder().giaTri("QUET_THE_TUNG_CAI").build()));
            assertEquals("QUET_THE_TUNG_CAI", service.getDetail(1).getCheDoXacNhanChatLuong());
            when(cauHinhHeThongRepository.findById("KIEM_DEM_XAC_NHAN"))
                    .thenReturn(Optional.of(CauHinhHeThong.builder().giaTri("abc").build()));
            assertEquals("QUET_TIEP_LA_DAT", service.getDetail(1).getCheDoXacNhanChatLuong());
        }

        @Test
        @DisplayName("Có lỗi chưa có biên bản: khóa nhập kho")
        void coLoiChuaBienBan() {
            coLo(loDaKhoa(60, "LO-1", 37, 3));
            ChiTietPhieuNhapKhoDto dto = service.getDetail(1);
            assertTrue(dto.getSafetyLock());
            assertFalse(dto.getCoTheNhapKho());
            assertEquals(3, dto.getTongSoLuongLoi());
        }

        @Test
        @DisplayName("Biên bản khớp số lỗi: mở nhập kho; biên bản lệch (xóa / thêm lô lỗi sau khi lập): khóa lại")
        void bienBanLech() {
            coLo(loDaKhoa(60, "LO-1", 37, 3));
            BienBanTraHangNcc bb = BienBanTraHangNcc.builder().id(9).maBienBan("RTV-1").tongSoLuongLoi(3).phuongAnXuLy("DOI_HANG").build();
            when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(bb));
            when(bienBanTraHangService.khopHangLoiHienTai(bb)).thenReturn(true);

            ChiTietPhieuNhapKhoDto khop = service.getDetail(1);
            assertFalse(khop.getBienBanLech());
            assertFalse(khop.getSafetyLock());
            assertTrue(khop.getCoTheNhapKho());
            assertEquals("DOI_HANG", khop.getPhuongAnBienBan());

            bb.setTongSoLuongLoi(5);
            when(bienBanTraHangService.khopHangLoiHienTai(bb)).thenReturn(false);
            ChiTietPhieuNhapKhoDto lech = service.getDetail(1);
            assertTrue(lech.getBienBanLech());
            assertTrue(lech.getSafetyLock());
            assertFalse(lech.getCoTheNhapKho());
            assertEquals(5, lech.getTongLoiBienBan());
        }

        @Test
        @DisplayName("Đã xóa hết lô lỗi nhưng còn biên bản: vẫn khóa (phải hủy / lập lại biên bản)")
        void bienBanThuaKhiHetLoi() {
            coLo(loDaKhoa(60, "LO-1", 40, 0));
            when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(
                    BienBanTraHangNcc.builder().id(9).maBienBan("RTV-1").tongSoLuongLoi(3).build()));
            when(bienBanTraHangService.khopHangLoiHienTai(any())).thenReturn(false);
            ChiTietPhieuNhapKhoDto dto = service.getDetail(1);
            assertTrue(dto.getBienBanLech());
            assertFalse(dto.getCoTheNhapKho());
        }
    }

    // ── Xác nhận nhập kho ──

    @Nested
    @DisplayName("Xác nhận nhập kho (completePhieuNhap)")
    class XacNhanNhapKho {

        private LoHang loDat;
        private LoHang loLoi;

        @BeforeEach
        void coHaiLo() {
            loDat = loDaKhoa(60, "LO-1", 37, 1);
            loLoi = loDaKhoa(61, "LO-2", 0, 2);
            when(chiTietPhieuNhapKhoRepository.findAllByPhieuNhapKhoIdAndCoLo(1)).thenReturn(List.of(ctLo(loDat), ctLo(loLoi)));
            when(tonKhoTheoLoRepository.findByKho_IdAndLoHang_Id(eq(1), anyInt())).thenReturn(Optional.empty());
            when(tonKhoViTriRepository.findByViTriKho_IdAndLoHang_Id(anyInt(), anyInt())).thenReturn(Optional.empty());
        }

        private void bienBan(int tongLoi, String phuongAn) {
            when(bienBanTraHangNccRepository.findByPhieuNhapKho_Id(1)).thenReturn(Optional.of(
                    BienBanTraHangNcc.builder().id(9).maBienBan("RTV-20261019-001").tongSoLuongLoi(tongLoi).phuongAnXuLy(phuongAn).build()));
            // Biên bản khớp khi tổng trên biên bản bằng tổng lỗi của hai lô (1 + 2)
            when(bienBanTraHangService.khopHangLoiHienTai(any())).thenReturn(tongLoi == 3);
        }

        @Test
        @DisplayName("Biên bản không còn khớp hàng lỗi hiện tại: 409, không ghi tồn")
        void bienBanLech() {
            bienBan(5, "DOI_HANG");
            CommonException ex = loi(() -> service.completePhieuNhap(1, 9));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
            assertTrue(ex.getMessage().contains("Lập lại biên bản"), ex.getMessage());
            verify(tonKhoTheoLoRepository, never()).save(any());
            assertEquals(0, phieu.getTrangThai());
        }

        @Test
        @DisplayName("Đổi hàng mới: đơn mua chỉ tính hàng đạt đã nhận, còn chờ giao bù phần lỗi")
        void doiHangChiTinhDat() {
            bienBan(3, "DOI_HANG");
            service.completePhieuNhap(1, 9);

            assertEquals(0, poItem.getSoLuongDaNhan().compareTo(new BigDecimal("37")));
            assertEquals(3, po.getTrangThai(), "đơn mua chưa hoàn thành, chờ 3 cái giao bù");
            assertEquals(3, phieu.getTrangThai());
        }

        @Test
        @DisplayName("Trừ công nợ: đơn mua tính cả hàng lỗi là đã xử lý, đơn hoàn thành")
        void truCongNoTinhCaLoi() {
            bienBan(3, "TRU_CONG_NO");
            service.completePhieuNhap(1, 9);

            assertEquals(0, poItem.getSoLuongDaNhan().compareTo(new BigDecimal("40")));
            assertEquals(5, po.getTrangThai(), "nhận đủ là 5 \"Đã nhận đủ\" (4 là \"Không chấp nhận báo giá\")");
        }

        @Test
        @DisplayName("Đơn mua đã nhận thêm từ phiếu khác (hai phiếu Nháp cùng đơn): chặn nhận vượt số đặt, không ghi tồn")
        void chanNhanVuotSoDat() {
            bienBan(3, "TRU_CONG_NO");
            poItem.setSoLuongDaNhan(new BigDecimal("10"));
            CommonException ex = loi(() -> service.completePhieuNhap(1, 9));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
            assertTrue(ex.getMessage().contains("sẽ vượt số đặt"), ex.getMessage());
            assertEquals(0, poItem.getSoLuongDaNhan().compareTo(new BigDecimal("10")));
            verify(chiTietDonMuaHangRepository).khoaTheoDonMua(50);
        }

        @Test
        @DisplayName("Lô đã khóa nhiều hơn số cần nhập (khóa đồng thời lọt): chặn nhập kho")
        void chanLoVuotSoCanNhap() {
            bienBan(3, "TRU_CONG_NO");
            dongDraft.setSoLuongNhap(new BigDecimal("30"));
            CommonException ex = loi(() -> service.completePhieuNhap(1, 9));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
            assertTrue(ex.getMessage().contains("vượt số cần nhập"), ex.getMessage());
        }

        @Test
        @DisplayName("Khóa dòng phiếu trước khi đọc: người bấm sau thấy phiếu đã nhập kho")
        void khoaDongPhieu() {
            bienBan(3, "DOI_HANG");
            service.completePhieuNhap(1, 9);
            verify(repository).khoaTheoId(1);
            verify(repository, never()).findById(1);
        }

        @Test
        @DisplayName("Lô chỉ có hàng lỗi: không tạo dòng tồn, lịch sử hay sự kiện đẩy tồn")
        void loChiCoLoiKhongVaoTon() {
            bienBan(3, "TRU_CONG_NO");
            service.completePhieuNhap(1, 9);

            verify(tonKhoTheoLoRepository, times(1)).save(argThat(t -> t.getLoHang() == loDat
                    && t.getSoLuongTon().compareTo(new BigDecimal("37")) == 0));
            verify(lichSuGiaoDichKhoRepository, times(1)).save(argThat(h -> h.getLoHang() == loDat));
            verify(eventPublisher, times(1)).publishEvent(any());
            verify(tonKhoViTriRepository, times(1)).save(argThat(t -> t.getSoLuong() == 37));
            assertEquals("HOAT_DONG", loLoi.getTrangThai());
            assertEquals(0, phieu.getTongTien().compareTo(new BigDecimal("5550000")));
        }

        @Test
        @DisplayName("Có lỗi chưa lập biên bản: 409")
        void chuaBienBan() {
            CommonException ex = loi(() -> service.completePhieuNhap(1, 9));
            assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        }

        @Test
        @DisplayName("Phiếu của kho khác kho đang chọn: 403")
        void khoKhac() {
            bienBan(3, "DOI_HANG");
            dangNhap("quan_ly_kho", 2, 1, 2);
            assertEquals(HttpStatus.FORBIDDEN, loi(() -> service.completePhieuNhap(1, 9)).getStatus());
            assertEquals(0, phieu.getTrangThai());
        }
    }
}
