package com.dev.backend.services.email;

import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;

import java.time.Instant;

/**
 * Cửa duy nhất để các nghiệp vụ gửi email. Nơi gọi chỉ truyền entity; lớp cài đặt tự dựng dữ liệu cho mẫu
 * NGAY trong transaction đang mở (đọc các quan hệ LAZY lúc còn phiên), rồi gửi SAU KHI transaction commit.
 * Transaction rollback thì không gửi. Không có transaction thì đưa vào hàng đợi gửi ngay.
 *
 * Mọi hàm trừ {@link #guiMaXacNhanBaoGia} không ném lỗi gửi thư ra nơi gọi: lỗi SMTP được thử lại và ghi log
 * ở lớp cài đặt. Thông tin cửa hàng (tên, logo, tên đăng ký, mã số thuế, địa chỉ, điện thoại, email) do lớp
 * cài đặt tự đọc từ Thông tin cửa hàng; nơi gọi không truyền.
 */
public interface EmailNghiepVuService {

    // ---------------- Email nhân sự ----------------

    /** E1 · Mã đặt lại mật khẩu. {@code taoLuc} là lúc tạo mã, {@code hetHanLuc} = taoLuc + thời hạn mã. */
    void guiMaDatLaiMatKhau(NguoiDung nguoiDung, String ma, Instant taoLuc, Instant hetHanLuc);

    /** E2 · Tài khoản mới, kèm mật khẩu tạm (cả khi quản trị viên tự gõ mật khẩu). */
    void guiTaiKhoanMoi(NguoiDung nguoiDung, String matKhauTam);

    /** E3 · Quản trị viên cấp lại mật khẩu; {@code luc} là thời điểm cấp lại. */
    void guiCapLaiMatKhau(NguoiDung nguoiDung, String matKhauTam, Instant luc);

    /** M4 · Mật khẩu vừa được thay đổi (không gửi khi quản trị viên cấp lại, đã có E3). */
    void guiDaDoiMatKhau(NguoiDung nguoiDung, CachDoiMatKhau cach, Instant luc);

    // ---------------- Email nhà cung cấp ----------------

    /**
     * E4 · Yêu cầu báo giá, một email cho một đơn (một nhà cung cấp). Gọi sau khi đơn và các dòng đã lưu
     * (đã có id). Gửi được thì ghi {@code don_mua_hang.ngay_gui_yeu_cau} (transaction riêng, giữ ngay_cap_nhat).
     */
    void guiYeuCauBaoGia(DonMuaHang don);

    /**
     * E5 · Mã xác nhận báo giá. Gửi NGAY, đồng bộ, không chờ commit.
     *
     * @throws EmailKhongGuiDuocException khi không gửi được (nơi gọi xóa mã và trả CHUA_GUI_DUOC_MA).
     */
    void guiMaXacNhanBaoGia(DonMuaHang don, String emailNhan, String ma, Instant hetHanLuc);

    /** M3 · Đã nhận báo giá. Gọi sau khi đã ghi đơn giá, tổng tiền, ngayBaoGia, ghiChuNhaCungCap. */
    void guiDaNhanBaoGia(DonMuaHang don);

    /** M1 · Xác nhận đặt hàng. Gọi sau khi đơn đã chuyển sang trạng thái chấp nhận (3). */
    void guiXacNhanDatHang(DonMuaHang don);

    /**
     * M2 · Kết quả báo giá. Bản "đã báo giá, không được chọn" khi {@code don.getNgayBaoGia() != null},
     * ngược lại bản "yêu cầu đã kết thúc". Lý do lấy từ {@code don.getLyDoTuChoi()}, trống thì không hiện.
     */
    void guiKetQuaBaoGia(DonMuaHang don);
}
