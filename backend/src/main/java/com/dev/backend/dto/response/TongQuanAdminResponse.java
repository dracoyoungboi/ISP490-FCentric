package com.dev.backend.dto.response;

import java.util.List;

/**
 * Dữ liệu màn Tổng quan của quản trị viên (GET /api/v1/admin/dashboard/tong-quan).
 *
 * - Tiền tính bằng đồng (VND), số lượng là số sản phẩm; đều là số nguyên, chưa định dạng.
 * - Ngày dạng "yyyy-MM-dd", thời điểm dạng "yyyy-MM-dd'T'HH:mm:ss" theo giờ của CSDL (giờ Việt Nam).
 * - Khối nào truy vấn lỗi thì để null và có tên trong {@code khoiLoi}; các khối khác vẫn trả về (UC 11.1, luồng A2).
 */
public record TongQuanAdminResponse(
        String thoiDiem,
        String ky,
        Integer khoId,
        List<Kho> danhSachKho,
        List<String> khoiLoi,
        ChiSo chiSo,
        DoanhThu doanhThu,
        List<DoanhThuKho> doanhThuTheoKho,
        List<Kenh> theoKenh,
        ViecCanXuLy viecCanXuLy,
        TonKho tonKho,
        NhapXuat nhapXuat,
        List<SanPhamBanChay> sanPhamBanChay,
        HangCanBoSung hangCanBoSung,
        List<HoatDong> hoatDongGanDay
) {

    public static final String KHOI_CHI_SO = "chiSo";
    public static final String KHOI_DOANH_THU = "doanhThu";
    public static final String KHOI_DOANH_THU_THEO_KHO = "doanhThuTheoKho";
    public static final String KHOI_THEO_KENH = "theoKenh";
    public static final String KHOI_VIEC_CAN_XU_LY = "viecCanXuLy";
    public static final String KHOI_TON_KHO = "tonKho";
    public static final String KHOI_NHAP_XUAT = "nhapXuat";
    public static final String KHOI_SAN_PHAM_BAN_CHAY = "sanPhamBanChay";
    public static final String KHOI_HANG_CAN_BO_SUNG = "hangCanBoSung";
    public static final String KHOI_HOAT_DONG = "hoatDongGanDay";

    /** Kho đang hoạt động (không gồm kho trung chuyển). */
    public record Kho(Integer id, String maKho, String tenKho, boolean laKhoTong) {}

    /** 4 thẻ chỉ số đầu trang. */
    public record ChiSo(
            long doanhThuHomNay,
            long doanhThuCungGioTuanTruoc,
            long soDonGiaoHomNay,
            /** Doanh thu từng giờ hôm nay, từ 0 giờ đến giờ hiện tại. */
            List<Long> doanhThuTheoGio,
            long soDonMoiHomNay,
            long soDonMoiCungGioTuanTruoc,
            /** Số đơn bán mới 14 ngày gần nhất, ngày cuối là hôm nay (chưa hết ngày). */
            List<SoDonNgay> soDonMoiTheoNgay,
            int thang,
            long doanhThuThangNay,
            long loiNhuanThangNay,
            long doanhThuThangTruoc,
            long loiNhuanThangTruoc
    ) {}

    public record SoDonNgay(String ngay, long soDon) {}

    /** Doanh thu và lợi nhuận gộp theo kỳ xem. */
    public record DoanhThu(
            /** "ngay" hoặc "thang". */
            String nhom,
            /** Kỳ đã trọn (không gồm ngày/tháng đang chạy): từ ngày, đến ngày (bao gồm). */
            String tuNgay,
            String denNgay,
            List<Diem> diem,
            long tongDoanhThu,
            long tongLoiNhuan,
            long tongSoDon,
            long doanhThuKyTruoc,
            /** "ky_truoc" (7 hoặc 30 ngày liền trước) hoặc "cung_ky_nam_truoc" (12 tháng). */
            String kieuSoSanh,
            int nam,
            long luyKeNam,
            long caNamTruoc,
            /**
             * Kỳ so sánh chia theo cùng cách (ngày hoặc tháng), chỉ gồm ngày/tháng đã trọn: phần tử thứ i so với
             * phần tử thứ i đã trọn của {@code diem}. Tổng doanh thu bằng {@code doanhThuKyTruoc}.
             */
            List<Diem> diemKyTruoc
    ) {}

    /** Một điểm trên biểu đồ: một ngày hoặc một tháng (tu = ngày đầu). */
    public record Diem(String tu, long doanhThu, long loiNhuan, long soDon, boolean chuaKetThuc) {}

    public record DoanhThuKho(Integer khoId, String tenKho, boolean laKhoTong,
                              long doanhThu, long soDon, long doanhThuKyTruoc) {}

    /** maKenh: mã kênh trong kenh_ban_hang, hoặc POS (bán tại quầy), TRUC_TIEP (đơn tạo tay). */
    public record Kenh(String maKenh, String tenKenh, long doanhThu, long soDon, long soDonHoan) {}

    public record ViecCanXuLy(
            long donNhapChuaGuiKho,
            long donChoXuatKho,
            long phieuNhatChuaPhanCong,
            long phieuXuatChoXuatKho,
            long yeuCauNhapChoDuyet,
            long phieuNhapChoNhapKho,
            long phieuChuyenChoDuyet,
            long phieuChuyenChoXuatHang,
            long dotKiemKeDangMo,
            /** Null khi khối Tồn kho lỗi. */
            Long hetHang,
            Long thieuHang,
            long taiKhoanBiKhoa,
            /**
             * Chỉ có khi xem "Tất cả kho" (khoId = null): bốn việc trên tách theo kho, vì Đơn chờ xuất,
             * Phiếu nhặt hàng và Chuyển kho nội bộ chỉ xem kho làm việc. Null khi đang xem một kho.
             */
            List<ViecTheoKho> theoKho,
            /** Đơn mua đang vận chuyển (trạng thái 3) đã qua ngày giao dự kiến mà chưa nhận đủ hàng. */
            long donMuaQuaHan,
            /**
             * Sản phẩm đồng bộ lỗi theo từng kênh đang hoạt động (cùng số "Lỗi" ở trang Sản phẩm của kênh); chỉ kênh có lỗi.
             * Không lọc theo kho. Null khi không đếm được (các việc khác vẫn trả về).
             */
            List<LoiDongBoKenh> loiDongBo,
            /**
             * Phiếu chuyển kho nhận lệch đang chờ xử lý chênh lệch (quản trị viên luôn xử lý được); kho đang xem là kho
             * xuất hoặc kho nhận của phiếu.
             */
            long phieuChuyenChoXuLyLech
    ) {}

    public record ViecTheoKho(Integer khoId, String tenKho, long donChoXuatKho, long phieuNhatChuaPhanCong,
                              long phieuChuyenChoDuyet, long phieuChuyenChoXuatHang) {}

    public record LoiDongBoKenh(Integer kenhId, String maKenh, String tenKenh, long soLoi) {}

    /**
     * Tồn kho theo 3 con số của SRS (khả dụng = tồn thực tế − đang giữ) và 4 mức tình trạng tính trên
     * từng cặp (kho, biến thể đang kinh doanh): Hết hàng (khả dụng ≤ 0), Thiếu hàng (≤ ngưỡng),
     * Bình thường (≤ ngưỡng × hệ số dư), Dư hàng.
     */
    public record TonKho(
            long tonThucTe,
            long dangGiu,
            long khaDung,
            long giaTri,
            long soBienThe,
            long soDong,
            long hetHang,
            long thieuHang,
            long binhThuong,
            long duHang,
            long dangVe,
            long dangChuyen,
            int nguongMacDinh,
            int heSoDu,
            List<TonKhoKho> theoKho,
            /** Giá trị tồn (theo giá vốn lô) của các dòng Dư hàng. */
            long giaTriDu,
            /**
             * Số dòng Dư hàng không có đơn đã giao nào trong {@code soNgayChamBan} ngày gần nhất (tính ở đúng kho đó).
             * Null khi không đếm được.
             */
            Long duChamBan,
            /** Số ngày xét "chưa bán được" (cấu hình SLOW_MOVING_DAYS, mặc định 60). */
            int soNgayChamBan
    ) {}

    public record TonKhoKho(Integer khoId, String tenKho, boolean laKhoTong,
                            long tonThucTe, long khaDung, long giaTri) {}

    public record NhapXuat(String nhom, List<DiemNhapXuat> diem, long tongNhap, long tongXuat,
                           /** true khi xem tất cả kho: đã bỏ hai chặng của chuyển kho nội bộ. */
                           boolean boChuyenKhoNoiBo) {}

    public record DiemNhapXuat(String tu, long nhap, long xuat, boolean chuaKetThuc) {}

    public record SanPhamBanChay(Integer sanPhamId, String maSanPham, String tenSanPham,
                                 long soLuongBan, long doanhThu, long khaDung,
                                 /** Số ngày của kỳ, để tính lượng bán trung bình mỗi ngày. */
                                 int soNgay) {}

    /**
     * tongSo: số mã Hết hàng + Thiếu hàng (cả hệ thống hoặc kho đang xem). nhom: vài nhóm (sản phẩm, kho) tệ nhất, mỗi nhóm
     * đủ các mã cần bổ sung của nó. dong: các mã của những nhóm đó xếp phẳng (giữ cho bản giao diện cũ).
     */
    public record HangCanBoSung(long tongSo, boolean coKhoTong, List<DongBoSung> dong, List<NhomBoSung> nhom) {}

    /**
     * Các mã cần bổ sung của cùng một sản phẩm tại cùng một kho, mã tệ nhất trước. soHet / soSapHet: số mã khả dụng ≤ 0 /
     * còn khả dụng nhưng ≤ ngưỡng.
     */
    public record NhomBoSung(Integer sanPhamId, String tenSanPham, Integer khoId, String tenKho, boolean laKhoTong,
                             int soHet, int soSapHet, List<DongBoSung> dong) {}

    /**
     * deXuat: "chuyen_kho" (chuyển từ Kho tổng) hoặc "yeu_cau_nhap" (nhập về Kho tổng từ nhà cung cấp).
     * khaDungKhoTong: số Kho tổng có thể chuyển = (tồn − đang giữ) − chờ xuất của đơn bán ở Kho tổng, đúng mức tạo yêu
     * cầu chuyển kho cho phép; choXuatKhoTong: phần chờ xuất đã trừ. Cả hai null khi chưa có Kho tổng hoặc dòng là
     * chính Kho tổng.
     */
    public record DongBoSung(Integer bienTheId, String maSku, String tenSanPham, String tenMau, String tenKichCo,
                             Integer khoId, String tenKho, boolean laKhoTong, long khaDung, int nguong,
                             Long khaDungKhoTong, Long choXuatKhoTong, String deXuat, long soLuongDeXuat) {}

    /**
     * loai: nhap_kho, nhap_chuyen_kho, xuat_kho, xuat_chuyen_kho, don_ban, ban_tai_quay, kiem_ke.
     * doiTac: nhà cung cấp / kho nguồn (nhập), số đơn / kho đích (xuất), kênh (đơn bán), tên đợt (kiểm kê).
     */
    public record HoatDong(String loai, Integer id, String maChungTu, String thoiGian, String tenKho,
                           String nguoiThucHien, Long soLuong, String doiTac, Long soTien) {}
}
