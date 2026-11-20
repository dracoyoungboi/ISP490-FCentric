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
     * keGoiYId: kệ chọn sẵn ở cửa hàng nhận, chỉ kệ còn chỗ: kệ đang chứa mã này nhiều nhất, không có thì kệ chính
     * của lô sẽ nhận hàng trả; null khi không có kệ nào hợp.
     * tienConHoan: tiền khách đã trả cho dòng trừ phần đã hoàn — trả hết số còn lại thì hoàn đúng số này (khớp máy chủ).
     */
    public record Dong(Integer chiTietId, Integer bienTheId, String maSku, String tenSanPham, String mauSac,
                       String kichCo, String anh, BigDecimal soLuongMua, BigDecimal soLuongDaTra,
                       BigDecimal soLuongConTra, BigDecimal donGiaNiemYet, BigDecimal donGiaThucTra, Integer keGoiYId,
                       BigDecimal tienConHoan) {
    }

    /**
     * Kệ chọn được để cất hàng Đạt. conCho: số còn xếp thêm được theo sức chứa (cùng cách tính với chốt chặn lúc xếp
     * kệ), null khi kệ không đặt sức chứa.
     */
    public record Ke(Integer id, String ma, Integer conCho) {
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

    /**
     * tinhTrang: dat | loi. viTriKhoId và lyDo chỉ khi dat (dòng loi máy chủ tự ghi lý do lỗi sản xuất).
     * nhomLoi bắt buộc khi loi. ghiChu bắt buộc khi chọn Khác (lý do Khác hoặc Lỗi khác).
     */
    public record DongTra(Integer chiTietDonBanHangId, BigDecimal soLuong, String tinhTrang, Integer viTriKhoId,
                          String lyDo, String nhomLoi, String ghiChu) {
    }

    public record KetQua(Integer phieuTraHangId, String soPhieu, String soPhieuNhap, BigDecimal tongTienHoan,
                         String phuongThucHoan, String trangThaiTraHang) {
    }

    // ───────────── Phiếu đã trả (lịch sử tại quầy) ─────────────

    /**
     * Một phiếu trả trong danh sách "Phiếu đã trả" của cửa hàng nhận. traCheo: hóa đơn gốc bán ở cửa hàng khác
     * (khoBan). soLuongLoi: phần hàng Lỗi để riêng, phần còn lại là hàng Đạt đã nhập kho.
     */
    public record PhieuTomTat(Integer id, String soPhieu, Instant ngayTao, Integer donBanHangId, String soDonHang,
                              String khachHang, String soDienThoai, boolean traCheo, String khoBan, boolean quaHan,
                              BigDecimal tongSoLuong, BigDecimal soLuongLoi, BigDecimal tongTienHoan,
                              String phuongThucHoan, String nguoiLap) {
    }

    /**
     * Phiếu trả nhận tại một cửa hàng từ mốc {@code tu} (đầu ngày, giờ Việt Nam), mới nhất trước. Các số tổng tính
     * trên mọi phiếu trong khoảng, kể cả khi danh sách bị cắt ở giới hạn dòng ({@code conNua} = true).
     */
    public record LichSuPhieu(Instant tu, List<PhieuTomTat> phieu, long soPhieu, BigDecimal tongSoLuong,
                              BigDecimal tienMat, BigDecimal chuyenKhoan, BigDecimal tongHoan, boolean conNua) {
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
                            String lyDo, String nhomLoi, String ghiChu) {
    }
}
