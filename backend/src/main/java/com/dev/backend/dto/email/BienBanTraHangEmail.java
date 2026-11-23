package com.dev.backend.dto.email;

import java.util.List;

/**
 * E7 · Biên bản trả hàng gửi nhà cung cấp (lập mới, lập lại khi số lỗi đổi, gửi lại, nhắc hạn). PDF biên bản đính kèm.
 *
 * @param capNhat      biên bản lập lại: tiêu đề và câu mở đầu nói số lỗi đã cập nhật, câu trả lời trước không còn
 *                     hiệu lực
 * @param nhac         thư nhắc hạn trả lời
 * @param hanTraLoi    "30/11/2026": trả lời trước hết ngày này
 * @param choCachBu    nhà cung cấp còn phải chọn giao bù / trừ tiền
 * @param choHangLoi   nhà cung cấp còn phải chọn nhận lại / tiêu hủy hàng lỗi còn ở kho
 * @param soSanPham    tổng số lượng lỗi (cộng các dòng)
 * @param tongSoLuong  "4 cái" chỉ khi mọi dòng cùng đơn vị tính; khác nhau thì null
 * @param coGia        mọi dòng đều có đơn giá ở đơn mua: hiện cột giá trị, ô "Giá trị hàng lỗi", số tiền trừ
 * @param tongGiaTri   "1.820.000" (cuối bảng); null khi không có giá
 * @param tongGiaTriDong "1.820.000 ₫" (ô Giá trị hàng lỗi, khối việc cần chọn); null khi không có giá
 * @param noiHangLoi   ô "Hàng lỗi đang ở": tên kho, hoặc "Đã giao trả" / "Đã tiêu hủy"
 * @param moTaNoiHangLoi dòng phụ của ô trên: địa chỉ kho, hoặc mô tả nơi gọi truyền (người giao hàng, biển số); null thì bỏ
 * @param hangConOKho  hàng lỗi còn ở kho của chúng tôi
 * @param daTra        hàng lỗi đã giao trả (người giao hàng mang về, nhà cung cấp đến lấy, gửi vận chuyển)
 * @param cauKy        câu người giao hàng đã ký biên bản giấy; null thì bỏ (biên bản cũ)
 * @param duongDanCong cổng nhà cung cấp kèm ?bienBan=&email= (đã mã hóa)
 */
public record BienBanTraHangEmail(String tenNhaCungCap, String maBienBan, String maDon, String soPhieuNhap,
                                  boolean capNhat, boolean nhac, String hanTraLoi, boolean choCachBu,
                                  boolean choHangLoi, long soSanPham, String tongSoLuong, boolean coGia,
                                  String tongGiaTri, String tongGiaTriDong, String noiHangLoi,
                                  String moTaNoiHangLoi, boolean hangConOKho, boolean daTra,
                                  List<DongTraHangEmail> dong, String cauKy, String duongDanCong) {

    public BienBanTraHangEmail {
        dong = List.copyOf(dong);
    }
}
