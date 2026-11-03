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

    public record VanDe(String ma, String noiDung) {
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

    /** Lô còn hàng chưa có kệ ở kho (Đ4). */
    public record HangChuaCoKe(Integer loHangId, String maLo, SanPham sanPham, BigDecimal tonLo, int trenKe,
                               int chuaCoKe, ViTri keGoiY) {
    }

    /** Phần tóm tắt phiếu điều chỉnh của đợt đã duyệt. */
    public record PhieuDieuChinh(Integer id, String soPhieu, String loaiDieuChinh, BigDecimal tongGiaTriTang,
                                 BigDecimal tongGiaTriGiam, BigDecimal giaTriChenhLechThuan, Instant ngayDieuChinh,
                                 Nguoi nguoiDuyet, int soDong) {
    }
}
