package com.dev.backend.dto.channel.warehouse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * Payload cập nhật ánh xạ kho sàn TMĐT với kho nội bộ FCentric từ giao diện.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KenhKhoMappingUpdateRequest implements Serializable {
    private static final long serialVersionUID = 1L;

    /** Bật/tắt chế độ đa kho */
    @Builder.Default
    private Boolean cheDoDaKho = false;

    /** Danh sách các cặp ánh xạ kho bán hàng */
    @Valid
    @Builder.Default
    private List<KenhKhoMappingItemDto> danhSachKho = new ArrayList<>();

    /** Kho trả hàng (nếu có) */
    private KenhKhoMappingItemDto khoTraHang;

    /** ID kho FCentric mặc định dự phòng */
    private Integer khoIdMacDinh;
}
