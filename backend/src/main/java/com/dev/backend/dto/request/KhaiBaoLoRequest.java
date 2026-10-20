package com.dev.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonFormat;
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
public class KhaiBaoLoRequest {
    Integer bienTheSanPhamId;
    String maLo;
    @JsonFormat(
            shape = JsonFormat.Shape.STRING,
            pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX",
            timezone = "UTC"
    )
    Instant ngaySanXuat;
    BigDecimal soLuongNhap;
    Integer viTriKhoId;
    BigDecimal soLuongLoi;
    /** Cách cũ: một lý do cho cả số lỗi. Có {@link #chiTietLoi} thì bỏ qua trường này. */
    String lyDoLoi;
    BigDecimal giaVon;
    String ghiChu;
    /** Hàng không đạt theo từng lý do; tổng số lượng phải bằng {@link #soLuongLoi}. */
    List<ChiTietLoiRequest> chiTietLoi;
    /**
     * true: chỉ tạo lô mới (màn kiểm đếm). Mã lô đã có trong phiếu cho biến thể này thì báo lỗi thay vì ghi đè.
     * null/false: giữ cách cũ, trùng mã lô thì cập nhật lô đó (màn khai báo lô).
     */
    Boolean taoMoi;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ChiTietLoiRequest {
        String lyDo;
        Integer soLuong;
        String ghiChu;
    }
}
