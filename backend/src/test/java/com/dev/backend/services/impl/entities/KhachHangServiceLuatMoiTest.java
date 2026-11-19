package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.dto.request.PosQuickCustomerCreating;
import com.dev.backend.dto.response.entities.KhachHangDto;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhachHangRepository;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Luật kiểm ô 17/11: tên khách theo luật họ tên, email chặt hơn, mã nhập tay mở đầu bằng chữ / số, số điện thoại
 * chỉ di động / máy bàn, trùng số điện thoại so trên số đã chuẩn hóa, POS thêm nhanh cùng luật. Cùng bộ ca với
 * frontend quyTacKhachHangLuatMoi.test.js.
 */
@ExtendWith(MockitoExtension.class)
class KhachHangServiceLuatMoiTest {

    @Mock
    private KhachHangRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private DonBanHangRepository donBanHangRepository;
    @Mock
    private DieuHanhHeThongService dieuHanhHeThongService;

    private KhachHangService service;

    @BeforeEach
    void setUp() {
        KhachHangMapper mapper = Mappers.getMapper(KhachHangMapper.class);
        service = new KhachHangService(repository, mapper, entityManager, donBanHangRepository, dieuHanhHeThongService);
        lenient().when(repository.save(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private KhachHangCreating.KhachHangCreatingBuilder moi(String ten) {
        return KhachHangCreating.builder().maKhachHang("KHX").tenKhachHang(ten).soDienThoai("0990123456");
    }

    private String loiTao(KhachHangCreating creating) {
        return assertThrows(CommonException.class, () -> service.create(creating)).getMessage();
    }

    private KhachHang savedEntity() {
        ArgumentCaptor<KhachHang> captor = ArgumentCaptor.forClass(KhachHang.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    private KhachHang khach(int id, String ten) {
        return KhachHang.builder().id(id).maKhachHang("KH" + id).tenKhachHang(ten)
                .soDienThoai("0912345678").trangThai(1).build();
    }

    // ── Tên ──

    @Test
    void tenKhachHang_chanSoKyTuLaVaMotKyTu() {
        for (String ten : new String[]{"12345", "@@@ !!!", "Nam 0912", "=HYPERLINK(\"x\")", "Shop A&B",
                "Công ty TNHH 3A"}) {
            assertEquals("Tên khách hàng chỉ gồm chữ cái và dấu cách", loiTao(moi(ten).build()), ten);
        }
        assertEquals("Tên khách hàng cần ít nhất 2 ký tự", loiTao(moi("A").build()));
    }

    @Test
    void tenKhachHang_hopLe_chuanHoaKhoangTrangVaKyTuVoHinh() {
        service.create(moi("  Đỗ    Văn ​  Nam ").build());
        assertEquals("Đỗ Văn Nam", savedEntity().getTenKhachHang());
    }

    @Test
    void tenQuaDai_demTheoKyTu() {
        assertDoesNotThrow(() -> service.create(moi("Ă".repeat(200)).build()));
        assertEquals("Tên khách hàng tối đa 200 ký tự", loiTao(moi("Ă".repeat(201)).build()));
    }

    @Test
    void sua_tenCuSaiLuat_khongChanSuaOKhac_doiTenThiKiemLai() {
        KhachHang cu = khach(3, "Shop A&B");
        when(repository.findById(3)).thenReturn(Optional.of(cu));
        assertDoesNotThrow(() -> service.update(3, KhachHangUpdating.builder().diaChi("1 Lê Lợi").build()));

        KhachHang cu2 = khach(4, "Shop A&B");
        when(repository.findById(4)).thenReturn(Optional.of(cu2));
        CommonException ex = assertThrows(CommonException.class,
                () -> service.update(4, KhachHangUpdating.builder().tenKhachHang("Shop A&C").build()));
        assertEquals("Tên khách hàng chỉ gồm chữ cái và dấu cách", ex.getMessage());
    }

    // ── Email, mã ──

    @Test
    void email_chanDangSai() {
        for (String email : new String[]{"a@gmail..com", "a@b.c", ".nam@gmail.com", "nam.@gmail.com", "nam@côngty.vn",
                "nam@-congty.vn", "nam@congty"}) {
            assertEquals("Email chưa đúng, VD: ten@congty.vn", loiTao(moi("Đỗ Nam").email(email).build()), email);
        }
        assertDoesNotThrow(() -> service.create(moi("Đỗ Nam").email("Nam_Do+shop@cong-ty.com.vn").build()));
    }

    @Test
    void maNhapTay_moDauBangChuHoacSo() {
        for (String ma : new String[]{"---", ".KH1", "_A"}) {
            assertTrue(loiTao(moi("Đỗ Nam").maKhachHang(ma).build()).startsWith("Mã khách hàng chỉ gồm"), ma);
        }
    }

    // ── Trùng số điện thoại đã chuẩn hóa, API kiểm trùng ──

    @Test
    void create_sdtCoDauVaPlus84_traTheoSoDaChuanHoa() {
        when(repository.timTrungSoDienThoai("0912345678", null))
                .thenReturn(Optional.of(khach(11, "Nguyễn Anh")));
        CommonException ex = assertThrows(CommonException.class,
                () -> service.create(moi("Đỗ Nam").soDienThoai("+84 912.345.678").build()));
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Nguyễn Anh"));
    }

    @Test
    void timKhachTrung_chuanHoaVaBoQuaGiaTriSaiDang() {
        when(repository.timTrungSoDienThoai("0912345678", 4)).thenReturn(Optional.of(khach(11, "Nguyễn Anh")));
        KhachHangDto dto = service.timKhachTrung("soDienThoai", " 0912 345 678 ", 4);
        assertEquals(11, dto.getId());
        assertNull(service.timKhachTrung("soDienThoai", "0123", null));
        assertNull(service.timKhachTrung("soDienThoai", "19001234", null));
        assertNull(service.timKhachTrung("email", "a@b..vn", null));
        assertNull(service.timKhachTrung("email", "  ", null));
        assertThrows(CommonException.class, () -> service.timKhachTrung("maSoThue", "0312345678", null));
        assertThrows(CommonException.class, () -> service.timKhachTrung("tenKhachHang", "Nam", null));
    }

    // ── POS thêm nhanh ──

    @Test
    void posThemNhanh_cungLuatSdtVaTen() {
        assertTrue(assertThrows(CommonException.class, () -> service.quickCreateForPos(
                PosQuickCustomerCreating.builder().tenKhachHang("Nam").soDienThoai("0123456789").build()))
                .getMessage().equals("Nhập di động 10 số hoặc máy bàn 11 số"));
        // Không nhận số tổng đài
        assertEquals("Nhập di động 10 số hoặc máy bàn 11 số", assertThrows(CommonException.class,
                () -> service.quickCreateForPos(PosQuickCustomerCreating.builder()
                        .tenKhachHang("Nam").soDienThoai("1900 1234").build())).getMessage());
        assertEquals("Tên khách hàng chỉ gồm chữ cái và dấu cách", assertThrows(CommonException.class,
                () -> service.quickCreateForPos(PosQuickCustomerCreating.builder()
                        .tenKhachHang("Khách 1").soDienThoai("0912345678").build())).getMessage());

        when(repository.existsByMaKhachHang(anyString())).thenReturn(false);
        service.quickCreateForPos(PosQuickCustomerCreating.builder()
                .tenKhachHang("  Lê   Hoa ").soDienThoai("02838123456").build());
        KhachHang saved = savedEntity();
        assertEquals("Lê Hoa", saved.getTenKhachHang());
        assertEquals("02838123456", saved.getSoDienThoai());
    }

    @Test
    void posThemNhanh_sdtDaCoDangPlus84_409KemKhachCu() {
        when(repository.timTrungSoDienThoai("0912345678", null))
                .thenReturn(Optional.of(khach(11, "Nguyễn Anh")));
        CommonException ex = assertThrows(CommonException.class, () -> service.quickCreateForPos(
                PosQuickCustomerCreating.builder().tenKhachHang("Lê Hoa").soDienThoai("+84912345678").build()));
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
    }

    // ── Số điện thoại ──

    @Test
    void them_khongNhanTongDaiVaDauSoLa_nhanDiDongVaMayBan() {
        for (String sdt : new String[]{"19001234", "1800 123 456", "0412345678"}) {
            assertEquals("Nhập di động 10 số hoặc máy bàn 11 số", loiTao(KhachHangCreating.builder()
                    .tenKhachHang("Nguyễn An").soDienThoai(sdt).build()), sdt);
        }

        when(repository.existsByMaKhachHang(anyString())).thenReturn(false);
        assertDoesNotThrow(() -> service.create(KhachHangCreating.builder()
                .tenKhachHang("Nguyễn An").soDienThoai("02363888999").build()));
    }

    @Test
    void sua_soTongDaiCu_khongChanSuaOKhac() {
        KhachHang cu = khach(14, "Nguyễn Văn Nam");
        cu.setSoDienThoai("1900 1234");
        when(repository.findById(14)).thenReturn(Optional.of(cu));
        assertDoesNotThrow(() -> service.update(14, KhachHangUpdating.builder().diaChi("Đà Nẵng").build()));
    }

    @Test
    void sua_tenCuChiKhacKhoangTrang_khongTinhLaDoi() {
        KhachHang cu = khach(13, "Khách  0912");
        when(repository.findById(13)).thenReturn(Optional.of(cu));
        assertDoesNotThrow(() -> service.update(13, KhachHangUpdating.builder().tenKhachHang("Khách 0912").build()));
    }

    @Test
    void timTrungSoDienThoai_tongDaiKhongSinhDang84() {
        when(repository.timTrungSoDienThoai(anyString(), any())).thenCallRealMethod();
        repository.timTrungSoDienThoai("1900123456", null);
        verify(repository).timTrungSoDienThoaiHaiDang("1900123456", "1900123456", null);
        repository.timTrungSoDienThoai("0912345678", 4);
        verify(repository).timTrungSoDienThoaiHaiDang("0912345678", "84912345678", 4);
    }
}
