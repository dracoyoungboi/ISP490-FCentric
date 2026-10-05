package com.dev.backend.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ThuongHieuUpdating {

    @Size(max = 50, message = "Mã thương hiệu tối đa 50 ký tự")
    private String maThuongHieu;

    @Size(max = 100, message = "Tên thương hiệu tối đa 100 ký tự")
    private String tenThuongHieu;

    @Size(max = 2000, message = "Mô tả thương hiệu tối đa 2000 ký tự")
    private String moTa;

    private Integer trangThai;
}