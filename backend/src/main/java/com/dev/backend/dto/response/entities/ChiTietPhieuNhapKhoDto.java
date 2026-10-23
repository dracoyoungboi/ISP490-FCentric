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
    // Số phiếu chuyển kho gốc (hiện ở "Chứng từ liên quan" thay cho chữ chung chung)
    private String soPhieuChuyenKhoGoc;
    Double tienDoKiemDem;
    Integer tongSoLuongLoi;
    Integer tongSoLuongDat;
    Boolean coBienBanRtv;
    String maBienBanRtv;
    Boolean safetyLock;
    Boolean coTheNhapKho;
    /** Tổng lỗi ghi trên biên bản trả hàng đã phát hành (null nếu chưa có biên bản). */
    Integer tongLoiBienBan;
    /** Biên bản đã phát hành nhưng số lỗi không còn khớp kiểm đếm hiện tại: phải lập lại trước khi nhập kho. */
    Boolean bienBanLech;
    String phuongAnBienBan;
    /** Cấu hình KIEM_DEM_XAC_NHAN: QUET_TIEP_LA_DAT | QUET_THE_TUNG_CAI. */
    String cheDoXacNhanChatLuong;
    /** Cấu hình MA_LO_TIEN_TO: tiền tố mã lô gợi ý (mặc định LO). */
    String tienToMaLo;
}
