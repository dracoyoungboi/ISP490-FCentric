package com.dev.backend.dto.response.entities;

import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;

/**
 * DTO for {@link com.dev.backend.entities.YeuCauMuaHang}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class YeuCauMuaHangDto implements Serializable {
    Integer id;
    String soYeuCauMuaHang;
    KhoDto khoNhap;
    Instant ngayGiaoDuKien;
    Integer trangThai;
    String ghiChu;
    NguoiDungDto nguoiTao;
    NguoiDungDto nguoiDuyet;
    Instant ngayTao;
    Instant ngayCapNhat;
    List<ChiTietYeuCauMuaHangDto> chiTietYeuCauMuaHangs;
    // Lấy từ lich_su_thay_doi (không có cột riêng): lý do của lần từ chối gần
    // nhất và thời điểm duyệt/từ chối gần nhất — chỉ điền ở API chi tiết.
    String lyDoTuChoi;
    Instant ngayDuyet;
    List<DonMuaHangDto> donMuaHangs;
    /**
     * Chỉ điền ở API chi tiết: số ngày chờ báo giá đang cấu hình và hạn báo giá nếu gửi yêu cầu ngay lúc này (màn Gửi yêu
     * cầu báo giá hiện trước cho người mua). Xem HanBaoGia.
     */
    Integer soNgayBaoGia;
    java.time.LocalDate hanBaoGiaNeuGui;
}