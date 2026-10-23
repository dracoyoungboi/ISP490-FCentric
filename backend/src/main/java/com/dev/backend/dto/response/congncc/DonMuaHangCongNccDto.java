package com.dev.backend.dto.response.congncc;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Đơn mua trả cho cổng nhà cung cấp (người ngoài, chưa đăng nhập nội bộ). Giữ đúng tên trường cổng đang đọc và
 * liệt kê từng trường (soát chéo 3.2, rủi ro R9): chỉ thông tin nhà cung cấp cần để báo giá và liên hệ người phụ
 * trách. KHÔNG có: người duyệt, yêu cầu nhập hàng, quản lý kho, số lượng đã nhận, thành tiền, giá vốn, giá bán, mã
 * vạch, tài khoản ngân hàng… Dòng xếp theo id tăng dần (cùng số thứ tự với email).
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DonMuaHangCongNccDto implements Serializable {
    Integer id;
    String soDonMua;
    Integer trangThai;
    /** Ngày gửi yêu cầu báo giá ("Đặt ngày" trên cổng). */
    Instant ngayDatHang;
    Instant ngayGiaoDuKien;
    /** Ghi chú của bên mua (cửa hàng) cho đơn. */
    String ghiChu;
    /** Ghi chú nhà cung cấp gửi kèm lần báo giá gần nhất (cột ghi_chu_nha_cung_cap). */
    String ghiChuNCC;
    /** Lần cuối nhà cung cấp gửi báo giá; null = chưa báo giá. */
    Instant ngayBaoGia;
    BigDecimal tongTien;
    Kho khoNhap;
    NhaCungCap nhaCungCap;
    /** Người gửi yêu cầu (dòng "Phụ trách" trên cổng): chỉ tên, điện thoại, email công việc. */
    NguoiPhuTrach nguoiTao;
    List<Dong> chiTietDonMuaHangs;

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class NguoiPhuTrach implements Serializable {
        String hoTen;
        String soDienThoai;
        String email;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Kho implements Serializable {
        String tenKho;
        String diaChi;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class NhaCungCap implements Serializable {
        String tenNhaCungCap;
        /** Chính email nhà cung cấp vừa xác nhận mã (cổng dùng khi trình duyệt mất trạng thái trang). */
        String email;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Dong implements Serializable {
        /** id dòng chi_tiet_don_mua_hang: gửi lại trong chiTietDonMuaHangId khi báo giá. */
        Integer id;
        BienThe bienTheSanPham;
        BigDecimal soLuongDat;
        BigDecimal donGia;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class BienThe implements Serializable {
        Integer id;
        String tenBienThe;
        String tenSanPham;
        Integer sanPhamId;
        String maSku;
        Ten mauSac;
        Ten size;
        Ten chatLieu;
    }

    /** Thuộc tính chỉ lấy tên (tenMau / tenSize / tenChatLieu, đúng tên trường cổng đang đọc). */
    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Ten implements Serializable {
        String tenMau;
        String tenSize;
        String tenChatLieu;
    }
}
