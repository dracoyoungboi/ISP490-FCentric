package com.dev.backend.dto.response.entities;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CauHinhHeThongDto {
    private String maCauHinh;
    private String giaTri;
    private String kieuDuLieu;
    private String moTa;
    private LocalDateTime ngayCapNhat;
    private Integer nguoiCapNhatId;
    private String nguoiCapNhatTen;
}