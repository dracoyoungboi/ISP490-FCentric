package com.dev.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Tiền thu trong kỳ của Báo cáo doanh thu — tính theo ngày thu tiền (khác doanh thu tính theo ngày giao hàng).
 * Tại quầy: sổ thu POS (tiền mặt; QR payOS tính vào chuyển khoản; trả kết hợp tách hai phần). Đơn bán thường: phiếu thu /
 * phiếu hoàn còn hiệu lực. Đơn sàn không vào tiền mặt / chuyển khoản: ô Sàn thu hộ để đối soát với sàn.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TienThuDTO {
    /** Tiền mặt = tại quầy + đơn bán thường. */
    BigDecimal tienMat;
    BigDecimal tienMatTaiQuay;
    BigDecimal tienMatDonThuong;
    /** Chuyển khoản = QR payOS tại quầy + chuyển khoản ghi tay của đơn bán thường. */
    BigDecimal chuyenKhoan;
    BigDecimal qrPayos;
    BigDecimal chuyenKhoanGhiTay;
    /** Đã trả lại khách (phiếu hoàn của đơn bán thường). */
    BigDecimal hoan;
    long soPhieuHoan;
    /** Đơn sàn đã giao trong kỳ (theo ngày giao, như doanh thu): sàn thu hộ, đối soát với sàn. */
    BigDecimal sanThuHo;
    long soDonSan;
    /** Tới hôm nay (không theo kỳ): đơn bán thường đã chốt còn thiếu tiền. */
    BigDecimal conPhaiThu;
    long soDonConPhaiThu;
    /** Phiếu chuyển khoản chưa đối chiếu sao kê (chỉ quản trị viên; null với người khác). */
    Long chuaDoiChieu;
    /** Quản lý kho xem "Tất cả kho": chỉ tính các cửa hàng mình phụ trách. */
    boolean theoKhoPhuTrach;
    /** Từng kỳ, nhãn trùng nhãn của bảng doanh thu (01/10, Tuần 3, T10/2026, 2026). */
    List<Ky> theoKy;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Ky {
        String nhanThoiGian;
        Integer sortKey;
        BigDecimal tienMat;
        BigDecimal chuyenKhoan;
        BigDecimal hoan;
    }
}
