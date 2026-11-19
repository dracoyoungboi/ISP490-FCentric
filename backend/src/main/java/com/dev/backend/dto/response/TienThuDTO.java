package com.dev.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Tiền thu trong kỳ của Báo cáo doanh thu — tính theo ngày thu tiền (khác doanh thu tính theo ngày giao hàng).
 * Tiền thu tại quầy theo sổ thu POS: tiền mặt; QR payOS tính vào chuyển khoản; trả kết hợp tách hai phần. Đơn sàn không
 * vào tiền mặt / chuyển khoản: ô Sàn thu hộ để đối soát với sàn.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TienThuDTO {
    BigDecimal tienMat;
    /** Chuyển khoản: QR payOS tại quầy. */
    BigDecimal chuyenKhoan;
    /** Đã trả lại khách khi nhận trả hàng tại quầy. */
    BigDecimal hoan;
    long soPhieuHoan;
    /** Đơn sàn đã giao trong kỳ (theo ngày giao, như doanh thu): sàn thu hộ, đối soát với sàn. */
    BigDecimal sanThuHo;
    long soDonSan;
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
