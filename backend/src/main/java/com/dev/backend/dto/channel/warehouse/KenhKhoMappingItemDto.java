package com.dev.backend.dto.channel.warehouse;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * DTO đại diện cho một cặp ánh xạ giữa kho sàn TMĐT và kho nội bộ FCentric.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KenhKhoMappingItemDto implements Serializable {
    private static final long serialVersionUID = 1L;

    /** Mã kho / Location ID từ sàn TMĐT (ví dụ: "68982939281" trên Shopify hoặc "7702121381413914388" trên TikTok) */
    private String maKhoSan;

    /** Tên kho / Tên địa điểm hiển thị từ sàn TMĐT */
    private String tenKhoSan;

    /** Loại kho sàn: "sales" (kho bán), "return" (kho trả hàng), "fulfillment" (kho hoàn tất) */
    private String loaiKhoSan;

    /** ID kho nội bộ FCentric (khóa ngoại bảng kho) */
    private Integer khoIdFCentric;

    /** Tên kho nội bộ FCentric hiển thị trên giao diện */
    private String tenKhoFCentric;

    /** Bật / tắt đồng bộ tồn kho cho điểm kho này */
    @Builder.Default
    private Boolean kichHoat = true;

    /** Đánh dấu kho này là kho mặc định tiếp nhận đơn hàng khi không xác định được location */
    @Builder.Default
    private Boolean laMacDinh = false;

    /** Tồn khả dụng thực tế hiện tại của kho FCentric tương ứng (phục vụ hiển thị trên UI) */
    private Integer tonKhaDungHienTai;
}

