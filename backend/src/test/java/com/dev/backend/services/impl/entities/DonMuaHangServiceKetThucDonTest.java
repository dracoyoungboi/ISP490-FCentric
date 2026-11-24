package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.ChiTietDonMuaHang;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ChiTietDonMuaHangRepository;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.dev.backend.services.BienBanTraHangService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
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
import java.util.concurrent.atomic.AtomicReference;

import static com.dev.backend.services.impl.entities.DonMuaHangFixture.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Đóng đơn (nhận thiếu) / hủy đơn mua khi có hàng lỗi trả nhà cung cấp: "đã nhận đợt" tính theo phiếu nhập hoàn tất
 * (đợt toàn hàng lỗi vẫn là đã nhận dù số đã nhận = 0), đóng đơn chuyển hàng lỗi chưa chốt sang trừ tiền.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DonMuaHangServiceKetThucDonTest {

    @Mock private DonMuaHangRepository repository;
    @Mock private EntityManager entityManager;
    @Mock private NguoiDungService nguoiDungService;
    @Mock private ChiTietDonMuaHangRepository chiTietDonMuaHangRepository;
    @Mock private PhieuNhapKhoRepository phieuNhapKhoRepository;
    @Mock private BienBanTraHangService bienBanTraHangService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;

    private DonMuaHangService service;
    private final NguoiDung nguoi = NguoiDung.builder().id(7).hoTen("Nhân viên mua").build();
    private DonMuaHang don;
    private ChiTietDonMuaHang dong;

    @BeforeEach
    void setUp() {
        service = new DonMuaHangService(repository);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        ReflectionTestUtils.setField(service, "nguoiDungService", nguoiDungService);
        ReflectionTestUtils.setField(service, "chiTietDonMuaHangRepository", chiTietDonMuaHangRepository);
        ReflectionTestUtils.setField(service, "phieuNhapKhoRepository", phieuNhapKhoRepository);
        ReflectionTestUtils.setField(service, "bienBanTraHangService", bienBanTraHangService);
        ReflectionTestUtils.setField(service, "lichSuThayDoiService", lichSuThayDoiService);
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(7).vaiTro(Set.of("nhan_vien_mua_hang")).build());
        when(nguoiDungService.getOne(7)).thenReturn(Optional.of(nguoi));

        // Đợt nhận duy nhất toàn hàng lỗi: đã nhận (hàng đạt) = 0, 10 cái lỗi còn thiếu chờ chốt
        dong = dong(11, "SKU-1", "10", "1000");
        don = don(101, yeuCau(10, YeuCauMuaHangService.TRANG_THAI_DA_CHON_NCC), ncc(1, "Xưởng A", "a@x.vn"),
                DonMuaHangService.TRANG_THAI_DA_CHAP_NHAN, dong);
        when(repository.findById(101)).thenReturn(Optional.of(don));
        when(repository.findByIdForUpdate(101)).thenReturn(Optional.of(don));
        when(chiTietDonMuaHangRepository.khoaTheoDonMua(101)).thenReturn(List.of(dong));
        when(repository.soPhieuNhapTheoTrangThai(eq(101), anyList())).thenReturn(List.of());
        when(phieuNhapKhoRepository.demPhieuHoanTatCuaDon(101)).thenReturn(1L);
        when(repository.tongDaNhan(101)).thenReturn(BigDecimal.ZERO);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private static CommonException loi409(org.junit.jupiter.api.function.Executable viec) {
        CommonException ex = assertThrows(CommonException.class, viec);
        assertEquals(HttpStatus.CONFLICT, ex.getStatus(), ex.getMessage());
        return ex;
    }

    @Test
    @DisplayName("Đóng đơn có phiếu hoàn tất toàn hàng lỗi (đã nhận = 0): được; hàng lỗi chuyển trừ tiền trước khi đơn thành 6")
    void dongDonDotToanHangLoi() {
        AtomicReference<Integer> trangThaiLucChuyen = new AtomicReference<>();
        doAnswer(inv -> {
            trangThaiLucChuyen.set(inv.<DonMuaHang>getArgument(0).getTrangThai());
            return null;
        }).when(bienBanTraHangService).chuyenTruTienKhiDongDon(any(), any(), any());

        service.dongDon(101, "  NCC hết hàng  ");

        assertEquals(DonMuaHangService.TRANG_THAI_DA_DONG, don.getTrangThai());
        assertTrue(don.getGhiChu().endsWith("Lý do đóng đơn: NCC hết hàng"), don.getGhiChu());
        verify(bienBanTraHangService).chuyenTruTienKhiDongDon(don, nguoi, "NCC hết hàng");
        assertEquals(DonMuaHangService.TRANG_THAI_DA_CHAP_NHAN, trangThaiLucChuyen.get(),
                "đổi biên bản khi đơn còn Đang vận chuyển (giao bù chưa xong mới tính đúng)");
        InOrder thuTu = inOrder(chiTietDonMuaHangRepository, repository, bienBanTraHangService);
        thuTu.verify(chiTietDonMuaHangRepository).khoaTheoDonMua(101);
        thuTu.verify(repository).findByIdForUpdate(101);
        thuTu.verify(bienBanTraHangService).chuyenTruTienKhiDongDon(any(), any(), any());
        thuTu.verify(repository).save(don);
        verify(repository, never()).tongDaNhan(any());
    }

    @Test
    @DisplayName("Hủy đơn đã có phiếu hoàn tất (kể cả toàn hàng lỗi): 409, không đổi biên bản, đơn giữ nguyên")
    void khongHuyDonDaNhanDot() {
        CommonException ex = loi409(() -> service.huyDon(101, "NCC không giao"));
        assertTrue(ex.getMessage().contains("không hủy được"), ex.getMessage());
        assertEquals(DonMuaHangService.TRANG_THAI_DA_CHAP_NHAN, don.getTrangThai());
        verifyNoInteractions(bienBanTraHangService);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("Chưa có phiếu hoàn tất: đóng 409, hủy được và không đụng biên bản")
    void chuaNhanDot() {
        when(phieuNhapKhoRepository.demPhieuHoanTatCuaDon(101)).thenReturn(0L);
        assertTrue(loi409(() -> service.dongDon(101, "Thiếu")).getMessage().contains("chưa nhận đợt hàng nào"));

        service.huyDon(101, "NCC không giao");
        assertEquals(DonMuaHangService.TRANG_THAI_DA_HUY, don.getTrangThai());
        verifyNoInteractions(bienBanTraHangService);
    }

    @Test
    @DisplayName("Mọi dòng hết còn thiếu nhờ đã trừ tiền phần lỗi: không còn gì để đóng (409)")
    void daTruTienHetThieu() {
        // 7 đạt + 3 lỗi đã trừ tiền: trừ tiền cộng thẳng vào "đã nhận" nên dòng hết còn thiếu
        dong.setSoLuongDaNhan(new BigDecimal("10"));
        loi409(() -> service.dongDon(101, "Đóng"));
        verifyNoInteractions(bienBanTraHangService);
    }

    @Test
    @DisplayName("Chi tiết đơn: số trừ tiền mỗi dòng lấy theo biến thể từ biên bản trả hàng; biến thể không trừ là 0")
    void boSungTruTienChoChiTiet() {
        ReflectionTestUtils.setField(service, "lichSuThayDoiRepository",
                mock(com.dev.backend.repository.LichSuThayDoiRepository.class));
        when(bienBanTraHangService.traHangTheoDon(List.of(101))).thenReturn(java.util.Map.of(101,
                new com.dev.backend.services.BienBanTraHangService.TraHangTheoDon(java.util.Map.of(911, 3), 0)));
        com.dev.backend.dto.response.entities.ChiTietDonMuaHangDto coTru = com.dev.backend.dto.response.entities.ChiTietDonMuaHangDto
                .builder().id(11).soLuongDaNhan(new BigDecimal("10"))
                .bienTheSanPham(com.dev.backend.dto.response.entities.BienTheSanPhamDto.builder().id(911).build()).build();
        com.dev.backend.dto.response.entities.ChiTietDonMuaHangDto khongTru = com.dev.backend.dto.response.entities.ChiTietDonMuaHangDto
                .builder().id(12).bienTheSanPham(com.dev.backend.dto.response.entities.BienTheSanPhamDto.builder().id(912).build()).build();
        com.dev.backend.dto.response.entities.ChiTietDonMuaHangDto khongBienThe = com.dev.backend.dto.response.entities.ChiTietDonMuaHangDto
                .builder().id(13).build();
        com.dev.backend.dto.response.entities.DonMuaHangDto dto = com.dev.backend.dto.response.entities.DonMuaHangDto.builder()
                .id(101).trangThai(DonMuaHangService.TRANG_THAI_DA_CHAP_NHAN)
                .chiTietDonMuaHangs(List.of(coTru, khongTru, khongBienThe)).build();

        service.boSungKetThuc(dto);

        assertEquals(0, coTru.getSoLuongTruTien().compareTo(new BigDecimal("3")));
        assertEquals(0, khongTru.getSoLuongTruTien().signum());
        assertEquals(0, khongBienThe.getSoLuongTruTien().signum());
        verify(bienBanTraHangService).traHangTheoDon(List.of(101));
    }

    @Test
    @DisplayName("Dựng tay không có repo phiếu nhập: dùng tổng đã nhận như cũ")
    void khongCoRepoPhieuNhap() {
        ReflectionTestUtils.setField(service, "phieuNhapKhoRepository", null);
        loi409(() -> service.dongDon(101, "Đóng"));

        when(repository.tongDaNhan(101)).thenReturn(new BigDecimal("4"));
        service.dongDon(101, "Đóng");
        assertEquals(DonMuaHangService.TRANG_THAI_DA_DONG, don.getTrangThai());
    }

    @Test
    @DisplayName("Còn phiếu nhập nháp của đơn: 409, không chuyển biên bản")
    void conPhieuNhap() {
        when(repository.soPhieuNhapTheoTrangThai(eq(101), anyList())).thenReturn(List.of("PN202611221"));
        assertTrue(loi409(() -> service.dongDon(101, "Đóng")).getMessage().contains("PN202611221"));
        verifyNoInteractions(bienBanTraHangService);
    }
}
