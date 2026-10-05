package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.TepTin;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.NguoiDungMapperImpl;
import com.dev.backend.mapper.PhanQuyenNguoiDungKhoMapper;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.MinioService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test upload/xóa ảnh đại diện của người đang đăng nhập (user luôn lấy từ
 * context đăng nhập, không nhận id từ client): thay ảnh, xóa ảnh, lỗi DB giữ
 * ảnh cũ + dọn object mồ côi, không xóa tệp đang được chia sẻ, avatarUrl trả
 * về chuẩn hóa HTTPS. MinIO/repository mock — không đụng DB/MinIO thật.
 */
@ExtendWith(MockitoExtension.class)
class NguoiDungServiceAvatarTest {

    private static final int CONTEXT_USER_ID = 7;
    private static final String OLD_OBJECT = "avatars/cu.png";
    private static final String NEW_OBJECT = "avatars/moi.png";

    @Mock
    private NguoiDungRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private MinioService minioService;
    @Mock
    private TepTinService tepTinService;
    @Mock
    private PhanQuyenNguoiDungKhoService phanQuyenNguoiDungKhoService;
    @Mock
    private PhanQuyenNguoiDungKhoMapper phanQuyenNguoiDungKhoMapper;

    private NguoiDungService service;

    @BeforeEach
    void setUp() {
        NguoiDungMapperImpl mapper = new NguoiDungMapperImpl();
        ReflectionTestUtils.setField(mapper, "phanQuyenNguoiDungKhoMapper", phanQuyenNguoiDungKhoMapper);
        // lenient: chỉ những test xây DTO mới gọi tới mapper này
        lenient().when(phanQuyenNguoiDungKhoMapper.toDtoList(isNull())).thenReturn(null);

        service = new NguoiDungService(repository);
        ReflectionTestUtils.setField(service, "nguoiDungMapper", mapper);
        ReflectionTestUtils.setField(service, "minioService", minioService);
        ReflectionTestUtils.setField(service, "tepTinService", tepTinService);
        ReflectionTestUtils.setField(service, "phanQuyenNguoiDungKhoService", phanQuyenNguoiDungKhoService);
    }

    private static MockMultipartFile validPng() throws Exception {
        BufferedImage image = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return new MockMultipartFile("file", "anh.png", "image/png", out.toByteArray());
    }

    private NguoiDung userWithOldAvatar() {
        return NguoiDung.builder()
                .id(CONTEXT_USER_ID).tenDangNhap("khang").hoTen("Nguyễn Đăng Khang")
                .vaiTro("quan_tri_vien")
                .avatarTepTin(TepTin.builder().id(10).tenLuuTru(OLD_OBJECT)
                        .duongDan("http://171.244.142.43:9000/fashion/" + OLD_OBJECT).build())
                .build();
    }

