package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Body (tuỳ chọn) của API duyệt / từ chối yêu cầu nhập hàng.
 * lyDoTuChoi BẮT BUỘC khi từ chối (SRS 4.3.4), bỏ qua khi duyệt.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class DuyetYeuCauMuaHangRequest {
    String lyDoTuChoi;
}
