package com.dev.backend.dto.response.entities;

import com.dev.backend.entities.DonBanHang;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

/**
 * DTO for {@link com.dev.backend.entities.PhieuXuatKho}
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class PhieuXuatKhoDto implements Serializable {
    Integer id;
    String soPhieuXuat;
    DonBanHangDto donBanHang;
    KhoDto kho;
    Instant ngayXuat;
    String loaiXuat;
    KhoDto khoChuyenDen;
    Integer trangThai;
    String ghiChu;
    NguoiDungDto nguoiXuat;
    NguoiDungDto nguoiDuyet;
    Instant ngayTao;
    Instant ngayCapNhat;
    private Integer phieuChuyenKhoGocId;
    private String soPhieuChuyenKhoGoc;
    /**
     * Phiếu nhặt của PX-CK (danh_sach_nhat_hang.phieu_xuat_kho_id), trống khi không có (phiếu xuất khác, phiếu cũ chọn lô
     * tay). Có phiếu nhặt chưa hủy thì lô lấy theo phiếu nhặt, giao diện ẩn nút "Chọn lô" (pickLoHang cũng chặn).
     */
    private Integer phieuNhatId;
    private String maPhieuNhat;
    private String trangThaiPhieuNhat;
}