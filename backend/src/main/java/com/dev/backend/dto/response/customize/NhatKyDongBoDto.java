package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NhatKyDongBoDto {
    Integer id;
    Integer ketNoiKenhId;
    String maKenh;
    String tenHienThi;
    String loai; // SAN_PHAM, TON_KHO, DON_HANG
    String nguon; // SCHEDULED, MANUAL, EVENT
    String trangThai; // THANH_CONG, LOI, DANG_XU_LY, CHO
    String maThamChieu;
    String thongDiep;
    String maLoi;
    String chiTietLoi;
    Instant ngayTao;
    boolean coTheThuLai;
    Long suKienVaoId;
    Map<String, Object> duLieuTomTat;
    Map<String, Object> payload;
}
