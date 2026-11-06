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
    /** Mã số thuế, gửi sang kế toán (danh mục nhà cung cấp, chứng từ mua hàng). */
    private String maSoThue;
    private String nguoiLienHe;
    private String soDienThoai;
    private String email;
    private String diaChi;
    // Không trả ngân hàng / số tài khoản (đã bỏ khỏi nhà cung cấp 22/10; số cũ còn trong DB không lộ qua API — DTO này
    // đi kèm cả đơn mua mà vai trò kho xem được)
    private Integer trangThai;      // 0 = Ngừng hoạt động, 1 = Hoạt động
    private Instant ngayTao;
    private Instant ngayCapNhat;
}
