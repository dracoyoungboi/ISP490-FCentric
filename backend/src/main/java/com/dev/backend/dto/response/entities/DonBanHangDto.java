package com.dev.backend.dto.response.entities;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO for {@link com.dev.backend.entities.DonBanHang}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class DonBanHangDto implements Serializable {
    Integer id;
    String soDonHang;
    String loaiChungTu;
    KhachHangDto khachHang;
    KhoDto khoXuat;
    Instant ngayDatHang;
    Instant ngayGiaoHang;
    Integer trangThai;
    BigDecimal tienHang;
    BigDecimal phiVanChuyen;
    BigDecimal tongCong;
    BigDecimal thueSuatGtgt;
    BigDecimal tienThueGtgt;
    String trangThaiThanhToan;
    String diaChiGiaoHang;
    String ghiChu;
    String lyDoTuChoi;
    NguoiDungDto nguoiTao;
    NguoiDungDto nguoiDuyet;
    Instant ngayTao;
    Instant ngayCapNhat;
    /** null = đơn bán thường (tạo trên hệ thống, không qua sàn/POS). */
    KenhBanHangTomTatDto kenhBanHang;
    /** Mã đơn bên sàn (vd. #1016 của Shopify); null với đơn không từ sàn. */
    String maDonHangKenh;
    /** Cờ đơn hàng có yêu cầu hủy từ sàn (vd. TikTok Shop). */
    Boolean yeuCauHuy;
    String maVanDon;
    String donViVanChuyen;
    String maKienHang;

    // === CÁC TRƯỜNG DÀNH CHO VẬN ĐƠN SÀN AWB CHUẨN 100x150MM ===
    /** Tiền thu hộ COD (0 nếu đã thanh toán, hoặc bằng tongCong nếu COD). */
    BigDecimal tienThuHoCod;
    /** Nhãn tiền thu hộ: "THU HỘ(COD): 62.200 VNĐ" hoặc "ĐÃ THANH TOÁN (COD: 0 đ)". */
    String nhanThanhToan;
    /** Tag chỉ dẫn giao nhận sàn: "ĐƯỢC ĐỒNG KIỂM" hoặc "KHÔNG ĐỒNG KIỂM". */
    String chiDanDongKiem;
    /** Tổng khối lượng kiện hàng (KG), vd: 0.3. */
    BigDecimal tongKhoiLuongKg;
    /** Mã chia chọn định tuyến (Sort code / Routing code), vd: "3-BNO-TAP". */
    String maDinhTuyen;
    /** Mã trạm bưu tá / trạm phát cuối cùng, vd: "BN237B-00-00-03". */
    String maTramPhat;
    /** Tag thời gian giao nhận: "WKD" (Weekend) hoặc "OFC" (Office). */
    String tagGiaoNhan;
    /** Chuỗi nội dung QR code. */
    String chuoiQrCode;
    /** Đơn vị lấy hàng, vd: "BEST EXPRESS". */
    String donViPickup;
    /** Đơn vị giao hàng, vd: "BEST EXPRESS". */
    String donViDelivery;
    /** Loại dịch vụ vận chuyển sàn, vd: "STANDARD". */
    String loaiDichVu;
}
