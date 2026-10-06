package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DonChoXuatFilterRequest {
    String searchText;       // Nhập mã đơn hàng...
    Integer kenhBanId;       // Kênh bán (Shopee, Shopify, Lazada...)
    Integer khoId;           // Kho xuất (nếu admin chọn, nếu nhân viên/quản lý kho thì lấy từ SecurityContext)
    Instant tuNgay;          // Từ ngày tạo
    Instant denNgay;         // Đến ngày tạo

    @Builder.Default
    Integer page = 0;

    @Builder.Default
    Integer size = 20;

    @Builder.Default
    String sortBy = "ngayDatHang";

    @Builder.Default
    String sortDir = "desc";
}

