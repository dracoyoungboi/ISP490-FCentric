package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhachHangRepository;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Tạo / sửa khách hàng (POST /api/v1/khach-hang/create, PUT /api/v1/khach-hang/{id}):
 * SĐT / email trống không bị coi là trùng nhau, trùng thật thì báo 409 nêu rõ khách đang dùng,
 * dữ liệu cũ không bị sửa thì không bị kiểm tra lại; mã để trống thì tự tạo theo tiền tố trong Cấu hình hệ thống;
 * cần ít nhất số điện thoại hoặc email; số điện thoại nhận di động, máy bàn, tổng đài.
 */
@ExtendWith(MockitoExtension.class)
class KhachHangServiceTest {

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
    }

    private KhachHang khachHang(int id, String ma, String ten, String sdt, String email) {
        return KhachHang.builder()
                .id(id).maKhachHang(ma).tenKhachHang(ten)
                .soDienThoai(sdt).email(email).loaiKhachHang("le").trangThai(1)
                .build();
    }

    private KhachHang savedEntity() {
        ArgumentCaptor<KhachHang> captor = ArgumentCaptor.forClass(KhachHang.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    /** Khách sau khi sửa (update ghi bằng saveAndFlush để trả về đúng giờ cập nhật). */
    private KhachHang updatedEntity() {
        ArgumentCaptor<KhachHang> captor = ArgumentCaptor.forClass(KhachHang.class);
        verify(repository).saveAndFlush(captor.capture());
        return captor.getValue();
    }

    /** save() của JPA với khóa IDENTITY: ghi ngay và gán id. */
    private void luuGanId(int id) {
        when(repository.save(any(KhachHang.class))).thenAnswer(inv -> {
            KhachHang kh = inv.getArgument(0);
            if (kh.getId() == null) kh.setId(id);
            return kh;
        });
    }

    private void tienTo(String giaTri) {
        when(dieuHanhHeThongService.getCauHinhString(
                DieuHanhHeThongServiceImpl.CAU_HINH_MA_KHACH_HANG_TIEN_TO,
                DieuHanhHeThongServiceImpl.MA_KHACH_HANG_TIEN_TO_MAC_DINH)).thenReturn(giaTri);
    }

    // ── Tạo mới ──

    @Test
    void create_sdtTrong_khongKiemTraTrungSdtVaLuuNull() {
        when(repository.existsByMaKhachHang("KH002")).thenReturn(false);

        service.create(KhachHangCreating.builder()
                .maKhachHang(" KH002 ").tenKhachHang("Khách thứ hai")
                .soDienThoai("").email(" b@shop.vn ").nguoiLienHe("").diaChi("")
                .loaiKhachHang("si")
                .build());

        verify(repository, never()).findFirstBySoDienThoai(anyString());
        KhachHang saved = savedEntity();
        assertEquals("KH002", saved.getMaKhachHang());
        assertNull(saved.getSoDienThoai());
        assertEquals("b@shop.vn", saved.getEmail());
        assertNull(saved.getNguoiLienHe());
        assertNull(saved.getDiaChi());
        assertEquals("si", saved.getLoaiKhachHang());
        assertEquals(1, saved.getTrangThai());
    }

    @Test
    void create_khongCoSdtLanEmail_bao400() {
        CommonException ex = assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH002").tenKhachHang("Khách thứ hai").soDienThoai(" ").email("").build()));

        assertEquals(KhachHangService.CAN_LIEN_HE, ex.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void create_khongGuiLoai_macDinhKhachLe() {
        when(repository.existsByMaKhachHang("KH003")).thenReturn(false);

        service.create(KhachHangCreating.builder().maKhachHang("KH003").tenKhachHang("A").soDienThoai("0901234567").build());

        assertEquals("le", savedEntity().getLoaiKhachHang());
    }

    // ── Mã tự tạo ──

    @Test
    void create_maTrong_tuTaoTheoTienToVaId() {
        tienTo("KH");
        luuGanId(124);
        when(repository.existsByMaKhachHang("KH000124")).thenReturn(false);

        var dto = service.create(KhachHangCreating.builder().tenKhachHang("Shop Hoa Mai").email("hoamai@shop.vn").build());

        assertEquals("KH000124", dto.getMaKhachHang());
        assertEquals(124, dto.getId());
        verify(repository, times(2)).save(any(KhachHang.class));
    }

    @Test
    void create_maTrong_tienToDaDoiTrongCauHinh() {
        tienTo("KHS");
        luuGanId(7);
        when(repository.existsByMaKhachHang("KHS000007")).thenReturn(false);

        assertEquals("KHS000007", service.create(KhachHangCreating.builder()
                .maKhachHang("   ").tenKhachHang("A").soDienThoai("0901234567").build()).getMaKhachHang());
    }

    @Test
    void create_maTuTaoTrungMaNhapTay_themHauTo() {
        tienTo("KH");
        luuGanId(124);
        when(repository.existsByMaKhachHang("KH000124")).thenReturn(true);
        when(repository.existsByMaKhachHang("KH000124-1")).thenReturn(false);

        assertEquals("KH000124-1", service.create(KhachHangCreating.builder()
                .tenKhachHang("A").soDienThoai("0901234567").build()).getMaKhachHang());
    }

    @Test
    void create_tienToHongTrongCsdl_dungTienToMacDinh() {
        tienTo("kh mới!");
        luuGanId(5);
        when(repository.existsByMaKhachHang("KH000005")).thenReturn(false);

        assertEquals("KH000005", service.create(KhachHangCreating.builder()
                .tenKhachHang("A").soDienThoai("0901234567").build()).getMaKhachHang());
    }

    @Test
    void create_maNhapTayCoKhoangTrangHoacDau_bao400() {
        assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH 01").tenKhachHang("A").soDienThoai("0901234567").build()));
        assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KHÁCH01").tenKhachHang("A").soDienThoai("0901234567").build()));
        verify(repository, never()).save(any());
    }

    // ── Số điện thoại ──

    @Test
    void create_sdtMayBanVaTongDai_hopLe() {
        when(repository.existsByMaKhachHang(anyString())).thenReturn(false);

        service.create(KhachHangCreating.builder().maKhachHang("KH020").tenKhachHang("A").soDienThoai("02363888999").build());
        service.create(KhachHangCreating.builder().maKhachHang("KH021").tenKhachHang("B").soDienThoai("19001234").build());

        verify(repository, times(2)).save(any(KhachHang.class));
    }

    @Test
    void create_sdtCoDauCachVaDauCong84_chuanHoaVe0() {
        when(repository.existsByMaKhachHang("KH022")).thenReturn(false);

        service.create(KhachHangCreating.builder().maKhachHang("KH022").tenKhachHang("A").soDienThoai("+84 912.345-678").build());

        verify(repository).findFirstBySoDienThoai("0912345678");
        assertEquals("0912345678", savedEntity().getSoDienThoai());
    }

    @Test
    void create_sdtSai_bao400() {
        CommonException ex = assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH023").tenKhachHang("A").soDienThoai("0123").build()));

        assertTrue(ex.getMessage().startsWith("Số điện thoại không hợp lệ"));
        verify(repository, never()).save(any());
    }

    @Test
    void create_trungSdt_bao409NeuTenKhachDangDung() {
        when(repository.existsByMaKhachHang("KH004")).thenReturn(false);
        when(repository.findFirstBySoDienThoai("0901234567"))
                .thenReturn(Optional.of(khachHang(1, "KH001", "Nguyễn Văn A", "0901234567", null)));

        CommonException ex = assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH004").tenKhachHang("B").soDienThoai("0901234567").build()));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Nguyễn Văn A"));
        verify(repository, never()).save(any());
    }

    @Test
    void create_trungEmail_bao409() {
        when(repository.existsByMaKhachHang("KH005")).thenReturn(false);
        when(repository.findFirstByEmail("a@shop.vn"))
                .thenReturn(Optional.of(khachHang(1, "KH001", "Nguyễn Văn A", null, "a@shop.vn")));

        CommonException ex = assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH005").tenKhachHang("B").email("a@shop.vn").build()));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().startsWith("Email"));
    }

    @Test
    void create_trungMa_bao409() {
        when(repository.existsByMaKhachHang("KH001")).thenReturn(true);

        CommonException ex = assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH001").tenKhachHang("B").email("b@shop.vn").build()));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().startsWith("Mã khách hàng KH001"));
        verify(repository, never()).save(any());
    }

    @Test
    void create_thieuTenHoacEmailSaiHoacLoaiLa_bao400() {
        assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH006").tenKhachHang("  ").email("b@shop.vn").build()));
        assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH006").tenKhachHang("B").email("khong-phai-email").build()));
        CommonException loai = assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH006").tenKhachHang("B").email("b@shop.vn").loaiKhachHang("vip").build()));
        assertEquals("Loại khách hàng không hợp lệ", loai.getMessage());
        verify(repository, never()).save(any());
    }

    // ── Sửa ──

    @Test
    void update_sdtCuKhongSua_khongKiemTraLai() {
        // SĐT định dạng cũ (+84...) và đã trùng sẵn trong dữ liệu: không sửa thì vẫn lưu được
        KhachHang entity = khachHang(7, "KH007", "C", "+84901234567", "c@shop.vn");
        when(repository.findById(7)).thenReturn(Optional.of(entity));
        when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(7, KhachHangUpdating.builder()
                .tenKhachHang("C mới").soDienThoai("+84901234567").email("c@shop.vn").loaiKhachHang("doanh_nghiep")
                .build());

        verify(repository, never()).findFirstBySoDienThoaiAndIdNot(anyString(), anyInt());
        verify(repository, never()).findFirstByEmailAndIdNot(anyString(), anyInt());
        KhachHang saved = updatedEntity();
        assertEquals("C mới", saved.getTenKhachHang());
        assertEquals("+84901234567", saved.getSoDienThoai());
        assertEquals("doanh_nghiep", saved.getLoaiKhachHang());
    }

    @Test
    void update_xoaTrangSdtConEmail_luuNull() {
        KhachHang entity = khachHang(8, "KH008", "D", "0901234567", "d@shop.vn");
        when(repository.findById(8)).thenReturn(Optional.of(entity));
        when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(8, KhachHangUpdating.builder().tenKhachHang("D").soDienThoai("").build());

        KhachHang saved = updatedEntity();
        assertNull(saved.getSoDienThoai());
        assertEquals("d@shop.vn", saved.getEmail());
    }

    @Test
    void update_xoaCaSdtLanEmail_bao400() {
        KhachHang entity = khachHang(8, "KH008", "D", "0901234567", "d@shop.vn");
        when(repository.findById(8)).thenReturn(Optional.of(entity));

        CommonException ex = assertThrows(CommonException.class, () -> service.update(8,
                KhachHangUpdating.builder().soDienThoai("").email(" ").build()));

        assertEquals(KhachHangService.CAN_LIEN_HE, ex.getMessage());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void update_khachCuVonKhongCoLienHe_vanSuaDuocOKhac() {
        KhachHang entity = khachHang(13, "KH013", "I", null, null);
        when(repository.findById(13)).thenReturn(Optional.of(entity));
        when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(13, KhachHangUpdating.builder().loaiKhachHang("si").build());

        assertEquals("si", updatedEntity().getLoaiKhachHang());
    }

    @Test
    void update_sdtMoi_chuanHoaVaKiemDinhDang() {
        KhachHang entity = khachHang(14, "KH014", "J", "0901111111", null);
        when(repository.findById(14)).thenReturn(Optional.of(entity));
        when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(14, KhachHangUpdating.builder().soDienThoai("0236 3888 999").build());

        verify(repository).findFirstBySoDienThoaiAndIdNot("02363888999", 14);
        assertEquals("02363888999", updatedEntity().getSoDienThoai());
    }

    @Test
    void update_sdtMoiSai_bao400() {
        when(repository.findById(15)).thenReturn(Optional.of(khachHang(15, "KH015", "K", "0901111111", null)));

        assertThrows(CommonException.class, () -> service.update(15,
                KhachHangUpdating.builder().soDienThoai("090111").build()));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void update_diaChiCuDaiHon500KhongSua_vanLuuDuoc() {
        KhachHang entity = khachHang(17, "KH017", "L", "0901111111", null);
        entity.setDiaChi("x".repeat(600));
        when(repository.findById(17)).thenReturn(Optional.of(entity));
        when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(17, KhachHangUpdating.builder().tenKhachHang("L mới").build());

        assertEquals("L mới", updatedEntity().getTenKhachHang());
    }

    @Test
    void update_diaChiMoiDaiHon500_bao400() {
        when(repository.findById(18)).thenReturn(Optional.of(khachHang(18, "KH018", "M", "0901111111", null)));

        assertThrows(CommonException.class, () -> service.update(18,
                KhachHangUpdating.builder().diaChi("x".repeat(501)).build()));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void update_truongNull_giuNguyen() {
        KhachHang entity = khachHang(9, "KH009", "E", "0901234567", "e@shop.vn");
        when(repository.findById(9)).thenReturn(Optional.of(entity));
        when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(9, KhachHangUpdating.builder().trangThai(0).build());

        KhachHang saved = updatedEntity();
        assertEquals("E", saved.getTenKhachHang());
        assertEquals("0901234567", saved.getSoDienThoai());
        assertEquals("e@shop.vn", saved.getEmail());
        assertEquals(0, saved.getTrangThai());
    }

    @Test
    void update_doiSangSdtCuaKhachKhac_bao409() {
        KhachHang entity = khachHang(10, "KH010", "F", "0901111111", null);
        when(repository.findById(10)).thenReturn(Optional.of(entity));
        when(repository.findFirstBySoDienThoaiAndIdNot("0902222222", 10))
                .thenReturn(Optional.of(khachHang(11, "KH011", "Trần Thị G", "0902222222", null)));

        CommonException ex = assertThrows(CommonException.class, () -> service.update(10,
                KhachHangUpdating.builder().tenKhachHang("F").soDienThoai("0902222222").build()));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains("Trần Thị G"));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void update_xoaTrangTen_bao400() {
        when(repository.findById(12)).thenReturn(Optional.of(khachHang(12, "KH012", "H", null, null)));

        assertThrows(CommonException.class, () -> service.update(12,
                KhachHangUpdating.builder().tenKhachHang("   ").build()));
        verify(repository, never()).saveAndFlush(any());
    }

    // ── Mã số thuế (in ở mục Người mua của hóa đơn bán hàng) ──

    @Test
    void create_maSoThueSaiDinhDang_bao400KhongLuu() {
        CommonException ex = assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH010").tenKhachHang("Công ty A").email("a@congty.vn").maSoThue("03123").build()));

        assertEquals(KhachHangService.MA_SO_THUE_MESSAGE, ex.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void create_maSoThueHopLe_luuDaBoKhoangTrang() {
        when(repository.existsByMaKhachHang("KH011")).thenReturn(false);

        service.create(KhachHangCreating.builder()
                .maKhachHang("KH011").tenKhachHang("Công ty B").email("b@congty.vn")
                .maSoThue(" 0312345678-001 ").loaiKhachHang("doanh_nghiep").build());

        assertEquals("0312345678-001", savedEntity().getMaSoThue());
    }

    @Test
    void update_maSoThueMoiSaiDinhDang_bao400KhongLuu() {
        KhachHang entity = khachHang(20, "KH020", "Công ty N", "0901111111", null);
        entity.setMaSoThue("0312345678");
        when(repository.findById(20)).thenReturn(Optional.of(entity));

        CommonException ex = assertThrows(CommonException.class, () -> service.update(20,
                KhachHangUpdating.builder().maSoThue("0312345678-1").build()));

        assertEquals(KhachHangService.MA_SO_THUE_MESSAGE, ex.getMessage());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void update_maSoThueCuSaiDinhDangKhongSua_vanSuaDuocOKhac() {
        // Mã cũ sai định dạng (nhập thẳng vào CSDL): gửi lại đúng mã đang lưu hoặc không gửi thì không kiểm lại
        KhachHang entity = khachHang(21, "KH021", "Công ty O", "0901111111", null);
        entity.setMaSoThue("03123");
        when(repository.findById(21)).thenReturn(Optional.of(entity));
        when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(21, KhachHangUpdating.builder().tenKhachHang("Công ty O mới").maSoThue("03123").build());

        KhachHang saved = updatedEntity();
        assertEquals("Công ty O mới", saved.getTenKhachHang());
        assertEquals("03123", saved.getMaSoThue());
    }

    @Test
    void update_maSoThueChuoiRong_xoaVeNull() {
        KhachHang entity = khachHang(22, "KH022", "Công ty P", "0901111111", null);
        entity.setMaSoThue("0312345678");
        when(repository.findById(22)).thenReturn(Optional.of(entity));
        when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(22, KhachHangUpdating.builder().maSoThue("").build());

        assertNull(updatedEntity().getMaSoThue());
    }

    @Test
    void update_khongGuiMaSoThue_giuNguyen() {
        KhachHang entity = khachHang(23, "KH023", "Công ty Q", "0901111111", null);
        entity.setMaSoThue("0312345678-001");
        when(repository.findById(23)).thenReturn(Optional.of(entity));
        when(repository.saveAndFlush(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(23, KhachHangUpdating.builder().tenKhachHang("Công ty Q mới").build());

        assertEquals("0312345678-001", updatedEntity().getMaSoThue());
    }
}
