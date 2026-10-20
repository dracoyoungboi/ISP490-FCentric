package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.request.inbound.MaVachLienKetRequest;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.PhanQuyenNguoiDungKhoDto;
import com.dev.backend.dto.response.inbound.MaVachNhaCungCapDto;
import com.dev.backend.dto.response.inbound.TraCuuMaVachResponse;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.ChiTietPhieuNhapKhoRepository;
import com.dev.backend.repository.MaVachNhaCungCapRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MaVachNhaCungCapServiceTest {

    @Mock
    private MaVachNhaCungCapRepository maVachNhaCungCapRepository;
    @Mock
    private BienTheSanPhamRepository bienTheSanPhamRepository;
    @Mock
    private PhieuNhapKhoRepository phieuNhapKhoRepository;
    @Mock
    private ChiTietPhieuNhapKhoRepository chiTietPhieuNhapKhoRepository;
    @Mock
    private NguoiDungRepository nguoiDungRepository;
    @Mock
    private com.dev.backend.repository.ViTriKhoRepository viTriKhoRepository;

    private MaVachNhaCungCapServiceImpl service;

    private BienTheSanPham bienThe;
    private BienTheSanPham bienTheKhac;
    private NhaCungCap nhaCungCap;
    private MaVachNhaCungCap maVachEntity;
    private PhieuNhapKho phieu;
    private Kho kho;

    @BeforeEach
    void setUp() {
        service = new MaVachNhaCungCapServiceImpl(
                maVachNhaCungCapRepository,
                bienTheSanPhamRepository,
                phieuNhapKhoRepository,
                chiTietPhieuNhapKhoRepository,
                nguoiDungRepository,
                viTriKhoRepository
        );

        SanPhamQuanAo sanPham = SanPhamQuanAo.builder().id(1).tenSanPham("Áo Thun Polo").build();
        bienThe = BienTheSanPham.builder().id(10).maSku("POLO-BLK-M").sanPham(sanPham)
                .mauSac(MauSac.builder().tenMau("Đen").build())
                .size(com.dev.backend.entities.Size.builder().tenSize("M").build())
                .build();
        bienTheKhac = BienTheSanPham.builder().id(11).maSku("POLO-BLK-L").sanPham(sanPham)
                .mauSac(MauSac.builder().tenMau("Đen").build())
                .size(com.dev.backend.entities.Size.builder().tenSize("L").build())
                .build();
        nhaCungCap = NhaCungCap.builder().id(5).tenNhaCungCap("NCC May Mặc Việt").build();
        kho = Kho.builder().id(1).tenKho("Kho Hà Nội").build();
        phieu = PhieuNhapKho.builder().id(7).soPhieuNhap("PN202610191").trangThai(0).kho(kho).nhaCungCap(nhaCungCap).build();

        maVachEntity = MaVachNhaCungCap.builder()
                .id(100)
                .barcodeNcc("8935001200307")
                .nhaCungCap(nhaCungCap)
                .bienTheSanPham(bienThe)
                .build();

        when(phieuNhapKhoRepository.findById(7)).thenReturn(Optional.of(phieu));
        when(bienTheSanPhamRepository.findById(10)).thenReturn(Optional.of(bienThe));
        when(bienTheSanPhamRepository.findById(11)).thenReturn(Optional.of(bienTheKhac));
        when(chiTietPhieuNhapKhoRepository.findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(7, 10))
                .thenReturn(Optional.of(ChiTietPhieuNhapKho.builder().id(70).build()));
        when(chiTietPhieuNhapKhoRepository.findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(7, 11))
                .thenReturn(Optional.of(ChiTietPhieuNhapKho.builder().id(71).build()));
        when(maVachNhaCungCapRepository.save(any(MaVachNhaCungCap.class))).thenAnswer(inv -> {
            MaVachNhaCungCap m = inv.getArgument(0);
            if (m.getId() == null) m.setId(101);
            return m;
        });
        // Liên kết mới ghi ngay (saveAndFlush) để khóa duy nhất mã + NCC báo trùng ngay trong lệnh này
        when(maVachNhaCungCapRepository.saveAndFlush(any(MaVachNhaCungCap.class))).thenAnswer(inv -> {
            MaVachNhaCungCap m = inv.getArgument(0);
            if (m.getId() == null) m.setId(101);
            return m;
        });
        dangNhapNhanVienKho(1);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private void dangNhapNhanVienKho(Integer khoDangChon) {
        PhanQuyenNguoiDungKhoDto pq = PhanQuyenNguoiDungKhoDto.builder().kho(KhoDto.builder().id(1).build()).build();
        NguoiDungAuthInfo info = NguoiDungAuthInfo.builder().id(55).vaiTro(Set.of("nhan_vien_kho"))
                .phanQuyenNguoiDungKhos(List.of(pq)).build();
        SecurityContextHolder.setUser(info);
        SecurityContextHolder.setKhoId(khoDangChon);
        when(nguoiDungRepository.findById(55)).thenReturn(Optional.of(NguoiDung.builder().id(55).hoTen("Lê Thu Hà").build()));
    }

    private MaVachLienKetRequest yeuCau(String ma, Integer bienTheId) {
        return MaVachLienKetRequest.builder().maVach(ma).nhaCungCapId(5).bienTheSanPhamId(bienTheId).phieuNhapKhoId(7).build();
    }

    // ── Tra cứu ──

    @Test
    @DisplayName("Tra cứu mã vạch nội bộ SKU thành công, có màu và kích cỡ")
    void testTraCuu_MaNoiBoSku_ThanhCong() {
        when(bienTheSanPhamRepository.findByMaSkuIgnoreCase("POLO-BLK-M")).thenReturn(Optional.of(bienThe));

        TraCuuMaVachResponse res = service.traCuu("POLO-BLK-M", 5);
        assertEquals("FCENTRIC", res.getLoaiMa());
        assertEquals("POLO-BLK-M", res.getSku());
        assertEquals("Đen", res.getMauSac());
        assertEquals("M", res.getKichCo());
        assertFalse(res.getCanMapNhanh());
    }

    @Test
    @DisplayName("Tra cứu mã vạch in trên tem FCentric (maVachSku) cũng là mã FCentric")
    void testTraCuu_MaVachSku_LaMaFcentric() {
        when(bienTheSanPhamRepository.findByMaSkuIgnoreCase("2000000000107")).thenReturn(Optional.empty());
        when(bienTheSanPhamRepository.findFirstByMaVachSkuIgnoreCase("2000000000107")).thenReturn(Optional.of(bienThe));

        TraCuuMaVachResponse res = service.traCuu("2000000000107", 5);
        assertEquals("FCENTRIC", res.getLoaiMa());
        assertEquals(10, res.getBienTheSanPhamId());
    }

    @Test
    @DisplayName("Tra cứu mã vạch NCC đã ánh xạ thành công")
    void testTraCuu_MaNccDaAnhXa_ThanhCong() {
        when(maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id("8935001200307", 5))
                .thenReturn(Optional.of(maVachEntity));

        TraCuuMaVachResponse res = service.traCuu("8935001200307", 5);
        assertEquals("NCC", res.getLoaiMa());
        assertEquals("POLO-BLK-M", res.getSku());
        assertEquals("M", res.getKichCo());
        assertFalse(res.getCanMapNhanh());
    }

    @Test
    @DisplayName("Tra cứu mã lạ trả timThay=false, loaiMa LA")
    void testTraCuu_MaLa_YeuCauLienKet() {
        TraCuuMaVachResponse res = service.traCuu("UNKNOWN_BARCODE", 5);
        assertFalse(res.getTimThay());
        assertEquals("LA", res.getLoaiMa());
        assertTrue(res.getCanMapNhanh());
    }

    // ── Liên kết ──

    @Test
    @DisplayName("Liên kết mã NCC mới: lưu người liên kết, phiếu, mã hàng NCC; DTO có màu/kích cỡ/người")
    void testLienKet_ThanhCong() {
        MaVachLienKetRequest req = yeuCau(" 8935001200406 ", 10);
        req.setMaHangNcc("PN-JB-030");

        MaVachNhaCungCapDto dto = service.lienKet(req);

        ArgumentCaptor<MaVachNhaCungCap> cap = ArgumentCaptor.forClass(MaVachNhaCungCap.class);
        verify(maVachNhaCungCapRepository).saveAndFlush(cap.capture());
        MaVachNhaCungCap saved = cap.getValue();
        assertEquals("8935001200406", saved.getBarcodeNcc(), "mã được trim");
        assertSame(phieu, saved.getPhieuNhapKho());
        assertEquals(55, saved.getNguoiLienKet().getId());
        assertEquals("PN-JB-030", saved.getMaSanPhamNcc());
        assertEquals("Lê Thu Hà", dto.getTenNguoiLienKet());
        assertEquals("Đen", dto.getMauSac());
        assertEquals("M", dto.getKichCo());
        assertEquals("PN202610191", dto.getSoPhieuNhap());
    }

    @Test
    @DisplayName("Mã đã liên kết biến thể khác: 409, không ghi đè")
    void testLienKet_DaLienKetBienTheKhac_409() {
        when(maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id("8935001200307", 5)).thenReturn(Optional.of(maVachEntity));

        CommonException ex = assertThrows(CommonException.class, () -> service.lienKet(yeuCau("8935001200307", 11)));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("Áo Thun Polo · Đen · M (POLO-BLK-M)"), ex.getMessage());
        assertEquals(10, maVachEntity.getBienTheSanPham().getId(), "không đổi biến thể của liên kết cũ");
        verify(maVachNhaCungCapRepository, never()).save(any());
        verify(maVachNhaCungCapRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Mã đã liên kết cùng biến thể: trả liên kết cũ, không tạo dòng mới")
    void testLienKet_CungBienThe_IdempotentBoSungMaHang() {
        when(maVachNhaCungCapRepository.findByBarcodeNccAndNhaCungCap_Id("8935001200307", 5)).thenReturn(Optional.of(maVachEntity));
        MaVachLienKetRequest req = yeuCau("8935001200307", 10);
        req.setMaHangNcc("PN-JB-030");

        MaVachNhaCungCapDto dto = service.lienKet(req);
        assertEquals(100, dto.getId());
        assertEquals("PN-JB-030", maVachEntity.getMaSanPhamNcc());
        verify(maVachNhaCungCapRepository, times(1)).save(maVachEntity);
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @ValueSource(strings = {"QJ261014đ1-XN-30", "ABC 123", "FC-KHONG-DAT", "fc-abc", "8935001200387"})
    @DisplayName("Mã không hợp lệ (ký tự có dấu / khoảng trắng / tiền tố FC- / sai số kiểm tra GS1): 400")
    void testLienKet_MaKhongHopLe_400(String ma) {
        CommonException ex = assertThrows(CommonException.class, () -> service.lienKet(yeuCau(ma, 10)));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        verify(maVachNhaCungCapRepository, never()).save(any());
        verify(maVachNhaCungCapRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Mã là SKU FCentric: 400, không cần liên kết")
    void testLienKet_MaLaSkuFcentric_400() {
        when(bienTheSanPhamRepository.findByMaSkuIgnoreCase("POLO-BLK-L")).thenReturn(Optional.of(bienTheKhac));
        CommonException ex = assertThrows(CommonException.class, () -> service.lienKet(yeuCau("POLO-BLK-L", 10)));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("mã FCentric"));
    }

    @Test
    @DisplayName("Thiếu phiếu nhập: 400 (chỉ liên kết lúc kiểm đếm)")
    void testLienKet_ThieuPhieu_400() {
        MaVachLienKetRequest req = yeuCau("8935001200406", 10);
        req.setPhieuNhapKhoId(null);
        CommonException ex = assertThrows(CommonException.class, () -> service.lienKet(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("Phiếu đã nhập kho / khác NCC / biến thể ngoài phiếu: 400")
    void testLienKet_PhieuKhongHopLe_400() {
        phieu.setTrangThai(3);
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(CommonException.class, () -> service.lienKet(yeuCau("8935001200406", 10))).getStatus());
        phieu.setTrangThai(0);

        MaVachLienKetRequest khacNcc = yeuCau("8935001200406", 10);
        khacNcc.setNhaCungCapId(6);
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(CommonException.class, () -> service.lienKet(khacNcc)).getStatus());

        when(chiTietPhieuNhapKhoRepository.findFirstByPhieuNhapKho_IdAndBienTheSanPham_IdAndLoHangIsNull(7, 99))
                .thenReturn(Optional.empty());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(CommonException.class, () -> service.lienKet(yeuCau("8935001200406", 99))).getStatus());
        verify(maVachNhaCungCapRepository, never()).save(any());
        verify(maVachNhaCungCapRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Phiếu thuộc kho khác kho đang chọn: 403")
    void testLienKet_PhieuKhoKhac_403() {
        SecurityContextHolder.setKhoId(2);
        CommonException ex = assertThrows(CommonException.class, () -> service.lienKet(yeuCau("8935001200406", 10)));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    @DisplayName("Liên kết mã vạch thiếu mã báo lỗi BadRequest")
    void testLienKet_ThieuMaVach_BaoLoiBadRequest() {
        CommonException ex = assertThrows(CommonException.class, () -> service.lienKet(yeuCau("", 10)));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    @DisplayName("Hai máy liên kết cùng một mã NCC cùng lúc: bản thứ hai vướng khóa duy nhất, trả 409 kèm cách xử lý")
    void testLienKet_TrungCungLuc_409() {
        when(maVachNhaCungCapRepository.saveAndFlush(any(MaVachNhaCungCap.class)))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("Duplicate entry 'uk_barcode_ncc'"));

        CommonException ex = assertThrows(CommonException.class, () -> service.lienKet(yeuCau("8935001200406", 10)));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("vừa được liên kết ở máy khác cùng lúc"), ex.getMessage());
        assertTrue(ex.getMessage().contains("Quét lại mã để xem"), ex.getMessage());
    }

    @Test
    @DisplayName("Tìm kiếm: % _ ! trong từ khóa là chữ thường (được thoát bằng !), không phải ký tự đại diện")
    void testTimKiem_ThoatKyTuDaiDien() {
        when(maVachNhaCungCapRepository.searchMappings(any(), any(), any())).thenReturn(org.springframework.data.domain.Page.empty());
        org.springframework.data.domain.Pageable trang = org.springframework.data.domain.PageRequest.of(0, 20,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "ngayTao"));

        service.timKiem("  50%_a!b ", 5, trang);
        verify(maVachNhaCungCapRepository).searchMappings(5, "50!%!_a!!b", trang);

        service.timKiem("   ", null, trang);
        verify(maVachNhaCungCapRepository).searchMappings(null, null, trang);
    }

    @Test
    @DisplayName("Tìm kiếm: sắp xếp theo trường không có trả 400 thay vì lỗi máy chủ")
    void testTimKiem_TruongSapXepLa_400() {
        org.springframework.data.domain.Pageable trang = org.springframework.data.domain.PageRequest.of(0, 20,
                org.springframework.data.domain.Sort.by("khongCo"));
        CommonException ex = assertThrows(CommonException.class, () -> service.timKiem(null, null, trang));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        verify(maVachNhaCungCapRepository, never()).searchMappings(any(), any(), any());
    }

    @Test
    @DisplayName("Mã trùng mã kệ của kho (quét kệ lúc danh sách kệ chưa tải): 400, không liên kết")
    void testLienKet_MaKe_400() {
        when(viTriKhoRepository.existsByKho_IdAndMaViTriIgnoreCase(anyInt(), eq("A-02-01"))).thenReturn(true);
        CommonException ex = assertThrows(CommonException.class, () -> service.lienKet(yeuCau("A-02-01", 10)));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("mã kệ"), ex.getMessage());
        verify(maVachNhaCungCapRepository, never()).saveAndFlush(any());
    }
}
