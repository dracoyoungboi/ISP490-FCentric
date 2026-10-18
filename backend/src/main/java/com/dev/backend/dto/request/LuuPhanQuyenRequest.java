package com.dev.backend.dto.request;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;

/**
 * Lưu phân quyền của một người dùng trong một lần (ngăn kéo Phân quyền ở trang chi tiết người dùng):
 * vai trò, kho phụ trách, hạn hiệu lực và TẬP QUYỀN ĐẦY ĐỦ tại kho đó.
 * Quyền không có trong {@code quyenHanIds} sẽ bị thu hồi.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@ToString
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LuuPhanQuyenRequest {
    /** Mã vai trò, ví dụ nhan_vien_kho. */
    String vaiTro;
    /** Kho phụ trách. Bỏ trống với Quản trị viên, Khách hàng, hoặc khi chưa phân kho. */
    Integer khoId;
    /** Hết hiệu lực sau thời điểm này; null = không thời hạn. */
    Instant ngayKetThuc;
    /** Id các quyền được bật tại kho; null hoặc rỗng = không có quyền nào. */
    List<Integer> quyenHanIds;
}
