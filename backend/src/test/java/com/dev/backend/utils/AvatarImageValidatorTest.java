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
    void anhKhaiKichThuocKhongLo_biTuChoiTruocKhiGiaiNen() {
        // PNG vài chục byte nhưng header khai 20000×20000 px: decode sẽ cấp ~1,2 GB bộ nhớ trước khi kịp so giới hạn
        assertRejected(file("bom.png", "image/png", pngChiCoHeader(20000, 20000)),
                "Kích thước ảnh không hợp lệ");
        assertRejected(file("hep.png", "image/png", pngChiCoHeader(5000, 10)),
                "Kích thước ảnh không hợp lệ");
    }

    @Test
    void headerHopLeNhungThanRac_bao400KhongPhai500() {
        // Kích thước 4×4 hợp lệ ở header, sau đó là rác: lỗi giải mã (kể cả lỗi runtime) → 400
        byte[] dau = pngChiCoHeader(4, 4);
        byte[] rac = java.util.Arrays.copyOf(dau, dau.length + 64);
        java.util.Arrays.fill(rac, dau.length, rac.length, (byte) 0x7F);
        assertRejected(file("rac.png", "image/png", rac), "không phải ảnh hợp lệ");
    }

    /** Chữ ký PNG + khối IHDR (CRC đúng), không có dữ liệu điểm ảnh. */
    private static byte[] pngChiCoHeader(int rong, int cao) {
        byte[] ihdr = java.nio.ByteBuffer.allocate(17).put("IHDR".getBytes(java.nio.charset.StandardCharsets.ISO_8859_1))
                .putInt(rong).putInt(cao).put((byte) 8).put((byte) 2).put((byte) 0).put((byte) 0).put((byte) 0)
                .array();
        java.util.zip.CRC32 crc = new java.util.zip.CRC32();
        crc.update(ihdr);
        return java.nio.ByteBuffer.allocate(8 + 4 + 17 + 4)
                .put(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A})
                .putInt(13).put(ihdr).putInt((int) crc.getValue())
                .array();
    }

    @Test
    void doiTenKhongAnhHuong_nhanDienTheoNoiDung() throws Exception {
        // Nội dung PNG thật nhưng đặt tên .jpg — phải nhận diện theo nội dung
        assertEquals("png", AvatarImageValidator.validate(
                file("gia-mao.jpg", "image/jpeg", encode("png"))));
    }
}
