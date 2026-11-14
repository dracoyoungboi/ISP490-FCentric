package com.dev.backend.dto.response.ketoan;

import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CauHinhKeToanDto {
    private String hoSo;
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
    private String tkTraLai;
    private String tkHangThieu;
    private String tkHangThua;
    private String maDichVuVanChuyen;
    private String tenDichVuVanChuyen;
    private String hinhThucChuyenKho;
    private String soTkNganHangNhan;
    /** Đã có chứng từ đang khóa trong một lô: đổi ngày mốc lúc này làm tồn đầu kỳ và chứng từ đã giao lệch nhau. */
    private boolean daCoLoXuat;
    private Integer version;
    private Instant ngayCapNhat;
}
