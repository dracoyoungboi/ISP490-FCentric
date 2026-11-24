package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;

/**
 * Nhật ký đăng nhập của MỘT người dùng cho quản trị viên (tab "Đăng nhập" ở Chi tiết người dùng).
 * Dựng từ dữ liệu sẵn có, không thêm bảng: các dòng đăng nhập trong lich_su_thay_doi (dang_nhap, dang_nhap_that_bai) +
 * phiên đang hiệu lực trong phien_dang_nhap. Không có "đăng xuất" (hệ thống không ghi) và không có thiết bị cho từng
 * dòng lịch sử (chỉ IP được lưu); thiết bị hiện ở mục "Thiết bị đang đăng nhập".
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class NhatKyDangNhapNguoiDungDto {

    TomTat tomTat;
    /** Thiết bị đang đăng nhập (chỉ xem — quản trị viên không đăng xuất từng thiết bị của người khác). */
    List<PhienDangNhapDto> phien;
    /** Các lần đăng nhập trong 90 ngày, mới nhất trước. */
    List<DongDangNhap> lichSu;

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class TomTat {
        /** Lần đăng nhập thành công gần nhất (null nếu chưa có). */
        Instant lanGanNhat;
        String lanGanNhatIp;
        /** Số thiết bị đang đăng nhập (phiên còn hiệu lực). */
        int soThietBi;
        /** Số lần đăng nhập sai trong 24 giờ. */
        int soSai24h;
        /** Cần chú ý: sai mật khẩu nhiều lần, hoặc có người nhập đúng mật khẩu khi tài khoản đang khóa. */
        boolean canChuY;
        /** "nhieu_lan_sai" | "khoa_dung_mat_khau" | null. */
        String lyDoChuY;
        /** Số lần sai gần đây để ghép vào câu khung chú ý (chỉ cho "nhieu_lan_sai"). */
        Integer soLanSaiGanDay;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class DongDangNhap {
        Integer id;
        Instant luc;
        /** "thanh_cong" | "sai_mat_khau" | "tai_khoan_khoa". */
        String ketQua;
        String diaChiIp;
    }
}
