package com.dev.backend.dto.request;

import lombok.*;

import java.util.List;

/**
 * Lưu cả bảng thuế suất GTGT (Cấu hình › Thuế GTGT) trong một lần: dong là toàn bộ bảng sau khi sửa (dòng không gửi lên
 * sẽ bị xóa); inThue = công tắc In thuế GTGT trên hóa đơn, null = giữ nguyên; idDaXem = id các dòng lúc trang tải bảng
 * (có dòng khác trong bảng thì người khác vừa thêm: báo 409 thay vì xóa mất; null = không kiểm).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ThueSuatCaBangRequest {
    private Boolean inThue;
    private List<ThueSuatGtgtRequest> dong;
    private List<Integer> idDaXem;
}
