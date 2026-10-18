package com.dev.backend.dto.request;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Thay toàn bộ mẫu quyền của một vai trò (Cấu hình › Mẫu quyền theo vai trò). */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CapNhatMauQuyenRequest {
    List<Integer> quyenHanIds;
}
