package com.dev.backend.dto.response.congncc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Dữ liệu trả về của Cổng nhà cung cấp (API công khai /api/v1/cong-ncc). Viết tay từng trường: chỉ những gì nhà cung
 * cấp được xem mới đi ra (không ghi chú nội bộ, người tạo / duyệt, giá vốn, tồn kho, đơn của nhà cung cấp khác).
 */
public final class CongNcc {

    private CongNcc() {
    }

    // ── Đăng nhập ──

    public record NhaCungCap(String ten, String email) {
    }

    /** Xác nhận mã đúng: token phiên (header X-Phien-Cong-Ncc) sống tới {@code hetHanPhien}. */
    public record DangNhap(String phien, Instant hetHanPhien, NhaCungCap nhaCungCap, CuaHangCongDto cuaHang) {
    }

    public record NguoiPhuTrach(String hoTen, String soDienThoai, String email) {
    }

    // ── Cần xử lý ──

    /** Hàng lỗi đang ở đâu: O_KHO | DA_TRA | DA_TIEU_HUY, kèm câu ngắn (tên kho / người giao hàng, biển số). */
    public record HangLoiTomTat(String trangThai, String moTa) {
    }

    /** hanTraLoi: hết hạn trả lời (null khi chưa gửi được email biên bản). */
    public record BienBanCho(Integer id, String soBienBan, String soDonMua, String soPhieuNhap, Instant ngayLap,
                             Instant hanTraLoi, int tongSoLuong, BigDecimal tongGiaTri, HangLoiTomTat hangLoi) {
    }

    public record DonChoBaoGia(Integer id, String soDonMua, int soMatHang, BigDecimal tongSoLuong, Instant ngayCanGiao,
                               String tenKho, Instant ngayGuiYeuCau) {
    }

    public record SoLieu30Ngay(int baoGiaDaGui, int duocChapNhan, int sanPhamLoi, BigDecimal tienTru) {
    }

    public record ViecCanLam(NhaCungCap nhaCungCap, List<BienBanCho> bienBanCho, List<DonChoBaoGia> donChoBaoGia,
                             SoLieu30Ngay soLieu30Ngay, NguoiPhuTrach nguoiPhuTrach) {
    }

    // ── Biên bản ──

    public record HangLoi(String trangThai, String cachXuLy, String nguoiNhan, String bienSoXe, Instant thoiDiem) {
    }

    public record DongLoi(String tenSanPham, String mauSac, String kichCo, String sku, String maLo, String lyDo,
                          int soLuong, BigDecimal donGia, BigDecimal giaTri) {
    }

    /**
     * Một lựa chọn đang áp dụng. giaTri: DOI_HANG | TRU_CONG_NO (cách bù) hoặc NHAN_LAI | TIEU_HUY (hàng lỗi). nguon:
     * CONG_NCC (nhà cung cấp chọn) | DONG_DON (bên mua đóng đơn nhận thiếu) | TU_DONG (quá hạn trả lời) | DU_LIEU_CU.
     */
    public record LuaChon(String giaTri, String nguon, String nguoiXacNhan, Instant luc, String ghiChu) {
    }

    /**
     * trangThai: CHO_XAC_NHAN (còn việc phải trả lời) | DA_XAC_NHAN | DA_HUY. cachBuMo / hangLoiMo: lựa chọn còn chọn hoặc
     * đổi được (rỗng: việc đó đã chốt). hanTraLoi: hết hạn trả lời. phienBan: gửi kèm khi trả lời. tienTru: tiền đã trừ
     * (hoặc dự kiến khi chưa nhập kho); soLuongTruTien: số lỗi đã trừ tiền. buXong / conChoGiao: giao bù đã nhận đủ / số
     * còn chờ giao. cachBuDaChon / hangLoiDaChon: lựa chọn đang áp dụng (null: chưa chọn).
     */
    public record BienBan(Integer id, String soBienBan, String soDonMua, String soPhieuNhap, String tenKho, String diaChiKho,
                          Instant ngayLap, boolean phieuDaNhap, String trangThai, String phuongAn, List<String> cachBuMo,
                          List<String> hangLoiMo, Instant hanTraLoi, Integer phienBan, HangLoi hangLoi,
                          List<DongLoi> dong, int tongSoLuong, BigDecimal tongGiaTri, BigDecimal tienTru,
                          int soLuongTruTien, boolean buXong, int conChoGiao, LuaChon cachBuDaChon,
                          LuaChon hangLoiDaChon, NguoiPhuTrach nguoiPhuTrach, String nguoiLienHeNcc) {
    }

    // ── Lịch sử ──

    /** ketQua: CHO_BAO_GIA | CHO_KET_QUA | DUOC_CHAP_NHAN | KHONG_CHAP_NHAN | DA_HUY. */
    public record DongBaoGia(Integer id, String soDonMua, Instant ngayYeuCau, Instant ngayBaoGia, int soMatHang,
                             BigDecimal tongTien, String ketQua) {
    }

    public record TomTatBaoGia(int daBaoGia, int duocChapNhan, int khongChapNhan, int choBaoGia) {
    }

    public record LichSuBaoGia(List<DongBaoGia> items, TomTatBaoGia tomTat) {
    }

    /** hangLoi: O_KHO | DA_TRA | DA_TIEU_HUY; hangLoiNcc: nhà cung cấp chọn NHAN_LAI | TIEU_HUY | null. */
    public record DongTraHang(Integer id, String soBienBan, Instant ngayLap, String soDonMua, int soLuongLoi,
                              String phuongAn, BigDecimal tienTru, boolean buXong, int conChoGiao, String hangLoi,
                              String hangLoiNcc, boolean choTraLoi, boolean daHuy) {
    }

    public record TomTatTraHang(int bienBan, int sanPhamLoi, BigDecimal tienTru, int choChon) {
    }

    public record LichSuTraHang(List<DongTraHang> items, TomTatTraHang tomTat) {
    }
}
