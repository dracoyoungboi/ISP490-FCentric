package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ThongTinBangChungDonDto implements Serializable {
    Integer donBanHangId;
    String soDonHang;
    BigDecimal tongTienDonHang;
    Boolean yeuCauVideo;
    String loaiYeuCau; // "ANH_2_BUOC" hoặc "VIDEO_15_30S" (tên cũ, giữ nguyên; khoảng thời lượng thật ở hai trường dưới)
    /** Khoảng thời lượng video cho phép (giây, gồm cả hai đầu). */
    Integer thoiLuongVideoToiThieu;
    Integer thoiLuongVideoToiDa;
    String huongDan;
    Boolean daDuBangChung;
    Integer soLuongHienCo;
    Integer soLuongYeuCau;
    List<BangChungDongGoiDto> danhSachBangChung;
    /**
     * Đơn đã đóng gói xong mà tệp đã bị dọn sau hạn lưu: ngày hết hạn muộn nhất của các tệp đã dọn (việc dọn chạy 3:30
     * sáng sau ngày này). Null khi còn tệp đang lưu, hoặc đơn chưa từng có bằng chứng (xuất trước khi có bước đóng gói).
     */
    Instant ngayTuXoa;
}
