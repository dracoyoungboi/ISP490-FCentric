package com.dev.backend.dto.response.customize;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class KhachHangDetailDto {
    private Integer id;
    private String maKhachHang;
    private String tenKhachHang;
    private String soDienThoai;
    private String email;
    private String diaChi;
    // Bỏ loaiKhachHang
    private List<LichSuMuaHangDto> lichSuMuaHang;
    private Integer tongSoDonHang;
}