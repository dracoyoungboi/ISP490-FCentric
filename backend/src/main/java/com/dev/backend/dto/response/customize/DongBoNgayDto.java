package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;

/** Ảnh chụp tiến độ một đợt "Đồng bộ ngay" (đẩy tồn rồi lấy đơn) của một kênh. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DongBoNgayDto {
    String maPhien;
    String maKenh;
    /** dang_chay | xong | loi | da_dung */
    String trangThai;
    /** doc_san_pham | day_ton | lay_don: bước đang chạy, hoặc bước dừng lại khi đã kết thúc */
    String giaiDoan;
    /** Số SKU của đợt đẩy; null khi chưa đọc xong sản phẩm trên Shopify */
    Integer tongSku;
    int daXuLy;
    int soThanhCong;
    int soLoi;
    /** SKU chưa đẩy khi đợt dừng giữa chừng (lỗi cả gian hàng hoặc dừng theo yêu cầu) */
    Integer soChuaDay;
    String skuDangDay;
    /** null khi chưa lấy đơn hoặc bỏ qua bước lấy đơn */
    Integer soDonMoi;
    /** Lý do dừng khi trangThai = loi */
    String loi;
    boolean yeuCauDung;
    String nguoiBam;
    Instant batDau;
    Instant ketThuc;
    /** Đã chạy bao lâu tính tới lúc chụp (hoặc tới lúc kết thúc), theo đồng hồ máy chủ */
    long daChayMs;
    /** Thời gian riêng của bước đẩy tồn tới lúc chụp; null khi chưa tới bước đẩy tồn */
    Long dayTonDaChayMs;
    List<LoiSkuDto> dsLoi;

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class LoiSkuDto {
        String maSku;
        String tenSku;
        String lyDo;
    }
}
