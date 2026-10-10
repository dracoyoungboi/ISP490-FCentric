package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhachHangCreating;
import com.dev.backend.dto.request.KhachHangUpdating;
import com.dev.backend.entities.KhachHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhachHangMapper;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KhachHangRepository;
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
 * dữ liệu cũ không bị sửa thì không bị kiểm tra lại.
 */
@ExtendWith(MockitoExtension.class)
class KhachHangServiceTest {

    @Mock
    private KhachHangRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private DonBanHangRepository donBanHangRepository;

    private KhachHangService service;

    @BeforeEach
    void setUp() {
        KhachHangMapper mapper = Mappers.getMapper(KhachHangMapper.class);
        service = new KhachHangService(repository, mapper, entityManager, donBanHangRepository);
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

    // ── Tạo mới ──

    @Test
    void create_emailVaSdtTrong_khongKiemTraTrungVaLuuNull() {
        when(repository.existsByMaKhachHang("KH002")).thenReturn(false);

        service.create(KhachHangCreating.builder()
                .maKhachHang(" KH002 ").tenKhachHang("Khách thứ hai")
                .soDienThoai("").email("   ").nguoiLienHe("").diaChi("")
                .loaiKhachHang("si")
                .build());

        verify(repository, never()).findFirstBySoDienThoai(anyString());
        verify(repository, never()).findFirstByEmail(anyString());
        KhachHang saved = savedEntity();
        assertEquals("KH002", saved.getMaKhachHang());
        assertNull(saved.getSoDienThoai());
        assertNull(saved.getEmail());
        assertNull(saved.getNguoiLienHe());
        assertNull(saved.getDiaChi());
        assertEquals("si", saved.getLoaiKhachHang());
        assertEquals(1, saved.getTrangThai());
    }

    @Test
    void create_khongGuiLoai_macDinhKhachLe() {
        when(repository.existsByMaKhachHang("KH003")).thenReturn(false);

        service.create(KhachHangCreating.builder().maKhachHang("KH003").tenKhachHang("A").build());

        assertEquals("le", savedEntity().getLoaiKhachHang());
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
                .maKhachHang("KH001").tenKhachHang("B").build()));

        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        verify(repository, never()).save(any());
    }

    @Test
    void create_thieuTenHoacEmailSaiHoacLoaiLa_bao400() {
        assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH006").tenKhachHang("  ").build()));
        assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH006").tenKhachHang("B").email("khong-phai-email").build()));
        when(repository.existsByMaKhachHang("KH006")).thenReturn(false);
        assertThrows(CommonException.class, () -> service.create(KhachHangCreating.builder()
                .maKhachHang("KH006").tenKhachHang("B").loaiKhachHang("vip").build()));
        verify(repository, never()).save(any());
    }

    // ── Sửa ──

    @Test
    void update_sdtCuKhongSua_khongKiemTraLai() {
        // SĐT định dạng cũ (+84...) và đã trùng sẵn trong dữ liệu: không sửa thì vẫn lưu được
        KhachHang entity = khachHang(7, "KH007", "C", "+84901234567", "c@shop.vn");
        when(repository.findById(7)).thenReturn(Optional.of(entity));
        when(repository.save(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(7, KhachHangUpdating.builder()
                .tenKhachHang("C mới").soDienThoai("+84901234567").email("c@shop.vn").loaiKhachHang("doanh_nghiep")
                .build());

        verify(repository, never()).findFirstBySoDienThoaiAndIdNot(anyString(), anyInt());
        verify(repository, never()).findFirstByEmailAndIdNot(anyString(), anyInt());
        KhachHang saved = savedEntity();
        assertEquals("C mới", saved.getTenKhachHang());
        assertEquals("+84901234567", saved.getSoDienThoai());
        assertEquals("doanh_nghiep", saved.getLoaiKhachHang());
    }

    @Test
    void update_xoaTrangSdtVaEmail_luuNull() {
        KhachHang entity = khachHang(8, "KH008", "D", "0901234567", "d@shop.vn");
        when(repository.findById(8)).thenReturn(Optional.of(entity));
        when(repository.save(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(8, KhachHangUpdating.builder().tenKhachHang("D").soDienThoai("").email(" ").build());

        KhachHang saved = savedEntity();
        assertNull(saved.getSoDienThoai());
        assertNull(saved.getEmail());
    }

    @Test
    void update_truongNull_giuNguyen() {
        KhachHang entity = khachHang(9, "KH009", "E", "0901234567", "e@shop.vn");
        when(repository.findById(9)).thenReturn(Optional.of(entity));
        when(repository.save(any(KhachHang.class))).thenAnswer(inv -> inv.getArgument(0));

        service.update(9, KhachHangUpdating.builder().trangThai(0).build());

        KhachHang saved = savedEntity();
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
        verify(repository, never()).save(any());
    }

    @Test
    void update_xoaTrangTen_bao400() {
        when(repository.findById(12)).thenReturn(Optional.of(khachHang(12, "KH012", "H", null, null)));

        assertThrows(CommonException.class, () -> service.update(12,
                KhachHangUpdating.builder().tenKhachHang("   ").build()));
        verify(repository, never()).save(any());
    }
}
