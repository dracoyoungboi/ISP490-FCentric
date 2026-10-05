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

        // Decode toàn bộ để chắc chắn tệp là ảnh thật, không phải nội dung giả mạo
        BufferedImage image;
        try {
            image = ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException e) {
            throw new CommonException("Tệp không phải ảnh hợp lệ hoặc ảnh đã bị hỏng");
        }
        if (image == null) {
            throw new CommonException("Tệp không phải ảnh hợp lệ hoặc ảnh đã bị hỏng");
        }
        if (image.getWidth() <= 0 || image.getHeight() <= 0
                || image.getWidth() > MAX_DIMENSION || image.getHeight() > MAX_DIMENSION) {
            throw new CommonException("Kích thước ảnh không hợp lệ (tối đa " + MAX_DIMENSION + "×" + MAX_DIMENSION + " px)");
        }

        return format;
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
