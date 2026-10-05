package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test validate ảnh đại diện theo NỘI DUNG tệp thật: nhận diện format bằng
 * magic bytes + decode qua ImageIO (WebP qua TwelveMonkeys imageio-webp),
 * không tin tên tệp/MIME type do client gửi.
 */
class AvatarImageValidatorTest {

    private static final BufferedImage IMAGE = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);

    private static byte[] encode(String format) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(IMAGE, format, out),
                "Không ghi được ảnh định dạng " + format + " để làm dữ liệu test (thiếu writer?)");
        return out.toByteArray();
    }

    private static MockMultipartFile file(String name, String contentType, byte[] bytes) {
        return new MockMultipartFile("file", name, contentType, bytes);
    }

    private static void assertRejected(MockMultipartFile file, String messagePart) {
        CommonException ex = assertThrows(CommonException.class, () -> AvatarImageValidator.validate(file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertTrue(ex.getMessage().contains(messagePart),
                "Message '" + ex.getMessage() + "' không chứa '" + messagePart + "'");
    }

    @Test
    void jpegHopLe_traVeFormatJpeg() throws Exception {
        assertEquals("jpeg", AvatarImageValidator.validate(
                file("a.jpg", "image/jpeg", encode("jpeg"))));
    }

    @Test
    void pngHopLe_traVeFormatPng() throws Exception {
        assertEquals("png", AvatarImageValidator.validate(
                file("a.png", "image/png", encode("png"))));
    }

    @Test
    void webpHopLe_traVeFormatWebp() {
        // TwelveMonkeys imageio-webp chỉ có READER (không có writer) — dùng
        // fixture WebP 1×1 hợp lệ nhúng sẵn thay vì sinh bằng ImageIO
        byte[] webp = java.util.Base64.getDecoder().decode(
                "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA");
        assertEquals("webp", AvatarImageValidator.validate(
                file("a.webp", "image/webp", webp)));
    }

    @Test
    void fileRong_biTuChoi() {
        assertRejected(file("a.jpg", "image/jpeg", new byte[0]), "chọn tệp ảnh");
    }

    @Test
    void fileVuot2MB_biTuChoi() {
        assertRejected(file("a.jpg", "image/jpeg", new byte[(int) AvatarImageValidator.MAX_AVATAR_BYTES + 1]),
                "vượt quá 2 MB");
    }

    @Test
    void fileVanBanGiaMacAnh_biTuChoi() {
        assertRejected(file("a.jpg", "image/jpeg", "day khong phai anh".getBytes()),
                "Định dạng ảnh không được hỗ trợ");
    }

    @Test
    void gif_biTuChoi_dinhDangKhongDuocHoTro() throws Exception {
        assertRejected(file("a.gif", "image/gif", encode("gif")),
                "Định dạng ảnh không được hỗ trợ");
    }

    @Test
    void anhHong_biTuChoi() {
        // Header JPEG hợp lệ nhưng nội dung cắt cụt -> không decode được
        byte[] corrupted = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};
        assertRejected(file("a.jpg", "image/jpeg", corrupted),
                "không phải ảnh hợp lệ");
    }

    @Test
    void doiTenKhongAnhHuong_nhanDienTheoNoiDung() throws Exception {
        // Nội dung PNG thật nhưng đặt tên .jpg — phải nhận diện theo nội dung
        assertEquals("png", AvatarImageValidator.validate(
                file("gia-mao.jpg", "image/jpeg", encode("png"))));
    }
}