    private void stubUploadSuccess() throws Exception {
        when(minioService.upload(any(MultipartFile.class), anyString())).thenReturn(NEW_OBJECT);
        when(minioService.getPublicUrl(NEW_OBJECT))
                .thenReturn("http://171.244.142.43:9000/fashion/" + NEW_OBJECT);
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void updateMyAvatar_taiAnhMoi_traVeAvatarHttps_vaDonDepAnhCu() throws Exception {
        NguoiDung user = userWithOldAvatar();
        when(repository.findById(CONTEXT_USER_ID)).thenReturn(Optional.of(user));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        stubUploadSuccess();

        try (MockedStatic<com.dev.backend.config.SecurityContextHolder> ctx =
                     mockStatic(com.dev.backend.config.SecurityContextHolder.class)) {
            ctx.when(com.dev.backend.config.SecurityContextHolder::getUser)
                    .thenReturn(NguoiDungAuthInfo.builder().id(CONTEXT_USER_ID).build());

            ResponseData<NguoiDungDto> res = service.updateMyAvatar(validPng()).getBody();

            assertEquals(HttpStatus.OK.value(), res.getStatus());
            assertEquals("https://minio.slmglobal.vn/fashion/" + NEW_OBJECT, res.getData().getAvatarUrl());
            assertNotNull(user.getAvatarTepTin());
            assertEquals(NEW_OBJECT, user.getAvatarTepTin().getTenLuuTru());
        }

        // Tệp cũ bị xóa sau khi đã gắn tệp mới thành công (dòng tep_tin + object)
        verify(tepTinService).hardDeleteNoMessage(10);
        verify(minioService).upload(any(MultipartFile.class), startsWith("avatars/"));
    }

    @Test
    void updateMyAvatar_luuDbLoi_giuAnhCu_vaXoaObjectMoi() throws Exception {
        NguoiDung user = userWithOldAvatar();
        when(repository.findById(CONTEXT_USER_ID)).thenReturn(Optional.of(user));
        when(repository.save(any())).thenThrow(new RuntimeException("db down"));
        stubUploadSuccess();

        try (MockedStatic<com.dev.backend.config.SecurityContextHolder> ctx =
                     mockStatic(com.dev.backend.config.SecurityContextHolder.class)) {
            ctx.when(com.dev.backend.config.SecurityContextHolder::getUser)
                    .thenReturn(NguoiDungAuthInfo.builder().id(CONTEXT_USER_ID).build());

            CommonException ex = assertThrows(CommonException.class, () -> service.updateMyAvatar(validPng()));

            assertEquals("Lưu ảnh đại diện thất bại. Vui lòng thử lại", ex.getMessage());
        }

        // Object mới mồ côi được dọn; ảnh cũ KHÔNG bị xóa (DB chưa commit thay đổi —
        // trong môi trường thật transaction rollback sẽ giữ nguyên avatar cũ trong DB)
        verify(minioService).delete(NEW_OBJECT);
        verify(tepTinService, never()).hardDeleteNoMessage(anyInt());
    }

    @Test
    void updateMyAvatar_tepTinCuDangChiaSe_khongXoaTepCu() throws Exception {
        NguoiDung user = userWithOldAvatar();
        when(repository.findById(CONTEXT_USER_ID)).thenReturn(Optional.of(user));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(repository.existsByAvatarTepTinId(10)).thenReturn(true); // người dùng khác vẫn tham chiếu
        stubUploadSuccess();

        try (MockedStatic<com.dev.backend.config.SecurityContextHolder> ctx =
                     mockStatic(com.dev.backend.config.SecurityContextHolder.class)) {
            ctx.when(com.dev.backend.config.SecurityContextHolder::getUser)
                    .thenReturn(NguoiDungAuthInfo.builder().id(CONTEXT_USER_ID).build());

            service.updateMyAvatar(validPng());
        }

        verify(tepTinService, never()).hardDeleteNoMessage(anyInt());
    }

    @Test
    void updateMyAvatar_validateLoi_khongUpload_khongDocDb() throws Exception {
        MockMultipartFile garbage = new MockMultipartFile(
                "file", "a.jpg", "image/jpeg", "day khong phai anh".getBytes());

        CommonException ex = assertThrows(CommonException.class, () -> service.updateMyAvatar(garbage));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verifyNoInteractions(minioService);
        verify(repository, never()).findById(any());
        verify(repository, never()).save(any());
    }

    @Test
    void updateMyAvatar_contextRong_biTuChoi_khongUpload() throws Exception {
        try (MockedStatic<com.dev.backend.config.SecurityContextHolder> ctx =
                     mockStatic(com.dev.backend.config.SecurityContextHolder.class)) {
            ctx.when(com.dev.backend.config.SecurityContextHolder::getUser).thenReturn(null);

            CommonException ex = assertThrows(CommonException.class, () -> service.updateMyAvatar(validPng()));

            assertEquals("Phiên đăng nhập không hợp lệ", ex.getMessage());
        }
        verifyNoInteractions(minioService);
    }

    @Test
    void removeMyAvatar_xoaAnh_vaDonDepTepCu() {
        NguoiDung user = userWithOldAvatar();
        when(repository.findById(CONTEXT_USER_ID)).thenReturn(Optional.of(user));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        try (MockedStatic<com.dev.backend.config.SecurityContextHolder> ctx =
                     mockStatic(com.dev.backend.config.SecurityContextHolder.class)) {
            ctx.when(com.dev.backend.config.SecurityContextHolder::getUser)
                    .thenReturn(NguoiDungAuthInfo.builder().id(CONTEXT_USER_ID).build());

            ResponseData<NguoiDungDto> res = service.removeMyAvatar().getBody();

            assertEquals(HttpStatus.OK.value(), res.getStatus());
            assertNull(res.getData().getAvatarUrl());
            assertNull(user.getAvatarTepTin());
        }

        verify(tepTinService).hardDeleteNoMessage(10);
    }

    @Test
    void removeMyAvatar_chuaCoAnh_thanhCongIdempotent_khongDonDep() {
        NguoiDung user = NguoiDung.builder()
                .id(CONTEXT_USER_ID).tenDangNhap("khang").hoTen("Nguyễn Đăng Khang")
                .vaiTro("quan_tri_vien")
                .build();
        when(repository.findById(CONTEXT_USER_ID)).thenReturn(Optional.of(user));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        try (MockedStatic<com.dev.backend.config.SecurityContextHolder> ctx =
                     mockStatic(com.dev.backend.config.SecurityContextHolder.class)) {
            ctx.when(com.dev.backend.config.SecurityContextHolder::getUser)
                    .thenReturn(NguoiDungAuthInfo.builder().id(CONTEXT_USER_ID).build());

            ResponseData<NguoiDungDto> res = service.removeMyAvatar().getBody();

            assertEquals(HttpStatus.OK.value(), res.getStatus());
            assertNull(res.getData().getAvatarUrl());
        }

        verify(tepTinService, never()).hardDeleteNoMessage(anyInt());
    }

    @Test
    void avatarEndpoints_luonDungUserIdTuContext_khongNhanIdTuClient() throws Exception {
        // Endpoint /me/avatar không có tham số id nào — verify service chỉ đọc
        // user id 7 từ context đăng nhập (không có đường nào nhận id từ request).
        NguoiDung user = userWithOldAvatar();
        when(repository.findById(CONTEXT_USER_ID)).thenReturn(Optional.of(user));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        stubUploadSuccess();

        try (MockedStatic<com.dev.backend.config.SecurityContextHolder> ctx =
                     mockStatic(com.dev.backend.config.SecurityContextHolder.class)) {
            ctx.when(com.dev.backend.config.SecurityContextHolder::getUser)
                    .thenReturn(NguoiDungAuthInfo.builder().id(CONTEXT_USER_ID).build());

            service.updateMyAvatar(validPng());
            service.removeMyAvatar();
        }

        // Cả 2 lần đọc user đều dùng đúng id 7 từ context — không có id nào khác được đọc
        verify(repository, times(2)).findById(CONTEXT_USER_ID);
    }
}
