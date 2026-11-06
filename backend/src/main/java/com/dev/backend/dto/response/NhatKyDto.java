package com.dev.backend.dto.response;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Một dòng lich_su_thay_doi cho ngăn "Lịch sử thay đổi" của danh mục dữ liệu. giaTriCu / giaTriMoi là chuỗi JSON nguyên
 * văn (frontend tự đọc); nguoiThucHienId trống khi việc do hệ thống / sàn làm (xem nguon).
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NhatKyDto {
    Integer id;
    String loaiThamChieu;
    Integer idThamChieu;
    String maDoiTuong;
    String hanhDong;
    String giaTriCu;
    String giaTriMoi;
    String ghiChu;
    // nguoi_dung / he_thong / shopify / lazada / tiktok / shopee / nha_cung_cap; dòng cũ trống = người dùng
    String nguon;
    Integer nguoiThucHienId;
    String nguoiThucHienTen;
    String nguoiThucHienTenDangNhap;
    Integer khoId;
    String tenKho;
    Instant ngayThucHien;
}
