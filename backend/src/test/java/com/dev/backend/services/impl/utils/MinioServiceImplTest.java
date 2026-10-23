package com.dev.backend.services.impl.utils;

import io.minio.MinioClient;
import io.minio.ObjectWriteResponse;
import io.minio.PutObjectArgs;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * MinIO lưu Content-Type theo NỘI DUNG tệp (M-4): tệp HTML / SVG không được phục vụ lại như trang web dù client khai
 * gì; tên object do máy chủ sinh, không lấy từ tên tệp client.
 */
class MinioServiceImplTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D};
    private static final byte[] HTML = "<!doctype html><script>alert(1)</script>".getBytes(StandardCharsets.UTF_8);
    private static final byte[] SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
            .getBytes(StandardCharsets.UTF_8);

    private MinioClient minioClient;
    private MinioServiceImpl service;

    @BeforeEach
    void setUp() throws Exception {
        minioClient = mock(MinioClient.class);
        when(minioClient.putObject(any())).thenReturn(mock(ObjectWriteResponse.class));
        service = new MinioServiceImpl();
        ReflectionTestUtils.setField(service, "minioClient", minioClient);
        ReflectionTestUtils.setField(service, "minioBucketName", "fashion");
        ReflectionTestUtils.setField(service, "minioEndpoint", "http://minio:9000");
    }

    private PutObjectArgs daGui() throws Exception {
        ArgumentCaptor<PutObjectArgs> args = ArgumentCaptor.forClass(PutObjectArgs.class);
        verify(minioClient).putObject(args.capture());
        return args.getValue();
    }

    @Test
    void htmlKhaiTextHtml_luuVoiContentTypeNhiPhan() throws Exception {
        service.upload(new MockMultipartFile("file", "anh.html", "text/html", HTML), "x");
        assertEquals("application/octet-stream", daGui().contentType());
    }

    @Test
    void svgKhaiImageSvg_luuVoiContentTypeNhiPhan() throws Exception {
        service.upload(new MockMultipartFile("file", "logo.svg", "image/svg+xml", SVG), "x");
        assertEquals("application/octet-stream", daGui().contentType());
    }

    @Test
    void pngKhaiTextHtml_luuTheoNoiDungLaImagePng() throws Exception {
        service.upload(new MockMultipartFile("file", "logo.html", "text/html", PNG), "x");
        PutObjectArgs args = daGui();
        assertEquals("image/png", args.contentType());
        assertTrue(args.userMetadata().values().contains(".png"), "file-extension theo nội dung: " + args.userMetadata());
    }

    @Test
    void uploadKhongTen_tenObjectDoMayChuSinh_khongLayTenClient() throws Exception {
        String ten = service.upload(new MockMultipartFile("file", "../../evil/<x>.html", "image/png", PNG));
        assertTrue(ten.matches("[0-9a-f-]{36}\\.png"), ten);
        assertEquals(ten, daGui().object());
    }

    @Test
    void uploadKhongTen_tepKhongNhanDang_duoiBin_khongLayDuoiClient() throws Exception {
        String ten = service.upload(new MockMultipartFile("file", "trang.html", "text/html", HTML));
        assertTrue(ten.matches("[0-9a-f-]{36}\\.bin"), ten);
        assertEquals("application/octet-stream", daGui().contentType());
    }
}
