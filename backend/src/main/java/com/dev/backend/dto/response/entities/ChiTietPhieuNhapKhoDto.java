package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;
import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ChiTietPhieuNhapKhoDto {
    Integer id;
    String soPhieuNhap;
    Integer trangThai;
    Instant ngayNhap;
    Integer donMuaHangId;
    String soDonMua;
    Integer nhaCungCapId;
    String tenNhaCungCap;
    Integer khoId;
    String tenKho;
    String loaiNhap;
    String tenKhoChuyenTu;
    private String tenNguoiNhap;
    private String tenNguoiDuyet;
    List<PhieuNhapKhoItemDto> items;
    private Integer phieuXuatGocId;
    Double tienDoKiemDem;
    Integer tongSoLuongLoi;
    Integer tongSoLuongDat;
    Boolean coBienBanRtv;
    String maBienBanRtv;
    Boolean safetyLock;
    Boolean coTheNhapKho;
}
