package com.dev.backend.dto.response;

import java.util.List;

/**
 * Dữ liệu màn Tạo yêu cầu nhập hàng (GET /api/v1/nghiep-vu/yeu-cau-mua-hang/hang-kho-tong): Kho tổng nhận hàng,
 * các Kho tổng chọn được, cấu hình ngưỡng và mọi biến thể nhập được kèm số liệu ở Kho tổng.
 * Giao diện dùng chung một danh sách này cho ô tìm, Gợi ý cần nhập, Dán từ Excel, các cột số và cảnh báo.
 *
 * @param kho          Kho tổng đang xem (null khi chưa có Kho tổng đang hoạt động)
 * @param dsKhoTong    các Kho tổng đang hoạt động (nhiều kho thì màn cho chọn)
 * @param nguongMacDinh ngưỡng tồn tối thiểu mặc định (cấu hình DEFAULT_MIN_STOCK_ALERT)
 * @param heSoDu       hệ số dư (cấu hình SURPLUS_STOCK_RATIO): khả dụng + đang về vượt ngưỡng × hệ số này là "còn dư"
 */
public record HangNhapKhoTongResponse(KhoTong kho, List<KhoTong> dsKhoTong, int nguongMacDinh, int heSoDu,
                                      List<BienThe> bienThe) {

    public record KhoTong(Integer id, String maKho, String tenKho, String diaChi, String quanLy) {}

    /** Yêu cầu nhập hàng chưa thành đơn mua có mã này: yêu cầu mới nhất và số yêu cầu đang mở. */
    public record YeuCauMo(Integer id, String ma, long soYeuCau) {}

    /**
     * Một biến thể nhập được (biến thể đang bán, sản phẩm chưa ngừng hoạt động).
     *
     * @param daTungNhap    đã từng có lô ở Kho tổng; chưa từng nhập thì không có số đề xuất (như Tổng quan)
     * @param soLuongDeXuat 0 khi không cần nhập; còn lại đưa (khả dụng + đang về) lên gấp đôi ngưỡng
     * @param du            khả dụng + đang về vượt ngưỡng × hệ số dư
     */
    public record BienThe(Integer bienTheId, String maSku, String maVach, Integer sanPhamId, String maSanPham,
                          String tenSanPham, String nhomHang, String tenMau, String maMauHex, String tenSize,
                          String tenChatLieu, String anh, long khaDung, long dangVe, int nguong, boolean daTungNhap,
                          long soLuongDeXuat, boolean du, YeuCauMo yeuCauMo) {}
}
