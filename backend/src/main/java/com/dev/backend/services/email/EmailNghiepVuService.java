package com.dev.backend.services.email;

import com.dev.backend.dto.response.inbound.BienBanTraHangDto;
import com.dev.backend.entities.BienBanTraHangNcc;
import com.dev.backend.entities.DonMuaHang;
import com.dev.backend.entities.NguoiDung;

import java.time.Instant;
import java.util.function.BooleanSupplier;

/**
 * Cửa duy nhất để các nghiệp vụ gửi email. Nơi gọi chỉ truyền entity; lớp cài đặt tự dựng dữ liệu cho mẫu
 * NGAY trong transaction đang mở (đọc các quan hệ LAZY lúc còn phiên), rồi gửi SAU KHI transaction commit.
 * Transaction rollback thì không gửi. Không có transaction thì đưa vào hàng đợi gửi ngay.
 *
 * Mọi hàm trừ {@link #guiMaDangNhapCong} và {@link #guiMaDuyetTraHang} không ném lỗi gửi thư ra nơi gọi: lỗi SMTP
 * được thử lại và ghi log ở lớp cài đặt. Thông tin cửa hàng (tên, logo, tên đăng ký, mã số thuế, địa chỉ, điện thoại, email) do lớp
 * cài đặt tự đọc từ Thông tin cửa hàng; nơi gọi không truyền.
 */
public interface EmailNghiepVuService {

    // ---------------- Email nhân sự ----------------

    /** E1 · Mã đặt lại mật khẩu. {@code taoLuc} là lúc tạo mã, {@code hetHanLuc} = taoLuc + thời hạn mã. */
    void guiMaDatLaiMatKhau(NguoiDung nguoiDung, String ma, Instant taoLuc, Instant hetHanLuc);

    /**
     * E2 · Tài khoản mới, kèm liên kết đặt mật khẩu dùng một lần. {@code maDatMatKhau} là mã gốc trong liên kết
     * (không lưu ở đâu khác), {@code hetHanLuc} là hạn của liên kết.
     */
    void guiTaiKhoanMoi(NguoiDung nguoiDung, String maDatMatKhau, Instant hetHanLuc);

    /** E3 · Quản trị viên cấp lại mật khẩu lúc {@code luc}: liên kết đặt mật khẩu mới, hết hạn lúc {@code hetHanLuc}. */
    void guiCapLaiMatKhau(NguoiDung nguoiDung, String maDatMatKhau, Instant luc, Instant hetHanLuc);

    /** M4 · Mật khẩu vừa được thay đổi (không gửi khi quản trị viên cấp lại, đã có E3). */
    void guiDaDoiMatKhau(NguoiDung nguoiDung, CachDoiMatKhau cach, Instant luc);

    // ---------------- Email nhà cung cấp ----------------

    /**
     * E4 · Yêu cầu báo giá, một email cho một đơn (một nhà cung cấp). Gọi sau khi đơn và các dòng đã lưu
     * (đã có id). Gửi được thì ghi {@code don_mua_hang.ngay_gui_yeu_cau} (transaction riêng, giữ ngay_cap_nhat).
     */
    default void guiYeuCauBaoGia(DonMuaHang don) {
        guiYeuCauBaoGia(don, null);
    }

    /**
     * E4 kèm hạn báo giá (in trong thư: nhà cung cấp gửi được đến hết ngày này). {@code hanBaoGia} null: đơn gửi trước
     * khi có hạn, thư không có dòng hạn.
     */
    void guiYeuCauBaoGia(DonMuaHang don, java.time.LocalDate hanBaoGia);

    /**
     * E4 bản nhắc hạn: còn một ngày tới hạn mà nhà cung cấp chưa báo giá. Cùng nội dung E4, tiêu đề và câu mở đầu nhắc
     * hạn. Chỉ gửi khi đơn còn chờ báo giá; gửi được mà lần đầu chưa gửi được thì cũng ghi ngay_gui_yeu_cau.
     */
    void guiNhacHanBaoGia(DonMuaHang don, java.time.LocalDate hanBaoGia);

    /**
     * M2 bản hết hạn: đơn đã sang Hết hạn (8) mà nhà cung cấp chưa báo giá; yêu cầu đã đóng, không cần gửi nữa. Chỉ gửi
     * khi đơn vẫn ở 8.
     */
    void guiHetHanBaoGia(DonMuaHang don, java.time.LocalDate hanBaoGia);

