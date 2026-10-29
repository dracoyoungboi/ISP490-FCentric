package com.dev.backend.dto.response;

import java.util.List;

/**
 * Màn Tổng quan của quản lý kho, nhân viên kho, nhân viên mua hàng và nhân viên bán hàng
 * (GET /api/v1/tong-quan/cua-toi). Chỉ một trong bốn phần quanLyKho / nhanVienKho / muaHang / banHang có dữ liệu,
 * đúng với {@code vaiTro}.
 *
 * - Tiền tính bằng đồng (VND), số lượng là số sản phẩm; đều là số nguyên, chưa định dạng.
 * - Ngày dạng "yyyy-MM-dd", thời điểm dạng "yyyy-MM-dd'T'HH:mm:ss", đều theo giờ Việt Nam.
 * - Khối nào truy vấn lỗi thì để null và có tên trong {@code khoiLoi}; các khối khác vẫn trả về.
 * - Mảng theo ngày luôn đủ số ngày, ngày không có số liệu là 0, xếp từ cũ đến mới, phần tử cuối là hôm nay.
 */
public record TongQuanVaiTroResponse(
        String vaiTro,
        String thoiDiem,
        Kho kho,
        CauHinh cauHinh,
        List<String> khoiLoi,
        QuanLyKho quanLyKho,
        NhanVienKho nhanVienKho,
        MuaHang muaHang,
        BanHang banHang
) {

    public static final String VAI_TRO_QUAN_LY_KHO = "quan_ly_kho";
    public static final String VAI_TRO_NHAN_VIEN_KHO = "nhan_vien_kho";
    public static final String VAI_TRO_MUA_HANG = "nhan_vien_mua_hang";
    public static final String VAI_TRO_BAN_HANG = "nhan_vien_ban_hang";

    /* Tên khối (dùng trong khoiLoi) */
    public static final String KHOI_CHI_SO = "chiSo";
    public static final String KHOI_TON_KHO = "tonKho";
    public static final String KHOI_NGHIEP_VU = "nghiepVu";
    public static final String KHOI_VIEC = "viec";
    public static final String KHOI_NHAP_XUAT = "nhapXuat";
    public static final String KHOI_BO_SUNG = "boSung";
    public static final String KHOI_CUA_BAN = "cuaBan";
    public static final String KHOI_HOM_NAY = "homNay";
    public static final String KHOI_VIEC_CHUNG = "viecChung";
    public static final String KHOI_SAP_VE = "sapVe";
    public static final String KHOI_QUY_TRINH = "quyTrinh";
    public static final String KHOI_LICH = "lich";
    public static final String KHOI_NHA_CUNG_CAP = "nhaCungCap";
    public static final String KHOI_CAN_MUA = "canMua";
    public static final String KHOI_THEO_GIO = "theoGio";
    public static final String KHOI_DON = "don";
    public static final String KHOI_BAO_GIA = "baoGia";
    public static final String KHOI_BAN_CHAY = "banChay";

    /** Kho làm việc (header kho_id). Nhân viên mua hàng không theo kho: null. */
    public record Kho(Integer id, String tenKho, boolean laKhoTong, Integer khoTongId) {}

    /**
     * Ngưỡng đang dùng (cấu hình hệ thống, chưa cấu hình thì lấy mặc định) để giao diện ghi đúng chữ:
     * gioChoLau = PICK_WAIT_WARN_HOURS, ngayChoBaoGia = RFQ_WAIT_WARN_DAYS, ngayTheoDoiBaoGia = QUOTE_FOLLOWUP_DAYS.
     */
    public record CauHinh(int gioChoLau, int ngayChoBaoGia, int ngayTheoDoiBaoGia) {}

    /** Một điểm theo ngày (hoặc theo tuần: ngay là ngày đầu tuần). */
    public record Diem(String ngay, long giaTri) {}

    /**
     * Số của hôm nay tính đến bây giờ, cùng giờ ở kỳ so sánh (hôm qua hoặc cùng thứ tuần trước), 7 ngày gần nhất
     * (phần tử cuối là hôm nay) và số chứng từ (nếu có nghĩa).
     */
    public record SoHomNay(long homNay, long cungGioTruoc, List<Diem> bayNgay, long soChungTu) {}

    /* ================================ QUẢN LÝ KHO ================================ */

    public record QuanLyKho(ChiSoKho chiSo, TonKho tonKho, NghiepVu nghiepVu, List<Viec> viec,
                            List<DiemNhapXuat> nhapXuat, BoSung boSung) {}

    /** doanhThu chỉ có ở kho bán hàng (Kho tổng: null). */
    public record ChiSoKho(SoHomNay nhap, SoHomNay xuat, SoHomNay doanhThu, DonChoXuat donChoXuat) {}

    /** Đơn bán của kho còn phải xử lý (chờ nhặt, chờ đóng gói, chờ xuất, đã xuất một phần); choLau: đặt quá N giờ. */
    public record DonChoXuat(long tong, long choLau) {}

    public record TonKho(long khaDung, long giaTri, long soDong, long het, long thieu, long binhThuong, long du) {}

    public record NghiepVu(NhanHang nhanHang, NhatHang nhatHang, DongGoi dongGoi, XuatKho xuatKho,
                           ChuyenKho chuyenKho, long kiemKeDangMo) {}

    /**
     * phieuChoNhap: phiếu nhập Nháp của kho. dangVe / treHan: đơn mua Đang vận chuyển về kho còn hàng chưa nhận
     * (trễ = quá ngày giao dự kiến). dangChuyenDen: phiếu chuyển Đang vận chuyển đến kho.
     */
    public record NhanHang(long phieuChoNhap, long dangVe, long treHan, long dangChuyenDen) {}

    /** choGomPhieu: đúng danh sách Đơn chờ xuất (đơn chưa vào phiếu nhặt). */
    public record NhatHang(long choGomPhieu, long dangNhat, long chuaPhanCong) {}

    public record DongGoi(long choDongGoi, long choLau) {}

    /** phieuChoXuat: phiếu xuất bán Chờ xuất; chuyenChoXuat: phiếu chuyển của kho đã duyệt, chờ xuất hàng. */
    public record XuatKho(long phieuChoXuat, long chuyenChoXuat) {}

    /** Phiếu chuyển có kho này là kho gửi hoặc kho nhận, đúng như danh sách Chuyển kho nội bộ. */
    public record ChuyenKho(long choDuyet, long choXuatHang, long dangVanChuyen) {}

    /**
     * Việc chờ quản lý kho quyết. loai: duyet_yeu_cau_nhap, duyet_phieu_chuyen, xu_ly_chenh_lech_chuyen, gom_phieu_nhat,
     * phan_cong_nhat, hoan_tat_kiem_ke. cuNhat: thời điểm của chứng từ chờ lâu nhất; moTa: tên đợt kiểm kê cũ nhất (nếu có).
     */
    public record Viec(String loai, long so, String cuNhat, String moTa, boolean gap) {}

    public record DiemNhapXuat(String ngay, long nhap, long xuat) {}

    /** tongSo: số mã Hết hàng + Sắp hết của kho (bằng thẻ Tồn kho); dong: tệ nhất trước. */
    public record BoSung(long tongSo, List<DongBoSung> dong) {}

    /**
     * deXuat: "chuyen_kho" (Kho tổng còn đủ để chuyển) hoặc "yeu_cau_nhap" (nhập từ nhà cung cấp về Kho tổng).
     * khaDungKhoTong: số Kho tổng có thể chuyển (null khi dòng là Kho tổng hoặc chưa có Kho tổng).
     * yeuCauMoId / yeuCauMoMa: yêu cầu nhập hàng đang mở (Nháp → Đã gửi yêu cầu báo giá) mới nhất có mã này.
     */
    public record DongBoSung(Integer bienTheId, String maSku, String tenSanPham, String tenMau, String tenKichCo,
                             long khaDung, int nguong, Long khaDungKhoTong, String deXuat, long soLuongDeXuat,
                             Integer yeuCauMoId, String yeuCauMoMa) {}

    /* ================================ NHÂN VIÊN KHO ================================ */

    public record NhanVienKho(List<PhieuNhatCuaBan> cuaBan, HomNayCuaBan homNay, ViecChung viecChung,
                              SapVe sapVe) {}

    /**
     * Phiếu nhặt đang giao cho bạn. daQuet / canNhat: số sản phẩm. soPhieuChuyen: số phiếu chuyển khi là phiếu nhặt của
     * phiếu chuyển kho (không có đơn), phiếu gom đơn bán thì null.
     */
    public record PhieuNhatCuaBan(Integer id, String ma, String trangThai, long soDon, long daQuet, long canNhat,
                                  String ngayTao, String soPhieuChuyen) {}

    /** Bạn đã làm hôm nay ở kho này: nhận (phiếu nhập đã nhập kho), nhặt (phiếu nhặt xong), xuất (phiếu đã xuất). */
    public record HomNayCuaBan(long sanPhamDaNhap, long phieuDaNhap, long sanPhamDaNhat, long phieuDaNhat,
                               long phieuDaXuat) {}

    public record ViecChung(NhomViec nhanHang, NhomViec nhatHang, NhomViec dongGoi, NhomViec xuatKho,
                            NhomViec kiemKe) {}

    /** tong: tổng số việc; ds: tối đa 8 việc chờ lâu nhất trước. */
    public record NhomViec(long tong, List<DongViec> ds) {}

    /**
     * loai: phieu_nhap, phieu_nhat, don_ban, phieu_xuat, phieu_chuyen, kiem_ke (quyết định đường dẫn).
     * doiTac: nhà cung cấp / kho gửi / khách hàng / kho nhận / số phiếu chuyển (phiếu nhặt của phiếu chuyển kho);
     * soLuong: số sản phẩm (0 nếu chưa có dòng);
     * soDon: số đơn trong phiếu nhặt; thoiDiem: lúc chứng từ bắt đầu chờ; choLau: chờ quá N giờ.
     */
    public record DongViec(String loai, Integer id, String ma, String doiTac, long soLuong, long soDon,
                           String thoiDiem, boolean choLau) {}

    public record SapVe(long tong, List<HangSapVe> ds) {}

    /** loai: don_mua (từ nhà cung cấp) hoặc phieu_chuyen (từ kho khác). ngay: ngày giao dự kiến / ngày xuất. */
    public record HangSapVe(String loai, Integer id, String ma, String doiTac, long soLuong, String ngay,
                            boolean tre) {}

    /* ================================ NHÂN VIÊN MUA HÀNG ================================ */

    public record MuaHang(ChiSoMua chiSo, QuyTrinh quyTrinh, List<DonHangVe> lich,
                          List<NhaCungCapDong> nhaCungCap, CanMua canMua) {}

    public record ChiSoMua(DatMua datMua, DangVe dangVe, GiaoDungHan giaoDungHan, ChoBaoGia choBaoGia) {}

    /** Giá trị đơn mua đã chốt 30 ngày qua (gồm hôm nay), 30 ngày liền trước, và 8 tuần gần nhất. */
    public record DatMua(long tong, long kyTruoc, List<Diem> tamTuan) {}

    public record DangVe(long soLuong, long soDon) {}

    /** Đơn mua đến hạn giao trong 30 ngày qua (không gồm hôm nay) và số giao đủ, đúng hạn; kỳ trước liền kề. */
    public record GiaoDungHan(long dungHan, long denHan, long dungHanTruoc, long denHanTruoc) {}

    /** Yêu cầu báo giá đã gửi nhà cung cấp, chưa có báo giá; quaHan: gửi quá N ngày. */
    public record ChoBaoGia(long tong, long quaHan, long soNhaCungCap) {}

    /**
     * Bốn bước: yêu cầu nhập đã duyệt chưa hỏi giá · đã gửi yêu cầu báo giá chưa có báo giá nào · đã có báo giá
     * chờ chọn nhà cung cấp · đơn mua đang giao (trễ = quá ngày giao dự kiến).
     */
    public record QuyTrinh(long daDuyet, long choBaoGia, long choBaoGiaQuaHan, long choChotDon, long dangGiao,
                           long dangGiaoTre) {}

    public record DonHangVe(Integer id, String ma, String nhaCungCap, long conLai, String ngayGiao, boolean tre) {}

    public record NhaCungCapDong(Integer id, String ten, long giaTri, long dungHan, long denHan) {}

    public record CanMua(long tongSo, Integer khoTongId, List<DongCanMua> dong) {}

    /** khaDung / dangVe / nguong ở Kho tổng; soLuongDeXuat đưa (khả dụng + đang về) lên gấp đôi ngưỡng. */
    public record DongCanMua(Integer bienTheId, String maSku, String tenSanPham, String tenMau, String tenKichCo,
                             long khaDung, long dangVe, int nguong, long soLuongDeXuat, Integer yeuCauMoId,
                             String yeuCauMoMa) {}

    /* ================================ NHÂN VIÊN BÁN HÀNG ================================ */

    public record BanHang(ChiSoBan chiSo, TheoGio theoGio, List<DonCuaToi> don, List<BaoGiaCuaToi> baoGia,
                          List<BanChayDong> banChay) {}

    public record ChiSoBan(SoHomNay doanhThu, DonHomNay donHomNay, TrungBinhDon trungBinhDon,
                           DonCuaToiTom donCuaToi) {}

    /** Đơn mới hôm nay của kho (trừ nháp, đã hủy); taiQuay: đơn tạo từ quầy POS. */
    public record DonHomNay(long soDon, long taiQuay, long cungGioTruoc, List<Diem> bayNgay) {}

    /** Doanh thu ÷ số đơn đã giao: hôm nay và 7 ngày trước đó; null khi chưa có đơn. bayNgay: từng ngày (0 = chưa có). */
    public record TrungBinhDon(Long homNay, Long bayNgayTruoc, List<Diem> bayNgay) {}

    /** Đơn bán do bạn tạo chưa xong; canChuY: nháp hoặc chờ quá N giờ. */
    public record DonCuaToiTom(long tong, long canChuY, long giaTri) {}

    /** Doanh thu từng giờ (chưa cộng dồn): hôm nay từ 0 giờ đến giờ hiện tại, cùng thứ tuần trước cả 24 giờ. */
    public record TheoGio(int gioHienTai, List<Long> homNay, List<Long> tuanTruoc) {}

    /** chuY: "nhap" (chưa gửi kho), "cho_lau" (chờ quá N giờ) hoặc null. */
    public record DonCuaToi(Integer id, String ma, String khachHang, long giaTri, int trangThai, String ngayDat,
                            String chuY) {}

    public record BaoGiaCuaToi(Integer id, String ma, String khachHang, long giaTri, String ngayTao,
                               boolean quaHan) {}

    public record BanChayDong(Integer sanPhamId, String maSanPham, String tenSanPham, long daBan, long conLai) {}

    /* ================================ TRA TỒN ================================ */

    /** Kết quả tra tồn (GET /api/v1/tong-quan/cua-toi/tra-ton). */
    public record TraTonSanPham(Integer id, String ma, String ten, Long giaThapNhat, Long giaCaoNhat,
                                List<TraTonBienThe> bienThe) {}

    /** taiKho: khả dụng ở kho làm việc; khoKhac: cộng các kho khác; dangVe: đang chuyển đến / đơn mua đang về kho. */
    public record TraTonBienThe(Integer id, String maSku, String tenMau, String tenKichCo, long taiKho, long khoKhac,
                                long dangVe) {}
}
