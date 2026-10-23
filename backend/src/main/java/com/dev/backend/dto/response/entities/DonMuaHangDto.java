package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTO for {@link com.dev.backend.entities.DonMuaHang}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class DonMuaHangDto implements Serializable {
    Integer id;
    String soDonMua;
    // Yêu cầu nhập hàng gốc (rút gọn). Trước đây DTO thiếu trường này nên ô "Yêu cầu mua hàng gốc" luôn trống.
    YeuCauMuaHangRutGonDto yeuCauMuaHang;
    NhaCungCapDto nhaCungCap;
    KhoDto khoNhap;
    Instant ngayDatHang;
    Instant ngayGiaoDuKien;
    Integer trangThai;
    BigDecimal tongTien;
    String ghiChu;
    /** Lần cuối nhà cung cấp gửi báo giá. "Đã báo giá" ⇔ ngayBaoGia != null; gửi lại làm ngayBaoGiaDaXem khi xét. */
    Instant ngayBaoGia;
    /** Lúc email yêu cầu báo giá gửi được; null = chưa gửi được (hiện nút Gửi lại, K11). */
    Instant ngayGuiYeuCau;
    /** Ghi chú nhà cung cấp gửi kèm báo giá (là một phần của báo giá). */
    String ghiChuNhaCungCap;
    /** Lý do không chấp nhận (có thể trống). */
    String lyDoTuChoi;
    /**
     * Máy chủ tính (K1): đơn tự đóng vì đã chấp nhận báo giá khác cùng yêu cầu (đơn ở 4, không người duyệt, yêu cầu
     * đã chọn nhà cung cấp). Xem DonMuaHangService.khongDuocChon.
     */
    Boolean khongDuocChon;
    /**
     * Máy chủ tính (K11): email yêu cầu báo giá chưa gửi được (đơn ở 2, chưa báo giá, ngayGuiYeuCau trống, yêu cầu ở 3,
     * đơn tạo quá DonMuaHangService.GUI_LAI_E4_SAU_PHUT phút). FE không tự tính mốc thời gian.
     */
    Boolean chuaGuiDuocYeuCau;
    NguoiDungDto nguoiTao;
    NguoiDungDto nguoiDuyet;
    Instant ngayTao;
    Instant ngayCapNhat;
    List<ChiTietDonMuaHangDto> chiTietDonMuaHangs;

}