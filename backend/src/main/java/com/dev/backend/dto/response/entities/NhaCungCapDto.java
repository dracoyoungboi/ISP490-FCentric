package com.dev.backend.dto.response.entities;

import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NhaCungCapDto {
    private Integer id;
    private String maNhaCungCap;
    private String tenNhaCungCap;
    private String nguoiLienHe;
    private String soDienThoai;
    private String email;
    private String diaChi;
    /** Mã ngân hàng theo VietQR (mã BIN), dùng tạo mã QR khi thanh toán đơn mua. */
    private String nganHang;
    /** Số tài khoản nhận tiền của nhà cung cấp. */
    private String soNganHang;
    private Integer trangThai;      // 0 = Ngừng hoạt động, 1 = Hoạt động
    private Instant ngayTao;
    private Instant ngayCapNhat;
}
