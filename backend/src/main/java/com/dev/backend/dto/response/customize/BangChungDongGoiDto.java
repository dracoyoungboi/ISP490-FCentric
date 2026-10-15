package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BangChungDongGoiDto implements Serializable {
    Integer id;
    Integer donBanHangId;
    Integer phieuXuatKhoId;
    Integer pickListId;
    Integer tepTinId;
    String loaiBangChung;
    String tenLoaiBangChung;
    String loaiTep;
    Integer thoiLuongGiay;
    Long kichThuocBytes;
    String duongDanMinio;
    String urlPublic;
    Integer nguoiTaoId;
    String tenNguoiTao;
    Instant ngayTao;
    Instant ngayHetHan;
    Integer trangThai;
    String ghiChu;
}
