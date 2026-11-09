package com.dev.backend.dto.kiemke;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Dữ liệu trả về của API kiểm kê khoanh vùng (/api/v1/kiem-ke). */
public final class KiemKeDto {

    private KiemKeDto() {
    }

    public record Ma(Integer id, String ma, String ten) {
    }

    public record Nguoi(Integer id, String hoTen) {
    }

    public record ViTri(Integer id, String ma, String khuVuc) {
    }

    /** Đếm nhanh của một đợt (thanh tổng hợp, thẻ danh sách). Giá trị ròng có dấu: âm là thiếu. */
    public record ThongKe(int tongDong, int daDem, int chuaDem, int canKiemLai, int daXacNhan, int lech, int thieuLyDo,
                          long tongThieu, long tongThua, BigDecimal giaTriThieu, BigDecimal giaTriThua,
                          BigDecimal giaTriRong) {
    }

    /** Người đang xem được bấm những gì (đã tính trạng thái, quyền, kho đang chọn). */
    public record Quyen(boolean suaNhap, boolean batDau, boolean dem, boolean trinhDuyet, boolean demLai,
                        boolean pheDuyet, boolean huy) {
    }

    public record Dot(Integer id, String ma, String ten, Ma kho, String loaiKiemKe, byte trangThai, long phienBan,
                      int phienBanPhamVi, Nguoi nguoiChuTri, String lyDo, String ghiChu,
                      Instant ngayTao, Instant ngayDuKienBatDau, Instant ngayBatDau, Instant ngayHoanThanh,
                      Instant ngayDuyet, Instant ngayKetThuc, Instant ngayHuy, String lyDoHuy,
                      Nguoi nguoiDuyet, Nguoi nguoiHuy,
                      Ma danhMuc, List<Ma> danhMucChot, List<Ma> khuVuc, List<ViTri> viTri,
                      String cheDoKhoa, int soKeKhoa, ThongKe thongKe, Ma phieuDieuChinh, Quyen quyen) {
    }

    /** Biến thể của dòng; {@code maVach}: mã vạch in trên tem (ô quét khớp cả mã vạch lẫn SKU). */
    public record SanPham(Integer bienTheId, String maSku, String tenSanPham, String tenMau, String maMauHex,
                          String kichCo, String anh, String maVach) {
    }

    public record Anh(Integer id, String url, String moTa, Instant ngayChup, Nguoi nguoiChup, Integer lanKiemDem) {
    }

    public record LanDem(int lanKiemDem, BigDecimal soLuongThucTe, String lyDoChenhLech, Nguoi nguoiKiemDem,
                         Instant ngayKiemDem, Nguoi nguoiYeuCau, String lyDoKiemLai, Instant ngayYeuCau) {
    }

    /**
     * Một dòng kiểm kê (đợt, biến thể, lô, kệ). Số chốt {@code soLuongHeThong} và giá vốn chốt không đổi suốt đợt.
     * {@code soLuongThucTe} null = chưa đếm; khi đó chênh lệch, tỷ lệ, giá trị và loại đều null.
     */
    public record Dong(Integer id, ViTri viTri, Ma loHang, SanPham sanPham, BigDecimal soLuongHeThong,
                       BigDecimal giaVonHeThong, BigDecimal soLuongThucTe, BigDecimal chenhLechSoLuong,
                       BigDecimal tiLeChenhLech, BigDecimal giaTriChenhLech, String loaiChenhLech, int lanKiemDem,
                       byte trangThai, String lyDoChenhLech, String bienPhapXuLy, Nguoi nguoiKiemDem,
                       Instant ngayKiemDem, long phienBan, boolean phatSinh, List<Anh> anh, List<LanDem> lanTruoc) {
    }

    /** noiDung theo ngôn ngữ request; noiDungGoc là câu tiếng Việt (giao diện nhận diện vướng mắc theo câu gốc). */
    public record VanDe(String ma, String noiDung, String noiDungGoc) {
        public VanDe(String ma, String noiDung) {
            this(ma, noiDung, null);
        }
    }

    /** Xem trước phạm vi (UC-STK-01): ước tính lúc xem, Bắt đầu tính lại trong giao dịch. */
    public record XemTruoc(int soViTri, int soDong, int soLo, long tongSoLuong, int soDanhMuc, List<VanDe> vanDe,
                           boolean coTheBatDau) {
    }

    /** Kết quả lệnh (lưu cùng Idempotency-Key ở kiem_ke_lenh). */
    public record KetQuaLenh(Integer dotKiemKeId, byte trangThai, long phienBan, Integer phieuDieuChinhId,
                             String soPhieuDieuChinh) {
    }

    public record TongQuan(long tong, long nhap, long dangKiemKe, long choDuyet, long keCoKhoa) {
    }

    public record NhatKy(String hanhDong, String noiDung, Nguoi nguoi, Instant luc) {
    }

    /** Một lô trên kệ ở sơ đồ khóa: {@code dangKiemKe} = không xuất được lúc này vì kiểm kê. */
    public record LoTrenKe(Integer loHangId, String maLo, String maSku, String tenSanPham, int soLuong, boolean dangKiemKe) {
    }

    /**
     * Một kệ ở sơ đồ khóa. {@code khoa}: toan_ke · theo_lo · null. {@code trangThai}: trạng thái vận hành lưu ở kệ
     * (HOAT_DONG, DAY_HANG, BAO_TRI, KHOA_KIEM_KE).
     */
    public record KeSoDo(Integer id, String ma, String trangThai, Integer sucChua, int dangChua, String khoa,
                         List<Ma> dot, List<LoTrenKe> lo) {
    }

