package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.utils.KiemTraTepTai.LoaiTep;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Nhận dạng tệp tải lên theo byte đầu (M-4): tên tệp và Content-Type client khai không ảnh hưởng; SVG / HTML có script
 * không bao giờ được nhận là ảnh.
 */
class KiemTraTepTaiTest {

    private static final byte[] SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
            .getBytes(StandardCharsets.UTF_8);
    private static final byte[] HTML = "<!doctype html><html><script>alert(1)</script></html>"
            .getBytes(StandardCharsets.UTF_8);

    private static byte[] anh(String dinhDang) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), dinhDang, out));
        return out.toByteArray();
    }

    /** Hộp "ftyp" ISO-BMFF với brand chính cho trước (MP4 / MOV / AVIF / HEIC). */
    private static byte[] ftyp(String brand) {
        byte[] b = new byte[32];
        b[3] = 0x18;
        System.arraycopy("ftyp".getBytes(StandardCharsets.ISO_8859_1), 0, b, 4, 4);
        System.arraycopy(brand.getBytes(StandardCharsets.ISO_8859_1), 0, b, 8, 4);
        return b;
    }

    private static MockMultipartFile tep(String ten, String contentType, byte[] noiDung) {
        return new MockMultipartFile("file", ten, contentType, noiDung);
    }

    @Test
    void nhanDangTheoNoiDung_cacDinhDangDuocNhan() throws Exception {
        byte[] webp = Base64.getDecoder().decode("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA");
        assertEquals(Optional.of(LoaiTep.JPEG), KiemTraTepTai.nhanDang(anh("jpeg")));
        assertEquals(Optional.of(LoaiTep.PNG), KiemTraTepTai.nhanDang(anh("png")));
        assertEquals(Optional.of(LoaiTep.GIF), KiemTraTepTai.nhanDang(anh("gif")));
        assertEquals(Optional.of(LoaiTep.WEBP), KiemTraTepTai.nhanDang(webp));
        assertEquals(Optional.of(LoaiTep.AVIF), KiemTraTepTai.nhanDang(ftyp("avif")));
        assertEquals(Optional.of(LoaiTep.MP4), KiemTraTepTai.nhanDang(ftyp("isom")));
        assertEquals(Optional.of(LoaiTep.MP4), KiemTraTepTai.nhanDang(ftyp("mp42")));
        assertEquals(Optional.of(LoaiTep.MOV), KiemTraTepTai.nhanDang(ftyp("qt  ")));
        assertEquals(Optional.of(LoaiTep.WEBM), KiemTraTepTai.nhanDang(new byte[]{0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 0, 0}));
    }

    @Test
    void khongNhanDang_svgHtmlHeicVaTepCut() {
        assertTrue(KiemTraTepTai.nhanDang(SVG).isEmpty());
        assertTrue(KiemTraTepTai.nhanDang(HTML).isEmpty());
        assertTrue(KiemTraTepTai.nhanDang(ftyp("heic")).isEmpty(), "HEIC: trình duyệt không hiển thị được");
        assertTrue(KiemTraTepTai.nhanDang(new byte[0]).isEmpty());
        assertTrue(KiemTraTepTai.nhanDang(new byte[]{(byte) 0xFF, (byte) 0xD8}).isEmpty(), "chưa đủ chữ ký JPEG");
        assertTrue(KiemTraTepTai.nhanDang(Arrays.copyOf(ftyp("isom"), 10)).isEmpty(), "hộp ftyp bị cắt cụt");
    }

    @Test
    void batBuoc_svgDoiTenThanhPng_biTuChoi() {
        CommonException loi = assertThrows(CommonException.class, () -> KiemTraTepTai.batBuoc(
                tep("logo.png", "image/png", SVG), KiemTraTepTai.ANH_WEB, 1024 * 1024, "Logo", KiemTraTepTai.MO_TA_ANH_WEB));
        assertEquals(HttpStatus.BAD_REQUEST, loi.getHttpStatus());
        assertEquals("Logo phải là ảnh JPEG, PNG, WebP, GIF hoặc AVIF", loi.getMessage());
    }

    @Test
    void batBuoc_svgKhaiImageSvg_biTuChoi() {
        assertThrows(CommonException.class, () -> KiemTraTepTai.batBuoc(
                tep("logo.svg", "image/svg+xml", SVG), KiemTraTepTai.ANH_WEB, 1024 * 1024, "Logo", "ảnh"));
    }

    @Test
    void batBuoc_videoKhongNamTrongTapAnh() {
        assertThrows(CommonException.class, () -> KiemTraTepTai.batBuoc(
                tep("a.png", "image/png", ftyp("isom")), KiemTraTepTai.ANH_WEB, 1024 * 1024, "Ảnh", "ảnh"));
    }

    @Test
    void batBuoc_traLoaiTheoNoiDung_khongTheoTen() throws Exception {
        assertEquals(LoaiTep.PNG, KiemTraTepTai.batBuoc(
                tep("gia-mao.jpg", "image/jpeg", anh("png")), KiemTraTepTai.ANH_WEB, 1024 * 1024, "Ảnh", "ảnh"));
    }

    @Test
    void batBuoc_tepRongVaQuaCo() throws Exception {
        CommonException rong = assertThrows(CommonException.class, () -> KiemTraTepTai.batBuoc(
                tep("a.png", "image/png", new byte[0]), KiemTraTepTai.ANH_WEB, 1024, "Ảnh", "ảnh"));
        assertEquals("Ảnh đang trống", rong.getMessage());
        CommonException lon = assertThrows(CommonException.class, () -> KiemTraTepTai.batBuoc(
                tep("a.png", "image/png", Arrays.copyOf(anh("png"), 3 * 1024 * 1024)),
                KiemTraTepTai.ANH_WEB, 2L * 1024 * 1024, "Ảnh", "ảnh"));
        assertEquals("Ảnh vượt quá 2 MB cho phép", lon.getMessage());
    }

    @Test
    void tepLaiGhep_dauGifThanHtml_luuThanhImageGif_khongBaoGioThanhTrangWeb() {
        // Đầu GIF thật + thân HTML: được nhận là GIF và MinIO phục vụ "image/gif" — trình duyệt hiển thị như ảnh
        // (hỏng), không chạy script. An toàn nằm ở Content-Type do máy chủ đặt, không ở việc đoán thân tệp.
        byte[] laiGhep = ("GIF89a<html><script>alert(1)</script></html>").getBytes(StandardCharsets.ISO_8859_1);
        assertEquals(Optional.of(LoaiTep.GIF), KiemTraTepTai.nhanDang(laiGhep));
        assertEquals("image/gif", LoaiTep.GIF.contentType);
    }

    @Test
    void avifBrandChinhMif1_coBrandPhuAvif_vanNhan() {
        byte[] b = new byte[32];
        b[3] = 0x1C; // hộp ftyp 28 byte: brand chính, phiên bản, 3 brand tương thích
        System.arraycopy("ftypmif1".getBytes(StandardCharsets.ISO_8859_1), 0, b, 4, 8);
        System.arraycopy("mif1avifmiaf".getBytes(StandardCharsets.ISO_8859_1), 0, b, 16, 12);
        assertEquals(Optional.of(LoaiTep.AVIF), KiemTraTepTai.nhanDang(b));

        // HEIC (brand phụ heic, không có avif): vẫn không nhận
        System.arraycopy("mif1heicmiaf".getBytes(StandardCharsets.ISO_8859_1), 0, b, 16, 12);
        assertTrue(KiemTraTepTai.nhanDang(b).isEmpty());
    }

    @Test
    void ftypBrandLa_coiLaMp4_brandAnhKhac_khongNhan() {
        assertEquals(Optional.of(LoaiTep.MP4), KiemTraTepTai.nhanDang(ftyp("M4V ")));
        assertEquals(Optional.of(LoaiTep.MP4), KiemTraTepTai.nhanDang(ftyp("zzzz")), "brand lạ: vẫn là video/mp4, không phải trang web");
        assertTrue(KiemTraTepTai.nhanDang(ftyp("mif1")).isEmpty());
        assertTrue(KiemTraTepTai.nhanDang(ftyp("heix")).isEmpty());
    }

    @Test
    void contentTypeAnToan_chiGiuAnhKhongSvgVaVideo() {
        assertEquals("image/png", KiemTraTepTai.contentTypeAnToan("image/png"));
        assertEquals("video/mp4", KiemTraTepTai.contentTypeAnToan("Video/MP4"));
        assertEquals("application/octet-stream", KiemTraTepTai.contentTypeAnToan("image/svg+xml"));
        assertEquals("application/octet-stream", KiemTraTepTai.contentTypeAnToan("text/html"));
        assertEquals("application/octet-stream", KiemTraTepTai.contentTypeAnToan("application/xhtml+xml"));
        assertEquals("application/octet-stream", KiemTraTepTai.contentTypeAnToan(null));
    }

    @Test
    void duoiAnToan_boKyTuLaVaDuongDan() {
        assertEquals("png", KiemTraTepTai.duoiAnToan("Anh.PNG"));
        assertEquals("webm", KiemTraTepTai.duoiAnToan("video.webm"));
        assertEquals("", KiemTraTepTai.duoiAnToan("../../etc/passwd"));
        assertEquals("", KiemTraTepTai.duoiAnToan("a.p/hp"));
        assertEquals("", KiemTraTepTai.duoiAnToan("a.png\r\nX-Header: 1"));
        assertEquals("", KiemTraTepTai.duoiAnToan("khong-duoi"));
        assertEquals("", KiemTraTepTai.duoiAnToan("cham-cuoi."));
        assertEquals("", KiemTraTepTai.duoiAnToan("a.duoiquadaivuotmuc"));
        assertEquals("", KiemTraTepTai.duoiAnToan(null));
    }
}
