package com.dev.backend.dto.trahang;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Dữ liệu màn Trả hàng tại quầy (/pos/returns) theo đặc tả BA "Trả hàng / Đổi hàng tại POS". Số điện thoại khách
 * luôn che (09xx xxx 218) trước khi rời máy chủ.
 */
public final class TraHangDto {

    private TraHangDto() {
    }

    // ───────────── Tra cứu ─────────────

    /** Một hóa đơn POS tìm thấy (tìm theo số điện thoại có thể ra nhiều hóa đơn). */
    public record DonTomTat(Integer donBanHangId, String soDonHang, Instant thanhToanLuc, String khoBan,
                            BigDecimal tongCong, String khachHang, String soDienThoai, String trangThaiTraHang,
                            boolean conTraDuoc, boolean quaHan) {
    }

    /** Khối thông tin đơn gốc + bảng dòng hàng có thể trả, tính cho cửa hàng nhận {@code khoNhanId}. */
    public record DonGoc(Integer donBanHangId, String soDonHang, Instant thanhToanLuc, Instant hanTraDen, long soNgay,
                         boolean quaHan, Integer khoBanId, String khoBan, Integer khoNhanId, String khoNhan,
                         boolean traCheo, String thuNgan, String khachHang, String soDienThoai, BigDecimal tongCong,
                         String phuongThucGoc, String trangThaiTraHang, boolean khoCoKe, List<Ke> ke, List<Dong> dong,
                         DuyetHieuLuc duyet, boolean coQuyenDuyet, List<PhieuDaTra> phieuDaTra) {
    }

    /**
     * Một dòng của đơn gốc. donGiaThucTra = (thành tiền − giảm giá dòng) / số lượng mua, làm tròn đồng (GBR-RET-05).
     * keGoiYId: kệ ở cửa hàng nhận đang chứa mã này nhiều nhất (gợi ý chọn sẵn), null khi không có.
     * tienConHoan: tiền khách đã trả cho dòng trừ phần đã hoàn — trả hết số còn lại thì hoàn đúng số này (khớp máy chủ).
     */
    public record Dong(Integer chiTietId, Integer bienTheId, String maSku, String tenSanPham, String mauSac,
                       String kichCo, String anh, BigDecimal soLuongMua, BigDecimal soLuongDaTra,
                       BigDecimal soLuongConTra, BigDecimal donGiaNiemYet, BigDecimal donGiaThucTra, Integer keGoiYId,
                       BigDecimal tienConHoan) {
    }

    public record Ke(Integer id, String ma) {
    }

    /** Duyệt quá hạn còn hiệu lực của thu ngân đang đăng nhập cho đơn này. */
    public record DuyetHieuLuc(Integer yeuCauId, String nguoiDuyet, Instant hetHieuLucLuc) {
    }

    public record PhieuDaTra(Integer id, String soPhieu, Instant ngayTao, BigDecimal tongTienHoan, String khoNhan) {
    }

    // ───────────── Duyệt quá hạn (mã PIN qua email) ─────────────

    public record YeuCauDuyetRequest(Integer donBanHangId, Integer khoId, String lyDo) {
    }

    /** nguoiNhan: họ tên các quản lý đã nhận mã (không lộ email). */
    public record YeuCauDuyetKetQua(Integer yeuCauId, Instant hetHanLuc, List<String> nguoiNhan) {
    }

    public record NhapMaRequest(String ma) {
    }

    // ───────────── Xác nhận trả ─────────────

    /**
     * requestId: quầy sinh một lần cho mỗi lần bấm Xác nhận, giữ nguyên khi gửi lại sau lỗi mạng (chống trả hai lần).
     * yeuCauDuyetId: yêu cầu đã nhập đúng mã (đơn quá hạn). lyDoDuyet: quản lý cửa hàng tự trả đơn quá hạn (không cần mã).
     */
    public record XacNhanRequest(String requestId, Integer donBanHangId, Integer khoId, String phuongThucHoan,
                                 String nganHang, String soTaiKhoan, String tenChuTaiKhoan, String maGiaoDich,
                                 Integer yeuCauDuyetId, String lyDoDuyet, String ghiChu, List<DongTra> dong) {
    }

    /** tinhTrang: dat | loi. viTriKhoId chỉ khi dat. nhomLoi bắt buộc khi loi. */
    public record DongTra(Integer chiTietDonBanHangId, BigDecimal soLuong, String tinhTrang, Integer viTriKhoId,
                          String lyDo, String nhomLoi) {
    }

    public record KetQua(Integer phieuTraHangId, String soPhieu, String soPhieuNhap, BigDecimal tongTienHoan,
                         String phuongThucHoan, String trangThaiTraHang) {
    }

    // ───────────── Biên bản (in 02 liên) ─────────────

    public record PhieuChiTiet(Integer id, String soPhieu, Instant ngayTao, String soPhieuNhap, Integer donBanHangId,
                               String soDonHang, Instant thanhToanLuc, String khoBan, String khoNhan, boolean traCheo,
                               String khachHang, String soDienThoai, String nguoiLap, boolean quaHan,
                               String nguoiDuyet, String lyDoDuyet, String phuongThucHoan, String nganHang,
                               String soTaiKhoan, String tenChuTaiKhoan, String maGiaoDich, BigDecimal tongSoLuong,
                               BigDecimal soLuongDat, BigDecimal soLuongLoi, BigDecimal tongTienHoan, String ghiChu,
                               List<DongPhieu> dong) {
    }

    public record DongPhieu(String tenSanPham, String maSku, String mauSac, String kichCo, BigDecimal soLuong,
                            BigDecimal donGiaHoan, BigDecimal thanhTienHoan, String tinhTrang, String ke,
                            String lyDo, String nhomLoi) {
    }
}
