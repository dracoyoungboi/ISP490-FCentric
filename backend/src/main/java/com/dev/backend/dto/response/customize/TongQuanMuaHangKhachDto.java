package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Số tổng hợp đơn bán của một khách hàng (trang chi tiết khách hàng).
 * Cùng phạm vi vai trò với danh sách đơn bán: người dùng chỉ thấy số của những đơn họ được xem.
 * Chỉ tính chứng từ đơn bán (không tính báo giá).
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TongQuanMuaHangKhachDto {
    /** Số đơn đã đặt: mọi đơn trừ đơn nháp (kể cả đơn đã hủy / bị hoàn trả). */
    long soDonDat;
    /** Số đơn tính vào chi tiêu: đơn đã đặt trừ đơn đã hủy và bị hoàn trả. */
    long soDonTinhChiTieu;
    long soDonHuy;
    long soDonHoanTra;
    /** Đơn nháp: chưa gửi đi nên không tính vào số đơn và chi tiêu. */
    long soDonNhap;
    /** Đơn chưa kết thúc (mọi trạng thái trừ Hoàn thành, Đã hủy, Bị hoàn trả; kể cả nháp). */
    long soDonDangXuLy;
    /** Tổng tiền (tong_cong) của các đơn tính chi tiêu. */
    BigDecimal tongChiTieu;
    /** tongChiTieu / soDonTinhChiTieu, làm tròn đến đồng; null khi chưa có đơn tính chi tiêu. */
    BigDecimal trungBinhMoiDon;
    /** Đơn đã đặt gần nhất (theo ngày đặt); null khi chưa có. */
    DonGanNhat donGanNhat;
    /** Các kênh khách đã mua qua (đơn đã đặt), nhiều đơn nhất ở trước. */
    List<KenhMua> kenhMua;

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DonGanNhat {
        Integer id;
        String soDonHang;
        Instant ngayDatHang;
    }

    /** Một kênh bán của khách; id / maKenh / tenKenh null = đơn bán thường (không gắn kênh). */
    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class KenhMua {
        Integer id;
        String maKenh;
        String tenKenh;
        long soDon;
    }
}
