package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.TepTin;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

/**
 * Test mapping ảnh đại diện: avatarTepTin.duongDan -> avatarUrl phải qua chuẩn
 * hoá origin legacy MinIO -> HTTPS; không có tep_tin -> avatarUrl null và các
 * field khác giữ nguyên.
 */
@ExtendWith(MockitoExtension.class)
class NguoiDungMapperTest {

    private final NguoiDungMapper mapper = new NguoiDungMapperImpl();

    @Mock
    private PhanQuyenNguoiDungKhoMapper phanQuyenNguoiDungKhoMapper;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(mapper, "phanQuyenNguoiDungKhoMapper", phanQuyenNguoiDungKhoMapper);
        when(phanQuyenNguoiDungKhoMapper.toDtoList(isNull())).thenReturn(null);
    }

    @Test
    void toDto_avatarTuTepTinLegacy_doiSangHttps() {
        NguoiDung user = NguoiDung.builder()
                .id(1).tenDangNhap("khang").hoTen("Nguyễn Đăng Khang").vaiTro("quan_tri_vien")
                .avatarTepTin(TepTin.builder()
                        .id(10)
                        .duongDan("http://171.244.142.43:9000/fashion/avatars/abc.png")
                        .build())
                .build();

        NguoiDungDto dto = mapper.toDto(user);

        assertEquals("https://minio.slmglobal.vn/fashion/avatars/abc.png", dto.getAvatarUrl());
    }

    @Test
    void toDto_avatarHttpsSan_giuNguyen() {
        NguoiDung user = NguoiDung.builder()
                .id(2).tenDangNhap("minh").hoTen("Minh").vaiTro("nhan_vien_kho")
                .avatarTepTin(TepTin.builder()
                        .id(11)
                        .duongDan("https://minio.slmglobal.vn/fashion/avatars/xyz.webp")
                        .build())
                .build();

        assertEquals("https://minio.slmglobal.vn/fashion/avatars/xyz.webp",
                mapper.toDto(user).getAvatarUrl());
    }

    @Test
    void toDto_khongCoTepTin_avatarNull_vaFieldKhacGiNguyen() {
        NguoiDung user = NguoiDung.builder()
                .id(3).tenDangNhap("tam").hoTen("Văn Tâm").vaiTro("nhan_vien_ban_hang")
                .email("tam@fcentric.vn")
                .build();

        NguoiDungDto dto = mapper.toDto(user);

        assertNull(dto.getAvatarUrl());
        assertEquals("Văn Tâm", dto.getHoTen());
        assertEquals("tam@fcentric.vn", dto.getEmail());
        assertEquals(3, dto.getId());
    }
}
