package com.dev.backend.dto.request;

import lombok.*;

import java.time.LocalDate;

/** Lưu cấu hình kế toán (gửi đủ form). version: chống hai người lưu đè nhau. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CauHinhKeToanRequest {
    private LocalDate ngayMoc;
    private String tkTienMat;
    private String tkNganHang;
    private String tkPhaiThu;
    private String tkDoanhThu;
    private String tkChietKhau;
    private String tkThueDauRa;
    private String tkKho;
    private String tkGiaVon;
    private String tkPhaiTra;
    private String tkThueDauVao;
    private String maDichVuVanChuyen;
    private String tenDichVuVanChuyen;
    private String hinhThucChuyenKho;
    private String soTkNganHangNhan;
    private Integer version;
}
