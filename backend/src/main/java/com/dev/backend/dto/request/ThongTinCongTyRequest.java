package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Cập nhật Thông tin cửa hàng (không gồm logo — logo cập nhật qua endpoint upload riêng).
 * Trường null hoặc không gửi = giữ nguyên giá trị đã lưu (mỗi thẻ ở giao diện chỉ gửi phần của mình);
 * chuỗi trắng = xóa, trừ name và legalName (bắt buộc).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ThongTinCongTyRequest {
    /** Tên cửa hàng (tên biển hiệu). */
    String name;
    /** Tên đăng ký kinh doanh, ghi đúng giấy chứng nhận đăng ký. */
    String legalName;
    /** Mã số thuế: trống = không có; 10 số, 10-3 số hoặc 12 số (bỏ khoảng trắng, dấu chấm trước khi kiểm). */
    String taxCode;
    String email;
    String phone;
    /** Địa chỉ đăng ký (ghi đúng giấy chứng nhận đăng ký). */
    String address;
}
