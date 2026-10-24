package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.FileObjectInfo;
import com.dev.backend.dto.response.entities.ThuongHieuDto;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.ThuongHieu;
import com.dev.backend.mapper.ThuongHieuMapper;
import com.dev.backend.mapper.ThuongHieuMapperImpl;
import com.dev.backend.repository.ThuongHieuRepository;
import com.dev.backend.services.MinioService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.dev.backend.exception.customize.CommonException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Test response upload logo thương hiệu: mapper thật + storage/repository mock,
 * logoUrl trả về phải là HTTPS (origin legacy đã được chuẩn hoá).
 */
@ExtendWith(MockitoExtension.class)
class ThuongHieuServiceTest {

    // Chữ ký PNG: máy chủ nhận dạng ảnh theo byte đầu tệp
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D};

    @Mock
    private ThuongHieuRepository repository;
    @Mock
    private EntityManager entityManager;
    @Mock
    private MinioService minioService;
    @Mock
    private TepTinService tepTinService;

    private ThuongHieuService service;

    @BeforeEach
    void setUp() {
        ThuongHieuMapper mapper = new ThuongHieuMapperImpl();
        service = new ThuongHieuService(repository, mapper, entityManager);
        ReflectionTestUtils.setField(service, "minioService", minioService);
        ReflectionTestUtils.setField(service, "tepTinService", tepTinService);
    }

    @Test
    void updateLogo_traVeLogoHttps_tuUploadMoi() throws Exception {
        ThuongHieu brand = ThuongHieu.builder()
                .id(1).maThuongHieu("NK").tenThuongHieu("Nike")
                .build();
        when(repository.findById(1)).thenReturn(Optional.of(brand));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(minioService.upload(any())).thenReturn("fashion/brands/nike-new.png");
        when(minioService.getObjectInfo("fashion/brands/nike-new.png"))
                .thenReturn(FileObjectInfo.builder()
                        .userMetadata(Map.of("file-extension", "png"))
                        .build());
        when(minioService.getPublicUrl("fashion/brands/nike-new.png"))
                .thenReturn("http://171.244.142.43:9000/fashion/brands/nike-new.png");
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> inv.getArgument(0));

        MultipartFile file = new MockMultipartFile("file", "logo.png", "image/png", PNG);

        ThuongHieuDto dto = service.updateLogo(1, file);

        assertEquals("https://minio.slmglobal.vn/fashion/brands/nike-new.png", dto.getLogoUrl());
        verify(tepTinService).create(any(TepTin.class));
    }

    @Test
    void updateLogo_svgKhaiLaAnh_biTuChoi_khongTaiLen() throws Exception {
        // Trước đây chỉ kiểm Content-Type bắt đầu bằng "image/" → image/svg+xml (chạy được script) lọt qua
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes();
        for (MultipartFile file : new MultipartFile[]{
                new MockMultipartFile("file", "logo.svg", "image/svg+xml", svg),
                new MockMultipartFile("file", "logo.png", "image/png", svg)}) {
            CommonException loi = assertThrows(CommonException.class, () -> service.updateLogo(1, file));
            assertTrue(loi.getMessage().startsWith("Tệp logo phải là ảnh"), loi.getMessage());
        }
        verify(minioService, never()).upload(any());
        verifyNoInteractions(repository);
    }

    @Test
    void updateLogo_vuotGioiHan_biTuChoi() throws Exception {
        byte[] lon = Arrays.copyOf(PNG, (int) ThuongHieuService.LOGO_TOI_DA_BYTE + 1);
        CommonException loi = assertThrows(CommonException.class,
                () -> service.updateLogo(1, new MockMultipartFile("file", "logo.png", "image/png", lon)));
        assertTrue(loi.getMessage().contains("vượt quá 5 MB"), loi.getMessage());
        verify(minioService, never()).upload(any());
    }
}
