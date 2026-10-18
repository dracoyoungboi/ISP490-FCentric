package com.dev.backend.dto.response.customize;

import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Một sản phẩm FCentric trên trang "Sản phẩm theo sàn": các SKU của sản phẩm đã liên kết với một kênh.
 * Danh sách phân trang theo sản phẩm nên mỗi phần tử luôn có đủ SKU khớp bộ lọc, không bị cắt sang trang khác.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NhomLienKetDto {
    Integer sanPhamId;
    String tenSanPham;
    /** Ảnh đại diện của sản phẩm (ảnh chính, không có thì ảnh đầu); null nếu chưa có ảnh. */
    String anhDaiDien;
    /**
     * Tổng số SKU của sản phẩm đã liên kết với kênh, không phụ thuộc bộ lọc.
     * Lớn hơn số phần tử của {@code bienThe} khi đang lọc theo trạng thái hoặc từ khóa.
     */
    Integer tongPhanLoai;
    /** Các SKU khớp bộ lọc, theo thứ tự màu, chất liệu, kích cỡ. */
    List<LienKetSanPhamDto> bienThe;
}
