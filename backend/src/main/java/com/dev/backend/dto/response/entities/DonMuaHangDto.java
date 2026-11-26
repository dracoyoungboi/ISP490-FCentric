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
    /**
     * Máy chủ tính (HanBaoGia.boSung): hạn nhà cung cấp được báo giá, tính đến hết ngày (giờ Việt Nam). Chỉ có ở đơn đã
     * gửi yêu cầu báo giá và chỉ điền ở các API danh sách / chi tiết đơn mua và chi tiết yêu cầu nhập hàng.
     */
    java.time.LocalDate hanBaoGia;
    /**
     * Đơn còn ở 2, chưa báo giá mà đã qua hạn: màn hiện Hết hạn ngay, không đợi lượt xét hạn (8:00) đổi trạng thái sang
     * 8. Đơn đã ở 8 thì cờ này false (đọc trạng thái).
     */
    Boolean quaHanBaoGia;
    /**
     * Đơn đã đóng (6) / đã hủy (7): lý do, lúc và họ tên người thao tác lần gần nhất, lấy từ lich_su_thay_doi
     * (DonMuaHangService.boSungKetThuc). Chỉ điền ở API chi tiết; đơn khác để null.
     */
    String lyDoKetThuc;
    Instant ngayKetThuc;
    String nguoiKetThuc;
    /**
     * Máy chủ tính (DonMuaHangService.boSungPhaiTra), không lưu cột: số phải trả nhà cung cấp = đơn giá × số tính tiền
     * của từng dòng. Đơn còn mở / đã nhận đủ: đặt − lỗi đã trừ tiền. Đã đóng: hàng đạt đã nhận (phần không giao không
     * trả). Đã hủy: null. {@code tongTien} vẫn là tiền theo số đặt (phiếu in, báo giá).
     */
    BigDecimal phaiTra;
    /** Tiền theo số đặt (cộng các dòng): phaiTra + giamTruLoi + khongGiao. */
    BigDecimal tienTheoDat;
    /** Tiền hàng lỗi nhà cung cấp đã chọn trừ tiền, và số sản phẩm. */
    BigDecimal giamTruLoi;
    Integer soLoiTruTien;
    /** Đơn đã đóng khi giao thiếu: tiền và số sản phẩm không giao (không trả). Đơn khác: 0. */
    BigDecimal khongGiao;
    Integer soKhongGiao;
    /** Số sản phẩm lỗi chưa chốt cách bù với nhà cung cấp (số phải trả còn có thể giảm). */
    Integer soLoiChoChot;
    NguoiDungDto nguoiTao;
    NguoiDungDto nguoiDuyet;
    Instant ngayTao;
    Instant ngayCapNhat;
    List<ChiTietDonMuaHangDto> chiTietDonMuaHangs;

}