package com.dev.backend.dto.request.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PhatHanhBienBanRequest {
    /** GIU_KHO (mặc định) | TRA_NGAY (chỉ khi người ký là đại diện nhà cung cấp). */
    String cachXuLy;
    /** Ai ký biên bản bên giao hàng: DAI_DIEN_NCC (mặc định) | VAN_CHUYEN (tài xế nhà xe, bưu tá). */
    String benKy;
    /** Họ tên người giao hàng ký biên bản (trả ngay thì cũng là người nhận hàng lỗi). Bắt buộc. */
    String nguoiNhanHang;
    String bienSoXe;
    /** Tên đơn vị vận chuyển: bắt buộc khi VAN_CHUYEN. */
    String donViVanChuyen;
    /** Ghi chú gửi nhà cung cấp. Dòng hàng lỗi máy chủ lấy từ hàng lỗi đã lưu theo lô, không nhận từ trình duyệt. */
    String ghiChu;
}