    /**
     * E5 · Mã đăng nhập Cổng nhà cung cấp. Đăng nhập theo email (mọi nhà cung cấp có email đó, kể cả đã ngừng hợp tác
     * vì còn việc cũ), không theo đơn; thư không có người phụ trách riêng. Gửi NGAY, đồng bộ, không chờ commit.
     *
     * @param tenNhaCungCap tên in ở "Kính gửi …": email thuộc nhiều nhà cung cấp thì ghép tên ("A, B, C +2"); null hoặc
     *                      trống thì ghi "Kính gửi Quý công ty"
     * @throws EmailKhongGuiDuocException khi không gửi được (nơi gọi xóa mã và trả CHUA_GUI_DUOC_MA).
     */
    void guiMaDangNhapCong(String emailNhan, String tenNhaCungCap, String ma, Instant hetHanLuc);

    /** M3 · Đã nhận báo giá. Gọi sau khi đã ghi đơn giá, tổng tiền, ngayBaoGia, ghiChuNhaCungCap. */
    void guiDaNhanBaoGia(DonMuaHang don);

    /** M1 · Xác nhận đặt hàng. Gọi sau khi đơn đã chuyển sang trạng thái chấp nhận (3). */
    void guiXacNhanDatHang(DonMuaHang don);

    /**
     * M2 · Kết quả báo giá. Bản "đã báo giá, không được chọn" khi {@code don.getNgayBaoGia() != null},
     * ngược lại bản "yêu cầu đã kết thúc". Lý do lấy từ {@code don.getLyDoTuChoi()}, trống thì không hiện.
     */
    void guiKetQuaBaoGia(DonMuaHang don);

    /**
     * E6 · Mã PIN duyệt trả hàng quá hạn gửi một quản lý cửa hàng. Gửi NGAY, đồng bộ (thu ngân đang chờ ở quầy).
     *
     * @throws EmailKhongGuiDuocException khi không gửi được (nơi gọi bỏ mã của người này, thử người khác).
     */
    void guiMaDuyetTraHang(NguoiDung quanLy, MaDuyetTraHangThongTin thongTin, String ma, Instant hetHanLuc);

    // ---------------- Biên bản trả hàng nhà cung cấp ----------------

    /**
     * E7 · Biên bản trả hàng gửi nhà cung cấp, kèm PDF biên bản: số sản phẩm không đạt, giá trị (đơn giá dòng đơn mua
     * cùng biến thể), hàng lỗi đang ở đâu, việc nhà cung cấp cần chọn, hạn trả lời, nút tới Cổng nhà cung cấp. Dựng dữ
     * liệu NGAY trong transaction của nơi gọi, gửi sau commit, có thử lại. Không ném lỗi ra nơi gọi.
     *
     * @param ban         biên bản đã dựng (in PDF)
     * @param loai        GUI (ghi đã ký lần đầu / gửi lại) | CAP_NHAT (ký lại sau khi lập lại, câu trả lời trước không còn
     *                    hiệu lực) | NHAC
     * @param hanTraLoi   hạn trả lời in trong thư
     * @param moTaHangLoi dòng phụ ô "Hàng lỗi" khi hàng đã rời kho (người giao hàng, biển số…); null thì bỏ
     * @param conHieuLuc  kiểm lúc gửi: biên bản còn hiệu lực và vẫn là lần lập này
     * @param khiGuiDuoc  ghi nhật ký đã gửi (luồng gửi thư)
     */
    void guiBienBanTraHang(BienBanTraHangNcc bienBan, BienBanTraHangDto ban, String loai, Instant hanTraLoi,
                           String moTaHangLoi, BooleanSupplier conHieuLuc, Runnable khiGuiDuoc);

    /**
     * M5 · Đã ghi nhận câu trả lời của nhà cung cấp (cách bù, hàng lỗi của từng dòng), hoặc ({@code tuDong}) quá hạn trả
     * lời nên các dòng chưa chọn cách bù đã chuyển trừ tiền. Gửi sau commit, có thử lại.
     */
    void guiDaGhiNhanTraLoi(BienBanTraHangNcc bienBan, BienBanTraHangDto ban, boolean tuDong);

    /**
     * M5 (chọn lại) · Lúc nhập kho không trừ tiền được cho các dòng {@code dongIds} nhà cung cấp đã chọn trừ tiền (đơn
     * mua không còn chờ đủ số này): các dòng đó về chờ chọn, mời nhà cung cấp chọn lại trên cổng. Gửi sau commit.
     */
    void guiCanChonLaiCachBu(BienBanTraHangNcc bienBan, BienBanTraHangDto ban, java.util.List<Integer> dongIds);

    /** M6 · Biên bản trả hàng đã hủy. Gọi sau khi biên bản đã chuyển sang DA_HUY; gửi sau commit, có thử lại. */
    void guiBienBanDaHuy(BienBanTraHangNcc bienBan);

    /** Thông tin yêu cầu in trong thư E6 (đã dựng xong ở nơi gọi, không entity). */
    record MaDuyetTraHangThongTin(String tenCuaHang, String nguoiYeuCau, String soDonHang, Instant thanhToanLuc,
                                  long soNgay, String lyDo) {
    }
}
