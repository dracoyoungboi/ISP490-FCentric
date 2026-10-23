package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TransferDetailDto {
    private Integer id;
    private String soPhieuXuat;
    private String khoXuatTen;
    private Integer khoXuatId;
    private String khoNhapTen;
    private Integer khoNhapId;
    private String nguoiXuatTen;
    private String nguoiDuyetTen;
    private Instant ngayTao;
    private Integer trangThai;
    private String ghiChu;
    private List<TransferItemDto> items;

    @Data
    @Builder
    public static class TransferItemDto {
        private Integer bienTheId;
        private String sku;
        private String tenSanPham;
        private BigDecimal soLuongYeuCau;
        private BigDecimal soLuongDaPick; // Để theo dõi tiến độ khi ở trạng thái 2
        // Thông tin biến thể để bảng hàng vẽ giống các chứng từ khác (gom theo sản phẩm, chấm màu, kích cỡ, ảnh).
        // tenSanPham vẫn giữ dạng cũ "<Tên sản phẩm> - <Tên màu>" cho các nơi đang đọc trường này.
        private Integer sanPhamId;
        private String tenMau;
        private String maMauHex;
        private String kichCo;
        private String anh;
    }
}
