package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Một ô ảnh sản phẩm khi cập nhật, theo đúng thứ tự hiển thị (ô đầu tiên là ảnh chính).
 * Có id: giữ lại ảnh đang có (id của anh_quan_ao). Có viTriTep: ảnh mới, là chỉ số tệp trong phần anhSanPhams.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class AnhSanPhamSapXep {
    Integer id;
    Integer viTriTep;
}
