package com.dev.backend.utils;

import com.dev.backend.exception.customize.CommonException;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;

/**
 * Validate ảnh đại diện bằng NỘI DUNG tệp thật (decode qua ImageIO), không tin
 * tên tệp hay MIME type do client gửi. JPEG/PNG decode bằng ImageIO chuẩn;
 * WebP decode bằng TwelveMonkeys imageio-webp (đã khai báo trong pom).
 */
public final class AvatarImageValidator {

    /** Dung lượng tối đa ảnh đại diện: 2 MiB. */
    public static final long MAX_AVATAR_BYTES = 2L * 1024 * 1024;

    /** Format cho phép (tên format của ImageIO, viết thường). */
    private static final Set<String> ALLOWED_FORMATS = Set.of("jpeg", "png", "webp");

    /** Giới hạn kích thước điểm ảnh mỗi chiều (chống ảnh giải nén khổng lồ). */
    private static final int MAX_DIMENSION = 4096;

    private AvatarImageValidator() {
        // Utility class — không khởi tạo
    }

    /**
     * Kiểm tra tệp rỗng, quá dung lượng, định dạng thật (magic bytes + decode)
     * và kích thước điểm ảnh. Trả về format thật đã nhận diện ("jpeg"/"png"/
     * "webp") để tạo tên lưu trữ. Lỗi -> {@link CommonException} với message
     * tiếng Việt cho người dùng.
     */
    public static String validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CommonException("Vui lòng chọn tệp ảnh để tải lên");
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw new CommonException("Ảnh đại diện vượt quá 2 MB. Vui lòng chọn ảnh nhỏ hơn");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new CommonException("Không thể đọc tệp ảnh tải lên. Vui lòng thử lại");
        }
        if (bytes.length == 0) {
            throw new CommonException("Vui lòng chọn tệp ảnh để tải lên");
        }

        String format = detectFormat(bytes);
        if (format == null || !ALLOWED_FORMATS.contains(format)) {
            throw new CommonException("Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP");
        }

        // Kiểm kích thước từ header TRƯỚC khi decode: ảnh 2 MB nén cao có thể khai 50000×50000 px
        // → decode cấp vài GB bộ nhớ (OOM) trước khi kịp so với giới hạn
        int[] dimensions = readDimensions(bytes);
        if (dimensions == null) {
            throw new CommonException("Tệp không phải ảnh hợp lệ hoặc ảnh đã bị hỏng");
        }
        checkDimensions(dimensions[0], dimensions[1]);

        // Decode toàn bộ để chắc chắn tệp là ảnh thật, không phải nội dung giả mạo
        BufferedImage image;
        try {
            image = ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException | RuntimeException e) {
            // Bộ giải mã có thể ném lỗi runtime với tệp hỏng cố ý: báo 400, không để thành 500
            throw new CommonException("Tệp không phải ảnh hợp lệ hoặc ảnh đã bị hỏng");
        }
        if (image == null) {
            throw new CommonException("Tệp không phải ảnh hợp lệ hoặc ảnh đã bị hỏng");
        }
        checkDimensions(image.getWidth(), image.getHeight());

        return format;
    }

    private static void checkDimensions(int width, int height) {
        if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
            throw new CommonException("Kích thước ảnh không hợp lệ (tối đa " + MAX_DIMENSION + "×" + MAX_DIMENSION + " px)");
        }
    }

    /**
     * Đọc rộng × cao từ header (không decode điểm ảnh); null nếu không đọc được.
     */
    static int[] readDimensions(byte[] bytes) {
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (iis == null) {
                return null;
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(iis, true, true);
                return new int[]{reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    /**
     * Nhận diện format thật từ header của tệp (ImageIO chọn reader theo magic
     * bytes) — trả tên format viết thường, hoặc null nếu không nhận diện được.
     */
    static String detectFormat(byte[] bytes) {
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (iis == null) {
                return null;
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) {
                return null;
            }
            String formatName = readers.next().getFormatName();
            return formatName == null ? null : formatName.toLowerCase(Locale.ROOT);
        } catch (IOException e) {
            return null;
        }
    }
}
