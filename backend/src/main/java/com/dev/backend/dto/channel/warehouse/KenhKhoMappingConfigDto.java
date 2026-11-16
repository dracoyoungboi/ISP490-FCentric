package com.dev.backend.dto.channel.warehouse;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * Cấu hình tổng thể về ánh xạ đa kho của một kênh bán hàng.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KenhKhoMappingConfigDto implements Serializable {
    private static final long serialVersionUID = 1L;

    /** Mã kênh bán hàng: "SHOPIFY", "TIKTOK", "LAZADA", "SHOPEE" */
    private String maKenh;

    /** Cờ kích hoạt chế độ đa kho: true khi sàn có từ 2 kho/locations trở lên và người dùng bật */
    @Builder.Default
    private Boolean cheDoDaKho = false;

    /** Tổng số lượng kho / locations hợp lệ phát hiện được từ sàn */
    @Builder.Default
    private Integer soKhoSanHopLe = 1;

    /** Danh sách các cặp ánh xạ kho bán hàng */
    @Builder.Default
    private List<KenhKhoMappingItemDto> danhSachKho = new ArrayList<>();

    /** Thông tin kho trả hàng (dành cho sàn có tách riêng return warehouse như TikTok Shop) */
    private KenhKhoMappingItemDto khoTraHang;

    /** ID kho FCentric mặc định toàn kênh */
    private Integer khoIdMacDinh;

    /** Tên kho FCentric mặc định */
    private String tenKhoMacDinh;

    /** Danh sách tất cả các kho nội bộ FCentric khả dụng (đang hoạt động, không phải KHO_TRANSIT) để chọn trên UI */
    @Builder.Default
    private List<KhoOptionDto> dsKhoFCentricKhaDung = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KhoOptionDto implements Serializable {
        private static final long serialVersionUID = 1L;
        private Integer id;
        private String maKho;
        private String tenKho;
        private String diaChi;
    }
}
