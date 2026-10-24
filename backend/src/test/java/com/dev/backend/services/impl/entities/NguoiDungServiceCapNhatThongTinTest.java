package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.UpdateMeRequest;
import com.dev.backend.dto.request.UpdateNguoiDungRequest;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.NguoiDungMapper;
import com.dev.backend.repository.NguoiDungRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * PUT /api/v1/nguoi-dung/update: hệ thống không cho đổi email; tên đăng nhập chỉ quản trị viên đổi.
 * Khóa tài khoản: không tự khóa chính mình.
 */
class NguoiDungServiceCapNhatThongTinTest {

    private NguoiDungRepository repository;
    private NguoiDungService service;
    private NguoiDung nhanVien;
    private NguoiDung admin;

    @BeforeEach
    void setUp() {
        repository = mock(NguoiDungRepository.class);
        service = new NguoiDungService(repository);
        ReflectionTestUtils.setField(service, "nguoiDungMapper", mock(NguoiDungMapper.class));
        ReflectionTestUtils.setField(service, "nhatKyBaoMatService",
                mock(com.dev.backend.services.impl.utils.NhatKyBaoMatService.class));
        nhanVien = NguoiDung.builder().id(52).tenDangNhap("nhanvienkhotong").hoTen("Trần Văn Bình")
                .email("b@fcentric.net").vaiTro(IRoleType.nhan_vien_kho).trangThai(1).build();
        admin = NguoiDung.builder().id(1).tenDangNhap("admin").hoTen("Nguyễn Quản Trị")
                .email("quantri@fcentric.net").vaiTro(IRoleType.quan_tri_vien).trangThai(1).build();
        when(repository.findById(52)).thenReturn(Optional.of(nhanVien));
        when(repository.findById(1)).thenReturn(Optional.of(admin));
        when(repository.save(any(NguoiDung.class))).thenAnswer(i -> i.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clear();
    }

    private void dangNhap(NguoiDung n) {
        SecurityContextHolder.setUser(NguoiDungAuthInfo.builder().id(n.getId()).vaiTro(Set.of(n.getVaiTro())).build());
    }

    @Test
    @DisplayName("Nhân viên tự đổi email: bị chặn, email giữ nguyên")
    void nhanVienKhongDoiDuocEmail() {
        dangNhap(nhanVien);
        CommonException ex = assertThrows(CommonException.class, () -> service.update(
                UpdateNguoiDungRequest.builder().id(52).email("moi@fcentric.net").build()));
        assertTrue(ex.getMessage().startsWith("Email không đổi được"));
        assertEquals("b@fcentric.net", nhanVien.getEmail());
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("Quản trị viên đổi email người khác: cũng bị chặn")
    void quanTriVienCungKhongDoiDuocEmail() {
        dangNhap(admin);
        assertThrows(CommonException.class, () -> service.update(
                UpdateNguoiDungRequest.builder().id(52).email("moi@fcentric.net").build()));
        assertEquals("b@fcentric.net", nhanVien.getEmail());
    }

    @Test
    @DisplayName("Gửi lại đúng email hiện tại (khác hoa thường) thì không coi là đổi, vẫn lưu họ tên")
    void cungEmailVanLuuDuoc() {
        dangNhap(nhanVien);
        service.update(UpdateNguoiDungRequest.builder().id(52).email("B@FCENTRIC.NET").hoTen("Trần Văn Bình B").build());
        assertEquals("b@fcentric.net", nhanVien.getEmail());
        assertEquals("Trần Văn Bình B", nhanVien.getHoTen());
    }

    @Test
    @DisplayName("Tài khoản chưa có email: được thêm một lần, kiểm định dạng và trùng")
    void chuaCoEmailThiThemDuoc() {
        nhanVien.setEmail(null);
        dangNhap(nhanVien);
        assertThrows(CommonException.class, () -> service.update(
                UpdateNguoiDungRequest.builder().id(52).email("khong-hop-le").build()));
        when(repository.existsByEmail("trung@fcentric.net")).thenReturn(true);
        assertThrows(CommonException.class, () -> service.update(
                UpdateNguoiDungRequest.builder().id(52).email("trung@fcentric.net").build()));
        service.update(UpdateNguoiDungRequest.builder().id(52).email("binh@fcentric.net").build());
        assertEquals("binh@fcentric.net", nhanVien.getEmail());
    }

    @Test
    @DisplayName("Tên đăng nhập: nhân viên không tự đổi được, quản trị viên đổi được")
    void tenDangNhapChiQuanTriVienDoi() {
        dangNhap(nhanVien);
        assertThrows(CommonException.class, () -> service.update(
                UpdateNguoiDungRequest.builder().id(52).tenDangNhap("binh").build()));
        assertEquals("nhanvienkhotong", nhanVien.getTenDangNhap());

        dangNhap(admin);
        service.update(UpdateNguoiDungRequest.builder().id(52).tenDangNhap("binh").build());
        assertEquals("binh", nhanVien.getTenDangNhap());
    }

    @Test
    @DisplayName("Quản trị viên không tự khóa tài khoản của chính mình")
    void khongTuKhoa() {
        dangNhap(admin);
        CommonException ex = assertThrows(CommonException.class, () -> service.toggleStatusByAdmin(1));
        assertEquals("Không thể tự khóa tài khoản của chính mình", ex.getMessage());
        assertEquals(1, admin.getTrangThai());

        service.toggleStatusByAdmin(52);
        assertEquals(0, nhanVien.getTrangThai());
    }

    @Test
    @DisplayName("Hồ sơ: số điện thoại trùng tài khoản khác bị chặn (số điện thoại cũng dùng để đăng nhập)")
    void hoSo_soDienThoaiTrung() {
        dangNhap(nhanVien);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungKhoService", mock(PhanQuyenNguoiDungKhoService.class));
        NguoiDungMapper mapper = mock(NguoiDungMapper.class);
        when(mapper.toDto(any(NguoiDung.class))).thenAnswer(i -> new com.dev.backend.dto.response.entities.NguoiDungDto());
        ReflectionTestUtils.setField(service, "nguoiDungMapper", mapper);
        NguoiDung khac = NguoiDung.builder().id(77).soDienThoai("0912345678").build();
        when(repository.findAllBySoDienThoai("0912345678")).thenReturn(List.of(khac));
        UpdateMeRequest yeuCau = new UpdateMeRequest();
        yeuCau.setHoTen("Trần Văn Bình");
        yeuCau.setSoDienThoai("0912345678");
        CommonException ex = assertThrows(CommonException.class, () -> service.updateMe(yeuCau));
        assertTrue(ex.getMessage().contains("tài khoản khác"), ex.getMessage());

        // Giữ nguyên số của chính mình thì vẫn lưu được
        nhanVien.setSoDienThoai("0912345678");
        when(repository.findAllBySoDienThoai("0912345678")).thenReturn(List.of(nhanVien, khac));
        assertDoesNotThrow(() -> service.updateMe(yeuCau));
    }
}
