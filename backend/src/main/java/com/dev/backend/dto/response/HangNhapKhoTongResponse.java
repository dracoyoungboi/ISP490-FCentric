package com.dev.backend.dto.response;

import java.util.List;

/**
 * Dữ liệu màn Tạo yêu cầu nhập hàng (GET /api/v1/nghiep-vu/yeu-cau-mua-hang/hang-kho-tong): Kho tổng nhận hàng,
 * các Kho tổng chọn được, cấu hình DSS hiện hành và mọi biến thể đang bán kèm số liệu tồn, điểm đặt hàng lại (ROP),
 * tồn an toàn (SS), số đề xuất đặt (Q) và trạng thái bán chậm / xả hàng / ngừng nhập tính 100% theo mô hình DSS.
 * Giao diện dùng chung một danh sách này cho ô tìm, Gợi ý cần nhập, Dán từ Excel, các cột số và cảnh báo.
 *
 * @param kho        Kho tổng đang xem (null khi chưa có Kho tổng đang hoạt động)
 * @param dsKhoTong  các Kho tổng đang hoạt động (nhiều kho thì màn cho chọn)
 * @param cauHinhDss cấu hình mô hình DSS đang áp dụng (chế độ, kịch bản, chu kỳ quan sát và dự trữ)
 * @param bienThe    danh sách biến thể đang kinh doanh kèm chỉ số DSS tại Kho tổng
 */
public record HangNhapKhoTongResponse(
        KhoTong kho,
        List<KhoTong> dsKhoTong,
        CauHinhDss cauHinhDss,
        List<BienThe> bienThe
) {

    public record KhoTong(Integer id, String maKho, String tenKho, String diaChi, String quanLy) {}

    /** Cấu hình mô hình DSS đang áp dụng tại thời điểm tải danh mục hàng nhập. */
    public record CauHinhDss(
            String cheDo,
            String kichBanChung,
            int chuKyQuanSatN,
            double heSoPhucVuZ,
            int chuKyDuTruT,
            int tangTruongCaoDiemG,
            int chuKyChienDichCaoDiem,
            int soNgayDemLeanB,
            int ngayConLaiXaHang
    ) {}

    /** Yêu cầu nhập hàng chưa thành đơn mua có mã này: yêu cầu mới nhất và số yêu cầu đang mở. */
    public record YeuCauMo(Integer id, String ma, long soYeuCau) {}

    /**
     * Một biến thể nhập được (biến thể đang bán, sản phẩm chưa ngừng hoạt động), đồng bộ 100% với DSS.
     *
     * @param khaDung          tồn khả dụng thực tế (FTU) tại Kho tổng
     * @param dangVe           số lượng chưa nhận từ đơn mua đã chốt về Kho tổng
     * @param nguong           điểm đặt hàng lại (ROP) tính bởi DSS (0 nếu đang ngừng nhập hoặc chưa có sức bán)
     * @param daTungNhap       đã từng có lô tại Kho tổng
     * @param soLuongDeXuat    số lượng đề xuất đặt Q từ DSS khi needsReorder = true và chưa khóa ngừng nhập; còn lại = 0
     * @param du               cờ cần chú ý bán chậm / tồn dư xả hàng theo DSS (deadStock || excessStock > 0 || flashSale)
     * @param yeuCauMo         thông tin yêu cầu nhập hàng khác đang mở có chứa mã này
     * @param tonAnToan        tồn kho an toàn (Safety Stock) tính bởi DSS
     * @param tonDuXaHang      số lượng tồn dư cần xả trong kịch bản Ngừng nhập & Xả hàng
     * @param goiYXaHang       DSS khuyến nghị Flash Sale / xả hàng
     * @param tonCham          hàng bán chậm 30 ngày không phát sinh đơn hoặc DOI vượt 60 ngày
     * @param khoaTaoYeuCau    đang ở kịch bản Ngừng nhập & Xả hàng (PRESET_04_PHASE_OUT)
     * @param phanLoaiAbc      hạng Pareto doanh thu (A / B / C)
     * @param mucDoKhanCap     mức độ ưu tiên nhập (CRITICAL / HIGH / NORMAL / EXCESS_OR_PHASE_OUT)
     * @param kichBanApDung    mã kịch bản DSS áp dụng cho biến thể
     * @param soNgayTonKho     số ngày tồn kho dự kiến (DOI), null nếu chưa có nhu cầu bán
     * @param banTrungBinhNgay nhu cầu bán trung bình mỗi ngày (D_avg) trong cửa sổ N ngày
     */
    public record BienThe(
            Integer bienTheId, String maSku, String maVach, Integer sanPhamId, String maSanPham,
            String tenSanPham, String nhomHang, String tenMau, String maMauHex, String tenSize,
            String tenChatLieu, String anh, long khaDung, long dangVe, int nguong, boolean daTungNhap,
            long soLuongDeXuat, boolean du, YeuCauMo yeuCauMo,
            long tonAnToan, long tonDuXaHang, boolean goiYXaHang, boolean tonCham, boolean khoaTaoYeuCau,
            String phanLoaiAbc, String mucDoKhanCap, String kichBanApDung, Double soNgayTonKho, double banTrungBinhNgay
    ) {}
}
