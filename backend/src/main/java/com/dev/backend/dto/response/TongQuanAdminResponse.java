package com.dev.backend.dto.response;

import java.util.List;

/**
 * Dữ liệu màn Tổng quan của quản trị viên (GET /api/v1/admin/dashboard/tong-quan), làm lại 28/11/2026 theo đặc tả bản 2.
 *
 * <ul>
 *   <li>Tiền tính bằng đồng (VND), số lượng là số cái; số nguyên, chưa định dạng.</li>
 *   <li>Thời điểm dạng "yyyy-MM-dd'T'HH:mm:ss", ngày "yyyy-MM-dd", đều theo giờ Việt Nam.</li>
 *   <li>Khối nào truy vấn lỗi thì để null và có tên trong {@code khoiLoi}; các khối khác vẫn trả về (UC 11.1, luồng A2).</li>
 *   <li>Doanh thu: tiền hàng đơn đã xuất đủ, sau giảm giá, không gồm thuế GTGT và phí vận chuyển; hàng trả và đơn hoàn trừ
 *       vào ngày trả. Khối Tồn kho, Cần xử lý, Hoạt động không đổi theo kỳ.</li>
 * </ul>
 */
public record TongQuanAdminResponse(
        String thoiDiem,
        Ky ky,
        Integer khoId,
        List<Kho> danhSachKho,
        /** Ngày đặt đơn bán sớm nhất: lịch chọn khoảng không cho chọn trước ngày này. */
        String ngayDauDuLieu,
        List<String> khoiLoi,
        KetQua ketQua,
        BieuDo bieuDo,
        PhanBo phanBo,
        List<SanPhamBanChay> banChay,
        TonKho tonKho,
        List<Viec> viecCanXuLy,
        HoatDong hoatDong
) {

    public static final String KHOI_KET_QUA = "ketQua";
    public static final String KHOI_BIEU_DO = "bieuDo";
    public static final String KHOI_PHAN_BO = "phanBo";
    public static final String KHOI_BAN_CHAY = "banChay";
    public static final String KHOI_TON_KHO = "tonKho";
    public static final String KHOI_VIEC = "viecCanXuLy";
    public static final String KHOI_HOAT_DONG = "hoatDong";

    /**
     * Kỳ đang xem: [tu, den) và kỳ so sánh [tuTruoc, denTruoc); đường kỳ trước trên biểu đồ vẽ từ bieuDoTruocTu tới
     * bieuDoTruocDen. nhom: gio | ngay | thang; kieuSoSanh: tuan_truoc | lien_truoc | thang_truoc | nam_truoc.
     */
    public record Ky(String ma, String tu, String den, String tuTruoc, String denTruoc, String bieuDoTruocTu,
                     String bieuDoTruocDen, String nhom, int soDiem, String kieuSoSanh, boolean dangChay) {}

    /** Kho đang hoạt động (không gồm kho trung chuyển). ngayMo: ngày tạo kho, để biết kho mới mở. */
    public record Kho(Integer id, String maKho, String tenKho, boolean laKhoTong, String ngayMo) {}

    /**
     * Tổng của một khoảng. doanhThu = tienHangXuat − tienHangTra − thueGtgt; loiNhuan = doanhThu − giaVonXuat + giaVonTraTot
     * (giá vốn hàng trả bị lỗi không cộng lại); soDon = donXuat − donTra.
     */
    public record TongSo(long doanhThu, long tienHangXuat, long tienHangTra, long thueGtgt, long giaVonXuat,
                         long giaVonTraTot, long giaVonTraLoi, long loiNhuan, long donXuat, long donTra, long soDon) {}

    /** Dải số đầu trang. homQuaCungGio chỉ có khi xem Hôm nay. Chờ xuất: đơn đặt trong kỳ, chưa xuất, chưa hủy. */
    public record KetQua(TongSo nay, TongSo truoc, TongSo homQuaCungGio, long choXuatSoDon, long choXuatTien,
                         /** Kho đang xem (hoặc các kho, khi xem tất cả) mở sau đầu kỳ so sánh. */
                         List<Integer> khoMoTrongKySoSanh) {}

    /** Một điểm của biểu đồ: vị trí tính từ đầu khoảng (giờ, ngày hoặc tháng thứ mấy). */
    public record Diem(int viTri, long doanhThu, long loiNhuan, long soDon) {}

    /** nay: các điểm đã có của kỳ đang xem (điểm chưa tới không có); truoc: đường kỳ trước. */
    public record BieuDo(List<Diem> nay, List<Diem> truoc) {}

    /**
     * Phân bổ doanh thu. Xem tất cả kho: theoKho + theoKenh. Xem một kho: theoNhom (danh mục gốc) + theoKenh (kênh có đơn ở kho
     * đó); kho là cửa hàng thì thêm theoNhanVien (người lập đơn bán tại quầy).
     */
    public record PhanBo(List<DongKho> theoKho, List<DongKenh> theoKenh, List<DongNhom> theoNhom,
                         List<DongNhanVien> theoNhanVien) {}

    public record DongKho(Integer khoId, String tenKho, boolean laKhoTong, String ngayMo, long doanhThu, long soDon,
                          long doanhThuTruoc) {}

    /** soDonXuat: đơn xuất trong kỳ; soDonHoan: trong số đó, đơn tới nay đã bị hoàn hoặc trả hết. */
    public record DongKenh(String maKenh, String tenKenh, long doanhThu, long soDonXuat, long soDonHoan, long doanhThuTruoc) {}

    public record DongNhom(Integer danhMucId, String tenNhom, long doanhThu, long doanhThuTruoc) {}

    public record DongNhanVien(Integer nguoiId, String hoTen, long doanhThu, long soDon) {}

    /** Bán chạy: xếp theo số cái đã trừ hàng trả; anh là ảnh đại diện của sản phẩm (null khi chưa có). */
    public record SanPhamBanChay(Integer sanPhamId, String maSanPham, String tenSanPham, String anh, long soLuong,
                                 long doanhThu) {}

    /**
     * Tồn kho hiện tại. coTheBan = tonThucTe − giuDon − giuChuyen − giuKhac (mỗi mã mỗi kho không dưới 0, nên tổng có thể lệch
     * vài cái so với phép trừ các tổng). giaTri: theo giá vốn lô; xem tất cả kho thì gồm giaTriDangChuyen.
     */
    public record TonKho(long giaTri, long giaTriDangChuyen, long tonThucTe, long giuDon, long giuChuyen, long giuKhac,
                         long coTheBan, long dangVe, long dangChuyenDi, long dangChuyenDen, long hangLoiChoTra,
                         long soMa, long soKho, long het, long sap, long binhThuong, long du, long giaTriDu,
                         Long duChamBan, int soNgayChamBan, int nguongMacDinh,
                         List<TonKhoKho> theoKho, CanBoSung canBoSung) {}

    public record TonKhoKho(Integer khoId, String tenKho, boolean laKhoTong, long giaTri, long coTheBan, long het, long sap) {}

    /** Mã hết / sắp hết của kho đang xem (chỉ khi xem một kho). */
    public record CanBoSung(long tong, List<DongBoSung> dong) {}

    /**
     * khoTongCon: số có thể bán của mã ở Kho tổng (null khi kho đang xem là Kho tổng); dangVe: đơn mua chưa về kho này.
     * deXuat: chuyen_kho (Kho tổng còn đủ) hoặc yeu_cau_nhap; soLuongDeXuat đưa có thể bán về gấp đôi ngưỡng.
     */
    public record DongBoSung(Integer bienTheId, Integer sanPhamId, String maSku, String tenSanPham, String tenMau,
                             String tenKichCo, long coTheBan, int nguong, Long khoTongCon, long dangVe, String deXuat,
                             long soLuongDeXuat) {}

    /**
     * Một loại việc. so: tổng số; ma, ten, kho, kho2, moc: chứng từ đứng đầu (cũ nhất / trễ nhất) để ghi dòng phụ; soPhu,
     * soPhu2: số kèm theo tùy loại; kenh: lỗi đồng bộ theo kênh; khoId: kho của chứng từ đứng đầu.
     */
    /** thamChieuId: id để mở đúng trang xử lý (traNcc: nhà cung cấp của biên bản chờ lâu nhất), loại khác null. */
    public record Viec(String loai, long so, String ma, String ten, String kho, String kho2, String moc, long soPhu,
                       long soPhu2, Integer khoId, Integer thamChieuId, List<ViecKenh> kenh) {}

    public record ViecKenh(Integer kenhId, String maKenh, String tenKenh, long so) {}

    /** Hoạt động 2 ngày gần nhất (hôm qua và hôm nay), mới nhất trước; homNay = số sự kiện hôm nay (trước khi gộp). */
    public record HoatDong(long homNay, List<SuKien> ds) {}

    /**
     * loai: ban_quay | don_moi | xuat | huy | hoan | tra_quay | nhap_kho | chuyen | nhan_du | nhan_thieu | kiem_ke.
     * khoId2 / tenKho2: kho bên kia của chuyển kho. soNhan: số cái kho nhận đếm được (nhận chuyển kho).
     * trangThai: trạng thái hiện tại của đợt kiểm kê ("2" chờ duyệt, "3" đã duyệt).
     */
    public record SuKien(String loai, Integer id, String ma, String thoiGian, Integer khoId, String tenKho, Integer khoId2,
                         String tenKho2, String nguoi, String maKenh, String tenKenh, Long soTien, Long soLuong, Long soMa,
                         boolean coYeuCauHuy, boolean coHangLoi, Long soNhan, String trangThai) {}
}
