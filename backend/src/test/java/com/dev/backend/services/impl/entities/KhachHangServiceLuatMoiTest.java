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
import com.dev.backend.utils.MaSoThue;
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
 * Luật kiểm ô 17/11: tên theo loại khách, người liên hệ theo luật họ tên, mã số thuế có số kiểm tra và không trùng,
 * email chặt hơn, mã nhập tay mở đầu bằng chữ / số, trùng số điện thoại so trên số đã chuẩn hóa, POS thêm nhanh
 * cùng luật. Cùng bộ ca với frontend quyTacKhachHangLuatMoi.test.js.
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

    private KhachHangCreating.KhachHangCreatingBuilder moi(String ten, String loai) {
        return KhachHangCreating.builder().maKhachHang("KHX").tenKhachHang(ten).loaiKhachHang(loai).soDienThoai("0990123456");
    }

    private String loiTao(KhachHangCreating creating) {
        return assertThrows(CommonException.class, () -> service.create(creating)).getMessage();
    }

    private KhachHang savedEntity() {
        ArgumentCaptor<KhachHang> captor = ArgumentCaptor.forClass(KhachHang.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    private KhachHang khach(int id, String ten, String loai) {
        return KhachHang.builder().id(id).maKhachHang("KH" + id).tenKhachHang(ten).loaiKhachHang(loai)
                .soDienThoai("0912345678").trangThai(1).build();
    }

    // ── Tên ──

    @Test
    void tenKhachLe_chanSoKyTuLaVaMotKyTu() {
        for (String ten : new String[]{"12345", "@@@ !!!", "Nam 0912", "=HYPERLINK(\"x\")"}) {
            assertEquals("Tên khách lẻ chỉ gồm chữ cái và dấu cách", loiTao(moi(ten, "le").build()), ten);
        }
        assertEquals("Tên khách hàng cần ít nhất 2 ký tự", loiTao(moi("A", "le").build()));
    }

    @Test
    void tenKhachLe_hopLe_chuanHoaKhoangTrangVaKyTuVoHinh() {
        service.create(moi("  Đỗ    Văn ​  Nam ", "le").build());
        assertEquals("Đỗ Văn Nam", savedEntity().getTenKhachHang());
    }

    @Test
    void tenToChuc_nhanSoVaKyTuThuongGap_chanMoDauBangDauBang() {
        for (String loai : new String[]{"si", "doanh_nghiep"}) {
            for (String ten : new String[]{"=HYPERLINK(1)", "-Shop", "²Shop"}) {
                assertEquals("Tên mở đầu bằng chữ hoặc số", loiTao(moi(ten, loai).build()), loai + " " + ten);
            }
            assertEquals("Tên chỉ gồm chữ, số và & , . ( ) / - '", loiTao(moi("Shop #1", loai).build()));
            assertEquals("Tên cần có ít nhất một chữ cái", loiTao(moi("12345", loai).build()));
        }
        service.create(moi("Công ty TNHH 3A & Cộng sự (Q.1)", "doanh_nghiep").build());
        assertEquals("Công ty TNHH 3A & Cộng sự (Q.1)", savedEntity().getTenKhachHang());
    }

    @Test
    void tenQuaDai_demTheoKyTu() {
        assertDoesNotThrow(() -> service.create(moi("Ă".repeat(200), "le").build()));
        assertEquals("Tên khách hàng tối đa 200 ký tự", loiTao(moi("Ă".repeat(201), "le").build()));
    }

    @Test
    void sua_tenCuSaiLuat_khongChanSuaOKhac_doiLoaiThiKiemLai() {
        KhachHang cu = khach(3, "Shop A&B", "si");
        when(repository.findById(3)).thenReturn(Optional.of(cu));
        assertDoesNotThrow(() -> service.update(3, KhachHangUpdating.builder().diaChi("1 Lê Lợi").build()));

        KhachHang cu2 = khach(4, "Shop A&B", "si");
        when(repository.findById(4)).thenReturn(Optional.of(cu2));
        CommonException ex = assertThrows(CommonException.class,
                () -> service.update(4, KhachHangUpdating.builder().loaiKhachHang("le").build()));
        assertEquals("Tên khách lẻ chỉ gồm chữ cái và dấu cách", ex.getMessage());
    }

    @Test
    void sua_khachChuaPhanLoai_tenTheoLuatToChuc() {
        KhachHang cu = khach(5, "Khách hàng Shopify", null);
        when(repository.findById(5)).thenReturn(Optional.of(cu));
        assertDoesNotThrow(() -> service.update(5, KhachHangUpdating.builder().tenKhachHang("Anh Tuấn 2").build()));
    }

    // ── Người liên hệ ──

    @Test
    void nguoiLienHe_theoLuatHoTen() {
        assertEquals("Người liên hệ chỉ gồm chữ cái và dấu cách",
                loiTao(moi("Shop A", "si").nguoiLienHe("0909").build()));
        assertEquals("Người liên hệ cần ít nhất 2 ký tự", loiTao(moi("Shop A", "si").nguoiLienHe("M").build()));
        service.create(moi("Shop A", "si").nguoiLienHe("  Trần   Thị Mai ").build());
        assertEquals("Trần Thị Mai", savedEntity().getNguoiLienHe());
    }

    @Test
    void sua_nguoiLienHeCuSaiLuat_khongChanSuaOKhac() {
        KhachHang cu = khach(6, "Shop A", "si");
        cu.setNguoiLienHe("Chị Mai (kho)");
        when(repository.findById(6)).thenReturn(Optional.of(cu));
        assertDoesNotThrow(() -> service.update(6, KhachHangUpdating.builder().diaChi("x").build()));
    }

    // ── Mã số thuế ──

    @Test
    void maSoThue_soKiemTraHauToMaTinh() {
        for (String mst : new String[]{"0100109106", "0300588569", "0101248141", "0100109106-001", "0312345673",
                "001203004567", "096203004567"}) {
            assertTrue(MaSoThue.hopLe(mst), mst);
        }
        for (String mst : new String[]{"0312345678", "0000000000", "0100109106-000", "000203004567", "097203004567"}) {
            assertTrue(MaSoThue.dungDang(mst), mst);
            assertFalse(MaSoThue.hopLe(mst), mst);
        }
        assertEquals("Mã số thuế không hợp lệ, kiểm tra lại từng chữ số",
                loiTao(moi("Công ty A", "doanh_nghiep").maSoThue("0312345678").build()));
        assertTrue(loiTao(moi("Công ty A", "doanh_nghiep").maSoThue("03123").build()).startsWith("Mã số thuế gồm"));
    }

    @Test
    void maSoThue_trungKhachKhac_409() {
        when(repository.findFirstByMaSoThue("0100109106"))
                .thenReturn(Optional.of(khach(9, "Công ty B", "doanh_nghiep")));
        CommonException ex = assertThrows(CommonException.class,
                () -> service.create(moi("Công ty A", "doanh_nghiep").maSoThue("0100109106").build()));
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertEquals("Mã số thuế đã thuộc khách hàng Công ty B (KH9)", ex.getMessage());
    }

    @Test
    void sua_maSoThueCuSaiKhongChan_doiThiKiemTrungBoQuaChinhMinh() {
        KhachHang cu = khach(7, "Công ty C", "doanh_nghiep");
        cu.setMaSoThue("0312345678");
        when(repository.findById(7)).thenReturn(Optional.of(cu));
        assertDoesNotThrow(() -> service.update(7, KhachHangUpdating.builder().diaChi("2 Lê Lợi").build()));
        verify(repository, never()).findFirstByMaSoThueAndIdNot(anyString(), any());

        KhachHang cu2 = khach(8, "Công ty D", "doanh_nghiep");
        when(repository.findById(8)).thenReturn(Optional.of(cu2));
        service.update(8, KhachHangUpdating.builder().maSoThue("0100109106").build());
        verify(repository).findFirstByMaSoThueAndIdNot("0100109106", 8);
    }

    // ── Email, mã ──

    @Test
    void email_chanDangSai() {
        for (String email : new String[]{"a@gmail..com", "a@b.c", ".nam@gmail.com", "nam.@gmail.com", "nam@côngty.vn",
                "nam@-congty.vn", "nam@congty"}) {
            assertEquals("Email chưa đúng, VD: ten@congty.vn", loiTao(moi("Đỗ Nam", "le").email(email).build()), email);
        }
        assertDoesNotThrow(() -> service.create(moi("Đỗ Nam", "le").email("Nam_Do+shop@cong-ty.com.vn").build()));
    }

    @Test
    void maNhapTay_moDauBangChuHoacSo() {
        for (String ma : new String[]{"---", ".KH1", "_A"}) {
            assertTrue(loiTao(moi("Đỗ Nam", "le").maKhachHang(ma).build()).startsWith("Mã khách hàng chỉ gồm"), ma);
        }
    }

    // ── Trùng số điện thoại đã chuẩn hóa, API kiểm trùng ──

    @Test
    void create_sdtCoDauVaPlus84_traTheoSoDaChuanHoa() {
        when(repository.timTrungSoDienThoai("0912345678", null))
                .thenReturn(Optional.of(khach(11, "Nguyễn Anh", "le")));
        CommonException ex = assertThrows(CommonException.class,
                () -> service.create(moi("Đỗ Nam", "le").soDienThoai("+84 912.345.678").build()));
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Nguyễn Anh"));
    }

    @Test
    void timKhachTrung_chuanHoaVaBoQuaGiaTriSaiDang() {
        when(repository.timTrungSoDienThoai("0912345678", 4)).thenReturn(Optional.of(khach(11, "Nguyễn Anh", "le")));
        KhachHangDto dto = service.timKhachTrung("soDienThoai", " 0912 345 678 ", 4);
        assertEquals(11, dto.getId());
        assertNull(service.timKhachTrung("soDienThoai", "0123", null));
        assertNull(service.timKhachTrung("maSoThue", "0312345678", null));
        assertNull(service.timKhachTrung("email", "a@b..vn", null));
        assertNull(service.timKhachTrung("email", "  ", null));
        assertThrows(CommonException.class, () -> service.timKhachTrung("tenKhachHang", "Nam", null));
        verify(repository, never()).findFirstByMaSoThue(anyString());
    }

    // ── POS thêm nhanh ──

    @Test
    void posThemNhanh_cungLuatSdtVaTen() {
        assertTrue(assertThrows(CommonException.class, () -> service.quickCreateForPos(
                PosQuickCustomerCreating.builder().tenKhachHang("Nam").soDienThoai("0123456789").build()))
                .getMessage().equals("Nhập di động 10 số hoặc máy bàn 11 số"));
        // Khách lẻ ở quầy: không nhận số tổng đài
        assertEquals("Nhập di động 10 số hoặc máy bàn 11 số", assertThrows(CommonException.class,
                () -> service.quickCreateForPos(PosQuickCustomerCreating.builder()
                        .tenKhachHang("Nam").soDienThoai("1900 1234").build())).getMessage());
        assertEquals("Tên khách lẻ chỉ gồm chữ cái và dấu cách", assertThrows(CommonException.class,
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
                .thenReturn(Optional.of(khach(11, "Nguyễn Anh", "le")));
        CommonException ex = assertThrows(CommonException.class, () -> service.quickCreateForPos(
                PosQuickCustomerCreating.builder().tenKhachHang("Lê Hoa").soDienThoai("+84912345678").build()));
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
    }

    // ── Số điện thoại theo loại khách ──

    @Test
    void them_khachLeKhongNhanTongDai_khachSiDoanhNghiepNhan() {
        assertEquals("Nhập di động 10 số hoặc máy bàn 11 số", loiTao(KhachHangCreating.builder()
                .tenKhachHang("Nguyễn An").loaiKhachHang("le").soDienThoai("19001234").build()));
        assertEquals("Nhập di động, máy bàn hoặc số 1800/1900", loiTao(KhachHangCreating.builder()
                .tenKhachHang("Shop An").loaiKhachHang("si").soDienThoai("0412345678").build()));

        when(repository.existsByMaKhachHang(anyString())).thenReturn(false);
        assertDoesNotThrow(() -> service.create(KhachHangCreating.builder()
                .tenKhachHang("Công ty An").loaiKhachHang("doanh_nghiep").soDienThoai("1800 123 456").build()));
        assertDoesNotThrow(() -> service.create(KhachHangCreating.builder()
                .tenKhachHang("Nguyễn An").loaiKhachHang("le").soDienThoai("02363888999").build()));
    }

    @Test
    void sua_doiSangKhachLeMaGiuSoTongDai_chan() {
        KhachHang cu = khach(14, "Nguyễn Văn Nam", "si");
        cu.setSoDienThoai("1900 1234");
        when(repository.findById(14)).thenReturn(Optional.of(cu));
        assertEquals("Nhập di động 10 số hoặc máy bàn 11 số", assertThrows(CommonException.class,
                () -> service.update(14, KhachHangUpdating.builder().loaiKhachHang("le").build())).getMessage());
        // Không đổi loại: số tổng đài cũ không chặn việc sửa ô khác
        assertDoesNotThrow(() -> service.update(14, KhachHangUpdating.builder().diaChi("Đà Nẵng").build()));
    }

    @Test
    void sua_doiSangKhachLeSoCuDangPlus84_khongChan() {
        KhachHang cu = khach(15, "Nguyễn Văn Nam", "si");
        cu.setSoDienThoai("+84 912 345 678");
        when(repository.findById(15)).thenReturn(Optional.of(cu));
        assertDoesNotThrow(() -> service.update(15, KhachHangUpdating.builder().loaiKhachHang("le").build()));
    }

    @Test
    void sua_doiSangKhachLe_kiemTenDaChuanHoa() {
        KhachHang cu = khach(12, " Đỗ  Văn Nam​", "si");
        when(repository.findById(12)).thenReturn(Optional.of(cu));
        assertDoesNotThrow(() -> service.update(12, KhachHangUpdating.builder().loaiKhachHang("le").build()));
    }

    @Test
    void sua_tenCuChiKhacKhoangTrang_khongTinhLaDoi() {
        KhachHang cu = khach(13, "Khách  0912", "le");
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
