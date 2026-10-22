package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
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
}
