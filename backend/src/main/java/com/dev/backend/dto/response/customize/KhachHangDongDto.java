package com.dev.backend.dto.response.customize;

import com.dev.backend.dto.response.entities.KhachHangDto;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Một dòng của danh sách khách hàng (POST /api/v1/khach-hang/danh-sach, chỉ khách cửa hàng): đủ hồ sơ như
 * {@link KhachHangDto} (popup Sửa mở từ dòng này) + lần mua gần nhất. Tổng chi tiêu, số đơn chỉ ở trang chi tiết (chốt 19/11).
 * Tách khỏi {@link KhachHangDto} (dùng cho thêm / sửa / POS) để phản hồi thêm / sửa không mang lần mua gần nhất: màn
 * hình gộp phản hồi vào dòng đang có, trường null sẽ xóa mất ngày đang hiện.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KhachHangDongDto {
    Integer id;
    String maKhachHang;
    String tenKhachHang;
    String soDienThoai;
    String email;
    String diaChi;
    Integer trangThai;
    Instant ngayTao;
    Instant ngayCapNhat;
    /**
     * Ngày đặt của đơn đã đặt gần nhất trong phạm vi vai trò của người xem (nhân viên bán hàng: đơn mình tạo); null khi
     * chưa có. Khớp ô "Lần mua gần nhất" ở trang chi tiết.
     */
    Instant lanMuaGanNhat;

    public static KhachHangDongDto tu(KhachHangDto kh, Instant lanMuaGanNhat) {
        return KhachHangDongDto.builder()
                .id(kh.getId())
                .maKhachHang(kh.getMaKhachHang())
                .tenKhachHang(kh.getTenKhachHang())
                .soDienThoai(kh.getSoDienThoai())
                .email(kh.getEmail())
                .diaChi(kh.getDiaChi())
                .trangThai(kh.getTrangThai())
                .ngayTao(kh.getNgayTao())
                .ngayCapNhat(kh.getNgayCapNhat())
                .lanMuaGanNhat(lanMuaGanNhat)
                .build();
    }
}
