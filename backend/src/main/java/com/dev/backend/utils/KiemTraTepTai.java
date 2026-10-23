package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;

/**
 * Nhận dạng tệp tải lên theo NỘI DUNG (vài byte đầu), không theo tên tệp hay Content-Type client khai. Kết quả cho đuôi
 * chuẩn và Content-Type do máy chủ đặt khi lưu MinIO: tệp HTML / SVG có script đổi tên thành .png không lọt, và MinIO
 * không phục vụ lại một tệp tải lên với Content-Type text/html (trang lừa đảo trên tên miền của công ty).
 */
public final class KiemTraTepTai {

    public enum LoaiTep {
        JPEG("image/jpeg", "jpg", true),
        PNG("image/png", "png", true),
        WEBP("image/webp", "webp", true),
        GIF("image/gif", "gif", true),
        AVIF("image/avif", "avif", true),
        MP4("video/mp4", "mp4", false),
        MOV("video/quicktime", "mov", false),
        WEBM("video/webm", "webm", false);

        public final String contentType;
        public final String duoi;
        public final boolean laAnh;

        LoaiTep(String contentType, String duoi, boolean laAnh) {
            this.contentType = contentType;
            this.duoi = duoi;
            this.laAnh = laAnh;
        }
    }

    /** Ảnh hiển thị được trên trình duyệt (sản phẩm, logo thương hiệu). Không có SVG: SVG chạy được script. */
    public static final Set<LoaiTep> ANH_WEB = Set.of(LoaiTep.JPEG, LoaiTep.PNG, LoaiTep.WEBP, LoaiTep.GIF, LoaiTep.AVIF);
    public static final String MO_TA_ANH_WEB = "ảnh JPEG, PNG, WebP, GIF hoặc AVIF";
    /** Ảnh chụp (bằng chứng đóng gói). */
    public static final Set<LoaiTep> ANH_CHUP = Set.of(LoaiTep.JPEG, LoaiTep.PNG, LoaiTep.WEBP);
    public static final Set<LoaiTep> VIDEO = Set.of(LoaiTep.MP4, LoaiTep.MOV, LoaiTep.WEBM);

    // Brand ISO-BMFF ("ftyp") cùng khung với MP4 nhưng là ảnh: AVIF hiển thị được, HEIC thì trình duyệt không mở được
    private static final Set<String> BRAND_AVIF = Set.of("avif", "avis");
    private static final Set<String> BRAND_ANH_KHAC = Set.of("heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1");

    private KiemTraTepTai() {
    }

    /** Loại tệp theo nội dung; rỗng nếu không thuộc loại nào được hỗ trợ. */
    public static Optional<LoaiTep> nhanDang(MultipartFile file) {
        if (file == null || file.isEmpty()) return Optional.empty();
        try (InputStream in = file.getInputStream()) {
            // 64 byte: đủ hộp "ftyp" kèm vài brand tương thích (AVIF brand chính mif1, brand phụ avif)
            return nhanDang(in.readNBytes(64));
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    static Optional<LoaiTep> nhanDang(byte[] b) {
        if (batDau(b, 0, 0xFF, 0xD8, 0xFF)) return Optional.of(LoaiTep.JPEG);
        if (batDau(b, 0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return Optional.of(LoaiTep.PNG);
        if (chuoi(b, 0, "GIF87a") || chuoi(b, 0, "GIF89a")) return Optional.of(LoaiTep.GIF);
        if (chuoi(b, 0, "RIFF") && chuoi(b, 8, "WEBP")) return Optional.of(LoaiTep.WEBP);
        if (batDau(b, 0, 0x1A, 0x45, 0xDF, 0xA3)) return Optional.of(LoaiTep.WEBM); // EBML (Matroska / WebM)
        if (chuoi(b, 4, "ftyp") && b.length >= 12) {
            String brand = new String(b, 8, 4, StandardCharsets.ISO_8859_1);
            if (BRAND_AVIF.contains(brand)) return Optional.of(LoaiTep.AVIF);
            if (BRAND_ANH_KHAC.contains(brand)) {
                return coBrandTuongThich(b, BRAND_AVIF) ? Optional.of(LoaiTep.AVIF) : Optional.empty();
            }
            return Optional.of("qt  ".equals(brand) ? LoaiTep.MOV : LoaiTep.MP4);
        }
        return Optional.empty();
    }

    /**
     * Bắt buộc tệp là một trong {@code choPhep} và không quá {@code maxBytes}; trả loại tệp để đặt tên / Content-Type.
     *
     * @param tenTep cách gọi tệp trong câu báo lỗi (vd. "Ảnh sản phẩm", "Logo")
     * @param moTa   loại được nhận (vd. {@link #MO_TA_ANH_WEB})
     */
    public static LoaiTep batBuoc(MultipartFile file, Set<LoaiTep> choPhep, long maxBytes, String tenTep, String moTa) {
        if (file == null || file.isEmpty()) {
            throw new CommonException(tenTep + " đang trống");
        }
        if (file.getSize() > maxBytes) {
            throw new CommonException(tenTep + " vượt quá " + (maxBytes / (1024 * 1024)) + " MB cho phép");
        }
        return nhanDang(file).filter(choPhep::contains)
                .orElseThrow(() -> new CommonException(tenTep + " phải là " + moTa));
    }

    /** Đuôi an toàn lấy từ tên tệp (chỉ chữ / số, tối đa 8 ký tự, chữ thường); rỗng nếu không có. */
    public static String duoiAnToan(String tenTep) {
        if (tenTep == null) return "";
        int cham = tenTep.lastIndexOf('.');
        if (cham < 0 || cham == tenTep.length() - 1) return "";
        String duoi = tenTep.substring(cham + 1).toLowerCase();
        return duoi.length() <= 8 && duoi.chars().allMatch(c -> (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))
                ? duoi : "";
    }

    /** Content-Type an toàn cho tệp chưa nhận dạng: chỉ giữ ảnh (trừ SVG) / video, còn lại tải về dạng nhị phân. */
    public static String contentTypeAnToan(String khaiBao) {
        String ct = khaiBao == null ? "" : khaiBao.toLowerCase().trim();
        if ((ct.startsWith("image/") && !ct.contains("svg")) || ct.startsWith("video/")) return ct;
        return "application/octet-stream";
    }

    /** Hộp ftyp: [cỡ 4][ftyp][brand chính 4][phiên bản 4][brand tương thích 4 × n] — có brand nào trong {@code can}? */
    private static boolean coBrandTuongThich(byte[] b, Set<String> can) {
        long coHop = ((b[0] & 0xFFL) << 24) | ((b[1] & 0xFFL) << 16) | ((b[2] & 0xFFL) << 8) | (b[3] & 0xFFL);
        int het = (int) Math.min(coHop, b.length);
        for (int i = 16; i + 4 <= het; i += 4) {
            if (can.contains(new String(b, i, 4, StandardCharsets.ISO_8859_1))) return true;
        }
        return false;
    }

    private static boolean batDau(byte[] b, int tu, int... mau) {
        if (b.length < tu + mau.length) return false;
        for (int i = 0; i < mau.length; i++) {
            if ((b[tu + i] & 0xFF) != mau[i]) return false;
        }
        return true;
    }

    private static boolean chuoi(byte[] b, int tu, String s) {
        byte[] m = s.getBytes(StandardCharsets.ISO_8859_1);
        return b.length >= tu + m.length && Arrays.equals(Arrays.copyOfRange(b, tu, tu + m.length), m);
    }
}
