package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IPrintTemplateConfig;
import com.dev.backend.dto.request.ThongTinCongTyRequest;
import com.dev.backend.dto.response.FileObjectInfo;
import com.dev.backend.dto.response.ThongTinCongTyDto;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.ThongTinCongTy;
import com.dev.backend.repository.ThongTinCongTyRepository;
import com.dev.backend.services.MinioService;
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
 * Test chọn logo công ty trong toDto(): ưu tiên tepTin.duongDan -> logoDuongDan cũ
 * -> asset mặc định; URL chọn được phải qua chuẩn hoá origin legacy -> HTTPS.
 * Mock hoàn toàn repository/storage — không đụng DB hay MinIO thật.
 */
@ExtendWith(MockitoExtension.class)
class ThongTinCongTyServiceTest {

    @Mock
    private ThongTinCongTyRepository repository;
    @Mock
    private MinioService minioService;
    @Mock
    private TepTinService tepTinService;

    private ThongTinCongTyService service;

    @BeforeEach
    void setUp() {
        service = new ThongTinCongTyService();
        ReflectionTestUtils.setField(service, "thongTinCongTyRepository", repository);
        ReflectionTestUtils.setField(service, "minioService", minioService);
        ReflectionTestUtils.setField(service, "tepTinService", tepTinService);
    }

    @Test
    void getProfile_uuTienTepTin_doiOriginLegacySangHttps() {
        ThongTinCongTy entity = ThongTinCongTy.builder()
                .id(1)
                .tenCongTy("FCentric")
                .tepTin(TepTin.builder()
                        .duongDan("http://171.244.142.43:9000/fashion/company/logo.png")
                        .build())
                .logoDuongDan("http://cu.example.com/old.png")
                .build();
        when(repository.findById(1)).thenReturn(Optional.of(entity));

        ThongTinCongTyDto dto = service.getProfile();

        assertEquals("https://minio.slmglobal.vn/fashion/company/logo.png", dto.getLogoAsset());
    }

    @Test
    void getProfile_fallbackLogoDuongDanCu_cungDuocChuanHoa() {
        ThongTinCongTy entity = ThongTinCongTy.builder()
                .id(1)
                .tenCongTy("FCentric")
                .logoDuongDan("http://171.244.142.43:9000/fashion/company/legacy.png")
                .build();
        when(repository.findById(1)).thenReturn(Optional.of(entity));

        assertEquals("https://minio.slmglobal.vn/fashion/company/legacy.png",
                service.getProfile().getLogoAsset());
    }

    @Test
    void getProfile_khongCoLogo_nhanAssetMacDinh() {
        ThongTinCongTy entity = ThongTinCongTy.builder().id(1).tenCongTy("FCentric").build();
        when(repository.findById(1)).thenReturn(Optional.of(entity));

        assertEquals(IPrintTemplateConfig.DEFAULT_LOGO_PATH, service.getProfile().getLogoAsset());
    }

    @Test
    void updateProfile_traVeLogoDaChuanHoa() {
        ThongTinCongTy entity = ThongTinCongTy.builder()
                .id(1)
                .tenCongTy("FCentric")
                .tepTin(TepTin.builder()
                        .duongDan("http://171.244.142.43:9000/fashion/company/logo.png")
                        .build())
                .build();
        when(repository.findById(1)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ThongTinCongTyDto dto = service.updateProfile(new ThongTinCongTyRequest("FCentric", null, null, null));

        assertEquals("https://minio.slmglobal.vn/fashion/company/logo.png", dto.getLogoAsset());
    }

    @Test
    void updateLogo_traVeLogoHttps_tuUploadMoi() throws Exception {
        ThongTinCongTy entity = ThongTinCongTy.builder().id(1).tenCongTy("FCentric").build();
        when(repository.findById(1)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(minioService.upload(any())).thenReturn("fashion/company/logo-new.png");
        when(minioService.getObjectInfo("fashion/company/logo-new.png"))
                .thenReturn(FileObjectInfo.builder()
                        .userMetadata(Map.of("file-extension", "png"))
                        .build());
        // getPublicUrl trả URL legacy (đúng cấu hình MinIO đang lưu vào DB)
        when(minioService.getPublicUrl("fashion/company/logo-new.png"))
                .thenReturn("http://171.244.142.43:9000/fashion/company/logo-new.png");
        when(tepTinService.create(any(TepTin.class))).thenAnswer(inv -> inv.getArgument(0));

        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getContentType()).thenReturn("image/png");

        ThongTinCongTyDto dto = service.updateLogo(file);

        assertEquals("https://minio.slmglobal.vn/fashion/company/logo-new.png", dto.getLogoAsset());
        verify(tepTinService).create(any(TepTin.class));
    }
}
