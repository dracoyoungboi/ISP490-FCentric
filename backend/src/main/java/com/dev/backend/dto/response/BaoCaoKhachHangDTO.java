package com.dev.backend.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Số liệu của Báo cáo khách hàng (màn /reports/customers): các kỳ trong khoảng đang xem và phần tổng cả kỳ.
 * Không tính khách lẻ (khách KHLE, đơn không gắn khách) vào số khách; số đơn khách lẻ ghi riêng ở phần tổng.
 */
public record BaoCaoKhachHangDTO(List<Ky> ky, Tong tong) {

    /**
     * Một kỳ (ngày, tuần, tháng, năm).
     * - soKhachMoi: khách có lần mua đầu tiên (đơn đã giao, ở mọi kho) rơi vào kỳ này, nên mỗi khách chỉ là khách mới ở
     *   đúng một kỳ.
     * - soKhachQuayLai: khách mua trong kỳ nhưng đã mua trước kỳ.
     * - tichLuyKhachMoi: cộng dồn khách mới từ kỳ đầu của khoảng đang xem.
     * - tyLeTangTruong: % khách mới so với kỳ liền trước (kể cả khi kỳ trước nằm ngoài khoảng đang xem); null khi kỳ
     *   trước không có khách mới.
     * - chuaToi: kỳ bắt đầu sau hôm nay (vd. tháng 12 khi đang ở tháng 11), số liệu luôn 0.
     */
    public record Ky(String nhanThoiGian, LocalDate tuNgay, LocalDate denNgay, long soKhachMoi, long soKhachQuayLai,
                     long tongKhachMua, long tichLuyKhachMoi, BigDecimal tyLeTangTruong, boolean chuaToi) {
    }

    /**
     * Cả kỳ, mỗi khách đếm một lần. Khoảng [tuNgay, denNgay]: cả khoảng đang xem; riêng kiểu So sánh là tháng đang chọn.
     * - khachMoi: lần mua đầu tiên rơi vào khoảng.
     * - khachMuaLai: có từ 2 đơn đã giao trở lên (ở mọi kho) tính tới hết khoảng.
     * - doanhThu, soDon: đơn của các khách trên (không gồm khách lẻ).
     * - donKhachLe: số đơn khách lẻ trong khoảng.
     */
    public record Tong(LocalDate tuNgay, LocalDate denNgay, long khachMua, long khachMoi, long khachMuaLai, long soDon,
                       BigDecimal doanhThu, long donKhachLe) {
    }
}