    public record KhuVucSoDo(Integer id, String ma, String ten, List<KeSoDo> ke) {
    }

    public record SoDo(Ma kho, List<KhuVucSoDo> khuVuc, int keKhoaToan, int keKhoaMin, int keBaoTri) {
    }

    /** Lô tìm được ở hộp Thêm lô phát sinh. */
    public record LoTim(Integer loHangId, String maLo, SanPham sanPham) {
    }

    /**
     * Hàng trên sổ kệ của một danh mục ở kho, GỘP cả cây con (đúng như phạm vi kiểm kê theo danh mục): {@code soKe} số kệ
     * khác nhau đang có hàng của danh mục hoặc danh mục con, {@code soLuong} tổng sản phẩm trên các kệ đó.
     */
    public record DanhMucTrenKe(Integer danhMucId, int soKe, long soLuong) {
    }

    /**
     * Lô còn hàng chưa có kệ ở kho (Đ4). {@code dangGiuNhat}: phần chưa có kệ phiếu nhặt đang giữ (người nhặt lấy ở đó),
     * chưa xếp lên kệ được — số xếp được = chuaCoKe − dangGiuNhat. {@code dangKiemKe}: cả lô đang thuộc đợt kiểm kê toàn
     * kho / theo danh mục, chưa xếp được tới khi đợt kết thúc. {@code keGoiY} null khi không có kệ nào chọn được;
     * {@code keLienQuan}: các kệ cùng kho đang liên quan tới lô theo thứ tự gợi ý, kể cả kệ không chọn được (để nói vì
     * sao không có gợi ý). {@code nguon}: chứng từ nhập gần nhất đưa lô vào kho, null khi không tìm thấy (hàng có từ trước).
     * {@code phanTheoChungTu}: phần chưa có kệ chia cho các phiếu nhập của lô vào kho, phiếu mới nhất trước, mỗi phiếu tối
     * đa số đã nhập lô đó ({@link PhanChungTu}); phần không chia hết (hàng có từ trước) không có dòng.
     */
    public record HangChuaCoKe(Integer loHangId, String maLo, SanPham sanPham, BigDecimal tonLo, int trenKe,
                               int chuaCoKe, int dangGiuNhat, boolean dangKiemKe, GoiYKe keGoiY,
                               List<KeLienQuan> keLienQuan, NguonNhap nguon, List<PhanChungTu> phanTheoChungTu) {
    }

    /**
     * Phần chưa có kệ của một lô được tính cho một phiếu nhập ({@code phieuChuyenId}: phiếu chuyển kho của phiếu nhập đó —
     * nhận chuyển kho, hoặc hàng về lại kho xuất khi phiếu bị hủy lúc đang đi đường; null với phiếu nhập khác).
     * {@code chungTu}: đủ thông tin phiếu nhập đó (cùng dạng {@link NguonNhap}) để màn lọc theo chứng từ gom nhóm đúng phiếu.
     */
    public record PhanChungTu(Integer phieuNhapId, String soPhieuNhap, Integer phieuChuyenId, int soLuong, NguonNhap chungTu) {
    }

    /**
     * Kệ gợi ý cho phần chưa có kệ của lô. {@code lyDo}: KE_CUA_LO · DANG_CHUA_LO · CUNG_SKU · CUNG_MAU (hằng ở
     * {@code GoiYKe}). {@code conCho}: số sản phẩm kệ còn nhận được, null = kệ không giới hạn sức chứa.
     */
    public record GoiYKe(Integer id, String ma, String lyDo, Integer conCho) {
    }

    /**
     * Kệ liên quan tới lô. {@code chan}: null = chọn được · BAO_TRI · KIEM_KE · DAY (hết chỗ) · DA_GOI_Y (chỗ còn lại đã
     * gợi ý cho các lô phía trên trong danh sách; xếp lô này trước thì vẫn vào được).
     */
    public record KeLienQuan(Integer id, String ma, String lyDo, String chan) {
    }

    /**
     * Chứng từ nhập gần nhất đưa lô vào kho. {@code loai}: CHUYEN_KHO · HUY_CHUYEN_KHO (hàng về lại kho xuất khi phiếu
     * chuyển bị hủy lúc đang đi đường) · KHACH_TRA · NHA_CUNG_CAP · KHAC.
     * {@code tuDau}: kho chuyển đi (CHUYEN_KHO) hoặc tên nhà cung cấp (NHA_CUNG_CAP), các loại khác null.
     */
    public record NguonNhap(Integer phieuNhapId, String soPhieuNhap, String loai, String tuDau, Integer phieuChuyenId,
                            String soPhieuChuyen, Instant ngay, String nguoiNhap) {
    }

    /** Số lô và tổng sản phẩm chưa có kệ ở một kho (số đếm trên menu). */
    public record DemChuaCoKe(int soLo, long soLuong) {
    }

    /** Kết quả xếp kệ của một lô trong lượt xếp nhiều lô: {@code loi} null khi đã xếp. */
    public record KetQuaXepKe(Integer loHangId, Integer viTriKhoId, int soLuong, boolean daXep, String loi) {
    }

    /** Phần tóm tắt phiếu điều chỉnh của đợt đã duyệt. */
    public record PhieuDieuChinh(Integer id, String soPhieu, String loaiDieuChinh, BigDecimal tongGiaTriTang,
                                 BigDecimal tongGiaTriGiam, BigDecimal giaTriChenhLechThuan, Instant ngayDieuChinh,
                                 Nguoi nguoiDuyet, int soDong) {
    }
}
