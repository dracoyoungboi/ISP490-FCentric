package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Dữ liệu của chuông thông báo. Hình dạng một dòng khớp frontend/src/services/thongBaoService.js (NotificationBell.jsx).
 */
public final class ThongBaoDto {

    private ThongBaoDto() {
    }

    /** Một thông báo. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Dong {
        Long id;
        /** Mã loại, giao diện chọn biểu tượng (vd. phieu_chuyen_kho). */
        String loai;
        /** info | warning | danger | success. */
        String tone;
        /** Tên nhóm hiển thị (vd. "Chuyển kho"), có thể null. */
        String nhom;
        String tieuDe;
        String moTa;
        /** Đường dẫn trong ứng dụng mở khi bấm, có thể null. */
        String duongDan;
        /** Thời điểm tạo, chuỗi ISO 8601 (UTC, đuôi Z). */
        String thoiGian;
        boolean daDoc;
        String loaiThamChieu;
        Integer idThamChieu;
    }

    /** Một trang thông báo của người đang đăng nhập và tổng số chưa đọc (mọi trang). */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DanhSach {
        List<Dong> content;
        long totalElements;
        int totalPages;
        long soChuaDoc;
    }
}
