package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.NhaCungCapCreating;
import com.dev.backend.dto.request.NhaCungCapUpdating;
import com.dev.backend.dto.response.customize.NhaCungCapKiemTraXoaDto;
import com.dev.backend.dto.response.entities.NhaCungCapDto;
import com.dev.backend.entities.NhaCungCap;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.NhaCungCapMapper;
import com.dev.backend.repository.DonMuaHangRepository;
import com.dev.backend.repository.LoHangRepository;
import com.dev.backend.repository.MaVachNhaCungCapRepository;
import com.dev.backend.repository.NhaCungCapRepository;
import com.dev.backend.repository.PhieuNhapKhoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

/**
 * Nhà cung cấp (/api/supplier):
 * - Tạo mới luôn ở trạng thái Hoạt động; trường tùy chọn để trống lưu NULL.
 * - Sửa thay toàn bộ form nhưng không đổi mã và trạng thái.
 * - Ngừng / cho phép hoạt động là thao tác riêng.
 * - Chỉ xóa được nhà cung cấp chưa phát sinh giao dịch; mã vạch nhà cung cấp xóa kèm.
 */
@ExtendWith(MockitoExtension.class)
class NhaCungCapServiceTest {

    @Mock
    private NhaCungCapRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private DonMuaHangRepository donMuaHangRepository;
    @Mock
    private PhieuNhapKhoRepository phieuNhapKhoRepository;
    @Mock
    private LoHangRepository loHangRepository;
    @Mock
    private MaVachNhaCungCapRepository maVachNhaCungCapRepository;

    private NhaCungCapService service;

    @BeforeEach
    void setUp() {
        NhaCungCapMapper mapper = Mappers.getMapper(NhaCungCapMapper.class);
        service = new NhaCungCapService(repository, mapper, entityManager,
                donMuaHangRepository, phieuNhapKhoRepository, loHangRepository, maVachNhaCungCapRepository);
    }

    private NhaCungCap nhaCungCap(int id, int trangThai) {
        return NhaCungCap.builder()
                .id(id).maNhaCungCap("SUP00" + id).tenNhaCungCap("Công ty " + id)
                .nguoiLienHe("Nguyễn Văn A").soDienThoai("0912345678").email("ncc" + id + "@gmail.com")
                .diaChi("Hà Nội").nganHang("970415").soNganHang("123456789")
                .trangThai(trangThai)
                .build();
    }

