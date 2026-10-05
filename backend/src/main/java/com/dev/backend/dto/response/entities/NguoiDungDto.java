package com.dev.backend.dto.response.entities;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;

/**
 * DTO for {@link com.dev.backend.entities.NguoiDung}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class NguoiDungDto implements Serializable {
    Integer id;
    @NotNull
    @Size(max = 50)
    String tenDangNhap;
    @NotNull
    @Size(max = 100)
    String hoTen;
    @Size(max = 100)
    String email;
    @Size(max = 20)
    String soDienThoai;
    @NotNull
    String vaiTro;
    Integer trangThai;
    Instant ngayTao;
    Instant ngayCapNhat;
    Boolean mustChangePassword;
    // URL công khai (đã chuẩn hóa HTTPS) của ảnh đại diện; null = chưa có ảnh
    String avatarUrl;
    private List<PhanQuyenNguoiDungKhoDto> khoPhuTrach;
    // Kho đang phụ trách (đang hoạt động, còn hiệu lực) cho hồ sơ cá nhân — chỉ gồm mã kho + tên kho
    private List<KhoPhuTrachInfoDto> khoPhuTrachActive;
}