package com.dev.backend.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Các yêu cầu của phần ghi nhận thanh toán đơn bán thường: thu, hoàn, hủy phiếu, đối chiếu chuyển khoản. */
public final class ThanhToanRequest {

    private ThanhToanRequest() {
    }

    /**
     * Ghi nhận khách trả tiền cho đơn bán thường (đặt cọc, thu nhiều lần). phuongThuc: TIEN_MAT | CHUYEN_KHOAN (bắt buộc
     * mã giao dịch trên sao kê). ngayThu: ngày khách trả (trống = hôm nay; chuyển khoản được chọn ngày đã qua, tiền mặt
     * chỉ hôm nay). choThuThua: đã xác nhận ghi số vượt phần còn phải thu (đơn thành Cần hoàn tiền). choMaDaDung: đã
     * xác nhận mã giao dịch đã ghi ở đơn khác (bảng kê COD gồm nhiều đơn). khoaChongTrung: trình duyệt sinh mỗi lần mở
     * hộp ghi; gửi lại cùng khóa thì trả kết quả lần trước, không ghi thêm.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ThuTien {
        String phuongThuc;
        BigDecimal soTien;
        LocalDate ngayThu;
        String maThamChieu;
        String ghiChu;
        boolean choThuThua;
        boolean choMaDaDung;
        String khoaChongTrung;
    }

    /** Hoàn phần thu thừa: TIEN_MAT | CHUYEN_KHOAN (bắt buộc mã giao dịch hoàn). */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HoanTien {
        String phuongThuc;
        BigDecimal soTien;
        String maThamChieu;
        String ghiChu;
        String khoaChongTrung;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HuyPhieu {
        String lyDo;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DoiChieu {
        List<Long> ids;
    }
}