    private NhaCungCap savedEntity() {
        ArgumentCaptor<NhaCungCap> captor = ArgumentCaptor.forClass(NhaCungCap.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    private NhaCungCapCreating.NhaCungCapCreatingBuilder taoMoiHopLe() {
        return NhaCungCapCreating.builder()
                .maNhaCungCap(" SUP003 ").tenNhaCungCap("  Công ty May Hà Nội ")
                .soDienThoai("02438251234").email(" lienhe@mayhanoi.vn ");
    }

    private NhaCungCapUpdating.NhaCungCapUpdatingBuilder suaHopLe() {
        return NhaCungCapUpdating.builder()
                .tenNhaCungCap("Công ty mới").soDienThoai("0987654321").email("moi@gmail.com");
    }

    // ── Tạo mới ──

    @Test
    void create_luonHoatDong_vaTruongTrongLuuNull() {
        when(repository.existsByMaNhaCungCap("SUP003")).thenReturn(false);
        when(repository.save(any(NhaCungCap.class))).thenAnswer(invocation -> invocation.getArgument(0));

        NhaCungCapDto dto = service.create(taoMoiHopLe()
                .nguoiLienHe("   ").diaChi("").nganHang("").soNganHang("")
                .build());

        NhaCungCap saved = savedEntity();
        assertEquals("SUP003", saved.getMaNhaCungCap());
        assertEquals("Công ty May Hà Nội", saved.getTenNhaCungCap());
        assertEquals("lienhe@mayhanoi.vn", saved.getEmail());
        assertEquals("02438251234", saved.getSoDienThoai());
        assertNull(saved.getNguoiLienHe());
        assertNull(saved.getDiaChi());
        assertNull(saved.getNganHang());
        assertNull(saved.getSoNganHang());
        assertEquals(NhaCungCapService.TRANG_THAI_HOAT_DONG, saved.getTrangThai());
        assertEquals(NhaCungCapService.TRANG_THAI_HOAT_DONG, dto.getTrangThai());
    }

    @Test
    void create_trungMa_bao409VaKhongLuu() {
        when(repository.existsByMaNhaCungCap("SUP003")).thenReturn(true);

        CommonException ex = assertThrows(CommonException.class, () -> service.create(taoMoiHopLe().build()));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Mã nhà cung cấp 'SUP003' đã tồn tại"));
        verify(repository, never()).save(any());
    }

    @Test
    void create_coNganHangMaThieuSoTaiKhoan_baoLoi() {
        when(repository.existsByMaNhaCungCap("SUP003")).thenReturn(false);

        CommonException ex = assertThrows(CommonException.class,
                () -> service.create(taoMoiHopLe().nganHang("970415").soNganHang(" ").build()));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("số tài khoản"));
        verify(repository, never()).save(any());
    }

    // ── Sửa ──

    @Test
    void update_xoaDuocTruongTuyChon_khongDoiMaTrangThaiVaNganHang() {
        NhaCungCap hienTai = nhaCungCap(5, NhaCungCapService.TRANG_THAI_NGUNG_HOAT_DONG);
        when(repository.findById(5)).thenReturn(Optional.of(hienTai));
        when(repository.save(any(NhaCungCap.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.update(5, suaHopLe().nguoiLienHe("").diaChi(null).build());

        NhaCungCap saved = savedEntity();
        assertEquals("SUP005", saved.getMaNhaCungCap());
        assertEquals("Công ty mới", saved.getTenNhaCungCap());
        assertNull(saved.getNguoiLienHe());
        assertNull(saved.getDiaChi());
        // Ngân hàng không sửa qua API này: giữ nguyên giá trị đang lưu
        assertEquals("970415", saved.getNganHang());
        assertEquals("123456789", saved.getSoNganHang());
        assertEquals(NhaCungCapService.TRANG_THAI_NGUNG_HOAT_DONG, saved.getTrangThai());
        assertNotNull(saved.getNgayCapNhat());
    }

    @Test
    void update_duLieuNganHangCuSaiDinhDang_vanSuaDuocTruongKhac() {
        // Dữ liệu cũ chỉ có ngân hàng, số tài khoản có khoảng trắng: trước đây chặn mọi lần sửa
        NhaCungCap hienTai = nhaCungCap(6, NhaCungCapService.TRANG_THAI_HOAT_DONG);
        hienTai.setNganHang("MB Bank");
        hienTai.setSoNganHang(null);
        when(repository.findById(6)).thenReturn(Optional.of(hienTai));
        when(repository.save(any(NhaCungCap.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.update(6, suaHopLe().email("doi@gmail.com").build());

        NhaCungCap saved = savedEntity();
        assertEquals("doi@gmail.com", saved.getEmail());
        assertEquals("MB Bank", saved.getNganHang());
        assertNull(saved.getSoNganHang());
    }

    @Test
    void update_jsonCuGuiKemNganHang_biBoQua() throws Exception {
        // Frontend cũ gửi kèm nganHang / soNganHang (kể cả giá trị sai định dạng): Jackson bỏ qua, không lỗi.
        // Jackson2ObjectMapperBuilder là cấu hình gốc Spring Boot dùng cho ObjectMapper của ứng dụng (tắt
        // FAIL_ON_UNKNOWN_PROPERTIES); repo không ghi đè cấu hình này.
        ObjectMapper om = Jackson2ObjectMapperBuilder.json().build();
        NhaCungCapUpdating dto = om.readValue("""
                {"tenNhaCungCap":"Công ty mới","soDienThoai":"0987654321","email":"moi@gmail.com",
                 "nganHang":"MB Bank","soNganHang":"12 34"}""", NhaCungCapUpdating.class);
        NhaCungCap hienTai = nhaCungCap(7, NhaCungCapService.TRANG_THAI_HOAT_DONG);
        when(repository.findById(7)).thenReturn(Optional.of(hienTai));
        when(repository.save(any(NhaCungCap.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.update(7, dto);

        NhaCungCap saved = savedEntity();
        assertEquals("970415", saved.getNganHang());
        assertEquals("123456789", saved.getSoNganHang());
    }

    @Test
    void update_khongTimThay_bao404() {
        when(repository.findById(99)).thenReturn(Optional.empty());

        CommonException ex = assertThrows(CommonException.class, () -> service.update(99, suaHopLe().build()));

        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
    }

    // ── Ngừng / cho phép hoạt động ──

    @Test
    void capNhatTrangThai_ngungHoatDong_luuTrangThaiMoi() {
        when(repository.findById(5)).thenReturn(Optional.of(nhaCungCap(5, NhaCungCapService.TRANG_THAI_HOAT_DONG)));
        when(repository.save(any(NhaCungCap.class))).thenAnswer(invocation -> invocation.getArgument(0));

        NhaCungCapDto dto = service.capNhatTrangThai(5, NhaCungCapService.TRANG_THAI_NGUNG_HOAT_DONG);

        assertEquals(NhaCungCapService.TRANG_THAI_NGUNG_HOAT_DONG, dto.getTrangThai());
        assertEquals(NhaCungCapService.TRANG_THAI_NGUNG_HOAT_DONG, savedEntity().getTrangThai());
    }

    @Test
    void capNhatTrangThai_daDungTrangThai_khongGhiLai() {
        when(repository.findById(5)).thenReturn(Optional.of(nhaCungCap(5, NhaCungCapService.TRANG_THAI_HOAT_DONG)));

        NhaCungCapDto dto = service.capNhatTrangThai(5, NhaCungCapService.TRANG_THAI_HOAT_DONG);

        assertEquals(NhaCungCapService.TRANG_THAI_HOAT_DONG, dto.getTrangThai());
        verify(repository, never()).save(any());
    }

    @Test
    void capNhatTrangThai_giaTriLa_baoLoi() {
        assertThrows(CommonException.class, () -> service.capNhatTrangThai(5, 2));
        assertThrows(CommonException.class, () -> service.capNhatTrangThai(5, null));
        verify(repository, never()).findById(anyInt());
    }

    // ── Xóa ──

    @Test
    void delete_daCoGiaoDich_bao409NeuRoSoChungTu_khongXoa() {
        when(repository.existsById(5)).thenReturn(true);
        when(donMuaHangRepository.countByNhaCungCap_Id(5)).thenReturn(3L);
        when(phieuNhapKhoRepository.countByNhaCungCap_Id(5)).thenReturn(1L);
        when(loHangRepository.countByNhaCungCap_Id(5)).thenReturn(0L);

        CommonException ex = assertThrows(CommonException.class, () -> service.delete(5));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("3 đơn mua hàng, 1 phiếu nhập kho"));
        assertTrue(ex.getMessage().contains("Ngừng hoạt động"));
        NhaCungCapKiemTraXoaDto data = assertInstanceOf(NhaCungCapKiemTraXoaDto.class, ex.getData());
        assertFalse(data.isCoTheXoa());
        verify(repository, never()).deleteById(anyInt());
        verifyNoInteractions(maVachNhaCungCapRepository);
    }

    @Test
    void delete_chuaCoGiaoDich_xoaKemMaVachRoiXoaNhaCungCap() {
        when(repository.existsById(6)).thenReturn(true);
        when(donMuaHangRepository.countByNhaCungCap_Id(6)).thenReturn(0L);
        when(phieuNhapKhoRepository.countByNhaCungCap_Id(6)).thenReturn(0L);
        when(loHangRepository.countByNhaCungCap_Id(6)).thenReturn(0L);
        when(maVachNhaCungCapRepository.deleteByNhaCungCapId(6)).thenReturn(2);

        service.delete(6);

        // Mã vạch gỡ trước để không còn dòng nào trỏ tới nhà cung cấp đã xóa
        var thuTu = inOrder(maVachNhaCungCapRepository, repository);
        thuTu.verify(maVachNhaCungCapRepository).deleteByNhaCungCapId(6);
        thuTu.verify(repository).deleteById(6);
    }

    @Test
    void kiemTraXoa_khongTimThay_bao404() {
        when(repository.existsById(99)).thenReturn(false);

        CommonException ex = assertThrows(CommonException.class, () -> service.kiemTraXoa(99));

        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
        verifyNoInteractions(donMuaHangRepository, phieuNhapKhoRepository, loHangRepository);
    }
}
