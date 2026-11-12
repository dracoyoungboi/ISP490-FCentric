package com.dev.backend.dto.chuyenke;

import java.time.Instant;
import java.util.List;

/** Dữ liệu trả về của màn Chuyển kệ nội bộ (UC-7.4). */
public final class ChuyenKeDto {

    private ChuyenKeDto() {
    }

    /**
     * Một kệ vừa quét (BA 6.1 "Thông tin kệ"). {@code sucChua} null = kệ không giới hạn sức chứa; {@code conTrong} null
     * cùng nghĩa. {@code khoa}: null = dùng được; KIEM_KE (cả kệ đang kiểm kê) · BAO_TRI · KHAC (trạng thái khác).
     * Kệ bảo trì vẫn là kệ nguồn được (giải phóng kệ để sửa, BR-BIN-03) nhưng không nhận hàng. {@code dong}: hàng đang
     * nằm trên kệ theo lô.
     */
    public record Ke(Integer id, String maViTri, String khuVuc, String dayKe, String hangKe, String tangKe,
                     String trangThai, Integer sucChua, int dangChua, Integer conTrong, String khoa, String lyDoKhoa,
                     List<DongTrenKe> dong) {
    }

    /**
     * Một lô trên kệ (BA 6.1 "Danh sách SKU &amp; Lô"). {@code tonTaiKe}: tồn thực tế ở kệ; {@code dangGiuNhat}: phần phiếu
     * nhặt đang giữ ở kệ này; {@code khaDung} = tonTaiKe − dangGiuNhat (BR-BIN-02), về 0 khi lô đang khóa kiểm kê ở kệ
     * này ({@code khoaKiemKe}). {@code ngayNhap}: ngày tạo lô (thứ tự FIFO; hệ thống chưa quản lý hạn lưu kho).
     */
    public record DongTrenKe(Integer loHangId, String maLo, Integer bienTheId, String maSku, String maVach,
                             String tenSanPham, String mau, String maMauHex, String kichCo, String anh,
                             Instant ngayNhap, int tonTaiKe, int dangGiuNhat, int khaDung, boolean khoaKiemKe) {
    }

    /** Một kệ trong danh sách gợi ý mã kệ (gõ tay khi không có máy quét). */
    public record KeGon(Integer id, String maViTri, String khuVuc, String trangThai, Integer sucChua, int dangChua) {
    }

    /**
     * Kệ đích gợi ý cho lượt chuyển. {@code conTrong} null = không giới hạn sức chứa. {@code cungMa}: kệ đang chứa một
     * biến thể đang chuyển (cất về đây là dồn kệ); {@code cungKhu}: cùng khu vực với kệ nguồn; {@code duCho}: còn đủ chỗ
     * cho toàn bộ số đang cần cất. Không gồm kệ nguồn, kệ đang kiểm kê / bảo trì / trạng thái khác, kệ đã đầy.
     */
    public record KeGoiY(Integer id, String maViTri, String khuVuc, String dayKe, String tangKe, Integer sucChua,
                         int dangChua, Integer conTrong, boolean cungMa, boolean cungKhu, boolean duCho) {
    }

    /** Kết quả chốt chuyển kệ. */
    public record KetQua(Integer id, String maPhieu, int soDong, int tongSoLuong) {
    }

    /** Một phiếu trong lịch sử chuyển kệ, kèm các dòng. */
    public record Phieu(Integer id, String maPhieu, String loaiChuyen, Instant ngayThucHien, Integer nguoiThucHienId,
                        String nguoiThucHien, boolean vuotSucChua, String ghiChu, int tongSoLuong,
                        List<String> keNguon, List<String> keDich, List<DongPhieu> dong) {
    }

    public record DongPhieu(Integer id, Integer loHangId, String maLo, Integer bienTheId, String maSku, String tenSanPham,
                            String mau, String maMauHex, String kichCo, String keNguon, String keDich, int soLuong) {
    }

    /** Trang danh sách phiếu. */
    public record Trang(List<Phieu> ds, long tong, int trang, int kichThuoc) {
    }
}
