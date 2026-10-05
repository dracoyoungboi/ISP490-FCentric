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
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Test response upload logo thương hiệu: mapper thật + storage/repository mock,
 * logoUrl trả về phải là HTTPS (origin legacy đã được chuẩn hoá).
 */
@ExtendWith(MockitoExtension.class)
class ThuongHieuServiceTest {

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

        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getContentType()).thenReturn("image/png");

        ThuongHieuDto dto = service.updateLogo(1, file);

        assertEquals("https://minio.slmglobal.vn/fashion/brands/nike-new.png", dto.getLogoUrl());
        verify(tepTinService).create(any(TepTin.class));
    }
}
